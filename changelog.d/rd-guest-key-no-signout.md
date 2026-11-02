## 2026-10-25 · fix(guest-session): setting GUEST_SESSION_SECRET signs nobody out · a lapsed guest gets back in from "Save my ticket"

**Part 1 — the key change no longer signs every guest out.** Production has no dedicated `GUEST_SESSION_SECRET`, so
every live guest cookie is sealed with `SUPABASE_SERVICE_ROLE_KEY`; setting the dedicated key used to fail all of
them at once. Now (`lib/guest-session.ts`):

- SIGN only with the dedicated key when present (unchanged: `resolveGuestSessionSecret`).
- VERIFY with the dedicated key first, then the service-role key as a LEGACY verifier
  (`resolveGuestSessionVerifiers`) — the active pass, the pass book, and `verifyGuestSessionToken` (middleware,
  live-pulse). With no dedicated key there is exactly one verifier: behaviour unchanged.
- RE-ISSUE: a pass or pass book only the legacy seal accepted is re-signed with the dedicated key (same payload, same
  expiry) on the same response by the middleware's existing refresh, now the pure `guestPassRefreshFor`.
- Fail-closed rules kept for both seals (blank / whitespace / too-short read as absent; a too-short dedicated key still
  refuses rather than falling back). Which seal verified is logged by NAME only.
- The other seal-keyed tokens with a life over a day also accept the legacy seal on verify, so setting the key does not
  unpair a live screen (30-day cookie), blank a venue wall (1 day), or strand a queued Papic shot
  (`guestSessionVerifyMaterials`).
- Retirement condition written into the docblock: 60 days (`COOKIE_MAX_AGE_SECONDS`) + 1 day after the first
  production deploy carrying `GUEST_SESSION_SECRET`, AND the log line `[guest-session] re-sealed a guest pass` has
  stopped. Not removed now.

**Part 2 — owner 2026-10-25, verbatim: "A button we can offer when they try to save the digital pass."** (and: "After
they have rsvped and opens the event hub."). When "Save my ticket" meets `/api/guest/pass-card`'s 401 (no guest pass on
the phone any more), `SavePassCardButton` now draws ONE button, "Get back in", to the page's own signed-out door (the
Event Hub's existing "Confirm your Booking · Upload your QR · Sign in"), with one short line and the detail in the ⓘ —
instead of the line "Open your invitation link first." under a Save that could do nothing. Every surface that saves a
ticket uses this component, Me's ticket included. No new sign-in method.

Guards: `lib/setting-the-guest-key-signs-nobody-out.test.ts`,
`app/_components/a-lapsed-guest-gets-back-in-from-the-save.test.ts` (each broken on purpose once).
`lib/guest-pass-hop.test.ts` § 3 and `lib/a-guest-keeps-a-pass-per-event.test.ts` § 7 now follow the refresh into
`guestPassRefreshFor`.

SPEC IMPACT: `DECISION_LOG.md` row (corpus) — the owner's 2026-10-25 ruling on the save-pass re-entry button, and the
no-sign-out key rotation with its retirement condition.
