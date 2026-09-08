import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/authStore';
import { TraceStep, AgentRun, Approval } from '@/types';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

export interface TraceUpdateEvent {
  event: string;
  taskId: string;
  traceStep: TraceStep;
}

export interface AgentUpdateEvent {
  event: string;
  taskId: string;
  agentRun: AgentRun;
}

export interface ApprovalUpdateEvent {
  event: string;
  taskId: string;
  approval: Approval;
}

class SocketClient {
  private socket: Socket | null = null;
  private currentTaskId: string | null = null;

  /**
   * Initialize socket connection with JWT
   */
  initialize() {
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    const token = useAuthStore.getState().token;
    if (!token) return null;

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('Socket.IO client connected:', this.socket?.id);
      if (this.currentTaskId && this.socket) {
        this.socket.emit('join-task', this.currentTaskId);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket.IO client disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.warn('Socket connection warning:', error.message);
    });

    return this.socket;
  }

  /**
   * Join a task room for real-time updates
   */
  joinTaskRoom(taskId: string) {
    if (!taskId) return;
    this.initialize();

    if (this.currentTaskId && this.currentTaskId !== taskId) {
      this.leaveTaskRoom(this.currentTaskId);
    }

    this.currentTaskId = taskId;
    if (this.socket) {
      this.socket.emit('join-task', taskId);
      console.log(`Joined task room: ${taskId}`);
    }
  }

  /**
   * Leave a task room
   */
  leaveTaskRoom(taskId: string) {
    if (!this.socket || !taskId) return;
    this.socket.emit('leave-task', taskId);
    if (this.currentTaskId === taskId) {
      this.currentTaskId = null;
    }
  }

  /**
   * Subscribe to trace updates
   */
  onTraceUpdate(callback: (data: TraceUpdateEvent) => void) {
    if (!this.socket) {
      this.initialize();
    }
    if (!this.socket) return () => {};

    this.socket.on('trace:update', callback);
    return () => {
      this.socket?.off('trace:update', callback);
    };
  }

  /**
   * Subscribe to agent run updates
   */
  onAgentUpdate(callback: (data: AgentUpdateEvent) => void) {
    if (!this.socket) {
      this.initialize();
    }
    if (!this.socket) return () => {};

    this.socket.on('agent:update', callback);
    return () => {
      this.socket?.off('agent:update', callback);
    };
  }

  /**
   * Subscribe to approval created events
   */
  onApprovalCreated(callback: (data: ApprovalUpdateEvent) => void) {
    if (!this.socket) {
      this.initialize();
    }
    if (!this.socket) return () => {};

    this.socket.on('approval:created', callback);
    return () => {
      this.socket?.off('approval:created', callback);
    };
  }

  /**
   * Subscribe to approval updated events
   */
  onApprovalUpdated(callback: (data: ApprovalUpdateEvent) => void) {
    if (!this.socket) {
      this.initialize();
    }
    if (!this.socket) return () => {};

    this.socket.on('approval:updated', callback);
    return () => {
      this.socket?.off('approval:updated', callback);
    };
  }

  /**
   * Disconnect socket
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.currentTaskId = null;
    }
  }
}

export const socketClient = new SocketClient();
export default socketClient;