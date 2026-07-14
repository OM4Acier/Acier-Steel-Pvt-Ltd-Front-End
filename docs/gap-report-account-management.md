# Gap Report — Account Management (Self-Service + Super-Admin Extras)
> Reviewed: 2026-06-16
> Doc: account-management-plan.md
> Total gaps: 16 | Blockers: 1 | High: 4 | Medium: 5 | Low: 6

---

## Summary

The spec correctly resolves the highest-risk decision (delegating password/session UI to Clerk's
vetted `<UserProfile />` component) and enforces a strict allowlist against privilege escalation
on the one custom write path it introduces. The one BLOCKER is a silent-data-loss risk in the new
webhook event handling — undefined success/failure return codes mean a transient DB error during
audit logging could permanently drop entries with Clerk never retrying. Most HIGH gaps cluster
around a single theme: this feature mixes two data sources (live Clerk state and cached MongoDB
state) on one page without defining which one wins when they disagree.

`skill-rules.md` (mobile permission/lifecycle patterns) has no directly applicable entries for
this web feature — it was consulted but yielded no cross-reference hits. `project-rules.md` for
this CRM project was empty prior to this review (freshly scaffolded); informal precedent from
`user-management-plan.md` (BAPI-before-MongoDB-write ordering, cache-invalidate-on-mutation) was
used as a comparison baseline where relevant, and is now being formalized into the rule file.

---

## Gap Index

| # | Feature | Gap Type | Severity | One-line summary |
|---|---|---|---|---|
| G-01 | Webhook session event handling | Error Handling | BLOCKER | Undefined 200-vs-500 response on audit-log insert failure — risks silent permanent data loss |
| G-02 | Account page data sourcing | Functional | HIGH | No defined winner between live Clerk `name` and cached MongoDB `name` on the same page |
| G-03 | `contactNo` validation | Functional | HIGH | Format/length/country-code rules referenced ("e.g., regex") but never actually defined |
| G-04 | `contactNo` self-edit form | Lifecycle | HIGH | Session expiry mid-edit (401 mid-submit) has no defined UI behavior |
| G-05 | Login audit log schema | Platform-Specific | HIGH | `ipAddress`/`userAgent` fields assumed present in Clerk's session webhook payload — unverified against current API |
| G-06 | Audit log visibility | Functional | HIGH | Empty `loginAudit` array is indistinguishable from "webhook never configured" — silent failure mode on a security feature |
| G-07 | `PATCH /api/account/me` | Error Handling | MEDIUM | MongoDB write succeeds, cache invalidation fails — partial-failure behavior undefined |
| G-08 | Debug info panel | UX / UI | MEDIUM | Rendering treatment unspecified — risk of raw JSON dump on a super-admin-facing page |
| G-09 | `contactNo` concurrent edits | Lifecycle | MEDIUM | Multi-tab simultaneous edit has an implicit last-write-wins default, never stated as a decision |
| G-10 | Secret-leak prevention | Error Handling | MEDIUM | Only enforcement is a manual grep in a checklist — no automated test prevents future regression |
| G-11 | `GET /api/account/me` caching | State Management | MEDIUM | No caching decision stated — inconsistent with the project's established cache-on-read pattern |
| G-12 | `contactNo` success feedback | UX / UI | LOW | "Toast on success" only appears in the task list, not in Acceptance Criteria — spec inconsistency |
| G-13 | Missing `adminExtras` rendering | UX / UI | LOW | No stated treatment for non-super-admin users — safe default is obvious but unstated |
| G-14 | Avatar upload constraints | UX / UI | LOW | Size/format limits not confirmed as fully delegated to Clerk vs needing custom validation |
| G-15 | `contactNo` client-side state | State Management | LOW | Storage location (local state vs store vs SWR cache) unspecified |
| G-16 | `<UserProfile />` SSR exclusion | Platform-Specific | LOW | Unclear if `next/dynamic({ ssr:false })` is needed given static export already disables SSR globally |

---

## Detailed Gaps

### G-01 · Webhook session event handling · Error Handling · BLOCKER

**What the spec defines:**
"Add handling for two new event types... insert login_audit_log entry." The existing handler
pattern (from `user-management-plan.md`) returns `{ received: true }` with 200 even for unknown
event types, to avoid Clerk retry storms.

