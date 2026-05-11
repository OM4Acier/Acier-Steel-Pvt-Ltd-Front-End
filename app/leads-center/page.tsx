"use client"

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Loader2, Calendar, Search, Phone, Mail, Users, AlertCircle, CircleCheck, XCircle, BarChart, CheckCircle, RefreshCcw, Paperclip, Plus, Upload, X, ArrowLeft, ArrowRight, TrendingUp, AlertTriangle, LucideIcon } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import UniversalNavBar, { createSimplePageConfig } from '@/components/NavBar';
import { checkCloudAuth } from '@/lib/auth/checkCloudAuth';
import { usePathname, useRouter } from 'next/navigation';
import { UserProfile } from '@/types/rbac.types';

// --- Global Constants ---
const CACHE_DURATION_MS: number = 3600000; // 1 hour
const CACHE_KEY: string = 'dashboard_progress_cache';

const BASE_API_URL = process.env.NEXT_PUBLIC_BASE_API_URL || 'http://localhost:3000';



// --- Interfaces for Typing ---
interface ProgressData {
    trendText: string;
    trendIcon: LucideIcon;
}

interface MetricCardProps {
    icon: LucideIcon;
    title: string;
    value: string | number;
    statusIcon: LucideIcon;
    statusText: string;
    // Base color for the icon wrapper (e.g., 'indigo', 'amber', 'teal')
    colorBase: 'indigo' | 'amber' | 'teal';
    isExperimental?: boolean;
}




const toaster = {
    success: (message: string) => toast.success(message),
    error: (message: string) => toast.error(message),
    info: (message: string) => toast.info(message),
    warning: (message: string) => toast.warning(message),
};

const compressImageFile = async (file: File, quality: number = 0.8): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                let width = img.width;
                let height = img.height;
                const maxDimension = 1920;

                if (width > maxDimension || height > maxDimension) {
                    if (width > height) {
                        height = (height / width) * maxDimension;
                        width = maxDimension;
                    } else {
                        width = (width / height) * maxDimension;
                        height = maxDimension;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                ctx?.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => blob ? resolve(blob) : reject(new Error('Canvas to Blob conversion failed')),
                    file.type || 'image/jpeg',
                    quality
                );
            };
            img.onerror = reject;
            img.src = e.target?.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

const fileToBase64 = (file: File | Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64String = (reader.result as string).split(',')[1];
            resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

interface Lead {
    id: string;
    timestamp: string;
    name: string;
    email: string;
    phone: string;
    source: string;
    isClaimed: boolean;
    rowNumber?: number;
    hasExistingLeads: boolean;
    existingLeadsCount: number;
    existingLeads: any[];
    productInterest?: string;
}

interface DetailedLead {
    success: boolean;
    data: {
        id: string;
        timestamp: string;
        name: string;
        email: string;
        phone: string;
        source: string;
        productInterest: string;
        clientName: string;
        isClaimed: boolean;

        // Optional fields (only when source === "combined")
        countryCode?: string;
        nameSource?: string;

        // Existing leads info
        hasExistingLeads: boolean;
        existingLeadsCount: number;
        existingLeads: any[]; // or a stricter type if you know shape
    }
}

interface Pagination {
    currentPage: number;
    limit: number;
    totalRecords: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
}

interface LeadsResponse {
    success: boolean;
    data: {
        leads: Lead[];
        pagination: Pagination;
        metadata: {
            userClaimedCount: number;
            totalRaw: number;
            dataSource: string;
            processingTime: number;
            timestamp: string;
        };
    };
}

interface UserAccessResponse {
    success: boolean;
    data: {
        allowedSources: string[];
        claimedCount: number;
        userInfo: {
            email: string;
            name: string;
            role: string;
        };
    };
}

interface LeadFormDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: any, files: File[]) => void;
    isSaving: boolean;
    initialData?: any;
}

