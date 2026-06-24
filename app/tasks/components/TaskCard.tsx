"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { format, isPast, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  Clock,
  Calendar,
  MoreHorizontal,
  Trash2,
  Paperclip,
  AlertTriangle,
  FileText,
  Repeat} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  AlertDialogDescription
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Task, TaskStatus, Users } from '../types/task';
import { useRBAC } from '@/hooks/useRBAC';
import { UserProfile } from '@/types/rbac.types';



const statusConfig: { [key in TaskStatus]: { icon: React.ElementType; color: string; bg: string; name: string } } = {
  in_progress: { icon: Clock, color: "text-blue-600", bg: "bg-blue-100", name: "In Progress" },
  completed: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-100", name: "Done" },
  need_help: { icon: AlertTriangle, color: "text-rose-600", bg: "bg-rose-100", name: "Help" },
};

interface TaskCardProps {
  task: Task;
  users: Users[];
  currentUserId?: string;
  onClick?: (task: Task) => void;
  user: UserProfile;
  onUpdateStatus?: (id: string, status: TaskStatus, notes?: string) => Promise<void>;
  onUpdate?: (id: string, data: any) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export const TaskCard = React.memo(({
  task,
  users,
  onClick,
  user,
  onUpdateStatus,
  onUpdate,
  onDelete
}: TaskCardProps) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const { canPerform, isSuperAdmin } = useRBAC(user);

  // --- Memoized Values ---
  const assignee = useMemo(() => {
    if (!task.assignedTo) return null;
    const found = users.find(u => u.id === task.assignedTo);
    return found || null;
  }, [users, task.assignedTo]);

  const dueDate = useMemo(
    () => task.dueDate ? new Date(task.dueDate) : null,
    [task.dueDate]
  );

  const isOverdue = useMemo(() => {
    if (!dueDate) return false;
    return isPast(dueDate) && task.status !== 'completed';
  }, [dueDate, task.status]);

  const isOwnerOrAssignee = useMemo(() => {
    return task.assignedBy === user.id || task.assignedTo === user.id || isSuperAdmin();
  }, [task.assignedBy, task.assignedTo, user.id, isSuperAdmin]);

  const canEditDetails = useMemo(() => {
    return (isOwnerOrAssignee) && task.status !== 'completed';
  }, [isOwnerOrAssignee, task.status]);

  const canChangeStatus = useMemo(() =>
    isOwnerOrAssignee,
    [isOwnerOrAssignee]
  );

  const canDeleteTask = useMemo(() => canPerform("tasks:delete"), [canPerform]);
  const canAssign = useMemo(() => canPerform("tasks:edit"), [canPerform]);

  // --- Visual Logic ---
  const extensionCount = task.dueDateExtensionCount || 0;
  const isCritical = extensionCount >= 2;
  const isWarning = extensionCount === 1;

  const cardStyles = isCritical
    ? 'border-l-rose-500 bg-rose-50/40 hover:bg-rose-50/60'
    : isWarning
      ? 'border-l-amber-500 bg-amber-50/40 hover:bg-amber-50/60'
      : 'border-l-emerald-500 bg-white hover:bg-slate-50/50';


  // --- Event Handlers with Loading States ---
  const handleStatusChange = useCallback(async (newStatus: TaskStatus) => {
    if (newStatus === task.status || isUpdating) return;

    setIsUpdating(true);
    try {
      await onUpdateStatus?.(task.id, newStatus);
    } catch (error) {
      console.error("Status update failed:", error);
    } finally {
      setIsUpdating(false);
    }
  }, [task.id, task.status, onUpdateStatus, isUpdating]);

  const handleAssignChange = useCallback(async (newAssigneeId: string) => {
    if (isUpdating || newAssigneeId === task.assignedTo) return;

    setIsUpdating(true);
    try {
      await onUpdate?.(task.id, { assignedTo: newAssigneeId });
    } catch (error) {
      console.error("Assignment update failed:", error);
    } finally {
      setIsUpdating(false);
    }
  }, [task.id, task.assignedTo, onUpdate, isUpdating]);

  const handleDueDateChange = useCallback(async (newDate: Date) => {
    if (isUpdating) return;

    setIsUpdating(true);
    try {
      await onUpdate?.(task.id, { dueDate: endOfDay(newDate).toISOString() });
    } catch (error) {
      console.error("Due date update failed:", error);
    } finally {
      setIsUpdating(false);
    }
  }, [task.id, onUpdate, isUpdating]);

  const handleDelete = useCallback(async () => {
    if (isUpdating) return;

    setIsUpdating(true);
    try {
      await onDelete?.(task.id);
    } catch (error) {
      console.error("Delete failed:", error);
      setIsUpdating(false);
    }
    // Don't set isUpdating to false on success as component will unmount
  }, [task.id, onDelete, isUpdating]);

  const handleCardClick = useCallback((e: React.MouseEvent) => {
    // Prevent click when interacting with controls or updating
    if (isUpdating) return;

    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('[role="menuitem"]') ||
      target.closest('[data-radix-collection-item]') ||
      target.closest('[data-radix-popper-content-wrapper]')
    ) {
      return;
    }
    onClick?.(task);
  }, [onClick, task, isUpdating]);

