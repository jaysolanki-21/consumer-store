import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
import { useTheme } from "../hooks/useTheme";

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
  FiSun,
  FiMoon,
  FiLogOut,
  FiMonitor,
  FiFilter,
  FiSliders,
  FiX,
  FiRotateCcw,
  FiCheckCircle,
  FiAlertCircle,
  FiChevronDown,
  FiPrinter,
  FiClock,
  FiEye,
  FiRefreshCw,
  FiCalendar,
  FiDollarSign,
  FiCheck,
  FiList,
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
  const { theme, toggleTheme } = useTheme();

  const cartItems = useSelector((state) => state.cart.items);
  const [user, setUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Receipt data — used only for silent print
  const [lastOrder, setLastOrder] = useState(null);

  // ─── Today's Orders & Reprint States ──────────────────────────────────────
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [showTodayOrders, setShowTodayOrders] = useState(false);
  const [selectedOrderForView, setSelectedOrderForView] = useState(null);
  const [reprintOrder, setReprintOrder] = useState(null);

  // Filters inside Today's Orders
  const [todaySearch, setTodaySearch] = useState("");
  const [todayStatusFilter, setTodayStatusFilter] = useState("ALL");
  const [todayPaymentFilter, setTodayPaymentFilter] = useState("ALL");

  // Keep ref for user to avoid stale closures in socket events
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Clear reprintOrder after print completes
  useEffect(() => {
    const handleAfterPrint = () => {
      setReprintOrder(null);
    };
    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, []);

  // IST Date / Time Utilities (strictly Asia/Kolkata timezone)
  const getISTDateString = (date = new Date()) => {
    try {
      return new Date(date).toLocaleDateString("en-CA", {
        timeZone: "Asia/Kolkata",
      }); // "YYYY-MM-DD"
    } catch (e) {
      return new Date(date).toISOString().split("T")[0];
    }
  };

  const isOrderTodayIST = useCallback((createdAt) => {
    if (!createdAt) return false;
    return getISTDateString(createdAt) === getISTDateString(new Date());
  }, []);

  const formatISTTime = (d) => {
    if (!d) return "--:--";
    try {
      return new Date(d).toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch (e) {
      return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
  };

  const formatISTDate = (d) => {
    if (!d) return "";
    try {
      return new Date(d).toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch (e) {
      return new Date(d).toLocaleDateString();
    }
  };

  const formatISTDateTime = (d) => {
    if (!d) return "";
    try {
      return new Date(d).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch (e) {
      return new Date(d).toLocaleString();
    }
  };

  // Helper to check if an order belongs to the currently logged in counter
  const isOrderBelongsToCounter = useCallback((ord, currentUser) => {
    if (!ord || !currentUser) return false;

    const userCounterId = String(
      currentUser.counter?._id || currentUser.counterId || currentUser._id || ""
    ).trim();
    const userCounterName = String(
      currentUser.counter?.name || currentUser.counterName || currentUser.name || ""
    ).trim().toLowerCase();

    const ordCounterId = String(
      (typeof ord.counter === "object" ? ord.counter?._id : ord.counter) ||
      ord.counterId ||
      ""
    ).trim();
    const ordCounterName = String(
      (typeof ord.counter === "object" ? ord.counter?.name : null) ||
      ord.counterName ||
      ""
    ).trim().toLowerCase();

    // 1. Match by Counter ID
    if (userCounterId && ordCounterId && userCounterId === ordCounterId) {
      return true;
    }

    // 2. Match by Counter Name
    if (userCounterName && ordCounterName && userCounterName === ordCounterName) {
      return true;
    }

    // 3. Match by User ID
    const ordStaffId = String(
      (typeof ord.staffId === "object" ? ord.staffId?._id : ord.staffId) || ""
    ).trim();
    const currentUserId = String(currentUser._id || "").trim();
    if (currentUserId && ordStaffId && currentUserId === ordStaffId) {
      return true;
    }

    // 4. Default for counter role if order counter matches user ID
    if (currentUser.role === "counter" && (!ordCounterId || ordCounterId === userCounterId)) {
      return true;
    }

    return false;
  }, []);

  // Fetch orders for this counter (scoped to today IST from backend)
  const fetchOrders = useCallback(async () => {
    try {
      setOrdersLoading(true);
      const res = await api.get("/orders?today=true");
      if (Array.isArray(res.data)) {
        setOrders(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch counter orders:", err);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      fetchOrders();
    }
  }, [isLoggedIn, fetchOrders]);

  // Real-time Socket.IO synchronization for Today's Orders
  useEffect(() => {
    if (!socket || !isLoggedIn) return;

    const getCurrentUser = () => {
      if (userRef.current) return userRef.current;
      const stored = localStorage.getItem("counterUser");
      if (stored) {
        try { return JSON.parse(stored); } catch (e) {}
      }
      return null;
    };

    const handleNewOrder = (newOrder) => {
      if (!newOrder?._id) return;
      const currentUser = getCurrentUser();
      if (currentUser && isOrderBelongsToCounter(newOrder, currentUser)) {
        setOrders((prev) => {
          const exists = prev.some((o) => o._id === newOrder._id);
          if (exists) {
            return prev.map((o) => (o._id === newOrder._id ? { ...o, ...newOrder } : o));
          }
          return [newOrder, ...prev];
        });
      }
    };

    const handleOrderUpdate = (updatedOrder) => {
      if (!updatedOrder?._id) return;
      const currentUser = getCurrentUser();
      if (currentUser && isOrderBelongsToCounter(updatedOrder, currentUser)) {
        setOrders((prev) => {
          const exists = prev.some((o) => o._id === updatedOrder._id);
          if (exists) {
            return prev.map((o) => (o._id === updatedOrder._id ? { ...o, ...updatedOrder } : o));
          }
          return [updatedOrder, ...prev];
        });
      }
    };

    const handleOrderDelete = ({ orderId, id } = {}) => {
      const targetId = orderId || id;
      if (!targetId) return;
      setOrders((prev) => prev.filter((o) => o._id !== targetId));
    };

    socket.on("newOrder", handleNewOrder);
    socket.on("orderCreated", handleNewOrder);
    socket.on("orderConfirmed", handleOrderUpdate);
    socket.on("orderCancelled", handleOrderUpdate);
    socket.on("orderReverted", handleOrderUpdate);
    socket.on("orderUpdated", handleOrderUpdate);
    socket.on("orderDeleted", handleOrderDelete);

    return () => {
      socket.off("newOrder", handleNewOrder);
      socket.off("orderCreated", handleNewOrder);
      socket.off("orderConfirmed", handleOrderUpdate);
      socket.off("orderCancelled", handleOrderUpdate);
      socket.off("orderReverted", handleOrderUpdate);
      socket.off("orderUpdated", handleOrderUpdate);
      socket.off("orderDeleted", handleOrderDelete);
    };
  }, [isLoggedIn, isOrderBelongsToCounter]);

  // Orders created TODAY in Asia/Kolkata (IST) for THIS counter
  const todayOrders = useMemo(() => {
    return orders.filter((o) => {
      if (!isOrderTodayIST(o.createdAt)) return false;
      if (user && !isOrderBelongsToCounter(o, user)) return false;
      return true;
    });
  }, [orders, isOrderTodayIST, user, isOrderBelongsToCounter]);

  // Valid today's orders (excluding cancelled / rejected orders)
  const validTodayOrders = useMemo(() => {
    return todayOrders.filter((o) => {
      const s = (o.status || "").toLowerCase();
      return s !== "cancelled" && s !== "rejected";
    });
  }, [todayOrders]);

  const todayOrdersCount = validTodayOrders.length;

  // Filtered Today's Orders based on search, status, payment filters
  const filteredTodayOrders = useMemo(() => {
    return todayOrders.filter((ord) => {
      if (todaySearch.trim()) {
        const q = todaySearch.trim().toLowerCase();
        const idMatches =
          ord._id?.toLowerCase().includes(q) ||
          ord.billNumber?.toLowerCase().includes(q) ||
          ord.invoiceNumber?.toLowerCase().includes(q) ||
          String(ord._id || "").slice(-6).toLowerCase().includes(q);
        const itemMatches = (ord.items || []).some((it) => {
          const pName = it.productId?.name || it.name || it.productName || "";
          return pName.toLowerCase().includes(q);
        });
        const customerMatches = ord.customerName?.toLowerCase().includes(q);
        if (!idMatches && !itemMatches && !customerMatches) return false;
      }

      if (todayStatusFilter !== "ALL") {
        const s = (ord.status || "").toLowerCase();
        if (todayStatusFilter === "CONFIRMED" && s !== "confirmed" && s !== "completed") return false;
        if (todayStatusFilter === "PENDING" && s !== "pending" && s !== "processing") return false;
        if (todayStatusFilter === "CANCELLED" && s !== "cancelled" && s !== "rejected") return false;
      }

      if (todayPaymentFilter !== "ALL") {
        const p = (ord.payment?.method || ord.paymentMethod || "").toLowerCase();
        if (todayPaymentFilter === "CASH" && p !== "cash") return false;
        if (todayPaymentFilter === "ONLINE" && p !== "online" && p !== "upi") return false;
      }

      return true;
    });
  }, [todayOrders, todaySearch, todayStatusFilter, todayPaymentFilter]);

  // Today's summary statistics
  const todaySummary = useMemo(() => {
    const totalCount = validTodayOrders.length;
    const completedOrders = validTodayOrders.filter(
      (o) => o.status === "Confirmed" || o.status === "Completed"
    );
    const completedCount = completedOrders.length;
    const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    return { totalCount, completedCount, totalRevenue };
  }, [validTodayOrders]);

  // Format order object to feed into ThermalReceipt component
  const formatOrderForReceipt = useCallback((ord) => {
    if (!ord) return null;
    const items = (ord.items || []).map((it, idx) => ({
      name: it.name || it.productId?.name || it.productName || `Item ${idx + 1}`,
      quantity: it.quantity || 1,
      price: it.price || it.sellingPrice || it.productId?.price || 0,
    }));
    const pMethod = ord.payment?.method || ord.paymentMethod || "CASH";
    const amtReceived =
      ord.payment?.receivedAmount !== undefined && ord.payment?.receivedAmount !== null
        ? ord.payment.receivedAmount
        : ord.amountReceived !== undefined
        ? ord.amountReceived
        : ord.totalAmount || 0;
    const changeGiven =
      ord.payment?.changeReturned !== undefined && ord.payment?.changeReturned !== null
        ? ord.payment.changeReturned
        : ord.changeGiven !== undefined
        ? ord.changeGiven
        : 0;

    const counterName =
      (typeof ord.counter === "object" ? ord.counter?.name : null) ||
      ord.counterName ||
      user?.counter?.name ||
      user?.counterName ||
      user?.name ||
      "Counter 1";

    const staffName =
      ord.staffName ||
      (typeof ord.staffId === "object" ? ord.staffId?.name : null) ||
      (typeof ord.confirmedBy === "object" ? ord.confirmedBy?.name : null) ||
      null;

    return {
      _id: ord.billNumber || ord.invoiceNumber || ord._id,
      items,
      totalAmount: ord.totalAmount || 0,
      amountReceived: amtReceived,
      changeGiven: changeGiven,
      paymentMethod: pMethod,
      createdAt: ord.createdAt || new Date().toISOString(),
      customerName: ord.customerName || null,
      counter: ord.counter || user?.counter || { name: counterName },
      counterName: counterName,
      staffName: staffName,
    };
  }, [user]);

  // Trigger reprint
  const handleReprintOrder = useCallback((orderToPrint) => {
    if (!orderToPrint) return;
    const formatted = formatOrderForReceipt(orderToPrint);
    setReprintOrder(formatted);
    toast.success(`Preparing receipt #${String(formatted._id).slice(-6).toUpperCase()}...`, {
      icon: "🖨️",
    });
    setTimeout(() => {
      window.print();
    }, 250);
  }, [formatOrderForReceipt]);

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
      if (data) {
        setOrders((prev) => [data, ...prev.filter((o) => o._id !== data._id)]);
      }

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
        if (order) {
          setOrders((prev) => [order, ...prev.filter((o) => o._id !== order._id)]);
        }

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
                className="w-full h-10 md:h-11 rounded-xl pl-9 pr-3 bg-gray-100 dark:bg-gray-800 border-0 focus:ring-2 focus:ring-indigo-500/30 text-sm font-medium transition-all text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {/* THEME */}
              <button
                type="button"
                onClick={toggleTheme}
                className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs"
                title="Toggle theme"
                aria-label="Toggle theme"
              >
                {theme === "dark" ? (
                  <FiSun className="text-yellow-500 text-base" />
                ) : (
                  <FiMoon className="text-slate-600 dark:text-slate-300 text-base" />
                )}
              </button>

              {/* Today's Orders Button */}
              <button
                onClick={() => setShowTodayOrders(true)}
                className="h-10 px-3 sm:px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-slate-800 dark:text-slate-100 font-semibold text-xs sm:text-sm flex items-center gap-1.5 border border-slate-200/80 dark:border-gray-700 transition-all shadow-xs active:scale-95"
                title="View Today's Orders (IST)"
              >
               
                <span className="hidden sm:inline">Today&apos;s Orders</span>
                {/* <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[11px] font-bold leading-none min-w-[20px] text-center">
                  {todayOrdersCount}
                </span> */}
              </button>

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

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* 🥈 TODAY'S ORDERS MODAL                                             */}
      {/* ────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showTodayOrders && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 print:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTodayOrders(false)}
              className="fixed inset-0 bg-black/60 dark:bg-black/75 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-4xl max-h-[92vh] sm:max-h-[88vh] flex flex-col bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-gray-800 overflow-hidden z-10"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-900/90">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xl shadow-2xs border border-indigo-100 dark:border-indigo-900/80 flex-shrink-0">
                    🥈
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        Today&apos;s Orders
                        <span className="text-xl sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                          ({todayOrdersCount} {todayOrdersCount === 1 ? "Order" : "Orders"})
                        </span>
                      </h2>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        IST Live
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-gray-400 flex items-center gap-2 mt-0.5">
                      <span>{formatISTDate(new Date())}</span>
                      <span>•</span>
                      <span className="font-semibold text-slate-700 dark:text-gray-200">
                        {counterDisplayName}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowTodayOrders(false)}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:text-gray-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-gray-800 transition-colors focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                    aria-label="Close modal"
                  >
                    <FiX className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* KPI Summary Cards */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3 px-4 sm:px-6 py-3.5 bg-slate-50/70 dark:bg-gray-950/50 border-b border-slate-200 dark:border-gray-800">
                <div className="p-3 rounded-xl bg-white dark:bg-gray-800/90 border border-slate-200/90 dark:border-gray-700/80 shadow-2xs">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                    Today&apos;s Orders
                  </div>
                  <div className="text-xl sm:text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">
                    {todayOrdersCount}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-gray-800/90 border border-slate-200/90 dark:border-gray-700/80 shadow-2xs">
                  <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                    Completed
                  </div>
                  <div className="text-xl sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                    {todaySummary.completedCount}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-gray-800/90 border border-slate-200/90 dark:border-gray-700/80 shadow-2xs">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                    Today&apos;s Revenue
                  </div>
                  <div className="text-lg sm:text-2xl font-extrabold text-slate-900 dark:text-white mt-1 truncate">
                    ₹{todaySummary.totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Search & Filter Controls */}
              <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-gray-800 space-y-3 bg-white dark:bg-gray-900">
                <div className="relative">
                  <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-500 w-4 h-4 pointer-events-none" />
                  <input
                    type="text"
                    value={todaySearch}
                    onChange={(e) => setTodaySearch(e.target.value)}
                    placeholder="Search by Order ID (#1045), product name..."
                    className="w-full pl-10 pr-9 py-2 rounded-xl bg-slate-100 hover:bg-slate-100/90 focus:bg-white dark:bg-gray-800 dark:hover:bg-gray-800/90 dark:focus:bg-gray-800 border border-transparent focus:border-indigo-500/50 dark:focus:border-indigo-500/50 text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                  {todaySearch && (
                    <button
                      onClick={() => setTodaySearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-gray-400 dark:hover:text-white p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-gray-700 transition-colors"
                      title="Clear search"
                    >
                      <FiX className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter Pills */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs">
                  {/* Status Filters */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-500 dark:text-gray-400 font-medium mr-1">Status:</span>
                    {[
                      { id: "ALL", label: "All" },
                      { id: "CONFIRMED", label: "Completed" },
                      { id: "PENDING", label: "Pending" },
                      { id: "CANCELLED", label: "Cancelled" },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setTodayStatusFilter(tab.id)}
                        className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                          todayStatusFilter === tab.id
                            ? "bg-indigo-600 text-white shadow-xs border border-indigo-600"
                            : "bg-slate-100 hover:bg-slate-200/80 text-slate-600 hover:text-slate-900 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-300 dark:hover:text-white border border-slate-200/70 dark:border-gray-700/80"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Payment Filters */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-500 dark:text-gray-400 font-medium mr-1">Payment:</span>
                    {[
                      { id: "ALL", label: "All" },
                      { id: "CASH", label: "Cash" },
                      { id: "ONLINE", label: "Online" },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setTodayPaymentFilter(tab.id)}
                        className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                          todayPaymentFilter === tab.id
                            ? "bg-purple-600 text-white shadow-xs border border-purple-600"
                            : "bg-slate-100 hover:bg-slate-200/80 text-slate-600 hover:text-slate-900 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-300 dark:hover:text-white border border-slate-200/70 dark:border-gray-700/80"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Order Cards List */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-3 min-h-[260px] max-h-[50vh] bg-slate-50/40 dark:bg-gray-950/40">
                {ordersLoading && orders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-gray-500">
                    <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mb-2" />
                    <p className="text-sm">Loading today&apos;s orders...</p>
                  </div>
                ) : filteredTodayOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700/80 flex items-center justify-center text-2xl mb-3 shadow-2xs">
                      📦
                    </div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-gray-200">
                      No orders today
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 max-w-xs leading-relaxed">
                      {todaySearch || todayStatusFilter !== "ALL" || todayPaymentFilter !== "ALL"
                        ? "Try adjusting your search query or filters."
                        : "Orders created on this counter today will appear here."}
                    </p>
                  </div>
                ) : (
                  filteredTodayOrders.map((ord) => {
                    const shortId = `#ORD-${ord.billNumber || ord.invoiceNumber || String(ord._id || "").slice(-6).toUpperCase()}`;
                    const timeStr = formatISTTime(ord.createdAt);
                    const itemCount = (ord.items || []).reduce((sum, it) => sum + (it.quantity || 1), 0);
                    const itemsPreview = (ord.items || [])
                      .map((it) => `${it.quantity || 1}x ${it.name || it.productId?.name || it.productName || "Item"}`)
                      .join(", ");
                    const payMethod = (ord.payment?.method || ord.paymentMethod || "Cash").toUpperCase();
                    const isCash = payMethod === "CASH";
                    const isConfirmed = ord.status === "Confirmed" || ord.status === "Completed";
                    const isPending = ord.status === "Pending" || ord.status === "Processing";

                    return (
                      <div
                        key={ord._id}
                        className="p-3.5 sm:p-4 rounded-xl bg-white dark:bg-gray-800/90 border border-slate-200/90 dark:border-gray-700/80 hover:border-indigo-300 dark:hover:border-indigo-500/60 transition-all shadow-2xs hover:shadow-xs"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          {/* Left Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                                {shortId}
                              </span>
                              <span className="text-xs text-slate-500 dark:text-gray-400 flex items-center gap-1 font-medium">
                                <FiClock className="w-3.5 h-3.5" />
                                {timeStr}
                              </span>
                              {/* Status Badge */}
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                                  isConfirmed
                                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80"
                                    : isPending
                                    ? "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800/80"
                                    : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800/80"
                                }`}
                              >
                                {ord.status || "Completed"}
                              </span>
                              {/* Payment Badge */}
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                                  isCash
                                    ? "bg-emerald-50/80 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60"
                                    : "bg-purple-50/80 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200/80 dark:border-purple-800/60"
                                }`}
                              >
                                {payMethod}
                              </span>
                            </div>

                            {/* Items Preview */}
                            <p className="text-xs text-slate-600 dark:text-gray-300 truncate max-w-lg mt-0.5">
                              <span className="font-semibold text-slate-800 dark:text-gray-200">
                                {itemCount} {itemCount === 1 ? "Item" : "Items"}
                              </span>
                              {itemsPreview ? <span className="text-slate-500 dark:text-gray-400"> • {itemsPreview}</span> : ""}
                            </p>
                          </div>

                          {/* Right Amount & Actions */}
                          <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-gray-700/60">
                            <div className="text-right">
                              <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                                ₹{(ord.totalAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {/* View Details */}
                              <button
                                onClick={() => setSelectedOrderForView(ord)}
                                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 dark:bg-gray-700/80 dark:hover:bg-gray-700 dark:text-gray-200 dark:hover:text-white text-xs font-semibold flex items-center gap-1 transition-colors border border-slate-200/80 dark:border-gray-600 active:scale-95"
                              >
                                <FiEye className="w-3.5 h-3.5" />
                                <span>View</span>
                              </button>

                              {/* Reprint Bill */}
                              <button
                                onClick={() => handleReprintOrder(ord)}
                                className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-800 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/80 dark:text-indigo-300 dark:hover:text-indigo-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-indigo-200/80 dark:border-indigo-800/80 shadow-2xs active:scale-95"
                                title="Reprint 80mm Receipt"
                              >
                                <FiPrinter className="w-3.5 h-3.5" />
                                <span>Reprint Bill</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="px-4 sm:px-6 py-3.5 border-t border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-900/90 flex items-center justify-between text-xs text-slate-500 dark:text-gray-400">
                <span className="font-medium">
                  Showing {filteredTodayOrders.length} of {todayOrders.length} orders
                </span>
                <button
                  onClick={() => setShowTodayOrders(false)}
                  className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300/80 text-slate-800 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold transition-colors border border-slate-300/60 dark:border-gray-700"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ────────────────────────────────────────────────────────────────── */}
      {/* 👁️ ORDER DETAILS MODAL                                             */}
      {/* ────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedOrderForView && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 print:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedOrderForView(null)}
              className="fixed inset-0 bg-black/60 dark:bg-black/75 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1, y: 0 }}
              className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-gray-800 overflow-hidden z-10"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-900/90">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Order Details
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                    #ORD-{selectedOrderForView.billNumber || selectedOrderForView.invoiceNumber || String(selectedOrderForView._id).slice(-6).toUpperCase()}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedOrderForView(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:text-gray-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-gray-800 transition-colors"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              {/* Order Meta */}
              <div className="p-4 space-y-4 overflow-y-auto flex-1">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-gray-800/90 border border-slate-200/70 dark:border-gray-700/80">
                    <span className="text-slate-500 dark:text-gray-400 block">Date & Time (IST)</span>
                    <span className="font-semibold text-slate-800 dark:text-gray-200">
                      {formatISTDateTime(selectedOrderForView.createdAt)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-gray-800/90 border border-slate-200/70 dark:border-gray-700/80">
                    <span className="text-slate-500 dark:text-gray-400 block">Status</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {selectedOrderForView.status || "Completed"}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-gray-800/90 border border-slate-200/70 dark:border-gray-700/80">
                    <span className="text-slate-500 dark:text-gray-400 block">Counter</span>
                    <span className="font-semibold text-slate-800 dark:text-gray-200">
                      {(typeof selectedOrderForView.counter === "object" ? selectedOrderForView.counter?.name : null) || selectedOrderForView.counterName || counterDisplayName}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-gray-800/90 border border-slate-200/70 dark:border-gray-700/80">
                    <span className="text-slate-500 dark:text-gray-400 block">Payment Mode</span>
                    <span className="font-semibold text-slate-800 dark:text-gray-200">
                      {(selectedOrderForView.payment?.method || selectedOrderForView.paymentMethod || "Cash").toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Items List */}
                <div>
                  <h4 className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    Items ({selectedOrderForView.items?.length || 0})
                  </h4>
                  <div className="divide-y divide-slate-100 dark:divide-gray-800 border border-slate-200/80 dark:border-gray-800 rounded-xl overflow-hidden">
                    {(selectedOrderForView.items || []).map((it, idx) => {
                      const itemName = it.name || it.productId?.name || it.productName || `Item ${idx + 1}`;
                      const qty = it.quantity || 1;
                      const price = it.price || it.sellingPrice || 0;
                      return (
                        <div key={idx} className="flex items-center justify-between p-2.5 text-xs bg-white dark:bg-gray-800">
                          <div>
                            <span className="font-medium text-slate-800 dark:text-gray-200">
                              {itemName}
                            </span>
                            <span className="text-slate-400 dark:text-gray-500 block text-[11px]">
                              {qty} × ₹{price.toFixed(2)}
                            </span>
                          </div>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            ₹{(qty * price).toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Financial Breakdown */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-gray-800/60 text-xs space-y-1.5 border border-slate-200/70 dark:border-gray-700/80">
                  <div className="flex justify-between text-slate-600 dark:text-gray-300">
                    <span>Grand Total:</span>
                    <span className="font-bold text-slate-900 dark:text-white text-sm">
                      ₹{(selectedOrderForView.totalAmount || 0).toFixed(2)}
                    </span>
                  </div>
                  {selectedOrderForView.payment?.receivedAmount !== undefined && (
                    <div className="flex justify-between text-slate-500 dark:text-gray-400">
                      <span>Amount Received:</span>
                      <span>₹{(selectedOrderForView.payment.receivedAmount || 0).toFixed(2)}</span>
                    </div>
                  )}
                  {selectedOrderForView.payment?.changeReturned !== undefined && (
                    <div className="flex justify-between text-slate-500 dark:text-gray-400">
                      <span>Change Returned:</span>
                      <span>₹{(selectedOrderForView.payment.changeReturned || 0).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="px-5 py-3 border-t border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-900/90 flex items-center justify-between">
                <button
                  onClick={() => setSelectedOrderForView(null)}
                  className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300/80 text-slate-800 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-200 font-semibold text-xs transition-colors border border-slate-300/60 dark:border-gray-700"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    handleReprintOrder(selectedOrderForView);
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-95"
                >
                  <FiPrinter className="w-3.5 h-3.5" />
                  <span>Reprint Bill</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ✅ Thermal Receipt print target — invisible on screen, only prints */}
      {reprintOrder ? (
        <div id="reprint-modal-container" className="hidden print:block">
          <ThermalReceipt
            order={reprintOrder}
            counter={user?.counter || { counterName: counterDisplayName, name: counterDisplayName }}
          />
        </div>
      ) : lastOrder ? (
        <div id="thermal-receipt-container" className="hidden print:block">
          <ThermalReceipt
            order={lastOrder}
            counter={user?.counter || { counterName: counterDisplayName, name: counterDisplayName }}
          />
        </div>
      ) : null}

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