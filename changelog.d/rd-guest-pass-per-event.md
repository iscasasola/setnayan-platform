## 2026-10-12 · fix(guest-pass): one guest pass per event — opening another event's link never evicts this one

A browser held ONE guest pass (`setnayan_guest_session`), so opening a second
event's personal link replaced the first event's pass, and a guest invited to
two events (wedding season; the owner's own desktop Safari on 2026-10-11,
reproduced exactly in WebKit) met the first event's stranger door once the
landing's 30-minute `?k=` code (#6480) was gone.

- `setnayan_guest_session` is unchanged — still the one active pass every reader
  reads, so a guest already holding it is not signed out by the deploy.
- New `setnayan_guest_passes` ("the pass book", `lib/guest-pass-book.ts`): one
  signed cookie (same seal) holding up to 8 passes, one per event, oldest out
  (~1.7 KB at the cap). Every pass write (`setGuestSession`) puts the new pass in
  it and moves the pass it replaces — a legacy single cookie too — into it.
- `middleware.ts` makes this event's pass the active one on `/{slug}/…`,
  `/u/{user}/{slug}/…` and `/join/{eventId}/…` (request always; response only on a
  plain read — one writer per hop). `readGuestSession({ eventId })` also finds an
  event's pass in the book by event id (rename-proof), DB-checked as before.
- Sign-out on one event (`/{slug}/sign-out`, the plus-one's "not me") removes
  THAT event's pass only; `/auth/sign-out` removes the pass and the book, and
  erases the face-tagging selfie for every pass held.
- Evidence: the Reply's re-key / door now writes one Problems-log row
  (`guest-pass-hop#reply:rekey` / `#reply:door`) with what the browser held —
  none · other-event · revoked — and the book's pass count. No new table.

Guard: `apps/web/lib/a-guest-keeps-a-pass-per-event.test.ts`.

SPEC IMPACT: None (guest-pass mechanics; no product rule changes — the
"one pass per event" behaviour is what the guest pathway already assumed).
