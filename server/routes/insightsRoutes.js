import express from 'express';
import {
  getBusinessInsights,
  getLatestBusinessInsight,
  getBusinessInsightHistory,
} from '../controllers/aiInsightsController.js';
import { adminOnly, protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/ai', protect, adminOnly, getBusinessInsights);
router.get('/ai/latest', protect, adminOnly, getLatestBusinessInsight);
router.get('/ai/history', protect, adminOnly, getBusinessInsightHistory);

export default router;
