import { useDispatch } from 'react-redux';
import { addToCart } from '../redux/slices/cartSlice';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import {
  FiShoppingCart,
  FiAlertCircle,
  FiCheck,
} from 'react-icons/fi';

export default function ProductCard({ product }) {
  const dispatch = useDispatch();

  // Use availableStock if provided by backend, otherwise calculate from stock - reservedStock
  const availableStock = product.availableStock ?? (product.stock - (product.reservedStock || 0));

  const handleAdd = () => {
    if (availableStock <= 0) {
      toast.error('Out of stock');
      return;
    }
    dispatch(addToCart({ product, quantity: 1 }));
    toast.success(`${product.name} added to cart`);
  };

  const isLowStock = availableStock > 0 && availableStock <= product.lowStockThreshold;

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
          src={product.image || 'https://via.placeholder.com/500x500?text=No+Image'}
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent"></div>

        {/* Stock Badge */}
        <div className="absolute top-3 left-3">
          {availableStock <= 0 ? (
            <span className="flex items-center gap-1 rounded-full bg-red-500 text-white px-3 py-1 text-xs font-bold shadow-lg">
              <FiAlertCircle />
              Out of Stock
            </span>
          ) : isLowStock ? (
            <span className="rounded-full bg-amber-500 text-white px-3 py-1 text-xs font-bold shadow-lg">
              Only {availableStock} Left
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full bg-emerald-500 text-white px-3 py-1 text-xs font-bold shadow-lg">
              <FiCheck />
              In Stock
            </span>
          )}
        </div>

        {/* Price Tag */}
        <div className="absolute bottom-3 right-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-lg">
          <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">₹{product.price}</p>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Product Name */}
        <h3 className="text-lg font-bold text-slate-800 dark:text-white line-clamp-1">{product.name}</h3>

        {/* Category */}
        {product.categoryId?.name && (
          <p className="mt-1 text-xs font-medium text-slate-400 uppercase tracking-wider">{product.categoryId.name}</p>
        )}

        {/* Available Stock Display */}
        <div className="mt-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">Available Stock</p>
            <p className={`font-bold text-sm ${isLowStock ? 'text-amber-500' : 'text-slate-700 dark:text-slate-200'}`}>
              {availableStock} units
            </p>
          </div>
          <div className="w-20 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div
              className={`h-full rounded-full ${availableStock <= 0 ? 'bg-red-500' : isLowStock ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min((availableStock / 20) * 100, 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Add to Cart Button */}
        <button
          onClick={handleAdd}
          disabled={availableStock <= 0}
          className={`mt-5 w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm transition-all duration-300 ${
            availableStock > 0
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/20 active:scale-[0.98]'
              : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
          }`}
        >
          <FiShoppingCart className="text-base" />
          {availableStock > 0 ? 'Add to Cart' : 'Unavailable'}
        </button>
      </div>
    </motion.div>
  );
}