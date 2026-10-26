'use client';

/**
 * guests-screen.tsx — GUESTS › LIST AND MAP, built WITH the Event Hub Maker
 * (Maker PR 4f `rd/guests-with-the-maker`, owner 2026-10-07). The acceptance
 * picture is `prototypes/home_and_guests_2026-10-07_fable.html?frame=1&page=guests`
 * at 375 and 1280; the rows are `HOME_AND_GUESTS_CHECK_2026-10-07_fable.md`
 * G1–G23, G28, G32–G36, G38–G39 and the universal rules in
 * `BUTTON_RULE_2026-10-07_fable.md`.
 *
 * What is on the screen, top to bottom (the prototype's own order):
 *   1. the sticky block — `List N · Map · Setup` (one segmented control, G1),
 *      the counts line and the replied meter (`Count` / `Fill`, G4);
 *   2. List: the requests-to-join row (`👤 Review`, G11), then the SECTIONS of
 *      the one Sort dropdown (Role · Last name · Side · Group · RSVP; the
 *      celebrants first in every view — G16/G17), each popping then unfolding
 *      (G21), the open one pinned under the sticky block (G13) — its first tap
 *      goes back to its first row, a tap at the top folds it (rule 6, G23);
 *      rows `💬 Message` (only with a Setnayan account, G35) · `✎ Edit` ·
 *      `✕ Remove` — no Invite (G34), no Nudge (G28), every row ONE state (G36),
 *      at the right end of the name's own line (owner 2026-10-20; icons under 701);
 *   3. Map: the canvas IS the screen (`guest-map-canvas.tsx`, G38/G39);
 *   4. the thumb row, floating on glass, sliding in and out (rules 5 and 7):
 *      List `⇕ Expand/Collapse all · ☑ Select · Search or add (≥ 60 %) · ⫶ Sort`
 *      (G3, G19, rule 3b) · Select mode `✉ Invite N` (the field, ≥ 60 %) ·
 *      `🏷 Set… ▾` · `✕ Remove N` · `☑ Done` (G32) · Map `Search or add` ·
 *      `By side ▾`. No match → the right control becomes `＋ Add`.
 *
 * 🔑 THE SEARCH NEVER REBUILDS ITS BOX (rule 4: "why does it blink everytime i
 * type" · "start searching once we stop typing?"). The box is UNCONTROLLED — the
 * same DOM node for the life of the mode, its value never written back by
 * React — and the list reads the query 250 ms after the last key. The fit pass
 * writes an attribute, never state (`use-row-state.ts`). The rise animation
 * plays once per page/mode (`data-settled`).
 *
 * Saves are the SHIPPED ones (+0 server actions): Remove = `useGuestRemoval`
 * (the one warning, Undo); Set… = `bulkApplyRoleAndGroup`; New group… =
 * `NewGroupInlineForm`; Invite N = the one-by-one run at `/guests/send?ids=`.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Armchair,
  Check,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  CircleHelp,
  ClipboardList,
  Download,
  Ellipsis,
  Heart,
  House,
  ListFilter,
  ListPlus,
  Mail,
  MessageCircle,
  Minus,
  PartyPopper,
  Pencil,
  Plus,
  SquareCheck,
  Star,
  Tag,
  Upload,
  User,
  Users,
  X,
} from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { ThumbRow, type ThumbField, type ThumbMenu } from '@/components/thumb-row';
import { Count, Fill } from '@/components/count';
import { formatCount } from '@/lib/format-number';
import { PickMenu, type PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { useInspectorContext } from '@/app/_components/inspector/inspector-column';
import { PILL_TRACK_CLASS, PILL_TRACK_GROUND, PillThumb, pillSegClass } from '@/app/_components/pill-selector';
import { GuestPopup } from './guest-popup';
import { Handed } from './handed';
import { usePeekToast } from './use-peek-toast';
import {
  countsTowardEvent,
  guestDisplayName,
  guestNameAsGiven,
  guestInitials,
  plusOneSeats,
  replyMarkedByHost,
  RSVP_ROW_WORDS,
  SIDE_LABELS,
  type GuestRow,
  type GuestSide,
} from '@/lib/guests';
import { projectGuests } from '@/lib/guest-optimistic';
import { normalizeSearchText } from '@/lib/guest-search';
import {
  isToInvite,
  MAP_ARRANGE,
  mapTree,
  hostMaySetReply,
  plusOneFilterMatches,
  plusOneTally,
  replyFilterMatches,
  plusOneWordsFrom,
  PLUS_ONE_FILTERS,
  seatRowsByGuest,
  ROSTER_VIEWS,
  rosterSearchMatches,
  rosterSections,
  rosterStats,
  rowVerbsFor,
  SEARCH_WAIT_MS,
  typedLineIsAFilter,
  withTheirPlusOnes,
  type MapArrange,
  type PlusOneFilter,
  type ReplyFilter,
  type PlusOneWords,
  type RosterFacts,
  type RosterView,
  type SectionIcon,
  type SectionMark,
} from '@/lib/guest-roster-view';
import { useGuestActions } from './guest-actions-context';
import { useRoleNames } from './role-names-context';
import { guestOptimistic, useGuestOptimistic } from './guest-optimistic-store';
import { DeleteGuestSheet, useGuestRemoval } from './guest-delete';
import { NewGroupInlineForm } from './new-group-inline-form';
import { GuestPapicBulkSheet, PAPIC_SET_OPTIONS } from './guest-papic-bulk';
import type { GuestCamera } from '@/lib/papic-guest-camera';
import { groupLabelWithSide, sidesForNamesakes } from '@/lib/groups-for-side';
import { GuestListHasSidesContext } from './guest-list-has-sides-context';
import { ADD_WAYS, openAddGuest, openAddWay, type AddWayKey } from './add-guest-sheet';
import { AddDoors } from './capture-bar';
import { SearchAddRow, searchAddLabel } from '@/components/search-add-row';
import { guestAdds, NEEDS_BOTH_NAMES, queueTypedGuest, useGuestAdds } from './guest-add-queue';
import { JustAdded } from './just-added';
import { hearAction } from './hear-action';
import { AddCardPicks, PeopleHits, picksForAdd, useAddPicks, type PersonHit } from './search-add-card';
import { useRowState } from './use-row-state';
import { followColumn } from './dock-follows-column';
import { useShellBarOffset } from './use-shell-bar-offset';
import { GuestMapCanvas } from './guest-map-canvas';
import { companionNamesByBringer, plusOneHasNoName, seatNumbersAfter } from '@/lib/extra-seats';
import type { GuestMutation } from '@/lib/guest-optimistic';
import { pushUndo, guestToast } from './undo-store';
import { plainRefusal } from './plain-refusal';
import styles from './guests-screen.module.css';
import { useKeepGuestList, useKeptGuestList, type GuestsCopyState } from './guest-list-copy';
import type { GuestListRow } from '@/lib/guest-list-rows';
import { GuestListStatus } from './guest-copy-mark';
import { TitlesWaiting, type TitleWaitingPerson } from './titles-waiting';
import { displayPersonName } from '@/lib/person-name-case';


export type GuestsScreenProps = {
  eventId: string;
  /** The event's role set (`resolveRoleSetKeyForEvent`) — the Add card's Role list. Absent = the wedding set. */
  roleSetKey?: string | null;
  gview: 'list' | 'map' | 'share';
  /**
   * Every guest, importance-sorted by the page (the honoree first) — ONLY the fields the list draws and
   * searches (`lib/guest-list-rows.ts` GUEST_LIST_ROW_FIELDS), never the whole row.
   */
  guests: readonly GuestListRow[];
  /** The read was measured — a refused read never prints counts. */
  measured: boolean;
  /**
   * The groups or the tables could not be read this time — the sentence that says so (`lib/guest-list-unread.ts`),
   * or null when both were. Without it a refused read drew every guest with no group and nobody at a table.
   */
  notLoaded?: string | null;
  hasSides: boolean;
  /** guest_id → their custom groups' labels, alphabetical. */
  groupsByGuest: Record<string, string[]>;
  /** The event's custom groups — Set… ▾ › Group; `team_side` lets the Add card's Group follow its Side (owner 2026-10-20). */
  groups: { group_id: string; label: string; team_side: 'bride' | 'groom' | 'both' }[];
  /** The seat plan's tables — Set… ▾ › Table. */
  tables: { tableId: string; label: string }[];
  /** guest_id → the table they are placed at. */
  tableByGuest: Record<string, string>;
  /** guest_id → their song requests (the shipped search reads them). */
  songsByGuest: Record<string, string[]>;
  /** Guests an account holds (null = not measured). */
  linkedGuestIds: string[] | null;
  /** guest_id → a face to draw. */
  faceByGuest: Record<string, string>;
  /** Requests to join waiting (from the event link). */
  requests: number;
  /** 🪪 People whose printed word waits on Woman or Man (`needsWomanOrMan`) — the List's "N people need…" row. */
  titlesWaiting?: TitleWaitingPerson[];
  /** The map's root — the couple's names. */
  rootLabel: string;
  /** A `?q=` from the shell's top bar search. */
  initialQuery?: string;
  /** Open in Select mode (Setup's "☑ Pick who" → `?select=to-invite`). */
  initialSelect?: boolean;
  /**
   * Where a guest's chat opens, if anywhere. ⚠ No couple↔guest chat ships
   * today, so the page passes `() => null` and no row draws Message (G35 is
   * held by `message-needs-an-account.test.ts`; the gap is named in the PR).
   */
  chatHrefFor?: (guestId: string) => string | null;
  /** The Setup body (the shipped Share panel until PR 4d). */
  setup?: ReactNode;
  /**
   * What the List shows instead of sections when there is nothing to section:
   * the page's shipped EmptyState — "No guests yet." + one Add, or, when the
   * read was REFUSED, "We couldn't load your guest list" (never "no guests").
   */
  empty?: ReactNode;
  /**
   * 📋 This is the phone's LAST COPY of the list, not the fresh one (`guest-list-copy.ts`): the loading
   * screen drawing it while the fresh list comes (`updating`), or the page after the fresh read was refused
   * (`failed`). The mark says so, and nothing that writes is offered — no Select, no Remove, no Add.
   */
  copy?: GuestsCopyState | null;
  /**
   * 📸 The event's Papic, read for the couple (`readEventPapicAccess`): 'on' → Select's Set… ▾ gains a Papic group (owner
   * 2026-10-23, "Papic · set N each"). Anything else — off, a check that did not answer, not the couple — offers none.
   */
  papic?: 'on' | 'off' | 'unknown' | null;
  /**
   * 👁 The viewer may SEE this list but not change it — a limited helper, or any delegate whose guest-list
   * area is not 'edit' (`viewerAreaLevel`). The same rule as the phone's last copy: nothing that writes is
   * offered — no Select, no Remove, no Add. The server refuses them anyway (`refuseLimitedHelper`); this is
   * so the page never draws a control that can only fail.
   */
  viewOnly?: boolean;
};

