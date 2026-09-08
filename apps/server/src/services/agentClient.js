const axios = require('axios');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const redisClient = require('../config/redis');

class AgentClient {
  constructor() {
    this.client = axios.create({
      baseURL: env.agentServiceUrl || 'http://localhost:8000',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    this.redisPublisher = redisClient;
  }

  /**
   * Run a task on the agent service
   */
  async runTask(taskId, goal, options = {}) {
    try {
      const payload = {
        task_id: taskId,
        goal_text: goal,
        goal: goal,
        description: options.description,
        budget: options.budget,
        config: options.config,
      };

      // Publish to Redis for async processing / event tracking
      try {
        if (this.redisPublisher && this.redisPublisher.status === 'ready') {
          await this.redisPublisher.publish('agent:tasks', JSON.stringify({
            type: 'RUN_TASK',
            payload,
            timestamp: new Date().toISOString(),
          }));
        }
      } catch (redisErr) {
        console.warn('Redis publish warning:', redisErr.message);
      }

      // HTTP call to Python agent service
      const response = await this.client.post('/run-task', payload);
      
      return {
        ...response.data,
        queued: true,
        queueTimestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Agent service error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });

      throw new ApiError(
        error.response?.status || 500,
        error.response?.data?.detail || 'Failed to communicate with agent service',
        false,
        error.stack
      );
    }
  }

  /**
   * Get task status from agent service
   */
  async getTaskStatus(taskId) {
    try {
      const response = await this.client.get(`/task/${taskId}/status`);
      return response.data;
    } catch (error) {
      console.error('Agent service status error:', {
        message: error.message,
        response: error.response?.data,
      });

      throw new ApiError(
        error.response?.status || 500,
        error.response?.data?.detail || 'Failed to get task status',
        false,
        error.stack
      );
    }
  }

  /**
   * Pause a running task
   */
  async pauseTask(taskId) {
    try {
      const response = await this.client.post(`/task/${taskId}/pause`);
      return response.data;
    } catch (error) {
      throw new ApiError(
        error.response?.status || 500,
        error.response?.data?.detail || 'Failed to pause task',
        false,
        error.stack
      );
    }
  }

  /**
   * Resume a paused task
   */
  async resumeTask(taskId) {
    try {
      const response = await this.client.post(`/task/${taskId}/resume`);
      return response.data;
    } catch (error) {
      throw new ApiError(
        error.response?.status || 500,
        error.response?.data?.detail || 'Failed to resume task',
        false,
        error.stack
      );
    }
  }

  /**
   * Cancel a running task
   */
  async cancelTask(taskId) {
    try {
      const response = await this.client.post(`/task/${taskId}/cancel`);
      return response.data;
    } catch (error) {
      throw new ApiError(
        error.response?.status || 500,
        error.response?.data?.detail || 'Failed to cancel task',
        false,
        error.stack
      );
    }
  }

  /**
   * Replay a historical trace step
   */
  async replayTraceStep(taskId, traceId) {
    try {
      const response = await this.client.post(`/task/${taskId}/replay/${traceId}`);
      return response.data;
    } catch (error) {
      throw new ApiError(
        error.response?.status || 500,
        error.response?.data?.detail || 'Failed to replay trace step',
        false,
        error.stack
      );
    }
  }

  /**
   * Check agent service health
   */
  async healthCheck() {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error) {
      console.error('Agent service health check failed:', error.message);
      return { status: 'error', service: 'agent-service' };
    }
  }
}

module.exports = new AgentClient();
