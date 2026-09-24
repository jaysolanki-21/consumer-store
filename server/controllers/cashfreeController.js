/**
 * cashfreeController.js
 * Handles Cashfree payment session creation, verification, and webhook processing.
 * All Cashfree credentials are used server-side only — never exposed to the frontend.
 */

import { Cashfree, CFEnvironment } from 'cashfree-pg';
import crypto from 'crypto';
import Order from '../models/Order.js';
import Product from '../models/Product.js';

// ─── Cashfree SDK Configuration ───────────────────────────────────────────────
// Configured once at module load from environment variables.
const cashfreeEnvironment = process.env.CASHFREE_ENVIRONMENT === 'production'
  ? CFEnvironment.PRODUCTION
  : CFEnvironment.SANDBOX;

const cashfree = new Cashfree(
  cashfreeEnvironment,
  process.env.CASHFREE_APP_ID,
  process.env.CASHFREE_SECRET_KEY
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generates a unique, short order-reference ID for Cashfree.
 * Format: CF-<timestamp_ms>-<4-random-hex-chars>
 * Must be ≤ 50 chars and unique per order.
 */
const generateCfOrderId = () => {
  const ts = Date.now().toString();
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `CF-${ts}-${rand}`;
};

// ─── Create Cashfree Payment Session ──────────────────────────────────────────

/**
 * POST /api/payments/cashfree/create-session
 *
 * Accepts: { items, counterId, staffId, staffName }
 * Returns: { orderId (MongoDB), cfOrderId, paymentSessionId, amount }
 *
 * Security:
 *  - Cart total is re-calculated server-side from current product prices.
 *  - Frontend-provided amount is IGNORED.
 *  - Duplicate protection via gatewayOrderId uniqueness.
 */
export const createCashfreeSession = async (req, res) => {
  try {
    const { items, counterId, staffId, staffName } = req.body;

    // ── Validate input ────────────────────────────────────────────────────────
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    if (!counterId) {
      return res.status(400).json({ message: 'Counter ID is required' });
    }

    // ── Verify stock availability ─────────────────────────────────────────────
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(404).json({ message: `Product not found: ${item.productId}` });
      }
      const available = product.stock - product.reservedStock;
      if (available < item.quantity) {
        return res.status(400).json({
          message: `Only ${available} units of "${product.name}" are available`
        });
      }
    }

    // ── Re-calculate total server-side (never trust frontend amount) ──────────
    let totalAmount = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);
      const price = product.sellingPrice || product.price || 0;
      const costPrice = product.costPrice || 0;
      totalAmount += price * item.quantity;
      orderItems.push({
        productId: item.productId,
        quantity: item.quantity,
        price,
        sellingPrice: price,
        costPrice
      });
    }

    // Cashfree requires amount ≥ 1
    if (totalAmount < 1) {
      return res.status(400).json({ message: 'Order total is too low for online payment' });
    }

    // ── Reserve stock ─────────────────────────────────────────────────────────
    for (const item of orderItems) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { reservedStock: item.quantity }
      });
    }

    // ── Counter name map ──────────────────────────────────────────────────────
    const counterNames = {
      'counter-1': 'Counter 1', 'counter-2': 'Counter 2',
      'counter-3': 'Counter 3', 'counter-4': 'Counter 4',
      'counter-5': 'Counter 5', 'counter-6': 'Counter 6',
      'counter-7': 'Counter 7', 'counter-8': 'Counter 8',
      'counter-9': 'Counter 9', 'counter-10': 'Counter 10'
    };

    // ── Generate unique Cashfree order ID ─────────────────────────────────────
    const cfOrderId = generateCfOrderId();

    // ── Create the MongoDB order with status Pending, paymentStatus Pending ───
    const order = await Order.create({
      items: orderItems,
      totalAmount,
      status: 'Pending',
      counterId,
      counterName: counterNames[counterId] || counterId,
      staffId: staffId || null,
      staffName: staffName || '',
      payment: {
        method: 'Online',
        receivedAmount: 0,
        changeReturned: 0,
        transactionId: '',
        gatewayOrderId: cfOrderId,
        gatewayPaymentId: '',
        paymentSessionId: '',
        status: 'Pending',
        paidAt: null
      },
      print: { status: 'Pending' },
      timeline: [{
        status: 'Pending',
        message: 'Order created — awaiting online payment',
        at: new Date()
      }]
    });

    // ── Create Cashfree Order / Payment Session ───────────────────────────────
    const cfOrderRequest = {
      order_id: cfOrderId,
      order_amount: Number(totalAmount.toFixed(2)),
      order_currency: 'INR',
      customer_details: {
        // Counter-based POS — no customer email/phone required by Cashfree sandbox
        // For production, collect actual customer details if needed.
        customer_id: `counter_${counterId}_${Date.now()}`,
        customer_name: counterNames[counterId] || counterId,
        customer_email: `pos_${counterId}@apcstore.local`,
        customer_phone: '9999999999' // placeholder — update if collecting real phone
      },
      order_meta: {
        // No return_url needed for SDK popup integration
        notify_url: `${process.env.CLIENT_URL?.replace('http://localhost:5173', `http://localhost:${process.env.PORT || 5000}`)}/api/payments/cashfree/webhook`
      },
      order_note: `Counter POS Order — ${counterNames[counterId] || counterId}`
    };

    let cfResponse;
    try {
      cfResponse = await cashfree.PGCreateOrder(cfOrderRequest);
    } catch (cfErr) {
      // If Cashfree fails, release reserved stock and delete the order
      for (const item of orderItems) {
        const product = await Product.findById(item.productId);
        if (product) {
          const actualDeduct = Math.min(product.reservedStock, item.quantity);
          if (actualDeduct > 0) {
            await Product.findByIdAndUpdate(item.productId, {
              $inc: { reservedStock: -actualDeduct }
            });
          }
        }
      }
      await order.deleteOne();

      console.error('Cashfree create-order error:', cfErr?.response?.data || cfErr.message);
      return res.status(503).json({
        message: 'Online payment is temporarily unavailable. Please try again or choose Cash.'
      });
    }

    const paymentSessionId = cfResponse.data?.payment_session_id;

    if (!paymentSessionId) {
      // Release stock and order if no session ID returned
      for (const item of orderItems) {
        const product = await Product.findById(item.productId);
        if (product) {
          const actualDeduct = Math.min(product.reservedStock, item.quantity);
          if (actualDeduct > 0) {
            await Product.findByIdAndUpdate(item.productId, {
              $inc: { reservedStock: -actualDeduct }
            });
          }
        }
      }
      await order.deleteOne();
      return res.status(503).json({
        message: 'Online payment is temporarily unavailable. Please try again or choose Cash.'
      });
    }

    // ── Store the payment session ID on the order ─────────────────────────────
    order.payment.paymentSessionId = paymentSessionId;
    await order.save();

    return res.status(201).json({
      orderId: order._id,
      cfOrderId,
      paymentSessionId,
      amount: totalAmount
    });
  } catch (error) {
    console.error('createCashfreeSession error:', error);
    return res.status(500).json({
      message: 'Online payment is temporarily unavailable. Please try again or choose Cash.'
    });
  }
};