**What is missing:**
The spec never states what HTTP status the handler returns if the MongoDB insert for a
`session.created`/`session.ended` event throws (e.g., transient connection blip, validation error).
If the handler still returns 200 in that case, Clerk considers the webhook delivered successfully
and will never retry — that audit entry is gone permanently with no error surfaced anywhere.

**Why it matters:**
This is a defined audit/security feature. Silent, permanent loss of audit entries undermines the
entire purpose of building it — and the failure mode is invisible until someone needs the data
during an actual investigation and finds gaps.

**Clarification question:**
> Should a DB insert failure on a known session event return 500 (triggering Clerk's webhook
> retry) instead of the generic 200 used for unknown event types, and should that failure also
> fire an alert/log at error level distinct from normal operation?

**Common pattern:**
Standard webhook-consumer practice: return 2xx only when the event was durably processed; return
5xx on any failure for a recognized event type so the sender's retry mechanism (which Clerk
provides natively) can recover the delivery. Returning 200 unconditionally is only safe for
genuinely unknown/irrelevant event types, not for ones the handler is actively trying to act on.

---

### G-02 · Account page data sourcing · Functional · HIGH

**What the spec defines:**
The account page embeds Clerk's `<UserProfile />` (which reads/writes `name` live from Clerk) and
separately calls `GET /api/account/me` (which returns `name` from MongoDB, synced via webhook with
inherent delivery lag).

**What is missing:**
No statement of which value is authoritative for display if a user just changed their name via
the embedded widget and the page (or another part of the app reading the MongoDB-sourced profile)
hasn't yet received the webhook update. Two different "name" values could be visible simultaneously
on the same page during that window.

**Why it matters:**
A user changing their name and immediately seeing the OLD name elsewhere on the same page reads as
a bug, not as expected eventual-consistency behavior — and erodes trust in the feature.

**Clarification question:**
> Should every place on the account page that displays `name` read from Clerk's live `useUser()`
> object instead of the `GET /api/account/me` MongoDB-sourced value, treating MongoDB's copy as
> "for other backend services only," never for this page's own rendering?

**Common pattern:**
When a page embeds a third-party identity widget alongside server-cached data, the live SDK value
is normally treated as authoritative for anything that widget itself can edit, while the cached
backend copy is reserved for fields the widget doesn't own (here: `contactNo`, `role`, audit data).

---

### G-03 · `contactNo` validation · Functional · HIGH

**What the spec defines:**
"Validate `contactNo` format (e.g., regex for phone)." in the implementation notes.

**What is missing:**
No actual format is specified — digits only? E.164 international format with `+`? Minimum/maximum
length? Is a country code mandatory? The placeholder "(e.g., regex...)" was never resolved into
an actual rule.

**Why it matters:**
Without a defined format, frontend and backend validation could diverge (frontend accepts a format
the backend regex rejects, or vice versa), producing confusing 400 errors for legitimate input.

**Clarification question:**
> Should `contactNo` require E.164 format (e.g., `+919876543210`) enforced identically on both
> client and server, or a looser free-text field with only a minimum-length check?

**Common pattern:**
E.164 (`+[country code][number]`, no spaces/dashes) is the standard normalized format for phone
fields that may need to interoperate with SMS/calling APIs later — validated with one shared regex
constant imported by both frontend and backend to guarantee they never drift apart.

---

### G-04 · `contactNo` self-edit form · Lifecycle · HIGH

**What the spec defines:**
FE-6: "Add loading/error states for the contactNo form (toast on success, inline error on
validation failure)."

**What is missing:**
"Validation failure" (400) is covered. A 401 mid-submission — because the Clerk session expired
or was revoked while the user was filling out the form — is a distinct failure mode with no
defined UI behavior. Does the form show a generic error, silently fail, or redirect to login?

**Why it matters:**
Without a defined path, the most likely outcome by default is a confusing "inline error" message
that looks like a validation problem with the phone number, when the real issue is the user's
session expired — actively misleading.

**Clarification question:**
> On a 401 response from `PATCH /api/account/me`, should the form trigger the same
> `auth:expired` global event already used elsewhere in the app (redirecting to login), rather
> than displaying it as a field-level validation error?

**Common pattern:**
Auth-expiry failures are typically handled globally (a shared axios interceptor pattern, which
this project already has) rather than locally per-form, so every form gets consistent behavior
without each one needing its own 401 branch.

