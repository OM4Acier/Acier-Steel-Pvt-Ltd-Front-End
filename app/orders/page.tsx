// OrdersView.tsx - Main Orders View Component (Refactored)
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

// Import Types
import {
  Order,
  DisplayMode,
  DialogMessageType,
  DeoNumbersByPrefix,
} from './types';

// Import Constants
import {
  STATUS_COLORS,
  PAYMENT_STATUS_GRADIENTS,
  GRID_LAYOUT_CLASSES,
  SORT_MODE_OPTIONS,
  SortMode,
  ORDER_SORT_MODE,
} from './constants';

// Import Services
import { ordersApi } from '@/lib/api/endpoints/ordersApi';
const apiService = ordersApi;

// Import Utilities
import {
  sortOrdersByDeo,
} from './orderUtils';

// Import Components
import { MainContent } from './components/MainContent';
import { CreateOrderDialog } from './components/CreateOrderDialog';
import { OrderDetailsDialog } from './components/OrderDetailsDialog';
import { STATUS_ICONS } from './components/OrderCard';
import { ArrowUpDown, LayoutGrid, LayoutList } from 'lucide-react';
import { useGroupedOrders } from '@/utils/orderSorters';
import { NavbarExtension } from '@/context/NavbarExtensionContext';
import { Switch } from '@/components/ui/switch';
import { useUser } from '@clerk/nextjs';
import { usePermissionStore } from '@/stores/permission-store';
import { NavButton } from '@/components/NavButton';
import { getCreateShortcuts } from '@/lib/config/routes';
import { UserProfile } from '@/types/rbac.types';

interface SortSelectorProps {
  value: SortMode;
  onChange: (mode: SortMode) => void;
}

