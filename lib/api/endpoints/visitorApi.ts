import { apiClient } from '../client';
import { VisitorData, VisitorResponse } from '@/types/visitor.types';

/**
 * lib/api/endpoints/visitorApi.ts
 */

export const visitorApi = {
  /**
   * Record a new visitor entry.
   * POST /api/visitors
   */
  recordVisit: async (data: VisitorData): Promise<VisitorResponse> => {
    const res = await apiClient.post<VisitorResponse>('/visitors', data);
    if (!res) throw new Error('Request cancelled');
    return res;
  },
};
