'use client';

/**
 * 📖 CHAPTERS LIVE ON THE SCHEDULE PAGE (owner 2026-11-01, DECISION_LOG "CHAPTERS LIVE ON THE SCHEDULE PAGE, NOT EVENT
 * SETTINGS": *"Why is the chapters there? Shouldn't it be in schedules?"*; corpus SCHEDULE_CHAPTERS_BUILD_PLAN §3
 * "Clean slate → blow by blow" · "Getting around" · "Editing and deleting a chapter", §12 Step 3; approved prototype
 * `prototypes/schedule_chapters_2026-11-01/` — `chBody`, `viewPick`, `thumb`).
 *
 * One page that gets deeper only when opened:
 *   · Event Day — the shipped hour rail draws the chapters, with the time between them; "+ Add a chapter" asks only a
 *     name and a time (`day-rail.tsx`, fed by `useChapters`). A chapter with no time yet is listed under the rail as
 *     "Time TBA". A chapter dated before the day lives in Planning Stage (`PlanningChapters`).
 *   · A tapped chapter opens ITS page, here: one top row — ‹ back (to Event Day or Planning Stage, by its date) · the
 *     page's dropdown listing every chapter plus + New chapter — then its time and place line, then Ingress · Event ·
 *     Egress with one open at a time, each its moments as a list. Edit in the thumb row, or a tap on the time and place
 *     line, opens Chapter details (`chapter-sheets.tsx`), which saves on ✕ or a tap outside (the Form Row rule) and
 *     holds Delete chapter at its foot.
 *
 * 📖 STEP 3b — MOMENTS AND THEIR PARALLEL TASKS (plan §3 "Moments work the same way", §3c): + Add a moment in the thumb
 * row and a tap on any moment open the moment sheet (`moment-sheets.tsx`) — the moment's own fields, its tasks (one per
 * supplier, crew, role, group or person, each with what they do and a place), a clash flagged, and Delete moment.
 * Each moment's row says how many tasks it holds and in how many places, and flags a clash. Nothing here is seen by a
 * guest unless a host turns on Visible to guests.
 *
 * 🛑 A FAILED READ IS SAID, NEVER DRAWN AS NO CHAPTERS (`{ measured: false }`).
 * 🔒 app/dashboard/[eventId]/schedule/chapters-live-on-the-schedule.test.ts
 */
import type { ChapterCount } from '@/lib/invitation-chapters';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Eye, EyeOff, Pencil, Plus, Settings, Trash2, X } from 'lucide-react';
import { ActionButton, actionButtonClass } from '@/components/action-button';
import { useThumbRoom } from '@/lib/thumb-room';
import {
  TIME_TBA,
  chapterStage,
  chapterWhen,
  chapterWhere,
  clashesForMoment,
  clockWords,
  egressAt,
  ingressAt,
  momentSection,
  shiftWall,
  tasksLine,
  wallDay,
  wallTime,
  wallIso,
  wallLocal,
  type Chapter,
  type ChapterSection,
  type MarchList,
  type TaskPeople,
  type TaskRow,
} from '@/lib/schedule-chapters';
import { EVERYONE, type ViewAsInput, type ViewLens } from '@/lib/schedule-view-as';
import { inRunOrder, momentAbove, momentClockWords } from '@/lib/moment-order';
import type { TimeShape } from '@/lib/time-shape';
import type { TaskContact } from '@/lib/task-contact';
import { PickMenu } from '../../website/editor/_components/pick-menu';
import { Tip } from './day-ui';
import { ViewAsMenu } from './schedule-view-as';
import { ChaptersContext, useChapters, type ChaptersApi as Api } from './chapters-context';
import { ChapterDeleteWords, ChapterSheet, DoneWarningBox, LAB_CHAPTER_DOORS, NewChapterSheet, newChapter, realChapterDoors, type ChapterDoors } from './chapter-sheets';
import { newDoneWarnings, shopNamesOf, timesThatStay, type DoneWarning } from '@/lib/schedule-hand-in-hand';
import { PeekToast } from '@/app/_components/toast/peek-toast';
import { SchedulePeople } from './schedule-people';
import { chapterMove, draggedStart, type ChapterMove } from '@/lib/chapter-move';
import { formatCount } from '@/lib/format-number';
import { Sheet } from '@/app/_components/sheet';
import { LAB_MOMENT_DOORS, MomentLayer, MomentSheet, NewMomentSheet, clashMomentOf, realMomentDoors, taskNamesFrom } from './moment-sheets';
import type { HostAsk } from '@/lib/schedule-ask';
import { AskSupplierSection } from './ask-supplier-section';

const HELD_HOURS_TIP =
  'The venue booked to this chapter sets its hours, including setup and pack-up. Ask them to change; they answer on their schedule. Take the venue off this chapter and you set the hours yourself.';
import { BACKSTAGE_TIP, BACKSTAGE_WORDS, CHAPTER_SUPPLIERS_TIP, chapterSupplierLine, chapterSuppliers, heldHoursLine, type ChapterSupplier } from '@/lib/schedule-chapters';

/** A moment as a chapter's page lists it — a child block, with who is on it in words, and what its sheet edits. */
export type ChapterMoment = {
  block_id: string;
  parent_block_id: string;
  label: string;
  start_at: string;
  end_at: string | null;
  /** Its own venue (rare — a moment normally follows its chapter's). */
  location: string | null;
  /** Its room: the default place of every task in it (§3c #2). */
  spot: string | null;
  notes: string | null;
  /** "If kept" (§3c #6). */
  is_optional: boolean;
  /** A travel moment: from → to (§3c #4); `travel_to` set = a trip. */
  travel_from: string | null;
  travel_to: string | null;
  /** 🚶 Which march it is (migration 20271301571290): null = not a march · 'entourage' · an own march's key. */
  march_key: string | null;
  is_public: boolean;
  /** "Lumina Studio" · "Bride's family, Alyssa" — the suppliers or party on it; '' for none. */
  who: string;
  /** 👷 The suppliers it is for (`responsible_vendor_ids`) — "yours" on their day; Suppliers and crew ▾ ticks them. */
  vendor_ids: string[];
  /** ⏭ No clock of its own — "right after the one above" (migration 20271302727358); `start_at` is only its order key. */
  time_tba: boolean;
  /** ⏭ The moment it comes right after; null when timed (or first in its chapter). */
  follows_block_id: string | null;
  /** 🕑 "About 3:15 PM" · "2:15/2:30 PM" — how its clock is meant (migration 20271303051692). */
  time_shape: TimeShape;
  /** 🕑 On 'or': the second time, minutes after its start. */
  time_or_minutes: number | null;
};

