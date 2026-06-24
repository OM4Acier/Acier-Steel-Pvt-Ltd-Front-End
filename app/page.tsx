"use client"
import {
  Loader2, Target, Briefcase, ShoppingCart, AlertCircle,
  Clock, TrendingUp, TrendingDown, HeartPulse, ListTodo
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { useLoading } from '@/context/LoadingContext';
import { NavbarExtension } from '@/context/NavbarExtensionContext';
import { NavButton } from '@/components/NavButton';
import { useUser } from '@clerk/nextjs';
import { usePermissionStore } from '@/stores/permission-store';
import { 
  dashboardApi, 
  DashboardMetricsData, 
  DashboardAlertsData, 
  DashboardTrendsData, 
  DashboardHealthData
} from '@/lib/api/endpoints/dashboardApi';


// ---------------------------------------------------------------------------
// Shared accessible sub-components
// ---------------------------------------------------------------------------

/** Spinner with live-region announcement for screen readers */
const LoadingState: React.FC<{ label?: string }> = ({ label = 'Loading data' }) => (
  <div
    role="status"
    aria-live="polite"
    aria-label={label}
    className="flex items-center justify-center min-h-[100px] gap-2 text-gray-600 dark:text-gray-400"
  >
    <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
    <span className="text-sm font-medium">{label}…</span>
  </div>
);

/** Empty-state that is announced to screen readers */
const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <p
    role="status"
    aria-live="polite"
    className="text-gray-500 dark:text-gray-400 text-center py-4 min-h-[100px] flex items-center justify-center text-sm"
  >
    {message}
  </p>
);

/**
 * InteractiveMetricCard – a fully clickable, keyboard-navigable metric card
 * that navigates to the relevant page on activation (like NavigationCard).
 * Shows all stat rows plus a "View All →" affordance at the bottom.
 */
interface MetricRow { label: string; value: string | number; highlight?: 'warn' | 'danger' | 'good' }

interface InteractiveMetricCardProps {
  title: string;
  primaryValue: string | number;
  primaryLabel: string;
  rows?: MetricRow[];
  Icon: React.ElementType;
  colorScheme: {
    card: string;
    title: string;
    icon: string;
    primary: string;
    row: string;
    badge: string;   // background for the icon badge circle
    viewAll: string; // "View All" text + border colour
  };
  regionLabel: string;
  /** Route to navigate to when the card is clicked */
  href: string;
  onNavigate: () => void;
}

const InteractiveMetricCard: React.FC<InteractiveMetricCardProps> = ({
  title, primaryValue, primaryLabel, rows, Icon, colorScheme, regionLabel, onNavigate,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate(); }
  };

  const highlightClass = (h?: 'warn' | 'danger' | 'good') => {
    if (h === 'danger') return 'text-red-600 dark:text-red-400 font-bold';
    if (h === 'warn') return 'text-amber-600 dark:text-amber-400 font-semibold';
    if (h === 'good') return 'text-green-700 dark:text-green-400 font-semibold';
    return 'font-semibold';
  };

  return (
    <article
      role="link"
      tabIndex={0}
      aria-label={`${regionLabel} — click to open ${title} page`}
      onClick={onNavigate}
      onKeyDown={handleKeyDown}
      className={`
        group rounded-xl shadow-lg border cursor-pointer
        ${colorScheme.card}
        hover:shadow-2xl hover:-translate-y-1
        active:translate-y-0 active:shadow-lg
        transition-all duration-200 ease-out
        focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500
        flex flex-col
      `}
    >
      {/* ── Header ── */}
      <div className="flex flex-row items-center justify-between px-5 pt-5 pb-3">
        <div className={`p-2 rounded-lg ${colorScheme.badge}`}>
          <Icon className={`h-6 w-6 ${colorScheme.icon} flex-shrink-0`} aria-hidden="true" />
        </div>
        <h3 className={`text-base font-semibold ${colorScheme.title} text-right leading-tight`}>{title}</h3>
      </div>

      {/* ── Primary stat ── */}
      <div className="px-5 pb-2">
        <dl>
          <div>
            <dd className={`text-5xl font-extrabold ${colorScheme.primary} tabular-nums leading-none`}>
              {primaryValue}
            </dd>
            <dt className={`text-xs uppercase tracking-wide ${colorScheme.row} mt-1 opacity-80`}>
              {primaryLabel}
            </dt>
          </div>
        </dl>
      </div>

      {/* ── Divider ── */}
      <hr className="mx-5 border-current opacity-10" aria-hidden="true" />

      {/* ── Detail rows ── */}
      <div className="px-5 pt-3 pb-4 flex-1">
        <dl className="space-y-1.5">
          {rows?.map(({ label, value, highlight }) => (
            <div key={label} className="flex items-center justify-between">
              <dt className={`text-sm ${colorScheme.row} opacity-80`}>{label}</dt>
              <dd className={`text-sm tabular-nums ${colorScheme.row} ${highlightClass(highlight)}`}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* ── View All footer ── */}
      <div className={`
        px-5 py-2.5 mt-auto border-t border-current border-opacity-10
        flex items-center justify-between
        ${colorScheme.viewAll}
        opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100
        transition-opacity duration-200
      `}>
        <span className="text-xs font-semibold uppercase tracking-wide">View All</span>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </article>
  );
};

/**
 * NavigationCard – a keyboard-accessible card that acts as a link/button.
 * Uses role="link" with aria-label for screen-reader clarity, and supports
 * both click and keyboard (Enter/Space) activation.
 */
interface NavCardProps {
  title: string;
  description: string;
  Icon: React.ElementType;
  onClick: () => void;
  colorScheme: {
    card: string;
    title: string;
    icon: string;
    desc: string;
  };
}

const NavigationCard: React.FC<NavCardProps> = ({ title, description, Icon, onClick, colorScheme }) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={title}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={`
        rounded-xl py-4 shadow-lg border cursor-pointer
        ${colorScheme.card}
        hover:shadow-xl transition-shadow duration-300
        focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500
      `}
    >
      <div className="flex flex-row items-center justify-between space-y-0 pb-2 px-6 pt-2">
        <span className={`text-xl font-medium ${colorScheme.title}`}>{title}</span>
        <Icon className={`h-8 w-8 ${colorScheme.icon} flex-shrink-0`} aria-hidden="true" />
      </div>
      <div className="px-6 pb-4">
        <p className={`text-sm ${colorScheme.desc}`}>{description}</p>
      </div>
    </div>
  );
};


