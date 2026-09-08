const mongoose = require('mongoose');

const traceStepSchema = new mongoose.Schema(
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
      default: null
    },
    parentRunId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AgentRun',
      default: null
    },
    stepType: {
      type: String,
      enum: ['thought', 'action', 'observation', 'llm_call', 'tool_call', 'result', 'error'],
      required: true
    },
    content: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    order: {
      type: Number,
      required: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed
    }
  },
  {
    timestamps: true
  }
);

traceStepSchema.index({ taskId: 1, order: 1 });
traceStepSchema.index({ agentRunId: 1, order: 1 });

const TraceStep = mongoose.model('TraceStep', traceStepSchema);

module.exports = TraceStep;
