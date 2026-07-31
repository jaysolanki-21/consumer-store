import Order from '../models/Order.js';
import Product from '../models/Product.js';

export const createOrder = async (req, res) => {
  try {
    const { items, counterId } = req.body;

    // Validate counterId
    if (!counterId) {
      return res.status(400).json({ message: 'Counter ID is required' });
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

    // 3. Calculate total & create order
    let totalAmount = 0;
    const orderItems = [];
    for (const item of items) {
      const product = await Product.findById(item.productId);
      const price = product.price;
      totalAmount += price * item.quantity;
      orderItems.push({
        productId: item.productId,
        quantity: item.quantity,
        price
      });
    }

    // Counter name mapping
    const counterNames = {
      'counter-1': 'Counter 1',
      'counter-2': 'Counter 2',
      'counter-3': 'Counter 3',
      'counter-4': 'Counter 4',
      'counter-5': 'Counter 5',
      'counter-6': 'Counter 6',
      'counter-7': 'Counter 7',
      'counter-8': 'Counter 8',
      'counter-9': 'Counter 9',
      'counter-10': 'Counter 10'
    };

    const order = await Order.create({
      items: orderItems,
      totalAmount,
      status: 'Pending',
      counterId: counterId,
      counterName: counterNames[counterId] || counterId
    });

    const populatedOrder = await Order.findById(order._id).populate('items.productId');
    const io = req.app.get('io');
    io.emit('newOrder', populatedOrder);
    io.emit('stockUpdated');

    res.status(201).json(populatedOrder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

export const getOrders = async (req, res) => {
  const orders = await Order.find()
    .populate('items.productId')
    .populate('confirmedBy', 'name')
    .sort({ createdAt: -1 });
  res.json(orders);
};

export const confirmOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.status !== 'Pending') {
      return res.status(400).json({ message: 'Order already processed' });
    }

    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: {
          stock: -item.quantity,
          reservedStock: -item.quantity
        }
      });
    }

    order.status = 'Confirmed';
    order.confirmedBy = req.user._id;
    await order.save();

    const populatedOrder = await Order.findById(order._id).populate('items.productId');
    const io = req.app.get('io');
    io.emit('orderConfirmed', populatedOrder);
    io.emit('stockUpdated');

    res.json(populatedOrder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

export const getSalesReport = async (req, res) => {
  try {
    const { date } = req.query; // Expected format: 'YYYY-MM-DD'
    if (!date) {
      return res.status(400).json({ message: 'Date parameter is required (YYYY-MM-DD)' });
    }

    // 1. Get current date string in Indian Standard Time (IST)
    const todayISTStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    // 2. Compare date strings directly to prevent timezone mismatch for future dates
    if (date > todayISTStr) {
      return res.status(400).json({ message: 'Cannot fetch sales for a future date' });
    }

    // 3. Create start and end intervals matching the Indian local day boundaries
    const startDate = new Date(`${date}T00:00:00.000+05:30`);
    const endDate = new Date(`${date}T23:59:59.999+05:30`);

    // 4. Fetch orders within the local day timeline
    const orders = await Order.find({
      status: 'Confirmed',
      createdAt: { $gte: startDate, $lte: endDate }
    }).populate('items.productId');

    let totalIncome = 0;
    const productSales = {};

    orders.forEach(order => {
      totalIncome += order.totalAmount || 0;
      order.items.forEach(item => {
        const productName = item.productId?.name || 'Deleted Product';
        const productId = item.productId?._id || 'unknown';
        if (!productSales[productId]) {
          productSales[productId] = {
            productId,
            name: productName,
            quantity: 0,
            revenue: 0
          };
        }
        productSales[productId].quantity += item.quantity;
        productSales[productId].revenue += item.quantity * (item.price || 0);
      });
    });

    res.json({
      date,
      totalOrders: orders.length,
      totalIncome,
      productWise: Object.values(productSales)
    });
  } catch (error) {
    console.error('Sales report error:', error);
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
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { reservedStock: -item.quantity }
      });
    }

    order.status = 'Cancelled';
    order.confirmedBy = req.user._id;
    await order.save();

    const io = req.app.get('io');
    io.emit('orderCancelled', order);
    io.emit('stockUpdated');

    res.json({ message: 'Order cancelled', order });
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
            reservedStock: +item.quantity    // re‑reserve
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
    await order.save();

    const io = req.app.get('io');
    io.emit('orderReverted', order);
    io.emit('stockUpdated');

    res.json({ message: 'Order reverted to Pending', order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// Delete single order (only cancelled or pending)
export const deleteOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (
      order.status !== 'Cancelled' &&
      order.status !== 'Pending'
    ) {
      return res.status(400).json({
        message: 'Only cancelled or pending orders can be deleted'
      });
    }

    // RESTORE RESERVED STOCK IF PENDING
    if (order.status === 'Pending') {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: {
            reservedStock: -item.quantity
          }
        });
      }
    }

    await order.deleteOne();

    const io = req.app.get('io');

    io.emit('stockUpdated');
    io.emit('orderDeleted', order._id);

    res.json({ message: 'Order deleted successfully' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// Delete all pending orders for specific date
export const bulkDeletePendingOrders = async (req, res) => {
  try {
    const { date } = req.body;

    if (!date) {
      return res.status(400).json({
        message: 'Date is required'
      });
    }

    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    // 1. GET ALL PENDING ORDERS
    const orders = await Order.find({
      status: 'Pending',
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    });

    // 2. RESTORE RESERVED STOCK
    for (const order of orders) {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(
          item.productId,
          {
            $inc: {
              reservedStock: -item.quantity
            }
          }
        );
      }
    }

    // 3. DELETE ORDERS
    const result = await Order.deleteMany({
      status: 'Pending',
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    });

    // 4. REALTIME UPDATE
    const io = req.app.get('io');

    io.emit('stockUpdated');
    io.emit('ordersBulkDeleted');

    res.json({
      message: `${result.deletedCount} pending orders deleted`,
      count: result.deletedCount
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: error.message
    });
  }
};

// Delete all cancelled orders for specific date
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
    
    res.json({ message: `${result.deletedCount} cancelled orders deleted`, count: result.deletedCount });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// Delete all orders for specific date (all statuses)
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
    
    const result = await Order.deleteMany({ 
      createdAt: { $gte: startDate, $lte: endDate }
    });
    
    res.json({ message: `${result.deletedCount} orders deleted`, count: result.deletedCount });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ DELETE SINGLE ORDER - By order ID (not date)
export const deleteSingleOrder = async (req, res) => {
  try {
    const orderId = req.params.id;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        message: 'Order not found'
      });
    }

    if (
      order.status !== 'Cancelled' &&
      order.status !== 'Pending'
    ) {
      return res.status(400).json({
        message: 'Only cancelled or pending orders can be deleted'
      });
    }

    // RESTORE RESERVED STOCK
    if (order.status === 'Pending') {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: {
            reservedStock: -item.quantity
          }
        });
      }
    }

    await order.deleteOne();

    const io = req.app.get('io');

    io.emit('stockUpdated');
    io.emit('orderDeleted', orderId);

    res.json({
      message: 'Order deleted successfully'
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: error.message
    });
  }
};