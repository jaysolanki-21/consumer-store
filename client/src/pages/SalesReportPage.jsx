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
  RefreshCw,
  Search,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  BarChart2,
  PieChart as PieChartIcon,
  ShoppingBag,
  Package,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Layers,
  SlidersHorizontal,
  Check,
  Eye,
  AlertTriangle,
  Monitor,
  Tag,
  Info,
  Activity,
  Percent,
  X,
  AlertCircle,
  LayoutGrid,
  Table as TableIcon,
  RotateCcw,
  CreditCard,
  UserCheck,
  Store,
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

// Report Groups Definition with Icons and Color Accents
const REPORT_GROUPS = [
  {
    id: "sales",
    title: "Sales & Revenue",
    icon: TrendingUp,
    badgeColor: "emerald",
    reports: [
      "Product-wise Sales",
      "Confirmed Orders Details",
      "Daily Sales Summary",
      "Hourly Sales",
      "Category-wise Sales",
      "Counter-wise Sales",
      "Staff-wise Sales",
      "Payment-wise Sales",
      "Top Selling Products",
      "Least Selling Products",
      "Revenue Trend",
    ],
  },
  {
    id: "profit",
    title: "Profit & Cost",
    icon: IndianRupee,
    badgeColor: "indigo",
    reports: [
      "Profit & Loss Report",
      "Product Profitability",
      "Category Profitability",
      "Cost Analysis",
      "Dead Stock Products",
      "High Margin Products",
    ],
  },
  {
    id: "orders",
    title: "Orders Management",
    icon: ShoppingBag,
    badgeColor: "blue",
    reports: [
      "Pending Orders",
      "Cancelled Orders",
      "Order Status Summary",
      "Order Time Analysis",
      "Large Orders",
      "Repeat Items",
    ],
  },
  {
    id: "inventory",
    title: "Inventory & Stock",
    icon: Package,
    badgeColor: "amber",
    reports: [
      "Current Stock Report",
      "Low Stock Report",
      "Out of Stock",
      "Stock Movement",
      "Reserved Stock",
      "Stock Valuation",
      "Fast Moving Stock",
    ],
  },
  {
    id: "categories",
    title: "Categories Analytics",
    icon: Tag,
    badgeColor: "purple",
    reports: [
      "Category Performance",
      "Category-wise Orders",
      "Empty Categories",
      "Top Categories",
    ],
  },
  {
    id: "staff",
    title: "Staff & Counters",
    icon: Users,
    badgeColor: "teal",
    reports: [
      "Staff Performance",
      "Staff Activity Report",
      "Counter Performance",
      "Counter Downtime",
      "Staff Login History",
    ],
  },
];

const allReports = REPORT_GROUPS.flatMap((g) => g.reports);

