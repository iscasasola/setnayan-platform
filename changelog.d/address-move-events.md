## 2026-11-16 · feat(addresses): events at setnayan.com/{username}/{event} — the address move, PR 2 of 2 (events)

Owner, 15 Nov 2026 (specs DECISION_LOG 7fbff0cd + d7910b5d, map `ADDRESS_MOVE_MAP_2026-11-15_fable.md`). Built on
the shops PR (#7832). **Everything that changes an address runs only while the owner's cutover switch is on**
(`NEXT_PUBLIC_U_NESTING_CUTOVER`, the switch the nesting was always behind); with it off, every address is
byte-identical to today. What does NOT wait for the switch: the creator column, the automatic username, and the
reserved words.

- **No `/u/`.** `publicEventPath` builds `/{username}/{event}`; the middleware reads `/{a}/{b}` as a person's event by
  the second word alone (names are one pool): an event's own pages (`/{event}/hub` …), a shop's pages and a chapter
  (`/{user}/c/{id}`) are never read as one. `/u/{user}[/rest]` 308s to `/{user}[/rest]`.
- **Whose username:** the event's CREATOR (`events.created_by_user_id`, new, add-only, service-role only). The database
  stamps it with the first couple member; the migration backfills older events from the same lowest-`user_id` tie-break
  the address already used, so no address moves because of the backfill.
- **Username made from the name** when the creator has none (`mint_user_username`, the shop-address pipeline and the
  same one-pool question). Never replaces a chosen one, never mints from an empty or two-letter name. Home says it
  ONCE ("We made this from your name. Change it") and stamps it seen. Changing it is the profile's existing field.
- **Old links forward forever:** bare `/{event}` → `/{username}/{event}` (the page's existing 307, query kept, the
  personal `?invite=` redeem still first); `/{event}/{page}` — `/invite` for guests already invited, `/hub`, `/seat`
  … — forward with their query; a wrong or renamed username in front of an event goes to the real address.
- **`/{username}` is the person's public page** — the existing `/u/{username}` page (public events and published
  stories only; a hidden profile 404s), reached at the bare word.
- **Cached Event Hub kept:** a guest's or a stranger's open of `/{username}/{event}` is answered from the event's
  cached copy, exactly as `/{event}` was.
- **Reserved:** `c` · `invite` · `dates` · `booth` · `review` · `guest-review` · `cached` (app list + database).
- 46 hand-built event links/redirects moved onto `publicEventPath`; `revalidatePath('/{event}')` calls are left as
  they are — they name the internal route the rewrite renders.

Guards: `lib/an-event-lives-under-its-creator.test.ts` (every redirect/rewrite pair, the second-word rule against the
folders on disk, the helper on/off, old sub-page forwards, the cale-ice / maria-and-jose pin, the wiring, no
hand-built event link) · `tests/db/an-event-address-names-its-creator.db.test.ts` (creator stamp, mint, reserved
words; one sabotage measured red). Link maps (`port-controls`, Root map, back-link map) read the helpers.

SPEC IMPACT: Applies the owner's address ruling (DECISION_LOG d7910b5d) — no new corpus edit. The "creator can hand the
address to a co-host" pick (same row) is NOT built here.
