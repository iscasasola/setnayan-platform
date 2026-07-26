## 2026-07-26 · fix(security): sanitise monogram SVG on read, snapshot pax at order, gate `?reveal=`

SEC-3 — the three findings PR #3715 deferred. That PR closed 45 `events` columns with a column-level GRANT, but these three ride on columns that are *legitimately* host-written, so a grant can't reach them. `events` UPDATE RLS is ROW-level, never column-level, and the anon key is public, so a host can `PATCH /rest/v1/events?event_id=eq.<their-own>` any host-writable column and skip every server action and zod schema in `apps/web`. All three fixes therefore live at the read/consume site.

**All three findings were real. One turned out to be worse than reported, and writing the tests surfaced a fourth bypass.**

---

### ① Stored XSS — `monogram_custom_svg` (cross-tenant)

The value reached `dangerouslySetInnerHTML` in the **vendor** client brief (`app/vendor-dashboard/clients/[eventId]/page.tsx`) — a couple's payload executing in a vendor's authenticated session. `next.config.ts` ships only `frame-ancestors`, so there is no `script-src` to catch it.

**Worse than the audit said.** The audit framed this as a PostgREST-only bypass. It isn't: the two write-time sanitisers were themselves defeated by four payloads, so a crafted `.svg` through the ordinary upload button was already enough. Proven directly against the shipped code:

| payload | `sanitizeBespokeSvg` | `sanitizeStudioSvg` |
|---|---|---|
| `<circle/onload=alert(1)>` | **accepted** | **accepted** |
| `<circle fill="x"onload=alert(1)>` | **accepted** | **accepted** |
| `<svg:script>alert(1)</svg:script>` | **accepted** | **accepted** |
| `<desc><img/onerror=alert(1)></desc>` | **accepted** | **accepted** |

Three root causes. (a) The handler rule was `/\son[a-z]+\s*=/i` — **whitespace-only separator**, but the HTML tokenizer re-enters *before attribute name* after `/` **and** after a quoted attribute value, so both of the first two parse `onload` as a live handler. (b) The element rules were namespace-blind — `/<script/i` does not match `<svg:script`. (c) `<desc>` and `<title>` are **HTML integration points** where the parser resumes *HTML* parsing inside SVG, and `/<image/i` does not match `<img `.

**New `apps/web/lib/monogram-svg-safe.ts`** — one hardened reject-don't-repair rule set, exported as `HOSTILE_SVG_PATTERNS` and enforced in three places:

- `safeMonogramSvg()` / `resolveEventMonogramSvg()` — the **read-time** gate, now applied at all 15 resolution sites (public guest site, dashboard chrome, launcher, account switcher, save-the-date, wax stamp, seating lab, hero, admin social queue, social card route, vendor brief). Fail-closed: a mark that doesn't pass returns null and the surface falls back to the typographic initials, so a rejection degrades the design and never blanks a page.
- Both **write-time** sanitisers now spread the same list. They *must* agree — if write accepted something read rejects, a couple would save a monogram and it would silently never appear, which reads as data loss.

**One deliberate exception, and it's provable.** Raster uploads are stored as a machine-built `<svg><image href="data:image/webp;base64,…"/></svg>` wrapper containing `<image>`, `href=` and `data:` — all three otherwise rejected. A blanket rule would have blanked **every raster monogram in production**. `RASTER_MARK` admits it via a whole-string anchored match where every attribute is a literal and the payload charset is base64 only; a base64 run cannot contain `<`, `"`, `on…=` or `javascript:`, so nothing can hide inside it.

**Defence in depth:** the two sites that inlined the mark now render it as an inert data-URI `<img>` (the vendor brief, and the "your monogram everywhere" sequence), matching the pattern `BespokeMonogramMark` / `EventMonogram` already use. Those surfaces no longer depend on the blocklist being exhaustive.

### ② Money — `estimated_pax` re-read at charge time

`resolvePaxPricedOrderCentavos` (`lib/v2-catalog.ts`) read `events.estimated_pax` **raw** at charge time, so: PATCH to 1 → buy → PATCH back. Worth ~₱2,800 on a 500-pax event (the `pax_floor` clamp bounds it — the deflate charges the floor, not ₱1).

- **The charge no longer trusts a single mutable number.** It now uses `resolveLivePax()`, the app's canonical pax definition, already what the vendor quoting engine charges against: `final_pax` when the guest list is frozen (a LOCKED column, service-role only, guarded by `guard_pax_finalize_columns`), else `max(estimated_pax, live headcount)`. A deflated estimate is floored by the roster the host actually has. This *removes* a divergence — every other pax surface already quotes this resolver.
- **`orders.pax_snapshot`** (migration `20271007100000`) freezes the pax an order was priced at, written once at insert, `REVOKE`d from `authenticated`/`anon` so the payer can't rewrite their own snapshot. Follows the `orders.setnayan_fee_bps` precedent on the same table.

