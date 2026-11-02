## 2026-08-13 · fix(auth): a cold sign-in returns you to the front door

Owner, having signed in and landed in the ops console: *"i thought that once we log
in, it still looks like the public website, but we have added sidebar"* — which is
what the approved drawing shows, and what the in-place panel already does.

The IN-PLACE seam was already right: the front door's Sign-in opens
`useSignInPanel` over the page and `router.refresh()`es rather than navigating, so a
half-written enquiry stays in its box. **Session 6 is untouched.**

THE WHOLE-PAGE DOORS WERE NOT. Both rewrote an absent-or-`/` destination to
`/dashboard` and then handed it to `accountHomePath()` — vendor →
`/vendor-dashboard`, admin → `/admin`, else `/dashboard`. So every cold sign-in
ignored where you came from, and an admin never saw the front door's signed-in
state at all.

THE RULE WAS RIGHT AND ITS PREMISE EXPIRED. Its own comment says it existed to
avoid "the double-hop where vendors landed on /dashboard then got bounced to
/vendor-dashboard". True while `/` was the ELN cinematic homepage, which had
nothing for a signed-in person. `/` became the front door on 2026-08-13 and now
carries four `account.signedIn` branches — My Home with Events + Alaala, the
Marketplace group, the account cluster — and nothing redirects a signed-in visitor
away from it. The double-hop cannot return: `/` is a destination, not a redirect
chain, and `dashboard/layout.tsx` still owns the vendor bounce for anyone who
genuinely lands on `/dashboard`.

⚠ BROADER THAN "FROM THE FRONT DOOR", STATED PLAINLY: `safeNext()` collapses an
absent or unsafe `next` to `/`, so this also changes a sign-in with no destination
at all. That is deliberate — the front door is now everyone's landing place and it
carries their own sidebar — but it is a wider change than the report that prompted
it, and worth knowing.

FIXED IN BOTH DOORS. `app/auth/callback/route.ts` carried the identical line;
changing one would leave Google sign-in disagreeing with password sign-in — the
"two answers to one question" failure this repo already paid for when the wizard
previewed a safe address while the mint handed out a colliding one.

`accountHomePath()` is NOT retired — callers that genuinely want an account home
still use it, and `lib/account-security.test.ts` (11/11) still pins its mapping.

GUARD: `app/_components/auth/sign-in-destination.test.ts` — 4 assertions holding the
shape (neither door rewrites `/`, neither picks by account type, and the two agree),
plus a non-triviality check so a mis-pointed walk cannot scan nothing and pass.
Mutation-tested with the sabotage MEASURED BY COUNT, not assumed: restoring the
rewrite took its occurrence 0 → 1 and turned the guard red; putting
`accountHomePath` back in the OAuth door alone took its count 1 → 2 and tripped both
the account-type assertion and the doors-agree assertion. Restored: 4/4.

⏭ NOT DECIDED HERE, and it is the owner's: whether an admin should ever be
auto-sent to HQ. This makes `next` win everywhere; it does not rule on what an
admin with no destination should get.

SPEC IMPACT: None.
