## 2026-11-12 · feat(files,chat,sheet): what is shared in the chat is collected on Files by kind · drop/paste into the chat · every house sheet opens at half (Piece 3c)

Piece 3 of the negotiation-chat redesign, last part, stacked on Piece 3b (DECISION_LOG 2026-11-12 "EVERYTHING SHARED IN
THE CHAT IS COLLECTED ON FILES, SORTED BY KIND", "FILES · HUB · FORMS DESIGN APPROVED"; prototype legend rows 138 + 143).

- **Files by kind** (`readChatCollected`, read from the messages — nothing copied to show them): a chat document →
  This booking · a photo/video → "From the chat · not filed yet" · a link in the words → Links (a video link wears a
  play mark). Opens through the shipped `/api/chat/attachment/<message>` route. The Hub never reads the chat.
- **File under a service** (op `filechat`): only the shop's OWN chat photo/video, only a quoted service. The server
  reads the bytes, measures hash + date; bytes already stored are a link, new ones get ONE kept copy in the shop's
  folder (the chat file is removed by the 90-day chat clean-up). Only filed photos count and can reach the shop.
- **Chat composer** (`chat-send-form.tsx`, minimal): a file dragged onto the chat ("Drop to send") or pasted into the
  box rides the ONE `attachment` input the shortcuts use; while private, words only (the shipped refusal).
- **Every house sheet opens at half on a phone** (`app/_components/sheet.tsx`): max-height ≈ half, a handle — drag up →
  max (100dvh − 48px), down from max → half, down past half → close; a short sheet stays as tall as its content; a
  `full` sheet and the tablet/desktop drawer are untouched.
- Guards: `lib/every-house-sheet-opens-at-half.test.ts` · `lib/the-chat-is-collected-on-files.test.ts`.

SPEC IMPACT: None
