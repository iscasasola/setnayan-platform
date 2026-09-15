## 2026-09-16 · fix(chat): a card in a message must name *this* conversation's supplier

A chat message can carry a CARD — a proposal, a meeting, a change order, a deal
amendment, or an offered service. The card is what the platform vouches for: it
renders with Setnayan's chrome, the supplier's title and price, and a live
button. `authenticated` holds INSERT on all five of those columns (it has to —
the supplier writes them under their own session), and nothing asked whether the
row they point at belonged to this conversation.

`chat_messages_member_insert` is satisfied by its first disjunct alone
(`event_id IN current_couple_event_ids()`), and the two BEFORE INSERT triggers
that already existed close the neighbouring doors but not this one:
`tg_chat_messages_derive_sender` (20271132839561) overwrites `sender_role` and
`sender_user_id`, so WHO sent it cannot be forged, and
`tg_chat_messages_guard_end_user_write` (20271221089848) pins `thread_id` to
`(event_id, vendor_profile_id)`, so WHICH conversation cannot be forged. The
hole was the gap between them: an honest sender, in an honest conversation,
carrying somebody else's card. Couple-side RLS on the referenced tables is
EVENT-scoped rather than vendor-scoped, so a couple may legitimately read every
supplier's proposals, meetings and amendments on their own event — the ids are
not secret, and a couple with threads open to two suppliers could paste
supplier B's `proposal_id` into supplier A's thread and get a fully-populated
card (B's title, B's price, a working `/proposals/<public_id>` link) presented
under A's name, on their own screen and on supplier A's.

RLS cannot refuse it and that is not a bug in RLS: a policy is row-level, never
value-level — one that admits you to your own row cannot govern what that row
says about somebody else.

Migration `20271229461225_a_card_names_this_conversations_supplier.sql` adds a
BEFORE INSERT trigger that compares each card link against the message's own
`event_id` and `vendor_profile_id` (vendor only for a service, which is not
event-scoped) and refuses with the marker `CARD_NOT_THIS_CONVERSATION`. It
applies to EVERY role including the service role — it is a consistency invariant
about what a row may claim, not a permission about who may speak. All five
legitimate writers (`lib/proposal-send.ts`, `app/_components/negotiation-actions.ts`,
`lib/offer-service-core.ts`) copy both ids from the thread they already hold, so
none of them changes.

Measured read-only on production first: `chat_messages` holds 8 rows and ZERO
carry any of the five columns, so nothing is stranded and there is nothing to
backfill.

Guarded by `apps/web/tests/db/a-card-names-this-conversations-supplier.db.test.ts`,
which drives the DATABASE as a real `authenticated` session (`SET ROLE` + JWT
claims), not the server actions — it proves both forgery directions (cross-vendor
on the same event, cross-event with the same vendor, so each half of the
comparison has its own witness), asserts the forged row is ABSENT afterwards
rather than only that the statement raised, keeps a positive control beside every
refusal, and neutralises the trigger to show the same forgery lands without it.

The app-layer check already in `lib/offered-service-card.ts` is unchanged and
still correct; it covered one of the five.

SPEC IMPACT: None. No product behaviour, price, copy or screen changes — this
refuses a row that no legitimate writer has ever written.
