// orderUtils.ts - Order Management Utilities

import { Order, DisplayMode } from './types';
import { STATUS_ORDER } from './constants';

export const parseDeoNumber = (deo: string | undefined | null) => {
  const deoString = String(deo || '');
  const match = deoString.match(/^(.*?)(-([A-Z]))?$/);
  const base = match ? match[1] : deoString;
  const suffixChar = match ? match[3] : undefined;
  const suffixNum = suffixChar ? suffixChar.charCodeAt(0) - 'A'.charCodeAt(0) + 1 : 0;
  return { base, suffixNum };
};

export const sortOrdersByDeo = (
  orders: Order[],
  displayMode: DisplayMode,
  ascending: boolean = true
): Order[] => {
  return [...orders].sort((a, b) => {
    const aParsed = parseDeoNumber(a.deoNo);
    const bParsed = parseDeoNumber(b.deoNo);

    if (displayMode === 'grid') {
      // Descending order for grid view
      if (aParsed.base === bParsed.base) {
        return bParsed.suffixNum - aParsed.suffixNum;
      }
      return bParsed.base.localeCompare(aParsed.base);
    } else {
      // Ascending or descending based on parameter
      if (aParsed.base === bParsed.base) {
        return ascending
          ? aParsed.suffixNum - bParsed.suffixNum
          : bParsed.suffixNum - aParsed.suffixNum;
      }
      return ascending
        ? aParsed.base.localeCompare(bParsed.base)
        : bParsed.base.localeCompare(aParsed.base);
    }
  });
};

export const sortOrdersByStatus = (orders: Order[]): Order[] => {
  return [...orders].sort((a, b) => {
    const indexA = STATUS_ORDER.indexOf(a.status || '');
    const indexB = STATUS_ORDER.indexOf(b.status || '');
    return indexA - indexB;
  });
};


export const generateNextPartDeliveryDeoNo = (
  baseDeoNo: string,
  orders: Order[]
): string | null => {
  const existingPartDeoRegex = new RegExp(`^${baseDeoNo}-([A-Z])$`);

  const existingSuffixes = orders
    .filter((order) => order.deoNo.match(existingPartDeoRegex))
    .map((order) => order.deoNo.match(existingPartDeoRegex)![1]);

  let maxSuffixChar = '';
  if (existingSuffixes.length > 0) {
    maxSuffixChar = existingSuffixes.reduce((max, current) => (current > max ? current : max), '');
  }

  let nextSuffix: string;
  if (maxSuffixChar === '') {
    nextSuffix = 'A';
  } else {
    const nextCharCode = maxSuffixChar.charCodeAt(0) + 1;
    if (nextCharCode > 'Z'.charCodeAt(0)) {
      return null; // Exceeded limit
    }
    nextSuffix = String.fromCharCode(nextCharCode);
  }
  return `${baseDeoNo}-${nextSuffix}`;
};

export const groupOrdersByDate = (orders: Order[]): Record<string, Order[]> => {
  const grouped: Record<string, Order[]> = {};

  orders.forEach((order) => {
    // Prefer the invoice issue date (set when an order is Completed). Fall back
    // to updatedAt so non-Completed / legacy orders (which never get an invoice
    // issue date) remain visible in the grouped view instead of being dropped.
    const dateValue = order.details?.invoiceIssueDate || order.updatedAt;
    if (!dateValue) return;
    const date = new Date(dateValue);
    const year = date.getFullYear();
    const month = date.toLocaleString('default', { month: 'long' });
    const day = date.getDate().toString().padStart(2, '0');
    const groupKey = `${day} ${month} ${year}`;

    if (!grouped[groupKey]) {
      grouped[groupKey] = [];
    }
    grouped[groupKey].push(order);
  });

  // Sort orders within each date group — newest first
  Object.keys(grouped).forEach((key) => {
    grouped[key].sort((a, b) => {
      const aValue = new Date(a.details?.invoiceIssueDate || a.updatedAt || 0).getTime();
      const bValue = new Date(b.details?.invoiceIssueDate || b.updatedAt || 0).getTime();
      return bValue - aValue;
    });
  });

  return grouped;
};

export const validateOrderData = (orderData: Partial<Order>): string | null => {
  if (!orderData.deoNo) return 'DEO No. is required.';
  if (!orderData.client?.trim()) return 'Client Name is required.';
  if (!orderData.contactNo?.trim()) return 'Contact No. is required.';
  
  if (orderData.contactNo.trim().length !== 10 || !/^\d{10}$/.test(orderData.contactNo.trim())) {
    return 'Contact No. must be exactly 10 digits.';
  }
  
  if (!orderData.products?.trim()) return 'Product Details are required.';
  
  return null;
};