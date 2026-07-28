'use client';

/**
 * team-controls.tsx — the three CLIENT leaves of the "Your team" rail
 * (`Explore_Replan_BUILD_SPEC_2026-07-27.md` §3 PR-E · prototype `renderTeam()`).
 *
 * `BuildLocked` stays a SERVER component (it reads the whole plan/budget model),
 * so the rail's interactive bits live here as small, prop-thin leaves:
 *
 *   • `TeamRemoveCandidate` — the ✕ on a "ready to lock" row. Calls the shipped
 *     `removeBuildPick` (vendor-scoped, so a multi-pick category loses only THIS
 *     candidate). It never touches the shortlist and never touches a lock.
 *   • `TeamClearCandidates` — "Clear candidates" (spec §8.3), MOVED here from the
 *     Plans panel so there is exactly one. Empties the BUILD layer only: locked
 *     vendors are contracts and stay.
 *   • `TeamDecisionDoorway` — a "Still needs your decision" row. Reuses the
 *     SHIPPED deep-link contract (`?tab=shortlist&open=<tile>` — the same one
 *     `checklist-full.tsx` links with) plus the section bus, then scrolls the
 *     bench folder into view exactly as the bench's own `openPlan` does. No new
 *     navigation mechanism, and no reach into the bench's internal state.
 *
 * All three are rendered only behind `isExploreReplanEnabled()` by their caller.
 */

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Circle, Eraser, X } from 'lucide-react';
import { useConfirm } from '@/app/_components/confirm-dialog';
import { haptic } from '@/lib/haptics';
import { goToBuildTab } from '@/lib/budget-build';
import { clearBuildPicks, removeBuildPick } from '../build-pick-actions';

/** ✕ — take ONE candidate back off the build. */
export function TeamRemoveCandidate({
  eventId,
  groupId,
  vendorId,
  vendorName,
}: {
  eventId: string;
  groupId: string;
  vendorId: string;
  vendorName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={`Remove ${vendorName} from your build`}
      title="Remove from your build"
      onClick={() => {
        haptic('tick');
        startTransition(async () => {
          // Vendor-scoped by design — a multi-pick category keeps its other
          // candidates (the guard lives in removeBuildPickRow).
          await removeBuildPick({ eventId, planGroupId: groupId, vendorId });
          router.refresh();
        });
      }}
      className="shrink-0 rounded-full p-1.5 text-ink/35 transition hover:bg-ink/5 hover:text-danger-600 disabled:opacity-40"
    >
      <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
    </button>
  );
}

/** "Clear candidates" — empties the BUILD only. Confirm-first: it's a bulk discard. */
export function TeamClearCandidates({ eventId }: { eventId: string }) {
  const router = useRouter();
  // `dialog` is the portal node the hook renders — it MUST be mounted or the
  // confirm promise never resolves (the same contract build-compare uses).
  const { confirm, dialog } = useConfirm();
  const [pending, startTransition] = useTransition();
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          const ok = await confirm({
            title: 'Clear your candidates?',
            body: (
              <>
                This empties your build — every vendor you’re still weighing up comes off. Your{' '}
                <span className="font-medium text-ink">locked vendors stay</span> (they’re
                contracts), and so does anything mid-handshake.
              </>
            ),
            confirmLabel: 'Clear candidates',
            cancelLabel: 'Keep them',
            destructive: true,
          });
          if (!ok) return;
          startTransition(async () => {
            await clearBuildPicks({ eventId });
            router.refresh();
          });
        }}
        className="inline-flex items-center gap-1 text-xs text-ink/45 underline-offset-2 transition hover:text-danger-600 hover:underline disabled:opacity-50"
      >
        <Eraser className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
        Clear candidates
      </button>
      {dialog}
    </>
  );
}

/**
 * One "Still needs your decision" row — a doorway that opens that category on
 * the bench.
 *
 * The mechanism is the SHIPPED one, in three already-existing steps: push the
 * `?tab=shortlist&open=<tile>` deep link the page already reads into
 * `initialOpenTile`; ask the section bus to scroll to the bench; then settle on
 * the folder anchor `#slfold-<slug>` the accordion already renders — which is
 * precisely what the bench's own `openPlan` does after it expands a folder.
 */
export function TeamDecisionDoorway({
  eventId,
  label,
  tile,
  folderSlug,
  meta,
}: {
  eventId: string;
  label: string;
  /** Null for entry-point groups with no catalogue tile → folder-level doorway. */
  tile: string | null;
  folderSlug: string;
  /** Right-aligned urgency line ("4 days left", "3 shortlisted"), or null. */
  meta: string | null;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        const qs = new URLSearchParams({ tab: 'shortlist' });
        if (tile) qs.set('open', tile);
        router.push(`/dashboard/${eventId}/vendors?${qs.toString()}`, { scroll: false });
        goToBuildTab('shortlist');
        window.setTimeout(() => {
          document
            .getElementById(`slfold-${folderSlug}`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 220);
      }}
      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-ink/5"
    >
      <Circle className="h-3 w-3 shrink-0 text-ink/30" strokeWidth={2} aria-hidden />
      <span className="min-w-0 flex-1 truncate text-sm text-ink/85">{label}</span>
      {meta ? (
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-ink/45">
          {meta}
        </span>
      ) : null}
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink/30" strokeWidth={2} aria-hidden />
    </button>
  );
}
