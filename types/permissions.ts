/**
 * types/permissions.ts
 * 
 * Single source of truth for permission-related types.
 * Used by permission-store, usePermissions hook, and PermissionGate component.
 */

export type AppModule = 
  | 'leads' 
  | 'orders' 
  | 'users' 
  | 'reports'
  | 'customers' 
  | 'attendance' 
  | 'tasks' 
  | 'purchases' 
  | 'visitors'
  | 'leads-center';

export interface FieldPermission {
  fieldId:   string;
  visible:   boolean;
  editable:  boolean;
  deletable: boolean;
}

export interface SectionPermission {
  sectionId: string;
  label:     string;
  visible:   boolean;
}

export interface PermissionManifest {
  userId:   string;
  module:   AppModule;
  fields:   FieldPermission[];
  sections: SectionPermission[];
}

export interface PermissionsResponse {
  version:   string;
  role:      string;
  manifests: PermissionManifest[];
}
