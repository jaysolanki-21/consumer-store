import React from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

export default function PaginationBar({
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  pageSize = 25,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  isLoading = false,
  label = "orders",
}) {
  if (totalItems === 0) return null;

  const startItem = Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 4) {
        pages.push(1, 2, 3, 4, 5, "...", totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(
          1,
          "...",
          totalPages - 4,
          totalPages - 3,
          totalPages - 2,
          totalPages - 1,
          totalPages
        );
      } else {
        pages.push(
          1,
          "...",
          currentPage - 1,
          currentPage,
          currentPage + 1,
          "...",
          totalPages
        );
      }
    }
    return pages;
  };

  return (
    <div className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 py-3 px-4 sm:px-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs text-xs sm:text-sm">
      {/* Left: Range and Total */}
      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-medium">
        <span>
          Showing <strong className="text-slate-900 dark:text-white font-semibold">{startItem}–{endItem}</strong> of{" "}
          <strong className="text-slate-900 dark:text-white font-semibold">{totalItems}</strong> {label}
        </span>
      </div>

      {/* Middle & Right: Page Size Selector + Navigation */}
      <div className="flex flex-wrap items-center gap-3 sm:gap-4 justify-between sm:justify-end">
        {/* Page size selector */}
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
          <span className="text-xs whitespace-nowrap">Orders per page:</span>
          <select
            value={pageSize}
            disabled={isLoading}
            onChange={(e) => {
              const newSize = Number(e.target.value);
              if (onPageSizeChange) onPageSizeChange(newSize);
            }}
            className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs focus:ring-2 focus:ring-indigo-500 outline-hidden cursor-pointer"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Page navigation buttons */}
        <div className="flex items-center gap-1">
          {/* Previous button */}
          <button
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1 || isLoading}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-50 dark:hover:bg-slate-700/80 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            title="Previous page"
          >
            <FiChevronLeft className="w-4 h-4" />
            <span className="hidden xs:inline">Previous</span>
          </button>

          {/* Page numbers */}
          <div className="flex items-center gap-1">
            {getPageNumbers().map((p, idx) => {
              if (p === "...") {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="px-2 py-1 text-slate-400 dark:text-slate-600 text-xs select-none"
                  >
                    …
                  </span>
                );
              }
              const isActive = p === currentPage;
              return (
                <button
                  key={`page-${p}`}
                  type="button"
                  onClick={() => onPageChange(p)}
                  disabled={isLoading}
                  className={`min-w-[32px] h-8 px-2 rounded-xl text-xs font-semibold flex items-center justify-center transition-all ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-xs font-bold"
                      : "border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/80"
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>

          {/* Next button */}
          <button
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || isLoading}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs hover:bg-slate-50 dark:hover:bg-slate-700/80 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            title="Next page"
          >
            <span className="hidden xs:inline">Next</span>
            <FiChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
