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
  ShieldAlert,
  FileQuestion,
  LogIn,
  KeyRound,
  FlaskConical,
} from 'lucide-react';
import { canRole, type NewPermission } from './permissions';
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
  /**
   * Permission required to view this route, or the literal "public".
   *
   * Required on every entry — there is no `?` and no `null`. Omitting it is a
   * compile error, so "I forgot the permission" can never become a silent
   * hole. `null`/`undefined` were rejected for exactly this reason: they make
   * a forgotten field indistinguishable from an intentional one.
   *
   * Use "public" ONLY for routes that genuinely need no role check
   * (`/`, `/account`, `/login`, `/403`, `/404`, and the dev-only `/test`
   * routes). Anything else takes a real Permission and is enforced by the
   * AppShell guard.
   */
  permission: NewPermission | 'public';
  /**
   * 'internal' — a route in this app, guarded by the AppShell effect.
   * 'external' — an off-site URL used for nav/shortcut links only.
   *             matchRoute() can never match these (it prefix-matches
   *             usePathname()), so the guard must skip them explicitly.
   */
  kind: 'internal' | 'external';
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
  SHEET_HISTORY:    '/sheet-history',
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
    permission: 'public',
    kind: 'internal',
    label:                'Dashboard',
    icon:                 LayoutDashboard,
    navColor:             'blue',
    showInNav:            true,
    navOrder:             1,
  },
{
    path:                 '/attendance',
    permission: 'attendance:read',
    kind: 'internal',
    label:                'Attendance',
    icon:                 CheckCircle2,
    navColor:             'green',
    showInNav:            true,
    navOrder:             2,

  },
{
    path:                 '/orders',
    permission: 'orders:read',
    kind: 'internal',
    label:                'Orders',
    icon:                 Briefcase,
    navColor:             'emerald',
    showInNav:            true,
    navOrder:             3,
  },
{
    path:                 'https://mytaskacier.web.app/',
    permission: 'public',
    kind: 'external',
    label:                'One Time Work',
    icon:                 ListTodo,
    navColor:             'violet',
    showInNav:            true,
    navOrder:             4,
  },
{
    // Longest path first: /leads/v2 must precede /leads so matchRoute's
    // prefix fallback cannot swallow it.
    path:                 '/leads/v2',
    permission:           'leads:read',
    kind:                 'internal',
    label:                'Leads (V2)',
    icon:                 TrendingUp,
    navColor:             'red',
    showInNav:            false,
  },
{
    path:                 '/leads-center',
    permission: 'leads-center:read',
    kind: 'internal',
    label:                'Leads Center',
    icon:                 BarChart3,
    navColor:             'amber',
    showInNav:            true,
    navOrder:             5,
  },
{
    path:                 '/leads',
    permission: 'leads:read',
    kind: 'internal',
    label:                'Leads',
    icon:                 TrendingUp,
    navColor:             'red',
    showInNav:            true,
    navOrder:             6,
  },
{
    path:                 '/purchases',
    permission: 'purchases:read',
    kind: 'internal',
    label:                'Purchases',
    icon:                 ShoppingCart,
    navColor:             'fuchsia',
    showInNav:            true,
    navOrder:             7,
  },
{
    path:                 '/visitors',
    permission: 'visitors:read',
    kind: 'internal',
    label:                'Visitor Records',
    icon:                 UserPlus,
    navColor:             'teal',
    showInNav:            true,
    navOrder:             8,
  },
{
    path:                 '/reports',
    permission: 'reports:read',
    kind: 'internal',
    label:                'Reports',
    icon:                 BarChart3,
    navColor:             'gray',
    showInNav:            true,
    navOrder:             9,
  },
{
    path:                 ROUTES.USERS,
    permission:           'users:read',
    kind:                 'internal',
    label:                'Users',
    icon:                 Users,
    navColor:             'indigo',
    showInNav:            true,
    navOrder:             10,
  },
{
    path:                 '/customers',
    permission: 'customers:read',
    kind: 'internal',
    label:                'Customer',
    icon:                 Package,
    navColor:             'cyan', // Updated to Cyan
    showInNav:            true,
    navOrder:             11,
    navBadge:             'New',
  },
{
    path:                 ROUTES.ACCOUNT,
    // "public" here means "no role check", not "unauthenticated" — AppShell
    // still requires a signed-in user for every non-"/login" route.
    permission:           'public',
    kind:                 'internal',
    label:                'Account',
    icon:                 User,
    showInNav:            false,
  },
{
    path:                 ROUTES.SHEET_HISTORY,
    permission:           'sheet-history:read',
    kind:                 'internal',
    label:                'Sheet History',
    icon:                 FileText,
    navColor:             'sky',
    showInNav:            true,
    navOrder:             12,
  },
{
    // Was MISSING from PROTECTED_ROUTES entirely — the nav entry for tasks is
    // the external mytaskacier URL above, but app/tasks/page.tsx is a real
    // route. Without this entry the fail-closed guard would 404 every user,
    // including super-admin, on direct URL entry.
    path:                 '/tasks',
    permission:           'tasks:read',
    kind:                 'internal',
    label:                'Tasks',
    icon:                 ListTodo,
    navColor:             'violet',
    showInNav:            false,
  },
{
    // The C6 guard redirects denied users here. MUST be "public" — a route
    // that required a permission could bounce the user straight back to /403
    // in a loop. Same for /404.
    path:                 '/403',
    permission:           'public',
    kind:                 'internal',
    label:                'Forbidden',
    icon:                 ShieldAlert,
    showInNav:            false,
  },
{
    // Fail-closed target for unknown paths. Also overwrites the host's
    // out/404.html — see app/404/page.tsx.
    path:                 '/404',
    permission:           'public',
    kind:                 'internal',
    label:                'Not Found',
    icon:                FileQuestion,
    showInNav:            false,
  },
{
    // MUST be registered. The AppShell guard derives isPublicRoute from THIS
    // registry, so an unregistered '/login' resolves to route === undefined.
    // A signed-out visitor then bounces /login -> /404 -> /login forever.
    path:                 ROUTES.LOGIN,
    permission:           'public',
    kind:                 'internal',
    label:                'Login',
    icon:                 LogIn,
    showInNav:            false,
  },
  {
    path:                 ROUTES.FORGOT_PASSWORD,
    permission:           'public',
    kind:                 'internal',
    label:                'Forgot Password',
    icon:                 KeyRound,
    showInNav:            false,
  },
  {
    // DEV PAGES — registered as 'public' only so the fail-closed guard does
    // not 404 them for signed-in users. They have no role check and no nav
    // entry. C10 deletes these pages AND these two entries; they should not
    // be in a production bundle at all.
    path:                 '/test',
    permission:           'public',
    kind:                 'internal',
    label:                'Test',
    icon:                 FlaskConical,
    showInNav:            false,
  },
  {
    path:                 '/test-api',
    permission:           'public',
    kind:                 'internal',
    label:                'Test API',
    icon:                 FlaskConical,
    showInNav:            false,
  },
];


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname);
}

