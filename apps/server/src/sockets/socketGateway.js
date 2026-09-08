const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { MongoClient } = require('mongodb');

class SocketGateway {
  constructor() {
    this.io = null;
    this.traceChangeStream = null;
    this.agentChangeStream = null;
    this.mongoClient = null;
  }

  /**
   * Initialize Socket.IO server
   */
  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: env.corsOrigin,
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    // Authentication middleware
    this.io.use((socket, next) => {
      const token = socket.handshake.auth?.token;
      
      if (!token) {
        return next(new Error('Authentication required'));
      }

      try {
        const decoded = jwt.verify(token, env.jwtSecret);
        socket.userId = decoded.id || decoded.userId || decoded._id;
        next();
      } catch (error) {
        next(new Error('Invalid token'));
      }
    });

    // Connection handler
    this.io.on('connection', (socket) => {
      console.log(`Socket connected: ${socket.id}, User: ${socket.userId}`);

      // Join user-specific room
      if (socket.userId) {
        socket.join(`user:${socket.userId}`);
      }

      // Join task-specific room
      socket.on('join-task', (taskId) => {
        if (taskId) {
          socket.join(`task:${taskId}`);
          console.log(`Socket ${socket.id} joined room task:${taskId}`);
        }
      });

      // Leave task-specific room
      socket.on('leave-task', (taskId) => {
        if (taskId) {
          socket.leave(`task:${taskId}`);
          console.log(`Socket ${socket.id} left room task:${taskId}`);
        }
      });

      socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.id}`);
      });
    });

    // Start MongoDB Change Streams for real-time trace events
    this.startChangeStreams();

    return this.io;
  }

  /**
   * Start MongoDB Change Streams
   */
  async startChangeStreams() {
    try {
      this.mongoClient = new MongoClient(env.mongodbUri);
      await this.mongoClient.connect();
      
      const db = this.mongoClient.db();
      
      // Watch tracesteps collection (primary Mongoose model)
      const traceCollection = db.collection('tracesteps');
      this.traceChangeStream = traceCollection.watch();

      this.traceChangeStream.on('change', (change) => {
        if (change.operationType === 'insert' && change.fullDocument) {
          this.emitTraceUpdate(change.fullDocument);
        }
      });

      // Watch agentruns collection
      const agentRunCollection = db.collection('agentruns');
      this.agentChangeStream = agentRunCollection.watch();

      this.agentChangeStream.on('change', (change) => {
        if ((change.operationType === 'insert' || change.operationType === 'update' || change.operationType === 'replace') && change.fullDocument) {
          this.emitAgentRunUpdate(change.fullDocument);
        }
      });

      // Watch approvals collection
      const approvalCollection = db.collection('approvals');
      this.approvalChangeStream = approvalCollection.watch();

      this.approvalChangeStream.on('change', (change) => {
        if (change.operationType === 'insert' && change.fullDocument) {
          this.emitApprovalUpdate(change.fullDocument, 'approval:created');
        } else if ((change.operationType === 'update' || change.operationType === 'replace') && change.fullDocument) {
          this.emitApprovalUpdate(change.fullDocument, 'approval:updated');
        }
      });

      console.log('✓ MongoDB Change Streams active for tracesteps, agentruns, and approvals');
    } catch (error) {
      console.warn('⚠ Notice: MongoDB Change Streams not available (replica set required). Realtime fallback active.', error.message);
    }
  }

  /**
   * Emit approval update to task and user rooms
   */
  emitApprovalUpdate(approval, eventName = 'approval:updated') {
    const rawTaskId = approval.taskId || approval.task_id;
    if (!rawTaskId) return;

    const taskId = rawTaskId.toString();
    const payload = {
      event: eventName,
      taskId,
      approval: {
        _id: approval._id ? approval._id.toString() : Date.now().toString(),
        taskId,
        agentRunId: approval.agentRunId ? approval.agentRunId.toString() : (approval.agent_run_id ? approval.agent_run_id.toString() : null),
        type: approval.type,
        riskLevel: approval.riskLevel || approval.risk_level || 'high',
        action: approval.action,
        details: approval.details,
        status: approval.status,
        requestedBy: approval.requestedBy || approval.requested_by,
        decidedBy: approval.decidedBy ? approval.decidedBy.toString() : null,
        decidedAt: approval.decidedAt,
        reason: approval.reason,
        createdAt: approval.createdAt || new Date().toISOString()
      }
    };

    if (this.io) {
      this.io.to(`task:${taskId}`).emit(eventName, payload);
      this.io.emit(eventName, payload);
      console.log(`Approval event ${eventName} emitted for task:${taskId}, risk: ${payload.approval.riskLevel}`);
    }
  }

  /**
   * Emit trace update to task room
   */
  emitTraceUpdate(traceStep) {
    const rawTaskId = traceStep.taskId || traceStep.task_id;
    if (!rawTaskId) return;

    const taskId = rawTaskId.toString();
    const payload = {
      event: 'trace:update',
      taskId,
      traceStep: {
        _id: traceStep._id ? traceStep._id.toString() : Date.now().toString(),
        taskId,
        agentRunId: traceStep.agentRunId ? traceStep.agentRunId.toString() : (traceStep.agent_run_id ? traceStep.agent_run_id.toString() : null),
        parentRunId: traceStep.parentRunId ? traceStep.parentRunId.toString() : (traceStep.parent_run_id ? traceStep.parent_run_id.toString() : null),
        stepType: traceStep.stepType || traceStep.step_type || 'action',
        content: traceStep.content,
        order: traceStep.order ?? 0,
        createdAt: traceStep.createdAt || traceStep.created_at || new Date().toISOString(),
      },
    };

    if (this.io) {
      this.io.to(`task:${taskId}`).emit('trace:update', payload);
      console.log(`Trace update emitted to task:${taskId}, step: ${payload.traceStep.stepType}`);
    }
  }

  /**
   * Emit agent run update to task room
   */
  emitAgentRunUpdate(agentRun) {
    const rawTaskId = agentRun.taskId || agentRun.task_id;
    if (!rawTaskId) return;

    const taskId = rawTaskId.toString();
    const payload = {
      event: 'agent:update',
      taskId,
      agentRun: {
        _id: agentRun._id ? agentRun._id.toString() : Date.now().toString(),
        taskId,
        agentName: agentRun.agentName || agentRun.agent_name,
        parentRunId: agentRun.parentRunId ? agentRun.parentRunId.toString() : (agentRun.parent_run_id ? agentRun.parent_run_id.toString() : null),
        status: agentRun.status,
        input: agentRun.input,
        output: agentRun.output,
        cost: agentRun.cost,
        startedAt: agentRun.startedAt || agentRun.started_at,
        completedAt: agentRun.completedAt || agentRun.completed_at,
        duration: agentRun.duration,
        error: agentRun.error,
      },
    };

    if (this.io) {
      this.io.to(`task:${taskId}`).emit('agent:update', payload);
      console.log(`Agent update emitted to task:${taskId}, agent: ${payload.agentRun.agentName}`);
    }
  }

  /**
   * Close all stream and socket connections
   */
  async close() {
    try {
      if (this.traceChangeStream) {
        await this.traceChangeStream.close();
      }
      if (this.agentChangeStream) {
        await this.agentChangeStream.close();
      }
      if (this.approvalChangeStream) {
        await this.approvalChangeStream.close();
      }
      if (this.mongoClient) {
        await this.mongoClient.close();
      }
      if (this.io) {
        this.io.close();
      }
    } catch (err) {
      console.error('Error closing SocketGateway:', err);
    }
  }
}

module.exports = new SocketGateway();
