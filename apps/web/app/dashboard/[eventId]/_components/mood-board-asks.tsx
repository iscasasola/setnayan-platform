'use client';

import { useId, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { Check, RotateCcw, X } from 'lucide-react';

import { Sheet } from '@/app/_components/sheet';
import { InfoTip } from '@/app/_components/info-tip';
import { PeekToast } from '@/app/_components/toast/peek-toast';
import {
  declineInspirationSuggestion,
  keepInspirationSuggestion,
  undoMoodBoardChange,
} from '../studio/mood-board/suggestion-actions';
import {
  changeTitle,
  changeWhat,
  changesTodayWords,
  suggestionsTodayWords,
  undoLeft,
  type HomeChange,
  type HomeSuggestion,
} from '@/lib/mood-board-changes';
import { HomeTodayItem } from './home-parts';

type Said = { key: number; tone: 'ok' | 'bad'; words: string };
type Open = 'approve' | 'changes' | null;

/** The Mood Board's server actions — the shipped ones; the dev lab hands in stand-ins that never reach the database. */
export type MoodBoardAsksActions = {
  keepInspirationSuggestion: typeof keepInspirationSuggestion;
  declineInspirationSuggestion: typeof declineInspirationSuggestion;
  undoMoodBoardChange: typeof undoMoodBoardChange;
};
const REAL: MoodBoardAsksActions = { keepInspirationSuggestion, declineInspirationSuggestion, undoMoodBoardChange };

const NOT_SAVED = 'We couldn’t save that just now — please try again.';

/**
 * 🖼⏱ HOME'S MOOD BOARD ASKS — two lines of the Today list, each answered IN PLACE in the house Sheet (owner 2026-10-30,
 * DECISION_LOG "MOOD BOARD CHANGES: SUPPLIERS ASK, COORDINATORS APPLY, THE OWNERS HAVE 24 HOURS TO UNDO" and its Home
 * follow-up: *"So the changes made will show on home and the hosts need to approve it"*).
 *
 *   · "<shop> suggested a photo · Stage" → the Sheet lists each waiting photo with Decline · Keep. Shown to whoever may
 *     answer: the hosts, and a coordinator / helper / supplier the hosts set to Mood Board Edit.
 *   · "Coordinator <name> changed the Mood Board · Stage" → the Sheet lists the last 24 hours of changes by someone who
 *     is not an owner, each with Undo and the time it has left. The owners' alone — the server says so again.
 *
 * The same pattern as the coordinator's access line beside it (`coordinator-level-ask.tsx`): the Today line is the
 * press, a choice saves in place (the row leaves at once, the toast says what happened), a refusal is said in words
 * and the row comes back. Both lists come from ONE read (`mood_board_home_asks`), done by the server doorway.
 */
export function MoodBoardAsks({
  eventId,
  suggestions,
  changes,
  actions,
  now,
}: {
  eventId: string;
  suggestions: HomeSuggestion[];
  changes: HomeChange[];
  /** The lab's stand-ins; the app passes nothing and runs the real actions. */
  actions?: Partial<MoodBoardAsksActions>;
  /** The lab's fixed clock (the screenshot's "23 h left"); the app passes nothing. */
  now?: string;
}) {
  const act: MoodBoardAsksActions = { ...REAL, ...actions };
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Open>(null);
  const [said, setSaid] = useState<Said | null>(null);
  const [busy, startTransition] = useTransition();
  const approveHeading = useId();
  const changesHeading = useId();
  const clock = now ? new Date(now) : new Date();

  const say = (tone: Said['tone'], words: string) => setSaid({ key: Date.now(), tone, words });
  const hide = (id: string) => setGone((g) => new Set(g).add(id));
  const bringBack = (id: string) =>
    setGone((g) => {
      const n = new Set(g);
      n.delete(id);
      return n;
    });

  const waiting = suggestions.filter((s) => !gone.has(s.suggestionId));
  const undoable = changes.filter((c) => !gone.has(c.changeId) && undoLeft(c.undoUntil, clock) !== null);

  const keep = (s: HomeSuggestion) => {
    hide(s.suggestionId);
    startTransition(async () => {
      try {
        const r = await act.keepInspirationSuggestion(eventId, s.suggestionId, null);
        if (r.status === 'ok') return say('ok', `Kept · on the Mood Board under ${s.partLabel}.`);
        if (r.status === 'gone') return say('ok', 'Someone already answered this one.');
        bringBack(s.suggestionId);
        say('bad', r.status === 'full' ? `${s.partLabel} already holds three photos — remove one on the Mood Board first.` : NOT_SAVED);
      } catch (e) {
        bringBack(s.suggestionId);
        say('bad', e instanceof Error && e.message ? e.message : NOT_SAVED);
      }
    });
  };

  const decline = (s: HomeSuggestion) => {
    hide(s.suggestionId);
    startTransition(async () => {
      try {
        const r = await act.declineInspirationSuggestion(eventId, s.suggestionId);
        if (r.status === 'ok') return say('ok', `Declined · the photo from ${s.shopLabel} stays off the board.`);
        if (r.status === 'gone') return say('ok', 'Someone already answered this one.');
        bringBack(s.suggestionId);
        say('bad', NOT_SAVED);
      } catch (e) {
        bringBack(s.suggestionId);
        say('bad', e instanceof Error && e.message ? e.message : NOT_SAVED);
      }
    });
  };

  const undo = (c: HomeChange) => {
    hide(c.changeId);
    startTransition(async () => {
      try {
        const r = await act.undoMoodBoardChange(eventId, { changeId: c.changeId });
        if (r.status === 'ok') return say('ok', 'Undone — that part of the Mood Board is back as it was.');
        if (r.status === 'already') return say('ok', r.message);
        bringBack(c.changeId);
        say('bad', 'message' in r ? r.message : NOT_SAVED);
      } catch (e) {
        bringBack(c.changeId);
        say('bad', e instanceof Error && e.message ? e.message : NOT_SAVED);
      }
    });
  };

  const toast =
    said && typeof document !== 'undefined'
      ? createPortal(
          <PeekToast key={said.key} tone={said.tone} data="mood-board-asks" onGone={() => setSaid(null)}>
            {said.words}
          </PeekToast>,
          document.body,
        )
      : null;

  return (
    <>
      {waiting.length > 0 ? (
        <HomeTodayItem
          words={suggestionsTodayWords(waiting)}
          tail="Keep or decline"
          onPress={() => setOpen('approve')}
          disabled={busy}
          dataAttr={['data-mood-board-asks', 'approve']}
        />
      ) : null}
      {undoable.length > 0 ? (
        <HomeTodayItem
          words={changesTodayWords(undoable)}
          tail={undoable.length === 1 ? `Undo · ${undoLeft(undoable[0]!.undoUntil, clock)!.replace(' to undo', '')}` : 'Undo within 24 hours'}
          onPress={() => setOpen('changes')}
          disabled={busy}
          dataAttr={['data-mood-board-asks', 'changes']}
        />
      ) : null}

      <Sheet open={open === 'approve'} onClose={() => setOpen(null)} labelledById={approveHeading} rise>
        <div className="px-4 pb-4 pt-3.5" data-mood-board-asks-sheet="approve">
          <div className="pr-12">
            <InfoTip
              label="To approve"
              labelAs="h3"
              labelId={approveHeading}
              labelClassName="text-[19px] font-semibold leading-snug tracking-tight text-ink"
              align="start"
            >
              A booked supplier suggested these for your Mood Board. Keep puts the photo on the board in the first free
              place; Decline sends it back. Anyone you gave Mood Board Edit can answer too.
            </InfoTip>
            <p className="text-sm text-ink/60">Suppliers’ photos for your Mood Board.</p>
          </div>
          {waiting.length === 0 ? (
            <p className="mt-4 text-sm text-ink/60">Nothing waiting.</p>
          ) : (
            <ul className="mt-3 divide-y divide-ink/10">
              {waiting.map((s) => (
                <li key={s.suggestionId} className="flex items-center gap-3 py-3" data-mood-board-suggestion="">
                  {s.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a supplier's screened photo URL, shown as the Studio shows it
                    <img src={s.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <span aria-hidden className="h-14 w-14 shrink-0 rounded-xl bg-ink/5" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold leading-snug text-ink [overflow-wrap:anywhere]">From {s.shopLabel}</span>
                    <span className="block text-[13px] text-ink/60">{s.partLabel}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => decline(s)}
                    disabled={busy}
                    aria-label={`Decline the photo from ${s.shopLabel}`}
                    className="sn-press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-ink/15 bg-cream text-ink/70 disabled:opacity-60" // no-card-ok: a <button> (declines the photo)
                  >
                    <X aria-hidden className="h-5 w-5" strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    onClick={() => keep(s)}
                    disabled={busy}
                    data-testid="mood-board-keep"
                    className="sn-press inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-mulberry px-4 text-[14px] font-semibold text-cream disabled:opacity-60" // no-card-ok: a <button> (keeps the photo)
                  >
                    <Check aria-hidden className="h-4 w-4" strokeWidth={2.2} />
                    Keep
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Sheet>

      <Sheet open={open === 'changes'} onClose={() => setOpen(null)} labelledById={changesHeading} rise>
        <div className="px-4 pb-4 pt-3.5" data-mood-board-asks-sheet="changes">
          <div className="pr-12">
            <InfoTip
              label="Changed by others"
              labelAs="h3"
              labelId={changesHeading}
              labelClassName="text-[19px] font-semibold leading-snug tracking-tight text-ink"
              align="start"
            >
              The people you gave Mood Board Edit change it straight away. You have 24 hours to undo each change; after
              that it stands. Undo puts that part back exactly as it was. If the same part changed again since, undo the
              later change first.
            </InfoTip>
            <p className="text-sm text-ink/60">You have 24 hours to undo each one.</p>
          </div>
          {undoable.length === 0 ? (
            <p className="mt-4 text-sm text-ink/60">Nothing left to undo.</p>
          ) : (
            <ul className="mt-3 divide-y divide-ink/10">
              {undoable.map((c) => (
                <li key={c.changeId} className="flex items-center gap-3 py-3" data-mood-board-change="">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold leading-snug text-ink [overflow-wrap:anywhere]">{changeTitle(c)}</span>
                    <span className="block text-[13px] text-ink/60">
                      {changeWhat(c)} · {undoLeft(c.undoUntil, clock)}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => undo(c)}
                    disabled={busy}
                    data-testid="mood-board-undo"
                    className="sn-press inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-4 text-[14px] font-semibold text-ink disabled:opacity-60" // no-card-ok: a <button> (undoes the change)
                  >
                    <RotateCcw aria-hidden className="h-4 w-4" strokeWidth={2} />
                    Undo
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Sheet>
      {toast}
    </>
  );
}
