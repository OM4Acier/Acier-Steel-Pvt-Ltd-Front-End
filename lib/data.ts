// lib/data.ts
import { UserProfile, UserRole } from '@/types/rbac.types';
import axios from 'axios';

// src/api/axios.ts

export const api = axios.create({
  baseURL: 'http://localhost:5000/api', // Use env variable in a real app
  headers: {
    'Content-Type': 'application/json',
  },
});

export const BASE_API_URL = process.env.NEXT_PUBLIC_BASE_API_URL || 'http://localhost:3000/api';


// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token expiry / 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      // Use a custom event or state manager to avoid hard refresh
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);




export interface FileReference {
  fileId: string;
  filename: string;
  fileUrl?: string; // Added fileUrl as per backend response
}

export type PurchaseStatus = 'Pending' | 'Approved' | 'Cancelled' | 'Invoiced' | 'Completed';

export interface Purchase {
  id: string; // Explicitly added as per your backend interface
  purchaseNo: string; // Now manually entered for new, read-only for existing
  supplierName?: string; // Changed to optional as per your provided interface
  supplierContactNumber?: string;
  productInfo: string; // Textarea or rich text
  invoiceInfo?: string; // New field for Invoice Info
  attachments?: FileReference[];
  status: PurchaseStatus;
  cancellationRemarks?: string;
  // Vehicle + Coil Entry
  vehicleNumber?: string;
  unloadingPhotos?: FileReference[];
  // Invoice Upload & Verification
  invoiceDate?: string;
  invoiceNumber?: string;
  invoiceFiles?: FileReference[];
  editHistory?: EditHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}



export interface FileMetadata {
  fileId: string;
  filename: string;
  fileUrl?: string;
}

export interface OrderDetails {
  orderDate: string;
  invoiceDetails: string;
  vehicleNo: string;
  invoiceNo: string;
  productDriveIds?: FileMetadata[];
  vehicleDriveIds?: FileMetadata[];
  invoiceDriveId?: FileMetadata[];
}

export interface EditHistoryEntry {
  timestamp: number;
  editorName: string;
  description: string;
}

export interface Order {
  id: string; // Changed from _id to id for consistency with React keys
  deoNo: string;
  client: string;
  contactNo: string;
  organizationContact: string;
  customerPaymentStatus: 'regular' | 'new-paid' | 'new-unpaid';
  products: string;
  status: string;
  partDelivery: boolean;
  details: OrderDetails;
  editHistory?: EditHistoryEntry[];
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}


export interface DialogMessageType {
  type: 'success' | 'error' | 'info' | 'warning' | '';
  text: string;
}

export interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string, contactNo?: string, organization?: string, role?: string) => Promise<void>;
  logout: () => void;
  authError: string | null;
  clearAuthError: () => void;
}

export interface ApiService {
  loginUser: (email: string, password: string) => Promise<{ accessToken: string; user: any }>;
  registerUser: (email: string, password: string, name?: string, contactNo?: string, organization?: string, role?: string) => Promise<{ accessToken: string; user: any }>;
  fetchOrders: (accessToken: string) => Promise<Order[]>;
  fetchPurchases: (accessToken: string) => Promise<Purchase[]>;
  updateOrder: (orderId: string, updatedData: Partial<Order>, accessToken: string) => Promise<any>;
  // Add other API methods as needed (create, delete, etc.)
}





// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface AuthResponse {
  user: UserProfile;
  accessToken: string;
  refreshToken?: string;
}

export interface FileUpload {
  filename: string;
  mimeType: string;
  fileBase64: string;
}

// ============================================================================
// CUSTOM ERROR CLASS
// ============================================================================

export class ApiError extends Error {
  public readonly status: number;
  public readonly statusText: string;
  public readonly url: string;
  public readonly method: string;
  public readonly response?: any;
  public readonly timestamp: string;
  public readonly code?: string;

