// components/CreateOrderDialog.tsx - Enhanced with Audio Support

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
} from 'lucide-react';
import { CustomerPaymentStatus, DeoNumbersByPrefix, DialogMessageType, Order, WeightScaleType } from '../types';
import { apiService } from '@/lib/data';
import { UserProfile } from '@/types/rbac.types';
import { handleDrop } from '../fileUtils';
import { validateOrderData } from '../orderUtils';
import AudioManager from '@/components/AudioManager';
import { processFilesToPdf, pdfBytesToFile, formatFileSize } from '@/lib/utils/pdfMergeUtils';
import { fileApi } from '@/lib/api/fileApi';
import { RichTextarea } from '@/components/RichTextarea';

// ... [Keep all exported components: FormatButton, FormattingGuidePopover, RichTextarea - same as before]

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
  // Initial state for order data
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
      invoiceNo: ''
    },
  };

  const [fetchingDeoNumbers, setFetchingDeoNumbers] = useState(false);
  const [isAddingOrder, setIsAddingOrder] = useState(false);
  const [productFiles, setProductFiles] = useState<File[]>([]);

  // Audio file states
  const [productAudioFiles, setProductAudioFiles] = useState<File[]>([]);
  const [invoiceAudioFiles, setInvoiceAudioFiles] = useState<File[]>([]);

  const [isDeliveryInfoExpanded, setIsDeliveryInfoExpanded] = useState(false);

  // NEW: Track if order was created but files failed
  const [createdOrderDeoNo, setCreatedOrderDeoNo] = useState<string | null>(null);
  const [isRetryingFileUpload, setIsRetryingFileUpload] = useState(false);

  const [orderData, setOrderData] = useState<Partial<Order>>(initialOrderData);

  // Reset function to clear all form data
  const resetFormData = () => {
    setOrderData(initialOrderData);
    setProductFiles([]);
    setProductAudioFiles([]);
    setInvoiceAudioFiles([]);
    setIsDeliveryInfoExpanded(false);
    setCreatedOrderDeoNo(null);
    setIsRetryingFileUpload(false);
  };

  // ============================================================================
  // TRULY PARALLEL FILE UPLOAD IMPLEMENTATION WITH PERFORMANCE OPTIMIZATIONS
  // ============================================================================

  // Add state for progress tracking
  const [uploadProgress, setUploadProgress] = useState<{
    total: number;
    completed: number;
    current: string;
  }>({ total: 0, completed: 0, current: '' });




  // Enhanced onClose that resets data
  const handleClose = () => {
    // Only reset if not in retry state
    if (!createdOrderDeoNo) {
      resetFormData();
    }
    onClose();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setOrderData((prev) => {
      if (id in prev) {
        return { ...prev, [id]: value };
      } else if (prev.details && id in prev.details) {
        return {
          ...prev,
          details: {
            ...prev.details!,
            [id]: value,
          },
        };
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
      details: {
        ...prev.details!,
        weightScaleType: value as WeightScaleType,
      },
    }));
  };

  const handlePaymentStatusChange = (value: string) => {
    setOrderData((prev) => ({ ...prev, customerPaymentStatus: value as CustomerPaymentStatus }));
  };

  const setDeoNumberFromSuggestion = (deoNo: string) => {
    setOrderData((prev) => ({
      ...prev,
      deoNo: deoNo,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setProductFiles((prev) => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setProductFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Audio file handlers
  const handleProductAudioAdd = (files: File[]) => {
    setProductAudioFiles(prev => [...prev, ...files]);
  };

  const handleProductAudioRemove = (index: number) => {
    setProductAudioFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleInvoiceAudioAdd = (files: File[]) => {
    setInvoiceAudioFiles(prev => [...prev, ...files]);
  };

  const handleInvoiceAudioRemove = (index: number) => {
    setInvoiceAudioFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Optimized PDF processing with chunking
  const processFilesToPdfOptimized = async (files: File[], type: string) => {
    const startTime = performance.now();

    // Process files in chunks if there are many
    const CHUNK_SIZE = 5;
    const chunks = [];
    for (let i = 0; i < files.length; i += CHUNK_SIZE) {
      chunks.push(files.slice(i, i + CHUNK_SIZE));
    }

    const result = await processFilesToPdf(files, type);

    const endTime = performance.now();
    console.log(`PDF processing took ${(endTime - startTime).toFixed(2)}ms`);

    return result;
  };


  // TRUE PARALLEL UPLOAD with no blocking
  const uploadAllFilesParallel = async (deoNo: string, token: string) => {
    const hasFiles = productFiles.length > 0 ||
      productAudioFiles.length > 0 ||
      invoiceAudioFiles.length > 0;

    if (!hasFiles) {
      return { success: true, totalFiles: 0, timing: {} };
    }

    const startTime = performance.now();
    const totalFiles = productFiles.length + productAudioFiles.length + invoiceAudioFiles.length;

    setUploadProgress({ total: totalFiles, completed: 0, current: 'Starting...' });

    onShowMessage({
      type: 'info',
      text: `Uploading ${totalFiles} file(s) in parallel...`
    });

    // Create ALL promises upfront WITHOUT awaiting
    const uploadTasks: Array<Promise<{
      type: string;
      success: boolean;
      error?: string;
      message?: string;
      duration?: number;
    }>> = [];

    // ===== TASK 1: Product Files (PDF) =====
    if (productFiles.length > 0) {
      const productTask = (async () => {
        const taskStart = performance.now();
        try {
          setUploadProgress(prev => ({
            ...prev,
            current: `Processing ${productFiles.length} product file(s)...`
          }));

          // Pre-process PDF (this runs in parallel with other tasks)
          const { pdfBytes, filename } = await processFilesToPdfOptimized(productFiles, 'product');
          const uploadObject = await pdfBytesToFile(pdfBytes, filename);

          setUploadProgress(prev => ({
            ...prev,
            current: `Uploading ${filename}...`
          }));

          await apiService.uploadFile(deoNo, 'product', [uploadObject], token);

          const taskEnd = performance.now();
          setUploadProgress(prev => ({
            ...prev,
            completed: prev.completed + productFiles.length
          }));

          return {
            type: 'Product Images',
            success: true,
            message: `${filename} (${formatFileSize(pdfBytes.length)})`,
            duration: taskEnd - taskStart
          };
        } catch (error: any) {
          const taskEnd = performance.now();
          return {
            type: 'Product Images',
            success: false,
            error: error.message,
            duration: taskEnd - taskStart
          };
        }
      })();

      uploadTasks.push(productTask);
    }

    // ===== TASK 2: Product Audio Files =====
    if (productAudioFiles.length > 0) {
      const productAudioTask = (async () => {
        const taskStart = performance.now();
        try {
          setUploadProgress(prev => ({
            ...prev,
            current: `Uploading ${productAudioFiles.length} product audio...`
          }));

          await fileApi.uploadFiles(
            deoNo,
            productAudioFiles,
            'productVoiceNote',
            'order'
          );

          const taskEnd = performance.now();
          setUploadProgress(prev => ({
            ...prev,
            completed: prev.completed + productAudioFiles.length
          }));

          return {
            type: 'Product Audio',
            success: true,
            message: `${productAudioFiles.length} audio file(s)`,
            duration: taskEnd - taskStart
          };
        } catch (error: any) {
          const taskEnd = performance.now();
          return {
            type: 'Product Audio',
            success: false,
            error: error.error || error.message,
            duration: taskEnd - taskStart
          };
        }
      })();

      uploadTasks.push(productAudioTask);
    }

    // ===== TASK 3: Invoice Audio Files =====
    if (invoiceAudioFiles.length > 0) {
      const invoiceAudioTask = (async () => {
        const taskStart = performance.now();
        try {
          setUploadProgress(prev => ({
            ...prev,
            current: `Uploading ${invoiceAudioFiles.length} invoice audio...`
          }));

          await fileApi.uploadFiles(
            deoNo,
            invoiceAudioFiles,
            'invoiceVoiceNote',
            'order'
          );

          const taskEnd = performance.now();
          setUploadProgress(prev => ({
            ...prev,
            completed: prev.completed + invoiceAudioFiles.length
          }));

          return {
            type: 'Invoice Audio',
            success: true,
            message: `${invoiceAudioFiles.length} audio file(s)`,
            duration: taskEnd - taskStart
          };
        } catch (error: any) {
          const taskEnd = performance.now();
          return {
            type: 'Invoice Audio',
            success: false,
            error: error.error || error.message,
            duration: taskEnd - taskStart
          };
        }
      })();

      uploadTasks.push(invoiceAudioTask);
    }

    // ===== EXECUTE ALL TASKS IN PARALLEL =====
    console.log(`🚀 Starting ${uploadTasks.length} parallel upload tasks...`);
    const results = await Promise.allSettled(uploadTasks);
    const totalTime = performance.now() - startTime;

    // ===== PROCESS RESULTS =====
    const successful: any[] = [];
    const failed: any[] = [];

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          successful.push(result.value);
        } else {
          failed.push(result.value);
        }
      } else {
        failed.push({
          type: 'Unknown',
          error: result.reason?.message || 'Promise rejected'
        });
      }
    });

    // Show timing information
    console.log('⏱️ Upload Performance:');
    successful.forEach(s => {
      console.log(`  ✓ ${s.type}: ${s.duration?.toFixed(0)}ms - ${s.message}`);
      onShowMessage({
        type: 'success',
        text: `✓ ${s.type}: ${s.message} (${(s.duration! / 1000).toFixed(1)}s)`
      });
    });

    console.log(`📊 Total parallel time: ${totalTime.toFixed(0)}ms`);

    // Handle failures
    if (failed.length > 0) {
      const errorMessages = failed.map(f => `${f.type}: ${f.error}`).join('; ');
      throw new Error(errorMessages);
    }

    return {
      success: true,
      totalFiles,
      successCount: successful.length,
      timing: {
        total: totalTime,
        individual: successful.map(s => ({ type: s.type, duration: s.duration }))
      }
    };
  };


  // Extracted reusable function for file uploads with parallel processing
  {/*
  const uploadAllFiles = async (deoNo: string, token: string) => {
    const hasFilesToUpload = productFiles.length > 0 ||
      productAudioFiles.length > 0 ||
      invoiceAudioFiles.length > 0;

    if (!hasFilesToUpload) {
      return { success: true, totalFiles: 0 };
    }

    const totalFiles = productFiles.length + productAudioFiles.length + invoiceAudioFiles.length;
    onShowMessage({
      type: 'info',
      text: `Uploading ${totalFiles} file(s)...`
    });

    // Create upload promises for parallel execution
    const uploadPromises: Promise<{ type: string; success: boolean; error?: any }>[] = [];

    // Upload product image files (PDF merge)
    if (productFiles.length > 0) {
      uploadPromises.push(
        (async () => {
          try {
            const { pdfBytes, filename } = await processFilesToPdf(productFiles, 'product');
            const uploadObject = await pdfBytesToFile(pdfBytes, filename);

            await apiService.uploadFile(deoNo, 'product', [uploadObject], token);

            return {
              type: 'product',
              success: true,
              message: `${filename} (${formatFileSize(pdfBytes.length)})`
            };
          } catch (error: any) {
            return {
              type: 'product',
              success: false,
              error: error.message
            };
          }
        })()
      );
    }

    // Upload product audio files
    if (productAudioFiles.length > 0) {
      uploadPromises.push(
        (async () => {
          try {
            await fileApi.uploadFiles(
              deoNo,
              productAudioFiles,
              'productVoiceNote',
              'order'
            );
            return {
              type: 'productAudio',
              success: true,
              message: `${productAudioFiles.length} product audio file(s)`
            };
          } catch (error: any) {
            return {
              type: 'productAudio',
              success: false,
              error: error.error || error.message
            };
          }
        })()
      );
    }

    // Upload invoice audio files
    if (invoiceAudioFiles.length > 0) {
      uploadPromises.push(
        (async () => {
          try {
            await fileApi.uploadFiles(
              deoNo,
              invoiceAudioFiles,
              'invoiceVoiceNote',
              'order'
            );
            return {
              type: 'invoiceAudio',
              success: true,
              message: `${invoiceAudioFiles.length} invoice audio file(s)`
            };
          } catch (error: any) {
            return {
              type: 'invoiceAudio',
              success: false,
              error: error.error || error.message
            };
          }
        })()
      );
    }

    // Execute all uploads in parallel
    const results = await Promise.allSettled(uploadPromises);

    // Process results
    const fulfilled = results.filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<any>[];
    const successResults = fulfilled.filter(r => r.value.success);
    const failedResults = fulfilled.filter(r => !r.value.success);
    const rejected = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];

    // Show individual success messages
    successResults.forEach(result => {
      onShowMessage({
        type: 'success',
        text: `✓ ${result.value.type}: ${result.value.message}`
      });
    });

    // Collect all errors
    const errors: string[] = [];
    failedResults.forEach(result => {
      errors.push(`${result.value.type}: ${result.value.error}`);
    });
    rejected.forEach(result => {
      errors.push(result.reason?.message || 'Unknown error');
    });

    if (errors.length > 0) {
      throw new Error(errors.join('; '));
    }

    return {
      success: true,
      totalFiles,
      successCount: successResults.length
    };
  };
*/}
  // ===== RETRY HANDLER =====
  const handleRetryFileUpload = async () => {
    if (!currentUserProfile?.accessToken || !createdOrderDeoNo) {
      onShowMessage({ type: 'error', text: 'Cannot retry without order.' });
      return;
    }

    if (productFiles.length === 0 && productAudioFiles.length === 0 && invoiceAudioFiles.length === 0) {
      onShowMessage({ type: 'warning', text: 'No files to upload.' });
      return;
    }

    setIsRetryingFileUpload(true);

    try {
      const result = await uploadAllFilesParallel(
        createdOrderDeoNo,
        currentUserProfile.accessToken
      );

      onShowMessage({
        type: 'success',
        text: `🎉 Uploaded ${result.totalFiles} file(s) in ${(result.timing?.total ?? 0 / 1000).toFixed(1)}s!`
      });

      resetFormData();
      onOrderCreated();
      handleClose();
    } catch (error: any) {
      onShowMessage({
        type: 'error',
        text: `Retry failed: ${error.message}`
      });
    } finally {
      setIsRetryingFileUpload(false);
      setUploadProgress({ total: 0, completed: 0, current: '' });
    }
  };

  // ===== MAIN SUBMIT HANDLER =====
  const handleSubmit = async () => {
    if (!currentUserProfile?.accessToken) {
      onShowMessage({ type: 'error', text: 'Please log in first.' });
      return;
    }

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
    const overallStart = performance.now();

    try {
      // ===== STEP 1: CREATE ORDER =====
      const orderToCreate = {
        ...orderData,
        organizationContact: currentUserProfile.email,
      } as Omit<Order, 'id' | 'status' | 'editHistory'> & { organizationContact: string };

      onShowMessage({ type: 'info', text: '📝 Creating order...' });

      let createdOrder;
      const orderStart = performance.now();

      try {
        createdOrder = await apiService.addOrder(orderToCreate, currentUserProfile.accessToken);
        setCreatedOrderDeoNo(createdOrder.order.deoNo);

        const orderTime = performance.now() - orderStart;
        console.log(`✓ Order created in ${orderTime.toFixed(0)}ms`);

        onShowMessage({
          type: 'success',
          text: `✓ Order ${createdOrder.order.deoNo} created!`
        });
      } catch (error: any) {
        if (error.message?.includes('already exists')) {
          onShowMessage({
            type: 'warning',
            text: `Order ${orderData.deoNo} exists. Use "Retry File Upload".`
          });
          setCreatedOrderDeoNo(orderData.deoNo || '');
          return;
        }
        throw error;
      }

      // ===== STEP 2: PARALLEL FILE UPLOAD =====
      const hasFiles = productFiles.length > 0 ||
        productAudioFiles.length > 0 ||
        invoiceAudioFiles.length > 0;

      if (hasFiles) {
        try {
          const result = await uploadAllFilesParallel(
            createdOrder.order.deoNo,
            currentUserProfile.accessToken
          );

          const totalTime = performance.now() - overallStart;

          onShowMessage({
            type: 'success',
            text: `🎉 Complete! ${result.totalFiles} files in ${(totalTime / 1000).toFixed(1)}s total`
          });

          //console.log(`✅ Full process: ${totalTime.toFixed(0)}ms (Order: ${(performance.now() - orderStart).toFixed(0)}ms + Upload: ${(result.timing?.total ?? 0).toFixed(0)}ms)`);

          resetFormData();
          onOrderCreated();
          handleClose();
        } catch (fileError: any) {
          onShowMessage({
            type: 'error',
            text: `Order created but upload failed: ${fileError.message}`
          });
          return;
        }
      } else {
        const totalTime = performance.now() - overallStart;
        onShowMessage({
          type: 'success',
          text: `✓ Order ${createdOrder.order.deoNo} created! (${(totalTime / 1000).toFixed(1)}s)`
        });

        resetFormData();
        onOrderCreated();
        handleClose();
      }
    } catch (error: any) {
      onShowMessage({
        type: 'error',
        text: `Error: ${error.message}`
      });
    } finally {
      setIsAddingOrder(false);
      setUploadProgress({ total: 0, completed: 0, current: '' });
    }
  };


  const handleFetchDeoNumbers = async () => {
    setFetchingDeoNumbers(true);
    await fetchDeoNumbers();
    setFetchingDeoNumbers(false);
  };

  // Simplified styles for minimal look
  const dialogBgClass = "bg-white dark:bg-gray-900";

  // Calculate total pending files for badge

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={`sm:max-w-[800px] md:max-w-[1000px] w-[96vw] p-0 rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[98vh] sm:h-auto max-h-[98vh] sm:max-h-[92vh] z-[9000] border-white/20 backdrop-blur-2xl ${dialogBgClass}`}>

        {/* --- COMPACT MINIMALIST HEADER --- */}
        <DialogHeader className="px-4 sm:px-8 py-4 border-b border-gray-100 dark:border-white/5 bg-white/40 dark:bg-gray-900/40 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Plus className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold tracking-tight">
                  {createdOrderDeoNo ? `Retry: ${createdOrderDeoNo}` : 'New Order'}
                </DialogTitle>
                <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Order Creation Portal</p>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* --- RESPONSIVE SCROLL AREA --- */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-8 py-4 sm:py-6 space-y-6 dialog-custom-scrollbar">

          {/* 1. IDENTITY & PRIORITY */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-blue-600 ml-1">Order ID / DEO</Label>
              <div className="relative group">
                <Input
                  id="deoNo"
                  value={orderData.deoNo}
                  onChange={handleChange}
                  placeholder="Enter DEO No."
                  className="h-12 pr-[85px] rounded-2xl bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 shadow-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-mono text-base"
                />

                {/* Integrated Fetch Button */}
                <button
                  type="button"
                  onClick={handleFetchDeoNumbers}
                  disabled={fetchingDeoNumbers}
                  className="absolute right-1.5 top-1.5 h-9 px-3 rounded-xl flex items-center gap-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white transition-all active:scale-95 group/btn"
                >
                  <span className="text-[10px] font-bold uppercase tracking-tight">
                    {fetchingDeoNumbers ? '...' : 'Fetch'}
                  </span>
                  {fetchingDeoNumbers ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5 group-hover/btn:rotate-180 transition-transform duration-500" />
                  )}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {Object.keys(nextDeoNumbers).map((prefix) => (
                  <button key={prefix} onClick={() => setDeoNumberFromSuggestion(nextDeoNumbers[prefix]?.nextDeoNo)} className="px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-600 text-[10px] font-bold border border-blue-500/10">
                    {prefix}: {nextDeoNumbers[prefix]?.nextDeoNo}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-gray-400 ml-1">Urgency</Label>
              <div
                onClick={handlePriorityToggle}
                className={`flex items-center justify-between h-11 px-4 rounded-2xl cursor-pointer border-2 transition-all ${orderData.isHighPriority ? 'bg-red-500/5 border-red-500/50' : 'bg-gray-50 dark:bg-white/5 border-transparent'
                  }`}
              >
                <span className={`text-[11px] font-bold flex items-center gap-2 ${orderData.isHighPriority ? 'text-red-600' : 'text-gray-500'}`}>
                  <Zap className={`w-3.5 h-3.5 ${orderData.isHighPriority ? 'fill-red-600' : ''}`} />
                  {orderData.isHighPriority ? 'HIGH PRIORITY' : 'STANDARD'}
                </span>
                <Switch checked={orderData.isHighPriority} className="scale-75" />
              </div>
            </div>
          </div>

          {/* 2. CUSTOMER DETAILS */}
          <div className="p-4 sm:p-5 rounded-3xl bg-gray-50/50 dark:bg-white/5 ring-1 ring-gray-100 dark:ring-white/10 space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Customer Segment</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Input id="client" value={orderData.client} onChange={handleChange} placeholder="Client Name" className="h-11 rounded-xl bg-white dark:bg-gray-900" />
              <Input id="contactNo" type="tel" value={orderData.contactNo} onChange={handleChange} placeholder="Contact Number" className="h-11 rounded-xl bg-white dark:bg-gray-900" />
              <Select onValueChange={handlePaymentStatusChange} value={orderData.customerPaymentStatus}>
                <SelectTrigger className="h-11 rounded-xl bg-white dark:bg-gray-900"><SelectValue placeholder="Payment Status" /></SelectTrigger>
                <SelectContent className="z-[10001] rounded-xl"><SelectItem value="regular">Regular</SelectItem><SelectItem value="new-paid">New - Paid</SelectItem><SelectItem value="new-unpaid">New - Unpaid</SelectItem></SelectContent>
              </Select>
            </div>
          </div>

          {/* 3. PRODUCTION & LOGISTICS SUPER BOX */}
          <div className="rounded-[2rem] bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-blue-500/5 border-b border-blue-500/10 flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-500" />
              <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Production & Logistics</span>
            </div>

            <div className="p-4 sm:p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="md:col-span-8">
                  <RichTextarea id="products" label="Product Specifications" value={orderData.products || ''} onChange={handleChange} rows={4} placeholder="e.g., **500 sqm** Color Coated Sheets; Price: ₹{{500*120}}/sqm" className="rounded-2xl" />
                </div>
                <div className="md:col-span-4 flex flex-col justify-start">
                  <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-900/10 border border-dashed border-blue-200 dark:border-blue-800">
                    <span className="text-[9px] font-black text-blue-600 uppercase mb-2 block text-center">Voice Instructions</span>
                    <AudioManager
                      currentUser={currentUserProfile} identifier="new-order" identifierType="order"
                      uploadStage="productVoiceNote" initialFiles={[]} editMode={true} stagingMode={true}
                      pendingFiles={productAudioFiles} onFilesStaged={handleProductAudioAdd} onFileRemoved={handleProductAudioRemove}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-white/5">
                <div className="flex gap-2">
                  <Select onValueChange={(v) => setOrderData(prev => ({ ...prev, details: { ...prev.details!, transportProvider: v as any } }))} value={orderData.details?.transportProvider || ""}>
                    <SelectTrigger className="h-11 rounded-xl flex-1 bg-gray-50 dark:bg-gray-900"><SelectValue placeholder="Transport" /></SelectTrigger>
                    <SelectContent className="z-[10001]"><SelectItem value="client">Client</SelectItem><SelectItem value="own">Own</SelectItem></SelectContent>
                  </Select>
                  {orderData.details?.transportProvider === "own" && (
                    <Input className="h-11 rounded-xl flex-1" placeholder="Carrier Name" value={orderData.details?.transportProviderName || ""} onChange={(e) => setOrderData(prev => ({ ...prev, details: { ...prev.details!, transportProviderName: e.target.value } }))} />
                  )}
                </div>
                <Select onValueChange={handleWeightScaleChange} value={orderData.details?.weightScaleType || ''}>
                  <SelectTrigger className="h-11 rounded-xl bg-gray-50 dark:bg-gray-900"><SelectValue placeholder="Weight Scale" /></SelectTrigger>
                  <SelectContent className="z-[10001]"><SelectItem value="outside">Outside Scale</SelectItem><SelectItem value="inside">Inside Scale</SelectItem></SelectContent>
                </Select>
              </div>

              {/* SITE DELIVERY - ACCORDION STYLE */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsDeliveryInfoExpanded(!isDeliveryInfoExpanded)}
                  className="flex items-center justify-between w-full p-3 rounded-xl bg-gray-100/50 dark:bg-white/5 hover:bg-gray-200/50 transition-all"
                >
                  <span className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5" /> Site Delivery Details
                  </span>
                  {isDeliveryInfoExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {isDeliveryInfoExpanded && (
                  <div className="mt-3 animate-in fade-in slide-in-from-top-2">
                    <RichTextarea id="siteDeliveryInfo" value={orderData.details?.siteDeliveryInfo || ''} onChange={handleChange} rows={2} placeholder="Address, site contact, instructions..." className="rounded-xl" />
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div
                  className="group border-2 border-dashed border-gray-100 dark:border-white/10 rounded-2xl p-6 text-center hover:border-blue-500 hover:bg-blue-50 transition-all cursor-pointer bg-gray-50/50 dark:bg-white/5"
                  onDrop={(e) => handleDrop(e, (files) => setProductFiles((prev) => [...prev, ...files]))}
                >
                  <Input id="product-files" type="file" multiple className="hidden" onChange={handleFileChange} />
                  <Label htmlFor="product-files" className="cursor-pointer flex flex-col items-center gap-2">
                    <UploadCloud className="w-6 h-6 text-gray-300 group-hover:text-blue-500" />
                    <span className="text-[11px] font-bold text-gray-400">Upload Project Files</span>
                  </Label>
                </div>
                <div className="flex flex-wrap gap-2">
                  {productFiles.map((f, i) => (
                    <div key={i} className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-[9px] font-black flex items-center gap-2">
                      {f.name.toUpperCase()} <X className="w-3 h-3 cursor-pointer" onClick={() => removeFile(i)} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 4. BILLING */}
          <div className="p-4 sm:p-6 rounded-3xl border border-gray-100 dark:border-white/5 space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Billing & Finance</h4>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="md:col-span-8">
                <RichTextarea id="invoiceDetails" label="Invoice Notes" value={orderData.details?.invoiceDetails || ''} onChange={handleChange} rows={2} placeholder="e.g., *Due: 2025-06-30*, Payment Terms: 30 days. Balance: ₹{{100000 - 50000}}" className="rounded-xl" />
              </div>
              <div className="md:col-span-4 flex flex-col justify-start">
                <AudioManager
                  currentUser={currentUserProfile} identifier="new-order" identifierType="order"
                  uploadStage="invoiceVoiceNote" initialFiles={[]} editMode={true} stagingMode={true}
                  pendingFiles={invoiceAudioFiles} onFilesStaged={handleInvoiceAudioAdd} onFileRemoved={handleInvoiceAudioRemove}
                />
              </div>
            </div>
          </div>
        </div>

        {/* --- FOOTER: ACTION RIGHT --- */}
        <DialogFooter className="px-4 sm:px-8 py-5 border-t border-gray-100 dark:border-white/5 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl">
          <div className="flex w-full items-center justify-end gap-4">
            {uploadProgress.total > 0 && (
              <div className="bg-blue-50 p-3 rounded">
                <div className="text-sm font-medium">
                  Uploading: {uploadProgress.completed}/{uploadProgress.total}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {uploadProgress.current}
                </div>
              </div>
            )}
            <Button variant="ghost" onClick={handleClose} className="h-12 px-6 rounded-2xl font-bold text-gray-400">
              Cancel
            </Button>
            <div className="flex gap-2">
              {createdOrderDeoNo && (
                <Button onClick={() => { setCreatedOrderDeoNo(null); setIsRetryingFileUpload(false); }} variant="outline" className="h-12 rounded-2xl border-red-200 text-red-600 font-bold">
                  Reset
                </Button>
              )}
              <Button
                onClick={handleSubmit}
                disabled={isAddingOrder || isRetryingFileUpload}
                className={`h-12 px-8 rounded-2xl font-black text-xs tracking-widest shadow-xl transition-all active:scale-95 ${createdOrderDeoNo ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
              >
                {isAddingOrder ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : createdOrderDeoNo ? <Upload className="w-4 h-4 mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                {createdOrderDeoNo ? 'RETRY SYNC' : 'CREATE ORDER'}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export { RichTextarea };
