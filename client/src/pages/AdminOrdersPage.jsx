import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import api from "../services/api";
import socket from "../services/socket";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { confirmAlert } from "react-confirm-alert";
import "react-confirm-alert/src/react-confirm-alert.css";

import {
  FiXCircle,
  FiCheckCircle,
  FiClock,
  FiPackage,
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiShoppingBag,
  FiRefreshCw,
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
} from "react-icons/fi";

// ✅ IST Date Functions
function getTodayLocal() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);
  const year = istDate.getUTCFullYear();
  const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(istDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getISTDateFromUTC(utcDateString) {
  const date = new Date(utcDateString);
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(date.getTime() + istOffset);
  const year = istDate.getUTCFullYear();
  const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(istDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isSameISTDate(orderCreatedAt, filterDate) {
  const orderISTDate = getISTDateFromUTC(orderCreatedAt);
  return orderISTDate === filterDate;
}

function addDays(dateStr, days) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  const newYear = date.getFullYear();
  const newMonth = String(date.getMonth() + 1).padStart(2, '0');
  const newDay = String(date.getDate()).padStart(2, '0');
  return `${newYear}-${newMonth}-${newDay}`;
}

// ✅ THERMAL BILL PRINT FUNCTION
const printThermalBill = (order) => {
  const billNumber = order._id.slice(-6);
  const date = new Date(order.createdAt).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const time = new Date(order.createdAt).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);

  const billHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Thermal Bill</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Courier New', monospace;
          background: #fff;
          padding: 20px;
          width: 80mm;
          margin: 0 auto;
        }
        .bill-container {
          border: 1px dashed #ddd;
          padding: 15px;
          background: #fff;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #000;
          padding-bottom: 10px;
          margin-bottom: 10px;
        }
        .header h1 {
          font-size: 18px;
          font-weight: bold;
          letter-spacing: 2px;
        }
        .header p {
          font-size: 11px;
          color: #666;
          margin-top: 2px;
        }
        .bill-info {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          margin-bottom: 10px;
          border-bottom: 1px dashed #ccc;
          padding-bottom: 8px;
        }
        .items-table {
          width: 100%;
          font-size: 12px;
          border-collapse: collapse;
          margin-bottom: 10px;
        }
        .items-table th {
          text-align: left;
          border-bottom: 1px solid #000;
          padding: 4px 0;
          font-size: 11px;
        }
        .items-table td {
          padding: 3px 0;
        }
        .items-table .qty { text-align: center; }
        .items-table .amount { text-align: right; }
        .total-row {
          border-top: 2px solid #000;
          padding-top: 6px;
          margin-top: 4px;
          font-weight: bold;
          font-size: 14px;
          display: flex;
          justify-content: space-between;
        }
        .payment-info {
          border-top: 1px dashed #ccc;
          padding-top: 8px;
          margin-top: 8px;
          font-size: 12px;
          display: flex;
          justify-content: space-between;
        }
        .footer {
          text-align: center;
          font-size: 10px;
          color: #888;
          margin-top: 10px;
          border-top: 1px dashed #ccc;
          padding-top: 8px;
        }
        .thank-you {
          text-align: center;
          font-size: 14px;
          font-weight: bold;
          margin-top: 8px;
          letter-spacing: 1px;
        }
        @media print {
          body { padding: 10px; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="bill-container" id="bill-content">
        <div class="header">
          <h1>CAMPUS STORE</h1>
          <p>APC Consumer Store • Hostel Campus</p>
          <p style="font-size:10px; color:#999;">GST: 22ABCDE1234F1Z5</p>
        </div>

        <div class="bill-info">
          <span><strong>Bill No:</strong> #${billNumber}</span>
          <span><strong>Date:</strong> ${date}</span>
        </div>
        <div class="bill-info" style="border-bottom: none; padding-bottom: 0; margin-bottom: 8px;">
          <span><strong>Time:</strong> ${time}</span>
          <span><strong>Status:</strong> ${order.status === 'Confirmed' ? 'Completed' : 'Pending'}</span>
          ${order.counterName ? `<span><strong>Counter:</strong> ${order.counterName}</span>` : ''}
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th style="width:50%;">Item</th>
              <th class="qty" style="width:20%;">Qty</th>
              <th class="amount" style="width:30%;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${order.items.map(item => `
              <tr>
                <td>${item.productId?.name || 'Unknown'}</td>
                <td class="qty">${item.quantity}</td>
                <td class="amount">₹${(item.quantity * item.price).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="border-top: 2px solid #000; margin: 4px 0;"></div>

        <div class="total-row">
          <span>TOTAL</span>
          <span>₹${order.totalAmount.toFixed(2)}</span>
        </div>

        <div class="payment-info">
          <span><strong>Payment:</strong> Cash</span>
          <span><strong>Items:</strong> ${totalItems}</span>
        </div>

        <div class="footer">
          <p>Hostel Counter • APC Campus</p>
          <p style="font-size:9px;">Support: +91 98765 43210</p>
        </div>

        <div class="thank-you">
          Thank You!
        </div>
        <div style="text-align:center; font-size:10px; color:#aaa; margin-top:4px;">
          Visit Again!
        </div>
      </div>

      <div style="text-align:center; margin-top:15px;" class="no-print">
        <button onclick="window.print()" style="padding:12px 40px; background:#4f46e5; color:white; border:none; border-radius:10px; font-size:16px; cursor:pointer;">
          Print Bill
        </button>
        <button onclick="window.close()" style="padding:12px 30px; background:#6b7280; color:white; border:none; border-radius:10px; font-size:16px; cursor:pointer; margin-left:10px;">
          Close
        </button>
      </div>

      <script>
        window.onload = function() {
          setTimeout(() => {
            window.print();
          }, 500);
        };
      </script>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank', 'width=400,height=600');
  if (printWindow) {
    printWindow.document.write(billHTML);
    printWindow.document.close();
  } else {
    toast.error('Please allow popups for printing');
  }
};

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

  const ordersRef = useRef([]);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  // ✅ Get unique counters from orders
  const getUniqueCounters = useCallback(() => {
    const counters = new Set();
    orders.forEach(order => {
      if (order.counterId) {
        counters.add(order.counterId);
      }
    });
    return Array.from(counters);
  }, [orders]);

  // ✅ Calculate order completion time
  const getCompletionTime = (order) => {
    if (order.status !== "Confirmed") return null;
    
    const created = new Date(order.createdAt);
    const confirmed = new Date(order.confirmedAt || order.updatedAt);
    
    if (isNaN(confirmed.getTime())) return null;
    
    const diffMs = confirmed - created;
    const diffMins = Math.floor(diffMs / 60000);
    const diffSecs = Math.floor((diffMs % 60000) / 1000);
    
    if (diffMins > 0) {
      return `${diffMins}m ${diffSecs}s`;
    }
    return `${diffSecs}s`;
  };

  const showConfirm = (title, message, onConfirm, onCancel = () => {}) => {
    confirmAlert({
      title: title,
      message: message,
      buttons: [
        { label: "Yes, Delete", onClick: onConfirm },
        { label: "Cancel", onClick: onCancel },
      ],
      customUI: ({ onClose }) => (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">{title}</h2>
            <p className="text-slate-600 dark:text-slate-300 mb-6">{message}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { onClose(); onCancel(); }}
                className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => { onClose(); onConfirm(); }}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ),
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

  const confirmOrder = useCallback(async (orderId) => {
    try {
      await api.put(`/orders/${orderId}/confirm`);
      toast.success("Order confirmed successfully");
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || "Confirmation failed");
    }
  }, [fetchOrders]);

  const cancelOrder = useCallback(async (orderId) => {
    showConfirm(
      "Cancel Order",
      "Are you sure you want to cancel this order? This action can be reverted.",
      async () => {
        try {
          await api.put(`/orders/${orderId}/cancel`);
          toast.success("Order cancelled successfully");
          fetchOrders();
        } catch (err) {
          toast.error(err.response?.data?.message || "Cancellation failed");
        }
      }
    );
  }, [fetchOrders]);

  const revertOrder = useCallback(async (orderId) => {
    showConfirm(
      "Revert Order",
      "Revert this order back to Pending? Stock will be adjusted accordingly.",
      async () => {
        setRevertingId(orderId);
        try {
          await api.put(`/orders/${orderId}/revert`);
          toast.success("Order reverted to Pending");
          fetchOrders();
        } catch (err) {
          toast.error(err.response?.data?.message || "Revert failed");
        } finally {
          setRevertingId(null);
        }
      }
    );
  }, [fetchOrders]);

  const deleteOrder = useCallback(async (orderId, orderStatus) => {
    if (orderStatus !== "Cancelled" && orderStatus !== "Pending") {
      toast.error("Only cancelled or pending orders can be deleted");
      return;
    }

    showConfirm(
      "Delete Order",
      "Are you sure you want to permanently delete this order? This action cannot be undone.",
      async () => {
        setDeletingId(orderId);
        try {
          await api.delete(`/orders/${orderId}`);
          toast.success("Order deleted successfully");
          fetchOrders();
        } catch (err) {
          toast.error(err.response?.data?.message || "Delete failed");
        } finally {
          setDeletingId(null);
        }
      }
    );
  }, [fetchOrders]);

  const deleteAllPendingOrders = useCallback(async () => {
    const pendingOrdersForDate = orders.filter(
      (o) => o.status === "Pending" && isSameISTDate(o.createdAt, filterDate)
    );
    
    if (pendingOrdersForDate.length === 0) {
      toast.error(`No pending orders found for ${filterDate}`);
      return;
    }

    showConfirm(
      "Delete All Pending Orders",
      `Are you sure you want to permanently delete ALL ${pendingOrdersForDate.length} pending orders for ${filterDate}?`,
      async () => {
        try {
          await api.delete("/orders/bulk/pending", { data: { date: filterDate } });
          toast.success(`${pendingOrdersForDate.length} pending orders deleted`);
          fetchOrders();
        } catch (err) {
          toast.error(err.response?.data?.message || "Bulk delete failed");
        }
      }
    );
  }, [orders, filterDate, fetchOrders]);

  const deleteAllCancelledOrders = useCallback(async () => {
    const cancelledOrdersForDate = orders.filter(
      (o) => o.status === "Cancelled" && isSameISTDate(o.createdAt, filterDate)
    );
    
    if (cancelledOrdersForDate.length === 0) {
      toast.error(`No cancelled orders found for ${filterDate}`);
      return;
    }

    showConfirm(
      "Delete All Cancelled Orders",
      `Are you sure you want to permanently delete ALL ${cancelledOrdersForDate.length} cancelled orders for ${filterDate}?`,
      async () => {
        try {
          await api.delete("/orders/bulk/cancelled", { data: { date: filterDate } });
          toast.success(`${cancelledOrdersForDate.length} cancelled orders deleted`);
          fetchOrders();
        } catch (err) {
          toast.error(err.response?.data?.message || "Bulk delete failed");
        }
      }
    );
  }, [orders, filterDate, fetchOrders]);

  const deleteAllRecordsForDate = useCallback(async () => {
    const ordersForDate = orders.filter((o) => isSameISTDate(o.createdAt, filterDate));
    
    if (ordersForDate.length === 0) {
      toast.error(`No orders found for ${filterDate}`);
      return;
    }

    showConfirm(
      "Delete All Orders",
      `Are you sure you want to delete ALL ${ordersForDate.length} orders for ${filterDate}?`,
      async () => {
        try {
          await api.delete("/orders/by-date", { data: { date: filterDate } });
          toast.success(`Deleted all ${ordersForDate.length} orders`);
          fetchOrders();
        } catch (err) {
          toast.error(err.response?.data?.message || "Failed to delete records");
        }
      }
    );
  }, [orders, filterDate, fetchOrders]);

  // ✅ Reprint order
  const reprintOrder = useCallback((order) => {
    if (!order || order.status !== "Confirmed") {
      toast.error('Only confirmed orders can be reprinted');
      return;
    }
    printThermalBill(order);
    toast.success('Reprinting bill...', { duration: 2000 });
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

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesDate = isSameISTDate(order.createdAt, filterDate);
      const matchesStatus = filterStatus === "all" ? true : order.status.toLowerCase() === filterStatus;
      const matchesCounter = filterCounter === "all" ? true : order.counterId === filterCounter;
      return matchesDate && matchesStatus && matchesCounter;
    });
  }, [orders, filterStatus, filterDate, filterCounter]);

  const stats = useMemo(() => {
    return {
      total: filteredOrders.length,
      pending: filteredOrders.filter((o) => o.status === "Pending").length,
      confirmed: filteredOrders.filter((o) => o.status === "Confirmed").length,
      cancelled: filteredOrders.filter((o) => o.status === "Cancelled").length,
      revenue: filteredOrders
        .filter((o) => o.status === "Confirmed")
        .reduce((acc, item) => acc + item.totalAmount, 0),
    };
  }, [filteredOrders]);

  const getStatusBadge = (status) => {
    switch (status) {
      case "Pending":
        return <div className="flex items-center gap-1.5 bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-semibold"><FiClock /> Pending</div>;
      case "Confirmed":
        return <div className="flex items-center gap-1.5 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold"><FiCheckCircle /> Confirmed</div>;
      case "Cancelled":
        return <div className="flex items-center gap-1.5 bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-semibold"><FiXCircle /> Cancelled</div>;
      default: return null;
    }
  };

  // ✅ Counter name mapping
  const getCounterName = (counterId) => {
    const names = {
      'counter-1': 'Counter 1',
      'counter-2': 'Counter 2',
      'counter-3': 'Counter 3'
    };
    return names[counterId] || counterId;
  };

  const ordersForDate = orders.filter((o) => isSameISTDate(o.createdAt, filterDate));
  const cancelledOrdersForDate = ordersForDate.filter((o) => o.status === "Cancelled").length;
  const pendingOrdersForDate = ordersForDate.filter((o) => o.status === "Pending").length;

  const displayDate = (() => {
    const [year, month, day] = filterDate.split('-');
    return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  })();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[70vh]">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-indigo-200 rounded-full"></div>
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin absolute top-0"></div>
        </div>
      </div>
    );
  }

  const uniqueCounters = getUniqueCounters();

  return (
    <div className="space-y-6">
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
              <FiTrash2 className="text-sm" /> Delete Pending ({pendingOrdersForDate})
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
              <FiTrash className="text-sm" /> Delete Cancelled ({cancelledOrdersForDate})
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
              <FiTrash className="text-sm" /> Delete All ({ordersForDate.length})
            </button>
          </div>

          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-2xl shadow-sm">
            <button onClick={goPrevDay} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition">
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
            <button onClick={goNextDay} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition">
              <FiChevronRight />
            </button>
          </div>
        </div>
      </div>

      {/* DATE DISPLAY */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FiCalendar className="text-indigo-500" />
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Showing orders for:
          </span>
          <span className="text-sm font-semibold text-gray-800 dark:text-white">
            {displayDate}
          </span>
        </div>
        <div className="text-xs text-gray-400">{ordersForDate.length} orders found</div>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-5">
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer">
          <div className="flex justify-between items-start">
            <div><p className="text-indigo-100 text-sm font-medium">Total Orders</p><p className="text-3xl font-bold mt-1">{stats.total}</p></div>
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center"><FiShoppingBag className="text-2xl text-white" /></div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer">
          <div className="flex justify-between items-start">
            <div><p className="text-amber-100 text-sm font-medium">Pending Orders</p><p className="text-3xl font-bold mt-1">{stats.pending}</p></div>
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center"><FiClock className="text-2xl text-white" /></div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer">
          <div className="flex justify-between items-start">
            <div><p className="text-emerald-100 text-sm font-medium">Confirmed Orders</p><p className="text-3xl font-bold mt-1">{stats.confirmed}</p></div>
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center"><FiCheckCircle className="text-2xl text-white" /></div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-rose-500 to-rose-600 rounded-xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer">
          <div className="flex justify-between items-start">
            <div><p className="text-rose-100 text-sm font-medium">Cancelled Orders</p><p className="text-3xl font-bold mt-1">{stats.cancelled}</p></div>
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center"><FiXCircle className="text-2xl text-white" /></div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer">
          <div className="flex justify-between items-start">
            <div><p className="text-purple-100 text-sm font-medium">Revenue</p><p className="text-3xl font-bold mt-1">₹{stats.revenue.toLocaleString()}</p></div>
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center"><FiTrendingUp className="text-2xl text-white" /></div>
          </div>
        </div>
      </div>

      {/* STATUS FILTERS */}
      <div className="flex flex-wrap gap-3">
        {[["all", "All"], ["pending", "Pending"], ["confirmed", "Confirmed"], ["cancelled", "Cancelled"]].map(([value, label]) => (
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
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Counter:</span>
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
          {uniqueCounters.map((counter) => (
            <button
              key={counter}
              onClick={() => setFilterCounter(counter)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1 ${
                filterCounter === counter
                  ? "bg-indigo-600 text-white shadow-md"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              <FiMonitor className="text-xs" />
              {getCounterName(counter)}
            </button>
          ))}
        </div>
      </div>

      {/* ORDERS LIST */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-16 text-center">
          <FiPackage className="mx-auto text-6xl text-slate-300 mb-4" />
          <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200">No Orders Found</h3>
          <p className="text-slate-500 mt-2">No orders available for selected date & status.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredOrders.map((order) => {
            const completionTime = getCompletionTime(order);
            const isExpanded = expandedOrderId === order._id;
            const counterName = getCounterName(order.counterId);

            return (
              <div
                key={order._id}
                className={`bg-white dark:bg-slate-800 rounded-3xl shadow-sm border overflow-hidden ${
                  order.status === "Pending" ? "border-yellow-300" : order.status === "Confirmed" ? "border-green-300" : "border-red-300"
                }`}
              >
                {/* TOP BAR - Entire clickable for expand/collapse */}
                <div
                  onClick={() => toggleExpand(order._id)}
                  className="bg-slate-50 dark:bg-slate-900 px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="font-bold text-lg">Order #{order._id.slice(-8)}</h2>
                      {getStatusBadge(order.status)}
                      {/* Completion Time */}
                      {completionTime && (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                          <FiTime className="text-xs" />
                          {completionTime}
                        </div>
                      )}
                      {/* ✅ Counter Badge */}
                      {order.counterId && (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold">
                          <FiMonitor className="text-xs" />
                          {counterName}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-500">
                      <span>{new Date(order.createdAt).toLocaleString()}</span>
                      {order.status === "Confirmed" && order.confirmedBy && (
                        <span className="inline-flex items-center gap-1"><FiUserCheck className="text-green-600" />Confirmed by: <span className="font-semibold text-green-700 dark:text-green-300">{order.confirmedBy.name}</span></span>
                      )}
                    </div>
                  </div>
                  
                  {/* Price + Expand Icon */}
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-slate-500">Total Amount</p>
                      <h2 className="text-3xl font-bold text-indigo-600">₹{order.totalAmount}</h2>
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
                        {/* ITEMS DETAILS */}
                        <div className="space-y-3">
                          <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Order Items</h4>
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 rounded-2xl px-4 py-3">
                              <div>
                                <p className="font-semibold">{item.productId?.name || "Deleted Product"}</p>
                                <p className="text-sm text-slate-500">Qty: {item.quantity}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-lg">₹{item.quantity * item.price}</p>
                                <p className="text-xs text-slate-500">₹{item.price} each</p>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* ACTION BUTTONS */}
                        <div className="flex flex-wrap gap-3 mt-6">
                          {order.status === "Pending" && (
                            <>
                              <button onClick={() => confirmOrder(order._id)} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-2xl font-semibold transition">
                                <FiCheck /> Confirm Order
                              </button>
                              <button onClick={() => cancelOrder(order._id)} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-2xl font-semibold transition">
                                <FiX /> Cancel Order
                              </button>
                            </>
                          )}

                          {(order.status === "Confirmed" || order.status === "Cancelled") && (
                            <button onClick={() => revertOrder(order._id)} disabled={revertingId === order._id} className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-5 py-3 rounded-2xl font-semibold transition disabled:opacity-50">
                              <FiRotateCcw /> Revert to Pending
                            </button>
                          )}

                          {/* Reprint Button for Confirmed Orders */}
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

                          {(order.status === "Cancelled" || order.status === "Pending") && (
                            <button onClick={() => deleteOrder(order._id, order.status)} disabled={deletingId === order._id} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-2xl font-semibold transition ml-auto">
                              {deletingId === order._id ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <FiTrash2 className="text-lg" />}
                              Delete Order
                            </button>
                          )}
                        </div>

                        {order.status === "Confirmed" && (
                          <div className="mt-6 flex items-center gap-2 text-green-600 font-semibold">
                            <FiCheckCircle /> Order successfully confirmed{order.confirmedBy && ` by ${order.confirmedBy.name}`}
                            {completionTime && <span className="ml-2 text-sm text-blue-600">Completed in {completionTime}</span>}
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
  );
}