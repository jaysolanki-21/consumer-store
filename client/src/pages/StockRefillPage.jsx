import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  FiSearch,
  FiPlus,
  FiMinus,
  FiRefreshCw,
  FiPackage,
  FiAlertTriangle,
  FiTrendingUp,
  FiGrid,
  FiArrowUp,
  FiArrowDown,
  FiChevronLeft,
  FiChevronRight,
  FiX,
  FiCheckCircle
} from 'react-icons/fi';

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100];

export default function StockRefillPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [refillQuantities, setRefillQuantities] = useState({});
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState({});
  const [sortBy, setSortBy] = useState('lowStock');
  const [sortOrder, setSortOrder] = useState('asc');

  // ✅ Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [productsRes, categoriesRes] = await Promise.all([
        api.get('/products'),
        api.get('/categories')
      ]);

      setProducts(productsRes.data);
      setCategories(categoriesRes.data);
    } catch (err) {
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data } = await api.get('/products');
      setProducts(data);
    } catch (err) {
      toast.error('Failed to refresh products');
    }
  };

  // ✅ Filter products
  const filteredProducts = useMemo(() => {
    let result = [...products];

    if (selectedCategory) {
      result = result.filter((p) => p.categoryId?._id === selectedCategory);
    }

    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(term));
    }

    if (stockFilter === 'low') {
      result = result.filter((p) => p.stock <= p.lowStockThreshold);
    } else if (stockFilter === 'critical') {
      result = result.filter((p) => p.stock <= 5);
    } else if (stockFilter === 'healthy') {
      result = result.filter((p) => p.stock > p.lowStockThreshold);
    }

    return result;
  }, [products, selectedCategory, search, stockFilter]);

  // ✅ Sorted products
  const sortedProducts = useMemo(() => {
    let result = [...filteredProducts];

    switch (sortBy) {
      case 'lowStock':
        result.sort((a, b) => {
          const aIsLow = a.stock <= a.lowStockThreshold;
          const bIsLow = b.stock <= b.lowStockThreshold;
          if (aIsLow && !bIsLow) return -1;
          if (!aIsLow && bIsLow) return 1;
          return a.stock - b.stock;
        });
        break;
      case 'name':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'stock':
        result.sort((a, b) => a.stock - b.stock);
        break;
      case 'price':
        result.sort((a, b) => a.price - b.price);
        break;
      default:
        break;
    }

    if (sortOrder === 'desc' && sortBy !== 'lowStock') {
      result.reverse();
    }

    return result;
  }, [filteredProducts, sortBy, sortOrder]);

  // ✅ Pagination
  const totalItems = sortedProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  useEffect(() => {
    setPage(1);
  }, [search, selectedCategory, stockFilter, sortBy, sortOrder, pageSize]);

  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const pagedProducts = useMemo(
    () => sortedProducts.slice(startIndex, startIndex + pageSize),
    [sortedProducts, startIndex, pageSize]
  );

  const handleQuantityChange = (productId, value) => {
    const parsed = parseInt(value);
    setRefillQuantities((prev) => ({
      ...prev,
      [productId]: isNaN(parsed) ? '' : parsed
    }));
  };

  const updateStock = async (productId, delta) => {
    const quantity = refillQuantities[productId];

    if (!quantity || quantity <= 0) {
      toast.error('Enter valid quantity');
      return;
    }

    const product = products.find((p) => p._id === productId);
    if (!product) return;

    const newStock = product.stock + delta * quantity;
    if (newStock < 0) {
      toast.error('Stock cannot go below 0');
      return;
    }

    setProcessing((prev) => ({ ...prev, [productId]: true }));

    try {
      await api.put(`/products/${productId}/refill`, {
        quantity: delta * quantity
      });

      toast.success(`${delta > 0 ? 'Added' : 'Removed'} ${quantity} stock`);

      setRefillQuantities((prev) => ({ ...prev, [productId]: '' }));
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setProcessing((prev) => ({ ...prev, [productId]: false }));
    }
  };

  // ✅ Stats
  const lowStockCount = products.filter(
    (p) => p.stock <= p.lowStockThreshold
  ).length;
  const criticalStockCount = products.filter((p) => p.stock <= 5).length;
  const totalStock = products.reduce((acc, p) => acc + p.stock, 0);

  const toggleSort = (type) => {
    if (sortBy === type) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(type);
      setSortOrder('asc');
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 bg-gray-50 dark:bg-[#0B1120] min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
            Stock Management
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage inventory and refill stock levels
          </p>
        </div>

        <button
          onClick={fetchProducts}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition"
        >
          <FiRefreshCw className="text-indigo-500" />
          <span className="text-sm font-medium">Refresh</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-indigo-100 text-sm font-medium">Products</p>
              <p className="text-3xl font-bold mt-1">{products.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <FiPackage className="text-2xl text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-emerald-100 text-sm font-medium">Total Stock</p>
              <p className="text-3xl font-bold mt-1">{totalStock}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <FiTrendingUp className="text-2xl text-white" />
            </div>
          </div>
        </div>

        <div
          className={`rounded-xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300 ${
            lowStockCount > 0
              ? 'bg-gradient-to-br from-orange-500 to-red-600'
              : 'bg-gradient-to-br from-green-500 to-emerald-600'
          }`}
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-orange-100 text-sm font-medium">Low Stock</p>
              <p className="text-3xl font-bold mt-1">{lowStockCount}</p>
              {criticalStockCount > 0 && (
                <p className="text-xs text-orange-200 mt-1">
                  {criticalStockCount} critical
                </p>
              )}
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <FiAlertTriangle className="text-2xl text-white animate-pulse" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-purple-100 text-sm font-medium">Categories</p>
              <p className="text-3xl font-bold mt-1">{categories.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <FiGrid className="text-2xl text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-5 shadow-sm space-y-5">
        {/* Search only (rows per page moved to footer) */}
        <div className="relative">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-12 pl-11 pr-10 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <FiX />
            </button>
          )}
        </div>

        {/* Category chips */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory('')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
              !selectedCategory
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300'
            }`}
          >
            All
          </button>

          {categories.map((cat) => (
            <button
              key={cat._id}
              onClick={() => setSelectedCategory(cat._id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                selectedCategory === cat._id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Stock filter + sort */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl">
            {[
              ['all', 'All Stock'],
              ['low', `Low (${lowStockCount})`],
              ['critical', `Critical (${criticalStockCount})`],
              ['healthy', 'Healthy']
            ].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setStockFilter(val)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                  stockFilter === val
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Sort by:</span>
            <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => toggleSort('lowStock')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                  sortBy === 'lowStock'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                Low Stock
                {sortBy === 'lowStock' &&
                  (sortOrder === 'asc' ? (
                    <FiArrowUp className="text-xs" />
                  ) : (
                    <FiArrowDown className="text-xs" />
                  ))}
              </button>
              <button
                onClick={() => toggleSort('name')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                  sortBy === 'name'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                Name
                {sortBy === 'name' &&
                  (sortOrder === 'asc' ? (
                    <FiArrowUp className="text-xs" />
                  ) : (
                    <FiArrowDown className="text-xs" />
                  ))}
              </button>
              <button
                onClick={() => toggleSort('stock')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                  sortBy === 'stock'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                Stock
                {sortBy === 'stock' &&
                  (sortOrder === 'asc' ? (
                    <FiArrowUp className="text-xs" />
                  ) : (
                    <FiArrowDown className="text-xs" />
                  ))}
              </button>
              <button
                onClick={() => toggleSort('price')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                  sortBy === 'price'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                Price
                {sortBy === 'price' &&
                  (sortOrder === 'asc' ? (
                    <FiArrowUp className="text-xs" />
                  ) : (
                    <FiArrowDown className="text-xs" />
                  ))}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Product Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        </div>
      ) : sortedProducts.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-20 text-center border border-gray-200 dark:border-slate-800">
          <FiPackage className="mx-auto text-5xl text-gray-300 mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 dark:text-white">
            No Products Found
          </h2>
          <p className="text-gray-500 mt-2">
            Try changing search or filter options
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-slate-800/60">
                <tr className="text-left text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold">
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Price</th>
                  <th className="px-5 py-3">Stock</th>
                  <th className="px-5 py-3">Threshold</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Refill</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {pagedProducts.map((product) => {
                  const qty = refillQuantities[product._id] || '';
                  const isProcessing = processing[product._id];
                  const isLowStock = product.stock <= product.lowStockThreshold;
                  const isCritical = product.stock <= 5;

                  return (
                    <tr
                      key={product._id}
                      className={`transition ${
                        isLowStock
                          ? 'bg-red-50/40 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20'
                          : 'hover:bg-gray-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <img
                              src={
                                product.image ||
                                'https://via.placeholder.com/80'
                              }
                              alt={product.name}
                              className="w-12 h-12 rounded-xl object-cover border border-gray-200 dark:border-slate-700"
                            />
                            {isCritical && (
                              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-800 dark:text-white text-sm">
                              {product.name}
                            </span>
                            {isCritical && (
                              <span className="text-[10px] font-bold text-red-600 mt-0.5">
                                CRITICAL
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="text-xs text-indigo-600 font-medium">
                          {product.categoryId?.name || 'Uncategorized'}
                        </span>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="font-semibold text-gray-800 dark:text-white">
                          ₹{product.price}
                        </span>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <span
                          className={`text-lg font-bold ${
                            isLowStock ? 'text-red-500' : 'text-emerald-600'
                          }`}
                        >
                          {product.stock}
                        </span>
                        <span className="text-xs text-gray-500 ml-1">
                          units
                        </span>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.lowStockThreshold}
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        {isCritical ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
                            <FiAlertTriangle className="text-xs" />
                            Critical
                          </span>
                        ) : isLowStock ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold">
                            <FiAlertTriangle className="text-xs" />
                            Low
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                            <FiCheckCircle className="text-xs" />
                            Healthy
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <input
                            type="number"
                            min="1"
                            value={qty}
                            onChange={(e) =>
                              handleQuantityChange(product._id, e.target.value)
                            }
                            placeholder="Qty"
                            className="w-20 h-10 px-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 text-sm dark:text-white"
                          />

                          <button
                            onClick={() => updateStock(product._id, 1)}
                            disabled={isProcessing || !qty}
                            title="Add stock"
                            className="w-10 h-10 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition disabled:opacity-50"
                          >
                            {isProcessing ? (
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <FiPlus />
                            )}
                          </button>

                          <button
                            onClick={() => updateStock(product._id, -1)}
                            disabled={
                              isProcessing || !qty || product.stock - qty < 0
                            }
                            title="Remove stock"
                            className="w-10 h-10 rounded-lg bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition disabled:opacity-50"
                          >
                            {isProcessing ? (
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              <FiMinus />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ✅ Pagination Footer — Rows per page moved here */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 px-5 py-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/40">
            <p className="text-sm text-gray-500">
              Showing{' '}
              <span className="font-semibold text-gray-700 dark:text-gray-200">
                {totalItems === 0 ? 0 : startIndex + 1}–{endIndex}
              </span>{' '}
              of{' '}
              <span className="font-semibold text-gray-700 dark:text-gray-200">
                {totalItems}
              </span>{' '}
              products
            </p>

            <div className="flex items-center gap-2 flex-wrap">
              {/* ✅ Rows per page */}
              <div className="flex items-center gap-2 mr-2">
                <span className="text-sm text-gray-500 whitespace-nowrap">
                  Rows per page:
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="h-9 px-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-9 px-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 disabled:opacity-40 flex items-center gap-1 text-sm"
              >
                <FiChevronLeft /> Prev
              </button>

              <div className="flex items-center gap-1">
                {(() => {
                  const pages = [];
                  const maxShown = 5;
                  let startPage = Math.max(1, page - Math.floor(maxShown / 2));
                  let endPage = Math.min(
                    totalPages,
                    startPage + maxShown - 1
                  );
                  if (endPage - startPage < maxShown - 1) {
                    startPage = Math.max(1, endPage - maxShown + 1);
                  }
                  for (let i = startPage; i <= endPage; i++) pages.push(i);

                  return (
                    <>
                      {startPage > 1 && (
                        <>
                          <button
                            onClick={() => setPage(1)}
                            className={`h-9 w-9 rounded-lg text-sm ${
                              page === 1
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            1
                          </button>
                          {startPage > 2 && (
                            <span className="px-1 text-gray-400">…</span>
                          )}
                        </>
                      )}

                      {pages.map((n) => (
                        <button
                          key={n}
                          onClick={() => setPage(n)}
                          className={`h-9 w-9 rounded-lg text-sm font-medium ${
                            n === page
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          {n}
                        </button>
                      ))}

                      {endPage < totalPages && (
                        <>
                          {endPage < totalPages - 1 && (
                            <span className="px-1 text-gray-400">…</span>
                          )}
                          <button
                            onClick={() => setPage(totalPages)}
                            className={`h-9 w-9 rounded-lg text-sm ${
                              page === totalPages
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {totalPages}
                          </button>
                        </>
                      )}
                    </>
                  );
                })()}
              </div>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="h-9 px-3 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 disabled:opacity-40 flex items-center gap-1 text-sm"
              >
                Next <FiChevronRight />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Low Stock Summary Banner */}
      {lowStockCount > 0 && (
        <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border border-orange-200 dark:border-orange-800 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <FiAlertTriangle className="text-orange-500 text-2xl" />
            <div>
              <p className="font-semibold text-orange-800 dark:text-orange-300">
                Low Stock Alert
              </p>
              <p className="text-sm text-orange-600 dark:text-orange-400">
                {lowStockCount} product{lowStockCount !== 1 ? 's' : ''} need
                {lowStockCount === 1 ? 's' : ''} refill immediately
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}