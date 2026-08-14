// app/orders/components/cards/ProductDetailsCard.tsx
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ChevronDown, ChevronUp, File } from 'lucide-react';
import { renderMarkdownText } from '@/components/markdownRenderer';
import AudioManager from '@/components/AudioManager';
import { RichTextarea } from '@/components/RichTextarea';
import { ProductDetailsCardProps } from './cardTypes';
import { TRANSPORT_PROVIDER_LABELS, MEASUREMENT_KATA_LABELS, CustomerPaymentStatus } from '../../types';
import { FileUploadZone } from '../FileUploadZone';
import { PermissionGate } from '@/components/PermissionGate';

const EMPTY_AUDIO_FILES: File[] = [];

const PAYMENT_LABELS: Record<string, string> = {
  [CustomerPaymentStatus.CREDIT_NOTE]: 'Credit Note',
  [CustomerPaymentStatus.NEW_PAID]: 'New - Paid',
  [CustomerPaymentStatus.NEW_UNPAID]: 'New - Unpaid',
};

const ProductDetailsCard: React.FC<ProductDetailsCardProps> = ({
  isEditMode, currentUserProfile, products, deoNo,
  productVoiceNoteDriveIds, productDriveIds,
  pendingProductAudioFiles, pendingProductFiles,
  isProductSectionOpen, onProductSectionToggle, onTextChange,
  onProductFileAdd, onProductFileRemove,
  onProductAudioStaged, onProductAudioRemoved,
  onDeleteUploadedFile, onUploadComplete,
  transportProvider, transportProviderName,
  measurementKata, customerPaymentStatus,
  canEditProducts,
  canEditProductFiles,
}) => {
  const pendingAudioFiles = isEditMode ? pendingProductAudioFiles : EMPTY_AUDIO_FILES;

  const transportDisplay = transportProvider
    ? TRANSPORT_PROVIDER_LABELS[transportProvider] ||
      (transportProvider === 'porter' ? 'Porter' : String(transportProvider))
    : '—';
  const transportLabel = transportProvider === 'own' && transportProviderName
    ? `${transportDisplay} - ${transportProviderName}`
    : transportDisplay;
  const kataLabel = measurementKata ? MEASUREMENT_KATA_LABELS[measurementKata] : '—';
  const paymentLabel = customerPaymentStatus
    ? PAYMENT_LABELS[customerPaymentStatus] || customerPaymentStatus
    : '—';

  return (
    <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 space-y-4">
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 border-b pb-2">
        Product Details
      </h3>

      {/* Products description — permission gated */}
      <PermissionGate module="orders" field="products">
        <div className="space-y-2">
          <Label htmlFor="products" className="font-medium">Description:</Label>
          {isEditMode && canEditProducts ? (
            <RichTextarea
              id="products"
              value={products || ''}
              onChange={onTextChange}
              rows={4}
              className="w-full"
              placeholder="Enter product details..."
            />
          ) : (
            (() => {
              const paymentColorClass =
                customerPaymentStatus === 'new-unpaid'
                  ? 'text-red-600 dark:text-red-400'
                  : customerPaymentStatus === 'new-paid'
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-blue-700 dark:text-blue-300';
              const footer =
                (transportLabel && `*Transit Provider*: ${transportLabel}`) ||
                (kataLabel && `*Kata*: ${kataLabel}`) ||
                (paymentLabel && `*Payment*: ${paymentLabel}`)
                  ? `\n\n*Transit Provider*: ${transportLabel}\n*Kata*: ${kataLabel}\n*Payment*: ${paymentLabel}`
                  : '';
              const combined = products ? `${products}\n${footer}` : `N/A\n${footer}`;
              return (
                <div
                  className={`text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap p-2 border rounded-md min-h-[120px] markdown-body ${paymentColorClass}`}
                  dangerouslySetInnerHTML={{ __html: renderMarkdownText(combined) }}
                />
              );
            })()
          )}
        </div>
      </PermissionGate>

      {/* Audio Manager */}
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

      {/* Product Files Section — permission gated */}
      <PermissionGate module="orders" section="product-files">
        <div>
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
            <FileUploadZone
              stage="product"
              sectionId="product-files"
              accept=".jpg,.jpeg,.png,.pdf,.webp,.ogg"
              isEditMode={isEditMode}
              canEdit={canEditProductFiles}
              pendingFiles={pendingProductFiles}
              uploadedFiles={productDriveIds}
              onFileAdd={onProductFileAdd}
              onFileRemove={onProductFileRemove}
              onDeleteUploadedFile={(fileId) => onDeleteUploadedFile(fileId, 'product')}
            />
          </div>
        </div>
      </PermissionGate>
    </div>
  );
};

export default React.memo(ProductDetailsCard);
