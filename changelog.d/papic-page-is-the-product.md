## 2026-08-29 · feat(papic): the public page shows the product, not a price list

The owner rebuilt `/papic` with us over one session. Four rulings, all applied:

- **"we do not want the buttons on this page"** — the page carries no
  call-to-action at all. The QR codes are the way in.
- **"instead of showing the 16 different pricing tiers, we show +- and show what
  they can have"** — one dial, stepping the real rungs.
- **"QR codes should be ready for scan. these QR Codes should be face
  taggable."** — the live two-phone demo moved out of its overlay and onto the
  page.
- **"can we show the exact feel of the event hub papic part?"** — the
  celebration page's own obsidian gallery, reproduced from the shipped
  components.
- **"but where are the other features… Papic Challenge, Video Greetings, Thank
  You, Face Tagging, Face Blocking, and more"** — an inventory of ~25 features,
  every row checked against a shipped surface or the live catalog.

**The arithmetic the owner corrected, and the reason it is now a pinned rule:**
*"50 pesos become 150 credits because it has a free 50 credits already."* The
free grant always stacks, so the dial shows what the celebration HOLDS, never
what the money bought. `lib/papic-credits-held.ts` is that rule, and
`papic-credits-held.test.ts` fails if the dial stops calling it — mutation-proved
(sabotage 3 → 2 call sites, guard went red).

**Vocabulary:** "shots" → **credits** across the page, with the cost stated where
the money is (one photograph = 1; a ten-second video = the top band). Both
figures derive from `PAPIC_POINTS_PER_*`; the page and the dial are now on the
`papic-copy-guardrails` list, so a literal there fails CI.

**Papic leaves the shared doorway template — deliberately, and alone.** A credit
dial and live QR codes have no meaning on the song page. The three doorway
invariants (one h1 · its own canonical · both JSON-LD blocks) are preserved by
hand and still pass unedited.

**Three real defects caught by the guards while building, all mine:**
1. `force-static` on a page inside `app/(shell)/` — would have served a
   signed-in person a **signed-out rail, edge-cached, with nothing thrown**.
2. A hand-typed `PAGE_DESCRIPTION`, breaking the one-source rule against the
   Studio rail.
3. A title that double-stamped the brand (`… · Setnayan · Setnayan`).
Plus `--m-terracotta`, a CSS variable that does not exist and would have rendered
nothing, caught before it shipped.

**Two guards updated, neither weakened** — each records a named exception with
its reason: the demo marker now accepts an inline demo as well as the kit's
button, and `/papic` leaves the `studioKey` list because a page with no buttons
has no CTA to swap.

⚠ **What that costs, stated:** a signed-in couple loses the *Add to an event*
shortcut **from this page**. Papic is still added from the Studio inside the
celebration; this narrows the 2026-08-21 "the only difference is add to an event
button" ruling for this one page.

⏭ **Not built, and why:**
- **A third QR code.** A demo session is a two-token, two-role row through the
  table, the join route and the realtime protocol. A third is a schema change,
  not a prop — and a code that cannot be joined is a fake door.
- **The shared worldwide wall.** It needs a public upload endpoint, screening
  before display, a per-visitor cap and a face-key expiry. Three of those are
  owner/DPO decisions, not engineering ones.
- **`IDEAL_PHOTOGRAPHS_PER_GUEST`** is the one number on the page not read from
  the product. The nearest stored figure (150/guest) is a **spend ceiling**, not
  a recommendation, and quoting it would point a 150-guest wedding at the top of
  the ladder. 15 is a placeholder awaiting the owner.

Verified in a browser against live prices: ₱50 renders "100 bought + 50 free =
150". 11,336 unit tests green, exit 0.

SPEC IMPACT: The credits-not-shots vocabulary and the stacking rule affect
`Pricing.md § 00` and the Papic sections of the corpus, which still say "shots".
Recorded here; the corpus edit follows the DECISION_LOG sequence.
