import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import api from "../services/api";
import socket from "../services/socket";
import AIInsights from "../components/AIInsights";
import { aggregateSales, addDays, dateKeyIST, formatINR, getTodayIST, getWeekStartIST, inDateRange, itemName, orderCounter, orderStaff } from "../utils/posAnalytics";

const panel = "border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950";
const palette = { revenue: "#4f46e5", orders: "#0f766e", cost: "#d97706", profit: "#16a34a" };
const moneyTip = value => formatINR(value);

function Stat({ label, value, detail, tone = "slate" }) {
  const colors = { slate: "text-slate-900 dark:text-white", green: "text-emerald-700 dark:text-emerald-400", amber: "text-amber-700 dark:text-amber-400", red: "text-red-700 dark:text-red-400" };
  return <div className={`${panel} p-3.5`}><p className="text-xs text-slate-500">{label}</p><p className={`mt-1 text-xl font-semibold ${colors[tone]}`}>{value}</p>{detail&&<p className="mt-1 text-xs text-slate-500">{detail}</p>}</div>;
}

export default function InsightsPage() {
  const today = getTodayIST();
  const [period, setPeriod] = useState("today");
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(today);
  const [counter, setCounter] = useState("all");
  const [category, setCategory] = useState("all");
  const [payment, setPayment] = useState("all");
  const [staffName, setStaffName] = useState("all");
  const [records, setRecords] = useState({ orders: [], products: [], categories: [], staff: [], counters: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    const results = await Promise.allSettled([api.get("/orders"), api.get("/products"), api.get("/categories"), api.get("/users/staff"), api.get("/counters")]);
    const keys = ["orders", "products", "categories", "staff", "counters"];
    const failed = results.some(result => result.status === "rejected");
    setRecords(prev => Object.fromEntries(keys.map((key, i) => [key, results[i].status === "fulfilled" ? results[i].value.data || [] : prev[key]])));
    setError(failed ? "Some analysis data could not be refreshed. Showing the latest available records." : "");
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
    const events = ["newOrder", "orderConfirmed", "orderCancelled", "orderReverted", "orderUpdated", "stockUpdated", "stockRefilled", "productCreated", "productUpdated", "productDeleted", "usersUpdated", "countersUpdated"];
    const refresh = () => load(true);
    events.forEach(event => socket.on(event, refresh));
    return () => events.forEach(event => socket.off(event, refresh));
  }, [load]);

  const range = useMemo(() => {
    if (period === "today") return { from: today, to: today };
    if (period === "yesterday") return { from: addDays(today, -1), to: addDays(today, -1) };
    if (period === "week") return { from: getWeekStartIST(today), to: today };
    if (period === "month") return { from: `${today.slice(0, 7)}-01`, to: today };
    return { from: customFrom, to: customTo };
  }, [period, today, customFrom, customTo]);
  const productsById = useMemo(() => new Map(records.products.map(product => [String(product._id), product])), [records.products]);
  const categoriesById = useMemo(() => new Map(records.categories.map(item => [String(item._id), item])), [records.categories]);
  const scopedOrders = useMemo(() => records.orders.filter(order => {
    const when = order.confirmedAt || order.createdAt;
    if (!inDateRange({ createdAt: when }, range.from, range.to)) return false;
    if (counter !== "all" && orderCounter(order) !== counter) return false;
    if (staffName !== "all" && orderStaff(order) !== staffName) return false;
    if (payment !== "all" && ((order.payment?.method || "Cash").toLowerCase() === "cash" ? "cash" : "online") !== payment) return false;
    if (category !== "all") {
      return (order.items || []).some(item => {
        const product = productsById.get(String(item.productId?._id || item.productId)) || item.productId || {};
        const categoryId = String(product.categoryId?._id || product.categoryId || "");
        return categoryId === category || product.categoryId?.name === category || categoriesById.get(categoryId)?.name === category;
      });
    }
    return true;
  }), [records.orders, range, counter, staffName, payment, category, productsById, categoriesById]);
  const aggregationOrders = useMemo(() => category === "all" ? scopedOrders : scopedOrders.map(order => {
    const matchedItems = (order.items || []).filter(item => {
      const product = productsById.get(String(item.productId?._id || item.productId)) || item.productId || {};
      const categoryId = String(product.categoryId?._id || product.categoryId || "");
      return categoryId === category || product.categoryId?.name === category || categoriesById.get(categoryId)?.name === category;
    });
    const amount = matchedItems.reduce((sum, item) => sum + Number(item.price ?? item.sellingPrice ?? 0) * Number(item.quantity || 0), 0);
    return { ...order, items: matchedItems, totalAmount: amount };
  }), [scopedOrders, category, productsById, categoriesById]);
  const stats = useMemo(() => aggregateSales(aggregationOrders, records.products, records.categories), [aggregationOrders, records.products, records.categories]);
  const days = Math.max(1, Math.ceil((new Date(`${range.to}T00:00:00Z`) - new Date(`${range.from}T00:00:00Z`)) / 86400000) + 1);
  const trend = useMemo(() => {
    const result = new Map(stats.days.map(day => [day.date, day]));
    const startAt = Math.max(0, days - 89);
    return Array.from({ length: days - startAt }, (_, index) => {
      const date = addDays(range.from, startAt + index);
      const item = result.get(date) || { date, revenue: 0, cost: 0, profit: 0, orders: 0 };
      return { ...item, day: date.slice(5) };
    });
  }, [stats.days, range.from, days]);
  const bestHour = [...stats.hours].sort((a,b)=>b.revenue-a.revenue)[0];
  const inventoryRows = useMemo(() => records.products.map(product => {
    const sold = stats.products.find(item => item.id === String(product._id))?.quantity || 0;
    const available = Math.max(0, Number(product.stock || 0) - Number(product.reservedStock || 0));
    return { ...product, sold, available, avgDaily: sold / days, daysRemaining: sold ? available / (sold / days) : null };
  }), [records.products, stats.products, days]);
  const lowStock = inventoryRows.filter(p => p.available > 0 && p.available <= Number(p.lowStockThreshold ?? 5)).sort((a,b)=>a.available-b.available);
  const outOfStock = inventoryRows.filter(p => p.available <= 0);
  const lowMargin = stats.products.filter(p => p.revenue > 0 && p.margin < 15).sort((a,b)=>a.margin-b.margin).slice(0,8);
  const leastProducts = [...inventoryRows].sort((a,b)=>a.sold-b.sold).slice(0,8);
  const fastest = [...inventoryRows].filter(p=>p.sold>0).sort((a,b)=>b.sold-a.sold).slice(0,8);
  const stockRisk = [...inventoryRows].filter(p=>p.sold>0).sort((a,b)=>(a.daysRemaining??Infinity)-(b.daysRemaining??Infinity)).slice(0,8);
  const filters = { from: range.from, to: range.to, counter, category, payment, staff: staffName };
  const options = (values) => [...new Set(values.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b)));
  const selectClass = "h-9 w-full rounded border border-slate-300 bg-white px-2.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
  const moneyTooltip = value => moneyTip(value);

  return <div className="space-y-5 pb-8">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold">Business Insights</h1><p className="mt-1 text-sm text-slate-500">Sales, profitability and operating patterns · all dates in IST</p></div><button onClick={()=>load()} className="inline-flex h-9 items-center gap-2 rounded border border-slate-300 px-3 text-sm dark:border-slate-700"><RefreshCw size={15}/>Refresh data</button></header>
    {error&&<p role="status" className="border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">{error}</p>}
    <section className={`${panel} p-3.5`}><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7"><label className="grid gap-1 text-xs font-medium text-slate-500">Period<select className={selectClass} value={period} onChange={e=>setPeriod(e.target.value)}><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="week">This Week</option><option value="month">This Month</option><option value="custom">Custom Date</option></select></label>{period==="custom"&&<><label className="grid gap-1 text-xs font-medium text-slate-500">From<input type="date" className={selectClass} max={today} value={customFrom} onChange={e=>setCustomFrom(e.target.value)}/></label><label className="grid gap-1 text-xs font-medium text-slate-500">To<input type="date" className={selectClass} max={today} value={customTo} onChange={e=>setCustomTo(e.target.value)}/></label></>}
      <label className="grid gap-1 text-xs font-medium text-slate-500">Counter<select className={selectClass} value={counter} onChange={e=>setCounter(e.target.value)}><option value="all">All counters</option>{options(records.counters.map(c=>c.name)).map(x=><option key={x}>{x}</option>)}</select></label><label className="grid gap-1 text-xs font-medium text-slate-500">Category<select className={selectClass} value={category} onChange={e=>setCategory(e.target.value)}><option value="all">All categories</option>{records.categories.map(c=><option key={c._id} value={c.name}>{c.name}</option>)}</select></label><label className="grid gap-1 text-xs font-medium text-slate-500">Payment<select className={selectClass} value={payment} onChange={e=>setPayment(e.target.value)}><option value="all">All payments</option><option value="cash">Cash</option><option value="online">Online (UPI included)</option></select></label><label className="grid gap-1 text-xs font-medium text-slate-500">Staff<select className={selectClass} value={staffName} onChange={e=>setStaffName(e.target.value)}><option value="all">All staff</option>{options(records.staff.map(s=>s.name)).map(x=><option key={x}>{x}</option>)}</select></label></div><p className="mt-2 text-xs text-slate-500">{range.from} to {range.to} · {scopedOrders.length} matching orders</p></section>
    {loading&&<div className="text-sm text-slate-500">Loading analytics…</div>}
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"><Stat label="Revenue" value={formatINR(stats.revenue)} tone="green"/><Stat label="COGS" value={formatINR(stats.cost)} tone="amber"/><Stat label="Profit" value={formatINR(stats.profit)} tone="green"/><Stat label="Margin" value={`${stats.margin.toFixed(1)}%`}/><Stat label="Orders" value={stats.confirmed.length}/><Stat label="Average Order Value" value={formatINR(stats.averageOrder)}/></div>
    <div className="grid gap-4 xl:grid-cols-2"><section className={`${panel} p-4`}><div className="mb-3"><h2 className="font-semibold">Revenue & Orders Trend</h2><p className="text-xs text-slate-500">Daily sales in the selected period</p></div><div className="h-[270px]">{stats.confirmed.length?<ResponsiveContainer width="100%" height="100%"><LineChart data={trend}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="day" minTickGap={20}/><YAxis yAxisId="revenue" tickFormatter={v=>`₹${Math.round(v/1000)}k`}/><YAxis yAxisId="orders" orientation="right" allowDecimals={false}/><Tooltip labelFormatter={label=>`Date ${label}`} formatter={(value,name)=>name==="Orders"?value:formatINR(value)}/><Legend/><Line yAxisId="revenue" type="monotone" dataKey="revenue" name="Revenue" stroke={palette.revenue} dot={false}/><Line yAxisId="orders" type="monotone" dataKey="orders" name="Orders" stroke={palette.orders} dot={false}/></LineChart></ResponsiveContainer>:<div className="grid h-full place-items-center text-sm text-slate-500">No confirmed orders in this period</div>}</div></section><section className={`${panel} p-4`}><div className="mb-3"><h2 className="font-semibold">Revenue vs Cost vs Profit</h2><p className="text-xs text-slate-500">Based on immutable cost snapshots in order items</p></div><div className="h-[270px]">{stats.confirmed.length?<ResponsiveContainer width="100%" height="100%"><ComposedChart data={trend}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="day" minTickGap={20}/><YAxis tickFormatter={v=>`₹${Math.round(v/1000)}k`}/><Tooltip formatter={moneyTooltip}/><Legend/><Bar dataKey="revenue" name="Revenue" fill={palette.revenue}/><Bar dataKey="cost" name="COGS" fill={palette.cost}/><Line dataKey="profit" name="Profit" stroke={palette.profit} strokeWidth={2}/></ComposedChart></ResponsiveContainer>:<div className="grid h-full place-items-center text-sm text-slate-500">No confirmed orders in this period</div>}</div></section></div>
    <div className="grid gap-4 xl:grid-cols-2"><section className={`${panel} p-4`}><div className="mb-3 flex items-end justify-between"><div><h2 className="font-semibold">Product Performance</h2><p className="text-xs text-slate-500">Top sellers, profitable products and low margins</p></div></div><div className="grid gap-4 md:grid-cols-2"><div><h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Top by Quantity</h3><div className="space-y-2">{[...stats.products].sort((a,b)=>b.quantity-a.quantity).slice(0,7).map(p=><div key={p.id} className="flex justify-between gap-2 text-sm"><span className="truncate">{p.name}<span className="ml-1 text-xs text-slate-500">×{p.quantity}</span></span><span className="shrink-0 text-slate-600 dark:text-slate-300">{formatINR(p.revenue)}</span></div>)}</div></div><div><h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Most Profitable</h3><div className="space-y-2">{[...stats.products].sort((a,b)=>b.profit-a.profit).slice(0,7).map(p=><div key={p.id} className="flex justify-between gap-2 text-sm"><span className="truncate">{p.name}<span className="ml-1 text-xs text-slate-500">{p.margin.toFixed(1)}%</span></span><span className="shrink-0 text-emerald-700">{formatINR(p.profit)}</span></div>)}</div></div></div>{lowMargin.length>0&&<div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800"><h3 className="mb-2 text-xs font-semibold uppercase text-amber-700">Low Margin · under 15%</h3><div className="flex flex-wrap gap-x-5 gap-y-2">{lowMargin.map(p=><span key={p.id} className="text-sm">{p.name} <span className="text-amber-700">{p.margin.toFixed(1)}%</span></span>)}</div></div>}</section>
      <section className={`${panel} p-4`}><h2 className="mb-3 font-semibold">Category Performance</h2>{stats.categories.length?<div className="h-[260px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={[...stats.categories].sort((a,b)=>b.revenue-a.revenue).slice(0,8)} layout="vertical" margin={{left:12,right:14}}><CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number" tickFormatter={v=>`₹${Math.round(v/1000)}k`}/><YAxis type="category" dataKey="name" width={105}/><Tooltip formatter={moneyTooltip}/><Bar dataKey="revenue" name="Revenue" fill={palette.revenue}/><Bar dataKey="profit" name="Profit" fill={palette.profit}/></BarChart></ResponsiveContainer></div>:<p className="py-10 text-center text-sm text-slate-500">No category sales in this period</p>}<div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">{[...stats.categories].sort((a,b)=>b.revenue-a.revenue).slice(0,4).map(c=><div key={c.name} className="flex justify-between gap-3 py-2 text-xs"><span>{c.name} · {c.quantity} units</span><span>{formatINR(c.profit)} profit · {c.margin.toFixed(1)}%</span></div>)}</div></section></div>
    <div className="grid gap-4 xl:grid-cols-3"><section className={`${panel} p-4`}><h2 className="font-semibold">Peak Hours</h2><p className="mb-3 text-xs text-slate-500">{bestHour?.orders?`${bestHour.hour}:00 · ${bestHour.orders} orders · ${formatINR(bestHour.revenue)}`:"No hourly sales data"}</p><div className="h-48">{stats.confirmed.length?<ResponsiveContainer width="100%" height="100%"><BarChart data={stats.hours.filter(h=>h.orders)}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="hour"/><YAxis tickFormatter={v=>`₹${Math.round(v/1000)}k`}/><Tooltip formatter={moneyTooltip}/><Bar dataKey="revenue" name="Revenue" fill={palette.revenue}/></BarChart></ResponsiveContainer>:<div className="grid h-full place-items-center text-sm text-slate-500">Insufficient data</div>}</div></section><section className={`${panel} p-4`}><h2 className="font-semibold">Counter & Staff Performance</h2><div className="mt-3 grid gap-4 sm:grid-cols-2"><div><h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Counters</h3>{[...stats.counters].sort((a,b)=>b.revenue-a.revenue).slice(0,6).map(c=><div key={c.name} className="flex justify-between gap-2 py-1.5 text-xs"><span className="truncate">{c.name} · {c.orders}</span><span>{formatINR(c.revenue)}</span></div>)}</div><div><h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Staff</h3>{[...stats.staff].sort((a,b)=>b.revenue-a.revenue).slice(0,6).map(s=><div key={s.name} className="flex justify-between gap-2 py-1.5 text-xs"><span className="truncate">{s.name} · {s.orders}</span><span>{formatINR(s.revenue)}</span></div>)}</div></div></section><section className={`${panel} p-4`}><h2 className="font-semibold">Payment Performance</h2><p className="mt-1 text-xs text-slate-500">Cash vs digital payments (UPI included in online)</p>{["Cash","Online"].map(method=>{const amount=stats.payment[method];const share=stats.revenue?amount/stats.revenue*100:0;return <div key={method} className="mt-4"><div className="mb-1 flex justify-between text-sm"><span>{method}</span><span>{formatINR(amount)} · {share.toFixed(1)}%</span></div><div className="h-2 bg-slate-100 dark:bg-slate-800"><div className={`h-full ${method==="Cash"?"bg-indigo-600":"bg-emerald-600"}`} style={{width:`${share}%`}}/></div></div>})}</section></div>
    <div className="grid gap-4 lg:grid-cols-2"><section className={`${panel} p-4`}><h2 className="font-semibold">Inventory Movement & Stock Risk</h2><p className="mb-3 text-xs text-slate-500">Units sold in period compared with current available units</p><div className="grid gap-4 md:grid-cols-2"><div><h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Fast Moving</h3>{fastest.map(p=><div key={p._id} className="flex justify-between gap-2 py-1.5 text-sm"><span className="truncate">{p.name} · {p.sold} sold</span><span className={p.daysRemaining!==null&&p.daysRemaining<7?"text-red-700":""}>{p.daysRemaining===null?`${p.available} available`:`${p.daysRemaining.toFixed(1)} days left`}</span></div>)}{!fastest.length&&<p className="text-sm text-slate-500">Insufficient sales data</p>}</div><div><h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Low & Out of Stock</h3>{[...outOfStock,...lowStock].slice(0,8).map(p=><div key={p._id} className="flex justify-between gap-2 py-1.5 text-sm"><span className="truncate">{p.name}</span><span className={p.available<=0?"text-red-700":"text-amber-700"}>{p.available<=0?"Out of stock":`${p.available} left`}</span></div>)}{!outOfStock.length&&!lowStock.length&&<p className="text-sm text-slate-500">No stock alerts</p>}</div></div></section><section className={`${panel} p-4`}><h2 className="font-semibold">Slow Moving Products</h2><p className="mb-3 text-xs text-slate-500">Lowest unit sales in the selected period, including no-sale products</p><div className="overflow-x-auto"><table className="w-full min-w-[400px] text-left text-sm"><thead className="text-xs text-slate-500"><tr><th className="py-2">Product</th><th className="py-2">Units Sold</th><th className="py-2">Available</th><th className="py-2">Margin</th></tr></thead><tbody>{leastProducts.map(p=><tr key={p._id} className="border-t border-slate-100 dark:border-slate-800"><td className="py-2">{p.name}</td><td className="py-2">{p.sold}</td><td className="py-2">{p.available}</td><td className="py-2">{stats.products.find(x=>x.id===String(p._id))?.margin.toFixed(1) ?? "-"}%</td></tr>)}{!leastProducts.length&&<tr><td colSpan="4" className="py-8 text-center text-slate-500">No product records</td></tr>}</tbody></table></div></section></div>
    <AIInsights filters={filters}/>
  </div>;
}
