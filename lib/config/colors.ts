/**
 * lib/config/colors.ts
 *
 * Single source of truth for every color token in the navbar system.
 *
 * Previously: NavColorToken lived in routes.ts, CreateShortcutColor lived in
 * nav-config.ts — two separate token types and two maps for the same visual idea.
 *
 * Now: one NavColor type, one NAV_COLOR_MAP, imported by both files.
 *
 * Adding a new color:
 *   1. Add the token string to NavColor union
 *   2. Add one entry to NAV_COLOR_MAP
 *   Done. Nav links AND create shortcuts pick it up automatically.
 */

export type NavColor =
  | 'blue' | 'emerald' | 'violet' | 'amber' | 'red'
  | 'fuchsia' | 'indigo' | 'teal' | 'green' | 'gray'
  | 'orange' | 'cyan' | 'rose' | 'lime' | 'sky'|'cyan';

export interface NavColorClasses {
  /** Nav menu link — idle state */
  navBase:     string;
  /** Nav menu link — active / current page */
  navActive:   string;
  /** Create dropdown — icon color */
  createIcon:  string;
  /** Create dropdown — row hover background */
  createHover: string;
  /** Create dropdown — accent dot */
  createDot:   string;
}

/**
 * All values are complete static string literals.
 * Never build these dynamically (`bg-${color}-50`) — Tailwind's scanner
 * only finds class names that appear verbatim in source files.
 */