// ---------------------------------------------------------------------------
// DashboardMetricsComponent
// ---------------------------------------------------------------------------

const DashboardMetricsComponent: React.FC<{
  metrics: DashboardMetricsData | null;
  isFetching: boolean;
  userRole: string;
  onNavigateToLeads: () => void;
  onNavigateToOrders: () => void;
  onNavigateToPurchases: () => void;
  onNavigateToTasks: () => void;
}> = ({ metrics, isFetching, userRole, onNavigateToLeads, onNavigateToOrders, onNavigateToPurchases, onNavigateToTasks }) => {

  const allowedRolesForLeads = useMemo(() => ['super-admin', 'sales', 'viewer'], []);
  const allowedRolesForOrders = useMemo(() => ['super-admin', 'sales', 'operations', 'accountant', 'viewer'], []);
  const allowedRolesForPurchases = useMemo(() => ['super-admin', 'accountant', 'viewer', 'purchase-entry'], []);
  const allowedRolesForTask = useMemo(() => ['super-admin', 'operations', 'accountant', 'viewer', 'purchase-entry'], []);

  const canViewLeadsMetrics = allowedRolesForLeads.includes(userRole);
  const canViewOrdersMetrics = allowedRolesForOrders.includes(userRole);
  const canViewPurchaseMetrics = allowedRolesForPurchases.includes(userRole);
  const canViewTasksMetrics = allowedRolesForTask.includes(userRole);

  /** Skeleton placeholder keeps grid layout stable while loading */
  const SkeletonCard = ({ bg }: { bg: string }) => (
    <div className={`rounded-xl shadow-lg border ${bg} animate-pulse`} aria-hidden="true">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div className="w-10 h-10 rounded-lg bg-current opacity-10" />
        <div className="w-28 h-4 rounded bg-current opacity-10" />
      </div>
      <div className="px-5 pb-2">
        <div className="w-20 h-10 rounded bg-current opacity-10 mb-2" />
        <div className="w-24 h-3 rounded bg-current opacity-10" />
      </div>
      <hr className="mx-5 border-current opacity-10" />
      <div className="px-5 py-4 space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex justify-between">
            <div className="w-24 h-3 rounded bg-current opacity-10" />
            <div className="w-8 h-3 rounded bg-current opacity-10" />
          </div>
        ))}
      </div>
      {/* sr-only loading label */}
      <span className="sr-only">Loading…</span>
    </div>
  );

  return (
    <section aria-labelledby="metrics-heading" className="py-2 md:py-6">
      <div className="flex items-center justify-between mb-6">
        <h2
          id="metrics-heading"
          className="text-xl md:text-3xl font-bold text-gray-900 dark:text-white"
        >
          Core Business Metrics
        </h2>
        <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
          Click any card to view details
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">

        {/* ── Leads ── */}
        {canViewLeadsMetrics && (
          isFetching ? (
            <SkeletonCard bg="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950 dark:to-indigo-800" />
          ) : metrics?.leads?.newLeadsToday !== undefined ? (
            <InteractiveMetricCard
              href="/leads"
              onNavigate={onNavigateToLeads}
              regionLabel="Leads today summary"
              title="Leads Today"
              primaryValue={metrics.leads.newLeadsToday}
              primaryLabel="New Leads Today"
              rows={[
                { label: 'Reminders Due', value: metrics.leads.remindersDueToday || 0, highlight: metrics.leads.remindersDueToday > 0 ? 'warn' : undefined },
                { label: 'Overdue', value: metrics.leads.overdueFollowUps || 0, highlight: metrics.leads.overdueFollowUps > 0 ? 'danger' : undefined },
                { label: 'Completed Today', value: metrics.leads.completedToday || 0, highlight: metrics.leads.completedToday > 0 ? 'good' : undefined },
                { label: 'Due Tomorrow', value: metrics.leads.upcomingTomorrow || 0 },
              ]}
              Icon={Target}
              colorScheme={{
                card: 'bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950 dark:to-indigo-800',
                title: 'text-indigo-800 dark:text-indigo-200',
                icon: 'text-indigo-600 dark:text-indigo-400',
                badge: 'bg-indigo-200 dark:bg-indigo-800',
                primary: 'text-indigo-900 dark:text-indigo-100',
                row: 'text-indigo-700 dark:text-indigo-300',
                viewAll: 'text-indigo-700 dark:text-indigo-300',
              }}
            />
          ) : (
            <div className="rounded-xl shadow-lg border bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950 dark:to-indigo-800 min-h-[180px] flex items-center justify-center">
              <EmptyState message="No leads data available." />
            </div>
          )
        )}

        {/* ── Orders ── */}
        {canViewOrdersMetrics && (
          isFetching ? (
            <SkeletonCard bg="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-800" />
          ) : metrics?.orders?.totalOrders !== undefined ? (
            <InteractiveMetricCard
              href="/orders"
              onNavigate={onNavigateToOrders}
              regionLabel="Orders overview summary"
              title="Orders Overview"
              primaryValue={metrics.orders.totalOrders}
              primaryLabel="Total Orders"
              rows={[
                { label: 'Completed', value: metrics.orders.completedOrders || 0, highlight: metrics.orders.completedOrders > 0 ? 'good' : undefined },
                { label: 'In Progress', value: metrics.orders.ordersInProgress || 0, highlight: metrics.orders.ordersInProgress > 0 ? 'warn' : undefined },
                { label: 'Cancelled', value: metrics.orders.cancelledOrders || 0, highlight: metrics.orders.cancelledOrders > 0 ? 'danger' : undefined },
                { label: 'This Week', value: metrics.orders.ordersThisWeek || 0 },
              ]}
              Icon={Briefcase}
              colorScheme={{
                card: 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-800',
                title: 'text-blue-800 dark:text-blue-200',
                icon: 'text-blue-600 dark:text-blue-400',
                badge: 'bg-blue-200 dark:bg-blue-800',
                primary: 'text-blue-900 dark:text-blue-100',
                row: 'text-blue-700 dark:text-blue-300',
                viewAll: 'text-blue-700 dark:text-blue-300',
              }}
            />
          ) : (
            <div className="rounded-xl shadow-lg border bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-800 min-h-[180px] flex items-center justify-center">
              <EmptyState message="No orders data available." />
            </div>
          )
        )}

        {/* ── Purchases ── */}
        {canViewPurchaseMetrics && (
          isFetching ? (
            <SkeletonCard bg="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-800" />
          ) : metrics?.purchases?.totalPurchases !== undefined ? (
            <InteractiveMetricCard
              href="/purchases"
              onNavigate={onNavigateToPurchases}
              regionLabel="Purchases overview summary"
              title="Purchases Overview"
              primaryValue={metrics.purchases.totalPurchases}
              primaryLabel="Total Purchases"
              rows={[
                { label: 'Pending', value: metrics.purchases.pendingPurchases || 0, highlight: metrics.purchases.pendingPurchases > 0 ? 'warn' : undefined },
                { label: 'Approved', value: metrics.purchases.approvedPurchases || 0, highlight: metrics.purchases.approvedPurchases > 0 ? 'good' : undefined },
                { label: 'Invoiced', value: metrics.purchases.invoicedPurchases || 0 },
                { label: 'Cancelled', value: metrics.purchases.cancelledPurchases || 0, highlight: metrics.purchases.cancelledPurchases > 0 ? 'danger' : undefined },
              ]}
              Icon={ShoppingCart}
              colorScheme={{
                card: 'bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-800',
                title: 'text-purple-800 dark:text-purple-200',
                icon: 'text-purple-600 dark:text-purple-400',
                badge: 'bg-purple-200 dark:bg-purple-800',
                primary: 'text-purple-900 dark:text-purple-100',
                row: 'text-purple-700 dark:text-purple-300',
                viewAll: 'text-purple-700 dark:text-purple-300',
              }}
            />
          ) : (
            <div className="rounded-xl shadow-lg border bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-800 min-h-[180px] flex items-center justify-center">
              <EmptyState message="No purchases data available." />
            </div>
          )
        )}

        {/* ── Tasks ── */}
        {canViewTasksMetrics && (
          isFetching ? (
            <SkeletonCard bg="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-800" />
          ) : metrics?.tasks?.TotalTasks !== undefined ? (
            <InteractiveMetricCard
              href="/tasks"
              onNavigate={onNavigateToTasks}
              regionLabel="Tasks overview summary"
              title="Tasks Overview"
              primaryValue={metrics.tasks.TotalTasks}
              primaryLabel="Total Tasks"
              rows={[
                { label: 'In Progress', value: metrics.tasks.InProgressTasks || 0, highlight: metrics.tasks.InProgressTasks > 0 ? 'warn' : undefined },
                { label: 'Due Today', value: metrics.tasks.TasksDueToday || 0, highlight: metrics.tasks.TasksDueToday > 0 ? 'warn' : undefined },
                { label: 'Overdue', value: metrics.tasks.OverdueTasks || 0, highlight: metrics.tasks.OverdueTasks > 0 ? 'danger' : undefined },
                { label: 'High Priority', value: metrics.tasks.HighPriorityTasks || 0, highlight: metrics.tasks.HighPriorityTasks > 0 ? 'danger' : undefined },
              ]}
              Icon={ListTodo}
              colorScheme={{
                card: 'bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-800',
                title: 'text-emerald-800 dark:text-emerald-200',
                icon: 'text-emerald-600 dark:text-emerald-400',
                badge: 'bg-emerald-200 dark:bg-emerald-800',
                primary: 'text-emerald-900 dark:text-emerald-100',
                row: 'text-emerald-700 dark:text-emerald-300',
                viewAll: 'text-emerald-700 dark:text-emerald-300',
              }}
            />
          ) : (
            <div className="rounded-xl shadow-lg border bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-800 min-h-[180px] flex items-center justify-center">
              <EmptyState message="No tasks data available." />
            </div>
          )
        )}

      </div>
    </section>
  );
};


