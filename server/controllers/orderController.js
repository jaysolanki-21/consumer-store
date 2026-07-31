import Order from '../models/Order.js';
import Product from '../models/Product.js';

export const createOrder = async (req, res) => {
  try {
    const { items, counterId } = req.body;

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

    // ✅ FIX: Check reservedStock before deducting
    for (const item of order.items) {
      const product = await Product.findById(item.productId);
      if (!product) continue;
      
      // ✅ Prevent negative reservedStock
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
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ message: 'Date parameter is required (YYYY-MM-DD)' });
    }

    const todayISTStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    if (date > todayISTStr) {
      return res.status(400).json({ message: 'Cannot fetch sales for a future date' });
    }

    const startDate = new Date(`${date}T00:00:00.000+05:30`);
    const endDate = new Date(`${date}T23:59:59.999+05:30`);

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

// ✅ FIX 1: cancelOrder with validation
export const cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.status !== 'Pending') {
      return res.status(400).json({ message: 'Only pending orders can be cancelled' });
    }

    // ✅ FIX: Check before deducting
    for (const item of order.items) {
      const product = await Product.findById(item.productId);
      if (!product) continue;
      
      const actualDeduct = Math.min(product.reservedStock, item.quantity);
      if (actualDeduct > 0) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { reservedStock: -actualDeduct }
        });
      } else {
        console.warn(`⚠️ Cannot deduct reserved stock for ${product.name}. Current reserved: ${product.reservedStock}`);
      }
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

// ✅ FIX 2: deleteOrder - RESTORE should ADD, not SUBTRACT
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

    // ✅ FIX: RESTORE reserved stock (ADD, not SUBTRACT)
    if (order.status === 'Pending') {
      for (const item of order.items) {
        const product = await Product.findById(item.productId);
        if (!product) continue;
        
        // ✅ Restore reserved stock by subtracting (since reservedStock tracks active reservations)
        // If order is deleted, we need to release the reservation
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

    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ FIX 3: bulkDeletePendingOrders
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

    // ✅ FIX: Restore reserved stock safely
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

    res.json({
      message: `${result.deletedCount} pending orders deleted`,
      count: result.deletedCount
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ FIX 4: deleteSingleOrder
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

    // ✅ FIX: Restore reserved stock safely
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

    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
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

// ✅ Admin function to reset negative reserved stock
export const resetReservedStock = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // ✅ Only reset if negative
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