/**
 * lib/config/permissions.ts
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PHASE F1 — ADDITIVE. READ THIS BEFORE EDITING.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * This file now contains TWO permission models. That is deliberate and
 * temporary. The F2 commit collapses them.
 *
 *   PART 1 (legacy, lines above)  — `SYSTEM_PERMISSIONS`, `ROLE_DEFAULTS`, and
 *       the `Permission` string union of 27 hand-written verbs. Still LIVE:
 *       lib/auth/access.ts imports `Permission` + `ROLE_DEFAULTS` from here and
 *       canDo() runs on it. Do not delete any of it in this commit.
 *
 *   PART 2 (new, below)          — `RESOURCES` (11), the resource:action model,
 *       `ROLE_PERMISSIONS`, and `canRole()`. DEAD CODE until F2: nothing
 *       imports these yet, so they add zero runtime behaviour.
 *
 * Why two models coexist: `Permission` is a flat string union, so replacing it
 * with a template-literal type in the same commit that introduces the new model
 * would break every existing consumer in the same PR. The two-model state keeps
 * F1 green and makes F2 a mechanical, reviewable flip.
 *
 * ── The two models are NOT equivalent. Do not assume so. ────────────────────
 *
 * The 27 legacy verbs are NOT CRUD, which is why the new model keeps lifecycle
 * verbs as first-class actions rather than folding them into `write`:
 *
 *   orders:edit-invoice   a field-scope gate, narrower than orders:edit
 *   orders:approve        order-state transition, super-admin only today
 *   orders:dispatch       operations only today
 *   orders:complete       accountant only today
 *   orders:cancel         super-admin only today
 *   tasks:assign          delegation; `tasks:edit` is operations-only while
 *                         `tasks:create` includes sales — that asymmetry is
 *                         load-bearing and a flat `tasks:write` destroys it
 *   leads:convert         lead → order pipeline
 *   reports:export        super-admin only (no UI consumes it yet)
 *   users:manage          the admin plane
 *
 * Collapsing any of these into `update` grants the holder strictly more than
 * they have today. See ROLE_PERMISSIONS below for the 1:1 mapping.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * OLD HEADER (legacy model, retained verbatim for the F2 diff):
 *
 *  * lib/config/permissions.ts
 *  *
 *  * System permission definitions — the complete catalogue of what can be controlled.
 *  *
 *  * Two things live here:
 *  *   1. SYSTEM_PERMISSIONS — every permission string the app knows about,
 *  *      organised by system, with a human label for the admin UI
 *  *   2. ROLE_DEFAULTS — which roles can perform which actions by default,
 *  *      without needing an individual grant
 *  *
 *  * The three-layer check order (see canDo() in lib/auth/access.ts):
 *  *   Layer 0 — super-admin? → always allow
 *  *   Layer 1 — role in ROLE_DEFAULTS[permission]? → allow
 *  *   Layer 2 — user.grants includes permission? → allow
 *  *   Otherwise → deny
 *  *
 *  * Adding a new system:
 *  *   1. Add its permission strings to SYSTEM_PERMISSIONS below
 *  *   2. Add role defaults to ROLE_DEFAULTS
 *  *   Done. The admin grant UI and canDo() pick them up automatically.
 *  *
 *  * Naming convention: "system:action"
 *  *   system  → the domain (orders, purchases, tasks, leads, visitors, reports)
 *  *   action  → the verb (create, approve, edit-invoice, dispatch, delete, assign)
 */

import type { UserRole } from '@/types/rbac.types'; // PART 1 (legacy) — also used by PART 2

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

// ===========================================================================
// PART 2 — NEW RESOURCE:ACTION MODEL (F1, additive, not yet wired)
// ===========================================================================

// NOTE: UserRole is already imported at the top of this file (from
// '@/types/rbac.types', which re-exports it from '@/types/user.types'). Do not
// re-import it here.

// ---------------------------------------------------------------------------
// Resources — 11. Merges the 7 systems in ./permissions.ts with the modules
// that only ever existed in types/permissions.ts AppModule, plus sheet-history
// which existed in neither.
// ---------------------------------------------------------------------------

export const RESOURCES = [
  'orders',
  'purchases',
  'tasks',
  'leads',
  'leads-center',
  'customers',
  'attendance',
  'visitors',
  'reports',
  'users',
  'sheet-history',
] as const;

export type Resource = (typeof RESOURCES)[number];

// ---------------------------------------------------------------------------
// Actions. `read` is universal; the rest are opt-in per resource because a
// permission that no code checks is a permission that cannot be audited.
// ---------------------------------------------------------------------------

