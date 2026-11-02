## 2026-10-19 · fix(guest-pass): signed in, the account outranks a held guest pass

Owner bug, live on his own event: signed in as the groom, the guest Event Hub marked "Mrs. Milagros E. Buanhog · YOU"
in the entourage — the browser still held her 60-day guest pass from opening her personal link, and the page asked
the pass who was looking, never the account.

- ONE rule (`lib/pass-account-rule.ts`), applied inside the one reader every pass consumer calls (`readGuestSession`
  in `lib/guest-session.ts`; ~60 files — the event page, Me, the reply, plus-ones, the seat, Papic, the check-in pass,
  the gift page). Signed in, a held pass speaks for the viewer only when it is the account's own row
  (`event_members.guest_id`), or a row nobody holds for an account with no standing on that event (the
  "Save it to my account" claim), or after a HOST pressed "Open as <name>" (a session-only mark). A host holding
  another guest's pass, an account bound to a different row, and a row another account holds are SET ASIDE; an
  unreadable fact fails closed; a lapsed sign-in (4xx) is signed out, never a lockout. Signed out: unchanged.
- The page says so in one line — "This browser also holds <name>'s invitation. Viewing as you." — in Me, beside the
  reply's "Not you? Switch", and under the host's cover; a host gets "Open as <name>", everyone "Remove it from this
  browser" (that event's pass only). `/{slug}/open-as-pass` (POST) sets / clears the host's mark.
- A host's page marks the host's OWN guest row "You" in the entourage (none → no mark); never on the Maker canvas or
  a See as sample.
- "Remove it" and a host's preview never erase the guest's face-tagging selfie (only that guest's own sign-out does).
- Nothing is written to the database.

SPEC IMPACT: None (implements the controller's ruling from the owner's words; no corpus decision changed).
