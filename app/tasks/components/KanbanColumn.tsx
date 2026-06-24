import React from 'react';
import { Task, TaskStatus, Users } from '@/lib/types/task';
import { TaskCard } from './TaskCard';
import { cn } from '@/lib/utils';
import { UserProfile } from '@/types/rbac.types';




function TaskCardSkeleton({ layout = 'vertical' }: { layout?: 'horizontal' | 'vertical' }) {
  return (
    <div className={cn(
      "p-4 rounded-xl shadow-sm bg-white dark:bg-gray-800",
      layout === 'horizontal' ? "min-w-[280px]" : "w-full",
      "animate-pulse space-y-3"
    )}>
      {/* Title/Header Line */}
      <div className="flex items-center justify-between">
        <div className="h-4 w-3/4 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="h-4 w-1/6 rounded-full bg-gray-200 dark:bg-gray-700" />
      </div>

      {/* Description Lines */}
      <div className="space-y-2 pt-2">
        <div className="h-3 w-full rounded-full bg-gray-100 dark:bg-gray-700/50" />
        <div className="h-3 w-5/6 rounded-full bg-gray-100 dark:bg-gray-700/50" />
      </div>

      {/* Footer/Meta Info (Assignee & Priority) */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center space-x-2">
          <div className="h-6 w-6 rounded-full bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-16 rounded-full bg-gray-200 dark:bg-gray-700" />
        </div>
        <div className="h-4 w-1/4 rounded-full bg-gray-200 dark:bg-gray-700" />
      </div>
    </div>
  );
}

interface KanbanColumnProps {
  tasks: Task[];
  currentUserRole?: string;
  users: Users[];
  isLoading: boolean;
  currentUserId?: any;
  onTaskClick: (task: Task) => void;
  user: UserProfile;
  onUpdateStatus?: (id: string, status: TaskStatus, notes?: string) => Promise<void>;
  onUpdate?: (id: string, data: any) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  layout?: 'horizontal' | 'vertical';
}

export const KanbanColumn = React.memo(({ 
  tasks, 
  users, 
  isLoading, 
  onTaskClick, 
  user, 
  onUpdateStatus, 
  onUpdate, 
  onDelete,
  layout = 'vertical'
}: KanbanColumnProps) => {
  return (
    <div className={cn(
      "flex gap-4 custom-scrollbar pb-2",
      layout === 'horizontal' ? "flex-row overflow-x-auto snap-x snap-mandatory" : "flex-col overflow-y-auto max-h-[600px] pr-2"
    )}>
      {isLoading ? (
        <>
          <TaskCardSkeleton layout={layout} />
          <TaskCardSkeleton layout={layout} />
          <TaskCardSkeleton layout={layout} />
        </>
      ) : tasks.length === 0 ? (
        // Empty State
        <div className={cn(
          "flex flex-col items-center justify-center py-8 px-4 text-center text-gray-400 dark:text-gray-600 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-900/20",
          layout === 'horizontal' ? "min-w-[280px] flex-1" : "w-full"
        )}>
          <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 mb-3 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v8M8 12h8" /></svg>
          <p className="text-sm font-semibold">No Tasks</p>
          <p className="text-xs mt-1">Empty list</p>
        </div>
      ) : (
        tasks.map(task => (
          <div key={task.id} className={cn(layout === 'horizontal' && "snap-start")}>
            <TaskCard 
              task={task} 
              users={users}
              onClick={onTaskClick}
              user={user}
              onUpdateStatus={onUpdateStatus}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          </div>
        ))
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if tasks or loading state changed
  return (
    //prevProps.status === nextProps.status &&
    prevProps.tasks.length === nextProps.tasks.length &&
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.tasks.every((task, index) => 
      task.id === nextProps.tasks[index]?.id &&
      task.updatedAt === nextProps.tasks[index]?.updatedAt
    )
  );
});

KanbanColumn.displayName = 'KanbanColumn';