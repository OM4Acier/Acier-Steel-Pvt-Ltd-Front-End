import { apiClient } from '@/lib/api/client';

export interface CustomerSummary {
  id:        string;
  name:      string;
  gst:       string | null;
  pan:       string | null;
  phones:    string[];
  updatedAt: string;
}

export interface ShippingAddress {
  id:      string;
  label:   string;
  address: string;
}

export interface CustomerAddresses {
  customerId:        string;
  billingAddress:    string | null;
  shippingAddresses: ShippingAddress[];
}

export interface ShippingAddressInput {
  label:   string;
  address: string;
}

export interface CreateCustomerPayload {
  name:               string;
  phones:             string[];
  gst?:               string;
  pan?:               string;
  billingAddress?:    string;
  shippingAddresses?: ShippingAddressInput[];
}

export type UpdateCustomerPayload = Partial<CreateCustomerPayload>;

export interface ApiResponse<T>  { success: boolean; data: T; message?: string; }
export interface ListResponse<T> { success: boolean; data: T[]; total: number; }

export const customersApi = {
  fetchCustomers: async (search?: string): Promise<CustomerSummary[]> => {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    const res = await apiClient.get<ApiResponse<CustomerSummary[]>>(`/customers${query}`);
    if (!res) throw new Error('Request cancelled');
    return res.data || [];
  },

  fetchCustomerAddresses: async (customerId: string): Promise<CustomerAddresses> => {
    const res = await apiClient.get<ApiResponse<CustomerAddresses>>(`/customers/${customerId}/addresses`);
    if (!res) throw new Error('Request cancelled');
    return res.data;
  },

  createCustomer: async (payload: CreateCustomerPayload): Promise<CustomerSummary> => {
    const res = await apiClient.post<ApiResponse<CustomerSummary>>('/customers', payload);
    if (!res) throw new Error('Request cancelled');
    return res.data;
  },

  updateCustomer: async (id: string, payload: UpdateCustomerPayload): Promise<CustomerSummary> => {
    const res = await apiClient.put<ApiResponse<CustomerSummary>>(`/customers/${id}`, payload);
    if (!res) throw new Error('Request cancelled');
    return res.data;
  },

  deleteCustomer: async (id: string): Promise<void> => {
    await apiClient.delete<ApiResponse<any>>(`/customers/${id}`);
  },
};
