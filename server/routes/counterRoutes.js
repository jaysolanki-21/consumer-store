import express from 'express';
import {
  createCounter,
  deleteCounter,
  getCounters,
  resetCounterPassword,
  setCounterStatus,
  updateCounter
} from '../controllers/counterController.js';
import { adminOnly, protect, staffOrAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .get(protect, staffOrAdmin, getCounters)
  .post(protect, adminOnly, createCounter);

router.route('/:id')
  .put(protect, adminOnly, updateCounter)
  .delete(protect, adminOnly, deleteCounter);

router.put('/:id/status', protect, adminOnly, setCounterStatus);
router.put('/:id/reset-password', protect, adminOnly, resetCounterPassword);

export default router;
