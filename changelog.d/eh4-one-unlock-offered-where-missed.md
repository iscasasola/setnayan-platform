## 2026-09-02 · feat(event-hub): one unlock, offered on the channel where it is missed

**EH4.** Owner, 2026-09-02: *"the cinematic reveal, added features like background music, upload
photo/video, and other pro features should be managed on the controller as well."*

RULE 0 answered it before a line was written: **they are already one named set, and the owner named
four of the seven from memory.** `WEBSITE_PRO_ITEMS` — Cinematic Reveal · Save-the-Date video ·
Photo gallery · Background music · Editorial editing · Background color · Button color — and
`pro-panels.tsx` has said since it shipped that they are *"ONE unlock … no per-feature buy button."*

**So the controller did not grow seven upgrade slots. It grew ONE, offered on whichever of the four
public channels the couple is standing on when they meet the wall** (design § 5.1 rule 1, § 5.3;
prototype § 4). Same unlock, same live catalog price, bought in place.

- `apps/web/lib/website-pro-items.ts` — NEW. The seven names, extracted from the `'use client'`
  `pro-panels.tsx` so a server resolver can share them instead of copying them; `pro-panels.tsx`
  re-exports `WEBSITE_PRO_ITEMS` under its own name, so nothing that imports it moves. Also carries
  `NOT_SOLD_ON` — the items the umbrella may not be sold on.
- `apps/web/lib/event-hub-pro.ts` — NEW. `resolveHubProOffer`, pure, in the `event-hub-control.ts`
  shape. Returns `null` when the couple owns it, when the read did not happen, on the day, after the
  day, and when the only thing to sell is already free.
- `apps/web/app/dashboard/[eventId]/launch/_components/hub-pro-offer.tsx` — NEW. The gold dashed
  panel: seven chips with the one they are standing on lit, one CTA to the SHIPPED
  `/studio/website-pro` buy surface.
- `apps/web/app/dashboard/[eventId]/launch/page.tsx` — reads `eventCoupleWebsiteProActive` +
  `eventOwnsCoupleWebsitePro` + `formatV2Sku('COUPLE_WEBSITE_PRO')` and renders the offer inside S4,
  attached to the live channel.

**⛔ NO PRICE IS TYPED ANYWHERE.** The figure is `formatPhp` over the live `platform_retail_catalog_v2`
row, and is omitted entirely when that read fails. **🔑 SHOW IT WORKING — DO NOT DIM AND LOCK**
(owner-locked 2026-07-25): the offer adds nothing over the channel cards — no greyscale, no lock
badge, no overlay.

**🪤 The Papic precedent is tested, not assumed.** An OWNING event asserts the offer is `null` on
every channel — the launch branch — because a gate that can only answer one way renders identically
to a gate that works.

**⚠ THE GATE IS SETTLED AND OWNER-RULED — reused exactly, not widened.** `hubOffersAllowed` (EH1) is
`phase === 'plan'`, and that ONE LINE DOES THREE JOBS, all three named in its own docblock in
`lib/event-hub-control.ts`: **(a)** on the day — an offer never outranks the day; **(b)** after the
day — the row closes rather than sells, the **owner ruling of 2026-08-21** (*"stop selling the day
itself once the day is over"*, `4b41640b0`), guarded by
`apps/web/lib/stop-selling-the-day-after-the-day.test.ts`; **(c)** when the phase is **unmeasured** —
we do not know whether it is their wedding day, and an unread state must never become a sale.
🛑 Do not widen it, do not relax it to day-only, do not add a second gate beside it. A consequence
worth naming rather than discovering: the Day-of and Editorial channels therefore never carry an
offer, because the stage only reaches them once the phase is `dayof`/`after` — that is the ruling
working, not a gap.

🔑 **THIS PARAGRAPH SAID THE OPPOSITE WHEN IT MERGED, AND THE CORRECTION IS THE POINT.** It read
*"THE DAY GATE IS INHERITED, NOT CHOSEN … STRICTER than the design text"* — framing correct,
owner-ruled code as a deviation, which is how a settled ruling gets relaxed six months later by
somebody acting in good faith. The predicate was right; the DESIGN DOCUMENT was the stale half
(§ 5.1 rule 3 read "never on the day" alone and has since been corrected in the corpus to state all
three cases). Fixed here before `scripts/changelog-collect.mjs` folded this fragment into
`CHANGELOG.md` — the phrasing never reached the collected log.

SPEC IMPACT: None. Implements `EVENT_HUB_CONTROLLER_DESIGN_2026-09-02.md` § 5.3 as written.
