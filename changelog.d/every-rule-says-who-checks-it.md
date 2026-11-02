## 2026-09-07 · docs+test(rules): every locked decision says who checks it

Step 2 of the guard programme: take the rules every session is told to follow,
break each one, and see whether anything fails.

**Tested by breaking them:**

| rule | result |
|---|---|
| token wallet retired | ✅ `lib/token-economy-is-retired.test.ts` fails on a live `token_grant_count` |
| brand never "STNYN" | ✅ `lib/one-mark-everywhere.test.ts` fails on a rename in the watermark AND in an ordinary lib module |
| **no SMS in V1** | ❌ **nothing fired** — an SMS sender in `lib/` left all 13,619 tests green |
| **no public API endpoints** | ❌ **nothing fired** — an unauthenticated public `GET /api/public/v1/events` passed |
| **no manual video editor** | ❌ **nothing fired on the rule** |

⚠ **The video editor deserves its own line, because it looked guarded and was
not.** A top-level `app/video-editor/` turned two tests red — but they were the
reserved-slug guard reacting to a *new top-level folder*, which any new page
would trip. Moved to `app/dashboard/[eventId]/video-editor/` — where anyone
would actually build one — the only failure was "no NEW page grows a second
main", i.e. the `<main>` tag. **Both catches were incidental. Counting either as
enforcement would have been a false all-clear.**

**Built:** `apps/web/lib/no-sms-in-v1.test.ts` — bans an SMS provider dependency
and an SMS-sending symbol. Mutation-tested three ways: the dependency fails it,
the sender fails it, and copy that merely *mentions* SMS correctly does not
(banning the noun would fire on the sentence saying we don't send texts).

**Labelled** (owner ruling 2026-09-07: unenforceable rules stay, marked, rather
than being deleted). Every locked decision in `CLAUDE.md` now carries **✅ CHECKED
BY <file>**, **⚠ NOBODY IS CHECKING THIS**, or **❓ NOT YET TESTED** — the last
used honestly for the two the sweep did not reach (entity IDs, RLS patterns)
rather than implying either answer.

**Two rules cannot be guarded yet, and that is a question for the owner, not a
gap in effort:** nothing mechanically separates a "public API endpoint" from the
111 `/api` routes the app already serves itself, and nothing defines what counts
as a "manual video editor". Both are labelled with exactly that.

**Also corrected:** `CLAUDE.md` said *"Brand strings centralized in
`brand.config.ts`"*. **That file does not exist anywhere in the repo.** The brand
string is spread across `lib/`. Found while mutating it — a rule citing an
imaginary file.

SPEC IMPACT: None.