// Vibrant Palette for Visual Charts
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
  "#84CC16", // Lime
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
  // If the user hasn't filtered to a specific status, general sales reports use confirmed orders
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

      // If category filter is active, only aggregate items from that category
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

  const productsRows = [...productAgg.values()];
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
      const v = map.get(k) || { [key]: k, orders: 0, revenue: 0, profit: 0 };
      v.orders++;
      v.revenue += money(x.totalAmount);
      v.profit += profitOf(x);
      map.set(k, v);
    });
    return [...map.values()];
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
    const r = daily.get(d) || { date: d, orders: 0, revenue: 0, profit: 0 };
    r.orders++;
    r.revenue += money(o.totalAmount);
    r.profit += profitOf(o);
    daily.set(d, r);
  });
  // Sort daily rows ascending (oldest to newest)
  const dailyRowsChronological = [...daily.values()].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  // For the table, display newest date on top
  const dailyRowsTable = [...dailyRowsChronological].reverse();

  const rowsByCounter = groupBy(salesOrders, "counter", counterOf);
  const rowsByStaff = groupBy(salesOrders, "staff", staffOf);

  const fields = {
    "Product-wise Sales": [
      productsRows.sort((a, b) => b.revenue - a.revenue),
      [
        { key: "product", header: "Product" },
        { key: "category", header: "Category" },
        qtyCol(),
        currencyCol("revenue", "Revenue"),
        currencyCol("cost", "Cost"),
        currencyCol("profit", "Profit"),
      ],
    ],
    "Confirmed Orders Details": [
      orderRows(salesOrders),
      [
        { key: "orderId", header: "Order ID" },
        { key: "time", header: "Time", format: "datetime" },
        { key: "counter", header: "Counter" },
        { key: "amount", header: "Amount", format: "currency" },
        { key: "staff", header: "Staff" },
        { key: "payment", header: "Payment" },
      ],
    ],
    "Daily Sales Summary": [
      dailyRowsTable,
      [
        { key: "date", header: "Date", format: "date" },
        { key: "orders", header: "Orders", align: "center" },
        currencyCol("revenue", "Revenue"),
        currencyCol("profit", "Profit"),
      ],
    ],
    "Hourly Sales": [
      Array.from({ length: 24 }, (_, h) => {
        const xs = salesOrders.filter(
          (o) => new Date(orderDate(o)).getHours() === h
        );
        return {
          hour: `${String(h).padStart(2, "0")}:00`,
          orders: xs.length,
          revenue: xs.reduce((s, o) => s + money(o.totalAmount), 0),
          profit: xs.reduce((s, o) => s + profitOf(o), 0),
        };
      }),
      [
        { key: "hour", header: "Hour", align: "center" },
        { key: "orders", header: "Orders", align: "center" },
        currencyCol("revenue", "Revenue"),
        currencyCol("profit", "Profit"),
      ],
    ],
    "Category-wise Sales": [
      categoryRows.sort((a, b) => b.revenue - a.revenue),
      [
        { key: "category", header: "Category" },
        qtyCol(),
        currencyCol("revenue", "Revenue"),
        currencyCol("cost", "Cost"),
        currencyCol("profit", "Profit"),
        { key: "topProduct", header: "Top Product" },
      ],
    ],
    "Counter-wise Sales": [
      rowsByCounter.sort((a, b) => b.revenue - a.revenue),
      [
        { key: "counter", header: "Counter" },
        { key: "orders", header: "Orders", align: "center" },
        currencyCol("revenue", "Revenue"),
        currencyCol("profit", "Profit"),
      ],
    ],
    "Staff-wise Sales": [
      rowsByStaff.sort((a, b) => b.revenue - a.revenue),
      [
        { key: "staff", header: "Staff" },
        { key: "orders", header: "Orders", align: "center" },
        currencyCol("revenue", "Revenue"),
        currencyCol("profit", "Profit"),
      ],
    ],
    "Payment-wise Sales": [
      Object.entries(
        salesOrders.reduce((a, o) => {
          const k = o.payment?.method || o.paymentMethod || "Cash";
          a[k] = (a[k] || 0) + money(o.totalAmount);
          return a;
        }, {})
      ).map(([method, revenue]) => ({
        method,
        revenue,
        percentage: salesOrders.reduce((s, o) => s + money(o.totalAmount), 0)
          ? (revenue /
              salesOrders.reduce((s, o) => s + money(o.totalAmount), 0)) *
            100
          : 0,
      })),
      [
        { key: "method", header: "Payment Method" },
        currencyCol("revenue", "Revenue"),
        { key: "percentage", header: "Share %", format: "percent", align: "right" },
      ],
    ],
    "Top Selling Products": [
      [...productsRows].sort((a, b) => b.quantity - a.quantity).slice(0, 20),
      [
        { key: "product", header: "Product" },
        { key: "category", header: "Category" },
        qtyCol(),
        currencyCol("revenue", "Revenue"),
        currencyCol("profit", "Profit"),
      ],
    ],
    "Least Selling Products": [
      [...productsRows].sort((a, b) => a.quantity - b.quantity).slice(0, 20),
      [
        { key: "product", header: "Product" },
        { key: "category", header: "Category" },
        qtyCol(),
        currencyCol("revenue", "Revenue"),
      ],
    ],
    "Revenue Trend": [
      dailyRowsTable.slice(0, 30),
      [
        { key: "date", header: "Date", format: "date" },
        { key: "orders", header: "Orders", align: "center" },
        currencyCol("revenue", "Revenue"),
        currencyCol("profit", "Profit"),
      ],
    ],
    "Profit & Loss Report": [
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
        { key: "cost", header: "Total Cost", format: "currency" },
        { key: "profit", header: "Net Profit", format: "currency" },
        { key: "margin", header: "Net Margin", format: "percent" },
      ],
    ],
    // COMPREHENSIVE PRODUCT PROFITABILITY REPORT
    "Product Profitability": [
      productsRows.map((p) => ({
        ...p,
        margin: p.revenue ? (p.profit / p.revenue) * 100 : 0,
        avgProfitPerUnit: p.quantity ? p.profit / p.quantity : 0,
      })).sort((a, b) => b.profit - a.profit),
      [
        { key: "product", header: "Product Name" },
        { key: "category", header: "Category" },
        qtyCol("quantity", "Units Sold"),
        currencyCol("revenue", "Revenue (INR)"),
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
        currencyCol("profit", "Profit"),
        { key: "margin", header: "Margin", format: "percent", align: "right" },
      ],
    ],
    "Cost Analysis": [
      [
        {
          totalCost: salesOrders.reduce(
            (s, o) => s + money(o.totalAmount) - profitOf(o),
            0
          ),
          averageOrderCost: salesOrders.length
            ? salesOrders.reduce(
                (s, o) => s + money(o.totalAmount) - profitOf(o),
                0
              ) / salesOrders.length
            : 0,
          products: productsRows.length,
        },
      ],
      [
        currencyCol("totalCost", "Total Cost"),
        currencyCol("averageOrderCost", "Average Cost / Order"),
        { key: "products", header: "Products Sold", align: "center" },
      ],
    ],
    "Dead Stock Products": [
      products
        .filter(
          (p) =>
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
          lastSold: "No sale in last 30 days",
        })),
      [
        { key: "product", header: "Product" },
        { key: "category", header: "Category" },
        { key: "stock", header: "Stock Available", align: "right" },
        { key: "lastSold", header: "Status" },
      ],
    ],
    "High Margin Products": [
      productsRows
        .map((p) => ({
          ...p,
          margin: p.revenue ? (p.profit / p.revenue) * 100 : 0,
        }))
        .filter((p) => p.margin >= 50)
        .sort((a, b) => b.margin - a.margin),
      [
        { key: "product", header: "Product" },
        { key: "category", header: "Category" },
        currencyCol("revenue", "Revenue"),
        currencyCol("profit", "Profit"),
        { key: "margin", header: "Margin", format: "percent", align: "right" },
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
        { key: "amount", header: "Amount", format: "currency" },
      ],
    ],
    "Cancelled Orders": [
      orderRows(orders.filter((o) => o.status === "Cancelled")),
      [
        { key: "orderId", header: "Order ID" },
        { key: "time", header: "Time", format: "datetime" },
        { key: "counter", header: "Counter" },
        { key: "amount", header: "Amount", format: "currency" },
        { key: "reason", header: "Cancellation Reason" },
      ],
    ],
    "Order Status Summary": [
      Object.entries(
        orders.reduce((a, o) => {
          a[o.status] = (a[o.status] || 0) + 1;
          return a;
        }, {})
      ).map(([status, count]) => ({
        status,
        count,
        percentage: orders.length ? (count / orders.length) * 100 : 0,
      })),
      [
        { key: "status", header: "Order Status" },
        { key: "count", header: "Orders Count", align: "center" },
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
      })),
      [
        { key: "orderId", header: "Order ID" },
        { key: "created", header: "Created", format: "datetime" },
        { key: "confirmed", header: "Confirmed", format: "datetime" },
        { key: "seconds", header: "Confirmation Time (sec)", align: "right" },
        { key: "staff", header: "Processed By" },
      ],
    ],
    "Large Orders": [
      orderRows(salesOrders.filter((o) => money(o.totalAmount) >= 1000)),
      [
        { key: "orderId", header: "Order ID" },
        { key: "time", header: "Time", format: "datetime" },
        { key: "counter", header: "Counter" },
        { key: "staff", header: "Staff" },
        { key: "amount", header: "Amount", format: "currency" },
      ],
    ],
    "Repeat Items": [
      productsRows.filter((p) => p.orders > 1).sort((a, b) => b.orders - a.orders),
      [
        { key: "product", header: "Product" },
        { key: "orders", header: "Order Frequency", align: "center" },
        qtyCol(),
        currencyCol("revenue", "Revenue"),
      ],
    ],
    "Current Stock Report": [
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
      })),
      [
        { key: "product", header: "Product" },
        { key: "category", header: "Category" },
        { key: "stock", header: "On Hand", align: "right" },
        { key: "reserved", header: "Reserved", align: "right" },
        { key: "available", header: "Available", align: "right" },
        { key: "threshold", header: "Alert Threshold", align: "right" },
      ],
    ],
    "Low Stock Report": [
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
        })),
      [
        { key: "product", header: "Product" },
        { key: "category", header: "Category" },
        { key: "stock", header: "Current Stock", align: "right" },
        { key: "threshold", header: "Low Stock Alert", align: "right" },
      ],
    ],
    "Out of Stock": [
      products
        .filter((p) => money(p.stock) <= 0)
        .map((p) => ({
          product: p.name,
          category: p.categoryId?.name || "Uncategorized",
          reserved: p.reservedStock || 0,
        })),
      [
        { key: "product", header: "Product" },
        { key: "category", header: "Category" },
        { key: "reserved", header: "Reserved Units", align: "right" },
      ],
    ],
    "Stock Movement": [
      products.map((p) => ({
        product: p.name,
        openingStock: "Tracked in POS",
        added: "Active Supply",
        sold: productAgg.get(String(p._id))?.quantity || 0,
        stock: p.stock,
        netChange: (productAgg.get(String(p._id))?.quantity || 0) > 0 ? "Outgoing" : "Stable",
      })),
      [
        { key: "product", header: "Product" },
        { key: "sold", header: "Sold in Period", align: "right" },
        { key: "stock", header: "Current Stock", align: "right" },
        { key: "netChange", header: "Movement Status" },
      ],
    ],
    "Reserved Stock": [
      products
        .filter((p) => money(p.reservedStock) > 0)
        .map((p) => ({
          product: p.name,
          stock: p.stock,
          reserved: p.reservedStock,
          available: Math.max(0, money(p.stock) - money(p.reservedStock)),
        })),
      [
        { key: "product", header: "Product" },
        { key: "stock", header: "Total On Hand", align: "right" },
        { key: "reserved", header: "Held in Cart/Queue", align: "right" },
        { key: "available", header: "Net Sellable", align: "right" },
      ],
    ],
    "Stock Valuation": [
      products.map((p) => ({
        product: p.name,
        stock: p.stock,
        costValue: money(p.stock) * money(p.costPrice),
        sellingValue:
          money(p.stock) * money(p.sellingPrice ?? p.price),
      })),
      [
        { key: "product", header: "Product" },
        { key: "stock", header: "Stock", align: "right" },
        currencyCol("costValue", "Inventory Cost Value"),
        currencyCol("sellingValue", "Retail Value"),
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
        { key: "quantity", header: "Units Sold", align: "right" },
        { key: "stock", header: "Current Stock", align: "right" },
        currencyCol("revenue", "Revenue"),
      ],
    ],
    "Category Performance": [
      categoryRows.sort((a, b) => b.revenue - a.revenue),
      [
        { key: "category", header: "Category" },
        { key: "orders", header: "Transactions", align: "center" },
        { key: "productsCount", header: "Products Active", align: "center" },
        currencyCol("revenue", "Revenue"),
        currencyCol("profit", "Profit"),
      ],
    ],
    "Category-wise Orders": [
      categoryRows.sort((a, b) => b.orders - a.orders),
      [
        { key: "category", header: "Category" },
        { key: "orders", header: "Order Lines", align: "center" },
        qtyCol(),
        currencyCol("revenue", "Revenue"),
      ],
    ],
    "Empty Categories": [
      categories
        .filter(
          (c) =>
            !products.some(
              (p) =>
                String(p.categoryId?._id || p.categoryId) === String(c._id)
            )
        )
        .map((c) => ({
          category: c.name,
          created: c.createdAt,
        })),
      [
        { key: "category", header: "Category" },
        { key: "created", header: "Created Date", format: "date" },
      ],
    ],
    "Top Categories": [
      [...categoryRows].sort((a, b) => b.revenue - a.revenue),
      [
        { key: "category", header: "Category" },
        { key: "orders", header: "Transactions", align: "center" },
        currencyCol("revenue", "Revenue"),
        currencyCol("profit", "Profit"),
      ],
    ],
    "Staff Performance": [
      staff.map((s) => {
        const xs = salesOrders.filter((o) => staffOf(o).trim().toLowerCase() === s.name.trim().toLowerCase());
        return {
          staff: s.name,
          orders: xs.length,
          revenue: xs.reduce((n, o) => n + money(o.totalAmount), 0),
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
        };
      }).sort((a, b) => b.revenue - a.revenue),
      [
        { key: "staff", header: "Staff Member" },
        { key: "orders", header: "Orders Processed", align: "center" },
        currencyCol("revenue", "Revenue Generated"),
        {
          key: "averageConfirmSeconds",
          header: "Avg Confirm Speed (sec)",
          align: "right",
        },
      ],
    ],
    "Staff Activity Report": [
      staff.map((s) => ({
        staff: s.name,
        status: s.status || (s.isOnline ? "Online" : "Offline"),
        lastLogin: s.lastLogin,
        ordersToday: salesOrders.filter(
          (o) =>
            staffOf(o).trim().toLowerCase() === s.name.trim().toLowerCase() &&
            new Date(orderDate(o)).toDateString() === new Date().toDateString()
        ).length,
      })),
      [
        { key: "staff", header: "Staff Member" },
        { key: "status", header: "Live Status" },
        { key: "lastLogin", header: "Last Active", format: "datetime" },
        { key: "ordersToday", header: "Orders Completed Today", align: "center" },
      ],
    ],
    "Counter Performance": [
      counters.map((c) => {
        const xs = salesOrders.filter((o) => counterOf(o).trim().toLowerCase() === c.name.trim().toLowerCase());
        const revenue = xs.reduce((n, o) => n + money(o.totalAmount), 0);
        return {
          counter: c.name,
          orders: xs.length,
          revenue,
          averageOrderValue: xs.length ? revenue / xs.length : 0,
          status: c.isActive === false ? "Inactive" : "Active",
        };
      }).sort((a, b) => b.revenue - a.revenue),
      [
        { key: "counter", header: "POS Billing Counter" },
        { key: "status", header: "Status" },
        { key: "orders", header: "Orders Billed", align: "center" },
        currencyCol("revenue", "Counter Revenue"),
        currencyCol("averageOrderValue", "Avg Ticket Size"),
      ],
    ],
    "Counter Downtime": [
      counters.map((c) => ({
        counter: c.name,
        status: c.isActive === false ? "Inactive" : "Active",
        lastUpdated: c.updatedAt,
        orders: salesOrders.filter((o) => counterOf(o).trim().toLowerCase() === c.name.trim().toLowerCase()).length,
        downtime: c.isActive === false ? "Service Paused" : "Active & Operational",
      })),
      [
        { key: "counter", header: "Billing Counter" },
        { key: "status", header: "System Status" },
        { key: "lastUpdated", header: "Last Updated", format: "date" },
        { key: "orders", header: "Billed Volume", align: "center" },
        { key: "downtime", header: "Operational State" },
      ],
    ],
    "Staff Login History": [
      loginHistory.map((h) => ({
        staff: h.name,
        role: h.role,
        loginAt: h.loginAt,
        logoutAt: h.logoutAt,
        ip: h.ip,
      })),
      [
        { key: "staff", header: "Employee" },
        { key: "role", header: "Role" },
        { key: "loginAt", header: "Session Start", format: "datetime" },
        { key: "logoutAt", header: "Session End", format: "datetime" },
        { key: "ip", header: "Network IP" },
      ],
    ],
  };

  const [rows, columns] = fields[name] || [[], []];
  return {
    rows: Array.isArray(rows) ? rows : [rows],
    columns,
    dailyChronological: dailyRowsChronological,
  };
}

