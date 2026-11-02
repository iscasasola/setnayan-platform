## 2026-09-16 · feat(papic): the venue wall says how long is left on the challenge (PAP-3)

The wall already showed the armed challenge and how many guests had answered. It never showed a
countdown — **while the database knew exactly.**

🔑 **The expiry was fetched and thrown away.** `papic_armed_challenge` has returned `expires_at`
since migration `20271188710305`, one of its eight columns. `lib/live-wall.ts` cast the row as
`{ mission_id, prompt }` — naming two — so the value arrived and was discarded between the RPC and
the render. **No migration is involved in this fix; the data was always there.**

Same family as the rest of this stream: a measurement that never reaches the render changes nothing.

### The countdown ticks in the browser, from an absolute instant

A wall is left open on a venue screen for hours. **A remaining-minutes number computed at request
time freezes at whatever it was when the page was built, and a countdown that does not move reads as
correct to anyone who glances once.** So the server sends the instant; the browser does the
arithmetic every second against the real clock, and clears its timer on unmount.

Three states, each distinct on the render:

| | |
|---|---|
| `expiresAt = null` | an **untimed** challenge — `duration_minutes` is nullable and untimed is a real, correct state. Renders **nothing**: not `0:00`, not a dash. |
| running | `12:04 left`, tabular so it does not jitter; seconds included, with no special-casing that could disagree with the boundary below |
| past the instant | **"Time's up"** — it does not go negative, and it does not remove the banner. The read decides whether a challenge is armed; the clock agrees with that boundary instead of inventing a second one. |

⚠ `measured = false` ("status unavailable") returns before the countdown renders. **A clock implies a
fact, and must never appear beside an unknown.**

State starts `null` so the server render and the first client render agree — a hydration mismatch
here flashes the wrong time on a screen in a room.

### 🛡 Mutation-checked — and one sabotage exposed a weak assertion of my own

| mutation | landed | result |
|---|---|---|
| discard the expiry again (the original defect) | 1 → 0 | **RED** |
| delete the countdown's timer | setInterval 2 → 1 | **RED** *(after the fix below)* |
| let an untimed challenge render a clock | 1 → 0 | **RED** |
| control, before and after each | — | 14 pass, 0 fail |

🔑 **The timer sabotage FIRST PASSED.** The assertion matched `/setInterval\(/` across the whole
file — and `live-wall-block.tsx` has another interval for the feed poll, so deleting the countdown's
timer left the file-level match true. **A guard that can be satisfied by an unrelated line is not
guarding this one.** Re-scoped to `ChallengeCountdown`'s own body, which is what made the sabotage
red.

SPEC IMPACT: None — completes a shipped surface.
