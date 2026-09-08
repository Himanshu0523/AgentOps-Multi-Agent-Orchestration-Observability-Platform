'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Square, 
  RefreshCw,
  Activity,
  Users,
  DollarSign,
  FileText,
  GitBranch,
  Play,
  Pause,
  ShieldAlert,
  CheckCircle,
  XCircle
} from 'lucide-react';
import api from '@/lib/api';
import { socketClient } from '@/lib/socket';
import { 
  Task, 
  AgentRun, 
  TraceStep, 
  Approval, 
  TaskResponse, 
  AgentRunsResponse, 
  TracesResponse,
  ApprovalsResponse 
} from '@/types';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Tabs } from '@/components/ui/Tabs';
import { TraceTree } from '@/components/trace/TraceTree';

export default function AgentWorkspacePage() {
  const params = useParams();
  const taskId = Array.isArray(params.taskId) ? params.taskId[0] : params.taskId;
  const [task, setTask] = useState<Task | null>(null);
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [traces, setTraces] = useState<TraceStep[]>([]);
  const [pendingApproval, setPendingApproval] = useState<Approval | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const fetchTaskData = useCallback(async () => {
    if (!taskId) return;
    try {
      const [taskRes, runsRes, tracesRes, approvalsRes] = await Promise.all([
        api.get<TaskResponse>(`/tasks/${taskId}`),
        api.get<AgentRunsResponse>(`/tasks/${taskId}/agent-runs`),
        api.get<TracesResponse>(`/tasks/${taskId}/traces`),
        api.get<ApprovalsResponse>('/approvals?status=pending').catch(() => null),
      ]);
      const fetchedTask = taskRes?.data?.task || null;
      setTask(fetchedTask);
      setAgentRuns(runsRes?.data?.agentRuns || []);
      setTraces(tracesRes?.data?.traces || []);

      const approvalsList = approvalsRes?.data?.approvals || [];
      const currentApproval = approvalsList.find((a) => a.taskId === taskId && a.status === 'pending');
      setPendingApproval(currentApproval || null);
    } catch (error) {
      console.error('Failed to fetch task data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  // Initial fetch
  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      if (!taskId) return;
      try {
        const [taskRes, runsRes, tracesRes, approvalsRes] = await Promise.all([
          api.get<TaskResponse>(`/tasks/${taskId}`),
          api.get<AgentRunsResponse>(`/tasks/${taskId}/agent-runs`),
          api.get<TracesResponse>(`/tasks/${taskId}/traces`),
          api.get<ApprovalsResponse>('/approvals?status=pending').catch(() => null),
        ]);
        if (isMounted) {
          setTask(taskRes?.data?.task || null);
          setAgentRuns(runsRes?.data?.agentRuns || []);
          setTraces(tracesRes?.data?.traces || []);
          const approvalsList = approvalsRes?.data?.approvals || [];
          const currentApproval = approvalsList.find((a) => a.taskId === taskId && a.status === 'pending');
          setPendingApproval(currentApproval || null);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Failed to fetch task data:', error);
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [taskId]);

  // Socket.IO real-time subscription
  useEffect(() => {
    if (!taskId) return;
    const currentId = String(taskId);

    socketClient.joinTaskRoom(currentId);
    const connTimer = setTimeout(() => setIsConnected(true), 0);

    const unsubTrace = socketClient.onTraceUpdate((data) => {
      if (data.taskId === currentId && data.traceStep) {
        setTraces((prev) => {
          if (prev.some((t) => t._id === data.traceStep._id)) return prev;
          return [...prev, data.traceStep];
        });
      }
    });

    const unsubAgent = socketClient.onAgentUpdate((data) => {
      if (data.taskId === currentId && data.agentRun) {
        setAgentRuns((prev) => {
          const idx = prev.findIndex((r) => r._id === data.agentRun._id);
          if (idx !== -1) {
            const updated = [...prev];
            updated[idx] = data.agentRun;
            return updated;
          }
          return [...prev, data.agentRun];
        });
      }
    });

    const unsubApprovalCreated = socketClient.onApprovalCreated((data) => {
      if (data.taskId === currentId) {
        setPendingApproval(data.approval);
        setTask((prev) => (prev ? { ...prev, status: 'waiting_approval' } : null));
      }
    });

    const unsubApprovalUpdated = socketClient.onApprovalUpdated((data) => {
      if (data.taskId === currentId) {
        if (data.approval.status !== 'pending') {
          setPendingApproval(null);
        }
        fetchTaskData();
      }
    });

    return () => {
      clearTimeout(connTimer);
      unsubTrace();
      unsubAgent();
      unsubApprovalCreated();
      unsubApprovalUpdated();
      socketClient.leaveTaskRoom(currentId);
    };
  }, [taskId, fetchTaskData]);

  // Approval actions
  const handleApproveApproval = async (approvalId: string) => {
    setIsActionLoading(true);
    try {
      await api.post(`/approvals/${approvalId}/approve`);
      setPendingApproval(null);
      await fetchTaskData();
    } catch (error) {
      console.error('Failed to approve action:', error);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRejectApproval = async (approvalId: string) => {
    setIsActionLoading(true);
    try {
      await api.post(`/approvals/${approvalId}/reject`);
      setPendingApproval(null);
      await fetchTaskData();
    } catch (error) {
      console.error('Failed to reject action:', error);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Task control actions
  const handlePause = async () => {
    if (!taskId) return;
    setIsActionLoading(true);
    try {
      await api.post(`/tasks/${taskId}/pause`);
      await fetchTaskData();
    } catch (err) {
      console.error('Failed to pause task:', err);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleResume = async () => {
    if (!taskId) return;
    setIsActionLoading(true);
    try {
      await api.post(`/tasks/${taskId}/resume`);
      await fetchTaskData();
    } catch (err) {
      console.error('Failed to resume task:', err);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!taskId) return;
    setIsActionLoading(true);
    try {
      await api.post(`/tasks/${taskId}/cancel`);
      await fetchTaskData();
    } catch (err) {
      console.error('Failed to stop task:', err);
    } finally {
      setIsActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p className="text-gray-500">Task not found</p>
      </div>
    );
  }

  const tabs = [
    {
      id: 'trace',
      label: 'Trace Tree',
      icon: <GitBranch className="h-4 w-4" />,
      content: <TraceTree traces={traces} agentRuns={agentRuns} taskId={taskId} />,
    },
    {
      id: 'overview',
      label: 'Overview',
      icon: <Activity className="h-4 w-4" />,
      content: <OverviewTab task={task} />,
    },
    {
      id: 'agents',
      label: 'Agents',
      icon: <Users className="h-4 w-4" />,
      content: <AgentsTab agentRuns={agentRuns} />,
    },
    {
      id: 'cost',
      label: 'Cost',
      icon: <DollarSign className="h-4 w-4" />,
      content: <CostTab task={task} agentRuns={agentRuns} />,
    },
    {
      id: 'output',
      label: 'Output',
      icon: <FileText className="h-4 w-4" />,
      content: <OutputTab task={task} />,
    },
  ];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <Link href="/tasks" className="flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Tasks
        </Link>
        
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{task.goal}</h1>
              {isConnected && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full font-medium">
                  <span className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse" />
                  Live Trace
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={getStatusVariant(task.status)}>
                {task.status}
              </Badge>
              <span className="text-sm text-gray-500">
                Started {new Date(task.createdAt).toLocaleString()}
              </span>
            </div>
          </div>
          
          <div className="flex gap-2">
            {task.status === 'running' && (
              <>
                <Button 
                  variant="outline" 
                  size="sm" 
                  isLoading={isActionLoading}
                  icon={<Pause className="h-4 w-4" />} 
                  onClick={handlePause}
                >
                  Pause
                </Button>
                <Button 
                  variant="danger" 
                  size="sm" 
                  isLoading={isActionLoading}
                  icon={<Square className="h-4 w-4" />} 
                  onClick={handleCancel}
                >
                  Stop
                </Button>
              </>
            )}

            {task.status === 'waiting_approval' && (
              <Button 
                variant="success" 
                size="sm" 
                isLoading={isActionLoading}
                icon={<Play className="h-4 w-4" />} 
                onClick={handleResume}
              >
                Resume
              </Button>
            )}

            <Button 
              variant="outline" 
              size="sm" 
              icon={<RefreshCw className="h-4 w-4" />}
              onClick={() => fetchTaskData()}
            >
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Human Approval Required Banner */}
      {task.status === 'waiting_approval' && pendingApproval && (
        <div className="mb-6 p-5 bg-amber-50 border-2 border-amber-300 rounded-xl shadow-sm animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-6 w-6 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-sm font-bold text-amber-900">HUMAN APPROVAL REQUIRED</span>
                  <Badge variant={pendingApproval.riskLevel === 'critical' ? 'danger' : 'warning'}>
                    {pendingApproval.riskLevel.toUpperCase()} RISK
                  </Badge>
                  <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded font-mono">
                    Agent: {pendingApproval.requestedBy}
                  </span>
                </div>
                <p className="text-sm font-semibold text-gray-900">{pendingApproval.action}</p>
                {Boolean(pendingApproval.details) && (
                  <pre className="text-xs bg-amber-100/60 text-amber-950 p-2 rounded mt-2 overflow-x-auto font-mono max-h-32">
                    {JSON.stringify(pendingApproval.details, null, 2)}
                  </pre>
                )}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                variant="danger"
                size="sm"
                icon={<XCircle className="h-4 w-4" />}
                onClick={() => handleRejectApproval(pendingApproval._id)}
                isLoading={isActionLoading}
              >
                Reject & Halt
              </Button>
              <Button
                variant="success"
                size="sm"
                icon={<CheckCircle className="h-4 w-4" />}
                onClick={() => handleApproveApproval(pendingApproval._id)}
                isLoading={isActionLoading}
              >
                Authorize & Resume
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs with Trace Tree as default */}
      <Tabs tabs={tabs} defaultTab="trace" />
    </div>
  );
}

function OverviewTab({ task }: { task: Task }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Task Details</h3>
        <div className="space-y-3">
          <DetailRow label="Priority" value={task.priority} />
          <DetailRow label="Model" value={task.config.model} />
          <DetailRow label="Temperature" value={task.config.temperature.toString()} />
          <DetailRow label="Max Retries" value={task.config.maxRetries.toString()} />
          <DetailRow 
            label="Code Execution" 
            value={task.config.allowCodeExecution ? 'Allowed' : 'Disallowed'} 
          />
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Budget & Timing</h3>
        <div className="space-y-3">
          <DetailRow label="Max Budget" value={`$${task.budget.maxCost.toFixed(2)}`} />
          <DetailRow label="Spent" value={`$${task.budget.spentCost.toFixed(4)}`} />
          <DetailRow label="Currency" value={task.budget.currency} />
          {task.duration && (
            <DetailRow 
              label="Duration" 
              value={`${(task.duration / 1000).toFixed(1)}s`} 
            />
          )}
        </div>
      </Card>

      {task.description && (
        <Card className="p-6 md:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Description</h3>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{task.description}</p>
        </Card>
      )}

      {task.error && (
        <Card className="p-6 border-red-200 bg-red-50/50 md:col-span-2">
          <h3 className="text-lg font-semibold text-red-900 mb-2">Error Details</h3>
          <p className="text-sm text-red-700">{task.error.message}</p>
        </Card>
      )}
    </div>
  );
}

function AgentsTab({ agentRuns }: { agentRuns: AgentRun[] }) {
  if (agentRuns.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
        <p className="text-gray-500">No agent runs recorded yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {agentRuns.map((run) => (
        <Card key={run._id} className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900 capitalize">{run.agentName}</span>
              <Badge variant={getAgentStatusVariant(run.status)}>{run.status}</Badge>
            </div>
            {run.duration && (
              <span className="text-xs text-gray-500">
                {(run.duration / 1000).toFixed(1)}s
              </span>
            )}
          </div>
          
          {Boolean(run.input) && (
            <div className="mb-2">
              <p className="text-xs font-medium text-gray-500 mb-1">Input</p>
              <pre className="text-xs text-gray-600 bg-gray-50 rounded p-2.5 overflow-x-auto font-mono">
                {JSON.stringify(run.input, null, 2)}
              </pre>
            </div>
          )}
          
          {Boolean(run.output) && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Output</p>
              <pre className="text-xs text-gray-600 bg-gray-50 rounded p-2.5 overflow-x-auto font-mono">
                {JSON.stringify(run.output, null, 2)}
              </pre>
            </div>
          )}
          
          {run.cost && (
            <div className="mt-2.5 flex items-center gap-4 text-xs text-gray-500 pt-2 border-t border-gray-100">
              <span>Tokens: {run.cost.tokens.total}</span>
              <span>Cost: ${run.cost.amount.toFixed(4)}</span>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

function CostTab({ task, agentRuns }: { task: Task; agentRuns: AgentRun[] }) {
  const totalTokens = agentRuns.reduce((sum, run) => sum + (run.cost?.tokens.total || 0), 0);
  const totalCost = agentRuns.reduce((sum, run) => sum + (run.cost?.amount || 0), 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="p-6">
        <h3 className="text-sm font-medium text-gray-500 mb-2">Total Cost</h3>
        <p className="text-3xl font-bold text-gray-900">${totalCost.toFixed(4)}</p>
      </Card>
      
      <Card className="p-6">
        <h3 className="text-sm font-medium text-gray-500 mb-2">Total Tokens</h3>
        <p className="text-3xl font-bold text-gray-900">{totalTokens.toLocaleString()}</p>
      </Card>
      
      <Card className="p-6">
        <h3 className="text-sm font-medium text-gray-500 mb-2">Budget Used</h3>
        <p className="text-3xl font-bold text-gray-900">
          {task.budget.maxCost > 0 ? ((task.budget.spentCost / task.budget.maxCost) * 100).toFixed(1) : '0.0'}%
        </p>
      </Card>

      <Card className="p-6 md:col-span-3">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost Breakdown by Agent</h3>
        {agentRuns.length === 0 ? (
          <p className="text-sm text-gray-500">No agent run costs recorded yet</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                <th className="pb-2">Agent</th>
                <th className="pb-2">Tokens</th>
                <th className="pb-2">Cost</th>
                <th className="pb-2">Duration</th>
              </tr>
            </thead>
            <tbody>
              {agentRuns.map((run) => (
                <tr key={run._id} className="border-t border-gray-100">
                  <td className="py-2.5 text-sm font-medium text-gray-900 capitalize">{run.agentName}</td>
                  <td className="py-2.5 text-sm text-gray-600">{run.cost?.tokens.total || 0}</td>
                  <td className="py-2.5 text-sm text-gray-600">${run.cost?.amount.toFixed(4) || '0.00'}</td>
                  <td className="py-2.5 text-sm text-gray-600">
                    {run.duration ? `${(run.duration / 1000).toFixed(1)}s` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function OutputTab({ task }: { task: Task }) {
  if (!task.result) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
        <p className="text-gray-500">No output deliverables available yet</p>
      </div>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Executive Output Artifact</h3>
      <pre className="text-sm text-gray-700 bg-gray-50 p-4 rounded-lg overflow-x-auto font-mono">
        {JSON.stringify(task.result, null, 2)}
      </pre>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900 capitalize">{value}</span>
    </div>
  );
}

function getStatusVariant(status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  switch (status) {
    case 'completed':
      return 'success';
    case 'running':
    case 'queued':
      return 'info';
    case 'waiting_approval':
      return 'warning';
    case 'failed':
    case 'budget_exceeded':
      return 'danger';
    default:
      return 'neutral';
  }
}

function getAgentStatusVariant(status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  switch (status) {
    case 'completed':
      return 'success';
    case 'running':
      return 'info';
    case 'failed':
      return 'danger';
    case 'skipped':
      return 'warning';
    default:
      return 'neutral';
  }
}