# Migrate API Calls from `app/` to Centralized `lib/api/endpoints/`

Move all scattered API call patterns (raw `fetch()`, inline `apiClient` usage, local `apiService` classes) out of `app/` components and into the centralized `lib/api/endpoints/` layer. Components will import thin, typed endpoint functions instead of managing URLs, headers, or response unwrapping themselves.

## Current State Summary

### ✅ Already Migrated (using `lib/api/endpoints/`)
These pages **already** import from `lib/api/endpoints/` — **no work needed**:

| Page | Endpoint File |
|------|--------------|
| `app/page.tsx` (Dashboard) | `endpoints/dashboardApi.ts` |
| `app/customers/` | `endpoints/customers.ts` |
| `app/purchases/page.tsx` | `endpoints/purchasesApi.ts` |
| `app/users/` | `endpoints/users.ts` |
| `app/visitors/page.tsx` | `endpoints/visitorApi.ts` |
| `app/reports/page.tsx` | `endpoints/reportsApi.ts` |
| `app/attendance/page.tsx` | `endpoints/attendanceApi.ts` |

### 🔴 Needs Migration

| # | Source File(s) | Current Pattern | Problem |
|---|---------------|-----------------|---------|
| 1 | `app/leads-center/page.tsx` | Raw `fetch()` with manual `BASE_API_URL` + token headers | 5 raw fetch calls, no `apiClient`, no auto-cancellation, manual auth |
| 2 | `app/leads/page.tsx` | Inline `leadApiService` object using `apiClient` directly | 6 calls defined inline in page component file |
| 3 | `app/orders/apiService.ts` | Local `ApiService` class using `apiClient` directly | 14 methods in a class, imported by `page.tsx`, `OrderDetailsDialog`, `EditHistory` |
| 4 | `app/orders/components/CreateOrderDialog.tsx` | Imports `apiService` from `@/lib/data` (legacy) + `fileApi` from `@/lib/api/fileApi` | Mixed legacy imports |
| 5 | `lib/api/taskApi.ts` | Standalone raw `fetch()` with own auth/retry logic | 8 methods using its own `apiFetch` wrapper, bypasses `apiClient` entirely |
| 6 | `lib/api/fileApi.ts` | Standalone raw `fetch()` with `localStorage.getItem('accessToken')` | 4+ methods with hardcoded `localStorage` token reads |

---

## Open Questions

> [!IMPORTANT]
> **Q1: `leads-center` endpoints** — The leads-center page calls `/user/access`, `/leads-center`, `/leads-center/:id`, and `/leads`. Should these all go into a single `leadsCenterApi.ts` endpoint file, or should `/leads` calls be shared with the existing leads page?

> [!IMPORTANT]  
> **Q2: `taskApi.ts` has custom caching logic** (`cache: 'no-store'`) and specific `GetTasksParams` filtering. The migration to `apiClient` (axios-based) will lose the native fetch `cache` option. This is likely fine since `apiClient` has `no-cache` behavior anyway — please confirm.

> [!IMPORTANT]
> **Q3: `fileApi.ts` has `getFileContent()` that returns raw `Blob`** and `getMediaUrl()` / `getPreviewUrl()` which are pure URL builders (no HTTP). Should these URL builders stay in `fileApi` or move to a utility? The blob-fetching methods need special handling since `apiClient` auto-unwraps JSON.

> [!IMPORTANT]
> **Q4: `canTransitionToGeneral()` in `app/orders/apiService.ts`** is a pure function (no API call). It should **not** go in an endpoint file. Should it stay in `app/orders/constants.ts` alongside `STATUS_TRANSITIONS`?

---

## Proposed Changes

### Component 1 — Leads Center Endpoint

#### [NEW] [leadsCenterApi.ts](file:///c:/Users/omsha/Documents/Optimize AI with Skill/cleck-Frontend/lib/api/endpoints/leadsCenterApi.ts)

Create a new centralized endpoint file for all leads-center API calls:
- `getUserAccess()` → `GET /user/access`
- `getLeadsCenterLeads(params)` → `GET /leads-center?...`
- `getLeadsCenterDetail(id, source)` → `GET /leads-center/:id?source=...`
- `claimLead(payload)` → `POST /leads`

All methods use `apiClient` with proper typing.

#### [MODIFY] [page.tsx](file:///c:/Users/omsha/Documents/Optimize AI with Skill/cleck-Frontend/app/leads-center/page.tsx)

