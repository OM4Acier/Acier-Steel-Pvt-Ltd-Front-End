"use client";

import React, { useState, useEffect, useCallback, JSX, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog'; // Import DialogClose
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  User as UserIcon, Calendar, CheckCircle, XCircle, Clock, Plus, Edit, Trash2,
  Phone, History, Loader2, Star, MoreVertical, Upload, Flame,
  Eye, X, AlertTriangle, Paperclip, Bell, Download, MessageCircle, PhoneCall,
  TrendingUp
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { checkCloudAuth } from '@/lib/auth/checkCloudAuth';
import { usePathname, useRouter } from 'next/navigation';
// Removed explicit NavButton import as it's defined locally now
//import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
//import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // Added Select for status change
import UniversalNavBar, { createSimplePageConfig } from '@/components/NavBar';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { UserProfile } from '@/types/rbac.types';


// --- TYPE DEFINITIONS & CONSTANTS ---

type LeadStatus = 'In Progress' | 'Completed' | 'Closed';
type LeadPriority = 'High' | 'Medium' | 'Low';

interface EditHistoryEntry {
  timestamp: number;
  editorName: string;
  description: string;
}

interface FileMetadata {
  fileId: string;
  filename: string;
  fileUrl?: string; // Added for preview functionality
}


interface ExistingLeadInfo {
  createdByName?: string;
  daysSinceCreated: number;
}

interface Lead {
  isHot?: any;
  id: string;
  leadId: string;
  clientName: string;
  phone: string; // Added phone number validation
  productInterest: string;
  status: LeadStatus;
  priority?: LeadPriority;
  closingNote?: string; // Only used when status is 'Closed'
  reminderDate?: string;
  editHistory?: EditHistoryEntry[];
  uploadedFiles?: FileMetadata[];
  createdBy: string; // Email
  createdByName: string; // Display name (name or email)
  existingLeads?: ExistingLeadInfo[]; // New field for existing leads info
  createdAt?: string;
  updatedAt?: string;
}

const BASE_API_URL = process.env.NEXT_PUBLIC_BASE_API_URL || 'http://localhost:3000';


// --- API SERVICE ---
const leadApiService = {
  authFetch: async (url: string, options?: RequestInit, accessToken?: string): Promise<any> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred' }));
      throw new Error(errorData.error || response.statusText);
    }
    if (options?.method === 'DELETE' && response.status === 204) return { success: true };
    const result = await response.json();
    return result.data || result; // Handle both {data: ...} and direct responses
  },
  fetchLeads: async (accessToken: string): Promise<Lead[]> => {
    const fetchedLeads = await leadApiService.authFetch(`${BASE_API_URL}/leads`, { method: 'GET' }, accessToken);
    if (!Array.isArray(fetchedLeads)) {
      toast.error("Received an unexpected data format from the server.");
      return [];
    }
    return fetchedLeads.map((lead: any) => ({ ...lead, id: lead._id }));
  },

  addLead: async (leadData: Omit<Lead, 'id' | 'leadId' | 'status' | 'editHistory' | 'uploadedFiles'>, accessToken: string): Promise<Lead> => {
    const payload = { ...leadData, status: 'In Progress' as LeadStatus };
    const newLead = await leadApiService.authFetch(`${BASE_API_URL}/leads`, { method: 'POST', body: JSON.stringify(payload) }, accessToken);
    return { ...newLead, id: newLead._id };
  },
  // Modified updateLead to send a single new edit history entry
  updateLead: async (leadId: string, updatedFields: Partial<Omit<Lead, 'id' | 'editHistory'>>, newHistoryEntry: EditHistoryEntry | null, accessToken: string): Promise<Lead> => {
    const payload: any = { ...updatedFields };
    if (newHistoryEntry) {
      // Assuming backend will handle pushing this single entry to the array
      payload.editHistory = newHistoryEntry; // Send as a single object
    }
    const updatedLead = await leadApiService.authFetch(`${BASE_API_URL}/leads/${leadId}`, { method: 'PUT', body: JSON.stringify(payload) }, accessToken);
    return { ...updatedLead, id: updatedLead._id };
  },
  deleteLead: async (leadId: string, accessToken: string): Promise<void> => {
    await leadApiService.authFetch(`${BASE_API_URL}/leads/${leadId}`, { method: 'DELETE' }, accessToken);
  },
  uploadFile: async (leadId: string, files: { filename: string; mimeType: string; fileBase64: string }[], accessToken: string) => {
    return leadApiService.authFetch(`${BASE_API_URL}/files/upload`, { method: 'POST', body: JSON.stringify({ leadId: leadId, uploadStage: 'lead-documents', files }) }, accessToken);
  },
  deleteFile: async (fileId: string, accessToken: string) => {
    return leadApiService.authFetch(`${BASE_API_URL}/files/delete`, { method: 'POST', body: JSON.stringify({ fileId }) }, accessToken);
  },
};




// --- REUSABLE COMPONENTS ---

interface LeadCardProps {
  lead: Lead;
  groupColor: string;
  onSelectLead: (lead: Lead) => void;
  onAction: (action: 'mark-hot' | 'convert' | 'reschedule' | 'close' | 'delete', lead: Lead, details?: any) => void;
  isActionLoading: false | string;
  currentUser: UserProfile | null;
  onOpenRescheduleDialog: (lead: Lead) => void; // Added for direct reschedule
  onOpenLeadDetailsDialogWithCloseNote: (lead: Lead) => void; // New prop for close action from card
}


