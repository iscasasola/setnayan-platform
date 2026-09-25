## 2026-09-25 · fix(event-hub): the arrive-once script parses — the first-visit motion finally runs

`ArrivalOnce()` (`app/[slug]/_components/pahina-motion.tsx`) builds its de-dupe
key inside a JS template literal with `location.pathname.replace(/\/+$/,'')`.
A template literal treats `\/` as an unrecognised escape and drops the
backslash, so the text actually sent to the browser was
`replace(//+$/,'')` — and `//` opens a line comment that swallows the rest of
the statement, including the following `var`. Every guest page threw
`SyntaxError: Unexpected token 'var'` on load (measured 2026-09-25 with
Playwright against a local dev server, and confirmed with `node --check` on
the extracted inline script) and the "arrive once" first-visit motion
(`.sn-arrive`) never ran anywhere, for anyone. It failed visibly (a console
error on every load) rather than silently, but the feature itself was dead.

Fixed by escaping the backslash for the template literal (`/\\/+$/`), so the
emitted JS is `/\/+$/` — matching `arrivalSeenKey()` in `lib/motion.ts` exactly,
as the existing key-string guard always assumed it did.

Added a render-based parse test to `lib/the-hub-moves-with-meaning.test.ts`:
it renders EVERY script-emitting export of `pahina-motion.tsx`
(`ArrivalOnce`, `PahinaMotionRootFlag`, `PahinaCoverParallax`,
`PahinaMotionObserver` — not only `ArrivalOnce`) with `react-dom/server`,
pulls each `<script>` body out of the markup, and asserts
`new Function(scriptText)` does not throw for any of them. The existing test
in that file already asserted the key-building substring was present, which
is true either way — only asking a JS engine to parse the emitted text
catches a backslash swallowed by the outer template literal. Probed in both
directions, twice: reintroducing the bare `/\/+$/` sabotage in `ArrivalOnce`
turns the test red with the exact `Unexpected token 'var'` error measured
live; separately breaking `PahinaMotionRootFlag`'s script (an unrelated
syntax error, to prove the loop actually covers every export and doesn't just
coincidentally pass for the other three) also turns it red. Restoring either
turns it green again.

Swept every other `dangerouslySetInnerHTML={{ __html: \`...\` }}` inline
script in `apps/web` for the same backslash-escaping mistake
(`theme-bootstrap-script.tsx`, `lib/stylesheet-recovery.ts`,
`guest-hub-card.tsx`, `magic-move.tsx`, `rsvp-sheet.tsx`'s `JS_FLAG`) — none of
the others have it; the two that build a regex inside their template literal
(`bootSplashScript` in `app/layout.tsx`, `stylesheetRecoveryScript`) already
double-escape correctly (`\\/` and `\\s`). Within `pahina-motion.tsx` itself,
`ArrivalOnce`'s de-dupe key was the ONLY regex/backslash construction in the
file — `PahinaMotionRootFlag`, `PahinaCoverParallax` and
`PahinaMotionObserver` never built one, so there was nothing else to fix
there; the new parse test now guards all three anyway.

Checked live against a local dev server (fake-Supabase harness, `/ana-ben`
fixture): the fixed page loads with no console `pageerror`s and the server
returns 200 — confirming the crash the owner measured with Playwright is
gone. The full first-load → 3s expiry → second-load → reduced-motion sequence
could not be walked interactively this session: the shared dev machine had
several other sessions' builds/typechecks running concurrently and the first
compile of `/[slug]` (9,317 modules) took over 10 minutes, after which the
browser tool's own tabs were repeatedly reclaimed by other concurrent
sessions before a full pass completed. That sequence is otherwise covered
deterministically by the unit test above (which executes the real shipped
script's logic) and by `shouldPlayArrival`'s existing coverage in the same
test file for the reduced-motion and seen-before cases.

SPEC IMPACT: None.
