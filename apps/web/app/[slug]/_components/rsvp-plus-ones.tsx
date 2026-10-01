'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { LINKED_NAME_WORDS, plusOneNameSlots } from '@/lib/extra-seats';
import { MEAL_LABELS, type MealPreference } from '@/lib/guests';
import { formatCount } from '@/lib/format-number';
import { FormalNameInputs } from '@/app/_components/formal-name-inputs';

/**
 * WHO ARE YOU BRINGING — one short set per plus-one seat, and one switcher.
 *
 * Owner, verbatim, 2026-09-29: *"plus guests are only minimum questions. they
 * don't need to recommend songs and notes to the couple. They also get their
 * own QR Code. they can also link it to their account. Second, they can have
 * 1-4 pluses. so there needs to be a way to write their names in a simpler way.
 * like a toggle on which guest they are editing."*
 *
 *   · EACH SEAT IS ASKED FOUR THINGS — its name, meal, dietary. The name is
 *     the FIVE parts every other name box uses (owner 2026-09-30: *"The name
 *     will be same: Prefix · First · Middle · Last · Suffix, to stay
 *     consistent"*) — the shared `FormalNameInputs`, never a pair of its own.
 *     No song, no note to the couple, no selfie: those are the plus-one's own to
 *     answer on their own key, if the couple asks. Meal and dietary obey the
 *     couple's same "ask" switches as the bringer's own.
 *   · ONE SWITCHER picks whose details are on screen — "Filling in for: Maria
 *     Santos ▾" — the shared `PickMenu` (owner rule: a set of choices is ONE
 *     dropdown, never a pill row). A named seat shows ✓; an unnamed one reads
 *     "Guest 2".
 *   · 🔒 SWITCHING NEVER UNMOUNTS A SEAT. Every seat's boxes stay in the form —
 *     the others are only hidden — so what was typed survives a switch and every
 *     seat POSTs on Send. `PlusOneSeatPanels` is split out so a test can render
 *     it at any active seat and see all of them there.
 *   · A BLANK NAME IS "+N TBA", allowed. Naming a seat makes (or renames) its
 *     own guest row with its own QR — `submitRsvp` → `planSeatNames`, which
 *     never deletes: clearing a name keeps the row; removing is the host's.
 *
 * Progressive: before hydration (or without script) every seat is drawn, one
 * under the other, each with its own heading — the form still works.
 */

export type PlusOneSeatInput = {
  guest_id: string;
  name: string | null;
  first?: string | null;
  last?: string | null;
  /** The seat's other stored name parts (owner 2026-09-30, five parts). */
  prefix?: string | null;
  middle?: string | null;
  suffix?: string | null;
  meal?: string | null;
  dietary?: string | null;
  linked?: boolean;
};

export type PlusOneSlot = {
  seatId: string | null;
  first: string;
  last: string;
  prefix?: string;
  middle?: string;
  suffix?: string;
  meal: string;
  dietary: string;
  /** 🔒 Their own account holds this seat — the name is theirs (owner 2026-09-29). */
  linked?: boolean;
};

/** The meal order the bringer's own picker uses. */
const MEAL_ORDER: MealPreference[] = ['no_preference', 'beef', 'chicken', 'fish', 'vegetarian', 'vegan', 'kids'];

/** One slot per seat the couple gave, opened on what that seat already holds. */
export function plusOneSlots(
  count: number,
  seats: readonly PlusOneSeatInput[] | undefined,
  legacyName: string | null | undefined,
): PlusOneSlot[] {
  return plusOneNameSlots(count, seats, legacyName).map((slot) => {
    const seat = slot.seatId ? seats?.find((s) => s.guest_id === slot.seatId) : undefined;
    const whole = (slot.name ?? '').trim();
    // The stored parts when the loader carried them; else split the one name.
    const first = seat?.first ?? (whole.split(' ')[0] ?? '');
    const last = seat?.last ?? whole.split(' ').slice(1).join(' ');
    return {
      seatId: slot.seatId,
      first: slot.name ? first : '',
      last: slot.name ? last : '',
      prefix: slot.name ? (seat?.prefix ?? '') : '',
      middle: slot.name ? (seat?.middle ?? '') : '',
      suffix: slot.name ? (seat?.suffix ?? '') : '',
      meal: seat?.meal && (MEAL_ORDER as string[]).includes(seat.meal) ? seat.meal : 'no_preference',
      dietary: seat?.dietary ?? '',
      linked: Boolean(seat?.linked && slot.name),
    };
  });
}

/**
 * A seat is numbered by SEAT, never by headcount (owner 2026-09-29, on the
 * prototype: *"you showed 3 seats but you named it guest 3 and guest 4"*):
 * "The couple saved you 3 seats" lists exactly +1, +2, +3.
 */
