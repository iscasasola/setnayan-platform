## 2026-06-26 · feat(privacy): account-level face profile (opt-in cross-event reuse) — flag OFF

Owner-locked 2026-06-26 reversal of per-event face scoping: a person's face
profile can now live on their **Setnayan account** and be reused to tag *them*
faster across **any** event they attend (incl. other couples'), instead of
vectors being trapped per-event. Strictly **opt-in, OFF by default**.

Shipped entirely behind `NEXT_PUBLIC_ACCOUNT_FACE_PROFILE_ENABLED` (default OFF).
**Not enabled.** DPO sign-off on the consent copy + retention policy is required
before the flag is flipped.

- New table `public.user_face_profiles` (migration `20270306508746`) — one
  profile per account, `face_vector`/`vectors` JSONB (model-agnostic, dormant
  until embedder fills them), `source_event_ids` provenance, mandatory
  `consent_granted_at` + `consent_version`, `revoked_at`. RLS at create time:
  owner-only (`auth.uid() = user_id`) + `is_admin()`. Applied to prod (idempotent
  DDL via MCP) + ledger backfilled.
- `lib/account-face-profile.ts` — flag helper + `accountSeedsForEvent` (seeds the
  matcher only with the profiles of users who are themselves guests at *that*
  event, keyed to their own guest_id) + `refineAccountProfileFromConfirmedTag`
  (feedback loop; ready-to-wire hook — call site intentionally left for the Papic
  tag-confirmation surface, owned by another session). All no-ops when flag OFF.
- `lib/face-match.ts` — `autoTagCapture` now folds account seeds into the
  per-event enrollments before `planAutoTags` (dedupes per guest; thresholds
  unchanged). No-op when flag OFF or no opted-in attendees.
- Privacy & Data settings (`dashboard/profile`) — opt-in toggle "Remember my face
  across my events" (OFF by default) + "Forget my face everywhere" account-level
  erasure (optionally also revokes the user's own per-event enrollments). Copy
  never names the model ("Setnayan AI"). Section hidden unless flag is ON.

Guardrails honored: (1) opt-in per person only — RLS + mandatory consent, a
couple can never persist a guest's biometrics; (2) only ever recognizes that same
person — never a cross-person search index; (3) one-action account-level delete;
(4) flag-gated OFF + DPO sign-off required before go-live.

SPEC IMPACT: Reverses the locked "face detection is per-event-scoped; vector
store never reused across weddings" constraint (CLAUDE.md "Hard product
constraints" / 0012 Papic) — now per-account opt-in reuse across any event the
person appears in. Recorded in DECISION_LOG.md (per prompt, not edited here).
Thresholds (≥0.85-equivalent euclidean bands) unchanged. Go-live gated on DPO
sign-off; flag default OFF.
