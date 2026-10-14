import mongoose from 'mongoose';

const aiInsightSchema = new mongoose.Schema(
  {
    generatedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    generatedByName: {
      type: String,
      default: 'Administrator',
    },
    period: {
      from: { type: String, required: true },
      to: { type: String, required: true },
      days: { type: Number, default: 30 },
    },
    filters: {
      counter: { type: String, default: 'all' },
      category: { type: String, default: 'all' },
      payment: { type: String, default: 'all' },
      staff: { type: String, default: 'all' },
    },
    metadata: {
      ordersAnalyzed: { type: Number, default: 0 },
      revenueAnalyzed: { type: Number, default: 0 },
      model: { type: String, default: 'Groq / Qwen' },
      generatedInMs: { type: Number, default: 0 },
      dataVersion: { type: String, default: '' },
    },
    dataVersion: {
      type: String,
      default: '',
    },
    // Complete canonical analytics metrics stored alongside AI observations
    metrics: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    comparison: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    breakdown: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    inventory: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Exactly 3 executive takeaways: performance, products/inventory, store operations
    takeaways: [{ type: String }],
    // Categorized detailed insights: Sales, Profit, Inventory, Operations
    sections: [
      {
        type: {
          type: String,
          required: true,
        },
        title: { type: String, required: true },
        content: { type: String, required: true },
        priority: {
          type: String,
          enum: ['LOW', 'MEDIUM', 'HIGH'],
          default: 'MEDIUM',
        },
      },
    ],
    // Structured actionable recommendations
    recommendations: [
      {
        title: { type: String },
        priority: {
          type: String,
          enum: ['LOW', 'MEDIUM', 'HIGH'],
          default: 'MEDIUM',
        },
        evidence: { type: String },
        action: { type: String },
        benefit: { type: String },
      },
    ],
    rawInsights: { type: String, default: '' },
    status: {
      type: String,
      enum: ['generating', 'completed', 'failed'],
      default: 'completed',
    },
  },
  { timestamps: true }
);

aiInsightSchema.index({ 'period.from': 1, 'period.to': 1, createdAt: -1 });

export default mongoose.model('AIInsight', aiInsightSchema);
