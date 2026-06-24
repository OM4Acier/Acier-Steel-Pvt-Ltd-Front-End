import { apiClient } from '../client';
import { 
  Task, 
  CreateTaskInput, 
  UpdateTaskInput, 
  GetTasksResponse,
  TaskStats,
  TaskView,
  EditHistoryEntry as EditHistory,
  Users,
  GetTasksParams
} from '@/lib/types/task';

/**
 * lib/api/endpoints/tasksApi.ts
 *
 * Centralized API endpoints for Tasks, using apiClient.
 */
export const tasksApi = {
  /**
   * Fetch tasks with filters and view preference
   * GET /tasks
   */
  getTasks: async (params: GetTasksParams = {}): Promise<GetTasksResponse> => {
    const mergedParams = {
      view: TaskView.ALL,
      includeHidden: false,
      ...params
    };

    const cleanParams = Object.entries(mergedParams).reduce((acc, [key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        acc[key] = String(value);
      }
      return acc;
    }, {} as Record<string, string>);

    const queryString = new URLSearchParams(cleanParams).toString();
    const url = `/tasks${queryString ? `?${queryString}` : ''}`;

    const res = await apiClient.get<GetTasksResponse>(url);
    if (!res) throw new Error('Request cancelled');
    return res;
  },

  /**
   * Get single task by ID
   * GET /tasks/:id
   */
  getTaskById: async (id: string): Promise<{ task: Task }> => {
    const res = await apiClient.get<{ task: Task }>(`/tasks/${id}`);
    if (!res) throw new Error('Request cancelled');
    return res;
  },

  /**
   * Create new task
   * POST /tasks
   */
  createTask: async (data: CreateTaskInput): Promise<{ task: Task }> => {
    const res = await apiClient.post<{ task: Task }>('/tasks', data);
    if (!res) throw new Error('Request cancelled');
    return res;
  },

  /**
   * Create multiple tasks at once
   * POST /tasks/batch
   */
  createBatchTasks: async (data: any): Promise<{ tasks: Task[]; count: number }> => {
    const res = await apiClient.post<{ tasks: Task[]; count: number }>('/tasks/batch', data);
    if (!res) throw new Error('Request cancelled');
    return res;
  },

  /**
   * Update task
   * PUT /tasks/:id
   */
  updateTask: async (id: string, data: UpdateTaskInput): Promise<{ task: Task }> => {
    const res = await apiClient.put<{ task: Task }>(`/tasks/${id}`, data);
    if (!res) throw new Error('Request cancelled');
    return res;
  },

  /**
   * Quick status update
   * PATCH /tasks/:id/status
   */
  updateTaskStatus: async (id: string, status: string, notes?: string): Promise<{ task: Task }> => {
    const res = await apiClient.patch<{ task: Task }>(`/tasks/${id}/status`, { status, notes });
    if (!res) throw new Error('Request cancelled');
    return res;
  },

  /**
   * Delete task
   * DELETE /tasks/:id
   */
  deleteTask: async (id: string): Promise<{ message: string }> => {
    const res = await apiClient.delete<{ message: string }>(`/tasks/${id}`);
    if (!res) throw new Error('Request cancelled');
    return res;
  },

  /**
   * Get task edit history
   * GET /tasks/:id/history
   */
  getTaskHistory: async (id: string): Promise<{ history: EditHistory[] }> => {
    const res = await apiClient.get<{ history: EditHistory[] }>(`/tasks/${id}/history`);
    if (!res) throw new Error('Request cancelled');
    return res;
  },

  /**
   * Get task statistics
   * GET /tasks/stats/summary
   */
  getStats: async (view?: TaskView): Promise<{ stats: TaskStats }> => {
    const query = view ? `?view=${view}` : '';
    const res = await apiClient.get<{ stats: TaskStats }>(`/tasks/stats/summary${query}`);
    if (!res) throw new Error('Request cancelled');
    return res;
  },

  /**
   * Get list of employees
   * GET /users/employees
   */
  getEmployees: async (): Promise<{ employees: Users[] }> => {
    const res = await apiClient.get<{ employees: Users[] }>(`/users/employees`);
    if (!res) throw new Error('Request cancelled');
    return res;
  }
};
