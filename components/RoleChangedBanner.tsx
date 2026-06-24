'use client';

import React from 'react';
import { useClerk } from '@clerk/nextjs';
import { usePermissionStore } from '@/stores/permission-store';
import { AlertCircle, X, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * components/RoleChangedBanner.tsx
 * 
 * A non-blocking notification banner that appears when a user's role 
 * has been updated on the backend.
 */
export function RoleChangedBanner() {
  const { roleChanged, dismissRoleChange } = usePermissionStore();
  const { signOut } = useClerk();

  if (!roleChanged) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 py-3 px-4 shadow-sm animate-in slide-in-from-top duration-300">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-amber-100 p-2 rounded-full">
            <AlertCircle className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-sm text-amber-800 font-medium">
            Your access level has been updated. Please sign in again to apply the latest permissions.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => signOut()}
            className="bg-amber-600 text-white border-none hover:bg-amber-700 h-9 px-4 rounded-xl"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Re-login
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={dismissRoleChange}
            className="text-amber-500 hover:text-amber-700 hover:bg-amber-100 rounded-full"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
