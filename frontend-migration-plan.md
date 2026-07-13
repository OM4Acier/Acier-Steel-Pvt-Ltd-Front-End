# Frontend Migration Plan
## Clerk Integration — Foundation Layer Only

**Scope:** Base foundation only. No module pages. No RBAC replacement. No permission manifest wiring yet.
**Project:** Next.js App Router · Static Export · shadcn/ui · Axios
**Source of truth:** This file. All frontend migration progress tracked here only.

---

## Strict Agent Rules

```
1. ONE file per task. Never implement two files in the same step.
2. Never refactor existing module pages (orders, leads, tasks, etc).
3. Never touch lib/auth/ contents until Phase 2 is fully verified (Step 11c is Phase 3).
4. Never replace useSession or useTokenExpiry until AppShell is confirmed stable.
5. Always update the Status Table in this file after each completed step.
6. Stop and confirm with user before moving to the next phase.
7. Foundation must be manually tested before Phase 2 begins.
8. SELF-REVIEW AFTER EVERY STEP: After implementing any file, re-read the
   complete output and cross-check the following before marking done:
     a) All imports resolve — no missing or circular dependencies.
     b) No old token patterns remain (localStorage.getItem('accessToken'),
        tokenStore.get(), manual Authorization header construction).
     c) No deprecated function calls still active (getToken(), verifyToken(),
        saveSession(), getSession() from client-auth.ts).
     d) Async/await correctness — no floating promises, no missing awaits.
     e) Clerk hooks used inside correct provider boundary (ClerkProvider).
     f) Any finding — even minor — must be reported to user before step
        is marked ✅. Never silently fix and continue.
```

---

## What This Plan Covers (Foundation Only)

```
┌────────────────────────────────────────────────────┐
│  FOUNDATION — 4 pieces, in strict order            │
│                                                    │
│  1. ClerkProvider     → app/layout.tsx             │
│  2. ClerkTokenProvider→ providers/                 │
│  3. ApiClient update  → lib/api/client.ts          │
│  4. AppShell update   → components/AppShell.tsx    │
│                                                    │
│  usePermissions, stores/ → Phase 2 (not yet)       │
│  RBAC replacement         → Phase 3 (not yet)      │
│  Module pages             → Phase 4 (not yet)      │
└────────────────────────────────────────────────────┘
```

---

## Current vs Target — Files Affected (Foundation Only)

| File | Current State | After Foundation | Touch Now? |
|---|---|---|---|
| `app/layout.tsx` | No auth provider | Wrap with ClerkProvider + ClerkTokenProvider | ✅ Step 1 |
| `providers/ClerkTokenProvider.tsx` | Does not exist | New — injects Clerk JWT into axios | ✅ Step 2 |
| `lib/api/client.ts` | Manual JWT header logic | Clerk interceptor + AbortController | ✅ Step 3 |
| `lib/request-registry.ts` | Does not exist | New — AbortController registry | ✅ Step 3b |
| `app/(auth)/login/page.tsx` | lib/auth login call | Clerk useSignIn() + existing UI preserved | ✅ Step 4 |
| `components/AppShell.tsx` | useSession + useTokenExpiry | useAuth() + permission loader + route guard | ✅ Step 5 |
| `context/SessionProvider.tsx` | Active | Kept as-is — deprecated later | ❌ Not yet |
| `hooks/useSession.ts` | Active | Kept as-is — deprecated later | ❌ Not yet |
| `hooks/useTokenExpiry.ts` | Active | Kept as-is — deprecated later | ❌ Not yet |
| `lib/auth/client-auth.ts` | Active — localStorage token system | Shimmed — `getToken()` → null, Clerk interceptor owns tokens | ✅ Phase 3 |
| `components/RBAC/ProtectedComponent` | Active | Untouched | ❌ Not yet |
| `hooks/useRBAC.ts` | Active | Untouched | ❌ Not yet |
| `stores/permission-store.ts` | Does not exist | Phase 2 | ❌ Not yet |
| `hooks/usePermissions.ts` | Does not exist | Phase 2 | ❌ Not yet |
| All module pages | Active | Untouched | ❌ Not yet |

