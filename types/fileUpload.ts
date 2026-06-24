// types/fileUpload.ts

/**
 * System types that support file uploads
 */
export type SystemType = 'ORDER' | 'PURCHASE' | 'LEADS' | 'TASKS';

/**
 * Stage configuration for different systems
 */
export const FILE_UPLOAD_STAGES = {
  ORDER: [
    'order-product',
    'order-vehicle',
    'order-invoice',
  ],
  PURCHASE: [
    'purchase-product',
    'purchase-vehicle',
    'purchase-invoice',
  ],
  LEADS: [
    'lead-files',
    'lead-photos',
    'lead-documents',
    // Legacy support
    'leadFiles',
    'leadPhotos',
    'leadDocuments',
    'files',
  ],
  TASKS: [
    'task-attachments',
    'task-documents',
  ],
} as const;

/**
 * Extract stage types from config
 */
export type OrderStage = (typeof FILE_UPLOAD_STAGES.ORDER)[number];
export type PurchaseStage = (typeof FILE_UPLOAD_STAGES.PURCHASE)[number];
export type LeadStage = (typeof FILE_UPLOAD_STAGES.LEADS)[number];
export type TaskStage = (typeof FILE_UPLOAD_STAGES.TASKS)[number];
export type FileUploadStage = OrderStage | PurchaseStage | LeadStage | TaskStage;

/**
 * Identifier types for different systems
 */
export type SystemIdentifier = {
  ORDER: { deoNo: string };
  PURCHASE: { purchaseNo: string };
  LEADS: { leadId: string };
  TASKS: { taskId: string };
};

/**
 * Upload metadata for tracking
 */
export interface UploadMetadata {
  system: SystemType;
  identifier: string; // deoNo, purchaseNo, leadId, taskId
  stage: FileUploadStage;
  timestamp: number;
  uploader: string;
}

/**
 * File info from server
 */
export interface UploadedFileInfo {
  fileId: string;
  filename: string;
  uploadedAt?: string;
  uploadedBy?: string;
  size?: number;
}

/**
 * Stage display configuration
 */
export interface StageConfig {
  stage: FileUploadStage;
  title: string;
  icon?: React.ReactNode;
  emptyMessage?: string;
  acceptedFileTypes?: string;
  maxFileSize?: number;
  enableMerge?: boolean;
}

/**
 * Helper to get system type from stage
 */
export function getSystemFromStage(stage: FileUploadStage): SystemType {
  if (stage.startsWith('order-')) return 'ORDER';
  if (stage.startsWith('purchase-')) return 'PURCHASE';
  if (stage.startsWith('lead-') || stage.includes('lead') || stage === 'files') return 'LEADS';
  if (stage.startsWith('task-')) return 'TASKS';
  throw new Error(`Unknown stage: ${stage}`);
}

/**
 * Helper to normalize legacy stage names
 */
export function normalizeStage(stage: string): FileUploadStage {
  // Legacy mapping
  const legacyMap: Record<string, FileUploadStage> = {
    'leadFiles': 'lead-files',
    'leadPhotos': 'lead-photos',
    'leadDocuments': 'lead-documents',
    'files': 'lead-files',
  };

  return (legacyMap[stage] as FileUploadStage) || (stage as FileUploadStage);
}
