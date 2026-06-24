/**
 * components/NavBar.tsx
 *
 * Static minimal navbar — 4 slots:
 *   [Brand]  ─────────  [+ Create ▾]  [🌙 Theme]  [☰ Menu]  [👤 Profile]
 *
 * Props: only user, onLogout, and optional branding.
 * Zero page-specific logic. All customisation comes through:
 *   A. <NavbarExtension> component from any page (hanging board)
 *   B. <PageToolbar> rendered by the page below the header
 */

'use client';

import React, { useCallback, useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Sheet, SheetContent, SheetHeader,
  SheetTitle, SheetTrigger, SheetFooter,
} from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';
import {
  Plus, Menu, LogOut, Mail, Phone, Search,
  Building2, ChevronDown, Settings, X, User,
} from 'lucide-react';
import { getNavItems, ROUTES, type RouteConfig } from '@/lib/config/routes';
import { getCreateShortcuts } from '@/lib/config/routes';
import { NAV_COLOR_MAP, NAV_COLOR_FALLBACK } from '@/lib/config/colors';
import { NavbarExtensionSlot } from '../context/NavbarExtensionContext';
import type { UserProfile } from '@/types/rbac.types';

// ---------------------------------------------------------------------------
// Props — minimal by design
// ---------------------------------------------------------------------------

export interface NavBarProps {
  user: UserProfile | null;
  onLogout: () => void;
  companyName?: string;
  companySubtitle?: string;
  logoSrc?: string;
}

// ---------------------------------------------------------------------------
// ① Create dropdown
// ---------------------------------------------------------------------------

