## 2026-08-13 · fix(routing): a signed-in visitor may see the front door

Owner, after the sign-in destination had already been fixed: *"still directed here"*.
He was right, and #4424 could never have been enough.

`middleware.ts` carried `if (user && pathname === '/') redirect('/dashboard')`. So
#4424 fixed where a SIGN-IN sends you, and the middleware sent you away again on the
very next request — and on **every later visit to `/` for as long as you stayed
signed in**. A member could not see the front door at all, ever.

**IT ALSO MADE FINISHED WORK UNREACHABLE.** `front-door-shell.tsx` carries four
`account.signedIn` branches — My Home with Events + Alaala, the Marketplace group,
the account cluster. None could ever render. They shipped dead.

🔑 **ITS JUSTIFICATION HAD ALREADY EXPIRED.** The comment says the redirect lives in
middleware so `/` can "stay fully static … edge-cache speed", written when `/` was
the marketing homepage that "does not read the session at all". `app/page.tsx` now
states the opposite about itself: `cookies()` is reached inside `<FrontDoor>`, and
"with the flag on, this route renders per-request". The flag is on. The redirect was
protecting a static render that no longer exists — costing the seam and buying
nothing.

⏭ The performance follow-up `app/page.tsx` already names is now the real lever: if
per-request rendering proves expensive under traffic, cache the feed reads behind
`unstable_cache` so only the session lookup stays per-request. A caching decision —
not a reason to eject members from the page.

**TWO LAYERS, ONE SYMPTOM.** This is the second half of a fault whose first half was
fixed hours earlier, and the report in between was "still directed here". A redirect
in the page layer and a redirect in the middleware layer look identical to the person
being redirected. Checking one and reporting the other absent is how this took two
passes.

GUARD: `app/_components/frontdoor/signed-in-can-see-it.test.ts` — three assertions:
middleware does not bounce an authenticated request off `/`, it does not send `/` to
`/dashboard`, and the front door still HAS a signed-in state worth reaching (≥3
branches, so the guard notices if the reason for the removal is dismantled).
Comment-stripped, because the note explaining the removal quotes the redirect it
removed. Mutation-tested with the sabotage MEASURED: putting the bounce back took its
occurrence 1 → 2 (the 1 being the explanatory comment, correctly ignored) and turned
the guard red. Restored 3/3. Neighbouring suites 29/29.

SPEC IMPACT: None.
