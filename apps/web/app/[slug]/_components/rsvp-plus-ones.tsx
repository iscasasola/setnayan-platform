'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { plusOneNameSlots } from '@/lib/extra-seats';
import { MEAL_LABELS, type MealPreference } from '@/lib/guests';

/**
 * WHO ARE YOU BRINGING — one short set per plus-one seat, and one switcher.
 *
 * Owner, verbatim, 2026-09-29: *"plus guests are only minimum questions. they
 * don't need to recommend songs and notes to the couple. They also get their
 * own QR Code. they can also link it to their account. Second, they can have
 * 1-4 pluses. so there needs to be a way to write their names in a simpler way.
 * like a toggle on which guest they are editing."*
 *
 *   · EACH SEAT IS ASKED FOUR THINGS — first name, last name, meal, dietary.
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
  meal?: string | null;
  dietary?: string | null;
};

export type PlusOneSlot = {
  seatId: string | null;
  first: string;
  last: string;
  meal: string;
  dietary: string;
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
      meal: seat?.meal && (MEAL_ORDER as string[]).includes(seat.meal) ? seat.meal : 'no_preference',
      dietary: seat?.dietary ?? '',
    };
  });
}

/** "Guest 2" for an unnamed seat — the seat's number among the plus-ones. */
export function seatLabel(name: string, index: number): string {
  return name.trim() || `Guest ${index + 1}`;
}

/** The switcher's options: each seat's typed name (✓) or "Guest N". */
export function seatOptions(names: readonly string[]): { key: string; label: string }[] {
  return names.map((n, i) => ({
    key: String(i),
    label: n.trim() ? `${n.trim()} ✓` : seatLabel('', i),
  }));
}

export function RsvpPlusOnes({
  count,
  seats,
  legacyName,
  theOrganizer,
  askMeal,
  askDietary,
}: {
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

  const many = slots.length > 1;
  const Organizer = theOrganizer.charAt(0).toUpperCase() + theOrganizer.slice(1);
  const named = names.filter((n) => n.trim()).length;

  return (
    <div className="space-y-3" data-rsvp-plus-ones>
      <span className="block text-sm font-medium text-ink">Who are you bringing?</span>
      <p className="text-xs text-ink/70">
        {/* ⚖ The number is the couple's (owner 2026-09-21: up to +4). */}
        {Organizer} saved you {many ? `${slots.length} more seats` : 'a seat for one more'}. Give us{' '}
        {many ? 'their names and they each get' : 'their name and they get'} their own invitation and their own
        QR — leave a name blank if you don&rsquo;t know yet.
      </p>

      {many && arranged ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1" data-plus-one-switcher>
          <span className="text-sm text-ink/80">Filling in for:</span>
          <PickMenu
            label="Filling in for"
            value={String(active)}
            options={seatOptions(names)}
            onPick={(k) => setActive(Number(k))}
            dataAttr="data-plus-one-pick"
            className="border border-ink/15 text-sm"
          />
          <span className="text-xs text-ink/70" aria-live="polite">
            {named} of {slots.length} named
          </span>
        </div>
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
}: {
  slots: readonly PlusOneSlot[];
  active: number;
  arranged: boolean;
  askMeal: boolean;
  askDietary: boolean;
  onName?: (index: number, fullName: string) => void;
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
              <p className="font-serif text-base text-ink">{seatLabel(`${slot.first} ${slot.last}`, i)}</p>
            ) : null}
            {slot.seatId ? <input type="hidden" name={`plus_one_seat_id_${n}`} value={slot.seatId} /> : null}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SeatField
                id={`plus_one_first_name_${n}`}
                label="First name"
                defaultValue={slot.first}
                placeholder="First name"
                autoComplete="off"
                onInput={(e) => readName(e.currentTarget)}
              />
              <SeatField
                id={`plus_one_last_name_${n}`}
                label="Last name"
                defaultValue={slot.last}
                placeholder="Last name"
                autoComplete="off"
                onInput={(e) => readName(e.currentTarget)}
              />
            </div>
            {askMeal ? (
              <div className="space-y-1.5">
                <label htmlFor={`plus_one_meal_${n}`} className="block text-sm font-medium text-ink">
                  Their meal
                </label>
                <select
                  id={`plus_one_meal_${n}`}
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
                id={`plus_one_dietary_${n}`}
                label="Their dietary notes"
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
  label,
  defaultValue,
  placeholder,
  autoComplete,
  onInput,
}: {
  id: string;
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
        name={id}
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
