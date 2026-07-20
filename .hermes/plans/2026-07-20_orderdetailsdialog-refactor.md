# OrderDetailsDialog Performance Refactor — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Eliminate the 400–450ms click/input handler violations in `OrderDetailsDialog` by splitting the monolithic ~2090-line component into memoized card sub-components, so editing one field only re-renders that card instead of the entire dialog.

**Architecture:** Extract the four rendered cards (Client & Status, Delivery & Vehicle, Product, Invoice) and the Footer actions into separate `React.memo` components in `app/orders/components/cards/`. The parent `OrderDetailsDialog` keeps all state and handlers (they already exist and are stable). Each card receives a *narrow slice* of `displayOrder` + stable callback props, so `React.memo` skips re-rendering unrelated cards when a single field changes. `AudioManager` is already memoized (done earlier). No behavior change — purely a render-performance refactor.

**Tech Stack:** React 18 + Next.js (App Router, `"use client"` not needed since it's already a client component via `onClick`/hooks), TypeScript, Tailwind. Existing UI primitives (`@/components/ui/*`), `lucide-react` icons.

---

## Current Context / Assumptions

- `app/orders/components/OrderDetailsDialog.tsx` is a single component, 2091 lines, re-rendering fully on every `pendingChanges`/`displayOrder` change (every keystroke, every focus/click on any field).
- Performance violations observed in DevTools:
  - `[Violation] 'click' handler took 435ms`
  - `[Violation] Forced reflow while executing JavaScript took 89ms`
  - `[Violation] Handling of 'wheel' input event was delayed for 107ms`
- Root cause: whole-tree reconciliation of the giant component. The 89ms forced reflow is layout thrash over thousands of DOM nodes. `getInvoiceIssueDateBounds()` is NOT the cause (microseconds); native `min`/`max` blocking was already removed; today/-1-day rule is enforced at submission time (already implemented).
- All handlers (`handleTextChange`, `handleUpdateOrderStatus`, audio handlers, etc.) and `displayOrder`/`pendingChanges` state live in the parent and will be passed down.
- The four "card" sections in the RENDER block are at these line ranges (read-only reference, will be cut/pasted):
  - Client & Status Card: ~994–1235
  - Delivery & Vehicle Card: ~1236–1516
  - Product Details Card: ~1519–1665
  - Invoice Details Card: ~1666–1849
  - Footer / Action Buttons: ~1850 to end
- `AudioManager` already wrapped in `React.memo` (prior change). The two usages already pass stable `useCallback` handlers + `EMPTY_AUDIO_FILES` constant. Keep as-is.

## Proposed Approach

1. Create `app/orders/components/cards/` directory.
2. Add a shared types file `app/orders/components/cards/cardTypes.ts` exporting the prop interfaces used by cards (so sub-files stay typed and DRY).
3. Extract each card into its own memoized file. Each card is a pure presentational component: receives a *slice* of the order data it needs + the relevant stable callbacks + permission-gated booleans. It does NOT receive the whole `displayOrder` object (otherwise memo breaks — any field change replaces the object reference).
4. Parent passes pre-sliced props (e.g. `client={displayOrder?.client}`, `contactNo={displayOrder?.contactNo}`, `details={displayOrder?.details}`) and the already-stable handlers. Because each prop is a primitive or a stable sub-object/function, `React.memo` only re-renders a card whose own props changed.
5. Keep all state, effects, and async handlers in the parent. The parent still owns `displayOrder`, `pendingChanges`, `isEditMode`, role flags.
6. Replace inline JSX sections in the parent RENDER with `<ClientStatusCard .../>` etc.
7. Verify: `tsc --noEmit`, `npm run lint`, `npm run build` all green. Manual: open an order, type in Invoice Issue Date → invoice card updates, other cards do NOT re-render (verify via React DevTools "highlight updates" or by confirming no recompute of sibling card effects).

## Key Design Decision: narrow props, not whole object

`React.memo` does a shallow prop compare. If we pass `displayOrder={displayOrder}` (the merged full object), it changes identity on EVERY keystroke (because `displayOrder` is rebuilt via `useMemo` dependent on `pendingChanges`), so every card re-renders anyway. Therefore each card gets only the fields it renders. Example for Client & Status card props:

```ts
interface ClientStatusCardProps {
  isEditMode: boolean;
  role: UserRole | null;
  status: OrderStatus | undefined;
  customerPaymentStatus: CustomerPaymentStatus | undefined;
  client: string;
  contactNo: string;
  organizationContact: string;
  partDelivery: boolean;
  isHighPriority: boolean;
  orderDate: string | undefined;
  isAdditionalInfoOpen: boolean;
  onAdditionalInfoToggle: () => void;
  onTextChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onPaymentStatusChange: (value: string) => void;
  onPartDeliveryChange: (checked: boolean) => void;
  onHighPriorityChange: (checked: boolean) => void;
  onStatusSelectChange: (value: string) => void;
}
```

All handler props are stable (already `useCallback` or stable closures). `isEditMode`, `role`, `status`, `customerPaymentStatus`, and the individual field primitives only change when that card's data changes — so sibling cards stay memoized.

## Files Likely To Change

- Create: `app/orders/components/cards/cardTypes.ts`
- Create: `app/orders/components/cards/ClientStatusCard.tsx`
- Create: `app/orders/components/cards/DeliveryVehicleCard.tsx`
- Create: `app/orders/components/cards/ProductDetailsCard.tsx`
- Create: `app/orders/components/cards/InvoiceDetailsCard.tsx`
- Create: `app/orders/components/cards/OrderActionsFooter.tsx`
- Modify: `app/orders/components/OrderDetailsDialog.tsx` (remove extracted JSX, import + render the 5 new cards, add a couple of stable `useCallback` wrappers if needed)

No backend, no API, no test files required (this is a pure render refactor with identical behavior; validate via build + manual).

---

## Step-by-Step Plan

### Task 1: Create `cardTypes.ts` with shared prop interfaces

**Objective:** Define DRY prop contracts for the extracted cards so the sub-files and parent stay type-safe.

**Files:**
- Create: `app/orders/components/cards/cardTypes.ts`

**Step 1: Write the file**

```ts
// app/orders/components/cards/cardTypes.ts
import React from 'react';
import { OrderStatus, CustomerPaymentStatus, TransportProvider, TRANSPORT_PROVIDER_LABELS } from '../types';
import { UserRole } from '@/types/rbac.types';
import { EditHistoryEntry, DialogMessageType } from '../types';

// Generic text-input change handler (id-driven, same contract as handleTextChange)
export type TextChangeHandler = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;

export interface ClientStatusCardProps {
  isEditMode: boolean;
  role: UserRole | null;
  status: OrderStatus | undefined;
  customerPaymentStatus: CustomerPaymentStatus | undefined;
  client: string;
  contactNo: string;
  organizationContact: string;
  partDelivery: boolean;
  isHighPriority: boolean;
  orderDate: string | undefined;
  isAdditionalInfoOpen: boolean;
  onAdditionalInfoToggle: () => void;
  onTextChange: TextChangeHandler;
  onPaymentStatusChange: (value: string) => void;
  onPartDeliveryChange: (checked: boolean) => void;
  onHighPriorityChange: (checked: boolean) => void;
  onStatusSelectChange: (value: string) => void;
}

export interface DeliveryVehicleCardProps {
  isEditMode: boolean;
  role: UserRole | null;
  isOperationsRole: boolean;
  weightScaleType?: 'outside' | 'inside';
  transportProvider?: TransportProvider;
  transportProviderName?: string;
  vehicleNo?: string;
  siteDeliveryInfo?: string;
  isVehicleSectionOpen: boolean;
  onVehicleSectionToggle: () => void;
  onTextChange: TextChangeHandler;
  onWeightScaleChange: (value: string) => void;
  onTransportProviderChange: (value: string) => void;
  vehicleDriveIds: { fileId: string; filename: string; fileName?: string; _id?: string }[];
  pendingVehicleFiles: File[];
  mergePreviewVehicle?: { fileCount: number; totalSize: number };
  onVehicleFileAdd: (files: File[]) => void;
  onVehicleFileRemove: (index: number) => void;
  onDeleteUploadedFile: (fileId: string, stage: 'vehicle') => void;
  isSaving: boolean;
}

export interface ProductDetailsCardProps {
  isEditMode: boolean;
  role: UserRole | null;
  products: string;
  deoNo: string;
  productVoiceNoteDriveIds: { fileId: string; filename: string; _id: string }[];
  productDriveIds: { fileId: string; filename: string; fileName?: string; _id?: string }[];
  pendingProductAudioFiles: File[];
  pendingProductFiles: File[];
  mergePreviewProduct?: { fileCount: number; totalSize: number };
  isProductSectionOpen: boolean;
  onProductSectionToggle: () => void;
  onTextChange: TextChangeHandler;
  onProductFileAdd: (files: File[]) => void;
  onProductFileRemove: (index: number) => void;
  onProductAudioStaged: (files: File[]) => void;
  onProductAudioRemoved: (index: number) => void;
  onDeleteUploadedFile: (fileId: string, stage: 'product') => void;
  onUploadComplete: () => void;
}

export interface InvoiceDetailsCardProps {
  isEditMode: boolean;
  role: UserRole | null;
  status: OrderStatus | undefined;
  deoNo: string;
  invoiceDetails?: string;
  invoiceNo?: string;
  invoiceIssueDate?: string;
  invoiceVoiceNoteDriveIds: { fileId: string; filename: string; _id: string }[];
  invoiceDriveId: { fileId: string; filename: string; fileName?: string; _id?: string }[];
  pendingInvoiceAudioFiles: File[];
  pendingInvoiceFiles: File[];
  isInvoiceSectionOpen: boolean;
  onInvoiceSectionToggle: () => void;
  onTextChange: TextChangeHandler;
  onInvoiceFileAdd: (files: File[]) => void;
  onInvoiceFileRemove: (index: number) => void;
  onInvoiceAudioStaged: (files: File[]) => void;
  onInvoiceAudioRemoved: (index: number) => void;
  onDeleteUploadedFile: (fileId: string, stage: 'invoice') => void;
  onUploadComplete: () => void;
}

export interface OrderActionsFooterProps {
  isEditMode: boolean;
  isSaving: boolean;
  isMarkingPaid: boolean;
  isCreatingPartDelivery: boolean;
  isMoreActionsOpen: boolean;
  isConfirmDeleteDialogOpen: boolean;
  role: UserRole | null;
  status: OrderStatus | undefined;
  customerPaymentStatus: CustomerPaymentStatus | undefined;
  partDelivery: boolean;
  isPaymentPending: boolean;
  hasChanges: boolean;
  pendingChangesSummary: { textFieldCount: number; fileCount: number };
  onCancelEdit: () => void;
  onSaveAll: () => void;
  onEditOrder: () => void;
  onApprove: () => void;
  onReadyForDispatch: () => void;
  onPartDelivery: () => void;
  onDispatchedInvoiced: () => void;
  onComplete: () => void;
  onMoreActionsOpenChange: (open: boolean) => void;
  onMarkAsPaid: () => void;
  onCancelOrder: () => void;
  onDeleteClick: () => void;
  onConfirmDeleteOpenChange: (open: boolean) => void;
  onDeleteOrder: () => void;
  onCloseDialog: () => void;
  deoNo: string;
  currentUserProfile: import('@/types/rbac.types').UserProfile | null;
}
```

**Step 2: Type-check the new file in isolation**

Run: `cd "C:\Users\omsha\Documents\Optimize AI with Skill\cleck-Frontend" && npx tsc --noEmit -p tsconfig.json 2>&1 | head -20`
Expected: no errors referencing `cardTypes.ts` (other pre-existing noise is fine; full green comes after all tasks).

**Step 3: Commit**

```bash
git add app/orders/components/cards/cardTypes.ts
git commit -m "refactor(orders): add shared card prop types for dialog split"
```

---

### Task 2: Extract `ClientStatusCard.tsx`

**Objective:** Move the "Client & Status" card JSX (parent lines ~994–1235) into a memoized component with narrow props.

**Files:**
- Create: `app/orders/components/cards/ClientStatusCard.tsx`
- Reference (read-only): `app/orders/components/OrderDetailsDialog.tsx:994-1235`

**Step 1: Write `ClientStatusCard.tsx`**

Take the exact JSX block currently inside `{/* Client & Status Card */} … {/_ Delivery & Vehicle Details Card _/}` open comment and wrap it. Replace all `displayOrder?.X` reads with the narrowed props (`client`, `contactNo`, etc.), and replace permission calls `canEditSalesSpecificFields(currentUserProfile?.role ?? null)` with `canEditSalesSpecificFields(role)` (role is now a prop). Replace `handleTextChange` → `onTextChange`, `handlePaymentStatusChange` → `onPaymentStatusChange`, `handlePartDeliveryChange` → `onPartDeliveryChange`, `handleHighPriorityChange` → `onHighPriorityChange`, and the inline status `Select` `onValueChange` → `onStatusSelectChange`. Replace the `setAdditionalInfoOpen(!isAdditionalInfoOpen)` onClick with `onAdditionalInfoToggle`.

```tsx
// app/orders/components/cards/ClientStatusCard.tsx
import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { User as UserIcon, Phone, MessageCircle, Calendar, Package, Zap, DollarSign, History, ChevronDown, ChevronUp } from 'lucide-react';
import { canEditSalesSpecificFields, canEditOperationsSpecificFields, isOperations, isSuperAdmin, canEditSiteInfo, PAYMENT_STATUS_COLORS, STATUS_COLORS } from '../permissions';
import { formatContactNumberForWhatsApp } from '../fileUtils';
import { ClientStatusCardProps } from './cardTypes';

const ClientStatusCard: React.FC<ClientStatusCardProps> = ({
  isEditMode, role, status, customerPaymentStatus, client, contactNo,
  organizationContact, partDelivery, isHighPriority, orderDate,
  isAdditionalInfoOpen, onAdditionalInfoToggle, onTextChange,
  onPaymentStatusChange, onPartDeliveryChange, onHighPriorityChange, onStatusSelectChange,
}) => {
  return (
    <div className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 space-y-3">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 border-b pb-2">
        Client & Status
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="client" className="font-medium flex items-center gap-1 text-sm">
            <UserIcon className="w-4 h-4 text-gray-500" /> Client:
          </Label>
          {isEditMode && canEditSalesSpecificFields(role) ? (
            <Input id="client" value={client || ''} onChange={onTextChange} className="w-full h-9" />
          ) : (
            <span className="text-gray-800 dark:text-gray-200 block border p-2 rounded-md bg-gray-50 dark:bg-gray-700 text-sm">{client}</span>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="contactNo" className="font-medium flex items-center gap-1 text-sm">
            <Phone className="w-4 h-4 text-gray-500" /> Contact:
          </Label>
          {isEditMode && canEditSalesSpecificFields(role) ? (
            <>
              <Input id="contactNo" value={contactNo || ''} onChange={onTextChange} type="tel" maxLength={10} className="w-full h-9" />
              {contactNo && (
                <div className="flex gap-2 mt-1">
                  <button type="button" onClick={() => window.open(`tel:${contactNo}`, '_blank')} className="flex-1 h-8 text-xs border rounded-md">Call</button>
                  <button type="button" onClick={() => window.open(`https://wa.me/${formatContactNumberForWhatsApp(contactNo)}`, '_blank')} className="flex-1 h-8 text-xs border rounded-md text-green-600">WhatsApp</button>
                </div>
              )}
            </>
          ) : (
            <>
              <span className="text-gray-800 dark:text-gray-200 block border p-2 rounded-md bg-gray-50 dark:bg-gray-700 text-sm">{contactNo || 'N/A'}</span>
              {contactNo && (
                <div className="flex gap-2 mt-1">
                  <button type="button" onClick={() => window.open(`tel:${contactNo}`, '_blank')} className="flex-1 h-8 text-xs border rounded-md">Call</button>
                  <button type="button" onClick={() => window.open(`https://wa.me/${formatContactNumberForWhatsApp(contactNo)}`, '_blank')} className="flex-1 h-8 text-xs border rounded-md text-green-600">WhatsApp</button>
                </div>
              )}
            </>
          )}
        </div>
        <div className="space-y-1">
          <Label className="font-medium flex items-center gap-1 text-sm"><UserIcon className="w-4 h-4 text-gray-500" /> Org. Contact:</Label>
          <span className="text-gray-800 dark:text-gray-200 block border p-2 rounded-md bg-gray-50 dark:bg-gray-700 text-sm">{organizationContact || 'N/A'}</span>
        </div>
        <div className="space-y-1">
          <Label htmlFor="partDelivery" className="font-medium flex items-center gap-1 text-sm"><Package className="w-4 h-4 text-gray-500" /> Part Delivery:</Label>
          {isEditMode && canEditOperationsSpecificFields(role) ? (
            <div className="flex items-center space-x-2 h-[36px]">
              <Checkbox id="partDelivery" checked={partDelivery || false} onCheckedChange={onPartDeliveryChange} />
              <Label htmlFor="partDelivery" className="font-normal text-sm">Enable Part Delivery</Label>
            </div>
          ) : (
            <span className="text-gray-800 dark:text-gray-200 block border p-2 rounded-md bg-gray-50 dark:bg-gray-700 h-[36px] flex items-center text-sm">{partDelivery ? 'Yes' : 'No'}</span>
          )}
        </div>
      </div>

      {isOperations(role) ? (
        <div className="pt-3 border-t dark:border-gray-700">
          <div className="flex justify-between items-center cursor-pointer" onClick={onAdditionalInfoToggle}>
            <h4 className="font-semibold text-gray-800 dark:text-white text-sm">Additional Info</h4>
            {isAdditionalInfoOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
          <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isAdditionalInfoOpen ? 'max-h-screen mt-3' : 'max-h-0'}`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="font-medium flex items-center gap-1 text-sm"><Calendar className="w-4 h-4 text-gray-500" /> Order Date:</Label>
                <span className="text-gray-800 dark:text-gray-200 block border p-2 rounded-md bg-gray-50 dark:bg-gray-700 text-sm">{orderDate || 'N/A'}</span>
              </div>
              <div className="space-y-1">
                <Label htmlFor="isHighPriority" className="font-medium flex items-center gap-1 text-sm"><Zap className="w-4 h-4 text-gray-500" /> High Priority:</Label>
                {isEditMode && canEditSalesSpecificFields(role) ? (
                  <div className="flex items-center space-x-2 h-[36px]">
                    <Switch id="isHighPriority" checked={isHighPriority || false} onCheckedChange={onHighPriorityChange} />
                    <Label htmlFor="isHighPriority" className="font-normal text-sm">{isHighPriority ? 'Enabled' : 'Disabled'}</Label>
                  </div>
                ) : (
                  <span className={`text-gray-800 dark:text-gray-200 block border p-2 rounded-md bg-gray-50 dark:bg-gray-700 h-[36px] flex items-center text-sm ${isHighPriority ? 'text-red-500 font-bold' : ''}`}>{isHighPriority ? 'Yes' : 'No'}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t dark:border-gray-700">
          <div className="space-y-1">
            <Label className="font-medium flex items-center gap-1 text-sm"><Calendar className="w-4 h-4 text-gray-500" /> Order Date:</Label>
            <span className="text-gray-800 dark:text-gray-200 block border p-2 rounded-md bg-gray-50 dark:bg-gray-700 text-sm">{orderDate || 'N/A'}</span>
          </div>
          <div className="space-y-1">
            <Label htmlFor="isHighPriority" className="font-medium flex items-center gap-1 text-sm"><Zap className="w-4 h-4 text-gray-500" /> High Priority:</Label>
            {isEditMode && canEditSalesSpecificFields(role) ? (
              <div className="flex items-center space-x-2 h-[36px]">
                <Switch id="isHighPriority" checked={isHighPriority || false} onCheckedChange={onHighPriorityChange} />
                <Label htmlFor="isHighPriority" className="font-normal text-sm">{isHighPriority ? 'Enabled' : 'Disabled'}</Label>
              </div>
            ) : (
              <span className={`text-gray-800 dark:text-gray-200 block border p-2 rounded-md bg-gray-50 dark:bg-gray-700 h-[36px] flex items-center text-sm ${isHighPriority ? 'text-red-500 font-bold' : ''}`}>{isHighPriority ? 'Yes' : 'No'}</span>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t dark:border-gray-700">
        <div className="space-y-1">
          <Label htmlFor="customerPaymentStatus" className="font-medium flex items-center gap-1 text-sm"><DollarSign className="w-4 h-4 text-gray-500" /> Payment:</Label>
          {isEditMode && canEditSalesSpecificFields(role) ? (
            <Select onValueChange={onPaymentStatusChange} value={customerPaymentStatus || ''}>
              <SelectTrigger id="customerPaymentStatus" className="w-full h-9"><SelectValue /></SelectTrigger>
              <SelectContent className="z-[9050]">
                <SelectItem value="regular">Regular</SelectItem>
                <SelectItem value="new-paid">New Customer - Paid</SelectItem>
                <SelectItem value="new-unpaid">New Customer - Unpaid</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Badge className={`${PAYMENT_STATUS_COLORS[customerPaymentStatus ?? '']} font-medium p-2 text-xs`}>
              {customerPaymentStatus === 'new-paid' ? 'New - Paid' : customerPaymentStatus === 'new-unpaid' ? 'New - Unpaid' : 'Regular'}
            </Badge>
          )}
        </div>
        <div className="space-y-1">
          <Label className="font-medium flex items-center gap-1 text-sm"><History className="w-4 h-4 text-gray-500" /> Status:</Label>
          {isEditMode && isSuperAdmin(role) ? (
            <Select onValueChange={onStatusSelectChange} value={status || ''}>
              <SelectTrigger className="w-full h-9"><SelectValue placeholder="Select Status" /></SelectTrigger>
              <SelectContent className="z-[9050]">
                <SelectItem value="Order Created">Order Created</SelectItem>
                <SelectItem value="Approved for Production">Approved for Production</SelectItem>
                <SelectItem value="Ready for Dispatch">Ready for Dispatch</SelectItem>
                <SelectItem value="Dispatched and Invoiced">Dispatched and Invoiced</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Badge className={`${STATUS_COLORS[status || 'Order Created']} text-white font-semibold px-2 py-1 rounded-full text-xs`}>{status}</Badge>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(ClientStatusCard);
```

> NOTE: `canEditSiteInfo` is used elsewhere for `siteDeliveryInfo`; that field actually lives in the Delivery & Vehicle card, so import `canEditSiteInfo` there, not here.

**Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "ClientStatusCard" || echo "no card errors"`
Expected: `no card errors` (file not yet imported by parent, but types resolve).

**Step 3: Commit**

```bash
git add app/orders/components/cards/ClientStatusCard.tsx
git commit -m "refactor(orders): extract ClientStatusCard (memoized)"
```

---

### Task 3: Extract `DeliveryVehicleCard.tsx`

**Objective:** Move the "Delivery & Vehicle Operations" card (parent lines ~1236–1516) into a memoized component.

**Files:**
- Create: `app/orders/components/cards/DeliveryVehicleCard.tsx`
- Reference (read-only): `app/orders/components/OrderDetailsDialog.tsx:1236-1516`

**Step 1: Write `DeliveryVehicleCard.tsx`**

Copy the exact JSX from the Delivery & Vehicle card. Replace:
- `displayOrder?.details?.weightScaleType` → `weightScaleType`; inline Select `onValueChange` → `onWeightScaleChange`.
- `displayOrder?.details?.transportProvider` → `transportProvider`; inline Select → `onTransportProviderChange`. `transportProviderName` → prop.
- `displayOrder?.details?.vehicleNo` → `vehicleNo`; `onTextChange` → `onTextChange`.
- `displayOrder?.details?.siteDeliveryInfo` → `siteDeliveryInfo`; `canEditSiteInfo(currentUserProfile)` → `canEditSiteInfo({ role } as any)` OR pass a precomputed `canEditSite` boolean from parent. Simpler: parent computes `const canEditSite = canEditSiteInfo(currentUserProfile);` and passes `canEditSite` boolean. Add `canEditSite: boolean` to `DeliveryVehicleCardProps`. (Update cardTypes.ts accordingly.)
- `vehicleDriveIds` → prop; `pendingChanges.vehicleFiles` → `pendingVehicleFiles`; `mergePreviews.vehicle` → `mergePreviewVehicle`; `handleFileAdd(files,'vehicle')` → `onVehicleFileAdd(files)`; `handleFileRemove(i,'vehicle')` → `onVehicleFileRemove(i)`; `handleDeleteUploadedFile(file.fileId,'vehicle')` → `onDeleteUploadedFile(file.fileId,'vehicle')`.
- `setVehicleSectionOpen(!vehicleSectionOpen)` → `onVehicleSectionToggle`.
- `canEditOperationsSpecificFields(currentUserProfile?.role ?? null)` → `canEditOperationsSpecificFields(role)`.
- `isEditMode && canEditVehicleNoField(...)` stays (import `canEditVehicleNoField`).

Use the same Tailwind structure as the original. Keep the `AudioManager`-free here (AudioManager is only in Product + Invoice cards). Wrap `export default React.memo(DeliveryVehicleCard);`.

**Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "DeliveryVehicleCard" || echo "no card errors"`
Expected: `no card errors`.

**Step 3: Commit**

```bash
git add app/orders/components/cards/DeliveryVehicleCard.tsx
git commit -m "refactor(orders): extract DeliveryVehicleCard (memoized)"
```

---

### Task 4: Extract `ProductDetailsCard.tsx`

**Objective:** Move the "Product Details" card (parent lines ~1519–1665) into a memoized component, including its `AudioManager` usage.

**Files:**
- Create: `app/orders/components/cards/ProductDetailsCard.tsx`
- Reference (read-only): `app/orders/components/OrderDetailsDialog.tsx:1519-1665`

**Step 1: Write `ProductDetailsCard.tsx`**

Copy the Product Details card JSX. Replace:
- `displayOrder?.products` → `products`; `onTextChange` → `onTextChange`.
- `displayOrder?.details?.productVoiceNoteDriveIds` → `productVoiceNoteDriveIds`; `pendingChanges.productAudioFiles` → `pendingProductAudioFiles`; `onFilesStaged={handleProductAudioStaged}` → `onProductAudioStaged`; `onFileRemoved={handleProductAudioRemoved}` → `onProductAudioRemoved`; `onUploadComplete={handleUploadComplete}` → `onUploadComplete`.
- `displayOrder?.details?.productDriveIds` → `productDriveIds`; `pendingChanges.productFiles` → `pendingProductFiles`; `mergePreviews.product` → `mergePreviewProduct`; `handleFileAdd(files,'product')` → `onProductFileAdd`; `handleFileRemove(i,'product')` → `onProductFileRemove`; `handleDeleteUploadedFile(file.fileId,'product')` → `onDeleteUploadedFile(file.fileId,'product')`.
- `setProductSectionOpen(!productSectionOpen)` → `onProductSectionToggle`.
- `currentOrder.deoNo` → `deoNo` prop.
- `canEditSalesSpecificFields(currentUserProfile?.role ?? null)` → `canEditSalesSpecificFields(role)`.
- Pass the stable `EMPTY_AUDIO_FILES` constant here too (import from a shared spot or redefine locally as `const EMPTY: File[] = [];`). Since the parent already passes stable `onProductAudioStaged`/`onProductAudioRemoved`, the AudioManager memo holds.
- `stagingMode={isEditMode}` stays (prop).
- `editMode={isEditMode}` stays (prop).

Wrap `export default React.memo(ProductDetailsCard);`.

**Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "ProductDetailsCard" || echo "no card errors"`
Expected: `no card errors`.

**Step 3: Commit**

```bash
git add app/orders/components/cards/ProductDetailsCard.tsx
git commit -m "refactor(orders): extract ProductDetailsCard (memoized)"
```

---

### Task 5: Extract `InvoiceDetailsCard.tsx`

**Objective:** Move the "Invoice Details" card (parent lines ~1666–1849), including the Invoice Issue Date field + `AudioManager`, into a memoized component.

**Files:**
- Create: `app/orders/components/cards/InvoiceDetailsCard.tsx`
- Reference (read-only): `app/orders/components/OrderDetailsDialog.tsx:1666-1849`

**Step 1: Write `InvoiceDetailsCard.tsx`**

Copy the Invoice Details card JSX. Replace:
- `displayOrder?.details?.invoiceDetails` → `invoiceDetails`; `onTextChange` → `onTextChange`.
- `displayOrder?.details?.invoiceNo` → `invoiceNo`; `canEditInvoiceNumberField(role, status)` → use prop `role` + `status`.
- Invoice Issue Date input: `displayOrder?.details?.invoiceIssueDate` → `invoiceIssueDate`; `toLocalISODate(...)` stays (import `toLocalISODate` from parent OR duplicate the 4-line helper locally — prefer importing from a tiny shared util; for simplicity, duplicate the 4-line `toLocalISODate` in this file since it's trivial and avoids cross-import churn). `onTextChange` → `onTextChange`. `canEditInvoiceIssueDateField(role, status)` → prop `role` + `status`.
- `displayOrder?.details?.invoiceVoiceNoteDriveIds` → `invoiceVoiceNoteDriveIds`; `pendingInvoiceAudioFiles`; `onInvoiceAudioStaged`; `onInvoiceAudioRemoved`; `onUploadComplete`.
- `displayOrder?.details?.invoiceDriveId` → `invoiceDriveId`; `pendingInvoiceFiles`; `handleFileAdd(files,'invoice')` → `onInvoiceFileAdd`; `handleFileRemove(i,'invoice')` → `onInvoiceFileRemove`; `handleDeleteUploadedFile(file.fileId,'invoice')` → `onDeleteUploadedFile(file.fileId,'invoice')`.
- `setInvoiceSectionOpen(!invoiceSectionOpen)` → `onInvoiceSectionToggle`.
- `currentOrder.deoNo` → `deoNo` prop.
- `canEditInvoiceDetailsField(role, status)` → prop `role` + `status`.
- `canEditAccountantSpecificFields(role, status)` → prop `role` + `status`.
- `!isOperations(currentUserProfile?.role ?? null)` → `!isOperations(role)`.

Keep `type="date"` input WITHOUT `min`/`max` (submission-time validation already enforces today/-1-day — do NOT reintroduce blocking). Wrap `export default React.memo(InvoiceDetailsCard);`.

**Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "InvoiceDetailsCard" || echo "no card errors"`
Expected: `no card errors`.

**Step 3: Commit**

```bash
git add app/orders/components/cards/InvoiceDetailsCard.tsx
git commit -m "refactor(orders): extract InvoiceDetailsCard (memoized)"
```

---

### Task 6: Extract `OrderActionsFooter.tsx`

**Objective:** Move the FOOTER action buttons block (parent lines ~1850 to end of RENDER) into a memoized component. Keep `EditHistory` inside footer (it manages its own data).

**Files:**
- Create: `app/orders/components/cards/OrderActionsFooter.tsx`
- Reference (read-only): `app/orders/components/OrderDetailsDialog.tsx:1850-2089`

**Step 1: Write `OrderActionsFooter.tsx`**

Copy the `{/* FOOTER - Action Buttons */}` JSX. Replace every handler call:
- `handleCancelEdit` → `onCancelEdit`
- `handleSaveAllChanges` → `onSaveAll`
- `setIsEditMode(true)` (Edit Order button) → `onEditOrder`
- `handleUpdateOrderStatus('Approved for Production')` → `onApprove`
- `handleUpdateOrderStatus('Ready for Dispatch')` → `onReadyForDispatch`
- `handleCreatePartDeliveryOrder` → `onPartDelivery`
- `handleUpdateOrderStatus("Dispatched and Invoiced")` → `onDispatchedInvoiced`
- `handleUpdateOrderStatus('Completed')` → `onComplete`
- `setIsMoreActionsOpen` → `onMoreActionsOpenChange`
- `handleMarkAsPaid` → `onMarkAsPaid`
- `handleUpdateOrderStatus('Cancelled')` → `onCancelOrder`
- `setIsConfirmDeleteDialogOpen` → `onConfirmDeleteOpenChange`
- `handleDeleteOrder` → `onDeleteOrder`
- `onClose` (in Dialog onOpenChange) → `onCloseDialog`
- All `canTransitionToGeneral(displayOrder?.status||'', 'X')` → `canTransitionToGeneral(status||'', 'X')`
- `canEditOperationsSpecificFields(currentUserProfile?.role ?? null)` → `canEditOperationsSpecificFields(role)`
- `canEditAccountantSpecificFields(currentUserProfile?.role ?? null, displayOrder?.status)` → `canEditAccountantSpecificFields(role, status)`
- `isSuperAdmin(...)` / `isSales(...)` / `isAccountant(...)` → use `role` prop
- `isPaymentPending`, `pendingChanges.hasChanges`, summary text → `isPaymentPending`, `hasChanges`, `pendingChangesSummary` props
- `currentOrder.deoNo` → `deoNo` prop; `<EditHistory orderId={currentOrder.deoNo} currentUserProfile={currentUserProfile} />` → `deoNo` + `currentUserProfile` props
- Keep `Loader2`, `Edit`, `MoreVertical`, `Wallet`, `Trash2`, `XCircle`, `CheckCircle`, `Truck`, `Save` icon imports local to this file.

Wrap `export default React.memo(OrderActionsFooter);`.

**Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "OrderActionsFooter" || echo "no card errors"`
Expected: `no card errors`.

**Step 3: Commit**

```bash
git add app/orders/components/cards/OrderActionsFooter.tsx
git commit -m "refactor(orders): extract OrderActionsFooter (memoized)"
```

---

### Task 7: Wire cards into the parent `OrderDetailsDialog.tsx`

**Objective:** Remove the 5 extracted JSX blocks from the parent RENDER and replace with the memoized card components, passing narrow props + stable handlers.

**Files:**
- Modify: `app/orders/components/OrderDetailsDialog.tsx` (RENDER block ~990–2089)

**Step 1: Add imports at top**

```ts
import ClientStatusCard from './cards/ClientStatusCard';
import DeliveryVehicleCard from './cards/DeliveryVehicleCard';
import ProductDetailsCard from './cards/ProductDetailsCard';
import InvoiceDetailsCard from './cards/InvoiceDetailsCard';
import OrderActionsFooter from './cards/OrderActionsFooter';
```

**Step 2: Ensure stable handlers exist (add `useCallback` wrappers if not present)**

Verify these are already defined/stable in parent: `handleTextChange` (stable enough — it's a normal function; to keep memo effective, wrap in `useCallback` with deps `[]` since it only uses `setPendingChanges` + `currentOrder` via functional update). Add:

```ts
const onTextChange = useCallback(handleTextChange, []);
const onPaymentStatusChange = useCallback(handlePaymentStatusChange, []);
const onPartDeliveryChange = useCallback(handlePartDeliveryChange, []);
const onHighPriorityChange = useCallback(handleHighPriorityChange, []);
const onStatusSelectChange = useCallback((value: string) => setPendingChanges(prev => ({ ...prev, textFields: { ...prev.textFields, status: value as any }, hasChanges: true })), []);
const onWeightScaleChange = useCallback((value: string) => setPendingChanges(prev => ({ ...prev, textFields: { ...prev.textFields, details: { ...prev.textFields.details, weightScaleType: value as any } }, hasChanges: true })), []);
const onTransportProviderChange = useCallback((value: string) => setPendingChanges(prev => ({ ...prev, textFields: { ...prev.textFields, details: { ...prev.textFields.details, transportProvider: value as any } }, hasChanges: true })), []);
const onVehicleFileAdd = useCallback((files: File[]) => handleFileAdd(files, 'vehicle'), []);
const onVehicleFileRemove = useCallback((i: number) => handleFileRemove(i, 'vehicle'), []);
const onProductFileAdd = useCallback((files: File[]) => handleFileAdd(files, 'product'), []);
const onProductFileRemove = useCallback((i: number) => handleFileRemove(i, 'product'), []);
const onInvoiceFileAdd = useCallback((files: File[]) => handleFileAdd(files, 'invoice'), []);
const onInvoiceFileRemove = useCallback((i: number) => handleFileRemove(i, 'invoice'), []);
// existing stable audio handlers: handleProductAudioStaged, handleProductAudioRemoved, handleInvoiceAudioStaged, handleInvoiceAudioRemoved
```

**Step 3: Replace LEFT COLUMN cards**

In RENDER, replace the `{/* Client & Status Card */}...{/_ Delivery & Vehicle Details Card _/}` JSX with:

```tsx
<ClientStatusCard
  isEditMode={isEditMode}
  role={currentUserProfile?.role ?? null}
  status={displayOrder?.status}
  customerPaymentStatus={displayOrder?.customerPaymentStatus}
  client={displayOrder?.client || ''}
  contactNo={displayOrder?.contactNo || ''}
  organizationContact={displayOrder?.organizationContact || ''}
  partDelivery={displayOrder?.partDelivery || false}
  isHighPriority={displayOrder?.isHighPriority || false}
  orderDate={displayOrder?.details?.orderDate}
  isAdditionalInfoOpen={isAdditionalInfoOpen}
  onAdditionalInfoToggle={() => setAdditionalInfoOpen(o => !o)}
  onTextChange={onTextChange}
  onPaymentStatusChange={onPaymentStatusChange}
  onPartDeliveryChange={onPartDeliveryChange}
  onHighPriorityChange={onHighPriorityChange}
  onStatusSelectChange={onStatusSelectChange}
/>
<DeliveryVehicleCard
  isEditMode={isEditMode}
  role={currentUserProfile?.role ?? null}
  isOperationsRole={isOperations(currentUserProfile?.role ?? null)}
  weightScaleType={displayOrder?.details?.weightScaleType}
  transportProvider={displayOrder?.details?.transportProvider}
  transportProviderName={displayOrder?.details?.transportProviderName}
  vehicleNo={displayOrder?.details?.vehicleNo}
  siteDeliveryInfo={displayOrder?.details?.siteDeliveryInfo}
  isVehicleSectionOpen={vehicleSectionOpen}
  onVehicleSectionToggle={() => setVehicleSectionOpen(o => !o)}
  onTextChange={onTextChange}
  onWeightScaleChange={onWeightScaleChange}
  onTransportProviderChange={onTransportProviderChange}
  vehicleDriveIds={displayOrder?.details?.vehicleDriveIds || []}
  pendingVehicleFiles={pendingChanges.vehicleFiles}
  mergePreviewVehicle={mergePreviews.vehicle}
  onVehicleFileAdd={onVehicleFileAdd}
  onVehicleFileRemove={onVehicleFileRemove}
  onDeleteUploadedFile={handleDeleteUploadedFile}
  isSaving={isSaving}
/>
```

> NOTE: `onAdditionalInfoToggle`/`onVehicleSectionToggle` use inline arrow `() => setAdditionalInfoOpen(o => !o)` — this creates a new function each render, which WOULD break memo for that card. Fix: make these stable with `useCallback`:
> ```ts
> const onAdditionalInfoToggle = useCallback(() => setAdditionalInfoOpen(o => !o), []);
> const onVehicleSectionToggle = useCallback(() => setVehicleSectionOpen(o => !o), []);
> const onProductSectionToggle = useCallback(() => setProductSectionOpen(o => !o), []);
> const onInvoiceSectionToggle = useCallback(() => setInvoiceSectionOpen(o => !o), []);
> ```
> Pass those stable refs instead of inline arrows.

**Step 4: Replace RIGHT COLUMN cards**

```tsx
<ProductDetailsCard
  isEditMode={isEditMode}
  role={currentUserProfile?.role ?? null}
  products={displayOrder?.products || ''}
  deoNo={currentOrder.deoNo}
  productVoiceNoteDriveIds={displayOrder?.details?.productVoiceNoteDriveIds || []}
  productDriveIds={displayOrder?.details?.productDriveIds || []}
  pendingProductAudioFiles={pendingChanges.productAudioFiles}
  pendingProductFiles={pendingChanges.productFiles}
  mergePreviewProduct={mergePreviews.product}
  isProductSectionOpen={productSectionOpen}
  onProductSectionToggle={onProductSectionToggle}
  onTextChange={onTextChange}
  onProductFileAdd={onProductFileAdd}
  onProductFileRemove={onProductFileRemove}
  onProductAudioStaged={handleProductAudioStaged}
  onProductAudioRemoved={handleProductAudioRemoved}
  onDeleteUploadedFile={handleDeleteUploadedFile}
  onUploadComplete={handleUploadComplete}
/>
<InvoiceDetailsCard
  isEditMode={isEditMode}
  role={currentUserProfile?.role ?? null}
  status={displayOrder?.status}
  deoNo={currentOrder.deoNo}
  invoiceDetails={displayOrder?.details?.invoiceDetails}
  invoiceNo={displayOrder?.details?.invoiceNo}
  invoiceIssueDate={displayOrder?.details?.invoiceIssueDate}
  invoiceVoiceNoteDriveIds={displayOrder?.details?.invoiceVoiceNoteDriveIds || []}
  invoiceDriveId={displayOrder?.details?.invoiceDriveId || []}
  pendingInvoiceAudioFiles={pendingChanges.invoiceAudioFiles}
  pendingInvoiceFiles={pendingChanges.invoiceFiles}
  isInvoiceSectionOpen={invoiceSectionOpen}
  onInvoiceSectionToggle={onInvoiceSectionToggle}
  onTextChange={onTextChange}
  onInvoiceFileAdd={onInvoiceFileAdd}
  onInvoiceFileRemove={onInvoiceFileRemove}
  onInvoiceAudioStaged={handleInvoiceAudioStaged}
  onInvoiceAudioRemoved={handleInvoiceAudioRemoved}
  onDeleteUploadedFile={handleDeleteUploadedFile}
  onUploadComplete={handleUploadComplete}
/>
```

**Step 5: Replace FOOTER**

```tsx
<OrderActionsFooter
  isEditMode={isEditMode}
  isSaving={isSaving}
  isMarkingPaid={isMarkingPaid}
  isCreatingPartDelivery={isCreatingPartDelivery}
  isMoreActionsOpen={isMoreActionsOpen}
  isConfirmDeleteDialogOpen={isConfirmDeleteDialogOpen}
  role={currentUserProfile?.role ?? null}
  status={displayOrder?.status}
  customerPaymentStatus={displayOrder?.customerPaymentStatus}
  partDelivery={displayOrder?.partDelivery}
  isPaymentPending={isPaymentPending}
  hasChanges={pendingChanges.hasChanges}
  pendingChangesSummary={{
    textFieldCount: Object.keys(pendingChanges.textFields).length,
    fileCount: pendingChanges.productFiles.length + pendingChanges.vehicleFiles.length + pendingChanges.invoiceFiles.length,
  }}
  onCancelEdit={handleCancelEdit}
  onSaveAll={handleSaveAllChanges}
  onEditOrder={() => setIsEditMode(true)}
  onApprove={() => handleUpdateOrderStatus('Approved for Production')}
  onReadyForDispatch={() => handleUpdateOrderStatus('Ready for Dispatch')}
  onPartDelivery={handleCreatePartDeliveryOrder}
  onDispatchedInvoiced={() => handleUpdateOrderStatus('Dispatched and Invoiced')}
  onComplete={() => handleUpdateOrderStatus('Completed')}
  onMoreActionsOpenChange={setIsMoreActionsOpen}
  onMarkAsPaid={handleMarkAsPaid}
  onCancelOrder={() => handleUpdateOrderStatus('Cancelled')}
  onDeleteClick={() => { setIsMoreActionsOpen(false); setIsConfirmDeleteDialogOpen(true); }}
  onConfirmDeleteOpenChange={setIsConfirmDeleteDialogOpen}
  onDeleteOrder={handleDeleteOrder}
  onCloseDialog={onClose}
  deoNo={currentOrder.deoNo}
  currentUserProfile={currentUserProfile}
/>
```

> NOTE: `onEditOrder`, `onApprove`, etc. that wrap `handleUpdateOrderStatus(...)` are inline arrows → would break memo on the footer. Make them stable:
> ```ts
> const onEditOrder = useCallback(() => setIsEditMode(true), []);
> const onApprove = useCallback(() => handleUpdateOrderStatus('Approved for Production'), [handleUpdateOrderStatus]);
> const onReadyForDispatch = useCallback(() => handleUpdateOrderStatus('Ready for Dispatch'), [handleUpdateOrderStatus]);
> const onPartDelivery = useCallback(() => handleCreatePartDeliveryOrder(), [handleCreatePartDeliveryOrder]);
> const onDispatchedInvoiced = useCallback(() => handleUpdateOrderStatus('Dispatched and Invoiced'), [handleUpdateOrderStatus]);
> const onComplete = useCallback(() => handleUpdateOrderStatus('Completed'), [handleUpdateOrderStatus]);
> const onCancelOrder = useCallback(() => handleUpdateOrderStatus('Cancelled'), [handleUpdateOrderStatus]);
> const onDeleteClick = useCallback(() => { setIsMoreActionsOpen(false); setIsConfirmDeleteDialogOpen(true); }, []);
> ```
> `handleUpdateOrderStatus` must also be `useCallback`-stable (wrap it; it depends on `currentUserProfile`, `currentOrder`, `onShowMessage`, `apiService` — all stable or refs).

**Step 6: Remove the now-dead extracted JSX** from the parent file (the original inline card blocks) so there is no duplication.

**Step 7: Type-check + lint + build**

Run:
```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | head -30
npm run lint 2>&1 | tail -5
npm run build 2>&1 | tail -20
```
Expected: tsc clean, `✔ No ESLint warnings or errors`, build succeeds (route `/orders` compiles).

**Step 8: Commit**

```bash
git add app/orders/components/OrderDetailsDialog.tsx app/orders/components/cards/
git commit -m "refactor(orders): wire memoized cards into OrderDetailsDialog"
```

---

### Task 8: Final verification (manual + perf)

**Objective:** Confirm behavior is unchanged and the click/input handler violation is gone.

**Files:** none changed — verification only.

**Step 1: Build check**

Run: `npm run build 2>&1 | tail -20` — expect success.

**Step 2: Manual smoke test (browser)**

1. `npm run dev`, open an order in the dialog.
2. Enter edit mode, click into Invoice Issue Date field, type a digit.
3. With React DevTools "Highlight updates when components render" ON: confirm ONLY `InvoiceDetailsCard` flashes — `ClientStatusCard`, `DeliveryVehicleCard`, `ProductDetailsCard`, `OrderActionsFooter` do NOT re-render.
4. Confirm no `[Violation] 'click' handler took …ms` / forced reflow warnings in console for that interaction.
5. Complete-order flow: set Invoice Issue Date to today → Complete works; set to 3 days ago → blocked with "Invoice Issue Date must be today or yesterday."

**Step 3: Commit (if any tweak needed)**

```bash
git add -A && git commit -m "refactor(orders): perf verification tweaks"
```

---

## Risks / Trade-offs / Open Questions

- **Memo correctness depends on stable props.** Any inline arrow passed as a handler prop re-breaks memo. The plan mandates `useCallback` for ALL handlers passed to cards (Tasks 2–7 notes). If a reviewer spots an inline arrow in the parent's card JSX, that card will still re-render fully — must be fixed.
- **`handleDeleteUploadedFile`** is passed to Delivery/Vehicle/Product/Invoice cards as `onDeleteUploadedFile`. It is an async function defined inline in the parent; wrap it in `useCallback` (deps: `currentUserProfile`, `currentOrder`, `onShowMessage`) so its identity is stable.
- **`toLocalISODate`** is used in `InvoiceDetailsCard`. Either import it from the parent (export it) or duplicate the 4-line helper in the card file. Plan chose duplication to avoid widening the parent's public surface; acceptable (DRY-lite, trivial).
- **Behavior change risk:** This is a pure render refactor. No validation, API, or state logic moves. The only logic-bearing pieces that *leave* the parent are presentational; all `setPendingChanges` mutations stay in parent handlers. Verify the save/complete flows still produce identical payloads (Task 8 manual test).
- **Open question — `handleUploadComplete` identity:** it's `async () => { await onOrderUpdated(); }` currently defined inline at line ~897. Wrap in `useCallback` (`[onOrderUpdated]`) before passing to cards.
- **Bundle size:** 5 new files, ~small. No new deps. `React.memo` adds negligible runtime cost and large win.

## Definition of Done

- [ ] 5 card components created under `app/orders/components/cards/`, each `React.memo`'d.
- [ ] Parent `OrderDetailsDialog.tsx` RENDER uses the 5 cards with narrow, stable props.
- [ ] `tsc --noEmit`, `npm run lint`, `npm run build` all green.
- [ ] Manual test: editing Invoice Issue Date re-renders only `InvoiceDetailsCard`.
- [ ] No console `[Violation]` warnings on field click/input.
- [ ] Complete-order today/-1-day validation still works.
