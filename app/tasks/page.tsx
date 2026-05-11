// app/tasks/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';

import { Task, TaskStatus, Users, TaskPriority, TaskView, GetTasksParams } from '@/lib/types/task';
import { KanbanColumn } from './components/KanbanColumn';
import { toast } from 'sonner';
import { CreateTaskDialog } from './components/CreateTaskDialog';
import { TaskDetailDialog } from './components/TaskDetailDialog';
import { taskApi } from '@/lib/api/taskApi';

import { useRBAC } from '@/hooks/useRBAC';
import UniversalNavBar, { createSimplePageConfig, useNavbarState } from '@/components/NavBar';
import { usePathname, useRouter } from 'next/navigation';
import { Filter, SortAsc, User, Calendar as CalendarIcon } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import Loading from '@/components/ui/loadingscreen';
import { auth } from '@/lib/auth';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserProfile, UserRole } from '@/types/rbac.types';
import { AuthUtils } from '@/lib/authHelpers';
import { checkCloudAuth } from '@/lib/auth/checkCloudAuth';
//import router from 'next/router';import { useProtectedRoute } from '@/hooks/useProtectedRoute';import { useKeyboardShortcuts } from './hooks/use-keyboard-shortcuts';
import { useLoading } from '@/context/LoadingContext';


// 1. Update the Type to include colorClass
type KanbanColumnConfig = {
    id: TaskStatus;
    title: string;
    colorClass: string;
};

// 2. Define the constants with specific Tailwind colors
const KANBAN_COLUMNS: KanbanColumnConfig[] = [
    {
        id: 'in_progress',
        title: 'In Progress',
        colorClass: 'bg-blue-500 dark:bg-blue-600'
    },
    {
        id: 'need_help',
        title: 'Need Help',
        colorClass: 'bg-red-500 dark:bg-red-600'
    },
    {
        id: 'completed',
        title: 'Done',
        colorClass: 'bg-emerald-500 dark:bg-emerald-600'
    },
];

interface Filters {
    searchTerm: string;
    status: TaskStatus | 'all';
    priority: TaskPriority | 'all';
    view: TaskView;
    assignedTo: string | 'all';
    sortBy: 'dueDate' | 'createdAt' | 'priority';
    sortOrder: 'asc' | 'desc';
}

export interface TaskCapabilities {
    canEditFull: boolean;
    canEditPartial: boolean;
    canDelete: boolean;
    isSuperAdmin: boolean;
}

// Central Registry for both Tasks and Users
interface DataRegistry {
    tasks: Map<string, Task>;
    users: Map<string, Users>;
    lastSync: number;
}



