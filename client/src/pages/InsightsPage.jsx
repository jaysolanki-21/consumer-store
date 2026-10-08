import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import socket from "../services/socket";
import AIInsights from "../components/AIInsights";
import {
  FiCalendar,
  FiTrendingUp,
  FiTrendingDown,
  FiBox,
  FiShoppingBag,
  FiBarChart2,
  FiRefreshCw,
  FiDollarSign,
  FiClock,
  FiCreditCard,
  FiUsers,
  FiAward,
  FiAlertTriangle,
  FiCheckCircle,
  FiPieChart,
  FiArrowUpRight,
  FiArrowDownRight,
  FiLayers,
  FiMonitor,
  FiActivity,
  FiArrowRight,
  FiChevronDown,
  FiHelpCircle,
  FiZap,
  FiPackage,
  FiMinus,
} from "react-icons/fi";
import { FaRupeeSign } from "react-icons/fa";
import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

// ==========================================
// DATE & PERIOD CALCULATION UTILITIES
// ==========================================

export const getPeriodDateRange = (period, customStart, customEnd) => {
  const now = new Date();
  let start = new Date();
  let end = new Date();

  end.setHours(23, 59, 59, 999);

  switch (period) {
    case "today": {
      start.setHours(0, 0, 0, 0);
      break;
    }
    case "yesterday": {
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case "last7days": {
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case "last30days": {
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case "thisMonth": {
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      break;
    }
    case "lastMonth": {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      break;
    }
    case "thisYear": {
      start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      break;
    }
    case "custom": {
      if (customStart) {
        start = new Date(customStart);
        start.setHours(0, 0, 0, 0);
      }
      if (customEnd) {
        end = new Date(customEnd);
        end.setHours(23, 59, 59, 999);
      }
      break;
    }
    default: {
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
    }
  }

  return { start, end };
};

export const getComparisonDateRange = (
  currentStart,
  currentEnd,
  comparisonType,
) => {
  const durationMs = currentEnd.getTime() - currentStart.getTime();
  let compStart = new Date();
  let compEnd = new Date();

  switch (comparisonType) {
    case "previous_period": {
      compEnd = new Date(currentStart.getTime() - 1);
      compStart = new Date(compEnd.getTime() - durationMs);
      break;
    }
    case "previous_month": {
      compStart = new Date(currentStart);
      compStart.setMonth(compStart.getMonth() - 1);
      compEnd = new Date(currentEnd);
      compEnd.setMonth(compEnd.getMonth() - 1);
      break;
    }
    case "previous_year": {
      compStart = new Date(currentStart);
      compStart.setFullYear(compStart.getFullYear() - 1);
      compEnd = new Date(currentEnd);
      compEnd.setFullYear(compEnd.getFullYear() - 1);
      break;
    }
    default: {
      compEnd = new Date(currentStart.getTime() - 1);
      compStart = new Date(compEnd.getTime() - durationMs);
    }
  }

  return { start: compStart, end: compEnd };
};

// Robust delta computation that NEVER shows misleading 100% when previous period is zero
const computeDelta = (currentVal, previousVal) => {
  if (previousVal == null || previousVal === 0) {
    return {
      hasPrev: false,
      percent: 0,
      direction: "neutral",
      rawDiff: (currentVal || 0) - 0,
      label: "No previous-period data",
    };
  }

  const diff = ((currentVal - previousVal) / previousVal) * 100;
  const percent = Math.abs(Math.round(diff * 10) / 10);
  const direction = diff > 0.05 ? "up" : diff < -0.05 ? "down" : "neutral";

  return {
    hasPrev: true,
    percent,
    direction,
    rawDiff: currentVal - previousVal,
    label: `${direction === "up" ? "↑" : direction === "down" ? "↓" : "•"} ${percent}% vs previous period`,
  };
};

// Profit calculator reusing standard project formulas: (sellingPrice - costPrice) * qty
const calculateOrderProfit = (order) => {
  if (order.profitAmount != null) return Number(order.profitAmount) || 0;
  if (order.profit != null) return Number(order.profit) || 0;

  const items = order.items || order.products || [];
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
          product.costPrice ??
          product.purchasePrice ??
          product.buyingPrice ??
          0,
      ) || 0;

    return sum + (sellPrice - costPrice) * qty;
  }, 0);
};

const getCounterName = (order, countersList = []) => {
  if (
    order?.counter &&
    typeof order.counter === "object" &&
    order.counter.name
  ) {
    return order.counter.name;
  }
  if (order?.counterName) return order.counterName;
  if (order?.counter && typeof order.counter === "string") {
    const matched = countersList.find(
      (c) => String(c._id) === String(order.counter),
    );
    if (matched) return matched.name;
  }
  return "Counter 1";
};

const getStaffName = (order) => {
  if (order?.staff && typeof order.staff === "object" && order.staff.name) {
    return order.staff.name;
  }
  if (order?.staffName) return order.staffName;
  if (
    order?.confirmedBy &&
    typeof order.confirmedBy === "object" &&
    order.confirmedBy.name
  ) {
    return order.confirmedBy.name;
  }
  if (order?.staffId && typeof order.staffId === "object" && order.staffId.name) {
    return order.staffId.name;
  }
  return "Staff Member";
};

// Clean Finance Tooltip with: Date, Revenue, COGS, Profit, Profit Margin, Orders
const FinanceTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const dataPoint = payload[0]?.payload || {};
    const rev =
      payload.find((p) => p.dataKey === "revenue")?.value ??
      dataPoint.revenue ??
      0;
    const cost =
      payload.find((p) => p.dataKey === "cost")?.value ??
      dataPoint.cost ??
      0;
    const profit =
      payload.find((p) => p.dataKey === "profit")?.value ??
      dataPoint.profit ??
      0;
    const orders = dataPoint.orders ?? 0;
    const margin = rev > 0 ? Math.round((profit / rev) * 100) : 0;

    return (
      <div className="bg-[#0B1220] text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700/80 text-xs space-y-2 min-w-[220px]">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <p className="font-semibold text-[#F8FAFC] text-sm">{label}</p>
          <span className="text-[11px] font-semibold text-[#94A3B8] bg-[#0F172A] border border-slate-800 px-2 py-0.5 rounded-full">
            {orders} {orders === 1 ? "order" : "orders"}
          </span>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-indigo-400">
            <span className="text-[#94A3B8] font-normal">Revenue:</span>
            <span className="font-bold tabular-nums">
              ₹{Number(rev).toLocaleString("en-IN")}
            </span>
          </div>
          <div className="flex justify-between items-center text-amber-400">
            <span className="text-[#94A3B8] font-normal">COGS (Cost):</span>
            <span className="font-bold tabular-nums">
              ₹{Number(cost).toLocaleString("en-IN")}
            </span>
          </div>
          <div className="flex justify-between items-center text-emerald-400">
            <span className="text-[#94A3B8] font-normal">Profit:</span>
            <span className="font-bold tabular-nums">
              ₹{Number(profit).toLocaleString("en-IN")}
            </span>
          </div>
        </div>
        <div className="flex justify-between items-center text-[#CBD5E1] pt-2 border-t border-slate-800 font-medium">
          <span>Profit Margin:</span>
          <span className="text-[#F8FAFC] tabular-nums font-bold">{margin}%</span>
        </div>
      </div>
    );
  }
  return null;
};

const PIE_COLORS = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#f43f5e",
  "#64748b",
];

