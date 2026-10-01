import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Bot, RefreshCw, Sparkles } from "lucide-react";
import api from "../services/api";

const cache = new Map();
const cacheDuration = 5 * 60 * 1000;

export default function AIInsights({ filters }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const filterKey = useMemo(() => JSON.stringify(filters), [filters]);
  useEffect(() => {
    setResult(null);
    setError("");
  }, [filterKey]);

  const generate = async () => {
    setLoading(true);
    setError("");
    const cached = cache.get(filterKey);
    const canUseCache = cached && Date.now() < cached.expires;
    try {
      if (canUseCache && !result) {
        setResult(cached.value);
        setLoading(false);
        return;
      }
      const { data } = await api.post("/insights/ai", { ...filters, forceRefresh: Boolean(result) });
      cache.set(filterKey, { value: data, expires: Date.now() + cacheDuration });
      setResult(data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not generate AI insights. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  return <section className="border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-start gap-3"><span className="mt-0.5 text-indigo-700 dark:text-indigo-300"><Bot size={20}/></span><div><h2 className="font-semibold">AI Business Insights</h2><p className="text-xs text-slate-500">AI-generated observations from aggregated store data</p></div></div><button onClick={generate} disabled={loading} className="inline-flex h-9 items-center gap-2 rounded bg-indigo-700 px-3 text-sm font-medium text-white hover:bg-indigo-800 disabled:opacity-60"><RefreshCw size={15} className={loading?"animate-spin":""}/>{loading?"Analyzing…":"Refresh AI Insights"}</button></div>
    {loading&&<div role="status" className="mt-4 flex items-center gap-2 text-sm text-indigo-700 dark:text-indigo-300"><Sparkles size={16}/>Analyzing summarized business data…</div>}
    {error&&<div role="alert" className="mt-4 flex items-start gap-2 text-sm text-red-700 dark:text-red-300"><AlertCircle size={16} className="mt-0.5 shrink-0"/><p>{error}</p></div>}
    {result&&!loading&&<div className="mt-4"><p className="whitespace-pre-wrap text-sm leading-6 text-slate-800 dark:text-slate-200">{result.insights}</p>{result.generatedAt&&<p className="mt-3 text-[11px] text-slate-500">Generated {new Intl.DateTimeFormat("en-IN",{timeZone:"Asia/Kolkata",dateStyle:"medium",timeStyle:"short"}).format(new Date(result.generatedAt))} IST{result.cached?" · cached":""}</p>}</div>}
    {!result&&!error&&!loading&&<p className="mt-4 text-sm text-slate-500">Refresh to request a concise analysis. The AI receives aggregated metrics only.</p>}
  </section>;
}