export default function TasksPage() {
    const router = useRouter();
    const { showLoader, hideLoader } = useLoading(); // Use the loading context


    const [user, setUser] = useState<UserProfile | null>(null);
    const pathname = usePathname();

    //const { user } = useProtectedRoute({
    //     allowedRoles: ['super-admin', 'sales', 'operations', 'accountant'],
    // });


    const rbacUser = user;
    const { canPerform, isSuperAdmin: checkAdmin } = useRBAC(rbacUser);



    // Central Data Registry
    const dataRegistry = useRef<DataRegistry>({
        tasks: new Map(),
        users: new Map(),
        lastSync: 0
    });

    // State Management
    const [tasks, setTasks] = useState<Task[]>([]);
    const [employees, setEmployees] = useState<Users[]>([]);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Track ongoing operations
    const operationsInProgress = useRef(new Set<string>());

    const [filters, setFilters] = useState<Filters>({
        searchTerm: '',
        status: 'all',
        priority: 'all',
        view: TaskView.ALL,
        assignedTo: 'all',
        sortBy: 'dueDate',
        sortOrder: 'asc',
    });

    const {
        searchTerm,
        setSearchTerm,
        isMenuOpen,
        setIsMenuOpen
    } = useNavbarState();

    // ============================================
    // CENTRAL REGISTRY FUNCTIONS
    // ============================================

    const updateRegistry = useCallback((newTasks: Task[], newUsers?: Users[]) => {
        // Update tasks in registry
        newTasks.forEach(task => {
            dataRegistry.current.tasks.set(task.id, task);
        });

        // Update users in registry
        if (newUsers) {
            newUsers.forEach(user => {
                dataRegistry.current.users.set(user.id, user);
            });
        }

        dataRegistry.current.lastSync = Date.now();
    }, []);

    const getTaskFromRegistry = useCallback((taskId: string): Task | null => {
        return dataRegistry.current.tasks.get(taskId) || null;
    }, []);

    const getUserFromRegistry = useCallback((userId: string): Users | null => {
        return dataRegistry.current.users.get(userId) || null;
    }, []);

    // const getAllUsersFromRegistry = useCallback((): Users[] => {
    //     return Array.from(dataRegistry.current.users.values());
    // }, []);

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================

    const showSuccess = useCallback((message: string, details?: string) => {
        toast.success(message, { description: details, duration: 3000 });
    }, []);

    const showError = useCallback((message: string, details?: string) => {
        toast.error(message, { description: details, duration: 5000 });
    }, []);

    const showServerMessage = useCallback((response: any, defaultMsg: string) => {
        const message = response?.message || defaultMsg;
        showSuccess(message);
    }, [showSuccess]);

    // ============================================
    // SORTING & FILTERING LOGIC
    // ============================================

    const sortTasks = useCallback((tasksToSort: Task[]): Task[] => {
        const sorted = [...tasksToSort].sort((a, b) => {
            let comparison = 0;

            switch (filters.sortBy) {
                case 'dueDate':
                    const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
                    const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
                    comparison = aDate - bDate;
                    break;
                case 'createdAt':
                    comparison = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                    break;
                case 'priority':
                    const priorityOrder = { high: 3, medium: 2, low: 1 };
                    comparison = priorityOrder[b.priority] - priorityOrder[a.priority];
                    break;
            }

            return filters.sortOrder === 'asc' ? comparison : -comparison;
        });

        return sorted;
    }, [filters.sortBy, filters.sortOrder]);

    const filterTasks = useCallback((tasksToFilter: Task[]): Task[] => {
        return tasksToFilter.filter(task => {
            if (filters.assignedTo !== 'all' && task.assignedTo !== filters.assignedTo) {
                return false;
            }
            return true;
        });
    }, [filters.assignedTo]);

    // ============================================
    // DATA FETCHING
    // ============================================

    const fetchEmployees = useCallback(async () => {
        try {
            const response = await taskApi.getEmployees();
            const users = response.employees ?? [];
            setEmployees(users);
            updateRegistry([], users);
        } catch (error) {
            console.error('Error fetching employees:', error);
            showError('Failed to load employees');
            setEmployees([]);
        }
    }, [showError, updateRegistry]);

    const fetchTasks = useCallback(async (
        params: GetTasksParams = {}, // Use the interface we defined earlier
        silent = false
    ) => {
        // We check the current tasks state to determine if it's the first load
        // without putting the full tasks array in the dependency array.
        const isInitialLoad = !silent && tasks.length === 0;

        if (isInitialLoad) {
            setLoading(true);
        }
        setError(null);

        try {
            // taskApi.getTasks now handles the "cleaning" of null/undefined internally
            const response = await taskApi.getTasks(params);
            const freshTasks = response.tasks || [];

            setTasks(freshTasks);
            updateRegistry(freshTasks);

            if (!silent && !isInitialLoad) {
                console.log(`%c✓ Tasks synced: ${freshTasks.length} items`, 'color: #4CAF50; font-weight: bold');
            }
        } catch (err: any) {
            const errorMsg = err?.error || 'Failed to fetch tasks';
            setError(errorMsg);

            if (!silent) {
                showError(errorMsg, err?.details);
            }
        } finally {
            if (isInitialLoad) {
                setLoading(false);
            }
        }
        // REMOVED tasks.length from dependencies to prevent function recreation loops
    }, [showError, updateRegistry]);


    const syncTaskFromServer = useCallback(async (taskId: string) => {
        try {
            const { task } = await taskApi.getTaskById(taskId);

            // Update registry
            dataRegistry.current.tasks.set(taskId, task);

            // Update in main list
            setTasks(prev => {
                const exists = prev.some(t => t.id === taskId);
                if (exists) {
                    return prev.map(t => t.id === taskId ? task : t);
                } else {
                    return [task, ...prev];
                }
            });

            // Update selected task if it's the same
            setSelectedTask(current =>
                current?.id === taskId ? task : current
            );

            return task;
        } catch (err: any) {
            console.error('Failed to sync task:', err);
            return null;
        }
    }, []);

    // ============================================
    // TASK OPERATIONS
    // ============================================

    const createTask = useCallback(async (taskData: any) => {
        const operationId = `create-${Date.now()}`;
        operationsInProgress.current.add(operationId);

        try {
            const response = await taskApi.createTask(taskData);
            const newTask = response.task;

            // Update registry and state
            dataRegistry.current.tasks.set(newTask.id, newTask);
            setTasks(prev => [newTask, ...prev]);

            showServerMessage(response, 'Task created successfully');
            setIsCreateModalOpen(false);

            // Background sync
            setTimeout(() => {
                fetchTasks({
                    search: filters.searchTerm || undefined,
                    status: filters.status === 'all' ? undefined : filters.status,
                    priority: filters.priority === 'all' ? undefined : filters.priority,
                    view: filters.view,
                }, true);
            }, 1000);

            return newTask;
        } catch (err: any) {
            showError('Failed to create task', err?.error || err?.message);
            throw err;
        } finally {
            operationsInProgress.current.delete(operationId);
        }
    }, [showServerMessage, showError, fetchTasks, filters]);

    const updateTask = useCallback(async (id: string, data: any) => {
        const operationId = `update-${id}-${Date.now()}`;

        if (operationsInProgress.current.has(`update-${id}`)) {
            console.log('Update already in progress for task:', id);
            return;
        }

        operationsInProgress.current.add(operationId);

        const originalTask = getTaskFromRegistry(id);

        // Optimistic update
        const optimisticTask = originalTask ? { ...originalTask, ...data, updatedAt: new Date().toISOString() } : null;

        if (optimisticTask) {
            dataRegistry.current.tasks.set(id, optimisticTask);
            setTasks(prev => prev.map(t => t.id === id ? optimisticTask : t));

            if (selectedTask?.id === id) {
                setSelectedTask(optimisticTask);
            }
        }

        try {
            const response = await taskApi.updateTask(id, data);
            const updatedTask = response.task;

            // Update registry and state with server data
            dataRegistry.current.tasks.set(id, updatedTask);
            setTasks(prev => prev.map(t => t.id === id ? updatedTask : t));

            if (selectedTask?.id === id) {
                setSelectedTask(updatedTask);
            }

            showServerMessage(response, 'Task updated successfully');

            // Sync from server
            setTimeout(() => syncTaskFromServer(id), 500);

        } catch (err: any) {
            // Rollback
            if (originalTask) {
                dataRegistry.current.tasks.set(id, originalTask);
                setTasks(prev => prev.map(t => t.id === id ? originalTask : t));
                if (selectedTask?.id === id) {
                    setSelectedTask(originalTask);
                }
            }
            showError('Failed to update task', err?.error || err?.message);
            throw err;
        } finally {
            operationsInProgress.current.delete(operationId);
        }
    }, [selectedTask, showServerMessage, showError, syncTaskFromServer, getTaskFromRegistry]);

    const updateTaskStatus = useCallback(async (id: string, status: TaskStatus, notes?: string) => {
        const operationId = `status-${id}-${Date.now()}`;

        if (operationsInProgress.current.has(`status-${id}`)) {
            console.log('Status update already in progress for task:', id);
            return;
        }

        operationsInProgress.current.add(operationId);

        const originalTask = getTaskFromRegistry(id);

        // Optimistic update
        const optimisticUpdate = {
            status,
            updatedAt: new Date().toISOString(),
            ...(status === 'completed' && { completedAt: new Date().toISOString() }),
            ...(notes && { notes })
        };

        const optimisticTask = originalTask ? { ...originalTask, ...optimisticUpdate } : null;

        if (optimisticTask) {
            dataRegistry.current.tasks.set(id, optimisticTask);
            setTasks(prev => prev.map(t => t.id === id ? optimisticTask : t));

            if (selectedTask?.id === id) {
                setSelectedTask(optimisticTask);
            }
        }

        try {
            const response = await taskApi.updateTaskStatus(id, status, notes);
            const updatedTask = response.task;

            // Update with server response
            dataRegistry.current.tasks.set(id, updatedTask);
            setTasks(prev => prev.map(t => t.id === id ? updatedTask : t));

            if (selectedTask?.id === id) {
                setSelectedTask(updatedTask);
            }

            const statusName = status.replace('_', ' ');
            showServerMessage(response, `Task moved to ${statusName}`);

            // Sync from server
            setTimeout(() => syncTaskFromServer(id), 500);

        } catch (err: any) {
            // Rollback
            if (originalTask) {
                dataRegistry.current.tasks.set(id, originalTask);
                setTasks(prev => prev.map(t => t.id === id ? originalTask : t));
                if (selectedTask?.id === id) {
                    setSelectedTask(originalTask);
                }
            }
            showError('Failed to update status', err?.error || err?.message);
            throw err;
        } finally {
            operationsInProgress.current.delete(operationId);
        }
    }, [selectedTask, showServerMessage, showError, syncTaskFromServer, getTaskFromRegistry]);

    const deleteTask = useCallback(async (id: string) => {
        const operationId = `delete-${id}`;
        operationsInProgress.current.add(operationId);

        const taskToDelete = getTaskFromRegistry(id);

        // Optimistic removal
        dataRegistry.current.tasks.delete(id);
        setTasks(prev => prev.filter(t => t.id !== id));
        if (selectedTask?.id === id) {
            setSelectedTask(null);
        }

        try {
            const response = await taskApi.deleteTask(id);
            showServerMessage(response, `Task "${taskToDelete?.title}" deleted`);
        } catch (err: any) {
            // Rollback
            if (taskToDelete) {
                dataRegistry.current.tasks.set(id, taskToDelete);
                setTasks(prev => [...prev, taskToDelete]);
            }
            showError('Failed to delete task', err?.error || err?.message);
            throw err;
        } finally {
            operationsInProgress.current.delete(operationId);
        }
    }, [selectedTask, showServerMessage, showError, getTaskFromRegistry]);

    // ============================================
    // UI HELPERS
    // ============================================

    const getTaskCapabilities = useCallback((task: Task): TaskCapabilities => {
        const isAdmin = checkAdmin();
        const isOwner = task.assignedBy === rbacUser?.id;
        const isAssignee = task.assignedTo === rbacUser?.id;

        return {
            canEditFull: isAdmin || isOwner,
            canEditPartial: isAdmin || isOwner || isAssignee,
            canDelete: isAdmin || (isOwner && canPerform('delete')),
            isSuperAdmin: isAdmin
        };
    }, [rbacUser, checkAdmin, canPerform]);

    const handleTaskClick = useCallback((task: Task) => {
        // Always get latest from registry
        const latestTask = getTaskFromRegistry(task.id) || task;
        setSelectedTask(latestTask);
    }, [getTaskFromRegistry]);

    const handleRefresh = useCallback(async () => {
        showSuccess('Refreshing...', 'Fetching latest data');
        await Promise.all([
            fetchTasks({
                search: filters.searchTerm || undefined,
                status: filters.status === 'all' ? undefined : filters.status,
                priority: filters.priority === 'all' ? undefined : filters.priority,
                view: filters.view,
            }),
            fetchEmployees()
        ]);
    }, [fetchTasks, fetchEmployees, filters, showSuccess]);



    // ============================================
    // COMPUTED VALUES
    // ============================================

    const processedTasks = useMemo(() => {
        let result = [...tasks];
        result = filterTasks(result);
        result = sortTasks(result);
        return result;
    }, [tasks, filterTasks, sortTasks]);

    const tasksByStatus = useMemo(() => {
        const grouped: Record<TaskStatus, Task[]> = {
            in_progress: [],
            completed: [],
            need_help: [],
        };

        processedTasks.forEach(task => {
            if (grouped[task.status]) {
                grouped[task.status].push(task);
            }
        });

        return grouped;
    }, [processedTasks]);

    // ============================================
    // EFFECTS
    // ============================================
    // 1. All Hooks must stay at the top level
    useEffect(() => {
        const validateSession = async () => {
            showLoader({
                title: "Loading Dashboard",
                subtitle: "Authenticating...",
                showProgress: false,
                blurEffect: true,
            });
            try {
                const user = await checkCloudAuth();
                const fullUser: UserProfile = {
                    ...user,
                    accessToken: localStorage.getItem('accessToken') || '',
                };
                setUser(fullUser);

                const allowedRoles = ['super-admin', 'sales', 'operations', 'accountant', 'purchase-entry'];
                if (!allowedRoles.includes(user.role)) {
                    toast.error('Access denied.');
                    router.replace('/');
                    hideLoader();
                    return;
                }
                hideLoader();
            } catch (err: any) {

                const local = auth.getToken();
                const token = auth.getCachedUser();

                if (!local || !token) {
                    toast.error('Please login first');
                    hideLoader();
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

                    const allowedRoles = ['super-admin', 'sales', 'operations', 'accountant'];
                    if (!allowedRoles.includes(parsedUser.role as string)) {
                        toast.error('Access denied. Your role does not permit access to this dashboard.');
                        router.replace('/');
                        hideLoader();
                        return;
                    }

                    hideLoader();
                } catch (parseError) {
                    console.error("Error parsing user profile from localStorage:", parseError);
                    toast.error("Failed to load user profile. Please log in again.");
                    localStorage.clear();
                    hideLoader();
                    router.replace('/login?returnTo=' + encodeURIComponent(pathname));
                }
                // ... (Your fallback logic remains the same)
                toast.error(err.message);
                hideLoader();
            }
        };
        validateSession();
    }, [router, pathname, showLoader, hideLoader]);

    useEffect(() => {
        // Only fetch if user exists to prevent 401 errors
        if (user) {
            fetchEmployees();
        }
    }, [fetchEmployees, user]);

    useEffect(() => {
        // Only fetch if user exists
        if (user) {
            const params = {
                search: filters.searchTerm || undefined,
                status: filters.status === 'all' ? undefined : filters.status,
                priority: filters.priority === 'all' ? undefined : filters.priority,
                view: filters.view,
            };
            fetchTasks(params);
        }
    }, [filters.searchTerm, filters.status, filters.priority, filters.view, fetchTasks, user]);

    // 2. Move the conditional return AFTER all hooks
    if (!user) {
        return null;
    }

    // ============================================
    // NAVBAR & SHORTCUTS
    // ============================================

    const accessConfig = {
        roles: ['accountant', 'super-admin'] as UserRole[],
        emails: ['suvarna@aciersteelpvtltd.com', 'test@gmail.com']
    };
    const canCrateTAsk = AuthUtils.canAccess(user, accessConfig) || checkAdmin;


    const { pageActions } = createSimplePageConfig(
        user,
        loading,
        handleRefresh,
        canCrateTAsk ? () => setIsCreateModalOpen(true) : undefined
    );

    // useKeyboardShortcuts({
    //     'ctrl+n': () => {
    //         if (canCrateTAsk) {
    //             setIsCreateModalOpen(true);
    //         }
    //     },
    // });

    // ============================================
    // RENDER
    // ============================================

    if (loading && tasks.length === 0) {
        return (
            <Loading
                title="Loading Tasks"
                subtitle="Fetching your tasks..."
                showProgress={true}
                blurEffect={true}
            />
        );
    }

    if (error && tasks.length === 0) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-100 dark:bg-slate-900">
                <div className="text-center">
                    <p className="text-red-500 text-lg mb-4">Error: {error}</p>
                    <button
                        onClick={handleRefresh}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    function handleLogout(): void {
        // 1. Clear sensitive auth tokens
        auth.clearAuth();

        // 3. Reset Global State (if using Redux/Context)
        setTasks([]);

        // 4. Redirect to login
        window.location.href = '/login';
    }

    if (!user) return null;

    return (
        <div className="bg-slate-100 dark:bg-slate-900 text-foreground min-h-screen flex flex-col">
            <UniversalNavBar
                currentUserProfile={rbacUser}
                isLoggedIn={!!user}
                handleLogout={handleLogout}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                searchPlaceholder="Search tasks..."
                isMenuOpen={isMenuOpen}
                setIsMenuOpen={setIsMenuOpen}
                currentPath={pathname}
                pageActions={pageActions}
            />

            {/* Filter Bar */}
            <div className="sticky top-[100px] z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-2.5 shadow-sm">
                <div className="max-w-[1800px] mx-auto flex items-center gap-2 flex-wrap">

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 gap-2 text-xs font-semibold hover:bg-white dark:hover:bg-slate-700 transition-all">
                                <User className="w-3.5 h-3.5 text-blue-500" />
                                <span className="max-w-[100px] truncate">
                                    {filters.assignedTo === 'all' ? 'All Users' :
                                        getUserFromRegistry(filters.assignedTo)?.name || 'User'}
                                </span>

                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56">
                            <DropdownMenuLabel className="text-[10px] uppercase text-slate-400">Filter by Assignee</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setFilters(prev => ({ ...prev, assignedTo: 'all' }))}>
                                All Users
                            </DropdownMenuItem>
                            {employees.map(emp => (
                                <DropdownMenuItem
                                    key={emp.id}
                                    onClick={() => setFilters(prev => ({ ...prev, assignedTo: emp.id }))}
                                >
                                    {emp.name}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 gap-2 text-xs font-semibold hover:bg-white dark:hover:bg-slate-700 transition-all">
                                <SortAsc className="w-4 h-4 text-emerald-500" />
                                Sort: {filters.sortBy === 'dueDate' ? 'Due Date' :
                                    filters.sortBy === 'createdAt' ? 'Created' : 'Priority'}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48">
                            <DropdownMenuLabel>Sort By</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setFilters(prev => ({ ...prev, sortBy: 'dueDate' }))}>
                                <CalendarIcon className="w-4 h-4 mr-2" />
                                Due Date
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setFilters(prev => ({ ...prev, sortBy: 'createdAt' }))}>
                                <CalendarIcon className="w-4 h-4 mr-2" />
                                Created Date
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setFilters(prev => ({ ...prev, sortBy: 'priority' }))}>
                                <Filter className="w-4 h-4 mr-2" />
                                Priority
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setFilters(prev => ({
                                ...prev,
                                sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc'
                            }))}>
                                {filters.sortOrder === 'asc' ? '↑ Ascending' : '↓ Descending'}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <div className="ml-auto text-sm text-slate-600 dark:text-slate-400">
                        {processedTasks.length} task{processedTasks.length !== 1 ? 's' : ''}
                    </div>
                </div>
            </div>



            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <main className="h-full max-w-[1800px] mx-auto">

                    {/* One Time Work (OTW) Section */}
                    {Object.keys(tasksByStatus).length > 0 && (
                        <Card className="rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                            {/* Main Section Header */}
                            <CardHeader className="p-4 bg-gray-700 text-white flex items-center justify-between rounded-t-xl">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-2xl font-bold">Tasks: One Time Work (OTW)</h2>
                                </div>
                                <Badge className="bg-white text-gray-700 font-bold px-3 py-1 rounded-full text-sm">
                                    {/* Totals all tasks across all visible columns */}
                                    {Object.values(tasksByStatus).flat().length} Total
                                </Badge>
                            </CardHeader>

                            <CardContent className="p-6">
                                {/* Responsive Grid Layout for Columns */}
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                                    {KANBAN_COLUMNS.map((column) => {
                                        const columnTasks = tasksByStatus[column.id] || [];

                                        // Only render the column if it has tasks or we are in a loading state
                                        if (columnTasks.length === 0 && !loading) return null;

                                        return (
                                            <div key={column.id} className="col-span-1 flex flex-col">
                                                {/* Sub-Header for each Status */}
                                                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center justify-between border-b pb-2 dark:border-gray-700">
                                                    {column.title}
                                                    <Badge
                                                        className={`${column.colorClass || 'bg-blue-500'} text-white`}
                                                    >
                                                        {columnTasks.length}
                                                    </Badge>
                                                </h3>

                                                {/* Task List - Reusing your KanbanColumn for logic/DND support */}
                                                <div className="space-y-4">
                                                    <KanbanColumn
                                                        //status={column.id}
                                                        //title={column.title}
                                                        tasks={columnTasks}
                                                        currentUserRole={user?.role}
                                                        users={employees}
                                                        isLoading={loading}
                                                        currentUserId={user?.id}
                                                        onTaskClick={handleTaskClick}
                                                        user={user}
                                                        onUpdateStatus={updateTaskStatus}
                                                        onUpdate={updateTask}
                                                        onDelete={deleteTask}
                                                    // Note: We are using KanbanColumn here to preserve your existing 
                                                    // drag-and-drop or status update logic.
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                </main>
            </div>

            <CreateTaskDialog
                open={isCreateModalOpen}
                onOpenChange={setIsCreateModalOpen}
                onCreateTask={createTask}
                users={employees}
                user={user}
            />

            {selectedTask && (
                <TaskDetailDialog
                    open={!!selectedTask}
                    onOpenChange={(open) => !open && setSelectedTask(null)}
                    task={selectedTask}
                    users={employees}
                    key={selectedTask.id}
                    user={user}
                    capabilities={getTaskCapabilities(selectedTask)}
                    onUpdate={updateTask}
                    onUpdateStatus={updateTaskStatus}
                    onDelete={deleteTask}
                    onRefresh={() => syncTaskFromServer(selectedTask.id)}
                />
            )}
        </div>
    );
}