---

## Install — Before Any Code

```bash
npm install @clerk/react
```

Add to `.env.local`:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
```

> Sign-in URL maps to your existing `app/(auth)/login` route — no new route needed.

---

## Phase 1 — Foundation (4 steps, one file each)

---

### Step 1 — `app/layout.tsx`
**Task:** Wrap root layout with `<ClerkProvider>` and `<ClerkTokenProvider>`.

**Rules:**
- Do NOT change fonts, metadata, or any other existing layout logic.
- `ClerkTokenProvider` imported but does not exist yet — Step 2 creates it.
- `ClerkProvider` uses client-side only — no `auth()` server import.

**What changes:**
```
Before: <html> <body> {children} </body> </html>
After:  <html> <body>
          <ClerkProvider>
            <ClerkTokenProvider>
              {children}
            </ClerkTokenProvider>
          </ClerkProvider>
        </body> </html>
```

**Verify:** App boots without error. No functionality change yet.

---

### Step 2 — `providers/ClerkTokenProvider.tsx`
**Task:** New file. Registers axios request interceptor that attaches Clerk JWT as Bearer token.

**Rules:**
- `'use client'` directive required.
- Must be placed INSIDE `<ClerkProvider>` in layout — already done in Step 1.
- Interceptor must be ejected on unmount (useEffect cleanup).
- Only attaches token when `isSignedIn === true`.
- Does NOT replace existing `lib/auth/` token logic yet.

**Shape:**
```
useEffect:
  register interceptor → calls getToken() → sets Authorization header
  return cleanup → eject interceptor
