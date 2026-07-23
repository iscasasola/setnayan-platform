## 2026-07-23 · feat(chat): chatroom blocked-rules — BLOCK off-platform-contact messages (flag-dark)

Owner: "on chat, block messages containing contact numbers / facebook / viber / messenger / whatsapp / blue app / purple app / ig / email / other means to communicate outside. no patterns of showing a number — `09178807163`, spaces in between, `0 9 1 7 …`, text/letters/words between the digits, `09XX`, `+63`, or other. best to have chatroom blocked rules + a list of text that isn't allowed." Enforcement chosen (owner): **Block** — the message won't send; also recorded.

**Why.** Setnayan's economy assumes the deal stays ON the platform (vendor booking fee + vendor subscription + couple SKUs). Chat is the biggest disintermediation leak.

**Detector — `apps/web/lib/chat-contact-filter.ts` (pure, 22 unit tests).** `evaluateMessage(body)` → `{ blocked, categories[], matched[] }`. Evasion-resistant PHONE detection, two tiers: **(1)** normalize spelled-out digits → numerals, collapse short filler (spaces/punctuation/brief words, ≤20 chars) BETWEEN digits, then match PH mobile / `+63` / `09XX` / no-leading-0 shapes — so `0917 880 7163`, `0 9 1 7 8 8 0 7 1 6 3`, `0917 my number is 8807163`, `zero nine one seven…`, `O917-880-7163` (letter-O for 0), and `+63…` all resolve and block; **(2)** an 11+-digit run via only tight phone separators (space/parens/±/-) for international/long numbers ("or other"). Both keep legit text safe: two numbers split by a clause ("150 guests … 80000 budget"), a comma-separated number list ("5, 10, 3, 200, 50"), and a datetime ("2026-09-17 14:30") all pass. Plus email (+`(at)/(dot)`), social/messaging URLs, `@handle`, and an **editable `BLOCKLIST` array** = the "list of text that isn't allowed" (app names incl. word-boundaried `ig`/`fb`, colour euphemisms `blue/purple/green/pink app`, solicitations). One place to tune what the chatroom blocks.

**Enforcement — the ONE shared chokepoint `sendChatMessageCore` (`apps/web/lib/chat-send.ts`).** When enabled, a tripping message is **blocked before any insert/upload** (new result code `contact_blocked`), for BOTH couple + vendor, across web action AND native JSON send (`api/vendor/chat/[threadId]/send`, mapped to 422). The composer (`chat-send-form.tsx`) runs the same pure detector client-side for **instant** feedback (shows the reason, keeps the text to edit); the server is the authority (no-JS + native). System/bot messages bypass the core → exempt.

**Record — migration `20270920573307_chat_message_flags.sql` · METADATA ONLY.** Each blocked attempt records categories + hit_count + sender/context (`outcome='blocked'`, `message_id` null — nothing was inserted) — **never the message text**, per the 2026-06-22 owner-locked admin-no-chat-read invariant (`lint-admin-chat-guard`). Admin-only RLS. Surface `/admin/chat-flags` (spot repeat pushers) + nav entry.

**Ships DARK.** Gated by `NEXT_PUBLIC_CHAT_CONTACT_FILTER_ENABLED` (default OFF · client+server read one value). OFF ⇒ send path byte-identical to before. Owner flips on after pushing the migration; test on a dummy thread.

Accepted tradeoff (owner chose Block): aggressive number detection will occasionally block a legit digit-heavy message — the sender just rewords. Text-only (image OCR + Tagalog spelled-digits = follow-ups).

Tests: `chat-contact-filter.test.ts` (19), `chat-contact-filter-flag.test.ts` (3). Typecheck + lint clean.

SPEC IMPACT: New anti-disintermediation policy on iteration 0019 (Communications). Logged in `DECISION_LOG.md` (2026-07-23). Corpus stub unchanged (2026-07-02 archive-stub rule — code is canonical).