const SortSelector = ({ value, onChange }: SortSelectorProps) => (
  <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
    <ArrowUpDown className="ml-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    {SORT_MODE_OPTIONS.map((option) => {
      const active = value === option.value;
      return (
        <button
          key={option.value}
          type="button"
          title={option.description}
          onClick={() => onChange(option.value)}
          className={[
            'rounded-md px-3 py-1 text-sm font-medium transition-colors',
            active
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          ].join(' ')}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);

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
  const [displayMode, setDisplayMode] = useState<DisplayMode>('grouped');
  const [dialogMessage, setDialogMessage] = useState<DialogMessageType>({ type: '', text: '' });

  // Dialog State
  const [isCreateOrderDialogOpen, setIsCreateOrderDialogOpen] = useState(false);


  // DEO Numbers State
  const [nextDeoNumbers, setNextDeoNumbers] = useState<DeoNumbersByPrefix>({});



  // ============================================================================
  // Authentication & Session Management
  // ============================================================================

  // Use Clerk directly for synchronous user data
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const role = usePermissionStore(s => s.role);

  // Map Clerk user to the legacy UserProfile shape
  const currentUserProfile = useMemo(() => {
    if (!clerkUser) return null;
    return {
      id: clerkUser.id,
      name: clerkUser.fullName || clerkUser.username || 'User',
      email: clerkUser.primaryEmailAddress?.emailAddress || '',
      role: role || (clerkUser.publicMetadata?.role as string) || 'sales',
      accessToken: null, // Deprecated, handled by interceptors
    } as UserProfile;
  }, [clerkUser, role]);


  useEffect(() => {
    if (searchParams.get('action') === 'create') {
      setIsCreateOrderDialogOpen(true);

      // Remove 'action=create' from the URL so it can be triggered again without refresh
      const params = new URLSearchParams(searchParams.toString());
      params.delete('action');
      const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      router.replace(newUrl, { scroll: false });
    }
  }, [searchParams, pathname, router]);



  // Data Fetching Logic
  const fetchOrders = useCallback(async () => {
    setIsFetchingOrders(true);
    try {
      // apiClient handles tokens via ClerkTokenProvider interceptor
      const fetchedOrders = await apiService.fetchOrders();
      setOrders(fetchedOrders);
    } catch (error: any) {
      if (error.message === 'Request cancelled') return;
      console.error('Error fetching orders:', error);
      toast.error(`Failed to fetch orders: ${error.message}`);
    } finally {
      setIsFetchingOrders(false);
    }
  }, []);

  // Trigger fetch when clerk is loaded and user is present
  useEffect(() => {
    if (clerkLoaded && clerkUser) {
      fetchOrders();
    }
  }, [clerkLoaded, clerkUser, fetchOrders]);



  const fetchAndSetDeoNumbers = useCallback(async () => {
    try {
      // 1. Fetch the full response object
      // apiClient/interceptor handles tokens
      const response = await apiService.fetchRecentOrderNumbers();

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
      if (error.message === 'Request cancelled') return;
      toast.error(`Failed to fetch recent order numbers: ${error.message}`);
      setNextDeoNumbers({});
    }
  }, []);

  useEffect(() => {
    if (clerkLoaded && clerkUser) {
      fetchAndSetDeoNumbers();
    }
  }, [clerkLoaded, clerkUser, fetchAndSetDeoNumbers]);

  // ============================================================================
  // Logout Handler
  // ============================================================================


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
    const filtered = orders;
    return sortOrdersByDeo(filtered, displayMode);
  }, [orders, displayMode]);

  // Group orders by status

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



  // ── state ──────────────────────────────────────────────────────
  const [sortMode, setSortMode] = useState<SortMode>(ORDER_SORT_MODE.BY_DEO);

  const { created, approved, ready_for_dispatch, dispatched, closed } = useGroupedOrders({
    orders,
    displayMode,
    sortMode
  });



  // ============================================================================
  // User Action Handlers
  // ============================================================================

  const handleUserActionComplete = () => {
    if (currentUserProfile) {
      fetchOrders();
    }
  };

  // ============================================================================
  // Render
  // ============================================================================


  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">

      <NavbarExtension>
        {/* ── Sort preference ── */}
        <SortSelector value={sortMode} onChange={setSortMode} />

        {/* ── Divider ── */}
        <div className="h-5 w-px bg-gray-300 dark:bg-gray-500 mx-1" />

        {/* ── Layout toggle ── */}
        <LayoutList
          className={`w-5 h-5 ${displayMode === 'grouped' ? 'text-blue-600' : 'text-gray-400'}`}
        />
        <Switch
          id="display-mode"
          checked={displayMode === 'grid'}
          onCheckedChange={(checked) => setDisplayMode(checked ? 'grid' : 'grouped')}
          disabled={!currentUserProfile}
        />
        <LayoutGrid
          className={`w-5 h-5 ${displayMode === 'grid' ? 'text-blue-600' : 'text-gray-400'}`}
        />

        {currentUserProfile && getCreateShortcuts(currentUserProfile.role).some(s => s.id === 'order') && (
          <NavButton
            type="crate"
            text="New Order"
            className=""
            onClick={() => setIsCreateOrderDialogOpen(true)}
            isLoading={isFetchingOrders}
          />
        )}


        <NavButton
          type="refresh"
          onClick={() => handleUserActionComplete()}
          isLoading={isFetchingOrders}
        />

      </NavbarExtension>




      <main className="max-w-full mx-auto px-4 md:px-10 py-6 sm:px-6 mt-6">
        {currentUserProfile ? (
            <MainContent
              displayMode={displayMode}
              filteredAndSortedOrders={filteredAndSortedOrders}
              ordersCreated={created}
              ordersApproved={approved}
              ordersReadyForDispatch={ready_for_dispatch}
              ordersDispatched={dispatched}
              combinedCompletedCancelledOrders={closed}
              setSelectedOrder={setSelectedOrder}
              statusColors={STATUS_COLORS}
              statusIcons={STATUS_ICONS}
              gridLayoutClasses={GRID_LAYOUT_CLASSES}
            />
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
          if (currentUserProfile) {
            fetchOrders();
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
          if (currentUserProfile) {
            fetchOrders();
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