/**
 * Strip trailing slashes so '/orders/' and '/orders' resolve identically.
 *
 * matchRoute() prefix-matches on `path + '/'`, so '/orders/' only matched by
 * accident: the prefix branch tested '/orders/'.startsWith('/orders/') -> true.
 * An unnormalised '/leads/v2/' however would prefix-match back to '/leads'
 * instead of its own entry. Normalising inside matchRoute() makes every caller
 * correct without each one remembering to do it.
 */
export function normalizePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

export function matchRoute(pathname: string): RouteConfig | undefined {
  const path = normalizePath(pathname);
  const exact = PROTECTED_ROUTES.find((r) => r.path === path);
  if (exact) return exact;
  return PROTECTED_ROUTES.find(
    (r) => !r.path.includes('?') && path.startsWith(r.path + '/')
  );
}

/**
 * Can this role view this route?
 *
 * Delegates to canRole so the route guard (C6) and the nav filter can never
 * disagree — same resolver, same grants. `public` routes are visible to any
 * signed-in user.
 */
export function roleCanAccess(route: RouteConfig, role: string | null | undefined): boolean {
  if (route.permission === 'public') return true;
  return canRole(role, route.permission);
}

/** All nav items visible to role, sorted by navOrder. */
export function getNavItems(role: string | null | undefined): RouteConfig[] {
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
  allowedRoles: string[];
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

export function getCreateShortcuts(role: string): CreateShortcut[] {
  return CREATE_SHORTCUTS.filter(
    (s) => s.allowedRoles.length === 0 || s.allowedRoles.includes(role)
  );
}
