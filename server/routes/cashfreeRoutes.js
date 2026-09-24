import express from 'express';
import {
  createCashfreeSession,
  verifyCashfreePayment,
  cashfreeWebhook
} from '../controllers/cashfreeController.js';

const router = express.Router();

// ── Create a Cashfree payment session for a new order ─────────────────────────
// Public route: counter POS does not require staff/admin JWT.
router.post('/create-session', createCashfreeSession);

// ── Verify payment status after Cashfree checkout closes ──────────────────────
// Public route: called from frontend after user completes or cancels payment.
router.post('/verify', verifyCashfreePayment);

// ── Cashfree webhook endpoint ─────────────────────────────────────────────────
// Must receive raw body for HMAC signature verification.
// express.raw() is applied specifically to this route in server.js.
router.post('/webhook', cashfreeWebhook);

export default router;