/** ⚡ The most rows the first draw holds; the rest arrive at the first idle moment. */
export const ROW_WINDOW = 50;

const SECTION_ICON: Record<SectionIcon, typeof Star> = {
  celebrant: Heart,
  star: Star,
  home: House,
  party: PartyPopper,
  people: Users,
  attending: Check,
  pending: Ellipsis,
  maybe: CircleHelp,
  declined: X,
  invite: Mail,
  side: User,
  none: Minus,
};

/**
 * The other ways in, under a typed search (owner 2026-10-25: *"put From People, Import and Scan in the search
 * results"*) — the shipped `AddDoors` rows (the same openers and links the add sheet and ≡ use), two to a line so the
 * hits stay in sight over a phone keyboard. Unframed rows, each a 44 px target.
 */
function TypedWays({ eventId }: { eventId: string }) {
  return (
    <div className={styles.ways} data-typed-ways="">
      <p className={styles.waysLabel}>Add another way</p>
      <div className={styles.waysGrid}>
        <AddDoors eventId={eventId} rows />
      </div>
    </div>
  );
}

function Mark({ mark }: { mark: SectionMark }) {
  if (mark.kind === 'letter') return <>{mark.letter}</>;
  const Icon = SECTION_ICON[mark.icon];
  return <Icon aria-hidden strokeWidth={1.9} />;
}

