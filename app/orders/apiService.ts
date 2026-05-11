// apiService.ts - Centralized API Service

import { UserRole } from '@/types/rbac.types';
import { BASE_API_URL, STATUS_TRANSITIONS } from './constants';
import {
  Order,
  UserProfile,
  EditHistoryEntry,
  DeoNumbersByPrefix,
} from './types';

// Custom error class with structured HTTP properties
export class ApiError extends Error {
  public readonly status: number;
  public readonly statusText: string;
  public readonly url: string;
  public readonly method: string;
  public readonly response?: any;
  public readonly timestamp: string;

  constructor(
    message: string,
    status: number,
    statusText: string,
    url: string,
    method: string,
    response?: any
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.url = url;
    this.method = method;
    this.response = response;
    this.timestamp = new Date().toISOString();

    // Maintains proper stack trace for where error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  // Helper methods for common status checks
  isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  isServerError(): boolean {
    return this.status >= 500;
  }

  isUnauthorized(): boolean {
    return this.status === 401;
  }

  isForbidden(): boolean {
    return this.status === 403;
  }

  isNotFound(): boolean {
    return this.status === 404;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      statusText: this.statusText,
      url: this.url,
      method: this.method,
      response: this.response,
      timestamp: this.timestamp,
    };
  }
}

// Configuration interface
export interface ApiServiceConfig {
  baseUrl?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  onError?: (error: ApiError) => void;
  onRequest?: (url: string, options: RequestInit) => void;
  onResponse?: (response: Response) => void;
}

// Request options with retry configuration
export interface RequestOptions extends RequestInit {
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  skipRetry?: boolean;
}



export class ApiService {
  private config: ApiServiceConfig;

  constructor(config: ApiServiceConfig = {}) {
    this.config = {
      timeout: 60000, // 30 seconds default
      retryAttempts: 1,
      retryDelay: 1000,
      ...config,
    };
  }

