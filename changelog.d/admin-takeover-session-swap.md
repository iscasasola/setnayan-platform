## 2026-06-22 · feat(admin): Phase 3b — scoped account-takeover SESSION-SWAP ("act as the user"), FLAG-GATED OFF (draft, owner-review-before-prod)

Builds the actual in-session "act as the user" capability on top of the Phase-3 governance scaffold (#2058), choosing the **least-dangerous viable mechanism**. The single highest-risk feature in the program — ships **FLAG-GATED OFF + as a DRAFT PR**. With the master switch off (`platform_settings.admin_takeover_enabled` NULL + `ADMIN_TAKEOVER_ENABLED` env unset — the default), every entry point throws/early-returns before touching data; prod is byte-identical.

**Mechanism (deliberately NOT a Supabase-JWT impersonation):** the admin stays logged in as themselves. A second, separate `jose` HS256-signed, httpOnly, `sameSite=strict`, **1h-TTL** cookie (`setnayan_admin_actas`) binds the admin to ONE target via ONE open `admin_takeover_sessions` row. It is a re-validated CLAIM, not a grant: `resolveActAsContext()` (lib/admin-actas-context.ts) re-checks on EVERY request — (1) flag still on, (2) signature/shape valid, (3) the bound session still OPEN (`ended_at IS NULL` → covers admin-end, the user's force-end from #2068, and the backstop) + not past `expires_at`, (4) the cookie holder is still the session's acting admin AND still an admin. Any failure ⇒ null + cookie cleared. No long-lived privileged token to revoke — the moment the session ends, the next request is inert. We never call `setSession()` / mint the target's auth JWT.

**Scope = read-leaning + consent-to-fix (NOT blanket write-impersonation):**
- `enterActAs` / `exitActAs` — mint/drop the cookie (only the session's acting admin; audited via `recordTakeoverAction`).
- `proposeActAsFieldFix` — in-session correction: queues an `account_field_edits` row (`status='awaiting_user'`) the TARGET must approve; never writes their data silently. V1 allow-list = `display_name` only (the sole personal column on `public.users`).
- Persistent sticky "You are acting as X" banner in the admin layout (cheap cookie-presence check first → zero DB work in the flag-OFF case).
- `endTakeover` now also clears the act-as cookie.

**Privacy invariants HOLD:** no reader of chat bodies, attachments, behavioural data, or face vectors anywhere; `lint:chat-guard` clean.

Files: `lib/admin-actas-context.ts` (new), `app/admin/users/takeover-actions.ts` (+3 actions, header), `app/admin/users/[userId]/takeover/page.tsx` (act-as controls), `app/admin/_components/act-as-banner.tsx` (new), `app/admin/layout.tsx` (mount banner), `lib/notifications.ts` (+`account_field_edit_request`). Migrations (NOT applied to prod): `20270216882393_account_field_edits_consent_to_fix.sql` (consent-to-fix table + RLS), `20270217048054_add_account_field_edit_notification_type.sql`. Optional new env `ADMIN_ACTAS_SECRET` (falls back to the service-role key like the other signed-cookie helpers). tsc clean · changed-file lint clean · prod build EXIT 0 · chat-guard clean.

SPEC IMPACT: implements Admin_Account_Access_Model_2026-06-22.md §5 (takeover session swap) + §3 consent-to-fix tier, the remaining flag-gated Phase 3 step. Owner review required before enabling in prod (see PR body's security checklist + residual risks). Corpus DECISION_LOG not touched in this PR.
