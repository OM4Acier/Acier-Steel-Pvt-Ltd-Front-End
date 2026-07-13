"use client"
import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { RefreshCcw, Building, TrendingUp, AlertTriangle, User, Star, CalendarIcon, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar as BasicCalendar } from '@/components/ui/basic-calendar';
import { useUser } from '@clerk/react';
import { NavbarExtension } from '@/context/NavbarExtensionContext';
import { NavButton } from '@/components/NavButton';

import { reportsApi } from '@/lib/api/endpoints/reportsApi';
import { ReportData } from '@/types/reports.types';

// Helper to get styling class for productivity score
const getScoreClass = (score: number) => {
  if (score >= 80) return 'text-green-500 font-bold';
  if (score >= 50) return 'text-blue-500';
  if (score >= 20) return 'text-yellow-500';
  return 'text-red-500 font-bold';
};

export default function ReportPage() {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [searchUserId, setSearchUserId] = useState<string>('');
  const [currentUserIdFilter, setCurrentUserIdFilter] = useState<string>(''); // Actual filter applied after search

  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();

  // Function to fetch daily report data
  const fetchDailyReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    setReportData(null); // Clear previous data
    
    // toast.message is better for non-error notifications
    toast.info('Fetching Report...', {
      description: 'Please wait while we retrieve the latest data.',
    });

    try {
      const formattedDate = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
      
      const result = await reportsApi.getDailyReport(formattedDate, currentUserIdFilter || undefined);

      if (result.success) {
        setReportData(result.data);
        toast.success('Report Loaded Successfully', {
          description: `Data for ${formattedDate} loaded.`,
        });
      } else {
        const errorMessage = result.error || 'Failed to fetch report.';
        setError(errorMessage);
        toast.error('Error Loading Report', { description: errorMessage });
      }
    } catch (err: any) {
      if (err.message === 'Request cancelled') return;
      console.error('API Error:', err);
      setError(err.message || 'A network error occurred. Please try again.');
      toast.error('Network Error', {
        description: 'Could not connect to the API. Check your internet connection.',
      });
    } finally {
      setLoading(false);
    }
  }, [selectedDate, currentUserIdFilter]);


  const handleRefresh = () => {
    fetchDailyReport();
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentUserIdFilter(searchUserId); // Apply filter on search submit
  };

  // Calculate Daily KPIs
  const dailyCompletionRate = reportData && reportData.organizationMetrics.daily.newLeads > 0
    ? ((reportData.organizationMetrics.daily.completed / reportData.organizationMetrics.daily.newLeads) * 100).toFixed(1)
    : '0.0';
  const dailyFollowUpCompliance = reportData && (reportData.organizationMetrics.daily.remindersToday + reportData.organizationMetrics.daily.overdue) > 0
    ? ((reportData.organizationMetrics.daily.remindersToday / (reportData.organizationMetrics.daily.remindersToday + reportData.organizationMetrics.daily.overdue)) * 100).toFixed(1)
    : '0.0';

    
  useEffect(() => {
    if (clerkLoaded && clerkUser) {
      fetchDailyReport();
    }
  }, [clerkUser, clerkLoaded, fetchDailyReport]);


  return (
    <div className="min-h-screen bg-gray-50 ">
      <NavbarExtension >
          <NavButton
                  type="refresh"
                  onClick={handleRefresh}
                  isLoading={loading}
                />
      
      </NavbarExtension>


      {loading && (
        <Card className="mb-6 border-blue-400 border-2 bg-blue-50 shadow-lg animate-pulse rounded-xl">
          <CardContent className="p-4 flex items-center justify-center text-blue-700 text-lg font-medium">
            <RefreshCcw className="animate-spin mr-2" /> Loading Report Data...
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="mb-6 border-red-400 border-2 bg-red-50 shadow-lg rounded-xl">
          <CardHeader>
            <CardTitle className="text-red-700">Error</CardTitle>
            <CardDescription className="text-red-600">Failed to load report.</CardDescription>
          </CardHeader>
          <CardContent className="text-red-800">
            <p>{error}</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && !reportData && (
        <Card className="mb-6 border-gray-400 border-2 bg-gray-50 shadow-lg rounded-xl">
          <CardContent className="p-6 text-center text-gray-600 text-lg">
            No report data available for the selected date. Please select a date or refresh.
          </CardContent>
        </Card>
      )}
      <main className="max-w-7xl mx-auto px-[2px] py-6 md:px-6 mt-6">
        <div className="bg-white rounded-xl shadow-md p-4  mb-6 flex flex-col sm:flex-row items-center justify-end gap-4">

          {/* Centralized Actions */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            {/* Date Picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={'outline'}
                  className="w-full sm:w-[240px] justify-start text-left font-normal rounded-lg shadow-sm"
                >
                  <CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
                  {selectedDate ? format(selectedDate, 'PPP') : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <BasicCalendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {/* User Search Input */}
            <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-auto">
              <Input
                type="text"
                placeholder="Search by User ID (Super Admin)"
                value={searchUserId}
                onChange={(e) => setSearchUserId(e.target.value)}
                className="pl-9 pr-2 py-2 rounded-lg shadow-sm"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              {/* Hidden submit button for form submission on enter */}
              <button type="submit" className="hidden" aria-label="Search"></button>
            </form>
          </div>
        </div>
        {reportData && (
          <div className="space-y-6">
            {/* Organization Metrics */}
            <Card className="rounded-xl shadow-lg p-4">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xl font-semibold flex items-center gap-2">
                  <Building className="w-5 h-5 text-gray-600" /> Organization Overview
                </CardTitle>
                <CardDescription className="text-sm text-gray-500">
                  Report Date: {reportData.reportDate} | Generated At: {new Date(reportData.generatedAt).toLocaleTimeString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                  <Card className="p-4 bg-blue-50 border-blue-200 rounded-lg">
                    <CardTitle className="text-lg font-medium text-blue-800">Total Users</CardTitle>
                    <CardDescription className="text-3xl font-bold text-blue-900 mt-2">
                      {reportData.organizationMetrics.daily.totalUsers}
                    </CardDescription>
                  </Card>
                  <Card className="p-4 bg-purple-50 border-purple-200 rounded-lg">
                    <CardTitle className="text-lg font-medium text-purple-800">Active Users (Daily)</CardTitle>
                    <CardDescription className="text-3xl font-bold text-purple-900 mt-2">
                      {reportData.organizationMetrics.daily.activeUsers}
                    </CardDescription>
                  </Card>
                  <Card className="p-4 bg-blue-50 border-blue-200 rounded-lg">
                    <CardTitle className="text-lg font-medium text-blue-800">New Leads (Daily)</CardTitle>
                    <CardDescription className="text-3xl font-bold text-blue-900 mt-2">
                      {reportData.organizationMetrics.daily.newLeads}
                    </CardDescription>
                  </Card>
                  <Card className="p-4 bg-green-50 border-green-200 rounded-lg">
                    <CardTitle className="text-lg font-medium text-green-800">Completed (Daily)</CardTitle>
                    <CardDescription className="text-3xl font-bold text-green-900 mt-2">
                      {reportData.organizationMetrics.daily.completed}
                    </CardDescription>
                  </Card>
                  <Card className="p-4 bg-yellow-50 border-yellow-200 rounded-lg">
                    <CardTitle className="text-lg font-medium text-yellow-800">Reminders (Daily)</CardTitle>
                    <CardDescription className="text-3xl font-bold text-yellow-900 mt-2">
                      {reportData.organizationMetrics.daily.remindersToday}
                    </CardDescription>
                  </Card>
                  <Card className="p-4 bg-red-50 border-red-200 rounded-lg">
                    <CardTitle className="text-lg font-medium text-red-800">Overdue (Daily)</CardTitle>
                    <CardDescription className="text-3xl font-bold text-red-900 mt-2">
                      {reportData.organizationMetrics.daily.overdue}
                    </CardDescription>
                  </Card>
                </div>
              </CardContent>
            </Card>

            {/* Key Performance Indicators */}
            <Card className="rounded-xl shadow-lg p-4">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xl font-semibold flex items-center gap-2">
                  <Star className="w-5 h-5 text-gray-600" /> Key Performance Indicators
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                  <Card className="p-4 bg-indigo-50 border-indigo-200 rounded-lg">
                    <CardTitle className="text-lg font-medium text-indigo-800">Daily Completion Rate</CardTitle>
                    <CardDescription className="text-3xl font-bold text-indigo-900 mt-2">
                      {dailyCompletionRate}%
                    </CardDescription>
                  </Card>
                  <Card className="p-4 bg-cyan-50 border-cyan-200 rounded-lg">
                    <CardTitle className="text-lg font-medium text-cyan-800">Daily Follow-up Compliance</CardTitle>
                    <CardDescription className="text-3xl font-bold text-cyan-900 mt-2">
                      {dailyFollowUpCompliance}%
                    </CardDescription>
                  </Card>
                </div>
              </CardContent>
            </Card>


            {/* Business Intelligence Insights & Trends */}
            <Card className="rounded-xl shadow-lg p-4">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xl font-semibold flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-gray-600" /> Business Insights & Trends
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold text-lg text-gray-700 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-600" /> Alerts
                  </h3>
                  <ul className="list-disc list-inside text-gray-600 space-y-1">
                    {reportData.insights.alerts.highOverdue > 0 && (
                      <li className="text-red-600">
                        <strong>{reportData.insights.alerts.highOverdue} users</strong> with high overdue items!
                      </li>
                    )}
                    {reportData.insights.alerts.lowProductivity > 0 && (
                      <li className="text-orange-600">
                        <strong>{reportData.insights.alerts.lowProductivity} users</strong> with low productivity.
                      </li>
                    )}
                    {reportData.insights.alerts.excellentPerformance > 0 && (
                      <li className="text-green-600">
                        <strong>{reportData.insights.alerts.excellentPerformance} users</strong> showing excellent performance!
                      </li>
                    )}
                    {reportData.insights.alerts.missedFollowUps > 0 && (
                      <li className="text-red-600">
                        <strong>{reportData.insights.alerts.missedFollowUps} total</strong> overdue follow-ups across organization.
                      </li>
                    )}
                    {reportData.insights.alerts.highOverdue === 0 && reportData.insights.alerts.lowProductivity === 0 && reportData.insights.alerts.excellentPerformance === 0 && reportData.insights.alerts.missedFollowUps === 0 && (
                      <li>No critical alerts today.</li>
                    )}
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-gray-700 mb-2 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-600" /> Daily Trends
                  </h3>
                  <ul className="list-disc list-inside text-gray-600 space-y-1">
                    <li>Daily Leads Velocity: <strong>{reportData.insights.trends.dailyVelocity.toFixed(2)}</strong> leads/active user</li>
                    <li>Completion Velocity: <strong>{reportData.insights.trends.completionVelocity.toFixed(2)}</strong> completions/active user</li>
                    <li>Estimated Monthly New Leads: <strong>{reportData.insights.trends.monthlyProjection.estimatedNewLeads.toLocaleString()}</strong></li>
                    <li>Estimated Monthly Completions: <strong>{reportData.insights.trends.monthlyProjection.estimatedCompletions.toLocaleString()}</strong></li>
                  </ul>
                </div>
                <div className="md:col-span-2">
                  <h3 className="font-semibold text-lg text-gray-700 mb-2 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-600" /> Recommendations
                  </h3>
                  {reportData.insights.recommendations.length > 0 ? (
                    <ul className="list-disc list-inside text-gray-600 space-y-1">
                      {reportData.insights.recommendations.map((rec, index) => (
                        <li key={index}>{rec}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500">No specific recommendations generated for today.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Top Performer Highlight */}
            {reportData.organizationMetrics.performance.topPerformer && (
              <Card className="rounded-xl shadow-lg bg-yellow-50 border-yellow-200 p-4">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xl font-semibold flex items-center gap-2 text-yellow-800">
                    <Star className="w-6 h-6 text-yellow-600 fill-yellow-600" /> Top Performer Today!
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4">
                  <div className="flex items-center gap-3">
                    <User className="w-10 h-10 text-yellow-700 bg-yellow-200 p-2 rounded-full" />
                    <div>
                      <p className="text-xl font-bold text-yellow-900">{reportData.organizationMetrics.performance.topPerformer.userName}</p>
                      <p className="text-md text-yellow-700">Productivity Score: <span className="font-bold">{reportData.organizationMetrics.performance.topPerformer.performanceMetrics.productivityScore.toFixed(0)}</span></p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-yellow-800 text-sm">
                    <p><span className="font-semibold">New Leads:</span> {reportData.organizationMetrics.performance.topPerformer.dailyMetrics.newLeads}</p>
                    <p><span className="font-semibold">Completed:</span> {reportData.organizationMetrics.performance.topPerformer.dailyMetrics.completed}</p>
                    <p><span className="font-semibold">Overdue:</span> {reportData.organizationMetrics.performance.topPerformer.dailyMetrics.overdueFollowUps}</p>
                    <p><span className="font-semibold">Conversion Rate (M):</span> {reportData.organizationMetrics.performance.topPerformer.monthlyMetrics.conversionRate.toFixed(1)}%</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* User Performance Table */}
            <Card className="rounded-xl shadow-lg p-4">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xl font-semibold flex items-center gap-2">
                  <User className="w-5 h-5 text-gray-600" /> Team Performance
                </CardTitle>
                <CardDescription className="text-sm text-gray-500">Ranked by Productivity Score</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table className="min-w-full">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rank</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Productivity Score</TableHead>
                        <TableHead>New Leads (Daily)</TableHead>
                        <TableHead>Completed (Daily)</TableHead>
                        <TableHead>Overdue (Daily)</TableHead>
                        <TableHead>Conv. Rate (Monthly)</TableHead>
                        <TableHead>Follow-up Compliance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.userReports.length > 0 ? (
                        reportData.userReports.map((user) => (
                          <TableRow key={user.userId}>
                            <TableCell className="font-medium">{user.rank}</TableCell>
                            <TableCell>{user.userName}</TableCell>
                            <TableCell>
                              <span className={`${getScoreClass(user.performanceMetrics.productivityScore)}`}>
                                {user.performanceMetrics.productivityScore.toFixed(0)}
                              </span>
                            </TableCell>
                            <TableCell>{user.dailyMetrics.newLeads}</TableCell>
                            <TableCell>{user.dailyMetrics.completed}</TableCell>
                            <TableCell className={user.dailyMetrics.overdueFollowUps > 0 ? 'text-red-600 font-bold' : ''}>
                              {user.dailyMetrics.overdueFollowUps}
                            </TableCell>
                            <TableCell>{user.monthlyMetrics.conversionRate.toFixed(1)}%</TableCell>
                            <TableCell>{user.performanceMetrics.followUpCompliance.toFixed(1)}%</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-gray-500 py-4">
                            No user performance data available.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

      </main>
    </div>
  );
}
