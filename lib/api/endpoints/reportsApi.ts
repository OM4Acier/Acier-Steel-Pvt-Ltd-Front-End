import { apiClient } from '../client';
import { ReportResponse, ReportRangeResponse } from '@/types/reports.types';

/**
 * lib/api/endpoints/reportsApi.ts
 */

export const reportsApi = {
  /**
   * Fetch daily report for a specific date and optional user.
   * GET /api/reports/daily?date=YYYY-MM-DD&userId=
   */
  getDailyReport: async (date: string, userId?: string): Promise<ReportResponse> => {
    const params = new URLSearchParams({ date });
    if (userId) params.append('userId', userId);
    
    const res = await apiClient.get<ReportResponse>(`/reports/daily?${params.toString()}`);
    if (!res) throw new Error('Request cancelled');
    return res;
  },

  /**
   * Fetch reports over a date range (inclusive IST days, max 10 days).
   * GET /api/reports/daily?start=YYYY-MM-DD&end=YYYY-MM-DD&userId=
   * Returns data grouped by date.
   */
  getDailyReportRange: async (
    start: string,
    end: string,
    userId?: string,
  ): Promise<ReportRangeResponse> => {
    const params = new URLSearchParams({ start, end });
    if (userId) params.append('userId', userId);

    const res = await apiClient.get<ReportRangeResponse>(`/reports/daily?${params.toString()}`);
    if (!res) throw new Error('Request cancelled');
    return res;
  },
};
