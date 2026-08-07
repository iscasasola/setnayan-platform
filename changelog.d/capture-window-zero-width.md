## 2026-08-07 · fix(papic): the camera refused every shot — the capture window was one millisecond wide

**This is why Papic has never stored a single photo.**

`paparazzi_seats.valid_from` / `valid_until` are **DATE** columns, so the API
returns `"2026-09-19"`. Both capture gates called `Date.parse()` on that — which
is midnight **UTC**, i.e. **08:00 Manila**. A one-day window writes the *same
date* into both columns, so start and end landed on the **same instant**.

**The window was open for about one millisecond, once, at 8 AM on the event day.**

Measured in production: **six of thirteen seats** carry
`valid_from = valid_until` — and **both seats anyone has ever claimed are in
that set**. Two real people claimed a camera, and every shot they took was
refused.

### It was worse than a refusal — it looked like success

The 403 carried **no error code**. The client turned it into a generic
`Error('presign')`, which is not in the terminal-error set — so the shot went to
the **durable offline queue** and **the shot counter still went up**. The
photographer was shown nothing and had every reason to believe the photo was
taken.

*A refusal nobody can see is indistinguishable from success.*

### Fixed

- **One shared helper**, `captureWindowState()` — a DATE means a whole Manila
  day, 00:00:00 to 23:59:59.999 at +08:00. Both gates now call it, so the
  comparison cannot drift in two places again.
- **The 403 now carries a code**, and the client re-throws it by name so it
  reaches the terminal set instead of being queued and retried forever.
- Fails **open** on null or unparseable bounds — a legacy seat is never bricked.

🛡 **Sabotage-tested.** Reverting to the shipped `Date.parse()` fails two tests
by name, including one that asserts a 2 PM ceremony is inside the window.

⚠ **RUN THIS UNDER `Asia/Manila`.** In UTC the start bound looks correct —
midnight UTC really is the start of the UTC day — so a UTC-only suite is blind
to it. **That is exactly how it shipped, and CI runs UTC.** 7058 tests pass in
both.

### Not fixed here, deliberately

The seven seats with **null** bounds already worked and still do. The durable
follow-up is migrating those two columns to `timestamptz` so the write stops
being lossy — a schema change, worth its own pass.

SPEC IMPACT: None.

## 2026-08-07 · fix(papic): shooting opens 6 months out; high-res survives 3 months past the event

Owner rulings, same sitting, in order: cameras may start *"up to 6 months away from
the event itself"*, and we *"still preserve 3 months all their photos in high res
before we compress it."*

- `PAPIC_CAPTURE_MONTHS_BEFORE` **5 → 6**, and the no-window DEFAULT now opens six
  months before the event instead of a **single day**. That one-day default —
  mislabelled "legacy" while applying to every event whose couple never opened the
  picker — is what wrote `valid_from = valid_until` onto 6 of 13 production seats.
- `FULL_RES_POST_EVENT_GRACE_DAYS` **30 → 92** (the longest three calendar months,
  so "three months" is true for a March wedding as well as a December one).
- New `start_too_early` refusal, wired into **both** copy maps. The generic
  fallback previously told someone who *had* picked a start date to "Pick a start
  date."

🔑 **Six is NOT derived from retention, and the first draft of this change made it
so.** `5 = 6 months − 1 month` was elegant and wrong: with capture at six months the
first-capture clock expires **on the wedding day**, so the same subtraction now
"proves" the promise is zero days. The promise was never carried by that number —
it is `GREATEST(first_capture + 6 months, event_date + 3 months)` in migration
`20271102113000`. Shoot six months out and originals live three months past the
wedding; shoot on the day and they live six.

🪤 **A guard I wrote was decoration and a sabotage run caught it.** The SQL check
matched `NOW() >= (f.event_date`, so renaming the column to `f.event_dateX` still
matched *on the prefix*, and prefixing the clause with `OR TRUE` — which neuters it
entirely — left every searched string intact. Both went green. It now matches the
arithmetic with a `\b` boundary, bans the tautology, and strips SQL `--` comments
first (the migration's own header names `p_post_event_days`, so a comment alone
satisfied the identifier check). Four sabotages run; three caught here, the fourth
(renaming the RPC argument) is covered by `rpc-argument-names.db.test.ts`.

