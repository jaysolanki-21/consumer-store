import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../services/api";
import socket from "../services/socket";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  FiBox,
  FiShoppingBag,
  FiClock,
  FiAlertTriangle,
  FiTrendingUp,
  FiCheckCircle,
  FiXCircle,
  FiActivity,
  FiArrowRight,
  FiRefreshCw,
  FiMonitor,
  FiLayers,
  FiUsers,
} from "react-icons/fi";
import { FaRupeeSign } from "react-icons/fa";

// Helper: Check if date is today in user's local timezone
const isSameDayAsToday = (dateString) => {
  if (!dateString) return false;
  const d = new Date(dateString);
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
};

// Calculate order profit from items
const calculateOrderProfit = (order) => {
  if (order.profitAmount != null) return Number(order.profitAmount) || 0;
  if (order.profit != null) return Number(order.profit) || 0;

  const items = order.items || order.products || order.orderItems || [];
  if (!Array.isArray(items) || items.length === 0) return 0;

  return items.reduce((sum, item) => {
    const qty = Number(item.quantity ?? item.qty ?? 1) || 1;
    const sellPrice =
      Number(
        item.sellingPrice ??
          item.price ??
          item.salePrice ??
          (item.totalPrice ? item.totalPrice / qty : 0),
      ) || 0;

    const product = item.product || item.productId || {};
    const costPrice =
      Number(
        item.costPrice ??
          item.purchasePrice ??
          item.buyingPrice ??
          item.buyPrice ??
          product.costPrice ??
          product.purchasePrice ??
          product.buyingPrice ??
          product.buyPrice ??
          0,
      ) || 0;

    return sum + (sellPrice - costPrice) * qty;
  }, 0);
};

// Custom Chart Tooltip
const CustomChartTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#0B1220] text-slate-100 px-3.5 py-2.5 rounded-xl shadow-xl border border-slate-700/80 text-xs space-y-1.5 min-w-[150px]">
        <p className="font-semibold text-slate-300 text-xs">{label}</p>
        <div className="flex items-center justify-between gap-3">
          <span className="text-slate-400 text-xs flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
            Revenue:
          </span>
          <span className="font-bold text-white text-xs tabular-nums">
            ₹{Number(data.revenue || 0).toLocaleString("en-IN")}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-slate-400 text-xs flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Orders:
          </span>
          <span className="font-bold text-white text-xs tabular-nums">{data.orders || 0}</span>
        </div>
      </div>
    );
  }
  return null;
};

// Get real-time counter status: DISABLED -> OFFLINE -> ONLINE
const getCounterStatus = (counter) => {
  const isCounterDisabled =
    !counter?.isActive ||
    (counter?.disabledUntil && new Date(counter.disabledUntil) > new Date());
  const isUserDisabled =
    counter?.userId &&
    (!counter.userId.isActive ||
      (counter.userId.disabledUntil &&
        new Date(counter.userId.disabledUntil) > new Date()));
  if (isCounterDisabled || isUserDisabled) return "DISABLED";
  if (!counter?.userId?.isOnline) return "OFFLINE";
  return "ONLINE";
};

// Get real-time staff status: DISABLED -> OFFLINE -> ONLINE
const getStaffStatus = (member) => {
  const isDisabled =
    !member?.isActive ||
    (member?.disabledUntil && new Date(member.disabledUntil) > new Date());
  if (isDisabled) return "DISABLED";
  if (!member?.isOnline) return "OFFLINE";
  return "ONLINE";
};

// Status ordering: ONLINE (1) -> OFFLINE (2) -> DISABLED (3)
const STATUS_ORDER = {
  ONLINE: 1,
  OFFLINE: 2,
  DISABLED: 3,
};

const sortByStatusAndRevenue = (list) => {
  return [...list].sort((a, b) => {
    const orderA = STATUS_ORDER[a.status] || 99;
    const orderB = STATUS_ORDER[b.status] || 99;
    if (orderA !== orderB) return orderA - orderB;
    return (b.revenue || 0) - (a.revenue || 0);
  });
};

