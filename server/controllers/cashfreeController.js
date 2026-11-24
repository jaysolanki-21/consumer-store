/**
 * cashfreeController.js
 * Handles Cashfree payment session creation, verification, and webhook processing.
 * Supports both Localhost (Sandbox) and Production (Render + Netlify).
 * All Cashfree credentials are used server-side only — never exposed to the frontend.
 */

import '../config/loadEnv.js';
import { Cashfree, CFEnvironment } from 'cashfree-pg';
import axios from 'axios';
import https from 'https';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Counter from '../models/Counter.js';
import User from '../models/User.js';

// Dedicated HTTPS Agent with connection pooling and keepAlive for low-latency, resilient Cashfree calls
const httpsAgent = new https.Agent({
  keepAlive: true,
  timeout: 15000,
  maxSockets: 50,
});

const cashfreeHttpClient = axios.create({
  timeout: 15000,
  httpsAgent,
});

// ─── Cashfree Configuration Resolver ──────────────────────────────────────────
export const getCashfreeConfig = () => {
  const appId = (
    process.env.CASHFREE_CLIENT_ID ||
    process.env.CASHFREE_APP_ID ||
    process.env.CF_CLIENT_ID ||
    process.env.CF_APP_ID ||
    ''
  ).trim();

  const secretKey = (
    process.env.CASHFREE_CLIENT_SECRET ||
    process.env.CASHFREE_SECRET_KEY ||
    process.env.CF_CLIENT_SECRET ||
    process.env.CF_SECRET_KEY ||
    ''
  ).trim();

  const rawEnv = (
    process.env.CASHFREE_ENV ||
    process.env.CASHFREE_ENVIRONMENT ||
    process.env.CF_ENV ||
    process.env.VITE_CASHFREE_ENV ||
    process.env.VITE_CASHFREE_MODE ||
    'SANDBOX'
  ).trim().toLowerCase();

  const isProduction = rawEnv === 'production' || rawEnv === 'prod';
  const environment = isProduction ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX;
  const environmentName = isProduction ? 'production' : 'sandbox';
  const baseUrl = isProduction ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';

  // Cashfree API version (defaults to stable 2025-01-01, also supports 2023-08-01 / 2026-01-01)
  const apiVersion = (process.env.CASHFREE_API_VERSION || '2025-01-01').trim();

  return { appId, secretKey, environment, environmentName, baseUrl, apiVersion };
};

// ─── Cashfree SDK Instance Cache ──────────────────────────────────────────────
let cachedCashfree = null;
let cachedConfigKey = '';

export const getCashfree = () => {
  const { appId, secretKey, environment, environmentName, apiVersion } = getCashfreeConfig();

  const configKey = `${appId}:${secretKey}:${environmentName}:${apiVersion}`;
  if (cachedCashfree && cachedConfigKey === configKey) {
    return cachedCashfree;
  }

  if (!appId || !secretKey) {
    console.error('[Cashfree] Missing CASHFREE_CLIENT_ID / CASHFREE_APP_ID or CASHFREE_CLIENT_SECRET / CASHFREE_SECRET_KEY in environment.');
  }

  cachedCashfree = new Cashfree(
    environment,
    appId,
    secretKey
  );

  // Explicitly configure API Version on the Cashfree instance
  cachedCashfree.XApiVersion = apiVersion;

  cachedConfigKey = configKey;
  return cachedCashfree;
};

// ─── Backend URL Resolver for Webhooks ─────────────────────────────────────────
const getBackendUrl = () => {
  if (process.env.BACKEND_URL) return process.env.BACKEND_URL.replace(/\/+$/, '');
  if (process.env.SERVER_URL) return process.env.SERVER_URL.replace(/\/+$/, '');
  if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL.replace(/\/+$/, '');
  if (process.env.NODE_ENV === 'production') return 'https://consumer-store.onrender.com';
  const port = process.env.PORT || 5000;
  return `http://localhost:${port}`;
};

