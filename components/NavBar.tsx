'use client';

import React, { ReactNode, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Search,
  Menu,
  LogIn,
  Briefcase,
  Users as UsersIcon,
  SlidersHorizontal,
  ChevronUp,
  ChevronDown,
  ShoppingCart,
  TrendingUp,
  BarChart3,
  Plus,
  RefreshCw,
  Loader2,
  Settings, // Added for general settings icon
  LogOut,   // Corrected logout icon import
  LayoutDashboard, // Added for Dashboard specific icon if preferred over Home
  UserPlus,
  ListTodo,
  CheckCircle2
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { UserProfile } from '@/types/rbac.types';



// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface PageAction {
  id: string;
  component: ReactNode;
}

// Simplified filter config only for orders page
export interface OrdersFilterConfig {
  sortBy: {
    value: string;
    setValue: (value: string) => void;
    options: { value: string; label: string; }[];
  };
  status: {
    value: string;
    setValue: (value: string) => void;
    options: string[];
  };
  paymentStatus: {
    value: string;
    setValue: (value: string) => void;
  };
  onReset: () => void;
}

interface PageConfig {
  key: string;
  label: string;
  icon: ReactNode;
  path: string;
  requiresRole?: string[];
  baseClasses?: string; // Added for custom background colors
  activeClasses?: string; // Added for specific active state styling
}

interface UniversalNavBarProps {
  // Common props
  currentUserProfile: UserProfile | null;
  isLoggedIn: boolean;
  handleLogout: () => void;

  // Search functionality
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  searchPlaceholder?: string;

  // Menu state
  isMenuOpen: boolean;
  setIsMenuOpen: (open: boolean) => void;

  // Page navigation
  currentPath: string; // Current URL path like '/orders' or '/orders?view=users'
  availablePages?: PageConfig[];

  // Page-specific actions
  pageActions?: PageAction[];

  // Orders page filters (only for orders page)
  ordersFilters?: OrdersFilterConfig;
  showOrdersFilters?: boolean;
  setShowOrdersFilters?: (show: boolean) => void;

  // Company info
  companyName?: string;
  companySubtitle?: string;
}

// ============================================================================
// CONFIGURATION AND CONSTANTS
// ============================================================================

// Role helper functions
const isSales = (role: string | undefined) => role === 'sales';
const isSuperAdmin = (role: string | undefined) => role === 'super-admin';


const ACTIVE_CLASSES = 'bg-indigo-600 text-white font-extrabold shadow-xl border-indigo-700';