export default function InsightsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState("last30days");
  const [comparisonType, setComparisonType] = useState("previous_period");

  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return d.toISOString().split("T")[0];
  });
  const [customEndDate, setCustomEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  const [chartGranularity, setChartGranularity] = useState("daily");
  const [productTab, setProductTab] = useState("top_selling");
  const [showAIInsights, setShowAIInsights] = useState(false);

  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [counters, setCounters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState(new Date());

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setIsRefreshing(true);

    try {
      const [ordersRes, productsRes, categoriesRes, countersRes] =
        await Promise.all([
          api.get("/orders"),
          api.get("/products"),
          api.get("/categories").catch(() => ({ data: [] })),
          api.get("/counters").catch(() => ({ data: [] })),
        ]);

      setOrders(Array.isArray(ordersRes.data) ? ordersRes.data : []);
      setProducts(Array.isArray(productsRes.data) ? productsRes.data : []);
      setCategories(
        Array.isArray(categoriesRes.data) ? categoriesRes.data : [],
      );
      setCounters(Array.isArray(countersRes.data) ? countersRes.data : []);
      setLastSync(new Date());
    } catch (err) {
      console.error("Failed to load insights data", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Real-time socket sync without full page reload or flashing spinners
  useEffect(() => {
    loadData();

    const handleOrderUpdate = (order) => {
      if (!order?._id) return;
      setOrders((prev) => {
        const idx = prev.findIndex((o) => o._id === order._id);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = order;
          return next;
        }
        return [order, ...prev];
      });
      setLastSync(new Date());
    };

    const handleOrderDelete = (id) => {
      if (!id) return;
      setOrders((prev) => prev.filter((o) => o._id !== id));
      setLastSync(new Date());
    };

    const handleBulkDelete = () => loadData(true);

    const handleStockUpdate = (prod) => {
      if (prod?._id) {
        setProducts((prev) =>
          prev.map((p) => (p._id === prod._id ? { ...p, ...prod } : p)),
        );
      } else {
        api
          .get("/products")
          .then((r) => setProducts(r.data))
          .catch(() => {});
      }
      setLastSync(new Date());
    };

    const handleProductCreate = (p) => {
      if (p?._id) setProducts((prev) => [p, ...prev]);
    };

    const handleProductDelete = ({ _id }) => {
      if (_id) setProducts((prev) => prev.filter((p) => p._id !== _id));
    };

    const handleCountersRefresh = () => {
      api
        .get("/counters")
        .then((r) => setCounters(r.data))
        .catch(() => {});
    };

    socket.on("newOrder", handleOrderUpdate);
    socket.on("orderCreated", handleOrderUpdate);
    socket.on("orderConfirmed", handleOrderUpdate);
    socket.on("orderCancelled", handleOrderUpdate);
    socket.on("orderReverted", handleOrderUpdate);
    socket.on("orderUpdated", handleOrderUpdate);
    socket.on("orderDeleted", handleOrderDelete);
    socket.on("ordersBulkDeleted", handleBulkDelete);

    socket.on("stockUpdated", handleStockUpdate);
    socket.on("productUpdated", handleStockUpdate);
    socket.on("stockRefilled", handleStockUpdate);
    socket.on("productCreated", handleProductCreate);
    socket.on("productDeleted", handleProductDelete);
    socket.on("countersUpdated", handleCountersRefresh);

    return () => {
      socket.off("newOrder", handleOrderUpdate);
      socket.off("orderCreated", handleOrderUpdate);
      socket.off("orderConfirmed", handleOrderUpdate);
      socket.off("orderCancelled", handleOrderUpdate);
      socket.off("orderReverted", handleOrderUpdate);
      socket.off("orderUpdated", handleOrderUpdate);
      socket.off("orderDeleted", handleOrderDelete);
      socket.off("ordersBulkDeleted", handleBulkDelete);

      socket.off("stockUpdated", handleStockUpdate);
      socket.off("productUpdated", handleStockUpdate);
      socket.off("stockRefilled", handleStockUpdate);
      socket.off("productCreated", handleProductCreate);
      socket.off("productDeleted", handleProductDelete);
      socket.off("countersUpdated", handleCountersRefresh);
    };
  }, [loadData]);

  // Lookup Maps for bulletproof Category & Product resolution
  const categoriesById = useMemo(() => {
    const map = new Map();
    categories.forEach((c) => {
      if (c?._id && c?.name) map.set(String(c._id), c.name);
    });
    return map;
  }, [categories]);

  const productsById = useMemo(() => {
    const map = new Map();
    products.forEach((p) => {
      if (p?._id) map.set(String(p._id), p);
    });
    return map;
  }, [products]);

  // Helper to reliably resolve a product's category name
  const resolveItemCategory = useCallback(
    (item) => {
      const prodId = String(item.productId?._id || item.productId || "");
      const matchedProd =
        productsById.get(prodId) ||
        products.find(
          (p) =>
            p.name &&
            item.name &&
            p.name.trim().toLowerCase() === item.name.trim().toLowerCase(),
        );

      let catName =
        matchedProd?.categoryId?.name ||
        categoriesById.get(
          String(matchedProd?.categoryId?._id || matchedProd?.categoryId),
        ) ||
        item.productId?.categoryId?.name ||
        categoriesById.get(
          String(item.productId?.categoryId?._id || item.productId?.categoryId),
        ) ||
        item.categoryId?.name ||
        categoriesById.get(
          String(item.categoryId?._id || item.categoryId),
        ) ||
        (typeof item.category === "string" &&
        item.category.trim() !== "" &&
        item.category !== "Uncategorized"
          ? item.category
          : null) ||
        (typeof matchedProd?.category === "string" &&
        matchedProd.category.trim() !== "" &&
        matchedProd.category !== "Uncategorized"
          ? matchedProd.category
          : null);

      return catName || "Uncategorized";
    },
    [productsById, categoriesById, products],
  );

  // ==========================================
  // DATE RANGE EVALUATION
  // ==========================================

  const { currentRange, compareRange } = useMemo(() => {
    const cur = getPeriodDateRange(
      selectedPeriod,
      customStartDate,
      customEndDate,
    );
    const comp = getComparisonDateRange(
      cur.start,
      cur.end,
      comparisonType,
    );
    return { currentRange: cur, compareRange: comp };
  }, [selectedPeriod, customStartDate, customEndDate, comparisonType]);

  const { currentPeriodOrders, comparePeriodOrders } = useMemo(() => {
    const confirmed = orders.filter((o) => o.status === "Confirmed");

    const cur = confirmed.filter((o) => {
      const d = new Date(o.createdAt);
      return d >= currentRange.start && d <= currentRange.end;
    });

    const comp = confirmed.filter((o) => {
      const d = new Date(o.createdAt);
      return d >= compareRange.start && d <= compareRange.end;
    });

    return { currentPeriodOrders: cur, comparePeriodOrders: comp };
  }, [orders, currentRange, compareRange]);

  // ==========================================
  // 1. KPIs
  // ==========================================

  const kpis = useMemo(() => {
    const curRevenue = currentPeriodOrders.reduce(
      (sum, o) => sum + (Number(o.totalAmount) || 0),
      0,
    );
    const curProfit = currentPeriodOrders.reduce(
      (sum, o) => sum + calculateOrderProfit(o),
      0,
    );
    const curCost = curRevenue - curProfit;
    const curMargin =
      curRevenue > 0 ? Math.round((curProfit / curRevenue) * 1000) / 10 : 0;
    const curOrdersCount = currentPeriodOrders.length;
    const curAOV = curOrdersCount > 0 ? Math.round(curRevenue / curOrdersCount) : 0;
    const curItemsSold = currentPeriodOrders.reduce(
      (sum, o) =>
        sum +
        (o.items || []).reduce(
          (s, it) => s + (Number(it.quantity) || 1),
          0,
        ),
      0,
    );

    const compRevenue = comparePeriodOrders.reduce(
      (sum, o) => sum + (Number(o.totalAmount) || 0),
      0,
    );
    const compProfit = comparePeriodOrders.reduce(
      (sum, o) => sum + calculateOrderProfit(o),
      0,
    );
    const compCost = compRevenue - compProfit;
    const compMargin =
      compRevenue > 0 ? Math.round((compProfit / compRevenue) * 1000) / 10 : 0;
    const compOrdersCount = comparePeriodOrders.length;
    const compAOV =
      compOrdersCount > 0 ? Math.round(compRevenue / compOrdersCount) : 0;
    const compItemsSold = comparePeriodOrders.reduce(
      (sum, o) =>
        sum +
        (o.items || []).reduce(
          (s, it) => s + (Number(it.quantity) || 1),
          0,
        ),
      0,
    );

    const marginDiff = Math.round((curMargin - compMargin) * 10) / 10;
    const hasCompData = comparePeriodOrders.length > 0;

    return {
      revenue: curRevenue,
      profit: curProfit,
      cost: curCost,
      margin: curMargin,
      orders: curOrdersCount,
      aov: curAOV,
      itemsSold: curItemsSold,
      hasCompData,

      revenueDelta: computeDelta(curRevenue, compRevenue),
      profitDelta: computeDelta(curProfit, compProfit),
      marginDelta: {
        hasPrev: hasCompData && compRevenue > 0,
        rawDiff: marginDiff,
        percent: Math.abs(marginDiff),
        direction: marginDiff > 0.05 ? "up" : marginDiff < -0.05 ? "down" : "neutral",
        label:
          hasCompData && compRevenue > 0
            ? `${marginDiff >= 0 ? "+" : ""}${marginDiff}% pts vs previous`
            : "No previous-period data",
      },
      ordersDelta: computeDelta(curOrdersCount, compOrdersCount),
      aovDelta: computeDelta(curAOV, compAOV),
      itemsSoldDelta: computeDelta(curItemsSold, compItemsSold),
    };
  }, [currentPeriodOrders, comparePeriodOrders]);

  // Comparison period label for display
  const comparisonLabel = useMemo(() => {
    switch (comparisonType) {
      case "previous_period":
        return "previous period";
      case "previous_month":
        return "previous month";
      case "previous_year":
        return "previous year";
      default:
        return "previous period";
    }
  }, [comparisonType]);

  // ==========================================
  // 2. FINANCE TREND (Revenue, Cost, Profit)
  // ==========================================

  const financeTrendData = useMemo(() => {
    if (currentPeriodOrders.length === 0) return [];

    const map = new Map();

    currentPeriodOrders.forEach((order) => {
      const d = new Date(order.createdAt);
      let key = "";
      let sortKey = 0;

      if (chartGranularity === "monthly") {
        key = d.toLocaleDateString("en-IN", {
          month: "short",
          year: "2-digit",
        });
        sortKey = d.getFullYear() * 100 + d.getMonth();
      } else if (chartGranularity === "weekly") {
        const dayOfWeek = d.getDay();
        const startOfWeek = new Date(d);
        startOfWeek.setDate(d.getDate() - dayOfWeek);
        key = `Wk of ${startOfWeek.getDate()} ${startOfWeek.toLocaleDateString(
          "en-IN",
          { month: "short" },
        )}`;
        sortKey = startOfWeek.getTime();
      } else {
        key = `${d.getDate()} ${d.toLocaleDateString("en-IN", {
          month: "short",
        })}`;
        sortKey = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      }

      const rev = Number(order.totalAmount) || 0;
      const profit = calculateOrderProfit(order);
      const cost = rev - profit;

      if (map.has(key)) {
        const item = map.get(key);
        item.revenue += rev;
        item.profit += profit;
        item.cost += cost;
        item.orders += 1;
      } else {
        map.set(key, {
          label: key,
          sortKey,
          revenue: rev,
          profit,
          cost,
          orders: 1,
        });
      }
    });

    return Array.from(map.values())
      .sort((a, b) => a.sortKey - b.sortKey)
      .map((item) => ({
        ...item,
        margin:
          item.revenue > 0
            ? Math.round((item.profit / item.revenue) * 100)
            : 0,
      }));
  }, [currentPeriodOrders, chartGranularity]);

  // ==========================================
  // 3. SALES TREND & RUN-RATE ANALYSIS
  // ==========================================

  const salesTrendAnalysis = useMemo(() => {
    if (financeTrendData.length === 0) return null;

    let peakDay = financeTrendData[0];
    let lowDay = financeTrendData[0];
    let totalRevenue = 0;
    let totalOrders = 0;

    financeTrendData.forEach((d) => {
      totalRevenue += d.revenue;
      totalOrders += d.orders;
      if (d.revenue > peakDay.revenue) peakDay = d;
      if (d.revenue < lowDay.revenue) lowDay = d;
    });

    const bucketsCount = financeTrendData.length || 1;
    const avgDailyRevenue = Math.round(totalRevenue / bucketsCount);
    const avgDailyOrders = Math.round((totalOrders / bucketsCount) * 10) / 10;

    return {
      peakDay,
      lowDay,
      avgDailyRevenue,
      avgDailyOrders,
      bucketsCount,
    };
  }, [financeTrendData]);

  // ==========================================
  // 4. HOURLY ANALYSIS
  // ==========================================

  const hourlyAnalysis = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, h) => {
      const period = h >= 12 ? "PM" : "AM";
      const displayHour = h % 12 === 0 ? 12 : h % 12;
      const nextH = (h + 1) % 12 === 0 ? 12 : (h + 1) % 12;
      const nextPeriod =
        h + 1 >= 12 && h + 1 < 24 ? "PM" : h + 1 === 24 ? "AM" : period;
      return {
        hour24: h,
        label: `${displayHour} ${period}`,
        rangeLabel: `${displayHour} ${period} – ${nextH} ${nextPeriod}`,
        orders: 0,
        revenue: 0,
      };
    });

    currentPeriodOrders.forEach((o) => {
      const h = new Date(o.createdAt).getHours();
      if (hours[h]) {
        hours[h].orders += 1;
        hours[h].revenue += Number(o.totalAmount || 0);
      }
    });

    const activeHours = hours.filter((h) => h.revenue > 0 || (h.hour24 >= 8 && h.hour24 <= 22));
    const sortedHours = [...hours].sort((a, b) => b.revenue - a.revenue);
    const peak = sortedHours[0]?.revenue > 0 ? sortedHours[0] : null;
    const top3 = sortedHours.filter((h) => h.revenue > 0).slice(0, 3);

    return {
      chartData: activeHours.length > 0 ? activeHours : hours.slice(8, 23),
      peakHour: peak,
      top3,
    };
  }, [currentPeriodOrders]);

  // ==========================================
  // 5. PRODUCT ANALYTICS
  // ==========================================

  const productAnalytics = useMemo(() => {
    const productMap = new Map();

    products.forEach((p) => {
      if (p.visibility === false) return;
      const id = String(p._id);
      const categoryName =
        p.categoryId?.name ||
        categoriesById.get(String(p.categoryId?._id || p.categoryId)) ||
        p.category ||
        "General";

      productMap.set(id, {
        id,
        name: p.name,
        category: categoryName,
        stock: Number(p.stock || 0),
        costPrice: Number(p.costPrice || 0),
        sellingPrice: Number(p.sellingPrice || p.price || 0),
        qtySold: 0,
        revenue: 0,
        profit: 0,
        prevQtySold: 0,
      });
    });

    // Aggregate Current Period
    currentPeriodOrders.forEach((order) => {
      const items = order.items || [];
      items.forEach((item) => {
        const id = String(item.productId?._id || item.productId || item.name);
        const qty = Number(item.quantity || item.qty || 1);
        const price = Number(item.price || item.sellingPrice || 0);
        const cost = Number(item.costPrice || 0);
        const rev = qty * price;
        const prof = (price - cost) * qty;

        if (productMap.has(id)) {
          const p = productMap.get(id);
          p.qtySold += qty;
          p.revenue += rev;
          p.profit += prof;
        } else {
          const categoryName = resolveItemCategory(item);
          productMap.set(id, {
            id,
            name: item.productId?.name || item.name || "Unknown Product",
            category: categoryName,
            stock: 0,
            costPrice: cost,
            sellingPrice: price,
            qtySold: qty,
            revenue: rev,
            profit: prof,
            prevQtySold: 0,
          });
        }
      });
    });

    // Aggregate Previous Period for decline detection
    comparePeriodOrders.forEach((order) => {
      const items = order.items || [];
      items.forEach((item) => {
        const id = String(item.productId?._id || item.productId || item.name);
        const qty = Number(item.quantity || item.qty || 1);
        if (productMap.has(id)) {
          productMap.get(id).prevQtySold += qty;
        }
      });
    });

    const all = Array.from(productMap.values());

    const topSelling = [...all]
      .sort((a, b) => b.qtySold - a.qtySold)
      .filter((p) => p.qtySold > 0)
      .slice(0, 5);

    const topRevenue = [...all]
      .sort((a, b) => b.revenue - a.revenue)
      .filter((p) => p.revenue > 0)
      .slice(0, 5);

    const topProfit = [...all]
      .sort((a, b) => b.profit - a.profit)
      .filter((p) => p.profit > 0)
      .slice(0, 5);

    // Slow moving: in stock products with low sales
    const slowMoving = [...all]
      .filter((p) => p.stock > 0)
      .sort((a, b) => a.qtySold - b.qtySold || b.stock - a.stock)
      .slice(0, 5);

    // Products showing declining sales vs previous period
    const decliningProducts = all.filter(
      (p) => p.prevQtySold > 0 && p.qtySold < p.prevQtySold,
    );

    return { topSelling, topRevenue, topProfit, slowMoving, decliningProducts };
  }, [products, currentPeriodOrders, comparePeriodOrders, categoriesById, resolveItemCategory]);

  // ==========================================
  // 6. CATEGORY ANALYTICS (Fixed Real Relationships)
  // ==========================================

  const categoryAnalytics = useMemo(() => {
    const catMap = new Map();
    let totalCatRevenue = 0;

    currentPeriodOrders.forEach((order) => {
      const items = order.items || [];
      items.forEach((item) => {
        const catName = resolveItemCategory(item);

        const qty = Number(item.quantity || item.qty || 1);
        const price = Number(item.price || item.sellingPrice || 0);
        const cost = Number(item.costPrice || 0);
        const rev = qty * price;
        const prof = (price - cost) * qty;

        totalCatRevenue += rev;

        if (catMap.has(catName)) {
          const c = catMap.get(catName);
          c.revenue += rev;
          c.profit += prof;
          c.qtySold += qty;
        } else {
          catMap.set(catName, {
            name: catName,
            revenue: rev,
            profit: prof,
            qtySold: qty,
          });
        }
      });
    });

    const rawList = Array.from(catMap.values())
      .filter((c) => c.revenue > 0 || c.qtySold > 0)
      .sort((a, b) => b.revenue - a.revenue);

    // Calculate contribution percentage
    const list = rawList.map((c) => ({
      ...c,
      percentage:
        totalCatRevenue > 0
          ? Math.round((c.revenue / totalCatRevenue) * 100)
          : 0,
      margin:
        c.revenue > 0 ? Math.round((c.profit / c.revenue) * 100) : 0,
    }));

    // Filter out pure fallback "Uncategorized" if that was the only fabricated entry
    const validNamedCategories = list.filter((c) => c.name !== "Uncategorized");
    const topCategory =
      validNamedCategories.length > 0 ? validNamedCategories[0] : list[0] || null;

    return {
      list,
      topCategory,
      totalRevenue: totalCatRevenue,
      hasData: list.length > 0 && totalCatRevenue > 0,
    };
  }, [currentPeriodOrders, resolveItemCategory]);

  // ==========================================
  // 7. COUNTER ANALYTICS
  // ==========================================

  const counterAnalytics = useMemo(() => {
    const map = new Map();

    counters.forEach((c) => {
      const name = c.name || `Counter ${c.counterNumber || 1}`;
      map.set(name, {
        id: c._id,
        name,
        orders: 0,
        revenue: 0,
        profit: 0,
      });
    });

    currentPeriodOrders.forEach((order) => {
      const name = getCounterName(order, counters);
      const rev = Number(order.totalAmount || 0);
      const prof = calculateOrderProfit(order);

      if (map.has(name)) {
        const item = map.get(name);
        item.orders += 1;
        item.revenue += rev;
        item.profit += prof;
      } else {
        map.set(name, {
          id: name,
          name,
          orders: 1,
          revenue: rev,
          profit: prof,
        });
      }
    });

    const list = Array.from(map.values())
      .map((c) => ({
        ...c,
        aov: c.orders > 0 ? Math.round(c.revenue / c.orders) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const topCounter = list.find((c) => c.revenue > 0) || list[0] || null;

    return { list, topCounter };
  }, [counters, currentPeriodOrders]);

  // ==========================================
  // 8. STAFF ANALYTICS
  // ==========================================

  const staffAnalytics = useMemo(() => {
    const map = new Map();

    currentPeriodOrders.forEach((order) => {
      const name = getStaffName(order);
      const rev = Number(order.totalAmount || 0);
      const prof = calculateOrderProfit(order);

      if (map.has(name)) {
        const item = map.get(name);
        item.orders += 1;
        item.revenue += rev;
        item.profit += prof;
      } else {
        map.set(name, {
          name,
          orders: 1,
          revenue: rev,
          profit: prof,
        });
      }
    });

    const list = Array.from(map.values())
      .map((s) => ({
        ...s,
        aov: s.orders > 0 ? Math.round(s.revenue / s.orders) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const topStaff = list.find((s) => s.revenue > 0) || list[0] || null;

    return { list, topStaff };
  }, [currentPeriodOrders]);

  // ==========================================
  // 9. PAYMENT METHOD ANALYTICS
  // ==========================================

  const paymentAnalytics = useMemo(() => {
    let cashRev = 0;
    let cashCount = 0;
    let onlineRev = 0;
    let onlineCount = 0;

    currentPeriodOrders.forEach((order) => {
      const rawMethod = (
        order.payment?.method ||
        order.paymentMethod ||
        "Cash"
      ).toLowerCase();

      const method =
        rawMethod.includes("upi") ||
        rawMethod.includes("online") ||
        rawMethod.includes("card")
          ? "online"
          : "cash";

      const amount = Number(order.totalAmount || 0);

      if (method === "online") {
        onlineRev += amount;
        onlineCount += 1;
      } else {
        cashRev += amount;
        cashCount += 1;
      }
    });

    const totalRev = cashRev + onlineRev;
    const cashPct = totalRev > 0 ? Math.round((cashRev / totalRev) * 100) : 0;
    const onlinePct = totalRev > 0 ? 100 - cashPct : 0;

    return {
      cashRevenue: cashRev,
      cashCount,
      cashPct,
      onlineRevenue: onlineRev,
      onlineCount,
      onlinePct,
      chartData: [
        {
          name: "Cash",
          value: cashRev,
          percentage: cashPct,
          color: "#10b981",
        },
        {
          name: "Online / UPI",
          value: onlineRev,
          percentage: onlinePct,
          color: "#6366f1",
        },
      ],
    };
  }, [currentPeriodOrders]);

  // ==========================================
  // 10. INVENTORY VALUATION & INTELLIGENCE
  // ==========================================

  const inventoryAnalytics = useMemo(() => {
    let totalStockUnits = 0;
    let totalCostValuation = 0;
    let totalRetailValuation = 0;
    const lowStockList = [];
    const outOfStockList = [];
    let healthyCount = 0;

    products.forEach((p) => {
      if (p.visibility === false) return;
      const stock = Number(p.stock || 0);
      const cost = Number(p.costPrice || 0);
      const retail = Number(p.sellingPrice || p.price || 0);
      const threshold = Number(p.lowStockThreshold ?? p.minStock ?? 5);

      if (stock > 0) {
        totalStockUnits += stock;
        totalCostValuation += stock * cost;
        totalRetailValuation += stock * retail;
      }

      if (stock <= 0) {
        outOfStockList.push(p);
      } else if (stock <= threshold) {
        lowStockList.push(p);
      } else {
        healthyCount += 1;
      }
    });

    const unrealizedProfit = totalRetailValuation - totalCostValuation;

    return {
      totalStockUnits,
      totalCostValuation,
      totalRetailValuation,
      unrealizedProfit,
      outOfStockCount: outOfStockList.length,
      lowStockCount: lowStockList.length,
      healthyCatalogCount: healthyCount,
    };
  }, [products]);

  // ==========================================
  // 11. DATA-DRIVEN AUTOMATIC BUSINESS INSIGHTS
  // ==========================================

  const dynamicObservations = useMemo(() => {
    const list = [];
    const hasOrders = currentPeriodOrders.length > 0;

    if (!hasOrders) {
      return [];
    }

    // 1. Revenue Insight
    if (kpis.revenueDelta.hasPrev) {
      if (kpis.revenueDelta.direction === "up") {
        list.push({
          icon: "📈",
          title: "Revenue Growth",
          description: `Revenue increased ${kpis.revenueDelta.percent}% compared with the previous period (₹${kpis.revenue.toLocaleString("en-IN")}).`,
          type: "positive",
        });
      } else if (kpis.revenueDelta.direction === "down") {
        list.push({
          icon: "📉",
          title: "Revenue Adjustment",
          description: `Revenue adjusted by -${kpis.revenueDelta.percent}% compared with the previous period (₹${kpis.revenue.toLocaleString("en-IN")}).`,
          type: "negative",
        });
      } else {
        list.push({
          icon: "📊",
          title: "Consistent Revenue Pace",
          description: `Store achieved steady revenue of ₹${kpis.revenue.toLocaleString("en-IN")} across ${kpis.orders} orders.`,
          type: "neutral",
        });
      }
    } else {
      list.push({
        icon: "📈",
        title: "Period Revenue Volume",
        description: `Current period generated ₹${kpis.revenue.toLocaleString("en-IN")} total revenue across ${kpis.orders} confirmed orders.`,
        type: "positive",
      });
    }

    // 2. Top Category
    if (categoryAnalytics.topCategory && categoryAnalytics.topCategory.revenue > 0) {
      list.push({
        icon: "🏆",
        title: "Top Category Performance",
        description: `${categoryAnalytics.topCategory.name} generated the highest revenue (₹${categoryAnalytics.topCategory.revenue.toLocaleString("en-IN")} · ${categoryAnalytics.topCategory.percentage}% of store sales).`,
        type: "positive",
      });
    }

    // 3. Peak Sales Hours
    if (hourlyAnalysis.peakHour && hourlyAnalysis.peakHour.revenue > 0) {
      list.push({
        icon: "⏰",
        title: "Peak Sales Window",
        description: `Peak sales occurred between ${hourlyAnalysis.peakHour.rangeLabel} (${hourlyAnalysis.peakHour.orders} orders · ₹${hourlyAnalysis.peakHour.revenue.toLocaleString("en-IN")}).`,
        type: "neutral",
      });
    }

    // 4. Fastest-Moving Product
    if (productAnalytics.topSelling[0] && productAnalytics.topSelling[0].qtySold > 0) {
      list.push({
        icon: "📦",
        title: "Fastest-Moving Product",
        description: `${productAnalytics.topSelling[0].name} was the fastest-moving product (${productAnalytics.topSelling[0].qtySold} units sold).`,
        type: "positive",
      });
    }

    // 5. Inventory & Sales Decline Alert
    if (productAnalytics.decliningProducts.length > 0) {
      list.push({
        icon: "⚠️",
        title: "Declining Sales Warning",
        description: `${productAnalytics.decliningProducts.length} product${productAnalytics.decliningProducts.length > 1 ? "s are" : " is"} showing declining sales compared with the previous period.`,
        type: "warning",
      });
    } else if (
      inventoryAnalytics.outOfStockCount > 0 ||
      inventoryAnalytics.lowStockCount > 0
    ) {
      list.push({
        icon: "⚠️",
        title: "Inventory Stock Limits",
        description: `${inventoryAnalytics.outOfStockCount} products are out of stock and ${inventoryAnalytics.lowStockCount} items have reached low stock limits.`,
        type: "warning",
      });
    }

    // 6. Profit Margin Insight
    if (kpis.marginDelta.hasPrev) {
      if (kpis.marginDelta.direction === "up") {
        list.push({
          icon: "💰",
          title: "Profit Margin Improvement",
          description: `Profit margin improved by ${kpis.marginDelta.percent}% points (currently ${kpis.margin}%).`,
          type: "positive",
        });
      } else if (kpis.marginDelta.direction === "down") {
        list.push({
          icon: "💰",
          title: "Margin Adjustment",
          description: `Profit margin adjusted by -${kpis.marginDelta.percent}% points (currently ${kpis.margin}%).`,
          type: "neutral",
        });
      } else {
        list.push({
          icon: "💰",
          title: "Stable Margin Efficiency",
          description: `Store maintained a healthy ${kpis.margin}% profit margin on ₹${kpis.profit.toLocaleString("en-IN")} gross profit.`,
          type: "positive",
        });
      }
    } else if (kpis.margin > 0) {
      list.push({
        icon: "💰",
        title: "Realized Gross Margin",
        description: `Store achieved a ${kpis.margin}% gross profit margin on ₹${kpis.profit.toLocaleString("en-IN")} gross profit.`,
        type: "positive",
      });
    }

    return list;
  }, [
    currentPeriodOrders,
    kpis,
    categoryAnalytics,
    hourlyAnalysis,
    productAnalytics,
    inventoryAnalytics,
  ]);

  // Loading Skeleton on initial load
  if (loading) {
    return (
      <div className="space-y-6 sm:space-y-7 animate-pulse">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-[#111827] p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
          <div className="space-y-2">
            <div className="h-7 bg-slate-200 dark:bg-[#172033] rounded-lg w-56" />
            <div className="h-4 bg-slate-100 dark:bg-[#172033]/60 rounded-md w-80" />
          </div>
          <div className="flex items-center gap-2.5">
            <div className="h-10 bg-slate-200 dark:bg-[#172033] rounded-xl w-36" />
            <div className="h-10 bg-slate-200 dark:bg-[#172033] rounded-xl w-40" />
            <div className="h-10 bg-slate-200 dark:bg-[#172033] rounded-xl w-24" />
          </div>
        </div>
        <div className="h-24 bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-5" />
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-32 bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-4 sm:p-5 space-y-3"
            >
              <div className="flex justify-between items-center">
                <div className="h-3 bg-slate-200 dark:bg-[#172033] rounded w-20" />
                <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-[#172033]" />
              </div>
              <div className="h-7 bg-slate-200 dark:bg-[#172033] rounded-lg w-28" />
              <div className="h-3 bg-slate-100 dark:bg-[#172033]/60 rounded w-24" />
            </div>
          ))}
        </div>
        <div className="h-44 bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-5 sm:p-6" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 h-96 bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-6" />
          <div className="lg:col-span-4 h-96 bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-6" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-7 pb-12">
      {/* ========================================================= */}
      {/* HEADER & DATE RANGE / COMPARISON SELECTOR                 */}
      {/* ========================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white dark:bg-[#111827] p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-[28px] sm:text-3xl font-bold text-slate-900 dark:text-[#F8FAFC] tracking-tight">
              Business Insights
            </h1>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-500/20">
              Analytics & Patterns
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Realtime Active
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-[#94A3B8] mt-1 font-normal">
            Understand how the store is performing and identify useful business trends
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Period selector */}
          <div className="relative">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="h-10 pl-3.5 pr-8 rounded-xl font-medium text-xs sm:text-sm bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-[#CBD5E1] focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last7days">Last 7 Days</option>
              <option value="last30days">Last 30 Days</option>
              <option value="thisMonth">This Month</option>
              <option value="lastMonth">Last Month</option>
              <option value="thisYear">This Year</option>
              <option value="custom">Custom Range</option>
            </select>
            <FiChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#64748B] pointer-events-none text-xs" />
          </div>

          {/* Comparison selector */}
          <div className="relative">
            <select
              value={comparisonType}
              onChange={(e) => setComparisonType(e.target.value)}
              className="h-10 pl-3.5 pr-8 rounded-xl font-medium text-xs sm:text-sm bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-[#CBD5E1] focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition"
            >
              <option value="previous_period">vs Previous Period</option>
              <option value="previous_month">vs Previous Month</option>
              <option value="previous_year">vs Previous Year</option>
            </select>
            <FiChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#64748B] pointer-events-none text-xs" />
          </div>

          <button
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="h-10 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#0F172A] dark:hover:bg-[#172033] border border-transparent dark:border-slate-800 text-slate-700 dark:text-[#CBD5E1] transition flex items-center gap-2 text-xs font-semibold"
            title="Refresh analytics data"
          >
            <FiRefreshCw
              className={`text-xs ${
                isRefreshing ? "animate-spin text-indigo-500" : ""
              }`}
            />
            <span>
              {isRefreshing ? "Syncing..." : "Sync"}
            </span>
          </button>
        </div>
      </div>

      {/* Custom Date Range Picker */}
      {selectedPeriod === "custom" && (
        <div className="bg-white dark:bg-[#111827] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-wrap items-center gap-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#94A3B8]">
            Custom Date Range:
          </span>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500 dark:text-[#94A3B8]">
              From:
            </label>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="h-9 px-3 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0F172A] text-slate-800 dark:text-[#CBD5E1] focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500 dark:text-[#94A3B8]">To:</label>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="h-9 px-3 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0F172A] text-slate-800 dark:text-[#CBD5E1] focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* WHAT CHANGED? COMPACT SUMMARY INSIGHT                     */}
      {/* ========================================================= */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100/80 dark:border-indigo-500/20 flex items-center justify-center font-bold text-sm">
              Δ
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-[#F8FAFC]">
                  What Changed?
                </h3>
                <span className="text-xs text-slate-400 dark:text-[#94A3B8] font-normal">
                  vs {comparisonLabel}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-0.5 font-normal">
                {kpis.revenueDelta.hasPrev ? (
                  kpis.revenueDelta.direction === "up" ? (
                    `Revenue is up ${kpis.revenueDelta.percent}% with ${
                      kpis.ordersDelta.hasPrev
                        ? `${kpis.ordersDelta.percent}% ${kpis.ordersDelta.direction === "up" ? "more" : "fewer"} orders`
                        : "positive velocity"
                    }`
                  ) : kpis.revenueDelta.direction === "down" ? (
                    `Revenue adjusted by -${kpis.revenueDelta.percent}% across comparative trading days`
                  ) : (
                    "Trading volumes and revenue maintained steady parity"
                  )
                ) : (
                  "Baseline established · No historical orders found in comparative window"
                )}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800/80">
            {/* Revenue Change */}
            <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0F172A] border border-slate-200/60 dark:border-slate-800">
              <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-400 dark:text-[#64748B] block">
                Revenue
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                {kpis.revenueDelta.hasPrev ? (
                  <span
                    className={`text-xs sm:text-sm font-bold tabular-nums ${
                      kpis.revenueDelta.direction === "up"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : kpis.revenueDelta.direction === "down"
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-slate-600 dark:text-[#94A3B8]"
                    }`}
                  >
                    {kpis.revenueDelta.direction === "up"
                      ? "↑"
                      : kpis.revenueDelta.direction === "down"
                        ? "↓"
                        : "•"}{" "}
                    {kpis.revenueDelta.percent}%
                  </span>
                ) : (
                  <span className="text-xs font-normal text-slate-400 dark:text-[#64748B]">
                    No prev data
                  </span>
                )}
              </div>
            </div>

            {/* Orders Change */}
            <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0F172A] border border-slate-200/60 dark:border-slate-800">
              <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-400 dark:text-[#64748B] block">
                Orders
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                {kpis.ordersDelta.hasPrev ? (
                  <span
                    className={`text-xs sm:text-sm font-bold tabular-nums ${
                      kpis.ordersDelta.direction === "up"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : kpis.ordersDelta.direction === "down"
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-slate-600 dark:text-[#94A3B8]"
                    }`}
                  >
                    {kpis.ordersDelta.direction === "up"
                      ? "↑"
                      : kpis.ordersDelta.direction === "down"
                        ? "↓"
                        : "•"}{" "}
                    {kpis.ordersDelta.percent}%
                  </span>
                ) : (
                  <span className="text-xs font-normal text-slate-400 dark:text-[#64748B]">
                    No prev data
                  </span>
                )}
              </div>
            </div>

            {/* Profit Change */}
            <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0F172A] border border-slate-200/60 dark:border-slate-800">
              <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-400 dark:text-[#64748B] block">
                Profit
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                {kpis.profitDelta.hasPrev ? (
                  <span
                    className={`text-xs sm:text-sm font-bold tabular-nums ${
                      kpis.profitDelta.direction === "up"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : kpis.profitDelta.direction === "down"
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-slate-600 dark:text-[#94A3B8]"
                    }`}
                  >
                    {kpis.profitDelta.direction === "up"
                      ? "↑"
                      : kpis.profitDelta.direction === "down"
                        ? "↓"
                        : "•"}{" "}
                    {kpis.profitDelta.percent}%
                  </span>
                ) : (
                  <span className="text-xs font-normal text-slate-400 dark:text-[#64748B]">
                    No prev data
                  </span>
                )}
              </div>
            </div>

            {/* AOV Change */}
            <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0F172A] border border-slate-200/60 dark:border-slate-800">
              <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-400 dark:text-[#64748B] block">
                AOV
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                {kpis.aovDelta.hasPrev ? (
                  <span
                    className={`text-xs sm:text-sm font-bold tabular-nums ${
                      kpis.aovDelta.direction === "up"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : kpis.aovDelta.direction === "down"
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-slate-600 dark:text-[#94A3B8]"
                    }`}
                  >
                    {kpis.aovDelta.direction === "up"
                      ? "↑"
                      : kpis.aovDelta.direction === "down"
                        ? "↓"
                        : "•"}{" "}
                    {kpis.aovDelta.percent}%
                  </span>
                ) : (
                  <span className="text-xs font-normal text-slate-400 dark:text-[#64748B]">
                    No prev data
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. KEY PERFORMANCE CARDS                                   */}
      {/* ========================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Total Revenue */}
        <div className="bg-white dark:bg-[#111827] rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700/80 transition duration-150">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider">
                Total Revenue
              </span>
              <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100/80 dark:border-indigo-500/20 flex items-center justify-center">
                <FaRupeeSign className="text-xs" />
              </div>
            </div>
            <p className="text-2xl sm:text-[28px] font-bold text-slate-900 dark:text-[#F8FAFC] mt-2.5 truncate tabular-nums">
              ₹{kpis.revenue.toLocaleString("en-IN")}
            </p>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs font-medium">
            {kpis.revenueDelta.hasPrev ? (
              <span
                className={`inline-flex items-center gap-0.5 ${
                  kpis.revenueDelta.direction === "up"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : kpis.revenueDelta.direction === "down"
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-slate-400 dark:text-[#94A3B8]"
                }`}
              >
                {kpis.revenueDelta.direction === "up" ? (
                  <FiArrowUpRight className="text-xs" />
                ) : kpis.revenueDelta.direction === "down" ? (
                  <FiArrowDownRight className="text-xs" />
                ) : null}
                {kpis.revenueDelta.label}
              </span>
            ) : (
              <span className="text-slate-400 dark:text-[#64748B] font-normal">
                No previous-period data
              </span>
            )}
          </div>
        </div>

        {/* Total Profit */}
        <div className="bg-white dark:bg-[#111827] rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700/80 transition duration-150">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider">
                Total Profit
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100/80 dark:border-emerald-500/20 flex items-center justify-center">
                <FiTrendingUp className="text-sm" />
              </div>
            </div>
            <p className="text-2xl sm:text-[28px] font-bold text-emerald-600 dark:text-emerald-400 mt-2.5 truncate tabular-nums">
              ₹{kpis.profit.toLocaleString("en-IN")}
            </p>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs font-medium">
            {kpis.profitDelta.hasPrev ? (
              <span
                className={`inline-flex items-center gap-0.5 ${
                  kpis.profitDelta.direction === "up"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : kpis.profitDelta.direction === "down"
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-slate-400 dark:text-[#94A3B8]"
                }`}
              >
                {kpis.profitDelta.direction === "up" ? (
                  <FiArrowUpRight className="text-xs" />
                ) : kpis.profitDelta.direction === "down" ? (
                  <FiArrowDownRight className="text-xs" />
                ) : null}
                {kpis.profitDelta.label}
              </span>
            ) : (
              <span className="text-slate-400 dark:text-[#64748B] font-normal">
                No previous-period data
              </span>
            )}
          </div>
        </div>

        {/* Profit Margin */}
        <div className="bg-white dark:bg-[#111827] rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700/80 transition duration-150">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider">
                Profit Margin
              </span>
              <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-100/80 dark:border-purple-500/20 flex items-center justify-center text-xs font-bold">
                %
              </div>
            </div>
            <p className="text-2xl sm:text-[28px] font-bold text-slate-900 dark:text-[#F8FAFC] mt-2.5 tabular-nums">
              {kpis.margin}%
            </p>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs font-medium">
            {kpis.marginDelta.hasPrev ? (
              <span
                className={
                  kpis.marginDelta.direction === "up"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : kpis.marginDelta.direction === "down"
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-slate-400 dark:text-[#94A3B8]"
                }
              >
                {kpis.marginDelta.label}
              </span>
            ) : (
              <span className="text-slate-400 dark:text-[#64748B] font-normal">
                No previous-period data
              </span>
            )}
          </div>
        </div>

        {/* Total Orders */}
        <div className="bg-white dark:bg-[#111827] rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700/80 transition duration-150">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider">
                Total Orders
              </span>
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-100/80 dark:border-blue-500/20 flex items-center justify-center">
                <FiShoppingBag className="text-sm" />
              </div>
            </div>
            <p className="text-2xl sm:text-[28px] font-bold text-slate-900 dark:text-[#F8FAFC] mt-2.5 tabular-nums">
              {kpis.orders}
            </p>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs font-medium">
            {kpis.ordersDelta.hasPrev ? (
              <span
                className={`inline-flex items-center gap-0.5 ${
                  kpis.ordersDelta.direction === "up"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : kpis.ordersDelta.direction === "down"
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-slate-400 dark:text-[#94A3B8]"
                }`}
              >
                {kpis.ordersDelta.direction === "up" ? (
                  <FiArrowUpRight className="text-xs" />
                ) : kpis.ordersDelta.direction === "down" ? (
                  <FiArrowDownRight className="text-xs" />
                ) : null}
                {kpis.ordersDelta.label}
              </span>
            ) : (
              <span className="text-slate-400 dark:text-[#64748B] font-normal">
                No previous-period data
              </span>
            )}
          </div>
        </div>

        {/* Avg Order Value */}
        <div className="bg-white dark:bg-[#111827] rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700/80 transition duration-150">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider">
                Avg Order Value
              </span>
              <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-100/80 dark:border-amber-500/20 flex items-center justify-center">
                <FiBarChart2 className="text-sm" />
              </div>
            </div>
            <p className="text-2xl sm:text-[28px] font-bold text-slate-900 dark:text-[#F8FAFC] mt-2.5 truncate tabular-nums">
              ₹{kpis.aov.toLocaleString("en-IN")}
            </p>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs font-medium">
            {kpis.aovDelta.hasPrev ? (
              <span
                className={`inline-flex items-center gap-0.5 ${
                  kpis.aovDelta.direction === "up"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : kpis.aovDelta.direction === "down"
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-slate-400 dark:text-[#94A3B8]"
                }`}
              >
                {kpis.aovDelta.direction === "up" ? (
                  <FiArrowUpRight className="text-xs" />
                ) : kpis.aovDelta.direction === "down" ? (
                  <FiArrowDownRight className="text-xs" />
                ) : null}
                {kpis.aovDelta.label}
              </span>
            ) : (
              <span className="text-slate-400 dark:text-[#64748B] font-normal">
                No previous-period data
              </span>
            )}
          </div>
        </div>

        {/* Items Sold */}
        <div className="bg-white dark:bg-[#111827] rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700/80 transition duration-150">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider">
                Items Sold
              </span>
              <div className="w-9 h-9 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-100/80 dark:border-cyan-500/20 flex items-center justify-center">
                <FiBox className="text-sm" />
              </div>
            </div>
            <p className="text-2xl sm:text-[28px] font-bold text-slate-900 dark:text-[#F8FAFC] mt-2.5 tabular-nums">
              {kpis.itemsSold.toLocaleString("en-IN")}
            </p>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs font-medium">
            {kpis.itemsSoldDelta.hasPrev ? (
              <span
                className={`inline-flex items-center gap-0.5 ${
                  kpis.itemsSoldDelta.direction === "up"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : kpis.itemsSoldDelta.direction === "down"
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-slate-400 dark:text-[#94A3B8]"
                }`}
              >
                {kpis.itemsSoldDelta.direction === "up" ? (
                  <FiArrowUpRight className="text-xs" />
                ) : kpis.itemsSoldDelta.direction === "down" ? (
                  <FiArrowDownRight className="text-xs" />
                ) : null}
                {kpis.itemsSoldDelta.label}
              </span>
            ) : (
              <span className="text-slate-400 dark:text-[#64748B] font-normal">
                No previous-period data
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. AUTOMATIC BUSINESS INSIGHTS                             */}
      {/* ========================================================= */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <FiZap className="text-base" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-[#F8FAFC]">
                Automatic Business Insights
              </h2>
              <p className="text-sm text-slate-500 dark:text-[#94A3B8] font-normal">
                Data-driven executive observations generated from actual store activity
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAIInsights(!showAIInsights)}
            className="self-start sm:self-auto text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-slate-50 dark:bg-[#0F172A] hover:bg-slate-100 dark:hover:bg-[#172033] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 transition flex items-center gap-2 shadow-xs"
          >
            <span>
              {showAIInsights ? "Hide Deep AI Summary" : "Deep AI Summary (Optional)"}
            </span>
            <FiChevronDown
              className={`text-xs transition-transform ${
                showAIInsights ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>

        {dynamicObservations.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400 dark:text-[#64748B] font-medium">
            Not enough data to generate this insight.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
            {dynamicObservations.map((obs, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-slate-50/70 dark:bg-[#0F172A] border border-slate-200/80 dark:border-slate-800 flex items-start gap-3.5"
              >
                <span className="text-2xl flex-shrink-0 mt-0.5">
                  {obs.icon}
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-[#F8FAFC]">
                    {obs.title}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-[#94A3B8] mt-1 leading-relaxed font-normal">
                    {obs.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {showAIInsights && (
          <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800">
            <AIInsights
              filters={{
                from: currentRange.start.toISOString().split("T")[0],
                to: currentRange.end.toISOString().split("T")[0],
              }}
            />
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 3 & 4. REVENUE, COST & PROFIT ANALYSIS + SALES TREND      */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Finance Chart */}
        <div className="lg:col-span-8 bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-[#F8FAFC]">
                  Revenue, Cost & Profit Analysis
                </h2>
                <p className="text-sm text-slate-500 dark:text-[#94A3B8] mt-0.5 font-normal">
                  Financial trajectory comparing Revenue, COGS, and Profit
                </p>
              </div>

              <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#0F172A] p-1 rounded-xl self-start sm:self-auto border border-transparent dark:border-slate-800">
                {["daily", "weekly", "monthly"].map((gran) => (
                  <button
                    key={gran}
                    onClick={() => setChartGranularity(gran)}
                    className={`px-3 py-1.5 text-xs rounded-lg capitalize transition ${
                      chartGranularity === gran
                        ? "bg-white dark:bg-[#172033] text-indigo-600 dark:text-[#F8FAFC] shadow-xs font-semibold"
                        : "text-slate-500 dark:text-[#94A3B8] hover:text-slate-800 dark:hover:text-[#F8FAFC] font-medium"
                    }`}
                  >
                    {gran}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 h-80 w-full">
              {financeTrendData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  <FiBarChart2 className="text-4xl text-slate-400 dark:text-[#64748B] mb-3" />
                  <p className="text-base font-semibold text-slate-700 dark:text-[#CBD5E1]">
                    No confirmed sales data for this period
                  </p>
                  <p className="text-sm text-slate-400 dark:text-[#64748B] mt-1.5">
                    Try picking a broader date range or select "Last 30 Days".
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={financeTrendData}
                    margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="rgba(148, 163, 184, 0.12)"
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "#94A3B8", fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#94A3B8", fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) =>
                        v >= 1000 ? `₹${v / 1000}k` : `₹${v}`
                      }
                    />
                    <Tooltip content={<FinanceTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: 12, paddingTop: 10 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      name="Revenue"
                      fill="#e0e7ff"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                    />
                    <Bar
                      dataKey="cost"
                      name="Cost (COGS)"
                      fill="#f59e0b"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                    />
                    <Line
                      type="monotone"
                      dataKey="profit"
                      name="Profit"
                      stroke="#10b981"
                      strokeWidth={3}
                      dot={{ r: 3, fill: "#10b981" }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between text-xs font-medium text-slate-400 dark:text-[#64748B] pt-4 border-t border-slate-100 dark:border-slate-800/80 mt-4 gap-2">
            <span>Granularity: {chartGranularity.toUpperCase()}</span>
            <span>Based on confirmed store orders</span>
          </div>
        </div>

        {/* Sales Trend & Run Rate */}
        <div className="lg:col-span-4 bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-[#F8FAFC]">
                Sales Trend & Run-Rate
              </h2>
              <p className="text-sm text-slate-500 dark:text-[#94A3B8] mt-0.5 font-normal">
                Pacing indicators and performance extremes
              </p>
            </div>

            {salesTrendAnalysis ? (
              <div className="space-y-4 mt-5">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0F172A] border border-slate-200/80 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-400 dark:text-[#64748B] uppercase tracking-wider">
                    Average Daily Run-Rate
                  </span>
                  <div className="flex items-baseline justify-between mt-1.5">
                    <p className="text-2xl font-bold text-slate-900 dark:text-[#F8FAFC] tabular-nums">
                      ₹
                      {salesTrendAnalysis.avgDailyRevenue.toLocaleString(
                        "en-IN",
                      )}
                      /day
                    </p>
                    <span className="text-xs font-semibold text-slate-500 dark:text-[#94A3B8]">
                      {salesTrendAnalysis.avgDailyOrders} orders/day
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase flex items-center gap-1.5 tracking-wider">
                    <FiTrendingUp /> Best Performing Period
                  </span>
                  <div className="flex items-baseline justify-between mt-1.5">
                    <p className="text-base font-bold text-emerald-700 dark:text-emerald-300">
                      {salesTrendAnalysis.peakDay.label}
                    </p>
                    <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      ₹
                      {salesTrendAnalysis.peakDay.revenue.toLocaleString(
                        "en-IN",
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1 font-medium">
                    {salesTrendAnalysis.peakDay.orders} orders processed
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0F172A] border border-slate-200/80 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-400 dark:text-[#64748B] uppercase flex items-center gap-1.5 tracking-wider">
                    <FiTrendingDown /> Lowest Performing Period
                  </span>
                  <div className="flex items-baseline justify-between mt-1.5">
                    <p className="text-sm font-semibold text-slate-700 dark:text-[#CBD5E1]">
                      {salesTrendAnalysis.lowDay.label}
                    </p>
                    <span className="text-sm font-semibold text-slate-600 dark:text-[#94A3B8] tabular-nums">
                      ₹
                      {salesTrendAnalysis.lowDay.revenue.toLocaleString(
                        "en-IN",
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 dark:text-[#64748B] mt-1 font-normal">
                    {salesTrendAnalysis.lowDay.orders} orders processed
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400 dark:text-[#64748B] text-sm">
                No trend metrics available for this period.
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-[#94A3B8] flex justify-between mt-4">
            <span>Period Duration:</span>
            <span className="font-semibold text-slate-800 dark:text-[#F8FAFC]">
              {salesTrendAnalysis?.bucketsCount || 0} active periods
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 5. PEAK SALES HOURS + PAYMENT METHOD                       */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Hourly Sales */}
        <div className="lg:col-span-7 bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <FiClock className="text-base" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-[#F8FAFC]">
                  Peak Sales Hours
                </h2>
                <p className="text-sm text-slate-500 dark:text-[#94A3B8] mt-0.5 font-normal">
                  Hourly transaction density identifying busiest store hours
                </p>
              </div>
            </div>

            {hourlyAnalysis.peakHour && (
              <div className="self-start sm:self-auto px-3 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200/60 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-400 text-xs font-semibold flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                <span>
                  Peak: {hourlyAnalysis.peakHour.rangeLabel} (
                  {hourlyAnalysis.peakHour.orders} orders · ₹
                  {hourlyAnalysis.peakHour.revenue.toLocaleString("en-IN")})
                </span>
              </div>
            )}
          </div>

          <div className="mt-5 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={hourlyAnalysis.chartData}
                margin={{ top: 5, right: 10, left: -15, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="rgba(148, 163, 184, 0.12)"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#94A3B8", fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#94A3B8", fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) =>
                    v >= 1000 ? `₹${v / 1000}k` : `₹${v}`
                  }
                />
                <Tooltip
                  formatter={(val, name, item) => [
                    `₹${Number(val).toLocaleString("en-IN")} (${
                      item.payload.orders
                    } orders)`,
                    "Revenue",
                  ]}
                  contentStyle={{
                    backgroundColor: "#0B1220",
                    borderColor: "rgba(148, 163, 184, 0.2)",
                    borderRadius: "12px",
                    fontSize: "12px",
                    color: "#F8FAFC",
                    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
                  }}
                />
                <Bar
                  dataKey="revenue"
                  fill="#6366f1"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {hourlyAnalysis.top3.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              {hourlyAnalysis.top3.map((h, i) => (
                <div
                  key={h.hour24}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-[#0F172A] border border-slate-200/60 dark:border-slate-800 flex justify-between items-center"
                >
                  <div>
                    <span className="text-sm font-semibold text-slate-800 dark:text-[#F8FAFC]">
                      #{i + 1} {h.label}
                    </span>
                    <p className="text-xs text-slate-400 dark:text-[#64748B] mt-0.5">
                      {h.orders} orders
                    </p>
                  </div>
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                    ₹{h.revenue.toLocaleString("en-IN")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payment Method Insights */}
        <div className="lg:col-span-5 bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <FiCreditCard className="text-base" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-[#F8FAFC]">
                    Payment Method Insights
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-[#94A3B8] mt-0.5 font-normal">
                    Cash vs Online / UPI distribution
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LIVE
              </span>
            </div>

            {/* Donut Chart + Legend */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-5 items-center">
              <div className="h-44 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentAnalytics.chartData.filter(
                        (d) => d.value > 0,
                      )}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={72}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {paymentAnalytics.chartData
                        .filter((d) => d.value > 0)
                        .map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                    </Pie>
                    <Tooltip
                      formatter={(val) =>
                        `₹${Number(val).toLocaleString("en-IN")}`
                      }
                      contentStyle={{
                        backgroundColor: "#0B1220",
                        borderColor: "rgba(148, 163, 184, 0.2)",
                        borderRadius: "12px",
                        fontSize: "12px",
                        color: "#F8FAFC",
                        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#64748B]">
                    Total
                  </span>
                  <span className="text-sm font-bold text-slate-900 dark:text-[#F8FAFC] tabular-nums">
                    ₹
                    {(
                      paymentAnalytics.cashRevenue +
                      paymentAnalytics.onlineRevenue
                    ).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Cash
                    </span>
                    <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                      {paymentAnalytics.cashPct}%
                    </span>
                  </div>
                  <p className="text-lg font-bold text-emerald-800 dark:text-emerald-300 mt-1 tabular-nums">
                    ₹{paymentAnalytics.cashRevenue.toLocaleString("en-IN")}
                  </p>
                  <p className="text-xs text-emerald-600/80 dark:text-emerald-500 mt-0.5 font-normal">
                    {paymentAnalytics.cashCount} orders
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wide">
                      <span className="w-2 h-2 rounded-full bg-indigo-500" />
                      Online / UPI
                    </span>
                    <span className="text-sm font-bold text-indigo-700 dark:text-indigo-400 tabular-nums">
                      {paymentAnalytics.onlinePct}%
                    </span>
                  </div>
                  <p className="text-lg font-bold text-indigo-800 dark:text-indigo-300 mt-1 tabular-nums">
                    ₹{paymentAnalytics.onlineRevenue.toLocaleString("en-IN")}
                  </p>
                  <p className="text-xs text-indigo-600/80 dark:text-indigo-500 mt-0.5 font-normal">
                    {paymentAnalytics.onlineCount} orders
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400 dark:text-[#64748B] mt-4 font-normal">
            <span>Method Distribution</span>
            <span>
              {paymentAnalytics.cashCount + paymentAnalytics.onlineCount} orders processed
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 6 & 7. PRODUCT PERFORMANCE + CATEGORY PERFORMANCE         */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Product Performance */}
        <div className="lg:col-span-6 bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-[#F8FAFC]">
                  Product Performance
                </h2>
                <p className="text-sm text-slate-500 dark:text-[#94A3B8] mt-0.5 font-normal">
                  Top selling, high revenue, most profitable, and slow-moving SKUs
                </p>
              </div>

              <Link
                to="/admin/reports"
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline flex items-center gap-1 self-start sm:self-auto"
              >
                <span>View Full Report</span>
                <FiArrowRight />
              </Link>
            </div>

            {/* Product Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-3 border-b border-slate-100 dark:border-slate-800 scrollbar-none">
              {[
                { id: "top_selling", label: "Top Selling" },
                { id: "top_revenue", label: "Highest Revenue" },
                { id: "top_profit", label: "Most Profitable" },
                { id: "slow_moving", label: "Slow Moving" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setProductTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                    productTab === tab.id
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-slate-100 dark:bg-[#0F172A] text-slate-600 dark:text-[#94A3B8] hover:bg-slate-200 dark:hover:bg-[#172033]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Product Table */}
            <div className="mt-4 overflow-x-auto">
              {(() => {
                let list = [];
                let emptyMsg = "No sales recorded for products in this period.";

                if (productTab === "top_selling") {
                  list = productAnalytics.topSelling;
                } else if (productTab === "top_revenue") {
                  list = productAnalytics.topRevenue;
                } else if (productTab === "top_profit") {
                  list = productAnalytics.topProfit;
                } else if (productTab === "slow_moving") {
                  list = productAnalytics.slowMoving;
                  emptyMsg = "No slow-moving products found.";
                }

                if (list.length === 0) {
                  return (
                    <div className="text-center py-12 text-sm text-slate-400 dark:text-[#64748B] font-medium">
                      {emptyMsg}
                    </div>
                  );
                }

                return (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 dark:text-[#64748B] font-semibold uppercase tracking-wider text-[11px]">
                        <th className="py-2.5 px-2">#</th>
                        <th className="py-2.5 px-2">Product</th>
                        <th className="py-2.5 px-2 text-center">
                          {productTab === "slow_moving"
                            ? "Stock / Sold"
                            : "Units Sold"}
                        </th>
                        <th className="py-2.5 px-2 text-right">
                          {productTab === "top_profit" ? "Profit" : "Revenue"}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {list.map((item, idx) => (
                        <tr
                          key={item.id || idx}
                          className="hover:bg-slate-50 dark:hover:bg-[#172033] transition duration-150"
                        >
                          <td className="py-3 px-2 text-slate-400 dark:text-[#64748B] font-medium text-xs">
                            #{idx + 1}
                          </td>
                          <td className="py-3 px-2">
                            <p className="font-semibold text-slate-800 dark:text-[#F8FAFC] truncate max-w-[160px] sm:max-w-xs text-sm">
                              {item.name}
                            </p>
                            <span className="text-[11px] text-slate-400 dark:text-[#64748B]">
                              {item.category}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-center">
                            {productTab === "slow_moving" ? (
                              <span className="text-xs text-slate-500 dark:text-[#94A3B8] font-medium">
                                {item.stock} in stock ({item.qtySold} sold)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-500/20 font-semibold text-xs tabular-nums">
                                {item.qtySold}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-right font-bold text-slate-900 dark:text-[#F8FAFC] text-sm tabular-nums">
                            ₹
                            {productTab === "top_profit"
                              ? item.profit.toLocaleString("en-IN")
                              : item.revenue.toLocaleString("en-IN")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-xs font-medium text-slate-400 dark:text-[#64748B] flex justify-between mt-4">
            <span>Sorting: {productTab.replace("_", " ").toUpperCase()}</span>
            <span>Real transaction data</span>
          </div>
        </div>

        {/* Category Performance (Clean, Accurate, Compact) */}
        <div className="lg:col-span-6 bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-[#F8FAFC]">
                  Category Performance
                </h2>
                <p className="text-sm text-slate-500 dark:text-[#94A3B8] mt-0.5 font-normal">
                  Revenue contribution, profit, and quantity sold by category
                </p>
              </div>

              {categoryAnalytics.topCategory && (
                <span className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-500/20">
                  Top: {categoryAnalytics.topCategory.name}
                </span>
              )}
            </div>

            <div className="mt-5 space-y-3">
              {!categoryAnalytics.hasData ? (
                <div className="text-center py-12 text-sm text-slate-400 dark:text-[#64748B] font-medium">
                  No category data available for the selected period.
                </div>
              ) : (
                categoryAnalytics.list.slice(0, 5).map((cat, idx) => (
                  <div
                    key={cat.name}
                    className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-[#0F172A] border border-slate-200/60 dark:border-slate-800 space-y-2"
                  >
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{
                            backgroundColor:
                              PIE_COLORS[idx % PIE_COLORS.length],
                          }}
                        />
                        <span className="font-semibold text-slate-800 dark:text-[#F8FAFC] text-sm">
                          {cat.name}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-[#64748B] font-normal">
                          ({cat.qtySold} sold)
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <span className="text-slate-900 dark:text-[#F8FAFC] tabular-nums font-bold text-sm">
                          ₹{cat.revenue.toLocaleString("en-IN")}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-[#94A3B8] font-semibold tabular-nums bg-white dark:bg-[#172033] px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700/80">
                          {cat.percentage}%
                        </span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full h-1.5 rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${cat.percentage}%`,
                          backgroundColor:
                            PIE_COLORS[idx % PIE_COLORS.length],
                        }}
                      />
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-slate-400 dark:text-[#64748B] pt-0.5">
                      <span>
                        Profit:{" "}
                        <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          ₹{cat.profit.toLocaleString("en-IN")}
                        </strong>
                      </span>
                      <span>
                        Margin:{" "}
                        <strong className="text-slate-700 dark:text-[#CBD5E1] font-semibold">
                          {cat.margin}%
                        </strong>
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-xs font-medium text-slate-400 dark:text-[#64748B] flex justify-between mt-4">
            <span>Categories Monitored:</span>
            <span className="font-semibold text-slate-800 dark:text-[#F8FAFC]">
              {categoryAnalytics.list.length} active
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 8 & 9. COUNTER PERFORMANCE + STAFF PERFORMANCE             */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Counter Performance */}
        <div className="lg:col-span-6 bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <FiMonitor className="text-base" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-[#F8FAFC]">
                    Counter Performance
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-[#94A3B8] mt-0.5 font-normal">
                    Throughput, sales, and average ticket per counter
                  </p>
                </div>
              </div>

              {counterAnalytics.topCounter &&
                counterAnalytics.topCounter.revenue > 0 && (
                  <span className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                    🥇 Best Counter
                  </span>
                )}
            </div>

            <div className="mt-5 space-y-3">
              {counterAnalytics.list.length === 0 ? (
                <div className="text-center py-12 text-sm text-slate-400 dark:text-[#64748B]">
                  No counter activity recorded for this period.
                </div>
              ) : (
                counterAnalytics.list.map((c, idx) => (
                  <div
                    key={c.id || idx}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0F172A] border border-slate-200/60 dark:border-slate-800 flex items-center justify-between hover:bg-slate-100/70 dark:hover:bg-[#172033] transition duration-150"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold text-xs flex items-center justify-center border border-indigo-100/80 dark:border-indigo-500/20">
                        C{idx + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-slate-800 dark:text-[#F8FAFC]">
                          {c.name}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-[#64748B] mt-0.5 font-normal">
                          {c.orders} orders processed
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-base font-bold text-slate-900 dark:text-[#F8FAFC] tabular-nums">
                        ₹{c.revenue.toLocaleString("en-IN")}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-[#64748B] font-medium mt-0.5">
                        AOV: ₹{c.aov}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <Link
            to="/admin/counters"
            className="mt-5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline flex items-center justify-center gap-1"
          >
            <span>View All Billing Counters</span>
            <FiArrowRight />
          </Link>
        </div>

        {/* Staff Performance */}
        <div className="lg:col-span-6 bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <FiUsers className="text-base" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-[#F8FAFC]">
                    Staff Performance
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-[#94A3B8] mt-0.5 font-normal">
                    Order handling volume and revenue output by personnel
                  </p>
                </div>
              </div>

              {staffAnalytics.topStaff && staffAnalytics.topStaff.revenue > 0 && (
                <span className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 flex items-center gap-1">
                  🌟 Top Performer
                </span>
              )}
            </div>

            <div className="mt-5 space-y-3">
              {staffAnalytics.list.length === 0 ? (
                <div className="text-center py-12 text-sm text-slate-400 dark:text-[#64748B]">
                  No staff activity recorded for this period.
                </div>
              ) : (
                staffAnalytics.list.map((s, idx) => (
                  <div
                    key={s.name || idx}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0F172A] border border-slate-200/60 dark:border-slate-800 flex items-center justify-between hover:bg-slate-100/70 dark:hover:bg-[#172033] transition duration-150"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-xs flex items-center justify-center border border-emerald-100/80 dark:border-emerald-500/20">
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-slate-800 dark:text-[#F8FAFC]">
                          {s.name}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-[#64748B] mt-0.5 font-normal">
                          {s.orders} orders completed
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-base font-bold text-slate-900 dark:text-[#F8FAFC] tabular-nums">
                        ₹{s.revenue.toLocaleString("en-IN")}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-[#64748B] font-medium mt-0.5">
                        Avg: ₹{s.aov}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <Link
            to="/admin/staff"
            className="mt-5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline flex items-center justify-center gap-1"
          >
            <span>View All Staff Members</span>
            <FiArrowRight />
          </Link>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 10 & 11. INVENTORY INTELLIGENCE + PROFITABILITY & P&L     */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Inventory Intelligence */}
        <div className="lg:col-span-6 bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-600 text-white flex items-center justify-center shadow-xs">
                  <FiPackage className="text-base" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-[#F8FAFC]">
                    Inventory Intelligence
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-[#94A3B8] mt-0.5 font-normal">
                    Stock valuation and warehouse catalog health
                  </p>
                </div>
              </div>

              <Link
                to="/admin/stock-refill"
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200/60 dark:border-indigo-500/20"
              >
                <span>Stock Refill</span>
                <FiArrowRight />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-5">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0F172A] border border-slate-200/80 dark:border-slate-800">
                <span className="text-[11px] font-semibold text-slate-400 dark:text-[#64748B] uppercase tracking-wider">
                  Inventory Value (Cost)
                </span>
                <p className="text-2xl font-bold text-slate-900 dark:text-[#F8FAFC] mt-1.5 tabular-nums">
                  ₹
                  {inventoryAnalytics.totalCostValuation.toLocaleString(
                    "en-IN",
                  )}
                </p>
                <p className="text-xs text-slate-400 dark:text-[#64748B] mt-1 font-normal">
                  {inventoryAnalytics.totalStockUnits.toLocaleString("en-IN")}{" "}
                  units in stock
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0F172A] border border-slate-200/80 dark:border-slate-800">
                <span className="text-[11px] font-semibold text-slate-400 dark:text-[#64748B] uppercase tracking-wider">
                  Retail Value (Potential)
                </span>
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1.5 tabular-nums">
                  ₹
                  {inventoryAnalytics.totalRetailValuation.toLocaleString(
                    "en-IN",
                  )}
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                  +₹
                  {inventoryAnalytics.unrealizedProfit.toLocaleString(
                    "en-IN",
                  )}{" "}
                  potential profit
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-rose-700 dark:text-rose-400">
                    Out of Stock
                  </span>
                  <p className="text-xs text-slate-400 dark:text-[#64748B] mt-0.5 font-normal">
                    Order loss risk
                  </p>
                </div>
                <span className="text-2xl font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                  {inventoryAnalytics.outOfStockCount}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                    Low Stock Limit
                  </span>
                  <p className="text-xs text-slate-400 dark:text-[#64748B] mt-0.5 font-normal">
                    Needs restock
                  </p>
                </div>
                <span className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                  {inventoryAnalytics.lowStockCount}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-xs font-medium text-slate-400 dark:text-[#64748B] flex justify-between mt-5">
            <span>Healthy Products:</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {inventoryAnalytics.healthyCatalogCount} of {products.length}{" "}
              catalog items
            </span>
          </div>
        </div>

        {/* Profitability & P&L Breakdown */}
        <div className="lg:col-span-6 bg-white dark:bg-[#111827] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-start gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                <FaRupeeSign className="text-base" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-[#F8FAFC]">
                  Profitability & P&L Breakdown
                </h2>
                <p className="text-sm text-slate-500 dark:text-[#94A3B8] mt-0.5 font-normal">
                  Financial summary derived using project cost snapshot formulas
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-2.5">
              <div className="flex justify-between items-center py-3 px-4 rounded-xl bg-slate-50 dark:bg-[#0F172A] border border-transparent dark:border-slate-800">
                <span className="text-sm font-medium text-slate-600 dark:text-[#CBD5E1]">
                  Gross Sales Revenue
                </span>
                <span className="text-sm font-bold text-slate-900 dark:text-[#F8FAFC] tabular-nums">
                  ₹{kpis.revenue.toLocaleString("en-IN")}
                </span>
              </div>

              <div className="flex justify-between items-center py-3 px-4 rounded-xl bg-slate-50 dark:bg-[#0F172A] border border-transparent dark:border-slate-800 text-amber-700 dark:text-amber-400">
                <span className="text-sm font-medium">
                  (-) Cost of Goods Sold (COGS)
                </span>
                <span className="text-sm font-bold tabular-nums">
                  ₹{kpis.cost.toLocaleString("en-IN")}
                </span>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-800 my-2" />

              <div className="flex justify-between items-center py-3 px-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                <span className="text-base font-semibold">
                  (=) Gross Profit
                </span>
                <span className="text-lg font-bold tabular-nums">
                  ₹{kpis.profit.toLocaleString("en-IN")}
                </span>
              </div>

              <div className="flex justify-between items-center py-2.5 px-4 text-slate-500 dark:text-[#94A3B8]">
                <span className="text-sm font-medium">
                  Gross Profit Margin
                </span>
                <span className="font-bold text-slate-800 dark:text-[#F8FAFC] text-base tabular-nums">
                  {kpis.margin}%
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-xs font-medium text-slate-400 dark:text-[#64748B] flex justify-between">
            <span>Period Financial Status:</span>
            <span
              className={`font-semibold ${
                kpis.profit > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-slate-500 dark:text-[#94A3B8]"
              }`}
            >
              {kpis.profit > 0
                ? "Profitable Period"
                : "Break-even / Zero Profit"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}