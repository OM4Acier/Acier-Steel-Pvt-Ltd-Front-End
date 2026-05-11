// components/MainContent.tsx - Main Orders Display Component

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { LayoutGrid, LayoutList } from 'lucide-react';

import { Order,DisplayMode } from '../types';
import { groupOrdersByDate } from '../orderUtils';
import { OrderCard } from './OrderCard';
import { UserProfile } from '@/types/rbac.types';

interface MainContentProps {
  currentUserProfile: UserProfile | null;
  displayMode: DisplayMode;
  setDisplayMode: (mode: DisplayMode) => void;
  filteredAndSortedOrders: Order[];
  ordersCreated: Order[];
  ordersApproved: Order[];
  ordersReadyForDispatch: Order[];
  ordersDispatched: Order[];
  combinedCompletedCancelledOrders: Order[];
  setSelectedOrder: (order: Order | null) => void;
  
  statusColors: Record<string, string>;
  statusIcons: Record<string, React.ReactElement>;
  gridLayoutClasses: string;
}

export const MainContent: React.FC<MainContentProps> = ({
  currentUserProfile,
  displayMode,
  setDisplayMode,
  filteredAndSortedOrders,
  ordersCreated,
  ordersApproved,
  ordersReadyForDispatch,
  ordersDispatched,
  combinedCompletedCancelledOrders,
  setSelectedOrder,
  statusColors,
  statusIcons,
  gridLayoutClasses,
}) => {
  const groupedCompletedCancelledOrders = useMemo(() => {
    return groupOrdersByDate(combinedCompletedCancelledOrders);
  }, [combinedCompletedCancelledOrders]);

  return (
    <>
      {/* Display Mode Toggle */}
      <div className="flex items-center justify-end space-x-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-full shadow-inner border border-gray-200 dark:border-gray-600 mb-6 w-fit ml-auto">
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
      </div>

      {displayMode === 'grouped' ? (
        <div className="space-y-8">
          {/* Order Created Section */}
          {ordersCreated.length > 0 && (
            <Card className="rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <CardHeader className="p-4 bg-sky-500 text-white text-lg font-semibold flex items-center justify-between rounded-t-xl">
                <h2 className="text-2xl font-bold">Orders: Order Created</h2>
                <Badge className="bg-white text-sky-500 font-bold px-3 py-1 rounded-full">
                  {ordersCreated.length}
                </Badge>
              </CardHeader>
              <CardContent className="p-4 overflow-x-auto flex space-x-4">
                {ordersCreated.map((order) => (
                  <OrderCard
                    key={order.id || order.deoNo}
                    order={order}
                    setSelectedOrder={setSelectedOrder}
                    statusColors={statusColors}
                    statusIcons={statusIcons}
                  />
                ))}
              </CardContent>
            </Card>
          )}

          {/* In Progress Section */}
          {(ordersApproved.length > 0 ||
            ordersReadyForDispatch.length > 0 ||
            ordersDispatched.length > 0) && (
            <Card className="rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <CardHeader className="p-4 bg-gray-700 text-white text-lg font-semibold flex items-center justify-between rounded-t-xl">
                <h2 className="text-2xl font-bold">Orders: In Progress</h2>
                <Badge className="bg-white text-gray-700 font-bold px-3 py-1 rounded-full">
                  {ordersApproved.length + ordersReadyForDispatch.length + ordersDispatched.length}
                </Badge>
              </CardHeader>
              <CardContent className={`p-4 ${gridLayoutClasses}`}>
                {ordersApproved.length > 0 && (
                  <div className="col-span-1">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 flex items-center justify-between">
                      Approved for Production
                      <Badge className="bg-green-500 text-white">{ordersApproved.length}</Badge>
                    </h3>
                    <div className="space-y-4">
                      {ordersApproved.map((order) => (
                        <OrderCard
                          key={order.id || order.deoNo}
                          order={order}
                          setSelectedOrder={setSelectedOrder}
                          statusColors={statusColors}
                          statusIcons={statusIcons}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {ordersReadyForDispatch.length > 0 && (
                  <div className="col-span-1">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 flex items-center justify-between">
                      Ready for Dispatch
                      <Badge className="bg-purple-500 text-white">
                        {ordersReadyForDispatch.length}
                      </Badge>
                    </h3>
                    <div className="space-y-4">
                      {ordersReadyForDispatch.map((order) => (
                        <OrderCard
                          key={order.id || order.deoNo}
                          order={order}
                          setSelectedOrder={setSelectedOrder}
                          statusColors={statusColors}
                          statusIcons={statusIcons}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {ordersDispatched.length > 0 && (
                  <div className="col-span-1">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 flex items-center justify-between">
                      Dispatched and Invoiced
                      <Badge className="bg-amber-500 text-white">{ordersDispatched.length}</Badge>
                    </h3>
                    <div className="space-y-4">
                      {ordersDispatched.map((order) => (
                        <OrderCard
                          key={order.id || order.deoNo}
                          order={order}
                          setSelectedOrder={setSelectedOrder}
                          statusColors={statusColors}
                          statusIcons={statusIcons}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Completed/Cancelled Section */}
          {combinedCompletedCancelledOrders.length > 0 && (
            <Card className="rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <CardHeader className="p-4 bg-gray-500 text-white text-lg font-semibold flex items-center justify-between rounded-t-xl">
                <h2 className="text-2xl font-bold">Orders: Completed / Cancelled</h2>
                <Badge className="bg-white text-gray-500 font-bold px-3 py-1 rounded-full">
                  {combinedCompletedCancelledOrders.length}
                </Badge>
              </CardHeader>
              <CardContent className="p-2">
                {Object.keys(groupedCompletedCancelledOrders)
                  .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
                  .map((dateGroup) => (
                    <div key={dateGroup} className="mb-4 last:mb-0">
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 flex items-center justify-between">
                        {dateGroup}
                        <Badge className="bg-gray-500 text-white">
                          {groupedCompletedCancelledOrders[dateGroup].length}
                        </Badge>
                      </h3>
                      <div className={`p-4 ${gridLayoutClasses}`}>
                        {groupedCompletedCancelledOrders[dateGroup].map((order) => (
                          <OrderCard
                            key={order.id || order.deoNo}
                            order={order}
                            setSelectedOrder={setSelectedOrder}
                            statusColors={statusColors}
                            statusIcons={statusIcons}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        // Grid View
        <Card className="rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <CardHeader className="p-4 bg-blue-600 text-white text-lg font-semibold flex items-center justify-between rounded-t-xl">
            <Badge className="bg-white text-blue-600 font-bold px-3 py-1 rounded-full">
              {filteredAndSortedOrders.length} Orders
            </Badge>
          </CardHeader>
          <CardContent className={`p-4 ${gridLayoutClasses}`}>
            {filteredAndSortedOrders.map((order) => (
              <OrderCard
                key={order.id || order.deoNo}
                order={order}
                setSelectedOrder={setSelectedOrder}
                statusColors={statusColors}
                statusIcons={statusIcons}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
};