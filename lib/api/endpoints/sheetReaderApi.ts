import { apiClient } from '../client';

/**
 * lib/api/endpoints/sheetReaderApi.ts
 *
 * Thin typed wrapper over the backend Sheet Data Reader endpoints:
 *   GET /api/sheets/read     → filtered/paginated rows
 *   GET /api/sheets/options  → dropdown metadata (sources, columns, distinct)
 *
 * Auth is handled entirely by the shared apiClient (Clerk bearer token is
 * injected by the ClerkTokenProvider interceptor). The frontend never sees
 * the server-only X-Report-Secret — the browser calls with its Clerk session,
 * exactly like any other protected endpoint.
 *
 * Backend contract: see backend SHEET_READER_API.md
 *
 * The frontend sends a public `source` key (e.g. "leads"); the backend
 * resolves it server-side to the real sheetId + tab. The frontend holds no
 * sheet ids or tab names. Date filtering always targets the fixed `timestamp`
 * column (no `dateColumn` param).
 */

export type SheetValue = string | number;
export type SheetRow = Record<string, SheetValue>;

export interface SheetReadParams {
  /** Public source key (e.g. "leads"). Backend maps it to sheetId + tab. Required. */
  source: string;
  /** Equality filter target (use with filterValue). */
  filterColumn?: string;
  /** Exact value to match (trimmed). */
  filterValue?: string;
  /** Case-insensitive substring across all columns. */
  search?: string;
  /** Inclusive IST-day range start (YYYY-MM-DD), applied to the fixed `timestamp` column. */
  from?: string;
  /** Inclusive IST-day range end (YYYY-MM-DD, >= from), applied to the fixed `timestamp` column. */
  to?: string;
  /** Column to sort by (only if present in rows). */
  sortBy?: string;
  /** Sort direction. Default 'desc'. */
  sortDir?: 'asc' | 'desc';
  /** 1-based page. Default 1. */
  page?: number;
  /** Rows per page (1–500). Default 200. */
  limit?: number;
}

export interface SheetReadResponse {
  success: boolean;
  /** Echoed public source key (never the raw sheetId). */
  source: string;
  tab: string;
  totalRows: number;
  page: number;
  limit: number;
  totalPages: number;
  returnedRows: number;
  columns: string[];
  data: SheetRow[];
  error?: string;
}

/** Response from GET /api/sheets/options */
export interface SheetOptionsResponse {
  success: boolean;
  /** Available source keys (always present). */
  sources: string[];
  /** Present only when `source` was provided. */
  source?: string;
  columns?: string[];
  /** Candidate values per column (de-duplicated, trimmed, sorted). */
  distinct?: Record<string, string[]>;
  error?: string;
}

/** Drop any empty/undefined values so the backend never sees blank filters. */
function prune(params: object): Record<string, string | number> {
  const qs: Record<string, string | number> = {};
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs[k] = v as string | number;
  });
  return qs;
}

export const sheetReaderApi = {
  /**
   * Read (filtered + paginated) rows from a sheet source.
   * GET /sheets/read
   */
  read: async (params: SheetReadParams): Promise<SheetReadResponse> => {
    const res = await apiClient.get<SheetReadResponse>('/sheets/read', {
      params: prune(params),
    });
    if (!res) throw new Error('Request cancelled');
    return res;
  },

  /**
   * Fetch dropdown metadata for the frontend.
   * GET /sheets/options  (omit source → just the sources list;
   * pass source → also returns that source's columns + distinct values)
   */
  options: async (source?: string): Promise<SheetOptionsResponse> => {
    const res = await apiClient.get<SheetOptionsResponse>('/sheets/options', {
      params: source ? { source } : undefined,
    });
    if (!res) throw new Error('Request cancelled');
    return res;
  },
};