export function seatNumber(index: number): string {
  return `+${index + 1}`;
}

/** The at-a-glance word for a seat: its name, else "+2". */
export function seatLabel(name: string, index: number): string {
  return name.trim() || seatNumber(index);
}

/** Option key for "You — <name>", ahead of the seats (prototype frame B). */
export const YOU_KEY = 'you';

/**
 * The switcher's options: "You — Maria Santos" (when given), then one per
 * seat — "+1 · Ben Reyes ✓" once named, "+2 · not named yet" until then.
 */
export function seatOptions(names: readonly string[], youName?: string | null): { key: string; label: string }[] {
  const seats = names.map((n, i) => ({
    key: String(i),
    label: n.trim() ? `${seatNumber(i)} · ${n.trim()} ✓` : `${seatNumber(i)} · not named yet`,
  }));
  return youName?.trim() ? [{ key: YOU_KEY, label: `You — ${youName.trim()}` }, ...seats] : seats;
}

export function RsvpPlusOnes({
  count,
  seats,
  legacyName,
  theOrganizer,
  askMeal,
  askDietary,
  youName = null,
  question = false,
}: {
  /**
   * One question per screen (\`oneAtATime\`): the step's heading is drawn as
   * the screen's question — the same type every other step wears there.
   */
  question?: boolean;
  /**
   * The bringer's own name — the switcher's first row, "You — Maria Santos"
   * (prototype frame B), which takes them to their OWN answers on this card.
   * Null = no such row (one-question-per-screen: their answers are the next
   * steps, reached with Next).
   */
  youName?: string | null;
  /** Seats the couple gave this guest, 1–4 (`plusOneSeats`). */
  count: number;
  seats: readonly PlusOneSeatInput[] | undefined;
  legacyName: string | null | undefined;
  /** "the couple" / "the family" — the event's own words. */
  theOrganizer: string;
  askMeal: boolean;
  askDietary: boolean;
}) {
  const slots = plusOneSlots(count, seats, legacyName);
  const [names, setNames] = useState<string[]>(() => slots.map((s) => `${s.first} ${s.last}`.trim()));
  // Opens on the first seat still without a name — where the work is left
  // (the thank-you's "Add their name" lands here) — else the first.
  const [active, setActive] = useState(() => Math.max(0, names.findIndex((n) => !n)));
  const [arranged, setArranged] = useState(false);
  useEffect(() => setArranged(true), []);
  const rootRef = useRef<HTMLDivElement>(null);

  /** "You — …": to the guest's own first answer on this card (meal, else contact). */
  const goToYou = () => {
    const form = rootRef.current?.closest('form');
    const own = ['meal_preference', 'dietary_restrictions', 'contact_email']
      .map((id) => form?.querySelector<HTMLElement>(`#${id}`))
      .find((el) => el && el.getClientRects().length > 0);
    own?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    own?.focus({ preventScroll: true });
  };

  const many = slots.length > 1;
  const Organizer = theOrganizer.charAt(0).toUpperCase() + theOrganizer.slice(1);

  return (
    <div ref={rootRef} className="space-y-3" data-rsvp-plus-ones>
      <span className={question ? 'block font-serif text-xl leading-snug text-ink' : 'block text-sm font-medium text-ink'}>
        Who are you bringing?
      </span>
      <p className="text-xs text-ink/70">
        {/* ⚖ The number is the couple's (owner 2026-09-21: up to +4). */}
        {Organizer} saved you {many ? `${formatCount(slots.length)} seats` : 'a seat for one more'}.{' '}
        {many ? 'Name them and each one gets' : 'Name them and they get'} their own invitation, QR and photos — or
        add {many ? 'names' : 'a name'} later.
      </p>

      {many && arranged ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1" data-plus-one-switcher>
          <span className="text-sm text-ink/80">Filling in for:</span>
          <PickMenu
            label="Filling in for"
            value={String(active)}
            options={seatOptions(names, youName)}
            onPick={(k) => (k === YOU_KEY ? goToYou() : setActive(Number(k)))}
            dataAttr="data-plus-one-pick"
            className="border border-ink/15 text-sm"
          />
        </div>
      ) : null}

      {many && arranged ? (
        /* Every seat at a glance — "Ben Reyes ✓ · Guest 3 · Guest 4" (frame C). */
        <p className="text-xs text-ink/70" aria-live="polite" data-plus-one-summary>
          {names.map((n, i) => (n.trim() ? `${n.trim()} ✓` : seatLabel('', i))).join(' · ')}
        </p>
      ) : null}

      <PlusOneSeatPanels
        slots={slots}
        active={active}
        arranged={arranged && many}
        askMeal={askMeal}
        askDietary={askDietary}
        onName={(i, full) => setNames((prev) => prev.map((n, j) => (j === i ? full : n)))}
      />
    </div>
  );
}

