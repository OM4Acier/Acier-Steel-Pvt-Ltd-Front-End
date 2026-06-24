// types/rbac.types.ts

import { UserRole } from './user.types';

export type { UserRole };

export type Permission = import('@/lib/config/permissions').Permission;

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole; //| UserRole[]; // Support single or multiple roles
  permissions?: Permission[];
  contactNo?: string;
  organization?: string;
  accessToken: any;
  department?: string;
  isActive?: boolean;
  expiresAt?: Date;
}

export interface AccessRule {
  // Role-based rules
  allowedRoles?: UserRole[];
  deniedRoles?: UserRole[];
  requireAllRoles?: boolean; // If true, user must have ALL roles (AND logic)
  
  // Email-based rules
  allowedEmails?: string[];
  deniedEmails?: string[];
  emailDomains?: string[]; // e.g., ['company.com']
  deniedEmailDomains?: string[];
  
  // Permission-based rules
  requiredPermissions?: Permission[];
  requireAllPermissions?: boolean;
  
  // Combined rules
  customValidator?: (user: UserProfile) => boolean;
  
  // Additional constraints
  requireActive?: boolean;
  requireOrganization?: string;
  requireDepartment?: string[];
  
  // Time-based access
  allowedDays?: number[]; // 0-6 (Sunday-Saturday)
  allowedHours?: { start: number; end: number }; // 0-23
  expiryCheck?: boolean; // Check if user.expiresAt is valid
}

export interface AccessCheckResult {
  allowed: boolean;
  reason?: string;
  matchedRule?: string;
  deniedBy?: string;
}

export type AccessMode = 'allow' | 'deny' | 'check';

export interface RBACConfig {
  mode?: AccessMode; // Default behavior
  strictMode?: boolean; // If true, deny by default
  logAccess?: boolean; // Log access attempts
  cacheResults?: boolean; // Cache permission checks
}