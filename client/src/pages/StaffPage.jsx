import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from 'react';

import { useDispatch, useSelector, shallowEqual } from 'react-redux';

import toast from 'react-hot-toast';

import {
  setOrders,
  updateOrder,
  addNewOrder,
} from '../redux/slices/orderSlice';

import api from '../services/api';
import { useSocket } from '../hooks/useSocket';

import {
  FiCheckCircle,
  FiSearch,
  FiClock,
  FiTrendingUp,
  FiPackage,
  FiShoppingBag,
  FiHash,
  FiUser,
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
} from 'react-icons/fi';

/* =========================================================
   HELPERS
========================================================= */

function getTodayLocal() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTime(date) {
  return new Date(date).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// FIX 1: normalizeOrder is ONLY called once per order (on fetch / on socket new-order).
// We never call it again on existing orders, so React.memo gets stable object references.
function normalizeOrder(order) {
  return {
    ...order,
    formattedTime: formatTime(order.createdAt),
  };
}

/* =========================================================
   ORDER CARD
   FIX 2: Wrap onConfirm in useCallback at the parent level (stable ref),
   and use a local confirming ref so the card never re-renders just because
   the parent's `confirmOrder` identity changed.
========================================================= */

const OrderCard = React.memo(
  ({ order, onConfirm }) => {
    // Use a ref for loading so button state doesn't cause the whole card to re-render
    const [confirming, setConfirming] = useState(false);

    const handleConfirm = useCallback(async () => {
      if (confirming) return;
      setConfirming(true);
      try {
        await onConfirm(order._id);
      } finally {
        setConfirming(false);
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [confirming, onConfirm, order._id]);

    return (
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
        {/* HEADER */}
        <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="px-3 py-1 rounded-xl bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono text-xs font-semibold flex items-center gap-1">
              <FiHash className="text-sm" />
              #{order._id.slice(-6)}
            </div>

            <div className="px-3 py-1 rounded-xl bg-gray-100 dark:bg-slate-800 text-sm font-medium flex items-center gap-2 dark:text-gray-300">
              <FiUser className="text-sm" />
              {order.rollNumber}
            </div>

            <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 font-medium">
              <FiClock className="text-sm" />
              {order.formattedTime}
            </div>
          </div>

          <div>
            {order.status === 'Pending' ? (
              <span className="px-4 py-2 rounded-full bg-amber-100 text-amber-700 text-sm font-semibold">
                Pending
              </span>
            ) : (
              <span className="px-4 py-2 rounded-full bg-emerald-100 text-emerald-700 text-sm font-semibold">
                Completed
              </span>
            )}
          </div>
        </div>

        {/* BODY */}
        <div className="p-5">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-400 font-semibold border-b border-gray-100 dark:border-slate-800">
                  <th className="pb-3">Product</th>
                  <th className="pb-3 text-center">Qty</th>
                  <th className="pb-3 text-right">Price</th>
                  <th className="pb-3 text-right">Total</th>
                </tr>
              </thead>

              <tbody>
                {order.items.map((item, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-gray-50 dark:border-slate-800/50"
                  >
                    <td className="py-4 font-medium text-gray-800 dark:text-gray-200">
                      {item.productId?.name || 'Unknown'}
                    </td>

                    <td className="py-4 text-center">
                      <span className="px-3 py-1 rounded-lg bg-gray-100 dark:bg-slate-800 text-sm font-mono font-semibold dark:text-gray-200">
                        {item.quantity}
                      </span>
                    </td>

                    <td className="py-4 text-right text-gray-500 dark:text-gray-400 font-medium">
                      ₹{item.price}
                    </td>

                    <td className="py-4 text-right font-semibold text-gray-800 dark:text-gray-200">
                      ₹{item.quantity * item.price}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* FOOTER */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mt-6">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Total Bill Amount
              </p>

              <h2 className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                ₹{order.totalAmount}
              </h2>
            </div>

            {order.status === 'Pending' && (
              <button
                disabled={confirming}
                onClick={handleConfirm}
                className="h-12 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-90 text-white font-semibold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 transition text-sm"
              >
                <FiCheckCircle />
                {confirming ? 'Confirming...' : 'Confirm Delivery'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  },
  // FIX 3: Custom comparator — only re-render if the fields that actually
  // affect the UI have changed. This prevents the whole card from re-rendering
  // when unrelated orders in the Redux store change.
  (prev, next) =>
    prev.order._id === next.order._id &&
    prev.order.status === next.order.status &&
    prev.order.totalAmount === next.order.totalAmount &&
    prev.order.rollNumber === next.order.rollNumber &&
    prev.onConfirm === next.onConfirm
);

OrderCard.displayName = 'OrderCard';

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function StaffPage() {
  const dispatch = useDispatch();

  // FIX 4: Select order IDs separately from order data.
  // The list (IDs array) only changes when orders are added/removed.
  // Individual order objects are selected one-by-one inside OrderCard
  // via their stable _id — but since we pass the full order here,
  // the custom memo comparator above handles surgical updates instead.
  const orders = useSelector((state) => state.orders.orders, shallowEqual);

  const socket = useSocket();

  const ordersRef = useRef([]);
  const processedEventsRef = useRef(new Set());

  const [filter, setFilter] = useState('');
  const [activeTab, setActiveTab] = useState('pending');
  const [filterDate, setFilterDate] = useState(getTodayLocal());

  /* =========================================================
     KEEP REF UPDATED
  ========================================================= */

  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  /* =========================================================
     FETCH ORDERS
     FIX 5: fetchOrders should NOT be in the dep array of the
     filterDate effect — that causes double-fetches. Instead,
     pass filterDate as an argument so the function itself
     stays stable (no re-creation on filterDate change).
  ========================================================= */

  const fetchOrders = useCallback(
    async (date) => {
      try {
        // Pass date as a query param so the server can filter,
        // or keep fetching all and filter client-side (current behavior).
        const { data } = await api.get('/orders');
        const normalized = data.map(normalizeOrder);
        dispatch(setOrders(normalized));
      } catch (error) {
        console.error(error);
        toast.error('Failed to load orders');
      }
    },
    [dispatch]
  );

  // FIX 6: Only filterDate is the real dependency here.
  // fetchOrders is stable (dispatch never changes), so this
  // effect fires exactly once per date change — no double fetch.
  useEffect(() => {
    fetchOrders(filterDate);
  }, [filterDate]); // eslint-disable-line react-hooks/exhaustive-deps

  /* =========================================================
     SOCKETS
  ========================================================= */

  useEffect(() => {
    if (!socket) return;

    const isProcessed = (key) => {
      if (processedEventsRef.current.has(key)) return true;
      processedEventsRef.current.add(key);
      setTimeout(() => processedEventsRef.current.delete(key), 2000);
      return false;
    };

    /* NEW ORDER */
    const handleNewOrder = (incomingOrder) => {
      const key = `new-${incomingOrder._id}`;
      if (isProcessed(key)) return;

      const exists = ordersRef.current.some(
        (o) => o._id === incomingOrder._id
      );
      if (exists) return;

      const normalized = normalizeOrder(incomingOrder);
      dispatch(addNewOrder(normalized));

      toast.success('🛒 New Order Received!', { duration: 2500 });
    };

    /* ORDER CONFIRMED
       FIX 7: The socket confirm handler checks if the optimistic
       update already set status to 'Confirmed'. The processedEventsRef
       dedup window (2 s) catches the race where the socket fires
       within 2 s of the button click.  For the case where the socket
       arrives AFTER the 2 s window (slow network), the
       `existing.status === 'Confirmed'` guard below prevents a
       redundant dispatch that would cause a flicker.
    */
    const handleOrderConfirmed = (updatedOrder) => {
      const key = `confirm-${updatedOrder._id}`;
      if (isProcessed(key)) return;

      const existing = ordersRef.current.find(
        (o) => o._id === updatedOrder._id
      );
      if (!existing) return;
      if (existing.status === 'Confirmed') return; // optimistic already applied

      dispatch(
        updateOrder({ id: updatedOrder._id, changes: { status: 'Confirmed' } })
      );
    };

    /* ORDER CANCELLED */
    const handleOrderCancelled = (updatedOrder) => {
      const key = `cancel-${updatedOrder._id}`;
      if (isProcessed(key)) return;

      const existing = ordersRef.current.find(
        (o) => o._id === updatedOrder._id
      );
      if (!existing) return;
      if (existing.status === 'Cancelled') return;

      dispatch(
        updateOrder({ id: updatedOrder._id, changes: { status: 'Cancelled' } })
      );
    };

    socket.on('newOrder', handleNewOrder);
    socket.on('orderConfirmed', handleOrderConfirmed);
    socket.on('orderCancelled', handleOrderCancelled);

    return () => {
      socket.off('newOrder', handleNewOrder);
      socket.off('orderConfirmed', handleOrderConfirmed);
      socket.off('orderCancelled', handleOrderCancelled);
    };
  }, [socket, dispatch]);

  /* =========================================================
     CONFIRM ORDER
     FIX 8: Mark the event as processed BEFORE the optimistic
     dispatch so the socket echo that arrives within 2 s is
     swallowed by isProcessed() and never causes a second render.
  ========================================================= */

  const confirmOrder = useCallback(
    async (orderId) => {
      const existing = ordersRef.current.find((o) => o._id === orderId);
      if (!existing) return;
      if (existing.status === 'Confirmed') return;

      // Pre-register the confirm event so the socket echo is ignored
      const key = `confirm-${orderId}`;
      processedEventsRef.current.add(key);
      setTimeout(() => processedEventsRef.current.delete(key), 5000); // 5 s window for slow servers

      // Optimistic update
      dispatch(updateOrder({ id: orderId, changes: { status: 'Confirmed' } }));

      try {
        await api.put(`/orders/${orderId}/confirm`);
      } catch (error) {
        console.error(error);
        // Rollback
        processedEventsRef.current.delete(key); // allow socket to re-apply if it arrives
        dispatch(updateOrder({ id: orderId, changes: { status: 'Pending' } }));
        toast.error('Failed to confirm order');
      }
    },
    [dispatch]
  );

  /* =========================================================
     DATE NAVIGATION
  ========================================================= */

  const addDays = useCallback((dateStr, days) => {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  }, []);

  const goPrevDay = useCallback(() => {
    setFilterDate((prev) => addDays(prev, -1));
  }, [addDays]);

  const goNextDay = useCallback(() => {
    const today = getTodayLocal();
    setFilterDate((prev) => {
      const next = addDays(prev, 1);
      if (next > today) {
        toast.error('Cannot go beyond today');
        return prev;
      }
      return next;
    });
  }, [addDays]);

  /* =========================================================
     FILTERED ORDERS
  ========================================================= */

  const dateFilteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const d = new Date(order.createdAt);
      const orderDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return orderDate === filterDate;
    });
  }, [orders, filterDate]);

  const filteredOrders = useMemo(() => {
    const q = filter.toLowerCase();
    return dateFilteredOrders.filter(
      (o) =>
        o.rollNumber.toLowerCase().includes(q) ||
        o._id.toLowerCase().includes(q)
    );
  }, [dateFilteredOrders, filter]);

  const pendingOrders = useMemo(
    () => filteredOrders.filter((o) => o.status === 'Pending'),
    [filteredOrders]
  );

  const confirmedOrders = useMemo(
    () => filteredOrders.filter((o) => o.status === 'Confirmed'),
    [filteredOrders]
  );

  const totalRevenue = useMemo(
    () => confirmedOrders.reduce((acc, o) => acc + o.totalAmount, 0),
    [confirmedOrders]
  );

  const activeOrdersCount = useMemo(
    () => pendingOrders.length + confirmedOrders.length,
    [pendingOrders, confirmedOrders]
  );

  const currentOrders = useMemo(
    () => (activeTab === 'pending' ? pendingOrders : confirmedOrders),
    [activeTab, pendingOrders, confirmedOrders]
  );

  /* =========================================================
     UI
  ========================================================= */

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0B1120] p-4 sm:p-6">
      {/* HEADER */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 bg-clip-text text-transparent">
            Staff Dashboard
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">
            Live order monitoring & fulfillment management
          </p>
        </div>

        {/* DATE FILTER */}
        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-4 py-2 rounded-xl shadow-sm">
          <button
            onClick={goPrevDay}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition"
          >
            <FiChevronLeft className="text-indigo-500" />
          </button>

          <FiCalendar className="text-indigo-500" />

          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            max={getTodayLocal()}
            className="bg-transparent outline-none text-sm font-medium border-none p-0 focus:ring-0 dark:text-white"
          />

          <button
            onClick={goNextDay}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition"
          >
            <FiChevronRight className="text-indigo-500" />
          </button>
        </div>
      </div>

      {/* DATE INFO */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FiCalendar className="text-indigo-500" />
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Showing orders for:
          </span>
          <span className="text-sm font-semibold text-gray-800 dark:text-white">
            {new Date(filterDate + 'T00:00:00').toLocaleDateString('en-IN', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
        </div>
        <div className="text-xs text-gray-400">
          {dateFilteredOrders.length} orders found
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex justify-between">
            <div>
              <p className="text-xs">Pending Orders</p>
              <p className="text-2xl font-bold mt-1">{pendingOrders.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <FiClock className="text-xl" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex justify-between">
            <div>
              <p className="text-xs">Completed Orders</p>
              <p className="text-2xl font-bold mt-1">{confirmedOrders.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <FiCheckCircle className="text-xl" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex justify-between">
            <div>
              <p className="text-xs">Revenue</p>
              <p className="text-xl font-bold mt-1">₹{totalRevenue.toLocaleString()}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <FiTrendingUp className="text-xl" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex justify-between">
            <div>
              <p className="text-xs">Active Orders</p>
              <p className="text-2xl font-bold mt-1">{activeOrdersCount}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <FiShoppingBag className="text-xl" />
            </div>
          </div>
        </div>
      </div>

      {/* SEARCH + TABS */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-sm p-4 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="relative flex-1">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
            <input
              type="text"
              placeholder="Search by Roll Number or Order ID..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full h-12 pl-12 pr-4 rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium dark:text-white"
            />
          </div>

          <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-2xl">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'pending'
                  ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-500'
              }`}
            >
              Pending ({pendingOrders.length})
            </button>

            <button
              onClick={() => setActiveTab('confirmed')}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'confirmed'
                  ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-500'
              }`}
            >
              Completed ({confirmedOrders.length})
            </button>
          </div>
        </div>
      </div>

      {/* ORDER LIST */}
      <div className="space-y-5">
        {currentOrders.map((order) => (
          <OrderCard
            key={order._id}
            order={order}
            onConfirm={confirmOrder}
          />
        ))}

        {currentOrders.length === 0 && (
          <div className="bg-white dark:bg-slate-900 border border-dashed border-gray-300 dark:border-slate-700 rounded-3xl py-20 text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-4xl text-gray-400 mb-5">
              <FiPackage />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-200">
              No Orders Found
            </h2>
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              No {activeTab} orders found
            </p>
          </div>
        )}
      </div>
    </div>
  );
}