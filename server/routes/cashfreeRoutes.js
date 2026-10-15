import express from 'express';
import {
  createCashfreeSession,
  verifyCashfreePayment,
  cancelCashfreeSession,
  cashfreeWebhook
} from '../controllers/cashfreeController.js';
import { checkMaintenanceMode } from '../middleware/maintenanceMiddleware.js';

const router = express.Router();

// ── Create a Cashfree payment session for a new order ─────────────────────────
// Public route: counter POS does not require staff/admin JWT, but respects maintenance mode.
router.post('/create-session', checkMaintenanceMode, createCashfreeSession);

// ── Verify payment status after Cashfree checkout closes ──────────────────────
// Public route: called from frontend after user completes or cancels payment.
router.post('/verify', verifyCashfreePayment);

// ── Cancel payment session / checkout ─────────────────────────────────────────
router.post('/cancel-session', cancelCashfreeSession);

// ── Cashfree webhook endpoint ─────────────────────────────────────────────────
// Must receive raw body for HMAC signature verification.
// express.raw() is applied specifically to this route in server.js.
router.post('/webhook', cashfreeWebhook);

export default router;
