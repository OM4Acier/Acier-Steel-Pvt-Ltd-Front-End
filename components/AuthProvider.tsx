// providers/AuthProvider.tsx
'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useMemo } from 'react';
import { auth } from '@/lib/auth';
import { UserProfile } from '@/types/auth.types';

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: UserProfile | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    const initAuth = async () => {
      try {
        const token = auth.getToken();
        
        if (!token) {
          auth.clearAuth();
          setUser(null);
          return; // finally block will handle setIsLoading(false)
        }

        const cachedUser = auth.getCachedUser();
        if (cachedUser) {
          // IMPORTANT: Set user BEFORE setting loading to false
          setUser(cachedUser);
          setIsLoading(false); 
          
          try {
            const validatedUser = await auth.validateSession();
            setUser(validatedUser);
          } catch (err) {
            console.warn('Background validation failed:', err);
            auth.clearAuth();
            setUser(null);
          }
          return; 
        }

        const validatedUser = await auth.validateSession();
        setUser(validatedUser);
      } catch {
        auth.clearAuth();
        setUser(null);
      } finally {
        // Ensure this is the last thing that happens
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  // Use useMemo to prevent unnecessary re-renders of children
  const contextValue = useMemo(() => ({
    user,
    isLoading,
    isAuthenticated: !!user,
    setUser
  }), [user, isLoading]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}