const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      default: null
    },
    limit: {
      type: Number,
      required: true,
      min: 0
    },
    spent: {
      type: Number,
      default: 0,
      min: 0
    },
    currency: {
      type: String,
      default: 'USD'
    },
    transactions: [{
      amount: Number,
      description: String,
      agentName: String,
      timestamp: Date
    }],
    status: {
      type: String,
      enum: ['active', 'exceeded', 'inactive'],
      default: 'active'
    }
  },
  {
    timestamps: true
  }
);

budgetSchema.index({ userId: 1, status: 1 });
budgetSchema.index({ taskId: 1 });

const Budget = mongoose.model('Budget', budgetSchema);

module.exports = Budget;
