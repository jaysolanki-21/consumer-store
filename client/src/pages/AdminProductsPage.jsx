import { useEffect, useState, useMemo } from "react";
import api from "../services/api";
import socket from "../services/socket";
import toast from "react-hot-toast";
import { FiTrendingUp } from "react-icons/fi";

import {
  FiEdit2,
  FiTrash2,
  FiPackage,
  FiPlus,
  FiEye,
  FiEyeOff,
  FiAlertTriangle,
  FiImage,
  FiSearch,
  FiBox,
  FiLayers,
  FiDollarSign,
  FiUpload,
  FiLink,
} from "react-icons/fi";

import { FaRupeeSign } from "react-icons/fa";

export default function AdminProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  // Form fields
  const [form, setForm] = useState({
    name: "",
    price: "",
    stock: "",
    categoryId: "",
    lowStockThreshold: 5,
    visibility: true,
  });

  // Image handling
  const [imageMethod, setImageMethod] = useState("file"); // 'file' or 'url'
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingImage, setFetchingImage] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  useEffect(() => {
    const handleStockUpdate = () => fetchProducts();
    socket.on("stockUpdated", handleStockUpdate);
    return () => socket.off("stockUpdated", handleStockUpdate);
  }, []);

  const fetchProducts = async () => {
    try {
      const { data } = await api.get("/products");
      setProducts(data);
    } catch (err) {
      toast.error("Failed to load products");
    }
  };

  const fetchCategories = async () => {
    try {
      const { data } = await api.get("/categories");
      setCategories(data);
    } catch (err) {
      toast.error("Failed to load categories");
    }
  };

  const resetFormFields = () => {
    setEditing(null);
    setForm({
      name: "",
      price: "",
      stock: "",
      categoryId: "",
      lowStockThreshold: 5,
      visibility: true,
    });
    setImageMethod("file");
    setImageFile(null);
    setImageUrl("");
    setImagePreview("");
  };

  const resetForm = () => {
    resetFormFields();
    setShowForm(false);
  };

  // Convert URL to File blob
  const urlToFile = async (url, filename = "image.jpg") => {
    const response = await fetch(url);
    const blob = await response.blob();
    return new File([blob], filename, { type: blob.type });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData();
    formData.append("name", form.name);
    formData.append("price", form.price);
    formData.append("stock", form.stock);
    formData.append("categoryId", form.categoryId);
    formData.append("lowStockThreshold", form.lowStockThreshold);
    formData.append("visibility", form.visibility);

    // Handle image
    try {
      if (imageMethod === "file" && imageFile) {
        formData.append("image", imageFile);
      } else if (imageMethod === "url" && imageUrl) {
        // Validate URL
        const urlPattern = /^(https?:\/\/.*\.(jpg|jpeg|png|webp|gif|svg))$/i;
        if (!urlPattern.test(imageUrl)) {
          toast.error("Please enter a valid image URL (jpg, png, webp, etc.)");
          setLoading(false);
          return;
        }
        setFetchingImage(true);
        const file = await urlToFile(imageUrl, `${Date.now()}.jpg`);
        formData.append("image", file);
        setFetchingImage(false);
      }
    } catch (err) {
      toast.error(
        "Failed to load image from URL. Please try a direct image link.",
      );
      setLoading(false);
      setFetchingImage(false);
      return;
    }

    try {
      if (editing) {
        await api.put(`/products/${editing}`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success("Product updated successfully");
      } else {
        await api.post("/products", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success("Product created successfully");
      }
      fetchProducts();
      resetForm();
    } catch (err) {
      toast.error(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
      setFetchingImage(false);
    }
  };

  const handleEdit = (product) => {
    setEditing(product._id);
    setForm({
      name: product.name,
      price: product.price,
      stock: product.stock,
      categoryId: product.categoryId?._id || product.categoryId,
      lowStockThreshold: product.lowStockThreshold,
      visibility: product.visibility,
    });
    setImagePreview(product.image || "");
    setImageFile(null);
    setImageUrl(product.image || "");
    setImageMethod(product.image ? "url" : "file"); // if image exists, default to url mode
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this product?")) return;
    try {
      await api.delete(`/products/${id}`);
      toast.success("Product deleted");
      fetchProducts();
    } catch (err) {
      toast.error("Delete failed");
    }
  };

  const handleImageFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setImageUrl("");
    }
  };

  const handleImageUrlChange = (e) => {
    const url = e.target.value;
    setImageUrl(url);
    setImagePreview(url);
    setImageFile(null);
  };

  const toggleVisibility = async (product) => {
    if (togglingId) return;
    setTogglingId(product._id);
    setProducts((prev) =>
      prev.map((p) =>
        p._id === product._id ? { ...p, visibility: !p.visibility } : p,
      ),
    );
    try {
      const newVisibility = !product.visibility;
      await api.put(`/products/${product._id}`, {
        name: product.name,
        price: product.price,
        stock: product.stock,
        categoryId: product.categoryId?._id || product.categoryId,
        lowStockThreshold: product.lowStockThreshold,
        visibility: newVisibility,
      });
      toast.success(
        `Product ${newVisibility ? "visible" : "hidden"} successfully`,
      );
    } catch (err) {
      setProducts((prev) =>
        prev.map((p) =>
          p._id === product._id ? { ...p, visibility: product.visibility } : p,
        ),
      );
      toast.error("Failed to update visibility");
    } finally {
      setTogglingId(null);
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        !selectedCategory || p.categoryId?._id === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, selectedCategory]);

  const stats = useMemo(() => {
    return {
      total: products.length,
      visible: products.filter((p) => p.visibility).length,
      hidden: products.filter((p) => !p.visibility).length,
      lowStock: products.filter((p) => p.stock <= p.lowStockThreshold).length,
    };
  }, [products]);

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white">
            Product Management
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Manage inventory, visibility and stock
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full lg:w-80">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 pr-10 outline-none focus:ring-2 focus:ring-indigo-500/30 appearance-none cursor-pointer"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat._id} value={cat._id}>
                  {cat.name}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <FiLayers className="text-slate-400" />
            </div>
          </div>
          <button
            onClick={() => {
              resetFormFields();
              setEditing(null);
              setShowForm(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-2xl flex items-center gap-2 font-semibold shadow-lg transition"
          >
            <FiPlus /> Add Product
          </button>
        </div>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Total Products Card */}
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-4 text-white shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-indigo-100 text-sm">Total Products</p>
              <p className="text-3xl font-bold mt-1">{stats.total}</p>
            </div>
            <FiPackage className="text-3xl text-indigo-200" />
          </div>
        </div>

        {/* Visible Products Card */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-emerald-100 text-sm">Visible Products</p>
              <p className="text-3xl font-bold mt-1">{stats.visible}</p>
            </div>
            <FiEye className="text-3xl text-emerald-200" />
          </div>
        </div>

        {/* Hidden Products Card */}
        <div className="bg-gradient-to-br from-slate-600 to-slate-700 rounded-xl p-4 text-white shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-300 text-sm">Hidden Products</p>
              <p className="text-3xl font-bold mt-1">{stats.hidden}</p>
            </div>
            <FiEyeOff className="text-3xl text-slate-300" />
          </div>
        </div>

        {/* Low Stock Alert Card */}
        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-xl p-4 text-white shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-orange-100 text-sm">Low Stock Alerts</p>
              <p className="text-3xl font-bold mt-1">{stats.lowStock}</p>
            </div>
            <FiAlertTriangle className="text-3xl text-orange-200" />
          </div>
        </div>
      </div>
      {/* PRODUCT FORM (Add/Edit) */}
      {showForm && (
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border overflow-hidden">
          <div className="px-6 py-5 border-b flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-xl">
                {editing ? <FiEdit2 /> : <FiPlus />}
              </div>
              <div>
                <h2 className="text-xl font-bold">
                  {editing ? "Edit Product" : "Add New Product"}
                </h2>
                <p className="text-sm text-slate-500">
                  Fill product information below
                </p>
              </div>
            </div>
            <button
              onClick={resetForm}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              ✕
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Product Name
                </label>
                <input
                  type="text"
                  placeholder="Enter product name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/30"
                  required
                />
              </div>
              {/* Price */}
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Price
                </label>
                <div className="relative">
                  <FaRupeeSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="number"
                    placeholder="Price"
                    value={form.price}
                    onChange={(e) =>
                      setForm({ ...form, price: e.target.value })
                    }
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/30"
                    required
                  />
                </div>
              </div>
              {/* Stock */}
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Stock
                </label>
                <input
                  type="number"
                  placeholder="Stock quantity"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/30"
                  required
                />
              </div>
              {/* Category */}
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Category
                </label>
                <select
                  value={form.categoryId}
                  onChange={(e) =>
                    setForm({ ...form, categoryId: e.target.value })
                  }
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/30"
                  required
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              {/* Low Stock Threshold */}
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Low Stock Threshold
                </label>
                <input
                  type="number"
                  value={form.lowStockThreshold}
                  onChange={(e) =>
                    setForm({ ...form, lowStockThreshold: e.target.value })
                  }
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>
              {/* Visibility Toggle */}
              <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 rounded-2xl px-4 py-3 border">
                <div>
                  <p className="text-sm font-semibold">Product Visibility</p>
                  <p className="text-xs text-slate-500">
                    Show or hide product from customers
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setForm({ ...form, visibility: !form.visibility })
                  }
                  className={`relative inline-flex h-7 w-14 items-center rounded-full transition-all duration-300 ${
                    form.visibility
                      ? "bg-emerald-500"
                      : "bg-slate-300 dark:bg-slate-600"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-all duration-300 ${
                      form.visibility ? "translate-x-8" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Image Upload Section with Toggle */}
              <div className="md:col-span-2 xl:col-span-3">
                <label className="block text-sm font-semibold mb-2">
                  Product Image
                </label>
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl p-6 bg-slate-50 dark:bg-slate-900">
                  {/* Toggle buttons */}
                  <div className="flex gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => setImageMethod("file")}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
                        imageMethod === "file"
                          ? "bg-indigo-600 text-white"
                          : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <FiUpload /> Upload File
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageMethod("url")}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
                        imageMethod === "url"
                          ? "bg-indigo-600 text-white"
                          : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <FiLink /> Image URL
                    </button>
                  </div>

                  {/* File upload mode */}
                  {imageMethod === "file" && (
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageFileChange}
                      className="w-full rounded-2xl border px-4 py-3"
                    />
                  )}

                  {/* URL mode */}
                  {imageMethod === "url" && (
                    <input
                      type="text"
                      placeholder="Enter image URL (https://...)"
                      value={imageUrl}
                      onChange={handleImageUrlChange}
                      className="w-full rounded-2xl border px-4 py-3"
                    />
                  )}

                  {/* Image preview */}
                  {imagePreview && (
                    <div className="mt-4">
                      <p className="text-sm font-medium mb-2">Preview:</p>
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-36 h-36 rounded-xl object-cover border"
                        onError={() => setImagePreview("")}
                      />
                    </div>
                  )}
                  <p className="text-sm text-slate-500 mt-3">
                    {imageMethod === "file"
                      ? "Upload high-quality product image"
                      : "Enter a direct image URL (JPEG, PNG, WEBP)"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 mt-8">
              <button
                type="submit"
                disabled={loading || fetchingImage}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-6 py-3 rounded-2xl font-semibold shadow-lg transition disabled:opacity-50"
              >
                {loading || fetchingImage
                  ? fetchingImage
                    ? "Fetching Image..."
                    : "Saving..."
                  : editing
                    ? "Update Product"
                    : "Create Product"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 px-6 py-3 rounded-2xl font-semibold transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PRODUCTS TABLE */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
  <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3">
    <div className="w-11 h-11 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 flex items-center justify-center">
      <FiBox className="text-xl" />
    </div>
    <div>
      <h2 className="text-lg font-semibold text-slate-800 dark:text-white">All Products</h2>
      <p className="text-sm text-slate-500">Total {filteredProducts.length} products</p>
      {(selectedCategory || search) && (
        <p className="text-xs text-indigo-500 mt-0.5">
          Filtered by{" "}
          {selectedCategory
            ? `category: ${categories.find((c) => c._id === selectedCategory)?.name}`
            : ""}
          {search && `, search: "${search}"`}
        </p>
      )}
    </div>
  </div>
  
  <div className="overflow-x-auto">
    <table className="w-full min-w-[1100px]">
      <thead className="bg-slate-50 dark:bg-slate-900">
        <tr>
          <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Product</th>
          <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Category</th>
          <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Price</th>
          <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Stock</th>
          <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Reserved</th>
          <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Available</th>
          <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Visibility</th>
          <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
        {filteredProducts.map((p) => {
          const reserved = p.reservedStock || 0;
          const available = (p.stock || 0) - reserved;
          const isLowStock = available <= p.lowStockThreshold;
          return (
            <tr
              key={p._id}
              className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition duration-150"
            >
              <td className="px-6 py-4">
                <div className="flex items-center gap-4">
                  <img
                    src={p.image || "https://via.placeholder.com/60"}
                    alt={p.name}
                    className="w-14 h-14 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                  />
                  <div>
                    <p className="font-semibold text-base text-slate-800 dark:text-white">{p.name}</p>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">ID: {p._id.slice(-6)}</p>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-sm font-medium">
                  <FiLayers className="text-xs" /> {p.categoryId?.name || "No Category"}
                </span>
              </td>
              <td className="px-6 py-4">
                <span className="font-semibold text-base text-green-600 dark:text-green-400">₹{p.price}</span>
              </td>
              <td className="px-6 py-4">
                <span className="font-mono text-base font-medium text-slate-700 dark:text-slate-300">{p.stock}</span>
              </td>
              <td className="px-6 py-4">
                <span className="font-mono text-base font-medium text-amber-600 dark:text-amber-400">{reserved}</span>
              </td>
              <td className="px-6 py-4">
                <span className={`font-mono text-base font-semibold ${available <= 0 ? "text-red-600 dark:text-red-400" : isLowStock ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}`}>
                  {available}
                </span>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleVisibility(p)}
                    disabled={togglingId === p._id}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 ${
                      p.visibility
                        ? "bg-emerald-500"
                        : "bg-slate-300 dark:bg-slate-600"
                    } ${togglingId === p._id ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-all duration-300 ${p.visibility ? "translate-x-6" : "translate-x-1"}`}
                    />
                    {togglingId === p._id && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      </span>
                    )}
                  </button>
                  <span className={`text-sm font-medium ${p.visibility ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500"}`}>
                    {p.visibility ? "Visible" : "Hidden"}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => handleEdit(p)}
                    className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-600 flex items-center justify-center transition"
                    title="Edit product"
                  >
                    <FiEdit2 className="text-base" />
                  </button>
                  <button
                    onClick={() => handleDelete(p._id)}
                    className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-600 flex items-center justify-center transition"
                    title="Delete product"
                  >
                    <FiTrash2 className="text-base" />
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
        {filteredProducts.length === 0 && (
          <tr>
            <td colSpan="8" className="text-center py-16 text-slate-500">
              <FiPackage className="mx-auto text-4xl text-slate-300 mb-3" />
              <p className="text-base">No products found</p>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
</div>
    </div>
  );
}
