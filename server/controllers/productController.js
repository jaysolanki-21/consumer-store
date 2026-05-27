import Product from '../models/Product.js';
import imagekit from '../config/imagekit.js';
import Order from '../models/Order.js';  
export const getProducts = async (req, res) => {
  const products = await Product.find().populate('categoryId');
  const productsWithAvailability = products.map(p => ({
    ...p.toObject(),
    availableStock: p.stock - p.reservedStock
  }));
  res.json(productsWithAvailability);
};

export const createProduct = async (req, res) => {
  const { name, price, stock, categoryId, lowStockThreshold, visibility } = req.body;
  let imageUrl = '';

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
    price,
    stock,
    categoryId,
    lowStockThreshold,
    visibility,
    image: imageUrl
  });

  res.status(201).json(product);
};

export const updateProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });

  const { name, price, stock, categoryId, lowStockThreshold, visibility } = req.body;

  // Handle image upload if a new file is provided
  let imageUrl = product.image;
  if (req.file) {
    const base64 = req.file.buffer.toString('base64');
    const result = await imagekit.upload({
      file: base64,
      fileName: `${Date.now()}-${req.file.originalname}`,
      folder: '/products'
    });
    imageUrl = result.url;
  }

  product.name = name;
  product.price = price;
  product.stock = stock;
  product.categoryId = categoryId;
  product.lowStockThreshold = lowStockThreshold;
  product.visibility = visibility;
  product.image = imageUrl;

  await product.save();

  const io = req.app.get('io');
  io.emit('stockUpdated', product);

  res.json(product);
};

export const deleteProduct = async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ message: 'Product deleted' });
};

// Add to existing productController.js

export const refillStock = async (req, res) => {
  try {
    const { quantity } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    const delta = parseInt(quantity);
    if (isNaN(delta) || delta === 0) {
      return res.status(400). json({ message: 'Quantity must be a non‑zero number' });
    }
    const newStock = product.stock + delta;
    if (newStock < 0) {
      return res.status(400).json({ message: 'Stock cannot become negative' });
    }
    product.stock = newStock;
    await product.save();

    const io = req.app.get('io');
    io.emit('stockUpdated', product);

    res.json({ message: `Stock ${delta > 0 ? 'increased' : 'decreased'} by ${Math.abs(delta)}`, product });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

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

    // Aggregate sales from confirmed orders
    const sales = await Order.aggregate([
      {
        $match: {
          status: 'Confirmed',
          createdAt: { $gte: start, $lte: end }
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
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
          price: { $ifNull: ['$product.price', 0] },
          totalQuantity: 1,
          totalRevenue: 1
        }
      },
      { $sort: { totalQuantity: -1 } }
    ]);

    res.json(sales);
  } catch (error) {
    console.error('Sales analytics error:', error);
    res.status(500).json({ message: error.message });
  }
};


export const resetReservedStockByProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    // CHECK PRODUCT
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        message: 'Product not found'
      });
    }

    // RESET RESERVED STOCK
    product.reservedStock = 0;

    await product.save();

    // SOCKET EVENTS
    const io = req.app.get('io');

    io.emit('stockUpdated');
    io.emit('productUpdated', product);

    res.json({
      message: `${product.name} reserved stock reset successfully`,
      product
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: error.message
    });
  }
};