import { apiClient } from '../client';
import { UserRole } from '@/types/rbac.types';
import {
  Order,
  UserProfile,
  EditHistoryEntry,
  DeoNumbersByPrefix,
} from '@/app/orders/types';

/**
 * lib/api/endpoints/ordersApi.ts
 *
 * Centralized API endpoints for Orders.
 */
export const ordersApi = {
  // User Management
  registerUser: async (
    email: string,
    password: string,
    role: UserRole = 'sales',
    name?: string,
    contactNo?: string,
    organization?: string
  ) => {
    return apiClient.post('/register', { email, password, role, name, contactNo, organization });
  },

  loginUser: async (email: string, password: string) => {
    return apiClient.post('/login', { email, password });
  },

  logoutUser: async () => {
    return apiClient.post('/logout');
  },

  fetchUsers: async (): Promise<UserProfile[]> => {
    return apiClient.get<UserProfile[]>('/users');
  },

  updateUser: async (
    userId: string,
    updatedFields: Partial<Omit<UserProfile, 'id' | 'accessToken'>>
  ): Promise<UserProfile> => {
    const updatedUser = await apiClient.put<any>(`/users/${userId}`, updatedFields);
    return { ...updatedUser, id: updatedUser._id };
  },

  deleteUser: async (userId: string): Promise<void> => {
    await apiClient.delete(`/users/${userId}`);
  },

  // Order Management
  /**
   * Fetch all orders
   */
  fetchOrders: async (): Promise<Order[]> => {
    const orders = await apiClient.get<any[]>('/orders');
    if (!orders) return [];
    if (!Array.isArray(orders)) {
      console.error('[ordersApi] Expected array but got:', orders);
      return [];
    }
    return orders.map((order: any) => ({ ...order, id: order._id }));
  },

  /**
   * Fetch a single order by deoNo
   */
  fetchOrder: async (deoNo: string): Promise<Order> => {
    const response = await apiClient.get<any>(`/orders/${encodeURIComponent(deoNo)}`);
    if (!response) throw new Error('Request cancelled');
    const order = response.order;
    if (!order) {
      throw new Error("Invalid server response: missing order field");
    }
    return {
      ...order,
      id: order._id,
    };
  },

  addOrder: async (
    orderData: Omit<Order, 'id' | 'status' | 'editHistory'> & { organizationContact: string }
  ): Promise<Order> => {
    const newOrder = await apiClient.post<any>('/orders', orderData);
    if (!newOrder) throw new Error('Request cancelled');
    const order = newOrder.order;
    return { ...order, id: order._id };
  },

  updateOrder: async (
    deoNo: string,
    updatedFields: Partial<Omit<Order, 'id' | 'editHistory'>>,
    editHistory: EditHistoryEntry
  ): Promise<Order> => {
    const updatedOrder = await apiClient.put<any>(`/orders/${deoNo}`, { ...updatedFields, editHistory });
    if (!updatedOrder) throw new Error('Request cancelled');
    return { ...updatedOrder, id: updatedOrder._id };
  },

  updateOrderStatus: async (
    deoNo: string,
    newStatus: string,
    editHistory: EditHistoryEntry,
    extra?: Record<string, unknown>
  ): Promise<Order> => {
    const updatedOrder = await apiClient.put<any>(`/orders/${deoNo}`, { status: newStatus, editHistory, ...extra });
    if (!updatedOrder) throw new Error('Request cancelled');
    return { ...updatedOrder, id: updatedOrder._id };
  },

  deleteOrder: async (deoNo: string): Promise<void> => {
    await apiClient.delete(`/orders/${deoNo}`);
  },

  // File Management
  uploadFile: async (
    deoNo: string,
    uploadStage: 'product' | 'vehicle' | 'invoice' | 'productVoiceNote' | 'invoiceVoiceNote',
    files: { filename: string; mimeType: string; fileBase64: string }[]
  ) => {
    return apiClient.post('/files/upload', { deoNo, uploadStage, files });
  },

  deleteFile: async (fileId: string) => {
    return apiClient.post('/files/delete', { fileId });
  },

  // Edit History
  fetchEditHistory: async (deoNo: string): Promise<EditHistoryEntry[]> => {
    const response = await apiClient.get<any>(`/orders/${deoNo}/history`);
    if (!response) throw new Error('Request cancelled');
    return response.history;
  },

  // DEO Numbers
  fetchRecentOrderNumbers: async (): Promise<DeoNumbersByPrefix> => {
    const res = await apiClient.get<DeoNumbersByPrefix>('/recent-numbers/ORDER');
    if (!res) throw new Error('Request cancelled');
    return res;
  },
};
