import { X } from 'lucide-react';
import { PapicStayForm } from './papic-stay-form';
import { SWITCH_BUTTON, SwitchTrack } from '@/app/_components/switch-track';
import { deleteCoupleChallengeAction, setCoupleChallengeActiveAction } from '../actions';

/**
 * challenge-card-row.tsx — ONE CHALLENGE IN THE PAPIC CARD (owner 2026-10-26, DECISION_LOG "PAPIC CHALLENGES: A LIVE
 * SWITCH AND AN ✕"): *"challenges will have a toggle to make that challenge live and happening on the app. but it also
 * needs a (X) to remove that challenge."*
 *
 *   its name (+ Photo / Clip tag) · its switch — live on the app / paused (`is_active`, the shipped hide; paused stays
 *   listed so it can come back) · ✕ remove (44 px) — `deleteCoupleChallengeAction`, a SOFT remove: photos already taken
 *   keep the challenge; anything after, there is no challenge.
 *
 * Both presses save in place (#6970's `PapicStayForm`). `full` — 10 are live — disables turning another one on (the
 * server refuses an 11th anyway, `activationRefused`). Its own file so a lab can draw it with no database.
 */
export function ChallengeCardRow({
  eventId,
  mission,
  full,
  returnTo = null,
}: {
  eventId: string;
  mission: { mission_id: string; prompt: string; is_active: boolean; capture_kind?: string | null };
  full: boolean;
  returnTo?: 'home' | null;
}) {
  const m = mission;
  const ret = returnTo ? <input type="hidden" name="return_to" value={returnTo} /> : null;
  return (
    <li className="flex items-center gap-2 py-1.5" data-papic-challenge={m.mission_id} data-papic-challenge-live={m.is_active ? 'on' : 'off'}>
      <span className={`min-w-0 flex-1 text-[14px] ${m.is_active ? 'text-ink' : 'text-ink/55'}`}>
        {m.prompt}
        {m.capture_kind ? (
          <span className="ml-1.5 inline-block rounded-full bg-ink/10 px-1.5 py-0.5 align-middle text-[10px] font-medium uppercase tracking-[0.08em] text-ink/60">
            {m.capture_kind === 'clip' ? 'Clip' : 'Photo'}
          </span>
        ) : null}
      </span>
      <PapicStayForm door="setCoupleChallengeActiveAction" action={setCoupleChallengeActiveAction} className="shrink-0">
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="mission_id" value={m.mission_id} />
        <input type="hidden" name="active" value={m.is_active ? 'false' : 'true'} />
        {ret}
        <button type="submit" role="switch" aria-checked={m.is_active} aria-label={m.prompt} className={SWITCH_BUTTON} disabled={!m.is_active && full} data-papic-challenge-switch="">
          <SwitchTrack on={m.is_active} />
        </button>
      </PapicStayForm>
      <PapicStayForm door="deleteCoupleChallengeAction" action={deleteCoupleChallengeAction} className="shrink-0">
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="mission_id" value={m.mission_id} />
        {ret}
        <button
          type="submit"
          aria-label={`Remove “${m.prompt}”`}
          title="Remove"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink/50 transition-colors hover:bg-ink/5 hover:text-ink"
          data-papic-challenge-remove=""
        >
          <X aria-hidden className="h-[18px] w-[18px]" strokeWidth={2} />
        </button>
      </PapicStayForm>
    </li>
  );
}
