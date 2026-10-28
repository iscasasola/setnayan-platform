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
 *   1. the first row — `List N · Map · ⚙` (one segmented control, G1) — scrolling WITH the page at rest, then the
 *      summary carousel (owner 2026-10-27, style A "the ring": Total guests + requests · the four reply counts +
 *      Invite N › · +1s — `SnapCarousel`); once the carousel has scrolled away the row PINS ONCE as one 44 px row,
 *      `List · Map · ✓ ✕ ? · ⚙` (no Invite); `--gs-stick-h` is the one row's height;
 *   2. List: the SECTIONS of
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
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  CircleHelp,
  Clock,
  Ellipsis,
  Heart,
  House,
  Mail,
  Minus,
  PartyPopper,
  Plus,
  Send,
  Share,
  SquareCheck,
  Star,
  Tag,
  Upload,
  User,
  Users,
  Trash2,
  X,
} from 'lucide-react';
import { ActionButton, actionButtonClass } from '@/components/action-button';
import { InfoTip } from '@/app/_components/info-tip';
import { ThumbRow, type ThumbField, type ThumbMenu } from '@/components/thumb-row';
import { useThumbRowArrivesLast } from '@/lib/thumb-row-arrives-last';
import { Count } from '@/components/count';
import { SnapCarousel, type CarouselCard } from '@/components/snap-carousel';
import { formatCount } from '@/lib/format-number';
import { PickMenu, type PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { useInspectorContext } from '@/app/_components/inspector/inspector-column';
import { PILL_TRACK_CLASS, PILL_TRACK_GROUND, PillThumb, pillSegClass } from '@/app/_components/pill-selector';
import { GuestPopup } from './guest-popup';
import { GUESTS_EXCEL_KEY, useGuestsExcel } from './guests-excel-button';
import { Handed } from './handed';
import { MenuSettingsButton } from '@/app/_components/menu-settings-button';
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
  mayBeInvited,
  mapTree,
  hostMaySetReply,
  plusOneFilterMatches,
  plusOneTally,
  replyFilterMatches,
  plusOneWordsFrom,
  PLUS_ONE_FILTERS,
  seatRowsByGuest,
  rosterSearchMatches,
  rosterSections,
  rosterStats,
  rowVerbsFor,
  type RowVerb,
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
import { withStandIns, proxyForWords, representedByWords, type PairOnRow as StandInOnRow, type StandingInOnRow } from '@/lib/guest-proxy';
import { PickWhoContext, useGuestActions } from './guest-actions-context';
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
import { GuestInviteCell } from './guest-invite-cell';
import type { SendInviteGuest } from './send-invite';
import type { InviteEventFacts } from '@/lib/guest-invite-message';
import { invitationLinkOn } from '@/lib/invitation-link';
import { useKeepGuestList, useKeptGuestList, type GuestsCopyState } from './guest-list-copy';
import type { GuestListRow } from '@/lib/guest-list-rows';
import { GuestListStatus } from './guest-copy-mark';
import { TitlesWaiting, type TitleWaitingPerson } from './titles-waiting';
import { displayPersonName } from '@/lib/person-name-case';
import { GUESTS_MAKER_VIEWS, GUESTS_VIEW_LABEL, guestsViewHref, isGuestsMakerView, type GuestsMakerView, type GuestsView } from '@/lib/guests-views';
import {
  NO_GUESTS_FILTER,
  hrefWithGuestsFilter,
  listGroupOf,
  mapGroupOf,
  sortGuestsFor,
  writeGuestsFilter,
  type GuestsFilter,
} from '@/lib/guests-filter';
import { GuestsLensContext, type GuestsLens } from './guests-lens';
import { guestsFilterMenu } from './guests-filter-menu';


export type GuestsScreenProps = {
  eventId: string;
  /** The event's role set (`resolveRoleSetKeyForEvent`) — the Add card's Role list. Absent = the wedding set. */
  roleSetKey?: string | null;
  gview: GuestsView;
  /**
   * 🗂 R4 · the views this event has, in the row's order (`lib/guests-views.ts`): List · Map always, Seats where the type
   * has a seat plan, March where it prints an entourage (the couple's). Absent: List · Map.
   */
  views?: readonly GuestsView[];
  /**
   * 🗂 R4 · Seats and March — the shipped makers, drawn whole by the page (the seat plan's own page, the march maker) and
   * streamed WITH it, so a switch to either asks the server for nothing (owner 2026-10-29, *"fewest requests"*). Each is
   * mounted the first time its view is opened, and kept (hidden) after.
   */
  bodies?: Partial<Record<GuestsMakerView, ReactNode>>;
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
   * 📤 WHAT A ROW'S SHARE SENDS (owner 2026-10-27, "GUEST ROW = SHARE + DELETE") — the event's address, its words and the
   * couple's wording, read ONCE by the page (the same `loadInviteSetup` the open card uses), and each invitable guest's
   * own token. Only guests who `mayBeInvited` and have a token are in `tokens`; a guest absent from it gets no Share.
   * Null → no row draws Share (no address yet, or a viewer who may not send).
   */
  invite?: RowInvite | null;
  /**
   * ⚙ GUESTS SETTINGS — the sheet's rows (`InvitePanel` → `GuestSetupRows`), drawn by the server. Present → the ⚙ at
   * the right end of the List · Map row (owner 2026-10-27, settings per menu call 1: the "Settings" segment became the
   * ⚙). Null → no ⚙ (not the couple).
   */
  setup?: ReactNode;
  /** `?settings=1` — the sheet opens with the page (a link's way in). */
  settingsOpen?: boolean;
  /** `?row=` — the row the open sheet lands on (its `data-setup-row`). */
  settingsRow?: string | null;
  /**
   * 🔗 The event lets guests in with ONE link for everyone ("Anyone with the link", `readGuestsGetIn` = 'one_qr'). With
   * no list to walk, the carousel's To invite card reads "One link for everyone · Share" (owner 2026-10-27, "THE SEND RUN
   * ALSO SERVES A ONE-QR EVENT") — Share opens the ⚙ sheet on its "Your one link" row (link · Copy · Share · the QR).
   */
  oneQr?: boolean;
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
  /**
   * ⇅ R4 slice 1 · the ONE Show · Group by · Sort the address asked for (`?gshow=` · `?ggroup=` · `?gsort=`, parsed by
   * `parseGuestsFilter`) — shared by the carousel's count doors, the List, the Map, and the Show of Seats and March.
   * Absent: everyone, each view's own grouping, the shipped order.
   */
  filter?: GuestsFilter;
};

/** 📤 A row's Share: the event's invitation address + words, and guest_id → their own QR token. */
export type RowInvite = {
  base: string;
  tokens: Record<string, string>;
  facts: InviteEventFacts;
  template: string | null;
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

/** The view row without R4's two (a lab or an older caller that names none). */
const DEFAULT_VIEWS: readonly GuestsView[] = ['list', 'map'];

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
    gview: gviewAsked,
    views: guestsViews = DEFAULT_VIEWS,
    measured,
    notLoaded = null,
    hasSides,
    groupsByGuest,
    groups,
    tables,
    tableByGuest,
    songsByGuest,
    faceByGuest,
    requests,
    titlesWaiting = [],
    rootLabel,
    initialQuery = '',
    initialSelect = false,
    invite = null,
    setup,
    settingsOpen: settingsAsked = false,
    settingsRow = null,
    oneQr = false,
    empty,
    copy = null,
    roleSetKey = null,
    viewOnly = false,
    filter: filterAsked = NO_GUESTS_FILTER,
  } = live;
  /* 🗂 R4 · THE VIEW IS A CLIENT SWITCH (owner 2026-10-29, *"as smooth as possible with fastest load and fewest
     requests"*): List · Map · Seats · March change here, in place — the address follows (`replaceState`, so a reload or
     a shared link lands on the same view) and nothing is asked of the server; every view's data came with the page. A
     new address from the server (a door, Back) is taken as the view. */
  const [gview, setGview] = useState<GuestsView>(gviewAsked);
  const filterRef = useRef<GuestsFilter>(filterAsked);
  const [seenViews, setSeenViews] = useState<ReadonlySet<GuestsView>>(() => new Set([gviewAsked]));
  useEffect(() => {
    setGview(gviewAsked);
    setSeenViews((s) => (s.has(gviewAsked) ? s : new Set([...s, gviewAsked])));
  }, [gviewAsked]);
  const pickView = (v: GuestsView) => {
    setGview(v);
    setSeenViews((s) => (s.has(v) ? s : new Set([...s, v])));
    // ⇅ The shared Show · Group by · Sort rides along — a switch keeps what is shown (lib/guests-filter.ts).
    window.history.replaceState(window.history.state, '', hrefWithGuestsFilter(guestsViewHref(eventId, v), filterRef.current));
  };
  /** A plain press switches in place; a press that asks for a new tab or window keeps the link's own way. */
  const onViewPress = (v: GuestsView) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    pickView(v);
  };
  /** 🗂 R4 · Seats or March: a shipped maker drawn whole — no summary, no list, no thumb row of the List's. */
  const makerView = isGuestsMakerView(gview);
  // 🔒 Nothing that writes is offered while this is the phone's old copy OR the viewer may only look.
  const writesOff = copy !== null || viewOnly;
  // ⚙ Guests settings — opened by the ⚙ in place; a link (`?settings=1&row=…`) opens it with the page. Closing drops
  // the link's words from the address without a navigation, so Back does not reopen it and nothing redraws.
  const [settingsOpen, setSettingsOpen] = useState(settingsAsked);
  const [landRow, setLandRow] = useState<string | null>(settingsRow);
  const openSettings = useCallback((open: boolean) => {
    setSettingsOpen(open);
    if (open) return;
    setLandRow(null);
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has('settings') && !url.searchParams.has('row')) return;
      url.searchParams.delete('settings');
      url.searchParams.delete('row');
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    } catch {
      /* the address keeps its words; the sheet is closed either way */
    }
  }, []);
  useEffect(() => {
    const settingsRow = landRow;
    if (!settingsOpen || !settingsRow) return;
    // The rows stream in after the sheet: look for the named row a few times, then land on it.
    let tries = 0;
    const t = window.setInterval(() => {
      const el = document.querySelector(`[data-menu-settings-sheet="guests"] [data-setup-row="${CSS.escape(settingsRow)}"]`);
      if (el || ++tries > 20) {
        window.clearInterval(t);
        el?.scrollIntoView({ block: 'center' });
      }
    }, 150);
    return () => window.clearInterval(t);
  }, [settingsOpen, landRow]);
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
  const stripRef = useRef<HTMLDivElement>(null);
  const holdRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLInputElement>(null);
  useShellBarOffset(rootRef);

  // ── The optimistic overlay: a removed guest vanishes at once, Undo returns them.
  const optimistic = useGuestOptimistic();
  useEffect(() => {
    guestOptimistic.reconcile(guests);
  }, [guests]);
  /* 🧍 TWO ROWS, LINKED, COUNTED ONCE (owner 2026-10-27 "B" — the one-row version hid the proxy: "Cannot find her on the
     list anymore"): the role holder's row says "Represented by … · not counted" (it keeps `represented_by_guest_id`,
     so `countsTowardEvent` leaves it out); the proxy's own row — their reply, ticket, Invite — says "Proxy for …"
     (`withStandIns`, lib/guest-proxy.ts). Searching either name finds both. */
  const projected = useMemo(() => projectGuests(guests, optimistic), [guests, optimistic]);
  const { rows: roster, pairs: standIns, standingIn } = useMemo(() => withStandIns(projected), [projected]);

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
      // 🧍 The role holder and the stand-in are each found by the other's name too.
      companionsOf: (id) => {
        const other = standIns.get(id)?.proxyName ?? standingIn.get(id)?.holderName;
        return other ? [...(companions.get(id) ?? []), other] : (companions.get(id) ?? []);
      },
      guestById: (id) => rosterById.get(id),
    }),
    [roleNames, hasSides, groupsByGuest, tableByGuest, songsByGuest, companions, rosterById, standIns, standingIn],
  );

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
  // ☑ A cold `?select=to-invite` (⚙ › Pick who's link) lands narrowed to To invite, as the in-place press does.
  /* ⇅ THE ONE SHOW · GROUP BY · SORT (R4 slice 1, owner 2026-10-29 — `lib/guests-filter.ts`): the count doors, the ⇅ of
     every view, the List and the Map read and write THIS — and the address keeps it (`replaceState`, nothing asked of
     the server). `replyFilter` is its Show, under the name every door already used. */
  const [filter, setFilter] = useState<GuestsFilter>(() => (initialSelect ? { ...filterAsked, show: 'toinvite' } : filterAsked));
  useEffect(() => {
    filterRef.current = filter;
    try {
      const url = new URL(window.location.href);
      const next = writeGuestsFilter(url.searchParams, filter).toString();
      if (next === url.searchParams.toString()) return;
      window.history.replaceState(window.history.state, '', `${url.pathname}${next ? `?${next}` : ''}${url.hash}`);
    } catch {
      /* the address keeps its old words; the screen shows the new filter either way */
    }
  }, [filter]);
  const replyFilter = filter.show;
  const setReplyFilter = useCallback(
    (next: ReplyFilter | null | ((now: ReplyFilter | null) => ReplyFilter | null)) =>
      setFilter((f) => ({ ...f, show: typeof next === 'function' ? next(f.show) : next })),
    [],
  );
  // A guest found by NAME brings their +1s (`withTheirPlusOnes`) — a +1 is never left behind by a search.
  const visible = useMemo(() => {
    const found = q ? withTheirPlusOnes(q, roster.filter((g) => rosterSearchMatches(q, g, facts)), roster) : roster;
    const narrowed =
      plusFilter || replyFilter
        ? found.filter((g) => plusOneFilterMatches(g, plusFilter) && replyFilterMatches(g, replyFilter))
        : found;
    // ⇅ Sort re-orders the same rows (Importance = the page's own order); a +1 stays beside their guest.
    return sortGuestsFor(narrowed, filter.sort, (id) => tableByGuest[id] ?? null) as GuestRow[];
  }, [roster, q, facts, plusFilter, replyFilter, filter.sort, tableByGuest]);

  // ── The one Sort (list) and the one Arrange (map).
  // ⇅ Group by is the shared filter's (List: Role by default; the Map its own default where it has no Last name).
  const view: RosterView = listGroupOf(filter);
  const arrange: MapArrange = mapGroupOf(filter, hasSides);

  const sections = useMemo(() => rosterSections(visible, view, facts), [visible, view, facts]);

  // Open on arrival: the first section after the celebrants (the prototype's
  // seeded state — Bride & Groom folded, VIP open). A new Sort opens the same.
  const firstOpen = (view0: RosterView) => {
    const secs = rosterSections(roster, view0, facts);
    const first = secs.find((x) => !x.celebrants) ?? secs[0];
    return new Set(first ? [first.key] : []);
  };
  const [open, setOpen] = useState<Set<string>>(() => firstOpen(listGroupOf(filterAsked)));
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
    if (!initialSelect) return;
    setSelectMode(true);
    setReplyFilter('toinvite');
  }, [initialSelect, setReplyFilter]);
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
  /* ☑ ⚙ › Invitations' "Pick who", IN PLACE (owner 2026-10-28, "pick who … does not show anything"): the sheet closes,
     Select turns on, the list narrows to To invite — the carousel's own `toinvite` door. Nothing navigates. On the Map
     (no rows to pick) it opens the List the cold-load way, which lands in the same state (`initialSelect`).
     🔒 pick-who-narrows-in-place.test.ts */
  const pickWho = useCallback(() => {
    openSettings(false);
    if (gview !== 'list') {
      router.push(`/dashboard/${eventId}/guests?select=to-invite`);
      return;
    }
    setSelected(new Set());
    setSelectMode(true);
    setReplyFilter('toinvite');
    window.scrollTo({ top: 0 });
  }, [openSettings, gview, router, eventId, setReplyFilter]);

  // ── Settled: the rise plays once per page/mode, never on a re-render.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    setSettled(false);
    const t = setTimeout(() => setSettled(true), 500);
    return () => clearTimeout(t);
  }, [gview]);

  // ── The thumb row arrives LAST — after the carousel and the open section have built up (owner 2026-10-27,
  //    `lib/thumb-row-arrives-last.ts`); List ↔ Map builds up again, so it re-arms on the view.
  const barOn = useThumbRowArrivesLast(gview);

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

  // ── 📌 THE ONE PINNED ROW, PINNED ONCE (owner 2026-10-27: "pinned approve" — Guests B; "On the pinned the selectors
  //    should stay but simplified"; then "the selector double pins. we want them to pin only the new way and not the first
  //    pin it does" — DECISION_LOG "GUESTS: THE SUMMARY BECOMES ONE AUTO-SCROLLING CAROUSEL; THE SELECTOR PINS ONCE").
  //    At rest the List · Map pill is NOT sticky: it scrolls with the page, the summary carousel under it. Only once the
  //    carousel's bottom has passed under where the row would sit does the block pin (`data-collapsed` → fixed under
  //    the bar, in its holder's column) with its summary face `List · Map · ✓ ✕ ? · ⚙` — no Invite (that lives on the
  //    carousel's To invite card). The holder keeps the block's height in the flow, so nothing under it moves. Written as
  //    ATTRIBUTES and custom properties, only when they change, never as state: the list never re-renders for a scroll.
  //    List only — the Map is one canvas and keeps its shipped sticky row. 🔒 lib/the-pinned-row-is-one-row.test.ts
  useEffect(() => {
    const st = stickRef.current;
    const hold = holdRef.current;
    const strip = stripRef.current;
    const root = rootRef.current;
    if (!st) return;
    if (!strip || !hold || !root || gview !== 'list') {
      st.removeAttribute('data-collapsed');
      return;
    }
    let raf = 0;
    let last: boolean | null = null;
    let place = '';
    const read = () => {
      raf = 0;
      // The shell bar's height while it shows (`useShellBarOffset` writes it inline) — the row pins under it.
      const bar = parseFloat(root.style.getPropertyValue('--gs-top')) || 0;
      const on = strip.getBoundingClientRect().bottom <= bar + st.offsetHeight + 2;
      if (on !== last) {
        last = on;
        st.toggleAttribute('data-collapsed', on);
      }
      // Pinned, the row is `position: fixed` — it takes its holder's column edges (the desk's rail, a card column).
      const r = hold.getBoundingClientRect();
      const next = `${Math.round(r.left)}|${Math.round(r.width)}`;
      if (next !== place) {
        place = next;
        st.style.setProperty('--gs-pin-l', `${Math.round(r.left)}px`);
        st.style.setProperty('--gs-pin-w', `${Math.round(r.width)}px`);
      }
    };
    const soon = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener('scroll', soon, { passive: true });
    window.addEventListener('resize', soon);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(soon) : null;
    ro?.observe(hold);
    if (root.parentElement) ro?.observe(root.parentElement);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener('scroll', soon);
      window.removeEventListener('resize', soon);
    };
  }, [gview, measured]);

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
  /* ═══ 🎠 THE SUMMARY CAROUSEL — STYLE A, THE RING (owner 2026-10-27, "ring looks good"; DECISION_LOG "APPROVED —
     GUESTS CAROUSEL STYLE A (THE RING), COMPACT"; prototype `guests_summary_carousel_2026-10-27/` frames rest · oneqr ·
     attention). Three grouped cards, each ≤ 96 px at 390, each with its ⓘ top-right (the details live there):
       ① Total guests — the ring fills to the % replied (attending green · not coming red over the grey track) and
          "● N requests to join ›"; the whole card opens the requests page (the one the old "Review" strip opened);
       ② Attending · Not coming · No reply · To invite — four counts, each the door to its filter (`pickReply`), then
          `Invite N ›`, the ONE send run (`/guests/send`) — or "One link for everyone · Share" on a one-link event with no
          list to walk;
       ③ +1s — named / no name yet as a two-part bar, each half the door to its filter (`pickPlus`).
     Same numbers, same doors, same hrefs as the counts strip they replace. 🔒 the-summary-carousel-holds-the-doors.test.ts */
  const pct = (n: number) => (stats.total ? (n / stats.total) * 100 : 0);
  const cardTip = (label: string, tip: ReactNode) => (
    <InfoTip label={label} labelClassName="sr-only" align="end" className={styles.cardTip}>
      {tip}
    </InfoTip>
  );
  /** A count on card ②: a dot in the reply's colour, the number, the word under it — the door to exactly those guests. */
  const countDoor = (f: ReplyFilter, value: number, id: string, word: string) => (
    <button
      type="button"
      className={styles.mini}
      aria-pressed={replyFilter === f}
      onClick={() => pickReply(f)}
      data-reply-filter={f}
    >
      <b>
        <i className={styles.countDot} data-dot={f} aria-hidden />
        <Count value={value} id={id} />
      </b>{' '}
      <span className={styles.miniWord}>{word}</span>
    </button>
  );
  const listToWalk = roster.some((g) => mayBeInvited(g));
  const inviteFoot: ReactNode =
    stats.toInvite > 0 ? (
      <>
        <span className={styles.cardSub}>
          <Count value={stats.toInvite} id="gs-toinv-sub" /> not yet sent their invitation
        </span>
        <Link
          href={`/dashboard/${eventId}/guests/send`}
          className={actionButtonClass('brand', { main: true, extra: styles.cardInvite })}
          data-roster-to-invite="door"
        >
          <span className="lbl">
            Invite <Count value={stats.toInvite} id="gs-toinv" />
          </span>
          <ChevronRight aria-hidden strokeWidth={2} />
        </Link>
      </>
    ) : listToWalk ? (
      <span className={`${styles.cardSub} ${styles.allInvited}`} data-roster-to-invite="words">
        <Check aria-hidden strokeWidth={2} /> Everyone invited
      </span>
    ) : oneQr ? (
      <>
        <span className={styles.cardSub} data-roster-to-invite="one-link">
          One link for everyone
        </span>
        {setup ? (
          <button
            type="button"
            className={actionButtonClass('brand', { main: true, extra: styles.cardInvite })}
            onClick={() => {
              setLandRow('one-link');
              openSettings(true);
            }}
            data-roster-share-link=""
          >
            <Share aria-hidden strokeWidth={2} />
            <span className="lbl">Share</span>
          </button>
        ) : null}
      </>
    ) : null;
  const summaryCards: CarouselCard[] = [
    {
      key: 'total',
      label: 'Total guests',
      node: (
        <div
          className={`${styles.card} ${requests > 0 ? styles.cardAttn : ''}`}
          data-guests-card="total"
          // The ring's two arcs, as shares of the whole (attending, then not coming after it).
          style={{ '--gs-yes': pct(stats.yes), '--gs-no': pct(stats.no) } as React.CSSProperties}
        >
          <Link
            href={`/dashboard/${eventId}/guests/claims`}
            className={styles.cardDoor}
            aria-label={`${formatCount(stats.total)} guests, ${replied}% replied, ${formatCount(requests)} ${requests === 1 ? 'request' : 'requests'} to join — open requests`}
            data-requests-door=""
          />
          <span className={styles.ringRow}>
            <span className={styles.ring} data-replied-ring="" aria-hidden>
              <svg viewBox="0 0 44 44">
                <circle className={styles.ringTrack} cx="22" cy="22" r="19" />
                <circle className={`${styles.ringArc} ${styles.ringYes}`} cx="22" cy="22" r="19" pathLength={100} data-arc="yes" />
                <circle className={`${styles.ringArc} ${styles.ringNo}`} cx="22" cy="22" r="19" pathLength={100} data-arc="no" />
              </svg>
              <b>
                <Count value={stats.total} id="gs-total" />
              </b>
            </span>
            <span className={styles.beside}>
              <span className={styles.cardLabel}>Total guests</span>
              <span className={styles.cardBig}>
                <Count value={replied} format="pct" id="gs-replied-pct" /> replied
              </span>
              {requests > 0 ? (
                <span className={styles.reqOn} data-requests-waiting="">
                  <i aria-hidden className={styles.reqDot} />
                  <Count value={requests} id="gs-req" /> {requests === 1 ? 'request' : 'requests'} to join
                  <ChevronRight aria-hidden strokeWidth={2.2} className={styles.reqChev} />
                </span>
              ) : (
                <span className={styles.reqOff}>
                  No requests waiting
                  <ChevronRight aria-hidden strokeWidth={2.2} className={styles.reqChev} />
                </span>
              )}
            </span>
          </span>
          {cardTip(
            'Total guests',
            <>Counted from the list just now. Ring: green attending, red not coming. Tap the card for requests from your event link.</>,
          )}
        </div>
      ),
    },
    {
      key: 'replies',
      label: 'Replies and who is still to invite',
      node: (
        <div className={styles.card} data-guests-card="replies">
          <span className={styles.four}>
            {countDoor('attending', stats.yes, 'gs-yes', RSVP_ROW_WORDS.attending)}
            {countDoor('declined', stats.no, 'gs-no', RSVP_ROW_WORDS.declined)}
            {countDoor('none', stats.none, 'gs-none', RSVP_ROW_WORDS.pending)}
            {countDoor('toinvite', stats.toInvite, 'gs-toinvite', 'To invite')}
          </span>
          {inviteFoot ? <span className={styles.cardFoot}>{inviteFoot}</span> : null}
          {cardTip(
            'Replies',
            <>Tap a number to see just those guests; again to see everyone. Invite sends to everyone still to invite, one at a time.</>,
          )}
        </div>
      ),
    },
    ...(plusTally.named + plusTally.unnamed > 0
      ? [
          {
            key: 'plus',
            label: '+1s',
            node: (
              <div className={styles.card} data-guests-card="plus">
                <span className={styles.plusHead}>
                  <span className={styles.cardLabel} data-roster-plus-ones="">
                    +1s · <b><Count value={plusTally.named + plusTally.unnamed} id="gs-plus-all" /></b>
                  </span>
                  <span className={styles.legend} aria-hidden>
                    <span>
                      <i className={styles.countDot} data-dot="named" />
                      <b>{formatCount(plusTally.named)}</b> named
                    </span>
                    <span>
                      <i className={styles.countDot} data-dot="unnamed" />
                      <b>{formatCount(plusTally.unnamed)}</b> no name yet
                    </span>
                  </span>
                </span>
                {/* 🪑 Each half of the bar is the door to the +1 filter (owner 2026-10-21; the same `plusOneFilterMatches`
                    the rows are filtered by), its width its share; tapped again, everyone. */}
                <span className={styles.split}>
                  {(
                    [
                      ['named', plusTally.named, 'named', 'gs-plus-named'],
                      ['unnamed', plusTally.unnamed, 'no name yet', 'gs-plus-unnamed'],
                    ] as const
                  ).map(([k, v, word, id]) => (
                    <button
                      key={k}
                      type="button"
                      className={styles.half}
                      data-half={k}
                      style={{ flexGrow: v, flexBasis: 0, minWidth: v > 0 ? 28 : 0 }}
                      hidden={v === 0}
                      aria-pressed={plusFilter === k}
                      onClick={() => pickPlus(k)}
                      data-plus-filter={k}
                    >
                      <span className="sr-only">
                        <b><Count value={v} id={id} /></b> {word}
                      </span>
                    </button>
                  ))}
                </span>
                {cardTip(
                  '+1s',
                  <>“Named” +1s have a name; “no name yet” seats still wait for one. Tap a part of the bar to see just those.</>,
                )}
              </div>
            ),
          },
        ]
      : []),
  ];

  /** The pinned row's count: the SAME door (`pickReply`, `data-reply-filter`) drawn small — a mark and the number; the
      word is for a screen reader. Pressed = underlined, never boxed. */
  const pinDoor = (f: ReplyFilter, value: number, id: string, word: string, Mark: typeof Check) => (
    <button
      key={f}
      type="button"
      className={styles.pinCount}
      aria-pressed={replyFilter === f}
      onClick={() => pickReply(f)}
      data-reply-filter={f}
      data-pin-dot={f}
    >
      <Mark aria-hidden strokeWidth={2.4} />
      <b><Count value={value} id={id} /></b>
      <span className="sr-only"> {word}</span>
    </button>
  );
  /** The pinned row's selector: the same views as links, small and words only (owner 2026-10-27, "selectors should
      stay but simplified"). The ⚙ is the full row's own, and stays on screen pinned. */
  const pinSeg = (key: GuestsView, label: string) => (
    <Link
      key={key}
      className={`${pillSegClass(gview === key)} ${styles.pinSegChoice}`}
      href={guestsViewHref(eventId, key)}
      aria-current={gview === key ? 'page' : undefined}
      scroll={false}
      onClick={onViewPress(key)}
      data-guests-pin-seg={key}
    >
      {label}
    </Link>
  );

  const seg = (key: GuestsView, label: string, count?: number) => (
    <Link
      key={key}
      className={`${pillSegClass(gview === key)} [&>b]:font-medium [&>b]:opacity-80`}
      href={guestsViewHref(eventId, key)}
      aria-current={gview === key ? 'page' : undefined}
      scroll={false}
      onClick={onViewPress(key)}
      data-guests-seg={key}
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
  const addWayIcon: Record<AddWayKey, typeof Users> = { people: Users, import: Upload };
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
  /* 📤 SAVE AS EXCEL (owner 2026-10-27, "FILE BUTTONS ARE A SHARE BUTTON") — the counts strip that drew "⤓ Excel" is
     the carousel now, so the list's file is a ≡ choice wearing the SHARE icon: the shipped save (`usePrintSave` →
     the phone's share sheet / a download), never a link the app would render in place. Not on the phone's failed
     copy (there is no fresh list to write). 🔒 lib/guest-export-file.test.ts */
  const excel = useGuestsExcel(eventId, toast);
  const fileOptions: PickOption[] =
    copy?.freshness === 'failed'
      ? []
      : [{ key: GUESTS_EXCEL_KEY, label: excel.label, group: 'File', icon: <Share className="h-[18px] w-[18px]" strokeWidth={1.9} /> }];
  /** ⇅ A pick in the shared menu: the one filter changes; a new Group by opens its first heading (as the shipped Sort
      did) and clears the +1 narrowing; the list goes back to its top. */
  const pickFilter = (next: GuestsFilter) => {
    if (listGroupOf(next) !== view) {
      setPlusFilter(null);
      setOpen(firstOpen(listGroupOf(next)));
    }
    setFilter(next);
    window.scrollTo({ top: 0 });
  };
  /* ⇅ THE LIST'S ROUND (R4 slice 1): Show · Group by · Sort — the shared state — then the shipped ≡ items it held: +1 ·
     Select… · File · the ways to add. The same seat, the same icon. */
  const sortMenu: ThumbMenu = guestsFilterMenu({
    view: 'list',
    filter,
    onFilter: pickFilter,
    hasSides,
    mark: 'data-thumb-sort',
    tour: 'guests-sort',
    label: 'Show, sort, select or add',
    alsoOn: plusFilter !== null,
    extras: ([] as PickOption[]).concat(
      // 🪑 "+1 ▾ Named · No name yet" (owner 2026-10-21) — offered only when the list has +1s; a new Group by clears it.
      plusTally.named + plusTally.unnamed > 0
        ? PLUS_ONE_FILTERS.map((f) => ({
            key: `plus:${f.key}`,
            label: f.label,
            group: '+1',
            icon: <Armchair className="h-[18px] w-[18px]" strokeWidth={1.9} />,
            trail: plusFilter === f.key ? { text: '✓', tone: 'ok' as const, label: 'shown now' } : undefined,
          }))
        : [],
      // ☑ Select lives in this menu (owner 2026-10-22, question 1) — it was the row's fifth round.
      writesOff ? [] : [{ key: 'select', label: 'Select…', group: 'List', icon: <SquareCheck className="h-[18px] w-[18px]" strokeWidth={1.9} /> }],
      fileOptions,
      addWays,
    ),
    onExtra: (k) => {
      if (pickedAddWay(k)) return;
      if (k === GUESTS_EXCEL_KEY) return excel.save();
      if (k === 'select') return setSelectMode(true);
      if (k.startsWith('plus:')) {
        setPlusFilter((now) => (now === k.slice(5) ? null : (k.slice(5) as PlusOneFilter)));
        window.scrollTo({ top: 0 });
      }
    },
  });
  /* ⇅ THE MAP'S ROUND: Show · Group by (the SAME state as the List's — v18: the Map has no "Grouped by" chip of its own),
     then the ways to add. */
  const arrangeMenu: ThumbMenu = guestsFilterMenu({
    view: 'map',
    filter,
    onFilter: setFilter,
    hasSides,
    mark: 'data-thumb-arrange',
    label: 'Show, group or add',
    extras: addWays,
    onExtra: (k) => void pickedAddWay(k),
  });
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
    /* ＋ THE MAP'S MAIN VERB (R4 slice 1, prototype v12): Add guest — the shipped add sheet; the List keeps its own seats
       (the field is its add). A viewer who may not write gets no ＋. */
    thumb = (
      <ThumbRow
        name="guests-map"
        field={field}
        right={[arrangeMenu]}
        action={writesOff ? null : { icon: Plus, label: 'Add guest', onClick: () => openAddGuest(''), testId: 'map-add-guest' }}
      />
    );
  }

  /* ═══ the list ═══ */
  const list = (
    <div ref={listRef} data-guest-rows="">
      {/* 👤 Requests to join are card ① of the summary carousel now (owner 2026-10-27) — no strip here. */}
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
            className={`${styles.sec} ${styles.accSec} ${styles.rise} ${opened ? styles.open : ''}`}
            data-guest-section={sec.key}
            data-open={opened ? 'true' : 'false'}
          >
            {/* 🪗 The foldable header's one mark (owner 2026-10-27, "FOLDABLE HEADERS ARE MARKED BY THE ICON CHIP"): the
                shared `.sn-acc-head` — chip grey closed, terracotta open, one divider under it, no band. */}
            <div className={`${styles.barWrap} sn-acc-head`} data-open={opened ? '' : undefined}>
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
                  <span className={`${styles.ico} sn-acc-chip`} aria-hidden>
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
                      standIn={standIns.get(g.guest_id) ?? null}
                      standingInFor={standingIn.get(g.guest_id) ?? null}
                      seatsOnList={seatRows.get(g.guest_id) ?? 0}
                      joined={joinedToTheRowAbove(g, drawn[i - 1])}
                      selectMode={selectMode}
                      picked={selected.has(g.guest_id)}
                      face={faceByGuest[g.guest_id]}
                      // 🧍 The two sit in ONE seat — the proxy’s (the role’s seat moved to them).
                      table={tableByGuest[g.guest_id] ?? null}
                      verbs={writesOff ? [] : rowVerbsFor(g, { shareable: Boolean(invite?.tokens[g.guest_id]) })}
                      eventId={eventId}
                      invite={invite}
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

  /* ⇅ THE LENS SEATS AND MARCH READ (`guests-lens.tsx`): the view on screen, the row's seat, the shared filter, and the
     two questions they cannot answer alone — does a guest pass Show, and whom do these words find — answered off THIS
     list with the shipped rules (`replyFilterMatches`, `rosterSearchMatches`). */
  const [thumbSlot, setThumbSlot] = useState<HTMLElement | null>(null);
  const lens = useMemo<GuestsLens>(
    () => ({
      view: gview,
      slot: thumbSlot,
      ThumbRow,
      filter,
      setFilter,
      hasSides,
      shows: (id) => {
        const g = rosterById.get(id);
        return !g || replyFilterMatches(g, filter.show);
      },
      find: (words) => {
        const w = words.trim();
        return new Set(w ? roster.filter((g) => rosterSearchMatches(w, g, facts)).map((g) => g.guest_id) : []);
      },
    }),
    [gview, thumbSlot, filter, hasSides, rosterById, roster, facts],
  );

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
        {/* 📌 The holder keeps the block's height in the flow while the block itself is pinned (fixed) — pinning moves
            nothing under it (`--gs-stick-h`, measured off the block). */}
        <div ref={holdRef} className={styles.stickHold} data-guests-stick-hold="">
        <div ref={stickRef} className={`${styles.stick} ${styles.pinned}`} data-guests-stick="" data-has-gear={setup ? '' : undefined}>
          {/* 📌 ONE PINNED ROW, TWO FACES, PINNED ONCE (owner 2026-10-27, Guests B + "selectors should stay but
              simplified" + "the selector … pin only the new way"): 44 px — the summary face is laid over the full pill
              (absolute, the pill's own box), so the swap moves nothing. At rest the block scrolls with the page; it pins
              only once the carousel has gone. The summary is drawn by `PinnedSummary` (below) from the SAME doors.
              🔒 lib/the-pinned-row-is-one-row.test.ts */}
          {measured && gview === 'list' ? (
            <PinnedSummary
              segs={guestsViews.map((v) => pinSeg(v, GUESTS_VIEW_LABEL[v]))}
              doors={[
                pinDoor('attending', stats.yes, 'gs-pin-yes', RSVP_ROW_WORDS.attending, Check),
                pinDoor('declined', stats.no, 'gs-pin-no', RSVP_ROW_WORDS.declined, X),
                pinDoor('none', stats.none, 'gs-pin-none', RSVP_ROW_WORDS.pending, CircleHelp),
              ]}
            />
          ) : null}
          {/* 🎚 THE ONE PILL SELECTOR (owner 2026-10-08: "adjust all pill selectors to this") — the app's template
              draws the track, the views and the terracotta thumb that slides between them. Still links.
              ⚙ THE FIRST ROW: List · Map, then the menu's ⚙ at its right end (owner 2026-10-27, settings per menu — the
              "Settings" segment became the ⚙, the same door and spot as every menu; `menu-settings-button.tsx`).
              ONE mounted ⚙ for BOTH faces ("EVERY MENU'S ⚙ RIDES ITS PINNED ROW TOO"): the pill fades when pinned, the
              ⚙ does not — the summary face stops short of it (`[data-has-gear] .face`). */}
          <div className="flex items-center gap-2" data-first-row="">
            <nav className={`${PILL_TRACK_CLASS} ${PILL_TRACK_GROUND} min-w-0 flex-1`} aria-label="Guest list views" data-guests-segmented="" data-tour="guests-views">
              <PillThumb />
              {/* 🗂 R4 · List · Map · Seats · March — the SAME pill selector extended (owner 2026-10-27 "GUESTS = LIST ·
                  MAP · SEATS · MARCH"; the approved Guests selector is this segmented row, "PINNED ROWS KEEP THEIR
                  SELECTORS — SIMPLIFIED"). Each view is a link, so a view is an address an old door can land on. */}
              {guestsViews.map((v) => seg(v, GUESTS_VIEW_LABEL[v], v === 'list' ? stats.total : undefined))}
            </nav>
            {setup ? (
              <MenuSettingsButton menu="guests" open={settingsOpen} onOpenChange={openSettings} tour="guests-setup">
                <PickWhoContext.Provider value={writesOff ? null : pickWho}>{setup}</PickWhoContext.Provider>
              </MenuSettingsButton>
            ) : null}
          </div>
          {/* 📋 The copy line — in the flow, under the selector, never over anything (guest-copy-mark.tsx). */}
          <GuestListStatus copy={copy} fresh={props.measured} />
        </div>
        </div>

        {measured && !makerView ? (
          <>
            <div className={`${styles.summary} ${styles.rise}`} ref={stripRef} data-roster-counts="" data-tour="guests-counts">
              <SnapCarousel cards={summaryCards} label="Guest summary" attrs={{ 'data-guests-carousel': '' }} />
              {/* What a search or a door is showing — "N of M shown · × Clear" — only while one is on. */}
              {q || filtered ? (
                <p className={`${styles.counts} ${styles.mute} ${styles.shownLine}`} data-roster-shown="">
                  <span>
                    <Count value={shown} id="gs-shown" /> of {formatCount(stats.total)} shown
                  </span>
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
                </p>
              ) : null}
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

        {/* 🗂 R4: Seats and March — the shipped makers, whole. Mounted when first opened, then KEPT (hidden) — a switch
            back finds them as they were, nothing re-read. ⇅ R4 slice 1: they read the lens (the shared Show, the shared
            search's matches) and draw THE thumb row into this screen's own seat (`thumbSlot`). */}
        <GuestsLensContext.Provider value={lens}>
          {GUESTS_MAKER_VIEWS.map((v) =>
            seenViews.has(v) && props.bodies?.[v] ? (
              <div key={v} data-guests-view-body={v} className="min-w-0" hidden={gview !== v}>
                {props.bodies[v]}
              </div>
            ) : null,
          )}
        </GuestsLensContext.Provider>
        {makerView ? null : gview === 'map' ? (
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
            {makerView ? (
              /* 🗂 Seats · March draw their ThumbRow HERE (a portal, `guests-lens.tsx`) — the same seat, glass and slide as
                 the List's; whatever rises above it (a seat's "Pick a guest" bar, a toast) stacks over it. */
              <div ref={setThumbSlot} data-guests-thumb-slot={gview} className="pointer-events-none flex min-w-0 flex-1 flex-col gap-2 [&>*]:pointer-events-auto" />
            ) : (
              <div ref={thumbRef} style={{ display: 'flex', flex: 1, minWidth: 0 }}>
                {thumb}
              </div>
            )}
          </div>

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


/**
 * 🏷 THE ROW'S REPLY PILL — ONE FAMILY (owner 2026-10-27, DECISION_LOG "THE ROW REPLY PILLS ARE ONE FAMILY", option A of
 * `prototypes/guests_reply_pills_2026-10-27/`): every state wears its icon and its own colour — the carousel card ②'s
 * dot colours, so the card and the rows say one thing. Before, only Attending had an icon, Not coming was the grey of
 * No reply, and To invite was the avatars' gold. To invite is an OUTLINE: a to-do, never the avatar's fill.
 */
const PILL: Record<GuestRow['rsvp_status'] | 'toinvite', { cls: string; word: string; Icon: typeof Check }> = {
  attending: { cls: 'pillOk', word: RSVP_ROW_WORDS.attending, Icon: Check },
  declined: { cls: 'pillNo', word: RSVP_ROW_WORDS.declined, Icon: X },
  maybe: { cls: 'pillWine', word: RSVP_ROW_WORDS.maybe, Icon: CircleHelp },
  pending: { cls: 'pillMute', word: RSVP_ROW_WORDS.pending, Icon: Clock },
  toinvite: { cls: 'pillGold', word: 'To invite', Icon: Send },
};

/**
 * 🤝 Is this row drawn as part of the guest above it? A +1 right after their guest (or after that guest's
 * earlier +1) — no divider between them: a guest and their +1 are one topic.
 */
/** 📌 The pinned row's summary face (owner 2026-10-27, Guests B + "On the pinned the selectors should stay but
    simplified"; amended by the approved carousel: "Pinned row: List · Map · ✓ ✕ ? · ⚙ (no Invite), pins once"):
    `List · Map` (the shipped pill, small, words only) · the three reply doors; the ⚙ is the block's own. Every part is
    built by the screen from the SAME doors as the carousel (`pickReply`, `data-reply-filter`); this only lays them in
    one 44-px row over the full pill. Hidden until the carousel has scrolled under the row. */
function PinnedSummary({ segs, doors }: { segs: ReactNode[]; doors: ReactNode[] }) {
  return (
    <div className={`${styles.face} ${styles.faceAlt}`} data-guests-pin-face="summary">
      <nav className={`${PILL_TRACK_CLASS} ${PILL_TRACK_GROUND} ${styles.pinSeg}`} aria-label="Guest list views, pinned" data-guests-pin-segmented="">
        <PillThumb />
        {segs}
      </nav>
      <span className={styles.pinCounts}>{doors}</span>
    </div>
  );
}

function joinedToTheRowAbove(g: GuestRow, above: GuestRow | undefined): boolean {
  const host = g.plus_one_of_guest_id;
  return Boolean(host && above && (above.guest_id === host || above.plus_one_of_guest_id === host));
}

/** 🧍 The table is the proxy's — the role's seat moved to them (trigger `the_proxy_takes_the_seat`). */
function GuestRowLine({
  g,
  plusWords,
  standIn = null,
  standingInFor = null,
  seatsOnList,
  joined,
  selectMode,
  picked,
  face,
  table,
  verbs,
  eventId,
  invite,
  onOpen,
  onToggle,
  onRemove,
  onRelease,
}: {
  g: GuestRow;
  /** Whose +1 this row is (`plusOneWordsFrom`); null for everyone else. */
  plusWords: PlusOneWords | null;
  /** 🧍 On a ROLE HOLDER's row: the proxy standing in for them — "Represented by … · not counted" (`withStandIns`). */
  standIn?: StandInOnRow | null;
  /** 🧍 On the PROXY's own row: the role holder they stand in for — "Proxy for …". */
  standingInFor?: StandingInOnRow | null;
  /** This guest's seats that are rows on the list (`seatRowsByGuest`). */
  seatsOnList: number;
  joined: boolean;
  selectMode: boolean;
  picked: boolean;
  face?: string;
  table: string | null;
  /** `rowVerbsFor`: Share · Delete (or Release seat) — nothing else (owner 2026-10-27). */
  verbs: readonly RowVerb[];
  eventId: string;
  /** What the Share sends — the page's one read (`RowInvite`); the guest's own token is in `invite.tokens`. */
  invite: RowInvite | null;
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
  const pill = isToInvite(g) && g.rsvp_status === 'pending' ? PILL.toinvite : PILL[g.rsvp_status];
  // 🪑 A +1 with no name yet travels on their guest's invitation (the send run skips them): the row says whose, instead
  // of a To invite of its own on every seat. The COUNT rule (`isToInvite`) is untouched — only the drawing.
  const rides = plusWords?.name ? plusWords.host : null;
  const act = (e: React.MouseEvent<HTMLElement>) => (selectMode ? onToggle() : onOpen(g.guest_id, e.currentTarget));
  // A +1 shows their guest's side — the side follows the guest who brings them.
  const side = plusWords?.side ?? g.side;
  const sideCls = side === 'bride' ? styles.sideBride : side === 'groom' ? styles.sideGroom : styles.sideBoth;
  // 📤 Their invitation, as the card's Invite builds it (guest-card-body.tsx): their name as given in the event's Name
  // style, their own link. Null → no Share (no token handed in for them).
  const token = invite?.tokens[g.guest_id];
  const share: SendInviteGuest | null =
    invite && token
      ? {
          guestId: g.guest_id,
          formalName: guestNameAsGiven(g, invite.facts.nameStyle),
          firstName: g.first_name,
          fullName: name,
          inviteUrl: invitationLinkOn(invite.base, token),
          sentAt: g.invitation_sent_at ?? null,
        }
      : null;
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
          ) : standIn ? (
            /* 🧍 The role holder does not come — their proxy's own row below counts for both. */
            <span className={styles.mute} data-row-represented-by={standIn.proxyId}>
              {representedByWords(standIn.proxyName)} · not counted
            </span>
          ) : (
            <>
              {/* 🧍 The proxy's own row: who they stand in for, then their own reply. */}
              {standingInFor ? (
                <span className={styles.mute} data-row-proxy-for={standingInFor.holderId}>
                  {proxyForWords(standingInFor.holderName)}
                  {' · '}
                </span>
              ) : null}
              {rides ? (
                <span className={styles.mute} data-row-rides-on="">
                  On {rides}’s invitation
                </span>
              ) : (
                <span className={`${styles.pill} ${styles[pill.cls]}`} data-reply-pill="">
                  <pill.Icon aria-hidden className={styles.pillIco} strokeWidth={2.4} />
                  {pill.word}
                </span>
              )}
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
          side?") — one line per guest. 🗂 SHARE · DELETE, NOTHING ELSE (owner 2026-10-27: "share and delete only"): the
          pencil went — the whole row opens the card, where editing happens. From 701 they keep their words; under 701
          they are 44 × 44 icons, so each is named for its guest. Held by guest-row-actions-share-the-name-line.test.ts
          and the-guest-row-is-share-and-delete.test.ts. */}
      {selectMode ? null : (
        <span className={styles.acts} data-fit-row="" data-row-acts="">
          {verbs.includes('share') && share ? (
            <GuestInviteCell eventId={eventId} layout="icon" guest={share} facts={invite!.facts} template={invite!.template} />
          ) : null}
          {verbs.includes('remove') ? <ActionButton tone="danger" icon={Trash2} label="Delete" name={`Delete ${name}`} onClick={onRemove} /> : null}
          {verbs.includes('release') ? (
            <ActionButton tone="danger" icon={Armchair} label="Release seat" name={`Release seat ${name}`} onClick={onRelease} />
          ) : null}
        </span>
      )}
    </div>
  );
}
