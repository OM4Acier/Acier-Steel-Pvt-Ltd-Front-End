/**
 * lib/config/permissions.ts
 *
 * System permission definitions — the complete catalogue of what can be controlled.
 *
 * Two things live here:
 *   1. SYSTEM_PERMISSIONS — every permission string the app knows about,
 *      organised by system, with a human label for the admin UI
 *   2. ROLE_DEFAULTS — which roles can perform which actions by default,
 *      without needing an individual grant
 *
 * The three-layer check order (see canDo() in lib/auth/access.ts):
 *   Layer 0 — super-admin? → always allow
 *   Layer 1 — role in ROLE_DEFAULTS[permission]? → allow
 *   Layer 2 — user.grants includes permission? → allow
 *   Otherwise → deny
 *
 * Adding a new system:
 *   1. Add its permission strings to SYSTEM_PERMISSIONS below
 *   2. Add role defaults to ROLE_DEFAULTS
 *   Done. The admin grant UI and canDo() pick them up automatically.
 *
 * Naming convention: "system:action"
 *   system  → the domain (orders, purchases, tasks, leads, visitors, reports)
 *   action  → the verb (create, approve, edit-invoice, dispatch, delete, assign)
 */

import type { UserRole } from '@/types/rbac.types';

// ---------------------------------------------------------------------------
// Permission string union type
// Keeps TypeScript strict — you can't pass a typo to canDo()
// ---------------------------------------------------------------------------

export type Permission =
  // Orders
  | 'orders:create'
  | 'orders:edit'
  | 'orders:edit-invoice'
  | 'orders:approve'
  | 'orders:dispatch'
  | 'orders:complete'
  | 'orders:cancel'
  | 'orders:delete'
  // Purchases
  | 'purchases:create'
  | 'purchases:edit'
  | 'purchases:approve'
  | 'purchases:cancel'
  | 'purchases:delete'
  // Tasks
  | 'tasks:create'
  | 'tasks:edit'
  | 'tasks:assign'
  | 'tasks:delete'
  // Leads
  | 'leads:create'
  | 'leads:edit'
  | 'leads:delete'
  | 'leads:convert'
  // Visitors
  | 'visitors:create'
  | 'visitors:edit'
  | 'visitors:delete'
  // Reports
  | 'reports:view'
  | 'reports:export'
  // Users (admin)
  | 'users:manage';

// ---------------------------------------------------------------------------
// Catalogue used by the admin grant UI to list available permissions
// ---------------------------------------------------------------------------

export interface PermissionMeta {
  permission: Permission;
  system:     string;
  label:      string;
  description: string;
  /** Roles that have this permission by default (shown as "default" in admin UI) */
  defaultRoles: UserRole[];
}