- Remove `BASE_API_URL` constant and all raw `fetch()` calls
- Import from `@/lib/api/endpoints/leadsCenterApi`
- Remove manual `Authorization` header injection (handled by `apiClient` interceptor)
- Replace `accessToken` parameter threading with direct API calls

---

### Component 2 — Leads Endpoint

#### [NEW] [leadsApi.ts](file:///c:/Users/omsha/Documents/Optimize AI with Skill/cleck-Frontend/lib/api/endpoints/leadsApi.ts)

Extract the inline `leadApiService` from `app/leads/page.tsx`:
- `getLeads()` → `GET /leads`
- `createLead(data)` → `POST /leads`
- `updateLead(id, fields, historyEntry)` → `PUT /leads/:id`
- `deleteLead(id)` → `DELETE /leads/:id`
- `uploadLeadFile(leadId, files)` → `POST /files/upload`
- `deleteLeadFile(fileId)` → `POST /files/delete`

#### [MODIFY] [page.tsx](file:///c:/Users/omsha/Documents/Optimize AI with Skill/cleck-Frontend/app/leads/page.tsx)

- Remove inline `leadApiService` object (lines ~84-118)
- Remove `import { apiClient } from '@/lib/api/client'`
- Import from `@/lib/api/endpoints/leadsApi`
- Update all call sites

---

### Component 3 — Orders Endpoint

#### [NEW] [ordersApi.ts](file:///c:/Users/omsha/Documents/Optimize AI with Skill/cleck-Frontend/lib/api/endpoints/ordersApi.ts)

Extract from `app/orders/apiService.ts`:
- `getOrders()` → `GET /orders`
- `getOrder(deoNo)` → `GET /orders/:deoNo`
- `createOrder(data)` → `POST /orders`
- `updateOrder(deoNo, fields, editHistory)` → `PUT /orders/:deoNo`
- `updateOrderStatus(deoNo, status, editHistory)` → `PUT /orders/:deoNo`
- `deleteOrder(deoNo)` → `DELETE /orders/:deoNo`
- `getEditHistory(deoNo)` → `GET /orders/:deoNo/history`
- `getRecentOrderNumbers()` → `GET /recent-numbers/ORDER`
- `uploadOrderFile(deoNo, stage, files)` → `POST /files/upload`
- `deleteOrderFile(fileId)` → `POST /files/delete`

