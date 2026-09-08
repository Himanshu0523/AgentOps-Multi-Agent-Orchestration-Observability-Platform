const Task = require('../models/Task');
const AgentRun = require('../models/AgentRun');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Get overall cost summary and per-agent breakdown for dashboard
 */
const getCostSummary = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const tasks = await Task.find({ userId }).select('budget status createdAt');
  const taskIds = tasks.map(t => t._id);

  let totalSpent = 0;
  let totalBudget = 0;

  tasks.forEach(t => {
    totalSpent += Number(t.budget?.spentCost || 0);
    totalBudget += Number(t.budget?.maxCost || 0);
  });

  totalSpent = Math.round(totalSpent * 10000) / 10000;
  totalBudget = Math.round(totalBudget * 100) / 100;
  const remaining = Math.max(0, Math.round((totalBudget - totalSpent) * 10000) / 10000);

  // Aggregate agent runs by agentName
  const agentRuns = await AgentRun.find({ taskId: { $in: taskIds } }).select('agentName cost duration');

  const agentAgg = {
    planner: { cost: 0, tokens: 0, count: 0 },
    researcher: { cost: 0, tokens: 0, count: 0 },
    coder: { cost: 0, tokens: 0, count: 0 },
    reviewer: { cost: 0, tokens: 0, count: 0 },
    finalizer: { cost: 0, tokens: 0, count: 0 },
  };

  agentRuns.forEach(r => {
    const name = (r.agentName || '').toLowerCase();
    if (agentAgg[name]) {
      agentAgg[name].cost += Number(r.cost?.amount || 0);
      agentAgg[name].tokens += Number(r.cost?.tokens?.total || 0);
      agentAgg[name].count += 1;
    }
  });

  const costByAgent = Object.entries(agentAgg).map(([name, data]) => ({
    agent: name.charAt(0).toUpperCase() + name.slice(1),
    cost: Math.round(data.cost * 10000) / 10000,
    tokens: data.tokens,
    runs: data.count
  }));

  res.json({
    success: true,
    data: {
      totalSpent,
      totalBudget,
      remaining,
      costByAgent,
      tasksCount: tasks.length
    }
  });
});

/**
 * Get cost breakdown for a specific task
 */
const getTaskCost = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const task = await Task.findOne({ _id: taskId, userId: req.user._id }).select('budget status title goal');
  if (!task) {
    throw new ApiError(404, 'Task not found');
  }

  const agentRuns = await AgentRun.find({ taskId }).select('agentName cost duration status startedAt completedAt');

  res.json({
    success: true,
    data: {
      budget: task.budget,
      status: task.status,
      agentRuns
    }
  });
});

module.exports = {
  getCostSummary,
  getTaskCost
};
