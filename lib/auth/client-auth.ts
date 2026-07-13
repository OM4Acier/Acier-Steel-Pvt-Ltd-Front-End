/**
 * lib/auth/client-auth.ts
 *
 * Phase 3 Shim — Legacy Auth Interop Layer
 * 
 * This file replaces the legacy localStorage-based authentication logic
 * with no-ops and deprecation warnings. All authentication is now handled
 * by Clerk. Exports are maintained to prevent breaking legacy module pages.
 */

import type { UserProfile } from '@/types/rbac.types';

// ---------------------------------------------------------------------------
// JWT expiry event
// Still used by axios interceptor and useTokenExpiry hook.
// ---------------------------------------------------------------------------

export const TOKEN_EXPIRED_EVENT = 'auth:expired' as const;

export function notifyTokenExpired(): void {
  // Legacy cleanup
  clearSession();
  
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(TOKEN_EXPIRED_EVENT));
  }
}

// ---------------------------------------------------------------------------
// Shimmed API
// ---------------------------------------------------------------------------

export const tokenStore = {
  get(): string | null { return null; },
  set(): void { /* no-op */ },
  clear(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('currentUserProfile');
    }
  },
};

/** @deprecated Use useUser() from @clerk/react */
export async function verifyToken(): Promise<UserProfile> {
  throw new Error('[client-auth] verifyToken() is deprecated.');
}

/** @deprecated Use useUser() from @clerk/react */
export async function getSession(): Promise<UserProfile | null> {
  if (process.env.NODE_ENV === 'development') {
    console.warn('[client-auth] getSession() is deprecated. Use useSession() hook.');
  }
  return null;
}

/** @deprecated Login handled by Clerk useSignIn() */
export async function saveSession(): Promise<UserProfile> {
  throw new Error('[client-auth] saveSession() is deprecated. Login handled by Clerk.');
}

/**
 * Clears legacy localStorage keys only.
 * Sign out is handled by Clerk signOut().
 */
export function clearSession(): void {
  tokenStore.clear();
}

/** @deprecated Token injection handled by ClerkTokenProvider */
export function getToken(): string | null {
  if (process.env.NODE_ENV === 'development') {
    console.warn('[client-auth] getToken() is deprecated. Token injection handled by ClerkTokenProvider.');
  }
  return null;
}
