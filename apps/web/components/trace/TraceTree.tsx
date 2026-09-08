'use client';

import React, { useState } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  Brain, 
  Search, 
  Code, 
  CheckCircle, 
  XCircle,
  Clock,
  DollarSign,
  Wrench,
  FileText,
  RotateCcw
} from 'lucide-react';
import { TraceStep, AgentRun, ReplayResult, ReplayResponse } from '@/types';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { ReplayModal } from './ReplayModal';

interface TraceTreeProps {
  traces: TraceStep[];
  agentRuns: AgentRun[];
  taskId?: string;
}

interface TreeNode {
  id: string;
  agentName: string;
  parentId: string | null;
  children: TreeNode[];
  agentRun?: AgentRun;
  traceSteps: TraceStep[];
}

export const TraceTree: React.FC<TraceTreeProps> = ({ traces, agentRuns, taskId }) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [replayModalOpen, setReplayModalOpen] = useState(false);
  const [replayResult, setReplayResult] = useState<ReplayResult | null>(null);
  const [isReplaying, setIsReplaying] = useState(false);

  const handleReplay = async (trace: TraceStep) => {
    const targetTaskId = taskId || trace.taskId || traces[0]?.taskId;
    if (!targetTaskId) return;

    setReplayResult(null);
    setIsReplaying(true);
    setReplayModalOpen(true);

    try {
      const response = await api.post<ReplayResponse>(
        `/tasks/${targetTaskId}/traces/${trace._id}/replay`
      );
      if (response && response.data) {
        setReplayResult(response.data);
      }
    } catch (err) {
      console.error('Failed to replay trace step:', err);
    } finally {
      setIsReplaying(false);
    }
  };

  const buildTree = (): TreeNode[] => {
    // If there are agent runs, build hierarchy from agentRuns
    if (agentRuns.length > 0) {
      const nodes: TreeNode[] = agentRuns.map((run) => ({
        id: run._id,
        agentName: run.agentName,
        parentId: run.parentRunId || null,
        children: [],
        agentRun: run,
        traceSteps: traces.filter((trace) => trace.agentRunId === run._id),
      }));

      const nodeMap = new Map(nodes.map((node) => [node.id, node]));
      const rootNodes: TreeNode[] = [];

      nodes.forEach((node) => {
        if (node.parentId && nodeMap.has(node.parentId)) {
          const parent = nodeMap.get(node.parentId)!;
          parent.children.push(node);
        } else {
          rootNodes.push(node);
        }
      });

      return rootNodes;
    }

    // Fallback: If no agent runs exist yet but there are root traces
    if (traces.length > 0) {
      return [
        {
          id: 'root-execution',
          agentName: 'planner',
          parentId: null,
          children: [],
          agentRun: undefined,
          traceSteps: traces,
        },
      ];
    }

    return [];
  };

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const tree = buildTree();

  if (tree.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
        <Brain className="h-10 w-10 text-gray-400 mx-auto mb-3 animate-pulse" />
        <h3 className="text-base font-semibold text-gray-900">Waiting for agent execution...</h3>
        <p className="text-sm text-gray-500 mt-1">
          Execution hierarchy and real-time trace steps will appear here as agents start.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tree.map((node) => (
        <TraceNode
          key={node.id}
          node={node}
          expandedNodes={expandedNodes}
          selectedNode={selectedNode}
          onToggle={toggleNode}
          onSelect={setSelectedNode}
          onReplay={handleReplay}
          level={0}
        />
      ))}

      <ReplayModal
        isOpen={replayModalOpen}
        onClose={() => setReplayModalOpen(false)}
        result={replayResult}
        isLoading={isReplaying}
      />
    </div>
  );
};

interface TraceNodeProps {
  node: TreeNode;
  expandedNodes: Set<string>;
  selectedNode: string | null;
  onToggle: (nodeId: string) => void;
  onSelect: (nodeId: string) => void;
  onReplay: (trace: TraceStep) => void;
  level: number;
}

