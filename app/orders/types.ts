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

// Customer Payment Status
export enum CustomerPaymentStatus {
  CREDIT_NOTE = 'credit-note',
  NEW_PAID = 'new-paid',
  NEW_UNPAID = 'new-unpaid',
  REGULAR = 'regular',
}
export type CustomerPaymentStatusType = CustomerPaymentStatus;
export const CUSTOMER_PAYMENT_STATUS_LABELS: Record<CustomerPaymentStatus, string> = {
  [CustomerPaymentStatus.CREDIT_NOTE]: 'Credit Note',
  [CustomerPaymentStatus.NEW_PAID]: 'New - Paid',
  [CustomerPaymentStatus.NEW_UNPAID]: 'New - Unpaid',
  [CustomerPaymentStatus.REGULAR]: 'Regular',
};
export const PAYMENT_STATUS_LABELS: Record<CustomerPaymentStatus, string> = CUSTOMER_PAYMENT_STATUS_LABELS;
export type MeasurementKata = 'prince' | 'factory';
export const MEASUREMENT_KATA_LABELS: Record<MeasurementKata, string> = {
  prince: 'Prince Kata',
  factory: 'Factory Kata',
};
export type TransportProvider = 'client' | 'porter' | 'own';
export const TRANSPORT_PROVIDER_LABELS: Record<TransportProvider, string> = {
  client: 'Client Transport',
  porter: 'Porter',
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
  measurementKata?: MeasurementKata;
  transportProvider?: TransportProvider;
  transportProviderName?: string;
  orderDate?: string;
  invoiceIssueDate?: string;
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

export interface OrganizationContactDetails {
  userId?: string;
  name?: string;
  email?: string;
}

export interface QuotationLineItem {
  itemName: string;
  description?: string;
  price?: string | number;
  unit?: string;
}

export interface QuotationPrefillPayload {
  qno?: string;
  cName?: string;
  cContact?: string;
  cPhone?: string;
  cGstin?: string;
  cAddr?: string;
  shipSame?: boolean;
  sName?: string;
  sPhone?: string;
  sGst?: string;
  sAddr?: string;
  inqSrc?: string;
  salesExec?: string;
  items?: QuotationLineItem[];
}

export interface Order {
  //timestamp: string | number | Date;
  id?: string;
  deoNo: string;
  client: string;
  contactNo: string;
  organizationContact: string;
  organizationContactDetails?: OrganizationContactDetails;
  customerPaymentStatus: CustomerPaymentStatus;
  products: string;
  status?: OrderStatus;
  isHighPriority: boolean;
  partDelivery: boolean;
  details: OrderDetails;
  editHistory?: EditHistoryEntry[];
  createdAt?: string;
  updatedAt?: string;
  quotationNo?: string;
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
