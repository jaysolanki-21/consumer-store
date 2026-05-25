import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { setOrders, updateOrder, addNewOrder } from '../redux/slices/orderSlice';
import api from '../services/api';
import { useSocket } from '../hooks/useSocket';

import {
  FiCheckCircle,
  FiSearch,
  FiClock,
  FiVolume2,
  FiVolumeX,
  FiTrendingUp,
  FiPackage,
  FiShoppingBag,
  FiHash,
  FiUser,
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
} from 'react-icons/fi';

export default function StaffPage() {
  const dispatch = useDispatch();
  const { orders } = useSelector((state) => state.orders);

  const [filter, setFilter] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [confirmingId, setConfirmingId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filterDate, setFilterDate] = useState(() => getTodayLocal());

  const socket = useSocket();
  const ordersRef = useRef(orders);
  
  // Keep ref updated
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  function getTodayLocal() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const addDays = useCallback((dateStr, days) => {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchOrders();
  }, [filterDate]);

  // ✅ STABLE SOCKET LISTENERS - No orders dependency
  useEffect(() => {
    if (!socket) return;

    // Use ref to avoid stale closure
    const handleNewOrder = (newOrder) => {
      console.log('🛒 New order received via socket', newOrder);
      
      // Optimistic UI - directly add to orders using ref
      const currentOrders = ordersRef.current;
      const updatedOrders = [newOrder, ...currentOrders];
      dispatch(setOrders(updatedOrders));
      
      toast.success('🛒 New Order Received!', {
        duration: 5000,
        position: 'top-right',
        icon: '🛒',
        style: {
          background: '#10b981',
          color: '#fff',
          fontWeight: 'bold',
          padding: '12px 20px',
          borderRadius: '12px',
        },
      });
    };

    const handleOrderConfirmed = (confirmedOrder) => {
      console.log('✅ Order confirmed via socket', confirmedOrder);
      
      // Update existing order in state using ref
      const currentOrders = ordersRef.current;
      const updatedOrders = currentOrders.map((order) =>
        order._id === confirmedOrder._id ? confirmedOrder : order
      );
      dispatch(setOrders(updatedOrders));
      
      toast.success(`Order #${confirmedOrder._id.slice(-6)} confirmed!`, {
        duration: 3000,
        icon: '✅',
      });
    };

    const handleOrderCancelled = (cancelledOrder) => {
      console.log('❌ Order cancelled via socket', cancelledOrder);
      
      const currentOrders = ordersRef.current;
      const updatedOrders = currentOrders.map((order) =>
        order._id === cancelledOrder._id ? cancelledOrder : order
      );
      dispatch(setOrders(updatedOrders));
      
      toast.error(`Order #${cancelledOrder._id.slice(-6)} cancelled`);
    };

    socket.on('newOrder', handleNewOrder);
    socket.on('orderConfirmed', handleOrderConfirmed);
    socket.on('orderCancelled', handleOrderCancelled);

    return () => {
      socket.off('newOrder', handleNewOrder);
      socket.off('orderConfirmed', handleOrderConfirmed);
      socket.off('orderCancelled', handleOrderCancelled);
    };
  }, [socket, dispatch]); // ✅ NO orders dependency here!

  const fetchOrders = useCallback(async () => {
    try {
      setRefreshing(true);
      const { data } = await api.get('/orders');
      dispatch(setOrders(data));
    } catch (error) {
      toast.error('Failed to load orders');
    } finally {
      setRefreshing(false);
    }
  }, [dispatch]);

  // ✅ OPTIMISTIC UI UPDATE - Instant confirmation without flicker
  const confirmOrder = useCallback(async (orderId) => {
    setConfirmingId(orderId);

    // Backup old orders for rollback
    const previousOrders = [...ordersRef.current];

    // Optimistic UI update - instantly change status to Confirmed
    const updatedOrders = ordersRef.current.map((order) =>
      order._id === orderId
        ? { ...order, status: 'Confirmed' }
        : order
    );
    dispatch(setOrders(updatedOrders));

    try {
      await api.put(`/orders/${orderId}/confirm`);
      toast.success(`Order #${orderId.slice(-6)} confirmed`, {
        icon: '✅',
        duration: 2000
      });
    } catch (error) {
      // Rollback if API fails
      dispatch(setOrders(previousOrders));
      toast.error('Failed to confirm order');
    } finally {
      setConfirmingId(null);
    }
  }, [dispatch]);

  // ✅ OPTIMISTIC UI UPDATE for cancel
  const cancelOrder = useCallback(async (orderId) => {
    if (!window.confirm('Are you sure you want to cancel this order?')) return;
    
    setCancellingId(orderId);

    // Backup old orders
    const previousOrders = [...ordersRef.current];

    // Optimistic UI update - instantly change status to Cancelled
    const updatedOrders = ordersRef.current.map((order) =>
      order._id === orderId
        ? { ...order, status: 'Cancelled' }
        : order
    );
    dispatch(setOrders(updatedOrders));

    try {
      await api.put(`/orders/${orderId}/cancel`);
      toast.success('Order cancelled successfully');
    } catch (error) {
      // Rollback if API fails
      dispatch(setOrders(previousOrders));
      toast.error('Failed to cancel order');
    } finally {
      setCancellingId(null);
    }
  }, [dispatch]);

  const goPrevDay = useCallback(() => setFilterDate(addDays(filterDate, -1)), [addDays, filterDate]);
  const goNextDay = useCallback(() => {
    const today = getTodayLocal();
    const next = addDays(filterDate, 1);
    if (next <= today) {
      setFilterDate(next);
    } else {
      toast.error('Cannot go beyond today');
    }
  }, [addDays, filterDate]);

  // ✅ MEMOIZED FILTERS - Prevent unnecessary recalculations
  const dateFilteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const orderDateObj = new Date(order.createdAt);
      const year = orderDateObj.getFullYear();
      const month = String(orderDateObj.getMonth() + 1).padStart(2, '0');
      const day = String(orderDateObj.getDate()).padStart(2, '0');
      const orderLocalDate = `${year}-${month}-${day}`;
      return orderLocalDate === filterDate;
    });
  }, [orders, filterDate]);

  const filteredOrders = useMemo(() => {
    return dateFilteredOrders.filter(
      (o) =>
        o.rollNumber.toLowerCase().includes(filter.toLowerCase()) ||
        o._id.toLowerCase().includes(filter.toLowerCase())
    );
  }, [dateFilteredOrders, filter]);

  const pendingOrders = useMemo(() => filteredOrders.filter((o) => o.status === 'Pending'), [filteredOrders]);
  const confirmedOrders = useMemo(() => filteredOrders.filter((o) => o.status === 'Confirmed'), [filteredOrders]);
  const cancelledOrders = useMemo(() => filteredOrders.filter((o) => o.status === 'Cancelled'), [filteredOrders]);

  const totalRevenue = useMemo(() => 
    confirmedOrders.reduce((acc, order) => acc + order.totalAmount, 0),
    [confirmedOrders]
  );

  const activeOrdersCount = useMemo(() => 
    pendingOrders.length + confirmedOrders.length,
    [pendingOrders.length, confirmedOrders.length]
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0B1120] p-4 sm:p-6 font-sans antialiased">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 bg-clip-text text-transparent">
            Staff Dashboard
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">
            Live order monitoring & fulfillment management
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Date Filter */}
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
      </div>

      {/* Date Display */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FiCalendar className="text-indigo-500" />
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Showing orders for:{' '}
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-amber-100 text-xs font-medium">Pending Orders</p>
              <p className="text-2xl font-bold mt-1">{pendingOrders.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <FiClock className="text-xl text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-emerald-100 text-xs font-medium">Completed Orders</p>
              <p className="text-2xl font-bold mt-1">{confirmedOrders.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <FiCheckCircle className="text-xl text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-indigo-100 text-xs font-medium">Revenue (Today)</p>
              <p className="text-xl font-bold mt-1">₹{totalRevenue.toLocaleString()}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <FiTrendingUp className="text-xl text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-rose-100 text-xs font-medium">Active Orders</p>
              <p className="text-2xl font-bold mt-1">{activeOrdersCount}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <FiShoppingBag className="text-xl text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Search + Tabs */}
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

      {/* Orders List */}
      <div className="space-y-5">
        <AnimatePresence mode="wait">
          {(activeTab === 'pending' ? pendingOrders : confirmedOrders).map((order) => (
            <motion.div
              key={order._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden"
            >
              {/* Order Header */}
              <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="px-3 py-1 rounded-xl bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono text-xs font-semibold flex items-center gap-1">
                    <FiHash className="text-sm" /> #{order._id.slice(-6)}
                  </div>
                  <div className="px-3 py-1 rounded-xl bg-gray-100 dark:bg-slate-800 text-sm font-medium flex items-center gap-2 dark:text-gray-300">
                    <FiUser className="text-sm" />
                    {order.rollNumber}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 font-medium">
                    <FiClock className="text-sm" />
                    {new Date(order.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
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

              {/* Order Items */}
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
                          <td className="py-4 text-right text-gray-500 dark:text-gray-400 font-medium">₹{item.price}</td>
                          <td className="py-4 text-right font-semibold text-gray-800 dark:text-gray-200">
                            ₹{item.quantity * item.price}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mt-6">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Bill Amount</p>
                    <h2 className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">₹{order.totalAmount}</h2>
                  </div>

                  {order.status === 'Pending' && (
                    <div className="flex gap-3">
                      <button
                        disabled={confirmingId === order._id}
                        onClick={() => confirmOrder(order._id)}
                        className="h-12 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-90 text-white font-semibold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 transition text-sm"
                      >
                        <FiCheckCircle />
                        {confirmingId === order._id ? 'Confirming...' : 'Confirm Delivery'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Empty State */}
        {(activeTab === 'pending' ? pendingOrders.length === 0 : confirmedOrders.length === 0) && (
          <div className="bg-white dark:bg-slate-900 border border-dashed border-gray-300 dark:border-slate-700 rounded-3xl py-20 text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-4xl text-gray-400 mb-5">
              <FiPackage />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-200">
              No Orders Found
            </h2>
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              No orders found for {new Date(filterDate + 'T00:00:00').toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}