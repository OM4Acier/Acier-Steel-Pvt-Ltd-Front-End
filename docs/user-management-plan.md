# User Management — Shared Implementation Plan
## Admin BAPI + Clerk Webhook Sync

**Covers:** Backend (Express) + Frontend (Next.js)
**Single source of truth:** Schema, API contracts, roles, field mapping.
**Companion docs:** `backend-clerk-plan.md` · `frontend-migration-plan.md`

---

## Strict Agent Rules

```
1. Schema section is the contract. Backend and frontend must match it exactly.
   Any change to schema requires updating BOTH implementation sections and
   the status table before any code changes.
2. ONE file per step. Never implement two files simultaneously.
3. Backend webhook route must register BEFORE express.json() middleware
   in index.ts. Raw body is required for svix verification — express.json()
   would parse it first and break signature verification.
4. BAPI calls happen BEFORE MongoDB writes in admin routes.
   If Clerk call fails, MongoDB is not written. If MongoDB fails after
   a Clerk write, log the inconsistency — do not silently continue.
5. Webhook upsert is idempotent. Admin BAPI route and webhook both write
   to MongoDB. The webhook fires after BAPI creates the user — the upsert
   must not create a duplicate or overwrite business fields (department,
   contactNo) with empty strings.
6. SELF-REVIEW after every step — report any inconsistency between
   the implemented file and the schema section of this document.
```

---

## Shared Schema — Single Source of Truth

### MongoDB `users` collection document

```ts
interface IUser {
  _id:          ObjectId;
  clerkId:      string;       // Clerk user ID — primary link. Unique + indexed.
  email:        string;       // from Clerk. Updated by webhook on user.updated.
  name:         string;       // from Clerk. Updated by webhook on user.updated.
  role:         UserRole;     // set by admin via BAPI + stored here. Source for attachUser.
  department:   string;       // business field — set by admin, NOT synced from Clerk.
  contactNo:    string;       // business field — set by admin, NOT synced from Clerk.
  organization: string;       // business field — set by admin, NOT synced from Clerk.
  createdAt:    Date;
  updatedAt:    Date;
}
```

### Role enum

```ts
type UserRole = 'super-admin' | 'admin' | 'manager' | 'sales';
```

> Confirm this list is complete before implementation begins.
> `super-admin` observed in `leads.routes.ts` (all-records access).
> If additional roles exist, add them here first.

---

### Field ownership — who writes what

| Field | Set by | Synced from Clerk? | Clerk field |
|---|---|---|---|
| `clerkId` | Clerk (on create) | Yes — webhook | `event.data.id` |
| `email` | Clerk (on create/update) | Yes — webhook | `email_addresses[0]` |
| `name` | Clerk (on create/update) | Yes — webhook | `first_name + last_name` |
| `role` | Admin via BAPI endpoint | **No** — set via `publicMetadata`, mirrored to MongoDB | `public_metadata.role` |
| `department` | Admin via `PATCH /api/admin/users/:clerkId` | No | — |
| `contactNo` | Admin via `PATCH /api/admin/users/:clerkId` | No | — |
| `organization` | Admin via `PATCH /api/admin/users/:clerkId` | No | — |

**Critical rule for webhook handler:**
`user.updated` webhook must NOT overwrite `department`, `contactNo`, or `organization`.
These are business fields owned by the backend — not Clerk fields.
Webhook only updates: `email`, `name`. Nothing else.

---

### API contracts

#### `POST /api/admin/users`
Create a user in Clerk + MongoDB. Super-admin only.

```ts
// Request body
{
  email:        string;   // required
  password:     string;   // required — temporary, user can reset via Clerk
  name:         string;   // required — split into firstName/lastName for Clerk
  role:         UserRole; // required
  department?:  string;
  contactNo?:   string;
  organization?:string;
}

// Response 201
{
  success: true;
  user: {
    clerkId:      string;
    email:        string;
    name:         string;
    role:         UserRole;
    department:   string;
    contactNo:    string;
    organization: string;
  };
}

// Response 400 — validation failure
{ success: false; error: string; }

// Response 409 — email already in Clerk
{ success: false; error: 'User with this email already exists'; }
```

#### `PATCH /api/admin/users/:clerkId/role`
Update role in Clerk `publicMetadata` + MongoDB. Super-admin only.

```ts
// Request body
{ role: UserRole; }

// Response 200
{ success: true; role: UserRole; }
```

#### `PATCH /api/admin/users/:clerkId`
Update business fields (department, contactNo, organization). Super-admin only.
Does NOT update Clerk — MongoDB only.

```ts
// Request body (all optional, at least one required)
{
  department?:  string;
  contactNo?:   string;
  organization?:string;
  name?:        string;  // updates Clerk + MongoDB
}

// Response 200
{ success: true; user: Partial<IUser>; }
```

