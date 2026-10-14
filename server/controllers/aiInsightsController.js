import AIInsight from '../models/AIInsight.js';
import { calculateCanonicalAnalytics, formatDateKeyIST } from '../services/analyticsService.js';

// In-memory set to prevent concurrent duplicate generation runs for the exact same period
const activeGenerations = new Set();

/**
 * Clean and parse Groq JSON response safely.
 */
function parseGroqResponse(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;

  try {
    let clean = rawText.trim();
    // Remove markdown code fences if present
    if (clean.startsWith('```json')) {
      clean = clean.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    } else if (clean.startsWith('```')) {
      clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(clean);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  } catch (err) {
    // If not strict JSON, attempt to locate JSON substring
    const firstBrace = rawText.indexOf('{');
    const lastBrace = rawText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        const substr = rawText.substring(firstBrace, lastBrace + 1);
        const parsed = JSON.parse(substr);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      } catch (e) {}
    }
  }
  return null;
}

/**
 * Deterministic fallback generator using exact canonical metrics.
 * Ensures 100% data integrity even if LLM service is offline or invalid.
 */
function generateDeterministicInsights(canonical) {
  const { metrics, comparison, products, inventory, operations, period } = canonical;

  const revFormatted = `₹${metrics.revenue.toLocaleString('en-IN')}`;
  const profitFormatted = `₹${metrics.profit.toLocaleString('en-IN')}`;
  const topProduct = products.top[0]?.name || 'Top catalog items';
  const peakHour = operations.peakHours[0]
    ? `${operations.peakHours[0].hour % 12 === 0 ? 12 : operations.peakHours[0].hour % 12}:00 ${
        operations.peakHours[0].hour >= 12 ? 'PM' : 'AM'
      }`
    : 'Afternoon';

  // Exactly 3 executive takeaways
  const takeaways = [
    // 1. Overall Performance Takeaway
    comparison.deltas.revenue.hasPrev
      ? `Store generated ${revFormatted} across ${metrics.orders} orders (${comparison.deltas.revenue.label}, ${metrics.margin}% gross margin).`
      : `Store recorded ${revFormatted} in gross revenue across ${metrics.orders} confirmed orders at an average order value of ₹${metrics.averageOrderValue.toLocaleString('en-IN')}.`,

    // 2. Products & Inventory Takeaway
    inventory.outOfStock.length > 0 || inventory.lowStock.length > 0
      ? `${topProduct} led product sales with ${products.top[0]?.quantity || 0} units, while ${inventory.outOfStock.length} items are out of stock and ${inventory.lowStock.length} require reordering.`
      : `${topProduct} is the primary volume driver (${products.top[0]?.quantity || 0} units sold), supporting a healthy ${metrics.margin}% store-wide margin.`,

    // 3. Store Operations Takeaway
    `Peak shopping activity concentrated around ${peakHour}, with ${operations.payments.cash.percentage}% cash and ${operations.payments.online.percentage}% online/UPI payment adoption.`,
  ];

  // 4 Categorized Sections
  const sections = [
    {
      type: 'sales',
      title: 'Sales Performance',
      priority: comparison.deltas.revenue.direction === 'down' ? 'HIGH' : 'MEDIUM',
      content: `The store completed ${metrics.orders} confirmed orders resulting in ${revFormatted} total sales and an Average Order Value (AOV) of ₹${metrics.averageOrderValue.toLocaleString('en-IN')}. ${
        comparison.deltas.revenue.hasPrev
          ? `Comparative revenue shifted ${comparison.deltas.revenue.direction === 'up' ? '+' : ''}${comparison.deltas.revenue.percent}% compared to the prior period (${metrics.orders - (comparison.metrics?.orders || 0)} order delta).`
          : 'Comparative baseline established with steady transaction volume across the selected period.'
      }`,
    },
    {
      type: 'profit',
      title: 'Profit Margin & Contribution',
      priority: metrics.margin < 15 ? 'HIGH' : 'MEDIUM',
      content: `Total gross profit reached ${profitFormatted} against ₹${metrics.cogs.toLocaleString('en-IN')} in Cost of Goods Sold (COGS), yielding a net gross margin of ${metrics.margin}%. ${
        products.mostProfitable[0]
          ? `The highest profit contributor was ${products.mostProfitable[0].name} generating ₹${Math.round(products.mostProfitable[0].profit).toLocaleString('en-IN')} in margin.`
          : 'Product contributions remained evenly distributed.'
      }`,
    },
    {
      type: 'inventory',
      title: 'Inventory & Stock Risk',
      priority: inventory.outOfStock.length > 0 ? 'HIGH' : 'MEDIUM',
      content: `${inventory.outOfStock.length} products are currently completely out of stock, and ${inventory.lowStock.length} products have reached minimum reorder limits. ${
        inventory.stockRisk[0]
          ? `Immediate attention is required for "${inventory.stockRisk[0].name}" with an estimated ${inventory.stockRisk[0].estimatedDaysOfStock ?? '< 3'} days of stock remaining at current velocity.`
          : 'Fast-moving SKUs are currently operating within manageable inventory buffers.'
      }`,
    },
    {
      type: 'operations',
      title: 'Store Operations',
      priority: 'MEDIUM',
      content: `Transactions peaked during the ${peakHour} window. ${
        operations.counters[0]
          ? `${operations.counters[0].name} handled the majority of transactions (₹${operations.counters[0].revenue.toLocaleString('en-IN')} across ${operations.counters[0].orders} orders).`
          : 'POS counters operated with balanced throughput.'
      } Customer settlement split: ${operations.payments.cash.percentage}% Cash vs ${operations.payments.online.percentage}% Digital/UPI.`,
    },
  ];

  // Actionable recommendations
  const recommendations = [
    {
      title: 'Replenish Depleting & Fast-Moving Stock',
      priority: inventory.outOfStock.length > 0 ? 'HIGH' : 'MEDIUM',
      evidence: `${inventory.outOfStock.length} products out of stock and ${inventory.lowStock.length} items at critical thresholds.`,
      action: 'Initiate purchase orders for low-stock SKUs before peak sales cycles to avoid missed revenue.',
      benefit: 'Prevents customer stockouts and protects daily order fulfillment velocity.',
    },
    {
      title: 'Feature High-Margin Category Anchors',
      priority: 'MEDIUM',
      evidence: `Gross margin is ${metrics.margin}%, driven by top categories such as ${products.mostProfitable[0]?.name || 'top sellers'}.`,
      action: 'Position top-margin products near checkouts and train staff to suggest complementary add-ons.',
      benefit: 'Increases average basket size and elevates gross margin by 1.5–3%.',
    },
    {
      title: 'Optimize Peak-Hour Staff & Counter Coverage',
      priority: 'MEDIUM',
      evidence: `Highest customer throughput concentrated around ${peakHour}.`,
      action: 'Ensure all billing counters are active and staffed 30 minutes prior to peak trading windows.',
      benefit: 'Reduces queue waiting times and improves checkout conversion during busy hours.',
    },
  ];

  return { takeaways, sections, recommendations };
}

