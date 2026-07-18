## 2026-07-15 · fix(vendor): close the What's-new identity leak + audit fixes

Verified vendor proto-vs-shipped audit findings against `origin/main` and fixed
the genuine remaining deltas (several findings were already resolved by the
merged glass reskin PR #3271 / anonymization PR #3266 and are noted as such).

- **Finding 1 — pre-accept identity leak (CRITICAL, extends #3266).** #3266 had
  already stopped assembling the couple's `display_name` into the Overview
  "What's new" inquiry card, but the field was still named `eventName` — a
  foot-gun inviting a future edit to drop the real event title (which contains
  names) straight back in. Removed that risk STRUCTURALLY: the inquiry card now
  lives in a dedicated pure module `lib/vendor-overview-inquiry-card.ts` whose
  `buildInquiryCard()` accepts ONLY non-identifying inputs (event type · region ·
  date · category) — there is no `displayName`/`venue`/`contact` parameter, so
  the couple's identity cannot reach the card by construction. The card ships a
  neutral `descriptor` ("A couple planning a {type} in {city}") instead of any
  `eventName`. `overview-sections.tsx` reads `card.descriptor`. New DTO test suite
  `lib/vendor-overview-inquiry-card.test.ts` asserts a pending-inquiry payload
  carries no `eventName` field and no couple identity.
- **Finding 2 — one source of truth for card colour.** Consolidated the two
  per-kind maps (`CARD_ACCENT` + `CARD_EYE_COLOR`) into a single `CARD_KIND`
  palette in `overview-sections.tsx` so a kind can never be one colour in one
  place and a contradictory colour in another. Colours unchanged (gold family +
  warm semantics per the kit).
- **Finding 4 — day-of console honesty.** The "On the Day" console banner claimed
  it is "normally hidden until you have an event today," but the full console
  rendered unconditionally with degraded zero-cards. Gated it: the full console
  now renders only when a booking is dated today (the real in-window state) or in
  explicit `?preview=1` mode (owner/design escape hatch); otherwise a compact
  honest state renders (the "No event today" explainer, the day-of tool pills, and
  the event-brief door). Banner copy rewritten to match — a live confirmation on
  an event day, a labelled preview banner (with "Exit preview") under the flag.
- **Findings 5–7 — colour residue + stale comments.** Deleted the retired
  `--v-blue` token definition from `globals.css` (zero `var(--v-blue)` paint
  consumers remained repo-wide; only the def + two "retired" comments). Added a
  sanctioned `info` (info-slate, `--sn-info`) Tailwind family and swapped the two
  raw `violet` one-offs on the vendor surface to it (`disputes/page.tsx` dispute
  "resolved for the couple" tone; `vendor-stats-panel.tsx` Expert tier). No stale
  "wine-accented" comments remained in `overview-sections.tsx` (already gold from
  the reskin). One audit finding (Overview dark focal missing) was refuted — the
  obsidian focal exists (`VendorTodayFocal`); not touched.

SPEC IMPACT: Reinforces `Vendor_Inquiry_Anonymization_Spec_2026-07-15.md`
§ "Enforcement depth" (data-layer masking, not display) for the Overview
"What's new" feed (spec surface #3). No corpus edit needed — shipped behaviour
already matched the spec; this hardens the enforcement so it cannot silently
regress. The added positive-privacy note (identity revealed only after the
token burn) is already captured in the spec.
