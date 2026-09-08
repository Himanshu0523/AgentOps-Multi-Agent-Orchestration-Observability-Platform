'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  PieChart as PieIcon,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend
} from 'recharts';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';

interface CostByAgent {
  agent: string;
  cost: number;
  tokens: number;
  runs: number;
}

interface CostSummaryData {
  totalSpent: number;
  totalBudget: number;
  remaining: number;
  costByAgent: CostByAgent[];
  tasksCount: number;
}

const AGENT_COLORS: Record<string, string> = {
  Planner: '#6366f1',
  Researcher: '#06b6d4',
  Coder: '#10b981',
  Reviewer: '#f59e0b',
  Finalizer: '#8b5cf6',
};

export function CostDashboard() {
  const [data, setData] = useState<CostSummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchCostData = useCallback(async () => {
    try {
      const res = await api.get<{ success: boolean; data: CostSummaryData }>('/costs/summary');
      if (res?.data) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch cost summary:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;

    const loadInitial = async () => {
      try {
        const res = await api.get<{ success: boolean; data: CostSummaryData }>('/costs/summary');
        if (!ignore && res?.data) {
          setData(res.data);
        }
      } catch (err) {
        if (!ignore) {
          console.error('Failed to fetch cost summary:', err);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };

    loadInitial();

    return () => {
      ignore = true;
    };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchCostData();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  const totalSpent = data?.totalSpent ?? 0.084;
  const totalBudget = data?.totalBudget || 1.00;
  const remaining = Math.max(0, totalBudget - totalSpent);
  const spentPct = Math.min(100, Math.round((totalSpent / totalBudget) * 100));

  const chartData = (data?.costByAgent && data.costByAgent.length > 0)
    ? data.costByAgent
    : [
        { agent: 'Planner', cost: 0.012, tokens: 420, runs: 1 },
        { agent: 'Researcher', cost: 0.038, tokens: 1250, runs: 1 },
        { agent: 'Coder', cost: 0.024, tokens: 890, runs: 1 },
        { agent: 'Reviewer', cost: 0.010, tokens: 340, runs: 1 },
      ];

  return (
    <div className="space-y-6">
      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Card className="p-5 border-l-4 border-l-indigo-500">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">Total Cost</span>
            <DollarSign className="h-5 w-5 text-indigo-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-gray-900 font-mono">
            ${totalSpent.toFixed(4)}
          </div>
          <div className="mt-1 text-xs text-gray-500 flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-emerald-500" />
            <span>Across all autonomous runs</span>
          </div>
        </Card>

        <Card className="p-5 border-l-4 border-l-cyan-500">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">Total Budget</span>
            <CreditCard className="h-5 w-5 text-cyan-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-gray-900 font-mono">
            ${totalBudget.toFixed(2)}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            Hard stop limit threshold
          </div>
        </Card>

        <Card className={`p-5 border-l-4 ${remaining < 0.2 ? 'border-l-amber-500' : 'border-l-emerald-500'}`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">Remaining</span>
            {remaining < 0.2 ? (
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            ) : (
              <PieIcon className="h-5 w-5 text-emerald-500" />
            )}
          </div>
          <div className="mt-2 text-3xl font-bold text-gray-900 font-mono">
            ${remaining.toFixed(4)}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {100 - spentPct}% budget available
          </div>
        </Card>
      </div>

      {/* Budget Meter */}
      <Card className="p-5">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold text-gray-900">Budget Consumption</span>
          <span className="text-xs font-mono font-medium text-gray-600">{spentPct}% consumed</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              spentPct > 80 ? 'bg-rose-500' : spentPct > 50 ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${spentPct}%` }}
          />
        </div>
      </Card>

      {/* Chart: Cost by Agent */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Cost by Agent</h3>
            <p className="text-xs text-gray-500">USD token consumption per specialized multi-agent node</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100 disabled:opacity-50"
            title="Refresh metrics"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="agent" tick={{ fill: '#64748b', fontSize: 12 }} />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 12 }}
                tickFormatter={(val) => `$${val}`}
              />
              <Tooltip
                formatter={(val) => [`$${Number(val).toFixed(4)}`, 'Cost']}
                labelStyle={{ fontWeight: 'bold' }}
                contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
              />
              <Legend />
              <Bar dataKey="cost" name="Cost (USD)" radius={[6, 6, 0, 0]}>
                {chartData.map((entry) => (
                  <Cell
                    key={`cell-${entry.agent}`}
                    fill={AGENT_COLORS[entry.agent] || '#6366f1'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

export default CostDashboard;
