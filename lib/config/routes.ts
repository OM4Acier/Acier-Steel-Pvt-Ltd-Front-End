/**
 * lib/config/routes.ts
 * Create shortcut and NavBar
 * Single source of truth for routes, roles, nav labels, icons, and colors.
 *
 * Color system:
 *   navColor is a design token string. The NavBar resolves it to Tailwind
 *   classes via NAV_COLOR_MAP (defined in NavBar.tsx).
 *   Storing raw Tailwind strings here would break tree-shaking — tokens don't.
 *
 * Icon system:
 *   Icons are direct LucideIcon component references.
 *   To add an icon: import it here, reference it in the entry.
 *   Zero other files change.
 *
 * Consumers:
 *   shortcut
 *   NavBar            → getNavItems(role)
 *   AppShell/useSession → matchRoute(pathname), roleCanAccess()
 */

import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Briefcase,
  ShoppingCart,
  TrendingUp,
  ListTodo,
  BarChart3,
  Users,
  UserPlus,
  CheckCircle2,
  Package,
  FileText,
  ShoppingBag,
  User,
} from 'lucide-react';
import type { UserRole } from '@/types/rbac.types';
import { NavColor } from './colors';

// ---------------------------------------------------------------------------
// Color token type — add a new value here when you need a new color
// ---------------------------------------------------------------------------



// ---------------------------------------------------------------------------
// Route shape
// ---------------------------------------------------------------------------

export interface RouteConfig {
  /** Exact path. matchRoute() also prefix-matches nested routes. */
  path: string;
  /** Roles that may access this route. Empty = any authenticated user. */
  allowedRoles: UserRole[];
  /** Redirect target when authenticated but role doesn't match. */
  unauthorizedRedirect: string;
  /** Nav label — omit to hide from menus. */
  label?: string;
  /** Direct lucide-react component. No separate icon map needed. */
  icon?: LucideIcon;
  /** Color token resolved by NavBar's NAV_COLOR_MAP. */
  navColor?: NavColor;
  /** Include in nav menus. */
  showInNav?: boolean;
  /** Sort order. Lower = higher. Default 99. */
  navOrder?: number;
  /** Optional badge next to the label ("New", "Beta"). */
  navBadge?: string;
}

// ---------------------------------------------------------------------------
// Named route constants
// ---------------------------------------------------------------------------

export const ROUTES = {
  LOGIN:           '/login',
  FORGOT_PASSWORD: '/forgot-password',
  HOME:            '/',
  ATTENDANCE:      '/attendance',
  ORDERS:          '/orders',
  PURCHASES:       '/purchases',
  LEADS_CENTER:    '/leads-center',
  LEADS:           '/leads',
  TASKS:           '/tasks',
  USERS:           '/users',
  VISITORS:        '/visitors',
  REPORTS:          '/reports',
  INVENTROTY:       '/inventory',
  ACCOUNT:          '/account',
  } as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

// ---------------------------------------------------------------------------
// Public paths — no auth check
// ---------------------------------------------------------------------------

export const PUBLIC_PATHS: string[] = [
  ROUTES.LOGIN,
  ROUTES.FORGOT_PASSWORD,
];

// ---------------------------------------------------------------------------
// THE REGISTRY
// ---------------------------------------------------------------------------

export const PROTECTED_ROUTES: RouteConfig[] = [
  {
    path:                 '/',
    allowedRoles:         ['super-admin', 'sales', 'accountant', 'operations', 'purchase-entry'],
    unauthorizedRedirect: ROUTES.LOGIN,
    label:                'Dashboard',
    icon:                 LayoutDashboard,
    navColor:             'blue',
    showInNav:            true,
    navOrder:             1,
  },
  {
    path:                 '/attendance',
    allowedRoles:         ['super-admin', 'sales', 'accountant', 'operations', 'purchase-entry'],
    unauthorizedRedirect: ROUTES.LOGIN,
    label:                'Attendance',
    icon:                 CheckCircle2,
    navColor:             'green',
    showInNav:            true,
    navOrder:             2,

  },
  {
    path:                 '/orders',
    allowedRoles:         ['super-admin', 'sales', 'accountant', 'operations'],
    unauthorizedRedirect: ROUTES.LOGIN,
    label:                'Orders',
    icon:                 Briefcase,
    navColor:             'emerald',
    showInNav:            true,
    navOrder:             3,
  },
  {
    path:                 'https://mytaskacier.web.app/',
    allowedRoles:         ['super-admin', 'sales', 'accountant', 'operations', 'purchase-entry'],
    unauthorizedRedirect: ROUTES.LOGIN,
    label:                'One Time Work',
    icon:                 ListTodo,
    navColor:             'violet',
    showInNav:            true,
    navOrder:             4,
  },
  {
    path:                 '/leads-center',
    allowedRoles:         ['super-admin', 'sales'],
    unauthorizedRedirect: ROUTES.LOGIN,
    label:                'Leads Center',
    icon:                 BarChart3,
    navColor:             'amber',
    showInNav:            true,
    navOrder:             5,
  },
  {
    path:                 '/leads',
    allowedRoles:         ['super-admin', 'sales'],
    unauthorizedRedirect: ROUTES.LOGIN,
    label:                'Leads',
    icon:                 TrendingUp,
    navColor:             'red',
    showInNav:            true,
    navOrder:             6,
  },
  {
    path:                 '/purchases',
    allowedRoles:         [ 'accountant', 'purchase-entry', 'operations'],
    unauthorizedRedirect: ROUTES.LOGIN,
    label:                'Purchases',
    icon:                 ShoppingCart,
    navColor:             'fuchsia',
    showInNav:            true,
    navOrder:             7,
  },
  {
    path:                 '/visitors',
    allowedRoles:         ['super-admin', 'sales', 'accountant', 'operations', 'purchase-entry'],
    unauthorizedRedirect: ROUTES.LOGIN,
    label:                'Visitor Records',
    icon:                 UserPlus,
    navColor:             'teal',
    showInNav:            true,
    navOrder:             8,
  },
  {
    path:                 '/reports',
    allowedRoles:         ['super-admin'],
    unauthorizedRedirect: ROUTES.HOME,
    label:                'Reports',
    icon:                 BarChart3,
    navColor:             'gray',
    showInNav:            true,
    navOrder:             9,
  },
  {
    path:                 ROUTES.USERS,
    allowedRoles:         ['super-admin'],
    unauthorizedRedirect: ROUTES.HOME,
    label:                'Users',
    icon:                 Users,
    navColor:             'indigo',
    showInNav:            true,
    navOrder:             10,
  },
  {
    path:                 '/customers',
    allowedRoles:         ['super-admin', 'accountant','sales'],
    unauthorizedRedirect: ROUTES.HOME,
    label:                'Customer',
    icon:                 Package,
    navColor:             'cyan', // Updated to Cyan
    showInNav:            true,
    navOrder:             11,
    navBadge:             'New',
  },
  {
    path:                 ROUTES.ACCOUNT,
    allowedRoles:         [], // any authenticated user
    unauthorizedRedirect: ROUTES.LOGIN,
    label:                'Account',
    icon:                 User,
    showInNav:            false,
  },
];


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname);
}

