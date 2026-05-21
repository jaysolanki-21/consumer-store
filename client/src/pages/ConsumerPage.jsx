import { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { clearCart, setCustomerInfo } from '../redux/slices/cartSlice';
import api from '../services/api';
import socket from '../services/socket';
import ProductCard from '../components/ProductCard';
import CartDrawer from '../components/CartDrawer';

import {
  FiShoppingCart,
  FiSearch,
  FiUser,
  FiPackage,
  FiAlertCircle,
  FiZap,
  FiTrendingUp,
  FiGrid,
  FiChevronRight,
  FiHome,
  FiTag,
  FiCoffee,
  FiSmartphone,
  FiBook,
  FiHeart,
} from 'react-icons/fi';

// Icon mapping for categories
const categoryIcons = {
  'Food & Beverages': FiCoffee,
  'Electronics': FiSmartphone,
  'Stationery': FiBook,
  'Default': FiTag,
};

export default function ConsumerPage() {
  const dispatch = useDispatch();

  const cartItems = useSelector((state) => state.cart.items);
  const savedRollNumber = useSelector(
    (state) => state.cart.rollNumber || ''
  );

  const cartCount = cartItems.reduce(
    (acc, item) => acc + item.quantity,
    0
  );

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [search, setSearch] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [rollNumber, setRollNumber] = useState(savedRollNumber);
  const [isOrderConfirming, setIsOrderConfirming] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);

      try {
        await Promise.all([
          fetchProducts(),
          fetchCategories(),
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    socket.on('stockUpdated', fetchProducts);

    return () => socket.off('stockUpdated');
  }, []);

  const fetchProducts = async () => {
    try {
      const { data } = await api.get('/products');

      setProducts(data.filter((p) => p.visibility === true));
    } catch (err) {
      toast.error('Failed to load products');
    }
  };

  const fetchCategories = async () => {
    try {
      const { data } = await api.get('/categories');
      setCategories(data);
    } catch (err) {
      toast.error('Failed to load categories');
    }
  };

  const handleRollNumberChange = (val) => {
    const formatted = val.trim().toUpperCase();

    setRollNumber(formatted);

    dispatch(
      setCustomerInfo({
        rollNumber: formatted,
      })
    );
  };

  const handlePlaceOrder = async () => {
    if (!rollNumber) {
      toast.error('Please enter Roll Number');

      const input = document.getElementById(
        'session-roll-input'
      );

      input?.focus();
      input?.classList.add('animate-shake');

      setTimeout(() => {
        input?.classList.remove('animate-shake');
      }, 500);

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
        rollNumber,
        items: orderItems,
      });

      toast.success('Order placed successfully');

      dispatch(clearCart());

      setShowCart(false);
    } catch (err) {
      toast.error(
        err.response?.data?.message || 'Order failed'
      );
    } finally {
      setIsOrderConfirming(false);
    }
  };

  const categoryCounts = useMemo(() => {
    const counts = {};

    products.forEach((p) => {
      const catId = p.categoryId?._id;

      if (catId) {
        counts[catId] = (counts[catId] || 0) + 1;
      }
    });

    return counts;
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(
      (p) =>
        p.name
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (!selectedCategory ||
          p.categoryId?._id === selectedCategory)
    );
  }, [products, search, selectedCategory]);

  const productsByCategory = useMemo(() => {
    if (selectedCategory || search) return null;

    const grouped = {};

    categories.forEach((cat) => {
      const catProducts = products.filter(
        (p) => p.categoryId?._id === cat._id
      );

      if (catProducts.length) {
        grouped[cat._id] = {
          category: cat,
          products: catProducts,
        };
      }
    });

    return grouped;
  }, [products, categories, selectedCategory, search]);

  // Get icon for category
  const getCategoryIcon = (categoryName) => {
    const Icon = categoryIcons[categoryName] || categoryIcons.Default;
    return <Icon className="w-4 h-4" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      
      {/* Modern Navbar */}
      <nav className="sticky top-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-800/50 shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            {/* Logo - Mobile Optimized */}
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

            {/* Roll Number Input - Responsive */}
            <div className="flex-1 max-w-xs md:max-w-md relative">
              <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
              <input
                id="session-roll-input"
                type="text"
                placeholder="Roll Number"
                value={rollNumber}
                onChange={(e) => handleRollNumberChange(e.target.value)}
                className="w-full h-10 md:h-11 rounded-xl pl-9 pr-3 bg-gray-100 dark:bg-gray-800 border-0 focus:ring-2 focus:ring-indigo-500/30 text-sm font-medium transition-all"
              />
            </div>

            {/* Cart Button */}
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
      </nav>

      <main className="container mx-auto px-4 py-6 pb-24">
        {/* Search Bar - Enhanced */}
        <div className="relative max-w-2xl mx-auto mb-8">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-12 md:h-14 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 pl-12 pr-5 text-base font-medium outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-sm transition-all"
          />
        </div>

        {/* Categories - Horizontal Scroll with Better Mobile UX */}
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
      <span
        className={`text-xs px-2 py-0.5 rounded-full ${
          !selectedCategory
            ? 'bg-white/20 text-white'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
        }`}
      >
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
          {Icon}
          <span className="hidden xs:inline">{cat.name}</span>
          <span className="xs:hidden">
            {cat.name.substring(0, 8)}
          </span>

          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              selectedCategory === cat._id
                ? 'bg-white/20 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}
          >
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
            {/* Category Group View */}
            {!selectedCategory && !search && productsByCategory ? (
              <div className="space-y-12">
                {Object.values(productsByCategory).map(({ category, products: catProducts }) => (
                  <section key={category._id}>
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                          {getCategoryIcon(category.name)}
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
                      {/* View All removed as requested */}
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
              /* Filtered Products Grid */
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

      {/* Roll Number Warning - Perfectly Centered */}
      <AnimatePresence>
        {!rollNumber && rollNumber !== undefined && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{
              type: "spring",
              stiffness: 500,
              damping: 30,
            }}
            className="fixed inset-x-0 bottom-6 z-50 flex justify-center items-center px-4"
          >
            <div className="w-full max-w-md">
              <div className="rounded-2xl bg-gray-900/95 dark:bg-gray-800/95 backdrop-blur-xl text-white p-4 shadow-2xl border border-gray-700/50">
                <div className="flex items-center gap-3">
                  
                  {/* Icon */}
                  <div className="w-11 h-11 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <FiAlertCircle className="text-amber-400 text-xl" />
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">
                      Roll Number Required
                    </p>

                    <p className="text-xs text-gray-400 leading-relaxed">
                      Please enter your roll number before checkout
                    </p>
                  </div>

                  {/* Button */}
                  <button
                    onClick={() => {
                      const input = document.getElementById(
                        'session-roll-input'
                      );

                      input?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                      });

                      setTimeout(() => {
                        input?.focus();
                      }, 400);
                    }}
                    className="h-10 px-4 rounded-xl bg-white text-gray-900 text-xs font-bold hover:bg-gray-100 transition-all duration-200 active:scale-95 whitespace-nowrap"
                  >
                    Enter Now
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        
        .animate-shake {
          animation: shake 0.2s ease-in-out 0s 2;
        }
        
        @media (min-width: 480px) {
          .xs\\:block {
            display: block;
          }
          .xs\\:inline {
            display: inline;
          }
          .xs\\:hidden {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}