import mongoose from 'mongoose';
import JSZip from 'jszip';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import Counter from '../models/Counter.js';
import Setting from '../models/Setting.js';
import AuditLog from '../models/AuditLog.js';
import { recordAuditLog } from '../utils/auditLogger.js';

// Convert array of flat objects to RFC 4180 standard CSV
export const objectsToCsv = (data, fields) => {
  if (!data || !data.length) return '';
  const headers = fields || Object.keys(data[0]);
  const escapeCell = (val) => {
    if (val === null || val === undefined) return '';
    if (val instanceof Date) return val.toISOString();
    let text = typeof val === 'object' ? JSON.stringify(val) : String(val);
    if (text.includes('"') || text.includes(',') || text.includes('\n') || text.includes('\r')) {
      text = `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const headerRow = headers.map(escapeCell).join(',');
  const rows = data.map((row) =>
    headers.map((field) => escapeCell(row[field])).join(',')
  );
  return [headerRow, ...rows].join('\r\n');
};

// Robust CSV parser supporting quotes, multiline values, and commas
export const parseCsv = (csvText) => {
  const rows = [];
  let currentRow = [];
  let currentVal = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentVal += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        currentVal += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentVal.trim());
        currentVal = '';
      } else if (char === '\r') {
        if (nextChar === '\n') {
          i++;
        }
        currentRow.push(currentVal.trim());
        if (currentRow.some((c) => c !== '')) rows.push(currentRow);
        currentRow = [];
        currentVal = '';
      } else if (char === '\n') {
        currentRow.push(currentVal.trim());
        if (currentRow.some((c) => c !== '')) rows.push(currentRow);
        currentRow = [];
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
  }

  if (currentVal !== '' || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some((c) => c !== '')) rows.push(currentRow);
  }

  if (rows.length < 2) return [];

  const headers = rows[0];
  const data = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = row[idx] !== undefined ? row[idx] : '';
    });
    data.push(obj);
  }
  return data;
};

/**
 * Fetch cleaned module data for export
 */
export const getCleanModuleData = async (moduleKey, filters = {}) => {
  const { startDate, endDate, status, categoryId, counterId } = filters;
  const dateFilter = {};
  if (startDate) dateFilter.$gte = new Date(startDate);
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    dateFilter.$lte = end;
  }

  switch (moduleKey.toLowerCase()) {
    case 'products': {
      const query = {};
      if (categoryId) query.categoryId = categoryId;
      const products = await Product.find(query).populate('categoryId', 'name').lean();
      return products.map((p) => ({
        _id: String(p._id),
        name: p.name,
        category: p.categoryId?.name || '',
        categoryId: p.categoryId?._id ? String(p.categoryId._id) : String(p.categoryId || ''),
        sellingPrice: p.sellingPrice || p.price || 0,
        costPrice: p.costPrice || 0,
        stock: p.stock || 0,
        reservedStock: p.reservedStock || 0,
        availableStock: Math.max(0, (p.stock || 0) - (p.reservedStock || 0)),
        lowStockThreshold: p.lowStockThreshold || 5,
        visibility: p.visibility !== false,
        image: p.image || '',
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }));
    }

    case 'categories': {
      const categories = await Category.find({}).lean();
      return categories.map((c) => ({
        _id: String(c._id),
        name: c.name,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      }));
    }

    case 'orders': {
      const query = {};
      if (Object.keys(dateFilter).length) query.createdAt = dateFilter;
      if (status) query.status = status;
      if (counterId) query.$or = [{ counter: counterId }, { counterId: counterId }];

      const orders = await Order.find(query)
        .populate('confirmedBy', 'name email')
        .populate('staffId', 'name email')
        .lean();

      return orders.map((o) => ({
        _id: String(o._id),
        billNumber: o.billNumber || o.invoiceNumber || '',
        invoiceNumber: o.invoiceNumber || '',
        status: o.status,
        totalAmount: o.totalAmount,
        itemCount: o.items?.length || 0,
        paymentMethod: o.payment?.method || 'Cash',
        paymentStatus: o.payment?.status || 'Pending',
        counterName: o.counterName || '',
        counterId: o.counterId || (o.counter ? String(o.counter) : ''),
        staffName: o.staffName || o.staffId?.name || '',
        confirmedByName: o.confirmedBy?.name || '',
        confirmedAt: o.confirmedAt || '',
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
      }));
    }

    case 'order_items': {
      const query = {};
      if (Object.keys(dateFilter).length) query.createdAt = dateFilter;
      if (status) query.status = status;

      const orders = await Order.find(query)
        .populate('items.productId', 'name')
        .lean();

      const items = [];
      orders.forEach((o) => {
        (o.items || []).forEach((item, idx) => {
          items.push({
            orderId: String(o._id),
            billNumber: o.billNumber || '',
            itemIndex: idx + 1,
            productId: item.productId?._id ? String(item.productId._id) : String(item.productId || ''),
            productName: item.productId?.name || 'Unknown Product',
            quantity: item.quantity,
            price: item.price,
            sellingPrice: item.sellingPrice || item.price,
            costPrice: item.costPrice || 0,
            subtotal: item.quantity * item.price,
            orderDate: o.createdAt,
          });
        });
      });
      return items;
    }

    case 'staff': {
      const staffList = await User.find({ role: 'staff' })
        .select('-password -loginHistory')
        .lean();
      return staffList.map((s) => ({
        _id: String(s._id),
        name: s.name,
        email: s.email,
        role: s.role,
        isActive: s.isActive !== false,
        lastLogin: s.lastLogin || '',
        lastSeen: s.lastSeen || '',
        createdAt: s.createdAt,
      }));
    }

    case 'counters': {
      const counters = await Counter.find({})
        .populate('userId', 'name email isActive isOnline')
        .lean();
      return counters.map((c) => ({
        _id: String(c._id),
        name: c.name,
        description: c.description || '',
        isActive: c.isActive !== false,
        assignedUser: c.userId?.name || '',
        assignedEmail: c.userId?.email || '',
        createdAt: c.createdAt,
      }));
    }

    case 'admins': {
      const admins = await User.find({ role: 'admin' })
        .select('-password -loginHistory')
        .lean();
      return admins.map((a) => ({
        _id: String(a._id),
        name: a.name,
        email: a.email,
        role: a.role,
        isActive: a.isActive !== false,
        lastLogin: a.lastLogin || '',
        createdAt: a.createdAt,
      }));
    }

    case 'audit_logs': {
      const query = {};
      if (Object.keys(dateFilter).length) query.timestamp = dateFilter;
      const logs = await AuditLog.find(query)
        .sort({ timestamp: -1 })
        .limit(5000)
        .lean();

      return logs.map((l) => ({
        _id: String(l._id),
        timestamp: l.timestamp,
        userName: l.userName || '',
        role: l.role || '',
        module: l.module || '',
        action: l.action || '',
        targetType: l.targetType || '',
        targetName: l.targetName || '',
        description: l.description || '',
        status: l.status || '',
        ipAddress: l.ipAddress || '',
      }));
    }

    case 'settings': {
      const settings = await Setting.find({}).lean();
      return settings.map((s) => ({
        _id: String(s._id),
        key: s.key,
        maintenanceEnabled: s.maintenanceMode?.enabled ?? false,
        maintenanceTitle: s.maintenanceMode?.title || '',
        maintenanceMessage: s.maintenanceMode?.message || '',
        updatedByName: s.maintenanceMode?.updatedByName || '',
        updatedAt: s.maintenanceMode?.updatedAt || s.updatedAt,
      }));
    }

    default:
      throw new Error(`Module '${moduleKey}' is not supported for export.`);
  }
};

/**
 * 1. EXPORT MODULE HANDLER
 */
export const exportModule = async (req, res) => {
  try {
    const { module } = req.params;
    const { format = 'json', startDate, endDate, status, categoryId, counterId } = req.query;

    const data = await getCleanModuleData(module, {
      startDate,
      endDate,
      status,
      categoryId,
      counterId,
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `export_${module}_${timestamp}.${format.toLowerCase()}`;

    await recordAuditLog(
      {
        userId: req.user._id,
        userName: req.user.name,
        role: req.user.role,
        action: 'DATA_EXPORT',
        module: 'System',
        targetType: 'Module',
        targetName: module,
        description: `${req.user.name} exported ${data.length} records from module '${module}' in ${format.toUpperCase()} format`,
        status: 'Success',
      },
      req
    );

    if (format.toLowerCase() === 'csv') {
      const csvContent = objectsToCsv(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      return res.status(200).send(csvContent);
    }

    // Default JSON
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.status(200).send(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Export module error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 2. VALIDATE & PREVIEW IMPORT
 */
export const validateImportPreview = async (req, res) => {
  try {
    const { module } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: 'Please upload a file (.json or .csv)' });
    }

    const fileContent = file.buffer.toString('utf8');
    let records = [];

    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (ext === 'csv') {
      records = parseCsv(fileContent);
    } else {
      try {
        records = JSON.parse(fileContent);
        if (!Array.isArray(records)) {
          return res.status(400).json({ success: false, message: 'JSON file must contain an array of objects.' });
        }
      } catch (e) {
        return res.status(400).json({ success: false, message: 'Invalid JSON format: ' + e.message });
      }
    }

    if (!records.length) {
      return res.status(400).json({ success: false, message: 'Uploaded file has no data rows.' });
    }

    const preview = [];
    const errors = [];
    let validCount = 0;
    let duplicateCount = 0;

    // Cache existing identifiers to detect duplicates/conflicts
    const existingCategories = await Category.find({}).lean();
    const categoryMap = new Map();
    existingCategories.forEach((c) => {
      categoryMap.set(String(c._id), c);
      categoryMap.set(c.name.toLowerCase().trim(), c);
    });

    const existingProducts = await Product.find({}).lean();
    const productNames = new Set(existingProducts.map((p) => p.name.toLowerCase().trim()));
    const productIds = new Set(existingProducts.map((p) => String(p._id)));

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNum = i + 1;
      const rowErrors = [];

      switch (module.toLowerCase()) {
        case 'categories': {
          if (!row.name || !String(row.name).trim()) {
            rowErrors.push('Category name is required');
          } else {
            const catName = String(row.name).trim().toLowerCase();
            if (categoryMap.has(catName)) {
              duplicateCount++;
            }
          }
          break;
        }

        case 'products': {
          if (!row.name || !String(row.name).trim()) {
            rowErrors.push('Product name is required');
          }
          const price = parseFloat(row.sellingPrice || row.price);
          if (isNaN(price) || price < 0) {
            rowErrors.push('Valid selling price >= 0 is required');
          }
          const cost = parseFloat(row.costPrice || 0);
          if (price < cost) {
            rowErrors.push(`Selling price (${price}) cannot be less than cost price (${cost})`);
          }
          const stock = parseInt(row.stock, 10);
          if (isNaN(stock) || stock < 0) {
            rowErrors.push('Valid stock quantity >= 0 is required');
          }

          // Category resolution check
          const catRef = row.category || row.categoryId;
          if (!catRef) {
            rowErrors.push('Category or categoryId is required');
          } else if (
            !categoryMap.has(String(catRef)) &&
            !categoryMap.has(String(catRef).toLowerCase().trim())
          ) {
            rowErrors.push(`Category '${catRef}' does not exist in system`);
          }

          // Duplicate product check
          const pName = String(row.name || '').trim().toLowerCase();
          const pId = String(row._id || '');
          if (productNames.has(pName) || (pId && productIds.has(pId))) {
            duplicateCount++;
          }
          break;
        }

        default:
          rowErrors.push(`Direct import for module '${module}' is currently restricted for safety.`);
      }

      if (rowErrors.length) {
        errors.push({ row: rowNum, identifier: row.name || row._id || `Row #${rowNum}`, errors: rowErrors });
      } else {
        validCount++;
      }

      if (preview.length < 10) {
        preview.push({ ...row, __row: rowNum, __valid: rowErrors.length === 0 });
      }
    }

    res.json({
      success: true,
      module,
      totalRecords: records.length,
      validRecords: validCount,
      invalidRecords: errors.length,
      duplicateRecords: duplicateCount,
      preview,
      errors: errors.slice(0, 50),
      rawRecords: records,
    });
  } catch (error) {
    console.error('Validate import error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 3. COMMIT IMPORT DATA
 */
export const commitImport = async (req, res) => {
  try {
    const { module } = req.params;
    const { records, strategy = 'insert' } = req.body;

    if (!Array.isArray(records) || !records.length) {
      return res.status(400).json({ success: false, message: 'No records provided to commit.' });
    }

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const errorList = [];

    const existingCategories = await Category.find({}).lean();
    const categoryMap = new Map();
    existingCategories.forEach((c) => {
      categoryMap.set(String(c._id), c);
      categoryMap.set(c.name.toLowerCase().trim(), c);
    });

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      try {
        if (module.toLowerCase() === 'categories') {
          const name = String(row.name || '').trim();
          if (!name) continue;

          const existing = await Category.findOne({ name: new RegExp(`^${name}$`, 'i') });
          if (existing) {
            if (strategy === 'update' || strategy === 'upsert') {
              existing.name = name;
              await existing.save();
              updated++;
            } else {
              skipped++;
            }
          } else {
            await Category.create({ name });
            inserted++;
          }
        } else if (module.toLowerCase() === 'products') {
          const name = String(row.name || '').trim();
          const sellingPrice = parseFloat(row.sellingPrice || row.price || 0);
          const costPrice = parseFloat(row.costPrice || 0);
          const stock = parseInt(row.stock || 0, 10);
          const lowStockThreshold = parseInt(row.lowStockThreshold || 5, 10);
          const visibility = row.visibility !== false && String(row.visibility).toLowerCase() !== 'false';

          const catRef = row.category || row.categoryId;
          let matchedCat = categoryMap.get(String(catRef)) || categoryMap.get(String(catRef).toLowerCase().trim());
          if (!matchedCat) {
            matchedCat = await Category.findOne({ name: new RegExp(`^${catRef}$`, 'i') });
          }
          if (!matchedCat) {
            matchedCat = await Category.create({ name: String(catRef).trim() });
            categoryMap.set(String(matchedCat._id), matchedCat);
            categoryMap.set(matchedCat.name.toLowerCase().trim(), matchedCat);
          }

          let existingProduct = null;
          if (row._id && mongoose.Types.ObjectId.isValid(row._id)) {
            existingProduct = await Product.findById(row._id);
          }
          if (!existingProduct) {
            existingProduct = await Product.findOne({ name: new RegExp(`^${name}$`, 'i') });
          }

          if (existingProduct) {
            if (strategy === 'update' || strategy === 'upsert') {
              existingProduct.name = name;
              existingProduct.costPrice = costPrice;
              existingProduct.sellingPrice = sellingPrice;
              existingProduct.price = sellingPrice;
              existingProduct.stock = stock;
              existingProduct.categoryId = matchedCat._id;
              existingProduct.lowStockThreshold = lowStockThreshold;
              existingProduct.visibility = visibility;
              if (row.image) existingProduct.image = row.image;
              await existingProduct.save();
              updated++;
            } else {
              skipped++;
            }
          } else {
            await Product.create({
              name,
              costPrice,
              sellingPrice,
              price: sellingPrice,
              stock,
              categoryId: matchedCat._id,
              lowStockThreshold,
              visibility,
              image: row.image || '',
            });
            inserted++;
          }
        }
      } catch (err) {
        errorList.push({ row: i + 1, name: row.name || 'Unknown', error: err.message });
      }
    }

    const io = req.app.get('io');
    if (io) {
      if (module.toLowerCase() === 'products') io.emit('productsUpdated');
      if (module.toLowerCase() === 'categories') io.emit('categoriesUpdated');
    }

    await recordAuditLog(
      {
        userId: req.user._id,
        userName: req.user.name,
        role: req.user.role,
        action: 'DATA_IMPORT',
        module: 'System',
        targetType: 'Module',
        targetName: module,
        description: `${req.user.name} imported records into '${module}': ${inserted} inserted, ${updated} updated, ${skipped} skipped`,
        status: errorList.length ? 'Warning' : 'Success',
      },
      req
    );

    res.json({
      success: true,
      message: `Import completed: ${inserted} added, ${updated} updated, ${skipped} skipped.`,
      stats: { inserted, updated, skipped, failed: errorList.length },
      errors: errorList,
    });
  } catch (error) {
    console.error('Commit import error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 4. CREATE FULL SYSTEM BACKUP (ZIP PACKAGE)
 */
export const createFullBackup = async (req, res) => {
  try {
    const zip = new JSZip();
    const manifest = {
      backupVersion: '1.0.0',
      systemName: 'APC Store Smart POS & Inventory Management System',
      createdAt: new Date().toISOString(),
      createdByName: req.user.name,
      createdByEmail: req.user.email,
      modules: {},
    };

    // 1. Categories
    const categories = await Category.find({}).lean();
    zip.file('categories.json', JSON.stringify(categories, null, 2));
    manifest.modules.categories = categories.length;

    // 2. Products
    const products = await Product.find({}).lean();
    zip.file('products.json', JSON.stringify(products, null, 2));
    manifest.modules.products = products.length;

    // 3. Orders
    const orders = await Order.find({}).lean();
    zip.file('orders.json', JSON.stringify(orders, null, 2));
    manifest.modules.orders = orders.length;

    // 4. Counters
    const counters = await Counter.find({}).lean();
    zip.file('counters.json', JSON.stringify(counters, null, 2));
    manifest.modules.counters = counters.length;

    // 5. Staff Accounts (excluding passwords)
    const staff = await User.find({ role: 'staff' }).select('-password').lean();
    zip.file('staff.json', JSON.stringify(staff, null, 2));
    manifest.modules.staff = staff.length;

    // 6. Settings
    const settings = await Setting.find({}).lean();
    zip.file('settings.json', JSON.stringify(settings, null, 2));
    manifest.modules.settings = settings.length;

    // 7. Audit Logs
    const auditLogs = await AuditLog.find({}).sort({ timestamp: -1 }).limit(10000).lean();
    zip.file('audit_logs.json', JSON.stringify(auditLogs, null, 2));
    manifest.modules.audit_logs = auditLogs.length;

    // Add manifest
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `APC_Store_Full_Backup_${timestamp}.zip`;

    await recordAuditLog(
      {
        userId: req.user._id,
        userName: req.user.name,
        role: req.user.role,
        action: 'FULL_BACKUP_CREATED',
        module: 'System',
        targetType: 'Backup',
        targetName: fileName,
        description: `${req.user.name} generated full system backup (${(zipBuffer.length / 1024).toFixed(1)} KB) containing ${Object.values(manifest.modules).reduce((a, b) => a + b, 0)} records`,
        status: 'Success',
      },
      req
    );

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.status(200).send(zipBuffer);
  } catch (error) {
    console.error('Create full backup error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 5. VALIDATE RESTORE BACKUP PACKAGE
 */
export const validateRestoreBackup = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: 'Please upload a valid backup ZIP archive.' });
    }

    const zip = await JSZip.loadAsync(file.buffer);
    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) {
      return res.status(400).json({
        success: false,
        message: 'Invalid backup package: missing manifest.json.',
      });
    }

    const manifestText = await manifestFile.async('text');
    const manifest = JSON.parse(manifestText);

    const availableModules = {};
    for (const fileName of Object.keys(zip.files)) {
      if (fileName.endsWith('.json') && fileName !== 'manifest.json') {
        const modName = fileName.replace('.json', '');
        const content = await zip.file(fileName).async('text');
        try {
          const parsed = JSON.parse(content);
          availableModules[modName] = Array.isArray(parsed) ? parsed.length : 1;
        } catch {
          availableModules[modName] = 0;
        }
      }
    }

    res.json({
      success: true,
      manifest,
      availableModules,
      fileSize: file.size,
    });
  } catch (error) {
    console.error('Validate restore backup error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 6. COMMIT FULL BACKUP RESTORE
 */
export const commitRestoreBackup = async (req, res) => {
  try {
    const { backupPayload, restoreMode = 'merge' } = req.body;
    // backupPayload can be parsed json map from client or re-uploaded
    if (!backupPayload || typeof backupPayload !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid restore payload provided.' });
    }

    const restoreReport = {
      categories: { inserted: 0, updated: 0 },
      products: { inserted: 0, updated: 0 },
      counters: { inserted: 0, updated: 0 },
      orders: { inserted: 0, updated: 0 },
    };

    // Staged Restoration

    // 1. Categories
    if (Array.isArray(backupPayload.categories)) {
      for (const cat of backupPayload.categories) {
        if (!cat.name) continue;
        const existing = await Category.findOne({ name: new RegExp(`^${cat.name.trim()}$`, 'i') });
        if (existing) {
          if (restoreMode === 'replace') {
            existing.name = cat.name.trim();
            await existing.save();
            restoreReport.categories.updated++;
          }
        } else {
          await Category.create({ name: cat.name.trim() });
          restoreReport.categories.inserted++;
        }
      }
    }

    // 2. Products
    if (Array.isArray(backupPayload.products)) {
      for (const prod of backupPayload.products) {
        if (!prod.name) continue;
        const existing = await Product.findOne({ name: new RegExp(`^${prod.name.trim()}$`, 'i') });
        if (existing) {
          if (restoreMode === 'replace') {
            existing.sellingPrice = prod.sellingPrice || prod.price;
            existing.price = prod.sellingPrice || prod.price;
            existing.costPrice = prod.costPrice || 0;
            existing.stock = prod.stock || 0;
            existing.visibility = prod.visibility !== false;
            await existing.save();
            restoreReport.products.updated++;
          }
        } else {
          let category = await Category.findById(prod.categoryId);
          if (!category) {
            category = await Category.findOne({});
          }
          if (category) {
            await Product.create({
              name: prod.name.trim(),
              sellingPrice: prod.sellingPrice || prod.price || 0,
              price: prod.sellingPrice || prod.price || 0,
              costPrice: prod.costPrice || 0,
              stock: prod.stock || 0,
              categoryId: category._id,
              visibility: prod.visibility !== false,
            });
            restoreReport.products.inserted++;
          }
        }
      }
    }

    // 3. Counters
    if (Array.isArray(backupPayload.counters)) {
      for (const counter of backupPayload.counters) {
        if (!counter.name) continue;
        const existing = await Counter.findOne({ name: counter.name.trim() });
        if (!existing) {
          await Counter.create({
            name: counter.name.trim(),
            description: counter.description || '',
            isActive: counter.isActive !== false,
          });
          restoreReport.counters.inserted++;
        }
      }
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('productsUpdated');
      io.emit('categoriesUpdated');
      io.emit('countersUpdated');
    }

    await recordAuditLog(
      {
        userId: req.user._id,
        userName: req.user.name,
        role: req.user.role,
        action: 'SYSTEM_RESTORE_COMPLETED',
        module: 'System',
        targetType: 'Restore',
        targetName: restoreMode,
        description: `${req.user.name} executed system restore (${restoreMode} mode)`,
        status: 'Success',
      },
      req
    );

    res.json({
      success: true,
      message: 'System restore operation completed successfully.',
      report: restoreReport,
    });
  } catch (error) {
    console.error('Commit restore backup error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 7. GET RECENT BACKUP & RESTORE AUDIT HISTORY
 */
export const getBackupHistory = async (req, res) => {
  try {
    const history = await AuditLog.find({
      action: {
        $in: [
          'FULL_BACKUP_CREATED',
          'SYSTEM_RESTORE_COMPLETED',
          'DATA_EXPORT',
          'DATA_IMPORT',
        ],
      },
    })
      .sort({ timestamp: -1 })
      .limit(30)
      .lean();

    res.json({
      success: true,
      history,
    });
  } catch (error) {
    console.error('Get backup history error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
