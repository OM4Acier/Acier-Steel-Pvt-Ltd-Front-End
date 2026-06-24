// components/AudioManager.tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronDown, ChevronUp, Upload, X, Music, Mic, Save } from 'lucide-react';
import { fileApi } from '@/lib/api/endpoints/fileApi';
import AudioPlayer from './AudioPlayer';
import AudioRecorder from './AudioRecorder';
import { UserProfile } from '@/types/rbac.types';
import { hasAnyRole } from '@/utils/rbac.utils';

interface AudioFile {
  fileId: string;
  filename: string;
  _id: string;
}

interface AudioManagerProps {
  identifier: string;
  identifierType?: string;
  uploadStage?: string;
  initialFiles?: AudioFile[];
  onFilesChange?: (files: AudioFile[]) => void;
  onUploadComplete?: () => void;
  editMode?: boolean;
  maxFiles?: number;
  acceptedFormats?: string[];
  currentUser?: UserProfile | null;
  // NEW: Staging mode props
  stagingMode?: boolean;
  pendingFiles?: File[];
  onFilesStaged?: (files: File[]) => void;
  onFileRemoved?: (index: number) => void;
}

const AudioManager: React.FC<AudioManagerProps> = ({
  identifier,
  identifierType = 'task',
  uploadStage = 'audio',
  initialFiles = [],
  onFilesChange,
  onUploadComplete,
  editMode = true,
  maxFiles = 10,
  acceptedFormats = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/webm'],
  currentUser = null,
  // NEW: Staging mode props
  stagingMode = false,
  pendingFiles = [],
  onFilesStaged,
  onFileRemoved
}) => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isRecorderOpen, setIsRecorderOpen] = useState(false);
  const [showUploadMode, setShowUploadMode] = useState(false);
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>(initialFiles);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAudioFiles(initialFiles);
  }, [initialFiles]);

  // RBAC: Check if user can record audio
  const canRecordAudio = currentUser
    ? hasAnyRole(currentUser, ['super-admin', 'sales'])
    : false;

  // RBAC: Check if user can upload files
  const canUploadFiles = canRecordAudio && editMode && currentUser;

  // Validate file type
  const isValidAudioFile = (file: File): boolean => {
    return acceptedFormats.some(format =>
      file.type === format || file.name.toLowerCase().endsWith(format.split('/')[1])
    );
  };

  // Handle file selection
  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return;

    const validFiles: File[] = [];
    const invalidFiles: string[] = [];

    Array.from(files).forEach(file => {
      if (isValidAudioFile(file)) {
        validFiles.push(file);
      } else {
        invalidFiles.push(file.name);
      }
    });

    if (invalidFiles.length > 0) {
      setError(`Invalid: ${invalidFiles.join(', ')}`);
      setTimeout(() => setError(null), 3000);
    }

    if (validFiles.length > 0) {
      const totalFiles = (stagingMode ? pendingFiles.length : selectedFiles.length) + validFiles.length + audioFiles.length;
      if (totalFiles > maxFiles) {
        setError(`Max ${maxFiles} files`);
        setTimeout(() => setError(null), 3000);
        return;
      }

      // NEW: If staging mode, send to parent
      if (stagingMode && onFilesStaged) {
        onFilesStaged(validFiles);
        setShowUploadMode(false);
      } else {
        setSelectedFiles(prev => [...prev, ...validFiles]);
      }
    }
  }, [selectedFiles, audioFiles, maxFiles, acceptedFormats, stagingMode, pendingFiles, onFilesStaged]);

  // Handle recording complete
  const handleRecordingComplete = (audioBlob: Blob, filename: string) => {
    if (!canRecordAudio) {
      setError('You do not have permission to record audio');
      setTimeout(() => setError(null), 3000);
      return;
    }

    const file = new File([audioBlob], filename, { type: 'audio/webm' });

    // NEW: If staging mode, send to parent instead of immediate upload
    if (stagingMode && onFilesStaged) {
      onFilesStaged([file]);
      setIsRecorderOpen(false);
    } else {
      setSelectedFiles([file]);
      setIsRecorderOpen(false);
      handleUpload([file]);
    }
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  // Upload files to server (only used in non-staging mode)
  const handleUpload = async (filesToUpload?: File[]) => {
    const files = filesToUpload || selectedFiles;
    if (files.length === 0) return;

    setIsUploading(true);
    setError(null);

    try {
      const uploadedFiles = await fileApi.uploadFiles(
        identifier,
        files,
        uploadStage,
        identifierType
      );

      const newFiles = uploadedFiles.map(file => ({
        fileId: file.fileId,
        filename: file.filename,
        _id: file.fileId
      }));

      const updatedFiles = [...audioFiles, ...newFiles];
      setAudioFiles(updatedFiles);
      setSelectedFiles([]);
      setShowUploadMode(false);

      if (onFilesChange) onFilesChange(updatedFiles);
      if (onUploadComplete) onUploadComplete();
    } catch (err: any) {
      setError(err.error || 'Upload failed');
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  // Delete uploaded file with animation
  const handleDeleteFile = async (file: AudioFile) => {
    setDeletingFileId(file._id);

    try {
      await fileApi.deleteFile(file.fileId, identifier, identifierType);

      setTimeout(() => {
        const updatedFiles = audioFiles.filter(f => f._id !== file._id);
        setAudioFiles(updatedFiles);
        setDeletingFileId(null);

        if (onFilesChange) onFilesChange(updatedFiles);
        if (onUploadComplete) onUploadComplete();
      }, 300);
    } catch (err: any) {
      setError(err.error || 'Delete failed');
      setDeletingFileId(null);
      console.error('Delete error:', err);
    }
  };

  // NEW: Handle removing pending file in staging mode
  const handleRemovePendingFile = (index: number) => {
    if (stagingMode && onFileRemoved) {
      onFileRemoved(index);
    } else {
      setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    }
  };

  // Get the appropriate pending files list
  const displayPendingFiles = stagingMode ? pendingFiles : selectedFiles;

  return (
    <div className={`transition-all ${audioFiles.length > 0 && !isCollapsed ? 'animate-pulse-once' : ''}`}>
      {/* Clean Header */}
      <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
        <div
          className="flex justify-between items-center cursor-pointer group"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <h4 className="flex items-center gap-3">
            <div className="relative">
              <Music className={`w-5 h-5 transition-all duration-500 ${audioFiles.length > 0 ? 'text-blue-500 rotate-12 scale-110' : 'text-gray-400'}`} />
              {audioFiles.length > 0 && (
                <span className="absolute -top-2 -right-2 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                </span>
              )}
            </div>
            <span className="font-bold tracking-tight text-gray-800 dark:text-white">Audio Files</span>

            {/* Completed Files Badge */}
            {audioFiles.length > 0 && (
              <span className="transition-all animate-in zoom-in duration-300 bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
                {audioFiles.length}
              </span>
            )}

            {/* Pending Files Badge with Pulse */}
            {displayPendingFiles.length > 0 && (
              <span className="relative flex h-fit">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {displayPendingFiles.length} pending
                </span>
              </span>
            )}
          </h4>
          {isCollapsed ? (
            <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          ) : (
            <ChevronUp className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          )}
        </div>

        {/* Content */}
        <div className={`space-y-3 transition-all duration-300 ease-in-out ${isCollapsed ? 'max-h-0 opacity-0 overflow-hidden' : 'pt-3 max-h-[2000px] opacity-100'
          }`}>
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-3 py-2 rounded-lg text-xs">
              {error}
            </div>
          )}

          {/* Recording/Upload Section */}
          {canUploadFiles && (
            <>
              {/* Quick Action Buttons */}
              {!isRecorderOpen && !showUploadMode && (
                <div className="flex gap-2">
                  {canRecordAudio ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsRecorderOpen(true);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 text-white rounded-lg transition-colors text-sm font-medium"
                    >
                      <Mic className="w-4 h-4" />
                      Record Audio
                    </button>
                  ) : (
                    <div className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 rounded-lg text-sm text-center">
                      <Mic className="w-4 h-4 inline mr-1" />
                      Recording (Super Admin & Sales Only)
                    </div>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowUploadMode(true);
                    }}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg transition-colors text-sm"
                  >
                    <Upload className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Recording Mode */}
              {isRecorderOpen && (
                <div className="relative">
                  <button
                    onClick={() => setIsRecorderOpen(false)}
                    className="absolute -top-1 -right-1 z-10 p-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-full"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  {canRecordAudio ? (
                    <AudioRecorder
                      onRecordingComplete={handleRecordingComplete}
                      onCancel={() => setIsRecorderOpen(false)}
                    />
                  ) : (
                    <div className="border rounded-lg p-4 bg-yellow-50 dark:bg-yellow-950 border-yellow-300 dark:border-yellow-800">
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        🔒 You need Super Admin or Sales role to record audio.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Upload Mode */}
              {showUploadMode && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Upload Files</span>
                    <button
                      onClick={() => {
                        setShowUploadMode(false);
                        if (!stagingMode) setSelectedFiles([]);
                      }}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>

                  {displayPendingFiles.length === 0 ? (
                    <div
                      className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${isDragging
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                        }`}
                      onDragEnter={handleDragEnter}
                      onDragLeave={handleDragLeave}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                    >
                      <Upload className="w-6 h-6 mx-auto mb-1 text-gray-400 dark:text-gray-500" />
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Drop files or</p>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white rounded text-xs"
                      >
                        Browse
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept={acceptedFormats.join(',')}
                        onChange={(e) => handleFileSelect(e.target.files)}
                        className="hidden"
                      />
                    </div>
                  ) : (
                    <div className="space-y-1 border p-2 rounded-lg bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
                      <p className="text-xs font-semibold text-orange-700 dark:text-orange-400 mb-1">
                        Files Ready {stagingMode ? 'for Save All' : 'to Upload'}:
                      </p>
                      {displayPendingFiles.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between p-1 bg-white dark:bg-gray-800 rounded text-xs">
                          <span className="truncate flex-1 text-gray-700 dark:text-gray-300">{file.name}</span>
                          <button
                            onClick={() => handleRemovePendingFile(idx)}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded ml-1"
                          >
                            <X className="w-3 h-3 text-red-500" />
                          </button>
                        </div>
                      ))}
                      {stagingMode ? (
                        <p className="text-xs text-orange-700 dark:text-orange-400 mt-2 flex items-center gap-1">
                          <Save className="w-3 h-3" />
                          These files will be uploaded when you click Save All.
                        </p>
                      ) : (
                        <button
                          onClick={() => handleUpload()}
                          disabled={isUploading}
                          className="w-full px-3 py-1 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 text-white rounded text-xs disabled:bg-gray-400 dark:disabled:bg-gray-600 mt-1"
                        >
                          {isUploading ? 'Uploading...' : `Upload ${displayPendingFiles.length}`}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Audio Files List */}
          {audioFiles.length > 0 ? (
            <div className="space-y-2">
              <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300">Uploaded Audio Files</h5>
              {audioFiles.map((file) => (
                <div
                  key={file._id}
                  className={`transition-all duration-300 ${deletingFileId === file._id
                    ? 'opacity-0 scale-95 -translate-x-4'
                    : 'opacity-100 scale-100'
                    }`}
                >
                  <AudioPlayer
                    file={file}
                    onDelete={canUploadFiles ? handleDeleteFile : undefined}
                  />
                </div>
              ))}
            </div>
          ) : (
            !editMode && (
              <p className="text-center text-gray-400 dark:text-gray-500 py-4 text-xs">
                No audio files
              </p>
            )
          )}
        </div>
      </div>
    </div >
  );
};

export default AudioManager;