"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import LoadingScreen, { LoadingProps } from "@/components/ui/loadingscreen"; // Ensure path is correct



interface LoadingContextType {
  showLoader: (props: LoadingProps) => void;
  hideLoader: () => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  // We include 'active' in the state to control visibility without unmounting the logic
  const [state, setState] = useState<LoadingProps & { active: boolean }>({
    active: false,
    title: "Loading...",
    subtitle: "",
    showProgress: false,
    blurEffect: true,
    amplitude: 1.0,
    distance: 20,
  });

  const showLoader = useCallback((props: LoadingProps) => {
    setState((prev) => ({
      ...prev,
      ...props, // Overwrites only the passed props
      active: true,
    }));
  }, []);

  const hideLoader = useCallback(() => {
    setState((prev) => ({ ...prev, active: false }));
  }, []);

  return (
    <LoadingContext.Provider value={{ showLoader, hideLoader }}>
      {children}
      {/* Rendering the component here at the root prevents it from 
          re-mounting when your page content changes.
      */}
      {state.active && <LoadingScreen {...state} />}
    </LoadingContext.Provider>
  );
}

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error("useLoading must be used within a LoadingProvider");
  }
  return context;
};