```

**Verify:** Open Network tab. Any axios call to the API should carry `Authorization: Bearer <token>`.
If the user is not signed in, no header is attached.

---

### Step 3a — `lib/request-registry.ts`
**Task:** New file. Global AbortController registry used by AppShell and api client.

**Rules:**
- Pure TypeScript — no React imports.
- Exported as singleton: `export const requestRegistry = new RequestRegistry()`.
- Three methods only: `register(id)`, `cancel(id)`, `cancelAll()`.
- `register()` must abort any existing controller with the same id before creating new one.

**Verify:** Import in browser console. Call `cancelAll()` — no errors thrown.

---

### Step 3b — `lib/api/client.ts`
**Task:** Update existing axios instance. Add AbortController interceptor. Keep all existing logic intact.

**Rules:**
- Do NOT remove existing base URL, timeout, or header config.
- Do NOT remove existing response error handling.
- Only ADD two things:
  1. Request interceptor: `requestRegistry.register(method:url)` → attach signal.
  2. Response interceptor: `axios.isCancel(err)` → return `Promise.resolve(null)` silently.
- The existing 401 handler (`auth:expired` event dispatch) stays untouched.

**What changes:**
```
Add import: requestRegistry
Add request interceptor: attach AbortController signal
Add cancel guard in response interceptor: swallow cancellation silently
```

**Verify:** Navigate between pages rapidly. Cancelled requests show as `(cancelled)` in Network tab, no console errors.

---

### Step 4 — `app/(auth)/login/page.tsx`
**Task:** Replace existing `lib/auth` login call with Clerk `useSignIn()`. Preserve all existing UI — layout, inputs, button, error display — unchanged.

**Rules:**
- Do NOT redesign the page. Existing layout and styles stay exactly as-is.
- Remove: import of `lib/auth` login function, manual token storage calls.
- Remove: any `localStorage.setItem` or `sessionStorage.setItem` for tokens.
- Add: `useSignIn` from `@clerk/react`.
- Replace form submit handler body only:
  ```
  Before: call lib/auth login → store token manually → redirect
  After:  signIn.create({ identifier, password })
            → if complete → setActive({ session }) → router.replace('/dashboard')
            → if error    → display err.errors[0].message in existing error UI
  ```
- `forgot-password` route: untouched in this step.
- No new UI elements added. No existing UI elements removed.

**Why login is Step 4 (before AppShell):**
AppShell's route guard redirects unauthenticated users to `/login`.
If `/login` is not Clerk-aware yet, the redirect loop breaks.
Login must work before AppShell guard is activated.

**Verify:**
- Submit with wrong credentials → error message appears in existing error UI.
- Submit with correct credentials → redirects to `/dashboard`.
- Clerk Dashboard → Users → confirm session created for that user.
- No `token` key in localStorage after login (Clerk manages session internally).

---

### Step 5 — `components/AppShell.tsx`
**Task:** Replace `useSession` + `useTokenExpiry` with Clerk hooks. Add route guard, permission loader placeholder, and request cancellation on route change.

**Rules:**
- Remove: `useSession`, `useTokenExpiry` imports and calls.
- Add: `useAuth`, `useUser`, `useClerk` from `@clerk/react`.
- Route guard: `useEffect` — if `isLoaded && !isSignedIn` → `router.replace('/login')`.
- Request cancellation: `usePathname()` watcher → `requestRegistry.cancelAll()` on change.
- Permission loader: single `useEffect` stub — `if (isSignedIn) { /* Phase 2 */ }`.
- `NavBar` props: pass `user` from `useUser()`, `onLogout` from `useClerk().signOut`.
- Do NOT change anything about `NavbarExtensionProvider` or `NavbarExtensionSlot` if present.
- `LoadingContext` — keep existing loading state wiring if present.

**Verify:**
- Unauthenticated visit to `/dashboard` → redirects to `/login`.
- Authenticated visit → renders normally.
- Rapid page switching → Network tab shows cancelled requests.
- Logout button → clears session, redirects to `/login`.

---

## Status Table — Update After Each Step

| Step | File | Status | Verified |
|---|---|---|---|
| Install | `@clerk/react` + `.env.local` | ⬜ Pending | ⬜ |
| 1 | `app/layout.tsx` | ⬜ Pending | ⬜ |
| 2 | `providers/ClerkTokenProvider.tsx` | ⬜ Pending | ⬜ |
| 3a | `lib/request-registry.ts` | ⬜ Pending | ⬜ |
| 3b | `lib/api/client.ts` | ⬜ Pending | ⬜ |
| 4 | `app/(auth)/login/page.tsx` | ⬜ Pending | ⬜ |
| 5 | `components/AppShell.tsx` | ⬜ Pending | ⬜ |

> Mark ✅ Done or 🔴 Blocked. Never start next step while any step shows 🔴.

---

## Phase 2 — Permission Layer (locked until Phase 1 verified)

**Not starting until all Phase 1 steps are ✅ and manually tested.**

### Decisions locked in for Phase 2

| Decision | Choice |
|---|---|
| Permission model | Manifest-based only — `fields[].visible/editable/deletable`, `sections[].visible` |
| `can()` pattern | Dropped — no flat permission list on frontend |
| `isSectionVisible` | Reads `section.visible` boolean explicitly from manifest |
| `apiKey()` pre-flight gate | Phase 3 — not in Phase 2 |
| Store shape | `manifests: Record<AppModule, PermissionManifest>` + `version` hash |

---

### Step 6 — `types/permissions.ts`
**Task:** New file. Define all permission types used across store, hook, and component.

**Rules:**
- Single source for all permission-related types — no inline type definitions elsewhere.
- No RBAC types (`Permission` string union, `Role` enum, etc.) — manifest types only.

**Shape:**
```ts
export type AppModule = 'leads' | 'orders' | 'users' | 'reports'
  | 'customers' | 'attendance' | 'tasks' | 'purchases' | 'visitors';

export interface FieldPermission {
  fieldId:   string;
  visible:   boolean;
  editable:  boolean;
  deletable: boolean;
}