const LeadCard: React.FC<LeadCardProps> = ({ lead, groupColor, onSelectLead, onAction, isActionLoading, currentUser, onOpenRescheduleDialog, onOpenLeadDetailsDialogWithCloseNote }) => {
  const formattedCreationDate = lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
  const formattedReminderDate = lead.reminderDate ? new Date(lead.reminderDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : null;

  const getStatusBadgeColor = (status: LeadStatus) => {
    switch (status) {
      case 'Completed': return 'bg-green-500 text-white';
      case 'Closed': return 'bg-red-500 text-white';
      default: return 'bg-gray-500 text-white'; // Fallback for 'In Progress' or others
    }
  };

  // Determine the color for the 'Hot Lead' icon based on the lead's current status
  const hotLeadIconColor = lead.isHot ? 'text-red-500' : 'text-gray-400 dark:text-gray-500';

  return (
    <Card
      id={`lead-card-${lead.id}`}
      onClick={() => onSelectLead(lead)}
      className={`cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 rounded-xl overflow-hidden bg-white dark:bg-gray-800 border-l-4 ${groupColor} min-w-[330px] flex-shrink-0`}
    >

      <CardHeader className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800/70">

        {/* PRIMARY TITLE: Client Name - Highly Prominent */}
        <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-50 line-clamp-1 flex-grow">
          {lead.clientName}
        </CardTitle>

        {/* SECONDARY INFO: ID and Status Badges - Visually Grouped & Pill-Shaped */}
        <div className="flex items-center space-x-3 flex-shrink-0">

          {/* Lead ID Badge (Subtle, Pill Shape) */}
          <span
            className="font-mono text-[10px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/50 rounded-full px-2.5 py-0.5 border border-gray-200 dark:border-gray-700"
          >
            {lead.leadId}
          </span>

          {/* Status Badge (ONLY shows if HOT - High-Impact Pill Shape) */}
          {lead.isHot && (
            <span
              className="text-[10px] uppercase tracking-widest rounded-full px-3 py-1 shadow-lg transition-transform duration-300 transform hover:scale-[1.03] flex items-center 
                           bg-red-600 text-white shadow-red-500/50" // Strong, clear color signal
            >
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
            <TooltipProvider>
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
            </TooltipProvider>
          </div>
        )}
      </CardContent>
      <CardFooter className="p-2 !pt-2 border-t bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-1">
        {lead.status === 'In Progress' && (
          <>
            <TooltipProvider><Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); window.open(`tel:${lead.phone}`); }}><PhoneCall className="w-4 h-4 text-blue-500" /></Button></TooltipTrigger><TooltipContent><p>Call Lead</p></TooltipContent></Tooltip></TooltipProvider>
            <TooltipProvider><Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); window.open(`https://wa.me/91${lead.phone}`, '_blank'); }}><MessageCircle className="w-4 h-4 text-green-500" /></Button></TooltipTrigger><TooltipContent><p>WhatsApp Lead</p></TooltipContent></Tooltip></TooltipProvider>
            <TooltipProvider><Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onOpenRescheduleDialog(lead); }} disabled={isActionLoading === lead.id}><Calendar className="w-4 h-4" /></Button></TooltipTrigger><TooltipContent><p>Re-schedule</p></TooltipContent></Tooltip></TooltipProvider>

            {/* New: Mark as Hot/Not Hot button */}
            <TooltipProvider><Tooltip><TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => { e.stopPropagation(); onAction('mark-hot', lead); }}
                disabled={isActionLoading === lead.id}
                className={hotLeadIconColor} // Apply color based on current hot status
              >
                {isActionLoading === lead.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flame className="w-4 h-4  text-blue-500" />}
              </Button>
            </TooltipTrigger><TooltipContent><p>{lead.isHot ? 'Mark as Not Hot' : 'Mark as Hot'}</p></TooltipContent></Tooltip></TooltipProvider>

            <TooltipProvider><Tooltip><TooltipTrigger asChild>
              <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onAction('convert', lead); }} disabled={isActionLoading === lead.id}>
                {isActionLoading === lead.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 text-green-500" />}
              </Button>
            </TooltipTrigger><TooltipContent><p>Mark as Won</p></TooltipContent></Tooltip></TooltipProvider>
          </>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" onClick={(e) => e.stopPropagation()}><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
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
};


