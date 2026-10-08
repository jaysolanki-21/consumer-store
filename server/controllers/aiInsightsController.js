import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import AIInsight from '../models/AIInsight.js';

const responseCache = new Map();
const IST_OFFSET_MS = 330 * 60 * 1000;

const dateBounds = (date) => {
  const [year, month, day] = date.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, day) - IST_OFFSET_MS);
  return { start, end: new Date(start.getTime() + 86400000 - 1) };
};

// Evidence-bound parser to turn AI text response into structured takeaways and sections
function parseInsightsOutput(text, summary) {
  const takeaways = [];
  const sections = [];

  if (!text || typeof text !== 'string') {
    return { takeaways, sections, rawInsights: '' };
  }

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  let currentSection = null;
  let inTakeaways = false;

  for (const line of lines) {
    // Check if this line signals KEY TAKEAWAYS section
    if (/^#*\s*key takeaways/i.test(line)) {
      inTakeaways = true;
      continue;
    }

    if (/^#*\s*detailed insights/i.test(line)) {
      inTakeaways = false;
      continue;
    }

    // Check for takeaways bullet
    if (inTakeaways && /^[-*•]\s*(.+)/.test(line)) {
      const match = line.match(/^[-*•]\s*(.+)/);
      if (match && match[1]) {
        takeaways.push(match[1].trim());
        continue;
      }
    }

    // Pattern for section header: e.g. "Sales Insight: ...", "* Sales Insight: ...", "[Sales Insight | Priority: HIGH]: ..."
    const sectionMatch = line.match(
      /^[-*•#\s]*\[?([A-Za-z\s]+?)(?:\s*\|\s*Priority:\s*([A-Za-z]+))?\]?:\s*(.+)$/i
    );

    if (sectionMatch) {
      const rawTitle = sectionMatch[1].trim();
      const rawPriority = (sectionMatch[2] || '').toUpperCase();
      const content = sectionMatch[3].trim();

      let type = 'general';
      let title = rawTitle;
      let priority = ['LOW', 'MEDIUM', 'HIGH'].includes(rawPriority) ? rawPriority : 'MEDIUM';

      const lowerTitle = rawTitle.toLowerCase();
      if (lowerTitle.includes('sale') || lowerTitle.includes('revenue')) {
        type = 'sales';
        title = 'Sales Performance';
      } else if (lowerTitle.includes('profit') || lowerTitle.includes('margin')) {
        type = 'profit';
        title = 'Profit Margin & Contribution';
      } else if (lowerTitle.includes('inventory') || lowerTitle.includes('stock')) {
        type = 'inventory';
        title = 'Inventory & Stock Risk';
        if (!rawPriority) priority = 'HIGH';
      } else if (lowerTitle.includes('operation') || lowerTitle.includes('counter') || lowerTitle.includes('staff')) {
        type = 'operations';
        title = 'Store Operations';
      } else if (lowerTitle.includes('recommend') || lowerTitle.includes('action')) {
        type = 'recommendation';
        title = 'Actionable Recommendation';
        if (!rawPriority) priority = 'HIGH';
      } else if (lowerTitle.includes('payment')) {
        type = 'payment';
        title = 'Payment Methods';
      }

      currentSection = { type, title, content, priority };
      sections.push(currentSection);
      continue;
    }

    // If it's a bullet under current section, or continued text
    if (currentSection && line) {
      currentSection.content += ' ' + line.replace(/^[-*•]\s*/, '');
    } else if (/^[-*•]\s*(.+)/.test(line) && takeaways.length < 4) {
      takeaways.push(line.replace(/^[-*•]\s*/, ''));
    }
  }

  // Fallback takeaways from actual summary metrics if none parsed
  if (takeaways.length === 0) {
    if (summary.sales?.revenue) {
      takeaways.push(`Total revenue ₹${Number(summary.sales.revenue).toLocaleString('en-IN')} across ${summary.sales.orders} orders.`);
    }
    if (summary.sales?.peakHours?.length) {
      takeaways.push(`Peak sales volume observed at hour ${summary.sales.peakHours[0].hour}:00.`);
    }
    if (summary.inventory?.lowStock?.length) {
      takeaways.push(`${summary.inventory.lowStock.length} product(s) currently at or below low stock threshold.`);
    }
    if (summary.products?.mostProfitable?.length) {
      takeaways.push(`Highest profit contributor: ${summary.products.mostProfitable[0].name}.`);
    }
  }

  // Fallback section if no sections found
  if (sections.length === 0 && text) {
    sections.push({
      type: 'sales',
      title: 'Business Observation',
      content: text,
      priority: 'MEDIUM',
    });
  }

  return { takeaways: takeaways.slice(0, 4), sections, rawInsights: text };
}

export const getBusinessInsights = async (req, res) => {
  try {
    const apiKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ message: 'Groq is not configured on the server.' });
    }

    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    const defaultFrom = new Date(Date.now() - 29 * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const from = /^\d{4}-\d{2}-\d{2}$/.test(req.body.from || '') ? req.body.from : defaultFrom;
    const to = /^\d{4}-\d{2}-\d{2}$/.test(req.body.to || '') ? req.body.to : today;

    if (from > to) {
      return res.status(400).json({ message: 'Start date must be on or before end date.' });
    }

    const key = JSON.stringify({
      from,
      to,
      counter: req.body.counter || '',
      category: req.body.category || '',
      payment: req.body.payment || '',
      staff: req.body.staff || '',
    });

    const cached = responseCache.get(key);
    if (!req.body.forceRefresh && cached && cached.expires > Date.now()) {
      return res.json({ ...cached.value, cached: true });
    }

    const start = dateBounds(from).start;
    const end = dateBounds(to).end;

    const [orders, products, categories] = await Promise.all([
      Order.find({ status: 'Confirmed', createdAt: { $gte: start, $lte: end } })
        .select('items totalAmount payment.method counter counterName counterId staffId staffName confirmedBy confirmedAt createdAt')
        .populate('items.productId', 'name categoryId')
        .populate('staffId', 'name')
        .populate('confirmedBy', 'name')
        .populate('counter', 'name')
        .lean(),
      Product.find()
        .select('name stock reservedStock lowStockThreshold costPrice sellingPrice categoryId')
        .populate('categoryId', 'name')
        .lean(),
      Category.find().select('name').lean(),
    ]);

    const categoriesById = new Map(categories.map((c) => [String(c._id), c.name]));
    const productSales = new Map();
    const categorySales = new Map();
    const hourSales = Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0, revenue: 0 }));
    const daySales = new Map();
    const counterSales = new Map();
    const staffSales = new Map();
    const paymentSales = { cash: 0, online: 0 };
    let revenue = 0, cost = 0, profit = 0, orderCount = 0;

    const selectedOrders = orders.filter((order) => {
      const counterName = order.counter?.name || order.counterName || order.counterId || 'Unassigned';
      const staffName = order.staffName || order.confirmedBy?.name || order.staffId?.name || 'Unassigned';
      const method = (order.payment?.method || 'Cash').toLowerCase() === 'cash' ? 'cash' : 'online';

      if (req.body.counter && req.body.counter !== 'all' && counterName !== req.body.counter) return false;
      if (req.body.staff && req.body.staff !== 'all' && staffName !== req.body.staff) return false;
      if (req.body.payment && req.body.payment !== 'all' && method !== req.body.payment.toLowerCase()) return false;
      return true;
    });

    selectedOrders.forEach((order) => {
      let orderRevenue = Number(order.totalAmount || 0), orderCost = 0, orderProfit = 0, matchingRevenue = 0, matchingCost = 0;
      const time = order.confirmedAt || order.createdAt;
      const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(time));
      const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23' }).format(new Date(time)));

      let itemCategoryMatch = !req.body.category || req.body.category === 'all';
      (order.items || []).forEach((item) => {
        const productId = String(item.productId?._id || item.productId);
        const productName = item.productId?.name || 'Deleted product';
        const categoryName = item.productId?.categoryId?.name || categoriesById.get(String(item.productId?.categoryId)) || 'Uncategorized';

        if (req.body.category && req.body.category !== 'all' && categoryName !== req.body.category) return;
        itemCategoryMatch = true;

        const quantity = Number(item.quantity || 0);
        const itemRevenue = Number(item.price ?? item.sellingPrice ?? 0) * quantity;
        const itemCost = Number(item.costPrice || 0) * quantity;

        orderCost += itemCost;
        orderProfit += itemRevenue - itemCost;
        matchingRevenue += itemRevenue;
        matchingCost += itemCost;

        const p = productSales.get(productId) || { name: productName, category: categoryName, quantity: 0, revenue: 0, cost: 0, profit: 0 };
        p.quantity += quantity; p.revenue += itemRevenue; p.cost += itemCost; p.profit += itemRevenue - itemCost;
        productSales.set(productId, p);

        const c = categorySales.get(categoryName) || { category: categoryName, quantity: 0, revenue: 0, cost: 0, profit: 0 };
        c.quantity += quantity; c.revenue += itemRevenue; c.cost += itemCost; c.profit += itemRevenue - itemCost;
        categorySales.set(categoryName, c);
      });

      if (!itemCategoryMatch) return;
      if (req.body.category && req.body.category !== 'all') {
        orderRevenue = matchingRevenue;
        orderCost = matchingCost;
        orderProfit = matchingRevenue - matchingCost;
      }

      orderCount++;
      revenue += orderRevenue;
      cost += orderRevenue - orderProfit;
      profit += orderProfit;

      const day = daySales.get(dayKey) || { date: dayKey, orders: 0, revenue: 0, profit: 0 };
      day.orders++; day.revenue += orderRevenue; day.profit += orderProfit;
      daySales.set(dayKey, day);

      hourSales[hour].orders++;
      hourSales[hour].revenue += orderRevenue;

      const paymentKey = (order.payment?.method || 'Cash').toLowerCase() === 'cash' ? 'cash' : 'online';
      paymentSales[paymentKey] += orderRevenue;

      const counterName = order.counter?.name || order.counterName || order.counterId || 'Unassigned';
      const staffName = order.staffName || order.confirmedBy?.name || order.staffId?.name || 'Unassigned';

      const counter = counterSales.get(counterName) || { name: counterName, orders: 0, revenue: 0 };
      counter.orders++; counter.revenue += orderRevenue;
      counterSales.set(counterName, counter);

      const staff = staffSales.get(staffName) || { name: staffName, orders: 0, revenue: 0 };
      staff.orders++; staff.revenue += orderRevenue;
      staffSales.set(staffName, staff);
    });

    const inventoryRisks = products.map((product) => {
      const available = Math.max(0, Number(product.stock || 0) - Number(product.reservedStock || 0));
      const sold = productSales.get(String(product._id))?.quantity || 0;
      const days = Math.max(1, (dateBounds(to).start - dateBounds(from).start) / 86400000 + 1);
      return {
        name: product.name,
        available,
        lowThreshold: Number(product.lowStockThreshold || 0),
        unitsSold: sold,
        estimatedDaysOfStock: sold ? Math.round((available / (sold / days)) * 10) / 10 : null,
      };
    });

    const summary = {
      period: { from, to },
      sales: {
        revenue,
        orders: orderCount,
        averageOrderValue: orderCount ? revenue / orderCount : 0,
        cogs: cost,
        profit,
        margin: revenue ? (profit / revenue) * 100 : 0,
        daily: [...daySales.values()].sort((a, b) => a.date.localeCompare(b.date)),
        hourly: hourSales.filter((row) => row.orders),
        peakHours: [...hourSales].sort((a, b) => b.revenue - a.revenue).slice(0, 3),
      },
      products: {
        top: [...productSales.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5),
        least: [...productSales.values()].sort((a, b) => a.quantity - b.quantity).slice(0, 5),
        mostProfitable: [...productSales.values()].sort((a, b) => b.profit - a.profit).slice(0, 5),
        lowestMargin: [...productSales.values()]
          .filter((row) => row.revenue > 0)
          .map((row) => ({ ...row, margin: (row.profit / row.revenue) * 100 }))
          .sort((a, b) => a.margin - b.margin)
          .slice(0, 5),
      },
      categories: [...categorySales.values()].sort((a, b) => b.revenue - a.revenue),
      operations: {
        counters: [...counterSales.values()],
        staff: [...staffSales.values()],
        payments: paymentSales,
      },
      inventory: {
        lowStock: inventoryRisks.filter((p) => p.available > 0 && p.available <= p.lowThreshold).slice(0, 20),
        outOfStock: inventoryRisks.filter((p) => p.available <= 0).slice(0, 20),
        fastMoving: [...inventoryRisks].sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 10),
        stockRisk: inventoryRisks.filter((p) => p.estimatedDaysOfStock !== null).sort((a, b) => a.estimatedDaysOfStock - b.estimatedDaysOfStock).slice(0, 10),
      },
    };

    if (!orderCount && !products.length) {
      return res.json({
        insights: 'Insufficient data for the selected period.',
        takeaways: ['Insufficient transactions recorded for analysis.'],
        sections: [],
        metadata: { ordersAnalyzed: 0, revenueAnalyzed: 0 },
        cached: false,
      });
    }

    const prompt = `You are an evidence-bound supermarket business analyst. Use only the JSON data below. Never infer or invent counts, amounts, products, or trends. If a section lacks enough evidence, explicitly say "Insufficient data". Cite specific values only when present.

Respond strictly in this structured format:

KEY TAKEAWAYS:
- [Short takeaway 1 with specific metric]
- [Short takeaway 2 with specific metric]
- [Short takeaway 3 with specific metric]

DETAILED INSIGHTS:
Sales Insight: [Detailed sales analysis citing exact numbers]
Profit Insight: [Detailed profit analysis citing exact numbers]
Inventory Alert: [Inventory risk and stock levels citing products and days of stock]
Operations: [Counter, staff, or peak hours observation]
Recommendation: [Specific, data-driven, actionable business recommendation]

DATA: ${JSON.stringify(summary)}`;

    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 25000);
    let groqResponse;

    try {
      groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        signal: abort.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.GROQ_MODEL || 'qwen/qwen3.8-27b',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 750,
        }),
      });
    } finally {
      clearTimeout(timer);
    }

    if (!groqResponse.ok) {
      const providerError = await groqResponse.json().catch(() => ({}));
      console.error('Groq request failed:', groqResponse.status, providerError.error?.message || 'Provider error');
      return res.status(502).json({ message: 'Groq could not generate insights. Please try again later.' });
    }

    const rawContent = (await groqResponse.json()).choices?.[0]?.message?.content?.trim();
    if (!rawContent) {
      return res.status(502).json({ message: 'Groq returned an empty response.' });
    }

    // Parse into structured takeaways and sections
    const parsed = parseInsightsOutput(rawContent, summary);

    // PERSIST TO DATABASE
    const savedInsight = await AIInsight.create({
      generatedAt: new Date(),
      generatedBy: req.user?._id,
      generatedByName: req.user?.name || 'Administrator',
      period: summary.period,
      filters: {
        counter: req.body.counter || 'all',
        category: req.body.category || 'all',
        payment: req.body.payment || 'all',
        staff: req.body.staff || 'all',
      },
      metadata: {
        ordersAnalyzed: orderCount,
        revenueAnalyzed: revenue,
        model: process.env.GROQ_MODEL || 'Groq / Qwen',
      },
      takeaways: parsed.takeaways,
      sections: parsed.sections,
      rawInsights: rawContent,
      status: 'completed',
    });

    const responsePayload = {
      _id: savedInsight._id,
      insights: rawContent,
      takeaways: savedInsight.takeaways,
      sections: savedInsight.sections,
      metadata: savedInsight.metadata,
      period: savedInsight.period,
      filters: savedInsight.filters,
      generatedAt: savedInsight.generatedAt.toISOString(),
      generatedByName: savedInsight.generatedByName,
      cached: false,
    };

    if (responseCache.size > 100) responseCache.clear();
    responseCache.set(key, { value: responsePayload, expires: Date.now() + 5 * 60 * 1000 });

    return res.json(responsePayload);
  } catch (error) {
    console.error('AI insights error:', error.message);
    return res.status(error.name === 'AbortError' ? 504 : 500).json({
      message: error.name === 'AbortError' ? 'Groq request timed out.' : 'Failed to generate business insights.',
    });
  }
};

