const Task = require('../models/Task');
const AgentRun = require('../models/AgentRun');
const Approval = require('../models/Approval');
const asyncHandler = require('../utils/asyncHandler');

const getDashboardStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const totalTasks = await Task.countDocuments({ userId });
  const activeRuns = await Task.countDocuments({ userId, status: { $in: ['running', 'queued'] } });
  const completedTasks = await Task.countDocuments({ userId, status: 'completed' });
  const successRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Total cost
  const tasks = await Task.find({ userId }).select('budget duration');
  const totalCost = tasks.reduce((sum, t) => sum + (t.budget?.spentCost || 0), 0);

  // Completed task duration
  const completedWithDuration = tasks.filter(t => t.duration && t.duration > 0);
  const avgExecutionTime = completedWithDuration.length > 0
    ? (completedWithDuration.reduce((sum, t) => sum + t.duration, 0) / completedWithDuration.length) / 1000
    : 0;

  // Pending approvals
  const userTaskIds = tasks.map(t => t._id);
  const pendingApprovals = await Approval.countDocuments({
    taskId: { $in: userTaskIds },
    status: 'pending'
  });

  // Agent usage & total tokens
  const agentRuns = await AgentRun.find({ taskId: { $in: userTaskIds } }).select('agentName cost');
  const totalTokens = agentRuns.reduce((sum, r) => sum + (r.cost?.tokens?.total || 0), 0);

  const agentUsage = {
    planner: agentRuns.filter(r => r.agentName === 'planner').length,
    researcher: agentRuns.filter(r => r.agentName === 'researcher').length,
    coder: agentRuns.filter(r => r.agentName === 'coder').length,
    reviewer: agentRuns.filter(r => r.agentName === 'reviewer').length,
  };

  res.json({
    success: true,
    data: {
      totalTasks,
      activeRuns,
      successRate,
      totalCost,
      pendingApprovals,
      totalTokens,
      avgExecutionTime,
      agentUsage
    }
  });
});

module.exports = {
  getDashboardStats
};
