/**
 * hooks/useSession.ts
 *
 * Phase 3 Shim — Clerk-backed Session Hook
 *
 * This hook replaces the legacy lib/auth based session management with Clerk,
 * while maintaining the exact same return shape to ensure existing module 
 * pages continue to function without refactoring.
 */

'use client';

import { useEffect, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth, useUser, useClerk } from '@clerk/nextjs';
import type { UserProfile } from '@/types/rbac.types';
import { ROUTES } from '@/lib/config/routes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseSessionOptions {
  /**
   * Redirect to /login when there is no valid session.
   * Default: true
   */
  required?: boolean;
  /**
   * If provided, the hook redirects to / (or calls onUnauthorized)
   * when the user's role is not in this list.
   */
  allowedRoles?: UserProfile['role'][];
  /** Called instead of the default redirect when role check fails */
  onUnauthorized?: () => void;
}

interface UseSessionResult {
  user:      UserProfile | null;
  isLoading: boolean;
  logout:    () => void;
  refresh:   () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSession({
  required = true,
  allowedRoles,
  onUnauthorized,
}: UseSessionOptions = {}): UseSessionResult {
  const { isLoaded, isSignedIn } = useAuth();
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const pathname = usePathname();

  // Map Clerk user to the legacy UserProfile shape
  const user = useMemo(() => {
    if (!clerkUser) return null;
    //console.log('[useSession] Mapped Clerk user to UserProfile:', clerkUser);
    return {
      id: clerkUser.id,
      name: clerkUser.fullName || clerkUser.username || 'User',
      email: clerkUser.primaryEmailAddress?.emailAddress || '',
      role: (clerkUser.publicMetadata?.role as string) || 'sales',
      // Deprecated: components should not touch tokens directly
      accessToken: null,
    } as UserProfile;
  }, [clerkUser]);

  useEffect(() => {
    if (!isLoaded) return;

    // Handle missing session
    if (!isSignedIn) {
      if (required && pathname !== ROUTES.LOGIN) {
        router.replace(`${ROUTES.LOGIN}?returnTo=${encodeURIComponent(pathname)}`);
      }
      return;
    }

    // Handle role authorization
    if (user && allowedRoles && !allowedRoles.includes(user.role)) {
      if (onUnauthorized) {
        onUnauthorized();
      } else {
        router.replace(ROUTES.HOME);
      }
    }
  }, [isLoaded, isSignedIn, user, required, allowedRoles, onUnauthorized, router, pathname]);

  // Deprecation warning for components attempting to use accessToken
  useEffect(() => {
    if (typeof window !== 'undefined' && user) {
      // We don't want to spam, but we do want to warn once
      (window as any).__clerk_token_warned = (window as any).__clerk_token_warned || false;
      if (!(window as any).__clerk_token_warned) {
        console.warn("[useSession] accessToken is deprecated. Tokens are managed by the axios interceptor.");
        (window as any).__clerk_token_warned = true;
      }
    }
  }, [user]);

  const logout = () => {
    //signOut().then(() => router.replace(ROUTES.LOGIN));
  };

  const refresh = async () => {
    // No-op: Clerk handles session refresh automatically
    console.debug("[useSession] refresh() called. Clerk handles this automatically.");
  };

  return { 
    user, 
    isLoading: !isLoaded, 
    logout, 
    refresh 
  };
}
