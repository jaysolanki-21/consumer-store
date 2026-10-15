import { useState, useMemo, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import {
  removeFromCart,
  updateQuantity,
  clearCart,
} from "../redux/slices/cartSlice";
import {
  FiTrash2,
  FiMinus,
  FiPlus,
  FiShoppingCart,
  FiArrowLeft,
  FiCheckCircle,
  FiAlertCircle,
  FiCreditCard,
  FiSmartphone,
  FiSun,
  FiMoon,
  FiPrinter,
  FiShoppingBag,
} from "react-icons/fi";
import { FaRupeeSign } from "react-icons/fa";
import { useTheme } from "../hooks/useTheme";
import { showConfirm } from "../utils/alertService";
import api from "../services/api";
import toast from "react-hot-toast";
import ThermalReceipt from "../components/ThermalReceipt";

export default function ConsumerCheckoutPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const cartItems = useSelector((state) => state.cart.items);
  const { user } = useSelector((state) => state.auth);

  // Counter user details from localStorage
  const counterUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("counterUser") || "{}");
    } catch (e) {
      return {};
    }
  }, []);

  const counterDisplayName =
    counterUser?.counter?.name ||
    counterUser?.counterName ||
    user?.counter?.name ||
    user?.counterName ||
    "Counter 1";

  const counterId =
    counterUser?.counter?._id ||
    counterUser?.counterId ||
    counterUser?._id ||
    user?.counter?._id ||
    user?.counterId ||
    user?._id;

  /* =========================================================
      CART CALCULATIONS
  ========================================================= */
  const cartTotal = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      return sum + Number(item.price) * (Number(item.quantity) || 1);
    }, 0);
  }, [cartItems]);

  const totalUnits = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
  }, [cartItems]);

  /* =========================================================
      STATE
  ========================================================= */
  const [paymentMethod, setPaymentMethod] = useState("CASH"); // "CASH" | "ONLINE"
  const [cashReceived, setCashReceived] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastOrder, setLastOrder] = useState(null);
  const [orderSuccessModal, setOrderSuccessModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  /* =========================================================
      DERIVED VALUES (CASH & CHANGE)
  ========================================================= */
  const parsedCash = useMemo(() => {
    const num = parseFloat(cashReceived);
    return Number.isNaN(num) ? 0 : num;
  }, [cashReceived]);

  const isCashValid = parsedCash >= cartTotal;

  const changeAmount = useMemo(() => {
    if (!isCashValid) return 0;
    return parsedCash - cartTotal;
  }, [parsedCash, cartTotal, isCashValid]);

  /* =========================================================
      CART ITEM HANDLERS
  ========================================================= */
  const handleIncrement = useCallback(
    (item) => {
      if (item.quantity >= item.stock) {
        toast.error(`Only ${item.stock} units available in stock`);
        return;
      }
      dispatch(
        updateQuantity({
          productId: item.productId,
          quantity: item.quantity + 1,
        })
      );
    },
    [dispatch]
  );

  const handleDecrement = useCallback(
    (item) => {
      if (item.quantity <= 1) return;
      dispatch(
        updateQuantity({
          productId: item.productId,
          quantity: item.quantity - 1,
        })
      );
    },
    [dispatch]
  );

  const handleRemove = useCallback(
    (productId) => {
      dispatch(removeFromCart(productId));
    },
    [dispatch]
  );

  const handleClear = async () => {
    const confirmed = await showConfirm({
      title: "Clear Cart?",
      text: "Are you sure you want to remove all items from your cart?",
      confirmButtonText: "Yes, Clear Cart",
      confirmButtonColor: "#ef4444",
    });
    if (!confirmed) return;
    dispatch(clearCart());
  };

  /* =========================================================
      CHECKOUT: CASH PAYMENT
  ========================================================= */
  const handleCashCheckout = async () => {
    if (cartItems.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    if (!isCashValid) {
      setErrorMessage(
        `Cash received must be at least ₹${cartTotal.toLocaleString("en-IN")}`
      );
      return;
    }

    if (isProcessing) return;
    setIsProcessing(true);
    setErrorMessage("");

    try {
      const orderItems = cartItems.map((item) => ({
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      }));

      const { data } = await api.post("/orders", {
        items: orderItems,
        counter: counterId,
        counterId: counterId,
        counterName: counterDisplayName,
        payment: {
          method: "Cash",
          receivedAmount: parsedCash,
          changeReturned: changeAmount,
          status: "Paid",
        },
      });

      const receiptOrder = {
        _id: data?._id || data?.orderId || `ORD${Date.now()}`,
        items: orderItems,
        totalAmount: cartTotal,
        amountReceived: parsedCash,
        changeGiven: changeAmount,
        paymentMethod: "CASH",
        paymentStatus: "PAID",
        createdAt: new Date().toISOString(),
        customerName: null,
        counter: data?.counter || { name: counterDisplayName },
        counterName: data?.counterName || counterDisplayName,
      };

      setLastOrder(receiptOrder);
      setOrderSuccessModal(true);

      // Cart cleared ONLY upon confirmed success
      dispatch(clearCart());

      toast.success(
        `Order placed successfully! Change: ₹${changeAmount.toFixed(2)} 🎉`,
        { duration: 4000 }
      );

      // Trigger thermal print
      setTimeout(() => {
        window.print();
      }, 500);
    } catch (err) {
      console.error("Cash checkout error:", err);
      const msg = err.response?.data?.message || "Failed to place order. Please try again.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  /* =========================================================
      CHECKOUT: ONLINE PAYMENT (CASHFREE)
  ========================================================= */
  const handleOnlineCheckout = async () => {
    if (cartItems.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    if (isProcessing) return;
    setIsProcessing(true);
    setErrorMessage("");

    let createdOrderId = null;
    let createdCfOrderId = null;

    try {
      const orderItems = cartItems.map((item) => ({
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      }));

      // Step 1: Create session on backend
      const { data: sessionData } = await api.post(
        "/payments/cashfree/create-session",
        {
          items: orderItems,
          counter: counterId,
          counterId: counterId,
          counterName: counterDisplayName,
          staffId: user?._id || null,
          staffName: user?.name || "",
        }
      );

      const { orderId, cfOrderId, paymentSessionId } = sessionData;
      createdOrderId = orderId;
      createdCfOrderId = cfOrderId;

      // Step 2: Initialize Cashfree SDK
      const { load } = await import("@cashfreepayments/cashfree-js");
      const mode =
        (import.meta.env.VITE_CASHFREE_MODE || import.meta.env.VITE_CASHFREE_ENV || "")
          .toLowerCase() === "production"
          ? "production"
          : "sandbox";

      const cashfree = await load({ mode });

      // Step 3: Open checkout modal
      await new Promise((resolve, reject) => {
        cashfree
          .checkout({
            paymentSessionId,
            redirectTarget: "_modal",
          })
          .then((result) => {
            if (result.error) {
              console.error("Cashfree checkout error:", result.error);
              reject(new Error(result.error.message || "Payment cancelled or failed"));
              return;
            }
            resolve(result.paymentDetails || null);
          })
          .catch(reject);
      });

      // Step 4: Authoritative backend verification
      const { data: verifyData } = await api.post("/payments/cashfree/verify", {
        orderId: createdOrderId,
        cfOrderId: createdCfOrderId,
      });

      if (verifyData.success) {
        const order = verifyData.order;
        const receiptOrder = {
          _id: order?._id || createdOrderId,
          items: orderItems,
          totalAmount: order?.totalAmount || cartTotal,
          amountReceived: order?.totalAmount || cartTotal,
          changeGiven: 0,
          paymentMethod: "ONLINE",
          paymentStatus: "PAID",
          createdAt: order?.createdAt || new Date().toISOString(),
          customerName: null,
          counter: order?.counter || { name: counterDisplayName },
          counterName: order?.counterName || counterDisplayName,
        };

        setLastOrder(receiptOrder);
        setOrderSuccessModal(true);

        // Cart cleared ONLY upon confirmed payment
        dispatch(clearCart());

        toast.success("Payment verified! Order placed successfully 🎉", {
          duration: 4000,
        });

        setTimeout(() => {
          window.print();
        }, 500);
      } else {
        throw new Error(verifyData.message || "Payment verification failed.");
      }
    } catch (err) {
      console.error("Online checkout error:", err);
      // Cancel the session on backend to release stock and mark order as cancelled
      if (createdOrderId) {
        try {
          await api.post("/payments/cashfree/cancel-session", {
            orderId: createdOrderId,
            cfOrderId: createdCfOrderId,
          });
        } catch (cancelErr) {
          console.warn("Failed to cancel Cashfree session on backend:", cancelErr);
        }
      }
      const msg = err.response?.data?.message || err.message || "Payment could not be completed.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  /* =========================================================
      RENDER: EMPTY CART STATE
  ========================================================= */
  if (cartItems.length === 0 && !orderSuccessModal) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#080D1A] text-slate-900 dark:text-slate-100 flex flex-col">
        {/* Navigation Header */}
        <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-[#0B1220]/90 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between">
          <Link
            to="/consumer"
            className="flex items-center gap-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            <FiArrowLeft className="text-base" />
            <span>Back to Store</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {counterDisplayName}
            </span>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <FiSun className="text-amber-400" /> : <FiMoon />}
            </button>
          </div>
        </header>

        {/* Empty State Body */}
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center shadow-sm space-y-5">
            <div className="w-20 h-20 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto text-3xl shadow-inner">
              <FiShoppingCart />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Your cart is empty
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Add products from the store catalog to proceed with placing your order.
              </p>
            </div>
            <Link
              to="/consumer"
              className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold shadow-md hover:shadow-lg transition cursor-pointer"
            >
              <FiShoppingBag />
              <span>Browse Products</span>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  /* =========================================================
      RENDER: CHECKOUT PAGE
  ========================================================= */
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#080D1A] text-slate-900 dark:text-slate-100 flex flex-col">
      {/* ── Top Header ── */}
      <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-[#0B1220]/90 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 print:hidden">
        <div className="flex items-center gap-4">
          <Link
            to="/consumer"
            className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
          >
            <FiArrowLeft className="text-base" />
            <span className="hidden sm:inline">Continue Shopping</span>
            <span className="sm:hidden">Store</span>
          </Link>
          <span className="text-slate-300 dark:text-slate-700">/</span>
          <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Checkout</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-200 dark:border-indigo-800">
              {totalUnits} {totalUnits === 1 ? "unit" : "units"}
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-block text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            {counterDisplayName}
          </span>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <FiSun className="text-amber-400" /> : <FiMoon />}
          </button>
        </div>
      </header>

      {/* ── Main Two-Column Layout ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 print:hidden">
        {errorMessage && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs sm:text-sm flex items-start gap-3">
            <FiAlertCircle className="text-rose-500 text-lg shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{errorMessage}</div>
            <button
              onClick={() => setErrorMessage("")}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              ✕
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* =========================================================
              LEFT COLUMN: CART ITEMS (8 cols)
          ========================================================= */}
          <section className="lg:col-span-7 xl:col-span-8 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FiShoppingCart className="text-indigo-600 dark:text-indigo-400" />
                <span>Cart Items ({cartItems.length})</span>
              </h2>
              <button
                onClick={handleClear}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 flex items-center gap-1 cursor-pointer"
              >
                <FiTrash2 />
                <span>Clear All</span>
              </button>
            </div>

            {/* Items List */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {cartItems.map((item) => {
                const lineTotal = Number(item.price) * item.quantity;
                return (
                  <div
                    key={item.productId}
                    className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    {/* Product Details */}
                    <div className="flex items-center gap-3.5 flex-1 min-w-0">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-14 h-14 rounded-2xl object-cover bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xl shrink-0 font-bold">
                          {item.name?.charAt(0)?.toUpperCase() || "P"}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {item.name}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          ₹{Number(item.price).toLocaleString("en-IN")} each
                        </p>
                      </div>
                    </div>

                    {/* Quantity controls & Line total */}
                    <div className="flex items-center justify-between sm:justify-end gap-5">
                      <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-1">
                        <button
                          onClick={() => handleDecrement(item)}
                          disabled={item.quantity <= 1}
                          className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-40 transition cursor-pointer"
                          aria-label="Decrease quantity"
                        >
                          <FiMinus className="text-xs" />
                        </button>
                        <span className="w-8 text-center text-xs font-bold text-slate-900 dark:text-white">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => handleIncrement(item)}
                          disabled={item.quantity >= item.stock}
                          className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-40 transition cursor-pointer"
                          aria-label="Increase quantity"
                        >
                          <FiPlus className="text-xs" />
                        </button>
                      </div>

                      {/* Line total */}
                      <div className="text-right min-w-[80px]">
                        <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                          ₹{lineTotal.toLocaleString("en-IN")}
                        </span>
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => handleRemove(item.productId)}
                        className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer"
                        title="Remove item"
                      >
                        <FiTrash2 className="text-base" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* =========================================================
              RIGHT COLUMN: ORDER SUMMARY & PAYMENT (4-5 cols)
          ========================================================= */}
          <section className="lg:col-span-5 xl:col-span-4 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-6">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Order Summary
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Review total amount and choose your payment method
              </p>
            </div>

            {/* Price Breakdown */}
            <div className="space-y-3 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs sm:text-sm">
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                <span>Subtotal ({totalUnits} units)</span>
                <span className="font-semibold text-slate-900 dark:text-white tabular-nums">
                  ₹{cartTotal.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-800 pt-3 flex justify-between items-center">
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  Total Payable
                </span>
                <span className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 tabular-nums">
                  ₹{cartTotal.toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Select Payment Method
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod("CASH");
                    setErrorMessage("");
                  }}
                  className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between h-20 ${
                    paymentMethod === "CASH"
                      ? "bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-600 text-indigo-900 dark:text-indigo-200 shadow-xs"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-sm font-bold">
                      <FaRupeeSign />
                    </span>
                    {paymentMethod === "CASH" && (
                      <FiCheckCircle className="text-indigo-600 dark:text-indigo-400 text-base" />
                    )}
                  </div>
                  <span className="text-xs font-bold">Cash at Counter</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod("ONLINE");
                    setErrorMessage("");
                  }}
                  className={`p-3.5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between h-20 ${
                    paymentMethod === "ONLINE"
                      ? "bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-600 text-indigo-900 dark:text-indigo-200 shadow-xs"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/60 text-purple-600 dark:text-purple-400 flex items-center justify-center text-sm">
                      <FiSmartphone />
                    </span>
                    {paymentMethod === "ONLINE" && (
                      <FiCheckCircle className="text-indigo-600 dark:text-indigo-400 text-base" />
                    )}
                  </div>
                  <span className="text-xs font-bold">Online (UPI / QR)</span>
                </button>
              </div>
            </div>

            {/* CASH SPECIFIC INPUT & CHANGE CALCULATOR */}
            {paymentMethod === "CASH" && (
              <div className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Cash Received (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                      ₹
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={cashReceived}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (/^\d*\.?\d*$/.test(val)) {
                          setCashReceived(val);
                          setErrorMessage("");
                        }
                      }}
                      placeholder={String(cartTotal)}
                      className="w-full h-11 pl-8 pr-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Quick Cash Presets */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCashReceived(String(cartTotal))}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Exact (₹{cartTotal})
                  </button>
                  {[50, 100, 200, 500].map((extra) => {
                    const preset = Math.ceil((cartTotal + 1) / extra) * extra;
                    if (preset <= cartTotal) return null;
                    return (
                      <button
                        key={extra}
                        type="button"
                        onClick={() => setCashReceived(String(preset))}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                      >
                        ₹{preset}
                      </button>
                    );
                  })}
                </div>

                {/* Change or Remaining display */}
                {parsedCash > 0 && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex justify-between items-center ${
                      isCashValid
                        ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                        : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300"
                    }`}
                  >
                    <span className="font-medium">
                      {isCashValid ? "Change to return:" : "Remaining amount:"}
                    </span>
                    <span className="font-bold text-sm tabular-nums">
                      ₹{Math.abs(changeAmount).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* ONLINE SPECIFIC NOTICE */}
            {paymentMethod === "ONLINE" && (
              <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/60 text-xs text-indigo-900 dark:text-indigo-200 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold">
                  <FiCreditCard className="text-indigo-600" />
                  <span>Instant Payment via Cashfree</span>
                </div>
                <p className="text-[11px] leading-relaxed text-indigo-700 dark:text-indigo-300">
                  Clicking Pay Now opens the Cashfree secure checkout modal. Pay with GPay, PhonePe, Paytm, UPI QR, or Cards.
                </p>
              </div>
            )}

            {/* Main Action Button */}
            <button
              type="button"
              onClick={paymentMethod === "CASH" ? handleCashCheckout : handleOnlineCheckout}
              disabled={isProcessing || (paymentMethod === "CASH" && parsedCash > 0 && !isCashValid)}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-base shadow-lg hover:shadow-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Processing Order...</span>
                </>
              ) : paymentMethod === "CASH" ? (
                <>
                  <FaRupeeSign className="text-sm" />
                  <span>Place Order (Cash)</span>
                </>
              ) : (
                <>
                  <FiSmartphone className="text-base" />
                  <span>Pay Now · ₹{cartTotal.toLocaleString("en-IN")}</span>
                </>
              )}
            </button>
          </section>
        </div>
      </main>

      {/* ── Order Success Modal ── */}
      {orderSuccessModal && lastOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs print:hidden">
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 text-center space-y-5 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto text-3xl">
              <FiCheckCircle />
            </div>

            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Order Placed Successfully!
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Order Reference: <strong className="text-slate-700 dark:text-slate-200">{lastOrder._id}</strong>
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs space-y-2 text-left">
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Method:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{lastOrder.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount Paid:</span>
                <span className="font-bold text-slate-900 dark:text-white">₹{lastOrder.totalAmount?.toLocaleString("en-IN")}</span>
              </div>
              {lastOrder.changeGiven > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span className="font-medium">Change Returned:</span>
                  <span className="font-bold">₹{lastOrder.changeGiven?.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <FiPrinter />
                <span>Print Receipt</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setOrderSuccessModal(false);
                  navigate("/consumer");
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-semibold shadow-md transition cursor-pointer"
              >
                Start New Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Thermal receipt printed invisibly on screen */}
      {lastOrder && <ThermalReceipt order={lastOrder} />}
    </div>
  );
}