// ─── Verify Payment After Checkout ────────────────────────────────────────────

/**
 * POST /api/payments/cashfree/verify
 *
 * Called by frontend after Cashfree checkout closes.
 * Accepts: { orderId (MongoDB _id), cfOrderId }
 * Returns: { success, order }
 *
 * Always verifies with Cashfree backend — never trusts frontend status.
 */
export const verifyCashfreePayment = async (req, res) => {
  try {
    const { orderId, cfOrderId } = req.body;

    if (!orderId || !cfOrderId) {
      return res.status(400).json({ message: 'Order ID and Cashfree Order ID are required' });
    }

    // ── Fetch the order from DB ───────────────────────────────────────────────
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // ── Guard: ensure cfOrderId matches what we stored ────────────────────────
    if (order.payment.gatewayOrderId !== cfOrderId) {
      return res.status(400).json({ message: 'Order ID mismatch' });
    }

    // ── Idempotency: already verified successfully ────────────────────────────
    if (order.payment.status === 'Paid') {
      const populatedOrder = await Order.findById(order._id)
        .populate('items.productId')
        .populate('confirmedBy', 'name')
        .populate('staffId', 'name');
      return res.json({ success: true, order: populatedOrder });
    }

    // ── Verify with Cashfree backend ──────────────────────────────────────────
    let cfPayments;
    try {
      const cfRes = await cashfree.PGOrderFetchPayments(cfOrderId);
      cfPayments = cfRes.data;
    } catch (cfErr) {
      console.error('Cashfree verify error:', cfErr?.response?.data || cfErr.message);
      return res.status(503).json({
        message: 'Could not verify payment with gateway. Please try again or contact support.'
      });
    }

    // ── Find the successful payment in the list ───────────────────────────────
    const successPayment = Array.isArray(cfPayments)
      ? cfPayments.find((p) => p.payment_status === 'SUCCESS')
      : null;

    if (successPayment) {
      // ── Mark payment as Paid ──────────────────────────────────────────────
      order.payment.status = 'Paid';
      order.payment.paidAt = new Date(successPayment.payment_completion_time || Date.now());
      order.payment.gatewayPaymentId = successPayment.cf_payment_id
        ? String(successPayment.cf_payment_id)
        : '';
      order.payment.transactionId = successPayment.bank_reference || '';
      order.payment.receivedAmount = order.totalAmount;

      order.timeline.push({
        status: 'Pending',
        message: `Online payment verified — Payment ID: ${order.payment.gatewayPaymentId}`,
        at: new Date()
      });

      await order.save();

      // ── Emit socket events (same as cash order creation) ─────────────────
      const populatedOrder = await Order.findById(order._id)
        .populate('items.productId')
        .populate('confirmedBy', 'name')
        .populate('staffId', 'name');

      const io = req.app.get('io');
      io.emit('newOrder', populatedOrder);
      io.emit('stockUpdated');

      return res.json({ success: true, order: populatedOrder });
    }

    // ── Payment not successful ────────────────────────────────────────────────
    // Could be pending, failed, or cancelled — mark order accordingly.
    const failedPayment = Array.isArray(cfPayments)
      ? cfPayments.find((p) => ['FAILED', 'CANCELLED', 'USER_DROPPED'].includes(p.payment_status))
      : null;

    const newPaymentStatus = failedPayment?.payment_status === 'CANCELLED' ? 'Failed' : 'Failed';
    order.payment.status = newPaymentStatus;

    order.timeline.push({
      status: order.status,
      message: `Online payment ${newPaymentStatus.toLowerCase()}`,
      at: new Date()
    });

    await order.save();

    // Release reserved stock since payment failed
    for (const item of order.items) {
      const product = await Product.findById(item.productId);
      if (!product) continue;
      const actualDeduct = Math.min(product.reservedStock, item.quantity);
      if (actualDeduct > 0) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { reservedStock: -actualDeduct }
        });
      }
    }

    const io = req.app.get('io');
    io.emit('stockUpdated');

    return res.json({
      success: false,
      message: 'Payment failed. Please try again or choose Cash.'
    });
  } catch (error) {
    console.error('verifyCashfreePayment error:', error);
    return res.status(500).json({
      message: 'Payment verification failed. Please contact support.'
    });
  }
};

