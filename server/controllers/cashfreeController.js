/**
 * cashfreeController.js
 * Handles Cashfree payment session creation, verification, and webhook processing.
 * All Cashfree credentials are used server-side only — never exposed to the frontend.
 */

import { Cashfree, CFEnvironment } from 'cashfree-pg';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Counter from '../models/Counter.js';
import User from '../models/User.js';
import { recordAuditLog } from '../utils/auditLogger.js';

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
 * Accepts: { items, counter, counterId, counterName, staffId, staffName }
 * Returns: { orderId (MongoDB), cfOrderId, paymentSessionId, amount }
 *
 * Security:
 *  - Cart total is re-calculated server-side from current product prices.
 *  - Frontend-provided amount is IGNORED.
 *  - Duplicate protection via gatewayOrderId uniqueness.
 */
export const createCashfreeSession = async (req, res) => {
  try {
    const { items, counter, counterId, counterName, staffId, staffName } = req.body;

    // ── Validate input ────────────────────────────────────────────────────────
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    const rawCounter = (typeof counter === 'object' && counter?._id) ? counter._id : (counter || counterId);

    if (!rawCounter) {
      return res.status(400).json({ message: 'Counter is required' });
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

    // ── Resolve Counter document dynamically ────────────────────────────────
    let counterDoc = null;
    if (mongoose.Types.ObjectId.isValid(rawCounter)) {
      counterDoc = await Counter.findById(rawCounter);
      if (!counterDoc) {
        counterDoc = await Counter.findOne({ userId: rawCounter });
      }
    }
    if (!counterDoc && typeof rawCounter === 'string') {
      counterDoc = await Counter.findOne({ name: rawCounter });
    }
    if (!counterDoc && mongoose.Types.ObjectId.isValid(rawCounter)) {
      const u = await User.findById(rawCounter);
      if (u) {
        counterDoc = await Counter.findOne({ userId: u._id });
      }
    }

    const resolvedCounterId = counterDoc ? counterDoc._id : (mongoose.Types.ObjectId.isValid(rawCounter) ? rawCounter : null);
    const resolvedCounterName = counterDoc 
      ? counterDoc.name 
      : (counterName || (typeof counter === 'object' ? counter.name : null) || 'Counter 1');

    // ── Generate unique Cashfree order ID ─────────────────────────────────────
    const cfOrderId = generateCfOrderId();

    // ── Create the MongoDB order with status Pending, paymentStatus Pending ───
    const order = await Order.create({
      items: orderItems,
      totalAmount,
      status: 'Pending',
      counter: resolvedCounterId || undefined,
      counterId: resolvedCounterId ? resolvedCounterId.toString() : String(rawCounter),
      counterName: resolvedCounterName,
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
        customer_id: `counter_${resolvedCounterId ? resolvedCounterId.toString().slice(-8) : 'pos'}_${Date.now()}`,
        customer_name: resolvedCounterName,
        customer_email: `pos_${resolvedCounterId ? resolvedCounterId.toString().slice(-6) : 'pos'}@apcstore.local`,
        customer_phone: '9999999999'
      },
      order_meta: {
        notify_url: `${process.env.CLIENT_URL?.replace('http://localhost:5173', `http://localhost:${process.env.PORT || 5000}`)}/api/payments/cashfree/webhook`
      },
      order_note: `Counter POS Order — ${resolvedCounterName}`
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

    const orderShortId = '#' + order._id.toString().slice(-6).toUpperCase();
    await recordAuditLog({
      userId: req.user?._id || null,
      userName: req.user?.name || resolvedCounterName,
      role: req.user?.role || 'counter',
      action: 'PAYMENT_INITIATED',
      module: 'Payments',
      targetType: 'Payment',
      targetId: order._id,
      targetName: orderShortId,
      orderId: order._id.toString(),
      counterId: resolvedCounterId ? resolvedCounterId.toString() : null,
      counterName: resolvedCounterName,
      amount: totalAmount,
      paymentMethod: 'Online',
      description: `${resolvedCounterName} initiated Online payment of ₹${totalAmount} for Order ${orderShortId}`,
      status: 'Success',
      metadata: { cfOrderId, paymentSessionId }
    }, req);

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
        .populate('staffId', 'name')
        .populate('counter', 'name');
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
        .populate('staffId', 'name')
        .populate('counter', 'name');

      const io = req.app.get('io');
      io.emit('newOrder', populatedOrder);
      io.emit('stockUpdated');

      const orderShortId = '#' + order._id.toString().slice(-6).toUpperCase();
      await recordAuditLog({
        userId: req.user?._id || null,
        userName: order.counterName || 'POS Counter',
        role: req.user?.role || 'counter',
        action: 'PAYMENT_SUCCESS',
        module: 'Payments',
        targetType: 'Payment',
        targetId: order._id,
        targetName: orderShortId,
        orderId: order._id.toString(),
        counterId: order.counter ? String(order.counter) : null,
        counterName: order.counterName || null,
        amount: order.totalAmount,
        paymentMethod: 'Online',
        description: `Online payment of ₹${order.totalAmount} completed successfully for Order ${orderShortId}`,
        status: 'Success'
      }, req);

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

    const orderShortId = '#' + order._id.toString().slice(-6).toUpperCase();
    await recordAuditLog({
      userId: req.user?._id || null,
      userName: order.counterName || 'POS Counter',
      role: req.user?.role || 'counter',
      action: 'PAYMENT_FAILED',
      module: 'Payments',
      targetType: 'Payment',
      targetId: order._id,
      targetName: orderShortId,
      orderId: order._id.toString(),
      counterId: order.counter ? String(order.counter) : null,
      counterName: order.counterName || null,
      amount: order.totalAmount,
      paymentMethod: 'Online',
      failureReason: failedPayment?.payment_status || 'Payment dropped or failed',
      description: `Online payment failed for Order ${orderShortId} (₹${order.totalAmount}) - Reason: ${failedPayment?.payment_status || 'Failed'}`,
      status: 'Failed'
    }, req);

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
        .populate('staffId', 'name')
        .populate('counter', 'name');

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
