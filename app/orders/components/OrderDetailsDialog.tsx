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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Loader2, Edit, User as UserIcon, Phone, MessageCircle, Calendar,
  File, Truck, DollarSign, Package, Eye, Trash2, Upload, X,
  ChevronDown, ChevronUp, History, CheckCircle, XCircle,
  MoreVertical, Wallet, Zap, Save,
  Building, Gauge,
  FileDown, Settings2,
} from 'lucide-react';

import { Order, EditHistoryEntry, DialogMessageType } from '../types';
import { ordersApi } from '@/lib/api/endpoints/ordersApi';
const apiService = ordersApi;
import { renderMarkdownText } from '@/components/markdownRenderer';
import { formatContactNumberForWhatsApp, handleDragOver, handleDragLeave, handleDrop } from '../fileUtils';
import {
  canEditSalesSpecificFields, canEditOperationsSpecificFields,
  canEditAccountantSpecificFields, canEditInvoiceDetailsField,
  canEditInvoiceNumberField, canEditVehicleNoField,
  canMarkAsPaid, canCreatePartDelivery, canCancelOrder,
  isSuperAdmin, isOperations, isAccountant, isSales,
  canEditSiteInfo,
  canExportPdf, canConfigurePdf,
} from '../permissions';
import { PAYMENT_STATUS_COLORS, STATUS_COLORS, canTransitionToGeneral } from '../constants';

import { processFilesToPdf, pdfBytesToFile, formatFileSize } from '@/lib/utils/pdfMergeUtils';
import AudioManager from '@/components/AudioManager';
import { fileApi } from '@/lib/api/endpoints/fileApi';
import { RichTextarea } from '@/components/RichTextarea';
import EditHistory from './EditHistory';