// Default available pages with custom baseClasses and activeClasses
const DEFAULT_PAGES: PageConfig[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard />,
    path: '/',
    requiresRole: ['super-admin', 'sales', 'accountant', 'operations', 'purchase-entry'],
    // Light: Blue 50/100, Dark: Blue 900/800
    baseClasses: 'bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900 dark:hover:bg-blue-800 dark:text-blue-200',
    activeClasses: ACTIVE_CLASSES,
  },
  {
    key: 'attendance',
    label: 'Attendance',
    icon: <CheckCircle2 />,
    path: '/attendance',
    requiresRole: ['super-admin', 'sales', 'accountant', 'operations', 'purchase-entry'],
    // Light: Green 50/100, Dark: Green 900/800
    baseClasses: 'bg-green-50 hover:bg-green-100 text-green-700 dark:bg-green-900 dark:hover:bg-green-800 dark:text-green-200',
    activeClasses: ACTIVE_CLASSES,
  },
  {
    key: 'orders',
    label: 'Orders',
    icon: <Briefcase />,
    path: '/orders',
    requiresRole: ['super-admin', 'sales', 'accountant', 'operations'],
    // Light: Emerald 50/100, Dark: Emerald 900/800
    baseClasses: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:hover:bg-emerald-800 dark:text-emerald-200',
    activeClasses: ACTIVE_CLASSES,
  },
  {
    key: 'tasks',
    label: 'One Time Work',
    icon: <ListTodo />, // Or <ClipboardList /> / <CheckSquare />
    path: '/tasks',
    requiresRole: ['super-admin', 'sales', 'accountant', 'operations', 'purchase-entry'],
    // Light: Violet 50/100, Dark: Violet 900/800
    baseClasses: 'bg-violet-50 hover:bg-violet-100 text-violet-700 dark:bg-violet-900 dark:hover:bg-violet-800 dark:text-violet-200',
    activeClasses: ACTIVE_CLASSES,
  },
  {
    key: 'leads_center',
    label: 'Leads Center',
    icon: <BarChart3 />,
    path: '/leads-center',
    requiresRole: ['sales', 'super-admin'],
    // Light: Amber 50/100, Dark: Amber 900/800
    baseClasses: 'bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-900 dark:hover:bg-amber-800 dark:text-amber-200',
    activeClasses: ACTIVE_CLASSES,
  },
  {
    key: 'leads',
    label: 'Leads',
    icon: <TrendingUp />,
    path: '/leads',
    requiresRole: ['sales', 'super-admin'],
    // Light: Red 50/100, Dark: Red 900/800
    baseClasses: 'bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-900 dark:hover:bg-red-800 dark:text-red-200',
    activeClasses: ACTIVE_CLASSES,
  },
  {
    key: 'purchases',
    label: 'Purchases',
    icon: <ShoppingCart />,
    path: '/purchases',
    requiresRole: ['operations', 'super-admin', 'accountant', 'purchase-entry'],
    // Light: Fuchsia 50/100, Dark: Fuchsia 900/800
    baseClasses: 'bg-fuchsia-50 hover:bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900 dark:hover:bg-fuchsia-800 dark:text-fuchsia-200',
    activeClasses: ACTIVE_CLASSES,
  },
  {
    key: 'users',
    label: 'Users',
    icon: <UsersIcon />,
    path: '/orders?view=users',
    requiresRole: ['super-admin'],
    // Light: Indigo 50/100, Dark: Indigo 900/800
    baseClasses: 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:hover:bg-indigo-800 dark:text-indigo-200',
    activeClasses: ACTIVE_CLASSES,
  },
  {
    key: 'visitors',
    label: 'Visitor Records',
    icon: <UserPlus />,
    path: '/visitors',
    requiresRole:  ['super-admin', 'sales', 'accountant', 'operations', 'purchase-entry'],
    // Light: Teal 50/100, Dark: Teal 900/800
    baseClasses: 'bg-teal-50 hover:bg-teal-100 text-teal-700 dark:bg-teal-900 dark:hover:bg-teal-800 dark:text-teal-200',
    activeClasses: ACTIVE_CLASSES,
  },
  {
    key: 'reports',
    label: 'Reports',
    icon: <BarChart3 />,
    path: '/reports',
    requiresRole: ['super-admin'],
    // Light: Gray 50/100, Dark: Gray 700/600 (Dark background contrast)
    baseClasses: 'bg-gray-50 hover:bg-gray-100 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200',
    activeClasses: ACTIVE_CLASSES,
  }
];

// Orders page specific configurations
const ORDERS_STATUS_OPTIONS = ['Pending', 'In Progress', 'Completed', 'Cancelled', 'On Hold'];

const ORDERS_SORT_OPTIONS = [
  { value: 'deoNo', label: 'DEO No.' },
  { value: 'status', label: 'Status' },
  { value: 'date', label: 'Date Created' },
  { value: 'amount', label: 'Amount' }
];

// ============================================================================
// CUSTOM HOOKS
// ============================================================================

export const useNavbarState = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showOrdersFilters, setShowOrdersFilters] = useState(false);
  const router = useRouter();

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  const navigateToPage = useCallback((path: string) => {
    setIsMenuOpen(false);
    router.replace(path);
  }, [router]);

  return {
    searchTerm,
    setSearchTerm,
    isMenuOpen,
    setIsMenuOpen,
    showOrdersFilters,
    setShowOrdersFilters,
    closeMenu,
    navigateToPage
  };
};

export const useOrdersFilterState = () => {
  const [sortBy, setSortBy] = useState(ORDERS_SORT_OPTIONS[0].value);
  const [filterStatus, setFilterStatus] = useState('all_statuses');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('all_payments');

  const handleResetFilters = useCallback(() => {
    setSortBy(ORDERS_SORT_OPTIONS[0].value);
    setFilterStatus('all_statuses');
    setFilterPaymentStatus('all_payments');
  }, []);

  return {
    sortBy,
    setSortBy,
    filterStatus,
    setFilterStatus,
    filterPaymentStatus,
    setFilterPaymentStatus,
    handleResetFilters
  };
};

