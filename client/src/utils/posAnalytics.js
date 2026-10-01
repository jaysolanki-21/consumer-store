export const formatINR = (amount) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(amount) || 0);
export const dateKeyIST = (value = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
export const hourIST = (value) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hourCycle: "h23" }).format(new Date(value)));
export const dayBoundsIST = (key) => {
  const [year, month, day] = key.split("-").map(Number);
  const start = Date.UTC(year, month - 1, day) - 330 * 60000;
  return { start: new Date(start), end: new Date(start + 86400000 - 1) };
};
export const getTodayIST = () => dateKeyIST();
export const addDays = (key, amount) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + amount)).toISOString().slice(0, 10);
};
export const getWeekStartIST = (key = getTodayIST()) => {
  const [y, m, d] = key.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(key, -(weekday === 0 ? 6 : weekday - 1));
};
export const orderProfit = (order) => (order.items || []).reduce((sum, item) => sum + (Number(item.price ?? item.sellingPrice) - Number(item.costPrice || 0)) * Number(item.quantity || 0), 0);
export const orderCounter = (order) => order.counter?.name || order.counterName || order.counterId || "Unassigned";
export const orderStaff = (order) => order.staffName || order.confirmedBy?.name || order.staffId?.name || "Unassigned";
export const itemName = (item, productsById = new Map()) => item.productId?.name || productsById.get(String(item.productId?._id || item.productId))?.name || "Deleted product";

export function aggregateSales(orders, products, categories) {
  const productsById = new Map(products.map(product => [String(product._id), product]));
  const categoriesById = new Map(categories.map(category => [String(category._id), category.name]));
  const confirmed = orders.filter(order => order.status === "Confirmed");
  const productMap = new Map();
  const categoryMap = new Map();
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour: `${String(hour).padStart(2, "0")}:00`, orders: 0, revenue: 0, profit: 0 }));
  const payment = { Cash: 0, Online: 0 };
  const staffMap = new Map();
  const counterMap = new Map();
  const days = new Map();

  confirmed.forEach(order => {
    const revenue = Number(order.totalAmount || 0), profit = orderProfit(order);
    const key = dateKeyIST(order.confirmedAt || order.createdAt);
    const day = days.get(key) || { date: key, orders: 0, revenue: 0, cost: 0, profit: 0 };
    day.orders++; day.revenue += revenue; day.profit += profit; day.cost += revenue - profit; days.set(key, day);
    const hour = hours[hourIST(order.confirmedAt || order.createdAt)];
    hour.orders++; hour.revenue += revenue; hour.profit += profit;
    payment[(order.payment?.method || "Cash").toLowerCase() === "cash" ? "Cash" : "Online"] += revenue;
    const counterName = orderCounter(order), staffName = orderStaff(order);
    const counter = counterMap.get(counterName) || { name: counterName, orders: 0, revenue: 0, profit: 0 };
    counter.orders++; counter.revenue += revenue; counter.profit += profit; counterMap.set(counterName, counter);
    const staff = staffMap.get(staffName) || { name: staffName, orders: 0, revenue: 0, profit: 0 };
    staff.orders++; staff.revenue += revenue; staff.profit += profit; staffMap.set(staffName, staff);
    (order.items || []).forEach(item => {
      const id = String(item.productId?._id || item.productId);
      const product = productsById.get(id) || item.productId || {};
      const name = itemName(item, productsById);
      const categoryName = product.categoryId?.name || categoriesById.get(String(product.categoryId?._id || product.categoryId)) || "Uncategorized";
      const qty = Number(item.quantity || 0), itemRevenue = Number(item.price ?? item.sellingPrice ?? 0) * qty, cost = Number(item.costPrice || 0) * qty;
      const p = productMap.get(id) || { id, name, category: categoryName, quantity: 0, revenue: 0, cost: 0, profit: 0, orders: 0 };
      p.quantity += qty; p.revenue += itemRevenue; p.cost += cost; p.profit += itemRevenue - cost; p.orders++; productMap.set(id, p);
      const c = categoryMap.get(categoryName) || { name: categoryName, quantity: 0, revenue: 0, cost: 0, profit: 0, products: new Set() };
      c.quantity += qty; c.revenue += itemRevenue; c.cost += cost; c.profit += itemRevenue - cost; c.products.add(id); categoryMap.set(categoryName, c);
    });
  });
  const productRows = [...productMap.values()].map(row => ({ ...row, margin: row.revenue ? row.profit / row.revenue * 100 : 0 }));
  const categoryRows = [...categoryMap.values()].map(row => ({ ...row, productCount: row.products.size, margin: row.revenue ? row.profit / row.revenue * 100 : 0 }));
  const revenue = confirmed.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
  const profit = confirmed.reduce((sum, order) => sum + orderProfit(order), 0);
  return { confirmed, revenue, profit, cost: revenue - profit, margin: revenue ? profit / revenue * 100 : 0, averageOrder: confirmed.length ? revenue / confirmed.length : 0, products: productRows, categories: categoryRows, hours, payment, staff: [...staffMap.values()], counters: [...counterMap.values()], days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)) };
}

export function inDateRange(order, from, to, dateField = "createdAt") {
  const date = new Date(order[dateField] || order.createdAt);
  if (from && date < dayBoundsIST(from).start) return false;
  if (to && date > dayBoundsIST(to).end) return false;
  return true;
}