// GET /insights/ai/latest
export const getLatestBusinessInsight = async (req, res) => {
  try {
    const { from, to } = req.query;

    let query = {};
    if (from && to) {
      query = { 'period.from': from, 'period.to': to };
    }

    let insight = await AIInsight.findOne(query).sort({ generatedAt: -1 }).lean();

    // If query was for specific period and not found, fallback to the latest available insight overall
    if (!insight && (from || to)) {
      insight = await AIInsight.findOne().sort({ generatedAt: -1 }).lean();
    }

    if (!insight) {
      return res.json({ insight: null });
    }

    return res.json({
      insight: {
        _id: insight._id,
        insights: insight.rawInsights,
        takeaways: insight.takeaways || [],
        sections: insight.sections || [],
        metadata: insight.metadata || { ordersAnalyzed: 0, revenueAnalyzed: 0 },
        period: insight.period,
        filters: insight.filters || {},
        generatedAt: insight.generatedAt ? new Date(insight.generatedAt).toISOString() : new Date().toISOString(),
        generatedByName: insight.generatedByName || 'Administrator',
      },
    });
  } catch (error) {
    console.error('Error fetching latest AI insight:', error);
    return res.status(500).json({ message: 'Failed to fetch latest insight.' });
  }
};

// GET /insights/ai/history
export const getBusinessInsightHistory = async (req, res) => {
  try {
    const history = await AIInsight.find()
      .sort({ generatedAt: -1 })
      .limit(10)
      .select('generatedAt period metadata status takeaways generatedByName')
      .lean();

    return res.json({ history });
  } catch (error) {
    console.error('Error fetching AI insight history:', error);
    return res.status(500).json({ message: 'Failed to fetch insight history.' });
  }
};
