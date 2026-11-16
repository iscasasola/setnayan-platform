## 2026-11-16 · fix(chat): CHAT live fixes from W1's walk, part 1

- **CHAT-04** — a sent two-line message settles its own pending row: `matchesPending` compares words with line endings normalised (`sameWords`), so a `\r\n` body no longer leaves a ghost copy.
- **CHAT-05** — the ＋ menu's agreement-gated tools open for a booking that is `contracted`/`deposit_paid` on its `event_vendors` row (`rowReadsBooked`), not only for a pool hold. No new flag.
- **CHAT-06** — opening a conversation marks that conversation's chat notices read (`markThreadNoticesRead`, run in `after()` once the read marker is written, scoped to the reader; matched by the conversation's own door links, old and new).
- **CHAT-07** — couple chat notices (message, private message, co-host, call ring, offered service) open the picked supplier on Chat (`coupleChatHref`), the supplier's chat push opens the picked client; the couple's Messages rows use the same helper; the stream re-pins to the newest message while rows grow. Every chat notice now passes its `eventId` explicitly.
- **CHAT-08** — a couple already booked with a shop sees "Message" opening their existing chat in place of Inquire on the shop page.
- **CHAT-10** — the pay plan reads "Due Nov 15, 2026" (not "Due · due"), keeps pay order, names the first unpaid payment as Next, and SAYS when a plan's dates are out of order instead of re-sorting it; a booked couple's first payment no longer says "books the date".
- **CHAT-11** — supplier chat rows that share one title ("TEST's Birthday (date not set)") say what tells them apart on the row's event line: the event's own name, else its city.
- **CHAT-12** — not changed: the chat ⓘ are the shared `InfoTip`, which presses at 46 px by its halo (`.sn-dot-btn::after`); the 16 px measured is the drawn circle.

Guards: `couple-supplier-notices-reach-email` now reads every route helper in a ternary link (each side's button checked, not only the first); `one-picked-shell` reads the couple door through `coupleChatHref`.

SPEC IMPACT: None — implements existing rulings (DECISION_LOG 2026-11-04 book on accept; 2026-11-09 Final balance). Flagged, not changed: the live plan's Final balance (Nov 2) dated before its First payment (Nov 15) — the plan generator's dates need a look.
