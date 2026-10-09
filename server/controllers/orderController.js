import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Counter from '../models/Counter.js';
import User from '../models/User.js';
import mongoose from 'mongoose';
import { recordAuditLog } from '../utils/auditLogger.js';

export const createOrder = async (req, res) => {
  try {
    const { 
      items, 
      counter,
      counterId, 
      counterName,
      staffId, 
      staffName,
      payment = {} 
    } = req.body;

    const rawCounter = (typeof counter === 'object' && counter?._id) ? counter._id : (counter || counterId);

    if (!rawCounter) {
      return res.status(400).json({ message: 'Counter is required' });
    }

    // 1. Validate availability (stock - reservedStock)
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(404).json({ message: `Product not found` });
      }
      const available = product.stock - product.reservedStock;
      if (available < item.quantity) {
        return res.status(400).json({
          message: `Only ${available} units of ${product.name} available`
        });
      }
    }

    // 2. Reserve stock
    for (const item of items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { reservedStock: item.quantity }
      });
    }

    // 3. Calculate total & create order with all required fields
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
        price: price,
        sellingPrice: price,  // ✅ Store sellingPrice
        costPrice: costPrice  // ✅ Store costPrice for profit calculations
      });
    }

    // Resolve Counter document using current schema
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

    // Prepare payment object
    const paymentData = {
      method: payment.method || 'Cash',
      receivedAmount: payment.receivedAmount || totalAmount,
      changeReturned: payment.changeReturned || 0,
      transactionId: payment.transactionId || '',
      gatewayOrderId: payment.gatewayOrderId || '',
      gatewayPaymentId: payment.gatewayPaymentId || '',
      paymentSessionId: payment.paymentSessionId || '',
      status: payment.status || 'Pending',
      paidAt: payment.status === 'Paid' ? new Date() : null
    };

    const order = await Order.create({
      items: orderItems,
      totalAmount,
      status: 'Pending',
      counter: resolvedCounterId || undefined,
      counterId: resolvedCounterId ? resolvedCounterId.toString() : String(rawCounter),
      counterName: resolvedCounterName,
      staffId: staffId || null,
      staffName: staffName || '',
      payment: paymentData,
      print: {
        status: 'Pending'
      },
      timeline: [{
        status: 'Pending',
        message: 'Order created',
        at: new Date()
      }]
    });

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
      userName: req.user?.name || resolvedCounterName,
      role: req.user?.role || 'counter',
      action: 'ORDER_CREATED',
      module: 'Orders',
      targetType: 'Order',
      targetId: order._id,
      targetName: orderShortId,
      orderId: order._id.toString(),
      counterId: resolvedCounterId ? resolvedCounterId.toString() : null,
      counterName: resolvedCounterName,
      amount: totalAmount,
      paymentMethod: paymentData.method,
      newValue: { status: 'Pending', totalAmount, itemsCount: orderItems.length },
      description: `${req.user?.name || resolvedCounterName} created Order ${orderShortId} for ₹${totalAmount} at ${resolvedCounterName}`,
      status: 'Success'
    }, req);

    res.status(201).json(populatedOrder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

export const getOrders = async (req, res) => {
  try {
    const isCounterRole = req.user && req.user.role === 'counter';
    const paramCounter = req.query.counterId || req.query.counter;

    const andConditions = [];

    // Counter condition
    if (isCounterRole || (paramCounter && paramCounter !== 'all')) {
      let counterDoc = null;
      if (isCounterRole) {
        counterDoc = await Counter.findOne({ userId: req.user._id });
      } else if (paramCounter && mongoose.Types.ObjectId.isValid(paramCounter)) {
        counterDoc = await Counter.findById(paramCounter);
        if (!counterDoc) counterDoc = await Counter.findOne({ userId: paramCounter });
      } else if (paramCounter && typeof paramCounter === 'string') {
        counterDoc = await Counter.findOne({ name: paramCounter });
      }

      const counterConditions = [];
      if (counterDoc) {
        counterConditions.push({ counter: counterDoc._id });
        counterConditions.push({ counterId: counterDoc._id.toString() });
        counterConditions.push({ counterName: counterDoc.name });
      }
      if (paramCounter && paramCounter !== 'all') {
        counterConditions.push({ counterId: paramCounter.toString() });
        counterConditions.push({ counterName: paramCounter.toString() });
        if (mongoose.Types.ObjectId.isValid(paramCounter)) {
          counterConditions.push({ counter: paramCounter });
        }
      }
      if (isCounterRole && req.user?._id) {
        counterConditions.push({ counterId: req.user._id.toString() });
        counterConditions.push({ counterName: req.user.name });
        if (mongoose.Types.ObjectId.isValid(req.user._id)) {
          counterConditions.push({ counter: req.user._id });
        }
      }
      if (counterConditions.length > 0) {
        andConditions.push({ $or: counterConditions });
      }
    }

    // Date condition (Asia/Kolkata IST)
    let dateCondition = null;
    if (req.query.today === 'true' || req.query.date === 'today') {
      const now = new Date();
      const istDateStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(now);
      const [y, m, d] = istDateStr.split('-').map(Number);
      const startOfDay = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - (5.5 * 60 * 60 * 1000));
      const endOfDay = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) - (5.5 * 60 * 60 * 1000));
      dateCondition = { createdAt: { $gte: startOfDay, $lte: endOfDay } };
    } else if (req.query.date && req.query.date !== 'all') {
      const parts = req.query.date.split('-').map(Number);
      if (parts.length === 3 && !parts.some(isNaN)) {
        const [y, m, d] = parts;
        const startOfDay = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - (5.5 * 60 * 60 * 1000));
        const endOfDay = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) - (5.5 * 60 * 60 * 1000));
        dateCondition = { createdAt: { $gte: startOfDay, $lte: endOfDay } };
      }
    } else if (req.query.startDate && req.query.endDate) {
      dateCondition = {
        createdAt: {
          $gte: new Date(req.query.startDate),
          $lte: new Date(req.query.endDate)
        }
      };
    }

    if (dateCondition) {
      andConditions.push(dateCondition);
    }

    // Base conditions for date & counter stats
    const baseConditions = [...andConditions];

    // Status filter
    if (req.query.status && req.query.status !== 'all') {
      const st = req.query.status.toLowerCase();
      if (st === 'pending') {
        andConditions.push({ status: { $in: ['Pending', 'Processing'] } });
      } else if (st === 'confirmed' || st === 'completed') {
        andConditions.push({ status: { $in: ['Confirmed', 'Completed'] } });
      } else if (st === 'cancelled' || st === 'rejected') {
        andConditions.push({ status: { $in: ['Cancelled', 'Rejected'] } });
      } else {
        andConditions.push({ status: { $regex: new RegExp(`^${req.query.status}$`, 'i') } });
      }
    }

    // Payment method filter
    if (req.query.payment && req.query.payment !== 'all') {
      const pm = req.query.payment.toLowerCase();
      if (pm === 'cash') {
        andConditions.push({
          $or: [
            { 'payment.method': { $regex: /^cash$/i } },
            { paymentMethod: { $regex: /^cash$/i } }
          ]
        });
      } else if (pm === 'online') {
        andConditions.push({
          $or: [
            { 'payment.method': { $regex: /^(online|card|upi)$/i } },
            { paymentMethod: { $regex: /^(online|card|upi)$/i } }
          ]
        });
      } else {
        andConditions.push({
          $or: [
            { 'payment.method': { $regex: new RegExp(`^${req.query.payment}$`, 'i') } },
            { paymentMethod: { $regex: new RegExp(`^${req.query.payment}$`, 'i') } }
          ]
        });
      }
    }

    // Search filter
    if (req.query.search && req.query.search.trim()) {
      const raw = req.query.search.trim();
      const clean = raw.replace(/^#/, '').replace(/^ORD-/i, '').trim();
      const searchOr = [
        { invoiceNumber: { $regex: clean, $options: 'i' } },
        { billNumber: { $regex: clean, $options: 'i' } },
        { 'items.name': { $regex: clean, $options: 'i' } },
        { 'items.productName': { $regex: clean, $options: 'i' } }
      ];
      if (mongoose.Types.ObjectId.isValid(clean) && clean.length === 24) {
        searchOr.push({ _id: new mongoose.Types.ObjectId(clean) });
      } else if (clean.length >= 4) {
        searchOr.push({
          $expr: {
            $regexMatch: {
              input: { $toString: '$_id' },
              regex: clean,
              options: 'i'
            }
          }
        });
      }
      andConditions.push({ $or: searchOr });
    }

    // Staff filter
    if (req.query.staff && req.query.staff !== 'all') {
      if (mongoose.Types.ObjectId.isValid(req.query.staff)) {
        andConditions.push({
          $or: [
            { staffId: req.query.staff },
            { confirmedBy: req.query.staff }
          ]
        });
      } else {
        andConditions.push({ staffName: req.query.staff });
      }
    }

    const finalQuery = andConditions.length === 0
      ? {}
      : andConditions.length === 1
        ? andConditions[0]
        : { $and: andConditions };

    if (req.query.countOnly === 'true') {
      const count = await Order.countDocuments(finalQuery);
      return res.json({ count });
    }

    const isPaginated = req.query.page !== undefined || req.query.limit !== undefined || req.query.paginate === 'true';

    if (isPaginated) {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 25));
      const skip = (page - 1) * limit;

      const [total, orders] = await Promise.all([
        Order.countDocuments(finalQuery),
        Order.find(finalQuery)
          .populate('items.productId')
          .populate('confirmedBy', 'name email')
          .populate('staffId', 'name email')
          .populate({
            path: 'counter',
            select: 'name description userId',
            populate: { path: 'userId', select: 'name email isOnline lastLogin lastSeen' }
          })
          .sort({ createdAt: req.query.sort === 'asc' ? 1 : -1 })
          .skip(skip)
          .limit(limit)
      ]);

      const totalPages = Math.ceil(total / limit) || 1;

      // Calculate stats based on base date/counter query
      const baseMatch = baseConditions.length === 0
        ? {}
        : baseConditions.length === 1
          ? baseConditions[0]
          : { $and: baseConditions };

      const statsAggregation = await Order.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            pending: {
              $sum: { $cond: [{ $in: ['$status', ['Pending', 'Processing']] }, 1, 0] }
            },
            confirmed: {
              $sum: { $cond: [{ $in: ['$status', ['Confirmed', 'Completed']] }, 1, 0] }
            },
            cancelled: {
              $sum: { $cond: [{ $in: ['$status', ['Cancelled', 'Rejected']] }, 1, 0] }
            },
            revenue: {
              $sum: { $cond: [{ $in: ['$status', ['Confirmed', 'Completed']] }, '$totalAmount', 0] }
            },
            cashCount: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $eq: [{ $toLower: '$payment.method' }, 'cash'] },
                      { $eq: [{ $toLower: '$paymentMethod' }, 'cash'] }
                    ]
                  },
                  1,
                  0
                ]
              }
            },
            onlineCount: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $in: [{ $toLower: '$payment.method' }, ['online', 'upi', 'card']] },
                      { $in: [{ $toLower: '$paymentMethod' }, ['online', 'upi', 'card']] }
                    ]
                  },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]);

      const stats = statsAggregation[0] || {
        total: 0,
        pending: 0,
        confirmed: 0,
        cancelled: 0,
        revenue: 0,
        cashCount: 0,
        onlineCount: 0
      };

      return res.json({
        orders,
        total,
        page,
        limit,
        totalPages,
        stats
      });
    }

    // Default unpaginated query (for backwards compatibility)
    const orders = await Order.find(finalQuery)
      .populate('items.productId')
      .populate('confirmedBy', 'name email')
      .populate('staffId', 'name email')
      .populate({
        path: 'counter',
        select: 'name description userId',
        populate: { path: 'userId', select: 'name email isOnline lastLogin lastSeen' }
      })
      .sort({ createdAt: req.query.sort === 'asc' ? 1 : -1 });

    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    let query = {};
    if (mongoose.Types.ObjectId.isValid(id)) {
      query = { _id: id };
    } else {
      query = {
        $or: [
          { invoiceNumber: id },
          { billNumber: id }
        ]
      };
    }

    if (req.user && req.user.role === 'counter') {
      const counterDoc = await Counter.findOne({ userId: req.user._id });
      const counterConditions = [
        { counterId: req.user._id.toString() },
        { counterName: req.user.name }
      ];
      if (counterDoc) {
        counterConditions.push({ counter: counterDoc._id });
        counterConditions.push({ counterId: counterDoc._id.toString() });
        counterConditions.push({ counterName: counterDoc.name });
      }
      if (mongoose.Types.ObjectId.isValid(req.user._id)) {
        counterConditions.push({ counter: req.user._id });
      }
      query = {
        $and: [
          query,
          { $or: counterConditions }
        ]
      };
    }

    const order = await Order.findOne(query)
      .populate('items.productId')
      .populate('confirmedBy', 'name email')
      .populate('staffId', 'name email')
      .populate({
        path: 'counter',
        select: 'name description userId',
        populate: { path: 'userId', select: 'name email isOnline lastLogin lastSeen' }
      });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

