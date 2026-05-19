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
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg">
              <FiAlertTriangle className="text-white text-xl" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Stock Alerts</h1>
              <p className="text-sm text-slate-500 mt-0.5">Monitor low stock and out of stock products</p>
            </div>
          </div>
        </div>
       
      </div>

      {/* Alert Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm font-medium">Out of Stock</p>
              <p className="text-3xl font-bold mt-1">{outOfStockProducts.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <FiPackage className="text-2xl" />
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-100 text-sm font-medium">Low Stock</p>
              <p className="text-3xl font-bold mt-1">{lowStockProducts.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <FiAlertTriangle className="text-2xl" />
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-4 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-indigo-100 text-sm font-medium">Total Alerts</p>
              <p className="text-3xl font-bold mt-1">{alertCount}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <FiTrendingUp className="text-2xl" />
            </div>
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