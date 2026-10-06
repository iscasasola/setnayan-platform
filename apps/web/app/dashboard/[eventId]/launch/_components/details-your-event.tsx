'use client';

import { Suspense, useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { MapPin } from 'lucide-react';
import { sanitizeName } from '@/lib/match-criteria';
import { makerSave, requestMakerRefresh } from '@/lib/maker-refresh';
import type { ScheduleMatrix } from '@/lib/schedule-matrix';
import { hubDraftAction } from '../../website/hub-draft-actions';
import { AddressPinField } from '../../_components/address-pin-field';
import type { LatLng } from '@/app/vendor-dashboard/_components/branch-pin-map';
import { CityPick, nearestCity } from './details-city-pick';
import { GovernedFields } from '../../details/_components/governed-fields';
import { FindDateCandidates, FindDatePicked, useDateState } from './details-date-finder';
import { PickMenu, type PickOption } from '../../website/editor/_components/pick-menu';
import { FileUpload } from '@/app/_components/file-upload';
import type { VenueChoice, VenueSlotKey } from '@/lib/event-venues';
import { sceneBackgroundPathPrefix } from '@/lib/scene-media-choices';
import { NAME_STYLE_CHOICES, type NameStyle } from '@/lib/name-style';
import { nameStyleDraftPatch } from '@/lib/name-style-save';
import { coupleNameColumns } from '@/lib/typed-names';
import type { DateClash } from '@/lib/date-fits-booked';
import { DateClashNote } from './details-date-clash';

/**
 * DETAILS › YOUR EVENT — the editors (Details part 2a; owner 2026-09-28,
 * DECISION_LOG "DETAILS IS THE ONE FILL-IN AREA…" + "OPTION B…").
 *
 * 🔑 +0 WRITERS. Every field here saves through a door that already exists —
 * the same columns, the same checks (owner: "NO 'GO EDIT IT OVER THERE' LINKS
 * — EDIT IT WHERE YOU ARE"; one source, two doors):
 *
 *   · Names  → the Event Hub DRAFT (`hubDraftAction`, owner 2026-10-01 "wait
 *     for apply": names typed in the Maker are a draft until Apply, like every
 *     Maker edit) — `bride_name` / `groom_name` and the page's names, composed
 *     by `coupleNameColumns`, the rule the Personalization page's writer
 *     (`updateEventMatchCriteria`) writes live. Nothing else is posted, so
 *     region, feel and birth data are never near it. Where the BaZi
 *     birth-data section is live the page still mounts the shipped form whole
 *     (`maker-details.tsx`).
 *   · Date   → `GovernedFields` (only its date row): the booked-supplier
 *     conflict preview, then the DRAFT (`saveDate`) — Apply asks
 *     `updateEventDate`'s own gates (`eventDateRefusal`) when it goes live.
 *     "Help me choose" is the shipped Find your date, opened in place; "Use
 *     <day>" hands the day to that row. A month is drafted the same way.
 *   · Venues → the DRAFT too (owner 2026-10-04, design "venues get a pin and
 *     a picked city"): the typed venue names, street addresses and map pins
 *     the Event Hub, the prints and the Save-the-Date read
 *     (`HUB_DRAFT_VENUE_COLUMNS`; `lib/event-venues.ts`), the one City or area
 *     (a closed pick), and each card's source and photo
 *     (`widgets.venue_map.venue`). A BOOKED venue comes from its booking and
 *     is shown, not retyped — unless the couple picks "Enter your own".
 *   · Ceremony time → the DRAFT (`ceremony_time`): at Apply it creates or
 *     moves the Schedule's Ceremony block — the one the invitation prints.
 *
 * Everything here waits for Apply (guests, Home and suppliers read the live
 * row until then). Opening an item never writes.
 */

/**
 * ✍ NO SAVE BUTTON IN A STEP (owner, live iPhone test 2026-10-05 — "why are
 * there so many inconsistencies"; INTERACTION_RULES §8): every field here is
 * drafted AS IT IS TYPED, a short pause after the last change (`AutoDraft`),
 * shown on the page at once, and guests see it at Apply. The ✓ Apply count
 * rising is the "saved".
 */
const AUTO_DRAFT_MS = 900;

/**
 * ✍ A typed name or date → the Event Hub DRAFT, through the one draft door
 * (`hubDraftAction` intent=save — the same door `who-can-reply-ask.tsx` and
 * every Maker pick use). The Maker then draws once with the draft laid on.
 * Resolves null when saved, else the reason in words.
 */
async function draftFactsFull(eventId: string, events: Record<string, unknown>): Promise<{ error: string; clash?: DateClash[] } | null> {
  const fd = new FormData();
  fd.set('intent', 'save');
  fd.set('patch', JSON.stringify({ events }));
  const r = await makerSave(() => hubDraftAction(eventId, fd), requestMakerRefresh);
  if (r.ok) return null;
  return { error: r.error || 'That did not save. Nothing changed — please try again.', ...('clash' in r && r.clash ? { clash: r.clash } : {}) };
}
async function draftFacts(eventId: string, events: Record<string, unknown>): Promise<string | null> {
  return (await draftFactsFull(eventId, events))?.error ?? null;
}

// ── NAMES ─────────────────────────────────────────────────────────────────────

type PersonName = { first: string; last: string };

export function NamesEditor({
  eventId,
  people,
  initial,
}: {
  eventId: string;
  /** The two people's words from the event type (`peopleLabels`). */
  people: readonly [string, string];
  initial: readonly [PersonName, PersonName];
}) {
  const [a, setA] = useState<PersonName>(initial[0]);
  const [b, setB] = useState<PersonName>(initial[1]);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    setError(null);
    // The Personalization writer's own composition; an all-blank form leaves the page's names alone.
    const events = coupleNameColumns(a, b);
    start(async () => {
      try {
        const refused = await draftFacts(eventId, events);
        if (refused) setError(refused);
      } catch {
        setError('That did not save. Nothing changed — please try again.');
      }
    });
  };

  const row = (label: string, v: PersonName, set: (n: PersonName) => void) => (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1 text-xs font-medium text-ink/70">{label}</legend>
      <div className="grid grid-cols-2 gap-2">
        <input
          value={v.first}
          onChange={(e) => {
            set({ ...v, first: sanitizeName(e.target.value) });
          }}
          maxLength={80}
          autoCapitalize="words"
          placeholder="First name"
          aria-label={`${label} — first name`}
          className="min-h-11 rounded-md border border-ink/15 bg-white px-3 text-[16px] text-ink"
        />
        <input
          value={v.last}
          onChange={(e) => {
            set({ ...v, last: sanitizeName(e.target.value) });
          }}
          maxLength={80}
          autoCapitalize="words"
          placeholder="Last name"
          aria-label={`${label} — last name`}
          className="min-h-11 rounded-md border border-ink/15 bg-white px-3 text-[16px] text-ink"
        />
      </div>
    </fieldset>
  );

  return (
    <section data-details-names="" className="flex flex-col gap-3">
      {row(people[0], a, setA)}
      {row(people[1], b, setB)}
      <AutoDraft watch={JSON.stringify([a, b])} pending={pending} error={error} onSave={save} />
    </section>
  );
}

