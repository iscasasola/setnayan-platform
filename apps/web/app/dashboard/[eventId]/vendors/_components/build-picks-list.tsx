'use client';

/**
 * BuildPicksList — the Build tab's "Your build" section: the items the couple
 * has TRANSFERRED here via the Shortlist's "Add to build" (owner 2026-06-09:
 * "add to build transfers the item to the build page"). Each row is a pinned
 * vendor (event_build_picks) for a category, with its rolled cost; a running
 * total caps the list. Removing takes it back off the build (the vendor stays
 * on the Shortlist). Locked picks show a badge instead of Remove.
 *
 * Client component (the Remove action). Locking the build stays the Lock tab.
 */

import { useState, useTransition } from 'react';
import { Hammer, Lock as LockIcon, RotateCcw, X } from 'lucide-react';
import { haptic } from '@/lib/haptics';
import { removeBuildPick, clearBuildPicks } from '../build-pick-actions';
import { goToBuildTab } from './services-takeover';

export type BuildPickItem = {
  groupId: string;
  group: string;
  folder: string;
  vendorId: string;
  name: string;
  pricePhp: number | null;
  locked: boolean;
};

const peso = (php: number | null) =>
  php == null ? '—' : `₱${Math.round(php).toLocaleString('en-PH')}`;

export function BuildPicksList({
  eventId,
  items,
  budgetPhp,
}: {
  eventId: string;
  items: BuildPickItem[];
  budgetPhp: number | null;
}) {
  const lockedTotal = items.filter((it) => it.locked).reduce((s, it) => s + (it.pricePhp ?? 0), 0);
  const thisBuildTotal = items
    .filter((it) => !it.locked)
    .reduce((s, it) => s + (it.pricePhp ?? 0), 0);
  const total = lockedTotal + thisBuildTotal;

  if (items.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-ink/15 bg-cream px-5 py-8 text-center">
        <span className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
          <Hammer className="h-5 w-5" strokeWidth={1.6} aria-hidden />
        </span>
        <h3 className="font-display text-lg italic text-ink">Your build is empty</h3>
        <p className="mx-auto mt-1 max-w-xs text-sm text-ink/60">
          Open the <b>Shortlist</b> and tap <b>Add to build</b> on the vendors you want — they land
          here, ready to compare and lock.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display text-lg italic text-ink/85">
          <Hammer className="h-4 w-4 text-terracotta" strokeWidth={1.75} aria-hidden /> Your build
        </h3>
        <span className="text-xs text-ink/55">
          {items.length} {items.length === 1 ? 'item' : 'items'} · {peso(total)}
        </span>
      </div>

      {items.map((it) => (
        <BuildPickRow key={`${it.groupId}-${it.vendorId}`} eventId={eventId} item={it} />
      ))}

      <BuildTotals
        lockedTotal={lockedTotal}
        thisBuildTotal={thisBuildTotal}
        total={total}
        budgetPhp={budgetPhp}
      />

      <BuildControls eventId={eventId} hasUnlocked={thisBuildTotal > 0 || items.some((it) => !it.locked)} />
    </section>
  );
}

/** Persistent totals (prototype `.totals`): locked (held separately) · this build
 *  (chosen) · total commitment, with the budget over/under. */
function BuildTotals({
  lockedTotal,
  thisBuildTotal,
  total,
  budgetPhp,
}: {
  lockedTotal: number;
  thisBuildTotal: number;
  total: number;
  budgetPhp: number | null;
}) {
  const remaining = budgetPhp == null ? null : budgetPhp - total;
  return (
    <div className="mt-1 rounded-2xl bg-ink px-4 py-3 text-cream">
      {lockedTotal > 0 && (
        <Line k="Already locked (held separately)" v={peso(lockedTotal)} />
      )}
      <Line k="This build (chosen services)" v={peso(thisBuildTotal)} />
      <div className="mt-1 flex items-baseline justify-between border-t border-cream/15 pt-2">
        <span className="text-[12.5px] font-semibold">Total commitment</span>
        <span className="font-display text-xl italic text-terracotta-200">{peso(total)}</span>
      </div>
      {remaining != null && (
        <p
          className={`mt-1.5 text-right text-[11px] ${remaining < 0 ? 'text-rose-300' : 'text-emerald-300'}`}
        >
          {remaining >= 0
            ? `${peso(remaining)} under your ${peso(budgetPhp)} budget`
            : `${peso(-remaining)} over your ${peso(budgetPhp)} budget`}
        </p>
      )}
    </div>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between py-0.5">
      <span className="text-[11.5px] text-cream/70">{k}</span>
      <span className="font-display text-[15px] italic">{v}</span>
    </div>
  );
}

/** Reset (clear all build picks · confirm) + Lock (jump to the Lock tab). */
function BuildControls({ eventId, hasUnlocked }: { eventId: string; hasUnlocked: boolean }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const reset = () => {
    haptic('tick');
    start(async () => {
      await clearBuildPicks({ eventId });
      setConfirm(false);
    });
  };
  return (
    <div className="mt-1 grid grid-cols-2 gap-2">
      {confirm ? (
        <button
          type="button"
          onClick={reset}
          disabled={pending}
          className="inline-flex items-center justify-center gap-1.5 rounded-[10px] border border-rose-300 px-3 py-2.5 text-[12.5px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
        >
          {pending ? 'Resetting…' : 'Tap to confirm reset'}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="inline-flex items-center justify-center gap-1.5 rounded-[10px] border border-ink/15 px-3 py-2.5 text-[12.5px] font-medium text-ink/70 hover:bg-ink/5"
        >
          <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden /> Reset
        </button>
      )}
      <button
        type="button"
        onClick={() => goToBuildTab('lock')}
        disabled={!hasUnlocked}
        className="inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-mulberry px-3 py-2.5 text-[12.5px] font-semibold text-cream transition-colors hover:bg-mulberry-700 disabled:opacity-50"
      >
        <LockIcon className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden /> Lock your build
      </button>
    </div>
  );
}

function BuildPickRow({ eventId, item }: { eventId: string; item: BuildPickItem }) {
  const [pending, start] = useTransition();
  const remove = () => {
    haptic('tick');
    start(async () => {
      await removeBuildPick({ eventId, planGroupId: item.groupId });
    });
  };
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
        item.locked ? 'border-emerald-200 bg-emerald-50/60' : 'border-ink/10 bg-cream'
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{item.name}</span>
        <span className="block font-mono text-[10px] uppercase tracking-[0.1em] text-ink/45">
          {item.folder} · {item.group}
        </span>
      </span>
      <span className="shrink-0 text-sm font-medium text-ink/75">{peso(item.pricePhp)}</span>
      {item.locked ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">
          <LockIcon className="h-3 w-3" strokeWidth={2} aria-hidden /> Locked
        </span>
      ) : (
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          aria-label={`Remove ${item.name} from your build`}
          className="shrink-0 rounded-full p-1.5 text-ink/40 hover:bg-ink/5 hover:text-ink disabled:opacity-50"
        >
          <X className="h-4 w-4" strokeWidth={1.9} aria-hidden />
        </button>
      )}
    </div>
  );
}
