// User types
export interface User {
  id: string;
  email: string;
  name?: string;
  role: 'user' | 'admin';
  createdAt?: string;
  lastLogin?: string;
}

// Task types
export type TaskStatus = 
  | 'pending' 
  | 'queued' 
  | 'running' 
  | 'waiting_approval' 
  | 'completed' 
  | 'failed' 
  | 'cancelled' 
  | 'budget_exceeded';

export type TaskPriority = 'low' | 'medium' | 'high';

export interface Budget {
  maxCost: number;
  spentCost: number;
  currency: string;
}

export interface TaskConfig {
  model: string;
  temperature: number;
  maxRetries: number;
  allowCodeExecution: boolean;
  tools: string[];
}

export interface Task {
  _id: string;
  userId: string;
  goal: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  budget: Budget;
  config: TaskConfig;
  result?: unknown;
  error?: {
    message: string;
    timestamp: string;
  };
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
}

// Agent Run types
export type AgentName = 'planner' | 'researcher' | 'coder' | 'reviewer' | 'finalizer';
export type AgentStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface AgentRun {
  _id: string;
  taskId: string;
  agentName: AgentName;
  parentRunId?: string;
  input?: unknown;
  output?: unknown;
  status: AgentStatus;
  cost?: {
    tokens: {
      input: number;
      output: number;
      total: number;
    };
    amount: number;
    currency: string;
  };
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  error?: {
    message: string;
    stack?: string;
  };
}

// Trace types
export type TraceStepType = 'thought' | 'action' | 'observation' | 'llm_call' | 'tool_call' | 'result' | 'error';

export interface TraceStep {
  _id: string;
  taskId: string;
  agentRunId: string;
  parentRunId?: string;
  stepType: TraceStepType;
  content: unknown;
  order: number;
  createdAt: string;
}

// Approval types
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface Approval {
  _id: string;
  taskId: string;
  agentRunId: string;
  type: 'tool_execution' | 'code_execution' | 'high_risk_action' | 'budget_override';
  riskLevel: RiskLevel;
  action: string;
  details?: unknown;
  status: ApprovalStatus;
  requestedBy: string;
  decidedBy?: string;
  decidedAt?: string;
  reason?: string;
  expiresAt?: string;
  createdAt: string;
}

// API response types
export interface AuthResponse {
  success: boolean;
  data: {
    user: User;
    token: string;
  };
}

export interface TaskResponse {
  success: boolean;
  data: {
    task: Task;
  };
}

export interface TasksResponse {
  success: boolean;
  data: {
    tasks: Task[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}

export interface AgentRunsResponse {
  success: boolean;
  data: {
    agentRuns: AgentRun[];
  };
}

export interface TracesResponse {
  success: boolean;
  data: {
    traces: TraceStep[];
  };
}

export interface ApprovalsResponse {
  success: boolean;
  data: {
    approvals: Approval[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}

// Dashboard types
export interface DashboardStats {
  totalTasks: number;
  activeRuns: number;
  successRate: number;
  totalCost: number;
  pendingApprovals: number;
  totalTokens: number;
  avgExecutionTime: number;
  agentUsage: {
    planner: number;
    researcher: number;
    coder: number;
    reviewer: number;
  };
}

export interface DashboardResponse {
  success: boolean;
  data: DashboardStats;
}

export interface ReplayMetric {
  output: unknown;
  cost: number;
  duration_ms: number;
  tokens: number;
}

export interface ReplayResult {
  taskId: string;
  traceId: string;
  agent: string;
  original: ReplayMetric;
  replay: ReplayMetric;
  diff: {
    cost_delta: number;
    speedup_ms: number;
  };
}

export interface ReplayResponse {
  success: boolean;
  data: ReplayResult;
}