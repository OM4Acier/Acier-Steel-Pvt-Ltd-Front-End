/**
 * lib/config/env.ts
 *
 * Phase 5 — Environment & Type Safety (static export version)
 *
 * Static export runs entirely in the browser after the build.
 * All env vars MUST be prefixed with NEXT_PUBLIC_ so Next.js inlines
 * them at build time. There is no runtime server to read server-only vars.
 *
 * requireEnv throws at BUILD time if a var is missing, so the CI/CD pipeline
 * fails loudly instead of shipping a broken app.
 

function requireEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
      throw new Error(
        `[env] Missing required environment variable: ${key}\n` +
          `Add it to your .env.local (dev) or set it in your CI/CD pipeline (prod).\n` +
          `All variables must be prefixed NEXT_PUBLIC_ for static export.`
      );
    }
    return value;
  }
  
  function optionalEnv(key: string, fallback: string): string {
    return process.env[key] ?? fallback;
  }
  */
 

  export const env = {
    API_URL:
      process.env.NEXT_PUBLIC_BASE_API_URL || 'http://localhost:5000/api',
  
    ENABLE_API_LOGGING:
      process.env.NEXT_PUBLIC_ENABLE_API_LOGGING === 'true',
  };
  
  export type Env = typeof env;