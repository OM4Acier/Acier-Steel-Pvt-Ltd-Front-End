// components/NavButton.tsx
'use client';

import { Button } from '@/components/ui/button';
import { LucideIcon, Home, LayoutDashboard, Briefcase, ShoppingCart, LogIn, LogOut, User, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';

// Define a type for common button configurations
type NavButtonType = 'home' | 'dashboard' | 'orders' | 'purchases' | 'login' | 'logout' | 'profile' | 'settings' | 'custom';

// Configuration for predefined button types
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
    baseClasses: 'bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-700 dark:hover:bg-blue-600 dark:text-white',
  },
  dashboard: {
    icon: LayoutDashboard,
    text: 'Dashboard',
    defaultPath: '/',
    baseClasses: 'bg-purple-100 hover:bg-purple-200 text-purple-800 dark:bg-purple-700 dark:hover:bg-purple-600 dark:text-white',
    loginRequired: true,
  },
  orders: {
    icon: Briefcase,
    text: 'Orders',
    defaultPath: '/orders',
    baseClasses: 'bg-green-200 hover:bg-green-300 text-green-800 dark:bg-green-700 dark:hover:bg-green-600 dark:text-white',
    loginRequired: true,
  },
  purchases: {
    icon: ShoppingCart,
    text: 'Purchases',
    defaultPath: '/purchases',
    baseClasses: 'bg-yellow-200 hover:bg-yellow-300 text-yellow-800 dark:bg-yellow-700 dark:hover:bg-yellow-600 dark:text-white',
    loginRequired: true,
  },
  profile: {
    icon: User,
    text: 'Profile',
    defaultPath: '/profile',
    baseClasses: 'bg-orange-100 hover:bg-orange-200 text-orange-800 dark:bg-orange-700 dark:hover:bg-orange-600 dark:text-white',
    loginRequired: true,
  },
  settings: {
    icon: Settings,
    text: 'Settings',
    defaultPath: '/settings',
    baseClasses: 'bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white',
  },
  login: {
    icon: LogIn,
    text: 'Login',
    defaultPath: '/login',
    baseClasses: 'bg-indigo-500 hover:bg-indigo-600 text-white',
  },
  logout: {
    icon: LogOut,
    text: 'Logout',
    defaultPath: '/logout',
    baseClasses: 'bg-red-500 hover:bg-red-600 text-white',
    loginRequired: true,
  },
  custom: {
    icon: Home,
    text: 'Custom',
    baseClasses: 'bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white',
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
}

export const NavButton = ({
  type,
  path,
  text,
  icon,
  onClick,
  className,
  isLoggedIn,
  subclassName = ''
}: NavButtonProps) => {
  const router = useRouter();
  const config = buttonConfigs[type];

  if (config.loginRequired && !isLoggedIn) {
    return null;
  }

  // Determine the final icon and text
  const FinalIconComponent = icon || config.icon; // Renamed for clarity as it's a component
  const finalText = text || config.text;

  const handleClick = onClick || (() => {
    if (config.defaultPath) {
      router.push(path || config.defaultPath);
    } else {
      console.warn(`NavButton type '${type}' has no default path or onClick handler.`);
    }
  });

  return (
    <Button
      variant="outline"
      className={`${className} !justify-start md:justify-center p-2 sm:px-3 sm:py-2 rounded-full shadow-md flex items-center ${config.baseClasses} `}
      onClick={handleClick}
    >
      {/* DIRECTLY render the component. It's guaranteed to be a valid LucideIcon. */}
      <FinalIconComponent className="h-4 w-4 sm:h-5 sm:w-5" />
      <span className={` ${subclassName}hidden sm:inline ml-1 sm:ml-2 text-sm sm:text-base`}>{finalText}</span>
    </Button>
  );
};