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
      model: { type: String, default: 'Groq / LLaMA' },
    },
    takeaways: [{ type: String }],
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
    rawInsights: { type: String, required: true },
    status: { type: String, default: 'completed' },
  },
  { timestamps: true }
);

aiInsightSchema.index({ 'period.from': 1, 'period.to': 1, createdAt: -1 });

export default mongoose.model('AIInsight', aiInsightSchema);
