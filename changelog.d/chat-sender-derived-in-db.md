## 2026-08-11 · fix(chat): the database decides who a message is from, not the browser

A couple signed into their own account could post into their supplier
conversation and stamp the message as coming **from the supplier**, from
**Setnayan itself**, or from a **coordinator** — and badge it as the supplier's
AI assistant. The supplier saw words they never wrote and could delete none of
them (chat is the immutable evidence layer: no UPDATE and no DELETE policy).
Forging one supplier reply also fired the three name-reveal triggers, unmasking
that supplier's real personal name to the couple before they had ever replied.

Reproduced against a full replay of the migration corpus before the fix: all
three forged roles were **ACCEPTED**, on a thread the vendor had not yet
accepted, and `vendor_profiles.name_revealed_at`, `.real_name_unlocked_at` and
`chat_threads.vendor_first_reply_at` were all stamped as a result. The same
script after the fix: all three **refused**, nothing planted, name still masked.

**Why RLS did not cover it.** `chat_messages_member_insert` asks which
conversation the row belongs to — and the couple genuinely belongs to it. It
says nothing about who the row claims to be from. Correct stamping existed only
in `lib/chat-send.ts`, and `lib/supabase/client.ts` ships a browser client
against a public anon key, so the app layer was one `fetch()` away from being
skipped.

**The fix (migration `20271132839561`), two halves that only work together:**

1. `authenticated` and `anon` lose the table-level INSERT/UPDATE grant; INSERT
   is re-issued column by column **minus** `sender_role`, `sender_user_id`,
   `is_bot` and `created_at`. A column-level REVOKE against a table-wide grant
   is a Postgres no-op, which is why it is written the long way.
2. A BEFORE INSERT trigger (`tg_chat_messages_derive_sender`) derives
   `sender_role` + `sender_user_id` from `auth.uid()` and the caller's real
   standing on the thread, mirroring the RLS insert policy branch for branch so
   the derivation is neither narrower nor wider than the policy.

Service-role paths are untouched — every system notice, Auto-Reply Assistant
message and demo seed still states its own sender.

**The three AFTER INSERT triggers are deliberately unchanged.** They branch on
the stored role, and that value is now derived rather than supplied. Fixing it
where the value is *written* survives the fourth reader somebody adds later;
patching three readers does not.

**Beyond the brief, flagged not smuggled:** `is_bot` and `created_at` also leave
the browser's reach (same defect — the sender deciding a fact about the message
that is not theirs to decide). `lib/vendor-autoreply/inbox-hook.ts` already
*claimed* in a comment that a live user "can't set is_bot"; that was untrue
until this migration, and the comment now says what the grants actually enforce.
UPDATE is revoked outright and not re-granted, so adding an "edit your own
message" policy later cannot hand the sender columns back through another verb.
DELETE is untouched — the immutability it protects is not this change's to
re-open.

**Guards.** New `apps/web/tests/db/chat-sender-not-forgeable.db.test.ts` — 15
tests: anti-vacuity META (table/columns/enum/triggers still exist; the probing
role really is `authenticated`, is not the owner, has no BYPASSRLS; service_role
keeps its grants), behavioural (every forged role refused; a legitimate send
still works and is stamped from `auth.uid()`; a non-party refused; the name
stays masked for a couple and still reveals on a real vendor reply), and three
NEUTRALISATION tests that re-open each half in a rolled-back transaction and
show the outcome changes — including a full reproduction of the original
forgery with both halves removed.

`chat-immutable-archive.db.test.ts` updated: its UPDATE assertion expected a
silent 0-row RLS denial and now expects a `permission denied` refusal. Same
guarantee, louder.

`supabase/security/exposure-surface.baseline.txt` regenerated — 19 narrowings,
no widenings. Regenerating matters here even though the freeze passes on
narrowings: a stale baseline would let a future re-grant of the sender columns
read as "back to baseline" and slip through silently.

An earlier cut of the migration put the derivation in a standalone SECURITY
DEFINER function; `anon-rpc-surface.db.test.ts` and `exposure-freeze.db.test.ts`
both refused it as new public RPC surface. It was inlined into the trigger
instead — a trigger function cannot be reached over REST, so the fix now adds no
public surface at all.

SPEC IMPACT: None. No product rule, price, SKU or copy changes — this closes a
gap between a rule the product already had (a message is from whoever wrote it)
and where that rule was enforced.
