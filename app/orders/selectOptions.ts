// app/orders/selectOptions.ts
// SINGLE SOURCE OF TRUTH for all selectable option lists used across the
// orders feature. Every component (`CreateOrderDialog`, `ClientStatusCard`,
// `DeliveryVehicleCard`, …) reads from here instead of hard-coding its own
// <SelectItem> lists. The underlying values/labels are derived from the
// enums + label maps in `types.ts`, so they can never drift apart.
import {
  CustomerPaymentStatus,
  CUSTOMER_PAYMENT_STATUS_LABELS,
  TRANSPORT_PROVIDER_LABELS,
  MEASUREMENT_KATA_LABELS,
  TransportProvider,
  MeasurementKata,
} from './types';
import { SelectOption } from '@/components/ui/SelectDropdown';

/** Build an option list from a value→label record (preserves enum order). */
const fromLabelRecord = <T extends string>(record: Record<T, string>): SelectOption[] =>
  (Object.keys(record) as T[]).map((key) => ({ value: key, label: record[key] }));

// ─── Customer Payment Status ────────────────────────────────────────────────
// value + label both come from types.ts (Credit Note / New - Paid / New - Unpaid / Regular)
export const PAYMENT_STATUS_OPTIONS: SelectOption[] = (
  Object.keys(CUSTOMER_PAYMENT_STATUS_LABELS) as CustomerPaymentStatus[]
).map((key) => {
  const colorClass =
    key === CustomerPaymentStatus.NEW_PAID
      ? 'text-green-600'
      : key === CustomerPaymentStatus.NEW_UNPAID
        ? 'text-orange-600'
        : key === CustomerPaymentStatus.REGULAR
          ? 'text-gray-600'
          : '';
  return {
    value: key,
    label: CUSTOMER_PAYMENT_STATUS_LABELS[key],
    className: `rounded-xl font-bold py-2.5 ${colorClass}`,
  };
});

// ─── Transport Provider ─────────────────────────────────────────────────────
export const TRANSPORT_PROVIDER_OPTIONS: SelectOption[] = fromLabelRecord(
  TRANSPORT_PROVIDER_LABELS as Record<TransportProvider, string>,
);

// ─── Measurement Kata ──────────────────────────────────────────────────────
export const MEASUREMENT_KATA_OPTIONS: SelectOption[] = fromLabelRecord(
  MEASUREMENT_KATA_LABELS as Record<MeasurementKata, string>,
);

// ─── Order Status ──────────────────────────────────────────────────────────
export const ORDER_STATUS_OPTIONS: SelectOption[] = [
  'Order Created',
  'Approved for Production',
  'Ready for Dispatch',
  'Dispatched and Invoiced',
  'Completed',
  'Cancelled',
].map((s) => ({ value: s, label: s }));

// ─── Shipping Address sentinels (static, non-customer options) ─────────────
// Dynamic per-customer addresses are appended at the call site via children.
export const SHIPPING_SENTINEL_OPTIONS: SelectOption[] = [
  { value: 'Ask for client', label: 'Ask for Client' },
  { value: 'same-as-billing', label: 'Same as Billing Address' },
];

/** Helper: take the static shipping sentinels + dynamic addresses into one list. */
export const buildShippingOptions = (addresses: string[] = []): SelectOption[] => [
  ...SHIPPING_SENTINEL_OPTIONS,
  ...addresses.map((addr) => ({ value: addr, label: addr })),
];