// ─── Webhook Handler ───────────────────────────────────────────────────────────

/**
 * POST /api/payments/cashfree/webhook
 *
 * Cashfree sends signed webhook events here.
 * Must be idempotent — same event arriving twice must not double-process.
 *
 * Cashfree Webhook Signature Verification (2023-08-01 API):
 *   Signature = HMAC-SHA256( timestamp + rawBody, secret )
 *   Header: x-webhook-signature, x-webhook-timestamp
 */
export const cashfreeWebhook = async (req, res) => {
  // ── Acknowledge immediately (Cashfree expects quick 200) ─────────────────
  res.status(200).json({ received: true });

  try {
    // ── Signature verification ────────────────────────────────────────────────
    const signature = req.headers['x-webhook-signature'];
    const timestamp = req.headers['x-webhook-timestamp'];
    const rawBody = req.rawBody; // set by express.raw() middleware on this route

    if (!signature || !timestamp) {
      console.warn('[Webhook] Missing signature/timestamp headers — ignoring');
      return;
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.CASHFREE_SECRET_KEY)
      .update(timestamp + rawBody)
      .digest('base64');

    if (signature !== expectedSignature) {
      console.warn('[Webhook] Invalid signature — ignoring event');
      return;
    }

    const event = JSON.parse(rawBody);
    const eventType = event?.type;
    const orderData = event?.data?.order;
    const paymentData = event?.data?.payment;

    if (!orderData || !paymentData) {
      console.warn('[Webhook] Missing order/payment data in event');
      return;
    }

    const cfOrderId = orderData.order_id;
    const paymentStatus = paymentData.payment_status;

    // ── Find order by gateway order ID ───────────────────────────────────────
    const order = await Order.findOne({ 'payment.gatewayOrderId': cfOrderId });
    if (!order) {
      console.warn(`[Webhook] No order found for cfOrderId: ${cfOrderId}`);
      return;
    }

    // ── Idempotency check ─────────────────────────────────────────────────────
    if (order.payment.status === 'Paid' && paymentStatus === 'SUCCESS') {
      console.log(`[Webhook] Already paid — skipping duplicate event for ${cfOrderId}`);
      return;
    }

    if (paymentStatus === 'SUCCESS') {
      // ── Payment successful ────────────────────────────────────────────────
      order.payment.status = 'Paid';
      order.payment.paidAt = new Date(paymentData.payment_completion_time || Date.now());
      order.payment.gatewayPaymentId = paymentData.cf_payment_id
        ? String(paymentData.cf_payment_id)
        : '';
      order.payment.transactionId = paymentData.bank_reference || '';
      order.payment.receivedAmount = order.totalAmount;

      order.timeline.push({
        status: 'Pending',
        message: `[Webhook] Online payment confirmed — Payment ID: ${order.payment.gatewayPaymentId}`,
        at: new Date()
      });

      await order.save();

      const populatedOrder = await Order.findById(order._id)
        .populate('items.productId')
        .populate('confirmedBy', 'name')
        .populate('staffId', 'name');

      // Emit socket event
      // Note: io is not on req here (webhook hits before any middleware that sets it)
      // We store io on the app globally — access via a shared module pattern.
      const { getIO } = await import('../sockets/ioInstance.js');
      const io = getIO();
      if (io) {
        io.emit('newOrder', populatedOrder);
        io.emit('stockUpdated');
      }
    } else if (['FAILED', 'CANCELLED', 'USER_DROPPED'].includes(paymentStatus)) {
      // ── Payment failed/cancelled — release stock ──────────────────────────
      if (order.payment.status !== 'Failed') {
        order.payment.status = 'Failed';
        order.timeline.push({
          status: order.status,
          message: `[Webhook] Online payment ${paymentStatus.toLowerCase()}`,
          at: new Date()
        });
        await order.save();

        for (const item of order.items) {
          const product = await Product.findById(item.productId);
          if (!product) continue;
          const actualDeduct = Math.min(product.reservedStock, item.quantity);
          if (actualDeduct > 0) {
            await Product.findByIdAndUpdate(item.productId, {
              $inc: { reservedStock: -actualDeduct }
            });
          }
        }

        const { getIO } = await import('../sockets/ioInstance.js');
        const io = getIO();
        if (io) {
          io.emit('stockUpdated');
        }
      }
    }
  } catch (err) {
    console.error('[Webhook] Processing error:', err);
  }
};
