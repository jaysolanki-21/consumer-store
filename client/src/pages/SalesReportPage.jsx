import { useEffect, useMemo, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  IndianRupee,
  Calendar,
  Filter,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  Search,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  BarChart2,
  ShoppingBag,
  Package,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Layers,
  Check,
  RotateCcw,
  CreditCard,
  Monitor,
  Tag,
  Info,
  Percent,
  X,
  Activity,
  AlertTriangle,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import toast from "react-hot-toast";
import api from "../services/api";
import socket from "../services/socket";
import {
  exportReportToCSV,
  exportReportToExcel,
  exportReportToPDF,
  formatINR,
  formatDuration,
  formatISTDateTime,
  formatISTDate,
  printReport,
} from "../utils/exportUtils";

// 7 Clean Core Report Categories Definition
export const REPORT_GROUPS = [
  {
    id: "sales",
    title: "Sales & Revenue",
    shortTitle: "Sales",
    icon: TrendingUp,
    reports: [
      "Product-wise Sales",
      "Daily Sales",
      "Sales by Hour / Peak Hours",
      "Category Performance",
      "Counter Performance",
      "Staff Performance",
      "Payment-wise Sales",
      "Top Selling Products",
      "Least Selling Products",
      "Revenue Trend",
    ],
  },
  {
    id: "profit",
    title: "Profit & Cost",
    shortTitle: "Profit",
    icon: IndianRupee,
    reports: [
      "Profit & Loss",
      "Product Profitability",
      "Category Profitability",
      "Cost Analysis",
      "High Margin Products",
      "Dead Stock",
    ],
  },
  {
    id: "orders",
    title: "Orders",
    shortTitle: "Orders",
    icon: ShoppingBag,
    reports: [
      "All Orders",
      "Pending Orders",
      "Cancelled Orders",
      "Order Status Summary",
      "Order Time Analysis",
    ],
  },
  {
    id: "inventory",
    title: "Inventory",
    shortTitle: "Inventory",
    icon: Package,
    reports: [
      "Current Stock",
      "Low Stock",
      "Out of Stock",
      "Stock Movement",
      "Stock Valuation",
      "Fast Moving Stock",
      "Reserved Stock",
    ],
  },
  {
    id: "staff",
    title: "Staff",
    shortTitle: "Staff",
    icon: Users,
    reports: [
      "Staff Performance & Activity",
      "Staff Login History",
      "Working & Active Time",
    ],
  },
  {
    id: "counters",
    title: "Counters",
    shortTitle: "Counters",
    icon: Monitor,
    reports: [
      "Counter Performance",
    ],
  },
  {
    id: "comparison",
    title: "Comparison",
    shortTitle: "Comparison",
    icon: ArrowUpDown,
    reports: [
      "Today vs Yesterday",
      "This Week vs Last Week",
      "This Month vs Last Month",
      "YoY Growth",
    ],
  },
];

// Concise descriptions for each report
const REPORT_DESCRIPTIONS = {
  "Product-wise Sales": "Sales volume, revenue generated, cost of goods, and gross margins broken down by individual product.",
  "Daily Sales": "Daily revenue, orders count, cost and profit breakdown for the selected period.",
  "Sales by Hour / Peak Hours": "Hourly transaction distribution and revenue to identify peak customer shopping hours.",
  "Category Performance": "Sales performance, revenue, and gross profit analyzed across product categories.",
  "Counter Performance": "Transaction volume, billed revenue, and ticket size by checkout counter.",
  "Staff Performance": "Sales orders billed, revenue generated, and ticket size by staff member.",
  "Payment-wise Sales": "Revenue distribution and volume share across payment methods (Cash, UPI, Card, Online).",
  "Top Selling Products": "Highest performing products ranked by quantity sold and revenue contribution.",
  "Least Selling Products": "Lowest selling catalog items to identify underperforming or slow-moving stock.",
  "Revenue Trend": "Chronological revenue, profit progression and margin health over time.",
  "Profit & Loss": "High-level financial summary of gross revenue, procurement cost of goods sold, and net profit.",
  "Product Profitability": "Comprehensive profitability analysis with net profit, profit per unit, and gross margin percentages.",
  "Category Profitability": "Gross margin and net profit contribution categorized by product department.",
  "Cost Analysis": "Analysis of procurement cost vs sales revenue and inventory expenditure.",
  "High Margin Products": "Catalog products delivering strong gross profit margins of 50% or higher.",
  "Dead Stock": "Products with positive stock on hand that have recorded zero sales in the last 30 days.",
  "All Orders": "Comprehensive log of all POS customer orders with status, billing counter, staff and payment.",
  "Pending Orders": "Orders currently in pending or processing status requiring action or checkout.",
  "Cancelled Orders": "Orders cancelled in POS, including cancellation reason, counter, and timestamps.",
  "Order Status Summary": "Distribution and percentage share of orders across all lifecycle statuses.",
  "Order Time Analysis": "Processing turnaround time between order creation and counter confirmation.",
  "Current Stock": "Real-time inventory levels, reserved units, sellable availability, and reorder thresholds.",
  "Low Stock": "Products with stock levels at or below their configured minimum reorder threshold.",
  "Out of Stock": "Products with zero stock on hand requiring immediate restocking.",
  "Stock Movement": "Inventory sales turnover and movement velocity for active catalog products.",
  "Stock Valuation": "Total inventory value assessed at both procurement cost and retail selling price.",
  "Fast Moving Stock": "High-velocity items with fast turnover rates and current stock on hand.",
  "Reserved Stock": "Inventory units currently held or reserved in active checkout carts and queues.",
  "Staff Performance & Activity": "Staff member billing performance, total orders processed, speed, and active status.",
  "Staff Login History": "Authentication audit trail of staff login and logout sessions with IP and duration.",
  "Working & Active Time": "Total working session duration and active shifts logged per staff member.",
  "Today vs Yesterday": "Comparative analysis of sales, revenue, orders, and average ticket size between today and yesterday.",
  "This Week vs Last Week": "Weekly performance comparison tracking daily revenue and order trends.",
  "This Month vs Last Month": "Monthly performance comparison highlighting revenue, profit, and order trends.",
  "YoY Growth": "Year-over-year revenue, order volume, and business expansion comparison.",
};

// Clean Professional Palette for Charts
const CHART_COLORS = [
  "#10B981", // Emerald
  "#6366F1", // Indigo
  "#3B82F6", // Blue
  "#F59E0B", // Amber
  "#EC4899", // Pink
  "#8B5CF6", // Purple
  "#14B8A6", // Teal
  "#F97316", // Orange
  "#06B6D4", // Cyan
  "#64748B", // Slate
];

const money = (value) => Number(value || 0);
const orderDate = (order) => order.confirmedAt || order.createdAt;

const productName = (item, productsById) =>
  item.productId?.name ||
  productsById?.get(String(item.productId?._id || item.productId))?.name ||
  item.name ||
  "Product Item";

const counterOf = (o) =>
  o.counter?.name || o.counterName || o.counterId || "Unassigned Counter";

const staffOf = (o) =>
  (o.staffName && String(o.staffName).trim()) ||
  o.confirmedBy?.name ||
  o.staffId?.name ||
  "Unassigned Staff";

const profitOf = (o) =>
  (o.items || []).reduce(
    (n, i) =>
      n +
      (money(i.price ?? i.sellingPrice) - money(i.costPrice)) *
        money(i.quantity),
    0
  );

const currencyCol = (key, header) => ({
  key,
  header,
  format: "currency",
  align: "right",
});

const qtyCol = (key = "quantity", header = "Quantity") => ({
  key,
  header,
  align: "right",
});

const pctGrowth = (current, previous) => {
  const c = Number(current || 0);
  const p = Number(previous || 0);
  if (p === 0) return c > 0 ? "+100%" : "0.0%";
  const diff = ((c - p) / p) * 100;
  return `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%`;
};

/**
 * makeReport aggregates data based on filtered orders, products, etc.
 */
function makeReport(name, {
  orders,
  allOrders = orders,
  products,
  categories,
  staff,
  counters,
  loginHistory,
  productsById,
  categoriesById,
  selectedCategory = "all",
}) {
  const confirmed = orders.filter((o) => o.status === "Confirmed" || orders.length === 0);
  const salesOrders = confirmed.length > 0 ? confirmed : orders;

  const productAgg = new Map();
  const categoryAgg = new Map();

  salesOrders.forEach((o) =>
    (o.items || []).forEach((i) => {
      const id = String(
        i.productId?._id || i.productId || productName(i, productsById)
      );
      const product = productsById?.get(id) || i.productId || {};
      const pName = productName(i, productsById);
      const category =
        product.categoryId?.name ||
        categoriesById?.get(
          String(product.categoryId?._id || product.categoryId)
        ) ||
        "Uncategorized";

      if (selectedCategory !== "all" && category.toLowerCase() !== selectedCategory.toLowerCase()) {
        return;
      }

      const qty = money(i.quantity);
      const revenue = money(i.price ?? i.sellingPrice) * qty;
      const cost = money(i.costPrice) * qty;

      const p = productAgg.get(id) || {
        product: pName,
        category,
        quantity: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
        orders: 0,
      };
      p.quantity += qty;
      p.revenue += revenue;
      p.cost += cost;
      p.profit += revenue - cost;
      p.orders += 1;
      productAgg.set(id, p);

      const c = categoryAgg.get(category) || {
        category,
        quantity: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
        orders: 0,
        products: new Set(),
      };
      c.quantity += qty;
      c.revenue += revenue;
      c.cost += cost;
      c.profit += revenue - cost;
      c.orders += 1;
      c.products.add(id);
      categoryAgg.set(category, c);
    })
  );

  const productsRows = [...productAgg.values()].map((p) => ({
    ...p,
    margin: p.revenue ? (p.profit / p.revenue) * 100 : 0,
  }));

  const categoryRows = [...categoryAgg.values()].map((c) => ({
    ...c,
    productsCount: c.products.size,
    margin: c.revenue ? (c.profit / c.revenue) * 100 : 0,
    topProduct:
      [...productsRows]
        .filter((p) => p.category === c.category)
        .sort((a, b) => b.revenue - a.revenue)[0]?.product || "-",
  }));

  const groupBy = (arr, key, maker) => {
    const map = new Map();
    arr.forEach((x) => {
      const k = maker(x);
      const v = map.get(k) || { [key]: k, orders: 0, revenue: 0, cost: 0, profit: 0 };
      v.orders++;
      v.revenue += money(x.totalAmount);
      const p = profitOf(x);
      v.profit += p;
      v.cost += money(x.totalAmount) - p;
      map.set(k, v);
    });
    return [...map.values()].map((item) => ({
      ...item,
      margin: item.revenue ? (item.profit / item.revenue) * 100 : 0,
      averageOrderValue: item.orders ? item.revenue / item.orders : 0,
    }));
  };

  const orderRows = (list) =>
    list.map((o) => ({
      orderId: o.invoiceNumber || o.billNumber || String(o._id).slice(-8),
      time: orderDate(o),
      status: o.status,
      counter: counterOf(o),
      staff: staffOf(o),
      payment: o.payment?.method || o.paymentMethod || "Cash",
      amount: money(o.totalAmount),
      cost: money(o.totalAmount) - profitOf(o),
      profit: profitOf(o),
      reason:
        o.timeline?.find(
          (t) =>
            /cancel/i.test(t.status || "") || /cancel/i.test(t.message || "")
        )?.message || "Not recorded",
      items: (o.items || [])
        .map((i) => `${productName(i, productsById)} x${i.quantity}`)
        .join(", "),
    }));

  // Daily map sorted chronologically
  const daily = new Map();
  salesOrders.forEach((o) => {
    const d = new Date(orderDate(o)).toLocaleDateString("en-CA");
    const r = daily.get(d) || { date: d, orders: 0, revenue: 0, cost: 0, profit: 0 };
    r.orders++;
    const rev = money(o.totalAmount);
    const prof = profitOf(o);
    r.revenue += rev;
    r.cost += rev - prof;
    r.profit += prof;
    daily.set(d, r);
  });

  const dailyRowsChronological = [...daily.values()]
    .map((d) => ({
      ...d,
      margin: d.revenue ? (d.profit / d.revenue) * 100 : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const dailyRowsTable = [...dailyRowsChronological].reverse();

  const rowsByCounter = groupBy(salesOrders, "counter", counterOf);
  const rowsByStaff = groupBy(salesOrders, "staff", staffOf);

  // COMPARISON REPORTS CALCULATIONS
  // 1. Today vs Yesterday
  const todayStr = new Date().toDateString();
  const yesterdayObj = new Date();
  yesterdayObj.setDate(yesterdayObj.getDate() - 1);
  const yesterdayStr = yesterdayObj.toDateString();

  const todayOrdersList = allOrders.filter(
    (o) => (o.status === "Confirmed" || o.status === "Completed") && new Date(orderDate(o)).toDateString() === todayStr
  );
  const yesterdayOrdersList = allOrders.filter(
    (o) => (o.status === "Confirmed" || o.status === "Completed") && new Date(orderDate(o)).toDateString() === yesterdayStr
  );

  const todayRev = todayOrdersList.reduce((s, o) => s + money(o.totalAmount), 0);
  const yesterdayRev = yesterdayOrdersList.reduce((s, o) => s + money(o.totalAmount), 0);
  const todayProfit = todayOrdersList.reduce((s, o) => s + profitOf(o), 0);
  const yesterdayProfit = yesterdayOrdersList.reduce((s, o) => s + profitOf(o), 0);
  const todayAov = todayOrdersList.length ? todayRev / todayOrdersList.length : 0;
  const yesterdayAov = yesterdayOrdersList.length ? yesterdayRev / yesterdayOrdersList.length : 0;
  const todayMargin = todayRev ? (todayProfit / todayRev) * 100 : 0;
  const yesterdayMargin = yesterdayRev ? (yesterdayProfit / yesterdayRev) * 100 : 0;

  const todayVsYesterdayRows = [
    {
      metric: "Total Revenue",
      today: todayRev,
      yesterday: yesterdayRev,
      diff: todayRev - yesterdayRev,
      growth: pctGrowth(todayRev, yesterdayRev),
      isCurrency: true,
    },
    {
      metric: "Total Orders",
      today: todayOrdersList.length,
      yesterday: yesterdayOrdersList.length,
      diff: todayOrdersList.length - yesterdayOrdersList.length,
      growth: pctGrowth(todayOrdersList.length, yesterdayOrdersList.length),
    },
    {
      metric: "Gross Profit",
      today: todayProfit,
      yesterday: yesterdayProfit,
      diff: todayProfit - yesterdayProfit,
      growth: pctGrowth(todayProfit, yesterdayProfit),
      isCurrency: true,
    },
    {
      metric: "Gross Margin",
      today: `${todayMargin.toFixed(1)}%`,
      yesterday: `${yesterdayMargin.toFixed(1)}%`,
      diff: `${(todayMargin - yesterdayMargin >= 0 ? "+" : "")}${(todayMargin - yesterdayMargin).toFixed(1)}%`,
      growth: "-",
    },
    {
      metric: "Average Order Value (AOV)",
      today: todayAov,
      yesterday: yesterdayAov,
      diff: todayAov - yesterdayAov,
      growth: pctGrowth(todayAov, yesterdayAov),
      isCurrency: true,
    },
  ];

  // 2. This Week vs Last Week
  const nowMs = Date.now();
  const dayMs = 86400000;
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  
  const weekComparisonRows = [6, 5, 4, 3, 2, 1, 0].map((daysAgo) => {
    const dThis = new Date(nowMs - daysAgo * dayMs);
    const dLast = new Date(nowMs - (daysAgo + 7) * dayMs);
    const dayName = dayNames[dThis.getDay()];
    const dateLabel = dThis.toLocaleDateString("en-IN", { month: "short", day: "numeric" });

    const ordersThis = allOrders.filter(
      (o) => o.status === "Confirmed" && new Date(orderDate(o)).toDateString() === dThis.toDateString()
    );
    const ordersLast = allOrders.filter(
      (o) => o.status === "Confirmed" && new Date(orderDate(o)).toDateString() === dLast.toDateString()
    );

    const revThis = ordersThis.reduce((s, o) => s + money(o.totalAmount), 0);
    const revLast = ordersLast.reduce((s, o) => s + money(o.totalAmount), 0);

    return {
      day: `${dayName} (${dateLabel})`,
      shortDay: dayName.slice(0, 3),
      thisWeekOrders: ordersThis.length,
      lastWeekOrders: ordersLast.length,
      thisWeekRevenue: revThis,
      lastWeekRevenue: revLast,
      growth: pctGrowth(revThis, revLast),
    };
  });

  // 3. This Month vs Last Month
  const nowDate = new Date();
  const currentYear = nowDate.getFullYear();
  const currentMonth = nowDate.getMonth();
  
  const lastMonthObj = new Date(currentYear, currentMonth - 1, 1);
  const lastMonthYear = lastMonthObj.getFullYear();
  const lastMonthIndex = lastMonthObj.getMonth();

  const thisMonthOrders = allOrders.filter((o) => {
    if (o.status !== "Confirmed") return false;
    const d = new Date(orderDate(o));
    return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
  });

  const lastMonthOrders = allOrders.filter((o) => {
    if (o.status !== "Confirmed") return false;
    const d = new Date(orderDate(o));
    return d.getFullYear() === lastMonthYear && d.getMonth() === lastMonthIndex;
  });

  const tmRev = thisMonthOrders.reduce((s, o) => s + money(o.totalAmount), 0);
  const lmRev = lastMonthOrders.reduce((s, o) => s + money(o.totalAmount), 0);
  const tmProfit = thisMonthOrders.reduce((s, o) => s + profitOf(o), 0);
  const lmProfit = lastMonthOrders.reduce((s, o) => s + profitOf(o), 0);
  const tmAov = thisMonthOrders.length ? tmRev / thisMonthOrders.length : 0;
  const lmAov = lastMonthOrders.length ? lmRev / lastMonthOrders.length : 0;
  const tmMargin = tmRev ? (tmProfit / tmRev) * 100 : 0;
  const lmMargin = lmRev ? (lmProfit / lmRev) * 100 : 0;

  const thisMonthVsLastMonthRows = [
    {
      metric: "Total Revenue",
      thisMonth: tmRev,
      lastMonth: lmRev,
      diff: tmRev - lmRev,
      growth: pctGrowth(tmRev, lmRev),
      isCurrency: true,
    },
    {
      metric: "Total Orders",
      thisMonth: thisMonthOrders.length,
      lastMonth: lastMonthOrders.length,
      diff: thisMonthOrders.length - lastMonthOrders.length,
      growth: pctGrowth(thisMonthOrders.length, lastMonthOrders.length),
    },
    {
      metric: "Gross Profit",
      thisMonth: tmProfit,
      lastMonth: lmProfit,
      diff: tmProfit - lmProfit,
      growth: pctGrowth(tmProfit, lmProfit),
      isCurrency: true,
    },
    {
      metric: "Gross Margin",
      thisMonth: `${tmMargin.toFixed(1)}%`,
      lastMonth: `${lmMargin.toFixed(1)}%`,
      diff: `${(tmMargin - lmMargin >= 0 ? "+" : "")}${(tmMargin - lmMargin).toFixed(1)}%`,
      growth: "-",
    },
    {
      metric: "Average Order Value (AOV)",
      thisMonth: tmAov,
      lastMonth: lmAov,
      diff: tmAov - lmAov,
      growth: pctGrowth(tmAov, lmAov),
      isCurrency: true,
    },
  ];

  // 4. YoY Growth (Monthly Breakdown)
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const yoyRows = monthNames.map((mName, mIdx) => {
    const curYearOrders = allOrders.filter((o) => {
      if (o.status !== "Confirmed") return false;
      const d = new Date(orderDate(o));
      return d.getFullYear() === currentYear && d.getMonth() === mIdx;
    });
    const priorYearOrders = allOrders.filter((o) => {
      if (o.status !== "Confirmed") return false;
      const d = new Date(orderDate(o));
      return d.getFullYear() === currentYear - 1 && d.getMonth() === mIdx;
    });

    const cRev = curYearOrders.reduce((s, o) => s + money(o.totalAmount), 0);
    const pRev = priorYearOrders.reduce((s, o) => s + money(o.totalAmount), 0);

    return {
      month: mName,
      currentYearRev: cRev,
      priorYearRev: pRev,
      currentYearOrders: curYearOrders.length,
      priorYearOrders: priorYearOrders.length,
      revenueGrowth: pctGrowth(cRev, pRev),
      ordersGrowth: pctGrowth(curYearOrders.length, priorYearOrders.length),
    };
  });

  // Working & Active Time calculation for staff
  const staffTimeMap = new Map();
  (loginHistory || []).forEach((h) => {
    const name = h.name || "Unknown";
    const existing = staffTimeMap.get(name) || {
      staff: name,
      role: h.role || "Staff",
      totalSessions: 0,
      totalDurationSeconds: 0,
      lastSeen: h.loginAt,
    };
    existing.totalSessions += 1;
    if (h.loginAt && h.logoutAt) {
      const dur = Math.max(0, (new Date(h.logoutAt) - new Date(h.loginAt)) / 1000);
      existing.totalDurationSeconds += dur;
    } else if (h.loginAt) {
      const dur = Math.max(0, (Date.now() - new Date(h.loginAt)) / 1000);
      existing.totalDurationSeconds += dur;
    }
    if (new Date(h.loginAt) > new Date(existing.lastSeen)) {
      existing.lastSeen = h.loginAt;
    }
    staffTimeMap.set(name, existing);
  });

  const staffWorkingTimeRows = staff.map((s) => {
    const historyInfo = staffTimeMap.get(s.name) || {
      staff: s.name,
      role: s.role || "Staff",
      totalSessions: 0,
      totalDurationSeconds: 0,
      lastSeen: s.lastLogin || s.lastSeen || "-",
    };
    return {
      staff: s.name,
      role: s.role || historyInfo.role,
      totalSessions: historyInfo.totalSessions,
      totalActiveTime: historyInfo.totalDurationSeconds,
      status: s.status || (s.isOnline ? "Online" : "Offline"),
      lastSeen: historyInfo.lastSeen,
    };
  });

  // Report fields mapper
  const fields = {
    // SALES & REVENUE
    "Product-wise Sales": [
      productsRows.sort((a, b) => b.revenue - a.revenue),
      [
        { key: "product", header: "Product" },
        { key: "category", header: "Category" },
        qtyCol("quantity", "Qty"),
        currencyCol("revenue", "Revenue"),
        currencyCol("cost", "Cost"),
        currencyCol("profit", "Profit"),
        { key: "margin", header: "Margin %", format: "percent", align: "right" },
      ],
    ],
    "Daily Sales": [
      dailyRowsTable,
      [
        { key: "date", header: "Date", format: "date" },
        { key: "orders", header: "Orders", align: "center" },
        currencyCol("revenue", "Revenue"),
        currencyCol("cost", "Cost"),
        currencyCol("profit", "Profit"),
        { key: "margin", header: "Margin", format: "percent", align: "right" },
      ],
    ],
    "Sales by Hour / Peak Hours": [
      Array.from({ length: 24 }, (_, h) => {
        const xs = salesOrders.filter(
          (o) => new Date(orderDate(o)).getHours() === h
        );
        const rev = xs.reduce((s, o) => s + money(o.totalAmount), 0);
        const prof = xs.reduce((s, o) => s + profitOf(o), 0);
        return {
          hour: `${String(h).padStart(2, "0")}:00`,
          orders: xs.length,
          revenue: rev,
          profit: prof,
          margin: rev ? (prof / rev) * 100 : 0,
        };
      }),
      [
        { key: "hour", header: "Hour", align: "center" },
        { key: "orders", header: "Orders", align: "center" },
        currencyCol("revenue", "Revenue"),
        currencyCol("profit", "Profit"),
      ],
    ],
    "Category Performance": [
      categoryRows.sort((a, b) => b.revenue - a.revenue),
      [
        { key: "category", header: "Category" },
        { key: "orders", header: "Orders", align: "center" },
        { key: "productsCount", header: "Active Products", align: "center" },
        currencyCol("revenue", "Revenue"),
        currencyCol("cost", "Cost"),
        currencyCol("profit", "Profit"),
        { key: "margin", header: "Margin %", format: "percent", align: "right" },
      ],
    ],
    "Counter Performance": [
      rowsByCounter.sort((a, b) => b.revenue - a.revenue),
      [
        { key: "counter", header: "Billing Counter" },
        { key: "orders", header: "Orders", align: "center" },
        currencyCol("revenue", "Revenue"),
        currencyCol("profit", "Profit"),
        currencyCol("averageOrderValue", "Avg Ticket Size"),
      ],
    ],
    "Staff Performance": [
      rowsByStaff.sort((a, b) => b.revenue - a.revenue),
      [
        { key: "staff", header: "Staff Member" },
        { key: "orders", header: "Orders", align: "center" },
        currencyCol("revenue", "Revenue"),
        currencyCol("profit", "Profit"),
        currencyCol("averageOrderValue", "Avg Ticket Size"),
      ],
    ],
    "Payment-wise Sales": [
      Object.entries(
        salesOrders.reduce((a, o) => {
          const k = o.payment?.method || o.paymentMethod || "Cash";
          a[k] = (a[k] || 0) + money(o.totalAmount);
          return a;
        }, {})
      ).map(([method, revenue]) => {
        const total = salesOrders.reduce((s, o) => s + money(o.totalAmount), 0);
        const count = salesOrders.filter(
          (o) => (o.payment?.method || o.paymentMethod || "Cash") === method
        ).length;
        return {
          method,
          orders: count,
          revenue,
          percentage: total ? (revenue / total) * 100 : 0,
        };
      }),
      [
        { key: "method", header: "Payment Method" },
        { key: "orders", header: "Transactions", align: "center" },
        currencyCol("revenue", "Revenue"),
        { key: "percentage", header: "Share %", format: "percent", align: "right" },
      ],
    ],
    "Top Selling Products": [
      [...productsRows].sort((a, b) => b.quantity - a.quantity).slice(0, 20),
      [
        { key: "product", header: "Product" },
        { key: "category", header: "Category" },
        qtyCol("quantity", "Units Sold"),
        currencyCol("revenue", "Revenue"),
        currencyCol("profit", "Profit"),
        { key: "margin", header: "Margin %", format: "percent", align: "right" },
      ],
    ],
    "Least Selling Products": [
      [...productsRows].sort((a, b) => a.quantity - b.quantity).slice(0, 20),
      [
        { key: "product", header: "Product" },
        { key: "category", header: "Category" },
        qtyCol("quantity", "Units Sold"),
        currencyCol("revenue", "Revenue"),
        { key: "margin", header: "Margin %", format: "percent", align: "right" },
      ],
    ],
    "Revenue Trend": [
      dailyRowsTable.slice(0, 30),
      [
        { key: "date", header: "Date", format: "date" },
        { key: "orders", header: "Orders", align: "center" },
        currencyCol("revenue", "Revenue"),
        currencyCol("profit", "Profit"),
        { key: "margin", header: "Margin %", format: "percent", align: "right" },
      ],
    ],

    // PROFIT & COST
    "Profit & Loss": [
      [
        {
          revenue: salesOrders.reduce((s, o) => s + money(o.totalAmount), 0),
          cost: salesOrders.reduce(
            (s, o) => s + money(o.totalAmount) - profitOf(o),
            0
          ),
          profit: salesOrders.reduce((s, o) => s + profitOf(o), 0),
          margin: salesOrders.reduce((s, o) => s + money(o.totalAmount), 0)
            ? (salesOrders.reduce((s, o) => s + profitOf(o), 0) /
                salesOrders.reduce((s, o) => s + money(o.totalAmount), 0)) *
              100
            : 0,
        },
      ],
      [
        { key: "revenue", header: "Total Revenue", format: "currency" },
        { key: "cost", header: "Total Cost of Goods", format: "currency" },
        { key: "profit", header: "Gross Profit", format: "currency" },
        { key: "margin", header: "Gross Margin", format: "percent", align: "right" },
      ],
    ],
    "Product Profitability": [
      productsRows.map((p) => ({
        ...p,
        avgProfitPerUnit: p.quantity ? p.profit / p.quantity : 0,
      })).sort((a, b) => b.profit - a.profit),
      [
        { key: "product", header: "Product Name" },
        { key: "category", header: "Category" },
        qtyCol("quantity", "Units Sold"),
        currencyCol("revenue", "Revenue"),
        currencyCol("cost", "Total Cost"),
        currencyCol("profit", "Net Profit"),
        currencyCol("avgProfitPerUnit", "Profit / Unit"),
        { key: "margin", header: "Margin %", format: "percent", align: "right" },
      ],
    ],
    "Category Profitability": [
      categoryRows.sort((a, b) => b.profit - a.profit),
      [
        { key: "category", header: "Category" },
        currencyCol("revenue", "Revenue"),
        currencyCol("cost", "Total Cost"),
        currencyCol("profit", "Net Profit"),
        { key: "margin", header: "Margin %", format: "percent", align: "right" },
      ],
    ],
    "Cost Analysis": [
      productsRows.map((p) => ({
        product: p.product,
        category: p.category,
        quantity: p.quantity,
        cost: p.cost,
        revenue: p.revenue,
        costRatio: p.revenue ? (p.cost / p.revenue) * 100 : 0,
      })).sort((a, b) => b.cost - a.cost),
      [
        { key: "product", header: "Product" },
        { key: "category", header: "Category" },
        qtyCol("quantity", "Units Sold"),
        currencyCol("cost", "Total Procurement Cost"),
        currencyCol("revenue", "Sales Revenue"),
        { key: "costRatio", header: "Cost Ratio %", format: "percent", align: "right" },
      ],
    ],
    "High Margin Products": [
      productsRows
        .filter((p) => p.margin >= 50)
        .sort((a, b) => b.margin - a.margin),
      [
        { key: "product", header: "Product" },
        { key: "category", header: "Category" },
        qtyCol("quantity", "Units Sold"),
        currencyCol("revenue", "Revenue"),
        currencyCol("profit", "Profit"),
        { key: "margin", header: "Margin %", format: "percent", align: "right" },
      ],
    ],
    "Dead Stock": [
      products
        .filter(
          (p) =>
            money(p.stock) > 0 &&
            !allOrders.some(
              (o) =>
                o.status === "Confirmed" &&
                new Date(orderDate(o)) >=
                  new Date(Date.now() - 30 * 86400000) &&
                (o.items || []).some(
                  (i) =>
                    String(i.productId?._id || i.productId) === String(p._id)
                )
            )
        )
        .map((p) => ({
          product: p.name,
          category:
            p.categoryId?.name ||
            categoriesById?.get(
              String(p.categoryId?._id || p.categoryId)
            ) ||
            "Uncategorized",
          stock: p.stock,
          valuation: money(p.stock) * money(p.costPrice),
          status: "No sales in 30+ days",
        })),
      [
        { key: "product", header: "Product" },
        { key: "category", header: "Category" },
        { key: "stock", header: "Stock on Hand", align: "right" },
        currencyCol("valuation", "Inventory Cost Value"),
        { key: "status", header: "Stock Status" },
      ],
    ],

    // ORDERS
    "All Orders": [
      orderRows(orders),
      [
        { key: "orderId", header: "Order ID" },
        { key: "time", header: "Date & Time", format: "datetime" },
        { key: "status", header: "Status" },
        { key: "counter", header: "Counter" },
        { key: "staff", header: "Staff" },
        { key: "payment", header: "Payment" },
        currencyCol("amount", "Total Amount"),
      ],
    ],
    "Pending Orders": [
      orderRows(
        orders.filter(
          (o) => o.status === "Pending" || o.status === "Processing"
        )
      ),
      [
        { key: "orderId", header: "Order ID" },
        { key: "time", header: "Created Time", format: "datetime" },
        { key: "status", header: "Status" },
        { key: "counter", header: "Counter" },
        currencyCol("amount", "Amount"),
        { key: "items", header: "Items" },
      ],
    ],
    "Cancelled Orders": [
      orderRows(orders.filter((o) => o.status === "Cancelled")),
      [
        { key: "orderId", header: "Order ID" },
        { key: "time", header: "Cancelled At", format: "datetime" },
        { key: "counter", header: "Counter" },
        { key: "staff", header: "Staff" },
        currencyCol("amount", "Amount"),
        { key: "reason", header: "Cancellation Reason" },
      ],
    ],
    "Order Status Summary": [
      Object.entries(
        orders.reduce((a, o) => {
          const s = o.status || "Unknown";
          if (!a[s]) a[s] = { count: 0, revenue: 0 };
          a[s].count += 1;
          a[s].revenue += money(o.totalAmount);
          return a;
        }, {})
      ).map(([status, item]) => ({
        status,
        count: item.count,
        revenue: item.revenue,
        percentage: orders.length ? (item.count / orders.length) * 100 : 0,
      })),
      [
        { key: "status", header: "Order Status" },
        { key: "count", header: "Orders Count", align: "center" },
        currencyCol("revenue", "Total Value"),
        { key: "percentage", header: "Share %", format: "percent", align: "right" },
      ],
    ],
    "Order Time Analysis": [
      salesOrders.map((o) => ({
        orderId: o.invoiceNumber || String(o._id).slice(-8),
        created: o.createdAt,
        confirmed: o.confirmedAt,
        seconds:
          o.confirmedAt && o.createdAt
            ? Math.max(0, (new Date(o.confirmedAt) - new Date(o.createdAt)) / 1000)
            : 0,
        staff: staffOf(o),
        counter: counterOf(o),
      })),
      [
        { key: "orderId", header: "Order ID" },
        { key: "created", header: "Created", format: "datetime" },
        { key: "confirmed", header: "Confirmed", format: "datetime" },
        { key: "seconds", header: "Turnaround (sec)", align: "right" },
        { key: "staff", header: "Processed By" },
        { key: "counter", header: "Counter" },
      ],
    ],

    // INVENTORY
    "Current Stock": [
      products.map((p) => ({
        product: p.name,
        category:
          p.categoryId?.name ||
          categoriesById?.get(
            String(p.categoryId?._id || p.categoryId)
          ) ||
          "Uncategorized",
        stock: money(p.stock),
        reserved: money(p.reservedStock),
        available: Math.max(0, money(p.stock) - money(p.reservedStock)),
        threshold: money(p.lowStockThreshold),
        status:
          money(p.stock) <= 0
            ? "Out of Stock"
            : money(p.stock) <= money(p.lowStockThreshold)
            ? "Low Stock"
            : "Available",
      })),
      [
        { key: "product", header: "Product" },
        { key: "category", header: "Category" },
        { key: "stock", header: "On Hand", align: "right" },
        { key: "reserved", header: "Reserved", align: "right" },
        { key: "available", header: "Available", align: "right" },
        { key: "threshold", header: "Reorder Alert", align: "right" },
        { key: "status", header: "Stock Status" },
      ],
    ],
    "Low Stock": [
      products
        .filter(
          (p) =>
            money(p.stock) > 0 && money(p.stock) <= money(p.lowStockThreshold)
        )
        .map((p) => ({
          product: p.name,
          category: p.categoryId?.name || "Uncategorized",
          stock: p.stock,
          threshold: p.lowStockThreshold,
          deficit: Math.max(0, money(p.lowStockThreshold) - money(p.stock)),
        })),
      [
        { key: "product", header: "Product" },
        { key: "category", header: "Category" },
        { key: "stock", header: "Current Stock", align: "right" },
        { key: "threshold", header: "Minimum Threshold", align: "right" },
        { key: "deficit", header: "Deficit Units", align: "right" },
      ],
    ],
    "Out of Stock": [
      products
        .filter((p) => money(p.stock) <= 0)
        .map((p) => ({
          product: p.name,
          category: p.categoryId?.name || "Uncategorized",
          stock: 0,
          reserved: p.reservedStock || 0,
          status: "Replenishment Required",
        })),
      [
        { key: "product", header: "Product" },
        { key: "category", header: "Category" },
        { key: "stock", header: "Stock Level", align: "right" },
        { key: "reserved", header: "Held in Queue", align: "right" },
        { key: "status", header: "Action Required" },
      ],
    ],
    "Stock Movement": [
      products.map((p) => {
        const sold = productAgg.get(String(p._id))?.quantity || 0;
        return {
          product: p.name,
          category: p.categoryId?.name || "Uncategorized",
          sold,
          stock: p.stock,
          netChange: sold > 10 ? "Fast Outflow" : sold > 0 ? "Active Outflow" : "Stable Stock",
        };
      }),
      [
        { key: "product", header: "Product" },
        { key: "category", header: "Category" },
        qtyCol("sold", "Sold in Period"),
        { key: "stock", header: "Current Stock", align: "right" },
        { key: "netChange", header: "Movement Speed" },
      ],
    ],
    "Stock Valuation": [
      products.map((p) => {
        const costVal = money(p.stock) * money(p.costPrice);
        const retailVal = money(p.stock) * money(p.sellingPrice ?? p.price);
        return {
          product: p.name,
          category: p.categoryId?.name || "Uncategorized",
          stock: p.stock,
          costValue: costVal,
          sellingValue: retailVal,
          potentialMargin: retailVal ? ((retailVal - costVal) / retailVal) * 100 : 0,
        };
      }),
      [
        { key: "product", header: "Product" },
        { key: "category", header: "Category" },
        { key: "stock", header: "Stock", align: "right" },
        currencyCol("costValue", "Cost Valuation"),
        currencyCol("sellingValue", "Retail Valuation"),
        { key: "potentialMargin", header: "Potential Margin", format: "percent", align: "right" },
      ],
    ],
    "Fast Moving Stock": [
      productsRows
        .map((r) => ({
          ...r,
          stock: money(
            productsById?.get(
              String(
                [...(productsById || [])].find(([, p]) => p.name === r.product)?.[0]
              )
            )?.stock
          ),
        }))
        .sort((a, b) => b.quantity - a.quantity),
      [
        { key: "product", header: "Product" },
        { key: "category", header: "Category" },
        qtyCol("quantity", "Units Sold"),
        { key: "stock", header: "Current Stock", align: "right" },
        currencyCol("revenue", "Revenue"),
      ],
    ],
    "Reserved Stock": [
      products
        .filter((p) => money(p.reservedStock) > 0)
        .map((p) => ({
          product: p.name,
          category: p.categoryId?.name || "Uncategorized",
          stock: p.stock,
          reserved: p.reservedStock,
          available: Math.max(0, money(p.stock) - money(p.reservedStock)),
          status: "Held in Cart/Queue",
        })),
      [
        { key: "product", header: "Product" },
        { key: "category", header: "Category" },
        { key: "stock", header: "Total On Hand", align: "right" },
        { key: "reserved", header: "Reserved Units", align: "right" },
        { key: "available", header: "Net Sellable", align: "right" },
        { key: "status", header: "Reservation State" },
      ],
    ],

    // STAFF
    "Staff Performance & Activity": [
      staff.map((s) => {
        const xs = salesOrders.filter((o) => staffOf(o).trim().toLowerCase() === s.name.trim().toLowerCase());
        const rev = xs.reduce((n, o) => n + money(o.totalAmount), 0);
        return {
          staff: s.name,
          status: s.status || (s.isOnline ? "Online" : "Offline"),
          orders: xs.length,
          revenue: rev,
          averageOrderValue: xs.length ? rev / xs.length : 0,
          averageConfirmSeconds: xs.length
            ? xs.reduce(
                (n, o) =>
                  n +
                  (o.confirmedAt && o.createdAt
                    ? (new Date(o.confirmedAt) - new Date(o.createdAt)) / 1000
                    : 0),
                0
              ) / xs.length
            : 0,
          lastActive: s.lastLogin || s.lastSeen,
        };
      }).sort((a, b) => b.revenue - a.revenue),
      [
        { key: "staff", header: "Staff Member" },
        { key: "status", header: "Live Status" },
        { key: "orders", header: "Orders Processed", align: "center" },
        currencyCol("revenue", "Revenue Generated"),
        currencyCol("averageOrderValue", "Avg Ticket Size"),
        {
          key: "averageConfirmSeconds",
          header: "Avg Speed (sec)",
          align: "right",
        },
        { key: "lastActive", header: "Last Active", format: "datetime" },
      ],
    ],
    "Staff Login History": [
      loginHistory.map((h) => ({
        staff: h.name,
        role: h.role,
        loginAt: h.loginAt,
        logoutAt: h.logoutAt,
        duration:
          h.loginAt && h.logoutAt
            ? Math.max(0, (new Date(h.logoutAt) - new Date(h.loginAt)) / 1000)
            : h.loginAt
            ? Math.max(0, (Date.now() - new Date(h.loginAt)) / 1000)
            : 0,
        ip: h.ip || "Local",
      })),
      [
        { key: "staff", header: "Employee" },
        { key: "role", header: "Role" },
        { key: "loginAt", header: "Session Start", format: "datetime" },
        { key: "logoutAt", header: "Session End", format: "datetime" },
        { key: "duration", header: "Duration", format: "duration", align: "right" },
        { key: "ip", header: "Network IP" },
      ],
    ],
    "Working & Active Time": [
      staffWorkingTimeRows.sort((a, b) => b.totalActiveTime - a.totalActiveTime),
      [
        { key: "staff", header: "Staff Member" },
        { key: "role", header: "Role" },
        { key: "totalSessions", header: "Total Shifts", align: "center" },
        { key: "totalActiveTime", header: "Total Working Time", format: "duration", align: "right" },
        { key: "status", header: "Current Status" },
        { key: "lastSeen", header: "Last Seen", format: "datetime" },
      ],
    ],

    // COMPARISON
    "Today vs Yesterday": [
      todayVsYesterdayRows,
      [
        { key: "metric", header: "Performance Metric" },
        { key: "today", header: "Today", align: "right" },
        { key: "yesterday", header: "Yesterday", align: "right" },
        { key: "diff", header: "Net Change", align: "right" },
        { key: "growth", header: "Growth Rate", align: "right" },
      ],
    ],
    "This Week vs Last Week": [
      weekComparisonRows,
      [
        { key: "day", header: "Day & Date" },
        currencyCol("thisWeekRevenue", "This Week Revenue"),
        currencyCol("lastWeekRevenue", "Last Week Revenue"),
        { key: "thisWeekOrders", header: "This Week Orders", align: "center" },
        { key: "lastWeekOrders", header: "Last Week Orders", align: "center" },
        { key: "growth", header: "Revenue Growth", align: "right" },
      ],
    ],
    "This Month vs Last Month": [
      thisMonthVsLastMonthRows,
      [
        { key: "metric", header: "Business Metric" },
        { key: "thisMonth", header: "This Month", align: "right" },
        { key: "lastMonth", header: "Last Month", align: "right" },
        { key: "diff", header: "Net Variance", align: "right" },
        { key: "growth", header: "Growth %", align: "right" },
      ],
    ],
    "YoY Growth": [
      yoyRows,
      [
        { key: "month", header: "Month" },
        currencyCol("currentYearRev", "Current Year Revenue"),
        currencyCol("priorYearRev", "Prior Year Revenue"),
        { key: "revenueGrowth", header: "Revenue Growth %", align: "right" },
        { key: "currentYearOrders", header: "Current Year Orders", align: "center" },
        { key: "priorYearOrders", header: "Prior Year Orders", align: "center" },
      ],
    ],
  };

  const [rows, columns] = fields[name] || [[], []];
  return {
    rows: Array.isArray(rows) ? rows : [rows],
    columns,
    dailyChronological: dailyRowsChronological,
    weekComparison: weekComparisonRows,
    todayVsYesterday: todayVsYesterdayRows,
    thisMonthVsLastMonth: thisMonthVsLastMonthRows,
    yoy: yoyRows,
  };
}

// Status & Margin badge styling helper
function renderStatusBadge(val, colKey) {
  if (colKey === "margin" || colKey === "potentialMargin" || colKey === "costRatio") {
    const num = Number(val || 0);
    if (num >= 35) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
          <TrendingUp size={12} className="text-emerald-600 dark:text-emerald-400" />
          {num.toFixed(1)}%
        </span>
      );
    }
    if (num >= 15) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
          {num.toFixed(1)}%
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
        {num.toFixed(1)}%
      </span>
    );
  }

  const str = String(val || "").trim().toLowerCase();
  if (["confirmed", "completed", "active", "online", "available", "stable stock"].includes(str)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
        <CheckCircle2 size={12} className="text-emerald-600 dark:text-emerald-400" />
        {val}
      </span>
    );
  }
  if (["pending", "processing", "low stock", "held in cart/queue", "active outflow"].includes(str)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
        <Clock size={12} className="text-amber-600 dark:text-amber-400" />
        {val}
      </span>
    );
  }
  if (["cancelled", "inactive", "offline", "out of stock", "no sales in 30+ days", "replenishment required", "disabled"].includes(str)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
        <XCircle size={12} className="text-rose-600 dark:text-rose-400" />
        {val}
      </span>
    );
  }

  // Handle Growth % column styling
  if (colKey === "growth" || colKey === "revenueGrowth") {
    const isPositive = String(val).startsWith("+");
    const isNegative = String(val).startsWith("-");
    if (isPositive) {
      return (
        <span className="inline-flex items-center gap-0.5 font-semibold text-emerald-600 dark:text-emerald-400">
          <ArrowUp size={12} />
          {val}
        </span>
      );
    }
    if (isNegative) {
      return (
        <span className="inline-flex items-center gap-0.5 font-semibold text-rose-600 dark:text-rose-400">
          <ArrowDown size={12} />
          {val}
        </span>
      );
    }
    return <span className="font-medium text-slate-500">{val}</span>;
  }

  return <span>{val ?? "-"}</span>;
}

