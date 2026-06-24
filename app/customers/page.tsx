'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search,
  Building2,
  Loader2,
  UserPlus,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { customersApi, CustomerSummary } from '@/lib/api/endpoints/customers';
import { CustomerDialog } from './components/CustomerDialog';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// ─── Types ──────────────────────────────────────────────────────────────────

type DialogMode = 'view' | 'edit' | 'create';

interface DialogState {
  isOpen: boolean;
  mode: DialogMode;
  customer: CustomerSummary | null;
}

const INITIAL_DIALOG_STATE: DialogState = {
  isOpen: false,
  mode: 'create',
  customer: null,
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [dialogState, setDialogState] = useState<DialogState>(INITIAL_DIALOG_STATE);

  // Delete state lives here so the AlertDialog is controlled at the page level
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<CustomerSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ─── Data ─────────────────────────────────────────────────────────────────

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await customersApi.fetchCustomers();
      setCustomers(data);
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'Request cancelled') return;
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to load customers: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const filteredCustomers = useMemo(() => {
    if (!searchTerm) return customers;
    const term = searchTerm.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.gst?.toLowerCase().includes(term) ||
        c.pan?.toLowerCase().includes(term) ||
        c.phones?.some((p) => p.includes(term)),
    );
  }, [customers, searchTerm]);

  // ─── Dialog handlers ──────────────────────────────────────────────────────

  // FIX #4: mode-aware dialog open handlers
  const handleOpenCreate = useCallback(() => {
    setDialogState({ isOpen: true, mode: 'create', customer: null });
  }, []);

  const handleOpenView = useCallback((customer: CustomerSummary) => {
    setDialogState({ isOpen: true, mode: 'view', customer });
  }, []);

  /** Called by CustomerDialog footer "Edit Profile" button */
  const handleSwitchToEdit = useCallback(() => {
    setDialogState((prev) => ({ ...prev, mode: 'edit' }));
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogState(INITIAL_DIALOG_STATE);
  }, []);

  // FIX #2: wrapper accepts CustomerSummary so the type matches CustomerDialog.onSuccess
  const handleDialogSuccess = useCallback(
    () => {
      fetchCustomers();
      handleCloseDialog();
    },
    [fetchCustomers, handleCloseDialog],
  );

  // ─── Delete handlers ──────────────────────────────────────────────────────

  /** Called from CustomerDialog footer "Delete" button */
  const handleDeleteRequest = useCallback((customer: CustomerSummary) => {
    setCustomerToDelete(customer);
    setIsDeleteDialogOpen(true);
  }, []);

  const handleDelete = async () => {
    if (!customerToDelete) return;
    setIsDeleting(true);
    try {
      await customersApi.deleteCustomer(customerToDelete.id);
      toast.success('Customer deleted successfully');
      fetchCustomers();
      handleCloseDialog();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to delete customer';
      toast.error(msg);
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
      setCustomerToDelete(null);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-8 max-w-8xl mx-auto space-y-8 min-h-screen bg-[#fcfcfd] dark:bg-gray-950">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
            <Building2 className="w-8 h-8 text-blue-600" />
            Commercial Directory
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm font-bold uppercase tracking-[0.2em] mt-1">
            Global Entity Registry & Logistics Hub
          </p>
        </div>
        <Button
          onClick={handleOpenCreate}
          className="h-12 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs tracking-[0.2em] shadow-xl shadow-blue-600/20 transition-all active:scale-95 flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          NEW REGISTRATION
        </Button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="rounded-[2rem] border-none shadow-sm bg-white dark:bg-white/5 overflow-hidden group hover:shadow-xl transition-all duration-300">
          <CardHeader className="pb-2 pt-6 px-6">
            <CardTitle className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">
              Partner Network
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="flex items-baseline gap-2">
              <div className="text-4xl font-black text-blue-600 tracking-tighter">{customers.length}</div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Active Entities</div>
            </div>
            <div className="mt-4 h-1 w-12 bg-blue-600 rounded-full group-hover:w-full transition-all duration-500" />
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-none shadow-sm bg-gray-50/30 dark:bg-white/5 border border-dashed border-gray-200">
          <CardContent className="h-full flex items-center justify-center py-6">
            <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Market Reach Alpha</p>
          </CardContent>
        </Card>
      </div>

      {/* Table Container */}
      <div className="rounded-[2.5rem] bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="p-6 border-b border-gray-100 dark:border-white/5 flex flex-col sm:flex-row items-center gap-4">
          <div className="relative w-full max-w-md group">
            <Search className="absolute left-4 top-3.5 w-4 h-4 text-gray-300 group-focus-within:text-blue-500 transition-colors" />
            <Input
              placeholder="Search by name, GST, PAN, or phone..."
              className="h-11 pl-11 rounded-xl bg-gray-50 dark:bg-gray-900 border-transparent focus:bg-white dark:focus:bg-black transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Directory Table — FIX #3: "Control" column removed; rows are clickable */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50/50 dark:bg-black/20 border-b border-gray-100 dark:border-white/5">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[350px] text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 pl-8 h-14">
                  Commercial Entity
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                  Identity Tokens
                </TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                  Access Points
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-60 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-4">
                      Syncing directory...
                    </p>
                  </TableCell>
                </TableRow>
              ) : filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-60 text-center">
                    <div className="max-w-xs mx-auto">
                      <Building2 className="w-12 h-12 text-gray-100 mx-auto mb-4" />
                      <p className="text-sm font-bold text-gray-500 uppercase tracking-tight">No entities found</p>
                      <p className="text-xs text-gray-400 mt-1">Refine search or initiate a new registration.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((customer) => (
                  <TableRow
                    key={customer.id}
                    // FIX #3: click row → open view modal
                    onClick={() => handleOpenView(customer)}
                    className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 border-b border-gray-100 dark:border-white/5 transition-colors group cursor-pointer"
                  >
                    <TableCell className="py-5 pl-8">
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-[1rem] bg-gray-50 dark:bg-white/5 flex items-center justify-center text-gray-400 group-hover:bg-blue-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-blue-500/20 transition-all duration-300">
                          <Building2 className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 dark:text-gray-100 text-base">{customer.name}</div>
                          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1 opacity-60">
                            REF: {customer.id.slice(-8).toUpperCase()}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-2">
                        {customer.gst && (
                          <div className="flex items-center gap-3">
                            <span className="w-8 text-[9px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded text-center">
                              GST
                            </span>
                            <span className="text-xs font-mono font-medium text-gray-500 tracking-tight">
                              {customer.gst}
                            </span>
                          </div>
                        )}
                        {customer.pan && (
                          <div className="flex items-center gap-3">
                            <span className="w-8 text-[9px] font-black text-gray-400 bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded text-center">
                              PAN
                            </span>
                            <span className="text-xs font-mono font-medium text-gray-500 tracking-tight">
                              {customer.pan}
                            </span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1.5">
                        {customer.phones?.slice(0, 2).map((phone, idx) => (
                          <div key={idx} className="flex items-center gap-2.5 text-xs font-bold text-gray-600 dark:text-gray-400">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500/40" />
                            {phone}
                          </div>
                        ))}
                        {customer.phones && customer.phones.length > 2 && (
                          <div className="text-[9px] font-black text-blue-600 uppercase tracking-widest ml-4 mt-2">
                            + {customer.phones.length - 2} Additional Channels
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open);
          if (!open) setCustomerToDelete(null);
        }}
      >
        <AlertDialogContent className="rounded-[2rem] border-none shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold tracking-tight">
              Remove Business Profile?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium text-gray-500">
              You are about to delete{' '}
              <span className="font-black text-gray-900 dark:text-white">
                &quot;{customerToDelete?.name}&quot;
              </span>
              . This action is permanent and cannot be reversed. Existing orders for this client will
              remain unaffected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel className="h-12 px-6 rounded-2xl font-bold border-gray-100">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={isDeleting}
              className="h-12 px-8 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black text-xs tracking-widest transition-all"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'CONFIRM DELETE'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Customer Dialog — view / edit / create */}
      <CustomerDialog
        isOpen={dialogState.isOpen}
        mode={dialogState.mode}
        customer={dialogState.customer}
        onClose={handleCloseDialog}
        onSuccess={handleDialogSuccess}
        onEdit={handleSwitchToEdit}
        onDelete={handleDeleteRequest}
      />


    </div>
  );
}