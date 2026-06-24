import { apiClient } from '../client';
import { 
  IUser, 
  CreateUserPayload, 
  UpdateUserRolePayload, 
  UpdateUserFieldsPayload 
} from '@/types/user.types';

/**
 * lib/api/endpoints/users.ts
 * 
 * Admin User Management API
 * 
 * All routes require 'super-admin' or 'admin' role on the backend.
 */

export const usersApi = {
  /**
   * List all users
   * GET /api/admin/users
   */
  getUsers: async (): Promise<IUser[]> => {
    const res = await apiClient.get<{ success: boolean; users: IUser[] }>('/admin/users');
    return res?.users || [];
  },

  /**
   * Create a new user in Clerk + MongoDB
   * POST /api/admin/users
   */
  createUser: async (payload: CreateUserPayload): Promise<IUser> => {
    const res = await apiClient.post<{ success: boolean; user: IUser }>('/admin/users', payload);
    if (!res) throw new Error('Request cancelled');
    return res.user;
  },

  /**
   * Update a user's role in Clerk + MongoDB
   * PATCH /api/admin/users/:clerkId/role
   */
  updateUserRole: async (clerkId: string, role: UpdateUserRolePayload['role']): Promise<{ role: UpdateUserRolePayload['role'] }> => {
    const res = await apiClient.patch<{ success: boolean; role: UpdateUserRolePayload['role'] }>(
      `/admin/users/${clerkId}/role`, 
      { role }
    );
    if (!res) throw new Error('Request cancelled');
    return res;
  },

  /**
   * Update business fields (department, contactNo, organization, name)
   * PATCH /api/admin/users/:clerkId
   */
  updateUserFields: async (clerkId: string, fields: UpdateUserFieldsPayload): Promise<Partial<IUser>> => {
    const res = await apiClient.patch<{ success: boolean; user: Partial<IUser> }>(
      `/admin/users/${clerkId}`, 
      fields
    );
    if (!res) throw new Error('Request cancelled');
    return res.user;
  },

  /**
   * Delete a user from Clerk + MongoDB
   * DELETE /api/admin/users/:clerkId
   */
  deleteUser: async (clerkId: string): Promise<void> => {
    await apiClient.delete(`/admin/users/${clerkId}`);
  },
};
