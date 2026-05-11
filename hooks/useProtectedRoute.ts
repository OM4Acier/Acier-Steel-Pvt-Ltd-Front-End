// hooks/useProtectedRoute.ts

import { useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UserRole, Permission } from '@/types/auth.types';
import { auth } from '@/lib/auth';
import { useAuth } from '@/components/AuthProvider';

interface UseProtectedRouteConfig {
  allowedRoles?: UserRole[];
  requiredPermissions?: Permission[];
  requireAll?: boolean;
  redirectTo?: string;
  // Security check bypass options
  skipChecks?: {
    tokenMismatch?: boolean;      // Skip token Mismatch check
    activeCheck?: boolean;      // Skip isActive check
    expiryCheck?: boolean;       // Skip expiresAt check
    roleCheck?: boolean;         // Skip role validation
    permissionCheck?: boolean;   // Skip permission validation
  };
}
export function useProtectedRoute(config: UseProtectedRouteConfig = {}) {
  // 1. Memoize config to prevent the dependency array from re-firing 
  // every time the parent component renders.
  const {
    allowedRoles,
    requiredPermissions,
    requireAll = false,
    redirectTo = '/',
    skipChecks
  } = config;

  // Set default skipChecks values safely
  const activeSkipChecks = useMemo(() => ({
    tokenMismatch: true,
    activeCheck: true,
    expiryCheck: true,
    roleCheck: true,
    permissionCheck: true,
    ...skipChecks
  }), [skipChecks]);

  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const hasChecked = useRef(false);

  useEffect(() => {
    const token = auth.getToken();
    // CRITICAL: Wait for auth to finish loading
    if (isLoading) {
      console.log('Auth still loading, waiting...');
      return;
    }
    
    if (token && !user) {
      console.log("Token found, but user state not yet hydrated. Waiting...");
      router.replace(`/login?error=session_required`);
      return;
    }

    // Prevent multiple checks
    if (hasChecked.current) return;

    // ========================================================================
    // SECURITY CHECK 1: Verify token still exists (Cannot be bypassed)
    // ========================================================================

    if (!token) {
      console.warn('Security: No token found during route check');
      console.error('Debug useProtectedRoute: Missing token', { isLoading, user, isAuthenticated, token });
      auth.clearAuth();
      hasChecked.current = true;
      const currentPath = window.location.pathname;
      const returnTo = encodeURIComponent(currentPath);
      
      toast.error('Session expired', { description: 'Please log in again.' });
      
      router.replace(`/login?returnTo=${returnTo}`);
      return;
    }
    // ========================================================================
    // SECURITY CHECK 2: User authenticated (Cannot be bypassed)
    // ========================================================================
    if (!isAuthenticated || !user) {
      console.warn('Security: Session invalid or missing user object');
      console.error('Debug useProtectedRoute: Missing user/auth', { isLoading, user, isAuthenticated, token });
      hasChecked.current = true;
      
      toast.error('Authentication check failed', { description: 'Please log in again.' });

      router.replace(`/login?error=session_required`);
      return;
    }

    // Mark as checked before other checks to prevent multiple redirects
    hasChecked.current = true;


    {/*
    // ========================================================================
    // SECURITY CHECK 3: Token mismatch (Cannot be bypassed)
    // ========================================================================
    if (!activeSkipChecks.tokenMismatch) {
      if (user.accessToken !== token) {
        console.warn('Security: Token mismatch detected');
        auth.clearAuth();
        router.replace('/login?error=invalid_token');
        return;
      }
    } else {
      console.log('⚠️ Skipping active account check');
    }

    // ========================================================================
    // SECURITY CHECK 4: Account active (Can be bypassed)
    // ========================================================================
    if (!activeSkipChecks.activeCheck) {
      if (user.isActive === false) {
        console.warn('Security: User account is inactive');
        toast.error('Your account has been deactivated', {
          description: 'Please contact your administrator',
          duration: 5000,
        });
        auth.clearAuth();
        router.replace('/login?error=account_inactive');
        return;
      }
    } else {
      console.log('⚠️ Skipping active account check');
    }

    // ========================================================================
    // SECURITY CHECK 5: Account not expired (Can be bypassed)
    // ========================================================================
    if (!activeSkipChecks.expiryCheck) {
      if (user.expiresAt && new Date(user.expiresAt) < new Date()) {
        console.warn('Security: User account has expired');
        toast.error('Your account has expired', {
          description: 'Please contact your administrator to renew',
          duration: 5000,
        });
        auth.clearAuth();
        router.replace('/login?error=account_expired');
        return;
      }
    } else {
      console.log('⚠️ Skipping account expiry check');
    }

    // ========================================================================
    // SECURITY CHECK 6: Role-based access (Can be bypassed)
    // ========================================================================
    if (!activeSkipChecks.roleCheck && allowedRoles && allowedRoles.length > 0) {
      const userRoles = Array.isArray(user.role) ? user.role : [user.role];
      const hasRequiredRole = userRoles.some(role => allowedRoles.includes(role));

      if (!hasRequiredRole) {
        console.warn(`Security: User roles "${userRoles.join(', ')}" not allowed. Required: ${allowedRoles.join(', ')}`);
        toast.error('Access denied', {
          description: 'Your role does not permit access to this page',
          duration: 4000,
        });
        router.replace(redirectTo);
        return;
      }
    } else if (activeSkipChecks.roleCheck) {
      console.log('⚠️ Skipping role-based access check');
    }

    // ========================================================================
    // SECURITY CHECK 7: Permission-based access (Can be bypassed)
    // ========================================================================
    if (!activeSkipChecks.permissionCheck && requiredPermissions && requiredPermissions.length > 0) {
      const userPermissions = user.permissions || [];

      let hasRequiredPermission = false;

      if (requireAll) {
        // User must have ALL required permissions
        hasRequiredPermission = requiredPermissions.every(
          permission => userPermissions.includes(permission)
        );
      } else {
        // User must have at least ONE required permission
        hasRequiredPermission = requiredPermissions.some(
          permission => userPermissions.includes(permission)
        );
      }

      if (!hasRequiredPermission) {
        console.warn(`Security: Insufficient permissions. Required: ${requiredPermissions.join(', ')}`);
        toast.error('Insufficient permissions', {
          description: 'You do not have the required permissions to access this page',
          duration: 4000,
        });
        router.replace(redirectTo);
        return;
      }
    } else if (activeSkipChecks.permissionCheck) {
      console.log('⚠️ Skipping permission-based access check');
    }
 */}


    console.log('✅ Security checks passed for:', user.email);
    return () => {
      hasChecked.current = false;
  };
  
}, [isLoading, isAuthenticated, user, router, allowedRoles, requiredPermissions, requireAll, redirectTo, activeSkipChecks]);

return { user, isLoading };
}