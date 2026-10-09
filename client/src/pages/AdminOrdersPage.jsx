import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import api from "../services/api";
import socket from "../services/socket";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import Swal from "sweetalert2";

// ✅ Thermal receipt component (reused for reprint)
import ThermalReceipt from "../components/ThermalReceipt";
import PaginationBar from "../components/PaginationBar";
import ConfirmationModal from "../components/ConfirmationModal";

import {
  FiXCircle,
  FiCheckCircle,
  FiClock,
  FiPackage,
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiShoppingBag,
  FiTrendingUp,
  FiAlertCircle,
  FiCheck,
  FiX,
  FiActivity,
  FiUserCheck,
  FiRotateCcw,
  FiTrash2,
  FiTrash,
  FiChevronDown,
  FiChevronUp,
  FiPrinter,
  FiClock as FiTime,
  FiMonitor,
  FiCreditCard,
  FiSearch,
} from "react-icons/fi";
import { FaRupeeSign } from "react-icons/fa";

// ✅ IST Date Functions
function getTodayLocal() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);
  const year = istDate.getUTCFullYear();
  const month = String(istDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(istDate.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getISTDateFromUTC(utcDateString) {
  const date = new Date(utcDateString);
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(date.getTime() + istOffset);
  const year = istDate.getUTCFullYear();
  const month = String(istDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(istDate.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isSameISTDate(orderCreatedAt, filterDate) {
  const orderISTDate = getISTDateFromUTC(orderCreatedAt);
  return orderISTDate === filterDate;
}

function addDays(dateStr, days) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  const newYear = date.getFullYear();
  const newMonth = String(date.getMonth() + 1).padStart(2, "0");
  const newDay = String(date.getDate()).padStart(2, "0");
  return `${newYear}-${newMonth}-${newDay}`;
}

// ✅ Format time helper (IST)
function formatISTTime(dateInput) {
  if (!dateInput) return "N/A";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "N/A";
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

// ✅ Human-readable duration
function humanDuration(ms) {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const parts = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [livePulse, setLivePulse] = useState(false);
  const [revertingId, setRevertingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDate, setFilterDate] = useState(() => getTodayLocal());
  const [filterCounter, setFilterCounter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Server-computed stats
  const [serverStats, setServerStats] = useState({
    total: 0,
    pending: 0,
    confirmed: 0,
    cancelled: 0,
    revenue: 0,
    cashCount: 0,
    onlineCount: 0,
  });

  const [countersMap, setCountersMap] = useState({});
  const [allCounters, setAllCounters] = useState([]);

  useEffect(() => {
    const fetchCounters = async () => {
      try {
        const { data } = await api.get("/counters").catch(() => ({ data: [] }));
        const map = {};
        const counterList = [];
        if (Array.isArray(data)) {
          data.forEach(c => {
            if (c._id && c.name) {
              map[c._id] = c.name;
              if (c.userId) {
                const uId = typeof c.userId === 'object' ? c.userId._id : c.userId;
                map[uId] = c.name;
              }
              if (!counterList.some(item => item.name === c.name)) {
                counterList.push({ name: c.name, id: c._id });
              }
            }
          });
        }
        setCountersMap(map);
        setAllCounters(counterList);
      } catch (err) {
        console.error("Failed to fetch counters", err);
      }
    };
    fetchCounters();
  }, []);

  const getOrderCounterName = (order) => {
    if (!order) return "N/A";
    if (order.counter && typeof order.counter === "object" && order.counter.name) {
      return order.counter.name;
    }
    if (order.counterName && !order.counterName.match(/^[0-9a-fA-F]{24}$/)) {
      return order.counterName;
    }
    if (order.counterId && countersMap[order.counterId]) {
      return countersMap[order.counterId];
    }
    if (typeof order.counter === "string" && countersMap[order.counter]) {
      return countersMap[order.counter];
    }
    if (typeof order.counter === "string" && !order.counter.match(/^[0-9a-fA-F]{24}$/)) {
      return order.counter;
    }
    return order.counterName || "Counter 1";
  };

  // ✅ Receipt preview & reprint state
  const [previewOrder, setPreviewOrder] = useState(null);

  // ✅ Calculate order completion time
  const getCompletionTime = (order) => {
    if (order.status !== "Confirmed") return null;

    const created = new Date(order.createdAt);
    const confirmed = new Date(order.confirmedAt || order.updatedAt);

    if (isNaN(confirmed.getTime())) return null;

    const diffMs = confirmed - created;
    const diffMins = Math.floor(diffMs / 60000);
    const diffSecs = Math.floor((diffMs % 60000) / 1000);

    if (diffMins > 0) return `${diffMins}m ${diffSecs}s`;
    return `${diffSecs}s`;
  };

  // ✅ Modern confirmation modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    type: "confirm",
    title: "",
    subtitle: "",
    order: null,
    counterName: "",
    rows: [],
    headline: "",
    subtext: "",
    confirmText: "",
    confirmLoadingText: "",
    onConfirm: null,
    onClose: null,
  });

  // ✅ Modern confirmation dialog builder
  const showConfirmDialog = useCallback(
    ({
      type = "confirm",
      title,
      subtitle,
      order = null,
      rows = [],
      headline,
      subtext,
      confirmText,
      confirmLoadingText,
    }) => {
      return new Promise((resolve) => {
        setConfirmModal({
          isOpen: true,
          type,
          title,
          subtitle,
          order,
          counterName: order ? getOrderCounterName(order) : "",
          rows,
          headline,
          subtext,
          confirmText,
          confirmLoadingText,
          onConfirm: async () => {
            resolve(true);
            setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          },
          onClose: () => {
            resolve(false);
            setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          },
        });
      });
    },
    [countersMap],
  );

  // ✅ Success toast notification after action
  const showActionSuccess = (title, order, actionMeta = {}) => {
    toast.success(actionMeta.headline || title || "Action completed successfully");
  };

  // ✅ Order Info Modal
  const showOrderInfo = (order) => {
    const paymentMethod =
      order.payment?.method || order.paymentMethod || "Cash";
    const isCash = paymentMethod.toLowerCase() === "cash";

    const cashReceived =
      order.amountReceived ??
      order.cashReceived ??
      order.payment?.receivedAmount ??
      order.payment?.amountReceived ??
      null;
    const changeGiven =
      order.changeGiven ??
      order.payment?.changeReturned ??
      order.payment?.changeGiven ??
      null;

    const counterName = getOrderCounterName(order);

    let htmlContent = `
      <div style="text-align: left; font-size: 14px; line-height: 1.8;">
        <p><strong>Counter:</strong> ${counterName}</p>
        <p><strong>Payment Method:</strong> ${paymentMethod}</p>
    `;

    if (!isCash) {
      htmlContent += `<p><strong>Payment Status:</strong> ${order.payment?.status || "N/A"}</p>`;
    }

    if (isCash) {
      htmlContent += `
        <p><strong>Cash Received:</strong> <span style="font-weight: bold; color: #10b981;">₹${Number(cashReceived ?? order.totalAmount).toLocaleString()}</span></p>
        <p><strong>Change Given:</strong> <span style="font-weight: bold; color: #f59e0b;">₹${Number(changeGiven ?? 0).toLocaleString()}</span></p>
      `;
    }

    if (order.payment?.gatewayOrderId) {
      htmlContent += `<p><strong>Gateway Order ID:</strong> ${order.payment.gatewayOrderId}</p>`;
    }
    if (order.payment?.gatewayPaymentId) {
      htmlContent += `<p><strong>Gateway Payment ID:</strong> ${order.payment.gatewayPaymentId}</p>`;
    }
    if (order.payment?.transactionId) {
      htmlContent += `<p><strong>Transaction ID:</strong> ${order.payment.transactionId}</p>`;
    }

    htmlContent += `</div>`;

    Swal.fire({
      title: "Order Information",
      html: htmlContent,
      icon: "info",
      confirmButtonText: "Close",
      confirmButtonColor: "#6366f1",
      customClass: {
        popup: "rounded-2xl dark:bg-slate-800 dark:text-white border dark:border-slate-700 shadow-2xl",
      },
    });
  };

  const fetchOrders = useCallback(async () => {
    try {
      const params = {
        page,
        limit: pageSize,
        date: filterDate,
        status: filterStatus,
        counter: filterCounter,
        paginate: "true",
      };

      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const { data } = await api.get("/orders", { params });

      if (data && Array.isArray(data.orders)) {
        setOrders(data.orders);
        setTotalItems(data.total || 0);
        setTotalPages(data.totalPages || 1);
        if (data.stats) {
          setServerStats(data.stats);
        }
      } else if (Array.isArray(data)) {
        setOrders(data);
        setTotalItems(data.length);
        setTotalPages(Math.ceil(data.length / pageSize) || 1);
      }
    } catch (err) {
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filterDate, filterStatus, filterCounter, searchQuery]);

  const handleLiveUpdate = useCallback(() => {
    fetchOrders();
    setLivePulse(true);
    setTimeout(() => setLivePulse(false), 1500);
  }, [fetchOrders]);

  useEffect(() => {
    fetchOrders();

    socket.on("newOrder", handleLiveUpdate);
    socket.on("orderConfirmed", handleLiveUpdate);
    socket.on("orderCancelled", handleLiveUpdate);
    socket.on("orderReverted", handleLiveUpdate);
    socket.on("stockUpdated", handleLiveUpdate);

    return () => {
      socket.off("newOrder");
      socket.off("orderConfirmed");
      socket.off("orderCancelled");
      socket.off("orderReverted");
      socket.off("stockUpdated");
    };
  }, [fetchOrders, handleLiveUpdate]);

  // ✅ CONFIRM — modern confirmation dialog + in-modal loading
  const confirmOrder = useCallback(
    (order) => {
      const orderId = order._id;

      setConfirmModal({
        isOpen: true,
        type: "confirm",
        title: "Confirm Order",
        subtitle: "Review the order details before confirming it.",
        headline: "Confirm this order?",
        subtext: "Stock will be deducted and the order will be marked as confirmed.",
        order,
        counterName: getOrderCounterName(order),
        confirmText: "Confirm Order",
        confirmLoadingText: "Confirming...",
        onConfirm: async () => {
          try {
            await api.put(`/orders/${orderId}/confirm`);

            if (expandedOrderId === orderId) {
              setExpandedOrderId(null);
            }

            toast.success("Order confirmed successfully ✅");
            setConfirmModal((prev) => ({ ...prev, isOpen: false }));
            fetchOrders();
          } catch (err) {
            toast.error(err.response?.data?.message || "Confirmation failed");
            throw err;
          }
        },
        onClose: () => setConfirmModal((prev) => ({ ...prev, isOpen: false })),
      });
    },
    [fetchOrders, expandedOrderId, countersMap],
  );

  // ✅ CANCEL — modern confirmation dialog + in-modal loading
  const cancelOrder = useCallback(
    (order) => {
      const orderId = order._id;

      setConfirmModal({
        isOpen: true,
        type: "cancel",
        title: "Cancel Order",
        subtitle: "Review the order details before cancelling it.",
        headline: "Cancel this order?",
        subtext: "The order will be moved to the cancelled state.",
        order,
        counterName: getOrderCounterName(order),
        confirmText: "Cancel Order",
        confirmLoadingText: "Cancelling...",
        onConfirm: async () => {
          try {
            await api.put(`/orders/${orderId}/cancel`);

            if (expandedOrderId === orderId) {
              setExpandedOrderId(null);
            }

            toast.success("Order cancelled successfully");
            setConfirmModal((prev) => ({ ...prev, isOpen: false }));
            fetchOrders();
          } catch (err) {
            toast.error(err.response?.data?.message || "Cancellation failed");
            throw err;
          }
        },
        onClose: () => setConfirmModal((prev) => ({ ...prev, isOpen: false })),
      });
    },
    [fetchOrders, expandedOrderId, countersMap],
  );

  // ✅ REVERT — modern confirmation dialog + in-modal loading
  const revertOrder = useCallback(
    (order) => {
      const orderId = order._id;

      setConfirmModal({
        isOpen: true,
        type: "revert",
        title: "Revert Order",
        subtitle: "Revert this order back to pending state.",
        headline: "Revert this order to Pending?",
        subtext: "Stock will be adjusted and order returned to pending queue.",
        order,
        counterName: getOrderCounterName(order),
        confirmText: "Revert Order",
        confirmLoadingText: "Reverting...",
        onConfirm: async () => {
          setRevertingId(orderId);
          try {
            await api.put(`/orders/${orderId}/revert`);

            if (expandedOrderId === orderId) {
              setExpandedOrderId(null);
            }

            toast.success("Order reverted to Pending ↩️");
            setConfirmModal((prev) => ({ ...prev, isOpen: false }));
            fetchOrders();
          } catch (err) {
            toast.error(err.response?.data?.message || "Revert failed");
            throw err;
          } finally {
            setRevertingId(null);
          }
        },
        onClose: () => setConfirmModal((prev) => ({ ...prev, isOpen: false })),
      });
    },
    [fetchOrders, expandedOrderId, countersMap],
  );

  // ✅ DELETE — modern confirmation dialog + in-modal loading
  const deleteOrder = useCallback(
    (order) => {
      const orderId = order._id;
      const orderStatus = order.status;

      if (orderStatus !== "Cancelled" && orderStatus !== "Pending") {
        toast.error("Only cancelled or pending orders can be deleted");
        return;
      }

      setConfirmModal({
        isOpen: true,
        type: "delete",
        title: "Delete Order",
        subtitle: "This action cannot be undone.",
        headline: "Delete this order permanently?",
        subtext: "This action cannot be undone.",
        order,
        counterName: getOrderCounterName(order),
        confirmText: "Delete Order",
        confirmLoadingText: "Deleting...",
        onConfirm: async () => {
          setDeletingId(orderId);
          try {
            await api.delete(`/orders/${orderId}`);

            if (expandedOrderId === orderId) {
              setExpandedOrderId(null);
            }

            toast.success("Order deleted permanently 🗑️");
            setConfirmModal((prev) => ({ ...prev, isOpen: false }));
            fetchOrders();
          } catch (err) {
            toast.error(err.response?.data?.message || "Delete failed");
            throw err;
          } finally {
            setDeletingId(null);
          }
        },
        onClose: () => setConfirmModal((prev) => ({ ...prev, isOpen: false })),
      });
    },
    [fetchOrders, expandedOrderId, countersMap],
  );

  // ✅ REPRINT — Open Bill Preview & Print Modal
  const reprintOrder = useCallback((order) => {
    if (!order || order.status !== "Confirmed") {
      toast.error("Only confirmed orders can be reprinted");
      return;
    }

    const receiptOrder = {
      _id: order._id,
      items: (order.items || []).map((it) => ({
        productId: it.productId?._id || it.productId,
        name: it.productId?.name || it.name || "Unknown Item",
        quantity: it.quantity,
        price: it.price,
      })),
      totalAmount: order.totalAmount,
      amountReceived: order.amountReceived ?? order.totalAmount,
      changeGiven: order.changeGiven ?? 0,
      paymentMethod: order.paymentMethod || "CASH",
      createdAt: order.createdAt,
      counter: order.counter || { name: getOrderCounterName(order) },
      counterName: getOrderCounterName(order),
      staff: order.staff || order.confirmedBy,
      staffName: order.staff?.name || order.staffName || order.confirmedBy?.name || null,
      customerName: order.customerName || order.customer?.name || null,
    };

    setPreviewOrder(receiptOrder);
  }, []);

  const toggleExpand = (orderId) => {
    setExpandedOrderId(expandedOrderId === orderId ? null : orderId);
  };

  const handleDateChange = (newDate) => {
    setFilterDate(newDate);
    setPage(1);
    setExpandedOrderId(null);
  };

  const goPrevDay = () => handleDateChange(addDays(filterDate, -1));
  const goNextDay = () => {
    const today = getTodayLocal();
    const next = addDays(filterDate, 1);
    if (next > today) {
      toast.error("Cannot go beyond today");
      return;
    }
    handleDateChange(next);
  };

  // ✅ Bulk delete: pending
  const deleteAllPendingOrders = useCallback(() => {
    const pendingCount = serverStats.pending || 0;

    if (pendingCount === 0) {
      toast.error(`No pending orders found for ${filterDate}`);
      return;
    }

    setConfirmModal({
      isOpen: true,
      type: "delete",
      title: "Delete All Pending Orders",
      subtitle: `Delete ${pendingCount} pending orders for ${filterDate}.`,
      headline: `Delete ${pendingCount} pending orders?`,
      subtext: "This action cannot be undone and records will be permanently removed.",
      rows: [
        ["Date", filterDate],
        ["Pending Orders", `${pendingCount} orders`],
      ],
      confirmText: "Delete All Pending",
      confirmLoadingText: "Deleting...",
      onConfirm: async () => {
        try {
          await api.delete("/orders/bulk/pending", {
            data: { date: filterDate },
          });

          toast.success(`${pendingCount} pending orders deleted 🗑️`);
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          fetchOrders();
        } catch (err) {
          toast.error(err.response?.data?.message || "Bulk delete failed");
          throw err;
        }
      },
      onClose: () => setConfirmModal((prev) => ({ ...prev, isOpen: false })),
    });
  }, [serverStats.pending, filterDate, fetchOrders]);

  // ✅ Bulk delete: cancelled
  const deleteAllCancelledOrders = useCallback(() => {
    const cancelledCount = serverStats.cancelled || 0;

    if (cancelledCount === 0) {
      toast.error(`No cancelled orders found for ${filterDate}`);
      return;
    }

    setConfirmModal({
      isOpen: true,
      type: "delete",
      title: "Delete All Cancelled Orders",
      subtitle: `Delete ${cancelledCount} cancelled orders for ${filterDate}.`,
      headline: `Delete ${cancelledCount} cancelled orders?`,
      subtext: "This action cannot be undone and records will be permanently removed.",
      rows: [
        ["Date", filterDate],
        ["Cancelled Orders", `${cancelledCount} orders`],
      ],
      confirmText: "Delete All Cancelled",
      confirmLoadingText: "Deleting...",
      onConfirm: async () => {
        try {
          await api.delete("/orders/bulk/cancelled", {
            data: { date: filterDate },
          });

          toast.success(`${cancelledCount} cancelled orders deleted 🗑️`);
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          fetchOrders();
        } catch (err) {
          toast.error(err.response?.data?.message || "Bulk delete failed");
          throw err;
        }
      },
      onClose: () => setConfirmModal((prev) => ({ ...prev, isOpen: false })),
    });
  }, [serverStats.cancelled, filterDate, fetchOrders]);

  // ✅ Bulk delete: all records for date
  const deleteAllRecordsForDate = useCallback(() => {
    const totalCount = serverStats.total || 0;

    if (totalCount === 0) {
      toast.error(`No orders found for ${filterDate}`);
      return;
    }

    setConfirmModal({
      isOpen: true,
      type: "delete",
      title: "Delete All Orders",
      subtitle: `Permanently delete all ${totalCount} orders for ${filterDate}.`,
      headline: `Delete ALL ${totalCount} orders?`,
      subtext: "This action cannot be undone. All order records for this date will be permanently deleted.",
      rows: [
        ["Date", filterDate],
        ["Total Orders", `${totalCount} orders`],
      ],
      confirmText: "Delete All Orders",
      confirmLoadingText: "Deleting...",
      onConfirm: async () => {
        try {
          await api.delete("/orders/by-date", {
            data: { date: filterDate },
          });

          toast.success(`All ${totalCount} orders deleted for ${filterDate} 🗑️`);
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          fetchOrders();
        } catch (err) {
          toast.error(err.response?.data?.message || "Failed to delete records");
          throw err;
        }
      },
      onClose: () => setConfirmModal((prev) => ({ ...prev, isOpen: false })),
    });
  }, [serverStats.total, filterDate, fetchOrders]);

  // Orders are filtered and paginated on the server
  const filteredOrders = orders;
  const stats = serverStats;

  const getStatusBadge = (status) => {
    switch (status) {
      case "Pending":
        return (
          <span className="inline-flex items-center gap-1.5 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-500/20 px-2.5 py-0.5 rounded-full text-xs font-semibold">
            <FiClock className="text-xs" /> Pending
          </span>
        );
      case "Confirmed":
        return (
          <span className="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-500/20 px-2.5 py-0.5 rounded-full text-xs font-semibold">
            <FiCheckCircle className="text-xs" /> Confirmed
          </span>
        );
      case "Cancelled":
        return (
          <span className="inline-flex items-center gap-1.5 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200/80 dark:border-rose-500/20 px-2.5 py-0.5 rounded-full text-xs font-semibold">
            <FiXCircle className="text-xs" /> Cancelled
          </span>
        );
      default:
        return null;
    }
  };

  const cancelledOrdersForDate = serverStats.cancelled || 0;
  const pendingOrdersForDate = serverStats.pending || 0;
  const ordersForDateCount = serverStats.total || 0;

  const displayDate = (() => {
    const [year, month, day] = filterDate.split("-");
    return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  })();

  const filterSummary = useMemo(() => {
    const parts = [];
    if (filterStatus !== "all") {
      parts.push(filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1));
    }
    if (filterCounter !== "all") {
      parts.push(filterCounter);
    }
    if (searchQuery.trim()) {
      parts.push(`"${searchQuery.trim()}"`);
    }
    return parts.length > 0 ? parts.join(" • ") : "";
  }, [filterStatus, filterCounter, searchQuery]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[70vh] print:hidden">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-indigo-200 rounded-full"></div>
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin absolute top-0"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ✅ Main dashboard (hidden during print) */}
      <div className="space-y-6 print:hidden">
        {/* HEADER */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                Live Order Monitoring
              </h1>
              <AnimatePresence>
                {livePulse && (
                  <motion.div
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.7, opacity: 0 }}
                    className="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                  >
                    <FiActivity className="animate-pulse text-xs" />
                    <span>LIVE</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-normal">
              Real-time order tracking & live fulfillment dashboard
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Destructive Batch Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={deleteAllPendingOrders}
                disabled={pendingOrdersForDate === 0}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                  pendingOrdersForDate > 0
                    ? "bg-amber-50/80 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200/80 dark:border-amber-800/50 hover:bg-amber-100 dark:hover:bg-amber-900/40 shadow-2xs"
                    : "bg-slate-100 dark:bg-slate-800/40 text-slate-400 dark:text-slate-600 border-slate-200/60 dark:border-slate-800 cursor-not-allowed opacity-50"
                }`}
                title={pendingOrdersForDate > 0 ? `Delete all ${pendingOrdersForDate} pending orders for this date` : "No pending orders to delete"}
              >
                <FiTrash2 className="text-xs" />
                <span>Delete Pending</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${pendingOrdersForDate > 0 ? "bg-amber-200/70 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300" : "bg-slate-200 dark:bg-slate-800"}`}>
                  {pendingOrdersForDate}
                </span>
              </button>
              <button
                onClick={deleteAllCancelledOrders}
                disabled={cancelledOrdersForDate === 0}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                  cancelledOrdersForDate > 0
                    ? "bg-rose-50/80 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-200/80 dark:border-rose-800/50 hover:bg-rose-100 dark:hover:bg-rose-900/40 shadow-2xs"
                    : "bg-slate-100 dark:bg-slate-800/40 text-slate-400 dark:text-slate-600 border-slate-200/60 dark:border-slate-800 cursor-not-allowed opacity-50"
                }`}
                title={cancelledOrdersForDate > 0 ? `Delete all ${cancelledOrdersForDate} cancelled orders for this date` : "No cancelled orders to delete"}
              >
                <FiTrash className="text-xs" />
                <span>Delete Cancelled</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${cancelledOrdersForDate > 0 ? "bg-rose-200/70 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300" : "bg-slate-200 dark:bg-slate-800"}`}>
                  {cancelledOrdersForDate}
                </span>
              </button>
              <button
                onClick={deleteAllRecordsForDate}
                disabled={ordersForDateCount === 0}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                  ordersForDateCount > 0
                    ? "bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-xs"
                    : "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-50"
                }`}
                title={ordersForDateCount > 0 ? `Delete all ${ordersForDateCount} orders for this date` : "No orders to delete"}
              >
                <FiTrash className="text-xs" />
                <span>Delete All</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${ordersForDateCount > 0 ? "bg-rose-700 text-white" : "bg-slate-300 dark:bg-slate-700"}`}>
                  {ordersForDateCount}
                </span>
              </button>
            </div>

            {/* Date Picker Toolbar */}
            <div className="inline-flex items-center bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl p-1 shadow-2xs">
              <button
                onClick={goPrevDay}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
                title="Previous Day"
              >
                <FiChevronLeft className="text-base" />
              </button>
              <div className="flex items-center gap-1.5 px-2 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                <FiCalendar className="text-indigo-500 shrink-0" />
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  max={getTodayLocal()}
                  className="bg-transparent outline-none cursor-pointer [color-scheme:light] dark:[color-scheme:dark] text-slate-800 dark:text-slate-200 font-medium text-xs sm:text-sm"
                />
              </div>
              <button
                onClick={goNextDay}
                disabled={filterDate >= getTodayLocal()}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed"
                title="Next Day"
              >
                <FiChevronRight className="text-base" />
              </button>
            </div>
          </div>
        </div>

        {/* DATE DISPLAY BAR */}
        <div className="flex items-center justify-between flex-wrap gap-2 px-0.5">
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <FiCalendar className="text-indigo-500 text-xs" />
              <span>Showing orders for:</span>
            </div>
            <span className="font-semibold text-slate-900 dark:text-white">
              {displayDate}
            </span>
            {filterSummary && (
              <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/40 px-2.5 py-0.5 rounded-full">
                {filterSummary}
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span className="font-semibold text-slate-700 dark:text-slate-200">{totalItems}</span>{" "}
            {totalItems === 1 ? "order" : "orders"} found
          </div>
        </div>

        {/* STATS / KPI CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 sm:gap-3.5">
          {/* 1. Total Orders */}
          <div className="bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                Total Orders
              </span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center shrink-0">
                <FiShoppingBag className="text-sm" />
              </div>
            </div>
            <div className="text-2xl sm:text-[26px] font-bold text-slate-900 dark:text-white tracking-tight tabular-nums mt-2">
              {stats.total}
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-normal mt-2 truncate">
              All transactions
            </p>
          </div>

          {/* 2. Pending Orders */}
          <div className="bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                Pending Orders
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50 flex items-center justify-center shrink-0">
                <FiClock className="text-sm" />
              </div>
            </div>
            <div className="text-2xl sm:text-[26px] font-bold text-slate-900 dark:text-white tracking-tight tabular-nums mt-2">
              {stats.pending}
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-normal mt-2 truncate">
              Awaiting fulfillment
            </p>
          </div>

          {/* 3. Confirmed Orders */}
          <div className="bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                Confirmed
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-center shrink-0">
                <FiCheckCircle className="text-sm" />
              </div>
            </div>
            <div className="text-2xl sm:text-[26px] font-bold text-slate-900 dark:text-white tracking-tight tabular-nums mt-2">
              {stats.confirmed}
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-normal mt-2 truncate">
              Fulfilled successfully
            </p>
          </div>

          {/* 4. Cancelled Orders */}
          <div className="bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                Cancelled
              </span>
              <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50 flex items-center justify-center shrink-0">
                <FiXCircle className="text-sm" />
              </div>
            </div>
            <div className="text-2xl sm:text-[26px] font-bold text-slate-900 dark:text-white tracking-tight tabular-nums mt-2">
              {stats.cancelled}
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-normal mt-2 truncate">
              Voided transactions
            </p>
          </div>

          {/* 5. Total Revenue */}
          <div className="bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                Total Revenue
              </span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/50 flex items-center justify-center shrink-0">
                <FiTrendingUp className="text-sm" />
              </div>
            </div>
            <div className="text-2xl sm:text-[26px] font-bold text-slate-900 dark:text-white tracking-tight tabular-nums mt-2 truncate">
              ₹{Number(stats.revenue || 0).toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-normal mt-2 truncate">
              Gross sales for date
            </p>
          </div>

          {/* 6. Cash Orders */}
          <div className="bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                Cash Orders
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center shrink-0">
                <FiPackage className="text-sm" />
              </div>
            </div>
            <div className="text-2xl sm:text-[26px] font-bold text-slate-900 dark:text-white tracking-tight tabular-nums mt-2">
              {stats.cashCount}
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-normal mt-2 truncate">
              Physical cash
            </p>
          </div>

          {/* 7. Online Orders */}
          <div className="bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                Online Orders
              </span>
              <div className="w-8 h-8 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 border border-cyan-100 dark:border-cyan-900/50 flex items-center justify-center shrink-0">
                <FiCreditCard className="text-sm" />
              </div>
            </div>
            <div className="text-2xl sm:text-[26px] font-bold text-slate-900 dark:text-white tracking-tight tabular-nums mt-2">
              {stats.onlineCount}
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-normal mt-2 truncate">
              UPI & card payments
            </p>
          </div>
        </div>

        {/* FILTERS & SEARCH ROW */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5">
          {/* STATUS TABS */}
          <div className="inline-flex p-1 bg-slate-100 dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 rounded-2xl gap-1">
            {[
              ["all", "All", stats.total],
              ["pending", "Pending", stats.pending],
              ["confirmed", "Confirmed", stats.confirmed],
              ["cancelled", "Cancelled", stats.cancelled],
            ].map(([value, label, count]) => {
              const isActive = filterStatus === value;
              return (
                <button
                  key={value}
                  onClick={() => {
                    setFilterStatus(value);
                    setPage(1);
                    setExpandedOrderId(null);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                    isActive
                      ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <span>{label}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isActive
                        ? "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300"
                        : "bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {count ?? 0}
                  </span>
                </button>
              );
            })}
          </div>

          {/* SEARCH BAR */}
          <div className="relative w-full md:w-80">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search order #, items, bill #..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
                setExpandedOrderId(null);
              }}
              className="w-full h-10 pl-9 pr-9 text-xs sm:text-sm rounded-xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setPage(1);
                  setExpandedOrderId(null);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                title="Clear search"
              >
                <FiX className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* COUNTER FILTER */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0 mr-1">
            <FiMonitor className="text-indigo-500" />
            <span>Counter:</span>
          </div>
          <div className="flex items-center gap-1.5 flex-nowrap sm:flex-wrap">
            <button
              onClick={() => {
                setFilterCounter("all");
                setPage(1);
                setExpandedOrderId(null);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 ${
                filterCounter === "all"
                  ? "bg-indigo-600 text-white shadow-2xs"
                  : "bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              All Counters
            </button>
            {allCounters.map((counter) => (
              <button
                key={counter.name}
                onClick={() => {
                  setFilterCounter(counter.name);
                  setPage(1);
                  setExpandedOrderId(null);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 flex items-center gap-1 ${
                  filterCounter === counter.name
                    ? "bg-indigo-600 text-white shadow-2xs"
                    : "bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span>{counter.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ORDERS LIST */}
        {filteredOrders.length === 0 ? (
          <div className="bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-12 sm:p-16 text-center shadow-2xs">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4 text-slate-400 dark:text-slate-500">
              <FiPackage className="text-3xl" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
              No Orders Found
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              No orders matched the selected date, status, counter, or search criteria.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const completionTime = getCompletionTime(order);
              const isExpanded = expandedOrderId === order._id;
              const counterName = getOrderCounterName(order);

              const paymentMethodRaw =
                order.payment?.method || order.paymentMethod || "Cash";
              const isCashOrder = paymentMethodRaw.toLowerCase() === "cash";

              const borderClass =
                order.status === "Pending"
                  ? "border-amber-300 dark:border-amber-500/30 hover:border-amber-400 dark:hover:border-amber-500/50"
                  : order.status === "Confirmed"
                  ? "border-emerald-300 dark:border-emerald-500/30 hover:border-emerald-400 dark:hover:border-emerald-500/50"
                  : "border-rose-300 dark:border-rose-500/30 hover:border-rose-400 dark:hover:border-rose-500/50";

              const leftAccentClass =
                order.status === "Pending"
                  ? "bg-amber-500"
                  : order.status === "Confirmed"
                  ? "bg-emerald-500"
                  : "bg-rose-500";

              return (
                <div
                  key={order._id}
                  className={`relative bg-white dark:bg-[#111827] rounded-2xl shadow-sm border ${borderClass} overflow-hidden transition-all duration-200`}
                >
                  {/* Subtle left status strip */}
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1 ${leftAccentClass}`}
                  />

                  {/* TOP SUMMARY BAR */}
                  <div
                    onClick={() => toggleExpand(order._id)}
                    className="pl-5 pr-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition select-none"
                  >
                    <div className="flex-1 min-w-0">
                      {/* Top Badges Line */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-base text-slate-900 dark:text-slate-100 tracking-tight">
                          #{order._id.slice(-8).toUpperCase()}
                        </span>

                        {getStatusBadge(order.status)}

                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            isCashOrder
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50"
                              : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50"
                          }`}
                        >
                          {isCashOrder ? (
                            <FaRupeeSign className="text-[10px]" />
                          ) : (
                            <FiCreditCard className="text-xs" />
                          )}
                          <span>{isCashOrder ? "Cash" : "Online"}</span>
                        </span>

                        {(order.counter || order.counterName || order.counterId) && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-xs font-medium border border-slate-200/80 dark:border-slate-700">
                            <FiMonitor className="text-xs text-slate-400" />
                            <span>{counterName}</span>
                          </span>
                        )}

                        {completionTime && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-xs font-medium border border-slate-200/70 dark:border-slate-700">
                            <FiClock className="text-xs text-slate-400" />
                            <span>{completionTime}</span>
                          </span>
                        )}
                      </div>

                      {/* Meta Information Line */}
                      <div className="flex flex-wrap items-center gap-y-1 gap-x-4 mt-2.5 text-xs text-slate-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300">
                          {formatISTTime(order.createdAt)}
                        </span>

                        <span className="text-slate-300 dark:text-slate-700">•</span>

                        <span>
                          {order.items?.length || 0} {(order.items?.length === 1 ? "item" : "items")}
                        </span>

                        {order.customerName && (
                          <>
                            <span className="text-slate-300 dark:text-slate-700">•</span>
                            <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[180px]">
                              Cust: {order.customerName}
                            </span>
                          </>
                        )}

                        {order.status === "Confirmed" && order.confirmedBy && (
                          <>
                            <span className="text-slate-300 dark:text-slate-700">•</span>
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                              <FiUserCheck className="text-xs" />
                              <span>By: {order.confirmedBy.name}</span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Amount & Chevron */}
                    <div className="flex items-center justify-between md:justify-end gap-5 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
                      <div className="text-left md:text-right">
                        <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-400 dark:text-slate-500 block leading-none mb-1">
                          Total Amount
                        </span>
                        <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white flex items-baseline md:justify-end gap-0.5">
                          <span className="text-base text-slate-500 dark:text-slate-400 font-sans">₹</span>
                           <span className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white ml-2">{Number(order.totalAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 } )}</span>
                        </div>
                      </div>

                      <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 transition hover:bg-slate-200 dark:hover:bg-slate-700">
                        {isExpanded ? (
                          <FiChevronUp className="w-5 h-5" />
                        ) : (
                          <FiChevronDown className="w-5 h-5" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* EXPANDABLE DETAILS */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="overflow-hidden border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60"
                      >
                        <div className="p-5 sm:p-6 space-y-5">
                          {/* ITEMS LIST */}
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                                Order Items ({order.items?.length || 0})
                              </h4>
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                {order.items?.reduce((sum, item) => sum + (item.quantity || 0), 0)} Total Units
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                              {order.items?.map((item, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between bg-white dark:bg-[#111827] rounded-xl px-4 py-3 border border-slate-200/80 dark:border-slate-800 shadow-xs"
                                >
                                  <div className="min-w-0 pr-3">
                                    <p className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate">
                                      {item.productId?.name || "Product"}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                      Qty: <span className="font-semibold text-slate-700 dark:text-slate-300">{item.quantity}</span> × ₹{item.price}
                                    </p>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <p className="font-bold text-sm font-mono text-slate-900 dark:text-slate-100">
                                      ₹{(item.quantity * item.price).toFixed(2)}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* STATUS BANNER */}
                          {order.status === "Confirmed" && (
                            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 text-xs font-medium">
                              <FiCheckCircle className="text-emerald-600 dark:text-emerald-400 text-sm flex-shrink-0" />
                              <div className="flex-1">
                                <span>Order confirmed successfully</span>
                                {order.confirmedBy && (
                                  <span className="font-semibold"> by {order.confirmedBy.name}</span>
                                )}
                                {completionTime && (
                                  <span className="text-emerald-600 dark:text-emerald-400 ml-1.5 font-normal">
                                    (completed in {completionTime})
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          {order.status === "Cancelled" && (
                            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-800/40 text-rose-800 dark:text-rose-300 text-xs font-medium">
                              <FiAlertCircle className="text-rose-600 dark:text-rose-400 text-sm flex-shrink-0" />
                              <span>This order has been cancelled and cannot be fulfilled.</span>
                            </div>
                          )}

                          {/* ACTION BUTTONS TOOLBAR */}
                          <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-200/80 dark:border-slate-800">
                            {order.status === "Pending" && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => confirmOrder(order)}
                                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] shadow-xs transition"
                                >
                                  <FiCheck className="text-sm" /> Confirm Order
                                </button>
                                <button
                                  type="button"
                                  onClick={() => cancelOrder(order)}
                                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-800 active:scale-[0.98] transition"
                                >
                                  <FiX className="text-sm" /> Cancel Order
                                </button>
                              </>
                            )}

                            {(order.status === "Confirmed" ||
                              order.status === "Cancelled") && (
                              <button
                                type="button"
                                onClick={() => revertOrder(order)}
                                disabled={revertingId === order._id}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800 active:scale-[0.98] transition disabled:opacity-50"
                              >
                                <FiRotateCcw className="text-sm" /> Revert to Pending
                              </button>
                            )}

                            {order.status === "Confirmed" && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  reprintOrder(order);
                                }}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 active:scale-[0.98] transition shadow-xs"
                              >
                                <FiPrinter className="text-sm text-indigo-500" />
                                Reprint Bill
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                showOrderInfo(order);
                              }}
                              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 active:scale-[0.98] transition shadow-xs"
                            >
                              <FiActivity className="text-sm text-blue-500" />
                              Order Info
                            </button>

                            {(order.status === "Cancelled" ||
                              order.status === "Pending") && (
                              <button
                                type="button"
                                onClick={() => deleteOrder(order)}
                                disabled={deletingId === order._id}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/50 active:scale-[0.98] transition ml-auto disabled:opacity-50"
                              >
                                {deletingId === order._id ? (
                                  <div className="w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                  <FiTrash2 className="text-sm" />
                                )}
                                Delete Order
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}

        {/* PAGINATION BAR */}
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
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
            setExpandedOrderId(null);
          }}
          pageSizeOptions={[10, 25, 50, 100]}
          label="orders"
        />
      </div>

      {/* ✅ Reprint Bill Preview & Print Modal */}
      {previewOrder && (
        <div
          id="reprint-modal-container"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm print:static print:p-0 print:m-0 print:bg-transparent print:block print:overflow-visible"
        >
          {/* Backdrop click to close */}
          <div
            className="fixed inset-0 print:hidden"
            onClick={() => setPreviewOrder(null)}
          />

          <div
            className="relative z-10 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full max-h-[92vh] flex flex-col overflow-hidden print:border-none print:shadow-none print:max-w-none print:w-auto print:max-h-none print:overflow-visible print:bg-transparent print:rounded-none print:m-0 print:p-0"
          >
            {/* Modal Header — Hidden in print */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 print:hidden">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                  <FiPrinter className="text-lg" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white text-base">
                    Bill Preview / Print
                  </h3>
                  <p className="text-xs text-slate-500">
                    Order #{String(previewOrder._id || "").slice(-8).toUpperCase()}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewOrder(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition"
                title="Close"
              >
                <FiX className="text-lg" />
              </button>
            </div>

            {/* Modal Body — Thermal Receipt Preview */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex justify-center bg-slate-100 dark:bg-slate-950/60 print:p-0 print:m-0 print:overflow-visible print:bg-transparent print:block">
              <div
                id="thermal-receipt-container"
                className="shadow-lg rounded-xl overflow-hidden bg-white print:shadow-none print:rounded-none print:overflow-visible print:m-0 print:p-0"
              >
                <ThermalReceipt
                  order={previewOrder}
                  counter={previewOrder?.counter || { name: getOrderCounterName(previewOrder) }}
                />
              </div>
            </div>

            {/* Modal Footer / Actions — Hidden in print */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 print:hidden">
              <button
                type="button"
                onClick={() => setPreviewOrder(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md hover:shadow-lg transition"
              >
                <FiPrinter className="text-base" />
                Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern Order Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => {
          confirmModal.onClose?.();
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        }}
        onConfirm={confirmModal.onConfirm}
        type={confirmModal.type}
        title={confirmModal.title}
        subtitle={confirmModal.subtitle}
        order={confirmModal.order}
        counterName={confirmModal.counterName}
        rows={confirmModal.rows}
        headline={confirmModal.headline}
        subtext={confirmModal.subtext}
        confirmText={confirmModal.confirmText}
        confirmLoadingText={confirmModal.confirmLoadingText}
      />
    </>
  );
}