/**
 * 🔤 NAME STYLE ▾ — how every FORMAL surface prints a guest's name (owner
 * 2026-09-30, DECISION_LOG "THE COUPLE PICKS A NAME STYLE"): Full "Mr. Manuel
 * Cortez Casasola" (the default) · Middle initial "Mr. Manuel C. Casasola" ·
 * Surname first "Mr. Casasola, Manuel C.". ONE event-wide PickMenu (a set of
 * choices is a dropdown), under the Names, in place.
 *
 * ✍ A PICK WAITS FOR APPLY (owner 2026-10-01, "in event hub maker will only
 * take effect when pressed apply"): shown AT ONCE here, held in the Event Hub
 * DRAFT (`draftFacts` → `events.print_details` as `{ name_style }` only), and
 * written to the prints' one setting (`print_details.name_style`) when the
 * couple presses Apply. The latest pick is held in a ref so two quick picks
 * never save out of order, and a failure puts back only the latest. Then the
 * Maker's pictures redraw — the invitation and the ticket beside it are drawn
 * in the style.
 */
export function NameStylePicker({ eventId, saved }: { eventId: string; saved: NameStyle }) {
  const [shown, setShown] = useState<NameStyle>(saved);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const latest = useRef<NameStyle>(saved);
  const stored = useRef<NameStyle>(saved);

  const pick = (key: string) => {
    const style = NAME_STYLE_CHOICES.find((c) => c.key === key)?.key;
    if (!style || style === latest.current) return;
    latest.current = style;
    setShown(style);
    setError(null);
    start(async () => {
      let refused: string | null;
      try {
        refused = await draftFacts(eventId, nameStyleDraftPatch(style).events ?? {});
      } catch {
        refused = 'That did not save. Nothing changed — please try again.';
      }
      if (refused === null) {
        stored.current = style;
        return;
      }
      if (latest.current === style) {
        latest.current = stored.current;
        setShown(stored.current);
        setError('That name style did not save — please try again.');
      }
    });
  };

  /* No line under it (owner 2026-10-05: no captions under controls) — the
     style shows on the cards above the sheet the moment it is picked. */
  return (
    <section data-name-style={shown} aria-busy={pending || undefined} className="flex flex-col gap-1.5 border-t border-ink/10 pt-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[13px] font-semibold text-ink">Name style</span>
        <PickMenu
          label="Name style"
          value={shown}
          options={NAME_STYLE_CHOICES.map((c): PickOption => ({ key: c.key, label: c.label }))}
          onPick={pick}
          dataAttr="data-name-style-pick"
        />
      </div>
      {error ? (
        <p role="alert" className="text-[12.5px] text-terracotta-700">
          {error}
        </p>
      ) : null}
    </section>
  );
}

