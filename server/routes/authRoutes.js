import express from 'express';
import { login, beaconDisconnect } from '../controllers/authController.js';

const router = express.Router();

router.post('/login', login);
router.post('/beacon-disconnect', beaconDisconnect);

export default router;