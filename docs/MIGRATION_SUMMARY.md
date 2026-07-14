# Clerk & Permission System Migration Summary

This document tracks the progress and technical changes implemented during the frontend migration to Clerk (v7) and a manifest-based granular permission system.

## Phase 1: Foundation Layer (Complete)
**Objective:** Replace legacy local authentication with Clerk and integrate it into the global request lifecycle.

- **Clerk Integration**: Root layout wrapped with `ClerkProvider`.
- **Axios Interceptor**: Implemented `ClerkTokenProvider` to automatically attach Clerk JWT to all outgoing API requests via `axiosInstance`.
- **Request Cancellation**: Introduced `requestRegistry` and `AbortController` integration in `apiClient` to cancel pending requests on route changes.
- **Login Page**: Refactored `app/(auth)/login/page.tsx` to use Clerk's `useSignIn`, supporting both password and OTP/MFA flows while preserving the existing neumorphic UI.
- **AppShell Guard**: Updated `AppShell.tsx` with a Clerk-aware route guard and navigation cancellation.

## Phase 2: Permission Layer (Complete)
**Objective:** Implement a manifest-based permission system to allow field-level control across modules.

- **Type Definitions**: Created `types/permissions.ts` as the single source of truth for `AppModule`, `FieldPermission`, and `SectionPermission`.
- **Persistent Store**: Created `stores/permission-store.ts` using Zustand + `persist` to cache permissions in `localStorage` with version-based invalidation.
- **Consumption Hook**: Created `hooks/usePermissions.ts` providing `isVisible`, `isEditable`, `isDeletable`, and `canViewSection` helpers with conservative defaults.
- **Declarative Gate**: Created `components/PermissionGate.tsx` for wrapping UI elements based on manifest checks.
- **Auto-Fetching**: Updated `AppShell` to fetch `/api/permissions` automatically upon login.

## Phase 3: RBAC Shims & apiKey Gate (Complete)
**Objective:** Bridge the gap between the legacy RBAC system and the new foundation to ensure zero-breakage.

- **Role Detection**: Added `role` tracking and `roleChanged` detection to the permission store.
- **RoleChangedBanner**: Created `components/RoleChangedBanner.tsx` to notify users when their access level has been updated by an admin.
- **apiKey Helper**: Added `apiKey(section, url)` to `usePermissions` to act as a pre-flight gate for SWR/fetching.
- **Legacy Auth Interop**: Shimmed `lib/auth/client-auth.ts` to replace localStorage token management with no-ops and deprecation warnings.
- **Legacy Hook/Provider Shims**: Refactored the following files to use Clerk internals while maintaining their legacy API shape:
    - `hooks/useSession.ts`
    - `hooks/useTokenExpiry.ts`
    - `hooks/useRBAC.ts`
    - `providers/SessionProvider.tsx`
    - `components/RBAC/ProtectedComponent.tsx`
- **401 Wiring**: Updated `apiClient` to trigger the `auth:expired` event, which is now caught by the shimmed `useTokenExpiry` to initiate a Clerk `signOut`.

## Current Project State
The application foundation is now fully migrated to Clerk. 
- **Authentication**: Managed by Clerk.
- **Permissions**: Fetched and stored in Zustand; accessible via `usePermissions`.
- **Legacy Components**: Still functional but backed by Clerk data.
- **Tokens**: Automatically handled by Axios; direct access to `accessToken` is deprecated.

## Next Steps (Phase 4)
- **Module Integration**: Begin wiring `usePermissions` and `PermissionGate` into specific module pages:
    - Leads & Leads Center
    - Orders
    - Customers
    - Attendance, Tasks, Reports, etc.
- **Cleanup**: Eventually remove legacy shims once all modules have been updated (Phase 4 final).
