// app/orders/components/cards/InvoiceDetailsCard.tsx
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DollarSign, ChevronDown, ChevronUp, Calendar, File } from 'lucide-react';
import { renderMarkdownText } from '@/components/markdownRenderer';
import AudioManager from '@/components/AudioManager';
import { RichTextarea } from '@/components/RichTextarea';
import { InvoiceDetailsCardProps } from './cardTypes';
import { FileUploadZone } from '../FileUploadZone';
import { PermissionGate } from '@/components/PermissionGate';

const EMPTY_AUDIO_FILES: File[] = [];

const InvoiceDetailsCard: React.FC<InvoiceDetailsCardProps> = ({
  isEditMode, deoNo, currentUserProfile,
  invoiceDetails, invoiceNo, invoiceIssueDate,
  invoiceVoiceNoteDriveIds, invoiceDriveId,
  pendingInvoiceAudioFiles, pendingInvoiceFiles,
  isInvoiceSectionOpen, onInvoiceSectionToggle, onTextChange,
  onInvoiceFileAdd, onInvoiceFileRemove,
  onInvoiceAudioStaged, onInvoiceAudioRemoved,
  onDeleteUploadedFile, onUploadComplete,
  canEditInvoiceDetails,
  canEditInvoiceNo,
  canEditInvoiceIssueDate,
  canEditInvoiceFiles,
}) => {
  const pendingAudioFiles = isEditMode ? pendingInvoiceAudioFiles : EMPTY_AUDIO_FILES;

  return (
    <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 space-y-4">
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 border-b pb-2">
        Invoice Details
      </h3>

      {/* Invoice Notes — permission gated */}
      <PermissionGate module="orders" field="invoice-details">
        <div className="space-y-2">
          <Label htmlFor="invoiceDetails" className="font-medium">Invoice Notes:</Label>
          {isEditMode && canEditInvoiceDetails ? (
            <RichTextarea
              id="invoiceDetails"
              value={invoiceDetails || ''}
              onChange={onTextChange}
              rows={3}
              className="w-full"
              placeholder="Enter invoice notes..."
              enableAutocomplete={true}
            />
          ) : (
            <div
              className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap p-2 border rounded-md min-h-[60px]"
              dangerouslySetInnerHTML={{ __html: renderMarkdownText(invoiceDetails || 'N/A') }}
            />
          )}
        </div>
      </PermissionGate>

      {/* Invoice No. + Invoice Issue Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t dark:border-gray-700">
        {/* Invoice No. — permission gated */}
        <PermissionGate module="orders" field="invoice-no">
          <div className="space-y-2">
            <Label htmlFor="invoiceNo" className="font-medium">Invoice No.:</Label>
            {isEditMode && canEditInvoiceNo ? (
              <Input
                id="invoiceNo"
                value={invoiceNo || ''}
                onChange={onTextChange}
                type="text"
                className="w-full h-9 bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm"
              />
            ) : (
              <span className="text-sm text-gray-800 dark:text-gray-200 p-2 border rounded-md block h-9 flex items-center">
                {invoiceNo || 'N/A'}
              </span>
            )}
          </div>
        </PermissionGate>

        {/* Invoice Issue Date — permission gated */}
        <PermissionGate module="orders" field="invoice-issue-date">
          <div className="space-y-2">
            <Label htmlFor="invoiceIssueDate" className="font-medium flex items-center gap-1">
              <Calendar className="w-4 h-4 text-gray-500" /> Invoice Issue Date:
            </Label>
            {isEditMode && canEditInvoiceIssueDate ? (
              <Input
                id="invoiceIssueDate"
                type="date"
                value={invoiceIssueDate ?? ''}
                onChange={onTextChange}
                className="w-full h-9 bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm"
              />
            ) : (
              <span className="text-sm text-gray-800 dark:text-gray-200 p-2 border rounded-md block h-9 flex items-center">
                {invoiceIssueDate ? invoiceIssueDate.split('T')[0] : 'N/A'}
              </span>
            )}
          </div>
        </PermissionGate>
      </div>

      {/* Audio Manager */}
      <AudioManager
        currentUser={currentUserProfile}
        identifier={deoNo}
        identifierType="order"
        uploadStage="invoiceVoiceNote"
        initialFiles={invoiceVoiceNoteDriveIds || []}
        onUploadComplete={onUploadComplete}
        editMode={isEditMode}
        maxFiles={10}
        acceptedFormats={['audio/webm', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a']}
        stagingMode={isEditMode}
        pendingFiles={pendingAudioFiles}
        onFilesStaged={onInvoiceAudioStaged}
        onFileRemoved={onInvoiceAudioRemoved}
      />

      {/* Invoice Files Section — permission gated */}
      <PermissionGate module="orders" section="invoice-files">
        <div>
          <div
            className="flex justify-between items-center cursor-pointer mb-2 border-t pt-4"
            onClick={onInvoiceSectionToggle}
          >
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5" /> Invoice Files
              {pendingInvoiceFiles.length > 0 && (
                <Badge className="bg-orange-500 text-white text-xs">{pendingInvoiceFiles.length} pending</Badge>
              )}
            </h4>
            {isInvoiceSectionOpen ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
          </div>
          <div className={`space-y-4 transition-all duration-300 ${isInvoiceSectionOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
            <FileUploadZone
              stage="invoice"
              sectionId="invoice-files"
              accept=".jpg,.jpeg,.png,.pdf,.webp"
              isEditMode={isEditMode}
              canEdit={canEditInvoiceFiles}
              pendingFiles={pendingInvoiceFiles}
              uploadedFiles={invoiceDriveId}
              onFileAdd={onInvoiceFileAdd}
              onFileRemove={onInvoiceFileRemove}
              onDeleteUploadedFile={(fileId) => onDeleteUploadedFile(fileId, 'invoice')}
            />
          </div>
        </div>
      </PermissionGate>
    </div>
  );
};

export default React.memo(InvoiceDetailsCard);
