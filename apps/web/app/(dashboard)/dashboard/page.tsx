'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  ListTodo, 
  PlayCircle, 
  CheckCircle, 
  DollarSign,
  AlertTriangle
} from 'lucide-react';
import api from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Task, DashboardStats, DashboardResponse, TasksResponse } from '@/types';
import { CostDashboard } from '@/components/dashboard/CostDashboard';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const [statsRes, tasksRes] = await Promise.all([
          api.get<DashboardResponse>('/dashboard/stats'),
          api.get<TasksResponse>('/tasks?limit=5'),
        ]);
        setStats(statsRes?.data || null);
        setRecentTasks(tasksRes?.data?.tasks || []);
      } catch (error) {
        console.error('Failed to fetch dashboard:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Good morning, {stats ? 'Agent Operator' : 'User'}</h1>
        <p className="text-gray-600">Monitor your AI agents</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={<ListTodo className="h-6 w-6 text-blue-600" />}
          label="Total Tasks"
          value={stats?.totalTasks || 0}
          trend="+12%"
        />
        <StatCard
          icon={<PlayCircle className="h-6 w-6 text-green-600" />}
          label="Active Runs"
          value={stats?.activeRuns || 0}
          trend="Live"
        />
        <StatCard
          icon={<CheckCircle className="h-6 w-6 text-purple-600" />}
          label="Success Rate"
          value={`${stats?.successRate || 0}%`}
          trend="+2.4%"
        />
        <StatCard
          icon={<DollarSign className="h-6 w-6 text-yellow-600" />}
          label="Total Cost"
          value={`$${stats?.totalCost?.toFixed(2) || '0.00'}`}
          trend="This month"
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Tasks */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Tasks</h2>
            <Link href="/tasks" className="text-sm text-blue-600 hover:text-blue-500">
              View all
            </Link>
          </div>
          <div className="space-y-4">
            {recentTasks.map((task) => (
              <Link
                key={task._id}
                href={`/tasks/${task._id}`}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{task.goal}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(task.createdAt).toLocaleString()}
                  </p>
                </div>
                <Badge variant={getStatusVariant(task.status)}>
                  {task.status}
                </Badge>
              </Link>
            ))}
          </div>
        </Card>

        {/* Agent Activity */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Agent Activity</h2>
          <div className="space-y-4">
            <AgentActivityBar name="Planner" count={stats?.agentUsage?.planner || 0} color="bg-blue-500" />
            <AgentActivityBar name="Researcher" count={stats?.agentUsage?.researcher || 0} color="bg-green-500" />
            <AgentActivityBar name="Coder" count={stats?.agentUsage?.coder || 0} color="bg-purple-500" />
            <AgentActivityBar name="Reviewer" count={stats?.agentUsage?.reviewer || 0} color="bg-yellow-500" />
          </div>
        </Card>

        {/* Pending Approvals */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Pending Approvals</h2>
            <Link href="/approvals" className="text-sm text-blue-600 hover:text-blue-500">
              View all
            </Link>
          </div>
          {stats?.pendingApprovals ? (
            <div className="flex items-center p-4 bg-yellow-50 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mr-3" />
              <span className="text-sm text-yellow-800">
                {stats.pendingApprovals} actions awaiting approval
              </span>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No pending approvals</p>
          )}
        </Card>

        {/* Quick Stats */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Total Tokens</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.totalTokens?.toLocaleString() || 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Avg Execution Time</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.avgExecutionTime?.toFixed(1) || 0}s
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Phase 11: Cost & Budget Governance Dashboard */}
      <div className="mt-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Cost & Budget Governance</h2>
        <CostDashboard />
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, trend }: { icon: React.ReactNode; label: string; value: string | number; trend: string }) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 bg-gray-50 rounded-lg">{icon}</div>
        <span className="text-xs text-gray-500">{trend}</span>
      </div>
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </Card>
  );
}

function AgentActivityBar({ name, count, color }: { name: string; count: number; color: string }) {
  const maxCount = 100;
  const width = Math.min((count / maxCount) * 100, 100);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-600">{name}</span>
        <span className="text-sm font-medium text-gray-900">{count}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${width}%` }} />
      </div>
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