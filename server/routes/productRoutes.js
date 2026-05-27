import express from 'express';
import { getProducts, createProduct, updateProduct, deleteProduct,refillStock, getProductSalesAnalytics, resetReservedStockByProduct } from '../controllers/productController.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';
import upload from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.get('/', getProducts);
router.post('/', protect, adminOnly, upload.single('image'), createProduct);
router.put('/:id', protect, adminOnly, upload.single('image'), updateProduct);
router.delete('/:id', protect, adminOnly, deleteProduct);
router.put('/:id/refill', protect, adminOnly, refillStock);
router.get('/sales-analytics', protect, adminOnly, getProductSalesAnalytics);
router.patch(
  '/reset-reserved/:productId',
  protect,
  adminOnly,
  resetReservedStockByProduct
);

export default router;