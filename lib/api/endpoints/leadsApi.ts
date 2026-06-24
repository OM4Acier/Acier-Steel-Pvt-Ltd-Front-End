import { apiClient } from '../client';

export type LeadStatus = 'In Progress' | 'Completed' | 'Closed';
export type LeadPriority = 'High' | 'Medium' | 'Low';

export interface EditHistoryEntry {
  timestamp: number;
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
  isHot?: any;
  id: string;
  leadId: string;
  clientName: string;
  phone: string;
  productInterest: string;
  status: LeadStatus;
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

/**
 * lib/api/endpoints/leadsApi.ts
 *
 * Centralized API endpoints for Leads.
 */
export const leadsApi = {
  /**
   * Fetch all leads
   * GET /leads
   */
  fetchLeads: async (): Promise<Lead[]> => {
    const fetchedLeads = await apiClient.get<any[]>('/leads');
    if (!fetchedLeads) return []; // Handle cancellation
    if (!Array.isArray(fetchedLeads)) {
      console.error('[leadsApi] Expected array but got:', fetchedLeads);
      return [];
    }
    return fetchedLeads.map((lead: any) => ({ ...lead, id: lead._id }));
  },

  /**
   * Create a new lead
   * POST /leads
   */
  addLead: async (leadData: Omit<Lead, 'id' | 'leadId' | 'status' | 'editHistory' | 'uploadedFiles'>): Promise<Lead> => {
    const payload = { ...leadData, status: 'In Progress' as LeadStatus };
    const newLead = await apiClient.post<any>('/leads', payload);
    if (!newLead) throw new Error('Request cancelled');
    return { ...newLead, id: newLead._id };
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
    return { ...updatedLead, id: updatedLead._id };
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
