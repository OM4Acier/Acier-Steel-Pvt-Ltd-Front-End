// hooks/useRBAC.ts
import { useMemo } from 'react';
import { UserProfile, UserRole, Permission, AccessRule, AccessCheckResult } from '@/types/rbac.types';
import { rbac } from '@/utils/rbac.utils';

/**
 * React Hook for RBAC
 * Easy access to permission checks in React components
 */
export const useRBAC = (user: UserProfile | null) => {
  return useMemo(() => ({
    /**
     * Check if user has specific role
     */
    hasRole: (role: UserRole): boolean => {
      if (!user) return false;
      return rbac.hasRole(user, role);
    },

    /**
     * Check if user has any of the roles
     */
    hasAnyRole: (roles: UserRole[]): boolean => {
      if (!user) return false;
      return rbac.hasAnyRole(user, roles);
    },

    /**
     * Check if user has all roles
     */
    hasAllRoles: (roles: UserRole[]): boolean => {
      if (!user) return false;
      return rbac.hasAllRoles(user, roles);
    },

    /**
     * Check if user has permission
     */
    hasPermission: (permission: Permission): boolean => {
      if (!user) return false;
      return rbac.hasPermission(user, permission);
    },

    /**
     * Check if user has any permission
     */
    hasAnyPermission: (permissions: Permission[]): boolean => {
      if (!user) return false;
      return rbac.hasAnyPermission(user, permissions);
    },

    /**
     * Check if user has all permissions
     */
    hasAllPermissions: (permissions: Permission[]): boolean => {
      if (!user) return false;
      return rbac.hasAllPermissions(user, permissions);
    },

    /**
     * Comprehensive access check
     */
    checkAccess: (rule: AccessRule): AccessCheckResult => {
      return rbac.checkAccess(user, rule);
    },

    /**
     * Check if super admin
     */
    isSuperAdmin: (): boolean => {
      if (!user) return false;
      return rbac.isSuperAdmin(user);
    },

    /**
     * Check if user can access resource
     */
    canAccess: (allowedRoles: UserRole[]): boolean => {
      if (!user) return false;
      return rbac.canAccess(user, allowedRoles);
    },

    /**
     * Check if user can perform action
     */
    canPerform: (permission: Permission): boolean => {
      if (!user) return false;
      return rbac.canPerform(user, permission);
    },

    /**
     * Get user's roles as array
     */
    getUserRoles: (): UserRole[] => {
      if (!user) return [];
      return Array.isArray(user.role) ? user.role : [user.role];
    },

    /**
     * Get user's permissions
     */
    getUserPermissions: (): Permission[] => {
      if (!user || !user.permissions) return [];
      return user.permissions;
    },

    /**
     * Check if role is blocked
     */
    isRoleBlocked: (role: UserRole): boolean => {
      if (!user) return false;
      return rbac.isRoleBlocked(user, role);
    },

    /**
     * Check if any role is blocked
     */
    hasBlockedRole: (roles: UserRole[]): boolean => {
      if (!user) return false;
      return rbac.hasAnyRole(user, roles);
    }
  }), [user]);
};

/**
 * Hook for permission-based rendering
 */
export const usePermission = (user: UserProfile | null, permission: Permission): boolean => {
  return useMemo(() => {
    if (!user) return false;
    return rbac.hasPermission(user, permission);
  }, [user, permission]);
};

/**
 * Hook for role-based rendering
 */
export const useRole = (user: UserProfile | null, role: UserRole): boolean => {
  return useMemo(() => {
    if (!user) return false;
    return rbac.hasRole(user, role);
  }, [user, role]);
};

/**
 * Hook for multiple roles check
 */
export const useRoles = (
  user: UserProfile | null, 
  roles: UserRole[], 
  requireAll: boolean = false
): boolean => {
  return useMemo(() => {
    if (!user) return false;
    return requireAll 
      ? rbac.hasAllRoles(user, roles)
      : rbac.hasAnyRole(user, roles);
  }, [user, roles, requireAll]);
};

/**
 * Hook for access rule check
 */
export const useAccessCheck = (user: UserProfile | null, rule: AccessRule): AccessCheckResult => {
  return useMemo(() => {
    return rbac.checkAccess(user, rule);
  }, [user, rule]);
};