export function matchRoute(pathname: string): RouteConfig | undefined {
  const exact = PROTECTED_ROUTES.find((r) => r.path === pathname);
  if (exact) return exact;
  return PROTECTED_ROUTES.find(
    (r) => !r.path.includes('?') && pathname.startsWith(r.path + '/')
  );
}

export function roleCanAccess(route: RouteConfig, role: UserRole): boolean {
  if (role === 'super-admin') return true;
  if (route.allowedRoles.length === 0) return true;
  return route.allowedRoles.includes(role);
}

/** All nav items visible to role, sorted by navOrder. */
export function getNavItems(role: UserRole): RouteConfig[] {
  return PROTECTED_ROUTES
    .filter((r) => r.showInNav && r.label && roleCanAccess(r, role))
    .sort((a, b) => (a.navOrder ?? 99) - (b.navOrder ?? 99));
}



// ---------------------------------------------------------------------------
// Create shortcut shape
// ---------------------------------------------------------------------------

export interface CreateShortcut {
  id:           string;
  label:        string;
  icon:         LucideIcon;
  /** Navigate to this path on click */
  path:         string;
  /**
   * When set, appends ?action=<value> to the URL.
   * Target page reads searchParams.get('action') === 'create' to auto-open
   * its create dialog. Also makes the URL deep-linkable.
   */
  actionParam?: string;
  allowedRoles: UserRole[];
  /** Same NavColor token as routes.ts — resolved by NAV_COLOR_MAP */
  color:        NavColor;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const CREATE_SHORTCUTS: CreateShortcut[] = [
  {
    id:           'order',
    label:        'New Order',
    icon:         ShoppingCart,
    path:         '/orders',
    actionParam:  'create',
    allowedRoles: ['super-admin', 'sales'],
    color:        'blue',
  },
  {
    id:           'purchase',
    label:        'New Purchase',
    icon:         Package,
    path:         '/purchases',
    actionParam:  'create',
    allowedRoles: ['super-admin', 'accountant', 'purchase-entry'],
    color:        'fuchsia',
  },
  {
    id:           'task',
    label:        'New Task',
    icon:         ListTodo,
    path:         'https://mytaskacier.web.app/',
    actionParam:  'create',
    allowedRoles: ['super-admin','accountant'],
    color:        'violet',
  },
  {
    id:           'lead',
    label:        'New Lead',
    icon:         TrendingUp,
    path:         '/leads',
    actionParam:  'create',
    allowedRoles: ['super-admin', 'sales'],
    color:        'amber',
  },
  {
    id:           'visitor',
    label:        'Visitor Record',
    icon:         UserPlus,
    path:         '/visitors',
    actionParam:  'create',
    allowedRoles: ['super-admin', 'sales', 'accountant', 'operations', 'purchase-entry'],
    color:        'teal',
  },
  {
    id:           'customer',
    label:        'Customer Record',
    icon:         Package,           // Relevant to stock/warehouse
    path:         '/customers',
    actionParam:  'create',
    allowedRoles: ['super-admin', 'sales', 'accountant'],
    color:        'cyan',            // Distinct from Emerald Orders
  },
  {
    id:           'Purchase_Record',
    label:        'Purchase Record (External)',
    icon:         ShoppingBag,       // Distinct from internal Purchases
    path:         'https://acier-steel-pvt-ltd.web.app/purchase-entry.html',
    allowedRoles: ['super-admin', 'accountant', 'purchase-entry'],
    color:        'rose',            // Warm color for external finance
  },
  {
    id:           'Quotation',
    label:        'Quotation Record (External)',
    icon:         FileText,          // Standard for quotes/proposals
    path:         'https://acier-steel-pvt-ltd.web.app/quotation.html',
    allowedRoles: ['super-admin', 'sales', 'accountant', 'purchase-entry'],
    color:        'orange',          // High visibility for sales documents
  },
];

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

export function getCreateShortcuts(role: UserRole): CreateShortcut[] {
  return CREATE_SHORTCUTS.filter(
    (s) => s.allowedRoles.length === 0 || s.allowedRoles.includes(role)
  );
}
