'use client';

import React, { useEffect, useState } from 'react';
import { UserProfile, useUser } from '@clerk/react';
import { accountApi, AccountResponse } from '@/lib/api/endpoints/accountApi';
import { usePermissionStore } from '@/stores/permission-store';
import { ContactNumberForm } from './components/ContactNumberForm';
import { SuperAdminExtras } from './components/SuperAdminExtras';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Shield } from 'lucide-react';
import { toast } from 'sonner';

/**
 * app/account/page.tsx
 * 
 * Simplified Account Management Page.
 * Single-column layout focusing on essential profile and security settings.
 */
export default function AccountPage() {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const role = usePermissionStore((s) => s.role);
  const isSuperAdmin = role === 'super-admin';

  const [accountData, setAccountData] = useState<AccountResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchAccount() {
      try {
        const data = await accountApi.getMe();
        setAccountData(data);
      } catch (err: any) {
        if (err.message !== 'Request cancelled') {
          console.error('Failed to fetch account data:', err);
          toast.error('Failed to load profile details');
        }
      } finally {
        setIsLoading(false);
      }
    }

    if (clerkLoaded && clerkUser) {
      fetchAccount();
    }
  }, [clerkLoaded, clerkUser]);

  if (!clerkLoaded || isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-10">
      {/* 1. Main Profile & Security (Clerk) */}
      <section>
        <UserProfile 
          routing="hash"
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "shadow-sm border border-border rounded-xl w-full max-w-full mx-auto",
              navbar: "flex", // Restore Clerk's clean internal nav
              pageScrollBox: "p-6",
            }
          }}
        />
      </section>

      {/* 2. CRM Specific Information */}
      <section className="space-y-6">
        <div className="px-1">
          <h2 className="text-xl font-semibold">Additional Information</h2>
          <p className="text-sm text-muted-foreground">Manage details specific to the CRM system.</p>
        </div>

        <Card className="border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Contact Number</CardTitle>
            <CardDescription>This number is used for internal organization records.</CardDescription>
          </CardHeader>
          <CardContent>
            <ContactNumberForm 
              initialValue={accountData?.account?.contactNo || ''} 
              onSuccess={(newVal) => {
                if (accountData) {
                  setAccountData({
                    ...accountData,
                    account: { ...accountData.account, contactNo: newVal }
                  });
                }
              }}
            />
          </CardContent>
        </Card>
      </section>

      {/* 3. Super Admin Diagnostics (Simplified) */}
      {isSuperAdmin && accountData?.adminExtras && (
        <section className="pt-10 border-t">
          <div className="flex items-center gap-2 mb-6 px-1">
            <Shield className="h-5 w-5 text-red-500" />
            <h2 className="text-xl font-semibold text-red-600 dark:text-red-400">System Diagnostics</h2>
          </div>
          <SuperAdminExtras extras={accountData.adminExtras} />
        </section>
      )}
    </div>
  );
}
