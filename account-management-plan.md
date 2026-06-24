# Account Management Plan
## Self-Service Profile + Super-Admin Extended View

**Covers:** Backend (Express) + Frontend (Next.js)
**Builds on:** `user-management-plan.md` (admin-managed user CRUD — this plan is the
complementary "manage MY OWN account" surface, distinct from "admin manages OTHER users")
**Scope locked from clarification:**
- Self-editable by ANY role: name, password, avatar, contact number
- Super-admin-exclusive extras: active sessions list, raw Clerk + cache debug info, login/audit history

---

## Decisions Locked

| # | Decision | Rationale |
|---|---|---|
| D1 | Name, password, avatar editing delegated to Clerk's prebuilt `<UserProfile />` component | Clerk's component is security-vetted (password strength, MFA, session list). Building custom UI for password change duplicates a solved, high-risk surface. |
| D2 | `<UserProfile />` is shown to **all roles**, not gated to super-admin | **Tradeoff flagged for confirmation:** Clerk's component does not support hiding individual tabs (e.g. "Security/Sessions") per role without ejecting into a fully custom UI — a much larger build. Giving every user self-service session management is reasonable practice. This means "active sessions + revoke" ends up available to all roles via Clerk's native UI, not exclusively super-admin as originally framed. The two genuinely super-admin-exclusive items (debug info, audit history) are NOT in Clerk's widget and are built custom below. |
| D3 | `contactNo` is the only field requiring a NEW backend write path | Name/avatar/password are Clerk-native — client SDK + existing webhook handles sync. `contactNo` is Mongo-only (not a Clerk concept), so it needs its own endpoint. |
| D4 | Self-edit endpoint uses a strict field allowlist | Prevents mass-assignment — a user must never be able to PATCH their own `role`, `department`, or `organization` through this endpoint. |
| D5 | Login/audit history is a new `login_audit_log` collection, populated by extending the existing Clerk webhook | Reuses webhook infrastructure already built in `user-management-plan.md` rather than introducing a second sync mechanism. |
| D6 | Login count is computed by querying `login_audit_log`, not a stored running counter | Avoids increment race conditions on concurrent logins (e.g. multiple tabs). |
| D7 | Debug info (raw Clerk claims + cache state) is super-admin-only and excluded from any non-authenticated path | This endpoint is an introspection tool — must never leak signing secrets, only decoded claims and cache metadata. |

---

## Schema Additions

### `User` collection — one new field

```ts
interface IUser {
  // ...existing fields from user-management-plan.md...
  avatarUrl: string;   // NEW — mirrors Clerk's image_url, synced via webhook
}
```

`avatarUrl` is synced the same way `email`/`name` are — via the `user.updated` webhook handler
already defined in `user-management-plan.md` Step B1. No new sync mechanism required.

### New collection — `login_audit_log`

```ts
interface ILoginAuditEntry {
  clerkId:    string;
  sessionId:  string;
  event:      'session.created' | 'session.ended' | 'session.removed';
  timestamp:  Date;
  userAgent?: string;
  ipAddress?: string;
}
```

- Index: `{ clerkId: 1, timestamp: -1 }` — fast lookup of a user's recent activity.
- TTL index: `{ timestamp: 1 }`, `expireAfterSeconds` from `LOGIN_AUDIT_RETENTION_DAYS` env var
  (default 180 days). Prevents unbounded growth.

---

## API Contracts

### `GET /api/account/me`
Any authenticated user. Returns own profile. Super-admin gets `adminExtras`.

```ts
// Response 200 — all roles
{
  success: true,
  account: {
    clerkId, email, name, avatarUrl, role,
    department, organization, contactNo, createdAt
  },
  // present ONLY when req.user.role === 'super-admin'
  adminExtras?: {
    loginAudit: ILoginAuditEntry[];     // last 20, paginated
    debug: {
      sessionClaims:       Record<string, unknown>;  // decoded JWT claims
      permissionCacheEntry: { version: string; cachedAt: string } | null;
      casbinEnforceMode:   'audit' | 'enforce';
    };
  };
}
```

### `PATCH /api/account/me`
Any authenticated user. Self-edit only. **Allowlist-enforced.**

```ts
// Request body — ONLY this key accepted
{ contactNo?: string }

// Response 400 — any other key present
{ success: false, error: "Field 'role' is not self-editable" }

// Response 200
{ success: true, account: { contactNo: string } }
```

**Server-side allowlist enforcement (non-negotiable):**
```ts
const SELF_EDITABLE_FIELDS = ['contactNo'] as const;

const invalidKeys = Object.keys(req.body).filter(
  k => !SELF_EDITABLE_FIELDS.includes(k as any)
);
if (invalidKeys.length > 0) {
  return res.status(400).json({
    success: false,
    error: `Field '${invalidKeys[0]}' is not self-editable`,
  });
}
```

### Webhook extension — `src/routes/webhooks/clerk.ts` (amend existing file)

