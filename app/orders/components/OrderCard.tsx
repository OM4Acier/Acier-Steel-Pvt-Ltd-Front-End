// components/OrderCard.tsx - Individual Order Card Component

import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  User as UserIcon,
  Phone,
  Clock,
  CheckCircle,
  Package,
  Truck,
  XCircle,
  Zap, // Added Zap icon for High Priority
  AlertCircle, // Added AlertCircle for unpaid status
} from 'lucide-react';

import { Order } from '../types';

interface OrderCardProps {
  order: Order;
  setSelectedOrder: (order: Order | null) => void;
  statusColors: Record<string, string>;
  statusIcons: Record<string, React.ReactElement>;
  userRole?: string;
}

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  setSelectedOrder,
  statusColors,
  statusIcons,
  userRole,
}) => {
  // Apply visual indication for High Priority, Payment Status, and Poter transport
  const isPoter = order?.details?.transportProvider === 'poter';
  const cardStatusStyle = order.isHighPriority
    ? 'border-2 border-red-500 shadow-xl shadow-red-500/40'
    : order?.customerPaymentStatus === 'new-unpaid'
      ? 'border-2 border-amber-500 shadow-lg shadow-amber-500/30'
      : isPoter
        ? 'border-2 border-violet-500 shadow-lg shadow-violet-500/30'
        : 'border border-gray-300 dark:border-gray-600 hover:shadow-md';

  return (
    <Card
      onClick={() => setSelectedOrder(order)}
      // Card BG is set to dark:bg-gray-900 (slightly darker than content for separation)
      className={`relative cursor-pointer transition-all duration-300 transform hover:-translate-y-1 rounded-xl overflow-hidden min-w-[280px] bg-white dark:bg-gray-900 ${cardStatusStyle}`}
    >
      {/* Poter tag - Clean & Minimal */}
      {isPoter && (
        <div className="absolute top-0 right-0 z-20">
          <div className="bg-violet-600 text-white text-[10px] font-medium uppercase tracking-wide px-3 py-1 rounded-bl-xl shadow-sm">
            Poter
          </div>
        </div>
      )}

      {/* HEADER SECTION: Status (Left) and Badges (Right) */}
      <CardHeader
        className={`p-4 ${statusColors[order.status || 'Order Created']
          } text-white text-lg font-semibold flex items-center justify-between`}
      >
        {/* Left Side: Status Icon and Text (Modified for truncation) */}
        <div className="flex items-center min-w-0">
          {statusIcons[order.status || 'Order Created']}
          <span className="truncate">{order.status}</span>
        </div>

        {/* Right Side: Badges Group (Optimized with flex-shrink-0 and flipped order) */}
        <div className="flex items-center gap-2 flex-shrink-0">

          {/* Unpaid Badge - Simplified to English only */}
          {order?.customerPaymentStatus === 'new-unpaid' && (
            <Badge className="bg-amber-500 text-white font-bold text-[10px] px-2 py-0.5 rounded-full shadow-md animate-pulse border border-white/50">
              UNPAID
            </Badge>
          )}

          {/* DEO No. Badge (Standard Badge) - Now positioned first */}
          <Badge className="bg-white text-black font-bold text-sm px-3 py-1 rounded-full shadow-md">
            {order.deoNo}
          </Badge>

          {/* High Priority Pill (Custom styling for high impact) - Now positioned second */}
          {order.isHighPriority && (
            <span
              className="text-[10px] uppercase tracking-widest rounded-full px-3 py-1 shadow-xl transition-transform duration-300 transform hover:scale-[1.03] flex items-center 
              bg-red-600 text-white shadow-red-500/50 dark:bg-red-700 dark:shadow-red-700/70"
            >
              <Zap className="w-3 h-3 mr-1 fill-white" /> {/* Replaced 🔥 with Zap icon */}
              HIGH PRIORITY
            </span>
          )}
        </div>
      </CardHeader>

      {/* CONTENT SECTION: Optimized for Dark Theme (Lighter BG, Unified Icon Color) */}
    
      <CardContent className="space-y-4 p-4 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
        {/* Transport Badge */}
        {isPoter && (
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300">
            <Truck className="h-4 w-4" />
            <span>Poter Transport</span>
          </div>
        )}

        {/* Client + Contact */}
        <div className="space-y-3">
          <div className="flex items-center text-base">
            <UserIcon className="mr-3 h-5 w-5 text-gray-500 dark:text-gray-400" />
            <span className="font-medium">Client:</span>
            <span className="ml-2">{order.client}</span>
          </div>

          <div className="flex items-start text-base">
            <Phone className="mr-3 mt-0.5 h-5 w-5 flex-shrink-0 text-gray-500 dark:text-gray-400" />
            <div className="min-w-0">
              <span className="font-medium">Contact:</span>
              <span className="ml-2 break-words">
                {order.contactNo || "N/A"}
              </span>
            </div>
          </div>
        </div>

        {/* Payment Warning */}
        {order?.customerPaymentStatus === "new-unpaid" && (
          <div className="flex items-center rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            <AlertCircle className="mr-3 h-5 w-5 flex-shrink-0" />

            <div className="leading-tight">
              <div className="text-xs font-semibold uppercase tracking-wider">
                Unpaid Order
              </div>

              {userRole === "operations" && (
                <div className="mt-0.5 text-sm font-medium">
                  भुगतान लंबित है
                </div>
              )}
            </div>
          </div>
        )}

      </CardContent>
      
    </Card>
  );
};


export const STATUS_ICONS: Record<string, React.ReactElement> = {
  'Order Created': <Clock className="w-4 h-4 mr-2" />,
  'Approved for Production': <CheckCircle className="w-4 h-4 mr-2" />,
  'Ready for Dispatch': <Package className="w-4 h-4 mr-2" />,
  'Dispatched and Invoiced': <Truck className="w-4 h-4 mr-2" />,
  'Completed': <CheckCircle className="w-4 h-4 mr-2" />,
  'Cancelled': <XCircle className="w-4 h-4 mr-2" />,
};
