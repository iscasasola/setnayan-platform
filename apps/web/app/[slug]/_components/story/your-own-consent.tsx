'use client';

/**
 * your-own-consent.tsx — "Something of yours here you'd rather not show?"
 *
 * `01_The_Story.md` §3.7. The ONLY place on this page a guest can act on their
 * own consent, and it offers exactly the two doors the design names — hide it,
 * or ask to be unnamed — because those are two different wishes with two
 * different mechanics.
 *
 * 🔑 BOTH SERVER ACTIONS ALREADY SHIPPED OR ARE ONE FUNCTION AWAY, AND NEITHER
 * IS REBUILT HERE (RULE 0):
 *
 *   HIDE IT        → `askToTakeMyPhotoDown` (shipped). A REQUEST, because the
 *                    photograph is not theirs to delete — it was taken by
 *                    somebody else and may hold four other people. Their TAG
 *                    comes off in the same press, immediately, because that
 *                    half needs nobody's permission.
 *   BE UNNAMED     → `askToBeUnnamed`. IMMEDIATE, because their own name on
 *                    their own sentence is nobody else's. Q2, ruled
 *                    2026-09-09; the role rides the same consent.
 *
 * ⚠ IT SAYS WHICH ONE IT DID. The two feel the same to press and are not the
 * same promise, and a control that answers "Done" to both would be telling
 * somebody their photograph is gone when a person has yet to look at it.
 */

import { useState, useTransition } from 'react';
import { askToBeUnnamed, askToTakeMyPhotoDown } from '../../actions';

type Said = { key: string; namedPublicly: boolean };
type Item = { key: string; sourceTable: 'papic_photos' | 'papic_guest_captures'; sourceId: string };

export function YourOwnConsent({
  eventId,
  items,
  said,
}: {
  eventId: string;
  /** Their own captures and the photographs of them — one may be hidden. */
  items: Item[];
  /** Their own words — the "unnamed" door only exists if a name is on one. */
  said: Said[];
}) {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<string>(items[0]?.key ?? '');
  const [note, setNote] = useState('');
  const [say, setSay] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const named = said.some((s) => s.namedPublicly);
  if (items.length === 0 && !named) return null;

  const hide = () => {
    const it = items.find((i) => i.key === pick);
    if (!it) return;
    start(async () => {
      const form = new FormData();
      if (note.trim()) form.set('note', note.trim());
      const r = await askToTakeMyPhotoDown(eventId, it.sourceTable, it.sourceId, form);
      setSay(
        r.ok
          ? r.alreadyAsked
            ? 'You have already asked about this one. It is with a person — you do not need to ask again.'
            : 'Asked. Your tag came off this photograph now; a person reads the rest of it. We will not put it back on you.'
          : r.message,
      );
    });
  };

  const unname = () => {
    start(async () => {
      const r = await askToBeUnnamed(eventId);
      setSay(
        r.ok
          ? r.changed > 0
            ? 'Done, now. Your name has come off what you wrote here — and off the printed copies from their next run.'
            : 'Nothing of yours is carrying your name here.'
          : r.message,
      );
    });
  };

  return (
    <div className="mt-4 border-t border-ink/15 pt-4">
      <p className="text-[13.5px] text-ink/70">
        Something of yours here you would rather not show?{' '}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="min-h-[44px] font-semibold text-terracotta-700 underline-offset-4 hover:underline"
        >
          Hide it, or ask to be unnamed
        </button>
      </p>

      {open ? (
        <div className="mt-3 grid gap-3 rounded-lg border border-dashed border-ink/25 p-3.5">
          {items.length > 0 ? (
            <div className="grid gap-2">
              <label
                htmlFor="own-consent-pick"
                className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-ink/60"
              >
                Which one
              </label>
              <select
                id="own-consent-pick"
                value={pick}
                onChange={(e) => setPick(e.target.value)}
                className="min-h-[44px] rounded-lg border border-ink/25 bg-white/60 px-3 text-[15px] text-ink"
              >
                {items.map((i, k) => (
                  <option key={i.key} value={i.key}>
                    {`Photograph ${k + 1}`}
                  </option>
                ))}
              </select>
              {/*
                A textarea, and it asks for a SENTENCE about a photograph — never
                a name. The whole panel is reached only from a signed session, so
                there is nobody to identify and nothing to look up.
              */}
              <textarea
                name="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Anything you want the person reading this to know (optional)"
                className="rounded-lg border border-ink/25 bg-white/60 px-3 py-2 text-[15px] text-ink placeholder:text-ink/60"
              />
              <button
                type="button"
                onClick={hide}
                disabled={busy || !pick}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-ink bg-ink px-4 font-mono text-xs font-bold uppercase tracking-[0.12em] text-cream disabled:opacity-50"
              >
                Ask for this one to come down
              </button>
              <p className="text-xs leading-snug text-ink/60">
                Your tag comes off straight away. The photograph itself goes to a person, because
                it may hold others as well as you.
              </p>
            </div>
          ) : null}

          {named ? (
            <div className="grid gap-2 border-t border-ink/10 pt-3">
              <button
                type="button"
                onClick={unname}
                disabled={busy}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-ink px-4 font-mono text-xs font-bold uppercase tracking-[0.12em] text-ink disabled:opacity-50"
              >
                Take my name off what I wrote
              </button>
              <p className="text-xs leading-snug text-ink/60">
                This one happens now. Your words stay; your name and your role come off them.
              </p>
            </div>
          ) : null}

          {say ? (
            <p aria-live="polite" className="text-[13.5px] leading-snug text-ink">
              {say}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
