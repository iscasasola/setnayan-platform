## 2026-08-04 · feat(admin): verify a shop and co-sign a colleague, from the list

Steps 1 and 2 of finishing act-from-the-list. Payments could already be confirmed in place; **Verify** and **Approvals** now can too.

### Verify — reuses the decision engine, never a status write

This stamps **the badge couples trust**, so it calls the same `applyApplicationDecision` the verify page calls. That engine also sets `verified`, `last_verified_at` and moves the documents — a hand-written status UPDATE here would set the flag and silently skip the rest.

`approveApplication` (the page's action) redirects on success; this calls the engine directly and revalidates, so the admin stays on the list. **One engine, two entry points.**

🔑 **The button only appears when the documents are actually in.** An application still waiting on uploads is not a fact yet, so it gets the page instead — the same fact-versus-judgement test, applied one level down *inside* a single queue.

### Approvals — the button says "I agree"

Never "Approve". This is the **second signature** on a decision a colleague already made; the admin is agreeing to their call, not making one. A button reading "Approve" invites it being read as the whole decision — exactly what a two-admin gate exists to prevent.

It delegates straight to the page's own `approveRequest`, which does **not** redirect, so there was no core to extract. Its claim-then-decide guard already handles two admins racing.

### One table instead of three branches

The drawer now maps `kind → { server action, hidden field }`, so a fourth fact queue is a row in that table rather than another branch in the markup.

### The typechecker caught a real mismatch

The verify module carries its **own** `AdminUser = { user_id }` while the shared `requireAdmin()` returns `{ userId }`. Two names for one thing — caught before a `user_id: undefined` could reach an audit column.

Verified: unit suite **6,529 pass / 4 fail** — the same four pre-existing `@electric-sql/pglite` module failures on unmodified `origin/main` · lint clean · zero typecheck errors in the changed files.

⏭ Steps 3–5: reviews (publish/hide), the payouts form (method + reference), then the visual pass.

SPEC IMPACT: None — existing decisions gain a second, non-redirecting entry point.
