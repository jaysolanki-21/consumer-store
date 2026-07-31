import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import api from "../services/api";
import socket from "../services/socket";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiCalendar,
  FiTrendingUp,
  FiTrendingDown,
  FiPackage,
  FiShoppingCart,
  FiBarChart2,
  FiBox,
  FiChevronLeft,
  FiChevronRight,
  FiLayers,
  FiTag,
  FiX,
  FiRefreshCw,
  FiFilter,
  FiDollarSign,
  FiClock,
} from "react-icons/fi";
import { FaRupeeSign } from "react-icons/fa";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  ComposedChart,
} from "recharts";

export default function InsightsPage() {
  const [viewType, setViewType] = useState("daily");

  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  });

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // ✅ Custom Date Range
  const [customStartDate, setCustomStartDate] = useState(() => {
    const today = new Date();
    today.setDate(today.getDate() - 30);
    return today.toISOString().split("T")[0];
  });
  const [customEndDate, setCustomEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [useCustomRange, setUseCustomRange] = useState(false);

  const [salesData, setSalesData] = useState([]);
  const [previousSalesData, setPreviousSalesData] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [chartType, setChartType] = useState("bar");

  // ✅ TWO LOADING STATES
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Refs for stable socket handlers
  const salesDataRef = useRef(salesData);
  const previousSalesDataRef = useRef(previousSalesData);

  // Update refs when data changes
  useEffect(() => {
    salesDataRef.current = salesData;
  }, [salesData]);

  useEffect(() => {
    previousSalesDataRef.current = previousSalesData;
  }, [previousSalesData]);

  // Initial fetch
  useEffect(() => {
    fetchCategories();
    fetchProducts();
  }, []);

  // Fetch on view/date change
  useEffect(() => {
    fetchAnalytics(false);
  }, [viewType, selectedDate, selectedMonth, selectedYear, customStartDate, customEndDate, useCustomRange]);

  // ✅ STABLE SOCKET LISTENERS
  useEffect(() => {
    const handleOrderChange = () => {
      fetchAnalytics(true);
    };

    socket.on("orderConfirmed", handleOrderChange);
    socket.on("orderCancelled", handleOrderChange);
    socket.on("newOrder", handleOrderChange);
    socket.on("stockUpdated", () => fetchAnalytics(true));

    return () => {
      socket.off("orderConfirmed", handleOrderChange);
      socket.off("orderCancelled", handleOrderChange);
      socket.off("newOrder", handleOrderChange);
      socket.off("stockUpdated", () => fetchAnalytics(true));
    };
  }, []);

  const fetchCategories = async () => {
    try {
      const { data } = await api.get("/categories");
      setCategories(data);
    } catch (err) {
      console.error("Failed to load categories");
    }
  };

  const fetchProducts = async () => {
    try {
      const { data } = await api.get("/products");
      setProducts(data);
    } catch (err) {
      console.error("Failed to load products");
    }
  };

  // ✅ UPDATED: fetchAnalytics with silent mode and custom range
  const fetchAnalytics = async (silent = false) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setInitialLoading(true);
      }

      let startDate, endDate, prevStartDate, prevEndDate;

      if (useCustomRange) {
        startDate = customStartDate;
        endDate = customEndDate;
        // Previous period same length
        const start = new Date(customStartDate);
        const end = new Date(customEndDate);
        const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        const prevStart = new Date(start);
        prevStart.setDate(prevStart.getDate() - diffDays - 1);
        const prevEnd = new Date(end);
        prevEnd.setDate(prevEnd.getDate() - diffDays - 1);
        prevStartDate = prevStart.toISOString().split("T")[0];
        prevEndDate = prevEnd.toISOString().split("T")[0];
      } else if (viewType === "daily") {
        startDate = selectedDate;
        endDate = selectedDate;
        const prev = new Date(selectedDate);
        prev.setDate(prev.getDate() - 1);
        prevStartDate = prev.toISOString().split("T")[0];
        prevEndDate = prevStartDate;
      } else if (viewType === "monthly") {
        const [year, month] = selectedMonth.split("-");
        startDate = `${year}-${month}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        endDate = `${year}-${month}-${lastDay}`;
        let prevYear = parseInt(year);
        let prevMonth = parseInt(month) - 1;
        if (prevMonth === 0) {
          prevMonth = 12;
          prevYear--;
        }
        const prevMonthStr = String(prevMonth).padStart(2, "0");
        prevStartDate = `${prevYear}-${prevMonthStr}-01`;
        const prevLastDay = new Date(prevYear, prevMonth, 0).getDate();
        prevEndDate = `${prevYear}-${prevMonthStr}-${prevLastDay}`;
      } else {
        startDate = `${selectedYear}-01-01`;
        endDate = `${selectedYear}-12-31`;
        prevStartDate = `${selectedYear - 1}-01-01`;
        prevEndDate = `${selectedYear - 1}-12-31`;
      }

      const [currentRes, prevRes] = await Promise.all([
        api.get(`/products/sales-analytics?startDate=${startDate}&endDate=${endDate}`),
        api.get(`/products/sales-analytics?startDate=${prevStartDate}&endDate=${prevEndDate}`),
      ]);

      setSalesData(currentRes.data);
      setPreviousSalesData(prevRes.data);
    } catch (err) {
      if (!silent) {
        toast.error("Failed to load insights");
      }
      console.error("Analytics error:", err);
    } finally {
      if (silent) {
        setRefreshing(false);
      } else {
        setInitialLoading(false);
      }
    }
  };

  // Navigation functions with useCallback
  const goPrevDay = useCallback(() => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() - 1);
    setSelectedDate(date.toISOString().split("T")[0]);
  }, [selectedDate]);

  const goNextDay = useCallback(() => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + 1);
    const today = new Date().toISOString().split("T")[0];
    if (date.toISOString().split("T")[0] <= today) {
      setSelectedDate(date.toISOString().split("T")[0]);
    } else {
      toast.error("Cannot go beyond today");
    }
  }, [selectedDate]);

  const goPrevMonth = useCallback(() => {
    const [year, month] = selectedMonth.split("-");
    let newYear = parseInt(year);
    let newMonth = parseInt(month) - 1;
    if (newMonth === 0) {
      newMonth = 12;
      newYear--;
    }
    setSelectedMonth(`${newYear}-${String(newMonth).padStart(2, "0")}`);
  }, [selectedMonth]);

  const goNextMonth = useCallback(() => {
    const [year, month] = selectedMonth.split("-");
    let newYear = parseInt(year);
    let newMonth = parseInt(month) + 1;
    if (newMonth === 13) {
      newMonth = 1;
      newYear++;
    }
    const todayYear = new Date().getFullYear();
    const todayMonth = new Date().getMonth() + 1;
    if (newYear < todayYear || (newYear === todayYear && newMonth <= todayMonth)) {
      setSelectedMonth(`${newYear}-${String(newMonth).padStart(2, "0")}`);
    } else {
      toast.error("Cannot go beyond current month");
    }
  }, [selectedMonth]);

  const goPrevYear = useCallback(() => {
    setSelectedYear((prev) => prev - 1);
  }, []);

  const goNextYear = useCallback(() => {
    const currentYear = new Date().getFullYear();
    if (selectedYear < currentYear) {
      setSelectedYear((prev) => prev + 1);
    } else {
      toast.error("Cannot go beyond current year");
    }
  }, [selectedYear]);

  const getProductPrevData = useCallback((productId) => {
    const prev = previousSalesData.find((p) => p.productId === productId);
    return prev ? prev.totalQuantity : 0;
  }, [previousSalesData]);

  const getTrend = useCallback((current, previous) => {
    if (previous === 0) return current > 0 ? "up" : "neutral";
    if (current > previous) return "up";
    if (current < previous) return "down";
    return "neutral";
  }, []);

  const getTrendPercent = useCallback((current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }, []);

  const getProductCategoryId = useCallback((productId) => {
    const product = products.find((p) => p._id === productId);
    return product?.categoryId?._id || product?.categoryId || null;
  }, [products]);

  // ✅ MEMOIZED FILTERS
  const filteredSalesData = useMemo(() => {
    if (!selectedCategory) return salesData;
    return salesData.filter((item) => {
      const catId = getProductCategoryId(item.productId);
      return catId === selectedCategory;
    });
  }, [salesData, selectedCategory, getProductCategoryId]);

  // ✅ Chart Data
  const chartData = useMemo(() => {
    return filteredSalesData.map((item) => ({
      name: item.name,
      quantity: item.totalQuantity,
      revenue: item.totalRevenue,
    }));
  }, [filteredSalesData]);

  // ✅ Category Distribution for Pie Chart
  const categoryDistribution = useMemo(() => {
    const dist = {};
    filteredSalesData.forEach((item) => {
      const catId = getProductCategoryId(item.productId);
      const category = categories.find((c) => c._id === catId);
      const catName = category?.name || "Uncategorized";
      if (!dist[catName]) {
        dist[catName] = 0;
      }
      dist[catName] += item.totalQuantity;
    });
    return Object.entries(dist).map(([name, value]) => ({ name, value }));
  }, [filteredSalesData, categories, getProductCategoryId]);

  // ✅ Colors for Pie Chart
  const COLORS = ["#4f46e5", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

  const totalRevenue = useMemo(
    () => filteredSalesData.reduce((sum, item) => sum + item.totalRevenue, 0),
    [filteredSalesData]
  );

  const totalQuantity = useMemo(
    () => filteredSalesData.reduce((sum, item) => sum + item.totalQuantity, 0),
    [filteredSalesData]
  );

  const totalProducts = useMemo(() => filteredSalesData.length, [filteredSalesData]);

  // ✅ Top 5 products
  const topProducts = useMemo(() => {
    return [...filteredSalesData]
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, 5);
  }, [filteredSalesData]);

  // ✅ Format date range display
  const getDateRangeDisplay = () => {
    if (useCustomRange) {
      return `${customStartDate} to ${customEndDate}`;
    }
    if (viewType === "daily") {
      return selectedDate;
    }
    if (viewType === "monthly") {
      const [year, month] = selectedMonth.split("-");
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${monthNames[parseInt(month) - 1]} ${year}`;
    }
    return selectedYear.toString();
  };

  return (
    <div className="space-y-6 relative">
      {/* ✅ Super Smooth Refresh Indicator */}
      <AnimatePresence>
        {refreshing && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-20 right-6 z-50"
          >
            <div className="bg-indigo-600 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Updating insights...
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
            Sales Insights
          </h1>
          <p className="text-gray-500 mt-1">
            Analyze product sales performance & trends
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="flex bg-white dark:bg-gray-800 p-1 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            {["daily", "monthly", "yearly"].map((type) => (
              <button
                key={type}
                onClick={() => {
                  setViewType(type);
                  setUseCustomRange(false);
                }}
                className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 capitalize ${
                  viewType === type && !useCustomRange
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-gray-500 hover:text-indigo-600"
                }`}
              >
                {type}
              </button>
            ))}
            <button
              onClick={() => setUseCustomRange(!useCustomRange)}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 capitalize flex items-center gap-1 ${
                useCustomRange
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-gray-500 hover:text-indigo-600"
              }`}
            >
              <FiCalendar className="text-sm" />
              Custom
            </button>
          </div>
        </div>
      </div>

      {/* Custom Date Range */}
      {useCustomRange && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">From:</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                max={customEndDate}
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">To:</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                min={customStartDate}
                max={new Date().toISOString().split("T")[0]}
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <button
              onClick={() => fetchAnalytics(false)}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition"
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {/* Period Display */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <FiCalendar className="text-indigo-500" />
        <span>Showing data for: <strong className="text-gray-700 dark:text-gray-300">{getDateRangeDisplay()}</strong></span>
        {selectedCategory && (
          <span className="flex items-center gap-1 ml-2">
            <FiTag className="text-indigo-500" />
            <span className="text-indigo-600 dark:text-indigo-400">{categories.find(c => c._id === selectedCategory)?.name}</span>
          </span>
        )}
      </div>

      {/* Combined Row: Select Period + Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Select Period Card */}
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <FiCalendar className="text-white text-lg" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-indigo-200 uppercase tracking-wide font-medium">
                Select Period
              </p>

              {!useCustomRange && viewType === "daily" && (
                <div className="flex items-center gap-1 mt-2">
                  <button onClick={goPrevDay} className="p-1.5 rounded-lg hover:bg-white/10 transition">
                    <FiChevronLeft className="text-base" />
                  </button>
                  <input
                    type="date"
                    value={selectedDate}
                    max={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="flex-1 border border-white/30 bg-white/10 rounded-xl px-3 py-1.5 text-sm text-white outline-none focus:ring-2 focus:ring-white/50"
                  />
                  <button onClick={goNextDay} className="p-1.5 rounded-lg hover:bg-white/10 transition">
                    <FiChevronRight className="text-base" />
                  </button>
                </div>
              )}

              {!useCustomRange && viewType === "monthly" && (
                <div className="flex items-center gap-1 mt-2">
                  <button onClick={goPrevMonth} className="p-1.5 rounded-lg hover:bg-white/10 transition">
                    <FiChevronLeft className="text-base" />
                  </button>
                  <input
                    type="month"
                    value={selectedMonth}
                    max={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="flex-1 border border-white/30 bg-white/10 rounded-xl px-3 py-1.5 text-sm text-white outline-none focus:ring-2 focus:ring-white/50"
                  />
                  <button onClick={goNextMonth} className="p-1.5 rounded-lg hover:bg-white/10 transition">
                    <FiChevronRight className="text-base" />
                  </button>
                </div>
              )}

              {!useCustomRange && viewType === "yearly" && (
                <div className="flex items-center gap-1 mt-2">
                  <button onClick={goPrevYear} className="p-1.5 rounded-lg hover:bg-white/10 transition">
                    <FiChevronLeft className="text-base" />
                  </button>
                  <input
                    type="number"
                    min="2020"
                    max={new Date().getFullYear()}
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="w-24 border border-white/30 bg-white/10 rounded-xl px-3 py-1.5 text-sm text-white outline-none focus:ring-2 focus:ring-white/50 text-center"
                  />
                  <button onClick={goNextYear} className="p-1.5 rounded-lg hover:bg-white/10 transition">
                    <FiChevronRight className="text-base" />
                  </button>
                </div>
              )}

              {useCustomRange && (
                <div className="mt-2 text-xs text-indigo-200">
                  {customStartDate} to {customEndDate}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ✅ Summary Cards */}
        {!initialLoading && filteredSalesData.length > 0 && (
          <>
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-emerald-200 uppercase tracking-wide font-medium">
                    Total Revenue
                  </p>
                  <p className="text-2xl font-bold mt-2">
                    ₹{totalRevenue.toLocaleString()}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                  <FaRupeeSign className="text-white text-xl" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-indigo-200 uppercase tracking-wide font-medium">
                    Products Sold
                  </p>
                  <p className="text-2xl font-bold mt-2">{totalQuantity}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                  <FiShoppingCart className="text-white text-xl" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-amber-200 uppercase tracking-wide font-medium">
                    Active Products
                  </p>
                  <p className="text-2xl font-bold mt-2">{totalProducts}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                  <FiBox className="text-white text-xl" />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Loading skeletons */}
        {initialLoading && (
          <>
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 shadow-lg">
              <div className="animate-pulse">
                <div className="h-4 bg-white/30 rounded w-24 mb-3"></div>
                <div className="h-8 bg-white/30 rounded w-32"></div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl p-5 shadow-lg">
              <div className="animate-pulse">
                <div className="h-4 bg-white/30 rounded w-24 mb-3"></div>
                <div className="h-8 bg-white/30 rounded w-20"></div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-5 shadow-lg">
              <div className="animate-pulse">
                <div className="h-4 bg-white/30 rounded w-24 mb-3"></div>
                <div className="h-8 bg-white/30 rounded w-20"></div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Charts Section */}
      {!initialLoading && filteredSalesData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Product Sales Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Product Sales</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setChartType("bar")}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                    chartType === "bar"
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                  }`}
                >
                  Bar
                </button>
                <button
                  onClick={() => setChartType("line")}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                    chartType === "line"
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                  }`}
                >
                  Line
                </button>
                <button
                  onClick={() => setChartType("area")}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                    chartType === "area"
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                  }`}
                >
                  Area
                </button>
              </div>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === "bar" && (
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="quantity" fill="#4f46e5" name="Quantity Sold" />
                    <Bar yAxisId="right" dataKey="revenue" fill="#10b981" name="Revenue (₹)" />
                  </BarChart>
                )}
                {chartType === "line" && (
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="quantity" stroke="#4f46e5" name="Quantity Sold" />
                    <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#10b981" name="Revenue (₹)" />
                  </LineChart>
                )}
                {chartType === "area" && (
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Area yAxisId="left" type="monotone" dataKey="quantity" fill="#4f46e5" stroke="#4f46e5" name="Quantity Sold" />
                    <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#10b981" name="Revenue (₹)" />
                  </ComposedChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category Distribution Pie Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Category Distribution</h3>
            {categoryDistribution.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {categoryDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-80 flex items-center justify-center text-gray-500">
                No category data available
              </div>
            )}
          </div>

          {/* Top Products */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 lg:col-span-2">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Top 5 Products</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {topProducts.map((product, index) => {
                const prevQty = getProductPrevData(product.productId);
                const trend = getTrend(product.totalQuantity, prevQty);
                const trendPercent = getTrendPercent(product.totalQuantity, prevQty);
                return (
                  <div key={product.productId} className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-indigo-600 mb-1">#{index + 1}</div>
                    <p className="font-semibold text-gray-800 dark:text-white text-sm truncate">{product.name}</p>
                    <p className="text-xs text-gray-500 mt-1">Sold: {product.totalQuantity}</p>
                    <p className="text-xs text-green-600 font-semibold">₹{product.totalRevenue.toLocaleString()}</p>
                    <div className="mt-2">
                      {trend === "up" && (
                        <span className="text-xs text-green-500 flex items-center justify-center gap-1">
                          <FiTrendingUp /> +{trendPercent}%
                        </span>
                      )}
                      {trend === "down" && (
                        <span className="text-xs text-red-500 flex items-center justify-center gap-1">
                          <FiTrendingDown /> {trendPercent}%
                        </span>
                      )}
                      {trend === "neutral" && (
                        <span className="text-xs text-gray-500">No change</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Category Filter */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <FiLayers className="text-indigo-500 text-sm" />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Filter by Category:
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory("")}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                !selectedCategory
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              <FiTag className="inline mr-1 text-[10px]" />
              All Products
            </button>
            {categories.map((cat) => (
              <button
                key={cat._id}
                onClick={() => setSelectedCategory(cat._id)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  selectedCategory === cat._id
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                <FiTag className="inline mr-1 text-[10px]" />
                {cat.name}
              </button>
            ))}
          </div>
          {selectedCategory && (
            <button
              onClick={() => setSelectedCategory("")}
              className="ml-auto flex items-center gap-1 text-xs text-red-500 hover:text-red-600"
            >
              <FiX /> Clear
            </button>
          )}
        </div>
      </div>

      {/* ✅ Loading / Empty / Products Grid */}
      {initialLoading ? (
        <div className="flex justify-center items-center h-[50vh]">
          <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        </div>
      ) : filteredSalesData.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
            <FiBarChart2 className="text-3xl text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold mb-1">No Sales Data</h2>
          <p className="text-sm text-gray-500">
            No product sales found for the selected period
          </p>
          {selectedCategory && (
            <button
              onClick={() => setSelectedCategory("")}
              className="mt-4 text-sm text-indigo-600 hover:text-indigo-700"
            >
              Clear category filter
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
          <AnimatePresence mode="popLayout">
            {filteredSalesData.map((product) => {
              const prevQty = getProductPrevData(product.productId);
              const trend = getTrend(product.totalQuantity, prevQty);
              const trendPercent = getTrendPercent(product.totalQuantity, prevQty);

              return (
                <motion.div
                  key={product.productId}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                  className="group bg-white dark:bg-slate-800 rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div className="relative w-full aspect-square overflow-hidden bg-slate-100 dark:bg-slate-900">
                    <img
                      src={product.image || "https://via.placeholder.com/200x200?text=No+Image"}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      loading="lazy"
                    />
                    <div className="absolute top-2 right-2">
                      {trend === "up" && (
                        <div className="flex items-center gap-0.5 bg-green-500 text-white px-1.5 py-0.5 rounded-full text-[9px] font-semibold shadow">
                          <FiTrendingUp className="text-[8px]" /> +{trendPercent}%
                        </div>
                      )}
                      {trend === "down" && (
                        <div className="flex items-center gap-0.5 bg-red-500 text-white px-1.5 py-0.5 rounded-full text-[9px] font-semibold shadow">
                          <FiTrendingDown className="text-[8px]" /> {trendPercent}%
                        </div>
                      )}
                      {trend === "neutral" && (
                        <div className="bg-gray-500 text-white px-1.5 py-0.5 rounded-full text-[9px] font-semibold shadow">
                          0%
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-3">
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-white line-clamp-1">
                      {product.name}
                    </h3>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <div className="flex flex-col items-center justify-center bg-indigo-50 dark:bg-indigo-500/10 rounded-xl py-2 px-1">
                        <FiShoppingCart className="text-indigo-500 text-sm mb-1" />
                        <span className="text-[10px] text-slate-500 font-medium">Sold</span>
                        <span className="text-sm font-bold text-indigo-600 mt-0.5">
                          {product.totalQuantity}
                        </span>
                      </div>

                      <div className="flex flex-col items-center justify-center bg-green-50 dark:bg-green-500/10 rounded-xl py-2 px-1">
                        <FaRupeeSign className="text-green-500 text-sm mb-1" />
                        <span className="text-[10px] text-slate-500 font-medium">Revenue</span>
                        <span className="text-sm font-bold text-green-600 mt-0.5 truncate max-w-full">
                          ₹{product.totalRevenue.toLocaleString()}
                        </span>
                      </div>

                      <div className="flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-700/40 rounded-xl py-2 px-1">
                        <svg className="w-4 h-4 text-slate-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-[10px] text-slate-500 font-medium">Previous</span>
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
                          {prevQty}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}