/**
 * Every seat's boxes, ALWAYS all of them — `arranged` only hides the ones that
 * are not `active`. Keyed by seat position, never by the active seat, so a
 * switch re-renders the same inputs and nothing typed is lost.
 */
export function PlusOneSeatPanels({
  slots,
  active,
  arranged,
  askMeal,
  askDietary,
  onName,
  idPrefix = '',
}: {
  slots: readonly PlusOneSlot[];
  active: number;
  arranged: boolean;
  askMeal: boolean;
  askDietary: boolean;
  onName?: (index: number, fullName: string) => void;
  /**
   * Prefixes the element ids ONLY — never the field names, which the one seat
   * rule reads (`readSeatNames`). Me's in-place "Add name" (frame E) draws these
   * same boxes on a page that may also hold the reply's, so its labels must not
   * point at the reply's inputs.
   */
  idPrefix?: string;
}) {
  const many = slots.length > 1;
  return (
    <>
      {slots.map((slot, i) => {
        const n = i + 1;
        const away = arranged && i !== active;
        const readName = (input: HTMLElement) => {
          const panel = input.closest('[data-plus-one-seat]');
          const f = panel?.querySelector<HTMLInputElement>(`[name="plus_one_first_name_${n}"]`)?.value ?? '';
          const l = panel?.querySelector<HTMLInputElement>(`[name="plus_one_last_name_${n}"]`)?.value ?? '';
          onName?.(i, `${f} ${l}`.replace(/\s+/g, ' ').trim());
        };
        return (
          <div key={i} data-plus-one-seat={n} className={away ? 'hidden' : 'space-y-4'}>
            {many && !arranged ? (
              <p className="font-serif text-base text-ink">
                {seatNumber(i)}
                {`${slot.first} ${slot.last}`.trim() ? ` · ${`${slot.first} ${slot.last}`.trim()}` : ''}
              </p>
            ) : null}
            {slot.seatId ? <input type="hidden" name={`plus_one_seat_id_${n}`} value={slot.seatId} /> : null}
            {/* 🔒 LOCKED ONCE THEY LINK THEIR OWN ACCOUNT (owner 2026-09-29,
                OWNER ANSWERS (10)): the name is shown, never posted — so the
                reply writes only this seat's meal and dietary. `submitRsvp`
                refuses a posted name for a linked seat as well. */}
            {slot.linked ? (
              <p className="text-sm text-ink" data-plus-one-linked="">
                <span className="font-medium">{`${slot.first} ${slot.last}`.trim()}</span>
                <span className="text-ink/60"> · {LINKED_NAME_WORDS}</span>
              </p>
            ) : (
            <FormalNameInputs
              defaults={{
                name_prefix: slot.prefix,
                first_name: slot.first,
                middle_name: slot.middle,
                last_name: slot.last,
                name_suffix: slot.suffix,
              }}
              nameStart="plus_one_"
              nameEnd={`_${n}`}
              idPrefix={idPrefix}
              onInput={(e) => readName(e.currentTarget)}
            />
            )}
            {askMeal ? (
              <div className="space-y-1.5">
                <label htmlFor={`${idPrefix}plus_one_meal_${n}`} className="block text-sm font-medium text-ink">
                  Meal preference
                </label>
                <select
                  id={`${idPrefix}plus_one_meal_${n}`}
                  name={`plus_one_meal_${n}`}
                  defaultValue={slot.meal}
                  className="input-field appearance-none bg-cream pr-8"
                >
                  {MEAL_ORDER.map((m) => (
                    <option key={m} value={m}>
                      {MEAL_LABELS[m]}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {askDietary ? (
              <SeatField
                id={`${idPrefix}plus_one_dietary_${n}`}
                name={`plus_one_dietary_${n}`}
                label="Dietary notes"
                defaultValue={slot.dietary}
                placeholder="halal · nut allergy · …"
              />
            ) : null}
          </div>
        );
      })}
    </>
  );
}

function SeatField({
  id,
  name,
  label,
  defaultValue,
  placeholder,
  autoComplete,
  onInput,
}: {
  id: string;
  /** The field the seat rule reads — the id may carry a prefix, this never does. */
  name: string;
  label: string;
  defaultValue: string;
  placeholder: string;
  autoComplete?: 'off';
  onInput?: (e: FormEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="text"
        defaultValue={defaultValue}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onInput={onInput}
        className="input-field"
      />
    </div>
  );
}
