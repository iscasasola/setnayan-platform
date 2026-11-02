'use client';

import { createContext, useContext, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { CalendarPlus, Plus, Search, Trash2, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { ChosenRow, FormRows, SwitchRow, TypedRow } from '@/app/_components/form-row';
import { TimeRow } from '@/app/_components/form-row-time';
import type { PickOption } from '../../website/editor/_components/pick-menu';
import { normalizeSearchText } from '@/lib/guest-search';
import { crewLines, forKey, forOptions, forPickOf, forPicked, forWords } from '@/lib/moment-for';
import { RIGHT_AFTER_LONG, momentAbove } from '@/lib/moment-order';
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

export type TaskOp = 'task_add' | 'task_save' | 'task_remove';
type Answer<T> = { ok: true; value: T } | { ok: false; error: string };

export type MomentDoors = {
  /**
   * ⏭ With `rightAfter`, the moment has no clock of its own — it comes right after `follows` (null = first in the
   * chapter); `startIso` is then only its order key and no end is sent (migration 20271302727358).
   */
  create: (blockId: string, chapterId: string, label: string, startIso: string, endIso: string, rightAfter?: { follows: string | null }) => Promise<boolean>;
  save: (blockId: string, fields: Record<string, string>) => Promise<boolean>;
  remove: (blockId: string) => Promise<boolean>;
  task: (op: TaskOp, blockId: string, fields: Record<string, string>) => Promise<Answer<string>>;
  /** 📷 What deleting this moment does to Papic: the items it deletes, and those staying in another chapter. */
  papicCount: (momentId: string, chapterId: string) => Promise<Answer<MomentPapic>>;
  /** 🚶 The moment is a march (`march_set`, `march_key`), or a new one is made for it (`march_new`, `march_name`). */
  march: (op: 'march_set' | 'march_new', blockId: string, fields: Record<string, string>) => Promise<Answer<string>>;
  /** 👷 Suppliers and crew ▾: tick (`on` '1') or untick one supplier or crew on the moment (`for_key`, lib/moment-for.ts). */
  forSet: (blockId: string, fields: { for_key: string; on: '1' | '0' }) => Promise<Answer<string>>;
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
    create: (blockId, chapterId, label, startIso, endIso, rightAfter) =>
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
              : { end_at: endIso.slice(0, 16) }),
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
  onCreate: (label: string, startIso: string, minutes: number, rightAfter: boolean) => Promise<boolean>;
}) {
  const headingId = useContext(LayerHeading);
  const sections = sectionsFor(c);
  const section0 = sections.includes(firstSection) ? firstSection : 'Event';
  const [label, setLabel] = useState('');
  const [when, setWhen] = useState<WhenKey>('at');
  const [start, setStart] = useState<string>(sectionStartFor(c, section0) ?? c.start_at);
  const [minutes, setMinutes] = useState(DEFAULT_MOMENT_MINUTES);
  const [state, setState] = useState<'idle' | 'saving' | 'failed'>('idle');
  const ready = label.trim().length > 0;
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
          {when === 'at' ? (
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
              <MinutesRow
                minutes={minutes}
                onKeep={(n) => {
                  setMinutes(n);
                  return { ok: true };
                }}
              />
            </>
          ) : null}
          {when === 'at' && sections.length > 1 ? (
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
              const ok = await onCreate(label.trim(), start, minutes, when === 'after');
              if (!ok) setState('failed');
            }}
          />
        </div>
      </div>
  );
}

/* ── when: at a time, or right after the one above ────────────────────────────────────────────────────────────── */

type WhenKey = 'at' | 'after';

const WHEN_OPTIONS: PickOption[] = [
  { key: 'at', label: 'At a time' },
  { key: 'after', label: RIGHT_AFTER_LONG },
];

/**
 * ⏭ WHEN ▾ (owner 2026-11-02, 4 additions (1)): a coordinator's timeline writes some moments with no clock — "Bouquet
 * toss" right under "Cake cutting". One dropdown: At a time · Right after the one above. Right after keeps no time of
 * its own, never a guessed one, and moves with the moment above it.
 */
