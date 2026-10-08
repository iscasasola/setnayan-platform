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
 *      `✕ Remove` — no Invite (G34), no Nudge (G28), every row ONE state (G36);
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
  Check,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  CircleHelp,
  Ellipsis,
  Heart,
  House,
  ListFilter,
  Mail,
  MessageCircle,
  Minus,
  PartyPopper,
  Pencil,
  Plus,
  SquareCheck,
  Star,
  Tag,
  User,
  Users,
  X,
} from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Count, Fill } from '@/components/count';
import { formatCount } from '@/lib/format-number';
import { PickMenu, type PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { useInspectorContext } from '@/app/_components/inspector/inspector-column';
import { PILL_TRACK_CLASS, PILL_TRACK_GROUND, PillThumb, pillSegClass } from '@/app/_components/pill-selector';
import { GuestPopup } from './guest-popup';
import { usePeekToast } from './use-peek-toast';
import {
  countsTowardEvent,
  guestDisplayName,
  guestFullName,
  guestInitials,
  plusOneSeats,
  RSVP_ROW_WORDS,
  SIDE_LABELS,
  type GuestRow,
  type GuestSide,
} from '@/lib/guests';
import { projectGuests } from '@/lib/guest-optimistic';
import {
  isToInvite,
  MAP_ARRANGE,
  mapTree,
  ROSTER_VIEWS,
  rosterSearchMatches,
  rosterSections,
  rosterStats,
  rowVerbsFor,
  SEARCH_WAIT_MS,
  type MapArrange,
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
import { GuestListHasSidesContext } from './guest-list-has-sides-context';
import { openAddGuest } from './add-guest-sheet';
import { useRowState } from './use-row-state';
import { GuestMapCanvas } from './guest-map-canvas';
import styles from './guests-screen.module.css';


export type GuestsScreenProps = {
  eventId: string;
  gview: 'list' | 'map' | 'share';
  /** Every guest, importance-sorted by the page (the honoree first). */
  guests: GuestRow[];
  /** The read was measured — a refused read never prints counts. */
  measured: boolean;
  hasSides: boolean;
  /** guest_id → their custom groups' labels, alphabetical. */
  groupsByGuest: Record<string, string[]>;
  /** The event's custom groups — Set… ▾ › Group. */
  groups: { group_id: string; label: string }[];
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
};

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

function Mark({ mark }: { mark: SectionMark }) {
  if (mark.kind === 'letter') return <>{mark.letter}</>;
  const Icon = SECTION_ICON[mark.icon];
  return <Icon aria-hidden strokeWidth={1.9} />;
}

/** The shell bar's height while it shows — the sticky block sits under it. */
function useShellBarOffset(root: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    const bar = document.querySelector<HTMLElement>('.shell-topbar');
    if (!el) return;
    const sync = () => {
      const shown = bar && bar.getAttribute('data-hidden') !== 'true' && getComputedStyle(bar).display !== 'none';
      el.style.setProperty('--gs-top', shown ? `${bar!.getBoundingClientRect().height}px` : '0px');
    };
    sync();
    if (!bar) return;
    const mo = new MutationObserver(sync);
    mo.observe(bar, { attributes: true, attributeFilter: ['data-hidden', 'style', 'class'] });
    window.addEventListener('resize', sync);
    return () => {
      mo.disconnect();
      window.removeEventListener('resize', sync);
    };
  }, [root]);
}

/**
 * A slot the page HANDS this screen as a prop (`setup`, `empty`) — an element made on the server. Placed straight among this
 * screen's other children it is a child of an array, and React 19's dev build asks it for a `key` ("Each child in a list
 * should have a unique key … It was passed a child from GuestsLabPage", seen on the lab 2026-10-09). Held as the ONE child of
 * a fragment it is not in a list, so nothing is asked of it. Draws nothing of its own.
 */
