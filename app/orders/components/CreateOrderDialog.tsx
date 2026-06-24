// components/CreateOrderDialog.tsx - Enhanced with Audio Support

import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Loader2,
  Plus,
  Upload,
  X,
  Package,
  Zap,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Check,
  MapPin,
  UploadCloud,
  Edit2,
  UserPlus,
  Fingerprint,
  Users,
  Phone,
} from 'lucide-react';
import { CustomerPaymentStatus, DeoNumbersByPrefix, DialogMessageType, Order, WeightScaleType } from '../types';
import { ordersApi } from '@/lib/api/endpoints/ordersApi';
const apiService = ordersApi;
import { customersApi, CustomerSummary } from '@/lib/api/endpoints/customers';
import { UserProfile } from '@/types/rbac.types';
import { handleDrop } from '../fileUtils';
import { validateOrderData } from '../orderUtils';
import AudioManager from '@/components/AudioManager';
import { processFilesToPdf, pdfBytesToFile } from '@/lib/utils/pdfMergeUtils';
import { fileApi } from '@/lib/api/endpoints/fileApi';
import { RichTextarea } from '@/components/RichTextarea';
// ─── Updated import: also brings in DialogMode type ──────────────────────────
import { CustomerDialog, DialogMode } from '../../customers/components/CustomerDialog';

interface CreateOrderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserProfile: UserProfile | null;
  nextDeoNumbers: DeoNumbersByPrefix;
  fetchDeoNumbers: () => Promise<void>;
  onOrderCreated: () => void;
  onShowMessage: (message: DialogMessageType) => void;
}

