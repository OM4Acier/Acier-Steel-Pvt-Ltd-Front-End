import Link from 'next/link';

/**
 * app/404/page.tsx
 *
 * "No route matched." Reached two ways:
 *   1. The C6 AppShell guard fail-closes an unknown pathname here.
 *   2. The static host serves this file directly for unmatched URLs.
 *
 * For (2): with `output: 'export'`, Next writes out/404.html as the hosting
 * fallback. Defining this page OVERWRITES that file with our markup, so the
 * same page serves both the guard redirect and a direct bad-URL hit. That is
 * intentional — but it means this component must not depend on client-side
 * state or data fetching, or the host's 404 (which has no JS context) would
 * render wrong.
 *
 * Registered in PROTECTED_ROUTES as `permission: 'public'` so the guard skips
 * it and cannot loop.
 *
 * Server component, no client JS, safe to render signed out.
 */
export default function NotFoundPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center bg-background px-6 py-16">
      <div className="flex max-w-md flex-col items-center text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          404
        </p>

        <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Page not found
        </h1>

        <p className="mt-3 text-sm text-muted-foreground">
          That address doesn&apos;t match anything in the app. Check the link,
          or head back to the dashboard to pick up where you left off.
        </p>

        <Link
          href="/"
          className="mt-8 inline-flex items-center rounded-2xl border-0 bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}