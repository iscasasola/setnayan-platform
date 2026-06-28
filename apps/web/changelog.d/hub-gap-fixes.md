## 2026-06-28 · fix(guest): close gaps in the event-day hub — private-visibility gate, noindex, live-wall embed, tab a11y

A 34-agent adversarial audit of the just-shipped `/[slug]/hub` (PR #2368)
surfaced 19 confirmed gaps. This closes them.

**Privacy (critical) — the hub now enforces the private-event visibility gate.**
The canonical `/[slug]` page (and every sibling sub-route — find-seat /
find-my-table / recap) gates on `canViewSlugEvent`: a wedding is **private until
the Save-the-Date launches** (NULL → `'private'`, fail-safe), and a stranger with
a guessable URL is shown `PrivateLanding`, not the event's data. The hub shipped
**without** that gate — a non-guest could read a not-yet-launched event's
schedule, venue/address + GPS, watch link, and public album. Now the hub selects
`landing_page_visibility` + `scheduled_launch_at`, computes
`resolveEffectiveVisibility`, and `redirect('/${slug}')`s any viewer who isn't a
cookie-matched guest or a signed-in host — identical to the sibling routes (a
scheduled launch reads public at the same instant as the canonical page).

**Crawlability (high) — `export const metadata` marks the route
`noindex, nofollow`.** A day-of utility surface is never an SEO target, and this
fail-safes the private case against crawlers (the canonical page is
noindex-for-non-public; the hub is unconditionally noindex, which is strictly
safer for a utility route).

**Live Photo Wall (medium) — embed `LiveWallBlock` instead of linking the JSON
feed.** `/[slug]/live-wall` is a **route handler returning JSON**, not a page, so
the Photos panel's "live photo wall" link sent guests to raw JSON. The wall is
now mounted inline via `LiveWallBlock` (LIVE_WALL-gated, seeded by
`getWallSnapshot`, polls that feed internally) during the live window; the
post-event **recap** is the viewable album link.

**Toggle-menu a11y (medium) — real ARIA tabs.** The bottom menu used
navigation-only `aria-current` for an in-page toggle. It's now a proper
`tablist` / `tab` / `tabpanel` with `aria-selected`, `aria-controls`, roving
`tabindex`, and Arrow/Home/End keyboard movement; the panel stage is the labelled
`tabpanel`; "More" is a real `aria-haspopup="dialog"` disclosure.

**Consistency / correctness (low):**
- A TBA `+1` who hasn't confirmed their name is redirected to `/welcome` first
  (matching `/[slug]`), instead of rendering a personal hub for a non-identity.
- The "Now" panel renders `WhatsHappeningCard` **only** in the live window with
  blocks — its idle copy is host-voiced ("Add one in Schedule") and its header
  hard-codes a "Happening now" live badge, both wrong at pre/post/inactive. A
  guest-voiced, phase-correct status card shows otherwise.
- Candid-camera gating now matches the existing bars exactly: an identified
  guest sees it whenever the couple owns `PAPIC_GUEST` (window enforced in
  `/papic/guest`, matching `guest-hub-bar`); a no-guest viewer stays live-only
  (matching `public-event-day-bar`).
- One `PAPIC_GUEST` ownership read is reused for both the camera CTA and the
  face-enroll gate (was two); dropped a redundant `is_public` re-filter.
- The "Me" panel now also shows the invitation URL under the QR (parity with the
  QR modal; previously computed but unused).

tsc clean · next lint clean · lint:botnav / navicon / radius / legibility pass ·
production `next build` green. No new SKUs; prices admin-catalog-driven; seat
plan free; RA 10173 face/QR posture unchanged.

NOTE (pre-existing, flagged separately): `public-event-day-bar.tsx`'s
`photosHref` on `/[slug]` (shipped in #2356) links the same `/[slug]/live-wall`
JSON route — out of scope for this hub fix; flagged for its own change.

SPEC IMPACT: None (gap-closure on a new V1 day-of guest surface; iteration
`0031_day_of_guest` is the reference home).
