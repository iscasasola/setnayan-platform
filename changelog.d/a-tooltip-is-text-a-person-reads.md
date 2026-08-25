## 2026-08-26 · fix(verify): a tooltip is text a person reads

Hovering the verification badge showed **`Vendor verification_state = pending_review`** —
the column name and its stored value, on screen and read aloud by a screen reader. It now
says what the state means for that shop: *"Documents are in and waiting for someone to
check them."*

🛑 **AND A CLAIM OF MINE IS WITHDRAWN.** I reported that `/admin/verify` "shows raw database
words on screen" and listed it as the one page in the owner's daily six still speaking
schema. **That was wrong.** Both of its badges already map to English —
`StatusBadge` (Draft · Pending · In review · Approved · Rejected · Withdrawn) and
`VerificationStateBadge` (via `VERIFICATION_STATE_LABEL`). My count came from a grep that
treated `{application.status}` as a raw render when it is a value **passed to a mapping
component**, and counted 15 hidden form inputs as rendered text.

🪤 **THE SHAPE THAT SLIPPED PAST YESTERDAY'S GUARD.** `the-console-speaks-english` matches
`<code>table_name</code>`, migration numbers and iteration references — none of which a
`title=` attribute contains. **A tooltip is text a person reads**, so the guard gains a rule
for it, with its own can-it-fire floor. Swept: exactly **one** real offender across
`app/admin` and `app/_components` (the other hit is a legitimate ratings tooltip whose
template happens to reference a snake_case variable).

🪤 **And tsc caught what the tests could not.** A malformed import (`type VerificationState,,`)
left the whole suite **green at 10,054 pass** while the module would not compile —
`TS1003: Identifier expected`. The tests never load that module; only the typechecker reads
every file.

Verification: `tsc --noEmit` **exit 0**; unit suite **10,054 pass / 0 fail**; **eleven** lint
scripts run this time, not five — all exit 0. The new rule mutation-checked: restoring the
schema tooltip takes it 1→0 and goes **red**.

SPEC IMPACT: None — copy only.
