// types/user.types.ts

/**
 * Single source of truth for User roles and profiles.
 * Synced with MongoDB schema and Clerk publicMetadata.
 */

export type UserRole = 
  | 'super-admin' 
  | 'admin' 
  | 'sales' 
  | 'accountant' 
  | 'operations' 
  | 'purchase-entry'
  | 'manager'
  | 'viewer'
  | 'editor';

export interface IUser {
  clerkId:      string;       // Clerk user ID — primary link. Unique + indexed.
  email:        string;       // from Clerk. Updated by webhook on user.updated.
  name:         string;       // from Clerk. Updated by webhook on user.updated.
  role:         UserRole;     // set by admin via BAPI + stored here. Source for attachUser.
  department:   string;       // business field — set by admin, NOT synced from Clerk.
  contactNo:    string;       // business field — set by admin, NOT synced from Clerk.
  organization: string;       // business field — set by admin, NOT synced from Clerk.
  /**
   * Per-user permission GRANTS, on top of what the role already grants.
   * EXTRAS ONLY — a permission the role already has is not repeated here, so
   * changing a role cannot leave a stale grant behind.
   */
  permissions?: string[];     // catalogue strings. Empty/absent = no grants.
  createdAt:    string;
  updatedAt?:   string;
}

/**
 * Payload for creating a user via POST /api/admin/users
 */
export interface CreateUserPayload {
  email:         string;   // required
  password:      string;   // required — temporary
  name:          string;   // required — split into firstName/lastName for Clerk
  role:          UserRole; // required
  department?:   string;
  contactNo?:    string;
  organization?: string;
}

/**
 * Payload for updating user role via PATCH /api/admin/users/:clerkId/role
 */
export interface UpdateUserRolePayload {
  role: UserRole;
}

/**
 * Payload for updating business fields via PATCH /api/admin/users/:clerkId
 */
export interface UpdateUserFieldsPayload {
  department?:   string;
  contactNo?:    string;
  organization?: string;
  name?:         string;  // updates Clerk + MongoDB
}

/**
 * Payload for setting per-user permission grants.
 * PATCH /api/admin/users/:clerkId/permissions
 *
 * EXTRAS ONLY — role defaults are recomputed server-side and must not be sent
 * here. The backend rejects any string not in the catalogue.
 */
export interface UpdateUserPermissionsPayload {
  permissions: string[];
}
