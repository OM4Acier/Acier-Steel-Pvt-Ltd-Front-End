'use client';

/**
 * components/RBAC/RoleGate.tsx
 *
 * ROLE-AXIS gate (F3). Hides or disables its children unless the current user's
 * role holds the named permission.
 *
 * ── Why this is NOT named PermissionGate ────────────────────────────────────
 *
 * There are two orthogonal permission axes in this codebase and they are
 * deliberately given different names so no call site can be misread:
 *
 *   Axis       Component                     Props                        Source
 *   ─────────  ────────────────────────────  ────────────────────────────  ───────────────────
 *   Manifest   components/PermissionGate     module + field | section      GET /permissions
 *   Role       components/RBAC/RoleGate      need                          publicMetadata.role
 *
 * components/PermissionGate.tsx is LIVE — 26 call sites across app/orders.
 * Do not rename or repurpose it. This file is the role-axis layer only.
 *
 * ── UI-only caveat ──────────────────────────────────────────────────────────
 *
 * Hiding a button does not stop anyone from calling the endpoint directly.
 * Static export cannot enforce anything server-side. The backend is the real
 * gate; this is UX. See the master plan's risk table.
 */

import type { ReactNode } from 'react';
import { useCanDo } from '@/hooks/useCanDo';
import type { NewPermission } from '@/lib/config/permissions';

interface RoleGateProps {
  /** Permission required. Literal string; the union catches typos. */
  need: NewPermission;
  /**
   * 'hide'    — render nothing (or `fallback`) when denied.
   * 'disable' — render children greyed out and non-interactive when denied.
   *
   * Use 'disable' when the action belongs to a flow the user already knows
   * about, so its absence would read as a bug rather than a restriction.
   */
  mode?: 'hide' | 'disable';
  /** Shown instead of children when denied and mode is 'hide'. */
  fallback?: ReactNode;
  children: ReactNode;
}

export function RoleGate({
  need,
  mode = 'hide',
  fallback = null,
  children,
}: RoleGateProps) {
  const ok = useCanDo(need);

  if (ok) return <>{children}</>;

  if (mode === 'disable') {
    return (
      <div aria-disabled="true" className="pointer-events-none opacity-50">
        {children}
      </div>
    );
  }

  return <>{fallback}</>;
}

export default RoleGate;