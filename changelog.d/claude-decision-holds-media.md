## 2026-11-12 · feat(chat): a decision holds photos, videos and files — and double-tapping the file files it

Owner, 12 Nov 2026: *"can we add media files in a decision?"* The database already allowed filing any shared message,
attachments included (`chat_decision_filing_refusal`, migration 20271338412990) — no migration. Two gaps closed:

- **Double-tap on the photo / file itself** now opens the same filing picker. The in-bubble file is a link, so the
  bubble's heart/double-tap rule never saw it. `attachmentTap` (lib/chat-double-tap.ts) is the bubble's `bubbleTap`
  with one shared `LastTap`: a single tap still opens the file, held `DOUBLE_TAP_MS` only when a second tap could file
  it; a private message's file opens at once and never files.
- **The opened decision shows the file**: `FiledMessage.attachment` (name · type · size · expired) is read through the
  viewer's own RLS beside the body; a masked row stays masked. `AttachmentBlock` moved out of the stream to
  `app/_components/chat/attachment-block.tsx` and gained a `filed` variant — a photo thumbnail, a ▶ tile for a video, a
  file row (icon · name · type/size) — each opening through `chatAttachmentHref` (the attachment route), never a stored
  URL. Expired files say "File expired"; words that are only a link draw as a link row. Same panel on both sides.
- Guard: `lib/a-decision-holds-media.test.ts` (sabotaged red, restored green). Lab: `/dev/supplier-chat-lab?decide=media`
  (`&as=couple` for the couple's "you").

SPEC IMPACT: None