function CreateDropdown({ user }: { user: UserProfile }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const shortcuts = getCreateShortcuts(user.role);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  if (shortcuts.length === 0) return null;

  const filtered = shortcuts.filter(s =>
    s.label.toLowerCase().includes(search.toLowerCase())
  );

  const go = useCallback(
    (path: string, param?: string) => {
      setOpen(false);
      setSearch('');
      router.push(param ? `${path}?action=${param}` : path);
    },
    [router]
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 shadow-sm border border-transparent transition-all duration-300 active:scale-95"
      >
        <Plus className="w-4 h-4 stroke-[2px]" />
        <span className="hidden sm:inline font-medium tracking-wide text-sm">Create</span>
        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-300 opacity-70', open && 'rotate-180')} />
      </Button>

      {open && (
        <div className="absolute -left-6 sm:left-auto sm:right-0 top-full mt-3 z-50 w-[85vw] max-w-[320px] sm:max-w-none sm:w-[380px] rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">

          {/* Search Header */}
          <div className="p-3 border-b border-zinc-100 dark:border-zinc-800/80">
            <div className="relative flex items-center bg-zinc-50 dark:bg-zinc-900/50 rounded-xl px-3 py-2 border border-transparent focus-within:border-zinc-200 dark:focus-within:border-zinc-700 transition-colors">
              <Search className="w-4 h-4 text-zinc-400 mr-2 flex-shrink-0" />
              <input
                autoFocus
                placeholder="Find an action..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Actions List */}
          <div className="p-2 max-h-[380px] overflow-y-auto">
            {filtered.length > 0 ? (
              <div className="flex flex-col gap-1">
                {filtered.map((s) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.id}
                      onClick={() => go(s.path, s.actionParam)}
                      className="flex items-center gap-3 p-3 rounded-xl text-left transition-colors duration-200 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 group"
                    >
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 group-hover:bg-zinc-200 dark:group-hover:bg-zinc-700 transition-colors">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 leading-tight">
                          {s.label}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate tracking-wide">
                          Quick launch {s.label.toLowerCase()}
                        </p>
                      </div>
                      <Plus className="w-4 h-4 text-zinc-300 dark:text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">No actions found for &quot;{search}&quot;</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ② Menu sheet — nav links from registry
// ---------------------------------------------------------------------------

function DrawerLink({
  route,
  activePath,
  onNavigate,
}: {
  route: RouteConfig;
  activePath: string;
  onNavigate: () => void;
}) {
  const c = NAV_COLOR_MAP[route.navColor ?? 'gray'] ?? NAV_COLOR_FALLBACK;
  const Icon = route.icon;

  const isActive = route.path.includes('?')
    ? activePath.includes(route.path.split('?')[1] ?? '')
    : activePath === route.path || activePath.startsWith(route.path + '/');

  return (
    <Link
      href={route.path}
      onClick={onNavigate}
      className={cn(
        'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium',
        'border border-transparent transition-all duration-150',
        isActive ? c.navActive : c.navBase
      )}
    >
      {Icon && <Icon className="w-5 h-5 flex-shrink-0" />}
      <span className="text-md">{route.label}</span>
      {route.navBadge && (
        <span className="ml-auto text-[10px] font-bold bg-black/10 dark:bg-white/10 rounded-full px-1.5 py-0.5">
          {route.navBadge}
        </span>
      )}
    </Link>
  );
}

function MenuSheet({
  user, open, setOpen,
}: { user: UserProfile; open: boolean; setOpen: (v: boolean) => void }) {
  const pathname = usePathname();
  const navItems = getNavItems(user.role);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-gray-300 dark:border-gray-600 bg-white/60 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 shadow text-sm font-medium transition-all hover:scale-105"
        >
          <Menu className="w-4 h-4" />
          <span className="hidden sm:inline">Menu</span>
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="w-full sm:w-72 bg-gradient-to-b from-blue-50 to-blue-100/80 dark:from-gray-900 dark:to-gray-800 flex flex-col p-6 z-[9999]"
      >
        <SheetHeader className="mb-5 pb-4 border-b border-gray-200 dark:border-gray-700">
          <SheetTitle className="flex items-center gap-2 text-xl font-bold text-gray-800 dark:text-white">
            <Settings className="w-5 h-5 text-gray-500" /> Navigation
          </SheetTitle>
        </SheetHeader>

        <nav className="flex flex-col gap-1.5 flex-1 overflow-y-auto">
          {navItems.map((r) => (
            <DrawerLink key={r.path} route={r} activePath={pathname} onNavigate={close} />
          ))}
        </nav>

        <SheetFooter className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            Signed in as{' '}
            <span className="font-semibold text-gray-700 dark:text-gray-200">
              {user.email}
            </span>
          </p>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// ③ Profile popover — reads from UserProfile (in-memory cache, no extra fetch)
// ---------------------------------------------------------------------------

const ROLE_BADGE: Record<string, string> = {
  'super-admin': 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  sales: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  accountant: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  operations: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  'purchase-entry': 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
};

function ProfilePopover({
  user, onLogout,
}: { user: UserProfile; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  const initials = (user.name ?? user.email)
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const roleCls = ROLE_BADGE[user.role] ?? 'bg-gray-100 text-gray-700';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Open profile"
        className="w-11 h-11 rounded-full bg-indigo-600 text-white font-bold text-sm shadow-md hover:bg-indigo-700 transition-all hover:scale-105 ring-2 ring-white dark:ring-gray-800 flex items-center justify-center"
      >
        {initials}
      </button>

      {open && (
        <div className="absolute -right-4 sm:right-0 top-full mt-2 z-50 w-[85vw] max-w-[280px] sm:max-w-none sm:w-72 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="px-5 pt-5 pb-4 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950 dark:to-gray-800 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-indigo-600 text-white font-bold text-lg flex items-center justify-center shadow-md flex-shrink-0">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 dark:text-white leading-snug truncate max-w-[160px]">
                    {user.name}
                  </p>
                  <span className={cn('inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold capitalize', roleCls)}>
                    {user.role}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Fields */}
          <div className="px-5 py-4 space-y-3">
            <Link 
              href={ROUTES.ACCOUNT} 
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 p-2 -mx-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
            >
              <User className="w-4 h-4 text-gray-400 group-hover:text-indigo-600 flex-shrink-0" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Manage Account
              </p>
            </Link>
            <div className="h-px bg-gray-100 dark:bg-gray-800 my-1" />
            <ProfileRow icon={Mail} value={user.email} />
            {user.contactNo && <ProfileRow icon={Phone} value={user.contactNo} />}
            {user.organization && <ProfileRow icon={Building2} value={user.organization} />}
            <ProfileRow icon={User} value={user.id} mono />
          </div>

          {/* Logout */}
          <div className="px-5 pb-4">
            <Button
              onClick={() => { setOpen(false); onLogout(); }}
              variant="outline"
              className="w-full flex items-center justify-center gap-2 rounded-xl border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 text-sm font-semibold h-10"
            >
              <LogOut className="w-4 h-4" /> Sign out
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileRow({
  icon: Icon, value, mono = false,
}: { icon: React.ComponentType<{ className?: string }>; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
      <p className={cn(
        'text-sm text-gray-700 dark:text-gray-300 truncate',
        mono && 'font-mono text-xs text-gray-400'
      )}>
        {value}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main NavBar
// ---------------------------------------------------------------------------

export function NavBar({
  user,
  onLogout,
  companyName = 'Acier Steel Pvt. Ltd.',
  companySubtitle = 'ALL TYPE OF PEB MATRIAL IN ONE PLACE.',
  logoSrc = '/logo.png',
}: NavBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  // Fallback if not logged in
  if (!user) return null;
  return (
    <header className="bg-gradient-to-r from-blue-50 to-blue-200 dark:bg-gray-950/70 sticky top-0 z-30 shadow-sm border-b border-gray-100 dark:border-white/5 backdrop-blur-xl rounded-b-[2rem]">

      {/* Main bar — Synchronized padding and refined grouping */}
      <div className="max-w-screen-3xl mx-auto px-4 md:px-8 py-2.5 flex flex-wrap items-center justify-center md:justify-between gap-4">

        {/* Brand — Refined typography & spacing */}
        <Link href={ROUTES.HOME} className="flex items-center gap-4 flex-shrink-0 group">
          <div className="relative">
            <Image
              src={logoSrc} alt={`${companyName} logo`}
              width={600} height={200} priority
              className="h-8 w-auto sm:h-12 filter brightness-105 contrast-105 group-hover:scale-105 transition-transform duration-500 ease-out"
            />
            <div className="absolute -inset-2 bg-blue-500/5 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight drop-shadow-lg">
              {companyName}
            </h1>
            <p className="text-[10px] uppercase font-bold tracking-[0.1em] text-gray-400 dark:text-gray-500 mt-0.5 leading-none hidden sm:block">
              {companySubtitle}
            </p>
          </div>
        </Link>

        {/* Right controls — Tighter grouping for Command Zone */}
        <div className="flex items-center gap-1.5 md:gap-2">
          {user && <CreateDropdown user={user} />}
          <div className="h-6 w-px bg-gray-200 dark:bg-white/10 mx-1 hidden md:block" />
          <ThemeToggle />
          {user && <MenuSheet user={user} open={menuOpen} setOpen={setMenuOpen} />}
          {user && <ProfilePopover user={user} onLogout={onLogout} />}
          {!user && (
            <Button asChild className="rounded-full bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 text-sm font-bold shadow-lg shadow-blue-500/20 transition-all hover:scale-105">
              <Link href={ROUTES.LOGIN}>Sign in</Link>
            </Button>
          )}
        </div>
      </div>

      {/* Hanging board slot — Now synchronized with content right-edge */}
      <NavbarExtensionSlot />

    </header>
  );
}

export default NavBar;