export const confirmOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.status !== 'Pending') {
      return res.status(400).json({ message: 'Order already processed' });
    }

    // Check reservedStock before deducting
    for (const item of order.items) {
      const product = await Product.findById(item.productId);
      if (!product) continue;
      
      if (product.reservedStock < item.quantity) {
        const actualDeduct = Math.max(0, product.reservedStock);
        await Product.findByIdAndUpdate(item.productId, {
          $inc: {
            stock: -actualDeduct,
            reservedStock: -actualDeduct
          }
        });
      } else {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: {
            stock: -item.quantity,
            reservedStock: -item.quantity
          }
        });
      }
    }

    order.status = 'Confirmed';
    order.confirmedBy = req.user._id;
    order.confirmedAt = new Date();
    
    // Add to timeline
    order.timeline.push({
      status: 'Confirmed',
      message: 'Order confirmed',
      by: req.user._id,
      at: new Date()
    });

    await order.save();

    const populatedOrder = await Order.findById(order._id)
      .populate('items.productId')
      .populate('confirmedBy', 'name')
      .populate('staffId', 'name')
      .populate('counter', 'name');

    const io = req.app.get('io');
    io.emit('orderConfirmed', populatedOrder);
    io.emit('stockUpdated');

    const orderShortId = '#' + order._id.toString().slice(-6).toUpperCase();
    await recordAuditLog({
      userId: req.user?._id,
      userName: req.user?.name || 'Staff User',
      role: req.user?.role || 'staff',
      action: 'ORDER_CONFIRMED',
      module: 'Orders',
      targetType: 'Order',
      targetId: order._id,
      targetName: orderShortId,
      orderId: order._id.toString(),
      counterId: order.counter ? String(order.counter) : null,
      counterName: order.counterName || null,
      amount: order.totalAmount,
      paymentMethod: order.payment?.method || 'Cash',
      previousValue: 'Pending',
      newValue: 'Confirmed',
      change: 'PENDING → CONFIRMED',
      description: `${req.user?.name || 'Staff User'} confirmed Order ${orderShortId} for ₹${order.totalAmount} at ${order.counterName || 'Counter'}`,
      status: 'Success'
    }, req);

    res.json(populatedOrder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};


