import { useState, useEffect, useMemo } from "react";
import api from "../services/api";
import socket from "../services/socket";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiCalendar,
  FiDollarSign,
  FiShoppingBag,
  FiPackage,
  FiUserCheck,
  FiClock,
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiRefreshCw,
  FiMonitor,
  FiFilter,
  FiX,
} from "react-icons/fi";
import { FaRupeeSign } from "react-icons/fa";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function SalesReportPage() {
  // Get today's date in Indian Standard Time (IST) as YYYY-MM-DD
  const getTodayIST = () => {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(new Date());
  };

  const [selectedDate, setSelectedDate] = useState(getTodayIST());
  const [salesData, setSalesData] = useState({
    date: "",
    totalOrders: 0,
    totalIncome: 0,
    productWise: [],
  });
  const [confirmedOrders, setConfirmedOrders] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  
  // ✅ FILTERS
  const [filterCounter, setFilterCounter] = useState("all");
  const [filterPayment, setFilterPayment] = useState("all");
  const [filterDateRange, setFilterDateRange] = useState("today");
  
  // ✅ Custom date range
  const [customStartDate, setCustomStartDate] = useState(getTodayIST());
  const [customEndDate, setCustomEndDate] = useState(getTodayIST());
  
  // ✅ LOADING STATES - Only for initial load
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // ✅ Get unique counters
  const getUniqueCounters = useMemo(() => {
    const counters = new Set();
    allOrders.forEach(order => {
      if (order.counterId) {
        counters.add(order.counterId);
      }
    });
    return Array.from(counters);
  }, [allOrders]);

  // ✅ Counter name mapping
  const getCounterName = (counterId) => {
    const names = {
      'counter-1': 'Counter 1',
      'counter-2': 'Counter 2',
      'counter-3': 'Counter 3'
    };
    return names[counterId] || counterId;
  };

  // ✅ Filter orders based on all filters
  const getFilteredOrders = useMemo(() => {
    let filtered = [...allOrders];

    // Date filter
    if (filterDateRange === 'today') {
      const today = getTodayIST();
      filtered = filtered.filter(order => {
        const orderDate = new Date(order.createdAt).toISOString().split('T')[0];
        return orderDate === today;
      });
    } else if (filterDateRange === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      filtered = filtered.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= weekAgo;
      });
    } else if (filterDateRange === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      filtered = filtered.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= monthAgo;
      });
    } else if (filterDateRange === 'custom') {
      filtered = filtered.filter(order => {
        const orderDate = new Date(order.createdAt).toISOString().split('T')[0];
        return orderDate >= customStartDate && orderDate <= customEndDate;
      });
    }

    // Counter filter
    if (filterCounter !== 'all') {
      filtered = filtered.filter(order => order.counterId === filterCounter);
    }

    // Payment filter
    if (filterPayment !== 'all') {
      filtered = filtered.filter(order => order.paymentMethod === filterPayment);
    }

    return filtered;
  }, [allOrders, filterDateRange, filterCounter, filterPayment, customStartDate, customEndDate]);

  // ✅ Confirmed orders only
  const filteredConfirmedOrders = useMemo(() => {
    return getFilteredOrders.filter(order => order.status === 'Confirmed');
  }, [getFilteredOrders]);

  // ✅ Sales report data from filtered orders
  const filteredSalesData = useMemo(() => {
    const filtered = getFilteredOrders.filter(order => order.status === 'Confirmed');
    
    let totalIncome = 0;
    const productSales = {};

    filtered.forEach(order => {
      totalIncome += order.totalAmount || 0;
      order.items.forEach(item => {
        const productName = item.productId?.name || 'Deleted Product';
        const productId = item.productId?._id || 'unknown';
        if (!productSales[productId]) {
          productSales[productId] = {
            productId,
            name: productName,
            quantity: 0,
            revenue: 0
          };
        }
        productSales[productId].quantity += item.quantity;
        productSales[productId].revenue += item.quantity * (item.price || 0);
      });
    });

    return {
      totalOrders: filtered.length,
      totalIncome,
      productWise: Object.values(productSales)
    };
  }, [getFilteredOrders]);

  // ✅ INITIAL FETCH - Only once
  useEffect(() => {
    fetchOrders(false);
  }, []);

  // ✅ SOCKET EVENTS - Silent background refresh (NO SPINNER)
  useEffect(() => {
    const handleOrderChange = () => {
      // ✅ SILENT REFRESH - No loading spinner
      fetchOrders(true);
    };

    socket.on("orderConfirmed", handleOrderChange);
    socket.on("orderCancelled", handleOrderChange);
    socket.on("newOrder", handleOrderChange);
    socket.on("stockUpdated", handleOrderChange);

    return () => {
      socket.off("orderConfirmed", handleOrderChange);
      socket.off("orderCancelled", handleOrderChange);
      socket.off("newOrder", handleOrderChange);
      socket.off("stockUpdated", handleOrderChange);
    };
  }, []);

  // ✅ FETCH ORDERS with silent mode
  const fetchOrders = async (silent = false) => {
    try {
      if (!silent) {
        setInitialLoading(true);
      } else {
        // ✅ Show subtle refresh indicator instead of spinner
        setRefreshing(true);
      }
      
      const { data } = await api.get("/orders");
      setAllOrders(data);
    } catch (err) {
      if (!silent) {
        toast.error("Failed to load orders");
      }
      console.error("Fetch error:", err);
    } finally {
      if (!silent) {
        setInitialLoading(false);
      } else {
        // ✅ Hide refresh indicator after 1.5 seconds
        setTimeout(() => setRefreshing(false), 1500);
      }
    }
  };

  const addDays = (dateStr, days) => {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return date.toISOString().split("T")[0];
  };

  const handlePrevDay = () => {
    setSelectedDate(addDays(selectedDate, -1));
  };

  const handleNextDay = () => {
    const todayIST = getTodayIST();
    const newDate = addDays(selectedDate, 1);
    if (newDate <= todayIST) {
      setSelectedDate(newDate);
    } else {
      toast.error("Cannot go beyond today");
    }
  };

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    const todayIST = getTodayIST();
    if (newDate > todayIST) {
      toast.error("Cannot select a future date (IST)");
      return;
    }
    setSelectedDate(newDate);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // ✅ Reset all filters
  const resetFilters = () => {
    setFilterCounter("all");
    setFilterPayment("all");
    setFilterDateRange("today");
    setCustomStartDate(getTodayIST());
    setCustomEndDate(getTodayIST());
  };

  // ─── PDF Download with filters ──────────────────────────────────────────
  const downloadPDF = () => {
    setDownloadingPdf(true);
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 14;
      const contentW = pageW - margin * 2;

      // ── Header bar ──
      doc.setFillColor(79, 70, 229);
      doc.rect(0, 0, pageW, 28, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("Sales Report", margin, 13);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(
        `Generated: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`,
        pageW - margin,
        13,
        { align: "right" }
      );

      // Filter info
      let filterText = `Date: ${filterDateRange}`;
      if (filterCounter !== 'all') filterText += ` | Counter: ${getCounterName(filterCounter)}`;
      if (filterPayment !== 'all') filterText += ` | Payment: ${filterPayment}`;
      doc.text(filterText, pageW - margin, 20, { align: "right" });

      let y = 36;

      // ── Summary cards ──
      const cardW = (contentW - 8) / 3;
      const cards = [
        { label: "Report Date", value: formatDate(selectedDate), color: [79, 70, 229], small: true },
        { label: "Total Income", value: `Rs. ${(filteredSalesData.totalIncome || 0).toLocaleString("en-IN")}`, color: [16, 185, 129] },
        { label: "Confirmed Orders", value: String(filteredSalesData.totalOrders || 0), color: [124, 58, 237] },
      ];

      cards.forEach((card, i) => {
        const x = margin + i * (cardW + 4);
        doc.setFillColor(card.color[0], card.color[1], card.color[2]);
        doc.roundedRect(x, y, cardW, 22, 3, 3, "F");

        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text(card.label, x + 5, y + 7);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(card.small ? 9 : 13);
        const valLines = doc.splitTextToSize(card.value, cardW - 8);
        doc.text(valLines, x + 5, y + 15);
      });

      y += 30;

      // ── Product-wise Sales ──
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(31, 41, 55);
      doc.text("Product-wise Sales", margin, y);
      y += 5;

      if (!filteredSalesData.productWise || filteredSalesData.productWise.length === 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.setTextColor(107, 114, 128);
        doc.text("No product sales for this period.", margin, y + 6);
        y += 14;
      } else {
        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [["#", "Product Name", "Qty Sold", "Revenue (Rs.)"]],
          body: filteredSalesData.productWise.map((item, idx) => [
            idx + 1,
            item.name,
            item.quantity,
            Number(item.revenue).toLocaleString("en-IN"),
          ]),
          foot: [["", "TOTAL", filteredSalesData.productWise.reduce((s, i) => s + i.quantity, 0), `Rs. ${(filteredSalesData.totalIncome || 0).toLocaleString("en-IN")}`]],
          headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: "bold", fontSize: 9, halign: "center" },
          footStyles: { fillColor: [238, 242, 255], textColor: [31, 41, 55], fontStyle: "bold", fontSize: 9, halign: "center" },
          bodyStyles: { fontSize: 9, textColor: [31, 41, 55], halign: "center" },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          columnStyles: { 0: { cellWidth: 10, halign: "center" }, 1: { halign: "left" }, 2: { halign: "center" }, 3: { halign: "right" } },
          showFoot: "lastPage",
        });
        y = doc.lastAutoTable.finalY + 8;
      }

      // ── Confirmed Orders ──
      if (y > pageH - 60) {
        doc.addPage();
        y = 20;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(31, 41, 55);
      doc.text("Confirmed Orders Details", margin, y);
      y += 5;

      if (filteredConfirmedOrders.length === 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.setTextColor(107, 114, 128);
        doc.text("No confirmed orders for this period.", margin, y + 6);
      } else {
        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [["#", "Order ID", "Time", "Counter", "Amount (Rs.)", "Approved By"]],
          body: filteredConfirmedOrders.map((order, idx) => [
            idx + 1,
            `#${order._id.slice(-8)}`,
            new Date(order.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true, hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }),
            getCounterName(order.counterId) || '-',
            `Rs. ${Number(order.totalAmount).toLocaleString("en-IN")}`,
            order.confirmedBy?.name || "System",
          ]),
          foot: [["", "", "", `${filteredConfirmedOrders.length} Orders`, `Rs. ${filteredConfirmedOrders.reduce((s, o) => s + Number(o.totalAmount), 0).toLocaleString("en-IN")}`, ""]],
          headStyles: { fillColor: [124, 58, 237], textColor: 255, fontStyle: "bold", fontSize: 9, halign: "center" },
          footStyles: { fillColor: [245, 243, 255], textColor: [31, 41, 55], fontStyle: "bold", fontSize: 9, halign: "center" },
          bodyStyles: { fontSize: 9, textColor: [31, 41, 55], halign: "center" },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          columnStyles: { 0: { cellWidth: 10, halign: "center" }, 1: { halign: "center" }, 2: { halign: "center" }, 3: { halign: "center" }, 4: { halign: "right" }, 5: { halign: "center" } },
          showFoot: "lastPage",
        });
      }

      // ── Footer on every page ──
      const totalPages = doc.internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(107, 114, 128);
        doc.text("Consumer Store – Confidential", margin, pageH - 7);
        doc.text(`Page ${p} of ${totalPages}`, pageW - margin, pageH - 7, { align: "right" });
      }

      const fileName = `Sales_Report_${selectedDate}.pdf`;
      doc.save(fileName);
      toast.success(`Report downloaded: ${fileName}`);
    } catch (err) {
      console.error("PDF generation error:", err);
      toast.error("Failed to generate PDF report");
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="p-6 relative">
      {/* ✅ Refresh Indicator - Subtle top-right corner */}
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

      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Sales Report</h1>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Reset Filters */}
          <button
            onClick={resetFilters}
            className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            <FiRefreshCw className="text-sm" />
            Reset Filters
          </button>

          {/* Download Button */}
          <button
            onClick={downloadPDF}
            disabled={downloadingPdf || initialLoading}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg shadow-sm transition-all duration-200 font-medium text-sm"
          >
            {downloadingPdf ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FiDownload className="text-base" />
                Download Report
              </>
            )}
          </button>
        </div>
      </div>

      {/* ✅ FILTERS SECTION */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <FiFilter className="text-indigo-500" />
          <h3 className="font-semibold text-sm">Filters</h3>
          <span className="text-xs text-gray-400">({filteredConfirmedOrders.length} orders found)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Date Range Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Date Range</label>
            <select
              value={filterDateRange}
              onChange={(e) => setFilterDateRange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Custom Date Range */}
          {filterDateRange === 'custom' && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">End Date</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  max={getTodayIST()}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </>
          )}

          {/* Counter Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Counter</label>
            <select
              value={filterCounter}
              onChange={(e) => setFilterCounter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="all">All Counters</option>
              {getUniqueCounters.map((counter) => (
                <option key={counter} value={counter}>
                  {getCounterName(counter)}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Payment Method</label>
            <select
              value={filterPayment}
              onChange={(e) => setFilterPayment(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="all">All Payments</option>
              <option value="cash">Cash</option>
              <option value="online">Online</option>
            </select>
          </div>
        </div>

        {/* Active Filters Display */}
        {(filterCounter !== 'all' || filterPayment !== 'all' || filterDateRange !== 'today') && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <span className="text-xs text-gray-500">Active Filters:</span>
            {filterDateRange !== 'today' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs">
                {filterDateRange === 'week' ? 'Last 7 Days' : filterDateRange === 'month' ? 'Last 30 Days' : 'Custom Range'}
              </span>
            )}
            {filterCounter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs">
                <FiMonitor className="text-xs" />
                {getCounterName(filterCounter)}
              </span>
            )}
            {filterPayment !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-xs">
                {filterPayment}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ✅ Only shows spinner on FIRST LOAD */}
      {initialLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-indigo-100 text-sm font-medium">Total Orders</p>
                  <p className="text-2xl font-bold mt-1">{filteredSalesData.totalOrders}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                  <FiShoppingBag className="text-2xl text-white" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-emerald-100 text-sm font-medium">Total Revenue</p>
                  <p className="text-2xl font-bold mt-1">
                    ₹{(filteredSalesData.totalIncome || 0).toLocaleString()}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                  <FaRupeeSign className="text-2xl text-white" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-purple-100 text-sm font-medium">Active Counters</p>
                  <p className="text-2xl font-bold mt-1">{getUniqueCounters.length}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                  <FiMonitor className="text-2xl text-white" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-amber-100 text-sm font-medium">Total Products</p>
                  <p className="text-2xl font-bold mt-1">{filteredSalesData.productWise?.length || 0}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                  <FiPackage className="text-2xl text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* Product-wise Sales Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FiPackage /> Product-wise Sales
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr className="text-center">
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-300">Product</th>
                    <th className="px-6 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-300">Quantity Sold</th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-300">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {!filteredSalesData.productWise || filteredSalesData.productWise.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="px-6 py-8 text-center text-gray-500">
                        No sales for this period.
                      </td>
                    </tr>
                  ) : (
                    filteredSalesData.productWise.map((item) => (
                      <tr key={item.productId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white text-left">{item.name}</td>
                        <td className="px-6 py-4 text-center text-gray-600 dark:text-gray-300">{item.quantity}</td>
                        <td className="px-6 py-4 text-right font-semibold text-green-600 dark:text-green-400">
                          ₹{item.revenue.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {filteredSalesData.productWise && filteredSalesData.productWise.length > 0 && (
                  <tfoot className="bg-gray-50 dark:bg-gray-700 font-semibold">
                    <tr>
                      <td className="px-6 py-3 text-left text-sm font-bold text-gray-900 dark:text-white">TOTAL</td>
                      <td className="px-6 py-3 text-center text-sm font-bold text-gray-900 dark:text-white">
                        {filteredSalesData.productWise.reduce((s, i) => s + i.quantity, 0)}
                      </td>
                      <td className="px-6 py-3 text-right text-sm font-bold text-green-700 dark:text-green-300">
                        ₹{(filteredSalesData.totalIncome || 0).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Confirmed Orders Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FiUserCheck /> Confirmed Orders Details
              </h2>
            </div>
            {loadingOrders ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr className="text-center">
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-300">Order ID</th>
                      <th className="px-6 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-300">Time</th>
                      <th className="px-6 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-300">Counter</th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-300">Amount</th>
                      <th className="px-6 py-3 text-center text-xs font-medium uppercase text-gray-500 dark:text-gray-300">Approved By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredConfirmedOrders.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                          No confirmed orders for this period.
                        </td>
                      </tr>
                    ) : (
                      filteredConfirmedOrders.map((order) => (
                        <tr key={order._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                          <td className="px-6 py-4 font-mono text-sm text-gray-900 dark:text-white text-left">
                            #{order._id.slice(-8)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 text-center">
                            {new Date(order.createdAt).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-medium">
                              <FiMonitor size={12} />
                              {getCounterName(order.counterId) || '-'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right font-semibold text-green-600 dark:text-green-400">
                            ₹{order.totalAmount.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full text-xs font-medium">
                              <FiUserCheck size={12} />
                              {order.confirmedBy?.name || "System"}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {filteredConfirmedOrders.length > 0 && (
                    <tfoot className="bg-gray-50 dark:bg-gray-700 font-semibold">
                      <tr>
                        <td colSpan="3" className="px-6 py-3 text-right text-sm font-bold text-gray-900 dark:text-white">
                          TOTAL:
                        </td>
                        <td className="px-6 py-3 text-right text-sm font-bold text-green-700 dark:text-green-300">
                          ₹{filteredConfirmedOrders.reduce((s, o) => s + Number(o.totalAmount), 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-3 text-center text-sm text-gray-500">
                          {filteredConfirmedOrders.length} Orders
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}