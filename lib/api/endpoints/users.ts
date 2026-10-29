import { apiClient } from '../client';
import { 
  IUser, 
  CreateUserPayload, 
  UpdateUserRolePayload, 
  UpdateUserFieldsPayload,
  UpdateUserPermissionsPayload
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
    const res = await apiClient.get<any>('/admin/users');
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.users)) return res.users;
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res?.data?.users)) return res.data.users;
    return [];
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
   * Replace a user's per-user permission GRANTS.
   * PATCH /api/admin/users/:clerkId/permissions
   *
   * Body carries EXTRAS ONLY. Permissions the user's role already grants are
   * recomputed server-side and must NOT be sent here — sending them would let
   * a stale grant survive a later role change that removes it.
   *
   * Identified by clerkId, not the Mongo _id: every other route in this file
   * keys on clerkId, and UserList keys its rows on user.clerkId.
   *
   * NOTE: the backend route does not exist yet. Until it ships this call
   * returns 404 and grants simply do not persist.
   */
  updateUserPermissions: async (
    clerkId: string,
    permissions: UpdateUserPermissionsPayload['permissions'],
  ): Promise<{ permissions: string[] }> => {
    const res = await apiClient.patch<{ success: boolean; permissions: string[] }>(
      `/admin/users/${clerkId}`,
      { permissions },
    );
    if (!res) throw new Error('Request cancelled');
    return { permissions: res.permissions ?? [] };
  },

  /**
   * Delete a user from Clerk + MongoDB
   * DELETE /api/admin/users/:clerkId
   */
  deleteUser: async (clerkId: string): Promise<void> => {
    await apiClient.delete(`/admin/users/${clerkId}`);
  },
};
