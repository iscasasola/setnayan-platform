# PROGRESS — P6a · Event types Tier 1a (sides · wording · wedding religion)

Paused 2026-10-01 ~15:10 UTC by the owner's instruction; the controller continues locally.
Spec: controller C14 → `BUILD_PROMPTS_THU_2026-10-01.md` "P6 — Event types, Tier 1" part P6a
(+ addendum), source `EVENT_TYPE_RELIGION_AUDIT_2026-09-30.md` §4 Tier 1 items 2, 6, 7 (copy), 8, 10.
Delete this file in the last commit before `gh pr ready`.

## Done (all committed on this branch)
- **(1) Sides** — gated on `eventHasSides` where they still leaked: new-group "Team side" + group chip
  title (`guest-list-multiselect.tsx`), groups rail + `TeamSideSelect` (`groups-sidebar.tsx`, new
  `hasSides` prop), duplicate rows (`guest-name-fields.tsx`, `quick-add-sheet.tsx`), check-in desk,
  request "Accept" quick add (`claims/keep-quick-add.tsx`), roster search haystack. Door refusals in
  `checkin/actions.ts` + `souvenirs/actions.ts` use EventWords. (site-body sideLabel / ticket / widget
  were already gated on main.) Guard `guests/no-side-surface-on-a-sideless-event.test.ts` (per component, counts).
- **(2) Maker** — `MakerNavigatorData.hasStory` (profile love_story) replaces the `hasStory: true`
  constant; `maker-scene-list` drops the love-story scene for types without two people; guest-path
  Story tab + prose gated; `public-site-pages` blurbs; editorial fallback "Our Event".
- **(3) Your Team copy** — 5 strings. **(4) Prints + emails** — seat-plan pack fallback, supplier invite
  (`eventWord`), full-res digest, Real Story email. Guard `lib/the-wedding-words-stay-at-weddings.test.ts`.
- **(5) Religion** — `buildScheduleSeed` revived as template `FAITH_TEMPLATE_ID` via `loadScheduleTemplate`
  (+0 actions); `DANCE_FREE_RITES` (inc · muslim · lds · sda, either column) strip cocktails/dancing/after-party
  from every template. Checklist sponsor tasks per rite (`usesPrincipalSponsors` / `usesSponsorPairs` /
  `usesSecondarySponsors`, INC one pair, civil witnesses); `buildSeedRows` reads the secondary rite;
  `dressRiteOf` for the dress-code scene; launch gate in Details + date finder (`lib/ceremony-choices.ts`);
  faith-registry false "pre-set" promises removed. Guards `lib/wedding-religion-reaches-the-day.test.ts`,
  db `tests/db/an-inc-wedding-has-no-cocktail-hour.db.test.ts`.
- 3 existing guards re-anchored (s13 line exemption, the-guest-text-is-honest, the-page-dropdown).
- Changelog fragment `changelog.d/rd-event-types-tier-1a.md`.
- Every new guard sabotage-checked (RED → restore).

## Checks (local, this head minus this note)
typecheck ✅ · next lint ✅ · 34 ci `lint-*.mjs` ✅ · lint:dup-rule ✅ · full unit suite 21,345 (3 re-anchored, now
green) · touched db tests ✅. Budgets, production build before (origin/main b02235da) → after:
shared 202.0 → 202.0 KB (≤202) · Maker 503.2 → 503.3 KB (≤505) · server actions 1225 → 1225.

## Not done
- `CEREMONY_TYPE_READABLE_LABEL` (8 of 18) in `lib/wedding-plan-groups.ts` — P3-owned (#6234); one-line
  follow-up after it merges (map through `FAITH_LABELS`).
- `app/onboarding/**` (C11) `onboarding-shell.tsx` still says "pre-set things like halal catering".
- Addendum items (corporate RSVP words, Parish/Venue labels, wake gift door) → G5 / P6b.
- CI was only partly run: a draft PR **#6249** exists from branch `claude/wizardly-meitner-5gqdc5` (same
  commits). At pause, 7 checks passed, none failed, the rest still running. Close it or reuse it — the
  owner said open no new PR.

## Next step
Merge origin/main if behind, re-run the touched tests, delete this note, then PR per §0 (draft →
`do-not-auto-merge` label → ready when green → confirm auto-merge null). Phone check card is in the
#6249 body.
