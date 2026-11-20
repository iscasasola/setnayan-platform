## 2026-11-20 · feat(chat): Unichat part G — the ⋯ menu and trade pages

Owner 20 Nov 2026: *"build it now, I am happy with the design"* (drawing `build-sessions/UNICHAT-LIVE-2026-11-19.html`; plan row G, `build-sessions/UNICHAT-BUILD-PLAN-2026-11-20.md`). The supplier's client page only — the host's side is as shipped.

**⋯ holds places to go.** Behind the head's More, in the drawn order: *For your trade* — **Song list** (a music act) or **Script** (an emcee / host) — then **Files · Event Hub · Crew for 18 Dec · Add to my calendar · Report a problem** (last).
- A trade row shows ONLY when the shop's service has that page. The signal is the shipped desk entitlement the day-of console already mounts on — `holdsSpecialization(access, 'song_desk')` / `'stage_script'`, narrowed to what the shop was booked for — no new flag, and never a greyed row.
- **Song list** is the shipped Song Desk itself (their sets in running order, the hosts' picks by moment, the requests), opened as a page of the client; booked and fee-unlocked only. **Script** is the shipped `ScriptTab` behind the same fee gate; its fold at the end of Schedule and `?tab=script` are unchanged.
- **Crew** opens the shipped Hub › Crew for this event (booked only). **Add to my calendar** saves the shipped `calendar.ics`, offered only once the day has a timed moment (the file is a 404 before).
- **Report a problem** moves into ⋯ (owner 20 Nov — supersedes 9 Nov "last row of (+)"; the (+) row is removed by the (+) builder's PR).
- No duplicates: nothing the strip's four boxes open (Book & Budget · Schedule · Forms · Decisions) and nothing the (+) sends is a row here.

**Parity pass (20 Nov, readying for review).** ⋯ is now the drawn menu: a 232 px panel under its own button at the top right (the drawing's `.menu.top`), plain rows (an 18 px icon in the second ink, the word), the small *For your trade* label, the shared dimmed scrim (`OverlayBackdrop`) behind it — one layer above the thumb row, so the composer dims under it as drawn — not a sheet from the bottom. Arrow keys / Home / End step the rows; Esc closes the menu back onto ⋯ and goes no further (the client stays open). **Details** left the rows — the client's name in the head opens it, and the drawing has no second way in. **Crew** names the day (*Crew for 18 Dec*, `dayMonth` of the event date). The lab's `&one=booked` fills ⋯ with the real rows.

**On a computer a page opens beside the chat, never over it.** The chat is the page at every width; a page (from the strip, the name, ⋯ or an old `?tab=` door) opens in its own third column — 420 px on the right, with its own ← — and the chat narrows by exactly that. Opening another page replaces the one there. The tab row and the work column beside a side chat (18 Nov) are gone on this side; the host's picked supplier keeps them until its own build. In at 320 ms, out at 256 ms, on the settle curve; reduced motion moves nothing.

**Details › Agreed now, as drawn.** Six plain rows above the shipped "Changed N×" rows: Event · Venue · Hosts · Coordinator · Supplier · Stage. Every one is a fact the page already read (the Event row adds one column, `event_type`, to the card's existing event read). An unread fact draws no row — no hosts key, no roster before booking, a refused quotes read — never "None" or a guessed "Inquiry".

**The host's side gets the same row.** *Report a problem* left the (+) on both sides, so the host's picked supplier now has a ⋯ with that one row (the shipped Report page). The host keeps its tab row until its own one-chat build — the shell takes ⋯ rows from a side without `chatHome` (`more`).

**The head's search door is a marked slot, off.** The drawing puts the magnifier in the chat header, which is the shell; the search itself is the chat's (part D, `lib/chat-search.ts`). The shell can now draw the magnifier (`headSearch`) and ask the chat to open its box inside the tap (`PICKED_CHAT_SEARCH_EVENT`, `picked-nav.ts`). Nothing listens on this branch — the listener is one effect in part D's `chat-message-stream.tsx` — so no side turns it on yet (guarded: a side may pass `headSearch` only once the stream names the event).

**Not built — needs a data change:** *Mute this chat*. Nothing stores a per-person, per-chat mute today, so no row is drawn (a row with nothing behind it would be a dead control). *Call · Viber* and the drawn *Crew for the day* picker (who is going + call time) are part H.

Files: `app/_components/picked/picked-shell.tsx` (`PickedMoreRow`, `chatHome.pane`, the column) · `clients/[eventId]/_components/picked-client-more.ts` (new, pure) · `picked-client-shell.tsx` · `clients/[eventId]/page.tsx` · `_pages/context.ts` · `_pages/details.tsx` · `app/_components/chat/agreed-now.tsx` · `lib/agreed-facts.ts` (new).
Guards: `clients/[eventId]/the-more-menu-holds-places-to-go.test.ts` (new, 5 rules, sabotage-checked) · `the-client-page-is-one-chat.test.ts` · `a-client-open-draws-the-thread-once.test.ts` · `the-thumb-row-floats-over-the-picked-client.test.ts` (re-anchored to the new rule).

SPEC IMPACT: `DECISION_LOG.md` — two 20 Nov rows, written by the controller in specs commit `5ca412c6`: (1) Report a problem lives under ⋯ (supersedes 9 Nov "last row of (+)"); (2) on a computer a client's page opens in a third column beside the chat (supersedes 18 Nov "work column + tabs beside a side chat" on the supplier's side).
