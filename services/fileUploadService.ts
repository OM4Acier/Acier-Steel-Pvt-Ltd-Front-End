// services/fileUploadService.ts

import type { FileUploadStage } from '@/types/fileUpload';

/**
 * Universal file upload payload
 */
interface UniversalUploadPayload {
  identifier: string; 
  uploadStage: string; 
  files: {
    filename: string;
    mimeType: string;
    fileBase64: string;
  }[];
}

interface UploadResponse {
  success: boolean;
  message?: string;
  uploadedFiles?: {
    fileId: string;
    filename: string;
  }[];
  error?: string;
}

/**
 * Convert File to base64 string with validation
 */
async function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    // FIX 1: Runtime validation to prevent "parameter 1 is not of type 'Blob'"
    if (!(file instanceof Blob)) {
      console.error('Invalid file object passed to fileToBase64:', file);
      reject(new Error('Item is not a valid File or Blob object'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      // Remove "data:application/pdf;base64," prefix
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * Convert Files array to upload payload format
 */
async function prepareFilesPayload(files: File[]): Promise<{
  filename: string;
  mimeType: string;
  fileBase64: string;
}[]> {
  if (!Array.isArray(files) || files.length === 0) {
    return [];
  }

  const payloadFiles = await Promise.all(
    files.map(async (file) => {
      // Ensure we have a valid file object before processing
      if (!file) throw new Error('Encountered null or undefined file in array');
      
      return {
        filename: file.name || 'unknown_file',
        mimeType: file.type || 'application/octet-stream',
        fileBase64: await fileToBase64(file),
      };
    })
  );
  
  return payloadFiles;
}

/**
 * Normalize stage name for API
 */
function normalizeStageForApi(stage: string): string {
  if (!stage) return 'files';

  // Remove system prefix
  const parts = stage.split('-');
  
  if (parts.length > 1) {
    return parts.slice(1).join('-');
  }
  
  const legacyMap: Record<string, string> = {
    'leadFiles': 'files',
    'leadPhotos': 'photos',
    'leadDocuments': 'documents',
  };
  
  return legacyMap[stage] || stage;
}

export class FileUploadService {
  private baseUrl: string;

  constructor(baseUrl: string = '/api/files') {
    this.baseUrl = baseUrl;
  }

  /**
   * Upload files to universal endpoint
   * FIX 2: Relaxed 'stage' type to string to prevent assignment errors,
   * while still allowing FileUploadStage via the union or just string.
   */
  async uploadFiles(
    identifier: string,
    stage: FileUploadStage | string, 
    files: File[],
    accessToken: string
  ): Promise<UploadResponse> {
    try {
      if (!files || files.length === 0) {
        throw new Error('No files provided for upload');
      }

      // Prepare files payload
      const filesPayload = await prepareFilesPayload(files);
      
      // Normalize stage for API
      const uploadStage = normalizeStageForApi(stage);
      
      const payload: UniversalUploadPayload = {
        identifier,
        uploadStage,
        files: filesPayload,
      };

      const response = await fetch(`${this.baseUrl}/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Upload failed: ${response.statusText}`);
      }

      return await response.json();

    } catch (error: any) {
      console.error('File upload error:', error);
      throw error;
    }
  }

  async deleteFile(
    fileId: string,
    accessToken: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/delete/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Delete failed: ${response.statusText}`);
      }

      return await response.json();

    } catch (error: any) {
      console.error('File delete error:', error);
      throw error;
    }
  }

  /**
   * Get file info
   */
  async getFileInfo(
    fileId: string,
    accessToken: string
  ): Promise<{
    fileId: string;
    filename: string;
    size?: number;
    uploadedAt?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/info/${fileId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get file info: ${response.statusText}`);
      }

      return await response.json();

    } catch (error: any) {
      console.error('Get file info error:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const fileUploadService = new FileUploadService();

// Export for custom base URL
export default FileUploadService;