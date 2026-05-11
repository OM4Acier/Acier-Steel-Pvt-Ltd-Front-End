// lib/api/taskApi.ts
import { 
    Task, 
    CreateTaskInput, 
    UpdateTaskInput, 
    GetTasksResponse,
    TaskStats,
    TaskView,
    ApiError,
    EditHistoryEntry as EditHistory,
    Users,
    GetTasksParams
  } from '@/lib/types/task';
import { auth } from '../auth';
  
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
  
  /**
   * Get auth headers with JWT token
   */
  const getAuthHeaders = (): HeadersInit => {
    const token = auth.getToken(); // or cookies
    //console.log(token);
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    };
  };
  
  /**
   * Enhanced error handler with detailed messages
   */
  const handleApiError = async (response: Response): Promise<never> => {
    let errorMessage = 'An unexpected error occurred';
    let errorDetails = null;
  
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
      errorDetails = errorData.details || null;
    } catch {
      // If response is not JSON, use status text
      errorMessage = response.statusText || errorMessage;
    }
  
    const error: ApiError = {
      error: errorMessage,
      details: errorDetails,
      //statusCode: response.status
    };
  
    throw error;
  };
  
  /**
   * Generic fetch wrapper with error handling
   */
  async function apiFetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
          ...getAuthHeaders(),
          ...options.headers
        }
      });
  
      if (!response.ok) {
        await handleApiError(response);
      }
  
      return response.json();
    } catch (error: any) {
      // Re-throw ApiError or wrap network errors
      if (error.error) {
        throw error;
      }
      throw {
        error: 'Network error. Please check your connection.',
        details: error.message,
        statusCode: 0
      } as ApiError;
    }
  }

  
  export const taskApi = {
    /**
     * GET /api/tasks
     * Fetch tasks with filters and view preference
     * 🚀 Performance: Results are cached in TaskContext
     */

    // ... inside your API service ...
    
    getTasks: async (params: GetTasksParams = {}): Promise<GetTasksResponse> => {
      // 1. Set defaults and merge with incoming params
      const mergedParams = {
        view: TaskView.ALL,
        includeHidden: false, // Fixed the typo "flase" from your snippet
        ...params
      };
    
      // 2. Filter out null, undefined, or empty strings
      const cleanParams = Object.entries(mergedParams).reduce((acc, [key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          acc[key] = String(value);
        }
        return acc;
      }, {} as Record<string, string>);
    
      // 3. Convert to URL Search Parameters
      const queryString = new URLSearchParams(cleanParams).toString();
      const url = `/tasks${queryString ? `?${queryString}` : ''}`;
    
      return apiFetch<GetTasksResponse>(url, {
        method: 'GET',
        cache: 'no-store'
      });
    },
    /**
     * GET /api/tasks/:id
     * Get single task by ID
     * 🚀 Performance: Check cache first in context
     */
    getTaskById: async (id: string): Promise<{ task: Task }> => {
      return apiFetch<{ task: Task }>(`/tasks/${id}`, {
        cache: 'no-store'
      });
    },
  
    /**
     * POST /api/tasks
     * Create new task
     */
    createTask: async (data: CreateTaskInput): Promise<{ task: Task }> => {
      return apiFetch<{ task: Task }>('/tasks', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
  
    /**
     * POST /api/tasks/batch
     * Create multiple tasks at once
     * 🚀 Performance: Single API call for multiple tasks
     */
    createBatchTasks: async (
      data: any
    ): Promise<{ tasks: Task[]; count: number }> => {
      return apiFetch<{ tasks: Task[]; count: number }>('/tasks/batch', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
  
    /**
     * PUT /api/tasks/:id
     * Update task
     */
    updateTask: async (
      id: string, 
      data: UpdateTaskInput
    ): Promise<{ task: Task }> => {
      return apiFetch<{ task: Task }>(`/tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },
  
    /**
     * PATCH /api/tasks/:id/status
     * Quick status update
     * 🚀 Performance: Optimistic update in context
     */
    updateTaskStatus: async (
      id: string, 
      status: string, 
      notes?: string
    ): Promise<{ task: Task }> => {
      return apiFetch<{ task: Task }>(`/tasks/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, notes })
      });
    },
  
    /**
     * DELETE /api/tasks/:id
     * Delete task
     */
    deleteTask: async (id: string): Promise<{ message: string }> => {
      return apiFetch<{ message: string }>(`/tasks/${id}`, {
        method: 'DELETE'
      });
    },
  
    /**
     * GET /api/tasks/:id/history
     * Get task edit history
     */
    getTaskHistory: async (id: string): Promise<{ history: EditHistory[] }> => {
      return apiFetch<{ history: EditHistory[] }>(`/tasks/${id}/history`, {
        cache: 'no-store'
      });
    },
  
    /**
     * GET /api/tasks/stats/summary
     * Get task statistics
     * 🚀 Performance: Stats are returned with getTasks, use cached value
     */
    getStats: async (view?: TaskView): Promise<{ stats: TaskStats }> => {
      const query = view ? `?view=${view}` : '';
      return apiFetch<{ stats: TaskStats }>(`/tasks/stats/summary${query}`, {
        cache: 'no-store'
      });
    },

    getEmployees: async (): Promise<{ employees: Users[] }> => {
        return apiFetch<{ employees: Users[] }>(`/users/employees`, {
          cache: 'no-store'
        });
      }
      


  };