  constructor(
    message: string,
    status: number,
    statusText: string,
    url: string,
    method: string,
    response?: any,
    code?: string
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.url = url;
    this.method = method;
    this.response = response;
    this.code = code;
    this.timestamp = new Date().toISOString();

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

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

  isBadRequest(): boolean {
    return this.status === 400;
  }

  isConflict(): boolean {
    return this.status === 409;
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
      code: this.code,
      timestamp: this.timestamp,
    };
  }
}

// ============================================================================
// CONFIGURATION & STATE MANAGEMENT
// ============================================================================

interface ApiConfig {
  baseUrl: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  enableLogging?: boolean;
  onError?: (error: ApiError) => void;
  onRequest?: (url: string, options: RequestInit) => void;
  onResponse?: (response: Response) => void;
  onUnauthorized?: () => void;
  tokenRefreshCallback?: () => Promise<string | null>;
}

interface RequestOptions extends RequestInit {
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  skipRetry?: boolean;
  skipAuth?: boolean;
}

// Default configuration
const defaultConfig: ApiConfig = {
  baseUrl: BASE_API_URL,
  timeout: 30000,
  retryAttempts: 2,
  retryDelay: 1000,
  enableLogging: process.env.NODE_ENV === 'development',
};

// Internal state
let config = { ...defaultConfig };
const pendingRequests = new Map<string, AbortController>();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Configure the API service
 */
const configure = (newConfig: Partial<ApiConfig>): void => {
  config = { ...config, ...newConfig };
};

/**
 * Get current configuration (for debugging)
 */
const getConfig = (): Readonly<ApiConfig> => {
  return { ...config };
};

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Sanitize sensitive data from logs
 */
const sanitizeForLog = (data: any): any => {
  if (!data) return data;

  const sensitiveKeys = ['password', 'token', 'accessToken', 'refreshToken', 'authorization', 'apiKey'];
  const sanitized = { ...data };

  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
      sanitized[key] = '***REDACTED***';
    }
  }

  return sanitized;
};

/**
 * Log with environment check
 */
const log = (level: 'info' | 'warn' | 'error', message: string, data?: any): void => {
  if (!config.enableLogging) return;

  const sanitizedData = data ? sanitizeForLog(data) : undefined;

  switch (level) {
    case 'info':
      console.log(`[API Service] ${message}`, sanitizedData || '');
      break;
    case 'warn':
      console.warn(`[API Service] ${message}`, sanitizedData || '');
      break;
    case 'error':
      console.error(`[API Service] ${message}`, sanitizedData || '');
      break;
  }
};

/**
 * Generate request ID for tracking
 */
const generateRequestId = (method: string, url: string): string => {
  return `${method}-${url}-${Date.now()}`;
};

/**
 * Cancel pending request
 */
const cancelRequest = (requestId: string): void => {
  const controller = pendingRequests.get(requestId);
  if (controller) {
    controller.abort();
    pendingRequests.delete(requestId);
    log('info', `Request cancelled: ${requestId}`);
  }
};

/**
 * Cancel all pending requests
 */
const cancelAllRequests = (): void => {
  pendingRequests.forEach((controller, requestId) => {
    controller.abort();
    log('info', `Request cancelled: ${requestId}`);
  });
  pendingRequests.clear();
};

// ============================================================================
// CORE HTTP FUNCTIONS
// ============================================================================

/**
 * Fetch with timeout support
 */
const fetchWithTimeout = async (
  url: string,
  options: RequestInit,
  timeout: number,
  requestId: string
): Promise<Response> => {
  const controller = new AbortController();
  pendingRequests.set(requestId, controller);

  const timeoutId = setTimeout(() => {
    controller.abort();
    log('warn', `Request timeout: ${url}`);
  }, timeout);

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
    pendingRequests.delete(requestId);
  }
};

/**
 * Parse response based on content type
 */
