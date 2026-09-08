'use client';

/**
 * THE DESK — one queue over four sources (design `02` §2, prototype
 * `story-maker.html` "THE DESK" panel).
 *
 * PORTED, NOT REDRAWN. The prototype's card anatomy is kept exactly:
 *
 *     [thumb]  [SOURCE] who made it · when            → where it lands
 *              TITLE
 *              the content (editable in place)
 *              ⚑ the one thing the host must know about this item
 *                                     [✓ Accept] [✎ Edit] [✕ Reject]
 *
 * …rendered in this app's own tokens rather than the prototype's stand-alone
 * CSS, and following the two shipped queues it replaces the deciding for
 * (`column-queue-controls.tsx`, `kwento-queue-controls.tsx`) so a host who
 * knows those recognises this.
 *
 * ⚠ ONE DELIBERATE DEPARTURE FROM THE PROTOTYPE, AND IT IS NOT A PORT DEFECT:
 * the "We made" lane is absent. The prototype draws three lanes; the desk's
 * loader is specified over FOUR TABLES (`photo_messages`, `guest_columns`,
 * `papic_mission_completions`, `editorial_vendor_media`) which between them
 * supply Guests and Suppliers only. "We made" cards are generated copy living
 * in `event_editorial.draft_json` — the shipped editor's own territory, carried
 * forward in step 1.3 — and giving them an accept/reject state here would mean
 * inventing storage for it, which this step is explicitly told not to do. A
 * filter that can never fill is worse than a filter that is not there yet.
 */

import { useMemo, useState, useTransition } from 'react';
import { Check, Loader2, Lock, Pencil, Undo2, X } from 'lucide-react';
import {
  deskCounts,
  heldBackSentence,
  matchesFilter,
  percentDecided,
  type DeskFilter,
  type DeskItem,
} from '@/lib/story-desk';
import { decideDeskItem, editDeskItem } from '../desk-actions';

const SOURCE_LABEL: Record<DeskItem['source'], string> = {
  kwento: 'Guest',
  letter: 'Guest',
  challenge: 'Guest',
  supplier: 'Supplier',
};

const FILTERS: Array<{ key: DeskFilter; label: string }> = [
  { key: 'all', label: 'Everything' },
  { key: 'guest', label: 'Guests' },
  { key: 'supplier', label: 'Suppliers' },
  { key: 'open', label: 'Still waiting on you' },
];

