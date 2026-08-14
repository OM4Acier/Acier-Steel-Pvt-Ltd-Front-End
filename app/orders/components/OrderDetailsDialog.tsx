import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Zap, Save, FileDown, Settings2, Trash2,
} from 'lucide-react';

import { Order, CustomerPaymentStatus, EditHistoryEntry, DialogMessageType } from '../types';
import { ordersApi } from '@/lib/api/endpoints/ordersApi';
const apiService = ordersApi;
import {
  canEditSalesSpecificFields,
  canEditOperationsSpecificFields,
  canEditAccountantSpecificFields,
  canEditSiteInfo,
  canMarkAsPaid,
  canCreatePartDelivery,
  isSuperAdmin,
  isOperations,
  canExportPdf,
  canConfigurePdf,
  canEditInvoiceDetailsField,
  canEditInvoiceNumberField,
  canEditInvoiceIssueDateField,
  canEditVehicleNoField,
} from '../permissions';
import { canTransitionToGeneral } from '../constants';
import {
  buildCustomerInfoBlock,
  replaceCustomerInfoBlock,
  replaceCustomerField,
} from '../customerInfoBlock';
import { processFilesToPdf, pdfBytesToFile, formatFileSize } from '@/lib/utils/pdfMergeUtils';
import { fileApi } from '@/lib/api/endpoints/fileApi';
import ClientStatusCard from './cards/ClientStatusCard';
import DeliveryVehicleCard from './cards/DeliveryVehicleCard';
import ProductDetailsCard from './cards/ProductDetailsCard';
import InvoiceDetailsCard from './cards/InvoiceDetailsCard';
import OrderActionsFooter from './cards/OrderActionsFooter';
import {
  loadSuperAdminPdfConfig,
  getEffectiveFieldVisibility,
  PdfFieldVisibilityMap,
} from '../pdfConfig';
import { openOrderPdfInNewTab } from '../generateOrderPdf';
import { PdfConfigModal } from './PdfConfigModal';
import { UserProfile } from '@/types/rbac.types';
import { CustomerDialog } from '../../customers/components/CustomerDialog';
import { customersApi, CustomerSummary } from '@/lib/api/endpoints/customers';

// ============================================================
// TYPES
// ============================================================
interface OrderDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  currentUserProfile: UserProfile | null;
  onOrderUpdated: () => void;
  onShowMessage: (message: DialogMessageType) => void;
  paymentStatusGradients: Record<string, string>;
}

interface PendingChanges {
  textFields: Partial<Order>;
  productFiles: File[];
  vehicleFiles: File[];
  invoiceFiles: File[];
  productAudioFiles: File[];
  invoiceAudioFiles: File[];
  hasChanges: boolean;
}

// ============================================================
// UTILITIES
// ============================================================
const toLocalISODate = (value: string | Date): string => {
  const d = typeof value === 'string' ? new Date(value) : value;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getInvoiceIssueDateBounds = (): { min: string; max: string } => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  return { min: fmt(yesterday), max: fmt(today) };
};

