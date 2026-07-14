# Optimization Plan
## MongoDB Connection Pool + Frontend LCP

---

## Frontend — LCP 31.79s

### Root cause: three components call `useSession` independently

```
AppShell → useSession({ required: true }) → GET /api/me
NavBar   → useSession({ required: true }) → GET /api/me  ← redundant
Orders   → useSession({ required: true }) → GET /api/me  ← redundant
```

After Clerk migration, `useSession` shim should be synchronous (reads from Clerk's
context — no network call). But if any component is still hitting the old
`getSession()` path (which calls `GET /api/me`), every call adds full API
round-trip latency to LCP.

**Even if the shim is complete:** React cannot render AppShell children until
AppShell's own session + permission fetch resolves. NavBar and children calling
`useSession` adds additional serialised wait time.

---

### Fix 1 — Remove `useSession` from NavBar

NavBar is rendered inside AppShell. AppShell already has `user`. Pass it as a prop.
NavBar never needs to call `useSession` independently.

**`components/AppShell.tsx` — no change to session logic, just prop passing:**
```tsx
// AppShell already has user from Clerk (after migration)
const { user } = useUser();

// Pass to NavBar — NavBar does not fetch session itself
<NavBar user={user} onLogout={...} />
```

**`components/NavBar.tsx` — remove useSession call:**
```tsx
// Remove this entirely from NavBar:
// const { user, isLoading, logout } = useSession({ required: true });

// NavBar receives user as prop — no hook, no fetch
interface NavBarProps {
  user: UserResource | null | undefined;
  onLogout: () => void;
}
export default function NavBar({ user, onLogout }: NavBarProps) {
  // use user directly — it came from AppShell which already resolved it
}
```

---

### Fix 2 — Remove `useSession` from page-level components

Pages that need `user` should read from the permission store or Clerk directly —
not call `useSession` again. AppShell has already resolved the session before
children render.

**Pattern for ALL page components:**
```tsx
// Remove from page components:
// const { user, isLoading, logout } = useSession({ required: true });

// Option A — if only role/email needed (from permission store):
const role  = usePermissionStore(s => s.role);
const email = usePermissionStore(s => s.manifests); // or add email to store

// Option B — if full Clerk user needed (synchronous, no API call):
import { useUser } from '@clerk/react';
const { user } = useUser(); // synchronous — Clerk context, no network
```

**Why this fixes LCP:**
- `useUser()` from Clerk reads from in-memory Clerk context — no API call.
- `usePermissionStore()` reads from Zustand — no API call.
- Both are synchronous. Page renders immediately without waiting for network.

---

### Fix 3 — Permission fetch must not block render

AppShell fires the permission fetch, but render must not wait for it.
Pages render with defaults while permissions load in the background.

**`components/AppShell.tsx` — permission load is fire-and-forget:**
```tsx
useEffect(() => {
  if (isSignedIn && !loaded) {
    load(); // ← no await, no blocking. Page renders with defaults.
  }
}, [isSignedIn, loaded, load]);
```

If `load()` is being awaited anywhere, or if `loaded === false` triggers a
loading spinner that blocks `{children}`, that's the source of the 31s LCP.

**`PermissionGate` defaults during load:**
The hook already returns `true` for `isVisible` when manifest is not yet loaded
(conservative default). Pages render fully — fields appear, then hide/show
as permissions arrive. This is the correct degraded state.

---

### Fix 4 — Permission store must hydrate synchronously from localStorage

On page load, Zustand `persist` middleware rehydrates from localStorage before
the first render. If `loaded` is `false` before rehydration completes, AppShell
fires an unnecessary network fetch.

**`stores/permission-store.ts` — check hydration state:**
```ts
// Zustand persist rehydrates synchronously on first access.
// Guard load() so it doesn't fire if localStorage already has valid data.

load: async () => {
  // If already loaded from localStorage with matching version — skip fetch
  const state = get();
  if (state.loaded && state.version) {
    // Verify version with server in background — non-blocking
    apiClient.get<PermissionsResponse>('/api/permissions').then(res => {
      if (res?.data?.version !== state.version) {
        // Version mismatch — silently update store
        const manifests = Object.fromEntries(
          res.data.manifests.map(m => [m.module, m])
        );
        set({ manifests, role: res.data.role, version: res.data.version });
      }
    }).catch(() => {}); // fail silently — use cached version
    return;
  }
  // Cache miss or first load — fetch normally
  // ... existing fetch logic
}
```

**Result:** Second page load is fully synchronous. No network call.
Permissions already in localStorage. LCP drops to Clerk initialisation time (~300ms).

---

### Fix 5 — Session check on AppShell must be synchronous

After Clerk migration, `useSession` shim returns from Clerk context.
Clerk context is populated before React renders (ClerkProvider wraps everything).
The shim must NOT call `getSession()` (which hits `GET /api/me`).

**Verify the shim is not calling the API:**
```ts
// hooks/useSession.ts shim — verify this is what runs
export function useSession({ required }: { required?: boolean } = {}) {
  const { user: clerkUser, isLoaded } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const role = usePermissionStore(s => s.role);

  // ← NO getSession() call here
  // ← NO fetch('/api/me') here
  // ← NO localStorage.getItem('accessToken') here

  useEffect(() => {
    if (isLoaded && required && !clerkUser) {
      router.replace('/login');
    }
  }, [isLoaded, clerkUser, required, router]);

  return {
    user: clerkUser ? {
      ...clerkUser,
      role: role ?? (clerkUser.publicMetadata?.role as string),
      email: clerkUser.primaryEmailAddress?.emailAddress ?? '',
    } : null,
    isLoading: !isLoaded,
    logout: () => signOut({ redirectUrl: '/login' }),
  };
}
```

If `getSession()` or any API call appears in this hook, that is the LCP culprit.

---

## LCP Reduction — Expected Timeline

| Current | After fixes | What changes |
|---|---|---|
| 31.79s | ~0.5–1.5s | NavBar + pages no longer call useSession independently |
| | | Permission store hydrates from localStorage synchronously |
| | | Permission fetch is fire-and-forget, not blocking |
| | | useSession shim is synchronous (Clerk context) |

The 31.79s figure is only achievable if every component is waiting for a full
API round-trip before rendering. After fixes, the only blocking operation is
Clerk SDK initialisation (~300ms) and React hydration.

---

## Status

| Fix | File | Status |
|---|---|---|
| Backend pool | `src/lib/db.ts` | ⬜ Pending |
| Remove useSession NavBar | `components/NavBar.tsx` | ✅ Completed |
| Remove useSession pages | Each page component | ✅ Completed |
| Permission fetch non-blocking | `components/AppShell.tsx` | ✅ Completed |
| Permission store hydration | `stores/permission-store.ts` | ✅ Completed |
| Verify useSession shim | `hooks/useSession.ts` | ✅ Completed |

---

## Verification

**Backend:**
- MongoDB Atlas → Metrics → Connections → confirm drops to 2–5.

**Frontend — measure LCP before and after:**
```
Chrome DevTools → Lighthouse → Mobile → Measure LCP
```
Run twice: once cold (no localStorage), once warm (permissions cached).
- Cold LCP target: < 3s (Clerk init + first permission fetch)
- Warm LCP target: < 1s (all synchronous)

**Check for API calls on page load (warm):**
- Chrome DevTools → Network tab → reload page while logged in.
- After fixes: only `GET /api/permissions` should fire (version check).
- `GET /api/me` should NOT appear.
- Multiple `GET /api/me` calls = useSession shim still calling old API.
