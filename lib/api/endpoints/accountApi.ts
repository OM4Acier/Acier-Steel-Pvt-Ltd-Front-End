import { apiClient } from '../client';
import { IUser } from '@/types/user.types';

export interface LoginAuditEntry {
  clerkId: string;
  sessionId: string;
  event: 'session.created' | 'session.ended' | 'session.removed';
  timestamp: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface AccountResponse {
  success: boolean;
  account: IUser;
  adminExtras?: {
    loginAudit: LoginAuditEntry[];
    debug: {
      sessionClaims: Record<string, unknown>;
      permissionCacheEntry: { version: string; cachedAt: string } | null;
      casbinEnforceMode: 'audit' | 'enforce';
    };
  };
}

/**
 * lib/api/endpoints/accountApi.ts
 * 
 * Self-service account management API.
 */
export const accountApi = {
  /**
   * Fetch own profile + optional super-admin extras
   * GET /api/account/me
   */
  getMe: async (): Promise<AccountResponse> => {
    const res = await apiClient.get<AccountResponse>('/account/me');
    if (!res) throw new Error('Request cancelled');
    return res;
  },

  /**
   * Update own contact number
   * PATCH /api/account/me
   */
  updateContactNo: async (contactNo: string): Promise<{ success: boolean; account: Partial<IUser> }> => {
    const res = await apiClient.patch<{ success: boolean; account: Partial<IUser> }>(
      '/account/me',
      { contactNo }
    );
    if (!res) throw new Error('Request cancelled');
    return res;
  },
};
