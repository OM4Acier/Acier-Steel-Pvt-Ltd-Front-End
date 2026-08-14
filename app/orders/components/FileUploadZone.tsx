// app/orders/components/FileUploadZone.tsx
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Upload, X, Eye, Trash2 } from 'lucide-react';
import { handleDragOver, handleDragLeave, handleDrop } from '../fileUtils';
import { formatFileSize } from '@/lib/utils/pdfMergeUtils';
import { PermissionGate } from '@/components/PermissionGate';

export interface UploadedDriveFile {
  fileId: string;
  filename: string;
  fileName?: string;
  _id?: string;
}

interface FileUploadZoneProps {
  stage: 'product' | 'vehicle' | 'invoice';
  sectionId: string;
  accept: string;
  isEditMode: boolean;
  canEdit: boolean;
  pendingFiles: File[];
  mergePreview?: { fileCount: number; totalSize: number };
  uploadedFiles: UploadedDriveFile[];
  onFileAdd: (files: File[]) => void;
  onFileRemove: (index: number) => void;
  onDeleteUploadedFile: (fileId: string, stage: 'product' | 'vehicle' | 'invoice') => void;
}

export const FileUploadZone: React.FC<FileUploadZoneProps> = ({
  stage,
  sectionId,
  accept,
  isEditMode,
  canEdit,
  pendingFiles,
  mergePreview,
  uploadedFiles,
  onFileAdd,
  onFileRemove,
  onDeleteUploadedFile,
}) => {
  const inputId = `${stage}-files`;
  const hasPending = pendingFiles.length > 0;
  const hasUploaded = uploadedFiles.length > 0;

  return (
    <div className="space-y-4">
      {/* Upload header */}
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-gray-800 dark:text-gray-200 text-base flex items-center gap-2">
          {stage === 'product' ? 'Product Files' : stage === 'vehicle' ? 'Delivery Attachments' : 'Invoice Files'}
          {hasPending && (
            <Badge className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
              {pendingFiles.length} pending
            </Badge>
          )}
          {mergePreview && (
            <Badge className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
              {mergePreview.fileCount} file{mergePreview.fileCount > 1 ? 's' : ''}
              {` → 1 PDF (${formatFileSize(mergePreview.totalSize)})`}
            </Badge>
          )}
        </h4>
      </div>

      {/* Dropzone — permission gated */}
      <PermissionGate module="orders" section={sectionId}>
        {isEditMode && canEdit && (
          <div
            className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center text-gray-500 dark:text-gray-400 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-gray-800 transition-colors cursor-pointer group"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, onFileAdd)}
          >
            <Input
              id={inputId}
              type="file"
              multiple
              accept={accept}
              onChange={(e) => onFileAdd(Array.from(e.target.files || []))}
              className="hidden"
            />
            <Label htmlFor={inputId} className="cursor-pointer flex flex-col items-center">
              <Upload className="w-8 h-8 mb-2 text-gray-400 group-hover:text-blue-600 transition-colors" />
              <span className="text-base font-medium">Drag & drop files here</span>
              <span className="text-xs">
                or <span className="text-blue-600 dark:text-blue-400 font-semibold">browse your computer</span>
              </span>
            </Label>
          </div>
        )}
      </PermissionGate>

      {/* Pending files */}
      {hasPending && (
        <div className="space-y-2 border p-3 rounded-lg bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
          <h5 className="font-semibold text-gray-800 dark:text-gray-200 text-base">Files Ready to Upload:</h5>
          <ul className="space-y-1">
            {pendingFiles.map((file, index) => (
              <li key={index} className="flex items-center justify-between bg-white dark:bg-gray-800 p-2 rounded-md shadow-sm">
                <span className="text-xs text-gray-700 dark:text-gray-300 truncate font-medium">{file.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onFileRemove(index)}
                  className="text-red-500 hover:bg-red-100 dark:hover:bg-red-900 rounded-full w-6 h-6"
                >
                  <X className="w-4 h-4" />
                </Button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-orange-700 dark:text-orange-400 mt-2">
            These files will be uploaded when you click &quot;Save All&quot;.
          </p>
        </div>
      )}

      {/* Uploaded files */}
      {hasUploaded ? (
        <div className="mt-4 space-y-2">
          <h5 className="font-semibold text-gray-800 dark:text-gray-200 text-base">Previously Uploaded Files:</h5>
          <div className="space-y-2">
            {uploadedFiles.map((file) => (
              <div key={file.fileId} className="flex items-center justify-between bg-white dark:bg-gray-800 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                <span className="text-xs font-medium text-blue-700 dark:text-blue-400 truncate">{file.filename}</span>
                <div className="flex items-center gap-1">
                  <a
                    href={`https://drive.google.com/file/d/${file.fileId}/preview`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 w-8 h-8 flex items-center justify-center rounded-full hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors"
                    title="View File"
                  >
                    <Eye className="w-4 h-4" />
                  </a>
                  {/* Delete button — permission gated */}
                  <PermissionGate module="orders" section={`${sectionId}-delete`}>
                    {isEditMode && canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDeleteUploadedFile(file.fileId, stage)}
                        className="text-red-500 hover:bg-red-100 dark:hover:bg-red-900 rounded-full w-8 h-8"
                        title="Delete File"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </PermissionGate>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 p-3 text-center border rounded-lg bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          No files uploaded yet.
        </p>
      )}
    </div>
  );
};
