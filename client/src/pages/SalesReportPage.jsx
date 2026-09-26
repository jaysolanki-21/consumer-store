import { useState, useEffect, useMemo } from "react";
import api from "../services/api";
import socket from "../services/socket";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiDollarSign,
  FiShoppingBag,
  FiPackage,
  FiUserCheck,
  FiDownload,
  FiRefreshCw,
  FiMonitor,
  FiFilter,
  FiX,
  FiSearch,
  FiChevronLeft,
  FiChevronRight,
  FiArrowUp,
  FiArrowDown,
  FiFileText,
  FiBarChart2,
  FiLayers,
  FiCalendar,
  FiClock,
  FiCreditCard,
  FiUsers,
  FiTrendingUp,
  FiAward,
} from "react-icons/fi";
import { FaRupeeSign } from "react-icons/fa";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100];

/* ---------- REPORT VIEWS ---------- */
const REPORT_VIEWS = [
  { key: "product", label: "Product-wise", icon: FiPackage, color: "indigo" },
  { key: "category", label: "Category-wise", icon: FiLayers, color: "amber" },
  { key: "counter", label: "Counter-wise", icon: FiMonitor, color: "purple" },
  { key: "staff", label: "Staff-wise", icon: FiUserCheck, color: "green" },
  { key: "payment", label: "Payment-wise", icon: FiCreditCard, color: "blue" },
  { key: "daily", label: "Daily Summary", icon: FiCalendar, color: "rose" },
  { key: "hourly", label: "Hourly Sales", icon: FiClock, color: "orange" },
  { key: "top", label: "Top Products", icon: FiAward, color: "yellow" },
  { key: "pnl", label: "Profit & Loss", icon: FiTrendingUp, color: "teal" },
  { key: "orders", label: "Confirmed Orders", icon: FiUserCheck, color: "violet" },
];

