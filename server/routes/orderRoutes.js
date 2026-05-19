import express from 'express';
import { createOrder, getOrders, confirmOrder, getSalesReport, cancelOrder, revertOrder, bulkDeleteCancelledOrders, deleteAllOrdersByDate, deleteSingleOrder, bulkDeletePendingOrders } from '../controllers/orderController.js';
import { adminOnly, protect, staffOrAdmin } from '../middleware/authMiddleware.js';
import Order from '../models/Order.js';

const router = express.Router();

router.post('/', createOrder);

router.get('/', protect, staffOrAdmin, getOrders);
router.get('/sales-report', protect, adminOnly, getSalesReport);

router.put('/:id/confirm', protect, staffOrAdmin, confirmOrder);
router.put('/:id/cancel', protect, staffOrAdmin, cancelOrder);
router.put('/:id/revert', protect, adminOnly, revertOrder);
router.delete('/bulk/pending', protect, adminOnly, bulkDeletePendingOrders);
router.delete('/bulk/cancelled', protect, adminOnly, bulkDeleteCancelledOrders);
router.delete('/by-date', protect, adminOnly, deleteAllOrdersByDate);
router.delete('/:id', protect, adminOnly, deleteSingleOrder);
export default router;