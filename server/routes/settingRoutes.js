import express from 'express';
import {
  getMaintenanceStatus,
  updateMaintenanceStatus,
} from '../controllers/settingController.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

// Read maintenance status (accessible by frontend app/guards)
router.get('/maintenance', getMaintenanceStatus);

// Update maintenance status (admin only)
router.put('/maintenance', protect, adminOnly, updateMaintenanceStatus);

export default router;
