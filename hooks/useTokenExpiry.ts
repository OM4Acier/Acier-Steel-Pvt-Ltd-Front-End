/**
 * hooks/useTokenExpiry.ts
 *
 * Phase 3 Shim — Clerk-backed Expiry Handler
 *
 * Listens for the 'auth:expired' custom browser event dispatched by
 * notifyTokenExpired() in lib/auth/client-auth.ts whenever any API call returns 401.
 *
 * Since Clerk handles session refresh automatically, this hook no longer
 * manages token intervals. It serves as the bridge between non-React API
 * errors and the Clerk session state.
 */

'use client';

import { useEffect } from 'react';
import { useClerk } from '@clerk/react';
import { toast } from 'sonner';
import { TOKEN_EXPIRED_EVENT } from '@/lib/auth/client-auth';

export function useTokenExpiry(onExpired?: () => void): void {
  const { signOut } = useClerk();

  useEffect(() => {
    function handleExpired() {
      // 1. Show notification
      toast.error('Session expired', {
        description: 'Please log in again to continue.',
        duration: 4000,
      });

      // 2. Call optional custom handler
      onExpired?.();

      // 3. Trigger Clerk sign out
      // This will clear Clerk cookies and redirect to the sign-in URL
      signOut();
    }

    window.addEventListener(TOKEN_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(TOKEN_EXPIRED_EVENT, handleExpired);
  }, [signOut, onExpired]);
}
