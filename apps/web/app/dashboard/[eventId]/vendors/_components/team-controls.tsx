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

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Bookmark, ChevronRight, Circle, Eraser, Loader2, X } from 'lucide-react';
import { useConfirm } from '@/app/_components/confirm-dialog';
import { haptic } from '@/lib/haptics';
import {
  BB_RENAME_PLAN_EVENT,
  goToBuildTab,
  type RenamePlanRequest,
} from '@/lib/budget-build';
import {
  benchFolderAnchorId,
  benchTileAnchorId,
  scrollBenchAnchor,
} from '@/lib/bench-anchors';
import { clearBuildPicks, removeBuildPick } from '../build-pick-actions';
import {
  savePlanBuildNamed,
  type PlanBuildSnapshot,
  type SavedPlanBuild,
} from '../build-actions';
import { readPinMode } from './build-pin-mode';
import { useSaveLoader } from '@/components/sd-loader';
import {
  autoBuildTitle,
  displayBuildTitle,
  normalizeBuildTitle,
  sortSavedBuilds,
  MAX_BUILD_TITLE_LEN,
} from '@/lib/named-builds';

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
 * "Save current as a plan" — RELOCATED VERBATIM 2026-07-29 from
 * `build-compare.tsx` (`Explore_Integration_BUILD_SPEC_2026-07-29.md` §3 item 6).
 * Same markup, same `savePlanBuildNamed` call, same blank-name auto-naming — it
 * simply now sits on the surface that owns the team, next to the team it saves,
 * instead of at the top of the panel that only COMPARES saved plans. A move, not
 * a copy: the Plans panel no longer renders it behind the flag.
 *
 * Flag-ON only (its caller mounts it behind `isExploreReplanEnabled()`), so the
 * `replan ?` ternaries the original carried are resolved to their replan side.
 *
 * The Plans panel's **Rename** control still reaches this bar — over
 * `BB_RENAME_PLAN_EVENT`, the sibling of the tab bus both files already use.
 */