export interface SectionPermission {
  sectionId: string;
  label:     string;
  visible:   boolean;
}

export interface PermissionManifest {
  userId:   string;
  module:   AppModule;
  fields:   FieldPermission[];
  sections: SectionPermission[];
}

export interface PermissionsResponse {
  version:   string;
  manifests: PermissionManifest[];
}
```

**Verify:** Import in another file — no TypeScript errors.

---

### Step 7 — `stores/permission-store.ts`
**Task:** New file. Zustand store with localStorage persistence. Holds all manifests for the signed-in user.

**Rules:**
- State shape: `manifests: Partial<Record<AppModule, PermissionManifest>>`, `version: string | null`, `loaded: boolean`.
- Actions: `setManifests(response: PermissionsResponse)`, `clearManifests()`.
- `setManifests` must: compare incoming `version` to stored `version` — skip update if equal (no re-render, no localStorage write).
- `setManifests` must: convert `manifests[]` array → `Record<AppModule, PermissionManifest>` for O(1) lookup.
- `clearManifests` must: reset all state to initial — called on logout.
- Use `zustand/middleware` `persist` — localStorage key: `app-permissions`.
- No direct MongoDB or API calls inside the store — store is dumb, AppShell feeds it.

**Verify:**
- Call `setManifests` with mock data → `localStorage.getItem('app-permissions')` shows correct JSON.
- Hard refresh → store re-hydrates from localStorage without API call (when version matches).
- Call `clearManifests` → localStorage key is removed.

---

### Step 8 — `hooks/usePermissions.ts`
**Task:** New file. Hook that reads from the permission store and returns boolean accessors.

**Rules:**
- Reads `manifests[module]` from store — single selector, no subscriptions to entire store.
- Returns four functions only:
  - `isVisible(fieldId: string): boolean` — reads `field.visible`. Default: `true` if field not found.
  - `isEditable(fieldId: string): boolean` — reads `field.editable`. Default: `false` if field not found.
  - `isDeletable(fieldId: string): boolean` — reads `field.deletable`. Default: `false` if field not found.
  - `canViewSection(sectionId: string): boolean` — reads `section.visible`. Default: `true` if section not found.
- No `can()`. No `isSectionVisible(system)` based on ANY-permission logic.
- Defaults are conservative: unknown fields default to `visible=true` (show), `editable=false` (protect).
- Unknown sections default to `visible=true` — opt-in hiding, not opt-in showing.

**Why these defaults:**
If the manifest hasn't loaded yet (first render), hiding everything causes layout flash.
Showing fields but blocking edits is the safer degraded state.

**Verify:**
- Call with a module that has no manifest loaded → all functions return their documented defaults.
- Call with a module that has a manifest → returns correct boolean per field/section.

---

### Step 9 — `components/PermissionGate.tsx`
**Task:** New file. Wrapper component that conditionally renders children based on manifest.

**Rules:**
- Props: `module: AppModule`, `field?: string`, `section?: string`, `fallback?: ReactNode`.
- Exactly one of `field` or `section` must be provided — not both, not neither (TypeScript enforced).
- Uses `usePermissions(module)` internally.
- `field` prop → calls `isVisible(field)`.
- `section` prop → calls `canViewSection(section)`.
- If check returns `false` → renders `fallback` (default: `null`).
- No other logic. No API calls. No side effects.

**TypeScript enforcement shape:**
```ts
type PermissionGateProps =
  | { module: AppModule; field: string;   section?: never; fallback?: ReactNode; children: ReactNode }
  | { module: AppModule; section: string; field?: never;   fallback?: ReactNode; children: ReactNode };