Add handling for two new event types, alongside the existing `user.*` handlers:

```
session.created:
  → insert login_audit_log entry { event: 'session.created', sessionId, clerkId, timestamp }

session.ended / session.removed:
  → insert login_audit_log entry { event: 'session.ended'|'session.removed', ... }
```

**Action required (not code — Dashboard config):**
Clerk Dashboard → Webhooks → existing endpoint → add `session.created`, `session.ended`,
`session.removed` to the subscribed events list. Without this, no audit entries are ever created.

---

## Acceptance Criteria

These must all be true before this feature is considered done. Written before implementation begins.

1. Any authenticated user can open their own account page and see name, email, avatar, role
   (read-only), department (read-only), organization (read-only), and contact number (editable).
2. Any user can change their name, password, and avatar through Clerk's embedded `<UserProfile />`
   component — these changes propagate to MongoDB via the existing webhook with zero new backend code.
3. Any user can update their `contactNo` through a dedicated form — the request is rejected
   with 400 if any field other than `contactNo` is present in the payload.
4. A super-admin viewing their own account page sees three additional sections not visible
   to any other role: login/audit history, permission cache debug state, and decoded JWT claims.
5. The debug section never displays the Clerk secret key, JWT signing key, or MongoDB connection
   string — only decoded claims and cache metadata.
6. Login audit entries are created automatically when a session starts or ends — no manual
   logging call required in any route handler.
7. Audit log entries older than `LOGIN_AUDIT_RETENTION_DAYS` are automatically removed by MongoDB TTL.
8. A non-super-admin user calling `GET /api/account/me` never receives an `adminExtras` key in
   the response — not `null`, not `undefined` — the key is absent entirely.

---

## Agent Roster

| Agent | Role | Experience | Responsibility |
|---|---|---|---|
| Architect | System design | Clerk + MongoDB hybrid auth systems | Decisions D1–D7, API contract shape, webhook extension design |
| Backend Engineer | Express + MongoDB | TypeScript, Mongoose, Clerk BAPI | `GET/PATCH /api/account/me`, webhook session event handling, TTL index |
| Frontend Engineer | Next.js + React | Clerk client SDK, Zustand | Embed `<UserProfile />`, build contactNo form, super-admin extras panel |
| Technical Writer | Documentation | API contract clarity | This document, inline comments on allowlist rationale |

DevOps and AI/ML agents are not relevant to this feature — no new infrastructure or model work.

---

## ADR-Lite — Why This Approach

**Why delegate to Clerk's `<UserProfile />` instead of building custom forms for name/password/avatar?**
Password change is a high-risk surface — weak validation, missing rate limiting, or insecure
transport are common sources of account-takeover vulnerabilities. Clerk's component has already
solved this (strength rules, current-password verification, rate limiting, session invalidation
on password change). Rebuilding it custom adds engineering time and introduces a new attack
surface with no functional benefit. The tradeoff — losing some UI styling control — is acceptable.

**Why is `contactNo` the only field needing a new endpoint?**
Every other self-editable field already has a sync mechanism: Clerk owns name/avatar/password
natively, and the existing `user.updated` webhook (built for the admin user-management feature)
already mirrors `name`, `email`, and now `avatarUrl` into MongoDB. `contactNo` has no Clerk
equivalent — it only exists in MongoDB — so it is the only field requiring new backend code.

**Why query `login_audit_log` for login count instead of a stored counter on the User document?**
A stored counter requires an atomic increment (`$inc`) on every login. Under concurrent logins
(multiple tabs, multiple devices) this is safe with `$inc`, but the audit log already contains
the same information, and computing the count from log entries means there is exactly one source
of truth instead of two that could drift apart after a bug or manual data fix.

---

## Backend Implementation — Atomic Tasks (Kanban)

### Backlog → In Progress → Done

| Task | Description |
|---|---|
| BE-1 | Add `avatarUrl` field to `User` schema |
| BE-2 | Extend `user.updated` webhook handler to sync `avatarUrl` (alongside existing email/name) |
| BE-3 | Create `login_audit_log` collection + Mongoose model with TTL index |
| BE-4 | Extend webhook handler: add `session.created` / `session.ended` / `session.removed` cases |
| BE-5 | Clerk Dashboard: subscribe webhook endpoint to session events (config, not code) |
| BE-6 | Create `GET /api/account/me` route — base profile for all roles |
| BE-7 | Extend `GET /api/account/me` — add `adminExtras` block, gated by `req.user.role === 'super-admin'` |
| BE-8 | Create `PATCH /api/account/me` route — allowlist-enforced `contactNo` update |
| BE-9 | Add `LOGIN_AUDIT_RETENTION_DAYS` env var with startup validation (default 180 if unset) |

---

## Frontend Implementation — Atomic Tasks (Kanban)

### Backlog → In Progress → Done

