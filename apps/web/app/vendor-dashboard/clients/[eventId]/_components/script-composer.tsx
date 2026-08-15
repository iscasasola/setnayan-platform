'use client';

import { useActionState, useState } from 'react';
import { Mic, Check } from 'lucide-react';
import { saveBlockScript, type ScriptActionState } from '../script-actions';

/**
 * The write box for one moment.
 *
 * Owner-locked 2026-08-01. Client-side only because a textarea needs local
 * state; every rule it obeys is decided server-side or in a tested pure module.
 *
 * ── TYPOGRAPHY IS A SAFETY CONTROL HERE ────────────────────────────────────
 *
 * On a public moment the line is set in the reading serif: serif means SAY
 * THIS. On a PRIVATE moment the same field is set in the UI face and relabeled
 * "not for the mic" — so a glance can never mistake staging notes for copy. He
 * is holding a live microphone; the visual difference has to survive a dim room
 * and a half-second look.
 *
 * ── DRAFT vs SAVED ─────────────────────────────────────────────────────────
 *
 * A line pre-filled from his library is a DRAFT until he keeps it: shown, but
 * marked, because a line written for another wedding has not yet been read
 * against this one.
 */
export function ScriptComposer({
  eventId,
  blockId,
  coupleName,
  label,
  initialBody,
  isDraft,
  isPrivate,
  unfilled,
}: {
  eventId: string;
  blockId: string;
  coupleName: string;
  label: string;
  initialBody: string;
  isDraft: boolean;
  isPrivate: boolean;
  unfilled: string[];
}) {
  const [state, formAction, pending] = useActionState<ScriptActionState, FormData>(
    saveBlockScript,
    { status: 'idle' },
  );
  const [body, setBody] = useState(initialBody);
  const [open, setOpen] = useState(initialBody.length > 0);

  const saved = state.status === 'saved';
  const dirty = body.trim() !== initialBody.trim();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2.5 w-full rounded-lg border border-dashed border-ink/20 px-3 py-2.5 text-left font-serif text-sm italic text-ink/35 transition hover:border-gold hover:text-ink/60"
      >
        Write your line…
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-2.5">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="blockId" value={blockId} />
      <input type="hidden" name="coupleName" value={coupleName} />

      <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-ink/50">
        {isPrivate ? (
          <>
            <span className="rounded bg-ink px-1.5 py-0.5 font-bold text-cream">
              Not for the mic
            </span>
            Your note to self
          </>
        ) : (
          <>
            <Mic className="h-3 w-3" aria-hidden />
            Your line
          </>
        )}
        {isDraft && !saved ? (
          <span className="ml-auto rounded bg-gold/15 px-1.5 py-0.5 text-gold-dark">
            Draft from your lines
          </span>
        ) : null}
      </p>

      <textarea
        name="body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        maxLength={2000}
        aria-label={`Your line for ${label}`}
        placeholder={
          isPrivate ? 'A note to yourself — never read aloud…' : 'Write the line you’ll actually say…'
        }
        className={[
          'mt-1.5 w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus:border-gold',
          // Serif = say this. Withheld on a private moment, deliberately.
          isPrivate ? 'text-sm' : 'font-serif text-[15px] leading-relaxed',
        ].join(' ')}
      />

      {unfilled.length > 0 ? (
        <p className="mt-1.5 text-xs text-gold-dark">
          Fill before the day: {unfilled.map((u) => `⟨${u}⟩`).join(' · ')}
        </p>
      ) : null}

      <div className="mt-2 flex items-center gap-2">
        <button
          type="submit"
          disabled={pending || (!dirty && !isDraft)}
          className="rounded-lg bg-ink px-3.5 py-1.5 text-xs font-semibold text-cream disabled:opacity-40"
        >
          {pending ? 'Saving…' : isDraft && !dirty ? 'Keep this line' : 'Save line'}
        </button>
        {saved ? (
          <span className="flex items-center gap-1 text-xs text-sage-deep">
            <Check className="h-3.5 w-3.5" aria-hidden />
            {state.message}
          </span>
        ) : state.status === 'error' ? (
          <span className="text-xs text-terracotta">{state.message}</span>
        ) : (
          <span className="ml-auto text-[11px] text-ink/40">
            Saves to this moment — moves if they move it
          </span>
        )}
      </div>
    </form>
  );
}
