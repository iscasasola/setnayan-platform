## 2026-08-08 · design: GOLD is the action colour — owner override of the handoff

**Owner ruling, verbatim:** *"stick to gold to all first."*

This **reverses** the Warm Editorial handoff's own non-negotiable (*"Terracotta
`#C24E25` is the ONLY action color… Gold is never a button"*). The handoff's rule was
followed earlier the same day; it is now superseded by the owner.

**Reverted:** the six action pills on the couple's event dashboard, converted to
terracotta in PR #4241, are back to gold. On this axis the page is where it started.

**Recorded so the two cannot disagree:** a new `ACTION_COLOUR_OVERRIDE_2026-08-08.md`
states the rule, and **all seven** documents in the design folder now carry a banner
pointing at it — README, the four Fable specs, the integration rules and the verified
delta. Every one of them asserted the opposite in its own text, and a rule stated in
one file and contradicted in six others is this project's most reliable way to lose a
decision.

⚠ **NOT done, and it needs an explicit call:** the app holds ~115 gold action sites
**and 783 terracotta ones** (`bg-mulberry`, across 238 files). Read literally, "gold to
all" means repainting those 783 — nearly every screen, in the opposite direction from
the design bundle, and far beyond the 115 that prompted the question. With the owner's
*"for now"* reading as provisional, the conservative half was done instead: stop
converting gold away, revert what was converted, record the rule. **Whether the 783
also become gold is flagged as an open owner decision.**

🪤 **The naming trap now bites the other way.** `--color-terracotta` holds **GOLD**;
`--color-mulberry` holds the rust. Under this ruling `bg-terracotta` — the
confusingly-named class — is now the *correct* class for a button, and `bg-mulberry` is
the one to avoid. Do not rename it casually: 690 files reference it.

Typecheck clean · all 12 `lint-*.mjs` clean · 7085/7085 tests green.

SPEC IMPACT: Yes — applied in the same commit to the corpus design folder.