Move `canTransitionToGeneral()` → `app/orders/constants.ts` (it's a pure function, not an API call).

#### [DELETE] [apiService.ts](file:///c:/Users/omsha/Documents/Optimize AI with Skill/cleck-Frontend/app/orders/apiService.ts)

Remove entirely after migration.

#### [MODIFY] [page.tsx](file:///c:/Users/omsha/Documents/Optimize AI with Skill/cleck-Frontend/app/orders/page.tsx)

- Replace `import { apiService } from './apiService'` with `import { ordersApi } from '@/lib/api/endpoints/ordersApi'`

#### [MODIFY] [OrderDetailsDialog.tsx](file:///c:/Users/omsha/Documents/Optimize AI with Skill/cleck-Frontend/app/orders/components/OrderDetailsDialog.tsx)

- Replace `import { apiService } from '../apiService'` with `import { ordersApi } from '@/lib/api/endpoints/ordersApi'`
- Replace `import { fileApi } from '@/lib/api/fileApi'` with imports from `@/lib/api/endpoints/fileApi` (new)
- Replace `apiService.canTransitionToGeneral(...)` with import from `constants.ts`

#### [MODIFY] [EditHistory.tsx](file:///c:/Users/omsha/Documents/Optimize AI with Skill/cleck-Frontend/app/orders/components/EditHistory.tsx)

- Replace `import { apiService } from '../apiService'` with `import { ordersApi } from '@/lib/api/endpoints/ordersApi'`

#### [MODIFY] [CreateOrderDialog.tsx](file:///c:/Users/omsha/Documents/Optimize AI with Skill/cleck-Frontend/app/orders/components/CreateOrderDialog.tsx)

- Replace `import { apiService } from '@/lib/data'` with `import { ordersApi } from '@/lib/api/endpoints/ordersApi'`
- Replace `import { fileApi } from '@/lib/api/fileApi'` with imports from the new file endpoint

---

### Component 4 — Tasks Endpoint

#### [NEW] [tasksApi.ts](file:///c:/Users/omsha/Documents/Optimize AI with Skill/cleck-Frontend/lib/api/endpoints/tasksApi.ts)

Rewrite `lib/api/taskApi.ts` to use `apiClient`:
- `getTasks(params)` → `GET /tasks`
- `getTaskById(id)` → `GET /tasks/:id`
- `createTask(data)` → `POST /tasks`
- `createBatchTasks(data)` → `POST /tasks/batch`
- `updateTask(id, data)` → `PUT /tasks/:id`
- `updateTaskStatus(id, status, notes)` → `PATCH /tasks/:id/status`
- `deleteTask(id)` → `DELETE /tasks/:id`
- `getTaskHistory(id)` → `GET /tasks/:id/history`
- `getStats(view)` → `GET /tasks/stats/summary`
- `getEmployees()` → `GET /users/employees`

Preserve the same return types (`GetTasksResponse`, `{ task: Task }`, etc.).

#### [MODIFY] [page.tsx](file:///c:/Users/omsha/Documents/Optimize AI with Skill/cleck-Frontend/app/tasks/page.tsx)

- Replace `import { taskApi } from '@/lib/api/taskApi'` with `import { tasksApi } from '@/lib/api/endpoints/tasksApi'`

#### [MODIFY] [ActivityLog.tsx](file:///c:/Users/omsha/Documents/Optimize AI with Skill/cleck-Frontend/app/tasks/components/ActivityLog.tsx)

- Same import swap

---

### Component 5 — File Endpoint

#### [NEW] [fileApi.ts](file:///c:/Users/omsha/Documents/Optimize AI with Skill/cleck-Frontend/lib/api/endpoints/fileApi.ts)

Rewrite `lib/api/fileApi.ts` to use `apiClient`:
- `uploadFiles(identifier, files, uploadStage, identifierType)` — uses `apiClient.post` for the JSON payload
- `deleteFile(fileId, identifier, identifierType)` — uses `apiClient.post`
- `getFileContent(fileId, filename)` — uses `axiosInstance` directly with `responseType: 'blob'` to get raw binary
- `getPreviewUrl(fileId)`, `getViewUrl(fileId)`, `getDownloadUrl(fileId)` — pure URL builders, kept as-is
- `getMediaUrl(fileId, filename)` — pure URL builder

#### [MODIFY] [OrderDetailsDialog.tsx](file:///c:/Users/omsha/Documents/Optimize AI with Skill/cleck-Frontend/app/orders/components/OrderDetailsDialog.tsx)

- Replace `import { fileApi } from '@/lib/api/fileApi'` → `import { fileApi } from '@/lib/api/endpoints/fileApi'`

#### [MODIFY] [CreateOrderDialog.tsx](file:///c:/Users/omsha/Documents/Optimize AI with Skill/cleck-Frontend/app/orders/components/CreateOrderDialog.tsx)

- Replace `import { fileApi } from '@/lib/api/fileApi'` → `import { fileApi } from '@/lib/api/endpoints/fileApi'`

---

### Component 6 — Cleanup Legacy Files

#### [DELETE] [lib/api/taskApi.ts](file:///c:/Users/omsha/Documents/Optimize AI with Skill/cleck-Frontend/lib/api/taskApi.ts)

Replaced by `lib/api/endpoints/tasksApi.ts`.

#### [DELETE] [lib/api/fileApi.ts](file:///c:/Users/omsha/Documents/Optimize AI with Skill/cleck-Frontend/lib/api/fileApi.ts)

Replaced by `lib/api/endpoints/fileApi.ts`.

#### [DELETE] [lib/api/attendanceApi.ts](file:///c:/Users/omsha/Documents/Optimize AI with Skill/cleck-Frontend/lib/api/attendanceApi.ts)

Already superseded by `lib/api/endpoints/attendanceApi.ts`. The old file uses raw `fetch()` and is commented-out in the import. Safe to delete.

> [!WARNING]
> Before deleting legacy files, we need to verify no other files outside `app/` import them (e.g., contexts, hooks, lib utilities). I will `grep` for all imports before each deletion.

---

## Execution Order

1. **Create endpoint files first** (no breakage — additive only)
2. **Migrate consumers one page at a time**, verifying the build after each
3. **Delete legacy files last**, after confirming zero remaining imports

## Verification Plan

### Automated Tests
```bash
npx next build
```
A clean build confirms all imports resolve, types match, and no dead references remain.

### Manual Verification
- Spot-check each migrated page in the browser to confirm API calls still work (same endpoints, same payloads, same auth tokens).
- Verify network tab shows `Authorization: Bearer <token>` header on each request (injected by `apiClient` interceptor).
- Confirm the `requestRegistry` auto-cancellation still fires on route changes.
