## 2026-11-22 · fix(auth): a sign-in with no destination starts on the person's profile page, Home — never Discover

Owner, 22 Nov, verbatim: *"when i log in. don't start on discovery. start on their profile page"*.

The profile page is Home (DECISION_LOG 2026-11-11 "ONE PROFILE PAGE v2 APPROVED: IT IS CALLED HOME" and "HOME PAGE v3
APPROVED" — a supplier's Home opens on Shop). A sign-in that names no destination of its own (`next` = `/`) now lands:

- a host, guest or admin on **Home** — `/dashboard?hub=1` (`?hub=1` so the board's single-event auto-jump and its
  empty-console bounce never carry them off it);
- a supplier — and a coordinator, which is a supplier account — on **Home's Shop section**, `/dashboard?seg=shop`.

**One rule:** `landingForAccount` (`lib/auth-confirm-link.ts`). `signInDestination` (`lib/sign-in-landing.ts`) now
delegates to it, so every door answers the same:

- **password, whole page** (`/login`) — reads `users.account_type` only for a `/` sign-in and passes it to the rule;
- **password, in place** (the Sign in panel) — this was the owner's path: the shell's Sign in link opened the panel with
  no `onSignedIn`, so a sign-in from the front door *refreshed* `/`, which is Discover. `signInInPlace` now hands back
  `landing` when `next` was `/`; the panel goes there. On every other page the panel still only refreshes (a
  half-written enquiry is kept);
- **Google / Apple / magic link** (`/auth/callback`) — the `/` landing now applies to every account type, not only a
  supplier;
- **the any-device email link** (`/auth/confirm`) — a non-supplier used to stay on `/`; now Home.

An explicit `?next=` is honoured exactly, for every account type and every door.

W1-B25 (16 Nov) sent a supplier's email link to `/vendor-dashboard`; it now goes to Home on Shop, which keeps W1-B25's
point (the Shop section never runs the Events board) and is the profile page the ruling names. "Open the Shop
dashboard" is one tap from there.

Guard: `lib/a-sign-in-starts-on-the-profile-page.test.ts` (each door with no `next` × customer / admin / unknown /
supplier, and a named `next` honoured). Sabotage, each RED then restored: the rule leaving a customer on `/` (2 fail);
the callback condition put back to vendors only (1 fail). Updated to the new address: `lib/sign-in-landing.test.ts`,
`lib/signup-landing.test.ts`, `lib/the-confirm-link-works-on-any-device.test.ts`, and the panel's "refresh, never
push" guard in `app/_components/auth/seam-invariants.test.ts`, which now allows exactly one push — to the handed
`landing` — and nothing else.

Not changed (open question for the owner): the app **opening already signed in** on `/` still shows Discover.

SPEC IMPACT: DECISION_LOG row 2026-11-22 "A SIGN-IN STARTS ON THE PROFILE PAGE" (corpus `DECISION_LOG.md`).
