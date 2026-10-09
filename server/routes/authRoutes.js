import express from 'express';
import {
  login,
  logoutUser,
  beaconDisconnect,
  changePassword,
  createAdmin,
  getAdmins,
} from '../controllers/authController.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/login', login);
router.post('/logout', protect, logoutUser);
router.post('/beacon-disconnect', beaconDisconnect);

// Password Change for currently logged-in user
router.put('/change-password', protect, changePassword);

// Administrator Account Management (Admin only)
router.get('/admins', protect, adminOnly, getAdmins);
router.post('/admins', protect, adminOnly, createAdmin);

export default router;