## 2026-08-02 · sec(erasure): a paid Papic seat, held forever by a deleted account — and why freeing it required rotating the token in the same statement

Erasure named neither `paparazzi_seats` nor `panood_camera_operators` (verified — zero references in `coverage.ts`). So `claimer_user_id` survived as a dangling uuid pointing at an account that no longer exists, and both claim paths refuse a row that already has a claimer:

```ts
if (seat.claimer_user_id) return 'taken';   // app/papic/actions.ts
if (cam.claimer_user_id)  return 'taken';   // app/panood/actions.ts
```

**The couple paid for a Papic seat that nobody can ever claim again.** It is held by someone who deleted their account, and RA 10173 obliges us to clear that reference regardless. 13 seats and 16 camera slots carry claimed tokens in prod today.

### ⚠ The obvious one-line fix is the actual security defect

Nulling `claimer_user_id` alone — what every other construct in `coverage.ts` would do — flips the row back to `claimable`. The erased person's QR is still printed, still in their hands, and still points at that exact token. **Freeing the seat without rotating hands it straight back to them.**

So the rotation isn't the fix; it's the precondition that makes the fix safe, and the two must land in one statement. That's why this is neither a null-map nor a row-delete. `reissuePanoodCameraToken()` already paired unclaim-with-rotate for one table — erasure just never called it.

The token is **replaced, not nulled**: `claim_qr_token` is NOT NULL on both tables, and a nulled seat could never be re-issued.

### Both halves are proven, separately

The test asserts the old token resolves to nothing *and* the seat comes back claimable, because either alone is a defect. Removing each half in turn:

| purge does | result |
|---|---|
| freed, not rotated | **32/33** — old QR is a live door |
| rotated, not freed | **32/33** — seat still ghost-held |
| neither (today's `main`) | **32/33** |
| both | **33/33** |

`ERASURE_COLUMN_WRITES` derives its entries from `CLAIM_TOKEN_ROTATIONS` rather than repeating the column names, so a typo is a G1 phantom-column failure instead of a silent PGRST204 the best-effort purge logs and walks past. Both tables leave `UNDECIDED_BACKLOG` (82 → 80).

### ⚠ One statement per ROW, not per table — both token columns are UNIQUE

`claim_qr_token TEXT NOT NULL UNIQUE`, and `panood_camera_operators_claim_qr_token_key`.

A single `.update({ token: freshClaimToken() }).eq(subject, id)` writes the **same** value to every row the person claimed. Anyone holding two seats — two events, or two seats at one event — trips the unique index, the statement fails whole, and the best-effort `step()` logs `erasure_purge_failed` and moves on. **Nothing is freed, for exactly the people most likely to have two seats.**

That is the same swallow-the-failure shape as the `events.owner_email` PGRST204 bug this file's G1 guard exists to catch. Caught by reading the diff, not by the test: the seed used one seat per table, so it passed clean. The seed now creates a second seat for the same subject.

| purge does | result |
|---|---|
| one update per table | **30/33** — including *"a full erasure logs ZERO failures"* |
| one per row | **33/33** |

That failing regression is the tell — the error never surfaces, it is absorbed into an audit row.

### 🔴 The database performs the unclaim by itself — and that hole was LIVE

An adversarial review of this PR's own claims found the real version of the risk I had originally invented.

`paparazzi_seats.claimer_user_id` is `REFERENCES auth.users(id) ON DELETE SET NULL`, and `claim_qr_token` is **not** in that clause. So *any* hard-delete of the auth row unclaims the seat and leaves the printed QR intact.

`runAnonDraftSweep()` does exactly that. It hard-deletes login-free claimers 30 days after they claim, and its only guard looks for `event_members` rows with `member_type='couple'` — `papic_claim_seat` never inserts one, so `eventIds` is empty and the legal-hold block is skipped in full. It fires on every admin page render via `after()`.

Result: `seatClaimability()` flips from `taken` back to `claimable`, `papic_claim_seat`'s `AND claimer_user_id IS NULL` passes, and **the QR that person walked in with becomes a working claim credential for whoever holds it.**

The owner set `NEXT_PUBLIC_PAPIC_SEAT_ANON_ENABLED` on 2026-08-01, so with the 30-day TTL the earliest this could fire is ~2026-08-31. Fixed before it can: the sweep now rotates through `CLAIM_TOKEN_ROTATIONS` **before** deleting, and **fails closed** — if it cannot revoke the QR it skips the delete rather than arming it.

### A guard for the next table of this shape

`lib/erasure/unclaim-on-delete-guard.test.ts`: any table with **both** a bearer token column and a column that goes NULL when an auth user is deleted must be rotated, or excluded with a written reason. It also asserts the rotation appears *before* the delete in the sweep — rotating after is too late, the FK has already fired.

It immediately surfaced three more tables, all verified false positives of the heuristic and recorded as reasoned exclusions rather than narrowing the scan (a narrower regex would stop asking about tables that genuinely need an answer):

| table | why it is not the hazard |
|---|---|
| `guests` | the nulled column is `photo_set_by_user_id` — who set the photo. `qr_token` identifies a guest for tagging and is meant to keep working |
| `community_invite_tokens` | `created_by` is the invite's **author**; an invite is as valid after its author leaves |
| `vendor_creator_offers` | `reach_token_ref` is the vendor **token currency**, an audit handle — not a QR |

### Two tables were cut — and my first reasons for both were wrong

The review refuted 5 of 6 claims this PR made. Two were the justifications for these cuts:

- I cited `if (invite.status !== 'pending') return null` at `lib/vendor-invites.ts:155` as the gate. **It is inside `daysLeftFor()`, a countdown formatter.** It gates nothing; `fetchClaimLandingByToken` returns the row at every status.
- I said a claimed vendor invite token was dead. **It is not** — `resolveClaimContextForService` takes a claimed token as its *intended input* and returns the couple's `coupleDisplayName` through the RLS-bypassing admin client.

So `vendor_invites` is now recorded as **unresolved and tracked**, not settled: a residual credential does survive erasure there, but rotating it changes the guided first-service flow, which is a product decision this change should not make on its own.

`vendor_locked_qr_tokens` stays cut, and that decision holds — but because single use is enforced by the conditional `UPDATE … WHERE token = p_token AND status = 'pending'` inside `vendor_claim_locked_qr`, not by the page check I originally cited (which is one of four token-keyed readers and was never what made it safe).

Verified on `origin/main` @ `365720893`: full DB suite **726/726**, erasure guards **26/26**, `tsc --noEmit` exit 0 with zero errors.

SPEC IMPACT: None — closes a gap in an existing obligation, plus one live defect in the anon-draft sweep. Two tables move out of the erasure backlog.