export const cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.status !== 'Pending') {
      return res.status(400).json({ message: 'Only pending orders can be cancelled' });
    }

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

    order.status = 'Cancelled';
    order.confirmedBy = req.user._id;
    order.confirmedAt = new Date();
    
    order.timeline.push({
      status: 'Cancelled',
      message: 'Order cancelled',
      by: req.user._id,
      at: new Date()
    });
    
    await order.save();

    const populatedOrder = await Order.findById(order._id)
      .populate('items.productId')
      .populate('confirmedBy', 'name')
      .populate('staffId', 'name')
      .populate('counter', 'name');

    const io = req.app.get('io');
    io.emit('orderCancelled', populatedOrder || order);
    io.emit('stockUpdated');

    const orderShortId = '#' + order._id.toString().slice(-6).toUpperCase();
    await recordAuditLog({
      userId: req.user?._id,
      userName: req.user?.name || 'User',
      role: req.user?.role || 'staff',
      action: 'ORDER_CANCELLED',
      module: 'Orders',
      targetType: 'Order',
      targetId: order._id,
      targetName: orderShortId,
      orderId: order._id.toString(),
      counterId: order.counter ? String(order.counter) : null,
      counterName: order.counterName || null,
      amount: order.totalAmount,
      paymentMethod: order.payment?.method || 'Cash',
      previousValue: 'Pending',
      newValue: 'Cancelled',
      change: 'PENDING → CANCELLED',
      description: `${req.user?.name || 'User'} cancelled Order ${orderShortId} (₹${order.totalAmount})`,
      status: 'Success'
    }, req);

    res.json({ message: 'Order cancelled', order: populatedOrder || order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

export const revertOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.status === 'Pending') {
      return res.status(400).json({ message: 'Order is already pending' });
    }

    const originalStatus = order.status;

    if (originalStatus === 'Confirmed') {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: {
            stock: +item.quantity,
            reservedStock: +item.quantity
          }
        });
      }
    }

    if (originalStatus === 'Cancelled') {
      for (const item of order.items) {
        const product = await Product.findById(item.productId);
        if (!product) continue;
        const available = product.stock - product.reservedStock;
        if (available < item.quantity) {
          return res.status(400).json({
            message: `Cannot revert: insufficient stock for ${product.name}`
          });
        }
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { reservedStock: +item.quantity }
        });
      }
    }

    order.status = 'Pending';
    order.confirmedBy = null;
    order.confirmedAt = null;
    
    order.timeline.push({
      status: 'Pending',
      message: `Order reverted from ${originalStatus}`,
      by: req.user._id,
      at: new Date()
    });
    
    await order.save();

    const populatedOrder = await Order.findById(order._id)
      .populate('items.productId')
      .populate('confirmedBy', 'name')
      .populate('staffId', 'name')
      .populate('counter', 'name');

    const io = req.app.get('io');
    io.emit('orderReverted', populatedOrder || order);
    io.emit('stockUpdated');

    const orderShortId = '#' + order._id.toString().slice(-6).toUpperCase();
    await recordAuditLog({
      userId: req.user?._id,
      userName: req.user?.name || 'User',
      role: req.user?.role || 'admin',
      action: 'ORDER_REVERTED',
      module: 'Orders',
      targetType: 'Order',
      targetId: order._id,
      targetName: orderShortId,
      orderId: order._id.toString(),
      previousValue: originalStatus,
      newValue: 'Pending',
      change: `${originalStatus.toUpperCase()} → PENDING`,
      description: `${req.user?.name || 'User'} reverted Order ${orderShortId} from ${originalStatus} to Pending`,
      status: 'Success'
    }, req);

    res.json({ message: 'Order reverted to Pending', order: populatedOrder || order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

export const deleteOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.status !== 'Cancelled' && order.status !== 'Pending') {
      return res.status(400).json({
        message: 'Only cancelled or pending orders can be deleted'
      });
    }

    if (order.status === 'Pending') {
      for (const item of order.items) {
        const product = await Product.findById(item.productId);
        if (!product) continue;
        
        const actualRestore = Math.min(product.reservedStock, item.quantity);
        if (actualRestore > 0) {
          await Product.findByIdAndUpdate(item.productId, {
            $inc: { reservedStock: -actualRestore }
          });
        }
      }
    }

    await order.deleteOne();

    const io = req.app.get('io');
    io.emit('stockUpdated');
    io.emit('orderDeleted', order._id);

    const orderShortId = '#' + order._id.toString().slice(-6).toUpperCase();
    await recordAuditLog({
      userId: req.user?._id,
      userName: req.user?.name || 'Admin',
      role: req.user?.role || 'admin',
      action: 'ORDER_DELETED',
      module: 'Orders',
      targetType: 'Order',
      targetId: order._id,
      targetName: orderShortId,
      orderId: order._id.toString(),
      amount: order.totalAmount,
      description: `${req.user?.name || 'Admin'} deleted Order ${orderShortId} (Status: ${order.status}, Amount: ₹${order.totalAmount})`,
      status: 'Success'
    }, req);

    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

export const bulkDeletePendingOrders = async (req, res) => {
  try {
    const { date } = req.body;

    if (!date) {
      return res.status(400).json({ message: 'Date is required' });
    }

    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const orders = await Order.find({
      status: 'Pending',
      createdAt: { $gte: startDate, $lte: endDate }
    });

    for (const order of orders) {
      for (const item of order.items) {
        const product = await Product.findById(item.productId);
        if (!product) continue;
        
        const actualRestore = Math.min(product.reservedStock, item.quantity);
        if (actualRestore > 0) {
          await Product.findByIdAndUpdate(item.productId, {
            $inc: { reservedStock: -actualRestore }
          });
        }
      }
    }

    const result = await Order.deleteMany({
      status: 'Pending',
      createdAt: { $gte: startDate, $lte: endDate }
    });

    const io = req.app.get('io');
    io.emit('stockUpdated');
    io.emit('ordersBulkDeleted');

    await recordAuditLog({
      userId: req.user?._id,
      userName: req.user?.name || 'Admin',
      role: req.user?.role || 'admin',
      action: 'ORDER_BULK_DELETED',
      module: 'Orders',
      targetType: 'Order',
      targetName: `${result.deletedCount} Pending Orders`,
      description: `${req.user?.name || 'Admin'} deleted ${result.deletedCount} pending orders for date ${date}`,
      status: 'Success',
      metadata: { deletedCount: result.deletedCount, date }
    }, req);

    res.json({
      message: `${result.deletedCount} pending orders deleted`,
      count: result.deletedCount
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

export const deleteSingleOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.status !== 'Cancelled' && order.status !== 'Pending') {
      return res.status(400).json({
        message: 'Only cancelled or pending orders can be deleted'
      });
    }

    if (order.status === 'Pending') {
      for (const item of order.items) {
        const product = await Product.findById(item.productId);
        if (!product) continue;
        
        const actualRestore = Math.min(product.reservedStock, item.quantity);
        if (actualRestore > 0) {
          await Product.findByIdAndUpdate(item.productId, {
            $inc: { reservedStock: -actualRestore }
          });
        }
      }
    }

    await order.deleteOne();

    const io = req.app.get('io');
    io.emit('stockUpdated');
    io.emit('orderDeleted', orderId);

    const orderShortId = '#' + order._id.toString().slice(-6).toUpperCase();
    await recordAuditLog({
      userId: req.user?._id,
      userName: req.user?.name || 'Admin',
      role: req.user?.role || 'admin',
      action: 'ORDER_DELETED',
      module: 'Orders',
      targetType: 'Order',
      targetId: order._id,
      targetName: orderShortId,
      orderId: order._id.toString(),
      amount: order.totalAmount,
      description: `${req.user?.name || 'Admin'} deleted Order ${orderShortId} (Status: ${order.status}, Amount: ₹${order.totalAmount})`,
      status: 'Success'
    }, req);

    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

export const bulkDeleteCancelledOrders = async (req, res) => {
  try {
    const { date } = req.body;
    if (!date) {
      return res.status(400).json({ message: 'Date is required' });
    }
    
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);
    
    const result = await Order.deleteMany({ 
      status: 'Cancelled',
      createdAt: { $gte: startDate, $lte: endDate }
    });
    
    res.json({ 
      message: `${result.deletedCount} cancelled orders deleted`, 
      count: result.deletedCount 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

export const deleteAllOrdersByDate = async (req, res) => {
  try {
    const { date } = req.body;
    if (!date) {
      return res.status(400).json({ message: 'Date is required' });
    }
    
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);
    
    // First, get all pending orders to release stock
    const pendingOrders = await Order.find({
      status: 'Pending',
      createdAt: { $gte: startDate, $lte: endDate }
    });
    
    for (const order of pendingOrders) {
      for (const item of order.items) {
        const product = await Product.findById(item.productId);
        if (!product) continue;
        const actualRestore = Math.min(product.reservedStock, item.quantity);
        if (actualRestore > 0) {
          await Product.findByIdAndUpdate(item.productId, {
            $inc: { reservedStock: -actualRestore }
          });
        }
      }
    }
    
    const result = await Order.deleteMany({ 
      createdAt: { $gte: startDate, $lte: endDate }
    });
    
    const io = req.app.get('io');
    io.emit('stockUpdated');
    
    res.json({ 
      message: `${result.deletedCount} orders deleted`, 
      count: result.deletedCount 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

export const resetReservedStock = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (product.reservedStock < 0) {
      product.reservedStock = 0;
      await product.save();
      
      const io = req.app.get('io');
      io.emit('stockUpdated');
      
      res.json({ 
        message: 'Reserved stock reset to 0 successfully', 
        product 
      });
    } else {
      res.json({ 
        message: 'Reserved stock is already positive', 
        product 
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ NEW: Update payment status
export const updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentStatus, receivedAmount, transactionId } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.status === 'Cancelled') {
      return res.status(400).json({ message: 'Cannot update payment for cancelled order' });
    }

    order.payment.status = paymentStatus;
    if (receivedAmount !== undefined) {
      order.payment.receivedAmount = receivedAmount;
      order.payment.changeReturned = receivedAmount - order.totalAmount;
    }
    if (transactionId) {
      order.payment.transactionId = transactionId;
    }
    if (paymentStatus === 'Paid') {
      order.payment.paidAt = new Date();
    }

    order.timeline.push({
      status: order.status,
      message: `Payment status updated to ${paymentStatus}`,
      by: req.user._id,
      at: new Date()
    });

    await order.save();

    const populatedOrder = await Order.findById(order._id)
      .populate('items.productId')
      .populate('confirmedBy', 'name')
      .populate('staffId', 'name')
      .populate('counter', 'name');

    const io = req.app.get('io');
    io.emit('orderUpdated', populatedOrder);

    const orderShortId = '#' + order._id.toString().slice(-6).toUpperCase();
    await recordAuditLog({
      userId: req.user?._id,
      userName: req.user?.name || 'Staff User',
      role: req.user?.role || 'staff',
      action: 'PAYMENT_STATUS_UPDATED',
      module: 'Payments',
      targetType: 'Payment',
      targetId: order._id,
      targetName: orderShortId,
      orderId: order._id.toString(),
      amount: order.totalAmount,
      paymentMethod: order.payment?.method || 'Cash',
      previousValue: order.payment?.status,
      newValue: paymentStatus,
      change: `${order.payment?.status} → ${paymentStatus}`,
      description: `${req.user?.name || 'Staff User'} updated payment status for Order ${orderShortId} to ${paymentStatus} (₹${order.totalAmount})`,
      status: 'Success'
    }, req);

    res.json(populatedOrder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ NEW: Update print status
export const updatePrintStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { printStatus } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.print.status = printStatus;
    if (printStatus === 'Printed') {
      order.print.printedAt = new Date();
    }

    await order.save();

    const orderShortId = '#' + order._id.toString().slice(-6).toUpperCase();
    await recordAuditLog({
      userId: req.user?._id,
      userName: req.user?.name || 'Staff User',
      role: req.user?.role || 'staff',
      action: 'RECEIPT_PRINTED',
      module: 'Orders',
      targetType: 'Order',
      targetId: order._id,
      targetName: orderShortId,
      orderId: order._id.toString(),
      description: `${req.user?.name || 'Staff User'} printed receipt for Order ${orderShortId}`,
      status: 'Success'
    }, req);

    res.json({ message: 'Print status updated', order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};