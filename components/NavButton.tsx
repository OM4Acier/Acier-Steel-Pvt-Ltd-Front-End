// components/NavButton.tsx
'use client';

import { Button } from '@/components/ui/button';
import { 
  LucideIcon, Home, LayoutDashboard, Briefcase, ShoppingCart, 
  LogIn, LogOut, User, Settings, Plus, RefreshCw, Loader2, 
  Edit, Trash2, Save
} from 'lucide-react';
import { useRouter } from 'next/navigation';

// 1. Added new common action types: add, refresh, edit, delete, save
type NavButtonType = 
  | 'home' | 'dashboard' | 'orders' | 'purchases' 
  | 'login' | 'logout' | 'profile' | 'settings' | 'custom'
  | 'add' | 'refresh' | 'edit' | 'delete' | 'save' | 'crate';

const base="flex items-center gap-1.5 px-3 py-2 rounded-full border border-gray-300 dark:border-gray-600 shadow text-sm font-medium transition-all hover:scale-105"

const buttonConfigs: Record<NavButtonType, {
  icon: LucideIcon;
  text: string;
  defaultPath?: string;
  baseClasses: string;
  loginRequired?: boolean;
}> = {
  home: {
    icon: Home,
    text: 'Home',
    defaultPath: '/',
    baseClasses: `${base} bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-700 dark:hover:bg-blue-600 dark:text-white`,
  },
  dashboard: {
    icon: LayoutDashboard,
    text: 'Dashboard',
    defaultPath: '/',
    baseClasses: `${base} bg-purple-100 hover:bg-purple-200 text-purple-800 dark:bg-purple-700 dark:hover:bg-purple-600 dark:text-white`,
    loginRequired: true,
  },
  orders: {
    icon: Briefcase,
    text: 'Orders',
    defaultPath: '/orders',
    baseClasses: `${base} bg-green-200 hover:bg-green-300 text-green-800 dark:bg-green-700 dark:hover:bg-green-600 dark:text-white`,
    loginRequired: true,
  },
  purchases: {
    icon: ShoppingCart,
    text: 'Purchases',
    defaultPath: '/purchases',
    baseClasses: `${base} bg-yellow-200 hover:bg-yellow-300 text-yellow-800 dark:bg-yellow-700 dark:hover:bg-yellow-600 dark:text-white`,
    loginRequired: true,
  },
  profile: {
    icon: User,
    text: 'Profile',
    defaultPath: '/profile',
    baseClasses: `${base} bg-orange-100 hover:bg-orange-200 text-orange-800 dark:bg-orange-700 dark:hover:bg-orange-600 dark:text-white`,
    loginRequired: true,
  },
  settings: {
    icon: Settings,
    text: 'Settings',
    defaultPath: '/settings',
    baseClasses: `${base} bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white`,
  },
  login: {
    icon: LogIn,
    text: 'Login',
    defaultPath: '/login',
    baseClasses: `${base} bg-indigo-500 hover:bg-indigo-600 text-white`,
  },
  logout: {
    icon: LogOut,
    text: 'Logout',
    defaultPath: '/logout',
    baseClasses: `${base} bg-red-500 hover:bg-red-600 text-white`,
    loginRequired: true,
  },
  custom: {
    icon: Home,
    text: 'Custom',
    baseClasses: `${base} bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white`,
  },
  // --- New Common Action Buttons ---
  add: {
    icon: Plus,
    text: 'Add',
    baseClasses: `${base} bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-700 dark:hover:bg-emerald-600 dark:text-white`,
  },
  refresh: {
    icon: RefreshCw,
    text: 'Refresh',
    baseClasses: `${base} flex items-center gap-1.5 px-3 py-2 rounded-full border border-gray-300 dark:border-gray-600 shadow text-sm font-medium transition-all hover:scale-105 bg-white/80 hover:bg-gray-100 text-gray-700 dark:bg-gray-800/80 dark:hover:bg-gray-700 dark:text-gray-200`,
  },
  edit: {
    icon: Edit,
    text: 'Edit',
    baseClasses: `${base} bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-blue-100`,
  },
  delete: {
    icon: Trash2,
    text: 'Delete',
    baseClasses: `${base} bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/50 dark:hover:bg-red-900/80 dark:text-red-200`,
  },
  save: {
    icon: Save,
    text: 'Save',
    baseClasses: `${base} bg-indigo-100 hover:bg-indigo-200 text-indigo-700 dark:bg-indigo-900/50 dark:hover:bg-indigo-900/80 dark:text-indigo-200`,
  },
  crate: {
    icon: Plus,
    text: 'Crate',
    baseClasses: `${base} bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-900/50 dark:hover:bg-blue-900/80 dark:text-blue-200`,
  }
};


interface NavButtonProps {
  type: NavButtonType;
  path?: string;
  text?: string;
  icon?: LucideIcon;
  onClick?: () => void;
  className?: string;
  isLoggedIn?: boolean;
  subclassName?: string;
  // 2. Added new props for loading/disabled states
  isLoading?: boolean;
  disabled?: boolean;
}

export const NavButton = ({
  type,
  path,
  text,
  icon,
  onClick,
  className = '',
  isLoggedIn,
  subclassName = '',
  isLoading = false,
  disabled = false,
}: NavButtonProps) => {
  const router = useRouter();
  const config = buttonConfigs[type];

  if (config.loginRequired && !isLoggedIn) {
    return null;
  }

  // 3. Swap the icon for a spinner if loading is true
  const FinalIconComponent = isLoading ? Loader2 : (icon || config.icon);
  const finalText = text || config.text;

  const handleClick = onClick || (() => {
    // Action buttons might not have a path, so only push if path exists
    const targetPath = path || config.defaultPath;
    if (targetPath) {
      router.push(targetPath);
    } else {
      console.warn(`NavButton type '${type}' has no default path or onClick handler.`);
    }
  });

  return (
    <Button
      variant="default"
      disabled={disabled || isLoading}
      // Added gap-1.5 to match your snippet's preferred spacing
      className={`${config.baseClasses} ${className}`}
      onClick={handleClick}
    >
      {/* 4. Add the animate-spin class if it is loading */}
      <FinalIconComponent className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
      
      <span className={`${subclassName} hidden sm:inline`}>
        {finalText}
      </span>
    </Button>
  );
};