  return (

    <>
{/* SECTION 1: DYNAMIC HEADER */}
<div
  onClick={handleCardClick}
  className={cn(
    "group relative flex flex-col rounded-xl transition-all duration-300 cursor-pointer overflow-hidden min-w-[280px]",
    // BORDER & BACKGROUND: Added border to prevent blending
    "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700",
    "shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600",
    // Logic for completed/updating states
    task.status === 'completed' && "opacity-60 grayscale-[0.2]",
    isUpdating && "pointer-events-none opacity-75"
  )}
>
  {/* Loading Overlay */}
  {isUpdating && (
    <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] rounded-xl flex items-center justify-center z-20">
      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-900"></div>
    </div>
  )}

  {/* =====================================================================================
      SECTION 1: DYNAMIC HEADER (Mesh Gradient + Title + Actions)
  ===================================================================================== */}
  <div className="relative px-4 py-3 flex items-center justify-between gap-3 overflow-hidden border-b border-slate-50 dark:border-slate-800">
    
    {/* 1. Background Mesh Gradient (Visuals) */}
    <div 
      className={cn(
        "absolute inset-0 opacity-[0.08] dark:opacity-[0.15] transition-all duration-700 pointer-events-none",
        cardStyles.includes('blue') ? 'bg-blue-500' : 
        cardStyles.includes('rose') ? 'bg-rose-500' : 
        cardStyles.includes('emerald') ? 'bg-emerald-500' : 
        cardStyles.includes('amber') ? 'bg-amber-500' : 'bg-slate-500'
      )}
    />
    
    {/* 2. Extension Heat Glow (Visuals) */}
    {(isWarning || isCritical) && (
      <div 
        className={cn(
          "absolute -top-10 -right-10 w-32 h-32 blur-3xl transition-all duration-500 opacity-90 pointer-events-none",
          isCritical ? "bg-rose-500" : "bg-amber-400"
        )}
      />
    )}

    {/* 3. Title & Status Dot (Content) */}
    <div className="relative z-10 flex items-center gap-3 flex-1 min-w-0">
      
      {/* Smart Status Dot */}
      <div className="relative flex-shrink-0">
          <div className={cn(
            "w-2 h-2 rounded-full",
            statusConfig[task.status].bg.replace('bg-', 'bg-'), // Use solid color
            isCritical && "animate-pulse ring-2 ring-rose-500/30"
          )} />
      </div>

      {/* Task Title */}
      <h3 className={cn(
        "text-sm font-bold truncate tracking-tight",
        task.status === 'completed' ? "text-slate-400 line-through" : "text-slate-800 dark:text-slate-100"
      )}>
        {task.title || "Untitled Task"}
      </h3>
    </div>

    {/* 4. Action Menu (Functional) */}
    <div className="relative z-10">
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <button 
            disabled={isUpdating}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg outline-none"
          >
            <MoreHorizontal className="w-4 h-4 text-slate-500" />
          </button>
        </DropdownMenuTrigger>
        
        {/* Functional Dropdown Content from Old Code */}
        <DropdownMenuContent align="end" className="w-48 z-50">
          <DropdownMenuLabel className="text-xs text-slate-500">Task Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {task.isRecurring && (
            <>
              <div className="px-2 py-1.5 text-xs flex items-center gap-2 text-purple-600 bg-purple-50 mx-1 rounded">
                <Repeat className="w-3.5 h-3.5" />
                <span>Recurring Task</span>
              </div>
              <DropdownMenuSeparator />
            </>
          )}

          <DropdownMenuItem className="text-xs" onClick={() => onClick?.(task)}>
            <FileText className="w-3.5 h-3.5 mr-2" /> View Details
          </DropdownMenuItem>

