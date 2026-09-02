import { apiClient } from '../client';
import { ReportResponse, ReportRangeResponse } from '@/types/reports.types';

/**
 * lib/api/endpoints/reportsApi.ts
 *
 * Client for GET /api/leads/report/daily
 *
 * Auth: the frontend authenticates via the Clerk bearer token that the
 * shared apiClient injects automatically (ClerkTokenProvider interceptor).
 * The X-Report-Secret header is NOT sent from the browser — it is a
 * server-to-server secret for Apps Script / backend jobs only. The backend
 * route uses a reportSecretOrUser OR-gate that accepts either the secret
 * header OR a valid Clerk session.
 *
 * See references/daily-lead-report-frontend.md for the full contract:
 *   - Single day:  ?date=YYYY-MM-DD     → { success, date, data: LeadCountEntry[] }
 *   - Date range:  ?start=&end=         → { success, start, end, days, data: Record<string, LeadCountEntry[]> }
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
    });
    if (!res) throw new Error('Request cancelled');
    return res;
  },
};
