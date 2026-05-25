import { motion, AnimatePresence } from 'framer-motion';
import { useSelector, useDispatch } from 'react-redux';
import {
  removeFromCart,
  updateQuantity,
  clearCart,
} from '../redux/slices/cartSlice';

import {
  FiTrash2,
  FiX,
  FiMinus,
  FiPlus,
  FiCreditCard,
  FiShoppingCart,
  FiAlertCircle,
  FiCheckCircle,
} from 'react-icons/fi';

import { useState, useEffect, useMemo, useCallback } from 'react';

export default function CartDrawer({
  open,
  onClose,
  onCheckout,
  isProcessing,
}) {
  const items = useSelector((state) => state.cart.items);

  const dispatch = useDispatch();

  /* =========================================================
      CALCULATIONS
  ========================================================= */

  const total = useMemo(() => {
    return items.reduce((sum, item) => {
      return sum + item.price * item.quantity;
    }, 0);
  }, [items]);

  /* =========================================================
      STATE
  ========================================================= */

  const [cashReceived, setCashReceived] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  /* =========================================================
      RESET
  ========================================================= */

  useEffect(() => {
    if (!open) {
      setCashReceived('');
      setErrorMessage('');
    }
  }, [open]);

  /* =========================================================
      DERIVED VALUES
  ========================================================= */

  const parsedCash = useMemo(() => {
    const num = parseFloat(cashReceived);
    return Number.isNaN(num) ? 0 : num;
  }, [cashReceived]);

  const isCashValid = parsedCash >= total;

  const changeAmount = useMemo(() => {
    if (!isCashValid) return 0;
    return parsedCash - total;
  }, [parsedCash, total, isCashValid]);

  /* =========================================================
      HANDLERS
  ========================================================= */

  const resetPaymentState = () => {
    setCashReceived('');
    setErrorMessage('');
  };

  const handleCashReceived = (value) => {
    setErrorMessage('');

    // Allow only numbers + decimal
    if (!/^\d*\.?\d*$/.test(value)) return;

    setCashReceived(value);
  };

  const handleIncrement = useCallback(
    (item) => {
      if (item.quantity >= item.stock) return;

      dispatch(
        updateQuantity({
          productId: item.productId,
          quantity: item.quantity + 1,
        })
      );

      resetPaymentState();
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

      resetPaymentState();
    },
    [dispatch]
  );

  const handleRemoveItem = useCallback(
    (productId) => {
      dispatch(removeFromCart(productId));
      resetPaymentState();
    },
    [dispatch]
  );

  const handleClearCart = () => {
    const confirmed = window.confirm(
      'Are you sure you want to clear the cart?'
    );

    if (!confirmed) return;

    dispatch(clearCart());

    resetPaymentState();
  };

  const handleCheckout = () => {
    setErrorMessage('');

    if (!cashReceived) {
      setErrorMessage(
        `Please enter amount of ₹${total.toFixed(2)} or more`
      );
      return;
    }

    if (parsedCash < total) {
      setErrorMessage(
        `Please enter amount of ₹${total.toFixed(2)} or more`
      );
      return;
    }

    onCheckout(parsedCash, changeAmount);
  };

  /* =========================================================
      UI
  ========================================================= */

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* BACKDROP */}

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.45 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black z-40 backdrop-blur-sm"
          />

          {/* DRAWER */}

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{
              type: 'spring',
              damping: 28,
              stiffness: 260,
            }}
            className="fixed right-0 top-0 z-50 h-full w-full sm:w-[420px] bg-white dark:bg-[#0f172a] shadow-2xl flex flex-col border-l border-gray-200 dark:border-slate-700"
          >
            {/* HEADER */}

            <div className="sticky top-0 z-10 bg-white/90 dark:bg-[#0f172a]/90 backdrop-blur-md border-b border-gray-200 dark:border-slate-700 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Your Cart
                  </h2>

                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {items.length} item
                    {items.length !== 1 ? 's' : ''} added
                  </p>
                </div>

                <button
                  onClick={onClose}
                  className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 flex items-center justify-center transition"
                >
                  <FiX className="text-xl text-gray-700 dark:text-gray-300" />
                </button>
              </div>
            </div>

            {/* CART ITEMS */}

            <div className="flex-1 overflow-y-auto px-4 py-4">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="w-24 h-24 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center mb-5">
                    <FiShoppingCart className="text-4xl text-gray-400" />
                  </div>

                  <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
                    Cart is Empty
                  </h3>

                  <p className="text-gray-500 dark:text-gray-400 mt-2">
                    Add some products to continue
                  </p>

                  <button
                    onClick={onClose}
                    className="mt-6 h-11 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition"
                  >
                    Continue Shopping
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((item) => (
                    <motion.div
                      layout
                      key={item.productId}
                      className="bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 rounded-2xl p-3"
                    >
                      <div className="flex gap-3">
                        {/* IMAGE */}

                        <img
                          src={
                            item.image ||
                            'https://via.placeholder.com/100'
                          }
                          alt={item.name}
                          className="w-20 h-20 rounded-xl object-cover border border-gray-200 dark:border-slate-700"
                        />

                        {/* CONTENT */}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-semibold text-gray-900 dark:text-white line-clamp-1">
                                {item.name}
                              </h4>

                              <p className="text-indigo-600 dark:text-indigo-400 font-bold mt-1">
                                ₹{item.price}
                              </p>
                            </div>

                            <button
                              onClick={() =>
                                handleRemoveItem(item.productId)
                              }
                              className="w-9 h-9 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 flex items-center justify-center text-red-500 transition"
                            >
                              <FiTrash2 />
                            </button>
                          </div>

                          {/* CONTROLS */}

                          <div className="flex items-center justify-between mt-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() =>
                                  handleDecrement(item)
                                }
                                disabled={item.quantity <= 1}
                                className="w-9 h-9 rounded-full bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 hover:scale-105 active:scale-95 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition"
                              >
                                <FiMinus />
                              </button>

                              <div className="w-10 text-center font-bold text-gray-900 dark:text-white">
                                {item.quantity}
                              </div>

                              <button
                                onClick={() =>
                                  handleIncrement(item)
                                }
                                disabled={item.quantity >= item.stock}
                                className="w-9 h-9 rounded-full bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 hover:scale-105 active:scale-95 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition"
                              >
                                <FiPlus />
                              </button>
                            </div>

                            <div className="text-lg font-bold text-gray-900 dark:text-white">
                              ₹
                              {(
                                item.price * item.quantity
                              ).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* FOOTER */}

            {items.length > 0 && (
              <div className="border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-[#0f172a] p-4 space-y-4">
                {/* SUMMARY */}

                <div className="bg-gray-50 dark:bg-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>Subtotal</span>
                    <span>₹{total.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>Tax</span>
                    <span>₹0.00</span>
                  </div>

                  <div className="border-t border-gray-200 dark:border-slate-700 pt-3 flex justify-between items-center">
                    <span className="text-xl font-bold text-gray-900 dark:text-white">
                      Total
                    </span>

                    <span className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                      ₹{total.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* INPUT */}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Cash Received
                  </label>

                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg font-bold">
                      ₹
                    </span>

                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Enter amount"
                      value={cashReceived}
                      onChange={(e) =>
                        handleCashReceived(e.target.value)
                      }
                      className={`w-full h-14 pl-10 pr-4 rounded-2xl border-2 bg-gray-50 dark:bg-slate-800 outline-none text-lg font-bold text-gray-900 dark:text-white transition-all
                      ${
                        errorMessage
                          ? 'border-red-500 focus:border-red-500'
                          : isCashValid
                          ? 'border-emerald-500 focus:border-emerald-500'
                          : 'border-gray-200 dark:border-slate-700 focus:border-indigo-500'
                      }`}
                    />
                  </div>
                </div>

                {/* ERROR */}

                <AnimatePresence>
                  {errorMessage && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 rounded-2xl"
                    >
                      <FiAlertCircle className="text-red-500 text-lg shrink-0" />

                      <p className="text-sm font-medium text-red-600 dark:text-red-400">
                        {errorMessage}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* CHANGE */}

                <AnimatePresence>
                  {cashReceived && parsedCash > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className={`rounded-2xl p-4 border ${
                        isCashValid
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                          : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Change to return
                          </p>

                          <h3
                            className={`text-3xl font-bold mt-1 ${
                              isCashValid
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            ₹{changeAmount.toFixed(2)}
                          </h3>
                        </div>

                        {isCashValid ? (
                          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                            <FiCheckCircle className="text-emerald-600 dark:text-emerald-400 text-2xl" />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                            <FiAlertCircle className="text-amber-600 dark:text-amber-400 text-2xl" />
                          </div>
                        )}
                      </div>

                      {!isCashValid && (
                        <p className="mt-2 text-sm text-amber-600 dark:text-amber-400 font-medium">
                          Need additional ₹
                          {(total - parsedCash).toFixed(2)}
                        </p>
                      )}

                      {isCashValid && (
                        <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                          Ready to complete order
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ACTIONS */}

                <div className="space-y-3">
                  <button
                    onClick={handleCheckout}
                    disabled={
                      isProcessing ||
                      items.length === 0 ||
                      !isCashValid
                    }
                    className={`w-full h-14 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all
                    ${
                      isCashValid && !isProcessing
                        ? 'bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 hover:scale-[1.01] active:scale-[0.99] text-white shadow-lg'
                        : 'bg-gray-200 dark:bg-slate-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {isProcessing ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <FiCreditCard className="text-xl" />
                        Complete Order
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleClearCart}
                    className="w-full h-12 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-semibold transition-all"
                  >
                    Clear Cart
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}