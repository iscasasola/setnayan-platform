## 2026-09-30 · fix(guests): a seat becomes an account's only on purpose — and the couple can unlink a wrong one

**Incident (owner's own wedding, event cale-ice).** A test account (testnayan4)
found the wedding on its Home board as an invited guest, bound to the GROOM's
guest row. Owner: "he is not the groom". Mechanism: the groom row's personal key
had been opened on a device (`?invite=` sets the 60-day `setnayan_guest_session`
cookie); account sign-out cleared only `sb-*` cookies; the next plain LOGIN ran
`linkGuestSessionToUser`, which bound whatever seat the cookie named — no
question, no role check, and the groom row is always "free" because the
creator's own couple membership carries no `guest_id`. Knock-ons: the seat name
was copied to the account, `link_guest_to_account_person` re-pointed the groom
row's `person_id` at the wrong person, so `is_event_celebrant` counted them and
the guest card's Access control stopped recognising the creator's own row.

What changed (rules in `apps/web/lib/seat-binding.ts`):

1. **Binding only on purpose.** `app/login/actions.ts` and
   `app/signup/actions.ts` (both branches) no longer call
   `linkGuestSessionToUser`. A seat is bound only by an act on its own page:
   "Save to my account" (`linkThisSeatAction`, whose button now reads "This
   invitation is for <name>. Save it to <email>?"), or the `/join/{id}/connect`
   return — which now binds NOTHING itself and sends any new binding to the new
   `/join/{id}/connect/confirm` page ("Yes, save it" · "Not me"). The binder is
   also told WHICH event (a pass for another celebration binds nothing — the old
   binder linked whatever event the cookie named). The owner's guest pathway
   (RSVP → thank-you → Save to my account → Apple/Google/email → connect) still
   works, with one confirm tap.
2. **Sign-out clears the guest pass** (`app/auth/sign-out/route.ts`), plus the
   RSVP Terms tick and the link-sent marker — that person's, not the next one's.
3. **Couple seats are never bound by a guest link.** Bride · groom · celebrant
   (primary or extra role) refuse any account that is not already a couple
   member — in the cookie binder, the connect step, the join door's email fast
   path, and the couple's own Link on a request. The one exception is the link
   the COUPLE sends from that row's guest card (`inviteGuestByEmailAction`),
   whose return carries a signed approval (`lib/seat-link-approval.ts`) — so a
   partner who did not create the event can still keep their own row and become
   Co-host from the guest list. Couple seats are no longer offered as a "Same as
   …" suggestion (`suggestRequestMatch`) or in the Link picker
   (`unlinkedCandidates`).
4. **A safe Unlink door** on the guest card (couple rows included): "This
   invitation is linked to <account> — Unlink". Rides `releaseGuestClaim`
   (`unlink_account`, +0 server actions) into `lib/seat-unlink.ts`: rotates the
   key FIRST (abort on failure), deletes ONLY the one `event_members` row (this
   event · that account · `member_type 'guest'` · this guest_id), resets
   `person_id`/`email` only where they were that account's (re-sending a kept
   email so `set_guest_person` re-derives the creator's person), and closes
   that account's `guest_claims` row. A row held as a live Co-host/helper is
   refused ("set Access back to None first"). Couple or staff only.
5. **Migration `20271254506023_a_name_never_inherits_an_account.sql`**:
   `resolve_cluster_guest_person` no longer hands a sibling's person to a
   same-name row when that person is CLAIMED by an account. Unclaimed
   name-only rows still converge (7b unchanged).

6. **A couple row takes no typed email (controller decision, same PR).** Whoever
   held a couple row's key could type their own address into it (RSVP email box
   or the keep-link), and `set_guest_person` then pointed the row's person — and
   `is_event_celebrant` — at that account, with no binding at all. Closed at the
   source: `submitRsvp` drops the email for a couple row (or an unreadable row),
   and `sendEventAccountMagicLink` stamps a couple row's email only when the
   couple sent the link. DB floor, migration
   `20271255305468_a_couple_row_takes_no_typed_email.sql`: on a couple row the
   email resolves the person only when it is an existing couple member's own
   address; a partner is linked via the couple's signed link → binding →
   `link_guest_to_account_person` (account evidence). #6157 removes email from
   the guest RSVP entirely; this guard stays regardless.

`lib/guest-membership-session.ts`'s "known defect" note now records the fix.

Guards: `apps/web/lib/seat-links-only-on-purpose.test.ts` (13 tests — login/
signup never bind; only the two on-purpose doors call the binder; sign-out
expires the guest pass; couple-seat rule executed and checked at every guest
door; suggestions and picker exclude couple seats, executed; connect asks
before binding and only the confirm action passes a confirmed seat; unlink
rotates first and deletes one guest row) and
`apps/web/tests/db/a-seat-link-undone-restores-the-owner.db.test.ts` (the
incident replayed, the unlink's statements restore the creator's person and
un-celebrant the stranger; a claimed person is never inherited by name). Each
was sabotaged once and went red.

The fix is NOT run on production: the owner unlinks testnayan4 from the groom
row himself with the new door after deploy.

SPEC IMPACT: `DECISION_LOG.md` — new row 2026-09-30 "A seat becomes an account's
only on purpose" (the incident + the four rules + the unlink door).
