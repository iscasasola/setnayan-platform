## 2026-11-18 · fix(verification): a kept paper's typed details are accepted after three tries (W1-B37), plus B33 · B35 · B36

**B37 (live, high).** The paper seal was an HMAC over `JSON.stringify` of the slot, but `doc_uploads` is `jsonb`.
`jsonb` stores keys shortest-first, so every paper with a read came back in a different key order and its seal never
opened again. After three refused BIR copies, "Send for checking" was refused with "Type the details only after three
tries." Auto-verify also saw every paper as unconfirmed. `lib/paper-intake.ts` now seals over key-sorted JSON.
Payloads without nested objects are unchanged byte for byte, and rows already in prod open again without a migration.
Proven by `lib/the-paper-seal-survives-the-database.test.ts`, which saves through real Postgres (PGlite) between steps;
it fails on main with the owner's exact message.

**B33 + B36.** Step 5 "Send your documents" ticked when the papers were IN but not SENT. That showed a tick beside the
"Send them" chip, and the tick moved the folds to step 6 on the third upload. The step now ticks once the papers are
sent. The Shop row says "Not sent" (not "Checking") until they are.

**B35.** A kept paper says it once: "Kept for a person to check. Send your papers when ready." The upload note no
longer repeats it. "Is checking" is gone before anything is sent, "photo" is gone, and the typed-details toast says it
is saved, not sent.

**B38 + B40 (same cause as B37).** Admin › Verify ran every check as "read could not be confirmed". It also said the
permit has no valid-until date while another line gave its renewal date. Both come from the auto-check opening each
paper through the same broken seal. W3's stored result is not rewritten; a new submit reads the papers.

**B41.** Admin said "Typed by the supplier after 3 tries" when nothing was typed. It now says "Kept after 3 unreadable
tries — nothing typed" until the supplier's values are on file.

**B42.** The same toast words replace the earlier copy, so failed sends no longer stack errors over the bottom nav.
(The floating search bar covering the "Get verified" row is a layout fix, not done here.)

B34 (papers stamped "TEST — NOT VALID" read as Recognised) is logged only, not fixed here.

SPEC IMPACT: None in the corpus. Reverses the W1-B10 (16 Nov) "papers in = step 5 done" rule, per the owner's 18 Nov walk. Flagged in the PR.
