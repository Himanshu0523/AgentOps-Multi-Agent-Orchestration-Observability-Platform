const Task = require('../models/Task');
const AgentRun = require('../models/AgentRun');
const TraceStep = require('../models/TraceStep');
const ApiError = require('../utils/ApiError');
const agentClient = require('./agentClient');

class TaskService {
  /**
   * Create a new task
   */
  async createTask(taskData, userId) {
    const task = await Task.create({
      ...taskData,
      userId,
    });

    return task;
  }

  /**
   * Create and run a task
   */
  async createAndRunTask(taskData, userId) {
    // Create task in database
    const task = await this.createTask(taskData, userId);

    // Create initial trace step
    try {
      await TraceStep.create({
        taskId: task._id,
        agentRunId: null,
        parentRunId: null,
        stepType: 'action',
        content: {
          message: 'Task created',
          goal: task.goal,
        },
        order: 0,
      });
    } catch (traceErr) {
      console.warn('Could not record initial trace step:', traceErr.message);
    }

    // Trigger agent execution
    try {
      const agentResponse = await agentClient.runTask(
        task._id.toString(),
        task.goal,
        {
          description: task.description,
          budget: task.budget,
          config: task.config,
        }
      );

      // Update task with agent response
      task.status = agentResponse.status || 'queued';
      task.startedAt = new Date();
      await task.save();

      return task;
    } catch (error) {
      // Update task status to failed
      task.status = 'failed';
      task.error = {
        message: error.message,
        timestamp: new Date(),
      };
      await task.save();

      // Create error trace
      try {
        await TraceStep.create({
          taskId: task._id,
          agentRunId: null,
          parentRunId: null,
          stepType: 'error',
          content: {
            message: error.message,
          },
          order: 1,
        });
      } catch (errTrace) {
        console.warn('Could not record error trace step:', errTrace.message);
      }

      throw error;
    }
  }

  /**
   * Get task by ID with user check
   */
  async getTaskById(taskId, userId) {
    const query = { _id: taskId };
    if (userId) {
      query.userId = userId;
    }

    const task = await Task.findOne(query);

    if (!task) {
      throw new ApiError(404, 'Task not found');
    }

    return task;
  }

  /**
   * Get all tasks for user with pagination and filters
   */
  async getTasks(userId, filters = {}) {
    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 10;
    const skip = (page - 1) * limit;

    const query = { userId };

    // Apply filters
    if (filters.status && filters.status !== 'all') {
      query.status = filters.status;
    }
    if (filters.priority && filters.priority !== 'all') {
      query.priority = filters.priority;
    }

    const tasks = await Task.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Task.countDocuments(query);

    return {
      tasks,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update task
   */
  async updateTask(taskId, userId, updateData) {
    await this.getTaskById(taskId, userId);

    const allowedUpdates = ['goal', 'description', 'priority', 'status', 'config', 'budget'];
    const updates = {};

    Object.keys(updateData).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        updates[key] = updateData[key];
      }
    });

    const updatedTask = await Task.findByIdAndUpdate(
      taskId,
      updates,
      { new: true, runValidators: true }
    );

    return updatedTask;
  }

  /**
   * Delete task
   */
  async deleteTask(taskId, userId) {
    const task = await this.getTaskById(taskId, userId);

    if (['running', 'queued'].includes(task.status)) {
      throw new ApiError(400, 'Cannot delete a running task. Cancel it first.');
    }

    await Task.findByIdAndDelete(taskId);
  }

  /**
   * Get task with all related data (task, agentRuns, traceSteps)
   */
  async getTaskWithDetails(taskId, userId) {
    const task = await this.getTaskById(taskId, userId);

    const agentRuns = await AgentRun.find({ taskId })
      .sort({ createdAt: 1 });

    const traceSteps = await TraceStep.find({ taskId })
      .sort({ order: 1 });

    return {
      task,
      agentRuns,
      traceSteps,
    };
  }

  /**
   * Get task agent runs
   */
  async getTaskAgentRuns(taskId, userId) {
    await this.getTaskById(taskId, userId);

    const agentRuns = await AgentRun.find({ taskId })
      .sort({ createdAt: 1 });

    return agentRuns;
  }

  /**
   * Get task traces
   */
  async getTaskTraces(taskId, userId) {
    await this.getTaskById(taskId, userId);

    const traces = await TraceStep.find({ taskId })
      .sort({ order: 1 });

    return traces;
  }

  /**
   * Pause a running task
   */
  async pauseTask(taskId, userId) {
    const task = await this.getTaskById(taskId, userId);

    if (task.status !== 'running') {
      throw new ApiError(400, 'Only running tasks can be paused');
    }

    try {
      await agentClient.pauseTask(taskId);
    } catch (e) {
      console.warn('Agent client pause error, setting status locally:', e.message);
    }

    task.status = 'waiting_approval';
    await task.save();

    return task;
  }

  /**
   * Resume a paused task
   */
  async resumeTask(taskId, userId) {
    const task = await this.getTaskById(taskId, userId);

    if (task.status !== 'waiting_approval') {
      throw new ApiError(400, 'Only paused tasks can be resumed');
    }

    try {
      await agentClient.resumeTask(taskId);
    } catch (e) {
      console.warn('Agent client resume error, setting status locally:', e.message);
    }

    task.status = 'running';
    await task.save();

    return task;
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId, userId) {
    const task = await this.getTaskById(taskId, userId);

    if (['completed', 'failed', 'cancelled'].includes(task.status)) {
      throw new ApiError(400, 'Cannot cancel a completed, failed, or cancelled task');
    }

    try {
      await agentClient.cancelTask(taskId);
    } catch (e) {
      console.warn('Agent client cancel error, setting status locally:', e.message);
    }

    task.status = 'cancelled';
    task.completedAt = new Date();
    await task.save();

    return task;
  }
}

module.exports = new TaskService();