// ============================================================
// COMPONENT
// ============================================================
export const OrderDetailsDialog: React.FC<OrderDetailsDialogProps> = ({
  isOpen, onClose, order, currentUserProfile,
  onOrderUpdated, onShowMessage, paymentStatusGradients,
}) => {
  // ------------------------------------------------------------
  // State
  // ------------------------------------------------------------
  const [isEditMode, setIsEditMode] = useState(false);
  const [isMoreActionsOpen, setIsMoreActionsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [isCreatingPartDelivery, setIsCreatingPartDelivery] = useState(false);
  const [isDeletingOrder, setIsDeletingOrder] = useState(false);
  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);

  const [isPdfConfigOpen, setIsPdfConfigOpen] = useState(false);
  const [pdfFieldConfig, setPdfFieldConfig] = useState<PdfFieldVisibilityMap>(() =>
    loadSuperAdminPdfConfig()
  );

  const [productSectionOpen, setProductSectionOpen] = useState(false);
  const [vehicleSectionOpen, setVehicleSectionOpen] = useState(false);
  const [invoiceSectionOpen, setInvoiceSectionOpen] = useState(false);
  const [isAdditionalInfoOpen, setAdditionalInfoOpen] = useState(false);

  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [pendingChanges, setPendingChanges] = useState<PendingChanges>({
    textFields: {},
    productFiles: [],
    vehicleFiles: [],
    invoiceFiles: [],
    productAudioFiles: [],
    invoiceAudioFiles: [],
    hasChanges: false,
  });
  const [mergePreviews, setMergePreviews] = useState<{
    product?: { fileCount: number; totalSize: number };
    vehicle?: { fileCount: number; totalSize: number };
    invoice?: { fileCount: number; totalSize: number };
  }>({});

  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [resolvedCustomer, setResolvedCustomer] = useState<CustomerSummary | null>(null);
  const [isResolvingCustomer, setIsResolvingCustomer] = useState(false);
  const [shippingAddressOptions, setShippingAddressOptions] = useState<string[]>([]);
  const [selectedShippingAddress, setSelectedShippingAddress] = useState('Ask for client');

  // ------------------------------------------------------------
  // Derived display data
  // ------------------------------------------------------------
  const displayOrder = React.useMemo(() => {
    if (!currentOrder) return null;
    if (!isEditMode) return currentOrder;

    const mergedDetails = {
      ...currentOrder.details,
      ...(pendingChanges.textFields.details || {}),
    };

    return {
      ...currentOrder,
      ...pendingChanges.textFields,
      details: mergedDetails,
    };
  }, [currentOrder, pendingChanges, isEditMode]);

  const isPaymentPending =
    displayOrder?.customerPaymentStatus === 'new-unpaid' &&
    displayOrder?.status === 'Ready for Dispatch';

  const isOpsUnpaidWarning =
    isOperations(currentUserProfile?.role ?? null) &&
    displayOrder?.customerPaymentStatus === 'new-unpaid';

  const dialogBackgroundClass = isOpsUnpaidWarning
    ? 'bg-gradient-to-br from-red-100 via-red-50 to-red-100 dark:from-red-950 dark:via-gray-800 dark:to-red-950 shadow-[inset_0_0_50px_rgba(220,38,38,0.2)]'
    : displayOrder
      ? paymentStatusGradients[displayOrder.customerPaymentStatus] || 'bg-white dark:bg-gray-800'
      : 'bg-white dark:bg-gray-800';

  // ------------------------------------------------------------
  // Permission flags (computed centrally, passed to cards)
  // ------------------------------------------------------------
  const role = currentUserProfile?.role ?? null;
  const orderStatus = displayOrder?.status;
  const canEditClient = canEditSalesSpecificFields(role);
  const canEditContact = canEditSalesSpecificFields(role);
  const canEditPaymentStatus = canEditSalesSpecificFields(role);
  const canEditPartDelivery = canEditOperationsSpecificFields(role);
  const canEditHighPriority = canEditSalesSpecificFields(role);
  const canEditStatusSelect = isSuperAdmin(role);
  const canEditMeasurementKata = canEditOperationsSpecificFields(role);
  const canEditTransportProvider = canEditOperationsSpecificFields(role);
  const canEditVehicleNo = canEditVehicleNoField(role);
  const canEditSiteInfoPerm = currentUserProfile ? canEditSiteInfo(currentUserProfile) : false;
  const canEditVehicleFiles = canEditOperationsSpecificFields(role);
  const canEditProducts = canEditSalesSpecificFields(role);
  const canEditProductFiles = canEditSalesSpecificFields(role);
  const canEditInvoiceDetails = canEditInvoiceDetailsField(role, orderStatus);
  const canEditInvoiceNo = canEditInvoiceNumberField(role, orderStatus);
  const canEditInvoiceIssueDate = canEditInvoiceIssueDateField(role, orderStatus);
  const canEditInvoiceFiles = canEditAccountantSpecificFields(role, orderStatus);
  const showInvoiceCard = !isOperations(role);

  // ------------------------------------------------------------
  // Reset helpers
  // ------------------------------------------------------------
  const resetPendingChanges = () => {
    setPendingChanges({
      textFields: {},
      productFiles: [],
      vehicleFiles: [],
      invoiceFiles: [],
      productAudioFiles: [],
      invoiceAudioFiles: [],
      hasChanges: false,
    });
    setMergePreviews({});
  };

  const refreshCurrentOrderFromServer = React.useCallback(async (deoNo: string) => {
    const freshOrderData = await apiService.fetchOrders();
    const freshOrder = Array.isArray(freshOrderData)
      ? freshOrderData.find((o: Order) => o.deoNo === deoNo)
      : freshOrderData;

    if (freshOrder) {
      const normalizedFreshOrder: Order = {
        ...freshOrder,
        details: {
          ...freshOrder.details,
          productDriveIds: freshOrder.details?.productDriveIds || [],
          vehicleDriveIds: freshOrder.details?.vehicleDriveIds || [],
          invoiceDriveId: freshOrder.details?.invoiceDriveId || [],
          productVoiceNoteDriveIds: freshOrder.details?.productVoiceNoteDriveIds || [],
          invoiceVoiceNoteDriveIds: freshOrder.details?.invoiceVoiceNoteDriveIds || [],
        },
      };
      setCurrentOrder(normalizedFreshOrder);
    }
  }, []);

  // ------------------------------------------------------------
  // Initialization
  // ------------------------------------------------------------
  useEffect(() => {
    if (order && isOpen) {
      const normalizedOrder = {
        ...order,
        details: {
          ...order.details,
          productDriveIds: order.details?.productDriveIds || [],
          vehicleDriveIds: order.details?.vehicleDriveIds || [],
          invoiceDriveId: order.details?.invoiceDriveId || [],
        },
      };
      setCurrentOrder(normalizedOrder);
      setIsEditMode(false);
      resetPendingChanges();

      setResolvedCustomer(null);

      void (async () => {
        if (!normalizedOrder.client) return;
        try {
          const clients = await customersApi.fetchCustomers();
          const match = clients.find((c) => c && c.name === normalizedOrder.client) || null;
          if (match) {
            const addresses = await customersApi.fetchCustomerAddresses(match.id);
            setShippingAddressOptions(
              (addresses.shippingAddresses || []).map((s) => s.label).filter(Boolean),
            );
            const current = normalizedOrder.details?.siteDeliveryInfo;
            const hasMatch = (addresses.shippingAddresses || []).some((s) => s.address === current);
            const lbl = hasMatch
              ? (addresses.shippingAddresses || []).find((s) => s.address === current)?.label
              : 'Ask for client';
            setSelectedShippingAddress(lbl || 'Ask for client');
          }
        } catch (err) {
          console.error('Failed to pre-load shipping addresses', err);
        }
      })();
    }
  }, [order, isOpen]);

  // ------------------------------------------------------------
  // Customer flow
  // ------------------------------------------------------------
  const handleEditCustomer = () => {
    if (resolvedCustomer) {
      setCustomerDialogOpen(true);
    } else if (!isResolvingCustomer) {
      void resolveCustomer();
    }
  };

  const syncCustomerInfoIntoInvoice = React.useCallback(async (customer: CustomerSummary) => {
    if (!isEditMode) return;

    let billingAddress = '';
    let shippingAddresses: string[] = [];
    try {
      const addresses = await customersApi.fetchCustomerAddresses(customer.id);
      billingAddress = addresses.billingAddress ?? '';
      shippingAddresses = (addresses.shippingAddresses || []).map((s) => s.address).filter(Boolean);
    } catch (err) {
      console.error('Failed to fetch addresses for invoice sync', err);
    }

    const block = buildCustomerInfoBlock({
      client: customer.name,
      gst: customer.gst || '',
      billing: billingAddress,
      shipping: shippingAddresses.length ? shippingAddresses.join(' | ') : 'Ask for client',
    });

    const current = currentOrder?.details?.invoiceDetails || '';
    const next = replaceCustomerInfoBlock(current, block);
    handleTextChange({ target: { id: 'invoiceDetails', value: next } } as any);
  }, [isEditMode, currentOrder]);

  const resolveCustomer = React.useCallback(async () => {
    if (!currentOrder?.client) return;
    setIsResolvingCustomer(true);
    try {
      const clients = await customersApi.fetchCustomers();
      const match = clients.find((c) => c && c.name === currentOrder.client) || null;
      setResolvedCustomer(match);

      if (match) {
        try {
          const addresses = await customersApi.fetchCustomerAddresses(match.id);
          setShippingAddressOptions(
            (addresses.shippingAddresses || []).map((s) => s.label).filter(Boolean),
          );
          const current = currentOrder.details?.siteDeliveryInfo;
          if (current && (addresses.shippingAddresses || []).some((s) => s.address === current)) {
            const lbl = (addresses.shippingAddresses || []).find((s) => s.address === current)?.label;
            if (lbl) setSelectedShippingAddress(lbl);
          } else {
            setSelectedShippingAddress('Ask for client');
          }
        } catch (addrErr) {
          console.error('Failed to load shipping addresses for selector', addrErr);
        }
      }

      setCustomerDialogOpen(true);
    } catch (err) {
      console.error('Failed to resolve customer for edit', err);
    } finally {
      setIsResolvingCustomer(false);
    }
  }, [currentOrder?.client, currentOrder?.details?.siteDeliveryInfo]);

  const handleShippingAddressChange = React.useCallback((addr: string) => {
    setSelectedShippingAddress(addr);
    handleTextChange({
      target: { id: 'siteDeliveryInfo', value: addr !== 'Ask for client' ? addr : '' },
    } as any);

    const current = currentOrder?.details?.invoiceDetails || '';
    const next = replaceCustomerField(current, 'shipping', addr);
    handleTextChange({ target: { id: 'invoiceDetails', value: next } } as any);
  }, [currentOrder]);

  const handleCustomerSuccess = (updated: CustomerSummary | null) => {
    if (!updated) {
      setCustomerDialogOpen(false);
      return;
    }

    setResolvedCustomer(updated);
    setCustomerDialogOpen(false);

    setCurrentOrder((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        client: updated.name || prev.client,
        contactNo: updated.phones?.[0] || prev.contactNo,
      };
    });

    void syncCustomerInfoIntoInvoice(updated);
    onOrderUpdated();
  };

  // ------------------------------------------------------------
  // Text / field changes
  // ------------------------------------------------------------
  const detailsFieldIds = [
    'orderDate',
    'invoiceDetails',
    'vehicleNo',
    'invoiceNo',
    'invoiceIssueDate',
    'siteDeliveryInfo',
    'measurementKata',
    'transportProvider',
    'transportProviderName',
  ];

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;

    setPendingChanges((prev) => {
      const isDetailsField = detailsFieldIds.includes(id);

      if (isDetailsField) {
        return {
          ...prev,
          textFields: {
            ...prev.textFields,
            details: {
              ...(prev.textFields.details || {}),
              [id]: value,
            },
          },
          hasChanges: true,
        };
      }

      return {
        ...prev,
        textFields: {
          ...prev.textFields,
          [id]: value,
        },
        hasChanges: true,
      };
    });
  };

  const handlePaymentStatusChange = (value: string) => {
    setPendingChanges((prev) => ({
      ...prev,
      textFields: { ...prev.textFields, customerPaymentStatus: value as any },
      hasChanges: true,
    }));
  };

  const handlePartDeliveryChange = (checked: boolean) => {
    setPendingChanges((prev) => ({
      ...prev,
      textFields: { ...prev.textFields, partDelivery: checked },
      hasChanges: true,
    }));
  };

  const handleHighPriorityChange = (checked: boolean) => {
    setPendingChanges((prev) => ({
      ...prev,
      textFields: { ...prev.textFields, isHighPriority: checked },
      hasChanges: true,
    }));
  };

  const handleStatusSelectChange = (value: string) => {
    setPendingChanges((prev) => ({
      ...prev,
      textFields: { ...prev.textFields, status: value as any },
      hasChanges: true,
    }));
  };

  const handleWeightScaleChange = (value: string) => {
    setPendingChanges((prev) => ({
      ...prev,
      textFields: {
        ...prev.textFields,
        details: { ...prev.textFields.details, measurementKata: value as any },
      },
      hasChanges: true,
    }));
  };

  const handleTransportProviderChange = (value: string) => {
    setPendingChanges((prev) => ({
      ...prev,
      textFields: {
        ...prev.textFields,
        details: { ...prev.textFields.details, transportProvider: value as any },
      },
      hasChanges: true,
    }));
  };

  // ------------------------------------------------------------
  // File changes
  // ------------------------------------------------------------
  const updateMergePreviewForStage = (stage: 'product' | 'vehicle' | 'invoice', newFiles: File[]) => {
    if (newFiles.length > 1) {
      const totalSize = newFiles.reduce((sum, f) => sum + f.size, 0);
      setMergePreviews((prev) => ({
        ...prev,
        [stage]: {
          fileCount: newFiles.length,
          totalSize,
        },
      }));
    } else {
      setMergePreviews((prev) => {
        const updated = { ...prev };
        delete updated[stage];
        return updated;
      });
    }
  };

  const computeHasChanges = (
    prev: PendingChanges,
    productFiles: File[],
    vehicleFiles: File[],
    invoiceFiles: File[],
  ) =>
    productFiles.length + vehicleFiles.length + invoiceFiles.length > 1 ||
    Object.keys(prev.textFields).length > 0;

  const handleFileAdd = (files: File[], stage: 'product' | 'vehicle' | 'invoice') => {
    setPendingChanges((prev) => {
      const existingFiles = prev[`${stage}Files` as keyof Pick<PendingChanges, 'productFiles' | 'vehicleFiles' | 'invoiceFiles'>] as File[];
      const newFiles = [...existingFiles, ...files];
      updateMergePreviewForStage(stage, newFiles);

      return {
        ...prev,
        [`${stage}Files`]: newFiles,
        hasChanges: computeHasChanges(prev, prev.productFiles, prev.vehicleFiles, prev.invoiceFiles),
      };
    });
  };

  const handleFileRemove = (index: number, stage: 'product' | 'vehicle' | 'invoice') => {
    setPendingChanges((prev) => {
      const existingFiles = prev[`${stage}Files` as keyof Pick<PendingChanges, 'productFiles' | 'vehicleFiles' | 'invoiceFiles'>] as File[];
      const newFiles = existingFiles.filter((_, i) => i !== index);
      updateMergePreviewForStage(stage, newFiles);

      return {
        ...prev,
        [`${stage}Files`]: newFiles,
        hasChanges: computeHasChanges(prev, prev.productFiles, prev.vehicleFiles, prev.invoiceFiles),
      };
    });
  };

  const handleAudioFileAdd = (files: File[], stage: 'product' | 'invoice') => {
    setPendingChanges((prev) => {
      const stageKey = `${stage}AudioFiles` as 'productAudioFiles' | 'invoiceAudioFiles';
      return {
        ...prev,
        [stageKey]: [...prev[stageKey], ...files],
        hasChanges: true,
      };
    });
  };

  const handleAudioFileRemove = (index: number, stage: 'product' | 'invoice') => {
    setPendingChanges((prev) => {
      const stageKey = `${stage}AudioFiles` as 'productAudioFiles' | 'invoiceAudioFiles';
      const newFiles = prev[stageKey].filter((_, i) => i !== index);

      return {
        ...prev,
        [stageKey]: newFiles,
        hasChanges:
          newFiles.length +
          prev.productFiles.length +
          prev.vehicleFiles.length +
          prev.invoiceFiles.length >
            1 ||
          Object.keys(prev.textFields).length > 0,
      };
    });
  };

  const handleDeleteUploadedFile = useCallback(async (fileId: string, stage: 'product' | 'vehicle' | 'invoice') => {
    if (!currentUserProfile || !currentOrder) {
      onShowMessage({ type: 'error', text: 'Please log in to delete files.' });
      return;
    }

    if (stage === 'product' && !canEditSalesSpecificFields(currentUserProfile.role)) {
      onShowMessage({ type: 'error', text: 'No permission to delete Product Files.' });
      return;
    }
    if (stage === 'vehicle' && !canEditOperationsSpecificFields(currentUserProfile.role)) {
      onShowMessage({ type: 'error', text: 'No permission to delete Delivery Details.' });
      return;
    }
    if (stage === 'invoice' && !canEditAccountantSpecificFields(currentUserProfile.role, currentOrder?.status)) {
      onShowMessage({ type: 'error', text: 'No permission to delete Invoice Files.' });
      return;
    }

    onShowMessage({ type: 'info', text: 'Deleting file...' });

    try {
      await apiService.deleteFile(fileId);
      await refreshCurrentOrderFromServer(currentOrder.deoNo);
      onShowMessage({ type: 'success', text: 'File deleted successfully!' });
    } catch (e: any) {
      console.error(`File deletion failed:`, e);
      const errorMessage = process.env.NODE_ENV === 'production'
        ? 'Failed to delete file.'
        : `Delete failed: ${e.message}`;
      onShowMessage({ type: 'error', text: errorMessage });
    }
  }, [currentUserProfile, currentOrder, onShowMessage, apiService, refreshCurrentOrderFromServer]);

  // ------------------------------------------------------------
  // Order actions
  // ------------------------------------------------------------
  const handleUpdateOrderStatus = useCallback(async (newStatus: string) => {
    if (!currentUserProfile || !currentOrder) {
      onShowMessage({ type: 'error', text: 'Please log in to update status.' });
      return;
    }

    if (currentOrder.status === 'Completed' || currentOrder.status === 'Cancelled') {
      onShowMessage({ type: 'error', text: `Cannot change status from '${currentOrder.status}'.` });
      return;
    }

    if (newStatus === 'Dispatched and Invoiced') {
      const hasVehicle =
        currentOrder.details?.vehicleNo && currentOrder.details.vehicleNo.trim().length > 0;
      const hasVehicleDocs =
        currentOrder.details?.vehicleDriveIds && currentOrder.details.vehicleDriveIds.length > 0;
      if (!hasVehicle || !hasVehicleDocs) {
        onShowMessage({ type: 'error', text: 'Vehicle No. and Vehicle File required.' });
        return;
      }
    }

    if (newStatus === 'Completed') {
      const hasInvoice =
        currentOrder.details?.invoiceNo && currentOrder.details.invoiceNo.trim().length > 0;
      const hasInvoiceDocs =
        currentOrder.details?.invoiceDriveId && currentOrder.details.invoiceDriveId.length > 0;
      if (!hasInvoice || !hasInvoiceDocs) {
        onShowMessage({ type: 'error', text: 'Invoice No. and Invoice File required.' });
        return;
      }
      if (!currentOrder.details?.invoiceIssueDate || currentOrder.details.invoiceIssueDate.trim() === '') {
        onShowMessage({ type: 'error', text: 'Invoice Issue Date is required before marking the order Completed.' });
        return;
      }
      const { min, max } = getInvoiceIssueDateBounds();
      const issueDate = toLocalISODate(currentOrder.details.invoiceIssueDate);
      if (issueDate < min || issueDate > max) {
        onShowMessage({
          type: 'error',
          text: 'Invoice Issue Date must be today or yesterday.',
        });
        return;
      }
    }

    if (!canTransitionToGeneral(currentOrder.status || '', newStatus)) {
      onShowMessage({ type: 'error', text: `Cannot transition from '${currentOrder.status}' to '${newStatus}'.` });
      return;
    }

    setIsSaving(true);

    const historyEntry: EditHistoryEntry = {
      timestamp: Date.now(),
      editorName: currentUserProfile.name || currentUserProfile.email,
      description: `Status changed to '${newStatus}'`,
    };

    try {
      const extra = newStatus === 'Completed'
        ? { details: { invoiceIssueDate: currentOrder.details?.invoiceIssueDate } }
        : undefined;
      await apiService.updateOrderStatus(currentOrder.deoNo, newStatus, historyEntry, extra);
      onOrderUpdated();
      onClose();
      onShowMessage({ type: 'success', text: `Status updated to ${newStatus}!` });
    } catch (e: any) {
      console.error('Status update failed:', e);
      const errorMessage = process.env.NODE_ENV === 'production'
        ? 'Failed to update status.'
        : `Status update failed: ${e.message}`;
      onShowMessage({ type: 'error', text: errorMessage });
    } finally {
      setIsSaving(false);
    }
  }, [currentUserProfile, currentOrder, onShowMessage, onOrderUpdated, onClose, apiService, canTransitionToGeneral]);

  const onApprove = useCallback(() => handleUpdateOrderStatus('Approved for Production'), [handleUpdateOrderStatus]);
  const onReadyForDispatch = useCallback(() => handleUpdateOrderStatus('Ready for Dispatch'), [handleUpdateOrderStatus]);
  const onDispatchedInvoiced = useCallback(() => handleUpdateOrderStatus('Dispatched and Invoiced'), [handleUpdateOrderStatus]);
  const onComplete = useCallback(() => handleUpdateOrderStatus('Completed'), [handleUpdateOrderStatus]);
  const onCancelOrder = useCallback(() => handleUpdateOrderStatus('Cancelled'), [handleUpdateOrderStatus]);

  const handleMarkAsPaid = async () => {
    if (!currentUserProfile || !currentOrder) return;

    if (currentOrder.customerPaymentStatus !== 'new-unpaid') {
      onShowMessage({ type: 'warning', text: "Order is not 'New Customer - Unpaid'." });
      return;
    }
    if (!canMarkAsPaid(currentUserProfile.role)) {
      onShowMessage({ type: 'error', text: 'Only Super Admin can mark as paid.' });
      return;
    }

    setIsMarkingPaid(true);

    const historyEntry: EditHistoryEntry = {
      timestamp: Date.now(),
      editorName: currentUserProfile.name || currentUserProfile.email,
      description: "Payment status changed to 'new-paid'",
    };

    try {
      await apiService.updateOrder(currentOrder.deoNo, { customerPaymentStatus: CustomerPaymentStatus.NEW_PAID }, historyEntry);
      onOrderUpdated();
      onClose();
      onShowMessage({ type: 'success', text: 'Order marked as Paid!' });
    } catch (e: any) {
      console.error('Mark as paid failed:', e);
      onShowMessage({ type: 'error', text: 'Failed to mark as paid.' });
    } finally {
      setIsMarkingPaid(false);
    }
  };

  const handleCreatePartDeliveryOrder = async () => {
    if (!currentUserProfile || !currentOrder) return;

    if (currentOrder.customerPaymentStatus === 'new-unpaid') {
      onShowMessage({ type: 'error', text: 'Cannot create part delivery for unpaid customers.' });
      return;
    }
    if (!canCreatePartDelivery(currentUserProfile.role)) {
      onShowMessage({ type: 'error', text: 'Only Operations or Super Admin can create part delivery.' });
      return;
    }

    setIsCreatingPartDelivery(true);

    try {
      const newDeoNo = `${currentOrder.deoNo}-A`;
      const newOrder: Order = {
        deoNo: newDeoNo,
        client: currentOrder.client,
        contactNo: currentOrder.contactNo,
        organizationContact: currentOrder.organizationContact,
        customerPaymentStatus: currentOrder.customerPaymentStatus,
        products: currentOrder.products,
        partDelivery: currentOrder.partDelivery,
        isHighPriority: currentOrder.isHighPriority,
        status: 'Ready for Dispatch',
        details: {
          orderDate: currentOrder.details?.orderDate || '',
          invoiceDetails: currentOrder.details?.invoiceDetails || '',
          siteDeliveryInfo: currentOrder.details?.siteDeliveryInfo || '',
          transportProvider: currentOrder.details?.transportProvider,
          measurementKata: currentOrder.details?.measurementKata,
          vehicleNo: '',
          invoiceNo: '',
          productDriveIds: [],
          vehicleDriveIds: [],
          invoiceDriveId: [],
        },
        editHistory: [],
      };

      const createdPartOrder = await apiService.addOrder(newOrder);
      const historyEntry: EditHistoryEntry = {
        timestamp: Date.now(),
        editorName: currentUserProfile.name || currentUserProfile.email,
        description: `Part delivery order '${createdPartOrder.deoNo}' created.`,
      };
      await apiService.updateOrder(currentOrder.deoNo, {}, historyEntry);

      onOrderUpdated();
      onClose();
      onShowMessage({ type: 'success', text: `Part delivery '${createdPartOrder.deoNo}' created!` });
    } catch (e: any) {
      console.error('Part delivery creation failed:', e);
      onShowMessage({ type: 'error', text: 'Failed to create part delivery.' });
    } finally {
      setIsCreatingPartDelivery(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!currentUserProfile || !currentOrder) return;

    if (!isSuperAdmin(currentUserProfile.role)) {
      onShowMessage({ type: 'error', text: 'Only Super Admin can delete orders.' });
      return;
    }

    setIsDeletingOrder(true);
    onShowMessage({ type: 'warning', text: 'Order deletion is not yet implemented.' });

    try {
      setIsConfirmDeleteDialogOpen(false);
    } catch (e: any) {
      console.error('Delete failed:', e);
      onShowMessage({ type: 'error', text: 'Failed to delete order.' });
    } finally {
      setIsDeletingOrder(false);
    }
  };

  // ------------------------------------------------------------
  // Save flow
  // ------------------------------------------------------------
  const buildChangeDescription = (original: Order, changes: Partial<Order>): string => {
    const descriptions: string[] = [];

    if (changes.client && changes.client !== original.client) descriptions.push(`Client to '${changes.client}'`);
    if (changes.contactNo && changes.contactNo !== original.contactNo) descriptions.push(`Contact to '${changes.contactNo}'`);
    if (changes.customerPaymentStatus && changes.customerPaymentStatus !== original.customerPaymentStatus) {
      descriptions.push(`Payment status to '${changes.customerPaymentStatus}'`);
    }
    if (changes.products && changes.products !== original.products) descriptions.push('Product details');
    if (changes.partDelivery !== undefined && changes.partDelivery !== original.partDelivery) {
      descriptions.push(`Part delivery: ${changes.partDelivery ? 'Yes' : 'No'}`);
    }
    if (changes.isHighPriority !== undefined && changes.isHighPriority !== original.isHighPriority) {
      descriptions.push(`High priority: ${changes.isHighPriority ? 'Yes' : 'No'}`);
    }
    if (changes.details?.invoiceDetails && changes.details.invoiceDetails !== original.details?.invoiceDetails) {
      descriptions.push('Invoice details');
    }
    if (changes.details?.vehicleNo && changes.details.vehicleNo !== original.details?.vehicleNo) {
      descriptions.push(`Vehicle No. to '${changes.details.vehicleNo}'`);
    }
    if (changes.details?.invoiceNo && changes.details.invoiceNo !== original.details?.invoiceNo) {
      descriptions.push(`Invoice No. to '${changes.details.invoiceNo}'`);
    }
    if (changes.details?.invoiceIssueDate && changes.details.invoiceIssueDate !== original.details?.invoiceIssueDate) {
      descriptions.push(`Invoice issue date to '${changes.details.invoiceIssueDate}'`);
    }

    return descriptions.length > 0 ? `Updated: ${descriptions.join(', ')}` : 'Minor updates';
  };

  const buildUpdatePayload = (changes: Partial<Order>): Partial<Order> => {
    const payload: Partial<Order> = {};

    if (changes.client) payload.client = changes.client;
    if (changes.contactNo) payload.contactNo = changes.contactNo;
    if (changes.customerPaymentStatus) payload.customerPaymentStatus = changes.customerPaymentStatus;
    if (changes.products) payload.products = changes.products;
    if (changes.status) payload.status = changes.status;
    if (changes.isHighPriority !== undefined) payload.isHighPriority = changes.isHighPriority;
    if (changes.partDelivery !== undefined) payload.partDelivery = changes.partDelivery;
    if (changes.organizationContact) payload.organizationContact = changes.organizationContact;

    if (changes.details && Object.keys(changes.details).length > 0) {
      payload.details = {};

      if (changes.details.orderDate) payload.details.orderDate = changes.details.orderDate;
      if (changes.details.invoiceDetails !== undefined) payload.details.invoiceDetails = changes.details.invoiceDetails;
      if (changes.details.vehicleNo !== undefined) payload.details.vehicleNo = changes.details.vehicleNo;
      if (changes.details.invoiceNo !== undefined) payload.details.invoiceNo = changes.details.invoiceNo;
      if (changes.details.invoiceIssueDate !== undefined) payload.details.invoiceIssueDate = changes.details.invoiceIssueDate;
      if (changes.details.siteDeliveryInfo !== undefined) payload.details.siteDeliveryInfo = changes.details.siteDeliveryInfo;
      if (changes.details.measurementKata) payload.details.measurementKata = changes.details.measurementKata;
      if (changes.details.transportProvider) payload.details.transportProvider = changes.details.transportProvider;
      if (changes.details.transportProviderName !== undefined) payload.details.transportProviderName = changes.details.transportProviderName;
    }

    return payload;
  };

  const handleSaveAllChanges = useCallback(async () => {
    if (!currentUserProfile || !currentOrder) {
      onShowMessage({ type: 'error', text: 'Please log in to save changes.' });
      return;
    }

    if (pendingChanges.textFields.contactNo) {
      const contact = pendingChanges.textFields.contactNo.trim();
      if (contact.length !== 10 || !/^\d{10}$/.test(contact)) {
        onShowMessage({ type: 'error', text: 'Contact No. must be exactly 10 digits.' });
        return;
      }
    }

    setIsSaving(true);
    onShowMessage({ type: 'info', text: 'Saving changes...' });
    console.time('saveAllChanges');

    try {
      if (Object.keys(pendingChanges.textFields).length > 0) {
        const changes = buildChangeDescription(currentOrder, pendingChanges.textFields);
        const historyEntry: EditHistoryEntry = {
          timestamp: Date.now(),
          editorName: currentUserProfile.name || currentUserProfile.email,
          description: changes,
        };

        const payload = buildUpdatePayload(pendingChanges.textFields);
        await apiService.updateOrder(currentOrder.deoNo, payload, historyEntry);
      }

      const fileUploads: Array<{ stage: 'product' | 'vehicle' | 'invoice' | 'productVoiceNote' | 'invoiceVoiceNote'; files: File[] }> = [];

      if (pendingChanges.productFiles.length > 0) fileUploads.push({ stage: 'product', files: pendingChanges.productFiles });
      if (pendingChanges.vehicleFiles.length > 0) fileUploads.push({ stage: 'vehicle', files: pendingChanges.vehicleFiles });
      if (pendingChanges.invoiceFiles.length > 0) fileUploads.push({ stage: 'invoice', files: pendingChanges.invoiceFiles });
      if (pendingChanges.productAudioFiles.length > 0) fileUploads.push({ stage: 'productVoiceNote', files: pendingChanges.productAudioFiles });
      if (pendingChanges.invoiceAudioFiles.length > 0) fileUploads.push({ stage: 'invoiceVoiceNote', files: pendingChanges.invoiceAudioFiles });

      for (const upload of fileUploads) {
        try {
          onShowMessage({
            type: 'info',
            text: `Processing ${upload.files.length} file(s) for ${upload.stage}...`,
          });

          if (upload.stage === 'productVoiceNote' || upload.stage === 'invoiceVoiceNote') {
            await fileApi.uploadFiles(currentOrder.deoNo, upload.files, upload.stage, 'order');
            onShowMessage({
              type: 'info',
              text: `Uploaded ${upload.files.length} audio file(s) for ${upload.stage}`,
            });
          } else {
            const { pdfBytes, filename } = await processFilesToPdf(upload.files, upload.stage);
            const uploadObject = await pdfBytesToFile(pdfBytes, filename);
            onShowMessage({
              type: 'info',
              text: `Created ${filename} (${formatFileSize(pdfBytes.length)})`,
            });

            await apiService.uploadFile(currentOrder.deoNo, upload.stage, [uploadObject]);
          }
        } catch (error) {
          console.error(`Failed to process ${upload.stage} files:`, error);
          onShowMessage({
            type: 'error',
            text: `Failed to process ${upload.stage} files: ${error}`,
          });
          throw error;
        }
      }

      await refreshCurrentOrderFromServer(currentOrder.deoNo);

      resetPendingChanges();
      setIsEditMode(false);

      const totalFiles = fileUploads.reduce((sum, u) => sum + u.files.length, 0);
      const message = totalFiles > 0
        ? `Order updated successfully with ${totalFiles} file(s)!`
        : 'Order updated successfully!';

      onShowMessage({ type: 'success', text: message });
    } catch (e: any) {
      console.error('Save all changes failed:', e);
      const errorMessage = process.env.NODE_ENV === 'production'
        ? 'Failed to save changes. Please try again.'
        : `Save failed: ${e.message}`;
      onShowMessage({ type: 'error', text: errorMessage });
    } finally {
      setIsSaving(false);
      console.timeEnd('saveAllChanges');
    }
  }, [currentOrder, pendingChanges, currentUserProfile, onShowMessage, onOrderUpdated, apiService, fileApi, refreshCurrentOrderFromServer]);

  // ------------------------------------------------------------
  // PDF
  // ------------------------------------------------------------
  const handleExportPdf = useCallback(() => {
    if (!currentOrder || !currentUserProfile) return;
    const role = currentUserProfile.role;
    const superAdminConfig = role === 'super-admin' ? pdfFieldConfig : undefined;
    const fieldVisibility = getEffectiveFieldVisibility(role, superAdminConfig);
    const generatedBy = currentUserProfile.name || currentUserProfile.email;
    openOrderPdfInNewTab(currentOrder, fieldVisibility, generatedBy);
  }, [currentOrder, currentUserProfile, pdfFieldConfig]);

  const handlePdfConfigSaved = useCallback((newConfig: PdfFieldVisibilityMap) => {
    setPdfFieldConfig(newConfig);
  }, []);

  // ------------------------------------------------------------
  // Stable callback wrappers
  // ------------------------------------------------------------
  const onTextChange = useCallback(handleTextChange, []);
  const onPaymentStatusChange = useCallback(handlePaymentStatusChange, []);
  const onPartDeliveryChange = useCallback(handlePartDeliveryChange, []);
  const onHighPriorityChange = useCallback(handleHighPriorityChange, []);
  const onStatusSelectChange = useCallback(handleStatusSelectChange, []);
  const onWeightScaleChange = useCallback(handleWeightScaleChange, []);
  const onTransportProviderChange = useCallback(handleTransportProviderChange, []);
  const onVehicleFileAdd = useCallback((files: File[]) => handleFileAdd(files, 'vehicle'), []);
  const onVehicleFileRemove = useCallback((i: number) => handleFileRemove(i, 'vehicle'), []);
  const onProductFileAdd = useCallback((files: File[]) => handleFileAdd(files, 'product'), []);
  const onProductFileRemove = useCallback((i: number) => handleFileRemove(i, 'product'), []);
  const onInvoiceFileAdd = useCallback((files: File[]) => handleFileAdd(files, 'invoice'), []);
  const onInvoiceFileRemove = useCallback((i: number) => handleFileRemove(i, 'invoice'), []);
  const onAdditionalInfoToggle = useCallback(() => setAdditionalInfoOpen((o) => !o), []);
  const onVehicleSectionToggle = useCallback(() => setVehicleSectionOpen((o) => !o), []);
  const onProductSectionToggle = useCallback(() => setProductSectionOpen((o) => !o), []);
  const onInvoiceSectionToggle = useCallback(() => setInvoiceSectionOpen((o) => !o), []);
  const onEditOrder = useCallback(() => setIsEditMode(true), []);
  const onDeleteClick = useCallback(() => {
    setIsMoreActionsOpen(false);
    setIsConfirmDeleteDialogOpen(true);
  }, []);
  const handleUploadComplete = useCallback(async () => {
    await onOrderUpdated();
  }, [onOrderUpdated]);

  const handleProductAudioStaged = useCallback((files: File[]) => handleAudioFileAdd(files, 'product'), []);
  const handleProductAudioRemoved = useCallback((index: number) => handleAudioFileRemove(index, 'product'), []);
  const handleInvoiceAudioStaged = useCallback((files: File[]) => handleAudioFileAdd(files, 'invoice'), []);
  const handleInvoiceAudioRemoved = useCallback((index: number) => handleAudioFileRemove(index, 'invoice'), []);

  const handleCancelEdit = () => {
    resetPendingChanges();
    setIsEditMode(false);
  };

  // ------------------------------------------------------------
  // Guard / early returns
  // ------------------------------------------------------------
  if (!order || !currentOrder || !currentUserProfile) return null;

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open) {
          onClose();
          onOrderUpdated();
        }
      }}>
        <DialogContent
          className={`sm:max-w-[800px] md:max-w-[1400px] p-2 md:p-4 rounded-xl shadow-2xl overflow-y-auto max-h-[80vh] md:max-h-[90vh] z-[9000] dialog-custom-scrollbar ${dialogBackgroundClass}`}
        >
          {isOpsUnpaidWarning && (
            <div className="sticky top-0 z-[9010] w-full mb-4 px-2">
              <div className="bg-red-600 text-white py-4 rounded-lg text-center animate-pulse shadow-2xl border-4 border-red-400">
                <h2 className="text-3xl md:text-5xl font-black tracking-tighter uppercase">
                  PAYMENT NOT COMPLETED
                </h2>
                <p className="text-sm font-bold opacity-90 mt-1">
                  OPERATIONS ALERT: CHECK PAYMENT STATUS BEFORE PROCEEDING
                </p>
              </div>
            </div>
          )}

          <DialogHeader>
            <div className="flex items-start justify-between gap-2">
              <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3 flex-wrap">
                {isEditMode ? `Edit Order - ${currentOrder.deoNo}` : `Order Details - ${currentOrder.deoNo}`}
                {displayOrder?.isHighPriority && (
                  <span className="text-[10px] uppercase tracking-widest rounded-full px-3 py-1 shadow-xl transition-transform duration-300 transform hover:scale-[1.03] flex items-center bg-red-600 text-white shadow-red-500/50">
                    <Zap className="w-3 h-3 mr-1 fill-white" />
                    HIGH PRIORITY
                  </span>
                )}
                {isEditMode && pendingChanges.hasChanges && (
                  <Badge className="bg-orange-500 text-white animate-pulse">
                    <Save className="w-3 h-3 mr-1" />
                    Unsaved Changes
                  </Badge>
                )}
              </DialogTitle>

              {canExportPdf(currentUserProfile.role) && !isEditMode && (
                <div className="flex items-center gap-1.5 shrink-0 pt-0.5 mr-5">
                  {canConfigurePdf(currentUserProfile.role) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Configure PDF fields"
                      onClick={() => setIsPdfConfigOpen(true)}
                      className="h-8 w-8 text-gray-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950 rounded-lg"
                    >
                      <Settings2 className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={handleExportPdf}
                    className="h-8 px-3 bg-slate-800 hover:bg-slate-700 text-white text-xs gap-1.5 rounded-lg shadow"
                    title="Export order as PDF (opens in new tab)"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    Export PDF
                  </Button>
                </div>
              )}
            </div>
            <DialogDescription className="text-gray-600 dark:text-gray-400 mt-1">
              {isEditMode ? 'Make changes and click Save All to apply.' : 'Comprehensive order information.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <div className="space-y-6">
              <ClientStatusCard
                isEditMode={isEditMode}
                role={role}
                status={displayOrder?.status}
                customerPaymentStatus={displayOrder?.customerPaymentStatus}
                client={displayOrder?.client || ''}
                contactNo={displayOrder?.contactNo || ''}
                organizationContact={displayOrder?.organizationContact || ''}
                partDelivery={displayOrder?.partDelivery || false}
                isHighPriority={displayOrder?.isHighPriority || false}
                orderDate={displayOrder?.details?.orderDate}
                isAdditionalInfoOpen={isAdditionalInfoOpen}
                onAdditionalInfoToggle={onAdditionalInfoToggle}
                onTextChange={onTextChange}
                onPaymentStatusChange={onPaymentStatusChange}
                onPartDeliveryChange={onPartDeliveryChange}
                onHighPriorityChange={onHighPriorityChange}
                onStatusSelectChange={onStatusSelectChange}
                onEditCustomer={handleEditCustomer}
                shippingAddresses={shippingAddressOptions}
                selectedShippingAddress={selectedShippingAddress}
                onShippingAddressChange={handleShippingAddressChange}
                canEditClient={canEditClient}
                canEditContact={canEditContact}
                canEditPaymentStatus={canEditPaymentStatus}
                canEditPartDelivery={canEditPartDelivery}
                canEditHighPriority={canEditHighPriority}
                canEditStatusSelect={canEditStatusSelect}
              />

              <DeliveryVehicleCard
                isEditMode={isEditMode}
                role={role}
                isOperationsRole={isOperations(role)}
                canEditSite={canEditSiteInfoPerm}
                measurementKata={displayOrder?.details?.measurementKata}
                transportProvider={displayOrder?.details?.transportProvider}
                transportProviderName={displayOrder?.details?.transportProviderName}
                vehicleNo={displayOrder?.details?.vehicleNo}
                siteDeliveryInfo={displayOrder?.details?.siteDeliveryInfo}
                isVehicleSectionOpen={vehicleSectionOpen}
                onVehicleSectionToggle={onVehicleSectionToggle}
                onTextChange={onTextChange}
                onWeightScaleChange={onWeightScaleChange}
                onTransportProviderChange={onTransportProviderChange}
                vehicleDriveIds={displayOrder?.details?.vehicleDriveIds || []}
                pendingVehicleFiles={pendingChanges.vehicleFiles}
                mergePreviewVehicle={mergePreviews.vehicle}
                onVehicleFileAdd={onVehicleFileAdd}
                onVehicleFileRemove={onVehicleFileRemove}
                onDeleteUploadedFile={handleDeleteUploadedFile}
                canEditMeasurementKata={canEditMeasurementKata}
                canEditTransportProvider={canEditTransportProvider}
                canEditVehicleNo={canEditVehicleNo}
                canEditSiteInfo={canEditSiteInfoPerm}
                canEditVehicleFiles={canEditVehicleFiles}
              />
            </div>

            <div className="space-y-6">
              <ProductDetailsCard
                isEditMode={isEditMode}
                role={role}
                currentUserProfile={currentUserProfile}
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
                transportProvider={displayOrder?.details?.transportProvider}
                transportProviderName={displayOrder?.details?.transportProviderName}
                measurementKata={displayOrder?.details?.measurementKata}
                customerPaymentStatus={displayOrder?.customerPaymentStatus}
                canEditProducts={canEditProducts}
                canEditProductFiles={canEditProductFiles}
              />

              {showInvoiceCard && (
                <InvoiceDetailsCard
                  isEditMode={isEditMode}
                  role={role}
                  status={displayOrder?.status}
                  deoNo={currentOrder.deoNo}
                  currentUserProfile={currentUserProfile}
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
                  canEditInvoiceDetails={canEditInvoiceDetails}
                  canEditInvoiceNo={canEditInvoiceNo}
                  canEditInvoiceIssueDate={canEditInvoiceIssueDate}
                  canEditInvoiceFiles={canEditInvoiceFiles}
                />
              )}
            </div>
          </div>

          <OrderActionsFooter
            isEditMode={isEditMode}
            isSaving={isSaving}
            isMarkingPaid={isMarkingPaid}
            isCreatingPartDelivery={isCreatingPartDelivery}
            isMoreActionsOpen={isMoreActionsOpen}
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
            onEditOrder={onEditOrder}
            onApprove={onApprove}
            onReadyForDispatch={onReadyForDispatch}
            onPartDelivery={handleCreatePartDeliveryOrder}
            onDispatchedInvoiced={onDispatchedInvoiced}
            onComplete={onComplete}
            onMoreActionsOpenChange={setIsMoreActionsOpen}
            onMarkAsPaid={handleMarkAsPaid}
            onCancelOrder={onCancelOrder}
            onDeleteClick={onDeleteClick}
            deoNo={currentOrder.deoNo}
            currentUserProfile={currentUserProfile}
          />
        </DialogContent>

        <Dialog open={isConfirmDeleteDialogOpen} onOpenChange={setIsConfirmDeleteDialogOpen}>
          <DialogContent className="sm:max-w-[425px] p-4 sm:p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg z-[9003]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Trash2 className="w-6 h-6 text-red-500" />
                Confirm Deletion
              </DialogTitle>
              <DialogDescription className="text-gray-600 dark:text-gray-400 mt-2">
                Are you sure you want to delete order{' '}
                <span className="font-semibold text-gray-900 dark:text-white">{order?.deoNo}</span>?
                <br />
                <span className="text-red-600 dark:text-red-400 font-medium mt-2 block">
                  This action cannot be undone.
                </span>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-6 gap-3">
              <Button variant="outline" onClick={() => setIsConfirmDeleteDialogOpen(false)} disabled={isDeletingOrder}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteOrder}
                disabled={isDeletingOrder}
                className="bg-red-600 hover:bg-red-700"
              >
                {isDeletingOrder && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Order
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Dialog>

      {canConfigurePdf(currentUserProfile.role) && (
        <PdfConfigModal
          isOpen={isPdfConfigOpen}
          onClose={() => setIsPdfConfigOpen(false)}
          currentConfig={pdfFieldConfig}
          onSaved={handlePdfConfigSaved}
          onExport={(config) => {
            if (displayOrder) {
              openOrderPdfInNewTab(displayOrder, config, currentUserProfile.name);
            }
          }}
        />
      )}

      <CustomerDialog
        isOpen={customerDialogOpen}
        mode="edit"
        customer={resolvedCustomer}
        restrictIdentityFields={true}
        onClose={() => setCustomerDialogOpen(false)}
        onSuccess={handleCustomerSuccess}
        onEdit={() => {}}
        onDelete={() => {}}
      />
    </>
  );
};
