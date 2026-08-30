## 2026-08-31 · fix(copy): the front door and llms.txt stop selling one event type out of seventeen

**The defect, measured on the live database, not on a document.** `event_type_vocab` in
production (project `njrupjnvkjkitfctetvi`) carries **seventeen rows and every one is
`status = 'active'` AND `enabled = TRUE`** — wedding, debut, gender reveal, birthday,
celebration, travel, corporate, tournament, christening, anniversary, graduation, reunion,
gala night, simple event, date, hangout, wake. Meanwhile the two surfaces that describe the
whole product described a seventeenth of it:

- `app/page.tsx` — `HOME_TITLE` read *"Plan your Filipino wedding free"*, and the
  SoftwareApplication JSON-LD called Setnayan *"The Philippines-first wedding platform"*.
  That JSON-LD paragraph is the machine-readable answer an LLM quotes when asked what
  Setnayan is, on the one URL an answer engine grounds the entire brand on.
- `lib/llms-txt.ts` — the lead paragraph told AI crawlers the other event types arrive
  *"as those event types unlock"*. They were already unlocked when it said so.

Neither could fail, throw, or typecheck red. **A true sentence about a smaller product is a
valid sentence.**

**What changed.** The title, description, keywords and JSON-LD on `/`; the lead blurb, the
"what it's becoming" section, and the couple-only framing in `llms.txt`. Weddings are still
named first everywhere and still lead `keywords` — widening a claim is not the same as
dropping the strongest query the brand ranks for.

**Three judgements worth keeping:**

- ⚠ **"event", not "celebration", and the reason is `wake`.** A wake is a live enabled event
  type and it is not a celebration. The house word in the corpus is "celebration"; on the
  strings that must cover all seventeen it would be false.
- ⚠ **No COUNT is written anywhere, and a guard enforces that.** A numeral goes false the day
  the eighteenth row ships — silently, in a machine-readable field. A list that has not been
  extended merely UNDER-describes, which is the safe direction.
- ⚠ **The list is written ONCE.** `LIVE_EVENT_TYPES` + `liveEventTypesPhrase()` are exported
  from `llms-txt.ts` and interpolated; the guard asserts the rendered sentence IS the one the
  constant produces, so a second hand-typed copy fails rather than drifts.

**Also fixed, found on the way:** `llms.txt` linked `/weddings`, which has 308-redirected to
`/realstories` since the 2026-06-14 rename (`next.config.ts`) — verified live, `/weddings` →
308, `/realstories` → 200. It now links the destination. Both stay allow-listed.

**Newly permitted, and taken up:** the per-guest Papic limit shipped (#5024 merged
2026-08-30), so `llms.txt` may now describe it. It is described as the live schema and the
merged promotion page describe it — a **ceiling**, not a reservation
(`papic_guest_spend_ceilings.ceiling_points`, `events.papic_guest_spend_ceiling_*`): nothing
is carved out of the pot, so an unspent credit is still there for everyone else. **No number**
— the host chooses it.

**The proof.** `lib/public-copy-is-not-wedding-only.test.ts` (12 assertions) asserts none of
the do-not-claim strings reach the rendered output or the homepage metadata, that the figures
still resolve from catalog rows rather than literals, and that no count of event types is
written into either surface. Home-page assertions run against **comment-stripped** source, per
`home-brand-name.test.ts` — this file's own comments quote the strings a naive grep would look
for.

**MUTATION (before → after occurrences):**

| Sabotage | Occurrences before → after | Result |
|---|---|---|
| `HOME_TITLE` restored to the wedding-only string | 0 → 1 `wedding` in title | ✅ RED |
| `'Setnayan AI · avatar maker'` added to llms.txt prose | 0 → 1 `avatar maker` | ✅ RED |
| `'browse other couples'` added to llms.txt prose | 0 → 1 | ✅ RED |
| `₱2,500` typed into the Pakanta line in place of `${R('PAKANTA')}` | 1 → 1 (anchored) | ✅ RED |
| `'Seventeen event types are live'` re-added | 0 → 1 | ✅ RED |
| the out-of-scope `- No avatar maker.` bullet deleted | 1 → 0 | ✅ RED |

🪤 **Two guards failed honestly on their first cut and both fixes are in the file.** The
do-not-claim scan matched **its own denial** — "No public feed and no social channel" contains
`public feed` — so it now excludes lines shaped `- No …` *wherever they appear*, never the
whole section, which would have made that section a hiding place. And the reprice assertion
first said "the old figure is gone from the file", which is **set membership** — ₱2,500 is also
the Thank You Video's price — the exact shape `llms-txt.ts`'s docblock exists to kill. It is
anchored to `**Pakanta** — ₱…` now.

**Refactor, deliberately narrow:** the hand-typed catalog fixture moved out of
`llms-txt.test.ts` into `lib/llms-txt-guard-input.ts` so the second guard imports it instead of
pasting a **third** copy of the catalog. Every warning in its original comments moved with it.

SPEC IMPACT: None. No decision changed — the seventeen event types were already ruled live and
enabled; this makes the public copy agree with them.

**OWNER QUESTION (not resolved here):** the session brief forbids advertising **multi-camera
Live Studio** (finished, but cannot start until YouTube is reconnected — P0-a). It is
advertised on `main` today and **a copy edit cannot remove it**: `LIVE_STUDIO` is
`is_active = TRUE`, and `llms-txt.test.ts`'s *"every ACTIVE retail price is quoted somewhere in
the file"* goes red the moment its prose line goes. Taking the claim down means taking the SKU
off sale. That is an owner decision, and it is recorded in the guard rather than silently
skipped.
