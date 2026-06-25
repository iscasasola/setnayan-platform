## 2026-06-25 · feat(guests): Invite/Join v2 — name-as-answer-key, optimistic admit

The signed-in invite/join path moves from the privacy-first OTP/pending-review
claim ("never auto-admit on a name alone") to **name-as-answer-key + optimistic
admit**, unifying it with the accountless self-join the product already shipped.
A joiner types their name; it's matched against the couple's list:

- **Confident name (or exact-email) match** → linked immediately, **inheriting the
  host-assigned role** (role-by-answer-key — the submitted role is only used when
  there's no match). Honors the 0053 per-event-type `selfClaimableRoles`.
- **No match / ambiguous** → **still admitted** (never blocked), flagged
  `entry_source = 'self_added_unlisted'`, and the couple is notified to reconcile.

Changes:
- New migration `20270223808190_guest_entry_source_provenance.sql` — typed
  `guests.entry_source` enum (`host_seeded` | `self_added_unlisted`), backfills the
  prior `custom_tags['self_joined']` rows, indexes the reconcile query. Additive +
  idempotent + safe default (backward-compatible with shipped code).
- `app/join/[eventId]/actions.ts` — `joinEventAction` rewritten to the unified
  matcher (reuses `classifyClaimMatch`, ≥0.86 confident / 0.08 margin); drops the
  `processGuestClaim` OTP call + the `/verify` redirect. `selfJoinAction` now tags
  rows with `entry_source` instead of the ad-hoc `self_joined` custom tag.
- `app/join/[eventId]/success/page.tsx` — shows a "you weren't on the list, the
  couple will confirm you" note on the unlisted path (`?unlisted=1`).
- `app/dashboard/[eventId]/guests/claims/{page,actions}.tsx` — repurposed from the
  guest_claims OTP queue to the **unlisted-guest reconcile** surface: Keep (promote
  to a normal list member) + Remove (soft-delete + revoke membership). The "Confirm"
  stage badge now counts unlisted guests instead of dead guest_claims rows.

⚠ This is a **deliberate, owner-signed-off reversal** of the "never auto-admit on a
name alone" security invariant — a name isn't a secret, but for a low-stakes guest
list the UX wins; the provenance flag + host-controlled role + couple Remove are the
safety net. Deferred to follow-ups: Link/merge (dedupe an unlisted row into an
existing guest), accountless name-matching, email-link → auto-provisioned account,
and retiring the now-dormant `guest_claims`/OTP code.

SPEC IMPACT: Applied — `0000_ADDENDUM_invite_join_model_2026-06-25.md` +
DECISION_LOG.md row (2026-06-25) in the spec corpus.
