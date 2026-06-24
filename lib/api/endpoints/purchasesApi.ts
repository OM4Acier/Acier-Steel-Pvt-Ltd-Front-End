import { apiClient } from '../client';
import {
  Purchase,
  RecentPurchaseNumberResponse,
  FileUploadResponse,
  EditHistoryEntry
} from '@/types/purchases.types';

/**
 * lib/api/endpoints/purchasesApi.ts
 */

export const purchasesApi = {
  /**
   * Fetch all purchases.
   * GET /api/purchases
   */
  getPurchases: async (): Promise<Purchase[]> => {
    const res = await apiClient.get<any[]>('/purchases');
    if (!res) return []; // Handle cancellation
    if (!Array.isArray(res)) {
      console.error('[purchasesApi] Expected array but got:', res);
      return [];
    }
    return res.map((p: any) => ({ ...p, id: p._id }));
  },

  /**
   * Create a new purchase.
   * POST /api/purchases
   */
  createPurchase: async (data: Partial<Purchase>): Promise<Purchase> => {
    const res = await apiClient.post<any>('/purchases', data);
    if (!res) throw new Error('Request cancelled');
    return { ...res, id: res._id };
  },

  /**
   * Update an existing purchase.
   * PUT /api/purchases/:id
   */
  updatePurchase: async (
    id: string, 
    data: Partial<Purchase>, 
    newHistoryEntry?: EditHistoryEntry
  ): Promise<Purchase> => {
    const payload = { ...data };
    if (newHistoryEntry) {
      (payload as any).editHistory = newHistoryEntry; 
    }
    const res = await apiClient.put<any>(`/purchases/${id}`, payload);
    if (!res) throw new Error('Request cancelled');
    return { ...res, id: res._id };
  },

  /**
   * Delete a purchase.
   * DELETE /api/purchases/:id
   */
  deletePurchase: async (id: string): Promise<void> => {
    await apiClient.delete(`/purchases/${id}`);
  },

  /**
   * Upload files for a purchase.
   * POST /api/files/upload
   */
  uploadFiles: async (
    purchaseNo: string,
    uploadStage: 'purchase-product' | 'purchase-vehicle' | 'purchase-invoice',
    files: { filename: string; mimeType: string; fileBase64: string }[]
  ): Promise<FileUploadResponse> => {
    return apiClient.post<FileUploadResponse>('/files/upload', {
      purchaseNo,
      uploadStage,
      files
    });
  },

  /**
   * Delete a file.
   * POST /api/files/delete
   */
  deleteFile: async (fileId: string): Promise<{ success: boolean; message: string }> => {
    return apiClient.post('/files/delete', { fileId });
  },

  /**
   * Get recent purchase numbers.
   * GET /api/purchases/recent-number
   */
  getRecentNumber: async (): Promise<RecentPurchaseNumberResponse> => {
    const res = await apiClient.get<RecentPurchaseNumberResponse>('/purchases/recent-number');
    if (!res) throw new Error('Request cancelled');
    return res;
  },
};
