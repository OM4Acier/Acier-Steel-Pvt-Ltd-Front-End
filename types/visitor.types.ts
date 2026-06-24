/**
 * types/visitor.types.ts
 */

export interface VisitorData {
  visitorName: string;
  contactNo: string;
  organization: string;
  purposeOfVisit: string;
  notes: string;
  documentBase64: string | null;
  documentName: string | null;
  documentMimeType: string | null;
  
  // Smart collection fields
  typographyInfo?: string;
  colorInfo?: string;
  spatialInfo?: string;
  depthInfo?: string;
}

export interface VisitorResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: any;
}
