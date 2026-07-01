## 2026-07-02 · feat(website): manual vs automatic launch + in-context host bar

Owner: *"there should be a manual toggle to set it automatic or manual launch,
whichever website they want. activating one will deactivate the other … so
technically, we can access the save the date, rsvp, event and editorial."*

The public `/[slug]` wedding website advances through four lifecycle phases
(save_the_date → rsvp → event → editorial). Until now that phase was ALWAYS
date-driven. The couple can now flip their site between:

- **Automatic** — phase follows the event date (`getLifecyclePhase`, unchanged).
- **Manual** — pin ONE phase; it stays live for every visitor until switched
  (single-select — activating one deactivates the others).

How:
- Migration `20270426100000` — `events.launch_mode` (`auto`|`manual`, default
  `auto`) + `events.manual_phase` (nullable, 4-value CHECK). Plain columns on the
  RLS-enabled events table; `couple_can_update_event` already governs writes.
- `lib/invitation-widgets.ts` — new `manualLaunchPhase()` resolver;
  `app/[slug]/page.tsx` now resolves the effective phase as
  `phaseOverride ?? (manual pin) ?? getLifecyclePhase(date)`, so a manual pin
  applies to EVERY visitor (both `lifecyclePhase` and `dayOfPhase`). Launch state
  is read tolerantly (separate select) so a not-yet-migrated DB degrades to auto
  instead of 404-ing the page.
- New `app/[slug]/_components/launch-host-bar.tsx` — a fixed, COUPLE-ONLY control
  bar rendered on the couple's own live page (isCoupleHost gate; anonymous guests
  pay zero host lookups). Segmented control: Automatic (shows the date-driven
  phase) + the 4 phase pins, optimistic with rollback.
- `app/[slug]/actions.ts` — `setLaunchMode()` server action, couple-gated
  (mirrors requireCouple; write through the couple's authed client so RLS is the
  real enforcement), revalidates the public path.
- Reaches the couple via the existing dashboard "Launch" → live-site nav
  (PR #2556); no new nav entry.

SPEC IMPACT: None blocking — additive website-control feature; two new nullable/
defaulted columns on `events`, no SKU/pricing/RLS-pattern change. Migration
applied to prod.
