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

## 2026-11-22 · fix(auth): the phone app's Google sign-in sheet names setnayan.com, not the database address

Owner screenshot, iPhone app: the sheet read *"Setnayan" Wants to Use "njrupjnvkjkitfctetvi.supabase.co" to Sign In* —
a raw database address at the front door of sign-up. iOS's `ASWebAuthenticationSession` names the host of the FIRST
URL, and `lib/native-oauth.ts` handed `SetnayanAuth.openAuthSession` the Supabase authorize URL.

- **New route `/auth/go`** (`app/auth/go/route.ts`): answers 302 to `https://<ref>.supabase.co/auth/v1/authorize`
  with the query it was given, or 400. The target is built ONLY from `NEXT_PUBLIC_SUPABASE_URL`, and only when that is
  exactly `https://<ref>.supabase.co` (no port, no userinfo). The route never reads a host or path from the request,
  so no query can move it — not an open redirect (`lib/oauth-front-door.ts`).
- **The app opens `www.setnayan.com/auth/go?…`** instead of the raw URL. If the authorize URL is not this project's,
  it refuses — it never falls back to the raw one. Android's Custom Tab uses the same `systemBrowser` call.
- **PKCE unchanged:** the verifier stays in the app web view's cookies where `signInWithOAuth` stored it; the hop
  carries `code_challenge`, `code_challenge_method` and `redirect_to` through unchanged (tested).
- **No app rebuild:** the URL is built in the web bundle, which the app loads from www.setnayan.com
  (`apps/mobile/capacitor.config.ts`, remote-URL pattern). No paid Supabase custom domain.

Guard: `lib/a-phone-sign-in-opens-on-our-address.test.ts`. Sabotage, each RED then restored: a lookalike host
accepted (`/supabase\.co$/`); `openAuthSession` back to `url: data.url`. Updated: `lib/native-sign-in.test.ts` test 4
(the URL is now `frontDoor`); `app/open-shop/the-approved-redesign.test.ts` (the shared panel's only push is to the
handed `landing`).

⚠ **Not tested on a real iPhone or Android phone** (no device here): that the sheet now reads "setnayan.com", and
that Google sign-in completes end to end through the 302. Both need one tap on a phone after deploy.

SPEC IMPACT: same DECISION_LOG row 2026-11-22 (addendum line "THE PHONE SIGN-IN SHEET NAMES SETNAYAN.COM").