🪤 **The baseline was red during the first sabotage run**, which made two results
meaningless — `[^\n]` could not cross the line break in the wrapped SQL clause.
Verify the baseline is green *and* that the sabotage applied, or the run proves
nothing.

Tests rewritten rather than deleted: `papic-window.test.ts` asserted `days === 1`,
which was the bug written down as a requirement. Green under UTC, Asia/Manila and
Pacific/Kiritimati.

SPEC IMPACT: Yes — `Data_Retention_Schedule_2026-07-11.md`, corpus `CLAUDE.md`,
`0012_papic/Papic_Pricing_Lock_2026-07-20.md` (still documents the retired 90-day
model) and the public `/privacy` copy all carry the superseded 5-month / 30-day
pair. Applied separately.

### Same PR · the public privacy notice, and the guard that now ties it to the code

Raising the floor 30 days → 3 months made the live `/privacy` notice **understate**
what we hold. That is a breach in the quieter direction: RA 10173 storage
limitation binds us to the period we **declare**, nobody complains about getting
more than promised, and the notice is still false.

New guard in `retention-copy-is-true.test.ts` **derives** the month figure from
`FULL_RES_POST_EVENT_GRACE_DAYS` and asserts the notice states it. Moving either
one alone now fails — sabotaged both directions. This is copy-vs-CODE, not two
hand-typed strings agreeing with each other, which is how `llms.txt` drifted for
three weeks with green CI.

🪤 **The coupling is why this is not a separate PR.** Split out, the constant lands
on `main` first and `main` sits with a notice that understates retention. The
first draft *was* a separate branch and its CI went red immediately — the guard
caught its own author.

### Same PR · "not delete — compress", everywhere (owner-corrected twice)

Owner, verbatim: *"again. not delete. just compress."* **No photo is ever deleted.**
A compressed copy is derived at capture time and kept forever; all the sweep does is
stop holding the full-resolution ORIGINAL once that copy is confirmed. The code has
always worked this way — `isEligibleForDrop` returns `false` when no compressed copy
exists, commenting *"dropping would LOSE the photo"*. **Only the vocabulary was
wrong**, and a 16-agent sweep found 19 verified places carrying it.

🚨 **THE GUARD THAT WAS SUPPOSED TO CATCH THIS HAS BEEN BLIND ITS WHOLE LIFE.**
`retention-copy-is-true.test.ts` bans the exact phrase `5-year backup`. The couple's
Photo Delivery page says *"your Setnayan-side 5-year backup stays intact"* — and the
test never fired, because JSX wrapped it as `5-year\n              backup` and
`/\b5-year backup\b/` needs one space. The source is now whitespace-normalised
before matching; the fix immediately turned the suite red on the live page, which is
the only reason we know the guard can fire at all.
🔑 **A pattern that cannot survive the code formatter is decoration.**

**Customer-facing fixes (this is what the owner asked about):**
- **Photo Delivery page** made THREE false claims in one warning box: a "30-day
  window" that exists nowhere; *"Setnayan compresses the Drive originals"* — we never
  touch the couple's own Drive, we only add to it; and a *"5-year backup"* that does
  not exist. It never mentioned that the gallery is kept for good, so it could only
  cause panic. Rewritten.
- **"Delivery complete" screen** said *"Your Drive folder is the copy that lasts"* and
  stopped at "6 months" — omitting the half that matters. Now matches the correct
  wording already used earlier in the same file.
- **Public `/tl/features`** still carried both halves of a promise the English twin was
  corrected for months ago: an invented "30-day grace window" and *"Itago ang raws mo
  hangga't kailangan mo"* — literally "keep your raws as long as you need".
  🔑 **A copy fix is not done until every language is fixed;** the English correction
  read as complete because its own file looked fixed.

Plus six internal comments/tests whose grammatical object of "delete" was *the photo*
rather than *the original file* — the vocabulary the next author inherits.

Typecheck clean, 7060/7060 unit tests green, all 12 `lint-*.mjs` clean.
⚠ The broken-comment syntax error this introduced was invisible to the test runner
and caught only by `tsc` — `tsx --test` is not a typechecker.