/**
 * ONE NAME — a single-person event's (a birthday, a debut, a wake): the
 * event's own `display_name`, which the hero, every print and every pass read
 * (owner 2026-09-29, "yes to all 4", item 3). Drafted like the two names
 * (owner 2026-10-01, "wait for apply") — `display_name` and nothing else, the
 * one column `updateEventMatchCriteria`'s `celebrant_name` door writes live.
 */
export function OneNameEditor({ eventId, initial }: { eventId: string; initial: string }) {
  const [name, setName] = useState(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    setError(null);
    const typed = name.replace(/\s+/g, ' ').trim();
    // An emptied box is a name being retyped — nothing is sent until there is one.
    if (!typed) return;
    start(async () => {
      try {
        const refused = await draftFacts(eventId, { display_name: typed });
        if (refused) setError(refused);
      } catch {
        setError('That did not save. Nothing changed — please try again.');
      }
    });
  };
  return (
    <section data-details-one-name="" className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink/70">Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          autoCapitalize="words"
          aria-label="Name, as guests read it"
          /* 🔗 The Event Name the page types into too (`lib/maker-parts.ts` `info:display_name`) — one value. */
          data-same-field="display_name"
          className="min-h-11 rounded-md border border-ink/15 bg-white px-3 text-[16px] text-ink"
        />
      </label>
      <AutoDraft watch={name} pending={pending} error={error} onSave={save} />
    </section>
  );
}

// ── DATE ──────────────────────────────────────────────────────────────────────

type GovernedDate = {
  confirmedVendorCount: number;
  dateDisplay: string | null;
  dateValue: string | null;
  /** The date row's label in the event's words ("Wedding date", "Birthday date"). */
  label: string;
};

