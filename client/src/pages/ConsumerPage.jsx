import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { clearCart } from '../redux/slices/cartSlice';
import api from '../services/api';
import socket from '../services/socket';
import ProductCard from '../components/ProductCard';
import CartDrawer from '../components/CartDrawer';
import PasswordProtection from '../components/PasswordProtection';

import {
  FiShoppingCart,
  FiSearch,
  FiPackage,
  FiAlertCircle,
  FiZap,
  FiGrid,
  FiTag,
  FiCoffee,
  FiSmartphone,
  FiBook,
} from 'react-icons/fi';

// Icon mapping for categories
const categoryIcons = {
  'Food & Beverages': FiCoffee,
  'Electronics': FiSmartphone,
  'Stationery': FiBook,
  'Default': FiTag,
};

function ConsumerPageContent() {
  const dispatch = useDispatch();

  const cartItems = useSelector((state) => state.cart.items);

  // Performance: useMemo for cart calculations
  const cartCount = useMemo(
    () => cartItems.reduce((acc, item) => acc + item.quantity, 0),
    [cartItems]
  );

  const cartTotal = useMemo(
    () => cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0),
    [cartItems]
  );

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [search, setSearch] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [isOrderConfirming, setIsOrderConfirming] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Prevent background scroll when cart is open
  useEffect(() => {
    document.body.style.overflow = showCart ? 'hidden' : 'auto';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [showCart]);

  // Fetch products and categories
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([fetchProducts(), fetchCategories()]);
      } catch (err) {
        console.error('Fetch error:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();

    const handleStockUpdate = () => {
      fetchProducts();
    };

    socket.on('stockUpdated', handleStockUpdate);

    return () => {
      socket.off('stockUpdated', handleStockUpdate);
    };
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const { data } = await api.get('/products');
      setProducts(data.filter((p) => p.visibility === true));
    } catch (err) {
      console.error('Failed to load products');
      setProducts([
        { _id: '1', name: 'Sample Product', price: 100, categoryId: { _id: 'cat1', name: 'Food & Beverages' }, stock: 10, visibility: true },
        { _id: '2', name: 'Another Product', price: 200, categoryId: { _id: 'cat2', name: 'Stationery' }, stock: 20, visibility: true },
      ]);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const { data } = await api.get('/categories');
      setCategories(data);
    } catch (err) {
      console.error('Failed to load categories');
      setCategories([
        { _id: 'cat1', name: 'Food & Beverages' },
        { _id: 'cat2', name: 'Stationery' },
        { _id: 'cat3', name: 'Electronics' },
      ]);
    }
  }, []);

  // Updated handlePlaceOrder to accept cash and changeAmount from CartDrawer
  const handlePlaceOrder = async (cash, changeAmount) => {
    if (cartItems.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    if (isNaN(cash) || cash < cartTotal) {
      toast.error(`Please enter amount of ₹${cartTotal.toFixed(2)} or more`);
      return;
    }

    try {
      setIsOrderConfirming(true);

      const orderItems = cartItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
      }));

      await api.post('/orders', {
        items: orderItems,
        amountReceived: cash,
        changeGiven: changeAmount,
      });

      toast.success(
        `Order placed successfully! Change: ₹${changeAmount.toFixed(2)} 🎉`,
        {
          duration: 4000,
        }
      );

      dispatch(clearCart());
      setShowCart(false);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Order failed');
    } finally {
      setIsOrderConfirming(false);
    }
  };

  const categoryCounts = useMemo(() => {
    const counts = {};
    products.forEach((p) => {
      const catId = p.categoryId?._id;
      if (catId) counts[catId] = (counts[catId] || 0) + 1;
    });
    return counts;
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(
      (p) =>
        p.name?.toLowerCase().includes(search.toLowerCase()) &&
        (!selectedCategory || String(p.categoryId?._id) === String(selectedCategory))
    );
  }, [products, search, selectedCategory]);

  const productsByCategory = useMemo(() => {
    if (selectedCategory || search) return null;
    const grouped = {};
    categories.forEach((cat) => {
      const catProducts = products.filter((p) => p.categoryId?._id === cat._id);
      if (catProducts.length) {
        grouped[cat._id] = { category: cat, products: catProducts };
      }
    });
    return grouped;
  }, [products, categories, selectedCategory, search]);

  const getCategoryIcon = (categoryName) => {
    return categoryIcons[categoryName] || categoryIcons.Default;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      
      {/* Modern Navbar */}
      <nav className="sticky top-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-800/50 shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
                <FiZap className="text-white text-xl" />
              </div>
              <div className="hidden xs:block">
                <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent">
                  APC Store
                </h1>
                <p className="text-[10px] uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-semibold">
                  Campus Store
                </p>
              </div>
            </motion.div>

            {/* Search Bar - Now full width on mobile */}
            <div className="flex-1 max-w-md relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
              <input
                type="text"
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 md:h-11 rounded-xl pl-9 pr-3 bg-gray-100 dark:bg-gray-800 border-0 focus:ring-2 focus:ring-indigo-500/30 text-sm font-medium transition-all"
              />
            </div>

            <div className="flex items-center gap-2">
              <motion.button
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.02 }}
                onClick={() => setShowCart(true)}
                className="relative h-10 md:h-11 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
              >
                <FiShoppingCart className="text-base" />
                <span className="hidden sm:inline text-sm">Cart</span>
                {cartCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-rose-500 border-2 border-white dark:border-gray-900 text-[10px] flex items-center justify-center font-bold"
                  >
                    {cartCount}
                  </motion.span>
                )}
              </motion.button>
            </div>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-6 pb-24">
        {/* Categories - Now without search bar above */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory('')}
              className={`group px-4 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
                !selectedCategory
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <FiGrid className="w-4 h-4" />
              All
              <span className={`text-xs px-2 py-0.5 rounded-full ${!selectedCategory ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                {products.length}
              </span>
            </button>
            {categories.map((cat) => {
              const Icon = getCategoryIcon(cat.name);
              const count = categoryCounts[cat._id] || 0;
              return (
                <button
                  key={cat._id}
                  onClick={() => setSelectedCategory(cat._id)}
                  className={`group px-4 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
                    selectedCategory === cat._id
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden xs:inline">{cat.name}</span>
                  <span className="xs:hidden">{cat.name.substring(0, 8)}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${selectedCategory === cat._id ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center">
            <div className="w-12 h-12 border-3 border-gray-200 border-t-indigo-600 rounded-full animate-spin" />
            <p className="mt-4 text-sm font-medium text-gray-500">Loading products...</p>
          </div>
        ) : (
          <>
            {!selectedCategory && !search && productsByCategory ? (
              <div className="space-y-12">
                {Object.values(productsByCategory).map(({ category, products: catProducts }) => (
                  <section key={category._id}>
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                          {(() => {
                            const Icon = getCategoryIcon(category.name);
                            return <Icon className="w-4 h-4" />;
                          })()}
                        </div>
                        <div>
                          <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                            {category.name}
                          </h2>
                          <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                            {catProducts.length} items available
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                      {catProducts.map((product) => (
                        <ProductCard key={product._id} product={product} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                <AnimatePresence mode="popLayout">
                  {filteredProducts.map((product) => (
                    <motion.div
                      key={product._id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ProductCard product={product} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </>
        )}

        {/* Empty State */}
        {!isLoading && filteredProducts.length === 0 && (
          <div className="py-16 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gray-100 dark:bg-gray-800 mx-auto flex items-center justify-center mb-4">
              <FiPackage className="text-3xl text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">No Products Found</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Try adjusting your search or category</p>
            <button
              onClick={() => {
                setSearch('');
                setSelectedCategory('');
              }}
              className="mt-5 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all"
            >
              Reset Filters
            </button>
          </div>
        )}
      </main>

      {/* Cart Drawer */}
      <CartDrawer
        open={showCart}
        onClose={() => setShowCart(false)}
        onCheckout={handlePlaceOrder}
        isProcessing={isOrderConfirming}
      />

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
        .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
        @media (min-width: 480px) { .xs\\:block { display: block; } .xs\\:inline { display: inline; } .xs\\:hidden { display: none; } }
      `}</style>
    </div>
  );
}

// Main export with password protection wrapper
export default function ConsumerPage() {
  return (
    <PasswordProtection pageName="APC Consumer Store">
      <ConsumerPageContent />
    </PasswordProtection>
  );
}