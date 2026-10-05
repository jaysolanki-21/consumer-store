import { useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, FileText, RefreshCw, Search } from "lucide-react";
import toast from "react-hot-toast";
import api from "../services/api";
import { exportReportToCSV, exportReportToExcel, exportReportToPDF, formatINR, formatDuration, formatISTDateTime } from "../utils/exportUtils";

const groups = [
  ["Sales & Revenue", ["Product-wise Sales", "Confirmed Orders Details", "Daily Sales Summary", "Hourly Sales", "Category-wise Sales", "Counter-wise Sales", "Staff-wise Sales", "Payment-wise Sales", "Top Selling Products", "Least Selling Products", "Revenue Trend"]],
  ["Profit & Cost", ["Profit & Loss Report", "Product Profitability", "Category Profitability", "Cost Analysis", "Dead Stock Products", "High Margin Products"]],
  ["Orders", ["Pending Orders", "Cancelled Orders", "Order Status Summary", "Order Time Analysis", "Large Orders", "Repeat Items"]],
  ["Inventory & Stock", ["Current Stock Report", "Low Stock Report", "Out of Stock", "Stock Movement", "Reserved Stock", "Stock Valuation", "Fast Moving Stock"]],
  ["Categories", ["Category Performance", "Category-wise Orders", "Empty Categories", "Top Categories"]],
  ["Staff & Counters", ["Staff Performance", "Staff Activity Report", "Counter Performance", "Counter Downtime", "Staff Login History"]],
];
const allReports = groups.flatMap(([, names]) => names);
const money = (value) => Number(value || 0);
const titleCase = (value) => String(value || "Unknown");
const orderDate = (order) => order.confirmedAt || order.createdAt;
const productName = (item, productsById) => item.productId?.name || productsById.get(String(item.productId?._id || item.productId))?.name || item.name || "Deleted product";
const counterOf = (o) => o.counter?.name || o.counterName || o.counterId || "Unassigned";
const staffOf = (o) => o.staffName || o.confirmedBy?.name || o.staffId?.name || "Unassigned";
const profitOf = (o) => (o.items || []).reduce((n, i) => n + (money(i.price ?? i.sellingPrice) - money(i.costPrice)) * money(i.quantity), 0);
const currencyCol = (key, header) => ({ key, header, format: "currency", align: "right" });
const qtyCol = (key = "quantity") => ({ key, header: "Quantity", align: "right" });

