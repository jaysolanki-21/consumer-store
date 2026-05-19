import express from 'express';
import { createOrder, getOrders, confirmOrder, getSalesReport, cancelOrder, revertOrder } from '../controllers/orderController.js';
import { adminOnly, protect, staffOrAdmin } from '../middleware/authMiddleware.js';
import Order from '../models/Order.js';

const router = express.Router();

// ============= PUBLIC ROUTES =============
router.post('/', createOrder);

// ============= PROTECTED ROUTES =============
router.get('/', protect, staffOrAdmin, getOrders);
router.get('/sales-report', protect, adminOnly, getSalesReport);

// ============= ORDER STATUS CHANGE ROUTES =============
router.put('/:id/confirm', protect, staffOrAdmin, confirmOrder);
router.put('/:id/cancel', protect, staffOrAdmin, cancelOrder);
router.put('/:id/revert', protect, adminOnly, revertOrder);

// ============= DELETE ROUTES (BEFORE generic :id) =============

// Delete all pending orders for specific date
router.delete('/bulk/pending', protect, adminOnly, async (req, res) => {
  try {
    const { date } = req.body;
    if (!date) {
      return res.status(400).json({ message: 'Date is required' });
    }
    
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);
    
    const result = await Order.deleteMany({ 
      status: 'Pending',
      createdAt: { $gte: startDate, $lte: endDate }
    });
    
    res.json({ message: `${result.deletedCount} pending orders deleted`, count: result.deletedCount });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

// Delete all cancelled orders for specific date
router.delete('/bulk/cancelled', protect, adminOnly, async (req, res) => {
  try {
    const { date } = req.body;
    if (!date) {
      return res.status(400).json({ message: 'Date is required' });
    }
    
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);
    
    const result = await Order.deleteMany({ 
      status: 'Cancelled',
      createdAt: { $gte: startDate, $lte: endDate }
    });
    
    res.json({ message: `${result.deletedCount} cancelled orders deleted`, count: result.deletedCount });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

// Delete all orders for specific date
router.delete('/by-date', protect, adminOnly, async (req, res) => {
  try {
    const { date } = req.body;
    if (!date) {
      return res.status(400).json({ message: 'Date is required' });
    }
    
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);
    
    const result = await Order.deleteMany({ 
      createdAt: { $gte: startDate, $lte: endDate }
    });
    
    res.json({ message: `${result.deletedCount} orders deleted`, count: result.deletedCount });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

// ✅ DELETE SINGLE ORDER - MUST BE LAST
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    if (order.status !== 'Cancelled' && order.status !== 'Pending') {
      return res.status(400).json({ message: 'Only cancelled or pending orders can be deleted' });
    }
    await order.deleteOne();
    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

export default router;