// fileUtils.ts - File Compression and Handling Utilities

import { FILE_COMPRESSION_CONFIG } from './constants';

export interface CompressedFile {
  filename: string;
  mimeType: string;
  fileBase64: string;
}

export const compressAndConvertFile = (file: File): Promise<CompressedFile> => {
  return new Promise((resolve, reject) => {
    // Handle PDFs without compression
    if (file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const base64String = (event.target?.result as string).split(',')[1];
        resolve({
          filename: file.name,
          mimeType: file.type,
          fileBase64: base64String,
        });
      };
      reader.onerror = (error) => reject(error);
      return;
    }

    // Handle images with compression
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        const { MAX_WIDTH, MAX_HEIGHT, JPEG_QUALITY } = FILE_COMPRESSION_CONFIG;
        
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions while maintaining aspect ratio
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        let outputMimeType = file.type;
        const compressionQuality = JPEG_QUALITY;

        // Use original mime type if supported
        if (!['image/jpeg', 'image/webp'].includes(file.type)) {
          outputMimeType = file.type;
        }

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const readerBlob = new FileReader();
              readerBlob.readAsDataURL(blob);
              readerBlob.onloadend = () => {
                const base64String = (readerBlob.result as string).split(',')[1];
                resolve({
                  filename: file.name,
                  mimeType: outputMimeType,
                  fileBase64: base64String,
                });
              };
            } else {
              reject(new Error('Canvas to Blob conversion failed.'));
            }
          },
          outputMimeType,
          compressionQuality
        );
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const formatContactNumberForWhatsApp = (contactNo: string | undefined): string => {
  if (!contactNo) return '';
  const digitsOnly = contactNo.replace(/\D/g, '');
  // Add +91 if no country code present
  if (!contactNo.startsWith('+')) {
    return `+91${digitsOnly}`;
  }
  return digitsOnly;
};

export const handleDragOver = (event: React.DragEvent) => {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.classList.add('border-blue-500', 'bg-blue-50');
};

export const handleDragLeave = (event: React.DragEvent) => {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
};

export const handleDrop = (
  event: React.DragEvent,
  callback: (files: File[]) => void
) => {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
  
  const files = Array.from(event.dataTransfer.files);
  callback(files);
};