/** Who a task can name: the event's booked suppliers, its people (null = that read failed — said), and the crews used. */
export type TaskWhoList = {
  /** `trade` ("Photographer") and `everyChapter` (a coordinator) feed a chapter's "Suppliers in this chapter". `locked` 🔒 —
   *  the supplier pressed Lock my times (audit D7): the moment sheet says so before a change. */
  suppliers: { id: string; name: string; trade?: string | null; everyChapter?: boolean; locked?: boolean }[];
  people: TaskPeople | null;
  crews: { vendorId: string; crew: string }[];
};

/** "Bituin Catering" → "BC". */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? '') + (words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : (words[0]?.[1] ?? ''))).toUpperCase();
}

export type ChaptersInput =
  | {
      measured: true;
      chapters: Chapter[];
      moments: ChapterMoment[];
      /** Every moment's parallel tasks; null = the read failed (the moment sheet says so, never "no tasks"). */
      tasks: TaskRow[] | null;
      /** 📇 Each task's contact by task id (4 additions (3)); null = the read failed (said, never "no contact"). */
      contacts: Record<string, TaskContact> | null;
      /** Who a task can name. */
      who: Omit<TaskWhoList, 'crews'>;
      /** 🚶 The couple's own marches (Guests › March) for "This is a march"; `ok: false` = unread (said). */
      marches: MarchList;
      /** What the event's Wedding March itself is called in that dropdown. */
      wholeMarch: string;
      /** The event's own venues by name — Where offers them first. */
      venues: string[];
      /** The event's first day (`YYYY-MM-DD`): before it a chapter lives in Planning Stage; null = no exact day yet. */
      eventDay: string | null;
      /** The event's last day — chapters stop there; null = no cap. */
      lastDay: string | null;
      /** May make and change chapters (a host, or the coordinator with Edit on the Schedule). */
      canEdit: boolean;
      /** May put a chapter on the invitation (a host or the coordinator). */
      mayInvite: boolean;
      /** ✉ Replies per chapter on the invitation (Step 5); a chapter whose count could not be read is `null`. */
      replyCounts?: Record<string, ChapterCount | null>;
      /** 👁 The rail's View as ▾ (Step 3c) — its data and whether the event owns it; absent = none drawn. */
      viewAs?: ViewAsInput | null;
      /** 🗓 The hosts' and the coordinator's asks of suppliers (D2); null = the read failed (said on the moment sheet). */
      asks?: HostAsk[] | null;
      /** 📋 Booked suppliers with no chapter yet, by the chapters their trade usually serves (slice 8, dashed faces). */
      picking?: Record<string, string[]>;
    }
  | { measured: false };

/** The views a chapter's page can go back to — the frame follows `?view=` on popstate (`schedule-one-line.tsx`). */
type BackTo = 'event-day' | 'preparation';

function showScheduleView(view: BackTo) {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get('view') === view) return;
    url.searchParams.set('view', view);
    window.history.replaceState(window.history.state, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
  } catch {
    // No history — the page stays on the view it was on.
  }
}

const sortChapters = (cs: readonly Chapter[]) =>
  [...cs].sort((a, b) => (a.start_at < b.start_at ? -1 : a.start_at > b.start_at ? 1 : a.label.localeCompare(b.label)));

