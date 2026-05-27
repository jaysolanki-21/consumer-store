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
  FiArrowDown
} from 'react-icons/fi';

export default function StockRefillPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [search, setSearch] = useState('');
  const [refillQuantities, setRefillQuantities] = useState({});
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState({});
  const [sortBy, setSortBy] = useState('lowStock'); // 'lowStock', 'name', 'stock', 'price'
  const [sortOrder, setSortOrder] = useState('asc');

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

    // Category filter
    if (selectedCategory) {
      result = result.filter(
        (p) => p.categoryId?._id === selectedCategory
      );
    }

    // Search filter
    if (search.trim()) {
      result = result.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    return result;
  }, [products, selectedCategory, search]);

  // ✅ Sorted products - LOW STOCK FIRST
  const sortedProducts = useMemo(() => {
    let result = [...filteredProducts];

    switch (sortBy) {
      case 'lowStock':
        // Low stock products first (stock <= threshold)
        result.sort((a, b) => {
          const aIsLow = a.stock <= a.lowStockThreshold;
          const bIsLow = b.stock <= b.lowStockThreshold;
          
          if (aIsLow && !bIsLow) return -1;
          if (!aIsLow && bIsLow) return 1;
          
          // Both low or both not low - sort by stock
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

    setProcessing((prev) => ({
      ...prev,
      [productId]: true
    }));

    try {
      await api.put(`/products/${productId}/refill`, {
        quantity: delta * quantity
      });

      toast.success(
        `${delta > 0 ? 'Added' : 'Removed'} ${quantity} stock`
      );

      setRefillQuantities((prev) => ({
        ...prev,
        [productId]: ''
      }));

      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setProcessing((prev) => ({
        ...prev,
        [productId]: false
      }));
    }
  };

  // ✅ Stats
  const lowStockCount = products.filter(
    (p) => p.stock <= p.lowStockThreshold
  ).length;

  const criticalStockCount = products.filter(
    (p) => p.stock <= 5
  ).length;

  const totalStock = products.reduce(
    (acc, p) => acc + p.stock,
    0
  );

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
        {/* Products Card */}
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

        {/* Total Stock Card */}
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

        {/* Low Stock Card */}
        <div className={`rounded-xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300 ${
          lowStockCount > 0 
            ? 'bg-gradient-to-br from-orange-500 to-red-600'
            : 'bg-gradient-to-br from-green-500 to-emerald-600'
        }`}>
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

        {/* Category Card */}
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
        
        {/* Search */}
        <div className="relative">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-12 pl-11 pr-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Categories + Sort */}
        <div className="flex flex-wrap items-center justify-between gap-4">
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

          {/* Sort Options */}
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
                Low Stock First
                {sortBy === 'lowStock' && (
                  sortOrder === 'asc' ? <FiArrowUp className="text-xs" /> : <FiArrowDown className="text-xs" />
                )}
              </button>
              <button
                onClick={() => toggleSort('name')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  sortBy === 'name'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                Name
              </button>
              <button
                onClick={() => toggleSort('stock')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  sortBy === 'stock'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                Stock
              </button>
              <button
                onClick={() => toggleSort('price')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  sortBy === 'price'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                Price
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Product Cards */}
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
            Try changing search or category filter
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-5">
          {sortedProducts.map((product) => {
            const qty = refillQuantities[product._id] || '';
            const isProcessing = processing[product._id];
            const isLowStock = product.stock <= product.lowStockThreshold;
            const isCritical = product.stock <= 5;

            return (
              <div
                key={product._id}
                className={`bg-white dark:bg-slate-900 rounded-2xl border p-5 shadow-sm transition-all duration-200 hover:shadow-md ${
                  isLowStock
                    ? 'border-red-300 dark:border-red-700 bg-red-50/30 dark:bg-red-900/10'
                    : 'border-gray-200 dark:border-slate-800'
                }`}
              >
                <div className="flex gap-5">
                  
                  {/* Image */}
                  <div className="relative">
                    <img
                      src={
                        product.image ||
                        'https://via.placeholder.com/120'
                      }
                      alt={product.name}
                      className="w-24 h-24 rounded-xl object-cover border border-gray-200 dark:border-slate-700"
                    />
                    {isCritical && (
                      <div className="absolute -top-2 -right-2">
                        <div className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                          CRITICAL
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs text-indigo-600 font-medium mb-1">
                          {product.categoryId?.name || 'Category'}
                        </p>

                        <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                          {product.name}
                        </h2>

                        <div className="mt-2 flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-2xl font-bold ${
                                isLowStock
                                  ? 'text-red-500'
                                  : 'text-emerald-600'
                              }`}
                            >
                              {product.stock}
                            </span>
                            <span className="text-sm text-gray-500">
                              units
                            </span>
                          </div>
                          <div className="text-xs text-gray-400">
                            Threshold: {product.lowStockThreshold}
                          </div>
                        </div>

                        {isLowStock && (
                          <div className="flex items-center gap-2 mt-2">
                            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                            <p className="text-xs text-red-500 font-medium">
                              {isCritical ? 'CRITICAL - Immediate refill needed!' : 'Low stock alert'}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-gray-500">
                          Price
                        </p>
                        <p className="text-lg font-bold text-indigo-600">
                          ₹{product.price}
                        </p>
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="mt-5 flex flex-col sm:flex-row gap-3">
                      
                      <input
                        type="number"
                        min="1"
                        value={qty}
                        onChange={(e) =>
                          handleQuantityChange(
                            product._id,
                            e.target.value
                          )
                        }
                        placeholder="Enter quantity"
                        className="flex-1 h-11 px-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                      />

                      <div className="flex gap-2">
                        
                        <button
                          onClick={() => updateStock(product._id, 1)}
                          disabled={isProcessing || !qty}
                          className="w-12 h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition disabled:opacity-50"
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
                            isProcessing ||
                            !qty ||
                            product.stock - qty < 0
                          }
                          className="w-12 h-11 rounded-xl bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition disabled:opacity-50"
                        >
                          {isProcessing ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <FiMinus />
                          )}
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            );
          })}
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
                {lowStockCount} product{lowStockCount !== 1 ? 's' : ''} need{lowStockCount === 1 ? 's' : ''} refill immediately
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}