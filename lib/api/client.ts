import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { env } from '@/lib/config/env';
import { notifyTokenExpired } from '@/lib/auth/client-auth';
import { requestRegistry } from '../request-registry';

/**
 * lib/api/client.ts
 *
 * Foundation Layer — Clerk Integration
 * 
 * This client uses a dedicated Axios instance and integrates with Clerk 
 * via the ClerkTokenProvider interceptor.
 */

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly url: string,
    public readonly method: string,
    public readonly body?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }

  isUnauthorized() { return this.status === 401; }
  isForbidden()    { return this.status === 403; }
  isNotFound()     { return this.status === 404; }
  isConflict()     { return this.status === 409; }
  isClientError()  { return this.status >= 400 && this.status < 500; }
  isServerError()  { return this.status >= 500; }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(method: string, url: string, status?: number) {
  if (!env.ENABLE_API_LOGGING) return;
  console.log(`[API] ${method.toUpperCase()} ${url} ${status ? `→ ${status}` : '→ pending'}`);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CustomRequestConfig extends InternalAxiosRequestConfig {
  retries?: number;
  retryCount?: number;
  skipAuth?: boolean;
}

// ---------------------------------------------------------------------------
// Clerk Token Integration (Synchronous Registry)
// ---------------------------------------------------------------------------

/**
 * We use a global reference for the token fetcher to allow React components 
 * (like ClerkTokenProvider) to register the Clerk getToken function 
 * synchronously during render. This avoids race conditions with useEffect.
 */
let getTokenRef: (() => Promise<string | null>) | null = null;

export const setTokenFetcher = (fetcher: () => Promise<string | null>) => {
  getTokenRef = fetcher;
};

// ---------------------------------------------------------------------------
// Axios Instance
// ---------------------------------------------------------------------------

// We export the instance so ClerkTokenProvider can attach its interceptor to it
export const axiosInstance = axios.create({
  baseURL: env.API_URL,
  timeout: 50_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Token Injection + registry + logging
axiosInstance.interceptors.request.use(async (config: CustomRequestConfig) => {
  const method = config.method?.toUpperCase() || 'GET';
  const url = config.url || '';

  // 1. Inject Token if fetcher is registered
  if (getTokenRef && !config.skipAuth) {
    try {
      const token = await getTokenRef();
      if (token) {
        // Ensure headers exist and set Authorization
        config.headers = config.headers || {};
        config.headers['Authorization'] = `Bearer ${token}`;
        
        if (env.ENABLE_API_LOGGING) {
          console.debug(`[apiClient] Injected token for ${method} ${url}`);
        }
      }
    } catch (err) {
      console.warn('[apiClient] Failed to fetch token:', err);
    }
  }

  // 2. Register with AbortController registry
  config.signal = requestRegistry.register(`${method}:${url}`);

  log(method, url);

  return config;
});

// Response Interceptor: data unwrapping + cancel guard + error handling
axiosInstance.interceptors.response.use(
  (response) => {
    log(response.config.method || 'GET', response.config.url || '', response.status);
    return response.data;
  },
  async (error: AxiosError) => {
    // 2. Cancel guard: swallow cancellation silently
    if (axios.isCancel(error)) {
      return Promise.resolve(null);
    }

    const config = error.config as CustomRequestConfig;
    const method = config?.method?.toUpperCase() || 'UNKNOWN';
    const url = config?.url || 'UNKNOWN';
    const status = error.response?.status || 0;

    log(method, url, status);

    // 3. Exponential back-off retry for GET requests
    const maxRetries = config?.retries ?? (method === 'GET' ? 2 : 0);
    const currentRetry = config?.retryCount ?? 0;

    if (method === 'GET' && (status >= 500 || status === 0) && currentRetry < maxRetries) {
      config.retryCount = currentRetry + 1;
      const delay = 500 * Math.pow(2, currentRetry);
      await new Promise(resolve => setTimeout(resolve, delay));
      return axiosInstance(config);
    }

    // 4. 401 handling
    if (status === 401) {
      notifyTokenExpired();
    }

    // Wrap in ApiError
    let message = 'Network error';
    if (error.response?.data) {
      const data = error.response.data as any;
      message = data.message || data.error || error.message;
    } else if (error.message) {
      message = error.message;
    }

    throw new ApiError(message, status, url, method, error.response?.data);
  }
);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const apiClient = {
  get: <T>(url: string, config = {}) => axiosInstance.get<any, T>(url, config),
  post: <T>(url: string, data?: any, config = {}) => axiosInstance.post<any, T>(url, data, config),
  put: <T>(url: string, data?: any, config = {}) => axiosInstance.put<any, T>(url, data, config),
  patch: <T>(url: string, data?: any, config = {}) => axiosInstance.patch<any, T>(url, data, config),
  delete: <T>(url: string, config = {}) => axiosInstance.delete<any, T>(url, config),
};
