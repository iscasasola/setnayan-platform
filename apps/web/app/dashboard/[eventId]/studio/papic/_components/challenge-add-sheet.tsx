'use client';

/**
 * challenge-add-sheet.tsx — "+ ADD A CHALLENGE", A POP-UP IN THE PAPIC CARD (owner ruling 2026-10-24: "opens a POP-UP:
 * the shared bottom sheet, not a new page and not inline. A search box over title and prompt, a category PickMenu
 * dropdown, and a Photo/Clip filter. The list comes from the 631 library and hides the ones already on the event.
 * Tapping one adds it through the shipped action. '+ Add your own' lives in that sheet.").
 *
 * NOTHING HERE IS NEW MACHINERY:
 *   · the list is the SHIPPED picker read (`fetchPickerRows`, `lib/papic-challenge-picker.ts` — the same query, order,
 *     "taken" rule and page size the challenges page uses), run with the browser's own client on open and on every
 *     filter change, so Home's render carries none of the library;
 *   · a tap posts the SHIPPED `addLibraryChallengeAction` (library_id; the server's caps decide);
 *   · "+ Add your own" posts the SHIPPED `createCoupleChallengeAction`.
 * At the cap (10 running) the sheet still opens, says so, and turns nothing on — the server refuses an 11th anyway.
 */

import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { ActionButton } from '@/components/action-button';
import { SubmitButton } from '@/app/_components/submit-button';
import { PickMenu } from '../../../website/editor/_components/pick-menu';
import { createClient } from '@/lib/supabase/client';
import { fetchPickerRows, sanitizeQuery, type PickerRow } from '@/lib/papic-challenge-picker';
import { CATEGORY_LABELS, CATEGORY_ORDER, type ChallengeCategory } from '@/lib/papic-challenge-categories';
import { formatCount } from '@/lib/format-number';
import { addLibraryChallengeAction, createCoupleChallengeAction } from '../actions';

type Read = { rows: PickerRow[]; total: number } | 'loading' | 'unread';

