import express from 'express';
import {
  getMaintenanceStatus,
  updateMaintenanceStatus,
  toggleScheduledMaintenance,
  createSchedule,
  updateSchedule,
  toggleSchedule,
  deleteSchedule,
} from '../controllers/settingController.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

// Read maintenance status (accessible by frontend app/guards)
router.get('/maintenance', getMaintenanceStatus);

// Update manual maintenance status (admin only)
router.put('/maintenance', protect, adminOnly, updateMaintenanceStatus);

// Master toggle for scheduled maintenance (admin only)
router.put('/maintenance/schedule-toggle', protect, adminOnly, toggleScheduledMaintenance);
router.put('/maintenance/schedule/toggle', protect, adminOnly, toggleScheduledMaintenance);
router.put('/maintenance/schedules/toggle', protect, adminOnly, toggleScheduledMaintenance);

// CRUD for maintenance schedules (admin only) - supports both singular and plural
router.post('/maintenance/schedules', protect, adminOnly, createSchedule);
router.post('/maintenance/schedule', protect, adminOnly, createSchedule);

router.put('/maintenance/schedules/:id', protect, adminOnly, updateSchedule);
router.put('/maintenance/schedule/:id', protect, adminOnly, updateSchedule);

router.patch('/maintenance/schedules/:id/toggle', protect, adminOnly, toggleSchedule);
router.patch('/maintenance/schedule/:id/toggle', protect, adminOnly, toggleSchedule);

router.delete('/maintenance/schedules/:id', protect, adminOnly, deleteSchedule);
router.delete('/maintenance/schedule/:id', protect, adminOnly, deleteSchedule);

export default router;
