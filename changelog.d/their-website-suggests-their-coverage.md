## 2026-08-28 · feat(vendor-onboarding): a shop's own website can suggest its coverage (C5)

Owner + DPO ruling 2026-08-28 (*"C5 yes"*) authorised Setnayan to read a
shop's own public website, once, for free, on our own initiative, to
**suggest** coverage categories the shop then confirms — no automatic
application. Ships behind `VENDOR_SIGNUP_COVERAGE_SUGGEST_ENABLED`, default
**off**; the owner flips it (it costs a real model call per shop, since
`vendor_web_dossiers` held zero rows before this change — there is nothing to
reuse).

- The first time a shop saves its own website (My Shop → Business Profile →
  "Your line and your link"), a best-effort, fire-and-forget read runs via
  the existing Deep Search engine (`lib/vendor-deep-search.ts`), tagged
  `kind = 'signup_suggestion'` in `vendor_web_dossiers` so it is never
  confused with — or charged against — a vendor's own paid/free-cycle Deep
  Search run.
- What it finds is turned into real trades via C1's search ranker
  (`taxonomy-search-rank.ts`) and C2's reviewed alias list
  (`service-trade-aliases-db.ts`) — no new matcher, no invented confidence
  floor.
- A new "Your website suggests you also do…" card on My Shop shows the
  matches as unticked chips; nothing is added to the shop's coverage unless
  the owner ticks and presses Add, re-validated server-side against the
  shop's own open suggestion. "Not now" dismisses without changing anything.
- The website field carries an on-screen disclosure caption
  ("Setnayan reads it once, for free…") independent of the flag, and
  `/privacy` gained a "Free coverage suggestion at sign-up" paragraph with
  its own legitimate-interest lawful basis — shipped in this same PR, per the
  ruling's first condition (declare before you perform).
- Fails silent and optional throughout: no key, no website, no flag, a
  network miss, a bad shape → the shop's save behaves exactly as before.

New migration `20271178345010_signup_coverage_suggestion_kind.sql` adds
`vendor_web_dossiers.kind` (`'lookup' | 'signup_suggestion'`, default
`'lookup'` — every existing row and every existing writer is unaffected) and
`vendor_web_dossiers.suggestion_dismissed_at`.

SPEC IMPACT: the spec corpus's DECISION_LOG gains a row for the ruling and
its three conditions (already logged 2026-08-28); the code repo's own
`app/(shell)/privacy/page.tsx` is the canonical text — no other doc mirrors
the /privacy wording.
