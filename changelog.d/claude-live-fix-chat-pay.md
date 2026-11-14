## 2026-11-14 · fix(chat,pay): a photo needs no words · the Files tab opens chat files · a booking freezes the plan its quote agreed

- **CHAT-01** — a photo sent with no caption was refused by the database (`chat_messages_body_check` demanded
  `length(body) > 0`), so a photo-only message never saved. The check now admits an empty body when the row
  carries a file. Migration `20271346331739_a_photo_needs_no_words.sql`; db test `a-photo-needs-no-words`.
- **CHAT-02** — the supplier's customer-card Files tab read `attachment_url` (legacy, no writer since
  2026-09-09) and not `attachment_r2_key`, so every chat file listed as "File expired" with no link. The read
  now names the column chat files live in. Guard `the-files-tab-reads-where-chat-files-live`.
- **PAY-01** — a booking made from an accepted quote ("20% on lock, balance 14 days before") froze a 50/50
  ESTIMATED payment plan, because the freeze read only the service's schedule template. With no template, the
  freeze now copies the accepted quote's own amounts (fixed centavos, never re-derived); the 50/50 estimate is
  left only for a booking with neither. Measured in prod: the five newest estimated plans were all over an
  accepted 20% quote. Existing plans are NOT rewritten (see PR). Guard `a-booking-freezes-the-plan-it-agreed-to`.

SPEC IMPACT: None — restores agreed behaviour; no new rule or number.
