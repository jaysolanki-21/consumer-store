import { motion, AnimatePresence } from 'framer-motion';
import { useSelector, useDispatch } from 'react-redux';
import { 
  removeFromCart, 
  updateQuantity, 
  clearCart 
} from '../redux/slices/cartSlice';
import { FiTrash2, FiX, FiMinus, FiPlus } from 'react-icons/fi';

export default function CartDrawer({ open, onClose, onCheckout, isProcessing }) {
  const items = useSelector(state => state.cart.items);
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const dispatch = useDispatch();

  const handleIncrement = (item) => {
    if (item.quantity < item.stock) {
      dispatch(updateQuantity({ 
        productId: item.productId, 
        quantity: item.quantity + 1 
      }));
    }
  };

  const handleDecrement = (item) => {
    if (item.quantity > 1) {
      dispatch(updateQuantity({ 
        productId: item.productId, 
        quantity: item.quantity - 1 
      }));
    }
  };

  const handleClearCart = () => {
    if (window.confirm('Are you sure you want to clear your entire cart?')) {
      dispatch(clearCart());
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-40"
            onClick={onClose}
          />
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.3 }}
            className="fixed right-0 top-0 h-full w-full sm:w-96 bg-white dark:bg-gray-800 shadow-xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-2xl font-bold">Your Cart</h2>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                <FiX size={24} />
              </button>
            </div>
            
            {/* Cart Items */}
            <div className="flex-1 overflow-auto p-4">
              {items.length === 0 ? (
                <p className="text-center text-gray-500 mt-8">Your cart is empty</p>
              ) : (
                items.map(item => (
                  <div key={item.productId} className="flex gap-3 mb-4 border-b pb-3">
                    <img 
                      src={item.image || 'https://via.placeholder.com/60'} 
                      alt={item.name} 
                      className="w-16 h-16 object-cover rounded" 
                    />
                    <div className="flex-1">
                      <h4 className="font-semibold">{item.name}</h4>
                      <p className="text-indigo-600 dark:text-indigo-400">₹{item.price}</p>
                      
                      {/* Quantity Controls with +/- */}
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => handleDecrement(item)}
                          disabled={item.quantity <= 1}
                          className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <FiMinus size={14} />
                        </button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <button
                          onClick={() => handleIncrement(item)}
                          disabled={item.quantity >= item.stock}
                          className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <FiPlus size={14} />
                        </button>
                        
                        <button 
                          onClick={() => dispatch(removeFromCart(item.productId))} 
                          className="ml-auto text-red-500 hover:text-red-700 p-1"
                        >
                          <FiTrash2 size={18} />
                        </button>
                      </div>
                    </div>
                    <p className="font-semibold">₹{item.price * item.quantity}</p>
                  </div>
                ))
              )}
            </div>
            
            {/* Footer */}
            <div className="border-t p-4">
              <div className="flex justify-between mb-4">
                <span className="font-bold text-lg">Total</span>
                <span className="font-bold text-xl text-indigo-600">₹{total}</span>
              </div>
              
              <button 
                onClick={onCheckout}
                disabled={items.length === 0 || isProcessing}
                className={`w-full py-3 rounded-lg font-semibold transition ${
                  items.length > 0 && !isProcessing
                    ? 'bg-green-600 hover:bg-green-700 text-white' 
                    : 'bg-gray-300 cursor-not-allowed text-gray-500'
                }`}
              >
                {isProcessing ? 'Processing...' : 'Place Order'}
              </button>
              
              {items.length > 0 && (
                <button 
                  onClick={handleClearCart}
                  className="w-full mt-2 py-2 rounded-lg font-semibold bg-red-600 hover:bg-red-700 text-white transition"
                >
                  Clear Cart
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}