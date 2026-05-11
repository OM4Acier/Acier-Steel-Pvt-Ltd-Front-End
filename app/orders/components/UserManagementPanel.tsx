// components/UserManagementPanel.tsx - User Management Component

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, XCircle, UserPlus, Users as UsersIcon, Edit, Trash2 } from 'lucide-react';

import { DialogMessageType } from '../types';
import { BASE_API_URL } from '../constants';
import { apiService } from '@/lib/data';
import { UserProfile } from '@/types/rbac.types';

interface UserManagementPanelProps {
  currentUser: UserProfile;
  onShowMessage: (message: DialogMessageType) => void;
  onUserActionComplete: () => void;
}

export const UserManagementPanel: React.FC<UserManagementPanelProps> = ({
  currentUser,
  onShowMessage,
  onUserActionComplete,
}) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(true);
  const [userError, setUserError] = useState<string>('');

  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState<boolean>(false);
  const [newUserEmail, setNewUserEmail] = useState<string>('');
  const [newUserPassword, setNewUserPassword] = useState<string>('');
  const [newUserName, setNewUserName] = useState<string>('');
  const [newUserContactNo, setNewUserContactNo] = useState<string>('');
  const [newUserOrganization, setNewUserOrganization] = useState<string>('');
  const [newUserRole, setNewUserRole] = useState<UserProfile['role']>('sales');
  const [isAddingUser, setIsAddingUser] = useState<boolean>(false);

  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState<boolean>(false);
  const [userToEdit, setUserToEdit] = useState<UserProfile | null>(null);
  const [editedUserEmail, setEditedUserEmail] = useState<string>('');
  const [editedUserName, setEditedUserName] = useState<string>('');
  const [editedUserContactNo, setEditedUserContactNo] = useState<string>('');
  const [editedUserOrganization, setEditedUserOrganization] = useState<string>('');
  const [editedUserRole, setEditedUserRole] = useState<UserProfile['role']>('sales');
  const [isUpdatingUser, setIsUpdatingUser] = useState<boolean>(false);

  const [isConfirmUserDeleteDialogOpen, setIsConfirmUserDeleteDialogOpen] = useState<boolean>(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState<boolean>(false);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    setUserError('');
    if (currentUser.role !== 'super-admin') {
      setUserError('Access Denied: Only Super Admins can view and manage users.');
      setUsers([]);
      setLoadingUsers(false);
      return;
    }
    try {
      const fetchedUsers = await apiService.authFetch(
        `${BASE_API_URL}/users`,
        { method: 'GET' },
        currentUser.accessToken
      );
      setUsers(fetchedUsers);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      setUserError(`Failed to fetch users: ${error.message}`);
      onShowMessage({ type: 'error', text: `Failed to fetch users: ${error.message}` });
    } finally {
      setLoadingUsers(false);
    }
  }, [currentUser, onShowMessage]);

  useEffect(() => {
    if (currentUser.accessToken && currentUser.role === 'super-admin') {
      fetchUsers();
    } else if (currentUser.role !== 'super-admin') {
      setUsers([]);
      setLoadingUsers(false);
      setUserError('Access Denied: Only Super Admins can view and manage users.');
    }
  }, [fetchUsers, currentUser.accessToken, currentUser.role]);

  const handleAddUser = async () => {
    if (!newUserEmail || !newUserPassword || !newUserRole) {
      setUserError('Please fill in all required fields (Email, Password, Role).');
      return;
    }
    if (currentUser.role !== 'super-admin') {
      setUserError('Only Super Admins can add new users.');
      return;
    }

    setIsAddingUser(true);
    setUserError('');
    onShowMessage({ type: 'info', text: 'Adding new user...' });

    try {
      const response = await apiService.registerUser(
        newUserEmail,
        newUserPassword,
        newUserRole,
        newUserName.trim() || undefined,
        newUserContactNo.trim() || undefined,
        newUserOrganization.trim() || undefined
      );
      onShowMessage({
        type: 'success',
        text: `User ${response.user.email} with role ${response.user.role} registered successfully!`,
      });
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserName('');
      setNewUserContactNo('');
      setNewUserOrganization('');
      setNewUserRole('sales');
      setIsAddUserDialogOpen(false);
      fetchUsers();
      onUserActionComplete();
    } catch (error: any) {
      console.error('Error adding user:', error);
      setUserError(`Failed to add user: ${error.message}`);
      onShowMessage({ type: 'error', text: `Failed to add user: ${error.message}` });
    } finally {
      setIsAddingUser(false);
    }
  };

  const openEditUserDialog = (user: UserProfile) => {
    setUserToEdit(user);
    setEditedUserEmail(user.email);
    setEditedUserName(user.name || '');
    setEditedUserContactNo(user.contactNo || '');
    setEditedUserOrganization(user.organization || '');
    setEditedUserRole(user.role);
    setIsEditUserDialogOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!userToEdit || !currentUser.accessToken) {
      onShowMessage({ type: 'error', text: 'No user selected for update or not authenticated.' });
      return;
    }
    if (currentUser.role !== 'super-admin') {
      onShowMessage({ type: 'error', text: 'Access Denied: Only Super Admins can update users.' });
      return;
    }
    if (userToEdit.id === currentUser.id && editedUserRole !== userToEdit.role) {
      onShowMessage({ type: 'warning', text: 'You cannot change your own role.' });
      return;
    }
    if (
      userToEdit.role === 'super-admin' &&
      editedUserRole !== 'super-admin' &&
      userToEdit.id !== currentUser.id
    ) {
      onShowMessage({ type: 'warning', text: 'You cannot demote another Super Admin.' });
      return;
    }
    if (!editedUserEmail.trim()) {
      onShowMessage({ type: 'error', text: 'Email cannot be empty.' });
      return;
    }

    setIsUpdatingUser(true);
    onShowMessage({ type: 'info', text: `Updating user ${userToEdit.email}...` });

    try {
      const updatedFields: Partial<Omit<UserProfile, 'id' | 'accessToken'>> = {};
      if (editedUserEmail !== userToEdit.email) updatedFields.email = editedUserEmail;
      if (editedUserName !== (userToEdit.name || '')) updatedFields.name = editedUserName;
      if (editedUserContactNo !== (userToEdit.contactNo || ''))
        updatedFields.contactNo = editedUserContactNo;
      if (editedUserOrganization !== (userToEdit.organization || ''))
        updatedFields.organization = editedUserOrganization;
      if (editedUserRole !== userToEdit.role) updatedFields.role = editedUserRole;

      if (Object.keys(updatedFields).length === 0) {
        onShowMessage({ type: 'info', text: 'No changes detected for user.' });
        setIsEditUserDialogOpen(false);
        return;
      }

      await apiService.updateUser(userToEdit.id, updatedFields, currentUser.accessToken);
      onShowMessage({ type: 'success', text: `User ${userToEdit.email} updated successfully!` });
      setIsEditUserDialogOpen(false);
      fetchUsers();
      onUserActionComplete();
    } catch (error: any) {
      console.error('Error updating user:', error);
      onShowMessage({ type: 'error', text: `Failed to update user: ${error.message}` });
    } finally {
      setIsUpdatingUser(false);
    }
  };

  const openConfirmDeleteUserDialog = (user: UserProfile) => {
    setUserToDelete(user);
    setIsConfirmUserDeleteDialogOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete || !currentUser.accessToken) {
      onShowMessage({ type: 'error', text: 'No user selected for deletion or not authenticated.' });
      return;
    }
    if (currentUser.role !== 'super-admin') {
      onShowMessage({ type: 'error', text: 'Access Denied: Only Super Admins can delete users.' });
      return;
    }
    if (userToDelete.id === currentUser.id) {
      onShowMessage({ type: 'warning', text: 'You cannot delete your own user account.' });
      return;
    }
    if (userToDelete.role === 'super-admin') {
      onShowMessage({ type: 'warning', text: 'You cannot delete another Super Admin account.' });
      return;
    }

    setIsDeletingUser(true);
    onShowMessage({ type: 'info', text: `Deleting user ${userToDelete.email}...` });

    try {
      await apiService.deleteUser(userToDelete.id, currentUser.accessToken);
      onShowMessage({ type: 'success', text: `User ${userToDelete.email} deleted successfully!` });
      setIsConfirmUserDeleteDialogOpen(false);
      fetchUsers();
      onUserActionComplete();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      onShowMessage({ type: 'error', text: `Failed to delete user: ${error.message}` });
    } finally {
      setIsDeletingUser(false);
    }
  };

  if (loadingUsers) {
    return (
      <div className="flex justify-center items-center h-40 bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-lg text-gray-700 dark:text-gray-300">Loading users...</span>
      </div>
    );
  }

  if (userError) {
    return (
      <div className="p-4 bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 rounded-lg shadow-md flex items-center justify-center">
        <XCircle className="w-6 h-6 mr-3" />
        <p className="font-medium">{userError}</p>
      </div>
    );
  }

  return (
    <Card className="rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-8">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6 border-b border-gray-200 dark:border-gray-700 mb-6">
        <CardTitle className="text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
          <UsersIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          User Management
        </CardTitle>
        {currentUser.role === 'super-admin' && (
          <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
            <Button
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 transform transition-transform duration-200 hover:scale-105"
              onClick={() => setIsAddUserDialogOpen(true)}
            >
              <UserPlus className="w-5 h-5" />
              Add New User
            </Button>
            <DialogContent className="sm:max-w-[450px] lg:max-w-[1100px] p-4 sm:p-6 bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-y-auto max-h-[80vh] sm:max-h-[70vh] md:max-h-[60vh] lg:max-h-[90vh] z-[9000] border border-blue-300 dark:border-blue-700">
              <DialogHeader className="pb-4 border-b border-gray-200 dark:border-gray-700">
                <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-white">
                  Add New User
                </DialogTitle>
                <DialogDescription className="text-gray-600 dark:text-gray-400 mt-1">
                  Register a new user with a specific role.
                </DialogDescription>
              </DialogHeader>
              {userError && (
                <div className="p-3 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300 rounded-md mb-4 flex items-center">
                  <XCircle className="w-5 h-5 mr-2" /> {userError}
                </div>
              )}
              <div className="grid gap-5 py-6 text-gray-800 dark:text-gray-200">
                <div className="space-y-2">
                  <Label htmlFor="newUserEmail" className="text-lg font-medium">
                    Email
                  </Label>
                  <Input
                    id="newUserEmail"
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="rounded-lg px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newUserPassword" className="text-lg font-medium">
                    Password
                  </Label>
                  <Input
                    id="newUserPassword"
                    type="password"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="securepassword"
                    className="rounded-lg px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newUserName" className="text-lg font-medium">
                    Name (Optional)
                  </Label>
                  <Input
                    id="newUserName"
                    type="text"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="John Doe"
                    className="rounded-lg px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newUserContactNo" className="text-lg font-medium">
                    Contact No. (Optional)
                  </Label>
                  <Input
                    id="newUserContactNo"
                    type="tel"
                    value={newUserContactNo}
                    onChange={(e) => setNewUserContactNo(e.target.value)}
                    placeholder="1234567890"
                    maxLength={10}
                    className="rounded-lg px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newUserOrganization" className="text-lg font-medium">
                    Organization (Optional)
                  </Label>
                  <Input
                    id="newUserOrganization"
                    type="text"
                    value={newUserOrganization}
                    onChange={(e) => setNewUserOrganization(e.target.value)}
                    placeholder="Acme Ltd."
                    className="rounded-lg px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newUserRole" className="text-lg font-medium">
                    Role
                  </Label>
                  <Select
                    onValueChange={(value) => setNewUserRole(value as UserProfile['role'])}
                    value={newUserRole}
                  >
                    <SelectTrigger
                      id="newUserRole"
                      className="rounded-lg px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <SelectValue placeholder="Select Role" />
                    </SelectTrigger>
                    <SelectContent className="z-[9050] bg-white dark:bg-gray-700 rounded-lg shadow-lg">
                      <SelectItem value="sales" className="hover:bg-gray-100 dark:hover:bg-gray-600">
                        Sales
                      </SelectItem>
                      <SelectItem value="accountant" className="hover:bg-gray-100 dark:hover:bg-gray-600">
                        Accountant
                      </SelectItem>
                      <SelectItem value="operations" className="hover:bg-gray-100 dark:hover:bg-gray-600">
                        Operations
                      </SelectItem>
                      <SelectItem value="super-admin" className="hover:bg-gray-100 dark:hover:bg-gray-600">
                        Super Admin
                      </SelectItem>
                      <SelectItem value="purchase-entry" className="hover:bg-gray-100 dark:hover:bg-gray-600">
                        Purchase Entry
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter className="mt-6 flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAddUserDialogOpen(false);
                    setUserError('');
                  }}
                  disabled={isAddingUser}
                  className="px-5 py-2 rounded-full border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </Button>
                <Button
                  className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-5 py-2 rounded-full shadow-md transform transition-transform duration-200 hover:scale-105"
                  onClick={handleAddUser}
                  disabled={isAddingUser}
                >
                  {isAddingUser && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Add User
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent className="px-2 sm:px-4">
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
          <Table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <TableHeader className="bg-gray-50 dark:bg-gray-700">
              <TableRow>
                <TableHead className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider rounded-tl-lg sm:px-6 sm:py-3">
                  Email
                </TableHead>
                <TableHead className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider sm:px-6 sm:py-3">
                  Name
                </TableHead>
                <TableHead className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider sm:px-6 sm:py-3">
                  Contact No.
                </TableHead>
                <TableHead className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider sm:px-6 sm:py-3">
                  Organization
                </TableHead>
                <TableHead className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider sm:px-6 sm:py-3">
                  Role
                </TableHead>
                {currentUser.role === 'super-admin' && (
                  <TableHead className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider rounded-tr-lg sm:px-6 sm:py-3">
                    Actions
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {users.length > 0 ? (
                users.map((user) => (
                  <TableRow
                    key={user.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150"
                  >
                    <TableCell className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-200 sm:px-6 sm:py-4">
                      {user.email}
                    </TableCell>
                    <TableCell className="px-3 py-2 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 sm:px-6 sm:py-4">
                      {user.name || 'N/A'}
                    </TableCell>
                    <TableCell className="px-3 py-2 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 sm:px-6 sm:py-4">
                      {user.contactNo || 'N/A'}
                    </TableCell>
                    <TableCell className="px-3 py-2 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 sm:px-6 sm:py-4">
                      {user.organization || 'N/A'}
                    </TableCell>
                    <TableCell className="px-3 py-2 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 sm:px-6 sm:py-4">
                      <Badge
                        className={`capitalize px-3 py-1 rounded-full text-xs font-semibold ${
                          user.role === 'super-admin'
                            ? 'bg-indigo-600 text-white'
                            : user.role === 'sales'
                            ? 'bg-blue-500 text-white'
                            : user.role === 'accountant'
                            ? 'bg-green-500 text-white'
                            : user.role === 'operations'
                            ? 'bg-purple-500 text-white'
                            : user.role === 'purchase-entry'
                            ? 'bg-amber-500 text-white'
                            : 'bg-gray-500 text-white'
                        }`}
                      >
                        {user.role} {user.id === currentUser.id && '(You)'}
                      </Badge>
                    </TableCell>
                    {currentUser.role === 'super-admin' && (
                      <TableCell className="px-3 py-2 whitespace-nowrap text-right text-sm font-medium sm:px-6 sm:py-4">
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => openEditUserDialog(user)}
                            className="w-8 h-8 rounded-full text-blue-600 border-blue-300 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-600 dark:hover:bg-blue-900 transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => openConfirmDeleteUserDialog(user)}
                            disabled={user.id === currentUser.id || user.role === 'super-admin'}
                            className="w-8 h-8 rounded-full bg-red-500 text-white hover:bg-red-600 dark:bg-red-700 dark:hover:bg-red-800 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={currentUser.role === 'super-admin' ? 6 : 5}
                    className="h-24 text-center text-gray-500 dark:text-gray-400 text-base"
                  >
                    No users found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Edit User Dialog */}
      <Dialog open={isEditUserDialogOpen} onOpenChange={setIsEditUserDialogOpen}>
        <DialogContent className="sm:max-w-[450px] lg:max-w-[1100px] p-4 sm:p-6 bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-y-auto max-h-[80vh] z-[9000]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-white">
              Edit User
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400 mt-1">
              Modify the user&apos;s details.
            </DialogDescription>
          </DialogHeader>
          {userError && (
            <div className="p-3 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300 rounded-md mb-4 flex items-center">
              <XCircle className="w-5 h-5 mr-2" /> {userError}
            </div>
          )}
          <div className="grid gap-5 py-6 text-gray-800 dark:text-gray-200">
            <div className="space-y-2">
              <Label htmlFor="editedUserEmail" className="text-lg font-medium">
                Email
              </Label>
              <Input
                id="editedUserEmail"
                type="email"
                value={editedUserEmail}
                onChange={(e) => setEditedUserEmail(e.target.value)}
                placeholder="user@example.com"
                className="rounded-lg px-4 py-2"
                disabled={isUpdatingUser || !userToEdit || userToEdit.id === currentUser.id}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editedUserName" className="text-lg font-medium">
                Name
              </Label>
              <Input
                id="editedUserName"
                type="text"
                value={editedUserName}
                onChange={(e) => setEditedUserName(e.target.value)}
                placeholder="John Doe"
                className="rounded-lg px-4 py-2"
                disabled={isUpdatingUser}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editedUserContactNo" className="text-lg font-medium">
                Contact No.
              </Label>
              <Input
                id="editedUserContactNo"
                type="tel"
                value={editedUserContactNo}
                onChange={(e) => setEditedUserContactNo(e.target.value)}
                placeholder="1234567890"
                maxLength={10}
                className="rounded-lg px-4 py-2"
                disabled={isUpdatingUser}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editedUserOrganization" className="text-lg font-medium">
                Organization
              </Label>
              <Input
                id="editedUserOrganization"
                type="text"
                value={editedUserOrganization}
                onChange={(e) => setEditedUserOrganization(e.target.value)}
                placeholder="Acme Ltd."
                className="rounded-lg px-4 py-2"
                disabled={isUpdatingUser}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editedUserRole" className="text-lg font-medium">
                Role
              </Label>
              <Select
                onValueChange={(value) => setEditedUserRole(value as UserProfile['role'])}
                value={editedUserRole}
              >
                <SelectTrigger
                  id="editedUserRole"
                  className="rounded-lg px-4 py-2"
                  disabled={
                    isUpdatingUser ||
                    userToEdit?.id === currentUser.id ||
                    (userToEdit?.role === 'super-admin' && userToEdit?.id !== currentUser.id)
                  }
                >
                  <SelectValue placeholder="Select Role" />
                </SelectTrigger>
                <SelectContent className="z-[9050]">
                  <SelectItem value="sales" className="hover:bg-gray-100 dark:hover:bg-gray-600">
                    Sales
                  </SelectItem>
                  <SelectItem value="accountant" className="hover:bg-gray-100 dark:hover:bg-gray-600">
                    Accountant
                  </SelectItem>
                  <SelectItem value="operations" className="hover:bg-gray-100 dark:hover:bg-gray-600">
                    Operations
                  </SelectItem>
                  <SelectItem value="super-admin" className="hover:bg-gray-100 dark:hover:bg-gray-600">
                    Super Admin
                  </SelectItem>
                  <SelectItem value="purchase-entry" className="hover:bg-gray-100 dark:hover:bg-gray-600">
                    Purchase Entry
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-6 flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="outline"
              onClick={() => {
                setIsEditUserDialogOpen(false);
                setUserError('');
              }}
              disabled={isUpdatingUser}
              className="px-5 py-2 rounded-full"
            >
              Cancel
            </Button>
            <Button
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-5 py-2 rounded-full shadow-md"
              onClick={handleUpdateUser}
              disabled={isUpdatingUser}
            >
              {isUpdatingUser && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <Dialog open={isConfirmUserDeleteDialogOpen} onOpenChange={setIsConfirmUserDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px] p-4 sm:p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg z-[9002]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-white">
              Confirm User Deletion
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400 mt-1">
              Are you sure you want to delete user{' '}
              <span className="font-semibold">{userToDelete?.email}</span>? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          {userError && (
            <div className="p-3 rounded-md mb-4 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
              {userError}
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setIsConfirmUserDeleteDialogOpen(false);
                setUserError('');
              }}
              disabled={isDeletingUser}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={isDeletingUser}>
              {isDeletingUser && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};