// Status & Margin badge styling helper
function renderStatusBadge(val, colKey) {
  if (colKey === "margin") {
    const num = Number(val || 0);
    if (num >= 35) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
          <TrendingUp size={11} className="text-emerald-600" />
          {num.toFixed(1)}%
        </span>
      );
    }
    if (num >= 15) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800 dark:bg-blue-950/80 dark:text-blue-300">
          {num.toFixed(1)}%
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
        {num.toFixed(1)}%
      </span>
    );
  }

  const str = String(val || "").trim().toLowerCase();
  if (["confirmed", "active", "online", "operational", "available"].includes(str)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
        <CheckCircle2 size={11} className="text-emerald-600 dark:text-emerald-400" />
        {val}
      </span>
    );
  }
  if (["pending", "processing", "low stock", "held in cart/queue"].includes(str)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
        <Clock size={11} className="text-amber-600 dark:text-amber-400" />
        {val}
      </span>
    );
  }
  if (["cancelled", "inactive", "offline", "out of stock", "no sale in last 30 days"].includes(str)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-semibold text-rose-800 dark:bg-rose-950/80 dark:text-rose-300">
        <XCircle size={11} className="text-rose-600 dark:text-rose-400" />
        {val}
      </span>
    );
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
  const [report, setReport] = useState("Product Profitability");
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  // Filters State
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    status: "all",
    category: "all",
    counter: "all",
    staff: "all",
    payment: "all",
    search: "",
    min: "",
    max: "",
  });
  const [datePreset, setDatePreset] = useState("all");

  // UX & View Controls
  const [sort, setSort] = useState({ key: "", direction: "asc" });
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [reportSearch, setReportSearch] = useState("");
  const [selectedGroupFilter, setSelectedGroupFilter] = useState("all");
  const [expandedGroups, setExpandedGroups] = useState({
    sales: true,
    profit: true,
    orders: true,
    inventory: true,
    categories: true,
    staff: true,
  });
  const [mobileReportDrawerOpen, setMobileReportDrawerOpen] = useState(false);
  const [showChart, setShowChart] = useState(true);
  const [viewMode, setViewMode] = useState("table");
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  // Fetch core data from backend
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

  useEffect(() => {
    fetchData();
  }, []);

  // Quick Date Preset Handler
  const handleDatePreset = (preset) => {
    setDatePreset(preset);
    const today = new Date();
    const format = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    if (preset === "all") {
      setFilters((prev) => ({ ...prev, from: "", to: "" }));
    } else if (preset === "today") {
      const t = format(today);
      setFilters((prev) => ({ ...prev, from: t, to: t }));
    } else if (preset === "yesterday") {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const str = format(y);
      setFilters((prev) => ({ ...prev, from: str, to: str }));
    } else if (preset === "last7") {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      setFilters((prev) => ({ ...prev, from: format(start), to: format(today) }));
    } else if (preset === "thisMonth") {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      setFilters((prev) => ({ ...prev, from: format(start), to: format(today) }));
    } else if (preset === "last30") {
      const start = new Date(today);
      start.setDate(start.getDate() - 29);
      setFilters((prev) => ({ ...prev, from: format(start), to: format(today) }));
    }
    setCurrentPage(1);
  };

  // Maps for fast product and category lookups
  const productsById = useMemo(
    () => new Map(data.products.map((p) => [String(p._id), p])),
    [data.products]
  );
  const categoriesById = useMemo(
    () => new Map(data.categories.map((c) => [String(c._id), c.name])),
    [data.categories]
  );

  /**
   * PROPER PIPELINE: Filter raw orders and products FIRST by all active filters
   * (Case-insensitive & whitespace trimmed)
   */
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

      // 3. Counter Filter (case-insensitive & trimmed)
      if (filters.counter !== "all") {
        const cOrder = counterOf(o).trim().toLowerCase();
        const cFilter = filters.counter.trim().toLowerCase();
        if (cOrder !== cFilter) return false;
      }

      // 4. Staff Filter (case-insensitive & trimmed)
      if (filters.staff !== "all") {
        const sOrder = staffOf(o).trim().toLowerCase();
        const sFilter = filters.staff.trim().toLowerCase();
        if (sOrder !== sFilter) return false;
      }

      // 5. Payment Method Filter (case-insensitive & trimmed)
      if (filters.payment !== "all") {
        const method = (o.payment?.method || o.paymentMethod || "Cash").trim().toLowerCase();
        const pFilter = filters.payment.trim().toLowerCase();
        if (method !== pFilter) return false;
      }

      // 6. Min and Max Amount Filter
      const amt = money(o.totalAmount);
      if (filters.min !== "" && amt < Number(filters.min)) return false;
      if (filters.max !== "" && amt > Number(filters.max)) return false;

      // 7. Category Filter (checks items inside order)
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

      // 8. Search Term Filter (checks ID, items, staff, counter, payment)
      if (filters.search.trim()) {
        const term = filters.search.trim().toLowerCase();
        const idMatch = (o.invoiceNumber || o.billNumber || String(o._id)).toLowerCase().includes(term);
        const counterMatch = counterOf(o).toLowerCase().includes(term);
        const staffMatch = staffOf(o).toLowerCase().includes(term);
        const paymentMatch = (o.payment?.method || o.paymentMethod || "").toLowerCase().includes(term);
        const statusMatch = (o.status || "").toLowerCase().includes(term);
        const amountMatch = String(o.totalAmount || "").includes(term);
        const itemsMatch = (o.items || []).some((i) =>
          productName(i, productsById).toLowerCase().includes(term)
        );

        if (!idMatch && !counterMatch && !staffMatch && !paymentMatch && !statusMatch && !amountMatch && !itemsMatch) {
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
      if (filters.min !== "") {
        const val = money(p.stock);
        if (val < Number(filters.min)) return false;
      }
      if (filters.max !== "") {
        const val = money(p.stock);
        if (val > Number(filters.max)) return false;
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

  // Generate Report data using properly filtered subsets
  const { reportRows, reportColumns, dailyChronological } = useMemo(() => {
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

  // Executive KPI summary calculations
  const confirmedSubset = useMemo(
    () => filteredOrders.filter((o) => o.status === "Confirmed"),
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
  const marginPercent = totalRevenue
    ? ((totalProfit / totalRevenue) * 100).toFixed(1)
    : "0.0";
  const aov = confirmedSubset.length ? totalRevenue / confirmedSubset.length : 0;

  const kpis = [
    {
      label: "Filtered Revenue",
      value: formatINR(totalRevenue),
      raw: totalRevenue,
      format: "currency",
      sub: `${confirmedSubset.length} Confirmed Orders`,
      icon: IndianRupee,
      color: "emerald",
    },
    {
      label: "Net Profit",
      value: formatINR(totalProfit),
      raw: totalProfit,
      format: "currency",
      sub: `${marginPercent}% Gross Margin`,
      icon: TrendingUp,
      color: "indigo",
    },
    {
      label: "Order Volume",
      value: filteredOrders.length,
      sub: `${data.orders.length} Total in DB`,
      icon: ShoppingBag,
      color: "blue",
    },
    {
      label: "Average Order (AOV)",
      value: formatINR(aov),
      sub: "Per Completed Ticket",
      icon: Activity,
      color: "amber",
    },
    {
      label: "Matching Records",
      value: reportRows.length,
      sub: `${report}`,
      icon: FileText,
      color: "purple",
    },
  ];

  // Active Filter Items for Smart Tags / Chips Bar
  const activeChips = useMemo(() => {
    const list = [];
    if (filters.search.trim()) {
      list.push({ key: "search", icon: Search, label: `Search: "${filters.search}"`, onRemove: () => setFilters((p) => ({ ...p, search: "" })) });
    }
    if (filters.from || filters.to) {
      list.push({
        key: "date",
        icon: Calendar,
        label: `Period: ${filters.from || "Beginning"} → ${filters.to || "Today"}`,
        onRemove: () => {
          setFilters((p) => ({ ...p, from: "", to: "" }));
          setDatePreset("all");
        },
      });
    }
    if (filters.status !== "all") {
      list.push({ key: "status", icon: CheckCircle2, label: `Status: ${filters.status}`, onRemove: () => setFilters((p) => ({ ...p, status: "all" })) });
    }
    if (filters.category !== "all") {
      list.push({ key: "category", icon: Tag, label: `Category: ${filters.category}`, onRemove: () => setFilters((p) => ({ ...p, category: "all" })) });
    }
    if (filters.counter !== "all") {
      list.push({ key: "counter", icon: Monitor, label: `Counter: ${filters.counter}`, onRemove: () => setFilters((p) => ({ ...p, counter: "all" })) });
    }
    if (filters.staff !== "all") {
      list.push({ key: "staff", icon: Users, label: `Staff: ${filters.staff}`, onRemove: () => setFilters((p) => ({ ...p, staff: "all" })) });
    }
    if (filters.payment !== "all") {
      list.push({ key: "payment", icon: CreditCard, label: `Payment: ${filters.payment}`, onRemove: () => setFilters((p) => ({ ...p, payment: "all" })) });
    }
    if (filters.min !== "") {
      list.push({ key: "min", icon: IndianRupee, label: `Min: ₹${filters.min}`, onRemove: () => setFilters((p) => ({ ...p, min: "" })) });
    }
    if (filters.max !== "") {
      list.push({ key: "max", icon: IndianRupee, label: `Max: ₹${filters.max}`, onRemove: () => setFilters((p) => ({ ...p, max: "" })) });
    }
    return list;
  }, [filters]);

  const clearAllFilters = () => {
    setFilters({
      from: "",
      to: "",
      status: "all",
      category: "all",
      counter: "all",
      staff: "all",
      payment: "all",
      search: "",
      min: "",
      max: "",
    });
    setDatePreset("all");
    setCurrentPage(1);
    toast.success("All filters reset");
  };

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(reportRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return reportRows.slice(start, start + pageSize);
  }, [reportRows, currentPage, pageSize]);

  // Active Category title for export
  const activeGroupTitle = useMemo(() => {
    return (
      REPORT_GROUPS.find((g) => g.reports.includes(report))?.title ||
      "Business Intelligence"
    );
  }, [report]);

  const filterSummary = Object.fromEntries(
    Object.entries(filters).filter(([_, v]) => v && v !== "all")
  );

  const getExportPayload = () => ({
    title: report,
    category: activeGroupTitle,
    period:
      filters.from || filters.to
        ? `${filters.from || "Earliest"} to ${filters.to || "Current"}`
        : "All Historical Time",
    filters: filterSummary,
    kpis: kpis.map((k) => ({
      label: k.label,
      value: k.value,
      format: k.format,
    })),
    columns: reportColumns,
    data: reportRows,
  });

  const handleExportPDF = () => {
    setExportingPdf(true);
    try {
      exportReportToPDF(getExportPayload());
      toast.success("Professional PDF exported");
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

  // Visual Chart Data calculation with CHRONOLOGICAL DATES & MULTI-METRIC SUPPORT
  const chartData = useMemo(() => {
    if (!reportRows || reportRows.length === 0) return null;

    // 1. PRODUCT PROFITABILITY & HIGH MARGIN PRODUCTS CHART
    if (report === "Product Profitability" || report === "High Margin Products") {
      const validRows = reportRows.filter(
        (r) => Number(r.revenue || 0) > 0 || Number(r.profit || 0) !== 0 || Number(r.cost || 0) > 0
      );
      const itemsToChart = (validRows.length > 0 ? validRows : reportRows).slice(0, 10);

      return {
        type: "bar",
        data: itemsToChart.map((r) => ({
          name: r.product?.length > 15 ? r.product.slice(0, 13) + ".." : (r.product || "Product"),
          Revenue: Number(r.revenue || 0),
          Cost: Number(r.cost || 0),
          Profit: Number(r.profit || 0),
          Margin: Number(r.margin || 0).toFixed(1),
        })),
        keys: [
          { key: "Revenue", color: "#3B82F6", label: "Revenue" },
          { key: "Cost", color: "#F59E0B", label: "Cost" },
          { key: "Profit", color: "#10B981", label: "Net Profit" },
        ],
      };
    }

    // 2. DAILY SALES / REVENUE TREND (CHRONOLOGICAL)
    if (report === "Daily Sales Summary" || report === "Revenue Trend") {
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
          Revenue: r.revenue,
          Profit: r.profit,
        })),
        keys: [
          { key: "Revenue", color: "#10B981", label: "Revenue" },
          { key: "Profit", color: "#6366F1", label: "Profit" },
        ],
      };
    }

    // 3. HOURLY SALES
    if (report === "Hourly Sales") {
      return {
        type: "bar",
        data: reportRows
          .filter((r) => r.revenue > 0 || r.orders > 0)
          .slice(0, 16)
          .map((r) => ({
            name: r.hour,
            Revenue: r.revenue,
            Orders: r.orders,
          })),
        keys: [{ key: "Revenue", color: "#3B82F6", label: "Revenue" }],
      };
    }

    // 4. PAYMENT-WISE SALES
    if (report === "Payment-wise Sales") {
      return {
        type: "pie",
        data: reportRows.map((r) => ({
          name: r.method,
          value: r.revenue,
        })),
      };
    }

    // 5. CATEGORY-WISE SALES / PROFITABILITY
    if (
      report === "Category-wise Sales" ||
      report === "Top Categories" ||
      report === "Category Performance" ||
      report === "Category Profitability"
    ) {
      return {
        type: "bar",
        data: reportRows.slice(0, 8).map((r) => ({
          name:
            r.category?.length > 14
              ? r.category.slice(0, 12) + ".."
              : r.category,
          Revenue: r.revenue,
          Profit: r.profit,
        })),
        keys: [
          { key: "Revenue", color: "#10B981", label: "Revenue" },
          { key: "Profit", color: "#8B5CF6", label: "Profit" },
        ],
      };
    }

    // 6. TOP PRODUCTS / REPEAT ITEMS / PRODUCT SALES
    if (
      report === "Product-wise Sales" ||
      report === "Top Selling Products" ||
      report === "Fast Moving Stock" ||
      report === "Repeat Items"
    ) {
      return {
        type: "bar",
        data: reportRows.slice(0, 8).map((r) => ({
          name:
            r.product?.length > 14 ? r.product.slice(0, 12) + ".." : r.product,
          Revenue: r.revenue || 0,
          Profit: r.profit || 0,
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
          value: r.count,
        })),
      };
    }

    // 8. STAFF & COUNTER PERFORMANCE
    if (report === "Staff Performance" || report === "Counter Performance") {
      return {
        type: "bar",
        data: reportRows.slice(0, 8).map((r) => ({
          name: r.staff || r.counter,
          Revenue: r.revenue || 0,
          Orders: r.orders || 0,
        })),
        keys: [
          { key: "Revenue", color: "#10B981", label: "Revenue" },
          { key: "Orders", color: "#F59E0B", label: "Orders" },
        ],
      };
    }

    return null;
  }, [report, reportRows, dailyChronological]);

  // Sidebar filtered groups based on search & category filter
  const visibleGroups = useMemo(() => {
    return REPORT_GROUPS.filter((g) => {
      if (selectedGroupFilter !== "all" && g.id !== selectedGroupFilter) {
        return false;
      }
      return true;
    }).map((g) => {
      let filteredReportsList = g.reports;
      if (reportSearch.trim()) {
        const term = reportSearch.toLowerCase().trim();
        filteredReportsList = filteredReportsList.filter((r) =>
          r.toLowerCase().includes(term)
        );
      }
      return {
        ...g,
        reports: filteredReportsList,
      };
    }).filter((g) => g.reports.length > 0);
  }, [reportSearch, selectedGroupFilter]);

  const controlClass =
    "w-full h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

  return (
    <div className="space-y-6 pb-12 font-sans text-slate-900 transition-colors dark:text-slate-100">
      {/* 1. TOP HEADER & CONTROLS */}
      <header className="rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-sm backdrop-blur-md md:p-6 dark:border-slate-800/80 dark:bg-slate-900/90">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              <Sparkles size={14} />
              <span>Admin Analytics & Intelligence</span>
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-slate-400 font-normal">Realtime Sync Active</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl dark:text-white">
              Sales & Business Reports
            </h1>
            <p className="text-xs text-slate-500 md:text-sm dark:text-slate-400">
              {allReports.length} multidimensional dynamic reports across Revenue, Profitability, Inventory, Staff & POS Counters
            </p>
          </div>

          {/* Action Buttons: Refresh, PDF, Excel, CSV, Print */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={fetchData}
              disabled={loading}
              title="Refresh live data from database"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-95 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <RefreshCw size={13} className={loading ? "animate-spin text-emerald-600" : ""} />
              <span>Sync</span>
            </button>

            <button
              onClick={handleExportPDF}
              disabled={exportingPdf || loading || !reportRows.length}
              title="Export high-resolution A4 business report in PDF"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-rose-600 to-rose-700 px-3.5 text-xs font-semibold text-white shadow-sm transition-all hover:from-rose-700 hover:to-rose-800 active:scale-95 disabled:opacity-50"
            >
              <FileText size={13} />
              <span>{exportingPdf ? "Generating..." : "Export PDF"}</span>
            </button>

            <button
              onClick={handleExportExcel}
              disabled={exportingExcel || loading || !reportRows.length}
              title="Download formatted Excel workbook with summary sheet"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
            >
              <FileSpreadsheet size={13} />
              <span className="hidden sm:inline">Excel</span>
            </button>

            <button
              onClick={handleExportCSV}
              disabled={loading || !reportRows.length}
              title="Download UTF-8 CSV data table"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-sky-600 px-3 text-xs font-semibold text-white shadow-sm transition-all hover:bg-sky-700 active:scale-95 disabled:opacity-50"
            >
              <Download size={13} />
              <span className="hidden sm:inline">CSV</span>
            </button>

            <button
              onClick={printReport}
              title="Direct clean print view"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Printer size={13} />
              <span className="hidden md:inline">Print</span>
            </button>
          </div>
        </div>

        {/* Quick Date Presets Bar */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3.5 dark:border-slate-800/80">
          <span className="flex items-center gap-1 text-xs font-medium text-slate-400 mr-1">
            <Calendar size={13} />
            <span>Preset:</span>
          </span>
          {[
            { id: "all", label: "All Time" },
            { id: "today", label: "Today" },
            { id: "yesterday", label: "Yesterday" },
            { id: "last7", label: "Last 7 Days" },
            { id: "thisMonth", label: "This Month" },
            { id: "last30", label: "Last 30 Days" },
          ].map((preset) => (
            <button
              key={preset.id}
              onClick={() => handleDatePreset(preset.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                datePreset === preset.id
                  ? "bg-emerald-600 text-white shadow-sm font-semibold"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              {preset.label}
            </button>
          ))}
          <div className="ml-auto text-[11px] text-slate-400">
            Last synced: {lastRefreshed.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </div>
        </div>
      </header>

      {/* 2. DYNAMIC EXECUTIVE KPI SUMMARY CARDS */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {kpi.label}
                </span>
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    kpi.color === "emerald"
                      ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-400"
                      : kpi.color === "indigo"
                      ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-950/80 dark:text-indigo-400"
                      : kpi.color === "blue"
                      ? "bg-blue-100 text-blue-600 dark:bg-blue-950/80 dark:text-blue-400"
                      : kpi.color === "amber"
                      ? "bg-amber-100 text-amber-600 dark:bg-amber-950/80 dark:text-amber-400"
                      : "bg-purple-100 text-purple-600 dark:bg-purple-950/80 dark:text-purple-400"
                  }`}
                >
                  <Icon size={16} />
                </div>
              </div>
              <div className="mt-2">
                <div className="truncate text-lg font-bold text-slate-900 md:text-xl dark:text-white">
                  {loading ? (
                    <div className="h-6 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                  ) : (
                    kpi.value
                  )}
                </div>
                <p className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-500">
                  {kpi.sub}
                </p>
              </div>
            </div>
          );
        })}
      </section>

      {/* 3. SMART ACTIVE FILTERS DISPLAY BAR (PROMINENT TAGS CHIPS) */}
      {activeChips.length > 0 && (
        <div className="rounded-xl border border-emerald-300/80 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 p-3.5 shadow-xs dark:border-emerald-800/60 dark:from-emerald-950/30 dark:via-slate-900 dark:to-emerald-950/30">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 dark:text-emerald-300">
                <SlidersHorizontal size={14} className="text-emerald-600 dark:text-emerald-400" />
                <span>Active Filters:</span>
              </span>

              {activeChips.map((chip) => {
                const ChipIcon = chip.icon || Tag;
                return (
                  <span
                    key={chip.key}
                    className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-white px-3 py-1 text-xs font-semibold text-emerald-900 shadow-2xs dark:border-emerald-700 dark:bg-slate-900 dark:text-emerald-200 transition-all hover:shadow-xs"
                  >
                    <ChipIcon size={12} className="text-emerald-600 dark:text-emerald-400" />
                    <span>{chip.label}</span>
                    <button
                      onClick={chip.onRemove}
                      title="Clear this filter"
                      className="ml-1 rounded-full p-0.5 text-slate-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-950 dark:hover:text-rose-400 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </span>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                {reportRows.length} matching rows found
              </span>
              <button
                onClick={clearAllFilters}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-xs font-bold text-rose-600 shadow-2xs hover:bg-rose-50 dark:border-rose-900 dark:bg-slate-900 dark:text-rose-400 dark:hover:bg-rose-950/60 transition-all"
              >
                <RotateCcw size={12} />
                <span>Reset All</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. MOBILE REPORT PICKER BAR (< LG) */}
      <div className="block lg:hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold text-slate-400 uppercase">Active:</span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 truncate">
              {report}
            </span>
          </div>
          <button
            onClick={() => setMobileReportDrawerOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300"
          >
            <Layers size={13} />
            <span>Switch Report</span>
          </button>
        </div>
      </div>

      {/* MOBILE REPORT DRAWER MODAL */}
      {mobileReportDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-2 sm:p-4 backdrop-blur-sm lg:hidden">
          <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Select Business Report ({allReports.length})
                </h3>
              </div>
              <button
                onClick={() => setMobileReportDrawerOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={16} />
              </button>
            </div>

            <div className="my-3 relative">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search report by name..."
                value={reportSearch}
                onChange={(e) => setReportSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 py-1.5 pl-8 pr-3 text-xs dark:border-slate-700 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              {visibleGroups.map((group) => (
                <div key={group.id} className="space-y-1">
                  <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold text-slate-400 uppercase">
                    <group.icon size={12} />
                    <span>{group.title}</span>
                  </div>
                  {group.reports.map((r) => (
                    <button
                      key={r}
                      onClick={() => {
                        setReport(r);
                        setSort({ key: "", direction: "asc" });
                        setCurrentPage(1);
                        setMobileReportDrawerOpen(false);
                      }}
                      className={`w-full rounded-lg px-3 py-2 text-left text-xs transition-colors flex items-center justify-between ${
                        report === r
                          ? "bg-emerald-600 font-bold text-white shadow-sm"
                          : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                      }`}
                    >
                      <span>{r}</span>
                      {report === r && <Check size={14} />}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. MAIN WORKSPACE: ULTRA-PREMIUM STICKY SIDEBAR + DYNAMIC CONTENT */}
      <div className="grid gap-6 lg:grid-cols-[290px_minmax(0,1fr)] items-start">
        {/* DESKTOP STICKY SIDEBAR WITH PROFESSIONAL HOVER ANIMATIONS */}
        <aside className="hidden lg:flex sticky top-20 self-start w-[290px] h-[calc(100vh-6rem)] flex-col rounded-2xl border border-slate-200/90 bg-white/95 p-3.5 shadow-md backdrop-blur-md dark:border-slate-800/90 dark:bg-slate-900/95 overflow-hidden">
          {/* Header & Report Count */}
          <div className="mb-2.5 flex items-center justify-between px-1">
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400 flex items-center gap-1">
              <Layers size={13} className="text-emerald-600" />
              <span>Report Navigator</span>
            </span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              {allReports.length} Available
            </span>
          </div>

          {/* Search Input for Reports with Quick Clear */}
          <div className="relative mb-2.5">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Quick find report..."
              value={reportSearch}
              onChange={(e) => setReportSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-7 text-xs text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 transition-all"
            />
            {reportSearch && (
              <button
                onClick={() => setReportSearch("")}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Category Filter Pills in Sidebar */}
          <div className="mb-2.5 flex flex-wrap gap-1 border-b border-slate-100 pb-2.5 dark:border-slate-800">
            <button
              onClick={() => setSelectedGroupFilter("all")}
              className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-all ${
                selectedGroupFilter === "all"
                  ? "bg-emerald-600 text-white shadow-xs font-bold"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              All
            </button>
            {REPORT_GROUPS.map((g) => (
              <button
                key={g.id}
                onClick={() => setSelectedGroupFilter(g.id)}
                className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-all ${
                  selectedGroupFilter === g.id
                    ? "bg-emerald-600 text-white shadow-xs font-bold"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {g.title.split(" ")[0]}
              </button>
            ))}
          </div>

          {/* Smooth Inner Scroll Area for Report Tree with Hover Animations */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 text-xs select-none [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-800">
            {visibleGroups.map((group) => {
              const Icon = group.icon;
              const isExpanded = expandedGroups[group.id] !== false;
              const containsActiveReport = group.reports.includes(report);

              return (
                <div
                  key={group.id}
                  className={`rounded-xl border transition-all duration-200 ${
                    containsActiveReport
                      ? "border-emerald-300/80 bg-emerald-50/25 shadow-xs dark:border-emerald-900/60 dark:bg-emerald-950/20"
                      : "border-slate-200/70 bg-white/60 dark:border-slate-800/80 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  {/* Collapsible Accordion Header */}
                  <button
                    onClick={() =>
                      setExpandedGroups((prev) => ({
                        ...prev,
                        [group.id]: !isExpanded,
                      }))
                    }
                    className="flex w-full items-center justify-between px-2.5 py-2 font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white text-[10px] transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon size={13} className={containsActiveReport ? "text-emerald-600" : "text-slate-400"} />
                      <span>{group.title}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[9px] font-bold text-slate-500 dark:bg-slate-800">
                        {group.reports.length}
                      </span>
                      <ChevronDown
                        size={12}
                        className={`transition-transform duration-200 ${
                          isExpanded ? "rotate-180 text-emerald-600" : "text-slate-400"
                        }`}
                      />
                    </div>
                  </button>

                  {/* Reports List inside Group with Micro-Animations */}
                  {isExpanded && (
                    <div className="space-y-1 px-1.5 pb-2 pt-0.5">
                      {group.reports.map((r) => {
                        const isSelected = report === r;
                        return (
                          <button
                            key={r}
                            onClick={() => {
                              setReport(r);
                              setSort({ key: "", direction: "asc" });
                              setCurrentPage(1);
                            }}
                            className={`group flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-all duration-150 ${
                              isSelected
                                ? "bg-gradient-to-r from-emerald-600 to-teal-600 font-bold text-white shadow-sm"
                                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 hover:translate-x-1 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                            }`}
                          >
                            <span className="truncate">{r}</span>
                            {isSelected ? (
                              <ChevronRight size={13} className="text-white shrink-0 animate-in fade-in" />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* RIGHT CONTENT AREA: CHARTS + FILTERS + DATA TABLE */}
        <div className="min-w-0 space-y-4">
          {/* 6. VISUAL ANALYTICS: PRODUCT PROFITABILITY & MULTI-METRIC CHARTS (GUARANTEED HEIGHT & DATA BARS) */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <BarChart2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Visual Analytics: {report}
                </h3>
              </div>
              <button
                onClick={() => setShowChart(!showChart)}
                className="text-xs font-semibold text-slate-500 hover:text-emerald-600 dark:text-slate-400 transition-colors"
              >
                {showChart ? "Collapse Chart" : "Expand Chart"}
              </button>
            </div>

            {showChart && (
              <div className="pt-4 w-full h-[320px]">
                {chartData && chartData.data && chartData.data.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    {chartData.type === "area" ? (
                      <AreaChart data={chartData.data} margin={{ top: 15, right: 25, left: 10, bottom: 25 }}>
                        <defs>
                          <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366F1" stopOpacity={0.4} />
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
                            borderRadius: "10px",
                            color: "#fff",
                            fontSize: "12px",
                            boxShadow: "0 10px 15px -3px rgba(0,0,0,0.3)",
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
                            borderRadius: "10px",
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
                          outerRadius={85}
                          innerRadius={50}
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
                      <BarChart data={chartData.data} margin={{ top: 15, right: 25, left: 10, bottom: 35 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                        <XAxis
                          dataKey="name"
                          fontSize={11}
                          stroke="#94A3B8"
                          interval={0}
                          angle={-15}
                          textAnchor="end"
                          height={45}
                        />
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
                            borderRadius: "10px",
                            color: "#fff",
                            fontSize: "12px",
                            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)",
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
                            maxBarSize={38}
                          />
                        ))}
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-slate-400">
                    <Info size={30} className="mb-2 text-emerald-600 opacity-60" />
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      No visual chart data available for the active filters
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Try clearing or loosening one of your search or counter criteria.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 7. ADVANCED DYNAMIC FILTERS PANEL */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
            <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={15} className="text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Filter Criteria
                </h3>
                {activeChips.length > 0 && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {activeChips.length} active
                  </span>
                )}
              </div>

              {activeChips.length > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400"
                >
                  Reset all
                </button>
              )}
            </div>

            {/* Filter controls grid */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
              {/* Search text */}
              <div className="xl:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Search Records
                </label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    className={`${controlClass} pl-8`}
                    placeholder="Search by ID, name, status, amount..."
                    value={filters.search}
                    onChange={(e) => {
                      setFilters((prev) => ({ ...prev, search: e.target.value }));
                      setCurrentPage(1);
                    }}
                  />
                  {filters.search && (
                    <button
                      onClick={() => setFilters((prev) => ({ ...prev, search: "" }))}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Date From */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Date From
                </label>
                <input
                  type="date"
                  className={controlClass}
                  value={filters.from}
                  onChange={(e) => {
                    setFilters((prev) => ({ ...prev, from: e.target.value }));
                    setDatePreset("custom");
                    setCurrentPage(1);
                  }}
                />
              </div>

              {/* Date To */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Date To
                </label>
                <input
                  type="date"
                  className={controlClass}
                  value={filters.to}
                  onChange={(e) => {
                    setFilters((prev) => ({ ...prev, to: e.target.value }));
                    setDatePreset("custom");
                    setCurrentPage(1);
                  }}
                />
              </div>

              {/* Order Status */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
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

              {/* Category */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
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

              {/* Counter */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Billing Counter
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

              {/* Staff */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Staff Member
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

              {/* Payment Method */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Payment
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
                  <option value="Online">Online</option>
                  <option value="Card">Card</option>
                </select>
              </div>

              {/* Min & Max Amount */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Min ₹
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Min"
                    className={controlClass}
                    value={filters.min}
                    onChange={(e) => {
                      setFilters((prev) => ({ ...prev, min: e.target.value }));
                      setCurrentPage(1);
                    }}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Max ₹
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Max"
                    className={controlClass}
                    value={filters.max}
                    onChange={(e) => {
                      setFilters((prev) => ({ ...prev, max: e.target.value }));
                      setCurrentPage(1);
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 8. DATA TABLE & CARD VIEW CONTAINER */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
            {/* Table Subheader: Count, View Mode Toggle, Page Size */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {report}
                </span>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {loading ? "Loading..." : `${reportRows.length} items`}
                </span>
              </div>

              <div className="flex items-center gap-3">
                {/* View Switcher: Table vs Cards */}
                <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-800">
                  <button
                    onClick={() => setViewMode("table")}
                    title="Table View"
                    className={`rounded-md p-1 text-xs transition-colors ${
                      viewMode === "table"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                    }`}
                  >
                    <TableIcon size={14} />
                  </button>
                  <button
                    onClick={() => setViewMode("cards")}
                    title="Cards View"
                    className={`rounded-md p-1 text-xs transition-colors ${
                      viewMode === "cards"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                    }`}
                  >
                    <LayoutGrid size={14} />
                  </button>
                </div>

                {/* Page Size Dropdown */}
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="hidden sm:inline">Per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={250}>250</option>
                  </select>
                </div>
              </div>
            </div>

            {/* TABLE OR CARDS DISPLAY */}
            {viewMode === "cards" ? (
              /* RESPONSIVE CARDS VIEW */
              <div className="p-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-32 animate-pulse rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50"
                    />
                  ))
                ) : paginatedRows.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-slate-400">
                    <Info size={28} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm font-semibold">No records match the active criteria</p>
                  </div>
                ) : (
                  paginatedRows.map((row, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm transition-all hover:border-emerald-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="flex items-start justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                        <span className="font-bold text-slate-900 text-xs truncate max-w-[70%] dark:text-white">
                          {row[reportColumns[0]?.key] ?? `#${idx + 1}`}
                        </span>
                        {row.margin !== undefined
                          ? renderStatusBadge(row.margin, "margin")
                          : row.status
                          ? renderStatusBadge(row.status, "status")
                          : null}
                      </div>
                      <div className="mt-2 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                        {reportColumns.slice(1).map((col) => {
                          const val = row[col.key];
                          return (
                            <div key={col.key} className="flex justify-between items-center text-[11px]">
                              <span className="text-slate-400">{col.header}:</span>
                              <span className="font-semibold text-slate-800 dark:text-slate-100">
                                {col.format === "currency"
                                  ? formatINR(val)
                                  : col.format === "percent"
                                  ? renderStatusBadge(val, "margin")
                                  : col.format === "datetime"
                                  ? formatISTDateTime(val)
                                  : col.format === "date"
                                  ? formatISTDate(val)
                                  : col.key === "status"
                                  ? renderStatusBadge(val, "status")
                                  : val ?? "-"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              /* PROFESSIONAL DATA TABLE */
              <div className="max-h-[580px] overflow-auto">
                <table className="w-full min-w-[720px] border-collapse text-left text-xs md:text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-100/95 text-[11px] font-bold uppercase tracking-wider text-slate-600 backdrop-blur-md dark:bg-slate-800/95 dark:text-slate-300">
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
                            className="inline-flex items-center gap-1 font-bold hover:text-emerald-600 transition-colors"
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
                            <td key={cIdx} className="px-4 py-3">
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
                          {activeChips.length > 0 && (
                            <button
                              onClick={clearAllFilters}
                              className="mt-3 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
                            >
                              Clear all filters
                            </button>
                          )}
                        </td>
                      </tr>
                    ) : (
                      paginatedRows.map((row, i) => (
                        <tr
                          key={`${report}-${i}`}
                          className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
                        >
                          {reportColumns.map((c) => {
                            const val = row[c.key];
                            return (
                              <td
                                key={c.key}
                                className={`whitespace-nowrap px-4 py-2.5 text-slate-700 dark:text-slate-300 ${
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
            )}

            {/* 9. PAGINATION FOOTER */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900">
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
                  <ChevronLeft size={15} />
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
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
