import Category from '../models/Category.js';
import Product from '../models/Product.js';
import { recordAuditLog } from '../utils/auditLogger.js';

const emitCategoriesUpdated = (req) => {
  const io = req.app.get('io');
  if (io) io.emit('categoriesUpdated');
};

export const getCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createCategory = async (req, res) => {
  try {
    const { name } = req.body;
    const existing = await Category.findOne({ name });
    if (existing) return res.status(400).json({ message: 'Category already exists' });
    const category = await Category.create({ name });
    emitCategoriesUpdated(req);

    await recordAuditLog(
      {
        userId: req.user?._id,
        userName: req.user?.name || 'Admin',
        role: req.user?.role || 'admin',
        action: 'CATEGORY_CREATED',
        module: 'Categories',
        targetType: 'Category',
        targetId: category._id,
        targetName: category.name,
        description: `${req.user?.name || 'Admin'} created category "${category.name}"`,
        status: 'Success',
      },
      req
    );

    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: 'Category not found' });
    const oldName = category.name;
    category.name = req.body.name;
    await category.save();
    emitCategoriesUpdated(req);

    await recordAuditLog(
      {
        userId: req.user?._id,
        userName: req.user?.name || 'Admin',
        role: req.user?.role || 'admin',
        action: 'CATEGORY_UPDATED',
        module: 'Categories',
        targetType: 'Category',
        targetId: category._id,
        targetName: category.name,
        previousValue: oldName,
        newValue: category.name,
        change: `${oldName} → ${category.name}`,
        description: `${req.user?.name || 'Admin'} renamed category "${oldName}" to "${category.name}"`,
        status: 'Success',
      },
      req
    );

    res.json(category);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: 'Category not found' });

    // Check if any product uses this category
    const products = await Product.findOne({ categoryId: category._id });
    if (products) {
      return res.status(400).json({
        message: 'Cannot delete category with existing products. Move or delete products first.',
      });
    }

    const catName = category.name;
    await category.deleteOne();
    emitCategoriesUpdated(req);

    await recordAuditLog(
      {
        userId: req.user?._id,
        userName: req.user?.name || 'Admin',
        role: req.user?.role || 'admin',
        action: 'CATEGORY_DELETED',
        module: 'Categories',
        targetType: 'Category',
        targetId: category._id,
        targetName: catName,
        description: `${req.user?.name || 'Admin'} deleted category "${catName}"`,
        status: 'Success',
      },
      req
    );

    res.json({ message: 'Category deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