// --- MAIN PAGE COMPONENT ---
export default function LeadManagementPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isCreateLeadDialogOpen, setIsCreateLeadDialogOpen] = useState<boolean>(false);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [isActionLoading, setIsActionLoading] = useState<false | string>(false);

  // State for Reschedule Dialog
  const [rescheduleTargetLead, setRescheduleTargetLead] = useState<Lead | null>(null);
  const [isRescheduleDialogOpen, setIsRescheduleDialogOpen] = useState(false);


  // Authentication and User Profile States
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [isMenuOpen, setIsMenuOpen] = useState(false); // New state for mobile menu
  const [showClosingNoteForLead, setShowClosingNoteForLead] = useState<string | null>(null);


  const router = useRouter();

  const fetchLeads = useCallback(async (token: string) => {
    if (!token) {
      setLeads([]);
      return;
    }
    setIsFetching(true);
    try {
      const fetchedLeadsData = await leadApiService.fetchLeads(token);
      setLeads(fetchedLeadsData);
      toast.success('Leads data updated!');

    } catch (error: any) {
      console.error("Error fetching Leads:", error);
      toast.error(`Failed to fetch Leads: ${error.message}`);
    } finally {
      setIsFetching(false);
    }
  }, []);

  // Session validation useEffect
  useEffect(() => {
    const validateSession = async () => {
      try {
        const user = await checkCloudAuth();

        const fullUser: UserProfile = {
          ...user,
          accessToken: localStorage.getItem('accessToken') || '',
        };

        setCurrentUserProfile(fullUser);
        setIsLoggedIn(true);

        const allowedRoles = ['super-admin', 'sales']; // Only super-admin and sales
        if (!user.role || !allowedRoles.includes(user.role)) {
          toast.error('Access denied. Your role does not permit access to this dashboard.');
          router.replace(`/login`);
          return;
        }

      } catch (err: any) {
        console.warn('Auth failed or expired:', err.message);
        localStorage.clear();
        toast.error('Session expired or authentication failed. Please log in again.');
        router.replace(`/login`);
      }
    };

    validateSession();
  }, [router]);

  // Fetch leads only if user profile is available
  useEffect(() => {
    if (currentUserProfile?.accessToken && isLoggedIn) {
      fetchLeads(currentUserProfile.accessToken);

    }
  }, [fetchLeads, currentUserProfile, isLoggedIn]);


  const handleLeadAction = async (action: 'convert' | 'mark-hot' | 'reschedule' | 'close' | 'delete' | 'update', lead: Lead, details?: any) => {
    if (!currentUserProfile) {
      toast.error("User not authenticated. Please log in.");
      return;
    }
    // Set loading state specific to the lead being acted upon
    setIsActionLoading(lead.id);
    try {
      let newHistoryEntry: EditHistoryEntry | null = null;
      let updatedFields: Partial<Omit<Lead, 'id' | 'editHistory'>> = {};

      switch (action) {
        case 'convert':
          updatedFields = { status: 'Completed' };
          newHistoryEntry = { timestamp: Date.now(), editorName: currentUserProfile.name || currentUserProfile.email, description: "Lead marked as Completed" };
          break;
        case 'mark-hot':
          const newIsHotStatus = !lead.isHot; // Toggle the current status
          updatedFields = { isHot: newIsHotStatus };
          const hotDescription = newIsHotStatus ? "Lead marked as HOT" : "Lead marked as NOT HOT";
          newHistoryEntry = {
            timestamp: Date.now(),
            editorName: currentUserProfile.name || currentUserProfile.email,
            description: hotDescription
          };
          break;
        case 'reschedule':
          const newReminderDate = details?.newDate || lead.reminderDate;
          updatedFields = { reminderDate: newReminderDate };
          newHistoryEntry = { timestamp: Date.now(), editorName: currentUserProfile.name || currentUserProfile.email, description: `Rescheduled to ${newReminderDate}` };
          break;
        case 'close':
          updatedFields = { status: 'Closed', closingNote: details.note };
          newHistoryEntry = { timestamp: Date.now(), editorName: currentUserProfile.name || currentUserProfile.email, description: `Lead closed: ${details.note}` };
          break;
        case 'delete':
          await leadApiService.deleteLead(lead.leadId, currentUserProfile.accessToken);
          toast.success(`Lead ${lead.leadId} deleted.`);
          // After deletion, re-fetch leads to update the list
          await fetchLeads(currentUserProfile.accessToken);
          // If the deleted lead was the selected one, clear selection
          if (selectedLead?.id === lead.id) setSelectedLead(null);
          setShowClosingNoteForLead(null); // Clear closing note state if lead is deleted
          // Clear action loading state
          setIsActionLoading(false);
          return; // Exit early as fetchLeads will handle state update
        case 'update':
          updatedFields = details.updatedFields;
          newHistoryEntry = details.newHistoryEntry;
          break;
      }

      await leadApiService.updateLead(lead.leadId, updatedFields, newHistoryEntry, currentUserProfile.accessToken);
      toast.success(`Lead ${lead.leadId} updated.`);
      // After update, re-fetch leads to ensure UI is consistent
      await fetchLeads(currentUserProfile.accessToken);
      // If the updated lead was the selected one, clear selection or refresh its data
      if (selectedLead?.id === lead.id) setSelectedLead(null); // This will cause the dialog to close and re-open with fresh data if clicked again
    } catch (error: any) {
      console.error(`Error performing action ${action} on lead ${lead.leadId}:`, error);
      toast.error(`Action failed: ${error.message}`);
    } finally {
      setShowClosingNoteForLead(null); // Clear closing note state if lead is deleted
      // Always clear loading state
      setIsActionLoading(false);
    }
  };

  const handleAddLead = async (formData: Omit<Lead, "id" | "leadId" | "status" | "editHistory" | "uploadedFiles" | "createdBy" | "createdByName">,
    filesToUpload: File[]) => {
    if (!currentUserProfile?.accessToken) {
      toast.error("User not authenticated. Please log in.");
      return;
    }
    setIsActionLoading('create'); // Set a generic loading state for creation
    try {
      const newLead = await leadApiService.addLead({
        ...formData,
        createdBy: currentUserProfile.email,
        createdByName: currentUserProfile.name || currentUserProfile.email
      }, currentUserProfile.accessToken);

      if (filesToUpload.length > 0) {
        toast.info('Lead created. Uploading files...');
        const formattedFiles = await Promise.all(filesToUpload.map(file => compressAndConvertFile(file)));
        await leadApiService.uploadFile(newLead.leadId, formattedFiles, currentUserProfile.accessToken);
        toast.success('Files uploaded successfully!');
      }

      toast.success('Lead created successfully!');
      setIsCreateLeadDialogOpen(false); // Close dialog
      await fetchLeads(currentUserProfile.accessToken); // Refresh lead list
      // Optional: Add a temporary pulse animation to the newly created card
      setTimeout(() => {
        const card = document.getElementById(`lead-card-${newLead.id}`);
        card?.classList.add('animate-pulse-once'); // Assuming you have this CSS animation
      }, 100);
    } catch (error: any) {
      console.error("Error adding lead:", error);
      toast.error(`Failed to create lead: ${error.message}`);
    } finally {
      setIsActionLoading(false); // Clear loading state
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault(); // Prevent default browser action for Alt+N
        setIsCreateLeadDialogOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredLeads = useMemo(() => leads.filter(lead => {
    const searchLower = searchTerm.toLowerCase();
    return lead.leadId.toLowerCase().includes(searchLower) ||
      lead.clientName.toLowerCase().includes(searchLower) ||
      lead.phone.includes(searchTerm); // Search by phone number
  }), [leads, searchTerm]);

  const { newTodayLeads, reminderDueTodayLeads, needsAttentionLeads, upcomingFollowUpsLeads, completedClosedLeads } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today's date to midnight for comparison

    const newToday: Lead[] = [];
    const reminderDue: Lead[] = [];
    const stale: Lead[] = []; // Leads with overdue reminders
    const upcoming: Lead[] = [];
    const closed: Lead[] = [];

    filteredLeads.forEach(lead => {
      // Normalize created and reminder dates to midnight for consistent comparison
      const createdAt = new Date(lead.createdAt || 0); // Use 0 for leads without creation date
      createdAt.setHours(0, 0, 0, 0);

      const reminderDate = lead.reminderDate ? new Date(lead.reminderDate) : null;
      if (reminderDate) reminderDate.setHours(0, 0, 0, 0);

      if (lead.status === 'Completed' || lead.status === 'Closed') {
        closed.push(lead);
        return; // Skip other checks if already closed/completed
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
      // If none of the above, and status is 'In Progress' with no reminder or reminder in past,
      // it might still be considered "In Progress" but not specifically in one of the highlighted categories.
      // The current logic places it into 'stale' if reminder is past, so this is okay.
    });

    return {
      newTodayLeads: newToday,
      reminderDueTodayLeads: reminderDue,
      needsAttentionLeads: stale, // Correctly includes leads with past reminders
      upcomingFollowUpsLeads: upcoming,
      completedClosedLeads: closed
    };
  }, [filteredLeads]);

  const groupedCompletedClosedLeads = useMemo(() => {
    // Group completed and closed leads by their updated/created date
    return completedClosedLeads.reduce((acc, lead) => {
      const date = new Date(lead.updatedAt || lead.createdAt || Date.now()); // Fallback to now if no date
      const groupKey = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      if (!acc[groupKey]) {
        acc[groupKey] = [];
      }
      acc[groupKey].push(lead);
      return acc;
    }, {} as Record<string, Lead[]>);
  }, [completedClosedLeads]);

  const handleOpenRescheduleDialog = useCallback((lead: Lead) => {
    setRescheduleTargetLead(lead);
    setIsRescheduleDialogOpen(true);
  }, []);

  const handleOpenLeadDetailsDialogWithCloseNote = useCallback((lead: Lead) => {
    setSelectedLead(lead); // Open the details dialog
    setShowClosingNoteForLead(lead.id); // Indicate that the closing note should be shown
  }, []);

  // Logout handler
  const handleLogout = () => {
    localStorage.clear(); // Clear all local storage including tokens
    setIsLoggedIn(false); // Update logged in state
    setCurrentUserProfile(null); // Clear user profile
    router.replace('/login'); // Redirect to login page
  };


  const renderGroupedSection = (title: string, leads: Lead[], color: string, icon: JSX.Element) => {
    if (leads.length === 0) return null; // Don't render section if no leads
    return (
      <Card className="rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className={`p-4 text-white text-lg font-semibold flex items-center justify-between rounded-t-xl ${color.replace('border-', 'bg-')}`}>
          <h2 className="text-2xl font-bold flex items-center gap-2">{icon} {title}</h2>
          <Badge className="bg-white text-gray-800 font-bold px-3 py-1 rounded-full">{leads.length}</Badge>
        </CardHeader>
        <CardContent className="p-4 flex flex-col gap-4">
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              groupColor={color}
              onSelectLead={setSelectedLead}
              onAction={handleLeadAction}
              isActionLoading={isActionLoading} // Pass loading state to individual cards
              currentUser={currentUserProfile}
              onOpenRescheduleDialog={handleOpenRescheduleDialog}
              onOpenLeadDetailsDialogWithCloseNote={handleOpenLeadDetailsDialogWithCloseNote} // Pass new prop
            />
          ))}
        </CardContent>
      </Card>
    );
  };


  const pathname = usePathname();
  const { pageActions } = createSimplePageConfig(
    currentUserProfile,
    isFetching,
    fetchLeads,
    setIsCreateLeadDialogOpen
  );

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">


      <UniversalNavBar
        currentUserProfile={currentUserProfile}
        isLoggedIn={!currentUserProfile}
        handleLogout={handleLogout}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        searchPlaceholder="Search dashboard..."
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
        currentPath={pathname}
        pageActions={pageActions}
      // No page actions needed for dashboard
      />


      {/* Today's Summary Banner */}
      <div className="p-4 my-3 bg-blue-100 dark:bg-blue-900/50 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3"><Bell className="w-6 h-6 text-blue-600" /><h3 className="font-semibold text-lg">Today&apos;s Summary</h3></div>
        <div className="flex gap-4 text-sm">
          <p><strong>{newTodayLeads.length}</strong> New Leads</p>
          <p><strong>{reminderDueTodayLeads.length}</strong> Reminders Due</p>
          <p><strong>{needsAttentionLeads.length}</strong> Overdue</p>
        </div>
      </div>

      <main className="space-y-8">
        {/* Main grouped sections with grid layout */}
        <div className="space-y-8 grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
          {renderGroupedSection("Needs Attention", needsAttentionLeads, "border-red-600", <AlertTriangle className="text-white" />)}
          {renderGroupedSection("Reminder Due Today", reminderDueTodayLeads, "border-amber-500", <Bell className="text-white" />)}
          {renderGroupedSection("New Today", newTodayLeads, "border-green-600", <Star className="text-white" />)}
        </div>

        {/* Full-Width Upcoming Follow-ups Section */}
        {upcomingFollowUpsLeads.length > 0 && (
          <Card className="rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <CardHeader className="p-4 bg-purple-600 text-white text-lg font-semibold flex items-center justify-between rounded-t-xl">
              <h2 className="text-2xl font-bold flex items-center gap-2"><Calendar className="text-white" /> Upcoming Follow-ups</h2>
              <Badge className="bg-white text-gray-800 font-bold px-3 py-1 rounded-full">{upcomingFollowUpsLeads.length}</Badge>
            </CardHeader>
            <CardContent className="p-4 flex flex-row gap-4 overflow-x-auto pb-4">
              {upcomingFollowUpsLeads.map((lead) => (
                <LeadCard key={lead.id} lead={lead} groupColor="border-purple-500" onSelectLead={setSelectedLead} onAction={handleLeadAction} isActionLoading={isActionLoading} currentUser={currentUserProfile} onOpenRescheduleDialog={handleOpenRescheduleDialog} onOpenLeadDetailsDialogWithCloseNote={handleOpenLeadDetailsDialogWithCloseNote} />
              ))}
            </CardContent>
          </Card>
        )}

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="item-1">
            <AccordionTrigger className="text-xl font-bold p-4 bg-gray-100 dark:bg-gray-800 rounded-lg"><span className="flex items-center gap-2"><CheckCircle /> Converted & Closed ({completedClosedLeads.length})</span></AccordionTrigger>
            <AccordionContent>
              <div className="p-4 space-y-6">
                {Object.keys(groupedCompletedClosedLeads).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()).map(dateGroup => (
                  <div key={dateGroup}>
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-3">{dateGroup}</h3>
                    <div className="flex flex-row gap-4 overflow-x-auto pb-4">{groupedCompletedClosedLeads[dateGroup].map(lead => <LeadCard key={lead.id} lead={lead} groupColor="border-gray-400" onSelectLead={setSelectedLead} onAction={handleLeadAction} isActionLoading={isActionLoading} currentUser={currentUserProfile} onOpenRescheduleDialog={handleOpenRescheduleDialog} onOpenLeadDetailsDialogWithCloseNote={handleOpenLeadDetailsDialogWithCloseNote} />)}</div>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </main>

      {/* Dialog for creating new leads */}
      <LeadFormDialog isOpen={isCreateLeadDialogOpen} onOpenChange={setIsCreateLeadDialogOpen} onSubmit={handleAddLead} isSaving={isActionLoading === 'create'} currentUser={currentUserProfile} />

      {/* Dialog for viewing/editing lead details */}

      {selectedLead && <LeadDetailsDialog
        key={selectedLead.id}
        lead={selectedLead}
        isOpen={!!selectedLead}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedLead(null);
            setShowClosingNoteForLead(null); // Clear closing note state when dialog closes
          }
        }}
        onAction={handleLeadAction}
        currentUser={currentUserProfile}
        onOpenRescheduleDialog={handleOpenRescheduleDialog}
        initialShowClosingNote={showClosingNoteForLead === selectedLead.id} // Pass state to dialog
      />}
      {/* Reschedule Dialog (Global) */}
      <RescheduleDialog
        isOpen={isRescheduleDialogOpen}
        onOpenChange={setIsRescheduleDialogOpen}
        lead={rescheduleTargetLead}
        onConfirmReschedule={handleLeadAction}
        isActionLoading={isActionLoading}
      />


    </div>
  );
}

