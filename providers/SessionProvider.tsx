/**
 * context/SessionProvider.tsx (shim)
 * 
 * Phase 3 Shim — Clerk-backed Session Provider
 * 
 * This provider remains for backward compatibility. It provides the SessionContext
 * to any legacy components that still use useContext(SessionContext).
 * Internally, it now consumes the shimmed useSession() hook.
 */

'use client';

import { createContext, ReactNode } from 'react';
import type { UserProfile } from '@/types/rbac.types';
import { useSession } from '@/hooks/useSession';

interface SessionContextValue {
  user: UserProfile | null;
  isLoading: boolean;
  logout: () => void;
  refresh: () => Promise<void>;
}

export const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  // Use the shimmed hook to get the session state
  const session = useSession({ required: false });

  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  );
}
