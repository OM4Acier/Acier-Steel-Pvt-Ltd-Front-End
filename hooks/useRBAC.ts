/**
 * hooks/useRBAC.ts
 * 
 * Phase 3 Shim — Clerk-backed RBAC Hook
 * 
 * This hook maintains the legacy RBAC API while sourcing the user's role
 * directly from Clerk's publicMetadata.
 */

'use client';

import { useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import { UserProfile, UserRole, Permission, AccessRule, AccessCheckResult } from '@/types/rbac.types';
import { rbac } from '@/utils/rbac.utils';

/**
 * React Hook for RBAC
 * Easy access to permission checks in React components
 */
export const useRBAC = (providedUser?: UserProfile | null) => {
  const { user: clerkUser, isLoaded } = useUser();

  // Resolve user: either the one provided, or the one from Clerk
  const user = useMemo(() => {
    if (providedUser) return providedUser;
    if (!isLoaded || !clerkUser) return null;

    return {
      id: clerkUser.id,
      name: clerkUser.fullName || clerkUser.username || 'User',
      email: clerkUser.primaryEmailAddress?.emailAddress || '',
      role: (clerkUser.publicMetadata?.role as string) || 'sales',
      permissions: [], // Note: legacy permissions are now manifests
    } as UserProfile;
  }, [providedUser, clerkUser, isLoaded]);

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
     * Check if user has permission (Legacy - mostly returns false now)
     */
    hasPermission: (permission: Permission): boolean => {
      if (!user) return false;
      return rbac.hasPermission(user, permission);
    },

    /**
     * Check if user has ANY of the permissions
     */
    hasAnyPermission: (permissions: Permission[]): boolean => {
      if (!user) return false;
      return rbac.hasAnyPermission(user, permissions);
    },

    /**
     * Check if user has ALL permissions
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
     * Check if user is super admin
     */
    isSuperAdmin: (): boolean => {
      if (!user) return false;
      return rbac.isSuperAdmin(user);
    },

    /**
     * Check if user can perform action
     */
    canPerform: (permission: Permission): boolean => {
      if (!user) return false;
      return rbac.canPerform(user, permission);
    },

    /**
     * Check if user can access resource
     */
    canAccess: (allowedRoles: UserRole[]): boolean => {
      if (!user) return false;
      return rbac.canAccess(user, allowedRoles);
    },

    /**
     * Get user's roles as array
     */
    getUserRoles: (): UserRole[] => {
      if (!user) return [];
      return Array.isArray(user.role) ? user.role : [user.role];
    },
  }), [user]);
};

/**
 * Hook for role-based rendering
 */
export const useRole = (providedUser: UserProfile | null, role: UserRole): boolean => {
  const { hasRole } = useRBAC(providedUser);
  return hasRole(role);
};

/**
 * Hook for multiple roles check
 */
export const useRoles = (
  providedUser: UserProfile | null, 
  roles: UserRole[], 
  requireAll: boolean = false
): boolean => {
  const { hasAnyRole, hasAllRoles } = useRBAC(providedUser);
  return requireAll ? hasAllRoles(roles) : hasAnyRole(roles);
};

/**
 * Hook for access rule check
 */
export const useAccessCheck = (providedUser: UserProfile | null, rule: AccessRule): AccessCheckResult => {
  const { checkAccess } = useRBAC(providedUser);
  return checkAccess(rule);
};