export function DateEditor({
  eventId,
  governed,
  matrix,
  nudge = null,
  helpFirst = false,
  ceremonyTime = null,
}: {
  eventId: string;
  governed: GovernedDate;
  /** 🕒 The Ceremony block's start, `HH:MM` on the venue's wall clock — as drafted, else live (null = none yet). */
  ceremonyTime?: string | null;
  /** Open on "Help me choose" — where the old /find-date lands. */
  helpFirst?: boolean;
  /** The shipped Find your date's matrix, still loading — read only when "Help me choose" opens. */
  matrix: Promise<ScheduleMatrix | null>;
  /** The Chinese-tradition note date-selection shows (null when it does not apply). */
  nudge?: ReactNode;
}) {
  // Shared with the middle (`DateBody`): "Help me choose" puts the candidate days there.
  const [{ mode }, setDate] = useDateState(helpFirst);
  const setMode = (m: 'have' | 'help') => setDate({ mode: m });
  const [proposal, setProposal] = useState<{ field: 'date'; value: string; n: number } | null>(null);
  const [monthError, setMonthError] = useState<string | null>(null);
  /* 🗓 A day or month a BOOKED supplier cannot do is refused at the pick — it
     never reaches the draft — and the supplier is named with one way to ask
     them (owner 2026-10-01). `note` is a pick that was kept. */
  const [clash, setClash] = useState<{ reason: string; list: readonly DateClash[]; pick: { date: string; precision: string } } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();

  /**
   * A date to the draft. Null when saved; else the reason in words — and when a
   * booked supplier clashes, `clashed` is true and the supplier note below says
   * it (with who and where to ask), so a caller does not say it twice.
   */
  const draftDate = async (events: Record<string, unknown>): Promise<{ error: string; clashed: boolean } | null> => {
    setClash(null);
    setNote(null);
    const refused = await draftFactsFull(eventId, events);
    if (!refused) return null;
    if (refused.clash?.length) {
      setClash({
        reason: refused.error,
        list: refused.clash,
        pick: { date: String(events.event_date ?? ''), precision: String(events.event_date_precision ?? 'day') },
      });
    }
    return { error: refused.error, clashed: Boolean(refused.clash?.length) };
  };

  const pickDay = (dateKey: string) => {
    setClash(null);
    setNote(null);
    setMonthError(null);
    // Booked suppliers hold the date row (read-only): the pick goes to the draft
    // itself, where a clash is refused with its reason — never silently dropped.
    if (governed.confirmedVendorCount > 0) {
      start(async () => {
        try {
          const refused = await draftDate({ event_date: dateKey, event_date_precision: 'day' });
          // Q8 (owner 2026-10-02): a day every booked supplier can do goes live at
          // Apply, and each of them is told "The date moved to <date>".
          if (!refused) setNote('Saved to your draft — your booked suppliers can do this day. They are told when you Apply.');
          else if (!refused.clashed) setMonthError(refused.error);
        } catch {
          setMonthError('That day did not save. Please try again.');
        }
      });
      return;
    }
    setMode('have');
    setProposal((p) => ({ field: 'date', value: dateKey, n: (p?.n ?? 0) + 1 }));
  };
  const month = (m: string) => {
    if (!/^\d{4}-\d{2}$/.test(m)) return;
    setMonthError(null);
    start(async () => {
      try {
        // Drafted — a month a booked supplier cannot do is refused here, with the
        // reason; Apply asks the date's other gates (a past month, a held date).
        const refused = await draftDate({ event_date: `${m}-01`, event_date_precision: 'month' });
        if (refused && !refused.clashed) setMonthError(refused.error);
      } catch {
        setMonthError('That month did not save. Please try again.');
      }
    });
  };
  /** The governed row's day → the draft (after its booked-supplier preview). */
  const saveDay = async (value: string) => (await draftDate({ event_date: value, event_date_precision: 'day' }))?.error ?? null;

  return (
    <section data-details-date="" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-ink">Your date</span>
        <PickMenu
          label="Your date"
          value={mode}
          dataAttr="data-date-mode"
          options={[
            { key: 'have', label: 'I have a date' },
            { key: 'help', label: 'Help me choose' },
          ]}
          onPick={(k) => setMode(k === 'help' ? 'help' : 'have')}
        />
      </div>
      {mode === 'have' ? (
        <>
        <GovernedFields
          eventId={eventId}
          confirmedVendorCount={governed.confirmedVendorCount}
          ceremony={null}
          secondaryCeremony={null}
          venue={null}
          ceremonyVenue={null}
          pax={null}
          dateDisplay={governed.dateDisplay}
          dateValue={governed.dateValue}
          only={['date']}
          labels={{ date: governed.label }}
          proposal={proposal}
          embedded
          saveDate={saveDay}
        />
        <CeremonyTimeEditor eventId={eventId} initial={ceremonyTime} hasDay={Boolean(governed.dateValue)} />
        </>
      ) : (
        <Suspense fallback={<p className="text-sm text-ink/60">Checking your suppliers’ calendars…</p>}>
          <FindDatePicked matrix={matrix} onUse={pickDay} onMonth={month} monthError={monthError} pending={pending} />
          {nudge}
        </Suspense>
      )}
      {clash ? <DateClashNote eventId={eventId} clash={clash} /> : null}
      {note ? (
        <p className="text-xs text-ink/65" data-date-note="">
          {note}
        </p>
      ) : null}
    </section>
  );
}

