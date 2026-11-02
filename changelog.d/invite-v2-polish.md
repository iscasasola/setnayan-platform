## 2026-06-26 · feat(guests): Invite/Join v2 polish — Link/merge + accountless name-matching

Two of the deferred nice-to-haves from the Invite/Join v2 series:

- **Link/merge** in the unlisted-guest reconcile queue — the couple can now mark an
  unlisted joiner as "actually <existing guest>" (different spelling / nickname). A
  `<select>` of the host's existing guests + a Link button; `linkGuestAction` moves the
  joiner's account membership onto the chosen guest (inheriting that guest's role),
  carries the email over, and soft-deletes the duplicate. Guards: target must be a real
  non-deleted guest; never merges into a seat already held by a different account.
  Completes the Keep / Remove / **Link** triad.
- **Accountless name-matching** — `selfJoinAction` now runs the same confident-match
  check the signed-in path uses: if a no-account joiner's typed name matches an unclaimed
  seed row, the cookie binds to THAT existing row instead of minting a duplicate
  `self_added_unlisted` row. Keeps the couple's list clean for listed guests who skip
  making an account.

No migration. typecheck ✅ · lint ✅.

SPEC IMPACT: covered by `0000_ADDENDUM_invite_join_model_2026-06-25.md` (reconcile +
name-as-answer-key). Still deferred: the `/[slug]` "claim your account" CTA (needs a
careful gating pass on the public event page so it shows only to genuinely accountless
viewers) and retiring the dormant `guest_claims`/OTP code (separate PR).
