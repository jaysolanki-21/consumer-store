import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import User from '../models/User.js';
import Counter from '../models/Counter.js';

export const IST_OFFSET_MS = 330 * 60 * 1000; // +05:30 in milliseconds

/**
 * Convert a YYYY-MM-DD date string into UTC Date objects matching
 * the start (00:00:00.000) and end (23:59:59.999) of that day in Asia/Kolkata (IST).
 */
export const dateBoundsIST = (dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, day) - IST_OFFSET_MS);
  const end = new Date(start.getTime() + 86400000 - 1);
  return { start, end };
};

/**
 * Format a Date object or timestamp into YYYY-MM-DD in Asia/Kolkata (IST).
 */
export const formatDateKeyIST = (date) => {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(date));
};

/**
 * Compute comparison delta between current and previous values.
 */
export const computeDelta = (currentVal, previousVal) => {
  if (previousVal == null || previousVal === 0) {
    return {
      hasPrev: false,
      percent: 0,
      direction: 'neutral',
      rawDiff: (currentVal || 0) - 0,
      label: 'No previous-period data',
    };
  }

  const diff = ((currentVal - previousVal) / previousVal) * 100;
  const percent = Math.abs(Math.round(diff * 10) / 10);
  const direction = diff > 0.05 ? 'up' : diff < -0.05 ? 'down' : 'neutral';

  return {
    hasPrev: true,
    percent,
    direction,
    rawDiff: currentVal - previousVal,
    label: `${direction === 'up' ? '↑' : direction === 'down' ? '↓' : '•'} ${percent}% vs previous`,
  };
};

/**
 * Single Canonical Analytics Service for APC Store.
 * Used by both Live Store Analytics and AI Insight Generation to ensure 100% data parity.
 */
