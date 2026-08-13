import Order from '../models/Order.js';
import Product from '../models/Product.js';

export const createOrder = async (req, res) => {
  try {
    const { 
      items, 
      counterId, 
      staffId, 
      staffName,
      payment = {} 
    } = req.body;

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
      counterId: counterId,
      counterName: counterNames[counterId] || counterId,
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
      .populate('staffId', 'name');

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
  try {
    const orders = await Order.find()
      .populate('items.productId')
      .populate('confirmedBy', 'name')
      .populate('staffId', 'name')
      .sort({ createdAt: -1 });
    res.json(orders);
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
      .populate('staffId', 'name');

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
    let totalCost = 0;
    const productSales = {};

    orders.forEach(order => {
      totalIncome += order.totalAmount || 0;
      order.items.forEach(item => {
        const productName = item.productId?.name || item.name || 'Deleted Product';
        const productId = item.productId?._id || item.productId || 'unknown';
        const costPrice = item.costPrice || item.productId?.costPrice || 0;
        
        if (!productSales[productId]) {
          productSales[productId] = {
            productId,
            name: productName,
            quantity: 0,
            revenue: 0,
            cost: 0,
            profit: 0
          };
        }
        productSales[productId].quantity += item.quantity;
        productSales[productId].revenue += item.quantity * (item.sellingPrice || item.price || 0);
        productSales[productId].cost += item.quantity * costPrice;
        productSales[productId].profit = productSales[productId].revenue - productSales[productId].cost;
        totalCost += item.quantity * costPrice;
      });
    });

    res.json({
      date,
      totalOrders: orders.length,
      totalIncome,
      totalCost,
      grossProfit: totalIncome - totalCost,
      profitMargin: totalIncome ? ((totalIncome - totalCost) / totalIncome) * 100 : 0,
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
    order.confirmedAt = null;
    
    order.timeline.push({
      status: 'Pending',
      message: `Order reverted from ${originalStatus}`,
      by: req.user._id,
      at: new Date()
    });
    
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
      .populate('confirmedBy', 'name');

    const io = req.app.get('io');
    io.emit('orderUpdated', populatedOrder);

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

    res.json({ message: 'Print status updated', order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};