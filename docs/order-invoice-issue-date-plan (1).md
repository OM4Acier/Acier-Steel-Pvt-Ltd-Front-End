# Feature Plan: Invoice Issue Date on Order

## Context
Add a new field capturing the date an invoice is issued for an order. Captured only when the order transitions from `Dispatched and Invoiced` → `Completed`. Existing orders in DB have no data for this field; no forced backfill migration. Frontend's date-grouping utility switches from `updatedAt` to this new field.

---

## Acceptance Criteria

- [ ] `Order.details.invoiceIssueDate` exists in the Mongoose schema as a native `Date`, nullable, no default.
- [ ] Field is **not** accepted or required on `CreateOrderDTO`.
- [ ] Field is accepted on `UpdateOrderDTO.details.invoiceIssueDate`.
- [ ] Service-layer validation: when `status` is being set to `COMPLETED`, request must supply `invoiceIssueDate` (either in the same update payload or already present on the document) — reject with `400` otherwise.
- [ ] Existing documents without the field continue to read/update successfully (`invoiceIssueDate` resolves to `null`).
- [ ] API response (`OrderResponse`) surfaces `invoiceIssueDate` under `order.details`.
- [ ] `editHistory` entry auto-appended when `invoiceIssueDate` is set/changed (consistent with `updateStatus` pattern).
- [ ] `app/orders/orderUtils.ts` → `groupOrdersByDate` reads `order.details.invoiceIssueDate` instead of `order.updatedAt` for both grouping key and within-group sort.
- [ ] No breaking change to any other existing endpoint contract.

---

## Multi-Agent Structure

| Agent | Role | Experience | Responsibility |
|---|---|---|---|
| Architect | Schema & API contract design | Mongoose/TypeScript data modeling, DTO versioning | Owns field type, conditional-required placement, `orderUtils` behavioral trade-off |
| Backend Engineer | Express/Mongoose implementation | Node.js + Express + Mongoose, REST APIs | Schema change, DTO updates, service-layer validation, editHistory hook |
| Frontend Engineer | React/Next.js implementation | TypeScript, order list/grouping UI | Updates `orderUtils.ts`, verifies grouped views render correctly for orders with `null` value |

---

## Why This Approach (ADR-lite)

**Decision: `Date` type, not `String`.**
Matches `createdAt`/`updatedAt`/`ttl`, which are already `Date` — supports range queries and sorting without string-parsing. Frontend already formats `Date`-typed fields elsewhere (see `orderUtils.ts` itself, which parses `updatedAt`).

**Decision: conditional-required at service layer, not schema level.**
"Required only when transitioning to `COMPLETED`" isn't cleanly expressible as a declarative Mongoose `required`. Enforcing it where `updateStatus`'s transition logic already lives keeps the rule testable in isolation and co-located with the workflow it protects.

**Decision: no backfill migration.**
Historical orders simply have `invoiceIssueDate: null`.

**Trade-off called out — `orderUtils.ts` swap to `invoiceIssueDate`:**
`groupOrdersByDate` currently groups *every* order (any status) by `updatedAt`. Switching to `invoiceIssueDate` means any order not yet `Completed` has `invoiceIssueDate: null` and will be **silently excluded** from the grouped output (the existing `if (!order.X) return;` guard drops it) — same as today's guard, just against a field that's `null` far more often now. If this utility feeds a view that's meant to show orders of *any* status, this is a behavior change, not just a rename. Confirm this function is only ever fed `COMPLETED` orders (or that excluding non-completed orders from the grouped view is intended) before merging — flagged as an **open question** below rather than assumed.

---

## Backend Changes

**Schema / Types (`models/Order.ts`)**
```
IOrder.details.invoiceIssueDate: Date | null
UpdateOrderDTO.details.invoiceIssueDate?: Date | string   // accept ISO string in, store as Date
// NOT added to CreateOrderDTO
```

**Service-layer validation** (wherever the `PATCH /orders/:id` / `updateStatus` transition logic lives):
1. If incoming `status === COMPLETED`:
   - Resolve effective `invoiceIssueDate` = incoming payload value **or** existing document value.
   - If neither exists → reject `400` (`"invoiceIssueDate is required before marking order Completed"`).
2. If `invoiceIssueDate` present in payload and differs from stored value → append `editHistory` entry (`"Invoice issue date set to {date}"`).

**Backend atomic tasks (Backlog)**
- [ ] Add `invoiceIssueDate: Date` to `IOrder.details` interface + `OrderSchema.details`.
- [ ] Add `invoiceIssueDate` to `UpdateOrderDTO.details`.
- [ ] Add conditional-required check for `COMPLETED` transition in the update service/controller.
- [ ] Add `editHistory` append logic for `invoiceIssueDate` changes.
- [ ] Confirm order-detail response mapper/serializer includes the field.