export const NAV_COLOR_MAP: Record<NavColor, NavColorClasses> = {
  blue: {
    navBase:     'bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950 dark:hover:bg-blue-900 dark:text-blue-300',
    navActive:   'bg-indigo-600 !text-white font-bold shadow-md',
    createIcon:  'text-blue-600 dark:text-blue-400',
    createHover: 'hover:bg-blue-50 dark:hover:bg-blue-950',
    createDot:   'bg-blue-500',
  },
  emerald: {
    navBase:     'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:text-emerald-300',
    navActive:   'bg-indigo-600 !text-white font-bold shadow-md',
    createIcon:  'text-emerald-600 dark:text-emerald-400',
    createHover: 'hover:bg-emerald-50 dark:hover:bg-emerald-950',
    createDot:   'bg-emerald-500',
  },
  violet: {
    navBase:     'bg-violet-50 hover:bg-violet-100 text-violet-700 dark:bg-violet-950 dark:hover:bg-violet-900 dark:text-violet-300',
    navActive:   'bg-indigo-600 !text-white font-bold shadow-md',
    createIcon:  'text-violet-600 dark:text-violet-400',
    createHover: 'hover:bg-violet-50 dark:hover:bg-violet-950',
    createDot:   'bg-violet-500',
  },
  amber: {
    navBase:     'bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950 dark:hover:bg-amber-900 dark:text-amber-300',
    navActive:   'bg-indigo-600 !text-white font-bold shadow-md',
    createIcon:  'text-amber-600 dark:text-amber-400',
    createHover: 'hover:bg-amber-50 dark:hover:bg-amber-950',
    createDot:   'bg-amber-500',
  },
  red: {
    navBase:     'bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950 dark:hover:bg-red-900 dark:text-red-300',
    navActive:   'bg-indigo-600 !text-white font-bold shadow-md',
    createIcon:  'text-red-600 dark:text-red-400',
    createHover: 'hover:bg-red-50 dark:hover:bg-red-950',
    createDot:   'bg-red-500',
  },
  fuchsia: {
    navBase:     'bg-fuchsia-50 hover:bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950 dark:hover:bg-fuchsia-900 dark:text-fuchsia-300',
    navActive:   'bg-indigo-600 !text-white font-bold shadow-md',
    createIcon:  'text-fuchsia-600 dark:text-fuchsia-400',
    createHover: 'hover:bg-fuchsia-50 dark:hover:bg-fuchsia-950',
    createDot:   'bg-fuchsia-500',
  },
  indigo: {
    navBase:     'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:hover:bg-indigo-900 dark:text-indigo-300',
    navActive:   'bg-indigo-600 !text-white font-bold shadow-md',
    createIcon:  'text-indigo-600 dark:text-indigo-400',
    createHover: 'hover:bg-indigo-50 dark:hover:bg-indigo-950',
    createDot:   'bg-indigo-500',
  },
  teal: {
    navBase:     'bg-teal-50 hover:bg-teal-100 text-teal-700 dark:bg-teal-950 dark:hover:bg-teal-900 dark:text-teal-300',
    navActive:   'bg-indigo-600 !text-white font-bold shadow-md',
    createIcon:  'text-teal-600 dark:text-teal-400',
    createHover: 'hover:bg-teal-50 dark:hover:bg-teal-950',
    createDot:   'bg-teal-500',
  },
  green: {
    navBase:     'bg-green-50 hover:bg-green-100 text-green-700 dark:bg-green-950 dark:hover:bg-green-900 dark:text-green-300',
    navActive:   'bg-indigo-600 !text-white font-bold shadow-md',
    createIcon:  'text-green-600 dark:text-green-400',
    createHover: 'hover:bg-green-50 dark:hover:bg-green-950',
    createDot:   'bg-green-500',
  },
  gray: {
    navBase:     'bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300',
    navActive:   'bg-indigo-600 !text-white font-bold shadow-md',
    createIcon:  'text-gray-600 dark:text-gray-400',
    createHover: 'hover:bg-gray-100 dark:hover:bg-gray-800',
    createDot:   'bg-gray-500',
  },
  orange: {
    navBase:     'bg-orange-50 hover:bg-orange-100 text-orange-700 dark:bg-orange-950 dark:hover:bg-orange-900 dark:text-orange-300',
    navActive:   'bg-indigo-600 !text-white font-bold shadow-md',
    createIcon:  'text-orange-600 dark:text-orange-400',
    createHover: 'hover:bg-orange-50 dark:hover:bg-orange-950',
    createDot:   'bg-orange-500',
  },
  cyan: {
    navBase:     'bg-cyan-50 hover:bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:hover:bg-cyan-900 dark:text-cyan-300',
    navActive:   'bg-indigo-600 !text-white font-bold shadow-md',
    createIcon:  'text-cyan-600 dark:text-cyan-400',
    createHover: 'hover:bg-cyan-50 dark:hover:bg-cyan-950',
    createDot:   'bg-cyan-500',
  },
  rose: {
    navBase:     'bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950 dark:hover:bg-rose-900 dark:text-rose-300',
    navActive:   'bg-indigo-600 !text-white font-bold shadow-md',
    createIcon:  'text-rose-600 dark:text-rose-400',
    createHover: 'hover:bg-rose-50 dark:hover:bg-rose-950',
    createDot:   'bg-rose-500',
  },
  lime: {
    navBase:     'bg-lime-50 hover:bg-lime-100 text-lime-700 dark:bg-lime-950 dark:hover:bg-lime-900 dark:text-lime-300',
    navActive:   'bg-indigo-600 !text-white font-bold shadow-md',
    createIcon:  'text-lime-600 dark:text-lime-400',
    createHover: 'hover:bg-lime-50 dark:hover:bg-lime-950',
    createDot:   'bg-lime-500',
  },
  sky: {
    navBase:     'bg-sky-50 hover:bg-sky-100 text-sky-700 dark:bg-sky-950 dark:hover:bg-sky-900 dark:text-sky-300',
    navActive:   'bg-indigo-600 !text-white font-bold shadow-md',
    createIcon:  'text-sky-600 dark:text-sky-400',
    createHover: 'hover:bg-sky-50 dark:hover:bg-sky-950',
    createDot:   'bg-sky-500',
  },
};

export const NAV_COLOR_FALLBACK = NAV_COLOR_MAP.gray;
