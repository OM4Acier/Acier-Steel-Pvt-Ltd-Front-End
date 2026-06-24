// app/tasks/components/TaskDetailDialog.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Task, TaskPriority, TaskStatus, UpdateTaskInput, RecurrenceFrequency } from '../types/task';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  ChevronDown,
  ChevronUp,
  Paperclip,
  XCircle,
  Repeat,
  Clock,
  AlertCircle,
  Edit3,
  MoreVertical,
  Trash2,
  Settings2,
  CheckCircle2} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
//import { pdfBytesToFile, processFilesToPdf } from '@/lib/utils/pdfMergeUtils';
import { Badge } from '@/components/ui/badge';
import { ActivityList } from './ActivityLog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TaskCapabilities } from '../page';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import AudioManager from '@/components/AudioManager';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { UserProfile } from '@/types/rbac.types';
import { useRBAC } from '@/hooks/useRBAC';

interface TaskDetailDialogProps {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: { id: string; name: string; avatar: string; }[];
  user: UserProfile;
  capabilities: TaskCapabilities;
  onUpdate?: (id: string, data: any) => Promise<void>;
  onUpdateStatus?: (id: string, status: TaskStatus, notes?: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onRefresh?: () => Promise<Task | null>;
}

interface Attachment {
  filename: string;
  url?: string;
  driveId?: string;
}

const statusOptions: TaskStatus[] = ['in_progress', 'completed', 'need_help'];
const priorityOptions: TaskPriority[] = ['low', 'medium', 'high'];
const recurrenceOptions: RecurrenceFrequency[] = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];

const statusColorMap: Record<TaskStatus, string> = {
  in_progress: 'bg-blue-500',
  completed: 'bg-emerald-500',
  need_help: 'bg-rose-500'
};

const RenderDataBlock = ({
  label,
  value,
  children,
  editable
}: {
  label: string;
  value: any;
  children: React.ReactNode;
  editable: boolean;
}) => (
  <div className="space-y-1.5">
    <Label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">
      {label}
    </Label>
    {editable ? children : (
      <div className="p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 text-sm text-slate-700 dark:text-slate-300 min-h-[44px] whitespace-pre-wrap transition-colors">
        {value || <span className="text-slate-400 dark:text-slate-600 italic">Not set</span>}
      </div>
    )}
  </div>
);