| Task | Description |
|---|---|
| FE-1 | Create `app/account/page.tsx` route |
| FE-2 | Embed Clerk's `<UserProfile />` component (client-side, dynamic import, no SSR) |
| FE-3 | Build `ContactNumberForm` component — calls `PATCH /api/account/me` |
| FE-4 | Build `SuperAdminExtras` component — renders only when `usePermissionStore(s => s.role) === 'super-admin'` |
| FE-5 | Wire `SuperAdminExtras` to `GET /api/account/me` — display `adminExtras.loginAudit` and `adminExtras.debug` |
| FE-6 | Add loading/error states for the contactNo form (toast on success, inline error on validation failure) |

---

## Self-Review Checklist

- [ ] `PATCH /api/account/me` rejects any payload key outside `['contactNo']` with 400.
- [ ] `adminExtras` key is absent (not null) in the response for non-super-admin requesters.
- [ ] Debug endpoint output contains no secrets — manually grep the response for `CLERK_SECRET_KEY`,
      `MONGODB_URI` values to confirm none are echoed back.
- [ ] `login_audit_log` TTL index is verified active in MongoDB Atlas (check index list, not just code).
- [ ] `<UserProfile />` is imported as a client component only — confirm no SSR/server import error
      in static export build.
- [ ] Webhook handler change does not break existing `user.created`/`user.updated`/`user.deleted`
      handling — run existing webhook tests after this change.
- [ ] Lint + typecheck pass on all new files.

---

## CI/CD Pipeline Design

```yaml
# .github/workflows/account-management.yml (conceptual — adapt to existing pipeline)
on:
  pull_request:
    paths:
      - 'src/routes/account.ts'
      - 'src/routes/webhooks/clerk.ts'
      - 'src/models/LoginAuditLog.ts'
      - 'app/account/**'

jobs:
  test:
    steps:
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run test:unit -- account
      - run: npm run test:integration -- account
  deploy-preview:
    needs: test
    steps:
      - run: vercel deploy --preview   # or equivalent for current host
```

No new infrastructure required — same Express server, same MongoDB Atlas cluster.
New env var (`LOGIN_AUDIT_RETENTION_DAYS`) must be added to deployment secrets before merge.

---

## Testing Strategy

### Unit tests
- Allowlist rejection: PATCH with `{ role: 'admin' }` → 400, no DB write occurs.
- Allowlist acceptance: PATCH with `{ contactNo: '+91...' }` → 200, DB updated.
- `adminExtras` presence logic: mock `req.user.role = 'sales'` → response has no `adminExtras` key.
- `adminExtras` presence logic: mock `req.user.role = 'super-admin'` → response has `adminExtras`.
- TTL math: entries older than retention window are excluded from a manual query check.

### Integration tests
- Full webhook flow: simulate `session.created` payload → confirm `login_audit_log` entry created
  with correct `clerkId` and `sessionId`.
- Full webhook flow: simulate `user.updated` with new `image_url` → confirm `avatarUrl` updated
  in MongoDB.
- End-to-end self-edit: authenticated request → PATCH contactNo → GET confirms updated value →
  cache invalidation confirmed (second GET does not return stale data).

---

## Feedback Loop

- **Logs:** Every webhook event (including new session events) logged with event type + clerkId
  at info level. Allowlist rejections logged at warn level (potential probing attempt if frequent
  from same IP).
- **Metrics:** Count of `login_audit_log` inserts per day (sanity check that webhook subscription
  is active — a flatline indicates the Clerk Dashboard subscription was not configured per BE-5).
- **Health check:** `GET /api/account/me` response time — should be < 200ms (cache hit) or
  < 500ms (cache miss + MongoDB query). Alert if p95 exceeds these.

---

## Shift-Left Security Notes

| Concern | Mitigation |
|---|---|
| Mass assignment via PATCH | Strict allowlist, server-enforced (not just TypeScript types) |
| Debug endpoint info leak | Manual secret-grep in self-review checklist; super-admin-only gate |
| Session revocation (via Clerk's widget) | Delegated entirely to Clerk — no custom token/session code written |
| Audit log unbounded growth | TTL index, not manual cleanup job |
| Privilege escalation via self-edit | `role`, `department`, `organization` explicitly excluded from allowlist |

---

## Status Table

| Task | Owner | Status |
|---|---|---|
| BE-1 through BE-9 | Backend | ⬜ Pending |
| FE-1 through FE-6 | Frontend | ⬜ Pending |
| Clerk Dashboard webhook subscription (BE-5) | Manual config | ⬜ Pending |

---

## Open Items Flagged for QA Review

The following were deliberately left as decisions-in-progress rather than fully resolved,
to be validated by the spec QA pass that follows this document:

- D2's tradeoff (session management exposed to all roles, not just super-admin) needs explicit
  user sign-off before implementation — it diverges from the literal original request.
- Concurrent edit behavior (two browser tabs editing `contactNo` simultaneously) is not defined.
- UI feedback timing/format for the contactNo form is not fully specified.
- Pagination behavior for `loginAudit` beyond "last 20" is not defined.
