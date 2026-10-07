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
      <div className="bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl border border-slate-700/80 text-sm space-y-1.5">
        <p className="font-semibold text-slate-300 text-sm">{label}</p>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
          <span className="text-slate-400 text-xs">Revenue:</span>
          <span className="font-bold text-white text-sm">
            ₹{Number(data.revenue || 0).toLocaleString("en-IN")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          <span className="text-slate-400 text-xs">Orders:</span>
          <span className="font-bold text-white text-sm">{data.orders || 0}</span>
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
      <div className="space-y-8 animate-pulse p-1">
        <div className="flex justify-between items-center">
          <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-xl w-72" />
          <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-xl w-36" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-32 bg-white dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 p-4"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 h-96 bg-white dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800" />
          <div className="lg:col-span-4 h-96 bg-white dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 h-80 bg-white dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800" />
          <div className="lg:col-span-6 h-80 bg-white dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800" />
        </div>
        <div className="h-72 bg-white dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800" />
      </div>
    );
  }

  return (
    <div className="space-y-8 px-1 sm:px-0">
      {/* ========================================================= */}
      {/* HEADER: Quick Status & Sync Indicator                      */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Store Dashboard
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/80">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Store
            </span>
          </div>
          <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mt-2 font-medium">
            Real-time operations, inventory alerts, and POS performance
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            onClick={() => loadDashboardData(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-sm disabled:opacity-60"
            title="Refresh dashboard"
          >
            <FiRefreshCw
              className={`text-sm ${isRefreshing ? "animate-spin text-indigo-600" : ""}`}
            />
            <span>{isRefreshing ? "Syncing..." : "Sync"}</span>
          </button>

          <span className="text-xs font-medium text-slate-400 dark:text-slate-500 tabular-nums">
            {lastSyncTime.toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. TOP KPI CARDS (6 Key Metrics)                           */}
      {/* ========================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Total Products */}
        <div className="bg-white dark:bg-slate-850 rounded-2xl p-5 border border-slate-200/90 dark:border-slate-800 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-800 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Products
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <FiBox className="text-lg" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white mt-3">
            {kpis.totalProducts}
          </p>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1.5 truncate">
            {kpis.inStockCount} active in stock
          </p>
        </div>

        {/* Today's Orders */}
        <div className="bg-white dark:bg-slate-850 rounded-2xl p-5 border border-slate-200/90 dark:border-slate-800 shadow-sm hover:border-blue-300 dark:hover:border-blue-800 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Today Orders
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <FiShoppingBag className="text-lg" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white mt-3">
            {kpis.todayOrdersCount}
          </p>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1.5 truncate">
            {kpis.todayConfirmedCount} completed sales
          </p>
        </div>

        {/* Today's Revenue */}
        <div className="bg-white dark:bg-slate-850 rounded-2xl p-5 border border-slate-200/90 dark:border-slate-800 shadow-sm hover:border-emerald-300 dark:hover:border-emerald-800 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Today Revenue
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <FaRupeeSign className="text-base" />
            </div>
          </div>
          <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-3 truncate">
            ₹{kpis.todayRevenue.toLocaleString("en-IN")}
          </p>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1.5 truncate">
            Confirmed receipts
          </p>
        </div>

        {/* Today's Profit */}
        <div className="bg-white dark:bg-slate-850 rounded-2xl p-5 border border-slate-200/90 dark:border-slate-800 shadow-sm hover:border-emerald-300 dark:hover:border-emerald-800 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Today Profit
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <FiTrendingUp className="text-lg" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 dark:text-white mt-3 truncate">
            ₹{kpis.todayProfit.toLocaleString("en-IN")}
          </p>
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1.5 truncate">
            {kpis.profitMargin}% gross margin
          </p>
        </div>

        {/* Pending Orders */}
        <div
          onClick={() => navigate("/admin/orders")}
          className={`cursor-pointer rounded-2xl p-5 border transition ${
            kpis.pendingOrdersCount > 0
              ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/80 hover:border-amber-400"
              : "bg-white dark:bg-slate-850 border-slate-200/90 dark:border-slate-800"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Pending Orders
            </span>
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                kpis.pendingOrdersCount > 0
                  ? "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-400"
              }`}
            >
              <FiClock className="text-lg" />
            </div>
          </div>
          <p
            className={`text-3xl font-black mt-3 ${
              kpis.pendingOrdersCount > 0
                ? "text-amber-600 dark:text-amber-400"
                : "text-slate-900 dark:text-white"
            }`}
          >
            {kpis.pendingOrdersCount}
          </p>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1.5 truncate">
            {kpis.pendingOrdersCount > 0
              ? "Action required"
              : "Queue clear"}
          </p>
        </div>

        {/* Low Stock */}
        <div
          onClick={() => navigate("/admin/stock-refill")}
          className={`cursor-pointer rounded-2xl p-5 border transition ${
            kpis.totalInventoryAlerts > 0
              ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/80 hover:border-rose-400"
              : "bg-white dark:bg-slate-850 border-slate-200/90 dark:border-slate-800"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Low Stock
            </span>
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                kpis.totalInventoryAlerts > 0
                  ? "bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400"
                  : "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600"
              }`}
            >
              <FiAlertTriangle className="text-lg" />
            </div>
          </div>
          <p
            className={`text-3xl font-black mt-3 ${
              kpis.totalInventoryAlerts > 0
                ? "text-rose-600 dark:text-rose-400"
                : "text-slate-900 dark:text-white"
            }`}
          >
            {kpis.totalInventoryAlerts}
          </p>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1.5 truncate">
            {kpis.outOfStockCount > 0
              ? `${kpis.outOfStockCount} zero stock`
              : "Stock healthy"}
          </p>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3 & 4. SALES TREND & LIVE ORDER STATUS                     */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Today's Sales Trend (Hourly Line/Area Chart) */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-850 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Today's Sales Trend</span>
                  <span className="text-sm font-normal text-slate-400">
                    (Hourly Revenue)
                  </span>
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Visualizes sales pattern through current business day
                </p>
              </div>

              {peakSalesHour && (
                <div className="self-start sm:self-auto inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  <FiActivity className="text-indigo-500" />
                  <span>Peak: {peakSalesHour.time}</span>
                  <span className="font-extrabold">
                    • ₹{peakSalesHour.revenue.toLocaleString("en-IN")}
                  </span>
                </div>
              )}
            </div>

            {/* Chart Area */}
            <div className="mt-6 h-72 w-full">
              {kpis.todayRevenue === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-4">
                    <FiTrendingUp className="text-2xl" />
                  </div>
                  <p className="text-base font-bold text-slate-700 dark:text-slate-300">
                    No sales recorded today
                  </p>
                  <p className="text-sm text-slate-400 mt-2 max-w-md">
                    As orders are completed and confirmed, the hourly revenue curve will render here automatically in real time.
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={hourlySales}
                    margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
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
                      stroke="#e2e8f0"
                      className="dark:stroke-slate-800"
                    />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 12, fill: "#94a3b8", fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: "#94a3b8", fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => (v >= 1000 ? `₹${v / 1000}k` : `₹${v}`)}
                    />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#6366f1"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#salesGradient)"
                      activeDot={{ r: 6, fill: "#6366f1", stroke: "#fff", strokeWidth: 2.5 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs font-medium text-slate-400 pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
            <span>Store Hours: 8:00 AM – 10:00 PM</span>
            <span>Real-time Socket.IO Sync</span>
          </div>
        </div>

        {/* Live Order Status Section */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-850 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Live Order Status
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Today's order execution stream
                </p>
              </div>

              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
            </div>

            {/* Order Status Cards Grid */}
            <div className="grid grid-cols-2 gap-3.5 mt-5">
              {/* Pending */}
              <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-800/60">
                <div className="flex items-center justify-between text-amber-700 dark:text-amber-400">
                  <span className="text-xs font-bold">Pending</span>
                  <FiClock className="text-base" />
                </div>
                <p className="text-3xl font-black text-amber-800 dark:text-amber-300 mt-2">
                  {liveOrderStatus.pending}
                </p>
                <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400/80 mt-1">
                  Waiting approval
                </p>
              </div>

              {/* Approved */}
              <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/70 dark:border-blue-800/60">
                <div className="flex items-center justify-between text-blue-700 dark:text-blue-400">
                  <span className="text-xs font-bold">Approved</span>
                  <FiActivity className="text-base" />
                </div>
                <p className="text-3xl font-black text-blue-800 dark:text-blue-300 mt-2">
                  {liveOrderStatus.approved}
                </p>
                <p className="text-[11px] font-medium text-blue-600 dark:text-blue-400/80 mt-1">
                  In preparation
                </p>
              </div>

              {/* Completed */}
              <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-800/60">
                <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
                  <span className="text-xs font-bold">Completed</span>
                  <FiCheckCircle className="text-base" />
                </div>
                <p className="text-3xl font-black text-emerald-800 dark:text-emerald-300 mt-2">
                  {liveOrderStatus.completed}
                </p>
                <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400/80 mt-1">
                  Billed & confirmed
                </p>
              </div>

              {/* Rejected */}
              <div className="p-4 rounded-xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/70 dark:border-rose-800/60">
                <div className="flex items-center justify-between text-rose-700 dark:text-rose-400">
                  <span className="text-xs font-bold">Rejected</span>
                  <FiXCircle className="text-base" />
                </div>
                <p className="text-3xl font-black text-rose-800 dark:text-rose-300 mt-2">
                  {liveOrderStatus.rejected}
                </p>
                <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400/80 mt-1">
                  Cancelled orders
                </p>
              </div>
            </div>

            {/* Distribution Progress Bar */}
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex justify-between items-center text-xs font-semibold text-slate-500 mb-2">
                <span>Today's Total: {liveOrderStatus.total}</span>
                <span>
                  {liveOrderStatus.completed} completed ({liveOrderStatus.completedPct}%)
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                <div
                  style={{ width: `${liveOrderStatus.completedPct}%` }}
                  className="bg-emerald-500 h-full"
                  title={`Completed: ${liveOrderStatus.completed}`}
                />
                <div
                  style={{ width: `${liveOrderStatus.approvedPct}%` }}
                  className="bg-blue-500 h-full"
                  title={`Approved: ${liveOrderStatus.approved}`}
                />
                <div
                  style={{ width: `${liveOrderStatus.pendingPct}%` }}
                  className="bg-amber-500 h-full"
                  title={`Pending: ${liveOrderStatus.pending}`}
                />
                <div
                  style={{ width: `${liveOrderStatus.rejectedPct}%` }}
                  className="bg-rose-500 h-full"
                  title={`Rejected: ${liveOrderStatus.rejected}`}
                />
              </div>
            </div>
          </div>

          <Link
            to="/admin/orders"
            className="mt-5 w-full py-3 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 text-sm font-bold flex items-center justify-center gap-2 transition border border-slate-200 dark:border-slate-750"
          >
            <span>Open Live Orders Monitor</span>
            <FiArrowRight className="text-sm" />
          </Link>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 5 & 6. TOP SELLING PRODUCTS & INVENTORY ALERTS             */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Top 5 Products Today */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-850 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Top 5 Products Today
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Best performing items by quantity sold
                </p>
              </div>

              <Link
                to="/admin/reports"
                className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
              >
                <span>View All</span>
                <FiArrowRight />
              </Link>
            </div>

            {/* List */}
            <div className="mt-4">
              {topProductsToday.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
                    <FiBox className="text-xl" />
                  </div>
                  <p className="text-base font-bold text-slate-700 dark:text-slate-300">
                    No product sales yet today
                  </p>
                  <p className="text-sm text-slate-400 mt-2">
                    Products sold through POS counters will rank here in real time.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-xs">
                        <th className="py-3 px-2">#</th>
                        <th className="py-3 px-2">Product</th>
                        <th className="py-3 px-2 text-center">Qty Sold</th>
                        <th className="py-3 px-2 text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {topProductsToday.map((p, idx) => (
                        <tr
                          key={p.id || idx}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                        >
                          <td className="py-3.5 px-2 text-slate-400 font-bold text-sm">
                            #{idx + 1}
                          </td>
                          <td className="py-3.5 px-2">
                            <p className="font-bold text-slate-800 dark:text-slate-100 truncate max-w-[200px] sm:max-w-xs text-sm">
                              {p.name}
                            </p>
                            <span className="text-xs text-slate-400">
                              {p.category}
                            </span>
                          </td>
                          <td className="py-3.5 px-2 text-center">
                            <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold text-sm">
                              {p.qty}
                            </span>
                          </td>
                          <td className="py-3.5 px-2 text-right font-bold text-slate-900 dark:text-white text-sm">
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
        <div className="lg:col-span-6 bg-white dark:bg-slate-850 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Inventory Alerts
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Items requiring restock attention
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-900">
                  🔴 {kpis.outOfStockCount} Out
                </span>
                <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/80 dark:border-amber-900">
                  🟠 {kpis.lowStockCount} Low
                </span>
              </div>
            </div>

            {/* List */}
            <div className="mt-4">
              {inventoryAlertItems.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                    <FiCheckCircle className="text-xl" />
                  </div>
                  <p className="text-base font-bold text-slate-800 dark:text-slate-200">
                    All products are sufficiently stocked
                  </p>
                  <p className="text-sm text-slate-400 mt-2">
                    No items are currently below minimum stock threshold.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {inventoryAlertItems.map((item) => (
                    <div
                      key={item._id}
                      onClick={() => navigate("/admin/stock-refill")}
                      className="cursor-pointer flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition group"
                    >
                      <div className="flex items-center gap-3 truncate">
                        <span
                          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                            item.alertType === "out_of_stock"
                              ? "bg-rose-500"
                              : "bg-amber-500"
                          }`}
                        />
                        <div className="truncate">
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                            {item.name}
                          </p>
                          <p className="text-[11px] font-medium text-slate-400 truncate">
                            Threshold: {item.threshold} units
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 flex-shrink-0">
                        <span
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                            item.alertType === "out_of_stock"
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                          }`}
                        >
                          {item.stock <= 0
                            ? "Out of Stock"
                            : `${item.stock} left`}
                        </span>
                        <FiArrowRight className="text-sm text-slate-400 group-hover:text-slate-600 transition" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Link
            to="/admin/stock-refill"
            className="mt-5 w-full py-3 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 text-sm font-bold flex items-center justify-center gap-2 transition border border-slate-200 dark:border-slate-750"
          >
            <span>Manage Inventory & Refill Stock</span>
            <FiArrowRight className="text-sm" />
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
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                ONLINE
              </span>
            );
          }
          if (status === "DISABLED") {
            return (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                DISABLED
              </span>
            );
          }
          return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500" />
              OFFLINE
            </span>
          );
        };

        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Counter Overview */}
            <div className="bg-white dark:bg-slate-850 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <FiMonitor className="text-indigo-600 dark:text-indigo-400" />
                      <span>Counter Overview</span>
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Real-time status and throughput per billing counter
                    </p>
                  </div>

                  <Link
                    to="/admin/counters"
                    className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                  >
                    <span>View All Counters</span>
                    <FiArrowRight />
                  </Link>
                </div>

                <div className="mt-4 overflow-x-auto">
                  {counterStats.length === 0 ? (
                    <div className="text-center py-8 text-sm text-slate-400 dark:text-slate-500">
                      No counter data available
                    </div>
                  ) : (
                    <table className="w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          <th className="py-2.5 px-3">Counter</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3 text-right">Orders</th>
                          <th className="py-2.5 px-3 text-right">Sales</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                        {counterStats.map((c) => (
                          <tr
                            key={c.id}
                            className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-100">
                              {c.name}
                            </td>
                            <td className="py-3 px-3">
                              {renderStatusBadge(c.status)}
                            </td>
                            <td className="py-3 px-3 text-right font-medium text-slate-700 dark:text-slate-300 tabular-nums">
                              {c.orders}
                            </td>
                            <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white tabular-nums">
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
            <div className="bg-white dark:bg-slate-850 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <FiUsers className="text-emerald-600 dark:text-emerald-400" />
                      <span>Staff Overview</span>
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Real-time status and throughput per staff member
                    </p>
                  </div>

                  <Link
                    to="/admin/staff"
                    className="text-sm font-bold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
                  >
                    <span>View All Staff</span>
                    <FiArrowRight />
                  </Link>
                </div>

                <div className="mt-4 overflow-x-auto">
                  {staffStats.length === 0 ? (
                    <div className="text-center py-8 text-sm text-slate-400 dark:text-slate-500">
                      No staff data available
                    </div>
                  ) : (
                    <table className="w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          <th className="py-2.5 px-3">Staff</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3 text-right">Orders</th>
                          <th className="py-2.5 px-3 text-right">Sales</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                        {staffStats.map((s) => (
                          <tr
                            key={s.id}
                            className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-100">
                              {s.name}
                            </td>
                            <td className="py-3 px-3">
                              {renderStatusBadge(s.status)}
                            </td>
                            <td className="py-3 px-3 text-right font-medium text-slate-700 dark:text-slate-300 tabular-nums">
                              {s.orders}
                            </td>
                            <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white tabular-nums">
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