**Audited the whole post-order chain** — approval, receipt issuance, payout scheduling, refunds, SKU activation, budget rollups: **none** re-derive an amount from live `events` columns; all read the stored order total. Exactly one write path changes an existing order's amount (`confirmOrderTotal`, admin-typed). So the blast radius was confined to order-creation time.

**State of play:** no catalog row currently has `is_pax_priced = TRUE` — the PAPIC_GUEST curve was retired by `20270828140000_papic_one_tiers.sql`. The hole was armed-but-unloaded, and one admin UPDATE re-arms it with no code change. There was **no test** covering the pricing curve at all; there is now.

### ③ Paywall bypass — `?reveal=`

Real, and it was three bypasses in one. `override !== null` sat in an OR with `premiumUnlocked`, so any anonymous visitor appending `?reveal=veil-sheer` to a public couple page got the paid ₱999 cinematic opening on an event that never bought it — and the same value also resurrected openings the **admin** had deactivated and overrode the **couple's** explicit "No Reveal" choice.

It is a genuine affordance ("how we demo on Vercel previews"), so it is **scoped, not deleted**: `resolveRevealOverride()` honours the param only on a build with `NEXT_PUBLIC_STD_REVEAL=1` — a build-time variable no visitor can set, and which turns the reveal on for everyone anyway, so preview deploys are unchanged. In production the flag is off and the param is inert. Host-side previewing is untouched: the dashboard chooser and the admin Reveal Studio both render templates from props and never read the param.

**A fourth bypass, found while writing the test:** `REVEAL_ALIASES[reveal]` was a bare index, so `?reveal=constructor` and `?reveal=__proto__` resolved **truthy** off `Object.prototype`. Since activation only asked `override !== null`, that switched the opening on with no valid alias at all. Now `hasOwnProperty`-guarded.

---

### Tests

`pnpm test:unit` — 3805 pass. (3 pre-existing failures are missing optional deps in the local `node_modules`, not these changes.) New coverage:

- `lib/monogram-svg-safe.test.ts` — 41 cases. Every hostile payload above, plus namespaced elements, `<animateTransform>`, XXE DOCTYPE, CDATA, entity-obfuscated schemes, oversize. Crucially it also pins that **legitimate producers still pass**: real bespoke output, real studio output, the raster wrapper, local gradients, `<title>`/`<desc>` a11y marks — and that the output of each write-time sanitiser is accepted by the read gate.
- `lib/pax-charge.test.ts` — the exploit replayed: `estimated_pax = 1` with 250 attending resolves 250 and charges ₱4,049, not the ₱2,999 floor. Plus the frozen-list branch and the floor clamp.
- `app/[slug]/_components/reveal/reveal-override.test.ts` — every alias inert in production, every alias working on preview, prototype-chain keys null.

No DB test was written here; the migration carries its own post-condition block that asserts catalog state (column, CHECK, `service_role` retains INSERT, `authenticated`/`anon` do **not**), which cannot pass vacuously the way an owner-connected RLS test can.

### Deferred, with reasons — not fixed here

- **`script-src` CSP.** `next.config.ts` ships only `frame-ancestors`. A real `script-src` is the structural answer to this whole bug class, but it needs a nonce/hash strategy across every inline `<script>` (theme bootstrap, boot splash, ~120 JSON-LD blocks) and a report-only bake. Recommended as its own PR.
- **`std_media.nsfw` self-approval — REAL, assessed, not cheap.** `std_media` is host-writable JSONB and `stdVideoIsLive()` requires `nsfw === 'approved'`, so a direct PATCH puts an **unscreened video on the public guest page**. The server action already refuses a client-supplied verdict — the guard is just in the wrong layer. A naive preserve-OLD-value trigger would be *worse* (it pins `approved` onto a swapped video); a correct one must mirror the action's "unchanged videoKey keeps the verdict, changed forces pending" logic in PL/pgSQL plus a non-owner DB test. Own PR.
- **`event_type` → Setnayan AI price. Same shape, LIVE, and worse — no floor.** `lib/setnayan-ai-event-pricing.ts` reads the host-writable `events.event_type` at charge time on a ₱1,499/₱999/₱499/₱99/₱0 ladder. A snapshot doesn't help (it would faithfully record ₱99); the fix is a product decision about whether `event_type` may change after creation.
- **`createOrder` takes the price straight from the client.** `app/dashboard/[eventId]/orders/actions.ts` inserts `requested_total_php` from `formData` with no catalog resolve, no sellability gate. The UI entry is retired but it is still an exported `'use server'` action. Strictly worse than the pax bug — arbitrary price, no floor.
- **Before re-arming any pax-priced SKU**, price it off the frozen `final_pax` only. The `resolveLivePax` clamp raises the cost of a deflate but does not eliminate it: every input before the freeze (`estimated_pax`, `headcount_basis`, and the guest rows themselves) is host-controlled.

SPEC IMPACT: None — no pricing, SKU, or product-behaviour change. `?reveal=` in production was never an intended entitlement path (the reveal spec gates premium openings on `STD_PREMIUM_OPENINGS`), and the pax charge now matches the pax definition the rest of the corpus already describes.
