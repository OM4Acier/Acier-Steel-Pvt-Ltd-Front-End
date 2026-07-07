// permissions.ts

// TODO: Implement
// permissions.ts - Role-based Permission Utilities

import { UserProfile, UserRole } from '@/types/rbac.types';
import { OrderStatus } from './types';
import { AuthUtils } from '@/lib/authHelpers';

// Role Checkers
export const isSuperAdmin = (user: UserProfile | null | UserRole): boolean => {
  if (typeof user === 'string') return user === 'super-admin';
  return user?.role === 'super-admin';
};

export const isSales = (user: UserProfile | null | UserRole): boolean => {
  if (typeof user === 'string') return user === 'sales';
  return user?.role === 'sales';
};

export const isAccountant = (user: UserProfile | null | UserRole): boolean => {
  if (typeof user === 'string') return user === 'accountant';
  return user?.role === 'accountant';
};

export const isOperations = (user: UserProfile | null | UserRole): boolean => {
  if (typeof user === 'string') return user === 'operations';
  return user?.role === 'operations';
};

// Field Edit Permissions
export const canEditSalesSpecificFields = (role: UserRole | null): boolean => {
  return isSales(role) || isSuperAdmin(role);
};

export const canEditOperationsSpecificFields = (role: UserRole | null): boolean => {
  return isOperations(role) || isSuperAdmin(role);
};

export const canEditVehicleNoField = (role: UserRole | null): boolean => {
  return isSales(role) || isOperations(role) || isSuperAdmin(role);
};

export const canEditAccountantSpecificFields = (
  role: UserRole | null,
  orderStatus: OrderStatus | undefined
): boolean => {
  return isSuperAdmin(role) || (isAccountant(role) && orderStatus === 'Dispatched and Invoiced');
};

export const canEditInvoiceDetailsField = (
  role: UserRole | null,
  orderStatus: OrderStatus | undefined
): boolean => {
  return (
    isSuperAdmin(role) ||
    isSales(role) ||
    (isAccountant(role) && orderStatus === 'Dispatched and Invoiced')
  );
};

export const canEditInvoiceNumberField = (
  role: UserRole | null,
  orderStatus: OrderStatus | undefined
): boolean => {
  return isSuperAdmin(role) || (isAccountant(role) && orderStatus === 'Dispatched and Invoiced');
};

// Action Permissions
export const canApproveOrder = (role: UserRole | null): boolean => {
  return isSuperAdmin(role);
};

export const canMarkAsPaid = (role: UserRole | null): boolean => {
  return isSuperAdmin(role);
};

export const canCreatePartDelivery = (role: UserRole | null): boolean => {
  return isOperations(role) || isSuperAdmin(role);
};

export const canCancelOrder = (role: UserRole | null): boolean => {
  return isSuperAdmin(role);
};

// View Permissions
export const canAccessOrdersPage = (role: UserRole): boolean => {
  const allowedRoles: UserRole[] = ['super-admin', 'sales', 'operations', 'accountant'];
  return allowedRoles.includes(role);
};

// PDF Permissions
/** Every authenticated role can generate a PDF — content is role-filtered automatically. */
export const canExportPdf = (role: UserRole | null): boolean => {
  if (!role) return false;
  const allowedRoles: UserRole[] = ['super-admin', 'sales', 'operations', 'accountant'];
  return allowedRoles.includes(role);
};

/** Only super-admin can open the PDF field configuration modal. */
export const canConfigurePdf = (role: UserRole | null): boolean => {
  return isSuperAdmin(role);
};

export const canAccessUsersPage = (role: UserRole): boolean => {
  return isSuperAdmin(role);
};

export const canEditSiteInfo = (user: UserProfile): boolean => {
  // 1. Normalize the user object
  // If 'user' is just a string (UserRole), we can't check email, 
  // so we wrap it in a partial object or handle it accordingly.

  // 2. Return the result of the access check
  return AuthUtils.canAccess(user, {
    roles: ['accountant', 'super-admin'], // Added super-admin as a safety best practice
    emails: ['ritu@aciersteelpvtltd.com']  // Use full emails for accuracy
  });
};
