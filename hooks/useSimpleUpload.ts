// hooks/useSimpleUpload.ts
// Minimal hook for managing upload state
// Works with ANY system - no complex types needed

import { useState, useCallback } from 'react';
import { uploadFiles, uploadWithMerge, deleteFile } from '@/lib/utils/universalFileUpload';

interface UseSimpleUploadProps {
  identifier: string; // deoNo, purchaseNo, leadId, taskId, etc.
  accessToken: string;
  enableMerge?: boolean;
  baseUrl?: string;
}

export function useSimpleUpload({
  identifier,
  accessToken,
  enableMerge = false,
  baseUrl,
}: UseSimpleUploadProps) {
  // State for pending files by stage
  const [pendingFiles, setPendingFiles] = useState<Record<string, File[]>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<string>('');

  /**
   * Add files to a stage
   */
  const addFiles = useCallback((stage: string, files: File[]) => {
    setPendingFiles(prev => ({
      ...prev,
      [stage]: [...(prev[stage] || []), ...files],
    }));
  }, []);

  /**
   * Remove file from a stage
   */
  const removeFile = useCallback((stage: string, index: number) => {
    setPendingFiles(prev => ({
      ...prev,
      [stage]: (prev[stage] || []).filter((_, i) => i !== index),
    }));
  }, []);

  /**
   * Get files for a stage
   */
  const getFiles = useCallback((stage: string): File[] => {
    return pendingFiles[stage] || [];
  }, [pendingFiles]);

  /**
   * Clear files for a stage
   */
  const clearStage = useCallback((stage: string) => {
    setPendingFiles(prev => {
      const updated = { ...prev };
      delete updated[stage];
      return updated;
    });
  }, []);

  /**
   * Clear all pending files
   */
  const clearAll = useCallback(() => {
    setPendingFiles({});
  }, []);

  /**
   * Upload files for a specific stage
   */
  const uploadStage = useCallback(async (stage: string): Promise<boolean> => {
    const files = pendingFiles[stage];
    if (!files?.length) {
      console.warn(`No files to upload for stage: ${stage}`);
      return false;
    }

    setIsUploading(true);
    setProgress(`Uploading ${stage}...`);

    try {
      if (enableMerge) {
        // Upload with PDF merge
        await uploadWithMerge(identifier, stage, files, accessToken, {
          baseUrl,
          onProgress: (current, total, status) => {
            setProgress(`${stage}: ${status} (${current}/${total})`);
          },
        });
      } else {
        // Direct upload
        await uploadFiles(identifier, stage, files, accessToken, {
          baseUrl,
          onProgress: (status) => setProgress(`${stage}: ${status}`),
        });
      }

      // Clear uploaded files
      clearStage(stage);
      setProgress('');
      setIsUploading(false);
      return true;

    } catch (error: any) {
      console.error(`Upload failed for ${stage}:`, error);
      setProgress('');
      setIsUploading(false);
      throw error;
    }
  }, [pendingFiles, identifier, accessToken, enableMerge, baseUrl, clearStage]);

  /**
   * Upload all pending files (all stages)
   */
  const uploadAll = useCallback(async (): Promise<boolean> => {
    const stages = Object.keys(pendingFiles).filter(s => pendingFiles[s]?.length > 0);
    
    if (stages.length === 0) {
      console.warn('No files to upload');
      return false;
    }

    setIsUploading(true);

    try {
      // Upload each stage sequentially
      for (const stage of stages) {
        await uploadStage(stage);
      }
      
      setIsUploading(false);
      return true;

    } catch (error) {
      setIsUploading(false);
      throw error;
    }
  }, [pendingFiles, uploadStage]);

  /**
   * Delete an uploaded file
   */
  const deleteUploadedFile = useCallback(async (fileId: string): Promise<boolean> => {
    try {
      await deleteFile(fileId, accessToken, baseUrl);
      return true;
    } catch (error: any) {
      console.error('Delete failed:', error);
      throw error;
    }
  }, [accessToken, baseUrl]);

  /**
   * Check if any files are pending
   */
  const hasPending = useCallback((): boolean => {
    return Object.values(pendingFiles).some(files => files.length > 0);
  }, [pendingFiles]);

  /**
   * Get total file count
   */
  const getTotalCount = useCallback((): number => {
    return Object.values(pendingFiles).reduce((sum, files) => sum + files.length, 0);
  }, [pendingFiles]);

  return {
    // State
    pendingFiles,
    isUploading,
    progress,
    hasPending: hasPending(),
    totalCount: getTotalCount(),

    // Actions
    addFiles,
    removeFile,
    getFiles,
    clearStage,
    clearAll,
    uploadStage,
    uploadAll,
    deleteUploadedFile,
  };
}