export const calculateCanonicalAnalytics = async (filters = {}) => {
  const todayIST = formatDateKeyIST(new Date());
  const defaultFromIST = formatDateKeyIST(new Date(Date.now() - 29 * 86400000));

  const from = /^\d{4}-\d{2}-\d{2}$/.test(filters.from || '') ? filters.from : defaultFromIST;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(filters.to || '') ? filters.to : todayIST;

  if (from > to) {
    throw new Error('Start date must be on or before end date.');
  }

  const { start: currentStart } = dateBoundsIST(from);
  const { end: currentEnd } = dateBoundsIST(to);
  const currentDurationMs = currentEnd.getTime() - currentStart.getTime() + 1;
  const daysInPeriod = Math.max(1, Math.round(currentDurationMs / 86400000));

  // Comparative period immediately preceding currentStart
  const compEnd = new Date(currentStart.getTime() - 1);
  const compStart = new Date(compEnd.getTime() - currentDurationMs + 1);
  const compFromStr = formatDateKeyIST(compStart);
  const compToStr = formatDateKeyIST(compEnd);

  // Parallel database fetch for confirmed orders, products, and categories
  const [currentOrders, compOrders, products, categories] = await Promise.all([
    Order.find({
      status: 'Confirmed',
      createdAt: { $gte: currentStart, $lte: currentEnd },
    })
      .select('items totalAmount payment counter counterName counterId staffId staffName confirmedBy confirmedAt createdAt')
      .populate('items.productId', 'name costPrice sellingPrice price categoryId stock reservedStock lowStockThreshold')
      .populate('staffId', 'name')
      .populate('confirmedBy', 'name')
      .populate('counter', 'name')
      .lean(),

    Order.find({
      status: 'Confirmed',
      createdAt: { $gte: compStart, $lte: compEnd },
    })
      .select('items totalAmount payment counter counterName counterId staffId staffName confirmedBy confirmedAt createdAt')
      .populate('items.productId', 'costPrice sellingPrice price')
      .lean(),

    Product.find()
      .select('name stock reservedStock lowStockThreshold costPrice sellingPrice categoryId visibility isAvailable')
      .populate('categoryId', 'name')
      .lean(),

    Category.find().select('name').lean(),
  ]);

  const categoriesById = new Map(categories.map((c) => [String(c._id), c.name]));

  // Track latest confirmed order timestamp as canonical data version
  let latestOrderTime = null;
  if (currentOrders.length > 0) {
    const sortedTimes = currentOrders
      .map((o) => new Date(o.confirmedAt || o.createdAt).getTime())
      .sort((a, b) => b - a);
    latestOrderTime = new Date(sortedTimes[0]).toISOString();
  }
  const dataVersion = latestOrderTime || `empty-${from}-${to}`;

  // Filter application helpers
  const matchesFilters = (order) => {
    const counterName = order.counter?.name || order.counterName || order.counterId || 'Unassigned';
    const staffName = order.staffName || order.confirmedBy?.name || order.staffId?.name || 'Unassigned';
    const method = (order.payment?.method || 'Cash').toLowerCase() === 'cash' ? 'cash' : 'online';

    if (filters.counter && filters.counter !== 'all' && counterName !== filters.counter) return false;
    if (filters.staff && filters.staff !== 'all' && staffName !== filters.staff) return false;
    if (filters.payment && filters.payment !== 'all' && method !== filters.payment.toLowerCase()) return false;
    return true;
  };

  const selectedCurrentOrders = currentOrders.filter(matchesFilters);
  const selectedCompOrders = compOrders.filter(matchesFilters);

  // Aggregate current period
  const productSales = new Map();
  const categorySales = new Map();
  const hourSales = Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0, revenue: 0 }));
  const daySales = new Map();
  const counterSales = new Map();
  const staffSales = new Map();
  const paymentSales = { cash: { revenue: 0, orders: 0 }, online: { revenue: 0, orders: 0 } };

  let currentRevenue = 0;
  let currentCost = 0;
  let currentProfit = 0;
  let currentOrdersCount = 0;
  let currentItemsSold = 0;

  selectedCurrentOrders.forEach((order) => {
    let orderRevenue = Number(order.totalAmount || 0);
    let orderCost = 0;
    let orderProfit = 0;
    let matchingRevenue = 0;
    let matchingCost = 0;
    let orderItemsSold = 0;

    const time = order.confirmedAt || order.createdAt;
    const dayKey = formatDateKeyIST(time);
    const hour = Number(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        hourCycle: 'h23',
      }).format(new Date(time))
    );

    let hasCategoryMatch = !filters.category || filters.category === 'all';

    (order.items || []).forEach((item) => {
      const prod = item.productId || {};
      const productId = String(prod._id || item.productId || 'unknown');
      const productName = prod.name || item.name || 'Unnamed Product';
      const categoryName =
        prod.categoryId?.name || categoriesById.get(String(prod.categoryId)) || 'Uncategorized';

      if (filters.category && filters.category !== 'all' && categoryName !== filters.category) {
        return;
      }
      hasCategoryMatch = true;

      const quantity = Number(item.quantity || 1);
      const sellPrice = Number(item.sellingPrice ?? item.price ?? prod.sellingPrice ?? prod.price ?? 0);
      const costPrice = Number(item.costPrice ?? prod.costPrice ?? 0);

      const itemRevenue = sellPrice * quantity;
      const itemCost = costPrice * quantity;
      const itemProfit = itemRevenue - itemCost;

      orderCost += itemCost;
      orderProfit += itemProfit;
      matchingRevenue += itemRevenue;
      matchingCost += itemCost;
      orderItemsSold += quantity;

      // Product sales tracking
      const p = productSales.get(productId) || {
        id: productId,
        name: productName,
        category: categoryName,
        quantity: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
      };
      p.quantity += quantity;
      p.revenue += itemRevenue;
      p.cost += itemCost;
      p.profit += itemProfit;
      productSales.set(productId, p);

      // Category sales tracking
      const c = categorySales.get(categoryName) || {
        category: categoryName,
        quantity: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
      };
      c.quantity += quantity;
      c.revenue += itemRevenue;
      c.cost += itemCost;
      c.profit += itemProfit;
      categorySales.set(categoryName, c);
    });

    if (!hasCategoryMatch) return;

    if (filters.category && filters.category !== 'all') {
      orderRevenue = matchingRevenue;
      orderCost = matchingCost;
      orderProfit = matchingRevenue - matchingCost;
    }

    currentOrdersCount += 1;
    currentRevenue += orderRevenue;
    currentCost += orderCost;
    currentProfit += orderProfit;
    currentItemsSold += orderItemsSold;

    // Daily tracking
    const day = daySales.get(dayKey) || { date: dayKey, orders: 0, revenue: 0, profit: 0 };
    day.orders += 1;
    day.revenue += orderRevenue;
    day.profit += orderProfit;
    daySales.set(dayKey, day);

    // Hourly tracking
    if (hourSales[hour]) {
      hourSales[hour].orders += 1;
      hourSales[hour].revenue += orderRevenue;
    }

    // Payment tracking
    const paymentKey = (order.payment?.method || 'Cash').toLowerCase() === 'cash' ? 'cash' : 'online';
    paymentSales[paymentKey].revenue += orderRevenue;
    paymentSales[paymentKey].orders += 1;

    // Counter tracking
    const counterName = order.counter?.name || order.counterName || order.counterId || 'Unassigned';
    const counter = counterSales.get(counterName) || { name: counterName, orders: 0, revenue: 0, profit: 0 };
    counter.orders += 1;
    counter.revenue += orderRevenue;
    counter.profit += orderProfit;
    counterSales.set(counterName, counter);

    // Staff tracking
    const staffName = order.staffName || order.confirmedBy?.name || order.staffId?.name || 'Unassigned';
    const staff = staffSales.get(staffName) || { name: staffName, orders: 0, revenue: 0, profit: 0 };
    staff.orders += 1;
    staff.revenue += orderRevenue;
    staff.profit += orderProfit;
    staffSales.set(staffName, staff);
  });

  // Aggregate comparative period
  let compRevenue = 0;
  let compCost = 0;
  let compProfit = 0;
  let compOrdersCount = 0;
  let compItemsSold = 0;

  selectedCompOrders.forEach((order) => {
    let orderRevenue = Number(order.totalAmount || 0);
    let orderCost = 0;
    let orderProfit = 0;
    let orderItemsSold = 0;

    (order.items || []).forEach((item) => {
      const quantity = Number(item.quantity || 1);
      const sellPrice = Number(item.sellingPrice ?? item.price ?? 0);
      const costPrice = Number(item.costPrice ?? 0);
      const itemRevenue = sellPrice * quantity;
      const itemCost = costPrice * quantity;

      orderCost += itemCost;
      orderProfit += itemRevenue - itemCost;
      orderItemsSold += quantity;
    });

    compOrdersCount += 1;
    compRevenue += orderRevenue;
    compCost += orderCost;
    compProfit += orderProfit;
    compItemsSold += orderItemsSold;
  });

  // Calculate profitability and ratios
  const currentMargin = currentRevenue > 0 ? (currentProfit / currentRevenue) * 100 : 0;
  const currentAOV = currentOrdersCount > 0 ? currentRevenue / currentOrdersCount : 0;

  const compMargin = compRevenue > 0 ? (compProfit / compRevenue) * 100 : 0;
  const compAOV = compOrdersCount > 0 ? compRevenue / compOrdersCount : 0;

  // Inventory velocity & stock risk calculation
  const inventoryRisks = products.map((product) => {
    const available = Math.max(0, Number(product.stock || 0) - Number(product.reservedStock || 0));
    const sold = productSales.get(String(product._id))?.quantity || 0;
    const threshold = Number(product.lowStockThreshold || 5);
    const dailyVelocity = sold / daysInPeriod;
    const estimatedDaysOfStock =
      sold > 0 ? Math.round((available / dailyVelocity) * 10) / 10 : null;

    let riskLevel = 'HEALTHY';
    if (available === 0) riskLevel = 'OUT_OF_STOCK';
    else if (estimatedDaysOfStock !== null && estimatedDaysOfStock < 3) riskLevel = 'CRITICAL';
    else if (available <= threshold || (estimatedDaysOfStock !== null && estimatedDaysOfStock < 7))
      riskLevel = 'WARNING';

    return {
      id: String(product._id),
      name: product.name,
      available,
      stock: Number(product.stock || 0),
      reservedStock: Number(product.reservedStock || 0),
      lowStockThreshold: threshold,
      unitsSold: sold,
      dailyVelocity: Math.round(dailyVelocity * 100) / 100,
      estimatedDaysOfStock,
      riskLevel,
      sellingPrice: Number(product.sellingPrice || 0),
      costPrice: Number(product.costPrice || 0),
    };
  });

  const productList = [...productSales.values()];

  // Canonical metrics payload
  return {
    period: {
      from,
      to,
      days: daysInPeriod,
    },
    timezone: 'Asia/Kolkata',
    dataVersion,
    generatedAt: new Date().toISOString(),
    metrics: {
      revenue: Math.round(currentRevenue),
      orders: currentOrdersCount,
      itemsSold: currentItemsSold,
      cogs: Math.round(currentCost),
      profit: Math.round(currentProfit),
      margin: Math.round(currentMargin * 10) / 10,
      averageOrderValue: Math.round(currentAOV),
    },
    comparison: {
      period: { from: compFromStr, to: compToStr },
      metrics: {
        revenue: Math.round(compRevenue),
        orders: compOrdersCount,
        itemsSold: compItemsSold,
        cogs: Math.round(compCost),
        profit: Math.round(compProfit),
        margin: Math.round(compMargin * 10) / 10,
        averageOrderValue: Math.round(compAOV),
      },
      deltas: {
        revenue: computeDelta(currentRevenue, compRevenue),
        orders: computeDelta(currentOrdersCount, compOrdersCount),
        profit: computeDelta(currentProfit, compProfit),
        margin: {
          hasPrev: compRevenue > 0,
          rawDiff: Math.round((currentMargin - compMargin) * 10) / 10,
          percent: Math.abs(Math.round((currentMargin - compMargin) * 10) / 10),
          direction:
            currentMargin - compMargin > 0.05
              ? 'up'
              : currentMargin - compMargin < -0.05
              ? 'down'
              : 'neutral',
          label:
            compRevenue > 0
              ? `${currentMargin - compMargin >= 0 ? '+' : ''}${Math.round(
                  (currentMargin - compMargin) * 10
                ) / 10}% pts vs previous`
              : 'No previous-period data',
        },
        aov: computeDelta(currentAOV, compAOV),
        itemsSold: computeDelta(currentItemsSold, compItemsSold),
      },
    },
    products: {
      top: productList.sort((a, b) => b.quantity - a.quantity).slice(0, 5),
      least: productList.sort((a, b) => a.quantity - b.quantity).slice(0, 5),
      mostProfitable: productList.sort((a, b) => b.profit - a.profit).slice(0, 5),
      lowestMargin: productList
        .filter((p) => p.revenue > 0)
        .map((p) => ({ ...p, margin: Math.round((p.profit / p.revenue) * 1000) / 10 }))
        .sort((a, b) => a.margin - b.margin)
        .slice(0, 5),
    },
    categories: [...categorySales.values()]
      .map((c) => ({
        ...c,
        margin: c.revenue > 0 ? Math.round((c.profit / c.revenue) * 1000) / 10 : 0,
        percentage: currentRevenue > 0 ? Math.round((c.revenue / currentRevenue) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue),
    operations: {
      counters: [...counterSales.values()]
        .map((c) => ({
          ...c,
          aov: c.orders > 0 ? Math.round(c.revenue / c.orders) : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue),
      staff: [...staffSales.values()]
        .map((s) => ({
          ...s,
          aov: s.orders > 0 ? Math.round(s.revenue / s.orders) : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue),
      payments: {
        cash: {
          ...paymentSales.cash,
          percentage:
            currentRevenue > 0 ? Math.round((paymentSales.cash.revenue / currentRevenue) * 100) : 0,
        },
        online: {
          ...paymentSales.online,
          percentage:
            currentRevenue > 0 ? Math.round((paymentSales.online.revenue / currentRevenue) * 100) : 0,
        },
      },
      hourly: hourSales.filter((h) => h.orders > 0),
      peakHours: [...hourSales].sort((a, b) => b.revenue - a.revenue).slice(0, 3),
    },
    inventory: {
      outOfStock: inventoryRisks.filter((p) => p.available <= 0).slice(0, 20),
      lowStock: inventoryRisks
        .filter((p) => p.available > 0 && p.available <= p.lowStockThreshold)
        .slice(0, 20),
      stockRisk: inventoryRisks
        .filter((p) => p.estimatedDaysOfStock !== null && p.estimatedDaysOfStock < 14)
        .sort((a, b) => (a.estimatedDaysOfStock ?? 999) - (b.estimatedDaysOfStock ?? 999))
        .slice(0, 10),
      fastMoving: [...inventoryRisks].sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 10),
    },
  };
};
