import { apiClient } from '../client';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface DashboardMetricsData {
  leads: {
    newLeadsToday: number;
    remindersDueToday: number;
    completedToday: number;
    closedToday: number;
    overdueFollowUps: number;
    upcomingTomorrow: number;
  };
  orders: {
    totalOrders: number;
    completedOrders: number;
    ordersInProgress: number;
    cancelledOrders: number;
    ordersToday: number;
    ordersThisWeek: number;
  };
  purchases: {
    totalPurchases: number;
    pendingPurchases: number;
    approvedPurchases: number;
    cancelledPurchases: number;
    invoicedPurchases: number;
    completedPurchases: number;
  };
  tasks: {
    TotalTasks: number;
    InProgressTasks: number;
    CompletedTasks: number;
    NeedHelpTasks: number;
    TasksToday: number;
    TasksDueToday: number;
    OverdueTasks: number;
    HighPriorityTasks: number;
    RecurringTasks: number;
  };
}

export interface DashboardAlertDetails {
  leadId?: string;
  clientName?: string;
  reminderDate?: string;
  daysPastDue?: number;
  purchaseNo?: string;
  supplierName?: string;
  createdAt?: string;
  hoursPending?: number;
}

export interface DashboardAlertsData {
  critical: number;
  urgent: number;
  pendingApprovals: number;
  details: {
    criticalOverdueLeads: DashboardAlertDetails[];
    urgentReminders: DashboardAlertDetails[];
    pendingApprovals: DashboardAlertDetails[];
  };
}

interface TrendItem {
  _id: string;
  count: number;
}

export interface DashboardTrendsData {
  trends: {
    leads: TrendItem[];
    orders: TrendItem[];
    purchases: TrendItem[];
  };
  growth: {
    leadsWeekOverWeek: string;
    period: string;
  };
}

export interface DashboardHealthData {
  status: string;
  database: string;
  timestamp: string;
  uptime: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// ---------------------------------------------------------------------------
// API Service
// ---------------------------------------------------------------------------

export const dashboardApi = {
  fetchDashboardMetrics: async (): Promise<DashboardMetricsData | null> => {
    const res = await apiClient.get<ApiResponse<DashboardMetricsData>>('/dashboard/metrics');
    return res?.data || null;
  },

  fetchDashboardAlerts: async (): Promise<DashboardAlertsData | null> => {
    const res = await apiClient.get<ApiResponse<DashboardAlertsData>>('/dashboard/alerts');
    return res?.data || null;
  },

  fetchDashboardTrends: async (): Promise<DashboardTrendsData | null> => {
    const res = await apiClient.get<ApiResponse<DashboardTrendsData>>('/dashboard/trends');
    return res?.data || null;
  },

  fetchDashboardHealth: async (): Promise<DashboardHealthData | null> => {
    const res = await apiClient.get<ApiResponse<DashboardHealthData>>('/dashboard/health');
    return res?.data || null;
  },
};
