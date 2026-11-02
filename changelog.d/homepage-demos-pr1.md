## 2026-07-03 · feat(home): Papic live demo — PR-1 of the homepage dock-tile demos program

Owner request 2026-07-03: give the Papic hero dock tile a live, no-signup
product demo, built on a scaffold generic enough for Panood and 3D Plan to
reuse (DECISION_LOG 2026-07-03).

- **`demo_sessions` table** (migration `20270504750637`) — the generic
  scaffold. One row per demo open, holding ONLY bookkeeping (`demo_kind`,
  two unguessable tokens, join flags, a shot counter, `expires_at`). RLS
  enabled with **zero policies** — every read/write goes through Server
  Actions on the service-role admin client, the same pattern
  `/papic/join/[token]` already uses to resolve anonymous tokens. No photo,
  face descriptor, or PII column exists on this table — deliberately
  stricter than "auto-purge," since there's nothing biometric here to purge.
- **`lib/demo-sessions.ts`** — mint / resolve / mark-joined / purge. Every
  overlay open mints a brand-new token pair (owner rule: codes are never
  reused); `resolveDemoToken` lazy-expires and fails closed to `null` on
  ANY error (mirrors `resolveKind()` in the real Papic join flow) so a dead
  or malformed token never crashes to the global error boundary. Purge is
  `after()`-piggybacked on real traffic — no polling cron.
- **Papic demo, end to end:** the homepage Papic hero gets a "Try the live
  demo" CTA → `PapicDemoOverlay` mints a session and shows two QR codes
  ("You" / "A friend") that flip to a live checkmark via Supabase Realtime
  presence (`demo:{sessionId}` channel, same convention as
  `use-seating-presence.ts`) as each phone scans in. Scanning lands on
  `/papic/demo/[token]` — a consent screen, then an on-device face
  registration step reusing the shipped `embedSingleFace` (face-api.js,
  128-d descriptors) pipeline.
- **PR-1 SCOPE (flagged, not silent):** ends at "face registered." Capture,
  theme picking, live cross-phone face-tagging, the 3-shot cap, and
  save-to-phone are explicitly PR-2 — both the join page and the overlay
  say so in-product rather than pretending to be further along.
- **Privacy deviation from the literal spec, surfaced for sign-off:** no
  photo or face descriptor is uploaded, stored, or relayed through Realtime
  broadcast in this PR — a registered face vector stays in that phone's own
  tab memory. This is a stricter reading of "face data never enters a
  durable store" than the original brief's "auto-purge" framing, and
  deliberately does NOT reuse the real Papic R2 upload pipeline (a demo
  session is not a real event). PR-2's cross-phone matching design should
  get an explicit look before it ships, since it's the point where a
  transport decision for the vector becomes unavoidable.

Verified: migration validated in a rolled-back `psql` transaction (idempotent
re-run, correct schema, RLS on with no policies) — not applied out-of-band,
per standing convention; ships as file → PR → CI auto-apply. `tsc --noEmit`
clean, lint clean (one pre-existing warning), production build passes.
End-to-end checked against the **production build** (`next start`), not just
dev — the overlay opens with correct styling and a graceful "couldn't start"
message pre-merge (expected: the table doesn't exist yet locally and the
service-role key is redacted in this worktree's env), and the join page's
"this demo link expired" dead-end renders correctly styled. A dev-server
Fast-Refresh glitch on the freshly-added dynamic route momentarily looked
like a missing-CSS bug; the prod-build check (per
`feedback_setnayan_verify_with_prod_build`) confirmed it wasn't real.

SPEC IMPACT: DECISION_LOG.md row 2026-07-03 (Papic live demo PR-1 + the
no-persistence privacy decision, flagged for owner sign-off).