export default function SalesReportPage() {
  const getTodayIST = () => {
    const f = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return f.format(new Date());
  };

  /* ---------- STATE ---------- */
  const [allOrders, setAllOrders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Filters
  const [filterDateRange, setFilterDateRange] = useState("today");
  const [customStartDate, setCustomStartDate] = useState(getTodayIST());
  const [customEndDate, setCustomEndDate] = useState(getTodayIST());
  const [filterCounter, setFilterCounter] = useState("all");
  const [filterPayment, setFilterPayment] = useState("all");
  const [filterStatus, setFilterStatus] = useState("Confirmed");
  const [filterCategory, setFilterCategory] = useState("all");

  // Search
  const [searchTerm, setSearchTerm] = useState("");

  // View
  const [activeView, setActiveView] = useState("product");

  // Sorting
  const [sortConfig, setSortConfig] = useState({ key: "revenue", order: "desc" });

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  /* ---------- HELPERS ---------- */
  const getCounterName = (id) => {
    const map = {
      "counter-1": "Counter 1",
      "counter-2": "Counter 2",
      "counter-3": "Counter 3",
      "counter-4": "Counter 4",
      "counter-5": "Counter 5",
    };
    return map[id] || id || "—";
  };

  const getCategoryName = (id) => {
    if (!id) return "Uncategorized";
    const cat = categories.find((c) => c._id === id);
    return cat?.name || "Uncategorized";
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-");
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  /* ---------- FETCH ---------- */
  const fetchOrders = async (silent = false) => {
    try {
      if (!silent) setInitialLoading(true);
      else setRefreshing(true);
      const { data } = await api.get("/orders");
      setAllOrders(data);
    } catch (err) {
      if (!silent) toast.error("Failed to load orders");
    } finally {
      if (!silent) setInitialLoading(false);
      else setTimeout(() => setRefreshing(false), 1200);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data } = await api.get("/categories");
      setCategories(data);
    } catch (err) {
      console.error("Failed to load categories");
    }
  };

  useEffect(() => {
    fetchOrders(false);
    fetchCategories();
  }, []);

  useEffect(() => {
    const onChange = () => fetchOrders(true);
    socket.on("orderConfirmed", onChange);
    socket.on("orderCancelled", onChange);
    socket.on("newOrder", onChange);
    socket.on("stockUpdated", onChange);
    return () => {
      socket.off("orderConfirmed", onChange);
      socket.off("orderCancelled", onChange);
      socket.off("newOrder", onChange);
      socket.off("stockUpdated", onChange);
    };
  }, []);

  /* ---------- UNIQUE COUNTERS ---------- */
  const uniqueCounters = useMemo(() => {
    const s = new Set();
    allOrders.forEach((o) => o.counterId && s.add(o.counterId));
    return Array.from(s);
  }, [allOrders]);

  /* ---------- FILTERED ORDERS ---------- */
  const filteredOrders = useMemo(() => {
    let list = [...allOrders];

    if (filterDateRange === "today") {
      const today = getTodayIST();
      list = list.filter(
        (o) => new Date(o.createdAt).toISOString().split("T")[0] === today,
      );
    } else if (filterDateRange === "week") {
      const w = new Date();
      w.setDate(w.getDate() - 7);
      list = list.filter((o) => new Date(o.createdAt) >= w);
    } else if (filterDateRange === "month") {
      const m = new Date();
      m.setMonth(m.getMonth() - 1);
      list = list.filter((o) => new Date(o.createdAt) >= m);
    } else if (filterDateRange === "custom") {
      list = list.filter((o) => {
        const d = new Date(o.createdAt).toISOString().split("T")[0];
        return d >= customStartDate && d <= customEndDate;
      });
    }

    if (filterCounter !== "all")
      list = list.filter((o) => o.counterId === filterCounter);

    if (filterPayment !== "all")
      list = list.filter((o) => o.payment?.method === filterPayment);

    if (filterStatus !== "all")
      list = list.filter((o) => o.status === filterStatus);

    if (filterCategory !== "all") {
      list = list.filter((o) =>
        o.items?.some((it) => {
          const catId =
            it.productId?.categoryId?._id ||
            it.productId?.categoryId ||
            it.categoryId?._id ||
            it.categoryId;
          return catId === filterCategory;
        }),
      );
    }

    return list;
  }, [
    allOrders,
    filterDateRange,
    customStartDate,
    customEndDate,
    filterCounter,
    filterPayment,
    filterStatus,
    filterCategory,
  ]);

  /* ---------- SEARCH FILTER ---------- */
  const searchedOrders = useMemo(() => {
    if (!searchTerm.trim()) return filteredOrders;
    const term = searchTerm.toLowerCase().trim();
    return filteredOrders.filter((o) => {
      const idMatch = o._id.toLowerCase().includes(term);
      const counterMatch = getCounterName(o.counterId).toLowerCase().includes(term);
      const staffMatch = (o.confirmedBy?.name || "").toLowerCase().includes(term);
      const productMatch = o.items?.some((it) =>
        (it.productId?.name || it.name || "").toLowerCase().includes(term),
      );
      const catMatch = o.items?.some((it) =>
        getCategoryName(it.productId?.categoryId?._id || it.productId?.categoryId)
          .toLowerCase()
          .includes(term),
      );
      return idMatch || counterMatch || staffMatch || productMatch || catMatch;
    });
  }, [filteredOrders, searchTerm, categories]);

  /* ---------- CONFIRMED ---------- */
  const confirmedOrders = useMemo(
    () => searchedOrders.filter((o) => o.status === "Confirmed"),
    [searchedOrders],
  );

  /* ---------- BUILD ALL REPORTS ---------- */
  const reports = useMemo(() => {
    // ---- 1. Product-wise
    const productMap = {};
    let totalIncome = 0;
    let totalCost = 0;

    confirmedOrders.forEach((order) => {
      let orderAmt = 0;
      order.items.forEach((it) => {
        const pid = it.productId?._id || it.productId || "unknown";
        const name = it.productId?.name || it.name || "Deleted Product";
        const catId =
          it.productId?.categoryId?._id ||
          it.productId?.categoryId ||
          it.categoryId?._id ||
          it.categoryId;

        if (filterCategory !== "all" && catId !== filterCategory) return;

        if (!productMap[pid])
          productMap[pid] = {
            productId: pid,
            name,
            categoryId: catId,
            categoryName: getCategoryName(catId),
            quantity: 0,
            revenue: 0,
            cost: 0,
            profit: 0,
            orders: 0,
          };

        const rev = it.quantity * (it.sellingPrice || it.price || 0);
        const cost = it.quantity * Number(it.costPrice || 0);

        productMap[pid].quantity += it.quantity;
        productMap[pid].revenue += rev;
        productMap[pid].cost += cost;
        productMap[pid].profit = productMap[pid].revenue - productMap[pid].cost;
        productMap[pid].orders += 1;

        totalCost += cost;
        orderAmt += rev;
      });
      totalIncome += orderAmt;
    });
    const productWise = Object.values(productMap);

    // ---- 2. Category-wise
    const categoryMap = {};
    productWise.forEach((p) => {
      const key = p.categoryId || "uncategorized";
      if (!categoryMap[key])
        categoryMap[key] = {
          categoryId: key,
          categoryName: p.categoryName,
          products: 0,
          quantity: 0,
          revenue: 0,
          cost: 0,
          profit: 0,
        };
      categoryMap[key].products += 1;
      categoryMap[key].quantity += p.quantity;
      categoryMap[key].revenue += p.revenue;
      categoryMap[key].cost += p.cost;
      categoryMap[key].profit += p.profit;
    });
    const categoryWise = Object.values(categoryMap);

    // ---- 3. Counter-wise
    const counterMap = {};
    confirmedOrders.forEach((o) => {
      const key = o.counterId || "unknown";
      if (!counterMap[key])
        counterMap[key] = {
          counterId: key,
          counterName: getCounterName(key),
          orders: 0,
          revenue: 0,
          avgOrderValue: 0,
          itemsSold: 0,
        };
      counterMap[key].orders += 1;
      counterMap[key].revenue += o.totalAmount || 0;
      counterMap[key].itemsSold += o.items?.reduce((s, it) => s + it.quantity, 0) || 0;
    });
    Object.values(counterMap).forEach((c) => {
      c.avgOrderValue = c.orders ? c.revenue / c.orders : 0;
    });
    const counterWise = Object.values(counterMap);

    // ---- 4. Staff-wise
    const staffMap = {};
    confirmedOrders.forEach((o) => {
      const name = o.confirmedBy?.name || "System";
      const id = o.confirmedBy?._id || "system";
      if (!staffMap[id])
        staffMap[id] = {
          staffId: id,
          staffName: name,
          orders: 0,
          revenue: 0,
          avgOrderValue: 0,
        };
      staffMap[id].orders += 1;
      staffMap[id].revenue += o.totalAmount || 0;
    });
    Object.values(staffMap).forEach((s) => {
      s.avgOrderValue = s.orders ? s.revenue / s.orders : 0;
    });
    const staffWise = Object.values(staffMap);

    // ---- 5. Payment-wise
    const paymentMap = {};
    confirmedOrders.forEach((o) => {
      const method = o.payment?.method || o.paymentMethod || "Cash";
      if (!paymentMap[method])
        paymentMap[method] = {
          method,
          orders: 0,
          revenue: 0,
          percentage: 0,
        };
      paymentMap[method].orders += 1;
      paymentMap[method].revenue += o.totalAmount || 0;
    });
    const totalRev = Object.values(paymentMap).reduce((s, p) => s + p.revenue, 0);
    Object.values(paymentMap).forEach((p) => {
      p.percentage = totalRev ? (p.revenue / totalRev) * 100 : 0;
    });
    const paymentWise = Object.values(paymentMap);

    // ---- 6. Daily Summary
    const dailyMap = {};
    confirmedOrders.forEach((o) => {
      const date = new Date(o.createdAt).toLocaleDateString("en-CA", {
        timeZone: "Asia/Kolkata",
      });
      if (!dailyMap[date])
        dailyMap[date] = {
          date,
          orders: 0,
          revenue: 0,
          itemsSold: 0,
          avgOrderValue: 0,
        };
      dailyMap[date].orders += 1;
      dailyMap[date].revenue += o.totalAmount || 0;
      dailyMap[date].itemsSold += o.items?.reduce((s, it) => s + it.quantity, 0) || 0;
    });
    Object.values(dailyMap).forEach((d) => {
      d.avgOrderValue = d.orders ? d.revenue / d.orders : 0;
    });
    const dailyWise = Object.values(dailyMap).sort((a, b) =>
      a.date < b.date ? 1 : -1,
    );

    // ---- 7. Hourly Sales
    const hourlyMap = {};
    for (let h = 0; h < 24; h++) {
      hourlyMap[h] = { hour: h, orders: 0, revenue: 0 };
    }
    confirmedOrders.forEach((o) => {
      const hour = parseInt(
        new Date(o.createdAt).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          hour12: false,
        }),
      );
      hourlyMap[hour].orders += 1;
      hourlyMap[hour].revenue += o.totalAmount || 0;
    });
    const hourlySales = Object.values(hourlyMap).filter(
      (h) => h.orders > 0 || h.revenue > 0,
    );

    // ---- 8. Top Products
    const topProducts = [...productWise]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // ---- 9. Profit & Loss
    const pnl = {
      totalRevenue: totalIncome,
      totalCost: totalCost,
      grossProfit: totalIncome - totalCost,
      profitMargin: totalIncome ? ((totalIncome - totalCost) / totalIncome) * 100 : 0,
      totalOrders: confirmedOrders.length,
      avgOrderValue: confirmedOrders.length
        ? totalIncome / confirmedOrders.length
        : 0,
      avgCostPerOrder: confirmedOrders.length
        ? totalCost / confirmedOrders.length
        : 0,
      totalItemsSold: confirmedOrders.reduce(
        (s, o) => s + (o.items?.reduce((a, it) => a + it.quantity, 0) || 0),
        0,
      ),
    };

    return {
      productWise,
      categoryWise,
      counterWise,
      staffWise,
      paymentWise,
      dailyWise,
      hourlySales,
      topProducts,
      pnl,
      confirmedOrders,
      totalIncome,
      totalCost,
    };
  }, [confirmedOrders, filterCategory, categories]);

  /* ---------- GET CURRENT DATASET FOR VIEW ---------- */
  const currentData = useMemo(() => {
    switch (activeView) {
      case "product":
        return reports.productWise;
      case "category":
        return reports.categoryWise;
      case "counter":
        return reports.counterWise;
      case "staff":
        return reports.staffWise;
      case "payment":
        return reports.paymentWise;
      case "daily":
        return reports.dailyWise;
      case "hourly":
        return reports.hourlySales;
      case "top":
        return reports.topProducts;
      case "orders":
        return reports.confirmedOrders;
      case "pnl":
        return [];
      default:
        return [];
    }
  }, [activeView, reports]);

  /* ---------- SORT ---------- */
  const sortedData = useMemo(() => {
    const arr = [...currentData];
    const { key, order } = sortConfig;
    arr.sort((a, b) => {
      let av = a[key];
      let bv = b[key];
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av < bv) return order === "asc" ? -1 : 1;
      if (av > bv) return order === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [currentData, sortConfig]);

  /* ---------- PAGINATION ---------- */
  const totalItems = sortedData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const pagedData = useMemo(
    () => sortedData.slice(startIndex, startIndex + pageSize),
    [sortedData, startIndex, pageSize],
  );

  useEffect(() => {
    setPage(1);
  }, [activeView, searchTerm, filterDateRange, filterCounter, filterPayment, filterCategory, pageSize]);

  /* ---------- SORT TOGGLE ---------- */
  const toggleSort = (key) => {
    setSortConfig((p) =>
      p.key === key
        ? { key, order: p.order === "asc" ? "desc" : "asc" }
        : { key, order: "asc" },
    );
  };

  /* ---------- RESET ---------- */
  const resetFilters = () => {
    setFilterDateRange("today");
    setCustomStartDate(getTodayIST());
    setCustomEndDate(getTodayIST());
    setFilterCounter("all");
    setFilterPayment("all");
    setFilterStatus("Confirmed");
    setFilterCategory("all");
    setSearchTerm("");
    setSortConfig({ key: "revenue", order: "desc" });
    setPage(1);
  };

  /* ---------- CSV EXPORT ---------- */
  const downloadCSV = () => {
    try {
      const rows = [];
      // dynamic header from first row keys (excluding internal fields)
      if (sortedData.length === 0) {
        toast.error("No data to export");
        return;
      }
      const sample = sortedData[0];
      const keys = Object.keys(sample).filter(
        (k) => !k.toLowerCase().includes("id") || k === "orderId" || k === "productId",
      );
      rows.push(keys);
      sortedData.forEach((item) =>
        rows.push(keys.map((k) => item[k] ?? "")),
      );

      const csv = rows
        .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
        .join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Report_${activeView}_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV downloaded");
    } catch (e) {
      toast.error("Failed to export CSV");
    }
  };

  /* ---------- PDF EXPORT ---------- */
  const downloadPDF = () => {
    setDownloadingPdf(true);
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const m = 12;

      doc.setFillColor(79, 70, 229);
      doc.rect(0, 0, pageW, 26, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      const viewLabel = REPORT_VIEWS.find((v) => v.key === activeView)?.label || activeView;
      doc.text(`${viewLabel} Report`, m, 12);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(
        `Generated: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`,
        pageW - m,
        12,
        { align: "right" },
      );

      let fTxt = `Date: ${filterDateRange}`;
      if (filterCounter !== "all") fTxt += ` | Counter: ${getCounterName(filterCounter)}`;
      if (filterPayment !== "all") fTxt += ` | Payment: ${filterPayment}`;
      if (filterCategory !== "all") fTxt += ` | Category: ${getCategoryName(filterCategory)}`;
      if (searchTerm) fTxt += ` | Search: ${searchTerm}`;
      doc.text(fTxt, pageW - m, 19, { align: "right" });

      let y = 32;

      // Summary cards
      const cw = (pageW - m * 2 - 8) / 3;
      [
        { l: "Total Orders", v: String(reports.confirmedOrders.length), c: [79, 70, 229] },
        { l: "Total Revenue", v: `Rs. ${reports.totalIncome.toLocaleString("en-IN")}`, c: [16, 185, 129] },
        { l: "Gross Profit", v: `Rs. ${(reports.totalIncome - reports.totalCost).toLocaleString("en-IN")}`, c: [124, 58, 237] },
      ].forEach((card, i) => {
        const x = m + i * (cw + 4);
        doc.setFillColor(...card.c);
        doc.roundedRect(x, y, cw, 20, 3, 3, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(card.l, x + 4, y + 6);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text(card.v, x + 4, y + 14);
      });
      y += 26;

      // Table columns per view
      const tableConfig = {
        product: {
          head: [["#", "Product", "Category", "Qty", "Revenue", "Cost", "Profit"]],
          body: sortedData.map((p, i) => [
            i + 1,
            p.name,
            p.categoryName,
            p.quantity,
            p.revenue.toLocaleString("en-IN"),
            p.cost.toLocaleString("en-IN"),
            p.profit.toLocaleString("en-IN"),
          ]),
        },
        category: {
          head: [["#", "Category", "Products", "Qty Sold", "Revenue", "Cost", "Profit"]],
          body: sortedData.map((c, i) => [
            i + 1,
            c.categoryName,
            c.products,
            c.quantity,
            c.revenue.toLocaleString("en-IN"),
            c.cost.toLocaleString("en-IN"),
            c.profit.toLocaleString("en-IN"),
          ]),
        },
        counter: {
          head: [["#", "Counter", "Orders", "Items Sold", "Revenue", "Avg Order"]],
          body: sortedData.map((c, i) => [
            i + 1,
            c.counterName,
            c.orders,
            c.itemsSold,
            c.revenue.toLocaleString("en-IN"),
            `Rs. ${c.avgOrderValue.toFixed(0)}`,
          ]),
        },
        staff: {
          head: [["#", "Staff", "Orders", "Revenue", "Avg Order Value"]],
          body: sortedData.map((s, i) => [
            i + 1,
            s.staffName,
            s.orders,
            s.revenue.toLocaleString("en-IN"),
            `Rs. ${s.avgOrderValue.toFixed(0)}`,
          ]),
        },
        payment: {
          head: [["#", "Payment Method", "Orders", "Revenue", "% Share"]],
          body: sortedData.map((p, i) => [
            i + 1,
            p.method,
            p.orders,
            p.revenue.toLocaleString("en-IN"),
            `${p.percentage.toFixed(1)}%`,
          ]),
        },
        daily: {
          head: [["#", "Date", "Orders", "Items Sold", "Revenue", "Avg Order"]],
          body: sortedData.map((d, i) => [
            i + 1,
            d.date,
            d.orders,
            d.itemsSold,
            d.revenue.toLocaleString("en-IN"),
            `Rs. ${d.avgOrderValue.toFixed(0)}`,
          ]),
        },
        hourly: {
          head: [["#", "Hour", "Orders", "Revenue"]],
          body: sortedData.map((h, i) => [
            i + 1,
            `${String(h.hour).padStart(2, "0")}:00`,
            h.orders,
            h.revenue.toLocaleString("en-IN"),
          ]),
        },
        top: {
          head: [["#", "Product", "Category", "Qty", "Revenue", "Profit"]],
          body: sortedData.map((p, i) => [
            i + 1,
            p.name,
            p.categoryName,
            p.quantity,
            p.revenue.toLocaleString("en-IN"),
            p.profit.toLocaleString("en-IN"),
          ]),
        },
        orders: {
          head: [["#", "Order ID", "Time", "Counter", "Amount", "Staff"]],
          body: sortedData.map((o, i) => [
            i + 1,
            `#${o._id.slice(-8)}`,
            new Date(o.createdAt).toLocaleString("en-IN", {
              timeZone: "Asia/Kolkata",
              hour12: true,
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            }),
            getCounterName(o.counterId),
            o.totalAmount.toLocaleString("en-IN"),
            o.confirmedBy?.name || "System",
          ]),
        },
      };

      if (activeView === "pnl") {
        // P&L special layout
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(31, 41, 55);
        doc.text("Profit & Loss Breakdown", m, y);
        y += 6;

        autoTable(doc, {
          startY: y,
          margin: { left: m, right: m },
          head: [["Metric", "Value"]],
          body: [
            ["Total Orders", reports.pnl.totalOrders],
            ["Total Items Sold", reports.pnl.totalItemsSold],
            ["Total Revenue", `Rs. ${reports.pnl.totalRevenue.toLocaleString("en-IN")}`],
            ["Total Cost", `Rs. ${reports.pnl.totalCost.toLocaleString("en-IN")}`],
            ["Gross Profit", `Rs. ${reports.pnl.grossProfit.toLocaleString("en-IN")}`],
            ["Profit Margin", `${reports.pnl.profitMargin.toFixed(2)}%`],
            ["Average Order Value", `Rs. ${reports.pnl.avgOrderValue.toFixed(0)}`],
            ["Average Cost per Order", `Rs. ${reports.pnl.avgCostPerOrder.toFixed(0)}`],
          ],
          headStyles: { fillColor: [79, 70, 229], textColor: 255, fontSize: 10 },
          bodyStyles: { fontSize: 10, textColor: 31 },
          alternateRowStyles: { fillColor: [248, 250, 252] },
        });
      } else if (tableConfig[activeView]) {
        autoTable(doc, {
          startY: y,
          margin: { left: m, right: m },
          head: tableConfig[activeView].head,
          body: tableConfig[activeView].body,
          headStyles: { fillColor: [79, 70, 229], textColor: 255, fontSize: 9 },
          bodyStyles: { fontSize: 8, textColor: 31 },
          alternateRowStyles: { fillColor: [248, 250, 252] },
        });
      }

      const total = doc.internal.getNumberOfPages();
      for (let p = 1; p <= total; p++) {
        doc.setPage(p);
        doc.setDrawColor(226, 232, 240);
        doc.line(m, pageH - 10, pageW - m, pageH - 10);
        doc.setFontSize(8);
        doc.setTextColor(107, 114, 128);
        doc.text("Consumer Store – Confidential", m, pageH - 5);
        doc.text(`Page ${p} of ${total}`, pageW - m, pageH - 5, { align: "right" });
      }

      doc.save(`${viewLabel}_${Date.now()}.pdf`);
      toast.success("PDF downloaded");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF");
    } finally {
      setDownloadingPdf(false);
    }
  };

  /* ---------- SORT HEADER ---------- */
  const SortHeader = ({ label, sortKey, align = "left" }) => (
    <th
      onClick={() => toggleSort(sortKey)}
      className={`px-3 py-3 text-${align} text-xs font-semibold uppercase text-gray-500 dark:text-gray-300 cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-600 transition whitespace-nowrap`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortConfig.key === sortKey ? (
          sortConfig.order === "asc" ? (
            <FiArrowUp className="text-indigo-500" />
          ) : (
            <FiArrowDown className="text-indigo-500" />
          )
        ) : (
          <span className="opacity-30">
            <FiArrowDown />
          </span>
        )}
      </span>
    </th>
  );

  /* ---------- PAGINATION FOOTER ---------- */
  const PaginationFooter = () => {
    const pages = [];
    const max = 5;
    let s = Math.max(1, page - Math.floor(max / 2));
    let e = Math.min(totalPages, s + max - 1);
    if (e - s < max - 1) s = Math.max(1, e - max + 1);
    for (let i = s; i <= e; i++) pages.push(i);

    return (
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
        <p className="text-sm text-gray-500">
          Showing <span className="font-semibold">{totalItems === 0 ? 0 : startIndex + 1}–{endIndex}</span> of{" "}
          <span className="font-semibold">{totalItems}</span> records
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 mr-2">
            <span className="text-sm text-gray-500 whitespace-nowrap">Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="h-9 px-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm disabled:opacity-40 flex items-center gap-1"
          >
            <FiChevronLeft /> Prev
          </button>
          {s > 1 && (
            <>
              <button
                onClick={() => setPage(1)}
                className={`h-9 w-9 rounded-lg text-sm ${page === 1 ? "bg-indigo-600 text-white" : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"}`}
              >
                1
              </button>
              {s > 2 && <span className="px-1 text-gray-400">…</span>}
            </>
          )}
          {pages.map((n) => (
            <button
              key={n}
              onClick={() => setPage(n)}
              className={`h-9 w-9 rounded-lg text-sm ${n === page ? "bg-indigo-600 text-white" : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"}`}
            >
              {n}
            </button>
          ))}
          {e < totalPages && (
            <>
              {e < totalPages - 1 && <span className="px-1 text-gray-400">…</span>}
              <button
                onClick={() => setPage(totalPages)}
                className={`h-9 w-9 rounded-lg text-sm ${page === totalPages ? "bg-indigo-600 text-white" : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"}`}
              >
                {totalPages}
              </button>
            </>
          )}
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm disabled:opacity-40 flex items-center gap-1"
          >
            Next <FiChevronRight />
          </button>
        </div>
      </div>
    );
  };

  /* ---------- TABLE RENDERER ---------- */
  const renderTable = () => {
    if (activeView === "pnl") {
      const pnl = reports.pnl;
      return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold flex items-center gap-2">
              <FiTrendingUp /> Profit & Loss Breakdown
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
            {[
              { l: "Total Orders", v: pnl.totalOrders, cls: "bg-indigo-50 text-indigo-700" },
              { l: "Total Items Sold", v: pnl.totalItemsSold, cls: "bg-amber-50 text-amber-700" },
              { l: "Total Revenue", v: `₹${pnl.totalRevenue.toLocaleString()}`, cls: "bg-emerald-50 text-emerald-700" },
              { l: "Total Cost", v: `₹${pnl.totalCost.toLocaleString()}`, cls: "bg-rose-50 text-rose-700" },
              { l: "Gross Profit", v: `₹${pnl.grossProfit.toLocaleString()}`, cls: "bg-cyan-50 text-cyan-700" },
              { l: "Profit Margin", v: `${pnl.profitMargin.toFixed(2)}%`, cls: "bg-teal-50 text-teal-700" },
              { l: "Avg Order Value", v: `₹${pnl.avgOrderValue.toFixed(0)}`, cls: "bg-purple-50 text-purple-700" },
              { l: "Avg Cost per Order", v: `₹${pnl.avgCostPerOrder.toFixed(0)}`, cls: "bg-pink-50 text-pink-700" },
            ].map((c, i) => (
              <div key={i} className={`rounded-xl p-4 ${c.cls}`}>
                <p className="text-xs font-medium opacity-80">{c.l}</p>
                <p className="text-2xl font-bold mt-1">{c.v}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (activeView === "product" || activeView === "top") {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold flex items-center gap-2">
              <FiPackage /> {activeView === "top" ? "Top 10 Products" : "Product-wise Sales"} ({sortedData.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <SortHeader label="Product" sortKey="name" />
                  <SortHeader label="Category" sortKey="categoryName" />
                  <SortHeader label="Qty Sold" sortKey="quantity" align="center" />
                  <SortHeader label="Revenue" sortKey="revenue" align="right" />
                  <SortHeader label="Cost" sortKey="cost" align="right" />
                  <SortHeader label="Profit" sortKey="profit" align="right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {pagedData.length === 0 ? (
                  <tr><td colSpan="6" className="px-4 py-8 text-center text-gray-500">No data.</td></tr>
                ) : pagedData.map((p) => (
                  <tr key={p.productId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{p.name}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs">
                        <FiLayers className="text-xs" /> {p.categoryName}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">{p.quantity}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">₹{p.revenue.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-rose-600">₹{p.cost.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-semibold text-cyan-700">₹{p.profit.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationFooter />
        </div>
      );
    }

    if (activeView === "category") {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold flex items-center gap-2">
              <FiLayers /> Category-wise Sales ({sortedData.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <SortHeader label="Category" sortKey="categoryName" />
                  <SortHeader label="Products" sortKey="products" align="center" />
                  <SortHeader label="Qty Sold" sortKey="quantity" align="center" />
                  <SortHeader label="Revenue" sortKey="revenue" align="right" />
                  <SortHeader label="Cost" sortKey="cost" align="right" />
                  <SortHeader label="Profit" sortKey="profit" align="right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {pagedData.map((c) => (
                  <tr key={c.categoryId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs">
                        <FiLayers className="text-xs" /> {c.categoryName}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">{c.products}</td>
                    <td className="px-4 py-3 text-center">{c.quantity}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">₹{c.revenue.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-rose-600">₹{c.cost.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-semibold text-cyan-700">₹{c.profit.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationFooter />
        </div>
      );
    }

    if (activeView === "counter") {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold flex items-center gap-2">
              <FiMonitor /> Counter-wise Sales ({sortedData.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <SortHeader label="Counter" sortKey="counterName" />
                  <SortHeader label="Orders" sortKey="orders" align="center" />
                  <SortHeader label="Items Sold" sortKey="itemsSold" align="center" />
                  <SortHeader label="Revenue" sortKey="revenue" align="right" />
                  <SortHeader label="Avg Order" sortKey="avgOrderValue" align="right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {pagedData.map((c) => (
                  <tr key={c.counterId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs">
                        <FiMonitor className="text-xs" /> {c.counterName}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">{c.orders}</td>
                    <td className="px-4 py-3 text-center">{c.itemsSold}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">₹{c.revenue.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">₹{c.avgOrderValue.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationFooter />
        </div>
      );
    }

    if (activeView === "staff") {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold flex items-center gap-2">
              <FiUserCheck /> Staff-wise Sales ({sortedData.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <SortHeader label="Staff Name" sortKey="staffName" />
                  <SortHeader label="Orders" sortKey="orders" align="center" />
                  <SortHeader label="Revenue" sortKey="revenue" align="right" />
                  <SortHeader label="Avg Order Value" sortKey="avgOrderValue" align="right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {pagedData.map((s) => (
                  <tr key={s.staffId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs">
                        <FiUserCheck className="text-xs" /> {s.staffName}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">{s.orders}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">₹{s.revenue.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">₹{s.avgOrderValue.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationFooter />
        </div>
      );
    }

    if (activeView === "payment") {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold flex items-center gap-2">
              <FiCreditCard /> Payment-wise Sales ({sortedData.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <SortHeader label="Payment Method" sortKey="method" />
                  <SortHeader label="Orders" sortKey="orders" align="center" />
                  <SortHeader label="Revenue" sortKey="revenue" align="right" />
                  <SortHeader label="% Share" sortKey="percentage" align="right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {pagedData.map((p) => (
                  <tr key={p.method} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 font-medium">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                          p.method.toLowerCase() === "cash"
                            ? "bg-green-100 text-green-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        <FiCreditCard className="text-xs" /> {p.method}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">{p.orders}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">₹{p.revenue.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-semibold text-indigo-600">{p.percentage.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationFooter />
        </div>
      );
    }

    if (activeView === "daily") {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold flex items-center gap-2">
              <FiCalendar /> Daily Sales Summary ({sortedData.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <SortHeader label="Date" sortKey="date" />
                  <SortHeader label="Orders" sortKey="orders" align="center" />
                  <SortHeader label="Items Sold" sortKey="itemsSold" align="center" />
                  <SortHeader label="Revenue" sortKey="revenue" align="right" />
                  <SortHeader label="Avg Order" sortKey="avgOrderValue" align="right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {pagedData.map((d) => (
                  <tr key={d.date} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-xs">
                        <FiCalendar className="text-xs" /> {d.date}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">{d.orders}</td>
                    <td className="px-4 py-3 text-center">{d.itemsSold}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">₹{d.revenue.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">₹{d.avgOrderValue.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationFooter />
        </div>
      );
    }

    if (activeView === "hourly") {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold flex items-center gap-2">
              <FiClock /> Hourly Sales ({sortedData.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <SortHeader label="Hour" sortKey="hour" />
                  <SortHeader label="Orders" sortKey="orders" align="center" />
                  <SortHeader label="Revenue" sortKey="revenue" align="right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {pagedData.map((h) => (
                  <tr key={h.hour} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs">
                        <FiClock className="text-xs" /> {String(h.hour).padStart(2, "0")}:00
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">{h.orders}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">₹{h.revenue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationFooter />
        </div>
      );
    }

    if (activeView === "orders") {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold flex items-center gap-2">
              <FiUserCheck /> Confirmed Orders ({sortedData.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <SortHeader label="Order ID" sortKey="_id" />
                  <SortHeader label="Time" sortKey="createdAt" align="center" />
                  <SortHeader label="Counter" sortKey="counterId" align="center" />
                  <SortHeader label="Amount" sortKey="totalAmount" align="right" />
                  <SortHeader label="Staff" sortKey="confirmedBy" align="center" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {pagedData.map((o) => (
                  <tr key={o._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 font-mono text-sm text-gray-900 dark:text-white">
                      #{o._id.slice(-8)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 text-center">
                      {new Date(o.createdAt).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                        hour12: true,
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs">
                        <FiMonitor size={12} /> {getCounterName(o.counterId)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">
                      ₹{o.totalAmount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                        <FiUserCheck size={12} /> {o.confirmedBy?.name || "System"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationFooter />
        </div>
      );
    }

    return null;
  };

  /* ---------- RENDER ---------- */
  return (
    <div className="p-6 relative space-y-6">
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
              Updating...
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Sales & Analytics Reports
          </h1>
          <p className="text-sm text-gray-500">{formatDate(getTodayIST())}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={resetFilters}
            className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 px-4 py-2 rounded-lg text-sm font-medium"
          >
            <FiRefreshCw /> Reset
          </button>
          <button
            onClick={downloadCSV}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            <FiFileText /> CSV
          </button>
          <button
            onClick={downloadPDF}
            disabled={downloadingPdf || initialLoading}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            {downloadingPdf ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FiDownload /> PDF
              </>
            )}
          </button>
        </div>
      </div>

      {initialLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* SUMMARY CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
            {[
              { label: "Total Orders", value: reports.confirmedOrders.length, icon: FiShoppingBag, grad: "from-indigo-500 to-indigo-600" },
              { label: "Revenue", value: `₹${reports.totalIncome.toLocaleString()}`, icon: FaRupeeSign, grad: "from-emerald-500 to-emerald-600" },
              { label: "Products", value: reports.productWise.length, icon: FiPackage, grad: "from-amber-500 to-orange-600" },
              { label: "Counters", value: uniqueCounters.length, icon: FiMonitor, grad: "from-purple-600 to-indigo-600" },
              { label: "Total Cost", value: `₹${reports.totalCost.toLocaleString()}`, icon: FiDollarSign, grad: "from-rose-500 to-pink-600" },
              { label: "Gross Profit", value: `₹${(reports.totalIncome - reports.totalCost).toLocaleString()}`, icon: FaRupeeSign, grad: "from-cyan-500 to-blue-600" },
              { label: "Profit %", value: `${reports.pnl.profitMargin.toFixed(1)}%`, icon: FiBarChart2, grad: "from-teal-500 to-emerald-600" },
            ].map((c, i) => (
              <div
                key={i}
                className={`bg-gradient-to-br ${c.grad} rounded-xl p-4 text-white shadow-lg hover:-translate-y-1 transition`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs opacity-90 font-medium">{c.label}</p>
                    <p className="text-xl font-bold mt-1">{c.value}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <c.icon className="text-xl" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* FILTERS */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-2 mb-4">
              <FiFilter className="text-indigo-500" />
              <h3 className="font-semibold text-sm">Filters & Search</h3>
              <span className="text-xs text-gray-400">
                ({reports.confirmedOrders.length} orders matched)
              </span>
            </div>

            <div className="relative mb-4">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by Order ID, Counter, Staff, Product, or Category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <FiX />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Date Range</label>
                <select
                  value={filterDateRange}
                  onChange={(e) => setFilterDateRange(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                >
                  <option value="today">Today</option>
                  <option value="week">Last 7 Days</option>
                  <option value="month">Last 30 Days</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                >
                  <option value="all">All Categories</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Counter</label>
                <select
                  value={filterCounter}
                  onChange={(e) => setFilterCounter(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                >
                  <option value="all">All Counters</option>
                  {uniqueCounters.map((c) => (
                    <option key={c} value={c}>{getCounterName(c)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Payment</label>
                <select
                  value={filterPayment}
                  onChange={(e) => setFilterPayment(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                >
                  <option value="all">All</option>
                  <option value="Cash">Cash</option>
                  <option value="Online">Online</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                >
                  <option value="Confirmed">Confirmed</option>
                  <option value="Pending">Pending</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="all">All</option>
                </select>
              </div>

              {filterDateRange === "custom" && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Start</label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">End</label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      max={getTodayIST()}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* REPORT TABS */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-2 flex flex-wrap gap-2">
            {REPORT_VIEWS.map((tab) => {
              const isActive = activeView === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveView(tab.key)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-md"
                      : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  <tab.icon className="text-sm" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* RENDER ACTIVE TABLE */}
          {renderTable()}
        </>
      )}
    </div>
  );
}