/** The shell bar's height while it shows — the sticky block sits under it. */
export function GuestsScreen(props: GuestsScreenProps) {
  // 📋 THE FRESH READ WAS REFUSED → the phone's last copy, said plainly — never "No guests", never fresh.
  // Only when the phone holds one for this account + event; otherwise the page's honest "We couldn't load
  // your guest list" stays (`empty`). 🔒 guests/a-failed-refresh-shows-the-last-copy-as-old.test.ts
  const unread = useKeptGuestList(!props.measured && props.gview === 'list' && !props.copy);
  const live: GuestsScreenProps = unread
    ? {
        ...props,
        ...unread.list,
        guests: unread.list.rows,
        measured: true,
        notLoaded: null,
        songsByGuest: {},
        linkedGuestIds: null,
        groups: [],
        tables: [],
        empty: null,
        initialQuery: '',
        initialSelect: false,
        copy: { freshness: 'failed', savedAt: unread.savedAt },
      }
    : props;
  const {
    eventId,
    gview,
    measured,
    notLoaded = null,
    hasSides,
    groupsByGuest,
    groups,
    tables,
    tableByGuest,
    songsByGuest,
    linkedGuestIds,
    faceByGuest,
    requests,
    titlesWaiting = [],
    rootLabel,
    initialQuery = '',
    initialSelect = false,
    chatHrefFor,
    setup,
    empty,
    copy = null,
    roleSetKey = null,
    viewOnly = false,
  } = live;
  // 🔒 Nothing that writes is offered while this is the phone's old copy OR the viewer may only look.
  const writesOff = copy !== null || viewOnly;
  // The list's rows carry only GUEST_LIST_ROW_FIELDS; every helper below reads within them —
  // 🔒 guests/the-list-sends-only-what-it-draws.test.ts runs this screen and those helpers over rows that
  // record each field read.
  const guests = live.guests as unknown as GuestRow[];
  const router = useRouter();
  const [toast, toastNode] = usePeekToast();
  const inspector = useInspectorContext();
  const roleNames = useRoleNames();
  // 📋 The fresh, measured List keeps itself on the phone for the next open (`guest-list-copy.ts`).
  useKeepGuestList(
    { guests: live.guests, hasSides, groupsByGuest, tableByGuest, faceByGuest, requests, rootLabel, roleNames },
    !copy && measured && gview === 'list' && !initialQuery && !initialSelect,
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLInputElement>(null);
  useShellBarOffset(rootRef);

  // ── The optimistic overlay: a removed guest vanishes at once, Undo returns them.
  const optimistic = useGuestOptimistic();
  useEffect(() => {
    guestOptimistic.reconcile(guests);
  }, [guests]);
  const roster = useMemo(() => projectGuests(guests, optimistic), [guests, optimistic]);

  // ── ⚡ Names typed and Entered: on screen at once ("Just added"), written in order, the list re-read ONCE when the
  // queue is empty; a re-read that holds a saved name lets its waiting row step aside (guest-add-queue.ts).
  const adds = useGuestAdds();
  const waiting = adds.filter((a) => a.eventId === eventId && !a.landed);
  // one-render: keep (batched) — the add queue's writes go `{ refresh: false }`; this is the ONE re-read when it empties.
  useEffect(() => guestAdds.setRefresher(() => router.refresh()), [router]);
  useEffect(() => {
    guestAdds.reconcile(guests.map((g) => g.guest_id));
  }, [guests]);

  // 🤝 Whose +1 each +1 row is — read off the WHOLE list, so a search still names every seat's guest.
  const rosterById = useMemo(() => new Map(roster.map((g) => [g.guest_id, g] as const)), [roster]);
  const plusWords = useMemo(() => plusOneWordsFrom(roster), [roster]);
  const seatRows = useMemo(() => seatRowsByGuest(roster), [roster]);
  // 🧹 Who each guest brings, off their live +1 rows — the search's +1 words, never the one-name mirror (2026-10-26).
  const companions = useMemo(() => companionNamesByBringer(roster), [roster]);
  const facts: RosterFacts = useMemo(
    () => ({
      roleNames,
      hasSides,
      groupsOf: (id) => groupsByGuest[id] ?? [],
      tableOf: (id) => tableByGuest[id] ?? null,
      songsOf: (id) => songsByGuest[id] ?? [],
      companionsOf: (id) => companions.get(id) ?? [],
      guestById: (id) => rosterById.get(id),
    }),
    [roleNames, hasSides, groupsByGuest, tableByGuest, songsByGuest, companions, rosterById],
  );
  const linked = useMemo(() => (linkedGuestIds ? new Set(linkedGuestIds) : null), [linkedGuestIds]);

  // ── The query: typed into an UNCONTROLLED box, read 250 ms after the last key.
  const [q, setQ] = useState(initialQuery.trim());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onType = useCallback((v: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setQ(v.trim()), SEARCH_WAIT_MS);
  }, []);
  useEffect(() => {
    // The shell's top-bar search still writes `?q=` — adopt it.
    const v = initialQuery.trim();
    if (fieldRef.current && fieldRef.current.value !== v) fieldRef.current.value = v;
    setQ(v);
  }, [initialQuery]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // 🪑 The Sort dropdown's "+1 ▾ Named · No name yet" (owner 2026-10-21) — on top of the search, as every filter is.
  const [plusFilter, setPlusFilter] = useState<PlusOneFilter | null>(null);
  // 👆 The counts are doors (owner 2026-10-21): "N attending · N not coming · N no reply" filter to exactly those guests.
  const [replyFilter, setReplyFilter] = useState<ReplyFilter | null>(null);
  // A guest found by NAME brings their +1s (`withTheirPlusOnes`) — a +1 is never left behind by a search.
  const visible = useMemo(() => {
    const found = q ? withTheirPlusOnes(q, roster.filter((g) => rosterSearchMatches(q, g, facts)), roster) : roster;
    return plusFilter || replyFilter
      ? found.filter((g) => plusOneFilterMatches(g, plusFilter) && replyFilterMatches(g, replyFilter))
      : found;
  }, [roster, q, facts, plusFilter, replyFilter]);

  // ── The one Sort (list) and the one Arrange (map).
  const views = useMemo(() => ROSTER_VIEWS.filter((v) => hasSides || v.key !== 'side'), [hasSides]);
  const [view, setView] = useState<RosterView>('role');
  const arranges = useMemo(() => MAP_ARRANGE.filter((v) => hasSides || v.key !== 'side'), [hasSides]);
  const [arrange, setArrange] = useState<MapArrange>(hasSides ? 'side' : 'role');

  const sections = useMemo(() => rosterSections(visible, view, facts), [visible, view, facts]);

  // Open on arrival: the first section after the celebrants (the prototype's
  // seeded state — Bride & Groom folded, VIP open). A new Sort opens the same.
  const firstOpen = (view0: RosterView) => {
    const secs = rosterSections(roster, view0, facts);
    const first = secs.find((x) => !x.celebrants) ?? secs[0];
    return new Set(first ? [first.key] : []);
  };
  const [open, setOpen] = useState<Set<string>>(() => firstOpen('role'));
  // A refused read drew no sections; when the phone's copy replaces it, open the copy's first section.
  useEffect(() => {
    if (unread) setOpen(firstOpen(view));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the copy arrives
  }, [unread]);
  // A search opens every section that has a hit (G19 — a hit inside a folded
  // section was invisible, a failure that looked like "not found").
  const filtered = Boolean(plusFilter || replyFilter);
  const isOpen = (key: string) => (q || filtered ? true : open.has(key));
  const allOpen = sections.length > 0 && sections.every((s) => isOpen(s.key));

  // ── ⚡ ROWS EXIST WHERE THEY CAN BE SEEN (measured 2026-10-16, the owner's 84 guests at
  // 375 px): 79 of 85 rows sat in FOLDED sections — 1,643 of the page's 2,103 nodes built,
  // hydrated and fitted for nothing. A section's rows are now drawn once it is open (and kept
  // after, so a fold still closes over them), and the first draw holds at most ROW_WINDOW rows;
  // the rest arrive on the first idle moment after. Every count, "select all" and Remove still
  // reads the DATA (`sec.guests`, `rosterStats`), never the drawn rows — so "List N", a
  // section's "· N" and the rows a search finds are exactly what they were.
  // 🔒 guests/the-guest-list-draws-what-can-be-seen.test.ts
  const [everOpen, setEverOpen] = useState<Set<string>>(() => new Set(open));
  useEffect(() => {
    setEverOpen((prev) => {
      const add = [...open].filter((k) => !prev.has(k));
      return add.length ? new Set([...prev, ...add]) : prev;
    });
  }, [open]);
  const [windowLifted, setWindowLifted] = useState(false);
  useEffect(() => {
    const idle = (window as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (idle) {
      const id = idle(() => setWindowLifted(true), { timeout: 400 });
      return () => (window as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(id);
    }
    const t = setTimeout(() => setWindowLifted(true), 120);
    return () => clearTimeout(t);
  }, []);
  /** The rows each section draws now: none while it has never been open; at most ROW_WINDOW in all until idle. */
  const drawnRows = (() => {
    let budget = windowLifted ? Number.POSITIVE_INFINITY : ROW_WINDOW;
    const out = new Map<string, GuestRow[]>();
    for (const sec of sections) {
      const shown = isOpen(sec.key) || everOpen.has(sec.key) ? sec.guests.slice(0, Math.max(0, budget)) : [];
      budget -= shown.length;
      out.set(sec.key, shown);
    }
    return out;
  })();
  const drawnKey = sections.map((x) => `${x.key}:${drawnRows.get(x.key)?.length ?? 0}`).join('|');

  // ── Select mode.
  const [selectMode, setSelectMode] = useState(initialSelect);
  useEffect(() => {
    if (initialSelect) setSelectMode(true);
  }, [initialSelect]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleSection = (ids: string[]) =>
    setSelected((prev) => {
      const all = ids.length > 0 && ids.every((i) => prev.has(i));
      const next = new Set(prev);
      for (const i of ids) {
        if (all) next.delete(i);
        else next.add(i);
      }
      return next;
    });
  const leaveSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  // ── Settled: the rise plays once per page/mode, never on a re-render.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    setSettled(false);
    const t = setTimeout(() => setSettled(true), 500);
    return () => clearTimeout(t);
  }, [gview]);

  // ── The thumb row slides up once the mode has rendered.
  const [barOn, setBarOn] = useState(false);
  useEffect(() => {
    setBarOn(false);
    if (gview === 'share') return;
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setBarOn(true)));
    return () => cancelAnimationFrame(r);
  }, [gview]);

  // ── 🖥 From 701 the thumb row sits UNDER THE READING COLUMN, edge to edge with it, and stays there when the column
  //    moves (owner 2026-10-20, "is the desktop view done fixing?"). The column is THIS screen — `dock-follows-column.ts`.
  useEffect(() => {
    const root = rootRef.current;
    return root ? followColumn(root) : undefined;
  }, []);

  // ── The sticky block's height → the pinned section header sits under it.
  useEffect(() => {
    const st = stickRef.current;
    const root = rootRef.current;
    if (!st || !root) return;
    const sync = () => root.style.setProperty('--gs-stick-h', `${st.offsetHeight}px`);
    sync();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(sync) : null;
    ro?.observe(st);
    return () => ro?.disconnect();
  }, []);

  // ── ONE state for every guest row, and one for the thumb row (rules 3a/3b, G36).
  useRowState(listRef, [sections, selectMode, gview, drawnKey]);
  useRowState(thumbRef, [selectMode, gview, q && visible.length === 0, selected.size, view, arrange]);

  // ── Open a guest's card — the page's inspector (the same panel as before).
  const openCard = (id: string, el: HTMLElement) => {
    if (inspector) inspector.select(id, el);
    else router.push(`/dashboard/${eventId}/guests/${id}`);
  };

  // ── Remove: the one warning, then the shipped soft delete with Undo.
  const { removing, remove, release } = useGuestRemoval(eventId);
  const [toRemove, setToRemove] = useState<string[] | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const byId = useMemo(() => new Map(roster.map((g) => [g.guest_id, g] as const)), [roster]);
  /* The names the delete sheet opened with — read while those rows are still on the list (a refusal is told by name). */
  const removeNames = (toRemove ?? []).map((id) => {
    const g = byId.get(id);
    // A +1's seat is named with their guest here too — "Juanita Sacdalan’s +1 · TBA", never a bare "+1 · TBA".
    return g ? (plusWords.get(id)?.name ?? displayPersonName(guestNameAsGiven(g) ?? guestDisplayName(g))) : '';
  });

  // ── 🪑 Release seat (owner 2026-10-21): +1s with no name yet go at once — no warning, one Undo — and their guests'
  // "+N" is drawn one lower with them (`seatNumbersAfter`, the server's own rule), never "+1 not added yet" meanwhile.
  const releaseSeats = (ids: readonly string[], onReleased?: () => void) => {
    const seatsGoing = ids.map((id) => byId.get(id)).filter((g): g is GuestRow => Boolean(g) && plusOneHasNoName(g!));
    if (seatsGoing.length === 0) return;
    const hosts = new Set(seatsGoing.map((g) => g.plus_one_of_guest_id));
    const also: GuestMutation[] = seatNumbersAfter(seatsGoing, roster.filter((g) => hosts.has(g.guest_id)), 'removed').map((u) => ({
      kind: 'setField',
      guestIds: [u.guest_id],
      // Only the number the row draws (the List carries no `plus_one_allowed` — an override of it would never settle).
      override: { plus_one_count: u.plus_one_count },
    }));
    void release(
      seatsGoing.map((g) => g.guest_id),
      { onReleased, also },
    );
  };

  // ── Set… ▾ (group · table · side) — the shipped bulk writer, one field at a time.
  const [newGroup, setNewGroup] = useState(false);
  // ── Set… ▾ › Papic (owner 2026-10-23) — the sheet "Papic · set N each", open with the choice that was picked.
  const [papicSheet, setPapicSheet] = useState<GuestCamera | null>(null);
  const { bulkApplyRoleAndGroup, sendRunHref } = useGuestActions();
  const applyBulk = async (field: 'group_id' | 'table' | 'side', value: string) => {
    const fd = new FormData();
    for (const id of selected) fd.append('guest_ids[]', id);
    fd.set(field, value);
    // ⚡ The action revalidates the guest list, so its answer carries the redrawn page — no second render.
    await bulkApplyRoleAndGroup(eventId, fd);
  };

  // ── ✋ Set reply ▾ (owner 2026-10-21) — the ONE host reply write (`setGuestRsvp`): drawn at once, one Undo for all.
  //    The couple and the honoree are skipped (always attending, `hostMaySetReply`). Not coming frees their chairs and
  //    releases their +1 seats with no name yet (drawn gone here, their "+N" one lower); named +1s stay.
  const { setGuestRsvp, restoreGuestRsvpAndSeat } = useGuestActions();
  const [setting, setSetting] = useState(false);
  const setReplies = async (ids: readonly string[], rsvp: 'attending' | 'declined') => {
    if (setting) return;
    const moving = ids.map((id) => byId.get(id)).filter((g): g is GuestRow => Boolean(g) && hostMaySetReply(g!) && g!.rsvp_status !== rsvp);
    if (moving.length === 0) {
      toast.info(`Everyone selected is already ${RSVP_ROW_WORDS[rsvp].toLowerCase()}`);
      return;
    }
    const movingIds = new Set(moving.map((g) => g.guest_id));
    const muts: GuestMutation[] = [
      { kind: 'setField', guestIds: [...movingIds], override: { rsvp_status: rsvp, rsvp_set_by: 'host' } },
    ];
    if (rsvp === 'declined') {
      const seatsGoing = roster.filter((g) => g.plus_one_of_guest_id && movingIds.has(g.plus_one_of_guest_id) && plusOneHasNoName(g));
      if (seatsGoing.length > 0) {
        muts.push({ kind: 'remove', guestIds: seatsGoing.map((g) => g.guest_id) });
        const hosts = new Set(seatsGoing.map((g) => g.plus_one_of_guest_id));
        for (const u of seatNumbersAfter(seatsGoing, roster.filter((g) => hosts.has(g.guest_id)), 'removed')) {
          muts.push({ kind: 'setField', guestIds: [u.guest_id], override: { plus_one_count: u.plus_one_count } });
        }
      }
    }
    const clearAll = () => muts.forEach((m) => guestOptimistic.clear(m));
    setSetting(true);
    muts.forEach((m) => guestOptimistic.apply(m));
    try {
      let res;
      try {
        res = await setGuestRsvp(eventId, [...movingIds], rsvp);
      } catch {
        clearAll();
        guestToast.error('Could not set the reply — check your connection and try again.');
        return;
      }
      if (!res.ok) {
        clearAll();
        guestToast.error(plainRefusal(res.error, 'Couldn’t set the reply. Try again.'));
        return;
      }
      leaveSelect();
      const done = res;
      const n = done.changed.length;
      pushUndo({
        label: `${formatCount(n)} marked ${RSVP_ROW_WORDS[rsvp].toLowerCase()}`,
        undo: async () => {
          const r = await restoreGuestRsvpAndSeat(eventId, done.changed, done.seats);
          if (r.ok) clearAll();
          else guestToast.error('Could not undo — refresh and try again.');
        },
      });
    } finally {
      setSetting(false);
    }
  };

  // ── Section header tap (rule 6): open and scrolled into → back to its first
  // row; open with its top in view → fold; shut → open and land its first row.
  const tapSection = (key: string, el: HTMLElement | null) => {
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    const stickBottom = stickRef.current?.getBoundingClientRect().bottom ?? 0;
    if (isOpen(key) && top < stickBottom - 2) {
      el.scrollIntoView({ block: 'start', behavior: 'smooth' });
      return;
    }
    if (q) return; // a search holds every hit open
    const opening = !open.has(key);
    setOpen((prev) => {
      const next = new Set(prev);
      if (opening) next.add(key);
      else next.delete(key);
      return next;
    });
    if (opening) setTimeout(() => el.scrollIntoView({ block: 'start', behavior: 'smooth' }), 80);
  };

  // ── The counts (they count on load and on change — rule 2).
  // The counts are read off the SAME list the rows are drawn from (`roster`),
  // never a second read — so "List N" and "N attending" equal the rows below.
  const stats = rosterStats(roster);
  // 🪑 "+1s: N named · M no name yet" — the filter's own rows, counted (`plusOneTally`); none drawn with no +1s.
  const plusTally = plusOneTally(roster);
  const replied = stats.total ? Math.round(((stats.yes + stats.no) / stats.total) * 100) : 0;
  const shown = visible.filter((g) => countsTowardEvent(g)).length;
  const noMatch = Boolean(q) && visible.length === 0;
  const pickPlus = (f: PlusOneFilter) => {
    setPlusFilter((now) => (now === f ? null : f));
    window.scrollTo({ top: 0 });
  };
  const pickReply = (f: ReplyFilter) => {
    setReplyFilter((now) => (now === f ? null : f));
    window.scrollTo({ top: 0 });
  };
  /** A count, as a door to its filter — pressed again (or × Clear) to take it off. */
  const countDoor = (f: ReplyFilter, value: number, id: string, word: string) => (
    <button
      type="button"
      className={styles.countsDoor}
      aria-pressed={replyFilter === f}
      onClick={() => pickReply(f)}
      data-reply-filter={f}
    >
      <b><Count value={value} id={id} /></b> {word}
    </button>
  );

  const seg = (key: 'list' | 'map' | 'share', label: string, count?: number) => (
    <Link
      key={key}
      className={`${pillSegClass(gview === key)} [&>b]:font-medium [&>b]:opacity-80`}
      href={key === 'list' ? `/dashboard/${eventId}/guests` : `/dashboard/${eventId}/guests?gview=${key}`}
      aria-current={gview === key ? 'page' : undefined}
      scroll={false}
      data-guests-seg={key}
      data-tour={key === 'share' ? 'guests-setup' : undefined}
    >
      {label}
      {count !== undefined && measured ? <b><Count value={count} id={`gs-seg-${key}`} /></b> : null}
    </Link>
  );

  /* ═══ the thumb row ═══ */
  /* ➕ NO ROUND ＋ (owner 2026-10-25, verbatim: *"Yes, remove the + on the guest list. Typing in the search adds; put
     From People, Import and Scan in the search results and the menu."*). The field adds (Enter, or the typed results'
     "Add “…” as a guest"); the other ways are ≡ items here — reachable with an empty field — and rows in the typed
     results. ONE list, `ADD_WAYS`, the same openers the add sheet uses. 🔒 search-or-add.test.ts */
  const addWayIcon: Record<AddWayKey, typeof Users> = { people: Users, details: ClipboardList, import: Upload, paste: ListPlus };
  const addWays: PickOption[] = writesOff
    ? []
    : ADD_WAYS.map((w) => {
        const Icon = addWayIcon[w.key];
        return { key: `add:${w.key}`, label: w.label, group: 'Add', icon: <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} /> };
      });
  /** A ≡ pick that is one of the ways in → open it; answers whether it was. */
  const pickedAddWay = (k: string): boolean => {
    if (!k.startsWith('add:')) return false;
    openAddWay(k.slice(4) as AddWayKey, eventId, (href) => router.push(href));
    return true;
  };
  const sortMenu: ThumbMenu = {
    mark: 'data-thumb-sort',
    tour: 'guests-sort',
    label: 'Sort, select or add',
    value: plusFilter ? `plus:${plusFilter}` : view,
    buttonText: plusFilter ? `+1 · ${PLUS_ONE_FILTERS.find((f) => f.key === plusFilter)?.label ?? ''}` : undefined,
    menu: views
      .map((v): PickOption => ({ key: v.key, label: v.label, group: 'Sort by', icon: <ListFilter className="h-[18px] w-[18px]" strokeWidth={1.9} /> }))
      .concat(
        // 🪑 "+1 ▾ Named · No name yet" (owner 2026-10-21) — offered only when the list has +1s; picking a Sort clears it.
        plusTally.named + plusTally.unnamed > 0
          ? PLUS_ONE_FILTERS.map((f) => ({ key: `plus:${f.key}`, label: f.label, group: '+1', icon: <Armchair className="h-[18px] w-[18px]" strokeWidth={1.9} /> }))
          : [],
        // ☑ Select lives in this menu (owner 2026-10-22, question 1) — it was the row's fifth round.
        writesOff ? [] : [{ key: 'select', label: 'Select…', group: 'List', icon: <SquareCheck className="h-[18px] w-[18px]" strokeWidth={1.9} /> }],
        addWays,
      ),
    onPick: (k) => {
      if (pickedAddWay(k)) return;
      if (k === 'select') return setSelectMode(true);
      if (k.startsWith('plus:')) {
        setPlusFilter(k.slice(5) as PlusOneFilter);
        window.scrollTo({ top: 0 });
        return;
      }
      const next = k as RosterView;
      setPlusFilter(null);
      setView(next);
      setOpen(firstOpen(next));
      window.scrollTo({ top: 0 });
    },
  };
  const arrangeMenu: ThumbMenu = {
    mark: 'data-thumb-arrange',
    label: 'Arrange the map, or add',
    value: arrange,
    menu: arranges
      .map((v): PickOption => ({ key: v.key, label: v.label, group: 'Arrange by', icon: <ListFilter className="h-[18px] w-[18px]" strokeWidth={1.9} /> }))
      .concat(addWays),
    onPick: (k) => {
      if (pickedAddWay(k)) return;
      setArrange(k as MapArrange);
    },
  };
  /* ⚡ SEARCH OR ADD, ONE ENTER (owner 2026-10-19: "i type a name and it is not found there. when i press enter that should
     add that person there already"). Enter on a line that matches ONE guest opens them; several stay filtered; NOBODY →
     the line is a new guest, on the List at once (the shipped capture-bar grammar, the shipped `addSingleGuest`, through
     the ordered queue), the box cleared and kept focused for the next name. A filter word that found nobody ("best man",
     "no reply", a group's name) is never added as a person; a line without both names is kept and told so, at once.
     It used to open the add sheet with the name in it — a SECOND Enter, then a wait on the server and a whole-page redraw.
     🔒 guests/_components/one-enter-adds-one-guest-at-once.test.ts */
  // What stopped the last Enter, for the line it was said about — typing a new line hides it (no render per key).
  // The Add card's four sticky picks (owner 2026-10-20) — read by every Enter, kept for the next names.
  const [picks, setPicks] = useAddPicks(hasSides);
  const [madeGroups, setMadeGroups] = useState<{ group_id: string; label: string; team_side: 'bride' | 'groom' | 'both' }[]>([]);
  const allGroups = useMemo(() => [...groups, ...madeGroups.filter((m) => !groups.some((g) => g.group_id === m.group_id))], [groups, madeGroups]);
  // 🧑‍🤝‍🧑 THE COUPLE'S PEOPLE (owner 2026-10-20: "search also searches the people connected to them. From People.") — the
  // SAME read the "Add from your people" sheet makes (`listPeopleYouCanInvite`), once, when the box is first used.
  const { listPeopleYouCanInvite, addGuestsFromPeople } = useGuestActions();
  const [people, setPeople] = useState<PersonHit[] | null>(null);
  const [takenPeople, setTakenPeople] = useState<ReadonlySet<string>>(() => new Set());
  const peopleAsked = useRef(false);
  const loadPeople = () => {
    if (peopleAsked.current || writesOff) return;
    peopleAsked.current = true;
    void hearAction(() => listPeopleYouCanInvite(eventId).then((r) => ({ ok: true as const, r })))
      .then((res) => {
        if (res.ok) setPeople(res.r.people.filter((p) => !p.alreadyHere));
        else peopleAsked.current = false;
      });
  };
  /** People not on this list whose name holds every typed word (as a word start) — at most three. */
  const peopleFor = (v: string): PersonHit[] => {
    const words = normalizeSearchText(v).split(' ').filter(Boolean);
    if (!people || words.length === 0) return [];
    return people
      .filter((p) => !takenPeople.has(p.key))
      .filter((p) => {
        const name = normalizeSearchText(p.name).split(' ');
        return words.every((w) => name.some((n) => n.startsWith(w)));
      })
      .slice(0, 3);
  };
  const peopleHits = q ? peopleFor(q) : [];
  const addPerson = (p: PersonHit) => {
    const sent = picksForAdd(picks, allGroups, roleNames);
    guestAdds.enqueue({
      eventId,
      name: p.name,
      detail: sent.detail,
      run: async () => {
        const r = await addGuestsFromPeople(eventId, [{ key: p.key }], picks.side, {
          role: picks.role,
          groupCategory: picks.category,
          groupLabels: [...(sent.groupLabels ?? [])],
          plusOnes: picks.plus,
          refresh: false,
        });
        return r.ok
          ? { ok: true, guest: { guest_id: r.guestIds?.[0] ?? '', first_name: p.name, last_name: p.lastName, side: picks.side, role: picks.role } }
          : { ok: false, error: r.error };
      },
    });
    setTakenPeople((prev) => new Set([...prev, p.key]));
    if (fieldRef.current) fieldRef.current.value = '';
    if (timer.current) clearTimeout(timer.current);
    setQ('');
    fieldRef.current?.focus();
  };
  const [needsFor, setNeedsFor] = useState<{ q: string; text: string } | null>(null);
  const setNeeds = (text: string | null, line = '') => setNeedsFor(text ? { q: line.trim(), text } : null);
  const needs = needsFor && needsFor.q === q ? needsFor.text : null;
  const { addSingleGuest } = useGuestActions();
  const filterLabels = useMemo(() => [...groups.map((g) => g.label), ...tables.map((t) => t.label)], [groups, tables]);
  /** Queue the typed line; answers what stopped it ('' = added). */
  const addTyped = (v: string): string => {
    const key = normalizeSearchText(v);
    if (waiting.some((a) => normalizeSearchText(a.name) === key)) {
      setNeeds(`${v} is already added.`, v);
      return 'already';
    }
    const res = queueTypedGuest(eventId, v, picks.side, addSingleGuest, guestAdds, picksForAdd(picks, allGroups, roleNames));
    if (!res.ok) {
      if (res.error) setNeeds(res.error, v);
      return res.error || 'empty';
    }
    if (fieldRef.current) fieldRef.current.value = '';
    if (timer.current) clearTimeout(timer.current);
    setQ('');
    setNeeds(null);
    fieldRef.current?.focus();
    // The new name's row is at the top of the List — bring it into view (the List may be scrolled down).
    requestAnimationFrame(() =>
      rootRef.current?.querySelector('[data-just-added="list"]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
    );
    return '';
  };
  /** One press adds the typed line, the same as Enter; a line the box cannot add alone (one name) opens the sheet. */
  const addTypedOrSheet = (v: string) => {
    if (addTyped(v) === NEEDS_BOTH_NAMES) openAddGuest(v);
  };
  /* 🔎 ONE THUMB ROW (owner 2026-10-22): the field is the shared row's seat — "Search guests", glass, 44 px. Its
     behaviour is unchanged: the same input, the same one-Enter grammar. */
  const field: ThumbField = {
    placeholder: 'Search guests',
    label: 'Search guests or add',
    tour: 'guests-add',
    inputRef: fieldRef,
    input: {
      defaultValue: q,
      autoCorrect: 'off',
      enterKeyHint: 'go',
      'data-guests-search': '',
      onFocus: loadPeople,
      onInput: (e) => onType(e.currentTarget.value),
      onKeyDown: (e) => {
        if (e.key !== 'Enter') return;
        // A keyboard still composing a word (an IME, a phone's suggestion) owns this Enter — it finishes the word.
        if (e.nativeEvent.isComposing) return;
        e.preventDefault();
        const v = e.currentTarget.value.trim();
        if (timer.current) clearTimeout(timer.current);
        setQ(v);
        if (copy || !v) return;
        const hits = roster.filter((g) => rosterSearchMatches(v, g, facts));
        if (hits.length === 1) {
          const id = hits[0]!.guest_id;
          const row = rootRef.current?.querySelector<HTMLElement>(`[data-guest-id="${CSS.escape(id)}"] button`);
          openCard(id, row ?? e.currentTarget);
          return;
        }
        if (hits.length > 0) return;
        // 👁 A view-only viewer's Enter finds, never adds.
        if (writesOff) return;
        // In your People but not on this list → Enter adds the first one, with what People knows and the four picks.
        const known = peopleFor(v);
        if (known.length > 0) {
          addPerson(known[0]!);
          return;
        }
        if (typedLineIsAFilter(v, facts, filterLabels)) return;
        addTyped(v);
      },
    },
  };

  const setNamesakes = sidesForNamesakes(groups.map((g) => ({ groupId: g.group_id, label: g.label, teamSide: g.team_side })));
  const setOptions: PickOption[] = [
    // ✋ Set reply (owner 2026-10-21: "so we can manually accept them in case they just forgot to say yes").
    { key: 'reply:attending', label: RSVP_ROW_WORDS.attending, group: 'Reply' },
    { key: 'reply:declined', label: RSVP_ROW_WORDS.declined, group: 'Reply' },
    // 👥 Same name, say the side (owner 2026-10-21): two groups of one name each carry their side's word.
    ...groups.map((g) => ({ key: `group:${g.group_id}`, label: groupLabelWithSide(g.label, setNamesakes.get(g.group_id)), group: 'Group' })),
    { key: 'group:new', label: 'New group…', group: 'Group' },
    ...tables.map((t) => ({ key: `table:${t.tableId}`, label: t.label, group: 'Table' })),
    { key: 'table:none', label: 'Not seated', group: 'Table' },
    ...(hasSides
      ? (['bride', 'groom', 'both'] as GuestSide[]).map((s) => ({ key: `side:${s}`, label: SIDE_LABELS[s], group: 'Side' }))
      : []),
    // 📸 Their camera, for everyone selected — only while the event's Papic is on (owner 2026-10-23).
    ...(live.papic === 'on' && !writesOff ? PAPIC_SET_OPTIONS : []),
  ];
  const selectedIds = [...selected];
  const invitable = selectedIds
    .map((id) => byId.get(id))
    .filter((g): g is GuestRow => Boolean(g) && isToInvite(g!));
  const removable = selectedIds.filter((id) => {
    const g = byId.get(id);
    return g && g.role !== 'bride' && g.role !== 'groom';
  });
  // 🪑 Every one selected is a +1 with no name yet → the red button is "Release N seats" (no warning, one Undo).
  const releasable = selectedIds.filter((id) => {
    const g = byId.get(id);
    return Boolean(g) && plusOneHasNoName(g!);
  });
  const releaseAll = releasable.length > 0 && releasable.length === selectedIds.length;

  let thumb: ReactNode = null;
  if (gview === 'list' && selectMode) {
    thumb = (
      <div className={styles.thumb} data-fit-row="" data-thumb="select">
        <ActionButton
          tone="brand"
          main
          icon={Mail}
          label={selected.size === 0 ? 'Invite' : `Invite ${selected.size}`}
          name={selected.size === 0 ? 'Invite — nobody selected still needs an invitation' : undefined}
          className={styles.grow}
          waiting={selected.size === 0}
          onClick={() => {
            // Invite N is the ONE run (`/guests/send`), with only the selected
            // who still need theirs — never the couple, never the already sent.
            if (invitable.length === 0) {
              toast.info('Everyone selected is already invited');
              return;
            }
            router.push(sendRunHref(eventId, invitable.map((g) => g.guest_id)));
          }}
          data-testid="bulk-invite"
        />
        <span className={styles.acts} data-fit-acts="">
          <span data-pick="" data-bulk-set="" className={styles.pickIcon}>
            <Tag aria-hidden strokeWidth={1.9} />
            <PickMenu
              label="Set for the selected"
              value={null}
              buttonText="Set…"
              options={setOptions}
              onPick={(k) => {
                if (selected.size === 0) return;
                if (k === 'group:new') return setNewGroup(true);
                if (k === 'reply:attending' || k === 'reply:declined') return void setReplies(selectedIds, k.slice(6) as 'attending' | 'declined');
                if (k.startsWith('papic:')) return setPapicSheet(k.slice(6) as GuestCamera);
                const [field, ...rest] = k.split(':');
                const value = rest.join(':');
                void applyBulk(field === 'group' ? 'group_id' : (field as 'table' | 'side'), value);
              }}
            />
          </span>
          {releaseAll ? (
            <ActionButton
              tone="danger"
              icon={Armchair}
              label={`Release ${formatCount(releasable.length)} seat${releasable.length === 1 ? '' : 's'}`}
              waiting={removing}
              onClick={() => releaseSeats(releasable, leaveSelect)}
              data-testid="bulk-release"
            />
          ) : (
            <ActionButton
              tone="danger"
              icon={X}
              label={`Remove ${removable.length}`}
              waiting={removable.length === 0}
              onClick={() => {
                setRemoveError(null);
                setToRemove(removable);
              }}
              data-testid="bulk-remove"
            />
          )}
          <ActionButton tone="neutral" icon={SquareCheck} label="Done" onClick={leaveSelect} data-testid="bulk-done" />
        </span>
      </div>
    );
  } else if (gview === 'list') {
    /* ⇕ · Search guests · ≡ (owner 2026-10-22, question 1 "fold ☑ Select into ≡"; 2026-10-25 "remove the +"): the
       field is the add — Enter adds at once — and ≡ holds Sort, Select and the other ways in. */
    thumb = (
      <ThumbRow
        name="guests"
        left={[
          {
            icon: allOpen ? ChevronsDownUp : ChevronsUpDown,
            label: allOpen ? 'Collapse all' : 'Expand all',
            expanded: allOpen,
            onClick: () => setOpen(allOpen ? new Set() : new Set(sections.map((s) => s.key))),
            testId: 'thumb-expand',
          },
        ]}
        field={field}
        right={[sortMenu]}
      />
    );
  } else if (gview === 'map') {
    thumb = <ThumbRow name="guests-map" field={field} right={[arrangeMenu]} />;
  }

  /* ═══ the list ═══ */
  const list = (
    <div ref={listRef} data-guest-rows="">
      {requests > 0 ? (
        <div className={`${styles.row} ${styles.rise}`} data-requests-strip="">
          <div>
            <div className={styles.t}>
              <Count value={requests} id="gs-req" /> {requests === 1 ? 'request' : 'requests'} to join
            </div>
            <div className={styles.s}>From your event link — keep them, or link them to a name you already have.</div>
          </div>
          <span className={styles.acts} data-fit-acts="">
            <ActionButton tone="brand" main icon={User} label="Review" href={`/dashboard/${eventId}/guests/claims`} />
          </span>
        </div>
      ) : null}
      {titlesWaiting.length > 0 && !writesOff ? (
        <TitlesWaiting eventId={eventId} people={titlesWaiting} classes={{ row: `${styles.row} ${styles.rise}`, t: styles.t ?? '', s: styles.s ?? '', acts: styles.acts ?? '' }} />
      ) : null}
      {/* ⚡ The names just typed — here the moment Enter is pressed, until the re-read list draws their real rows. */}
      {writesOff ? null : <JustAdded eventId={eventId} variant="list" classes={{ row: styles.row ?? '', t: styles.t ?? '', s: styles.s ?? '', acts: styles.acts ?? '' }} />}
      {empty && !q ? <Handed>{empty}</Handed> : null}
      {/* ➕ SEARCH IS THE ADD (owner 2026-10-25): while the box holds words and the list has hits, the FIRST result adds
          what was typed — the same `addTyped` as Enter, for anyone who does not know Enter — and under it the other ways
          in. Marked as the first result, so the search pin (lib/search-pin.ts) shows it with the hits under it. With no
          hit, the block below is the add and carries the same ways. 🔒 search-or-add.test.ts */}
      {q && !noMatch && !writesOff ? (
        <div className={styles.typedAdd} data-typed-add="" data-search-result="">
          <SearchAddRow query={q} as="a guest" onAdd={addTypedOrSheet} />
          <TypedWays eventId={eventId} />
        </div>
      ) : null}
      {(empty && !q ? [] : sections).map((sec) => {
        const opened = isOpen(sec.key);
        const allSel = sec.guests.length > 0 && sec.guests.every((g) => selected.has(g.guest_id));
        const headId = `gs-sec-${sec.key.replace(/[^a-zA-Z0-9]/g, '-')}`;
        return (
          <section
            key={sec.key}
            id={headId}
            className={`${styles.sec} ${styles.rise} ${opened ? styles.open : ''}`}
            data-guest-section={sec.key}
            data-open={opened ? 'true' : 'false'}
          >
            <div className={styles.barWrap}>
              {selectMode ? (
                <button
                  type="button"
                  className={`${styles.ico} ${allSel ? styles.picked : ''}`}
                  aria-pressed={allSel}
                  aria-label={`${allSel ? 'Unselect' : 'Select'} everyone in ${sec.label}`}
                  onClick={() => toggleSection(sec.guests.map((g) => g.guest_id))}
                  data-select-section=""
                >
                  {allSel ? <Check aria-hidden strokeWidth={2.2} /> : null}
                </button>
              ) : null}
              <button
                type="button"
                className={styles.bar}
                aria-expanded={opened}
                onClick={(e) => tapSection(sec.key, e.currentTarget.closest('section'))}
                data-section-head=""
              >
                {selectMode ? null : (
                  <span className={styles.ico} aria-hidden>
                    <Mark mark={sec.mark} />
                  </span>
                )}
                <span className={styles.lab}>{sec.label}</span>
                <span className={styles.n}>
                  · <Count value={sec.guests.length} id={`gs-n-${sec.key}`} />
                </span>
                {selectMode ? (
                  <span className={styles.note}>
                    {allSel ? 'all selected' : 'tap ○ to select all'}
                  </span>
                ) : null}
                <ChevronDown className={styles.chev} style={selectMode ? { marginLeft: 0, flex: '0 0 auto' } : { flex: '0 0 auto' }} aria-hidden strokeWidth={1.9} width={18} height={18} />
              </button>
            </div>
            <div className={styles.fold}>
              <div>
                {sec.guests.length === 0 ? (
                  <p className={styles.empty}>Nobody here yet.</p>
                ) : (
                  (drawnRows.get(sec.key) ?? []).map((g, i, drawn) => (
                    <GuestRowLine
                      key={g.guest_id}
                      g={g}
                      plusWords={plusWords.get(g.guest_id) ?? null}
                      seatsOnList={seatRows.get(g.guest_id) ?? 0}
                      joined={joinedToTheRowAbove(g, drawn[i - 1])}
                      selectMode={selectMode}
                      picked={selected.has(g.guest_id)}
                      face={faceByGuest[g.guest_id]}
                      table={tableByGuest[g.guest_id] ?? null}
                      verbs={
                        writesOff
                          ? []
                          : rowVerbsFor(g, {
                              linked: linked ? linked.has(g.guest_id) : null,
                              chatHref: chatHrefFor?.(g.guest_id) ?? null,
                            })
                      }
                      chatHref={chatHrefFor?.(g.guest_id) ?? null}
                      onOpen={openCard}
                      onToggle={() => toggleOne(g.guest_id)}
                      onRemove={() => {
                        setRemoveError(null);
                        setToRemove([g.guest_id]);
                      }}
                      onRelease={() => releaseSeats([g.guest_id])}
                    />
                  ))
                )}
              </div>
            </div>
          </section>
        );
      })}
      {noMatch ? (
        <div className={styles.nomatch} data-no-match="">
          {writesOff ? null : <PeopleHits hits={peopleHits} onAdd={addPerson} />}
          <div className={styles.title}>
            {peopleHits.length > 0 && !writesOff ? `Not them? Add “${q}” as new` : writesOff ? `Nobody matches “${q}”` : `Nobody matches “${q}”. Add them below.`}
          </div>
          <p className={styles.body}>
            If that’s a name, add them — one tap, the rest later. Words like “attending”, “no reply”, “VIP” or a group name also work here.
          </p>
          {writesOff ? null : (
            <AddCardPicks
              eventId={eventId}
              hasSides={hasSides}
              roleSetKey={roleSetKey}
              roleNames={roleNames}
              groups={allGroups}
              picks={picks}
              setPicks={setPicks}
              onMadeGroup={(g) => setMadeGroups((prev) => (prev.some((m) => m.group_id === g.group_id) ? prev : [...prev, g]))}
            />
          )}
          {needs ? (
            <p className={styles.body} role="alert" data-search-needs="">
              {needs}
            </p>
          ) : null}
          {/* 📌 With no result this box is what a search shows: pinned just above the band (lib/search-pin.ts) — the Add,
              then the other ways in (owner 2026-10-25), so both stay in sight over the keyboard. */}
          <div data-search-none="">
          <span className={styles.acts} data-fit-acts="">
            {writesOff ? null : (
              <ActionButton
                tone="brand"
                main
                icon={Plus}
                label={searchAddLabel(q, 'a guest')}
                name={`Add “${q}” as a guest`}
                onClick={() => addTypedOrSheet(q)}
              />
            )}
            <ActionButton
              tone="neutral"
              icon={X}
              label="Clear"
              onClick={() => {
                if (fieldRef.current) fieldRef.current.value = '';
                setQ('');
              }}
            />
          </span>
          {writesOff ? null : <TypedWays eventId={eventId} />}
          </div>
        </div>
      ) : null}
      {/* Half a screen after the list, so the last guest reaches the middle (owner 2026-09-21). */}
      <div aria-hidden style={{ height: '50dvh' }} data-roster-runout="" />
    </div>
  );

  const tree = useMemo(() => mapTree(visible, arrange, facts), [visible, arrange, facts]);

  return (
    <GuestListHasSidesContext.Provider value={hasSides}>
      {toastNode}
      <div
        ref={rootRef}
        className={styles.screen}
        data-settled={settled ? 'true' : 'false'}
        data-guests-screen={gview}
        data-guests-copy={copy ? copy.freshness : undefined}
      >
        <div ref={stickRef} className={styles.stick} data-guests-stick="">
          {/* 🎚 THE ONE PILL SELECTOR (owner 2026-10-08: "adjust all pill selectors to this") — the app's template
              draws the track, the three views and the terracotta thumb that slides between them. Still links. */}
          <nav className={`${PILL_TRACK_CLASS} ${PILL_TRACK_GROUND}`} aria-label="Guest list views" data-guests-segmented="" data-tour="guests-views">
            <PillThumb />
            {seg('list', 'List', stats.total)}
            {seg('map', 'Map')}
            {/* "Setup" → "Settings" (owner 2026-10-23, one word — the same word as Home's ⚙ Settings). */}
            {seg('share', 'Settings')}
          </nav>
          {/* 📋 The copy line — in the flow, under the selector, never over anything (guest-copy-mark.tsx). */}
          <GuestListStatus copy={copy} fresh={props.measured} />
          {measured ? (
            <>
              <div className={`${styles.counts} ${styles.rise}`} data-roster-counts="" data-tour="guests-counts">
                {/* 👆 Each count is a door to exactly the guests it counts (`replyFilterMatches`, owner 2026-10-21). */}
                <span>{countDoor('attending', stats.yes, 'gs-yes', RSVP_ROW_WORDS.attending.toLowerCase())}</span>
                <span>· {countDoor('declined', stats.no, 'gs-no', RSVP_ROW_WORDS.declined.toLowerCase())}</span>
                <span>· {countDoor('none', stats.none, 'gs-none', RSVP_ROW_WORDS.pending.toLowerCase())}</span>
                {/* 🚪 "N TO INVITE" IS A DOOR (controller 2026-10-08: from the List — the tab people
                    land on — there was no way to start sending). It opens the ONE send run, the very
                    place Setup's "Send to N" opens (`guest-setup-rows.tsx` → `/guests/send`); the two
                    are held equal by `counts-equal-the-rows.test.ts`. With nobody left to invite it is
                    plain words, never a dead link. A refused read draws none of this line. */}
                {stats.toInvite > 0 ? (
                  <span className={styles.wine}>
                    ·{' '}
                    <Link href={`/dashboard/${eventId}/guests/send`} className={styles.countsDoor} data-roster-to-invite="door">
                      <b><Count value={stats.toInvite} id="gs-toinv" /></b> to invite
                    </Link>
                  </span>
                ) : (
                  <span className={styles.wine} data-roster-to-invite="words">
                    · <b><Count value={stats.toInvite} id="gs-toinv" /></b> to invite
                  </span>
                )}
                {/* 🪑 "+1s: N named · M no name yet" (owner 2026-10-21) — each half a door to the +1 filter, tapped again
                    to clear it; the same `plusOneFilterMatches` the rows below are filtered by. No +1s → not drawn. */}
                {plusTally.named + plusTally.unnamed > 0 ? (
                  <span data-roster-plus-ones="">
                    · +1s:{' '}
                    <button
                      type="button"
                      className={styles.countsDoor}
                      aria-pressed={plusFilter === 'named'}
                      onClick={() => pickPlus('named')}
                      data-plus-filter="named"
                    >
                      <b><Count value={plusTally.named} id="gs-plus-named" /></b> named
                    </button>{' '}
                    ·{' '}
                    <button
                      type="button"
                      className={styles.countsDoor}
                      aria-pressed={plusFilter === 'unnamed'}
                      onClick={() => pickPlus('unnamed')}
                      data-plus-filter="unnamed"
                    >
                      <b><Count value={plusTally.unnamed} id="gs-plus-unnamed" /></b> no name yet
                    </button>
                  </span>
                ) : null}
                {q || filtered ? (
                  <span className={styles.mute}>
                    · <Count value={shown} id="gs-shown" /> of {formatCount(stats.total)} shown
                  </span>
                ) : null}
                {filtered ? (
                  <button
                    type="button"
                    className={styles.countsDoor}
                    onClick={() => {
                      setReplyFilter(null);
                      setPlusFilter(null);
                    }}
                    data-roster-clear-filter=""
                  >
                    × Clear
                  </button>
                ) : null}
              </div>
              <div className={styles.meter} data-replied-meter="">
                <Fill value={replied} id="gs-replied" className={styles.meterFill} />
              </div>
              <div className={styles.replied}>
                <span>
                  <Count value={replied} format="pct" id="gs-replied-pct" /> replied
                </span>
                {/* 📥 THE LIST AS A SPREADSHEET, ONE TAP (owner 2026-10-16: "just have a excel file for their
                    guests"). The server writes it fresh, in the import template's own columns, so the same
                    file can be edited and uploaded again (`guests/export/route.ts`). A plain link — no
                    JavaScript, nothing added to any bundle. */}
                {copy?.freshness === 'failed' ? null : (
                  <a
                    href={`/dashboard/${eventId}/guests/export`}
                    download
                    className={`${styles.countsDoor} ${styles.export}`}
                    data-guests-export=""
                  >
                    <Download aria-hidden strokeWidth={1.9} />
                    Download as Excel
                  </a>
                )}
              </div>
              {/* 📏 A read beside the list that did not happen is SAID, here, in the strip's own words — never drawn
                  as "no groups" / "nobody seated". Only under a list that WAS read: a refused list has its own
                  words below and says them once. The link is the list's own Try again — a real round trip. */}
              {notLoaded ? (
                <p role="status" className={`${styles.counts} ${styles.mute}`} data-roster-not-loaded="">
                  <span>{notLoaded}</span>
                  <a href={`/dashboard/${eventId}/guests`} className={styles.countsDoor}>
                    Try again
                  </a>
                </p>
              ) : null}
            </>
          ) : null}
        </div>

        {gview === 'share' ? <Handed>{setup}</Handed> : gview === 'map' ? (
          <GuestMapCanvas
            rootLabel={rootLabel}
            tree={tree}
            isToInvite={isToInvite}
            plusWords={plusWords}
            onOpen={openCard}
            fitKey={`${arrange}|${q}`}
          />
        ) : (
          list
        )}

        {gview === 'share' ? null : (
          <div
            // The ONE shared glass row (BUTTON_RULE rule 7, `.sn-glass-row` in
            // globals.css, builder GR): the row tints and blurs what scrolls behind.
            // ONE THUMB ROW (owner 2026-10-22): no band under the List / Map row — each control is its own glass. The
            // Select mode's pills keep the shared glass row until they are drawn as glass pills of their own.
            className={selectMode && gview === 'list' ? `${styles.lower} sn-glass-row` : styles.lower}
            data-on={barOn ? 'true' : 'false'}
            data-guests-thumb=""
            data-last-seen-hold={selectMode ? '' : undefined}
          >
            <div ref={thumbRef} style={{ display: 'flex', flex: 1, minWidth: 0 }}>
              {thumb}
            </div>
          </div>
        )}

        <DeleteGuestSheet
          open={toRemove !== null}
          names={removeNames}
          busy={removing}
          error={removeError}
          onClose={() => setToRemove(null)}
          onConfirm={async () => {
            const ids = toRemove ?? [];
            const who = ids.length === 1 ? removeNames[0] || 'that guest' : `${formatCount(ids.length)} guests`;
            const refused = await remove(
              ids,
              () => {
                setToRemove(null);
                if (selectMode) leaveSelect();
              },
              who,
            );
            setRemoveError(refused);
          }}
        />
        {papicSheet ? (
          <GuestPapicBulkSheet
            eventId={eventId}
            ids={selectedIds}
            names={selectedIds.map((id) => byId.get(id)).filter((g): g is GuestRow => Boolean(g)).map((g) => plusWords.get(g.guest_id)?.name ?? displayPersonName(guestNameAsGiven(g) ?? guestDisplayName(g)))}
            start={papicSheet}
            onClose={() => setPapicSheet(null)}
            onDone={() => {
              setPapicSheet(null);
              leaveSelect();
            }}
          />
        ) : null}
        {newGroup ? (
        <GuestPopup
          onClose={() => setNewGroup(false)}
          rootClassName="fixed inset-0 z-[96] flex items-end justify-center tab:items-stretch tab:justify-end"
          panelClassName="relative w-full max-w-md rounded-t-3xl bg-cream pb-[max(env(safe-area-inset-bottom),16px)] shadow-[0_-30px_80px_-40px_rgba(26,26,26,0.4)] tab:max-w-none tab:w-[min(27.5rem,calc(100vw-3.5rem))] tab:rounded-none tab:rounded-l-3xl tab:shadow-[-30px_0_80px_-40px_rgba(26,26,26,0.4)]"
          labelledById="gs-new-group-title"
        >
          <div className="space-y-3 p-5 text-ink">
            <h2 id="gs-new-group-title" className="font-display text-xl">
              New group for {selected.size} {selected.size === 1 ? 'guest' : 'guests'}
            </h2>
            <NewGroupInlineForm eventId={eventId} selectedIds={selectedIds} onClose={() => setNewGroup(false)} />
          </div>
        </GuestPopup>
        ) : null}
      </div>
    </GuestListHasSidesContext.Provider>
  );
}