export const SYSTEM_PERMISSIONS: PermissionMeta[] = [
  // ── Orders ────────────────────────────────────────────────────────────────
  { permission: 'orders:create',       system: 'orders',    label: 'Create order',       description: 'Open new orders in the system',                    defaultRoles: ['super-admin', 'sales'] },
  { permission: 'orders:edit',         system: 'orders',    label: 'Edit order',         description: 'Edit client, products, contact fields',            defaultRoles: ['super-admin', 'sales'] },
  { permission: 'orders:edit-invoice', system: 'orders',    label: 'Edit invoice',       description: 'Edit invoice details and invoice number',          defaultRoles: ['super-admin', 'accountant'] },
  { permission: 'orders:approve',      system: 'orders',    label: 'Approve order',      description: 'Move order from Created → Approved for Production', defaultRoles: ['super-admin'] },
  { permission: 'orders:dispatch',     system: 'orders',    label: 'Dispatch order',     description: 'Move order to Dispatched and Invoiced',            defaultRoles: ['super-admin', 'operations'] },
  { permission: 'orders:complete',     system: 'orders',    label: 'Complete order',     description: 'Mark order as Completed',                          defaultRoles: ['super-admin', 'accountant'] },
  { permission: 'orders:cancel',       system: 'orders',    label: 'Cancel order',       description: 'Cancel an active order',                           defaultRoles: ['super-admin'] },
  { permission: 'orders:delete',       system: 'orders',    label: 'Delete order',       description: 'Permanently remove an order',                      defaultRoles: ['super-admin'] },
  // ── Purchases ─────────────────────────────────────────────────────────────
  { permission: 'purchases:create',    system: 'purchases', label: 'Create purchase',    description: 'Create new purchase orders',                       defaultRoles: ['super-admin', 'purchase-entry', 'operations'] },
  { permission: 'purchases:edit',      system: 'purchases', label: 'Edit purchase',      description: 'Edit purchase order fields',                       defaultRoles: ['super-admin', 'purchase-entry', 'operations'] },
  { permission: 'purchases:approve',   system: 'purchases', label: 'Approve purchase',   description: 'Approve pending purchase orders',                  defaultRoles: ['super-admin', 'accountant'] },
  { permission: 'purchases:cancel',    system: 'purchases', label: 'Cancel purchase',    description: 'Cancel a purchase order',                          defaultRoles: ['super-admin'] },
  { permission: 'purchases:delete',    system: 'purchases', label: 'Delete purchase',    description: 'Permanently remove a purchase order',              defaultRoles: ['super-admin'] },
  // ── Tasks ─────────────────────────────────────────────────────────────────
  { permission: 'tasks:create',        system: 'tasks',     label: 'Create task',        description: 'Create new tasks',                                 defaultRoles: ['super-admin', 'operations', 'sales'] },
  { permission: 'tasks:edit',          system: 'tasks',     label: 'Edit task',          description: 'Edit task title, description, due date',           defaultRoles: ['super-admin', 'operations'] },
  { permission: 'tasks:assign',        system: 'tasks',     label: 'Assign task',        description: 'Assign tasks to other users',                      defaultRoles: ['super-admin', 'operations'] },
  { permission: 'tasks:delete',        system: 'tasks',     label: 'Delete task',        description: 'Delete tasks',                                     defaultRoles: ['super-admin'] },
  // ── Leads ─────────────────────────────────────────────────────────────────
  { permission: 'leads:create',        system: 'leads',     label: 'Create lead',        description: 'Create new leads',                                 defaultRoles: ['super-admin', 'sales'] },
  { permission: 'leads:edit',          system: 'leads',     label: 'Edit lead',          description: 'Edit lead details',                                defaultRoles: ['super-admin', 'sales'] },
  { permission: 'leads:convert',       system: 'leads',     label: 'Convert lead',       description: 'Convert lead to an order',                         defaultRoles: ['super-admin', 'sales'] },
  { permission: 'leads:delete',        system: 'leads',     label: 'Delete lead',        description: 'Delete a lead permanently',                        defaultRoles: ['super-admin'] },
  // ── Visitors ──────────────────────────────────────────────────────────────
  { permission: 'visitors:create',     system: 'visitors',  label: 'Create visitor',     description: 'Log new visitor records',                          defaultRoles: ['super-admin', 'sales', 'operations', 'accountant', 'purchase-entry'] },
  { permission: 'visitors:edit',       system: 'visitors',  label: 'Edit visitor',       description: 'Edit visitor records',                             defaultRoles: ['super-admin', 'sales'] },
  { permission: 'visitors:delete',     system: 'visitors',  label: 'Delete visitor',     description: 'Delete visitor records',                           defaultRoles: ['super-admin'] },
  // ── Reports ───────────────────────────────────────────────────────────────
  { permission: 'reports:view',        system: 'reports',   label: 'View reports',       description: 'Access the reports dashboard',                     defaultRoles: ['super-admin', 'accountant'] },
  { permission: 'reports:export',      system: 'reports',   label: 'Export reports',     description: 'Download report data as CSV/PDF',                  defaultRoles: ['super-admin'] },
  // ── Users (admin) ─────────────────────────────────────────────────────────
  { permission: 'users:manage',        system: 'users',     label: 'Manage users',       description: 'Create, edit, delete user accounts and grants',    defaultRoles: ['super-admin'] },
];

// ---------------------------------------------------------------------------
// ROLE_DEFAULTS — derived from SYSTEM_PERMISSIONS for fast lookup
// Built once at import time; no runtime cost on each canDo() call.
// ---------------------------------------------------------------------------

/**
 * Maps permission → set of roles that have it by default.
 * canDo() checks this before looking at individual grants.
 */
export const ROLE_DEFAULTS: Record<Permission, Set<UserRole>> = (() => {
  const map = {} as Record<Permission, Set<UserRole>>;
  for (const meta of SYSTEM_PERMISSIONS) {
    map[meta.permission] = new Set(meta.defaultRoles);
  }
  return map;
})();

// ---------------------------------------------------------------------------
// Helper: get all permissions for a system (used by admin grant UI)
// ---------------------------------------------------------------------------

export function getSystemPermissions(system: string): PermissionMeta[] {
  return SYSTEM_PERMISSIONS.filter((p) => p.system === system);
}

export function getAllSystems(): string[] {
  return [...new Set(SYSTEM_PERMISSIONS.map((p) => p.system))];
}