export default function AdminPage() {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [counters, setCounters] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(new Date());

  // Fetch initial dashboard data
  const loadDashboardData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setIsRefreshing(true);

    try {
      const [productsRes, ordersRes, countersRes, staffRes] = await Promise.all([
        api.get("/products"),
        api.get("/orders"),
        api.get("/counters").catch(() => ({ data: [] })),
        api.get("/users/staff").catch(() => ({ data: [] })),
      ]);

      setProducts(Array.isArray(productsRes.data) ? productsRes.data : []);
      setOrders(Array.isArray(ordersRes.data) ? ordersRes.data : []);
      setCounters(Array.isArray(countersRes.data) ? countersRes.data : []);
      setStaff(Array.isArray(staffRes?.data) ? staffRes.data : []);
      setLastSyncTime(new Date());
    } catch (err) {
      console.error("Failed to load admin dashboard data", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();

    // Socket.IO real-time event listeners (smooth state updates without full-page reloads)
    const handleNewOrder = (order) => {
      if (!order?._id) return;
      setOrders((prev) => {
        const exists = prev.some((o) => o._id === order._id);
        if (exists) return prev.map((o) => (o._id === order._id ? order : o));
        return [order, ...prev];
      });
      setLastSyncTime(new Date());
    };

    const handleOrderUpdate = (order) => {
      if (!order?._id) return;
      setOrders((prev) =>
        prev.map((o) => (o._id === order._id ? order : o)),
      );
      setLastSyncTime(new Date());
    };

    const handleOrderDelete = (orderId) => {
      setOrders((prev) => prev.filter((o) => o._id !== orderId));
      setLastSyncTime(new Date());
    };

    const handleBulkOrdersDelete = () => {
      loadDashboardData(true);
    };

    const handleStockUpdate = (product) => {
      if (product?._id) {
        setProducts((prev) =>
          prev.map((p) => (p._id === product._id ? { ...p, ...product } : p)),
        );
      } else {
        api
          .get("/products")
          .then((res) => setProducts(res.data))
          .catch(() => {});
      }
      setLastSyncTime(new Date());
    };

    const handleProductCreate = (product) => {
      if (product?._id) {
        setProducts((prev) => [product, ...prev]);
      }
    };

    const handleProductDelete = ({ _id }) => {
      if (_id) {
        setProducts((prev) => prev.filter((p) => p._id !== _id));
      }
    };

    const handleCountersUpdate = () => {
      api
        .get("/counters")
        .then((res) => setCounters(Array.isArray(res.data) ? res.data : []))
        .catch(() => {});
    };

    const handleUsersUpdate = () => {
      api
        .get("/users/staff")
        .then((res) => setStaff(Array.isArray(res.data) ? res.data : []))
        .catch(() => {});
      api
        .get("/counters")
        .then((res) => setCounters(Array.isArray(res.data) ? res.data : []))
        .catch(() => {});
    };

    socket.on("newOrder", handleNewOrder);
    socket.on("orderCreated", handleNewOrder);
    socket.on("orderConfirmed", handleOrderUpdate);
    socket.on("orderCancelled", handleOrderUpdate);
    socket.on("orderReverted", handleOrderUpdate);
    socket.on("orderUpdated", handleOrderUpdate);
    socket.on("orderDeleted", handleOrderDelete);
    socket.on("ordersBulkDeleted", handleBulkOrdersDelete);

    socket.on("stockUpdated", handleStockUpdate);
    socket.on("productUpdated", handleStockUpdate);
    socket.on("stockRefilled", handleStockUpdate);
    socket.on("productCreated", handleProductCreate);
    socket.on("productDeleted", handleProductDelete);

    socket.on("countersUpdated", handleCountersUpdate);
    socket.on("usersUpdated", handleUsersUpdate);

    return () => {
      socket.off("newOrder", handleNewOrder);
      socket.off("orderCreated", handleNewOrder);
      socket.off("orderConfirmed", handleOrderUpdate);
      socket.off("orderCancelled", handleOrderUpdate);
      socket.off("orderReverted", handleOrderUpdate);
      socket.off("orderUpdated", handleOrderUpdate);
      socket.off("orderDeleted", handleOrderDelete);
      socket.off("ordersBulkDeleted", handleBulkOrdersDelete);

      socket.off("stockUpdated", handleStockUpdate);
      socket.off("productUpdated", handleStockUpdate);
      socket.off("stockRefilled", handleStockUpdate);
      socket.off("productCreated", handleProductCreate);
      socket.off("productDeleted", handleProductDelete);

      socket.off("countersUpdated", handleCountersUpdate);
      socket.off("usersUpdated", handleUsersUpdate);
    };
  }, [loadDashboardData]);

  // ===============================
  // REAL-TIME COMPUTED METRICS
  // ===============================

  // 1. Orders breakdown for today
  const todayOrders = useMemo(() => {
    return orders.filter((o) => isSameDayAsToday(o.createdAt));
  }, [orders]);

  const todayConfirmedOrders = useMemo(() => {
    return todayOrders.filter((o) => o.status === "Confirmed");
  }, [todayOrders]);

  // 2. KPIs
  const kpis = useMemo(() => {
    const activeProducts = products.filter((p) => p.visibility !== false);
    const inStockCount = activeProducts.filter((p) => (p.stock || 0) > 0).length;

    const todayOrdersCount = todayOrders.length;

    const todayRevenue = todayConfirmedOrders.reduce(
      (sum, o) => sum + (Number(o.totalAmount) || 0),
      0,
    );

    const todayProfit = todayConfirmedOrders.reduce(
      (sum, o) => sum + calculateOrderProfit(o),
      0,
    );

    const profitMargin =
      todayRevenue > 0
        ? Math.round((todayProfit / todayRevenue) * 100)
        : 0;

    const pendingOrdersCount = orders.filter((o) => o.status === "Pending").length;

    const outOfStockCount = activeProducts.filter(
      (p) => (p.stock || 0) <= 0,
    ).length;

    const lowStockCount = activeProducts.filter((p) => {
      const stock = p.stock || 0;
      const threshold = p.lowStockThreshold ?? p.minStock ?? 5;
      return stock > 0 && stock <= threshold;
    }).length;

    return {
      totalProducts: activeProducts.length,
      inStockCount,
      todayOrdersCount,
      todayConfirmedCount: todayConfirmedOrders.length,
      todayRevenue,
      todayProfit,
      profitMargin,
      pendingOrdersCount,
      lowStockCount,
      outOfStockCount,
      totalInventoryAlerts: lowStockCount + outOfStockCount,
    };
  }, [products, orders, todayOrders, todayConfirmedOrders]);

  // 3. Live Order Status breakdown
  const liveOrderStatus = useMemo(() => {
    const pending = todayOrders.filter((o) => (o.status || "").toLowerCase() === "pending").length;
    const approved = todayOrders.filter((o) => {
      const s = (o.status || "").toLowerCase();
      return s === "approved" || s === "processing";
    }).length;
    const completed = todayOrders.filter((o) => {
      const s = (o.status || "").toLowerCase();
      return s === "confirmed" || s === "completed";
    }).length;
    const rejected = todayOrders.filter((o) => {
      const s = (o.status || "").toLowerCase();
      return s === "cancelled" || s === "rejected";
    }).length;

    const total = todayOrders.length || 1;

    return {
      pending,
      approved,
      completed,
      rejected,
      total: todayOrders.length,
      pendingPct: Math.round((pending / total) * 100),
      approvedPct: Math.round((approved / total) * 100),
      completedPct: Math.round((completed / total) * 100),
      rejectedPct: Math.round((rejected / total) * 100),
    };
  }, [todayOrders]);

  // 4. Today's Hourly Sales Trend
  const hourlySales = useMemo(() => {
    const hours = [];
    // Operating hours 8 AM to 10 PM
    for (let h = 8; h <= 22; h++) {
      const period = h >= 12 ? "PM" : "AM";
      const displayHour = h % 12 === 0 ? 12 : h % 12;
      hours.push({
        hour24: h,
        time: `${displayHour} ${period}`,
        revenue: 0,
        orders: 0,
      });
    }

    todayConfirmedOrders.forEach((order) => {
      const d = new Date(order.createdAt);
      const h = d.getHours();
      const slot = hours.find((s) => s.hour24 === h);
      if (slot) {
        slot.revenue += Number(order.totalAmount || 0);
        slot.orders += 1;
      }
    });

    return hours;
  }, [todayConfirmedOrders]);

  const peakSalesHour = useMemo(() => {
    let peak = null;
    hourlySales.forEach((h) => {
      if (h.revenue > 0 && (!peak || h.revenue > peak.revenue)) {
        peak = h;
      }
    });
    return peak;
  }, [hourlySales]);

  // 5. Top 5 Selling Products Today
  const topProductsToday = useMemo(() => {
    const map = new Map();

    todayConfirmedOrders.forEach((order) => {
      const items = order.items || [];
      items.forEach((item) => {
        const id =
          item.productId?._id || item.productId || item.name || "unknown";
        const name = item.productId?.name || item.name || "Unnamed Product";
        const qty = Number(item.quantity || item.qty || 1);
        const price = Number(item.price || item.sellingPrice || 0);
        const revenue = qty * price;

        if (map.has(id)) {
          const existing = map.get(id);
          existing.qty += qty;
          existing.revenue += revenue;
        } else {
          map.set(id, {
            id,
            name,
            qty,
            revenue,
            category:
              item.productId?.category?.name ||
              item.category ||
              "General",
          });
        }
      });
    });

    return Array.from(map.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [todayConfirmedOrders]);

  // 6. Inventory Alerts (Out of stock & low stock)
  const inventoryAlertItems = useMemo(() => {
    const activeProducts = products.filter((p) => p.visibility !== false);
    const critical = [];

    activeProducts.forEach((p) => {
      const stock = Number(p.stock ?? 0);
      const threshold = Number(p.lowStockThreshold ?? p.minStock ?? 5);

      if (stock <= 0) {
        critical.push({ ...p, alertType: "out_of_stock", stock, threshold });
      } else if (stock <= threshold) {
        critical.push({ ...p, alertType: "low_stock", stock, threshold });
      }
    });

    // Sort: Out of stock first, then lowest stock
    return critical.sort((a, b) => a.stock - b.stock).slice(0, 6);
  }, [products]);

  // 7. Counter Overview Data
  const counterStats = useMemo(() => {
    const list = counters.map((c) => {
      const counterId = String(c._id);
      const counterName = (c.name || `Counter ${c.counterNumber || 1}`).trim().toLowerCase();

      const matchingOrders = todayConfirmedOrders.filter((order) => {
        const orderCounterId =
          order.counter && typeof order.counter === "object"
            ? String(order.counter._id || order.counter.id || "")
            : String(order.counter || order.counterId || "");
        if (orderCounterId && orderCounterId === counterId) return true;

        const orderCounterName = (
          (order.counter && typeof order.counter === "object" && order.counter.name) ||
          order.counterName ||
          ""
        ).trim().toLowerCase();
        if (orderCounterName && orderCounterName === counterName) return true;

        return false;
      });

      const ordersCount = matchingOrders.length;
      const revenue = matchingOrders.reduce(
        (sum, o) => sum + (Number(o.totalAmount) || 0),
        0
      );
      const status = getCounterStatus(c);

      return {
        id: c._id,
        name: c.name || `Counter ${c.counterNumber || 1}`,
        status,
        orders: ordersCount,
        revenue,
      };
    });

    return sortByStatusAndRevenue(list);
  }, [counters, todayConfirmedOrders]);

  // 8. Staff Overview Data
  const staffStats = useMemo(() => {
    const list = staff.map((member) => {
      const memberId = String(member._id);
      const memberName = (member.name || "").trim().toLowerCase();

      const matchingOrders = todayConfirmedOrders.filter((order) => {
        const orderStaffId = String(
          order.staffId?._id ||
          order.staffId ||
          order.confirmedBy?._id ||
          order.confirmedBy ||
          (typeof order.staff === "object" ? order.staff?._id : order.staff) ||
          ""
        );
        if (orderStaffId && orderStaffId === memberId) return true;

        const orderStaffName = (
          (order.staffName && String(order.staffName).trim()) ||
          order.confirmedBy?.name ||
          order.staffId?.name ||
          (typeof order.staff === "object" ? order.staff?.name : "") ||
          ""
        ).trim().toLowerCase();
        if (orderStaffName && orderStaffName === memberName) return true;

        return false;
      });

      const ordersCount = matchingOrders.length;
      const revenue = matchingOrders.reduce(
        (sum, o) => sum + (Number(o.totalAmount) || 0),
        0
      );
      const status = getStaffStatus(member);

      return {
        id: member._id,
        name: member.name || "Staff Member",
        status,
        orders: ordersCount,
        revenue,
      };
    });

    return sortByStatusAndRevenue(list);
  }, [staff, todayConfirmedOrders]);

  // Skeleton Loader for initial page load
  if (loading) {
    return (
      <div className="space-y-6 sm:space-y-7 animate-pulse">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <div className="h-8 bg-slate-200 dark:bg-[#172033] rounded-xl w-64" />
            <div className="h-4 bg-slate-100 dark:bg-[#172033]/60 rounded-lg w-80" />
          </div>
          <div className="h-8 bg-slate-200 dark:bg-[#172033] rounded-full w-36" />
        </div>

        {/* 6 KPI Cards Skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-[140px] bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-5 space-y-3"
            >
              <div className="flex justify-between items-center">
                <div className="h-3 bg-slate-200 dark:bg-[#172033] rounded w-16" />
                <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-[#172033]" />
              </div>
              <div className="h-7 bg-slate-200 dark:bg-[#172033] rounded w-20" />
              <div className="h-3 bg-slate-100 dark:bg-[#172033]/60 rounded w-24" />
            </div>
          ))}
        </div>

        {/* Main Analytics Grid Skeleton (68 / 32) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
          <div className="lg:col-span-8 h-[450px] bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-6" />
          <div className="lg:col-span-4 h-[450px] bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-6" />
        </div>

        {/* Secondary Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
          <div className="lg:col-span-6 h-[380px] bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-6" />
          <div className="lg:col-span-6 h-[380px] bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-6" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-7">
      {/* ========================================================= */}
      {/* 1. PAGE HEADER                                             */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[28px] sm:text-3xl font-bold text-slate-900 dark:text-[#F8FAFC] tracking-tight leading-tight">
              Store Dashboard
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Store
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-[#94A3B8] font-normal mt-1 leading-normal">
            Real-time operations, inventory alerts, and POS performance
          </p>
        </div>

        {/* Real-time sync status indicator */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800/80 text-xs font-medium text-slate-500 dark:text-[#94A3B8] shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-slate-600 dark:text-[#CBD5E1] font-semibold">Realtime Connected</span>
            <span className="text-slate-400 dark:text-[#64748B]">·</span>
            <span className="tabular-nums">
              {lastSyncTime.toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          </div>

          <button
            onClick={() => loadDashboardData(true)}
            disabled={isRefreshing}
            className="w-8 h-8 rounded-xl flex items-center justify-center bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800/80 text-slate-500 dark:text-[#94A3B8] hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-slate-300 dark:hover:border-slate-700 transition shadow-xs disabled:opacity-50"
            title="Refresh dashboard manually"
          >
            <FiRefreshCw
              className={`text-xs ${isRefreshing ? "animate-spin text-indigo-500" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. TOP KPI CARDS (6 Key Metrics)                           */}
      {/* ========================================================= */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Total Products */}
        <div className="bg-white dark:bg-[#111827] rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-xs hover:border-slate-300 dark:hover:border-slate-700/80 transition flex flex-col justify-between min-h-[140px]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider">
              Products
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <FiBox className="text-[18px]" />
            </div>
          </div>
          <div>
            <p className="text-[28px] font-bold text-slate-900 dark:text-[#F8FAFC] leading-none tabular-nums mt-3 mb-1.5">
              {kpis.totalProducts}
            </p>
            <p className="text-xs text-slate-500 dark:text-[#94A3B8] font-normal truncate">
              {kpis.inStockCount} active in stock
            </p>
          </div>
        </div>

        {/* Today's Orders */}
        <div className="bg-white dark:bg-[#111827] rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-xs hover:border-slate-300 dark:hover:border-slate-700/80 transition flex flex-col justify-between min-h-[140px]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider">
              Today Orders
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <FiShoppingBag className="text-[18px]" />
            </div>
          </div>
          <div>
            <p className="text-[28px] font-bold text-slate-900 dark:text-[#F8FAFC] leading-none tabular-nums mt-3 mb-1.5">
              {kpis.todayOrdersCount}
            </p>
            <p className="text-xs text-slate-500 dark:text-[#94A3B8] font-normal truncate">
              {kpis.todayConfirmedCount} completed sales
            </p>
          </div>
        </div>

        {/* Today's Revenue */}
        <div className="bg-white dark:bg-[#111827] rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-xs hover:border-slate-300 dark:hover:border-slate-700/80 transition flex flex-col justify-between min-h-[140px]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider">
              Today Revenue
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <FaRupeeSign className="text-[16px]" />
            </div>
          </div>
          <div>
            <p className="text-[28px] font-bold text-slate-900 dark:text-[#F8FAFC] leading-none tabular-nums mt-3 mb-1.5 truncate">
              ₹{kpis.todayRevenue.toLocaleString("en-IN")}
            </p>
            <p className="text-xs text-slate-500 dark:text-[#94A3B8] font-normal truncate">
              Confirmed receipts
            </p>
          </div>
        </div>

        {/* Today's Profit */}
        <div className="bg-white dark:bg-[#111827] rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-xs hover:border-slate-300 dark:hover:border-slate-700/80 transition flex flex-col justify-between min-h-[140px]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider">
              Today Profit
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <FiTrendingUp className="text-[18px]" />
            </div>
          </div>
          <div>
            <p className="text-[28px] font-bold text-slate-900 dark:text-[#F8FAFC] leading-none tabular-nums mt-3 mb-1.5 truncate">
              ₹{kpis.todayProfit.toLocaleString("en-IN")}
            </p>
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 truncate">
              {kpis.profitMargin}% gross margin
            </p>
          </div>
        </div>

        {/* Pending Orders */}
        <div
          onClick={() => navigate("/admin/orders")}
          className={`cursor-pointer rounded-2xl p-5 border transition flex flex-col justify-between min-h-[140px] shadow-xs ${
            kpis.pendingOrdersCount > 0
              ? "bg-amber-500/[0.04] dark:bg-amber-500/[0.06] border-amber-500/30 dark:border-amber-500/30 hover:border-amber-500/50"
              : "bg-white dark:bg-[#111827] border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700/80"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider">
              Pending Orders
            </span>
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                kpis.pendingOrdersCount > 0
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  : "bg-slate-100 dark:bg-slate-800/80 text-slate-400"
              }`}
            >
              <FiClock className="text-[18px]" />
            </div>
          </div>
          <div>
            <p
              className={`text-[28px] font-bold leading-none tabular-nums mt-3 mb-1.5 ${
                kpis.pendingOrdersCount > 0
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-slate-900 dark:text-[#F8FAFC]"
              }`}
            >
              {kpis.pendingOrdersCount}
            </p>
            <p className="text-xs font-normal text-slate-500 dark:text-[#94A3B8] truncate">
              {kpis.pendingOrdersCount > 0 ? "Action required" : "Queue clear"}
            </p>
          </div>
        </div>

        {/* Low Stock */}
        <div
          onClick={() => navigate("/admin/stock-refill")}
          className={`cursor-pointer rounded-2xl p-5 border transition flex flex-col justify-between min-h-[140px] shadow-xs ${
            kpis.totalInventoryAlerts > 0
              ? "bg-rose-500/[0.04] dark:bg-rose-500/[0.06] border-rose-500/30 dark:border-rose-500/30 hover:border-rose-500/50"
              : "bg-white dark:bg-[#111827] border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700/80"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider">
              Low Stock
            </span>
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                kpis.totalInventoryAlerts > 0
                  ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              }`}
            >
              <FiAlertTriangle className="text-[18px]" />
            </div>
          </div>
          <div>
            <p
              className={`text-[28px] font-bold leading-none tabular-nums mt-3 mb-1.5 ${
                kpis.totalInventoryAlerts > 0
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-slate-900 dark:text-[#F8FAFC]"
              }`}
            >
              {kpis.totalInventoryAlerts}
            </p>
            <p className="text-xs font-normal text-slate-500 dark:text-[#94A3B8] truncate">
              {kpis.totalInventoryAlerts > 0
                ? `${kpis.outOfStockCount > 0 ? `${kpis.outOfStockCount} out of stock` : `${kpis.lowStockCount} below min`}`
                : "Healthy"}
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3 & 4. MAIN ANALYTICS GRID (68% / 32%)                    */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        {/* Today's Sales Trend (Hourly Revenue Area Chart) */}
        <div className="lg:col-span-8 bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-5 sm:p-6 shadow-xs flex flex-col justify-between min-h-[440px]">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800/80">
              <div>
                <h2 className="text-[17px] font-semibold text-slate-900 dark:text-[#F8FAFC] flex items-center gap-2">
                  <span>Today's Sales Trend</span>
                  <span className="text-xs font-normal text-slate-400 dark:text-[#64748B]">
                    (Hourly Revenue)
                  </span>
                </h2>
                <p className="text-[13px] text-slate-500 dark:text-[#94A3B8] font-normal mt-0.5">
                  Visualizes sales pattern through current business day
                </p>
              </div>

              {peakSalesHour && (
                <div className="self-start sm:self-auto inline-flex items-center gap-2 px-3 py-1 rounded-xl text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  <FiActivity className="text-xs" />
                  <span>Peak: {peakSalesHour.time}</span>
                  <span className="font-bold">
                    • ₹{peakSalesHour.revenue.toLocaleString("en-IN")}
                  </span>
                </div>
              )}
            </div>

            {/* Chart Area */}
            <div className="mt-5 h-[280px] w-full">
              {kpis.todayRevenue === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-200 dark:border-slate-800/80 rounded-xl bg-slate-50/50 dark:bg-[#0F172A]/40">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-[#172033] flex items-center justify-center text-slate-400 mb-3">
                    <FiTrendingUp className="text-xl" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    No sales recorded today
                  </p>
                  <p className="text-xs text-slate-400 dark:text-[#64748B] mt-1 max-w-sm">
                    As orders are completed and confirmed, the hourly revenue curve will render here automatically in real time.
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={hourlySales}
                    margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="rgba(148, 163, 184, 0.10)"
                    />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 400 }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 400 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => (v >= 1000 ? `₹${v / 1000}k` : `₹${v}`)}
                    />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#salesGradient)"
                      activeDot={{ r: 5, fill: "#6366f1", stroke: "#fff", strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs font-normal text-slate-400 dark:text-[#64748B] pt-3.5 border-t border-slate-100 dark:border-slate-800/80 mt-2">
            <span>Operating Hours: 8:00 AM – 10:00 PM</span>
            <span>Real-time Socket.IO Sync</span>
          </div>
        </div>

        {/* Live Order Status Section (Today's Order Execution) */}
        <div className="lg:col-span-4 bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-5 sm:p-6 shadow-xs flex flex-col justify-between min-h-[440px]">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/80">
              <div>
                <h2 className="text-[17px] font-semibold text-slate-900 dark:text-[#F8FAFC]">
                  Today's Order Execution
                </h2>
                <p className="text-[13px] text-slate-500 dark:text-[#94A3B8] font-normal mt-0.5">
                  Real-time status distribution
                </p>
              </div>

              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>

            {/* 2 × 2 Order Status Grid */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              {/* Pending */}
              <div className="p-3.5 rounded-xl bg-amber-500/[0.07] border border-amber-500/25 transition">
                <div className="flex items-center justify-between text-amber-700 dark:text-amber-400">
                  <span className="text-xs font-semibold uppercase tracking-wider">Pending</span>
                  <FiClock className="text-sm" />
                </div>
                <p className="text-[26px] font-bold text-amber-800 dark:text-amber-300 leading-tight mt-1.5 tabular-nums">
                  {liveOrderStatus.pending}
                </p>
                <p className="text-[11px] font-normal text-amber-600/90 dark:text-amber-400/80 mt-0.5">
                  Waiting approval
                </p>
              </div>

              {/* Approved */}
              <div className="p-3.5 rounded-xl bg-blue-500/[0.07] border border-blue-500/25 transition">
                <div className="flex items-center justify-between text-blue-700 dark:text-blue-400">
                  <span className="text-xs font-semibold uppercase tracking-wider">Approved</span>
                  <FiActivity className="text-sm" />
                </div>
                <p className="text-[26px] font-bold text-blue-800 dark:text-blue-300 leading-tight mt-1.5 tabular-nums">
                  {liveOrderStatus.approved}
                </p>
                <p className="text-[11px] font-normal text-blue-600/90 dark:text-blue-400/80 mt-0.5">
                  In preparation
                </p>
              </div>

              {/* Completed */}
              <div className="p-3.5 rounded-xl bg-emerald-500/[0.07] border border-emerald-500/25 transition">
                <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
                  <span className="text-xs font-semibold uppercase tracking-wider">Completed</span>
                  <FiCheckCircle className="text-sm" />
                </div>
                <p className="text-[26px] font-bold text-emerald-800 dark:text-emerald-300 leading-tight mt-1.5 tabular-nums">
                  {liveOrderStatus.completed}
                </p>
                <p className="text-[11px] font-normal text-emerald-600/90 dark:text-emerald-400/80 mt-0.5">
                  Billed & confirmed
                </p>
              </div>

              {/* Rejected */}
              <div className="p-3.5 rounded-xl bg-rose-500/[0.07] border border-rose-500/25 transition">
                <div className="flex items-center justify-between text-rose-700 dark:text-rose-400">
                  <span className="text-xs font-semibold uppercase tracking-wider">Rejected</span>
                  <FiXCircle className="text-sm" />
                </div>
                <p className="text-[26px] font-bold text-rose-800 dark:text-rose-300 leading-tight mt-1.5 tabular-nums">
                  {liveOrderStatus.rejected}
                </p>
                <p className="text-[11px] font-normal text-rose-600/90 dark:text-rose-400/80 mt-0.5">
                  Cancelled orders
                </p>
              </div>
            </div>

            {/* Distribution Progress Bar */}
            <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800/80">
              <div className="flex justify-between items-center text-xs font-medium text-slate-500 dark:text-[#94A3B8] mb-1.5">
                <span>Today Total: {liveOrderStatus.total}</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {liveOrderStatus.completedPct}% completed
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                <div
                  style={{ width: `${liveOrderStatus.completedPct}%` }}
                  className="bg-emerald-500 h-full transition-all duration-300"
                  title={`Completed: ${liveOrderStatus.completed}`}
                />
                <div
                  style={{ width: `${liveOrderStatus.approvedPct}%` }}
                  className="bg-blue-500 h-full transition-all duration-300"
                  title={`Approved: ${liveOrderStatus.approved}`}
                />
                <div
                  style={{ width: `${liveOrderStatus.pendingPct}%` }}
                  className="bg-amber-500 h-full transition-all duration-300"
                  title={`Pending: ${liveOrderStatus.pending}`}
                />
                <div
                  style={{ width: `${liveOrderStatus.rejectedPct}%` }}
                  className="bg-rose-500 h-full transition-all duration-300"
                  title={`Rejected: ${liveOrderStatus.rejected}`}
                />
              </div>
            </div>
          </div>

          <Link
            to="/admin/orders"
            className="mt-4 w-full h-11 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-[#0F172A] dark:hover:bg-[#172033] text-white dark:text-[#CBD5E1] border border-slate-200 dark:border-slate-700/80 text-[13px] font-semibold flex items-center justify-center gap-2 transition shadow-xs"
          >
            <span>Open Live Orders Monitor</span>
            <FiArrowRight className="text-xs" />
          </Link>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 5 & 6. TOP SELLING PRODUCTS & INVENTORY ALERTS             */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        {/* Top 5 Products Today */}
        <div className="lg:col-span-6 bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/80">
              <div>
                <h2 className="text-[17px] font-semibold text-slate-900 dark:text-[#F8FAFC]">
                  Top 5 Products Today
                </h2>
                <p className="text-[13px] text-slate-500 dark:text-[#94A3B8] font-normal mt-0.5">
                  Best performing items by quantity sold
                </p>
              </div>

              <Link
                to="/admin/reports"
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
              >
                <span>View All</span>
                <FiArrowRight className="text-xs" />
              </Link>
            </div>

            {/* List Table */}
            <div className="mt-3">
              {topProductsToday.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-[#172033] text-slate-400 flex items-center justify-center mx-auto mb-2.5">
                    <FiBox className="text-lg" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    No product sales yet today
                  </p>
                  <p className="text-xs text-slate-400 dark:text-[#64748B] mt-1">
                    Products sold through POS counters will rank here in real time.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800/80 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#94A3B8]">
                        <th className="py-2.5 px-2">#</th>
                        <th className="py-2.5 px-2">Product</th>
                        <th className="py-2.5 px-2 text-right">Qty</th>
                        <th className="py-2.5 px-2 text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-normal">
                      {topProductsToday.map((p, idx) => (
                        <tr
                          key={p.id || idx}
                          className="hover:bg-slate-50/70 dark:hover:bg-[#172033]/60 transition"
                        >
                          <td className="py-3 px-2 text-slate-400 font-medium text-xs">
                            #{idx + 1}
                          </td>
                          <td className="py-3 px-2">
                            <p className="font-semibold text-slate-800 dark:text-[#F8FAFC] truncate max-w-[200px] sm:max-w-xs text-[13px]">
                              {p.name}
                            </p>
                            <span className="text-[11px] text-slate-400 dark:text-[#64748B]">
                              {p.category}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-right">
                            <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold text-xs tabular-nums">
                              {p.qty}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-right font-bold text-slate-900 dark:text-[#F8FAFC] text-[13px] tabular-nums">
                            ₹{p.revenue.toLocaleString("en-IN")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Inventory Alerts */}
        <div className="lg:col-span-6 bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/80">
              <div>
                <h2 className="text-[17px] font-semibold text-slate-900 dark:text-[#F8FAFC]">
                  Inventory Alerts
                </h2>
                <p className="text-[13px] text-slate-500 dark:text-[#94A3B8] font-normal mt-0.5">
                  Items requiring restock attention
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  🔴 {kpis.outOfStockCount} Out
                </span>
                <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  🟠 {kpis.lowStockCount} Low
                </span>
              </div>
            </div>

            {/* List */}
            <div className="mt-3">
              {inventoryAlertItems.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-2.5">
                    <FiCheckCircle className="text-lg" />
                  </div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-[#F8FAFC]">
                    All stock levels are healthy
                  </p>
                  <p className="text-xs text-slate-400 dark:text-[#64748B] mt-1">
                    No items are currently below minimum stock threshold.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {inventoryAlertItems.map((item) => (
                    <div
                      key={item._id}
                      onClick={() => navigate("/admin/stock-refill")}
                      className="cursor-pointer flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-slate-50/60 dark:bg-[#0F172A] border border-slate-200/60 dark:border-slate-800/70 hover:border-slate-300 dark:hover:border-slate-700/80 transition group"
                    >
                      <div className="flex items-center gap-3 truncate">
                        <span
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            item.alertType === "out_of_stock"
                              ? "bg-rose-500"
                              : "bg-amber-500"
                          }`}
                        />
                        <div className="truncate">
                          <p className="text-sm font-semibold text-slate-800 dark:text-[#F8FAFC] truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                            {item.name}
                          </p>
                          <p className="text-[11px] text-slate-400 dark:text-[#64748B] truncate">
                            Threshold: {item.threshold} units
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 flex-shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                            item.alertType === "out_of_stock"
                              ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                              : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {item.stock <= 0 ? "Out of Stock" : `${item.stock} left`}
                        </span>
                        <FiArrowRight className="text-xs text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Link
            to="/admin/stock-refill"
            className="mt-4 w-full h-11 px-4 rounded-xl bg-slate-50 dark:bg-[#0F172A] hover:bg-indigo-50 dark:hover:bg-[#172033] text-slate-700 dark:text-[#CBD5E1] hover:text-indigo-600 dark:hover:text-indigo-400 text-[13px] font-semibold flex items-center justify-center gap-2 transition border border-slate-200/80 dark:border-slate-700/80 shadow-xs"
          >
            <span>Manage Inventory & Refill Stock</span>
            <FiArrowRight className="text-xs" />
          </Link>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 7. COUNTER OVERVIEW & STAFF OVERVIEW TABLES               */}
      {/* ========================================================= */}
      {(() => {
        const renderStatusBadge = (status) => {
          if (status === "ONLINE") {
            return (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                ONLINE
              </span>
            );
          }
          if (status === "DISABLED") {
            return (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                DISABLED
              </span>
            );
          }
          return (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700/80">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              OFFLINE
            </span>
          );
        };

        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
            {/* Left: Counter Overview */}
            <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/80">
                  <div>
                    <h2 className="text-[17px] font-semibold text-slate-900 dark:text-[#F8FAFC] flex items-center gap-2">
                      <FiMonitor className="text-indigo-600 dark:text-indigo-400 text-base" />
                      <span>Counter Overview</span>
                    </h2>
                    <p className="text-[13px] text-slate-500 dark:text-[#94A3B8] font-normal mt-0.5">
                      Real-time status and throughput per billing counter
                    </p>
                  </div>

                  <Link
                    to="/admin/counters"
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                  >
                    <span>View All</span>
                    <FiArrowRight className="text-xs" />
                  </Link>
                </div>

                <div className="mt-3 overflow-x-auto">
                  {counterStats.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-400 dark:text-[#64748B]">
                      No counter data available
                    </div>
                  ) : (
                    <table className="w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800/80 text-[11px] font-semibold text-slate-400 dark:text-[#94A3B8] uppercase tracking-wider">
                          <th className="py-2.5 px-3">Counter</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3 text-right">Orders</th>
                          <th className="py-2.5 px-3 text-right">Sales</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-normal">
                        {counterStats.map((c) => (
                          <tr
                            key={c.id}
                            className="hover:bg-slate-50/70 dark:hover:bg-[#172033]/60 transition-colors"
                          >
                            <td className="py-3 px-3 font-semibold text-slate-800 dark:text-[#F8FAFC] text-[13px]">
                              {c.name}
                            </td>
                            <td className="py-3 px-3">
                              {renderStatusBadge(c.status)}
                            </td>
                            <td className="py-3 px-3 text-right font-medium text-slate-700 dark:text-[#CBD5E1] tabular-nums text-[13px]">
                              {c.orders}
                            </td>
                            <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-[#F8FAFC] tabular-nums text-[13px]">
                              ₹{c.revenue.toLocaleString("en-IN")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Staff Overview */}
            <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/80">
                  <div>
                    <h2 className="text-[17px] font-semibold text-slate-900 dark:text-[#F8FAFC] flex items-center gap-2">
                      <FiUsers className="text-emerald-600 dark:text-emerald-400 text-base" />
                      <span>Staff Overview</span>
                    </h2>
                    <p className="text-[13px] text-slate-500 dark:text-[#94A3B8] font-normal mt-0.5">
                      Real-time status and throughput per staff member
                    </p>
                  </div>

                  <Link
                    to="/admin/staff"
                    className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
                  >
                    <span>View All</span>
                    <FiArrowRight className="text-xs" />
                  </Link>
                </div>

                <div className="mt-3 overflow-x-auto">
                  {staffStats.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-400 dark:text-[#64748B]">
                      No staff data available
                    </div>
                  ) : (
                    <table className="w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800/80 text-[11px] font-semibold text-slate-400 dark:text-[#94A3B8] uppercase tracking-wider">
                          <th className="py-2.5 px-3">Staff</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3 text-right">Orders</th>
                          <th className="py-2.5 px-3 text-right">Sales</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-normal">
                        {staffStats.map((s) => (
                          <tr
                            key={s.id}
                            className="hover:bg-slate-50/70 dark:hover:bg-[#172033]/60 transition-colors"
                          >
                            <td className="py-3 px-3 font-semibold text-slate-800 dark:text-[#F8FAFC] text-[13px]">
                              {s.name}
                            </td>
                            <td className="py-3 px-3">
                              {renderStatusBadge(s.status)}
                            </td>
                            <td className="py-3 px-3 text-right font-medium text-slate-700 dark:text-[#CBD5E1] tabular-nums text-[13px]">
                              {s.orders}
                            </td>
                            <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-[#F8FAFC] tabular-nums text-[13px]">
                              ₹{s.revenue.toLocaleString("en-IN")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}