/**
 * lib/auth/access.ts
 *
 * canDo() — the single entry point for every permission check.
 *
 * Call it anywhere: hooks, components, server actions.
 * It never throws — returns a plain boolean.
 *
 * Check order (first match wins):
 *   0. null user              → false
 *   1. super-admin            → true  (always)
 *   2. role in ROLE_DEFAULTS  → true  (role-based default)
 *   3. permission in grants   → true  (individual user grant)
 *      Otherwise              → false
 *
 * Why this order?
 *   Super-admin check first keeps it fast for the most privileged path.
 *   Role defaults second covers the normal case without DB lookups.
 *   Individual grants last is the override for non-standard access.
 *
 * Usage:
 *   canDo(user, 'orders:create')          // single permission
 *   canDo(user, ['orders:approve', 'orders:dispatch'])  // any of these
 *   canDo(user, 'orders:approve', { all: true })        // all of these
 */

import type { UserProfile } from '@/types/rbac.types';
import { Permission, ROLE_DEFAULTS } from '../config/permissions';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

interface CanDoOptions {
  /**
   * When passing an array of permissions:
   *   all: false (default) → user needs ANY ONE of them
   *   all: true            → user needs ALL of them
   */
  all?: boolean;
}

// ---------------------------------------------------------------------------
// Core single-permission check
// ---------------------------------------------------------------------------

function checkOne(user: UserProfile, permission: Permission): boolean {
  // Layer 1 — super-admin bypass
  if (user.role === 'super-admin') return true;

  // Layer 2 — role default
  const defaultRoles = ROLE_DEFAULTS[permission];
  if (defaultRoles?.has(user.role)) return true;

  // Layer 3 — individual grant
  if (user.permissions?.includes(permission)) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check if user can perform one or more permissions.
 *
 * @param user        Current UserProfile (null = always false)
 * @param permission  A single Permission or an array of Permissions
 * @param options     { all: true } to require ALL permissions in an array
 */
export function canDo(
  user: UserProfile | null,
  permission: Permission | Permission[],
  options: CanDoOptions = {}
): boolean {
  if (!user) return false;

  if (Array.isArray(permission)) {
    return options.all
      ? permission.every((p) => checkOne(user, p))
      : permission.some((p) => checkOne(user, p));
  }

  return checkOne(user, permission);
}

/**
 * Returns all permissions the user has — role defaults + individual grants.
 * Used by the profile page to display "Your access" and by the admin grant UI.
 */
export function getUserPermissions(user: UserProfile | null): Permission[] {
  if (!user) return [];

  // Super-admin has everything
  if (user.role === 'super-admin') {
    return Object.keys(ROLE_DEFAULTS) as Permission[];
  }

  const result = new Set<Permission>();

  // Add role defaults
  for (const [permission, roles] of Object.entries(ROLE_DEFAULTS)) {
    if (roles.has(user.role)) {
      result.add(permission as Permission);
    }
  }

  // Add individual grants
  for (const grant of (user.permissions ?? [])) {
    result.add(grant);
  }

  return [...result];
}