/**
 * GET /api/insights/analytics
 * Provides single canonical analytics for the selected date range and filters.
 */
export const getCanonicalAnalytics = async (req, res) => {
  try {
    const analytics = await calculateCanonicalAnalytics(req.query);
    return res.json({ analytics });
  } catch (error) {
    console.error('Error computing canonical analytics:', error);
    return res.status(400).json({ message: error.message || 'Failed to compute store analytics.' });
  }
};

/**
 * POST /api/insights/ai
 * Generates and persists AI Business Insights using the canonical analytics engine.
 */
export const getBusinessInsights = async (req, res) => {
  const startTime = Date.now();
  const lockKey = `${req.body.from || ''}_${req.body.to || ''}_${req.body.counter || 'all'}`;

  // Concurrency guard: prevent multiple identical AI generation runs from firing at the same time
  if (activeGenerations.has(lockKey)) {
    return res.status(429).json({
      message: 'An analysis is currently being generated for this period. Please wait a moment.',
    });
  }

  activeGenerations.add(lockKey);

  try {
    const apiKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;

    // 1. Calculate Single Canonical Analytics (Source of Truth)
    const canonical = await calculateCanonicalAnalytics(req.body);
    const { from, to, days } = canonical.period;

    // Check if empty dataset
    if (canonical.metrics.orders === 0 && canonical.metrics.revenue === 0) {
      activeGenerations.delete(lockKey);
      return res.json({
        empty: true,
        period: canonical.period,
        metrics: canonical.metrics,
        takeaways: ['No confirmed orders found in the selected date range.'],
        sections: [
          {
            type: 'sales',
            title: 'Sales Performance',
            content: 'No transactions were recorded during this period.',
            priority: 'LOW',
          },
        ],
        recommendations: [],
        dataVersion: canonical.dataVersion,
      });
    }

    let aiOutput = null;
    let rawContent = '';

    // 2. Call Groq LLM if API Key is configured
    if (apiKey) {
      const prompt = `You are a strict, evidence-bound senior retail business analyst for "APC Store".
You are provided with canonical store performance data below.
DO NOT invent, guess, recalculate, or contradict the numbers provided.
Use ONLY the exact metrics, amounts, and counts provided in the DATA block.

Return ONLY a valid, parseable JSON object matching this schema:
{
  "takeaways": [
    "Overall Performance: short takeaway with exact revenue ₹${canonical.metrics.revenue} and ${canonical.metrics.orders} orders",
    "Products & Inventory: short takeaway citing top product and stock risk counts",
    "Store Operations: short takeaway citing peak hour and payment split"
  ],
  "sections": [
    {
      "type": "sales",
      "title": "Sales Performance",
      "priority": "HIGH" | "MEDIUM" | "LOW",
      "content": "Professional executive analysis citing exact orders (${canonical.metrics.orders}), revenue (₹${canonical.metrics.revenue}), and AOV (₹${canonical.metrics.averageOrderValue})."
    },
    {
      "type": "profit",
      "title": "Profit Margin & Contribution",
      "priority": "HIGH" | "MEDIUM" | "LOW",
      "content": "Analysis citing gross profit (₹${canonical.metrics.profit}), margin (${canonical.metrics.margin}%), and COGS (₹${canonical.metrics.cogs})."
    },
    {
      "type": "inventory",
      "title": "Inventory & Stock Risk",
      "priority": "HIGH" | "MEDIUM" | "LOW",
      "content": "Analysis citing low stock count, out of stock items, and estimated days of stock until depletion."
    },
    {
      "type": "operations",
      "title": "Store Operations",
      "priority": "HIGH" | "MEDIUM" | "LOW",
      "content": "Analysis citing top counter, peak hours, and cash vs online payment split."
    }
  ],
  "recommendations": [
    {
      "title": "Clear action title",
      "priority": "HIGH" | "MEDIUM" | "LOW",
      "evidence": "Exact metric from the data",
      "action": "Concrete operational step",
      "benefit": "Measurable business outcome"
    }
  ]
}

DATA:
${JSON.stringify({
  period: canonical.period,
  metrics: canonical.metrics,
  comparison: canonical.comparison,
  topProducts: canonical.products.top,
  mostProfitable: canonical.products.mostProfitable,
  categories: canonical.categories.slice(0, 5),
  operations: {
    counters: canonical.operations.counters.slice(0, 3),
    payments: canonical.operations.payments,
    peakHours: canonical.operations.peakHours,
  },
  inventory: {
    outOfStockCount: canonical.inventory.outOfStock.length,
    lowStockCount: canonical.inventory.lowStock.length,
    highestRisk: canonical.inventory.stockRisk.slice(0, 3),
  },
})}`;

      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), 25000);

      try {
        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          signal: abort.signal,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2,
            max_tokens: 1000,
            response_format: { type: 'json_object' },
          }),
        });

        if (groqResponse.ok) {
          const json = await groqResponse.json();
          rawContent = json.choices?.[0]?.message?.content?.trim() || '';
          aiOutput = parseGroqResponse(rawContent);
        } else {
          console.warn('Groq response not OK:', groqResponse.status);
        }
      } catch (err) {
        console.warn('Groq generation request encountered an error, falling back to deterministic:', err.message);
      } finally {
        clearTimeout(timer);
      }
    }

    // 3. Fallback to deterministic if AI output was not obtained or invalid
    if (
      !aiOutput ||
      !Array.isArray(aiOutput.takeaways) ||
      aiOutput.takeaways.length < 3 ||
      !Array.isArray(aiOutput.sections) ||
      aiOutput.sections.length === 0
    ) {
      aiOutput = generateDeterministicInsights(canonical);
    }

    // 4. Ensure takeaways are exactly 3
    const finalizedTakeaways = (aiOutput.takeaways || []).slice(0, 3);
    if (finalizedTakeaways.length < 3) {
      const fallback = generateDeterministicInsights(canonical);
      while (finalizedTakeaways.length < 3) {
        finalizedTakeaways.push(fallback.takeaways[finalizedTakeaways.length]);
      }
    }

    // 5. Ensure sections have the 4 required pillars
    const finalizedSections = aiOutput.sections || [];
    const hasType = (t) => finalizedSections.some((s) => s.type === t);
    const fallbackData = generateDeterministicInsights(canonical);

    ['sales', 'profit', 'inventory', 'operations'].forEach((type) => {
      if (!hasType(type)) {
        const missing = fallbackData.sections.find((s) => s.type === type);
        if (missing) finalizedSections.push(missing);
      }
    });

    const finalizedRecommendations =
      Array.isArray(aiOutput.recommendations) && aiOutput.recommendations.length > 0
        ? aiOutput.recommendations.slice(0, 4)
        : fallbackData.recommendations;

    const generatedInMs = Date.now() - startTime;

    // 6. Persist full canonical snapshot to MongoDB
    const savedInsight = await AIInsight.create({
      generatedAt: new Date(),
      generatedBy: req.user?._id,
      generatedByName: req.user?.name || 'Administrator',
      period: { from, to, days },
      filters: {
        counter: req.body.counter || 'all',
        category: req.body.category || 'all',
        payment: req.body.payment || 'all',
        staff: req.body.staff || 'all',
      },
      metadata: {
        ordersAnalyzed: canonical.metrics.orders,
        revenueAnalyzed: canonical.metrics.revenue,
        model: process.env.GROQ_MODEL || 'Groq / LLaMA',
        generatedInMs,
        dataVersion: canonical.dataVersion,
      },
      dataVersion: canonical.dataVersion,
      metrics: canonical.metrics,
      comparison: canonical.comparison,
      breakdown: {
        products: canonical.products,
        categories: canonical.categories,
        operations: canonical.operations,
      },
      inventory: canonical.inventory,
      takeaways: finalizedTakeaways,
      sections: finalizedSections,
      recommendations: finalizedRecommendations,
      rawInsights: rawContent || JSON.stringify(aiOutput),
      status: 'completed',
    });

    activeGenerations.delete(lockKey);

    return res.json({
      _id: savedInsight._id,
      period: savedInsight.period,
      filters: savedInsight.filters,
      metrics: savedInsight.metrics,
      comparison: savedInsight.comparison,
      breakdown: savedInsight.breakdown,
      inventory: savedInsight.inventory,
      takeaways: savedInsight.takeaways,
      sections: savedInsight.sections,
      recommendations: savedInsight.recommendations,
      metadata: savedInsight.metadata,
      dataVersion: savedInsight.dataVersion,
      generatedAt: savedInsight.generatedAt.toISOString(),
      generatedByName: savedInsight.generatedByName,
      isFresh: true,
      cached: false,
    });
  } catch (error) {
    activeGenerations.delete(lockKey);
    console.error('AI insights generation failed:', error);
    return res.status(500).json({
      message: error.message || 'Failed to generate business insights.',
    });
  }
};