export function TheDesk({
  eventId,
  items,
  unreadable,
  lettersDark,
}: {
  eventId: string;
  items: DeskItem[];
  unreadable: string[];
  lettersDark: boolean;
}) {
  const [filter, setFilter] = useState<DeskFilter>('all');
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [pending, startTransition] = useTransition();

  const counts = useMemo(() => deskCounts(items), [items]);
  const percent = useMemo(() => percentDecided(items), [items]);
  const shown = useMemo(() => items.filter((i) => matchesFilter(i, filter)), [items, filter]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? 'Something hiccuped — try that again.');
      else setEditing(null);
    });
  };

  const countFor = (key: DeskFilter) =>
    key === 'all' ? counts.all : key === 'guest' ? counts.guest : key === 'supplier' ? counts.supplier : counts.open;

  return (
    <section className="mt-8" aria-labelledby="the-desk-heading">
      <h2 id="the-desk-heading" className="font-serif text-2xl text-ink">
        The desk
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-ink/70">
        Everything anyone made for your day, in one place — what your <b>guests</b> sent and what
        your <b>suppliers</b> sent. Accept it, change the words, or turn it down. It was four
        different screens; it is one queue.
      </p>
      <p className="mt-1 text-xs text-ink/50">Nothing goes into the story until you say so.</p>

      {/* The meter — "n% of the desk decided" (design 02 §1). */}
      <div className="mt-4 max-w-sm">
        <div className="flex items-baseline gap-2">
          <b className="font-serif text-xl text-ink">{percent}%</b>
          <span className="text-xs text-ink/60">of the desk decided</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/10">
          <i
            className="block h-full rounded-full bg-mulberry transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* A source that could not be read says so. An unreadable source and an
          empty one look identical, and this desk gates publishing. */}
      {unreadable.length > 0 ? (
        <p role="alert" className="mt-4 rounded-lg bg-terracotta/10 px-3 py-2 text-xs text-terracotta">
          We could not load {unreadable.join(', ')} just now, so this list may be incomplete.
          Nothing has been decided for you — try refreshing in a moment.
        </p>
      ) : null}
      {lettersDark ? (
        <p className="mt-2 text-xs text-ink/50">
          Letters from guests are switched off for this celebration, so none appear here.
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={`rounded-full border px-3 py-1.5 text-xs transition ${
              filter === f.key
                ? 'border-mulberry bg-mulberry/10 text-mulberry'
                : 'border-ink/15 text-ink/70 hover:border-ink/30'
            }`}
          >
            {f.label} <span className="ml-1 tabular-nums opacity-60">{countFor(f.key)}</span>
          </button>
        ))}
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-xs text-terracotta">
          {error}
        </p>
      ) : null}

      <div className="mt-4 space-y-3">
        {shown.map((item) => {
          const key = `${item.source}:${item.id}`;
          const held = item.heldBack !== null;
          return (
            <article
              key={key}
              className={`rounded-xl border p-4 ${
                held ? 'border-ink/10 bg-ink/[0.03]' : 'border-ink/10 bg-cream/40'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-ink/5 px-2 py-0.5 font-medium text-ink/70">
                  {SOURCE_LABEL[item.source]}
                </span>
                {item.byline ? <span className="text-ink/60">{item.byline}</span> : null}
                <span className="ml-auto text-ink/45">→ {item.landsIn}</span>
              </div>

              <h3 className="mt-2 text-sm font-medium text-ink">{item.title}</h3>

              {editing === key ? (
                <textarea
                  aria-label={`Edit ${item.title}`}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={4}
                  className="mt-2 w-full rounded-lg border border-ink/15 bg-white p-2 text-sm text-ink"
                />
              ) : item.body ? (
                <p className="mt-2 whitespace-pre-wrap text-sm text-ink/80">{item.body}</p>
              ) : null}

              {/* ⚑ the one thing the host must know about this item */}
              <p
                className={`mt-3 flex gap-2 text-xs ${
                  held ? 'text-terracotta' : 'text-ink/55'
                }`}
              >
                <span aria-hidden="true">{held ? '⚠' : '✓'}</span>
                <span>{held ? heldBackSentence(item.heldBack!) : item.flag}</span>
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {held ? (
                  /* ⛔ NOT a disabled Accept. A held-back item is not a decision
                     the host has yet to make — it is one that is not theirs, and
                     a greyed button invites them to keep trying. */
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-3 py-1.5 text-xs text-ink/60">
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Held back
                  </span>
                ) : item.status === 'pending' ? (
                  <>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => decideDeskItem(eventId, item.source, item.id, 'accepted'))}
                      className="inline-flex items-center gap-1.5 rounded-full bg-mulberry px-3 py-1.5 text-xs text-white disabled:opacity-50"
                    >
                      {pending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      Accept
                    </button>
                    {item.editable ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          setEditing(key);
                          setDraft(item.body);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs text-ink/70"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => decideDeskItem(eventId, item.source, item.id, 'rejected'))}
                      className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs text-ink/70"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" /> Reject
                    </button>
                  </>
                ) : (
                  <>
                    <span
                      className={`rounded-full px-3 py-1.5 text-xs ${
                        item.status === 'accepted'
                          ? 'bg-mulberry/10 text-mulberry'
                          : 'bg-ink/5 text-ink/60'
                      }`}
                    >
                      {item.status === 'accepted' ? '✓ In the story' : '✕ Left out'}
                    </span>
                    {/* Undo, at any time. A rejection is silent and never final. */}
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => decideDeskItem(eventId, item.source, item.id, 'pending'))}
                      className="inline-flex items-center gap-1.5 text-xs text-ink/55 underline underline-offset-2"
                    >
                      <Undo2 className="h-3.5 w-3.5" aria-hidden="true" /> undo
                    </button>
                  </>
                )}

                {editing === key ? (
                  <>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => editDeskItem(eventId, item.source, item.id, draft))}
                      className="rounded-full bg-ink px-3 py-1.5 text-xs text-white disabled:opacity-50"
                    >
                      Save the words
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      className="text-xs text-ink/55 underline underline-offset-2"
                    >
                      cancel
                    </button>
                  </>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-ink/15 p-6 text-center text-sm text-ink/55">
          {items.length === 0
            ? 'Nothing on the desk yet. Everything that arrives later lands here — the story keeps growing until you publish it.'
            : 'Nothing left under this filter.'}
        </p>
      ) : null}
    </section>
  );
}