function makeReport(name, { orders, allOrders = orders, products, categories, staff, counters, loginHistory, productsById, categoriesById }) {
  const confirmed = orders.filter(o => o.status === "Confirmed");
  const productAgg = new Map();
  const categoryAgg = new Map();
  confirmed.forEach(o => (o.items || []).forEach(i => {
    const id = String(i.productId?._id || i.productId || productName(i, productsById));
    const product = productsById.get(id) || i.productId || {};
    const pName = productName(i, productsById);
    const category = product.categoryId?.name || categoriesById.get(String(product.categoryId?._id || product.categoryId))?.name || "Uncategorized";
    const qty = money(i.quantity), revenue = money(i.price ?? i.sellingPrice) * qty, cost = money(i.costPrice) * qty;
    const p = productAgg.get(id) || { product: pName, category, quantity: 0, revenue: 0, cost: 0, profit: 0, orders: 0 };
    p.quantity += qty; p.revenue += revenue; p.cost += cost; p.profit += revenue - cost; p.orders += 1; productAgg.set(id, p);
    const c = categoryAgg.get(category) || { category, quantity: 0, revenue: 0, cost: 0, profit: 0, orders: 0, products: new Set() };
    c.quantity += qty; c.revenue += revenue; c.cost += cost; c.profit += revenue - cost; c.orders += 1; c.products.add(id); categoryAgg.set(category, c);
  }));
  const productsRows = [...productAgg.values()];
  const categoryRows = [...categoryAgg.values()].map(c => ({ ...c, productsCount: c.products.size, margin: c.revenue ? c.profit / c.revenue * 100 : 0, topProduct: [...productsRows].filter(p => p.category === c.category).sort((a,b) => b.revenue-a.revenue)[0]?.product || "-" }));
  const groupBy = (arr, key, maker) => {
    const map = new Map(); arr.forEach(x => { const k = maker(x); const v = map.get(k) || { [key]: k, orders: 0, revenue: 0, profit: 0 }; v.orders++; v.revenue += money(x.totalAmount); v.profit += profitOf(x); map.set(k,v); }); return [...map.values()];
  };
  const orderRows = (list) => list.map(o => ({ orderId: o.invoiceNumber || o.billNumber || String(o._id).slice(-8), time: orderDate(o), status: o.status, counter: counterOf(o), staff: staffOf(o), payment: o.payment?.method || o.paymentMethod || "Cash", amount: money(o.totalAmount), cost: money(o.totalAmount) - profitOf(o), profit: profitOf(o), reason: o.timeline?.find(t => /cancel/i.test(t.status || "") || /cancel/i.test(t.message || ""))?.message || "Not recorded", items: (o.items || []).map(i => `${productName(i, productsById)} x${i.quantity}`).join(", ") }));
  const daily = new Map(); confirmed.forEach(o => { const d = new Date(orderDate(o)).toLocaleDateString("en-CA"); const r = daily.get(d) || { date:d, orders:0, revenue:0, profit:0 }; r.orders++; r.revenue += money(o.totalAmount); r.profit += profitOf(o); daily.set(d,r); });
  const rowsByCounter = groupBy(confirmed, "counter", counterOf);
  const rowsByStaff = groupBy(confirmed, "staff", staffOf);
  const fields = {
    "Product-wise Sales": [productsRows, [{key:"product",header:"Product"},{key:"category",header:"Category"},qtyCol(),currencyCol("revenue","Revenue"),currencyCol("cost","Cost"),currencyCol("profit","Profit")]],
    "Confirmed Orders Details": [orderRows(confirmed), [{key:"orderId",header:"Order ID"},{key:"time",header:"Time",format:"datetime"},{key:"counter",header:"Counter"},{key:"amount",header:"Amount",format:"currency"},{key:"staff",header:"Staff"},{key:"payment",header:"Payment"}]],
    "Daily Sales Summary": [[...daily.values()], [{key:"date",header:"Date",format:"date"},{key:"orders",header:"Orders"},currencyCol("revenue","Revenue"),currencyCol("profit","Profit")]],
    "Hourly Sales": [Array.from({length:24},(_,h)=>{const xs=confirmed.filter(o=>new Date(orderDate(o)).getHours()===h);return {hour:`${String(h).padStart(2,"0")}:00`,orders:xs.length,revenue:xs.reduce((s,o)=>s+money(o.totalAmount),0),profit:xs.reduce((s,o)=>s+profitOf(o),0)}}), [{key:"hour",header:"Hour"},{key:"orders",header:"Orders"},currencyCol("revenue","Revenue"),currencyCol("profit","Profit")]],
    "Category-wise Sales": [categoryRows, [{key:"category",header:"Category"},qtyCol(),currencyCol("revenue","Revenue"),currencyCol("cost","Cost"),currencyCol("profit","Profit"),{key:"topProduct",header:"Top Product"}]],
    "Counter-wise Sales": [rowsByCounter, [{key:"counter",header:"Counter"},{key:"orders",header:"Orders"},currencyCol("revenue","Revenue"),currencyCol("profit","Profit")]],
    "Staff-wise Sales": [rowsByStaff, [{key:"staff",header:"Staff"},{key:"orders",header:"Orders"},currencyCol("revenue","Revenue"),currencyCol("profit","Profit")]],
    "Payment-wise Sales": [Object.entries(confirmed.reduce((a,o)=>{const k=o.payment?.method||o.paymentMethod||"Cash";a[k]=(a[k]||0)+money(o.totalAmount);return a},{})).map(([method,revenue])=>({method,revenue,percentage:confirmed.reduce((s,o)=>s+money(o.totalAmount),0)?revenue/confirmed.reduce((s,o)=>s+money(o.totalAmount),0)*100:0})), [{key:"method",header:"Payment Method"},currencyCol("revenue","Revenue"),{key:"percentage",header:"Share",format:"percent"}]],
    "Top Selling Products": [[...productsRows].sort((a,b)=>b.quantity-a.quantity).slice(0,20), [{key:"product",header:"Product"},{key:"category",header:"Category"},qtyCol(),currencyCol("revenue","Revenue"),currencyCol("profit","Profit")]],
    "Least Selling Products": [[...productsRows].sort((a,b)=>a.quantity-b.quantity).slice(0,20), [{key:"product",header:"Product"},{key:"category","header":"Category"},qtyCol(),currencyCol("revenue","Revenue")]],
    "Revenue Trend": [[...daily.values()].slice(-30), [{key:"date",header:"Date",format:"date"},{key:"orders",header:"Orders"},currencyCol("revenue","Revenue"),currencyCol("profit","Profit")]],
    "Profit & Loss Report": [{ revenue:confirmed.reduce((s,o)=>s+money(o.totalAmount),0),cost:confirmed.reduce((s,o)=>s+money(o.totalAmount)-profitOf(o),0),profit:confirmed.reduce((s,o)=>s+profitOf(o),0),margin:confirmed.reduce((s,o)=>s+money(o.totalAmount),0)?confirmed.reduce((s,o)=>s+profitOf(o),0)/confirmed.reduce((s,o)=>s+money(o.totalAmount),0)*100:0 }, [{key:"revenue",header:"Revenue",format:"currency"},{key:"cost",header:"Cost",format:"currency"},{key:"profit",header:"Profit",format:"currency"},{key:"margin",header:"Margin",format:"percent"}]],
    "Product Profitability": [productsRows.map(p=>({...p,margin:p.revenue?p.profit/p.revenue*100:0})), [{key:"product",header:"Product"},{key:"category",header:"Category"},currencyCol("revenue","Revenue"),currencyCol("profit","Profit"),{key:"margin",header:"Margin",format:"percent"}]],
    "Category Profitability": [categoryRows, [{key:"category",header:"Category"},currencyCol("revenue","Revenue"),currencyCol("profit","Profit"),{key:"margin",header:"Margin",format:"percent"}]],
    "Cost Analysis": [{ totalCost:confirmed.reduce((s,o)=>s+money(o.totalAmount)-profitOf(o),0), averageOrderCost:confirmed.length?confirmed.reduce((s,o)=>s+money(o.totalAmount)-profitOf(o),0)/confirmed.length:0, products:productsRows.length }, [currencyCol("totalCost","Total Cost"),currencyCol("averageOrderCost","Average Cost / Order"),{key:"products",header:"Products Sold"}]],
    "Dead Stock Products": [products.filter(p=>!allOrders.some(o=>o.status==="Confirmed"&&new Date(orderDate(o))>=new Date(Date.now()-30*86400000)&&(o.items||[]).some(i=>String(i.productId?._id||i.productId)===String(p._id)))).map(p=>({product:p.name,category:p.categoryId?.name||categoriesById.get(String(p.categoryId?._id||p.categoryId))?.name||"Uncategorized",stock:p.stock,lastSold:"No sale in last 30 days"})), [{key:"product",header:"Product"},{key:"category",header:"Category"},{key:"stock",header:"Stock"},{key:"lastSold",header:"Last Sold"}]],
    "High Margin Products": [productsRows.map(p=>({...p,margin:p.revenue?p.profit/p.revenue*100:0})).filter(p=>p.margin>=50), [{key:"product",header:"Product"},{key:"category",header:"Category"},currencyCol("revenue","Revenue"),currencyCol("profit","Profit"),{key:"margin",header:"Margin",format:"percent"}]],
    "Pending Orders": [orderRows(orders.filter(o=>o.status==="Pending"||o.status==="Processing")), [{key:"orderId",header:"Order ID"},{key:"time",header:"Created",format:"datetime"},{key:"status",header:"Status"},{key:"counter",header:"Counter"},{key:"amount",header:"Amount",format:"currency"}]],
    "Cancelled Orders": [orderRows(orders.filter(o=>o.status==="Cancelled")), [{key:"orderId",header:"Order ID"},{key:"time",header:"Time",format:"datetime"},{key:"counter",header:"Counter"},{key:"amount",header:"Amount",format:"currency"},{key:"reason",header:"Reason"}]],
    "Order Status Summary": [Object.entries(orders.reduce((a,o)=>{a[o.status]=(a[o.status]||0)+1;return a},{})).map(([status,count])=>({status,count,percentage:orders.length?count/orders.length*100:0})), [{key:"status",header:"Status"},{key:"count",header:"Orders"},{key:"percentage",header:"Share",format:"percent"}]],
    "Order Time Analysis": [confirmed.map(o=>({orderId:o.invoiceNumber||String(o._id).slice(-8),created:o.createdAt,confirmed:o.confirmedAt,seconds:o.confirmedAt&&o.createdAt?Math.max(0,(new Date(o.confirmedAt)-new Date(o.createdAt))/1000):0,staff:staffOf(o)})), [{key:"orderId",header:"Order ID"},{key:"created",header:"Created",format:"datetime"},{key:"confirmed",header:"Confirmed",format:"datetime"},{key:"seconds",header:"Time to Confirm (sec)"},{key:"staff",header:"Staff"}]],
    "Large Orders": [orderRows(confirmed.filter(o=>money(o.totalAmount)>=1000)), [{key:"orderId",header:"Order ID"},{key:"time",header:"Time",format:"datetime"},{key:"counter",header:"Counter"},{key:"staff",header:"Staff"},{key:"amount",header:"Amount",format:"currency"}]],
    "Repeat Items": [productsRows.filter(p=>p.orders>1), [{key:"product",header:"Product"},{key:"orders",header:"Order Lines"},qtyCol(),currencyCol("revenue","Revenue")]],
    "Current Stock Report": [products.map(p=>({product:p.name,category:p.categoryId?.name||categoriesById.get(String(p.categoryId?._id||p.categoryId))?.name||"Uncategorized",stock:money(p.stock),reserved:money(p.reservedStock),available:Math.max(0,money(p.stock)-money(p.reservedStock)),threshold:money(p.lowStockThreshold)})), [{key:"product",header:"Product"},{key:"category",header:"Category"},{key:"stock",header:"On Hand"},{key:"reserved",header:"Reserved"},{key:"available",header:"Available"},{key:"threshold",header:"Low Stock Threshold"}]],
    "Low Stock Report": [products.filter(p=>money(p.stock)>0&&money(p.stock)<=money(p.lowStockThreshold)).map(p=>({product:p.name,category:p.categoryId?.name||"Uncategorized",stock:p.stock,threshold:p.lowStockThreshold})), [{key:"product",header:"Product"},{key:"category",header:"Category"},{key:"stock",header:"Stock"},{key:"threshold",header:"Threshold"}]],
    "Out of Stock": [products.filter(p=>money(p.stock)<=0).map(p=>({product:p.name,category:p.categoryId?.name||"Uncategorized",reserved:p.reservedStock||0})), [{key:"product",header:"Product"},{key:"category",header:"Category"},{key:"reserved",header:"Reserved"}]],
    "Stock Movement": [products.map(p=>({product:p.name,openingStock:"Not tracked",added:"Not tracked",sold:productAgg.get(String(p._id))?.quantity||0,stock:p.stock,netChange:"Not available"})), [{key:"product",header:"Product"},{key:"openingStock",header:"Opening Stock"},{key:"added",header:"Added"},{key:"sold",header:"Sold in Period"},{key:"stock",header:"Current Stock"},{key:"netChange",header:"Net Change"}]],
    "Reserved Stock": [products.filter(p=>money(p.reservedStock)>0).map(p=>({product:p.name,stock:p.stock,reserved:p.reservedStock,available:Math.max(0,money(p.stock)-money(p.reservedStock))})), [{key:"product",header:"Product"},{key:"stock",header:"On Hand"},{key:"reserved",header:"Reserved"},{key:"available",header:"Available"}]],
    "Stock Valuation": [products.map(p=>({product:p.name,stock:p.stock,costValue:money(p.stock)*money(p.costPrice),sellingValue:money(p.stock)*money(p.sellingPrice??p.price)})), [{key:"product",header:"Product"},{key:"stock",header:"Stock"},currencyCol("costValue","Cost Value"),currencyCol("sellingValue","Selling Value")]],
    "Fast Moving Stock": [productsRows.map(r=>({...r,stock:money(productsById.get(String([...productsById].find(([,p])=>p.name===r.product)?.[0]))?.stock)})).sort((a,b)=>b.quantity-a.quantity), [{key:"product",header:"Product"},{key:"quantity",header:"Units Sold"},{key:"stock",header:"Current Stock"},currencyCol("revenue","Revenue")]],
    "Category Performance": [categoryRows, [{key:"category",header:"Category"},{key:"orders",header:"Order Lines"},{key:"productsCount",header:"Products Sold"},currencyCol("revenue","Revenue"),currencyCol("profit","Profit")]],
    "Category-wise Orders": [categoryRows, [{key:"category",header:"Category"},{key:"orders",header:"Order Lines"},qtyCol(),currencyCol("revenue","Revenue")]],
    "Empty Categories": [categories.filter(c=>!products.some(p=>String(p.categoryId?._id||p.categoryId)===String(c._id))).map(c=>({category:c.name,created:c.createdAt})), [{key:"category",header:"Category"},{key:"created",header:"Created",format:"date"}]],
    "Top Categories": [[...categoryRows].sort((a,b)=>b.revenue-a.revenue), [{key:"category",header:"Category"},{key:"orders",header:"Order Lines"},currencyCol("revenue","Revenue"),currencyCol("profit","Profit")]],
    "Staff Performance": [staff.map(s=>{const xs=confirmed.filter(o=>staffOf(o)===s.name);return {staff:s.name,orders:xs.length,revenue:xs.reduce((n,o)=>n+money(o.totalAmount),0),averageConfirmSeconds:xs.length?xs.reduce((n,o)=>n+(o.confirmedAt&&o.createdAt?(new Date(o.confirmedAt)-new Date(o.createdAt))/1000:0),0)/xs.length:0}}), [{key:"staff",header:"Staff"},{key:"orders",header:"Orders"},currencyCol("revenue","Revenue"),{key:"averageConfirmSeconds",header:"Avg Confirm (sec)"}]],
    "Staff Activity Report": [staff.map(s=>({staff:s.name,status:s.status|| (s.isOnline?"Online":"Offline"),lastLogin:s.lastLogin,ordersToday:confirmed.filter(o=>staffOf(o)===s.name&&new Date(orderDate(o)).toDateString()===new Date().toDateString()).length})), [{key:"staff",header:"Staff"},{key:"status",header:"Status"},{key:"lastLogin",header:"Last Login",format:"datetime"},{key:"ordersToday",header:"Orders Today"}]],
    "Counter Performance": [counters.map(c=>{const xs=confirmed.filter(o=>counterOf(o)===c.name);const revenue=xs.reduce((n,o)=>n+money(o.totalAmount),0);return {counter:c.name,orders:xs.length,revenue,averageOrderValue:xs.length?revenue/xs.length:0,status:c.isActive===false?"Inactive":"Active"}}), [{key:"counter",header:"Counter"},{key:"status",header:"Status"},{key:"orders",header:"Orders"},currencyCol("revenue","Revenue"),currencyCol("averageOrderValue","Avg Order Value")]],
    "Counter Downtime": [counters.map(c=>({counter:c.name,status:c.isActive===false?"Inactive":"Active",lastUpdated:c.updatedAt,orders:confirmed.filter(o=>counterOf(o)===c.name).length,downtime:"Downtime history not tracked"})), [{key:"counter",header:"Counter"},{key:"status",header:"Status"},{key:"lastUpdated",header:"Last Updated",format:"date"},{key:"orders",header:"Orders in Period"},{key:"downtime",header:"Downtime"}]],
    "Staff Login History": [loginHistory.map(h=>({staff:h.name,role:h.role,loginAt:h.loginAt,logoutAt:h.logoutAt,ip:h.ip})), [{key:"staff",header:"User"},{key:"role",header:"Role"},{key:"loginAt",header:"Login",format:"datetime"},{key:"logoutAt",header:"Logout",format:"datetime"},{key:"ip",header:"IP"}]],
  };
  const [rows, columns] = fields[name] || [[], []];
  return { rows: Array.isArray(rows) ? rows : [rows], columns };
}

