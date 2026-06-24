// lib/universalFileUpload.ts
// Simple, reusable upload service for any system
  
  /**
   * Universal Upload Function
   * Works with ANY system (ORDER, PURCHASE, LEADS, TASKS, etc.)
   * 
   * @param identifier - Unique ID (deoNo, purchaseNo, leadId, taskId, etc.)
   * @param stage - Upload stage (product, vehicle, invoice, files, etc.)
   * @param files - Array of files to upload
   * @param accessToken - Auth token
   * @param options - Optional configuration
   */
// Define the shape of your pre-processed object
interface PreProcessedFile {
    filename: string;
    mimeType: string;
    fileBase64: string;
  }
  
  // Helper: fileToBase64 (Must accept Blob/File)
  async function fileToBase64(file: File | Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!(file instanceof Blob)) {
         // Stop the crash if a bad object gets here
        reject(new Error('Input is not a File or Blob'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  
  // Main Export
  export async function uploadFiles(
    identifier: string,
    stage: string,
    files: (File | PreProcessedFile)[],
    accessToken: string,
    options?: {
      baseUrl?: string;
      onProgress?: (status: string) => void;
    }
  ): Promise<{
    success: boolean;
    message?: string;
    uploadedFiles?: { fileId: string; filename: string }[];
  }> {
    // 1. Get Base URL from Environment Variables, falling back to '/api/files'
    const API_BASE_URL = process.env.NEXT_PUBLIC_BASE_API_URL || '';
    const DEFAULT_PATH = '/files/upload'; // Path for the upload endpoint
  
    // 2. Combine the environment variable with the optional override and default path
    const fullBaseUrl = options?.baseUrl || API_BASE_URL;
    const uploadUrl = `${fullBaseUrl}${DEFAULT_PATH}`; // Assumes API_BASE_URL ends without a slash, and the path starts with one
  
    const { onProgress } = options || {};
  
    try {
      if (!files?.length) throw new Error('No files provided');
      if (!identifier) throw new Error('Identifier is required');
      if (!stage) throw new Error('Stage is required');
  
      onProgress?.('Preparing files...');
      
      // 3. Smart Conversion Logic (Fixes the 'readAsDataURL' crash)
      const filesPayload = await Promise.all(
        files.map(async (file) => {
          // If it's a plain object (PreProcessedFile), return it
          if ('fileBase64' in file) {
            return {
              filename: file.filename,
              mimeType: file.mimeType,
              fileBase64: file.fileBase64
            };
          }
  
          // If it's a browser File/Blob, convert it
          return {
            filename: file.name,
            mimeType: file.type || 'application/octet-stream',
            fileBase64: await fileToBase64(file),
          };
        })
      );
  
      onProgress?.('Uploading...');
  
      // 4. Use the constructed upload URL
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          identifier,
          uploadStage: stage,
          files: filesPayload,
        }),
      });
  
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Upload failed: ${response.statusText}`);
      }
  
      const result = await response.json();
      onProgress?.('Upload complete!');
      return result;
  
    } catch (error: any) {
      console.error('Upload error:', error);
      throw error;
    }
  }


  
  /**
   * Delete uploaded file
   */
  export async function deleteFile(
    fileId: string,
    accessToken: string,
    baseUrl: string = '/api/files'
  ): Promise<{ success: boolean; message?: string }> {
    const response = await fetch(`${baseUrl}/delete/${fileId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
  
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Delete failed');
    }
  
    return response.json();
  }
  
  /**
   * Upload with PDF merge support
   * Uses your existing pdfMergeUtils
   */
  export async function uploadWithMerge(
    identifier: string,
    stage: string,
    files: File[],
    accessToken: string,
    options?: {
      baseUrl?: string;
      onProgress?: (current: number, total: number, status: string) => void;
    }
  ): Promise<{
    success: boolean;
    message?: string;
    uploadedFiles?: { fileId: string; filename: string }[];
  }> {
    const { onProgress } = options || {};
  
    // Import pdfMergeUtils dynamically to avoid circular deps
    const { processFilesToPdf, pdfBytesToFile } = await import('./pdfMergeUtils');
  
    // Process and merge files
    const { pdfBytes, filename } = await processFilesToPdf(
      files,
      stage as any,
      onProgress
    );
  
    // Convert to upload format
    const pdfFile = await pdfBytesToFile(pdfBytes, filename);
  
    // Upload merged PDF
    return uploadFiles(
      identifier,
      stage,
      [pdfFile as any], // pdfBytesToFile returns correct format
      accessToken,
      { onProgress: (status) => onProgress?.(1, 1, status) }
    );
  }