// app/orders/components/cards/DeliveryVehicleCard.tsx
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  Truck, Gauge, Building, Upload, X, ChevronDown, ChevronUp, Eye, Trash2,
} from 'lucide-react';
import { renderMarkdownText } from '@/components/markdownRenderer';
import { handleDragOver, handleDragLeave, handleDrop } from '../../fileUtils';
import { formatFileSize } from '@/lib/utils/pdfMergeUtils';
import {
  canEditOperationsSpecificFields, canEditVehicleNoField,
} from '../../permissions';
import { TRANSPORT_PROVIDER_LABELS } from '../../types';
import { RichTextarea } from '@/components/RichTextarea';
import { TransportProvider } from '../../types';
import { DeliveryVehicleCardProps } from './cardTypes';

const DeliveryVehicleCard: React.FC<DeliveryVehicleCardProps> = ({
  isEditMode, role, isOperationsRole, canEditSite,
  weightScaleType, transportProvider, transportProviderName, vehicleNo, siteDeliveryInfo,
  isVehicleSectionOpen, onVehicleSectionToggle, onTextChange,
  onWeightScaleChange, onTransportProviderChange,
  vehicleDriveIds, pendingVehicleFiles, mergePreviewVehicle,
  onVehicleFileAdd, onVehicleFileRemove, onDeleteUploadedFile,
  }: DeliveryVehicleCardProps) => {
  const isPoter = transportProvider === 'poter';
  const cardTone = isPoter
    ? 'bg-violet-100 dark:bg-violet-900/30 border-l-[10px] border-violet-600 dark:border-violet-500'
    : 'bg-teal-100 dark:bg-teal-900/30 border-l-[10px] border-teal-600 dark:border-teal-500';
  const iconTone = isPoter
    ? 'text-violet-600 dark:text-violet-400'
    : 'text-teal-600 dark:text-teal-400';

  return (
    <div className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 space-y-3">

      {/* Card Header */}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-3 border-b-2 border-blue-500/50 pb-2">
        <Truck className="w-7 h-7 text-blue-600 dark:text-blue-500" />
        Delivery & Vehicle Operations
      </h3>

      {/* Highlighted Key Operational Fields: Weight Scale & Transport Provider */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Weight Scale - Premium Sub-card */}
        <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-lg shadow-lg border border-l-[10px] border-blue-600 dark:border-blue-500 flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-2">
            <Gauge className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <Label htmlFor="weightScaleType" className="font-semibold text-gray-800 dark:text-gray-100 text-sm">Weight Scale</Label>
          </div>
          {isEditMode && canEditOperationsSpecificFields(role) ? (
            <Select
              onValueChange={onWeightScaleChange}
              value={weightScaleType || ''}
            >
              <SelectTrigger className="w-full h-9 bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm">
                <SelectValue placeholder="Select Type" />
              </SelectTrigger>
              <SelectContent className="z-[9050]">
                <SelectItem value="outside">Outside</SelectItem>
                <SelectItem value="inside">Inside</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <div className="text-lg font-bold text-rose-800 dark:text-rose-200">
              {weightScaleType ? weightScaleType.charAt(0).toUpperCase() + weightScaleType.slice(1) : 'N/A'}
            </div>
          )}
        </div>

        {/* Transport Provider - Premium Sub-card */}
        <div className={`${cardTone} p-4 rounded-lg shadow-lg flex flex-col justify-between`}>
          <div className="flex items-center gap-2 mb-2">
            <Building className={`w-5 h-5 ${iconTone}`} />
            <Label htmlFor="transportProvider" className="font-semibold text-gray-800 dark:text-gray-100 text-sm">Transport Provider</Label>
          </div>
          {isEditMode && canEditOperationsSpecificFields(role) ? (
            <>
              <Select
                onValueChange={onTransportProviderChange}
                value={transportProvider || ''}
              >
                <SelectTrigger className="w-full h-9 bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm">
                  <SelectValue placeholder="Select Provider" />
                </SelectTrigger>
                <SelectContent className="z-[9050]">
                  <SelectItem value="client">Client Transport</SelectItem>
                  <SelectItem value="own">Own Transport</SelectItem>
                  <SelectItem value="poter">Poter</SelectItem>
                </SelectContent>
              </Select>
              {transportProvider === 'own' && (
                <div className="space-y-1 mt-2">
                  <Label htmlFor="transportProviderName" className="font-medium text-xs text-gray-700 dark:text-gray-300">Provider Name:</Label>
                  <Input
                    id="transportProviderName"
                    value={transportProviderName || ''}
                    onChange={onTextChange}
                    placeholder="Enter provider name"
                    className="bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 h-8 text-sm"
                  />
                </div>
              )}
            </>
          ) : (
            <>
              <div className="text-base font-medium text-gray-900 dark:text-white">
                {transportProvider ? TRANSPORT_PROVIDER_LABELS[transportProvider as TransportProvider] : 'N/A'}
              </div>
              {transportProvider === 'own' && transportProviderName && (
                <div className="space-y-0.5 mt-1">
                  <Label className="font-medium text-xs text-gray-500 dark:text-gray-400">Provider Name:</Label>
                  <p className="text-base font-bold text-fuchsia-800 dark:text-fuchsia-200">
                    {transportProviderName}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Secondary Details Section (Vehicle No & Site Info) */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">

        {/* Vehicle No */}
        <div className="space-y-1">
          <Label htmlFor="vehicleNo" className="font-semibold text-gray-800 dark:text-gray-200 text-sm">Vehicle No.</Label>
          {isEditMode && canEditVehicleNoField(role) ? (
            <Input
              id="vehicleNo"
              value={vehicleNo || ''}
              onChange={onTextChange}
              className="w-full h-9 bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm"
            />
          ) : (
            <p className="text-base text-gray-900 dark:text-white font-medium">{vehicleNo || 'N/A'}</p>
          )}
        </div>

        {/* Site Delivery Info (moved to the end of primary fields) */}
        {!isOperationsRole && (
          <div className="space-y-1">
            <Label htmlFor="siteDeliveryInfo" className="font-semibold text-gray-800 dark:text-gray-200 text-sm">Site Info</Label>
            {isEditMode && (canEditOperationsSpecificFields(role) || canEditSite) ? (
              <RichTextarea
                id="siteDeliveryInfo"
                value={siteDeliveryInfo || ''}
                onChange={onTextChange}
                rows={2}
                className="w-full bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm"
                placeholder="Site-specific delivery instructions or information..."
              />
            ) : (
              <div
                className="prose prose-xs dark:prose-invert max-w-none text-gray-800 dark:text-gray-200 pt-1"
              >
                {siteDeliveryInfo ? (
                  <div dangerouslySetInnerHTML={{ __html: renderMarkdownText(siteDeliveryInfo) }} />
                ) : (
                  <p className="italic text-gray-500">N/A</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Vehicle Files Section */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <div
          className="flex justify-between items-center cursor-pointer"
          onClick={onVehicleSectionToggle}
        >
          <h4 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2 text-sm">
            <Upload className="w-5 h-5 text-gray-500 dark:text-gray-400" /> Delivery Attachments
            {pendingVehicleFiles.length > 0 && (
              <Badge className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
                {pendingVehicleFiles.length} pending
              </Badge>
            )}
            {mergePreviewVehicle && (
              <Badge className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
                {mergePreviewVehicle.fileCount} file{mergePreviewVehicle.fileCount > 1 ? 's' : ''}
                {` → 1 PDF (${formatFileSize(mergePreviewVehicle.totalSize)})`}
              </Badge>
            )}
          </h4>
          {isVehicleSectionOpen ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
        </div>

        <div className={`pt-3 space-y-4 transition-all duration-300 ease-in-out ${isVehicleSectionOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
          {isEditMode && canEditOperationsSpecificFields(role) && (
            <>
              <div
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center text-gray-500 dark:text-gray-400 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-gray-800 transition-colors cursor-pointer group"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, onVehicleFileAdd)}
              >
                <Input
                  id="vehicle-files"
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.pdf,.webp"
                  onChange={(e) => onVehicleFileAdd(Array.from(e.target.files || []))}
                  className="hidden"
                />
                <Label htmlFor="vehicle-files" className="cursor-pointer flex flex-col items-center">
                  <Upload className="w-8 h-8 mb-2 text-gray-400 group-hover:text-blue-600 transition-colors" />
                  <span className="text-base font-medium">Drag & drop files here</span>
                  <span className="text-xs">or <span className="text-blue-600 dark:text-blue-400 font-semibold">browse your computer</span></span>
                </Label>
              </div>

              {pendingVehicleFiles.length > 0 && (
                <div className="space-y-2 border p-3 rounded-lg bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
                  <h5 className="font-semibold text-gray-800 dark:text-gray-200 text-base">Files Ready to Upload:</h5>
                  <ul className="space-y-1">
                    {pendingVehicleFiles.map((file, index) => (
                      <li key={index} className="flex items-center justify-between bg-white dark:bg-gray-800 p-2 rounded-md shadow-sm">
                        <span className="text-xs text-gray-700 dark:text-gray-300 truncate font-medium">{file.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onVehicleFileRemove(index)}
                          className="text-red-500 hover:bg-red-100 dark:hover:bg-red-900 rounded-full w-6 h-6"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-orange-700 dark:text-orange-400 mt-2">These files will be uploaded when you click &quotSave All&quot.</p>
                </div>
              )}
            </>
          )}

          {/* Uploaded Files */}
          {vehicleDriveIds && vehicleDriveIds.length > 0 ? (
            <div className="mt-4 space-y-2">
              <h5 className="font-semibold text-gray-800 dark:text-gray-200 text-base">Previously Uploaded Files:</h5>
              <div className="space-y-2">
                {vehicleDriveIds.map((file) => (
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
                      {isEditMode && canEditOperationsSpecificFields(role) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDeleteUploadedFile(file.fileId, 'vehicle')}
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
              No delivery attachments have been uploaded yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(DeliveryVehicleCard);