export default function SalesReportPage() {
  const [data, setData] = useState({
    orders: [],
    products: [],
    categories: [],
    staff: [],
    counters: [],
    loginHistory: [],
  });

  // Category and Active Report Navigation
  const [activeCategory, setActiveCategory] = useState("sales");
  const [report, setReport] = useState("Product-wise Sales");
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  // Filter Bar State
  const [filters, setFilters] = useState({
    datePreset: "thisMonth",
    from: "",
    to: "",
    counter: "all",
    staff: "all",
    category: "all",
    payment: "all",
    status: "all",
    search: "",
  });

  // Table UX Controls
  const [sort, setSort] = useState({ key: "", direction: "asc" });
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [showChart, setShowChart] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  // Initialize date range for "thisMonth"
  useEffect(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const format = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };
    setFilters((prev) => ({
      ...prev,
      from: format(start),
      to: format(today),
    }));
  }, []);

  // Fetch Core Reports Data
  const fetchData = async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        api.get("/orders"),
        api.get("/products"),
        api.get("/categories"),
        api.get("/users/staff"),
        api.get("/counters"),
        api.get("/users/login-history"),
      ]);
      const keys = [
        "orders",
        "products",
        "categories",
        "staff",
        "counters",
        "loginHistory",
      ];
      setData((prev) =>
        Object.fromEntries(
          keys.map((k, i) => [
            k,
            results[i].status === "fulfilled"
              ? results[i].value.data || []
              : prev[k],
          ])
        )
      );
      setLastRefreshed(new Date());
    } catch {
      toast.error("Could not sync live reports data");
    } finally {
      setLoading(false);
    }
  };

  // Real-time Socket.IO Connection & Listeners
  useEffect(() => {
    fetchData();

    const handleNewOrder = (order) => {
      if (!order?._id) return;
      setData((prev) => {
        const exists = prev.orders.some((o) => o._id === order._id);
        const nextOrders = exists
          ? prev.orders.map((o) => (o._id === order._id ? order : o))
          : [order, ...prev.orders];
        return { ...prev, orders: nextOrders };
      });
      setLastRefreshed(new Date());
    };

    const handleOrderUpdate = (order) => {
      if (!order?._id) return;
      setData((prev) => ({
        ...prev,
        orders: prev.orders.map((o) => (o._id === order._id ? order : o)),
      }));
      setLastRefreshed(new Date());
    };

    const handleOrderDelete = (orderId) => {
      setData((prev) => ({
        ...prev,
        orders: prev.orders.filter((o) => o._id !== orderId),
      }));
      setLastRefreshed(new Date());
    };

    const handleStockUpdate = (product) => {
      if (product?._id) {
        setData((prev) => ({
          ...prev,
          products: prev.products.map((p) =>
            p._id === product._id ? { ...p, ...product } : p
          ),
        }));
      } else {
        api.get("/products").then((res) => {
          setData((prev) => ({ ...prev, products: res.data || [] }));
        }).catch(() => {});
      }
      setLastRefreshed(new Date());
    };

    const handleProductCreate = (product) => {
      if (product?._id) {
        setData((prev) => ({
          ...prev,
          products: [product, ...prev.products],
        }));
      }
    };

    const handleProductDelete = ({ _id }) => {
      if (_id) {
        setData((prev) => ({
          ...prev,
          products: prev.products.filter((p) => p._id !== _id),
        }));
      }
    };

    const handleCountersUpdate = () => {
      api.get("/counters").then((res) => {
        setData((prev) => ({ ...prev, counters: res.data || [] }));
      }).catch(() => {});
    };

    socket.on("newOrder", handleNewOrder);
    socket.on("orderCreated", handleNewOrder);
    socket.on("orderConfirmed", handleOrderUpdate);
    socket.on("orderCancelled", handleOrderUpdate);
    socket.on("orderReverted", handleOrderUpdate);
    socket.on("orderUpdated", handleOrderUpdate);
    socket.on("orderDeleted", handleOrderDelete);
    socket.on("ordersBulkDeleted", () => fetchData());
    socket.on("stockUpdated", handleStockUpdate);
    socket.on("productUpdated", handleStockUpdate);
    socket.on("stockRefilled", handleStockUpdate);
    socket.on("productCreated", handleProductCreate);
    socket.on("productDeleted", handleProductDelete);
    socket.on("countersUpdated", handleCountersUpdate);

    return () => {
      socket.off("newOrder", handleNewOrder);
      socket.off("orderCreated", handleNewOrder);
      socket.off("orderConfirmed", handleOrderUpdate);
      socket.off("orderCancelled", handleOrderUpdate);
      socket.off("orderReverted", handleOrderUpdate);
      socket.off("orderUpdated", handleOrderUpdate);
      socket.off("orderDeleted", handleOrderDelete);
      socket.off("ordersBulkDeleted");
      socket.off("stockUpdated", handleStockUpdate);
      socket.off("productUpdated", handleStockUpdate);
      socket.off("stockRefilled", handleStockUpdate);
      socket.off("productCreated", handleProductCreate);
      socket.off("productDeleted", handleProductDelete);
      socket.off("countersUpdated", handleCountersUpdate);
    };
  }, []);

  // Handle Date Preset Selection
  const handleDatePresetChange = (preset) => {
    const today = new Date();
    const format = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    let newFrom = "";
    let newTo = "";

    if (preset === "all") {
      newFrom = "";
      newTo = "";
    } else if (preset === "today") {
      const t = format(today);
      newFrom = t;
      newTo = t;
    } else if (preset === "yesterday") {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const str = format(y);
      newFrom = str;
      newTo = str;
    } else if (preset === "last7") {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      newFrom = format(start);
      newTo = format(today);
    } else if (preset === "thisMonth") {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      newFrom = format(start);
      newTo = format(today);
    } else if (preset === "last30") {
      const start = new Date(today);
      start.setDate(start.getDate() - 29);
      newFrom = format(start);
      newTo = format(today);
    }

    setFilters((prev) => ({
      ...prev,
      datePreset: preset,
      from: newFrom,
      to: newTo,
    }));
    setCurrentPage(1);
  };

  // Reset Filters to standard defaults
  const handleResetFilters = () => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const format = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    setFilters({
      datePreset: "thisMonth",
      from: format(start),
      to: format(today),
      counter: "all",
      staff: "all",
      category: "all",
      payment: "all",
      status: "all",
      search: "",
    });
    setCurrentPage(1);
    toast.success("Filters reset to default");
  };

  // Fast entity lookup maps
  const productsById = useMemo(
    () => new Map(data.products.map((p) => [String(p._id), p])),
    [data.products]
  );
  const categoriesById = useMemo(
    () => new Map(data.categories.map((c) => [String(c._id), c.name])),
    [data.categories]
  );

  // Filtered raw orders based on active filters
  const filteredOrders = useMemo(() => {
    return data.orders.filter((o) => {
      const d = new Date(orderDate(o));

      // 1. Date Range Filter
      if (filters.from) {
        const fromDate = new Date(`${filters.from}T00:00:00`);
        if (d < fromDate) return false;
      }
      if (filters.to) {
        const toDate = new Date(`${filters.to}T23:59:59`);
        if (d > toDate) return false;
      }

      // 2. Status Filter
      if (filters.status !== "all") {
        if ((o.status || "").trim().toLowerCase() !== filters.status.trim().toLowerCase()) {
          return false;
        }
      }

      // 3. Counter Filter
      if (filters.counter !== "all") {
        if (counterOf(o).trim().toLowerCase() !== filters.counter.trim().toLowerCase()) {
          return false;
        }
      }

      // 4. Staff Filter
      if (filters.staff !== "all") {
        if (staffOf(o).trim().toLowerCase() !== filters.staff.trim().toLowerCase()) {
          return false;
        }
      }

      // 5. Payment Filter
      if (filters.payment !== "all") {
        const method = (o.payment?.method || o.paymentMethod || "Cash").trim().toLowerCase();
        if (method !== filters.payment.trim().toLowerCase()) return false;
      }

      // 6. Category Filter (checks items in order)
      if (filters.category !== "all") {
        const targetCat = filters.category.trim().toLowerCase();
        const hasCategory = (o.items || []).some((i) => {
          const p = productsById.get(String(i.productId?._id || i.productId));
          const cat =
            p?.categoryId?.name ||
            categoriesById.get(String(p?.categoryId?._id || p?.categoryId)) ||
            "";
          return cat.trim().toLowerCase() === targetCat;
        });
        if (!hasCategory) return false;
      }

      // 7. Search Filter
      if (filters.search.trim()) {
        const term = filters.search.trim().toLowerCase();
        const idMatch = (o.invoiceNumber || o.billNumber || String(o._id)).toLowerCase().includes(term);
        const counterMatch = counterOf(o).toLowerCase().includes(term);
        const staffMatch = staffOf(o).toLowerCase().includes(term);
        const paymentMatch = (o.payment?.method || o.paymentMethod || "").toLowerCase().includes(term);
        const statusMatch = (o.status || "").toLowerCase().includes(term);
        const itemsMatch = (o.items || []).some((i) =>
          productName(i, productsById).toLowerCase().includes(term)
        );
        if (!idMatch && !counterMatch && !staffMatch && !paymentMatch && !statusMatch && !itemsMatch) {
          return false;
        }
      }

      return true;
    });
  }, [data.orders, filters, productsById, categoriesById]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return data.products.filter((p) => {
      if (filters.category !== "all") {
        const cat =
          p.categoryId?.name ||
          categoriesById.get(String(p.categoryId?._id || p.categoryId)) ||
          "";
        if (cat.trim().toLowerCase() !== filters.category.trim().toLowerCase()) return false;
      }
      if (filters.search.trim()) {
        const term = filters.search.trim().toLowerCase();
        if (!p.name?.toLowerCase().includes(term)) return false;
      }
      return true;
    });
  }, [data.products, filters, categoriesById]);

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return data.staff.filter((s) => {
      if (filters.staff !== "all" && s.name.trim().toLowerCase() !== filters.staff.trim().toLowerCase()) return false;
      if (filters.search.trim()) {
        const term = filters.search.trim().toLowerCase();
        if (!s.name?.toLowerCase().includes(term) && !s.email?.toLowerCase().includes(term)) {
          return false;
        }
      }
      return true;
    });
  }, [data.staff, filters]);

  // Filtered counters list
  const filteredCounters = useMemo(() => {
    return data.counters.filter((c) => {
      if (filters.counter !== "all" && c.name.trim().toLowerCase() !== filters.counter.trim().toLowerCase()) return false;
      if (filters.search.trim()) {
        const term = filters.search.trim().toLowerCase();
        if (!c.name?.toLowerCase().includes(term)) return false;
      }
      return true;
    });
  }, [data.counters, filters]);

  // Filtered login history
  const filteredLoginHistory = useMemo(() => {
    return data.loginHistory.filter((h) => {
      if (filters.staff !== "all" && h.name.trim().toLowerCase() !== filters.staff.trim().toLowerCase()) return false;
      if (filters.from && new Date(h.loginAt) < new Date(`${filters.from}T00:00:00`)) return false;
      if (filters.to && new Date(h.loginAt) > new Date(`${filters.to}T23:59:59`)) return false;
      if (filters.search.trim()) {
        const term = filters.search.trim().toLowerCase();
        if (!h.name?.toLowerCase().includes(term) && !h.ip?.includes(term)) return false;
      }
      return true;
    });
  }, [data.loginHistory, filters]);

  // Generate Current Report Data
  const {
    reportRows,
    reportColumns,
    dailyChronological,
    weekComparison,
  } = useMemo(() => {
    const res = makeReport(report, {
      orders: filteredOrders,
      allOrders: data.orders,
      products: filteredProducts,
      categories: data.categories,
      staff: filteredStaff,
      counters: filteredCounters,
      loginHistory: filteredLoginHistory,
      productsById,
      categoriesById,
      selectedCategory: filters.category,
    });

    let rows = res.rows;

    // Apply any additional text search match on the generated table columns
    if (filters.search.trim()) {
      const term = filters.search.trim().toLowerCase();
      rows = rows.filter((r) =>
        Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(term))
      );
    }

    // Apply sorting
    if (sort.key) {
      rows = [...rows].sort((a, b) => {
        const av = a[sort.key] ?? "";
        const bv = b[sort.key] ?? "";
        const cmp =
          typeof av === "number" && typeof bv === "number"
            ? av - bv
            : String(av).localeCompare(String(bv), undefined, {
                numeric: true,
                sensitivity: "base",
              });
        return sort.direction === "asc" ? cmp : -cmp;
      });
    }

    return {
      reportRows: rows,
      reportColumns: res.columns,
      dailyChronological: res.dailyChronological || [],
      weekComparison: res.weekComparison || [],
    };
  }, [
    report,
    filteredOrders,
    filteredProducts,
    filteredStaff,
    filteredCounters,
    filteredLoginHistory,
    data,
    productsById,
    categoriesById,
    filters,
    sort,
  ]);

  // Executive KPI Summary Cards
  const confirmedSubset = useMemo(
    () => filteredOrders.filter((o) => o.status === "Confirmed" || o.status === "Completed"),
    [filteredOrders]
  );
  const totalRevenue = useMemo(
    () => confirmedSubset.reduce((sum, o) => sum + money(o.totalAmount), 0),
    [confirmedSubset]
  );
  const totalProfit = useMemo(
    () => confirmedSubset.reduce((sum, o) => sum + profitOf(o), 0),
    [confirmedSubset]
  );
  const marginPercent = totalRevenue > 0
    ? ((totalProfit / totalRevenue) * 100).toFixed(1)
    : "0.0";
  const aov = confirmedSubset.length > 0 ? totalRevenue / confirmedSubset.length : 0;

  const kpis = [
    {
      label: "Total Revenue",
      value: formatINR(totalRevenue),
      sub: `${confirmedSubset.length} Confirmed Orders`,
      icon: IndianRupee,
    },
    {
      label: "Total Orders",
      value: filteredOrders.length,
      sub: `${confirmedSubset.length} Billed / Completed`,
      icon: ShoppingBag,
    },
    {
      label: "Gross Profit",
      value: formatINR(totalProfit),
      sub: `${marginPercent}% Net Return`,
      icon: TrendingUp,
    },
    {
      label: "Profit Margin",
      value: `${marginPercent}%`,
      sub: "Average Across Catalog",
      icon: Percent,
    },
    {
      label: "Average Order Value",
      value: formatINR(aov),
      sub: "Per Completed Ticket",
      icon: Activity,
    },
  ];

  // Active filters chips helper
  const activeFilterChips = useMemo(() => {
    const list = [];
    if (filters.search.trim()) {
      list.push({ key: "search", label: `Search: "${filters.search}"`, onRemove: () => setFilters((p) => ({ ...p, search: "" })) });
    }
    if (filters.datePreset !== "all" && filters.datePreset !== "thisMonth") {
      const presetLabels = {
        today: "Today",
        yesterday: "Yesterday",
        last7: "Last 7 Days",
        last30: "Last 30 Days",
        custom: `${filters.from} → ${filters.to}`,
      };
      list.push({
        key: "date",
        label: `Date: ${presetLabels[filters.datePreset] || filters.datePreset}`,
        onRemove: () => handleDatePresetChange("thisMonth"),
      });
    }
    if (filters.status !== "all") {
      list.push({ key: "status", label: `Status: ${filters.status}`, onRemove: () => setFilters((p) => ({ ...p, status: "all" })) });
    }
    if (filters.category !== "all") {
      list.push({ key: "category", label: `Category: ${filters.category}`, onRemove: () => setFilters((p) => ({ ...p, category: "all" })) });
    }
    if (filters.counter !== "all") {
      list.push({ key: "counter", label: `Counter: ${filters.counter}`, onRemove: () => setFilters((p) => ({ ...p, counter: "all" })) });
    }
    if (filters.staff !== "all") {
      list.push({ key: "staff", label: `Staff: ${filters.staff}`, onRemove: () => setFilters((p) => ({ ...p, staff: "all" })) });
    }
    if (filters.payment !== "all") {
      list.push({ key: "payment", label: `Payment: ${filters.payment}`, onRemove: () => setFilters((p) => ({ ...p, payment: "all" })) });
    }
    return list;
  }, [filters]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(reportRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return reportRows.slice(start, start + pageSize);
  }, [reportRows, currentPage, pageSize]);

  // Current category group
  const currentGroup = useMemo(() => {
    return REPORT_GROUPS.find((g) => g.id === activeCategory) || REPORT_GROUPS[0];
  }, [activeCategory]);

  // Handle Category selection
  const handleCategorySelect = (catId) => {
    setActiveCategory(catId);
    const grp = REPORT_GROUPS.find((g) => g.id === catId);
    if (grp && !grp.reports.includes(report)) {
      setReport(grp.reports[0]);
      setCurrentPage(1);
      setSort({ key: "", direction: "asc" });
    }
  };

  // Handle Sub-report selection
  const handleReportSelect = (repName) => {
    setReport(repName);
    setCurrentPage(1);
    setSort({ key: "", direction: "asc" });
  };

  // Export Payload Generator
  const getExportPayload = () => ({
    title: report,
    category: currentGroup.title,
    period:
      filters.from || filters.to
        ? `${filters.from || "Beginning"} to ${filters.to || "Current"}`
        : "All Historical Records",
    filters: Object.fromEntries(
      Object.entries(filters).filter(([_, v]) => v && v !== "all")
    ),
    kpis: kpis.map((k) => ({
      label: k.label,
      value: k.value,
    })),
    columns: reportColumns,
    data: reportRows,
  });

  const handleExportPDF = () => {
    setExportingPdf(true);
    try {
      exportReportToPDF(getExportPayload());
      toast.success("PDF exported successfully");
    } catch {
      toast.error("Failed to generate PDF");
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportExcel = () => {
    setExportingExcel(true);
    try {
      exportReportToExcel(getExportPayload());
      toast.success("Excel sheet downloaded");
    } catch {
      toast.error("Failed to generate Excel file");
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportCSV = () => {
    try {
      exportReportToCSV(getExportPayload());
      toast.success("CSV file downloaded");
    } catch {
      toast.error("Failed to export CSV");
    }
  };

  // Visual Chart Data Calculation (Only for reports where chart adds meaningful visual value)
  const chartData = useMemo(() => {
    if (!reportRows || reportRows.length === 0) return null;

    // 1. DAILY SALES / REVENUE TREND
    if (report === "Daily Sales" || report === "Revenue Trend") {
      const source = dailyChronological.length > 0 ? dailyChronological : reportRows;
      return {
        type: "area",
        data: source.slice(-15).map((r) => ({
          name: r.date
            ? new Date(r.date).toLocaleDateString("en-IN", {
                month: "short",
                day: "numeric",
              })
            : "-",
          Revenue: Number(r.revenue || 0),
          Profit: Number(r.profit || 0),
        })),
        keys: [
          { key: "Revenue", color: "#10B981", label: "Revenue" },
          { key: "Profit", color: "#6366F1", label: "Profit" },
        ],
      };
    }

    // 2. HOURLY SALES
    if (report === "Sales by Hour / Peak Hours") {
      return {
        type: "bar",
        data: reportRows
          .filter((r) => r.revenue > 0 || r.orders > 0)
          .slice(0, 16)
          .map((r) => ({
            name: r.hour,
            Revenue: Number(r.revenue || 0),
            Orders: Number(r.orders || 0),
          })),
        keys: [{ key: "Revenue", color: "#3B82F6", label: "Revenue" }],
      };
    }

    // 3. PRODUCT PROFITABILITY
    if (report === "Product Profitability") {
      return {
        type: "bar",
        data: reportRows.slice(0, 10).map((r) => ({
          name: r.product?.length > 15 ? r.product.slice(0, 13) + ".." : r.product,
          Revenue: Number(r.revenue || 0),
          Cost: Number(r.cost || 0),
          Profit: Number(r.profit || 0),
        })),
        keys: [
          { key: "Revenue", color: "#3B82F6", label: "Revenue" },
          { key: "Cost", color: "#F59E0B", label: "Cost" },
          { key: "Profit", color: "#10B981", label: "Profit" },
        ],
      };
    }

    // 4. CATEGORY PERFORMANCE / CATEGORY PROFITABILITY
    if (report === "Category Performance" || report === "Category Profitability") {
      return {
        type: "bar",
        data: reportRows.slice(0, 8).map((r) => ({
          name: r.category?.length > 14 ? r.category.slice(0, 12) + ".." : r.category,
          Revenue: Number(r.revenue || 0),
          Profit: Number(r.profit || 0),
        })),
        keys: [
          { key: "Revenue", color: "#10B981", label: "Revenue" },
          { key: "Profit", color: "#8B5CF6", label: "Profit" },
        ],
      };
    }

    // 5. PAYMENT-WISE SALES
    if (report === "Payment-wise Sales") {
      return {
        type: "pie",
        data: reportRows.map((r) => ({
          name: r.method,
          value: Number(r.revenue || 0),
        })),
      };
    }

    // 6. TOP SELLING PRODUCTS / LEAST SELLING PRODUCTS
    if (report === "Top Selling Products" || report === "Least Selling Products") {
      return {
        type: "bar",
        data: reportRows.slice(0, 10).map((r) => ({
          name: r.product?.length > 14 ? r.product.slice(0, 12) + ".." : r.product,
          Revenue: Number(r.revenue || 0),
          Units: Number(r.quantity || 0),
        })),
        keys: [{ key: "Revenue", color: "#3B82F6", label: "Revenue" }],
      };
    }

    // 7. ORDER STATUS SUMMARY
    if (report === "Order Status Summary") {
      return {
        type: "pie",
        data: reportRows.map((r) => ({
          name: r.status,
          value: Number(r.count || 0),
        })),
      };
    }

    // 8. COUNTER PERFORMANCE / STAFF PERFORMANCE
    if (report === "Counter Performance" || report === "Staff Performance") {
      return {
        type: "bar",
        data: reportRows.slice(0, 8).map((r) => ({
          name: r.counter || r.staff,
          Revenue: Number(r.revenue || 0),
          Orders: Number(r.orders || 0),
        })),
        keys: [
          { key: "Revenue", color: "#10B981", label: "Revenue" },
          { key: "Orders", color: "#F59E0B", label: "Orders" },
        ],
      };
    }

    // 9. STOCK VALUATION
    if (report === "Stock Valuation") {
      return {
        type: "bar",
        data: reportRows.slice(0, 10).map((r) => ({
          name: r.product?.length > 14 ? r.product.slice(0, 12) + ".." : r.product,
          "Cost Value": Number(r.costValue || 0),
          "Retail Value": Number(r.sellingValue || 0),
        })),
        keys: [
          { key: "Cost Value", color: "#F59E0B", label: "Cost Value" },
          { key: "Retail Value", color: "#10B981", label: "Retail Value" },
        ],
      };
    }

    // 10. COMPARISON REPORTS
    if (report === "Today vs Yesterday") {
      const revItem = reportRows.find((r) => r.metric === "Total Revenue");
      const profItem = reportRows.find((r) => r.metric === "Gross Profit");
      const aovItem = reportRows.find((r) => r.metric === "Average Order Value (AOV)");
      return {
        type: "bar",
        data: [
          { name: "Revenue", Today: Number(revItem?.today || 0), Yesterday: Number(revItem?.yesterday || 0) },
          { name: "Profit", Today: Number(profItem?.today || 0), Yesterday: Number(profItem?.yesterday || 0) },
          { name: "AOV", Today: Number(aovItem?.today || 0), Yesterday: Number(aovItem?.yesterday || 0) },
        ],
        keys: [
          { key: "Today", color: "#10B981", label: "Today" },
          { key: "Yesterday", color: "#64748B", label: "Yesterday" },
        ],
      };
    }

    if (report === "This Week vs Last Week") {
      return {
        type: "bar",
        data: weekComparison.map((w) => ({
          name: w.shortDay || w.day,
          "This Week": Number(w.thisWeekRevenue || 0),
          "Last Week": Number(w.lastWeekRevenue || 0),
        })),
        keys: [
          { key: "This Week", color: "#10B981", label: "This Week" },
          { key: "Last Week", color: "#64748B", label: "Last Week" },
        ],
      };
    }

    if (report === "This Month vs Last Month") {
      const revItem = reportRows.find((r) => r.metric === "Total Revenue");
      const profItem = reportRows.find((r) => r.metric === "Gross Profit");
      return {
        type: "bar",
        data: [
          { name: "Total Revenue", "This Month": Number(revItem?.thisMonth || 0), "Last Month": Number(revItem?.lastMonth || 0) },
          { name: "Gross Profit", "This Month": Number(profItem?.thisMonth || 0), "Last Month": Number(profItem?.lastMonth || 0) },
        ],
        keys: [
          { key: "This Month", color: "#10B981", label: "This Month" },
          { key: "Last Month", color: "#64748B", label: "Last Month" },
        ],
      };
    }

    if (report === "YoY Growth") {
      return {
        type: "bar",
        data: reportRows.map((r) => ({
          name: r.month,
          "Current Year": Number(r.currentYearRev || 0),
          "Prior Year": Number(r.priorYearRev || 0),
        })),
        keys: [
          { key: "Current Year", color: "#10B981", label: "Current Year" },
          { key: "Prior Year", color: "#94A3B8", label: "Prior Year" },
        ],
      };
    }

    // For all other detailed reports (e.g. All Orders, Pending, Cancelled, Stock reports, etc.), chart is omitted by default
    return null;
  }, [report, reportRows, dailyChronological, weekComparison]);

  const controlClass =
    "w-full h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs md:text-[13px] text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

  return (
    <div className="space-y-6 pb-12 font-sans text-slate-900 transition-colors dark:text-slate-100">
      {/* 1. CLEAN PAGE HEADER */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-[28px] font-bold tracking-tight text-slate-900 dark:text-white">
            Reports & Analytics
          </h1>
          <p className="mt-1 text-xs md:text-sm text-slate-500 dark:text-slate-400">
            Analyze sales, profit, inventory, orders and staff performance.
          </p>
        </div>

        {/* Clean Export Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportPDF}
            disabled={exportingPdf || loading || !reportRows.length}
            title="Export high-resolution PDF report"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 text-xs md:text-[13px] font-semibold text-white shadow-xs hover:bg-rose-700 active:scale-95 disabled:opacity-50 transition-all"
          >
            <FileText size={14} />
            <span>{exportingPdf ? "Generating..." : "Export PDF"}</span>
          </button>

          <button
            onClick={handleExportExcel}
            disabled={exportingExcel || loading || !reportRows.length}
            title="Download formatted Excel workbook"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs md:text-[13px] font-semibold text-white shadow-xs hover:bg-emerald-700 active:scale-95 disabled:opacity-50 transition-all"
          >
            <FileSpreadsheet size={14} />
            <span>Excel</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={loading || !reportRows.length}
            title="Download CSV data table"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 text-xs md:text-[13px] font-semibold text-white shadow-xs hover:bg-sky-700 active:scale-95 disabled:opacity-50 transition-all"
          >
            <Download size={14} />
            <span>CSV</span>
          </button>

          <button
            onClick={printReport}
            title="Print report"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 text-xs md:text-[13px] font-semibold text-slate-700 shadow-xs hover:bg-slate-50 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-all"
          >
            <Printer size={14} />
            <span>Print</span>
          </button>
        </div>
      </header>

      {/* 2. TOP REPORT CATEGORY NAVIGATION (REPLACES LEFT NAVIGATOR) */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-3 md:p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        {/* Primary Category Row - Responsive Wrapping with No Horizontal Scrollbar */}
        <div className="flex flex-wrap items-center gap-2">
          {REPORT_GROUPS.map((group) => {
            const isSelected = activeCategory === group.id;
            const Icon = group.icon;
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => handleCategorySelect(group.id)}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs md:text-sm font-semibold transition-all ${
                  isSelected
                    ? "bg-slate-900 text-white shadow-xs dark:bg-emerald-600 dark:text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
                }`}
              >
                <Icon size={15} />
                <span>{group.shortTitle || group.title}</span>
              </button>
            );
          })}
        </div>

        {/* Clean Secondary Navigation Row for Reports in Selected Category - Responsive Wrapping */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1 hidden sm:inline">
            Reports:
          </span>
          {currentGroup.reports.map((r) => {
            const isSelected = report === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => handleReportSelect(r)}
                className={`rounded-md px-3 py-1.5 text-xs md:text-[13px] font-medium transition-all ${
                  isSelected
                    ? "bg-emerald-50 text-emerald-800 font-semibold border border-emerald-300 shadow-2xs dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800"
                    : "border border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                }`}
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. EXECUTIVE KPI CARDS */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs transition-all hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs md:text-[13px] font-medium text-slate-500 dark:text-slate-400">
                  {kpi.label}
                </span>
                <Icon size={16} className="text-slate-400 dark:text-slate-500" />
              </div>
              <div className="mt-2">
                <div className="truncate text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {loading ? (
                    <div className="h-7 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                  ) : (
                    kpi.value
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">
                  {kpi.sub}
                </p>
              </div>
            </div>
          );
        })}
      </section>

      {/* 4. COMPACT UNIFIED FILTER BAR */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-sm md:text-base font-semibold text-slate-800 dark:text-slate-200">
              Filter Records
            </h3>
            {activeFilterChips.length > 0 && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                {activeFilterChips.length} active
              </span>
            )}
          </div>

          <button
            onClick={handleResetFilters}
            className="inline-flex items-center gap-1 text-xs md:text-[13px] font-medium text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 transition-colors"
          >
            <RotateCcw size={12} />
            <span>Reset Filters</span>
          </button>
        </div>

        {/* Filter Controls Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 items-end">
          {/* Date Range Preset */}
          <div>
            <label className="mb-1 block text-xs md:text-[13px] font-medium text-slate-600 dark:text-slate-400">
              Date Range
            </label>
            <select
              className={controlClass}
              value={filters.datePreset}
              onChange={(e) => handleDatePresetChange(e.target.value)}
            >
              <option value="thisMonth">This Month</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last7">Last 7 Days</option>
              <option value="last30">Last 30 Days</option>
              <option value="all">All Time</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Billing Counter */}
          <div>
            <label className="mb-1 block text-xs md:text-[13px] font-medium text-slate-600 dark:text-slate-400">
              Counter
            </label>
            <select
              className={controlClass}
              value={filters.counter}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, counter: e.target.value }));
                setCurrentPage(1);
              }}
            >
              <option value="all">All Counters</option>
              {[
                ...new Set([
                  ...data.counters.map((c) => c.name),
                  ...data.orders.map(counterOf),
                ]),
              ]
                .filter(Boolean)
                .map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
            </select>
          </div>

          {/* Staff Member */}
          <div>
            <label className="mb-1 block text-xs md:text-[13px] font-medium text-slate-600 dark:text-slate-400">
              Staff
            </label>
            <select
              className={controlClass}
              value={filters.staff}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, staff: e.target.value }));
                setCurrentPage(1);
              }}
            >
              <option value="all">All Staff</option>
              {[
                ...new Set([
                  ...data.staff.map((s) => s.name),
                  ...data.orders.map(staffOf),
                ]),
              ]
                .filter(Boolean)
                .map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
            </select>
          </div>

          {/* Category */}
          <div>
            <label className="mb-1 block text-xs md:text-[13px] font-medium text-slate-600 dark:text-slate-400">
              Category
            </label>
            <select
              className={controlClass}
              value={filters.category}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, category: e.target.value }));
                setCurrentPage(1);
              }}
            >
              <option value="all">All Categories</option>
              {data.categories.map((c) => (
                <option key={c._id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Method */}
          <div>
            <label className="mb-1 block text-xs md:text-[13px] font-medium text-slate-600 dark:text-slate-400">
              Payment Method
            </label>
            <select
              className={controlClass}
              value={filters.payment}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, payment: e.target.value }));
                setCurrentPage(1);
              }}
            >
              <option value="all">All Payment Methods</option>
              <option value="Cash">Cash</option>
              <option value="UPI">UPI</option>
              <option value="Card">Card</option>
              <option value="Online">Online</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="mb-1 block text-xs md:text-[13px] font-medium text-slate-600 dark:text-slate-400">
              Status
            </label>
            <select
              className={controlClass}
              value={filters.status}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, status: e.target.value }));
                setCurrentPage(1);
              }}
            >
              <option value="all">All Statuses</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Pending">Pending</option>
              <option value="Processing">Processing</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          {/* Search Term */}
          <div className="col-span-2 sm:col-span-1 lg:col-span-1">
            <label className="mb-1 block text-xs md:text-[13px] font-medium text-slate-600 dark:text-slate-400">
              Search
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                className={`${controlClass} pl-8 pr-7`}
                placeholder="Search..."
                value={filters.search}
                onChange={(e) => {
                  setFilters((prev) => ({ ...prev, search: e.target.value }));
                  setCurrentPage(1);
                }}
              />
              {filters.search && (
                <button
                  onClick={() => setFilters((prev) => ({ ...prev, search: "" }))}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Custom Date Pickers when Custom Range is active */}
        {filters.datePreset === "custom" && (
          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">From:</span>
              <input
                type="date"
                className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-900"
                value={filters.from}
                onChange={(e) => {
                  setFilters((prev) => ({ ...prev, from: e.target.value }));
                  setCurrentPage(1);
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">To:</span>
              <input
                type="date"
                className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-900"
                value={filters.to}
                onChange={(e) => {
                  setFilters((prev) => ({ ...prev, to: e.target.value }));
                  setCurrentPage(1);
                }}
              />
            </div>
          </div>
        )}

        {/* Active Filter Chips */}
        {activeFilterChips.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">
            <span className="text-xs font-medium text-slate-400 mr-1">Active:</span>
            {activeFilterChips.map((chip) => (
              <span
                key={chip.key}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                <span>{chip.label}</span>
                <button
                  onClick={chip.onRemove}
                  className="rounded-full p-0.5 text-slate-400 hover:text-rose-600"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 5. REPORT CONTENT SECTION: TITLE, DESCRIPTION, OPTIONAL CHART, DETAILED TABLE */}
      <div className="space-y-4">
        {/* Report Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200/80 pb-3 dark:border-slate-800">
          <div>
            <h2 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white">
              {report}
            </h2>
            <p className="mt-0.5 text-xs md:text-sm text-slate-500 dark:text-slate-400">
              {REPORT_DESCRIPTIONS[report] || "Detailed operational report and performance breakdown."}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto text-xs text-slate-500">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {loading ? "Loading..." : `${reportRows.length} records`}
            </span>
            {chartData && (
              <button
                onClick={() => setShowChart(!showChart)}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
              >
                <BarChart2 size={13} />
                <span>{showChart ? "Hide Chart" : "Show Chart"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Optional Visual Chart (Only rendered when chart adds meaningful visual value) */}
        {showChart && chartData && chartData.data && chartData.data.length > 0 && (
          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs md:text-[13px] font-semibold text-slate-700 dark:text-slate-300">
                Visual Analytics
              </h3>
            </div>
            <div className="h-[280px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                {chartData.type === "area" ? (
                  <AreaChart data={chartData.data} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366F1" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="name" fontSize={11} stroke="#94A3B8" />
                    <YAxis
                      fontSize={11}
                      stroke="#94A3B8"
                      tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                    />
                    <Tooltip
                      formatter={(value, name) => [formatINR(value), name]}
                      contentStyle={{
                        backgroundColor: "#0F172A",
                        borderColor: "#1E293B",
                        borderRadius: "8px",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "5px" }} />
                    <Area
                      type="monotone"
                      dataKey="Revenue"
                      stroke="#10B981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorRev)"
                    />
                    <Area
                      type="monotone"
                      dataKey="Profit"
                      stroke="#6366F1"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorProfit)"
                    />
                  </AreaChart>
                ) : chartData.type === "pie" ? (
                  <PieChart>
                    <Tooltip
                      formatter={(value) => [formatINR(value)]}
                      contentStyle={{
                        backgroundColor: "#0F172A",
                        borderColor: "#1E293B",
                        borderRadius: "8px",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Pie
                      data={chartData.data}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={45}
                      paddingAngle={3}
                    >
                      {chartData.data.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                ) : (
                  <BarChart data={chartData.data} margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis
                      dataKey="name"
                      fontSize={11}
                      stroke="#94A3B8"
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                      height={40}
                    />
                    <YAxis
                      fontSize={11}
                      stroke="#94A3B8"
                      tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        typeof value === "number" && name.toLowerCase().includes("revenue") || name.toLowerCase().includes("cost") || name.toLowerCase().includes("profit") || name.toLowerCase().includes("today") || name.toLowerCase().includes("yesterday") || name.toLowerCase().includes("month") || name.toLowerCase().includes("year")
                          ? formatINR(value)
                          : value,
                        name,
                      ]}
                      contentStyle={{
                        backgroundColor: "#0F172A",
                        borderColor: "#1E293B",
                        borderRadius: "8px",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "5px" }} />
                    {chartData.keys.map((k) => (
                      <Bar
                        key={k.key}
                        dataKey={k.key}
                        name={k.label || k.key}
                        fill={k.color}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={36}
                      />
                    ))}
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Detailed Data Table Section */}
        <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
          {/* Subheader: Section Title, Count & Page Size */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
            <h3 className="text-xs md:text-sm font-semibold text-slate-800 dark:text-slate-200">
              Detailed Data
            </h3>

            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-7 rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          {/* Professional Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[13px] md:text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs md:text-[13px] font-semibold uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <tr>
                  {reportColumns.map((c) => (
                    <th
                      key={c.key}
                      className={`whitespace-nowrap px-4 py-3 border-b border-slate-200 dark:border-slate-700 ${
                        c.align === "right"
                          ? "text-right"
                          : c.align === "center"
                          ? "text-center"
                          : "text-left"
                      }`}
                    >
                      <button
                        onClick={() =>
                          setSort((prev) => ({
                            key: c.key,
                            direction:
                              prev.key === c.key && prev.direction === "asc"
                                ? "desc"
                                : "asc",
                          }))
                        }
                        className="inline-flex items-center gap-1 font-semibold hover:text-emerald-600 transition-colors"
                      >
                        <span>{c.header}</span>
                        {sort.key === c.key ? (
                          sort.direction === "asc" ? (
                            <ArrowUp size={12} className="text-emerald-600" />
                          ) : (
                            <ArrowDown size={12} className="text-emerald-600" />
                          )
                        ) : (
                          <ArrowUpDown size={11} className="text-slate-400 opacity-60" />
                        )}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  Array.from({ length: 6 }).map((_, rIdx) => (
                    <tr key={rIdx}>
                      {reportColumns.map((c, cIdx) => (
                        <td key={cIdx} className="px-4 py-3.5">
                          <div className="h-4 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : paginatedRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={Math.max(1, reportColumns.length)}
                      className="px-4 py-16 text-center text-slate-400"
                    >
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                        <Search size={22} className="text-slate-400" />
                      </div>
                      <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                        No report records found
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Try adjusting your filters, date range, or clear the search query.
                      </p>
                      {activeFilterChips.length > 0 && (
                        <button
                          onClick={handleResetFilters}
                          className="mt-3 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
                        >
                          Reset Filters
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row, i) => (
                    <tr
                      key={`${report}-${i}`}
                      className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                    >
                      {reportColumns.map((c) => {
                        const val = row[c.key];
                        return (
                          <td
                            key={c.key}
                            className={`whitespace-nowrap px-4 py-3.5 text-slate-700 dark:text-slate-300 ${
                              c.align === "right"
                                ? "text-right font-medium"
                                : c.align === "center"
                                ? "text-center"
                                : "text-left"
                            }`}
                          >
                            {c.format === "currency" ? (
                              <span className="font-semibold text-slate-900 dark:text-white">
                                {formatINR(val)}
                              </span>
                            ) : c.format === "percent" ? (
                              renderStatusBadge(val, "margin")
                            ) : c.format === "datetime" ? (
                              formatISTDateTime(val)
                            ) : c.format === "date" ? (
                              formatISTDate(val)
                            ) : c.format === "duration" ? (
                              formatDuration(val)
                            ) : c.key === "status" ? (
                              renderStatusBadge(val, "status")
                            ) : c.key === "growth" || c.key === "revenueGrowth" ? (
                              renderStatusBadge(val, "growth")
                            ) : row.isCurrency && (c.key === "today" || c.key === "yesterday" || c.key === "diff" || c.key === "thisMonth" || c.key === "lastMonth") ? (
                              <span className="font-semibold text-slate-900 dark:text-white">
                                {formatINR(val)}
                              </span>
                            ) : (
                              val ?? "-"
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Clean Pagination Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white px-4 py-3 text-xs md:text-[13px] text-slate-500 dark:border-slate-800 dark:bg-slate-900">
            <div>
              Showing{" "}
              <span className="font-bold text-slate-700 dark:text-slate-200">
                {reportRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
              </span>{" "}
              to{" "}
              <span className="font-bold text-slate-700 dark:text-slate-200">
                {Math.min(currentPage * pageSize, reportRows.length)}
              </span>{" "}
              of{" "}
              <span className="font-bold text-slate-700 dark:text-slate-200">
                {reportRows.length}
              </span>{" "}
              entries
            </div>

            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <ChevronLeft size={16} />
              </button>

              <span className="px-2 font-medium">
                Page <span className="font-bold text-slate-800 dark:text-white">{currentPage}</span> of{" "}
                <span className="font-bold text-slate-800 dark:text-white">{totalPages}</span>
              </span>

              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