/**
 * 🕒 CEREMONY TIME — one line under the date (owner 2026-10-04, "YES TO ALL";
 * frame 3 of `maker_venues_pin_and_time_2026-10-04_fable.html`). It IS the
 * Schedule's Ceremony start — the time the invitation prints ("Ceremony at
 * 3:00 PM"). The phone's own time picker; Save drafts it (`ceremony_time`) and
 * the invitation beside it redraws with the drafted time; at Apply the Ceremony
 * block is made on the day if there is none, else its time moves. Ceremony
 * only — the reception's time stays in the Schedule (owner, answer 3).
 */
function CeremonyTimeEditor({ eventId, initial, hasDay }: { eventId: string; initial: string | null; hasDay: boolean }) {
  const [time, setTime] = useState(initial ?? '');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    setError(null);
    // A time half picked is not sent; a whole one is.
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return;
    start(async () => {
      try {
        const refused = await draftFacts(eventId, { ceremony_time: time });
        if (refused) setError(refused);
      } catch {
        setError('That did not save. Nothing changed — please try again.');
      }
    });
  };
  return (
    <section data-details-ceremony-time="" className="flex flex-col gap-2">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink/70">Ceremony time</span>
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          aria-label="Ceremony time"
          className="min-h-11 rounded-md border border-ink/15 bg-white px-3 text-[16px] text-ink"
        />
      </label>
      <AutoDraft watch={time} pending={pending} error={error} onSave={save} />
    </section>
  );
}

/**
 * THE DATE'S MIDDLE: the print it feeds — or, while "Help me choose" is open,
 * the candidate days, ranked, to tap (DECISION_LOG "A TOOL MOVED INTO THE MAKER
 * IS REBUILT INTO THE THREE PARTS").
 */
export function DateBody({ matrix, picture, helpFirst = false }: { matrix: Promise<ScheduleMatrix | null>; picture: ReactNode; helpFirst?: boolean }) {
  const [{ mode }] = useDateState(helpFirst);
  if (mode !== 'help') return <>{picture}</>;
  return (
    <Suspense fallback={<p className="text-sm text-ink/60">Checking your suppliers’ calendars…</p>}>
      <FindDateCandidates matrix={matrix} />
    </Suspense>
  );
}

// ── VENUES ────────────────────────────────────────────────────────────────────

export type VenueSlot = {
  /** "Ceremony" · "Reception" (`VENUE_ROLE_LABEL`), or "Venue" for one place. */
  label: string;
  /** Which venue card this is (`config_json.venue[slot]` on the Venue scene). */
  slot: VenueSlotKey;
  /** The booked supplier AS OFFERED — shown under "Use the supplier's details";
   *  `photos` are their public shop photos (refs), in their order; `pin` is
   *  where their record puts them. */
  booked: { name: string; address: string | null; photos: readonly string[]; pin: LatLng | null } | null;
  /** The `events` columns this card's own details draft into (`HUB_DRAFT_VENUE_COLUMNS`). */
  columns: {
    name: 'std_film_ceremony_name' | 'std_film_venue_name';
    address: 'ceremony_venue_address' | 'venue_address';
    lat: 'ceremony_venue_latitude' | 'venue_latitude';
    lng: 'ceremony_venue_longitude' | 'venue_longitude';
  };
  /** Its typed name, street address and pin — as drafted, else as stored. */
  typed: string;
  address: string;
  pin: LatLng | null;
  /** The couple's choice for this card — as drafted, else as stored (validated). */
  choice: VenueChoice;
  /** ref → signed URL, for every photo this card can show. */
  photoUrls: Record<string, string>;
};

const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const PHOTO_NONE = 'none';
const PHOTO_UPLOAD = 'upload';

