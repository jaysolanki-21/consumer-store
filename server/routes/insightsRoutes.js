import express from 'express';
import {
  getCanonicalAnalytics,
  getBusinessInsights,
  getLatestBusinessInsight,
  getBusinessInsightHistory,
  getInsightById,
} from '../controllers/aiInsightsController.js';
import { adminOnly, protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/analytics', protect, adminOnly, getCanonicalAnalytics);
router.post('/ai', protect, adminOnly, getBusinessInsights);
router.get('/ai/latest', protect, adminOnly, getLatestBusinessInsight);
router.get('/ai/history', protect, adminOnly, getBusinessInsightHistory);
router.get('/ai/:id', protect, adminOnly, getInsightById);

export default router;
