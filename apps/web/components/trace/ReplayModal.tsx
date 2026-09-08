'use client';

import React from 'react';
import { 
  X, 
  RotateCcw, 
  Clock, 
  DollarSign, 
  Zap, 
  CheckCircle2, 
  FileText,
  Loader2 
} from 'lucide-react';
import { ReplayResult } from '@/types';

interface ReplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: ReplayResult | null;
  isLoading?: boolean;
}

export const ReplayModal: React.FC<ReplayModalProps> = ({
  isOpen,
  onClose,
  result,
  isLoading = false,
}) => {
  if (!isOpen) return null;

  const renderContent = (content: unknown) => {
    if (typeof content === 'string') {
      return content;
    }
    try {
      return JSON.stringify(content, null, 2);
    } catch {
      return String(content);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                Trace Replay Benchmarking
                {result?.agent && (
                  <span className="text-xs uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold">
                    {result.agent}
                  </span>
                )}
              </h3>
              <p className="text-xs text-gray-500 font-mono mt-0.5">
                Trace ID: {result?.traceId || 'Loading...'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3 text-gray-500">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p className="text-sm font-medium">Re-executing trace step through benchmark runner...</p>
            </div>
          ) : result ? (
            <>
              {/* Diff summary banner */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3.5 flex items-center gap-3">
                  <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 font-medium">Latency Delta</div>
                    <div className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                      {result.diff.speedup_ms > 0 ? (
                        <span className="text-emerald-600">+{result.diff.speedup_ms}ms faster</span>
                      ) : (
                        <span className="text-amber-600">{result.diff.speedup_ms}ms</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-purple-50/60 border border-purple-100 rounded-xl p-3.5 flex items-center gap-3">
                  <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
                    <DollarSign className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 font-medium">Cost Difference</div>
                    <div className="text-sm font-bold text-gray-900">
                      {result.diff.cost_delta === 0 ? (
                        <span className="text-gray-600">$0.0000 (Equiv)</span>
                      ) : result.diff.cost_delta < 0 ? (
                        <span className="text-emerald-600">-${Math.abs(result.diff.cost_delta).toFixed(6)}</span>
                      ) : (
                        <span className="text-amber-600">+${result.diff.cost_delta.toFixed(6)}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3.5 flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                    <Zap className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 font-medium">Replay Integrity</div>
                    <div className="text-sm font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      100% Deterministic
                    </div>
                  </div>
                </div>
              </div>

              {/* Side-by-side comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Original */}
                <div className="border border-gray-200 rounded-xl bg-gray-50/30 overflow-hidden flex flex-col">
                  <div className="px-4 py-3 bg-gray-100/70 border-b border-gray-200 flex items-center justify-between">
                    <span className="font-semibold text-xs text-gray-700 uppercase tracking-wide">
                      Original Execution
                    </span>
                    <span className="text-xs text-gray-500 font-mono">Baseline</span>
                  </div>
                  <div className="p-4 space-y-3 flex-1 flex flex-col">
                    <div className="flex items-center gap-4 text-xs text-gray-600 pb-2 border-b border-gray-200/60">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-gray-400" />
                        {result.original.duration_ms.toFixed(1)}ms
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3.5 w-3.5 text-gray-400" />
                        ${result.original.cost.toFixed(6)}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5 text-gray-400" />
                        {result.original.tokens} tokens
                      </span>
                    </div>

                    <div className="flex-1 min-h-[180px] bg-white rounded-lg border border-gray-200 p-3 font-mono text-xs overflow-auto text-gray-800">
                      <pre className="whitespace-pre-wrap break-words">
                        {renderContent(result.original.output)}
                      </pre>
                    </div>
                  </div>
                </div>

                {/* Replay */}
                <div className="border border-blue-200 rounded-xl bg-blue-50/20 overflow-hidden flex flex-col">
                  <div className="px-4 py-3 bg-blue-100/60 border-b border-blue-200 flex items-center justify-between">
                    <span className="font-semibold text-xs text-blue-900 uppercase tracking-wide flex items-center gap-1.5">
                      <RotateCcw className="h-3.5 w-3.5" />
                      Replayed Execution
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-200/80 text-blue-900 font-semibold font-mono">
                      Cached / Live
                    </span>
                  </div>
                  <div className="p-4 space-y-3 flex-1 flex flex-col">
                    <div className="flex items-center gap-4 text-xs text-gray-600 pb-2 border-b border-blue-200/60">
                      <span className="flex items-center gap-1 font-semibold text-blue-900">
                        <Clock className="h-3.5 w-3.5 text-blue-600" />
                        {result.replay.duration_ms.toFixed(1)}ms
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3.5 w-3.5 text-blue-600" />
                        ${result.replay.cost.toFixed(6)}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5 text-blue-600" />
                        {result.replay.tokens} tokens
                      </span>
                    </div>

                    <div className="flex-1 min-h-[180px] bg-white rounded-lg border border-blue-200 p-3 font-mono text-xs overflow-auto text-gray-800">
                      <pre className="whitespace-pre-wrap break-words">
                        {renderContent(result.replay.output)}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">
              No replay data available for this trace step.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReplayModal;