/**
 * 🏛 A venue card's choice → the Event Hub DRAFT (`widgets.venue_map.venue`),
 * through the one draft door. Apply writes it into the Venue scene's own
 * `config_json.venue` (owner 2026-10-04: venues wait for Apply like everything
 * else in the Maker). Resolves null when saved, else the reason in words.
 */
async function draftVenueChoice(eventId: string, slot: VenueSlotKey, choice: VenueChoice): Promise<string | null> {
  const fd = new FormData();
  fd.set('intent', 'save');
  fd.set('patch', JSON.stringify({ widgets: { venue_map: { venue: { [slot]: choice } } } }));
  const r = await makerSave(() => hubDraftAction(eventId, fd), requestMakerRefresh);
  return r.ok ? null : r.error || 'That did not save. Nothing changed — please try again.';
}

/**
 * 📍 DETAILS › VENUES (owner 2026-10-01, "A REAL PIN AND A PICKED CITY";
 * design approved 2026-10-04). A BOOKED venue shows the supplier's details and
 * pin and follows the booking; "Enter your own" is the name, the shipped
 * `AddressPinField` (exact address · Find · the crosshair map · the Pinned-at
 * line — its hint lines hidden here) and the photo. City or area is ONE
 * dropdown from onboarding's list (`CityPick`) — never typed, one per event,
 * the reception's; dropping the reception pin pre-fills it with the nearest
 * place by km. Save puts everything in the DRAFT; guests see it at Apply
 * (which also moves the event's own location anchor to the reception pin).
 */
