import express from 'express';
import { 
  createOrder, 
  getOrders, 
  confirmOrder, 
  getSalesReport, 
  cancelOrder, 
  revertOrder, 
  bulkDeleteCancelledOrders, 
  deleteAllOrdersByDate, 
  deleteSingleOrder, 
  bulkDeletePendingOrders,
  updatePaymentStatus,
  updatePrintStatus,
  resetReservedStock
} from '../controllers/orderController.js';
import { adminOnly, protect, staffOrAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes (no auth required for creating order)
router.post('/', createOrder);

// Protected routes
router.get('/', protect, staffOrAdmin, getOrders);
router.get('/sales-report', protect, adminOnly, getSalesReport);

// Order status management
router.put('/:id/confirm', protect, staffOrAdmin, confirmOrder);
router.put('/:id/cancel', protect, staffOrAdmin, cancelOrder);
router.put('/:id/revert', protect, adminOnly, revertOrder);

// Payment and print management
router.put('/:id/payment', protect, adminOnly, updatePaymentStatus);
router.put('/:id/print', protect, adminOnly, updatePrintStatus);

// Delete operations
router.delete('/bulk/pending', protect, adminOnly, bulkDeletePendingOrders);
router.delete('/bulk/cancelled', protect, adminOnly, bulkDeleteCancelledOrders);
router.delete('/by-date', protect, adminOnly, deleteAllOrdersByDate);
router.delete('/:id', protect, adminOnly, deleteSingleOrder);

// Stock management
router.post('/reset-reserved/:id', protect, adminOnly, resetReservedStock);

export default router;