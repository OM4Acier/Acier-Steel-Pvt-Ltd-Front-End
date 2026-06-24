'use client';


import { useState } from "react";
import { useRouter } from 'next/navigation';
import {toast} from "sonner";
import { ApiError, apiService } from "@/lib/data";
import { UserProfile } from "@/types/rbac.types";



// ============================================================================
// ERROR MESSAGE UTILITIES - PRIORITIZE SERVER MESSAGES
// ============================================================================

/**
 * Get user-friendly error message - ALWAYS prioritize server message
 */
const getErrorMessage = (error: unknown): string => {
  // Handle ApiError instances
  if (error instanceof ApiError) {
    // PRIORITY 1: Always use server message if available
    if (error.message && error.message.trim() !== '') {
      return error.message;
    }

    // PRIORITY 2: If no server message, check for network/connection issues
    if (error.status === 0) {
      return 'Unable to connect to server. Please check your internet connection.';
    }

    // PRIORITY 3: Check for timeout
    if (error.message?.includes('timeout')) {
      return 'Request timed out. Please try again.';
    }

    // PRIORITY 4: Generic fallback based on status code (only if no message)
    if (error.isServerError()) {
      return 'Server error occurred. Please try again later.';
    }

    if (error.isClientError()) {
      return 'Request failed. Please check your input and try again.';
    }

    // PRIORITY 5: Ultimate fallback
    return 'An error occurred. Please try again.';
  }

  // Handle timeout errors from fetch
  if (error instanceof Error) {
    // Check for network/timeout specific errors
    if (error.message.includes('timeout')) {
      return 'Request timed out. Please try again.';
    }

    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      return 'Network error. Please check your internet connection.';
    }

    // Return the error message as is
    return error.message;
  }

  // Fallback for unknown errors
  return 'An unexpected error occurred. Please try again.';
};


/**
 * Get toast duration based on error severity
 */
const getToastDuration = (error: unknown): number => {
  if (error instanceof ApiError) {
    // Network/Server errors - show longer
    if (error.status === 0 || error.isServerError()) {
      return 6000; // 6 seconds
    }
  }
  
  return 4000; // Default 4 seconds
};

/**
 * Check if error is a network/connectivity issue
 */
const isNetworkError = (error: unknown): boolean => {
  if (error instanceof ApiError && error.status === 0) {
    return true;
  }
  
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes('network') || 
           message.includes('failed to fetch') || 
           message.includes('timeout');
  }
  
  return false;
};

// ============================================================================
// ENHANCED LOGIN HANDLER
// ============================================================================



interface LoginFormProps {
    returnTo?: string;
  }
  
  export const useLoginHandler = ({ returnTo = '/' }: LoginFormProps = {}) => {
    const router = useRouter();
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [isLoadingAuth, setIsLoadingAuth] = useState(false);
    const [loginError, setLoginError] = useState('');
  
    const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoadingAuth(true);
      setLoginError('');
  
      // Client-side validation
      if (!loginEmail || !loginPassword) {
        const errorMsg = 'Please enter both email and password.';
        toast.error(errorMsg);
        setLoginError(errorMsg);
        setIsLoadingAuth(false);
        return;
      }
  
      // Email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(loginEmail)) {
        const errorMsg = 'Please enter a valid email address.';
        toast.error(errorMsg);
        setLoginError(errorMsg);
        setIsLoadingAuth(false);
        return;
      }
  
      try {
   
        // Make API call
        const response = await apiService.loginUser(loginEmail, loginPassword);

        // Create user profile
        const user: UserProfile = {
          id: response.user.id,
          name: response.user.name || response.user.email.split('@')[0],
          email: response.user.email,
          role: response.user.role,
          contactNo: response.user.contactNo,
          organization: response.user.organization,
          accessToken: response.accessToken,
          permissions: response.user.permissions
        };
  
        // Store authentication data
        localStorage.setItem('accessToken', user.accessToken);
        localStorage.setItem('currentUserProfile', JSON.stringify(user));
  
        // Show success message
        toast.success(`Welcome back, ${user.name}! 👋`, {
          duration: 3000,
        });



  
        // Clear form
        setLoginEmail('');
        setLoginPassword('');
        setLoginError('');
  
        // Redirect to dashboard
        router.push(returnTo);
  
      } catch (error: unknown) {
        // PRIORITY: Get server message first, fallback to generic only if needed
        const errorMessage = getErrorMessage(error);

        // Show error toast with appropriate duration
        const duration = getToastDuration(error);
        toast.error(errorMessage, { duration });
  
        // Set error state for UI display
        setLoginError(errorMessage);
  
        // Additional logging for network issues
        if (isNetworkError(error)) {
          console.warn('⚠️ Network/Connectivity Issue Detected');
        }
  
        // Track failed login attempts (optional - for analytics)
        if (error instanceof ApiError && process.env.NODE_ENV !== 'production') {
          console.warn('Login Attempt Failed:', {
            email: loginEmail,
            status: error.status,
            code: error.code,
            timestamp: error.timestamp,
          });
        }
  
      } finally {
        setIsLoadingAuth(false);
      }
    };
  
    return {
      loginEmail,
      setLoginEmail,
      loginPassword,
      setLoginPassword,
      isLoadingAuth,
      loginError,
      handleLogin,
    };
  };