```

**Verify:**
- Seed store with a manifest where `name` field `visible: false`.
- Wrap a `<p>Name</p>` in `<PermissionGate module="leads" field="name">`.
- Confirm it does not render.
- Set `visible: true` → confirm it renders.

---

### Step 10 — `components/AppShell.tsx` (Phase 2 update)
**Task:** Add permission fetching to the existing AppShell updated in Step 5. Wire `GET /api/permissions` → store.

**Rules:**
- Add ONE new `useEffect` only — do not touch any existing effects from Step 5.
- Trigger: `isSignedIn === true && !loaded`.
- Call: `apiClient.get<PermissionsResponse>('/api/permissions')`.
- On success: call `setManifests(response.data)`.
- On error: log warning only — do not block the app. Permissions degrade to defaults.
- On `isSignedIn === false`: call `clearManifests()`.
- The fetch must happen exactly once per login session (Zustand `loaded` flag guards this).

**Verify:**
- Login → Network tab shows exactly one `GET /api/permissions` request.
- Hard refresh while logged in → no second request (version match from localStorage).
- Logout → `clearManifests()` called → localStorage key removed.
- Backend unavailable → app loads with default permissions, no crash.

---

### Phase 2 Status Table

| Step | File | Status | Verified |
|---|---|---|---|
| 6 | `types/permissions.ts` | ⬜ Pending | ⬜ |
| 7 | `stores/permission-store.ts` | ⬜ Pending | ⬜ |
| 8 | `hooks/usePermissions.ts` | ⬜ Pending | ⬜ |
| 9 | `components/PermissionGate.tsx` | ⬜ Pending | ⬜ |
| 10 | `components/AppShell.tsx` (Phase 2 update) | ⬜ Pending | ⬜ |

> Steps 6 → 10 must be completed in order. Step 10 depends on Steps 6–9 all being ✅.

---

## Phase 3 — RBAC Shims + apiKey Gate (locked until Phase 2 verified)

**Not starting until all Phase 2 steps are ✅ and manually tested.**

### Decisions locked in for Phase 3

| Decision | Choice |
|---|---|
| `PermissionGate` roles prop | Rejected — manifest-only, no role prop added |
| Legacy `ProtectedComponent` | Shimmed — same external API, reads role from Clerk internally |
| Legacy `useRBAC` | Shimmed — reads `user.publicMetadata.role` from Clerk |
| `useSession` | Shimmed — keeps same shape, backed by Clerk hooks |
| `useTokenExpiry` | Shimmed — backed by Clerk's own expiry handling |
| `accessToken` in components | Deprecated — axios interceptor owns tokens, components never touch them |
| Deprecated file deletion | Option A — shims keep files alive, deletion happens in Phase 4 per module |
| Role source — shims | `user.publicMetadata.role` via `useUser()` — set by BAPI from Express on user create/update |
| Role source — change detection | `permissionStore.role` piggybacked on `GET /api/permissions` response |
| Role change session handling | Soft banner — user re-logs in at own convenience |
| Version hash | Must include role — backend: `hash(manifests) + ":" + user.role` |

---

### Step 11 prerequisite — Backend + store changes before shims begin

`clerkClient.users.updateUser` with `publicMetadata` is free when called server-side via BAPI.
Shims read role from `user.publicMetadata.role` (synchronous, from Clerk session).
Permissions response also carries role for change detection only.

**Backend A — `src/lib/cache/permission-cache.ts`:**
Version hash must include role so a role change alone triggers a version mismatch:
```
// Before
version: hash(manifests)

// After
version: hash(manifests) + ':' + user.role
```

**Backend B — `src/routes/permissions.ts`:**
```
// Before
res.json({ version, manifests })

// After
res.json({ version, role: req.user.role, manifests })
```

**Backend C — `src/routes/admin/users.ts` (new endpoint pair):**
```
POST  /api/admin/users
  → casbinEnforce('users', 'admin-config')   (super admin only)
  → clerkClient.users.createUser({ emailAddress, password, publicMetadata: { role } })
  → UserModel.create({ clerkId, role, ... })