---

### G-05 · Login audit log schema · Platform-Specific · HIGH

**What the spec defines:**
```ts
interface ILoginAuditEntry {
  ...
  userAgent?: string;
  ipAddress?: string;
}
```
Sourced from the `session.created`/`session.ended` webhook payload.

**What is missing:**
Whether Clerk's session webhook payload actually includes `ip_address` and `user_agent` fields by
default was never verified against current Clerk documentation. If it doesn't, these two fields
will always be `undefined`, and the audit log silently degrades to timestamps + session IDs only —
a materially smaller feature than what the schema implies.

**Why it matters:**
This affects what the super-admin extras section can actually show. If IP/user-agent are not
available from the webhook payload, the UI design and acceptance criteria built around "see who
logged in from where" need to be revised before implementation, not discovered during it.

**Clarification question:**
> Has the `session.created` webhook payload structure been confirmed (via Clerk's current API
> reference) to include IP address and user agent, or does this require an additional API call
> (e.g., `clerkClient.sessions.getSession()`) to enrich the webhook event?

**Common pattern:**
Webhook payloads from identity providers often include only IDs and timestamps for privacy/size
reasons, with richer details (IP, device info) requiring a follow-up API call using the ID from
the webhook event — this needs to be confirmed before the schema and acceptance criteria are final.

---

### G-06 · Audit log visibility · Functional · HIGH

**What the spec defines:**
`adminExtras.loginAudit` — "last 20, paginated" — populated by the webhook handler from G-01/G-05.

**What is missing:**
No defined way for a super-admin to distinguish "this user has genuinely had no login activity
in the retention window" from "the webhook subscription was never configured" (BE-5 is a manual
Dashboard step that could simply be forgotten) from "entries were silently dropped" (G-01). All
three produce an identical empty array with no UI signal differentiating them.

**Why it matters:**
On a feature whose entire purpose is security/audit visibility, an empty state that could mean
three very different things (including "this feature is silently broken") undermines the trust
a super-admin needs to place in the data when it matters most — during an investigation.

**Clarification question:**
> Should the backend track and expose a "webhook last received at" timestamp (project-wide, not
> per-user) so the UI can show "no activity" only when the underlying sync mechanism is confirmed
> healthy, rather than always showing a bare empty list?

**Common pattern:**
Audit/observability features commonly expose a system health indicator alongside the data itself
(e.g., "last synced: 2 minutes ago") specifically so an empty result can be trusted rather than
mistaken for a broken pipeline.

---

### G-07 · `PATCH /api/account/me` · Error Handling · MEDIUM

**What the spec defines:**
Implementation steps: MongoDB update, then `userCache.invalidate(clerkId)`, in that order.