export const CreateOrderDialog: React.FC<CreateOrderDialogProps> = ({
  isOpen,
  onClose,
  currentUserProfile,
  nextDeoNumbers,
  fetchDeoNumbers,
  onOrderCreated,
  onShowMessage,
}) => {
  const initialOrderData: Partial<Order> = {
    deoNo: '',
    client: '',
    contactNo: '',
    organizationContact: '',
    customerPaymentStatus: 'regular',
    products: '',
    isHighPriority: false,
    partDelivery: false,
    details: {
      orderDate: '',
      invoiceDetails: '',
      siteDeliveryInfo: '',
      weightScaleType: 'outside',
      transportProvider: 'client',
      transportProviderName: '',
      productDriveIds: [],
      vehicleDriveIds: [],
      invoiceDriveId: [],
      productVoiceNoteDriveIds: [],
      invoiceVoiceNoteDriveIds: [],
      vehicleNo: '',
      invoiceNo: '',
    },
  };

  const [fetchingDeoNumbers, setFetchingDeoNumbers] = useState(false);
  const [isAddingOrder, setIsAddingOrder] = useState(false);
  const [productFiles, setProductFiles] = useState<File[]>([]);
  const [productAudioFiles, setProductAudioFiles] = useState<File[]>([]);
  const [invoiceAudioFiles, setInvoiceAudioFiles] = useState<File[]>([]);
  const [isDeliveryInfoExpanded, setIsDeliveryInfoExpanded] = useState(false);
  const [createdOrderDeoNo, setCreatedOrderDeoNo] = useState<string | null>(null);
  const [isRetryingFileUpload, setIsRetryingFileUpload] = useState(false);
  const [orderData, setOrderData] = useState<Partial<Order>>(initialOrderData);
  const [allClients, setAllClients] = useState<CustomerSummary[]>([]);
  const [isFetchingClients, setIsFetchingClients] = useState(false);

  // ─── CustomerDialog state: now tracks mode alongside open/customer ─────────
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<CustomerSummary | null>(null);
  const [customerDialogMode, setCustomerDialogMode] = useState<DialogMode>('create');

  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [isClientSearchOpen, setIsClientSearchOpen] = useState(false);
  const [isPhoneDropdownOpen, setIsPhoneDropdownOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<CustomerSummary | null>(null);
  const [includeBillingInInvoice, setIncludeBillingInInvoice] = useState(true);
  const [injectedClientText, setInjectedClientText] = useState('');
  const [injectedGstText, setInjectedGstText] = useState('');
  const [injectedBillingText, setInjectedBillingText] = useState('');
  const [injectedShippingText, setInjectedShippingText] = useState('');
  const [selectedShippingAddress, setSelectedShippingAddress] = useState<string>('Ask for client');
  const [uploadProgress, setUploadProgress] = useState<{
    total: number;
    completed: number;
    current: string;
  }>({ total: 0, completed: 0, current: '' });

  // ─── Fetch clients ────────────────────────────────────────────────────────

  const fetchClients = useCallback(async () => {
    try {
      setIsFetchingClients(true);
      const clients = await customersApi.fetchCustomers();
      setAllClients(clients);
    } catch (error: unknown) {
      console.error('Failed to fetch clients', error);
    } finally {
      setIsFetchingClients(false);
    }
  }, []);

  React.useEffect(() => {
    if (isOpen && currentUserProfile) {
      fetchClients();
    }
    // fetchClients is stable via useCallback; currentUserProfile.accessToken drives re-fetches
  }, [isOpen, currentUserProfile, fetchClients]);

  const filteredClients = allClients.filter((c) => {
    if (!clientSearchTerm) return true;
    const term = clientSearchTerm.toLowerCase();
    return (
      c.name.toLowerCase().includes(term) ||
      c.gst?.toLowerCase().includes(term) ||
      c.pan?.toLowerCase().includes(term) ||
      c.phones?.some((p) => p.includes(term))
    );
  });

  // ─── Address injection helpers ────────────────────────────────────────────

  const clearInjectedAddresses = () => {
    setOrderData((prev) => {
      let currentDetails = prev.details?.invoiceDetails || '';
      if (injectedClientText)
        currentDetails = currentDetails
          .replace('\n\n' + injectedClientText, '')
          .replace(injectedClientText + '\n\n', '')
          .replace(injectedClientText, '');
      if (injectedGstText)
        currentDetails = currentDetails
          .replace('\n\n' + injectedGstText, '')
          .replace(injectedGstText + '\n\n', '')
          .replace(injectedGstText, '');
      if (injectedBillingText)
        currentDetails = currentDetails
          .replace('\n\n' + injectedBillingText, '')
          .replace(injectedBillingText + '\n\n', '')
          .replace(injectedBillingText, '');
      if (injectedShippingText)
        currentDetails = currentDetails
          .replace('\n\n' + injectedShippingText, '')
          .replace(injectedShippingText + '\n\n', '')
          .replace(injectedShippingText, '');
      return { ...prev, details: { ...prev.details!, invoiceDetails: currentDetails } };
    });
    setInjectedClientText('');
    setInjectedGstText('');
    setInjectedBillingText('');
    setInjectedShippingText('');
    setIncludeBillingInInvoice(false);
  };

  const handleClientSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setClientSearchTerm(val);
    setOrderData((prev) => ({ ...prev, client: val }));
    if (selectedClient && selectedClient.name !== val) {
      setSelectedClient(null);
      setSelectedShippingAddress('Ask for client');
      clearInjectedAddresses();
    }
    setIsClientSearchOpen(true);
  };

  const handleSelectClient = async (client: CustomerSummary) => {
    setSelectedClient(client);
    setClientSearchTerm(client.name);
    setSelectedShippingAddress('Ask for client');

    const clientText = `*Client*: ${client.name}`;
    const gstText = client.gst ? `*GST*: ${client.gst}` : '';
    const initialShippingText = `*Shipping Address*: Ask for client`;

    setInjectedClientText(clientText);
    setInjectedGstText(gstText);
    setInjectedShippingText(initialShippingText);

    setOrderData((prev) => {
      let currentDetails = prev.details?.invoiceDetails || '';
      if (injectedClientText)
        currentDetails = currentDetails
          .replace('\n\n' + injectedClientText, '')
          .replace(injectedClientText + '\n\n', '')
          .replace(injectedClientText, '');
      if (injectedGstText)
        currentDetails = currentDetails
          .replace('\n\n' + injectedGstText, '')
          .replace(injectedGstText + '\n\n', '')
          .replace(injectedGstText, '');
      if (injectedBillingText)
        currentDetails = currentDetails
          .replace('\n\n' + injectedBillingText, '')
          .replace(injectedBillingText + '\n\n', '')
          .replace(injectedBillingText, '');
      if (injectedShippingText)
        currentDetails = currentDetails
          .replace('\n\n' + injectedShippingText, '')
          .replace(injectedShippingText + '\n\n', '')
          .replace(injectedShippingText, '');

      const initialInjection = [clientText, gstText, initialShippingText].filter(Boolean).join('\n\n');
      currentDetails = currentDetails ? `${currentDetails}\n\n${initialInjection}` : initialInjection;

      return {
        ...prev,
        client: client.name,
        contactNo: client.phones?.[0] || '',
        details: { ...prev.details!, invoiceDetails: currentDetails },
      };
    });

    setInjectedBillingText('');
    setIncludeBillingInInvoice(true);
    setIsClientSearchOpen(false);

    if (currentUserProfile) {
      try {
        const addresses = await customersApi.fetchCustomerAddresses(client.id);
        setSelectedClient((prev) => (prev ? { ...prev, ...addresses } : prev));

        if (addresses.billingAddress) {
          const billingText = `*Billing Address*: ${addresses.billingAddress}`;
          setInjectedBillingText(billingText);

          setOrderData((prev) => {
            let currentDetails = prev.details?.invoiceDetails || '';
            const insertionPoint = gstText || clientText;
            if (currentDetails.includes(insertionPoint)) {
              currentDetails = currentDetails.replace(insertionPoint, `${insertionPoint}\n\n${billingText}`);
            } else {
              currentDetails = currentDetails ? `${currentDetails}\n\n${billingText}` : billingText;
            }
            return { ...prev, details: { ...prev.details!, invoiceDetails: currentDetails } };
          });
        }
      } catch (error: unknown) {
        console.error('Failed to fetch addresses', error);
      }
    }
  };

  // ─── CustomerDialog handlers ──────────────────────────────────────────────

  /**
   * Opens CustomerDialog in 'create' mode to register a new entity.
   */
  const openAddCustomer = () => {
    setCustomerToEdit(null);
    setCustomerDialogMode('create');
    setIsCustomerDialogOpen(true);
    setIsClientSearchOpen(false);
  };

  /**
   * Opens CustomerDialog in 'edit' mode for the currently selected client.
   * Bypasses view mode since the user has explicitly requested an edit.
   */
  const openEditCustomer = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedClient) return;
    setCustomerToEdit(selectedClient);
    setCustomerDialogMode('edit');
    setIsCustomerDialogOpen(true);
  };

  /**
   * Called when CustomerDialog footer "Edit Profile" is clicked from view mode.
   * Switches the in-place dialog from view → edit without closing.
   */
  const handleCustomerDialogEdit = useCallback(() => {
    setCustomerDialogMode('edit');
  }, []);

  /**
   * Not surfaced in this context (deletion from CreateOrderDialog is undesirable),
   * but required by the CustomerDialog interface. Closes the dialog and
   * clears the selected client so the user can pick a replacement.
   */
  const handleCustomerDialogDelete = useCallback(() => {
    setIsCustomerDialogOpen(false);
    setSelectedClient(null);
    setClientSearchTerm('');
    setSelectedShippingAddress('Ask for client');
    clearInjectedAddresses();
    fetchClients();
  }, [fetchClients]);

  const handleCustomerDialogClose = useCallback(() => {
    setIsCustomerDialogOpen(false);
    setCustomerToEdit(null);
  }, []);

  /**
   * After a customer is created or updated, refresh the list and auto-select
   * the affected record in the order form.
   */
  const handleCustomerSuccess = useCallback(
    async (customer: CustomerSummary) => {
      await fetchClients();
      handleSelectClient(customer);
      setIsCustomerDialogOpen(false);
      setCustomerToEdit(null);
    },
    [fetchClients],
  );

  // ─── Billing / shipping helpers ───────────────────────────────────────────

  const handleIncludeBillingChange = (checked: boolean) => {
    setIncludeBillingInInvoice(checked);
    if (!selectedClient || !('billingAddress' in selectedClient)) return;

    const newText = `*Billing Address*: ${(selectedClient as any).billingAddress}`;

    setOrderData((prev) => {
      let currentDetails = prev.details?.invoiceDetails || '';

      if (checked) {
        if (!currentDetails.includes(newText)) {
          currentDetails = currentDetails ? `${currentDetails}\n\n${newText}` : newText;
        }
        setInjectedBillingText(newText);
      } else {
        const textToRemove = injectedBillingText || newText;
        currentDetails = currentDetails
          .replace('\n\n' + textToRemove, '')
          .replace(textToRemove + '\n\n', '')
          .replace(textToRemove, '');
        setInjectedBillingText('');
      }

      return { ...prev, details: { ...prev.details!, invoiceDetails: currentDetails } };
    });
  };

  const handleShippingAddressChange = (addr: string) => {
    setSelectedShippingAddress(addr);

    setOrderData((prev) => {
      let currentDetails = prev.details?.invoiceDetails || '';

      if (injectedShippingText) {
        currentDetails = currentDetails
          .replace('\n\n' + injectedShippingText, '')
          .replace(injectedShippingText + '\n\n', '')
          .replace(injectedShippingText, '');
      }

      const newText = `*Shipping Address*: ${addr}`;
      currentDetails = currentDetails ? `${currentDetails}\n\n${newText}` : newText;
      setInjectedShippingText(newText);

      return {
        ...prev,
        details: {
          ...prev.details!,
          invoiceDetails: currentDetails,
          siteDeliveryInfo: addr !== 'Ask for client' ? addr : '',
        },
      };
    });
  };

  // ─── Form reset ───────────────────────────────────────────────────────────

  const resetFormData = () => {
    setOrderData(initialOrderData);
    setProductFiles([]);
    setProductAudioFiles([]);
    setInvoiceAudioFiles([]);
    setIsDeliveryInfoExpanded(false);
    setCreatedOrderDeoNo(null);
    setIsRetryingFileUpload(false);
    setClientSearchTerm('');
    setIsClientSearchOpen(false);
    setSelectedClient(null);
    setIncludeBillingInInvoice(false);
    setInjectedClientText('');
    setInjectedGstText('');
    setInjectedBillingText('');
    setInjectedShippingText('');
    setSelectedShippingAddress('Ask for client');
  };

  const handleClose = () => {
    if (!createdOrderDeoNo) {
      resetFormData();
    }
    onClose();
  };

  // ─── Field change handlers ────────────────────────────────────────────────

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setOrderData((prev) => {
      if (id in prev) {
        return { ...prev, [id]: value };
      } else if (prev.details && id in prev.details) {
        return { ...prev, details: { ...prev.details!, [id]: value } };
      }
      return prev;
    });
  };

  const handlePriorityToggle = () => {
    setOrderData((prev) => ({ ...prev, isHighPriority: !prev.isHighPriority }));
  };

  const handleWeightScaleChange = (value: string) => {
    setOrderData((prev) => ({
      ...prev,
      details: { ...prev.details!, weightScaleType: value as WeightScaleType },
    }));
  };

  const handlePaymentStatusChange = (value: string) => {
    setOrderData((prev) => ({ ...prev, customerPaymentStatus: value as CustomerPaymentStatus }));
  };

  const setDeoNumberFromSuggestion = (deoNo: string) => {
    setOrderData((prev) => ({ ...prev, deoNo }));
  };

  // ─── File handlers ────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setProductFiles((prev) => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setProductFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleProductAudioAdd = (files: File[]) =>
    setProductAudioFiles((prev) => [...prev, ...files]);
  const handleProductAudioRemove = (index: number) =>
    setProductAudioFiles((prev) => prev.filter((_, i) => i !== index));
  const handleInvoiceAudioAdd = (files: File[]) =>
    setInvoiceAudioFiles((prev) => [...prev, ...files]);
  const handleInvoiceAudioRemove = (index: number) =>
    setInvoiceAudioFiles((prev) => prev.filter((_, i) => i !== index));

  // ─── Upload ───────────────────────────────────────────────────────────────

  const uploadAllFilesParallel = async (deoNo: string) => {
    const hasFiles =
      productFiles.length > 0 || productAudioFiles.length > 0 || invoiceAudioFiles.length > 0;
    if (!hasFiles) return { success: true, totalFiles: 0, timing: {} };

    const startTime = performance.now();
    const totalFiles = productFiles.length + productAudioFiles.length + invoiceAudioFiles.length;
    setUploadProgress({ total: totalFiles, completed: 0, current: 'Starting...' });

    onShowMessage({ type: 'info', text: `Uploading ${totalFiles} file(s) in parallel...` });

    const uploadTasks: Array<Promise<any>> = [];

    if (productFiles.length > 0) {
      uploadTasks.push(
        (async () => {
          const taskStart = performance.now();
          try {
            const { pdfBytes, filename } = await processFilesToPdf(productFiles, 'product');
            const uploadObject = await pdfBytesToFile(pdfBytes, filename);
            await apiService.uploadFile(deoNo, 'product', [uploadObject]);
            setUploadProgress((prev) => ({
              ...prev,
              completed: prev.completed + productFiles.length,
            }));
            return { type: 'Product Images', success: true, duration: performance.now() - taskStart };
          } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            return { type: 'Product Images', success: false, error: msg };
          }
        })(),
      );
    }

    if (productAudioFiles.length > 0) {
      uploadTasks.push(
        (async () => {
          const taskStart = performance.now();
          try {
            await fileApi.uploadFiles(deoNo, productAudioFiles, 'productVoiceNote', 'order');
            setUploadProgress((prev) => ({
              ...prev,
              completed: prev.completed + productAudioFiles.length,
            }));
            return { type: 'Product Audio', success: true, duration: performance.now() - taskStart };
          } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            return { type: 'Product Audio', success: false, error: msg };
          }
        })(),
      );
    }

    if (invoiceAudioFiles.length > 0) {
      uploadTasks.push(
        (async () => {
          const taskStart = performance.now();
          try {
            await fileApi.uploadFiles(deoNo, invoiceAudioFiles, 'invoiceVoiceNote', 'order');
            setUploadProgress((prev) => ({
              ...prev,
              completed: prev.completed + invoiceAudioFiles.length,
            }));
            return { type: 'Invoice Audio', success: true, duration: performance.now() - taskStart };
          } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            return { type: 'Invoice Audio', success: false, error: msg };
          }
        })(),
      );
    }

    const results = await Promise.allSettled(uploadTasks);
    const failed = results.filter(
      (r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success),
    );
    if (failed.length > 0) throw new Error('One or more uploads failed');

    return { success: true, totalFiles, timing: { total: performance.now() - startTime } };
  };

  const handleRetryFileUpload = async () => {
    if (!currentUserProfile || !createdOrderDeoNo) return;
    setIsRetryingFileUpload(true);
    try {
      await uploadAllFilesParallel(createdOrderDeoNo);
      onShowMessage({ type: 'success', text: '🎉 Success!' });
      resetFormData();
      onOrderCreated();
      handleClose();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      onShowMessage({ type: 'error', text: `Retry failed: ${msg}` });
    } finally {
      setIsRetryingFileUpload(false);
    }
  };

  const handleSubmit = async () => {
    if (!currentUserProfile) return;
    if (createdOrderDeoNo) {
      await handleRetryFileUpload();
      return;
    }
    const validationError = validateOrderData(orderData);
    if (validationError) {
      onShowMessage({ type: 'error', text: validationError });
      return;
    }

    setIsAddingOrder(true);
    try {
      const orderToCreate = {
        ...orderData,
        organizationContact: currentUserProfile.email,
      } as any;
      const createdOrder = await apiService.addOrder(orderToCreate);
      setCreatedOrderDeoNo(createdOrder.deoNo);

      const hasFiles =
        productFiles.length > 0 || productAudioFiles.length > 0 || invoiceAudioFiles.length > 0;
      if (hasFiles) {
        await uploadAllFilesParallel(createdOrder.deoNo);
      }

      onShowMessage({ type: 'success', text: `✓ Order ${createdOrder.deoNo} created!` });
      resetFormData();
      onOrderCreated();
      handleClose();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      onShowMessage({ type: 'error', text: `Error: ${msg}` });
    } finally {
      setIsAddingOrder(false);
    }
  };

  const handleFetchDeoNumbers = async () => {
    setFetchingDeoNumbers(true);
    await fetchDeoNumbers();
    setFetchingDeoNumbers(false);
  };

  // ─── Style constants ──────────────────────────────────────────────────────

  const sectionCardClass =
    'p-2 sm:p-4 rounded-[2rem] bg-gray-50/30 dark:bg-white/5 border border-gray-100 dark:border-white/10 space-y-1';
  const sectionLabelClass =
    'text-[10px] font-black uppercase text-blue-600 flex items-center gap-2 px-1';
  const inputHeight = 'h-12';

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <TooltipProvider>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-200 md:max-w-250 w-[96vw] p-0 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col h-[98vh] sm:h-auto max-h-[98vh] sm:max-h-[92vh] z-[9000] border-white/20 backdrop-blur-2xl bg-white dark:bg-gray-900">

          <DialogHeader className="px-8 py-5 border-b border-gray-100 dark:border-white/5 bg-white/40 dark:bg-gray-900/40 backdrop-blur-md">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Plus className="w-6 h-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black tracking-tight">
                  {createdOrderDeoNo ? `Sync Assets: ${createdOrderDeoNo}` : 'Initiate New Order'}
                </DialogTitle>
                <p className="text-[10px] uppercase font-bold text-gray-400 mt-0.5">
                  Commercial Orchestration Portal
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-8 space-y-5 dialog-custom-scrollbar">

            {/* SECTION 1: CORE IDENTITY */}
            <section className={sectionCardClass}>
              <h3 className={sectionLabelClass}>
                <Fingerprint className="w-3.5 h-3.5" /> Order Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-gray-400 ml-1">
                    Delivery Order Number
                  </Label>
                  <div className="relative group">
                    <Input
                      id="deoNo"
                      value={orderData.deoNo}
                      onChange={handleChange}
                      placeholder="Enter DEO No."
                      className={`${inputHeight} pr-[90px] rounded-2xl bg-white dark:bg-gray-900 border-gray-100 shadow-sm focus:ring-4 focus:ring-blue-500/5 font-mono text-base font-bold`}
                    />
                    <button
                      type="button"
                      onClick={handleFetchDeoNumbers}
                      disabled={fetchingDeoNumbers}
                      className="absolute right-1.5 top-1.5 h-9 px-3.5 rounded-xl flex items-center gap-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white transition-all active:scale-95 group/btn"
                    >
                      <span className="text-[10px] font-black uppercase tracking-tight">
                        {fetchingDeoNumbers ? '...' : 'Fetch'}
                      </span>
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${fetchingDeoNumbers ? 'animate-spin' : 'group-hover/btn:rotate-180 transition-transform duration-500'}`}
                      />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {Object.keys(nextDeoNumbers).map((prefix) => (
                      <button
                        key={prefix}
                        onClick={() => setDeoNumberFromSuggestion(nextDeoNumbers[prefix]?.nextDeoNo)}
                        className="px-3 py-1 rounded-lg bg-blue-500/5 hover:bg-blue-500/10 text-blue-600 text-[10px] font-black border border-blue-500/10 transition-colors uppercase"
                      >
                        {prefix}: {nextDeoNumbers[prefix]?.nextDeoNo}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-gray-400 ml-1">
                    Standard Page
                  </Label>
                  <div
                    onClick={handlePriorityToggle}
                    className={`flex items-center justify-between ${inputHeight} px-5 rounded-2xl cursor-pointer border transition-all ${orderData.isHighPriority ? 'bg-red-500/5 border-red-200 shadow-inner' : 'bg-white dark:bg-gray-900 border-gray-100 shadow-sm'}`}
                  >
                    <span
                      className={`text-[11px] font-black flex items-center gap-2.5 tracking-wider ${orderData.isHighPriority ? 'text-red-600' : 'text-gray-400'}`}
                    >
                      <Zap
                        className={`w-3.5 h-3.5 ${orderData.isHighPriority ? 'fill-red-600 animate-pulse' : ''}`}
                      />
                      {orderData.isHighPriority ? 'CRITICAL PRIORITY' : 'STANDARD PACE'}
                    </span>
                    <Switch
                      checked={orderData.isHighPriority}
                      className="scale-75 data-[state=checked]:bg-red-600"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 2: CLIENT INTEGRATION */}
            <section className={sectionCardClass}>
              <div className="flex items-center justify-between px-1">
                <h3 className={sectionLabelClass}>
                  <Users className="w-3.5 h-3.5" /> Client Integration
                </h3>
                <div className="flex items-center gap-2">
                  {selectedClient && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={openEditCustomer}
                      className="h-7 px-3 rounded-lg text-[9px] font-black uppercase text-blue-600 hover:bg-blue-100/50 flex items-center gap-1.5 transition-all"
                    >
                      <Edit2 className="w-3 h-3" /> Update Profile
                    </Button>
                  )}
                  <button
                    type="button"
                    onClick={fetchClients}
                    disabled={isFetchingClients}
                    className="h-9 px-3.5 rounded-xl flex items-center gap-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white transition-all active:scale-95 group/btn"
                  >
                    <span className="text-[10px] font-black uppercase tracking-tight">
                      {isFetchingClients ? '...' : 'Fetch'}
                    </span>
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isFetchingClients ? 'animate-spin' : 'group-hover/btn:rotate-180 transition-transform duration-500'}`}
                    />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                <div className="md:col-span-6 lg:col-span-5 relative">
                  <div className="flex gap-2.5">
                    <div className="relative flex-1 group">
                      <Input
                        id="clientSearch"
                        value={clientSearchTerm || orderData.client}
                        onChange={handleClientSearchChange}
                        onFocus={() => setIsClientSearchOpen(true)}
                        placeholder="Search Business Entities..."
                        className={`${inputHeight} rounded-2xl bg-white dark:bg-gray-900 border-gray-100 shadow-sm focus:ring-4 focus:ring-blue-500/5 transition-all text-sm font-bold`}
                      />
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={openAddCustomer}
                          className={`${inputHeight} w-12 rounded-2xl border-gray-100 bg-white dark:bg-gray-900 text-blue-600 hover:bg-blue-600 hover:text-white shadow-sm transition-all flex-shrink-0`}
                        >
                          <UserPlus className="w-5 h-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="rounded-xl font-black text-[10px] uppercase tracking-[0.15em] bg-blue-600 text-white border-none px-4 py-2.5 shadow-2xl">
                        New Entity Registration
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  {isClientSearchOpen && (
                    <div
                      className="absolute z-[10002] top-full left-0 w-full mt-2 bg-white dark:bg-gray-800 shadow-2xl rounded-[1.5rem] border border-gray-100 dark:border-white/10 max-h-72 overflow-y-auto animate-in fade-in zoom-in-95 duration-200"
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      {filteredClients.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => handleSelectClient(c)}
                          className="p-4 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 cursor-pointer border-b border-gray-50 dark:border-white/5 last:border-0 transition-colors group/item"
                        >
                          <div className="font-bold text-sm text-gray-800 dark:text-gray-100 group-hover/item:text-blue-600 transition-colors">
                            {c.name}
                          </div>
                          <div className="text-[10px] text-gray-400 flex flex-wrap gap-2.5 mt-1.5 font-bold uppercase tracking-tight">
                            <span className="flex items-center gap-1.5">
                              <span className="text-[9px] opacity-40">GST:</span> {c.gst || '---'}
                            </span>
                            <span className="text-gray-200">|</span>
                            <span className="flex items-center gap-1.5">
                              <span className="text-[9px] opacity-40">PAN:</span> {c.pan || '---'}
                            </span>
                            <span className="text-gray-200">|</span>
                            <span className="flex items-center gap-1.5">
                              <span className="text-[9px] opacity-40">TEL:</span>{' '}
                              {c.phones?.[0] || '---'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="md:col-span-3 relative">
                  <div className="relative group">
                    <Phone className="absolute left-4 top-4 w-4 h-4 text-gray-300 group-focus-within:text-blue-500 transition-colors" />
                    <Input
                      id="contactNo"
                      type="tel"
                      value={orderData.contactNo}
                      onChange={handleChange}
                      onFocus={() => setIsPhoneDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setIsPhoneDropdownOpen(false), 200)}
                      placeholder="Primary Contact"
                      className={`${inputHeight} pl-11 rounded-2xl bg-white dark:bg-gray-900 border-gray-100 shadow-sm transition-all text-sm font-bold`}
                    />
                  </div>
                  {isPhoneDropdownOpen &&
                    selectedClient?.phones &&
                    selectedClient.phones.length > 0 && (
                      <div className="absolute z-[10002] top-full left-0 w-full mt-2 bg-white dark:bg-gray-800 shadow-2xl rounded-2xl border border-gray-100 dark:border-white/10 max-h-48 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                        {selectedClient.phones.map((phone, idx) => (
                          <div
                            key={idx}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setOrderData((prev) => ({ ...prev, contactNo: phone }));
                              setIsPhoneDropdownOpen(false);
                            }}
                            className="p-4 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 cursor-pointer border-b border-gray-100 dark:border-white/5 last:border-0 transition-colors"
                          >
                            <div className="font-bold text-sm text-gray-700 dark:text-gray-200 flex items-center gap-3">
                              <Phone className="w-3.5 h-3.5 text-gray-300" />
                              {phone}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                </div>

                <div className="md:col-span-3 lg:col-span-4">
                  <Select
                    onValueChange={handlePaymentStatusChange}
                    value={orderData.customerPaymentStatus}
                  >
                    <SelectTrigger
                      className={`${inputHeight} rounded-2xl bg-white dark:bg-gray-900 border-gray-100 shadow-sm px-5 text-sm font-bold`}
                    >
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent className="z-[10001] rounded-2xl p-2 shadow-2xl border-gray-100">
                      <SelectItem value="regular" className="rounded-xl font-bold py-2.5">
                        Regular Account
                      </SelectItem>
                      <SelectItem
                        value="new-paid"
                        className="rounded-xl font-bold py-2.5 text-green-600"
                      >
                        New - Prepaid
                      </SelectItem>
                      <SelectItem
                        value="new-unpaid"
                        className="rounded-xl font-bold py-2.5 text-orange-600"
                      >
                        New - Unpaid
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedClient && (
                <div className="mt-4 p-6 bg-white dark:bg-white/5 rounded-[2rem] border border-gray-100 dark:border-white/10 space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <Label className="text-[9px] font-black uppercase text-gray-400">
                          Invoice Destination
                        </Label>
                        <div
                          onClick={() => handleIncludeBillingChange(!includeBillingInInvoice)}
                          className="flex items-center gap-2.5 group cursor-pointer select-none"
                        >
                          <div className="relative">
                            <input
                              type="checkbox"
                              id="includeBilling"
                              checked={includeBillingInInvoice}
                              readOnly
                              className="peer sr-only"
                            />
                            <div className="w-9 h-5 bg-gray-100 dark:bg-white/5 peer-checked:bg-blue-600 rounded-full transition-all duration-300 ring-1 ring-gray-200 dark:ring-white/10" />
                            <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full shadow-sm transition-transform duration-300 peer-checked:translate-x-4 scale-110" />
                          </div>
                          <span className="text-[9px] text-gray-500 font-black uppercase hover:text-blue-600 transition-colors">
                            Apply to Notes
                          </span>
                        </div>
                      </div>
                      <div className="text-xs p-5 bg-gray-50/50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-white/5 text-gray-600 dark:text-gray-400 leading-relaxed font-bold italic min-h-[80px]">
                        {(selectedClient as any).billingAddress || (
                          <span className="italic text-gray-300">Retrieving registered address...</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <Label className="text-[9px] font-black uppercase text-gray-400">
                          Delivery Endpoint
                        </Label>
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg text-[9px] font-black uppercase border border-blue-100 dark:border-blue-800/30">
                          <Check className="w-2.5 h-2.5" /> Auto-Synced
                        </div>
                      </div>
                      <Select
                        onValueChange={handleShippingAddressChange}
                        value={selectedShippingAddress}
                      >
                        <SelectTrigger
                          className={`${inputHeight} rounded-2xl bg-gray-50/50 dark:bg-gray-900/50 border-gray-100 shadow-sm font-black text-gray-700 dark:text-gray-200`}
                        >
                          <SelectValue placeholder="Select Logistics Point" />
                        </SelectTrigger>
                        <SelectContent className="z-[10001] rounded-[1.5rem] p-2 shadow-2xl border-gray-100 max-h-60 overflow-y-auto">
                          <SelectItem
                            value="Ask for client"
                            className="rounded-xl font-black text-blue-600 bg-blue-50/50 hover:bg-blue-100 py-3 mb-2"
                          >
                            Consult Client Later
                          </SelectItem>
                          {(selectedClient as any).shippingAddresses?.map(
                            (addr: any, idx: number) => (
                              <SelectItem key={idx} value={addr.address} className="rounded-xl py-3 px-4">
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-black text-xs uppercase tracking-tight">
                                    {addr.label}
                                  </span>
                                  <span className="text-[10px] text-gray-400 truncate max-w-[280px]">
                                    {addr.address}
                                  </span>
                                </div>
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* SECTION 3: PRODUCT INFORMATION */}
            <section className={sectionCardClass}>
              <h3 className={sectionLabelClass}>
                <Package className="w-3.5 h-3.5" /> Product Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                <div className="md:col-span-8 space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-gray-400 ml-1">
                    Product Specifications
                  </Label>
                  <RichTextarea
                    id="products"
                    value={orderData.products || ''}
                    onChange={handleChange}
                    rows={5}
                    placeholder="e.g., **500 sqm** Color Coated Sheets; Price: ₹{{500*120}}/sqm"
                    className="rounded-[1.5rem] border-gray-100 shadow-sm text-sm font-medium leading-relaxed"
                  />
                </div>
                <div className="md:col-span-4 space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-gray-400 ml-1">
                    Voice Note
                  </Label>
                  <div className="p-5 rounded-[1.5rem] bg-blue-50/30 dark:bg-blue-900/10 border border-dashed border-blue-200 dark:border-blue-800/50 min-h-[160px] flex flex-col justify-center items-center">
                    <span className="text-[9px] font-black text-blue-600/60 uppercase mb-4 block">
                      Audio Instructions
                    </span>
                    <AudioManager
                      currentUser={currentUserProfile}
                      identifier="new-order"
                      identifierType="order"
                      uploadStage="productVoiceNote"
                      initialFiles={[]}
                      editMode={true}
                      stagingMode={true}
                      pendingFiles={productAudioFiles}
                      onFilesStaged={handleProductAudioAdd}
                      onFileRemoved={handleProductAudioRemove}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-gray-100 dark:border-white/5">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-gray-400 ml-1">
                    Transit Provider
                  </Label>
                  <div className="flex gap-3">
                    <Select
                      onValueChange={(v) =>
                        setOrderData((prev) => ({
                          ...prev,
                          details: { ...prev.details!, transportProvider: v as any },
                        }))
                      }
                      value={orderData.details?.transportProvider || ''}
                    >
                      <SelectTrigger
                        className={`${inputHeight} rounded-2xl flex-1 bg-white dark:bg-gray-900 border-gray-100 shadow-sm text-sm font-bold`}
                      >
                        <SelectValue placeholder="Provider" />
                      </SelectTrigger>
                      <SelectContent className="z-[10001] rounded-xl">
                        <SelectItem value="client" className="font-bold">
                          Client Arrangement
                        </SelectItem>
                          <SelectItem value="poter" className="font-bold">
                          Poter
                        </SelectItem>
                        <SelectItem value="own" className="font-bold">
                          Company Fleet
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {orderData.details?.transportProvider === 'own' && (
                      <Input
                        className={`${inputHeight} rounded-2xl flex-1 border-blue-100 dark:border-blue-900/30 font-bold text-sm shadow-sm`}
                        placeholder="Carrier Identity"
                        value={orderData.details?.transportProviderName || ''}
                        onChange={(e) =>
                          setOrderData((prev) => ({
                            ...prev,
                            details: { ...prev.details!, transportProviderName: e.target.value },
                          }))
                        }
                      />
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-gray-400 ml-1">
                    Measurement Scale
                  </Label>
                  <Select
                    onValueChange={handleWeightScaleChange}
                    value={orderData.details?.weightScaleType || ''}
                  >
                    <SelectTrigger
                      className={`${inputHeight} rounded-2xl bg-white dark:bg-gray-900 border-gray-100 shadow-sm text-sm font-bold`}
                    >
                      <SelectValue placeholder="Select Scale Type" />
                    </SelectTrigger>
                    <SelectContent className="z-[10001] rounded-xl">
                      <SelectItem value="outside" className="font-bold">
                        Third-Party Scale
                      </SelectItem>
                      <SelectItem value="inside" className="font-bold">
                        Factory In-House
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setIsDeliveryInfoExpanded(!isDeliveryInfoExpanded)}
                  className={`flex items-center justify-between w-full p-4 rounded-2xl transition-all group border ${isDeliveryInfoExpanded ? 'bg-white dark:bg-gray-900 border-gray-200 shadow-inner' : 'bg-gray-100/40 dark:bg-white/5 border-transparent hover:bg-gray-100'}`}
                >
                  <span className="text-[10px] font-black text-gray-500 group-hover:text-blue-600 uppercase flex items-center gap-3">
                    <MapPin className="w-3.5 h-3.5" /> Site Delivery Information
                  </span>
                  {isDeliveryInfoExpanded ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </button>
                {isDeliveryInfoExpanded && (
                  <div className="p-1 animate-in fade-in slide-in-from-top-2 duration-300">
                    <RichTextarea
                      id="siteDeliveryInfo"
                      value={orderData.details?.siteDeliveryInfo || ''}
                      onChange={handleChange}
                      rows={3}
                      placeholder="Site contact persons, gate instructions, offloading protocols..."
                      className="rounded-2xl border-gray-100 shadow-sm"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-3 pt-4">
                <div
                  className="group border-2 border-dashed border-gray-200 dark:border-white/10 rounded-[2rem] p-10 text-center hover:border-blue-500 hover:bg-blue-50/50 transition-all cursor-pointer bg-gray-50/30"
                  onDrop={(e) => handleDrop(e, (files) => setProductFiles((prev) => [...prev, ...files]))}
                >
                  <Input
                    id="product-files"
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <Label
                    htmlFor="product-files"
                    className="cursor-pointer flex flex-col items-center gap-4"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-white dark:bg-white/5 flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                      <UploadCloud className="w-7 h-7 text-gray-300 group-hover:text-white" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs font-black text-gray-500 group-hover:text-blue-600 uppercase block">
                        Upload Project Files
                      </span>
                      <span className="text-[10px] font-bold text-gray-400 block italic opacity-60">
                        Drop blueprints, photos, or purchase orders here
                      </span>
                    </div>
                  </Label>
                </div>
                <div className="flex flex-wrap gap-2.5 px-2">
                  {productFiles.map((f, i) => (
                    <div
                      key={i}
                      className="px-4 py-2 bg-gray-900 dark:bg-blue-600 text-white rounded-xl text-[9px] font-black flex items-center gap-3 shadow-xl animate-in zoom-in-90"
                    >
                      {f.name.toUpperCase()}
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="hover:text-red-400 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* SECTION 4: INVOICE INFORMATION */}
            <section className={sectionCardClass}>
              <h3 className={sectionLabelClass}>
                <Zap className="w-3.5 h-3.5" /> Invoice Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                <div className="md:col-span-8 space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-gray-400 ml-1">
                    Invoice Note
                  </Label>
                  <RichTextarea
                    id="invoiceDetails"
                    value={orderData.details?.invoiceDetails || ''}
                    onChange={handleChange}
                    rows={3}
                    placeholder="e.g., *Due: 2025-06-30*, Payment Terms: 30 days. Balance: ₹{{100000 - 50000}}"
                    className="rounded-[1.5rem] border-gray-100 shadow-sm text-sm"
                    enableAutocomplete={true}
                  />
                </div>
                <div className="md:col-span-4 space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-gray-400 ml-1">
                    Billing Voice Note
                  </Label>
                  <div className="p-5 rounded-[1.5rem] bg-white dark:bg-white/5 border border-gray-100 h-[120px] flex items-center justify-center shadow-sm">
                    <AudioManager
                      currentUser={currentUserProfile}
                      identifier="new-order"
                      identifierType="order"
                      uploadStage="invoiceVoiceNote"
                      initialFiles={[]}
                      editMode={true}
                      stagingMode={true}
                      pendingFiles={invoiceAudioFiles}
                      onFilesStaged={handleInvoiceAudioAdd}
                      onFileRemoved={handleInvoiceAudioRemove}
                    />
                  </div>
                </div>
              </div>
            </section>
          </div>

          <DialogFooter className="px-8 py-6 border-t border-gray-100 dark:border-white/5 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl">
            <div className="flex w-full items-center justify-end gap-5">
              {uploadProgress.total > 0 && (
                <div className="flex-1 bg-blue-50/50 dark:bg-blue-900/20 p-3.5 rounded-2xl border border-blue-100 dark:border-blue-800/30 flex items-center gap-4 animate-pulse">
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between text-[10px] font-black uppercase text-blue-600">
                      <span>Uploading Protocol</span>
                      <span>
                        {Math.round((uploadProgress.completed / uploadProgress.total) * 100)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-blue-100 dark:bg-blue-900/40 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 transition-all duration-500"
                        style={{
                          width: `${(uploadProgress.completed / uploadProgress.total) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="text-[9px] font-bold text-blue-400 truncate">
                      {uploadProgress.current}
                    </div>
                  </div>
                </div>
              )}
              <Button
                variant="ghost"
                onClick={handleClose}
                className="h-12 px-8 rounded-2xl font-black text-xs text-gray-400 hover:bg-gray-50 transition-all"
              >
                DISCARD
              </Button>
              <div className="flex gap-3">
                {createdOrderDeoNo && (
                  <Button
                    onClick={() => {
                      setCreatedOrderDeoNo(null);
                      setIsRetryingFileUpload(false);
                    }}
                    variant="outline"
                    className="h-12 px-6 rounded-2xl border-red-200 text-red-600 font-black text-xs hover:bg-red-50"
                  >
                    RESET
                  </Button>
                )}
                <Button
                  onClick={handleSubmit}
                  disabled={isAddingOrder || isRetryingFileUpload}
                  className={`h-12 px-10 rounded-2xl font-black text-xs shadow-2xl transition-all active:scale-95 ${createdOrderDeoNo ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/20' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'}`}
                >
                  {isAddingOrder ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-3" />
                  ) : createdOrderDeoNo ? (
                    <Upload className="w-4 h-4 mr-3" />
                  ) : (
                    <Check className="w-4 h-4 mr-3" />
                  )}
                  {createdOrderDeoNo ? 'RETRY SYNC' : 'CREATE ORDER'}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>

        {/*
          ─── Updated CustomerDialog usage ──────────────────────────────────
          mode        : 'create' when registering a new entity,
                        'edit'   when updating an existing selected client.
          onEdit      : switches dialog from view → edit (required by new API).
          onDelete    : clears the selected client and refreshes the list.
        */}
        <CustomerDialog
          isOpen={isCustomerDialogOpen}
          mode={customerDialogMode}
          customer={customerToEdit}
          onClose={handleCustomerDialogClose}
          onSuccess={handleCustomerSuccess}
          onEdit={handleCustomerDialogEdit}
          onDelete={handleCustomerDialogDelete}
        />
      </Dialog>
    </TooltipProvider>
  );
};

export { RichTextarea };