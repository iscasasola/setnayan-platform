'use client';

import { useState, type FormEvent } from 'react';
import { RSVP_STEP_QUESTION_CLASS } from './rsvp-question-class';
import { LINKED_NAME_WORDS, plusOneNameSlots } from '@/lib/extra-seats';
import { MEAL_LABELS, type MealPreference } from '@/lib/guests';
import { plusOneScreenLine, plusOnesStepLine } from '@/lib/rsvp-seats-words';
import { InfoTip } from '@/app/_components/info-tip';
import { FormalNameInputs } from '@/app/_components/formal-name-inputs';
import { TickBox } from './tick-box';

/**
 * WHO ARE YOU BRINGING — one screen per plus-one seat, no switcher.
 *
 * Owner, verbatim, 2026-09-29: *"plus guests are only minimum questions. they
 * don't need to recommend songs and notes to the couple. They also get their
 * own QR Code. they can also link it to their account. Second, they can have
 * 1-4 pluses."* — and, 2026-10-25, on the reply's +1 step: *"Each plus
 * shouldn't come from a drop down and also allow them to checkbox Accept that
 * they are coming (required) if name is written down?"*, then *"one at a time"*,
 * then *"Tick only shows when there is name written. and that is required. If
 * you are not yet sure, delete name"*.
 *
 *   · EACH SEAT IS ITS OWN SCREEN — "+1", Next, "+2" … — each a `data-rsvp-step`
 *     of its own, so the progress dots count every +1 and Back returns to the one
 *     before with what was typed still there. The "Filling in for ▾" PickMenu is
 *     RETIRED (it chose which seat was on screen; the walker now does).
 *   · EACH SEAT IS ASKED ITS NAME, MEAL, DIETARY. The name is the FIVE parts
 *     every other name box uses (owner 2026-09-30) — the shared
 *     `FormalNameInputs`. No song, no note, no selfie. Meal and dietary obey the
 *     couple's same "ask" switches as the bringer's own.
 *   · "THEY'RE COMING" — the house tick (`tick-box.tsx`), drawn only once a name
 *     is written and then REQUIRED: Next (and Send) stop on that seat with "Tick
 *     to confirm they're coming". Never pre-ticked; it opens ticked only for a
 *     seat already on record as `attending` (the guest's own earlier tick).
 *     `submitRsvp` writes a ticked seat as attending and refuses a named seat
 *     posted without its tick (`readSeatNames` → `comingRefused`).
 *   · A BLANK NAME IS "+N TBA", allowed — Next just moves on. Naming a seat makes
 *     (or renames) its own guest row with its own QR — `submitRsvp` →
 *     `planSeatNames`, which never deletes.
 *
 * Progressive: before hydration (or without script) every seat is drawn, one
 * under the other — the form still works.
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
  /** This seat's own reply — `attending` once its bringer ticked "They're coming" (owner 2026-10-25). */
  rsvp_status?: string | null;
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
  /** On record as coming (`rsvp_status = 'attending'`) — the guest's own earlier tick, read back; never a default. */
  coming?: boolean;
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
      coming: Boolean(slot.name && seat?.rsvp_status === 'attending'),
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

export function RsvpPlusOnes({
  count,
  seats,
  legacyName,
  askMeal,
  askDietary,
  question = false,
  fallback = false,
}: {
  /**
   * 🧯 The seat list did not read (owner 2026-10-25, scenario E · decision 7): one box, and the line says so —
   * no count claimed, no "add more". The Seats step just before still says the true number (it reads the guest's
   * own row, which did not fail).
   */
  fallback?: boolean;
  /**
   * One question per screen (\`oneAtATime\`): the step's heading is drawn as
   * the screen's question — the same type every other step wears there.
   */
  question?: boolean;
  /** Seats the couple gave this guest, 1–4 (`plusOneSeats`). */
  count: number;
  seats: readonly PlusOneSeatInput[] | undefined;
  legacyName: string | null | undefined;
  /** "the couple" / "the family" — the event's own words. (The count line that named them moved to the Seats step.) */
  theOrganizer: string;
  askMeal: boolean;
  askDietary: boolean;
}) {
  const slots = plusOneSlots(count, seats, legacyName);
  /* 🪑 THE COUNT WAS ALREADY SAID (owner 2026-10-25, RSVP seats-first): the Seats step before this one says "We
     reserved N seats for you", so this line names WHICH seats these are — "+1 · name them, or leave it for later" —
     and the rest is inside its ⓘ. "+1 / +2" everywhere (decision 4). */
  const said = plusOnesStepLine({ extra: slots.length, fallback });

  /* 🪑 ONE SCREEN PER +1 (owner 2026-10-25, on the stacked-rows look: *"one at a time"*). Each seat is its own
     `data-rsvp-step` — "+1", Next, "+2" … — so the progress dots count every +1 and Back returns to the one before
     with what was typed still there (a step is only hidden, never unmounted). Without script every seat is drawn,
     one under the other. An empty +1 is passed with plain Next — no second button. */
  return (
    <div className="space-y-6" data-rsvp-plus-ones data-plus-one-screens={slots.length}>
      {slots.map((slot, i) => {
        const line = fallback ? said : plusOneScreenLine(i);
        return (
          <div key={i} data-rsvp-step data-plus-one-screen={i + 1} className="space-y-3">
            <span className={question ? RSVP_STEP_QUESTION_CLASS : 'block text-sm font-medium text-ink'}>
              Who are you bringing?
            </span>
            <InfoTip label={line.line} labelAs="p" labelClassName="text-sm text-ink/70" align="start" ariaLabel="About naming your seats">
              {line.tip}
            </InfoTip>
            <PlusOneSeatRow slot={slot} index={i} tagged={false} askMeal={askMeal} askDietary={askDietary} idPrefix="" />
          </div>
        );
      })}
    </div>
  );
}


