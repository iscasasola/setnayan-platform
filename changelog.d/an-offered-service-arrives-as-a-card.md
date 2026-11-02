## 2026-09-09 · feat(chat): a service offered in a conversation arrives as the supplier's card

When a supplier offered one of their services inside a conversation, the couple
received **one word in the "Inquiring about" chip row** and nothing else. The
offer wrote a `thread_service_interests` row; no message, no photograph, no
price. Measured on production the same day, both live services have a NULL
`title`, so `interestChipLabel` fell back to the category key — a couple being
pitched a live band saw the words "Live Band". Three caterers were three
identical chips.

Owner, 2026-09-09: *"the service card of each service still needs that
photo/image/video."* A couple choosing between three caterers is choosing on
what they can see.

Offering a service now posts a message carrying the new
`chat_messages.offered_service_id` marker, and the shared message stream renders
it as the card the supplier built — cover photograph, showcase clip, price,
discount badge, what is included, what is not.

**Reuse, not a new drawing.** The card is `ServiceCardFace`, the same component
the supplier's own services list and editor render, so the couple receives what
the supplier was shown when they built it. The money is `snapshotFromService`,
the one derivation of "from ₱X" and of which discount wins. The write path is
still `offerServiceCore`, the single gate both the server action and the native
endpoint already call — there is no second offer path.

- `supabase/migrations/20271214894972_offered_service_arrives_as_a_card.sql` —
  nullable FK + partial index + the column-level INSERT grant, mirroring
  `proposal_id` / `appointment_id` / `change_order_id` / `amendment_id`.
  `ON DELETE SET NULL`: retiring a service must not delete the conversation it
  was pitched in.
- `apps/web/lib/offered-service-card.ts` — resolves the card for one message and
  signs both media refs.
- `apps/web/lib/offered-service-card-decide.ts` — the ownership refusal and the
  name derivation, kept pure so a test can execute them.
- `apps/web/app/api/chat/offered-service/[messageId]/route.ts` — membership is
  proved by reading the message under the caller's own session.
- `apps/web/app/_components/chat-offered-service-card.tsx` — the in-thread card.

### Four things measured against the shipped code, not the brief

1. **The cover photo is NOT required to publish.** `PUBLISH_REQUIREMENTS` is
   `['price','exclusive']`, and one of the two live services has no cover. A
   card that needed a photograph to exist would be blank for half of them, so
   the coverless case is a first-class state with a test on it.
2. **`chat_messages` grants INSERT per column, not per table.** Without the
   explicit `GRANT INSERT (offered_service_id)` the vendor's insert fails with a
   bare permission error and the offer silently posts no card — the exact
   "failure that renders as success" this repo keeps paying for.
3. **The card must not take its name from the snapshot.** `readSnapshot` falls
   back to `"Untitled service"`; with both live titles NULL that would have
   printed "Untitled service" where the chip row printed "Live Band" — a
   regression on every service that ships today. The card and the chip resolve
   the name through the same two steps.
4. **The API route named in the brief does not exist.**
   `app/api/chat/attachment/[messageId]/route.ts` is not in the tree, and chat
   attachments are not served through a membership-proving route at all —
   `bucketForPrefix` has no `chat/` rule, so they land in the PUBLIC bucket
   (already logged for PR #5339). Service media is resolved the way the app
   actually does it: `displayUrlForStoredAsset`, short-lived presigned URLs,
   never a stored ref and never a permanent public address.

### Guards, all mutation-tested

`lib/an-offered-service-arrives-as-a-card.test.ts` (9 tests, executes) and
`lib/the-offer-posts-a-card.test.ts` (8 tests, wiring). Nine mutations were run
and each turned its guard red — the ownership refusal, the name derivation, the
marker on the insert, the swallowed insert error, the stream branch, the
selected column, an unsigned clip, the mock button, and an admin-client insert.
Negative assertions read comment-stripped source: the first run of the media
guard failed on its own docblock's `r2://` example.

⚠ The ownership refusal is executed by a test but has **no** DB-level proof that
a forged `offered_service_id` is refused end to end; a `tests/db/` behavioural
test is the honest follow-up and is not in this PR.

`supabase/security/exposure-surface.baseline.txt` regenerated: exactly one new
column, `anon=S authenticated=SI` — byte-identical to the four markers already
on this table.

SPEC IMPACT: `SESSIONS_Chat_Bench_Exclusive_2026-09-09.md` — S5 is built.
