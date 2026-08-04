## 2026-07-25 · feat(admin): paste DB-stored secrets directly on the Secrets & Rotation board

The owner rule: **any key, any secret → `/admin/secrets`, always.** No more "which
page owns this key?".

The eight `db-paste` rows on the board (Resend · OpenAI · Meta Page token ·
YouTube · Google Drive · TikTok client · TikTok publish · Maya pair) used to only
deep-link to `/admin/integrations` — the board could tell you a key was overdue
but not let you replace it. They now carry the same write-only paste box the
Vercel-env rows have, plus a confirmed "Remove saved key".

- **One write layer, not two.** The encrypt → upsert → stamp-the-rotation-clock
  body moved out of `app/admin/integrations/actions.ts` into
  `lib/integrations/write.ts` (`writeIntegrationSecretColumns` /
  `clearIntegrationSecretColumns`). Both the console cards and the board's new
  `updateDbSecret` / `clearDbSecret` actions call it, so there is exactly one
  AES-256-GCM + `platform_integration_secrets` implementation and one rotation
  path. No new crypto, no new DB path, no new allowlist.
- **Partial saves are correct here.** Only the boxes the owner filled in are
  named in the patch: the Secrets row saves the Resend API KEY and never touches
  `resend_from_address`; Maya's public + secret keys are independent columns, so
  replacing one leaves the other exactly as it was. A blank box always means
  "keep what's there".
- **No redeploy nudge on these rows** — a DB-stored secret is live on the very
  next request. That prompt stays Vercel-only.
- **Copy pass** on every `db-paste` row's steps: they now say "paste it in the
  box below", never "paste it on the Integrations console". Provider URLs and
  impact lines are unchanged.
- Each row keeps a compact **"Advanced settings →"** link to its console card for
  what deliberately stays there: non-secret config (redirect URIs, Page/IG ids,
  the Maya checkout endpoint), the Setnayan-AI paywall tri-states, and Resend's
  Verify/test-send button. The console remains the feature-setup surface; the
  board stays a rotation dashboard.
- The console's four save actions now surface a failed key write instead of
  redirecting to "Saved." with nothing stored: the shared writer returns a status
  code (it can't throw, or a partial Maya save would 500 mid-write), so a missing
  `ENCRYPTION_KEY` or an unreachable singleton row lands on a plain-English
  banner on both surfaces.
- `clearResendKey` keeps clearing `last_verified_at` alongside the key — that
  correction now lives in the shared writer (`COMPANION_NULL_ON_CLEAR`), so the
  board's Remove button inherits it instead of re-deriving it.
- Registry integrity tests extended: every `db-paste` row must resolve to ≥1 real
  console column (a typo'd id would otherwise render a Save button that reports
  success and stores nothing), the column map must stay bidirectionally
  consistent with the registry, and no `db-paste` step may route the paste back
  to the console.

Security posture unchanged: values are write-only (never logged, returned,
rendered back, or placed in a redirect param — errors carry a short slug code
only), column names come from the registry rather than form input, the new lib is
`import 'server-only'`, and the board's render tree still holds booleans only.

No schema change — the columns already existed.

SPEC IMPACT: None. Internal admin tooling; no customer-facing surface, SKU,
price, or schema is touched. (If the owner wants the "any key → /admin/secrets"
rule on the record, it belongs as a one-line `DECISION_LOG.md` entry in the spec
corpus — not applied from this branch.)
