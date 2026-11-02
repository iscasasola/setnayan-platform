## 2026-08-24 · feat(samahan): Usapan — the samahan's group chat

Owner: *"can we set a chat room on the page?"* The Overview tab has carried
an honest "Usapan — group chat is coming soon" note since 2026-07-15; this
replaces it with the room.

- Migration `20271163399136`: `samahan_messages` — members read + post,
  authors soft-delete their own.
- ⛔ **NOT `chat_threads`, and this overturns a 2026-07-15 owner lock that
  said "reuse 0019 chat".** Read out of prod, that table is a couple↔vendor
  BOOKING NEGOTIATION: `event_id` NOT NULL, `vendor_profile_id` NOT NULL,
  plus `inquiry_status` · `pax_at_inquiry` · `agreed_price_centavos` ·
  `locked_at`. A samahan has neither an event nor a vendor, so reusing it
  means nulling both FKs and re-reasoning every RLS policy and consumer that
  assumes a vendor thread — touching the live booking system to ship a group
  chat. The plan's "full PR series" estimate was sized against that reuse.
- The INSERT policy demands `user_id = auth.uid()` AND membership — nobody
  posts in another member's voice (the 2026-08-12 impersonation family).
- Take-down is a SOFT delete and the ONLY edit: the UPDATE policy says the
  row is yours, and `samahan_messages_author_field_guard` says which field,
  so an author cannot rewrite a message after everyone has read it.
- Retention: the corpus's 5-year CHAT rule already governs messages. **No new
  sweep** — a second one would be a second definition of when a message is old.
- RA 10173: classified for erasure (author's own words go with the account)
  and included in the subject-access export, soft-deleted ones included.

6 db tests, 4 measured mutations, Ugat joint J41.

SPEC IMPACT: DECISION_LOG.md 2026-08-24 (Usapan built; the "reuse 0019 chat"
deferral in Samahan_Minimal_Build_Plan_2026-07-15.md §1 is superseded).
