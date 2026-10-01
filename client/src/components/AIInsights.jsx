import { useState } from 'react';
import { FiCpu, FiMessageSquare, FiRefreshCw } from 'react-icons/fi';
import axios from 'axios';

export default function AIInsights({ data, totalRevenue, orderProfit, totalQuantity, peakHour }) {
  const [insight, setInsight] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateInsight = async () => {
    setLoading(true);
    setError('');
    
    // Prepare a small data summary to send to AI
    const summaryData = {
      totalRevenue,
      orderProfit,
      totalQuantity,
      peakHour,
      topProducts: (data || []).slice().sort((a, b) => b.totalQuantity - a.totalQuantity).slice(0, 5).map(p => ({ name: p.name, qty: p.totalQuantity, revenue: p.totalRevenue }))
    };

    const prompt = `You are a professional retail and fintech business analyst. Analyze this POS sales data and provide a short, highly professional, 3-bullet-point insight highlighting performance, concerns, and one strategic recommendation. Do not use markdown other than bolding. Data: ${JSON.stringify(summaryData)}`;

    try {
      const groqKey = import.meta.env.VITE_GROQ_API_KEY;
      const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const anyKey = groqKey || geminiKey || import.meta.env.VITE_AI_API_KEY;

      if (!anyKey) {
        throw new Error("AI API key not found. Please add VITE_GROQ_API_KEY (starting with gsk_) or VITE_GEMINI_API_KEY to client/.env and restart the Vite dev server.");
      }

      // Check if we have a valid Groq key (starts with gsk_)
      const isGroqKey = groqKey && groqKey.startsWith('gsk_');
      const isGeminiKey = (geminiKey && geminiKey.startsWith('AIzaSy')) || (groqKey && groqKey.startsWith('AIzaSy'));

      if (isGroqKey) {
        // Groq API with active fast model
        const response = await axios.post(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            model: "qwen/qwen3.8-27b",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 300
          },
          {
            headers: {
              'Authorization': `Bearer ${groqKey}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (response.data?.choices?.[0]?.message?.content) {
          setInsight(response.data.choices[0].message.content);
          return;
        }
      }

      if (isGeminiKey) {
        const keyToUse = (geminiKey && geminiKey.startsWith('AIzaSy')) ? geminiKey : groqKey;
        // Google Gemini API with gemini-3.8-flash
        const response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${keyToUse}`,
          {
            contents: [{ parts: [{ text: prompt }] }]
          },
          {
            headers: { 'Content-Type': 'application/json' }
          }
        );

        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          setInsight(text);
          return;
        }
      }

      // Fallback: try Groq if key exists
      if (groqKey) {
        const response = await axios.post(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            model: "qwen/qwen3.8-27b",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 300
          },
          {
            headers: {
              'Authorization': `Bearer ${groqKey}`,
              'Content-Type': 'application/json'
            }
          }
        );
        if (response.data?.choices?.[0]?.message?.content) {
          setInsight(response.data.choices[0].message.content);
          return;
        }
      }

      throw new Error("Unable to retrieve insight from AI provider. Please verify your API key in client/.env.");
    } catch (err) {
      console.error(err);
      const apiMsg = err.response?.data?.error?.message || err.message;
      setError(apiMsg || 'Failed to fetch AI insights. Check API key and network.');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-3xl p-6 shadow-xl border border-indigo-900/50 relative overflow-hidden group mb-8">
      {/* Background glow */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl group-hover:bg-indigo-500/30 transition-all"></div>
      
      <div className="relative z-10 flex flex-col md:flex-row gap-6 items-start md:items-center">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <FiCpu className="text-indigo-400 text-xl" />
            <h2 className="text-xl font-bold text-white tracking-tight">AI Financial Analyst</h2>
          </div>
          <p className="text-indigo-200/80 text-sm mb-4 leading-relaxed">
            Get instant, actionable insights on your current performance metrics powered by AI.
          </p>
          
          <button 
            onClick={generateInsight} 
            disabled={loading}
            className="bg-indigo-500 hover:bg-indigo-400 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? <><FiRefreshCw className="animate-spin" /> Analyzing Data...</> : <><FiMessageSquare /> Generate Insights</>}
          </button>
        </div>

        <div className="flex-1 w-full bg-slate-900/50 rounded-2xl p-5 border border-white/5 min-h-[140px] flex items-center justify-center">
          {loading ? (
             <div className="flex items-center gap-3 text-indigo-300 font-medium animate-pulse">
                <span className="w-2 h-2 bg-indigo-400 rounded-full"></span>
                <span className="w-2 h-2 bg-indigo-400 rounded-full animation-delay-150"></span>
                <span className="w-2 h-2 bg-indigo-400 rounded-full animation-delay-300"></span>
             </div>
          ) : error ? (
            <div className="text-rose-400 text-sm text-center px-4">{error}</div>
          ) : insight ? (
            <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
              {insight}
            </div>
          ) : (
            <div className="text-slate-500 text-sm text-center">
              Click generate to analyze current active dataset.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
