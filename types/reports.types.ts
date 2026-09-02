/**
 * types/reports.types.ts
 */

export interface UserReport {
  userId: string;
  userName: string;
  rank: number;
  dailyMetrics: {
    newLeads: number;
    completed: number;
    closed: number;
    remindersToday: number;
    upcomingTomorrow: number;
    overdueFollowUps: number;
  };
  monthlyMetrics: {
    newLeads: number;
    completed: number;
    activeLeads: number;
    conversionRate: number;
  };
  performanceMetrics: {
    totalLeads: number;
    highPriorityLeads: number;
    completionRate: number;
    avgDaysToComplete: number;
    avgActivitiesPerLead: number;
    productivityScore: number;
    followUpCompliance: number;
  };
  qualityMetrics: {
    fileUploadRate: number;
    engagementScore: number;
  };
}

export interface OrganizationMetrics {
  daily: {
    totalUsers: number;
    activeUsers: number;
    newLeads: number;
    completed: number;
    closed: number;
    remindersToday: number;
    upcomingTomorrow: number;
    overdue: number;
  };
  monthly: {
    totalNewLeads: number;
    totalCompleted: number;
    totalActiveLeads: number;
    avgConversionRate: number;
  };
  performance: {
    avgProductivityScore: number;
    avgCompletionRate: number;
    avgFollowUpCompliance: number;
    topPerformer: UserReport | null;
  };
}

export interface Insights {
  alerts: {
    highOverdue: number;
    lowProductivity: number;
    excellentPerformance: number;
    missedFollowUps: number;
  };
  trends: {
    dailyVelocity: number;
    completionVelocity: number;
    monthlyProjection: {
      estimatedNewLeads: number;
      estimatedCompletions: number;
      projectedRevenue: number;
    };
  };
  recommendations: string[];
}

export interface ReportData {
  reportDate: string;
  generatedAt: string;
  organizationMetrics: OrganizationMetrics;
  insights: Insights;
  userReports: UserReport[];
}

export interface ReportResponse {
  success: boolean;
  data: ReportData;
  error?: string;
}

/**
 * Date-range response shape for GET /api/reports/daily?start=&end=
 * `data` is keyed by IST date (YYYY-MM-DD). Each value is an array of
 * per-user report objects for that day. (Some backends return a single
 * object instead of an array — the page normalizes defensively.)
 */
export interface ReportRangeResponse {
  success: boolean;
  start: string;
  end: string;
  days: number;
  data: Record<string, ReportData[] | ReportData>;
  error?: string;
}