**What is missing:**
If the MongoDB write succeeds but the subsequent cache invalidation call throws (cache module
error, not expected but not impossible), the spec doesn't define whether the request still
returns 200 to the client (data is correct in MongoDB, but a stale cached copy may now be served
by `attachUser` until the cache's own TTL/next invalidation) or whether this is treated as a
failure requiring retry.

**Why it matters:**
Same failure-ordering class of bug this project has explicitly cared about elsewhere
(BAPI-before-MongoDB-write sequencing in the admin user-management plan) — worth the same level
of explicit attention here for consistency, even though impact here is lower (a stale cache read,
not a security-relevant inconsistency).

**Clarification question:**
> Should cache invalidation failure be caught and logged without failing the request (MongoDB is
> the source of truth and is already correct), accepting a brief stale-cache window, consistent
> with how this project already treats similar ordering elsewhere?

**Common pattern:**
When a write succeeds against the source of truth but a downstream cache-bust step fails, the
request is normally still reported as successful — the cache's own staleness window is the
acceptable cost, logged for visibility but not blocking the user-facing response.

---

### G-08 · Debug info panel · UX / UI · MEDIUM

**What the spec defines:**
`adminExtras.debug` containing `sessionClaims`, `permissionCacheEntry`, `casbinEnforceMode` —
no rendering treatment specified beyond "displayed."

**What is missing:**
Whether this is rendered as formatted key-value rows, a syntax-highlighted JSON viewer, or (the
risky default if no one specifies otherwise) a raw `{JSON.stringify(debug)}` dump directly in JSX.

**Why it matters:**
A raw object dump is a common shortcut that's easy to ship by accident on an internal-only debug
panel, and is harder to scan for an actual investigation than even minimally formatted output.

**Clarification question:**
> Should the debug panel render as labeled key-value pairs (claim name → value) rather than a
> single raw JSON blob, to make it actually scannable during an investigation?

**Common pattern:**
Internal debug/diagnostic panels are conventionally rendered as a simple labeled table rather than
a raw object dump, even when the audience is technical — scannability matters more than fidelity
to the underlying data structure.

---

### G-09 · `contactNo` concurrent edits · Lifecycle · MEDIUM

**What the spec defines:**
The Open Items section already self-flags: "Concurrent edit behavior... is not defined."

**What is missing:**
A stated decision. `findOneAndUpdate` gives an implicit last-write-wins default — that may be
entirely acceptable for a single low-stakes field like a phone number, but it should be a stated
choice, not a silent byproduct of not thinking about it.

**Why it matters:**
Low actual risk (a phone number overwrite is recoverable and low-stakes), but worth a one-line
explicit decision so it isn't revisited as a "bug" later.

**Clarification question:**
> Is last-write-wins (no optimistic locking, no conflict warning) acceptable for `contactNo`
> specifically, given its low stakes compared to fields like `role`?

**Common pattern:**
Low-stakes, single-owner fields typically accept last-write-wins without additional concurrency
control; optimistic locking is reserved for fields where a silent overwrite would cause real harm.

---

### G-10 · Secret-leak prevention · Error Handling · MEDIUM

**What the spec defines:**
Self-Review Checklist: "Debug endpoint output contains no secrets — manually grep the response..."

**What is missing:**
This is a one-time manual check at implementation time, not an automated guardrail. A future
change (e.g., someone later adds the full `req.user` MongoDB document to the debug payload instead
of a curated subset, accidentally including an internal field) would not be caught by CI.

**Why it matters:**
Manual checklist items are reliably followed once and then forgotten on the next change to the
same code path — exactly the kind of regression automated tests exist to prevent.

**Clarification question:**
> Should a unit test assert that the debug response object never contains keys matching a
> denylist (`secretKey`, `password`, `mongoUri`, etc.), so this is enforced in CI rather than
> relying on a human remembering to grep before every future change?

**Common pattern:**
Security-sensitive response shapes are commonly locked down with a snapshot test or an explicit
denylist assertion, specifically because manual review steps degrade over time as new contributors
touch the same code without reading the original checklist.

---

### G-11 · `GET /api/account/me` caching · State Management · MEDIUM

**What the spec defines:**
No caching behavior stated for this endpoint — implicitly always queries MongoDB fresh
(`adminExtras.loginAudit` query, base profile read).

**What is missing:**
The rest of this project's permission/user data already follows an established
in-memory-cache-with-explicit-invalidation pattern (`userCache`, `permissionCache`). This endpoint
either should follow the same convention for consistency, or there should be a stated reason it
doesn't (e.g., "this is a low-traffic, single-user-at-a-time page, caching isn't worth the
complexity").

**Why it matters:**
Inconsistent caching strategy across similar endpoints in the same codebase makes the system
harder to reason about — a future engineer debugging staleness issues would reasonably assume
this endpoint behaves like every other one in the project.

**Clarification question:**
> Should `GET /api/account/me` reuse the existing `userCache` for the base profile fields (same
> cache already populated by `attachUser`), querying MongoDB fresh only for the super-admin
> `loginAudit` section which is explicitly time-sensitive?

**Common pattern:**
When one cache already exists for the same underlying document, new endpoints reading the same
data typically reuse it rather than introducing a second, parallel caching (or non-caching)
strategy for the same entity.

---

### G-12 · `contactNo` success feedback · UX / UI · LOW

**What the spec defines:**
Acceptance Criteria #3 describes the update mechanically (400 on bad payload) but doesn't mention
success feedback. FE-6 (task list) separately mentions "toast on success."

**What is missing:**
The Acceptance Criteria — the section meant to define "done" — doesn't actually require the
success toast that the task list assumes will be built. Minor internal inconsistency.

**Why it matters:**
Low impact, but Acceptance Criteria should be the complete contract; relying on a task-list mention
to capture a real requirement means it could be quietly dropped without violating any stated
acceptance criterion.

**Clarification question:**
> Should Acceptance Criteria be amended to explicitly state "a successful contactNo update shows
> a confirmation toast," matching what FE-6 already assumes?

**Common pattern:**
N/A — straightforward documentation completeness fix.

---

### G-13 · Missing `adminExtras` rendering · UX / UI · LOW

**What the spec defines:**
FE-4: "renders only when `usePermissionStore(s => s.role) === 'super-admin'`."

**What is missing:**
No explicit statement that the component should render nothing at all (vs. a "you don't have
access" placeholder) for other roles. The obvious safe default is "render nothing," but it's
implicit rather than stated.

**Why it matters:**
Low impact — the safe default is essentially the only reasonable choice here, but stating it
removes any ambiguity for whoever implements FE-4.

**Clarification question:**
> Confirm: for non-super-admin roles, `SuperAdminExtras` renders `null` entirely — no placeholder,
> no "upgrade" messaging, nothing visible?

**Common pattern:**
N/A — straightforward confirmation of an already-obvious default.

---

### G-14 · Avatar upload constraints · UX / UI · LOW

**What the spec defines:**
D1/FE-2: avatar editing fully delegated to Clerk's `<UserProfile />`.

**What is missing:**
No explicit confirmation that Clerk's component handles all size/format validation and feedback
itself with zero wrapper code needed, versus some custom pre-upload check being expected.

**Why it matters:**
Low impact if (as expected) Clerk's component is fully self-contained here — this is a
confirmation gap, not a likely real problem.

**Clarification question:**
> Confirm: no custom file-size/format validation wrapper is needed around the embedded
> `<UserProfile />` avatar upload — Clerk's component handles this entirely on its own?

**Common pattern:**
N/A — confirmation of an assumption already stated as the design direction (D1).

---

### G-15 · `contactNo` client-side state · State Management · LOW

**What the spec defines:**
FE-3: "Build `ContactNumberForm` component — calls `PATCH /api/account/me`."

**What is missing:**
Where the fetched/updated `contactNo` value lives client-side after the call — local component
state, a new Zustand slice, or SWR's own cache — is unstated.

**Why it matters:**
Low impact currently since no other component is documented as needing to display `contactNo`
elsewhere in the app. Would become relevant only if that changes.

**Clarification question:**
> Is local component state (fetched on mount, updated on successful PATCH) sufficient, given no
> other part of the app currently needs to read this value?

**Common pattern:**
N/A — low-stakes implementation detail, local state is the simplest sufficient choice given the
single current consumer.

---

### G-16 · `<UserProfile />` SSR exclusion · Platform-Specific · LOW

**What the spec defines:**
FE-2: "client-side, dynamic import, no SSR."

**What is missing:**
Whether an explicit `next/dynamic(..., { ssr: false })` wrapper is actually necessary, given the
whole application already runs as a Next.js static export with SSR disabled globally — the
dynamic-import instruction may be redundant boilerplate carried over from a different (SSR-capable)
Next.js project pattern.

**Why it matters:**
Low impact — at worst, unnecessary code is written; at best, clarifying this saves a small amount
of implementation time.

**Clarification question:**
> Given static export already disables SSR app-wide, is a plain `'use client'` import of
> `<UserProfile />` sufficient, without an additional `next/dynamic` wrapper?

**Common pattern:**
N/A — project-architecture-specific confirmation.

---

## New Patterns Added to Rule Files

- [project] Webhook handlers for known event types should return 5xx on a downstream write
  failure (not the generic 200 used for unrecognized event types) so the sender's native retry
  mechanism can recover the delivery.
- [project] When a page embeds a third-party identity widget that can edit a field, that widget's
  live SDK state — not a backend-cached copy of the same field — is the authoritative display
  source for anything the widget itself owns.
- [project] New endpoints reading data already covered by an existing in-memory cache should reuse
  that cache rather than introducing a parallel caching (or non-caching) strategy for the same
  underlying entity.
- [project] Security-sensitive response shapes (e.g., debug/introspection endpoints) should be
  protected by an automated denylist/snapshot test, not a manual review-checklist step alone.
- [project] Audit/observability features should expose their own sync-health signal (e.g.,
  "last event received at") so an empty result set can be distinguished from a silently broken
  ingestion pipeline.

*(No `[skill]`-tagged patterns added — `skill-rules.md` is scoped to mobile app lifecycle/permission
patterns and had no applicable cross-reference for this web feature.)*
