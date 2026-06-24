'use client';

import React, { useState } from 'react';
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
import { Loader2, UserPlus } from 'lucide-react';
import { usersApi } from '@/lib/api/endpoints/users';
import { UserRole, CreateUserPayload } from '@/types/user.types';
import { toast } from 'sonner';

interface CreateUserDialogProps {
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

export function CreateUserDialog({ isOpen, onClose, onSuccess }: CreateUserDialogProps) {
  const [formData, setFormData] = useState<CreateUserPayload>({
    email: '',
    password: '',
    name: '',
    role: 'sales',
    department: '',
    contactNo: '',
    organization: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field: keyof CreateUserPayload, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.password || !formData.name) {
      toast.error('Email, Password and Name are required');
      return;
    }

    setIsSubmitting(true);
    try {
      await usersApi.createUser(formData);
      toast.success(`User ${formData.email} created successfully`);
      onSuccess();
      onClose();
      // Reset form
      setFormData({
        email: '',
        password: '',
        name: '',
        role: 'sales',
        department: '',
        contactNo: '',
        organization: '',
      });
    } catch (error: any) {
      console.error('Failed to create user:', error);
      toast.error(error.message || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
        <DialogHeader className="p-6 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <UserPlus className="w-6 h-6" />
            Add New User
          </DialogTitle>
          <DialogDescription className="text-blue-100">
            Register a new account and set their initial permissions.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 bg-white dark:bg-gray-800">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@example.com"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                required
                className="rounded-xl border-gray-200 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="password">Temporary Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Min 8 characters"
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                required
                className="rounded-xl border-gray-200 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
                className="rounded-xl border-gray-200 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2 col-span-1">
              <Label htmlFor="role">Primary Role</Label>
              <Select 
                value={formData.role} 
                onValueChange={(v) => handleChange('role', v as UserRole)}
              >
                <SelectTrigger className="rounded-xl border-gray-200">
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
            </div>

            <div className="space-y-2 col-span-1">
              <Label htmlFor="contactNo">Contact Number</Label>
              <Input
                id="contactNo"
                placeholder="10 digit number"
                value={formData.contactNo}
                onChange={(e) => handleChange('contactNo', e.target.value)}
                maxLength={10}
                className="rounded-xl border-gray-200 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2 col-span-1">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                placeholder="Sales, HR, etc."
                value={formData.department}
                onChange={(e) => handleChange('department', e.target.value)}
                className="rounded-xl border-gray-200 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2 col-span-1">
              <Label htmlFor="organization">Organization</Label>
              <Input
                id="organization"
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
              className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create User'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