const parseResponse = async (response: Response): Promise<any> => {
  const contentType = response.headers.get('content-type');

  if (!contentType) {
    // No content type, try json first
    try {
      return await response.json();
    } catch {
      return await response.text();
    }
  }

  if (contentType.includes('application/json')) {
    return response.json();
  }

  if (contentType.includes('text/')) {
    return response.text();
  }

  if (contentType.includes('application/octet-stream') || contentType.includes('image/')) {
    return response.blob();
  }

  // Default to json
  return response.json().catch(() => response.text());
};

/**
 * Handle error responses with priority on error.message
 */
const handleErrorResponse = async (
  response: Response,
  url: string,
  method: string
): Promise<ApiError> => {
  let errorData: any = null;
  let errorMessage = response.statusText || 'Request failed';
  let errorCode: string | undefined;

  try {
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      errorData = await response.json();

      // Extract error code if available
      errorCode = errorData.code || errorData.errorCode;

      // Priority order for error messages:
      // 1. error.message (most specific)
      // 2. error.error (fallback)
      // 3. error (if it's a string)
      // 4. response.statusText (last resort)
      if (errorData) {
        errorMessage =
          errorData.message ||
          errorData.error ||
          errorData.msg ||
          (typeof errorData === 'string' ? errorData : null) ||
          errorMessage;
      }
    } else {
      errorData = await response.text();
      if (errorData && typeof errorData === 'string' && errorData.length < 200) {
        errorMessage = errorData;
      }
    }
  } catch (parseError) {
    log('warn', 'Failed to parse error response', { parseError });
  }

  return new ApiError(
    errorMessage,
    response.status,
    response.statusText,
    url,
    method,
    errorData,
    errorCode
  );
};

/**
 * Create error for non-HTTP errors
 */
const createUnknownError = (
  error: unknown,
  url: string,
  method: string
): ApiError => {
  const message = error instanceof Error ? error.message : 'Unknown error occurred';

  return new ApiError(
    message,
    0,
    'Network Error',
    url,
    method,
    error
  );
};

/**
 * Main authenticated fetch method with enhanced error handling
 */
