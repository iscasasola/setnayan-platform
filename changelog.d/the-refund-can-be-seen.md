## 2026-08-26 · fix(papic): three silent failures in the credit meter

No new feature. Three defects in the shipped metering, all of the same family: **something failed and nothing said so.** Found by an adversarial pass over the upload design; each verified by hand before acting.

### 🚨 1 · A failed refund was invisible

Both capture paths reserve credits, and when the row then failed to land they released them like this:

```
.then(() => undefined, () => undefined)
```

🔑 **Supabase does not throw — it resolves with `{ error }`.** So the second handler almost never ran and **the first discarded a real failure**. A revoked grant, a replaced signature or a lock wait left the credits spent, the photo absent, and **nothing anywhere knowing**. Somebody is charged for a photo they do not have, in silence.

⚠ **Best-effort was right; SILENT was the bug.** A failed release must never break a camera mid-wedding, so the new shared `releaseCaptureCredits` still never throws — it just stops being invisible, and logs at the severity of the **consequence** (`will_throw`), because `graceful_degrade` reads as *"we coped"* and we did not.

🔑 **Both halves are passed back, never re-derived** — the balance has already moved, and a second read cannot tell *"spent its last credit"* from *"never had any"*.

🪤 **And the unwind was covered by nothing at all.** Deleting the release call left the whole suite green.

### 🚨 2 · A refused photo count became "0 photos taken"

The gallery count after a capture never destructured its `error`. **`{ count }` is a different shape from `{ data }`**, so a refused read came back `null` and the `?? 0` turned it into **"0"** on a camera that had just taken a picture. **An unread count is not zero.** Now checked and logged.

### 🚨 3 · An unreadable credit pool read as "this event has no fence"

The soft-stop signal — the *"running low on shots"* warning — used `fetchEventPoolStatus`, which **returns the ABSENT sentinel on a read error**, and absent means *no pool applies*. So a refused read reached the camera as **good news** and the warning silently stopped existing; a couple would meet the hard stop with no notice.

🔑 **`readEventPoolStatus` was split out for exactly this distinction** — its own docblock says so — and this caller was still on the wrong one. ⚠ The `try/catch` around it was **decoration**: Supabase resolves rather than throwing, so it could never fire on the case that matters.

⚖ **The direction of failure is unchanged and deliberate:** on an unreadable pool the camera shows *no* fence rather than inventing one. It can never widen the real gate — the reserve RPC is the gate; this is a display hint.

**🛡 Guard `lib/the-refund-can-be-seen.test.ts`** — 5 rules: the helper exists and cannot throw · **it destructures and checks the resolved `{ error }`** · it logs at consequence severity · **no capture path releases silently**, matching the original defect's literal shape · both figures are passed back rather than re-derived.

**Mutations**, counts printed before → after: the resolved error stops being checked (1→0) 🔴 · downgraded to `graceful_degrade` (3→0) 🔴 · a caller goes back to swallowing (1→0) 🔴 two rules. Green on both clean sides.

**SPEC IMPACT:** None.

---

🪤 **AND A PRE-EXISTING TEST HAD TO FOLLOW THE VALUE INTO THE CALLEE.**

`papic-guest-own-camera.test.ts` asserted the route's own source contained `papic_release_capture_split` with `p_dedicated_spent` / `p_pool_spent`. Moving the RPC into the shared helper broke it — correctly, because the route no longer contains those strings.

**It was not simply re-pointed at the helper.** Asserting only the helper would have gone green while the *route* passed it garbage; asserting only the route would have gone green while the *helper* did something else. **A function's NAME is not its behaviour.** The test now checks **both hops**: the route hands over the two real figures, and the helper spends them on one atomic call under the right argument names.

**Mutations**, counts printed before → after: the route drops a figure (1→0) 🔴 · the helper releases the wrong figure (1→0) 🔴.

**Verified locally with the toolchain installed:** `tsc --noEmit` exit **0** (printed, not piped — a piped exit code has produced a false green here before), and the full unit suite **10,139 tests, 0 failures**.
