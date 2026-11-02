## 2026-08-30 · docs(register): P0-b — every production switch, measured

`build-sessions/P0-b-SWITCHES.md`: all 101 boolean switches read from the Vercel
Production environment of `setnayan-platform-web` and paired with what each
flag's own reader accepts as ON, measured against `origin/main @ 0d0b265ba` —
the commit the live production deployment was built from.

The finding that changes two queued sessions: **`NEXT_PUBLIC_DEPENDENT_PEOPLE`
and `NEXT_PUBLIC_PEOPLE_CONNECTIONS` are both ON in production**, while four
code comments and both session prompts say they are off and "production-inert".
The counsel-gated dependants surface (a child's birthdate / sex / religion) and
the suggest→confirm connections flow are live; `dependents` and
`person_connections` each held 0 rows the same hour, which is nobody having used
them rather than a closed gate. C1 and C4 are unblocked and their gate
paragraphs corrected — what they ship behind those flags reaches real users on
merge. Whether the G1 DPO/counsel review cleared before the flags were flipped
is flagged for the owner, not resolved here.

Also recorded: `NEXT_PUBLIC_LIFE_STORY` is present in the dashboard **set to an
empty string**, so it reads OFF while looking set; eleven `!== 'false'` kill
switches are ON *because* nobody set them (including the full-res photo deletion
job); 47 values are Vercel-`sensitive` and unreadable by anyone, so presence is
all the register can claim (that is C8's VAPID answer — all three keys exist);
ten variables are set in production and read by nothing.

Two traps worth carrying forward. `vercel env pull` returns an empty value for a
`sensitive` variable, so "empty" and "unreadable" are the same string — 60 of
129 pulled lines were empty and only one genuinely was. And a three-line window
around `process.env.X` mis-read two readers as value/reader mismatches; both
were false and were killed by opening the file.

SPEC IMPACT: None — the register describes deployed configuration, not product
decisions. The NPC RoPA task `t1-7` in `apps/web/lib/npc-filing-tasks.ts` is now
answerable (DEPENDENT_PEOPLE ON, PABUYA_PUBLIC_ROUTE_ENABLED OFF); filing it is
owner/counsel work, not a code change.
