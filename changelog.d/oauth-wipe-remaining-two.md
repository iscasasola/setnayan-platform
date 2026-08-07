## 2026-08-07 · sec(oauth): the other two leaking disconnect paths — #4224 merged without them

**#4224 fixed 2 of 4.** It merged while a follow-up commit was still being
pushed, so the branch tip that landed carried only the Drive route. The two
paths found by widening the guard, and the widening itself, were **orphaned by
the merge**. This PR carries them.

🪤 **Auto-merge armed is not "my latest push is included."** The merge takes the
tip it had; a push racing it is simply not in the result. The only way to know is
to check the merged code, not the branch — `git show origin/main:<file>` per
file, which is how this was caught.

**The two still leaking on `main` right now:**
- `app/api/photo-delivery/disconnect/route.ts`
- `app/dashboard/[eventId]/studio/photo-delivery/actions.ts` — **not under
  `app/api` at all**

Both cleared the short-lived `access_token` and kept `refresh_token` — the
long-lived credential that actually re-opens the account and never expires on
its own. Wiping the short half and keeping the long half is the worst outcome:
it looks tidy and still holds the key.

🚨 **The guard's scope was the same mistake as the bug.** Its first cut scanned
`app/api/oauth` — the folder the code "should" live in — and could not see either
of these. It now scans by TABLE NAME across the whole `app` + `lib` tree, and
both self-checks were raised with it (≥200 files scanned, ≥3 revoking updates
matched) so a widened matcher cannot silently match nothing.

Re-sabotaged after widening: removing `refresh_token` from the fourth path makes
it fail naming that exact file. Restored, green.

SPEC IMPACT: None — completes the item recorded in `WHAT_IS_LEFT.md` §1.
