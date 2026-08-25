## 2026-08-26 · feat(admin): three more queues settle without leaving the list

Settle-in-place goes from **7 of 19 queues to 10** — corrections, subscriptions and payout
destinations join. All three are **forms**, because each action must be told which way the
decision went.

🛑 **IT WAS FOUR, AND THE FOURTH IS DELIBERATELY EXCLUDED.** `vendor-partnerships` has no
approve path — its own queue definition says these rows *"wait on the RECIPIENT VENDOR, not
on us; the only admin control is a **veto**."* A lone Reject button on a list built for
speed is the wrong affordance: there is nothing here to approve, and offering only the
destructive half invites it.

**The rules that made these safe, each pinned by the new guard:**

- ⚠ **`removePaymentMethod` is NOT reachable from the list.** Deleting where a supplier gets
  paid is irreversible and belongs on its page with a confirmation. The drawer offers
  exactly **approve** or **hold**.
- 🔑 **No wrapper defaults.** An unrecognised answer **throws** — a default silently picks a
  side of somebody's decision.
- 🔑 **Only a redirect is swallowed.** These page actions end in `redirect()` (corrections 5 ·
  subscriptions 8 · payment-options 1), which Next signals by throwing. The shared helper
  catches only a `NEXT_REDIRECT` digest; a real failure is a plain Error and is rethrown, so
  **a refusal can never read as success**.
- 💰 **A purchase with no payment reference gets NO form** and a sentence instead — the same
  rule the payments queue lives by, because approving activates a paid plan and you cannot
  confirm money you cannot see.

The correction row shows the field, what it says now and what the shop wants, because a
correction that cannot be compared cannot be judged.

Verification: `tsc --noEmit` **exit 0**; unit suite **10,060 pass / 0 fail**; **eleven** lint
scripts, all exit 0.

SPEC IMPACT: None — no rule, price or behaviour changes; three queues gain an inline form.

### 🪤 One of my own assertions was decoration, and the sabotage that proved it also missed

Two failures in one check, both worth recording:

1. **The assertion was too wide.** *"Only a redirect is swallowed"* sliced from the helper to
   **end of file** and matched `throw e;` anywhere in the remainder — so deleting the digest
   guard left a *different* function's rethrow satisfying it. Scoped to the helper's own body
   and anchored to the guard **line**, not the two words.
2. **The sabotage hit the wrong line.** Two identical `!digest.startsWith('NEXT_REDIRECT')`
   lines exist in that file, and `perl -0pi -e s/…/…/` without `/g` deleted the **first** —
   in `publishReviewFromWorkList`, not in the new helper. The occurrence count still moved
   (3→2), which is exactly what a landed mutation looks like.

🔑 **A COUNT THAT MOVED IS NOT PROOF THE RIGHT THING MOVED.** Re-run targeting the helper's
own body: 1→0, and the check goes **red**.
