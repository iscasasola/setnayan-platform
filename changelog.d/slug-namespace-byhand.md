## 2026-08-10 · fix(slugs): every path that hands out an address asks all four registries

Done by hand, after the automated repair (#4288) was found to make one thing
worse than the bug. Four defects, each verified against `main` first.

### 1 · Creating a wedding asked two of four

`isSlugTaken` queried `events` and the forwarding ledger — not
`vendor_profiles.business_slug`, not `users.slug` — while `findSlugConflict`,
in the file beside it, asked all four. Every event-creation call site reaches it
through `generateUniqueSlug`.

Because `app/[slug]/page.tsx` resolves the EVENT first and only then falls
through to `renderVendorBySlug`, a wedding auto-minted onto a live shop's
address **silently took over that shop's public page** — a page that is in our
sitemap. Now one line: `findSlugConflict(...) !== null`.

### 2 · A failed read said the word was free

`const { data } = await admin.from('events')…` discarded `error`. Supabase
resolves `{ error }` rather than throwing, so an unreadable table returned
`data: null` and the word read as **free** — the only direction that hands out an
address somebody owns. `findSlugConflict` fails closed on every probe.

### 3 · Shop and person renames each asked one

`parseVendorSlug` and `updateUserSlug` checked shape + reserved + their own
table. A shop could take `bb-gandang-hari` — **the one address actually
forwarding in production today** — sending every printed invitation carrying it
to a stranger's business page. Both now call the shared check with their own id
excluded. The vendor read that decides that exclusion also had its `error`
discarded; a failure there told a Pro vendor their own address belonged to
someone else.

### 4 · A wedding rename reported success having changed nothing

The update ran on the CALLER's client, and under RLS a statement matching **zero
rows returns no error**. The action then wrote a 90-day forwarding row for a
rename that never happened and redirected `?slug_saved=1`. Now it selects back
and refuses when nothing changed.

### ⚠ What this deliberately does NOT do

The automated repair raised a new error from `generateUniqueSlug` that **nothing
catches** — all five callers `await` it bare, two returning `{ok:false,error}`
their wizard renders and three redirecting with `?error=`. In production Next
redacts the message, so a failed read of any of three unrelated tables would have
**hard-crashed the entire event-creation funnel** where it used to degrade.

This version bails out of the retry loop on `unverified` and returns a
high-entropy address instead: 4 reads rather than 400, no crash, and a couple who
can rename later. A couple with an ugly address has somewhere to go; a couple who
cannot create their wedding does not.

### 🪤 My own guard was decorative on the first pass

`assert.match(src, /findSlugConflict\(/)` also matches
`DISABLED_findSlugConflict(`. I sabotaged the shop path by renaming the symbol
and the test **stayed green**. It now requires a word-boundaried call whose
result is bound to a name and branched on — so "keep the call, discard the
answer", the sabotage that beat two generations of the run-of-show guard, fails
here too.

| sabotage | result |
|---|---|
| create path back to events-only | ❌ 4 fail |
| treat an unreadable namespace as free | ❌ 1 fail |
| shop rename: rename the symbol | ❌ 1 fail |
| shop rename: keep the call, discard the result | ❌ 1 fail |
| person rename: rename the symbol | ❌ 1 fail |
| wedding rename: stop selecting back | ❌ 1 fail |
| remove the unverified bail-out | ❌ 1 fail |
| baseline | ✅ 9/9 |

### Verified

7270 / 7270 unit tests · `tsc --noEmit` clean · 19 lint scripts pass.

SPEC IMPACT: supersedes PR #4288, which should be closed.
