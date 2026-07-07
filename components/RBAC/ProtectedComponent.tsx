// components/RBAC/ProtectedComponent.tsx
import React, { ReactNode } from 'react';
import { UserProfile, UserRole, Permission, AccessRule } from '@/types/rbac.types';
import { useRBAC, useAccessCheck } from '@/hooks/useRBAC';

interface ProtectedProps {
  user: UserProfile | null;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Role-Based Protection
 */
interface RoleProtectedProps extends ProtectedProps {
  roles: UserRole[];
  requireAll?: boolean;
}

export const RoleProtected: React.FC<RoleProtectedProps> = ({
  user,
  roles,
  requireAll = false,
  children,
  fallback = null
}) => {
  const { hasAnyRole, hasAllRoles } = useRBAC(user);

  const hasAccess = requireAll ? hasAllRoles(roles) : hasAnyRole(roles);

  return <>{hasAccess ? children : fallback}</>;
};

/**
 * Permission-Based Protection
 */
interface PermissionProtectedProps extends ProtectedProps {
  permissions: Permission[];
  requireAll?: boolean;
}

export const PermissionProtected: React.FC<PermissionProtectedProps> = ({
  user,
  permissions,
  requireAll = false,
  children,
  fallback = null
}) => {
  const { hasAnyPermission, hasAllPermissions } = useRBAC(user);

  const hasAccess = requireAll ? hasAllPermissions(permissions) : hasAnyPermission(permissions);

  return <>{hasAccess ? children : fallback}</>;
};

/**
 * Advanced Rule-Based Protection
 */
interface RuleProtectedProps extends ProtectedProps {
  rule: AccessRule;
  onAccessDenied?: (reason?: string) => void;
}

export const RuleProtected: React.FC<RuleProtectedProps> = ({
  user,
  rule,
  children,
  fallback = null,
  onAccessDenied
}) => {
  const result = useAccessCheck(user, rule);

  React.useEffect(() => {
    if (!result.allowed && onAccessDenied) {
      onAccessDenied(result.reason);
    }
  }, [result.allowed, result.reason, onAccessDenied]);

  return <>{result.allowed ? children : fallback}</>;
};

/**
 * Super Admin Only Protection
 */
export const SuperAdminOnly: React.FC<ProtectedProps> = ({
  user,
  children,
  fallback = null
}) => {
  const { isSuperAdmin } = useRBAC(user);

  return <>{isSuperAdmin() ? children : fallback}</>;
};

/**
 * Block Specific Roles
 */
interface BlockRolesProps extends ProtectedProps {
  blockedRoles: UserRole[];
}

export const BlockRoles: React.FC<BlockRolesProps> = ({
  user,
  blockedRoles,
  children,
  fallback = null
}) => {
  const { canAccess } = useRBAC(user);

  const isBlocked = canAccess(blockedRoles);

  return <>{!isBlocked ? children : fallback}</>;
};

/**
 * Email-Based Protection
 */
interface EmailProtectedProps extends ProtectedProps {
  allowedEmails?: string[];
  blockedEmails?: string[];
}

export const EmailProtected: React.FC<EmailProtectedProps> = ({
  user,
  allowedEmails,
  blockedEmails,
  children,
  fallback = null
}) => {
  if (!user) return <>{fallback}</>;

  const userEmail = user.email.toLowerCase();

  // Check blocked emails first
  if (blockedEmails && blockedEmails.includes(userEmail)) {
    return <>{fallback}</>;
  }

  // Check allowed emails
  if (allowedEmails && allowedEmails.length > 0) {
    if (!allowedEmails.includes(userEmail)) {
      return <>{fallback}</>;
    }
  }

  return <>{children}</>;
};

/**
 * Combined Role + Email Protection
 */
interface CombinedProtectedProps extends ProtectedProps {
  allowedRoles?: UserRole[];
  allowedEmails?: string[];
  blockedRoles?: UserRole[];
  blockedEmails?: string[];
  requireBothRoleAndEmail?: boolean; // AND logic for role+email
}

export const CombinedProtected: React.FC<CombinedProtectedProps> = ({
  user,
  allowedRoles,
  allowedEmails,
  blockedRoles,
  blockedEmails,
  requireBothRoleAndEmail = false,
  children,
  fallback = null
}) => {
  const { hasAnyRole, canAccess } = useRBAC(user);

  if (!user) return <>{fallback}</>;

  const userEmail = user.email.toLowerCase();

  // Check blocked first (highest priority)
  if (blockedEmails && blockedEmails.includes(userEmail)) {
    return <>{fallback}</>;
  }

  if (blockedRoles && canAccess(blockedRoles)) {
    return <>{fallback}</>;
  }

  // Check allowed
  const hasAllowedRole = allowedRoles ? hasAnyRole(allowedRoles) : true;
  const hasAllowedEmail = allowedEmails 
    ? allowedEmails.includes(userEmail) 
    : true;

  let hasAccess: boolean;

  if (requireBothRoleAndEmail) {
    // Both role AND email must match
    hasAccess = hasAllowedRole && hasAllowedEmail;
  } else {
    // Either role OR email must match (if specified)
    if (allowedRoles && allowedEmails) {
      hasAccess = hasAllowedRole || hasAllowedEmail;
    } else if (allowedRoles) {
      hasAccess = hasAllowedRole;
    } else if (allowedEmails) {
      hasAccess = hasAllowedEmail;
    } else {
      hasAccess = true;
    }
  }

  return <>{hasAccess ? children : fallback}</>;
};

/**
 * Show component only if user doesn't have access
 * Useful for showing "upgrade" or "request access" messages
 */
export const ShowIfNoAccess: React.FC<RuleProtectedProps> = ({
  user,
  rule,
  children,
  fallback = null
}) => {
  const result = useAccessCheck(user, rule);

  return <>{!result.allowed ? children : fallback}</>;
};