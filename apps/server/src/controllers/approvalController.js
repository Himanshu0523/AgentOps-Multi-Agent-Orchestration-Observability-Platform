const Approval = require('../models/Approval');
const Task = require('../models/Task');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const agentClient = require('../services/agentClient');

const getApprovals = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Find tasks belonging to current user
  const userTasks = await Task.find({ userId: req.user._id }).select('_id');
  const taskIds = userTasks.map(t => t._id);

  const filter = { taskId: { $in: taskIds } };
  if (req.query.status) {
    filter.status = req.query.status;
  }

  const approvals = await Approval.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Approval.countDocuments(filter);

  res.json({
    success: true,
    data: {
      approvals,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

const createApproval = asyncHandler(async (req, res) => {
  const { taskId, agentRunId, type, riskLevel, action, details, requestedBy } = req.body;

  if (!taskId || !type || !riskLevel || !action) {
    throw new ApiError(400, 'Missing required approval fields: taskId, type, riskLevel, action');
  }

  const task = await Task.findOne({ _id: taskId, userId: req.user._id });
  if (!task) {
    throw new ApiError(404, 'Task not found');
  }

  const approval = await Approval.create({
    taskId,
    agentRunId: agentRunId || null,
    type,
    riskLevel,
    action,
    details: details || {},
    status: 'pending',
    requestedBy: requestedBy || 'system'
  });

  task.status = 'waiting_approval';
  await task.save();

  res.status(201).json({
    success: true,
    data: {
      approval
    }
  });
});

const approveAction = asyncHandler(async (req, res) => {
  const approval = await Approval.findById(req.params.id);
  if (!approval) {
    throw new ApiError(404, 'Approval request not found');
  }

  // Ensure user owns the task
  const task = await Task.findOne({ _id: approval.taskId, userId: req.user._id });
  if (!task) {
    throw new ApiError(403, 'Unauthorized to approve this action');
  }

  approval.status = 'approved';
  approval.decidedBy = req.user._id;
  approval.decidedAt = new Date();
  approval.reason = req.body.reason || 'Approved by user';
  await approval.save();

  // Resume task and update status
  task.status = 'running';
  await task.save();

  try {
    await agentClient.resumeTask(task._id.toString());
  } catch (error) {
    console.warn(`Agent resume warning for task ${task._id}:`, error.message);
  }

  res.json({
    success: true,
    data: {
      approval,
      task
    }
  });
});

const rejectAction = asyncHandler(async (req, res) => {
  const approval = await Approval.findById(req.params.id);
  if (!approval) {
    throw new ApiError(404, 'Approval request not found');
  }

  const task = await Task.findOne({ _id: approval.taskId, userId: req.user._id });
  if (!task) {
    throw new ApiError(403, 'Unauthorized to reject this action');
  }

  approval.status = 'rejected';
  approval.decidedBy = req.user._id;
  approval.decidedAt = new Date();
  approval.reason = req.body.reason || 'Rejected by user';
  await approval.save();

  // Cancel task and update status
  task.status = 'failed';
  await task.save();

  try {
    await agentClient.cancelTask(task._id.toString());
  } catch (error) {
    console.warn(`Agent cancel warning for task ${task._id}:`, error.message);
  }

  res.json({
    success: true,
    data: {
      approval,
      task
    }
  });
});

module.exports = {
  getApprovals,
  createApproval,
  approveAction,
  rejectAction
};