// ─── Automatic Retry for Transient Gateway Errors (502 / 503 / 504 / APISIX / Network) ───
const executeWithRetry = async (fn, maxRetries = 3, baseDelay = 800) => {
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = err?.response?.status;
      const data = err?.response?.data;
      const isHtml502 = typeof data === 'string' && (data.includes('502 Bad Gateway') || data.includes('APISIX'));
      const isTransient =
        status === 502 ||
        status === 503 ||
        status === 504 ||
        isHtml502 ||
        err.code === 'ECONNRESET' ||
        err.code === 'ETIMEDOUT' ||
        err.code === 'ERR_NETWORK' ||
        err.code === 'ENOTFOUND';

      if (!isTransient || attempt === maxRetries) {
        throw err;
      }
      const jitter = Math.floor(Math.random() * 300);
      const delay = baseDelay * Math.pow(2, attempt) + jitter;
      console.warn(`[Cashfree] Transient gateway error (${status || (isHtml502 ? 502 : err.code)}). Retrying attempt ${attempt + 1}/${maxRetries} after ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastErr;
};

// ─── Unified Resilient Order Creator (SDK with Direct REST fallback) ─────────
export const createCfOrderSession = async (cfOrderRequest) => {
  const { appId, secretKey, baseUrl, apiVersion } = getCashfreeConfig();

  // Try official SDK first with retry
  try {
    const res = await executeWithRetry(() => getCashfree().PGCreateOrder(cfOrderRequest));
    if (res?.data?.payment_session_id) {
      return res.data;
    }
  } catch (sdkErr) {
    console.warn('[Cashfree] SDK PGCreateOrder attempt failed, trying Direct REST fallback...', sdkErr?.message || sdkErr);
  }

  // Direct REST API Fallback with explicit timeout and headers
  const restRes = await executeWithRetry(async () => {
    return await cashfreeHttpClient.post(`${baseUrl}/orders`, cfOrderRequest, {
      headers: {
        'x-client-id': appId,
        'x-client-secret': secretKey,
        'x-api-version': apiVersion,
        'Content-Type': 'application/json'
      }
    });
  });

  return restRes.data;
};

// ─── Unified Resilient Payment Fetcher ─────────────────────────────────────────
export const fetchCfOrderPaymentsResilient = async (cfOrderId) => {
  const { appId, secretKey, baseUrl, apiVersion } = getCashfreeConfig();

  try {
    const res = await executeWithRetry(() => getCashfree().PGOrderFetchPayments(cfOrderId));
    if (Array.isArray(res?.data)) return res.data;
  } catch (sdkErr) {
    console.warn('[Cashfree] SDK PGOrderFetchPayments failed, attempting Direct REST fallback...', sdkErr?.message || sdkErr);
  }

  try {
    const restRes = await executeWithRetry(async () => {
      return await cashfreeHttpClient.get(`${baseUrl}/orders/${encodeURIComponent(cfOrderId)}/payments`, {
        headers: {
          'x-client-id': appId,
          'x-client-secret': secretKey,
          'x-api-version': apiVersion
        }
      });
    });
    return Array.isArray(restRes?.data) ? restRes.data : [];
  } catch (restErr) {
    console.warn('[Cashfree] Direct REST fetch payments failed:', restErr?.message || restErr);
    return [];
  }
};

// ─── Unified Resilient Order Status Fetcher ───────────────────────────────────
export const fetchCfOrderResilient = async (cfOrderId) => {
  const { appId, secretKey, baseUrl, apiVersion } = getCashfreeConfig();

  try {
    const res = await executeWithRetry(() => getCashfree().PGFetchOrder(cfOrderId));
    if (res?.data) return res.data;
  } catch (sdkErr) {
    console.warn('[Cashfree] SDK PGFetchOrder failed, attempting Direct REST fallback...', sdkErr?.message || sdkErr);
  }

  try {
    const restRes = await executeWithRetry(async () => {
      return await cashfreeHttpClient.get(`${baseUrl}/orders/${encodeURIComponent(cfOrderId)}`, {
        headers: {
          'x-client-id': appId,
          'x-client-secret': secretKey,
          'x-api-version': apiVersion
        }
      });
    });
    return restRes?.data || null;
  } catch (restErr) {
    console.warn('[Cashfree] Direct REST fetch order failed:', restErr?.message || restErr);
    return null;
  }
};

// ─── Sanitized Error Parser ───────────────────────────────────────────────────
const parseCashfreeError = (err) => {
  const status = err?.response?.status;
  const data = err?.response?.data;
  let message = err.message || 'Payment gateway error';
  let isBadGateway = false;

  if (status === 502 || (typeof data === 'string' && data.includes('502 Bad Gateway'))) {
    isBadGateway = true;
    message = 'Cashfree Payment Gateway is currently experiencing intermittent downtime (502 Bad Gateway from APISIX). Please try again in a few moments or choose Cash.';
  } else if (typeof data === 'object' && data !== null) {
    message = data.message || data.error || JSON.stringify(data);
  } else if (typeof data === 'string' && data.length > 0) {
    message = data.length > 250 ? `${data.substring(0, 250)}...` : data;
  }

  return {
    status: isBadGateway ? 502 : (status || 500),
    isBadGateway,
    message,
    code: data?.code || (isBadGateway ? '502_BAD_GATEWAY' : 'GATEWAY_ERROR')
  };
};

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
 * Returns: { orderId (MongoDB), cfOrderId, paymentSessionId, amount, environment }
 *
 * Security:
 *  - Cart total is re-calculated server-side from current product prices.
 *  - Frontend-provided amount is IGNORED.
 *  - Stock is reserved with rollback on failure.
 *  - Transient 502/503/504 gateway errors are retried automatically.
 */
export const createCashfreeSession = async (req, res) => {
  try {
    const { items, counter, counterId, counterName, staffId, staffName } = req.body;
    const { appId, secretKey, environmentName } = getCashfreeConfig();

    if (!appId || !secretKey) {
      console.error('[Cashfree] Missing CASHFREE_CLIENT_ID / CASHFREE_APP_ID or CASHFREE_CLIENT_SECRET / CASHFREE_SECRET_KEY in environment.');
      return res.status(503).json({
        success: false,
        message: 'Online payment is temporarily unavailable. Please try again or choose Cash.'
      });
    }

    // ── Validate input ────────────────────────────────────────────────────────
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    const rawCounter = (typeof counter === 'object' && counter?._id) ? counter._id : (counter || counterId);
    if (!rawCounter) {
      return res.status(400).json({ success: false, message: 'Counter is required' });
    }

    // ── Verify stock availability ─────────────────────────────────────────────
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(404).json({ success: false, message: `Product not found: ${item.productId}` });
      }
      const available = product.stock - (product.reservedStock || 0);
      if (available < item.quantity) {
        return res.status(400).json({
          success: false,
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
      return res.status(400).json({ success: false, message: 'Order total is too low for online payment' });
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
    const sanitizedCounterName = (resolvedCounterName || 'Counter')
      .replace(/[^a-zA-Z0-9\s._-]/g, '')
      .trim() || 'Counter';

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
      staffId: (staffId && mongoose.Types.ObjectId.isValid(staffId)) ? staffId : null,
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

    // ── Build Cashfree Order Request ──────────────────────────────────────────
    const backendUrl = getBackendUrl();
    const isPublicHttps = backendUrl.startsWith('https://');

    // Only set notify_url if backend is public HTTPS (e.g. Render).
    // On localhost, Cashfree cannot dispatch webhooks, and passing localhost can trigger gateway rejection.
    const notifyUrl = isPublicHttps
      ? `${backendUrl}/api/payments/cashfree/webhook`
      : undefined;

    const clientUrl = (
      process.env.CLIENT_URL ||
      process.env.FRONTEND_URL ||
      'https://apc-consumer-store.netlify.app'
    ).replace(/\/+$/, '');

    const orderMeta = {};
    if (notifyUrl) {
      orderMeta.notify_url = notifyUrl;
    }
    if (clientUrl) {
      orderMeta.return_url = `${clientUrl}/consumer/checkout?order_id={order_id}`;
    }

    const counterSuffix = resolvedCounterId ? resolvedCounterId.toString().slice(-6) : 'pos';
    const cfOrderRequest = {
      order_id: cfOrderId,
      order_amount: Number(totalAmount.toFixed(2)),
      order_currency: 'INR',
      customer_details: {
        customer_id: `cust_${counterSuffix}_${Date.now()}`,
        customer_name: sanitizedCounterName,
        customer_email: `pos_${counterSuffix}@apcstore.com`,
        customer_phone: '9999999999'
      },
      order_meta: orderMeta,
      order_note: `POS Order — ${sanitizedCounterName}`
    };

    // ── Create Cashfree Order / Payment Session with Resilience ───────────────
    let cfData;
    try {
      cfData = await createCfOrderSession(cfOrderRequest);
    } catch (cfErr) {
      // Release reserved stock upon Cashfree failure
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

      const parsedError = parseCashfreeError(cfErr);
      console.error('[Cashfree create-order error]:', {
        status: parsedError.status,
        code: parsedError.code,
        message: parsedError.message,
        environment: environmentName
      });

      return res.status(parsedError.status >= 500 ? 503 : parsedError.status).json({
        success: false,
        message: parsedError.message,
        code: parsedError.code,
        isBadGateway: parsedError.isBadGateway
      });
    }

    const paymentSessionId = cfData?.payment_session_id;

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
        success: false,
        message: 'Could not obtain payment session from Cashfree. Please try again or choose Cash.'
      });
    }

    // ── Store the payment session ID on the order ─────────────────────────────
    order.payment.paymentSessionId = paymentSessionId;
    await order.save();

    return res.status(201).json({
      success: true,
      orderId: order._id,
      cfOrderId,
      paymentSessionId,
      amount: totalAmount,
      environment: environmentName // 'sandbox' or 'production' for frontend SDK alignment
    });
  } catch (error) {
    console.error('createCashfreeSession error:', error);
    return res.status(500).json({
      success: false,
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
 * Authoritatively verifies with Cashfree backend — never trusts frontend status alone.
 */
export const verifyCashfreePayment = async (req, res) => {
  try {
    const { orderId, cfOrderId } = req.body;

    if (!orderId || !cfOrderId) {
      return res.status(400).json({ success: false, message: 'Order ID and Cashfree Order ID are required' });
    }

    // ── Fetch order from DB ───────────────────────────────────────────────────
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // ── Guard: ensure cfOrderId matches stored gatewayOrderId ─────────────────
    if (order.payment.gatewayOrderId !== cfOrderId) {
      return res.status(400).json({ success: false, message: 'Order ID mismatch' });
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

    // ── Verify with Cashfree backend (with resilient SDK & direct REST fallback) ──
    const [cfPayments, cfOrder] = await Promise.all([
      fetchCfOrderPaymentsResilient(cfOrderId),
      fetchCfOrderResilient(cfOrderId)
    ]);

    // ── Check for successful payment ──────────────────────────────────────────
    const successPayment = Array.isArray(cfPayments)
      ? cfPayments.find((p) => p.payment_status === 'SUCCESS')
      : null;

    const isOrderPaid = cfOrder?.order_status === 'PAID';

    if (successPayment || isOrderPaid) {
      // ── Mark payment as Paid ────────────────────────────────────────────────
      order.payment.status = 'Paid';
      order.payment.paidAt = new Date(successPayment?.payment_completion_time || Date.now());
      order.payment.gatewayPaymentId = successPayment?.cf_payment_id
        ? String(successPayment.cf_payment_id)
        : (order.payment.gatewayPaymentId || '');
      order.payment.transactionId = successPayment?.bank_reference || '';
      order.payment.receivedAmount = order.totalAmount;

      order.timeline.push({
        status: 'Pending',
        message: `Online payment verified — Payment ID: ${order.payment.gatewayPaymentId || cfOrderId}`,
        at: new Date()
      });

      await order.save();

      // ── Emit socket events ──────────────────────────────────────────────────
      const populatedOrder = await Order.findById(order._id)
        .populate('items.productId')
        .populate('confirmedBy', 'name')
        .populate('staffId', 'name')
        .populate('counter', 'name');

      const io = req.app.get('io');
      if (io) {
        io.emit('newOrder', populatedOrder);
        io.emit('stockUpdated');
      }

      return res.json({ success: true, order: populatedOrder });
    }

    // ── Payment not successful: Mark order Cancelled and release stock ─────────
    const failedPayment = Array.isArray(cfPayments)
      ? cfPayments.find((p) => ['FAILED', 'CANCELLED', 'USER_DROPPED'].includes(p.payment_status))
      : null;

    const failureReason = failedPayment?.payment_status
      ? failedPayment.payment_status.toLowerCase()
      : (cfOrder?.order_status ? cfOrder.order_status.toLowerCase() : 'unsuccessful');

    order.payment.status = 'Failed';
    order.status = 'Cancelled';

    order.timeline.push({
      status: 'Cancelled',
      message: `Online payment ${failureReason}`,
      at: new Date()
    });

    await order.save();

    // Release reserved stock since payment was not completed
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
    if (io) {
      io.emit('stockUpdated');
      io.emit('orderUpdated', order);
    }

    return res.json({
      success: false,
      message: 'Payment was not completed. Please try again or choose Cash.'
    });
  } catch (error) {
    console.error('verifyCashfreePayment error:', error);
    return res.status(500).json({
      success: false,
      message: 'Payment verification failed. Please contact support.'
    });
  }
};

// ─── Webhook Handler ───────────────────────────────────────────────────────────
/**
 * POST /api/payments/cashfree/webhook
 *
 * Cashfree sends signed webhook events here.
 * Idempotent: repeated events will not process twice.
 *
 * Cashfree Webhook Signature Verification:
 *   Signature = HMAC-SHA256( timestamp + rawBody, secret )
 *   Headers: x-webhook-signature, x-webhook-timestamp
 */
export const cashfreeWebhook = async (req, res) => {
  // Acknowledge immediately to satisfy Cashfree SLA
  res.status(200).json({ received: true });

  try {
    const signature = req.headers['x-webhook-signature'];
    const timestamp = req.headers['x-webhook-timestamp'];
    const rawBody = req.rawBody; // set by express.raw() middleware

    if (!signature || !timestamp || !rawBody) {
      console.warn('[Cashfree Webhook] Missing signature, timestamp, or raw body — ignoring');
      return;
    }

    const { secretKey } = getCashfreeConfig();
    const webhookSecret = process.env.CASHFREE_WEBHOOK_SECRET || secretKey;

    if (!webhookSecret) {
      console.warn('[Cashfree Webhook] No webhook secret or client secret configured — skipping');
      return;
    }

    // Verify HMAC-SHA256 signature
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(timestamp + rawBody)
      .digest('base64');

    if (signature !== expectedSignature) {
      console.warn('[Cashfree Webhook] Invalid signature — ignoring event');
      return;
    }

    const event = JSON.parse(rawBody);
    const orderData = event?.data?.order;
    const paymentData = event?.data?.payment;

    if (!orderData || !paymentData) {
      console.warn('[Cashfree Webhook] Missing order/payment payload');
      return;
    }

    const cfOrderId = orderData.order_id;
    const paymentStatus = paymentData.payment_status;

    const order = await Order.findOne({ 'payment.gatewayOrderId': cfOrderId });
    if (!order) {
      console.warn(`[Cashfree Webhook] No order found for cfOrderId: ${cfOrderId}`);
      return;
    }

    // Idempotency check: already paid
    if (order.payment.status === 'Paid' && paymentStatus === 'SUCCESS') {
      console.log(`[Cashfree Webhook] Already paid — skipping duplicate for ${cfOrderId}`);
      return;
    }

    if (paymentStatus === 'SUCCESS') {
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

      const { getIO } = await import('../sockets/ioInstance.js');
      const io = getIO();
      if (io) {
        io.emit('newOrder', populatedOrder);
        io.emit('stockUpdated');
      }
    } else if (['FAILED', 'CANCELLED', 'USER_DROPPED'].includes(paymentStatus)) {
      if (order.payment.status !== 'Failed' && order.payment.status !== 'Paid') {
        order.payment.status = 'Failed';
        order.status = 'Cancelled';
        order.timeline.push({
          status: 'Cancelled',
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
          io.emit('orderUpdated', order);
        }
      }
    }
  } catch (err) {
    console.error('[Cashfree Webhook] Processing error:', err);
  }
};

// ─── Cancel Session / Checkout Abandonment ─────────────────────────────────────
/**
 * POST /api/payments/cashfree/cancel-session
 *
 * Called when the customer closes the Cashfree checkout modal or abandons payment.
 * Releases reserved stock and marks order status as Cancelled.
 */
export const cancelCashfreeSession = async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Order ID is required' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.payment?.status === 'Paid') {
      return res.status(400).json({ success: false, message: 'Cannot cancel an order that has already been paid' });
    }

    // Safety check with gateway before cancelling: confirm not paid on Cashfree
    if (order.payment?.gatewayOrderId) {
      const cfOrder = await fetchCfOrderResilient(order.payment.gatewayOrderId);
      if (cfOrder?.order_status === 'PAID') {
        order.payment.status = 'Paid';
        order.payment.paidAt = new Date();
        order.timeline.push({
          status: 'Pending',
          message: 'Online payment confirmed during cancellation check',
          at: new Date()
        });
        await order.save();
        return res.json({ success: true, message: 'Order was already verified as paid' });
      }
    }

    if (order.status !== 'Cancelled') {
      order.status = 'Cancelled';
      order.payment.status = 'Failed';
      order.timeline.push({
        status: 'Cancelled',
        message: 'Online payment cancelled / session closed',
        at: new Date()
      });
      await order.save();

      // Release reserved stock
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
      if (io) {
        io.emit('stockUpdated');
        io.emit('orderUpdated', order);
      }
    }

    return res.json({ success: true, message: 'Session cancelled and stock released' });
  } catch (error) {
    console.error('cancelCashfreeSession error:', error);
    return res.status(500).json({ success: false, message: 'Failed to cancel session' });
  }
};