/** The tick's words (owner 2026-10-25: *"checkbox Accept that they are coming (required) if name is written down"*). */
export const PLUS_ONE_COMING_WORDS = 'They’re coming';
/** The row's line when a name is written and the tick is not. */
export const PLUS_ONE_TICK_NEEDED = 'Tick to confirm they’re coming';

/**
 * The seats' boxes, one row each, stacked — Me's in-place "Add name" (frame E) draws its one seat with this. The
 * reply itself gives each seat its own screen (`RsvpPlusOnes`); both draw the same row (`PlusOneSeatRow`), so the
 * tick rules below are one rule:
 *   · 🔒 THE TICK IS AFFIRMATIVE — never ticked for a fresh answer (the house's consent style). It opens ticked only
 *     when THIS seat is already on record as coming (`attending`), which is the guest's own earlier tick read back.
 *   · NO TICK WITHOUT A NAME — not drawn until a name is written; clearing the name takes it away, unticked.
 *   · A NAME WITHOUT THE TICK DOES NOT CONTINUE — once drawn the tick is `required`, so Next and Send stop there.
 *   · A seat linked to its own account shows its locked name and no tick — that person answers for themself.
 */
export function PlusOneSeatPanels({
  slots,
  askMeal,
  askDietary,
  onName,
  idPrefix = '',
}: {
  slots: readonly PlusOneSlot[];
  askMeal: boolean;
  askDietary: boolean;
  /** Fires as a seat's First / Last change — Me's in-place "Add name" reads it. */
  onName?: (index: number, fullName: string) => void;
  /**
   * Prefixes the element ids ONLY — never the field names, which the one seat
   * rule reads (`readSeatNames`). Me's in-place "Add name" (frame E) draws these
   * same boxes on a page that may also hold the reply's, so its labels must not
   * point at the reply's inputs.
   */
  idPrefix?: string;
}) {
  return (
    <div className="divide-y divide-ink/10" data-plus-one-rows={slots.length}>
      {slots.map((slot, i) => (
        <PlusOneSeatRow
          key={i}
          slot={slot}
          index={i}
          tagged={slots.length > 1}
          askMeal={askMeal}
          askDietary={askDietary}
          idPrefix={idPrefix}
          onName={onName}
        />
      ))}
    </div>
  );
}

function PlusOneSeatRow({
  slot,
  index,
  tagged,
  askMeal,
  askDietary,
  idPrefix,
  onName,
}: {
  slot: PlusOneSlot;
  index: number;
  /** "+1", "+2" over each row when there is more than one (one seat: the step's own line already says "+1"). */
  tagged: boolean;
  askMeal: boolean;
  askDietary: boolean;
  idPrefix: string;
  onName?: (index: number, fullName: string) => void;
}) {
  const n = index + 1;
  const opened = `${slot.first} ${slot.last}`.trim();
  const [named, setNamed] = useState(Boolean(opened));
  const [coming, setComing] = useState(Boolean(slot.coming && opened));
  const readName = (input: HTMLElement) => {
    const row = input.closest('[data-plus-one-seat]');
    const f = row?.querySelector<HTMLInputElement>(`[name="plus_one_first_name_${n}"]`)?.value ?? '';
    const l = row?.querySelector<HTMLInputElement>(`[name="plus_one_last_name_${n}"]`)?.value ?? '';
    const full = `${f} ${l}`.replace(/\s+/g, ' ').trim();
    setNamed(Boolean(full));
    // A cleared name drops its tick — typing it again asks afresh (never pre-ticked).
    if (!full) setComing(false);
    onName?.(index, full);
  };
  const tickId = `${idPrefix}plus_one_coming_${n}`;
  return (
    <div data-plus-one-seat={n} className="space-y-4 py-5 first:pt-2">
      {tagged ? (
        <p className="font-serif text-base text-ink" data-plus-one-tag="">
          {seatNumber(index)}
        </p>
      ) : null}
      {slot.seatId ? <input type="hidden" name={`plus_one_seat_id_${n}`} value={slot.seatId} /> : null}
      {/* 🔒 LOCKED ONCE THEY LINK THEIR OWN ACCOUNT (owner 2026-09-29,
          OWNER ANSWERS (10)): the name is shown, never posted — so the
          reply writes only this seat's meal and dietary. `submitRsvp`
          refuses a posted name for a linked seat as well. */}
      {slot.linked ? (
        <p className="text-sm text-ink" data-plus-one-linked="">
          <span className="font-medium">{opened}</span>
          <span className="text-ink/70"> · {LINKED_NAME_WORDS}</span>
        </p>
      ) : (
        <>
          <div>
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
          </div>
          {/* 🫥 THE TICK SHOWS ONLY ONCE A NAME IS WRITTEN (owner 2026-10-25: *"Tick only shows when there is name
              written. and that is required. If you are not yet sure, delete name"*). Unmounted while the name is
              empty, so it can never post — and clearing the name takes the tick and its line with it. */}
          {named ? (
          <div data-needed-at="" data-plus-one-coming-row="">
            {/* The house tick (`tick-box.tsx`) — the Terms tick's own piece: a 44 px press, a 20 px box. */}
            <label htmlFor={tickId} className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm text-ink">
              <TickBox
                press="-mx-3 -my-3"
                id={tickId}
                name={`plus_one_coming_${n}`}
                value="1"
                checked={coming}
                onChange={(e) => setComing(e.currentTarget.checked)}
                required
                data-needed-words={PLUS_ONE_TICK_NEEDED}
                data-plus-one-coming=""
              />
              {PLUS_ONE_COMING_WORDS}
            </label>
          </div>
          ) : null}
        </>
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
