## 2026-08-01 · fix(flags): one lenient env-flag reader — a malformed flag looked exactly like an off one

The owner set `NEXT_PUBLIC_PAPIC_SEAT_ANON_ENABLED`, redeployed, and the Papic
login wall stayed up. **No error, no log line** — because the reader was strict
`=== 'true'`, and a flag that fails to parse is indistinguishable from a flag
that is off.

The repo reads booleans two ways, decided by whoever wrote each one:

```
strict  → process.env.X === 'true'                    (24 readers)
lenient → v === 'true' || v === '1' || v === 'TRUE'   (~10 readers)
```

So `TRUE` turns some features on and silently does nothing for others.

**Added** `lib/env-flag.ts` — `envFlagEnabled(value)`. Accepts `true` · `1` ·
`yes` · `on`, case-insensitive, **trimmed** (a trailing space is invisible in a
dashboard input). Everything else is OFF, and that FAIL-CLOSED default must stay:
these flags gate unfinished and compliance-sensitive features, so an
unrecognised value must never read as permission.

It takes the **value, not the variable name**, on purpose — `NEXT_PUBLIC_*` is
inlined at build time by static analysis of the literal
`process.env.NEXT_PUBLIC_X` expression, so a dynamic `process.env[key]` lookup
would read `undefined` in the browser and quietly disable the feature.

`papicSeatAnonEnabled()` now reads through it.

⚠ **Deliberately NOT a mass migration.** Converting a strict flag WIDENS what
counts as ON, and if one is already set to a variant like `TRUE` in an
environment nobody has audited, converting it would **silently activate**
whatever it gates — several of which are unfinished or waiting on DPO sign-off.
A sweep must be per-flag, by someone who checks the live value first.
`lib/env-flag.test.ts` prints the outstanding count (24 today) so the number
stays visible rather than forgotten; it deliberately does not assert on it.

SPEC IMPACT: None — flag parsing only. No flag's live behaviour changes unless
its value was already a spelling the strict reader rejected, which is the bug.
