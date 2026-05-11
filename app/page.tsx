"use client"
import UniversalNavBar, { createSimplePageConfig, useNavbarState } from '@/components/NavBar';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { checkCloudAuth } from '@/lib/auth/checkCloudAuth';
import { BASE_API_URL } from '@/lib/data';
import { Loader2, Target, Briefcase, ShoppingCart, AlertCircle, Clock, TrendingUp, TrendingDown, HeartPulse, ListTodo } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { useLoading } from '@/context/LoadingContext'; // Import useLoading
import { UserProfile } from '@/types/rbac.types';
import { auth } from '@/lib/auth';


// --- Interfaces (based on Dashboard API Documentation) ---

interface DashboardMetricsData {
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

interface DashboardAlertDetails {
  leadId?: string;
  clientName?: string;
  reminderDate?: string;
  daysPastDue?: number;
  purchaseNo?: string;
  supplierName?: string;
  createdAt?: string;
  hoursPending?: number;
}

interface DashboardAlertsData {
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

interface DashboardTrendsData {
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

interface DashboardHealthData {
  status: string;
  database: string;
  timestamp: string;
  uptime: number;
}

// API Service for data fetching
const apiService = {
  fetchDashboardMetrics: async (accessToken: string): Promise<DashboardMetricsData> => {
    try {
      const response = await fetch(`${BASE_API_URL}/dashboard/metrics`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const { data } = await response.json();
      return data;
    } catch (error) {
      console.error("API Error (fetchDashboardMetrics):", error);
      throw error;
    }
  },

  fetchDashboardAlerts: async (accessToken: string): Promise<DashboardAlertsData> => {
    try {
      const response = await fetch(`${BASE_API_URL}/dashboard/alerts`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const { data } = await response.json();
      return data;
    } catch (error) {
      console.error("API Error (fetchDashboardAlerts):", error);
      throw error;
    }
  },

  fetchDashboardTrends: async (accessToken: string): Promise<DashboardTrendsData> => {
    try {
      const response = await fetch(`${BASE_API_URL}/dashboard/trends`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const { data } = await response.json();
      return data;
    } catch (error) {
      console.error("API Error (fetchDashboardTrends):", error);
      throw error;
    }
  },

  fetchDashboardHealth: async (accessToken: string): Promise<DashboardHealthData> => {
    try {
      const response = await fetch(`${BASE_API_URL}/dashboard/health`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const { data } = await response.json();
      return data;
    } catch (error) {
      console.error("API Error (fetchDashboardHealth):", error);
      throw error;
    }
  },
};

// --- Dashboard Metrics Component ---
const DashboardMetricsComponent: React.FC<{
  metrics: DashboardMetricsData | null;
  isFetching: boolean;
  userRole: string;
}> = ({ metrics, isFetching, userRole }) => {

  const allowedRolesForLeads = useMemo(() => ['super-admin', 'sales', 'viewer'], []);
  const allowedRolesForOrders = useMemo(() => ['super-admin', 'sales', 'operations', 'accountant', 'viewer'], []);
  const allowedRolesForPurchases = useMemo(() => ['super-admin', 'accountant', 'viewer', 'purchase-entry'], []);
  const allowedRolesForTask = useMemo(() => ['super-admin', 'operations', 'accountant', 'viewer', 'purchase-entry'], []);

  const canViewLeadsMetrics = allowedRolesForLeads.includes(userRole);
  const canViewOrdersMetrics = allowedRolesForOrders.includes(userRole);
  const canViewPurchaseMetrics = allowedRolesForPurchases.includes(userRole);
  const canViewTasksMetrics = allowedRolesForTask.includes(userRole);


  const renderLoadingState = () => (
    <div className="flex items-center text-2xl font-bold text-gray-700 dark:text-gray-300 min-h-[100px] justify-center">
      <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading...
    </div>
  );

  const renderNoData = (category: string) => (
    <div className="text-gray-500 dark:text-gray-400 text-center py-4 min-h-[100px] flex items-center justify-center">
      No {category} data available.
    </div>
  );

  return (
    <div className="py-2 md:py-6">
      <h2 className="text-xl md:text-3xl font-bold text-gray-900 dark:text-white mb-6">Core Business Metrics</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">

        {/* Leads Metrics */}
        {canViewLeadsMetrics && (
          <Card className="rounded-xl py-4 shadow-lg border bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950 dark:to-indigo-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xl font-medium text-indigo-800 dark:text-indigo-200">Leads Today</CardTitle>
              <Target className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </CardHeader>
            <CardContent>
              {isFetching ? renderLoadingState() : (
                (metrics?.leads?.newLeadsToday !== undefined && metrics.leads.newLeadsToday >= 0) ? (
                  <>
                    <div className="text-4xl font-bold text-indigo-900 dark:text-indigo-100">{metrics.leads.newLeadsToday}</div>
                    <p className="text-sm text-indigo-600 dark:text-indigo-300 mt-1">New Leads Today</p>
                    <p className="text-sm text-indigo-600 dark:text-indigo-300 mt-1">Reminders Due: {metrics.leads.remindersDueToday || 0}</p>
                    <p className="text-sm text-indigo-600 dark:text-indigo-300 mt-1">Overdue: {metrics.leads.overdueFollowUps || 0}</p>
                  </>
                ) : renderNoData('leads')
              )}
            </CardContent>
          </Card>
        )}

        {/* Orders Metrics */}
        {canViewOrdersMetrics && (
          <Card className="rounded-xl py-4 shadow-lg border bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xl font-medium text-blue-800 dark:text-blue-200">Orders Overview</CardTitle>
              <Briefcase className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </CardHeader>
            <CardContent>
              {isFetching ? renderLoadingState() : (
                (metrics?.orders?.totalOrders !== undefined && metrics.orders.totalOrders >= 0) ? (
                  <>
                    <div className="text-4xl font-bold text-blue-900 dark:text-blue-100">{metrics.orders.totalOrders}</div>
                    <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">Total Orders</p>
                    <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">Completed: {metrics.orders.completedOrders || 0}</p>
                    <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">In Progress: {metrics.orders.ordersInProgress || 0}</p>
                  </>
                ) : renderNoData('orders')
              )}
            </CardContent>
          </Card>
        )}

        {/* Purchases Metrics */}
        {canViewPurchaseMetrics && (
          <Card className="rounded-xl py-4 shadow-lg border bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xl font-medium text-purple-800 dark:text-purple-200">Purchases Overview</CardTitle>
              <ShoppingCart className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </CardHeader>
            <CardContent>
              {isFetching ? renderLoadingState() : (
                (metrics?.purchases?.totalPurchases !== undefined && metrics.purchases.totalPurchases >= 0) ? (
                  <>
                    <div className="text-4xl font-bold text-purple-900 dark:text-purple-100">{metrics.purchases.totalPurchases}</div>
                    <p className="text-sm text-purple-600 dark:text-purple-300 mt-1">Total Purchases</p>
                    <p className="text-sm text-purple-600 dark:text-purple-300 mt-1">Pending: {metrics.purchases.pendingPurchases || 0}</p>
                    <p className="text-sm text-purple-600 dark:text-purple-300 mt-1">Approved: {metrics.purchases.approvedPurchases || 0}</p>
                  </>
                ) : renderNoData('purchases')
              )}
            </CardContent>
          </Card>
        )}
        {/* Tasks Metrics */}
        {canViewTasksMetrics && (
          <Card className="rounded-xl py-4 shadow-lg border bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xl font-medium text-emerald-800 dark:text-emerald-200">Tasks Overview</CardTitle>
              <ListTodo className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </CardHeader>
            <CardContent>
              {isFetching ? renderLoadingState() : (
                (metrics?.tasks?.TotalTasks !== undefined && metrics.tasks.TotalTasks >= 0) ? (
                  <>
                    <div className="text-4xl font-bold text-emerald-900 dark:text-emerald-100">{metrics.tasks.TotalTasks}</div>
                    <p className="text-sm text-emerald-600 dark:text-emerald-300 mt-1">Total Tasks</p>
                    <p className="text-sm text-emerald-600 dark:text-emerald-300 mt-1">InProgress: {metrics.tasks.InProgressTasks || 0}</p>
                    <p className="text-sm text-emerald-600 dark:text-emerald-300 mt-1">Due Today: {metrics.tasks.TasksDueToday || 0}</p>
                  </>
                ) : renderNoData('tasks')
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

// --- Dashboard Alerts Component ---
const DashboardAlertsComponent: React.FC<{
  alerts: DashboardAlertsData;
  isFetching: boolean;
  userRole: string;
  userEmail: string;
}> = ({ alerts, isFetching, userRole }) => {

  const allowedRolesForLeadAlerts = useMemo(() => ['super-admin', 'sales', 'operations'], []);
  const allowedRolesForPurchaseAlerts = useMemo(() => ['super-admin', 'operations', 'accountant'], []);

  const canViewLeadAlerts = allowedRolesForLeadAlerts.includes(userRole);
  const canViewPurchaseAlerts = allowedRolesForPurchaseAlerts.includes(userRole);

  const renderLoadingState = () => (
    <div className="flex items-center text-xl font-bold text-gray-600 dark:text-gray-400 min-h-[100px] justify-center">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading Alerts...
    </div>
  );

  const renderNoAlerts = () => (
    <div className="text-gray-500 dark:text-gray-400 text-center py-4 col-span-full min-h-[100px] flex items-center justify-center">
      No active alerts.
    </div>
  );

  const hasAnyAlerts = useMemo(() => {
    if (!alerts) return false;
    return (canViewLeadAlerts && (alerts.critical > 0 || alerts.urgent > 0)) ||
      (canViewPurchaseAlerts && alerts.pendingApprovals > 0);
  }, [alerts, canViewLeadAlerts, canViewPurchaseAlerts]);

  return (
    <div className="py-2 md:py-6 mt-10">
      <h2 className="text-xl md:text-3xl font-bold text-gray-900 dark:text-white mb-6">Dashboard Alerts</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {isFetching ? renderLoadingState() : (
          !hasAnyAlerts ? renderNoAlerts() : (
            <>
              {canViewLeadAlerts && alerts?.critical > 0 && (
                <Card className="rounded-xl py-4 shadow-lg border bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-800">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xl font-medium text-red-900 dark:text-red-100">Critical Alerts</CardTitle>
                    <AlertCircle className="h-6 w-6 text-red-700 dark:text-red-300" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold text-red-900 dark:text-red-100">{alerts.critical}</div>
                    <p className="text-sm text-red-700 dark:text-red-200 mt-1">Overdue Leads</p>
                    {alerts.details.criticalOverdueLeads?.[0] && (
                      <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                        Ex: {alerts.details.criticalOverdueLeads[0].clientName} ({alerts.details.criticalOverdueLeads[0].daysPastDue} days overdue)
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {canViewLeadAlerts && alerts?.urgent > 0 && (
                <Card className="rounded-xl py-4 shadow-lg border bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-800">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xl font-medium text-orange-900 dark:text-orange-100">Urgent Reminders</CardTitle>
                    <Clock className="h-6 w-6 text-orange-700 dark:text-orange-300" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold text-orange-900 dark:text-orange-100">{alerts.urgent}</div>
                    <p className="text-sm text-orange-700 dark:text-orange-200 mt-1">Reminders due today</p>
                    {alerts.details.urgentReminders?.[0] && (
                      <p className="text-xs text-orange-600 dark:text-orange-300 mt-1">
                        Ex: {alerts.details.urgentReminders[0].clientName} (Today)
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {canViewPurchaseAlerts && alerts?.pendingApprovals > 0 && (
                <Card className="rounded-xl py-4 shadow-lg border bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-800">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xl font-medium text-yellow-900 dark:text-yellow-100">Pending Approvals</CardTitle>
                    <ShoppingCart className="h-6 w-6 text-yellow-700 dark:text-yellow-300" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold text-yellow-900 dark:text-yellow-100">{alerts.pendingApprovals}</div>
                    <p className="text-sm text-yellow-700 dark:text-yellow-200 mt-1">Purchase orders awaiting approval</p>
                    {alerts.details.pendingApprovals?.[0] && (
                      <p className="text-xs text-yellow-600 dark:text-yellow-300 mt-1">
                        Ex: PO-{alerts.details.pendingApprovals[0].purchaseNo} ({alerts.details.pendingApprovals[0].hoursPending} hrs pending)
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )
        )}
      </div>
    </div>
  );
};

// --- Dashboard Trends Component ---
const DashboardTrendsComponent: React.FC<{
  trends: DashboardTrendsData | null;
  isFetching: boolean;
  userRole: string;
}> = ({ trends, isFetching, userRole }) => {

  const allowedRolesForTrends = useMemo(() => ['super-admin', 'sales', 'operations', 'accountant', 'viewer'], []);
  const canViewTrends = allowedRolesForTrends.includes(userRole);

  const renderLoadingState = () => (
    <div className="flex items-center text-xl font-bold text-gray-600 dark:text-gray-400 min-h-[100px] justify-center">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading Trends...
    </div>
  );

  const renderNoData = () => (
    <div className="text-gray-500 dark:text-gray-400 text-center py-4 col-span-full min-h-[100px] flex items-center justify-center">
      No trend data available.
    </div>
  );

  if (!canViewTrends) return null;

  const getTrendIconAndColor = (value: string | undefined, currentData: TrendItem[]) => {
    if (isFetching) return { Icon: Loader2, color: 'text-gray-500' };

    let isPositiveTrend = false;
    let Icon = TrendingUp;
    let color = 'text-gray-500';

    if (typeof value === 'string' && value.includes('%')) {
      const percentage = parseFloat(value);
      if (isNaN(percentage)) {
        Icon = TrendingUp;
      } else {
        isPositiveTrend = percentage >= 0;
        Icon = isPositiveTrend ? TrendingUp : TrendingDown;
        color = isPositiveTrend ? 'text-green-600' : 'text-red-600';
      }
    } else if (Array.isArray(currentData) && currentData.length > 1) {
      const lastValue = currentData[currentData.length - 1].count;
      const previousSixDays = currentData.slice(Math.max(0, currentData.length - 7), -1).map(item => item.count);
      const averagePrevious = previousSixDays.length > 0 ? previousSixDays.reduce((sum, val) => sum + val, 0) / previousSixDays.length : 0;

      if (lastValue > averagePrevious) {
        isPositiveTrend = true;
        Icon = TrendingUp;
        color = 'text-green-600';
      } else if (lastValue < averagePrevious && averagePrevious > 0) {
        isPositiveTrend = false;
        Icon = TrendingDown;
        color = 'text-red-600';
      } else {
        Icon = TrendingUp;
        color = 'text-gray-500';
      }
    } else if (Array.isArray(currentData) && currentData.length === 1) {
      Icon = TrendingUp;
      color = 'text-gray-500';
    }

    return { Icon, color };
  };

  const hasTrendData = useMemo(() => {
    if (!trends) return false;
    return (trends.trends.leads && trends.trends.leads.length > 0) ||
      (trends.trends.orders && trends.trends.orders.length > 0) ||
      (trends.trends.purchases && trends.trends.purchases.length > 0);
  }, [trends]);

  return (
    <div className="py-2 md:py-6 mt-10">
      <h2 className="text-xl md:text-3xl font-bold text-gray-900 dark:text-white mb-6">7-Day Business Trends</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {isFetching ? renderLoadingState() : (
          !hasTrendData ? renderNoData() : (
            <>
              {(trends?.trends?.leads && trends.trends.leads.length > 0) && (
                <Card className="rounded-xl py-4 shadow-lg border bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-950 dark:to-teal-800">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xl font-medium text-teal-800 dark:text-teal-200">Leads Trend</CardTitle>
                    <div className="flex items-center gap-1">
                      {trends.growth.leadsWeekOverWeek && React.createElement(getTrendIconAndColor(trends.growth.leadsWeekOverWeek, trends.trends.leads).Icon, {
                        className: `h-6 w-6 ${getTrendIconAndColor(trends.growth.leadsWeekOverWeek, trends.trends.leads).color}`
                      })
                      }
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-4xl font-bold ${trends.growth.leadsWeekOverWeek ? getTrendIconAndColor(trends.growth.leadsWeekOverWeek, trends.trends.leads).color : 'text-gray-500'}`}>
                      {trends.growth.leadsWeekOverWeek || 'N/A'}
                    </div>
                    <p className="text-sm text-teal-600 dark:text-teal-300 mt-1">{trends.growth.period || 'Week over week'}</p>
                    <p className="text-xs text-teal-500 dark:text-teal-400 mt-2">
                      Daily: {trends.trends.leads.map(t => `${t._id.substring(5)}:${t.count}`).join(' | ') || 'N/A'}
                    </p>
                  </CardContent>
                </Card>
              )}

              {(trends?.trends?.orders && trends.trends.orders.length > 0) && (
                <Card className="rounded-xl py-4 shadow-lg border bg-gradient-to-br from-lime-50 to-lime-100 dark:from-lime-950 dark:to-lime-800">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xl font-medium text-lime-800 dark:text-lime-200">Orders Trend</CardTitle>
                    <div className="flex items-center gap-1">
                      {trends.trends.orders && React.createElement(getTrendIconAndColor(undefined, trends.trends.orders).Icon, {
                        className: `h-6 w-6 ${getTrendIconAndColor(undefined, trends.trends.orders).color}`
                      })
                      }
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-4xl font-bold ${trends.trends.orders ? getTrendIconAndColor(undefined, trends.trends.orders).color : 'text-gray-500'}`}>
                      {trends.trends.orders.reduce((sum, item) => sum + item.count, 0)}
                    </div>
                    <p className="text-sm text-lime-600 dark:text-lime-300 mt-1">Total orders past 7 days</p>
                    <p className="text-xs text-lime-500 dark:text-lime-400 mt-2">
                      Daily: {trends.trends.orders.map(t => `${t._id.substring(5)}:${t.count}`).join(' | ') || 'N/A'}
                    </p>
                  </CardContent>
                </Card>
              )}

              {(trends?.trends?.purchases && trends.trends.purchases.length > 0) && (
                <Card className="rounded-xl py-4 shadow-lg border bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950 dark:to-cyan-800">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xl font-medium text-cyan-800 dark:text-cyan-200">Purchases Trend</CardTitle>
                    <div className="flex items-center gap-1">
                      {trends.trends.purchases && React.createElement(getTrendIconAndColor(undefined, trends.trends.purchases).Icon, {
                        className: `h-6 w-6 ${getTrendIconAndColor(undefined, trends.trends.purchases).color}`
                      })
                      }
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-4xl font-bold ${trends.trends.purchases ? getTrendIconAndColor(undefined, trends.trends.purchases).color : 'text-gray-500'}`}>
                      {trends.trends.purchases.reduce((sum, item) => sum + item.count, 0)}
                    </div>
                    <p className="text-sm text-cyan-600 dark:text-cyan-300 mt-1">Total purchases past 7 days</p>
                    <p className="text-xs text-cyan-500 dark:text-cyan-400 mt-2">
                      Daily: {trends.trends.purchases.map(t => `${t._id.substring(5)}:${t.count}`).join(' | ') || 'N/A'}
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          )
        )}
      </div>
    </div>
  );
};

// --- Dashboard Health Component ---
const DashboardHealthComponent: React.FC<{
  health: DashboardHealthData | null;
  isFetching: boolean;
  userRole: string;
}> = ({ health, isFetching, userRole }) => {
  const allowedRolesForHealth = useMemo(() => ['super-admin', 'operations', 'viewer'], []);
  const canViewHealth = allowedRolesForHealth.includes(userRole);

  const renderLoadingState = () => (
    <div className="flex items-center text-xl font-bold text-gray-600 dark:text-gray-400 min-h-[100px] justify-center">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Checking Health...
    </div>
  );

  const renderNoData = () => (
    <div className="text-gray-500 dark:text-gray-400 text-center py-4 col-span-full min-h-[100px] flex items-center justify-center">
      Health data not available.
    </div>
  );

  if (!canViewHealth) return null;

  const getStatusColor = (status: string | undefined) => {
    if (status === 'Healthy' || status === 'Connected') return 'text-green-600';
    if (status === 'Unhealthy' || status === 'Disconnected') return 'text-red-600';
    return 'text-gray-500';
  };

  const formatUptime = (seconds: number | undefined) => {
    if (seconds === undefined || seconds < 0) return 'N/A';
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const hasHealthData = useMemo(() => {
    return health && health.status !== undefined;
  }, [health]);

  return (
    <div className="py-2 md:py-6 mt-10">
      <h2 className="text-xl md:text-3xl font-bold text-gray-900 dark:text-white mb-6">System Health Check</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {isFetching ? renderLoadingState() : (
          !hasHealthData ? renderNoData() : (
            <Card className="rounded-xl py-4 shadow-lg border bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-800">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xl font-medium text-green-800 dark:text-green-200">System Status</CardTitle>
                <HeartPulse className={`h-6 w-6 ${getStatusColor(health?.status)}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-4xl font-bold ${getStatusColor(health?.status)}`}>
                  {health?.status || 'N/A'}
                </div>
                <p className="text-sm text-green-600 dark:text-green-300 mt-1">Database: <span className={`${getStatusColor(health?.database)}`}>{health?.database || 'N/A'}</span></p>
                <p className="text-sm text-green-600 dark:text-green-300 mt-1">Uptime: {formatUptime(health?.uptime)}</p>
              </CardContent>
            </Card>
          )
        )}
      </div>
    </div>
  );
};

// Main Dashboard Page Component
function App() {
  const { showLoader, hideLoader } = useLoading(); // Use the loading context


  const [user, setUser] = useState<UserProfile | null>(null);
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetricsData | null>(null);
  const [dashboardAlerts, setDashboardAlerts] = useState<DashboardAlertsData | null>(null);
  const [dashboardTrends, setDashboardTrends] = useState<DashboardTrendsData | null>(null);
  const [dashboardHealth, setDashboardHealth] = useState<DashboardHealthData | null>(null);

  const [isFetchingMetrics, setIsFetchingMetrics] = useState<boolean>(false);
  const [isFetchingAlerts, setIsFetchingAlerts] = useState<boolean>(false);
  const [isFetchingTrends, setIsFetchingTrends] = useState<boolean>(false);
  const [isFetchingHealth, setIsFetchingHealth] = useState<boolean>(false);

  const pathname = usePathname();
  const router = useRouter();

  const {
    searchTerm,
    setSearchTerm,
    isMenuOpen,
    setIsMenuOpen
  } = useNavbarState();

  const fetchAllDashboardData = useCallback(async (token: string) => {
    if (!token) {
      setDashboardMetrics(null);
      setDashboardAlerts(null);
      setDashboardTrends(null);
      setDashboardHealth(null);
      return;
    }

    setIsFetchingMetrics(true);
    setIsFetchingAlerts(true);
    setIsFetchingTrends(true);
    setIsFetchingHealth(true);

    // Show loading screen while fetching
    showLoader({
      title: "Refreshing Dashboard",
      subtitle: "Loading latest data...",
      showProgress: false,
      blurEffect: true,
    });

    try {
      const [metricsData, alertsData, trendsData, healthData] = await Promise.all([
        apiService.fetchDashboardMetrics(token),
        apiService.fetchDashboardAlerts(token),
        apiService.fetchDashboardTrends(token),
        apiService.fetchDashboardHealth(token),
      ]);
      setDashboardMetrics(metricsData);
      setDashboardAlerts(alertsData);
      setDashboardTrends(trendsData);
      setDashboardHealth(healthData);
      toast.success('Dashboard data updated!');
    } catch (error: any) {
      console.error("Error fetching dashboard data:", error);
      toast.error(`Failed to refresh dashboard: ${error.message}`);
    } finally {
      setIsFetchingMetrics(false);
      setIsFetchingAlerts(false);
      setIsFetchingTrends(false);
      setIsFetchingHealth(false);
      hideLoader(); // Hide loading screen
    }
  }, [showLoader, hideLoader]);

  useEffect(() => {
    if (user?.accessToken) {
      fetchAllDashboardData(user.accessToken);
    }
  }, [user?.accessToken, fetchAllDashboardData]);

  const canViewOrdersNav = useMemo(() => user?.role ? !['purchase-entry'].includes(user.role) : false, [user?.role]);
  const canViewPurchasesNav = useMemo(() => user?.role ? !['sales'].includes(user.role) : false, [user?.role]);
  const canViewLeadsNav = useMemo(() => user?.role ? ['super-admin', 'sales', 'operations', 'viewer'].includes(user.role) : false, [user?.role]);

  const handleRefreshAllData = useCallback(() => {
    if (user?.accessToken) {
      fetchAllDashboardData(user.accessToken);
    } else {
      toast.error('Not authenticated. Please log in to refresh data.');
    }
  }, [user?.accessToken, fetchAllDashboardData]);

  const navigateToOrders = useCallback(() => {
    window.location.href = '/orders';
  }, []);

  const navigateToPurchases = useCallback(() => {
    window.location.href = '/purchases';
  }, []);

  const navigateToLeads = useCallback(() => {
    window.location.href = '/leads';
  }, []);


  useEffect(() => {
    const validateSession = async () => {
      // Show loading screen during authentication
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
          toast.error('Access denied. Your role does not permit access to this dashboard.');
          router.replace('/');
          hideLoader();
          return;
        }

        hideLoader();
      } catch (err: any) {
        console.warn('Cloud auth failed, falling back to localStorage:', err.message);

        const local = localStorage.getItem('currentUserProfile');
        const token = localStorage.getItem('accessToken');

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
      }
    };
    //useProtectedRoute();
    validateSession();
  }, [router, pathname, showLoader, hideLoader]);

  if (!user) {
    return null; // Loading screen is handled by LoadingContext
  }

  const { pageActions } = createSimplePageConfig(
    user,
    false, // loadingApp is no longer needed
    handleRefreshAllData,
  );


  const handleLogout = () => {
    auth.clearAuth();
    toast.success('Logged out successfully!');
    router.replace('/login');
  };


  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white font-sans">
      <UniversalNavBar
        currentUserProfile={user}
        isLoggedIn={!user}
        handleLogout={handleLogout}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        searchPlaceholder="Search dashboard..."
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
        currentPath={pathname}
        pageActions={pageActions}
      />
      <main className="max-w-8xl mx-auto px-4 py-6 sm:px-6 mt-6 p-4 md:p-6 lg:p-8">

        {/* Quick Navigation Section */}
        <section className="mt-6">
          <h2 className="text-xl md:text-3xl font-bold text-gray-900 dark:text-white mb-6">Quick Navigation</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {canViewOrdersNav && (
              <Card className="rounded-xl py-4 shadow-lg border bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-800 cursor-pointer hover:shadow-xl transition-shadow duration-300" onClick={navigateToOrders}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xl font-medium text-blue-800 dark:text-blue-200">Manage Orders</CardTitle>
                  <Briefcase className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-blue-600 dark:text-blue-300">View, create, and manage all customer orders.</p>
                </CardContent>
              </Card>
            )}

            {canViewPurchasesNav && (
              <Card className="rounded-xl py-4 shadow-lg border bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-800 cursor-pointer hover:shadow-xl transition-shadow duration-300" onClick={navigateToPurchases}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xl font-medium text-purple-800 dark:text-purple-200">Manage Purchases</CardTitle>
                  <ShoppingCart className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-purple-600 dark:text-purple-300">Track and manage all procurement and purchase orders.</p>
                </CardContent>
              </Card>
            )}

            {canViewLeadsNav && (
              <Card className="rounded-xl py-4 shadow-lg border bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950 dark:to-indigo-800 cursor-pointer hover:shadow-xl transition-shadow duration-300" onClick={navigateToLeads}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xl font-medium text-indigo-800 dark:text-indigo-200">Manage Leads</CardTitle>
                  <Target className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-indigo-600 dark:text-indigo-300">View, create, and manage all potential customer leads.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </section>
        <hr className="my-8 border-gray-200 dark:border-gray-700" />
        {user?.role && (
          <>
            <DashboardMetricsComponent
              metrics={dashboardMetrics}
              isFetching={isFetchingMetrics}
              userRole={user.role}
            />
            <hr className="my-8 border-gray-200 dark:border-gray-700" />
            {dashboardAlerts && (
              <DashboardAlertsComponent
                alerts={dashboardAlerts}
                isFetching={isFetchingAlerts}
                userRole={user.role}
                userEmail={user.email}
              />
            )}
            <hr className="my-8 border-gray-200 dark:border-gray-700" />
            <DashboardTrendsComponent
              trends={dashboardTrends}
              isFetching={isFetchingTrends}
              userRole={user.role}
            />
            <hr className="my-8 border-gray-200 dark:border-gray-700" />
            <DashboardHealthComponent
              health={dashboardHealth}
              isFetching={isFetchingHealth}
              userRole={user.role}
            />
          </>
        )}
      </main>
    </div>
  );
}

export default App;