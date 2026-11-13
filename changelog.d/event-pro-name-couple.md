## 2026-11-13 · copy(couple): the plan is "Event Pro" on the couple side

The plan was renamed on 8 Nov 2026: "Event Hub Pro" → **"Event Pro"**. This sweeps the couple-owned folders
(`app/dashboard/**`, `app/[slug]/**`, `app/onboarding/**`, `lib/onboarding/**`):

- "Event Hub Pro" / "Event Hub PRO" / "EVENT HUB PRO" → "Event Pro" / "Event PRO" / "EVENT PRO" in visible copy and
  comments. SKU codes (`COUPLE_WEBSITE_PRO`), identifiers (`UNLOCK_EVENT_HUB_PRO`), test ids and file names are keys and
  are unchanged. Lower-case owner quotes ("…the upgrade event hub pro") are verbatim and left as said.
- Visible copy only: the couple's "site"/"website" → "Event Hub", the generic "celebration" → "event" (e.g. "View live
  Event Hub", "One unlock for your whole Event Hub", "Where does your event lean?"). Left alone on purpose: URLs, ids,
  CSS/DOM names (`site-home`, `aria-label="Site sections"` — a selector other code reads), the event TYPE "Celebration",
  named packages ("The Grand Celebration"), editorial taglines, the `occasion` terminology fallback, and SKU display names
  ("Pro Website", "Advanced Website") that need a naming call.
- `the-love-story-reaches-the-pixels.test.ts` now reads `LOVE_STORY_PRO_CTA` from `lib/love-story-moments.ts` instead of
  retyping its words.
- New guard `lib/onboarding/the-plan-is-event-pro.test.ts` (uses `lib/strip-comments.ts`): fails if the old name returns
  in code in these four folders.

SPEC IMPACT: None in this PR (naming already decided 2026-11-08). The `lib/` guards that still pin the old copy in these
folders belong to the `lib/` rename and are listed in the PR body.
