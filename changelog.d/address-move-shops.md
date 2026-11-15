## 2026-11-15 · feat(addresses): a shop lives at setnayan.com/{shop} — the address move, PR 1 of 2 (shops)

Owner, 15 Nov 2026 (specs DECISION_LOG 7fbff0cd + d7910b5d, map `ADDRESS_MOVE_MAP_2026-11-15_fable.md`). The shop page
already rendered at the bare `/{shop}` and named it in its canonical tag; 46 files still built `/v/{shop}` links.

- **One helper, `lib/shop-address.ts`** (`shopPath`, `shopInvitePath`). Every shop link — the share link, every QR
  (page · dates · reviews · shortlist), emails, the favourites list, admin, the supplier's own dashboard, the photo
  mark's address line — is built through it. A guard fails if a `/v/${…}` link is typed by hand again.
- **`/v/{shop}` → `/{shop}`, 307** (the map's first step — a 308 comes later), and the same for `/dates`, `/booth`,
  `/review`, `/guest-review`. Reads only (a Server Action POST is never redirected); the query is kept. The route files
  stay at `app/v/[slug]/…` as the internal render target, so no file moves.
- **`/vendor-invite/{shop}` → `/{shop}/invite`, 308** (printed on QR codes; `et`/`cat` kept). **The word decides:** at
  `/{word}/invite` an event's word is the guest invite exactly as today; a word no event has is the shop's invite.
- **The shop's cached copy still answers strangers** at the bare address — but only when the event stamp read came back
  clean and empty. An event's word (cale-ice, maria-and-jose) or an unread stamp always takes the live render.
- The shop page now forwards **every** kind of renamed word (it used to forward shop renames only), so a renamed
  event's old word reaching the shop copy still lands on the event.
- The subdomain and custom-domain rewrites are unchanged (they target `/v/` internally).

Guards: `lib/shop-address.test.ts` (every redirect pair, the GET/HEAD-only 307, the 308, reserved words, the
cale-ice / maria-and-jose pin, no hand-built `/v/` link). `lib/slug-forwarding-reach.test.ts` and
`lib/the-shop-page-is-setnayan-sourced.test.ts` re-pointed at the new addresses, same properties.

SPEC IMPACT: Applies the owner's address ruling (DECISION_LOG d7910b5d) — no new corpus edit; PR 2 (events) follows.

- **Folded in #7818 (the supplier photo mark — address + QR on every shop; one PR per area, 16 Nov).** The mark's
  address line (`markVerifiedAddress`) and its QR (`markQrUrl`) both build the address with `shopPath(slug)`, never a
  typed `/${slug}`. `lib/shop-address.test.ts` holds that, and goes red if the QR is retyped by hand.