  /**
   * Main fetch method with enhanced error handling
   */
  private async authFetch(
    url: string,
    options: RequestOptions = {},
    accessToken?: string
  ): Promise<any> {
    const {
      timeout = this.config.timeout,
      retryAttempts = this.config.retryAttempts,
      retryDelay = this.config.retryDelay,
      skipRetry = false,
      ...fetchOptions
    } = options;

    const fullUrl = this.config.baseUrl ? `${this.config.baseUrl}${url}` : url;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((fetchOptions.headers as Record<string, string>) || {}),
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const requestOptions: RequestInit = {
      ...fetchOptions,
      headers,
    };

    // Request interceptor
    if (this.config.onRequest) {
      this.config.onRequest(fullUrl, requestOptions);
    }

    let lastError: ApiError | null = null;
    const attempts = skipRetry ? 1 : retryAttempts!;

    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const response = await this.fetchWithTimeout(
          fullUrl,
          requestOptions,
          timeout!
        );

        // Response interceptor
        if (this.config.onResponse) {
          this.config.onResponse(response);
        }

        if (!response.ok) {
          const error = await this.handleErrorResponse(
            response,
            fullUrl,
            requestOptions.method || 'GET'
          );
          throw error;
        }

        return await this.parseResponse(response);
      } catch (error) {
        lastError = error instanceof ApiError
          ? error
          : this.createUnknownError(error, fullUrl, requestOptions.method || 'GET');

        // Don't retry on client errors (4xx) or if skipRetry is true
        if (lastError.isClientError() || skipRetry || attempt === attempts - 1) {
          break;
        }

        // Exponential backoff for retries
        await this.sleep(retryDelay! * Math.pow(2, attempt));
      }
    }

    // Call error callback if configured
    if (this.config.onError && lastError) {
      this.config.onError(lastError);
    }

    throw lastError;
  }

  /**
   * Handle error responses with priority on error.message
   */
  private async handleErrorResponse(
    response: Response,
    url: string,
    method: string
  ): Promise<ApiError> {
    let errorData: any = null;
    let errorMessage = response.statusText;

    try {
      const contentType = response.headers.get('content-type');

      if (contentType?.includes('application/json')) {
        errorData = await response.json();

        // Priority order for error messages:
        // 1. error.message (most specific)
        // 2. error.error (fallback)
        // 3. error (if it's a string)
        // 4. response.statusText (last resort)
        if (errorData) {
          errorMessage =
            errorData.message ||
            errorData.error ||
            (typeof errorData === 'string' ? errorData : null) ||
            errorMessage;
        }
      } else {
        // For non-JSON responses, try to get text
        errorData = await response.text();
        if (errorData && typeof errorData === 'string' && errorData.length < 200) {
          errorMessage = errorData;
        }
      }
    } catch (parseError) {
      // If parsing fails, use the status text
      console.warn('Failed to parse error response:', parseError);
    }

    return new ApiError(
      errorMessage,
      response.status,
      response.statusText,
      url,
      method,
      errorData
    );
  }

  /**
   * Create error for non-HTTP errors (network issues, timeouts, etc.)
   */
  private createUnknownError(
    error: unknown,
    url: string,
    method: string
  ): ApiError {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';

    return new ApiError(
      message,
      0, // Status 0 indicates network/unknown error
      'Network Error',
      url,
      method,
      error
    );
  }

  /**
   * Fetch with timeout support
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Parse response based on content type
   */
  private async parseResponse(response: Response): Promise<any> {
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      return response.json();
    }

    if (contentType?.includes('text/')) {
      return response.text();
    }

    if (contentType?.includes('application/octet-stream')) {
      return response.blob();
    }

    // Default to json
    return response.json().catch(() => response.text());
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public API methods
  public async get<T = any>(
    url: string,
    options?: RequestOptions,
    accessToken?: string
  ): Promise<T> {
    return this.authFetch(url, { ...options, method: 'GET' }, accessToken);
  }

  public async post<T = any>(
    url: string,
    data?: any,
    options?: RequestOptions,
    accessToken?: string
  ): Promise<T> {
    return this.authFetch(
      url,
      {
        ...options,
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined,
      },
      accessToken
    );
  }

  public async put<T = any>(
    url: string,
    data?: any,
    options?: RequestOptions,
    accessToken?: string
  ): Promise<T> {
    return this.authFetch(
      url,
      {
        ...options,
        method: 'PUT',
        body: data ? JSON.stringify(data) : undefined,
      },
      accessToken
    );
  }

  public async patch<T = any>(
    url: string,
    data?: any,
    options?: RequestOptions,
    accessToken?: string
  ): Promise<T> {
    return this.authFetch(
      url,
      {
        ...options,
        method: 'PATCH',
        body: data ? JSON.stringify(data) : undefined,
      },
      accessToken
    );
  }

  public async delete<T = any>(
    url: string,
    options?: RequestOptions,
    accessToken?: string
  ): Promise<T> {
    return this.authFetch(url, { ...options, method: 'DELETE' }, accessToken);
  }
  // User Management
  async registerUser(
    email: string,
    password: string,
    role: UserRole = 'sales',
    name?: string,
    contactNo?: string,
    organization?: string
  ) {
    return this.authFetch(`${BASE_API_URL}/register`, {
      method: 'POST',
      body: JSON.stringify({ email, password, role, name, contactNo, organization }),
    });
  }

  async loginUser(email: string, password: string) {
    return this.authFetch(`${BASE_API_URL}/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async logoutUser() {
    const response = await fetch(`${BASE_API_URL}/logout`, { method: 'POST' });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || response.statusText);
    }
    return response.json();
  }

  async fetchUsers(accessToken: string): Promise<UserProfile[]> {
    const users = await this.authFetch(`${BASE_API_URL}/users`, { method: 'GET' }, accessToken);
    return users;
  }

  async updateUser(
    userId: string,
    updatedFields: Partial<Omit<UserProfile, 'id' | 'accessToken'>>,
    accessToken: string
  ): Promise<UserProfile> {
    const updatedUser = await this.authFetch(
      `${BASE_API_URL}/users/${userId}`,
      {
        method: 'PUT',
        body: JSON.stringify(updatedFields),
      },
      accessToken
    );
    return { ...updatedUser, id: updatedUser._id };
  }

  async deleteUser(userId: string, accessToken: string): Promise<void> {
    await this.authFetch(`${BASE_API_URL}/users/${userId}`, { method: 'DELETE' }, accessToken);
  }

  // Order Management
  /**
   * Fetch all orders
   */
  async fetchOrders(accessToken: string): Promise<Order[]> {
    const orders = await this.authFetch(
      `${BASE_API_URL}/orders`,
      { method: 'GET' },
      accessToken
    );
    return orders.map((order: any) => ({ ...order, id: order._id }));
  }

  /**
   * Fetch a single order by deoNo
   */
  async fetchOrder(deoNo: string, accessToken: string): Promise<Order> {
    const response = await this.authFetch(
      `${BASE_API_URL}/orders/${encodeURIComponent(deoNo)}`,
      { method: "GET" },
      accessToken
    );

    // Extract the order object from API response
    const order = response.order;

    if (!order) {
      throw new Error("Invalid server response: missing order field");
    }

    return {
      ...order,
      id: order._id, // normalize to id
    };
  }


  async addOrder(
    orderData: Omit<Order, 'id' | 'status' | 'editHistory'> & { organizationContact: string },
    accessToken: string
  ): Promise<Order> {
    const newOrder = await this.authFetch(
      `${BASE_API_URL}/orders`,
      {
        method: 'POST',
        body: JSON.stringify(orderData),
      },
      accessToken
    );
    const order = newOrder.order;
    return { ...order, id: order._id };
  }

  async updateOrder(
    deoNo: string,
    updatedFields: Partial<Omit<Order, 'id' | 'editHistory'>>,
    editHistory: EditHistoryEntry,
    accessToken: string
  ): Promise<Order> {
    const updatedOrder = await this.authFetch(
      `${BASE_API_URL}/orders/${deoNo}`,
      {
        method: 'PUT',
        body: JSON.stringify({ ...updatedFields, editHistory }),
      },
      accessToken
    );
    return { ...updatedOrder, id: updatedOrder._id };
  }

  async updateOrderStatus(
    deoNo: string,
    newStatus: string,
    editHistory: EditHistoryEntry,
    accessToken: string
  ): Promise<Order> {
    const updatedOrder = await this.authFetch(
      `${BASE_API_URL}/orders/${deoNo}`,
      {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus, editHistory }),
      },
      accessToken
    );
    return { ...updatedOrder, id: updatedOrder._id };
  }

  async deleteOrder(deoNo: string, accessToken: string): Promise<void> {
    await this.authFetch(`${BASE_API_URL}/orders/${deoNo}`, { method: 'DELETE' }, accessToken);
  }

  // File Management
  async uploadFile(
    deoNo: string,
    uploadStage: 'product' | 'vehicle' | 'invoice' | 'productVoiceNote' | 'invoiceVoiceNote',
    files: { filename: string; mimeType: string; fileBase64: string }[],
    accessToken: string
  ) {
    return this.authFetch(
      `${BASE_API_URL}/files/upload`,
      {
        method: 'POST',
        body: JSON.stringify({ deoNo, uploadStage, files }),
      },
      accessToken
    );
  }

  async deleteFile(fileId: string, accessToken: string) {
    return this.authFetch(
      `${BASE_API_URL}/files/delete`,
      {
        method: 'POST',
        body: JSON.stringify({ fileId }),
      },
      accessToken
    );
  }

  //EditHistry
  async fetchEditHistory(deoNo: string, accessToken: string): Promise<EditHistoryEntry[]> {
    const response = await this.authFetch(
      `${BASE_API_URL}/orders/${deoNo}/history`,
      { method: 'GET' },
      accessToken
    );
    return response.history;
  }


  // DEO Numbers
  async fetchRecentOrderNumbers(accessToken: string): Promise<DeoNumbersByPrefix> {
    const response = await this.authFetch(
      `${BASE_API_URL}/recent-numbers/ORDER`,
      { method: 'GET' },
      accessToken
    );
    return response;
  }

  // Status Transitions
  canTransitionToGeneral(currentStatus: string, newStatus: string): boolean {
    return STATUS_TRANSITIONS[currentStatus]?.includes(newStatus) || false;
  }
}

export const apiService = new ApiService();