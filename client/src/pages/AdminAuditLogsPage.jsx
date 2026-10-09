import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
import api from "../services/api";
import socket from "../services/socket";
import PaginationBar from "../components/PaginationBar";
import {
  formatISTDateTime,
  formatISTDate,
  exportReportToCSV,
  exportReportToExcel,
  exportReportToPDF,
  formatINR,
} from "../utils/exportUtils";

import {
  FiShield,
  FiActivity,
  FiClock,
  FiUser,
  FiShoppingBag,
  FiDatabase,
  FiUsers,
  FiAlertTriangle,
  FiXCircle,
  FiCheckCircle,
  FiSearch,
  FiFilter,
  FiRefreshCw,
  FiDownload,
  FiSliders,
  FiEye,
  FiTrash2,
  FiChevronRight,
  FiChevronDown,
  FiCalendar,
  FiMonitor,
  FiSmartphone,
  FiTablet,
  FiServer,
  FiVolume2,
  FiVolumeX,
  FiCopy,
  FiCheck,
  FiX,
  FiLock,
  FiArrowRight,
  FiGrid,
  FiCreditCard,
  FiLayers,
  FiSettings,
} from "react-icons/fi";

// Quick filter categories
const QUICK_FILTERS = [
  { id: "all", label: "All Activity", icon: FiActivity },
  { id: "security", label: "Security", icon: FiShield, module: "Authentication" },
  { id: "orders", label: "Orders", icon: FiShoppingBag, module: "Orders" },
  { id: "inventory", label: "Inventory", icon: FiDatabase, module: "Inventory" },
  { id: "staff", label: "Staff", icon: FiUsers, module: "Staff" },
  { id: "payments", label: "Payments", icon: FiCreditCard, module: "Payments" },
  { id: "system", label: "System", icon: FiSettings, module: "System" },
];

// Helper to determine visual badge colors based on action
const getActionBadgeStyle = (action = "") => {
  const act = action.toUpperCase();
  if (act === "LOGIN") return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800";
  if (act === "LOGOUT") return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
  if (act.includes("CREATE") || act === "STOCK_ADDED") return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800";
  if (act.includes("UPDATE") || act === "STOCK_CORRECTION" || act.includes("REVERT")) return "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800";
  if (act.includes("DELETE")) return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800";
  if (act === "STOCK_REMOVED") return "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800";
  if (act === "PAYMENT_SUCCESS" || act === "ORDER_CONFIRMED") return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800";
  if (act === "PAYMENT_FAILED" || act === "FAILED_LOGIN") return "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800";
  if (act.includes("RESET") || act.includes("MAINTENANCE") || act.includes("STATUS")) return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800";
  return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
};

// Helper to determine status badge colors
const getStatusBadgeStyle = (status = "Success") => {
  if (status === "Success") return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800";
  if (status === "Failed") return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800";
  if (status === "Warning") return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800";
  return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
};

// Helper to determine role badge colors
const getRoleBadgeStyle = (role = "system") => {
  const r = role.toLowerCase();
  if (r === "admin") return "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300";
  if (r === "staff") return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
  if (r === "counter") return "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300";
  return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
};

// Device icon helper
const getDeviceIcon = (deviceType = "desktop") => {
  const dt = (deviceType || "").toLowerCase();
  if (dt === "mobile") return <FiSmartphone className="text-slate-500" />;
  if (dt === "tablet") return <FiTablet className="text-slate-500" />;
  if (dt === "server") return <FiServer className="text-slate-500" />;
  return <FiMonitor className="text-slate-500" />;
};