// --- FILE CONVERSION UTILITY ---
const compressAndConvertFile = (file: File): Promise<{ filename: string; mimeType: string; fileBase64: string }> => {
  return new Promise((resolve, reject) => {
    if (file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const base64String = (event.target?.result as string).split(',')[1];
        resolve({ filename: file.name, mimeType: file.type, fileBase64: base64String });
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
              resolve({ filename: file.name, mimeType: outputMimeType, fileBase64: base64String });
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


// --- DIALOG & FORM COMPONENTS ---

interface LeadFormDialogProps { isOpen: boolean; onOpenChange: (open: boolean) => void; onSubmit: (data: Omit<Lead, 'id' | 'leadId' | 'status' | 'editHistory' | 'uploadedFiles' | 'createdBy' | 'createdByName'>, files: File[]) => void; isSaving: boolean; currentUser: UserProfile | null; }

const LeadFormDialog: React.FC<LeadFormDialogProps> = ({ isOpen, onOpenChange, onSubmit, isSaving, currentUser }) => {
  const defaultReminder = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; }, []);
  const [clientName, setClientName] = useState('');
  const [phone, setPhone] = useState('');
  const [productInterest, setProductInterest] = useState('');
  const [reminderDate, setReminderDate] = useState<Date | undefined>(defaultReminder ? new Date(defaultReminder) : undefined);
  //const [open, setOpen] = useState(false);
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
    setReminderDate(defaultReminder ? new Date(defaultReminder) : undefined);  // Reset to the correct default date
    setSelectedFiles([]);
    setIsHot(false); // Reset hot status
    if (fileInputRef.current) fileInputRef.current.value = '';
  }


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName || !phone || !productInterest || !currentUser) return;

    // Updated phone number validation for exactly 10 digits
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phone)) {
      toast.error("Invalid phone number format. Please enter exactly 10 digits.");
      return;
    }

    onSubmit({ clientName, phone, productInterest, isHot, reminderDate: reminderDate ? format(reminderDate, 'yyyy-MM-dd') : undefined }, selectedFiles);
    resetForm();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle className="text-3xl font-extrabold text-blue-800 dark:text-blue-300">Create New Lead</DialogTitle></DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          {/* NEW COMPACT GRID 1: Client Name (2/3 width) and Hot Lead Toggle (1/3 width) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="clientName">Client Name</Label>
              <Input id="clientName" value={clientName} onChange={(e) => setClientName(e.target.value)} required />
            </div>

            {/* Hot Lead Toggle: CLEAN & PRACTICAL (1/3 width) */}
            <div className="flex flex-col h-full sm:col-span-1 justify-end space-y-2">
              {/* Use a hidden label to maintain vertical alignment with the input field's label */}
              <Label htmlFor="isHot" className="text-sm font-medium leading-none opacity-0 select-none">Hot Lead</Label>

              {/* Minimalist container that acts as a large click target */}
              <div
                className={`flex items-center justify-between w-full px-3 py-2 border rounded-lg transition-colors cursor-pointer h-10 
                        ${isHot
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/10'
                    : 'border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50'}
                    `}
                onClick={() => setIsHot(prev => !prev)}
              >
                <div className="flex items-center space-x-2 text-sm font-medium">
                  <TrendingUp
                    className={`w-4 h-4 transition-colors ${isHot ? 'text-red-600 dark:text-red-400 animate-pulse' : 'text-gray-400'}`}
                  />
                  <span className={`${isHot ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
                    {isHot ? 'HOT' : 'Lead'}
                  </span>
                </div>
                <Switch
                  id="isHot"
                  checked={isHot}
                  onCheckedChange={setIsHot}
                  className="data-[state=checked]:bg-red-500"
                  onClick={(e) => e.stopPropagation()} // CRITICAL FIX: Prevents double-toggling error when clicking the switch itself
                />
              </div>
            </div>
          </div>


          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel" // Changed to type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              maxLength={10} // Ensure input field limits to 10 characters
              pattern="\d{10}" // HTML5 pattern for basic client-side validation
              title="Phone number must be exactly 10 digits" // Tooltip for pattern
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="productInterest">Product Interest</Label>
            <Textarea
              id="productInterest"
              value={productInterest}
              onChange={(e) => setProductInterest(e.target.value)}
              required
              className="min-h-[60px] max-h-[150px] overflow-y-auto" // Added for scrollability
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
            <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-100 flex items-center gap-2"><Paperclip className="w-5 h-5" /> Attachments (Optional)</h3>
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
                      <Button variant="ghost" size="sm" onClick={() => handleRemoveFile(index)} className="text-red-500 hover:text-red-700"><X className="w-4 h-4" /></Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <DialogFooter><Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button><Button type="submit" disabled={isSaving}>{isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}Create Lead</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

interface RescheduleDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  onConfirmReschedule: (action: 'reschedule', lead: Lead, details: { newDate: string }) => void;
  isActionLoading: false | string;
}

const RescheduleDialog: React.FC<RescheduleDialogProps> = ({ isOpen, onOpenChange, lead, onConfirmReschedule, isActionLoading }) => {
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>(lead?.reminderDate ? new Date(lead.reminderDate) : undefined);
  //const [rescheduleOpen, setRescheduleOpen] = useState(false);
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
          <DialogTitle className="text-3xl font-extrabold text-blue-800 dark:text-blue-300">Reschedule Lead: {lead?.leadId}</DialogTitle>
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


interface LeadDetailsDialogProps {
  lead: Lead;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAction: (action: 'convert' | 'mark-hot' | 'reschedule' | 'close' | 'delete' | 'update', lead: Lead, details?: any) => void;
  currentUser: UserProfile | null;
  onOpenRescheduleDialog: (lead: Lead) => void;
  initialShowClosingNote: boolean; // New prop to indicate if closing note should be shown
}
const LeadDetailsDialog: React.FC<LeadDetailsDialogProps> = (props) => {
  const { lead, isOpen, onOpenChange, onAction, currentUser, onOpenRescheduleDialog, initialShowClosingNote } = props;
  const [isEditing, setIsEditing] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [closingNote, setClosingNote] = useState("");
  const [isAttachmentsAccordionOpen, setIsAttachmentsAccordionOpen] = useState(false); // State for Attachments accordion
  const [isHistoryAccordionOpen, setIsHistoryAccordionOpen] = useState(false); // State for Edit History accordion


  // New state for file deletion confirmation
  const [isConfirmFileDeleteDialogOpen, setIsConfirmFileDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<FileMetadata | null>(null);

  const isLocked = lead.status === 'Completed' || lead.status === 'Closed';

  const [formData, setFormData] = useState({ clientName: lead.clientName, phone: lead.phone, productInterest: lead.productInterest, status: lead.status, reminderDate: lead.reminderDate ? new Date(lead.reminderDate).toISOString().split('T')[0] : '', isHot: lead.isHot || false, });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  // Local loading states for actions within LeadDetailsDialog
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
        reminderDate: lead.reminderDate ? new Date(lead.reminderDate).toISOString().split('T')[0] : ''
      });
    }
    setSelectedFiles([]);
    // Only set isClosing to true if the lead status is explicitly changing to 'Closed'
    // or if coming from the card's 'Close Lead' action.
    // We remove the initialShowClosingNote prop and control it here.
    if (initialShowClosingNote) {
      setIsClosing(true);
    } else {
      setIsClosing(false);
    }
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

    // Handle isHot change
    if (formData.isHot !== (lead.isHot || false)) {
      updatedFields.isHot = formData.isHot;
      changes.push(formData.isHot ? `marked as HOT` : `marked as STANDARD`);
    }


    // Handle status change explicitly for Super Admin, and open closing note if changed to 'Closed'
    if (formData.status !== lead.status) {
      updatedFields.status = formData.status;
      changes.push(`status to "${formData.status}"`);
      if (formData.status === 'Closed' && currentUser?.role === 'super-admin') {
        setIsClosing(true); // Open closing note input for Super Admin changing status to Closed
      } else if (lead.status === 'Closed' && formData.status !== 'Closed') {
        // If changing from Closed to another status, clear the closing note
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

    if (Object.keys(updatedFields).length > 0) {
      setIsLeadDetailsActionLoading(true);
      try {
        const newHistoryEntry: EditHistoryEntry = { timestamp: Date.now(), editorName: currentUser.name || currentUser.email, description: `Updated ${changes.join(', ')}.` };
        await onAction('update', lead, { updatedFields, newHistoryEntry: newHistoryEntry });
      } catch (error: any) {
        console.error("Error saving lead details:", error);
        toast.error(`Failed to save changes: ${error.message}`);
      } finally {
        setIsLeadDetailsActionLoading(false);
      }
    } else {
      toast.info("No changes were made.");
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
    onOpenChange(false); // Close the dialog after successful close
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

  const handleUploadFiles = async () => {
    if (!currentUser || !lead.id || selectedFiles.length === 0) {
      toast.error("No files selected or user not authenticated.");
      return;
    }
    setIsLeadDetailsUploadingFiles(true);
    try {
      const formattedFiles = await Promise.all(selectedFiles.map(file => compressAndConvertFile(file)));
      await leadApiService.uploadFile(lead.leadId, formattedFiles, currentUser.accessToken);
      toast.success("Files uploaded successfully!");
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await onAction('update', lead, { updatedFields: {}, newHistoryEntry: { timestamp: Date.now(), editorName: currentUser.name || currentUser.email, description: `Uploaded ${formattedFiles.length} new files.` } });
    } catch (error: any) {
      console.error("Error uploading files:", error);
      toast.error(`Failed to upload files: ${error.message}`);
    } finally {
      setIsLeadDetailsUploadingFiles(false);
    }
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
      await leadApiService.deleteFile(fileToDelete.fileId, currentUser.accessToken);
      toast.success("File deleted successfully!");
      await onAction('update', lead, { updatedFields: {}, newHistoryEntry: { timestamp: Date.now(), editorName: currentUser.name || currentUser.email, description: `Deleted file: ${fileToDelete.filename}.` } });
    } catch (error: any) {
      console.error("Error deleting file:", error);
      toast.error(`Failed to delete file: ${error.message}`);
    } finally {
      setIsLeadDetailsUploadingFiles(false);
      setFileToDelete(null);
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}  >
      {/* DialogContent with adjusted padding for responsiveness */}
      <DialogContent showCloseButton={false} className="w-[95%] max-w-[95%] sm:max-w-[800px] md:max-w-[900px] lg:max-w-[1100px] p-3 sm:p-4 md:p-6 rounded-xl shadow-lg flex flex-col  max-h-[80vh] sm:max-h-[70vh] md:max-h-[60vh] lg:max-h-[90vh]  transition-all duration-300 ease-out">
        {/* DialogHeader remains sticky with responsive font size */}
        <DialogHeader className="p-2 pb-1 border-b flex flex-row items-center justify-between sticky  rounded-md  top-0  z-10">
          <div>
            <DialogTitle className="text-lg sm:text-xl md:text-2xl font-extrabold text-blue-800 dark:text-blue-300">Lead: {lead.leadId} - {lead.clientName}</DialogTitle>
          </div>
          {/* Only one close button - the X icon */}
          <DialogClose asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </DialogClose>
        </DialogHeader>

        {/* Main content grid with responsive gaps and padding */}
        <div className="p-3 sm:p-4 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 overflow-y-auto flex-grow">
          <div className="md:col-span-2 space-y-3 sm:space-y-4">
            {isLocked && <div className="p-2 bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300 rounded-md flex items-center gap-2 text-xs sm:text-sm"><AlertTriangle className="w-4 h-4" /><p className="font-medium">This lead is finalized. No further actions available.</p></div>}
            <Card className="p-3 sm:p-4 space-y-3 sm:space-y-4">
              <h3 className="text-base sm:text-lg font-bold mb-2 flex items-center gap-2"><UserIcon className="w-4 h-4 text-blue-500" /> Lead Information</h3>
              <div className="flex items-center justify-between border-y py-3">
                {/* Left Side: Label and Icon */}
                <Label className="text-sm flex items-center gap-3 font-semibold text-gray-800 dark:text-gray-200">
                  <Flame className={`w-5 h-5 ${formData.isHot ? 'text-red-600' : 'text-gray-400'}`} />
                  <span>Premium Hot Lead Status</span>
                </Label>

                {/* Right Side: Conditional Switch or Static Badge */}
                {isEditing && !isLocked ? (
                  // Editable state: Show Switch
                  <Switch
                    checked={formData.isHot}
                    onCheckedChange={(checked) => setFormData({ ...formData, isHot: checked })}
                    disabled={isLeadDetailsActionLoading}
                    // Ensures the switch thumb highlights red for a Hot Lead
                    className="data-[state=checked]:bg-red-500"
                  />
                ) : (
                  // View state: Show Static Badge with more distinct styling
                  <span
                    className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full transition-colors duration-200 
                        ${formData.isHot
                        ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' // Stronger visual for HOT
                        : 'bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-700 dark:text-gray-400' // Subtle for STANDARD
                      }`}
                  >
                    {formData.isHot ? '🔥 HIGH PRIORITY' : 'STANDARD'}
                  </span>
                )}
              </div>


              <div>
                <Label className="text-xs sm:text-sm">Phone</Label>
                <div className="flex items-center gap-1 sm:gap-2 text-sm sm:text-base">
                  {isEditing ?
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="h-8 text-sm"
                      maxLength={10}
                      pattern="\d{10}"
                      title="Phone number must be exactly 10 digits"
                      type="tel"
                    />
                    : <p className="font-medium">{lead.phone}</p>}
                  {!isLocked && (
                    <>
                      <TooltipProvider><Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" onClick={() => window.open(`tel:${lead.phone}`)}><PhoneCall className="w-4 h-4 text-blue-500" /></Button></TooltipTrigger><TooltipContent><p>Call Lead</p></TooltipContent></Tooltip></TooltipProvider>
                      <TooltipProvider><Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" onClick={() => window.open(`https://wa.me/91${lead.phone}`, '_blank')}><MessageCircle className="w-4 h-4 text-green-500" /></Button></TooltipTrigger><TooltipContent><p>WhatsApp Lead</p></TooltipContent></Tooltip></TooltipProvider>
                    </>
                  )}
                </div>
              </div>
              <div><Label className="text-xs sm:text-sm">Client Name</Label>{isEditing ? <Input value={formData.clientName} onChange={(e) => setFormData({ ...formData, clientName: e.target.value })} className="h-8 text-sm" /> : <p className="text-sm sm:text-base font-medium">{lead.clientName}</p>}</div>
              <div><Label className="text-xs sm:text-sm">Product Interest</Label>{isEditing ? <Textarea value={formData.productInterest} onChange={(e) => setFormData({ ...formData, productInterest: e.target.value })} className="min-h-[60px] text-sm" /> : <p className="text-sm sm:text-base whitespace-pre-wrap">{lead.productInterest}</p>}</div>
            </Card>
            {(isClosing || initialShowClosingNote) && ( // Show closing note if isClosing is true or initialShowClosingNote is true
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
                <h3 className="text-base sm:text-lg font-bold flex items-center gap-2"><XCircle className="w-4 h-4 text-red-500" /> Closing Note</h3>
                <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{lead.closingNote}</p>
              </Card>
            )}
          </div>
          <div className="space-y-3 sm:space-y-4">
            <Card className="p-3 sm:p-4 space-y-3 sm:space-y-4">
              <h3 className="text-base sm:text-lg font-bold mb-2 flex items-center gap-2"><Clock className="w-4 h-4 text-blue-500" /> Status & Schedule</h3>
              <div>
                <Label className="text-xs sm:text-sm">Status</Label>
                {isEditing && currentUser?.role === 'super-admin' ? (
                  <Select
                    value={formData.status}
                    onValueChange={(value: LeadStatus) => {
                      setFormData({ ...formData, status: value });
                      // If status is changed to 'Closed' by a super-admin, open the closing note field
                      if (value === 'Closed') {
                        setIsClosing(true);
                      } else {
                        setIsClosing(false);
                      }
                    }}
                    disabled={isLeadDetailsActionLoading}
                  >
                    <SelectTrigger className="w-full h-8 text-sm">
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
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
              <div><Label className="text-xs sm:text-sm">Reminder Date</Label>{isEditing ? <Input type="date" value={formData.reminderDate} onChange={(e) => setFormData({ ...formData, reminderDate: e.target.value })} className="h-8 text-sm" /> : <p className="text-sm sm:text-base">{lead.reminderDate ? new Date(lead.reminderDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}</p>}</div>
            </Card>

            {lead.existingLeads && lead.existingLeads.length > 0 && (
              <Accordion type="single" collapsible>
                <AccordionItem value="past-interactions">
                  <AccordionTrigger><span className="flex items-center gap-2 text-sm sm:text-base"><History /> Past Interactions ({lead.existingLeads?.length || 0})</span></AccordionTrigger>
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

            <Accordion type="single" collapsible value={isAttachmentsAccordionOpen ? "attachments" : ""} onValueChange={(val) => {
              setIsAttachmentsAccordionOpen(val === "attachments");
            }}>
              <AccordionItem value="attachments">
                <AccordionTrigger><span className="flex items-center gap-2 text-sm sm:text-base"><Paperclip /> Attachments ({lead.uploadedFiles?.length || 0})</span></AccordionTrigger>
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
                                <Button variant="ghost" size="sm" onClick={() => handleRemoveSelectedFile(index)} className="text-red-500 hover:text-red-700 h-6 w-6"><X className="w-3 h-3" /></Button>
                              </li>
                            ))}
                          </ul>
                          <Button onClick={handleUploadFiles} disabled={isLeadDetailsUploadingFiles || selectedFiles.length === 0} className="w-full mt-2 text-xs h-8">
                            {isLeadDetailsUploadingFiles ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Upload className="w-3 h-3 mr-1" />} Upload Selected Files
                          </Button>
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
                              <a
                                href={`https://drive.google.com/file/d/${file.fileId}/preview`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                                title="Preview File"
                              >
                                <Eye className="w-4 h-4" />
                              </a>
                              <a href={`https://drive.google.com/uc?export=download&id=${file.fileId}`} target="_blank" rel="noopener noreferrer" className="text-green-500 hover:text-green-700" title="Download File">
                                <Download className="w-3 h-3" />
                              </a>
                              {!isLocked && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => confirmFileDeletion(file)}
                                  disabled={isLeadDetailsUploadingFiles}
                                  className="text-red-500 hover:text-red-700 h-6 w-6"
                                >
                                  {isLeadDetailsUploadingFiles ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                </Button>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 text-center">{!isLocked ? 'No files uploaded yet. Drag & drop or click to add.' : 'No files uploaded.'}</p>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <Accordion type="single" collapsible value={isHistoryAccordionOpen ? "history" : ""} onValueChange={(val) => setIsHistoryAccordionOpen(val === "history")}>
              <AccordionItem value="history">
                <AccordionTrigger><span className="flex items-center gap-2 text-sm sm:text-base"><History /> Edit History ({lead.editHistory?.length || 0})</span></AccordionTrigger>
                <AccordionContent className="space-y-1 max-h-32 overflow-y-auto p-2">
                  {lead.editHistory && lead.editHistory.length > 0 ? (
                    lead.editHistory.sort((a, b) => b.timestamp - a.timestamp).map((entry, index) => (
                      <div key={index} className="bg-gray-100 dark:bg-gray-700 p-2 rounded-md text-xs">
                        <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(entry.timestamp).toLocaleString()} by {entry.editorName}</p>
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

        {/* Footer for action buttons - adjusted for compact row */}
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
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                  className="min-w-[80px] text-xs sm:text-sm whitespace-nowrap h-8 sm:h-9 px-3 sm:px-4"
                  disabled={isLeadDetailsActionLoading}
                >
                  Cancel Edit
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isLeadDetailsActionLoading}
                  className="min-w-[80px] bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm whitespace-nowrap h-8 sm:h-9 px-3 sm:px-4"
                >
                  {isLeadDetailsActionLoading && <Loader2 className="w-3 h-3 mr-1 sm:mr-2 animate-spin" />} Save Changes
                </Button>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-1 sm:gap-2 justify-center sm:justify-end w-full sm:w-auto mt-1 sm:mt-0">
            {!isLocked && !isEditing && (
              <>
                {/* MARK AS HOT / NOT HOT BUTTON */}
                {/* TOGGLE HOT STATUS BUTTON - Compacted */}
                <Button
                  onClick={() => handleMarkHotToggle(lead.isHot || false)}
                  disabled={isLeadDetailsActionLoading}
                  // Reduced size classes: h-8, px-3, text-xs
                  className={cn(
                    "min-w-[120px] text-white text-xs whitespace-nowrap h-8 px-3 font-semibold shadow-md transition-all",
                    lead.isHot
                      ? "bg-gray-600 hover:bg-gray-700 shadow-gray-500/30" // Action: Downgrade to Standard
                      : "bg-red-600 hover:bg-red-700 shadow-red-500/30"    // Action: Upgrade to HOT
                  )}
                >
                  {isLeadDetailsActionLoading ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    // Reduced icon size: w-3 h-3
                    lead.isHot ? (
                      <X className="w-3 h-3 mr-1" />
                    ) : (
                      <Flame className="w-3 h-3 mr-1" />
                    )
                  )}
                  {lead.isHot ? 'Set to Standard' : 'Mark as HOT'}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => onOpenRescheduleDialog(lead)}
                  disabled={isLeadDetailsActionLoading}
                  className="min-w-[80px] bg-blue-500 hover:bg-blue-600 text-white text-xs sm:text-sm whitespace-nowrap h-8 sm:h-9 px-3 sm:px-4"
                >
                  {isLeadDetailsActionLoading ? <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" /> : <Calendar className="w-3 h-3 mr-1 sm:mr-2" />} Reschedule
                </Button>
                <Button
                  onClick={async () => {
                    setIsLeadDetailsActionLoading(true);
                    try {
                      await onAction('convert', lead);
                    } catch (error: any) {
                      console.error("Error marking lead as won:", error); // Updated message
                      toast.error(`Failed to mark lead as won: ${error.message}`); // Updated message
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
              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-xs sm:text-sm"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent>
                {!isLocked && (
                  <DropdownMenuItem
                    onClick={() => { setIsClosing(true); }}
                    disabled={isLeadDetailsActionLoading}
                    className="text-xs sm:text-sm"
                  >
                    {isLeadDetailsActionLoading && isClosing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />} <span>Close Lead</span>
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
                    {isLeadDetailsActionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />} <span>Delete</span>
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

      {/* Custom Confirmation Dialog for File Deletion */}
      <Dialog open={isConfirmFileDeleteDialogOpen} onOpenChange={setIsConfirmFileDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm File Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{fileToDelete?.filename}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setIsConfirmFileDeleteDialogOpen(false); setFileToDelete(null); }}
              disabled={isLeadDetailsUploadingFiles}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={executeFileDeletion}
              disabled={isLeadDetailsUploadingFiles}
            >
              {isLeadDetailsUploadingFiles ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};