export function ChallengeAddSheet({
  eventId,
  eventType,
  taken,
  full,
  returnTo,
}: {
  eventId: string;
  eventType: string | null;
  /** The library rows this event already carries — hidden from the list (the shipped picker's own rule). */
  taken: readonly number[];
  /** 10 already running — nothing more may be turned on. */
  full: boolean;
  returnTo: 'home' | null;
}) {
  const headingId = useId();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<ChallengeCategory | 'all'>('all');
  const [kind, setKind] = useState<'all' | 'photo' | 'clip'>('all');
  const [read, setRead] = useState<Read>('loading');

  useEffect(() => {
    if (!open) return;
    let live = true;
    setRead('loading');
    const t = setTimeout(() => {
      fetchPickerRows(createClient(), eventType, new Set(taken), {
        q: sanitizeQuery(q),
        category: category === 'all' ? null : category,
        kind: kind === 'all' ? null : kind,
      })
        .then((r) => {
          if (live) setRead(r.readable ? { rows: r.rows, total: r.total } : 'unread');
        })
        .catch(() => {
          if (live) setRead('unread');
        });
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [open, q, category, kind, eventType, taken]);

  const ret = returnTo ? <input type="hidden" name="return_to" value={returnTo} /> : null;

  const sheet = open ? (
    <Sheet open onClose={() => setOpen(false)} labelledById={headingId} title="Add a challenge" wide>
      <div className="flex flex-col gap-3 px-4 pb-6 pt-3" data-papic-challenge-sheet="">
        <h2 id={headingId} className="text-[19px] font-semibold tracking-tight text-ink">
          Add a challenge
        </h2>
        {full ? (
          <p role="status" className="text-[13px] text-terracotta-700" data-papic-challenge-full="">
            10 are running — the most an event can have. Turn one off first.
          </p>
        ) : null}
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search challenges"
          aria-label="Search challenges"
          className="h-10 rounded-full border border-ink/15 bg-paper px-4 text-[14px] text-ink placeholder:text-ink/40"
        />
        <div className="flex flex-wrap items-center gap-2">
          <PickMenu
            label="Category"
            value={category}
            options={[{ key: 'all', label: 'Every category' }, ...CATEGORY_ORDER.map((c) => ({ key: c, label: CATEGORY_LABELS[c] }))]}
            onPick={(k) => setCategory(k as ChallengeCategory | 'all')}
            dataAttr="data-papic-challenge-category"
            compact
          />
          <PickMenu
            label="Photo or clip"
            value={kind}
            options={[
              { key: 'all', label: 'Photo or clip' },
              { key: 'photo', label: 'Photo' },
              { key: 'clip', label: 'Clip' },
            ]}
            onPick={(k) => setKind(k as 'all' | 'photo' | 'clip')}
            dataAttr="data-papic-challenge-kind"
            compact
          />
        </div>
        {read === 'loading' ? (
          <p className="text-[13px] text-ink/55" aria-live="polite">
            Loading challenges…
          </p>
        ) : read === 'unread' ? (
          <p role="status" className="text-[13px] text-ink/65">
            We couldn’t load the challenges just now. Nothing changed — try again.
          </p>
        ) : (
          <>
            <p className="text-[12.5px] text-ink/55">
              {formatCount(read.rows.length)} of {formatCount(read.total)}
            </p>
            {read.rows.length === 0 ? (
              <p className="text-[13px] text-ink/65">No challenge matches — try another search.</p>
            ) : (
              <ul className="divide-y divide-ink/10" data-papic-challenge-library="">
                {read.rows.map((r) => (
                  <li key={r.library_id}>
                    <form action={addLibraryChallengeAction} className="flex items-center gap-3 py-2.5">
                      <input type="hidden" name="event_id" value={eventId} />
                      <input type="hidden" name="library_id" value={String(r.library_id)} />
                      {ret}
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] text-ink">
                          {r.title}
                          <span className="ml-1.5 inline-block rounded-full bg-ink/10 px-1.5 py-0.5 align-middle text-[10px] font-medium uppercase tracking-[0.08em] text-ink/60">
                            {r.capture_kind === 'clip' ? 'Clip' : 'Photo'}
                          </span>
                        </span>
                        <span className="block text-[12.5px] text-ink/55">{r.prompt}</span>
                      </span>
                      <SubmitButton className="inline-flex h-10 shrink-0 items-center rounded-full border border-ink/15 px-4 text-[13px] font-medium text-ink hover:bg-ink/5 disabled:opacity-45" disabled={full}>
                        Add
                      </SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        <form action={createCoupleChallengeAction} className="flex flex-col gap-1.5 border-t border-ink/10 pt-3" data-papic-challenge-own="">
          <input type="hidden" name="event_id" value={eventId} />
          {ret}
          <label htmlFor={`own-challenge-${eventId}`} className="text-[14px] font-medium text-ink">
            + Add your own
          </label>
          <span className="flex items-center gap-2">
            <input
              id={`own-challenge-${eventId}`}
              name="prompt"
              maxLength={280}
              required
              placeholder="Get a photo with the newlyweds on the dance floor"
              className="h-10 min-w-0 flex-1 rounded-full border border-ink/15 bg-paper px-4 text-[14px] text-ink placeholder:text-ink/40"
            />
            <SubmitButton className="inline-flex h-10 shrink-0 items-center rounded-full border border-ink/15 px-4 text-[13px] font-medium text-ink hover:bg-ink/5 disabled:opacity-45">Add</SubmitButton>
          </span>
          <span className="text-[12px] text-ink/55">Up to 280 characters · it turns on if you have room</span>
        </form>
      </div>
    </Sheet>
  ) : null;

  return (
    <>
      <ActionButton
        tone="neutral"
        icon={<Plus aria-hidden="true" strokeWidth={1.9} />}
        label="Add a challenge"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="papic-challenge-add"
      />
      {sheet && typeof document !== 'undefined' ? createPortal(sheet, document.body) : null}
    </>
  );
}
