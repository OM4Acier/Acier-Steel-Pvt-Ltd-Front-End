'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Loader2, Edit3 } from 'lucide-react';
import { usersApi } from '@/lib/api/endpoints/users';
import { IUser, UserRole, UpdateUserFieldsPayload } from '@/types/user.types';
import { toast } from 'sonner';

interface EditUserDialogProps {
  user: IUser | null;
  currentUserId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ROLES: UserRole[] = [
  'super-admin', 
  'admin', 
  'sales', 
  'accountant', 
  'operations', 
  'purchase-entry', 
  'manager', 
  'viewer', 
  'editor'
];

export function EditUserDialog({ user, currentUserId, isOpen, onClose, onSuccess }: EditUserDialogProps) {
  const [formData, setFormData] = useState<UpdateUserFieldsPayload & { role: UserRole }>({
    name: '',
    role: 'sales',
    department: '',
    contactNo: '',
    organization: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        role: user.role,
        department: user.department || '',
        contactNo: user.contactNo || '',
        organization: user.organization || '',
      });
    }
  }, [user]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    try {
      const promises = [];

      // 1. Handle Role Update
      if (formData.role !== user.role) {
        if (user.clerkId === currentUserId) {
          toast.warning('You cannot change your own role.');
        } else {
          promises.push(usersApi.updateUserRole(user.clerkId, formData.role));
        }
      }

      // 2. Handle Fields Update
      const fieldUpdates: UpdateUserFieldsPayload = {};
      if (formData.name !== user.name) fieldUpdates.name = formData.name;
      if (formData.department !== user.department) fieldUpdates.department = formData.department;
      if (formData.contactNo !== user.contactNo) fieldUpdates.contactNo = formData.contactNo;
      if (formData.organization !== user.organization) fieldUpdates.organization = formData.organization;

      if (Object.keys(fieldUpdates).length > 0) {
        promises.push(usersApi.updateUserFields(user.clerkId, fieldUpdates));
      }

      if (promises.length === 0) {
        onClose();
        return;
      }

      await Promise.all(promises);
      toast.success(`User ${user.email} updated successfully`);
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Failed to update user:', error);
      toast.error(error.message || 'Failed to update user');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
        <DialogHeader className="p-6 bg-gradient-to-r from-blue-700 to-indigo-800 text-white">
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Edit3 className="w-6 h-6" />
            Edit User Profile
          </DialogTitle>
          <DialogDescription className="text-blue-100">
            Update user information and business assignments.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 bg-white dark:bg-gray-800">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label>Email Address (Read-only)</Label>
              <Input
                value={user?.email || ''}
                disabled
                className="rounded-xl bg-gray-50 border-gray-200"
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
                className="rounded-xl border-gray-200 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2 col-span-1">
              <Label htmlFor="edit-role">Primary Role</Label>
              <Select 
                value={formData.role} 
                onValueChange={(v) => handleChange('role', v as UserRole)}
                disabled={user?.clerkId === currentUserId}
              >
                <SelectTrigger id="edit-role" className="rounded-xl border-gray-200">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map(role => (
                    <SelectItem key={role} value={role} className="capitalize">
                      {role.replace('-', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {user?.clerkId === currentUserId && (
                <p className="text-[10px] text-amber-600 font-medium">Self-role editing disabled</p>
              )}
            </div>

            <div className="space-y-2 col-span-1">
              <Label htmlFor="edit-contactNo">Contact Number</Label>
              <Input
                id="edit-contactNo"
                placeholder="10 digit number"
                value={formData.contactNo}
                onChange={(e) => handleChange('contactNo', e.target.value)}
                maxLength={10}
                className="rounded-xl border-gray-200 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2 col-span-1">
              <Label htmlFor="edit-department">Department</Label>
              <Input
                id="edit-department"
                placeholder="Sales, HR, etc."
                value={formData.department}
                onChange={(e) => handleChange('department', e.target.value)}
                className="rounded-xl border-gray-200 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2 col-span-1">
              <Label htmlFor="edit-organization">Organization</Label>
              <Input
                id="edit-organization"
                placeholder="Company Name"
                value={formData.organization}
                onChange={(e) => handleChange('organization', e.target.value)}
                className="rounded-xl border-gray-200 focus:ring-blue-500"
              />
            </div>
          </div>

          <DialogFooter className="pt-4 border-t border-gray-100 dark:border-gray-700 mt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white min-w-[120px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
