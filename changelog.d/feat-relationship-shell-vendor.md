## 2026-07-11 · feat(vendors): vendor-side Customer Card relationship shell — tabbed mirror (flag-gated)

The vendor half of the unified Relationship Workspace (mirrors the couple side, #3093).
Behind `NEXT_PUBLIC_RELATIONSHIP_WORKSPACE_ENABLED` (default OFF), the vendor's Customer
Card renders through the shared `RelationshipTabShell` (Chat · Quote · Payments · Files ·
Schedule · Call · Details) instead of the server-URL `CardTabs`. Flag OFF = the current
page (CardTabs + `?tab=` server tabs), byte-for-byte unchanged.

- Extract-then-branch, mirroring the couple page. Reuses the existing tab bodies as-is
  (`OverviewTab`→Details, `QuoteTab`, `FilesTab`, `ScheduleTab`, `AppointmentsSection`,
  `VendorPaymentLive`→Payments, `ActivityFeed`→Details); the header (identity block +
  action row + `PipelineStrip`) is reused verbatim; only the `CardTabs` nav is dropped in
  the shell (the shell provides its own tab strip).
- **Chat tab** embeds the live vendor thread, mirroring the vendor messages thread page —
  crucially preserving the **accept-gate**: a vendor cannot reply until they accept the
  inquiry (pending → accept/decline forms only; declined/blocked → notices; accepted →
  composer). RLS session client only, `viewerRole="vendor"`, never admin.
- Mark-read is gated to the chat LANDING tab (raw `?tab` absent or `chat`) so a
  server round-trip landing on another tab doesn't clear the unread badge.
- `planRowsAll` hoisted additively (full plan array for the Payments confirm surface);
  flag-OFF plan logic unchanged.
- Adversarially verified (5 dimensions): flag-off byte-identity ✓, vendor accept-gate +
  auth/RLS ✓, RSC boundary ✓, content coverage ✓, build hygiene ✓ (the one finding —
  premature mark-read — fixed here).

SPEC IMPACT: Implements the vendor side of Relationship_Workspace_and_Appointments_
2026-07-11.md (two-sided mirror). Gated by `NEXT_PUBLIC_RELATIONSHIP_WORKSPACE_ENABLED`
(OFF in prod). Remaining shell follow-ups: desktop 3-pane, realtime, lazy-per-tab, and
reconciling the couple side's render-all vs. the vendor side's existing lazy pattern.
Logged in DECISION_LOG.md 2026-07-11.
