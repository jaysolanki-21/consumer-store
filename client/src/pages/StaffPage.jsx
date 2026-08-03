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
  selectAllOrders,
} from '../redux/selectors/orderSelectors';

import api from '../services/api';
import { useSocket } from '../hooks/useSocket';
import socket from "../services/socket";

import {
  FiCheckCircle,
  FiSearch,
  FiClock,
  FiTrendingUp,
  FiPackage,
  FiShoppingBag,
  FiHash,
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiActivity,
  FiVolume2,
  FiVolumeX,
  FiMonitor,
} from 'react-icons/fi';

// ✅ Notification sound URL
const NOTIFICATION_SOUND_URL = '/sounds/notification-bell.mp3';

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

function formatTime(date) {
  const d = new Date(date);
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
}

function normalizeOrder(order) {
  return {
    ...order,
    formattedTime: formatTime(order.createdAt),
    istDate: getISTDateFromUTC(order.createdAt),
  };
}

function getOrderISTDate(order) {
  if (order.istDate) return order.istDate;
  return getISTDateFromUTC(order.createdAt);
}

// ✅ Get counter name
const getCounterName = (counterId) => {
  const names = {
    'counter-1': 'Counter 1',
    'counter-2': 'Counter 2',
    'counter-3': 'Counter 3'
  };
  return names[counterId] || counterId || 'N/A';
};

