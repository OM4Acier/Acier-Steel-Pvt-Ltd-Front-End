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
import { Loader2, AlertTriangle } from 'lucide-react';
import { usersApi } from '@/lib/api/endpoints/users';
import { IUser } from '@/types/user.types';
import { toast } from 'sonner';

interface DeleteUserDialogProps {
  user: IUser | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function DeleteUserDialog({ user, isOpen, onClose, onSuccess }: DeleteUserDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDelete = async () => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      await usersApi.deleteUser(user.clerkId);
      toast.success(`User ${user.email} deleted successfully`);
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Failed to delete user:', error);
      toast.error(error.message || 'Failed to delete user');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
        <DialogHeader className="p-6 bg-red-600 text-white">
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="w-6 h-6" />
            Delete User Account
          </DialogTitle>
          <DialogDescription className="text-red-100">
            This action is permanent and cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 bg-white dark:bg-gray-800">
          <p className="text-gray-700 dark:text-gray-300">
            Are you sure you want to delete user <span className="font-bold text-gray-900 dark:text-white">{user?.name || user?.email}</span>?
          </p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            The user will lose access to the system immediately and all their Clerk metadata will be purged.
          </p>

          <DialogFooter className="mt-6 gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl flex-1"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isSubmitting}
              className="rounded-xl flex-1 bg-red-600 hover:bg-red-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Confirm Delete'
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
