'use client';

/**
 * 🏛 A SPACE'S SHEET — new or saved, every kind on ONE row order (drawing screens 4–6, specs
 * prototypes/spaces_final_screens_2026-11-19.html): Name, How many, the kind's own rows, then More.
 *
 *   · It starts from the shipped HallSheet (`customers/_components/dates-sheets.tsx`: Name · Seated · Standing · "Add the
 *     hall") and keeps its words; Floor size, Connects to and Base layout are added for halls and rooms.
 *   · "Add many rooms" is this sheet with How many past 1 (no separate screen); the preview line shows the names before
 *     anything is saved.
 *   · The name is GIVEN below Pro (Hall001 · Room001 …) behind the shared 🔒 (`LockedFeature`, problem → solution);
 *     Every paid plan types its own, rename, and number rooms by floor or letters. The server refuses the same.
 *   · "Add another like this" keeps every row and gives the next name.
 *
 * Every control is shipped: Sheet · FormRows · TypedRow · ChosenRow · SwitchRow · Counter · Fold · ActionButton.
 */
import { useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { ActionButton } from '@/components/action-button';
import { Fold } from '@/app/_components/fold';
import { Counter } from '@/app/_components/counter';
import { ChosenRow, FormRows, SwitchRow, TypedRow } from '@/app/_components/form-row';
import { LockedFeature, type LockNeed } from '@/app/_components/lock/locked-feature';
import {
  CLOTHING_SIZES,
  KIND_LINE,
  KIND_MENU,
  KIND_WORD,
  MAX_RUN,
  bookedWhole,
  clothingCount,
  floorWords,
  namesForRun,
  previewWords,
  sizeWords,
  type KindChoice,
  type NameRun,
  type RoomNaming,
  type Space,
  type SpaceKind,
  type TileState,
} from '@/lib/spaces';
import type { SpaceTables } from '@/lib/space-tables';
import { BaseLayout, type Run } from './base-layout-fold';

export type SheetMode =
  | { mode: 'new'; choice: KindChoice; typed: string }
  | { mode: 'edit'; space: Space; state: TileState | null };

/** Every paid plan, from Plus (owner 22 Nov, "SAME FEATURES IN EVERY SIZE") — the plan lock both Spaces locks open with (the price is the Plan page's, never typed here). */
/**
 * The Spaces locks' need: every paid plan, from Plus. A7-14 — the price is the catalogue's Plus monthly price, worded by
 * the page from `getVendorPrices` + `monthlyPlanPrice` (never typed); `null` (an unread catalogue) shows no figure.
 */
export function paidNeed(planPrice: string | null): LockNeed {
  return { kind: 'plan', plan: 'solo', price: planPrice, href: '/vendor-dashboard/subscription' };
}

const CLOTHING_TYPES = ['Gown', 'Barong', 'Suit', 'Dress', 'Filipiniana', 'Accessory'] as const;
const NAMINGS_ROOM: ReadonlyArray<{ key: RoomNaming; label: string; hint: string }> = [
  { key: 'generic', label: 'Generic', hint: 'Room001, Room002 …' },
  { key: 'by_floor', label: 'By floor', hint: '201 … 212, 301 … 312' },
  { key: 'letters', label: 'Letters', hint: '2A, 2B …' },
  { key: 'own', label: 'Your own', hint: 'Type a name' },
];
const digits = (t: string) => t.replace(/[^\d]/g, '').slice(0, 6);
const metres = (t: string) => t.replace(/[^\d.]/g, '').slice(0, 6);

export function SpaceSheet({
  open,
  onClose,
  at,
  spaces,
  tables,
  proOpen,
  dayLabel,
  firstHall,
  refusal = null,
  planPrice = null,
  run,
}: {
  open: boolean;
  onClose: () => void;
  at: SheetMode;
  spaces: readonly Space[];
  tables: SpaceTables;
  /** Every paid plan, or the paywall switch off: own names, renaming, numbering by floor, the drawn floor plan. */
  proOpen: boolean;
  /** The day the tiles follow, in words ("Sat 14 Feb") — for "Booked on …". */
  dayLabel: string;
  /** The shop's shipped Room size & capacity — the FIRST hall opens filled from it. */
  firstHall: { widthM: number | null; lengthM: number | null; seated: number | null } | null;
  /** A7-30: why the last save in this sheet was refused, drawn IN the sheet — the page's notice sits behind it. */
  refusal?: string | null;
  /** The Plus plan's catalogue price, worded ("₱… / month"); null = unread. */
  planPrice?: string | null;
  run: Run;
}) {
  const headingId = useId();
  const editing = at.mode === 'edit' ? at.space : null;
  const startChoice: KindChoice = at.mode === 'new' ? at.choice : editing!.kind === 'room' ? 'hall' : (editing!.kind as KindChoice);
  const prefill = at.mode === 'new' && at.choice === 'hall' && !spaces.some((s) => s.kind === 'hall') ? firstHall : null;

  const [choice, setChoice] = useState<KindChoice>(startChoice);
  const [hallOrRoom, setHallOrRoom] = useState<'hall' | 'room'>(editing?.kind === 'room' ? 'room' : 'hall');
  const kind: SpaceKind = choice === 'hall' ? hallOrRoom : choice;
  const typed = at.mode === 'new' ? at.typed.trim() : '';

  const [name, setName] = useState(editing?.name ?? '');
  const [naming, setNaming] = useState<RoomNaming>(typed && proOpen ? 'own' : 'generic');
  const [own, setOwn] = useState(typed);
  const [startAt, setStartAt] = useState('');
  const [floorLevel, setFloorLevel] = useState(2);
  const [howMany, setHowMany] = useState(1);
  const [seated, setSeated] = useState(editing?.seated ? String(editing.seated) : prefill?.seated ? String(prefill.seated) : '');
  const [standing, setStanding] = useState(editing?.standing ? String(editing.standing) : '');
  const [width, setWidth] = useState(editing?.widthM != null ? String(editing.widthM) : prefill?.widthM != null ? String(prefill.widthM) : '');
  const [length, setLength] = useState(editing?.lengthM != null ? String(editing.lengthM) : prefill?.lengthM != null ? String(prefill.lengthM) : '');
  const [connectsTo, setConnectsTo] = useState<string>(editing?.connectsTo ?? '');
  const d = editing?.details ?? {};
  const [type, setType] = useState(d.type ?? (typed && !proOpen ? typed : ''));
  const [beds, setBeds] = useState(d.beds ?? 2);
  const [colour, setColour] = useState(d.colour ?? '');
  const [sizes, setSizes] = useState<Record<string, number>>(d.sizes ?? { S: 1, M: 1, L: 1 });
  const [cleaningDays, setCleaningDays] = useState(d.cleaningDays ?? 3);
  const [fitting, setFitting] = useState(Boolean(d.fitting));
  const [seats, setSeats] = useState(d.seats ?? 4);
  const [driver, setDriver] = useState(d.driver ?? true);
  const [needsPower, setNeedsPower] = useState(Boolean(d.needsPower));
  const [withPerson, setWithPerson] = useState(Boolean(d.withPerson));
  const [daysBefore, setDaysBefore] = useState(d.daysBefore ?? 1);
  const [daysAfter, setDaysAfter] = useState(d.daysAfter ?? 1);
  const [owned, setOwned] = useState(editing?.count != null ? String(editing.count) : '');
  const [inRepair, setInRepair] = useState(editing?.inRepair ?? 0);
  const [moreOpen, setMoreOpen] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);

  const whole = bookedWhole(kind);
  const run1: NameRun = { naming, startAt: startAt ? Number(startAt) : undefined, own, floorLevel };
  const existing = useMemo(() => spaces.map((s) => s.name), [spaces]);
  const preview = at.mode === 'new' ? namesForRun(kind, existing, whole ? howMany : 1, run1) : null;
  const halls = spaces.filter((s) => (s.kind === 'hall' || s.kind === 'room') && s.id !== editing?.id);
  const word = KIND_WORD[kind];

  const details = {
    type: type || undefined,
    beds,
    colour: colour || undefined,
    sizes,
    cleaningDays,
    fitting,
    seats,
    driver,
    needsPower,
    withPerson,
    daysBefore,
    daysAfter,
  };
  const shared = { kind, seated, standing, width, length, connectsTo: connectsTo || null, owned: Number(owned), inRepair, details };

  const save = async (again: boolean) => {
    const ok = editing
      ? await run({ op: 'updateSpace', input: { ...shared, id: editing.id, name: proOpen ? name : undefined } }, `${editing.name} saved`)
      : await run({ op: 'addSpaces', input: { ...shared, howMany: whole ? howMany : 1, run: run1, floorLevel: kind === 'room' ? floorLevel : null } }, whole && howMany > 1 ? `${howMany} added` : 'Added');
    if (ok && !again) onClose();
    if (ok && again) setOwn('');
  };

  const stateLine =
    at.mode === 'edit' && at.state
      ? at.state.tone === 'booked'
        ? `Booked on ${dayLabel}: ${at.state.who.join(', ')}`
        : at.state.tone === 'closed'
          ? `${at.state.word} on ${dayLabel}`
          : null
      : null;

  const body = (
    <Sheet open={open} onClose={onClose} labelledById={headingId} rise>
      <div className="px-5 pb-6 pt-5" data-space-sheet={editing ? 'edit' : 'new'} data-space-kind={kind}>
        <h2 id={headingId} className="pr-12 text-[17px] font-semibold text-ink">
          {editing ? editing.name : kind === 'room' && howMany > 1 ? 'New rooms' : `New ${word}`}
        </h2>
        <p className="mt-1 text-[13px] text-ink/70">{KIND_LINE[kind]}</p>
        {stateLine ? (
          <p className="mt-2 text-sn-md font-medium text-ink" data-space-holder="">
            {stateLine}
          </p>
        ) : null}

        <FormRows width="wide" data="space-rows">
          {at.mode === 'new' ? (
            <ChosenRow
              name="What is it"
              value={choice}
              options={KIND_MENU.map((k) => ({ key: k.key, label: k.label, hint: k.hint }))}
              onPick={(k) => setChoice(k as KindChoice)}
              dataAttr="data-space-what"
            />
          ) : null}
          {at.mode === 'new' && choice === 'hall' ? (
            <ChosenRow
              name="Hall or room"
              value={hallOrRoom}
              options={[
                { key: 'hall', label: 'Hall', hint: 'Seated · standing · floor size' },
                { key: 'room', label: 'Room', hint: 'Beds · numbered by floor' },
              ]}
              onPick={(k) => setHallOrRoom(k as 'hall' | 'room')}
              dataAttr="data-space-hall-or-room"
            />
          ) : null}
        </FormRows>

        {/* ── Name: given on Free (🔒 problem → solution); typed on every paid plan ── */}
        <div className="mt-1" data-space-name="">
          {!proOpen ? (
            <FormRows width="wide">
              <LockedFeature lock="space_names" need={paidNeed(planPrice)} line={`Given for you: ${editing ? editing.name : preview?.ok ? preview.names[0] : '…'}`} data="space-name-lock" />
            </FormRows>
          ) : editing ? (
            <FormRows width="wide">
              <TypedRow name="Name" value={name} required maxLength={80} note="Rename any time. Bookings keep." onKeep={(t) => setName(t.trim())} />
            </FormRows>
          ) : (
            <FormRows width="wide">
              <ChosenRow
                name="Names"
                value={naming}
                options={(kind === 'room' ? NAMINGS_ROOM : NAMINGS_ROOM.filter((n) => n.key === 'generic' || n.key === 'own')).map((n) => ({ ...n, hint: n.key === 'generic' ? `${KIND_WORD[kind][0]!.toUpperCase()}${KIND_WORD[kind].slice(1)}001 …` : n.hint }))}
                onPick={(k) => setNaming(k as RoomNaming)}
                dataAttr="data-space-naming"
              />
              {naming === 'own' ? <TypedRow name="Name" value={own} maxLength={80} placeholder="Grand Ballroom" onKeep={(t) => setOwn(t)} /> : null}
              {naming === 'by_floor' ? <TypedRow name="Start at" value={startAt} inputMode="numeric" maxLength={4} placeholder={`${floorLevel}01`} clean={digits} onKeep={(t) => setStartAt(digits(t))} /> : null}
            </FormRows>
          )}
        </div>

        <FormRows width="wide" data="space-kind-rows">
          {at.mode === 'new' && whole ? (
            <CountRow name={kind === 'room' ? (floorLevel ? `How many · on ${floorWords(floorLevel)}` : 'How many') : 'How many'} value={howMany} min={1} max={MAX_RUN} set={setHowMany} data="space-how-many" />
          ) : null}
          {at.mode === 'new' && kind === 'room' ? <CountRow name="On floor" value={floorLevel} min={1} max={99} set={setFloorLevel} words={floorWords(floorLevel)} data="space-floor" /> : null}

          {kind === 'hall' || kind === 'room' ? (
            <>
              {kind === 'room' ? <TypedRow name="Type" value={type} maxLength={40} placeholder="Deluxe" onKeep={(t) => setType(t)} /> : null}
              {kind === 'room' ? <CountRow name="Beds" value={beds} min={1} max={20} set={setBeds} data="space-beds" /> : null}
              {kind === 'hall' ? <TypedRow name="Seated" value={seated} inputMode="numeric" maxLength={6} empty="Guests seated" clean={digits} onKeep={(t) => setSeated(digits(t))} /> : null}
              {kind === 'hall' ? <TypedRow name="Standing" value={standing} inputMode="numeric" maxLength={6} empty="Guests standing" clean={digits} onKeep={(t) => setStanding(digits(t))} /> : null}
              <TypedRow name="Floor width (m)" value={width} inputMode="numeric" maxLength={6} empty="Add" clean={metres} onKeep={(t) => setWidth(metres(t))} note={sizeWords(width ? Number(width) : null, length ? Number(length) : null) || 'Width × length. Drawn to scale on the plan.'} />
              <TypedRow name="Floor length (m)" value={length} inputMode="numeric" maxLength={6} empty="Add" clean={metres} onKeep={(t) => setLength(metres(t))} />
              {halls.length > 0 ? (
                <ChosenRow
                  name="Connects to"
                  value={connectsTo}
                  options={[{ key: '', label: 'None', hint: 'Stands on its own' }, ...halls.map((h) => ({ key: h.id, label: h.name, hint: 'Set once, both ways' }))]}
                  onPick={setConnectsTo}
                  dataAttr="data-space-connects"
                />
              ) : null}
            </>
          ) : null}

          {kind === 'cart' ? (
            <>
              <TypedRow name="What it sells" value={type} maxLength={40} placeholder="Fries" onKeep={(t) => setType(t)} />
              <TypedRow name="Space width (m)" value={width} inputMode="numeric" maxLength={6} empty="Add" clean={metres} onKeep={(t) => setWidth(metres(t))} />
              <TypedRow name="Space length (m)" value={length} inputMode="numeric" maxLength={6} empty="Add" clean={metres} onKeep={(t) => setLength(metres(t))} />
              <SwitchRow name="Needs power" on={needsPower} onChange={setNeedsPower} data="space-power" />
            </>
          ) : null}

          {kind === 'clothing' ? (
            <>
              <ChosenRow name="Type" value={type || 'Gown'} options={CLOTHING_TYPES.map((t) => ({ key: t, label: t }))} onPick={setType} dataAttr="data-space-clothing-type" />
              <TypedRow name="Colour" value={colour} maxLength={40} placeholder="Champagne" onKeep={(t) => setColour(t)} />
              {(['S', 'M', 'L', 'XL'] as const).map((sz) => (
                <CountRow key={sz} name={`Size ${sz}`} value={sizes[sz] ?? 0} min={0} max={999} set={(n) => setSizes((s) => ({ ...s, [sz]: n }))} data={`space-size-${sz}`} />
              ))}
              <p className="py-2 text-[13px] text-ink/70" data-space-clothing-count="">
                {clothingCount(Object.fromEntries(Object.entries(sizes).filter(([k]) => (CLOTHING_SIZES as readonly string[]).includes(k))))} in all
              </p>
            </>
          ) : null}

          {kind === 'object' ? (
            <>
              <TypedRow name="What it is" value={type} maxLength={40} placeholder="Chairs" onKeep={(t) => setType(t)} />
              <TypedRow name="How many you own" value={owned} inputMode="numeric" maxLength={6} empty="1 = one of a kind" clean={digits} onKeep={(t) => setOwned(digits(t))} />
              <CountRow name="In repair" value={inRepair} min={0} max={Number(owned) || 0} set={setInRepair} words="Not counted as free" data="space-in-repair" />
            </>
          ) : null}

          {kind === 'vehicle' ? (
            <>
              <TypedRow name="Type" value={type} maxLength={40} placeholder="Bridal car" onKeep={(t) => setType(t)} />
              <CountRow name="Seats" value={seats} min={1} max={60} set={setSeats} data="space-seats" />
              <SwitchRow name="With a driver" on={driver} onChange={setDriver} data="space-driver" />
            </>
          ) : null}

          {kind === 'item' ? <TypedRow name="What it is" value={type} maxLength={40} placeholder="Arch" onKeep={(t) => setType(t)} /> : null}
        </FormRows>

        {kind !== 'hall' && kind !== 'item' ? (
          <div className="mt-2 border-t border-ink/10" data-space-more="">
            <Fold title="More" line={moreLine(kind)} open={moreOpen} onOpenChange={setMoreOpen}>
              <FormRows width="wide">
                {kind === 'clothing' ? (
                  <>
                    <CountRow name="Cleaning after return" value={cleaningDays} min={0} max={60} set={setCleaningDays} words="Days before it goes out again" data="space-cleaning" />
                    <SwitchRow name="Fitting" line="Asked at booking" on={fitting} onChange={setFitting} data="space-fitting" />
                  </>
                ) : null}
                {kind === 'object' ? (
                  <>
                    <TypedRow name="Space width (m)" value={width} inputMode="numeric" maxLength={6} empty="For a booth or an arch" clean={metres} onKeep={(t) => setWidth(metres(t))} />
                    <TypedRow name="Space length (m)" value={length} inputMode="numeric" maxLength={6} empty="Add" clean={metres} onKeep={(t) => setLength(metres(t))} />
                    <SwitchRow name="Needs power" on={needsPower} onChange={setNeedsPower} data="space-power" />
                    <SwitchRow name="Comes with a person" line="Sound, lights, a crew" on={withPerson} onChange={setWithPerson} data="space-person" />
                    <CountRow name="Out before" value={daysBefore} min={0} max={60} set={setDaysBefore} words="Days held before the event" data="space-days-before" />
                    <CountRow name="Back after" value={daysAfter} min={0} max={60} set={setDaysAfter} words="Days held after it" data="space-days-after" />
                  </>
                ) : null}
                {kind === 'vehicle' ? <TypedRow name="Colour" value={colour} maxLength={40} placeholder="White" onKeep={(t) => setColour(t)} /> : null}
                {kind === 'room' ? <p className="py-2 text-[13px] text-ink/70">Couples see the room type, never its number.</p> : null}
                {kind === 'cart' ? <p className="py-2 text-[13px] text-ink/70">A card can use any free one.</p> : null}
              </FormRows>
            </Fold>
          </div>
        ) : null}

        {editing && (kind === 'hall' || kind === 'room') ? (
          <div className="mt-2 border-t border-ink/10" data-space-base-layout="">
            <Fold title="Base layout" line="Doors and usual tables · couples’ plans start on it" open={layoutOpen} onOpenChange={setLayoutOpen}>
              <BaseLayout spaceId={editing.id} tables={tables} run={run} floorPlanOpen={proOpen} />
            </Fold>
          </div>
        ) : null}

        {at.mode === 'new' && preview ? (
          <p className={`mt-3 text-[13px] ${preview.ok ? 'text-ink/70' : 'font-medium text-ink'}`} data-space-preview="" role={preview.ok ? undefined : 'alert'}>
            {preview.ok ? `Preview: ${previewWords(preview.names)}` : preview.error}
          </p>
        ) : null}

        {refusal ? (
          <p className="mt-3 text-sn-md font-medium text-ink" role="alert" data-space-refusal="">
            {refusal}
          </p>
        ) : null}

        <div className="mt-4 flex flex-col gap-2">
          <ActionButton
            tone="brand"
            main
            icon={editing ? Pencil : Plus}
            label={editing ? `Save ${word}` : whole && howMany > 1 ? `Add ${howMany} ${word === 'clothing' ? 'clothing' : `${word}s`}` : `Add the ${word}`}
            className="!h-11 w-full"
            disabled={at.mode === 'new' && !!preview && !preview.ok}
            onClick={() => void save(false)}
            data-testid="space-save"
          />
          {at.mode === 'new' ? (
            <ActionButton tone="neutral" icon={Plus} label="Add another like this" className="!h-11 w-full" disabled={!!preview && !preview.ok} onClick={() => void save(true)} />
          ) : (
            <ActionButton tone="neutral" icon={Trash2} label={`Remove ${editing!.name}`} className="!h-11 w-full" onClick={() => void run({ op: 'removeSpace', id: editing!.id }, `${editing!.name} removed`).then((ok) => ok && onClose())} />
          )}
        </div>
      </div>
    </Sheet>
  );
  return typeof document === 'undefined' ? null : createPortal(body, document.body);
}

function moreLine(kind: SpaceKind): string {
  if (kind === 'clothing') return 'Cleaning · fitting';
  if (kind === 'object') return 'Space · power · out and back';
  if (kind === 'vehicle') return 'Colour';
  return 'Details';
}

/** A labelled stepper row — the shipped Counter beside its name (one row, 44-px presses). */
function CountRow({ name, value, min, max, set, words, data }: { name: string; value: number; min: number; max: number; set: (n: number) => void; words?: string; data: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 border-t border-ink/10 py-1 first:border-t-0" data-form-row="" data-space-count={data}>
      <span className="min-w-0">
        <span className="block text-[15px] font-medium leading-tight text-ink">{name}</span>
        {words ? <span className="block text-sn-sm text-ink/70">{words}</span> : null}
      </span>
      <Counter value={value} label={name} onLess={() => set(Math.max(min, value - 1))} onMore={() => set(Math.min(max, value + 1))} lessDisabled={value <= min} moreDisabled={value >= max} data={data} />
    </div>
  );
}
