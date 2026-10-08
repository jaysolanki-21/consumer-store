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
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(d) + " IST";
  } catch (e) {
    return String(isoDate);
  }
}

// Calculate relative freshness string (e.g., "12 min ago", "2 hours ago", "Just now")
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
}) {
  // Stored / Current AI Insight
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

  // History modal / dropdown
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const filterFrom = filters?.from || "";
  const filterTo = filters?.to || "";

  // 1. Fetch latest persistent insight from backend on mount or when filters are established
  const fetchLatestSavedInsight = useCallback(async () => {
    try {
      setIsLoadingInitial(true);
      const { data } = await api.get("/insights/ai/latest", {
        params: { from: filterFrom, to: filterTo },
      });

      if (data?.insight) {
        setInsight(data.insight);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data.insight));
        } catch (e) {}
      }
    } catch (err) {
      console.warn("Could not load latest AI insight from server:", err.message);
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
        toast.success("AI Business Insights generated successfully!", {
          id: "ai-insight-success",
        });
      }
    } catch (err) {
      console.error("AI Insight generation error:", err);
      const errMsg =
        err?.response?.data?.message ||
        "Unable to generate new insights. Your previous analysis is still available.";
      setError(errMsg);
      toast.error(errMsg, { id: "ai-insight-error", duration: 5000 });
    } finally {
      setIsGenerating(false);
    }
  };

  // Determine period mismatch
  const isPeriodMismatch = useMemo(() => {
    if (!insight?.period || !filterFrom || !filterTo) return false;
    return insight.period.from !== filterFrom || insight.period.to !== filterTo;
  }, [insight, filterFrom, filterTo]);

  // Determine freshness
  const freshnessStatus = useMemo(() => {
    if (!insight?.generatedAt) return null;
    const diffMs = Date.now() - new Date(insight.generatedAt).getTime();
    const isUnder30Min = diffMs < 30 * 60 * 1000;
    const isLiveChanged =
      insight.metadata?.ordersAnalyzed !== undefined &&
      currentLiveOrders > 0 &&
      Math.abs(currentLiveOrders - insight.metadata.ordersAnalyzed) > 2;

    if (isUnder30Min && !isLiveChanged) {
      return {
        label: "Fresh",
        color: "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
        dot: "bg-emerald-500",
      };
    }
    return {
      label: isLiveChanged ? "Data Updated" : "Cached",
      color: "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
      dot: "bg-amber-500",
    };
  }, [insight, currentLiveOrders]);

  // Section icons and colors
  const getSectionMeta = (type = "") => {
    const t = type.toLowerCase();
    if (t === "sales") {
      return {
        icon: <FiTrendingUp className="text-indigo-500" />,
        badge: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
        label: "Sales Performance",
      };
    }
    if (t === "profit") {
      return {
        icon: <FaRupeeSign className="text-emerald-500" />,
        badge: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
        label: "Profit & Contribution",
      };
    }
    if (t === "inventory") {
      return {
        icon: <FiPackage className="text-amber-500" />,
        badge: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
        label: "Inventory Alert",
      };
    }
    if (t === "operations") {
      return {
        icon: <FiUsers className="text-blue-500" />,
        badge: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
        label: "Store Operations",
      };
    }
    if (t === "recommendation") {
      return {
        icon: <FiAward className="text-purple-500" />,
        badge: "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
        label: "Recommendation",
      };
    }
    return {
      icon: <FiZap className="text-slate-500" />,
      badge: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700",
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
          INFO
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
  // RENDER: EMPTY STATE (First-time user)
  // ==========================================
  if (!insight && !isLoadingInitial && !isGenerating) {
    return (
      <section className="w-full bg-gradient-to-br from-indigo-50/40 via-white to-purple-50/40 dark:from-[#111827] dark:via-[#111827] dark:to-[#171e2e] rounded-2xl border border-indigo-200/80 dark:border-indigo-900/50 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center text-xl shadow-md shrink-0">
              <FiZap />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-[#F8FAFC]">
                  AI Business Insights
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  PREMIUM BI
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-[#94A3B8] mt-1 font-normal max-w-2xl">
                Turn your store data into actionable executive observations.
                AI analyzes sales velocity, profit margins, inventory depletion
                risk, and peak operational hours based on actual transactions.
              </p>

              <div className="flex flex-wrap gap-2 mt-4 text-xs text-slate-500 dark:text-[#94A3B8]">
                <span className="flex items-center gap-1 bg-white dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                  <FiCheckCircle className="text-emerald-500" /> Sales Trends
                </span>
                <span className="flex items-center gap-1 bg-white dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                  <FiCheckCircle className="text-emerald-500" /> Profit Margins
                </span>
                <span className="flex items-center gap-1 bg-white dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                  <FiCheckCircle className="text-emerald-500" /> Stock Run-out Risks
                </span>
                <span className="flex items-center gap-1 bg-white dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                  <FiCheckCircle className="text-emerald-500" /> Peak Hour Shifts
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
            <button
              onClick={() => handleRegenerate()}
              className="inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold text-sm shadow-md hover:shadow-lg transition cursor-pointer"
            >
              <FiZap className="text-base" />
              <span>Generate First Insight</span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  // ==========================================
  // RENDER: PERSISTENT AI INSIGHT DASHBOARD
  // ==========================================
  const displayedSections = expanded
    ? insight?.sections || []
    : (insight?.sections || []).slice(0, 3);

  return (
    <section className="w-full bg-white dark:bg-[#111827] rounded-2xl border border-indigo-200/90 dark:border-indigo-900/60 p-5 sm:p-6 shadow-sm space-y-5">
      {/* ── TOP HEADER ── */}
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
              {freshnessStatus && (
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${freshnessStatus.color}`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${freshnessStatus.dot} animate-pulse`}
                  />
                  {freshnessStatus.label} · {getRelativeFreshness(insight?.generatedAt)}
                </span>
              )}

              {/* In-progress spinner badge */}
              {isGenerating && (
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 animate-pulse">
                  <FiRefreshCw className="animate-spin text-xs" />
                  Generating new analysis...
                </span>
              )}
            </div>

            <p className="text-xs sm:text-sm text-slate-500 dark:text-[#94A3B8] mt-1 font-normal">
              AI-powered observations and actionable recommendations based on your store performance.
            </p>

            {/* Snapshot metadata */}
            {insight && (
              <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 dark:text-[#94A3B8] flex-wrap font-normal">
                <span className="flex items-center gap-1">
                  <FiClock className="text-slate-400" />
                  Generated: <span className="font-medium text-slate-700 dark:text-slate-300">{formatIST(insight.generatedAt)}</span>
                </span>
                <span>•</span>
                <span>
                  Period: <span className="font-medium text-slate-700 dark:text-slate-300">{insight.period?.from} – {insight.period?.to}</span>
                </span>
                <span>•</span>
                <span>
                  Snapshot: <span className="font-semibold text-slate-800 dark:text-slate-200">{insight.metadata?.ordersAnalyzed ?? 0}</span> orders (₹{(insight.metadata?.revenueAnalyzed ?? 0).toLocaleString("en-IN")})
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 self-start lg:self-center shrink-0 flex-wrap">
          <button
            onClick={toggleHistoryModal}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="View Analysis History"
          >
            <FiRotateCcw className="text-xs" />
            <span className="hidden sm:inline">History</span>
          </button>

          <button
            onClick={() => handleRegenerate()}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs sm:text-sm font-semibold shadow-xs disabled:opacity-60 transition cursor-pointer"
          >
            <FiRefreshCw
              className={`text-xs ${isGenerating ? "animate-spin" : ""}`}
            />
            <span>{isGenerating ? "Generating..." : "Regenerate Insights"}</span>
          </button>
        </div>
      </div>

      {/* ── FILTER MISMATCH NOTICE (Requirement 25) ── */}
      {isPeriodMismatch && (
        <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-amber-800 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <FiAlertTriangle className="text-amber-600 dark:text-amber-400 text-base shrink-0" />
            <span>
              Analysis was generated for <strong>{insight.period?.from} – {insight.period?.to}</strong>, but current filter is <strong>{filterFrom} – {filterTo}</strong>.
            </span>
          </div>
          <button
            onClick={() => handleRegenerate()}
            disabled={isGenerating}
            className="self-start sm:self-auto px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition cursor-pointer shrink-0"
          >
            Regenerate for selected period
          </button>
        </div>
      )}

      {/* ── ERROR BANNER (Requirement 27) ── */}
      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl p-3 sm:p-4 flex items-start gap-3 text-xs text-rose-800 dark:text-rose-200">
          <FiAlertTriangle className="text-rose-500 text-base shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Unable to generate new insights</p>
            <p className="mt-0.5 opacity-90">{error}</p>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Your previous analysis is still available and intact below.
            </p>
          </div>
          <button
            onClick={() => handleRegenerate()}
            className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shrink-0 cursor-pointer"
          >
            Try Again
          </button>
        </div>
      )}

      {/* ── LIVE DATA VS SNAPSHOT (Requirement 9 & 10) ── */}
      <div className="bg-slate-50 dark:bg-[#0B1120] rounded-xl border border-slate-200/70 dark:border-slate-800/80 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
          <span>Live Store Data:</span>
          <strong className="text-slate-900 dark:text-[#F8FAFC]">
            {currentLiveOrders} orders · ₹{currentLiveRevenue.toLocaleString("en-IN")}
          </strong>
        </div>

        <div className="text-slate-500 dark:text-[#94A3B8]">
          AI Snapshot:{" "}
          <strong className="text-slate-700 dark:text-slate-300">
            {insight?.metadata?.ordersAnalyzed ?? 0} orders · ₹{(insight?.metadata?.revenueAnalyzed ?? 0).toLocaleString("en-IN")}
          </strong>
        </div>
      </div>

      {/* ── KEY TAKEAWAYS (Requirement 15) ── */}
      {Array.isArray(insight?.takeaways) && insight.takeaways.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-slate-400 dark:text-[#94A3B8] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <FiActivity className="text-indigo-500" />
            Key Executive Takeaways
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {insight.takeaways.map((takeaway, idx) => (
              <div
                key={idx}
                className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-xl p-3.5 flex items-start gap-2.5"
              >
                <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs shrink-0 font-bold mt-0.5">
                  {idx + 1}
                </div>
                <p className="text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                  {takeaway}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── DETAILED CATEGORIZED INSIGHTS (Requirement 12, 13, 14) ── */}
      <div>
        <h3 className="text-xs font-bold text-slate-400 dark:text-[#94A3B8] uppercase tracking-wider mb-3">
          Detailed Business Analysis
        </h3>

        {displayedSections.length === 0 ? (
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed font-normal">
            {insight?.rawInsights || insight?.insights || "No detailed insights generated yet."}
          </div>
        ) : (
          <div className="space-y-3">
            {displayedSections.map((sec, idx) => {
              const meta = getSectionMeta(sec.type);
              return (
                <div
                  key={idx}
                  className="bg-slate-50/70 dark:bg-[#0F172A] border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 transition hover:border-slate-300 dark:hover:border-slate-700/80"
                >
                  <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{meta.icon}</span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-[#F8FAFC]">
                        {sec.title || meta.label}
                      </h4>
                    </div>
                    {getPriorityBadge(sec.priority)}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                    {sec.content}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Collapsible Toggle (Requirement 31) */}
        {insight?.sections?.length > 3 && (
          <div className="mt-3 text-center">
            <button
              onClick={() => setExpanded(!expanded)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition cursor-pointer"
            >
              <span>{expanded ? "Show Less" : `Show More (${insight.sections.length - 3} additional observations)`}</span>
              {expanded ? <FiChevronUp /> : <FiChevronDown />}
            </button>
          </div>
        )}
      </div>

      {/* ── HISTORY MODAL ── */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-5 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FiRotateCcw className="text-indigo-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Analysis History
                </h3>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <FiX className="text-base" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-2.5 flex-1 pr-1">
              {loadingHistory ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  <FiRefreshCw className="animate-spin inline mr-2" />
                  Loading history...
                </div>
              ) : historyList.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No previous analysis history recorded.
                </div>
              ) : (
                historyList.map((h, i) => (
                  <div
                    key={h._id || i}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-[#0B1120] border border-slate-200/80 dark:border-slate-800 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                      <span>{formatIST(h.generatedAt)}</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {h.period?.from} – {h.period?.to}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-300">
                      {h.metadata?.ordersAnalyzed ?? 0} orders analyzed · ₹{(h.metadata?.revenueAnalyzed ?? 0).toLocaleString("en-IN")} revenue
                    </div>
                    {h.takeaways?.length > 0 && (
                      <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium truncate">
                        • {h.takeaways[0]}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setShowHistory(false)}
              className="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
