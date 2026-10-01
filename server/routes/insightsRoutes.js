import express from 'express';
import { getBusinessInsights } from '../controllers/aiInsightsController.js';
import { adminOnly, protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.post('/ai', protect, adminOnly, getBusinessInsights);

export default router;
