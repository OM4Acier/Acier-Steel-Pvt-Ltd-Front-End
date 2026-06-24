import { apiClient, axiosInstance } from '../client';

export interface UploadedFile {
  fileId: string;
  filename: string;
  mimeType: string;
  fileUrl?: string;
  size?: number;
}

export interface FileUploadResponse {
  success: boolean;
  uploadedFiles: UploadedFile[];
}

const getIdentifierFieldName = (identifierType: string): string => {
  const fieldMap: Record<string, string> = {
    'task': 'taskId',
    'order': 'deoNo',
    'po': 'poNumber',
    'project': 'projectId',
    'ticket': 'ticketId',
    'invoice': 'invoiceId',
    'customer': 'customerId',
    'user': 'userId',
    'item': 'itemId',
    'product': 'productId',
  };
  return fieldMap[identifierType.toLowerCase()] || 'id';
};

/**
 * lib/api/endpoints/fileApi.ts
 *
 * Centralized File Upload and Media API endpoints.
 */
export const fileApi = {
  /**
   * Upload files and associate them with a task, order, etc.
   * POST /files/upload
   */
  uploadFiles: async (
    identifier: string,
    files: File[],
    uploadStage: string = 'attachments',
    identifierType: string = 'task'
  ): Promise<UploadedFile[]> => {
    // Convert files to base64
    const filePromises = files.map(async (file) => {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = (error) => reject(error);
      });
      return {
        filename: file.name,
        mimeType: file.type,
        fileBase64: base64,
      };
    });

    const filesData = await Promise.all(filePromises);
    const identifierField = getIdentifierFieldName(identifierType);

    const uploadData = {
      [identifierField]: identifier,
      uploadStage,
      files: filesData,
      identifierType,
    };

    const res = await apiClient.post<FileUploadResponse>('/files/upload', uploadData);
    if (!res) throw new Error('Request cancelled');
    if (!res.success) {
      throw new Error('Upload failed: server returned unsuccessful response');
    }
    return res.uploadedFiles;
  },

  /**
   * Delete file
   * POST /files/delete
   */
  deleteFile: async (
    fileId: string,
    identifier?: string,
    identifierType: string = 'order'
  ): Promise<{ success: boolean; message: string }> => {
    const identifierField = getIdentifierFieldName(identifierType);
    const payload = {
      [identifierField]: identifier,
      fileId,
      identifierType,
    };
    const res = await apiClient.post<{ success: boolean; message: string }>('/files/delete', payload);
    if (!res) throw new Error('Request cancelled');
    return res;
  },

  /**
   * Get file content as Blob (binary)
   * GET /media/:fileId/:filename
   */
  getFileContent: async (fileId: string, filename: string): Promise<Blob> => {
    return axiosInstance.get<any, Blob>(`/media/${fileId}/${filename}`, { responseType: 'blob' });
  },

  /**
   * Direct media URL builder
   */
  getMediaUrl: (fileId: string, filename: string): string => {
    const baseURL = axiosInstance.defaults.baseURL || '';
    const cleanBaseURL = baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;
    return `${cleanBaseURL}/media/${fileId}/${filename}`;
  },

  /**
   * Google Drive preview URL builder
   */
  getPreviewUrl: (fileId: string): string => {
    return `https://drive.google.com/file/d/${fileId}/preview`;
  },

  /**
   * Google Drive view URL builder
   */
  getViewUrl: (fileId: string): string => {
    return `https://drive.google.com/file/d/${fileId}/view`;
  },

  /**
   * Google Drive direct download URL builder
   */
  getDownloadUrl: (fileId: string): string => {
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  },
};
