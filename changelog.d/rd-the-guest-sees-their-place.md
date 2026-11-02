## 2026-10-17 · feat(entourage): every look marks the guest's own name — "Your place is marked." · See where you are ↓

Owner, 17 Oct: *"if they are at the wedding march, we want to highlight them on the wedding march so they can see where they are."* The March already lifted the signed-in member's line; On the axis (the default, the owner's own event) and Lines marked nobody.

- `app/[slug]/_components/entourage-you.tsx` (new) — the one mark: a veil wash and a gold underline on THEIR name only (never the partner's), a small gold "You", and under the heading "Your place is marked." plus, for a walker, the shipped `marchPlaceLine` ("You walk 5th, with …, after …") — the same sentence Me reads. Every place they print is marked (two roles → two marks); the first carries `#site-entourage-me`.
- On the axis + Lines (`entourage-section.tsx`, incl. the by-role and inline layouts), the March (`entourage-styles.tsx` — its line keeps the gold rule; the in-row "· you walk Nth" became the heading line, the wash moved from the whole line to their name), and Post Event's Roll call · Portrait grid · Family tree (`post-event-scene-views-3.tsx`, viewer from `loadYourOwnDay`, which now returns `guestId`).
- `see-where-you-are.tsx` (new, client) — one quiet "See where you are ↓" under the Welcome's "You are …" and Me's "Your role", drawn only when `#site-entourage-me` is on the page. No auto-scroll.
- `site-body.tsx` — the guest tree passes no viewer on the Maker canvas (See as / View as a role draw a stand-in).

Guard: `lib/the-guest-sees-their-place.test.ts` — on every registered entourage style, a recognised guest's own name carries the mark and nobody else's does; a stranger's page carries none.

SPEC IMPACT: None — implements the owner's 2026-10-17 ask on the shipped looks; no locked decision changed.