export function TeamSavePlan({
  eventId,
  currentPlan,
  savedBuilds,
}: {
  eventId: string;
  currentPlan: PlanBuildSnapshot;
  savedBuilds: SavedPlanBuild[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState('');
  // '' = create a new named plan; a build_id = overwrite that one.
  const [overwriteId, setOverwriteId] = useState<string>('');
  const [err, setErr] = useState<string | null>(null);
  // Set to the auto-generated title when a BLANK name was saved (§7a).
  const [namedNotice, setNamedNotice] = useState<string | null>(null);
  const save = useSaveLoader();

  const orderedBuilds = useMemo(() => sortSavedBuilds(savedBuilds), [savedBuilds]);

  // §7a "make renaming easy" — the Plans panel's Rename button loads that plan's
  // name in here with itself pre-selected as the overwrite target; typing + Save
  // renames it in place. Identical behaviour to when the bar lived over there.
  useEffect(() => {
    const onRename = (e: Event) => {
      const req = (e as CustomEvent<RenamePlanRequest>).detail;
      if (!req?.buildId) return;
      setNamedNotice(null);
      setErr(null);
      setName(req.name);
      setOverwriteId(req.buildId);
    };
    window.addEventListener(BB_RENAME_PLAN_EVENT, onRename);
    return () => window.removeEventListener(BB_RENAME_PLAN_EVENT, onRename);
  }, []);

  // §7a: a blank name is a valid save — surface the name it WILL get as the
  // placeholder so the auto-name is never a surprise.
  const autoNameHint = useMemo(() => {
    const i = overwriteId ? orderedBuilds.findIndex((b) => b.build_id === overwriteId) : -1;
    const target = i >= 0 ? orderedBuilds[i] : undefined;
    return target
      ? autoBuildTitle({ build_id: target.build_id, label: target.label, title: null }, i)
      : autoBuildTitle({ build_id: '', label: null, title: null }, orderedBuilds.length);
  }, [overwriteId, orderedBuilds]);

  function onSaveNamed() {
    setErr(null);
    if (currentPlan.picks.length === 0) {
      setErr('Add some vendors to your build first — from the bench, then save.');
      return;
    }
    startTransition(async () => {
      const res = await save.run(
        () =>
          savePlanBuildNamed({
            eventId,
            rawName: name,
            overwriteBuildId: overwriteId || null,
            snapshot: { ...currentPlan, pinMode: readPinMode(eventId) },
          }),
        { steps: ['Saving your plan'], hint: 'Saving' },
      );
      if (!res.ok) setErr(res.error);
      else {
        if (normalizeBuildTitle(name) === null) setNamedNotice(autoNameHint);
        else setNamedNotice(null);
        setName('');
        setOverwriteId('');
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-2 rounded-2xl border border-ink/10 bg-cream p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-ink/80">
        <Bookmark className="h-4 w-4 shrink-0 text-terracotta" strokeWidth={1.75} aria-hidden />
        Save your current candidates as
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          // Spec §8.1 — saving NAMES it; the stored title caps at
          // MAX_BUILD_TITLE_LEN, so stop the typing there rather than silently
          // truncating on write.
          maxLength={MAX_BUILD_TITLE_LEN}
          placeholder={`${autoNameHint} — or give it a name`}
          className="min-w-[8rem] flex-1 rounded-md border border-ink/15 bg-paper px-2 py-1 text-sm outline-none focus:border-terracotta/50"
          aria-label="Plan name (optional — we’ll name it for you)"
        />
        <select
          value={overwriteId}
          onChange={(e) => setOverwriteId(e.target.value)}
          className="rounded-md border border-ink/15 bg-paper px-2 py-1 text-sm"
          aria-label="Save as a new plan or overwrite an existing one"
        >
          <option value="">as a new plan</option>
          {orderedBuilds.map((b, i) => (
            <option key={b.build_id} value={b.build_id}>
              overwrite “{displayBuildTitle(b, i)}”
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onSaveNamed}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
          {overwriteId ? 'Save' : 'Save plan'}
        </button>
      </div>
      {!err ? (
        <p className="text-xs text-ink/45">
          {namedNotice ? (
            <>
              Saved — no name given, so we called it{' '}
              <span className="font-medium text-ink/70">“{namedNotice}”</span>. Tap{' '}
              <span className="text-ink/70">Rename</span> on its row in Your plans to change it.
            </>
          ) : (
            <>A name is optional — leave it blank and we’ll name the plan for you.</>
          )}
        </p>
      ) : null}
      {err ? <p className="text-xs text-danger-700">{err}</p> : null}
    </div>
  );
}

/**
 * One "Still needs your decision" row — a doorway that opens that category on
 * the bench.
 *
 * The mechanism is the SHIPPED one: push the `?tab=shortlist&open=<tile>` deep
 * link the page already reads into `initialOpenTile`, and ask the section bus to
 * scroll to the bench.
 *
 * ── WHAT CHANGED 2026-07-29 (owner: "doesn't jump to the exact accordion cell")
 * This used to finish with a 220ms `setTimeout` and then scroll to the FOLDER
 * anchor. Both halves were wrong:
 *
 *   • the folder head is not the category — the category sat expanded somewhere
 *     below it, and had no anchor of its own to aim at; and
 *   • the push above re-keys the bench in `page.tsx`
 *     (`key={`sl-${sp.open ?? ''}`}`), i.e. it REMOUNTS it. A fixed delay racing
 *     a remount this component cannot observe was a coin flip, and it lost
 *     silently: it ended in `?.scrollIntoView()` on a null.
 *
 * So the landing scroll now belongs to the bench, which owns that remount and
 * therefore owns its timing (`shortlist-categories.tsx`, the `useLayoutEffect`
 * beside `openPlan`). What stays here is only what a remount cannot cover:
 *
 *   • **no tile** — an entry-point plan group with no `catalogTile` (attire ·
 *     music_entertainment · logistics). Nothing to deep-link to, so this scrolls
 *     to the folder itself. It deliberately carries the CURRENT `?open=`
 *     through: dropping it would re-key the bench and collapse it out from under
 *     the very scroll this branch is performing.
 *   • **the same row tapped twice** — `?open=` is unchanged, so there is no
 *     re-key and no remount, so no mount effect fires. The anchor is already in
 *     the DOM; scroll it directly instead of waiting for something that will
 *     never happen.
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
        // Read BEFORE the push — `router.push` updates the URL asynchronously.
        const currentOpen = new URLSearchParams(window.location.search).get('open');
        const nextOpen = tile ?? currentOpen;
        const qs = new URLSearchParams({ tab: 'shortlist' });
        if (nextOpen) qs.set('open', nextOpen);
        router.push(`/dashboard/${eventId}/vendors?${qs.toString()}`, { scroll: false });
        // The section bus (mobile dock highlight + the shipped scroll to
        // `#svc-shortlist`). Unchanged, and it is only ever the coarse move —
        // whatever scrolls after it supersedes it.
        goToBuildTab('shortlist');
        // `page.tsx` keys the bench on `?open=`, so this is exactly "will the
        // bench remount?". When it will, and there is a tile to land on, the
        // bench owns the scroll and this must not race it.
        const willRemount = (currentOpen ?? '') !== (nextOpen ?? '');
        if (tile && willRemount) return;
        scrollBenchAnchor(tile ? benchTileAnchorId(tile) : benchFolderAnchorId(folderSlug));
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
