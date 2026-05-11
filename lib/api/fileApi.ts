// lib/api/fileApi.ts
import {
  FileUploadResponse,
  UploadedFile,
  ApiError
} from '@/lib/types/task';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

/**
 * Get auth headers
 */
const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem('accessToken');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` })
  };
};

/**
 * Convert File to base64
 */
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};



/**
 * Map identifier type to field name
 * This allows flexible payload structure based on the system using the API
 */
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
    // Add more mappings as needed
  };

  return fieldMap[identifierType.toLowerCase()] || 'id';
};


/**
 * Enhanced error handler
 */
const handleApiError = async (response: Response): Promise<never> => {
  let errorMessage = 'File operation failed';
  let errorDetails = null;

  try {
    const errorData = await response.json();
    errorMessage = errorData.error || errorMessage;
    errorDetails = errorData.details || null;
  } catch {
    errorMessage = response.statusText || errorMessage;
  }

  const error: ApiError = {
    error: errorMessage,
    details: errorDetails,
    //statusCode: response.status
  };

  throw error;
};

export const fileApi = {
  /**
   * POST /api/files/upload
   * Upload files to server and link to identifier
   * 
   * @param identifier - Identifier to attach files to (taskId, orderId, etc.)
   * @param files - Array of File objects to upload
   * @param uploadStage - Stage identifier (e.g., 'attachments', 'audio', 'documents')
   * @param identifierType - Type of identifier (e.g., 'task', 'order', 'project')
   * @returns Array of uploaded file information
   */
  uploadFiles: async (
    identifier: string,
    files: File[],
    uploadStage: string = 'attachments',
    identifierType: string = 'task'
  ): Promise<UploadedFile[]> => {
    try {
      // Convert files to base64
      const filePromises = files.map(async (file) => ({
        filename: file.name,
        mimeType: file.type,
        fileBase64: await fileToBase64(file)
      }));

      const filesData = await Promise.all(filePromises);

      // Get the appropriate field name for this identifier type
      const identifierField = getIdentifierFieldName(identifierType);

      console.log(identifierField,identifier,identifierType,uploadStage);

      // Prepare upload payload with dynamic identifier field
      const uploadData: any = {
        [identifierField]: identifier,  // Dynamic field: taskId, deoNo, poNumber, etc.
        uploadStage,
        files: filesData,
        identifierType
      };

      // Upload to backend
      const response = await fetch(`${API_URL}/files/upload`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(uploadData)
      });

      if (!response.ok) {
        await handleApiError(response);
      }

      const result: FileUploadResponse = await response.json();
      console.log(result);

      if (!result.success) {
        throw {
          error: 'Upload failed',
          details: 'Server returned unsuccessful response',
          statusCode: response.status
        } as ApiError;
      }

      return result.uploadedFiles;
    } catch (error: any) {
      if (error.error) {
        throw error;
      }
      throw {
        error: 'File upload failed',
        details: error.message,
        statusCode: 0
      } as ApiError;
    }
  },

  /**
   * POST /api/files/delete
   * Delete file from server and remove from identifier
   * 
   * @param fileId - File ID (Google Drive file ID or server file ID)
   * @param identifier - Identifier that file is attached to
   * @param identifierType - Type of identifier
   */
  deleteFile: async (
    fileId: string,
    identifier?: string,
    identifierType: string = 'order'
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const identifierField = getIdentifierFieldName(identifierType);

      const uploadData: any = {
        [identifierField]: identifier,  // Dynamic field: taskId, deoNo, poNumber, etc.
        fileId,
        identifierType
      };

      const response = await fetch(`${API_URL}/files/delete`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(uploadData)
      });

      if (!response.ok) {
        await handleApiError(response);
      }

      return response.json();
    } catch (error: any) {
      if (error.error) {
        throw error;
      }
      throw {
        error: 'File deletion failed',
        details: error.message,
        statusCode: 0
      } as ApiError;
    }
  },

  /**
   * GET /media/:fileId/:filename
   * Get file content as base64
   * 
   * @param fileId - File ID
   * @param filename - Original filename
   * @returns Base64 encoded file content
   */
  getFileContent1: async (fileId: string, filename: string): Promise<string> => {
    try {
      const response = await fetch(`${API_URL}/media/${fileId}/${filename}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
  
      if (!response.ok) {
        await handleApiError(response);
      }
  
      // 1. Check content type
      const contentType = response.headers.get('content-type');
  
      // 2. If it's a raw audio file (not JSON)
      if (contentType && (contentType.includes('audio') || contentType.includes('application/octet-stream'))) {
        const blob = await response.blob();
        // Create a local URL for the audio element
        return URL.createObjectURL(blob); 
      }
  
      // 3. Fallback: If it actually IS JSON
      const data = await response.json();
      console.log('JSON Data received:', data);
      return data.base64 || data.content;
  
    } catch (error: any) {
      console.error('getFileContent Error:', error);
      throw error;
    }
  },
  getFileContent: async (fileId: string, filename: string): Promise<Blob> => {
    try {
      const response = await fetch(`${API_URL}/media/${fileId}/${filename}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
  
      if (!response.ok) {
        await handleApiError(response);
      }
  
      // IMPORTANT: get binary data
      return await response.blob();
    } catch (error: any) {
      throw {
        error: 'Failed to fetch file content',
        details: error.message,
        statusCode: 0
      } as ApiError;
    }
  },
  
  getMediaUrl: (fileId: string, filename: string): string => {
    const url = `${API_URL}/media/${fileId}/${filename}`;
    // For direct audio src, you might need to include auth in query param
    // or rely on cookies if your backend supports it
    return url;
  },
  /**
   * Generate Google Drive preview URL
   */
  getPreviewUrl: (fileId: string): string => {
    return `https://drive.google.com/file/d/${fileId}/preview`;
  },

  /**
   * Generate Google Drive view/download URL
   */
  getViewUrl: (fileId: string): string => {
    return `https://drive.google.com/file/d/${fileId}/view`;
  },

  /**
   * Generate Google Drive direct download URL
   */
  getDownloadUrl: (fileId: string): string => {
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }
};