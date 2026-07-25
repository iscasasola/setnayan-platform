## 2026-07-11 · feat(pabuya): couple-side e-gift ("digital money dance") dashboard + flag-gated public surface

Net-new **Pabuya** surface: the couple manages their OWN e-gift destinations so
guests can send a gift straight to them. **Core invariant — Setnayan never
holds or touches money.** Every row is display-only (a label + account name +
handle + optional uploaded QR image); there is no amount, order, ledger, or
settlement anywhere in the schema. Guests send directly to the couple's own
GCash / Maya / bank / PayPal account.

**Schema (migration `20270725802892_event_egift_methods.sql`).** New table
`public.event_egift_methods` — `egift_method_id UUID PK`, `public_id TEXT UNIQUE
DEFAULT generate_public_id('Y')` (canonical S89Y- handle), `event_id UUID FK →
events ON DELETE CASCADE`, `method_kind` (gcash/maya/bank/paypal/other, CHECK),
`label`, `account_name`, `handle`, `qr_r2_key` (the `r2://bucket/key` tagged ref
for the uploaded QR image — lib/uploads convention), `note`, `is_enabled`,
`sort_order`, `created_by_user_id`, `created_at/updated_at` (+ per-table
`updated_at` trigger). Composite index on `(event_id, sort_order)`. RLS enabled
at CREATE; policy `event_egift_methods_host_all` (FOR ALL) scopes CRUD to the
event's accepted moderators + legacy `event_members` couple + admin — the
`event_sponsors` idiom. **No anon policy by design:** the public page reads
service-role behind the published-visibility gate (the shipped Live Wall /
Auto-Recap door), because `events` has no anon-read policy so an anon RLS
subquery would be broken anyway. "Public read gated to published events only" is
enforced at the app layer via `canViewSlugEvent` / `landing_page_visibility`.

**Dashboard `/dashboard/[eventId]/pabuya`.** Full CRUD — add/edit/remove
methods, upload the QR via the existing `<FileUpload>` → `/api/upload` → R2
presigned-PUT pipeline (bucket `media`, prefix `events/{eventId}/pabuya`), toggle
show/hide, and reorder (up/down, swapping `sort_order`). Server actions
(`saveEgiftMethod` / `deleteEgiftMethod` / `setEgiftMethodEnabled` /
`moveEgiftMethod`) write via the user-scoped client so RLS is the authz boundary.
A **live guest preview** panel renders the shared presentational component
`app/_components/pabuya/pabuya-card-list.tsx` (`PabuyaCardList` +
`PabuyaTrustNote`) — the exact card list guests will see, updating as the couple
types. The hand-off is made explicit ("Guests send directly to your account —
Setnayan never holds your money").

**Public route (flag-gated, ships dark).** `/[slug]/pabuya` follows the
`/[slug]/recap` pattern (service-role event read + `canViewSlugEvent` +
`surfaceEnabled('website')` + `revalidate=300`, handles noindexed), reusing the
same shared preview component. Gated behind `PABUYA_PUBLIC_ROUTE_ENABLED`
(`isPabuyaPublicRouteEnabled`) — **off by default → notFound()** — so the
net-new public surface only goes live when the owner sets the env. The dashboard
hides the "Open ↗" link while the flag is off.

**Entry point.** New "E-Gifts" child under the Studio group in
`customer-nav-config.ts`, gated on `websiteEnabled` (same surface gate as Event
page / Website), icon `Gift`.

Files: `supabase/migrations/20270725802892_event_egift_methods.sql`,
`apps/web/lib/egift.ts`, `apps/web/lib/egift-kinds.ts`,
`apps/web/app/_components/pabuya/pabuya-card-list.tsx`,
`apps/web/app/dashboard/[eventId]/pabuya/{page,actions,loading}.tsx` +
`_components/pabuya-manager.tsx`, `apps/web/app/[slug]/pabuya/page.tsx`,
`apps/web/app/dashboard/[eventId]/_components/customer-nav-config.ts`.

⚠ Migration NOT yet applied to prod — apply with
`supabase db push --db-url "$SUPABASE_DB_URL"`. The dashboard + public reads
graceful-degrade to an empty set until then, so this is safe to merge/deploy.

SPEC IMPACT: None yet (net-new surface from memory
`project_setnayan_kasama_pabuya` + prototype `Kasama_Pabuya_EventSite_2026-07-11`;
no locked SKU/price touched — Pabuya hosting is free, Setnayan holds no money).
Load-bearing decisions surfaced for owner sign-off in the session response:
(1) public read is service-role-behind-published, not an anon RLS policy;
(2) public `/[slug]/pabuya` route added but flag-gated off by default;
(3) `public_id` prefix letter `Y`; (4) UUID PK + `public_id` (shipped
convention) rather than a hidden bigserial. Logged at the bottom of the corpus
`DECISION_LOG.md` if adopted.
