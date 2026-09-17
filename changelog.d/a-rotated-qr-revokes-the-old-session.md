## 2026-09-17 · fix(security): rotating a leaked guest QR now actually revokes the old session

🔴 **The re-validation existed, was correct, and never ran in production.**
`readGuestSession` re-checks a guest's embedded `qr_token` against `guests` at a
chokepoint all 24 of its consumers pass through — gated on
`GUEST_SESSION_TOKEN_CHECK`. That variable is **not set in production**
(verified: absent from `vercel env ls production`), and `envFlagEnabled` returns
false for a non-string, so the gate was permanently closed.

**The consequence inverted the feature it belonged to.** A couple who learns a
guest's QR has leaked rotates it. With the check dark the leaked browser keeps a
valid session — and because the session is valid, the app shows it the
**replacement code**. Revoking the leak handed the leak the new key.

⚠ **THE FLAG IS DELETED, NOT SET.** A flag whose production value nobody can
read is exactly how this shipped dark for months; setting it would leave the
same mechanism for the next person to get wrong. The check is unconditional now,
and switching it off is a code change a reviewer can see.

### Fail-open on a transport error is unchanged, and is why the rule is pure

A definitive mismatch revokes. A lookup that could not COMPLETE does not — a
database blip must not sign out every guest at a wedding simultaneously, whose
only way back in is re-scanning a QR they may no longer have.

🔑 That asymmetry is why "did the lookup finish" is a SEPARATE input on
`lib/guest-session-token-rule.ts` rather than being collapsed into "did it
match". A completed lookup that found **no row** (deleted guest, removed seat)
is a definitive answer and revokes; an errored one is not an answer at all.

### Guarded by execution

`lib/a-rotated-qr-revokes-the-old-session.test.ts` — 9 EXECUTED decisions across
(old token, new token) × (rotated, not rotated), plus both failure modes and the
empty-token case. Grepping for the flag's absence would prove the string is gone,
not that the decision changed.

Sabotage: restoring the flag gate reds exactly one test; collapsing
`lookupFailed` into "no match" reds two; making a missing row survive reds one.

⚠ `env-flag.test.ts` caught the leftover: its registry paired the flag with its
reader, and deleting the flag left a row guarding nothing. The guard named both
honest resolutions and the row was dropped, with a note that the FLAG went and
the feature stayed.

SPEC IMPACT: None — closes a gap between a shipped mechanism and its dark switch.
