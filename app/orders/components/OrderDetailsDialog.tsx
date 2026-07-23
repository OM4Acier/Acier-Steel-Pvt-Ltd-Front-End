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

import { Order, EditHistoryEntry, DialogMessageType } from '../types';
import { ordersApi } from '@/lib/api/endpoints/ordersApi';
const apiService = ordersApi;
import {
  canEditSalesSpecificFields,
  canEditOperationsSpecificFields,
  canEditAccountantSpecificFields,
  canEditSiteInfo,
  canMarkAsPaid, canCreatePartDelivery,
  isSuperAdmin, isOperations,
  canExportPdf, canConfigurePdf,
} from '../permissions';
import { canTransitionToGeneral } from '../constants';

import { processFilesToPdf, pdfBytesToFile, formatFileSize } from '@/lib/utils/pdfMergeUtils';
import { fileApi } from '@/lib/api/endpoints/fileApi';
import ClientStatusCard from './cards/ClientStatusCard';
import DeliveryVehicleCard from './cards/DeliveryVehicleCard';
import ProductDetailsCard from './cards/ProductDetailsCard';
import InvoiceDetailsCard from './cards/InvoiceDetailsCard';
import OrderActionsFooter from './cards/OrderActionsFooter';

// PDF utilities
import {
  loadSuperAdminPdfConfig,
  getEffectiveFieldVisibility,
  PdfFieldVisibilityMap,
} from '../pdfConfig';
import { openOrderPdfInNewTab } from '../generateOrderPdf';
import { PdfConfigModal } from './PdfConfigModal';
import { UserProfile } from '@/types/rbac.types';

// Formats a Date/timestamp to a local `YYYY-MM-DD` string (avoids UTC off-by-one near midnight).
const toLocalISODate = (value: string | Date): string => {
  const d = typeof value === 'string' ? new Date(value) : value;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Invoice issue date is only allowed for today and the previous day (local calendar day).
// Returns ISO `YYYY-MM-DD` strings formatted from local date components.
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

interface OrderDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  currentUserProfile: UserProfile | null;
  onOrderUpdated: () => void;
  onShowMessage: (message: DialogMessageType) => void;
  paymentStatusGradients: Record<string, string>;
}

// Centralized pending changes tracker
// 1. Update PendingChanges interface to include audio files:
interface PendingChanges {
  textFields: Partial<Order>;
  productFiles: File[];
  vehicleFiles: File[];
  invoiceFiles: File[];
  productAudioFiles: File[];      // NEW
  invoiceAudioFiles: File[];      // NEW
  hasChanges: boolean;
}

