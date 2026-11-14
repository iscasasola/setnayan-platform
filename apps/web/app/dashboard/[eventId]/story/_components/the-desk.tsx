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
import { Check, Lock, Pencil, Undo2, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Badge } from '@/app/_components/badge';
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
      {/*
        ⚖ OWNER 2026-09-10: "too many words … simple and efficient and easy to manage."
        What was here: a three-sentence paragraph (including "It was four different screens; it
        is one queue" — a sentence about OUR refactor, which is nothing to the host), a second
        reassurance line, and a progress meter. THE METER NOW LIVES IN THE RAIL: one number
        printed twice on one screen is two of them, and two places rendering one figure is how
        they come to disagree. The reassurance travels with the meter, in the rail.
      */}
      <p className="mt-2 max-w-2xl text-sm text-ink/70">
        Everything your <b>guests</b> and <b>suppliers</b> sent. Keep it, change it, or turn it
        down.
      </p>

      {/* A source that could not be read says so. An unreadable source and an
          empty one look identical, and this desk gates publishing. */}
      {unreadable.length > 0 ? (
        <p role="alert" className="mt-4 rounded-lg bg-terracotta/10 px-3 py-2 text-xs text-terracotta">
          We could not load {unreadable.join(', ')} just now, so this list may be incomplete.
          Nothing has been decided for you — try refreshing in a moment.
        </p>
      ) : null}
      {lettersDark ? (
        <p className="mt-2 text-xs text-ink/75">
          Letters are switched off for this event.
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={`min-h-11 rounded-full border px-3 py-1.5 text-[13px] transition ${
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
        <p role="alert" className="mt-3 text-[13px] font-semibold text-danger-700">
          {error}
        </p>
      ) : null}

      <div className="mt-4 divide-y divide-ink/10">
        {shown.map((item) => {
          const key = `${item.source}:${item.id}`;
          const held = item.heldBack !== null;
          return (
            <article
              key={key}
              className={held ? 'border-l-2 border-terracotta py-4 pl-3' : 'py-4'}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-ink/5 px-2 py-0.5 font-medium text-ink/70">
                  {SOURCE_LABEL[item.source]}
                </span>
                {item.byline ? <span className="text-ink/75">{item.byline}</span> : null}
                <span className="ml-auto text-ink/75">→ {item.landsIn}</span>
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
                  held ? 'text-terracotta' : 'text-ink/75'
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
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-3 py-1.5 text-xs text-ink/75">
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Held back
                  </span>
                ) : item.status === 'pending' ? (
                  <>
                    {/* 📐 DESIGN TEMPLATE (14 Nov 2026, rules 3 · 5 · 6 · 15): the shared pills (green Accept · grey Edit ·
                        red Reject), a grey "waiting" pill instead of a spinner; the outcome is the shared soft Badge. */}
                    <ActionButton
                      tone="ok"
                      icon={Check}
                      label="Accept"
                      waiting={pending}
                      onClick={() => run(() => decideDeskItem(eventId, item.source, item.id, 'accepted'))}
                    />
                    {item.editable ? (
                      <ActionButton
                        tone="neutral"
                        icon={Pencil}
                        label="Edit"
                        disabled={pending}
                        onClick={() => {
                          setEditing(key);
                          setDraft(item.body);
                        }}
                      />
                    ) : null}
                    <ActionButton
                      tone="danger"
                      icon={X}
                      label="Reject"
                      disabled={pending}
                      onClick={() => run(() => decideDeskItem(eventId, item.source, item.id, 'rejected'))}
                    />
                  </>
                ) : (
                  <>
                    <Badge tone={item.status === 'accepted' ? 'ok' : 'quiet'}>
                      {item.status === 'accepted' ? '✓ In the story' : '✕ Left out'}
                    </Badge>
                    {/* Undo, at any time. A rejection is silent and never final. */}
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => decideDeskItem(eventId, item.source, item.id, 'pending'))}
                      className="inline-flex min-h-11 items-center gap-1.5 text-[13px] text-ink/75 underline underline-offset-2"
                    >
                      <Undo2 className="h-3.5 w-3.5" aria-hidden="true" /> undo
                    </button>
                  </>
                )}

                {editing === key ? (
                  <>
                    <ActionButton
                      tone="brand"
                      icon={Check}
                      label="Save the words"
                      waiting={pending}
                      onClick={() => run(() => editDeskItem(eventId, item.source, item.id, draft))}
                    />
                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      className="min-h-11 text-[13px] text-ink/75 underline underline-offset-2"
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
        <p className="mt-4 py-2 text-sm text-ink/75">
          {items.length === 0
            ? 'Nothing yet. Anything your guests or suppliers send lands here.'
            : 'Nothing left under this filter.'}
        </p>
      ) : null}
    </section>
  );
}
