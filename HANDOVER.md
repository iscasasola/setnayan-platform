# HANDOVER — rd/titles-carry-woman-or-man (2026-10-17)

Owner ruling: title pick carries woman/man ("Atty. (Woman)" · "Atty. (Man)"), "so no need to choose" — no separate
Woman/Man buttons anywhere (controller relay, same day).

Done (committed): migration `20271271534871` (guests.gender + trigger + backfill of Mr./Ms./Mrs./Miss only + grants
post-condition) · `lib/guest-title.ts` · card Title leaf (both kits) · /guests/new · quick add / bulk / import read
"(Woman)" marks · `parentWordOf` gender first · legacy principal_sponsor column · seat-plan figure · Guests list prompt +
sheet (`titles-waiting.tsx`, `title-gender-actions.ts`) · loadMarch asks ENTOURAGE_PARENT_FIELDS · guards.

Decisions made here (no record covered them):
- Gender-needing roles = parents, grandparents, legacy `principal_sponsor` only (Ninong/Ninang, Best Woman, crews already
  say it by role). On cale-ice that is 1 person (the Atty. groom parent), not 33.
- "No title (Woman)" / "No title (Man)" entries exist for the 10 with no title.
- The Maker's hand-drawn kit has the same entries but no "Other title…" box (first-load budget).
- A linked (name-locked) person: the card shows the Title narrowed to their own title; only gender is written.

Merged origin/main 2026-10-17 (#6611 pair inference, #6607). Resolver order now: gender → title words (moved to
lib/guest-title.ts `titleWordsOf`, one reading for resolver + prompt) → attire → pair → neutral. The controller asked
for pair BEFORE attire; kept attire first because #6611's merged guard (grandparents-are-never-immediate-family: a Mr.
beside an Atty. in a Suit are two grandfathers) and its rule "nobody whose own entry says something is ever changed".

Old coordination note: the pair-inference work (rd/the-other-parent-is-named, wt-other-parent) was UNCOMMITTED and unpushed when
this started; both edit `parentWordOf` and `loadMarch`'s select. Expect a small conflict; keep gender as step 0.

Done since: corpus DECISION_LOG row pushed (Setnayan-specs 07437fd9) · exposure + port baselines regenerated · card
form golden regenerated (name_prefix → name_title) · 8 shots at 375 in ~/Documents/Claude/Projects/shots-2026-10-17/titles/
· guard sabotage 6/6 red.

Open: CI green (watch round in progress).