export const OrderDetailsDialog: React.FC<OrderDetailsDialogProps> = ({
  isOpen, onClose, order, currentUserProfile,
  onOrderUpdated, onShowMessage, paymentStatusGradients,
}) => {
  // UI State
  const [isEditMode, setIsEditMode] = useState(false);
  const [isMoreActionsOpen, setIsMoreActionsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [isCreatingPartDelivery, setIsCreatingPartDelivery] = useState(false);
  const [isDeletingOrder, setIsDeletingOrder] = useState(false);
  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);

  // ── PDF Export State ──────────────────────────────────────────
  const [isPdfConfigOpen, setIsPdfConfigOpen] = useState(false);
  const [pdfFieldConfig, setPdfFieldConfig] = useState<PdfFieldVisibilityMap>(() =>
    loadSuperAdminPdfConfig()
  );

  // Section toggles
  const [productSectionOpen, setProductSectionOpen] = useState(false);
  const [vehicleSectionOpen, setVehicleSectionOpen] = useState(false);
  const [invoiceSectionOpen, setInvoiceSectionOpen] = useState(false);
  const [isAdditionalInfoOpen, setAdditionalInfoOpen] = useState(false);


  // Single source of truth for displayed data
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);

  // Pending changes (only in edit mode)
  const [pendingChanges, setPendingChanges] = useState<PendingChanges>({
    textFields: {},
    productFiles: [],
    vehicleFiles: [],
    invoiceFiles: [],
    productAudioFiles: [],      // NEW
    invoiceAudioFiles: [],     // NEW
    hasChanges: false,
  });

  const [mergePreviews, setMergePreviews] = useState<{
    product?: { fileCount: number; totalSize: number };
    vehicle?: { fileCount: number; totalSize: number };
    invoice?: { fileCount: number; totalSize: number };
  }>({});


  // Initialize order data
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
    }
  }, [order, isOpen]);


  // 2. Initialize audio file arrays in resetPendingChanges:
  const resetPendingChanges = () => {
    setPendingChanges({
      textFields: {},
      productFiles: [],
      vehicleFiles: [],
      invoiceFiles: [],
      productAudioFiles: [],        // NEW
      invoiceAudioFiles: [],        // NEW
      hasChanges: false,
    });
    setMergePreviews({});
  };


  // Compute display order (merge current + pending)
  const displayOrder = React.useMemo(() => {
    if (!currentOrder) return null;
    if (!isEditMode) return currentOrder;

    // Deep merge for details
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

  // ============= CENTRALIZED UPDATE HANDLER =============
  const handleSaveAllChanges = useCallback(async () => {
    if (!currentUserProfile || !currentOrder) {
      onShowMessage({ type: 'error', text: 'Please log in to save changes.' });
      return;
    }

    // Validate contact number if changed
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
      // Step 1: Save text field changes if any
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

      // Step 2: Upload files sequentially (product -> vehicle -> invoice)
      const fileUploads: Array<{ stage: 'product' | 'vehicle' | 'invoice' | 'productVoiceNote' | 'invoiceVoiceNote'; files: File[] }> = [];

      if (pendingChanges.productFiles.length > 0) {
        fileUploads.push({ stage: 'product', files: pendingChanges.productFiles });
      }
      if (pendingChanges.vehicleFiles.length > 0) {
        fileUploads.push({ stage: 'vehicle', files: pendingChanges.vehicleFiles });
      }
      if (pendingChanges.invoiceFiles.length > 0) {
        fileUploads.push({ stage: 'invoice', files: pendingChanges.invoiceFiles });
      }
      // NEW: Add audio file uploads
      if (pendingChanges.productAudioFiles.length > 0) {
        fileUploads.push({ stage: 'productVoiceNote', files: pendingChanges.productAudioFiles });
      }
      if (pendingChanges.invoiceAudioFiles.length > 0) {
        fileUploads.push({ stage: 'invoiceVoiceNote', files: pendingChanges.invoiceAudioFiles });
      }

      // ... (Start of the fileUploads array preparation)


      for (const upload of fileUploads) {
        try {
          // Show processing message
          onShowMessage({
            type: 'info',
            text: `Processing ${upload.files.length} file(s) for ${upload.stage}...`
          });



          // Audio files don't need PDF processing
          if (upload.stage === 'productVoiceNote' || upload.stage === 'invoiceVoiceNote') {

            await fileApi.uploadFiles(
              currentOrder.deoNo,
              upload.files,
              upload.stage,
              "order"
            );

            onShowMessage({
              type: 'info',
              text: `Uploaded ${upload.files.length} audio file(s) for ${upload.stage}`
            });
          } else {
            // Process images/PDFs to single PDF per section
            const { pdfBytes, filename } = await processFilesToPdf(upload.files, upload.stage);
            const uploadObject = await pdfBytesToFile(pdfBytes, filename);

            onShowMessage({
              type: 'info',
              text: `Created ${filename} (${formatFileSize(pdfBytes.length)})`
            });

            await apiService.uploadFile(
              currentOrder.deoNo,
              upload.stage,
              [uploadObject]
            );
          }
        } catch (error) {
          console.error(`Failed to process ${upload.stage} files:`, error);
          onShowMessage({
            type: 'error',
            text: `Failed to process ${upload.stage} files: ${error}`
          });
          throw error;
        }
      }




      // Step 3: Fetch fresh data from server
      const freshOrderData = await apiService.fetchOrders();

      // Handle both single order and array response
      const freshOrder = Array.isArray(freshOrderData)
        ? freshOrderData.find((o: Order) => o.deoNo === currentOrder.deoNo)
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

        // Update local state with fresh data
        setCurrentOrder(normalizedFreshOrder);
      }

      // Step 4: Cleanup and exit edit mode
      resetPendingChanges();
      setMergePreviews({});
      setIsEditMode(false);

      // Refresh parent list
      //onOrderUpdated();

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
      //onOrderUpdated();
      console.timeEnd('saveAllChanges');
    }
  }, [currentOrder, pendingChanges, currentUserProfile, onShowMessage, onOrderUpdated]);

  // Helper: Build change description
  const buildChangeDescription = (original: Order, changes: Partial<Order>): string => {
    const descriptions: string[] = [];

    if (changes.client && changes.client !== original.client) {
      descriptions.push(`Client to '${changes.client}'`);
    }
    if (changes.contactNo && changes.contactNo !== original.contactNo) {
      descriptions.push(`Contact to '${changes.contactNo}'`);
    }
    if (changes.customerPaymentStatus && changes.customerPaymentStatus !== original.customerPaymentStatus) {
      descriptions.push(`Payment status to '${changes.customerPaymentStatus}'`);
    }
    if (changes.products && changes.products !== original.products) {
      descriptions.push('Product details');
    }
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

    return descriptions.length > 0
      ? `Updated: ${descriptions.join(', ')}`
      : 'Minor updates';
  };

  // Helper: Build API payload
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

    // Build details object only if there are detail changes
    if (changes.details && Object.keys(changes.details).length > 0) {
      payload.details = {};

      if (changes.details.orderDate) payload.details.orderDate = changes.details.orderDate;
      if (changes.details.invoiceDetails !== undefined) payload.details.invoiceDetails = changes.details.invoiceDetails;
      if (changes.details.vehicleNo !== undefined) payload.details.vehicleNo = changes.details.vehicleNo;
      if (changes.details.invoiceNo !== undefined) payload.details.invoiceNo = changes.details.invoiceNo;
      if (changes.details.invoiceIssueDate !== undefined) payload.details.invoiceIssueDate = changes.details.invoiceIssueDate;
      if (changes.details.siteDeliveryInfo !== undefined) payload.details.siteDeliveryInfo = changes.details.siteDeliveryInfo;
      if (changes.details.weightScaleType) payload.details.weightScaleType = changes.details.weightScaleType;
      if (changes.details.transportProvider) payload.details.transportProvider = changes.details.transportProvider;
      if (changes.details.transportProviderName !== undefined) payload.details.transportProviderName = changes.details.transportProviderName;
    }

    return payload;
  };

  // ============= TEXT FIELD CHANGE HANDLERS =============
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;

    setPendingChanges(prev => {
      // invoiceIssueDate is a details field per the OrderDetails type, but the
      // backend omits it on existing orders — so `id in currentOrder.details`
      // returns false and the edit lands on the top-level textFields instead of
      // .details, leaving the input value stale. Force it into details.
      const detailsFields = [
        'orderDate',
        'invoiceDetails',
        'vehicleNo',
        'invoiceNo',
        'invoiceIssueDate',
        'siteDeliveryInfo',
        'weightScaleType',
        'transportProvider',
        'transportProviderName'
      ];
      const isDetailsField = detailsFields.includes(id);

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
    setPendingChanges(prev => ({
      ...prev,
      textFields: { ...prev.textFields, customerPaymentStatus: value as any },
      hasChanges: true,
    }));
  };

  const handlePartDeliveryChange = (checked: boolean) => {
    setPendingChanges(prev => ({
      ...prev,
      textFields: { ...prev.textFields, partDelivery: checked },
      hasChanges: true,
    }));
  };

  const handleHighPriorityChange = (checked: boolean) => {
    setPendingChanges(prev => ({
      ...prev,
      textFields: { ...prev.textFields, isHighPriority: checked },
      hasChanges: true,
    }));
  };

  // ============= FILE HANDLERS =============
  const handleFileAdd = (files: File[], stage: 'product' | 'vehicle' | 'invoice') => {
    setPendingChanges(prev => {
      const existingFiles = prev[`${stage}Files` as keyof typeof prev] as File[];
      const newFiles = [...existingFiles, ...files];

      // Calculate merge preview if multiple files
      if (newFiles.length > 1) {
        const totalSize = newFiles.reduce((sum, f) => sum + f.size, 0);
        setMergePreviews(prevPreviews => ({
          ...prevPreviews,
          [stage]: {
            fileCount: newFiles.length,
            totalSize,
          },
        }));
      } else {
        setMergePreviews(prevPreviews => {
          const updated = { ...prevPreviews };
          delete updated[stage];
          return updated;
        });
      }

      return {
        ...prev,
        [`${stage}Files`]: newFiles,
        hasChanges: true,
      };
    });
  };

  // 4. Update handleFileRemove to update merge preview
  const handleFileRemove = (index: number, stage: 'product' | 'vehicle' | 'invoice') => {
    setPendingChanges(prev => {
      const newFiles = (prev[`${stage}Files` as keyof typeof prev] as File[]).filter((_, i) => i !== index);

      // Update merge preview
      if (newFiles.length > 1) {
        const totalSize = newFiles.reduce((sum, f) => sum + f.size, 0);
        setMergePreviews(prevPreviews => ({
          ...prevPreviews,
          [stage]: {
            fileCount: newFiles.length,
            totalSize,
          },
        }));
      } else {
        setMergePreviews(prevPreviews => {
          const updated = { ...prevPreviews };
          delete updated[stage];
          return updated;
        });
      }

      return {
        ...prev,
        [`${stage}Files`]: newFiles,
        hasChanges: pendingChanges.productFiles.length + pendingChanges.vehicleFiles.length + pendingChanges.invoiceFiles.length > 1 ||
          Object.keys(pendingChanges.textFields).length > 0,
      };
    });
  };

  // 3. Add audio file handler (add after handleFileRemove):
  const handleAudioFileAdd = (files: File[], stage: 'product' | 'invoice') => {
    setPendingChanges(prev => {
      const stageKey = `${stage}AudioFiles` as 'productAudioFiles' | 'invoiceAudioFiles';
      const existingFiles = prev[stageKey];
      const newFiles = [...existingFiles, ...files];

      return {
        ...prev,
        [stageKey]: newFiles,
        hasChanges: true,
      };
    });
  };

  const handleAudioFileRemove = (index: number, stage: 'product' | 'invoice') => {
    setPendingChanges(prev => {
      const stageKey = `${stage}AudioFiles` as 'productAudioFiles' | 'invoiceAudioFiles';
      const newFiles = prev[stageKey].filter((_, i) => i !== index);

      return {
        ...prev,
        [stageKey]: newFiles,
        hasChanges: pendingChanges.productFiles.length +
          pendingChanges.vehicleFiles.length +
          pendingChanges.invoiceFiles.length +
          pendingChanges.productAudioFiles.length +
          pendingChanges.invoiceAudioFiles.length > 1 ||
          Object.keys(pendingChanges.textFields).length > 0,
      };
    });
  };

  // Stable callbacks passed to extracted card components — see block below.

  const handleProductAudioStaged = useCallback(
    (files: File[]) => handleAudioFileAdd(files, 'product'),
    []
  );
  const handleProductAudioRemoved = useCallback(
    (index: number) => handleAudioFileRemove(index, 'product'),
    []
  );
  const handleInvoiceAudioStaged = useCallback(
    (files: File[]) => handleAudioFileAdd(files, 'invoice'),
    []
  );
  const handleInvoiceAudioRemoved = useCallback(
    (index: number) => handleAudioFileRemove(index, 'invoice'),
    []
  );

  // ── Stable callbacks passed to extracted card components ──────────────
  // Wrapping these in useCallback keeps their identity stable so React.memo
  // on the cards actually isolates re-renders (inline arrows would defeat it).
  const onTextChange = useCallback(handleTextChange, []);
  const onPaymentStatusChange = useCallback(handlePaymentStatusChange, []);
  const onPartDeliveryChange = useCallback(handlePartDeliveryChange, []);
  const onHighPriorityChange = useCallback(handleHighPriorityChange, []);
  const onStatusSelectChange = useCallback(
    (value: string) => setPendingChanges(prev => ({
      ...prev,
      textFields: { ...prev.textFields, status: value as any },
      hasChanges: true,
    })),
    []
  );
  const onWeightScaleChange = useCallback(
    (value: string) => setPendingChanges(prev => ({
      ...prev,
      textFields: { ...prev.textFields, details: { ...prev.textFields.details, weightScaleType: value as any } },
      hasChanges: true,
    })),
    []
  );
  const onTransportProviderChange = useCallback(
    (value: string) => setPendingChanges(prev => ({
      ...prev,
      textFields: { ...prev.textFields, details: { ...prev.textFields.details, transportProvider: value as any } },
      hasChanges: true,
    })),
    []
  );
  const onVehicleFileAdd = useCallback((files: File[]) => handleFileAdd(files, 'vehicle'), []);
  const onVehicleFileRemove = useCallback((i: number) => handleFileRemove(i, 'vehicle'), []);
  const onProductFileAdd = useCallback((files: File[]) => handleFileAdd(files, 'product'), []);
  const onProductFileRemove = useCallback((i: number) => handleFileRemove(i, 'product'), []);
  const onInvoiceFileAdd = useCallback((files: File[]) => handleFileAdd(files, 'invoice'), []);
  const onInvoiceFileRemove = useCallback((i: number) => handleFileRemove(i, 'invoice'), []);
  const onAdditionalInfoToggle = useCallback(() => setAdditionalInfoOpen(o => !o), []);
  const onVehicleSectionToggle = useCallback(() => setVehicleSectionOpen(o => !o), []);
  const onProductSectionToggle = useCallback(() => setProductSectionOpen(o => !o), []);
  const onInvoiceSectionToggle = useCallback(() => setInvoiceSectionOpen(o => !o), []);
  const onEditOrder = useCallback(() => setIsEditMode(true), []);
  const onDeleteClick = useCallback(() => { setIsMoreActionsOpen(false); setIsConfirmDeleteDialogOpen(true); }, []);

  const handleDeleteUploadedFile = useCallback(async (fileId: string, stage: 'product' | 'vehicle' | 'invoice') => {
    if (!currentUserProfile || !currentOrder) {
      onShowMessage({ type: 'error', text: 'Please log in to delete files.' });
      return;
    }

    // Permission checks
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

      // Refresh order data after deletion
      const freshOrderData = await apiService.fetchOrder(currentOrder.deoNo);

      const freshOrder = Array.isArray(freshOrderData)
        ? freshOrderData.find((o: Order) => o.deoNo === currentOrder.deoNo)
        : freshOrderData;

      if (freshOrder) {
        const normalizedFreshOrder: Order = {
          ...freshOrder,
          details: {
            ...freshOrder.details,
            productDriveIds: freshOrder.details?.productDriveIds || [],
            vehicleDriveIds: freshOrder.details?.vehicleDriveIds || [],
            invoiceDriveId: freshOrder.details?.invoiceDriveId || [],
          },
        };

        // Update local state with fresh data
        setCurrentOrder(normalizedFreshOrder);
      }

      //onOrderUpdated();
      onShowMessage({ type: 'success', text: 'File deleted successfully!' });
    } catch (e: any) {
      console.error(`File deletion failed:`, e);
      const errorMessage = process.env.NODE_ENV === 'production'
        ? 'Failed to delete file.'
        : `Delete failed: ${e.message}`;
      onShowMessage({ type: 'error', text: errorMessage });
    }
  }, [currentUserProfile, currentOrder, onShowMessage, apiService]);

  // ============= STATUS HANDLERS =============
  const handleUpdateOrderStatus = useCallback(async (newStatus: string) => {
    if (!currentUserProfile || !currentOrder) {
      onShowMessage({ type: 'error', text: 'Please log in to update status.' });
      return;
    }

    // Validation checks
    if (currentOrder.status === 'Completed' || currentOrder.status === 'Cancelled') {
      onShowMessage({ type: 'error', text: `Cannot change status from '${currentOrder.status}'.` });
      return;
    }

    if (newStatus === 'Dispatched and Invoiced') {
      if (!currentOrder.details?.vehicleNo || currentOrder.details.vehicleNo.trim() === '' ||
        !currentOrder.details?.vehicleDriveIds || currentOrder.details.vehicleDriveIds.length === 0) {
        onShowMessage({ type: 'error', text: 'Vehicle No. and Vehicle File required.' });
        return;
      }
    }

    if (newStatus === 'Completed') {
      if (!currentOrder.details?.invoiceNo || currentOrder.details.invoiceNo.trim() === '' ||
        !currentOrder.details?.invoiceDriveId || currentOrder.details.invoiceDriveId.length === 0) {
        onShowMessage({ type: 'error', text: 'Invoice No. and Invoice File required.' });
        return;
      }
      if (!currentOrder.details?.invoiceIssueDate || currentOrder.details.invoiceIssueDate.trim() === '') {
        onShowMessage({ type: 'error', text: 'Invoice Issue Date is required before marking the order Completed.' });
        return;
      }
      // Restrict to today and the previous day (local calendar day).
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

  // Stable status-action wrappers for the footer (keep memo isolation).
  const onApprove = useCallback(() => handleUpdateOrderStatus('Approved for Production'), [handleUpdateOrderStatus]);
  const onReadyForDispatch = useCallback(() => handleUpdateOrderStatus('Ready for Dispatch'), [handleUpdateOrderStatus]);
  const onDispatchedInvoiced = useCallback(() => handleUpdateOrderStatus('Dispatched and Invoiced'), [handleUpdateOrderStatus]);
  const onComplete = useCallback(() => handleUpdateOrderStatus('Completed'), [handleUpdateOrderStatus]);
  const onCancelOrder = useCallback(() => handleUpdateOrderStatus('Cancelled'), [handleUpdateOrderStatus]);

  // ============= PDF EXPORT HANDLERS ============
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

  // ============= OTHER HANDLERS =============
  const handleCancelEdit = () => {
    resetPendingChanges();
    setIsEditMode(false);
  };

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
      await apiService.updateOrder(currentOrder.deoNo, { customerPaymentStatus: 'new-paid' }, historyEntry);
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
          weightScaleType: currentOrder.details?.weightScaleType,
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
      // await apiService.deleteOrder(currentOrder.deoNo, currentUserProfile.accessToken);
      setIsConfirmDeleteDialogOpen(false);
      // onShowMessage({ type: 'success', text: 'Order deleted!' });
    } catch (e: any) {
      console.error('Delete failed:', e);
      onShowMessage({ type: 'error', text: 'Failed to delete order.' });
    } finally {
      setIsDeletingOrder(false);
    }
  };

  // Handle upload complete - refetch task data
  const handleUploadComplete = useCallback(async () => {
    await onOrderUpdated();
  }, [onOrderUpdated]);

  if (!order || !currentOrder) return null;
  const isPaymentPending =
    displayOrder?.customerPaymentStatus === "new-unpaid" &&
    displayOrder?.status === "Ready for Dispatch";





  if (!currentUserProfile) {
    return null; // Loading screen is handled by LoadingContext
  }

  // 1. Logic for Operations role and specific payment status
  const isOpsUnpaidWarning =
    isOperations(currentUserProfile?.role ?? null) &&
    displayOrder?.customerPaymentStatus === 'new-unpaid';

  // 2. Determine background colour based on role and status
  const dialogBackgroundClass = isOpsUnpaidWarning
    ? 'bg-gradient-to-br from-red-100 via-red-50 to-red-100 dark:from-red-950 dark:via-gray-800 dark:to-red-950 shadow-[inset_0_0_50px_rgba(220,38,38,0.2)]'
    : (displayOrder ? (paymentStatusGradients[displayOrder.customerPaymentStatus] || 'bg-white dark:bg-gray-800') : 'bg-white dark:bg-gray-800');

  // ============= RENDER =============
  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open) {
          onClose();         // your close handler
          onOrderUpdated(); // your custom function
        }
      }}>
        <DialogContent
          className={`sm:max-w-[800px] md:max-w-[1400px] p-2 md:p-4 rounded-xl shadow-2xl overflow-y-auto max-h-[80vh] md:max-h-[90vh] z-[9000] dialog-custom-scrollbar ${dialogBackgroundClass}'
          }`}
        >

          {/* 3. Flashing "PAYMENT NOT COMPLETED" Warning */}
          {isOpsUnpaidWarning && (
            <div className="sticky top-0 z-[9010] w-full mb-4 px-2">
              <div className="bg-red-600 text-white py-4 rounded-lg text-center animate-pulse shadow-2xl border-4 border-red-400">
                <h2 className="text-3xl md:text-5xl font-black tracking-tighter uppercase">
                  PAYMENT NOT COMPLETED
                </h2>
                <p className="text-sm font-bold opacity-90 mt-1">OPERATIONS ALERT: CHECK PAYMENT STATUS BEFORE PROCEEDING</p>
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

              {/* ── PDF Export Actions ─────────────────────────── */}
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

          {/* MAIN CONTENT - Two Column Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            {/* LEFT COLUMN */}
            <div className="space-y-6">
              {/* Client & Status Card */}
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
                onAdditionalInfoToggle={onAdditionalInfoToggle}
                onTextChange={onTextChange}
                onPaymentStatusChange={onPaymentStatusChange}
                onPartDeliveryChange={onPartDeliveryChange}
                onHighPriorityChange={onHighPriorityChange}
                onStatusSelectChange={onStatusSelectChange}
              />

              {/* Delivery & Vehicle Details Card - CLEAN WHITE REDESIGN */}
              <DeliveryVehicleCard
                isEditMode={isEditMode}
                role={currentUserProfile?.role ?? null}
                isOperationsRole={isOperations(currentUserProfile?.role ?? null)}
                canEditSite={canEditSiteInfo(currentUserProfile)}
                weightScaleType={displayOrder?.details?.weightScaleType}
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
                isSaving={isSaving}
              />

            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-6">
              {/* Product Details Card */}
              <ProductDetailsCard
                isEditMode={isEditMode}
                role={currentUserProfile?.role ?? null}
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
              />

              {!isOperations(currentUserProfile?.role ?? null) && (
                <InvoiceDetailsCard
                  isEditMode={isEditMode}
                  role={currentUserProfile?.role ?? null}
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
                />
              )}
            </div>


          </div>

          {/* FOOTER - Action Buttons */}
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

        {/* Delete Confirmation Dialog */}
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
              <Button
                variant="outline"
                onClick={() => setIsConfirmDeleteDialogOpen(false)}
                disabled={isDeletingOrder}
              >
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

      {/* PDF Field Config Modal — super-admin only */}
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
    </>
  );
};
