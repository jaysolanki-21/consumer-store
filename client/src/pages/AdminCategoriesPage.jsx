import { useEffect, useState, useMemo } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import {
  FiEdit2,
  FiTrash2,
  FiPlus,
  FiX,
  FiPackage,
  FiFolder,
  FiCalendar,
  FiSearch,
  FiChevronLeft,
  FiChevronRight,
  FiArrowUp,
  FiArrowDown
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100];

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ name: '' });
  const [loading, setLoading] = useState(false);

  // ✅ Filter & pagination state
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    fetchCategories();
    fetchProducts();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data } = await api.get('/categories');
      setCategories(data);
    } catch (error) {
      toast.error('Failed to load categories');
    }
  };

  const fetchProducts = async () => {
    try {
      const { data } = await api.get('/products');
      setProducts(data);
    } catch (error) {
      toast.error('Failed to load products');
    }
  };

  const getProductCount = (categoryId) => {
    return products.filter((p) => p.categoryId?._id === categoryId).length;
  };

  /* ---------- FILTER + SORT ---------- */
  const filteredCategories = useMemo(() => {
    let result = [...categories];

    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter((c) => c.name.toLowerCase().includes(term));
    }

    switch (sortBy) {
      case 'name':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'products':
        result.sort(
          (a, b) => getProductCount(a._id) - getProductCount(b._id)
        );
        break;
      case 'createdAt':
        result.sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
        );
        break;
      default:
        break;
    }

    if (sortOrder === 'desc') {
      result.reverse();
    }

    return result;
  }, [categories, products, search, sortBy, sortOrder]);

  /* ---------- PAGINATION ---------- */
  const totalItems = filteredCategories.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  useEffect(() => {
    setPage(1);
  }, [search, sortBy, sortOrder, pageSize]);

  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const pagedCategories = useMemo(
    () => filteredCategories.slice(startIndex, startIndex + pageSize),
    [filteredCategories, startIndex, pageSize]
  );

  const toggleSort = (type) => {
    if (sortBy === type) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(type);
      setSortOrder('asc');
    }
  };

  /* ---------- HANDLERS ---------- */

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Missing name',
        text: 'Category name is required',
        confirmButtonColor: '#6366f1'
      });
      return;
    }

    const confirmResult = await Swal.fire({
      title: editing ? 'Update category?' : 'Create category?',
      html: editing
        ? `Rename to <b>${formData.name}</b>?`
        : `Create new category <b>${formData.name}</b>?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#6366f1',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: editing ? 'Yes, update' : 'Yes, create',
      cancelButtonText: 'Cancel'
    });

    if (!confirmResult.isConfirmed) return;

    setLoading(true);

    try {
      if (editing) {
        await api.put(`/categories/${editing}`, { name: formData.name });
        toast.success('Category updated');
      } else {
        await api.post('/categories', { name: formData.name });
        toast.success('Category created');
      }

      Swal.fire({
        icon: 'success',
        title: editing ? 'Updated!' : 'Created!',
        text: `Category "${formData.name}" ${
          editing ? 'updated' : 'created'
        } successfully.`,
        timer: 1500,
        showConfirmButton: false
      });

      fetchCategories();
      closeModal();
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Operation failed',
        text:
          error.response?.data?.message ||
          'Something went wrong. Please try again.',
        confirmButtonColor: '#dc2626'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, categoryName) => {
    const productCount = getProductCount(id);

    if (productCount > 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Cannot delete',
        html: `"<b>${categoryName}</b>" has <b>${productCount}</b> product${
          productCount !== 1 ? 's' : ''
        }.<br/>Please delete or move them first.`,
        confirmButtonColor: '#f59e0b'
      });
      return;
    }

    const result = await Swal.fire({
      title: 'Delete category?',
      html: `Are you sure you want to delete <b>${categoryName}</b>?<br/><span style="color:#dc2626;font-size:13px;">This action cannot be undone.</span>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel',
      reverseButtons: true
    });

    if (!result.isConfirmed) return;

    try {
      Swal.fire({
        title: 'Deleting...',
        text: 'Please wait',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });

      await api.delete(`/categories/${id}`);

      Swal.fire({
        icon: 'success',
        title: 'Deleted!',
        text: `Category "${categoryName}" has been deleted.`,
        timer: 1500,
        showConfirmButton: false
      });

      fetchCategories();
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Delete failed',
        text: error.response?.data?.message || 'Please try again.',
        confirmButtonColor: '#dc2626'
      });
    }
  };

  const openAddModal = () => {
    setEditing(null);
    setFormData({ name: '' });
    setModalOpen(true);
  };

  const openEditModal = (cat) => {
    setEditing(cat._id);
    setFormData({ name: cat.name });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setFormData({ name: '' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Category Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage product categories for your store
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-5 py-3 rounded-2xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
        >
          <FiPlus />
          Add Category
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-indigo-100 text-sm font-medium">
                Total Categories
              </p>
              <p className="text-3xl font-bold mt-1">{categories.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <FiFolder className="text-2xl text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-emerald-100 text-sm font-medium">
                Total Products
              </p>
              <p className="text-3xl font-bold mt-1">{products.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <FiPackage className="text-2xl text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Search + Sort (Rows per page moved to bottom) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-4">
        <div className="relative">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-11 pl-11 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <FiX />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500">Sort by:</span>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => toggleSort('name')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                sortBy === 'name'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Name
              {sortBy === 'name' &&
                (sortOrder === 'asc' ? (
                  <FiArrowUp className="text-xs" />
                ) : (
                  <FiArrowDown className="text-xs" />
                ))}
            </button>
            <button
              onClick={() => toggleSort('products')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                sortBy === 'products'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Products
              {sortBy === 'products' &&
                (sortOrder === 'asc' ? (
                  <FiArrowUp className="text-xs" />
                ) : (
                  <FiArrowDown className="text-xs" />
                ))}
            </button>
            <button
              onClick={() => toggleSort('createdAt')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                sortBy === 'createdAt'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Created
              {sortBy === 'createdAt' &&
                (sortOrder === 'asc' ? (
                  <FiArrowUp className="text-xs" />
                ) : (
                  <FiArrowDown className="text-xs" />
                ))}
            </button>
          </div>
        </div>
      </div>

      {/* Category Table */}
      {filteredCategories.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-16 text-center shadow-sm">
          <FiFolder className="mx-auto text-5xl text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold">No categories found</h3>
          <p className="text-slate-500 mt-1">
            {search
              ? 'Try a different search term'
              : 'Create your first category'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Products</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {pagedCategories.map((cat) => {
                  const productCount = getProductCount(cat._id);

                  return (
                    <tr
                      key={cat._id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-md shrink-0">
                            <FiFolder className="text-lg" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 dark:text-white text-sm">
                              {cat.name}
                            </span>
                            <span className="text-xs text-slate-400 font-mono">
                              #{cat._id.slice(-6)}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                            productCount > 0
                              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <FiPackage className="text-xs" />
                          {productCount}{' '}
                          {productCount === 1 ? 'product' : 'products'}
                        </span>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                          <FiCalendar className="text-xs" />
                          {new Date(cat.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </div>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => openEditModal(cat)}
                            title="Edit"
                            className="w-9 h-9 rounded-xl bg-blue-100 hover:bg-blue-200 text-blue-600 flex items-center justify-center transition"
                          >
                            <FiEdit2 className="text-sm" />
                          </button>

                          <button
                            onClick={() => handleDelete(cat._id, cat.name)}
                            title="Delete"
                            className="w-9 h-9 rounded-xl bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center transition"
                          >
                            <FiTrash2 className="text-sm" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ✅ Pagination Footer — Rows per page moved here */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 px-5 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
            <p className="text-sm text-slate-500">
              Showing{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {totalItems === 0 ? 0 : startIndex + 1}–{endIndex}
              </span>{' '}
              of{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {totalItems}
              </span>{' '}
              categories
            </p>

            <div className="flex items-center gap-2 flex-wrap">
              {/* ✅ Rows per page */}
              <div className="flex items-center gap-2 mr-2">
                <span className="text-sm text-slate-500 whitespace-nowrap">
                  Rows per page:
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 flex items-center gap-1 text-sm"
              >
                <FiChevronLeft /> Prev
              </button>

              <div className="flex items-center gap-1">
                {(() => {
                  const pages = [];
                  const maxShown = 5;
                  let startPage = Math.max(1, page - Math.floor(maxShown / 2));
                  let endPage = Math.min(
                    totalPages,
                    startPage + maxShown - 1
                  );
                  if (endPage - startPage < maxShown - 1) {
                    startPage = Math.max(1, endPage - maxShown + 1);
                  }
                  for (let i = startPage; i <= endPage; i++) pages.push(i);

                  return (
                    <>
                      {startPage > 1 && (
                        <>
                          <button
                            onClick={() => setPage(1)}
                            className={`h-9 w-9 rounded-lg text-sm ${
                              page === 1
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            1
                          </button>
                          {startPage > 2 && (
                            <span className="px-1 text-slate-400">…</span>
                          )}
                        </>
                      )}

                      {pages.map((n) => (
                        <button
                          key={n}
                          onClick={() => setPage(n)}
                          className={`h-9 w-9 rounded-lg text-sm font-medium ${
                            n === page
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          {n}
                        </button>
                      ))}

                      {endPage < totalPages && (
                        <>
                          {endPage < totalPages - 1 && (
                            <span className="px-1 text-slate-400">…</span>
                          )}
                          <button
                            onClick={() => setPage(totalPages)}
                            className={`h-9 w-9 rounded-lg text-sm ${
                              page === totalPages
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {totalPages}
                          </button>
                        </>
                      )}
                    </>
                  );
                })()}
              </div>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 flex items-center gap-1 text-sm"
              >
                Next <FiChevronRight />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center px-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6"
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-2xl font-bold">
                    {editing ? 'Edit Category' : 'Create Category'}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Add category details below
                  </p>
                </div>

                <button
                  onClick={closeModal}
                  className="w-10 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition"
                >
                  <FiX size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="mb-5">
                  <label className="block text-sm font-semibold mb-2">
                    Category Name
                  </label>

                  <input
                    type="text"
                    placeholder="Enter category name"
                    value={formData.name}
                    onChange={(e) => setFormData({ name: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 py-3 rounded-2xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : editing ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}