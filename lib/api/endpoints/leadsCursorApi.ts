/**
 * lib/api/endpoints/leadsCursorApi.ts
 *
 * Client for the cursor-based GET /api/leads endpoint.
 *
 * GET /api/leads?limit=&sort=&order=&fields=&cursor=&status=&isHot=&start=&end=
 * Returns: { data: Lead[], nextCursor: string | null, hasNext: boolean }
 *
 * Auth: Bearer token injected automatically by the shared apiClient
 * (ClerkTokenProvider interceptor). No extra headers required.
 *
 * Comparison with the existing leadsApi.ts:
 *   - leadsApi.fetchLeads()            → GET /leads           → Lead[]        (old, no pagination)
 *   - leadsCursorApi.fetchLeadsPage()  → GET /api/leads       → LeadPage     (new, cursor-based)
 *   - leadsCursorApi.fetchLeadCount()  → GET /api/leads/count → { count }    (separate, optional)
 *
 * The old leadsApi remains untouched — deleteLead / updateLead / addLead /
 * uploadFile / deleteFile are still used by the page for mutations.
 */

import { apiClient } from '../client';
import type { LeadPage, LeadFilters, buildLeadQuery } from '@/types/leads.types';
import type { Lead } from './leadsApi';

// ── Error shapes ──────────────────────────────────────────────────────────────

/** Thrown when the server rejects a cursor because the filter/sort context changed.
 * The hook that calls fetchLeadsPage catches this and silently restarts from page 1. */
export class InvalidCursorError extends Error {
  constructor(cursor: string) {
    super(`Invalid cursor: ${cursor}`);
    this.name = 'InvalidCursorError';
  }
}

// ── API functions ─────────────────────────────────────────────────────────────

/**
 * Fetch one page of leads with the given filters and optional cursor.
 *
 * @param filters  Query parameters (limit, sort, order, status, isHot, start, end, etc.)
 * @param cursor   Opaque cursor from a previous page's `nextCursor`. Pass undefined/null for the first page.
 * @param signal   Optional AbortSignal for request cancellation.
 * @returns        LeadPage with data, nextCursor, and hasNext.
 * @throws         Error with the server's error message on non-2xx.
 *                 InvalidCursorError when the server rejects the cursor.
 */
export async function fetchLeadsPage(
  filters: LeadFilters,
  cursor: string | null | undefined,
  signal?: AbortSignal,
): Promise<LeadPage> {
  // Build query params, injecting the cursor if present.
  const params = buildLeadQuery(filters);
  if (cursor) params.cursor = cursor;

  const res = await apiClient.get<{
    data: Array<Lead & { _id: string }>;
    nextCursor: string | null;
    hasNext: boolean;
    error?: string;
  }>('/leads', { params, signal });

  // Handle server-level error responses
  if (res.error !== undefined) {
    if (res.error === 'Invalid cursor' || res.error?.includes('Invalid cursor')) {
      throw new InvalidCursorError(cursor ?? 'unknown');
    }
    throw new Error(res.error);
  }

  if (!Array.isArray(res.data)) {
    throw new Error('Unexpected response shape from /api/leads');
  }

  // Map _id -> id to match the existing Lead type and the rest of the codebase.
  const leads: Lead[] = res.data.map((lead) => ({
    ...lead,
    id: lead._id,
  }));

  return {
    data: leads,
    nextCursor: res.nextCursor,
    hasNext: res.hasNext,
  };
}

/**
 * Fetch the total lead count for the given filters.
 *
 * GET /api/leads/count?status=&isHot=&start=&end=
 *
 * @param filters  Query parameters (same filter fields as fetchLeadsPage).
 * @param signal   Optional AbortSignal.
 * @returns        The total number of leads matching the filters.
 * @throws         Error on non-2xx or unexpected shape.
 */
export async function fetchLeadCount(
  filters: LeadFilters,
  signal?: AbortSignal,
): Promise<number> {
  const params = buildLeadQuery(filters);
  // count endpoint only needs filter params, not pagination params
  delete params.cursor;
  delete params.limit;
  delete params.sort;
  delete params.order;
  delete params.fields;

  const res = await apiClient.get<{ count: number; error?: string }>(
    '/leads/count',
    { params, signal },
  );

  if (res.error !== undefined) {
    throw new Error(res.error);
  }
  if (typeof res.count !== 'number') {
    throw new Error('Unexpected response shape from /api/leads/count');
  }

  return res.count;
}
