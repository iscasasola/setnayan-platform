## 2026-09-18 · fix(web): a page whose stylesheet failed to load reloads once instead of showing raw HTML

The owner saw `/vendor-dashboard` render with no styles at all (serif default
font, screen-reader copy printed beside visible copy: "SearchSearch events…",
"What's new2"). A failed `<link rel="stylesheet">` throws into no error
boundary, so the existing stale-script rescue (`lib/stale-bundle.ts`) never ran.

**Cause: not established.** Deployment skew was the leading hypothesis and is
refuted. Skew Protection is ON (`skewProtectionMaxAge` 43200, from the Vercel
project API). Every CSS href carries `?dpl=`, and an old `dpl` was measured
routing to that deployment's own files. Vercel runtime logs carry no CDN static
requests, so the failed request itself is invisible. The candidate is
`public/sw.js`, which answers every stylesheet request and is replaced on every
deploy. That is a candidate, not a finding.

- `lib/stylesheet-recovery.ts`: an inline `<head>` script. If one of OUR
  sheets (`/_next/static/css/`) failed, it reloads ONCE (sessionStorage marker,
  cleared on a good load). A second failure in a row shows an inline-styled
  "did not finish loading · Reload" bar instead of looping. Measured in
  Chromium: a 404 sheet still HAS a `sheet` object, and reading its `cssRules`
  throws, so a throw counts as failed.
- `DeferredObservability` sends the recorded failure (href, whether a service
  worker controlled the page, path) to Sentry on the next good load. The next
  occurrence will say why.
- Guard: `lib/stylesheet-recovery.test.ts` EXECUTES the script in a fake DOM
  (9 cases, each sabotage-checked red), and pins the one `<head>` mount.

SPEC IMPACT: None.

### Also: `main`'s red unit test, fixed in the same PR
`lib/answers-desk.test.ts` › "song_request stays withheld only while its cited
defect is real" was failing on `main`. #5601 gave the song-request RPCs their
first application callers (`app/[slug]/_components/song-request-card.tsx`,
`app/api/song-requests/route.ts`), which made the withheld row's reason ("zero
application callers") false. The test's own message says to update the row
then. Following the SUP-53/58 precedent (56a271286), the row is dropped, the
floor tracks the list (2 → 1), and the song-request-only check is retired
because its subject is gone. `payment_claim` stays withheld; its reason is an
owner decision.
