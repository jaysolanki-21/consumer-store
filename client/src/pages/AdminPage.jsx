import { useEffect, useState } from 'react';
import api from '../services/api';
import socket from '../services/socket';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
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
        item.costPrice ?? item.purchasePrice ?? item.buyingPrice ?? item.buyPrice ??
        product.costPrice ?? product.purchasePrice ?? product.buyingPrice ?? product.buyPrice ?? 0
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

      const todayRevenue = todayConfirmedOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
      const todayProfit = todayConfirmedOrders.reduce((sum, o) => sum + getOrderProfit(o), 0);

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
  };

  const handleMonthClick = (monthIndex) => {
    if (selectedYear === currentYear && monthIndex > currentMonth) return;
    setSelectedMonth(monthIndex);
  };

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const isMonthClickable = (monthIndex) => {
    if (selectedYear < currentYear) return true;
    if (selectedYear === currentYear && monthIndex <= currentMonth) return true;
    return false;
  };

  const yearlyConfirmedOrders = orders.filter(o => o.status === 'Confirmed' && new Date(o.createdAt).getFullYear() === selectedYear);
  const yearlyRevenue = yearlyConfirmedOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
  const yearlyProfit = yearlyConfirmedOrders.reduce((sum, o) => sum + getOrderProfit(o), 0);
  
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto flex justify-center items-center h-96">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-12">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Financial Overview</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Monitor your store's performance and revenue metrics in real-time.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white dark:bg-slate-900 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Live Data
          </div>
        </div>
      </div>

      {/* FINTECH STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
            <FaRupeeSign className="text-6xl text-emerald-500" />
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold tracking-wide uppercase mb-1">Yearly Revenue</p>
          <h3 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight mb-4">₹{yearlyRevenue.toLocaleString()}</h3>
          <div className="flex items-center text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400 w-max px-2.5 py-1 rounded-md">
            <FiTrendingUp className="mr-1.5" /> +12.5% vs Last Year
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
            <FiTrendingUp className="text-6xl text-indigo-500" />
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold tracking-wide uppercase mb-1">Yearly Profit</p>
          <h3 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight mb-4">₹{yearlyProfit.toLocaleString()}</h3>
          <div className="flex items-center text-xs font-semibold text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 dark:text-indigo-400 w-max px-2.5 py-1 rounded-md">
            <FiTrendingUp className="mr-1.5" /> +8.2% vs Last Year
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
            <FiShoppingBag className="text-6xl text-blue-500" />
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold tracking-wide uppercase mb-1">Today's Revenue</p>
          <h3 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight mb-4">₹{stats.todayRevenue.toLocaleString()}</h3>
          <div className="flex items-center text-xs font-semibold text-blue-600 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-400 w-max px-2.5 py-1 rounded-md">
            <FiShoppingBag className="mr-1.5" /> ₹{stats.todayProfit.toLocaleString()} Profit
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
            <FiUsers className="text-6xl text-rose-500" />
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold tracking-wide uppercase mb-1">Pending Orders</p>
          <h3 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight mb-4">{stats.pendingOrders}</h3>
          <div className="flex items-center text-xs font-semibold text-rose-600 bg-rose-50 dark:bg-rose-500/10 dark:text-rose-400 w-max px-2.5 py-1 rounded-md">
            <FiUsers className="mr-1.5" /> Action Required
          </div>
        </div>
      </div>

      {/* CHART & CALENDAR SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: MONTHLY CALENDAR GRID */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex-1">
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <FiCalendar className="text-indigo-500" /> Fiscal {selectedYear}
              </h2>
              <div className="flex items-center bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                <button onClick={() => setSelectedYear(prev => prev - 1)} className="p-2 text-slate-400 hover:text-indigo-600 transition"><FiChevronLeft size={16}/></button>
                <span className="text-sm font-bold px-2">{selectedYear}</span>
                <button onClick={() => selectedYear < currentYear && setSelectedYear(prev => prev + 1)} className={`p-2 transition ${selectedYear < currentYear ? 'text-slate-400 hover:text-indigo-600' : 'text-slate-200 dark:text-slate-700'}`}><FiChevronRight size={16}/></button>
              </div>
            </div>
            
            <div className="p-4 grid grid-cols-3 gap-2">
              {monthlyIncome.map((inc, idx) => {
                const clickable = isMonthClickable(idx);
                const isSelected = selectedMonth === idx;
                const profit = monthlyProfit[idx] || 0;
                
                return (
                  <div 
                    key={idx}
                    onClick={() => clickable && handleMonthClick(idx)}
                    className={`p-3 rounded-2xl flex flex-col items-center justify-center text-center transition-all duration-200 ${
                      !clickable ? "opacity-30 cursor-not-allowed" : 
                      isSelected ? "bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none" : 
                      "hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                    }`}
                  >
                    <span className={`text-xs font-bold uppercase ${isSelected ? "text-indigo-100" : "text-slate-400"}`}>{monthNames[idx]}</span>
                    <span className={`text-sm font-bold mt-1 ${isSelected ? "text-white" : "text-slate-700 dark:text-slate-200"}`}>
                      {inc > 0 ? `₹${(inc/1000).toFixed(1)}k` : '-'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: CHART AREA */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 flex-1 flex flex-col">
            {selectedMonth === null ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <FiTrendingUp className="text-6xl mb-4 opacity-20" />
                <p>Select a month from the calendar to view daily performance</p>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">Daily Performance</h2>
                    <p className="text-sm text-slate-500">{monthNames[selectedMonth]} {selectedYear}</p>
                  </div>
                  <button onClick={() => setSelectedMonth(null)} className="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-3 py-1.5 rounded-lg transition">Close</button>
                </div>
                
                <div className="flex-1 w-full min-h-[350px]">
                  {dailyIncome.every(d => d.revenue === 0) ? (
                     <div className="h-full flex items-center justify-center text-slate-400 text-sm">No data for this month</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dailyIncome} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorProf" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} tickFormatter={(v) => `₹${v}`} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          formatter={(val) => [`₹${val.toLocaleString()}`]}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                        <Area type="monotone" name="Revenue" dataKey="revenue" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                        <Area type="monotone" name="Profit" dataKey="profit" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProf)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}