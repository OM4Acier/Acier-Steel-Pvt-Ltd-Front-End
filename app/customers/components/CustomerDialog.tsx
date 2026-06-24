'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CustomerForm } from './CustomerForm';
import { CustomerSummary } from '@/lib/api/endpoints/customers';
import { Building2, Edit2, Trash2 } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type DialogMode = 'view' | 'edit' | 'create';

interface CustomerDialogProps {
  isOpen: boolean;
  mode: DialogMode;
  customer?: CustomerSummary | null;
  onClose: () => void;
  onSuccess: (customer: CustomerSummary) => void;
  /** Signals page to switch dialogState.mode → 'edit' */
  onEdit: () => void;
  /** Signals page to open the delete AlertDialog */
  onDelete: (customer: CustomerSummary) => void;
}

// ─── Static metadata per mode ────────────────────────────────────────────────

const DIALOG_META: Record<
  DialogMode,
  { title: (name?: string) => string; description: (name?: string) => string }
> = {
  view: {
    title: (name) => name ?? 'Commercial Identity',
    description: (name) => `Registry record for ${name ?? 'this entity'}`,
  },
  edit: {
    title: () => 'Edit Commercial Identity',
    description: (name) => `Registry updates for ${name ?? 'this entity'}`,
  },
  create: {
    title: () => 'Entity Registration',
    description: () => 'Establishing a new commercial record in the partner network',
  },
};

// ─── Component ───────────────────────────────────────────────────────────────

export const CustomerDialog: React.FC<CustomerDialogProps> = ({
  isOpen,
  mode,
  customer,
  onClose,
  onSuccess,
  onEdit,
  onDelete,
}) => {
  const meta = DIALOG_META[mode];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {/*
        FIX #11 & #12:
        - Root uses flex flex-col + max-h-[90vh]
        - Header and (view-mode) footer are flex-shrink-0
        - Scrollable body is flex-1
      */}
      <DialogContent className="sm:max-w-[800px] md:max-w-[1000px] w-[96vw] p-0 rounded-[18px] overflow-hidden border border-[#e0e0e0] bg-white dark:bg-gray-900 z-[10005] animate-in zoom-in-95 duration-200 shadow-2xl flex flex-col max-h-[90vh]">

        {/* Fixed header */}
        <DialogHeader className="px-10 py-6 border-b border-[#f0f0f0] bg-white dark:bg-gray-900 relative flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#f5f5f7] flex items-center justify-center">
              <Building2 className="w-6 h-6 text-[#0066cc]" />
            </div>
            <div className="space-y-0.5">
              <DialogTitle className="text-[28px] font-semibold tracking-tight text-[#1d1d1f] font-display">
                {meta.title(customer?.name)}
              </DialogTitle>
              <DialogDescription className="text-[14px] font-medium text-[#7a7a7a] font-text">
                {meta.description(customer?.name)}
              </DialogDescription>
            </div>
          </div>
        
        </DialogHeader>

        {/* Scrollable body — FIX #13: onClose no longer duplicated inside onSuccess */}
        <div className="px-10 py-4 overflow-y-auto dialog-custom-scrollbar bg-white dark:bg-gray-900 flex-1">
          <CustomerForm
            customer={customer}
            readOnly={mode === 'view'}
            onSuccess={onSuccess}
            onCancel={onClose}
          />
        </div>

        {/*
          FIX #10: View-mode footer — fixed at bottom, right-aligned.
          Edit/Delete buttons appear only when viewing an existing record.
        */}
        {mode === 'view' && customer && (
          <div className="px-10 py-5 border-t border-[#f0f0f0] bg-white dark:bg-gray-900 flex-shrink-0 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={true}
              onClick={() => onDelete(customer)}
              className="h-11 px-6 rounded-2xl border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 font-semibold transition-all flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </Button>
            <Button
              type="button"
              onClick={onEdit}
              className="h-11 px-6 rounded-2xl bg-[#0066cc] hover:bg-[#0071e3] text-white font-semibold transition-all flex items-center gap-2"
            >
              <Edit2 className="w-4 h-4" />
              Edit Profile
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};