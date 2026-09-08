import { create } from 'zustand';
import { Task, TasksResponse, TaskResponse } from '@/types';
import { api } from '@/lib/api';

interface TaskState {
  tasks: Task[];
  currentTask: Task | null;
  isLoading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  
  fetchTasks: (page?: number, limit?: number, filters?: Record<string, string>) => Promise<void>;
  fetchTask: (taskId: string) => Promise<void>;
  createTask: (taskData: Partial<Task>) => Promise<Task>;
  updateTask: (taskId: string, taskData: Partial<Task>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  setCurrentTask: (task: Task | null) => void;
}

export const useTaskStore = create<TaskState>((set) => ({
  tasks: [],
  currentTask: null,
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  },

  fetchTasks: async (page = 1, limit = 10, filters = {}) => {
    set({ isLoading: true, error: null });
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...filters,
      });
      
      const response = await api.get<TasksResponse>(`/tasks?${queryParams}`);
      set({
        tasks: response.data.tasks,
        pagination: response.data.pagination,
        isLoading: false,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch tasks';
      set({ error: message, isLoading: false });
    }
  },

  fetchTask: async (taskId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<TaskResponse>(`/tasks/${taskId}`);
      set({ currentTask: response.data.task, isLoading: false });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch task';
      set({ error: message, isLoading: false });
    }
  },

  createTask: async (taskData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<TaskResponse>('/tasks', taskData);
      const newTask = response.data.task;
      set((state) => ({
        tasks: [newTask, ...state.tasks],
        isLoading: false,
      }));
      return newTask;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create task';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  updateTask: async (taskId, taskData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.patch<TaskResponse>(`/tasks/${taskId}`, taskData);
      set((state) => ({
        tasks: state.tasks.map((task) =>
          task._id === taskId ? response.data.task : task
        ),
        currentTask: response.data.task,
        isLoading: false,
      }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update task';
      set({ error: message, isLoading: false });
    }
  },

  deleteTask: async (taskId) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/tasks/${taskId}`);
      set((state) => ({
        tasks: state.tasks.filter((task) => task._id !== taskId),
        currentTask: null,
        isLoading: false,
      }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete task';
      set({ error: message, isLoading: false });
    }
  },

  setCurrentTask: (task) => set({ currentTask: task }),
}));
