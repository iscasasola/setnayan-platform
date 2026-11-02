## 2026-10-04 · fix(security): safeNext refuses backslash and control-character paths; the native landing needs its own marker

Found by the independent audit of train #6333 (live on main at 839e8980).

**Open redirect.** `safeNext` only checked "starts with `/`, not `//`". The URL
parser reads a backslash as a slash and strips TAB/CR/LF, so
`new URL('/\\evil.com', origin)` and `new URL('/\t/evil.com', origin)` both
resolve to `https://evil.com/`. `/auth/callback` redirects to `next` even with
no `code`, so it was an open redirect that needed no sign-in.

- The one rule now lives in the pure `apps/web/lib/safe-next.ts`
  (`isSafeNext` / `safeNext(raw, fallback = '/')`). It has no `server-only`, so
  client code and the phone bridge can use it too. `lib/auth.ts` re-exports it,
  so existing `@/lib/auth` imports are unchanged. A path is accepted only when
  all of these hold:
  - it starts with exactly one `/`;
  - it has no backslash, control character or whitespace anywhere;
  - no encoded form decodes to `//`, a backslash or a control character
    (`/%5c`, `/%2f%2f`, `%0d%0a`, double-encoded);
  - `new URL(path, origin).origin === origin`.
- Every other hand-rolled `next` / `return_to` / `back` sanitiser now routes
  through that rule. A helper that also needs a narrower scope keeps its own
  prefix check on top of the rule:
  - chat-actions (7 sites);
  - notification-actions (2);
  - appointments-actions and negotiation-actions;
  - the guest-card `return_to` (2);
  - papic/buy `safeReturnTo`;
  - editor-return `isSafeInternalPath`;
  - sign-in-for-a-guest `eventSlugFromNext`;
  - the photo-challenge return path;
  - admin/work `back` (6 sites; this one had no check at all);
  - `/join/[eventId]/set-password` (a raw `?next=` reached a `<Link href>`);
  - desktop-oauth's final `location.assign`;
  - `appUrlToPath` (`setnayan:////evil.com` mapped to `//evil.com` inside the
    app).

**Native landing marker.** `/auth/callback?native=1` runs the landing's writes:
vendor promotion, the RSVP terms stamp and last-login. Before this change it
was gated only by "signed in within 5 minutes", so a crafted
`?native=1&as=vendor` link could trigger those writes. The landing is now
bound to a one-time marker:

1. After `signInWithIdToken`, the Apple sheet calls the server action
   `issueNativeLandingMarker` (`app/auth/native-marker-action.ts`). Next.js
   only accepts server-action calls from the same origin.
2. The action mints 32 random bytes and stores them in an httpOnly cookie
   (`sn_native_landing`, path `/auth/callback`, 5 min, SameSite=Lax). It
   returns the same value to the caller.
3. The app puts that value on the URL as `native_marker`.
4. The callback runs the landing only if the URL marker matches the cookie
   (constant-time compare). It clears the cookie on every native visit,
   whether or not the marker matched. Without a match it only redirects to
   `safeNext(next)` and writes nothing.

The 5-minute freshness check still applies on top.

Tests:
- `apps/web/lib/safe-next.test.ts`: the hostile and good path tables, the
  scoped helpers, and a check that no second sanitiser remains.
- `apps/web/app/auth/callback/the-callback-lands-only-where-it-should.test.ts`:
  runs the real GET handler with write-recording Supabase stubs.

SPEC IMPACT: None.
