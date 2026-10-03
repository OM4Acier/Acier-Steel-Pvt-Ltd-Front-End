import Link from 'next/link';

/**
 * app/403/page.tsx
 *
 * "You are signed in, but your role does not allow this page."
 *
 * Registered in PROTECTED_ROUTES as `permission: 'public'` (lib/config/routes.ts)
 * so the C6 AppShell guard skips it — otherwise a denied user redirected here
 * would be redirected again and loop forever.
 *
 * Distinct from /login on purpose:
 *   /login = you are not signed in
 *   /403   = you are signed in, wrong role
 *
 * Server component, no client JS, no data fetching. Safe to render signed out.
 */
export default function ForbiddenPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center bg-background px-6 py-16">
      <div className="flex max-w-md flex-col items-center text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          403
        </p>

        <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          You don&apos;t have access to this page
        </h1>

        <p className="mt-3 text-sm text-muted-foreground">
          Your account signed in successfully, but its role does not include
          permission for this section. If you believe that&apos;s wrong, ask an
          administrator to review your role.
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