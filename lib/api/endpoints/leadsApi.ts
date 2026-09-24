import { apiClient } from '../client';
export type LeadStatus = 'In Progress' | 'Completed' | 'Closed';
export type LeadPriority = 'High' | 'Medium' | 'Low';

export interface EditHistoryEntry {
  /**
   * Subdocument `_id`s are NOT renamed by the backend `toApiLead` mapper —
   * that only strips/renames top-level `_id`. If you don't want to see
   * `_id` on edit history rows, either:
   *   (a) add `.select('-editHistory._id')` on the server, or
   *   (b) exclude editHistory from the list `SELECTABLE_FIELDS`, or
   *   (c) strip it in the mapper (see note at the bottom).
   * For now this stays optional and matches what the server actually sends.
   */
  _id?: string;
  timestamp: string | number;
  editorName: string;
  description: string;
}

export interface FileMetadata {
  fileId: string;
  filename: string;
  fileUrl?: string;
}

export interface ExistingLeadInfo {
  createdByName?: string;
  daysSinceCreated: number;
}

export interface Lead {
  // ✅ was `any` — server always sends a boolean for isHot
  isHot?: boolean;

  id: string;
  leadId: string;
  clientName: string;
  phone: string;
  productInterest: string;
  status: LeadStatus;

  // ⚠️ Backend `ILead` has no `priority` field — this is client-only.
  //    Either the server needs the field added, or every `priority` reference
  //    on the frontend resolves to `undefined` at runtime. Confirm which.
  priority?: LeadPriority;

  closingNote?: string;
  reminderDate?: string;
  editHistory?: EditHistoryEntry[];
  uploadedFiles?: FileMetadata[];
  createdBy: string;
  createdByName: string;
  existingLeads?: ExistingLeadInfo[];
  createdAt?: string;
  updatedAt?: string;
}

// ---------------------------------------------------------------------------
// New shapes required by the cursor-based list endpoint
// ---------------------------------------------------------------------------

export type SortableField = 'createdAt' | 'updatedAt' | 'clientName' | 'status';
export type SortOrder = 'asc' | 'desc';

export interface LeadQuery {
  limit?: number;
  cursor?: string | null;
  sort?: SortableField;
  order?: SortOrder;
  status?: LeadStatus;
  isHot?: boolean;
  start?: string;   // ISO timestamp — never bare YYYY-MM-DD
  end?: string;     // ISO timestamp — always endOfDayIso for the last day
}

export interface LeadPage {
  data: Lead[];
  nextCursor: string | null;
  hasNext: boolean;
}

/**
 * lib/api/endpoints/leadsApi.ts
 *
 * Centralized API endpoints for Leads.
 */
export const leadsApi = {
  /**
 * Fetch a page of leads.
 * GET /leads?limit=&cursor=&sort=&order=&status=&isHot=&start=&end=
 */
fetchLeads: async (
  params: LeadQuery = {},
): Promise<LeadPage> => {
  const query = new URLSearchParams();
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.sort) query.set('sort', params.sort);
  if (params.order) query.set('order', params.order);
  if (params.status) query.set('status', params.status);
  if (params.isHot !== undefined) query.set('isHot', String(params.isHot));
  if (params.start) query.set('start', params.start);
  if (params.end) query.set('end', params.end);

  const qs = query.toString();
  const response = await apiClient.get<LeadPage | null>(`/leads${qs ? `?${qs}` : ''}`);

  // apiClient returns null on cancellation (AbortController)
  if (!response) {
    return { data: [], nextCursor: null, hasNext: false };
  }

  // Defensive: if the backend ever returns the legacy array shape (e.g. during
  // a partial rollout), wrap it so callers never see a shape mismatch.
  if (Array.isArray(response)) {
    return { data: response as Lead[], nextCursor: null, hasNext: false };
  }

  return response;
},

  /**
   * Create a new lead
   * POST /leads
   */
  addLead: async (leadData: Omit<Lead, 'id' | 'leadId' | 'status' | 'editHistory' | 'uploadedFiles'>): Promise<Lead> => {
    const payload = { ...leadData, status: 'In Progress' as LeadStatus };
    const newLead = await apiClient.post<any>('/leads', payload);
    if (!newLead) throw new Error('Request cancelled');
    // Backend may return `id` directly or nest it under `_id`; normalise.
    return { ...newLead, id: newLead.id ?? newLead._id };
  },

  /**
   * Update lead fields and optionally add a history entry
   * PUT /leads/:id
   */
  updateLead: async (
    leadId: string,
    updatedFields: Partial<Omit<Lead, 'id' | 'editHistory'>>,
    newHistoryEntry: EditHistoryEntry | null
  ): Promise<Lead> => {
    const payload: any = { ...updatedFields };
    if (newHistoryEntry) {
      payload.editHistory = newHistoryEntry;
    }
    const updatedLead = await apiClient.put<any>(`/leads/${leadId}`, payload);
    if (!updatedLead) throw new Error('Request cancelled');
    // Backend may return `id` directly or nest it under `_id`; normalise.
    return { ...updatedLead, id: updatedLead.id ?? updatedLead._id };
  },

  /**
   * Delete lead by ID
   * DELETE /leads/:id
   */
  deleteLead: async (leadId: string): Promise<void> => {
    await apiClient.delete(`/leads/${leadId}`);
  },

  /**
   * Upload lead files
   * POST /files/upload
   */
  uploadFile: async (leadId: string, files: { filename: string; mimeType: string; fileBase64: string }[]) => {
    return apiClient.post<any>('/files/upload', { leadId, uploadStage: 'lead-documents', files });
  },

  /**
   * Delete lead file
   * POST /files/delete
   */
  deleteFile: async (fileId: string) => {
    return apiClient.post<any>('/files/delete', { fileId });
  },
};
