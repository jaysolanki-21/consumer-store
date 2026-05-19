import { useEffect, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  FiEdit2,
  FiTrash2,
  FiPlus,
  FiX,
  FiPackage,
  FiFolder,
  FiCalendar,
  FiTrendingUp,
  FiAlertTriangle
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ name: '' });
  const [loading, setLoading] = useState(false);

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
    return products.filter(
      (p) => p.categoryId?._id === categoryId
    ).length;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Category name is required');
      return;
    }

    setLoading(true);

    try {
      if (editing) {
        await api.put(`/categories/${editing}`, {
          name: formData.name,
        });

        toast.success('Category updated');
      } else {
        await api.post('/categories', {
          name: formData.name,
        });

        toast.success('Category created');
      }

      fetchCategories();
      closeModal();
    } catch (error) {
      toast.error(
        error.response?.data?.message || 'Operation failed'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, categoryName) => {
    const productCount = getProductCount(id);

    if (productCount > 0) {
      toast.error(
        `"${categoryName}" has ${productCount} product(s).`
      );
      return;
    }

    if (!window.confirm(`Delete "${categoryName}" ?`)) return;

    try {
      await api.delete(`/categories/${id}`);
      toast.success('Category deleted');
      fetchCategories();
    } catch (error) {
      toast.error(
        error.response?.data?.message || 'Delete failed'
      );
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
  {/* Total Categories Card */}
  <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-indigo-100 text-sm font-medium">Total Categories</p>
        <p className="text-3xl font-bold mt-1">{categories.length}</p>
      </div>
      <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
        <FiFolder className="text-2xl text-white" />
      </div>
    </div>
    
  </div>

  {/* Total Products Card */}
  <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-emerald-100 text-sm font-medium">Total Products</p>
        <p className="text-3xl font-bold mt-1">{products.length}</p>
      </div>
      <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
        <FiPackage className="text-2xl text-white" />
      </div>
    </div>
   
  </div>
</div>

      {/* Category Cards */}
      {categories.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-16 text-center shadow-sm">
          <FiFolder className="mx-auto text-5xl text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold">
            No categories found
          </h3>
          <p className="text-slate-500 mt-1">
            Create your first category
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          <AnimatePresence>
            {categories.map((cat) => {
              const productCount = getProductCount(cat._id);

              return (
                <motion.div
                  key={cat._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  whileHover={{ y: -3 }}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm transition-all"
                >
                  {/* Top */}
                  <div className="flex items-start justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-md">
                        <FiFolder className="text-2xl" />
                      </div>

                      <div>
                        <h2 className="font-bold text-lg">
                          {cat.name}
                        </h2>

                        <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                          <FiCalendar />
                          {new Date(
                            cat.createdAt
                          ).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Product Count */}
                  <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 rounded-2xl px-4 py-3 mb-5">
                    <div className="flex items-center gap-2">
                      <FiPackage className="text-indigo-500" />
                      <span className="text-sm font-medium">
                        Products
                      </span>
                    </div>

                    <span
                      className={`text-sm font-bold px-3 py-1 rounded-full ${
                        productCount > 0
                          ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                          : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {productCount}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => openEditModal(cat)}
                      className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 py-2.5 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all"
                    >
                      <FiEdit2 />
                      Edit
                    </button>

                    <button
                      onClick={() =>
                        handleDelete(cat._id, cat.name)
                      }
                      className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 py-2.5 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all"
                    >
                      <FiTrash2 />
                      Delete
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
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
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-2xl font-bold">
                    {editing
                      ? 'Edit Category'
                      : 'Create Category'}
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

              {/* Form */}
              <form onSubmit={handleSubmit}>
                <div className="mb-5">
                  <label className="block text-sm font-semibold mb-2">
                    Category Name
                  </label>

                  <input
                    type="text"
                    placeholder="Enter category name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({
                        name: e.target.value,
                      })
                    }
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
                    {loading
                      ? 'Saving...'
                      : editing
                      ? 'Update'
                      : 'Create'}
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