export function ChaptersHost({
  eventId,
  input,
  dateLine,
  lab = false,
  labOpen = null,
  children,
}: {
  eventId: string;
  input: ChaptersInput;
  /** "Friday 18 December 2026 · 47 days to go" — the chapter page keeps the Schedule's date line. */
  dateLine: string;
  /** 🧪 `/dev/schedule-chapters-lab`: the same page and sheets, doors that write nothing. */
  lab?: boolean;
  /** 🧪 The lab only: open on this chapter's page with this moment's sheet up (`?moment=1`) — a phone can be shown it
   *  by a link, with no tap. */
  labOpen?: { chapter: string; moment: string } | null;
  children: ReactNode;
}) {
  const doors = useMemo(() => (lab ? LAB_CHAPTER_DOORS : realChapterDoors(eventId)), [eventId, lab]);
  const momentDoors = useMemo(() => (lab ? LAB_MOMENT_DOORS : realMomentDoors(eventId)), [eventId, lab]);
  const [chapters, setChapters] = useState<Chapter[]>(input.measured ? input.chapters : []);
  const [moments, setMoments] = useState<ChapterMoment[]>(input.measured ? input.moments : []);
  const [tasks, setTasks] = useState<TaskRow[] | null>(input.measured ? input.tasks : null);
  const [contacts, setContacts] = useState<Record<string, TaskContact> | null>(input.measured ? input.contacts : null);
  const [marches, setMarches] = useState<MarchList>(input.measured ? input.marches : { ok: false });
  const [asks, setAsks] = useState<HostAsk[] | null | undefined>(input.measured ? input.asks : undefined);
  const [openId, setOpenId] = useState<string | null>(lab && labOpen ? labOpen.chapter : null);
  /** 🔎 The day narrowed to one chapter from the "N chapters" door (slice 8). */
  const [dayFilter, setDayFilter] = useState<string | null>(null);
  /** ↕ The desktop board's last drag (slice 10): its Undo, or the failure said in words. */
  const [moved, setMoved] = useState<{ id: string; label: string; back: ChapterMove } | { failed: string } | null>(null);
  /** ⚠ A drag that runs a chapter past a supplier's "is done" waits here for an answer (rule 2 — the sheet's gate). */
  const [dragWarn, setDragWarn] = useState<{ id: string; label: string; keepWords: string; lines: DoneWarning[]; save: () => void } | null>(null);
  /** 🗓 The supplier times that STAYED in the last move — marked "stays" on the chapter's page until the next visit. */
  const [stayed, setStayed] = useState<ReadonlySet<string>>(() => new Set());
  const [sheet, setSheet] = useState<'new' | 'edit' | null>(null);
  const [momentSheet, setMomentSheet] = useState<{ kind: 'new'; section: ChapterSection } | { kind: 'edit'; id: string } | null>(
    lab && labOpen ? { kind: 'edit', id: labOpen.moment } : null,
  );
  const [momentDeleting, setMomentDeleting] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  /* 🗑 DELETE, WITH UNDO (owner 2026-11-03, prototype frames 3–4): a deleted chapter is gone from the page AT ONCE and
     "<chapter> deleted · Undo" peeks for the toast's undo window. The write is sent only when that window closes (or
     the page is left), so Undo writes nothing and loses nothing — the moments, tasks, replies and supplier parts the
     database would cascade away are never touched. Closing the tab inside the window keeps the chapter: the safe way
     round. A refused write brings the chapter back and says so. */
  /* 👤 ⚙ The page's one View as and its Schedule settings (owner 2026-11-04, prototype frames 1–2). The settings parts
     are handed up by the one line and the rail; they are kept in a ref so handing them up never re-renders the page,
     and the open sheet redraws when one changes. */
  const [lens, setLens] = useState<ViewLens>(EVERYONE);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsParts = useRef<{ line: ReactNode; tools: ReactNode; needs: ReactNode }>({ line: null, tools: null, needs: null });
  const [, redrawSettings] = useState(0);
  const settingsOpenRef = useRef(false);
  settingsOpenRef.current = settingsOpen;
  const setSettingsPart = useRef((part: 'line' | 'tools' | 'needs', node: ReactNode) => {
    settingsParts.current = { ...settingsParts.current, [part]: node };
    // The people column (desktop) is always on screen: what needs you redraws it at once.
    if (settingsOpenRef.current || part === 'needs') redrawSettings((n) => n + 1);
  }).current;
  const [deleteAsk, setDeleteAsk] = useState<Chapter | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Chapter | null>(null);
  const [deleteFailed, setDeleteFailed] = useState<string | null>(null);
  const pendingRef = useRef<Chapter | null>(null);
  pendingRef.current = pendingDelete;
  const commitDelete = useRef<(c: Chapter) => void>(() => {});
  commitDelete.current = (c: Chapter) => {
    setPendingDelete((p) => (p?.block_id === c.block_id ? null : p));
    void doors.remove(c.block_id).then((ok) => {
      if (ok) setChapters((cs) => cs.filter((x) => x.block_id !== c.block_id));
      else setDeleteFailed(`${c.label} wasn’t deleted. Nothing was changed — try again.`);
    });
  };
  const deleteNow = (c: Chapter) => {
    // One Undo at a time: a second delete sends the first.
    const before = pendingRef.current;
    if (before && before.block_id !== c.block_id) commitDelete.current(before);
    setDeleteFailed(null);
    setPendingDelete(c);
    if (openId === c.block_id) {
      setOpenId(null);
      setSheet(null);
      showScheduleView(chapterStage(c, input.measured ? input.eventDay : null) === 'planning' ? 'preparation' : 'event-day');
    }
  };
  // Leaving the page (or the tab) inside the window sends the delete the host already confirmed.
  useEffect(() => {
    const send = () => {
      const p = pendingRef.current;
      if (p) commitDelete.current(p);
    };
    window.addEventListener('pagehide', send);
    return () => {
      window.removeEventListener('pagehide', send);
      send();
    };
  }, []);
  /** The sheet's own Delete chapter goes through the same window (its warning and Continue are unchanged). */
  const sheetDoors = useMemo<ChapterDoors>(
    () => ({
      ...doors,
      remove: async (id) => {
        const c = chapters.find((x) => x.block_id === id);
        if (c) deleteNow(c);
        return Boolean(c);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doors, chapters, openId],
  );
  // A fresh server answer (a rail write revalidates the page) supersedes what this page laid on the list.
  useEffect(() => {
    if (!input.measured) return;
    setChapters(input.chapters);
    setMoments(input.moments);
    setTasks(input.tasks);
    setContacts(input.contacts);
    setMarches(input.marches);
    setAsks(input.asks);
  }, [input]);
  const who = useMemo<TaskWhoList>(() => {
    const base = input.measured ? input.who : { suppliers: [], people: null };
    const seen = new Set<string>();
    const crews: TaskWhoList['crews'] = [];
    for (const t of tasks ?? []) {
      if (!t.vendor_id || !t.crew) continue;
      const k = `${t.vendor_id}:${t.crew.trim().toLowerCase()}`;
      if (seen.has(k)) continue;
      seen.add(k);
      crews.push({ vendorId: t.vendor_id, crew: t.crew });
    }
    return { ...base, crews };
  }, [input, tasks]);
  /** 🗓 Each booking's shop name(s) — only "<that shop> arrives / is done" is a supplier's own time (ruling 5574 #7). */
  const shops = useMemo(() => shopNamesOf(who.suppliers), [who]);
  const api = useMemo<Api | null>(
    () =>
      input.measured
        ? {
            chapters: sortChapters(chapters.filter((c) => c.block_id !== pendingDelete?.block_id)),
            eventDay: input.eventDay,
            canEdit: input.canEdit,
            openId,
            open: (id) => {
              setFlash(null);
              setOpenId(id);
              window.scrollTo({ top: 0 });
            },
            add: () => {
              if (input.canEdit) setSheet('new');
            },
            viewAs: input.viewAs ?? null,
            askDelete: (id) => {
              const c = chapters.find((x) => x.block_id === id);
              if (c && input.canEdit) setDeleteAsk(c);
            },
            lens,
            setLens,
            openSettings: () => setSettingsOpen(true),
            setSettingsPart,
            moments: moments.filter((m) => m.parent_block_id !== pendingDelete?.block_id),
            tasks,
            suppliers: who.suppliers,
            picking: input.picking ?? {},
            dayFilter: dayFilter && chapters.some((c) => c.block_id === dayFilter && c.block_id !== pendingDelete?.block_id) ? dayFilter : null,
            setDayFilter,
            moveChapter: (id, minutes) => {
              const c = chapters.find((x) => x.block_id === id);
              if (!c || !input.canEdit || c.time_tba) return;
              const to = draggedStart(c.start_at, minutes);
              const move = chapterMove(c, to.day, to.hhmm, input.lastDay);
              if (!move || move.delta === 0) return;
              const before: Partial<Chapter> = { start_at: c.start_at, end_at: c.end_at, time_tba: c.time_tba };
              const inChapter = moments.filter((m) => m.parent_block_id === id).map((m) => ({ ...m, responsible_vendor_ids: m.vendor_ids }));
              const keptIds = timesThatStay(id, inChapter, shops);
              const save = () => {
                // In place, at once — the page never resets; a refused save puts it back and says so.
                setChapters((cs) => cs.map((x) => (x.block_id === id ? { ...x, ...move.next } : x)));
                void doors.save(id, move.fields).then((ok) => {
                  if (!ok) {
                    setChapters((cs) => cs.map((x) => (x.block_id === id ? { ...x, ...before } : x)));
                    setMoved({ failed: `${c.label} couldn’t be moved. Try again.` });
                    return;
                  }
                  if (keptIds.length > 0) setStayed(new Set(keptIds));
                  const back = chapterMove({ ...c, ...move.next }, wallDay(c.start_at), wallTime(c.start_at), input.lastDay);
                  if (back) setMoved({ id, label: c.label, back });
                });
              };
              // ⚠ RULE 2 on the drag too: the SAME gate as Chapter details (`newDoneWarnings`) — warn, never block.
              const lines = newDoneWarnings(
                { start_at: c.start_at, end_at: c.end_at },
                { start_at: move.next.start_at ?? c.start_at, end_at: move.next.end_at ?? null },
                id,
                inChapter,
                shops,
              );
              if (lines.length === 0) return save();
              setDragWarn({ id, label: c.label, keepWords: clockWords(c.start_at), lines, save });
            },
          }
        : null,
    [chapters, moments, tasks, who, shops, input, openId, pendingDelete, lens, setSettingsPart, dayFilter, doors],
  );

  if (!input.measured || !api) {
    return (
      <>
        <p role="alert" data-chapters-failed="" className="mb-3 text-[13px] font-semibold text-danger-700">
          The chapters couldn’t be read just now. The day below is as it was saved — try again in a moment.
        </p>
        {children}
      </>
    );
  }

  const sorted = sortChapters(chapters.filter((c) => c.block_id !== pendingDelete?.block_id));
  const current = openId && openId !== pendingDelete?.block_id ? (chapters.find((c) => c.block_id === openId) ?? null) : null;
  const openMoment = momentSheet?.kind === 'edit' ? (moments.find((x) => x.block_id === momentSheet.id) ?? null) : null;
  // ⚠ The moments with a task in two places at once (§3c #5) — flagged on their rows, never refused.
  const clashedMoments = new Set<string>();
  if (current && tasks) {
    const names = taskNamesFrom(who);
    const all = moments.map(clashMomentOf);
    for (const mo of moments) {
      if (mo.parent_block_id !== current.block_id) continue;
      if (clashesForMoment(mo.block_id, tasks, all, chapters, names).size > 0) clashedMoments.add(mo.block_id);
    }
  }
  /** 👷 Who a delete takes off their parts: the suppliers on the chapter itself, on its moments, or on a task in them. */
  const suppliersOn = (c: Chapter): string[] =>
    chapterSuppliers(c, moments, tasks, who.suppliers).filter((s) => !s.everyChapter).map((s) => s.name);
  const patch = (id: string, next: Partial<Chapter>) => setChapters((cs) => cs.map((c) => (c.block_id === id ? { ...c, ...next } : c)));
  const back = (c: Chapter | null) => {
    setOpenId(null);
    setSheet(null);
    if (c) showScheduleView(chapterStage(c, input.eventDay) === 'planning' ? 'preparation' : 'event-day');
    window.scrollTo({ top: 0 });
  };

  return (
    <ChaptersContext.Provider value={api}>
      {/* 🖥 SLICE 10 — ONE PAGE, THREE WIDTHS. A phone and an iPad in portrait: the day, and a chapter's page laid over it.
          An iPad in landscape: the day BESIDE the opened chapter. A desktop: the day · the chapter · the people. The
          views stay mounted (each drawn once by the server) — opening a chapter is never a request. */}
      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_17rem]" data-schedule-panes="">
      <div className={current ? 'min-w-0 max-lg:hidden' : 'min-w-0'} data-schedule-day-pane="">
        {children}
      </div>
      <div className={current ? 'min-w-0' : 'hidden min-w-0 lg:block'} data-schedule-chapter-pane="">
      {current ? (
        <ChapterPage
          key={`page:${current.block_id}`}
          chapter={current}
          chapters={sorted}
          moments={moments.filter((m) => m.parent_block_id === current.block_id)}
          tasks={tasks}
          clashed={clashedMoments}
          eventDay={input.eventDay}
          canEdit={input.canEdit}
          flash={flash}
          onBack={() => back(current)}
          onPick={(key) => {
            if (key === 'new') return api.add();
            if (key === 'event-day' || key === 'preparation') {
              setOpenId(null);
              showScheduleView(key);
              return;
            }
            api.open(key);
          }}
          onEdit={() => setSheet('edit')}
          onAddMoment={(section) => setMomentSheet({ kind: 'new', section })}
          onOpenMoment={(id) => setMomentSheet({ kind: 'edit', id })}
          stayed={stayed}
          suppliers={chapterSuppliers(current, moments, tasks, who.suppliers)}
          viewAs={input.viewAs ? { input: input.viewAs, lens, setLens } : null}
          onSettings={() => setSettingsOpen(true)}
          held={
            current.hours_vendor_id
              ? {
                  vendorId: current.hours_vendor_id,
                  name: who.suppliers.find((x) => x.id === current.hours_vendor_id)?.name ?? 'The venue',
                  asMoment: { block_id: current.block_id, start_at: current.start_at, end_at: current.end_at, vendor_ids: [current.hours_vendor_id] },
                  asks,
                  ask: momentDoors.ask,
                  onAsked: (row) => setAsks((a) => [row, ...(a ?? [])]),
                }
              : null
          }
        />
      ) : (
        <p className="pt-16 text-center text-[14px] text-ink/55" data-schedule-chapter-empty="">
          Open a chapter to see it here.
        </p>
      )}
      </div>
      <aside className="hidden min-w-0 xl:block" data-schedule-people="">
        <SchedulePeople needs={settingsParts.current.needs} />
      </aside>
      </div>

      {/* ONE sheet for a moment — Add swaps the new moment's body for the moment's own, never a second sheet. */}
      {momentSheet && current && (momentSheet.kind === 'new' || openMoment) ? (
        <MomentLayer
          title={momentSheet.kind === 'new' ? 'New moment' : momentDeleting ? 'Delete moment' : 'Moment'}
          onClose={() => {
            setMomentSheet(null);
            setMomentDeleting(false);
          }}
        >
          {momentSheet.kind === 'new' ? (
        <NewMomentSheet
          key={`new-moment:${current.block_id}`}
          chapter={current}
          section={momentSheet.section}
          onClose={() => setMomentSheet(null)}
          onCreate={async (label, startIso, minutes, rightAfter, shape) => {
            const blockId = crypto.randomUUID();
            // ⏭ Right after: no clock of its own — after the chapter's last moment, its start only an order key.
            const above = rightAfter ? momentAbove(moments.filter((x) => x.parent_block_id === current.block_id), null) : null;
            const keyIso = rightAfter ? (above?.start_at ?? current.start_at) : startIso;
            const endIso = shiftWall(startIso, minutes);
            const ok = await momentDoors.create(blockId, current.block_id, label, keyIso, endIso, rightAfter ? { follows: above?.block_id ?? null } : undefined, rightAfter ? undefined : shape);
            if (!ok) return false;
            setMoments((ms) => [
              ...ms,
              {
                block_id: blockId,
                parent_block_id: current.block_id,
                label,
                start_at: keyIso,
                end_at: rightAfter ? null : endIso,
                time_tba: rightAfter,
                follows_block_id: above?.block_id ?? null,
                time_shape: rightAfter ? 'at' : shape.shape,
                time_or_minutes: rightAfter ? null : shape.orMinutes,
                location: null,
                spot: null,
                notes: null,
                is_optional: false,
                travel_from: null,
                travel_to: null,
                march_key: null,
                is_public: false,
                who: '',
                vendor_ids: [],
              },
            ]);
            patch(current.block_id, { moments: current.moments + 1 });
            // The prototype's Add then shows the moment: its sheet is where the tasks are set.
            setMomentSheet({ kind: 'edit', id: blockId });
            return true;
          }}
        />
          ) : openMoment ? (
        <MomentSheet
          key={`moment:${openMoment.block_id}`}
          moment={openMoment}
          chapter={current}
          chapters={chapters}
          moments={moments}
          tasks={tasks}
          contacts={contacts}
          onContact={(taskId, c) =>
            setContacts((all) => {
              const next = { ...(all ?? {}) };
              if (c) next[taskId] = c;
              else delete next[taskId];
              return next;
            })
          }
          who={who}
          mayShowGuests={input.mayInvite}
          marches={marches}
          wholeMarch={input.measured ? input.wholeMarch : ''}
          onMarches={(made) => setMarches((l) => (l.ok ? { ok: true, marches: [...l.marches, made] } : l))}
          doors={momentDoors}
          onPatch={(next) => setMoments((ms) => ms.map((x) => (x.block_id === openMoment.block_id ? { ...x, ...next } : x)))}
          onTasks={setTasks}
          onClose={() => setMomentSheet(null)}
          onStage={setMomentDeleting}
          asks={asks}
          onAsked={(row) => setAsks((l) => (l ? [row, ...l] : l))}
          onDeleted={() => {
            setMoments((ms) => ms.filter((x) => x.block_id !== openMoment.block_id));
            setTasks((ts) => (ts ? ts.filter((t) => t.block_id !== openMoment.block_id) : ts));
            patch(current.block_id, { moments: Math.max(0, current.moments - 1) });
            setMomentSheet(null);
            setMomentDeleting(false);
            setFlash(`${openMoment.label} is deleted.`);
          }}
        />
          ) : null}
        </MomentLayer>
      ) : null}

      {sheet === 'new' ? (
        <NewChapterSheet
          lastDay={input.lastDay}
          onClose={() => setSheet(null)}
          onCreate={async (label, day, hhmm) => {
            const tba = hhmm === '';
            const clock = tba ? '00:00' : hhmm;
            const startLocal = wallLocal(day, clock);
            const startIso = wallIso(day, clock);
            if (!startLocal || !startIso) return false;
            const blockId = crypto.randomUUID();
            const ok = await doors.create(blockId, label, startLocal, tba);
            if (!ok) return false;
            setChapters((cs) => [...cs, newChapter(blockId, label, startIso, tba)]);
            setSheet(null);
            // The prototype opens the new chapter: its page is where the rest is set.
            setOpenId(blockId);
            setFlash(`${label} is added. Press Edit to set its venue and the rest.`);
            window.scrollTo({ top: 0 });
            return true;
          }}
        />
      ) : null}

      {sheet === 'edit' && current ? (
        <ChapterSheet
          key={`sheet:${current.block_id}`}
          chapter={current}
          venues={input.venues}
          used={chapters.map((c) => c.location).filter((v): v is string => Boolean(v))}
          lastDay={input.lastDay}
          mayInvite={input.mayInvite}
          replyCount={input.replyCounts?.[current.block_id]}
          doors={sheetDoors}
          heldBy={current.hours_vendor_id ? (who.suppliers.find((x) => x.id === current.hours_vendor_id)?.name ?? 'The venue') : null}
          deleteSuppliers={suppliersOn(current)}
          moments={moments.filter((m) => m.parent_block_id === current.block_id)}
          shops={shops}
          onStayed={(ids) => setStayed(new Set(ids))}
          onAsk={(momentId) => {
            setSheet(null);
            setMomentSheet({ kind: 'edit', id: momentId });
          }}
          onPatch={(next) => patch(current.block_id, next)}
          onClose={() => setSheet(null)}
          onDeleted={() => back(current)}
        />
      ) : null}

      {/* ⚙ SCHEDULE SETTINGS — the date line and its ⓘ, Announce, Share, and the day's tools, in one sheet. */}
      {settingsOpen ? (
        <Sheet open onClose={() => setSettingsOpen(false)} labelledById="schedule-settings-h" title="Schedule settings">
          <div data-schedule-settings="" className="flex flex-col gap-3 px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-2" onClickCapture={(e) => {
            // A tool that opens its own sheet closes this one first.
            if ((e.target as HTMLElement).closest('[data-settings-closes]')) setSettingsOpen(false);
          }}>
            <h3 id="schedule-settings-h" className="sr-only">
              Schedule settings
            </h3>
            {settingsParts.current.line}
            {settingsParts.current.tools}
          </div>
        </Sheet>
      ) : null}

      {/* 🗑 A swipe left on the rail asks here — the SAME words as the chapter's own Delete chapter. */}
      {deleteAsk ? (
        <Sheet open onClose={() => setDeleteAsk(null)} labelledById={`swipe-delete-${deleteAsk.block_id}`} title={`Delete ${deleteAsk.label}?`}>
          <div data-chapter-swipe-delete={deleteAsk.block_id} className="flex flex-col gap-3 px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-2">
            <h3 id={`swipe-delete-${deleteAsk.block_id}`} className="sr-only">
              Delete {deleteAsk.label}?
            </h3>
            <p className="text-[15px] text-ink">
              <ChapterDeleteWords c={deleteAsk} suppliers={suppliersOn(deleteAsk)} />
            </p>
            <div className="flex justify-end gap-2">
              <ActionButton tone="neutral" icon={X} label="Cancel" quiet onClick={() => setDeleteAsk(null)} />
              <ActionButton
                tone="danger"
                main
                icon={Trash2}
                label="Delete"
                data-testid="chapter-swipe-delete-continue"
                onClick={() => {
                  const c = deleteAsk;
                  setDeleteAsk(null);
                  deleteNow(c);
                }}
              />
            </div>
          </div>
        </Sheet>
      ) : null}

      {/* ⚠ A drag past a supplier's "is done" — the same box as Chapter details: Ask, Save anyway, Keep <time>. Closing
          it keeps the chapter where it was; nothing is written. */}
      {dragWarn ? (
        <Sheet open onClose={() => setDragWarn(null)} labelledById={`drag-warn-${dragWarn.id}`} title={`Move ${dragWarn.label}?`}>
          <div data-chapter-drag-warning={dragWarn.id} className="flex flex-col gap-3 px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-2">
            <h3 id={`drag-warn-${dragWarn.id}`} className="sr-only">
              Move {dragWarn.label}?
            </h3>
            <DoneWarningBox
              lines={dragWarn.lines}
              keepWords={dragWarn.keepWords}
              onAsk={(first) => {
                setDragWarn(null);
                setMomentSheet({ kind: 'edit', id: first.blockId });
              }}
              onSaveAnyway={() => {
                const w = dragWarn;
                setDragWarn(null);
                w.save();
              }}
              onKeep={() => setDragWarn(null)}
            />
          </div>
        </Sheet>
      ) : null}

      {moved && 'back' in moved ? (
        <PeekToast
          key={`moved:${moved.id}:${moved.back.fields.start_at}`}
          tone="ok"
          data="chapter-moved"
          action={{
            label: 'Undo',
            onPress: () => {
              const { id, back } = moved;
              setMoved(null);
              setChapters((cs) => cs.map((x) => (x.block_id === id ? { ...x, ...back.next } : x)));
              void doors.save(id, back.fields);
            },
          }}
          onGone={() => setMoved(null)}
        >
          {moved.label} moved
        </PeekToast>
      ) : moved ? (
        <PeekToast tone="bad" data="chapter-move-failed" onGone={() => setMoved(null)}>
          {moved.failed}
        </PeekToast>
      ) : null}
      {pendingDelete ? (
        <PeekToast
          key={`deleted:${pendingDelete.block_id}`}
          tone="ok"
          data="chapter-deleted"
          action={{ label: 'Undo', onPress: () => setPendingDelete(null) }}
          onGone={() => {
            const p = pendingRef.current;
            if (p) commitDelete.current(p);
          }}
        >
          {pendingDelete.label} deleted
        </PeekToast>
      ) : deleteFailed ? (
        <PeekToast tone="bad" data="chapter-delete-failed" onGone={() => setDeleteFailed(null)}>
          {deleteFailed}
        </PeekToast>
      ) : null}
    </ChaptersContext.Provider>
  );
}

/* ── a chapter's page ────────────────────────────────────────────────────────────────────────────────────────── */

const SECTION_LETTER: Record<ChapterSection, string> = { Ingress: 'I', Event: 'E', Egress: 'E' };

function ChapterPage({
  chapter: c,
  chapters,
  moments,
  tasks,
  clashed,
  eventDay,
  canEdit,
  flash,
  onBack,
  onPick,
  onEdit,
  onAddMoment,
  onOpenMoment,
  stayed,
  suppliers = [],
  held = null,
  viewAs = null,
  onSettings,
}: {
  /** 🏛 The venue holding this chapter's hours, and the shipped ask to send it. */
  held?: {
    vendorId: string;
    name: string;
    asMoment: Pick<ChapterMoment, 'block_id' | 'start_at' | 'end_at' | 'vendor_ids'>;
    asks: HostAsk[] | null | undefined;
    ask: ((blockId: string, fields: Record<string, string>) => Promise<{ ok: true; value: string } | { ok: false; error: string }>) | null;
    onAsked: (row: HostAsk) => void;
  } | null;
  /** 👷 The suppliers in this chapter (on it, its moments or their tasks) and the coordinators (every chapter). */
  suppliers?: readonly ChapterSupplier[];
  /** 👤 The page's one View as (shared with Event Day); null = none drawn here. */
  viewAs?: { input: ViewAsInput; lens: ViewLens; setLens: (l: ViewLens) => void } | null;
  /** ⚙ Opens Schedule settings. */
  onSettings: () => void;
  chapter: Chapter;
  chapters: Chapter[];
  moments: ChapterMoment[];
  tasks: TaskRow[] | null;
  /** The moments with a task in two places at once. */
  clashed: ReadonlySet<string>;
  eventDay: string | null;
  canEdit: boolean;
  flash: string | null;
  onBack: () => void;
  onPick: (key: string) => void;
  onEdit: () => void;
  onAddMoment: (section: ChapterSection) => void;
  onOpenMoment: (id: string) => void;
  /** 🗓 The supplier times that stayed in the last move — a small "stays" under their clock (approved prototype). */
  stayed?: ReadonlySet<string>;
}) {
  /* 🎭 Ingress · Event · Egress are all OPEN (owner 2026-11-04, prototype frame 2: "Ingress and Egress are open, one line
     per supplier, marked Backstage"); a tap folds or unfolds one. `open` is the section last tapped — + Add a moment
     goes there. */
  const [open, setOpen] = useState<ChapterSection>('Event');
  const [shut, setShut] = useState<ReadonlySet<ChapterSection>>(() => new Set());
  const ingress = ingressAt(c);
  const egress = egressAt(c);
  const bySection = (k: ChapterSection) =>
    // ⏭ In the run's order — a moment "right after the one above" sits directly under it (lib/moment-order.ts).
    inRunOrder(moments.filter((m) => momentSection(m.start_at, c) === k));
  // Ingress and Egress are optional (owner: *"not placing a time means no ingress"*): a section shows when it has a time,
  // or when a line already sits in it — then it says "no time set", so nothing is hidden.
  const sections: { key: ChapterSection; sub: string; rows: ChapterMoment[] }[] = [];
  const inRows = bySection('Ingress');
  if (!c.time_tba && (ingress || inRows.length)) sections.push({ key: 'Ingress', sub: ingress ? `from ${clockWords(ingress)}` : 'no time set', rows: inRows });
  // 📐 The Event's own hours, as the prototype draws it (frame 2: "Event 5:00 PM – 10:00 PM · 4").
  sections.push({
    key: 'Event',
    sub: c.time_tba ? TIME_TBA : `${clockWords(c.start_at)}${c.end_at ? ` – ${clockWords(c.end_at)}` : ' onward'}`,
    rows: bySection('Event'),
  });
  const egRows = bySection('Egress');
  if (!c.time_tba && (egress || egRows.length)) sections.push({ key: 'Egress', sub: egress ? `until ${clockWords(egress)}` : 'no time set', rows: egRows });

  const line = `${chapterWhen(c)} · ${chapterWhere(c)}`;
  const about = [
    c.notes ? `Notes: ${c.notes}.` : null,
    c.time_tba ? 'No call time until the time is set.' : `Call time: ${c.call_lead_minutes} minutes before each person’s first task.`,
    // 👁 Who sees this chapter lives here, in its ⓘ — never an eye on the day's rows (slice 8).
    c.on_invitation
      ? 'Who sees it: guests — it is on the invitation and they reply to it. Its Backstage moments stay hidden from them.'
      : 'Who sees it: you, your coordinator and its suppliers. It is not on the invitation, so guests don’t see it.',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div data-chapter-page={c.block_id} className="pb-28">
      {/* ── THE ONE TOP ROW (owner 2026-11-04, "Match the 4 Nov prototype", frame 2): the page's dropdown (the views,
          + New chapter, every chapter — Event Day is the way back) · what it holds · 👤 View as · ⚙ Schedule settings.
          The chapter's name is the dropdown's own words; no title, no date line below it. */}
      <div className="flex min-h-11 items-center gap-1.5" data-chapter-line="">
        <span className="flex min-w-0 shrink items-center">
          <PickMenu
            label="Page and schedule view"
            value={c.block_id}
            buttonText={c.label}
            options={[
              { key: 'preparation', label: 'Planning Stage', group: 'Schedule' },
              { key: 'event-day', label: 'Event Day', group: 'Schedule' },
              ...(canEdit ? [{ key: 'new', label: '+ New chapter', group: 'Chapters' }] : []),
              ...chapters.map((x) => ({ key: x.block_id, label: x.label, group: 'Chapters' })),
            ]}
            onPick={onPick}
            dataAttr="data-chapter-pick"
            compact
          />
        </span>
        <span className="min-w-0 flex-1 truncate text-[14px] text-ink/60" data-chapter-count="">
          {formatCount(moments.length)} moment{moments.length === 1 ? '' : 's'} · {formatCount(suppliers.length)} supplier{suppliers.length === 1 ? '' : 's'}
        </span>
        {viewAs ? (
          <ViewAsMenu
            input={viewAs.input}
            lens={viewAs.lens}
            round
            onLens={(l) => {
              viewAs.setLens(l);
              // The view is drawn on Event Day.
              if (l.kind !== 'everyone') onBack();
            }}
          />
        ) : null}
        <button
          type="button"
          onClick={onSettings}
          aria-label="Schedule settings"
          data-chapter-settings-open=""
          className="sn-press grid h-11 w-11 flex-none place-items-center rounded-full border border-ink/15 text-ink"
        >
          <Settings aria-hidden className="h-5 w-5" strokeWidth={1.8} />
        </button>
      </div>
      {flash ? (
        <p role="status" data-chapters-flash="" className="mt-2 text-[13px] text-ink/70">
          {flash}
        </p>
      ) : null}

      <p className="mt-1 flex items-center gap-2 text-[14px] text-ink/65" data-chapter-title={c.label}>
        {canEdit ? (
          <button type="button" onClick={onEdit} aria-label="Edit chapter details" data-chapter-when={c.time_tba ? 'tba' : 'set'} className="text-left">
            {line}
          </button>
        ) : (
          <span data-chapter-when={c.time_tba ? 'tba' : 'set'}>{line}</span>
        )}
        <Tip>{about}</Tip>
      </p>

      {/* 🏛 VENUE HOURS (owner 2026-11-04, prototype frame 2): the venue booked to this chapter holds its hours — the
          host asks it to change (the shipped host ask, answered by the venue). With no venue holding them, nothing. */}
      {held ? (
        <div data-chapter-held={c.block_id} className="mt-3 border-t border-ink/10 pt-2">
          <p className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">
            Hours from {held.name} <span aria-label="Held by the venue">🔒</span>
          </p>
          <p className="flex items-center gap-2 text-[13.5px] text-ink/65">
            {heldHoursLine(c)}
            <Tip>{HELD_HOURS_TIP}</Tip>
          </p>
          {canEdit && held.ask ? (
            <AskSupplierSection
              moment={{ ...(held.asMoment as ChapterMoment) }}
              chapter={c}
              suppliers={[{ id: held.vendorId, name: held.name }]}
              asks={held.asks}
              ask={held.ask}
              onAsked={held.onAsked}
              askLabel={`Ask ${held.name} to change`}
              bare
            />
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 border-t border-ink/10" data-chapter-sections="">
        {sections.map((s) => {
          const on = !shut.has(s.key);
          const backstage = s.key !== 'Event';
          return (
            <section key={s.key} data-chapter-section={s.key} data-backstage={backstage ? '' : undefined}>
              <button
                type="button"
                aria-expanded={on}
                onClick={() => {
                  setOpen(s.key);
                  setShut((was) => {
                    const next = new Set(was);
                    if (next.has(s.key)) next.delete(s.key);
                    else next.add(s.key);
                    return next;
                  });
                }}
                className="flex min-h-14 w-full items-center gap-3 border-b border-ink/10 text-left"
              >
                <span
                  aria-hidden
                  className={`grid h-8 w-8 flex-none place-items-center rounded-md text-[13px] font-semibold ${
                    on ? 'bg-sn-accent text-sn-on-accent' : 'bg-ink/10 text-ink/70'
                  }`}
                >
                  {SECTION_LETTER[s.key]}
                </span>
                <span className="text-[16px] font-semibold text-ink">{s.key}</span>
                <span className="min-w-0 flex-1 truncate text-[14px] text-ink/60">
                  {s.sub} · {s.rows.length}
                </span>
                <ChevronDown aria-hidden className={`h-4 w-4 flex-none text-ink/50 transition-transform ${on ? 'rotate-180' : ''}`} />
              </button>
              {on && backstage ? (
                <p data-backstage-line="" className="flex items-center gap-1.5 pt-2 text-[12px] uppercase tracking-[0.06em] text-gold-deep">
                  {BACKSTAGE_WORDS} <Tip>{BACKSTAGE_TIP}</Tip>
                </p>
              ) : null}
              {on ? (
                s.rows.length === 0 ? (
                  <p className="py-3 text-[14px] text-ink/55">Nothing yet.</p>
                ) : (
                  <ul>
                    {s.rows.map((m) => {
                      const mine = (tasks ?? []).filter((t) => t.block_id === m.block_id);
                      // 🎭 A backstage line is one supplier's set-up or pack-up: their hours under their name (frame 2).
                      const sub = backstage
                        ? `${momentClockWords(m, c, clockWords)}${m.end_at && !m.time_tba ? ` – ${clockWords(m.end_at)}` : ''}`
                        : [
                        m.travel_to ? `${m.travel_from ?? 'Here'} → ${m.travel_to}` : null,
                        tasksLine(mine, m, c) || m.who || null,
                        m.is_optional ? 'Optional' : null,
                      ]
                        .filter(Boolean)
                        .join(' · ');
                      const clash = clashed.has(m.block_id);
                      const inner = (
                        <>
                          <span className="w-[4.5rem] flex-none text-[14px] tabular-nums text-ink/80" data-moment-clock={m.time_tba ? 'right-after' : 'time'}>
                            {momentClockWords(m, c, clockWords)}
                            {stayed?.has(m.block_id) ? (
                              <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-gold-deep" data-moment-stayed="">
                                stays
                              </span>
                            ) : null}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[15px] text-ink">{m.label}</span>
                            {sub ? <span className="block truncate text-[13px] text-ink/60">{sub}</span> : null}
                            {clash ? (
                              <span data-moment-clash="" className="block text-[13px] font-semibold text-danger-700">
                                ⚠ Someone is in two places at once
                              </span>
                            ) : null}
                          </span>
                          {s.key === 'Event' ? (
                            m.is_public ? (
                              <Eye aria-label="Shown to guests" className="mt-0.5 h-4 w-4 flex-none text-ink/60" />
                            ) : (
                              <EyeOff aria-label="Hidden from guests" className="mt-0.5 h-4 w-4 flex-none text-ink/40" />
                            )
                          ) : (
                            <EyeOff aria-label="Backstage — guests never see this" className="mt-0.5 h-4 w-4 flex-none text-ink/40" />
                          )}
                        </>
                      );
                      return (
                        <li key={m.block_id} data-chapter-moment={m.block_id} className="border-b border-ink/10">
                          {canEdit ? (
                            <button
                              type="button"
                              onClick={() => onOpenMoment(m.block_id)}
                              aria-label={`Open ${m.label}`}
                              className="sn-press flex min-h-14 w-full items-start gap-4 py-3 text-left"
                            >
                              {inner}
                            </button>
                          ) : (
                            <div className="flex min-h-14 items-start gap-4 py-3">{inner}</div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )
              ) : null}
              {/* ＋ Add a moment at the foot of each open section (prototype frame 2) — into that section. */}
              {on && canEdit ? (
                <button
                  type="button"
                  data-section-add={s.key}
                  onClick={() => onAddMoment(s.key)}
                  className="sn-press flex min-h-11 w-full items-center justify-center border-b border-ink/10 text-[15px] font-semibold text-sn-accent"
                >
                  + Add a moment
                </button>
              ) : null}
            </section>
          );
        })}
      </div>

      {/* 👷 SUPPLIERS IN THIS CHAPTER (owner 2026-11-04, prototype frame 2) — under the moments: who is booked to it, by
          shop name and trade; a coordinator is on every chapter. Shown only when there is someone to show. */}
      {suppliers.length > 0 ? (
        <section data-chapter-suppliers="" className="mt-6">
          <h3 className="flex items-center gap-1.5 pb-1 text-[15px] font-semibold text-ink">
            Suppliers in this chapter <Tip>{CHAPTER_SUPPLIERS_TIP}</Tip>
          </h3>
          <ul>
            {suppliers.map((s) => (
              <li key={s.id} data-chapter-supplier={s.id} className="flex min-h-14 items-center gap-3 border-t border-ink/10 py-2">
                <span aria-hidden className="grid h-11 w-11 flex-none place-items-center rounded-full bg-ink/[0.05] text-[14px] font-semibold text-ink/65">
                  {initialsOf(s.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-ink">{s.name}</span>
                  <span className="block truncate text-[13px] text-ink/60">{chapterSupplierLine(s)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {canEdit ? <ChapterThumbRow onEdit={onEdit} onAddMoment={() => onAddMoment(open)} /> : null}
      {/* 🖥 A desktop's tools are inline (slice 10): Edit · + Add a moment, a right-aligned bar at the chapter's foot. */}
      {canEdit ? (
        <div className="mt-4 hidden justify-end gap-2 border-t border-ink/10 pt-3 xl:flex" data-chapter-foot="">
          <button type="button" onClick={onEdit} className={actionButtonClass('neutral')}>
            <Pencil aria-hidden strokeWidth={2} />
            Edit
          </button>
          <button type="button" onClick={() => onAddMoment(open)} className={actionButtonClass('brand', { main: true })}>
            <Plus aria-hidden strokeWidth={2} />
            Add a moment
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** The chapter page's thumb row — Edit, in the thumb zone above the bottom nav (the prototype's `thumb()`). */
function ChapterThumbRow({ onEdit, onAddMoment }: { onEdit: () => void; onAddMoment: () => void }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  const rowRef = useRef<HTMLDivElement>(null);
  useThumbRoom(rowRef);
  if (!host) return null;
  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--sn-ride-h,var(--sn-bottomdock-h,64px))_+_12px)] z-30 flex justify-end tab:bottom-6 tab:right-[var(--sup-col-right,1.5rem)] tab:left-auto xl:hidden"
      data-chapter-thumb=""
      data-safe-x=""
    >
      <div ref={rowRef} className="pointer-events-auto mx-4 flex gap-2">
        <button type="button" onClick={onEdit} data-chapter-edit="" className={actionButtonClass('neutral')}>
          <Pencil aria-hidden strokeWidth={2} />
          Edit
        </button>
        <button type="button" onClick={onAddMoment} data-moment-add="" className={actionButtonClass('brand', { main: true })}>
          <Plus aria-hidden strokeWidth={2} />
          Add a moment
        </button>
      </div>
    </div>,
    host,
  );
}

/* ── Planning Stage: the chapters dated before the day ──────────────────────────────────────────────────────── */

/**
 * The chapters before the event day, at the top of Planning Stage (plan §3 "A chapter dated before the day lives in
 * Planning Stage"): a fitting, a tasting. Only chapter rows — the agenda below is Planning Stage's own and is not
 * touched here. Draws nothing when there are none.
 */
export function PlanningChapters() {
  const api = useChapters();
  if (!api) return null;
  const rows = sortChapters(api.chapters.filter((c) => chapterStage(c, api.eventDay) === 'planning'));
  if (rows.length === 0) return null;
  return (
    <section data-planning-chapters="" aria-label="Chapters before the day" className="mb-6">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">Chapters before the day</h2>
      <ul className="mt-1">
        {rows.map((c) => (
          <li key={c.block_id} className="border-b border-ink/10">
            <button
              type="button"
              data-planning-chapter={c.block_id}
              onClick={() => api.open(c.block_id)}
              className="sn-press flex min-h-14 w-full items-center gap-4 py-2 text-left"
            >
              <span className="w-14 flex-none text-[13px] text-ink/60">{dayShort(wallDay(c.start_at))}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold text-ink">{c.label}</span>
                <span className="block truncate text-[13px] text-ink/60">
                  Chapter · {c.time_tba ? TIME_TBA : clockWords(c.start_at)} · {chapterWhere(c)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "Dec 5" for a `YYYY-MM-DD` (a wall day — read as UTC, never a zone). */
function dayShort(day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return '';
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
