'use client';

import React, { useState, useMemo } from 'react';
import { useUser } from '@clerk/react';
import { usePermissionStore } from '@/stores/permission-store';
import { usePermissions } from '@/hooks/usePermissions';
import { NavbarExtension } from '@/context/NavbarExtensionContext';
import { NavButton } from '@/components/NavButton';
import { Loader2, Users as UsersIcon, UserPlus } from 'lucide-react';

// Components
import { UserList } from './components/UserList';
import { CreateUserDialog } from './components/CreateUserDialog';
import { EditUserDialog } from './components/EditUserDialog';
import { DeleteUserDialog } from './components/DeleteUserDialog';
import { IUser } from '@/types/user.types';
import { UserProfile } from '@/types/rbac.types';

export default function UsersPage() {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const role = usePermissionStore(s => s.role);
  usePermissions('users');

  // Map Clerk user to legacy shape
  const currentUser = useMemo(() => {
    if (!clerkUser) return null;
    return {
      id: clerkUser.id,
      name: clerkUser.fullName || clerkUser.username || 'User',
      email: clerkUser.primaryEmailAddress?.emailAddress || '',
      role: role || (clerkUser.publicMetadata?.role as string) || 'sales',
    } as UserProfile;
  }, [clerkUser, role]);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<IUser | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Module-level access check (Super Admin or Admin only)
  const hasAccess = currentUser?.role === 'super-admin' || currentUser?.role === 'admin';

  const handleEdit = (user: IUser) => {
    setSelectedUser(user);
    setIsEditDialogOpen(true);
  };

  const handleDelete = (user: IUser) => {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  if (!clerkLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!hasAccess || !currentUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
        <UsersIcon className="w-16 h-16 text-gray-300 mb-4" />
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Access Denied</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          You do not have permission to manage users.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <NavbarExtension>
        <NavButton
          type="crate"
          text="Add User"
          onClick={() => setIsCreateDialogOpen(true)}
          icon={UserPlus}
        />
        <NavButton
          type="refresh"
          onClick={handleRefresh}
        />
      </NavbarExtension>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
            <UsersIcon className="w-8 h-8 text-blue-600" />
            User Management
          </h1>
        </div>

        <UserList 
          currentUserId={currentUser.id} 
          refreshKey={refreshKey}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>

      <CreateUserDialog 
        isOpen={isCreateDialogOpen} 
        onClose={() => setIsCreateDialogOpen(false)} 
        onSuccess={handleRefresh}
      />

      <EditUserDialog 
        user={selectedUser}
        currentUserId={currentUser.id}
        isOpen={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        onSuccess={handleRefresh}
      />

      <DeleteUserDialog 
        user={selectedUser}
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onSuccess={handleRefresh}
      />
    </div>
  );
}
