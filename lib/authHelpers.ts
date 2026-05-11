// authHelpers.ts

import { UserProfile, UserRole } from "@/types/rbac.types";


export const AuthUtils = {
    // Check if a user has a specific role
    hasRole: (user: UserProfile | null, allowedRoles: UserRole[]): boolean => {
      return !!user && allowedRoles.includes(user.role);
    },
  
    // Check if an email is in an authorized list
    isAuthorizedEmail: (email: string, authorizedEmails: string[]): boolean => {
      return authorizedEmails.map(e => e.toLowerCase()).includes(email.toLowerCase());
    },
  
    // Individual Role Helpers
    isSuperAdmin: (role?: UserRole) => role === 'super-admin',
    isPurchaseEntry: (role?: UserRole) => role === 'purchase-entry',
    isOperations: (role?: UserRole) => role === 'operations',
    isAccountant: (role?: UserRole) => role === 'accountant',
  
    // Combined Check (Role OR Email)
    canAccess: (user: UserProfile | null, requirements: { roles?: UserRole[], emails?: string[] }): boolean => {
      if (!user) return false;
      
      const roleMatch = requirements.roles ? AuthUtils.hasRole(user, requirements.roles) : true;
      const emailMatch = requirements.emails ? AuthUtils.isAuthorizedEmail(user.email, requirements.emails) : true;
      
      return roleMatch && emailMatch;
    }
  };