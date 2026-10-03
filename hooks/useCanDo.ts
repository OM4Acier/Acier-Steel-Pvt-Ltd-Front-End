'use client';

/**
 * hooks/useCanDo.ts
 *
 * ROLE-AXIS permission check (F3). Answers "does the current user's ROLE allow
 * this action?", where the answer comes from Clerk's publicMetadata.role and the
 * ROLE_PERMISSIONS table in lib/config/permissions.ts.
 *
 * This is a DIFFERENT axis from components/PermissionGate.tsx, which answers
 * "is this FIELD or SECTION visible?" using per-module manifests served by
 * GET /permissions. The two are complementary layers, not alternatives:
 *
 *   <RoleGate need="orders:approve">                  ← role axis, this file
 *   <PermissionGate module="orders" field="client">   ← manifest axis, other file
 *
 * Typed on `NewPermission` (the resource:action template type), NOT on the
 * legacy flat `Permission` union. That distinction is what keeps the F2 type
 * flip atomic: when F2 replaces `Permission`, these call sites keep compiling
 * because they never referenced the union being replaced.
 */

import { useUser } from '@clerk/react';
import { canRole, type NewPermission } from '@/lib/config/permissions';

/**
 * Read the user's role from Clerk and resolve one permission against it.
 *
 * Deny-by-default on every axis — no user, no role metadata, unknown role, or
 * unknown permission all resolve to false. Never throws.
 *
 * Note: while Clerk is still loading, `user` is undefined and this returns
 * false. That means a RoleGate will briefly render its fallback on first paint
 * and then swap in its children. If that flicker matters at a given call site,
 * gate on `isLoaded` from useAuth() alongside this rather than rendering
 * optimistically.
 */
export function useCanDo(need: NewPermission): boolean {
  const { user } = useUser();
  const role = (user?.publicMetadata?.role as string | undefined) ?? null;
  return canRole(role, need);
}