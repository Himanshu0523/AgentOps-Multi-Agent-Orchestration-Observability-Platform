const mongoose = require('mongoose');

const agentRunSchema = new mongoose.Schema(
  {
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      required: true,
      index: true
    },
    agentName: {
      type: String,
      required: true,
      enum: ['planner', 'researcher', 'coder', 'reviewer', 'finalizer']
    },
    parentRunId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AgentRun',
      default: null
    },
    input: {
      type: mongoose.Schema.Types.Mixed
    },
    output: {
      type: mongoose.Schema.Types.Mixed
    },
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed', 'skipped'],
      default: 'pending'
    },
    cost: {
      tokens: {
        input: Number,
        output: Number,
        total: Number
      },
      amount: {
        type: Number,
        default: 0
      },
      currency: {
        type: String,
        default: 'USD'
      }
    },
    startedAt: Date,
    completedAt: Date,
    duration: Number,
    error: {
      message: String,
      stack: String
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed
    }
  },
  {
    timestamps: true
  }
);

agentRunSchema.index({ taskId: 1, parentRunId: 1 });
agentRunSchema.index({ taskId: 1, agentName: 1 });

const AgentRun = mongoose.model('AgentRun', agentRunSchema);

module.exports = AgentRun;
