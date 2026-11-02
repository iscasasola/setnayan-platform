## 2026-07-17 · feat(people): debut happens from the alaga + email the hand-over link

Owner 2026-07-17: "yes, debut will happen from alaga."

- **Debut door**: on a person-alaga whose NEXT milestone is their debut (18 for daughters / 21 for sons — the celebration ladder, distinct from the 18-for-everyone ownership hand-over), the row now shows **"Plan {name}'s debut →"** into `/onboarding/debut`. The alaga record is the debut's origin; celebrant prefill from the alaga row can ride the counsel-gated Debut onboarding slice (PR-D) later.
- **Email the link**: beside the copy button on an active hand-over/transfer link, a small form sends it — branded Resend template (`renderBrandedEmail`) + plain-text fallback, purpose-aware copy (claim vs rehome), "works once, expires in 7 days" footnote. New `emailHandoverLink` action: flag + owner-RLS guarded, requires a LIVE token (never mints), recipient address used once and stored nowhere.

Also this session (logged for completeness — not part of this diff): the full claim flow was live-tested end-to-end with real throwaway users + real JWTs against production — sign-in, RLS insert/mint, pre-claim invisibility, hijack attempt blocked, live `/claim` page happy path on www.setnayan.com, redemption, post-claim owner rights (claimant writes ✓, former guardian read-only ✓), used-link inertness, then full cleanup (0 rows left).

Tests 9/9 · typecheck clean.

SPEC IMPACT: DECISION_LOG.md 2026-07-17 rows (debut-from-alaga · 2nd-degree cap · live-test record)