function WhenRow({ value, onPick }: { value: WhenKey; onPick: (k: WhenKey) => void }) {
  return (
    <ChosenRow
      name="When"
      about={{ words: 'Right after the one above has no time of its own. It happens when the moment above it is done, and moves when that one moves. Guests do not see it until it has a time.' }}
      value={value}
      options={WHEN_OPTIONS}
      onPick={(k) => onPick(k === 'after' ? 'after' : 'at')}
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
}: {
  moment: ChapterMoment;
  chapter: Chapter;
  chapters: Chapter[];
  /** Every moment of the event — the clash check reads the whole day. */
  moments: ChapterMoment[];
  /** Every task of the event; null = the tasks could not be read (said, never "none"). */
  tasks: TaskRow[] | null;
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
}) {
  const headingId = useContext(LayerHeading);
  const [stage, setStage] = useState<'details' | 'ask' | 'deleting' | 'failed'>('details');
  useEffect(() => onStage?.(stage !== 'details'), [stage, onStage]);
  const [papic, setPapic] = useState<{ ok: true; value: MomentPapic } | { ok: false } | null>(null);
  const [drafts, setDrafts] = useState<string[]>([]);
  const names = useMemo(() => taskNamesFrom(who), [who]);
  const mine = (tasks ?? []).filter((t) => t.block_id === m.block_id).sort((a, b) => a.sort_order - b.sort_order);
  const clashes = useMemo(
    () => clashesForMoment(m.block_id, tasks ?? [], moments.map(clashMomentOf), chapters, names),
    [m.block_id, tasks, moments, chapters, names],
  );
  const minutes = minutesBetween(m.start_at, m.end_at) ?? DEFAULT_MOMENT_MINUTES;
  const section = momentSection(m.start_at, c);
  // ⏭ "Right after the one above" (no clock) or "At a time". Picking At a time saves nothing until a time is typed —
  // the order key it holds is its anchor's start, never a time to keep.
  const [when, setWhen] = useState<WhenKey>(m.time_tba ? 'after' : 'at');
  useEffect(() => setWhen(m.time_tba ? 'after' : 'at'), [m.time_tba]);
  const untimed = m.time_tba;
  const sections = sectionsFor(c);
  const roomOf = m.spot ?? (m.location ? null : c.spot);

  const keep = async (fields: Record<string, string>, next: Partial<ChapterMoment>) => {
    const ok = await doors.save(m.block_id, fields);
    if (!ok) return NOT_SAVED;
    onPatch(next);
    return { ok: true as const };
  };

  /** A new start keeps the moment's length. On a moment with no clock yet, it is now timed and follows nothing. */
  const moveTo = (startIso: string) => {
    const endIso = shiftWall(startIso, minutes);
    return untimed
      ? keep(
          { start_at: startIso.slice(0, 16), end_at: endIso.slice(0, 16), time_tba: '0' },
          { start_at: startIso, end_at: endIso, time_tba: false, follows_block_id: null },
        )
      : keep({ start_at: startIso.slice(0, 16), end_at: endIso.slice(0, 16) }, { start_at: startIso, end_at: endIso });
  };

  /** ⏭ Right after the one above: the moment directly above it in this chapter's run (none = first). */
  const goRightAfter = async () => {
    const above = momentAbove(moments.filter((x) => x.parent_block_id === m.parent_block_id), m.block_id);
    const r = await keep(
      { time_tba: '1', ...(above ? { follows_block_id: above.block_id } : {}) },
      { time_tba: true, end_at: null, is_public: false, follows_block_id: above?.block_id ?? null, start_at: above?.start_at ?? c.start_at },
    );
    if (!r.ok) setWhen('at');
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
        {stage === 'details' ? (
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
                }}
              />
              {when === 'at' ? (
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
              <ForRow moment={m} who={who} tasks={tasks} doors={doors} onPatch={onPatch} onTasks={onTasks} />
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
                      doors={doors}
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
                      doors={doors}
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
                  {m.label} wasn’t deleted. Nothing was changed — try again.
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
  onSaved,
  onRemoved,
}: {
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
