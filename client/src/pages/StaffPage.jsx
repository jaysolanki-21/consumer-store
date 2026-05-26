import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from 'react';

import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

import {
  setOrders,
  updateOrder,
  setLoading,
} from '../redux/slices/orderSlice';

import {
  selectLoadingState,
  selectFilteredOrdersByDate,
  selectFilteredOrdersBySearch,
  selectPendingCount,
  selectConfirmedCount,
  selectTotalRevenue,
} from '../redux/selectors/orderSelectors';

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

function normalizeOrder(order) {
  return {
    ...order,
    formattedTime: formatTime(order.createdAt),
  };
}

// ✅ OPTIMIZED ORDER CARD - Only rerenders when order data changes
const OrderCard = React.memo(({ order, onConfirm }) => {
  const confirmingRef = useRef(false);
  const [, forceUpdate] = useState({});

  const handleConfirm = useCallback(async () => {
    if (confirmingRef.current) return;

    confirmingRef.current = true;
    forceUpdate({});

    try {
      await onConfirm(order._id);
    } finally {
      confirmingRef.current = false;
      forceUpdate({});
    }
  }, [onConfirm, order._id]);

  return (
    <motion.div
      layoutId={`order-${order._id}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden"
    >
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
                  key={item.productId?._id || idx}
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
              disabled={confirmingRef.current}
              onClick={handleConfirm}
              className="h-12 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-90 text-white font-semibold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 transition text-sm"
            >
              <FiCheckCircle />
              {confirmingRef.current ? 'Confirming...' : 'Confirm Delivery'}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.order._id === nextProps.order._id &&
    prevProps.order.status === nextProps.order.status &&
    prevProps.order.totalAmount === nextProps.order.totalAmount
  );
});

OrderCard.displayName = 'OrderCard';

// ✅ LOADING SKELETON
const OrderSkeleton = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-sm p-5 space-y-4"
  >
    <div className="h-6 bg-gray-200 dark:bg-slate-800 rounded-lg w-1/3 animate-pulse" />
    <div className="space-y-2">
      <div className="h-4 bg-gray-200 dark:bg-slate-800 rounded w-full animate-pulse" />
      <div className="h-4 bg-gray-200 dark:bg-slate-800 rounded w-5/6 animate-pulse" />
    </div>
  </motion.div>
);

export default function StaffPage() {
  const dispatch = useDispatch();
  useSocket();

  const loading = useSelector(selectLoadingState);
  const [filter, setFilter] = useState('');
  const [activeTab, setActiveTab] = useState('pending');
  const [filterDate, setFilterDate] = useState(getTodayLocal());

  // ✅ Memoized selectors - no unnecessary rerenders
  const dateFilteredOrders = useSelector(
    selectFilteredOrdersByDate(filterDate)
  );

  const filteredOrders = useSelector((state) =>
    selectFilteredOrdersBySearch(filterDate, filter)(state)
  );

  const pendingCount = useSelector(selectPendingCount);
  const confirmedCount = useSelector(selectConfirmedCount);
  const totalRevenue = useSelector(selectTotalRevenue);

  const pendingOrders = useMemo(
    () => filteredOrders.filter((o) => o.status === 'Pending'),
    [filteredOrders]
  );

  const confirmedOrders = useMemo(
    () => filteredOrders.filter((o) => o.status === 'Confirmed'),
    [filteredOrders]
  );

  const currentOrders = useMemo(
    () => (activeTab === 'pending' ? pendingOrders : confirmedOrders),
    [activeTab, pendingOrders, confirmedOrders]
  );

  const fetchOrders = useCallback(async () => {
    try {
      dispatch(setLoading(true));
      const { data } = await api.get('/orders', {
        params: { date: filterDate }
      });
      const normalized = data.map(normalizeOrder);
      dispatch(setOrders(normalized));
    } catch (error) {
      console.error(error);
      toast.error('Failed to load orders');
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch, filterDate]);

  useEffect(() => {
    fetchOrders();
  }, [filterDate, fetchOrders]);

  const confirmOrder = useCallback(async (orderId) => {
    try {
      dispatch(updateOrder({ id: orderId, changes: { status: 'Confirmed' } }));
      await api.put(`/orders/${orderId}/confirm`);
    } catch (error) {
      console.error(error);
      dispatch(updateOrder({ id: orderId, changes: { status: 'Pending' } }));
      toast.error('Failed to confirm order');
    }
  }, [dispatch]);

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

  const activeOrdersCount = useMemo(
    () => pendingCount + confirmedCount,
    [pendingCount, confirmedCount]
  );

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

        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-4 py-2 rounded-xl shadow-sm">
          <button onClick={goPrevDay} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition">
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
          <button onClick={goNextDay} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition">
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
        <div className="text-xs text-gray-400">{dateFilteredOrders.length} orders found</div>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <motion.div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex justify-between">
            <div>
              <p className="text-xs">Pending Orders</p>
              <motion.p
                key={pendingCount}
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
                className="text-2xl font-bold mt-1"
              >
                {pendingCount}
              </motion.p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <FiClock className="text-xl" />
            </div>
          </div>
        </motion.div>

        <motion.div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex justify-between">
            <div>
              <p className="text-xs">Completed Orders</p>
              <motion.p
                key={confirmedCount}
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
                className="text-2xl font-bold mt-1"
              >
                {confirmedCount}
              </motion.p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <FiCheckCircle className="text-xl" />
            </div>
          </div>
        </motion.div>

        <motion.div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex justify-between">
            <div>
              <p className="text-xs">Revenue</p>
              <motion.p
                key={totalRevenue}
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
                className="text-xl font-bold mt-1"
              >
                ₹{totalRevenue.toLocaleString()}
              </motion.p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <FiTrendingUp className="text-xl" />
            </div>
          </div>
        </motion.div>

        <motion.div className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex justify-between">
            <div>
              <p className="text-xs">Active Orders</p>
              <motion.p
                key={activeOrdersCount}
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
                className="text-2xl font-bold mt-1"
              >
                {activeOrdersCount}
              </motion.p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <FiShoppingBag className="text-xl" />
            </div>
          </div>
        </motion.div>
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
              Pending ({pendingCount})
            </button>
            <button
              onClick={() => setActiveTab('confirmed')}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'confirmed'
                  ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-500'
              }`}
            >
              Completed ({confirmedCount})
            </button>
          </div>
        </div>
      </div>

      {/* ORDER LIST */}
      <div className="space-y-5">
        {loading ? (
          <>
            <OrderSkeleton />
            <OrderSkeleton />
            <OrderSkeleton />
          </>
        ) : (
          <AnimatePresence mode="popLayout">
            {currentOrders.map((order) => (
              <OrderCard
                key={order._id}
                order={order}
                onConfirm={confirmOrder}
              />
            ))}
          </AnimatePresence>
        )}

        {!loading && currentOrders.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white dark:bg-slate-900 border border-dashed border-gray-300 dark:border-slate-700 rounded-3xl py-20 text-center"
          >
            <div className="w-20 h-20 mx-auto rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-4xl text-gray-400 mb-5">
              <FiPackage />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-200">
              No Orders Found
            </h2>
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              No {activeTab} orders found
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}