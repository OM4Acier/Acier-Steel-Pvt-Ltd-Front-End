// OrdersView.tsx - Main Orders View Component (Refactored)
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

import UniversalNavBar, {
  useNavbarState,
  createOrdersPageConfig,
  useOrdersFilterState,
} from '@/components/NavBar';

// Import Types
import {
  Order,
  ViewType,
  DisplayMode,
  DialogMessageType,
  DeoNumbersByPrefix,
} from './types';

// Import Constants
import {
  STATUS_COLORS,
  PAYMENT_STATUS_GRADIENTS,
  GRID_LAYOUT_CLASSES,
} from './constants';

// Import Services
import { apiService } from './apiService';

// Import Utilities
import {
  filterOrders,
  sortOrdersByDeo,
} from './orderUtils';

// Import Components
import { MainContent } from './components/MainContent';
import { UserManagementPanel } from './components/UserManagementPanel';
import { CreateOrderDialog } from './components/CreateOrderDialog';
import { OrderDetailsDialog } from './components/OrderDetailsDialog';
import { STATUS_ICONS } from './components/OrderCard';
import { useProtectedRoute } from '@/hooks/useProtectedRoute';






export default function OrdersView() {
  // Router & Path
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Authentication State
  //const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);


  // Orders State
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isFetchingOrders, setIsFetchingOrders] = useState(false);

  // UI State
  const [searchTerm, setSearchTerm] = useState('');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('grouped');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [dialogMessage, setDialogMessage] = useState<DialogMessageType>({ type: '', text: '' });

  // Dialog State
  const [isCreateOrderDialogOpen, setIsCreateOrderDialogOpen] = useState(false);

  // View Management
  const rawView = searchParams.get('view');
  const viewParam: ViewType | null =
    rawView === 'orders' ? 'orders' : rawView === 'users' ? 'users' : null;
  const [currentPage, setCurrentPage] = useState<ViewType>('orders');

  // DEO Numbers State
  const [nextDeoNumbers, setNextDeoNumbers] = useState<DeoNumbersByPrefix>({});

  // Navbar State
  const { showOrdersFilters, setShowOrdersFilters } = useNavbarState();
  const ordersFilterState = useOrdersFilterState();

  // ============================================================================
  // Authentication & Session Management
  // ============================================================================

// Use the hook as the single source of truth for Auth
const { user: currentUserProfile } = useProtectedRoute({
 allowedRoles: ['super-admin', 'sales', 'operations', 'accountant'],
});

// Logic to handle Role-Based UI settings
useEffect(() => {
  if (!currentUserProfile) return;

  // Set display mode based on role
  if (['super-admin', 'sales', 'accountant'].includes(currentUserProfile.role)) {
    setDisplayMode('grouped');
  } else if (currentUserProfile.role === 'operations') {
    setDisplayMode('grid');
  }
}, [currentUserProfile]);

// Sync currentPage with URL view param
useEffect(() => {
  if (viewParam && viewParam !== currentPage) {
    setCurrentPage(viewParam);
  }
}, [viewParam, currentPage]);

// Data Fetching Logic
const fetchOrders = useCallback(async (token: string) => {
  if (!token) return;
  
  setIsFetchingOrders(true);
  try {
    const fetchedOrders = await apiService.fetchOrders(token);
    setOrders(fetchedOrders);
  } catch (error: any) {
    console.error('Error fetching orders:', error);
    toast.error(`Failed to fetch orders: ${error.message}`);
  } finally {
    setIsFetchingOrders(false);
  }
}, []);

// Trigger fetch when profile is loaded and has a token
useEffect(() => {
  const token = currentUserProfile?.accessToken || localStorage.getItem('accessToken');
  if (token) {
    fetchOrders(token);
  }
}, [currentUserProfile, fetchOrders]);



const fetchAndSetDeoNumbers = useCallback(async () => {
  if (!currentUserProfile?.accessToken) {
    toast.error('Please log in to fetch DEO numbers.');
    return;
  }

  try {
    // 1. Fetch the full response object
    const response = await apiService.fetchRecentOrderNumbers(
      currentUserProfile.accessToken
    );

    // 2. Check for success and ensure data exists
    if (!response.success || !Array.isArray(response.data)) {
      throw new Error('Invalid data format received from server.');
    }

    const nextMap: DeoNumbersByPrefix = {};

    // 3. Iterate through the array to build your state objects
    response.data.forEach((item) => {
      const { prefix, recentDeoNo, nextDeoNo } = item;

      

      nextMap[prefix] = {
        recentDeoNo: recentDeoNo,
        nextDeoNo: nextDeoNo, // Using the server-calculated value directly
      };
    });
    setNextDeoNumbers(nextMap);

  } catch (error: any) {
    toast.error(`Failed to fetch recent order numbers: ${error.message}`);
    setNextDeoNumbers({});
  }
}, [currentUserProfile?.accessToken]);

  // ============================================================================
  // Logout Handler
  // ============================================================================