PATCH /api/admin/users/:clerkId/role
  → casbinEnforce('users', 'admin-config')   (super admin only)
  → clerkClient.users.updateUser(clerkId, { publicMetadata: { role: newRole } })
  → UserModel.findOneAndUpdate({ clerkId }, { role: newRole })
  → permissionCache.invalidate(clerkId)
```

**Frontend A — `types/permissions.ts`:**
```ts
export interface PermissionsResponse {
  version:   string;
  role:      string;    // ← add
  manifests: PermissionManifest[];
}
```

**Frontend B — `stores/permission-store.ts`:**
```ts
// Add to state
role:        string | null;
roleChanged: boolean;

// setManifests — detect role change, store new role
const prevRole = get().role;
const roleChanged = !!prevRole && prevRole !== data.role;
set({ manifests, role: data.role, version: data.version,
      loaded: true, roleChanged: get().roleChanged || roleChanged });

// clearManifests — full reset
set({ manifests: {}, role: null, version: null,
      loaded: false, roleChanged: false });

// dismissRoleChange — user dismissed banner but hasn't re-logged
dismissRoleChange: () => set({ roleChanged: false });
```

**Verify before Step 11:**
- Login → `GET /api/permissions` response includes `role`.
- `user.publicMetadata.role` === `permissionStore.role` for same user.
- Admin updates role → version hash changes → store refreshes → `roleChanged: true`.

---

### Step 11b — `components/RoleChangedBanner.tsx` (new)
**Task:** New component. Renders when `permissionStore.roleChanged === true`.

**Rules:**
- Reads `roleChanged` and `dismissRoleChange` from permission store only.
- Two actions: [Re-login] → `signOut()`. [Dismiss] → `dismissRoleChange()`.
- Mounted inside `AppShell` above `{children}` — visible on all authenticated pages.
- Do NOT block navigation or page content — banner only, not a modal.
- Message: static string — "Your access level has been updated. Sign in again to apply the latest permissions."

**Verify:**
- Manually set `roleChanged: true` in store → banner appears.
- Click Dismiss → banner disappears, store `roleChanged` is `false`.
- Click Re-login → `signOut()` called, redirects to `/login`.

---

### Step 11 — `hooks/usePermissions.ts` (add `apiKey`)
**Task:** Add one function to the existing hook from Step 8. No other changes.

**Rules:**
- Add only: `apiKey(sectionId: string, key: string): string | null`.
- Returns `key` if `canViewSection(sectionId)` is `true`, otherwise `null`.
- No changes to `isVisible`, `isEditable`, `isDeletable`, `canViewSection`.

**Shape:**
```ts
apiKey: (sectionId: string, key: string) =>
  canViewSection(sectionId) ? key : null