export const ACTIONS = ['read', 'create', 'update', 'delete'] as const;

export const LIFECYCLE_ACTIONS = [
  'approve',
  'dispatch',
  'complete',
  'cancel',
  'assign',
  'convert',
  'claim',
  'export',
  'manage',
  'edit-invoice',
] as const;

export type Action = (typeof ACTIONS)[number];
export type LifecycleAction = (typeof LIFECYCLE_ACTIONS)[number];

/**
 * The union of pairs that actually exist. Built from RESOURCE_ACTIONS below so
 * the type cannot drift from the data.
 */
export type NewPermission = `${Resource}:${Action | LifecycleAction}`;

/**
 * Which actions each resource genuinely supports, verified against the
 * endpoint layer rather than assumed:
 *
 * - orders      9 verbs. Full lifecycle; the only resource with dispatch/complete.
 * - purchases   6 verbs. approve+cancel mirror orders but there is no dispatch step.
 * - tasks       5 verbs. `assign` is delegation, not CRUD — operators assign,
 *               sales may only create (this asymmetry is load-bearing).
 * - leads       6 verbs. `convert` moves a lead into an order. `export` exists
  *               because app/leads/page.tsx builds a CSV client-side — it was
  *               previously ungated for every role that could reach /leads.
  *               DECIDED: super-admin only. The CSV exports the entire lead
  *               list, so it is treated as a data-egress action rather than a
  *               read action. See ROLE_PERMISSIONS.sales.
  * - leads-center read + claim only. The endpoint exposes getUserAccess,
  *               getLeadsCenterLeads, getLeadsCenterDetail and claimLead.
  *               There is NO create and NO update — "create" here means claiming
  *               an existing lead, which is why it is modelled as `claim`.
  * - customers   read/create/update/delete. customersApi has deleteCustomer,
  *               which was previously ungated for anyone reaching /customers.
  *               DECIDED: delete is open to exactly three roles — super-admin
  *               (via the canRole short-circuit), accountant and sales. This
  *               matches current behaviour; it was reviewed and kept, not
  *               tightened.
 * - attendance  read + update. attendanceApi exposes getConfig, getStatus,
 *               login and logout — clock in/out is an update of the user's own
 *               record. There is no create: nobody creates attendance rows.
 * - visitors    read/create/update/delete.
 * - reports     read + export. reports:export existed in the current catalogue
 *               (super-admin only) but NO report UI consumes it — no CSV, no
 *               download anywhere under app/reports. The gate is real but the
 *               affordance does not exist yet.
 * - users       read + manage. Matches users:manage verbatim.
 * - sheet-history read only. app/sheet-history has no download, CSV or export
 *               path of any kind. `export` is therefore NOT included.
 */
export const RESOURCE_ACTIONS: Record<Resource, readonly NewPermission[]> = {
  orders: [
    'orders:read',
    'orders:create',
    'orders:update',
    'orders:delete',
    'orders:edit-invoice',
    'orders:approve',
    'orders:dispatch',
    'orders:complete',
    'orders:cancel',
  ],
  purchases: [
    'purchases:read',
    'purchases:create',
    'purchases:update',
    'purchases:delete',
    'purchases:approve',
    'purchases:cancel',
  ],
  tasks: [
    'tasks:read',
    'tasks:create',
    'tasks:update',
    'tasks:delete',
    'tasks:assign',
  ],
  leads: [
    'leads:read',
    'leads:create',
    'leads:update',
    'leads:delete',
    'leads:convert',
    'leads:export',
  ],
  'leads-center': ['leads-center:read', 'leads-center:claim'],
  customers: [
    'customers:read',
    'customers:create',
    'customers:update',
    'customers:delete',
  ],
  attendance: ['attendance:read', 'attendance:update'],
  visitors: [
    'visitors:read',
    'visitors:create',
    'visitors:update',
    'visitors:delete',
  ],
  reports: ['reports:read', 'reports:export'],
  users: ['users:read', 'users:manage'],
  'sheet-history': ['sheet-history:read'],
};

/** Flattened view of every permission that exists, for super-admin short-circuit. */
export const ALL_PERMISSIONS: readonly NewPermission[] = RESOURCES.flatMap(
  (r) => RESOURCE_ACTIONS[r],
);

// ---------------------------------------------------------------------------
// ROLE_PERMISSIONS — transcribed, not designed.
// ---------------------------------------------------------------------------

