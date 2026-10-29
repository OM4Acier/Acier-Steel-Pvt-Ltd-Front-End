'use client';

/**
 * app/users/components/GrantsSection.tsx
 *
 * Per-user permission GRANTS, layered on top of whatever the role already
 * grants. Role is the unit — changing it changes everything at once. This
 * section only adds or removes the EXTRAS.
 *
 * ── Why "extras only" is a correctness rule, not a UI convention ────────────
 *
 * Grants are stored as a strict subset of what the role does NOT already grant.
 * If role defaults were sent as grants too, then demoting someone from `sales`
 * to `viewer` would leave a stale `orders:create` grant behind and they would
 * keep a permission their new role should never have had.
 *
 * So: a permission the role already grants is shown CHECKED and DISABLED — it
 * cannot be unchecked here because removing it means changing the ROLE, which
 * is the dropdown above.
 *
 * ── Role defaults are resolved with canRole(), not ROLE_PERMISSIONS[role] ────
 *
 * canRole() short-circuits `super-admin` to true for every permission. A direct
 * `ROLE_PERMISSIONS[role]` lookup would find nothing for super-admin (it is
 * deliberately not a key in that map) and render a super-admin target as having
 * zero defaults — offering to grant permissions they already hold in full.
 * canRole is the same resolver the guard and RoleGate use, so what this dialog
 * shows always matches what the app will actually enforce.
 */

import { useMemo } from 'react';
import { ALL_PERMISSIONS, canRole, type NewPermission } from '@/lib/config/permissions';
import type { UserRole } from '@/types/user.types';

interface GrantsSectionProps {
  /** Role of the user being edited. Decides which boxes are locked. */
  role: UserRole;
  /** Current grants — EXTRAS ONLY. */
  grants: string[];
  /** Editing your own grants would let you self-escalate. */
  disabled: boolean;
  onChange: (next: string[]) => void;
}

/** Flat permission list → grouped by resource, preserving catalogue order. */
function groupByResource(perms: readonly NewPermission[]): [string, NewPermission[]][] {
  const out = new Map<string, NewPermission[]>();
  for (const p of perms) {
    const [resource] = p.split(':');
    const bucket = out.get(resource);
    if (bucket) bucket.push(p);
    else out.set(resource, [p]);
  }
  return [...out.entries()];
}

export function GrantsSection({ role, grants, disabled, onChange }: GrantsSectionProps) {
  const byResource = useMemo(() => groupByResource(ALL_PERMISSIONS), []);

  // Role defaults — what the target already has without any grant.
  // Unknown/dead roles (admin, manager, viewer, editor) have no defaults here,
  // which is correct: they grant nothing today.
  const roleDefaults = useMemo(
    () => new Set(ALL_PERMISSIONS.filter((p) => canRole(role, p))),
    [role],
  );

  const toggle = (perm: NewPermission, checked: boolean) => {
    if (roleDefaults.has(perm)) return; // role-owned, not grant-owned
    onChange(
      checked ? [...grants, perm] : grants.filter((g) => g !== perm),
    );
  };

  return (
    <div className="col-span-2 space-y-3 pt-2 border-t border-gray-100 dark:border-gray-700">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Extra Permissions
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Grants on top of what <span className="font-medium capitalize">{role.replace('-', ' ')}</span>{' '}
          already has. Anything already granted by the role is locked — change the
          role above to alter it.
        </p>
      </div>

      <div className="max-h-[260px] overflow-y-auto pr-2 space-y-3 dialog-custom-scrollbar">
        {byResource.map(([resource, perms]) => (
          <fieldset key={resource} className="space-y-1">
            <legend className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              {resource}
            </legend>
            {perms.map((perm) => {
              const fromRole = roleDefaults.has(perm);
              const extra = grants.includes(perm);
              const locked = fromRole || disabled;
              return (
                <label
                  key={perm}
                  className={`flex items-center gap-2 text-xs ${
                    disabled ? 'opacity-50' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={fromRole || extra}
                    disabled={locked}
                    onChange={(e) => toggle(perm, e.target.checked)}
                    className="rounded border-gray-300 disabled:cursor-not-allowed"
                  />
                  <span className={fromRole ? 'text-gray-400 dark:text-gray-500' : ''}>
                    {perm.split(':')[1]}
                  </span>
                  {fromRole && (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">(role)</span>
                  )}
                </label>
              );
            })}
          </fieldset>
        ))}
      </div>

      <p className="text-[10px] text-gray-400 dark:text-gray-500">
        {grants.length} extra grant{grants.length === 1 ? '' : 's'} saved for this user.
      </p>
    </div>
  );
}