/**
 * components/RBAC/index.ts
 *
 * Barrel for the ROLE-axis permission layer (F3).
 *
 * Deliberately does NOT re-export components/PermissionGate.tsx. That is the
 * manifest axis, it lives at the components root, and it has 26 live call
 * sites. Import it directly from '@/components/PermissionGate' so the two axes
 * stay distinguishable at the import line.
 *
 * Usage:
 *   import { RoleGate } from '@/components/RBAC';
 *   import { PermissionGate } from '@/components/PermissionGate';
 */

export { RoleGate } from './RoleGate';