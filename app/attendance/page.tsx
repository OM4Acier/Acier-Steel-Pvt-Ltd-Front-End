"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { toast } from 'sonner';
import {
  MapPin, LogIn, LogOut, Loader2,
  Target, Info, Map, AlertCircle, RefreshCw
} from 'lucide-react';

// Components & UI
import UniversalNavBar, { createSimplePageConfig, useNavbarState } from '@/components/NavBar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

// Context & Libs
import { useLoading } from '@/context/LoadingContext';
import { checkCloudAuth } from '@/lib/auth/checkCloudAuth';
import { UserProfile } from '@/types/rbac.types';
import { attendanceApi, AttendanceLocation, AttendanceStatus, GPSLocation } from '@/lib/api/attendanceApi';
import { auth } from '@/lib/auth';

/**
 * Minimalist GPS Metadata Display
 */
const GpsInformation = ({ accuracy, timestamp }: { accuracy?: number; timestamp?: string }) => {
  if (!accuracy && !timestamp) return null;

  return (
    <div className="flex items-center gap-6 pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
      <div className="flex items-center gap-2">
        <Target className="w-3.5 h-3.5 text-slate-400" />
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Accuracy</span>
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {accuracy ? `${accuracy.toFixed(1)}m` : '--'}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <MapPin className="w-3.5 h-3.5 text-slate-400" />
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Location Fix</span>
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default function AttendancePage() {
  const { showLoader, hideLoader } = useLoading();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [locations, setLocations] = useState<AttendanceLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [status, setStatus] = useState<Partial<AttendanceStatus> | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false); // New state for refresh button
  const [lastFix, setLastFix] = useState<{ accuracy?: number; timestamp?: string }>({});

  // System communication state
  const [systemMessage, setSystemMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const pathname = usePathname();
  const router = useRouter();
  const { searchTerm, setSearchTerm, isMenuOpen, setIsMenuOpen } = useNavbarState();

  const fetchConfigAndStatus = useCallback(async (token: string) => {
    setIsRefreshingStatus(true); // Start refreshing animation
    try {
      const config = await attendanceApi.getConfig(token);
      if (config?.locations) setLocations(config.locations);

      try {
        const currentStatus = await attendanceApi.getStatus(token);
        setStatus(currentStatus);
        // Map backend locationId if available
        if (currentStatus?.locationId) setSelectedLocationId(currentStatus.locationId);
      } catch (error: any) {
        console.warn("Status fetch failed:", error);
        setStatus({ status: "No Record" }); // Provide a default status to unblock buttons
        toast.error(`Failed to get current status: ${error.message}`);
      }
      toast.success('Configurations data updated!');
    } catch (error: any) {
      setSystemMessage("Uplink interruption: Could not sync configurations.");
      setIsError(true);
      toast.error(error.message || "Failed to load config data.");
    } finally {
      setIsRefreshingStatus(false); // End refreshing animation
    }
  }, []);


  useEffect(() => {
    const validateSession = async () => {
      // Show loading screen during authentication
      showLoader({
        title: "Loading",
        subtitle: "Authenticating...",
        showProgress: false,
        blurEffect: true,
      });
      try {
        const user = await checkCloudAuth();
        const fullUser: UserProfile = {
          ...user,
          accessToken: auth.getToken() || '',
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

        const local = auth.getCachedUser();
        const token = auth.getToken();

        if (!local || !token) {
          toast.error('Please login first');
          hideLoader();
          router.replace('/login?returnTo=' + encodeURIComponent(pathname));
          return;
        }

        try {
          const parsedUser: UserProfile = local;
          const fullUser: UserProfile = {
            ...parsedUser,
            accessToken: token
          };
          setUser(fullUser);

          const allowedRoles = ['super-admin', 'sales', 'operations', 'accountant', 'purchase-entry'];
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


  useEffect(() => {
    if (user?.accessToken) {
      fetchConfigAndStatus(user.accessToken);
    }
  }, [user?.accessToken, fetchConfigAndStatus]);

  const getCurrentPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("Location services unavailable on this device."));

      navigator.geolocation.getCurrentPosition(resolve, (error) => {
        let message = "GPS Error: ";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = "Access Denied. Please enable location permissions in your browser settings and try again.";
            break;
          case error.POSITION_UNAVAILABLE:
            message = "Satellite signal lost. Move to an open area.";
            break;
          case error.TIMEOUT:
            message = "GPS request timed out.";
            break;
          default:
            message = "An unknown location error occurred.";
        }
        reject(new Error(message));
      }, {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 0
      });
    });
  };

  const handleAttendance = async (type: 'login' | 'logout') => {
    if (!selectedLocationId) {
      setSystemMessage("Authorization failed: Please select a workspace terminal.");
      setIsError(true);
      return;
    }
    if (!user?.accessToken) return;

    // Reset messages
    setSystemMessage(null);
    setIsError(false);

    if (type === 'login') setIsLoggingIn(true);
    else setIsLoggingOut(true);

    try {
      const position = await getCurrentPosition();
      setLastFix({ accuracy: position.coords.accuracy, timestamp: new Date(position.timestamp).toISOString() });

      const gpsLocation: GPSLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: new Date(position.timestamp).toISOString()
      };

      const record = { locationId: selectedLocationId, location: gpsLocation };
      const result = type === 'login'
        ? await attendanceApi.login(user.accessToken, record)
        : await attendanceApi.logout(user.accessToken, record);

      if (result.success) {
        toast.success(result.message);
        setSystemMessage(result.message);
        setIsError(false);
        await fetchConfigAndStatus(user.accessToken);
      } else {
        setSystemMessage(result.message);
        setIsError(true);
        toast.error(result.message);
      }
    } catch (error: any) {
      setSystemMessage(error.message);
      setIsError(true);
      toast.error(error.message);
    } finally {
      setIsLoggingIn(false);
      setIsLoggingOut(false);
    }
  };

  const handleLogout = () => {
    auth.clearAuth();
    router.replace('/login');
  };

  const { pageActions } = createSimplePageConfig(
    user,
    isLoggingIn || isLoggingOut || isRefreshingStatus, // Combine all relevant loading states
    () => user?.accessToken && fetchConfigAndStatus(user.accessToken)
  );


   // If status is null, we haven't fetched it yet -> Disable both
   const isSyncing = status === null || isRefreshingStatus; // isSyncing includes refreshing
   const hasLoggedIn = !!status?.loginTime; // Use logintime from backend schema
   const hasLoggedOut = !!status?.logoutTime; // Use logouttime from backend schema


  const selectedLocation = useMemo(() =>
    locations.find(l => l.locationId === selectedLocationId),
    [locations, selectedLocationId]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#fcfcfd] dark:bg-[#0a0a0b] text-slate-900 dark:text-slate-100">
      <UniversalNavBar
        currentUserProfile={user}
        isLoggedIn={!!user}
        handleLogout={handleLogout}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        currentPath={pathname}
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
        pageActions={pageActions}
      />

      <main className="max-w-xl mx-auto px-6 py-16 md:py-24">
        {/* Header - Simple & Natural */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-900 dark:text-white mb-3 text-balance">
            Presence Terminal
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium tracking-tight">
            Record your daily activity securely.
          </p>
        </div>

        <div className="space-y-6">
          <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] bg-white dark:bg-[#121214] rounded-[2rem] overflow-hidden">
            <CardContent className="p-8 md:p-10 space-y-10">

              {/* Location Picker */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <Label className="text-xs uppercase tracking-[0.15em] text-slate-400 font-bold">Workspace</Label>
                  <Map className="w-4 h-4 text-slate-300" />
                </div>
                <Select value={selectedLocationId} onValueChange={setSelectedLocationId} disabled={hasLoggedOut}>
                  <SelectTrigger className="w-full h-14 bg-slate-50 dark:bg-slate-900/50 border-none rounded-2xl text-base font-medium transition-all focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-800">
                    <SelectValue placeholder="Where are you today?" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-slate-100 dark:border-slate-800 shadow-xl">
                    {locations.map((loc) => (
                      <SelectItem key={loc.locationId} value={loc.locationId} className="py-3 rounded-xl">
                        <span className="font-semibold">{loc.name}</span>
                        <span className="ml-2 text-xs text-slate-400">— {loc.mode}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-4">
                <Button
                  onClick={() => handleAttendance('login')}
                  disabled={isLoggingIn || isLoggingOut || isSyncing || hasLoggedIn}
                  className="h-16 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-black hover:opacity-90 transition-all font-semibold text-base flex items-center gap-2 group shadow-lg shadow-slate-200 dark:shadow-none"
                >
                  {isLoggingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />}
                  {hasLoggedIn ? 'Logged In' : 'Check In'}
                </Button>

                <Button
                  onClick={() => handleAttendance('logout')}
                  disabled={isLoggingIn || isLoggingOut || isSyncing || !hasLoggedIn || hasLoggedOut}
                  variant="outline"
                  className="h-16 rounded-2xl border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all font-semibold text-base flex items-center gap-2 group"
                >
                  {isLoggingOut ? <Loader2 className="w-4 h-4 animate-spin text-slate-900 dark:text-white" /> : <LogOut className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />}
                  {hasLoggedOut ? 'Logged Out' : 'Check Out'}
                </Button>
              </div>

              {/* Status Indicator */}
              <div className="grid grid-cols-2 gap-8 py-4">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Shift Start</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${status?.loginTime ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-800'}`} />
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {status?.loginTime ? new Date(status.loginTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not yet'}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Shift End</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${status?.logoutTime ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-800'}`} />
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {status?.logoutTime ? new Date(status.logoutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending'}
                    </span>
                  </div>
                </div>
              </div>

              {/* GPS Metadata */}
              <GpsInformation accuracy={lastFix.accuracy} timestamp={lastFix.timestamp} />

            </CardContent>
          </Card>

          {/* System Status & Guidelines Section */}
          <div className={`flex items-start gap-3 px-6 py-4 rounded-2xl border transition-colors duration-300 ${isError
            ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-100 dark:border-rose-900/50'
            : 'bg-slate-50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-800/50'
            }`}>
            {isError ? (
              <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            )}
            <div className="space-y-2">
              <p className={`text-[11px] leading-relaxed font-medium ${isError ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'
                }`}>
                {systemMessage || `Your location is verified within a ${selectedLocation?.radiusMeters || 100}m radius. Please ensure GPS is active.`}
              </p>

              {isError && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[10px] font-bold uppercase text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/30"
                  onClick={() => window.location.reload()}
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Reset Uplink
                </Button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