const TraceNode: React.FC<TraceNodeProps> = ({
  node,
  expandedNodes,
  selectedNode,
  onToggle,
  onSelect,
  onReplay,
  level,
}) => {
  const isExpanded = expandedNodes.has(node.id) || expandedNodes.size === 0;
  const isSelected = selectedNode === node.id;
  const hasChildren = node.children.length > 0;
  const hasTraces = node.traceSteps.length > 0;

  const agentIcon = getAgentIcon(node.agentName);
  const statusIcon = getStatusIcon(node.agentRun?.status || 'pending');

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm mb-3">
      <div
        className={cn(
          'flex items-center gap-3 p-4 cursor-pointer transition-colors select-none',
          isSelected ? 'bg-blue-50/70 border-b border-blue-200' : 'hover:bg-gray-50/80',
          level > 0 && 'ml-4'
        )}
        onClick={() => onSelect(node.id)}
      >
        {/* Expand/Collapse Chevron */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle(node.id);
          }}
          className="p-1 hover:bg-gray-200 rounded text-gray-500 transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        {/* Agent Icon */}
        <div className="p-2.5 bg-gray-100 rounded-lg shrink-0">
          {agentIcon}
        </div>

        {/* Agent Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 capitalize text-sm">{node.agentName}</span>
            {statusIcon}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-1">
            {node.agentRun?.duration && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-gray-400" />
                {(node.agentRun.duration / 1000).toFixed(1)}s
              </span>
            )}
            {node.agentRun?.cost?.amount !== undefined && (
              <span className="flex items-center gap-1">
                <DollarSign className="h-3 w-3 text-gray-400" />
                ${node.agentRun.cost.amount.toFixed(4)}
              </span>
            )}
            {node.agentRun?.cost?.tokens?.total !== undefined && (
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3 text-gray-400" />
                {node.agentRun.cost.tokens.total} tokens
              </span>
            )}
          </div>
        </div>

        {/* Trace Steps count badge */}
        {hasTraces && (
          <span className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full font-medium shrink-0">
            {node.traceSteps.length} {node.traceSteps.length === 1 ? 'step' : 'steps'}
          </span>
        )}
      </div>

      {/* Expanded Content: Trace steps & children */}
      {isExpanded && (
        <div className="border-t border-gray-100 bg-gray-50/50 p-4 space-y-3">
          {/* Trace Steps list */}
          {hasTraces && (
            <div className="space-y-2">
              <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Execution Steps
              </h5>
              {node.traceSteps.map((trace) => (
                <TraceStepItem key={trace._id} trace={trace} onReplay={onReplay} />
              ))}
            </div>
          )}

          {/* Child Agent Nodes */}
          {hasChildren && (
            <div className="pt-2 space-y-3">
              <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Sub-Agents
              </h5>
              {node.children.map((child) => (
                <TraceNode
                  key={child.id}
                  node={child}
                  expandedNodes={expandedNodes}
                  selectedNode={selectedNode}
                  onToggle={onToggle}
                  onSelect={onSelect}
                  onReplay={onReplay}
                  level={level + 1}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Selected Node Details Drawer */}
      {isSelected && (
        <div className="p-4 bg-blue-50/40 border-t border-blue-100">
          <TraceNodeDetails node={node} onReplay={onReplay} />
        </div>
      )}
    </div>
  );
};

const TraceStepItem: React.FC<{ 
  trace: TraceStep; 
  onReplay?: (trace: TraceStep) => void; 
}> = ({ trace, onReplay }) => {
  const contentObj = trace.content && typeof trace.content === 'object' 
    ? (trace.content as Record<string, unknown>) 
    : null;
  const message = contentObj?.message 
    ? String(contentObj.message) 
    : typeof trace.content === 'string' 
    ? trace.content 
    : trace.stepType;

  return (
    <div className="flex items-start justify-between gap-3 py-2 px-3 bg-white rounded-lg border border-gray-200/70 text-xs hover:border-blue-200 transition-colors">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className="p-1.5 bg-gray-100 rounded shrink-0 mt-0.5">
          {getStepIcon(trace.stepType)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-800 capitalize">{trace.stepType}</span>
            <span className="text-gray-400">Step {trace.order}</span>
            {Boolean(contentObj?.tool) && (
              <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded font-mono">
                Tool: {String(contentObj?.tool)}
              </span>
            )}
          </div>
          <p className="text-gray-600 mt-1 break-words">{message}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onReplay?.(trace);
          }}
          title="Replay this step"
          className="flex items-center gap-1 px-2 py-1 rounded bg-gray-50 hover:bg-blue-50 text-gray-600 hover:text-blue-700 transition-colors border border-gray-200 font-medium"
        >
          <RotateCcw className="h-3 w-3" />
          Replay
        </button>
        <span className="text-gray-400">
          {new Date(trace.createdAt).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
};

const TraceNodeDetails: React.FC<{ 
  node: TreeNode; 
  onReplay?: (trace: TraceStep) => void; 
}> = ({ node, onReplay }) => {

  const { agentRun } = node;

  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-gray-800">Agent Inspector: {node.agentName}</h4>
        <span className="text-gray-500">Status: {agentRun?.status || 'active'}</span>
      </div>

      {Boolean(agentRun?.input) && (
        <div>
          <h5 className="font-medium text-gray-700 mb-1">Input</h5>
          <pre className="bg-white rounded border border-gray-200 p-2.5 overflow-auto max-h-40 font-mono">
            {JSON.stringify(agentRun?.input, null, 2)}
          </pre>
        </div>
      )}

      {Boolean(agentRun?.output) && (
        <div>
          <h5 className="font-medium text-gray-700 mb-1">Output</h5>
          <pre className="bg-white rounded border border-gray-200 p-2.5 overflow-auto max-h-40 font-mono">
            {JSON.stringify(agentRun?.output, null, 2)}
          </pre>
        </div>
      )}

      {Boolean(agentRun?.error) && (
        <div className="text-red-700 bg-red-50 p-2.5 rounded border border-red-200">
          <h5 className="font-medium mb-1">Error</h5>
          <p>{agentRun?.error?.message}</p>
        </div>
      )}

      {node.traceSteps.length > 0 && onReplay && (
        <div className="pt-2 flex justify-end border-t border-blue-100">
          <button
            type="button"
            onClick={() => onReplay(node.traceSteps[node.traceSteps.length - 1])}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition-colors shadow-sm"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Replay Latest Step
          </button>
        </div>
      )}
    </div>
  );
};

function getAgentIcon(agentName: string): React.ReactNode {
  switch (agentName) {
    case 'planner':
      return <Brain className="h-5 w-5 text-blue-600" />;
    case 'researcher':
      return <Search className="h-5 w-5 text-emerald-600" />;
    case 'coder':
      return <Code className="h-5 w-5 text-purple-600" />;
    case 'reviewer':
      return <CheckCircle className="h-5 w-5 text-amber-600" />;
    default:
      return <Wrench className="h-5 w-5 text-gray-600" />;
  }
}

function getStatusIcon(status: string): React.ReactNode {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-4 w-4 text-emerald-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'running':
      return <Clock className="h-4 w-4 text-blue-500 animate-pulse" />;
    default:
      return <Clock className="h-4 w-4 text-gray-400" />;
  }
}

function getStepIcon(stepType: string): React.ReactNode {
  switch (stepType) {
    case 'tool_call':
      return <Wrench className="h-3.5 w-3.5 text-blue-600" />;
    case 'llm_call':
      return <Brain className="h-3.5 w-3.5 text-purple-600" />;
    case 'result':
      return <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />;
    case 'error':
      return <XCircle className="h-3.5 w-3.5 text-red-600" />;
    default:
      return <FileText className="h-3.5 w-3.5 text-gray-600" />;
  }
}

export default TraceTree;
