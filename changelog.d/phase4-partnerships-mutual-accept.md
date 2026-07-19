## 2026-07-01 · feat(vendors): vendor partnerships → mutual-accept handshake

Phase 4 of the vendor-dashboard reorg: rip-and-replace the admin-verified
partnership model with a two-vendor mutual-accept handshake. A partnership badge
now goes live for couples only when BOTH vendors agree — the proposer proposes,
the recipient accepts. Admin two-eyes verification is no longer the visibility
gate.

**Schema** (migration `20270403305164_vendor_partnerships_mutual_accept.sql`)

- `vendor_partnerships.status text NOT NULL DEFAULT 'accepted'` (CHECK IN
  `proposed`/`accepted`/`declined`/`withdrawn`) + `accepted_at timestamptz`.
  DEFAULT is deliberately **'accepted'** so every PRE-EXISTING row stays publicly
  visible after the migration (they were already live badges — flipping them to
  'proposed' would silently unpublish real relationships). NEW rows are forced to
  'proposed' by the proposer INSERT policy.
- `admin_verified` is **kept** (not dropped) to avoid breaking historical rows +
  the admin queue during transition; visibility simply stops being gated on it.
- New UNIQUE index on the UNORDERED pair
  (`LEAST(recommending,recommended), GREATEST(...), relationship_type`) so A→B and
  B→A can't both exist for the same relationship_type (reciprocal duplicate).
- New RLS (RLS was already enabled on the table):
  - public SELECT `is_active AND status='accepted'` (replaces the old
    `is_active AND admin_verified` gate);
  - authenticated parties SELECT (proposer OR recipient) in any status — powers
    the inbox;
  - proposer INSERT `recommending ∈ current_vendor_profile_ids() AND status='proposed'`;
  - recipient UPDATE `USING recommended ∈ mine`, `WITH CHECK recommended ∈ mine AND status IN ('accepted','declined')`;
  - proposer UPDATE `USING recommending ∈ mine`, `WITH CHECK recommending ∈ mine AND status='withdrawn'`;
  - admin FOR ALL unchanged.
  RLS reasoning (documented inline): the two permissive UPDATE policies OR-combine
  their WITH CHECK, but because the table enforces `recommending <> recommended`
  no single vendor is both parties on a row, and each party's WITH CHECK rejects
  the OTHER party's target status — so a recipient can't withdraw and a proposer
  can't accept.
- `public.vendors_worked_together(a,b) → boolean` and
  `public.vendor_worked_with_ids(for_vendor) → SETOF uuid` SECURITY DEFINER STABLE
  helpers derived from `event_vendors` marketplace co-occurrence (both vendors on
  the same `event_id`). Surfaced as an ELIGIBILITY HINT in the propose picker, not
  a hard block. GRANT EXECUTE to authenticated.

**Vendor UI + actions** — `/vendor-dashboard/partnerships` rebuilt as a two-way
inbox: incoming proposals (Accept / Decline), sent-awaiting-response (Withdraw),
and live Partners, plus a propose form that floats "worked-together" vendors to
the top. New `app/vendor-dashboard/partnerships/actions.ts` with
propose/accept/decline/withdraw — all via the user-scoped Supabase client (RLS is
the boundary), vendor_profile_id resolved server-side (never trusted from the
form), each write additionally scoped to a still-`proposed` row so a stale button
can't re-transition a resolved partnership.

**Explore badge FLIP (required)** — `app/explore/page.tsx` partnership-badge query
changed `admin_verified=true` → `status='accepted'`. Without this flip ALL badges
vanish (nothing is admin_verified under the new model). Comments/types updated to
"mutually-accepted".

**Security holes closed in the admin path** — the now-unused vendor-side
`submitPartnershipClaim` action was REMOVED (it inserted with no explicit status →
would default to 'accepted' → auto-publish without recipient consent). HQ manual
create (`createPartnershipHq`) now sets `status='proposed'` so an HQ-recorded
partnership also lands in the recipient's inbox to accept (no auto-publish). Admin
page copy updated to describe the mutual-accept model.

SPEC IMPACT: Vendor partnerships model changes from admin-verified declaration to
two-vendor mutual-accept. `vendor_partnerships` gains `status` + `accepted_at`;
public visibility gate moves from `admin_verified` to `status='accepted'`;
`admin_verified` retained as a vestigial admin annotation (no longer public-
gating). New unordered-pair UNIQUE index prevents reciprocal duplicates. New
`vendors_worked_together` / `vendor_worked_with_ids` RPCs. `/vendor-dashboard/
partnerships` becomes a two-way inbox; explore badge query flips to
`status='accepted'`. Vendor `submitPartnershipClaim` removed; HQ create now
proposes (recipient must accept). NOTE for follow-up: the admin partnerships queue
+ queue-count filter still key on `admin_verified=false AND is_active=true`, so
they now list rows that are actually pending VENDOR acceptance (not HQ review) —
the admin two-admin approve flow flips only `admin_verified` and no longer
publishes; a later pass should re-scope or retire that admin queue. (Corpus
DECISION_LOG append deferred — this worktree is isolated from the shared spec
corpus and parallel sessions are editing it concurrently; this fragment carries
the full record.)
