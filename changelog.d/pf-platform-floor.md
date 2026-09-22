## 2026-09-22 · fix(env): the flag guard closes its set, and four drifted readers come back in

W1 / register LAU-36. `lib/env-flag.ts` has been the one boolean-env reader since
2026-08-09, accepting `true·1·yes·on` case-insensitively and trimmed. Its guard
checked every REGISTERED flag — but nothing checked for flags in no list at all.

Its last test ended `assert.ok(Array.isArray(strict), 'inventory computed')`.
`Array.isArray` of an array is always true: the test printed a count and gated
nothing. It also walked only `lib/` (one level, via `readdirSync`) and matched
only `NEXT_PUBLIC_*`.

Four readers drifted in behind it:
`CATEGORY_PROPOSAL_DRAFT_ENABLED`, `SUPPLIER_NIGHT_BEFORE_EMAIL_ENABLED`,
`VENDOR_SIGNUP_COVERAGE_SUGGEST_ENABLED` (all server-side, outside the pattern)
and `NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION` (hand-rolled `'true' || '1' ||
'TRUE'`, matching no pattern). The last one gates whether a new account must
confirm its email, and it did not trim whitespace — a trailing space in the
Vercel dashboard would have read as OFF.

All four now read through `envFlagEnabled`. The inventory test is replaced by a
closed-set gate: whole tree (~4,100 files), both operand orders, fails when a
strict reader is in neither `CONVERTED` nor `HELD_STRICT`. Runner-provided vars
(`CI`, `GITHUB_ACTIONS`, `VERCEL`, `NODE_ENV`) are excluded by nature, not by
directory, so a real flag written strictly in `scripts/` is still caught.

Proved by sabotage: a new strict reader in `app/` (a directory the old test
could not see) and the Yoda form `'true' === process.env.X` each turned the gate
red, with the printed sweep count confirming the mutation landed; restored, 12/12.

The five deliberately-strict flags are untouched — converting those is a
compliance/DPO decision, and the guard still pins both their strictness and the
note saying why.

SPEC IMPACT: None.