// ---------------------------------------------------------------------------
// DashboardAlertsComponent
// ---------------------------------------------------------------------------

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

  const hasAnyAlerts = useMemo(() => {
    if (!alerts) return false;
    return (canViewLeadAlerts && (alerts.critical > 0 || alerts.urgent > 0)) ||
      (canViewPurchaseAlerts && alerts.pendingApprovals > 0);
  }, [alerts, canViewLeadAlerts, canViewPurchaseAlerts]);

  return (
    <section aria-labelledby="alerts-heading" className="py-2 md:py-6 mt-10">
      <h2
        id="alerts-heading"
        className="text-xl md:text-3xl font-bold text-gray-900 dark:text-white mb-6"
      >
        Dashboard Alerts
      </h2>

      {/* Live region announces changes to screen readers without interrupting */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {!isFetching && hasAnyAlerts &&
          `${alerts.critical} critical alerts, ${alerts.urgent} urgent reminders, ${alerts.pendingApprovals} pending approvals.`
        }
        {!isFetching && !hasAnyAlerts && 'No active alerts.'}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
        {isFetching ? (
          <div className="col-span-full">
            <LoadingState label="Loading alerts" />
          </div>
        ) : !hasAnyAlerts ? (
          <div className="col-span-full">
            <EmptyState message="No active alerts." />
          </div>
        ) : (
          <>
            {canViewLeadAlerts && alerts?.critical > 0 && (
              /* role="alert" ensures critical info is announced immediately */
              <article
                role="alert"
                aria-label={`${alerts.critical} critical overdue lead${alerts.critical !== 1 ? 's' : ''}`}
                className="rounded-xl py-4 shadow-lg border bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-800 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-red-500"
              >
                <div className="flex flex-row items-center justify-between space-y-0 pb-2 px-6 pt-2">
                  <h3 className="text-xl font-medium text-red-900 dark:text-red-100">Critical Alerts</h3>
                  <AlertCircle className="h-6 w-6 text-red-700 dark:text-red-300 flex-shrink-0" aria-hidden="true" />
                </div>
                <div className="px-6 pb-4">
                  <dl>
                    <div>
                      <dd className="text-4xl font-bold text-red-900 dark:text-red-100 tabular-nums">{alerts.critical}</dd>
                      <dt className="text-sm text-red-700 dark:text-red-200 mt-1">Overdue Leads</dt>
                    </div>
                  </dl>
                  {alerts.details.criticalOverdueLeads?.[0] && (
                    <p className="text-xs text-red-600 dark:text-red-300 mt-2" aria-label={`Example: ${alerts.details.criticalOverdueLeads[0].clientName}, ${alerts.details.criticalOverdueLeads[0].daysPastDue} days overdue`}>
                      Ex: {alerts.details.criticalOverdueLeads[0].clientName} ({alerts.details.criticalOverdueLeads[0].daysPastDue} days overdue)
                    </p>
                  )}
                </div>
              </article>
            )}

            {canViewLeadAlerts && alerts?.urgent > 0 && (
              <article
                aria-label={`${alerts.urgent} urgent reminder${alerts.urgent !== 1 ? 's' : ''}`}
                className="rounded-xl py-4 shadow-lg border bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-800 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-orange-500"
              >
                <div className="flex flex-row items-center justify-between space-y-0 pb-2 px-6 pt-2">
                  <h3 className="text-xl font-medium text-orange-900 dark:text-orange-100">Urgent Reminders</h3>
                  <Clock className="h-6 w-6 text-orange-700 dark:text-orange-300 flex-shrink-0" aria-hidden="true" />
                </div>
                <div className="px-6 pb-4">
                  <dl>
                    <div>
                      <dd className="text-4xl font-bold text-orange-900 dark:text-orange-100 tabular-nums">{alerts.urgent}</dd>
                      <dt className="text-sm text-orange-700 dark:text-orange-200 mt-1">Reminders due today</dt>
                    </div>
                  </dl>
                  {alerts.details.urgentReminders?.[0] && (
                    <p className="text-xs text-orange-600 dark:text-orange-300 mt-2">
                      Ex: {alerts.details.urgentReminders[0].clientName} (Today)
                    </p>
                  )}
                </div>
              </article>
            )}

            {canViewPurchaseAlerts && alerts?.pendingApprovals > 0 && (
              <article
                aria-label={`${alerts.pendingApprovals} purchase order${alerts.pendingApprovals !== 1 ? 's' : ''} awaiting approval`}
                className="rounded-xl py-4 shadow-lg border bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-800 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-yellow-500"
              >
                <div className="flex flex-row items-center justify-between space-y-0 pb-2 px-6 pt-2">
                  <h3 className="text-xl font-medium text-yellow-900 dark:text-yellow-100">Pending Approvals</h3>
                  <ShoppingCart className="h-6 w-6 text-yellow-700 dark:text-yellow-300 shrink-0" aria-hidden="true" />
                </div>
                <div className="px-6 pb-4">
                  <dl>
                    <div>
                      <dd className="text-4xl font-bold text-yellow-900 dark:text-yellow-100 tabular-nums">{alerts.pendingApprovals}</dd>
                      <dt className="text-sm text-yellow-700 dark:text-yellow-200 mt-1">Purchase orders awaiting approval</dt>
                    </div>
                  </dl>
                  {alerts.details.pendingApprovals?.[0] && (
                    <p className="text-xs text-yellow-600 dark:text-yellow-300 mt-2">
                      Ex: PO-{alerts.details.pendingApprovals[0].purchaseNo} ({alerts.details.pendingApprovals[0].hoursPending} hrs pending)
                    </p>
                  )}
                </div>
              </article>
            )}
          </>
        )}
      </div>
    </section>
  );
};

