import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import api from "../services/api";
import socket from "../services/socket";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import Swal from "sweetalert2";

// ✅ Thermal receipt component (reused for reprint)
import ThermalReceipt from "../components/ThermalReceipt";

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

  // ✅ Generic confirmation dialog builder
  const showConfirmDialog = async ({
    title,
    headline,
    subtext,
    rows = [],
    confirmText = "Yes, Proceed",
    confirmColor = "#dc2626",
    icon = "warning",
  }) => {
    const html = `
      <div style="text-align:left; font-size:14px; line-height:1.9;">
        <div style="background:#f1f5f9; padding:10px 14px; border-radius:10px; margin-bottom:12px;">
          <div style="font-weight:700; color:#0f172a; margin-bottom:6px;">${headline || ""}</div>
          <div style="color:#475569;">${subtext || ""}</div>
        </div>
        ${
          rows.length
            ? `<table style="width:100%; border-collapse:collapse;">
                ${rows
                  .map(
                    ([k, v]) => `
                  <tr>
                    <td style="padding:6px 8px; color:#64748b; font-weight:600; width:45%;">${k}</td>
                    <td style="padding:6px 8px; color:#0f172a; font-weight:600;">${v}</td>
                  </tr>`,
                  )
                  .join("")}
              </table>`
            : ""
        }
      </div>
    `;

    const result = await Swal.fire({
      title,
      html,
      icon,
      showCancelButton: true,
      confirmButtonColor: confirmColor,
      cancelButtonColor: "#94a3b8",
      confirmButtonText: confirmText,
      cancelButtonText: "Cancel",
      reverseButtons: true,
      customClass: {
        popup:
          "rounded-2xl dark:bg-slate-800 dark:text-white border dark:border-slate-700 shadow-2xl",
      },
    });

    return result.isConfirmed;
  };

  // ✅ Success alert after action
  const showActionSuccess = (title, order, actionMeta = {}) => {
    const createdAt = order?.createdAt ? new Date(order.createdAt) : null;
    const now = new Date();
    const durationMs = createdAt ? now - createdAt : 0;
    const durationStr = createdAt ? humanDuration(durationMs) : "N/A";

    const actionTime = actionMeta.actionTime || now;

    const rows = [
      ["Order ID", `#${order._id.slice(-8)}`],
      ["Status", actionMeta.newStatus || order.status],
      ["Counter", getOrderCounterName(order)],
      ["Amount", `₹${Number(order.totalAmount || 0).toLocaleString()}`],
      ["Order Placed", formatISTTime(order.createdAt)],
      [`${actionMeta.actionLabel || "Action"} At`, formatISTTime(actionTime)],
      ["Total Time", durationStr],
    ];

    if (actionMeta.extraRows && Array.isArray(actionMeta.extraRows)) {
      rows.push(...actionMeta.extraRows);
    }

    const html = `
      <div style="text-align:left; font-size:14px; line-height:1.9;">
        <div style="background:#f1f5f9; padding:10px 14px; border-radius:10px; margin-bottom:12px;">
          <div style="font-weight:700; color:#0f172a; margin-bottom:6px;">${actionMeta.headline || title}</div>
          <div style="color:#475569;">${actionMeta.subtext || ""}</div>
        </div>
        <table style="width:100%; border-collapse:collapse;">
          ${rows
            .map(
              ([k, v]) => `
            <tr>
              <td style="padding:6px 8px; color:#64748b; font-weight:600; width:45%;">${k}</td>
              <td style="padding:6px 8px; color:#0f172a; font-weight:600;">${v}</td>
            </tr>`,
            )
            .join("")}
        </table>
      </div>
    `;

    Swal.fire({
      title,
      html,
      icon: actionMeta.icon || "success",
      confirmButtonText: "OK",
      confirmButtonColor:
        actionMeta.icon === "error"
          ? "#dc2626"
          : actionMeta.icon === "warning"
            ? "#f59e0b"
            : actionMeta.icon === "info"
              ? "#6366f1"
              : "#16a34a",
      customClass: {
        popup:
          "rounded-2xl dark:bg-slate-800 dark:text-white border dark:border-slate-700 shadow-2xl",
      },
    });
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
      const { data } = await api.get("/orders");
      setOrders(data);
    } catch (err) {
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, []);

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

  // ✅ CONFIRM — confirmation dialog + success alert
  const confirmOrder = useCallback(
    async (order) => {
      const orderId = order._id;

      const confirmed = await showConfirmDialog({
        title: "Confirm Order",
        headline: "Confirm this order?",
        subtext:
          "Stock will be deducted and the order will be marked as Confirmed.",
        icon: "question",
        confirmColor: "#16a34a",
        confirmText: "Yes, Confirm",
        rows: [
          ["Order ID", `#${order._id.slice(-8)}`],
          ["Counter", getOrderCounterName(order)],
          ["Amount", `₹${Number(order.totalAmount || 0).toLocaleString()}`],
          ["Order Placed", formatISTTime(order.createdAt)],
          [
            "Waiting For",
            humanDuration(Date.now() - new Date(order.createdAt).getTime()),
          ],
        ],
      });

      if (!confirmed) return;

      const startTime = Date.now();
      try {
        await api.put(`/orders/${orderId}/confirm`);

        if (expandedOrderId === orderId) {
          setExpandedOrderId(null);
        }

        showActionSuccess("Order Confirmed ✅", order, {
          headline: "Order has been confirmed successfully.",
          subtext: "Stock has been deducted and order is ready for processing.",
          newStatus: "Confirmed",
          actionLabel: "Confirmed",
          actionTime: new Date(startTime),
          icon: "success",
          extraRows: [
            [
              "Processing Time",
              humanDuration(Date.now() - new Date(order.createdAt).getTime()),
            ],
          ],
        });

        fetchOrders();
      } catch (err) {
        toast.error(err.response?.data?.message || "Confirmation failed");
        showActionSuccess("Confirmation Failed ❌", order, {
          headline: "Could not confirm the order.",
          subtext: err.response?.data?.message || "Please try again.",
          icon: "error",
          actionLabel: "Attempted",
        });
      }
    },
    [fetchOrders, expandedOrderId],
  );

  // ✅ CANCEL — confirmation dialog + success alert
  const cancelOrder = useCallback(
    async (order) => {
      const orderId = order._id;

      const confirmed = await showConfirmDialog({
        title: "Cancel Order",
        headline: "Cancel this order?",
        subtext:
          "Are you sure you want to cancel this order? This action can be reverted.",
        icon: "warning",
        confirmColor: "#dc2626",
        confirmText: "Yes, Cancel",
        rows: [
          ["Order ID", `#${order._id.slice(-8)}`],
          ["Counter", getOrderCounterName(order)],
          ["Amount", `₹${Number(order.totalAmount || 0).toLocaleString()}`],
          ["Order Placed", formatISTTime(order.createdAt)],
          [
            "Pending For",
            humanDuration(Date.now() - new Date(order.createdAt).getTime()),
          ],
        ],
      });

      if (!confirmed) return;

      const startTime = Date.now();
      try {
        await api.put(`/orders/${orderId}/cancel`);

        if (expandedOrderId === orderId) {
          setExpandedOrderId(null);
        }

        showActionSuccess("Order Cancelled ❌", order, {
          headline: "Order has been cancelled.",
          subtext: "Stock has been restored. You can revert this if needed.",
          newStatus: "Cancelled",
          actionLabel: "Cancelled",
          actionTime: new Date(startTime),
          icon: "warning",
          extraRows: [
            [
              "Pending Duration",
              humanDuration(Date.now() - new Date(order.createdAt).getTime()),
            ],
          ],
        });

        fetchOrders();
      } catch (err) {
        toast.error(err.response?.data?.message || "Cancellation failed");
        showActionSuccess("Cancellation Failed ❌", order, {
          headline: "Could not cancel the order.",
          subtext: err.response?.data?.message || "Please try again.",
          icon: "error",
          actionLabel: "Attempted",
        });
      }
    },
    [fetchOrders, expandedOrderId],
  );

  // ✅ REVERT — confirmation dialog + success alert
  const revertOrder = useCallback(
    async (order) => {
      const orderId = order._id;

      const confirmed = await showConfirmDialog({
        title: "Revert Order",
        headline: "Revert this order to Pending?",
        subtext: "Stock will be adjusted accordingly.",
        icon: "question",
        confirmColor: "#f59e0b",
        confirmText: "Yes, Revert",
        rows: [
          ["Order ID", `#${order._id.slice(-8)}`],
          ["Current Status", order.status],
          ["Counter", getOrderCounterName(order)],
          ["Amount", `₹${Number(order.totalAmount || 0).toLocaleString()}`],
          ["Order Placed", formatISTTime(order.createdAt)],
        ],
      });

      if (!confirmed) return;

      const startTime = Date.now();
      setRevertingId(orderId);
      try {
        await api.put(`/orders/${orderId}/revert`);

        if (expandedOrderId === orderId) {
          setExpandedOrderId(null);
        }

        showActionSuccess("Order Reverted ↩️", order, {
          headline: "Order has been reverted to Pending.",
          subtext: "Stock has been adjusted accordingly.",
          newStatus: "Pending",
          actionLabel: "Reverted",
          actionTime: new Date(startTime),
          icon: "info",
          extraRows: [
            ["Previous Status", order.status],
            [
              "Time Since Order",
              humanDuration(Date.now() - new Date(order.createdAt).getTime()),
            ],
          ],
        });

        fetchOrders();
      } catch (err) {
        toast.error(err.response?.data?.message || "Revert failed");
        showActionSuccess("Revert Failed ❌", order, {
          headline: "Could not revert the order.",
          subtext: err.response?.data?.message || "Please try again.",
          icon: "error",
          actionLabel: "Attempted",
        });
      } finally {
        setRevertingId(null);
      }
    },
    [fetchOrders, expandedOrderId],
  );

  // ✅ DELETE — confirmation dialog + success alert
  const deleteOrder = useCallback(
    async (order) => {
      const orderId = order._id;
      const orderStatus = order.status;

      if (orderStatus !== "Cancelled" && orderStatus !== "Pending") {
        toast.error("Only cancelled or pending orders can be deleted");
        return;
      }

      const confirmed = await showConfirmDialog({
        title: "Delete Order",
        headline: "Permanently delete this order?",
        subtext: "This action cannot be undone.",
        icon: "warning",
        confirmColor: "#dc2626",
        confirmText: "Yes, Delete",
        rows: [
          ["Order ID", `#${order._id.slice(-8)}`],
          ["Current Status", orderStatus],
          ["Counter", getOrderCounterName(order)],
          ["Amount", `₹${Number(order.totalAmount || 0).toLocaleString()}`],
          ["Order Placed", formatISTTime(order.createdAt)],
        ],
      });

      if (!confirmed) return;

      const startTime = Date.now();
      setDeletingId(orderId);
      try {
        await api.delete(`/orders/${orderId}`);

        if (expandedOrderId === orderId) {
          setExpandedOrderId(null);
        }

        showActionSuccess("Order Deleted 🗑️", order, {
          headline: "Order has been permanently deleted.",
          subtext: "This record is no longer available in the system.",
          actionLabel: "Deleted",
          actionTime: new Date(startTime),
          icon: "warning",
          extraRows: [
            ["Previous Status", orderStatus],
            [
              "Record Lifetime",
              humanDuration(Date.now() - new Date(order.createdAt).getTime()),
            ],
          ],
        });

        fetchOrders();
      } catch (err) {
        toast.error(err.response?.data?.message || "Delete failed");
        showActionSuccess("Delete Failed ❌", order, {
          headline: "Could not delete the order.",
          subtext: err.response?.data?.message || "Please try again.",
          icon: "error",
          actionLabel: "Attempted",
        });
      } finally {
        setDeletingId(null);
      }
    },
    [fetchOrders, expandedOrderId],
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

  const goPrevDay = () => setFilterDate((prev) => addDays(prev, -1));
  const goNextDay = () => {
    const today = getTodayLocal();
    const next = addDays(filterDate, 1);
    if (next > today) {
      toast.error("Cannot go beyond today");
      return;
    }
    setFilterDate(next);
  };

  // ✅ Bulk delete: pending
  const deleteAllPendingOrders = useCallback(async () => {
    const pendingOrdersForDate = orders.filter(
      (o) => o.status === "Pending" && isSameISTDate(o.createdAt, filterDate),
    );

    if (pendingOrdersForDate.length === 0) {
      toast.error(`No pending orders found for ${filterDate}`);
      return;
    }

    const confirmed = await showConfirmDialog({
      title: "Delete All Pending Orders",
      headline: `Delete ${pendingOrdersForDate.length} pending orders?`,
      subtext: "This action cannot be undone.",
      icon: "warning",
      confirmColor: "#dc2626",
      confirmText: "Yes, Delete All",
      rows: [
        ["Date", filterDate],
        ["Pending Orders", pendingOrdersForDate.length],
      ],
    });

    if (!confirmed) return;

    const startTime = Date.now();
    try {
      await api.delete("/orders/bulk/pending", {
        data: { date: filterDate },
      });

      showActionSuccess(
        "Pending Orders Deleted 🗑️",
        { _id: filterDate, totalAmount: 0, createdAt: new Date() },
        {
          headline: "All pending orders deleted.",
          subtext: `${pendingOrdersForDate.length} pending order(s) removed.`,
          actionLabel: "Deleted",
          actionTime: new Date(startTime),
          icon: "success",
          extraRows: [
            ["Deleted Count", pendingOrdersForDate.length],
            ["Date", filterDate],
          ],
        },
      );

      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || "Bulk delete failed");
    }
  }, [orders, filterDate, fetchOrders]);

  // ✅ Bulk delete: cancelled
  const deleteAllCancelledOrders = useCallback(async () => {
    const cancelledOrdersForDate = orders.filter(
      (o) => o.status === "Cancelled" && isSameISTDate(o.createdAt, filterDate),
    );

    if (cancelledOrdersForDate.length === 0) {
      toast.error(`No cancelled orders found for ${filterDate}`);
      return;
    }

    const confirmed = await showConfirmDialog({
      title: "Delete All Cancelled Orders",
      headline: `Delete ${cancelledOrdersForDate.length} cancelled orders?`,
      subtext: "This action cannot be undone.",
      icon: "warning",
      confirmColor: "#dc2626",
      confirmText: "Yes, Delete All",
      rows: [
        ["Date", filterDate],
        ["Cancelled Orders", cancelledOrdersForDate.length],
      ],
    });

    if (!confirmed) return;

    const startTime = Date.now();
    try {
      await api.delete("/orders/bulk/cancelled", {
        data: { date: filterDate },
      });

      showActionSuccess(
        "Cancelled Orders Deleted 🗑️",
        { _id: filterDate, totalAmount: 0, createdAt: new Date() },
        {
          headline: "All cancelled orders deleted.",
          subtext: `${cancelledOrdersForDate.length} cancelled order(s) removed.`,
          actionLabel: "Deleted",
          actionTime: new Date(startTime),
          icon: "success",
          extraRows: [
            ["Deleted Count", cancelledOrdersForDate.length],
            ["Date", filterDate],
          ],
        },
      );

      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || "Bulk delete failed");
    }
  }, [orders, filterDate, fetchOrders]);

  // ✅ Bulk delete: all records for date
  const deleteAllRecordsForDate = useCallback(async () => {
    const ordersForDate = orders.filter((o) =>
      isSameISTDate(o.createdAt, filterDate),
    );

    if (ordersForDate.length === 0) {
      toast.error(`No orders found for ${filterDate}`);
      return;
    }

    const confirmed = await showConfirmDialog({
      title: "Delete All Orders",
      headline: `Delete ALL ${ordersForDate.length} orders?`,
      subtext: "This action cannot be undone.",
      icon: "warning",
      confirmColor: "#dc2626",
      confirmText: "Yes, Delete All",
      rows: [
        ["Date", filterDate],
        ["Total Orders", ordersForDate.length],
      ],
    });

    if (!confirmed) return;

    const startTime = Date.now();
    try {
      await api.delete("/orders/by-date", {
        data: { date: filterDate },
      });

      showActionSuccess(
        "All Orders Deleted 🗑️",
        { _id: filterDate, totalAmount: 0, createdAt: new Date() },
        {
          headline: "All orders deleted.",
          subtext: `${ordersForDate.length} order(s) removed.`,
          actionLabel: "Deleted",
          actionTime: new Date(startTime),
          icon: "success",
          extraRows: [
            ["Deleted Count", ordersForDate.length],
            ["Date", filterDate],
          ],
        },
      );

      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete records");
    }
  }, [orders, filterDate, fetchOrders]);

  // ✅ Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesDate = isSameISTDate(order.createdAt, filterDate);
      const matchesStatus =
        filterStatus === "all"
          ? true
          : order.status.toLowerCase() === filterStatus;
      const matchesCounter =
        filterCounter === "all" ? true : getOrderCounterName(order) === filterCounter;
      return matchesDate && matchesStatus && matchesCounter;
    });
  }, [orders, filterStatus, filterDate, filterCounter, countersMap]);

  const stats = useMemo(() => {
    return {
      total: filteredOrders.length,
      pending: filteredOrders.filter((o) => o.status === "Pending").length,
      confirmed: filteredOrders.filter((o) => o.status === "Confirmed").length,
      cancelled: filteredOrders.filter((o) => o.status === "Cancelled").length,
      revenue: filteredOrders
        .filter((o) => o.status === "Confirmed")
        .reduce((acc, item) => acc + item.totalAmount, 0),
      cashCount: filteredOrders.filter((o) => {
        const method = o.payment?.method || o.paymentMethod || "";
        return method.toLowerCase() === "cash";
      }).length,
      onlineCount: filteredOrders.filter((o) => {
        const method = o.payment?.method || o.paymentMethod || "";
        return method.toLowerCase() === "online";
      }).length,
    };
  }, [filteredOrders]);

  const getStatusBadge = (status) => {
    switch (status) {
      case "Pending":
        return (
          <div className="flex items-center gap-1.5 bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-semibold">
            <FiClock /> Pending
          </div>
        );
      case "Confirmed":
        return (
          <div className="flex items-center gap-1.5 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">
            <FiCheckCircle /> Confirmed
          </div>
        );
      case "Cancelled":
        return (
          <div className="flex items-center gap-1.5 bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-semibold">
            <FiXCircle /> Cancelled
          </div>
        );
      default:
        return null;
    }
  };

  const ordersForDate = orders.filter((o) =>
    isSameISTDate(o.createdAt, filterDate),
  );
  const cancelledOrdersForDate = ordersForDate.filter(
    (o) => o.status === "Cancelled",
  ).length;
  const pendingOrdersForDate = ordersForDate.filter(
    (o) => o.status === "Pending",
  ).length;

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
    return parts.length > 0 ? parts.join(" • ") : "";
  }, [filterStatus, filterCounter]);

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
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-slate-800 dark:text-white">
                Live Order Monitoring
              </h1>
              <AnimatePresence>
                {livePulse && (
                  <motion.div
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.7, opacity: 0 }}
                    className="flex items-center gap-2 bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold"
                  >
                    <FiActivity className="animate-pulse" />
                    LIVE UPDATE
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Real-time order tracking & management dashboard
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={deleteAllPendingOrders}
                disabled={pendingOrdersForDate === 0}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
                  pendingOrdersForDate > 0
                    ? "bg-yellow-500 hover:bg-yellow-600 text-white shadow-md"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
                }`}
              >
                <FiTrash2 className="text-sm" /> Delete Pending (
                {pendingOrdersForDate})
              </button>
              <button
                onClick={deleteAllCancelledOrders}
                disabled={cancelledOrdersForDate === 0}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
                  cancelledOrdersForDate > 0
                    ? "bg-red-500 hover:bg-red-600 text-white shadow-md"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
                }`}
              >
                <FiTrash className="text-sm" /> Delete Cancelled (
                {cancelledOrdersForDate})
              </button>
              <button
                onClick={deleteAllRecordsForDate}
                disabled={ordersForDate.length === 0}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
                  ordersForDate.length > 0
                    ? "bg-red-600 hover:bg-red-700 text-white shadow-md"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
                }`}
              >
                <FiTrash className="text-sm" /> Delete All (
                {ordersForDate.length})
              </button>
            </div>

            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-2xl shadow-sm">
              <button
                onClick={goPrevDay}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                <FiChevronLeft />
              </button>
              <FiCalendar className="text-indigo-500" />
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                max={getTodayLocal()}
                className="bg-transparent outline-none"
              />
              <button
                onClick={goNextDay}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
              >
                <FiChevronRight />
              </button>
            </div>
          </div>
        </div>

        {/* DATE DISPLAY */}
        <div className="mb-2 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <FiCalendar className="text-indigo-500" />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Showing orders for:
            </span>
            <span className="text-sm font-semibold text-gray-800 dark:text-white">
              {displayDate}
            </span>
            {filterSummary && (
              <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">
                {filterSummary}
              </span>
            )}
          </div>
          {/* ✅ FIXED: reflects filtered count */}
          <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            {filteredOrders.length}{" "}
            {filteredOrders.length === 1 ? "order" : "orders"} found
          </div>
        </div>

        {/* STATS CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-5">
          <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-indigo-100 text-sm font-medium">
                  Total Orders
                </p>
                <p className="text-3xl font-bold mt-1">{stats.total}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <FiShoppingBag className="text-2xl text-white" />
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-amber-100 text-sm font-medium">
                  Pending Orders
                </p>
                <p className="text-3xl font-bold mt-1">{stats.pending}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <FiClock className="text-2xl text-white" />
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-emerald-100 text-sm font-medium">
                  Confirmed Orders
                </p>
                <p className="text-3xl font-bold mt-1">{stats.confirmed}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <FiCheckCircle className="text-2xl text-white" />
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-rose-500 to-rose-600 rounded-xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-rose-100 text-sm font-medium">
                  Cancelled Orders
                </p>
                <p className="text-3xl font-bold mt-1">{stats.cancelled}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <FiXCircle className="text-2xl text-white" />
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-purple-100 text-sm font-medium">Revenue</p>
                <p className="text-3xl font-bold mt-1">
                  ₹{stats.revenue.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <FiTrendingUp className="text-2xl text-white" />
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-blue-100 text-sm font-medium">Cash Orders</p>
                <p className="text-3xl font-bold mt-1">{stats.cashCount}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <FiPackage className="text-2xl text-white" />
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-cyan-100 text-sm font-medium">
                  Online Orders
                </p>
                <p className="text-3xl font-bold mt-1">{stats.onlineCount}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <FiPackage className="text-2xl text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* STATUS FILTERS */}
        <div className="flex flex-wrap gap-3">
          {[
            ["all", "All"],
            ["pending", "Pending"],
            ["confirmed", "Confirmed"],
            ["cancelled", "Cancelled"],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilterStatus(value)}
              className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                filterStatus === value
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                  : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* COUNTER FILTER */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <FiMonitor className="text-indigo-500" />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Counter:
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterCounter("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                filterCounter === "all"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              All
            </button>
            {allCounters.map((counter) => (
              <button
                key={counter.name}
                onClick={() => setFilterCounter(counter.name)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1 ${
                  filterCounter === counter.name
                    ? "bg-indigo-600 text-white shadow-md"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                <FiMonitor className="text-xs" />
                {counter.name}
              </button>
            ))}
          </div>
        </div>

        {/* ORDERS LIST */}
        {filteredOrders.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-16 text-center">
            <FiPackage className="mx-auto text-6xl text-slate-300 mb-4" />
            <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">
              No Orders Found
            </h3>
            <p className="text-slate-500 mt-2">
              No orders available for selected date, status & counter.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {filteredOrders.map((order) => {
              const completionTime = getCompletionTime(order);
              const isExpanded = expandedOrderId === order._id;
              const counterName = getOrderCounterName(order);

              const paymentMethodRaw =
                order.payment?.method || order.paymentMethod || "Cash";
              const isCashOrder = paymentMethodRaw.toLowerCase() === "cash";

              return (
                <div
                  key={order._id}
                  className={`bg-white dark:bg-slate-800 rounded-3xl shadow-sm border overflow-hidden ${
                    order.status === "Pending"
                      ? "border-yellow-300"
                      : order.status === "Confirmed"
                        ? "border-green-300"
                        : "border-red-300"
                  }`}
                >
                  {/* TOP BAR */}
                  <div
                    onClick={() => toggleExpand(order._id)}
                    className="bg-slate-50 dark:bg-slate-900 px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h2 className="font-bold text-lg">
                          Order #{order._id.slice(-8)}
                        </h2>
                        {getStatusBadge(order.status)}
                        {completionTime && (
                          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                            <FiTime className="text-xs" />
                            {completionTime}
                          </div>
                        )}
                        {(order.counter || order.counterName || order.counterId) && (
                          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold">
                            <FiMonitor className="text-xs" />
                            <span>{counterName}</span>
                          </div>
                        )}

                        <div
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                            isCashOrder
                              ? "bg-green-100 text-green-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {isCashOrder ? (
                            <FaRupeeSign className="text-xs" />
                          ) : (
                            <FiCreditCard className="text-xs" />
                          )}
                          {isCashOrder ? "Cash" : "Online"}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-500">
                        <span>
                          {new Date(order.createdAt).toLocaleString()}
                        </span>
                        {order.status === "Confirmed" && order.confirmedBy && (
                          <span className="inline-flex items-center gap-1">
                            <FiUserCheck className="text-green-600" />
                            Confirmed by:{" "}
                            <span className="font-semibold text-green-700 dark:text-green-300">
                              {order.confirmedBy.name}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm text-slate-500">Total Amount</p>
                        <h2 className="text-3xl font-bold text-indigo-600">
                          ₹{order.totalAmount}
                        </h2>
                      </div>
                      <div className="p-1.5 rounded-lg">
                        {isExpanded ? (
                          <FiChevronUp className="text-slate-600 dark:text-slate-400 text-2xl" />
                        ) : (
                          <FiChevronDown className="text-slate-600 dark:text-slate-400 text-2xl" />
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
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="p-6 border-t border-gray-200 dark:border-slate-700">
                          {/* ITEMS */}
                          <div className="space-y-3">
                            <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">
                              Order Items
                            </h4>
                            {order.items.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 rounded-2xl px-4 py-3"
                              >
                                <div>
                                  <p className="font-semibold">
                                    {item.productId?.name || "Deleted Product"}
                                  </p>
                                  <p className="text-sm text-slate-500">
                                    Qty: {item.quantity}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-lg">
                                    ₹{item.quantity * item.price}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    ₹{item.price} each
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* ACTIONS */}
                          <div className="flex flex-wrap gap-3 mt-6">
                            {order.status === "Pending" && (
                              <>
                                <button
                                  onClick={() => confirmOrder(order)}
                                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-2xl font-semibold transition"
                                >
                                  <FiCheck /> Confirm Order
                                </button>
                                <button
                                  onClick={() => cancelOrder(order)}
                                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-2xl font-semibold transition"
                                >
                                  <FiX /> Cancel Order
                                </button>
                              </>
                            )}

                            {(order.status === "Confirmed" ||
                              order.status === "Cancelled") && (
                              <button
                                onClick={() => revertOrder(order)}
                                disabled={revertingId === order._id}
                                className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-5 py-3 rounded-2xl font-semibold transition disabled:opacity-50"
                              >
                                <FiRotateCcw /> Revert to Pending
                              </button>
                            )}

                            {order.status === "Confirmed" && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  reprintOrder(order);
                                }}
                                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-2xl font-semibold transition"
                              >
                                <FiPrinter className="text-lg" />
                                Reprint Bill
                              </button>
                            )}

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                showOrderInfo(order);
                              }}
                              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-2xl font-semibold transition"
                            >
                              <FiActivity className="text-lg" />
                              Order Info
                            </button>

                            {(order.status === "Cancelled" ||
                              order.status === "Pending") && (
                              <button
                                onClick={() => deleteOrder(order)}
                                disabled={deletingId === order._id}
                                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-2xl font-semibold transition ml-auto"
                              >
                                {deletingId === order._id ? (
                                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                  <FiTrash2 className="text-lg" />
                                )}
                                Delete Order
                              </button>
                            )}
                          </div>

                          {order.status === "Confirmed" && (
                            <div className="mt-6 flex items-center gap-2 text-green-600 font-semibold">
                              <FiCheckCircle /> Order successfully confirmed
                              {order.confirmedBy &&
                                ` by ${order.confirmedBy.name}`}
                              {completionTime && (
                                <span className="ml-2 text-sm text-blue-600">
                                  Completed in {completionTime}
                                </span>
                              )}
                            </div>
                          )}
                          {order.status === "Cancelled" && (
                            <div className="mt-6 flex items-center gap-2 text-red-600 font-semibold">
                              <FiAlertCircle /> Order cancelled by admin
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
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
    </>
  );
}