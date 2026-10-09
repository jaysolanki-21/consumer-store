import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiCheck,
  FiX,
  FiTrash2,
  FiRotateCcw,
  FiAlertTriangle,
  FiHelpCircle,
} from "react-icons/fi";

const TYPE_CONFIG = {
  confirm: {
    title: "Confirm Order",
    subtitle: "Review the order details before confirming it.",
    headline: "Confirm this order?",
    subtext: "Stock will be deducted and the order will be marked as confirmed.",
    confirmText: "Confirm Order",
    loadingText: "Confirming...",
    Icon: FiCheck,
    iconBg:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/80",
    bannerStyle:
      "bg-emerald-50/80 border-emerald-200/90 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-800/60 dark:text-emerald-200",
    buttonBg:
      "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-xs focus:ring-2 focus:ring-emerald-500",
    ButtonIcon: FiCheck,
  },
  cancel: {
    title: "Cancel Order",
    subtitle: "Review the order details before cancelling it.",
    headline: "Cancel this order?",
    subtext: "The order will be moved to the cancelled state.",
    confirmText: "Cancel Order",
    loadingText: "Cancelling...",
    Icon: FiX,
    iconBg:
      "bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/80",
    bannerStyle:
      "bg-amber-50/80 border-amber-200/90 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800/60 dark:text-amber-200",
    buttonBg:
      "bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white shadow-xs focus:ring-2 focus:ring-amber-500",
    ButtonIcon: FiX,
  },
  delete: {
    title: "Delete Order",
    subtitle: "This action cannot be undone.",
    headline: "Delete this order permanently?",
    subtext: "This action cannot be undone.",
    confirmText: "Delete Order",
    loadingText: "Deleting...",
    Icon: FiTrash2,
    iconBg:
      "bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800/80",
    bannerStyle:
      "bg-rose-50/80 border-rose-200/90 text-rose-900 dark:bg-rose-950/30 dark:border-rose-800/60 dark:text-rose-200",
    buttonBg:
      "bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-xs focus:ring-2 focus:ring-rose-500",
    ButtonIcon: FiTrash2,
  },
  revert: {
    title: "Revert Order",
    subtitle: "Revert this order back to pending state.",
    headline: "Revert this order to Pending?",
    subtext: "Stock will be adjusted and order returned to pending queue.",
    confirmText: "Revert Order",
    loadingText: "Reverting...",
    Icon: FiRotateCcw,
    iconBg:
      "bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/80",
    bannerStyle:
      "bg-amber-50/80 border-amber-200/90 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800/60 dark:text-amber-200",
    buttonBg:
      "bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white shadow-xs focus:ring-2 focus:ring-amber-500",
    ButtonIcon: FiRotateCcw,
  },
};

