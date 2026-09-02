import { apiClient } from '../client';
import { env } from '@/lib/config/env';
import { ReportResponse, ReportRangeResponse } from '@/types/reports.types';

/**
 * lib/api/endpoints/reportsApi.ts
 *
 * Client for GET /api/leads/report/daily
 * Uses the shared X-Report-Secret header for authentication.
 */

export const reportsApi = {
  /**
   * Fetch daily report for a specific date and optional user.
   * GET /api/leads/report/daily?date=YYYY-MM-DD&userId=
   */
  getDailyReport: async (date: string, userId?: string): Promise<ReportResponse> => {
    const params: Record<string, string> = { date };
    if (userId) params.userId = userId;

    const res = await apiClient.get<ReportResponse>('/leads/report/daily', {
      params,
      headers: { 'X-Report-Secret': env.REPORT_SECRET },
    });
    if (!res) throw new Error('Request cancelled');
    return res;
  },

  /**
   * Fetch reports over a date range (inclusive IST days, max 10 days).
   * GET /api/leads/report/daily?start=YYYY-MM-DD&end=YYYY-MM-DD&userId=
   * Returns data grouped by date.
   */
  getDailyReportRange: async (
    start: string,
    end: string,
    userId?: string,
  ): Promise<ReportRangeResponse> => {
    const params: Record<string, string> = { start, end };
    if (userId) params.userId = userId;

    const res = await apiClient.get<ReportRangeResponse>('/leads/report/daily', {
      params,
      headers: { 'X-Report-Secret': env.REPORT_SECRET },
    });
    if (!res) throw new Error('Request cancelled');
    return res;
  },
};
