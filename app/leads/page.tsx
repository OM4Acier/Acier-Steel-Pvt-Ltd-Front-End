"use client";

import React, { useState, useEffect, useCallback, JSX, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  User as UserIcon, Calendar, CheckCircle, XCircle, Clock, Plus, Edit, Trash2,
  Phone, History, Loader2, Star, MoreVertical, Upload, Flame,
  Eye, X, AlertTriangle, Paperclip, Bell, Download, MessageCircle, PhoneCall,
  TrendingUp, LayoutGrid, Filter
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { UserProfile } from '@/types/rbac.types';
import { NavButton } from '@/components/NavButton';
import { NavbarExtension } from '@/context/NavbarExtensionContext';
import { useUser } from '@clerk/react';
import { usePermissionStore } from '@/stores/permission-store';
import { NAV_COLOR_MAP } from '@/lib/config/colors';

import { leadsApi } from '@/lib/api/endpoints/leadsApi';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- WIP: LeadCardV2 swap-in (commented usage below)
import LeadCardV2 from './components/LeadCardV2';

const leadApiService = leadsApi;

// ===========================================================================
// TYPES
// ===========================================================================

type LeadStatus = 'In Progress' | 'Completed' | 'Closed';
type LeadPriority = 'High' | 'Medium' | 'Low';

interface EditHistoryEntry {
  timestamp: string | number;
  editorName: string;
  description: string;
}

interface FileMetadata {
  fileId: string;
  filename: string;
  fileUrl?: string;
}

interface ExistingLeadInfo {
  createdByName?: string;
  daysSinceCreated: number;
}

interface Lead {
  isHot?: boolean;
  id: string;
  leadId: string;
  clientName: string;
  phone: string;
  productInterest: string;
  status: LeadStatus;
  priority?: LeadPriority;
  closingNote?: string;
  reminderDate?: string;
  editHistory?: EditHistoryEntry[];
  uploadedFiles?: FileMetadata[];
  createdBy: string;
  createdByName: string;
  existingLeads?: ExistingLeadInfo[];
  createdAt?: string;
  updatedAt?: string;
}

type SortableField = 'createdAt' | 'updatedAt' | 'clientName' | 'status';
type SortOrder = 'asc' | 'desc';

interface LeadPage {
  data: Lead[];
  nextCursor: string | null;
  hasNext: boolean;
}

// ===========================================================================
// HELPERS
// ===========================================================================

// ===========================================================================
// LeadCard
// ===========================================================================

interface LeadCardProps {
  lead: Lead;
  groupColor: string;
  onSelectLead: (lead: Lead) => void;
  onAction: (action: 'mark-hot' | 'convert' | 'reschedule' | 'close' | 'delete', lead: Lead, details?: any) => void;
  isActionLoading: false | string;
  currentUser: UserProfile | null;
  onOpenRescheduleDialog: (lead: Lead) => void;
  onOpenLeadDetailsDialogWithCloseNote: (lead: Lead) => void;
}

const LeadCard = React.memo<LeadCardProps>(({
  lead,
  groupColor,
  onSelectLead,
  onAction,
  isActionLoading,
  currentUser,
  onOpenRescheduleDialog,
  onOpenLeadDetailsDialogWithCloseNote,
}) => {
  const formattedCreationDate = lead.createdAt
    ? new Date(lead.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'N/A';
  const formattedReminderDate = lead.reminderDate
    ? new Date(lead.reminderDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  const getStatusBadgeColor = (status: LeadStatus) => {
    switch (status) {
      case 'Completed': return 'bg-green-500 text-white';
      case 'Closed': return 'bg-red-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const hotLeadIconColor = lead.isHot ? 'text-red-500' : 'text-gray-400 dark:text-gray-500';

  return (
    <Card
      id={`lead-card-${lead.id}`}
      onClick={() => onSelectLead(lead)}
      className={`cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 rounded-xl overflow-hidden bg-white dark:bg-gray-800 border-l-4 ${groupColor} min-w-[330px] flex-shrink-0`}
    >
      <CardHeader className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800/70">
        <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-50 line-clamp-1 flex-grow">
          {lead.clientName}
        </CardTitle>

        <div className="flex items-center space-x-3 flex-shrink-0">
          <span className="font-mono text-[10px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/50 rounded-full px-2.5 py-0.5 border border-gray-200 dark:border-gray-700">
            {lead.leadId}
          </span>

          {lead.isHot && (
            <span className="text-[10px] uppercase tracking-widest rounded-full px-3 py-1 shadow-lg transition-transform duration-300 transform hover:scale-[1.03] flex items-center bg-red-600 text-white shadow-red-500/50">
              <span className="mr-1">🔥</span> HIGH PRIORITY
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-2"><Phone className="w-4 h-4" /><span>{lead.phone}</span></div>
        <div className="flex items-center gap-2"><Clock className="w-4 h-4" /><span>Created: {formattedCreationDate}</span></div>
        <div className="flex items-center gap-2"><UserIcon className="w-4 h-4" /><span>By: {lead.createdByName || lead.createdBy}</span></div>
        {formattedReminderDate && (
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-medium">
            <Calendar className="w-4 h-4" />
            <span>Reminder: {formattedReminderDate}</span>
          </div>
        )}
        {lead.existingLeads && lead.existingLeads.length > 0 && (
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium">
            <History className="w-4 h-4" />
            <Tooltip>
              <TooltipTrigger asChild>
                <span>{lead.existingLeads.length} Existing Leads</span>
              </TooltipTrigger>
              <TooltipContent>
                <ul className="list-disc pl-4">
                  {lead.existingLeads.map((el, idx) => (
                    <li key={idx}>{el.createdByName || 'Unknown'} - {el.daysSinceCreated} days ago</li>
                  ))}
                </ul>
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </CardContent>

      <CardFooter className="p-2 !pt-2 border-t bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-1">
        {lead.status === 'In Progress' && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); window.open(`tel:${lead.phone}`, '_blank', 'noopener,noreferrer'); }}>
                  <PhoneCall className="w-4 h-4 text-blue-500" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Call Lead</p></TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/91${lead.phone}`, '_blank', 'noopener,noreferrer'); }}>
                  <MessageCircle className="w-4 h-4 text-green-500" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>WhatsApp Lead</p></TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onOpenRescheduleDialog(lead); }} disabled={isActionLoading === lead.id}>
                  <Calendar className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Re-schedule</p></TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => { e.stopPropagation(); onAction('mark-hot', lead); }}
                  disabled={isActionLoading === lead.id}
                  className={hotLeadIconColor}
                >
                  {isActionLoading === lead.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flame className="w-4 h-4 text-blue-500" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>{lead.isHot ? 'Mark as Not Hot' : 'Mark as Hot'}</p></TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onAction('convert', lead); }} disabled={isActionLoading === lead.id}>
                  {isActionLoading === lead.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 text-green-500" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Mark as Won</p></TooltipContent>
            </Tooltip>
          </>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" onClick={(e) => e.stopPropagation()}>
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
            {lead.status === 'In Progress' && (
              <DropdownMenuItem onClick={() => onOpenLeadDetailsDialogWithCloseNote(lead)} disabled={isActionLoading === lead.id}>
                {isActionLoading === lead.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />} Close Lead
              </DropdownMenuItem>
            )}
            {currentUser?.role === 'super-admin' && (
              <DropdownMenuItem onClick={() => onAction('delete', lead)} disabled={isActionLoading === lead.id} className="text-red-500">
                {isActionLoading === lead.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />} Delete Lead
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {(lead.status === 'Completed' || lead.status === 'Closed') && (
          <Badge className={getStatusBadgeColor(lead.status)}>{lead.status}</Badge>
        )}
      </CardFooter>
    </Card>
  );
});
LeadCard.displayName = 'LeadCard';

// ===========================================================================
// MAIN PAGE COMPONENT
// ===========================================================================

export default function LeadManagementPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isCreateLeadDialogOpen, setIsCreateLeadDialogOpen] = useState<boolean>(false);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [isActionLoading, setIsActionLoading] = useState<false | string>(false);

  // Reschedule dialog
  const [rescheduleTargetLead, setRescheduleTargetLead] = useState<Lead | null>(null);
  const [isRescheduleDialogOpen, setIsRescheduleDialogOpen] = useState(false);
  const [showClosingNoteForLead, setShowClosingNoteForLead] = useState<string | null>(null);

  // --- Filters (client-side) ---
  const [filterStart, setFilterStart] = useState<string | undefined>();
  const [filterEnd, setFilterEnd] = useState<string | undefined>();

  // Debounced date filter values
  const [rawFilterStart, setRawFilterStart] = useState<string | undefined>();
  const [rawFilterEnd, setRawFilterEnd] = useState<string | undefined>();

  // --- View mode ---
  const [viewMode, setViewMode] = useState<'normal' | 'by-creator'>('normal');

  // --- Sorting ---
  const [sortBy, setSortBy] = useState<SortableField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const role = usePermissionStore(s => s.role);

  const currentUserProfile = useMemo(() => {
    if (!clerkUser) return null;
    return {
      id: clerkUser.id,
      name: clerkUser.fullName || clerkUser.username || 'User',
      email: clerkUser.primaryEmailAddress?.emailAddress || '',
      role: role || (clerkUser.publicMetadata?.role as string) || 'sales',
      accessToken: null,
    } as UserProfile;
  }, [clerkUser, role]);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // ------------------------------------------------------------------------
  // FETCH LEADS
  // -------------------------------------------------------------------------

  const requestIdRef = useRef(0);

  const fetchLeads = useCallback(async (): Promise<Lead[]> => {
    // Each call gets a monotonically increasing id. Any fetch whose id is not
    // the latest when it resolves is abandoned — its result is discarded so it
    // cannot overwrite a newer fetch's state.
    const requestId = ++requestIdRef.current;

    setIsFetching(true);
    try {
      const PAGE_SIZE = 100;
      const MAX_PAGES = 25;

      const all: Lead[] = [];
      let cursor: string | null = null;
      let page = 0;

      while (page < MAX_PAGES) {
        const result: LeadPage = await leadApiService.fetchLeads({
          limit: PAGE_SIZE,
          cursor,
        });

        // A newer fetch started while this one was in flight — abandon.
        if (requestId !== requestIdRef.current) return [];

        all.push(...result.data);

        if (!result.hasNext || !result.nextCursor) break;
        cursor = result.nextCursor;
        page++;
      }

      // Final guard: only the latest fetch is allowed to write state.
      if (requestId !== requestIdRef.current) return [];

      setLeads(all);
      return all;
    } catch (error: any) {
      if (requestId !== requestIdRef.current) return [];
      if (error?.name === 'AbortError' || error?.name === 'CanceledError') return [];
      console.error('Error fetching Leads:', error);
      toast.error(`Failed to fetch Leads: ${error.message}`);
      return [];
    } finally {
      if (requestId === requestIdRef.current) {
        setIsFetching(false);
      }
    }
  }, [filterStart, filterEnd, sortBy, sortOrder]);

  // Refetch on filter change (and on initial user load)
  useEffect(() => {
    if (!clerkLoaded || !clerkUser) return;
    fetchLeads();
  }, [fetchLeads, clerkLoaded, clerkUser]);

  // -------------------------------------------------------------------------
  // EXPORT LEADS
  // -------------------------------------------------------------------------

  const handleExportLeads = useCallback(() => {
    if (leads.length === 0) {
      toast.info("No leads to export.");
      return;
    }

    const headers = ["Lead ID", "Client Name", "Phone", "Product Interest", "Status", "Hot", "Created By", "Created At", "Updated At", "Reminder Date"];
    const rows = leads.map(lead => [
      lead.leadId,
      lead.clientName,
      lead.phone,
      lead.productInterest.replace(/"/g, '""').replace(/\n/g, ' '),
      lead.status,
      lead.isHot ? "Yes" : "No",
      lead.createdByName,
      lead.createdAt ? new Date(lead.createdAt).toISOString() : "",
      lead.updatedAt ? new Date(lead.updatedAt).toISOString() : "",
      lead.reminderDate ? new Date(lead.reminderDate).toISOString().slice(0, 10) : "",
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${leads.length} leads to CSV.`);
  }, [leads]);

  // -------------------------------------------------------------------------
  // URL ACTION HANDLER
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (searchParams.get('action') === 'create') {
      setIsCreateLeadDialogOpen(true);
      const params = new URLSearchParams(searchParams.toString());
      params.delete('action');
      const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      router.replace(newUrl, { scroll: false });
    }
  }, [searchParams, pathname, router]);

  // -------------------------------------------------------------------------
  // LEAD ACTIONS
  // -------------------------------------------------------------------------

  const handleLeadAction = useCallback(async (
    action: 'convert' | 'mark-hot' | 'reschedule' | 'close' | 'delete' | 'update',
    lead: Lead,
    details?: any,
  ) => {
    if (!currentUserProfile) {
      toast.error("User not authenticated. Please log in.");
      return;
    }
    setIsActionLoading(lead.id);
    try {
      let newHistoryEntry: EditHistoryEntry | null = null;
      let updatedFields: Partial<Omit<Lead, 'id' | 'editHistory'>> = {};

      switch (action) {
        case 'convert':
          updatedFields = { status: 'Completed' };
          newHistoryEntry = { timestamp: Date.now(), editorName: currentUserProfile.name || currentUserProfile.email, description: "Lead marked as Completed" };
          break;
        case 'mark-hot': {
          const newIsHotStatus = !lead.isHot;
          updatedFields = { isHot: newIsHotStatus };
          newHistoryEntry = {
            timestamp: Date.now(),
            editorName: currentUserProfile.name || currentUserProfile.email,
            description: newIsHotStatus ? "Lead marked as HOT" : "Lead marked as NOT HOT",
          };
          break;
        }
        case 'reschedule': {
          const newReminderDate = details?.newDate || lead.reminderDate;
          updatedFields = { reminderDate: newReminderDate };
          newHistoryEntry = { timestamp: Date.now(), editorName: currentUserProfile.name || currentUserProfile.email, description: `Rescheduled to ${newReminderDate}` };
          break;
        }
        case 'close':
          updatedFields = { status: 'Closed', closingNote: details.note };
          newHistoryEntry = { timestamp: Date.now(), editorName: currentUserProfile.name || currentUserProfile.email, description: `Lead closed: ${details.note}` };
          break;
        case 'delete':
          await leadApiService.deleteLead(lead.leadId);
          toast.success(`Lead ${lead.leadId} deleted.`);
          await fetchLeads();
          setSelectedLead(prev => (prev?.id === lead.id ? null : prev));
          setShowClosingNoteForLead(null);
          setIsActionLoading(false);
          return;
        case 'update':
          updatedFields = details.updatedFields;
          newHistoryEntry = details.newHistoryEntry;
          break;
      }

      await leadApiService.updateLead(lead.leadId, updatedFields, newHistoryEntry);
      toast.success(`Lead ${lead.leadId} updated.`);

      const refreshed = await fetchLeads();
      setSelectedLead(prev => {
        if (!prev || prev.id !== lead.id) return prev;
        return refreshed.find(l => l.id === lead.id) ?? prev;
      });
    } catch (error: any) {
      console.error(`Error performing action ${action} on lead ${lead.leadId}:`, error);
      toast.error(`Action failed: ${error.message}`);
    } finally {
      setShowClosingNoteForLead(null);
      setIsActionLoading(false);
    }
  }, [currentUserProfile, fetchLeads]);

  // -------------------------------------------------------------------------
  // ADD LEAD
  // -------------------------------------------------------------------------

  const handleAddLead = useCallback(async (
    formData: Omit<Lead, "id" | "leadId" | "status" | "editHistory" | "uploadedFiles" | "createdBy" | "createdByName">,
    filesToUpload: File[],
  ) => {
    if (!currentUserProfile) {
      toast.error("User not authenticated. Please log in.");
      return;
    }
    setIsActionLoading('create');
    try {
      const newLead = await leadApiService.addLead({
        ...formData,
        createdBy: currentUserProfile.email,
        createdByName: currentUserProfile.name || currentUserProfile.email,
      });

      if (filesToUpload.length > 0) {
        toast.info('Lead created. Uploading files...');
        const formattedFiles = await Promise.all(filesToUpload.map(file => compressAndConvertFile(file)));
        await leadApiService.uploadFile(newLead.leadId, formattedFiles);
        toast.success('Files uploaded successfully!');
      }

      toast.success('Lead created successfully!');
      setIsCreateLeadDialogOpen(false);
      await fetchLeads();
      setTimeout(() => {
        const card = document.getElementById(`lead-card-${newLead.id}`);
        card?.classList.add('animate-pulse-once');
      }, 100);
    } catch (error: any) {
      console.error("Error adding lead:", error);
      toast.error(`Failed to create lead: ${error.message}`);
    } finally {
      setIsActionLoading(false);
    }
  }, [currentUserProfile, fetchLeads]);

  // -------------------------------------------------------------------------
  // KEYBOARD SHORTCUT
  // -------------------------------------------------------------------------

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setIsCreateLeadDialogOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // -------------------------------------------------------------------------
  // DEBOUNCED FILTER STATE
  // -------------------------------------------------------------------------

  // Sync raw (immediate) date inputs to debounced values after 300ms idle
  useEffect(() => {
    const handler = setTimeout(() => {
      setFilterStart(rawFilterStart);
      setFilterEnd(rawFilterEnd);
    }, 300);
    return () => clearTimeout(handler);
  }, [rawFilterStart, rawFilterEnd]);

  // -------------------------------------------------------------------------
  // DERIVED GROUPS
  // -------------------------------------------------------------------------

  // Client-side filtering + sorting — avoids backend round-trips on every filter change
  const filteredAndSortedLeads = useMemo(() => {
    let result = leads;

    // Date range filter (by createdAt)
    if (filterStart) {
      const start = new Date(filterStart);
      result = result.filter(l => l.createdAt && new Date(l.createdAt) >= start);
    }
    if (filterEnd) {
      const end = new Date(filterEnd);
      result = result.filter(l => l.createdAt && new Date(l.createdAt) <= end);
    }

    // Client-side sort
    result = [...result].sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortBy) {
        case 'clientName':
          aVal = a.clientName; bVal = b.clientName; break;
        case 'status':
          aVal = a.status; bVal = b.status; break;
        default:
          aVal = a[sortBy] || '';
          bVal = b[sortBy] || '';
      }
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [leads, filterStart, filterEnd, sortBy, sortOrder]);

  const { newTodayLeads, reminderDueTodayLeads, needsAttentionLeads, upcomingFollowUpsLeads, completedClosedLeads } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const newToday: Lead[] = [];
    const reminderDue: Lead[] = [];
    const stale: Lead[] = [];
    const upcoming: Lead[] = [];
    const closed: Lead[] = [];

    filteredAndSortedLeads.forEach(lead => {
      const createdAt = new Date(lead.createdAt || 0);
      createdAt.setHours(0, 0, 0, 0);

      const reminderDate = lead.reminderDate ? new Date(lead.reminderDate) : null;
      if (reminderDate) reminderDate.setHours(0, 0, 0, 0);

      if (lead.status === 'Completed' || lead.status === 'Closed') {
        closed.push(lead);
        return;
      }

      if (createdAt.getTime() === today.getTime()) {
        newToday.push(lead);
        return;
      }

      if (reminderDate && reminderDate.getTime() === today.getTime()) {
        reminderDue.push(lead);
        return;
      }

      if (reminderDate && reminderDate.getTime() < today.getTime() && lead.status === 'In Progress') {
        stale.push(lead);
        return;
      }

      if (reminderDate && reminderDate.getTime() > today.getTime()) {
        upcoming.push(lead);
        return;
      }
    });

    return {
      newTodayLeads: newToday,
      reminderDueTodayLeads: reminderDue,
      needsAttentionLeads: stale,
      upcomingFollowUpsLeads: upcoming,
      completedClosedLeads: closed,
    };
  }, [filteredAndSortedLeads]);

  const groupedCompletedClosedLeads = useMemo(() => {
    return completedClosedLeads.reduce((acc, lead) => {
      const date = new Date(lead.updatedAt || lead.createdAt || Date.now());
      const groupKey = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      if (!acc[groupKey]) acc[groupKey] = [];
      acc[groupKey].push(lead);
      return acc;
    }, {} as Record<string, Lead[]>);
  }, [completedClosedLeads]);

  // --- By Creator grouping ---
  const leadsGroupedByCreator = useMemo(() => {
    const map = new Map<string, {
      createdBy: string;
      createdByName: string;
      leads: Lead[];
      inProgress: number;
      completed: number;
      closed: number;
    }>();

    for (const lead of filteredAndSortedLeads) {
      const key = lead.createdBy;
      let entry = map.get(key);
      if (!entry) {
        entry = {
          createdBy: lead.createdBy,
          createdByName: lead.createdByName || lead.createdBy,
          leads: [],
          inProgress: 0,
          completed: 0,
          closed: 0,
        };
        map.set(key, entry);
      }

      entry.leads.push(lead);

      if (lead.status === 'In Progress') entry.inProgress += 1;
      else if (lead.status === 'Completed') entry.completed += 1;
      else if (lead.status === 'Closed') entry.closed += 1;
    }

    return Array.from(map.values()).sort((a, b) => b.leads.length - a.leads.length);
  }, [filteredAndSortedLeads]);

  // -------------------------------------------------------------------------
  // DIALOG HANDLERS
  // -------------------------------------------------------------------------

  const handleOpenRescheduleDialog = useCallback((lead: Lead) => {
    setRescheduleTargetLead(lead);
    setIsRescheduleDialogOpen(true);
  }, []);

  const handleOpenLeadDetailsDialogWithCloseNote = useCallback((lead: Lead) => {
    setSelectedLead(lead);
    setShowClosingNoteForLead(lead.id);
  }, []);

  // -------------------------------------------------------------------------
  // RENDER HELPERS
  // -------------------------------------------------------------------------

  const renderGroupedSection = (
    title: string,
    sectionLeads: Lead[],
    color: string,
    icon: JSX.Element,
    subtitle?: string,
    stats?: { inProgress: number; completed: number; closed: number },
  ) => {
    if (sectionLeads.length === 0) return null;

    return (
      <Card className="self-start rounded-2xl overflow-hidden shadow-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col">
        <CardHeader
          className={`px-4 py-2 text-white text-lg rounded-sm font-semibold flex items-start justify-between rounded-t-xl flex-shrink-0 gap-3 ${color.replace(
            "border-",
            "bg-"
          )}`}
        >
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold flex items-center gap-2 truncate">
              {icon}
              <span className="truncate">{title}</span>
            </h2>

            {subtitle && (
              <p className="text-xs opacity-80 truncate mt-0.5 font-normal">
                {subtitle}
              </p>
            )}

            {stats && (
              <div
                className="flex flex-wrap gap-1.5 mt-2"
                aria-label="Section statistics"
              >
                <span className="text-[10px] uppercase tracking-wider bg-white/20 backdrop-blur-sm rounded-full px-2 py-0.5 font-semibold">
                  In Progress: {stats.inProgress}
                </span>

                <span className="text-[10px] uppercase tracking-wider bg-white/20 backdrop-blur-sm rounded-full px-2 py-0.5 font-semibold">
                  Won: {stats.completed}
                </span>

                <span className="text-[10px] uppercase tracking-wider bg-white/20 backdrop-blur-sm rounded-full px-2 py-0.5 font-semibold">
                  Closed: {stats.closed}
                </span>
              </div>
            )}
          </div>

          <Badge
            className="bg-white text-gray-800 font-bold px-3 py-1 rounded-full flex-shrink-0"
            aria-label={`${sectionLeads.length} leads in ${title}`}
          >
            {sectionLeads.length}
          </Badge>
        </CardHeader>

        <CardContent className="relative p-0">
          <div
            className="max-h-[850px] overflow-y-auto p-4 flex flex-col gap-4"
            tabIndex={0}
            role="list"
            aria-label={`${title} leads`}
          >
            {sectionLeads.map((lead) => (
              <div key={lead.id} role="listitem" className="lead-scroll-card">
                <LeadCard
                  lead={lead}
                  groupColor={color}
                  onSelectLead={setSelectedLead}
                  onAction={handleLeadAction}
                  isActionLoading={isActionLoading}
                  currentUser={currentUserProfile}
                  onOpenRescheduleDialog={handleOpenRescheduleDialog}
                  onOpenLeadDetailsDialogWithCloseNote={
                    handleOpenLeadDetailsDialogWithCloseNote
                  }
                />

                {/* <LeadCardV2
                  clientName={lead.clientName}
                  leadId={lead.leadId}
                  phone={lead.phone}
                  isHot={lead.isHot}
                  reminderDate={lead.reminderDate}
                  createdDate={lead.createdAt}
                  createdByName={lead.createdByName}
                  onMarkWon={() => handleLeadAction('convert', lead)}
                  onSort={() => handleLeadAction('mark-hot', lead)}
                  onCall={() => window.open(`tel:${lead.phone}`, '_blank', 'noopener,noreferrer')}
                  onWhatsApp={() => window.open(`https://wa.me/91${lead.phone}`, '_blank', 'noopener,noreferrer')}
                  onEditReminder={() => handleOpenRescheduleDialog(lead)}
                  onToggleHot={() => handleLeadAction('mark-hot', lead)}
                  onOpenDetail={() => setSelectedLead(lead)}
                /> */}
              </div>
            ))}
          </div>

          {/* Fixed viewport edges */}
          <div
            aria-hidden="true"
            className="
        pointer-events-none
        absolute inset-x-0 top-0 z-20
        h-8
        bg-gradient-to-b
        from-white via-white/55 to-transparent
        backdrop-blur-[2px]
        dark:from-gray-800 dark:via-gray-800/95
      "
          />

          <div
            aria-hidden="true"
            className="
        pointer-events-none
        absolute inset-x-0 bottom-0 z-20
        h-16
        bg-gradient-to-t
        from-white via-white/55 to-transparent
        backdrop-blur-[2px]
        dark:from-gray-800 dark:via-gray-800/95
      "
          />
        </CardContent>
      </Card>
    );
  };

  const hasActiveFilters = Boolean(filterStart || filterEnd);

  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------

  return (


    <TooltipProvider delayDuration={300}>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
        <NavbarExtension>
          <div className="flex items-center gap-2 flex-wrap pb-2">
            <NavButton
              type="crate"
              text="New Leads Entry"
              className={`${NAV_COLOR_MAP.red.navBase} hover:${NAV_COLOR_MAP.red.createHover}`}
              onClick={() => setIsCreateLeadDialogOpen(true)}
            />
            <NavButton
              type="refresh"
              onClick={() => fetchLeads()}
              isLoading={isFetching}
            />

            {/* Filter icon → Popover with all filter/sort/export options */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-8 rounded-full text-xs font-semibold gap-1.5 border border-stone-200 dark:border-stone-700 bg-[#fdf9f3] dark:bg-stone-800/90 shadow-[0_2px_10px_-2px_rgba(120,90,60,0.18)] transition-all hover:shadow-[0_4px_16px_-2px_rgba(120,90,60,0.28)]",
                    hasActiveFilters &&
                      "border-amber-300 bg-amber-50 text-amber-800 dark:text-amber-300 shadow-[0_2px_14px_-2px_rgba(217,158,44,0.4)]",
                  )}
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Filters</span>
                  {hasActiveFilters && (
                    <Badge className="bg-amber-500 text-white h-4 w-4 min-w-[16px] p-0 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm">
                      !
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-[22rem] p-0 rounded-3xl border border-stone-200/70 dark:border-stone-800/70 shadow-[0_24px_70px_-20px_rgba(120,90,60,0.35)] overflow-hidden relative"
              >
                {/* Warm off-white radial surface — clean white to warm off-white */}
                <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_top_left,#ffffff_0%,#fdf9f3_45%,#f4ede2_100%)] dark:bg-[radial-gradient(120%_120%_at_top_left,#2a2723_0%,#211d19_45%,#171411_100%)]" />
                {/* Soft studio lighting from upper left — no harsh shadows */}
                <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.85)_0%,rgba(255,255,255,0)_45%)] dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0)_45%)]" />

                {/* Faint watermark element — center background, 8% opacity */}
                <Filter
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-44 h-44 text-stone-600 dark:text-stone-300 pointer-events-none select-none opacity-[0.08]"
                  strokeWidth={0.75}
                />

                <div className="relative p-5 space-y-6 text-sm">
                  {/* Header — top text zone */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="h-8 w-8 rounded-2xl bg-amber-100/80 dark:bg-amber-900/40 flex items-center justify-center shadow-[0_4px_12px_-4px_rgba(217,158,44,0.45)]">
                        <Filter className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      </span>
                      <span className="text-sm font-bold tracking-wide text-stone-800 dark:text-stone-100">
                        Filters
                      </span>
                    </div>
                    {hasActiveFilters && (
                      <Badge className="bg-amber-100/90 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 font-semibold px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-widest border border-amber-200/60 dark:border-amber-800/60">
                        Active
                      </Badge>
                    )}
                  </div>

                  {/* VIEW — balanced two-option segmented control */}
                  <section className="space-y-2">
                    <h4 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400 dark:text-stone-500">
                      <LayoutGrid className="w-3 h-3" />
                      View
                    </h4>
                    <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-stone-100/90 dark:bg-stone-800/70 p-1.5 shadow-[inset_0_1px_3px_rgba(120,90,60,0.12)]">
                      <button
                        type="button"
                        onClick={() => setViewMode('normal')}
                        className={cn(
                          'h-9 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all',
                          viewMode === 'normal'
                            ? 'bg-white text-stone-800 shadow-[0_6px_16px_-6px_rgba(120,90,60,0.4)]'
                            : 'text-stone-400 dark:text-stone-500 hover:bg-white/70 dark:hover:bg-stone-700/60 hover:text-stone-700 dark:hover:text-stone-200',
                        )}
                      >
                        <LayoutGrid className="w-3.5 h-3.5" />
                        <span>Normal</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('by-creator')}
                        className={cn(
                          'h-9 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all',
                          viewMode === 'by-creator'
                            ? 'bg-white text-stone-800 shadow-[0_6px_16px_-6px_rgba(120,90,60,0.4)]'
                            : 'text-stone-400 dark:text-stone-500 hover:bg-white/70 dark:hover:bg-stone-700/60 hover:text-stone-700 dark:hover:text-stone-200',
                        )}
                      >
                        <UserIcon className="w-3.5 h-3.5" />
                        <span>By Creator</span>
                      </button>
                    </div>
                  </section>

                  {/* SORT — field select + symmetric direction control */}
                  <section className="space-y-2">
                    <h4 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400 dark:text-stone-500">
                      <TrendingUp className="w-3 h-3" />
                      Sort
                    </h4>
                    <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortableField)}>
                      <SelectTrigger className="h-10 rounded-2xl text-xs font-semibold border-stone-200/80 dark:border-stone-700 bg-white/80 dark:bg-stone-800/80 shadow-[0_4px_12px_-6px_rgba(120,90,60,0.3)]">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="createdAt">Created Date</SelectItem>
                        <SelectItem value="updatedAt">Updated Date</SelectItem>
                        <SelectItem value="clientName">Client Name</SelectItem>
                        <SelectItem value="status">Status</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-stone-100/90 dark:bg-stone-800/70 p-1.5 shadow-[inset_0_1px_3px_rgba(120,90,60,0.12)]">
                      <button
                        type="button"
                        onClick={() => setSortOrder('asc')}
                        className={cn(
                          'h-9 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all',
                          sortOrder === 'asc'
                            ? 'bg-white text-stone-800 shadow-[0_6px_16px_-6px_rgba(120,90,60,0.4)]'
                            : 'text-stone-400 dark:text-stone-500 hover:bg-white/70 dark:hover:bg-stone-700/60 hover:text-stone-700 dark:hover:text-stone-200',
                        )}
                      >
                        <TrendingUp className="w-3.5 h-3.5 rotate-180" />
                        <span>Ascending</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSortOrder('desc')}
                        className={cn(
                          'h-9 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all',
                          sortOrder === 'desc'
                            ? 'bg-white text-stone-800 shadow-[0_6px_16px_-6px_rgba(120,90,60,0.4)]'
                            : 'text-stone-400 dark:text-stone-500 hover:bg-white/70 dark:hover:bg-stone-700/60 hover:text-stone-700 dark:hover:text-stone-200',
                        )}
                      >
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>Descending</span>
                      </button>
                    </div>
                  </section>

                  {/* DATE RANGE — floating calendar object */}
                  <section className="space-y-2">
                    <h4 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-stone-400 dark:text-stone-500">
                      <Calendar className="w-3 h-3" />
                      Date Range
                    </h4>
                    <CalendarComponent
                      mode="range"
                      selected={{
                        from: rawFilterStart ? new Date(rawFilterStart) : undefined,
                        to: rawFilterEnd ? new Date(rawFilterEnd) : undefined,
                      }}
                      onSelect={(range) => {
                        setRawFilterStart(range?.from?.toISOString());
                        setRawFilterEnd(range?.to?.toISOString());
                      }}
                      numberOfMonths={1}
                      className="rounded-2xl border border-stone-200/70 dark:border-stone-700/70 bg-white/70 dark:bg-stone-800/70 w-full mx-auto shadow-[0_8px_20px_-10px_rgba(120,90,60,0.3)]"
                    />
                    {(filterStart || filterEnd) && (
                      <div className="rounded-xl bg-white/80 dark:bg-stone-800/80 border border-amber-200/70 dark:border-amber-800/60 px-3 py-2 text-center shadow-[0_6px_16px_-8px_rgba(120,90,60,0.35)]">
                        <span className="text-[11px] font-semibold text-stone-700 dark:text-stone-200">
                          {filterStart ? format(new Date(filterStart), 'dd MMM') : 'Start'} → {filterEnd ? format(new Date(filterEnd), 'dd MMM yyyy') : 'Now'}
                        </span>
                      </div>
                    )}
                  </section>

                  {/* Footer — bottom text zone, balanced pair */}
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFilterStart(undefined);
                        setFilterEnd(undefined);
                        setRawFilterStart(undefined);
                        setRawFilterEnd(undefined);
                      }}
                      disabled={!hasActiveFilters}
                      className="h-10 rounded-2xl text-xs font-semibold gap-1.5 border-stone-200/80 dark:border-stone-700 bg-white/80 dark:bg-stone-800/80 text-stone-500 dark:text-stone-400 shadow-[0_6px_16px_-8px_rgba(120,90,60,0.3)] hover:bg-stone-50 hover:text-stone-700 disabled:shadow-none"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Clear</span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleExportLeads}
                      disabled={isFetching}
                      className="h-10 rounded-2xl text-xs font-semibold gap-1.5 border-0 bg-gradient-to-b from-amber-400 to-orange-500 text-white shadow-[0_10px_24px_-8px_rgba(217,119,6,0.55)] hover:from-amber-500 hover:to-orange-600"
                    >
                      {isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                      <span>Export CSV</span>
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </NavbarExtension>
        {/* Today's Summary Banner */}
        <div className="p-4 my-3 bg-blue-100 dark:bg-blue-900/50 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Bell className="w-6 h-6 text-blue-600" />
            <h3 className="font-semibold text-lg">Today&apos;s Summary</h3>
          </div>
          <div className="flex gap-4 text-sm">
            <p><strong>{newTodayLeads.length}</strong> New Leads</p>
            <p><strong>{reminderDueTodayLeads.length}</strong> Reminders Due</p>
            <p><strong>{needsAttentionLeads.length}</strong> Overdue</p>
          </div>
        </div>

        <main className="space-y-8">
          {viewMode === 'normal' ? (
            <>
              {/* Main grouped sections */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6 items-start">
                {renderGroupedSection("Needs Attention", needsAttentionLeads, "border-red-600", <AlertTriangle className="text-white" />)}
                {renderGroupedSection("Reminder Due Today", reminderDueTodayLeads, "border-amber-500", <Bell className="text-white" />)}
                {renderGroupedSection("New Today", newTodayLeads, "border-green-600", <Star className="text-white" />)}
              </div>

              {/* Upcoming Follow-ups */}
              {upcomingFollowUpsLeads.length > 0 && (
                <Card className="rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                  <CardHeader className="p-4 bg-purple-600 text-white text-lg font-semibold flex items-center justify-between rounded-t-xl">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                      <Calendar className="text-white" /> Upcoming Follow-ups
                    </h2>
                    <Badge className="bg-white text-gray-800 font-bold px-3 py-1 rounded-full">
                      {upcomingFollowUpsLeads.length}
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-4 flex flex-row gap-4 overflow-x-auto pb-4">
                    {upcomingFollowUpsLeads.map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        groupColor="border-purple-500"
                        onSelectLead={setSelectedLead}
                        onAction={handleLeadAction}
                        isActionLoading={isActionLoading}
                        currentUser={currentUserProfile}
                        onOpenRescheduleDialog={handleOpenRescheduleDialog}
                        onOpenLeadDetailsDialogWithCloseNote={handleOpenLeadDetailsDialogWithCloseNote}
                      />
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Converted & Closed */}
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1">
                  <AccordionTrigger className="text-xl font-bold p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                    <span className="flex items-center gap-2">
                      <CheckCircle /> Converted & Closed ({completedClosedLeads.length})
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="p-4 space-y-6">
                      {Object.keys(groupedCompletedClosedLeads)
                        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
                        .map((dateGroup) => (
                          <div key={dateGroup}>
                            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-3">
                              {dateGroup}
                            </h3>
                            <div className="flex flex-row gap-4 overflow-x-auto pb-4">
                              {groupedCompletedClosedLeads[dateGroup].map((lead) => (
                                <LeadCard
                                  key={lead.id}
                                  lead={lead}
                                  groupColor="border-gray-400"
                                  onSelectLead={setSelectedLead}
                                  onAction={handleLeadAction}
                                  isActionLoading={isActionLoading}
                                  currentUser={currentUserProfile}
                                  onOpenRescheduleDialog={handleOpenRescheduleDialog}
                                  onOpenLeadDetailsDialogWithCloseNote={handleOpenLeadDetailsDialogWithCloseNote}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </>
          ) : (
            /* -------- BY CREATOR MODE -------- */
            <div className="space-y-8 grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
              {leadsGroupedByCreator.map((creator) =>
                renderGroupedSection(
                  creator.createdByName,
                  creator.leads,
                  "border-blue-600",
                  <UserIcon className="text-white" />,
                  creator.createdBy,
                  {
                    inProgress: creator.inProgress,
                    completed: creator.completed,
                    closed: creator.closed,
                  },
                ),
              )}

              {leadsGroupedByCreator.length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-500">
                  No leads match the current filters.
                </div>
              )}
            </div>
          )}
        </main>

        {/* Dialogs */}
        <LeadFormDialog
          isOpen={isCreateLeadDialogOpen}
          onOpenChange={setIsCreateLeadDialogOpen}
          onSubmit={handleAddLead}
          isSaving={isActionLoading === 'create'}
          currentUser={currentUserProfile}
        />

        {selectedLead && (
          <LeadDetailsDialog
            key={selectedLead.id}
            lead={selectedLead}
            isOpen={!!selectedLead}
            onOpenChange={(open) => {
              if (!open) {
                setSelectedLead(null);
                setShowClosingNoteForLead(null);
              }
            }}
            onAction={handleLeadAction}
            currentUser={currentUserProfile}
            onOpenRescheduleDialog={handleOpenRescheduleDialog}
            initialShowClosingNote={showClosingNoteForLead === selectedLead.id}
          />
        )}

        <RescheduleDialog
          isOpen={isRescheduleDialogOpen}
          onOpenChange={setIsRescheduleDialogOpen}
          lead={rescheduleTargetLead}
          onConfirmReschedule={handleLeadAction}
          isActionLoading={isActionLoading}
        />
      </div>
    </TooltipProvider>
  );
}

// ===========================================================================
// FILE CONVERSION UTILITY
// ===========================================================================

const compressAndConvertFile = (file: File): Promise<{ filename: string; mimeType: string; fileBase64: string }> => {
  return new Promise((resolve, reject) => {
    const passThrough = () => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const base64String = (event.target?.result as string).split(',')[1];
        resolve({ filename: file.name, mimeType: file.type || 'application/octet-stream', fileBase64: base64String });
      };
      reader.onerror = (error) => reject(error);
    };

    if (file.type === 'application/pdf') {
      passThrough();
      return;
    }

    const CANVAS_SUPPORTED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
    if (!CANVAS_SUPPORTED.includes(file.type)) {
      passThrough();
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
        if (!ctx) {
          passThrough();
          return;
        }

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
        ctx.drawImage(img, 0, 0, width, height);

        const outputMimeType = 'image/jpeg';

        canvas.toBlob((blob) => {
          if (blob) {
            const readerBlob = new FileReader();
            readerBlob.readAsDataURL(blob);
            readerBlob.onloadend = () => {
              const base64String = (readerBlob.result as string).split(',')[1];
              resolve({ filename: file.name, mimeType: outputMimeType, fileBase64: base64String });
            };
          } else {
            try {
              const dataUrl = canvas.toDataURL(outputMimeType, JPEG_QUALITY);
              const base64String = dataUrl.split(',')[1];
              resolve({ filename: file.name, mimeType: outputMimeType, fileBase64: base64String });
            } catch {
              passThrough();
            }
          }
        }, outputMimeType, JPEG_QUALITY);
      };
      img.onerror = () => passThrough();
    };
    reader.onerror = (error) => reject(error);
  });
};

// ===========================================================================
// LEAD FORM DIALOG
// ===========================================================================

interface LeadFormDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    data: Omit<Lead, 'id' | 'leadId' | 'status' | 'editHistory' | 'uploadedFiles' | 'createdBy' | 'createdByName'>,
    files: File[],
  ) => void;
  isSaving: boolean;
  currentUser: UserProfile | null;
}

const LeadFormDialog: React.FC<LeadFormDialogProps> = ({ isOpen, onOpenChange, onSubmit, isSaving, currentUser }) => {
  const defaultReminder = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }, []);
  const [clientName, setClientName] = useState('');
  const [phone, setPhone] = useState('');
  const [productInterest, setProductInterest] = useState('');
  const [reminderDate, setReminderDate] = useState<Date | undefined>(defaultReminder ? new Date(defaultReminder) : undefined);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isHot, setIsHot] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setSelectedFiles(prev => [...prev, ...Array.from(files)]);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (event: React.DragEvent) => { event.preventDefault(); event.stopPropagation(); event.currentTarget.classList.add('border-blue-500', 'bg-blue-50/20'); };
  const handleDragLeave = (event: React.DragEvent) => { event.preventDefault(); event.stopPropagation(); event.currentTarget.classList.remove('border-blue-500', 'bg-blue-50/20'); };
  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault(); event.stopPropagation(); event.currentTarget.classList.remove('border-blue-500', 'bg-blue-50/20');
    if (event.dataTransfer.files) { setSelectedFiles(prev => [...prev, ...Array.from(event.dataTransfer.files)]); }
  };

  const resetForm = () => {
    setClientName('');
    setPhone('');
    setProductInterest('');
    setReminderDate(defaultReminder ? new Date(defaultReminder) : undefined);
    setSelectedFiles([]);
    setIsHot(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName || !phone || !productInterest || !currentUser) return;

    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phone)) {
      toast.error("Invalid phone number format. Please enter exactly 10 digits.");
      return;
    }

    onSubmit(
      { clientName, phone, productInterest, isHot, reminderDate: reminderDate ? format(reminderDate, 'yyyy-MM-dd') : undefined },
      selectedFiles,
    );
    resetForm();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col max-h-[90vh] sm:max-h-[85vh]">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-3xl font-extrabold text-blue-800 dark:text-blue-300">Create New Lead</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-grow">
          <div className="grid gap-4 py-4 overflow-y-auto flex-grow">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="clientName">Client Name</Label>
                <Input id="clientName" value={clientName} onChange={(e) => setClientName(e.target.value)} required />
              </div>

              <div className="flex flex-col h-full sm:col-span-1 justify-end space-y-2">
                <Label htmlFor="isHot" className="text-sm font-medium leading-none opacity-0 select-none">Hot Lead</Label>
                <div
                  className={`flex items-center justify-between w-full px-3 py-2 border rounded-lg transition-colors cursor-pointer h-10 ${isHot
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/10'
                    : 'border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }`}
                  onClick={() => setIsHot(prev => !prev)}
                >
                  <div className="flex items-center space-x-2 text-sm font-medium">
                    <TrendingUp className={`w-4 h-4 transition-colors ${isHot ? 'text-red-600 dark:text-red-400 animate-pulse' : 'text-gray-400'}`} />
                    <span className={`${isHot ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
                      {isHot ? 'HOT' : 'Lead'}
                    </span>
                  </div>
                  <Switch
                    id="isHot"
                    checked={isHot}
                    onCheckedChange={setIsHot}
                    className="data-[state=checked]:bg-red-500"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                maxLength={10}
                pattern="\d{10}"
                title="Phone number must be exactly 10 digits"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="productInterest">Product Interest</Label>
              <Textarea
                id="productInterest"
                value={productInterest}
                onChange={(e) => setProductInterest(e.target.value)}
                required
                className="min-h-[60px] max-h-[150px] overflow-y-auto"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reminderDate">Reminder Date</Label>
              <Input
                type="date"
                id="reminderDate"
                value={reminderDate ? reminderDate.toISOString().split('T')[0] : ''}
                onChange={(e) => setReminderDate(e.target.value ? new Date(e.target.value) : undefined)}
                min={new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0]}
                className="w-full"
              />
            </div>

            <div className="space-y-3 border p-4 rounded-md bg-gray-700/20 border-dashed border-gray-600">
              <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <Paperclip className="w-5 h-5" /> Attachments (Optional)
              </h3>
              <div
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center text-gray-500 dark:text-gray-400 hover:border-blue-500 hover:bg-blue-50/20 transition-all duration-200 cursor-pointer"
                onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
              >
                <Input id="lead-files-input" type="file" multiple accept="image/*,.pdf" onChange={handleFileChange} className="hidden" ref={fileInputRef} />
                <Label htmlFor="lead-files-input" className="cursor-pointer flex flex-col items-center">
                  <Upload className="w-8 h-8 mb-2" />
                  Drag & drop files here, or <span className="text-blue-600 font-medium">click to browse</span>
                </Label>
              </div>
              {selectedFiles.length > 0 && (
                <div className="space-y-2 mt-4">
                  <h5 className="font-semibold text-lg text-gray-800 dark:text-gray-200">Selected Files:</h5>
                  <ul className="space-y-1">
                    {selectedFiles.map((file, index) => (
                      <li key={index} className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 p-2 rounded-md text-sm">
                        <span className="truncate">{file.name}</span>
                        <Button variant="ghost" size="sm" onClick={() => handleRemoveFile(index)} className="text-red-500 hover:text-red-700">
                          <X className="w-4 h-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex-shrink-0">
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Create Lead
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// ===========================================================================
// RESCHEDULE DIALOG
// ===========================================================================

interface RescheduleDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  onConfirmReschedule: (action: 'reschedule', lead: Lead, details: { newDate: string }) => void;
  isActionLoading: false | string;
}

const RescheduleDialog: React.FC<RescheduleDialogProps> = ({ isOpen, onOpenChange, lead, onConfirmReschedule, isActionLoading }) => {
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>(lead?.reminderDate ? new Date(lead.reminderDate) : undefined);

  useEffect(() => {
    setRescheduleDate(lead?.reminderDate ? new Date(lead.reminderDate) : undefined);
  }, [lead]);

  const handleConfirm = () => {
    if (!rescheduleDate || !lead) {
      toast.error("Please select a date and ensure a lead is selected.");
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDay = new Date(rescheduleDate);
    selectedDay.setHours(0, 0, 0, 0);

    if (selectedDay.getTime() < today.getTime()) {
      toast.error("Please select a future date for rescheduling.");
      return;
    }
    onConfirmReschedule('reschedule', lead, { newDate: format(rescheduleDate, 'yyyy-MM-dd') });
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-3xl font-extrabold text-blue-800 dark:text-blue-300">
            Reschedule Lead: {lead?.leadId}
          </DialogTitle>
          <DialogDescription>Select a new reminder date for this lead.</DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-2">
          <Label htmlFor="reschedule-date-picker">New Reminder Date</Label>
          <Input
            type="date"
            id="reschedule-date-picker"
            value={rescheduleDate ? rescheduleDate.toISOString().split('T')[0] : ''}
            onChange={(e) => setRescheduleDate(e.target.value ? new Date(e.target.value) : undefined)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={isActionLoading === lead?.id} className="bg-blue-600 hover:bg-blue-700 text-white">
            {isActionLoading === lead?.id && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Reschedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ===========================================================================
// LEAD DETAILS DIALOG
// ===========================================================================

interface LeadDetailsDialogProps {
  lead: Lead;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAction: (action: 'convert' | 'mark-hot' | 'reschedule' | 'close' | 'delete' | 'update', lead: Lead, details?: any) => void;
  currentUser: UserProfile | null;
  onOpenRescheduleDialog: (lead: Lead) => void;
  initialShowClosingNote: boolean;
}

const LeadDetailsDialog: React.FC<LeadDetailsDialogProps> = (props) => {
  const { lead, isOpen, onOpenChange, onAction, currentUser, onOpenRescheduleDialog, initialShowClosingNote } = props;
  const [isEditing, setIsEditing] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [closingNote, setClosingNote] = useState("");
  const [isAttachmentsAccordionOpen, setIsAttachmentsAccordionOpen] = useState(false);
  const [isHistoryAccordionOpen, setIsHistoryAccordionOpen] = useState(false);

  const [isConfirmFileDeleteDialogOpen, setIsConfirmFileDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<FileMetadata | null>(null);

  const isLocked = lead.status === 'Completed' || lead.status === 'Closed';

  const [formData, setFormData] = useState({
    clientName: lead.clientName,
    phone: lead.phone,
    productInterest: lead.productInterest,
    status: lead.status,
    reminderDate: lead.reminderDate ? new Date(lead.reminderDate).toISOString().split('T')[0] : '',
    isHot: lead.isHot || false,
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isLeadDetailsActionLoading, setIsLeadDetailsActionLoading] = useState(false);
  const [isLeadDetailsUploadingFiles, setIsLeadDetailsUploadingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) {
      setFormData({
        clientName: lead.clientName,
        phone: lead.phone,
        productInterest: lead.productInterest,
        status: lead.status,
        isHot: lead.isHot || false,
        reminderDate: lead.reminderDate ? new Date(lead.reminderDate).toISOString().split('T')[0] : '',
      });
    }
    setSelectedFiles([]);
    setIsClosing(initialShowClosingNote);
  }, [isEditing, lead, initialShowClosingNote]);

  const handleSave = async () => {
    if (!currentUser) {
      toast.error("User not authenticated.");
      return;
    }

    const updatedFields: Partial<Omit<Lead, 'id' | 'editHistory'>> = {};
    const changes: string[] = [];
    if (formData.clientName !== lead.clientName) { updatedFields.clientName = formData.clientName; changes.push(`client name to "${formData.clientName}"`); }
    if (formData.phone !== lead.phone) { updatedFields.phone = formData.phone; changes.push(`phone to "${formData.phone}"`); }
    if (formData.productInterest !== lead.productInterest) { updatedFields.productInterest = formData.productInterest; changes.push(`product interest`); }

    if (formData.isHot !== (lead.isHot || false)) {
      updatedFields.isHot = formData.isHot;
      changes.push(formData.isHot ? `marked as HOT` : `marked as STANDARD`);
    }

    if (formData.status !== lead.status) {
      updatedFields.status = formData.status;
      changes.push(`status to "${formData.status}"`);
      if (formData.status === 'Closed' && currentUser?.role === 'super-admin') {
        setIsClosing(true);
      } else if (lead.status === 'Closed' && formData.status !== 'Closed') {
        updatedFields.closingNote = '';
      }
    }

    if (formData.reminderDate !== (lead.reminderDate ? new Date(lead.reminderDate).toISOString().split('T')[0] : '')) {
      updatedFields.reminderDate = formData.reminderDate;
      changes.push(`reminder date to "${formData.reminderDate}"`);
    }

    const phoneRegex = /^\d{10}$/;
    if (updatedFields.phone && !phoneRegex.test(updatedFields.phone)) {
      toast.error("Invalid phone number format. Please enter exactly 10 digits.");
      return;
    }

    setIsLeadDetailsActionLoading(true);
    try {
      if (selectedFiles.length > 0) {
        const formattedFiles = await Promise.all(selectedFiles.map(file => compressAndConvertFile(file)));
        await leadApiService.uploadFile(lead.leadId, formattedFiles);
        toast.success("Files uploaded successfully!");
        setSelectedFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }

      if (Object.keys(updatedFields).length > 0) {
        const newHistoryEntry: EditHistoryEntry = {
          timestamp: Date.now(),
          editorName: currentUser.name || currentUser.email,
          description: `Updated ${changes.join(', ')}.`,
        };
        await onAction('update', lead, { updatedFields, newHistoryEntry });
      } else if (selectedFiles.length === 0) {
        toast.info("No changes were made.");
      }
    } catch (error: any) {
      console.error("Error saving lead details:", error);
      toast.error(`Failed to save: ${error.message}`);
    } finally {
      setIsLeadDetailsActionLoading(false);
    }
    setIsEditing(false);
  };

  const handleCloseLead = async () => {
    if (!closingNote.trim()) { toast.error("Closing note is required."); return; }
    if (closingNote.length > 500) {
      toast.error("Closing note cannot exceed 500 characters.");
      return;
    }
    setIsLeadDetailsActionLoading(true);
    try {
      await onAction('close', lead, { note: closingNote });
    } catch (error: any) {
      console.error("Error closing lead:", error);
      toast.error(`Failed to close lead: ${error.message}`);
    } finally {
      setIsLeadDetailsActionLoading(false);
    }
    setIsClosing(false);
    onOpenChange(false);
  };

  const handleMarkHotToggle = async (isCurrentHot: boolean) => {
    setIsLeadDetailsActionLoading(true);
    try {
      await onAction('mark-hot', lead);
    } catch (error: any) {
      console.error("Error toggling 'Hot' status:", error);
      toast.error(`Failed to mark lead as ${isCurrentHot ? 'Standard' : 'Hot'}: ${error.message}`);
    } finally {
      setIsLeadDetailsActionLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setSelectedFiles(prev => [...prev, ...Array.from(files)]);
  };

  const handleRemoveSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (event: React.DragEvent) => { event.preventDefault(); event.stopPropagation(); event.currentTarget.classList.add('border-blue-500', 'bg-blue-50/20'); };
  const handleDragLeave = (event: React.DragEvent) => { event.preventDefault(); event.stopPropagation(); event.currentTarget.classList.remove('border-blue-500', 'bg-blue-50/20'); };
  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault(); event.stopPropagation(); event.currentTarget.classList.remove('border-blue-500', 'bg-blue-50/20');
    if (event.dataTransfer.files) { setSelectedFiles(prev => [...prev, ...Array.from(event.dataTransfer.files)]); }
  };

  const confirmFileDeletion = (file: FileMetadata) => {
    setFileToDelete(file);
    setIsConfirmFileDeleteDialogOpen(true);
  };

  const executeFileDeletion = async () => {
    if (!currentUser || !lead.id || !fileToDelete) {
      toast.error("User not authenticated or file not selected for deletion.");
      return;
    }

    setIsLeadDetailsUploadingFiles(true);
    setIsConfirmFileDeleteDialogOpen(false);
    try {
      await leadApiService.deleteFile(fileToDelete.fileId);
      toast.success("File deleted successfully!");
      await onAction('update', lead, {
        updatedFields: {},
        newHistoryEntry: {
          timestamp: Date.now(),
          editorName: currentUser.name || currentUser.email,
          description: `Deleted file: ${fileToDelete.filename}.`,
        },
      });
    } catch (error: any) {
      console.error("Error deleting file:", error);
      toast.error(`Failed to delete file: ${error.message}`);
    } finally {
      setIsLeadDetailsUploadingFiles(false);
      setFileToDelete(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="w-[95%] max-w-[95%] sm:max-w-[800px] md:max-w-[900px] lg:max-w-[1100px] p-3 sm:p-4 md:p-6 rounded-xl shadow-lg flex flex-col max-h-[80vh] sm:max-h-[70vh] md:max-h-[60vh] lg:max-h-[90vh] transition-all duration-300 ease-out">
        <DialogHeader className="p-2 pb-1 border-b flex flex-row items-center justify-between sticky rounded-md top-0 z-10">
          <div>
            <DialogTitle className="text-lg sm:text-xl md:text-2xl font-extrabold text-blue-800 dark:text-blue-300">
              Lead: {lead.leadId} - {lead.clientName}
            </DialogTitle>
          </div>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </DialogClose>
        </DialogHeader>

        <div className="p-3 sm:p-4 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 overflow-y-auto flex-grow">
          <div className="md:col-span-2 space-y-3 sm:space-y-4">
            {isLocked && (
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300 rounded-md flex items-center gap-2 text-xs sm:text-sm">
                <AlertTriangle className="w-4 h-4" />
                <p className="font-medium">This lead is finalized. No further actions available.</p>
              </div>
            )}

            <Card className="p-3 sm:p-4 space-y-3 sm:space-y-4">
              <h3 className="text-base sm:text-lg font-bold mb-2 flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-blue-500" /> Lead Information
              </h3>

              <div className="flex items-center justify-between border-y py-3">
                <Label className="text-sm flex items-center gap-3 font-semibold text-gray-800 dark:text-gray-200">
                  <Flame className={`w-5 h-5 ${formData.isHot ? 'text-red-600' : 'text-gray-400'}`} />
                  <span>Premium Hot Lead Status</span>
                </Label>

                {isEditing && !isLocked ? (
                  <Switch
                    checked={formData.isHot}
                    onCheckedChange={(checked) => setFormData({ ...formData, isHot: checked })}
                    disabled={isLeadDetailsActionLoading}
                    className="data-[state=checked]:bg-red-500"
                  />
                ) : (
                  <span
                    className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full transition-colors duration-200 ${formData.isHot
                      ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                      : 'bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-700 dark:text-gray-400'
                      }`}
                  >
                    {formData.isHot ? '🔥 HIGH PRIORITY' : 'STANDARD'}
                  </span>
                )}
              </div>

              <div>
                <Label className="text-xs sm:text-sm">Phone</Label>
                <div className="flex items-center gap-1 sm:gap-2 text-sm sm:text-base">
                  {isEditing ? (
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="h-8 text-sm"
                      maxLength={10}
                      pattern="\d{10}"
                      title="Phone number must be exactly 10 digits"
                      type="tel"
                    />
                  ) : (
                    <p className="font-medium">{lead.phone}</p>
                  )}
                  {!isLocked && (
                    <>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="icon" variant="ghost" onClick={() => window.open(`tel:${lead.phone}`, '_blank', 'noopener,noreferrer')}>
                            <PhoneCall className="w-4 h-4 text-blue-500" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Call Lead</p></TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="icon" variant="ghost" onClick={() => window.open(`https://wa.me/91${lead.phone}`, '_blank', 'noopener,noreferrer')}>
                            <MessageCircle className="w-4 h-4 text-green-500" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>WhatsApp Lead</p></TooltipContent>
                      </Tooltip>
                    </>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-xs sm:text-sm">Client Name</Label>
                {isEditing ? (
                  <Input value={formData.clientName} onChange={(e) => setFormData({ ...formData, clientName: e.target.value })} className="h-8 text-sm" />
                ) : (
                  <p className="text-sm sm:text-base font-medium">{lead.clientName}</p>
                )}
              </div>

              <div>
                <Label className="text-xs sm:text-sm">Product Interest</Label>
                {isEditing ? (
                  <Textarea value={formData.productInterest} onChange={(e) => setFormData({ ...formData, productInterest: e.target.value })} className="min-h-[60px] text-sm" />
                ) : (
                  <p className="text-sm sm:text-base whitespace-pre-wrap">{lead.productInterest}</p>
                )}
              </div>
            </Card>

            {(isClosing || initialShowClosingNote) && (
              <div className="p-3 border border-yellow-300 rounded-lg space-y-2">
                <Label htmlFor="closingNote" className="text-xs sm:text-sm">Please add a closing note</Label>
                <Textarea id="closingNote" value={closingNote} onChange={(e) => setClosingNote(e.target.value)} maxLength={500} className="min-h-[60px] text-sm" />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setIsClosing(false)} className="text-sm" disabled={isLeadDetailsActionLoading}>Cancel</Button>
                  <Button onClick={handleCloseLead} disabled={isLeadDetailsActionLoading}>
                    {isLeadDetailsActionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Confirm Close'}
                  </Button>
                </div>
              </div>
            )}

            {lead.status === 'Closed' && lead.closingNote && (
              <Card className="p-3 space-y-2 bg-gray-50 dark:bg-gray-700">
                <h3 className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500" /> Closing Note
                </h3>
                <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{lead.closingNote}</p>
              </Card>
            )}
          </div>

          <div className="space-y-3 sm:space-y-4">
            <Card className="p-3 sm:p-4 space-y-3 sm:space-y-4">
              <h3 className="text-base sm:text-lg font-bold mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" /> Status & Schedule
              </h3>
              <div>
                <Label className="text-xs sm:text-sm">Status</Label>
                {isEditing && currentUser?.role === 'super-admin' ? (
                  <Select
                    value={formData.status}
                    onValueChange={(value: LeadStatus) => {
                      setFormData({ ...formData, status: value });
                      setIsClosing(value === 'Closed');
                    }}
                    disabled={isLeadDetailsActionLoading}
                  >
                    <SelectTrigger className="w-full h-8 text-sm"><SelectValue placeholder="Select Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="In Progress">In Progress</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="Closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm sm:text-base">{lead.status}</p>
                )}
              </div>
              <div>
                <Label className="text-xs sm:text-sm">Reminder Date</Label>
                {isEditing ? (
                  <Input type="date" value={formData.reminderDate} onChange={(e) => setFormData({ ...formData, reminderDate: e.target.value })} className="h-8 text-sm" />
                ) : (
                  <p className="text-sm sm:text-base">
                    {lead.reminderDate ? new Date(lead.reminderDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                  </p>
                )}
              </div>
            </Card>

            {lead.existingLeads && lead.existingLeads.length > 0 && (
              <Accordion type="single" collapsible>
                <AccordionItem value="past-interactions">
                  <AccordionTrigger>
                    <span className="flex items-center gap-2 text-sm sm:text-base">
                      <History /> Past Interactions ({lead.existingLeads?.length || 0})
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-1 max-h-32 overflow-y-auto p-2">
                    <ul className="space-y-1 text-xs text-gray-700 dark:text-gray-300">
                      {lead.existingLeads.map((el, idx) => (
                        <li key={idx} className="flex items-center gap-1">
                          <span className="font-medium">{el.createdByName || 'Unknown'}</span> created
                          <span className="font-medium">{el.daysSinceCreated} days ago</span>
                        </li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}

            <Accordion type="single" collapsible value={isAttachmentsAccordionOpen ? "attachments" : ""} onValueChange={(val) => setIsAttachmentsAccordionOpen(val === "attachments")}>
              <AccordionItem value="attachments">
                <AccordionTrigger>
                  <span className="flex items-center gap-2 text-sm sm:text-base">
                    <Paperclip /> Attachments ({lead.uploadedFiles?.length || 0})
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 p-2">
                  {isEditing && !isLocked && (
                    <>
                      <div
                        className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-3 text-center text-gray-500 dark:text-gray-400 hover:border-blue-500 hover:bg-blue-50/20 transition-all duration-200 cursor-pointer text-xs"
                        onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                      >
                        <Input id="lead-details-files-input" type="file" multiple accept="image/*,.pdf" onChange={handleFileChange} className="hidden" ref={fileInputRef} />
                        <Label htmlFor="lead-details-files-input" className="cursor-pointer flex flex-col items-center">
                          <Upload className="w-6 h-6 mb-1" />
                          Drag & drop files here, or <span className="text-blue-600 font-medium">click to browse</span>
                        </Label>
                      </div>
                      {selectedFiles.length > 0 && (
                        <div className="space-y-1 mt-2">
                          <h5 className="font-semibold text-gray-800 dark:text-gray-200 text-xs">Selected for Upload:</h5>
                          <ul className="space-y-1">
                            {selectedFiles.map((file, index) => (
                              <li key={index} className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 p-1 rounded-md text-xs">
                                <span className="truncate">{file.name}</span>
                                <Button variant="ghost" size="sm" onClick={() => handleRemoveSelectedFile(index)} className="text-red-500 hover:text-red-700 h-6 w-6">
                                  <X className="w-3 h-3" />
                                </Button>
                              </li>
                            ))}
                          </ul>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            Files upload when you click <span className="font-medium text-gray-700 dark:text-gray-300">Save Changes</span>.
                          </p>
                        </div>
                      )}
                      {lead.uploadedFiles && lead.uploadedFiles.length > 0 && <div className="border-t border-gray-700 pt-3" />}
                    </>
                  )}

                  {lead.uploadedFiles && lead.uploadedFiles.length > 0 ? (
                    <div className="space-y-1">
                      <h5 className="font-semibold text-gray-800 dark:text-gray-200 text-xs">Uploaded Files:</h5>
                      <ul className="space-y-1">
                        {lead.uploadedFiles.map((file) => (
                          <li key={file.fileId} className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 p-1 rounded-md text-xs">
                            <span className="truncate">{file.filename}</span>
                            <div className="flex items-center gap-1">
                              <a href={`https://drive.google.com/file/d/${file.fileId}/preview`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200" title="Preview File">
                                <Eye className="w-4 h-4" />
                              </a>
                              <a href={`https://drive.google.com/uc?export=download&id=${file.fileId}`} target="_blank" rel="noopener noreferrer" className="text-green-500 hover:text-green-700" title="Download File">
                                <Download className="w-3 h-3" />
                              </a>
                              {!isLocked && (
                                <Button variant="ghost" size="sm" onClick={() => confirmFileDeletion(file)} disabled={isLeadDetailsUploadingFiles} className="text-red-500 hover:text-red-700 h-6 w-6">
                                  {isLeadDetailsUploadingFiles ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                </Button>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 text-center">
                      {!isLocked ? 'No files uploaded yet. Drag & drop or click to add.' : 'No files uploaded.'}
                    </p>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <Accordion type="single" collapsible value={isHistoryAccordionOpen ? "history" : ""} onValueChange={(val) => setIsHistoryAccordionOpen(val === "history")}>
              <AccordionItem value="history">
                <AccordionTrigger>
                  <span className="flex items-center gap-2 text-sm sm:text-base">
                    <History /> Edit History ({lead.editHistory?.length || 0})
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-1 max-h-32 overflow-y-auto p-2">
                  {lead.editHistory && lead.editHistory.length > 0 ? (
                    [...lead.editHistory]
                      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                      .map((entry, index) => (
                        <div key={index} className="bg-gray-100 dark:bg-gray-700 p-2 rounded-md text-xs">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(entry.timestamp).toLocaleString()} by {entry.editorName}
                          </p>
                          <p className="mt-1">{entry.description}</p>
                        </div>
                      ))
                  ) : (
                    <p className="text-xs text-gray-500 text-center">No edit history.</p>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>

        <DialogFooter className="p-3 sm:p-4 border-t flex flex-wrap justify-between items-center gap-1 sm:gap-2">
          <div className="flex flex-wrap gap-1 sm:gap-2 justify-center sm:justify-start w-full sm:w-auto">
            {!isEditing ? (
              <Button
                onClick={() => setIsEditing(true)}
                disabled={isLeadDetailsActionLoading}
                className="min-w-[80px] text-xs sm:text-sm whitespace-nowrap bg-indigo-600 hover:bg-indigo-700 text-white h-8 sm:h-9 px-3 sm:px-4"
              >
                <Edit className="w-3 h-3 mr-1 sm:mr-2" /> Edit Lead
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)} className="min-w-[80px] text-xs sm:text-sm whitespace-nowrap h-8 sm:h-9 px-3 sm:px-4" disabled={isLeadDetailsActionLoading}>
                  Cancel Edit
                </Button>
                <Button onClick={handleSave} disabled={isLeadDetailsActionLoading} className="min-w-[80px] bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm whitespace-nowrap h-8 sm:h-9 px-3 sm:px-4">
                  {isLeadDetailsActionLoading && <Loader2 className="w-3 h-3 mr-1 sm:mr-2 animate-spin" />} Save Changes
                </Button>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-1 sm:gap-2 justify-center sm:justify-end w-full sm:w-auto mt-1 sm:mt-0">
            {!isLocked && !isEditing && (
              <>
                <Button
                  onClick={() => handleMarkHotToggle(lead.isHot || false)}
                  disabled={isLeadDetailsActionLoading}
                  className={cn(
                    "min-w-[120px] text-white text-xs whitespace-nowrap h-8 px-3 font-semibold shadow-md transition-all",
                    lead.isHot
                      ? "bg-gray-600 hover:bg-gray-700 shadow-gray-500/30"
                      : "bg-red-600 hover:bg-red-700 shadow-red-500/30",
                  )}
                >
                  {isLeadDetailsActionLoading ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : lead.isHot ? (
                    <X className="w-3 h-3 mr-1" />
                  ) : (
                    <Flame className="w-3 h-3 mr-1" />
                  )}
                  {lead.isHot ? 'Set to Standard' : 'Mark as HOT'}
                </Button>

                <Button variant="outline" onClick={() => onOpenRescheduleDialog(lead)} disabled={isLeadDetailsActionLoading} className="min-w-[80px] bg-blue-500 hover:bg-blue-600 text-white text-xs sm:text-sm whitespace-nowrap h-8 sm:h-9 px-3 sm:px-4">
                  {isLeadDetailsActionLoading ? <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" /> : <Calendar className="w-3 h-3 mr-1 sm:mr-2" />} Reschedule
                </Button>

                <Button
                  onClick={async () => {
                    setIsLeadDetailsActionLoading(true);
                    try {
                      await onAction('convert', lead);
                    } catch (error: any) {
                      console.error("Error marking lead as won:", error);
                      toast.error(`Failed to mark lead as won: ${error.message}`);
                    } finally {
                      setIsLeadDetailsActionLoading(false);
                    }
                  }}
                  disabled={isLeadDetailsActionLoading}
                  className="min-w-[80px] bg-green-500 hover:bg-green-600 text-white text-xs sm:text-sm whitespace-nowrap h-8 sm:h-9 px-3 sm:px-4"
                >
                  {isLeadDetailsActionLoading ? <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" /> : <CheckCircle className="w-3 h-3 mr-1 sm:mr-2" />} Mark as Won
                </Button>
              </>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-xs sm:text-sm">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {!isLocked && (
                  <DropdownMenuItem onClick={() => setIsClosing(true)} disabled={isLeadDetailsActionLoading} className="text-xs sm:text-sm">
                    {isLeadDetailsActionLoading && isClosing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
                    <span>Close Lead</span>
                  </DropdownMenuItem>
                )}
                {currentUser?.role === 'super-admin' && (
                  <DropdownMenuItem
                    onClick={async () => {
                      setIsLeadDetailsActionLoading(true);
                      try {
                        await onAction('delete', lead);
                      } catch (error: any) {
                        console.error("Error deleting lead:", error);
                        toast.error(`Failed to delete lead: ${error.message}`);
                      } finally {
                        setIsLeadDetailsActionLoading(false);
                      }
                    }}
                    disabled={isLeadDetailsActionLoading}
                    className="text-red-500 text-xs sm:text-sm"
                  >
                    {isLeadDetailsActionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                    <span>Delete</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setIsHistoryAccordionOpen(true)} className="text-xs sm:text-sm">
                  <History className="w-4 h-4 mr-2" /> <span>View Edit History</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </DialogFooter>
      </DialogContent>

      <Dialog open={isConfirmFileDeleteDialogOpen} onOpenChange={setIsConfirmFileDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm File Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{fileToDelete?.filename}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsConfirmFileDeleteDialogOpen(false); setFileToDelete(null); }} disabled={isLeadDetailsUploadingFiles}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={executeFileDeletion} disabled={isLeadDetailsUploadingFiles}>
              {isLeadDetailsUploadingFiles ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};