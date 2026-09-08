import React from 'react';
import Link from 'next/link';
import { Task } from '@/types';
import { cn } from '@/lib/utils';

interface TaskCardProps {
  task: Task;
}

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  queued: 'bg-blue-100 text-blue-800',
  running: 'bg-green-100 text-green-800',
  waiting_approval: 'bg-purple-100 text-purple-800',
  completed: 'bg-gray-100 text-gray-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-600',
  budget_exceeded: 'bg-orange-100 text-orange-800',
};

export const TaskCard: React.FC<TaskCardProps> = ({ task }) => {
  return (
    <Link href={`/tasks/${task._id}`} className="block">
      <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
            {task.goal}
          </h3>
          <span className={cn('px-2 py-1 text-xs font-medium rounded-full', statusColors[task.status])}>
            {task.status.replace('_', ' ')}
          </span>
        </div>
        
        <div className="flex justify-between items-center text-sm text-gray-500">
          <span>Priority: {task.priority}</span>
          <span>Budget: ${task.budget.spentCost.toFixed(2)} / ${task.budget.maxCost.toFixed(2)}</span>
        </div>
        
        <div className="mt-3 text-sm text-gray-400">
          Created: {new Date(task.createdAt).toLocaleDateString()}
        </div>
      </div>
    </Link>
  );
};