export function TaskDetailDialog({
  task,
  open,
  onOpenChange,
  users,
  user,
  capabilities,
  onUpdate,
  onUpdateStatus,
  onDelete,
  onRefresh
}: TaskDetailDialogProps) {
  const { isSuperAdmin: checkSuperAdmin } = useRBAC(user);

  const isSuperAdminUser = useMemo(() => checkSuperAdmin(), [checkSuperAdmin]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [localTask, setLocalTask] = useState(task);
  const [newAttachments, setNewAttachments] = useState<File[]>([]);
  const [isActivityCollapsed, setIsActivityCollapsed] = useState(true);
  const [isRecurrenceOpen, setIsRecurrenceOpen] = useState(false);


  // Sync local task with prop changes
  useEffect(() => {
    if (open) {
      setLocalTask(task);
      setNewAttachments([]);
      setIsEditMode(false);
      setIsActivityCollapsed(true);
      setIsRecurrenceOpen(false);
    }
  }, [open, task]);

  // Update local task when parent task changes (real-time sync)
  useEffect(() => {
    if (task.id === localTask.id) {
      setLocalTask(task);
    }
  }, [task, localTask.id]);

  const isFieldEditable = (field: keyof Task | 'recurrencePattern') => {
    // 1. Basic state checks (Global disabled states)
    if (!isEditMode || isSaving) return false;

    // 2. Super Admin always has full access
    if (isSuperAdminUser) return true;

    // 3. Check if the current user is the creator (Assigned By)
    // Ensure you have access to the logged-in 'user' object here
    const isCreator = task.assignedBy === user?.id;
    if (isCreator) return true;

    // 4. Fallback: Restricted fields for everyone else (Assignees, etc.)
    return ['notes', 'attachments', 'audioNotes', 'status'].includes(field);
  };

  const handleFieldChange = (field: keyof Task, value: any) => {
    setLocalTask(prev => ({ ...prev, [field]: value }));
  };

  const handleStatusChangeImmediate = async (newStatus: TaskStatus) => {
    if (isSaving || newStatus === localTask.status) return;

    setIsSaving(true);
    try {
      await onUpdateStatus?.(localTask.id, newStatus);

      // Refresh from server to get updated task
      if (onRefresh) {
        const refreshed = await onRefresh();
        if (refreshed) {
          setLocalTask(refreshed);
        }
      }

      toast.success(`Task moved to ${newStatus.replace('_', ' ')}`);
    } catch (error) {
      console.error("Status update failed:", error);
      toast.error('Failed to update status');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveExistingAttachment = (indexToRemove: number) => {
    setLocalTask(prev => ({
      ...prev,
      attachments: prev.attachments?.filter((_, index) => index !== indexToRemove) || []
    }));
  };

  const handleSave = useCallback(async () => {
    if (!localTask?.id || isSaving) return;
    setIsSaving(true);

    try {
      const textChanges: UpdateTaskInput = {};
      let hasTextChanges = false;

      const fieldsToCheck = isSuperAdminUser
        ? ['title', 'description', 'notes', 'priority', 'assignedTo', 'dueDate', 'recurrencePattern', 'attachments']
        : ['notes', 'attachments'];

      fieldsToCheck.forEach(field => {
        const key = field as keyof Task;
        if (JSON.stringify(localTask[key]) !== JSON.stringify(task[key])) {
          (textChanges as any)[field] = localTask[key];
          hasTextChanges = true;
        }
      });

      if (hasTextChanges) {
        await onUpdate?.(localTask.id, textChanges);
      }

      if (newAttachments.length > 0) {
        //const { pdfBytes, filename } = await processFilesToPdf(newAttachments, 'task-attachments');
        //const uploadObject = await pdfBytesToFile(pdfBytes, filename);
        //await apiService.uploadFile(localTask.id, 'task-attachments', [uploadObject], '');
      }

      // Refresh from server
      if (onRefresh) {
        const refreshed = await onRefresh();
        if (refreshed) {
          setLocalTask(refreshed);
        }
      }

      setNewAttachments([]);
      setIsEditMode(false);
      toast.success('Task updated successfully');

    } catch (e: any) {
      console.error('Save failed', e);
      toast.error('Failed to save task', { description: e?.message });
    } finally {
      setIsSaving(false);
    }
  }, [localTask, task, newAttachments, onUpdate, onRefresh, isSuperAdminUser, isSaving]);

  const handleDelete = async () => {
    if (window.confirm(`Permanently delete "${task.title}"?`)) {
      try {
        await onDelete?.(task.id);
        onOpenChange(false);
        toast.success('Task deleted successfully');
      } catch (error) {
        console.error('Delete failed:', error);
        toast.error('Failed to delete task');
      }
    }
  };

  // Memoize assignee to prevent lookup issues
  const currentAssignee = useMemo(() => {
    if (!localTask.assignedTo || !users || users.length === 0) return null;
    return users.find(u => u.id === localTask.assignedTo) || null;
  }, [localTask.assignedTo, users]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] md:max-w-[1200px] h-[90vh] flex flex-col z-50 p-0 overflow-hidden bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border-0">

        {/* Status Accent Bar */}
        <div className={cn("h-1.5 w-full shrink-0", statusColorMap[localTask.status])} />

        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              {isFieldEditable('title') ? (
                <Input
                  value={localTask.title}
                  onChange={(e) => handleFieldChange('title', e.target.value)}
                  className="text-xl font-bold border-slate-200 focus-visible:ring-blue-100 h-10 px-2 -ml-2"
                  placeholder="Task Title"
                  disabled={isSaving}
                />
              ) : (
                <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white leading-tight">
                  {localTask.title}
                </DialogTitle>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 h-full">

            {/* LEFT CONTENT COLUMN */}
            <div className="lg:col-span-8 p-8 space-y-8">

              {/* Context Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className={cn(
                  "capitalize px-3 py-1 text-xs font-semibold",
                  localTask.status === 'completed' ? "bg-emerald-100 text-emerald-700" :
                    localTask.status === 'need_help' ? "bg-rose-100 text-rose-700" :
                      "bg-blue-100 text-blue-700"
                )}>
                  {localTask.status.replace('_', ' ')}
                </Badge>
                {localTask.isRecurring && (
                  <Badge variant="outline" className="gap-1.5 border-purple-200 text-purple-700 font-semibold">
                    <Repeat className="w-3.5 h-3.5" /> Recurring
                  </Badge>
                )}
                {localTask.dueDateExtensionCount > 0 && (
                  <Badge variant="outline" className="gap-1.5 border-amber-200 text-amber-700 font-semibold">
                    <AlertCircle className="w-3.5 h-3.5" /> {localTask.dueDateExtensionCount} Extensions
                  </Badge>
                )}
              </div>

              <RenderDataBlock label="Description" value={localTask.description} editable={isFieldEditable('description')}>
                <Textarea
                  placeholder="Provide a detailed description..."
                  className="min-h-[150px] resize-none text-base leading-relaxed bg-white dark:bg-slate-900 border-slate-200 rounded-xl"
                  value={localTask.description || ''}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  disabled={isSaving}
                />
              </RenderDataBlock>

              <RenderDataBlock label="Private Team Notes" value={localTask.notes} editable={isFieldEditable('notes')}>
                <Textarea
                  placeholder="Internal updates, blockers, or quick notes..."
                  className="min-h-[100px] resize-none bg-amber-50/20 border-amber-100 rounded-xl"
                  value={localTask.notes || ''}
                  onChange={(e) => handleFieldChange('notes', e.target.value)}
                  disabled={isSaving}
                />
              </RenderDataBlock>

              {/* Attachments */}
              <div className="space-y-4 hidden">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                  Documentation & Files
                </Label>

                {isFieldEditable('audioNotes') && (
                  <div className="mb-4">
                    <AudioManager
                      currentUser={user}
                      identifier={localTask.id}
                      identifierType="task"
                      uploadStage="task-audio"
                      initialFiles={[]}
                      maxFiles={5}
                      acceptedFormats={['audio/webm', 'audio/mp3', 'audio/wav']}
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {localTask.attachments?.map((att: Attachment, index: number) => (
                    <div key={`existing-${index}`} className="flex items-center justify-between p-4 border border-slate-100 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow group">
                      <a href={att.url || '#'} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 overflow-hidden flex-1">
                        <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0 text-slate-400 group-hover:text-blue-500 transition-colors">
                          <Paperclip className="w-5 h-5" />
                        </div>
                        <span className="text-sm font-semibold text-slate-700 truncate">{att.filename}</span>
                      </a>
                      {isFieldEditable('attachments') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors"
                          onClick={() => handleRemoveExistingAttachment(index)}
                          disabled={isSaving}
                        >
                          <XCircle className="h-5 w-5" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {newAttachments.map((file, index) => (
                    <div key={`new-${index}`} className="flex items-center justify-between p-4 border border-blue-100 rounded-xl bg-blue-50/30">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600">
                          <Paperclip className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-slate-900 truncate">{file.name}</span>
                          <span className="text-[10px] text-blue-600 font-bold uppercase tracking-tight italic">New</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-rose-500 rounded-full"
                        onClick={() => setNewAttachments(prev => prev.filter((_, i) => i !== index))}
                      >
                        <XCircle className="h-5 w-5" />
                      </Button>
                    </div>
                  ))}
                </div>
                {/* {isFieldEditable('attachments') && (
                          <FileUploadZone onFilesSelect={(f) => setNewAttachments(prev => [...prev, ...f])} />
                        )}*/}
              </div>

              {/* Activity Feed */}
              <div className="pt-8 border-t border-slate-100">
                <div
                  className="flex items-center justify-between mb-6 cursor-pointer group"
                  onClick={() => setIsActivityCollapsed(!isActivityCollapsed)}
                >
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] group-hover:text-slate-600 transition-colors">
                    Activity History
                  </h4>
                  <div className="h-px flex-1 bg-slate-100 mx-4" />
                  {isActivityCollapsed ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
                </div>
                {!isActivityCollapsed && <ActivityList taskId={localTask.id} />}
              </div>
            </div>

            {/* RIGHT SETTINGS COLUMN */}
            <div className="lg:col-span-4 lg:border-l border-slate-100 bg-slate-50/30 p-8 space-y-10">

              {/* Status & Priority */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                    Lifecycle Status
                  </Label>
                  <Select
                    value={localTask.status}
                    onValueChange={handleStatusChangeImmediate}
                    disabled={isSaving || (!isFieldEditable('status') && !isEditMode)}
                  >
                    <SelectTrigger className="w-full bg-white border-slate-200 h-11 text-sm font-bold shadow-sm rounded-xl transition-all">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[60]">
                      {statusOptions.map(s => (
                        <SelectItem key={s} value={s} className="capitalize text-sm font-medium">
                          {s.replace('_', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <RenderDataBlock label="Priority" value={localTask.priority} editable={isFieldEditable('priority')}>
                  <Select
                    value={localTask.priority}
                    onValueChange={(v: TaskPriority) => handleFieldChange('priority', v)}
                    disabled={isSaving}
                  >
                    <SelectTrigger className="w-full bg-white border-slate-200 h-11 text-sm font-semibold shadow-sm rounded-xl transition-all">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[60]">
                      {priorityOptions.map(p => (
                        <SelectItem key={p} value={p} className="capitalize text-sm font-medium">{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </RenderDataBlock>
              </div>

              <RenderDataBlock
                label="Assignee"
                value={currentAssignee?.name || 'Unassigned'}
                editable={isFieldEditable('assignedTo')}
              >
                <Select
                  value={localTask.assignedTo}
                  onValueChange={(v) => handleFieldChange('assignedTo', v)}
                  disabled={isSaving}
                >
                  <SelectTrigger className="w-full h-14 bg-white border-slate-200 shadow-sm rounded-xl">
                    <div className="flex items-center gap-3 text-left">
                      <Avatar className="w-8 h-8 border-2 border-slate-50 shadow-inner ring-1 ring-slate-100">
                        <AvatarFallback className="text-xs font-black bg-slate-100 text-slate-600">
                          {currentAssignee?.name?.[0]?.toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold text-slate-900 truncate">
                          {currentAssignee?.name || "Unassigned"}
                        </span>
                        <span className="text-[9px] text-slate-400 uppercase font-black tracking-tighter">
                          Assigned To Task
                        </span>
                      </div>
                    </div>
                  </SelectTrigger>
                  <SelectContent className="z-[60]">
                    {users && users.length > 0 ? (
                      users.map(u => (
                        <SelectItem key={u.id} value={u.id} className="text-sm font-medium py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-6 h-6">
                              <AvatarFallback className="text-[10px]">{u.name[0]}</AvatarFallback>
                            </Avatar>
                            {u.name}
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <div className="p-2 text-xs text-slate-500">No users available</div>
                    )}
                  </SelectContent>
                </Select>
              </RenderDataBlock>

              <RenderDataBlock
  label="Deadline"
  value={localTask.dueDate ? format(new Date(localTask.dueDate), "PPP") : null}
  editable={isFieldEditable('dueDate')}
>
<Input
  type="date"
  id="deadline-date-picker"
  value={localTask.dueDate ? new Date(localTask.dueDate).toISOString().split('T')[0] : ''}
  onChange={(e) => {
    const selectedDate = e.target.value ? new Date(e.target.value) : undefined;
    handleFieldChange('dueDate', selectedDate?.toISOString());
  }}
  min={new Date().toISOString().split('T')[0]}
  disabled={isSaving}
  className={cn(
    "w-full h-11 px-4 font-bold text-sm transition-all duration-300",
    // GLASSMORPHIC CORE
    "bg-white/20 backdrop-blur-md", 
    "border border-white/40",
    "rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.05)]",
    // TEXT COLORS
    "text-slate-700 placeholder:text-slate-400",
    // STATES
    "hover:bg-white/30 hover:border-white/60",
    "focus:ring-2 focus:ring-blue-500/20 focus:bg-white/40 focus:border-blue-400",
    // CALENDAR ICON STYLING (The "Fix")
    "custom-date-input" 
  )}
/>
</RenderDataBlock>

              {/* Recurrence Section */}
              <div className="pt-6 border-t border-slate-100 hidden">
                <Collapsible open={isRecurrenceOpen} onOpenChange={setIsRecurrenceOpen} className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-2 rounded-lg",
                          localTask.isRecurring ? "bg-purple-100 text-purple-600" : "bg-slate-100 text-slate-400"
                        )}>
                          <Repeat className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-widest">Recurrence</span>
                      </div>
                      {isRecurrenceOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-4 pb-4 space-y-4 border-t border-slate-50 pt-4">
                    <div className="flex items-center justify-between px-1">
                      <Label className="text-xs font-bold text-slate-500 uppercase tracking-tighter">Active Policy</Label>
                      <input
                        type="checkbox"
                        checked={localTask.isRecurring || false}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          handleFieldChange('isRecurring', isChecked);
                          if (isChecked && !localTask.recurrencePattern) {
                            handleFieldChange('recurrencePattern', { frequency: 'weekly', interval: 1 });
                          }
                        }}
                        className="h-5 w-5 rounded-lg border-slate-300 text-blue-600 transition-all cursor-pointer"
                        disabled={true} //{!isFieldEditable('recurrencePattern') || isSaving}

                      />
                    </div>
                    {localTask.isRecurring && (
                      <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold text-slate-400 uppercase">Frequency</Label>
                          <Select
                            value={localTask.recurrencePattern?.frequency || 'weekly'}
                            onValueChange={(v) => handleFieldChange('recurrencePattern', {
                              ...localTask.recurrencePattern,
                              frequency: v as RecurrenceFrequency
                            })}
                            disabled={!isFieldEditable('recurrencePattern') || isSaving}
                          >
                            <SelectTrigger className="h-9 bg-slate-50 border-0 text-xs font-bold">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="z-[60]">
                              {recurrenceOptions.map(opt => (
                                <SelectItem key={opt} value={opt} className="capitalize text-xs">{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold text-slate-400 uppercase">Interval</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min={1}
                              value={localTask.recurrencePattern?.interval || 1}
                              onChange={(e) => handleFieldChange('recurrencePattern', {
                                ...localTask.recurrencePattern,
                                interval: parseInt(e.target.value) || 1
                              })}
                              className="h-9 w-20 bg-slate-50 border-0 text-xs font-black"
                              disabled={!isFieldEditable('recurrencePattern') || isSaving}
                            />
                            <span className="text-[10px] text-slate-400 font-black uppercase italic">Steps</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </div>

              {/* Metadata - Super Admin Only */}
              {capabilities.isSuperAdmin && (
                <div className="pt-6 border-t border-slate-100 space-y-4 hidden">
                  <div className="flex items-center gap-2 mb-2">
                    <Settings2 className="w-3.5 h-3.5 text-slate-400" />
                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Engineering Logs
                    </Label>
                  </div>
                  <div className="space-y-2">
                    {localTask.parentTaskId && (
                      <div className="flex items-center justify-between text-[10px] p-3 bg-slate-100 rounded-xl border-0">
                        <span className="text-slate-500 font-bold uppercase tracking-tighter">Origin ID</span>
                        <span className="font-mono text-slate-700 select-all font-bold">{localTask.parentTaskId}</span>
                      </div>
                    )}
                    {localTask.instanceNumber && localTask.instanceNumber > 0 && (
                      <div className="flex items-center justify-between text-[10px] p-3 bg-slate-100 rounded-xl border-0">
                        <span className="text-slate-500 font-bold uppercase tracking-tighter">Sequence</span>
                        <span className="font-mono font-bold text-slate-700">BATCH #{localTask.instanceNumber}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <DialogFooter className="p-4 sm:px-8 sm:py-5 border-t border-slate-100 bg-white rounded-b-2xl flex flex-row items-center justify-between gap-2 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
          {/* LEFT: More Actions */}
          <div className="flex items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-slate-600">
                  <MoreVertical className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 z-[60]">
                <DropdownMenuLabel className="text-xs text-slate-500">More Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-xs" onClick={() => setIsActivityCollapsed(false)}>
                  <Clock className="w-4 h-4 mr-2" /> View History
                </DropdownMenuItem>
                {capabilities.canDelete && (
                  <DropdownMenuItem className="text-xs text-rose-600 focus:text-rose-600 focus:bg-rose-50" onClick={handleDelete}>
                    <Trash2 className="w-4 h-4 mr-2" /> Delete Task
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* RIGHT: Primary Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {!isEditMode ? (
              <>
                {localTask.status !== 'completed' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 px-3 text-[10px] sm:text-xs font-bold border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                    onClick={() => handleStatusChangeImmediate('completed')}
                    disabled={isSaving}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                    <span className="hidden sm:inline">Mark Complete</span>
                    <span className="sm:hidden">Complete</span>
                  </Button>
                )}

                <Button
                  variant="default"
                  size="sm"
                  className="h-9 px-4 sm:px-6 text-[10px] sm:text-xs font-black uppercase tracking-widest border-slate-200 transition-all bg-slate-900 text-white hover:bg-black"
                  onClick={() => setIsEditMode(true)}
                  disabled={isSaving}
                >
                  <Edit3 className="w-3.5 h-3.5 sm:mr-2" /> Edit
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 px-3 sm:px-4 text-[10px] sm:text-xs font-bold text-slate-500 hover:text-slate-900"
                  disabled={isSaving}
                  onClick={() => setIsEditMode(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  size="sm"
                  className="h-9 px-4 sm:px-6 text-[10px] sm:text-xs min-w-[100px] sm:min-w-[120px] font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 transition-all"
                >
                  {isSaving ? (
                    <span className="flex items-center gap-2">
                      <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span className="hidden sm:inline">Saving</span>
                    </span>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}