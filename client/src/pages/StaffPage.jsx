import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import api from "../services/api";
import socket from "../services/socket";
import PaginationBar from "../components/PaginationBar";

import {
  FiCheckCircle,
  FiXCircle,
  FiSearch,
  FiClock,
  FiPackage,
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiChevronDown,
  FiChevronUp,
  FiActivity,
  FiVolume2,
  FiVolumeX,
  FiMonitor,
  FiCreditCard,
  FiRefreshCw,
  FiCheck,
} from "react-icons/fi";
import { FaRupeeSign } from "react-icons/fa";

// Notification sound URL
const NOTIFICATION_SOUND_URL = "/sounds/notification-bell.mp3";

// Toast configuration
const STAFF_TOAST_CONFIG = {
  position: "top-center",
  duration: 3000,
  style: {
    background: "#0f172a",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: "500",
    borderRadius: "12px",
    padding: "12px 20px",
    boxShadow:
      "0 10px 25px -5px rgba(15, 23, 42, 0.25), 0 8px 10px -6px rgba(15, 23, 42, 0.15)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
  },
  iconTheme: {
    primary: "#10b981",
    secondary: "#ffffff",
  },
};

// IST Date Functions
function getTodayLocal() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);
  const year = istDate.getUTCFullYear();
  const month = String(istDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(istDate.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTime(date) {
  if (!date) return "--:--";
  const d = new Date(date);
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

function getCounterName(order) {
  if (!order) return "Counter 1";
  if (typeof order === "object") {
    if (order.counter?.name) return order.counter.name;
    if (order.counterName && !order.counterName.match(/^[0-9a-fA-F]{24}$/)) {
      return order.counterName;
    }
    return "Counter 1";
  }
  return "Counter 1";
}

function getPaymentMethod(order) {
  if (!order) return "Cash";
  const m = order.payment?.method || order.paymentMethod || "Cash";
  return m.toLowerCase() === "cash" ? "Cash" : "Online";
}

function getISTDateFromUTC(utcDateString) {
  if (!utcDateString) return "";
  const date = new Date(utcDateString);
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(date.getTime() + istOffset);
  const year = istDate.getUTCFullYear();
  const month = String(istDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(istDate.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isSameISTDate(orderCreatedAt, filterDate) {
  return getISTDateFromUTC(orderCreatedAt) === filterDate;
}

function matchesFilters(order, { filterDate, filterCounter, filterPayment, filter }) {
  if (!order) return false;
  // Date check
  if (filterDate && filterDate !== "all") {
    if (!isSameISTDate(order.createdAt || new Date(), filterDate)) return false;
  }
  // Counter check
  if (filterCounter && filterCounter !== "all") {
    const cName = getCounterName(order);
    if (
      cName !== filterCounter &&
      order.counterId !== filterCounter &&
      order.counter !== filterCounter
    ) {
      return false;
    }
  }
  // Payment check
  if (filterPayment && filterPayment !== "all") {
    const pMethod = getPaymentMethod(order);
    if (pMethod.toLowerCase() !== filterPayment.toLowerCase()) return false;
  }
  // Search text check
  if (filter && filter.trim()) {
    const term = filter.trim().toLowerCase().replace(/^#/, "");
    const id = String(order._id || "").toLowerCase();
    const invoice = String(order.invoiceNumber || "").toLowerCase();
    const bill = String(order.billNumber || "").toLowerCase();
    const items = (order.items || [])
      .map((it) => (it.productId?.name || it.name || "").toLowerCase())
      .join(" ");
    if (
      !id.includes(term) &&
      !invoice.includes(term) &&
      !bill.includes(term) &&
      !items.includes(term)
    ) {
      return false;
    }
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// ORDER CARD COMPONENT (COLLAPSED BY DEFAULT, ACCORDION EXPAND)
// ─────────────────────────────────────────────────────────────────────────────
function StaffOrderCard({
  order,
  isExpanded,
  onToggleExpand,
  onConfirm,
  isConfirming,
}) {
  const shortId = `#${
    order.billNumber
      ? String(order.billNumber).slice(-6)
      : order.invoiceNumber
      ? String(order.invoiceNumber).slice(-6)
      : String(order._id || "").slice(-6)
  }`;
  const formattedTime = formatTime(order.createdAt);
  const counterName = getCounterName(order);
  const paymentMethod = getPaymentMethod(order);
  const isCash = paymentMethod === "Cash";
  const itemCount = (order.items || []).reduce(
    (sum, it) => sum + (it.quantity || 1),
    0
  );
  const isPending = order.status === "Pending" || order.status === "Processing";
  const isConfirmed = order.status === "Confirmed" || order.status === "Completed";
  const isCancelled = order.status === "Cancelled" || order.status === "Rejected";

  return (
    <div
      className={`w-full rounded-2xl transition-all duration-200 border bg-white dark:bg-slate-900 shadow-xs overflow-hidden ${
        isExpanded
          ? "border-indigo-500/60 dark:border-indigo-500/60 ring-2 ring-indigo-500/10 shadow-md"
          : isPending
          ? "border-amber-200/90 dark:border-amber-900/40 hover:border-amber-300 dark:hover:border-amber-700/60"
          : isConfirmed
          ? "border-emerald-200/90 dark:border-emerald-900/40 hover:border-emerald-300 dark:hover:border-emerald-700/60"
          : "border-slate-200 dark:border-slate-800"
      }`}
    >
      {/* ── COLLAPSED HEADER ROW ── */}
      <div
        onClick={onToggleExpand}
        className="px-4 sm:px-5 py-3 sm:py-3.5 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
      >
        {/* Left Side: Meta info */}
        <div className="flex-1 min-w-0 pr-2">
          {/* Top Line: ID · Time · Counter · Payment */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span className="font-mono font-bold text-xs sm:text-sm text-slate-900 dark:text-white uppercase tracking-tight">
              {shortId}
            </span>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300">
              <FiClock className="w-3.5 h-3.5 text-slate-400" />
              {formattedTime}
            </span>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <span className="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
              <FiMonitor className="w-3.5 h-3.5 text-indigo-500" />
              {counterName}
            </span>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-semibold border ${
                isCash
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60"
                  : "bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200 dark:border-purple-800/60"
              }`}
            >
              {paymentMethod}
            </span>
          </div>

          {/* Second Line: Items count & Status badge */}
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
              {itemCount} {itemCount === 1 ? "Item" : "Items"}
            </span>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            {/* Status Badge */}
            {isPending ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                Pending
              </span>
            ) : isConfirmed ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                <FiCheck className="w-3 h-3" />
                Completed
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
                Cancelled
              </span>
            )}
          </div>
        </div>

        {/* Right Side: Total Amount & Chevron */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tabular-nums">
              ₹{Number(order.totalAmount || 0).toLocaleString("en-IN")}
            </div>
          </div>

          <div className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            {isExpanded ? (
              <FiChevronUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            ) : (
              <FiChevronDown className="w-5 h-5" />
            )}
          </div>
        </div>
      </div>

      {/* ── EXPANDED PRODUCTS DETAIL & CONFIRM BUTTON ── */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40"
          >
            <div className="p-4 sm:p-5 space-y-4">
              {/* Product Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900">
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                      <th className="py-2.5 px-3 sm:px-4 text-left">Product</th>
                      <th className="py-2.5 px-3 sm:px-4 text-center">Qty</th>
                      <th className="py-2.5 px-3 sm:px-4 text-right">Price</th>
                      <th className="py-2.5 px-3 sm:px-4 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {(order.items || []).map((item, idx) => {
                      const name =
                        item.productId?.name || item.name || `Item ${idx + 1}`;
                      const price = Number(item.price || item.sellingPrice || 0);
                      const qty = Number(item.quantity || 1);
                      return (
                        <tr
                          key={idx}
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                        >
                          <td className="py-2.5 px-3 sm:px-4 font-medium text-slate-850 dark:text-slate-200">
                            {name}
                          </td>
                          <td className="py-2.5 px-3 sm:px-4 text-center">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-semibold text-xs">
                              {qty}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 sm:px-4 text-right text-slate-600 dark:text-slate-400">
                            ₹{price.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 sm:px-4 text-right font-bold text-slate-900 dark:text-white">
                            ₹{(price * qty).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Total & Action Footer */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Total Bill Amount:
                  </span>
                  <span className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white ml-2">
                    ₹{Number(order.totalAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Confirm Action Button (ONLY for Pending orders) */}
                {isPending && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onConfirm(order._id);
                    }}
                    disabled={isConfirming}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 cursor-pointer"
                  >
                    {isConfirming ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        <span>Confirming...</span>
                      </>
                    ) : (
                      <>
                        <FiCheckCircle className="text-base" />
                        <span>Confirm Order</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN STAFF PAGE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function StaffPage() {
  const dispatch = useDispatch();

  // Filters State
  const [filterDate, setFilterDate] = useState(getTodayLocal);
  const [filterCounter, setFilterCounter] = useState("all");
  const [filterPayment, setFilterPayment] = useState("all");
  const [filter, setFilter] = useState("");
  const [activeTab, setActiveTab] = useState("pending");

  // Pagination State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Data & Loading State
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({ pending: 0, confirmed: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [livePulse, setLivePulse] = useState(false);
  const [countersList, setCountersList] = useState([]);

  // Accordion: only one order expanded at a time
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  // Action loading state
  const [confirmingId, setConfirmingId] = useState(null);

  // Sound Toggle
  const [soundEnabled, setSoundEnabled] = useState(false);
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  const processedEventsRef = useRef(new Set());

  // Fetch Available Counters
  useEffect(() => {
    const loadCounters = async () => {
      try {
        const { data } = await api.get("/counters").catch(() => ({ data: [] }));
        if (Array.isArray(data)) {
          const names = Array.from(
            new Set(data.map((c) => c.name).filter(Boolean))
          ).sort((a, b) => {
            const na = parseInt(String(a).match(/\d+/)?.[0] || "999", 10);
            const nb = parseInt(String(b).match(/\d+/)?.[0] || "999", 10);
            return na - nb;
          });
          setCountersList(names);
        }
      } catch (e) {
        console.error("Failed to load counters", e);
      }
    };
    loadCounters();
  }, []);

  // Notification Sound Helper
  const playNotificationSound = useCallback(() => {
    if (!soundEnabledRef.current) return;
    try {
      const audio = new Audio(NOTIFICATION_SOUND_URL);
      audio.play().catch(() => {});
    } catch (e) {}
  }, []);

  const toggleSound = useCallback(() => {
    const next = !soundEnabledRef.current;
    soundEnabledRef.current = next;
    setSoundEnabled(next);
    toast.success(next ? "🔔 Sound enabled" : "🔕 Sound disabled", {
      id: "sound-toggle-toast",
      ...STAFF_TOAST_CONFIG,
      duration: 2000,
    });
  }, []);

  // ── SERVER-SIDE FETCH ORDERS ──
  const fetchOrders = useCallback(
    async (isManual = false) => {
      try {
        if (isManual) setIsRefreshing(true);
        else setLoading(true);

        const params = {
          page,
          limit: pageSize,
          date: filterDate,
          status: activeTab,
          counter: filterCounter,
          payment: filterPayment,
          paginate: "true",
        };

        if (filter.trim()) {
          params.search = filter.trim();
        }

        const { data } = await api.get("/orders", { params });

        if (data && Array.isArray(data.orders)) {
          setOrders(data.orders);
          setTotalItems(data.total || 0);
          setTotalPages(data.totalPages || 1);
          if (data.stats) {
            setStats(data.stats);
          }
        } else if (Array.isArray(data)) {
          // Fallback if unpaginated
          setOrders(data);
          setTotalItems(data.length);
          setTotalPages(Math.ceil(data.length / pageSize) || 1);
        }
      } catch (err) {
        console.error("Failed to fetch staff orders:", err);
        toast.error("Failed to load orders", { ...STAFF_TOAST_CONFIG });
      } finally {
        setLoading(false);
        if (isManual) {
          setTimeout(() => setIsRefreshing(false), 300);
        }
      }
    },
    [page, pageSize, filterDate, activeTab, filterCounter, filterPayment, filter]
  );

  // Trigger fetch when parameters change
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Reset to page 1 on filter changes
  const handleDateChange = (newDate) => {
    setFilterDate(newDate);
    setPage(1);
    setExpandedOrderId(null);
  };

  const handleCounterChange = (newCounter) => {
    setFilterCounter(newCounter);
    setPage(1);
    setExpandedOrderId(null);
  };

  const handlePaymentChange = (newPayment) => {
    setFilterPayment(newPayment);
    setPage(1);
    setExpandedOrderId(null);
  };

  const handleSearchChange = (e) => {
    setFilter(e.target.value);
    setPage(1);
    setExpandedOrderId(null);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setPage(1);
    setExpandedOrderId(null);
  };

  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize);
    setPage(1);
    setExpandedOrderId(null);
  };

  // Date Navigation Helpers
  const addDays = (dateStr, days) => {
    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + days);
    const newYear = date.getFullYear();
    const newMonth = String(date.getMonth() + 1).padStart(2, "0");
    const newDay = String(date.getDate()).padStart(2, "0");
    return `${newYear}-${newMonth}-${newDay}`;
  };

  const goPrevDay = () => handleDateChange(addDays(filterDate, -1));
  const goNextDay = () => {
    const today = getTodayLocal();
    const next = addDays(filterDate, 1);
    if (next > today) {
      toast.error("Cannot go beyond today", { ...STAFF_TOAST_CONFIG });
      return;
    }
    handleDateChange(next);
  };

  // ── CONFIRM ORDER ACTION ──
  const handleConfirmOrder = useCallback(
    async (orderId) => {
      if (confirmingId) return;
      try {
        setConfirmingId(orderId);

        // Track local confirmation to avoid double-processing when Socket.IO event arrives
        processedEventsRef.current.add(`confirm-${orderId}`);

        // 1. Immediately remove from current list if on pending tab
        if (activeTab === "pending") {
          setOrders((prev) => prev.filter((o) => o._id !== orderId));
          setTotalItems((prev) => Math.max(0, prev - 1));
        }

        // 2. Immediately update badge stats
        setStats((prev) => ({
          ...prev,
          pending: Math.max(0, (prev.pending || 1) - 1),
          confirmed: (prev.confirmed || 0) + 1,
        }));

        // 3. Close expanded accordion
        if (expandedOrderId === orderId) {
          setExpandedOrderId(null);
        }

        toast.success("Order confirmed successfully", {
          id: `confirm-${orderId}`,
          ...STAFF_TOAST_CONFIG,
        });

        // 4. Send API request
        const { data } = await api.put(`/orders/${orderId}/confirm`);

        // 5. If user is currently on confirmed tab, add/update it
        if (activeTab === "confirmed" && data) {
          setOrders((prev) => {
            if (prev.some((o) => o._id === orderId)) {
              return prev.map((o) =>
                o._id === orderId ? { ...o, ...data, status: "Confirmed" } : o
              );
            }
            return [{ ...data, status: "Confirmed" }, ...prev.slice(0, pageSize - 1)];
          });
          setTotalItems((prev) => prev + 1);
        }

        // 6. If page became empty on pending tab and page > 1, go to previous page
        if (activeTab === "pending" && orders.length <= 1 && page > 1) {
          setPage((p) => Math.max(1, p - 1));
        }
      } catch (err) {
        console.error("Failed to confirm order:", err);
        // Rollback on error
        fetchOrders();
        toast.error(err.response?.data?.message || "Failed to confirm order", {
          ...STAFF_TOAST_CONFIG,
        });
      } finally {
        setConfirmingId(null);
      }
    },
    [confirmingId, orders, activeTab, expandedOrderId, page, pageSize, fetchOrders]
  );

  // ── REALTIME SOCKET.IO EVENT HANDLERS ──
  useEffect(() => {
    const handleNewOrder = (order) => {
      if (!order || !order._id) return;
      if (processedEventsRef.current.has(`new-${order._id}`)) return;
      processedEventsRef.current.add(`new-${order._id}`);

      playNotificationSound();

      toast.success("New order received", {
        id: `new-${order._id}`,
        ...STAFF_TOAST_CONFIG,
      });

      setLivePulse(true);
      setTimeout(() => setLivePulse(false), 1500);

      // Increment pending count in stats
      setStats((prev) => ({
        ...prev,
        pending: (prev.pending || 0) + 1,
        total: (prev.total || 0) + 1,
      }));

      // If viewing pending tab on page 1 and matches filters, prepend to current page
      if (
        activeTab === "pending" &&
        page === 1 &&
        matchesFilters(order, { filterDate, filterCounter, filterPayment, filter })
      ) {
        setOrders((prev) => {
          if (prev.some((o) => o._id === order._id)) return prev;
          return [order, ...prev.slice(0, pageSize - 1)];
        });
        setTotalItems((prev) => prev + 1);
      }
    };

    const handleOrderConfirmed = (order) => {
      if (!order) return;
      const id = order._id || order.id || order;

      setLivePulse(true);
      setTimeout(() => setLivePulse(false), 1500);

      // Check if we already handled this order locally via handleConfirmOrder
      const wasLocalConfirm = processedEventsRef.current.has(`confirm-${id}`);

      if (!wasLocalConfirm) {
        // If confirmed by someone else, update stats
        setStats((prev) => ({
          ...prev,
          pending: Math.max(0, (prev.pending || 1) - 1),
          confirmed: (prev.confirmed || 0) + 1,
        }));
      }

      // If viewing pending tab, REMOVE the confirmed order from the list!
      if (activeTab === "pending") {
        setOrders((prev) => prev.filter((o) => o._id !== id));
        if (!wasLocalConfirm) {
          setTotalItems((prev) => Math.max(0, prev - 1));
        }
        if (expandedOrderId === id) {
          setExpandedOrderId(null);
        }
      }

      // If viewing confirmed tab, ADD/UPDATE the order if it matches filters
      if (activeTab === "confirmed") {
        if (matchesFilters(order, { filterDate, filterCounter, filterPayment, filter })) {
          setOrders((prev) => {
            if (prev.some((o) => o._id === id)) {
              return prev.map((o) =>
                o._id === id ? { ...o, ...order, status: "Confirmed" } : o
              );
            }
            return [order, ...prev.slice(0, pageSize - 1)];
          });
          if (!wasLocalConfirm) {
            setTotalItems((prev) => prev + 1);
          }
        }
      }
    };

    const handleOrderCancelled = (order) => {
      if (!order) return;
      const id = order._id || order.id || order;

      setLivePulse(true);
      setTimeout(() => setLivePulse(false), 1500);

      // Update stats
      setStats((prev) => ({
        ...prev,
        pending: Math.max(0, (prev.pending || 1) - 1),
      }));

      // If viewing pending tab, remove it
      if (activeTab === "pending") {
        setOrders((prev) => prev.filter((o) => o._id !== id));
        setTotalItems((prev) => Math.max(0, prev - 1));
        if (expandedOrderId === id) {
          setExpandedOrderId(null);
        }
      }
    };

    const handleOrderReverted = (order) => {
      if (!order) return;
      const id = order._id || order.id || order;

      setLivePulse(true);
      setTimeout(() => setLivePulse(false), 1500);

      // Update stats
      setStats((prev) => ({
        ...prev,
        pending: (prev.pending || 0) + 1,
        confirmed: Math.max(0, (prev.confirmed || 1) - 1),
      }));

      // If on pending tab, add it if it matches filters
      if (activeTab === "pending") {
        if (matchesFilters(order, { filterDate, filterCounter, filterPayment, filter })) {
          setOrders((prev) => {
            if (prev.some((o) => o._id === id)) return prev;
            return [order, ...prev.slice(0, pageSize - 1)];
          });
          setTotalItems((prev) => prev + 1);
        }
      }

      // If on confirmed tab, remove it
      if (activeTab === "confirmed") {
        setOrders((prev) => prev.filter((o) => o._id !== id));
        setTotalItems((prev) => Math.max(0, prev - 1));
        if (expandedOrderId === id) {
          setExpandedOrderId(null);
        }
      }
    };

    socket.on("newOrder", handleNewOrder);
    socket.on("orderConfirmed", handleOrderConfirmed);
    socket.on("orderCancelled", handleOrderCancelled);
    socket.on("orderReverted", handleOrderReverted);

    return () => {
      socket.off("newOrder", handleNewOrder);
      socket.off("orderConfirmed", handleOrderConfirmed);
      socket.off("orderCancelled", handleOrderCancelled);
      socket.off("orderReverted", handleOrderReverted);
    };
  }, [
    activeTab,
    page,
    pageSize,
    filterDate,
    filterCounter,
    filterPayment,
    filter,
    expandedOrderId,
    playNotificationSound,
  ]);

  // Display date text
  const displayDate = useMemo(() => {
    const [year, month, day] = filterDate.split("-");
    return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, [filterDate]);

  return (
    <div className="w-full max-w-[1150px] mx-auto pb-10 sm:pb-12 transition-colors">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-7">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-[28px] font-extrabold tracking-tight bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Staff Dashboard
            </h1>
            {livePulse && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 animate-pulse">
                <FiActivity />
                LIVE
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Review and confirm pending counter orders
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
          {/* Refresh */}
          <button
            type="button"
            onClick={() => fetchOrders(true)}
            disabled={isRefreshing || loading}
            className="h-9 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-300 transition-colors shadow-2xs flex items-center justify-center cursor-pointer"
            title="Refresh orders"
          >
            <FiRefreshCw
              className={`w-4 h-4 text-indigo-600 dark:text-indigo-400 ${
                isRefreshing ? "animate-spin" : ""
              }`}
            />
          </button>

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={toggleSound}
            className="h-9 inline-flex items-center gap-1.5 px-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/80 font-semibold text-xs transition-colors shadow-2xs cursor-pointer"
            title={soundEnabled ? "Disable sound" : "Enable sound"}
          >
            {soundEnabled ? (
              <FiVolume2 className="w-4 h-4 text-emerald-500" />
            ) : (
              <FiVolumeX className="w-4 h-4 text-slate-400" />
            )}
            <span className="hidden xs:inline">
              {soundEnabled ? "Sound ON" : "Sound OFF"}
            </span>
          </button>

          {/* Date Navigator */}
          <div className="h-9 flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 rounded-xl shadow-2xs">
            <button
              type="button"
              onClick={goPrevDay}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 transition cursor-pointer"
              title="Previous day"
            >
              <FiChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 px-1">
              <FiCalendar className="w-3.5 h-3.5 text-indigo-500" />
              <input
                type="date"
                value={filterDate}
                onChange={(e) => handleDateChange(e.target.value)}
                max={getTodayLocal()}
                className="bg-transparent border-0 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 p-0 focus:ring-0 outline-hidden cursor-pointer"
              />
            </div>
            <button
              type="button"
              onClick={goNextDay}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 transition cursor-pointer"
              title="Next day"
            >
              <FiChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── FILTERS ROW: COUNTERS + PAYMENTS (24–28px below header) ── */}
      <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap text-xs sm:text-sm mb-5 sm:mb-6">
        {/* Counter Filter */}
        <div className="h-9 flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 rounded-xl shadow-2xs">
          <FiMonitor className="text-indigo-500 w-3.5 h-3.5 shrink-0" />
          <select
            value={filterCounter}
            onChange={(e) => handleCounterChange(e.target.value)}
            className="bg-transparent border-0 p-0 font-medium text-slate-800 dark:text-slate-200 text-xs sm:text-sm focus:ring-0 outline-hidden cursor-pointer"
          >
            <option value="all">All Counters</option>
            {countersList.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {/* Payment Filter */}
        <div className="h-9 flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 rounded-xl shadow-2xs">
          <FaRupeeSign className="text-indigo-500 w-3 h-3 shrink-0" />
          <select
            value={filterPayment}
            onChange={(e) => handlePaymentChange(e.target.value)}
            className="bg-transparent border-0 p-0 font-medium text-slate-800 dark:text-slate-200 text-xs sm:text-sm focus:ring-0 outline-hidden cursor-pointer"
          >
            <option value="all">All Payments</option>
            <option value="Cash">Cash</option>
            <option value="Online">Online</option>
          </select>
        </div>

        {/* Reset Filters */}
        {(filterCounter !== "all" || filterPayment !== "all" || filter.trim()) && (
          <button
            type="button"
            onClick={() => {
              setFilterCounter("all");
              setFilterPayment("all");
              setFilter("");
              setPage(1);
            }}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline px-2 py-1 cursor-pointer"
          >
            Clear filters ✕
          </button>
        )}

        <div className="ml-auto text-xs text-slate-500 dark:text-slate-400 font-medium hidden md:block">
          Showing orders for: <strong className="text-slate-800 dark:text-slate-200">{displayDate}</strong>
        </div>
      </div>

      {/* ── SEARCH BAR + STATUS TABS (20–24px below filters) ── */}
      <div className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-3 sm:p-3.5 mb-5 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by Order ID (#dd22ea)..."
              value={filter}
              onChange={handleSearchChange}
              className="w-full h-9 sm:h-10 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all"
            />
          </div>

          {/* Status Tabs: ONLY Pending & Completed (Reject removed) */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => handleTabChange("pending")}
              className={`px-4 sm:px-5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeTab === "pending"
                  ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Pending ({stats.pending || 0})
            </button>
            <button
              type="button"
              onClick={() => handleTabChange("confirmed")}
              className={`px-4 sm:px-5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeTab === "confirmed"
                  ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Completed ({stats.confirmed || 0})
            </button>
          </div>
        </div>
      </div>

      {/* ── ORDER CARDS LIST (ACCORDION) (20–24px below search) ── */}
      <div className="w-full space-y-3 sm:space-y-3.5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <div className="w-9 h-9 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2.5" />
            <p className="text-xs sm:text-sm font-medium">Loading orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl py-12 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl text-slate-400 mb-2.5 shadow-2xs">
              <FiPackage />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-200">
              No orders found
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Try changing your filters or search criteria.
            </p>
          </div>
        ) : (
          orders.map((order) => (
            <StaffOrderCard
              key={order._id}
              order={order}
              isExpanded={expandedOrderId === order._id}
              onToggleExpand={() =>
                setExpandedOrderId((prev) =>
                  prev === order._id ? null : order._id
                )
              }
              onConfirm={handleConfirmOrder}
              isConfirming={confirmingId === order._id}
            />
          ))
        )}
      </div>

      {/* ── SERVER-SIDE PAGINATION (20–24px below order cards) ── */}
      {!loading && totalItems > 0 && (
        <div className="mt-5 sm:mt-6">
          <PaginationBar
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={(newPage) => {
              setPage(newPage);
              setExpandedOrderId(null);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            onPageSizeChange={handlePageSizeChange}
            pageSizeOptions={[10, 25, 50, 100]}
            isLoading={loading}
            label={activeTab === "pending" ? "pending orders" : "completed orders"}
          />
        </div>
      )}
    </div>
  );
}