export function VenuesEditor({
  eventId,
  slots,
  city,
}: {
  eventId: string;
  slots: readonly VenueSlot[];
  /** The reception's city or area (the Save-the-Date's line) — null where the film does not apply. */
  city: string | null;
}) {
  const [values, setValues] = useState<Record<string, { name: string; address: string; pin: LatLng | null }>>(() =>
    Object.fromEntries(slots.map((s) => [s.slot, { name: s.typed, address: s.address, pin: s.pin }])),
  );
  /* 🏛 Each card's choice, held here so a pick shows at once and drafts behind
     it. Switching source never touches the typed words: they stay in `values`. */
  const [choices, setChoices] = useState<Record<string, VenueChoice>>(() =>
    Object.fromEntries(slots.map((s) => [s.slot, s.choice])),
  );
  const [cityValue, setCityValue] = useState(city ?? '');
  /* A city is sent only once PICKED here — a stored line from before the list
     (typed by hand) is never re-sent, so it can never be refused on a save
     that did not touch it. */
  const [cityPicked, setCityPicked] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const ownDetails = (s: VenueSlot) => !s.booked || choices[s.slot]?.source === 'own';
  const typedSlots = slots.filter(ownDetails);
  const reception = slots.find((s) => s.slot === 'reception') ?? null;
  const receptionPin = reception ? (ownDetails(reception) ? values.reception?.pin : reception.booked?.pin) ?? null : null;

  const edit = (slot: VenueSlotKey, next: Partial<{ name: string; address: string; pin: LatLng | null }>) => {
    setValues((v) => ({ ...v, [slot]: { ...v[slot]!, ...next } }));
    /* 📍 The reception pin pre-fills the city with the nearest place on the
       list, by km (owner 2026-10-04, "YES TO ALL" (1)) — until one is picked. */
    if (slot === 'reception' && next.pin && city !== null && !cityPicked) {
      const near = nearestCity(next.pin);
      if (near) setCityValue(near.n);
    }
  };

  const save = () => {
    setError(null);
    const events: Record<string, unknown> = {};
    for (const s of typedSlots) {
      const v = values[s.slot]!;
      events[s.columns.name] = v.name.trim() || null;
      events[s.columns.address] = v.address.trim() || null;
      events[s.columns.lat] = v.pin?.lat ?? null;
      events[s.columns.lng] = v.pin?.lng ?? null;
    }
    if (city !== null && cityValue && (cityPicked || cityValue !== city)) events.std_film_venue_city = cityValue;
    start(async () => {
      try {
        const refused = await draftFacts(eventId, events);
        if (refused) setError(refused);
      } catch {
        setError('That did not save. Nothing changed — please try again.');
      }
    });
  };

  /** One card's choice: shown now, drafted behind it. */
  const choose = (slot: VenueSlotKey, next: VenueChoice) => {
    const was = choices[slot] ?? {};
    setChoices((c) => ({ ...c, [slot]: next }));
    setError(null);
    void draftVenueChoice(eventId, slot, next)
      .then((refused) => {
        if (!refused) return;
        setChoices((c) => ({ ...c, [slot]: was }));
        setError(refused);
      })
      .catch(() => {
        setChoices((c) => ({ ...c, [slot]: was }));
        setError('That did not save. Nothing changed — please try again.');
      });
  };

  return (
    <section data-details-venues="" className="flex flex-col gap-4">
      {slots.map((s) => {
        const own = ownDetails(s);
        const v = values[s.slot]!;
        return (
          <div key={s.slot} className="flex flex-col gap-1.5" data-venue-slot={s.slot}>
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink/55">{s.label}</p>
              {s.booked ? (
                <PickMenu
                  label={`${s.label} — where its details come from`}
                  value={own ? 'own' : 'supplier'}
                  options={[
                    { key: 'supplier', label: 'Use the supplier’s details' },
                    { key: 'own', label: 'Enter your own' },
                  ]}
                  onPick={(k) => choose(s.slot, { ...(choices[s.slot] ?? {}), source: k === 'own' ? 'own' : 'supplier' })}
                  dataAttr="data-venue-source"
                />
              ) : null}
            </div>
            {!own && s.booked ? (
              <div className="flex items-start gap-3 rounded-md bg-ink/[0.03] px-3 py-2" data-venue-booked="">
                <span aria-hidden className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white text-terracotta-700">
                  <MapPin className="h-4 w-4" strokeWidth={1.9} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{s.booked.name}</p>
                  {s.booked.address ? <p className="text-xs text-ink/65">{s.booked.address}</p> : null}
                  <p className="mt-1 text-[11.5px] text-ink/55">
                    Booked · follows the booking{s.booked.pin ? ' · pinned on the map' : ''}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <input
                  value={v.name}
                  onChange={(e) => edit(s.slot, { name: e.target.value })}
                  maxLength={160}
                  placeholder="Name of the place"
                  aria-label={`${s.label} — name of the place`}
                  className="min-h-11 rounded-md border border-ink/15 bg-white px-3 text-[16px] text-ink"
                />
                <AddressPinField
                  id={`venue-address-${s.slot}`}
                  initialAddress={v.address}
                  initialPin={v.pin}
                  hideHints
                  onChange={(next) => edit(s.slot, next)}
                />
              </>
            )}
            <VenuePhotoPicker eventId={eventId} slot={s} own={own} choice={choices[s.slot] ?? {}} onChoose={(c) => choose(s.slot, c)} />
          </div>
        );
      })}
      {city !== null ? (
        <CityPick
          value={cityValue}
          near={receptionPin}
          onPick={(name) => {
            setCityValue(name);
            setCityPicked(true);
          }}
        />
      ) : null}
      {typedSlots.length > 0 || city !== null ? (
        <AutoDraft watch={JSON.stringify([values, cityValue])} pending={pending} error={error} onSave={save} />
      ) : error ? (
        <p role="alert" className="text-xs text-danger-800">
          {error}
        </p>
      ) : null}
    </section>
  );
}

/**
 * 🏛📷 THE VENUE CARD'S PHOTO — ONE chooser (owner 2026-09-30): the booked
 * supplier's public photos (their first by default), the couple's own upload
 * (always offered last; the only way when the supplier has none, or when the
 * card is on their own details), or no photo. Uploads go through the shipped
 * `<FileUpload>`, compressed in the browser, into the Maker's scene-media
 * folder (`sceneBackgroundPathPrefix` — the folder `lib/event-venues.ts`
 * `isOwnVenuePhotoRef` accepts).
 */
