import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import api from '../services/api';
import socket from '../services/socket';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FiPackage, FiDollarSign, FiShoppingBag, FiUsers, FiCalendar, FiChevronLeft, FiChevronRight, FiTrendingUp, FiTrendingDown } from 'react-icons/fi';
import { FaRupeeSign } from 'react-icons/fa';

export default function AdminPage() {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalProducts: 0, totalOrders: 0, totalRevenue: 0, todayRevenue: 0, pendingOrders: 0 });

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [monthlyIncome, setMonthlyIncome] = useState([]);
  const [dailyIncome, setDailyIncome] = useState([]);
  
  // ✅ Refs to avoid stale closures
  const ordersRef = useRef(orders);
  const productsRef = useRef(products);

  // Keep refs updated
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  // ✅ Optimized fetch function with selective updates
  const fetchData = useCallback(async () => {
    try {
      const [productsRes, ordersRes] = await Promise.all([
        api.get('/products'),
        api.get('/orders')
      ]);
      const productsData = productsRes.data;
      const ordersData = ordersRes.data;

      setProducts(productsData);
      setOrders(ordersData);
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // ✅ Update stats separately to avoid re-rendering charts unnecessarily
  const updateStats = useCallback((ordersData) => {
    const confirmedOrders = ordersData.filter(o => o.status === 'Confirmed');
    const totalRevenue = confirmedOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    
    const today = new Date();
    const todayRevenue = confirmedOrders.filter(o => {
      const d = new Date(o.createdAt);
      return d.toDateString() === today.toDateString();
    }).reduce((sum, o) => sum + o.totalAmount, 0);

    setStats({
      totalProducts: productsRef.current.length,
      totalOrders: ordersData.length,
      totalRevenue,
      todayRevenue,
      pendingOrders: ordersData.filter(o => o.status === 'Pending').length
    });
  }, []);

  // ✅ Handle socket updates without full refresh
  useEffect(() => {
    if (!socket) return;

    const handleNewOrder = (newOrder) => {
      console.log('New order received', newOrder);
      setOrders(prevOrders => {
        const updatedOrders = [newOrder, ...prevOrders];
        updateStats(updatedOrders);
        return updatedOrders;
      });
    };

    const handleOrderConfirmed = (confirmedOrder) => {
      console.log('Order confirmed', confirmedOrder);
      setOrders(prevOrders => {
        const updatedOrders = prevOrders.map(order =>
          order._id === confirmedOrder._id ? confirmedOrder : order
        );
        updateStats(updatedOrders);
        return updatedOrders;
      });
    };

    const handleOrderCancelled = (cancelledOrder) => {
      console.log('Order cancelled', cancelledOrder);
      setOrders(prevOrders => {
        const updatedOrders = prevOrders.map(order =>
          order._id === cancelledOrder._id ? cancelledOrder : order
        );
        updateStats(updatedOrders);
        return updatedOrders;
      });
    };

    const handleStockUpdated = () => {
      fetchProductsOnly();
    };

    const fetchProductsOnly = async () => {
      try {
        const { data } = await api.get('/products');
        setProducts(data);
      } catch (error) {
        console.error('Failed to fetch products');
      }
    };

    socket.on('newOrder', handleNewOrder);
    socket.on('orderConfirmed', handleOrderConfirmed);
    socket.on('orderCancelled', handleOrderCancelled);
    socket.on('stockUpdated', handleStockUpdated);

    return () => {
      socket.off('newOrder', handleNewOrder);
      socket.off('orderConfirmed', handleOrderConfirmed);
      socket.off('orderCancelled', handleOrderCancelled);
      socket.off('stockUpdated', handleStockUpdated);
    };
  }, [updateStats]);

  // ✅ Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ✅ Update stats when orders change
  useEffect(() => {
    if (orders.length > 0) {
      updateStats(orders);
    }
  }, [orders, updateStats]);

  // ✅ Memoized monthly income calculation
  const computeMonthlyIncome = useCallback(() => {
    const confirmed = orders.filter(o => o.status === 'Confirmed');
    const monthly = Array(12).fill(0);
    confirmed.forEach(order => {
      const date = new Date(order.createdAt);
      if (date.getFullYear() === selectedYear) {
        const month = date.getMonth();
        monthly[month] += order.totalAmount;
      }
    });
    setMonthlyIncome(monthly);
  }, [orders, selectedYear]);

  // ✅ Memoized daily income calculation
  const computeDailyIncome = useCallback((monthIndex) => {
    const confirmed = orders.filter(o => o.status === 'Confirmed');
    const daysInMonth = new Date(selectedYear, monthIndex + 1, 0).getDate();
    const daily = Array(daysInMonth).fill(0);
    confirmed.forEach(order => {
      const date = new Date(order.createdAt);
      if (date.getFullYear() === selectedYear && date.getMonth() === monthIndex) {
        const day = date.getDate() - 1;
        daily[day] += order.totalAmount;
      }
    });
    const chartData = daily.map((revenue, idx) => ({ day: idx + 1, revenue }));
    setDailyIncome(chartData);
  }, [orders, selectedYear]);

  // ✅ Update calculations when orders or selected year changes
  useEffect(() => {
    computeMonthlyIncome();
  }, [computeMonthlyIncome]);

  useEffect(() => {
    if (selectedMonth !== null) {
      computeDailyIncome(selectedMonth);
    }
  }, [selectedMonth, computeDailyIncome]);

  const handleMonthClick = (monthIndex) => {
    if (selectedYear === currentYear && monthIndex > currentMonth) return;
    setSelectedMonth(monthIndex);
  };

  const goPrevYear = () => {
    setSelectedYear(prev => prev - 1);
    setSelectedMonth(null);
  };

  const goNextYear = () => {
    if (selectedYear < currentYear) {
      setSelectedYear(prev => prev + 1);
      setSelectedMonth(null);
    }
  };

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const isMonthClickable = (monthIndex) => {
    if (selectedYear < currentYear) return true;
    if (selectedYear === currentYear && monthIndex <= currentMonth) return true;
    return false;
  };

  const getGrowthForMonth = (monthIndex) => {
    if (monthIndex === 0) return { growth: 0, isPositive: false };
    const prev = monthlyIncome[monthIndex - 1] || 0;
    const current = monthlyIncome[monthIndex];
    if (prev === 0) return { growth: current > 0 ? 100 : 0, isPositive: current > 0 };
    const growth = Math.round(((current - prev) / prev) * 100);
    return { growth: Math.abs(growth), isPositive: growth >= 0 };
  };

  // ✅ Memoize stats cards to prevent unnecessary re-renders
  const StatsCards = useMemo(() => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
      <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-4 text-white shadow-lg hover:-translate-y-1 transition-all duration-300">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-indigo-100 text-sm">Total Products</p>
            <p className="text-3xl font-bold mt-1">{stats.totalProducts}</p>
          </div>
          <FiPackage className="text-3xl text-indigo-200" />
        </div>
      </div>
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white shadow-lg hover:-translate-y-1 transition-all duration-300">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-blue-100 text-sm">Total Orders</p>
            <p className="text-3xl font-bold mt-1">{stats.totalOrders}</p>
          </div>
          <FiShoppingBag className="text-3xl text-blue-200" />
        </div>
      </div>
      <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white shadow-lg hover:-translate-y-1 transition-all duration-300">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-green-100 text-sm">Total Revenue</p>
            <p className="text-3xl font-bold mt-1">₹{stats.totalRevenue.toLocaleString()}</p>
          </div>
          <FaRupeeSign className="text-3xl text-green-200" />
        </div>
      </div>
      <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 text-white shadow-lg hover:-translate-y-1 transition-all duration-300">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-amber-100 text-sm">Today's Revenue</p>
            <p className="text-3xl font-bold mt-1">₹{stats.todayRevenue.toLocaleString()}</p>
          </div>
          <FiTrendingUp className="text-3xl text-amber-200" />
        </div>
      </div>
      <div className="bg-gradient-to-br from-rose-500 to-rose-600 rounded-xl p-4 text-white shadow-lg hover:-translate-y-1 transition-all duration-300">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-rose-100 text-sm">Pending Orders</p>
            <p className="text-3xl font-bold mt-1">{stats.pendingOrders}</p>
          </div>
          <FiUsers className="text-3xl text-rose-200" />
        </div>
      </div>
    </div>
  ), [stats]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded w-48"></div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded"></div>)}
        </div>
        <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(12)].map((_, i) => <div key={i} className="h-32 bg-slate-200 dark:bg-slate-700 rounded"></div>)}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

      {/* Stats Cards */}
      {StatsCards}

      {/* Monthly Income Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Monthly Income</h2>
          <div className="flex items-center gap-2">
            <button 
              onClick={goPrevYear} 
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            >
              <FiChevronLeft size={20} />
            </button>
            <span className="text-lg font-medium">{selectedYear}</span>
            <button
              onClick={goNextYear}
              disabled={selectedYear >= currentYear}
              className={`p-1 rounded transition-colors ${
                selectedYear >= currentYear 
                  ? 'opacity-40 cursor-not-allowed' 
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <FiChevronRight size={20} />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {monthlyIncome.map((income, idx) => {
            const clickable = isMonthClickable(idx);
            const { growth, isPositive } = getGrowthForMonth(idx);
            return (
              <div
                key={idx}
                onClick={() => clickable && handleMonthClick(idx)}
                className={`rounded-xl p-4 transition-all duration-300 cursor-pointer ${
                  !clickable
                    ? 'bg-gray-100 dark:bg-gray-800 opacity-50 cursor-not-allowed'
                    : selectedMonth === idx
                    ? 'bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950/40 dark:to-indigo-900/20 border-2 border-indigo-500 shadow-md'
                    : 'bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 hover:scale-105 hover:shadow-lg'
                }`}
              >
                <div className="flex justify-between items-start">
                  <span className="font-semibold text-sm">{monthNames[idx]}</span>
                  <FiCalendar className="text-indigo-400 text-sm" />
                </div>
                <p className="text-xl font-bold text-green-600 dark:text-green-400 mt-2">
                  ₹{income.toLocaleString()}
                </p>
                {clickable && income > 0 && (
                  <div className="flex items-center gap-1 mt-2 text-xs">
                    {isPositive ? (
                      <FiTrendingUp className="text-green-500" />
                    ) : (
                      <FiTrendingDown className="text-red-500" />
                    )}
                    <span className={isPositive ? 'text-green-600' : 'text-red-600'}>
                      {growth}% from prev
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Daily Income Bar Chart */}
      {selectedMonth !== null && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">
              Daily Income – {monthNames[selectedMonth]} {selectedYear}
            </h2>
            <button 
              onClick={() => setSelectedMonth(null)} 
              className="text-sm text-red-500 hover:text-red-700 transition-colors"
            >
              Close
            </button>
          </div>
          {dailyIncome.length === 0 || dailyIncome.every(d => d.revenue === 0) ? (
            <p className="text-gray-500 text-center py-4">No sales recorded for this month.</p>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={dailyIncome} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid stroke="#374151" strokeDasharray="3 3" />
                <XAxis 
                  dataKey="day" 
                  label={{ value: 'Day of Month', position: 'insideBottom', offset: -5 }} 
                  stroke="#9CA3AF" 
                />
                <YAxis 
                  label={{ value: 'Revenue (₹)', angle: -90, position: 'insideLeft' }} 
                  stroke="#9CA3AF" 
                />
                <Tooltip 
                  formatter={(value) => `₹${value.toLocaleString()}`} 
                  contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} 
                  labelStyle={{ color: '#f3f4f6' }} 
                />
                <Bar dataKey="revenue" fill="#8884d8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  );
}