import { PapicStayForm } from './papic-stay-form';
import { ChallengeAddSheet } from './challenge-add-sheet';
import { SWITCH_BUTTON, SwitchTrack } from '@/app/_components/switch-track';
import { setCoupleChallengeActiveAction } from '../actions';

type SlotMission = { mission_id: string; prompt: string; is_active: boolean; capture_kind?: string | null };

/**
 * challenge-card-row.tsx — ONE OF THE TEN CHALLENGE SLOTS IN THE PAPIC CARD (owner 2026-10-27, verbatim: *"so in papic
 * challenge, there will be 10 challenges the can make. choose a challenge or turn that challenge off. turning 1 off will
 * become 9 of 10 challenges. it stays there, but just off."*).
 *
 *   the challenge's name — a press: it opens the one challenge sheet (search the library · create your own), and a pick
 *   REPLACES this slot's challenge in place (`replace_mission_id`; the old one is retired, never deleted, so photos
 *   already taken keep it) · its switch — on = live on the app; off = it stays in its slot, greyed, not live.
 *
 * No ✕: a slot is never emptied by hand (controller's call on the owner's wording — "off + change", fewer controls).
 * `mission` null = a slot the event has not filled yet; it reads "Choose a challenge" and opens the same sheet.
 * Both presses save in place (#6970's `PapicStayForm`). `full` — 10 are live — disables turning another on (the server
 * refuses an 11th anyway, `activationRefused`). Its own file so a lab can draw it with no database.
 */
export function ChallengeCardRow({
  eventId,
  eventType,
  taken,
  mission,
  full,
  returnTo = null,
}: {
  eventId: string;
  eventType: string | null;
  taken: readonly number[];
  mission: SlotMission | null;
  full: boolean;
  returnTo?: 'home' | null;
}) {
  const m = mission;
  return (
    <li className="flex items-center gap-2" data-papic-challenge={m?.mission_id ?? 'empty'} data-papic-challenge-live={m ? (m.is_active ? 'on' : 'off') : 'empty'}>
      <ChallengeAddSheet eventId={eventId} eventType={eventType} taken={taken} full={full} returnTo={returnTo} slot={{ mission: m }} />
      {m ? (
        <PapicStayForm door="setCoupleChallengeActiveAction" action={setCoupleChallengeActiveAction} className="shrink-0">
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="mission_id" value={m.mission_id} />
          <input type="hidden" name="active" value={m.is_active ? 'false' : 'true'} />
          {returnTo ? <input type="hidden" name="return_to" value={returnTo} /> : null}
          <button type="submit" role="switch" aria-checked={m.is_active} aria-label={m.prompt} className={SWITCH_BUTTON} disabled={!m.is_active && full} data-papic-challenge-switch="">
            <SwitchTrack on={m.is_active} />
          </button>
        </PapicStayForm>
      ) : null}
    </li>
  );
}
