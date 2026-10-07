import React from "react";
import { FaRupeeSign } from "react-icons/fa";
import {
  FiFilter,
  FiRotateCcw,
  FiCheck,
  FiDollarSign,
  FiPackage,
  FiLayers,
} from "react-icons/fi";

const QUICK_PRICE_RANGES = [
  { label: "All Prices", min: "", max: "" },
  { label: "Under ₹50", min: "0", max: "50" },
  { label: "₹50 - ₹100", min: "50", max: "100" },
  { label: "₹100 - ₹250", min: "100", max: "250" },
  { label: "₹250 - ₹500", min: "250", max: "500" },
  { label: "Above ₹500", min: "500", max: "" },
];

/**
 * FilterContent renders the actual filter sections:
 * 1. Category checkboxes
 * 2. Price range inputs & quick ranges
 * 3. Stock availability radios
 */
export function FilterContent({
  categories = [],
  categoryCounts = {},
  selectedCategories = [],
  onToggleCategory,
  onSelectAllCategories,
  minPrice,
  maxPrice,
  onPriceChange,
  stockAvailability = "ALL",
  onStockAvailabilityChange,
  availabilityCounts = { inStock: 0, lowStock: 0, outOfStock: 0, all: 0 },
  onResetFilters,
  activeFilterCount = 0,
}) {
  return (
    <div className="space-y-6 divide-y divide-slate-100 dark:divide-slate-800/80">
      {/* 1. Category Filter */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <FiLayers className="text-indigo-600 dark:text-indigo-400 text-sm" />
            Categories
          </span>
          {selectedCategories.length > 0 && (
            <button
              type="button"
              onClick={onSelectAllCategories}
              className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Clear
            </button>
          )}
        </div>

        <div className="space-y-1 max-h-56 overflow-y-auto pr-1 scrollbar-thin">
          {categories.map((cat) => {
            const isSelected = selectedCategories.includes(cat._id);
            const count = categoryCounts[cat._id] || 0;
            return (
              <label
                key={cat._id}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-pointer text-xs sm:text-sm transition select-none ${
                  isSelected
                    ? "bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-normal"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleCategory(cat._id)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 cursor-pointer flex-shrink-0"
                  />
                  <span className="truncate">{cat.name}</span>
                </div>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                    isSelected
                      ? "bg-indigo-200/60 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {count}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* 2. Price Range Filter */}
      <div className="space-y-3 pt-5">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <FaRupeeSign className="text-indigo-600 dark:text-indigo-400 text-sm" />
          Price Range
        </span>

        {/* Min / Max Inputs */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
              Min Price
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">
                ₹
              </span>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={minPrice}
                onChange={(e) => onPriceChange(e.target.value, maxPrice)}
                className="w-full pl-6 pr-2 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
              Max Price
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">
                ₹
              </span>
              <input
                type="number"
                min="0"
                placeholder="Any"
                value={maxPrice}
                onChange={(e) => onPriceChange(minPrice, e.target.value)}
                className="w-full pl-6 pr-2 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Quick Range Options */}
        <div className="pt-1">
          <p className="text-[11px] font-medium text-slate-400 mb-1.5">
            Quick Ranges:
          </p>
          <div className="flex flex-wrap gap-1">
            {QUICK_PRICE_RANGES.map((range, idx) => {
              const isRangeActive =
                String(minPrice) === range.min &&
                String(maxPrice) === range.max;
              return (
                <button
                  type="button"
                  key={idx}
                  onClick={() => onPriceChange(range.min, range.max)}
                  className={`px-2 py-1 text-[11px] rounded-lg transition font-medium border ${
                    isRangeActive
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                      : "bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                  }`}
                >
                  {range.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Availability Filter */}
      <div className="space-y-3 pt-5">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <FiPackage className="text-indigo-600 dark:text-indigo-400 text-sm" />
          Availability
        </span>

        <div className="space-y-1">
          {[
            {
              id: "ALL",
              label: "All Products",
              count: availabilityCounts.all,
              color: "text-slate-700 dark:text-slate-300",
            },
            {
              id: "IN_STOCK",
              label: "In Stock Only",
              count: availabilityCounts.inStock,
              color: "text-emerald-600 dark:text-emerald-400 font-medium",
            },
            {
              id: "LOW_STOCK",
              label: "Low Stock",
              count: availabilityCounts.lowStock,
              color: "text-amber-600 dark:text-amber-400 font-medium",
            },
            {
              id: "OUT_OF_STOCK",
              label: "Out of Stock",
              count: availabilityCounts.outOfStock,
              color: "text-rose-600 dark:text-rose-400 font-medium",
            },
          ].map((option) => (
            <label
              key={option.id}
              className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-pointer text-xs sm:text-sm transition select-none ${
                stockAvailability === option.id
                  ? "bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold"
                  : "hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <input
                  type="radio"
                  name="stockAvailabilityRadio"
                  checked={stockAvailability === option.id}
                  onChange={() => onStockAvailabilityChange(option.id)}
                  className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 cursor-pointer"
                />
                <span className={option.color}>{option.label}</span>
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                {option.count}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Permanent Left Filter Sidebar for Desktop (visible on lg screens and up)
 */
export default function ConsumerFilterSidebar(props) {
  const { onResetFilters, activeFilterCount } = props;

  return (
    <aside className="w-64 xl:w-72 flex-shrink-0 self-start sticky top-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between pb-3.5 mb-1 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <FiFilter className="text-sm" />
          </div>
          <span className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">
            Filters
          </span>
          {activeFilterCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </div>

        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={onResetFilters}
            className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:underline flex items-center gap-1 transition"
          >
            <FiRotateCcw className="text-[10px]" />
            Clear All
          </button>
        )}
      </div>

      {/* Filter Options Content */}
      <FilterContent {...props} />
    </aside>
  );
}