function Handed({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function GuestsScreen(props: GuestsScreenProps) {
  const {
    eventId,
    gview,
    guests,
    measured,
    hasSides,
    groupsByGuest,
    groups,
    tables,
    tableByGuest,
    songsByGuest,
    linkedGuestIds,
    faceByGuest,
    requests,
    rootLabel,
    initialQuery = '',
    initialSelect = false,
    chatHrefFor,
    setup,
    empty,
  } = props;
  const router = useRouter();
  const [toast, toastNode] = usePeekToast();
  const inspector = useInspectorContext();
  const roleNames = useRoleNames();
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

  const facts: RosterFacts = useMemo(
    () => ({
      roleNames,
      hasSides,
      groupsOf: (id) => groupsByGuest[id] ?? [],
      tableOf: (id) => tableByGuest[id] ?? null,
      songsOf: (id) => songsByGuest[id] ?? [],
    }),
    [roleNames, hasSides, groupsByGuest, tableByGuest, songsByGuest],
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

  const visible = useMemo(() => (q ? roster.filter((g) => rosterSearchMatches(q, g, facts)) : roster), [roster, q, facts]);

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
  // A search opens every section that has a hit (G19 — a hit inside a folded
  // section was invisible, a failure that looked like "not found").
  const isOpen = (key: string) => (q ? true : open.has(key));
  const allOpen = sections.length > 0 && sections.every((s) => isOpen(s.key));

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

  // ── On a computer the thumb row spans the content column (the rail stays clear).
  useEffect(() => {
    const root = rootRef.current;
    const col = root?.parentElement;
    if (!root || !col) return;
    const sync = () => {
      const r = col.getBoundingClientRect();
      root.style.setProperty('--gs-left', `${Math.max(0, r.left)}px`);
      root.style.setProperty('--gs-right', `${Math.max(0, window.innerWidth - r.right)}px`);
    };
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
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
  useRowState(listRef, [sections, selectMode, gview]);
  useRowState(thumbRef, [selectMode, gview, q && visible.length === 0, selected.size, view, arrange]);

  // ── Open a guest's card — the page's inspector (the same panel as before).
  const openCard = (id: string, el: HTMLElement) => {
    if (inspector) inspector.select(id, el);
    else router.push(`/dashboard/${eventId}/guests/${id}`);
  };

  // ── Remove: the one warning, then the shipped soft delete with Undo.
  const { removing, remove } = useGuestRemoval(eventId);
  const [toRemove, setToRemove] = useState<string[] | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const byId = useMemo(() => new Map(roster.map((g) => [g.guest_id, g] as const)), [roster]);
  /* The names the delete sheet opened with — read while those rows are still on the list (a refusal is told by name). */
  const removeNames = (toRemove ?? []).map((id) => {
    const g = byId.get(id);
    return g ? (guestFullName(g) ?? guestDisplayName(g)) : '';
  });

  // ── Set… ▾ (group · table · side) — the shipped bulk writer, one field at a time.
  const [newGroup, setNewGroup] = useState(false);
  const { bulkApplyRoleAndGroup, sendRunHref } = useGuestActions();
  const applyBulk = async (field: 'group_id' | 'table' | 'side', value: string) => {
    const fd = new FormData();
    for (const id of selected) fd.append('guest_ids[]', id);
    fd.set(field, value);
    await bulkApplyRoleAndGroup(eventId, fd);
    router.refresh();
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
  const replied = stats.total ? Math.round(((stats.yes + stats.no) / stats.total) * 100) : 0;
  const shown = visible.filter((g) => countsTowardEvent(g)).length;
  const noMatch = Boolean(q) && visible.length === 0;

  const seg = (key: 'list' | 'map' | 'share', label: string, count?: number) => (
    <Link
      key={key}
      className={`${pillSegClass(gview === key)} [&>b]:font-medium [&>b]:opacity-80`}
      href={key === 'list' ? `/dashboard/${eventId}/guests` : `/dashboard/${eventId}/guests?gview=${key}`}
      aria-current={gview === key ? 'page' : undefined}
      scroll={false}
      data-guests-seg={key}
    >
      {label}
      {count !== undefined && measured ? <b><Count value={count} id={`gs-seg-${key}`} /></b> : null}
    </Link>
  );

  /* ═══ the thumb row ═══ */
  const addBtn = (
    <ActionButton
      tone="brand"
      main
      icon={Plus}
      label="Add"
      onClick={() => openAddGuest(q)}
      data-testid="thumb-add"
    />
  );
  const sortPick = (
    <span data-pick="" data-thumb-sort="">
      <PickMenu
        label="Sort — groups the list by"
        value={view}
        options={views.map((v) => ({ key: v.key, label: v.label, icon: <ListFilter className="h-[18px] w-[18px]" strokeWidth={1.9} /> }))}
        onPick={(k) => {
          const next = k as RosterView;
          setView(next);
          setOpen(firstOpen(next));
          window.scrollTo({ top: 0 });
        }}
      />
    </span>
  );
  const arrangePick = (
    <span data-pick="" data-thumb-arrange="">
      <PickMenu
        label="Arrange the map by"
        value={arrange}
        options={arranges.map((v) => ({ key: v.key, label: v.label, icon: <ListFilter className="h-[18px] w-[18px]" strokeWidth={1.9} /> }))}
        onPick={(k) => setArrange(k as MapArrange)}
      />
    </span>
  );
  const field = (
    <input
      ref={fieldRef}
      className={styles.field}
      defaultValue={q}
      placeholder="Search or add"
      autoComplete="off"
      aria-label="Search guests or add"
      data-fit-field=""
      data-guests-search=""
      onInput={(e) => onType(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key !== 'Enter') return;
        const v = e.currentTarget.value.trim();
        if (timer.current) clearTimeout(timer.current);
        setQ(v);
        if (v && !roster.some((g) => rosterSearchMatches(v, g, facts))) openAddGuest(v);
      }}
    />
  );

  const setOptions: PickOption[] = [
    ...groups.map((g) => ({ key: `group:${g.group_id}`, label: g.label, group: 'Group' })),
    { key: 'group:new', label: 'New group…', group: 'Group' },
    ...tables.map((t) => ({ key: `table:${t.tableId}`, label: t.label, group: 'Table' })),
    { key: 'table:none', label: 'Not seated', group: 'Table' },
    ...(hasSides
      ? (['bride', 'groom', 'both'] as GuestSide[]).map((s) => ({ key: `side:${s}`, label: SIDE_LABELS[s], group: 'Side' }))
      : []),
  ];
  const selectedIds = [...selected];
  const invitable = selectedIds
    .map((id) => byId.get(id))
    .filter((g): g is GuestRow => Boolean(g) && isToInvite(g!));
  const removable = selectedIds.filter((id) => {
    const g = byId.get(id);
    return g && g.role !== 'bride' && g.role !== 'groom';
  });

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
                const [field, ...rest] = k.split(':');
                const value = rest.join(':');
                void applyBulk(field === 'group' ? 'group_id' : (field as 'table' | 'side'), value);
              }}
            />
          </span>
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
          <ActionButton tone="neutral" icon={SquareCheck} label="Done" onClick={leaveSelect} data-testid="bulk-done" />
        </span>
      </div>
    );
  } else if (gview === 'list') {
    thumb = (
      <div className={styles.thumb} data-fit-row="" data-thumb="list">
        <span className={styles.acts} data-fit-acts="" data-side="left">
          <ActionButton
            tone="neutral"
            icon={allOpen ? ChevronsDownUp : ChevronsUpDown}
            label={allOpen ? 'Collapse all' : 'Expand all'}
            onClick={() => setOpen(allOpen ? new Set() : new Set(sections.map((s) => s.key)))}
            data-testid="thumb-expand"
          />
          <ActionButton tone="neutral" icon={SquareCheck} label="Select" onClick={() => setSelectMode(true)} data-testid="thumb-select" />
        </span>
        {field}
        <span className={styles.acts} data-fit-acts="" data-side="right">
          {noMatch ? addBtn : sortPick}
        </span>
      </div>
    );
  } else if (gview === 'map') {
    thumb = (
      <div className={styles.thumb} data-fit-row="" data-thumb="map">
        {field}
        <span className={styles.acts} data-fit-acts="" data-side="right">
          {noMatch ? addBtn : arrangePick}
        </span>
      </div>
    );
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
      {empty && !q ? <Handed>{empty}</Handed> : null}
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
                  sec.guests.map((g) => (
                    <GuestRowLine
                      key={g.guest_id}
                      g={g}
                      selectMode={selectMode}
                      picked={selected.has(g.guest_id)}
                      face={faceByGuest[g.guest_id]}
                      table={tableByGuest[g.guest_id] ?? null}
                      verbs={rowVerbsFor(g, {
                        linked: linked ? linked.has(g.guest_id) : null,
                        chatHref: chatHrefFor?.(g.guest_id) ?? null,
                      })}
                      chatHref={chatHrefFor?.(g.guest_id) ?? null}
                      onOpen={openCard}
                      onToggle={() => toggleOne(g.guest_id)}
                      onRemove={() => {
                        setRemoveError(null);
                        setToRemove([g.guest_id]);
                      }}
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
          <div className={styles.title}>Nobody matches “{q}”</div>
          <p className={styles.body}>
            If that’s a name, add them — one tap, the rest later. Words like “attending”, “no reply”, “VIP” or a group name also work here.
          </p>
          <span className={styles.acts} data-fit-acts="">
            <ActionButton tone="brand" main icon={Plus} label={`Add “${q}”`} onClick={() => openAddGuest(q)} />
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
      <div ref={rootRef} className={styles.screen} data-settled={settled ? 'true' : 'false'} data-guests-screen={gview}>
        <div ref={stickRef} className={styles.stick} data-guests-stick="">
          {/* 🎚 THE ONE PILL SELECTOR (owner 2026-10-08: "adjust all pill selectors to this") — the app's template
              draws the track, the three views and the terracotta thumb that slides between them. Still links. */}
          <nav className={`${PILL_TRACK_CLASS} ${PILL_TRACK_GROUND}`} aria-label="Guest list views" data-guests-segmented="">
            <PillThumb />
            {seg('list', 'List', stats.total)}
            {seg('map', 'Map')}
            {seg('share', 'Setup')}
          </nav>
          {measured ? (
            <>
              <div className={`${styles.counts} ${styles.rise}`} data-roster-counts="">
                <span>
                  <b>
                    <Count value={stats.yes} id="gs-yes" />
                  </b>{' '}
                  {RSVP_ROW_WORDS.attending.toLowerCase()}
                </span>
                <span>
                  · <b><Count value={stats.no} id="gs-no" /></b> {RSVP_ROW_WORDS.declined.toLowerCase()}
                </span>
                <span>
                  · <b><Count value={stats.none} id="gs-none" /></b> {RSVP_ROW_WORDS.pending.toLowerCase()}
                </span>
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
                {q ? (
                  <span className={styles.mute}>
                    · <Count value={shown} id="gs-shown" /> of {formatCount(stats.total)} shown
                  </span>
                ) : null}
              </div>
              <div className={styles.meter} data-replied-meter="">
                <Fill value={replied} id="gs-replied" className={styles.meterFill} />
              </div>
              <div className={styles.replied}>
                <Count value={replied} format="pct" id="gs-replied-pct" /> replied
              </div>
            </>
          ) : null}
        </div>

        {gview === 'share' ? <Handed>{setup}</Handed> : gview === 'map' ? (
          <GuestMapCanvas
            rootLabel={rootLabel}
            tree={tree}
            isToInvite={isToInvite}
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
            className={`${styles.lower} sn-glass-row`}
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
        {newGroup ? (
        <GuestPopup
          onClose={() => setNewGroup(false)}
          rootClassName="fixed inset-0 z-[96] flex items-end justify-center lg:items-center"
          panelClassName="relative w-full max-w-md rounded-t-3xl bg-cream pb-[max(env(safe-area-inset-bottom),16px)] shadow-[0_-30px_80px_-40px_rgba(26,26,26,0.4)] lg:rounded-3xl"
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

function GuestRowLine({
  g,
  selectMode,
  picked,
  face,
  table,
  verbs,
  chatHref,
  onOpen,
  onToggle,
  onRemove,
}: {
  g: GuestRow;
  selectMode: boolean;
  picked: boolean;
  face?: string;
  table: string | null;
  verbs: readonly ('message' | 'edit' | 'remove')[];
  chatHref: string | null;
  onOpen: (id: string, el: HTMLElement) => void;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const name = guestFullName(g) ?? guestDisplayName(g);
  const plus = plusOneSeats(g);
  const pill = isToInvite(g) && g.rsvp_status === 'pending' ? { cls: 'pillGold', word: 'To invite' } : PILL[g.rsvp_status];
  const act = (e: React.MouseEvent<HTMLElement>) => (selectMode ? onToggle() : onOpen(g.guest_id, e.currentTarget));
  const sideCls = g.side === 'bride' ? styles.sideBride : g.side === 'groom' ? styles.sideGroom : styles.sideBoth;
  return (
    <div
      className={`${styles.g} ${picked ? styles.picked : ''} ${g.plus_one_of_guest_id ? styles.plus : ''}`}
      data-guest-row=""
      data-guest-id={g.guest_id}
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
          // eslint-disable-next-line @next/next/no-img-element
          <img src={face} alt="" loading="lazy" />
        ) : (
          guestInitials(g)
        )}
      </button>
      <button type="button" className={styles.who} onClick={act} data-row-name="">
        <div className={styles.nm}>
          <span aria-hidden className={`${styles.dot} ${sideCls}`} />
          {name}
          {plus > 0 ? <span className={styles.pill}>+{plus}</span> : null}
        </div>
        <div className={styles.meta}>
          {g.passed_away ? (
            'In loving memory · not counted'
          ) : (
            <>
              <span className={`${styles.pill} ${styles[pill.cls]}`}>{pill.word}</span>
              {table ? ` · ${table}` : ''}
              {g.guest_note ? ` · “${g.guest_note}”` : ''}
            </>
          )}
        </div>
      </button>
      {selectMode ? null : (
        <span className={styles.acts} data-fit-row="" data-row-acts="">
          {verbs.includes('message') && chatHref ? (
            <ActionButton tone="info" icon={MessageCircle} label="Message" href={chatHref} />
          ) : null}
          {verbs.includes('edit') ? (
            <ActionButton tone="neutral" icon={Pencil} label="Edit" onClick={(e) => onOpen(g.guest_id, e.currentTarget)} />
          ) : null}
          {verbs.includes('remove') ? <ActionButton tone="danger" icon={X} label="Remove" onClick={onRemove} /> : null}
        </span>
      )}
    </div>
  );
}