export default function SalesReportPage() {
  const [data, setData] = useState({orders:[],products:[],categories:[],staff:[],counters:[],loginHistory:[]});
  const [report, setReport] = useState(allReports[0]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({from:"",to:"",status:"all",category:"all",counter:"all",staff:"all",payment:"all",search:"",min:"",max:""});
  const [sort, setSort] = useState({key:"",direction:"asc"});
  const [pageSize, setPageSize] = useState(50);
  const fetchData = async () => {
    setLoading(true);
    const results = await Promise.allSettled([api.get("/orders"),api.get("/products"),api.get("/categories"),api.get("/users/staff"),api.get("/counters"),api.get("/users/login-history")]);
    const keys=["orders","products","categories","staff","counters","loginHistory"];
    setData(prev=>Object.fromEntries(keys.map((k,i)=>[k,results[i].status==="fulfilled"?(results[i].value.data||[]):prev[k]])));
    if(results.slice(0,3).some(r=>r.status==="rejected")) toast.error("Some report data could not be loaded");
    setLoading(false);
  };
  useEffect(()=>{fetchData()},[]);
  const productsById=useMemo(()=>new Map(data.products.map(p=>[String(p._id),p])),[data.products]);
  const categoriesById=useMemo(()=>new Map(data.categories.map(c=>[String(c._id),c.name])),[data.categories]);
  const periodData=useMemo(()=>{
    const inRange=value=>{const d=new Date(value);return (!filters.from||d>=new Date(`${filters.from}T00:00:00`))&&(!filters.to||d<=new Date(`${filters.to}T23:59:59`))};
    return {...data,allOrders:data.orders,orders:data.orders.filter(o=>inRange(orderDate(o))),loginHistory:data.loginHistory.filter(h=>inRange(h.loginAt))};
  },[data,filters.from,filters.to]);
  const reportData=useMemo(()=>{
    const {rows,columns}=makeReport(report,{...periodData,productsById,categoriesById});
    let result=rows;
    const reportDate=(r)=>r.time||r.date||r.created||r.confirmed||r.loginAt||r.lastSeen||r.lastUpdated;
    if(filters.from) result=result.filter(r=>!reportDate(r)||new Date(reportDate(r))>=new Date(`${filters.from}T00:00:00`));
    if(filters.to) result=result.filter(r=>!reportDate(r)||new Date(reportDate(r))<=new Date(`${filters.to}T23:59:59`));
    if(filters.status!=="all") result=result.filter(r=>String(r.status||"").toLowerCase()===filters.status.toLowerCase());
    if(filters.category!=="all") result=result.filter(r=>r.category===filters.category);
    if(filters.counter!=="all") result=result.filter(r=>r.counter===filters.counter);
    if(filters.staff!=="all") result=result.filter(r=>(r.staff||r.name)===filters.staff);
    if(filters.payment!=="all") result=result.filter(r=>r.payment===filters.payment||r.method===filters.payment);
    const term=filters.search.trim().toLowerCase(); if(term) result=result.filter(r=>Object.values(r).some(v=>String(v??"").toLowerCase().includes(term)));
    if(filters.min!=="") result=result.filter(r=>Number(r.amount??r.revenue??r.profit??r.stock??0)>=Number(filters.min));
    if(filters.max!=="") result=result.filter(r=>Number(r.amount??r.revenue??r.profit??r.stock??0)<=Number(filters.max));
    if(sort.key) result=[...result].sort((a,b)=>{const av=a[sort.key]??"",bv=b[sort.key]??"";const cmp=typeof av==="number"&&typeof bv==="number"?av-bv:String(av).localeCompare(String(bv),undefined,{numeric:true,sensitivity:"base"});return sort.direction==="asc"?cmp:-cmp});
    return {rows:result,columns};
    },[report,periodData,data,productsById,categoriesById,filters,sort]);
  const filteredOrders=data.orders.filter(o=>{const d=new Date(orderDate(o));return (!filters.from||d>=new Date(`${filters.from}T00:00:00`))&&(!filters.to||d<=new Date(`${filters.to}T23:59:59`))&&(filters.status==="all"||o.status.toLowerCase()===filters.status.toLowerCase())&&(filters.counter==="all"||counterOf(o)===filters.counter)&&(filters.staff==="all"||staffOf(o)===filters.staff)&&(filters.payment==="all"||(o.payment?.method||"Cash")===filters.payment)});
  const kpis=[{label:"Rows",value:reportData.rows.length},{label:"Orders",value:filteredOrders.length},{label:"Revenue",value:formatINR(filteredOrders.filter(o=>o.status==="Confirmed").reduce((n,o)=>n+money(o.totalAmount),0))},{label:"Profit",value:formatINR(filteredOrders.filter(o=>o.status==="Confirmed").reduce((n,o)=>n+profitOf(o),0))}];
  const filterSummary=Object.fromEntries(Object.entries(filters).filter(([,v])=>v&&v!=="all"));
  const payload={title:report,category:groups.find(([,names])=>names.includes(report))?.[0],period:filters.from||filters.to?`${filters.from||"Beginning"} to ${filters.to||"Today"}`:"All available dates",filters:filterSummary,kpis,columns:reportData.columns,data:reportData.rows};
  const setFilter=(key,value)=>setFilters(current=>({...current,[key]:value}));
  const controlClass="h-10 min-w-0 rounded border border-slate-300 bg-white px-3 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
  const select=(key,label,options)=><label className="grid gap-1 text-xs font-medium text-slate-500">{label}<select className={controlClass} value={filters[key]} onChange={e=>setFilter(key,e.target.value)}><option value="all">All {label}</option>{options.map(o=><option key={o} value={o}>{o}</option>)}</select></label>;
  const runExport=(kind)=>{if(kind==="pdf")exportReportToPDF(payload);if(kind==="csv")exportReportToCSV(payload);if(kind==="excel")exportReportToExcel(payload)};
  return <section className="space-y-5 text-slate-900 dark:text-slate-100">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-semibold">Sales & Business Reports</h1><p className="mt-1 text-sm text-slate-500">{allReports.length} reports across sales, profit, orders, inventory, categories, staff and counters</p></div><div className="flex flex-wrap gap-2"><button onClick={fetchData} title="Refresh report data" className="inline-flex h-10 items-center gap-2 rounded border border-slate-300 px-3 text-sm dark:border-slate-700"><RefreshCw size={16}/>Refresh</button><button onClick={()=>runExport("pdf")} className="inline-flex h-10 items-center gap-2 rounded bg-red-700 px-3 text-sm font-medium text-white"><FileText size={16}/>PDF</button><button onClick={()=>runExport("csv")} className="inline-flex h-10 items-center gap-2 rounded bg-emerald-700 px-3 text-sm font-medium text-white"><Download size={16}/>CSV</button><button onClick={()=>runExport("excel")} className="inline-flex h-10 items-center gap-2 rounded bg-sky-700 px-3 text-sm font-medium text-white"><FileSpreadsheet size={16}/>Excel</button></div></header>
    <div className="grid gap-4 lg:grid-cols-[230px_minmax(0,1fr)]"><aside className="max-h-[560px] overflow-auto border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">{groups.map(([group,names])=><div key={group} className="border-b border-slate-200 p-2 dark:border-slate-800"><h2 className="px-2 py-1 text-xs font-semibold uppercase text-slate-500">{group}</h2>{names.map(n=><button key={n} onClick={()=>{setReport(n);setSort({key:"",direction:"asc"})}} className={`block w-full rounded px-2 py-2 text-left text-sm ${report===n?"bg-emerald-50 font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300":"hover:bg-slate-100 dark:hover:bg-slate-900"}`}>{n}</button>)}</div>)}</aside>
    <div className="min-w-0 space-y-4"><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{kpis.map(k=><div key={k.label} className="border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"><p className="text-xs text-slate-500">{k.label}</p><p className="mt-1 truncate text-lg font-semibold">{k.value}</p></div>)}</div>
    <div className="border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"><div className="mb-3 flex items-center justify-between gap-2"><h2 className="font-semibold">{report}</h2><button className="text-xs text-slate-500 hover:text-emerald-700" onClick={()=>setFilters({from:"",to:"",status:"all",category:"all",counter:"all",staff:"all",payment:"all",search:"",min:"",max:""})}>Clear filters</button></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5"><label className="grid gap-1 text-xs font-medium text-slate-500">From<input className={controlClass} type="date" value={filters.from} onChange={e=>setFilter("from",e.target.value)}/></label><label className="grid gap-1 text-xs font-medium text-slate-500">To<input className={controlClass} type="date" value={filters.to} onChange={e=>setFilter("to",e.target.value)}/></label>{select("status","Status",["Pending","Processing","Confirmed","Cancelled"])}{select("category","Category",data.categories.map(c=>c.name))}{select("counter","Counter",[...new Set([...data.counters.map(c=>c.name),...data.orders.map(counterOf)])].filter(Boolean))}{select("staff","Staff",[...new Set([...data.staff.map(s=>s.name),...data.orders.map(staffOf)])].filter(Boolean))}{select("payment","Payment",["Cash","UPI","Online"])}<label className="grid gap-1 text-xs font-medium text-slate-500">Minimum amount<input className={controlClass} type="number" min="0" value={filters.min} onChange={e=>setFilter("min",e.target.value)} placeholder="Any"/></label><label className="grid gap-1 text-xs font-medium text-slate-500">Maximum amount<input className={controlClass} type="number" min="0" value={filters.max} onChange={e=>setFilter("max",e.target.value)} placeholder="Any"/></label><label className="col-span-2 grid gap-1 text-xs font-medium text-slate-500 sm:col-span-1">Search<div className="relative"><Search size={15} className="absolute left-3 top-3 text-slate-400"/><input className={`${controlClass} w-full pl-8`} value={filters.search} onChange={e=>setFilter("search",e.target.value)} placeholder="Search report rows"/></div></label></div>
    </div>
    <div className="overflow-hidden border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"><div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 text-sm dark:border-slate-800"><span className="text-slate-500">{loading?"Loading report data…":`${reportData.rows.length} matching rows`}</span><label className="flex items-center gap-2 text-xs text-slate-500">Rows<select value={pageSize} onChange={e=>setPageSize(Number(e.target.value))} className={controlClass}><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option><option value={250}>250</option></select></label></div><div className="max-h-[560px] overflow-auto"><table className="w-full min-w-[640px] border-collapse text-left text-sm"><thead className="sticky top-0 bg-slate-100 text-xs uppercase text-slate-500 dark:bg-slate-900"> <tr>{reportData.columns.map(c=><th key={c.key} className="whitespace-nowrap px-3 py-3"><button onClick={()=>setSort(v=>({key:c.key,direction:v.key===c.key&&v.direction==="asc"?"desc":"asc"}))} className="font-semibold">{c.header}{sort.key===c.key?(sort.direction==="asc"?" ↑":" ↓"):" ↕"}</button></th>)}</tr></thead><tbody>{reportData.rows.slice(0,pageSize).map((row,i)=><tr key={`${report}-${i}`} className="border-t border-slate-100 dark:border-slate-800">{reportData.columns.map(c=><td key={c.key} className="max-w-[320px] whitespace-nowrap px-3 py-2.5 text-slate-700 dark:text-slate-300">{c.format==="currency"?formatINR(row[c.key]):c.format==="percent"?`${money(row[c.key]).toFixed(1)}%`:c.format==="datetime"?formatISTDateTime(row[c.key]):c.format==="duration"?formatDuration(row[c.key]):c.format==="date"&&row[c.key]?new Date(row[c.key]).toLocaleDateString("en-IN"):row[c.key]??"-"}</td>)}</tr>)}{!loading&&reportData.rows.length===0&&<tr><td colSpan={Math.max(1,reportData.columns.length)} className="px-4 py-12 text-center text-slate-500">No rows match these filters.</td></tr>}</tbody></table></div></div></div></div>
  </section>;
}