---

## Frontend Changes

**File: `app/orders/orderUtils.ts`**

Current behavior groups/sorts by `order.updatedAt`. New behavior groups/sorts by `order.details.invoiceIssueDate`.

Implementation notes (no code written yet — approach only):
- Replace both occurrences of `order.updatedAt` (the guard check and the value passed to `new Date(...)`) with `order.details.invoiceIssueDate`, and the sort comparator's `a.updatedAt!` / `b.updatedAt!` similarly.
- The `Order` type used in this file must include `details.invoiceIssueDate` (flows from the backend `IOrder` type / whatever local frontend type mirrors it) — check whether the frontend has its own duplicated `Order` interface or imports the backend type; update whichever is the source of truth.
- Because the guard (`if (!order.details.invoiceIssueDate) return;`) will now drop any non-`Completed` order, verify the caller of `groupOrdersByDate` only passes `Completed` orders. If it currently passes a mixed list, this is where you'd decide: filter to `Completed` before calling, or keep the function generic and accept that non-`Completed` orders won't appear grouped.

**Frontend atomic tasks (Backlog)**
- [ ] Update `groupOrdersByDate` field references (guard, group-key date, sort comparator).
- [ ] Update/confirm the `Order` type used in this file includes `details.invoiceIssueDate`.
- [ ] Audit callers of `groupOrdersByDate` — confirm input list composition matches the new null-drop behavior, or add a pre-filter.
- [ ] Manually verify a `Completed` order (with `invoiceIssueDate` set) still groups/sorts correctly; verify non-`Completed` orders no longer appear in this grouped view (confirm that's intended).

---

## Security & Validation (Shift-Left)

- **Input validation**: `invoiceIssueDate` from client validated as a parseable ISO date server-side before `new Date()` cast — reject malformed strings with `400`.
- **Auth**: reuse existing order-update auth/permission gate (see Open Question on role restriction).
- **OWASP relevance**: none beyond standard input validation — typed Mongoose field, no raw query construction.
- **No secrets involved.**

---

## Self-Review Checklist

- [ ] Lint: existing ESLint/TS config passes on modified backend + frontend files.
- [ ] Static analysis: `tsc --noEmit` on both backend (`IOrder`/DTO) and frontend (`orderUtils.ts` + its `Order` type) confirms no broken consumers.
- [ ] Pre-commit: existing hook runs lint + type-check on staged files — no new hook needed.
- [ ] Test coverage: 100% of the new conditional-required branch (backend) + the updated grouping/sort logic (frontend) covered by tests below.

---

## Testing Strategy

**Backend — Unit**
- Schema accepts valid `Date` / rejects malformed date input.
- Service validator: rejects transition to `COMPLETED` when `invoiceIssueDate` absent (payload and document both empty).
- Service validator: accepts transition when `invoiceIssueDate` supplied in payload OR already on document.
- `editHistory` entry created only when the value actually changes.

**Backend — Integration**
- `PATCH /orders/:id`: attempt status → `Completed` without `invoiceIssueDate` → expect `400`.
- Same, with `invoiceIssueDate` supplied → expect `200`, persisted, `editHistory` updated.
- Fetch a pre-existing order → confirm `invoiceIssueDate: null` returned without error.

**Frontend — Unit**
- `groupOrdersByDate`: orders with `invoiceIssueDate` set group under the correct day/month/year key.
- `groupOrdersByDate`: orders with `invoiceIssueDate: null` are excluded (assert this is the intended/tested behavior, not an accidental gap).
- Within-group sort: descending by `invoiceIssueDate`, matches prior `updatedAt`-based ordering behavior for parity.

---

## Feedback Loop / Verification

- **Logs**: warning-level log whenever the conditional-required check rejects a `Completed` transition (surfaces UI flows not sending the date).
- **Manual/health check post-deploy**: fetch one existing order via API → confirm `details.invoiceIssueDate` present as `null` (not missing key). Fetch the orders view using `orderUtils.ts` → confirm grouping still renders without runtime errors for orders with `null` value.
- **Metric (optional, future)**: count of orders reaching `Completed` without ever passing through this validation path (would indicate a bypass).

---

## Open Questions (need your input before implementation)

1. **`orderUtils.ts` input composition**: does the caller of `groupOrdersByDate` pass all orders or only `Completed` ones today? This determines whether the null-drop side effect is a no-op or a real behavior change.
2. **Role restriction**: should only certain roles be allowed to set `invoiceIssueDate` / transition to `Completed`, or any role that can already update order status?
3. **Timezone**: store as UTC midnight of the IST calendar date (consistent with the IST-week logic in the performance-monitoring module), or the raw UTC timestamp of when it was recorded?

---

**Should I write the code for this once the open questions above are resolved?**
