// app/orders/components/cards/cardTypes.ts
import React from 'react';
import { OrderStatus, CustomerPaymentStatus, TransportProvider, WeightScaleType } from '../../types';
import { UserRole, UserProfile } from '@/types/rbac.types';

// Generic text-input change handler (id-driven, same contract as handleTextChange)
export type TextChangeHandler = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;

export interface ClientStatusCardProps {
  isEditMode: boolean;
  role: UserRole | null;
  status: OrderStatus | undefined;
  customerPaymentStatus: CustomerPaymentStatus | undefined;
  client: string;
  contactNo: string;
  organizationContact: string;
  partDelivery: boolean;
  isHighPriority: boolean;
  orderDate: string | undefined;
  isAdditionalInfoOpen: boolean;
  onAdditionalInfoToggle: () => void;
  onTextChange: TextChangeHandler;
  onPaymentStatusChange: (value: string) => void;
  onPartDeliveryChange: (checked: boolean) => void;
  onHighPriorityChange: (checked: boolean) => void;
  onStatusSelectChange: (value: string) => void;
}

export interface DeliveryVehicleCardProps {
  isEditMode: boolean;
  role: UserRole | null;
  isOperationsRole: boolean;
  canEditSite: boolean;
  weightScaleType?: WeightScaleType;
  transportProvider?: TransportProvider;
  transportProviderName?: string;
  vehicleNo?: string;
  siteDeliveryInfo?: string;
  isVehicleSectionOpen: boolean;
  onVehicleSectionToggle: () => void;
  onTextChange: TextChangeHandler;
  onWeightScaleChange: (value: string) => void;
  onTransportProviderChange: (value: string) => void;
  vehicleDriveIds: { fileId: string; filename: string; fileName?: string; _id?: string }[];
  pendingVehicleFiles: File[];
  mergePreviewVehicle?: { fileCount: number; totalSize: number };
  onVehicleFileAdd: (files: File[]) => void;
  onVehicleFileRemove: (index: number) => void;
  onDeleteUploadedFile: (fileId: string, stage: 'vehicle') => void;
  isSaving: boolean;
}

export interface ProductDetailsCardProps {
  isEditMode: boolean;
  role: UserRole | null;
  currentUserProfile: UserProfile | null;   // required by AudioManager's `currentUser` prop
  products: string;
  deoNo: string;
  productVoiceNoteDriveIds: { fileId: string; filename: string; _id: string }[];
  productDriveIds: { fileId: string; filename: string; fileName?: string; _id?: string }[];
  pendingProductAudioFiles: File[];
  pendingProductFiles: File[];
  mergePreviewProduct?: { fileCount: number; totalSize: number };
  isProductSectionOpen: boolean;
  onProductSectionToggle: () => void;
  onTextChange: TextChangeHandler;
  onProductFileAdd: (files: File[]) => void;
  onProductFileRemove: (index: number) => void;
  onProductAudioStaged: (files: File[]) => void;
  onProductAudioRemoved: (index: number) => void;
  onDeleteUploadedFile: (fileId: string, stage: 'product') => void;
  onUploadComplete: () => void;
}

export interface InvoiceDetailsCardProps {
  isEditMode: boolean;
  role: UserRole | null;
  currentUserProfile: UserProfile | null;   // required by AudioManager's `currentUser` prop
  status: OrderStatus | undefined;
  deoNo: string;
  invoiceDetails?: string;
  invoiceNo?: string;
  invoiceIssueDate?: string;
  invoiceVoiceNoteDriveIds: { fileId: string; filename: string; _id: string }[];
  invoiceDriveId: { fileId: string; filename: string; fileName?: string; _id?: string }[];
  pendingInvoiceAudioFiles: File[];
  pendingInvoiceFiles: File[];
  isInvoiceSectionOpen: boolean;
  onInvoiceSectionToggle: () => void;
  onTextChange: TextChangeHandler;
  onInvoiceFileAdd: (files: File[]) => void;
  onInvoiceFileRemove: (index: number) => void;
  onInvoiceAudioStaged: (files: File[]) => void;
  onInvoiceAudioRemoved: (index: number) => void;
  onDeleteUploadedFile: (fileId: string, stage: 'invoice') => void;
  onUploadComplete: () => void;
}

export interface OrderActionsFooterProps {
  isEditMode: boolean;
  isSaving: boolean;
  isMarkingPaid: boolean;
  isCreatingPartDelivery: boolean;
  isMoreActionsOpen: boolean;
  role: UserRole | null;
  status: OrderStatus | undefined;
  customerPaymentStatus: CustomerPaymentStatus | undefined;
  partDelivery: boolean | undefined;
  isPaymentPending: boolean;
  hasChanges: boolean;
  pendingChangesSummary: { textFieldCount: number; fileCount: number };
  onCancelEdit: () => void;
  onSaveAll: () => void;
  onEditOrder: () => void;
  onApprove: () => void;
  onReadyForDispatch: () => void;
  onPartDelivery: () => void;
  onDispatchedInvoiced: () => void;
  onComplete: () => void;
  onMoreActionsOpenChange: (open: boolean) => void;
  onMarkAsPaid: () => void;
  onCancelOrder: () => void;
  onDeleteClick: () => void;
  deoNo: string;
  currentUserProfile: UserProfile | null;
}
