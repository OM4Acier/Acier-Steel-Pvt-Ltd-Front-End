import { z } from 'zod';

const shippingAddressInputSchema = z.object({
    label: z.string().min(1).max(100),
    address: z.string().min(5).max(500),
});

export const createCustomerSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(200),
    phones: z
        .array(
            z.string()
             .regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number')
             .or(z.literal(''))
        )
        .min(1, 'At least one phone number is required')
        .refine(arr => arr.some(p => p.trim() !== ''), {
            message: "At least one valid phone number is required",
            path: [0] // Point to the first element if none are valid
        }),
    gst: z
        .string()
        .regex(
            /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
            'Invalid GST number'
        )
        .optional()
        .or(z.literal('')),
    pan: z
        .string()
        .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN number')
        .optional()
        .or(z.literal('')),
    billingAddress: z.string().min(5, 'Billing address must be at least 5 characters').max(500).optional().or(z.literal('')),
    shippingAddresses: z.array(shippingAddressInputSchema).max(20).optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();