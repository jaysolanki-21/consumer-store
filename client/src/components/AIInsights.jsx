import { useEffect, useState, useCallback, useMemo } from "react";
import {
  FiZap,
  FiRefreshCw,
  FiClock,
  FiCheckCircle,
  FiAlertTriangle,
  FiTrendingUp,
  FiDollarSign,
  FiPackage,
  FiUsers,
  FiCreditCard,
  FiChevronDown,
  FiChevronUp,
  FiRotateCcw,
  FiX,
  FiActivity,
  FiAward,
  FiCalendar,
  FiEye,
  FiShield,
  FiArrowRight,
  FiLayers,
} from "react-icons/fi";
import { FaRupeeSign } from "react-icons/fa";
import api from "../services/api";
import toast from "react-hot-toast";

const STORAGE_KEY = "pos_admin_ai_insight_latest";

// Format timestamp into IST (Asia/Kolkata)
function formatIST(isoDate) {
  if (!isoDate) return "--:--";
  try {
    const d = new Date(isoDate);
    return (
      new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(d) + " IST"
    );
  } catch (e) {
    return String(isoDate);
  }
}

// Calculate relative freshness string (e.g., "Just now", "12 min ago", "2 hours ago")
function getRelativeFreshness(isoDate) {
  if (!isoDate) return "Unknown";
  try {
    const diffMs = Date.now() - new Date(isoDate).getTime();
    if (diffMs < 60000) return "Just now";
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr${hours > 1 ? "s" : ""} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? "s" : ""} ago`;
  } catch (e) {
    return "Earlier";
  }
}

export default function AIInsights({
  filters,
  currentLiveOrders = 0,
  currentLiveRevenue = 0,
  canonicalAnalytics = null,
  onRefreshAnalytics,
}) {
  const [insight, setInsight] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [isLoadingInitial, setIsLoadingInitial] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);

  // History modal and snapshot preview
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedHistorySnapshot, setSelectedHistorySnapshot] = useState(null);

  const filterFrom = filters?.from || "";
  const filterTo = filters?.to || "";

  // 1. Fetch latest persistent insight for the CURRENT date range
  const fetchLatestSavedInsight = useCallback(async () => {
    if (!filterFrom || !filterTo) return;
    try {
      setIsLoadingInitial(true);
      setError(null);
      const { data } = await api.get("/insights/ai/latest", {
        params: { from: filterFrom, to: filterTo },
      });

      if (data?.hasSnapshot && data?.insight) {
        setInsight(data.insight);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data.insight));
        } catch (e) {}
      } else {
        // No snapshot exists yet for this specific period
        setInsight(null);
      }
    } catch (err) {
      console.warn("Could not load AI insight for period:", err.message);
    } finally {
      setIsLoadingInitial(false);
    }
  }, [filterFrom, filterTo]);

  useEffect(() => {
    fetchLatestSavedInsight();
  }, [fetchLatestSavedInsight]);

  // 2. Fetch history list
  const fetchHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const { data } = await api.get("/insights/ai/history");
      if (Array.isArray(data?.history)) {
        setHistoryList(data.history);
      }
    } catch (e) {
      console.error("Failed to fetch insight history:", e);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const toggleHistoryModal = () => {
    const next = !showHistory;
    setShowHistory(next);
    setSelectedHistorySnapshot(null);
    if (next) fetchHistory();
  };

  // 3. Generate / Regenerate AI Insights
  const handleRegenerate = async (targetFilters = filters) => {
    if (isGenerating) return;
    setIsGenerating(true);
    setError(null);

    try {
      const payload = {
        from: targetFilters?.from || filterFrom,
        to: targetFilters?.to || filterTo,
        forceRefresh: true,
      };

      const { data } = await api.post("/insights/ai", payload);

      if (data) {
        setInsight(data);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {}
        if (onRefreshAnalytics) {
          onRefreshAnalytics();
        }
        toast.success("AI Business Insights generated and synchronized!", {
          id: "ai-insight-success",
        });
      }
    } catch (err) {
      console.error("AI Insight generation error:", err);
      const errMsg =
        err?.response?.data?.message ||
        "Unable to generate new insights. Please try again.";
      setError(errMsg);
      toast.error(errMsg, { id: "ai-insight-error", duration: 5000 });
    } finally {
      setIsGenerating(false);
    }
  };

  // Period mismatch verification
  const isPeriodMismatch = useMemo(() => {
    if (!insight?.period || !filterFrom || !filterTo) return false;
    return insight.period.from !== filterFrom || insight.period.to !== filterTo;
  }, [insight, filterFrom, filterTo]);

  // Snapshot metrics resolution
  const snapshotOrders =
    insight?.metrics?.orders ?? insight?.metadata?.ordersAnalyzed ?? 0;
  const snapshotRevenue =
    insight?.metrics?.revenue ?? insight?.metadata?.revenueAnalyzed ?? 0;

  // Freshness & State Comparison
  const syncState = useMemo(() => {
    if (!insight) return null;

    if (isPeriodMismatch) {
      return {
        status: "mismatch",
        label: "Period Filter Mismatch",
        color:
          "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
        dot: "bg-amber-500",
        message: `Snapshot was computed for ${insight.period?.from} – ${insight.period?.to}. Current filter is ${filterFrom} – ${filterTo}.`,
      };
    }

    const orderDiff = currentLiveOrders - snapshotOrders;
    const revDiff = currentLiveRevenue - snapshotRevenue;

    if (orderDiff === 0 && revDiff === 0) {
      return {
        status: "synced",
        label: "Fresh & Synchronized",
        color:
          "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
        dot: "bg-emerald-500",
        message: `Snapshot matches live store transactions perfectly (${snapshotOrders} orders · ₹${snapshotRevenue.toLocaleString("en-IN")}).`,
      };
    }

    return {
      status: "updated",
      label: `Data Updated (${orderDiff > 0 ? `+${orderDiff}` : orderDiff} orders)`,
      color:
        "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
      dot: "bg-blue-500",
      message: `${Math.abs(orderDiff)} new order(s) confirmed since this snapshot was taken. Regenerate to sync.`,
    };
  }, [
    insight,
    isPeriodMismatch,
    currentLiveOrders,
    currentLiveRevenue,
    snapshotOrders,
    snapshotRevenue,
    filterFrom,
    filterTo,
  ]);

  // Section icons and styling
  const getSectionMeta = (type = "") => {
    const t = type.toLowerCase();
    if (t === "sales") {
      return {
        icon: <FiTrendingUp className="text-indigo-500" />,
        badge:
          "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
        label: "Sales Performance",
      };
    }
    if (t === "profit") {
      return {
        icon: <FaRupeeSign className="text-emerald-500" />,
        badge:
          "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
        label: "Profit Margin & Contribution",
      };
    }
    if (t === "inventory") {
      return {
        icon: <FiPackage className="text-amber-500" />,
        badge:
          "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
        label: "Inventory & Stock Risk",
      };
    }
    if (t === "operations") {
      return {
        icon: <FiUsers className="text-blue-500" />,
        badge:
          "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
        label: "Store Operations",
      };
    }
    return {
      icon: <FiZap className="text-purple-500" />,
      badge:
        "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
      label: "General Observation",
    };
  };

  const getPriorityBadge = (priority = "MEDIUM") => {
    const p = String(priority).toUpperCase();
    if (p === "HIGH") {
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
          HIGH PRIORITY
        </span>
      );
    }
    if (p === "LOW") {
      return (
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
          INFORMATIONAL
        </span>
      );
    }
    return (
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50">
        ACTIONABLE
      </span>
    );
  };

  // ==========================================
  // RENDER: EMPTY STATE (No snapshot for period)
  // ==========================================
  if (!insight && !isLoadingInitial) {
    return (
      <section className="w-full bg-white dark:bg-[#111827] rounded-2xl border border-indigo-200/90 dark:border-indigo-900/60 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center text-xl shadow-md shrink-0">
              <FiZap />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900 dark:text-[#F8FAFC]">
                  AI Business Insights
                </h2>
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Ready to Analyze
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-[#94A3B8] mt-1 font-normal max-w-2xl leading-relaxed">
                No saved AI analysis for <strong>{filterFrom} – {filterTo}</strong>.
                Generate a data-grounded report covering sales performance, profit margins, inventory depletion velocity, and store operations based on your {currentLiveOrders} live confirmed orders.
              </p>

              {/* Live store reference banner */}
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-[#0B1120] border border-slate-200/80 dark:border-slate-800 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-slate-600 dark:text-slate-400">
                  Live Period Data:{" "}
                  <strong className="text-slate-900 dark:text-white">
                    {currentLiveOrders} orders · ₹{currentLiveRevenue.toLocaleString("en-IN")}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={toggleHistoryModal}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <FiRotateCcw className="text-xs" />
              <span>History</span>
            </button>

            <button
              onClick={() => handleRegenerate()}
              disabled={isGenerating}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold text-xs sm:text-sm shadow-md hover:shadow-lg transition cursor-pointer disabled:opacity-60"
            >
              <FiZap className={`text-base ${isGenerating ? "animate-spin" : ""}`} />
              <span>{isGenerating ? "Analyzing Store Data..." : "Generate Insights"}</span>
            </button>
          </div>
        </div>

        {/* History Modal rendered even in empty state */}
        {renderHistoryModal()}
      </section>
    );
  }

  // ==========================================
  // RENDER: PERSISTENT AI INSIGHT DASHBOARD
  // ==========================================
  const displayedSections = expanded
    ? insight?.sections || []
    : (insight?.sections || []).slice(0, 4);

  return (
    <section className="w-full bg-white dark:bg-[#111827] rounded-2xl border border-indigo-200/90 dark:border-indigo-900/60 p-5 sm:p-6 shadow-xs space-y-6">
      {/* ── 1. TOP HEADER & CONTROLS ── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center text-lg shadow-sm shrink-0 mt-0.5">
            <FiZap />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-[#F8FAFC]">
                AI Business Insights
              </h2>

              {/* Status Badge */}
              {syncState && (
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${syncState.color}`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${syncState.dot} ${
                      syncState.status !== "synced" ? "animate-pulse" : ""
                    }`}
                  />
                  {syncState.label} · {getRelativeFreshness(insight?.generatedAt)}
                </span>
              )}

              {/* In-progress spinner */}
              {isGenerating && (
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 animate-pulse">
                  <FiRefreshCw className="animate-spin text-xs" />
                  Generating fresh analysis...
                </span>
              )}
            </div>

            <p className="text-xs sm:text-sm text-slate-500 dark:text-[#94A3B8] mt-1 font-normal">
              Senior retail business intelligence synthesizing revenue velocity, margin quality, stock depletion risks, and store throughput.
            </p>

            {/* Snapshot metadata */}
            <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 dark:text-[#94A3B8] flex-wrap font-normal">
              <span className="flex items-center gap-1">
                <FiClock className="text-slate-400" />
                Generated:{" "}
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {formatIST(insight?.generatedAt)}
                </span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <FiCalendar className="text-slate-400" />
                Period:{" "}
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {insight?.period?.from} to {insight?.period?.to}
                </span>
              </span>
              <span>•</span>
              <span>
                By:{" "}
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {insight?.generatedByName || "Administrator"}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 self-start lg:self-center shrink-0 flex-wrap">
          <button
            onClick={toggleHistoryModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="View Analysis History"
          >
            <FiRotateCcw className="text-xs" />
            <span>History</span>
          </button>

          <button
            onClick={() => handleRegenerate()}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs sm:text-sm font-semibold shadow-xs disabled:opacity-60 transition cursor-pointer"
          >
            <FiRefreshCw
              className={`text-xs ${isGenerating ? "animate-spin" : ""}`}
            />
            <span>{isGenerating ? "Analyzing..." : "Regenerate Insights"}</span>
          </button>
        </div>
      </div>

      {/* ── 2. LIVE STORE DATA VS AI SNAPSHOT COMPARISON BANNER ── */}
      <div className="bg-slate-50/90 dark:bg-[#0B1120] rounded-xl border border-slate-200/80 dark:border-slate-800 p-4 space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Live Store Data */}
            <div className="flex items-center gap-2 text-xs">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-slate-500 dark:text-[#94A3B8]">Live Store Data:</span>
              <span className="font-bold text-slate-900 dark:text-[#F8FAFC] tabular-nums">
                {currentLiveOrders} orders · ₹{currentLiveRevenue.toLocaleString("en-IN")}
              </span>
            </div>

            <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">|</span>

            {/* AI Snapshot */}
            <div className="flex items-center gap-2 text-xs">
              <span className="flex h-2.5 w-2.5 rounded-full bg-indigo-500 shrink-0" />
              <span className="text-slate-500 dark:text-[#94A3B8]">AI Snapshot:</span>
              <span className="font-bold text-slate-900 dark:text-[#F8FAFC] tabular-nums">
                {snapshotOrders} orders · ₹{snapshotRevenue.toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          {/* Sync status message */}
          {syncState && (
            <div className="text-xs text-slate-500 dark:text-[#94A3B8]">
              {syncState.message}
            </div>
          )}
        </div>

        {/* Warning & 1-click sync if mismatched */}
        {syncState?.status !== "synced" && (
          <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between gap-3 text-xs flex-wrap">
            <span className="text-amber-700 dark:text-amber-400 font-medium">
              {syncState?.status === "mismatch"
                ? `Selected filter (${filterFrom} to ${filterTo}) does not match snapshot period.`
                : "Live store orders have changed since this analysis was generated."}
            </span>
            <button
              onClick={() => handleRegenerate()}
              disabled={isGenerating}
              className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
            >
              Regenerate now to synchronize →
            </button>
          </div>
        )}
      </div>

      {/* ── 3. ERROR BANNER ── */}
      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl p-4 flex items-start gap-3 text-xs text-rose-800 dark:text-rose-200">
          <FiAlertTriangle className="text-rose-500 text-base shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Unable to generate new insights</p>
            <p className="mt-0.5 opacity-90">{error}</p>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Your previous analysis remains intact and available below.
            </p>
          </div>
          <button
            onClick={() => handleRegenerate()}
            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shrink-0 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── 4. KEY EXECUTIVE TAKEAWAYS (3 DISTINCT CARDS) ── */}
      {Array.isArray(insight?.takeaways) && insight.takeaways.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider flex items-center gap-1.5">
              <FiActivity className="text-indigo-500" />
              Key Executive Takeaways
            </h3>
            <span className="text-[11px] text-slate-400 dark:text-[#64748B]">
              3 Core Pillars
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* Takeaway 1: Overall Performance */}
            <div className="bg-gradient-to-br from-indigo-50/70 via-white to-indigo-50/20 dark:from-[#0F172A] dark:via-[#111827] dark:to-[#0F172A] border border-indigo-100 dark:border-indigo-900/50 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
                    1. Overall Performance
                  </span>
                  <div className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs">
                    <FiTrendingUp />
                  </div>
                </div>
                <p className="text-xs sm:text-[13px] text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                  {insight.takeaways[0]}
                </p>
              </div>
            </div>

            {/* Takeaway 2: Products & Inventory */}
            <div className="bg-gradient-to-br from-emerald-50/70 via-white to-emerald-50/20 dark:from-[#0F172A] dark:via-[#111827] dark:to-[#0F172A] border border-emerald-100 dark:border-emerald-900/50 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                    2. Products & Inventory
                  </span>
                  <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs">
                    <FiPackage />
                  </div>
                </div>
                <p className="text-xs sm:text-[13px] text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                  {insight.takeaways[1] || insight.takeaways[0]}
                </p>
              </div>
            </div>

            {/* Takeaway 3: Store Operations */}
            <div className="bg-gradient-to-br from-purple-50/70 via-white to-purple-50/20 dark:from-[#0F172A] dark:via-[#111827] dark:to-[#0F172A] border border-purple-100 dark:border-purple-900/50 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[11px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider">
                    3. Store Operations
                  </span>
                  <div className="w-6 h-6 rounded-lg bg-purple-100 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 flex items-center justify-center text-xs">
                    <FiUsers />
                  </div>
                </div>
                <p className="text-xs sm:text-[13px] text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                  {insight.takeaways[2] || insight.takeaways[0]}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 5. DETAILED CATEGORIZED BUSINESS ANALYSIS ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider">
            Detailed Business Analysis
          </h3>
          <span className="text-[11px] text-slate-400 dark:text-[#64748B]">
            Sales · Profit · Inventory · Operations
          </span>
        </div>

        {displayedSections.length === 0 ? (
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed font-normal">
            {insight?.rawInsights || "No detailed insights generated yet."}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {displayedSections.map((sec, idx) => {
              const meta = getSectionMeta(sec.type);
              return (
                <div
                  key={idx}
                  className="bg-slate-50/70 dark:bg-[#0F172A] border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700/80 transition"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{meta.icon}</span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-[#F8FAFC]">
                          {sec.title || meta.label}
                        </h4>
                      </div>
                      {getPriorityBadge(sec.priority)}
                    </div>
                    <p className="text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                      {sec.content}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Collapsible toggle if more than 4 sections */}
        {insight?.sections?.length > 4 && (
          <div className="mt-3 text-center">
            <button
              onClick={() => setExpanded(!expanded)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition cursor-pointer"
            >
              <span>
                {expanded
                  ? "Show Less"
                  : `Show More (${insight.sections.length - 4} additional observations)`}
              </span>
              {expanded ? <FiChevronUp /> : <FiChevronDown />}
            </button>
          </div>
        )}
      </div>

      {/* ── 6. ACTIONABLE RECOMMENDATIONS ── */}
      {Array.isArray(insight?.recommendations) && insight.recommendations.length > 0 && (
        <div className="pt-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider flex items-center gap-1.5">
              <FiAward className="text-purple-500" />
              Actionable Business Recommendations
            </h3>
            <span className="text-[11px] text-slate-400 dark:text-[#64748B]">
              Data-Driven Growth Steps
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {insight.recommendations.map((rec, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-[#0B1120] border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-2xs"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-[#F8FAFC]">
                      {rec.title}
                    </h4>
                    {getPriorityBadge(rec.priority)}
                  </div>

                  {rec.evidence && (
                    <div className="text-[11px] text-slate-500 dark:text-[#94A3B8] mb-2 bg-slate-50 dark:bg-[#111827] px-2.5 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800/80">
                      <strong>Evidence:</strong> {rec.evidence}
                    </div>
                  )}

                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-normal mb-2.5">
                    <strong>Action:</strong> {rec.action}
                  </p>
                </div>

                {rec.benefit && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <FiCheckCircle className="shrink-0" />
                    <span>Expected Benefit: {rec.benefit}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 7. ANALYSIS HISTORY MODAL & SNAPSHOT PREVIEW ── */}
      {renderHistoryModal()}
    </section>
  );

  // Helper to render History Modal and historical snapshot preview
  function renderHistoryModal() {
    if (!showHistory) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl p-5 space-y-4 max-h-[85vh] flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <FiRotateCcw className="text-indigo-500" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {selectedHistorySnapshot ? "Historical Snapshot View" : "Analysis History"}
              </h3>
            </div>
            <button
              onClick={() => setShowHistory(false)}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
            >
              <FiX className="text-base" />
            </button>
          </div>

          {selectedHistorySnapshot ? (
            /* Historical Snapshot Preview */
            <div className="overflow-y-auto space-y-4 flex-1 pr-1 text-xs">
              <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900 p-3 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    Period: {selectedHistorySnapshot.period?.from} to {selectedHistorySnapshot.period?.to}
                  </span>
                  <p className="text-slate-500 mt-0.5">
                    Generated: {formatIST(selectedHistorySnapshot.generatedAt)} by {selectedHistorySnapshot.generatedByName || "Administrator"}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedHistorySnapshot(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold"
                >
                  ← Back to List
                </button>
              </div>

              {/* Historical Takeaways */}
              {selectedHistorySnapshot.takeaways?.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="font-bold text-slate-700 dark:text-slate-300">Executive Takeaways</h4>
                  {selectedHistorySnapshot.takeaways.map((t, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                      • {t}
                    </div>
                  ))}
                </div>
              )}

              {/* Historical Metrics */}
              {selectedHistorySnapshot.metrics && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase">Revenue</span>
                    <p className="font-bold text-sm">₹{Number(selectedHistorySnapshot.metrics.revenue || 0).toLocaleString("en-IN")}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase">Orders</span>
                    <p className="font-bold text-sm">{selectedHistorySnapshot.metrics.orders || 0}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase">Profit</span>
                    <p className="font-bold text-sm">₹{Number(selectedHistorySnapshot.metrics.profit || 0).toLocaleString("en-IN")}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase">Margin</span>
                    <p className="font-bold text-sm">{selectedHistorySnapshot.metrics.margin || 0}%</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* History List */
            <div className="overflow-y-auto space-y-2.5 flex-1 pr-1">
              {loadingHistory ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  <FiRefreshCw className="animate-spin inline mr-2" />
                  Loading snapshot history...
                </div>
              ) : historyList.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No previous analysis history recorded.
                </div>
              ) : (
                historyList.map((h, i) => (
                  <div
                    key={h._id || i}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0B1120] border border-slate-200/80 dark:border-slate-800 text-xs space-y-2 hover:border-slate-300 dark:hover:border-slate-700 transition"
                  >
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                      <span className="font-medium">{formatIST(h.generatedAt)}</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                        {h.period?.from} to {h.period?.to}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-[11px] text-slate-600 dark:text-slate-300">
                        <strong>{h.metadata?.ordersAnalyzed ?? 0} orders</strong> analyzed · ₹{(h.metadata?.revenueAnalyzed ?? 0).toLocaleString("en-IN")} revenue
                      </div>

                      <button
                        onClick={async () => {
                          try {
                            const { data } = await api.get(`/insights/ai/${h._id}`);
                            if (data?.insight) setSelectedHistorySnapshot(data.insight);
                          } catch (err) {
                            toast.error("Could not load snapshot details.");
                          }
                        }}
                        className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
                      >
                        <FiEye className="text-xs" />
                        <span>View</span>
                      </button>
                    </div>

                    {h.takeaways?.length > 0 && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 italic truncate">
                        • {h.takeaways[0]}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          <button
            onClick={() => setShowHistory(false)}
            className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    );
  }
}
