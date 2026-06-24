'use client';

import { useAuth } from '@clerk/nextjs';
import { setTokenFetcher } from '@/lib/api/client';

/**
 * ClerkTokenProvider
 * 
 * Registers the Clerk token fetcher with the global axiosInstance.
 * We use useMemo to ensure registration happens during the render phase,
 * avoiding race conditions with children's useEffects.
 */
export function ClerkTokenProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();

  // Register the fetcher synchronously during render
  setTokenFetcher(getToken);

  return <>{children}</>;
}
