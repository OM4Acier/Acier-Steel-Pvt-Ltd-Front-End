"use client";

import React, { useState, useEffect, useCallback, useMemo, JSX, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ChevronDown, ChevronUp, MoreHorizontal, RefreshCw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


import {
  User as UserIcon, Info, CheckCircle, XCircle, Clock, Truck, Edit, Trash2,
  MoreVertical, Package, DollarSign, Phone, History, Loader2,
  LayoutGrid, LayoutList, Upload, File, Eye, X, ShoppingCart, Check, Ban
} from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { renderMarkdownText } from '@/components/markdownRenderer';
import { AuthUtils } from '@/lib/authHelpers';
import { RichTextarea } from '@/components/RichTextarea';
import { UserProfile, UserRole } from '@/types/rbac.types';
import { NavButton } from '@/components/NavButton';
import { NavbarExtension } from '@/context/NavbarExtensionContext';
import { usePermissionStore } from '@/stores/permission-store';

import { purchasesApi } from '@/lib/api/endpoints/purchasesApi';
const apiService = {
  fetchPurchases: () => purchasesApi.getPurchases(),
  addPurchase: (data: Partial<Purchase>) => purchasesApi.createPurchase(data),
  updatePurchase: (id: string, data: Partial<Purchase>, editor: any, description?: string) => {
    const historyEntry: EditHistoryEntry | undefined = description ? {
      timestamp: Date.now(),
      editorName: editor.name || editor.email || 'Unknown',
      description: description
    } : undefined;
    return purchasesApi.updatePurchase(id, data, historyEntry);
  },
  deletePurchase: (id: string) => purchasesApi.deletePurchase(id),
  uploadFile: (purchaseNo: string, stage: any, files: any) => purchasesApi.uploadFiles(purchaseNo, stage, files),
  deleteFile: (fileId: string) => purchasesApi.deleteFile(fileId),
  fetchRecentPurchaseNumber: () => purchasesApi.getRecentNumber(),
};

import {
  Purchase,
  PurchaseStatus,
  FileReference,
  EditHistoryEntry
} from '@/types/purchases.types';
import { useUser } from '@clerk/nextjs';

// --- File Compression and Conversion Utility ---

const compressAndConvertFile = (file: File): Promise<{ filename: string; mimeType: string; fileBase64: string }> => {
  return new Promise((resolve, reject) => {
    if (file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const base64String = (event.target?.result as string).split(',')[1];
        resolve({
          filename: file.name,
          mimeType: file.type,
          fileBase64: base64String,
        });
      };
      reader.onerror = (error) => reject(error);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        const JPEG_QUALITY = 0.8;

        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;

        ctx?.drawImage(img, 0, 0, width, height);

        let outputMimeType = file.type;
        const compressionQuality = JPEG_QUALITY;

        if (!['image/jpeg', 'image/webp'].includes(file.type)) {
          outputMimeType = file.type;
        }


        canvas.toBlob((blob) => {
          if (blob) {
            const readerBlob = new FileReader();
            readerBlob.readAsDataURL(blob);
            readerBlob.onloadend = () => {
              const base64String = (readerBlob.result as string).split(',')[1];
              resolve({
                filename: file.name,
                mimeType: outputMimeType,
                fileBase64: base64String,
              });
            };
          } else {
            reject(new Error('Canvas to Blob conversion failed.'));
          }
        }, outputMimeType, compressionQuality);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};
// --- Helper Functions for Role-Based Access ---
const isSuperAdmin = (role: UserRole | null) => role === 'super-admin';
const isPurchaseEntry = (role: UserRole | null) => role === 'purchase-entry';
const isOperations = (role: UserRole | null) => role === 'operations';
const isAccountant = (role: UserRole | null) => role === 'accountant';
const accessConfig = {
  roles: ['accountant'] as UserRole[],
  emails: ['suvarna@aciersteelpvtltd.com', 'test@gmail.com']
};

// --- Global Constants ---

// Mirroring colors from react-client-app's order statuses
const PURCHASE_STATUS_COLORS: { [key in PurchaseStatus]: string } = {
  'Pending': 'bg-sky-500', // Matches 'Order Created'
  'Approved': 'bg-green-500', // Matches 'Approved for Production'
  'Cancelled': 'bg-rose-600', // Matches 'Cancelled'
  'Invoiced': 'bg-amber-500', // Matches 'Dispatched and Invoiced'
  'Completed': 'bg-emerald-600', // Matches 'Completed'
};

const PURCHASE_STATUS_ICONS: { [key in PurchaseStatus]: JSX.Element } = {
  'Pending': <Clock className="w-4 h-4 mr-2" />,
  'Approved': <CheckCircle className="w-4 h-4 mr-2" />,
  'Cancelled': <XCircle className="w-4 h-4 mr-2" />,
  'Invoiced': <DollarSign className="w-4 h-4 mr-2" />,
  'Completed': <CheckCircle className="w-4 h-4 mr-2" />,
};


// --- Component: PurchaseCard ---
interface PurchaseCardProps {
  purchase: Purchase;
  onSelectPurchase: (purchase: Purchase) => void;
}

// --- Component: PurchaseCard ---
interface PurchaseCardProps {
  purchase: Purchase;
  onSelectPurchase: (purchase: Purchase) => void;
}

const PurchaseCard: React.FC<PurchaseCardProps> = React.memo(({ purchase, onSelectPurchase }) => {
  const statusColor = PURCHASE_STATUS_COLORS[purchase.status] || 'bg-gray-500';
  const statusIcon = PURCHASE_STATUS_ICONS[purchase.status] || <Info className="w-4 h-4 mr-2" />;

  return (
    <Card
      key={purchase.id}
      onClick={() => onSelectPurchase(purchase)}
      className="cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 min-w-[280px]"
    >
      <CardHeader className={`p-4 ${statusColor} text-white text-lg font-semibold flex items-center justify-between`}>
        <div className="flex items-center">
          {statusIcon}
          <span>{purchase.status}</span>
        </div>
        <Badge variant="outline" className="bg-white/80 dark:bg-gray-800/50 backdrop-blur-md border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-300 px-2 py-0.5 rounded-md shadow-sm">
          {purchase.purchaseNo}
        </Badge>
      </CardHeader>
      <CardContent className="p-4 space-y-3 text-gray-800 dark:text-gray-200">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-gray-100/80 dark:bg-gray-800/80 text-gray-600 dark:text-gray-400 shadow-inner">
            <UserIcon className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">Supplier</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">{purchase.supplierName}</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-gray-100/80 dark:bg-gray-800/80 text-gray-600 dark:text-gray-400 shadow-inner">
            <Phone className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">Contact</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 font-mono">{purchase.supplierContactNumber || 'N/A'}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});


// --- Reusable Collapsible Section Component ---
interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, children, defaultOpen = false, icon }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="space-y-3"> {/* Removed border and padding from here, now handled by parent div */}
      <div className="flex justify-between items-center cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
        <h3 className="font-semibold text-lg text-gray-900 dark:text-white flex items-center gap-2">
          {icon} {title}
        </h3>
        {isOpen ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
      </div>
      <div className={`transition-all duration-300 ease-out ${isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
        {children}
      </div>
    </div>
  );
};


// --- Component: PurchaseManagementPanel ---
// NOTE: In a larger application, this component would be split into smaller, more focused components
// to adhere to the Single Responsibility Principle and improve maintainability.
// State management would also likely be handled by a dedicated library (e.g., Zustand, React Context).
interface PurchaseManagementPanelProps {
  currentUser: UserProfile;
  isFetchingPurchases: boolean;
  fetchPurchases: () => void;
  purchaseError: string;
  purchases: Purchase[];
  setPurchases: React.Dispatch<React.SetStateAction<Purchase[]>>; // Added setPurchases
  viewMode: 'grouped' | 'grid';
  setViewMode: (mode: 'grouped' | 'grid') => void;
  NewPurchaseDialog: boolean;
  setIsNewPurchaseDialogOpen: (open: boolean) => void; // Added for dialog control
}

const PurchaseManagementPanel: React.FC<PurchaseManagementPanelProps> = ({
  currentUser,
  isFetchingPurchases,
  fetchPurchases,
  purchaseError,
  purchases,
  viewMode,
  NewPurchaseDialog,
  setIsNewPurchaseDialogOpen: setIsNewPurchaseDialogOpenProp // Renamed to avoid confusion
}) => {
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [isNewPurchaseDialogOpen, setIsNewPurchaseDialogOpen] = useState<boolean>(NewPurchaseDialog);
  const [isPurchaseDetailsDialogOpen, setIsPurchaseDetailsDialogOpen] = useState<boolean>(false);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState<boolean>(false);
  const [purchaseToDelete, setPurchaseToDelete] = useState<Purchase | null>(null);
  const [isCancelPurchaseDialogOpen, setIsCancelPurchaseDialogOpen] = useState<boolean>(false);
  const [isMoreActionsDialogOpen, setIsMoreActionsDialogOpen] = useState<boolean>(false);

  // Purchase Entry Form State
  const [newPurchaseData, setNewPurchaseData] = useState<Partial<Purchase>>({
    purchaseNo: '', // Added for manual entry
    supplierName: '',
    productInfo: '',
    invoiceInfo: '', // New field
  });
  const [newPurchaseAttachments, setNewPurchaseAttachments] = useState<File[]>([]); // Raw files selected for new purchase
  // Removed newPurchaseFileInputRef

  const [uploadingNewPurchaseAttachments, setUploadingNewPurchaseAttachments] = useState<boolean>(false);

  // Edit states for current selected purchase
  const [editedPurchaseData, setEditedPurchaseData] = useState<Partial<Purchase>>({});
  const [currentAttachments, setCurrentAttachments] = useState<FileReference[]>([]);
  const [currentUnloadingPhotos, setCurrentUnloadingPhotos] = useState<FileReference[]>([]);
  const [currentInvoiceFiles, setCurrentInvoiceFiles] = useState<FileReference[]>([]);
  const [selectedAttachments, setSelectedAttachments] = useState<File[]>([]);
  const [selectedUnloadingPhotos, setSelectedUnloadingPhotos] = useState<File[]>([]);
  const [selectedInvoiceFiles, setSelectedInvoiceFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<boolean>(false);
  const [showEditHistory, setShowEditHistory] = useState<boolean>(false);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null); // New state for animation

  // State for recent purchase numbers
  const [recentPurchaseNo, setRecentPurchaseNo] = useState<string | null>(null);
  const [nextPurchaseNo, setNextPurchaseNo] = useState<string | null>(null);
  const [fetchingPurchaseNumbers, setFetchingPurchaseNumbers] = useState<boolean>(false);

  // Remarks for Cancelled status
  const [cancelRemarks, setCancelRemarks] = useState<string>('');
  const fileInputRefs = {
    attachments: useRef<HTMLInputElement | null>(null),
    unloadingPhotos: useRef<HTMLInputElement | null>(null),
    invoiceFiles: useRef<HTMLInputElement | null>(null),
  };

  // Sync external dialog state with internal state
  useEffect(() => {
    setIsNewPurchaseDialogOpen(NewPurchaseDialog);
  }, [NewPurchaseDialog]);

  // Sync internal dialog state changes back to parent
  useEffect(() => {
    setIsNewPurchaseDialogOpenProp(isNewPurchaseDialogOpen);
  }, [isNewPurchaseDialogOpen, setIsNewPurchaseDialogOpenProp]);

  // Function to handle opening purchase details
  const handleSelectPurchase = useCallback((purchase: Purchase) => {
    setSelectedPurchase(purchase);
    setEditedPurchaseData({ ...purchase }); // Initialize edited data immediately
    setCurrentAttachments(purchase.attachments || []);
    setCurrentUnloadingPhotos(purchase.unloadingPhotos || []);
    setCurrentInvoiceFiles(purchase.invoiceFiles || []);
    setIsEditMode(false); // Always start in view mode
    setIsPurchaseDetailsDialogOpen(true);
    setCancelRemarks(''); // Clear remarks
  }, []); // Dependencies are stable

  // Effect to re-sync edited data when dialog opens or selectedPurchase changes
  // This is a fallback to ensure consistency if direct updates are missed or out of sync.
  useEffect(() => {
    if (isPurchaseDetailsDialogOpen && selectedPurchase) {
      const latestSelected = purchases.find(p => p.id === selectedPurchase.id);
      if (latestSelected) {
        setSelectedPurchase(latestSelected); // Update selectedPurchase with the latest data
        setEditedPurchaseData({ ...latestSelected }); // Re-initialize edited data
        setCurrentAttachments(latestSelected.attachments || []);
        setCurrentUnloadingPhotos(latestSelected.unloadingPhotos || []);
        setCurrentInvoiceFiles(latestSelected.invoiceFiles || []);
      } else {
        // If the selected purchase is no longer in the main 'purchases' array (e.g., deleted by another user),
        // or if there's a data inconsistency, re-fetch all to ensure integrity.
        fetchPurchases();
        setSelectedPurchase(null); // Clear selected to prevent errors
        setEditedPurchaseData({});
        setIsPurchaseDetailsDialogOpen(false); // Close dialog as data is no longer valid
      }
    }
  }, [isPurchaseDetailsDialogOpen, selectedPurchase, purchases, fetchPurchases]);

  // --- File Upload Logic ---
  const MAX_FILE_SIZE_MB = 20;
  const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, stage: 'attachments' | 'unloadingPhotos' | 'invoiceFiles', isNewEntry: boolean = false) => {
    const files = Array.from(event.target.files || []);
    const validFiles = files.filter(file => {
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        toast.error(`File ${file.name} is too large (max ${MAX_FILE_SIZE_MB}MB).`);
        return false;
      }
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        toast.error(`File ${file.name} has an unsupported type. Only PDF, JPG, PNG, WEBP are allowed.`);
        return false;
      }
      return true;
    });

    if (isNewEntry) {
      if (stage === 'attachments') setNewPurchaseAttachments(prev => [...prev, ...validFiles]);
    } else {
      if (stage === 'unloadingPhotos') setSelectedUnloadingPhotos(prev => [...prev, ...validFiles]);
      else if (stage === 'invoiceFiles') setSelectedInvoiceFiles(prev => [...prev, ...validFiles]);
      else if (stage === 'attachments') setSelectedAttachments(prev => [...prev, ...validFiles]);
    }
    // Clear the input value using ref (safer and more persistent)
    if (fileInputRefs[stage].current) {
      fileInputRefs[stage].current.value = '';
    }
  };

  const removeSelectedFile = (index: number, stage: 'attachments' | 'unloadingPhotos' | 'invoiceFiles', isNewEntry: boolean = false) => {
    if (isNewEntry) {
      if (stage === 'attachments') setNewPurchaseAttachments(prev => prev.filter((_, i) => i !== index));
    } else {
      if (stage === 'unloadingPhotos') setSelectedUnloadingPhotos(prev => prev.filter((_, i) => i !== index));
      else if (stage === 'invoiceFiles') setSelectedInvoiceFiles(prev => prev.filter((_, i) => i !== index));
      else if (stage === 'attachments') setSelectedAttachments(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleDeleteUploadedFile = async (fileId: string, stage: 'attachments' | 'unloadingPhotos' | 'invoiceFiles') => {
    if (!selectedPurchase || !currentUser || !currentUser) {
      toast.error('No purchase selected or not authenticated.');
      return;
    }
    toast.info(`Deleting file...${stage}`);
    setDeletingFileId(fileId); // Set file for animation

    try {
      const response = await apiService.deleteFile(fileId);
      if (response.success) {
        toast.success('File deleted successfully!');


        setTimeout(async () => { // Make the setTimeout callback async
          // Instead of atomic update, re-fetch all purchases to guarantee consistency
          await fetchPurchases();
          // After re-fetch, re-select the purchase to update dialog state
          const latestPurchase = purchases.find(p => p.id === selectedPurchase.id);
          if (latestPurchase) {
            setSelectedPurchase(latestPurchase);
            setEditedPurchaseData({ ...latestPurchase });
            setCurrentAttachments(latestPurchase.attachments || []);
            setCurrentUnloadingPhotos(latestPurchase.unloadingPhotos || []);
            setCurrentInvoiceFiles(latestPurchase.invoiceFiles || []);
          } else {
            // If the purchase itself was somehow deleted, close the dialog
            setIsPurchaseDetailsDialogOpen(false);
            setSelectedPurchase(null);
            setEditedPurchaseData({});
          }
          setDeletingFileId(null); // Reset deleting file ID
        }, 300); // Match CSS transition duration
      } else {
        throw new Error(response.message || "File deletion failed on server.");
      }
    } catch (error: any) {
      toast.error(`Failed to delete file: ${error.message}`);
      setDeletingFileId(null); // Reset deleting file ID on error
    }
  };


  // --- Purchase Entry Form Actions ---
  const handleNewPurchaseChange = (id: string, value: string | number) => {
    setNewPurchaseData(prev => ({ ...prev, [id]: value }));
  };

  const handleEditPurchaseChange = (id: string, value: string | number) => {
    setEditedPurchaseData(prev => ({
      ...prev,
      [id]: value,
    }));
  };

  const handleAddNewPurchase = async () => {
    if (!currentUser) {
      toast.error('Please log in to create a purchase.');
      return;
    }
    if (!newPurchaseData.purchaseNo || !newPurchaseData.supplierName || !newPurchaseData.productInfo) {
      toast.error('Please fill all required fields: Purchase No., Supplier Name, Product Info.');
      return;
    }
    if (newPurchaseData.purchaseNo.length < 3) {
      toast.error('Purchase No. must be at least 3 characters long.');
      return;
    }
    if (newPurchaseData.supplierContactNumber && !/^\d{10}$/.test(newPurchaseData.supplierContactNumber)) {
      toast.error('Supplier Contact Number must be a 10-digit number if provided.');
      return;
    }

    setUploadingNewPurchaseAttachments(true); // Use this for overall submission loading
    toast.info('Creating new purchase...');

    try {
      // 1. Create the purchase first without attachments
      const createdPurchase = await apiService.addPurchase({
        purchaseNo: newPurchaseData.purchaseNo!, // Now passed manually
        supplierName: newPurchaseData.supplierName!,
        supplierContactNumber: newPurchaseData.supplierContactNumber,
        productInfo: newPurchaseData.productInfo!,
        invoiceInfo: newPurchaseData.invoiceInfo, // Include new invoiceInfo
      });

      // 2. If there are new attachments selected, upload them
      if (newPurchaseAttachments.length > 0) {
        const filesDataForApi = await Promise.all(newPurchaseAttachments.map(compressAndConvertFile));

        const uploadResponse = await apiService.uploadFile(createdPurchase.purchaseNo, 'purchase-product', filesDataForApi);

        if (uploadResponse.success && uploadResponse.uploadedFiles.length > 0) {
          toast.success(`Product attachments uploaded for new purchase.`);
          // Now update the purchase record with the new file references
          await apiService.updatePurchase(
            createdPurchase.id,
            { attachments: uploadResponse.uploadedFiles }, // Update with new file references
            currentUser,
            `Product attachments added: ${uploadResponse.uploadedFiles.map(f => f.filename).join(', ')}`
          );
          toast.success(`Purchase ${createdPurchase.purchaseNo} created successfully!`);
        } else {
          toast.warning(`Purchase ${createdPurchase.purchaseNo} created, but no product attachments were uploaded.`);
        }
      } else {
        toast.success(`Purchase ${createdPurchase.purchaseNo} created successfully!`);
      }

      // After successful creation and any file uploads, re-fetch all purchases
      await fetchPurchases();

      setIsNewPurchaseDialogOpen(false);
      setNewPurchaseData({
        purchaseNo: '',
        supplierName: '',
        supplierContactNumber: '',
        productInfo: '',
        invoiceInfo: '', // Reset new invoiceInfo
      });
      setNewPurchaseAttachments([]); // Clear selected files for new purchase
    } catch (error: any) {
      toast.error(`Failed to create purchase: ${error.message}`);
    } finally {
      setUploadingNewPurchaseAttachments(false);
    }
  };

  // A. Standalone function to just fetch/refresh the numbers
  const refreshPurchaseNumber = useCallback(async () => {
    setFetchingPurchaseNumbers(true);
    try {
      const { recentPurchaseNo: fetchedRecent, nextPurchaseNo: fetchedNext } =
        await apiService.fetchRecentPurchaseNumber();

      setRecentPurchaseNo(fetchedRecent);
      setNextPurchaseNo(fetchedNext);

      // Update the form data specifically with the new number
      // We use 'prev' to ensure we don't wipe out other data user might have typed
      setNewPurchaseData(prev => ({
        ...prev,
        purchaseNo: fetchedNext,
      }));

      // Optional: Add a subtle success toast if manually triggered
      // toast.success("Purchase number updated");

    } catch (error: any) {
      toast.error(`Failed to fetch purchase number: ${error.message}`);
      // Don't nullify existing state on error, just warn the user
    } finally {
      setFetchingPurchaseNumbers(false);
    }
  }, [currentUser]);


  // B. The Main Handler (Resets form -> Opens Dialog -> Calls Fetch)

  // --- Purchase Approval Actions ---
  const handleApprovePurchase = async (purchase: Purchase) => {
    // SECURITY NOTE: Client-side role checks are for UI/UX only. Server-side authorization is crucial for security.
    if (!currentUser || !isSuperAdmin(currentUser.role)) {
      toast.error('Unauthorized to approve purchases.');
      return;
    }
    toast.info(`Approving purchase ${purchase.purchaseNo}...`);
    try {
      await apiService.updatePurchase(
        purchase.id,
        { status: 'Approved' }, // Only update status here
        currentUser,
        `Purchase approved by ${currentUser.name || currentUser.email}.`
      );
      toast.success(`Purchase ${purchase.purchaseNo} approved!`);
      await fetchPurchases(); // Re-fetch all purchases
      setIsPurchaseDetailsDialogOpen(false); // Close dialog after action
    } catch (error: any) {
      toast.error(`Failed to approve purchase: ${error.message}`);
    }
  };

  const handleCancelPurchaseSubmit = async () => {
    // SECURITY NOTE: Client-side role checks are for UI/UX only. Server-side authorization is crucial for security.
    if (!selectedPurchase || !currentUser || !isSuperAdmin(currentUser.role)) {
      toast.error('Unauthorized to cancel purchases.');
      return;
    }
    toast.info(`Cancelling purchase ${selectedPurchase.purchaseNo}...`);
    try {
      await apiService.updatePurchase(
        selectedPurchase.id,
        { status: 'Cancelled', cancellationRemarks: cancelRemarks || 'No remarks provided.' },
        currentUser,
        `Purchase cancelled by ${currentUser.name || currentUser.email}. Remarks: ${cancelRemarks || 'No remarks provided.'}`
      );
      toast.success(`Purchase ${selectedPurchase.purchaseNo} cancelled!`);
      await fetchPurchases(); // Re-fetch all purchases
      setCancelRemarks('');
      setIsCancelPurchaseDialogOpen(false); // Close cancel dialog
      setIsPurchaseDetailsDialogOpen(false); // Close details dialog
    } catch (error: any) {
      toast.error(`Failed to cancel purchase: ${error.message}`);
    }
  };

  // --- Edit Purchase Logic ---
  // --- Edit Purchase Logic ---
  const handleSaveEditedPurchase = async () => {
    if (!selectedPurchase || !currentUser) {
      toast.error('No purchase selected or not authenticated.');
      return;
    }

    // Validate contact number if provided
    if (editedPurchaseData.supplierContactNumber && !/^\d{10}$/.test(editedPurchaseData.supplierContactNumber)) {
      toast.error('Supplier Contact Number must be a 10-digit number if provided.');
      return;
    }

    // Determine if the current user role has permission to edit at this stage
    const currentStatus = selectedPurchase.status;
    let canEdit = false;
    if (isSuperAdmin(currentUser.role)) {
      canEdit = true; // Super Admin can edit any stage
    } else if ((AuthUtils.canAccess(currentUser, accessConfig) || isPurchaseEntry(currentUser.role)) && currentStatus === 'Pending') {
      canEdit = true;
    } else if (isOperations(currentUser.role) && currentStatus === 'Approved') {
      canEdit = true;
    } else if (isAccountant(currentUser.role) && currentStatus === 'Invoiced') {
      canEdit = true;
    }

    if (!canEdit) {
      toast.error('You do not have permission to edit this purchase at its current stage.');
      return;
    }

    setUploadingFiles(true); // Start loading state

    try {
      // --- Step 1: Save text field changes if any ---
      const changes = [];
      // Track changes for history
      if (editedPurchaseData.supplierName !== selectedPurchase.supplierName) changes.push(`Supplier Name to '${editedPurchaseData.supplierName}'`);
      if (editedPurchaseData.supplierContactNumber !== selectedPurchase.supplierContactNumber) changes.push(`Supplier Contact No. to '${editedPurchaseData.supplierContactNumber}'`);
      if (editedPurchaseData.productInfo !== selectedPurchase.productInfo) changes.push(`Product details updated`);
      if (editedPurchaseData.invoiceInfo !== selectedPurchase.invoiceInfo) changes.push(`Invoice info updated`);
      if (editedPurchaseData.vehicleNumber !== selectedPurchase.vehicleNumber) changes.push(`Vehicle No. to '${editedPurchaseData.vehicleNumber}'`);
      if (editedPurchaseData.invoiceDate !== selectedPurchase.invoiceDate) changes.push(`Invoice Date to '${editedPurchaseData.invoiceDate}'`);
      if (editedPurchaseData.invoiceNumber !== selectedPurchase.invoiceNumber) changes.push(`Invoice No. to '${editedPurchaseData.invoiceNumber}'`);

      // Handle Status Update for Super Admin
      if (isSuperAdmin(currentUser.role) && editedPurchaseData.status && editedPurchaseData.status !== selectedPurchase.status) {
        changes.push(`Status to '${editedPurchaseData.status}'`);
      }

      // Only call update API if there are actual changes (text or status)
      if (changes.length > 0) {
        toast.info('Saving changes...');

        const fieldsToUpdate: Partial<Purchase> = { ...editedPurchaseData };

        // Ensure status is not changed unless allowed
        if (!isSuperAdmin(currentUser.role)) {
          delete fieldsToUpdate.status;
        }

        delete fieldsToUpdate.purchaseNo;
        // IMPORTANT: Do NOT send file-related data fields when updating general information
        delete fieldsToUpdate.attachments;
        delete fieldsToUpdate.unloadingPhotos;
        delete fieldsToUpdate.invoiceFiles;
        delete (fieldsToUpdate as any).__v;

        const description = `Purchase details updated: ${changes.join('; ')}`;

        await apiService.updatePurchase(
          selectedPurchase.id,
          fieldsToUpdate,
          currentUser,
          description
        );
        toast.success('Changes saved.');
      }

      // --- Step 2: Upload files sequentially ---

      // 2a. Product Attachments
      if (selectedAttachments.length > 0) {
        toast.info(`Uploading ${selectedAttachments.length} product file(s)...`);
        const filesDataForApi = await Promise.all(selectedAttachments.map(compressAndConvertFile));
        const uploadResponse = await apiService.uploadFile(selectedPurchase.purchaseNo, 'purchase-product', filesDataForApi);

        if (uploadResponse.success && uploadResponse.uploadedFiles.length > 0) {
          // Append new files to existing ones for the record update
          const currentFiles = selectedPurchase.attachments || [];
          const newFiles = uploadResponse.uploadedFiles;

          await apiService.updatePurchase(
            selectedPurchase.id,
            { attachments: [...currentFiles, ...newFiles] },
            currentUser,
            `Product attachments added: ${newFiles.map(f => f.filename).join(', ')}`
          );
          toast.success('Product files uploaded.');
        }
      }

      // 2b. Vehicle Unloading Photos
      if (selectedUnloadingPhotos.length > 0) {
        toast.info(`Uploading ${selectedUnloadingPhotos.length} vehicle photo(s)...`);
        const filesDataForApi = await Promise.all(selectedUnloadingPhotos.map(compressAndConvertFile));
        const uploadResponse = await apiService.uploadFile(selectedPurchase.purchaseNo, 'purchase-vehicle', filesDataForApi);

        if (uploadResponse.success && uploadResponse.uploadedFiles.length > 0) {
          // We need to fetch the LATEST state of the purchase because Step 2a might have updated it.
          // However, for simplicity and since we are updating different fields, we can use the 'selectedPurchase' 
          // BUT 'selectedPurchase' is stale if we don't refetch. 
          // Actually, since we are just appending to a specific field that wasn't touched by 2a, 
          // we just need to make sure we don't overwrite other fields. 
          // The updatePurchase implementation in this file sends a PATCH-like update (only the fields in payload).
          // So it is safe to just send { unloadingPhotos: ... }.
          // BUT we need the CURRENT existing unloadingPhotos. 
          // 'selectedPurchase.unloadingPhotos' is from the beginning of the edit session. 
          // This is fine as long as no one else added photos in the meantime.

          const currentFiles = selectedPurchase.unloadingPhotos || [];
          const newFiles = uploadResponse.uploadedFiles;

          await apiService.updatePurchase(
            selectedPurchase.id,
            { unloadingPhotos: [...currentFiles, ...newFiles] },
            currentUser,
            `Vehicle unloading photos added: ${newFiles.map(f => f.filename).join(', ')}`
          );
          toast.success('Vehicle photos uploaded.');
        }
      }

      // 2c. Invoice Files
      if (selectedInvoiceFiles.length > 0) {
        toast.info(`Uploading ${selectedInvoiceFiles.length} invoice file(s)...`);
        const filesDataForApi = await Promise.all(selectedInvoiceFiles.map(compressAndConvertFile));
        const uploadResponse = await apiService.uploadFile(selectedPurchase.purchaseNo, 'purchase-invoice', filesDataForApi);

        if (uploadResponse.success && uploadResponse.uploadedFiles.length > 0) {
          const currentFiles = selectedPurchase.invoiceFiles || [];
          const newFiles = uploadResponse.uploadedFiles;

          await apiService.updatePurchase(
            selectedPurchase.id,
            { invoiceFiles: [...currentFiles, ...newFiles] },
            currentUser,
            `Invoice files added: ${newFiles.map(f => f.filename).join(', ')}`
          );
          toast.success('Invoice files uploaded.');
        }
      }

      // --- Step 3: Fetch fresh data from server ---
      await fetchPurchases();

      // --- Step 4: Cleanup and exit edit mode ---
      setSelectedAttachments([]);
      setSelectedUnloadingPhotos([]);
      setSelectedInvoiceFiles([]);
      setIsEditMode(false);
      toast.success('All updates completed successfully!');

    } catch (error: any) {
      toast.error(`Failed to save changes: ${error.message}`);
    } finally {
      setUploadingFiles(false);
    }
  };

  // --- New Transition Functions ---
  const handleTransitionToInvoiced = async () => {
    // SECURITY NOTE: Client-side role checks are for UI/UX only. Server-side authorization is crucial for security.
    if (!selectedPurchase || !currentUser) {
      toast.error('No purchase selected or not authenticated.');
      return;
    }

    // Check permissions
    if (!(isOperations(currentUser.role) || isSuperAdmin(currentUser.role))) {
      toast.error('You do not have permission to transition this purchase to Invoiced.');
      return;
    }

    // Check validation for transition
    if (!editedPurchaseData.vehicleNumber) {
      toast.error('Vehicle Number is required to move to Invoiced status.');
      return;
    }
    if (currentUnloadingPhotos.length === 0) { // Added check for unloading photos
      toast.error('At least one Vehicle Unloading Photo is required to move to Invoiced status.');
      return;
    }

    toast.info(`Transitioning purchase ${selectedPurchase.purchaseNo} to Invoiced...`);
    try {
      await apiService.updatePurchase(
        selectedPurchase.id,
        {
          status: 'Invoiced',
          vehicleNumber: editedPurchaseData.vehicleNumber,
        },
        currentUser,
        `Purchase transitioned to Invoiced by ${currentUser.name || currentUser.email}.`
      );
      toast.success(`Purchase ${selectedPurchase.purchaseNo} moved to Invoiced!`);
      await fetchPurchases(); // Re-fetch all purchases
      setIsEditMode(false); // Exit edit mode after transition
      setIsPurchaseDetailsDialogOpen(false); // Close dialog
    } catch (error: any) {
      toast.error(`Failed to transition to Invoiced: ${error.message}`);
    }
  };

  const handleTransitionToCompleted = async () => {
    // SECURITY NOTE: Client-side role checks are for UI/UX only. Server-side authorization is crucial for security.
    if (!selectedPurchase || !currentUser) {
      toast.error('No purchase selected or not authenticated.');
      return;
    }

    // Check permissions
    if (!(isAccountant(currentUser.role) || isSuperAdmin(currentUser.role))) {
      toast.error('You do not have permission to mark this purchase as Completed.');
      return;
    }

    // Check validation for transition
    if (!editedPurchaseData.invoiceDate || !editedPurchaseData.invoiceNumber) {
      toast.error('Invoice Date and Invoice Number are required to mark as Completed.');
      return;
    }
    if (currentInvoiceFiles.length === 0) {
      toast.error('At least one Invoice Document is required to mark as Completed.');
      return;
    }

    toast.info(`Marking purchase ${selectedPurchase.purchaseNo} as Completed...`);
    try {
      await apiService.updatePurchase(
        selectedPurchase.id,
        {
          status: 'Completed',
          invoiceDate: editedPurchaseData.invoiceDate,
          invoiceNumber: editedPurchaseData.invoiceNumber,
          // invoiceFiles are already managed by upload/delete functions, so no need to pass them here again
        },
        currentUser,
        `Purchase details updated by ${currentUser.name || currentUser.email}.`
      );
      toast.success(`Purchase ${selectedPurchase.purchaseNo} marked as Completed!`);
      await fetchPurchases(); // Re-fetch all purchases
      setIsEditMode(false); // Exit edit mode after transition
      setIsPurchaseDetailsDialogOpen(false); // Close dialog
    } catch (error: any) {
      toast.error(`Failed to mark as Completed: ${error.message}`);
    }
  };

  // --- Delete Purchase ---
  const openConfirmDeleteDialog = (purchase: Purchase) => {
    setPurchaseToDelete(purchase);
    setIsConfirmDeleteDialogOpen(true);
    setIsMoreActionsDialogOpen(false); // Close more actions dialog
  };

  const handleDeletePurchase = async () => {
    // SECURITY NOTE: Client-side role checks are for UI/UX only. Server-side authorization is crucial for security.
    if (!purchaseToDelete || !currentUser || !isSuperAdmin(currentUser.role)) {
      toast.error('Unauthorized to delete purchases.');
      return;
    }
    toast.info(`Deleting purchase ${purchaseToDelete.purchaseNo}...`);
    try {
      await apiService.deletePurchase(purchaseToDelete.id);
      toast.success(`Purchase ${purchaseToDelete.purchaseNo} deleted.`);
      await fetchPurchases(); // Re-fetch all purchases
      setIsConfirmDeleteDialogOpen(false);
      setIsPurchaseDetailsDialogOpen(false); // Close details dialog if open
      setSelectedPurchase(null); // Clear selected purchase
    } catch (error: any) {
      toast.error(`Failed to delete purchase: ${error.message}`);
    }
  };

  // --- Read-only display helper for compactness ---

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('border-blue-500', 'bg-blue-50', 'dark:bg-gray-700');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50', 'dark:bg-gray-700');
  };

  const handleDrop = (e: React.DragEvent, stage: 'attachments' | 'unloadingPhotos' | 'invoiceFiles', isNewEntry: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50', 'dark:bg-gray-700');

    const files = Array.from(e.dataTransfer.files);
    const mockEvent = { target: { files: files } } as unknown as React.ChangeEvent<HTMLInputElement>;
    handleFileChange(mockEvent, stage, isNewEntry);
  };


  // --- Conditional Rendering Logic for Sections ---
  const renderPurchaseEntryForm = (isCurrentEditMode: boolean, purchaseData: Partial<Purchase>, isNewEntry: boolean = false) => {
    // Purchase Entry Details edit permissions
    const canEditPurchaseEntryDetails = isCurrentEditMode && (
      isNewEntry ||
      isSuperAdmin(currentUser.role) ||
      ((isPurchaseEntry(currentUser.role) || AuthUtils.canAccess(currentUser, accessConfig)) && purchaseData.status === 'Pending')
    );




    return (
      <div className="space-y-4">
        {/* Purchase No. - Only editable for new entry, otherwise handled in dialog header */}
        {!isNewEntry && ( // Only show this if not a new entry (it's in the dialog header for new)
          <div className="flex items-center gap-2">
            <Label htmlFor="purchaseNo" className="font-medium text-sm whitespace-nowrap">Purchase No.:</Label>
            <span className="ml-2 text-gray-800 dark:text-gray-200 break-words text-sm">{purchaseData.purchaseNo || 'N/A'}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Label htmlFor="supplierName" className="font-medium text-sm whitespace-nowrap">Supplier Name:</Label>
          {canEditPurchaseEntryDetails ? (
            <Input id="supplierName" value={isNewEntry ? newPurchaseData.supplierName || '' : purchaseData.supplierName || ''} onChange={(e) => isNewEntry ? handleNewPurchaseChange(e.target.id, e.target.value) : handleEditPurchaseChange(e.target.id, e.target.value)} placeholder="e.g., Vendor A" required className="flex-grow" />
          ) : (
            <span className="text-gray-800 dark:text-gray-200 break-words text-sm">{purchaseData.supplierName || 'N/A'}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="supplierContactNumber" className="font-medium text-sm whitespace-nowrap">Contact Number:</Label>
          {canEditPurchaseEntryDetails ? (
            <Input id="supplierContactNumber" type="tel" value={isNewEntry ? newPurchaseData.supplierContactNumber || '' : purchaseData.supplierContactNumber || ''} onChange={(e) => isNewEntry ? handleNewPurchaseChange(e.target.id, e.target.value) : handleEditPurchaseChange(e.target.id, e.target.value)} placeholder="e.g., 9876543210" maxLength={10} className="flex-grow" />
          ) : (
            <span className="text-gray-800 dark:text-gray-200 break-words text-sm">{purchaseData.supplierContactNumber || 'N/A'}</span>
          )}
        </div>

        <div className="space-y-2 border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50/50 dark:bg-gray-800/50">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-2">
            <Package className="w-5 h-5 text-blue-600" /> Product Info
          </h4>
          {canEditPurchaseEntryDetails ? (
            <RichTextarea
              id="productInfo"
              label=""
              value={isNewEntry ? newPurchaseData.productInfo || '' : purchaseData.productInfo || ''}
              onChange={(e) => isNewEntry ? handleNewPurchaseChange(e.target.id, e.target.value) : handleEditPurchaseChange(e.target.id, e.target.value)}
              placeholder="e.g., **Grade**: HR Coil, **Thickness**: 2.5mm, **Width**: 1250mm"
              rows={4}
              className="w-full"
            />
          ) : (
            <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdownText(purchaseData.productInfo) }} />

          )}
        </div>

        {/* Status Dropdown for Super Admin */}
        {isCurrentEditMode && isSuperAdmin(currentUser.role) && (
          <div className="space-y-2 border border-amber-200 dark:border-amber-900/50 rounded-lg p-4 bg-amber-50/50 dark:bg-amber-900/10">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-2">
              <MoreHorizontal className="w-5 h-5 text-amber-600" /> Admin Controls
            </h4>
            <div className="flex items-center gap-2">
              <Label htmlFor="status" className="font-medium text-sm whitespace-nowrap">Override Status:</Label>
              <Select
                value={purchaseData.status}
                onValueChange={(value) => handleEditPurchaseChange('status', value)}
              >
                <SelectTrigger className="w-[200px] bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700">
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent className="z-[9050]">
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                  <SelectItem value="Invoiced">Invoiced</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <CollapsibleSection title={`Product Files (${isNewEntry ? newPurchaseAttachments.length : currentAttachments.length})`} icon={<File className="w-5 h-5" />}>
            {canEditPurchaseEntryDetails && (
              <div> {/* Changed from <> to <div> */}
                <div
                  className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center text-gray-500 dark:text-gray-400 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-gray-700 transition-all duration-200 cursor-pointer"
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, 'attachments', isNewEntry)}
                >
                  <Input
                    id="attachments"
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={(e) => handleFileChange(e, 'attachments', isNewEntry)}
                    ref={fileInputRefs.attachments}
                    className="hidden"
                  />
                  <Label htmlFor="attachments" className="cursor-pointer flex flex-col items-center">
                    <Upload className="w-8 h-8 mb-2" />
                    Drag & drop product files here, or <span className="text-blue-600 font-medium">click to browse</span>
                  </Label>
                </div>

                {(isNewEntry ? newPurchaseAttachments.length > 0 : selectedAttachments.length > 0) && (
                  <div className="space-y-2 mt-4">
                    <h5 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Selected for Upload:</h5>
                    <ul className="space-y-2">
                      {(isNewEntry ? newPurchaseAttachments : selectedAttachments).map((file, index) => (
                        <li key={index} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-2 rounded-md">
                          <span className="text-sm text-gray-700 dark:text-gray-300 truncate block">{file.name}</span>
                          <Button variant="ghost" size="sm" onClick={() => removeSelectedFile(index, 'attachments', isNewEntry)} className="text-red-500 hover:text-red-700">
                            <X className="w-4 h-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {currentAttachments.length > 0 && <div className="border-t border-gray-200 dark:border-gray-700 pt-4" />}
              </div>
            )}

            {currentAttachments.length > 0 ? (
              <div className="space-y-2">
                <h5 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Uploaded Product Files:</h5>
                <div className="grid grid-cols-1 gap-3">
                  {currentAttachments.map((file) => (
                    <div key={file.fileId} className={`flex items-center justify-between bg-green-50 dark:bg-green-950 p-2 rounded-md shadow-sm ${deletingFileId === file.fileId ? 'fade-out' : ''}`}>
                      <span className="text-sm font-medium text-green-800 dark:text-green-200 truncate block">{file.filename}</span>
                      <div className="flex items-center gap-2">
                        <a
                          href={`https://drive.google.com/file/d/${file.fileId}/preview`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                          title="Preview File"
                        >
                          <Eye className="w-5 h-5" />
                        </a>
                        {canEditPurchaseEntryDetails && ( // Allow delete if can edit
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUploadedFile(file.fileId, 'attachments')}
                            className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-600"
                            title="Delete File"
                            disabled={deletingFileId === file.fileId} // Disable button during animation
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
          </CollapsibleSection>
        </div>

        {/* NEW: Invoice Info Field for New Purchase Entry */}
        {isNewEntry && ( // Only show this section for new entries
          <div className="space-y-2 border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50/50 dark:bg-gray-800/50">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-2">
              <Info className="w-5 h-5 text-blue-600" /> Invoice Info
            </h4>
            {canEditPurchaseEntryDetails ? (
              <RichTextarea
                id="invoiceInfo"
                label=""
                value={newPurchaseData.invoiceInfo || ''}
                onChange={(e) => handleNewPurchaseChange(e.target.id, e.target.value)}
                placeholder="e.g., **Invoice details**: Payment terms, due date, additional notes."
                rows={4}
                className="w-full"
              />
            ) : (
              // This part won't be reached for new entry, but keeping for consistency if logic changes
              <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdownText(purchaseData.invoiceInfo) }} />
            )}
          </div>
        )}
      </div>
    );
  };

  // --- Render Vehicle + Coil Entry Form ---
  const renderVehicleCoilEntryForm = (isCurrentEditMode: boolean, purchaseData: Partial<Purchase>) => {
    // Operations can edit if it's their role AND status is 'Approved'
    // Super Admin can always edit this section if status is Approved or Invoiced
    const isEditable = isCurrentEditMode && (isSuperAdmin(currentUser.role) || (isOperations(currentUser.role) && purchaseData.status === 'Approved'));

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Label htmlFor="vehicleNumber" className="font-medium text-sm whitespace-nowrap">Vehicle Number:</Label>
          {isEditable ? (
            <Input id="vehicleNumber" value={purchaseData.vehicleNumber || ''} onChange={(e) => handleEditPurchaseChange(e.target.id, e.target.value)} placeholder="e.g., MH12AB1234" required className="flex-grow" />
          ) : (
            <span className="text-gray-800 dark:text-gray-200 break-words text-sm">{purchaseData.vehicleNumber || 'N/A'}</span>
          )}
        </div>
        {/* Removed Date/Time Arrival, Gross Weight, Tare Weight fields entirely as per new schema */}

        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <CollapsibleSection title={`Vehicle Unloading Photos (${currentUnloadingPhotos.length})`} icon={<File className="w-5 h-5" />}>
            {isEditable && (
              <div> {/* Changed from <> to <div> */}
                <div
                  className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center text-gray-500 dark:text-gray-400 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-gray-700 transition-all duration-200 cursor-pointer"
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, 'unloadingPhotos', false)}
                >
                  <Input
                    id="unloadingPhotos"
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={(e) => handleFileChange(e, 'unloadingPhotos', false)}
                    ref={fileInputRefs.unloadingPhotos}
                    className="hidden"
                  />
                  <Label htmlFor="unloadingPhotos" className="cursor-pointer flex flex-col items-center">
                    <Upload className="w-8 h-8 mb-2" />
                    Drag & drop photos here, or <span className="text-blue-600 font-medium">click to browse</span>
                  </Label>
                </div>

                {selectedUnloadingPhotos.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <h5 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Selected for Upload:</h5>
                    <ul className="space-y-2">
                      {selectedUnloadingPhotos.map((file, index) => (
                        <li key={index} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-2 rounded-md">
                          <span className="text-sm text-gray-700 dark:text-gray-300 truncate block">{file.name}</span>
                          <Button variant="ghost" size="sm" onClick={() => removeSelectedFile(index, 'unloadingPhotos')} className="text-red-500 hover:text-red-700">
                            <X className="w-4 h-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {currentUnloadingPhotos.length > 0 && <div className="border-t border-gray-200 dark:border-gray-700 pt-4" />}
              </div>
            )}

            {currentUnloadingPhotos.length > 0 ? (
              <div className="space-y-2">
                <h5 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Uploaded Vehicle Unloading Photos:</h5>
                <div className="grid grid-cols-1 gap-3">
                  {currentUnloadingPhotos.map((file) => (
                    <div key={file.fileId} className={`flex items-center justify-between bg-green-50 dark:bg-green-950 p-2 rounded-md shadow-sm ${deletingFileId === file.fileId ? 'fade-out' : ''}`}>
                      <span className="text-sm font-medium text-green-800 dark:text-green-200 truncate block">{file.filename}</span>
                      <div className="flex items-center gap-2">
                        <a
                          href={`https://drive.google.com/file/d/${file.fileId}/preview`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                          title="Preview File"
                        >
                          <Eye className="w-5 h-5" />
                        </a>
                        {isEditable && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUploadedFile(file.fileId, 'unloadingPhotos')}
                            className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-600"
                            title="Delete File"
                            disabled={deletingFileId === file.fileId} // Disable button during animation
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
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">No unloading photos uploaded.</p>
            )}
          </CollapsibleSection>
        </div>
      </div>
    );
  };

  // --- Render Invoice Upload & Verification Form ---
  const renderInvoiceForm = (isCurrentEditMode: boolean, purchaseData: Partial<Purchase>) => {
    // Accountant can edit if it's their role AND status is 'Invoiced'
    // Super Admin can always edit this section if status is Invoiced
    const isEditable = isCurrentEditMode && (isSuperAdmin(currentUser.role) || (isAccountant(currentUser.role) && purchaseData.status === 'Invoiced'));

    return (
      <div className="space-y-4">
        <div className="space-y-2 border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50/50 dark:bg-gray-800/50">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-2">
            <Info className="w-5 h-5 text-blue-600" /> Invoice Info
          </h4>
          {isEditable ? (
            <RichTextarea
              id="invoiceInfo"
              label=""
              value={purchaseData.invoiceInfo || ''}
              onChange={(e) => handleEditPurchaseChange(e.target.id, e.target.value)}
              placeholder="e.g., **Invoice details**: Payment terms, due date, additional notes."
              rows={4}
              className="w-full"
            />
          ) : (
            <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdownText(purchaseData.invoiceInfo) }} />
          )}
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="invoiceDate" className="font-medium text-sm whitespace-nowrap">Invoice Date:</Label>
          {isEditable ? (
            <Input id="invoiceDate" type="date" value={purchaseData.invoiceDate || ''} onChange={(e) => handleEditPurchaseChange(e.target.id, e.target.value)} required className="flex-grow" />
          ) : (
            <span className="text-gray-800 dark:text-gray-200 break-words text-sm">{purchaseData.invoiceDate || 'N/A'}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="invoiceNumber" className="font-medium text-sm whitespace-nowrap">Invoice Number:</Label>
          {isEditable ? (
            <Input id="invoiceNumber" value={purchaseData.invoiceNumber || ''} onChange={(e) => handleEditPurchaseChange(e.target.id, e.target.value)} placeholder="e.g., INV-2024-001" required className="flex-grow" />
          ) : (
            <span className="text-gray-800 dark:text-gray-200 break-words text-sm">{purchaseData.invoiceNumber || 'N/A'}</span>
          )}
        </div>
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <CollapsibleSection title={`Invoice Documents (${currentInvoiceFiles.length})`} icon={<File className="w-5 h-5" />}>
            {isEditable && (
              <div> {/* Changed from <> to <div> */}
                <div
                  className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center text-gray-500 dark:text-gray-400 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-gray-700 transition-all duration-200 cursor-pointer"
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, 'invoiceFiles', false)}
                >
                  <Input
                    id="invoiceFiles"
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={(e) => handleFileChange(e, 'invoiceFiles', false)}
                    ref={fileInputRefs.invoiceFiles}
                    className="hidden"
                  />
                  <Label htmlFor="invoiceFiles" className="cursor-pointer flex flex-col items-center">
                    <Upload className="w-8 h-8 mb-2" />
                    Drag & drop invoice files here, or <span className="text-blue-600 font-medium">click to browse</span>
                  </Label>
                </div>

                {selectedInvoiceFiles.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <h5 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Selected for Upload:</h5>
                    <ul className="space-y-2">
                      {selectedInvoiceFiles.map((file, index) => (
                        <li key={index} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-2 rounded-md">
                          <span className="text-sm text-gray-700 dark:text-gray-300 truncate block">{file.name}</span>
                          <Button variant="ghost" size="sm" onClick={() => removeSelectedFile(index, 'invoiceFiles')} className="text-red-500 hover:text-red-700">
                            <X className="w-4 h-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {currentInvoiceFiles.length > 0 && <div className="border-t border-gray-200 dark:border-gray-700 pt-4" />}
              </div>
            )}

            {currentInvoiceFiles.length > 0 ? (
              <div className="space-y-2">
                <h5 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Uploaded Invoice Documents:</h5>
                <div className="grid grid-cols-1 gap-3">
                  {currentInvoiceFiles.map((file) => (
                    <div key={file.fileId} className={`flex items-center justify-between bg-green-50 dark:bg-green-950 p-2 rounded-md shadow-sm ${deletingFileId === file.fileId ? 'fade-out' : ''}`}>
                      <span className="text-sm font-medium text-green-800 dark:text-green-200 truncate block">{file.filename}</span>
                      <div className="flex items-center gap-2">
                        <a
                          href={`https://drive.google.com/file/d/${file.fileId}/preview`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                          title="Preview File"
                        >
                          <Eye className="w-5 h-5" />
                        </a>
                        {isEditable && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUploadedFile(file.fileId, 'invoiceFiles')}
                            className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-600"
                            title="Delete File"
                            disabled={deletingFileId === file.fileId} // Disable button during animation
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
          </CollapsibleSection>
        </div>
      </div>
    );
  };

  // Filter purchases into new simplified statuses for grouped view
  const purchasesPending = useMemo(() => purchases.filter(p => p.status === 'Pending'), [purchases]);
  const approvedPurchases = useMemo(() => purchases.filter(p => p.status === 'Approved'), [purchases]);
  const invoicedPurchases = useMemo(() => purchases.filter(p => p.status === 'Invoiced'), [purchases]);
  const purchasesCompletedCancelled = useMemo(() => purchases.filter(p => p.status === 'Completed' || p.status === 'Cancelled'), [purchases]);

  // New useMemo for grouping completed/cancelled purchases by date
  const groupedCompletedCancelledPurchases = useMemo(() => {
    const grouped: { [key: string]: Purchase[] } = {};
    purchasesCompletedCancelled.forEach(purchase => {
      // Use 'updatedAt' for completion/cancellation date
      const date = new Date(purchase.updatedAt);
      const year = date.getFullYear();
      const month = date.toLocaleString('default', { month: 'long' });
      const day = date.getDate().toString().padStart(2, '0'); // Get day and pad with leading zero if single digit
      const groupKey = `${day} ${month} ${year}`; // e.g., "21 July 2025"

      if (!grouped[groupKey]) {
        grouped[groupKey] = [];
      }
      grouped[groupKey].push(purchase);
    });

    // Sort purchases within each group by updatedAt (most recent first)
    for (const key in grouped) {
      grouped[key].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }

    // Sort group keys (dates) in descending order (most recent day/month/year first)
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
      // Parse "DD Month YYYY" string back to Date objects for comparison
      const parseDateString = (dateString: string) => {
        const [dayStr, monthStr, yearStr] = dateString.split(' ');
        const monthNum = new Date(Date.parse(monthStr + " 1, 2000")).getMonth(); // Get month number from month name
        return new Date(parseInt(yearStr), monthNum, parseInt(dayStr));
      };
      const dateA = parseDateString(a);
      const dateB = parseDateString(b);
      return dateB.getTime() - dateA.getTime();
    });

    const sortedGrouped: { [key: string]: Purchase[] } = {};
    sortedKeys.forEach(key => {
      sortedGrouped[key] = grouped[key];
    });

    return sortedGrouped;
  }, [purchasesCompletedCancelled]);


  const gridLayoutClasses = 'grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3';

  // Determine if save button should be disabled
  const isSaveButtonDisabled = useMemo(() => {
    if (!selectedPurchase || !isEditMode || uploadingFiles) return true;

    // Validate contact number if provided
    if (editedPurchaseData.supplierContactNumber && !/^\d{10}$/.test(editedPurchaseData.supplierContactNumber)) {
      return true;
    }

    // Check if the current user role has permission to edit at this stage
    const currentStatus = selectedPurchase.status;
    let canEditAnySection = false;
    if (isSuperAdmin(currentUser.role)) {
      canEditAnySection = true;
    }
    else if ((isPurchaseEntry(currentUser.role) || AuthUtils.canAccess(currentUser, accessConfig)) && currentStatus === 'Pending') {
      canEditAnySection = true;
    } else if (isOperations(currentUser.role) && currentStatus === 'Approved') {
      canEditAnySection = true; // Corrected from `canEdit = true`
    } else if (isAccountant(currentUser.role) && currentStatus === 'Invoiced') {
      canEditAnySection = true;
    }
    return !canEditAnySection; // Disable save if user doesn't have permission to edit any section
  }, [selectedPurchase, isEditMode, uploadingFiles, editedPurchaseData.supplierContactNumber, currentUser.role]);


  // Determine if 'Move to Invoiced' button should be disabled
  const isMoveToInvoicedButtonDisabled = useMemo(() => {
    if (!selectedPurchase || selectedPurchase.status !== 'Approved') return true; // Only from Approved
    if (!(isOperations(currentUser.role) || isSuperAdmin(currentUser.role))) return true; // Only for Operations or Super Admin

    // Check if required fields for this transition are filled in the edited data
    const isVehicleInfoFilled = editedPurchaseData.vehicleNumber && currentUnloadingPhotos.length > 0;
    return !isVehicleInfoFilled;
  }, [selectedPurchase, editedPurchaseData.vehicleNumber, currentUser?.role, currentUnloadingPhotos.length]);

  // Determine if 'Mark Completed' button should be disabled (existing, but now calls new function)
  const isMarkCompletedButtonDisabled = useMemo(() => {
    if (!selectedPurchase || selectedPurchase.status !== 'Invoiced') return true; // Only from Invoiced
    if (!(isAccountant(currentUser.role) || isSuperAdmin(currentUser.role))) return true; // Only for Accountant or Super Admin

    const isInvoiceInfoFilled = editedPurchaseData.invoiceDate && editedPurchaseData.invoiceNumber && currentInvoiceFiles.length > 0;
    return !isInvoiceInfoFilled;
  }, [selectedPurchase, editedPurchaseData.invoiceDate, editedPurchaseData.invoiceNumber, currentUser?.role, currentInvoiceFiles.length]);


  // Conditional rendering for loading and error states
  if (isFetchingPurchases) {
    return (
      <div className="flex justify-center items-center h-40 bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-lg text-gray-700 dark:text-gray-300">Loading purchases...</span>
      </div>
    );
  }

  if (purchaseError) {
    return (
      <div className="p-4 bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 rounded-lg shadow-md flex items-center justify-center">
        <XCircle className="w-6 h-6 mr-3" />
        <p className="font-medium">{purchaseError}</p>
      </div>
    );
  }


  return (
    <Card className="rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2 sm:p-4">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b border-gray-200 dark:border-gray-700 mb-6">
        <CardTitle className="text-xl md:text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
          <ShoppingCart className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          Purchase Management
        </CardTitle>
        <div className="flex items-center gap-3">


          {(isSuperAdmin(currentUser.role) || isPurchaseEntry(currentUser.role) || AuthUtils.canAccess(currentUser, accessConfig)) && (
            <Dialog open={isNewPurchaseDialogOpen} onOpenChange={setIsNewPurchaseDialogOpen}>


              <DialogContent className="sm:max-w-[800px] md:max-w-[900px] lg:max-w-[1100px] p-4 sm:p-6 bg-gradient-to-br from-blue-50 dark:from-gray-700 to-white dark:to-gray-900 rounded-xl shadow-2xl overflow-y-auto max-h-[80vh] sm:max-h-[70vh] md:max-h-[60vh] lg:max-h-[90vh] z-[9000] border border-blue-300 dark:border-blue-700">
                <DialogHeader className="pb-4 border-b border-gray-200 dark:border-gray-700">
                  <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-white">New Purchase Entry</DialogTitle>
                  <DialogDescription className="text-gray-600 dark:text-gray-400 mt-1">
                    Enter details for a new coil purchase.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-green-600 ml-1">
                    Purchase No
                  </Label>

                  <div className="relative group">
                    <Input
                      id="purchaseNo"
                      value={newPurchaseData.purchaseNo}
                      onChange={(e) => setNewPurchaseData({ ...newPurchaseData, purchaseNo: e.target.value })}
                      placeholder="Enter Purchase No."
                      className="h-12 pr-[85px] rounded-2xl bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 shadow-sm focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all font-mono text-base"
                    />

                    {/* Integrated Fetch/Refresh Button */}
                    <button
                      type="button"
                      onClick={refreshPurchaseNumber}
                      disabled={fetchingPurchaseNumbers}
                      className="absolute right-1.5 top-1.5 h-9 px-3 rounded-xl flex items-center gap-2 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-600 hover:text-white transition-all active:scale-95 group/btn"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-tight">
                        {fetchingPurchaseNumbers ? '...' : 'Fetch'}
                      </span>
                      {fetchingPurchaseNumbers ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5 group-hover/btn:rotate-180 transition-transform duration-500" />
                      )}
                    </button>
                  </div>

                  {/* Suggestions Chips (Recent & Next) */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {recentPurchaseNo && (
                      <span

                        className="px-2 py-0.5 rounded-lg bg-gray-100 text-gray-500 text-[10px] font-bold border border-gray-200 hover:bg-gray-200 transition-colors"
                      >
                        Recent: {recentPurchaseNo}
                      </span>
                    )}

                    {nextPurchaseNo && (
                      <button
                        type="button"
                        onClick={() => setNewPurchaseData({ ...newPurchaseData, purchaseNo: nextPurchaseNo })}
                        className="px-2 py-0.5 rounded-lg bg-green-500/10 text-green-600 text-[10px] font-bold border border-green-500/10 hover:bg-green-500/20 transition-colors"
                      >
                        Next: {nextPurchaseNo}
                      </button>
                    )}
                  </div>
                </div>

                {renderPurchaseEntryForm(true, newPurchaseData, true)} {/* Pass true for isNewEntry */}
                <DialogFooter className="mt-6 flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Button variant="outline" onClick={() => {
                    setIsNewPurchaseDialogOpen(false); setNewPurchaseData({
                      purchaseNo: '',
                      supplierName: '',
                      supplierContactNumber: '',
                      productInfo: '',
                      invoiceInfo: '', // Reset new invoiceInfo
                    }); setNewPurchaseAttachments([]);
                  }} disabled={uploadingNewPurchaseAttachments} className="px-5 py-2 rounded-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">Cancel</Button>
                  <Button className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-5 py-2 rounded-full shadow-md transform transition-transform duration-200 hover:scale-105" onClick={handleAddNewPurchase} disabled={uploadingNewPurchaseAttachments || fetchingPurchaseNumbers}>
                    {uploadingNewPurchaseAttachments && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Submit Purchase
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-2 ">
        {viewMode === 'grouped' ? (
          <div className="space-y-8">
            {(purchasesPending.length > 0 || approvedPurchases.length > 0 || invoicedPurchases.length > 0) && (
              <Card className="rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <CardHeader className="p-4 bg-gray-700 text-white text-lg font-semibold flex items-center justify-between rounded-t-xl">
                  <h2 className="text-2xl font-bold">Purchases: In Progress</h2>
                  <Badge className="bg-white text-gray-700 font-bold py-1 rounded-full">
                    {purchasesPending.length + approvedPurchases.length + invoicedPurchases.length}
                  </Badge>
                </CardHeader>
                <CardContent className={`p-2 ${gridLayoutClasses}`}>
                  {purchasesPending.length > 0 && (
                    <div className={'col-span-1'}>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 flex items-center justify-between">
                        Pending
                        <Badge className="bg-sky-500 text-white">{purchasesPending.length}</Badge>
                      </h3>
                      <div className="space-y-4">
                        {purchasesPending.map(purchase => (
                          <PurchaseCard key={purchase.id} purchase={purchase} onSelectPurchase={handleSelectPurchase} />
                        ))}
                      </div>
                    </div>
                  )}
                  {approvedPurchases.length > 0 && (
                    <div className={'col-span-1'}>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 flex items-center justify-between">
                        Approved
                        <Badge className="bg-green-500 text-white">{approvedPurchases.length}</Badge>
                      </h3>
                      <div className="space-y-4">
                        {approvedPurchases.map(purchase => (
                          <PurchaseCard key={purchase.id} purchase={purchase} onSelectPurchase={handleSelectPurchase} />
                        ))}
                      </div>
                    </div>
                  )}
                  {invoicedPurchases.length > 0 && (
                    <div className={'col-span-1'}>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 flex items-center justify-between">
                        Invoiced
                        <Badge className="bg-amber-500 text-white">{invoicedPurchases.length}</Badge>
                      </h3>
                      <div className="space-y-4">
                        {invoicedPurchases.map(purchase => (
                          <PurchaseCard key={purchase.id} purchase={purchase} onSelectPurchase={handleSelectPurchase} />
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Completed / Cancelled Purchases (Full width below the 3-column grid) */}
            {Object.keys(groupedCompletedCancelledPurchases).length > 0 && (
              <Card className="rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <CardHeader className="p-4 bg-gray-600 text-white text-lg font-semibold flex items-center justify-between rounded-t-xl">
                  <h2 className="text-2xl font-bold">Completed / Cancelled Purchases</h2>
                  <Badge className="bg-white text-gray-600 font-bold px-3 py-1 rounded-full">{purchasesCompletedCancelled.length}</Badge>
                </CardHeader>
                <CardContent className="p-4">
                  {Object.keys(groupedCompletedCancelledPurchases).map(dateGroup => (
                    <div key={dateGroup} className="mb-4 last:mb-0">
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center justify-between">
                        {dateGroup}
                        <Badge className="bg-gray-500 text-white">{groupedCompletedCancelledPurchases[dateGroup].length}</Badge>
                      </h3>
                      <div className={gridLayoutClasses}>
                        {groupedCompletedCancelledPurchases[dateGroup].map(purchase => (
                          <PurchaseCard key={purchase.id} purchase={purchase} onSelectPurchase={handleSelectPurchase} />
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div className={`p-4 ${gridLayoutClasses}`}>
            {purchases.map(purchase => (
              <PurchaseCard key={purchase.id} purchase={purchase} onSelectPurchase={handleSelectPurchase} />
            ))}
          </div>
        )}
      </CardContent>

      {/* Purchase Details / Edit Dialog */}
      <Dialog open={isPurchaseDetailsDialogOpen} onOpenChange={(open) => {
        setIsPurchaseDetailsDialogOpen(open);
        if (!open) {
          setSelectedPurchase(null);
          setEditedPurchaseData({});
          setSelectedAttachments([]);
          setSelectedUnloadingPhotos([]);
          setSelectedInvoiceFiles([]);
          setShowEditHistory(false);
          setCancelRemarks('');
          setIsEditMode(false); // Reset edit mode on close
          setIsMoreActionsDialogOpen(false); // Close More Actions dialog
        }
      }}>
        <DialogContent className="sm:max-w-[800px] md:max-w-[900px] lg:max-w-[1100px] p-4 sm:p-6 bg-gradient-to-br from-blue-50 dark:from-gray-700 to-white dark:to-gray-900 rounded-xl shadow-lg overflow-y-auto max-h-[80vh] sm:max-h-[70vh] md:max-h-[60vh] lg:max-h-[90vh] z-[9000] border border-blue-300 dark:border-blue-700">
          {selectedPurchase && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                  {isEditMode ? `Edit Purchase - ${selectedPurchase.purchaseNo}` : `Purchase Details - ${selectedPurchase.purchaseNo}`}
                  <Badge className={`${PURCHASE_STATUS_COLORS[selectedPurchase.status]} text-white capitalize text-lg px-3 py-1 rounded-full`}>{selectedPurchase.status}</Badge>
                </DialogTitle>
                <DialogDescription className="text-gray-600 dark:text-gray-400 mt-1">
                  {isEditMode ? 'Modify the purchase details below.' : 'View and manage details for this purchase.'}
                </DialogDescription>
              </DialogHeader>

              {/* Main content grid for compactness */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4 p-4 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
                {/* Purchase Entry Details Section (Left Column) - Always open */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Purchase Entry Details</h3>
                  {renderPurchaseEntryForm(isEditMode, editedPurchaseData)}
                </div>

                {/* Vehicle Information Section (Right Column) - Always open */}
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Vehicle Information</h3>
                  {renderVehicleCoilEntryForm(isEditMode, editedPurchaseData)}
                </div>

                {/* Invoice Upload & Verification Section (After Vehicle Information Section to help manage blank gap) */}
                {/* Only show Invoice & Payment Details if not Operations role */}
                {!(isOperations(currentUser.role)) && (
                  <div className="space-y-4 p-4 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Invoice & Payment Details</h3>
                    {renderInvoiceForm(isEditMode, editedPurchaseData)}
                  </div>
                )}
              </div>

              {selectedPurchase.status === 'Cancelled' && (
                <div className="p-3 bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-300 rounded-md mt-4">
                  <p className="font-semibold">Purchase Cancelled.</p>
                  <p>Remarks: {selectedPurchase.cancellationRemarks || 'N/A'}</p>
                </div>
              )}

              <DialogFooter className="mt-6 flex flex-wrap justify-end gap-3 border-t border-gray-200 dark:border-gray-700 pt-6">
                {isEditMode ? (
                  <>
                    <Button variant="outline" onClick={() => setIsEditMode(false)} className="px-5 py-2 rounded-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">Cancel Edit</Button>
                    <Button className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-full shadow-md transform transition-transform duration-200 hover:scale-105" onClick={handleSaveEditedPurchase} disabled={isSaveButtonDisabled || uploadingFiles}>
                      {uploadingFiles && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Save Changes
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => setIsPurchaseDetailsDialogOpen(false)} className="px-5 py-2 rounded-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">Close</Button>
                    {/* Only show Edit button if user has permission to edit any part of the purchase */}
                    {((isPurchaseEntry(currentUser.role) && selectedPurchase.status === 'Pending' || AuthUtils.canAccess(currentUser, accessConfig)) || isSuperAdmin(currentUser.role) ||
                      (isOperations(currentUser.role) && selectedPurchase.status === 'Approved') ||
                      (isAccountant(currentUser.role) && selectedPurchase.status === 'Invoiced')) && (
                        <Button className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-full shadow-md transform transition-transform duration-200 hover:scale-105" onClick={() => setIsEditMode(true)}>
                          <Edit className="w-4 h-4 mr-2" /> Edit Purchase
                        </Button>
                      )}

                    {/* Purchase Approval Actions (Super Admin Only, visible when status is 'Pending') */}
                    {isSuperAdmin(currentUser.role) && selectedPurchase.status === 'Pending' && (
                      <>
                        <Button className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-5 rounded-full shadow-md transition duration-300 ease-in-out transform hover:scale-105" onClick={() => handleApprovePurchase(selectedPurchase)}>
                          <Check className="w-4 h-4 mr-2" /> Approve
                        </Button>
                      </>
                    )}

                    {/* Move to Invoiced Button (for Operations/Super Admin on Approved status) */}
                    {(isOperations(currentUser.role) || isSuperAdmin(currentUser.role)) && selectedPurchase.status === 'Approved' && (
                      <Button
                        className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-full shadow-md transform transition-transform duration-200 hover:scale-105"
                        onClick={handleTransitionToInvoiced}
                        disabled={isMoveToInvoicedButtonDisabled}
                      >
                        <Truck className="w-4 h-4 mr-2" /> Move to Invoiced
                      </Button>
                    )}

                    {/* Mark Completed Button (only for Accountant/Super Admin on Invoiced status) */}
                    {(isAccountant(currentUser.role) || isSuperAdmin(currentUser.role)) && selectedPurchase.status === 'Invoiced' && (
                      <Button
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-full shadow-md transform transition-transform duration-200 hover:scale-105"
                        onClick={handleTransitionToCompleted}
                        disabled={isMarkCompletedButtonDisabled}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" /> Mark Completed
                      </Button>
                    )}

                    {/* More Actions Button */}
                    <Dialog open={isMoreActionsDialogOpen} onOpenChange={setIsMoreActionsDialogOpen}>
                      <Button variant="outline" className="flex-1 sm:flex-none" disabled={!currentUser.role} onClick={() => setIsMoreActionsDialogOpen(true)}>
                        <MoreVertical className="w-4 h-4 mr-2" /> More Actions
                      </Button>
                      <DialogContent className="sm:max-w-[350px] p-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-y-auto max-h-[80vh] z-[9001]">
                        <DialogHeader>
                          <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white">Purchase Actions</DialogTitle>
                          <DialogDescription className="text-gray-600 dark:text-gray-400 mt-1">Select an action for this purchase.</DialogDescription>
                        </DialogHeader>
                        <div className="flex flex-col gap-3 mt-4">
                          {isSuperAdmin(currentUser.role) && (
                            <>
                              <Button
                                variant="destructive"
                                onClick={() => { setSelectedPurchase(selectedPurchase); setIsCancelPurchaseDialogOpen(true); setIsMoreActionsDialogOpen(false); }}
                                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
                              >
                                <Ban className="w-4 h-4 mr-2" /> Cancel Purchase
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={() => openConfirmDeleteDialog(selectedPurchase)}
                                className="w-full"
                              >
                                <Trash2 className="w-4 h-4 mr-2" /> Delete Purchase
                              </Button>
                            </>
                          )}

                          {/* Edit History Section - Moved here */}
                          <CollapsibleSection title="Edit History" icon={<History className="w-5 h-5" />} defaultOpen={showEditHistory}>
                            {selectedPurchase.editHistory && selectedPurchase.editHistory.length > 0 ? (
                              <ul className="text-sm text-gray-700 dark:text-gray-300 list-inside mt-2 space-y-0.5">
                                {selectedPurchase.editHistory.map((entry, idx) => {
                                  const eventDate = new Date(entry.timestamp);
                                  const formattedDate = eventDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
                                  const formattedTime = eventDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
                                  const editorDisplayName = entry.editorName ? (entry.editorName.includes('@') ? entry.editorName.split('@')[0] : entry.editorName) : 'Unknown Editor';
                                  return (
                                    <li key={idx}>
                                      <strong>{formattedDate} {formattedTime}:</strong> <span className="ml-1">{entry.description} (by {editorDisplayName})</span>
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : (
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">No edit history available.</p>
                            )}
                          </CollapsibleSection>
                        </div>
                        <DialogFooter className="mt-4">
                          <Button variant="outline" onClick={() => setIsMoreActionsDialogOpen(false)}>Close</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <Dialog open={isConfirmDeleteDialogOpen} onOpenChange={setIsConfirmDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px] p-4 sm:p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-y-auto max-h-[80vh] z-[9002]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-white">Confirm Deletion</DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400 mt-1">
              Are you sure you want to delete purchase <span className="font-semibold">{purchaseToDelete?.purchaseNo}</span>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsConfirmDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeletePurchase}>
              <Trash2 className="w-4 h-4 mr-2" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Purchase Dialog */}
      <Dialog open={isCancelPurchaseDialogOpen} onOpenChange={setIsCancelPurchaseDialogOpen}>
        <DialogContent className="sm:max-w-[425px] p-4 sm:p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-y-auto max-h-[80vh] z-[9003]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-white">Cancel Purchase</DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400 mt-1">
              Provide remarks for cancelling purchase <span className="font-semibold">{selectedPurchase?.purchaseNo}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cancelRemarks">Remarks</Label>
              <Textarea id="cancelRemarks" value={cancelRemarks} onChange={(e) => setCancelRemarks(e.target.value)} placeholder="Reason for cancellation..." rows={4} />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsCancelPurchaseDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleCancelPurchaseSubmit}>
              <Ban className="w-4 h-4 mr-2" /> Confirm Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};





// --- Main App Component ---
export default function App() {
  const router = useRouter();
  const pathname = usePathname();

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loadingPurchases, setLoadingPurchases] = useState<boolean>(true);
  const [purchaseError, setPurchaseError] = useState<string>('');

  const [viewMode, setViewMode] = useState<'grouped' | 'grid'>('grouped'); // 'grouped' or 'grid'
  const [isNewPurchaseDialogOpen, setIsNewPurchaseDialogOpen] = useState<boolean>(false);
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const role = usePermissionStore(s => s.role);

  // Map Clerk user to legacy UserProfile shape
  const currentUserProfile = useMemo(() => {
    if (!clerkUser) return null;
    return {
      id: clerkUser.id,
      name: clerkUser.fullName || clerkUser.username || 'User',
      email: clerkUser.primaryEmailAddress?.emailAddress || '',
      role: (role || (clerkUser.publicMetadata?.role as string) || 'sales') as UserRole,
      accessToken: null, // Clerk handles tokens via interceptors
    } as UserProfile;
  }, [clerkUser, role]);


  const fetchPurchases = useCallback(async () => {
    setLoadingPurchases(true);
    setPurchaseError('');

    try {
      const fetched = await apiService.fetchPurchases();
      setPurchases(fetched);
    } catch (error: any) {
      setPurchaseError(`Failed to fetch purchases: ${error.message}`);
      toast.error(`Failed to fetch purchases: ${error.message}`);
    } finally {
      setLoadingPurchases(false);
    }
  }, []); // Stable dependency array to avoid infinite loops and redundant re-renders.


  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('action') === 'create') {
      setIsNewPurchaseDialogOpen(true);

      // Remove 'action=create' from the URL so it can be triggered again without refresh
      const params = new URLSearchParams(searchParams.toString());
      params.delete('action');
      const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      router.replace(newUrl, { scroll: false });
    }
  }, [searchParams, pathname, router]);

  useEffect(() => {
    if (clerkLoaded && currentUserProfile) {
      fetchPurchases();
    } else if (clerkLoaded && !currentUserProfile) {
      setPurchases([]);
      setLoadingPurchases(false);
    }
  }, [clerkLoaded, currentUserProfile, fetchPurchases]);


  return (

    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 relative">
      {/* Premium Background Mesh - Adjusted for better contrast */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-fuchsia-100/30 via-transparent to-transparent dark:from-fuchsia-900/10 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-indigo-100/30 via-transparent to-transparent dark:from-indigo-900/10 pointer-events-none" />

      {!clerkLoaded && (
        <div className="fixed inset-0 bg-gray-200 dark:bg-gray-900 flex justify-center items-center z-[8000]">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
          <span className="ml-3 text-lg text-gray-700 dark:text-gray-300">Loading authentication...</span>
        </div>
      )}

      <NavbarExtension>

        <Button
          className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 transform transition-transform duration-200 hover:scale-105"
          onClick={() => setViewMode(viewMode === 'grouped' ? 'grid' : 'grouped')}
        >
          {viewMode === 'grouped' ? <LayoutGrid className="w-5 h-5" /> : <LayoutList className="w-5 h-5" />}
          <span className="hidden md:inline">
            {viewMode === 'grouped' ? 'Grid View' : 'Grouped View'}</span>
        </Button>

        <NavButton
          type="crate"
          text="New Purchase Entry"
          className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
          onClick={() => setIsNewPurchaseDialogOpen(true)}
        />


        <NavButton
          type="refresh"
          onClick={() => fetchPurchases()}
          isLoading={loadingPurchases}
        />
      </NavbarExtension>



      {/* Main Content Area */}
      <main className="max-w-full mx-auto px-[2px] py-6 md:px-6 mt-6">
        {currentUserProfile ? (
          <PurchaseManagementPanel
            currentUser={currentUserProfile}
            isFetchingPurchases={loadingPurchases}
            fetchPurchases={fetchPurchases}
            purchaseError={purchaseError}
            purchases={purchases}
            setPurchases={setPurchases}
            viewMode={viewMode}
            setViewMode={setViewMode}
            NewPurchaseDialog={isNewPurchaseDialogOpen}
            setIsNewPurchaseDialogOpen={setIsNewPurchaseDialogOpen}
          />

        ) : (
          <div className="col-span-full text-center py-10 text-gray-500 dark:text-gray-400 text-lg">
            Please log in to view the Purchase Management system.
          </div>
        )}
      </main>
    </div>
  );
}