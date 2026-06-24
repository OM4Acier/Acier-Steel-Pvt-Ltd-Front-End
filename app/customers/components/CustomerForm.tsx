'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, X, Loader2, Save, MapPin, Phone, Building2 } from 'lucide-react';
import {
  customersApi,
  CreateCustomerPayload,
  CustomerSummary,
} from '@/lib/api/endpoints/customers';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { createCustomerSchema } from '@/lib/validations/customer.schema';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CustomerFormProps {
  customer?: CustomerSummary | null;
  /** When true: all inputs are read-only and action buttons are hidden */
  readOnly?: boolean;
  onSuccess: (customer: CustomerSummary) => void;
  onCancel: () => void;
  className?: string;
}

// ─── Shared style constants ───────────────────────────────────────────────────

const S = {
  sectionLabel: 'text-[21px] font-semibold tracking-tight text-[#1d1d1f] mb-3 flex items-center gap-2 font-display',
  inputWrapper: 'space-y-1',
  label: 'text-[14px] font-medium text-[#1d1d1f] ml-1 font-text',
  // Editable
  input: 'rounded-full h-12 border-[#e0e0e0] bg-white px-5 text-[17px] focus:border-[#0066cc] focus:ring-0 transition-all font-text',
  textarea: 'rounded-[18px] min-h-[120px] p-5 border-[#e0e0e0] bg-white text-[17px] focus:border-[#0066cc] focus:ring-0 transition-all font-text leading-relaxed',
  // Read-only
  roInput: 'rounded-full h-12 border-transparent bg-[#f5f5f7] px-5 text-[17px] font-text text-[#1d1d1f] cursor-default select-text',
  roTextarea: 'rounded-[18px] min-h-[120px] p-5 border-transparent bg-[#f5f5f7] text-[17px] font-text text-[#1d1d1f] cursor-default select-text leading-relaxed',
} as const;

// ─── Component ───────────────────────────────────────────────────────────────

