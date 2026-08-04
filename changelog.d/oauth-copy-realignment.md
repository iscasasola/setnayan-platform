## 2026-07-27 · fix(compliance): realign every public surface to what the app actually does with YouTube data

Prepares the Google OAuth verification resubmission, and fixes several claims that were
simply untrue. Two adversarial review rounds; each found real defects, and the second
found a privacy defect in the CODE rather than the copy.

**The claim that mattered most was inside the product.** The Live Studio setup page —
the screen a Google reviewer lands on to test the connection, and one a demo video must
pass through — told the user *"Scopes requested: YouTube manage **+ upload**"*. The app
requests exactly one scope, `auth/youtube`; upload was dropped in #3708 and this UI was
never updated. A product screen claiming a scope the consent screen won't show is a
direct contradiction in front of the reviewer.

**A privacy defect, fixed in code rather than written around.** `api/oauth/youtube/disconnect`
wrote `revoked_at` **alone**, leaving the couple's plaintext Google refresh token in
`oauth_grants` indefinitely after they pressed Disconnect. Nothing would use it again —
every reader early-returns on `revoked_at` — but "we stopped using it" is not "we no
longer hold it". The pool side already wiped its credential
(`live-studio-channel-grants.ts`); BYO now matches it exactly. This is what lets the
privacy policy say what it says.

**The tense problem.** The first draft fixed the "couple's own channel" mismatch by
asserting the Setnayan pool instead — but prod has **0 pool channels, 0 pool grants, 0
broadcasts ever**, and the only YouTube grant that ever existed is revoked. So BYO is the
only path that has *ever* run. Every channel sentence is now a conditional on how the
event is set up, true today and true after the pool ships, with no rewrite in between.

**Other corrections, each grounded in code:**
- `/privacy` claimed Setnayan "push[es] the selected camera feed to YouTube's ingest
  endpoint". It sends no video bytes at all — the couple's own encoder does.
- `/privacy` called the broadcast "public". Every broadcast is created **unlisted**.
- `/privacy` declared `userinfo.email` + `userinfo.profile`, which are never requested.
  The page's own comment states the rule it was breaking.
- `/privacy` scoped YouTube to couples who "purchase a Live Studio SKU" — single-camera
  go-live is free for any host, with no paywall.
- "the only permission Google offers" → **narrowest**. `force-ssl` and `youtubepartner`
  also authorise these methods; both are wider, not narrower.
- The Meta paragraph said "Setnayan holds no Meta credentials", contradicting the same
  policy 400 lines above (Setnayan does hold one, for its own marketing pages).
- **`/terms` had ZERO YouTube references** — a live YouTube Developer Policies III.A
  breach. It now binds users to the YouTube Terms of Service and the Google Privacy Policy.
- The features page carried "your own YouTube channel" in **English and Tagalog**.
- The features page also promised "overlays routed to every screen at the venue".
  Venue-screen playout is **not built** — `panood-screens.ts` writes `current_source` and
  nothing renders it. The product's own camera page already says so ("Routing a feed to a
  screen at the venue isn't connected yet"); only the marketing page disagreed.

20 surfaces across 10 files. 4240/4240 unit green, typecheck + lint + production build
pass. No migration.

⚠ **Ships as a DRAFT.** Public legal + marketing copy — the owner reads it before it goes
live, same as #3703.

⏭ **Not in this PR, owner's call:** whether to pursue External verification at all. If the
Cloud Identity Free → Internal path works, brand and sensitive-scope review are skipped
entirely — but every correction here is required regardless, because the copy was wrong
about the product independently of Google.

SPEC IMPACT: `DECISION_LOG.md` 2026-07-27 records the realignment and the disconnect fix.
