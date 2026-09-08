const mongoose = require('mongoose');

const approvalSchema = new mongoose.Schema(
  {
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      required: true,
      index: true
    },
    agentRunId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AgentRun',
      required: true
    },
    type: {
      type: String,
      enum: ['tool_execution', 'code_execution', 'high_risk_action', 'budget_override'],
      required: true
    },
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      required: true
    },
    action: {
      type: String,
      required: true
    },
    details: {
      type: mongoose.Schema.Types.Mixed
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'expired'],
      default: 'pending'
    },
    requestedBy: {
      type: String,
      required: true
    },
    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    decidedAt: Date,
    reason: String,
    expiresAt: Date
  },
  {
    timestamps: true
  }
);

approvalSchema.index({ taskId: 1, status: 1 });
approvalSchema.index({ status: 1, expiresAt: 1 });

const Approval = mongoose.model('Approval', approvalSchema);

module.exports = Approval;
