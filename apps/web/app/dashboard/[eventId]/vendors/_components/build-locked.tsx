/**
 * BuildLocked — the Services takeover's "Lock" tab (Budget "Build"), reframed as
 * **"Your team"** behind the Explore-Replan flag.
 * Spec: `Budget_Build_Services_Takeover_2026-06-08.md` + the 0016 Plan Builder sync
 * + `Explore_Replan_BUILD_SPEC_2026-07-27.md` §3 PR-E / §2 decision #11.
 *
 * Shipped (flag OFF — unchanged):
 *   1. "Ready to lock" — the couple's BUILD PICKS (event_build_picks · Shortlist
 *      "Add to build") that aren't finalized yet. Each gets the canonical
 *      `AccordionLockButton` → finalizeVendor (the hardened conflict + soft-hold
 *      gates), relocated here from the Shortlist card per the 0016 sync.
 *   2. "Locked in" — the FINALIZED picks, read-only, with the committed total +
 *      the Date/Budget/Location summary tiles.
 *
 * PR-E adds, behind `isExploreReplanEnabled()` (prototype `renderTeam()`):
 *   • the candidate section reframed "In your build — ready to lock", each row
 *     keeping its canonical Lock ✓ AND gaining a ✕ (`removeBuildPick`),
 *   • "Still needs your decision" — the in-plan, unlocked categories in urgency
 *     order, each a doorway onto that category on the bench (the shipped
 *     `?tab=shortlist&open=<tile>` deep link, not a new navigation),
 *   • six anchor+money tiles: Date · Location · Locked · In build · Budget ·
 *     **Buffer** (= estimated budget − locked − candidates),
 *   • "Clear candidates" — MOVED here from the Plans panel (spec §8.3) so the
 *     one surface that owns the team is the one that can empty it.
 *
 * Every decision above that can be made without a DOM lives in `lib/your-team.ts`
 * and is unit-tested; this file only renders.
 */
import { Lock as LockIcon, CheckCircle2 } from 'lucide-react';
import type { PlanBudgetModel } from '@/lib/vendors-plan-budget';
import { isExploreReplanEnabled } from '@/lib/explore-replan-flag';
import { lockedGroupIdsOf, type PlansRowPick } from '@/lib/plans-panel';
import {
  bufferTile,
  stillNeedsDecision,
  teamMoney,
  type TeamDecisionInput,
} from '@/lib/your-team';
import { AccordionLockButton } from './accordion-lock';
import {
  TeamClearCandidates,
  TeamDecisionDoorway,
  TeamRemoveCandidate,
} from './team-controls';

const peso = (centavos: number) => `₱${Math.round((centavos ?? 0) / 100).toLocaleString('en-PH')}`;
const pesoFromPhp = (php: number | null) =>
  php == null ? null : `₱${Math.round(php).toLocaleString('en-PH')}`;

// Mirrors LOCKED_STATUSES in vendors-plan-budget.ts (raw event_vendors.status).
const LOCKED = new Set(['contracted', 'deposit_paid', 'delivered', 'complete']);

/** How many "still needs your decision" rows show before the "…and N more" line. */
const DECISION_ROW_LIMIT = 4;

const LOCK_BTN_CLASS =
  'mt-2 inline-flex w-full items-center justify-center rounded-md bg-mulberry px-3 py-2.5 text-[12.5px] font-semibold text-cream transition-colors hover:bg-mulberry-700 disabled:opacity-60';

/** The committed anchors shown as summary tiles atop the locked list (prototype
 *  `.lock-sum`). Date label + region come from the event; budget + committed come
 *  off the model. */
export type LockSummary = { dateLabel: string | null; budgetPhp: number | null; region: string | null };

