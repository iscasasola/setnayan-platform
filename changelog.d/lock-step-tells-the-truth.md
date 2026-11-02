## 2026-09-10 · fix(lock): the lock step stops lying to both people, and a refused answer says why

Two defects on the owner's two-sided test walk, both in the lock step, both
about WORDS rather than about the handshake. The database was right throughout;
nothing about who books whom changed.

**1 · "Deal locked — price frozen" appeared for BOTH people the instant the
couple pressed the button — before the supplier had agreed to anything.**
Under PR-H (live since 2026-08-29, owner-confirmed) that press only ASKS: the
booking row stays `considering` with a 48-hour fuse and the supplier's yes is
what books it. `chat-amendment-card.tsx` rendered one hardcoded sentence on
`locked_at` with no role test and no knowledge of the handshake, so the supplier
read "Deal locked" on the card sitting above their own unanswered request. The
same press ALSO fired `notifyChangeCounterparty(… 'Deal locked', 'accepted')` at
the supplier on top of the accurate "A couple wants to book you" — two
contradictory messages from one press.

- New `lib/lock-freeze-copy.ts` — one place that decides what the frozen-price
  line may say. The booked words are reachable only from a real booking; an ask
  says "nothing is booked until they say yes" to the couple and "answer it on
  your Today page" to the supplier, with the live countdown; a closed ask says
  so and tells the couple they can move on.
- New `lib/thread-lock-handshake.server.ts` resolves the state for a thread.
  The COUPLE's surfaces read `event_vendors` through their own session; the
  supplier's use the admin client scoped to their own `vendor_profile_id`,
  because all four policies on that table are couple-/moderator-scoped and a
  supplier cannot read it at all through their session.
- All FOUR `<ChatMessageStream>` mounts pass it (the survey named three).
  Absent means UNKNOWN, never "locked": an unwired mount degrades to "Price
  agreed and frozen at this amount." — true everywhere — never to the lie.
- The "Deal locked" notification now fires only where a deal was locked.

**2 · When the supplier pressed Agree and was refused, they saw nothing at
all.** `vendorAgreeToLock` ends `redirect('/vendor-dashboard?lock_agree=…')`
and a grep of the whole app for `lock_agree` returned exactly one hit — that
redirect. Nothing read it. Read out of production, `vendor_agree_to_lock` can
answer with NINE non-ok statuses (the survey named eight; it missed
`not_requested`) and `vendor_decline_lock` with six. Every one landed as a page
reload with the request card still sitting there — indistinguishable from a
dead button.

- New `lib/lock-answer-notice.ts` gives each one a plain-English sentence a shop
  owner can act on ("Setnayan has not approved your shop yet, so a couple cannot
  book you…"), rendered on `/vendor-dashboard` in the notice tile the
  deposit answer already uses. `resolve_others_first` carries the count of other
  couples waiting on that date, which is now passed through the redirect.
- `tests/db/every-lock-answer-has-a-sentence.db.test.ts` EXTRACTS the status
  list from the replayed RPC bodies, so a rung added in SQL fails the build
  instead of going silent.

Known, not fixed: answering from the customer card
(`/vendor-dashboard/clients/[eventId]`) still redirects to `/vendor-dashboard`
rather than back to the card — pre-existing, and the notice is at least now
visible where it lands.

SPEC IMPACT: None — no owner decision, no price, no schema. The 2026-08-29
handshake ruling is unchanged; this only corrects what each side is told.
