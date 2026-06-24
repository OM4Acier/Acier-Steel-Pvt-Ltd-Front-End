// pdfConfig.ts — Order PDF field configuration & role-based visibility

import { UserRole } from '@/types/rbac.types';

// ──────────────────────────────────────────────────────────────────
// Field definition
// ──────────────────────────────────────────────────────────────────
export interface PdfFieldConfig {
  id: string;
  label: string;
  category: 'client' | 'product' | 'delivery' | 'invoice' | 'status';
  /** Shown by default when no super-admin config is stored */
  defaultVisible: boolean;
  /** Roles that are ALLOWED to see this field at all */
  visibleForRoles: UserRole[];
}

export const PDF_FIELDS: PdfFieldConfig[] = [
  // ── Client ─────────────────────────────────────────────────────
  {
    id: 'deoNo',
    label: 'Order No.',
    category: 'client',
    defaultVisible: true,
    visibleForRoles: ['super-admin', 'sales', 'operations', 'accountant'],
  },
  {
    id: 'client',
    label: 'Client Name',
    category: 'client',
    defaultVisible: true,
    visibleForRoles: ['super-admin', 'sales', 'operations', 'accountant'],
  },
  {
    id: 'contactNo',
    label: 'Contact No.',
    category: 'client',
    defaultVisible: true,
    visibleForRoles: ['super-admin', 'sales', 'accountant'],
  },
  {
    id: 'organizationContact',
    label: 'Org. Contact',
    category: 'client',
    defaultVisible: false,
    visibleForRoles: ['super-admin', 'sales', 'accountant'],
  },
  {
    id: 'orderDate',
    label: 'Order Date',
    category: 'client',
    defaultVisible: true,
    visibleForRoles: ['super-admin', 'sales', 'operations', 'accountant'],
  },
  // ── Status ─────────────────────────────────────────────────────
  {
    id: 'status',
    label: 'Order Status',
    category: 'status',
    defaultVisible: true,
    visibleForRoles: ['super-admin', 'sales', 'operations', 'accountant'],
  },
  {
    id: 'customerPaymentStatus',
    label: 'Payment Status',
    category: 'status',
    defaultVisible: true,
    visibleForRoles: ['super-admin', 'sales', 'accountant'],
  },
  {
    id: 'isHighPriority',
    label: 'High Priority',
    category: 'status',
    defaultVisible: true,
    visibleForRoles: ['super-admin', 'sales', 'operations'],
  },
  {
    id: 'partDelivery',
    label: 'Part Delivery',
    category: 'status',
    defaultVisible: false,
    visibleForRoles: ['super-admin', 'sales', 'operations'],
  },
  // ── Product ────────────────────────────────────────────────────
  {
    id: 'products',
    label: 'Product Description',
    category: 'product',
    defaultVisible: true,
    visibleForRoles: ['super-admin', 'sales', 'operations', 'accountant'],
  },
  // ── Delivery ───────────────────────────────────────────────────
  {
    id: 'vehicleNo',
    label: 'Vehicle No.',
    category: 'delivery',
    defaultVisible: true,
    visibleForRoles: ['super-admin', 'operations', 'sales'],
  },
  {
    id: 'weightScaleType',
    label: 'Weight Scale Type',
    category: 'delivery',
    defaultVisible: true,
    visibleForRoles: ['super-admin', 'operations'],
  },
  {
    id: 'transportProvider',
    label: 'Transport Provider',
    category: 'delivery',
    defaultVisible: true,
    visibleForRoles: ['super-admin', 'operations'],
  },
  {
    id: 'siteDeliveryInfo',
    label: 'Site Delivery Info',
    category: 'delivery',
    defaultVisible: false,
    visibleForRoles: ['super-admin', 'sales', 'accountant'],
  },
  // ── Invoice ────────────────────────────────────────────────────
  {
    id: 'invoiceNo',
    label: 'Invoice No.',
    category: 'invoice',
    defaultVisible: true,
    visibleForRoles: ['super-admin', 'sales', 'accountant'],
  },
  {
    id: 'invoiceDetails',
    label: 'Invoice Notes',
    category: 'invoice',
    defaultVisible: true,
    visibleForRoles: ['super-admin', 'sales', 'accountant'],
  },
];

// ──────────────────────────────────────────────────────────────────
// Storage helpers
// ──────────────────────────────────────────────────────────────────
export const PDF_CONFIG_STORAGE_KEY = 'order-pdf-field-config-v1';

export type PdfFieldVisibilityMap = Record<string, boolean>;

/** Loads super-admin's saved config; falls back to `defaultVisible` values */
export function loadSuperAdminPdfConfig(): PdfFieldVisibilityMap {
  try {
    const raw = localStorage.getItem(PDF_CONFIG_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PdfFieldVisibilityMap;
  } catch {
    // ignore
  }
  const defaults: PdfFieldVisibilityMap = {};
  PDF_FIELDS.forEach((f) => {
    defaults[f.id] = f.defaultVisible;
  });
  return defaults;
}

export function saveSuperAdminPdfConfig(config: PdfFieldVisibilityMap): void {
  localStorage.setItem(PDF_CONFIG_STORAGE_KEY, JSON.stringify(config));
}

// ──────────────────────────────────────────────────────────────────
// Role-based visibility resolver
// ──────────────────────────────────────────────────────────────────

/**
 * Returns the final field visibility map for a given role.
 *
 * - super-admin  → controlled by their saved config
 * - other roles  → role's allowed fields ∩ defaultVisible
 *
 * @param role              The current user's role
 * @param superAdminConfig  The super-admin's saved config (only used when role = super-admin)
 */
export function getEffectiveFieldVisibility(
  role: UserRole,
  superAdminConfig?: PdfFieldVisibilityMap,
): PdfFieldVisibilityMap {
  const map: PdfFieldVisibilityMap = {};

  for (const field of PDF_FIELDS) {
    const isRoleAllowed = field.visibleForRoles.includes(role);

    if (role === 'super-admin') {
      // Super-admin: use their config (or field default if config key missing)
      map[field.id] = superAdminConfig
        ? (superAdminConfig[field.id] ?? field.defaultVisible)
        : field.defaultVisible;
    } else {
      // Other roles: field must be allowed for role AND default-visible
      map[field.id] = isRoleAllowed && field.defaultVisible;
    }
  }

  return map;
}
