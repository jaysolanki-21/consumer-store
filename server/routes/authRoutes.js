import express from 'express';
import { login, logoutUser, beaconDisconnect } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/login', login);
router.post('/logout', protect, logoutUser);
router.post('/beacon-disconnect', beaconDisconnect);

export default router;