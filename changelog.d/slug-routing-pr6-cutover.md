## 2026-07-02 · feat(routing): PR6 — flag-gated /u/ nested public-URL cutover

The final consolidation step of the three-tier public-URL program (vendor bare-root
· `/u/[user]/[event]` nesting · custom domains). Moves the canonical public event
URL from the legacy bare root `setnayan.com/{event-slug}` to the nested account form
`setnayan.com/u/{owner-slug}/{event-slug}`, WITHOUT breaking any printed QR code.
Everything is behind a single env flag, **default OFF / fully inert**, so the whole
cutover ships dark and the owner flips it after a production bake.

**Flag** — `NEXT_PUBLIC_U_NESTING_CUTOVER` (documented in `.env.example`). While
unset/`false`: byte-for-byte today's behavior AND zero added DB queries anywhere
(the owner-slug resolver self-noops when OFF). While `true`: new URLs emit the
nested form and old bare-root URLs 307-redirect to it.

**New helper** — `apps/web/lib/public-event-url.ts` (pure, client-importable —
Supabase import is type-only): `isUserNestingCutoverEnabled()`, `publicEventPath()`
/ `publicEventUrl()` (the single place that decides bare-vs-nested; graceful — a
null owner slug ALWAYS degrades to a working bare path), `resolveEventOwnerSlug()`
(the `member_type='couple'` member's `users.slug`, admin-client, self-noops OFF),
and `resolveRenamedEventPath()` (wires the long-dormant `slug_change_log` read).

**Dispatcher** (`app/[slug]/page.tsx`):
- Bare-root event hit → 307-redirect to `/u/{owner}/{slug}` when the flag is ON,
  **carrying the incoming query string through** (so server-action flashes `?save=`,
  the redeem route's `?invite_error=`, host `?phase=`/`?film=` previews, and UTM
  attribution survive canonicalization). Suppressed for (a) requests that already
  arrived via the `/u/` middleware rewrite (a new `x-sn-u-nesting` request header
  breaks the `/u/a/b → /b → /u/a/b` loop) and (b) custom BYO-domain hosts (there
  the bare URL is canonical). **307 (not 308) on purpose** — a permanent redirect
  would be cached and defeat a flag rollback; 307 keeps the bake reversible (flip
  to 308 is a fast-follow once the cutover is permanently committed).
- Event MISS → `resolveRenamedEventPath` redirects an old renamed slug to the
  event's CURRENT canonical URL, wiring the `slug_change_log` read that
  `updateEventSlug` writes but nothing read (renamed events' old QRs previously
  404'd). **Flag-gated** (self-noops when OFF) so the whole cutover stays fully
  inert until the flip — the rename-404 fix activates with the cutover.
- `generateMetadata` canonical + OG URL now track the nested form under the flag.

**Middleware** — the existing `/u/{user}/{event}` → `/{event}` rewrite now stamps
the `x-sn-u-nesting` loop-break header (query strings still preserved, so `?invite=`
tokens survive nesting).

**Call sites (~20)** — every event-URL/QR generator now threads `ownerSlug` through
`publicEventPath`/`qr.ts`: the guest invite QRs (invitation page + print,
custom-qr-guest page + print, the two `/api/website/qr/*` PNG routes), the master
landing QR + URL (site-editor, website hub, monogram upgrade), the guest's own
landing QR ([slug] + hub), the guest-list invite links, the seating/mood-board PDF
QRs, the **editorial "front-page story" share URL** (Facebook/OG), and
**`sitemap-weddings.xml`** (so the sitemap lists final canonical URLs, not
307-redirecting ones). Each resolves the owner slug ONLY when the flag is ON.

`lib/qr.ts` gains an optional `ownerSlug` on all 5 event functions.

**Adversarial review** (4-lens + per-finding skeptic verification, matching the
prior slug-routing PRs) confirmed no loops / no 404s / no broken URLs, and drove:
the query-string preservation above; flag-gating the rename read; a deterministic
owner tie-break (`.order('user_id')`, guards canonical drift if an event ever has
two `couple` members); and `.eq(lower(old_slug))` instead of `.ilike` (uses the
index + can't treat a `%`/`_` in a crafted URL as a SQL wildcard).

Typecheck + lint clean. Printed-QR safe: old bare-root URLs render pre-flip and
307-redirect (query preserved) post-flip; every unresolvable-owner path degrades
to a working bare URL.

SPEC IMPACT: None (additive, flag-gated, default-OFF routing plumbing; no schema
change — reuses the existing `slug_change_log` table, now finally read). Owner
action to activate: set `NEXT_PUBLIC_U_NESTING_CUTOVER=true` as a Vercel project
env var + redeploy, after the bake. Reversible by unsetting it. The corpus
DECISION_LOG append is deferred (this worktree is isolated from the shared spec
corpus and parallel sessions edit it concurrently; this fragment carries the record).
