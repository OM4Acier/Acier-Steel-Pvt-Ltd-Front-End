import { apiClient } from '../client';
import { ReportResponse } from '@/types/reports.types';

/**
 * lib/api/endpoints/reportsApi.ts
 */

export const reportsApi = {
  /**
   * Fetch daily report for a specific date and optional user.
   * GET /api/reports/daily
   */
  getDailyReport: async (date: string, userId?: string): Promise<ReportResponse> => {
    const params = new URLSearchParams({ date });
    if (userId) params.append('userId', userId);
    
    const res = await apiClient.get<ReportResponse>(`/reports/daily?${params.toString()}`);
    if (!res) throw new Error('Request cancelled');
    return res;
  },
};