// ✅ Order Card Component with Counter Display
const OrderCard = React.memo(({ order, onConfirm }) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const isNewOrder = useRef(Date.now() - new Date(order.createdAt).getTime() < 5000);

  const handleConfirm = useCallback(async () => {
    if (isConfirming) return;
    setIsConfirming(true);
    try {
      await onConfirm(order._id);
    } finally {
      setIsConfirming(false);
    }
  }, [onConfirm, order._id, isConfirming]);

  const counterName = getCounterName(order.counterId);

  return (
    <motion.div
      initial={isNewOrder.current ? { opacity: 0, y: -20 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden transition-all duration-150">
        {/* HEADER */}
        <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="px-3 py-1 rounded-xl bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono text-xs font-semibold flex items-center gap-1">
              <FiHash className="text-sm" />
              #{order._id.slice(-6)}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 font-medium">
              <FiClock className="text-sm" />
              {order.formattedTime}
            </div>
            {/* ✅ Counter Badge */}
            {order.counterId && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
                <FiMonitor className="text-xs" />
                {counterName}
              </div>
            )}
          </div>
          <div>
            {order.status === 'Pending' ? (
              <span className="px-4 py-2 rounded-full bg-amber-100 text-amber-700 text-sm font-semibold">Pending</span>
            ) : (
              <span className="px-4 py-2 rounded-full bg-emerald-100 text-emerald-700 text-sm font-semibold">Completed</span>
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
                  <tr key={idx} className="border-b border-gray-50 dark:border-slate-800/50">
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
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Bill Amount</p>
              <h2 className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">₹{order.totalAmount}</h2>
            </div>
            
            {/* ✅ Only Confirm button for Pending orders */}
            {order.status === 'Pending' && (
              <button
                onClick={handleConfirm}
                disabled={isConfirming}
                className="h-12 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-90 text-white font-semibold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 transition text-sm"
              >
                <FiCheckCircle className="text-base" />
                {isConfirming ? 'Confirming...' : 'Confirm'}
              </button>
            )}
          </div>
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

const StatCard = ({ title, value, icon: Icon, colorGradient }) => (
  <div className={`${colorGradient} rounded-xl p-4 text-white shadow-lg`}>
    <div className="flex justify-between items-start">
      <div>
        <p className="text-xs opacity-90">{title}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
      </div>
      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
        <Icon className="text-xl" />
      </div>
    </div>
  </div>
);

export default function StaffPage() {
  const dispatch = useDispatch();
  useSocket();

  const loading = useSelector(selectLoadingState);
  const allOrders = useSelector(selectAllOrders);
  
  const [filter, setFilter] = useState('');
  const [activeTab, setActiveTab] = useState('pending');
  const [filterDate, setFilterDate] = useState(getTodayLocal);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [livePulse, setLivePulse] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // ✅ SOUND OFF BY DEFAULT
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [audioElement, setAudioElement] = useState(null);

  // ✅ Get unique counters from orders
  const uniqueCounters = useMemo(() => {
    const counters = new Set();
    allOrders.forEach(order => {
      if (order.counterId) {
        counters.add(order.counterId);
      }
    });
    return Array.from(counters);
  }, [allOrders]);

  // ✅ Counter filter state
  const [filterCounter, setFilterCounter] = useState('all');

  // ✅ Initialize audio element
  useEffect(() => {
    const audio = new Audio(NOTIFICATION_SOUND_URL);
    audio.preload = 'auto';
    audio.load();
    setAudioElement(audio);
    
    const enableAudio = () => {
      if (audio) {
        audio.volume = 0;
        audio.play().then(() => {
          audio.pause();
          audio.volume = 0.7;
          audio.currentTime = 0;
        }).catch(() => {});
      }
      document.removeEventListener('click', enableAudio);
      document.removeEventListener('touchstart', enableAudio);
    };
    document.addEventListener('click', enableAudio);
    document.addEventListener('touchstart', enableAudio);
    
    return () => {
      document.removeEventListener('click', enableAudio);
      document.removeEventListener('touchstart', enableAudio);
    };
  }, []);

  // ✅ Play notification sound
  const playNotificationSound = useCallback(() => {
    if (!soundEnabled) return;
    if (audioElement) {
      audioElement.currentTime = 0;
      audioElement.play().catch(() => {});
    }
  }, [audioElement, soundEnabled]);

  // ✅ Toggle sound
  const toggleSound = useCallback(() => {
    const newState = !soundEnabled;
    setSoundEnabled(newState);
    toast.success(newState ? '🔔 Sound enabled' : '🔕 Sound disabled');
    if (newState && audioElement) {
      audioElement.currentTime = 0;
      audioElement.play().catch(() => {});
    }
  }, [soundEnabled, audioElement]);

  // ✅ DATE-WISE FILTERING
  const dateFilteredOrders = useMemo(() => {
    if (!filterDate) return allOrders;
    return allOrders.filter(order => {
      const orderISTDate = getOrderISTDate(order);
      return orderISTDate === filterDate;
    });
  }, [allOrders, filterDate]);

  // ✅ COUNTER FILTER
  const counterFilteredOrders = useMemo(() => {
    if (filterCounter === 'all') return dateFilteredOrders;
    return dateFilteredOrders.filter(order => order.counterId === filterCounter);
  }, [dateFilteredOrders, filterCounter]);

  // ✅ SEARCH FILTER - Order ID
  const searchFilteredOrders = useMemo(() => {
    if (!filter.trim()) return counterFilteredOrders;
    const term = filter.toLowerCase().trim();
    return counterFilteredOrders.filter(order => 
      order._id.toLowerCase().includes(term) ||
      order._id.slice(-6).toLowerCase().includes(term)
    );
  }, [counterFilteredOrders, filter]);

  const pendingOrders = useMemo(
    () => searchFilteredOrders.filter((o) => o.status === 'Pending'),
    [searchFilteredOrders]
  );

  const confirmedOrders = useMemo(
    () => searchFilteredOrders.filter((o) => o.status === 'Confirmed'),
    [searchFilteredOrders]
  );

  const currentOrders = useMemo(
    () => (activeTab === 'pending' ? pendingOrders : confirmedOrders),
    [activeTab, pendingOrders, confirmedOrders]
  );

  const pendingCount = pendingOrders.length;
  const confirmedCount = confirmedOrders.length;
  const totalRevenue = useMemo(() => {
    return confirmedOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
  }, [confirmedOrders]);
  const activeOrdersCount = pendingCount + confirmedCount;

  // ✅ FETCH ORDERS - INITIAL LOAD ONLY
  const fetchOrders = useCallback(async () => {
    try {
      dispatch(setLoading(true));
      const { data } = await api.get('/orders');
      const normalized = data.map(normalizeOrder);
      dispatch(setOrders(normalized));
      setIsInitialLoad(false);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      toast.error('Failed to connect to server');
      setIsInitialLoad(false);
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch]);

  // ✅ SILENT REFRESH - NO SPINNER
  const refreshOrdersSilently = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const { data } = await api.get('/orders');
      const normalized = data.map(normalizeOrder);
      dispatch(setOrders(normalized));
    } catch (error) {
      console.error('Silent refresh failed:', error);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  }, [dispatch]);

  // ✅ Live update handler with sound - NO SPINNER
  const handleLiveUpdate = useCallback(() => {
    refreshOrdersSilently();  // ✅ Silent refresh - no spinner
    setLivePulse(true);
    setTimeout(() => setLivePulse(false), 1500);
  }, [refreshOrdersSilently]);

  // ✅ SOCKET LISTENERS - No duplicate toasts
  useEffect(() => {
    fetchOrders();

    // ✅ Only for new order - show toast
    const handleNewOrder = () => {
      console.log('🔔 New order received!');
      if (soundEnabled) playNotificationSound();
      handleLiveUpdate();
      toast.success('🛒 New Order Received!', {
        duration: 5000,
        icon: '🛒',
        style: { background: '#10b981', color: '#fff', fontWeight: 'bold' },
      });
    };

    // ✅ Silent updates - No toast for confirmed/cancelled/reverted
    const handleOrderConfirmed = () => {
      console.log('✅ Order confirmed (socket)');
      handleLiveUpdate();
    };

    const handleOrderCancelled = () => {
      console.log('❌ Order cancelled');
      handleLiveUpdate();
    };

    const handleOrderReverted = () => {
      console.log('🔄 Order reverted');
      handleLiveUpdate();
    };

    const handleStockUpdated = () => {
      console.log('📦 Stock updated');
      handleLiveUpdate();
    };

    socket.on("newOrder", handleNewOrder);
    socket.on("orderConfirmed", handleOrderConfirmed);
    socket.on("orderCancelled", handleOrderCancelled);
    socket.on("orderReverted", handleOrderReverted);
    socket.on("stockUpdated", handleStockUpdated);

    return () => {
      socket.off("newOrder", handleNewOrder);
      socket.off("orderConfirmed", handleOrderConfirmed);
      socket.off("orderCancelled", handleOrderCancelled);
      socket.off("orderReverted", handleOrderReverted);
      socket.off("stockUpdated", handleStockUpdated);
    };
  }, [fetchOrders, handleLiveUpdate, playNotificationSound, soundEnabled]);

  // ✅ CONFIRM ORDER - Only toast from here
  const confirmOrder = useCallback(async (orderId) => {
    try {
      // Optimistic update - update UI immediately
      dispatch(updateOrder({ id: orderId, changes: { status: 'Confirmed' } }));

      // Call API to confirm
      await api.put(`/orders/${orderId}/confirm`);

      // ✅ ONLY ONE TOAST - from here
      toast.success(`Order confirmed! ✅`, { duration: 2000 });

    } catch (error) {
      console.error('Failed to confirm order:', error);
      // Rollback
      const order = allOrders.find(o => o._id === orderId);
      if (order) {
        dispatch(updateOrder({ id: orderId, changes: { status: 'Pending' } }));
      }
      toast.error('Failed to confirm order');
    }
  }, [dispatch, allOrders]);

  // ✅ DATE NAVIGATION
  const addDays = useCallback((dateStr, days) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + days);
    const newYear = date.getFullYear();
    const newMonth = String(date.getMonth() + 1).padStart(2, '0');
    const newDay = String(date.getDate()).padStart(2, '0');
    return `${newYear}-${newMonth}-${newDay}`;
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

  // ✅ Get counter name
  const getCounterName = (counterId) => {
    const names = {
      'counter-1': 'Counter 1',
      'counter-2': 'Counter 2',
      'counter-3': 'Counter 3'
    };
    return names[counterId] || counterId;
  };

  // Show loading only on first load
  if (isInitialLoad) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0B1120] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Loading dashboard...</p>
          <p className="text-xs text-gray-400 mt-2">Waking up server (may take a few seconds)</p>
        </div>
      </div>
    );
  }

  const displayDate = (() => {
    const [year, month, day] = filterDate.split('-');
    return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  })();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0B1120] p-4 sm:p-6">
      {/* ✅ Refresh Indicator */}
      <AnimatePresence>
        {isRefreshing && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-6 z-50 bg-indigo-600 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium"
          >
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Updating...
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 bg-clip-text text-transparent">
              Staff Dashboard
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
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">
            Live order monitoring
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition"
            title={soundEnabled ? "Disable sound" : "Enable sound"}
          >
            {soundEnabled ? (
              <FiVolume2 className="text-emerald-500" />
            ) : (
              <FiVolumeX className="text-red-500" />
            )}
            <span className="text-sm font-medium hidden sm:inline">
              {soundEnabled ? "Sound ON" : "Sound OFF"}
            </span>
          </button>

          {/* Date Filter */}
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

          {/* ✅ Counter Filter */}
          {uniqueCounters.length > 0 && (
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 px-3 py-2 rounded-xl shadow-sm">
              <FiMonitor className="text-indigo-500" />
              <select
                value={filterCounter}
                onChange={(e) => setFilterCounter(e.target.value)}
                className="bg-transparent outline-none text-sm font-medium border-none p-0 focus:ring-0 dark:text-white"
              >
                <option value="all">All Counters</option>
                {uniqueCounters.map((counter) => (
                  <option key={counter} value={counter}>
                    {getCounterName(counter)}
                  </option>
                ))}
              </select>
            </div>
          )}
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
            {displayDate}
          </span>
        </div>
      </div>

      {/* STATS CARDS */}
      {/* <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Pending Orders" value={pendingCount} icon={FiClock} colorGradient="bg-gradient-to-br from-amber-500 to-orange-600" />
        <StatCard title="Completed Orders" value={confirmedCount} icon={FiCheckCircle} colorGradient="bg-gradient-to-br from-emerald-500 to-teal-600" />
        <StatCard title="Revenue (Today)" value={`₹${totalRevenue.toLocaleString()}`} icon={FiTrendingUp} colorGradient="bg-gradient-to-br from-indigo-500 to-purple-600" />
        <StatCard title="Active Orders" value={activeOrdersCount} icon={FiShoppingBag} colorGradient="bg-gradient-to-br from-rose-500 to-pink-600" />
      </div> */}

      {/* SEARCH + TABS */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-sm p-4 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="relative flex-1">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
            <input
              type="text"
              placeholder="Search by Order ID..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full h-12 pl-12 pr-4 rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium dark:text-white"
            />
          </div>

          <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-2xl">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === 'pending' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-400' : 'text-gray-500'}`}
            >
              Pending ({pendingCount})
            </button>
            <button
              onClick={() => setActiveTab('confirmed')}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === 'confirmed' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-400' : 'text-gray-500'}`}
            >
              Completed ({confirmedCount})
            </button>
          </div>
        </div>
      </div>

      {/* ORDER LIST */}
      <div className="space-y-5">
        {currentOrders.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-dashed border-gray-300 dark:border-slate-700 rounded-3xl py-20 text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-4xl text-gray-400 mb-5">
              <FiPackage />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-200">No Orders Found</h2>
            <p className="text-gray-500 dark:text-gray-400 font-medium">No {activeTab} orders found for this date</p>
          </div>
        ) : (
          currentOrders.map((order) => (
            <OrderCard
              key={order._id}
              order={order}
              onConfirm={confirmOrder}
            />
          ))
        )}
      </div>
    </div>
  );
}