import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiFilter, FiX, FiRotateCcw } from "react-icons/fi";
import { FilterContent } from "./ConsumerFilterSidebar";

/**
 * Mobile-only Filter Bottom Sheet / Modal
 * Displays the exact same FilterContent in a touch-friendly bottom sheet
 */
export default function MobileFilterDrawer(props) {
  const {
    isOpen,
    onClose,
    onResetFilters,
    activeFilterCount = 0,
    matchingProductsCount = 0,
  } = props;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
          />

          {/* Bottom Sheet Drawer */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="relative w-full max-h-[85vh] bg-white dark:bg-slate-900 shadow-2xl rounded-t-3xl flex flex-col z-10 border-t border-slate-200 dark:border-slate-800"
          >
            {/* Sheet Handle */}
            <div className="pt-3 pb-1 flex justify-center">
              <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
            </div>

            {/* Header */}
            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                  <FiFilter className="text-sm" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white text-base flex items-center gap-2">
                    Filter Products
                    {activeFilterCount > 0 && (
                      <span className="text-xs bg-indigo-600 text-white font-semibold px-2 py-0.5 rounded-full">
                        {activeFilterCount}
                      </span>
                    )}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={onResetFilters}
                    className="text-xs text-rose-600 dark:text-rose-400 font-semibold px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition flex items-center gap-1"
                  >
                    <FiRotateCcw className="text-xs" />
                    Reset
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  aria-label="Close"
                >
                  <FiX className="text-xl" />
                </button>
              </div>
            </div>

            {/* Scrollable Filter Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <FilterContent {...props} />
            </div>

            {/* Sticky Mobile Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center gap-3">
              <button
                type="button"
                onClick={onResetFilters}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-sm transition"
              >
                Clear All
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md shadow-indigo-500/25 transition flex items-center justify-center gap-1.5"
              >
                <span>Apply Filters</span>
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-bold">
                  {matchingProductsCount}
                </span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