const authFetch = async (
  url: string,
  options: RequestOptions = {},
  accessToken?: string
): Promise<any> => {
  const {
    timeout = config.timeout,
    retryAttempts = config.retryAttempts,
    retryDelay = config.retryDelay,
    skipRetry = false,
    skipAuth = false,
    ...fetchOptions
  } = options;

  const fullUrl = url.startsWith('http') ? url : `${config.baseUrl}${url}`;
  const method = fetchOptions.method || 'GET';
  const requestId = generateRequestId(method, fullUrl);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((fetchOptions.headers as Record<string, string>) || {}),
  };

  // Security: Only add auth token if not explicitly skipped
  if (accessToken && !skipAuth) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const requestOptions: RequestInit = {
    ...fetchOptions,
    headers,
    method,
  };

  // Request interceptor
  if (config.onRequest) {
    config.onRequest(fullUrl, requestOptions);
  }

  log('info', `${method} ${fullUrl}`, { requestId });

  let lastError: ApiError | null = null;
  const attempts = skipRetry ? 1 : retryAttempts!;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetchWithTimeout(
        fullUrl,
        requestOptions,
        timeout!,
        requestId
      );

      // Response interceptor
      if (config.onResponse) {
        config.onResponse(response);
      }

      log('info', `Response: ${response.status} ${method} ${fullUrl}`, { requestId });

      if (!response.ok) {
        const error = await handleErrorResponse(response, fullUrl, method);

        // Handle unauthorized errors
        if (error.isUnauthorized() && config.onUnauthorized) {
          log('warn', 'Unauthorized - triggering callback');
          config.onUnauthorized();
        }

        throw error;
      }

      return await parseResponse(response);
    } catch (error) {
      lastError = error instanceof ApiError
        ? error
        : createUnknownError(error, fullUrl, method);

      log('error', `Request failed (attempt ${attempt + 1}/${attempts})`, {
        requestId,
        error: lastError.toJSON()
      });

      // Don't retry on client errors (4xx) or if skipRetry is true
      if (lastError.isClientError() || skipRetry || attempt === attempts - 1) {
        break;
      }

      // Exponential backoff for retries
      const delay = retryDelay! * Math.pow(2, attempt);
      log('info', `Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }

  // Call error callback if configured
  if (config.onError && lastError) {
    config.onError(lastError);
  }

  throw lastError;
};

// ============================================================================
// GENERIC HTTP METHODS
// ============================================================================

const get = async <T = any>(
  url: string,
  options?: RequestOptions,
  accessToken?: string
): Promise<T> => {
  return authFetch(url, { ...options, method: 'GET' }, accessToken);
};

const post = async <T = any>(
  url: string,
  data?: any,
  options?: RequestOptions,
  accessToken?: string
): Promise<T> => {
  return authFetch(
    url,
    {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    },
    accessToken
  );
};

const put = async <T = any>(
  url: string,
  data?: any,
  options?: RequestOptions,
  accessToken?: string
): Promise<T> => {
  return authFetch(
    url,
    {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    },
    accessToken
  );
};

const patch = async <T = any>(
  url: string,
  data?: any,
  options?: RequestOptions,
  accessToken?: string
): Promise<T> => {
  return authFetch(
    url,
    {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    },
    accessToken
  );
};

const del = async <T = any>(
  url: string,
  options?: RequestOptions,
  accessToken?: string
): Promise<T> => {
  return authFetch(url, { ...options, method: 'DELETE' }, accessToken);
};

// ============================================================================
// AUTH ENDPOINTS (Loosely Coupled)
// ============================================================================

const authEndpoints = {
  registerUser: async (
    email: string,
    password: string,
    role: UserRole = 'sales',
    name?: string,
    contactNo?: string,
    organization?: string
  ): Promise<AuthResponse> => {
    const payload = {
      email,
      password,
      role,
      ...(name && { name }),
      ...(contactNo && { contactNo }),
      ...(organization && { organization }),
    };

    return post('/register', payload);
  },

  loginUser: async (email: string, password: string): Promise<AuthResponse> => {
    return post('/login', { email, password });
  },

  logoutUser: async (accessToken?: string): Promise<{ message: string }> => {
    return post('/logout', {}, {}, accessToken);
  },

  refreshToken: async (refreshToken: string): Promise<AuthResponse> => {
    return post('/refresh-token', { refreshToken });
  },

  changePassword: async (
    currentPassword: string,
    newPassword: string,
    accessToken: string
  ): Promise<{ message: string }> => {
    return post('/user/change-password', { currentPassword, newPassword }, {}, accessToken);
  },
};

// ============================================================================
// USER ENDPOINTS (Loosely Coupled)
// ============================================================================

const userEndpoints = {
  fetchUsers: async (accessToken: string): Promise<UserProfile[]> => {
    const users = await get<any[]>('/users', {}, accessToken);
    return users.map((user: any) => ({ ...user, id: user._id || user.id }));
  },

  getCurrentUser: async (accessToken: string): Promise<UserProfile> => {
    const user = await get<any>('/user/profile', {}, accessToken);
    return { ...user, id: user._id || user.id };
  },

  updateUser: async (
    userId: string,
    updatedFields: Partial<Omit<UserProfile, 'id' | 'accessToken'>>,
    accessToken: string
  ): Promise<UserProfile> => {
    const updatedUser = await put<any>(`/users/${userId}`, updatedFields, {}, accessToken);
    return { ...updatedUser, id: updatedUser._id || updatedUser.id };
  },

  deleteUser: async (userId: string, accessToken: string): Promise<void> => {
    await del(`/users/${userId}`, {}, accessToken);
  },
};

// ============================================================================
// ORDER ENDPOINTS (Loosely Coupled)
// ============================================================================

const orderEndpoints = {
  fetchOrders: async (accessToken: string): Promise<Order[]> => {
    const orders = await get<any[]>('/orders', {}, accessToken);
    return orders.map((order: any) => ({ ...order, id: order._id || order.id }));
  },

  fetchPurchases: async (accessToken: string): Promise<Order[]> => {
    const purchases = await get<any[]>('/purchases', {}, accessToken);
    return purchases.map((purchase: any) => ({ ...purchase, id: purchase._id || purchase.id }));
  },

  addOrder: async (
    orderData: Omit<Order, 'id' | 'status' | 'editHistory'> & { organizationContact: string },
    accessToken: string
  ): Promise<Order> => {
    const newOrder = await post<any>('/orders', orderData, {}, accessToken);
    return { ...newOrder, id: newOrder._id || newOrder.id };
  },

  updateOrder: async (
    deoNo: string,
    updatedFields: Partial<Omit<Order, 'id' | 'editHistory'>>,
    editHistory: EditHistoryEntry,
    accessToken: string
  ): Promise<Order> => {
    const payload = { ...updatedFields, editHistory };
    const updatedOrder = await put<any>(`/orders/${deoNo}`, payload, {}, accessToken);
    return { ...updatedOrder, id: updatedOrder._id || updatedOrder.id };
  },

  updateOrderStatus: async (
    deoNo: string,
    newStatus: string,
    editHistory: EditHistoryEntry,
    accessToken: string
  ): Promise<Order> => {
    const payload = { status: newStatus, editHistory };
    const updatedOrder = await put<any>(`/orders/${deoNo}`, payload, {}, accessToken);
    return { ...updatedOrder, id: updatedOrder._id || updatedOrder.id };
  },

  deleteOrder: async (deoNo: string, accessToken: string): Promise<void> => {
    await del(`/orders/${deoNo}`, {}, accessToken);
  },
};

// ============================================================================
// FILE ENDPOINTS (Loosely Coupled)
// ============================================================================

const fileEndpoints = {
  uploadFile: async (
    deoNo: string,
    uploadStage:  'product' | 'vehicle' | 'invoice' | 'productVoiceNote' | 'invoiceVoiceNote',
    files: FileUpload[],
    accessToken: string
  ): Promise<any> => {
    // Validate file sizes (max 10MB per file)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    for (const file of files) {
      const sizeInBytes = (file.fileBase64.length * 3) / 4; // Approximate base64 to bytes
      if (sizeInBytes > maxSize) {
        throw new Error(`File ${file.filename} exceeds maximum size of 10MB`);
      }
    }

    return post('/files/upload', { deoNo, uploadStage, files }, {}, accessToken);
  },

  deleteFile: async (fileId: string, accessToken: string): Promise<void> => {
    await post('/files/delete', { fileId }, {}, accessToken);
  },
};

// ============================================================================
// BUSINESS LOGIC (Loosely Coupled)
// ============================================================================

const businessLogic = {
  /**
   * Check if order status transition is valid
   */
  canTransitionToGeneral: (currentStatus: string, newStatus: string): boolean => {
    const transitions: Record<string, string[]> = {
      'Order Created': ['Approved for Production', 'Cancelled'],
      'Approved for Production': ['Ready for Dispatch', 'Cancelled'],
      'Ready for Dispatch': ['Dispatched and Invoiced', 'Cancelled'],
      'Dispatched and Invoiced': ['Completed', 'Cancelled'],
      'Completed': [],
      'Cancelled': [],
      '': ['Order Created'],
    };

    return transitions[currentStatus]?.includes(newStatus) || false;
  },

  /**
   * Get allowed transitions for a status
   */
  getAllowedTransitions: (currentStatus: string): string[] => {
    const transitions: Record<string, string[]> = {
      'Order Created': ['Approved for Production', 'Cancelled'],
      'Approved for Production': ['Ready for Dispatch', 'Cancelled'],
      'Ready for Dispatch': ['Dispatched and Invoiced', 'Cancelled'],
      'Dispatched and Invoiced': ['Completed', 'Cancelled'],
      'Completed': [],
      'Cancelled': [],
      '': ['Order Created'],
    };

    return transitions[currentStatus] || [];
  },

  /**
   * Validate order data before submission
   */
  validateOrderData: (orderData: Partial<Order>): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!orderData.deoNo || orderData.deoNo.trim() === '') {
      errors.push('DEO Number is required');
    }

    if (!orderData.organizationContact || orderData.organizationContact.trim() === '') {
      errors.push('Organization contact is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },
};

// ============================================================================
// MAIN API SERVICE EXPORT
// ============================================================================

export const apiService = {
  // Configuration
  configure,
  getConfig,

  // Core HTTP methods
  authFetch,
  get,
  post,
  put,
  patch,
  delete: del,

  // Request management
  cancelRequest,
  cancelAllRequests,

  // Auth endpoints (loosely coupled)
  ...authEndpoints,

  // User endpoints (loosely coupled)
  ...userEndpoints,

  // Order endpoints (loosely coupled)
  ...orderEndpoints,

  // File endpoints (loosely coupled)
  ...fileEndpoints,

  // Business logic (loosely coupled)
  ...businessLogic,
};

// Export types
export type { ApiConfig, RequestOptions };

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/*
// 1. Configure the service
apiService.configure({
  baseUrl: 'https://api.example.com',
  timeout: 10000,
  enableLogging: true,
  onError: (error) => {
    // Send to monitoring service
    console.error('API Error:', error.toJSON());
  },
  onUnauthorized: () => {
    // Redirect to login
    localStorage.removeItem('accessToken');
    window.location.href = '/login';
  }
});

// 2. Register user
try {
  const response = await apiService.registerUser(
    'user@example.com',
    'password123',
    'sales',
    'John Doe',
    '+1234567890',
    'Acme Corp'
  );
  localStorage.setItem('accessToken', response.accessToken);
} catch (error) {
  if (error instanceof ApiError && error.isConflict()) {
    console.log('User already exists');
  }
}

// 3. Login
try {
  const response = await apiService.loginUser('user@example.com', 'password123');
  localStorage.setItem('accessToken', response.accessToken);
} catch (error) {
  if (error instanceof ApiError && error.isUnauthorized()) {
    console.log('Invalid credentials');
  }
}

// 4. Fetch orders with error handling
try {
  const token = localStorage.getItem('accessToken')!;
  const orders = await apiService.fetchOrders(token);
  console.log('Orders:', orders);
} catch (error) {
  if (error instanceof ApiError) {
    console.error(`Error ${error.status}: ${error.message}`);
  }
}

// 5. Add order with validation
const orderData = {
  deoNo: 'DEO-001',
  organizationContact: '+1234567890',
  // ... other fields
};

const validation = apiService.validateOrderData(orderData);
if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
} else {
  try {
    const token = localStorage.getItem('accessToken')!;
    const newOrder = await apiService.addOrder(orderData, token);
    console.log('Order created:', newOrder);
  } catch (error) {
    console.error('Failed to create order:', error);
  }
}

// 6. Check status transition
const canTransition = apiService.canTransitionToGeneral('Order Created', 'Approved for Production');
console.log('Can transition:', canTransition);

// 7. Upload files with size validation
try {
  const token = localStorage.getItem('accessToken')!;
  await apiService.uploadFile('DEO-001', 'product', [
    {
      filename: 'product.jpg',
      mimeType: 'image/jpeg',
      fileBase64: '...'
    }
  ], token);
} catch (error) {
  console.error('Upload failed:', error);
}

// 8. Cancel all pending requests (useful on component unmount)
apiService.cancelAllRequests();
*/