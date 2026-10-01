import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import api from "../services/api";
import socket from "../services/socket";
import { aggregateSales, addDays, dateKeyIST, formatINR, getTodayIST, orderCounter } from "../utils/posAnalytics";

const card = "border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950";
const datePeriod = (orders, from, to) => orders.filter(o => { const d=dateKeyIST(o.confirmedAt||o.createdAt); return o.status==="Confirmed"&&d>=from&&d<=to; });
const percentDelta = (current, previous) => previous ? `${current >= previous ? "+" : ""}${((current-previous)/previous*100).toFixed(1)}% vs prior` : "No prior period data";

function Metric({ label, value, note, tone = "slate" }) {
  const tones = { slate:"text-slate-900 dark:text-white", green:"text-emerald-700 dark:text-emerald-400", amber:"text-amber-700 dark:text-amber-400", red:"text-red-700 dark:text-red-400" };
  return <div className={`${card} min-w-0 p-4`}><p className="text-xs font-medium text-slate-500">{label}</p><p className={`mt-2 truncate text-2xl font-semibold ${tones[tone]}`}>{value}</p><p className="mt-1 truncate text-xs text-slate-500">{note}</p></div>;
}

export default function AdminPage() {
  const [records, setRecords] = useState({ orders: [], products: [], categories: [], staff: [], counters: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    const results = await Promise.allSettled([api.get("/orders"), api.get("/products"), api.get("/categories"), api.get("/users/staff"), api.get("/counters")]);
    const keys = ["orders", "products", "categories", "staff", "counters"];
    const failed = results.some(result => result.status === "rejected");
    setRecords(current => Object.fromEntries(keys.map((key, i) => [key, results[i].status === "fulfilled" ? results[i].value.data || [] : current[key]])));
    setError(failed ? "Some live data could not be refreshed. Showing the latest available records." : "");
    setLastUpdated(new Date());
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
    const events = ["newOrder", "orderConfirmed", "orderCancelled", "orderReverted", "orderUpdated", "stockUpdated", "stockRefilled", "productCreated", "productUpdated", "productDeleted", "usersUpdated", "countersUpdated"];
    const refresh = () => load(true);
    events.forEach(event => socket.on(event, refresh));
    return () => events.forEach(event => socket.off(event, refresh));
  }, [load]);

  const today = getTodayIST();
  const yesterday = addDays(today, -1);
  const sales = useMemo(() => aggregateSales(records.orders.filter(o => dateKeyIST(o.confirmedAt || o.createdAt) === today), records.products, records.categories), [records, today]);
  const yesterdaySales = useMemo(() => aggregateSales(datePeriod(records.orders, yesterday, yesterday), records.products, records.categories), [records, yesterday]);
  const todaysOrders = records.orders.filter(o => dateKeyIST(o.createdAt) === today);
  const pendingCount = records.orders.filter(o => ["Pending", "Processing"].includes(o.status)).length;
  const lowStock = records.products.filter(p => Number(p.stock) > 0 && Number(p.stock) - Number(p.reservedStock || 0) <= Number(p.lowStockThreshold ?? 5));
  const outOfStock = records.products.filter(p => Number(p.stock) - Number(p.reservedStock || 0) <= 0);
  const liveStatus = (record) => record.status || (!record.isActive || (record.disabledUntil && new Date(record.disabledUntil) > new Date()) ? "DISABLED" : record.isOnline ? (record.isOnBreak ? "ON BREAK" : "ONLINE") : "OFFLINE");
  const inventory = { total: records.products.length, inStock: records.products.filter(p => Number(p.stock) - Number(p.reservedStock || 0) > Number(p.lowStockThreshold ?? 5)).length, low: lowStock.length, out: outOfStock.length };
  const chartHours = sales.hours;
  const peak = [...chartHours].sort((a, b) => b.revenue - a.revenue)[0];
  const comparisonRanges = useMemo(() => {
    const [y, m] = today.split("-").map(Number);
    const monthStart = `${today.slice(0, 7)}-01`;
    const prevMonthLast = new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10);
    const prevMonthStart = `${prevMonthLast.slice(0, 7)}-01`;
    const weekStart = (() => { const d = new Date(`${today}T00:00:00Z`); const day=d.getUTCDay(); d.setUTCDate(d.getUTCDate()-(day===0?6:day-1)); return d.toISOString().slice(0,10); })();
    const daysSoFar = Math.floor((new Date(`${today}T00:00:00Z`) - new Date(`${weekStart}T00:00:00Z`))/86400000);
    const priorMonthDays = new Date(Date.UTC(y,m-1,0)).getUTCDate();
    const currentDay = Number(today.slice(8,10));
    return [
      { label: "Today", from: today, to: today, priorFrom: yesterday, priorTo: yesterday },
      { label: "This week", from: weekStart, to: today, priorFrom: addDays(weekStart,-7), priorTo: addDays(weekStart,daysSoFar-7) },
      { label: "This month", from: monthStart, to: today, priorFrom: prevMonthStart, priorTo: addDays(prevMonthStart, Math.min(currentDay, priorMonthDays)-1) },
    ];
  }, [today, yesterday]);
  const comparisons = comparisonRanges.map(range => {
    const current=aggregateSales(datePeriod(records.orders,range.from,range.to),records.products,records.categories);
    const previous=aggregateSales(datePeriod(records.orders,range.priorFrom,range.priorTo),records.products,records.categories);
    return {...range,current,previous};
  });
  const topProducts = [...sales.products].sort((a,b)=>b.quantity-a.quantity).slice(0,6);
  const attention = [
    ...outOfStock.slice(0,5).map(p=>({tone:"red",title:`${p.name} is out of stock`, detail:`Available: ${Math.max(0,Number(p.stock)-Number(p.reservedStock||0))}`})),
    ...lowStock.filter(p=>!outOfStock.includes(p)).slice(0,5).map(p=>({tone:"amber",title:`${p.name} is running low`,detail:`${Math.max(0,Number(p.stock)-Number(p.reservedStock||0))} available`})),
    ...(pendingCount?[{tone:"amber",title:`${pendingCount} orders need attention`,detail:"Pending or processing"}]:[]),
  ].slice(0,8);
  const statusClass = (status) => ({ ONLINE:"text-emerald-700 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-300", "ON BREAK":"text-amber-700 bg-amber-50 dark:bg-amber-950 dark:text-amber-300", OFFLINE:"text-slate-600 bg-slate-100 dark:bg-slate-900 dark:text-slate-300", DISABLED:"text-red-700 bg-red-50 dark:bg-red-950 dark:text-red-300" }[status] || "text-slate-600 bg-slate-100");

  if (loading && !records.products.length && !records.orders.length) return <div className="grid min-h-72 place-items-center text-sm text-slate-500"><RefreshCw size={20} className="animate-spin"/>Loading store activity…</div>;
  return <div className="space-y-5 pb-8">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold">Store Dashboard</h1><p className="mt-1 text-sm text-slate-500">Live store activity for {new Intl.DateTimeFormat("en-IN",{timeZone:"Asia/Kolkata",dateStyle:"full"}).format(new Date())}</p></div><button onClick={()=>load()} className="inline-flex h-9 items-center gap-2 rounded border border-slate-300 px-3 text-sm dark:border-slate-700"><RefreshCw size={15}/>Refresh</button></header>
    {error&&<p role="status" className="border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">{error}</p>}
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-6"><Metric label="Today's Revenue" value={formatINR(sales.revenue)} note={percentDelta(sales.revenue,yesterdaySales.revenue)} tone="green"/><Metric label="Today's Orders" value={todaysOrders.length} note={`${percentDelta(todaysOrders.length,records.orders.filter(o=>dateKeyIST(o.createdAt)===yesterday).length)} · all statuses`}/><Metric label="Today's Profit" value={formatINR(sales.profit)} note={`${sales.margin.toFixed(1)}% margin`} tone="green"/><Metric label="Pending Orders" value={pendingCount} note="Pending + processing" tone={pendingCount?"amber":"slate"}/><Metric label="Low Stock" value={lowStock.length} note="At or below threshold" tone={lowStock.length?"amber":"slate"}/><Metric label="Out of Stock" value={outOfStock.length} note="No available units" tone={outOfStock.length?"red":"slate"}/></div>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]"><section className={`${card} p-4`}><div className="mb-3 flex flex-wrap items-end justify-between gap-2"><div><h2 className="font-semibold">Today's Sales</h2><p className="text-xs text-slate-500">Hourly revenue, order count and profit · IST</p></div><p className="text-xs text-slate-500">Peak: {peak?.hour} · {formatINR(peak?.revenue)}</p></div><div className="h-[280px]">{sales.confirmed.length?<ResponsiveContainer width="100%" height="100%"><ComposedChart data={chartHours}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="hour" interval={2}/><YAxis yAxisId="money" tickFormatter={v=>`₹${Math.round(v/1000)}k`}/><YAxis yAxisId="orders" orientation="right" allowDecimals={false}/><Tooltip formatter={(v,name)=>name==="Orders"?v:formatINR(v)}/><Legend/><Area yAxisId="money" type="monotone" dataKey="revenue" name="Revenue" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.1}/><Area yAxisId="money" type="monotone" dataKey="profit" name="Profit" stroke="#16a34a" fill="#16a34a" fillOpacity={0.08}/><Line yAxisId="orders" type="monotone" dataKey="orders" name="Orders" stroke="#0f766e" dot={false}/></ComposedChart></ResponsiveContainer>:<div className="grid h-full place-items-center text-sm text-slate-500">No confirmed sales today</div>}</div></section><section className={`${card} p-4`}><h2 className="font-semibold">Sales Comparison</h2><p className="mb-3 text-xs text-slate-500">Current period compared with equivalent previous period</p><div className="divide-y divide-slate-100 dark:divide-slate-800">{comparisons.map(row=><div key={row.label} className="grid grid-cols-[1fr_auto] gap-1 py-3"><div className="text-sm font-medium">{row.label}<span className="ml-2 text-xs font-normal text-slate-500">{formatINR(row.current.revenue)}</span></div><span className={`text-xs font-medium ${row.current.revenue>=row.previous.revenue?"text-emerald-700":"text-red-700"}`}>{percentDelta(row.current.revenue,row.previous.revenue)}</span><div className="col-span-2 text-xs text-slate-500">{row.current.confirmed.length} orders · profit {formatINR(row.current.profit)}</div></div>)}</div></section></div>
    <div className="grid gap-4 lg:grid-cols-2"><section className={`${card} p-4`}><h2 className="mb-3 font-semibold">Top Selling Products</h2>{topProducts.length?<div className="divide-y divide-slate-100 dark:divide-slate-800">{topProducts.map((p,i)=><div key={p.id} className="grid grid-cols-[24px_1fr_auto] items-center gap-x-2 py-2.5 text-sm"><span className="text-xs text-slate-400">{i+1}</span><div className="min-w-0"><p className="truncate font-medium">{p.name}</p><p className="text-xs text-slate-500">{p.quantity} units · {p.category}</p></div><div className="text-right"><p>{formatINR(p.revenue)}</p><p className="text-xs text-emerald-700">Profit {formatINR(p.profit)}</p></div></div>)}</div>:<p className="py-8 text-center text-sm text-slate-500">No product sales today</p>}</section><section className={`${card} p-4`}><h2 className="mb-3 font-semibold">Category Performance</h2>{sales.categories.length?<div className="divide-y divide-slate-100 dark:divide-slate-800">{[...sales.categories].sort((a,b)=>b.revenue-a.revenue).slice(0,6).map(c=><div key={c.name} className="flex items-center justify-between gap-3 py-3 text-sm"><div><p className="font-medium">{c.name}</p><p className="text-xs text-slate-500">{c.quantity} units · {c.productCount} products</p></div><div className="text-right"><p>{formatINR(c.revenue)}</p><p className="text-xs text-emerald-700">{c.margin.toFixed(1)}% margin</p></div></div>)}</div>:<p className="py-8 text-center text-sm text-slate-500">No category sales today</p>}</section></div>
    <div className="grid gap-4 lg:grid-cols-3"><section className={`${card} p-4`}><h2 className="mb-3 font-semibold">Inventory Overview</h2><div className="grid grid-cols-2 gap-2">{[["Products",inventory.total,"slate"],["In Stock",inventory.inStock,"green"],["Low Stock",inventory.low,"amber"],["Out of Stock",inventory.out,"red"]].map(([label,value,tone])=><div key={label} className="border border-slate-100 p-3 dark:border-slate-800"><p className="text-xs text-slate-500">{label}</p><p className={`mt-1 text-xl font-semibold ${tone==="red"?"text-red-700":tone==="amber"?"text-amber-700":tone==="green"?"text-emerald-700":""}`}>{value}</p></div>)}</div></section><section className={`${card} p-4`}><h2 className="mb-3 font-semibold">Payment Summary</h2>{["Cash","Online"].map(method=>{const amount=sales.payment[method], share=sales.revenue?amount/sales.revenue*100:0;return <div key={method} className="mb-4"><div className="mb-1 flex justify-between text-sm"><span>{method}</span><span>{formatINR(amount)} · {share.toFixed(0)}%</span></div><div className="h-2 bg-slate-100 dark:bg-slate-800"><div className={`h-full ${method==="Cash"?"bg-indigo-600":"bg-emerald-600"}`} style={{width:`${share}%`}}/></div></div>})}</section><section className={`${card} p-4`}><h2 className="mb-3 font-semibold">Attention Required</h2>{attention.length?<div className="max-h-48 divide-y divide-slate-100 overflow-auto dark:divide-slate-800">{attention.map((item,i)=><div key={`${item.title}-${i}`} className="flex gap-2 py-2"><AlertTriangle size={16} className={item.tone==="red"?"mt-0.5 text-red-600":"mt-0.5 text-amber-600"}/><div className="min-w-0"><p className="text-sm font-medium">{item.title}</p><p className="text-xs text-slate-500">{item.detail}</p></div></div>)}</div>:<p className="py-6 text-sm text-slate-500">No urgent actions</p>}</section></div>
    <div className="grid gap-4 xl:grid-cols-2"><section className={`${card} overflow-hidden`}><div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800"><h2 className="font-semibold">Recent Orders</h2><a href="/admin/orders" className="text-xs font-medium text-indigo-700">View orders</a></div><div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900"><tr>{["Order","Time","Counter","Payment","Amount","Status"].map(x=><th key={x} className="px-3 py-2.5 font-medium">{x}</th>)}</tr></thead><tbody>{[...records.orders].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,7).map(o=><tr key={o._id} className="border-t border-slate-100 dark:border-slate-800"><td className="px-3 py-2.5">{o.invoiceNumber||o.billNumber||String(o._id).slice(-7)}</td><td className="px-3 py-2.5">{new Intl.DateTimeFormat("en-IN",{timeZone:"Asia/Kolkata",hour:"2-digit",minute:"2-digit"}).format(new Date(o.createdAt))}</td><td className="px-3 py-2.5">{orderCounter(o)}</td><td className="px-3 py-2.5">{o.payment?.method||"Cash"}</td><td className="px-3 py-2.5">{formatINR(o.totalAmount)}</td><td className="px-3 py-2.5">{o.status}</td></tr>)}{!records.orders.length&&<tr><td colSpan="6" className="px-3 py-8 text-center text-slate-500">No recent orders</td></tr>}</tbody></table></div></section><section className={`${card} p-4`}><h2 className="mb-3 font-semibold">Staff & Counter Status</h2><div className="grid gap-4 sm:grid-cols-2"><div><h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Staff</h3><div className="space-y-2">{records.staff.slice(0,6).map(person=>{const status=liveStatus(person);return <div key={person._id} className="flex items-center justify-between gap-2 text-sm"><span className="truncate">{person.name}</span><span className={`rounded px-2 py-0.5 text-[10px] font-medium ${statusClass(status)}`}>{status}</span></div>})}{!records.staff.length&&<p className="text-xs text-slate-500">No staff records</p>}</div></div><div><h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Counters</h3><div className="space-y-2">{records.counters.slice(0,6).map(counter=>{const status=liveStatus(counter);return <div key={counter._id} className="flex items-center justify-between gap-2 text-sm"><span className="truncate">{counter.name}</span><span className={`rounded px-2 py-0.5 text-[10px] font-medium ${statusClass(status)}`}>{status}</span></div>})}{!records.counters.length&&<p className="text-xs text-slate-500">No counter records</p>}</div></div></div><p className="mt-4 text-right text-[10px] text-slate-400">{lastUpdated?`Updated ${new Intl.DateTimeFormat("en-IN",{timeZone:"Asia/Kolkata",hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(lastUpdated)} IST`:""}</p></section></div>
  </div>;
}
