"use client";

/**
 * components/Providers.tsx
 *
 * Client-side provider boundary for the app shell.
 *
 * Why this exists:
 *   app/layout.tsx is a Server Component. During a static export
 *   (output: "export") Next prerenders it on React's *server* build, which
 *   strips out React.createContext. Clerk's <ClerkProvider> (and the other
 *   client contexts) call createContext at module scope, so rendering them
 *   directly in the server-rendered root layout throws
 *   "TypeError: k.createContext is not a function" at build time — on every
 *   route, including /_not-found.
 *
 *   Moving the providers into this 'use client' component keeps Clerk's client
 *   runtime entirely on the client bundle, which has a fully-functional
 *   createContext. The server prerender only emits a client-component
 *   placeholder, so the static export succeeds.
 */

import React from "react";
import { ClerkProvider } from "@clerk/react";
import { ThemeProvider } from "next-themes";
import { NavbarExtensionProvider } from "@/context/NavbarExtensionContext";
import { LoadingProvider } from "@/context/LoadingContext";
import { ClerkTokenProvider } from "@/providers/ClerkTokenProvider";

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Add your Clerk Publishable Key to the .env file");
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider telemetry={false} publishableKey={PUBLISHABLE_KEY!} afterSignOutUrl="/">
      <ClerkTokenProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <NavbarExtensionProvider>
            <LoadingProvider>{children}</LoadingProvider>
          </NavbarExtensionProvider>
        </ThemeProvider>
      </ClerkTokenProvider>
    </ClerkProvider>
  );
}

export default Providers;
