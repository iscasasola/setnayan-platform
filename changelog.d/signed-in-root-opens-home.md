## 2026-11-23 · fix(home): a signed-in visit to setnayan.com opens Home

Owner, 23 Nov ("Yes, go to Home"): a person already signed in who opens `/` (setnayan.com, the installed app's start, the logo) now lands on Home by the same rule as a sign-in, `landingForAccount`: a host, guest or admin on Home `?hub=1`, a supplier or coordinator on Home's Shop. Signed-out visitors, a failed session read and an anonymous session still get the public front page, unchanged (same HTML, same metadata, canonical `/`).

Discover keeps its own door, `/?discover=1` (`DISCOVER_HREF`, `lib/discover-way-back.ts`). Every press that means Discover uses it: the account bar's Discover tab, the ☰ Discover row, "Back to Discover", "See more suppliers", "View on Discover", Discover's own Try again / Clear / ← Discover, Following off, clearing a search, and a bare `/explore`. `?q=` and Discover's filters still open Discover as before. The rule is `signedInRootLanding` (`lib/sign-in-landing.ts`); guard `lib/a-signed-in-visit-to-the-root-opens-home.test.ts`.

SPEC IMPACT: Closes the 22 Nov open call ("A SIGN-IN STARTS ON THE PROFILE PAGE"). The DECISION_LOG row 2026-11-23 "A signed-in visit to setnayan.com opens Home" already records it; no corpus edit needed.
