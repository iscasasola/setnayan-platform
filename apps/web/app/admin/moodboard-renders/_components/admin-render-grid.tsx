'use client';

/**
 * ADMIN · the all-creations grid and its featured toggle (MB8).
 *
 * 🔑 THE REFUSAL IS RENDERED. `moodboard_set_render_featured` returns FALSE
 * when the couple has not consented, and the natural way to write this
 * component — fire the action, flip the star optimistically — would show an
 * admin a featured creation that is not featured. The featured set is what a
 * public gallery would draw from, so a star that lies here is a consent
 * problem wearing a UI bug's clothes.
 *
 * So: the star flips only on `ok`, and a refusal prints a sentence next to
 * the card saying why nothing happened.
 */

import { useState } from 'react';
import { setRenderFeatured, setRenderReuseBlocked } from '../actions';
import type { RenderFailureCopy } from '@/lib/moodboard-render-failure';
import type { AdminRenderRow } from '@/lib/moodboard-render-gallery';

export type AdminRenderItem = AdminRenderRow & {
  partLabel: string;
  imageUrl: string | null;
  failureCopy: RenderFailureCopy | null;
};

export function AdminRenderGrid({ items }: { items: AdminRenderItem[] }) {
  // Only the toggled-state deltas live here; everything else comes from the
  // server on each load.
  const [featured, setFeatured] = useState<Record<string, boolean>>({});
  const [refused, setRefused] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<Record<string, boolean>>({});

  const isFeatured = (r: AdminRenderItem) => featured[r.render_id] ?? Boolean(r.featured_at);
  const isBlocked = (r: AdminRenderItem) => blocked[r.render_id] ?? r.reuse_blocked;

  /**
   * The quarantine handle for the reuse pool. `reusable` is GENERATED from
   * `reuse_blocked`, so there is exactly one flag and it cannot drift.
   */
  async function toggleBlocked(r: AdminRenderItem) {
    const next = !isBlocked(r);
    setBusy(r.render_id);
    const res = await setRenderReuseBlocked({ renderId: r.render_id, blocked: next }).catch(
      () => ({ ok: false as const, reason: 'error' as const }),
    );
    setBusy(null);
    if (res.ok) setBlocked((p) => ({ ...p, [r.render_id]: next }));
    else
      setRefused((p) => ({
        ...p,
        [r.render_id]: 'The reuse block did not change. Nothing happened.',
      }));
  }

  async function toggle(r: AdminRenderItem) {
    const next = !isFeatured(r);
    setBusy(r.render_id);
    setRefused((p) => ({ ...p, [r.render_id]: '' }));
    const res = await setRenderFeatured({ renderId: r.render_id, featured: next }).catch(() => ({
      ok: false as const,
      reason: 'error' as const,
    }));
    setBusy(null);
    if (res.ok) {
      setFeatured((p) => ({ ...p, [r.render_id]: next }));
      return;
    }
    // Nothing changed. Say so, and say the likely reason — a star that moved
    // anyway would misreport what may be published.
    setRefused((p) => ({
      ...p,
      [r.render_id]:
        res.reason === 'refused'
          ? next
            ? 'Not featured — this couple has not agreed to be featured.'
            : 'Nothing changed — the toggle was refused.'
          : 'The toggle failed. Nothing changed.',
    }));
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((r) => {
        const on = isFeatured(r);
        const note = refused[r.render_id];
        return (
          <article
            key={r.render_id}
            className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-sm"
          >
            <div className="relative aspect-[4/3] bg-ink/5">
              {r.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- presigned, short-lived
                <img
                  src={r.imageUrl}
                  alt={`${r.event_name} — ${r.partLabel}`}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : null}
              {r.failureCopy ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-danger-700/90 px-3 text-center text-white">
                  <p className="text-xs font-bold">{r.failureCopy.headline}</p>
                  <p className="text-[10px] leading-snug text-white/90">
                    {/* The operator's detail, not the couple's sentence — this
                        is the page where the raw reason is the useful thing. */}
                    {r.failure_reason ?? r.failureCopy.detail}
                  </p>
                </div>
              ) : null}
              {!r.imageUrl && !r.failureCopy ? (
                <div className="absolute inset-0 flex items-center justify-center px-2 text-center text-[10px] font-semibold text-ink/55">
                  In flight — no image yet
                </div>
              ) : null}
              {on ? (
                <span className="absolute right-1.5 top-1.5 rounded-full bg-mulberry px-2 py-0.5 text-[10px] font-bold text-cream">
                  ★ Featured
                </span>
              ) : null}
            </div>

            <div className="space-y-1.5 px-3 py-2.5 text-xs">
              <p className="font-semibold text-ink">
                {r.event_name}{' '}
                <span className="font-normal text-ink/55">· {r.partLabel}</span>
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                {/* The consent BADGE — never a filter. See the page docblock. */}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    r.share_consented
                      ? 'bg-mulberry/15 text-mulberry'
                      : 'bg-ink/10 text-ink/55'
                  }`}
                >
                  {r.share_consented ? 'Shareable' : 'Private — no consent'}
                </span>
                <span className="rounded-full bg-ink/5 px-1.5 py-0.5 text-[10px] text-ink/55">
                  {r.credits_debited} {r.credits_debited === 1 ? 'credit' : 'credits'}
                </span>
                {r.note ? (
                  <span className="rounded-full bg-ink/5 px-1.5 py-0.5 text-[10px] text-ink/55">
                    has a note · not reusable
                  </span>
                ) : isBlocked(r) ? (
                  <span className="rounded-full bg-danger-700/10 px-1.5 py-0.5 text-[10px] font-semibold text-danger-700">
                    blocked from reuse
                  </span>
                ) : r.reusable ? (
                  <span className="rounded-full bg-ink/5 px-1.5 py-0.5 text-[10px] text-ink/55">
                    in the reuse pool
                  </span>
                ) : null}
              </div>
              {r.note ? (
                <p className="truncate text-ink/50" title={r.note}>
                  “{r.note}”
                </p>
              ) : null}
              <p className="font-mono text-[10px] text-ink/35">{r.config_digest}</p>

              <div className="flex items-center gap-2 pt-0.5">
                <button
                  type="button"
                  disabled={busy === r.render_id || !r.image_key || Boolean(r.failed_at)}
                  onClick={() => void toggle(r)}
                  className="rounded-md border border-ink/15 px-2 py-1 font-medium text-ink/75 hover:border-mulberry hover:text-mulberry disabled:opacity-40"
                >
                  {busy === r.render_id ? 'Saving…' : on ? 'Unfeature' : 'Feature'}
                </button>
                {/* The quarantine handle. Only meaningful for a render that
                    could otherwise be reused — a note-bearing one is already
                    out of the pool by construction. */}
                {!r.note && r.image_key && !r.failed_at ? (
                  <button
                    type="button"
                    disabled={busy === r.render_id}
                    onClick={() => void toggleBlocked(r)}
                    className="rounded-md border border-ink/15 px-2 py-1 font-medium text-ink/75 hover:border-mulberry hover:text-mulberry disabled:opacity-40"
                  >
                    {isBlocked(r) ? 'Allow reuse' : 'Block reuse'}
                  </button>
                ) : null}
                {note ? <span className="text-[10px] font-semibold text-danger-700">{note}</span> : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
