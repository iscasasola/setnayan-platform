## 2026-07-26 · fix(security): column-level UPDATE/INSERT privileges on events

`couple_can_update_event` is a ROW-level UPDATE grant and the Supabase anon key is
public, so an authenticated host could `PATCH /rest/v1/events?event_id=eq.<own>`
with **any column** and bypass every server action, zod schema, and entitlement
check in `apps/web`. `authenticated_can_create_event` (`WITH CHECK (TRUE)`)
exposed the same surface at INSERT time. Verified on prod before the fix:
`authenticated` **and** `anon` held UPDATE on all 191 columns of `public.events`.

This is the general form of two bugs already patched one-at-a-time during Live
Studio work (Wave 3 free multi-cam publish via `live_studio_roam_manifest`;
Wave 4 cross-event QR harvest via a single-column FK), and of the
`vendor_profiles` self-grant fixes in `20271002456914` / `20271004444950`.

**Migration `20271005100000_events_column_update_privileges.sql`**

- Revokes table-level `UPDATE, INSERT` on `public.events` from `authenticated` +
  `anon`, then grants back a column allow-list **computed at apply time** as
  "all columns MINUS a 45-column deny-set". The allow-list is never
  hand-enumerated, so only deliberately-locked columns lose writability —
  columns this audit never examined keep exactly the access they have today.
- Deny-set inclusion rule: no authenticated-client write path touches the column
  (derived by extracting all 227 `.from('events').update|insert|upsert(` call
  sites and resolving each one's Supabase client) **and** a concrete exploit
  exists. Highest-impact entries: `kwento_free_grandfathered` (skips the paid-SKU
  check entirely), `setnayan_ai_active_until` (NULL = permanent unlock),
  `is_sample` (self-publish to `/realstories` bypassing consent gates),
  `papic_face_mode` (`mode_a` = face embedding for every guest, DPIA-relevant),
  `community_id` (grants a foreign community full-row SELECT on the event),
  `photo_delivery_oauth_token_encrypted`, `live_studio_roam_manifest`.
- `service_role` / `postgres` / SECURITY DEFINER RPCs unaffected; SELECT
  untouched; trigger-set columns unaffected (Postgres checks privileges against
  the columns named in the statement).
- In-migration post-conditions assert, against the live catalog, that every
  locked column is un-writable, that a 45-column host-editable sample is still
  writable, and that `service_role` kept full access — so a half-applied grant
  fails the migration instead of shipping.
- Adjacent: `UNIQUE INDEX events_master_qr_token_key`. `master_qr_token` is
  legitimately host-writable (the rotate action), had no unique index, and
  `app/api/crew/register-device/route.ts` resolves an event by token alone with
  `.maybeSingle()` — a host who reads a victim's event QR could duplicate the
  token and permanently break the victim's crew device registration. 0
  duplicates on prod.

**Tests**

- `apps/web/tests/db/events-column-privileges.db.test.ts` — real enforcement
  against the fully-replayed schema in PGlite with `SET ROLE authenticated`.
  Guarded against the vacuous-pass trap three ways: asserts `current_user` is
  genuinely `authenticated` and cannot BYPASSRLS; a positive control (the host
  really can still edit); and a differential control (every statement denied as
  the host is re-run as `service_role` and must succeed).
- `apps/web/lib/security/events-column-privileges.{ts,test.ts}` — build-time
  audit of the migration text, with 7 meta-tests that feed neutralized SQL
  through the same auditor and assert it fails.
- Verified by deliberately removing the table-level REVOKE: 4 of 7 DB tests fail,
  and the 3 that stay green are exactly the controls.

**Not fixed here** (grants cannot close these — the columns are legitimately
host-written; each needs its own PR): `monogram_custom_svg` reaching
`dangerouslySetInnerHTML` in the vendor dashboard (cross-tenant stored XSS);
`estimated_pax` re-read at checkout as the pax-price input (≈₱2,800/event
forgery); `lib/uploads.ts` presigning any `r2://` key without a tenant check;
`std_media.nsfw` self-approval; guests being able to SELECT the whole `events`
row (incl. `master_qr_token`) via `current_event_ids()`.

SPEC IMPACT: None — no product behaviour, pricing, or SKU change. Database
privilege hardening only; the app's own write paths are unchanged.