/**
 * GET /api/insights/ai/latest
 * Fetches the latest saved snapshot for the given period.
 * Strict: If from & to are provided, returns snapshot ONLY for that exact period (no falling back to wrong periods).
 */
export const getLatestBusinessInsight = async (req, res) => {
  try {
    const { from, to } = req.query;

    let query = {};
    if (from && to) {
      query = { 'period.from': from, 'period.to': to };
    }

    const insight = await AIInsight.findOne(query).sort({ generatedAt: -1 }).lean();

    if (!insight) {
      return res.json({ insight: null, hasSnapshot: false });
    }

    return res.json({
      hasSnapshot: true,
      insight: {
        _id: insight._id,
        period: insight.period,
        filters: insight.filters || {},
        metrics: insight.metrics || {
          orders: insight.metadata?.ordersAnalyzed || 0,
          revenue: insight.metadata?.revenueAnalyzed || 0,
        },
        comparison: insight.comparison || null,
        breakdown: insight.breakdown || null,
        inventory: insight.inventory || null,
        takeaways: insight.takeaways || [],
        sections: insight.sections || [],
        recommendations: insight.recommendations || [],
        metadata: insight.metadata || { ordersAnalyzed: 0, revenueAnalyzed: 0 },
        dataVersion: insight.dataVersion || '',
        generatedAt: insight.generatedAt ? new Date(insight.generatedAt).toISOString() : new Date().toISOString(),
        generatedByName: insight.generatedByName || 'Administrator',
      },
    });
  } catch (error) {
    console.error('Error fetching latest AI insight:', error);
    return res.status(500).json({ message: 'Failed to fetch latest insight.' });
  }
};

/**
 * GET /api/insights/ai/history
 * Returns the 15 most recent snapshots across all periods.
 */
export const getBusinessInsightHistory = async (req, res) => {
  try {
    const history = await AIInsight.find()
      .sort({ generatedAt: -1 })
      .limit(15)
      .select('generatedAt period metadata status takeaways recommendations generatedByName metrics')
      .lean();

    return res.json({ history });
  } catch (error) {
    console.error('Error fetching AI insight history:', error);
    return res.status(500).json({ message: 'Failed to fetch insight history.' });
  }
};

/**
 * GET /api/insights/ai/:id
 * Fetches a specific historical snapshot by ID.
 */
export const getInsightById = async (req, res) => {
  try {
    const insight = await AIInsight.findById(req.params.id).lean();
    if (!insight) {
      return res.status(404).json({ message: 'Insight snapshot not found.' });
    }
    return res.json({ insight });
  } catch (error) {
    console.error('Error fetching insight by ID:', error);
    return res.status(500).json({ message: 'Failed to fetch insight snapshot.' });
  }
};
