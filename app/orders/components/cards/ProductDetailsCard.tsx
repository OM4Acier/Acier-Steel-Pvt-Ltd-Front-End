// app/orders/components/cards/ProductDetailsCard.tsx
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { File, Upload, X, ChevronDown, ChevronUp, Eye, Trash2 } from 'lucide-react';
import { renderMarkdownText } from '@/components/markdownRenderer';
import { handleDragOver, handleDragLeave, handleDrop } from '../../fileUtils';
import { canEditSalesSpecificFields } from '../../permissions';
import AudioManager from '@/components/AudioManager';
import { RichTextarea } from '@/components/RichTextarea';
import { ProductDetailsCardProps } from './cardTypes';

// Stable empty-array reference so AudioManager's memoized `pendingFiles` prop
// identity doesn't change on every render while the card isn't in edit mode.
const EMPTY_AUDIO_FILES: File[] = [];

const ProductDetailsCard: React.FC<ProductDetailsCardProps> = ({
  isEditMode, role, currentUserProfile, products, deoNo,
  productVoiceNoteDriveIds, productDriveIds,
  pendingProductAudioFiles, pendingProductFiles,
  isProductSectionOpen, onProductSectionToggle, onTextChange,
  onProductFileAdd, onProductFileRemove,
  onProductAudioStaged, onProductAudioRemoved,
  onDeleteUploadedFile, onUploadComplete,
}) => {
  const pendingAudioFiles = isEditMode ? pendingProductAudioFiles : EMPTY_AUDIO_FILES;

  return (
    <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 space-y-4">
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 border-b pb-2">
        Product Details
      </h3>

      <div className="space-y-2">
        <Label htmlFor="products" className="font-medium">Description:</Label>
        {isEditMode && canEditSalesSpecificFields(role) ? (
          <RichTextarea
            id="products"
            value={products || ''}
            onChange={onTextChange}
            rows={4}
            className="w-full"
            placeholder="Enter product details..."
          />
        ) : (
          <div
            className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap p-2 border rounded-md min-h-[120px]"
            dangerouslySetInnerHTML={{ __html: renderMarkdownText(products || 'N/A') }}
          />
        )}
      </div>

      {/* Audio Manager Component */}
      <AudioManager
        currentUser={currentUserProfile}
        identifier={deoNo}
        identifierType="order"
        uploadStage="productVoiceNote"
        initialFiles={productVoiceNoteDriveIds || []}
        onUploadComplete={onUploadComplete}
        editMode={isEditMode}
        maxFiles={10}
        acceptedFormats={['audio/webm', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a']}
        stagingMode={isEditMode}
        pendingFiles={pendingAudioFiles}
        onFilesStaged={onProductAudioStaged}
        onFileRemoved={onProductAudioRemoved}
      />

      {/* Product Files Section */}
      <div
        className="flex justify-between items-center cursor-pointer mb-2 border-t pt-4"
        onClick={onProductSectionToggle}
      >
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <File className="w-5 h-5" /> Product Files
          {pendingProductFiles.length > 0 && (
            <Badge className="bg-orange-500 text-white text-xs">{pendingProductFiles.length} pending</Badge>
          )}
        </h4>
        {isProductSectionOpen ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
      </div>
      <div className={`space-y-4 transition-all duration-300 ${isProductSectionOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
        {isEditMode && canEditSalesSpecificFields(role) && (
          <>
            <div
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center text-gray-500 dark:text-gray-400 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, onProductFileAdd)}
            >
              <Input
                id="product-files"
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.pdf,.webp,.ogg"
                onChange={(e) => onProductFileAdd(Array.from(e.target.files || []))}
                className="hidden"
              />
              <Label htmlFor="product-files" className="cursor-pointer flex flex-col items-center">
                <Upload className="w-8 h-8 mb-2" />
                Drag & drop or <span className="text-blue-600">browse</span>
              </Label>
            </div>

            {pendingProductFiles.length > 0 && (
              <div className="space-y-2 border p-3 rounded-md bg-orange-50 dark:bg-orange-950">
                <h5 className="font-semibold text-gray-800 dark:text-gray-200">Ready to Upload:</h5>
                <ul className="space-y-2">
                  {pendingProductFiles.map((file, index) => (
                    <li key={index} className="flex items-center justify-between bg-white dark:bg-gray-700 p-2 rounded-md">
                      <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{file.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onProductFileRemove(index)}
                        className="text-red-500 h-8 w-8 p-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-orange-600 dark:text-orange-400">Click &quot Save All &quot to upload these files</p>
              </div>
            )}
          </>
        )}

        {/* Uploaded Files */}
        {productDriveIds && productDriveIds.length > 0 ? (
          <div className="mt-4 space-y-2">
            <h5 className="font-semibold text-gray-800 dark:text-gray-200">Uploaded Files:</h5>
            <div className="grid grid-cols-1 gap-3">
              {productDriveIds.map((file) => (
                <div key={file.fileId} className="flex items-center justify-between bg-green-50 dark:bg-green-950 p-2 rounded-md">
                  <span className="text-sm font-medium text-green-800 dark:text-green-200 truncate">{file.filename}</span>
                  <div className="flex items-center gap-2">
                    <a
                      href={`https://drive.google.com/file/d/${file.fileId}/preview`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 h-8 w-8 p-0 flex items-center justify-center"
                    >
                      <Eye className="w-5 h-5" />
                    </a>
                    {isEditMode && canEditSalesSpecificFields(role) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDeleteUploadedFile(file.fileId, 'product')}
                        className="text-red-500 h-8 w-8 p-0"
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
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">No product files uploaded.</p>
        )}
      </div>
    </div>
  );
};

export default React.memo(ProductDetailsCard);
