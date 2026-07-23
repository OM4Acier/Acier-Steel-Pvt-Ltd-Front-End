// app/orders/components/cards/InvoiceDetailsCard.tsx
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DollarSign, Upload, X, ChevronDown, ChevronUp, Eye, Trash2, Calendar, File } from 'lucide-react';
import { renderMarkdownText } from '@/components/markdownRenderer';
import { handleDragOver, handleDragLeave, handleDrop } from '../../fileUtils';
import {
  canEditInvoiceDetailsField, canEditInvoiceNumberField, canEditInvoiceIssueDateField,
  canEditAccountantSpecificFields,
} from '../../permissions';
import AudioManager from '@/components/AudioManager';
import { RichTextarea } from '@/components/RichTextarea';
import { InvoiceDetailsCardProps } from './cardTypes';

// Formats a Date/timestamp to a local `YYYY-MM-DD` string (avoids UTC off-by-one near midnight).
// Date formatting utility - removed as it was unused and causing linting issues

// Stable empty-array reference so AudioManager's memoized `pendingFiles` prop
// identity doesn't change on every render while the card isn't in edit mode.
const EMPTY_AUDIO_FILES: File[] = [];

const InvoiceDetailsCard: React.FC<InvoiceDetailsCardProps> = ({
  isEditMode, role, status, deoNo, currentUserProfile,
  invoiceDetails, invoiceNo, invoiceIssueDate,
  invoiceVoiceNoteDriveIds, invoiceDriveId,
  pendingInvoiceAudioFiles, pendingInvoiceFiles,
  isInvoiceSectionOpen, onInvoiceSectionToggle, onTextChange,
  onInvoiceFileAdd, onInvoiceFileRemove,
  onInvoiceAudioStaged, onInvoiceAudioRemoved,
  onDeleteUploadedFile, onUploadComplete,
}) => {
  const pendingAudioFiles = isEditMode ? pendingInvoiceAudioFiles : EMPTY_AUDIO_FILES;

  return (
    <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 space-y-4">
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 border-b pb-2">
        Invoice Details
      </h3>

      <div className="space-y-2">
        <Label htmlFor="invoiceDetails" className="font-medium">Invoice Notes:</Label>
        {isEditMode && canEditInvoiceDetailsField(role, status) ? (
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

      {/* Invoice No. + Invoice Issue Date — side by side on desktop, stacked on mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t dark:border-gray-700">
        <div className="space-y-2">
          <Label htmlFor="invoiceNo" className="font-medium">Invoice No.:</Label>
          {isEditMode && canEditInvoiceNumberField(role, status) ? (
                      <Input
                        id="invoiceNo"
                        value={invoiceNo || ''}
                        onChange={onTextChange}
                        type="text"
                        className="w-full h-9"
                      />
                    ) : (
                      <span className="text-sm text-gray-800 dark:text-gray-200 p-2 border rounded-md block h-9 flex items-center">
                        {invoiceNo || 'N/A'}
                      </span>
                    )}
        </div>

        {/* Invoice Issue Date */}
        <div className="space-y-2">
          <Label htmlFor="invoiceIssueDate" className="font-medium flex items-center gap-1">
            <Calendar className="w-4 h-4 text-gray-500" /> Invoice Issue Date:
          </Label>
          {isEditMode && canEditInvoiceIssueDateField(role, status) ? (
             <input
               id="invoiceIssueDate"
               type="date"
               value={invoiceIssueDate ?? ''}
               onChange={onTextChange}
               className="w-full h-9 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
             />
          ) : (
            <span className="text-sm text-gray-800 dark:text-gray-200 p-2 border rounded-md block h-9 flex items-center">
              {invoiceIssueDate ? invoiceIssueDate.split('T')[0] : 'N/A'}
            </span>
          )}
        </div>
      </div>

      {/* Invoice Files Section */}
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
        {isEditMode && canEditAccountantSpecificFields(role, status) && (
          <>
            <div
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center text-gray-500 dark:text-gray-400 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, onInvoiceFileAdd)}
            >
              <Input
                id="invoice-files"
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.pdf,.webp"
                onChange={(e) => onInvoiceFileAdd(Array.from(e.target.files || []))}
                className="hidden"
              />
              <Label htmlFor="invoice-files" className="cursor-pointer flex flex-col items-center">
                <Upload className="w-8 h-8 mb-2" />
                Drag & drop or <span className="text-blue-600">browse</span>
              </Label>
            </div>

            {pendingInvoiceFiles.length > 0 && (
              <div className="space-y-2 border p-3 rounded-md bg-orange-50 dark:bg-orange-950">
                <h5 className="font-semibold text-gray-800 dark:text-gray-200">Ready to Upload:</h5>
                <ul className="space-y-2">
                  {pendingInvoiceFiles.map((file, index) => (
                    <li key={index} className="flex items-center justify-between bg-white dark:bg-gray-700 p-2 rounded-md">
                      <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{file.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onInvoiceFileRemove(index)}
                        className="text-red-500 h-8 w-8 p-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-orange-600 dark:text-orange-400">Click &quotSave All&quot to upload these files</p>
              </div>
            )}
          </>
        )}

        {/* Uploaded Files */}
        {invoiceDriveId && invoiceDriveId.length > 0 ? (
          <div className="mt-4 space-y-2">
            <h5 className="font-semibold text-gray-800 dark:text-gray-200">Uploaded Files:</h5>
            <div className="grid grid-cols-1 gap-3">
              {invoiceDriveId.map((file) => (
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
                    {isEditMode && canEditAccountantSpecificFields(role, status) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDeleteUploadedFile(file.fileId, 'invoice')}
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
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">No invoice files uploaded.</p>
        )}
      </div>
    </div>
  );
};

export default React.memo(InvoiceDetailsCard);