function formatSummaryDate(dateInput) {
  if (!dateInput) return "N/A";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "N/A";
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  type = "confirm",
  title,
  subtitle,
  order,
  counterName,
  rows = [],
  headline,
  subtext,
  confirmText,
  confirmLoadingText,
  isLoading: externalLoading = false,
}) {
  const [internalLoading, setInternalLoading] = useState(false);
  const loading = externalLoading || internalLoading;

  const config = TYPE_CONFIG[type] || TYPE_CONFIG.confirm;
  const HeaderIcon = config.Icon || FiHelpCircle;
  const ButtonIcon = config.ButtonIcon || FiCheck;

  const modalTitle = title || config.title;
  const modalSubtitle = subtitle || config.subtitle;
  const warningHeadline = headline || config.headline;
  const warningSubtext = subtext || config.subtext;

  const handleConfirm = async (e) => {
    e?.preventDefault?.();
    if (loading) return;

    if (onConfirm) {
      try {
        setInternalLoading(true);
        await onConfirm();
      } finally {
        setInternalLoading(false);
      }
    }
  };

  // Build summary rows from order object if provided
  const summaryRows = [];
  if (order) {
    const orderIdStr = order.billNumber
      ? `#${order.billNumber}`
      : order.invoiceNumber
      ? `#${order.invoiceNumber}`
      : order._id
      ? `#${String(order._id).slice(-8)}`
      : "N/A";
    const orderCounter =
      counterName ||
      (order.counter && typeof order.counter === "object" ? order.counter.name : null) ||
      order.counterName ||
      "Counter 1";
    const paymentMethodVal =
      order.paymentMethod ||
      order.payment?.method ||
      "Cash";
    const amountVal = `₹${Number(order.totalAmount || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
    const placedTime = formatSummaryDate(order.createdAt);

    summaryRows.push({ label: "Order ID", value: orderIdStr, isMono: true });
    summaryRows.push({ label: "Counter", value: orderCounter });
    summaryRows.push({ label: "Payment Method", value: paymentMethodVal });
    summaryRows.push({ label: "Total Amount", value: amountVal, isAmount: true });
    summaryRows.push({ label: "Placed", value: placedTime });
  } else if (rows && rows.length > 0) {
    rows.forEach(([k, v]) => {
      summaryRows.push({ label: k, value: String(v) });
    });
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          {/* 1. Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => !loading && onClose?.()}
            className="fixed inset-0 bg-black/50 backdrop-blur-[4px]"
            style={{
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
            }}
            aria-hidden="true"
          />

          {/* 2. Modal Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="relative z-10 w-full max-w-[480px] rounded-2xl sm:rounded-[20px] bg-white p-6 sm:p-7 shadow-2xl border border-slate-200/90 dark:border-slate-800 dark:bg-slate-900 text-slate-900 dark:text-slate-100 space-y-4 sm:space-y-5"
          >
            {/* Header Section */}
            <div className="flex items-start gap-3.5 sm:gap-4">
              <div
                className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center text-xl sm:text-2xl flex-shrink-0 ${config.iconBg}`}
              >
                <HeaderIcon />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <h3 className="text-lg sm:text-[19px] font-bold tracking-tight text-slate-900 dark:text-white leading-snug">
                  {modalTitle}
                </h3>
                <p className="text-xs sm:text-[13px] font-normal text-slate-500 dark:text-slate-400 mt-0.5">
                  {modalSubtitle}
                </p>
              </div>
            </div>

            {/* Order Summary Card */}
            {summaryRows.length > 0 && (
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3.5 sm:p-4 dark:border-slate-800 dark:bg-slate-800/50">
                <div className="text-[11px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 uppercase mb-2.5">
                  Order Summary
                </div>
                <div className="space-y-2 text-xs sm:text-[13px]">
                  {summaryRows.map((row, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-3 text-slate-700 dark:text-slate-300"
                    >
                      <span className="text-slate-500 dark:text-slate-400 font-medium">
                        {row.label}
                      </span>
                      <span
                        className={`text-right ${
                          row.isAmount
                            ? "text-base sm:text-[17px] font-bold text-slate-900 dark:text-white"
                            : row.isMono
                            ? "font-mono font-semibold text-slate-900 dark:text-white"
                            : "font-semibold text-slate-900 dark:text-slate-100"
                        }`}
                      >
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Contextual Warning / Message Box */}
            {(warningHeadline || warningSubtext) && (
              <div
                className={`rounded-xl border p-3 sm:p-3.5 text-xs sm:text-[13px] leading-relaxed ${config.bannerStyle}`}
              >
                {warningHeadline && (
                  <div className="font-bold mb-0.5">{warningHeadline}</div>
                )}
                {warningSubtext && (
                  <div className="opacity-90">{warningSubtext}</div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="h-10 sm:h-11 px-4 sm:px-5 rounded-xl border border-slate-200 bg-white text-xs sm:text-[13px] font-semibold text-slate-700 shadow-2xs hover:bg-slate-100 active:scale-98 disabled:opacity-50 transition-all dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={loading}
                className={`h-10 sm:h-11 px-5 sm:px-6 rounded-xl text-xs sm:text-[13px] font-semibold flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-60 cursor-pointer ${config.buttonBg}`}
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span>{confirmLoadingText || config.loadingText}</span>
                  </>
                ) : (
                  <>
                    <ButtonIcon size={15} />
                    <span>{confirmText || config.confirmText}</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
