// app/orders/components/cards/DeliveryVehicleCard.tsx
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Truck, Gauge, Building, ChevronDown, ChevronUp,
} from 'lucide-react';
import { renderMarkdownText } from '@/components/markdownRenderer';
import { TRANSPORT_PROVIDER_LABELS, MEASUREMENT_KATA_LABELS, TransportProvider } from '../../types';
import { RichTextarea } from '@/components/RichTextarea';
import { DeliveryVehicleCardProps } from './cardTypes';
import { FileUploadZone } from '../FileUploadZone';
import { PermissionGate } from '@/components/PermissionGate';

const DeliveryVehicleCard: React.FC<DeliveryVehicleCardProps> = ({
  isEditMode, role, isOperationsRole, canEditSite,
  measurementKata, transportProvider, transportProviderName, vehicleNo, siteDeliveryInfo,
  isVehicleSectionOpen, onVehicleSectionToggle, onTextChange,
  onWeightScaleChange, onTransportProviderChange,
  vehicleDriveIds, pendingVehicleFiles, mergePreviewVehicle,
  onVehicleFileAdd, onVehicleFileRemove, onDeleteUploadedFile,
  canEditMeasurementKata,
  canEditTransportProvider,
  canEditVehicleNo,
  canEditSiteInfo,
  canEditVehicleFiles,
}) => {
  const isPoter = transportProvider === 'porter' || (transportProvider as string) === 'porter';
  const cardTone = isPoter
    ? 'bg-violet-100 dark:bg-violet-900/30 border-l-[10px] border-violet-600 dark:border-violet-500'
    : 'bg-teal-100 dark:bg-teal-900/30 border-l-[10px] border-teal-600 dark:border-teal-500';
  const iconTone = isPoter
    ? 'text-violet-600 dark:text-violet-400'
    : 'text-teal-600 dark:text-teal-400';

  return (
    <div className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 space-y-3">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-3 border-b-2 border-blue-500/50 pb-2">
        <Truck className="w-7 h-7 text-blue-600 dark:text-blue-500" />
        Delivery & Vehicle Operations
      </h3>

      {/* Highlighted Key Operational Fields: Weight Scale & Transport Provider */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Measurement Kata - Premium Sub-card */}
        <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-lg shadow-lg border border-l-[10px] border-blue-600 dark:border-blue-500 flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-2">
            <Gauge className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <Label htmlFor="measurementKata" className="font-semibold text-gray-800 dark:text-gray-100 text-sm">Measurement Kata</Label>
          </div>
          {isEditMode && canEditMeasurementKata ? (
            <Select onValueChange={onWeightScaleChange} value={measurementKata || ''}>
              <SelectTrigger className="w-full h-9 bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm">
                <SelectValue placeholder="Select Type" />
              </SelectTrigger>
              <SelectContent className="z-[9050]">
                <SelectItem value="prince">Prince Kata</SelectItem>
                <SelectItem value="factory">Factory Kata</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <div className="text-lg font-bold text-rose-800 dark:text-rose-200">
              {measurementKata ? MEASUREMENT_KATA_LABELS[measurementKata] : 'N/A'}
            </div>
          )}
        </div>

        {/* Transport Provider - Premium Sub-card */}
        <div className={`${cardTone} p-4 rounded-lg shadow-lg flex flex-col justify-between`}>
          <div className="flex items-center gap-2 mb-2">
            <Building className={`w-5 h-5 ${iconTone}`} />
            <Label htmlFor="transportProvider" className="font-semibold text-gray-800 dark:text-gray-100 text-sm">Transport Provider</Label>
          </div>
          {isEditMode && canEditTransportProvider ? (
            <>
              <Select onValueChange={onTransportProviderChange} value={transportProvider || ''}>
                <SelectTrigger className="w-full h-9 bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm">
                  <SelectValue placeholder="Select Provider" />
                </SelectTrigger>
                <SelectContent className="z-[9050]">
                  <SelectItem value="client">Client Transport</SelectItem>
                  <SelectItem value="own">Own Transport</SelectItem>
                  <SelectItem value="porter">Porter</SelectItem>
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
        {/* Vehicle No — permission gated */}
        <PermissionGate module="orders" field="vehicle-no">
          <div className="space-y-1">
            <Label htmlFor="vehicleNo" className="font-semibold text-gray-800 dark:text-gray-200 text-sm">Vehicle No.</Label>
            {isEditMode && canEditVehicleNo ? (
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
        </PermissionGate>

        {/* Site Delivery Info — permission gated */}
        <PermissionGate module="orders" field="site-info">
          {!isOperationsRole && (
            <div className="space-y-1">
              <Label htmlFor="siteDeliveryInfo" className="font-semibold text-gray-800 dark:text-gray-200 text-sm">Site Info</Label>
              {isEditMode && (canEditTransportProvider || canEditSiteInfo) ? (
                <RichTextarea
                  id="siteDeliveryInfo"
                  value={siteDeliveryInfo || ''}
                  onChange={onTextChange}
                  rows={2}
                  className="w-full bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm"
                  placeholder="Site-specific delivery instructions or information..."
                />
              ) : (
                <div className="prose prose-xs dark:prose-invert max-w-none text-gray-800 dark:text-gray-200 pt-1">
                  {siteDeliveryInfo ? (
                    <div dangerouslySetInnerHTML={{ __html: renderMarkdownText(siteDeliveryInfo) }} />
                  ) : (
                    <p className="italic text-gray-500">N/A</p>
                  )}
                </div>
              )}
            </div>
          )}
        </PermissionGate>
      </div>

      {/* Vehicle Files Section — permission gated */}
      <PermissionGate module="orders" section="vehicle-files">
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center cursor-pointer" onClick={onVehicleSectionToggle}>
            <h4 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2 text-sm">
              <Truck className="w-5 h-5 text-gray-500 dark:text-gray-400" /> Delivery Attachments
              {pendingVehicleFiles.length > 0 && (
                <span className="text-xs text-orange-600 dark:text-orange-400">{pendingVehicleFiles.length} pending</span>
              )}
            </h4>
            {isVehicleSectionOpen ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
          </div>

          <div className={`pt-3 transition-all duration-300 ease-in-out ${isVehicleSectionOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
            <FileUploadZone
              stage="vehicle"
              sectionId="vehicle-files"
              accept=".jpg,.jpeg,.png,.pdf,.webp"
              isEditMode={isEditMode}
              canEdit={canEditVehicleFiles}
              pendingFiles={pendingVehicleFiles}
              mergePreview={mergePreviewVehicle}
              uploadedFiles={vehicleDriveIds}
              onFileAdd={onVehicleFileAdd}
              onFileRemove={onVehicleFileRemove}
              onDeleteUploadedFile={(fileId) => onDeleteUploadedFile(fileId, 'vehicle')}
            />
          </div>
        </div>
      </PermissionGate>
    </div>
  );
};

export default React.memo(DeliveryVehicleCard);
