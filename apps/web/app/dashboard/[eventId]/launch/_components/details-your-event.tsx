'use client';

import { Suspense, useState, useTransition, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { sanitizeName } from '@/lib/match-criteria';
import { makerSave, requestMakerRefresh } from '@/lib/maker-refresh';
import type { ScheduleMatrix } from '@/lib/schedule-matrix';
import { updateEventDate, updateEventMatchCriteria } from '../../actions';
import { saveAllStdContent } from '../../studio/save-the-date/actions';
import { GovernedFields } from '../../details/_components/governed-fields';
import { FindDateCandidates, FindDatePicked, useDateState } from './details-date-finder';
import { HubSavesImmediately } from '../../website/_components/hub-draft-field';
import { PickMenu, type PickOption } from '../../website/editor/_components/pick-menu';
import { FileUpload } from '@/app/_components/file-upload';
import type { VenueChoice, VenueSlotKey } from '@/lib/event-venues';
import { sceneBackgroundPathPrefix } from '@/lib/scene-media-choices';

/**
 * DETAILS › YOUR EVENT — the editors (Details part 2a; owner 2026-09-28,
 * DECISION_LOG "DETAILS IS THE ONE FILL-IN AREA…" + "OPTION B…").
 *
 * 🔑 +0 WRITERS. Every field here saves through the writer its existing screen
 * already uses — the same columns, the same checks (owner: "NO 'GO EDIT IT OVER
 * THERE' LINKS — EDIT IT WHERE YOU ARE"; one source, two doors):
 *
 *   · Names  → `updateEventMatchCriteria` (the Personalization page's "The
 *     basics"): `bride_name` / `groom_name` and the display name.
 *     ⚠ That writer ALWAYS writes region and feel (an absent key clears them),
 *     so this form posts their CURRENT values back, unchanged. Where the BaZi
 *     birth-data section is live it also purges birth data when its consent
 *     box is not posted — so there the page mounts the shipped form whole
 *     instead of this one (`maker-details.tsx`), never a names-only post.
 *   · Date   → `GovernedFields` (only its date row): the booked-supplier
 *     conflict preview, then `updateEventDate`. "Help me choose" is the shipped
 *     Find your date, opened in place; "Use <day>" hands the day to that row.
 *     A month is saved through the same `updateEventDate`.
 *   · Venues → `saveAllStdContent` — the typed venue names the Event Hub, the
 *     prints and the Save-the-Date already read (`std_film_ceremony_name`,
 *     `std_film_venue_name`, `std_film_venue_city`; `lib/event-venues.ts`). A
 *     BOOKED venue comes from its booking and is shown, not retyped — unless
 *     the couple picks "Enter your own" (owner 2026-09-30); that choice and
 *     each card's photo save through the same action (`venueChoice`).
 *
 * Each writes live and says so (`HubSavesImmediately`) — none of these columns
 * has a draft door; they are the event's facts, not the page's look.
 */

// ── NAMES ─────────────────────────────────────────────────────────────────────

type PersonName = { first: string; last: string };

export function NamesEditor({
  eventId,
  people,
  initial,
  keep,
}: {
  eventId: string;
  /** The two people's words from the event type (`peopleLabels`). */
  people: readonly [string, string];
  initial: readonly [PersonName, PersonName];
  /** Posted back unchanged — the writer clears them when absent. */
  keep: { region: string; feel: string };
}) {
  const [a, setA] = useState<PersonName>(initial[0]);
  const [b, setB] = useState<PersonName>(initial[1]);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    setError(null);
    setSaved(false);
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('bride_first', a.first.trim());
    fd.set('bride_last', a.last.trim());
    fd.set('groom_first', b.first.trim());
    fd.set('groom_last', b.last.trim());
    fd.set('region', keep.region);
    fd.set('mood_feel_key', keep.feel);
    start(async () => {
      try {
        const r = await makerSave(() => updateEventMatchCriteria(fd), requestMakerRefresh);
        if (r.ok) setSaved(true);
        else setError(r.message);
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
            setSaved(false);
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
            setSaved(false);
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
      <SaveRow pending={pending} saved={saved} error={error} onSave={save} />
      <HubSavesImmediately />
    </section>
  );
}

/**
 * ONE NAME — a single-person event's (a birthday, a debut, a wake): the
 * event's own `display_name`, which the hero, every print and every pass read
 * (owner 2026-09-29, "yes to all 4", item 3). Saved through the same writer as
 * the two names, `updateEventMatchCriteria`, which — when it is posted
 * `celebrant_name` alone — writes `display_name` and nothing else.
 */
export function OneNameEditor({ eventId, initial, hint }: { eventId: string; initial: string; hint: string }) {
  const [name, setName] = useState(initial);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    setError(null);
    setSaved(false);
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('celebrant_name', name.trim());
    start(async () => {
      try {
        const r = await makerSave(() => updateEventMatchCriteria(fd), requestMakerRefresh);
        if (r.ok) setSaved(true);
        else setError(r.message);
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
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
          maxLength={80}
          autoCapitalize="words"
          aria-label="Name, as guests read it"
          className="min-h-11 rounded-md border border-ink/15 bg-white px-3 text-[16px] text-ink"
        />
        <span className="text-xs text-ink/60">{hint}</span>
      </label>
      <SaveRow pending={pending} saved={saved} error={error} onSave={save} />
      <HubSavesImmediately />
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
}: {
  eventId: string;
  governed: GovernedDate;
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
  const [pending, start] = useTransition();

  const pickDay = (dateKey: string) => {
    setMode('have');
    setProposal((p) => ({ field: 'date', value: dateKey, n: (p?.n ?? 0) + 1 }));
  };
  const month = (m: string) => {
    if (!/^\d{4}-\d{2}$/.test(m)) return;
    setMonthError(null);
    const fd = new FormData();
    fd.set('event_id', eventId);
    fd.set('event_date', `${m}-01`);
    fd.set('precision', 'month');
    start(async () => {
      try {
        // `updateEventDate` throws its refusals (a booked supplier, a past month).
        await makerSave(async () => {
          await updateEventDate(fd);
          return { ok: true as const };
        }, requestMakerRefresh);
      } catch (e) {
        setMonthError(e instanceof Error ? e.message : 'That month did not save. Please try again.');
      }
    });
  };

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
        />
      ) : (
        <Suspense fallback={<p className="text-sm text-ink/60">Checking your suppliers’ calendars…</p>}>
          <FindDatePicked matrix={matrix} onUse={pickDay} onMonth={month} monthError={monthError} pending={pending} />
          {nudge}
        </Suspense>
      )}
      <HubSavesImmediately />
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
  /** Which typed column this slot saves to (`saveAllStdContent`'s key). */
  field: 'filmCeremonyName' | 'filmVenueName';
  /** "Ceremony" · "Reception" (`VENUE_ROLE_LABEL`), or "Venue" for one place. */
  label: string;
  /** Which venue card this is (`config_json.venue[slot]` on the Venue scene). */
  slot: VenueSlotKey;
  /** The booked supplier AS OFFERED — shown under "Use the supplier's details";
   *  `photos` are their public shop photos (refs), in their order. */
  booked: { name: string; address: string | null; photos: readonly string[] } | null;
  typed: string;
  /** Where its street address saves (`saveAllStdContent`): the reception's is
   *  `venue_address`, the ceremony's `ceremony_venue_address`. */
  addressField: 'venueAddress' | 'ceremonyAddress';
  /** Its typed street address as stored. */
  address: string;
  /** The couple's choice for this card, as stored (validated). */
  choice: VenueChoice;
  /** ref → signed URL, for every photo this card can show. */
  photoUrls: Record<string, string>;
};

const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const PHOTO_NONE = 'none';
const PHOTO_UPLOAD = 'upload';

export function VenuesEditor({
  eventId,
  slots,
  city,
  launchDate,
}: {
  eventId: string;
  slots: readonly VenueSlot[];
  /** The reception's city or area (the Save-the-Date's line) — null where the film does not apply. */
  city: string | null;
  /** Posted back unchanged — `saveAllStdContent` always writes the launch date. */
  launchDate: string | null;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(slots.flatMap((s) => [[s.field, s.typed], [s.addressField, s.address]])),
  );
  /* 🏛 Each card's choice, held here so a pick shows at once and saves behind it
     (owner: instant — no reload). Switching source never touches the typed
     words: they stay in `values` and in their columns. */
  const [choices, setChoices] = useState<Record<string, VenueChoice>>(() =>
    Object.fromEntries(slots.map((s) => [s.slot, s.choice])),
  );
  const [cityValue, setCityValue] = useState(city ?? '');
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ownDetails = (s: VenueSlot) => !s.booked || choices[s.slot]?.source === 'own';
  const typedSlots = slots.filter(ownDetails);

  const save = () => {
    setError(null);
    setSaved(false);
    const data: Parameters<typeof saveAllStdContent>[1] = { launchDate };
    for (const s of typedSlots) {
      data[s.field] = values[s.field]?.trim() || null;
      data[s.addressField] = values[s.addressField]?.trim() || null;
    }
    if (city !== null) data.filmVenueCity = cityValue.trim() || null;
    start(async () => {
      try {
        const r = await makerSave(() => saveAllStdContent(eventId, data), requestMakerRefresh);
        if (r.ok) setSaved(true);
        else
          setError(
            r.error === 'address-too-long'
              ? 'That address is longer than 300 characters — please shorten it.'
              : 'That did not save. Nothing changed — please try again.',
          );
      } catch {
        setError('That did not save. Nothing changed — please try again.');
      }
    });
  };

  /** One card's choice: shown now, saved behind it. */
  const choose = (slot: VenueSlotKey, next: VenueChoice) => {
    const was = choices[slot] ?? {};
    setChoices((c) => ({ ...c, [slot]: next }));
    setError(null);
    void makerSave(() => saveAllStdContent(eventId, { launchDate, venueChoice: { slot, choice: next } }), requestMakerRefresh)
      .then((r) => {
        if (r.ok) return;
        setChoices((c) => ({ ...c, [slot]: was }));
        setError(
          r.error === 'no-venue-scene'
            ? 'Add the Venue scene to your Event Hub first, then pick its photo.'
            : 'That did not save. Nothing changed — please try again.',
        );
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
        return (
          <div key={s.field} className="flex flex-col gap-1.5" data-venue-slot={s.field}>
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
            {!own && s.booked ? (
              <div className="rounded-md bg-ink/[0.03] px-3 py-2">
                <p className="text-sm font-medium text-ink">{s.booked.name}</p>
                {s.booked.address ? <p className="text-xs text-ink/65">{s.booked.address}</p> : null}
                <p className="mt-1 text-[11.5px] text-ink/55">From your booked supplier — it follows the booking.</p>
              </div>
            ) : (
              <>
                <input
                  value={values[s.field] ?? ''}
                  onChange={(e) => {
                    setValues((v) => ({ ...v, [s.field]: e.target.value }));
                    setSaved(false);
                  }}
                  maxLength={160}
                  placeholder="Name of the place"
                  aria-label={`${s.label} — name of the place`}
                  className="min-h-11 rounded-md border border-ink/15 bg-white px-3 text-[16px] text-ink"
                />
                <input
                  value={values[s.addressField] ?? ''}
                  onChange={(e) => {
                    setValues((v) => ({ ...v, [s.addressField]: e.target.value }));
                    setSaved(false);
                  }}
                  maxLength={300}
                  autoComplete="street-address"
                  placeholder="Street address — e.g. 1 Tandang Sora Ave, Quezon City"
                  aria-label={`${s.label} — street address`}
                  data-venue-address={s.addressField}
                  className="min-h-11 rounded-md border border-ink/15 bg-white px-3 text-[16px] text-ink"
                />
              </>
            )}
            <VenuePhotoPicker eventId={eventId} slot={s} own={own} choice={choices[s.slot] ?? {}} onChoose={(c) => choose(s.slot, c)} />
          </div>
        );
      })}
      {city !== null ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink/70">City or area</span>
          <input
            value={cityValue}
            onChange={(e) => {
              setCityValue(e.target.value);
              setSaved(false);
            }}
            maxLength={80}
            placeholder="e.g. Quezon City"
            className="min-h-11 rounded-md border border-ink/15 bg-white px-3 text-[16px] text-ink"
          />
        </label>
      ) : null}
      {typedSlots.length > 0 || city !== null ? (
        <>
          <SaveRow pending={pending} saved={saved} error={error} onSave={save} />
          <HubSavesImmediately />
        </>
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
      {noneYet ? (
        <p className="text-[12.5px] text-ink/65">
          {own || !slot.booked ? 'Add a photo of the place — it shows on the venue card.' : 'This supplier has no photos on their shop yet. Upload one of the place.'}
        </p>
      ) : (
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

function SaveRow({ pending, saved, error, onSave }: { pending: boolean; saved: boolean; error: string | null; onSave: () => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onSave} disabled={pending} className="button-primary text-sm disabled:opacity-50">
          {pending ? 'Saving…' : 'Save'}
        </button>
        {saved ? (
          <span role="status" className="inline-flex items-center gap-1 text-xs font-medium text-success-700">
            <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Saved
          </span>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-xs text-danger-800">
          {error}
        </p>
      ) : null}
    </div>
  );
}
