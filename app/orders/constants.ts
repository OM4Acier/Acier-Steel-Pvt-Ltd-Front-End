// constants.ts

// TODO: Implement
// constants.ts - Application Constants

import { OrderStatus } from './types';

export const BASE_API_URL = process.env.NEXT_PUBLIC_BASE_API_URL || 'http://localhost:3000';

export const STATUS_ORDER: OrderStatus[] = [
  'Order Created',
  'Approved for Production',
  'Ready for Dispatch',
  'Dispatched and Invoiced',
  'Completed',
  'Cancelled',
];

export const STATUS_COLORS: Record<string, string> = {
  'Order Created': 'bg-sky-500',
  'Approved for Production': 'bg-green-500',
  'Ready for Dispatch': 'bg-purple-500',
  'Dispatched and Invoiced': 'bg-amber-500',
  'Completed': 'bg-emerald-600',
  'Cancelled': 'bg-rose-600',
};




export const PAYMENT_STATUS_COLORS: Record<string, string> = {
  'regular': 'bg-green-200 text-green-800 dark:bg-sky-600 dark:text-white',
  'new-paid': 'bg-emerald-200 text-emerald-800 dark:bg-emerald-600 dark:text-white',
  'new-unpaid': 'bg-red-200 text-red-800 dark:bg-red-600 dark:text-white',
};

export const PAYMENT_STATUS_GRADIENTS: Record<string, string> = {
  'regular': 'bg-gradient-to-br from-blue-100 via-blue-50 to-blue-100 dark:from-blue-950 dark:via-gray-800 dark:to-blue-950',
  'new-paid': 'bg-gradient-to-br from-emerald-100 via-emerald-50 to-emerald-100 dark:from-emerald-950 dark:via-gray-800 dark:to-emerald-950',
  'new-unpaid': 'bg-gradient-to-br from-red-100 via-red-50 to-red-100 dark:from-red-950 dark:via-gray-800 dark:to-red-950',
};

export const GRID_LAYOUT_CLASSES = 'grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3';

export const FILE_COMPRESSION_CONFIG = {
  MAX_WIDTH: 1200,
  MAX_HEIGHT: 1200,
  JPEG_QUALITY: 0.8,
  ACCEPTED_FILE_TYPES: '.jpg,.jpeg,.png,.pdf,.webp,.ogg',
};

export const STATUS_TRANSITIONS: Record<string, string[]> = {
  'Order Created': ['Approved for Production', 'Cancelled'],
  'Approved for Production': ['Ready for Dispatch', 'Cancelled'],
  'Ready for Dispatch': ['Dispatched and Invoiced', 'Cancelled'],
  'Dispatched and Invoiced': ['Completed', 'Cancelled'],
  'Completed': [],
  'Cancelled': [],
  '': ['Order Created'],
};