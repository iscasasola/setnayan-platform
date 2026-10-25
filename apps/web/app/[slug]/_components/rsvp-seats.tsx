import { InfoTip } from '@/app/_components/info-tip';
import { composeFormalName } from '@/lib/formal-name';
import { extraSeatTag, rsvpSeatsHeading, rsvpSeatsLine } from '@/lib/rsvp-seats-words';
import { RSVP_STEP_QUESTION_CLASS } from './rsvp-question-class';

/**
 * 🪑 THE SEATS STEP — the first thing a guest is told after "Joyfully accepts" (owner 2026-10-25, prototype
 * `rsvp_seats_2026-10-25`, scenarios A · B · C): "We reserved N seats for you" (N includes them), one tile per
 * seat — "You · +1 · +2" — and one line with the rest inside its ⓘ. It asks nothing and writes nothing: the count
 * is the couple's (`plus_one_count` on the guest's own row), the names are the +1 step's, right after.
 *
 * A server component (no state): the card stays server-rendered; the ⓘ is the shared `InfoTip`.
 */
export function RsvpSeats({
  seats,
  youLabel,
  extraNames,
  namesNext,
  organizer,
  question,
}: {
  /** Every seat the guest holds, themselves included (`1 + plusOneSeats`). */
  seats: number;
  /** Under "You" — what to call them (their nickname, else their first name). */
  youLabel: string;
  /** The extra seats' names in seat order, `null` while a seat is not named (or the list did not read). */
  extraNames: readonly (string | null)[];
  /** The +1 step follows — the line says to name them next. */
  namesNext: boolean;
  /** "the couple" / "the family". */
  organizer: string;
  /** One question per screen: the heading is the screen's question. */
  question: boolean;
}) {
  const extra = Math.max(0, seats - 1);
  const { line, tip } = rsvpSeatsLine({ seats, namesNext, organizer });
  return (
    <>
      <p className={question ? RSVP_STEP_QUESTION_CLASS : 'block text-sm font-medium text-ink'} data-rsvp-seats-heading="">
        {rsvpSeatsHeading(seats)}
      </p>
      <ul className="flex gap-2.5" aria-label="Your seats" data-rsvp-seat-tiles={seats}>
        <SeatTile tag="You" sub={youLabel} you />
        {Array.from({ length: extra }, (_, i) => (
          <SeatTile key={i} tag={extraSeatTag(i)} sub={extraNames[i]?.trim() || 'not named yet'} />
        ))}
      </ul>
      <InfoTip label={line} labelAs="p" labelClassName="text-sm text-ink/70" align="start" ariaLabel="About your seats">
        {tip}
      </InfoTip>
    </>
  );
}

function SeatTile({ tag, sub, you = false }: { tag: string; sub: string; you?: boolean }) {
  return (
    <li
      className={`min-w-0 flex-1 px-2 pb-2.5 pt-3 text-center text-xs ${you ? 'max-w-[7.5rem] text-ink' : 'text-ink/70'}`}
      data-rsvp-seat-tile={tag}
    >
      {/* 🪑 No frame on a seat — it is not pressed (lint-no-card · "frames only on what you press"): the seat icon
          carries it, mulberry for the guest's own, a quiet dashed one for a seat still to name. */}
      <svg
        aria-hidden
        viewBox="0 0 34 30"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeDasharray={you ? undefined : '3 2'}
        className={`mx-auto mb-1.5 block h-[30px] w-[34px] ${you ? 'text-mulberry' : 'text-ink/45'}`}
      >
        <path d="M7 4h20v12H7z" />
        <path d="M5 16h24v6H5z" />
        <path d="M8 22v6M26 22v6" />
      </svg>
      <b className="block text-sm font-semibold text-ink">{tag}</b>
      <span className="block truncate">{sub}</span>
    </li>
  );
}

/** "You're Teresita Aquino" — the guest's name as the couple wrote it (the five parts), read-only. */
export function rsvpYouName(guest: {
  name_prefix?: string | null;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  name_suffix?: string | null;
}): string {
  return (
    composeFormalName({
      name_prefix: guest.name_prefix,
      first_name: guest.first_name,
      middle_name: guest.middle_name,
      last_name: guest.last_name,
      name_suffix: guest.name_suffix,
    }) ?? `${guest.first_name} ${guest.last_name}`.trim()
  );
}
