// lib/auth.ts

import { UserProfile } from '@/types/auth.types';

const TOKEN_KEY = 'accessToken';
const USER_KEY = 'currentUserProfile';

export const auth = {
  // Get token from localStorage
  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
  },

  // Get cached user from localStorage
  getCachedUser(): UserProfile | null {
    if (typeof window === 'undefined') return null;
    
    // SECURITY: Must have token to trust cached user
    const token = this.getToken();
    if (!token) {
      this.clearAuth();
      return null;
    }

    const cached = localStorage.getItem(USER_KEY);
    if (!cached) return null;
    
    try {
      const user = JSON.parse(cached);
      
      // SECURITY: Verify cached user has same token
      if (user.accessToken !== token) {
        console.warn('Security: Token mismatch, clearing cache');
        this.clearAuth();
        return null;
      }
      
      return user;
    } catch {
      this.clearAuth();
      return null;
    }
  },

  // Save user to localStorage
  saveUser(user: UserProfile): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(TOKEN_KEY, user.accessToken);
  },

  // Clear all auth data
  clearAuth(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  // Validate session with API - ALWAYS validates, never trusts cache alone
  async validateSession(): Promise<UserProfile> {
    const token = this.getToken();
    
    if (!token) {
      this.clearAuth();
      throw new Error('No access token found');
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_API_URL}/me`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      // SECURITY: Any auth error clears everything
      if (res.status === 401 || res.status === 403) {
        console.warn(`Security: Validation failed with status ${res.status}`);
        this.clearAuth();
        throw new Error('Unauthorized - token invalid or expired');
      }

      if (!res.ok) {
        // For other errors (500, etc), DO NOT clear auth immediately
        // allowing the user to retry or stay logged in (offline mode maybe?)
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      // console.log(data); // Reduced noise

      if (!data.success || !data.user) {
        // If the server returns 200 but invalid data, it's suspicious, but maybe API change?
        // Safest to clear auth if we can't parse user
        console.warn('Security: Invalid user data received');
        this.clearAuth();
        throw new Error('Invalid response');
      }

      const user: UserProfile = {
        id: data.user.userId,
        name: data.user.name || data.user.email.split('@')[0],
        email: data.user.email,
        role: data.user.role,
        contactNo: data.user.contactNo,
        organization: data.user.organization,
        accessToken: token,
      };

      // Save validated user
      this.saveUser(user);
      return user;
    } catch (err: any) {
       // Only clear auth if it was an auth error (handled above) or if explicitly desired.
       // For network errors, we re-throw so the UI can handle it (e.g. show "Offline")
       // without logging the user out.
       if (err.message.includes('Unauthorized') || err.message.includes('Invalid response')) {
           this.clearAuth();
       }
       console.error('Session validation error:', err);
       throw err;
    }
  },

  // API fetch with auto token and error handling
  async apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    
    if (!token) {
      this.clearAuth();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new Error('No access token');
    }

    const url = endpoint.startsWith('http') 
      ? endpoint 
      : `${process.env.NEXT_PUBLIC_BASE_API_URL}${endpoint}`;

    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...options.headers,
        },
      });

      // SECURITY: Clear auth on any auth error
      if (res.status === 401 || res.status === 403) {
        this.clearAuth();
        if (typeof window !== 'undefined') {
          const currentPath = window.location.pathname;
          window.location.href = `/login?returnTo=${encodeURIComponent(currentPath)}`;
        }
        throw new Error('Unauthorized - session expired');
      }

      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(error.message || `HTTP ${res.status}`);
      }

      return res.json();
    } catch (err: any) {
      console.error('API Error:', err.message);
      throw err;
    }
  },
};