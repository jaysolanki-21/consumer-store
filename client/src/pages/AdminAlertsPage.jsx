import { useState, useEffect } from 'react';
import api from '../services/api';
import socket from '../services/socket';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { FiAlertTriangle, FiRefreshCw, FiPackage, FiShoppingCart, FiTrendingUp, FiArrowRight } from 'react-icons/fi';
import { Link } from 'react-router-dom';

export default function AdminAlertsPage() {
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [outOfStockProducts, setOutOfStockProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    fetchLowStockProducts();
    socket.on('stockUpdated', fetchLowStockProducts);
    return () => socket.off('stockUpdated');
  }, []);

  const fetchLowStockProducts = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/products');
      const low = data.filter(p => p.stock > 0 && p.stock <= p.lowStockThreshold);
      const out = data.filter(p => p.stock === 0);
      setLowStockProducts(low);
      setOutOfStockProducts(out);
      setAlertCount(low.length + out.length);
    } catch (err) {
      toast.error('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[70vh]">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-indigo-200 rounded-full"></div>
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-100/80 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <FiAlertTriangle className="text-xl" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-[#F8FAFC]">Stock Alerts</h1>
              <p className="text-sm text-slate-500 dark:text-[#94A3B8] mt-0.5">Monitor low stock and out of stock products</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={fetchLowStockProducts}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800/80 text-xs font-medium text-slate-600 dark:text-[#CBD5E1] hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-slate-300 dark:hover:border-slate-700/80 transition shadow-xs"
            title="Refresh alerts"
          >
            <FiRefreshCw className="text-xs" />
            Refresh
          </button>
        </div>
      </div>

      {/* Alert Stats KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Out of Stock */}
        <div className="bg-white dark:bg-[#111827] rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-xs hover:border-slate-300 dark:hover:border-slate-700/80 transition duration-150 flex flex-col justify-between min-h-[135px]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${outOfStockProducts.length > 0 ? "bg-rose-500 animate-pulse" : "bg-slate-300 dark:bg-slate-600"}`} />
              Out of Stock
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-100/80 dark:border-rose-500/20 flex items-center justify-center shrink-0">
              <FiPackage className="text-base" />
            </div>
          </div>
          <div>
            <p className={`text-2xl sm:text-[28px] font-bold mt-2.5 tabular-nums ${outOfStockProducts.length > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-[#F8FAFC]"}`}>
              {outOfStockProducts.length}
            </p>
            <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-2 font-normal">
              {outOfStockProducts.length > 0 ? "Immediate refill required" : "No items out of stock"}
            </p>
          </div>
        </div>

        {/* Low Stock */}
        <div className="bg-white dark:bg-[#111827] rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-xs hover:border-slate-300 dark:hover:border-slate-700/80 transition duration-150 flex flex-col justify-between min-h-[135px]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${lowStockProducts.length > 0 ? "bg-amber-500" : "bg-slate-300 dark:bg-slate-600"}`} />
              Low Stock
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-100/80 dark:border-amber-500/20 flex items-center justify-center shrink-0">
              <FiAlertTriangle className="text-base" />
            </div>
          </div>
          <div>
            <p className={`text-2xl sm:text-[28px] font-bold mt-2.5 tabular-nums ${lowStockProducts.length > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-900 dark:text-[#F8FAFC]"}`}>
              {lowStockProducts.length}
            </p>
            <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-2 font-normal">
              {lowStockProducts.length > 0 ? "At or below threshold" : "All levels above threshold"}
            </p>
          </div>
        </div>

        {/* Total Alerts */}
        <div className="bg-white dark:bg-[#111827] rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-xs hover:border-slate-300 dark:hover:border-slate-700/80 transition duration-150 flex flex-col justify-between min-h-[135px]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${alertCount > 0 ? "bg-indigo-500" : "bg-emerald-500"}`} />
              Total Alerts
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100/80 dark:border-indigo-500/20 flex items-center justify-center shrink-0">
              <FiTrendingUp className="text-base" />
            </div>
          </div>
          <div>
            <p className="text-2xl sm:text-[28px] font-bold text-slate-900 dark:text-[#F8FAFC] mt-2.5 tabular-nums">
              {alertCount}
            </p>
            <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-2 font-normal">
              {alertCount > 0 ? "Products requiring attention" : "Inventory is fully stocked"}
            </p>
          </div>
        </div>
      </div>

      {/* Out of Stock Section */}
      {outOfStockProducts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                <FiAlertTriangle className="text-red-600 text-sm" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-red-700 dark:text-red-400">Critical: Out of Stock</h2>
                <p className="text-xs text-red-500 dark:text-red-300 mt-0.5">These products need immediate attention</p>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Current Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Threshold</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {outOfStockProducts.map((p) => (
                  <tr key={p._id} className="hover:bg-red-50/30 dark:hover:bg-red-950/10 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img src={p.image || 'https://via.placeholder.com/40'} alt={p.name} className="w-10 h-10 rounded-lg object-cover bg-slate-100" />
                        <span className="font-medium text-slate-800 dark:text-slate-200">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-bold">
                        {p.stock} units
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{p.lowStockThreshold} units</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                        Out of Stock
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        to="/admin/stock-refill"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition"
                      >
                        Refill Now <FiArrowRight className="text-xs" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Low Stock Section */}
      {lowStockProducts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                <FiAlertTriangle className="text-amber-600 text-sm" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-amber-700 dark:text-amber-400">Warning: Low Stock</h2>
                <p className="text-xs text-amber-500 dark:text-amber-300 mt-0.5">These products are running low and need refill soon</p>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Current Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Threshold</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {lowStockProducts.map((p) => (
                  <tr key={p._id} className="hover:bg-amber-50/30 dark:hover:bg-amber-950/10 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img src={p.image || 'https://via.placeholder.com/40'} alt={p.name} className="w-10 h-10 rounded-lg object-cover bg-slate-100" />
                        <span className="font-medium text-slate-800 dark:text-slate-200">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-bold">
                        {p.stock} units
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{p.lowStockThreshold} units</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-semibold">
                        Low Stock
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        to="/admin/stock-refill"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium transition"
                      >
                        Refill Now <FiArrowRight className="text-xs" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* No Alerts */}
      {alertCount === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700"
        >
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
            <FiPackage className="text-4xl text-green-500" />
          </div>
          <h3 className="text-xl font-semibold text-slate-800 dark:text-white">All Stock Levels are Healthy</h3>
          <p className="text-sm text-slate-500 mt-1 text-center max-w-md">No low stock or out of stock alerts at the moment. Your inventory looks great!</p>
        </motion.div>
      )}
    </div>
  );
}