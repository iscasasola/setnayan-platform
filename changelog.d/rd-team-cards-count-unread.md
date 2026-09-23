## 2026-09-22 · feat(your-team): an unread counter on every team card, counting suppliers not cards

Owner, 2026-09-22: *"how about a counter badge instead on the category/ cards?"* and, on what it
counts, **"1. messages"** — unread messages in that supplier's thread. Not notifications, and not
"unanswered", which `lib/conversation-list.ts` is careful to keep separate.

Measured on `origin/main` before building: **no badge count existed anywhere under `vendors/`** —
every `badge` match there is the unrelated Verified or Fit badge — and `unreadThreadIds` never
reached the couple's bench. `ShortlistVendor.threadId` was already populated from `chat_threads`
(`threadIdByProfile` in `vendors/page.tsx`), so the join key was the one thing already in place.

- **`lib/vendor-unread-threads.ts`** — new `readUnreadChatCountsByThread` is now the primitive, and
  the shipped `readUnreadChatThreadIds` is `new Set(counts.keys())` over it. **One query and one url
  parse for both answers:** a supplier's dot and a couple's badge are the same fact at two
  resolutions, and two reads of one fact drift within a week while each passes its own test.
  Behaviour unchanged — pinned by the shipped `the-four-small-lists-read-to-the-end.test.ts` (31/31).
  ⚠ The filename says "vendor" and the read is not vendor-specific: it filters `user_id` + `type =
  'chat_message'` + unread, and the couple's notification carries
  `/dashboard/<eventId>/messages/<threadId>` while the supplier's carries
  `/vendor-dashboard/messages/<threadId>` — the last segment is the thread id for both. The name is
  kept deliberately (renaming a shipped module is how a guard gets disarmed silently) and the
  docblock carries the correction instead.
- **`lib/bench-unread.ts`** (new, pure) — `cardUnread` · `rollupUnread` · `unreadBadgeLabel` ·
  `unreadBadgeAria` · `benchUnreadFrom`, from one map.
- **`shortlist-categories.tsx`** — badge on both card variants, the category row, and **both**
  folder-head branches; carried by context rather than threaded through five card call sites.
- **`vendors/page.tsx`** — the read, folded to one `measured` flag, passed down as pairs.

🔑 **COUNT SUPPLIERS, NOT CARDS — and the rule is reused, not invented.** Unread is per thread, i.e.
per supplier, but one supplier can occupy several cards: a venue package covering catering, cake and
accommodation renders as a linked copy in each tile. Summing per card would report one message as 1
in Venues **and** 1 in Catering & cake. `shortlist-taxonomy.ts` already states the rule — *"A linked
copy is the same booking shown again — count suppliers, not cards"* — and filters
`includedWith == null`; `vendors/page.tsx` does the same. `rollupUnread` filters identically. A
second dedupe rule would be a second source of truth about one fact.

⚠ **The card is the exception, deliberately.** A badge DOES show on a linked copy, because a couple
looking at that card should see there is something to read. Only the TOTALS dedupe.

🔑 **AND "WE COULD NOT CHECK" IS NOT "NOTHING IS UNREAD".** A badge is exactly the surface where a
refused read and a clear inbox draw the same blank space. `error` and `complete` fold into one
`measured` flag; `measured: false` returns `null` everywhere, and `unreadBadgeLabel(null)` is `null`,
so there is no string and therefore no badge. **A truncated read counts as unmeasured too** — the
rows present are real, but a total built from them is wrong, which is worse than no total. The
context default is `UNREAD_UNKNOWN`, so a missing provider shows nothing rather than a screenful of
zeros.

Proof — `lib/bench-unread.test.ts` (10 cases, all EXECUTING the module) and
`lib/the-unread-badge-reaches-the-cards.test.ts` (6 cases, a source guard that counts mounts per
component):

- one supplier on three cards → total **1**, while all three cards still show their badge;
- a 100-card fixture over 40 suppliers with linked copies → total **40**, whatever the card count;
- unmeasured, errored and **truncated** reads → `null` everywhere, never `0`;
- a genuinely clear inbox → a *measured* `0`, which also draws no badge — same blank screen, reached
  honestly;
- opening one thread clears that supplier on all three of its cards at once;
- `unreadBadgeLabel` caps at `99+` (the corner badge would otherwise resize the card) while the
  screen-reader text keeps the true number, because a screen reader has no width limit.

SPEC IMPACT: None. No locked decision changes; no price, SKU or schema moves. No migration — this
slice touches nothing under `supabase/`.

**Found and not fixed:** `fetchEventUnreadCounts` (`lib/event-decisions.ts`) answers the same
question at EVENT resolution via the `unread_message_threads_by_event()` RPC, for the launcher badge.
It is a third derivation of "unread" and it graceful-degrades to an empty map, so a refused read
there renders as "no unread" on the launcher — the same defect this slice fixes on the bench. Not
touched here because it is a different surface with a different reader; registered as its own item.
