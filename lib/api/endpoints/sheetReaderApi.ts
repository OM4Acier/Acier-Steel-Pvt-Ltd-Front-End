import { apiClient } from '../client';

/**
 * lib/api/endpoints/sheetReaderApi.ts
 *
 * Thin typed wrapper over the backend Sheet Data Reader endpoint.
 * Auth is handled entirely by the shared apiClient (Clerk bearer token is
 * injected by the ClerkTokenProvider interceptor). The frontend never sees
 * the server-only X-Report-Secret — the browser simply calls with its
 * Clerk session, exactly like any other protected endpoint.
 *
 * Backend contract: GET /api/sheets/read  (see backend SHEET_READER_API.md)
 *
 * The frontend sends a public `source` key (e.g. "leads"); the backend
 * resolves it server-side to the real sheetId + tab via its SHEET_SOURCES
 * registry. The frontend holds no sheet ids or tab names.
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
  /** Column holding YYYY-MM-DD values (use with from/to). */
  dateColumn?: string;
  /** Inclusive IST-day range start (YYYY-MM-DD). */
  from?: string;
  /** Inclusive IST-day range end (YYYY-MM-DD, >= from). */
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

export const sheetReaderApi = {
  /**
   * Read (filtered + paginated) rows from a sheet source.
   * GET /sheets/read
   */
  read: async (params: SheetReadParams): Promise<SheetReadResponse> => {
    // Drop empty / undefined values so the backend never sees blank filters.
    const qs: Record<string, string | number> = {};
    (Object.entries(params) as [keyof SheetReadParams, unknown][])
      .forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') qs[k] = v as string | number;
      });

    const res = await apiClient.get<SheetReadResponse>('/sheets/read', {
      params: qs,
    });
    if (!res) throw new Error('Request cancelled');
    return res;
  },
};
