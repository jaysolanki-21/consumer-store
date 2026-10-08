import express from 'express';
import { 
  createOrder, 
  getOrders, 
  getOrderById,
  confirmOrder, 
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
import { adminOnly, protect, staffOrAdmin, counterStaffOrAdmin } from '../middleware/authMiddleware.js';
import { checkMaintenanceMode } from '../middleware/maintenanceMiddleware.js';

const router = express.Router();

// Public routes (no auth required for creating order)
router.post('/', checkMaintenanceMode, createOrder);

// Protected routes
router.get('/', protect, counterStaffOrAdmin, getOrders);
router.get('/:id', protect, counterStaffOrAdmin, getOrderById);

// Order status management
router.put('/:id/confirm', protect, staffOrAdmin, checkMaintenanceMode, confirmOrder);
router.put('/:id/cancel', protect, staffOrAdmin, checkMaintenanceMode, cancelOrder);
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