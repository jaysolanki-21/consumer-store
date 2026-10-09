import { useEffect, useState, useMemo } from "react";
import api from "../services/api";
import socket from "../services/socket";
import toast from "react-hot-toast";
import Swal from "sweetalert2";
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
  FiChevronLeft,
  FiChevronRight,
  FiChevronUp,
  FiChevronDown,
} from "react-icons/fi";

import { FaRupeeSign } from "react-icons/fa";

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100];

export default function AdminProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  // ✅ Sorting
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");

  const toggleSort = (column) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  // ✅ Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Form fields
  const [form, setForm] = useState({
    name: "",
    costPrice: "",
    sellingPrice: "",
    stock: "",
    categoryId: "",
    lowStockThreshold: 5,
    visibility: true,
  });

  // Image handling
  const [imageMethod, setImageMethod] = useState("file");
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
      costPrice: "",
      sellingPrice: "",
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

  const urlToFile = async (url, filename = "image.jpg") => {
    try {
      const response = await fetch(url);
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const blob = await response.blob();
      let extension = "jpg";
      const contentType = response.headers.get("content-type");
      if (contentType) {
        if (contentType.includes("png")) extension = "png";
        else if (contentType.includes("webp")) extension = "webp";
        else if (contentType.includes("gif")) extension = "gif";
        else if (contentType.includes("jpeg")) extension = "jpg";
      }
      return new File([blob], `${Date.now()}.${extension}`, {
        type: blob.type,
      });
    } catch (err) {
      throw new Error("Failed to fetch image from URL");
    }
  };

  const handleResetReserved = async (product) => {
    if ((product.reservedStock || 0) <= 0) {
      toast.error("No reserved stock to reset");
      return;
    }

    const result = await Swal.fire({
      title: `Reset reserved stock for ${product.name}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Reset",
    });

    if (!result.isConfirmed) return;

    try {
      await api.patch(`/products/reset-reserved/${product._id}`);

      toast.success("Reserved stock reset successfully");

      setProducts((prev) =>
        prev.map((p) =>
          p._id === product._id
            ? {
                ...p,
                reservedStock: 0,
              }
            : p,
        ),
      );

      fetchProducts();
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to reset reserved stock",
      );
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (Number(form.sellingPrice) < Number(form.costPrice)) {
      toast.error("Selling price cannot be lower than buying price.");
      return;
    }
    setLoading(true);

    const formData = new FormData();
    formData.append("name", form.name);
    formData.append("costPrice", form.costPrice);
    formData.append("sellingPrice", form.sellingPrice);
    formData.append("price", form.sellingPrice);
    formData.append("stock", form.stock);
    formData.append("categoryId", form.categoryId);
    formData.append("lowStockThreshold", form.lowStockThreshold);
    formData.append("visibility", form.visibility);

    try {
      if (imageMethod === "file" && imageFile) {
        formData.append("image", imageFile);
      } else if (imageMethod === "url" && imageUrl) {
        if (!imageUrl.trim()) {
          toast.error("Please enter an image URL");
          setLoading(false);
          return;
        }

        setFetchingImage(true);
        try {
          const file = await urlToFile(imageUrl);
          formData.append("image", file);
        } catch (err) {
          toast.error(
            "Failed to load image from URL. Please check if the URL is valid and accessible.",
          );
          setLoading(false);
          setFetchingImage(false);
          return;
        }
        setFetchingImage(false);
      }
    } catch (err) {
      toast.error("Failed to process image. Please try again.");
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
      costPrice: product.costPrice ?? "",
      sellingPrice: product.sellingPrice ?? product.price,
      stock: product.stock,
      categoryId: product.categoryId?._id || product.categoryId,
      lowStockThreshold: product.lowStockThreshold,
      visibility: product.visibility,
    });
    setImagePreview(product.image || "");
    setImageFile(null);
    setImageUrl(product.image || "");
    setImageMethod(product.image ? "url" : "file");
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: "Delete this product?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      confirmButtonText: "Delete",
    });
    if (!result.isConfirmed) return;
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
        costPrice: product.costPrice || 0,
        sellingPrice: product.sellingPrice ?? product.price,
        price: product.sellingPrice ?? product.price,
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

  /* ---------- FILTER & SORT ---------- */
  const filteredProducts = useMemo(() => {
    let result = products.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        !selectedCategory || p.categoryId?._id === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    if (sortBy) {
      result.sort((a, b) => {
        let valA, valB;
        switch (sortBy) {
          case "name":
            return sortOrder === "asc"
              ? (a.name || "").localeCompare(b.name || "")
              : (b.name || "").localeCompare(a.name || "");
          case "category": {
            const catA = a.categoryId?.name || "";
            const catB = b.categoryId?.name || "";
            return sortOrder === "asc"
              ? catA.localeCompare(catB)
              : catB.localeCompare(catA);
          }
          case "sellingPrice": {
            valA = Number(a.sellingPrice ?? a.price ?? 0);
            valB = Number(b.sellingPrice ?? b.price ?? 0);
            return sortOrder === "asc" ? valA - valB : valB - valA;
          }
          case "costPrice": {
            valA = Number(a.costPrice ?? 0);
            valB = Number(b.costPrice ?? 0);
            return sortOrder === "asc" ? valA - valB : valB - valA;
          }
          case "profit": {
            valA = Number(a.sellingPrice ?? a.price ?? 0) - Number(a.costPrice ?? 0);
            valB = Number(b.sellingPrice ?? b.price ?? 0) - Number(b.costPrice ?? 0);
            return sortOrder === "asc" ? valA - valB : valB - valA;
          }
          case "stock": {
            valA = Number(a.stock ?? 0);
            valB = Number(b.stock ?? 0);
            return sortOrder === "asc" ? valA - valB : valB - valA;
          }
          case "reserved": {
            valA = Number(a.reservedStock ?? 0);
            valB = Number(b.reservedStock ?? 0);
            return sortOrder === "asc" ? valA - valB : valB - valA;
          }
          case "available": {
            valA = Number((a.stock ?? 0) - (a.reservedStock ?? 0));
            valB = Number((b.stock ?? 0) - (b.reservedStock ?? 0));
            return sortOrder === "asc" ? valA - valB : valB - valA;
          }
          case "visibility": {
            valA = a.visibility ? 1 : 0;
            valB = b.visibility ? 1 : 0;
            return sortOrder === "asc" ? valB - valA : valA - valB;
          }
          default:
            return 0;
        }
      });
    }

    return result;
  }, [products, search, selectedCategory, sortBy, sortOrder]);

  /* ---------- PAGINATION ---------- */
  const totalItems = filteredProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, selectedCategory, pageSize, sortBy, sortOrder]);

  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const pagedProducts = useMemo(
    () => filteredProducts.slice(startIndex, startIndex + pageSize),
    [filteredProducts, startIndex, pageSize],
  );

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
          <h1 className="text-[28px] sm:text-3xl font-bold text-slate-900 dark:text-[#F8FAFC] tracking-tight">
            Product Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-[#94A3B8] mt-1 font-normal">
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
        {/* Total Products */}
        <div className="bg-white dark:bg-[#111827] rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700/80 transition duration-150">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider">
                Total Products
              </span>
              <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100/80 dark:border-indigo-500/20 flex items-center justify-center">
                <FiPackage className="text-base" />
              </div>
            </div>
            <p className="text-2xl sm:text-[28px] font-bold text-slate-900 dark:text-[#F8FAFC] mt-2.5 truncate tabular-nums">
              {stats.total}
            </p>
          </div>
          <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-3 font-normal">
            Active in catalog
          </p>
        </div>

        {/* Visible Products */}
        <div className="bg-white dark:bg-[#111827] rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700/80 transition duration-150">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider">
                Visible Products
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100/80 dark:border-emerald-500/20 flex items-center justify-center">
                <FiEye className="text-base" />
              </div>
            </div>
            <p className="text-2xl sm:text-[28px] font-bold text-slate-900 dark:text-[#F8FAFC] mt-2.5 truncate tabular-nums">
              {stats.visible}
            </p>
          </div>
          <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-3 font-normal">
            Available on customer store & POS
          </p>
        </div>

        {/* Hidden Products */}
        <div className="bg-white dark:bg-[#111827] rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700/80 transition duration-150">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider">
                Hidden Products
              </span>
              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/80 flex items-center justify-center">
                <FiEyeOff className="text-base" />
              </div>
            </div>
            <p className="text-2xl sm:text-[28px] font-bold text-slate-900 dark:text-[#F8FAFC] mt-2.5 truncate tabular-nums">
              {stats.hidden}
            </p>
          </div>
          <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-3 font-normal">
            Temporarily unlisted from store
          </p>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white dark:bg-[#111827] rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700/80 transition duration-150">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-[#94A3B8] uppercase tracking-wider">
                Low Stock Alerts
              </span>
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  stats.lowStock > 0
                    ? "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-100/80 dark:border-rose-500/20"
                    : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100/80 dark:border-emerald-500/20"
                }`}
              >
                <FiAlertTriangle className="text-base" />
              </div>
            </div>
            <p
              className={`text-2xl sm:text-[28px] font-bold mt-2.5 truncate tabular-nums ${
                stats.lowStock > 0
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-slate-900 dark:text-[#F8FAFC]"
              }`}
            >
              {stats.lowStock}
            </p>
          </div>
          <p className="text-xs text-slate-500 dark:text-[#94A3B8] mt-3 font-normal">
            {stats.lowStock > 0
              ? "Requires inventory restock"
              : "Healthy inventory levels"}
          </p>
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
              {/* Cost Price */}
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Cost Price
                </label>
                <div className="relative">
                  <FaRupeeSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Cost price"
                    value={form.costPrice}
                    onChange={(e) =>
                      setForm({ ...form, costPrice: e.target.value })
                    }
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>
              </div>
              {/* Selling Price */}
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Selling Price
                </label>
                <div className="relative">
                  <FaRupeeSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Selling price"
                    value={form.sellingPrice}
                    onChange={(e) =>
                      setForm({ ...form, sellingPrice: e.target.value })
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

              {/* Image Upload Section */}
              <div className="md:col-span-2 xl:col-span-3">
                <label className="block text-sm font-semibold mb-2">
                  Product Image
                </label>
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl p-6 bg-slate-50 dark:bg-slate-900">
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

                  {imageMethod === "file" && (
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageFileChange}
                      className="w-full rounded-2xl border px-4 py-3"
                    />
                  )}

                  {imageMethod === "url" && (
                    <input
                      type="text"
                      placeholder="Enter image URL (any valid image URL)"
                      value={imageUrl}
                      onChange={handleImageUrlChange}
                      className="w-full rounded-2xl border px-4 py-3"
                    />
                  )}

                  {imagePreview && (
                    <div className="mt-4">
                      <p className="text-sm font-medium mb-2">Preview:</p>
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-36 h-36 rounded-xl object-cover border"
                        onError={() => {
                          setImagePreview("");
                          toast.error(
                            "Invalid image URL or image cannot be loaded",
                          );
                        }}
                      />
                    </div>
                  )}
                  <p className="text-sm text-slate-500 mt-3">
                    {imageMethod === "file"
                      ? "Upload high-quality product image"
                      : "Enter any valid image URL (supports JPG, PNG, WEBP, GIF, etc.)"}
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
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
              All Products
            </h2>
            <p className="text-sm text-slate-500">
              Total {filteredProducts.length} products
            </p>
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
          <table className="w-full min-w-[1250px]">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th
                  onClick={() => toggleSort("name")}
                  className={`text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none group transition-colors ${
                    sortBy === "name"
                      ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
                  title="Sort by Product"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Product</span>
                    <span className={sortBy === "name" ? "text-indigo-600 dark:text-indigo-400" : "opacity-0 group-hover:opacity-40 transition-opacity"}>
                      {sortBy === "name" && sortOrder === "desc" ? <FiChevronDown className="w-3.5 h-3.5" /> : <FiChevronUp className="w-3.5 h-3.5" />}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => toggleSort("category")}
                  className={`text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none group transition-colors ${
                    sortBy === "category"
                      ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
                  title="Sort by Category"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Category</span>
                    <span className={sortBy === "category" ? "text-indigo-600 dark:text-indigo-400" : "opacity-0 group-hover:opacity-40 transition-opacity"}>
                      {sortBy === "category" && sortOrder === "desc" ? <FiChevronDown className="w-3.5 h-3.5" /> : <FiChevronUp className="w-3.5 h-3.5" />}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => toggleSort("sellingPrice")}
                  className={`text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none group transition-colors ${
                    sortBy === "sellingPrice"
                      ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
                  title="Sort by Selling Price"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Selling Price</span>
                    <span className={sortBy === "sellingPrice" ? "text-indigo-600 dark:text-indigo-400" : "opacity-0 group-hover:opacity-40 transition-opacity"}>
                      {sortBy === "sellingPrice" && sortOrder === "desc" ? <FiChevronDown className="w-3.5 h-3.5" /> : <FiChevronUp className="w-3.5 h-3.5" />}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => toggleSort("costPrice")}
                  className={`text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none group transition-colors ${
                    sortBy === "costPrice"
                      ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
                  title="Sort by Cost Price"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Cost Price</span>
                    <span className={sortBy === "costPrice" ? "text-indigo-600 dark:text-indigo-400" : "opacity-0 group-hover:opacity-40 transition-opacity"}>
                      {sortBy === "costPrice" && sortOrder === "desc" ? <FiChevronDown className="w-3.5 h-3.5" /> : <FiChevronUp className="w-3.5 h-3.5" />}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => toggleSort("profit")}
                  className={`text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none group transition-colors ${
                    sortBy === "profit"
                      ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
                  title="Sort by Profit"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Profit</span>
                    <span className={sortBy === "profit" ? "text-indigo-600 dark:text-indigo-400" : "opacity-0 group-hover:opacity-40 transition-opacity"}>
                      {sortBy === "profit" && sortOrder === "desc" ? <FiChevronDown className="w-3.5 h-3.5" /> : <FiChevronUp className="w-3.5 h-3.5" />}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => toggleSort("stock")}
                  className={`text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none group transition-colors ${
                    sortBy === "stock"
                      ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
                  title="Sort by Stock"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Stock</span>
                    <span className={sortBy === "stock" ? "text-indigo-600 dark:text-indigo-400" : "opacity-0 group-hover:opacity-40 transition-opacity"}>
                      {sortBy === "stock" && sortOrder === "desc" ? <FiChevronDown className="w-3.5 h-3.5" /> : <FiChevronUp className="w-3.5 h-3.5" />}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => toggleSort("reserved")}
                  className={`text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none group transition-colors ${
                    sortBy === "reserved"
                      ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
                  title="Sort by Reserved Stock"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Reserved</span>
                    <span className={sortBy === "reserved" ? "text-indigo-600 dark:text-indigo-400" : "opacity-0 group-hover:opacity-40 transition-opacity"}>
                      {sortBy === "reserved" && sortOrder === "desc" ? <FiChevronDown className="w-3.5 h-3.5" /> : <FiChevronUp className="w-3.5 h-3.5" />}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => toggleSort("available")}
                  className={`text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none group transition-colors ${
                    sortBy === "available"
                      ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
                  title="Sort by Available Stock"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Available</span>
                    <span className={sortBy === "available" ? "text-indigo-600 dark:text-indigo-400" : "opacity-0 group-hover:opacity-40 transition-opacity"}>
                      {sortBy === "available" && sortOrder === "desc" ? <FiChevronDown className="w-3.5 h-3.5" /> : <FiChevronUp className="w-3.5 h-3.5" />}
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => toggleSort("visibility")}
                  className={`text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none group transition-colors ${
                    sortBy === "visibility"
                      ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
                  title="Sort by Visibility"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Visibility</span>
                    <span className={sortBy === "visibility" ? "text-indigo-600 dark:text-indigo-400" : "opacity-0 group-hover:opacity-40 transition-opacity"}>
                      {sortBy === "visibility" && sortOrder === "desc" ? <FiChevronDown className="w-3.5 h-3.5" /> : <FiChevronUp className="w-3.5 h-3.5" />}
                    </span>
                  </div>
                </th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {pagedProducts.map((p) => {
                const reserved = p.reservedStock || 0;
                const available = (p.stock || 0) - reserved;
                const isLowStock = available <= p.lowStockThreshold;
                const sellingPrice = Number(p.sellingPrice ?? p.price ?? 0);
                const costPrice = Number(p.costPrice ?? 0);
                const profit = sellingPrice - costPrice;
                const margin = p.profitMargin || (sellingPrice > 0 ? ((profit / sellingPrice) * 100).toFixed(1) : 0);

                return (
                  <tr
                    key={p._id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition duration-150"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={p.image || "https://via.placeholder.com/60"}
                          alt={p.name}
                          className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                          onError={(e) => {
                            e.target.src = "https://via.placeholder.com/60";
                          }}
                        />
                        <div>
                          <p className="font-semibold text-sm text-slate-800 dark:text-white">
                            {p.name}
                          </p>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">
                            ID: {p._id.slice(-6)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-medium whitespace-nowrap">
                        <FiLayers className="text-xs" />{" "}
                        {p.categoryId?.name || "No Category"}
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="font-semibold text-sm text-emerald-600 dark:text-emerald-400">
                        ₹{sellingPrice}
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        ₹{costPrice}
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className={`font-semibold text-sm ${profit >= 0 ? "text-slate-800 dark:text-white" : "text-rose-500"}`}>
                        ₹{profit.toFixed(2)}
                      </span>
                      <p className={`text-xs font-medium mt-0.5 ${profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"}`}>
                        {margin}%
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-base font-medium text-slate-700 dark:text-slate-300">
                        {p.stock}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-base font-medium text-amber-600 dark:text-amber-400">
                        {reserved}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`font-mono text-base font-semibold ${
                          available <= 0
                            ? "text-red-600 dark:text-red-400"
                            : isLowStock
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-green-600 dark:text-green-400"
                        }`}
                      >
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
                          } ${
                            togglingId === p._id
                              ? "opacity-60 cursor-not-allowed"
                              : ""
                          }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-all duration-300 ${
                              p.visibility ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                          {togglingId === p._id && (
                            <span className="absolute inset-0 flex items-center justify-center">
                              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            </span>
                          )}
                        </button>
                        <span
                          className={`text-sm font-medium ${
                            p.visibility
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-slate-500"
                          }`}
                        >
                          {p.visibility ? "Visible" : "Hidden"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        {/* RESET RESERVED STOCK */}
                        <button
                          onClick={() => handleResetReserved(p)}
                          disabled={(p.reservedStock || 0) <= 0}
                          className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${
                            (p.reservedStock || 0) > 0
                              ? "bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 text-amber-600"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                          }`}
                          title="Reset Reserved Stock"
                        >
                          <FiTrendingUp className="text-base" />
                        </button>

                        {/* EDIT PRODUCT */}
                        <button
                          onClick={() => handleEdit(p)}
                          className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-600 flex items-center justify-center transition"
                          title="Edit product"
                        >
                          <FiEdit2 className="text-base" />
                        </button>

                        {/* DELETE PRODUCT */}
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

        {/* ✅ PAGINATION FOOTER */}
        {filteredProducts.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60">
            <p className="text-sm text-slate-500">
              Showing{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {totalItems === 0 ? 0 : startIndex + 1}–{endIndex}
              </span>{' '}
              of{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {totalItems}
              </span>{' '}
              products
            </p>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Rows per page */}
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
                  let endPage = Math.min(totalPages, startPage + maxShown - 1);
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
                                ? "bg-indigo-600 text-white"
                                : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
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
                              ? "bg-indigo-600 text-white"
                              : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
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
                                ? "bg-indigo-600 text-white"
                                : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
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
        )}
      </div>
    </div>
  );
}