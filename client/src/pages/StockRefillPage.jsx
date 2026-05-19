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
  FiGrid
} from 'react-icons/fi';

export default function StockRefillPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [search, setSearch] = useState('');
  const [refillQuantities, setRefillQuantities] = useState({});
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState({});

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

  const filteredProducts = useMemo(() => {
    let result = products;

    if (selectedCategory) {
      result = result.filter(
        (p) => p.categoryId?._id === selectedCategory
      );
    }

    if (search.trim()) {
      result = result.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    return result;
  }, [products, selectedCategory, search]);

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

  const lowStockCount = products.filter(
    (p) => p.stock <= p.lowStockThreshold
  ).length;

  const totalStock = products.reduce(
    (acc, p) => acc + p.stock,
    0
  );

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

        
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
  {/* Products Card */}
  <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer">
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
  <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer">
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
  <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-orange-100 text-sm font-medium">Low Stock</p>
        <p className="text-3xl font-bold mt-1">{lowStockCount}</p>
      </div>
      <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
        <FiAlertTriangle className="text-2xl text-white animate-pulse" />
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

        {/* Categories */}
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
      </div>

      {/* Product Cards */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        </div>
      ) : filteredProducts.length === 0 ? (
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
          {filteredProducts.map((product) => {
            const qty = refillQuantities[product._id] || '';
            const isProcessing = processing[product._id];
            const isLowStock =
              product.stock <= product.lowStockThreshold;

            return (
              <div
                key={product._id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-5 shadow-sm"
              >
                <div className="flex gap-5">
                  
                  {/* Image */}
                  <img
                    src={
                      product.image ||
                      'https://via.placeholder.com/120'
                    }
                    alt={product.name}
                    className="w-24 h-24 rounded-xl object-cover border border-gray-200 dark:border-slate-700"
                  />

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

                        <div className="mt-2 flex items-center gap-3">
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

                        {isLowStock && (
                          <p className="text-xs text-red-500 mt-1">
                            Low stock alert
                          </p>
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
                          onClick={() =>
                            updateStock(product._id, 1)
                          }
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
                          onClick={() =>
                            updateStock(product._id, -1)
                          }
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
    </div>
  );
}