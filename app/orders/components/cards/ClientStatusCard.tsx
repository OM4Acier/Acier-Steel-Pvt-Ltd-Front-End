// app/orders/components/cards/ClientStatusCard.tsx
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  User as UserIcon, Phone, MessageCircle, Calendar, Package, Zap,
  DollarSign, History, ChevronDown, ChevronUp,
} from 'lucide-react';
import {
  canEditSalesSpecificFields, canEditOperationsSpecificFields, isOperations,
  isSuperAdmin,
} from '../../permissions';
import { PAYMENT_STATUS_COLORS, STATUS_COLORS } from '../../constants';
import { formatContactNumberForWhatsApp } from '../../fileUtils';
import { ClientStatusCardProps } from './cardTypes';

const ClientStatusCard: React.FC<ClientStatusCardProps> = ({
  isEditMode, role, status, customerPaymentStatus, client, contactNo,
  organizationContact, partDelivery, isHighPriority, orderDate,
  isAdditionalInfoOpen, onAdditionalInfoToggle, onTextChange,
  onPaymentStatusChange, onPartDeliveryChange, onHighPriorityChange, onStatusSelectChange,
}) => {
  return (
    <div className="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 space-y-3">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 border-b pb-2">
        Client & Status
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Client */}
        <div className="space-y-1">
          <Label htmlFor="client" className="font-medium flex items-center gap-1 text-sm">
            <UserIcon className="w-4 h-4 text-gray-500" /> Client:
          </Label>
          {isEditMode && canEditSalesSpecificFields(role) ? (
            <Input id="client" value={client || ''} onChange={onTextChange} className="w-full h-9" />
          ) : (
            <span className="text-gray-800 dark:text-gray-200 block border p-2 rounded-md bg-gray-50 dark:bg-gray-700 text-sm">
              {client}
            </span>
          )}
        </div>

        {/* Contact */}
        <div className="space-y-1">
          <Label htmlFor="contactNo" className="font-medium flex items-center gap-1 text-sm">
            <Phone className="w-4 h-4 text-gray-500" /> Contact:
          </Label>
          {isEditMode && canEditSalesSpecificFields(role) ? (
            <>
              <Input
                id="contactNo"
                value={contactNo || ''}
                onChange={onTextChange}
                type="tel"
                maxLength={10}
                className="w-full h-9"
              />
              {contactNo && (
                <div className="flex gap-2 mt-1">
                  <Button variant="outline" size="sm" onClick={() => window.open(`tel:${contactNo}`, '_blank')} className="flex-1 h-8">
                    <Phone className="w-3 h-3 mr-1" /> Call
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.open(`https://wa.me/${formatContactNumberForWhatsApp(contactNo)}`, '_blank')} className="flex-1 text-green-600 border-green-300 hover:bg-green-50 h-8">
                    <MessageCircle className="w-3 h-3 mr-1" /> WhatsApp
                  </Button>
                </div>
              )}
            </>
          ) : (
            <>
              <span className="text-gray-800 dark:text-gray-200 block border p-2 rounded-md bg-gray-50 dark:bg-gray-700 text-sm">
                {contactNo || 'N/A'}
              </span>
              {contactNo && (
                <div className="flex gap-2 mt-1">
                  <Button variant="outline" size="sm" onClick={() => window.open(`tel:${contactNo}`, '_blank')} className="flex-1 h-8">
                    <Phone className="w-3 h-3 mr-1" /> Call
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.open(`https://wa.me/${formatContactNumberForWhatsApp(contactNo)}`, '_blank')} className="flex-1 text-green-600 border-green-300 hover:bg-green-50 h-8">
                    <MessageCircle className="w-3 h-3 mr-1" /> WhatsApp
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Org Contact */}
        <div className="space-y-1">
          <Label className="font-medium flex items-center gap-1 text-sm">
            <UserIcon className="w-4 h-4 text-gray-500" /> Org. Contact:
          </Label>
          <span className="text-gray-800 dark:text-gray-200 block border p-2 rounded-md bg-gray-50 dark:bg-gray-700 text-sm">
            {organizationContact || 'N/A'}
          </span>
        </div>

        {/* Part Delivery */}
        <div className="space-y-1">
          <Label htmlFor="partDelivery" className="font-medium flex items-center gap-1 text-sm">
            <Package className="w-4 h-4 text-gray-500" /> Part Delivery:
          </Label>
          {isEditMode && canEditOperationsSpecificFields(role) ? (
            <div className="flex items-center space-x-2 h-[36px]">
              <Checkbox
                id="partDelivery"
                checked={partDelivery || false}
                onCheckedChange={onPartDeliveryChange}
              />
              <Label htmlFor="partDelivery" className="font-normal text-sm">Enable Part Delivery</Label>
            </div>
          ) : (
            <span className="text-gray-800 dark:text-gray-200 block border p-2 rounded-md bg-gray-50 dark:bg-gray-700 h-[36px] flex items-center text-sm">
              {partDelivery ? 'Yes' : 'No'}
            </span>
          )}
        </div>

      </div>

      {/* Collapsible section for non-ops */}
      {isOperations(role) ? (
        <div className="pt-3 border-t dark:border-gray-700">
          <div
            className="flex justify-between items-center cursor-pointer"
            onClick={onAdditionalInfoToggle}
          >
            <h4 className="font-semibold text-gray-800 dark:text-white text-sm">Additional Info</h4>
            {isAdditionalInfoOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
          <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isAdditionalInfoOpen ? 'max-h-screen mt-3' : 'max-h-0'}`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="font-medium flex items-center gap-1 text-sm">
                  <Calendar className="w-4 h-4 text-gray-500" /> Order Date:
                </Label>
                <span className="text-gray-800 dark:text-gray-200 block border p-2 rounded-md bg-gray-50 dark:bg-gray-700 text-sm">
                  {orderDate || 'N/A'}
                </span>
              </div>
              <div className="space-y-1">
                <Label htmlFor="isHighPriority" className="font-medium flex items-center gap-1 text-sm">
                  <Zap className="w-4 h-4 text-gray-500" /> High Priority:
                </Label>
                {isEditMode && canEditSalesSpecificFields(role) ? (
                  <div className="flex items-center space-x-2 h-[36px]">
                    <Switch
                      id="isHighPriority"
                      checked={isHighPriority || false}
                      onCheckedChange={onHighPriorityChange}
                    />
                    <Label htmlFor="isHighPriority" className="font-normal text-sm">
                      {isHighPriority ? 'Enabled' : 'Disabled'}
                    </Label>
                  </div>
                ) : (
                  <span className={`text-gray-800 dark:text-gray-200 block border p-2 rounded-md bg-gray-50 dark:bg-gray-700 h-[36px] flex items-center text-sm ${isHighPriority ? 'text-red-500 font-bold' : ''}`}>
                    {isHighPriority ? 'Yes' : 'No'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t dark:border-gray-700">
          <div className="space-y-1">
            <Label className="font-medium flex items-center gap-1 text-sm">
              <Calendar className="w-4 h-4 text-gray-500" /> Order Date:
            </Label>
            <span className="text-gray-800 dark:text-gray-200 block border p-2 rounded-md bg-gray-50 dark:bg-gray-700 text-sm">
              {orderDate || 'N/A'}
            </span>
          </div>
          <div className="space-y-1">
            <Label htmlFor="isHighPriority" className="font-medium flex items-center gap-1 text-sm">
              <Zap className="w-4 h-4 text-gray-500" /> High Priority:
            </Label>
            {isEditMode && canEditSalesSpecificFields(role) ? (
              <div className="flex items-center space-x-2 h-[36px]">
                <Switch
                  id="isHighPriority"
                  checked={isHighPriority || false}
                  onCheckedChange={onHighPriorityChange}
                />
                <Label htmlFor="isHighPriority" className="font-normal text-sm">
                  {isHighPriority ? 'Enabled' : 'Disabled'}
                </Label>
              </div>
            ) : (
              <span className={`text-gray-800 dark:text-gray-200 block border p-2 rounded-md bg-gray-50 dark:bg-gray-700 h-[36px] flex items-center text-sm ${isHighPriority ? 'text-red-500 font-bold' : ''}`}>
                {isHighPriority ? 'Yes' : 'No'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Payment Status & Order Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t dark:border-gray-700">
        <div className="space-y-1">
          <Label htmlFor="customerPaymentStatus" className="font-medium flex items-center gap-1 text-sm">
            <DollarSign className="w-4 h-4 text-gray-500" /> Payment:
          </Label>
          {isEditMode && canEditSalesSpecificFields(role) ? (
            <Select onValueChange={onPaymentStatusChange} value={customerPaymentStatus || ''}>
              <SelectTrigger id="customerPaymentStatus" className="w-full h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[9050]">
                <SelectItem value="regular">Regular</SelectItem>
                <SelectItem value="new-paid">New Customer - Paid</SelectItem>
                <SelectItem value="new-unpaid">New Customer - Unpaid</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Badge
              className={`${PAYMENT_STATUS_COLORS[customerPaymentStatus ?? '']} font-medium p-2 text-xs`}
            >
              {customerPaymentStatus === 'new-paid'
                ? 'New - Paid'
                : customerPaymentStatus === 'new-unpaid'
                  ? 'New - Unpaid'
                  : 'Regular'}
            </Badge>

          )}
        </div>

        <div className="space-y-1">
          <Label className="font-medium flex items-center gap-1 text-sm">
            <History className="w-4 h-4 text-gray-500" /> Status:
          </Label>
          {isEditMode && isSuperAdmin(role) ? (
            <Select onValueChange={onStatusSelectChange} value={status || ''}>
              <SelectTrigger className="w-full h-9">
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent className="z-[9050]">
                <SelectItem value="Order Created">Order Created</SelectItem>
                <SelectItem value="Approved for Production">Approved for Production</SelectItem>
                <SelectItem value="Ready for Dispatch">Ready for Dispatch</SelectItem>
                <SelectItem value="Dispatched and Invoiced">Dispatched and Invoiced</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Badge className={`${STATUS_COLORS[status || 'Order Created']} text-white font-semibold px-2 py-1 rounded-full text-xs`}>
              {status}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(ClientStatusCard);
