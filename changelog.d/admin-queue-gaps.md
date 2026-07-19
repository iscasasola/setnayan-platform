## 2026-06-28 · fix(admin): close the queue-intelligence gap audit

Follow-up to the admin queue-intelligence work (#2355/#2373) — closes the gaps found in a self-audit.

- **Overview consolidated onto the shared digest (#1).** `/admin` (overview) ran its OWN 12-query duplicate of the per-queue filters (the 3rd copy — the source of the earlier drift) and showed raw counts with no urgency. It now derives every queue count + dueState from `getAdminQueueDigest()` + `deriveQueueUrgency()` (the same source as the nav badges + command center); the one queue not in the shared set (taxonomy requests — a governance queue, not a Work-nav queue) stays standalone. Action-queue tiles now escalate to **red when overdue**, matching the badges.
- **Overview → command center link (#2).** "Open the work list →" in the Action-queues header, plus "N past SLA" in the summary — so the landing connects to the ranked worklist.
- **Digest reaches you when away (#3).** Added the `runAdminDigestFlush()` `after()` hook to the **homepage `/`** (guaranteed public traffic), not just `/explore` — so on a quiet day the digest still fires.
- **Digest recipients broadened (#4).** Was `is_internal` only; now `is_internal OR is_team_member OR account_type='admin'` — mirrors the `/admin` doorway gate, so every admin who clears queues gets it.
- **Queue coverage (#bonus).** Added **user-reports** (UGC moderation) to the shared digest — a faithful single-table count. Documented 5 queues (pax-changes, completions, social-queue, pakanta, editorial-review) as **deliberate exclusions** in `QUEUE_DEFS`: their pending count / actionable age is computed (joins, multi-column age, jsonb-derived), so a head-count would show a WRONG number — they need per-queue RPCs (follow-up), not a silent approximation.
- **"All work" registry slot (#7).** Added `admin.sidebar.work-home` to `nav-registry-defaults.ts` so the new desktop entry is renamable/hideable from `/admin/menus`.
- **Send-window logic unit-tested (#8).** Extracted `sendThresholdMs` into the pure `digest-content.ts` and tested the 08:00-Manila daily boundary (incl. the before-window case).

**Deliberate decisions (documented, not gaps):**
- **#6 — badges/pill/digest stay LIVE (no cache TTL).** An ops urgency signal must be real-time; a TTL would lag the overdue escalation. The per-admin-page query cost (one cache()-deduped digest fetch) is acceptable for the low-traffic admin doorway.
- **#5 — SLA windows stay code-defined** in `ADMIN_QUEUE_META` (clear, owner-editable via a one-line PR that auto-deploys). A 15-field UI editor coupled to the urgency hot path is gold-plating; logged as a future enhancement.

### Adversarial audit (3 rounds · loop-until-dry: 9 → 2 → 0 confirmed)
A multi-agent audit (7 dimensions, each finding independently verified) then caught issues the self-audit missed — including a HIGH bug in the fix above:
- **HIGH — overview dropped 4 live queues + false all-clear.** The consolidated overview only listed 11 of the digest's queues, so subscriptions / account-deletions / user-reports / vendor-partnerships were invisible on the home page AND excluded from "X open across all queues" — a falsely reassuring "all clear" when only those had work. Added their tiles; `totalOpen` now derives from `urgency.totalOpen + taxonomy` (the digest), not the tile roster.
- **HIGH — digest burned the daily claim before confirming work.** A degraded read (all-null counts) or a quiet 08:00 silently ate the whole day's digest. Restructured: pre-check → fetch digest → bail WITHOUT claiming if `totalOpen===0` → only then the atomic claim → send. Work arriving later the same morning now still fires.
- **MED — degraded-read all-clear.** Even after the above, the overview banner read green on a *failed* digest read. Added `unknownCount` to `deriveQueueUrgency`; the banner now shows "Some queue counts are unavailable — refresh" vs a genuine all-clear (unit-tested).
- **MED — /explore hook after the catalog early-return** (bare `/explore` skipped it) → moved before the return.
- **MED — bottom-nav Work tab missing** `/admin/vendor-partnerships` + `/admin/editorial-review` (unlit on mobile) → added.
- **MED — command-center count badge** failed WCAG AA (white on champagne gold) → darkened open-state to `#8A6A2E`.
- **LOW** — stale verify sub-copy + misleading lane comments corrected.

Two HIGH and a MED here were genuine pre-merge defects an eyeball pass would've shipped. Round-3 (regression + full per-queue cross-surface matrix) returned **0** — converged.

SPEC IMPACT: None (implementation-only). tsc + 9/9 admin unit tests + nav-icon/bottom-nav guards + registry-defaults test green.
