## 2026-11-20 · feat(chat): Unichat parts B+D — tools in the text box, chips, Private, search, presence

Owner, on the approved live drawing (`build-sessions/UNICHAT-LIVE-2026-11-19.html`, plan
`UNICHAT-BUILD-PLAN-2026-11-20.md` rows B and D): *"build it now, I am happy with the design."* Stacked on #8039.

**B — tools inside the text box**

- A (+) card being filled is drawn **inside the composer**: the box grows upward into the tool, its row reads
  ← · the tool's name · its Send, and the ＋ turns into ← (back to plain chat; the typed words stay). A step card's
  Next / Send stands in the box's own Send place and says what it sends. The card's own form sits outside the send
  form (`chat-send-form.tsx`, `chat/chat-tool-frame.ts`, `chat/chat-step-card.tsx`, `chat/plus-draft.tsx`).
- On a computer the tiles and the tool open as a **third column** on the chat's frame; the chat narrows, never covered.
- The (+) is **tiles** (two across) and holds **only things you send**: "Report a problem" (→ the ⋯ menu) and
  "See every version" (the strip's Deal box · the quote card's own row) are no longer rows (`lib/chat-plus.ts`).
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
  who); a page-loaded "Seen" stays the plain word.
- Presence faces (the green ring) and "Not sent · Try again" were already shipped and are unchanged.

No migration, no schema, no membership change (`chat_thread_members` / `current_thread_ids` untouched).

Guards: `lib/chat-plus.test.ts` (3 · 9 · 10), `lib/chat-kinds.test.ts` (2 · 2b · 2c), `lib/chat-search.test.ts`,
`lib/the-tool-lives-in-the-text-box.test.ts`; five older guards updated to the 20 Nov rules.

SPEC IMPACT: None