/* ═══ one guest row ═══ */


const PILL: Record<GuestRow['rsvp_status'], { cls: string; word: string }> = {
  attending: { cls: 'pillOk', word: `✓ ${RSVP_ROW_WORDS.attending}` },
  declined: { cls: 'pillMute', word: RSVP_ROW_WORDS.declined },
  maybe: { cls: 'pillWine', word: RSVP_ROW_WORDS.maybe },
  pending: { cls: 'pillMute', word: RSVP_ROW_WORDS.pending },
};

/**
 * 🤝 Is this row drawn as part of the guest above it? A +1 right after their guest (or after that guest's
 * earlier +1) — no divider between them: a guest and their +1 are one topic.
 */
function joinedToTheRowAbove(g: GuestRow, above: GuestRow | undefined): boolean {
  const host = g.plus_one_of_guest_id;
  return Boolean(host && above && (above.guest_id === host || above.plus_one_of_guest_id === host));
}

function GuestRowLine({
  g,
  plusWords,
  seatsOnList,
  joined,
  selectMode,
  picked,
  face,
  table,
  verbs,
  chatHref,
  onOpen,
  onToggle,
  onRemove,
  onRelease,
}: {
  g: GuestRow;
  /** Whose +1 this row is (`plusOneWordsFrom`); null for everyone else. */
  plusWords: PlusOneWords | null;
  /** This guest's seats that are rows on the list (`seatRowsByGuest`). */
  seatsOnList: number;
  joined: boolean;
  selectMode: boolean;
  picked: boolean;
  face?: string;
  table: string | null;
  verbs: readonly ('message' | 'edit' | 'remove' | 'release')[];
  chatHref: string | null;
  onOpen: (id: string, el: HTMLElement) => void;
  onToggle: () => void;
  onRemove: () => void;
  /** 🪑 A +1 with no name yet: their seat goes at once, with Undo. */
  onRelease: () => void;
}) {
  // 🪪 Shown cased (owner 2026-10-21, guest_page_fixes_2_4 fix 3 — "yes", one display rule): "pamela labriaga"
  // reads "Pamela Labriaga". Display only — search still reads every typed part (`nameHas`), and the boxes keep them.
  const name = plusWords?.name ?? displayPersonName(guestNameAsGiven(g) ?? guestDisplayName(g));
  const plus = plusOneSeats(g);
  // 🪑 A "+N" with fewer seat rows than N says so — never a +1 the list cannot show (`seatRowsByGuest`).
  const notAdded = Math.max(0, plus - seatsOnList);
  const pill = isToInvite(g) && g.rsvp_status === 'pending' ? { cls: 'pillGold', word: 'To invite' } : PILL[g.rsvp_status];
  const act = (e: React.MouseEvent<HTMLElement>) => (selectMode ? onToggle() : onOpen(g.guest_id, e.currentTarget));
  // A +1 shows their guest's side — the side follows the guest who brings them.
  const side = plusWords?.side ?? g.side;
  const sideCls = side === 'bride' ? styles.sideBride : side === 'groom' ? styles.sideGroom : styles.sideBoth;
  return (
    <div
      className={`${styles.g} ${picked ? styles.picked : ''} ${g.plus_one_of_guest_id ? styles.plus : ''} ${joined ? styles.joined : ''}`}
      data-guest-row=""
      // 🔦 The Guests tour rings the first row drawn (the engine takes the first visible match).
      data-tour="guests-row"
      data-guest-id={g.guest_id}
      data-plus-one-of={plusWords?.hostId}
      // 📌 A result: a search pins the first one under the chrome (lib/search-pin.ts).
      data-search-result=""
    >
      <button
        type="button"
        className={styles.ava}
        onClick={act}
        aria-label={`${selectMode ? (picked ? 'Unselect' : 'Select') : 'Open'} ${name}`}
        aria-pressed={selectMode ? picked : undefined}
      >
        {selectMode ? (
          picked ? <Check aria-hidden strokeWidth={2.2} /> : null
        ) : face ? (
          // 🖼 Sized in its own markup: a face is never drawn at its file's size before the list's stylesheet
          // arrives (owner 2026-10-16) — a-face-is-never-drawn-at-its-natural-size.test.ts.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={face} alt="" width={40} height={40} loading="lazy" />
        ) : (
          guestInitials(g)
        )}
      </button>
      <button type="button" className={styles.who} onClick={act} data-row-name="">
        <div className={styles.nm}>
          <span aria-hidden className={`${styles.dot} ${sideCls}`} />
          {/* ✂ The name gives way, never the buttons: one line, an ellipsis when Edit · Remove need the room. */}
          <span className={styles.nmt} data-row-name-text="">
            {name}
            {plusWords?.of ? <span className={styles.of}> · {plusWords.of}</span> : null}
          </span>
          {plus > 0 ? <span className={styles.pill}>+{plus}</span> : null}
        </div>
        <div className={styles.meta}>
          {g.passed_away ? (
            'In loving memory · not counted'
          ) : (
            <>
              <span className={`${styles.pill} ${styles[pill.cls]}`}>{pill.word}</span>
              {/* 🖐 A reply the host set says so, quietly (owner 2026-10-21: "Marked by you"). */}
              {replyMarkedByHost(g) ? <span className={styles.mute} data-reply-marked="">{' · marked'}</span> : null}
              {table ? ` · ${table}` : ''}
              {notAdded > 0 ? <span data-seat-not-added="">{` · +${notAdded} not added yet`}</span> : null}
              {g.guest_note ? ` · “${g.guest_note}”` : ''}
            </>
          )}
        </div>
      </button>
      {/* ➡ The buttons END the name's line (owner 2026-10-20: "edit and remove button can be in a row? on the right
          side?") — one line per guest. From 701 they keep their words; under 701 they are 44 × 44 icons, so each is
          named for its guest. Held by guest-row-actions-share-the-name-line.test.ts. */}
      {selectMode ? null : (
        <span className={styles.acts} data-fit-row="" data-row-acts="">
          {verbs.includes('message') && chatHref ? (
            <ActionButton tone="info" icon={MessageCircle} label="Message" name={`Message ${name}`} href={chatHref} />
          ) : null}
          {verbs.includes('edit') ? (
            <ActionButton tone="neutral" icon={Pencil} label="Edit" name={`Edit ${name}`} onClick={(e) => onOpen(g.guest_id, e.currentTarget)} />
          ) : null}
          {verbs.includes('remove') ? <ActionButton tone="danger" icon={X} label="Remove" name={`Remove ${name}`} onClick={onRemove} /> : null}
          {verbs.includes('release') ? (
            <ActionButton tone="danger" icon={Armchair} label="Release seat" name={`Release seat ${name}`} onClick={onRelease} />
          ) : null}
        </span>
      )}
    </div>
  );
}