const handleLogout = async () => {
  try {
    await apiService.logoutUser();
    // Clear local storage and redirect
    localStorage.clear();
    toast.success('Logged out successfully!');
    router.push(`/login?returnTo=${encodeURIComponent(window.location.href)}`);
  } catch (error: any) {
    toast.error(`Logout failed: ${error.message}`);
  }
};
  // ============================================================================
  // Message Handling
  // ============================================================================

  const handleShowMessage = useCallback((message: DialogMessageType) => {
    setDialogMessage(message);
  }, []);

  useEffect(() => {
    if (dialogMessage.text) {
      switch (dialogMessage.type) {
        case 'success':
          toast.success(dialogMessage.text);
          break;
        case 'error':
          toast.error(dialogMessage.text);
          break;
        case 'warning':
          toast.warning(dialogMessage.text);
          break;
        default:
          toast(dialogMessage.text);
      }
    }
  }, [dialogMessage]);

  // ============================================================================
  // Order Filtering & Sorting
  // ============================================================================

  const filteredAndSortedOrders = useMemo(() => {
    const filtered = filterOrders(
      orders,
      searchTerm,
      ordersFilterState.filterStatus,
      ordersFilterState.filterPaymentStatus
    );
    return sortOrdersByDeo(filtered, displayMode);
  }, [orders, searchTerm, ordersFilterState, displayMode]);

  // Group orders by status
  const ordersCreated = filteredAndSortedOrders.filter((o) => o.status === 'Order Created');
  const ordersApproved = filteredAndSortedOrders.filter(
    (o) => o.status === 'Approved for Production'
  );
  const ordersReadyForDispatch = filteredAndSortedOrders.filter(
    (o) => o.status === 'Ready for Dispatch'
  );
  const ordersDispatched = filteredAndSortedOrders.filter(
    (o) => o.status === 'Dispatched and Invoiced'
  );

  const sortedOrdersCompleted = filteredAndSortedOrders.filter((o) => o.status === 'Completed');
  const sortedOrdersCancelled = filteredAndSortedOrders.filter((o) => o.status === 'Cancelled');
  const combinedCompletedCancelledOrders = [...sortedOrdersCompleted, ...sortedOrdersCancelled];

  if (displayMode === 'grouped') {
    combinedCompletedCancelledOrders.sort((a, b) => {
      const aParsed = parseDeoNumber(a.deoNo);
      const bParsed = parseDeoNumber(b.deoNo);
      if (aParsed.base === bParsed.base) {
        return bParsed.suffixNum - aParsed.suffixNum;
      }
      return bParsed.base.localeCompare(aParsed.base);
    });
  }

  // ============================================================================
  // Navbar Configuration
  // ============================================================================

  const { pageActions, ordersFilters } = createOrdersPageConfig(
    currentUserProfile,
    isFetchingOrders,
    setIsCreateOrderDialogOpen,
    fetchOrders,
    ordersFilterState
  );

  // ============================================================================
  // User Action Handlers
  // ============================================================================

  const handleUserActionComplete = () => {
    if (currentUserProfile?.accessToken) {
      fetchOrders(currentUserProfile.accessToken);
    }
  };

  // ============================================================================
  // Render
  // ============================================================================


  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <UniversalNavBar
        currentUserProfile={currentUserProfile}
        isLoggedIn={!!currentUserProfile}
        handleLogout={handleLogout}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        searchPlaceholder="Search orders..."
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
        currentPath={pathname}
        pageActions={pageActions}
        ordersFilters={ordersFilters}
        showOrdersFilters={showOrdersFilters}
        setShowOrdersFilters={setShowOrdersFilters}
      />

      <main className="max-w-full mx-auto px-4 md:px-10 py-6 sm:px-6 mt-6">
        {currentUserProfile ? (
          currentPage === 'orders' ? (
            <MainContent
              currentUserProfile={currentUserProfile}
              displayMode={displayMode}
              setDisplayMode={setDisplayMode}
              filteredAndSortedOrders={filteredAndSortedOrders}
              ordersCreated={ordersCreated}
              ordersApproved={ordersApproved}
              ordersReadyForDispatch={ordersReadyForDispatch}
              ordersDispatched={ordersDispatched}
              combinedCompletedCancelledOrders={combinedCompletedCancelledOrders}
              setSelectedOrder={setSelectedOrder} 
              statusColors={STATUS_COLORS}
              statusIcons={STATUS_ICONS}
              gridLayoutClasses={GRID_LAYOUT_CLASSES}
            />
          ) : (
            <UserManagementPanel
              currentUser={currentUserProfile}
              onShowMessage={handleShowMessage}
              onUserActionComplete={handleUserActionComplete}
            />
          )
        ) : (
          <div className="col-span-full text-center py-10 text-gray-500 dark:text-gray-400 text-lg">
            Please log in to view the application.
          </div>
        )}
      </main>

      {/* Dialogs */}
      <CreateOrderDialog
        isOpen={isCreateOrderDialogOpen}
        onClose={() => setIsCreateOrderDialogOpen(false)}
        currentUserProfile={currentUserProfile}

        nextDeoNumbers={nextDeoNumbers}
        fetchDeoNumbers={fetchAndSetDeoNumbers}
        onOrderCreated={() => {
          if (currentUserProfile?.accessToken) {
            fetchOrders(currentUserProfile.accessToken);
          }
        }}
        onShowMessage={handleShowMessage}
      />

      <OrderDetailsDialog
        isOpen={!!selectedOrder}
        onClose={() => {
          setSelectedOrder(null);
        }}
        order={selectedOrder}
        
        currentUserProfile={currentUserProfile}
        onOrderUpdated={() => {
          if (currentUserProfile?.accessToken) {
            fetchOrders(currentUserProfile.accessToken);
          }
        }}
        onShowMessage={handleShowMessage}
        paymentStatusGradients={PAYMENT_STATUS_GRADIENTS}
      />
    </div>
  );
}

// Helper function (kept local for compatibility)
function parseDeoNumber(deo: string | undefined | null) {
  const deoString = String(deo || '');
  const match = deoString.match(/^(.*?)(-([A-Z]))?$/);
  const base = match ? match[1] : deoString;
  const suffixChar = match ? match[3] : undefined;
  const suffixNum = suffixChar ? suffixChar.charCodeAt(0) - 'A'.charCodeAt(0) + 1 : 0;
  return { base, suffixNum };
}