## 2026-11-20 · feat(chat): Unichat parts B+D — tools in the text box, chips, Private, search, presence

Stacked on #8039 + #8060 (Part E merged in). Owner, on the approved live drawing (DECISION_LOG: `prototypes/unichat_live_v3_2026-11-20.html`; the platform copy is `build-sessions/UNICHAT-LIVE-2026-11-19.html`, plan
`UNICHAT-BUILD-PLAN-2026-11-20.md` rows B and D): *"build it now, I am happy with the design."*

**B — tools inside the text box**

- A (+) card being filled is drawn **inside the composer**: the box grows upward into the tool, its row reads
  ← · the tool's name · its Send, and the ＋ turns into ← (back to plain chat; the typed words stay). A step card's
  Next / Send stands in the box's own Send place and says what it sends. The card's own form sits outside the send
  form (`chat-send-form.tsx`, `chat/chat-tool-frame.ts`, `chat/chat-step-card.tsx`, `chat/plus-draft.tsx`).
- On a computer the tiles and the tool open as a **third column** on the chat's frame; the chat narrows, never covered.
- The (+) is **tiles** (two across) and holds **only things you send**: "See every version" (the strip's Deal box · the
  quote card's own row) is no longer a row. **"Report a problem" STAYS the last row until Part G (#8048) moves it into
  the ⋯** (ship-controller ruling 20 Nov: a chat page is never left with no in-chat Report) — held by
  `lib/every-chat-page-has-a-report-door.test.ts` on both thread pages (`lib/chat-plus.ts`).
- **Several (+) cards may be open at once** — owner approval 20 Nov supersedes the 8 Nov "one (+) at a time":
  `plusGate` never shuts; a card waiting for its answer no longer blocks the next.
- **A typed price or day offers its tool** (`typedOffer`): "Can you do ₱38,000?" → Counter (hosts) / the quote
  (supplier); "Fri 27 Nov" → Meeting. Only a row the (+) has open for the reader is ever offered.

**D — chips, Private, search, presence**

- The chips are compact and **float above the box**; the sliders icon turns into their ✕ and wears a dot while a
  filter is on. **Chat** (what people typed) and **Private** (the private lines you may see) joined them. Private also
  turns the box to Whisper where the box can whisper. Typing lands back on All — never out of Private. Chat and
  Private are never written into the address (`lib/thread-view.ts`, `lib/chat-kinds.ts`, `lib/chat-kind-store.ts`).
- **Search inside the chat** — an icon until tapped; the tap opens the box with the keyboard; "3 of 7", ↑ ↓, Enter /
  Shift+Enter. It tints matches with the browser's highlight and writes no node of the conversation
  (`lib/chat-search.ts`).
- **Seen by**: "Seen · Claire, Liza" when the readers said so on the chat's own channel (the read broadcast now says
  who); a page-loaded "Seen" stays the plain word. Under a private line or a whisper it names ONLY the people the line
  reached — the list the server wrote at Send with the one side rule (`seenByWhoGotIt`, `lib/chat-whisper.ts`): never
  the supplier under the hosts' whisper, never the hosts under a team whisper
  (`lib/a-whisper-is-seen-only-by-who-got-it.test.ts`).
- Presence faces (the green ring) and "Not sent · Try again" were already shipped and are unchanged.

**One Private chip (Parts D + E folded, 20 Nov — DECISION_LOG "UNICHAT PART E — FIVE CALLS", call 4)**

- Part E's own sky "Private" tag over the box and Part D's Private filter chip are now ONE component,
  `app/_components/chat/private-chip.tsx`. In the row it is D's chip with E's lock, filled sky when picked; while
  whispering it is E's sky status with who it reaches ("Only you, Jose and your coordinator" · "You and the hosts" ·
  "Only your team") and the dispute ⓘ. With the row out only the line stays (never two chips on screen). Private picked
  where a whisper cannot start says why and stays: a failed read says "Couldn't load…", never "no one"
  (`data-chat-whisper-line="failed"`), and nobody-here has its own words. E's inline chip is deleted.
- Guard: `lib/there-is-one-private-chip.test.ts`; `lib/the-tool-lives-in-the-text-box.test.ts` 5 updated.

No migration, no schema, no membership change (`chat_thread_members` / `current_thread_ids` untouched).

Guards: `lib/chat-plus.test.ts` (3 · 9 · 10), `lib/chat-kinds.test.ts` (2 · 2b · 2c), `lib/chat-search.test.ts`,
`lib/the-tool-lives-in-the-text-box.test.ts`; five older guards updated to the 20 Nov rules.

SPEC IMPACT: None
