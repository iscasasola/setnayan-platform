## 2026-06-22 · feat(onboarding): remove the information-only steps from the flow (for now)

Owner: *"the steps like this, the information only, can we remove them for now"* (pointing at the
"Welcome to Setnayan." tap-to-continue screen). The pure no-input interstitials are filtered out of
the onboarding sequence so it runs question→question. **Reversible** — empty the new
`REMOVED_INFO_SCREENS` set to restore every screen; the JSX sections are left in place (just never
become active).

Removed from the flow (owner picked all): `welcome` · `alaala_promise` ("Our promise · Your day,
kept alive.") · `team_intro` ("Let's start with your reception.") · `team_payoff` ("Look how far
you are.") · `love_preview` ("Here's the two of you.") · `exp_reveal` (the "You're [persona]…"
payoff). The data-collecting questions and `congrats` (the finish/commit) stay.

- **Persona derive re-wired** (`onboarding-shell.tsx`): the experience-quiz plan derive used to run
  on entering `exp_reveal`. With that screen gone, the effect now fires the moment the 5 quiz
  answers are complete (deps `[state.experienceAxes]`), so removing the reveal doesn't break the
  derived plan (picks/refinements/feel/services). Still idempotent + re-derives if an answer changes.
- **`exp_source` CTA** relabeled "See my plan" → "Continue" (it no longer leads to a plan screen).
- New entry screen is the role question; the `welcome`-keyed code (moments animation, `data-welcome`)
  is now inert (guarded by `activeId === 'welcome'`, which never matches). Browser-verified: the flow
  opens on "Who are you in this wedding?" with no crash.

tsc 0 · `next lint` clean (one pre-existing, unrelated `authed`-dep warning). No schema/SKU change.

SPEC IMPACT iter 0016 (onboarding flow trim — reversible) → corpus DECISION_LOG + memory
`project_setnayan_experience_persona_onboarding`.
