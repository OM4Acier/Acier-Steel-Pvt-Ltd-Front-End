/**
 * lib/hooks/useLeadFilters.ts
 *
 * Owns the filter state for the leads page and exposes a stable `filterKey`
 * that changes whenever any filter value changes.
 *
 * The filter key is what drivePagination / useLeads use to detect when they
 * need to reset pagination and re-fetch page 1.
 *
 * Filter fields (mirror the server query params):
 *   - status : 'In Progress' | 'Completed' | 'Closed' | undefined
 *   - isHot  : boolean | undefined (true = hot only, false = not hot, undefined = all)
 *   - start  : ISO date string | undefined
 *   - end    : ISO date string | undefined
 *   - sort   : SortableField
 *   - order  : SortOrder
 *
 * limit, cursor, fields are NOT owned here — they are pagination concerns
 * handled by useLeads.
 */

import { useCallback, useMemo, useState } from 'react';
import type { LeadFilters, SortableField, SortOrder, LeadStatus } from '@/types/leads.types';
import { DEFAULT_FILTERS } from '@/types/leads.types';

// ── Public types ──────────────────────────────────────────────────────────────

/** A patch of filter changes emitted by the toolbar. Partial — only changed
 * fields need to be present. */
export type FilterPatch = Partial<Pick<LeadFilters, 'status' | 'isHot' | 'start' | 'end' | 'sort' | 'order'>>;

export interface UseLeadFiltersReturn {
  /** Current filters (always a complete LeadFilters object, defaults filled). */
  filters: LeadFilters;
  /** Stable string that changes whenever any filter value changes.
   * Used as a dependency key by useLeads to trigger pagination resets. */
  filterKey: string;
  /** Apply a partial patch of filter changes. Resets cursor-friendly fields
   * (cursor stays where it is — the hook consumer decides when to clear it). */
  update: (patch: FilterPatch) => void;
  /** Reset all filters to defaults. */
  reset: () => void;
  /** Set a specific filter field. Convenience for controlled components. */
  setStatus: (status: LeadStatus | undefined) => void;
  setisHot: (isHot: boolean | undefined) => void;
  setStart: (start: string | undefined) => void;
  setEnd: (end: string | undefined) => void;
  setSort: (sort: SortableField) => void;
  setOrder: (order: SortOrder) => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLeadFilters(): UseLeadFiltersReturn {
  // We store the "interesting" fields separately and derive a full LeadFilters
  // object with defaults filled in. This keeps the state minimal and avoids
  // putting limit/cursor/fields in the filter key.
  const [status, setStatus] = useState<LeadStatus | undefined>(undefined);
  const [isHot, setisHot] = useState<boolean | undefined>(undefined);
  const [start, setStart] = useState<string | undefined>(undefined);
  const [end, setEnd] = useState<string | undefined>(undefined);
  const [sort, setSort] = useState<SortableField>(DEFAULT_FILTERS.sort);
  const [order, setOrder] = useState<SortOrder>(DEFAULT_FILTERS.order);

  // Derive a complete LeadFilters object from the stored values.
  const filters: LeadFilters = useMemo(
    () => ({
      cursor: null, // cursor is owned by the consumer (useLeads), not here
      limit: DEFAULT_FILTERS.limit,
      sort,
      order,
      fields: DEFAULT_FILTERS.fields,
      status,
      isHot,
      start,
      end,
    }),
    [sort, order, status, isHot, start, end],
  );

  // Stable key that changes whenever any filter value changes.
  // Farm hash-style string — cheap, deterministic, unique per combo.
  const filterKey = useMemo(() => {
    const parts = [
      status ?? '',
      isHot === undefined ? '' : String(isHot),
      start ?? '',
      end ?? '',
      sort,
      order,
    ];
    return parts.join('|');
  }, [status, isHot, start, end, sort, order]);

  const update = useCallback((patch: FilterPatch) => {
    if (patch.status !== undefined) setStatus(patch.status);
    if (patch.isHot !== undefined) setisHot(patch.isHot);
    if (patch.start !== undefined) setStart(patch.start);
    if (patch.end !== undefined) setEnd(patch.end);
    if (patch.sort !== undefined) setSort(patch.sort);
    if (patch.order !== undefined) setOrder(patch.order);
  }, []);

  const reset = useCallback(() => {
    setStatus(undefined);
    setisHot(undefined);
    setStart(undefined);
    setEnd(undefined);
    setSort(DEFAULT_FILTERS.sort);
    setOrder(DEFAULT_FILTERS.order);
  }, []);

  return {
    filters,
    filterKey,
    update,
    reset,
    setStatus,
    setisHot,
    setStart,
    setEnd,
    setSort,
    setOrder,
  };
}
