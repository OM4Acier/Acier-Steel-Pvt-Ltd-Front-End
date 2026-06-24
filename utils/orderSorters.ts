import { SortMode, ORDER_SORT_MODE, OrderGroupKey, ORDER_GROUPS } from "@/app/orders/constants";
import { DisplayMode, Order } from "@/app/orders/types";
import { useMemo } from "react";


export interface ParsedDeoNumber {
    prefix: string;
    numeric: number;
    suffix: string;
    raw: string;
}

export const parseDeoNumber = (deoNo: string | null | undefined): ParsedDeoNumber => {
    const raw = (deoNo ?? '').trim();
    const match = raw.match(/^([A-Za-z]+)[-\s]*(\d+)(.*)$/);

    if (!match) return { prefix: raw, numeric: 0, suffix: '', raw };

    return {
        prefix: match[1].toUpperCase(),
        numeric: parseInt(match[2], 10),
        suffix: match[3] ?? '',
        raw,
    };
};

export const byDeoThenUpdatedAt = (a: Order, b: Order): number => {
    const ap = parseDeoNumber(a.deoNo);
    const bp = parseDeoNumber(b.deoNo);

    const prefixCmp = ap.prefix.localeCompare(bp.prefix);
    if (prefixCmp !== 0) return prefixCmp;

    const numericCmp = bp.numeric - ap.numeric;
    if (numericCmp !== 0) return numericCmp;

    const suffixCmp = ap.suffix.localeCompare(bp.suffix);
    if (suffixCmp !== 0) return suffixCmp;

    return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '');
};

export const byUpdatedAtThenDeo = (a: Order, b: Order): number => {
    const timeCmp = (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '');
    return timeCmp !== 0 ? timeCmp : byDeoThenUpdatedAt(a, b);
};

export interface OrderFilterParams {
    searchTerm: string;
    filterStatus: string;
    filterPaymentStatus: string;
}

const FILTER_ALL_SENTINEL = new Set(['', 'all_statuses', 'all_payments']);

/** Lower-cases once per call instead of once per field per order */
const matchesText = (value: string | null | undefined, lowerSearch: string): boolean =>
    (value ?? '').toLowerCase().includes(lowerSearch);

export const filterOrders = (orders: Order[], params: OrderFilterParams): Order[] => {
    const { searchTerm, filterStatus, filterPaymentStatus } = params;
    const lowerSearch = searchTerm.toLowerCase();

    const skipSearch = lowerSearch === '';
    const skipStatus = FILTER_ALL_SENTINEL.has(filterStatus);
    const skipPayment = FILTER_ALL_SENTINEL.has(filterPaymentStatus);

    return orders.filter((order) => {
        if (!skipSearch) {
            const hit =
                matchesText(order.deoNo, lowerSearch) ||
                matchesText(order.client, lowerSearch) ||
                matchesText(order.contactNo, lowerSearch) ||
                matchesText(order.organizationContact, lowerSearch) ||
                matchesText(order.products, lowerSearch) ||
                matchesText(order.status, lowerSearch) ||
                matchesText(order.customerPaymentStatus, lowerSearch);
            if (!hit) return false;
        }

        if (!skipStatus && order.status !== filterStatus) return false;
        if (!skipPayment && order.customerPaymentStatus !== filterPaymentStatus) return false;

        return true;
    });
};

/**
 * Now decoupled from displayMode — driven purely by the user's sort preference.
 * displayMode (grouped / timeline) is a layout concern, not a sort concern.
 */
export const getSortComparator = (
    sortMode: SortMode
): ((a: Order, b: Order) => number) => {
    switch (sortMode) {
        case ORDER_SORT_MODE.BY_UPDATED_AT: return byUpdatedAtThenDeo;
        case ORDER_SORT_MODE.BY_DEO:
        default: return byDeoThenUpdatedAt;
    }
};

export type GroupedOrders = Record<OrderGroupKey, Order[]>;

export interface UseGroupedOrdersParams{
    orders: Order[];
    displayMode: DisplayMode;
    sortMode: SortMode;           // ← new
}

export const useGroupedOrders = ({
    orders,
    displayMode,
    sortMode,
}: UseGroupedOrdersParams): GroupedOrders => {
    return useMemo(() => {
        const filtered = orders;
        const comparator = getSortComparator(sortMode);             // ← driven by preference

        return ORDER_GROUPS.reduce<GroupedOrders>((acc, group) => {
            acc[group.key] = filtered
                .filter((o) => group.statuses.includes(o.status as never))
                .sort(comparator);
            return acc;
        }, {} as GroupedOrders);
    }, [orders, sortMode]);
    //           ↑ displayMode removed — it's layout-only, not a sort dependency
};