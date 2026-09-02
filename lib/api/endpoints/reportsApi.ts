import { apiClient } from '../client';
import { env } from '@/lib/config/env';
import { ReportResponse, ReportRangeResponse } from '@/types/reports.types';

/**
 * lib/api/endpoints/reportsApi.ts
 *
 * Client for GET /api/leads/report/daily
 *
 * Auth: the frontend authenticates via the Clerk bearer token that the
 * shared apiClient injects automatically (ClerkTokenProvider interceptor).
 * The X-Report-Secret header is sent from the browser as a fallback so
 * the report endpoint can authenticate without a Clerk session (e.g.
 * from the reports page which may not have a full user context).
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
