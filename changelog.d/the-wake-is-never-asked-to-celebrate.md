## 2026-08-27 · fix(onboarding): the wake is never asked to celebrate

The funeral went live 2026-08-24 as the product's first solemn event type. The
solemn register was threaded through the guest tree and stopped at the front
door, so a family arranging a wake was walked through the celebratory
experience quiz verbatim — *"What would make the day unforgettable?"*, *"How big
does it feel? Grand & full-house — the more the merrier"*, *"What's the energy of
the day? **Joyful & lively** — music, dancing, and a packed floor"* — and then
handed a persona card reading **"The Grand Celebration — the celebration everyone
talks about, a packed floor, every guest part of the night."**

- `lib/onboarding/solemn-content.ts` (new) — the five axes and all six persona
  reveals in the solemn register. **Code, not an `axis_overrides` row**, because
  `getOnboardingSpec` degrades to the defaults on a read error and a wake must
  not fail open into "Joyful & lively". Same posture as `FUNERAL_PROFILE`. An
  admin override still layers on top; it just cannot lose the base.
- Keyed on `terminology.register`, never on `eventType === 'funeral'` — the next
  solemn type inherits it by declaring its register.
- The register is threaded page → `getOnboardingSpec` → `resolveOnboardingSpec`,
  and passed on **all three** degrade paths inside the read.
- The closing screen — the only screen whose words are its own — gets a solemn
  arm (🕊️, *"Everything is in one place"*). The celebratory arm is byte-identical
  and pinned as a frozen literal.
- The funeral now has **three** signature questions (the service · those far
  away · what would help most) derived from the shipped funeral checklist, and a
  **14-field** detail screen that asks for the pasiyam by name and keeps the
  rosters of who is speaking and who is carrying uncapped.
- Its starter plan stays inside the eight categories a funeral can reach, and
  offers **no paid camera rung** — the solemn register's own "no upsells" rule.
- 🔑 `resolveOnboardingFlow` fell back to the pack key `'generic'` on a NULL
  `onboarding_flow_key`, while the admin editor fell back to the **event type** —
  two answers to one question, and the funeral was the only type with that column
  NULL, so nothing authored for it was reachable. Both now answer the event type.
  Migration `20271172453804` sets the column too, so the DB and the code agree;
  the fix does not depend on the push.
- Guard `lib/onboarding/solemn-onboarding.test.ts` — 12 assertions, **12
  mutations, every one measured by occurrence count before → after, every one
  red**. Its celebratory word list is `\b`-anchored: the first cut matched by
  substring and went red on *"A funeral Mass"*, because "funeral" contains "fun".

SPEC IMPACT: `03_Strategy/Onboarding_Design_Brief_2026-08-11.md` — the funeral's
row moves from "asks nothing" to three questions + a detail screen; §3C's "five
events have none at all" becomes four. Applied in the corpus.