```

**Usage in pages (Phase 4 reference):**
```ts
const { apiKey } = usePermissions('leads');
// SWR only fires if section is visible — null key = fetch disabled
const { data } = useSWR(apiKey('deal-financials', '/api/leads/financials'), fetcher);
```

**Verify:**
- Section `visible: true`  → `apiKey(...)` returns the url string.
- Section `visible: false` → `apiKey(...)` returns `null`.

---

### Step 11c — `lib/auth/client-auth.ts` (shim)
**Task:** Replace token storage internals with no-ops and deprecation warnings. Keep exports intact — module pages still import from this file.

**Why this step must come before Step 12:**
`useSession` shim (Step 12) currently imports `getSession()` from this file.
If this file still returns a localStorage token, it conflicts with the Clerk session.
This shim must be in place before any hook shims begin.

**Rules:**
- Do NOT delete this file. Module pages import from it.
- Do NOT change any export names or function signatures — only the internals.
- `TOKEN_EXPIRED_EVENT` — keep exactly as-is. Still dispatched by axios interceptor.
- `notifyTokenExpired()` — keep event dispatch. Remove `clearSession()` call inside it (Clerk owns signOut).
- `getToken()` — return `null`. Add `console.warn` in dev: `"[client-auth] getToken() is deprecated. Token injection handled by ClerkTokenProvider."` This surfaces any call site still using it.
- `getSession()` — return `null`. Add `console.warn` in dev: `"[client-auth] getSession() is deprecated. Use useUser() from @clerk/react."`.
- `saveSession()` — throw `Error('[client-auth] saveSession() is deprecated. Login handled by Clerk useSignIn().')`. Login page was already migrated in Step 4 — no legitimate caller remains.
- `clearSession()` — keep only legacy localStorage cleanup (`removeItem('accessToken')`, `removeItem('currentUserProfile')`). Remove `profileCache = null` (cache no longer exists).
- `tokenStore` — all methods return `null` / no-op. Keep `clear()` for legacy key cleanup only.
- `profileCache` — delete the variable entirely. No longer needed.
- `verifyToken()` — delete the function body, keep the export as a stub that throws: `"[client-auth] verifyToken() is deprecated."`.

**Self-review checklist specific to this step:**
- [ ] No `localStorage.getItem('accessToken')` in active code paths.
- [ ] `getToken()` returns `null` — confirm axios interceptor is the only token source.
- [ ] `TOKEN_EXPIRED_EVENT` constant still exported and matches the string in `api-client.ts`.
- [ ] No other file in `lib/auth/` imports from `client-auth.ts` and relies on a live token.

**Verify:**
- Network tab: Bearer token on API calls comes from Clerk (format: Clerk JWT), not from localStorage.
- `localStorage.getItem('accessToken')` returns `null` after login.
- Console shows `[client-auth]` deprecation warnings for any call site still hitting old functions — note every one and report to user.
- App functions normally — login, navigation, API calls all work.

---

### Step 12 — `hooks/useSession.ts` (shim)
**Task:** Replace internals with Clerk hooks. Keep exact same return shape so no module page breaks.

**Rules:**
- Signature unchanged: `useSession({ required?: boolean })`.
- Read user from `useUser()` and `useAuth()` from `@clerk/react`.
- `user.role` → `useUser().user?.publicMetadata?.role as string` — set by BAPI when admin creates/updates user.
- `user.name`, `user.email` → from `clerkUser.fullName`, `clerkUser.primaryEmailAddress`.
- `accessToken` → return `null` and add `console.warn` in dev:
  `"accessToken from useSession is deprecated. Tokens are managed by axios interceptor."`.
- `isLoading` → from Clerk's `isLoaded` (inverted).
- `logout` → `useClerk().signOut()`.
- If `required: true` and user not signed in → `router.replace('/login')`.
- Do NOT delete this file. Module pages still import it.

**Verify:**
- Existing page using `useSession` renders correctly — no prop shape errors.
- `currentUserProfile.role` returns the correct role string.
- `currentUserProfile?.accessToken` returns `null` with a console warning.

---

### Step 13 — `hooks/useTokenExpiry.ts` (shim)
**Task:** Replace internals. Clerk handles token refresh automatically — this hook becomes a no-op.

**Rules:**
- Keep the file and its export signature intact.
- Remove all manual JWT expiry logic.
- Body becomes: listen for `auth:expired` event (still fired by axios interceptor on 401) → call `signOut()`.
- Clerk's own session management handles refresh — no manual interval or decode needed.
- Do NOT delete this file.

**Verify:**
- Hook mounts without error.
- Simulate 401 response from backend → `auth:expired` event fires → user is signed out and redirected.

---

### Step 14 — `context/SessionProvider.tsx` (shim)
**Task:** Convert to a passthrough. Context still exists so any `useContext(SessionContext)` call doesn't crash.

**Rules:**
- Keep the file and `SessionContext` export.
- `SessionProvider` renders children directly — no state, no fetch, no logic.
- Context value reads from `useSession()` shim (Step 12) so any consumer gets correct data.
- Do NOT delete this file.

**Verify:**
- Pages wrapped in `SessionProvider` still render.
- `useContext(SessionContext)` returns a value without error.

---

### Step 15 — `hooks/useRBAC.ts` (shim)
**Task:** Replace role source from `useSession` → Clerk's `useUser`. Keep same return shape.

**Rules:**
- Remove import of `useSession`.
- Add import of `useUser` from `@clerk/react`.
- Role reads from `useUser().user?.publicMetadata?.role as string` — synchronous, available as soon as Clerk loads.
- All existing return values (`hasRole`, `hasAnyRole`, `hasAllRoles`, or whatever shape exists) — keep identical.
- Do NOT delete this file.

**Verify:**
- Component using `useRBAC` with `role: "admin"` renders correctly for admin user.
- Same component does not render for `role: "sales"` user.

---

### Step 16 — `components/RBAC/ProtectedComponent.tsx` (shim)
**Task:** Replace internal role check to use shimmed `useRBAC` (Step 15). External API unchanged.

**Rules:**
- If `ProtectedComponent` already uses `useRBAC` internally → only the hook change in Step 15 is needed, this step may be a no-op.
- If it reads `useSession` directly → replace with `useRBAC`.
- Props interface unchanged.
- Do NOT delete this file.

**Verify:**
- Existing usage of `<ProtectedComponent role="admin">` works correctly.
- No TypeScript errors on existing props.

---

### Step 17 — `components/AppShell.tsx` (Phase 3 cleanup)
**Task:** Remove any remaining direct imports of `useSession` or `useTokenExpiry`. Use Clerk hooks directly.

**Rules:**
- AppShell already uses Clerk hooks from Step 5 — this step removes any leftover legacy imports only.
- If AppShell has no legacy imports remaining after Step 5 → this step is a no-op. Confirm and mark done.

**Verify:**
- `grep -n "useSession\|useTokenExpiry" components/AppShell.tsx` returns nothing.

---

### Phase 3 Status Table

| Step | File | Status | Verified |
|---|---|---|---|
| Pre | Backend: add `role` to `GET /api/permissions` response | ✅ Done | ✅ |
| Pre | Frontend: add `role` to `PermissionsResponse` type + permission store | ✅ Done | ✅ |
| 11 | `hooks/usePermissions.ts` (add apiKey) | ✅ Done | ✅ |
| 11b| `components/RoleChangedBanner.tsx` | ✅ Done | ✅ |
| 11c| `lib/auth/client-auth.ts` (shim) | ✅ Done | ✅ |
| 12 | `hooks/useSession.ts` (shim) | ✅ Done | ✅ |
| 13 | `hooks/useTokenExpiry.ts` (shim) | ✅ Done | ✅ |
| 14 | `context/SessionProvider.tsx` (shim) | ✅ Done | ✅ |
| 15 | `hooks/useRBAC.ts` (shim) | ✅ Done | ✅ |
| 16 | `components/RBAC/ProtectedComponent.tsx` (shim) | ✅ Done | ✅ |
| 17 | `components/AppShell.tsx` (cleanup) | ✅ Done | ✅ |

> The backend prerequisite must be verified before Step 11 begins.
> Steps 12–16 can be done in any order once Step 11 is complete.
> Step 17 last.

---

## Phase 4 — Module Pages (locked until Phase 3 verified)

Will cover wiring `usePermissions` into:
- `leads/` + `leads-center/`
- `orders/`
- `customers/`
- `attendance/`, `tasks/`, `reports/`, `visitors/`, `purchases/`

One module at a time. Same rule applies.

---

## Environment Variables — Final State (reference)

```bash
# .env.local (frontend)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
NEXT_PUBLIC_API_URL=https://your-express-api.com
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
```

---

## What Is NOT in This File

Backend migration (Casbin, Clerk Express middleware, webhooks, permission manifests)
→ Tracked in `auth-migration-plan.md`

Frontend pages and module-level permission wiring
→ Tracked here in Phase 4 (locked until Phase 3 done)