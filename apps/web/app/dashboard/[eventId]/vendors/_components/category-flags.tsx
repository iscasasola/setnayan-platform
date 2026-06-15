'use client';

/**
 * CategoryFlags — the per-category Lock vs Flag control (Budget "Build" · plan §12).
 *
 * Lists the couple's OPEN categories (budgeted, no vendor yet) and lets them
 * 🚩 FLAG the ones to fill. A flagged category is sourced + recommended by the
 * solver — Setnayan AI auto-picks the best match (PR-2); regular surfaces options.
 * 🔒 LOCKED categories (a finalized vendor) are shown as decided + untouched.
 *
 * PR-1: the marker + persistence + UX only (flagCategory/unflagCategory). The
 * generation that writes a matched vendor to the Shortlist is PR-2.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Flag, Lock, Loader2, Gem, Search, Wand2 } from 'lucide-react';
import { flagCategory, unflagCategory, generateFlaggedVendors } from '../build-flags-actions';

type Cat = { groupId: string; label: string };

export function CategoryFlags({
  eventId,
  openCats,
  lockedCount,
  flaggedGroups,
  aiOn,
}: {
  eventId: string;
  openCats: Cat[];
  lockedCount: number;
  flaggedGroups: string[];
  aiOn: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const flagged = new Set(flaggedGroups);
  const [genMsg, setGenMsg] = useState<string | null>(null);
  const flaggedCount = flaggedGroups.length;

  function generate() {
    setGenMsg(null);
    startTransition(async () => {
      const res = await generateFlaggedVendors({ eventId });
      if (!res.ok) {
        setGenMsg(res.error);
        return;
      }
      setGenMsg(
        res.added > 0
          ? `Added ${res.added} match${res.added === 1 ? '' : 'es'} to your Shortlist${res.skipped > 0 ? ` (${res.skipped} had no new options)` : ''}.`
          : 'No new matches found — try widening your area or adjusting a constraint.',
      );
      router.refresh();
    });
  }

  function toggle(groupId: string, on: boolean) {
    setBusy(groupId);
    startTransition(async () => {
      const res = on
        ? await flagCategory({ eventId, planGroupId: groupId })
        : await unflagCategory({ eventId, planGroupId: groupId });
      setBusy(null);
      if (res.ok) router.refresh();
    });
  }

  if (openCats.length === 0) {
    return (
      <section className="rounded-xl border border-ink/10 bg-cream px-4 py-3">
        <p className="flex items-center gap-2 text-sm text-ink/65">
          <Lock className="h-4 w-4 text-emerald-600" strokeWidth={1.75} aria-hidden />
          Every category has a vendor{lockedCount > 0 ? ` — ${lockedCount} locked in` : ''}. Nothing
          left to fill.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-5">
      <div className="space-y-1">
        <h2 className="font-display text-xl italic text-ink/85">Fill these for me</h2>
        <p className="text-sm text-ink/60">
          Flag a category and {aiOn ? 'Setnayan AI hand-picks the best match' : "we'll surface the best options"} from your area —
          {' '}your locked picks stay untouched.
        </p>
      </div>
      {aiOn && flaggedCount > 0 ? (
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={generate}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Wand2 className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            )}
            Auto-fill {flaggedCount} flagged with Setnayan AI
          </button>
          {genMsg ? <p className="text-xs text-ink/60">{genMsg}</p> : null}
        </div>
      ) : null}
      <ul className="space-y-2">
        {openCats.map((c) => {
          const on = flagged.has(c.groupId);
          const loading = busy === c.groupId && pending;
          return (
            <li
              key={c.groupId}
              className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
                on ? 'border-terracotta/40 bg-terracotta/5' : 'border-ink/10 bg-paper'
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink">{c.label}</span>
                {on ? (
                  <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-terracotta">
                    {aiOn ? (
                      <>
                        <Gem className="h-3 w-3" strokeWidth={2} aria-hidden /> Setnayan AI will
                        match this
                      </>
                    ) : (
                      <>
                        <Search className="h-3 w-3" strokeWidth={2} aria-hidden /> We&rsquo;ll surface
                        options
                      </>
                    )}
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                onClick={() => toggle(c.groupId, !on)}
                disabled={loading}
                aria-pressed={on}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                  on
                    ? 'bg-terracotta/15 text-terracotta hover:bg-terracotta/25'
                    : 'bg-ink text-paper hover:opacity-90'
                }`}
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Flag className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                )}
                {on ? 'Flagged' : 'Flag to fill'}
              </button>
            </li>
          );
        })}
      </ul>
      {lockedCount > 0 ? (
        <p className="flex items-center gap-1.5 text-[11px] text-ink/45">
          <Lock className="h-3 w-3" strokeWidth={2} aria-hidden /> {lockedCount} locked{' '}
          {lockedCount === 1 ? 'pick stays' : 'picks stay'} untouched.
        </p>
      ) : null}
    </section>
  );
}