#### `DELETE /api/admin/users/:clerkId`
Delete from Clerk + MongoDB. Super-admin only.

```ts
// Response 200
{ success: true; }
```

#### `GET /api/admin/users`
List all users. Super-admin + admin.

```ts
// Response 200
{
  success: true;
  users: {
    clerkId:      string;
    email:        string;
    name:         string;
    role:         UserRole;
    department:   string;
    contactNo:    string;
    organization: string;
    createdAt:    string; // ISO 8601
  }[];
}
```

#### `POST /webhooks/clerk`
Internal — called by Clerk only. Not called by frontend.

```ts
// Clerk sends: user.created | user.updated | user.deleted
// Response 200 always (even on unknown event types)
{ received: true; }
// Response 400 — invalid svix signature
{ success: false; error: 'Invalid signature'; }
```

---

## Backend Implementation

### Step B1 — `src/routes/webhooks/clerk.ts`

**Rules:**
- Use `express.raw({ type: 'application/json' })` — NOT `express.json()`.
- Verify svix signature before any logic: `new Webhook(CLERK_WEBHOOK_SECRET).verify(body, headers)`.
- `user.created`:
  - `findOneAndUpdate({ clerkId }, doc, { upsert: true, new: true })`.
  - Only set: `clerkId`, `email`, `name`. Role defaults to `'sales'`.
  - Do NOT set `department`, `contactNo`, `organization` (empty string would overwrite
    values set by admin if webhook fires after admin update — use `$setOnInsert` for
    fields that should only be set on insert, never on update).
  - After upsert: `userCache.invalidate(clerkId)`.
- `user.updated`:
  - `findOneAndUpdate({ clerkId }, { email, name })` — email + name ONLY.
  - Do NOT touch role, department, contactNo, organization.
  - After update: `userCache.invalidate(clerkId)`.
- `user.deleted`:
  - `findOneAndDelete({ clerkId })`.
  - After delete: `userCache.invalidate(clerkId)`.
- Unknown event type → `res.json({ received: true })` — no error.
- Register in `index.ts` BEFORE `app.use(express.json())`.

**`$setOnInsert` pattern for created event:**
```ts
await User.findOneAndUpdate(
  { clerkId },
  {
    $set:         { email, name },         // always update
    $setOnInsert: { role: 'sales',         // only set if creating new doc
                    department: '',
                    contactNo: '',
                    organization: '' },
  },
  { upsert: true, new: true }
);
```

**Self-review:**
- [ ] `express.raw()` on this route only — NOT global.
- [ ] Svix verify before any DB write.
- [ ] `$setOnInsert` used for business fields — not `$set`.
- [ ] `userCache.invalidate()` called after every mutation.
- [ ] Route registered before `express.json()` in index.ts — verify order.

**Verify:**
- Trigger `user.created` from Clerk Dashboard → MongoDB document created with
  `role: 'sales'`, empty business fields.
- Manually set `department: 'engineering'` in MongoDB.
- Trigger `user.updated` from Clerk Dashboard → `department` unchanged.
- Trigger `user.deleted` → document removed from MongoDB.
- Send request with invalid signature → 400.

---

### Step B2 — `src/routes/admin/users.ts`

**Rules:**
- All routes: `requireAuth + attachUser + casbinEnforce('users', 'admin-config')`.
- Self-action guard on all mutating routes: `req.params.clerkId !== req.user!.userId`.
  Return 403 if user tries to modify their own account.
- `POST /api/admin/users`:
  1. Validate all required fields — return 400 if missing.
  2. Validate `role` is one of `UserRole` values.
  3. Split `name` into `firstName`/`lastName` for Clerk create call.
  4. `clerkClient.users.createUser({ emailAddress: [email], password, firstName, lastName, publicMetadata: { role } })`.
  5. On Clerk error → return error to frontend, do NOT write MongoDB.
  6. `UserModel.create({ clerkId: clerkUser.id, email, name, role, department, contactNo, organization })`.
  7. On MongoDB error → log Clerk/MongoDB inconsistency, return 500.
  8. `userCache.invalidate(clerkUser.id)` (no-op for new user, safe to call).
  9. Return 201 with user shape from contract above.
- `PATCH /api/admin/users/:clerkId/role`:
  1. Validate role value.
  2. `clerkClient.users.updateUser(clerkId, { publicMetadata: { role: newRole } })`.
  3. `UserModel.findOneAndUpdate({ clerkId }, { role: newRole })`.
  4. `userCache.invalidate(clerkId)`.
  5. Return 200 `{ success: true, role: newRole }`.
