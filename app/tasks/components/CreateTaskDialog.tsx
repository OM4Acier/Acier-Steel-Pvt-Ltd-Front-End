// app/tasks/components/CreateTaskDialog.tsx
"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreateTaskInput, RecurrenceFrequency } from '../types/task';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as BasicCalendar } from '@/components/ui/basic-calendar';
import { Repeat, Calendar as CalendarIcon2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { UserProfile, UserRole } from '@/types/rbac.types';
import { AuthUtils } from '@/lib/authHelpers';

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateTask: (task: CreateTaskInput) => void;
  users: { id: string; name: string; avatar: string; }[];
  user: UserProfile;
}

const recurrenceOptions: RecurrenceFrequency[] = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];

export function CreateTaskDialog({ open, onOpenChange, onCreateTask, users, user }: CreateTaskDialogProps) {

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<Date | undefined>(tomorrow);

  // Recurrence State
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency>('weekly');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceDayOfMonth, setRecurrenceDayOfMonth] = useState<number | undefined>(undefined);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | undefined>(undefined);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !assignedTo) {
      alert("Please provide a title and assign the task.");
      return;
    }

    onCreateTask({
      title,
      description,
      assignedTo,
      status: 'in_progress', // Default status
      priority: 'medium',    // Default priority
      dueDate: dueDate ? dueDate.toISOString() : undefined,
      /* isRecurring,
       recurrencePattern: isRecurring ? {
          frequency: recurrenceFrequency,
          interval: recurrenceInterval,
          endAfterOccurrences: recurrenceEndDate?.toISOString(),
          dayOfMonth: (recurrenceFrequency === 'monthly' || recurrenceFrequency === 'quarterly') ? recurrenceDayOfMonth : undefined
        } : undefined,*/
    });

    // Reset form and close dialog
    setTitle('');
    setDescription('');
    setAssignedTo(null);
    setDueDate(undefined);
    setIsRecurring(false);
    setRecurrenceFrequency('weekly');
    setRecurrenceInterval(1);
    setRecurrenceDayOfMonth(undefined);
    setRecurrenceEndDate(undefined);
    onOpenChange(false);
  };


  const accessConfig = {
    roles: ['accountant', 'super-admin'] as UserRole[]
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-white dark:bg-slate-900 rounded-xl shadow-2xl z-50">
        <form onSubmit={handleSubmit} className="flex flex-col h-full">

          {/* Header */}
          <DialogHeader className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <DialogTitle className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              Create New Task
            </DialogTitle>
          </DialogHeader>

          <div className="p-6 space-y-6">

            {/* Title Input */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs to be done?"
                className="text-lg font-medium border-slate-200 focus:border-blue-500 focus:ring-blue-100 transition-all h-12"
                autoFocus
              />
            </div>

            {/* Description Input */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add details..."
                className="min-h-[100px] resize-none bg-slate-50/50 border-slate-200 focus:bg-white transition-all"
              />
            </div>

            {/* Assignment & Date Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Assignee</Label>
                <Select onValueChange={setAssignedTo} value={assignedTo || undefined}>
                  <SelectTrigger className="h-10 border-slate-200">
                    <SelectValue placeholder="Select User" />
                  </SelectTrigger>
                  <SelectContent className="z-[60]">
                    {users.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                            {user.name[0]}
                          </div>
                          {user.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Due Date
                </Label>
                <Input
                  type="date"
                  className="w-full h-10 border-slate-200 focus:ring-slate-400"
                  value={dueDate ? format(dueDate, "yyyy-MM-dd") : ""}
                  onChange={(e) => setDueDate(e.target.value ? new Date(e.target.value) : undefined)}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>
            </div>

            {/* Recurrence Toggle & Options */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2 cursor-pointer" htmlFor="isRecurring">
                  <Repeat className="w-4 h-4 text-slate-400" /> Recurring Task
                </Label>

                <input
                  type="checkbox"
                  id="isRecurring"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className={`h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500`}
                  disabled={!AuthUtils.canAccess(user, accessConfig)}
                />

              </div>

              {isRecurring && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg animate-in slide-in-from-top-2 duration-200">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Frequency</Label>
                    <Select value={recurrenceFrequency} onValueChange={(v) => setRecurrenceFrequency(v as RecurrenceFrequency)}>
                      <SelectTrigger className="h-9 bg-white border-slate-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[60]">
                        {recurrenceOptions.map(opt => (
                          <SelectItem key={opt} value={opt} className="capitalize">{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Interval</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">Every</span>
                      <Input
                        type="number"
                        min={1}
                        value={recurrenceInterval}
                        onChange={(e) => setRecurrenceInterval(parseInt(e.target.value) || 1)}
                        className="h-9 bg-white border-slate-200"
                      />
                      <span className="text-xs text-slate-400 capitalize">{recurrenceFrequency.replace(/ly$/, '')}(s)</span>
                    </div>
                  </div>

                  {(recurrenceFrequency === 'monthly' || recurrenceFrequency === 'quarterly') && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-500">Day of Month</Label>
                      <Input
                        type="number"
                        min={1}
                        max={31}
                        value={recurrenceDayOfMonth || ''}
                        onChange={(e) => setRecurrenceDayOfMonth(parseInt(e.target.value) || undefined)}
                        className="h-9 bg-white border-slate-200"
                        placeholder="Day (1-31)"
                      />
                    </div>
                  )}

                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-xs text-slate-500">End Date (Optional)</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full justify-start text-left font-normal h-9 bg-white border-slate-200",
                            !recurrenceEndDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon2 className="mr-2 h-3.5 w-3.5 text-slate-400" />
                          {recurrenceEndDate ? format(recurrenceEndDate, "PPP") : <span>No end date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-[60]">
                        <BasicCalendar
                          mode="single"
                          selected={recurrenceEndDate}
                          onSelect={setRecurrenceEndDate}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}
            </div>

          </div>

          <DialogFooter className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!title || !assignedTo} className="bg-blue-600 hover:bg-blue-700 text-white">Create Task</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}