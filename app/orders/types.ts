// types.ts - Centralized Type Definitions

import { UserRole } from "@/types/rbac.types";

export interface FileMetadata {
  fileId: string;
  filename: string;
  fileName?: string; // Backend uses fileName
  _id?: string;
}

interface AudioFile {
  fileId: string;
  filename: string;
  _id: string;
}


export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  contactNo?: string;
  organization?: string;
  accessToken: string;
}

export type CustomerPaymentStatus = 'regular' | 'new-paid' | 'new-unpaid';
export type WeightScaleType = 'outside' | 'inside';
export type TransportProvider = 'client' | 'poter' | 'own';
export const TRANSPORT_PROVIDER_LABELS: Record<TransportProvider, string> = {
  client: 'Client Transport',
  poter: 'Poter',
  own: 'Own Transport',
};
export type OrderStatus = 
  | 'Order Created'
  | 'Approved for Production'
  | 'Ready for Dispatch'
  | 'Dispatched and Invoiced'
  | 'Completed'
  | 'Cancelled'
  | '';

export interface OrderDetails {
  siteDeliveryInfo?: string;
  weightScaleType?: WeightScaleType;
  transportProvider?: TransportProvider;
  transportProviderName?: string;
  orderDate?: string;
  invoiceDetails?: string;
  vehicleNo?: string;
  invoiceNo?: string;
  productDriveIds?: FileMetadata[];
  vehicleDriveIds?: FileMetadata[];
  invoiceDriveId?: FileMetadata[];
  productVoiceNoteDriveIds?: AudioFile[];
  vehicleVoiceNoteDriveIds?: AudioFile[];
  invoiceVoiceNoteDriveIds?: AudioFile[];
}

export interface EditHistoryEntry {
  timestamp: number;
  editorName: string;
  description: string;
}

export interface Order {
  //timestamp: string | number | Date;
  id?: string;
  deoNo: string;
  client: string;
  contactNo: string;
  organizationContact: string;
  customerPaymentStatus: CustomerPaymentStatus;
  products: string;
  status?: OrderStatus;
  isHighPriority: boolean;
  partDelivery: boolean;
  details: OrderDetails;
  editHistory?: EditHistoryEntry[];
  createdAt?: string;
  updatedAt?: string;
}

export interface DialogMessageType {
  type: 'success' | 'error' | 'info' | 'warning' | '';
  text: string;
}

export interface DeoNumbers {
  recentDeoNo: string;
  nextDeoNo: string;
}

export interface DeoNumbersByPrefix {
  [prefix: string]: DeoNumbers;
}

export type ViewType = 'orders' | 'users';
export type DisplayMode = 'grouped' | 'grid';