// ============================================================================
// PAGE-SPECIFIC CONFIGURATION FUNCTIONS
// ============================================================================

export const createOrdersPageConfig = (
  currentUserProfile: UserProfile | null,
  isFetchingOrders: boolean,
  setIsCreateOrderDialogOpen: (open: boolean) => void,
  fetchOrders: (token: string) => void,
  filterState: ReturnType<typeof useOrdersFilterState>
) => {
  const pageActions: PageAction[] = [];

  // Add Create Order button for sales and super-admin
  if (currentUserProfile && (isSales(currentUserProfile.role) || isSuperAdmin(currentUserProfile.role))) {
    pageActions.push({
      id: 'create-order',
      component: (
        <Button
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 md:px-6 md:py-3 rounded-full shadow-md flex items-center gap-1 md:gap-2 text-sm md:text-base"
          disabled={!currentUserProfile}
          onClick={() => setIsCreateOrderDialogOpen(true)}
        >
          <Plus className="w-4 h-4 md:w-5 md:h-5" />
          <span className="hidden sm:inline">Create</span>
        </Button>
      )
    });
  }

  // Add Refresh button
  pageActions.push({
    id: 'refresh-orders',
    component: (
      <Button
        variant="outline"
        onClick={() => currentUserProfile?.accessToken && fetchOrders(currentUserProfile.accessToken)}
        className="px-3 py-2 md:px-4 md:py-3 rounded-full shadow-md flex items-center gap-1 md:gap-2 bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white text-sm md:text-base"
        disabled={isFetchingOrders || !currentUserProfile}
      >
        {isFetchingOrders ? <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" /> : <RefreshCw className="w-4 h-4 md:w-5 md:h-5" />}
        <span className="hidden md:block">Refresh</span>
      </Button>
    )
  });

  const ordersFilters: OrdersFilterConfig = {
    sortBy: {
      value: filterState.sortBy,
      setValue: filterState.setSortBy,
      options: ORDERS_SORT_OPTIONS
    },
    status: {
      value: filterState.filterStatus,
      setValue: filterState.setFilterStatus,
      options: ORDERS_STATUS_OPTIONS
    },
    paymentStatus: {
      value: filterState.filterPaymentStatus,
      setValue: filterState.setFilterPaymentStatus
    },
    onReset: filterState.handleResetFilters
  };

  return { pageActions, ordersFilters };
};

export const createSimplePageConfig = (
  currentUserProfile: UserProfile | null,
  isLoading: boolean,
  refreshFunction?: (token: string) => void, // Ensure token is passed
  setIsCreateDialogOpen?: (open: boolean) => void, // Changed from createFunction for clarity
  createButtonText?: string,
  createButtonColor?: string
) => {
  const pageActions: PageAction[] = [];

  // Add create button if provided
  if (setIsCreateDialogOpen && currentUserProfile) { // Use setIsCreateDialogOpen to control visibility
    pageActions.push({
      id: 'create-item',
      component: (
        <Button
          className={`${createButtonColor || 'bg-blue-600 hover:bg-blue-700'} text-white px-3 py-2 md:px-6 md:py-3 rounded-full shadow-md flex items-center gap-1 md:gap-2 text-sm md:text-base`}
          disabled={!currentUserProfile}
          onClick={() => setIsCreateDialogOpen(true)} // Call the setter
        >
          <Plus className="w-4 h-4 md:w-5 md:h-5" />
          <span className="hidden sm:inline">{createButtonText || 'Create'}</span>
        </Button>
      )
    });
  }

  // Add refresh button if provided
  if (refreshFunction) {
    pageActions.push({
      id: 'refresh-items',
      component: (
        <Button
          variant="outline"
          onClick={() => currentUserProfile?.accessToken && refreshFunction(currentUserProfile.accessToken)}
          className="px-3 py-2 md:px-4 md:py-3 rounded-full shadow-md flex items-center gap-1 md:gap-2 bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white text-sm md:text-base"
          disabled={isLoading || !currentUserProfile}
        >
          {isLoading ? <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" /> : <RefreshCw className="w-4 h-4 md:w-5 md:h-5" />}
          <span className="hidden md:block">Refresh</span>
        </Button>
      )
    });
  }

  return { pageActions };
};

// ============================================================================
// MAIN UNIVERSAL NAVBAR COMPONENT
// ============================================================================

const UniversalNavBar: React.FC<UniversalNavBarProps> = ({
  currentUserProfile,
  handleLogout,
  searchTerm,
  setSearchTerm,
  searchPlaceholder = "Search...",
  isMenuOpen,
  setIsMenuOpen,
  currentPath,
  availablePages = DEFAULT_PAGES,
  pageActions = [],
  ordersFilters,
  showOrdersFilters = false,
  setShowOrdersFilters,
  companyName = "Acier Steel Pvt. Ltd.",
  companySubtitle = "Streamlined management for all your business needs."
}) => {

  const router = useRouter();

  const pathname = usePathname();
  // Helper function to check if user has required role
  const hasRequiredRole = (requiredRoles?: string[]) => {
    if (!requiredRoles || requiredRoles.length === 0) return true;
    if (!currentUserProfile?.role) return false;
    return requiredRoles.includes(currentUserProfile.role);
  };

  const isCurrentPage = (page: PageConfig) => {
    if (!page?.path) return false;

    // Exact match
    if (pathname === page.path) return true;

    // Handle base path matching for pages like /users when currentPath is /users?id=123
    // This is more robust for cases where actual path includes query params not in page.path
    if (!page.path.includes('?') && pathname.startsWith(page.path) &&
      (pathname.length === page.path.length || pathname[page.path.length] === '/' || pathname[page.path.length] === '?')) {
      return true;
    }

    // Allow for query string matches (if page.path explicitly includes query)
    if (page.path.includes('?') && pathname.includes('?')) {
      const [pagePath, pageQuery] = page.path.split('?');
      const [currentPagePath, currentQuery] = pathname.split('?');
      return pagePath === currentPagePath && pageQuery === currentQuery;
    }

    return false;
  };


  // Check if current page is orders (for showing filters)
  // This logic correctly determines if the current path is the base '/orders' page,
  // excluding paths like '/orders?view=users'.
  const isOrdersPage = currentPath?.startsWith('/orders') && !currentPath?.includes('view=users');


  const handlePageNavigation = (page: PageConfig) => {
    setIsMenuOpen(false);
    router.push(page.path);
  };

  return (
    <header className="bg-gradient-to-r from-blue-50 to-blue-200 sticky top-0 z-10   text-gray-900 px-4 py-3 md:p-6 md:py-3 rounded-b-3xl shadow-lg overflow-hidden ">
      <div className="max-w-9xl mx-auto flex flex-wrap items-center justify-center md:justify-between gap-y-2 md:gap-y-4">
        {/* Company Logo/Title */}
        <div className="flex items-center   space-x-3">
          {/* Logo Container */}
          <div className="flex-shrink-0">
            <Image
              src="/logo.png"
              alt={`${companyName} Logo`}
              width={600}
              height={200}
              className="h-8 w-auto sm:h-12 filter brightness-125 contrast-125"
            />
          </div>

          {/* Text Container */}
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight drop-shadow-lg">
              {companyName}
            </h1>
            <p className="mt-1 text-sm md:text-base text-gray-600 hidden sm:block">
              {companySubtitle}
            </p>
          </div>
        </div>

        {/* Navigation Section */}
        <nav className="flex items-center gap-3 md:gap-5 flex-grow justify-end">
          {/* Search Bar */}
          <div className="relative flex-grow max-w-[200px] sm:max-w-xs md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
            <Input
              type="text"
              placeholder={searchPlaceholder}
              className="pl-10 pr-4 py-2 rounded-full border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:ring-blue-400 focus:border-blue-400 w-full shadow-lg transition-all duration-300 text-sm sm:text-base"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={!currentUserProfile}
            />
          </div>

          {/* Page-specific Actions */}
          {currentUserProfile && pageActions.map((action) => (
            <div key={action.id}>
              {action.component}
            </div>
          ))}

          {/* Common Actions */}
          <div className="flex items-center gap-2 md:gap-3">
            <ThemeToggle />
            {/* Removed Notification Icon */}
            {/* Removed User Profile Icon */}

            {currentUserProfile ? (
              <Button
                onClick={handleLogout}
                className="px-3 py-2.5 md:px-4 rounded-full shadow-md flex items-center gap-1 md:gap-2 bg-red-200 hover:bg-red-300 text-red-800 dark:bg-red-700 dark:hover:bg-red-600 dark:text-white text-sm md:text-base transition-all duration-200 hover:scale-105"
              >
                <LogOut className="w-4 h-4 md:w-5 md:h-5" />
                <span className="hidden md:block">Logout</span>
              </Button>
            ) : (
              <Button
                onClick={() => router.push('/login')}
                className="px-4 py-2 text-sm bg-green-100 hover:bg-green-200 text-green-800 dark:bg-green-700 dark:hover:bg-green-600 dark:text-white rounded-full shadow-md flex items-center gap-1 transition-all duration-200 hover:scale-105"
              >
                <LogIn className="w-4 h-4" />
                <span className="hidden sm:inline ml-1">Login</span>
              </Button>
            )}
          </div>

          {/* Menu */}
          {currentUserProfile && (
            <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  className="px-4 py-2 rounded-full shadow-md bg-blue-50 hover:bg-blue-100 text-blue-800 flex items-center gap-2 flex-shrink-0 border border-blue-200 transition-transform duration-200 hover:scale-105"
                >
                  <Menu className="w-5 h-5" />
                  Menu
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-full sm:w-[320px] bg-gradient-to-b from-blue-50 to-blue-100 p-6 sm:p-8 flex flex-col z-[9999] shadow-2xl  dark:bg-gradient-to-b dark:from-gray-900 dark:to-gray-800 "
              >
                <SheetHeader className="mb-8 border-b border-gray-200 pb-4 dark:border-gray-700">
                  <SheetTitle className="text-3xl font-bold text-gray-900 flex items-center gap-3 dark:text-white">
                    <Settings className="w-8 h-8 text-gray-600 dark:text-gray-400" /> Navigation
                  </SheetTitle>
                </SheetHeader>

                <nav className="flex flex-col gap-3 flex-grow overflow-y-auto pr-2">
                  {/* Dynamic Navigation Buttons */}
                  {availablePages.map((page) => {
                    if (!hasRequiredRole(page.requiresRole)) return null;

                    const isActive = isCurrentPage(page);

                    return (
                      <Button
                        key={page.key}
                        variant="ghost" // Always start with ghost to apply custom classes easily
                        onClick={() => handlePageNavigation(page)}
                        className={`justify-start text-lg px-5 py-3 rounded-xl transition-all duration-300 flex items-center gap-4 border border-transparent
                          ${page.baseClasses || 'bg-gray-100 hover:bg-gray-200 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white'}
                          ${isActive
                            ? page.activeClasses // Use specific activeClasses
                            : ''
                          }`}
                      >
                        <span className="w-6 h-6 flex items-center justify-center text-current"> {/* text-current makes icon inherit button text color */}
                          {page.icon}
                        </span>
                        {page.label}
                      </Button>
                    );
                  })}

                  {/* Orders Filters Section - Only show on orders page */}
                  {isOrdersPage && ordersFilters && setShowOrdersFilters && (
                    <div className="mt-8 border-t border-gray-200 pt-6 dark:border-gray-700">
                      <div
                        className="flex items-center justify-between cursor-pointer mb-4 p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 dark:hover:bg-gray-700"
                        onClick={() => setShowOrdersFilters(!showOrdersFilters)}
                      >
                        <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-3 dark:text-white">
                          <SlidersHorizontal className="w-6 h-6 text-gray-600 dark:text-gray-400" /> Filters
                        </h3>
                        {showOrdersFilters ?
                          <ChevronUp className="w-5 h-5 text-gray-500" /> :
                          <ChevronDown className="w-5 h-5 text-gray-500" />
                        }
                      </div>

                      {showOrdersFilters && (
                        <div className="mt-4 space-y-5 px-2">
                          {/* Sort By Filter */}
                          <div className="space-y-2">
                            <Label htmlFor="sort-by" className="text-base font-medium text-gray-700 dark:text-gray-300">
                              Sort By
                            </Label>
                            <Select value={ordersFilters.sortBy.value} onValueChange={ordersFilters.sortBy.setValue}>
                              <SelectTrigger id="sort-by" className="w-full bg-white border border-gray-300 h-11 text-base text-gray-900 focus:ring-blue-400 focus:border-blue-400 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                                <SelectValue placeholder="Sort by" />
                              </SelectTrigger>
                              <SelectContent className="z-[9999] bg-white text-gray-900 rounded-lg shadow-lg border border-gray-300 dark:bg-gray-700 dark:text-white dark:border-gray-600">
                                {ordersFilters.sortBy.options.map((option) => (
                                  <SelectItem key={option.value} value={option.value} className="text-base py-2 focus:bg-gray-100 dark:focus:bg-gray-600">
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Status Filter */}
                          <div className="space-y-2">
                            <Label htmlFor="filter-status" className="text-base font-medium text-gray-700 dark:text-gray-300">
                              Filter by Status
                            </Label>
                            <Select value={ordersFilters.status.value} onValueChange={ordersFilters.status.setValue}>
                              <SelectTrigger id="filter-status" className="w-full bg-white border border-gray-300 h-11 text-base text-gray-900 focus:ring-blue-400 focus:border-blue-400 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                                <SelectValue placeholder="All Statuses" />
                              </SelectTrigger>
                              <SelectContent className="z-[9999] bg-white text-gray-900 rounded-lg shadow-lg border border-gray-300 dark:bg-gray-700 dark:text-white dark:border-gray-600">
                                <SelectItem value="all_statuses" className="text-base py-2 focus:bg-gray-100 dark:focus:bg-gray-600">All Statuses</SelectItem>
                                {ordersFilters.status.options.map(status => (
                                  <SelectItem key={status} value={status} className="text-base py-2 focus:bg-gray-100 dark:focus:bg-gray-600">
                                    {status}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Payment Status Filter */}
                          <div className="space-y-2">
                            <Label htmlFor="filter-payment-status" className="text-base font-medium text-gray-700 dark:text-gray-300">
                              Filter by Payment Status
                            </Label>
                            <Select value={ordersFilters.paymentStatus.value} onValueChange={ordersFilters.paymentStatus.setValue}>
                              <SelectTrigger id="filter-payment-status" className="w-full bg-white border border-gray-300 h-11 text-base text-gray-900 focus:ring-blue-400 focus:border-blue-400 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                                <SelectValue placeholder="All Payment Statuses" />
                              </SelectTrigger>
                              <SelectContent className="z-[9999] bg-white text-gray-900 rounded-lg shadow-lg border border-gray-300 dark:bg-gray-700 dark:text-white dark:border-gray-600">
                                <SelectItem value="all_payments" className="text-base py-2 focus:bg-gray-100 dark:focus:bg-gray-600">All Payment Statuses</SelectItem>
                                <SelectItem value="regular" className="text-base py-2">Regular</SelectItem>
                                <SelectItem value="new-paid" className="text-base py-2">New Customer - Paid</SelectItem>
                                <SelectItem value="new-unpaid" className="text-base py-2">New Customer - Unpaid</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Reset Filters Button */}
                          <Button
                            variant="outline"
                            onClick={ordersFilters.onReset}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 text-base rounded-lg border-none shadow-md"
                          >
                            Reset Filters
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </nav>

                {/* Footer */}
                <SheetFooter className="mt-auto pt-6 border-t border-gray-200 dark:border-gray-700">
                  {currentUserProfile && (
                    <div className="text-base text-gray-600 dark:text-gray-400">
                      Logged in as: <span className="font-semibold text-gray-900 dark:text-white">{currentUserProfile.email}</span>
                      (<span className="capitalize text-gray-700 dark:text-gray-300">{currentUserProfile.role}</span>)
                    </div>
                  )}
                </SheetFooter>
              </SheetContent>
            </Sheet>
          )}
        </nav>
      </div>
    </header>
  );
};

export default UniversalNavBar;