export function BuildLocked({
  model,
  eventId,
  summary,
  planPicks,
}: {
  model: PlanBudgetModel;
  eventId: string;
  summary?: LockSummary;
  /**
   * PR-E — the live plan snapshot the Plans panel already builds on the page
   * (`currentPlan.picks`). Used ONLY through `lockedGroupIdsOf`, so "still needs
   * your decision" reads locked-ness from the same authority the Plans surface
   * does instead of re-deriving it from `raw_status` a second time. Absent →
   * the section lists nothing (the flag-OFF path never reads it).
   */
  planPicks?: ReadonlyArray<PlansRowPick>;
}) {
  const replan = isExploreReplanEnabled();

  // Finalized picks (the committed list).
  const lockedRows = model.folders.flatMap((f) =>
    f.children.flatMap((c) =>
      c.picks
        .filter((p) => p.raw_status && LOCKED.has(p.raw_status))
        .map((p) => ({
          folder: f.label,
          group: c.label,
          name: p.vendor_name ?? 'Vendor',
          cost: p.rolled_cost_php,
        })),
    ),
  );

  // Build picks NOT yet locked — the "ready to confirm" queue. Multi-pick
  // categories (Look/Booths/Prints) contribute every build pick; single-pick one.
  const toLockRows = model.folders.flatMap((f) =>
    f.children.flatMap((c) =>
      c.buildPickVendorIds.flatMap((vid) => {
        const p = c.picks.find((pp) => pp.vendor_id === vid);
        if (!p) return [];
        if (p.raw_status && LOCKED.has(p.raw_status)) return []; // already locked → other list
        return [
          {
            folder: f.label,
            group: c.label,
            groupId: c.groupId,
            vendorId: p.vendor_id,
            name: p.marketplace_business_name ?? p.vendor_name ?? 'Vendor',
            cost: p.rolled_cost_php,
            // Booking-requires-verified gate (owner 2026-07-24). Enrichment sets
            // is_verified for picked MARKETPLACE vendors (undefined for
            // off-platform / not-yet-joined → no indicator, server + DB decide).
            isVerified: p.is_verified,
          },
        ];
      }),
    ),
  );

  // ── PR-E · "Still needs your decision" ────────────────────────────────────
  // One walk of the model into the pure resolver's input shape. Locked-ness
  // comes from the live plan snapshot via `lockedGroupIdsOf` (the Plans
  // surface's authority), never from a second raw_status pass.
  const decisionInputs: TeamDecisionInput[] = [];
  if (replan) {
    let order = 0;
    for (const f of model.folders) {
      for (const c of f.children) {
        decisionInputs.push({
          groupId: c.groupId as string,
          label: c.label,
          folderSlug: f.slug,
          optionCount: c.picks.length,
          buildCount: c.buildPickVendorIds.length,
          timelineStatus: c.timelineStatus,
          daysLeft: c.daysLeft,
          covered: c.coveredBy != null,
          order: order++,
        });
      }
    }
  }
  const decisions = replan
    ? stillNeedsDecision({
        rows: decisionInputs,
        lockedGroupIds: lockedGroupIdsOf(planPicks ?? []),
        limit: DECISION_ROW_LIMIT,
      })
    : { rows: [], hiddenCount: 0 };

  // Empty state — unchanged flag-OFF. Flag ON it must also stand down when there
  // IS an open decision to show, or the doorways would hide behind "nothing yet".
  const nothingYet = lockedRows.length === 0 && toLockRows.length === 0;
  if (nothingYet && !(replan && decisions.rows.length > 0)) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-16 text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
          <LockIcon className="h-6 w-6" strokeWidth={1.5} aria-hidden />
        </span>
        <h2 className="text-lg font-semibold text-ink">Nothing to lock yet</h2>
        <p className="text-sm text-ink/60">
          Add vendors to your build from the Shortlist, then come back here to lock them in — that
          confirms your pick, updates your budget, and notifies the vendor.
        </p>
      </div>
    );
  }

  const toLockTotal = toLockRows.reduce((s, r) => s + (r.cost ?? 0), 0);
  const money = teamMoney({
    lockedCentavos: model.chosenCentavos,
    candidateCostsPhp: toLockRows.map((r) => r.cost),
    budgetPhp: summary?.budgetPhp ?? null,
  });
  const buffer = bufferTile(money.bufferPhp);

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-1 py-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl italic text-ink">
          {replan ? 'Your team' : 'Lock your build'}
        </h2>
        <span className="font-display text-xl italic text-ink/80">{peso(model.chosenCentavos)}</span>
      </div>

      {/* Committed-anchor summary tiles (prototype `.lock-sum` / `.tiles`).
          Flag ON adds the two money tiles the replan asks for — In build and
          Buffer — and renames Committed to the plainer "Locked". */}
      {replan ? (
        <div className="grid grid-cols-2 gap-3">
          <LockTile k="Date" v={summary?.dateLabel ?? '—'} />
          <LockTile k="Location" v={summary?.region ?? '—'} />
          <LockTile k="Locked" v={pesoFromPhp(money.lockedPhp) ?? '—'} accent />
          <LockTile k="In build" v={pesoFromPhp(money.inBuildPhp) ?? '—'} />
          <LockTile k="Budget" v={pesoFromPhp(money.budgetPhp) ?? '—'} />
          <LockTile k="Buffer" v={buffer.text} tone={buffer.tone} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <LockTile k="Date" v={summary?.dateLabel ?? '—'} />
          <LockTile k="Budget" v={pesoFromPhp(summary?.budgetPhp ?? null) ?? '—'} />
          <LockTile k="Location" v={summary?.region ?? '—'} />
          <LockTile k="Committed" v={peso(model.chosenCentavos)} accent />
        </div>
      )}

      {/* Nothing locked yet — the prototype's one-line orientation, shown only
          when the rail has something else to offer (open decisions/candidates),
          so it never competes with the full empty state above. */}
      {replan && lockedRows.length === 0 ? (
        <p className="text-sm text-ink/55">
          Nothing locked yet — start with the reception venue. It sets your date and your location,
          and everything else follows from those two.
        </p>
      ) : null}

      {/* 1 · Ready to lock — build picks awaiting the hardened finalize. */}
      {toLockRows.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg italic text-ink/85">
              {replan ? 'In your build — ready to lock' : 'Ready to lock'}
            </h3>
            <span className="text-xs text-ink/55">{pesoFromPhp(toLockTotal)} in your build</span>
          </div>
          {toLockRows.map((r) => (
            <div
              key={`${r.groupId}-${r.vendorId}`}
              className="rounded-xl border border-ink/10 bg-cream px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">{r.name}</span>
                  <span className="block font-mono text-[10px] uppercase tracking-[0.1em] text-ink/45">
                    {r.folder} · {r.group}
                  </span>
                </span>
                {/* Flag ON pairs the price with the remove control; flag OFF
                    renders the price exactly as it ships today. */}
                {replan ? (
                  <span className="flex shrink-0 items-center gap-1.5">
                    {pesoFromPhp(r.cost) && (
                      <span className="text-sm font-medium text-ink/75">{pesoFromPhp(r.cost)}</span>
                    )}
                    {/* One candidate off the build. Vendor-scoped, never a lock. */}
                    <TeamRemoveCandidate
                      eventId={eventId}
                      groupId={r.groupId as string}
                      vendorId={r.vendorId}
                      vendorName={r.name}
                    />
                  </span>
                ) : (
                  pesoFromPhp(r.cost) && (
                    <span className="shrink-0 text-sm font-medium text-ink/75">
                      {pesoFromPhp(r.cost)}
                    </span>
                  )
                )}
              </div>
              {/* The ONE lock path — conflict gate, date-lock modal, milestone
                  toast and undo all ride along. Never write a second one. The
                  copy stays "Lock to confirm": the handshake (spec §7) means a
                  lock is a REQUEST, so no label here may promise finality. */}
              <AccordionLockButton
                eventId={eventId}
                groupId={r.groupId}
                groupLabel={r.group}
                vendorId={r.vendorId}
                vendorName={r.name}
                label="Lock to confirm"
                pendingLabel="Locking…"
                className={LOCK_BTN_CLASS}
                wrapperClassName=""
                isVerified={r.isVerified}
              />
            </div>
          ))}
          {replan ? (
            <div className="flex justify-end pt-0.5">
              <TeamClearCandidates eventId={eventId} />
            </div>
          ) : null}
        </section>
      )}

      {/* 2 · Locked in — the finalized, read-only list. */}
      {lockedRows.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-display text-lg italic text-ink/85">Locked in</h3>
          <ul className="space-y-2">
            {lockedRows.map((r, i) => (
              <li
                key={`${r.group}-${r.name}-${i}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-success-200 bg-success-50/60 px-4 py-3"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-success-600" strokeWidth={1.75} aria-hidden />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{r.name}</span>
                    <span className="block font-mono text-[10px] uppercase tracking-[0.1em] text-ink/45">
                      {r.folder} · {r.group}
                    </span>
                  </span>
                </span>
                {pesoFromPhp(r.cost) && (
                  <span className="shrink-0 text-sm font-medium text-ink/75">{pesoFromPhp(r.cost)}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 3 · Still needs your decision (PR-E) — urgency-ordered doorways back
          onto the bench. Only the categories the couple is actually in: the ones
          they've shortlisted or built into, plus the ones the planning clock has
          opened. Locked and package-covered categories never appear. */}
      {replan && decisions.rows.length > 0 && (
        <section className="space-y-1">
          <h3 className="font-display text-lg italic text-ink/85">Still needs your decision</h3>
          <ul className="divide-y divide-ink/8">
            {decisions.rows.map((d) => (
              <li key={d.groupId}>
                <TeamDecisionDoorway
                  eventId={eventId}
                  label={d.label}
                  tile={d.tile}
                  folderSlug={d.folderSlug}
                  meta={decisionMeta(d.daysLeft, d.optionCount)}
                />
              </li>
            ))}
          </ul>
          {decisions.hiddenCount > 0 ? (
            <p className="px-2 pt-1 text-xs text-ink/45">
              …and {decisions.hiddenCount} more to decide.
            </p>
          ) : null}
        </section>
      )}
    </div>
  );
}

/**
 * The right-aligned line on a decision row. Overdue and due-soon speak in days
 * (that IS the pressure); otherwise it reports how many options are already on
 * the bench. Null when there is nothing true to say.
 */
function decisionMeta(daysLeft: number | null, optionCount: number): string | null {
  if (daysLeft != null && daysLeft < 0) return `${Math.abs(daysLeft)}d overdue`;
  if (daysLeft != null && daysLeft <= 30) return `${daysLeft}d left`;
  if (optionCount > 0) return `${optionCount} shortlisted`;
  return null;
}

function LockTile({
  k,
  v,
  accent = false,
  tone,
}: {
  k: string;
  v: string;
  accent?: boolean;
  /** PR-E Buffer tile only: success when there's room, danger when over. */
  tone?: 'good' | 'over' | 'none';
}) {
  const toneClass =
    tone === 'over' ? 'text-danger-700' : tone === 'good' ? 'text-success-700' : null;
  return (
    <div className="rounded-xl border border-ink/10 bg-cream px-4 py-3">
      <div className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink/50">{k}</div>
      <div
        className={`mt-1 truncate font-display text-lg italic ${toneClass ?? (accent ? 'text-terracotta' : 'text-ink')}`}
      >
        {v}
      </div>
    </div>
  );
}