function VenuePhotoPicker({
  eventId,
  slot,
  own,
  choice,
  onChoose,
}: {
  eventId: string;
  slot: VenueSlot;
  own: boolean;
  choice: VenueChoice;
  onChoose: (next: VenueChoice) => void;
}) {
  const [local, setLocal] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const url = (ref: string | null | undefined) => (ref ? (local[ref] ?? slot.photoUrls[ref] ?? null) : null);
  const supplierPhotos = own ? [] : (slot.booked?.photos ?? []);
  const ownRef = choice.ownPhoto ?? (!own && choice.supplierPhoto && !supplierPhotos.includes(choice.supplierPhoto) ? choice.supplierPhoto : null);
  const current = own
    ? (choice.ownPhoto ?? null)
    : choice.supplierPhoto === null
      ? null
      : (choice.supplierPhoto ?? supplierPhotos[0] ?? null);
  const options: PickOption[] = [
    ...supplierPhotos.map((ref, i) => ({
      key: ref,
      label: supplierPhotos.length > 1 ? `Supplier’s photo ${i + 1}` : 'Supplier’s photo',
      thumb: url(ref) ?? undefined,
    })),
    ...(ownRef ? [{ key: ownRef, label: 'Your photo', thumb: url(ownRef) ?? undefined }] : []),
    { key: PHOTO_UPLOAD, label: ownRef ? 'Upload a different photo' : 'Upload a photo' },
    { key: PHOTO_NONE, label: 'No photo' },
  ];
  const pick = (ref: string | null) =>
    onChoose(own ? { ...choice, ownPhoto: ref } : { ...choice, supplierPhoto: ref });
  const shown = url(current);
  const noneYet = supplierPhotos.length === 0 && !ownRef;

  return (
    <div className="mt-1 flex flex-col gap-2" data-venue-photo-picker={slot.slot}>
      {shown ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={shown} alt="" className="aspect-[16/9] w-full max-w-md rounded-md border border-ink/10 object-cover" />
      ) : null}
      {noneYet ? null : (
        <PickMenu
          label={`${slot.label} — photo`}
          value={uploading ? PHOTO_UPLOAD : (current ?? PHOTO_NONE)}
          options={options}
          onPick={(k) => {
            if (k === PHOTO_UPLOAD) setUploading(true);
            else {
              setUploading(false);
              pick(k === PHOTO_NONE ? null : k);
            }
          }}
          dataAttr="data-venue-photo"
        />
      )}
      {uploading || noneYet ? (
        <FileUpload
          bucket="media"
          pathPrefix={sceneBackgroundPathPrefix(eventId)}
          multiple={false}
          maxSizeMB={25}
          acceptedTypes={IMAGE_TYPES}
          compressImage
          onFilePicked={(file) => {
            try {
              setLocal((l) => ({ ...l, __picked: URL.createObjectURL(file) }));
            } catch {
              /* a preview is a nicety */
            }
          }}
          onChange={(value) => {
            const ref = typeof value === 'string' ? value : null;
            if (!ref) return;
            setLocal((l) => (l.__picked ? { ...l, [ref]: l.__picked } : l));
            setUploading(false);
            onChoose(own ? { ...choice, ownPhoto: ref } : { ...choice, ownPhoto: ref, supplierPhoto: ref });
          }}
          label="Upload a photo of the place"
        />
      ) : null}
    </div>
  );
}

// ── SHARED ────────────────────────────────────────────────────────────────────

/**
 * ✍ AUTO-DRAFT — the step's field saves itself (no Save button): a change to
 * `watch` (what the field would send) is sent `AUTO_DRAFT_MS` after the last
 * one, through the editor's own draft door. Opening sends nothing — only a
 * value that differs from what was last sent (or drawn). Only a refusal is
 * said, where the field is.
 */
function AutoDraft({ watch, pending, error, onSave }: { watch: string; pending: boolean; error: string | null; onSave: () => void }) {
  const sent = useRef(watch);
  const save = useRef(onSave);
  save.current = onSave;
  useEffect(() => {
    if (watch === sent.current) return;
    const t = window.setTimeout(() => {
      sent.current = watch;
      save.current();
    }, AUTO_DRAFT_MS);
    return () => window.clearTimeout(t);
  }, [watch]);
  return (
    <div data-auto-draft="" aria-busy={pending || undefined} className="contents">
      {error ? (
        <p role="alert" className="text-xs text-danger-800">
          {error}
        </p>
      ) : null}
    </div>
  );
}
