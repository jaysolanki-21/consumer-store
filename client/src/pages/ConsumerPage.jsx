import { useState, useEffect, useMemo, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { clearCart } from "../redux/slices/cartSlice";
import api from "../services/api";
import socket from "../services/socket";
import ProductCard from "../components/ProductCard";
import CartDrawer from "../components/CartDrawer";
import ThermalReceipt from "../components/ThermalReceipt";
import { useNavigate, useSearchParams } from "react-router-dom";
import { logout } from "../redux/slices/authSlice";
import ConsumerFilterSidebar from "../components/ConsumerFilterSidebar";
import MobileFilterDrawer from "../components/MobileFilterDrawer";

import {
  FiShoppingCart,
  FiSearch,
  FiPackage,
  FiZap,
  FiGrid,
  FiTag,
  FiCoffee,
  FiSmartphone,
  FiBook,
  FiLogOut,
  FiMonitor,
  FiFilter,
  FiSliders,
  FiX,
  FiRotateCcw,
  FiCheckCircle,
  FiAlertCircle,
  FiChevronDown,
} from "react-icons/fi";

const categoryIcons = {
  "Food & Beverages": FiCoffee,
  Electronics: FiSmartphone,
  Stationery: FiBook,
  Default: FiTag,
};

function ConsumerPageContent() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const cartItems = useSelector((state) => state.cart.items);
  const [user, setUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Receipt data — used only for silent print
  const [lastOrder, setLastOrder] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("counterToken");
    const userData = localStorage.getItem("counterUser");

    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        setIsLoggedIn(true);

        if (parsedUser.counterId) {
          socket.emit("joinCounterRoom", parsedUser.counterId);
        }
      } catch (err) {
        console.error("Failed to parse user data");
      }
    }
  }, []);

  const cartCount = useMemo(
    () => cartItems.reduce((acc, item) => acc + item.quantity, 0),
    [cartItems],
  );

  const cartTotal = useMemo(
    () => cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0),
    [cartItems],
  );

  const [searchParams, setSearchParams] = useSearchParams();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(
    () => searchParams.get("category") || ""
  );
  const [selectedCategories, setSelectedCategories] = useState(() => {
    const catsParam = searchParams.get("categories");
    if (catsParam) return catsParam.split(",").filter(Boolean);
    const singleCat = searchParams.get("category");
    return singleCat ? [singleCat] : [];
  });
  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  const [minPrice, setMinPrice] = useState(() => searchParams.get("minPrice") || "");
  const [maxPrice, setMaxPrice] = useState(() => searchParams.get("maxPrice") || "");
  const [stockAvailability, setStockAvailability] = useState(
    () => searchParams.get("stock") || "ALL"
  );
  const [sortBy, setSortBy] = useState(() => searchParams.get("sort") || "relevance");

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [isOrderConfirming, setIsOrderConfirming] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Sync state to URL params cleanly
  useEffect(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (selectedCategories.length === 1) {
      params.set("category", selectedCategories[0]);
    } else if (selectedCategories.length > 1) {
      params.set("categories", selectedCategories.join(","));
    }
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    if (stockAvailability && stockAvailability !== "ALL") {
      params.set("stock", stockAvailability);
    }
    if (sortBy && sortBy !== "relevance") {
      params.set("sort", sortBy);
    }

    setSearchParams(params, { replace: true });
  }, [search, selectedCategories, minPrice, maxPrice, stockAvailability, sortBy, setSearchParams]);

  useEffect(() => {
    document.body.style.overflow = showCart ? "hidden" : "auto";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [showCart]);

  const fetchProducts = useCallback(async () => {
    try {
      const { data } = await api.get("/products");
      setProducts(data.filter((p) => p.visibility === true));
    } catch (err) {
      console.error("Failed to load products");
      setProducts([
        {
          _id: "1",
          name: "Sample Product",
          price: 100,
          categoryId: { _id: "cat1", name: "Food & Beverages" },
          stock: 10,
          visibility: true,
        },
        {
          _id: "2",
          name: "Another Product",
          price: 200,
          categoryId: { _id: "cat2", name: "Stationery" },
          stock: 20,
          visibility: true,
        },
      ]);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const { data } = await api.get("/categories");
      setCategories(data);
    } catch (err) {
      console.error("Failed to load categories");
      setCategories([
        { _id: "cat1", name: "Food & Beverages" },
        { _id: "cat2", name: "Stationery" },
        { _id: "cat3", name: "Electronics" },
      ]);
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([fetchProducts(), fetchCategories()]);
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();

    const handleStockUpdate = () => {
      fetchProducts();
    };

    socket.on("stockUpdated", handleStockUpdate);

    return () => {
      socket.off("stockUpdated", handleStockUpdate);
    };
  }, [fetchProducts, fetchCategories]);

  // Sync counter profile & status with backend
  const fetchMyCounterData = useCallback(async () => {
    try {
      const { data } = await api.get("/counters");
      const currentEmail = user?.email;
      const me = data.find((c) => c.userId?.email === currentEmail || c.userId?._id === user?._id);
      if (me && me.userId) {
        setUser((prev) => ({ ...prev, ...me.userId, name: me.name, counterName: me.name }));
      }
    } catch (e) {}
  }, [user?.email, user?._id]);

  useEffect(() => {
    fetchMyCounterData();
    socket.on("countersUpdated", fetchMyCounterData);
    socket.on("usersUpdated", fetchMyCounterData);
    return () => {
      socket.off("countersUpdated", fetchMyCounterData);
      socket.off("usersUpdated", fetchMyCounterData);
    };
  }, [fetchMyCounterData]);

  const handleLogout = () => {
    if (cartItems.length > 0) {
      toast.error("Please clear cart before logging out");
      return;
    }

    if (user && user._id) {
      socket.emit("userDisconnected", user._id);
    }

    localStorage.removeItem("counterToken");
    localStorage.removeItem("counterUser");
    setUser(null);
    setIsLoggedIn(false);
    dispatch(logout());
    toast.success("Logged out successfully");
    navigate("/login");
  };

  // ─── CASH payment handler (unchanged) ─────────────────────────────────────
  const handlePlaceOrder = async (cash, changeAmount) => {
    if (cartItems.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    if (!user || (!user.counterId && !user._id)) {
      toast.error("Counter not identified. Please login again.");
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
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      }));

      const counterDisplayName = user?.counter?.name || user?.counterName || user?.name || "Counter 1";

      const { data } = await api.post("/orders", {
        items: orderItems,
        counter: user.counter?._id || user.counterId || user._id,
        counterId: user.counter?._id || user.counterId || user._id,
        counterName: counterDisplayName,
        payment: {
          method: "Cash",
          receivedAmount: cash,
          changeReturned: changeAmount,
          status: "Paid"
        }
      });

      const receiptOrder = {
        _id: data?._id || data?.orderId || `ORD${Date.now()}`,
        items: orderItems,
        totalAmount: cartTotal,
        amountReceived: cash,
        changeGiven: changeAmount,
        paymentMethod: "CASH",
        createdAt: new Date().toISOString(),
        customerName: null,
        counter: data?.counter || user?.counter || { name: counterDisplayName },
        counterName: data?.counterName || counterDisplayName,
      };

      setLastOrder(receiptOrder);

      toast.success(
        `Order placed successfully! Change: ₹${changeAmount.toFixed(2)} 🎉`,
        { duration: 4000 },
      );

      dispatch(clearCart());
      setShowCart(false);

      // Silent print — no popup
      setTimeout(() => {
        window.print();
      }, 400);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Order failed");
    } finally {
      setIsOrderConfirming(false);
    }
  };

  // ─── ONLINE payment handler (Cashfree) ────────────────────────────────────
  const handleOnlineCheckout = async () => {
    if (cartItems.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    if (!user || (!user.counterId && !user._id)) {
      toast.error("Counter not identified. Please login again.");
      return;
    }

    try {
      setIsOrderConfirming(true);

      const orderItems = cartItems.map((item) => ({
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      }));

      const counterDisplayName = user?.counter?.name || user?.counterName || user?.name || "Counter 1";

      // Step 1: Create order + Cashfree session (backend calculates amount)
      const { data: sessionData } = await api.post(
        "/payments/cashfree/create-session",
        {
          items: orderItems,
          counter: user.counter?._id || user.counterId || user._id,
          counterId: user.counter?._id || user.counterId || user._id,
          counterName: counterDisplayName,
          staffId: user._id || null,
          staffName: user.name || "",
        }
      );

      const { orderId, cfOrderId, paymentSessionId } = sessionData;

      // Step 2: Load Cashfree JS SDK and open checkout
      const { load } = await import("@cashfreepayments/cashfree-js");

      const cashfree = await load({
        mode:
          import.meta.env.VITE_CASHFREE_ENV === "production"
            ? "production"
            : "sandbox",
      });

      // Step 3: Open Cashfree checkout
      await new Promise((resolve, reject) => {
        cashfree.checkout({
          paymentSessionId,
          redirectTarget: "_modal",
        }).then(async (result) => {
          if (result.error) {
            // User cancelled or payment error occurred in modal
            console.error("Cashfree checkout error:", result.error);
            reject(new Error(result.error.message || "Payment failed"));
            return;
          }

          if (result.paymentDetails) {
            // Payment attempt was made — verify with backend (never trust frontend)
            resolve(result.paymentDetails);
          } else {
            // Modal closed without a clear outcome — still verify
            resolve(null);
          }
        }).catch(reject);
      });

      // Step 4: Verify payment on backend (always — regardless of frontend result)
      const { data: verifyData } = await api.post(
        "/payments/cashfree/verify",
        { orderId, cfOrderId }
      );

      if (verifyData.success) {
        // Payment verified as PAID — order is now Pending (awaiting staff/admin confirm)
        const order = verifyData.order;

        const receiptOrder = {
          _id: order._id,
          items: cartItems.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
          })),
          totalAmount: order.totalAmount,
          amountReceived: order.totalAmount,
          changeGiven: 0,
          paymentMethod: "ONLINE",
          paymentStatus: "PAID",
          createdAt: order.createdAt,
          customerName: null,
          counter: order.counter || user?.counter || { name: counterDisplayName },
          counterName: order.counterName || counterDisplayName,
        };

        setLastOrder(receiptOrder);

        toast.success("Payment successful! Order placed 🎉", { duration: 4000 });

        dispatch(clearCart());
        setShowCart(false);

        // Silent print
        setTimeout(() => {
          window.print();
        }, 400);
      } else {
        toast.error(
          verifyData.message ||
            "Payment failed. Please try again or choose Cash.",
          { duration: 5000 }
        );
      }
    } catch (err) {
      console.error("Online checkout error:", err);

      // User-friendly error messages only
      const errMsg = err?.response?.data?.message || err?.message || "";

      if (
        errMsg.toLowerCase().includes("unavailable") ||
        errMsg.toLowerCase().includes("temporarily")
      ) {
        toast.error(
          "Online payment is temporarily unavailable. Please try again or choose Cash.",
          { duration: 5000 }
        );
      } else {
        toast.error(
          "Payment failed. Please try again or choose Cash.",
          { duration: 5000 }
        );
      }
    } finally {
      setIsOrderConfirming(false);
    }
  };

  // Category counts based on visible products
  const categoryCounts = useMemo(() => {
    const counts = {};
    products.forEach((p) => {
      const catId = p.categoryId?._id;
      if (catId) counts[catId] = (counts[catId] || 0) + 1;
    });
    return counts;
  }, [products]);

  // Real availability stock counts
  const availabilityCounts = useMemo(() => {
    let inStock = 0;
    let lowStock = 0;
    let outOfStock = 0;

    products.forEach((p) => {
      const avail = p.availableStock ?? (p.stock - (p.reservedStock || 0));
      if (avail <= 0) {
        outOfStock++;
      } else if (avail <= p.lowStockThreshold) {
        lowStock++;
      } else {
        inStock++;
      }
    });

    return {
      all: products.length,
      inStock,
      lowStock,
      outOfStock,
    };
  }, [products]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCategories.length > 0) count += selectedCategories.length;
    if (minPrice !== "" || maxPrice !== "") count += 1;
    if (stockAvailability !== "ALL") count += 1;
    return count;
  }, [selectedCategories, minPrice, maxPrice, stockAvailability]);

  // Filtering + Sorting pipeline
  const filteredProducts = useMemo(() => {
    let result = products.filter((p) => {
      // 1. Search filter
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesName = p.name?.toLowerCase().includes(query);
        const matchesCategory = p.categoryId?.name?.toLowerCase().includes(query);
        if (!matchesName && !matchesCategory) return false;
      }

      // 2. Category filter (multiple checkboxes or single selection from top pill bar)
      if (selectedCategories.length > 0) {
        const pCatId = String(p.categoryId?._id || p.categoryId);
        if (!selectedCategories.includes(pCatId)) return false;
      } else if (selectedCategory) {
        const pCatId = String(p.categoryId?._id || p.categoryId);
        if (pCatId !== String(selectedCategory)) return false;
      }

      // 3. Price filter
      const price = Number(p.price);
      if (minPrice !== "" && !isNaN(Number(minPrice)) && price < Number(minPrice)) {
        return false;
      }
      if (maxPrice !== "" && !isNaN(Number(maxPrice)) && price > Number(maxPrice)) {
        return false;
      }

      // 4. Stock Availability filter
      const avail = p.availableStock ?? (p.stock - (p.reservedStock || 0));
      if (stockAvailability === "IN_STOCK" && avail <= 0) return false;
      if (stockAvailability === "LOW_STOCK" && !(avail > 0 && avail <= p.lowStockThreshold)) return false;
      if (stockAvailability === "OUT_OF_STOCK" && avail > 0) return false;

      return true;
    });

    // 5. Sorting
    result = [...result].sort((a, b) => {
      if (sortBy === "price_asc") return Number(a.price) - Number(b.price);
      if (sortBy === "price_desc") return Number(b.price) - Number(a.price);
      if (sortBy === "name_asc") return (a.name || "").localeCompare(b.name || "");
      if (sortBy === "name_desc") return (b.name || "").localeCompare(a.name || "");
      if (sortBy === "newest") return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      return 0; // relevance / default order
    });

    return result;
  }, [products, search, selectedCategory, selectedCategories, minPrice, maxPrice, stockAvailability, sortBy]);

  // Category toggle handler for drawer
  const handleToggleCategory = (catId) => {
    setSelectedCategories((prev) => {
      if (prev.includes(catId)) {
        return prev.filter((id) => id !== catId);
      } else {
        return [...prev, catId];
      }
    });
    // Reset the single tab pill selection if using multiple checkbox filters
    setSelectedCategory("");
  };

  // Top pill category click handler (seamless two-way sync)
  const handleSelectPillCategory = (catId) => {
    setSelectedCategory(catId);
    if (catId) {
      setSelectedCategories([catId]);
    } else {
      setSelectedCategories([]);
    }
  };

  const handlePriceChange = (min, max) => {
    setMinPrice(min);
    setMaxPrice(max);
  };

  const handleResetAllFilters = () => {
    setSearch("");
    setSelectedCategory("");
    setSelectedCategories([]);
    setMinPrice("");
    setMaxPrice("");
    setStockAvailability("ALL");
    setSortBy("relevance");
  };

  // Products grouped by category (only when no filters or search is applied)
  const productsByCategory = useMemo(() => {
    const isFiltered =
      selectedCategory ||
      selectedCategories.length > 0 ||
      search.trim() ||
      minPrice !== "" ||
      maxPrice !== "" ||
      stockAvailability !== "ALL" ||
      sortBy !== "relevance";

    if (isFiltered) return null;

    const grouped = {};
    categories.forEach((cat) => {
      const catProducts = products.filter((p) => p.categoryId?._id === cat._id);
      if (catProducts.length) {
        grouped[cat._id] = { category: cat, products: catProducts };
      }
    });
    return grouped;
  }, [products, categories, selectedCategory, selectedCategories, search, minPrice, maxPrice, stockAvailability, sortBy]);

  const getCategoryIcon = (categoryName) => {
    return categoryIcons[categoryName] || categoryIcons.Default;
  };

  if (!isLoggedIn) {
    navigate("/login");
    return null;
  }

  const counterDisplayName = user?.counter?.name || user?.counterName || user?.name || "Counter 1";

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      <nav className="sticky top-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-800/50 shadow-sm print:hidden">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 flex-shrink-0"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
                <FiZap className="text-white text-xl" />
              </div>
              <div className="hidden xs:block">
                <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent">
                  APC Store
                </h1>
              </div>
            </motion.div>

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

            <div className="flex items-center gap-2 flex-shrink-0">
              

              

              <button
                onClick={handleLogout}
                className="h-10 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 font-semibold flex items-center gap-1 transition-all"
              >
                <FiLogOut className="text-base" />
                <span className="hidden sm:inline text-sm">Logout</span>
              </button>

              <button
                onClick={() => setShowCart(true)}
                className="relative h-10 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
              >
                <FiShoppingCart className="text-base" />
                <span className="hidden sm:inline text-sm">Cart</span>
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-rose-500 border-2 border-white dark:border-gray-900 text-[10px] flex items-center justify-center font-bold">
                    {cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-6 pb-24 print:hidden">
        {/* Top Category Navigation Pills Bar */}
        <div className="mb-6 overflow-x-auto pb-1 scrollbar-none">
          <div className="flex items-center gap-2 min-w-max">
            <button
              onClick={() => handleSelectPillCategory("")}
              className={`group px-3.5 py-2 rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center gap-2 ${
                !selectedCategory && selectedCategories.length === 0
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30"
                  : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750"
              }`}
            >
              <FiGrid className="w-4 h-4" />
              All
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                  !selectedCategory && selectedCategories.length === 0
                    ? "bg-white/20 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                }`}
              >
                {products.length}
              </span>
            </button>

            {categories.map((cat) => {
              const Icon = getCategoryIcon(cat.name);
              const count = categoryCounts[cat._id] || 0;
              const isCatActive =
                selectedCategory === cat._id ||
                selectedCategories.includes(cat._id);

              return (
                <button
                  key={cat._id}
                  onClick={() => handleSelectPillCategory(cat._id)}
                  className={`group px-3.5 py-2 rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center gap-2 ${
                    isCatActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30"
                      : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{cat.name}</span>
                  <span
                    className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                      isCatActive
                        ? "bg-white/20 text-white"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2-Column E-Commerce Layout: Permanent Left Sidebar + Right Product Area */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Permanent Desktop Filter Sidebar (hidden on mobile/tablet < lg) */}
          <div className="hidden lg:block">
            <ConsumerFilterSidebar
              categories={categories}
              categoryCounts={categoryCounts}
              selectedCategories={selectedCategories}
              onToggleCategory={handleToggleCategory}
              onSelectAllCategories={() => setSelectedCategories([])}
              minPrice={minPrice}
              maxPrice={maxPrice}
              onPriceChange={handlePriceChange}
              stockAvailability={stockAvailability}
              onStockAvailabilityChange={setStockAvailability}
              availabilityCounts={availabilityCounts}
              onResetFilters={handleResetAllFilters}
              activeFilterCount={activeFilterCount}
            />
          </div>

          {/* Right Product Content Area */}
          <div className="flex-1 w-full min-w-0">
            {/* Product Toolbar: Count + Mobile Filter Trigger + Sort Dropdown */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 mb-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                {/* Result Count */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-800 dark:text-white">
                    {filteredProducts.length}{" "}
                    {filteredProducts.length === 1 ? "Product" : "Products"}
                  </span>
                  {products.length > 0 && (
                    <span className="text-xs text-slate-400 font-normal">
                      (of {products.length})
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Mobile-Only Filter Button */}
                  <button
                    onClick={() => setIsFilterOpen(true)}
                    className={`lg:hidden h-9 px-3 rounded-xl font-semibold text-xs flex items-center gap-1.5 border transition-all ${
                      activeFilterCount > 0
                        ? "bg-indigo-50 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300"
                        : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <FiFilter className={`text-sm ${activeFilterCount > 0 ? "text-indigo-600 dark:text-indigo-400" : "text-gray-500"}`} />
                    <span>Filters</span>
                    {activeFilterCount > 0 && (
                      <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>

                  {/* Sort By Dropdown */}
                  <div className="relative">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="h-9 pl-3 pr-8 rounded-xl font-medium text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer"
                    >
                      <option value="relevance">Sort: Relevance</option>
                      <option value="price_asc">Price: Low to High</option>
                      <option value="price_desc">Price: High to Low</option>
                      <option value="name_asc">Name: A to Z</option>
                      <option value="name_desc">Name: Z to A</option>
                      <option value="newest">Newest First</option>
                    </select>
                    <FiChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-xs" />
                  </div>
                </div>
              </div>

              {/* Active Filter Chips */}
              {(selectedCategories.length > 0 || minPrice !== "" || maxPrice !== "" || stockAvailability !== "ALL") && (
                <div className="flex flex-wrap items-center gap-1.5 pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/80">
                  <span className="text-xs text-slate-400 font-medium mr-1">Active:</span>

                  {/* Category Chips */}
                  {selectedCategories.map((catId) => {
                    const catObj = categories.find((c) => c._id === catId);
                    return (
                      <span
                        key={catId}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                      >
                        <span>{catObj ? catObj.name : "Category"}</span>
                        <button
                          type="button"
                          onClick={() => handleToggleCategory(catId)}
                          className="hover:text-indigo-900 dark:hover:text-white"
                        >
                          <FiX className="text-xs" />
                        </button>
                      </span>
                    );
                  })}

                  {/* Price Chip */}
                  {(minPrice !== "" || maxPrice !== "") && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      <span>
                        ₹{minPrice || "0"} - {maxPrice ? `₹${maxPrice}` : "Any"}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setMinPrice("");
                          setMaxPrice("");
                        }}
                        className="hover:text-indigo-900 dark:hover:text-white"
                      >
                        <FiX className="text-xs" />
                      </button>
                    </span>
                  )}

                  {/* Stock Availability Chip */}
                  {stockAvailability !== "ALL" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      <span>
                        {stockAvailability === "IN_STOCK"
                          ? "In Stock"
                          : stockAvailability === "LOW_STOCK"
                          ? "Low Stock"
                          : "Out of Stock"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setStockAvailability("ALL")}
                        className="hover:text-indigo-900 dark:hover:text-white"
                      >
                        <FiX className="text-xs" />
                      </button>
                    </span>
                  )}

                  {/* Clear All Button */}
                  <button
                    type="button"
                    onClick={handleResetAllFilters}
                    className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 px-2 py-0.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition flex items-center gap-1 ml-auto"
                  >
                    <FiRotateCcw className="text-[10px]" />
                    Clear All
                  </button>
                </div>
              )}
            </div>

            {/* Product Grid Area */}
            {isLoading ? (
              <div className="py-20 flex flex-col items-center">
                <div className="w-12 h-12 border-3 border-gray-200 border-t-indigo-600 rounded-full animate-spin" />
                <p className="mt-4 text-sm font-medium text-gray-500">
                  Loading products...
                </p>
              </div>
            ) : (
              <>
                {!selectedCategory && !search && productsByCategory ? (
                  <div className="space-y-12">
                    {Object.values(productsByCategory).map(
                      ({ category, products: catProducts }) => (
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
                          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
                            {catProducts.map((product) => (
                              <ProductCard key={product._id} product={product} />
                            ))}
                          </div>
                        </section>
                      ),
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
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
              <div className="py-16 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                <div className="w-20 h-20 rounded-2xl bg-gray-100 dark:bg-gray-800 mx-auto flex items-center justify-center mb-4">
                  <FiPackage className="text-3xl text-gray-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  No Products Found
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto text-sm">
                  No products match your active filters or search criteria. Try adjusting your filters or resetting them.
                </p>
                <button
                  onClick={handleResetAllFilters}
                  className="mt-5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all inline-flex items-center gap-2"
                >
                  <FiRotateCcw className="text-sm" />
                  <span>Clear All Filters</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Mobile Filter Drawer (Bottom Sheet) */}
      <MobileFilterDrawer
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        categories={categories}
        categoryCounts={categoryCounts}
        selectedCategories={selectedCategories}
        onToggleCategory={handleToggleCategory}
        onSelectAllCategories={() => setSelectedCategories([])}
        minPrice={minPrice}
        maxPrice={maxPrice}
        onPriceChange={handlePriceChange}
        stockAvailability={stockAvailability}
        onStockAvailabilityChange={setStockAvailability}
        availabilityCounts={availabilityCounts}
        onResetFilters={handleResetAllFilters}
        activeFilterCount={activeFilterCount}
        matchingProductsCount={filteredProducts.length}
      />

      <CartDrawer
        open={showCart}
        onClose={() => setShowCart(false)}
        onCheckout={handlePlaceOrder}
        onOnlineCheckout={handleOnlineCheckout}
        isProcessing={isOrderConfirming}
      />

      {/* ✅ Silent print target — invisible on screen, only prints */}
      {lastOrder && (
        <div className="hidden print:block">
          <ThermalReceipt order={lastOrder} counter={user?.counter || { counterName: counterDisplayName, name: counterDisplayName }} />
        </div>
      )}

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
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

export default function ConsumerPage() {
  return <ConsumerPageContent />;
}