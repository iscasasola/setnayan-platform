## 2026-11-19 · feat(motion): the public front door's top bar tucks on scroll

The public `/` bar now tucks below 1024 like the app bar — the same Tuck reading (`useHideOnScroll`), the same speed
pair (`--sn-tuck-dur` / `--sn-tuck-ease`), `data-hidden` worn on the `<header>` itself because the public bar has no
sticky wrapper. Owner, 19 Nov 2026: *"Yes, tuck it"* — reverses the earlier "the front door's bar stays put" ruling.
Guard: `tuck-keeps-the-rows.test.ts` test 8 (sabotaged once: opting the front door out fails it).

SPEC IMPACT: DECISION_LOG row 2026-11-19 "public front door bar tucks" (supersedes the stays-put note).
