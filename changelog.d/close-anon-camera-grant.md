## 2026-08-06 · security: anyone who knew an order number could mint paid camera credits

A code-side backlog sweep found one database function marked **EXPLOITABLE** in the 2026-08-01
security review — written down five days ago and never fixed. Verified in live production today
before writing anything.

### What was wrong

`papic_grant_camera_points(p_event_id, p_order_id)` was `SECURITY DEFINER` and **EXECUTE-able by
`anon`**. It checked nothing that constitutes authorisation:

- never read the order's **payment status** — an unpaid order granted;
- never checked **who was calling** — no identity, no membership;
- never checked the order **belongs to the event**. `p_event_id` came from the *caller* and was
  written straight into the grant row, so one wedding's order could mint points onto another.

Its only real guard was idempotency — one grant per order — which prevents a *second* grant, not an
unauthorised *first* one.

### The fix, in two layers

1. **REVOKE** from `PUBLIC`, `anon` and `authenticated`. The only legitimate caller is the admin
   activation hook (`lib/sku-activation.ts` → `ctx.admin.rpc`), which runs as `service_role` and
   **bypasses grants entirely** — so revoking costs that path nothing.
2. **The order must belong to the event**, checked inside the function. Defence in depth: this
   repo's documented default-ACL problem means a future migration can re-grant EXECUTE, and the
   hole would silently reopen with only layer 1.

Also closed: **`papic_reserve_camera_capture`**, flagged the same day for taking its quota ceiling
**from the caller** (`p_limit IS NULL` ⇒ unconditional TRUE). It has **zero live callers** —
`lib/papic-cameras.ts:731` records it as "then dropped" — so revoking cannot break anything.

### Two things I got wrong first, and checked

- I guessed the sibling's signature as 3 arguments. It is **4**. The replay failed loudly, which is
  the guard working.
- My first test asserted `papic_release_camera_points` and `papic_release_event_points` were
  anon-callable because they appear on the guest-capture route. **They are not** — that route
  reaches them as service_role. I would have shipped a false claim about our own surface. Both are
  now pinned as closed, so nobody re-opens them believing the guest path needs it.

`papic_record_guest_capture` (both overloads) **is** the anonymous guest path and is deliberately
untouched — a test names it so a future blanket revoke cannot silently stop every guest photo.

**Live blast radius today: zero.** Prod is pre-launch; no paid camera orders exist. This closes it
before that stops being true.

Anon-callable review register: **179 → 177**. Exposure baseline regenerated — both functions drop
out of the anon/authenticated surface. Typecheck 0 errors; 7/7 new tests, 42 across the papic and
security suites.

SPEC IMPACT: None — a security narrowing, no pricing, SKU or scope change.
