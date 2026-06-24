/**
 * types/purchases.types.ts
 */

export type PurchaseStatus = 'Pending' | 'Approved' | 'Cancelled' | 'Invoiced' | 'Completed';

export interface FileReference {
  fileId: string;
  filename: string;
  fileUrl?: string;
}

export interface EditHistoryEntry {
  timestamp: number;
  editorName: string;
  description: string;
}

export interface Purchase {
  id: string;
  purchaseNo: string;
  supplierName?: string;
  supplierContactNumber?: string;
  productInfo: string;
  invoiceInfo?: string;
  attachments?: FileReference[];
  status: PurchaseStatus;
  cancellationRemarks?: string;
  // Vehicle + Coil Entry
  vehicleNumber?: string;
  unloadingPhotos?: FileReference[];
  // Invoice Upload & Verification
  invoiceDate?: string;
  invoiceNumber?: string;
  invoiceFiles?: FileReference[];
  editHistory?: EditHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface RecentPurchaseNumberResponse {
  recentPurchaseNo: string;
  nextPurchaseNo: string;
}

export interface FileUploadResponse {
  success: boolean;
  uploadedFiles: FileReference[];
}
