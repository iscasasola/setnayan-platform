'use client';

import { useActionState, useState } from 'react';
import { Mic, Check } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Badge } from '@/app/_components/badge';
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
        className="mt-2.5 flex min-h-12 w-full items-center rounded-lg border border-dashed border-ink/20 px-3 text-left font-serif text-[15px] italic text-ink/70 hover:border-gold"
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

      <p className="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-[0.08em] text-ink/70">
        {isPrivate ? (
          <>
            <span className="rounded bg-ink px-1.5 py-0.5 font-bold text-cream">Not for the mic</span>
            Your note to self
          </>
        ) : (
          <>
            <Mic className="h-4 w-4" aria-hidden />
            Your line
          </>
        )}
        {isDraft && !saved ? (
          <span className="ml-auto normal-case tracking-normal">
            <Badge tone="wait" data="script-draft">Draft from your lines</Badge>
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
        <p className="mt-1.5 text-[13px] font-semibold text-warn-800">
          Fill before the day: {unfilled.map((u) => `⟨${u}⟩`).join(' · ')}
        </p>
      ) : null}

      <div className="mt-2 flex items-center gap-2">
        <ActionButton
          type="submit"
          tone="brand"
          icon={Check}
          label={pending ? 'Saving…' : isDraft && !dirty ? 'Keep this line' : 'Save line'}
          disabled={pending || (!dirty && !isDraft)}
        />
        {saved ? (
          <span className="flex items-center gap-1 text-[13px] font-semibold text-success-700">
            <Check className="h-4 w-4" aria-hidden />
            {state.message}
          </span>
        ) : state.status === 'error' ? (
          <span role="alert" className="text-[13px] font-semibold text-danger-700">{state.message}</span>
        ) : (
          <span className="ml-auto text-[13px] text-ink/70">
            Saves to this moment — moves if they move it
          </span>
        )}
      </div>
    </form>
  );
}
