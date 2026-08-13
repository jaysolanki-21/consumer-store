import Product from '../models/Product.js';
import imagekit from '../config/imagekit.js';
import Order from '../models/Order.js';

// Helper function to parse boolean values
const parseBoolean = (value, fallback = true) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return value === 'true';
};

// Get all products with availability
export const getProducts = async (req, res) => {
  try {
    const products = await Product.find().populate('categoryId');
    const productsWithAvailability = products.map(p => ({
      ...p.toObject(),
      availableStock: p.stock - p.reservedStock,
      profitMargin: p.sellingPrice > 0 ? 
        ((p.sellingPrice - p.costPrice) / p.sellingPrice * 100).toFixed(2) : 0
    }));
    res.json(productsWithAvailability);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get single product by ID
export const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('categoryId');
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    const productWithAvailability = {
      ...product.toObject(),
      availableStock: product.stock - product.reservedStock,
      profitMargin: product.sellingPrice > 0 ? 
        ((product.sellingPrice - product.costPrice) / product.sellingPrice * 100).toFixed(2) : 0
    };
    
    res.json(productWithAvailability);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Create new product
export const createProduct = async (req, res) => {
  try {
    const { 
      name, 
      costPrice = 0, 
      sellingPrice, 
      price, 
      stock, 
      categoryId, 
      lowStockThreshold, 
      visibility 
    } = req.body;
    
    let imageUrl = '';
    const finalSellingPrice = Number(sellingPrice ?? price);
    const finalStock = Number(stock);
    const finalCostPrice = Number(costPrice);
    
    // Validation
    if (!name || Number.isNaN(finalCostPrice) || finalCostPrice < 0 || 
        Number.isNaN(finalSellingPrice) || finalSellingPrice < 0 || 
        Number.isNaN(finalStock) || finalStock < 0 || !categoryId) {
      return res.status(400).json({ 
        message: 'Product name, selling price, stock and category are required' 
      });
    }
    
    if (finalSellingPrice < finalCostPrice) {
      return res.status(400).json({ 
        message: 'Selling price cannot be lower than cost price' 
      });
    }

    // Handle image upload
    if (req.file) {
      const base64 = req.file.buffer.toString('base64');
      const result = await imagekit.upload({
        file: base64,
        fileName: `${Date.now()}-${req.file.originalname}`,
        folder: '/products'
      });
      imageUrl = result.url;
    }

    const product = await Product.create({
      name,
      costPrice: finalCostPrice,
      sellingPrice: finalSellingPrice,
      price: finalSellingPrice, // For backward compatibility
      stock: finalStock,
      reservedStock: 0,
      categoryId,
      lowStockThreshold: lowStockThreshold || 5,
      visibility: parseBoolean(visibility, true),
      image: imageUrl
    });

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('productCreated', product);
      io.emit('stockUpdated', product);
    }

    res.status(201).json(product);
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Update product
export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const { 
      name, 
      costPrice = 0, 
      sellingPrice, 
      price, 
      stock, 
      categoryId, 
      lowStockThreshold, 
      visibility 
    } = req.body;
    
    const finalSellingPrice = Number(sellingPrice ?? price);
    const finalStock = Number(stock);
    const finalCostPrice = Number(costPrice);
    
    // Validation
    if (!name || Number.isNaN(finalCostPrice) || finalCostPrice < 0 || 
        Number.isNaN(finalSellingPrice) || finalSellingPrice < 0 || 
        Number.isNaN(finalStock) || finalStock < 0 || !categoryId) {
      return res.status(400).json({ 
        message: 'Product name, selling price, stock and category are required' 
      });
    }
    
    if (finalSellingPrice < finalCostPrice) {
      return res.status(400).json({ 
        message: 'Selling price cannot be lower than cost price' 
      });
    }

    // Check if stock can be reduced below reserved stock
    if (finalStock < (product.reservedStock || 0)) {
      return res.status(400).json({ 
        message: `Stock cannot be lower than currently reserved stock (${product.reservedStock})` 
      });
    }

    // Handle image upload if a new file is provided
    let imageUrl = product.image;
    if (req.file) {
      // Optional: Delete old image from ImageKit
      // if (product.image) {
      //   const fileId = product.image.split('/').pop().split('.')[0];
      //   await imagekit.deleteFile(fileId);
      // }
      
      const base64 = req.file.buffer.toString('base64');
      const result = await imagekit.upload({
        file: base64,
        fileName: `${Date.now()}-${req.file.originalname}`,
        folder: '/products'
      });
      imageUrl = result.url;
    }

    // Update product fields
    product.name = name;
    product.costPrice = finalCostPrice;
    product.sellingPrice = finalSellingPrice;
    product.price = finalSellingPrice;
    product.stock = finalStock;
    product.categoryId = categoryId;
    product.lowStockThreshold = lowStockThreshold || product.lowStockThreshold || 5;
    product.visibility = parseBoolean(visibility, product.visibility);
    product.image = imageUrl;

    await product.save();

    // Emit socket events
    const io = req.app.get('io');
    if (io) {
      io.emit('productUpdated', product);
      io.emit('stockUpdated', product);
    }

    res.json(product);
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Delete product
export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if product has any reserved stock
    if (product.reservedStock > 0) {
      return res.status(400).json({ 
        message: `Cannot delete product with reserved stock (${product.reservedStock}). Release reserved stock first.` 
      });
    }

    // Check if product is used in any pending orders
    const pendingOrders = await Order.findOne({
      'items.productId': product._id,
      status: { $in: ['Pending', 'Processing', 'Shipped'] }
    });

    if (pendingOrders) {
      return res.status(400).json({ 
        message: 'Cannot delete product with pending orders' 
      });
    }

    // Optional: Delete image from ImageKit
    // if (product.image) {
    //   const fileId = product.image.split('/').pop().split('.')[0];
    //   await imagekit.deleteFile(fileId);
    // }

    await Product.findByIdAndDelete(req.params.id);

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('productDeleted', { _id: product._id });
    }

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Refill stock (add or remove stock)
export const refillStock = async (req, res) => {
  try {
    const { quantity } = req.body;
    const delta = parseInt(quantity);
    
    if (isNaN(delta) || delta === 0) {
      return res.status(400).json({ message: 'Quantity must be a non-zero number' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if reducing stock would go below reserved stock
    if (delta < 0 && (product.stock + delta) < product.reservedStock) {
      return res.status(400).json({ 
        message: `Cannot reduce stock below reserved stock (${product.reservedStock})` 
      });
    }

    const newStock = product.stock + delta;
    if (newStock < 0) {
      return res.status(400).json({ message: 'Stock cannot become negative' });
    }

    product.stock = newStock;
    await product.save();

    // Emit socket events
    const io = req.app.get('io');
    if (io) {
      io.emit('stockRefilled', { product, delta });
      io.emit('stockUpdated', product);
    }

    res.json({ 
      message: `Stock ${delta > 0 ? 'increased' : 'decreased'} by ${Math.abs(delta)}`, 
      product,
      availableStock: product.stock - product.reservedStock
    });
  } catch (error) {
    console.error('Refill stock error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get product sales analytics
export const getProductSalesAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate and endDate required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(23, 59, 59, 999);

    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }

    // Aggregate sales from confirmed and delivered orders
    const sales = await Order.aggregate([
      {
        $match: {
          status: { $in: ['Confirmed', 'Delivered'] },
          createdAt: { $gte: start, $lte: end }
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.total' },
          totalCost: { $sum: '$items.totalCost' },
          totalProfit: { $sum: { $subtract: ['$items.total', '$items.totalCost'] } }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          productId: '$_id',
          name: { $ifNull: ['$product.name', 'Deleted Product'] },
          image: { $ifNull: ['$product.image', ''] },
          sellingPrice: { $ifNull: ['$product.sellingPrice', 0] },
          costPrice: { $ifNull: ['$product.costPrice', 0] },
          totalQuantity: 1,
          totalRevenue: 1,
          totalCost: 1,
          totalProfit: 1,
          profitMargin: {
            $cond: [
              { $eq: ['$totalRevenue', 0] },
              0,
              { $round: [{ $multiply: [{ $divide: ['$totalProfit', '$totalRevenue'] }, 100] }, 2] }
            ]
          }
        }
      },
      { $sort: { totalQuantity: -1 } }
    ]);

    // Calculate summary
    const summary = sales.reduce((acc, item) => {
      acc.totalRevenue += item.totalRevenue;
      acc.totalCost += item.totalCost;
      acc.totalProfit += item.totalProfit;
      acc.totalQuantity += item.totalQuantity;
      return acc;
    }, { totalRevenue: 0, totalCost: 0, totalProfit: 0, totalQuantity: 0 });

    res.json({
      sales,
      summary: {
        ...summary,
        profitMargin: summary.totalRevenue > 0 ? 
          ((summary.totalProfit / summary.totalRevenue) * 100).toFixed(2) : 0
      }
    });
  } catch (error) {
    console.error('Sales analytics error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Reset reserved stock for a product
export const resetReservedStockByProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if there are any pending orders for this product
    const pendingOrders = await Order.findOne({
      'items.productId': productId,
      status: { $in: ['Pending', 'Processing', 'Shipped'] }
    });

    if (pendingOrders) {
      return res.status(400).json({ 
        message: 'Cannot reset reserved stock. Product has pending orders.' 
      });
    }

    // Reset reserved stock
    product.reservedStock = 0;
    await product.save();

    // Emit socket events
    const io = req.app.get('io');
    if (io) {
      io.emit('stockUpdated', product);
      io.emit('productUpdated', product);
      io.emit('reservedStockReset', { productId, product });
    }

    res.json({
      message: `${product.name} reserved stock reset successfully`,
      product
    });
  } catch (error) {
    console.error('Reset reserved stock error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get low stock products
export const getLowStockProducts = async (req, res) => {
  try {
    const { threshold } = req.query;
    const lowStockThreshold = parseInt(threshold) || 5;

    const products = await Product.find({
      $expr: {
        $lt: [{ $subtract: ['$stock', '$reservedStock'] }, lowStockThreshold]
      }
    }).populate('categoryId');

    const productsWithAvailability = products.map(p => ({
      ...p.toObject(),
      availableStock: p.stock - p.reservedStock
    }));

    res.json(productsWithAvailability);
  } catch (error) {
    console.error('Get low stock products error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Bulk update product visibility
export const bulkUpdateVisibility = async (req, res) => {
  try {
    const { productIds, visibility } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ message: 'Product IDs array is required' });
    }

    const result = await Product.updateMany(
      { _id: { $in: productIds } },
      { visibility: parseBoolean(visibility, true) }
    );

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('productsBulkUpdated', { productIds, visibility });
    }

    res.json({
      message: `${result.modifiedCount} products updated successfully`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Bulk update visibility error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get product profit report
export const getProductProfitReport = async (req, res) => {
  try {
    const products = await Product.find().populate('categoryId');
    
    const profitReport = products.map(p => ({
      _id: p._id,
      name: p.name,
      category: p.categoryId?.name || 'Uncategorized',
      costPrice: p.costPrice,
      sellingPrice: p.sellingPrice,
      stock: p.stock,
      reservedStock: p.reservedStock,
      availableStock: p.stock - p.reservedStock,
      profitPerUnit: p.sellingPrice - p.costPrice,
      profitMargin: p.sellingPrice > 0 ? 
        ((p.sellingPrice - p.costPrice) / p.sellingPrice * 100).toFixed(2) : 0,
      totalStockValue: p.stock * p.costPrice,
      totalPotentialRevenue: p.stock * p.sellingPrice,
      totalPotentialProfit: p.stock * (p.sellingPrice - p.costPrice)
    }));

    // Calculate summary
    const summary = profitReport.reduce((acc, p) => {
      acc.totalStockValue += p.totalStockValue;
      acc.totalPotentialRevenue += p.totalPotentialRevenue;
      acc.totalPotentialProfit += p.totalPotentialProfit;
      return acc;
    }, { totalStockValue: 0, totalPotentialRevenue: 0, totalPotentialProfit: 0 });

    res.json({
      products: profitReport,
      summary: {
        ...summary,
        averageProfitMargin: summary.totalPotentialRevenue > 0 ? 
          ((summary.totalPotentialProfit / summary.totalPotentialRevenue) * 100).toFixed(2) : 0
      }
    });
  } catch (error) {
    console.error('Product profit report error:', error);
    res.status(500).json({ message: error.message });
  }
};