const LeadFormDialog: React.FC<LeadFormDialogProps> = ({ isOpen, onOpenChange, onSubmit, isSaving, initialData }) => {
    const defaultReminder = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return d.toISOString().split('T')[0];
    }, []);

    const [clientName, setClientName] = useState('');
    const [phone, setPhone] = useState('');
    const [productInterest, setProductInterest] = useState('');
    const [reminderDate, setReminderDate] = useState<Date | undefined>(undefined);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setClientName(initialData.name || initialData.clientName || '');
                setPhone(initialData.phone || '');
                setProductInterest(initialData.productInterest || '');
                if (initialData.reminderDate && !isNaN(new Date(initialData.reminderDate).getTime())) {
                    setReminderDate(new Date(initialData.reminderDate));
                } else {
                    setReminderDate(defaultReminder ? new Date(defaultReminder) : undefined);
                }
            } else {
                setClientName('');
                setPhone('');
                setProductInterest('');
                setReminderDate(defaultReminder ? new Date(defaultReminder) : undefined);
            }
            setSelectedFiles([]);
        }
    }, [initialData, defaultReminder, isOpen]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement> | { target: { files: FileList | null } }) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const newFiles = Array.from(files).filter(file => {
            if (file.size > 10 * 1024 * 1024) {
                toaster.error(`File ${file.name} is too large (max 10MB).`);
                return false;
            }
            return true;
        });
        setSelectedFiles(prev => [...prev, ...newFiles]);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleRemoveFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!clientName || !phone || !productInterest) {
            toast.error("Please fill in all required fields.");
            return;
        }
        const phoneRegex = /^\d{10}$/;
        if (!phoneRegex.test(phone)) {
            toast.error("Invalid phone number format. Please enter exactly 10 digits.");
            return;
        }

        const dataToSend = {
            clientName,
            phone,
            productInterest,
            reminderDate: reminderDate ? format(reminderDate, 'yyyy-MM-dd') : undefined,
            originalSource: initialData?.source,
            sheetLeadId: initialData?.id,
            sheetTimestamp: initialData?.timestamp,
            email: initialData?.email,
        };

        onSubmit(dataToSend, selectedFiles);
    };

    const dialogTitle = initialData ? 'Review & Claim Lead' : 'Create New Lead';
    const submitButtonText = initialData ? 'Finalize & Claim' : 'Create Lead';

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl max-w-[95vw] rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
                <DialogHeader className="border-b pb-3 mb-4">
                    <DialogTitle className="text-3xl font-extrabold text-indigo-700">{dialogTitle}</DialogTitle>
                    <DialogDescription>
                        Ensure all details are accurate and attach relevant documents before submitting.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="clientName" className=" font-medium">Client Name</Label>
                            <Input id="clientName" value={clientName} onChange={(e) => setClientName(e.target.value)} required disabled={isSaving} className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone" className=" font-medium">Phone Number (10 Digits)</Label>
                            <Input
                                id="phone"
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                required
                                maxLength={10}
                                pattern="\d{10}"
                                disabled={isSaving}
                                className="border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="productInterest" className=" font-medium">Product Interest / Notes</Label>
                        <Textarea
                            id="productInterest"
                            value={productInterest}
                            onChange={(e) => setProductInterest(e.target.value)}
                            required
                            disabled={isSaving}
                            placeholder="Briefly describe the client's interest and next steps..."
                            className="min-h-[100px] max-h-[200px] overflow-y-auto border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="reminderDate" className=" font-medium">Next Follow-up Date</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className={`w-full justify-start text-left font-normal border-gray-300 hover:bg-gray-50 focus:ring-indigo-500 rounded-lg ${!reminderDate && "text-muted-foreground"}`}
                                    disabled={isSaving}
                                >
                                    <Calendar className="mr-2 h-4 w-4 text-indigo-500" />
                                    {reminderDate ? format(reminderDate, "PPP") : <span className='text-gray-500'>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 z-50 bg-white shadow-xl rounded-xl border border-gray-200" align="start">
                                <CalendarComponent
                                    mode="single"
                                    selected={reminderDate}
                                    onSelect={setReminderDate}
                                    initialFocus
                                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="space-y-3 p-5 rounded-xl bg-indigo-50/70 border-2 border-dashed border-indigo-300 transition-all duration-300">
                        <h3 className="font-semibold text-xl text-indigo-800 flex items-center gap-2">
                            <Paperclip className="w-5 h-5 text-indigo-600" /> Attach Documents
                        </h3>
                        <div
                            className={`rounded-lg p-6 text-center text-gray-500 transition-all duration-300 border-2 border-dashed
                  ${isSaving ? 'opacity-50 pointer-events-none' : 'hover:border-indigo-500 hover:bg-indigo-100/40 border-indigo-300 cursor-pointer'}`}
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.add('border-indigo-500', 'bg-indigo-100/40'); }}
                            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.remove('border-indigo-500', 'bg-indigo-100/40'); }}
                            onDrop={(e) => {
                                e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.remove('border-indigo-500', 'bg-indigo-100/40');
                                if (e.dataTransfer.files) { handleFileChange({ target: { files: e.dataTransfer.files } }); }
                            }}
                        >
                            <Input id="lead-files-input" type="file" multiple accept="image/*,.pdf,.doc,.docx" onChange={handleFileChange} className="hidden" ref={fileInputRef} disabled={isSaving} />
                            <Label htmlFor="lead-files-input" className="cursor-pointer flex flex-col items-center">
                                <Upload className="w-8 h-8 mb-2 text-indigo-500" />
                                <span className='font-semibold text-lg text-indigo-700'>Drag & Drop or Click to Upload</span>
                                <span className='text-sm text-gray-500 mt-1'>(Images will be compressed. Max 10MB/file)</span>
                            </Label>
                        </div>
                        {selectedFiles.length > 0 && (
                            <div className="space-y-2 mt-4 max-h-40 overflow-y-auto pr-2">
                                <h5 className="font-semibold text-base">Files Ready for Upload:</h5>
                                <ul className="space-y-2">
                                    {selectedFiles.map((file, index) => (
                                        <li key={index} className="flex items-center justify-between bg-white p-3 rounded-lg text-sm border border-gray-200 shadow-sm">
                                            <span className="truncate  font-medium flex-1 mr-4 flex items-center">
                                                <Paperclip className="w-4 h-4 mr-2 text-indigo-500" />
                                                {file.name}
                                            </span>
                                            <span className="text-xs text-gray-500 mr-4 tabular-nums">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                                            <Button variant="ghost" size="sm" onClick={() => handleRemoveFile(index)} className="text-red-500 hover:bg-red-50 hover:text-red-700 h-7 w-7 p-0 rounded-full" disabled={isSaving}><X className="w-4 h-4" /></Button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="pt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 border-t">
                        <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={isSaving} className="w-full sm:w-auto hover:bg-gray-100 rounded-lg">
                            <X className='w-4 h-4 mr-2' /> Cancel
                        </Button>
                        <Button type="submit" disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white w-full sm:w-auto font-semibold shadow-lg shadow-indigo-500/30 rounded-lg">
                            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CircleCheck className="w-4 h-4 mr-2" />}
                            {submitButtonText}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};


const sourceAccents: { [key: string]: { border: string, text: string, bg: string } } = {
    'justdial': {
        border: 'border-blue-500',
        text: 'text-white',
        bg: 'bg-gradient-to-r from-blue-500 to-blue-700'
    },
    'acier': {
        border: 'border-blue-500',
        text: 'text-blue-700',
        bg: 'bg-blue-50'
    },
    'indiamart': { border: 'border-green-500', text: 'text-green-700', bg: 'bg-green-50' },
    'tradeindia': { border: 'border-indigo-500', text: 'text-indigo-700', bg: 'bg-indigo-50' },
    'visitor': { border: 'border-purple-500', text: 'text-purple-700', bg: 'bg-purple-50' },
    'national': { border: 'border-red-500', text: 'text-red-700', bg: 'bg-red-50' },
    'other': { border: 'border-gray-500', text: '', bg: 'bg-gray-50' },
};

const LoadingSkeleton = () => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {Array.from({ length: 9 }).map((_, index) => (
                <Card key={index} className="rounded-xl shadow-lg h-auto bg-white border border-gray-200">
                    <CardHeader className="p-5">
                        <div className="h-6 w-3/4 bg-gray-200 rounded-md"></div>
                        <div className="h-4 w-1/3 bg-gray-200 rounded mt-2"></div>
                    </CardHeader>
                    <CardContent className="p-5 pt-0 space-y-3">
                        <div className="h-4 w-full bg-gray-200 rounded"></div>
                        <div className="h-4 w-2/3 bg-gray-200 rounded"></div>
                        <div className="h-4 w-1/2 bg-gray-200 rounded"></div>
                    </CardContent>
                    <CardFooter className='p-5 pt-0 flex justify-end'>
                        <div className='h-9 w-24 bg-gray-200 rounded-lg'></div>
                    </CardFooter>
                </Card>
            ))}
        </div>
    );
};



// --- LeadCard Component Implementation ---

interface LeadCardProps {
    lead: Lead;
    onReviewAndClaim: (lead: Lead) => void;
    onDetails: (lead: Lead) => void;
    isClaiming: boolean;
}




const LeadCard: React.FC<LeadCardProps> = React.memo(({ lead, onReviewAndClaim, onDetails, isClaiming }) => {
    const accent = sourceAccents[lead.source.toLowerCase()] || sourceAccents.other;

    // Optimized checks to ensure the data is not null, empty, or just whitespace
    const hasPhone = lead.phone && lead.phone.trim().length > 0;
    const hasEmail = lead.email && lead.email.trim().length > 0;

    const cardClasses = `
      shadow-lg border-t-4 transition-all duration-500 group relative overflow-hidden rounded-xl dark:bg-slate-800 dark:text-white
      ${lead.isClaimed ? "border-t-green-500 opacity-70" : `border-t-indigo-500 hover:shadow-2xl hover:scale-[1.01] cursor-pointer bg-white`}
  `;

    return (
        <Card className={cardClasses} onClick={() =>  onReviewAndClaim(lead)}>
            {isClaiming && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-10 rounded-xl">
                    <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
                </div>
            )}

            <CardHeader className="p-5 pb-3 relative">
                <div className='flex justify-between items-start'>
                    <CardTitle className={`text-xl font-bold text-gray-900 dark:text-white ${!lead.isClaimed && 'group-hover:text-indigo-700'} transition-colors duration-200`}>
                        {lead.name}
                    </CardTitle>
                    {lead.hasExistingLeads && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <AlertCircle size={20} className="text-orange-500 flex-shrink-0 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent
                                    className="bg-orange-600 text-white text-xs px-3 py-1.5 rounded-lg shadow-xl z-50 font-medium"
                                    side="top"
                                    sideOffset={10}
                                >
                                    Potential Duplicate Found
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
                <CardDescription className={`text-sm font-medium ${accent.text} px-2 py-0.5 rounded-full inline-block ${accent.bg} border ${accent.border} w-fit`}>
                    {lead.source}
                </CardDescription>
            </CardHeader>

            {/* --- ADVANCED FEATURES: CLICK-TO-CALL & CLICK-TO-EMAIL (CONDITIONAL) --- */}
            <CardContent className="p-5 pt-2 space-y-3  dark:text-slate-300">

                {/* Click-to-Call: Only render if phone is available */}
                {hasPhone ? (
                    <a href={`tel:${lead.phone}`} className="flex items-center space-x-3 text-sm hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors duration-200">
                        <Phone size={16} className="text-gray-400 dark:text-slate-500 flex-shrink-0" />
                        <span className='font-medium underline-offset-2 hover:underline'>{lead.phone}</span>
                    </a>
                ) : (
                    <div className="flex items-center space-x-3 text-sm text-gray-400 dark:text-slate-500 italic">
                        <Phone size={16} className="flex-shrink-0" />
                        <span>Phone Unavailable</span>
                    </div>
                )}

                {/* Click-to-Email: Only render if email is available */}
                {hasEmail ? (
                    <a href={`mailto:${lead.email}`} className="flex items-center space-x-3 text-sm truncate hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors duration-200">
                        <Mail size={16} className="text-gray-400 dark:text-slate-500 flex-shrink-0" />
                        <span className="truncate underline-offset-2 hover:underline">{lead.email}</span>
                    </a>
                ) : (
                    <div className="flex items-center space-x-3 text-sm text-gray-400 dark:text-slate-500 italic">
                        <Mail size={16} className="flex-shrink-0" />
                        <span>Email Unavailable</span>
                    </div>
                )}

                {/* Other Info */}
                <div className="flex items-center space-x-3 text-sm">
                    <Calendar size={16} className="text-gray-400 dark:text-slate-500 flex-shrink-0" />
                    <span>Received: {new Date(lead.timestamp).toLocaleDateString()}</span>
                </div>
            </CardContent>

            {/* --- ACTION FOOTER (ICON-ONLY - CONDITIONAL) --- */}
            <CardFooter className="p-5 pt-3 flex flex-col sm:flex-row justify-between items-center border-t border-gray-100 dark:border-slate-700">
                <div className="flex space-x-2 mb-3 sm:mb-0">
                    {/* Call Button (Icon Only - Conditional) */}
                    {hasPhone && (
                        <a href={`tel:${lead.phone}`}>
                            <Button className="rounded-lg shadow-sm p-3">
                                <Phone className="w-4 h-4" />
                            </Button>
                        </a>
                    )}
                    {/* Email Button (Icon Only - Conditional) */}
                    {hasEmail && (
                        <a href={`mailto:${lead.email}`}>
                            <Button className=" rounded-lg shadow-sm p-3">
                                <Mail className="w-4 h-4" />
                            </Button>
                        </a>
                    )}
                </div>

                {/* Claim/Details Button */}
                {!lead.isClaimed ? (
                    <Button
                        onClick={() => onReviewAndClaim(lead)}
                        disabled={isClaiming}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg transition-all duration-300 rounded-lg w-full sm:w-auto"
                    >
                        {isClaiming ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                        Claim Lead
                    </Button>
                ) : (
                    <Button
                        onClick={() => onDetails(lead)}
                        className="text-green-600 border border-green-200 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-900/30 rounded-lg w-full sm:w-auto"
                    >
                        <CheckCircle className='w-4 h-4 mr-2' /> Claimed
                    </Button>
                )}
            </CardFooter>
        </Card>
    );
});
const cache = new Map();




/**
 * MetricCard Component: Implements the clean, soft-shadowed visual style.
 * Supports light/dark mode entirely via Tailwind's dark: prefixes.
 */
const MetricCard: React.FC<MetricCardProps> = React.memo(({
    icon: Icon,
    title,
    value,
    statusText,
    colorBase,
    isExperimental = false,
}) => {

    // --- Dynamic Tailwind Class Composition using dark: prefixes ---

    // Icon wrapper color and inner icon color
    const iconBgClass = `bg-${colorBase}-50 dark:bg-${colorBase}-900/50`;
    const iconColorClass = `text-${colorBase}-600 dark:text-${colorBase}-400`;

    // Status (Trend) text and icon color
    const statusTextColor = isExperimental
        ? "text-amber-600 dark:text-amber-400" // Use amber for experimental warning
        : "text-green-600 dark:text-green-400"; // Use green for positive trends

    // Main Card styling (matches requested look)
    const bgClass = "bg-white dark:bg-slate-800";
    const shadowClass = "shadow-2xl shadow-gray-100 transition-all duration-300 hover:shadow-xl hover:shadow-gray-200 dark:shadow-slate-900/50 dark:hover:shadow-slate-700/80 border border-gray-100 dark:border-slate-700";

    // Text colors
    const titleColor = "text-gray-500 dark:text-slate-400";
    const valueColor = "text-gray-900 dark:text-white";


    return (
        // p-7 and rounded-3xl as requested
        <div className={`${bgClass} p-7 rounded-3xl ${shadowClass}`}>

            <div className="flex items-center justify-between">
                {/* Left: Main Icon in colored wrapper */}
                <div className={`${iconBgClass} p-3 rounded-xl transition-colors duration-500`}>
                    <Icon size={24} className={iconColorClass} />
                </div>

                {/* Right: Trend/Status Indicator */}
                <p className={`text-sm font-semibold flex items-center ${statusTextColor} transition-colors duration-500`}>
                    <CheckCircle size={16} className={`mr-1 ${statusTextColor}`} />
                    {statusText}
                </p>
            </div>

            <div className="mt-6">
                <p className={`text-sm font-medium uppercase tracking-widest ${titleColor}`}>
                    {title}
                </p>
                <h2 className={`text-6xl font-extrabold mt-1 ${valueColor} tabular-nums leading-tight`}>
                    {value}
                </h2>
            </div>
        </div>
    );
});


/**
 * Utility function to generate a random positive percentage and corresponding positive feedback icon/text.
 */
const generateProgressData = (): ProgressData => {
    const randomPercent: number = (Math.random() * (16.0 - 3.0) + 3.0);
    const trendText: string = `+${randomPercent.toFixed(1)}% MoM`;
    return { trendText, trendIcon: TrendingUp };
};




const App: React.FC = () => {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [isLoadingLeads, setIsLoadingLeads] = useState<boolean>(false);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [totalPages, setTotalPages] = useState<number>(1);
    const [totalRawLeads, setTotalRawLeads] = useState<number>(0);
    const [filters, setFilters] = useState({
        source: '',
        date: '',
        search: '',
    });
    const [userAccess, setUserAccess] = useState<UserAccessResponse['data'] | null>(null);
    const [isLeadFormOpen, setIsLeadFormOpen] = useState(false);
    const [leadToEdit, setLeadToEdit] = useState<Lead | null>(null);
    const [claimingLeadId, setClaimingLeadId] = useState<string | null>(null);
    const [progressData, setProgressData] = useState<ProgressData | null>(null);
    // Authentication and User Profile States
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loadingApp, setLoadingApp] = useState(true);
    const [isMenuOpen, setIsMenuOpen] = useState(false); // New state for mobile menu
    const pathname = usePathname();



    const router = useRouter();

    useEffect(() => {
        const validateSession = async () => {
            try {
                // First try the new cloud auth method
                const user = await checkCloudAuth();
                const fullUser: UserProfile = {
                    ...user,
                    accessToken: localStorage.getItem('accessToken') || '',
                };
                setUser(fullUser);
                setLoadingApp(false);

                // Check if user role is allowed
                const allowedRoles = ['super-admin', 'sales'];
                if (!allowedRoles.includes(user.role)) {
                    toast.error('Access denied. Your role does not permit access to this dashboard.');
                    router.replace('/');
                    setLoadingApp(false);
                    return;
                }

            } catch (err: any) {
                console.warn('Cloud auth failed, falling back to localStorage:', err.message);

                // Fallback to localStorage method
                const local = localStorage.getItem('currentUserProfile');
                const token = localStorage.getItem('accessToken');

                if (!local || !token) {
                    toast.error('Please login first');
                    setLoadingApp(false);
                    router.replace('/login?returnTo=' + encodeURIComponent(pathname));
                    return;
                }

                try {
                    const parsedUser: UserProfile = JSON.parse(local);
                    const fullUser: UserProfile = {
                        ...parsedUser,
                        accessToken: token
                    };
                    setUser(fullUser);
                    setLoadingApp(false);

                    // Check role permissions for localStorage users too
                    const allowedRoles = ['super-admin', 'sales'];
                    if (!allowedRoles.includes(parsedUser.role as string)) {
                        toast.error('Access denied. Your role does not permit access to this dashboard.');
                        router.replace('/');
                        return;
                    }

                } catch (parseError) {
                    console.error("Error parsing user profile from localStorage:", parseError);
                    toast.error("Failed to load user profile. Please log in again.");
                    localStorage.clear();
                    setLoadingApp(false);
                    router.replace('/login?returnTo=' + encodeURIComponent(pathname));
                }
            }
        };

        validateSession();
    }, [router, toast, pathname]); // Added pathname to dependencies




    const fetchUserAccess = useCallback(async (accessToken: string) => {
        try {
            const response = await fetch(`${BASE_API_URL}/user/access`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (!response.ok) {
                throw new Error('Failed to fetch user access');
            }
            const data: UserAccessResponse = await response.json();
            setUserAccess(data.data);


            const initialSource = data.data.allowedSources.includes('combined')
                ? 'combined'
                : (data.data.allowedSources[0] || '');

            setFilters(prevFilters => ({
                ...prevFilters,
                source: prevFilters.source || initialSource
            }));
        } catch (error) {
            console.error('Error fetching user access:', error);
            toaster.error('Failed to load user access configuration.');
        }
    }, []);

    const fetchLeads = useCallback(async (page: number = 1, currentFilters = filters, accessToken: string, signal?: AbortSignal) => {
        const cacheKey = JSON.stringify({
            page,
            source: currentFilters.source,
            date: currentFilters.date,
            search: currentFilters.search
        });

        const cachedData = cache.get(cacheKey);

        if (cachedData && (Date.now() - cachedData.timestamp) < 300000) {
            setLeads(cachedData.data.leads);
            setTotalPages(cachedData.data.pagination.totalPages);
            setCurrentPage(cachedData.data.pagination.currentPage);
            setTotalRawLeads(cachedData.data.pagination.totalRecords);
            return;
        }

        setIsLoadingLeads(true);
        try {
            const queryParams = new URLSearchParams({
                page: page.toString(),
                limit: '100',
                source: currentFilters.source,
                date: currentFilters.date,
                search: currentFilters.search,
            });

            const response = await fetch(`${BASE_API_URL}/leads-center?${queryParams.toString()}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` },
                signal
            });

            if (!response.ok) {
                throw new Error('Failed to fetch leads');
            }

            const data: LeadsResponse = await response.json();

            if (data && data.data && data.data.leads) {
                setLeads(data.data.leads);
                setTotalPages(data.data.pagination.totalPages);
                setCurrentPage(data.data.pagination.currentPage);
                setTotalRawLeads(data.data.pagination.totalRecords);

                cache.set(cacheKey, { data: data.data, timestamp: Date.now() });
            } else {
                throw new Error('Invalid data structure received from API');
            }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log('Request cancelled');
                return;
            }
            console.error('Error fetching leads:', error);
            toaster.error('Failed to load leads. Please try again.');
        } finally {
            setIsLoadingLeads(false);
        }
    }, [filters]);


    const refreshLeads = useCallback(() => {
        if (user?.accessToken) {
            cache.clear();
            fetchLeads(currentPage, filters, user.accessToken);
        } else {
            toast.error('Not authenticated. Please log in to refresh data.');
        }
    }, [user?.accessToken, fetchLeads, filters, toast]);


    const handleReviewAndClaim = useCallback(async (accessToken: string, lead: Lead) => {
        setClaimingLeadId(lead.id);
        try {
            const queryParams = new URLSearchParams({
                source: filters.source,
            });
            const response = await fetch(`${BASE_API_URL}/leads-center/${lead.id}?${queryParams.toString()}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (!response.ok) {
                throw new Error('Failed to fetch lead details');
            }
            const data: DetailedLead = await response.json();
            setLeadToEdit(data.data);
            setIsLeadFormOpen(true);
        } catch (error) {
            console.error('Error fetching lead details:', error);
            toaster.error('Failed to load lead details. Please try again.');
        } finally {
            setClaimingLeadId(null);
        }
    }, [filters.source]);

    const handleClaimSubmit = async (formData: any, accessToken: string, files: File[]) => {
        if (!leadToEdit) return;

        setClaimingLeadId(leadToEdit.id);
        setIsSaving(true);

        const processedFiles: {
            filename: string;
            mimeType: string;
            fileBase64: string; // Changed from 'base64' to 'fileBase64'
            isCompressed?: boolean; // Optional metadata
        }[] = [];

        // 1. Process files (Compression and Base64 Encoding)
        try {
            if (files.length > 0) {
                toaster.success(`Starting file processing for ${files.length} file(s)... This may take a moment.`);
            }

            // Process files sequentially to avoid memory issues with large batches
            for (const file of files) {
                try {
                    const isImage = file.type.startsWith('image/');
                    let fileToEncode: File | Blob = file;
                    let isCompressed = false;

                    // Compress images
                    if (isImage) {
                        toaster.info(`Compressing image: ${file.name}...`);
                        try {
                            fileToEncode = await compressImageFile(file, 0.8);
                            isCompressed = true;
                        } catch (compressionError) {
                            console.warn(`Compression failed for ${file.name}, using original:`, compressionError);
                            fileToEncode = file; // Use original if compression fails
                        }
                    }

                    // Convert to base64
                    const base64Data = await fileToBase64(fileToEncode);

                    processedFiles.push({
                        filename: file.name,
                        mimeType: file.type,
                        fileBase64: base64Data, // Match backend expected format
                        isCompressed,
                    });

                    const fileSizeKB = Math.round(fileToEncode.size / 1024);
                    toaster.success(`✓ Processed ${file.name} (${fileSizeKB} KB)`);
                } catch (fileError) {
                    console.error(`Error processing file ${file.name}:`, fileError);
                    toaster.error(`Failed to process ${file.name}`);
                    // Continue with other files instead of stopping
                }
            }

            if (processedFiles.length === 0 && files.length > 0) {
                throw new Error('All file processing failed');
            }

            if (processedFiles.length < files.length) {
                toaster.warning(`Processed ${processedFiles.length} of ${files.length} files`);
            }

        } catch (error: any) {
            console.error('File processing error:', error);
            toaster.error(`Failed to process files: ${error.message}`);
            setIsSaving(false);
            setClaimingLeadId(null);
            return;
        }

        // 2. Construct the final lead payload
        const finalPayload = {
            // Required lead fields
            clientName: formData.clientName,
            phone: formData.phone,
            productInterest: formData.productInterest,

            // Optional fields
            reminderDate: formData.reminderDate
                ? new Date(formData.reminderDate + 'T12:00:00.000Z').toISOString()
                : undefined,

            status: "In Progress",

            // File upload configuration
            uploadStage: formData.uploadStage || "lead-files", // Default to lead-files, can be: lead-files, lead-photos, lead-documents
            files: processedFiles, // Files will be uploaded automatically

            // Original source tracking
            originalSource: leadToEdit.source,
            sheetLeadId: leadToEdit.id,
            sheetTimestamp: leadToEdit.timestamp,
            email: leadToEdit.email,
        };

        // 3. API Call - Single request creates lead AND uploads files
        try {
            toaster.info('Creating lead in LMS...');

            const response = await fetch(`${BASE_API_URL}/leads`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify(finalPayload),
            });

            if (!response.ok) {
                const errorData = await response.json();

                // Handle specific error cases
                if (response.status === 409) {
                    throw new Error(errorData.error || 'Lead already exists with In Progress status');
                } else if (response.status === 400) {
                    throw new Error(errorData.error || 'Invalid lead data');
                } else {
                    throw new Error(errorData.error || 'Failed to create lead in LMS');
                }
            }

            const result = await response.json();

            // Check if files were uploaded successfully
            if (result.success) {
                const fileUploadResult = result.data?.fileUploadResult;

                if (fileUploadResult) {
                    toaster.success(`Lead created with ${fileUploadResult.totalFilesUploaded} file(s) uploaded!`);
                } else if (processedFiles.length > 0) {
                    toaster.warning('Lead created, but file upload may have failed. Check the lead details.');
                } else {
                    toaster.success('Lead claimed and created in LMS successfully.');
                }

                // Update local state
                setLeads(leads.map((l) =>
                    l.id === leadToEdit.id ? { ...l, isClaimed: true } : l
                ));

                setIsLeadFormOpen(false);

                // Refresh data
                refreshLeads();
                await fetchUserAccess(accessToken);

            } else {
                throw new Error(result.error || 'Unknown error occurred');
            }

        } catch (error: any) {
            console.error('Error creating lead in LMS:', error);

            // Provide user-friendly error messages
            let errorMessage = 'Failed to create lead in LMS.';

            if (error.message.includes('409') || error.message.includes('already exists')) {
                errorMessage = 'A lead with this phone number already exists in In Progress status.';
            } else if (error.message.includes('network') || error.message.includes('fetch')) {
                errorMessage = 'Network error. Please check your connection and try again.';
            } else if (error.message) {
                errorMessage += ` ${error.message}`;
            }

            toaster.error(errorMessage);

        } finally {
            setClaimingLeadId(null);
            setIsSaving(false);
        }
    };



    const handleViewDetails = useCallback(async (accessToken: string, lead: Lead) => {
        setIsLoadingLeads(true);
        try {
            const queryParams = new URLSearchParams({
                source: filters.source,
            });
            const response = await fetch(`${BASE_API_URL}/leads-center/${lead.id}?${queryParams.toString()}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (!response.ok) {
                throw new Error('Failed to fetch lead details');
            }
            const data: DetailedLead = await response.json();
            setLeadToEdit(data.data);
            setIsLeadFormOpen(true);
        } catch (error) {
            console.error('Error fetching lead details:', error);
            toaster.error('Failed to load lead details. Please try again.');
        } finally {
            setIsLoadingLeads(false);
        }
    }, [filters.source]);

    // Optimized Snippet 1
    useEffect(() => {
        if (user?.accessToken) {
            fetchUserAccess(user.accessToken);
        }
        // Only re-run when the accessToken itself changes, not the whole user object.
    }, [fetchUserAccess, user?.accessToken]);


    // Fetch leads only if user profile is available
    useEffect(() => {
        if (user?.accessToken && userAccess) { // It's good practice to check all dependencies
            fetchLeads(1, filters, user.accessToken);
        }
        // We destructure `source` and `date` from filters to have stable dependencies.
        // We also specify `user.accessToken` instead of the whole `user` object.
    }, [filters.source, filters.date, userAccess, fetchLeads, user?.accessToken, loadingApp]);


    // HOOK: Unconditional execution (Fixes Rules of Hooks violation)
    const metrics = useMemo(() => {
        if (!progressData) return [];

        // 1. Total Raw Leads (Dynamic/Cached Trend)
        const RAW_LEADS_CONFIG: MetricCardProps = {
            title: "Total Raw Leads",
            value: totalRawLeads,
            icon: BarChart,
            colorBase: 'indigo',
            statusIcon: progressData.trendIcon,
            statusText: progressData.trendText,
        };

        // 2. My Claimed Leads (Experimental/Unstable)
        const CLAIMED_LEADS_CONFIG: MetricCardProps = {
            title: "My Claimed Leads (Experimental)",
            value: "---",
            icon: AlertTriangle,
            colorBase: 'amber',
            isExperimental: true,
            statusIcon: AlertTriangle,
            statusText: "Data Unstable",
        };

        return [RAW_LEADS_CONFIG, CLAIMED_LEADS_CONFIG];
    }, [totalRawLeads, progressData]);

    // HOOK: Caching Logic for progress data (runs once) - RETAINED
    useEffect(() => {
        const loadOrGenerateCache = (): void => {
            const now: number = Date.now();
            let stableData: ProgressData;

            try {
                const cachedItem: string | null = localStorage.getItem(CACHE_KEY);

                if (cachedItem) {
                    const cached: { progress: ProgressData, cacheTime: number } = JSON.parse(cachedItem);
                    const cacheTime: number = cached.cacheTime || 0;

                    if (now - cacheTime < CACHE_DURATION_MS) {
                        stableData = cached.progress;
                    } else {
                        stableData = generateProgressData();
                        localStorage.setItem(CACHE_KEY, JSON.stringify({ progress: stableData, cacheTime: now }));
                    }
                } else {
                    stableData = generateProgressData();
                    localStorage.setItem(CACHE_KEY, JSON.stringify({ progress: stableData, cacheTime: now }));
                }

                setProgressData(stableData);
            } catch (error) {
                console.error("LocalStorage access failed:", error);
                setProgressData(generateProgressData());
            }
        };

        loadOrGenerateCache();
    }, []);




    // --- Simplified Loading State ---
    if (!progressData) {
        return (
            <div className={`font-inter p-6 sm:p-12 lg:p-16 min-h-[300px] bg-gray-50 dark:bg-slate-900 transition-colors duration-500`}>
                <div className="max-w-7xl mx-auto">
                    <div className={`text-center text-lg dark:text-slate-400 p-20 transition-colors duration-500`}>
                        <div className="flex items-center justify-center space-x-3">
                            <div className="w-3 h-3 bg-indigo-500 rounded-full animate-pulse transition-colors duration-500"></div>
                            <span>Loading metrics...</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const resetFilters = () => {
        setFilters({
            source: userAccess?.allowedSources.includes('combined') ? 'combined' : (userAccess?.allowedSources[0] || ''),
            date: '',
            search: '',
        });
    };




    const { pageActions } = createSimplePageConfig(
        user,
        isLoadingLeads,
        refreshLeads,
    );
    // Logout handler
    const handleLogout = () => {
        localStorage.clear(); // Clear all local storage including tokens
        setLoadingApp(false); // Update logged in state
        setUser(null); // Clear user profile
        router.replace('/login'); // Redirect to login page
    };




    return (


        <>

            <UniversalNavBar
                currentUserProfile={user}
                isLoggedIn={!user}
                handleLogout={handleLogout}
                searchTerm={filters.search}
                setSearchTerm={(value: string) =>
                    setFilters((prev) => ({ ...prev, search: value }))
                }
                searchPlaceholder="Search dashboard..."
                isMenuOpen={isMenuOpen}
                setIsMenuOpen={setIsMenuOpen}
                currentPath={pathname}
                pageActions={pageActions}
            />




            <div className="min-h-screen flex flex-col items-center p-4 sm:p-8 ">
                <div className="max-w-7xl w-full">

                    {/* Grid Layout: Uses sm:grid-cols-2 lg:grid-cols-3 as requested */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
                        {metrics.map((metric, index) => (
                            <MetricCard
                                key={index}
                                icon={metric.icon}
                                title={metric.title}
                                value={metric.value}
                                statusIcon={metric.statusIcon}
                                statusText={metric.statusText}
                                colorBase={metric.colorBase}
                                isExperimental={metric.isExperimental} />
                        ))}
                    </div>

                    {/* Filters Section (Clean and Organized) */}
                    <div className="mb-10 p-6 rounded-2xl border border-gray-200 shadow-lg">
                        <h2 className="text-2xl font-semibold mb-5 border-b pb-3 flex items-center gap-2">
                            <Search className='w-5 h-5 text-indigo-600' /> Lead Filters
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="source" className="font-medium">Source</Label>
                                <Select value={filters.source} onValueChange={(value) => setFilters({ ...filters, source: value, search: '' })}>
                                    <SelectTrigger id="source" className="bg-gray-50 border-gray-300 focus:ring-indigo-500 rounded-lg">
                                        <SelectValue placeholder="Select Source" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {userAccess?.allowedSources.map((source) => (
                                            <SelectItem key={source} value={source}>
                                                {source.charAt(0).toUpperCase() + source.slice(1)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="date" className="font-medium">Date</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={`w-full justify-start text-left font-normal`}
                                        >
                                            <Calendar className="mr-2 h-4 w-4" />
                                            {filters.date ? format(filters.date, "PPP") : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <CalendarComponent
                                            mode="single"
                                            selected={filters.date ? new Date(filters.date) : undefined}
                                            onSelect={(selectedDate) => {
                                                if (selectedDate) {
                                                    setFilters({
                                                        ...filters,
                                                        date: selectedDate.toISOString().split("T")[0], // Converts to YYYY-MM-DD
                                                        search: '',
                                                    });
                                                }
                                            }}
                                        />
                                    </PopoverContent>
                                    </Popover>

                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="search" className="font-medium">Quick Search (Name, Phone, Email)</Label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                    <Input
                                        id="search"
                                        type="text"
                                        placeholder="Start typing to search..."
                                        value={filters.search}
                                        onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                                        className="pl-9 bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500 focus:ring-indigo-500 rounded-lg" />
                                </div>
                            </div>
                        </div>
                        <div className="mt-6 flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 border-t pt-4">
                            <Button onClick={refreshLeads} variant="outline" className="border-indigo-300 text-indigo-600 hover:bg-indigo-50 w-full sm:w-auto font-semibold rounded-lg">
                                <RefreshCcw className="mr-2 h-4 w-4" /> Refresh Data
                            </Button>
                            <Button onClick={resetFilters} variant="outline" className="border-gray-300 hover:bg-gray-100 w-full sm:w-auto font-semibold rounded-lg">
                                <XCircle className="mr-2 h-4 w-4" /> Clear Filters
                            </Button>
                        </div>
                    </div>

                    {/* Leads Grid */}
                    <h2 className="text-2xl font-semibold mb-5 flex items-center gap-2">
                        <Users className='w-5 h-5 text-indigo-600' /> New Leads ({totalRawLeads})
                    </h2>
                    {isLoadingLeads ? (
                        <LoadingSkeleton />
                    ) : leads.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3  gap-6 animate-fadeIn">
                            {leads.map((lead) => (
                                <LeadCard
                                    key={lead.id}
                                    lead={lead}
                                    onReviewAndClaim={(lead) => {
                                        if (!user || !user.accessToken) {
                                            // Handle the error here, maybe show a toast message or throw
                                            console.error("Authentication token missing during submission.");
                                            return;
                                        }
                                        handleReviewAndClaim(user?.accessToken, lead)
                                    }
                                    }
                                    onDetails={(lead) => {
                                        if (!user || !user.accessToken) {
                                            // Handle the error here, maybe show a toast message or throw
                                            console.error("Authentication token missing during submission.");
                                            return;
                                        }
                                        handleViewDetails(user?.accessToken, lead)
                                    }
                                    }
                                    isClaiming={claimingLeadId === lead.id} />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-16 bg-white border border-gray-200 rounded-xl shadow-lg mt-8">
                            <AlertCircle className="w-10 h-10 mx-auto mb-4 text-orange-500" />
                            <p className="text-xl font-medium text-gray-600">No leads match your current criteria.</p>
                            <p className="text-gray-400 mt-1">Try resetting your filters or refreshing the data.</p>
                        </div>
                    )}

                    {/* Pagination Controls (Modern Styling) */}
                    {totalPages > 1 && (
                        <div className="flex justify-center items-center flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 mt-10 p-4 bg-white rounded-xl shadow-md border border-gray-200">
                            <Button
                                onClick={() => {
                                    // Now we know accessToken exists if the button is clickable
                                    if (user?.accessToken) {
                                        fetchLeads(currentPage - 1, filters, user.accessToken);
                                    }
                                }}
                                // Disable the button if there's no token
                                disabled={!user?.accessToken || currentPage === 1 || isLoadingLeads}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95 transition-transform w-full sm:w-auto rounded-lg font-semibold"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" /> Previous Page
                            </Button>

                            <span className="text-lg  font-semibold tabular-nums">
                                Page <span className='text-indigo-600'>{currentPage}</span> of {totalPages}
                            </span>
                            <Button
                                onClick={() => {
                                    if (!user || !user.accessToken) {
                                        // Handle the error here, maybe show a toast message or throw
                                        console.error("Authentication token missing during submission.");
                                        return;
                                    }
                                    fetchLeads(currentPage + 1, filters, user?.accessToken)
                                }
                                }
                                disabled={currentPage === totalPages || isLoadingLeads} className="bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95 transition-transform w-full sm:w-auto rounded-lg font-semibold">
                                Next Page <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </div>
                    )}
                </div>

                {/* Lead Review/Claim Dialog */}
                <LeadFormDialog
                    isOpen={isLeadFormOpen}
                    onOpenChange={(open) => {
                        setIsLeadFormOpen(open);
                        if (!open) setLeadToEdit(null);
                    }}
                    onSubmit={(data, files) => {
                        if (!user?.accessToken) return; // safely exit if token missing
                        handleClaimSubmit(data, user.accessToken, files);
                    }}
                    isSaving={isSaving}
                    initialData={leadToEdit}
                />

            </div></>
    );
};

export default App;
