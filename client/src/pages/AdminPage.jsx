import { useEffect, useState } from 'react';
import api from '../services/api';
import socket from '../services/socket';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { FiPackage, FiDollarSign, FiShoppingBag, FiUsers, FiCalendar, FiChevronLeft, FiChevronRight, FiTrendingUp, FiTrendingDown } from 'react-icons/fi';
import { FaRupeeSign } from 'react-icons/fa';

export default function AdminPage() {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalProducts: 0, totalOrders: 0, totalRevenue: 0, todayRevenue: 0, todayProfit: 0, pendingOrders: 0 });

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [monthlyIncome, setMonthlyIncome] = useState(Array(12).fill(0));
  const [monthlyProfit, setMonthlyProfit] = useState(Array(12).fill(0));
  const [dailyIncome, setDailyIncome] = useState([]);
  const [dailyProfit, setDailyProfit] = useState([]);

  useEffect(() => {
    fetchData();
    socket.on('newOrder', fetchData);
    socket.on('orderConfirmed', fetchData);
    socket.on('orderCancelled', fetchData);
    return () => {
      socket.off('newOrder');
      socket.off('orderConfirmed');
      socket.off('orderCancelled');
    };
  }, []);

  useEffect(() => {
    computeMonthlyIncome();
    if (selectedMonth !== null) {
      computeDailyIncome(selectedMonth);
    }
  }, [orders, selectedYear, selectedMonth]);

  // Calculate profit for a confirmed order.
  const getOrderProfit = (order) => {
    if (order.profitAmount != null) return Number(order.profitAmount) || 0;
    if (order.profit != null) return Number(order.profit) || 0;

    const items = order.items || order.products || order.orderItems || [];
    if (!Array.isArray(items) || items.length === 0) return 0;

    return items.reduce((sum, item) => {
      const quantity = Number(item.quantity ?? item.qty ?? 1) || 1;
      const sellingPrice = Number(
        item.sellingPrice ?? item.price ?? item.salePrice ?? (item.totalPrice ? item.totalPrice / quantity : 0)
      ) || 0;

      const product = item.product || item.productId || {};
      const costPrice = Number(
        item.costPrice ??
        item.purchasePrice ??
        item.buyingPrice ??
        item.buyPrice ??
        product.costPrice ??
        product.purchasePrice ??
        product.buyingPrice ??
        product.buyPrice ??
        0
      ) || 0;

      return sum + ((sellingPrice - costPrice) * quantity);
    }, 0);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [productsRes, ordersRes] = await Promise.all([
        api.get('/products'),
        api.get('/orders')
      ]);
      const productsData = productsRes.data;
      const ordersData = ordersRes.data;

      const confirmedOrders = ordersData.filter(o => o.status === 'Confirmed');
      const totalRevenue = confirmedOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

      const today = new Date();
      const todayConfirmedOrders = confirmedOrders.filter(o => {
        const d = new Date(o.createdAt);
        return d.toDateString() === today.toDateString();
      });

      const todayRevenue = todayConfirmedOrders.reduce(
        (sum, o) => sum + (Number(o.totalAmount) || 0),
        0
      );

      const todayProfit = todayConfirmedOrders.reduce(
        (sum, o) => sum + getOrderProfit(o),
        0
      );

      setProducts(productsData);
      setOrders(ordersData);
      setStats({
        totalProducts: productsData.length,
        totalOrders: ordersData.length,
        totalRevenue,
        todayRevenue,
        todayProfit,
        pendingOrders: ordersData.filter(o => o.status === 'Pending').length
      });
    } catch (err) {
      console.error('Failed to load admin data', err);
    } finally {
      setLoading(false);
    }
  };

  const computeMonthlyIncome = () => {
    const confirmed = orders.filter(o => o.status === 'Confirmed');
    const monthlyRevenue = Array(12).fill(0);
    const monthlyProfitData = Array(12).fill(0);

    confirmed.forEach(order => {
      const date = new Date(order.createdAt);
      if (date.getFullYear() === selectedYear) {
        const month = date.getMonth();
        monthlyRevenue[month] += Number(order.totalAmount) || 0;
        monthlyProfitData[month] += getOrderProfit(order);
      }
    });

    setMonthlyIncome(monthlyRevenue);
    setMonthlyProfit(monthlyProfitData);
  };

  const computeDailyIncome = (monthIndex) => {
    const confirmed = orders.filter(o => o.status === 'Confirmed');
    const daysInMonth = new Date(selectedYear, monthIndex + 1, 0).getDate();
    const dailyRevenue = Array(daysInMonth).fill(0);
    const dailyProfitData = Array(daysInMonth).fill(0);

    confirmed.forEach(order => {
      const date = new Date(order.createdAt);
      if (date.getFullYear() === selectedYear && date.getMonth() === monthIndex) {
        const day = date.getDate() - 1;
        dailyRevenue[day] += Number(order.totalAmount) || 0;
        dailyProfitData[day] += getOrderProfit(order);
      }
    });

    const chartData = dailyRevenue.map((revenue, idx) => ({
      day: idx + 1,
      revenue,
      profit: dailyProfitData[idx]
    }));

    setDailyIncome(chartData);
    setDailyProfit(chartData);
  };

  const handleMonthClick = (monthIndex) => {
    if (selectedYear === currentYear && monthIndex > currentMonth) return;
    setSelectedMonth(monthIndex);
    computeDailyIncome(monthIndex);
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
    const current = monthlyIncome[monthIndex] || 0;
    if (prev === 0) return { growth: current > 0 ? 100 : 0, isPositive: current > 0 };
    const growth = Math.round(((current - prev) / prev) * 100);
    return { growth: Math.abs(growth), isPositive: growth >= 0 };
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded w-48"></div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded"></div>)}
        </div>
        <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(12)].map((_, i) => <div key={i} className="h-32 bg-slate-200 dark:bg-slate-700 rounded"></div>)}
        </div>
      </div>
    );
  }

  const yearlyConfirmedOrders = orders.filter(o => o.status === 'Confirmed' && new Date(o.createdAt).getFullYear() === selectedYear);
  const yearlyRevenue = yearlyConfirmedOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
  const yearlyProfit = yearlyConfirmedOrders.reduce((sum, o) => sum + getOrderProfit(o), 0);
  const yearlyOrdersCount = orders.filter(o => new Date(o.createdAt).getFullYear() === selectedYear).length;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4 mb-8">
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
              <p className="text-blue-100 text-sm">Yearly Orders</p>
              <p className="text-3xl font-bold mt-1">{yearlyOrdersCount}</p>
            </div>
            <FiShoppingBag className="text-3xl text-blue-200" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-green-100 text-sm">Yearly Revenue</p>
              <p className="text-3xl font-bold mt-1">₹{yearlyRevenue.toLocaleString()}</p>
            </div>
            <FaRupeeSign className="text-3xl text-green-200" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-purple-100 text-sm">Yearly Profit</p>
              <p className="text-3xl font-bold mt-1">₹{yearlyProfit.toLocaleString()}</p>
            </div>
            <FiTrendingUp className="text-3xl text-purple-200" />
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
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-emerald-100 text-sm">Today's Profit</p>
              <p className="text-3xl font-bold mt-1">₹{stats.todayProfit.toLocaleString()}</p>
            </div>
            <FiTrendingUp className="text-3xl text-emerald-200" />
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

      {/* Monthly Revenue & Profit Calendar */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden mb-8">

        {/* Section Header */}
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
                <FiCalendar className="text-indigo-600 dark:text-indigo-400 text-xl" />
              </div>

              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
                  Monthly Revenue & Profit
                </h2>

                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  Track monthly financial performance
                </p>
              </div>
            </div>

            {/* Year Navigation */}
            <div className="flex items-center justify-between sm:justify-center gap-1 bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 rounded-xl p-1">

              <button
                onClick={goPrevYear}
                className="w-10 h-10 flex items-center justify-center rounded-lg
                           text-gray-500 dark:text-gray-400
                           hover:bg-white dark:hover:bg-gray-800
                           hover:text-indigo-600 dark:hover:text-indigo-400
                           transition-all"
                title="Previous year"
              >
                <FiChevronLeft size={22} />
              </button>

              <div className="min-w-[90px] text-center">
                <span className="text-lg font-bold text-gray-800 dark:text-white">
                  {selectedYear}
                </span>
              </div>

              <button
                onClick={goNextYear}
                disabled={selectedYear >= currentYear}
                className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all ${
                  selectedYear >= currentYear
                    ? "text-gray-300 dark:text-gray-600 cursor-not-allowed"
                    : "text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 hover:text-indigo-600 dark:hover:text-indigo-400"
                }`}
                title="Next year"
              >
                <FiChevronRight size={22} />
              </button>

            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="p-5 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">

            {monthlyIncome.map((income, idx) => {
              const clickable = isMonthClickable(idx);
              const { growth, isPositive } = getGrowthForMonth(idx);

              const revenue = Number(monthlyIncome[idx] || 0);
              const profit = Number(monthlyProfit[idx] || 0);

              return (
                <motion.div
                  key={idx}
                  onClick={() => clickable && handleMonthClick(idx)}
                  whileHover={clickable ? { y: -3 } : {}}
                  transition={{ duration: 0.2 }}
                  className={`relative rounded-2xl p-5 transition-all duration-200 ${
                    !clickable
                      ? "bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800 opacity-50 cursor-not-allowed"
                      : selectedMonth === idx
                      ? "bg-indigo-50/70 dark:bg-indigo-950/30 border-2 border-indigo-500 shadow-md shadow-indigo-100 dark:shadow-none cursor-pointer"
                      : "bg-gray-50/70 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 hover:border-indigo-200 dark:hover:border-indigo-700 hover:shadow-md cursor-pointer"
                  }`}
                >
                 

                  {/* Month Header */}
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold">
                        Month
                      </p>
                      <h3 className="text-2xl font-bold text-gray-800 dark:text-white mt-0.5">
                        {monthNames[idx]}
                      </h3>
                    </div>

                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 flex items-center justify-center shadow-sm">
                      <FiCalendar className="text-indigo-500 text-lg" />
                    </div>
                  </div>

                  {/* Financial Stats */}
                  <div className="grid grid-cols-2 gap-3">

                    {/* Revenue */}
                    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/10 p-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                          <FaRupeeSign className="text-emerald-600 dark:text-emerald-400 text-xs" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                          Revenue
                        </span>
                      </div>

                      <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 truncate">
                        ₹{revenue.toLocaleString()}
                      </p>
                    </div>

                    {/* Profit */}
                    <div className={`rounded-xl p-3 border ${
                      profit >= 0
                        ? "bg-indigo-50 dark:bg-indigo-500/10 border-indigo-100 dark:border-indigo-500/10"
                        : "bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/10"
                    }`}>
                      <div className="flex items-center gap-1.5 mb-2">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                          profit >= 0
                            ? "bg-indigo-100 dark:bg-indigo-500/20"
                            : "bg-red-100 dark:bg-red-500/20"
                        }`}>
                          <FiTrendingUp
                            className={`text-xs ${
                              profit >= 0
                                ? "text-indigo-600 dark:text-indigo-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          />
                        </div>

                        <span className={`text-xs font-bold uppercase tracking-wide ${
                          profit >= 0
                            ? "text-indigo-700 dark:text-indigo-400"
                            : "text-red-700 dark:text-red-400"
                        }`}>
                          Profit
                        </span>
                      </div>

                      <p className={`text-lg font-bold truncate ${
                        profit >= 0
                          ? "text-indigo-600 dark:text-indigo-400"
                          : "text-red-600 dark:text-red-400"
                      }`}>
                        ₹{profit.toLocaleString()}
                      </p>
                    </div>

                  </div>

                  {/* Growth */}
                  {clickable && revenue > 0 && (
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        Revenue growth
                      </span>

                      <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                        isPositive
                          ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"
                      }`}>
                        {isPositive ? (
                          <FiTrendingUp size={13} />
                        ) : (
                          <FiTrendingDown size={13} />
                        )}
                        {growth}%
                      </div>
                    </div>
                  )}

                  {/* No Revenue */}
                  {clickable && revenue === 0 && (
                    <div className="mt-4">
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        No revenue recorded
                      </span>
                    </div>
                  )}

                </motion.div>
              );
            })}

          </div>
        </div>
      </div>

      {/* Daily Chart – Revenue + Profit */}
      {selectedMonth !== null && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-2xl font-bold">
              Daily Revenue & Profit – {monthNames[selectedMonth]} {selectedYear}
            </h2>
            <button
              onClick={() => setSelectedMonth(null)}
              className="text-sm font-semibold text-red-500 hover:text-red-700"
            >
              Close
            </button>
          </div>

          {dailyIncome.length === 0 || dailyIncome.every(d => d.revenue === 0 && d.profit === 0) ? (
            <p className="text-gray-500 text-center py-6 text-base">No sales recorded for this month.</p>
          ) : (
            <ResponsiveContainer width="100%" height={420}>
              <BarChart data={dailyIncome} margin={{ top: 20, right: 30, left: 20, bottom: 10 }}>
                <CartesianGrid stroke="#374151" strokeDasharray="3 3" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 13 }}
                  label={{ value: 'Day of Month', position: 'insideBottom', offset: -5, fontSize: 14 }}
                  stroke="#9CA3AF"
                />
                <YAxis
                  tick={{ fontSize: 13 }}
                  label={{ value: 'Amount (₹)', angle: -90, position: 'insideLeft', fontSize: 14 }}
                  stroke="#9CA3AF"
                />
                <Tooltip
                  formatter={(value) => `₹${Number(value).toLocaleString()}`}
                  contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8, fontSize: 14 }}
                  labelStyle={{ color: '#f3f4f6', fontSize: 14 }}
                />
                <Legend wrapperStyle={{ fontSize: 14, paddingTop: 10 }} />
                <Bar dataKey="revenue" fill="#10b981" name="Revenue" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" fill="#6366f1" name="Profit" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  );
}