export default function AdminAuditLogsPage() {
  // State
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalActivities: 0,
    todayActivities: 0,
    loginActivities: 0,
    orderActivities: 0,
    inventoryActivities: 0,
    staffActivities: 0,
    securityEvents: 0,
    failedActions: 0,
  });

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filters
  const [quickFilter, setQuickFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState("today");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deviceFilter, setDeviceFilter] = useState("all");
  const [sortBy, setSortBy] = useState("timestamp");
  const [sortOrder, setSortOrder] = useState("desc");

  // Realtime & Audio
  const [livePulse, setLivePulse] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [newLogIds, setNewLogIds] = useState(new Set());

  // Modals & Drawers
  const [selectedLog, setSelectedLog] = useState(null);
  const [showRetentionModal, setShowRetentionModal] = useState(false);
  const [retentionPolicy, setRetentionPolicy] = useState("forever");
  const [retentionStats, setRetentionStats] = useState({ totalCount: 0, oldestLogDate: null, lastCleanupAt: null });
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [cleaningLogs, setCleaningLogs] = useState(false);
  const [copiedSession, setCopiedSession] = useState(false);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Audio effect for realtime notifications
  const playNotificationSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.2);
    } catch (e) {}
  }, [soundEnabled]);

  // Fetch Audit Logs
  const fetchAuditLogs = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoading(true);
        else setIsRefreshing(true);

        const params = {
          page,
          limit: pageSize,
          search: debouncedSearch,
          dateRange,
          module: moduleFilter,
          action: actionFilter,
          role: roleFilter,
          status: statusFilter,
          deviceType: deviceFilter,
          sortBy,
          sortOrder,
        };

        if (dateRange === "custom") {
          if (startDate) params.startDate = startDate;
          if (endDate) params.endDate = endDate;
        }

        const { data } = await api.get("/audit-logs", { params });

        setLogs(data.logs || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotalItems(data.pagination?.total || 0);
        if (data.stats) {
          setStats(data.stats);
        }
      } catch (err) {
        console.error("Failed to fetch audit logs:", err);
        toast.error("Failed to load audit logs");
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [page, pageSize, debouncedSearch, dateRange, startDate, endDate, moduleFilter, actionFilter, roleFilter, statusFilter, deviceFilter, sortBy, sortOrder]
  );

  // Initial and trigger load
  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  // Fetch Retention Policy
  const fetchRetentionPolicy = async () => {
    try {
      const { data } = await api.get("/audit-logs/retention/policy");
      setRetentionPolicy(data.policy || "forever");
      setRetentionStats({
        totalCount: data.totalCount || 0,
        oldestLogDate: data.oldestLogDate,
        lastCleanupAt: data.lastCleanupAt,
      });
    } catch (err) {
      console.error("Failed to fetch retention policy:", err);
    }
  };

  // Socket.IO Listener for Realtime Audit Logs
  useEffect(() => {
    const handleNewAuditLog = (newLog) => {
      if (!newLog) return;

      // Pulse the realtime indicator
      setLivePulse(true);
      setTimeout(() => setLivePulse(false), 2000);

      // Play soft audio ping
      playNotificationSound();

      // Highlight new entry
      setNewLogIds((prev) => new Set(prev).add(newLog._id));
      setTimeout(() => {
        setNewLogIds((prev) => {
          const next = new Set(prev);
          next.delete(newLog._id);
          return next;
        });
      }, 5000);

      // Update KPI statistics in real time
      setStats((prev) => {
        const isAuth = newLog.module === "Authentication";
        const isOrder = newLog.module === "Orders";
        const isInv = newLog.module === "Inventory";
        const isStaff = newLog.module === "Staff";
        const isSec =
          newLog.action === "FAILED_LOGIN" ||
          newLog.action?.includes("STATUS") ||
          newLog.action?.includes("PASSWORD") ||
          newLog.status === "Warning";
        const isFail = newLog.status === "Failed";

        return {
          ...prev,
          totalActivities: prev.totalActivities + 1,
          todayActivities: prev.todayActivities + 1,
          loginActivities: isAuth ? prev.loginActivities + 1 : prev.loginActivities,
          orderActivities: isOrder ? prev.orderActivities + 1 : prev.orderActivities,
          inventoryActivities: isInv ? prev.inventoryActivities + 1 : prev.inventoryActivities,
          staffActivities: isStaff ? prev.staffActivities + 1 : prev.staffActivities,
          securityEvents: isSec ? prev.securityEvents + 1 : prev.securityEvents,
          failedActions: isFail ? prev.failedActions + 1 : prev.failedActions,
        };
      });

      // If viewing page 1 with default or matching quick filter, prepend immediately!
      if (page === 1) {
        setLogs((prev) => [newLog, ...prev.slice(0, pageSize - 1)]);
        setTotalItems((prev) => prev + 1);
      }
    };

    socket.on("auditLogCreated", handleNewAuditLog);
    return () => {
      socket.off("auditLogCreated", handleNewAuditLog);
    };
  }, [page, pageSize, playNotificationSound]);

  // Quick filter tab handler
  const handleQuickFilterClick = (qf) => {
    setQuickFilter(qf.id);
    setPage(1);
    if (qf.id === "all") {
      setModuleFilter("all");
      setActionFilter("all");
    } else if (qf.module) {
      setModuleFilter(qf.module);
      setActionFilter("all");
    }
  };

  // Reset all filters
  const handleResetFilters = () => {
    setQuickFilter("all");
    setSearch("");
    setDebouncedSearch("");
    setDateRange("today");
    setStartDate("");
    setEndDate("");
    setModuleFilter("all");
    setActionFilter("all");
    setRoleFilter("all");
    setStatusFilter("all");
    setDeviceFilter("all");
    setSortBy("timestamp");
    setSortOrder("desc");
    setPage(1);
    toast.success("Filters reset to default");
  };

  // Export Data Handler (CSV, Excel, PDF)
  const handleExport = async (format = "csv") => {
    try {
      toast.loading(`Preparing ${format.toUpperCase()} export...`, { id: "exportToast" });
      const params = {
        search: debouncedSearch,
        dateRange,
        module: moduleFilter,
        action: actionFilter,
        role: roleFilter,
        status: statusFilter,
        deviceType: deviceFilter,
        sortBy,
        sortOrder,
      };
      if (dateRange === "custom") {
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
      }

      const { data: records } = await api.get("/audit-logs/export/records", { params });

      if (!records || records.length === 0) {
        toast.error("No records found to export", { id: "exportToast" });
        return;
      }

      const columns = [
        { header: "Timestamp (IST)", key: "timestamp", format: "datetime" },
        { header: "User Name", key: "userName" },
        { header: "Role", key: "role" },
        { header: "Action", key: "action" },
        { header: "Module", key: "module" },
        { header: "Target", key: "targetName" },
        { header: "Description", key: "description" },
        { header: "Status", key: "status" },
        { header: "Device", key: "deviceName" },
        { header: "IP Address", key: "ipAddress" },
        { header: "Session ID", key: "sessionId" },
      ];

      const activeFiltersDescription = {
        DateRange: dateRange,
        Module: moduleFilter !== "all" ? moduleFilter : "All Modules",
        Role: roleFilter !== "all" ? roleFilter.toUpperCase() : "All Roles",
        Status: statusFilter !== "all" ? statusFilter : "All Statuses",
        Search: debouncedSearch || "None",
      };

      const kpis = [
        { label: "Total Exported Records", value: records.length },
        { label: "Today's Activities", value: stats.todayActivities },
        { label: "Security Events", value: stats.securityEvents },
        { label: "Failed Actions", value: stats.failedActions },
      ];

      if (format === "csv") {
        exportReportToCSV({
          title: "System_Audit_Logs",
          columns,
          data: records,
        });
      } else if (format === "excel") {
        exportReportToExcel({
          title: "System Audit & Activity Logs",
          category: "System Accountability & Security",
          period: dateRange === "today" ? "Today" : dateRange === "yesterday" ? "Yesterday" : dateRange,
          filters: activeFiltersDescription,
          kpis,
          columns,
          data: records,
        });
      } else if (format === "pdf") {
        exportReportToPDF({
          title: "Audit & System Activity Report",
          category: "Security & Governance Audit Trail",
          period: dateRange === "today" ? "Today" : dateRange === "yesterday" ? "Yesterday" : dateRange,
          filters: activeFiltersDescription,
          kpis,
          columns,
          data: records,
        });
      }

      toast.success(`${format.toUpperCase()} export downloaded!`, { id: "exportToast" });
    } catch (err) {
      console.error("Export error:", err);
      toast.error(`Export failed: ${err.message}`, { id: "exportToast" });
    }
  };

  // Retention Policy Update
  const handleSaveRetentionPolicy = async () => {
    try {
      setSavingPolicy(true);
      await api.put("/audit-logs/retention/policy", { policy: retentionPolicy });
      toast.success(`Retention policy updated to ${retentionPolicy === "forever" ? "Forever" : retentionPolicy + " Days"}`);
      fetchRetentionPolicy();
      setShowRetentionModal(false);
    } catch (err) {
      toast.error("Failed to update retention policy");
    } finally {
      setSavingPolicy(false);
    }
  };

  // Run Retention Cleanup Manually
  const handleRunCleanup = async () => {
    const confirm = await Swal.fire({
      title: "Run Retention Cleanup?",
      text: `This will permanently delete audit logs older than the current policy (${retentionPolicy === "forever" ? "Forever - 0 logs will be deleted" : retentionPolicy + " Days"}).`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Yes, execute cleanup",
    });

    if (!confirm.isConfirmed) return;

    try {
      setCleaningLogs(true);
      const { data } = await api.post("/audit-logs/retention/cleanup");
      Swal.fire({
        title: "Cleanup Completed",
        text: data.message,
        icon: "success",
      });
      fetchRetentionPolicy();
      fetchAuditLogs(true);
    } catch (err) {
      toast.error("Failed to execute cleanup");
    } finally {
      setCleaningLogs(false);
    }
  };

  // Copy session helper
  const handleCopySession = (sessionId) => {
    if (!sessionId) return;
    navigator.clipboard.writeText(sessionId);
    setCopiedSession(true);
    setTimeout(() => setCopiedSession(false), 2000);
    toast.success("Session ID copied to clipboard");
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ─── PAGE HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-[28px] font-bold text-slate-900 dark:text-white tracking-tight">
              Audit & Activity Logs
            </h1>
            {/* Realtime Live Pulse Badge */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                livePulse
                  ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-400 scale-105"
                  : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
              }`}
              title="Real-time Socket.IO sync active"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>LIVE</span>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Enterprise 360° system activity monitoring, accountability & security audit trail
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Sound Toggle */}
          <button
            onClick={() => {
              setSoundEnabled((v) => !v);
              toast.success(soundEnabled ? "Audit alert sound muted" : "Audit alert sound enabled");
            }}
            className={`p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition ${
              soundEnabled
                ? "bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                : "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700"
            }`}
            title={soundEnabled ? "Mute notification sound" : "Unmute notification sound"}
          >
            {soundEnabled ? <FiVolume2 className="text-indigo-500" /> : <FiVolumeX className="text-slate-400" />}
            <span className="hidden sm:inline">{soundEnabled ? "Sound ON" : "Muted"}</span>
          </button>

          {/* Retention Policy Button */}
          <button
            onClick={() => {
              fetchRetentionPolicy();
              setShowRetentionModal(true);
            }}
            className="px-3 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition shadow-xs"
          >
            <FiClock className="text-slate-500" />
            <span>Retention Policy</span>
          </button>

          {/* Export Dropdown Menu */}
          <div className="relative group">
            <button
              className="px-3 py-2 rounded-xl text-xs font-medium border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5 transition shadow-xs"
            >
              <FiDownload className="text-indigo-600 dark:text-indigo-400" />
              <span>Export</span>
              <FiChevronDown className="text-xs" />
            </button>
            <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 py-1 text-xs">
              <button
                onClick={() => handleExport("csv")}
                className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-2"
              >
                <span>Export CSV</span>
              </button>
              <button
                onClick={() => handleExport("excel")}
                className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-2"
              >
                <span>Export Excel</span>
              </button>
              <button
                onClick={() => handleExport("pdf")}
                className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-2"
              >
                <span>Export PDF</span>
              </button>
            </div>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => fetchAuditLogs(true)}
            disabled={isRefreshing}
            className="p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
            title="Refresh logs"
          >
            <FiRefreshCw className={`${isRefreshing ? "animate-spin text-indigo-500" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* ─── 1. AUDIT LOG DASHBOARD (KPI SUMMARY CARDS) ────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 sm:gap-3">
        {/* Card 1: Total Activities */}
        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total</span>
            <FiActivity className="text-indigo-500 text-sm" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
            {stats.totalActivities.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">All Recorded</div>
        </div>

        {/* Card 2: Today's Activities */}
        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Today</span>
            <FiClock className="text-sky-500 text-sm" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
            {stats.todayActivities.toLocaleString()}
          </div>
          <div className="text-[10px] text-emerald-500 mt-0.5">Active Today</div>
        </div>

        {/* Card 3: Login Activities */}
        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Logins</span>
            <FiUser className="text-blue-500 text-sm" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
            {stats.loginActivities.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Auth Sessions</div>
        </div>

        {/* Card 4: Order Activities */}
        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Orders</span>
            <FiShoppingBag className="text-emerald-500 text-sm" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
            {stats.orderActivities.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Order Events</div>
        </div>

        {/* Card 5: Inventory Activities */}
        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Inventory</span>
            <FiDatabase className="text-violet-500 text-sm" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
            {stats.inventoryActivities.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Stock Movements</div>
        </div>

        {/* Card 6: Staff Activities */}
        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Staff</span>
            <FiUsers className="text-cyan-500 text-sm" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
            {stats.staffActivities.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Staff Actions</div>
        </div>

        {/* Card 7: Security Events */}
        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Security</span>
            <FiShield className="text-amber-500 text-sm" />
          </div>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {stats.securityEvents.toLocaleString()}
          </div>
          <div className="text-[10px] text-amber-500/80 mt-0.5">Warnings/Events</div>
        </div>

        {/* Card 8: Failed Actions */}
        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Failed</span>
            <FiXCircle className="text-rose-500 text-sm" />
          </div>
          <div className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">
            {stats.failedActions.toLocaleString()}
          </div>
          <div className="text-[10px] text-rose-500/80 mt-0.5">Failed Actions</div>
        </div>
      </div>

      {/* ─── 24. QUICK FILTERS ROW ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {QUICK_FILTERS.map((qf) => {
          const Icon = qf.icon;
          const isSelected = quickFilter === qf.id;
          return (
            <button
              key={qf.id}
              onClick={() => handleQuickFilterClick(qf)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition border ${
                isSelected
                  ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white shadow-xs"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="text-xs" />
              <span>{qf.label}</span>
            </button>
          );
        })}
      </div>

      {/* ─── 15. ADVANCED 360° FILTER BAR ──────────────────────────────────── */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {/* Search */}
          <div className="relative sm:col-span-2">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
            <input
              type="text"
              placeholder="Search user, order, product, IP, session..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <FiX className="text-xs" />
              </button>
            )}
          </div>

          {/* Date Filter */}
          <div>
            <select
              value={dateRange}
              onChange={(e) => {
                setDateRange(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="custom">Custom Date Range</option>
              <option value="all">All Time</option>
            </select>
          </div>

          {/* Role Filter */}
          <div>
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Roles</option>
              <option value="admin">ADMIN</option>
              <option value="staff">STAFF</option>
              <option value="counter">COUNTER</option>
              <option value="system">SYSTEM</option>
            </select>
          </div>

          {/* Module Filter */}
          <div>
            <select
              value={moduleFilter}
              onChange={(e) => {
                setModuleFilter(e.target.value);
                setQuickFilter("all");
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Modules</option>
              <option value="Authentication">Authentication</option>
              <option value="Orders">Orders</option>
              <option value="Inventory">Inventory</option>
              <option value="Products">Products</option>
              <option value="Categories">Categories</option>
              <option value="Staff">Staff</option>
              <option value="Counters">Counters</option>
              <option value="Payments">Payments</option>
              <option value="Settings">Settings</option>
              <option value="System">System</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Statuses</option>
              <option value="Success">Success</option>
              <option value="Failed">Failed</option>
              <option value="Warning">Warning</option>
            </select>
          </div>
        </div>

        {/* Secondary Filter Row: Device, Sort, Custom Dates & Clear */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Device Filter */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="font-medium">Device:</span>
              <select
                value={deviceFilter}
                onChange={(e) => {
                  setDeviceFilter(e.target.value);
                  setPage(1);
                }}
                className="px-2 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
              >
                <option value="all">All Devices</option>
                <option value="desktop">Desktop / Laptop</option>
                <option value="mobile">Mobile</option>
                <option value="tablet">Tablet</option>
              </select>
            </div>

            {/* Sorting */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="font-medium">Sort:</span>
              <select
                value={`${sortBy}:${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split(":");
                  setSortBy(field);
                  setSortOrder(order);
                }}
                className="px-2 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
              >
                <option value="timestamp:desc">Newest First</option>
                <option value="timestamp:asc">Oldest First</option>
                <option value="userName:asc">User (A-Z)</option>
                <option value="action:asc">Action (A-Z)</option>
                <option value="module:asc">Module (A-Z)</option>
                <option value="status:asc">Status</option>
              </select>
            </div>

            {/* Custom Range Inputs */}
            {dateRange === "custom" && (
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-2 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
                />
              </div>
            )}
          </div>

          {/* Reset Filters Button */}
          <button
            onClick={handleResetFilters}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium flex items-center gap-1 transition"
          >
            <FiRefreshCw className="text-[10px]" />
            <span>Reset Filters</span>
          </button>
        </div>
      </div>

      {/* ─── 13. AUDIT LOG TABLE & DETAILS ─────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 font-medium">
              Loading 360° system activity logs...
            </p>
          </div>
        ) : logs.length === 0 ? (
          /* 26. EMPTY STATE */
          <div className="py-20 px-4 text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-400">
              <FiActivity className="text-2xl" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              No activities found
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              No logs matched the selected filters, date range, or search criteria.
            </p>
            <button
              onClick={handleResetFilters}
              className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition shadow-sm"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 text-[12px] font-semibold text-slate-600 dark:text-slate-400">
                  <th className="py-3 px-4 whitespace-nowrap">TIME (IST)</th>
                  <th className="py-3 px-4 whitespace-nowrap">USER</th>
                  <th className="py-3 px-3 whitespace-nowrap">ROLE</th>
                  <th className="py-3 px-4 whitespace-nowrap">ACTION</th>
                  <th className="py-3 px-3 whitespace-nowrap">MODULE</th>
                  <th className="py-3 px-4 whitespace-nowrap">TARGET</th>
                  <th className="py-3 px-4 min-w-[240px]">ACTIVITY SUMMARY ("WHO DID WHAT?")</th>
                  <th className="py-3 px-3 whitespace-nowrap">STATUS</th>
                  <th className="py-3 px-4 whitespace-nowrap">DEVICE</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">DETAILS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-[13px]">
                {logs.map((log) => {
                  const isNew = newLogIds.has(log._id);
                  return (
                    <motion.tr
                      key={log._id}
                      initial={isNew ? { backgroundColor: "rgba(99, 102, 241, 0.15)" } : false}
                      animate={{ backgroundColor: "transparent" }}
                      transition={{ duration: 3 }}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-slate-50/90 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
                    >
                      {/* TIME */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-[12px] text-slate-500 dark:text-slate-400">
                        {formatISTDateTime(log.timestamp)}
                      </td>

                      {/* USER */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-300">
                            {log.userName ? log.userName.charAt(0).toUpperCase() : "U"}
                          </div>
                          <div>
                            <span className="font-medium text-slate-900 dark:text-white">
                              {log.userName || "System"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* ROLE */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider ${getRoleBadgeStyle(log.role)}`}>
                          {log.role}
                        </span>
                      </td>

                      {/* ACTION */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${getActionBadgeStyle(log.action)}`}>
                          {log.action?.replace(/_/g, " ")}
                        </span>
                      </td>

                      {/* MODULE */}
                      <td className="py-3.5 px-3 whitespace-nowrap text-slate-600 dark:text-slate-300 font-medium">
                        {log.module}
                      </td>

                      {/* TARGET */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {log.targetName || "-"}
                        </span>
                      </td>

                      {/* "WHO DID WHAT?" SUMMARY */}
                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 font-normal">
                        <p className="line-clamp-2">{log.description}</p>
                      </td>

                      {/* STATUS */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${getStatusBadgeStyle(log.status)}`}>
                          {log.status === "Success" && <FiCheck className="text-[10px]" />}
                          {log.status === "Failed" && <FiX className="text-[10px]" />}
                          {log.status === "Warning" && <FiAlertTriangle className="text-[10px]" />}
                          <span>{log.status}</span>
                        </span>
                      </td>

                      {/* DEVICE */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400" title={`${log.os} • ${log.browser} • ${log.ipAddress}`}>
                          {getDeviceIcon(log.deviceType)}
                          <span className="truncate max-w-[120px]">{log.deviceName || "Desktop"}</span>
                        </div>
                      </td>

                      {/* DETAILS ARROW */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                        <FiEye className="inline text-base" />
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 17. SERVER-SIDE PAGINATION BAR */}
        <div className="border-t border-slate-200 dark:border-slate-800 p-2 sm:p-3">
          <PaginationBar
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={(newPage) => setPage(newPage)}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPage(1);
            }}
            pageSizeOptions={[25, 50, 100]}
            isLoading={loading}
            label="activity logs"
          />
        </div>
      </div>

      {/* ─── 14. ACTIVITY DETAILS DRAWER / MODAL ────────────────────────────── */}
      <AnimatePresence>
        {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-xs">
            {/* Backdrop click */}
            <div className="fixed inset-0" onClick={() => setSelectedLog(null)} />

            <motion.div
              initial={{ x: "100%", opacity: 0.5 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="relative w-full max-w-xl h-full bg-white dark:bg-[#0B1220] border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col z-10 overflow-hidden"
            >
              {/* Drawer Header */}
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${getActionBadgeStyle(selectedLog.action)}`}>
                      {selectedLog.action?.replace(/_/g, " ")}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${getStatusBadgeStyle(selectedLog.status)}`}>
                      {selectedLog.status}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1.5">
                    Activity Details
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <FiX className="text-lg" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="p-6 space-y-5 flex-1 overflow-y-auto">
                {/* 25. "WHO DID WHAT?" Narrative Banner */}
                <div className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 text-indigo-950 dark:text-indigo-200">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-500 dark:text-indigo-400 block mb-1">
                    Activity Narrative
                  </span>
                  <p className="text-sm font-medium leading-relaxed">
                    {selectedLog.description}
                  </p>
                </div>

                {/* Primary Metadata Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-400 block mb-0.5">User</span>
                    <span className="font-semibold text-slate-800 dark:text-white text-sm">
                      {selectedLog.userName}
                    </span>
                    <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${getRoleBadgeStyle(selectedLog.role)}`}>
                      {selectedLog.role}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-400 block mb-0.5">Module & Target</span>
                    <span className="font-semibold text-slate-800 dark:text-white text-sm">
                      {selectedLog.module}
                    </span>
                    <span className="block text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {selectedLog.targetName || selectedLog.targetType || "System"}
                    </span>
                  </div>
                </div>

                {/* 6 & 11. Previous Value vs New Value (Visual Diff Card) */}
                {(selectedLog.previousValue !== null || selectedLog.newValue !== null || selectedLog.change) && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <FiLayers className="text-indigo-500" />
                      <span>Value Changes & Differences</span>
                    </span>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                        <span className="text-[11px] text-slate-400 block">Previous Value</span>
                        <div className="font-semibold text-slate-700 dark:text-slate-200 mt-1 break-words">
                          {typeof selectedLog.previousValue === "object"
                            ? JSON.stringify(selectedLog.previousValue, null, 2)
                            : String(selectedLog.previousValue ?? "N/A")}
                        </div>
                      </div>

                      <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                        <span className="text-[11px] text-slate-400 block">New Value</span>
                        <div className="font-semibold text-emerald-600 dark:text-emerald-400 mt-1 break-words">
                          {typeof selectedLog.newValue === "object"
                            ? JSON.stringify(selectedLog.newValue, null, 2)
                            : String(selectedLog.newValue ?? "N/A")}
                        </div>
                      </div>
                    </div>

                    {selectedLog.change && (
                      <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300">
                        <span>Change:</span>
                        <span>{String(selectedLog.change)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Order Details Section (if order-related) */}
                {(selectedLog.orderId || selectedLog.amount || selectedLog.paymentMethod) && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <FiShoppingBag className="text-emerald-500" />
                      <span>Order & Payment Particulars</span>
                    </span>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {selectedLog.orderId && (
                        <div>
                          <span className="text-slate-400">Order ID:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 ml-1.5">
                            {selectedLog.targetName || `#${selectedLog.orderId.slice(-6).toUpperCase()}`}
                          </span>
                        </div>
                      )}
                      {selectedLog.amount !== null && (
                        <div>
                          <span className="text-slate-400">Amount:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 ml-1.5">
                            {formatINR(selectedLog.amount)}
                          </span>
                        </div>
                      )}
                      {selectedLog.paymentMethod && (
                        <div>
                          <span className="text-slate-400">Method:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 ml-1.5">
                            {selectedLog.paymentMethod}
                          </span>
                        </div>
                      )}
                      {selectedLog.counterName && (
                        <div>
                          <span className="text-slate-400">Counter:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 ml-1.5">
                            {selectedLog.counterName}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Device & Client Network Information */}
                <div className="p-4 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <FiMonitor className="text-sky-500" />
                    <span>Device & Network Origin</span>
                  </span>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block">Device Name</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {selectedLog.deviceName}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block">Device Type</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200 capitalize">
                        {selectedLog.deviceType}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block">Operating System</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {selectedLog.os}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block">Browser</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {selectedLog.browser}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block">IP Address</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {selectedLog.ipAddress}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block">Session ID</span>
                      <div className="flex items-center gap-1 text-slate-800 dark:text-slate-200">
                        <span className="truncate max-w-[120px] font-mono text-[11px]">
                          {selectedLog.sessionId || "N/A"}
                        </span>
                        {selectedLog.sessionId && (
                          <button
                            onClick={() => handleCopySession(selectedLog.sessionId)}
                            className="text-slate-400 hover:text-indigo-600 transition"
                            title="Copy session ID"
                          >
                            {copiedSession ? <FiCheck className="text-emerald-500" /> : <FiCopy />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Failure Reason / Security Warning (if any) */}
                {selectedLog.failureReason && (
                  <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-900/60 text-xs">
                    <span className="text-rose-600 dark:text-rose-400 font-bold uppercase tracking-wider block mb-1">
                      Failure Reason / Error
                    </span>
                    <p className="text-rose-900 dark:text-rose-200 font-medium">
                      {selectedLog.failureReason}
                    </p>
                  </div>
                )}

                {/* Technical Metadata (Sanitized) */}
                {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Additional Sanitized Metadata
                    </span>
                    <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl text-[11px] overflow-x-auto font-mono">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex items-center justify-between text-xs text-slate-400">
                <span>Recorded: {formatISTDateTime(selectedLog.timestamp)} IST</span>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium rounded-xl transition"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── 21. RETENTION POLICY & CLEANUP MODAL ──────────────────────────── */}
      <AnimatePresence>
        {showRetentionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 flex items-center justify-center">
                    <FiShield />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Audit Log Retention Policy
                  </h3>
                </div>
                <button
                  onClick={() => setShowRetentionModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <FiX />
                </button>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure automated and manual audit history retention. Audit logs are kept for compliance and accountability.
              </p>

              {/* Stats Box */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex justify-between">
                  <span>Total Stored Records:</span>
                  <strong className="text-slate-900 dark:text-white">
                    {retentionStats.totalCount.toLocaleString()}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Oldest Record Date:</span>
                  <span>{retentionStats.oldestLogDate ? formatISTDate(retentionStats.oldestLogDate) : "None"}</span>
                </div>
              </div>

              {/* Policy Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Select Retention Duration:
                </label>
                <select
                  value={retentionPolicy}
                  onChange={(e) => setRetentionPolicy(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="forever">Forever (Keep all audit history indefinitely)</option>
                  <option value="30">30 Days</option>
                  <option value="90">90 Days</option>
                  <option value="180">180 Days (6 Months)</option>
                  <option value="365">1 Year (365 Days)</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-between gap-2">
                <button
                  onClick={handleRunCleanup}
                  disabled={cleaningLogs}
                  className="px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl font-medium transition disabled:opacity-50"
                >
                  {cleaningLogs ? "Cleaning..." : "Run Cleanup Now"}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowRetentionModal(false)}
                    className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveRetentionPolicy}
                    disabled={savingPolicy}
                    className="px-4 py-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition shadow-sm disabled:opacity-50"
                  >
                    {savingPolicy ? "Saving..." : "Save Policy"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