// PDF utilities
import {
  loadSuperAdminPdfConfig,
  getEffectiveFieldVisibility,
  PdfFieldVisibilityMap,
} from '../pdfConfig';
import { openOrderPdfInNewTab } from '../generateOrderPdf';
import { PdfConfigModal } from './PdfConfigModal';
import { UserProfile } from '@/types/rbac.types';


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
      const isDetailsField = currentOrder?.details && id in currentOrder.details;

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


  const handleDeleteUploadedFile = async (fileId: string, stage: 'product' | 'vehicle' | 'invoice') => {
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
  };

  // ============= STATUS HANDLERS =============
  const handleUpdateOrderStatus = async (newStatus: string) => {
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
      await apiService.updateOrderStatus(currentOrder.deoNo, newStatus, historyEntry);
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
  };

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

  if (!order || !currentOrder) return null;
  const isPaymentPending =
    displayOrder?.customerPaymentStatus === "new-unpaid" &&
    displayOrder?.status === "Ready for Dispatch";

  const isButtonDisabled = isSaving || isPaymentPending;




  // Handle upload complete - refetch task data
  const handleUploadComplete = async () => {
    await onOrderUpdated();
  };

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
            <div className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 space-y-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 border-b pb-2">
                Client & Status
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Client */}
                <div className="space-y-1">
                  <Label htmlFor="client" className="font-medium flex items-center gap-1 text-sm">
                    <UserIcon className="w-4 h-4 text-gray-500" /> Client:
                  </Label>
                  {isEditMode && canEditSalesSpecificFields(currentUserProfile?.role ?? null) ? (
                    <Input id="client" value={displayOrder?.client || ''} onChange={handleTextChange} className="w-full h-9" />
                  ) : (
                    <span className="text-gray-800 dark:text-gray-200 block border p-2 rounded-md bg-gray-50 dark:bg-gray-700 text-sm">
                      {displayOrder?.client}
                    </span>
                  )}
                </div>

                {/* Contact */}
                <div className="space-y-1">
                  <Label htmlFor="contactNo" className="font-medium flex items-center gap-1 text-sm">
                    <Phone className="w-4 h-4 text-gray-500" /> Contact:
                  </Label>
                  {isEditMode && canEditSalesSpecificFields(currentUserProfile?.role ?? null) ? (
                    <>
                      <Input
                        id="contactNo"
                        value={displayOrder?.contactNo || ''}
                        onChange={handleTextChange}
                        type="tel"
                        maxLength={10}
                        className="w-full h-9"
                      />
                      {displayOrder?.contactNo && (
                        <div className="flex gap-2 mt-1">
                          <Button variant="outline" size="sm" onClick={() => window.open(`tel:${displayOrder.contactNo}`, '_blank')} className="flex-1 h-8">
                            <Phone className="w-3 h-3 mr-1" /> Call
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => window.open(`https://wa.me/${formatContactNumberForWhatsApp(displayOrder.contactNo)}`, '_blank')} className="flex-1 text-green-600 border-green-300 hover:bg-green-50 h-8">
                            <MessageCircle className="w-3 h-3 mr-1" /> WhatsApp
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="text-gray-800 dark:text-gray-200 block border p-2 rounded-md bg-gray-50 dark:bg-gray-700 text-sm">
                        {displayOrder?.contactNo || 'N/A'}
                      </span>
                      {displayOrder?.contactNo && (
                        <div className="flex gap-2 mt-1">
                          <Button variant="outline" size="sm" onClick={() => window.open(`tel:${displayOrder.contactNo}`, '_blank')} className="flex-1 h-8">
                            <Phone className="w-3 h-3 mr-1" /> Call
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => window.open(`https://wa.me/${formatContactNumberForWhatsApp(displayOrder.contactNo)}`, '_blank')} className="flex-1 text-green-600 border-green-300 hover:bg-green-50 h-8">
                            <MessageCircle className="w-3 h-3 mr-1" /> WhatsApp
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Org Contact */}
                <div className="space-y-1">
                  <Label className="font-medium flex items-center gap-1 text-sm">
                    <UserIcon className="w-4 h-4 text-gray-500" /> Org. Contact:
                  </Label>
                  <span className="text-gray-800 dark:text-gray-200 block border p-2 rounded-md bg-gray-50 dark:bg-gray-700 text-sm">
                    {displayOrder?.organizationContact || 'N/A'}
                  </span>
                </div>

                {/* Part Delivery */}
                <div className="space-y-1">
                  <Label htmlFor="partDelivery" className="font-medium flex items-center gap-1 text-sm">
                    <Package className="w-4 h-4 text-gray-500" /> Part Delivery:
                  </Label>
                  {isEditMode && canEditOperationsSpecificFields(currentUserProfile?.role ?? null) ? (
                    <div className="flex items-center space-x-2 h-[36px]">
                      <Checkbox
                        id="partDelivery"
                        checked={displayOrder?.partDelivery || false}
                        onCheckedChange={handlePartDeliveryChange}
                      />
                      <Label htmlFor="partDelivery" className="font-normal text-sm">Enable Part Delivery</Label>
                    </div>
                  ) : (
                    <span className="text-gray-800 dark:text-gray-200 block border p-2 rounded-md bg-gray-50 dark:bg-gray-700 h-[36px] flex items-center text-sm">
                      {displayOrder?.partDelivery ? 'Yes' : 'No'}
                    </span>
                  )}
                </div>

              </div>

              {/* Collapsible section for non-ops */}
              {isOperations(currentUserProfile?.role ?? null) ? (
                <div className="pt-3 border-t dark:border-gray-700">
                  <div
                    className="flex justify-between items-center cursor-pointer"
                    onClick={() => setAdditionalInfoOpen(!isAdditionalInfoOpen)}
                  >
                    <h4 className="font-semibold text-gray-800 dark:text-white text-sm">Additional Info</h4>
                    {isAdditionalInfoOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                  <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isAdditionalInfoOpen ? 'max-h-screen mt-3' : 'max-h-0'}`}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="font-medium flex items-center gap-1 text-sm">
                          <Calendar className="w-4 h-4 text-gray-500" /> Order Date:
                        </Label>
                        <span className="text-gray-800 dark:text-gray-200 block border p-2 rounded-md bg-gray-50 dark:bg-gray-700 text-sm">
                          {displayOrder?.details?.orderDate || 'N/A'}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="isHighPriority" className="font-medium flex items-center gap-1 text-sm">
                          <Zap className="w-4 h-4 text-gray-500" /> High Priority:
                        </Label>
                        {isEditMode && canEditSalesSpecificFields(currentUserProfile?.role ?? null) ? (
                          <div className="flex items-center space-x-2 h-[36px]">
                            <Switch
                              id="isHighPriority"
                              checked={displayOrder?.isHighPriority || false}
                              onCheckedChange={handleHighPriorityChange}
                            />
                            <Label htmlFor="isHighPriority" className="font-normal text-sm">
                              {displayOrder?.isHighPriority ? 'Enabled' : 'Disabled'}
                            </Label>
                          </div>
                        ) : (
                          <span className={`text-gray-800 dark:text-gray-200 block border p-2 rounded-md bg-gray-50 dark:bg-gray-700 h-[36px] flex items-center text-sm ${displayOrder?.isHighPriority ? 'text-red-500 font-bold' : ''}`}>
                            {displayOrder?.isHighPriority ? 'Yes' : 'No'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t dark:border-gray-700">
                  <div className="space-y-1">
                    <Label className="font-medium flex items-center gap-1 text-sm">
                      <Calendar className="w-4 h-4 text-gray-500" /> Order Date:
                    </Label>
                    <span className="text-gray-800 dark:text-gray-200 block border p-2 rounded-md bg-gray-50 dark:bg-gray-700 text-sm">
                      {displayOrder?.details?.orderDate || 'N/A'}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="isHighPriority" className="font-medium flex items-center gap-1 text-sm">
                      <Zap className="w-4 h-4 text-gray-500" /> High Priority:
                    </Label>
                    {isEditMode && canEditSalesSpecificFields(currentUserProfile?.role ?? null) ? (
                      <div className="flex items-center space-x-2 h-[36px]">
                        <Switch
                          id="isHighPriority"
                          checked={displayOrder?.isHighPriority || false}
                          onCheckedChange={handleHighPriorityChange}
                        />
                        <Label htmlFor="isHighPriority" className="font-normal text-sm">
                          {displayOrder?.isHighPriority ? 'Enabled' : 'Disabled'}
                        </Label>
                      </div>
                    ) : (
                      <span className={`text-gray-800 dark:text-gray-200 block border p-2 rounded-md bg-gray-50 dark:bg-gray-700 h-[36px] flex items-center text-sm ${displayOrder?.isHighPriority ? 'text-red-500 font-bold' : ''}`}>
                        {displayOrder?.isHighPriority ? 'Yes' : 'No'}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Payment Status & Order Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t dark:border-gray-700">
                <div className="space-y-1">
                  <Label htmlFor="customerPaymentStatus" className="font-medium flex items-center gap-1 text-sm">
                    <DollarSign className="w-4 h-4 text-gray-500" /> Payment:
                  </Label>
                  {isEditMode && canEditSalesSpecificFields(currentUserProfile?.role ?? null) ? (
                    <Select onValueChange={handlePaymentStatusChange} value={displayOrder?.customerPaymentStatus || ''}>
                      <SelectTrigger id="customerPaymentStatus" className="w-full h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[9050]">
                        <SelectItem value="regular">Regular</SelectItem>
                        <SelectItem value="new-paid">New Customer - Paid</SelectItem>
                        <SelectItem value="new-unpaid">New Customer - Unpaid</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge
                      className={`${PAYMENT_STATUS_COLORS[displayOrder?.customerPaymentStatus ?? '']} font-medium p-2 text-xs`}
                    >
                      {displayOrder?.customerPaymentStatus === 'new-paid'
                        ? 'New - Paid'
                        : displayOrder?.customerPaymentStatus === 'new-unpaid'
                          ? 'New - Unpaid'
                          : 'Regular'}
                    </Badge>

                  )}
                </div>

                <div className="space-y-1">
                  <Label className="font-medium flex items-center gap-1 text-sm">
                    <History className="w-4 h-4 text-gray-500" /> Status:
                  </Label>
                  {isEditMode && isSuperAdmin(currentUserProfile?.role ?? null) ? (
                    <Select
                      onValueChange={(value) => setPendingChanges(prev => ({
                        ...prev,
                        textFields: { ...prev.textFields, status: value as any },
                        hasChanges: true,
                      }))}
                      value={displayOrder?.status || ''}
                    >
                      <SelectTrigger className="w-full h-9">
                        <SelectValue placeholder="Select Status" />
                      </SelectTrigger>
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
                    <Badge className={`${STATUS_COLORS[displayOrder?.status || 'Order Created']} text-white font-semibold px-2 py-1 rounded-full text-xs`}>
                      {displayOrder?.status}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Delivery & Vehicle Details Card - CLEAN WHITE REDESIGN */}
            <div className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 space-y-3">

              {/* Card Header */}
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-3 border-b-2 border-blue-500/50 pb-2">
                <Truck className="w-7 h-7 text-blue-600 dark:text-blue-500" />
                Delivery & Vehicle Operations
              </h3>

              {/* Highlighted Key Operational Fields: Weight Scale & Transport Provider */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Weight Scale - Premium Sub-card */}
                <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-lg shadow-lg border border-l-[10px] border-blue-600 dark:border-blue-500 flex flex-col justify-between">
                  <div className="flex items-center gap-2 mb-2">
                    <Gauge className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <Label htmlFor="weightScaleType" className="font-semibold text-gray-800 dark:text-gray-100 text-sm">Weight Scale</Label>
                  </div>
                  {isEditMode && canEditOperationsSpecificFields(currentUserProfile?.role ?? null) ? (
                    <Select
                      onValueChange={(value) => setPendingChanges(prev => ({
                        ...prev,
                        textFields: {
                          ...prev.textFields,
                          details: { ...prev.textFields.details, weightScaleType: value as any }
                        },
                        hasChanges: true,
                      }))}
                      value={displayOrder?.details?.weightScaleType || ''}
                    >
                      <SelectTrigger className="w-full h-9 bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm">
                        <SelectValue placeholder="Select Type" />
                      </SelectTrigger>
                      <SelectContent className="z-[9050]">
                        <SelectItem value="outside">Outside</SelectItem>
                        <SelectItem value="inside">Inside</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="text-lg font-bold text-rose-800 dark:text-rose-200">
                      {displayOrder?.details?.weightScaleType ? displayOrder.details.weightScaleType.charAt(0).toUpperCase() + displayOrder.details.weightScaleType.slice(1) : 'N/A'}
                    </div>
                  )}
                </div>

                {/* Transport Provider - Premium Sub-card */}
                <div className="bg-teal-100 dark:bg-teal-900/30 p-4 rounded-lg shadow-lg border border-l-[10px] border-teal-600 dark:border-teal-500 flex flex-col justify-between">
                  <div className="flex items-center gap-2 mb-2">
                    <Building className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                    <Label htmlFor="transportProvider" className="font-semibold text-gray-800 dark:text-gray-100 text-sm">Transport Provider</Label>
                  </div>
                  {isEditMode && canEditOperationsSpecificFields(currentUserProfile?.role ?? null) ? (
                    <>
                      <Select
                        onValueChange={(value) => setPendingChanges(prev => ({
                          ...prev,
                          textFields: {
                            ...prev.textFields,
                            details: { ...prev.textFields.details, transportProvider: value as any }
                          },
                          hasChanges: true,
                        }))}
                        value={displayOrder?.details?.transportProvider || ''}
                      >
                        <SelectTrigger className="w-full h-9 bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm">
                          <SelectValue placeholder="Select Provider" />
                        </SelectTrigger>
                        <SelectContent className="z-[9050]">
                          <SelectItem value="client">Client Transport</SelectItem>
                          <SelectItem value="own">Own Transport</SelectItem>
                          <SelectItem value="poter">Poter</SelectItem>
                        </SelectContent>
                      </Select>
                      {displayOrder?.details?.transportProvider === 'own' && (
                        <div className="space-y-1 mt-2">
                          <Label htmlFor="transportProviderName" className="font-medium text-xs text-gray-700 dark:text-gray-300">Provider Name:</Label>
                          <Input
                            id="transportProviderName"
                            value={displayOrder?.details?.transportProviderName || ''}
                            onChange={handleTextChange}
                            placeholder="Enter provider name"
                            className="bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 h-8 text-sm"
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="text-base font-medium text-gray-900 dark:text-white">
                        {displayOrder?.details?.transportProvider ? (displayOrder.details.transportProvider === 'client' ? 'Client Transport' : 'Own Transport') : 'N/A'}
                      </div>
                      {displayOrder?.details?.transportProvider === 'own' && displayOrder?.details?.transportProviderName && (
                        <div className="space-y-0.5 mt-1">
                          <Label className="font-medium text-xs text-gray-500 dark:text-gray-400">Provider Name:</Label>
                          <p className="text-base font-bold text-fuchsia-800 dark:text-fuchsia-200">
                            {displayOrder.details.transportProviderName}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Secondary Details Section (Vehicle No & Site Info) */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">

                {/* Vehicle No */}
                <div className="space-y-1">
                  <Label htmlFor="vehicleNo" className="font-semibold text-gray-800 dark:text-gray-200 text-sm">Vehicle No.</Label>
                  {isEditMode && canEditVehicleNoField(currentUserProfile?.role ?? null) ? (
                    <Input
                      id="vehicleNo"
                      value={displayOrder?.details?.vehicleNo || ''}
                      onChange={handleTextChange}
                      className="w-full h-9 bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm"
                    />
                  ) : (
                    <p className="text-base text-gray-900 dark:text-white font-medium">{displayOrder?.details?.vehicleNo || 'N/A'}</p>
                  )}
                </div>

                {/* Site Delivery Info (moved to the end of primary fields) */}
                {!isOperations(currentUserProfile?.role ?? null) && (
                  <div className="space-y-1">
                    <Label htmlFor="siteDeliveryInfo" className="font-semibold text-gray-800 dark:text-gray-200 text-sm">Site Info</Label>
                    {isEditMode && (canEditOperationsSpecificFields(currentUserProfile?.role ?? null) || canEditSiteInfo(currentUserProfile)) ? (
                      <RichTextarea
                        id="siteDeliveryInfo"
                        value={displayOrder?.details?.siteDeliveryInfo || ''}
                        onChange={handleTextChange}
                        rows={2}
                        className="w-full bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm"
                        placeholder="Site-specific delivery instructions or information..."
                      />
                    ) : (
                      <div
                        className="prose prose-xs dark:prose-invert max-w-none text-gray-800 dark:text-gray-200 pt-1"
                      >
                        {displayOrder?.details?.siteDeliveryInfo ? (
                          <div dangerouslySetInnerHTML={{ __html: renderMarkdownText(displayOrder.details.siteDeliveryInfo) }} />
                        ) : (
                          <p className="italic text-gray-500">N/A</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Vehicle Files Section */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <div
                  className="flex justify-between items-center cursor-pointer"
                  onClick={() => setVehicleSectionOpen(!vehicleSectionOpen)}
                >
                  <h4 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2 text-sm">
                    <Upload className="w-5 h-5 text-gray-500 dark:text-gray-400" /> Delivery Attachments
                    {pendingChanges.vehicleFiles.length > 0 && (
                      <Badge className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
                        {pendingChanges.vehicleFiles.length} pending
                      </Badge>

                    )}
                    {pendingChanges.productFiles.length > 0 && (
                      <Badge className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
                        {pendingChanges.productFiles.length} file{pendingChanges.productFiles.length > 1 ? 's' : ''}
                        {mergePreviews.product && ` → 1 PDF (${formatFileSize(mergePreviews.product.totalSize)})`}
                      </Badge>
                    )}
                  </h4>
                  {vehicleSectionOpen ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
                </div>

                <div className={`pt-3 space-y-4 transition-all duration-300 ease-in-out ${vehicleSectionOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                  {isEditMode && canEditOperationsSpecificFields(currentUserProfile?.role ?? null) && (
                    <>
                      <div
                        className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center text-gray-500 dark:text-gray-400 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-gray-800 transition-colors cursor-pointer group"
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, (files) => handleFileAdd(files, 'vehicle'))}
                      >
                        <Input
                          id="vehicle-files"
                          type="file"
                          multiple
                          accept=".jpg,.jpeg,.png,.pdf,.webp"
                          onChange={(e) => handleFileAdd(Array.from(e.target.files || []), 'vehicle')}
                          className="hidden"
                        />
                        <Label htmlFor="vehicle-files" className="cursor-pointer flex flex-col items-center">
                          <Upload className="w-8 h-8 mb-2 text-gray-400 group-hover:text-blue-600 transition-colors" />
                          <span className="text-base font-medium">Drag & drop files here</span>
                          <span className="text-xs">or <span className="text-blue-600 dark:text-blue-400 font-semibold">browse your computer</span></span>
                        </Label>
                      </div>

                      {pendingChanges.vehicleFiles.length > 0 && (
                        <div className="space-y-2 border p-3 rounded-lg bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
                          <h5 className="font-semibold text-gray-800 dark:text-gray-200 text-base">Files Ready to Upload:</h5>
                          <ul className="space-y-1">
                            {pendingChanges.vehicleFiles.map((file, index) => (
                              <li key={index} className="flex items-center justify-between bg-white dark:bg-gray-800 p-2 rounded-md shadow-sm">
                                <span className="text-xs text-gray-700 dark:text-gray-300 truncate font-medium">{file.name}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleFileRemove(index, 'vehicle')}
                                  className="text-red-500 hover:bg-red-100 dark:hover:bg-red-900 rounded-full w-6 h-6"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </li>
                            ))}
                          </ul>
                          <p className="text-xs text-orange-700 dark:text-orange-400 mt-2">These files will be uploaded when you click &quotSave All&quot.</p>
                        </div>
                      )}
                    </>
                  )}

                  {/* Uploaded Files */}
                  {displayOrder?.details?.vehicleDriveIds && displayOrder.details.vehicleDriveIds.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      <h5 className="font-semibold text-gray-800 dark:text-gray-200 text-base">Previously Uploaded Files:</h5>
                      <div className="space-y-2">
                        {displayOrder.details.vehicleDriveIds.map((file) => (
                          <div key={file.fileId} className="flex items-center justify-between bg-white dark:bg-gray-800 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                            <span className="text-xs font-medium text-blue-700 dark:text-blue-400 truncate">{file.filename}</span>
                            <div className="flex items-center gap-1">
                              <a
                                href={`https://drive.google.com/file/d/${file.fileId}/preview`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 w-8 h-8 flex items-center justify-center rounded-full hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors"
                                title="View File"
                              >
                                <Eye className="w-4 h-4" />
                              </a>
                              {isEditMode && canEditOperationsSpecificFields(currentUserProfile?.role ?? null) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteUploadedFile(file.fileId, 'vehicle')}
                                  className="text-red-500 hover:bg-red-100 dark:hover:bg-red-900 rounded-full w-8 h-8"
                                  title="Delete File"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 p-3 text-center border rounded-lg bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                      No delivery attachments have been uploaded yet.
                    </p>
                  )}
                </div>
              </div>
            </div>




          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-6">
            {/* Product Details Card */}
            <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 space-y-4">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 border-b pb-2">
                Product Details
              </h3>

              <div className="space-y-2">
                <Label htmlFor="products" className="font-medium">Description:</Label>
                {isEditMode && canEditSalesSpecificFields(currentUserProfile?.role ?? null) ? (
                  <RichTextarea
                    id="products"
                    value={displayOrder?.products || ''}
                    onChange={handleTextChange}
                    rows={4}
                    className="w-full"
                    placeholder="Enter product details..."
                  />
                ) : (
                  <div
                    className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap p-2 border rounded-md min-h-[120px]"
                    dangerouslySetInnerHTML={{ __html: renderMarkdownText(displayOrder?.products || 'N/A') }}
                  />
                )}
              </div>

              {/* Audio Manager Component */}
              <AudioManager
                currentUser={currentUserProfile}
                identifier={currentOrder.deoNo}
                identifierType="order"
                uploadStage="productVoiceNote"
                initialFiles={displayOrder?.details?.productVoiceNoteDriveIds || []}
                onUploadComplete={handleUploadComplete}
                editMode={isEditMode}
                maxFiles={10}
                acceptedFormats={['audio/webm', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a']}
                // NEW: Staging mode props
                stagingMode={isEditMode}
                pendingFiles={pendingChanges.productAudioFiles}
                onFilesStaged={(files) => handleAudioFileAdd(files, 'product')}
                onFileRemoved={(index) => handleAudioFileRemove(index, 'product')}
              />

              {/* Product Files Section */}
              <div
                className="flex justify-between items-center cursor-pointer mb-2 border-t pt-4"
                onClick={() => setProductSectionOpen(!productSectionOpen)}
              >
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <File className="w-5 h-5" /> Product Files
                  {pendingChanges.productFiles.length > 0 && (
                    <Badge className="bg-orange-500 text-white text-xs">{pendingChanges.productFiles.length} pending</Badge>
                  )}
                </h4>
                {productSectionOpen ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
              </div>
              <div className={`space-y-4 transition-all duration-300 ${productSectionOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                {isEditMode && canEditSalesSpecificFields(currentUserProfile?.role ?? null) && (
                  <>
                    <div
                      className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center text-gray-500 dark:text-gray-400 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, (files) => handleFileAdd(files, 'product'))}
                    >
                      <Input
                        id="product-files"
                        type="file"
                        multiple
                        accept=".jpg,.jpeg,.png,.pdf,.webp,.ogg"
                        onChange={(e) => handleFileAdd(Array.from(e.target.files || []), 'product')}
                        className="hidden"
                      />
                      <Label htmlFor="product-files" className="cursor-pointer flex flex-col items-center">
                        <Upload className="w-8 h-8 mb-2" />
                        Drag & drop or <span className="text-blue-600">browse</span>
                      </Label>
                    </div>

                    <div className={`space-y-2`}>


                    </div>


                    {pendingChanges.productFiles.length > 0 && (
                      <div className="space-y-2 border p-3 rounded-md bg-orange-50 dark:bg-orange-950">
                        <h5 className="font-semibold text-gray-800 dark:text-gray-200">Ready to Upload:</h5>
                        <ul className="space-y-2">
                          {pendingChanges.productFiles.map((file, index) => (
                            <li key={index} className="flex items-center justify-between bg-white dark:bg-gray-700 p-2 rounded-md">
                              <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{file.name}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleFileRemove(index, 'product')}
                                className="text-red-500 h-8 w-8 p-0"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </li>
                          ))}
                        </ul>
                        <p className="text-sm text-orange-600 dark:text-orange-400">Click &quot Save All &quot to upload these files</p>
                      </div>
                    )}
                  </>
                )}

                {/* Uploaded Files */}
                {displayOrder?.details?.productDriveIds && displayOrder.details.productDriveIds.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    <h5 className="font-semibold text-gray-800 dark:text-gray-200">Uploaded Files:</h5>
                    <div className="grid grid-cols-1 gap-3">
                      {displayOrder.details.productDriveIds.map((file) => (
                        <div key={file.fileId} className="flex items-center justify-between bg-green-50 dark:bg-green-950 p-2 rounded-md">
                          <span className="text-sm font-medium text-green-800 dark:text-green-200 truncate">{file.filename}</span>
                          <div className="flex items-center gap-2">
                            <a
                              href={`https://drive.google.com/file/d/${file.fileId}/preview`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 h-8 w-8 p-0 flex items-center justify-center"
                            >
                              <Eye className="w-5 h-5" />
                            </a>
                            {isEditMode && canEditSalesSpecificFields(currentUserProfile?.role ?? null) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteUploadedFile(file.fileId, 'product')}
                                className="text-red-500 h-8 w-8 p-0"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">No product files uploaded.</p>
                )}
              </div>
            </div>

            {/* Invoice Details Card */}
            {!isOperations(currentUserProfile?.role ?? null) && (
              <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 space-y-4">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 border-b pb-2">
                  Invoice Details
                </h3>

                <div className="space-y-2">
                  <Label htmlFor="invoiceDetails" className="font-medium">Invoice Notes:</Label>
                  {isEditMode && canEditInvoiceDetailsField(currentUserProfile?.role ?? null, displayOrder?.status) ? (
                    <RichTextarea
                      id="invoiceDetails"
                      value={displayOrder?.details?.invoiceDetails || ''}
                      onChange={handleTextChange}
                      rows={3}
                      className="w-full"
                      placeholder="Enter invoice notes..."
                      enableAutocomplete={true}
                    />
                  ) : (
                    <div
                      className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap p-2 border rounded-md min-h-[60px]"
                      dangerouslySetInnerHTML={{ __html: renderMarkdownText(displayOrder?.details?.invoiceDetails || 'N/A') }}
                    />
                  )}
                </div>

                <div className="space-y-2 pt-4 border-t dark:border-gray-700">
                  <Label htmlFor="invoiceNo" className="font-medium">Invoice No.:</Label>
                  {isEditMode && canEditInvoiceNumberField(currentUserProfile?.role ?? null, displayOrder?.status) ? (
                    <Input
                      id="invoiceNo"
                      value={displayOrder?.details?.invoiceNo || ''}
                      onChange={handleTextChange}
                      className="w-full h-9"
                    />
                  ) : (
                    <span className="text-sm text-gray-800 dark:text-gray-200 p-2 border rounded-md block h-9 flex items-center">
                      {displayOrder?.details?.invoiceNo || 'N/A'}
                    </span>
                  )}
                </div>

                {/* Invoice Files Section */}
                <AudioManager
                  currentUser={currentUserProfile}
                  identifier={currentOrder.deoNo}
                  identifierType="order"
                  uploadStage="invoiceVoiceNote"
                  initialFiles={displayOrder?.details?.invoiceVoiceNoteDriveIds || []}
                  onUploadComplete={handleUploadComplete}
                  editMode={isEditMode}
                  maxFiles={10}
                  acceptedFormats={['audio/webm', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a']}
                  // NEW: Staging mode props
                  stagingMode={isEditMode}
                  pendingFiles={pendingChanges.invoiceAudioFiles}
                  onFilesStaged={(files) => handleAudioFileAdd(files, 'invoice')}
                  onFileRemoved={(index) => handleAudioFileRemove(index, 'invoice')}
                />

                <div
                  className="flex justify-between items-center cursor-pointer mb-2 border-t pt-4"
                  onClick={() => setInvoiceSectionOpen(!invoiceSectionOpen)}
                >
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <DollarSign className="w-5 h-5" /> Invoice Files
                    {pendingChanges.invoiceFiles.length > 0 && (
                      <Badge className="bg-orange-500 text-white text-xs">{pendingChanges.invoiceFiles.length} pending</Badge>
                    )}
                  </h4>
                  {invoiceSectionOpen ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
                </div>
                <div className={`space-y-4 transition-all duration-300 ${invoiceSectionOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                  {isEditMode && canEditAccountantSpecificFields(currentUserProfile?.role ?? null, displayOrder?.status) && (
                    <>
                      <div
                        className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center text-gray-500 dark:text-gray-400 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, (files) => handleFileAdd(files, 'invoice'))}
                      >
                        <Input
                          id="invoice-files"
                          type="file"
                          multiple
                          accept=".jpg,.jpeg,.png,.pdf,.webp"
                          onChange={(e) => handleFileAdd(Array.from(e.target.files || []), 'invoice')}
                          className="hidden"
                        />
                        <Label htmlFor="invoice-files" className="cursor-pointer flex flex-col items-center">
                          <Upload className="w-8 h-8 mb-2" />
                          Drag & drop or <span className="text-blue-600">browse</span>
                        </Label>
                      </div>

                      {pendingChanges.invoiceFiles.length > 0 && (
                        <div className="space-y-2 border p-3 rounded-md bg-orange-50 dark:bg-orange-950">
                          <h5 className="font-semibold text-gray-800 dark:text-gray-200">Ready to Upload:</h5>
                          <ul className="space-y-2">
                            {pendingChanges.invoiceFiles.map((file, index) => (
                              <li key={index} className="flex items-center justify-between bg-white dark:bg-gray-700 p-2 rounded-md">
                                <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{file.name}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleFileRemove(index, 'invoice')}
                                  className="text-red-500 h-8 w-8 p-0"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </li>
                            ))}
                          </ul>
                          <p className="text-sm text-orange-600 dark:text-orange-400">Click &quotSave All&quot to upload these files</p>
                        </div>
                      )}
                    </>
                  )}

                  {/* Uploaded Files */}
                  {displayOrder?.details?.invoiceDriveId && displayOrder.details.invoiceDriveId.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      <h5 className="font-semibold text-gray-800 dark:text-gray-200">Uploaded Files:</h5>
                      <div className="grid grid-cols-1 gap-3">
                        {displayOrder.details.invoiceDriveId.map((file) => (
                          <div key={file.fileId} className="flex items-center justify-between bg-green-50 dark:bg-green-950 p-2 rounded-md">
                            <span className="text-sm font-medium text-green-800 dark:text-green-200 truncate">{file.filename}</span>
                            <div className="flex items-center gap-2">
                              <a
                                href={`https://drive.google.com/file/d/${file.fileId}/preview`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 h-8 w-8 p-0 flex items-center justify-center"
                              >
                                <Eye className="w-5 h-5" />
                              </a>
                              {isEditMode && canEditAccountantSpecificFields(currentUserProfile?.role ?? null, displayOrder?.status) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteUploadedFile(file.fileId, 'invoice')}
                                  className="text-red-500 h-8 w-8 p-0"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">No invoice files uploaded.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* FOOTER - Action Buttons */}
        <DialogFooter className="mt-6 flex flex-wrap justify-start gap-3 border-t border-gray-200 dark:border-gray-700 pt-4">
          {isEditMode ? (
            <>
              <Button variant="outline" onClick={handleCancelEdit} disabled={isSaving}>
                Cancel
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={handleSaveAllChanges}
                disabled={isSaving || !pendingChanges.hasChanges}
              >
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Save className="w-4 h-4 mr-2" />
                Save All Changes
              </Button>
              {pendingChanges.hasChanges && (
                <span className="text-sm text-orange-600 dark:text-orange-400 flex items-center">
                  {Object.keys(pendingChanges.textFields).length > 0 && `${Object.keys(pendingChanges.textFields).length} field(s)`}
                  {Object.keys(pendingChanges.textFields).length > 0 && (pendingChanges.productFiles.length + pendingChanges.vehicleFiles.length + pendingChanges.invoiceFiles.length) > 0 && ', '}
                  {(pendingChanges.productFiles.length + pendingChanges.vehicleFiles.length + pendingChanges.invoiceFiles.length) > 0 &&
                    `${pendingChanges.productFiles.length + pendingChanges.vehicleFiles.length + pendingChanges.invoiceFiles.length} file(s)`}
                  {' '}pending
                </span>
              )}
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setIsEditMode(true)} className="flex-1 sm:flex-none">
                <Edit className="w-4 h-4 mr-2" /> Edit Order
              </Button>

              {/* Status Transition Buttons */}
              {canTransitionToGeneral(displayOrder?.status || '', 'Approved for Production') &&
                isSuperAdmin(currentUserProfile?.role ?? null) && (
                  <Button
                    onClick={() => handleUpdateOrderStatus('Approved for Production')}
                    className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={isSaving}
                  >
                    {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Approve Order
                  </Button>
                )}

              {canTransitionToGeneral(displayOrder?.status || '', 'Ready for Dispatch') &&
                canEditOperationsSpecificFields(currentUserProfile?.role ?? null) && (
                  <Button
                    onClick={() => handleUpdateOrderStatus('Ready for Dispatch')}
                    className="flex-1 sm:flex-none bg-purple-500 hover:bg-purple-600 text-white"
                    disabled={isSaving}
                  >
                    {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Ready for Dispatch
                  </Button>
                )}

              {displayOrder?.partDelivery &&
                (displayOrder?.status === 'Ready for Dispatch' || displayOrder?.status === 'Approved for Production') &&
                canCreatePartDelivery(currentUserProfile?.role ?? null) && (
                  <Button
                    onClick={handleCreatePartDeliveryOrder}
                    className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 text-white"
                    disabled={isCreatingPartDelivery}
                  >
                    {isCreatingPartDelivery && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Create Part Delivery
                  </Button>
                )}
              {canTransitionToGeneral(displayOrder?.status || "", "Dispatched and Invoiced") &&
                canEditOperationsSpecificFields(currentUserProfile?.role ?? null) && (
                  <div className="relative flex flex-col gap-2">

                    {/* Floating message that does NOT change layout */}
                    {isPaymentPending && (
                      <div className="absolute -top-20 left-0 w-full flex justify-start pointer-events-none">
                        <p
                          className="text-sm font-medium p-2 rounded border
                   bg-red-50 text-red-700 border-red-300 
                   dark:bg-red-950 dark:text-red-300 dark:border-red-700
                   shadow-md"
                        >
                          ⚠️ Action Blocked: Confirm Payment Info.
                        </p>
                      </div>
                    )}

                    {/* Button */}
                    <Button
                      onClick={() => handleUpdateOrderStatus("Dispatched and Invoiced")}
                      className="flex-1 sm:flex-none bg-yellow-500 hover:bg-yellow-600 text-white disabled:opacity-50"
                      disabled={isButtonDisabled}
                    >
                      {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      <Truck className="w-4 h-4 mr-2" /> Dispatched & Invoiced
                    </Button>
                  </div>

                )
              }


              {canTransitionToGeneral(displayOrder?.status || '', 'Completed') &&
                canEditAccountantSpecificFields(currentUserProfile?.role ?? null, displayOrder?.status) && (
                  <Button
                    onClick={() => handleUpdateOrderStatus('Completed')}
                    className="flex-1 sm:flex-none bg-green-700 hover:bg-green-800 text-white"
                    disabled={isSaving}
                  >
                    {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <CheckCircle className="w-4 h-4 mr-2" /> Complete Order
                  </Button>
                )}

              {/* More Actions Dialog */}
              {(isSuperAdmin(currentUserProfile?.role ?? null) ||
                isSales(currentUserProfile?.role ?? null) ||
                isAccountant(currentUserProfile?.role ?? null)) && (
                  <Dialog open={isMoreActionsOpen} onOpenChange={setIsMoreActionsOpen}>
                    <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => setIsMoreActionsOpen(true)}>
                      <MoreVertical className="w-4 h-4 mr-2" /> More Actions
                    </Button>
                    <DialogContent className="sm:max-w-[350px] md:max-w-[550px] p-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg z-[9001]">
                      <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white">Order Actions</DialogTitle>
                        <DialogDescription className="text-gray-600 dark:text-gray-400">Select an action</DialogDescription>
                      </DialogHeader>
                      <div className="flex flex-col gap-3 mt-4">
                        {displayOrder?.customerPaymentStatus === 'new-unpaid' && canMarkAsPaid(currentUserProfile?.role ?? null) && (
                          <Button
                            onClick={handleMarkAsPaid}
                            className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                            disabled={isMarkingPaid}
                          >
                            {isMarkingPaid && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            <Wallet className="w-4 h-4 mr-2" /> Mark as Paid
                          </Button>
                        )}

                        {isSuperAdmin(currentUserProfile?.role ?? null) && (
                          <Button
                            variant="destructive"
                            onClick={() => {
                              setIsMoreActionsOpen(false);
                              setIsConfirmDeleteDialogOpen(true);
                            }}
                            className="w-full"
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Delete Order
                          </Button>
                        )}

                        {canTransitionToGeneral(displayOrder?.status || '', 'Cancelled') &&
                          canCancelOrder(currentUserProfile?.role ?? null) && (
                            <Button
                              variant="destructive"
                              onClick={() => handleUpdateOrderStatus('Cancelled')}
                              className="w-full"
                              disabled={isSaving}
                            >
                              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                              <XCircle className="w-4 h-4 mr-2" /> Cancel Order
                            </Button>
                          )}
                          
                          {/* Edit History */}
                          <EditHistory
                            orderId={currentOrder.deoNo ?? ""}
                            currentUserProfile={currentUserProfile}
                          />
                     
                      </div>
                      <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => setIsMoreActionsOpen(false)} disabled={isMarkingPaid}>
                          Close
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
            </>
          )}
        </DialogFooter>
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
            openOrderPdfInNewTab(displayOrder, config,currentUserProfile.name);
          }
        }}
      />
    )}
    </>
  );
};
