/**
 * components/AppShell.tsx
 *
 * Single 'use client' boundary for all authenticated pages.
 *
 * Renders NavBar here so NO individual page needs to import or render it.
 * app/(app)/layout.tsx mounts AppShell → NavBar stays alive across
 * all page navigations (no re-mount, no session re-check per route).
 *
 * Hierarchy:
 *   app/(app)/layout.tsx          ← Server Component
 *     NavbarExtensionProvider     ← context for hanging board
 *       AppShell                  ← 'use client' boundary
 *         NavBar                  ← static, renders once
 *         NavbarExtensionSlot     ← inside NavBar, filled by pages
 *         {children}              ← page content
 */

'use client';

import React, { useEffect } from 'react';
import { useAuth, useUser, useClerk } from '@clerk/react';
import { usePathname, useRouter } from 'next/navigation';
import { requestRegistry } from '@/lib/request-registry';
import { usePermissionStore } from '@/stores/permission-store';
import { RoleChangedBanner } from './RoleChangedBanner';
import { useTokenExpiry } from '@/hooks/useTokenExpiry';
import NavBar from './NavBar';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const pathname = usePathname();

  // 0. Global Expiry Listener (Shimmed)
  useTokenExpiry();

  const { clearManifests, load, loaded } = usePermissionStore();

  const isPublicRoute = ['/login', '/forgot-password'].includes(pathname);

  // 1. Route Guard
  useEffect(() => {
    if (isLoaded && !isSignedIn && !isPublicRoute) {
      router.replace('/login');
    }
  }, [isLoaded, isSignedIn, router, isPublicRoute]);

  // 2. Request Cancellation on route change
  const prevPathname = React.useRef(pathname);
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      requestRegistry.cancelAll();
      prevPathname.current = pathname;
    }
  }, [pathname]);

  // 3. Permission Loader (Non-blocking)
  useEffect(() => {
    if (isSignedIn) {
      load();
    }

    if (!isSignedIn && (loaded || usePermissionStore.getState().version !== null)) {
      clearManifests();
    }
  }, [isSignedIn, load, clearManifests, loaded]);
  // While Clerk is loading, show the full-page loader
  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground animate-pulse text-sm">Wait of a second...</p>
      </div>
    );
  }

  // Public routes (like /login) render their own content without AppShell wrapping
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Protected routes require a user to be present
  if (!isSignedIn || !user) {
    return null; // The useEffect will handle redirect to /login
  }

  // Map Clerk user to the shape expected by NavBar (at least 'name' and 'email')
  const navUser = {
    id: user.id,
    name: user.fullName || user.username || 'User',
    email: user.primaryEmailAddress?.emailAddress || '',
    role: (user.publicMetadata?.role as string) || 'sales',
  };

  return (
    <>
      <RoleChangedBanner />
      {/* NavBar rendered once here — pages never import it */}
      <NavBar user={navUser as any} onLogout={() => signOut()} />

      {/* Page content */}
      <div className="min-h-[calc(100vh-4rem)]">
        {children}
      </div>
    </>
  );
}
