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
} from 'react-icons/fi';

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

  return (
    <div className="min-h-screen bg-[#f4f7fb] dark:bg-[#020617] overflow-x-hidden">

      {/* Background Effects */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-indigo-500/10 blur-3xl rounded-full" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-cyan-500/10 blur-3xl rounded-full" />
      </div>

      {/* Navbar */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 dark:bg-slate-950/70 border-b border-white/20 dark:border-slate-800">
        <div className="max-w-7xl mx-auto h-20 px-4 flex items-center justify-between gap-4">

          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-cyan-500 flex items-center justify-center shadow-xl shadow-indigo-500/30">
              <FiZap className="text-white text-2xl" />
            </div>

            <div className="hidden sm:block">
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                APC STORE
              </h1>
              <p className="text-[11px] uppercase tracking-[0.25em] text-indigo-500 font-bold">
                Smart Campus Store
              </p>
            </div>
          </motion.div>

          {/* Roll Number */}
          <div className="flex-1 max-w-md relative">
            <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

            <input
              id="session-roll-input"
              type="text"
              placeholder="Enter Roll Number"
              value={rollNumber}
              onChange={(e) =>
                handleRollNumberChange(e.target.value)
              }
              className="w-full h-12 rounded-2xl pl-11 pr-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 text-sm font-semibold shadow-lg"
            />
          </div>

          {/* Cart */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.03 }}
            onClick={() => setShowCart(true)}
            className="relative h-12 px-5 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-700 dark:from-indigo-600 dark:to-cyan-500 text-white font-bold flex items-center gap-2 shadow-xl"
          >
            <FiShoppingCart className="text-lg" />
            <span className="hidden sm:block">
              Checkout
            </span>

            {cartCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-rose-500 border-2 border-white dark:border-slate-900 text-[11px] flex items-center justify-center font-black"
              >
                {cartCount}
              </motion.span>
            )}
          </motion.button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">

        {/* Hero */}
        {/* <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-500 p-8 md:p-12 text-white shadow-2xl mb-10"
        >
           <div className="absolute right-0 top-0 w-72 h-72 bg-white/10 rounded-full blur-3xl" />

          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md mb-5 text-sm font-bold">
              <FiTrendingUp />
              Real-Time Inventory
            </div>

            <h1 className="text-4xl md:text-6xl font-black leading-tight">
              Smart Ordering
              <br />
              For Students
            </h1>

            <p className="mt-5 text-indigo-100 text-base md:text-lg">
              Fast campus shopping experience with
              real-time stock updates, instant checkout,
              and modern UI.
            </p>
          </div> 
        </motion.div> */}

        {/* Search */}
        <div className="relative max-w-2xl mx-auto mb-8">
          <FiSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 text-xl" />

          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-16 rounded-[1.5rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 pl-14 pr-5 text-base font-semibold outline-none focus:ring-4 focus:ring-indigo-500/10 shadow-xl"
          />
        </div>

        {/* Categories */}
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 mb-12">
          <button
            onClick={() => setSelectedCategory('')}
            className={`px-6 h-12 rounded-2xl font-bold whitespace-nowrap transition-all ${
              !selectedCategory
                ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/30'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <FiGrid />
              All Products
            </div>
          </button>

          {categories.map((cat) => (
            <button
              key={cat._id}
              onClick={() =>
                setSelectedCategory(cat._id)
              }
              className={`px-6 h-12 rounded-2xl font-bold whitespace-nowrap transition-all ${
                selectedCategory === cat._id
                  ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/30'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {cat.name}

                <span className="text-xs px-2 py-1 rounded-lg bg-black/10 dark:bg-white/10">
                  {categoryCounts[cat._id] || 0}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Loading */}
        {isLoading ? (
          <div className="py-40 flex flex-col items-center">
            <div className="w-14 h-14 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />

            <p className="mt-4 text-sm font-bold text-slate-500">
              Loading inventory...
            </p>
          </div>
        ) : (
          <>
            {!selectedCategory &&
            !search &&
            productsByCategory ? (
              <div className="space-y-16">
                {Object.values(productsByCategory).map(
                  ({ category, products: catProducts }) => (
                    <section key={category._id}>
                      <div className="flex items-center justify-between mb-8">
                        <div>
                          <h2 className="text-3xl font-black text-slate-900 dark:text-white">
                            {category.name}
                          </h2>

                          <p className="text-sm font-semibold text-indigo-500 mt-1">
                            Featured Collection
                          </p>
                        </div>

                        <button className="flex items-center gap-2 text-sm font-bold text-indigo-600">
                          View All
                          <FiChevronRight />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                        {catProducts.map((product) => (
                          <ProductCard
                            key={product._id}
                            product={product}
                          />
                        ))}
                      </div>
                    </section>
                  )
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                <AnimatePresence mode="popLayout">
                  {filteredProducts.map((product) => (
                    <motion.div
                      key={product._id}
                      layout
                      initial={{
                        opacity: 0,
                        scale: 0.9,
                      }}
                      animate={{
                        opacity: 1,
                        scale: 1,
                      }}
                      exit={{
                        opacity: 0,
                        scale: 0.9,
                      }}
                    >
                      <ProductCard product={product} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </>
        )}

        {/* Empty */}
        {!isLoading && filteredProducts.length === 0 && (
          <div className="py-32 text-center">
            <div className="w-24 h-24 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 mx-auto flex items-center justify-center shadow-xl mb-6">
              <FiPackage className="text-5xl text-slate-300" />
            </div>

            <h2 className="text-2xl font-black">
              No Products Found
            </h2>

            <p className="text-slate-500 mt-2">
              Try another keyword or category.
            </p>

            <button
              onClick={() => {
                setSearch('');
                setSelectedCategory('');
              }}
              className="mt-6 px-6 h-12 rounded-2xl bg-indigo-600 text-white font-bold shadow-xl"
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

      {/* Roll Warning */}
      <AnimatePresence>
        {!rollNumber && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md"
          >
            <div className="rounded-3xl bg-slate-900 text-white p-4 shadow-2xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center">
                  <FiAlertCircle className="text-amber-400 text-xl" />
                </div>

                <div>
                  <p className="font-bold text-sm">
                    Roll Number Required
                  </p>

                  <p className="text-xs text-slate-400">
                    Enter your roll number before checkout
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  window.scrollTo({
                    top: 0,
                    behavior: 'smooth',
                  });

                  setTimeout(() => {
                    document
                      .getElementById(
                        'session-roll-input'
                      )
                      ?.focus();
                  }, 500);
                }}
                className="h-10 px-4 rounded-xl bg-white text-slate-900 text-xs font-black"
              >
                FIX
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }

        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        @keyframes shake {
          0%,
          100% {
            transform: translateX(0);
          }

          25% {
            transform: translateX(-5px);
          }

          75% {
            transform: translateX(5px);
          }
        }

        .animate-shake {
          animation: shake 0.2s ease-in-out 0s 2;
        }
      `}</style>
    </div>
  );
}