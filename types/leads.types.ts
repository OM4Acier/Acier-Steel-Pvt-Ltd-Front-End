/**
 * types/leads.types.ts
 *
 * Types for the cursor-based GET /api/leads endpoint.
 *
 * Backend contract (GET /api/leads):
 *   @query   limit, sort, order, fields, cursor, status, isHot, start, end
 *   @returns { data: Lead[], nextCursor: string | null, hasNext: boolean }
 *
 * Server returns ISO date strings for createdAt/updatedAt/reminderDate.
 * Server returns isHot as boolean.
 * Server returns `id` directly (already a string). Both leadsApi.ts and
 * leadsCursorApi.ts pass `id` through as-is; the old `_id`-only normalization
 * was removed when the backend migrated away from MongoDB `_id` responses.
 */

import type { Lead, LeadStatus } from '@/lib/api/endpoints/leadsApi';

// ── Query params ──────────────────────────────────────────────────────────────

export type SortableField = 'createdAt' | 'updatedAt' | 'clientName' | 'status' | 'isHot';
export type SortOrder = 'asc' | 'desc';

export interface LeadFilters {
  /** MongoDB document id cursor from a previous page. Null/empty = first page. */
  cursor: string | null;
  /** Max leads per page. Defaults to 50. */
  limit: number;
  /** Field to sort by. */
  sort: SortableField;
  /** Sort direction. */
  order: SortOrder;
  /** Optional comma-separated field list for response shaping. */
  fields: string | null;
  /** Filter by status: 'In Progress' | 'Completed' | 'Closed' | undefined (all). */
  status: LeadStatus | undefined;
  /** Filter by hot status. undefined = all, true = hot only, false = not hot. */
  isHot: boolean | undefined;
  /** Inclusive start date (ISO). undefined = no lower bound. */
  start: string | undefined;
  /** Inclusive end date (ISO). undefined = no upper bound. */
  end: string | undefined;
}

// ── Response shape ────────────────────────────────────────────────────────────

export interface LeadPage {
  /** Paginated leads for this page. Each lead has id mapped from _id. */
  data: Lead[];
  /** Opaque cursor to pass as `cursor` on the next request. null = no more pages. */
  nextCursor: string | null;
  /** Whether another page exists. When false, the list is complete. */
  hasNext: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build query-string params from filters. Omits null/undefined entries. */
export function buildLeadQuery(filters: LeadFilters): Record<string, string> {
  const params: Record<string, string> = {};

  if (filters.limit > 0) params.limit = String(filters.limit);
  if (filters.sort) params.sort = filters.sort;
  if (filters.order) params.order = filters.order;
  if (filters.fields) params.fields = filters.fields;
  if (filters.cursor) params.cursor = filters.cursor;
  if (filters.status) params.status = filters.status;
  if (filters.isHot !== undefined) params.isHot = String(filters.isHot);
  if (filters.start) params.start = filters.start;
  if (filters.end) params.end = filters.end;

  return params;
}

/** Default filters — first page, most recent first, no filters applied. */
export const DEFAULT_FILTERS: LeadFilters = {
  cursor: null,
  limit: 50,
  sort: 'createdAt',
  order: 'desc',
  fields: null,
  status: undefined,
  isHot: undefined,
  start: undefined,
  end: undefined,
};
