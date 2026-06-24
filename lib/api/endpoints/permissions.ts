import { apiClient } from '../client';
import { PermissionsResponse } from '@/types/permissions';

/**
 * lib/api/endpoints/permissions.ts
 * 
 * Permissions and RBAC manifests API
 */

export const permissionsApi = {
  /**
   * Fetch permission manifests and current role.
   * GET /api/permissions
   */
  getPermissions: async (): Promise<PermissionsResponse> => {
    const res = await apiClient.get<any>('/permissions');
    // If the backend wraps the response in a 'data' field, unwrap it.
    // Otherwise, return the response as is.
    return res?.data || res;
  },
};
