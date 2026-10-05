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

import React, { useEffect, useMemo } from 'react';
import { useAuth, useUser, useClerk } from '@clerk/react';
import { usePathname, useRouter } from 'next/navigation';
import { requestRegistry } from '@/lib/request-registry';
import { matchRoute } from '@/lib/config/routes';
import { canRole } from '@/lib/config/permissions';
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

  // Role comes from Clerk publicMetadata — the single authoritative source.
  // (The permissions API also returns a role; it is NOT read here. See the
  // master plan decision (f).)
  const role = (user?.publicMetadata?.role as string | undefined) ?? null;

  // Route lookup is memoized on pathname so the guard effect below does not
  // re-run on every render — matchRoute() returns a fresh object each call.
  const route = useMemo(() => matchRoute(pathname), [pathname]);

  // Two DIFFERENT questions, two DIFFERENT flags. Conflating them made the
  // dashboard lose its NavBar: '/' is permission:'public' (no ROLE check) but
  // still needs the shell, so only `anonymous` may skip the NavBar.
  //
  //   noRoleCheck — permission === 'public'; skip the canRole() step only
  //   anonymous   — route.anonymous; skip the shell (NavBar) and the
  //                 signed-in requirement, for /login and the error pages
  const noRoleCheck = route?.permission === 'public';
  const isAnonymous = route?.anonymous ?? false;

  // 1. Route Guard — fails closed. Order matters:
  //    Clerk not ready -> nothing.  Not signed in -> /login (unless public).
  //    Unknown path -> /404.  External nav entry -> skip.  public -> skip.
  //    Otherwise canRole(), deny -> /403.
  useEffect(() => {
    if (!isLoaded) return;

    // Clerk reports isLoaded before useUser() has necessarily hydrated. If
    // isSignedIn is true but user is still null, `role` is null, canRole()
    // denies everything, and a legitimate user gets a /403 flash on cold
    // cache. Wait for the user object — the effect re-runs when it lands.
    if (isSignedIn && !user) return;

    if (!isSignedIn) {
      // Anonymous routes (login, forgot-password, 403, 404) render for
      // anyone; everything else needs a session.
      if (!isAnonymous) router.replace('/login');
      return;
    }

    if (!route) {
      router.replace('/404');
      return;
    }

    // External entries (the off-site mytaskacier URL) are nav/shortcut links.
    // matchRoute() cannot match them today, but branch explicitly rather than
    // relying on that being true forever.
    if (route.kind === 'external') return;

    // Narrow on route.permission directly — the `noRoleCheck` boolean does not
    // narrow the union, so 'public' would otherwise reach canRole() and fail
    // to typecheck. A local alias keeps the invariant in one place.
    const need = route.permission;
    if (need === 'public') return;

    if (!canRole(role, need)) {
      router.replace('/403');
    }
  }, [isLoaded, isSignedIn, user, role, pathname, route, noRoleCheck, isAnonymous, router]);

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

  // Only anonymous routes (login, forgot-password, 403, 404) render without
  // the NavBar. Every other route — including the dashboard and /account,
  // which are permission:'public' — renders inside the shell.
  if (isAnonymous) {
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
    role: role || 'sales',
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
