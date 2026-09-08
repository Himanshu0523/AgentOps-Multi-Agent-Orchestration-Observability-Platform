const taskService = require('../services/taskService');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Create a new task and trigger agent execution
 */
const createTask = asyncHandler(async (req, res) => {
  const task = await taskService.createAndRunTask(req.body, req.user._id);

  res.status(201).json({
    success: true,
    data: {
      task,
    },
  });
});

/**
 * Get all tasks with pagination and filters
 */
const getTasks = asyncHandler(async (req, res) => {
  const result = await taskService.getTasks(req.user._id, req.query);

  res.json({
    success: true,
    data: result,
  });
});

/**
 * Get single task
 */
const getTask = asyncHandler(async (req, res) => {
  const task = await taskService.getTaskById(req.params.id, req.user._id);

  res.json({
    success: true,
    data: {
      task,
    },
  });
});

/**
 * Get task with full details (agent runs, trace steps)
 */
const getTaskWithDetails = asyncHandler(async (req, res) => {
  const details = await taskService.getTaskWithDetails(req.params.id, req.user._id);

  res.json({
    success: true,
    data: details,
  });
});

/**
 * Update task
 */
const updateTask = asyncHandler(async (req, res) => {
  const task = await taskService.updateTask(req.params.id, req.user._id, req.body);

  res.json({
    success: true,
    data: {
      task,
    },
  });
});

/**
 * Delete task
 */
const deleteTask = asyncHandler(async (req, res) => {
  await taskService.deleteTask(req.params.id, req.user._id);

  res.json({
    success: true,
    message: 'Task deleted successfully',
  });
});

/**
 * Get task agent runs
 */
const getTaskAgentRuns = asyncHandler(async (req, res) => {
  const agentRuns = await taskService.getTaskAgentRuns(req.params.id, req.user._id);

  res.json({
    success: true,
    data: {
      agentRuns,
    },
  });
});

/**
 * Get task traces
 */
const getTaskTraces = asyncHandler(async (req, res) => {
  const traces = await taskService.getTaskTraces(req.params.id, req.user._id);

  res.json({
    success: true,
    data: {
      traces,
    },
  });
});

/**
 * Pause task
 */
const pauseTask = asyncHandler(async (req, res) => {
  const task = await taskService.pauseTask(req.params.id, req.user._id);

  res.json({
    success: true,
    data: {
      task,
    },
  });
});

/**
 * Resume task
 */
const resumeTask = asyncHandler(async (req, res) => {
  const task = await taskService.resumeTask(req.params.id, req.user._id);

  res.json({
    success: true,
    data: {
      task,
    },
  });
});

/**
 * Cancel task
 */
const cancelTask = asyncHandler(async (req, res) => {
  const task = await taskService.cancelTask(req.params.id, req.user._id);

  res.json({
    success: true,
    data: {
      task,
    },
  });
});

/**
 * Replay specific trace step
 */
const replayTraceStep = asyncHandler(async (req, res) => {
  const { id: taskId, traceId } = req.params;
  const agentClient = require('../services/agentClient');
  
  // Verify task ownership
  await taskService.getTaskById(taskId, req.user._id);
  const replayResult = await agentClient.replayTraceStep(taskId, traceId);

  res.json({
    success: true,
    data: replayResult.data || replayResult,
  });
});

module.exports = {
  createTask,
  getTasks,
  getTask,
  getTaskWithDetails,
  updateTask,
  deleteTask,
  getTaskAgentRuns,
  getTaskTraces,
  pauseTask,
  resumeTask,
  cancelTask,
  replayTraceStep,
};
