import express from 'express';
import {
  getStaff,
  createStaff,
  updateStaff,
  setStaffStatus,
  resetStaffPassword,
  deleteStaff
} from '../controllers/userController.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes are admin only
router.route('/staff')
  .get(protect, adminOnly, getStaff)
  .post(protect, adminOnly, createStaff);

router.route('/staff/:id')
  .put(protect, adminOnly, updateStaff)
  .delete(protect, adminOnly, deleteStaff);

router.put('/staff/:id/reset-password', protect, adminOnly, resetStaffPassword);
router.put('/staff/:id/status', protect, adminOnly, setStaffStatus);

export default router;