/**
 * `admin`, `manager`, `viewer` and `editor` are intentionally absent.
 *
 * They are declared in the UserRole union (types/user.types.ts) but appear in
 * no SYSTEM_PERMISSIONS defaultRoles list and no PROTECTED_ROUTES allowedRoles
 * list — so today they grant nothing. Their absence here reproduces that
 * exactly: canRole('manager', ...) === false for every permission.
 *
 * This is Option B from the plan (keep, deny all), NOT Option A (remove from
 * the union). Removing a member from the TypeScript union is cosmetic — it
 * changes nothing at runtime, where the role arrives as a string from Clerk's
 * publicMetadata. The real fix is a backend migration proving zero users hold
 * one of these roles, THEN the union edit. Doing the union edit first would
  * give false confidence.
 *
 * Note on reading this map: super-admin is NOT a key here. canRole()
 * short-circuits on it before consulting this table, so super-admin holds
 * every permission in ALL_PERMISSIONS — including leads:export, orders:delete,
 * reports:read and users:manage. Absence of a role key means "denied
 * everything", not "inherits from a parent".
 */
export const ROLE_PERMISSIONS: Partial<Record<UserRole, readonly NewPermission[]>> = {
  // ── orders ────────────────────────────────────────────────────────────────
  // read:     PROTECTED_ROUTES /orders → super-admin, sales, accountant, operations
  // create:   SYSTEM_PERMISSIONS → super-admin, sales
  // update:   orders:edit → super-admin, sales
  // edit-invoice / complete: super-admin, accountant
  // dispatch: super-admin, operations
  // approve / cancel / delete: super-admin only (via short-circuit, not listed)
  sales: [
    'orders:read', 'orders:create', 'orders:update',
    'purchases:read',
    'tasks:read', 'tasks:create',
    'leads:read', 'leads:create', 'leads:update', 'leads:convert',
    'leads-center:read', 'leads-center:claim',
    'customers:read', 'customers:create', 'customers:update', 'customers:delete',
    'attendance:read',
    'visitors:read', 'visitors:create', 'visitors:update',
    'sheet-history:read',
  ],
  // reports:read → super-admin, accountant
  // purchases:approve → super-admin, accountant
  // customers:delete → exactly three roles: super-admin, accountant, sales.
  // DECIDED (product owner): reviewed and kept at current behaviour, NOT
  // tightened. super-admin is granted via the canRole short-circuit above and
  // is deliberately absent from the map — do not add a redundant key for it.
  accountant: [
    'orders:read', 'orders:edit-invoice', 'orders:complete',
    'purchases:read', 'purchases:create', 'purchases:update', 'purchases:approve',
    'reports:read',
    'customers:read', 'customers:delete',
    'attendance:read',
    'visitors:read', 'visitors:create',
    'sheet-history:read',
  ],
  // tasks:update / tasks:assign → super-admin, operations
  // orders:dispatch → super-admin, operations
  // attendance:update → clock in/out (attendanceApi.login / logout)
  operations: [
    'orders:read', 'orders:dispatch',
    'purchases:read', 'purchases:create', 'purchases:update',
    'tasks:read', 'tasks:create', 'tasks:update', 'tasks:assign',
    'attendance:read', 'attendance:update',
    'visitors:read', 'visitors:create',
    'sheet-history:read',
  ],
  // read-only on purchases, attendance and visitors. Cannot create purchases:
  // SYSTEM_PERMISSIONS gives purchases:create to super-admin, purchase-entry
  // and operations only.
  'purchase-entry': [
    'purchases:read', 'purchases:create', 'purchases:update',
    'attendance:read',
    'visitors:read', 'visitors:create',
  ],
};

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

/**
 * The primitive. Pure, synchronous, total — takes a role STRING so it needs no
 * UserProfile and no `as any` cast at the call site.
 *
 * Deny-by-default on three axes: no role, unknown role, unknown permission.
 */
export function canRole(role: string | null | undefined, need: NewPermission): boolean {
  if (!role) return false;
  if (role === 'super-admin') return true;
  return ROLE_PERMISSIONS[role as UserRole]?.includes(need) ?? false;
}

/** Same axis as canRole, but asks about a whole resource (any action). */
export function canRoleRead(role: string | null | undefined, resource: Resource): boolean {
  return canRole(role, `${resource}:read`);
}

/** Dev-only divergence check for Phase 2b — see plan decision (f). */
export function rolesDisagree(clerkRole: string | null, apiRole: string | null): boolean {
  return !!clerkRole && !!apiRole && clerkRole !== apiRole;
}