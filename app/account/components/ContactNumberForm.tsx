'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { accountApi } from '@/lib/api/endpoints/accountApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Loader2, Check, Save } from 'lucide-react';
import { toast } from 'sonner';

const phoneRegex = /^\+?[1-9]\d{1,14}$/;

const contactSchema = z.object({
  contactNo: z.string()
    .min(10, { message: 'Phone number must be at least 10 digits' })
    .max(15, { message: 'Phone number is too long' })
    .regex(phoneRegex, { message: 'Invalid phone format (E.164 recommended, e.g. +91...)' }),
});

type ContactFormValues = z.infer<typeof contactSchema>;

interface ContactNumberFormProps {
  initialValue: string;
  onSuccess: (newVal: string) => void;
}

export function ContactNumberForm({ initialValue, onSuccess }: ContactNumberFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: { contactNo: initialValue },
  });

  const onSubmit = async (data: ContactFormValues) => {
    setIsSubmitting(true);
    try {
      const res = await accountApi.updateContactNo(data.contactNo);
      if (res.success) {
        toast.success('Contact number updated successfully');
        onSuccess(data.contactNo);
      }
    } catch (err: any) {
      if (err.message !== 'Request cancelled') {
        const message = err.status === 400 ? err.message : 'Failed to update contact number';
        toast.error(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDirty = form.formState.isDirty;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="contactNo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone Number</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input 
                    {...field} 
                    placeholder="+919876543210" 
                    disabled={isSubmitting}
                    className="pr-10"
                  />
                  {isDirty && !form.formState.errors.contactNo && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                    </div>
                  )}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button 
          type="submit" 
          disabled={isSubmitting || !isDirty} 
          className="w-full"
          variant={isDirty ? "default" : "secondary"}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Update Contact
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}