export const CustomerForm: React.FC<CustomerFormProps> = ({
  customer,
  readOnly = false,
  onSuccess,
  onCancel,
  className,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isAddressLoading, setIsAddressLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<CreateCustomerPayload>({
    name: customer?.name || '',
    gst: customer?.gst || '',
    pan: customer?.pan || '',
    phones: customer?.phones?.length ? customer?.phones : [''],
    billingAddress: '',
    shippingAddresses: [],
  });

  // ─── Fetch full details when viewing/editing an existing customer ──────────

  useEffect(() => {
    if (!customer) return;

    // Populate summary data immediately
    setFormData((prev) => ({
      ...prev,
      name: customer.name,
      gst: customer.gst ?? '',
      pan: customer.pan ?? '',
      phones: customer.phones?.length ? customer.phones : [''],
    }));

    const fetchAddresses = async () => {
      setIsAddressLoading(true);
      try {
        const addresses = await customersApi.fetchCustomerAddresses(customer.id);
        setFormData((prev) => ({
          ...prev,
          billingAddress: addresses.billingAddress ?? '',
          shippingAddresses: addresses.shippingAddresses.map((sa) => ({
            label: sa.label,
            address: sa.address,
          })),
        }));
      } catch (error: unknown) {
        if (error instanceof Error && error.message === 'Request cancelled') return;
        const msg = error instanceof Error ? error.message : String(error);
        toast.error(`Failed to fetch address details: ${msg}`);
      } finally {
        setIsAddressLoading(false);
      }
    };

    fetchAddresses();
  }, [customer]);

  // ─── Error helpers ────────────────────────────────────────────────────────

  const clearError = (path: string) => {
    if (!errors[path]) return;
    setErrors((prev) => {
      const next = { ...prev };
      delete next[path];
      return next;
    });
  };

  const InlineError = ({ path }: { path: string }) => {
    const message = errors[path];
    if (!message) return null;
    return (
      <p className="text-[12px] font-medium text-red-500 mt-1 ml-4 font-text animate-in fade-in slide-in-from-top-1 duration-200">
        {message}
      </p>
    );
  };

  // ─── Change handlers ──────────────────────────────────────────────────────

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;

    if (id === 'gst') {
      const gstValue = value.toUpperCase().slice(0, 15);
      const extractedPan = gstValue.length >= 12 ? gstValue.substring(2, 12) : formData.pan;
      setFormData((prev) => ({ ...prev, gst: gstValue, pan: extractedPan }));
      clearError('gst');
      if (extractedPan !== formData.pan) clearError('pan');
      return;
    }

    setFormData((prev) => ({ ...prev, [id]: value }));
    clearError(id);
  };

  const handleContactChange = (index: number, value: string) => {
    const updated = [...formData.phones];
    updated[index] = value;
    setFormData((prev) => ({ ...prev, phones: updated }));
    clearError(`phones_${index}`);
  };

  const addContact = () =>
    setFormData((prev) => ({ ...prev, phones: [...prev.phones, ''] }));

  const removeContact = (index: number) => {
    if (formData.phones.length <= 1) return;
    setFormData((prev) => ({ ...prev, phones: prev.phones.filter((_, i) => i !== index) }));
    clearError(`phones_${index}`);
  };

  const handleShippingChange = (index: number, field: 'label' | 'address', value: string) => {
    const updated = [...(formData.shippingAddresses ?? [])];
    updated[index] = { ...updated[index], [field]: value };
    setFormData((prev) => ({ ...prev, shippingAddresses: updated }));
    clearError(`shippingAddresses_${index}_${field}`);
  };

  const addShipping = () =>
    setFormData((prev) => ({
      ...prev,
      shippingAddresses: [...(prev.shippingAddresses ?? []), { label: '', address: '' }],
    }));

  const removeShipping = (index: number) =>
    setFormData((prev) => ({
      ...prev,
      shippingAddresses: (prev.shippingAddresses ?? []).filter((_, i) => i !== index),
    }));

  // ─── Submit ───────────────────────────────────────────────────────────────

  // FIX #7: form onSubmit is the single entry point; Save button uses type="submit"
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly || isLoading || isAddressLoading) return;

    const submissionData = {
      ...formData,
      phones: formData.phones.filter((p) => p.trim() !== ''),
    };

    const validation = createCustomerSchema.safeParse(submissionData);
    if (!validation.success) {
      const newErrors: Record<string, string> = {};
      let firstErrorPath = '';

      validation.error.issues.forEach((issue) => {
        const path = issue.path.join('_');
        if (!newErrors[path]) {
          newErrors[path] = issue.message;
          if (!firstErrorPath) firstErrorPath = path;
        }
      });

      setErrors(newErrors);

      if (firstErrorPath) {
        setTimeout(() => {
          const el = document.getElementById(firstErrorPath);
          el?.focus();
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }

      toast.error('Please correct the highlighted errors');
      return;
    }

    setErrors({});
    setIsLoading(true);
    try {
      const payload: CreateCustomerPayload = {
        ...submissionData,
        gst: submissionData.gst || undefined,
        pan: submissionData.pan || undefined,
        billingAddress: submissionData.billingAddress || undefined,
      };

      let result: CustomerSummary;
      if (customer) {
        result = await customersApi.updateCustomer(customer.id, payload);
        toast.success('Profile updated successfully');
      } else {
        result = await customersApi.createCustomer(payload);
        toast.success('Customer profile created');
      }

      onSuccess(result);
    } catch (error: unknown) {
      // FIX #5: safe error extraction, no `any`
      const msg = error instanceof Error ? error.message : 'Action failed';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-8 py-4', className)} noValidate>

      {/* ── Identity ─────────────────────────────────────────────────────── */}
      <section>
        <h3 className={S.sectionLabel}>
          <Building2 className="w-5 h-5 text-[#0066cc]" /> Entity Identity
        </h3>
        <div className="grid gap-3">
          <div className={S.inputWrapper}>
            <Label htmlFor="name" className={S.label}>Legal Business Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={readOnly ? undefined : handleChange}
              placeholder="e.g. Tata Motors Ltd"
              readOnly={readOnly}
              className={cn(
                readOnly ? S.roInput : S.input,
                !readOnly && errors.name && 'border-red-500 bg-red-50/10',
              )}
            />
            {!readOnly && <InlineError path="name" />}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className={S.inputWrapper}>
              <Label htmlFor="gst" className={S.label}>
                GST Number{!readOnly && ' (Optional)'}
              </Label>
              <Input
                id="gst"
                value={formData.gst || (readOnly ? '—' : '')}
                onChange={readOnly ? undefined : handleChange}
                placeholder="27AAACT..."
                readOnly={readOnly}
                className={cn(
                  readOnly ? cn(S.roInput, 'font-mono uppercase') : cn(S.input, 'font-mono uppercase'),
                  !readOnly && errors.gst && 'border-red-500 bg-red-50/10',
                )}
              />
              {!readOnly && <InlineError path="gst" />}
            </div>

            <div className={S.inputWrapper}>
              <Label htmlFor="pan" className={S.label}>
                PAN Card{!readOnly && ' (Optional)'}
              </Label>
              <Input
                id="pan"
                value={formData.pan || (readOnly ? '—' : '')}
                onChange={readOnly ? undefined : handleChange}
                placeholder="AAACT..."
                readOnly={readOnly}
                className={cn(
                  readOnly ? cn(S.roInput, 'font-mono uppercase') : cn(S.input, 'font-mono uppercase'),
                  !readOnly && errors.pan && 'border-red-500 bg-red-50/10',
                )}
              />
              {!readOnly && <InlineError path="pan" />}
            </div>
          </div>
        </div>
      </section>

      {/* ── Communication ────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className={S.sectionLabel}>
            <Phone className="w-5 h-5 text-[#0066cc]" /> Communication
          </h3>
          {!readOnly && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addContact}
              className="h-8 px-4 rounded-full text-[14px] font-medium text-[#0066cc] hover:bg-[#f5f5f7] transition-all font-text"
            >
              <Plus className="w-4 h-4 mr-1" /> Add Channel
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {formData.phones.map((phone, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex gap-3 items-center">
                <Input
                  id={`phones_${idx}`}
                  value={phone}
                  onChange={readOnly ? undefined : (e) => handleContactChange(idx, e.target.value)}
                  placeholder="Phone number"
                  readOnly={readOnly}
                  className={cn(
                    'flex-1',
                    readOnly ? S.roInput : S.input,
                    !readOnly && errors[`phones_${idx}`] && 'border-red-500 bg-red-50/10',
                  )}
                />
                {!readOnly && formData.phones.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeContact(idx)}
                    className="h-10 w-10 rounded-full text-[#7a7a7a] hover:text-red-500 hover:bg-red-50 transition-all"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                )}
              </div>
              {!readOnly && <InlineError path={`phones_${idx}`} />}
            </div>
          ))}
        </div>
      </section>

      {/* ── Addresses ────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className={S.inputWrapper}>
          <h3 className={S.sectionLabel}>
            <MapPin className="w-5 h-5 text-[#0066cc]" />
            Primary Billing Address{!readOnly && ' (Optional)'}
            {isAddressLoading && <Loader2 className="w-4 h-4 animate-spin text-[#0066cc]" />}
          </h3>
          <Textarea
            id="billingAddress"
            value={formData.billingAddress || (readOnly ? '—' : '')}
            onChange={readOnly ? undefined : handleChange}
            placeholder={isAddressLoading ? 'Loading address details...' : 'Complete registered address for invoicing...'}
            readOnly={readOnly || isAddressLoading}
            className={cn(
              readOnly ? S.roTextarea : S.textarea,
              !readOnly && errors.billingAddress && 'border-red-300 bg-red-50/10',
              isAddressLoading && 'opacity-60 cursor-wait',
            )}
          />
          {!readOnly && <InlineError path="billingAddress" />}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className={S.sectionLabel}>
              Secondary Logistics Hubs
              {isAddressLoading && <Loader2 className="w-4 h-4 animate-spin text-[#0066cc]" />}
            </h3>
            {!readOnly && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addShipping}
                disabled={isAddressLoading}
                className="h-8 px-4 rounded-full text-[14px] font-medium text-[#0066cc] hover:bg-[#f5f5f7] transition-all font-text"
              >
                <Plus className="w-4 h-4 mr-1" /> Add Hub
              </Button>
            )}
          </div>

          <div className="grid gap-3">
            {isAddressLoading ? (
              <div className="text-center py-10 rounded-[18px] border-2 border-dashed border-[#f0f0f0] bg-[#f5f5f7]/30">
                <Loader2 className="w-8 h-8 animate-spin text-[#cccccc] mx-auto mb-2" />
                <p className="text-[14px] font-medium text-[#aaaaaa] font-text uppercase tracking-widest">
                  Fetching Hubs...
                </p>
              </div>
            ) : (
              <>
                {(formData.shippingAddresses ?? []).map((ship, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'p-4 rounded-[18px] space-y-3 relative group transition-all',
                      readOnly
                        ? 'bg-[#f5f5f7] border border-transparent'
                        : 'bg-[#f5f5f7] border border-[#e0e0e0]',
                    )}
                  >
                    {!readOnly && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeShipping(idx)}
                        className="absolute top-3 right-3 h-8 w-8 rounded-full text-[#7a7a7a] hover:text-red-500 hover:bg-white transition-all opacity-0 group-hover:opacity-100"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}

                    <div className="space-y-1">
                      <Label htmlFor={`shippingAddresses_${idx}_label`} className={S.label}>
                        Hub Identity
                      </Label>
                      <Input
                        id={`shippingAddresses_${idx}_label`}
                        value={ship.label}
                        onChange={readOnly ? undefined : (e) => handleShippingChange(idx, 'label', e.target.value)}
                        placeholder="e.g. Pune Factory, Site A"
                        readOnly={readOnly}
                        className={cn(
                          readOnly
                            ? 'rounded-full h-10 border-transparent bg-white px-4 text-[15px] font-text cursor-default'
                            : 'rounded-full h-10 border-[#e0e0e0] bg-white px-4 text-[15px] focus:border-[#0066cc] focus:ring-0 transition-all font-text',
                          !readOnly && errors[`shippingAddresses_${idx}_label`] && 'border-red-500 bg-red-50/10',
                        )}
                      />
                      {!readOnly && <InlineError path={`shippingAddresses_${idx}_label`} />}
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor={`shippingAddresses_${idx}_address`} className={S.label}>
                        Dispatch Address
                      </Label>
                      <Textarea
                        id={`shippingAddresses_${idx}_address`}
                        value={ship.address}
                        onChange={readOnly ? undefined : (e) => handleShippingChange(idx, 'address', e.target.value)}
                        placeholder="Exact drop-off location..."
                        readOnly={readOnly}
                        className={cn(
                          readOnly
                            ? 'rounded-[11px] min-h-[80px] p-4 text-[14px] border-transparent bg-white font-text leading-relaxed cursor-default'
                            : 'rounded-[11px] min-h-[80px] p-4 text-[14px] border-[#e0e0e0] bg-white focus:border-[#0066cc] focus:ring-0 transition-all font-text leading-relaxed',
                          !readOnly && errors[`shippingAddresses_${idx}_address`] && 'border-red-500 bg-red-50/10',
                        )}
                      />
                      {!readOnly && <InlineError path={`shippingAddresses_${idx}_address`} />}
                    </div>
                  </div>
                ))}

                {(formData.shippingAddresses ?? []).length === 0 && (
                  <div className="text-center py-6 rounded-[18px] border-2 border-dashed border-[#e0e0e0] bg-[#f5f5f7]/50">
                    <MapPin className="w-10 h-10 text-[#cccccc] mx-auto mb-2" />
                    <p className="text-[14px] font-medium text-[#7a7a7a] font-text uppercase tracking-widest">
                      No secondary sites added
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── Actions (hidden in readOnly / view mode) ──────────────────────── */}
      {!readOnly && (
        <div className="flex w-full gap-4 pt-5 border-t border-[#f0f0f0]">
          {/* FIX #8: explicit type="button" prevents accidental form submission */}
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            className="flex-1 h-12 rounded-full font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] transition-all font-text text-[17px]"
          >
            Discard
          </Button>
          {/* FIX #7: type="submit" — no onClick needed; form.onSubmit is the handler */}
          <Button
            type="submit"
            disabled={isLoading || isAddressLoading}
            className="flex-[2] h-12 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white font-semibold text-[17px] transition-all active:scale-[0.98] font-text"
          >
            {isLoading || isAddressLoading ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : (
              <Save className="w-5 h-5 mr-2" />
            )}
            {customer ? 'Update Master Data' : 'Create Entity'}
          </Button>
        </div>
      )}
    </form>
  );
};