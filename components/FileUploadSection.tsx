// components/FileUploadSection.tsx
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Upload, X, Eye, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { formatFileSize } from '@/lib/utils/pdfMergeUtils';

// Types
export interface UploadedFile {
  fileId: string;
  filename: string;
}

export interface FileUploadSectionProps {
  // Section Config
  stage: string; // 'order-product', 'purchase-vehicle', 'lead-files', etc.
  title: string; // "Product Files", "Delivery Attachments", etc.
  icon?: React.ReactNode;
  
  // Data
  pendingFiles: File[];
  uploadedFiles: UploadedFile[];
  
  // Permissions
  canEdit: boolean;
  canDelete: boolean;
  
  // Callbacks
  onFilesAdd: (files: File[]) => void;
  onFileRemove: (index: number) => void;
  onUploadedFileDelete: (fileId: string) => void;
  
  // Optional
  acceptedFileTypes?: string; // ".jpg,.jpeg,.png,.pdf"
  maxFileSize?: number; // in bytes
  showMergePreview?: boolean;
  mergePreview?: { fileCount: number; totalSize: number } | null;
  defaultOpen?: boolean;
  emptyMessage?: string;
}

export const FileUploadSection: React.FC<FileUploadSectionProps> = ({
  stage,
  title,
  icon,
  pendingFiles,
  uploadedFiles,
  canEdit,
  canDelete,
  onFilesAdd,
  onFileRemove,
  onUploadedFileDelete,
  acceptedFileTypes = '.jpg,.jpeg,.png,.pdf,.webp',
  maxFileSize = 10 * 1024 * 1024, // 10MB default
  showMergePreview = true,
  mergePreview,
  defaultOpen = false,
  emptyMessage = 'No files have been uploaded yet.',
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isDragging, setIsDragging] = useState(false);

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    validateAndAddFiles(droppedFiles);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    validateAndAddFiles(selectedFiles);
    // Reset input
    e.target.value = '';
  };

  const validateAndAddFiles = (files: File[]) => {
    if (files.length === 0) return;

    // Check file sizes
    const oversizedFiles = files.filter(f => f.size > maxFileSize);
    if (oversizedFiles.length > 0) {
      alert(`Some files exceed the ${formatFileSize(maxFileSize)} limit:\n${oversizedFiles.map(f => f.name).join('\n')}`);
      return;
    }

    onFilesAdd(files);
  };

  const inputId = `file-input-${stage}`;

  return (
    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
      {/* Section Header */}
      <div
        className="flex justify-between items-center cursor-pointer group"
        onClick={() => setIsOpen(!isOpen)}
      >
        <h4 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2 text-sm">
          {icon || <Upload className="w-5 h-5 text-gray-500 dark:text-gray-400" />}
          {title}
          
          {/* Pending Files Badge */}
          {pendingFiles.length > 0 && (
            <Badge className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
              {showMergePreview && mergePreview ? (
                <>
                  {mergePreview.fileCount} file{mergePreview.fileCount > 1 ? 's' : ''} → 1 PDF
                  {' '}({formatFileSize(mergePreview.totalSize)})
                </>
              ) : (
                <>
                  {pendingFiles.length} pending
                </>
              )}
            </Badge>
          )}
        </h4>
        
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors" />
        )}
      </div>

      {/* Collapsible Content */}
      <div
        className={`pt-3 space-y-4 transition-all duration-300 ease-in-out ${
          isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
        }`}
      >
        {/* Upload Area - Only show in edit mode */}
        {canEdit && (
          <>
            {/* Drag & Drop Zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-4 text-center transition-all cursor-pointer group ${
                isDragging
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                  : 'border-gray-300 dark:border-gray-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-gray-800'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Input
                id={inputId}
                type="file"
                multiple
                accept={acceptedFileTypes}
                onChange={handleFileInputChange}
                className="hidden"
              />
              <Label htmlFor={inputId} className="cursor-pointer flex flex-col items-center">
                <Upload className="w-8 h-8 mb-2 text-gray-400 group-hover:text-blue-600 transition-colors" />
                <span className="text-base font-medium text-gray-500 dark:text-gray-400">
                  Drag & drop files here
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  or <span className="text-blue-600 dark:text-blue-400 font-semibold">browse your computer</span>
                </span>
                <span className="text-xs text-gray-400 mt-1">
                  Max size: {formatFileSize(maxFileSize)} per file
                </span>
              </Label>
            </div>

            {/* Pending Files List */}
            {pendingFiles.length > 0 && (
              <div className="space-y-2 border p-3 rounded-lg bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
                <h5 className="font-semibold text-gray-800 dark:text-gray-200 text-base">
                  Files Ready to Upload:
                </h5>
                <ul className="space-y-1">
                  {pendingFiles.map((file, index) => (
                    <li
                      key={`${file.name}-${index}`}
                      className="flex items-center justify-between bg-white dark:bg-gray-800 p-2 rounded-md shadow-sm"
                    >
                      <div className="flex-1 min-w-0 mr-2">
                        <span className="text-xs text-gray-700 dark:text-gray-300 truncate font-medium block">
                          {file.name}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatFileSize(file.size)}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onFileRemove(index)}
                        className="text-red-500 hover:bg-red-100 dark:hover:bg-red-900 rounded-full w-6 h-6 flex-shrink-0"
                        title="Remove file"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-orange-700 dark:text-orange-400 mt-2">
                  {showMergePreview && mergePreview && mergePreview.fileCount > 1
                    ? `These files will be merged into a single PDF and uploaded when you click "Save All".`
                    : `These files will be uploaded when you click "Save All".`}
                </p>
              </div>
            )}
          </>
        )}

        {/* Uploaded Files List */}
        {uploadedFiles.length > 0 ? (
          <div className="mt-4 space-y-2">
            <h5 className="font-semibold text-gray-800 dark:text-gray-200 text-base">
              Previously Uploaded Files:
            </h5>
            <div className="space-y-2">
              {uploadedFiles.map((file) => (
                <div
                  key={file.fileId}
                  className="flex items-center justify-between bg-white dark:bg-gray-800 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow"
                >
                  <span className="text-xs font-medium text-blue-700 dark:text-blue-400 truncate flex-1 mr-2">
                    {file.filename}
                  </span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* View Button */}
                    <a
                      href={`https://drive.google.com/file/d/${file.fileId}/preview`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 w-8 h-8 flex items-center justify-center rounded-full hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors"
                      title="View File"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Eye className="w-4 h-4" />
                    </a>
                    
                    {/* Delete Button - Only show if can delete */}
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Are you sure you want to delete "${file.filename}"?`)) {
                            onUploadedFileDelete(file.fileId);
                          }
                        }}
                        className="text-red-500 hover:bg-red-100 dark:hover:bg-red-900 rounded-full w-8 h-8"
                        title="Delete File"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 p-3 text-center border rounded-lg bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            {emptyMessage}
          </p>
        )}
      </div>
    </div>
  );
};

export default FileUploadSection;