- `PATCH /api/admin/users/:clerkId`:
  - Build update object from only allowed fields: `department`, `contactNo`, `organization`.
  - If `name` in body: also call `clerkClient.users.updateUser(clerkId, { firstName, lastName })`.
  - MongoDB update only for business fields.
  - `userCache.invalidate(clerkId)`.
- `DELETE /api/admin/users/:clerkId`:
  1. `clerkClient.users.deleteUser(clerkId)`.
  2. `UserModel.findOneAndDelete({ clerkId })`.
  3. `userCache.invalidate(clerkId)`.
- `GET /api/admin/users`:
  - `UserModel.find({}).sort({ createdAt: -1 })`.
  - Return array mapped to contract shape (exclude `_id`, `__v`, `password` if still present).

**Self-review:**
- [ ] BAPI call before MongoDB write on all mutating routes.
- [ ] Self-action guard on POST, PATCH, DELETE.
- [ ] Role validated against `UserRole` type before any BAPI call.
- [ ] `name` split correctly into firstName/lastName for Clerk.
- [ ] `userCache.invalidate()` on every mutation.
- [ ] GET response excludes `_id`, `__v`, any sensitive fields.

**Verify:**
- Create user → appears in Clerk Dashboard → `publicMetadata.role` set correctly.
- Create user → MongoDB document exists with correct fields.
- Create user → Clerk webhook fires → upsert is idempotent (no duplicate, no field overwrite).
- Update role → Clerk `publicMetadata.role` updated → MongoDB `role` updated → cache busted.
- Delete user → gone from Clerk + MongoDB.
- Self-delete attempt → 403.
- Invalid role value → 400 before any BAPI call.

---

## Frontend Implementation

### Step F1 — `types/user.types.ts` (new or update)

**Rules:**
- `UserRole` type must match backend exactly — copy from schema section above.
- `IUser` interface must match MongoDB document shape from schema section above.
- `CreateUserPayload` and `UpdateUserRolePayload` must match API contracts above.
- This file is the frontend's single source of truth for user types.
- Replace any existing inline role string unions in `rbac.types.ts` with this type.

**Shape:**
```ts
export type UserRole = 'super-admin' | 'admin' | 'manager' | 'sales';

export interface IUser {
  clerkId:      string;
  email:        string;
  name:         string;
  role:         UserRole;
  department:   string;
  contactNo:    string;
  organization: string;
  createdAt:    string;
}

export interface CreateUserPayload {
  email:         string;
  password:      string;
  name:          string;
  role:          UserRole;
  department?:   string;
  contactNo?:    string;
  organization?: string;
}

export interface UpdateUserRolePayload {
  role: UserRole;
}
```

**Verify:**
- Import `UserRole` in a route file — TypeScript shows the correct union.
- Any existing code using `role === 'super-admin'` still compiles.

---

### Step F2 — `lib/api/users.ts` (new)

**Rules:**
- All functions use `apiClient` (axios instance with Clerk interceptor).
- Return typed responses — not `any`.
- One function per API endpoint.
- No UI logic, no toast calls — callers handle errors.

**Functions:**
```ts
getUsers():                               Promise<IUser[]>
createUser(payload: CreateUserPayload):   Promise<IUser>
updateUserRole(clerkId, role):            Promise<{ role: UserRole }>
updateUserFields(clerkId, fields):        Promise<Partial<IUser>>
deleteUser(clerkId):                      Promise<void>
```

**Verify:**
- `createUser` call with valid payload → returns `IUser`.
- TypeScript error if payload is missing required field.

---

### Step F3 — `app/users/` page wiring

**Rules:**
- Use `usePermissions('users')` for field/section visibility.
- Call `lib/api/users.ts` functions — never call `apiClient` directly from the page.
- On create success → invalidate SWR cache for user list.
- On role update success → no page-level action needed (backend busts server cache,
  affected user gets `roleChanged` banner on next permissions refresh).
- Self-action guard on frontend too: hide edit/delete controls for own account.

**Verify:**
- Create user form submits → user appears in list.
- Role dropdown updates → correct role in list after refresh.
- Own account row has no edit/delete controls visible.

---

## Status Table

| Step | File | Owner | Status | Verified |
|---|---|---|---|---|
| B1 | `src/routes/webhooks/clerk.ts` | Backend | ⬜ Pending | ⬜ |
| B2 | `src/routes/admin/users.ts` | Backend | ⬜ Pending | ⬜ |
| F1 | `types/user.types.ts` | Frontend | ⬜ Pending | ⬜ |
| F2 | `lib/api/users.ts` | Frontend | ⬜ Pending | ⬜ |
| F3 | `app/users/` page wiring | Frontend | ⬜ Pending | ⬜ |

> B1 must be complete before B2 (webhook must handle the event that BAPI triggers).
> F1 must be complete before F2 and F3.
> B2 and F2 can proceed in parallel once B1 and F1 are done.
