## 2026-11-11 · feat(fair-presentation): the 8 Nov ruling on every supplier-written name — live note, Save off, server re-check, one sweep

Owner 8 Nov: *"any of these words should not be allowed"* · *"no emojis as well"* · *"0001 is still number 1"* ·
*"we want to offer professional service cards"* (the 18 checks) · *"ok remove the DTI statement. just make it
professionally stated and still proactive."* Found unbuilt 11 Nov on a live card named "Best mobile bar". #7480 seeds
the word list; this builds the rest.

- **One checker** (`lib/fair-presentation.ts`, pure): the admin claim-word list, disguised forms read before matching
  (`lib/claim-text-fold.ts`: "b e s t", "B3ST", "ＢＥＳＴ", "N0. 1", "#1️⃣"), rank forms (0001 · #01 · No./N°/Nr. + 1 ·
  "first choice" · "the one" · Top 1/3/5/10 — never "100 guests" or "1st floor"), no emoji (Extended_Pictographic,
  keycaps, flags, ZWJ; © ® ™ stay text), and the text checks of the 18: shouting, off-platform contact (the shipped
  detector, behind its shipped flag), fake discount, "free" off a What's-included line, keyword stuffing, flooding
  (same card name twice), unverifiable counts/ratings, speaking as Setnayan, fake urgency, placeholder names, card names
  ≤ 50, no price in a name. The ruled copy, word for word, with no law or agency named.
- **Every field** draws one plain note under its line and holds its save while it is open, and its server action asks
  the same function again before writing: the card maker (name · what's included · extras — replaces the claim-word
  rows), the shop name (Your details, the name-change request, /open-shop), the tagline, About (both About doors), and
  the bundle name.
- **The one sweep** — "Edit your name" on the Shop tab lists every LIVE name (shop name, tagline, cards, bundles) that
  needs an edit, with the ruled notice and a door to the field. Read on view, never written; no email, no push;
  nothing taken down.
- **Data-only migration** seeds check 14's borrowed-standing phrases ("as seen on/at/in", "as featured in", …) into
  `card_claim_words`, ON CONFLICT DO NOTHING.
- Not built, said so in `FAIR_PRESENTATION_CHECKS`: bait price (behind `BAIT_PRICE_RULE_ON = false` — conflicts with 26
  Oct "remove the price integrity issue"), hidden extras and coverage (nothing to check in the schema), flyer-as-cover,
  watermarks and couples' names (no honest measurement today).

SPEC IMPACT: None — applies DECISION_LOG 2026-11-08 "NO CLAIM WORDS IN ANY SUPPLIER-WRITTEN NAME", "NO EMOJI IN
SUPPLIER-WRITTEN NAMES", the "0001 is still number 1" rank forms, the fair-presentation copy and "FAIR PRESENTATION: 18
checks" as ruled. Owner calls raised in the PR (no corpus edit): the Good · Better · Best tier label vs plain "best";
bait price (26 Oct vs 8 Nov); what counts as a "repeat" before admin review hides a card.
