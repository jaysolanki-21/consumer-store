import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { addToCart } from '../redux/slices/cartSlice';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import {
  FiShoppingCart,
  FiAlertCircle,
  FiCheck,
  FiPlus,
  FiMinus,
} from 'react-icons/fi';

export default function ProductCard({ product }) {
  const dispatch = useDispatch();
  const [quantity, setQuantity] = useState(1);

  const availableStock =
    product.availableStock ??
    (product.stock - (product.reservedStock || 0));

  // Hide product completely
  if (availableStock <= 0 || product.visibility === false) {
    return null;
  }

  const isLowStock =
    availableStock > 0 &&
    availableStock <= product.lowStockThreshold;

  const increment = () => {
    setQuantity((prev) =>
      prev < availableStock ? prev + 1 : prev
    );
  };

  const decrement = () => {
    setQuantity((prev) =>
      prev > 1 ? prev - 1 : prev
    );
  };

  const handleAdd = () => {
    if (quantity > availableStock) {
      toast.error('Product is currently unavailable');
      return;
    }

    dispatch(addToCart({ product, quantity }));

    toast.success(`${quantity} × ${product.name} added to cart`);

    setQuantity(1);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -6 }}
      transition={{ duration: 0.2 }}
      className="group relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300"
    >
      {/* Product Image */}
      <div className="relative aspect-square overflow-hidden bg-slate-100 dark:bg-slate-800">
        <img
          src={
            product.image ||
            'https://via.placeholder.com/500x500?text=No+Image'
          }
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent"></div>

        {/* Stock Badge */}
        <div className="absolute top-3 left-3">
          {isLowStock ? (
            <span className="rounded-full bg-amber-500 text-white px-3 py-1 text-xs font-bold shadow-lg">
              Low Stock
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full bg-emerald-500 text-white px-3 py-1 text-xs font-bold shadow-lg">
              <FiCheck />
              In Stock
            </span>
          )}
        </div>

        {/* Price */}
        <div className="absolute bottom-3 right-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-lg">
          <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">
            ₹{product.price}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white line-clamp-1">
          {product.name}
        </h3>

        {product.categoryId?.name && (
          <p className="mt-1 text-xs font-medium text-slate-400 uppercase tracking-wider">
            {product.categoryId.name}
          </p>
        )}

        {/* Quantity */}
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={decrement}
              disabled={quantity <= 1}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
                quantity > 1
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  : 'bg-slate-50 dark:bg-slate-800/50 text-slate-300 dark:text-slate-600 cursor-not-allowed'
              }`}
            >
              <FiMinus className="text-sm" />
            </button>

            <span className="w-8 text-center font-semibold text-slate-800 dark:text-white">
              {quantity}
            </span>

            <button
              onClick={increment}
              disabled={quantity >= availableStock}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
                quantity < availableStock
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  : 'bg-slate-50 dark:bg-slate-800/50 text-slate-300 dark:text-slate-600 cursor-not-allowed'
              }`}
            >
              <FiPlus className="text-sm" />
            </button>
          </div>

          <div className="text-right">
            <p className="text-xs text-slate-500">Total</p>

            <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
              ₹{product.price * quantity}
            </p>
          </div>
        </div>

        {/* Add To Cart */}
        <button
          onClick={handleAdd}
          className="mt-5 w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm transition-all duration-300 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/20 active:scale-[0.98]"
        >
          <FiShoppingCart className="text-base" />
          Add {quantity}
        </button>
      </div>
    </motion.div>
  );
}