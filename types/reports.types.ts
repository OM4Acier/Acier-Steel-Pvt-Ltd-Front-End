/**
 * types/reports.types.ts
 *
 * Shapes for GET /api/leads/report/daily
 *   - Single day:  ?date=YYYY-MM-DD  → { success, date, data: LeadCountEntry[] }
 *   - Date range:  ?start=&end=      → { success, start, end, days, data: Record<string, LeadCountEntry[]> }
 *
 * Auth: X-Report-Secret header (shared secret from NEXT_PUBLIC_REPORT_SECRET).
 */

export interface LeadCountEntry {
  /** User email (the lead's createdBy). */
  createdBy: string;
  /** User display name. */
  createdByName: string;
  /** Number of leads created by this user on this day. */
  count: number;
}

export interface ReportResponse {
  success: boolean;
  /** IST date string (YYYY-MM-DD) echoed back. */
  date: string;
  /** Array of per-user lead counts (always present, empty when no leads). */
  data: LeadCountEntry[];
  error?: string;
}

export interface ReportRangeResponse {
  success: boolean;
  /** Inclusive IST range start. */
  start: string;
  /** Inclusive IST range end. */
  end: string;
  /** Number of calendar days in the range. */
  days: number;
  /** Object keyed by IST date (YYYY-MM-DD), each value an array of per-user lead counts. */
  data: Record<string, LeadCountEntry[] | LeadCountEntry>;
  error?: string;
}
