'use client';

import { createContext, useContext, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { CalendarPlus, Plus, Search, Send, Trash2, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { ChosenRow, FormRows, SwitchRow, TypedRow } from '@/app/_components/form-row';
import { TimeRow } from '@/app/_components/form-row-time';
import type { PickOption } from '../../website/editor/_components/pick-menu';
import { normalizeSearchText } from '@/lib/guest-search';
import { crewLines, forKey, forOptions, forPickOf, forPicked, forWords } from '@/lib/moment-for';
import { RIGHT_AFTER_LONG, momentAbove } from '@/lib/moment-order';
import { orAt, orMinutesBetween, type TimeShape } from '@/lib/time-shape';
import { CONTACT_NAME_MAX, CONTACT_PHONE_MAX, contactFrom, phoneProblem, type TaskContact } from '@/lib/task-contact';
import {
  DEFAULT_MOMENT_MINUTES,
  MARCH_NAME_MAX,
  NEW_MARCH,
  NOT_A_MARCH,
  marchNameFrom,
  marchPickOptions,
  type MarchChoice,
  type MarchList,
  callAtFrom,
  clashesForMoment,
  minutesBetween,
  isMomentPapic,
  momentDeleteWords,
  momentSection,
  momentStartFrom,
  rowOf,
  sectionStartFor,
  sectionsFor,
  shiftWall,
  taskFields,
  taskPlace,
  clockWords,
  taskWhoWords,
  whoFieldsOf,
  whoKeyOf,
  wallTime,
  type Chapter,
  type ChapterSection,
  type ClashMoment,
  type MomentPapic,
  type TaskNames,
  type TaskRow,
  type WhoFields,
} from '@/lib/schedule-chapters';
import { createScheduleBlock, deleteScheduleBlock, updateScheduleBlock } from '../actions';
import type { ChapterMoment, TaskWhoList } from './chapters-host';
import { AskSupplierSection } from './ask-supplier-section';
import type { HostAsk } from '@/lib/schedule-ask';
import { lockedShopOnMoment } from '@/lib/supplier-part-lock';
import { lockedHead, lockedLine } from '@/lib/supplier-schedule-marks';

/**
 * 📖 THE MOMENT SHEET — a moment and its parallel tasks (owner 2026-11-01, corpus SCHEDULE_CHAPTERS_BUILD_PLAN §3
 * "Moments work the same way" · §3c "Blow by blow, tested against the real run of show"; DECISION_LOG "THE BLOW BY BLOW
 * FROM THE REAL RUN OF SHOW"; approved prototype `prototypes/schedule_chapters_2026-11-01/` — its `momSheet`).
 *
 * A moment is a child block of its chapter (migration 20271300072429), so its fields save through the Schedule's OWN
 * doors — `createScheduleBlock` · `updateScheduleBlock` · `deleteScheduleBlock`. Its TASKS go through the same update
 * door with `moment_op` (no new server action — the budget is at its ceiling), each answered in words and read back.
 *
 *   · + ADD A MOMENT asks What · Time · Minutes · Section, then Add — and the sheet becomes the moment's own.
 *   · THE MOMENT: What · Time · Minutes · Section (picking one moves the moment into it — the section is read from the
 *     time, never stored) · Room (the default place of every task) · Visible to guests · Optional ("if kept") ·
 *     Travel from → to · Notes. Every field saves as it is kept (the Form Row rule): ✕ or a tap outside leaves nothing
 *     unsaved, and a save never resets the sheet.
 *   · TASKS: one row per who — a supplier (and its crew), a role, a group, a person, or anyone in words, from ONE
 *     Who ▾ with sections and search — with what they do, an optional call time and a place (blank = the moment's
 *     room). A new task saves once it has a who and a what.
 *   · ⚠ A CLASH — the same person or crew in two places at once, anywhere on the day — is FLAGGED on the task, never
 *     refused (§3c #5, `clashesForMoment`).
 *   · DELETE MOMENT warns, then Continue, then a deleting state. The warning counts the Papic photos and videos taken
 *     during it (each capture knows its moment, migration 20271302139013) — those are deleted with it, except one also
 *     in another chapter, which stays there; the warning names both counts. Papic items only: never uploads or
 *     supplier shots, never a credit.
 *
 * 🚶 THIS IS A MARCH (owner 2026-11-01: *"When we say this is a march. It picks which march."*; migration 20271301571290):
 * one dropdown — Not a march · the Wedding March · the couple's own marches (made in Guests › March, with the guests
 * who walk) · + New march, which asks its name and makes it with the writer Guests › March uses. Two moments may pick
 * one march; Not a march clears the link and never deletes the march (`MarchRow`, `moment-march-step.ts`).
 *
 * 🔒 app/dashboard/[eventId]/schedule/a-moment-holds-its-tasks.test.ts · a-moment-picks-a-march.test.ts
 */

export type TaskOp = 'task_add' | 'task_save' | 'task_remove' | 'contact_set';
type Answer<T> = { ok: true; value: T } | { ok: false; error: string };

export type MomentDoors = {
  /**
   * ⏭ With `rightAfter`, the moment has no clock of its own — it comes right after `follows` (null = first in the
   * chapter); `startIso` is then only its order key and no end is sent (migration 20271302727358).
   */
  create: (
    blockId: string,
    chapterId: string,
    label: string,
    startIso: string,
    endIso: string,
    rightAfter?: { follows: string | null },
    /** 🕑 How the clock is meant — "About 3:15" · "2:15/2:30" (4 additions (2)); absent = exactly. */
    shape?: MomentShape,
  ) => Promise<boolean>;
  save: (blockId: string, fields: Record<string, string>) => Promise<boolean>;
  remove: (blockId: string) => Promise<boolean>;
  task: (op: TaskOp, blockId: string, fields: Record<string, string>) => Promise<Answer<string>>;
  /** 📷 What deleting this moment does to Papic: the items it deletes, and those staying in another chapter. */
  papicCount: (momentId: string, chapterId: string) => Promise<Answer<MomentPapic>>;
  /** 🚶 The moment is a march (`march_set`, `march_key`), or a new one is made for it (`march_new`, `march_name`). */
  march: (op: 'march_set' | 'march_new', blockId: string, fields: Record<string, string>) => Promise<Answer<string>>;
  /** 👷 Suppliers and crew ▾: tick (`on` '1') or untick one supplier or crew on the moment (`for_key`, lib/moment-for.ts). */
  forSet: (blockId: string, fields: { for_key: string; on: '1' | '0' }) => Promise<Answer<string>>;
  /** 🗓 Ask a booked supplier to change their times on the moment (`vendor_id` · `start_at` · `end_at` · `note`; D2). */
  ask: (blockId: string, fields: Record<string, string>) => Promise<Answer<string>>;
};

function form(eventId: string, fields: Record<string, string>): FormData {
  const fd = new FormData();
  fd.set('event_id', eventId);
  // 🔄 NOT the Maker's quiet write: these sheets live only on the Schedule page (the Maker draws no chapters), so every
  // save revalidates — Home, Planning and Booked › Schedule read the new answer, and the page behind the sheet
  // re-renders IN PLACE (ChaptersHost takes the fresh rows; the open sheet stays open). Held by
  // `every-schedule-save-refreshes-the-pages.test.ts`.
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const NOT_SAVED_WORDS = 'It didn’t save — try again.';

export function realMomentDoors(eventId: string): MomentDoors {
  const ok = (p: Promise<unknown>) => p.then(() => true, () => false);
  return {
    create: (blockId, chapterId, label, startIso, endIso, rightAfter, shape) =>
      ok(
        createScheduleBlock(
          form(eventId, {
            block_id: blockId,
            parent_block_id: chapterId,
            label,
            block_type: 'custom',
            start_at: startIso.slice(0, 16),
            ...(rightAfter
              ? { time_tba: '1', ...(rightAfter.follows ? { follows_block_id: rightAfter.follows } : {}) }
              : { end_at: endIso.slice(0, 16), ...shapeFields(shape) }),
          }),
        ),
      ),
    save: (blockId, fields) => ok(updateScheduleBlock(form(eventId, { block_id: blockId, ...fields }))),
    remove: (blockId) => ok(deleteScheduleBlock(form(eventId, { block_id: blockId }))),
    task: (op, blockId, fields) =>
      updateScheduleBlock(form(eventId, { block_id: blockId, moment_op: op, ...fields })).then(
        (r) => (r && r.ok ? { ok: true as const, value: String(r.value) } : { ok: false as const, error: r && !r.ok ? r.error : NOT_SAVED_WORDS }),
        () => ({ ok: false as const, error: NOT_SAVED_WORDS }),
      ),
    papicCount: (momentId, chapterId) =>
      updateScheduleBlock(form(eventId, { block_id: momentId, chapter_id: chapterId, moment_op: 'papic_count' })).then(
        (r) => (r && r.ok && isMomentPapic(r.value) ? { ok: true as const, value: r.value } : { ok: false as const, error: 'unread' }),
        () => ({ ok: false as const, error: 'unread' }),
      ),
    march: (op, blockId, fields) =>
      updateScheduleBlock(form(eventId, { block_id: blockId, moment_op: op, ...fields })).then(
        (r) => (r && r.ok ? { ok: true as const, value: String(r.value) } : { ok: false as const, error: r && !r.ok ? r.error : NOT_SAVED_WORDS }),
        () => ({ ok: false as const, error: NOT_SAVED_WORDS }),
      ),
    forSet: (blockId, fields) =>
      updateScheduleBlock(form(eventId, { block_id: blockId, moment_op: 'for_set', ...fields })).then(
        (r) => (r && r.ok ? { ok: true as const, value: String(r.value) } : { ok: false as const, error: r && !r.ok ? r.error : NOT_SAVED_WORDS }),
        () => ({ ok: false as const, error: NOT_SAVED_WORDS }),
      ),
    ask: (blockId, fields) =>
      updateScheduleBlock(form(eventId, { block_id: blockId, moment_op: 'ask_supplier', ...fields })).then(
        (r) => (r && r.ok ? { ok: true as const, value: String(r.value) } : { ok: false as const, error: r && !r.ok ? r.error : 'That ask didn’t send — try again.' }),
        () => ({ ok: false as const, error: 'That ask didn’t send — try again.' }),
      ),
  };
}

/** 🧪 `/dev/chapters-lab`: the same sheets, doors that write nothing. A lab moment had 4 Papic shots: 3 go, 1 is in another chapter. */
export const LAB_MOMENT_DOORS: MomentDoors = {
  create: () => new Promise((r) => setTimeout(() => r(true), 200)),
  save: () => new Promise((r) => setTimeout(() => r(true), 120)),
  remove: () => new Promise((r) => setTimeout(() => r(true), 700)),
  task: (op, _b, fields) =>
    new Promise((r) => setTimeout(() => r({ ok: true, value: op === 'task_add' ? `lab-${Math.random().toString(36).slice(2, 10)}` : (fields.task_id ?? '') }), 150)),
  papicCount: () => new Promise((r) => setTimeout(() => r({ ok: true, value: { removed: 3, stays: 1 } }), 300)),
  march: (op, _b, fields) =>
    new Promise((r) =>
      setTimeout(() => r({ ok: true, value: op === 'march_new' ? `own_lab${Math.random().toString(36).slice(2, 10)}` : (fields.march_key ?? '') }), 150),
    ),
  forSet: (_b, fields) =>
    new Promise((r) => setTimeout(() => r({ ok: true, value: fields.on === '1' && !fields.for_key.startsWith('s:') ? `lab-${Math.random().toString(36).slice(2, 10)}` : '' }), 150)),
  // The lab's shop ids follow the lab bookings (`v-photo` → `shop-photo`), as `LAB_ASKS` writes them.
  ask: (_b, fields) => new Promise((r) => setTimeout(() => r({ ok: true, value: `lab-ask-${Math.random().toString(36).slice(2, 10)}:${(fields.vendor_id ?? '').replace(/^v-/, 'shop-')}` }), 200)),
};

const NOT_SAVED = { ok: false as const, error: 'Try again.' };

/** The names a task's who is said with, from the page's lists. */
export function taskNamesFrom(who: TaskWhoList): TaskNames {
  return {
    suppliers: new Map(who.suppliers.map((s) => [s.id, s.name])),
    guests: new Map((who.people?.guests ?? []).map((g) => [g.id, g.name])),
    groups: new Map((who.people?.groups ?? []).map((g) => [g.id, g.name])),
    roles: new Map((who.people?.roles ?? []).map((r) => [r.key, r.name])),
  };
}

/** A moment as the clash check reads it. */
export function clashMomentOf(m: ChapterMoment): ClashMoment {
  return {
    block_id: m.block_id,
    parent_block_id: m.parent_block_id,
    label: m.label,
    start_at: m.start_at,
    end_at: m.end_at,
    location: m.location,
    spot: m.spot,
    travel_from: m.travel_from,
    travel_to: m.travel_to,
  };
}

/* ── the one sheet both stand in ─────────────────────────────────────────────────────────────────────────────── */

const LayerHeading = createContext<string | undefined>(undefined);

/**
 * ONE sheet for a moment, new or opened: Add swaps its body in place, never a second sheet. Two sheets in a row would
 * each own a Back entry (`useBackCloses`), and the first one's clean-up stepping back closed the second — measured in
 * WebKit at 390: Add landed on the chapter page instead of the new moment.
 */
export function MomentLayer({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const headingId = useId();
  return (
    <Sheet open onClose={onClose} labelledById={headingId} title={title}>
      <LayerHeading.Provider value={headingId}>{children}</LayerHeading.Provider>
    </Sheet>
  );
}

/* ── a new moment ────────────────────────────────────────────────────────────────────────────────────────────── */

export function NewMomentSheet({
  chapter: c,
  section: firstSection,
  onClose,
  onCreate,
}: {
  chapter: Chapter;
  /** The section that was open on the chapter's page — the new moment goes there unless changed. */
  section: ChapterSection;
  onClose: () => void;
  /** `rightAfter`: no clock of its own — it comes right after the last moment of the chapter (4 additions (1)). */
  onCreate: (label: string, startIso: string, minutes: number, rightAfter: boolean, shape: MomentShape) => Promise<boolean>;
}) {
  const headingId = useContext(LayerHeading);
  const sections = sectionsFor(c);
  const section0 = sections.includes(firstSection) ? firstSection : 'Event';
  const [label, setLabel] = useState('');
  const [when, setWhen] = useState<WhenKey>('at');
  // 🕑 One of two times: the second, as minutes after the first (null = not typed yet).
  const [orMinutes, setOrMinutes] = useState<number | null>(null);
  const [start, setStart] = useState<string>(sectionStartFor(c, section0) ?? c.start_at);
  const [minutes, setMinutes] = useState(DEFAULT_MOMENT_MINUTES);
  const [state, setState] = useState<'idle' | 'saving' | 'failed'>('idle');
  const ready = label.trim().length > 0 && (when !== 'or' || orMinutes !== null);
  void onClose;
  return (
      <div data-new-moment="" className="flex flex-col gap-3 px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-2">
        <h3 id={headingId} className="sr-only">
          New moment in {c.label}
        </h3>
        <p className="text-[13px] text-ink/60">{c.label}</p>
        <FormRows width="short">
          <TypedRow
            name="What"
            value={label}
            empty="Hair and make-up starts"
            maxLength={120}
            required
            onKeep={(t) => {
              setLabel(t.trim());
              return { ok: true };
            }}
            data="moment-name"
          />
          <WhenRow value={when} onPick={setWhen} />
          {when !== 'after' ? (
            <>
              <TimeRow
                name="Time"
                value={wallTime(start)}
                onKeep={(t) => {
                  const at = momentStartFrom(c, t);
                  if (!at) return NOT_SAVED;
                  setStart(at);
                  return { ok: true };
                }}
                data="moment-time"
              />
              {when === 'or' ? (
                <TimeRow
                  name="Or at"
                  value={orMinutes ? wallTime(orAt(start, orMinutes)) : ''}
                  empty="Second time"
                  onKeep={(t) => {
                    const second = momentStartFrom(c, t);
                    const n = second ? orMinutesBetween(start, second) : null;
                    if (!n) return { ok: false, error: SECOND_TIME_PROBLEM };
                    setOrMinutes(n);
                    return { ok: true };
                  }}
                  data="moment-time-or"
                />
              ) : null}
              <MinutesRow
                minutes={minutes}
                onKeep={(n) => {
                  setMinutes(n);
                  return { ok: true };
                }}
              />
            </>
          ) : null}
          {when !== 'after' && sections.length > 1 ? (
            <ChosenRow
              name="Section"
              value={momentSection(start, c)}
              options={sections.map((k) => ({ key: k, label: k }))}
              onPick={(k) => {
                const at = sectionStartFor(c, k as ChapterSection);
                if (at) setStart(at);
              }}
              data="moment-section"
            />
          ) : null}
        </FormRows>
        {state === 'failed' ? (
          <p role="alert" className="text-[13px] font-semibold text-danger-700">
            The moment didn’t save. Nothing was added — try again.
          </p>
        ) : null}
        <div className="flex justify-end">
          <ActionButton
            tone="brand"
            main
            icon={CalendarPlus}
            label={state === 'saving' ? 'Adding…' : 'Add'}
            disabled={!ready || state === 'saving'}
            data-testid="moment-create"
            onClick={async () => {
              setState('saving');
              const shape: MomentShape = when === 'about' ? { shape: 'about', orMinutes: null } : when === 'or' ? { shape: 'or', orMinutes } : { shape: 'at', orMinutes: null };
              const ok = await onCreate(label.trim(), start, minutes, when === 'after', shape);
              if (!ok) setState('failed');
            }}
          />
        </div>
      </div>
  );
}

/* ── when: at a time, or right after the one above ────────────────────────────────────────────────────────────── */

type WhenKey = 'at' | 'about' | 'or' | 'after';

/** 🕑 How a moment's clock is meant, as the create door posts it (4 additions (2), migration 20271303051692). */
export type MomentShape = { shape: TimeShape; orMinutes: number | null };

const WHEN_OPTIONS: PickOption[] = [
  { key: 'at', label: 'At a time' },
  { key: 'about', label: 'About a time' },
  { key: 'or', label: 'One of two times' },
  { key: 'after', label: RIGHT_AFTER_LONG },
];

function whenKeyOf(k: string): WhenKey {
  return k === 'about' || k === 'or' || k === 'after' ? k : 'at';
}

function shapeFields(shape: MomentShape | undefined): Record<string, string> {
  if (!shape || shape.shape === 'at') return {};
  return shape.shape === 'or' && shape.orMinutes
    ? { time_shape: 'or', time_or_minutes: String(shape.orMinutes) }
    : { time_shape: 'about' };
}

const SECOND_TIME_PROBLEM = 'Pick a time after the first one, within 4 hours of it.';

/**
 * ⏭ WHEN ▾ (owner 2026-11-02, 4 additions (1)): a coordinator's timeline writes some moments with no clock — "Bouquet
 * toss" right under "Cake cutting". One dropdown: At a time · Right after the one above. Right after keeps no time of
 * its own, never a guessed one, and moves with the moment above it.
 */
function WhenRow({ value, onPick }: { value: WhenKey; onPick: (k: WhenKey) => void }) {
  return (
    <ChosenRow
      name="When"
      about={{
        words:
          'About a time shows “About 3:15 PM”. One of two times shows both, like “2:15/2:30 PM”, when it is decided on the day. Right after the one above has no time of its own: it happens when the moment above it is done, and moves when that one moves. Guests do not see it until it has a time.',
      }}
      value={value}
      options={WHEN_OPTIONS}
      onPick={(k) => onPick(whenKeyOf(k))}
      data="moment-when"
    />
  );
}

function MinutesRow({ minutes, onKeep }: { minutes: number; onKeep: (n: number) => ReturnType<Parameters<typeof TypedRow>[0]['onKeep']> }) {
  return (
    <TypedRow
      name="Minutes"
      value={String(minutes)}
      maxLength={4}
      inputMode="numeric"
      required
      check={(t) => (/^\d{1,4}$/.test(t.trim()) && Number(t) >= 1 && Number(t) <= 1440 ? null : 'Between 1 and 1440 minutes.')}
      onKeep={(t) => onKeep(Number(t.trim()))}
      data="moment-minutes"
    />
  );
}

/* ── the moment ──────────────────────────────────────────────────────────────────────────────────────────────── */

export function MomentSheet({
  moment: m,
  chapter: c,
  chapters,
  moments,
  tasks,
  contacts = {},
  onContact,
  who,
  mayShowGuests,
  marches,
  wholeMarch,
  onMarches,
  doors,
  onPatch,
  onTasks,
  onClose,
  onDeleted,
  onStage,
  asks,
  onAsked,
}: {
  moment: ChapterMoment;
  chapter: Chapter;
  chapters: Chapter[];
  /** Every moment of the event — the clash check reads the whole day. */
  moments: ChapterMoment[];
  /** Every task of the event; null = the tasks could not be read (said, never "none"). */
  tasks: TaskRow[] | null;
  /** 📇 Each task's contact by task id; null = the contacts could not be read (said on the task, never "none"). */
  contacts?: Record<string, TaskContact> | null;
  /** 📇 A contact kept (or removed, null) on a task. */
  onContact?: (taskId: string, contact: TaskContact | null) => void;
  who: TaskWhoList;
  mayShowGuests: boolean;
  /** 🚶 The couple's own marches (made in Guests › March); `ok: false` = unread, said on the row. */
  marches: MarchList;
  /** What the event's Wedding March itself is called (`wholeMarchLabel`). */
  wholeMarch: string;
  /** A march made here joins the list every moment's dropdown reads. */
  onMarches: (made: MarchChoice) => void;
  doors: MomentDoors;
  onPatch: (next: Partial<ChapterMoment>) => void;
  /** The event's tasks after an add, change or removal here. */
  onTasks: (next: TaskRow[]) => void;
  onClose: () => void;
  onDeleted: () => void;
  /** The sheet's title follows the stage: "Moment" · "Delete moment". */
  onStage?: (deleting: boolean) => void;
  /** 🗓 The hosts' asks of suppliers on the event (D2); null = unread (said); undefined = not drawn. */
  asks?: readonly HostAsk[] | null;
  onAsked?: (row: HostAsk) => void;
}) {
  const headingId = useContext(LayerHeading);
  const [stage, setStage] = useState<'details' | 'ask' | 'deleting' | 'failed'>('details');
  useEffect(() => onStage?.(stage !== 'details'), [stage, onStage]);
  const [papic, setPapic] = useState<{ ok: true; value: MomentPapic } | { ok: false } | null>(null);
  const [drafts, setDrafts] = useState<string[]>([]);
  const names = useMemo(() => taskNamesFrom(who), [who]);
  /* 🔒 CHANGE LOCK (audit D7): a LOCKED supplier on this moment is said BEFORE a change — host words, never "lock" —
     with the way to ask instead; a refused save then says the same calm line, never "Try again." */
  const lockedShop = lockedShopOnMoment(m.vendor_ids, who.suppliers);
  const lockedId = lockedShop ? (m.vendor_ids.find((v) => who.suppliers.some((s) => s.id === v && s.locked === true)) ?? null) : null;
  const refused = lockedShop ? { ok: false as const, error: lockedLine(lockedShop) } : NOT_SAVED;
  const [askOpener, setAskOpener] = useState<{ vendorId: string; n: number } | null>(null);
  /* The task and Suppliers-and-crew doors say the same calm line on a refusal here (their own words otherwise). */
  const partDoors = useMemo<MomentDoors>(() => {
    if (!lockedShop) return doors;
    const calm = <T,>(r: Answer<T>): Answer<T> => (!r.ok && r.error === NOT_SAVED_WORDS ? { ok: false, error: lockedLine(lockedShop) } : r);
    return {
      ...doors,
      task: (op, blockId, fields) => doors.task(op, blockId, fields).then(calm),
      forSet: (blockId, fields) => doors.forSet(blockId, fields).then(calm),
    };
  }, [doors, lockedShop]);
  const mine = (tasks ?? []).filter((t) => t.block_id === m.block_id).sort((a, b) => a.sort_order - b.sort_order);
  const clashes = useMemo(
    () => clashesForMoment(m.block_id, tasks ?? [], moments.map(clashMomentOf), chapters, names),
    [m.block_id, tasks, moments, chapters, names],
  );
  const minutes = minutesBetween(m.start_at, m.end_at) ?? DEFAULT_MOMENT_MINUTES;
  const section = momentSection(m.start_at, c);
  // ⏭ "Right after the one above" (no clock) or "At a time". Picking At a time saves nothing until a time is typed —
  // the order key it holds is its anchor's start, never a time to keep.
  const savedWhen: WhenKey = m.time_tba ? 'after' : m.time_shape;
  const [when, setWhen] = useState<WhenKey>(savedWhen);
  useEffect(() => setWhen(savedWhen), [savedWhen]);
  const untimed = m.time_tba;
  // 🕑 The second of "2:15/2:30" as a clock (null when not one of two).
  const secondIso = m.time_shape === 'or' && m.time_or_minutes ? orAt(m.start_at, m.time_or_minutes) : null;
  const sections = sectionsFor(c);
  const roomOf = m.spot ?? (m.location ? null : c.spot);

  const keep = async (fields: Record<string, string>, next: Partial<ChapterMoment>) => {
    const ok = await doors.save(m.block_id, fields);
    if (!ok) return refused;
    onPatch(next);
    return { ok: true as const };
  };

  /** A new start keeps the moment's length. On a moment with no clock yet, it is now timed and follows nothing. */
  const moveTo = (startIso: string) => {
    const endIso = shiftWall(startIso, minutes);
    // 🕑 "2:15/2:30": moving the first time keeps the second where it was written — refused if it would come first.
    const orN = secondIso ? orMinutesBetween(startIso, secondIso) : null;
    if (secondIso && !orN) return { ok: false as const, error: 'Make the first time earlier than the second.' };
    const shaped: Record<string, string> = secondIso ? { time_shape: 'or', time_or_minutes: String(orN) } : {};
    const shapedNext: Partial<ChapterMoment> = secondIso ? { time_or_minutes: orN } : {};
    if (untimed) {
      // A time typed on a moment with none: it is timed now, as the When ▾ says (exactly, or about).
      const shape: TimeShape = when === 'about' ? 'about' : 'at';
      return keep(
        { start_at: startIso.slice(0, 16), end_at: endIso.slice(0, 16), time_tba: '0', time_shape: shape },
        { start_at: startIso, end_at: endIso, time_tba: false, follows_block_id: null, time_shape: shape, time_or_minutes: null },
      );
    }
    return keep({ start_at: startIso.slice(0, 16), end_at: endIso.slice(0, 16), ...shaped }, { start_at: startIso, end_at: endIso, ...shapedNext });
  };

  /** 🕑 Exactly · About: saved at once. One of two waits for its second time. */
  const reshape = (k: 'at' | 'about') =>
    keep({ time_shape: k }, { time_shape: k, time_or_minutes: null }).then((r) => {
      if (!r.ok) setWhen(savedWhen);
      return r;
    });

  /** ⏭ Right after the one above: the moment directly above it in this chapter's run (none = first). */
  const goRightAfter = async () => {
    const above = momentAbove(moments.filter((x) => x.parent_block_id === m.parent_block_id), m.block_id);
    const r = await keep(
      { time_tba: '1', ...(above ? { follows_block_id: above.block_id } : {}) },
      { time_tba: true, end_at: null, is_public: false, follows_block_id: above?.block_id ?? null, start_at: above?.start_at ?? c.start_at, time_shape: 'at', time_or_minutes: null },
    );
    if (!r.ok) setWhen(savedWhen);
  };

  /** 👷 A supplier's line puts the moment on their day — the door linked them first (`runMomentOp`); the sheet says so. */
  const linked = (row: TaskRow) => {
    if (row.vendor_id && !m.vendor_ids.includes(row.vendor_id)) onPatch({ vendor_ids: [...m.vendor_ids, row.vendor_id] });
  };

  const askDelete = () => {
    setStage('ask');
    setPapic(null);
    void doors.papicCount(m.block_id, c.block_id).then((r) => setPapic(r.ok ? r : { ok: false }));
  };

  void onClose;
  return (
      <div data-moment-sheet={m.block_id} className="flex flex-col gap-3 px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-2">
        <h3 id={headingId} className="sr-only">
          {m.label}
        </h3>
        {stage === 'details' && lockedShop && lockedId ? (
          /* 🔒 CHANGE LOCK (audit D7): the moment of a locked supplier is READ-ONLY — plain values, no pencil, chevron,
             clock or frame — so the host never types into a change the database will refuse. The WHOLE moment locks
             (its when / where / what is the supplier's part, so the trigger refuses any of it). The one door: Send them
             a request. Guarded by "a locked moment renders no editable inputs" (a-locked-part-refuses-the-host.test.ts). */
          <>
            <p className="text-[13px] text-ink/60">{c.label}</p>
            <p role="note" data-moment-locked="" className="text-[13px] text-warn-900">
              {lockedHead(lockedShop)}
            </p>
            <LockedMomentFacts
              rows={[
                ['What', m.label],
                ['When', untimed ? RIGHT_AFTER_LONG : `${m.time_shape === 'about' ? 'About ' : ''}${clockWords(m.start_at)}${secondIso ? ` or ${clockWords(secondIso)}` : ''}`],
                ...(untimed ? [] : ([['Minutes', String(minutes)]] as [string, string][])),
                ...(!untimed && sections.length > 1 ? ([['Section', section]] as [string, string][]) : []),
                ['Room', m.spot ?? c.spot ?? '—'],
                ['Suppliers and crew', forWords(m.vendor_ids, mine, who.suppliers)],
                ['Visible to guests', m.is_public ? 'Yes' : 'No'],
                ['Optional', m.is_optional ? 'Yes' : 'No'],
                ...(m.travel_to ? ([['Travel', `${m.travel_from?.trim() || c.location || 'Here'} → ${m.travel_to}`]] as [string, string][]) : []),
                ...(m.notes ? ([['Notes', m.notes]] as [string, string][]) : []),
              ]}
              tasks={tasks === null ? null : mine.map((t) => ({ id: t.task_id, who: taskWhoWords(t, names), what: t.what, place: taskPlace(t, m, c) }))}
            />
            <div className="pt-1">
              <ActionButton
                tone="brand"
                main
                icon={Send}
                label="Send them a request"
                data-testid="moment-locked-ask"
                onClick={() => {
                  setAskOpener((o) => ({ vendorId: lockedId, n: (o?.n ?? 0) + 1 }));
                  requestAnimationFrame(() =>
                    document
                      .querySelector(`[data-moment-sheet="${m.block_id}"] [data-moment-asks]`)
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
                  );
                }}
              />
            </div>
            <AskSupplierSection
              moment={m}
              chapter={c}
              suppliers={who.suppliers}
              asks={asks}
              ask={doors.ask}
              onAsked={(row) => onAsked?.(row)}
              opener={askOpener}
              noOpenButton
            />
          </>
        ) : stage === 'details' ? (
          <>
            <p className="text-[13px] text-ink/60">{c.label}</p>
            <FormRows width="wide">
              <TypedRow
                name="What"
                value={m.label}
                maxLength={120}
                required
                check={(t) => (t.trim() ? null : 'A moment needs a name.')}
                onKeep={(t) => keep({ label: t.trim() }, { label: t.trim() })}
                data="moment-name"
              />
              <WhenRow
                value={when}
                onPick={(k) => {
                  setWhen(k);
                  if (k === 'after' && !untimed) void goRightAfter();
                  else if ((k === 'at' || k === 'about') && !untimed && k !== m.time_shape) void reshape(k);
                }}
              />
              {when !== 'after' ? (
                <TimeRow
                  name="Time"
                  value={untimed ? '' : wallTime(m.start_at)}
                  empty="Set a time"
                  onKeep={(t) => {
                    const at = momentStartFrom(c, t);
                    return at ? moveTo(at) : NOT_SAVED;
                  }}
                  data="moment-time"
                />
              ) : null}
              {when === 'or' && !untimed ? (
                <TimeRow
                  name="Or at"
                  value={secondIso ? wallTime(secondIso) : ''}
                  empty="Second time"
                  onKeep={(t) => {
                    const second = momentStartFrom(c, t);
                    const n = second ? orMinutesBetween(m.start_at, second) : null;
                    if (!n) return { ok: false, error: SECOND_TIME_PROBLEM };
                    return keep({ time_shape: 'or', time_or_minutes: String(n) }, { time_shape: 'or', time_or_minutes: n });
                  }}
                  data="moment-time-or"
                />
              ) : null}
              {!untimed ? (
                <MinutesRow
                  minutes={minutes}
                  onKeep={(n) => {
                    const end = shiftWall(m.start_at, n);
                    return keep({ end_at: end.slice(0, 16) }, { end_at: end });
                  }}
                />
              ) : null}
              {!untimed && sections.length > 1 ? (
                <ChosenRow
                  name="Section"
                  about={{ words: 'Ingress is setting up before the chapter starts, Egress is clearing out after it ends. Picking one moves the moment there.' }}
                  value={section}
                  options={sections.map((k) => ({ key: k, label: k }))}
                  onPick={(k) => {
                    if (k === section) return;
                    const at = sectionStartFor(c, k as ChapterSection);
                    if (at) void moveTo(at);
                  }}
                  data="moment-section"
                />
              ) : null}
              <TypedRow
                name="Room"
                about={{ words: 'Where it happens inside the venue. Every task here is in this room unless the task says another place.' }}
                value={m.spot ?? ''}
                empty={c.spot ?? 'Bridal suite, 2F, lobby'}
                maxLength={120}
                onKeep={(t) => keep({ spot: t.trim() }, { spot: t.trim() || null })}
                data="moment-room"
              />
              <ForRow moment={m} who={who} tasks={tasks} doors={partDoors} onPatch={onPatch} onTasks={onTasks} />
              <SwitchRow
                name="Visible to guests"
                line={
                  untimed
                    ? 'Give it a time first — guests only see moments with a time.'
                    : section !== 'Event'
                    ? 'Only Event moments can show to guests.'
                    : mayShowGuests || m.is_public
                      ? 'Guests see it on their schedule.'
                      : 'Only the hosts and the coordinator can show a moment to guests.'
                }
                on={m.is_public}
                disabled={c.time_tba === true || untimed || (!m.is_public && (section !== 'Event' || !mayShowGuests))}
                onChange={(next) => void keep({ is_public: next ? 'true' : 'false' }, { is_public: next })}
                data="moment-guests"
              />
              <SwitchRow
                name="Optional"
                line="Only if it is kept on the day — a father’s reveal, the bouquet toss."
                on={m.is_optional}
                onChange={(next) => void keep({ is_optional: next ? 'true' : 'false' }, { is_optional: next })}
                data="moment-optional"
              />
              <MarchRow moment={m} marches={marches} wholeMarch={wholeMarch} doors={doors} onPatch={onPatch} onMarches={onMarches} />
              <TypedRow
                name="Travel to"
                about={{ words: 'For a trip between places — the bridal car to the church. Leave it blank when nobody travels.' }}
                value={m.travel_to ?? ''}
                empty="Not a trip"
                maxLength={120}
                onKeep={(t) =>
                  keep(
                    { travel_to: t.trim(), travel_from: m.travel_from ?? '' },
                    { travel_to: t.trim() || null, travel_from: t.trim() ? m.travel_from : null },
                  )
                }
                data="moment-travel-to"
              />
              {m.travel_to ? (
                <TypedRow
                  name="Travel from"
                  value={m.travel_from ?? ''}
                  empty={c.location ?? 'Here'}
                  maxLength={120}
                  onKeep={(t) => keep({ travel_to: m.travel_to ?? '', travel_from: t.trim() }, { travel_from: t.trim() || null })}
                  data="moment-travel-from"
                />
              ) : null}
              <TypedRow
                name="Notes"
                value={m.notes ?? ''}
                long
                boxed
                maxLength={2000}
                onKeep={(t) => keep({ notes: t.trim() }, { notes: t.trim() || null })}
                data="moment-notes"
              />
            </FormRows>

            <AskSupplierSection
              moment={m}
              chapter={c}
              suppliers={who.suppliers}
              asks={asks}
              ask={doors.ask}
              onAsked={(row) => onAsked?.(row)}
              opener={askOpener}
            />

            <section data-moment-tasks={mine.length} aria-label="Tasks" className="mt-2 border-t border-ink/10 pt-3">
              <h4 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">Tasks at this moment</h4>
              {tasks === null ? (
                <p role="alert" data-moment-tasks-failed="" className="mt-2 text-[13px] font-semibold text-danger-700">
                  The tasks couldn’t be read just now. Nothing is lost — close and open the moment again.
                </p>
              ) : (
                <>
                  {mine.length === 0 && drafts.length === 0 ? (
                    <p className="mt-2 text-[13px] text-ink/60">Who does what at this moment — one line per supplier, crew or person.</p>
                  ) : null}
                  {mine.map((t) => (
                    <TaskEditor
                      key={t.task_id}
                      task={t}
                      moment={m}
                      chapter={c}
                      roomOf={roomOf}
                      who={who}
                      names={names}
                      clash={clashes.get(t.task_id) ?? null}
                      doors={partDoors}
                      contact={contacts === null ? 'unread' : (contacts[t.task_id] ?? null)}
                      onContact={(next) => onContact?.(t.task_id, next)}
                      onSaved={(row) => {
                        linked(row);
                        onTasks((tasks ?? []).map((x) => (x.task_id === row.task_id ? row : x)));
                      }}
                      onRemoved={() => onTasks((tasks ?? []).filter((x) => x.task_id !== t.task_id))}
                    />
                  ))}
                  {drafts.map((d, i) => (
                    <TaskEditor
                      key={d}
                      task={null}
                      sortOrder={mine.length + i}
                      moment={m}
                      chapter={c}
                      roomOf={roomOf}
                      who={who}
                      names={names}
                      clash={null}
                      doors={partDoors}
                      onSaved={(row) => {
                        linked(row);
                        setDrafts((ds) => ds.filter((x) => x !== d));
                        onTasks([...(tasks ?? []), row]);
                      }}
                      onRemoved={() => setDrafts((ds) => ds.filter((x) => x !== d))}
                    />
                  ))}
                  <div className="mt-3">
                    <ActionButton
                      tone="neutral"
                      icon={Plus}
                      label="Add a task"
                      data-testid="task-add"
                      onClick={() => setDrafts((ds) => [...ds, `draft-${Date.now()}-${ds.length}`])}
                    />
                  </div>
                </>
              )}
            </section>

            <div className="flex justify-start border-t border-ink/10 pt-3">
              <ActionButton tone="danger" icon={Trash2} label="Delete moment" onClick={askDelete} data-testid="moment-delete" />
            </div>
          </>
        ) : (
          <div data-moment-delete={stage} className="flex flex-col gap-3">
            <p className="text-[15px] text-ink" data-moment-delete-words="">
              {stage === 'deleting' ? (
                'Deleting…'
              ) : stage === 'failed' ? (
                <span role="alert" className="font-semibold text-danger-700">
                  {lockedShop ? lockedLine(lockedShop) : `${m.label} wasn’t deleted. Nothing was changed — try again.`}
                </span>
              ) : (
                momentDeleteWords({ label: m.label, tasks: mine.length, papic })
              )}
            </p>
            {stage === 'deleting' ? null : (
              <div className="flex justify-end gap-2">
                <ActionButton tone="neutral" icon={X} label="Not now" quiet onClick={() => setStage('details')} />
                <ActionButton
                  tone="danger"
                  main
                  icon={Trash2}
                  label="Continue"
                  data-testid="moment-delete-continue"
                  onClick={async () => {
                    setStage('deleting');
                    const ok = await doors.remove(m.block_id);
                    if (ok) onDeleted();
                    else setStage('failed');
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
  );
}

/* ── 🔒 a locked moment, read-only ─────────────────────────────────────────────────────────────────────────────────── */

/** Plain text, no frame and nothing to press: the values of a locked supplier's moment, then its tasks. */
function LockedMomentFacts({
  rows,
  tasks,
}: {
  rows: readonly (readonly [string, string])[];
  tasks: { id: string; who: string; what: string; place: string | null }[] | null;
}) {
  return (
    <div data-moment-readonly="" className="flex flex-col">
      <dl className="divide-y divide-ink/10">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-4 py-2.5">
            <dt className="shrink-0 text-[15px] text-ink/70">{k}</dt>
            <dd className="min-w-0 truncate text-right text-[15px] text-ink" title={v}>
              {v}
            </dd>
          </div>
        ))}
      </dl>
      <h4 className="mt-3 border-t border-ink/10 pt-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">Tasks at this moment</h4>
      {tasks === null ? (
        <p role="alert" className="mt-2 text-[13px] font-semibold text-danger-700">
          The tasks couldn’t be read just now. Nothing is lost — close and open the moment again.
        </p>
      ) : tasks.length === 0 ? (
        <p className="mt-2 text-[13px] text-ink/60">No tasks at this moment.</p>
      ) : (
        <ul className="divide-y divide-ink/10">
          {tasks.map((t) => (
            <li key={t.id} className="py-2 text-[14px]">
              <span className="block font-semibold">{t.who}</span>
              <span className="block">{t.what}</span>
              {t.place ? <span className="block text-[13px] text-ink/60">{t.place}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── the search at the top of a who dropdown ──────────────────────────────────────────────────────────────────── */

function SearchHead({
  query,
  onQuery,
  placeholder,
  label,
  data,
  children,
}: {
  query: string;
  onQuery: (q: string) => void;
  placeholder: string;
  label: string;
  data: `data-${string}`;
  children?: ReactNode;
}) {
  return (
    <li role="none" className="sticky top-0 z-[2] -mx-1.5 -mt-1.5 mb-1 bg-cream/95 p-1.5 dark:bg-raised/95">
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/45" strokeWidth={2} />
        <input
          className="min-h-11 w-full rounded-xl border border-ink/15 bg-cream pl-9 pr-3 text-[14px] text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none dark:bg-raised"
          type="search"
          inputMode="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={placeholder}
          aria-label={label}
          {...{ [data]: '' }}
        />
      </div>
      {children}
    </li>
  );
}

/* ── 👷 Suppliers and crew ▾ — who this moment is for ─────────────────────────────────────────────────────────── */

/**
 * ONE dropdown with ticks (the house PickMenu via `ChosenRow`'s `picked`), two sections — Suppliers and Crew — and a
 * search, which also offers a typed name as a new crew of a booked supplier. A tick saves at once (`forSet`); picking a
 * crew member also links their supplier to the moment and the chapter, so it shows on that supplier's day marked
 * yours, with the crew member's name. It never touches Visible to guests. What it writes and why: `lib/moment-for.ts`,
 * `setMomentFor` (lib/schedule-chapters.server.ts). A refused tick keeps the old ticks and says why.
 */
function ForRow({
  moment: m,
  who,
  tasks,
  doors,
  onPatch,
  onTasks,
}: {
  moment: ChapterMoment;
  who: TaskWhoList;
  tasks: TaskRow[] | null;
  doors: MomentDoors;
  onPatch: (next: Partial<ChapterMoment>) => void;
  onTasks: (next: TaskRow[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const mine = (tasks ?? []).filter((t) => t.block_id === m.block_id);
  const picked = forPicked(m.vendor_ids, mine);
  // The crews unread = no Crew section (a tick there could not be shown honestly); suppliers still work.
  const options = forOptions({ suppliers: who.suppliers, crews: tasks === null ? [] : who.crews, query }).filter(
    (o) => tasks !== null || o.group === 'Suppliers',
  );
  if (who.suppliers.length === 0 && m.vendor_ids.length === 0) return null;
  return (
    <ChosenRow
      name="Suppliers and crew"
      about={{
        words:
          'Who this moment is for. A supplier sees it on their day marked yours; picking one of their crew also adds the supplier, with the crew member’s name. Guests see it only when Visible to guests is on.',
      }}
      line={tasks === null ? 'Their crew couldn’t be read just now — suppliers still work.' : undefined}
      value={null}
      picked={picked}
      buttonText={busy ? 'Saving…' : forWords(m.vendor_ids, mine, who.suppliers)}
      options={options}
      head={
        <SearchHead query={query} onQuery={setQuery} placeholder="Find a supplier or crew, or type a crew name" label="Find a supplier or crew" data="data-moment-for-search">
          {query.trim() && options.length === 0 ? <p className="px-3 pt-2 text-[12px] text-ink/55">No supplier matches “{query.trim()}”.</p> : null}
        </SearchHead>
      }
      doneNote="Tick a supplier, or one of their crew."
      problem={problem ? <span role="alert">{problem}</span> : undefined}
      onPick={(k) => {
        const pick = forPickOf(k);
        if (!pick || busy) return;
        const key = forKey(pick);
        const on = k.startsWith('n:') ? true : !picked.includes(key);
        setProblem(null);
        setBusy(true);
        void doors.forSet(m.block_id, { for_key: key, on: on ? '1' : '0' }).then((r) => {
          setBusy(false);
          if (!r.ok) {
            setProblem(r.error);
            return;
          }
          setQuery('');
          // The chapter's list says who is on each moment by supplier name — kept with the ticks.
          const patchVendors = (ids: string[]) =>
            onPatch({ vendor_ids: ids, who: ids.map((v) => who.suppliers.find((s) => s.id === v)?.name).filter(Boolean).join(', ') });
          if (on && !m.vendor_ids.includes(pick.vendorId)) patchVendors([...m.vendor_ids, pick.vendorId]);
          if (!on && pick.kind === 'supplier') patchVendors(m.vendor_ids.filter((v) => v !== pick.vendorId));
          if (pick.kind !== 'crew' || tasks === null) return;
          if (on) {
            if (r.value && !tasks.some((t) => t.task_id === r.value)) {
              onTasks([...tasks, rowOf(r.value, m.block_id, { who_kind: 'supplier', who_ref: pick.vendorId, crew: pick.crew }, m.label, null, null, 0)]);
            }
          } else {
            const gone = new Set(r.value ? r.value.split(',') : crewLines(mine, pick.vendorId, pick.crew).map((t) => t.task_id));
            onTasks(tasks.filter((t) => !gone.has(t.task_id)));
          }
        });
      }}
      data="moment-for"
    />
  );
}

/* ── one task: who · what · call time · place ────────────────────────────────────────────────────────────────── */

const OTHER = '__other__';

function TaskEditor({
  task,
  sortOrder,
  moment: m,
  chapter: c,
  roomOf,
  who,
  names,
  clash,
  doors,
  contact = null,
  onContact,
  onSaved,
  onRemoved,
}: {
  /** 📇 This task's contact (4 additions (3)); 'unread' = the contacts could not be read (said). */
  contact?: TaskContact | null | 'unread';
  onContact?: (next: TaskContact | null) => void;
  /** null = a new task, not saved until it has a who and a what. */
  task: TaskRow | null;
  sortOrder?: number;
  moment: ChapterMoment;
  chapter: Chapter;
  roomOf: string | null;
  who: TaskWhoList;
  names: TaskNames;
  clash: string | null;
  doors: MomentDoors;
  onSaved: (row: TaskRow) => void;
  onRemoved: () => void;
}) {
  const initialKey = task ? whoKeyOf(task) : null;
  const [whoF, setWhoF] = useState<WhoFields | null>(initialKey ? whoFieldsOf(initialKey) : null);
  const [what, setWhat] = useState(task?.what ?? '');
  const [callAt, setCallAt] = useState<string | null>(task?.call_at ?? null);
  const [place, setPlace] = useState<string | null>(task?.place ?? null);
  const [other, setOther] = useState(false);
  const [query, setQuery] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const sort = task?.sort_order ?? sortOrder ?? 0;
  useEffect(() => setProblem(null), [whoF, what]);

  /** Write this task as it now stands — an add for a new one (once it has a who and a what), else a save. */
  const write = async (next: { whoF?: WhoFields | null; what?: string; callAt?: string | null; place?: string | null }) => {
    const w = next.whoF !== undefined ? next.whoF : whoF;
    const text = next.what !== undefined ? next.what : what;
    const call = next.callAt !== undefined ? next.callAt : callAt;
    const at = next.place !== undefined ? next.place : place;
    if (!task && (!w || !text.trim())) return { ok: true as const }; // a draft waits for its who and its what
    if (!w) return { ok: false as const, error: 'Pick who does it.' };
    const fields = taskFields(w, text, call, at, sort, task?.task_id ?? null);
    const answer = await doors.task(task ? 'task_save' : 'task_add', m.block_id, fields);
    if (!answer.ok) {
      setProblem(answer.error);
      return { ok: false as const, error: answer.error };
    }
    onSaved(rowOf(task ? task.task_id : answer.value, m.block_id, w, text.trim(), call, at?.trim() || null, sort));
    return { ok: true as const };
  };

  const q = normalizeSearchText(query);
  const hit = (s: string) => !q || normalizeSearchText(s).includes(q);
  const crews = new Map<string, string>();
  for (const s of who.suppliers) crews.set(s.id, s.name);
  const options: PickOption[] = [
    ...who.suppliers.filter((s) => hit(s.name)).map((s) => ({ key: `s:${s.id}`, label: s.name, group: 'Suppliers' })),
    ...who.crews.filter((cr) => hit(`${crews.get(cr.vendorId) ?? ''} ${cr.crew}`)).map((cr) => ({ key: `c:${cr.vendorId}:${cr.crew}`, label: `${crews.get(cr.vendorId) ?? 'A supplier'} · ${cr.crew}`, group: 'Crews' })),
    ...(who.people?.roles ?? []).filter((r) => hit(r.name)).map((r) => ({ key: `r:${r.key}`, label: r.name, group: 'Roles' })),
    ...(who.people?.groups ?? []).filter((g) => hit(g.name)).map((g) => ({ key: `g:${g.id}`, label: g.name, group: 'Groups' })),
    // 👥 People are found by searching, never a long list (plan §3 "Unlimited people") — 20 at a time.
    ...(q ? (who.people?.guests ?? []).filter((g) => hit(g.name)).slice(0, 20).map((g) => ({ key: `p:${g.id}`, label: g.name, group: 'People' })) : []),
    { key: OTHER, label: '＋ Someone else, in words…' },
  ];
  const current = whoF ? whoKeyOf(rowOf('', '', whoF, '', null, null, 0)) : null;
  const whoText = whoF ? taskWhoWords(rowOf('', '', whoF, '', null, null, 0), names) : null;
  const head = (
    <SearchHead query={query} onQuery={setQuery} placeholder="Find a supplier, crew, role, group or person" label="Find who does it" data="data-task-who-search">
      {who.people === null ? <p className="px-3 pt-2 text-[12px] text-danger-700">Your guests and groups couldn’t be read just now — suppliers and names in words still work.</p> : null}
      {q && options.length === 1 ? <p className="px-3 pt-2 text-[12px] text-ink/55">Nobody matches “{query.trim()}” — add them in words below.</p> : null}
    </SearchHead>
  );
  const placeShown = taskPlace({ place }, { ...m, block_id: m.block_id }, c);
  const callShown = callAt ? wallTime(callAt) : '';

  return (
    <div data-task={task?.task_id ?? 'new'} data-task-clash={clash ? '' : undefined} className="mt-3 border-t border-ink/10 pt-2">
      <FormRows width="wide">
        <ChosenRow
          name="Who"
          label="Who does it"
          value={current}
          buttonText={whoText ?? 'Pick who'}
          options={options}
          head={head}
          onPick={(k) => {
            setQuery('');
            if (k === OTHER) {
              setOther(true);
              return;
            }
            const f = whoFieldsOf(k);
            if (!f) return;
            setOther(false);
            setWhoF(f);
            void write({ whoF: f });
          }}
          problem={clash ? <span role="alert" data-task-clash-words="">⚠ {clash}</span> : undefined}
          data="task-who"
        />
        {other ? (
          <TypedRow
            name="Their name"
            value=""
            empty="Seda banquet captain"
            maxLength={120}
            openAsk={1}
            onKeep={async (t) => {
              const f: WhoFields = { who_kind: 'label', who_ref: t.trim(), crew: '' };
              if (!t.trim()) return { ok: false as const, error: 'Type who does it.' };
              setWhoF(f);
              setOther(false);
              return write({ whoF: f });
            }}
            data="task-who-words"
          />
        ) : null}
        {whoF?.who_kind === 'supplier' ? (
          <TypedRow
            name="Crew"
            about={{ words: 'When a supplier splits up to cover two places at once — Team A with the bride, Team B with the groom.' }}
            value={whoF.crew}
            empty="Whole team"
            maxLength={60}
            onKeep={(t) => {
              const f = { ...whoF, crew: t.trim() };
              setWhoF(f);
              return write({ whoF: f });
            }}
            data="task-crew"
          />
        ) : null}
        <TypedRow
          name="What they do"
          value={what}
          empty="Bridesmaids’ hair and make-up"
          maxLength={500}
          required
          onKeep={(t) => {
            setWhat(t.trim());
            return write({ what: t.trim() });
          }}
          data="task-what"
        />
        <TimeRow
          name="Call time"
          value={callShown}
          empty="At the moment"
          clearable
          onKeep={(t) => {
            const at = callAtFrom(m.start_at, t);
            setCallAt(at);
            return write({ callAt: at });
          }}
          data="task-call"
        />
        <TypedRow
          name="Place"
          value={place ?? ''}
          empty={roomOf ? `${roomOf} (the moment’s room)` : (placeShown ?? 'The moment’s room')}
          maxLength={120}
          onKeep={(t) => {
            setPlace(t.trim() || null);
            return write({ place: t.trim() || null });
          }}
          data="task-place"
        />
        {/* 📇 A CONTACT on a person's task — the bridal-car driver, who is not a supplier (owner 2026-11-02, 4 additions
            (3)). A supplier is reached through their own shop, so their lines carry none. Saved once the task is. */}
        {task && whoF && whoF.who_kind !== 'supplier' ? (
          <ContactRows taskId={task.task_id} blockId={m.block_id} contact={contact} doors={doors} onContact={onContact} />
        ) : null}
      </FormRows>
      {!task && (!whoF || !what.trim()) ? (
        <p data-task-draft="" className="mt-1 text-[12px] text-ink/55">
          Pick who and say what they do — it saves then.
        </p>
      ) : null}
      {problem ? (
        <p role="alert" className="mt-1 text-[13px] font-semibold text-danger-700">
          {problem}
        </p>
      ) : null}
      <div className="mt-1 flex justify-end">
        <ActionButton
          tone="danger"
          quiet
          icon={X}
          label={removing ? 'Removing…' : 'Remove task'}
          disabled={removing}
          onClick={async () => {
            if (!task) return onRemoved();
            setRemoving(true);
            const answer = await doors.task('task_remove', m.block_id, { task_id: task.task_id });
            setRemoving(false);
            if (answer.ok) onRemoved();
            else setProblem(answer.error);
          }}
          data-testid="task-remove"
        />
      </div>
    </div>
  );
}

/* ── 📇 a task's contact ─────────────────────────────────────────────────────────────────────────────────────── */

const CONTACT_ABOUT =
  'A name and phone for someone who is not a supplier, like the bridal-car driver. Only you, your coordinator and the people on this moment see it. Clear both to remove it.';

/**
 * 📇 Contact · Phone — two rows, ONE contact. It saves when both are there (a name with no number is not a way to reach
 * anybody), and clearing both removes it. Shown only to the host, the coordinator and that moment's crew — the
 * database decides (`event_schedule_task_contacts`, migration 20271303218631).
 */
function ContactRows({
  taskId,
  blockId,
  contact,
  doors,
  onContact,
}: {
  taskId: string;
  blockId: string;
  contact: TaskContact | null | 'unread';
  doors: MomentDoors;
  onContact?: (next: TaskContact | null) => void;
}) {
  const saved = contact === 'unread' ? null : contact;
  const [name, setName] = useState(saved?.name ?? '');
  const [phone, setPhone] = useState(saved?.phone ?? '');
  const waiting = (name.trim() === '') !== (phone.trim() === '');

  const keep = async (nextName: string, nextPhone: string) => {
    setName(nextName);
    setPhone(nextPhone);
    const parsed = contactFrom(nextName, nextPhone);
    // One without the other is held here, not saved — the line under the rows says what is missing.
    if (!parsed.ok && (nextName.trim() === '') !== (nextPhone.trim() === '')) return { ok: true as const };
    if (!parsed.ok) return { ok: false as const, error: parsed.error };
    const answer = await doors.task('contact_set', blockId, {
      task_id: taskId,
      contact_name: parsed.contact?.name ?? '',
      contact_phone: parsed.contact?.phone ?? '',
    });
    if (!answer.ok) return { ok: false as const, error: answer.error };
    onContact?.(parsed.contact);
    return { ok: true as const };
  };

  return (
    <>
      <TypedRow
        name="Contact"
        about={{ words: CONTACT_ABOUT }}
        value={name}
        empty="Mang Ben"
        maxLength={CONTACT_NAME_MAX}
        onKeep={(t) => keep(t.trim(), phone)}
        note={contact === 'unread' ? 'Contacts couldn’t be read just now.' : waiting && !name.trim() ? 'Add their name too — it saves then.' : undefined}
        data="task-contact-name"
      />
      <TypedRow
        name="Phone"
        value={phone}
        empty="0917 123 4567"
        maxLength={CONTACT_PHONE_MAX}
        inputMode="tel"
        autoComplete="tel"
        check={(t) => (t.trim() ? phoneProblem(t) : null)}
        onKeep={(t) => keep(name, t.trim())}
        note={waiting && !phone.trim() ? 'Add their phone too — it saves then.' : undefined}
        data="task-contact-phone"
      />
    </>
  );
}

/* ── 🚶 this is a march ──────────────────────────────────────────────────────────────────────────────────────── */

/**
 * "This is a march" — the house dropdown (`ChosenRow` → PickMenu): Not a march · the Wedding March · each own march ·
 * + New march. Picking saves at once (the Form Row rule); + New march opens one more row for its name, and keeping the
 * name makes the march and links it. A refused save keeps the old pick and says why — it never shows a march that
 * did not save.
 */
function MarchRow({
  moment: m,
  marches,
  wholeMarch,
  doors,
  onPatch,
  onMarches,
}: {
  moment: ChapterMoment;
  marches: MarchList;
  wholeMarch: string;
  doors: MomentDoors;
  onPatch: (next: Partial<ChapterMoment>) => void;
  onMarches: (made: MarchChoice) => void;
}) {
  const [naming, setNaming] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const current = m.march_key ?? NOT_A_MARCH;
  return (
    <>
      <ChosenRow
        name="This is a march"
        about={{
          words:
            'Which march walks at this moment. Marches are made in Guests › March, with the guests who walk in them. Two moments can use one march, and Not a march never deletes the march.',
        }}
        line={marches.ok ? undefined : 'Your marches couldn’t be read just now — the Wedding March can still be picked.'}
        value={naming ? NEW_MARCH : current}
        options={marchPickOptions(marches, wholeMarch, m.march_key)}
        problem={problem ? <span role="alert">{problem}</span> : undefined}
        onPick={(k) => {
          setProblem(null);
          if (k === NEW_MARCH) {
            setNaming(true);
            return;
          }
          setNaming(false);
          if (k === current) return;
          void doors.march('march_set', m.block_id, { march_key: k }).then((r) => {
            if (!r.ok) setProblem(r.error);
            else onPatch({ march_key: k === NOT_A_MARCH ? null : k });
          });
        }}
        data="moment-march"
      />
      {naming ? (
        <TypedRow
          name="March name"
          value=""
          empty="Grand Entrance"
          maxLength={MARCH_NAME_MAX}
          required
          check={(t) => {
            const n = marchNameFrom(t);
            return n.ok ? null : n.error;
          }}
          onKeep={async (t) => {
            const n = marchNameFrom(t);
            if (!n.ok) return { ok: false, error: n.error };
            const r = await doors.march('march_new', m.block_id, { march_name: n.name });
            if (!r.ok) return { ok: false, error: r.error };
            onMarches({ key: r.value, label: n.name });
            onPatch({ march_key: r.value });
            setNaming(false);
            return { ok: true };
          }}
          data="moment-march-name"
        />
      ) : null}
    </>
  );
}
