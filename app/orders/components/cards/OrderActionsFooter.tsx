// app/orders/components/cards/OrderActionsFooter.tsx
import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Edit, Save, MoreVertical, Wallet, Trash2, XCircle, CheckCircle, Truck } from 'lucide-react';
import {
  isSuperAdmin, isSales, isAccountant,
  canEditOperationsSpecificFields, canEditAccountantSpecificFields, canMarkAsPaid,
  canCreatePartDelivery, canCancelOrder,
} from '../../permissions';
import { canTransitionToGeneral } from '../../constants';
import { EditHistory } from '../EditHistory';
import { OrderActionsFooterProps } from './cardTypes';

const OrderActionsFooter: React.FC<OrderActionsFooterProps> = ({
  isEditMode, isSaving, isMarkingPaid, isCreatingPartDelivery,
  isMoreActionsOpen, role, status,
  customerPaymentStatus, partDelivery, isPaymentPending, hasChanges,
  pendingChangesSummary, onCancelEdit, onSaveAll, onEditOrder, onApprove,
  onReadyForDispatch, onPartDelivery, onDispatchedInvoiced, onComplete,
  onMoreActionsOpenChange, onMarkAsPaid, onCancelOrder, onDeleteClick,
  deoNo, currentUserProfile,
}) => {
  const { textFieldCount, fileCount } = pendingChangesSummary;

  return (
    <DialogFooter className="mt-6 flex flex-wrap justify-start gap-3 border-t border-gray-200 dark:border-gray-700 pt-4">
      {isEditMode ? (
        <>
          <Button variant="outline" onClick={onCancelEdit} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={onSaveAll}
            disabled={isSaving || !hasChanges}
          >
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            <Save className="w-4 h-4 mr-2" />
            Save All Changes
          </Button>
          {hasChanges && (
            <span className="text-sm text-orange-600 dark:text-orange-400 flex items-center">
              {textFieldCount > 0 && `${textFieldCount} field(s)`}
              {textFieldCount > 0 && fileCount > 0 && ', '}
              {fileCount > 0 && `${fileCount} file(s)`}
              {' '}pending
            </span>
          )}
        </>
      ) : (
        <>
          <Button variant="outline" onClick={onEditOrder} className="flex-1 sm:flex-none">
            <Edit className="w-4 h-4 mr-2" /> Edit Order
          </Button>

          {/* Status Transition Buttons */}
          {canTransitionToGeneral(status || '', 'Approved for Production') &&
            isSuperAdmin(role) && (
              <Button
                onClick={onApprove}
                className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white"
                disabled={isSaving}
              >
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Approve Order
              </Button>
            )}

          {canTransitionToGeneral(status || '', 'Ready for Dispatch') &&
            canEditOperationsSpecificFields(role) && (
              <Button
                onClick={onReadyForDispatch}
                className="flex-1 sm:flex-none bg-purple-500 hover:bg-purple-600 text-white"
                disabled={isSaving}
              >
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Ready for Dispatch
              </Button>
            )}

          {partDelivery &&
            (status === 'Ready for Dispatch' || status === 'Approved for Production') &&
            canCreatePartDelivery(role) && (
              <Button
                onClick={onPartDelivery}
                className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 text-white"
                disabled={isCreatingPartDelivery}
              >
                {isCreatingPartDelivery && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Part Delivery
              </Button>
            )}
          {canTransitionToGeneral(status || '', 'Dispatched and Invoiced') &&
            canEditOperationsSpecificFields(role) && (
              <div className="relative flex flex-col gap-2">

                {/* Floating message that does NOT change layout */}
                {isPaymentPending && (
                  <div className="absolute -top-20 left-0 w-full flex justify-start pointer-events-none">
                    <p
                      className="text-sm font-medium p-2 rounded border
               bg-red-50 text-red-700 border-red-300
               dark:bg-red-950 dark:text-red-300 dark:border-red-700
               shadow-md"
                    >
                      ⚠️ Action Blocked: Confirm Payment Info.
                    </p>
                  </div>
                )}

                {/* Button */}
                <Button
                  onClick={onDispatchedInvoiced}
                  className="flex-1 sm:flex-none bg-yellow-500 hover:bg-yellow-600 text-white disabled:opacity-50"
                  disabled={isSaving}
                >
                  {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <Truck className="w-4 h-4 mr-2" /> Dispatched & Invoiced
                </Button>
              </div>

            )}


          {canTransitionToGeneral(status || '', 'Completed') &&
            canEditAccountantSpecificFields(role, status) && (
              <Button
                onClick={onComplete}
                className="flex-1 sm:flex-none bg-green-700 hover:bg-green-800 text-white"
                disabled={isSaving}
              >
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <CheckCircle className="w-4 h-4 mr-2" /> Complete Order
              </Button>
            )}

          {/* More Actions Dialog */}
          {(isSuperAdmin(role) ||
            isSales(role) ||
            isAccountant(role)) && (
              <Dialog open={isMoreActionsOpen} onOpenChange={onMoreActionsOpenChange}>
                <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => onMoreActionsOpenChange(true)}>
                  <MoreVertical className="w-4 h-4 mr-2" /> More Actions
                </Button>
                <DialogContent className="sm:max-w-[350px] md:max-w-[550px] p-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg z-[9001]">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white">Order Actions</DialogTitle>
                    <DialogDescription className="text-gray-600 dark:text-gray-400">Select an action</DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-col gap-3 mt-4">
                    {customerPaymentStatus === 'new-unpaid' && canMarkAsPaid(role) && (
                      <Button
                        onClick={onMarkAsPaid}
                        className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                        disabled={isMarkingPaid}
                      >
                        {isMarkingPaid && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        <Wallet className="w-4 h-4 mr-2" /> Mark as Paid
                      </Button>
                    )}

                    {isSuperAdmin(role) && (
                      <Button
                        variant="destructive"
                        onClick={onDeleteClick}
                        className="w-full"
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Delete Order
                      </Button>
                    )}

                    {canTransitionToGeneral(status || '', 'Cancelled') &&
                      canCancelOrder(role) && (
                        <Button
                          variant="destructive"
                          onClick={onCancelOrder}
                          className="w-full"
                          disabled={isSaving}
                        >
                          {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          <XCircle className="w-4 h-4 mr-2" /> Cancel Order
                        </Button>
                      )}

                    {/* Edit History */}
                    <EditHistory
                      orderId={deoNo ?? ""}
                      currentUserProfile={currentUserProfile}
                    />

                  </div>
                  <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => onMoreActionsOpenChange(false)} disabled={isMarkingPaid}>
                      Close
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
        </>
      )}
    </DialogFooter>
  );
};

export default React.memo(OrderActionsFooter);