          {canDeleteTask && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  className="text-red-600 text-xs focus:text-red-600 focus:bg-red-50"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Task
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent className="z-50">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Task?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete &quot;{task.title}&quot;?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className='bg-red-600 hover:bg-red-700'>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>

  {/* =====================================================================================
      SECTION 2: FOOTER (Assignee, Date, Status Switcher)
  ===================================================================================== */}
  <div className="px-4 pb-4 pt-3 flex items-center justify-between">
    <div className="flex items-center gap-5">
      
      {/* 1. ASSIGNEE POPOVER (Functional + New Style) */}
      <Popover>
        <PopoverTrigger asChild disabled={!canAssign || isUpdating}>
          <button
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "flex items-center gap-3 transition-transform active:scale-95 group/assign",
              (!canAssign || isUpdating) && "cursor-default opacity-80"
            )}
          >
            <div className="relative">
              <Avatar className="w-8 h-8 ring-2 ring-offset-2 ring-transparent group-hover/assign:ring-slate-100 transition-all border border-slate-100">
                <AvatarFallback className="text-xs bg-slate-900 text-white font-bold">
                  {assignee?.name?.[0]?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              {/* Critical Warning Indicator on Avatar */}
              {isCritical && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 border-2 border-white rounded-full animate-pulse" />
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px]">Overdue & Extended</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            
            <div className="flex flex-col items-start leading-none">
              <span className="text-[14px] font-extrabold text-slate-800 dark:text-slate-100 truncate max-w-[100px]">
                {assignee?.name || 'Unassigned'}
              </span>
              <span className="text-[10px] text-slate-400 font-medium uppercase mt-0.5 tracking-wider">
                 Assignee
              </span>
            </div>
          </button>
        </PopoverTrigger>
        
        {/* User List Content */}
        <PopoverContent className="w-52 p-1 z-50" align="start" onClick={(e) => e.stopPropagation()}>
          <ScrollArea className="h-40">
            {users && users.length > 0 ? (
              users.map(u => (
                <button
                  key={u.id}
                  onClick={(e) => { e.stopPropagation(); handleAssignChange(u.id); }}
                  disabled={isUpdating}
                  className={cn(
                    "w-full flex items-center gap-2 p-2 hover:bg-slate-50 rounded text-xs text-left transition-colors",
                    task.assignedTo === u.id && "bg-blue-50",
                    isUpdating && "opacity-50"
                  )}
                >
                  <Avatar className="w-5 h-5"><AvatarFallback>{u.name?.[0]}</AvatarFallback></Avatar>
                  <span>{u.name}</span>
                </button>
              ))
            ) : <div className="p-2 text-xs">No users</div>}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      <div className="h-5 w-px bg-slate-100 dark:bg-slate-800" />

      {/* 2. DATE POPOVER (Functional + New Style) */}
      <Popover>
        <PopoverTrigger asChild disabled={!canEditDetails || isUpdating}>
          <button
            onClick={(e) => e.stopPropagation()}
            disabled={!canEditDetails || isUpdating}
            className={cn(
              "flex items-center gap-2 text-xs font-bold transition-opacity hover:opacity-70",
              isOverdue ? "text-rose-500" : "text-slate-500",
              (!canEditDetails || isUpdating) && "cursor-default"
            )}
          >
            <Calendar className="w-4 h-4" />
            <span>{dueDate ? format(dueDate, 'MMM d') : 'No date'}</span>
            
            {/* Extension Count Badge */}
            {(isWarning || isCritical) && (
              <span className={cn(
                "px-1.5 py-0.5 rounded-md text-[10px] font-black ml-1",
                isCritical ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"
              )}>
                {extensionCount}x
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 z-50" align="start" onClick={(e) => e.stopPropagation()}>
           <CalendarComponent
              mode="single"
              selected={dueDate || undefined}
              initialFocus
              onSelect={(d) => { if (d && !isUpdating) handleDueDateChange(d); }}
              disabled={isUpdating}
            />
        </PopoverContent>
      </Popover>
    </div>

    {/* 3. STATUS SWITCHER + ATTACHMENTS (Right Side) */}
    <div className="flex items-center gap-2">
      
      {/* Attachment Indicator (Restored Functionality) */}
      {task.attachments && task.attachments.length > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-0.5 text-slate-400">
                <Paperclip className="w-3 h-3" />
                <span className="text-[10px] font-bold">{task.attachments.length}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="text-xs">{task.attachments.length} attachments</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Status Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={!canChangeStatus || isUpdating}>
          <button
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "text-[10px] font-black uppercase tracking-[0.1em] px-3 py-1 rounded-full transition-all border border-transparent hover:border-slate-100",
              statusConfig[task.status].bg,
              statusConfig[task.status].color,
              "bg-opacity-10", // Minimalist tint
              (!canChangeStatus || isUpdating) && "cursor-default opacity-50"
            )}
          >
            {statusConfig[task.status].name}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="z-50">
          {Object.entries(statusConfig).map(([sKey, config]) => (
            <DropdownMenuItem
              key={sKey}
              onSelect={() => !isUpdating && handleStatusChange(sKey as TaskStatus)}
              disabled={isUpdating || sKey === task.status}
              className={cn("text-xs font-medium", sKey === task.status && "bg-slate-100")}
            >
              <span className={cn("w-2 h-2 rounded-full mr-2", config.color.replace('text-', 'bg-'))} />
              {config.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>
</div>

    </>
  );
}, (prevProps, nextProps) => {
  // Optimized comparison - only re-render if these specific fields changed
  return (
    prevProps.task.id === nextProps.task.id &&
    prevProps.task.updatedAt === nextProps.task.updatedAt &&
    prevProps.task.status === nextProps.task.status &&
    prevProps.task.assignedTo === nextProps.task.assignedTo &&
    prevProps.task.dueDate === nextProps.task.dueDate &&
    prevProps.task.notes === nextProps.task.notes &&
    prevProps.task.title === nextProps.task.title &&
    prevProps.users.length === nextProps.users.length
  );
});

TaskCard.displayName = 'TaskCard';