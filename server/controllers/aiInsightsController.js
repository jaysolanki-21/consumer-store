import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';

const responseCache = new Map();
const IST_OFFSET_MS = 330 * 60 * 1000;
const dateBounds = (date) => {
  const [year, month, day] = date.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, day) - IST_OFFSET_MS);
  return { start, end: new Date(start.getTime() + 86400000 - 1) };
};
const profitOf = (order) => (order.items || []).reduce((sum, item) => sum + (Number(item.price ?? item.sellingPrice ?? 0) - Number(item.costPrice || 0)) * Number(item.quantity || 0), 0);

export const getBusinessInsights = async (req, res) => {
  try {
    const apiKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
    if (!apiKey) return res.status(503).json({ message: 'Groq is not configured on the server.' });
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    const defaultFrom = new Date(Date.now() - 29 * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const from = /^\d{4}-\d{2}-\d{2}$/.test(req.body.from || '') ? req.body.from : defaultFrom;
    const to = /^\d{4}-\d{2}-\d{2}$/.test(req.body.to || '') ? req.body.to : today;
    if (from > to) return res.status(400).json({ message: 'Start date must be on or before end date.' });
    const key = JSON.stringify({ from, to, counter: req.body.counter || '', category: req.body.category || '', payment: req.body.payment || '', staff: req.body.staff || '' });
    const cached = responseCache.get(key);
    if (!req.body.forceRefresh && cached && cached.expires > Date.now()) return res.json({ ...cached.value, cached: true });

    const start = dateBounds(from).start;
    const end = dateBounds(to).end;
    const [orders, products, categories] = await Promise.all([
      Order.find({ status: 'Confirmed', createdAt: { $gte: start, $lte: end } }).select('items totalAmount payment.method counter counterName counterId staffId staffName confirmedBy confirmedAt createdAt').populate('items.productId', 'name categoryId').populate('staffId', 'name').populate('confirmedBy', 'name').populate('counter', 'name').lean(),
      Product.find().select('name stock reservedStock lowStockThreshold costPrice sellingPrice categoryId').populate('categoryId', 'name').lean(),
      Category.find().select('name').lean()
    ]);
    const categoriesById = new Map(categories.map(category => [String(category._id), category.name]));
    const productSales = new Map();
    const categorySales = new Map();
    const hourSales = Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0, revenue: 0 }));
    const daySales = new Map();
    const counterSales = new Map();
    const staffSales = new Map();
    const paymentSales = { cash: 0, online: 0 };
    let revenue = 0, cost = 0, profit = 0, orderCount = 0;
    const selectedOrders = orders.filter(order => {
      const counterName = order.counter?.name || order.counterName || order.counterId || 'Unassigned';
      const staffName = order.staffName || order.confirmedBy?.name || order.staffId?.name || 'Unassigned';
      const method = (order.payment?.method || 'Cash').toLowerCase() === 'cash' ? 'cash' : 'online';
      if (req.body.counter && req.body.counter !== 'all' && counterName !== req.body.counter) return false;
      if (req.body.staff && req.body.staff !== 'all' && staffName !== req.body.staff) return false;
      if (req.body.payment && req.body.payment !== 'all' && method !== req.body.payment.toLowerCase()) return false;
      return true;
    });
    selectedOrders.forEach(order => {
      let orderRevenue = Number(order.totalAmount || 0), orderCost = 0, orderProfit = 0, matchingRevenue = 0, matchingCost = 0;
      const time = order.confirmedAt || order.createdAt;
      const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(time));
      const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23' }).format(new Date(time)));
      let itemCategoryMatch = !req.body.category || req.body.category === 'all';
      (order.items || []).forEach(item => {
        const productId = String(item.productId?._id || item.productId);
        const productName = item.productId?.name || 'Deleted product';
        const categoryName = item.productId?.categoryId?.name || categoriesById.get(String(item.productId?.categoryId)) || 'Uncategorized';
        if (req.body.category && req.body.category !== 'all' && categoryName !== req.body.category) return;
        itemCategoryMatch = true;
        const quantity = Number(item.quantity || 0), itemRevenue = Number(item.price ?? item.sellingPrice ?? 0) * quantity;
        const itemCost = Number(item.costPrice || 0) * quantity;
        orderCost += itemCost;
        orderProfit += itemRevenue - itemCost;
        matchingRevenue += itemRevenue;
        matchingCost += itemCost;
        const p = productSales.get(productId) || { name: productName, category: categoryName, quantity: 0, revenue: 0, cost: 0, profit: 0 };
        p.quantity += quantity; p.revenue += itemRevenue; p.cost += itemCost; p.profit += itemRevenue - itemCost; productSales.set(productId, p);
        const c = categorySales.get(categoryName) || { category: categoryName, quantity: 0, revenue: 0, cost: 0, profit: 0 };
        c.quantity += quantity; c.revenue += itemRevenue; c.cost += itemCost; c.profit += itemRevenue - itemCost; categorySales.set(categoryName, c);
      });
      if (!itemCategoryMatch) return;
      if (req.body.category && req.body.category !== 'all') {
        orderRevenue = matchingRevenue;
        orderCost = matchingCost;
        orderProfit = matchingRevenue - matchingCost;
      }
      orderCount++; revenue += orderRevenue; cost += orderRevenue - orderProfit; profit += orderProfit;
      const day = daySales.get(dayKey) || { date: dayKey, orders: 0, revenue: 0, profit: 0 };
      day.orders++; day.revenue += orderRevenue; day.profit += orderProfit; daySales.set(dayKey, day);
      hourSales[hour].orders++; hourSales[hour].revenue += orderRevenue;
      const paymentKey = (order.payment?.method || 'Cash').toLowerCase() === 'cash' ? 'cash' : 'online';
      paymentSales[paymentKey] += orderRevenue;
      const counterName = order.counter?.name || order.counterName || order.counterId || 'Unassigned';
      const staffName = order.staffName || order.confirmedBy?.name || order.staffId?.name || 'Unassigned';
      const counter = counterSales.get(counterName) || { name: counterName, orders: 0, revenue: 0 };
      counter.orders++; counter.revenue += orderRevenue; counterSales.set(counterName, counter);
      const staff = staffSales.get(staffName) || { name: staffName, orders: 0, revenue: 0 };
      staff.orders++; staff.revenue += orderRevenue; staffSales.set(staffName, staff);
    });
    const inventoryRisks = products.map(product => {
      const available = Math.max(0, Number(product.stock || 0) - Number(product.reservedStock || 0));
      const sold = productSales.get(String(product._id))?.quantity || 0;
      const days = Math.max(1, (dateBounds(to).start - dateBounds(from).start) / 86400000 + 1);
      return { name: product.name, available, lowThreshold: Number(product.lowStockThreshold || 0), unitsSold: sold, estimatedDaysOfStock: sold ? Math.round(available / (sold / days) * 10) / 10 : null };
    });
    const summary = {
      period: { from, to },
      sales: { revenue, orders: orderCount, averageOrderValue: orderCount ? revenue / orderCount : 0, cogs: cost, profit, margin: revenue ? profit / revenue * 100 : 0, daily: [...daySales.values()].sort((a,b)=>a.date.localeCompare(b.date)), hourly: hourSales.filter(row => row.orders), peakHours: [...hourSales].sort((a,b)=>b.revenue-a.revenue).slice(0,3) },
      products: { top: [...productSales.values()].sort((a,b)=>b.quantity-a.quantity).slice(0,5), least: [...productSales.values()].sort((a,b)=>a.quantity-b.quantity).slice(0,5), mostProfitable: [...productSales.values()].sort((a,b)=>b.profit-a.profit).slice(0,5), lowestMargin: [...productSales.values()].filter(row=>row.revenue>0).map(row=>({...row,margin:row.profit/row.revenue*100})).sort((a,b)=>a.margin-b.margin).slice(0,5) },
      categories: [...categorySales.values()].sort((a,b)=>b.revenue-a.revenue),
      operations: { counters: [...counterSales.values()], staff: [...staffSales.values()], payments: paymentSales },
      inventory: { lowStock: inventoryRisks.filter(p=>p.available>0&&p.available<=p.lowThreshold).slice(0,20), outOfStock: inventoryRisks.filter(p=>p.available<=0).slice(0,20), fastMoving: [...inventoryRisks].sort((a,b)=>b.unitsSold-a.unitsSold).slice(0,10), stockRisk: inventoryRisks.filter(p=>p.estimatedDaysOfStock!==null).sort((a,b)=>a.estimatedDaysOfStock-b.estimatedDaysOfStock).slice(0,10) }
    };
    if (!orderCount && !products.length) return res.json({ insights: 'Insufficient data for the selected period.', cached: false });
    const prompt = `You are an evidence-bound supermarket business analyst. Use only the JSON data below. Never infer or invent counts, amounts, products, or trends. If a section lacks enough evidence, explicitly say "Insufficient data". Respond with 4-7 short actionable bullets, each prefixed by one of these exact labels: Sales Insight, Inventory Alert, Profit Insight, Operations, Recommendation. Cite specific values only when present. Clearly state that these are AI-generated observations.\nDATA: ${JSON.stringify(summary)}`;
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 25000);
    let groqResponse;
    try {
      groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', signal: abort.signal,
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: process.env.GROQ_MODEL || 'qwen/qwen3.8-27b', messages: [{ role: 'user', content: prompt }], temperature: 0.2, max_tokens: 650 })
      });
    } finally { clearTimeout(timer); }
    if (!groqResponse.ok) {
      const providerError = await groqResponse.json().catch(() => ({}));
      console.error('Groq request failed:', groqResponse.status, providerError.error?.message || 'Provider error');
      return res.status(502).json({ message: 'Groq could not generate insights. Please try again later.' });
    }
    const insights = (await groqResponse.json()).choices?.[0]?.message?.content?.trim();
    if (!insights) return res.status(502).json({ message: 'Groq returned an empty response.' });
    const value = { insights, generatedAt: new Date().toISOString(), period: summary.period };
    if (responseCache.size > 100) responseCache.clear();
    responseCache.set(key, { value, expires: Date.now() + 5 * 60 * 1000 });
    return res.json({ ...value, cached: false });
  } catch (error) {
    console.error('AI insights error:', error.message);
    return res.status(error.name === 'AbortError' ? 504 : 500).json({ message: error.name === 'AbortError' ? 'Groq request timed out.' : 'Failed to generate business insights.' });
  }
};
