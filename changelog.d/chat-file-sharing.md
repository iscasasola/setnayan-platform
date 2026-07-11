## 2026-07-11 · feat(chat): file sharing in threads (attach → R2)

Couples and vendors can now attach an OPTIONAL file to a thread message
(image / PDF / common doc, ≤ 25 MB). A message may be text, an attachment, or
both. The text-only send path is unchanged — no file means the core behaves
exactly as before, and the native JSON send endpoint is untouched.

- Migration `20270713300000_chat_message_attachments.sql`: additive nullable
  columns `attachment_url / attachment_name / attachment_mime /
  attachment_size_bytes` on `public.chat_messages`. RLS unchanged — existing
  thread-membership policies cover the new columns.
- `lib/chat-send.ts`: `sendChatMessageCore` accepts an optional `File`,
  validates it against a small MIME allowlist + 25 MB cap, and (only after
  every membership/accept-gate passes) uploads it via
  `uploadPublicAsset({ pathPrefix: 'chat/<threadId>' })`. Invalid/failed files
  return a graceful result — never a throw.
- `lib/storage.ts`: `uploadPublicAsset` gains optional `allowedMime` / `maxBytes`
  overrides; defaults keep every existing caller image-only / 6 MB.
- `lib/chat.ts`: the four columns flow into `fetchMessages` + `ChatMessageRow`.
- Composer + stream: paperclip file input with a filename chip; image
  attachments render as a lazy `<img>` thumbnail, other files as a
  name/size/download chip.

Follow-up: attachments are served from a PUBLIC R2 URL for v1 (matches the
vendor-handover proof-image precedent). Access-controlled signed-URL delivery
(private bucket + short-lived presigned GETs) is a tracked hardening follow-up.

SPEC IMPACT: Vendor_Customer_Connection_Build_Plan_2026-07-10.md (PR 2 file sharing)
