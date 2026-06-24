'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Edit, Trash2, Mail, Phone, Building2 } from 'lucide-react';
import { usersApi } from '@/lib/api/endpoints/users';
import { IUser, UserRole } from '@/types/user.types';
import { toast } from 'sonner';

interface UserListProps {
  currentUserId: string;
  refreshKey: number;
  onEdit: (user: IUser) => void;
  onDelete: (user: IUser) => void;
}

const ROLE_COLORS: Record<UserRole, string> = {
  'super-admin':    'bg-indigo-600 text-white',
  'admin':          'bg-blue-700 text-white',
  'sales':          'bg-blue-500 text-white',
  'accountant':     'bg-green-600 text-white',
  'operations':     'bg-purple-600 text-white',
  'purchase-entry': 'bg-amber-600 text-white',
  'manager':        'bg-teal-600 text-white',
  'viewer':         'bg-gray-500 text-white',
  'editor':         'bg-sky-600 text-white',
};

export function UserList({ currentUserId, refreshKey, onEdit, onDelete }: UserListProps) {
  const [users, setUsers] = useState<IUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await usersApi.getUsers();
      setUsers(data);
    } catch (error: any) {
      if (error.message === 'Request cancelled') return;
      console.error('Failed to fetch users:', error);
      toast.error(error.message || 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers, refreshKey]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-gray-500 font-medium">Fetching users...</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <Table>
        <TableHeader className="bg-gray-50 dark:bg-gray-900/50">
          <TableRow>
            <TableHead className="w-[30%]">User</TableHead>
            <TableHead>Contact & Org</TableHead>
            <TableHead>Role</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 ? (
            <TableRow key="empty">
              <TableCell colSpan={4} className="h-32 text-center text-gray-500">
                No users found.
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => (
              <TableRow key={user.clerkId} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      {user.name}
                      {user.clerkId === currentUserId && (
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 border-blue-200 text-blue-600 bg-blue-50">
                          YOU
                        </Badge>
                      )}
                    </span>
                    <span className="text-sm text-gray-500 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" />
                      {user.email}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1 text-sm">
                    {user.contactNo && (
                      <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5" />
                        {user.contactNo}
                      </span>
                    )}
                    {(user.organization || user.department) && (
                      <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5" />
                        {user.organization} {user.department && `(${user.department})`}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={`${ROLE_COLORS[user.role] || 'bg-gray-500'} capitalize shadow-sm border-none`}>
                    {user.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      onClick={() => onEdit(user)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => onDelete(user)}
                      disabled={user.clerkId === currentUserId}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
