// app/tasks/components/ActivityLog.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { History, Clock3, Loader2 } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { tasksApi } from '@/lib/api/endpoints/tasksApi';
const taskApi = tasksApi;
import { EditHistoryEntry, Task } from '../types/task';

interface ActivityLogProps {
  task: Task;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ActivityLog({ task, isOpen, onOpenChange }: ActivityLogProps) {
  const [history, setHistory] = useState<EditHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      taskApi.getTaskHistory(task.id)
        .then(data => {
          setHistory(data.history || []);
        })
        .catch(err => console.error("Failed to fetch history", err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, task.id]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] z-[70]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-blue-500" /> Activity Log
          </DialogTitle>
        </DialogHeader>
        <div className="py-2 text-xs text-slate-500 border-b pb-4">
          Task created on {format(new Date(task.createdAt), 'MMM d, yyyy')}.
        </div>
        <ScrollArea className="h-[350px] pr-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-xs">Loading history...</span>
            </div>
          ) : (
            <div className="relative pl-4 pt-2">
              <div className="absolute left-0 top-0 bottom-0 w-px bg-slate-200" />
              {history.length > 0 ? (
                history
                  .sort((a, b) => b.timestamp - a.timestamp)
                  .map((item, index) => (
                    <div key={index} className="relative mb-6">
                      <div className="absolute -left-2 top-1.5 w-4 h-4 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center">
                        <Clock3 className="w-2.5 h-2.5 text-slate-400" />
                      </div>
                      <div className="pl-4">
                        <p className="font-medium text-slate-800 text-sm">{item.description}</p>
                        <div className="text-xs text-slate-500 mt-0.5 flex items-center justify-between">
                          <span>{item.editorName}</span>
                          <span className="text-slate-400">{formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}</span>
                        </div>
                      </div>
                    </div>
                  ))
              ) : (
                <div className="text-center text-sm text-slate-400 py-4">No recent activity</div>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Reusable Activity List (for embedding inside other containers like Dialogs)
 */
export function ActivityList({ taskId }: { taskId: string }) {
    const [history, setHistory] = useState<EditHistoryEntry[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setLoading(true);
        taskApi.getTaskHistory(taskId)
            .then(data => setHistory(data.history || []))
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, [taskId]);

    if (loading) return <div className="text-sm text-slate-400 p-2">Loading...</div>;
    if (history.length === 0) return <p className="text-sm text-slate-400 italic p-2">No activity yet.</p>;

    return (
        <div className="space-y-4 pl-2 border-l-2 border-slate-100 ml-2">
            {history
                .sort((a, b) => b.timestamp - a.timestamp)
                .map((entry, index) => (
                <div key={index} className="relative pl-6 pb-2">
                    <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-slate-200 ring-4 ring-white" />
                    <p className="text-sm text-slate-600">
                        <span className="font-semibold text-slate-900">{entry.editorName}</span> {entry.description}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}</p>
                </div>
            ))}
        </div>
    );
}