interface TrendItem {
  _id: string;
  count: number;
}


// ---------------------------------------------------------------------------
// DashboardTrendsComponent
// ---------------------------------------------------------------------------

const DashboardTrendsComponent: React.FC<{
  trends: DashboardTrendsData | null;
  isFetching: boolean;
  userRole: string;
}> = ({ trends, isFetching, userRole }) => {

  const allowedRolesForTrends = useMemo(() => ['super-admin', 'sales', 'operations', 'accountant', 'viewer'], []);
  const canViewTrends = allowedRolesForTrends.includes(userRole);

  if (!canViewTrends) return null;

  const getTrendMeta = (value: string | undefined, currentData: TrendItem[]) => {
    if (isFetching) return { Icon: Loader2, color: 'text-gray-500 dark:text-gray-400', label: 'loading' };

    if (typeof value === 'string' && value.includes('%')) {
      const pct = parseFloat(value);
      if (!isNaN(pct)) {
        return pct >= 0
          ? { Icon: TrendingUp, color: 'text-green-700 dark:text-green-400', label: 'upward trend' }
          : { Icon: TrendingDown, color: 'text-red-700 dark:text-red-400', label: 'downward trend' };
      }
    }

    if (Array.isArray(currentData) && currentData.length > 1) {
      const last = currentData[currentData.length - 1].count;
      const prev = currentData.slice(Math.max(0, currentData.length - 7), -1);
      const avg = prev.length > 0 ? prev.reduce((s, i) => s + i.count, 0) / prev.length : 0;
      if (last > avg) return { Icon: TrendingUp, color: 'text-green-700 dark:text-green-400', label: 'upward trend' };
      if (last < avg && avg > 0) return { Icon: TrendingDown, color: 'text-red-700 dark:text-red-400', label: 'downward trend' };
    }

    return { Icon: TrendingUp, color: 'text-gray-500 dark:text-gray-400', label: 'stable trend' };
  };

  const hasTrendData = useMemo(() => {
    if (!trends) return false;
    return (trends.trends.leads?.length > 0) ||
      (trends.trends.orders?.length > 0) ||
      (trends.trends.purchases?.length > 0);
  }, [trends]);

  /** Format daily data as accessible text */
  const formatDailyBreakdown = (items: TrendItem[]) =>
    items.map(t => `${t._id.substring(5)}: ${t.count}`).join(', ') || 'N/A';

  return (
    <section aria-labelledby="trends-heading" className="py-2 md:py-6 mt-10">
      <h2
        id="trends-heading"
        className="text-xl md:text-3xl font-bold text-gray-900 dark:text-white mb-6"
      >
        7-Day Business Trends
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
        {isFetching ? (
          <div className="col-span-full"><LoadingState label="Loading trends" /></div>
        ) : !hasTrendData ? (
          <div className="col-span-full"><EmptyState message="No trend data available." /></div>
        ) : (
          <>
            {trends?.trends?.leads && trends.trends.leads.length > 0 && (() => {
              const meta = getTrendMeta(trends.growth.leadsWeekOverWeek, trends.trends.leads);
              const total = trends.trends.leads.reduce((s, i) => s + i.count, 0);
              return (
                <article
                  aria-label={`Leads trend: ${trends.growth.leadsWeekOverWeek || total + ' total'}, ${meta.label}`}
                  className="rounded-xl py-4 shadow-lg border bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-950 dark:to-teal-800 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-teal-500"
                >
                  <div className="flex flex-row items-center justify-between space-y-0 pb-2 px-6 pt-2">
                    <h3 className="text-xl font-medium text-teal-800 dark:text-teal-200">Leads Trend</h3>
                    <meta.Icon className={`h-6 w-6 ${meta.color} flex-shrink-0`} aria-hidden="true" />
                  </div>
                  <div className="px-6 pb-4">
                    <dl>
                      <div>
                        <dd className={`text-4xl font-bold ${meta.color} tabular-nums`}>
                          {trends.growth.leadsWeekOverWeek || 'N/A'}
                        </dd>
                        <dt className="text-sm text-teal-600 dark:text-teal-300 mt-1">
                          {trends.growth.period || 'Week over week'}
                        </dt>
                      </div>
                    </dl>
                    <p
                      className="text-xs text-teal-500 dark:text-teal-400 mt-2"
                      aria-label={`Daily breakdown: ${formatDailyBreakdown(trends.trends.leads)}`}
                    >
                      Daily: {formatDailyBreakdown(trends.trends.leads)}
                    </p>
                  </div>
                </article>
              );
            })()}

            {trends?.trends?.orders && trends.trends.orders.length > 0 && (() => {
              const meta = getTrendMeta(undefined, trends.trends.orders);
              const total = trends.trends.orders.reduce((s, i) => s + i.count, 0);
              return (
                <article
                  aria-label={`Orders trend: ${total} total past 7 days, ${meta.label}`}
                  className="rounded-xl py-4 shadow-lg border bg-gradient-to-br from-lime-50 to-lime-100 dark:from-lime-950 dark:to-lime-800 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-lime-500"
                >
                  <div className="flex flex-row items-center justify-between space-y-0 pb-2 px-6 pt-2">
                    <h3 className="text-xl font-medium text-lime-800 dark:text-lime-200">Orders Trend</h3>
                    <meta.Icon className={`h-6 w-6 ${meta.color} flex-shrink-0`} aria-hidden="true" />
                  </div>
                  <div className="px-6 pb-4">
                    <dl>
                      <div>
                        <dd className={`text-4xl font-bold ${meta.color} tabular-nums`}>{total}</dd>
                        <dt className="text-sm text-lime-600 dark:text-lime-300 mt-1">Total orders past 7 days</dt>
                      </div>
                    </dl>
                    <p
                      className="text-xs text-lime-500 dark:text-lime-400 mt-2"
                      aria-label={`Daily breakdown: ${formatDailyBreakdown(trends.trends.orders)}`}
                    >
                      Daily: {formatDailyBreakdown(trends.trends.orders)}
                    </p>
                  </div>
                </article>
              );
            })()}

            {trends?.trends?.purchases && trends.trends.purchases.length > 0 && (() => {
              const meta = getTrendMeta(undefined, trends.trends.purchases);
              const total = trends.trends.purchases.reduce((s, i) => s + i.count, 0);
              return (
                <article
                  aria-label={`Purchases trend: ${total} total past 7 days, ${meta.label}`}
                  className="rounded-xl py-4 shadow-lg border bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950 dark:to-cyan-800 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-cyan-500"
                >
                  <div className="flex flex-row items-center justify-between space-y-0 pb-2 px-6 pt-2">
                    <h3 className="text-xl font-medium text-cyan-800 dark:text-cyan-200">Purchases Trend</h3>
                    <meta.Icon className={`h-6 w-6 ${meta.color} flex-shrink-0`} aria-hidden="true" />
                  </div>
                  <div className="px-6 pb-4">
                    <dl>
                      <div>
                        <dd className={`text-4xl font-bold ${meta.color} tabular-nums`}>{total}</dd>
                        <dt className="text-sm text-cyan-600 dark:text-cyan-300 mt-1">Total purchases past 7 days</dt>
                      </div>
                    </dl>
                    <p
                      className="text-xs text-cyan-500 dark:text-cyan-400 mt-2"
                      aria-label={`Daily breakdown: ${formatDailyBreakdown(trends.trends.purchases)}`}
                    >
                      Daily: {formatDailyBreakdown(trends.trends.purchases)}
                    </p>
                  </div>
                </article>
              );
            })()}
          </>
        )}
      </div>
    </section>
  );
};


