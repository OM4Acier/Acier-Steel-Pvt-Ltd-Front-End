# Project Instructions - Cleck Frontend

## Clerk SDK Conventions (v7+)
This project uses `@clerk/react` v7.4.1+. Follow these patterns for authentication hooks to avoid TypeScript errors and ensure correct state management:

- **Hook Separation**: 
  - Use `useAuth()` to retrieve the `isLoaded` boolean.
  - Use `useSignIn()` strictly for the `signIn` resource.
  - Use `useClerk()` to retrieve the `setActive` function.
- **v7+ (Core 3) "Future" API Patterns**:
  - `signIn.create()` returns `Promise<{ error: ClerkAPIError | null }>` and does NOT return the updated resource.
  - State (like `status` and `createdSessionId`) must be accessed directly from the `signIn` object provided by the `useSignIn()` hook, which updates reactively.
  - Handle errors by checking the returned `error` object instead of using `try/catch` for API errors.

### Standard Implementation Pattern
```typescript
import { useSignIn, useClerk, useAuth } from '@clerk/react';

export default function LoginPage() {
  const { isLoaded } = useAuth();
  const { signIn } = useSignIn();
  const { setActive } = useClerk();

  const onSubmit = async (data) => {
    if (!isLoaded || !signIn) return;
    
    // Clerk v7: create() returns { error }, state is updated on the hook's 'signIn' resource
    const { error } = await signIn.create({
      identifier: data.email,
      password: data.password,
    });

    if (error) {
      console.error(error);
      return;
    }

    if (signIn.status === 'complete') {
      await setActive({ session: signIn.createdSessionId });
      // Proceed to redirect
    }
  };
}
```

## API Client & Request Registry
- All API requests should go through `apiClient` in `@/lib/api/client`.
- The `apiClient` automatically registers requests with `requestRegistry` for auto-cancellation on route changes.
- Ensure `AppShell.tsx` contains the `requestRegistry.cancelAll()` call in a `usePathname()` effect.
