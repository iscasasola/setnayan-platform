## 2026-08-09 · fix(public): the homepage says "Setnayan", and one page explains what connecting Google does

Google refused OAuth brand verification on 2026-07-25 on two counts. The "explain
the purpose of your app" half was answered by the `#what-is-setnayan` block. The
NAME half was still failing on 2026-08-09, measured against the live HTML:

- **The top of `/` showed only the glyph.** The nav button rendered
  `aria-label="Home"` with an `aria-hidden` mark inside it, so the title-case
  string "Setnayan" appeared nowhere above the fold — not to a reviewer, not to a
  screen reader, not to a first-time visitor. A visible `hr-wordmark` now sits in
  the logo pill (glyph-only below 700px, where the six nav links already fill the
  bar).
- **`og:site_name` was missing from `/` and present on every other page.** The
  homepage's `metadata.openGraph` override was a three-key object, and Next
  *replaces* `openGraph` wholesale rather than merging it
  (`next/dist/lib/metadata/resolve-metadata.js`, `case 'openGraph':`). That
  silently deleted the layout's `siteName`, `type`, `locale` and the 1200×630
  `og:image`; `twitter:card` had degraded to the tiny `summary` thumbnail because
  Next's auto-fill could no longer see a large image. Both overrides are now
  complete, and `applicationName: 'Setnayan'` is restated on the page itself so a
  layout edit cannot remove it from the reviewer-facing URL.

New public page **`/privacy/google-access`** — a short, factual summary of the two
optional Google connections: YouTube (`.../auth/youtube`) to set up an unlisted
live broadcast, Drive (`.../auth/drive.file`) so photos land in a folder the
couple owns, and the fact that Setnayan only ever touches files it created. Both
grants were already disclosed in full on `/privacy`, but that page is ~1,900 lines
and neither grant had its own URL, so there was nothing to submit except "scroll".
The page links into `/privacy` rather than restating it, so the two cannot drift.

**Guards (mutation-tested, 10 sabotages, all red):**
`app/home-brand-name.test.ts` fails if the wordmark disappears, is lower/upper-cased
away from the consent-screen name, is commented out, or if the homepage override
drops `siteName` / `applicationName` / `summary_large_image` / the brand card.
`app/privacy/google-access/google-access.test.ts` reads the real
`*_OAUTH_SCOPES` declarations and fails if the page names a scope the code does
not request, omits one it does, or loses the "we never send the video" and
"only files Setnayan created" claims. Both strip comments before asserting — the
source now carries long explanations containing the exact strings being checked.

SPEC IMPACT: None. No scope, price, product or policy changed — `/privacy/google-access`
summarises disclosures already live on `/privacy`, and both Google scopes are
unchanged (`auth/youtube`, `auth/drive.file`).