// ---------------------------------------------------------------------------
// DashboardHealthComponent
// ---------------------------------------------------------------------------

const DashboardHealthComponent: React.FC<{
  health: DashboardHealthData | null;
  isFetching: boolean;
  userRole: string;
}> = ({ health, isFetching, userRole }) => {
  const allowedRolesForHealth = useMemo(() => ['super-admin', 'operations', 'viewer'], []);
  const canViewHealth = allowedRolesForHealth.includes(userRole);

  if (!canViewHealth) return null;

  const getStatusColor = (status: string | undefined) => {
    if (status === 'Healthy' || status === 'Connected') return 'text-green-700 dark:text-green-400';
    if (status === 'Unhealthy' || status === 'Disconnected') return 'text-red-700 dark:text-red-400';
    return 'text-gray-500 dark:text-gray-400';
  };

  const formatUptime = (seconds: number | undefined) => {
    if (seconds === undefined || seconds < 0) return 'N/A';
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days} days, ${hours} hours, ${minutes} minutes`;
  };

  const hasHealthData = useMemo(() => health && health.status !== undefined, [health]);

  return (
    <section aria-labelledby="health-heading" className="py-2 md:py-6 mt-10">
      <h2
        id="health-heading"
        className="text-xl md:text-3xl font-bold text-gray-900 dark:text-white mb-6"
      >
        System Health Check
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
        {isFetching ? (
          <div className="col-span-full"><LoadingState label="Checking system health" /></div>
        ) : !hasHealthData ? (
          <div className="col-span-full"><EmptyState message="Health data not available." /></div>
        ) : (
          <article
            aria-label={`System status: ${health?.status || 'unknown'}. Database: ${health?.database || 'unknown'}.`}
            className="rounded-xl py-4 shadow-lg border bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-800 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-green-500"
          >
            <div className="flex flex-row items-center justify-between space-y-0 pb-2 px-6 pt-2">
              <h3 className="text-xl font-medium text-green-800 dark:text-green-200">System Status</h3>
              <HeartPulse
                className={`h-6 w-6 ${getStatusColor(health?.status)} flex-shrink-0`}
                aria-hidden="true"
              />
            </div>
            <div className="px-6 pb-4">
              <dl>
                <div>
                  <dd className={`text-4xl font-bold ${getStatusColor(health?.status)}`}>
                    {health?.status || 'N/A'}
                  </dd>
                </div>
                <div className="mt-1">
                  <dt className="text-sm text-green-600 dark:text-green-300 inline">Database: </dt>
                  <dd className={`text-sm inline font-semibold ${getStatusColor(health?.database)}`}>
                    {health?.database || 'N/A'}
                  </dd>
                </div>
                <div className="mt-1">
                  <dt className="text-sm text-green-600 dark:text-green-300 inline">Uptime: </dt>
                  <dd className="text-sm text-green-600 dark:text-green-300 inline font-semibold">
                    {formatUptime(health?.uptime)}
                  </dd>
                </div>
              </dl>
            </div>
          </article>
        )}
      </div>
    </section>
  );
};


// ---------------------------------------------------------------------------
// Main Dashboard Page
// ---------------------------------------------------------------------------

function App() {
  const { showLoader, hideLoader } = useLoading();
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const role = usePermissionStore(s => s.role);

  // Map Clerk user to legacy shape for sub-components if needed
  const user = useMemo(() => {
    if (!clerkUser) return null;
    return {
      id: clerkUser.id,
      name: clerkUser.fullName || clerkUser.username || 'User',
      email: clerkUser.primaryEmailAddress?.emailAddress || '',
      role: role || (clerkUser.publicMetadata?.role as string) || 'sales',
    };
  }, [clerkUser, role]);

  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetricsData | null>(null);
  const [dashboardAlerts, setDashboardAlerts] = useState<DashboardAlertsData | null>(null);
  const [dashboardTrends, setDashboardTrends] = useState<DashboardTrendsData | null>(null);
  const [dashboardHealth, setDashboardHealth] = useState<DashboardHealthData | null>(null);

  const [isFetchingMetrics, setIsFetchingMetrics] = useState(false);
  const [isFetchingAlerts, setIsFetchingAlerts] = useState(false);
  const [isFetchingTrends, setIsFetchingTrends] = useState(false);
  const [isFetchingHealth, setIsFetchingHealth] = useState(false);

  const router = useRouter();

  // Skip-to-content focus target
  const mainRef = useRef<HTMLElement>(null);

  const fetchAllDashboardData = useCallback(async () => {
    setIsFetchingMetrics(true);
    setIsFetchingAlerts(true);
    setIsFetchingTrends(true);
    setIsFetchingHealth(true);

    showLoader({ title: 'Refreshing Dashboard', subtitle: 'Loading latest data…', showProgress: false, blurEffect: true });

    try {
      const results = await Promise.allSettled([
        dashboardApi.fetchDashboardMetrics(),
        dashboardApi.fetchDashboardAlerts(),
        dashboardApi.fetchDashboardTrends(),
        dashboardApi.fetchDashboardHealth(),
      ]);

      const [metrics, alerts, trends, health] = results;

      // Handle individual results to allow partial success (Error Healing)
      // Only update state if fulfilled and NOT null (null means request was cancelled)
      if (metrics.status === 'fulfilled' && metrics.value !== null) {
        setDashboardMetrics(metrics.value);
      } else if (metrics.status === 'rejected') {
        console.error('[Dashboard] Metrics fetch failed:', metrics.reason);
      }

      if (alerts.status === 'fulfilled' && alerts.value !== null) {
        setDashboardAlerts(alerts.value);
      } else if (alerts.status === 'rejected') {
        console.error('[Dashboard] Alerts fetch failed:', alerts.reason);
      }

      if (trends.status === 'fulfilled' && trends.value !== null) {
        setDashboardTrends(trends.value);
      } else if (trends.status === 'rejected') {
        console.error('[Dashboard] Trends fetch failed:', trends.reason);
      }

      if (health.status === 'fulfilled' && health.value !== null) {
        setDashboardHealth(health.value);
      } else if (health.status === 'rejected') {
        console.error('[Dashboard] Health fetch failed:', health.reason);
      }

      // Granular feedback
      // We only consider it a "failure" for the toast if it was rejected
      // (Cancellation 'null' is not a user-facing error)
      const rejected = results.filter((r) => r.status === 'rejected');
      const fulfilled = results.filter((r) => r.status === 'fulfilled' && r.value !== null);

      if (rejected.length === 0) {
        if (fulfilled.length > 0) {
          toast.success('Dashboard data updated!');
        }
        // If all were null (cancelled), we stay silent
      } else if (rejected.length < results.length) {
        toast.warning('Dashboard partially updated', {
          description: `Successfully loaded ${results.length - rejected.length} sections, but ${rejected.length} failed.`,
        });
      } else {
        toast.error('Failed to load dashboard data', {
          description: 'Please check your connection or contact support if the issue persists.',
        });
      }
    } catch (error: any) {
      console.error('[Dashboard] Unexpected error in fetchAllDashboardData:', error);
      toast.error('An unexpected error occurred while refreshing the dashboard.');
    } finally {
      setIsFetchingMetrics(false);
      setIsFetchingAlerts(false);
      setIsFetchingTrends(false);
      setIsFetchingHealth(false);
      hideLoader();
    }
  }, [showLoader, hideLoader]);

  useEffect(() => {
    if (clerkLoaded && clerkUser) {
      fetchAllDashboardData();
    }
  }, [clerkLoaded, clerkUser, fetchAllDashboardData]);

  const canViewOrdersNav = useMemo(() => user?.role ? !['purchase-entry'].includes(user.role) : false, [user?.role]);
  const canViewPurchasesNav = useMemo(() => user?.role ? !['sales'].includes(user.role) : false, [user?.role]);
  const canViewLeadsNav = useMemo(() => user?.role ? ['super-admin', 'sales', 'operations', 'viewer'].includes(user.role) : false, [user?.role]);


  // Use router.push for proper client-side navigation (better than window.location.href)
  const navigateToOrders = useCallback(() => router.push('/orders'), [router]);
  const navigateToPurchases = useCallback(() => router.push('/purchases'), [router]);
  const navigateToLeads = useCallback(() => router.push('/leads'), [router]);

  if (!clerkLoaded) return null;
  if (!clerkUser) return null;


  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white font-sans">
      {/*
        -----------------------------------------------------------------------
        Skip navigation link – WCAG 2.4.1 (Bypass Blocks)
        Visible only on focus; lets keyboard/screen-reader users skip the navbar.
        -----------------------------------------------------------------------
      */}
      <NavbarExtension>
        <NavButton
          type="refresh"
          onClick={fetchAllDashboardData}
          isLoading={isFetchingMetrics}
        />
      </NavbarExtension>

      {/*
        id="main-content" is the skip-link target.
        tabIndex={-1} allows programmatic focus without visual outline.
      */}
      <main
        id="main-content"
        ref={mainRef}
        tabIndex={-1}
        aria-label="Dashboard"
        className="max-w-8xl mx-auto px-4 py-6 sm:px-6 md:p-6 lg:p-8 focus:outline-none"
      >
        {/* ----------------------------------------------------------------- */}
        {/* Quick Navigation                                                   */}
        {/* ----------------------------------------------------------------- */}
        <section aria-labelledby="quick-nav-heading" className="mt-6">
          <h2
            id="quick-nav-heading"
            className="text-xl md:text-3xl font-bold text-gray-900 dark:text-white mb-6"
          >
            Quick Navigation
          </h2>

          {/* nav landmark so screen-readers can jump to it directly */}
          <nav aria-label="Quick navigation links">
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 list-none p-0 m-0">
              {canViewOrdersNav && (
                <li>
                  <NavigationCard
                    title="Manage Orders"
                    description="View, create, and manage all customer orders."
                    Icon={Briefcase}
                    onClick={navigateToOrders}
                    colorScheme={{
                      card: 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-800',
                      title: 'text-blue-800 dark:text-blue-200',
                      icon: 'text-blue-600 dark:text-blue-400',
                      desc: 'text-blue-600 dark:text-blue-300',
                    }}
                  />
                </li>
              )}

              {canViewPurchasesNav && (
                <li>
                  <NavigationCard
                    title="Manage Purchases"
                    description="Track and manage all procurement and purchase orders."
                    Icon={ShoppingCart}
                    onClick={navigateToPurchases}
                    colorScheme={{
                      card: 'bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-800',
                      title: 'text-purple-800 dark:text-purple-200',
                      icon: 'text-purple-600 dark:text-purple-400',
                      desc: 'text-purple-600 dark:text-purple-300',
                    }}
                  />
                </li>
              )}

              {canViewLeadsNav && (
                <li>
                  <NavigationCard
                    title="Manage Leads"
                    description="View, create, and manage all potential customer leads."
                    Icon={Target}
                    onClick={navigateToLeads}
                    colorScheme={{
                      card: 'bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950 dark:to-indigo-800',
                      title: 'text-indigo-800 dark:text-indigo-200',
                      icon: 'text-indigo-600 dark:text-indigo-400',
                      desc: 'text-indigo-600 dark:text-indigo-300',
                    }}
                  />
                </li>
              )}
            </ul>
          </nav>
        </section>

        <hr className="my-8 border-gray-200 dark:border-gray-700" aria-hidden="true" />

        {/* ----------------------------------------------------------------- */}
        {/* Role-gated dashboard sections                                       */}
        {/* ----------------------------------------------------------------- */}
        {user?.role && (
          <>
            <DashboardMetricsComponent
              metrics={dashboardMetrics}
              isFetching={isFetchingMetrics}
              userRole={user.role}
              onNavigateToLeads={navigateToLeads}
              onNavigateToOrders={navigateToOrders}
              onNavigateToPurchases={navigateToPurchases}
              onNavigateToTasks={() => router.push('/tasks')}
            />

            <hr className="my-8 border-gray-200 dark:border-gray-700" aria-hidden="true" />

            {dashboardAlerts && (
              <DashboardAlertsComponent
                alerts={dashboardAlerts}
                isFetching={isFetchingAlerts}
                userRole={user.role}
                userEmail={user.email}
              />
            )}

            <hr className="my-8 border-gray-200 dark:border-gray-700" aria-hidden="true" />

            <DashboardTrendsComponent
              trends={dashboardTrends}
              isFetching={isFetchingTrends}
              userRole={user.role}
            />

            <hr className="my-8 border-gray-200 dark:border-gray-700" aria-hidden="true" />

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