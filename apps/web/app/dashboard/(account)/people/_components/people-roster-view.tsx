'use client';

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import {
  CalendarHeart,
  Check,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  CircleDashed,
  Clock,
  HandHeart,
  Heart,
  HeartHandshake,
  ListFilter,
  Network,
  Pencil,
  Plus,
  Send,
  SquareCheck,
  UserPlus,
  Users,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Popover } from '@/app/dashboard/[eventId]/guests/_components/overlay-primitives';
import { GuestPopup, GuestConfirmActions } from '@/app/dashboard/[eventId]/guests/_components/guest-popup';
import { useShellBarOffset } from '@/app/dashboard/[eventId]/guests/_components/use-shell-bar-offset';
import gs from '@/app/dashboard/[eventId]/guests/_components/guests-screen.module.css';
import { PickMenu, type PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { ActionButton } from '@/components/action-button';
import type { ConnectionRelation } from '@/lib/people-connections';
import { RELATION_LABEL, connectionRequestSentence } from '@/lib/people-add';
import type { PeopleRoster, RosterPerson, RosterState } from '@/lib/people-roster';
import { peopleViewHref, type PeopleView, type PeopleViewGates } from '@/lib/people-views';
import { useRouter } from 'next/navigation';
import { rosterNameMatches, rosterQuery } from '@/lib/people-name-match';
import { PEOPLE_PATH, PERSON_PARAM, personCardKey } from '@/lib/people-person-link';
import {
  didNotConfirmLine,
  isRequestForMe,
  isWaitingOnThem,
  labelRequestLine,
  offersPlanTogether,
  waitingForLine,
} from '@/lib/people-label-handshake';
import {
  confirmConnection,
  declineConnection,
  invitePersonToSamahan,
  resendConnectionInvitation,
  setConnectionLabel,
  withdrawConnection,
} from '../actions';
import { formatCount } from '@/lib/format-number';
import { removeFromPeople } from '@/lib/people-remove';
import { FindField, FindNotes, FindResults, INVITE_SOMEONE_KEY, InviteCard, InviteSheet, useFindOrInvite } from './find-or-invite';
import { AccountThumbRow, ThumbTool } from '../../_components/account-thumb-row';
import { PersonAvatar } from './person-avatar';
import ps from './people-screen.module.css';

/**
 * people-roster-view.tsx — People, wearing the Guest List's clothes.
 *
 * Owner, 2026-08-21: *"we want the interface of people and guest list to be
 * similar"*, and before that the model itself — *"creating connection to them
 * should be after they become connected to you. just add them first. Then you
 * can set a label. or a samahan, just like the guest list."*
 *
 * ── WHAT IS BORROWED, DELIBERATELY, RATHER THAN INVENTED ───────────────────
 * The Living Roster's grammar, element for element: a CAPTURE BAR that takes one
 * typed line and keeps focus so you can add several in a row (`find-or-invite.tsx`)
 * · a table whose head is the same mono/uppercase/tracking rule · tier header
 * rows · pill CHIPS in the same tint vocabulary (`role-groups.ts`
 * ROLE_GROUP_CHIP) · and a chip that is itself the editor, opening the shared
 * `<Popover>` primitive — the same one the guest rows use, imported rather than
 * copied so the two can never drift apart in behaviour or a11y.
 *
 * The tint mapping is chosen for MEANING, not for variety: ninong/ninang take
 * the violet the roster already gives principal sponsors, and a friend takes
 * the neutral it gives an ordinary guest. Somebody who knows the guest list
 * already knows this page.
 *
 * ── THE PEOPLE REDESIGN (owner 2026-09-28, people-redesign.html) ──────────
 *   · THE FACET PILL ROW IS GONE. "Any set of choices is one dropdown" — the
 *     page's own view picker (Requests · Connected · Following · Followers ·
 *     Alaga · Samahan) replaced it, one level up.
 *   · REQUESTS ARE PINNED AT THE TOP of Connected, and are the whole of the
 *     Requests view, in the owner's words: "{name} is trying to add you from
 *     your {event} event · Accept / Decline". "Confirm" became Accept.
 *   · "Waiting for them" is its own section, LAST.
 *   · ALAGA ARE NOT DRAWN HERE — the Alaga view owns them (one alaga was on
 *     this page three times). They stay in the roster DATA for the guest
 *     list's "Add from people" sheet.
 *   · A REFUSED READ SAYS SO. `connectionsUnavailable` renders its own
 *     sentence; "Nobody here yet" is only ever said about an account that
 *     really has nobody.
 *
 * ── THE ONE THING THAT IS NOT LIKE THE GUEST LIST ──────────────────────────
 * A guest is the host's own record and changes the moment they type. A person
 * here is somebody else's account, and the row's STATE says whose move it is:
 * a request carries Accept and Decline, *waiting for them* carries Send again
 * and Withdraw. Optimism is deliberately absent — a row flipping to
 * "connected" before the other person has agreed would be the product telling
 * a lie about somebody else's decision.
 *
 * ── 2026-10-22 · PEOPLE WEARS TODAY'S GUEST LIST (owner: "People must look
 *    similar to guests … Somewhat but not exactly") ─────────────────────────
 * The approved prototype `prototypes/people_and_memories_template_2026-10-22.html`
 * (P1–P5) + the owner's rulings of the same day. The Guest list moved on (Maker
 * PR 4f, 2026-10-07): one sticky head · folding sections with a round badge ·
 * one-line rows with round buttons · the glass thumb row. People now draws those
 * with the Guest list's OWN stylesheet (`guests-screen.module.css`) and its own
 * `ActionButton`, imported — never copied — so the two cannot drift apart.
 *   · THE VIEW DROPDOWN AT THE TOP IS GONE (owner: "remove it"). The counts line
 *     — "3 connected · 1 waiting for them · 1 asking you" — IS the top, and each
 *     count filters to what it counts (tap again: everyone).
 *   · LOVED ONES (alaga, incl. a business alaga) is a folded section in the list,
 *     like Family and Friends — no longer a view of its own.
 *   · GROUPS (samahan), Following and Followers live under the ≡ filter button in
 *     the thumb row — the place Guests keeps its groups.
 *   · Find-or-invite is the thumb row's field, where Guests keeps "Search or add".
 *   · Row → card: ✎ opens the person's card (the Guest card's bones).
 *   · Select (controller, 2026-10-22, the prototype's question 1): two verbs only
 *     — Ask into group · Remove N. No bulk label: a label needs each person's yes.
 */

const STATE_LABEL: Record<RosterState, string> = {
  connected: 'Connected',
  waiting_them: 'Waiting for them',
  waiting_you: 'Waiting for your answer',
  in_your_care: 'In your care',
};

/** ONE heading style for the whole page (the redesign's problem 5 — four
 *  styles lived on one page). The roster's own rule, used everywhere. */
export const PEOPLE_SECTION_HEADING =
  'font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-ink/55';

/** The label pill's tint — the Guest row's pill vocabulary, chosen by MEANING (family warm, ninong violet). */
function pillTint(relation: ConnectionRelation | null): string {
  switch (relation) {
    case 'spouse':
    case 'partner':
    case 'parent':
    case 'child':
    case 'sibling':
      return ps.pillRose ?? '';
    case 'godparent':
    case 'godchild':
      return ps.pillViolet ?? '';
    default:
      return '';
  }
}

/** Whose move is it — see `isWaitingOnThem` (the one rule, tested). */
const waitingOnThem = isWaitingOnThem;

type SectionKey = 'family' | 'ritual' | 'friends' | 'unlabelled' | 'waiting_them';

/** Section order — the shape of a family, then whose move it is, LAST. */
const SECTIONS: Array<{ key: SectionKey; label: string; icon: LucideIcon; match: (p: RosterPerson) => boolean }> = [
  {
    key: 'family',
    label: 'Family',
    icon: Heart,
    match: (p) =>
      p.state === 'connected' &&
      !waitingOnThem(p) &&
      ['partner', 'spouse', 'parent', 'child', 'sibling'].includes(p.relation ?? ''),
  },
  {
    key: 'ritual',
    label: 'Ninong & Ninang',
    icon: HeartHandshake,
    match: (p) =>
      p.state === 'connected' && !waitingOnThem(p) && ['godparent', 'godchild'].includes(p.relation ?? ''),
  },
  {
    key: 'friends',
    label: 'Friends',
    icon: Users,
    match: (p) => p.state === 'connected' && !waitingOnThem(p) && p.relation === 'friend',
  },
  {
    key: 'unlabelled',
    label: 'No label yet',
    icon: CircleDashed,
    match: (p) => p.state === 'connected' && !waitingOnThem(p) && p.relation === null,
  },
  { key: 'waiting_them', label: 'Waiting for them', icon: Clock, match: waitingOnThem },
];

const EMPTY_LINE = 'Nobody here yet.';
const REFUSED_LINE = 'We couldn’t load your people just now. Nothing is lost — refresh in a moment.';
/** The counts line over a refused read — no number at all; the list below says the whole sentence once. */
const REFUSED_COUNTS = 'Not loaded just now';
const PARTLY_REFUSED_LINE =
  'We couldn’t load all of your people just now. Nothing is lost — refresh in a moment.';

/** What the counts line filters to — each count shows exactly the rows it counts. */
export type PeopleFilter = 'all' | 'connected' | 'waiting' | 'asking';

type Run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => void;

/** The ≡ filter button's list (Groups · Following · Followers — owner 2026-10-22). */
export type PeoplePickerProps = { view: PeopleView; options: readonly PickOption[]; gates: PeopleViewGates };

/** A folded section the page hands in (Loved ones · Your connection tree), drawn after the roster's own. */
export type PeopleExtraSection = {
  key: 'alaga' | 'tree';
  label: string;
  /** null = not counted (unread, or nothing to count) — never printed as 0. */
  count: number | null;
  node: ReactNode;
  /** Folded on first draw (the tree, as drawn). */
  folded?: boolean;
};

export function PeopleRosterView({
  roster,
  relations,
  spouseNote,
  picker,
  extra = [],
  initialFilter = 'all',
  focus = null,
  openPerson = null,
}: {
  roster: PeopleRoster;
  /** Offerable labels — the server decides, by the spouse rule. */
  relations: ConnectionRelation[];
  spouseNote: string | null;
  picker: PeoplePickerProps;
  extra?: PeopleExtraSection[];
  /** `?view=requests` opens on "asking you" (the rail's Requests row). */
  initialFilter?: PeopleFilter;
  /** `?view=alaga` opens on the Loved ones section, folded open, the rest folded shut. */
  focus?: 'alaga' | null;
  /**
   * `?person=<public id>` — open THIS person's card on arrival (owner 2026-10-22: a person result in the
   * shell's search opens their card here). Matched on `RosterPerson.publicId`; no match opens nothing (the
   * page decides what to say). Closing the card drops the param, so a reload does not reopen it; the
   * browser's Back still returns to the results the person came from.
   */
  openPerson?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<PeopleFilter>(initialFilter);
  const [selectMode, setSelectMode] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [cardKey, setCardKey] = useState<string | null>(null);
  const [cardFromUrl, setCardFromUrl] = useState(false);
  // `?person=` opens the card AFTER mount: the card is a portal (`GuestPopup`), which the server cannot draw,
  // so opening it in the first render is a hydration mismatch.
  useEffect(() => {
    const key = personCardKey(roster, openPerson);
    if (!key) return;
    setCardKey(key);
    setCardFromUrl(true);
    // The roster object is a fresh prop on every server render; the link is what decides.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPerson]);
  const [toRemove, setToRemove] = useState<RosterPerson[] | null>(null);
  const find = useFindOrInvite();
  const [inviting, setInviting] = useState(false);
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  useShellBarOffset(rootRef);

  const run: Run = (fn) => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error);
    });
  };

  // Alaga rows stay in the data (the guest list's sheet reads them) and are
  // never drawn as roster rows — the Loved ones section (the alaga's own cards,
  // where the age fence and the consent stamps live) draws them.
  const connections = roster.people.filter((p) => p.kind === 'connection');
  // EVERY HANDSHAKE WAITING ON ME — a request to connect, or a label somebody
  // asked on a connection I already have (owner 2026-09-29: "it will show to
  // their requests on people as well").
  const requests = connections.filter(isRequestForMe);

  const shown = connections.filter((p) => p.state !== 'waiting_you');
  const sections = SECTIONS.map((s) => ({ ...s, rows: shown.filter(s.match) })).filter(
    (s) => s.rows.length > 0,
  );
  // THE COUNTS ARE THE ROWS. Each number is the length of exactly the rows its filter draws, so a count and its list
  // cannot disagree (the Guest list's rule, `counts-equal-the-rows.test.ts`).
  const connectedRows = sections.filter((s) => s.key !== 'waiting_them').flatMap((s) => s.rows);
  const waitingRows = sections.find((s) => s.key === 'waiting_them')?.rows ?? [];
  const tally = { connected: connectedRows.length, waiting: waitingRows.length, asking: requests.length };

  // 🔴 A REFUSED READ IS NOT AN EMPTY LIST. The same `[]` arrives either way;
  // only `connectionsUnavailable` tells them apart, so it decides the sentence.
  const emptyLine = roster.connectionsUnavailable ? REFUSED_LINE : EMPTY_LINE;
  const nobody = sections.length === 0 && requests.length === 0;

  // Typing in the field filters the list too (the Guest list's "Search or add").
  // The ONE roster matcher — the shell's search lists your people by the same words (lib/people-name-match.ts).
  const q = rosterQuery(find.line);
  const searching = q.length > 0;
  const nameMatches = (p: RosterPerson) => rosterNameMatches(p.name, q);

  const visibleSections = sections.filter((s) =>
    filter === 'all' ? true : filter === 'connected' ? s.key !== 'waiting_them' : filter === 'waiting' ? s.key === 'waiting_them' : false,
  );
  const showRequests = filter === 'all' || filter === 'asking';
  const showExtra = filter === 'all';

  const [open, setOpen] = useState<Set<string>>(() => {
    if (focus === 'alaga') return new Set(['alaga']);
    return new Set([...SECTIONS.map((s) => s.key as string), ...extra.filter((e) => !e.folded).map((e) => e.key)]);
  });
  const allKeys = [...visibleSections.map((s) => s.key as string), ...(showExtra ? extra.map((e) => e.key) : [])];
  const allOpen = allKeys.length > 0 && allKeys.every((k) => open.has(k));
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const card = cardKey ? connections.find((p) => p.key === cardKey) ?? null : null;
  const pickedRows = shown.filter((p) => picked.has(p.key));
  const askable = pickedRows.filter((p) => p.state === 'connected');
  const leaveSelect = () => {
    setSelectMode(false);
    setPicked(new Set());
  };

  function askIntoGroup(communityId: string) {
    const name = roster.mySamahan.find((s) => s.id === communityId)?.name ?? 'the group';
    const people = askable;
    if (people.length === 0) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      let sent = 0;
      for (const p of people) {
        const res = await invitePersonToSamahan({ connectionId: p.connectionId ?? '', communityId });
        if (res.ok && res.delivered) sent += 1;
      }
      // Said as it happened — never "sent" for an ask that did not go.
      if (sent === people.length) setNotice(`Invitation to ${name} sent to ${formatCount(sent)}.`);
      else setError(`${formatCount(people.length - sent)} of ${formatCount(people.length)} invitations to ${name} didn’t send — try again in a moment.`);
      leaveSelect();
    });
  }

  const topLine = (
    <div className={gs.stick} data-people-head="">
      {roster.connectionsUnavailable && tally.connected + tally.waiting + tally.asking === 0 ? (
        // A refusal is said as one — never "0 connected".
        <p role="status" className={`${gs.counts} ${gs.mute}`} data-people-counts="refused">
          {REFUSED_COUNTS}
        </p>
      ) : (
        <div className={`${gs.counts} ${ps.counts}`} data-people-counts="" data-tour="people-counts">
          {nobody ? (
            <span className={gs.mute}>Nobody yet</span>
          ) : (
            <>
              <CountDoor n={tally.connected} word="connected" on={filter === 'connected'} onTap={() => setFilter(filter === 'connected' ? 'all' : 'connected')} />
              {tally.waiting > 0 ? (
                <>
                  <span aria-hidden className={gs.mute}>·</span>
                  <CountDoor n={tally.waiting} word="waiting for them" on={filter === 'waiting'} onTap={() => setFilter(filter === 'waiting' ? 'all' : 'waiting')} />
                </>
              ) : null}
              {tally.asking > 0 ? (
                <>
                  <span aria-hidden className={gs.mute}>·</span>
                  <CountDoor hot n={tally.asking} word="asking you" on={filter === 'asking'} onTap={() => setFilter(filter === 'asking' ? 'all' : 'asking')} />
                </>
              ) : null}
            </>
          )}
        </div>
      )}
      {roster.connectionsUnavailable && !nobody ? (
        <p role="status" className={`${gs.replied}`} data-people-refused>
          {PARTLY_REFUSED_LINE}
        </p>
      ) : null}
      {roster.samahanUnavailable ? (
        <p className={gs.replied}>We couldn’t read your groups just now, so the groups on each row may be missing some.</p>
      ) : null}
    </div>
  );

  const rowFor = (p: RosterPerson) => (
    <PersonRow
      key={p.key}
      person={p}
      relations={relations}
      pending={pending}
      selectMode={selectMode}
      picked={picked.has(p.key)}
      onToggle={() =>
        setPicked((prev) => {
          const next = new Set(prev);
          if (next.has(p.key)) next.delete(p.key);
          else next.add(p.key);
          return next;
        })
      }
      onOpen={() => setCardKey(p.key)}
      onRemove={() => setToRemove([p])}
      setNotice={setNotice}
      setError={setError}
    />
  );

  const fold = (key: string, label: string, icon: LucideIcon, n: number | null, body: ReactNode) => {
    const opened = open.has(key);
    const Icon = icon;
    return (
      <section
        key={key}
        className={`${gs.sec} ${opened ? gs.open : ''}`}
        data-people-section={key}
        data-open={opened ? 'true' : 'false'}
        data-tour={key === 'alaga' ? 'people-loved-ones' : undefined}
      >
        <div className={gs.barWrap}>
          <button type="button" className={gs.bar} aria-expanded={opened} onClick={() => toggle(key)} data-section-head="">
            <span className={gs.ico} aria-hidden>
              <Icon strokeWidth={1.9} />
            </span>
            <span className={gs.lab}>{label}</span>
            {n === null ? null : <span className={gs.n}>· {formatCount(n)}</span>}
            <ChevronDown className={gs.chev} style={{ flex: '0 0 auto' }} aria-hidden strokeWidth={1.9} width={18} height={18} />
          </button>
        </div>
        <div className={gs.fold}>
          <div>{body}</div>
        </div>
      </section>
    );
  };

  const list = searching ? (
    // 📌 Where a search's results draw — pinned under the chrome (lib/search-pin.ts).
    <div data-people-search="" data-search-results="">
      {/* ✉ The first result is the invite (owner 2026-10-25, "do the same on People") — then who is on your list, then
          who is on Setnayan. 🔒 people/people-wears-the-guest-list.test.ts */}
      <InviteCard f={find} />
      {(() => {
        const mine = shown.filter(nameMatches);
        return mine.length > 0 ? (
          <section className={gs.sec} data-people-section="matches">
            <div className={gs.barWrap}>
              <span className={gs.bar} style={{ cursor: 'default' }}>
                <span className={gs.ico} aria-hidden>
                  <Users strokeWidth={1.9} />
                </span>
                <span className={gs.lab}>On your list</span>
                <span className={gs.n}>· {formatCount(mine.length)}</span>
              </span>
            </div>
            {mine.map(rowFor)}
          </section>
        ) : null;
      })()}
      <FindResults f={find} card={false} />
    </div>
  ) : (
    <div data-people-rows="">
      {/* PINNED — while anybody waits on you, before everything else (owner
          2026-09-28: "Requests pinned at top of Connected"), in the Guest list's
          "requests to join" shape. The bell lands on this page. */}
      {showRequests && requests.length > 0 ? (
        <ul className="list-none" data-people-requests="">
          {requests.map((p) => (
            <RequestRow key={p.key} person={p} pending={pending} run={run} />
          ))}
        </ul>
      ) : null}
      {filter === 'asking' && requests.length === 0 ? (
        <p className={`${gs.empty} py-6`}>
          {roster.connectionsUnavailable
            ? 'We couldn’t load your requests just now. Nothing is lost — refresh in a moment.'
            : 'Nobody is waiting on your answer right now.'}
        </p>
      ) : null}

      {nobody && filter === 'all' ? (
        <div className={ps.empty} data-people-empty="">
          <p className={ps.emptyLead}>{emptyLine}</p>
          {roster.connectionsUnavailable ? null : (
            <>
              <p className={ps.emptyQuiet}>A name is enough to find them on Setnayan; a name and their email invites them.</p>
              <ActionButton
                tone="brand"
                main
                icon={Plus}
                label="Add someone"
                onClick={() => find.inputRef.current?.focus()}
                data-testid="people-empty-door"
              />
            </>
          )}
        </div>
      ) : null}

      {visibleSections.map((sec) => fold(sec.key, sec.label, sec.icon, sec.rows.length, sec.rows.map(rowFor)))}
      {showExtra
        ? extra.map((e) =>
            // An empty account sees the tree's own sentence under the door, unframed (P3) — not a folded heading.
            e.key === 'tree' && nobody ? (
              <div key={e.key} className={ps.emptyTree}>
                {e.node}
              </div>
            ) : (
              fold(e.key, e.label, e.key === 'alaga' ? HandHeart : Network, e.count, e.node)
            ),
          )
        : null}
    </div>
  );

  /* ═══ THE ONE THUMB ROW (owner 2026-10-22; prototypes/one_thumb_row_2026-10-22.html): ≡ · [Find or invite] ═══
     ≡ is ONE dropdown (any set of choices is a dropdown): the views (Your people · Following · Followers · Groups),
     the list's own two tools — Expand / Collapse all and Select — and "Invite someone", the row's former ＋ Invite
     (owner 2026-10-25: "remove the +… do the same on People"; a typed name's first result is the invite). */
  const filterPick = (
    <ThumbTool tour="people-view">
      <span data-pick="" data-people-filter="" className="contents">
        <PickMenu
          label="People — show, or work the list"
          value={picker.view}
          options={[
            ...picker.options.map((o) => ({ ...o, group: 'Show', icon: <ListFilter className="h-[18px] w-[18px]" strokeWidth={1.9} /> })),
            ...(nobody
              ? []
              : [
                  { key: 'list:fold', label: allOpen ? 'Collapse all' : 'Expand all', group: 'This list', icon: allOpen ? <ChevronsDownUp className="h-[18px] w-[18px]" strokeWidth={1.9} /> : <ChevronsUpDown className="h-[18px] w-[18px]" strokeWidth={1.9} /> },
                  { key: 'list:select', label: 'Select', group: 'This list', icon: <SquareCheck className="h-[18px] w-[18px]" strokeWidth={1.9} /> },
                ]),
            { key: INVITE_SOMEONE_KEY, label: 'Invite someone', group: 'Add', icon: <UserPlus className="h-[18px] w-[18px]" strokeWidth={1.9} /> },
          ]}
          onPick={(k) => {
            if (k === INVITE_SOMEONE_KEY) return setInviting(true);
            if (k === 'list:fold') return setOpen(allOpen ? new Set() : new Set(allKeys));
            if (k === 'list:select') return setSelectMode(true);
            router.push(peopleViewHref(k as PeopleView, picker.gates));
          }}
          dataAttr="data-people-views"
        />
      </span>
    </ThumbTool>
  );
  const thumb = selectMode ? (
    <AccountThumbRow
      data={{ 'data-people-thumb': 'select' }}
      tools={
        <ThumbTool>
          <ActionButton tone="neutral" iconOnly icon={SquareCheck} label="Done" onClick={leaveSelect} data-testid="people-bulk-done" />
        </ThumbTool>
      }
      field={
        roster.mySamahan.length > 0 ? (
          <span data-pick="" className={ps.growPick} data-bulk-ask="">
            <PickMenu
              label="Ask the selected into"
              value={null}
              buttonText={askable.length === 0 ? 'Ask into group' : `Ask ${formatCount(askable.length)} into group`}
              options={roster.mySamahan.map((s) => ({ key: s.id, label: s.name, icon: <UsersRound className="h-[18px] w-[18px]" strokeWidth={1.9} /> }))}
              onPick={askIntoGroup}
            />
          </span>
        ) : (
          <span className="flex h-full min-w-0 flex-1 items-center px-3.5 text-[13px] text-ink/60">Make a group to ask people into it.</span>
        )
      }
      action={
        <ActionButton
          tone="danger"
          filled
          icon={X}
          label={`Remove ${formatCount(pickedRows.length)}`}
          waiting={pickedRows.length === 0}
          onClick={() => (pickedRows.length > 0 ? setToRemove(pickedRows) : undefined)}
          data-testid="people-bulk-remove"
        />
      }
    />
  ) : (
    <AccountThumbRow data={{ 'data-people-thumb': 'list' }} tools={filterPick} field={<FindField f={find} />} />
  );

  return (
    <div ref={rootRef} className={`${gs.screen} ${ps.people}`} data-people-view="connected" data-people-screen="">
      {topLine}
      {error ? (
        <p role="alert" className="py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="py-2 text-sm text-mulberry-600">
          {notice}
        </p>
      ) : null}
      <FindNotes f={find} />
      {list}
      {thumb}
      <InviteSheet f={find} open={inviting} onClose={() => setInviting(false)} />
      {card ? (
        <PersonCard
          person={card}
          relations={relations}
          spouseNote={spouseNote}
          samahan={roster.mySamahan}
          pending={pending}
          run={run}
          onClose={() => {
            setCardKey(null);
            if (cardFromUrl) {
              setCardFromUrl(false);
              router.replace(withoutPersonParam(), { scroll: false });
            }
          }}
          onRemove={() => {
            setCardKey(null);
            setToRemove([card]);
          }}
          setNotice={setNotice}
          setError={setError}
        />
      ) : null}
      {toRemove ? (
        <GuestPopup kind="confirm" onClose={() => setToRemove(null)} label="Remove from your people">
          <p className="text-[17px] font-semibold text-ink">
            {toRemove.length === 1 ? `Remove ${toRemove[0]!.name}?` : `Remove ${formatCount(toRemove.length)} people?`}
          </p>
          <p className="mb-3 mt-1 text-[14px] text-ink/65">
            {toRemove.length === 1 && toRemove[0]!.state === 'waiting_them'
              ? 'Your request is taken back. They are not told.'
              : 'They leave your people. You can add them again any time.'}
          </p>
          <GuestConfirmActions
            keep={<ActionButton tone="neutral" icon={Check} label="Keep" onClick={() => setToRemove(null)} />}
            go={
              <ActionButton
                tone="danger"
                icon={X}
                label="Remove"
                waiting={pending}
                onClick={() => {
                  // 🔒 COUNTED, NEVER ASSUMED (owner 2026-10-23, "why can't i delete anyone"): an empty or partial
                  // id list is refused before any call, and each call's own answer decides — `lib/people-remove.ts`.
                  const rows = toRemove;
                  setToRemove(null);
                  leaveSelect();
                  run(async () => {
                    const res = await removeFromPeople(rows, (id) => withdrawConnection(id));
                    if (res.ok) {
                      const one = rows.length === 1 ? rows[0]! : null;
                      setNotice(
                        one
                          ? one.state === 'waiting_them'
                            ? `Your request to ${one.name} is taken back.`
                            : `${one.name} left your people.`
                          : `Removed ${formatCount(res.removed)} people.`,
                      );
                    }
                    return res;
                  });
                }}
                data-testid="people-remove-confirm"
              />
            }
          />
        </GuestPopup>
      ) : null}
    </div>
  );
}

/** One number in the counts line, as a door to the rows it counts (the Guest list's `.countsDoor`). */
function CountDoor({ n, word, on, hot = false, onTap }: { n: number; word: string; on: boolean; hot?: boolean; onTap: () => void }) {
  return (
    <button
      type="button"
      onClick={onTap}
      aria-pressed={on}
      className={`${gs.countsDoor} ${ps.countDoor} ${hot ? ps.hot : ''} ${on ? ps.on : ''}`}
      data-people-count={word}
    >
      <b>{formatCount(n)}</b> {word}
    </button>
  );
}

/**
 * REQUESTS — everything waiting on MY answer, as the Guest list's pinned "requests to join" row: the sentence,
 * the label line, round ✓ Accept and ✕ Decline. Two kinds, one list, one pair of buttons:
 *
 *   · a request to CONNECT — the owner's words, *"{name} is trying to add you
 *     from your {event} {type} event"*, via `connectionRequestSentence` (the
 *     bell's title uses the same function). When the request carries a label,
 *     the label is named too: accepting the request accepts it.
 *   · a LABEL asked on a connection I already have (owner 2026-09-29:
 *     *"assigning a label needs a handshake"*) — "Ice added you as their
 *     Sibling".
 *
 * One partner at a time: accepting a partner while I hold one comes back as a
 * QUESTION (replace?), answered in place — never a refusal to decode.
 */
type AnswerResult =
  | { ok: true; asked?: boolean }
  | { ok: false; error: string }
  | { ok: false; replacePartner: { question: string } };

function RequestRow({ person: p, pending, run }: { person: RosterPerson; pending: boolean; run: Run }) {
  const [question, setQuestion] = useState<string | null>(null);
  const isLabelAsk = p.state === 'connected' && p.ask?.state === 'waiting_you';
  const id = p.connectionId ?? '';

  // Accept — and, if it comes back as the one-partner question, hold the
  // question here until they answer it.
  function accept(replacePartner: boolean) {
    run(async () => {
      const res: AnswerResult = await confirmConnection(id, { replacePartner, label: isLabelAsk });
      if (!res.ok && 'replacePartner' in res) {
        setQuestion(res.replacePartner.question);
        return { ok: true };
      }
      setQuestion(null);
      return res.ok ? { ok: true } : res;
    });
  }

  return (
    <li className={gs.g} data-request-kind={isLabelAsk ? 'label' : 'connect'} data-people-request="">
      <span className={gs.ava} aria-hidden>
        <PersonAvatar name={p.name} size="row" />
      </span>
      <span className="min-w-0 text-[14px] leading-snug text-ink">
        {isLabelAsk && p.ask ? (
          <span className="font-semibold" data-request-sentence>{labelRequestLine(p.name, p.ask.word)}</span>
        ) : (
          <>
            <span className="font-semibold" data-request-sentence>{connectionRequestSentence(p.name, p.fromEvent)}</span>
            {p.storedRelation ? (
              <span className={`${gs.meta} block`} data-request-label>
                {labelRequestLine(p.name, p.storedRelation)}
              </span>
            ) : null}
          </>
        )}
        {question ? (
          <span className="mt-1.5 block text-[13px] text-ink" role="status" data-replace-partner>
            {question}
          </span>
        ) : null}
      </span>
      <span className={gs.acts}>
        {question ? (
          <>
            <ActionButton tone="brand" main icon={Check} label="Yes, change it" onClick={() => accept(true)} disabled={pending} />
            <ActionButton tone="neutral" icon={X} label="Keep as is" onClick={() => setQuestion(null)} disabled={pending} />
          </>
        ) : (
          <>
            <ActionButton tone="ok" icon={Check} label="Accept" name={`Accept ${p.name}`} onClick={() => accept(false)} disabled={pending} />
            <ActionButton
              tone="neutral"
              icon={X}
              label="Decline"
              name={`Decline ${p.name}`}
              onClick={() => run(() => declineConnection(id, { label: isLabelAsk }))}
              disabled={pending}
            />
          </>
        )}
      </span>
    </li>
  );
}

/** A label result, narrowed to what `run` reports. */
function plain(res: AnswerResult): { ok: true } | { ok: false; error: string } {
  if (res.ok) return { ok: true };
  return 'error' in res ? res : { ok: false, error: res.replacePartner.question };
}

/**
 * ONE PERSON, ONE LINE — the Guest row's anatomy (`guests-screen.module.css` `.g`): the round face · the name ·
 * the pill line (the label pill IS the editor, then "· group", then whose move it is) · round buttons at the
 * right end. Connected: ✎ (the card) · ✕ Remove. Waiting for them: ➤ Send again · ✕ Withdraw.
 */
function PersonRow({
  person: p,
  relations,
  pending,
  selectMode,
  picked,
  onToggle,
  onOpen,
  onRemove,
  setNotice,
  setError,
}: {
  person: RosterPerson;
  relations: ConnectionRelation[];
  pending: boolean;
  selectMode: boolean;
  picked: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onRemove: () => void;
  setNotice: (s: string | null) => void;
  setError: (s: string | null) => void;
}) {
  const [busy, startTransition] = useTransition();
  const act = () => (selectMode ? onToggle() : onOpen());
  const resend = () =>
    startTransition(async () => {
      setError(null);
      setNotice(null);
      const res = await resendConnectionInvitation(p.connectionId ?? '');
      if (!res.ok) setError(res.error);
      else setNotice(res.delivered ? 'Sent again.' : 'The email didn’t send — try again in a moment.');
    });
  return (
    <div className={`${gs.g} ${picked ? gs.picked : ''}`} data-person-row="" data-person-state={p.state}>
      <button
        type="button"
        className={gs.ava}
        onClick={act}
        aria-label={`${selectMode ? (picked ? 'Unselect' : 'Select') : 'Open'} ${p.name}`}
        aria-pressed={selectMode ? picked : undefined}
      >
        {selectMode ? picked ? <Check aria-hidden strokeWidth={2.2} /> : null : <PersonAvatar name={p.name} size="row" />}
      </button>
      <div className={gs.who}>
        <button type="button" className={`${gs.nm} ${ps.nameBtn}`} onClick={act} data-row-name="">
          <span className={gs.nmt}>{p.name}</span>
        </button>
        <div className={`${gs.meta} ${ps.meta}`}>
          {p.state === 'waiting_them' ? (
            <span className={`${gs.pill} ${gs.pillWine}`}>{STATE_LABEL.waiting_them}</span>
          ) : (
            <LabelCell person={p} relations={relations} disabled={pending || selectMode} />
          )}
          {p.samahan.length > 0 ? <span className="truncate">· {p.samahan.join(', ')}</span> : null}
        </div>
      </div>
      {selectMode ? null : (
        <span className={gs.acts} data-row-acts="">
          {p.state === 'waiting_them' ? (
            <>
              <ActionButton tone="info" icon={Send} label="Send again" name={`Send again to ${p.name}`} onClick={resend} disabled={pending || busy} />
              <ActionButton tone="danger" icon={X} label="Withdraw" name={`Withdraw ${p.name}`} onClick={onRemove} disabled={pending || busy} />
            </>
          ) : (
            <>
              <ActionButton tone="neutral" icon={Pencil} label="Edit" name={`Open ${p.name}`} onClick={onOpen} />
              <ActionButton tone="danger" icon={X} label="Remove" name={`Remove ${p.name}`} onClick={onRemove} disabled={pending || busy} />
            </>
          )}
        </span>
      )}
    </div>
  );
}

/**
 * ROW → CARD (P4): the Guest card's bones — face · eyebrow · name · state pill · TOGETHER (where the request
 * came from · "Plan an event together" under the same rule) · key/value rows Label and Group, each the shipped
 * editor · the foot's Remove. What the card does NOT draw, because no read carries it yet, is named in the PR:
 * the events you share and the person's slice of the tree.
 */
function PersonCard({
  person: p,
  relations,
  spouseNote,
  samahan,
  pending,
  run,
  onClose,
  onRemove,
  setNotice,
  setError,
}: {
  person: RosterPerson;
  relations: ConnectionRelation[];
  spouseNote: string | null;
  samahan: Array<{ id: string; name: string }>;
  pending: boolean;
  run: Run;
  onClose: () => void;
  onRemove: () => void;
  setNotice: (s: string | null) => void;
  setError: (s: string | null) => void;
}) {
  const first = p.name.split(/\s+/)[0] ?? p.name;
  const section = SECTIONS.find((s) => s.match(p))?.label ?? null;
  const eyebrow = [STATE_LABEL[p.state], p.state === 'connected' ? section : null].filter(Boolean).join(' · ');
  const outgoingAsk = p.state === 'connected' && p.ask?.state === 'waiting_them';
  return (
    <GuestPopup
      onClose={onClose}
      rootClassName="fixed inset-0 z-[80]"
      panelClassName={`gl-drawer absolute inset-x-0 bottom-0 max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-paper px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-2 shadow-xl tab:inset-y-0 tab:left-auto tab:right-0 tab:max-h-none tab:w-[min(27.5rem,calc(100vw-3.5rem))] tab:rounded-none tab:rounded-l-2xl`}
      labelledById="person-card-name"
      panelData={{ 'data-person-card': '' }}
    >
      <div className={ps.cardBody}>
      <span aria-hidden className="mx-auto mb-3.5 mt-1.5 block h-1 w-10 rounded-full bg-ink/15" />
      <div className="flex items-start gap-3.5">
        <span className={`${ps.cardFace} ${pillTint(p.relation)}`} aria-hidden>
          <PersonAvatar name={p.name} size="row" />
        </span>
        <div className="min-w-0">
          <p className={ps.eyebrow}>{eyebrow}</p>
          <h2 id="person-card-name" className="mt-0.5 text-[26px] font-semibold leading-tight text-ink">
            {p.name}
          </h2>
          <span className={`${gs.pill} ${p.state === 'connected' ? gs.pillOk : gs.pillWine} ${ps.pillRow} mt-2`}>
            {p.state === 'connected' ? <Check aria-hidden className="h-3 w-3" strokeWidth={2.2} /> : null}
            {STATE_LABEL[p.state]}
          </span>
        </div>
      </div>

      {p.fromEvent || offersPlanTogether({
        relationForViewer: p.relation,
        connected: p.state === 'connected',
        askPending: p.ask?.state === 'waiting_them' || p.ask?.state === 'waiting_you',
        sharesAnEvent: p.sharesAnEvent,
      }) ? (
        <div className="mt-5">
          <p className={ps.eyebrow}>Together</p>
          {p.fromEvent ? (
            <p className="mt-1.5 text-[15px] text-ink" data-card-from-event="">
              {connectionRequestSentence(p.name, p.fromEvent)}
            </p>
          ) : null}
          <PlanTogether person={p} />
        </div>
      ) : null}

      {p.state === 'connected' ? (
        <div className="mt-5">
          <p className={ps.eyebrow}>What {first} is to you</p>
          <div className={ps.kv}>
            <span className={ps.k}>Label</span>
            <span className={ps.v}>
              <CardLabel person={p} relations={relations} disabled={pending} setError={setError} />
            </span>
          </div>
          <div className={ps.kv}>
            <span className={ps.k}>Group</span>
            <span className={ps.v}>
              <CardGroup
                person={p}
                samahan={samahan}
                disabled={pending}
                onSent={(m) => {
                  setError(null);
                  setNotice(m);
                }}
                onFailed={(m) => {
                  setNotice(null);
                  setError(m);
                }}
              />
            </span>
          </div>
          {spouseNote ? <p className="mt-1.5 text-[12.5px] leading-snug text-ink/60">{spouseNote}</p> : null}
          <p className="mt-1.5 text-[12.5px] leading-snug text-ink/60">
            {first} confirms a label before it counts. Lolo, lola, pinsan, biyenan and the in-laws come out of these on their own.
          </p>
          {outgoingAsk ? (
            <ActionButton
              tone="neutral"
              icon={X}
              label="Take back the label"
              className="mt-3"
              onClick={() => run(() => setConnectionLabel(p.connectionId ?? '', null).then(plain))}
              disabled={pending}
            />
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={onRemove}
        className="mt-6 min-h-11 text-[14px] text-ink/60 underline underline-offset-[3px]"
        data-card-remove=""
      >
        {p.state === 'waiting_them' ? `Withdraw your request to ${first}` : `Remove ${first} from your people`}
      </button>
      </div>
    </GuestPopup>
  );
}

/**
 * THE CARD'S LABEL ROW (P5) — the same words and the same handshake as the row's pill, as the shipped `PickMenu`
 * (the control for a set of choices, owner 2026-09-28). A PickMenu, not the row's Popover, because the card is a
 * pop-up: everything behind it is `inert`, and the Popover's portal is behind it.
 */
function CardLabel({
  person,
  relations,
  disabled,
  setError,
}: {
  person: RosterPerson;
  relations: ConnectionRelation[];
  disabled: boolean;
  setError: (s: string | null) => void;
}) {
  const [busy, startTransition] = useTransition();
  const [question, setQuestion] = useState<{ text: string; next: ConnectionRelation } | null>(null);
  if (!person.canLabel) {
    return <span className="text-[15px] text-ink">{person.relation ? RELATION_LABEL[person.relation] : 'No label yet'}</span>;
  }
  const ask = person.ask && person.ask.state !== 'waiting_you' ? person.ask : null;
  const current = ask ? ask.word : person.relation;
  const first = person.name.split(/\s+/)[0] ?? person.name;
  function commit(next: ConnectionRelation | null, replacePartner = false) {
    setError(null);
    startTransition(async () => {
      const res = await setConnectionLabel(person.connectionId ?? '', next, { replacePartner });
      if (res.ok) return setQuestion(null);
      if ('replacePartner' in res) {
        if (next) setQuestion({ text: res.replacePartner.question, next });
        return;
      }
      setError(res.error);
    });
  }
  return (
    <span className="flex w-full flex-col gap-1.5" data-card-label="">
      <span data-pick="" className={`${ps.cardPick} ${disabled || busy ? 'pointer-events-none opacity-60' : ''}`}>
        <PickMenu
          label={`How is ${first} yours?`}
          value={current}
          buttonText={current ? RELATION_LABEL[current] : 'Pick one'}
          options={[
            ...relations.map((r) => ({ key: r, label: RELATION_LABEL[r] })),
            ...(current ? [{ key: 'none', label: 'Remove the label' }] : []),
          ]}
          onPick={(k) => commit(k === 'none' ? null : (k as ConnectionRelation))}
          dataAttr="data-label-pill"
        />
      </span>
      {ask ? (
        <span className="text-[12.5px] text-ink/60" data-label-ask-state={ask.state}>
          {ask.state === 'waiting_them' ? waitingForLine(person.name) : didNotConfirmLine(person.name)}
        </span>
      ) : null}
      {question ? (
        <span className="flex flex-col gap-1.5" role="status" data-replace-partner>
          <span className="text-[12.5px] leading-snug text-ink">{question.text}</span>
          <span className="flex gap-2">
            <ActionButton tone="brand" main icon={Check} label="Yes, change it" onClick={() => commit(question.next, true)} disabled={busy} />
            <ActionButton tone="neutral" icon={X} label="Keep as is" onClick={() => setQuestion(null)} disabled={busy} />
          </span>
        </span>
      ) : null}
    </span>
  );
}

/**
 * THE CARD'S GROUP ROW — the groups they are in, and "Ask into…" as a PickMenu.
 *
 * ⚖ THE ASK SENDS AN INVITATION; IT DOES NOT ADD THEM. `community_members` admits INSERT only for a Setnayan admin,
 * so the product's own consent model already says a person is ASKED into a samahan and never placed in one. A
 * group's name appears on the row when they actually join — never before.
 */
function CardGroup({
  person,
  samahan,
  disabled,
  onSent,
  onFailed,
}: {
  person: RosterPerson;
  samahan: Array<{ id: string; name: string }>;
  disabled: boolean;
  onSent: (message: string) => void;
  onFailed: (message: string) => void;
}) {
  const [busy, startTransition] = useTransition();
  const canAsk = person.kind === 'connection' && person.state === 'connected' && samahan.length > 0;
  function ask(communityId: string) {
    startTransition(async () => {
      const res = await invitePersonToSamahan({
        connectionId: person.connectionId ?? '',
        communityId,
      });
      if (!res.ok) return onFailed(res.error);
      onSent(
        res.delivered
          ? `Invitation to ${res.samahan} sent to ${person.name}.`
          : `The invitation to ${res.samahan} didn’t send — try again in a moment.`,
      );
    });
  }
  return (
    <span className="flex w-full flex-col gap-1.5" data-card-group="">
      {person.samahan.length > 0 && !canAsk ? <span className="text-[15px] text-ink">{person.samahan.join(', ')}</span> : null}
      {canAsk ? (
        <span data-pick="" className={`${ps.cardPick} ${disabled || busy ? 'pointer-events-none opacity-60' : ''}`}>
          <PickMenu
            label="Ask them into"
            value={null}
            buttonText={person.samahan.length > 0 ? person.samahan.join(', ') : 'Ask into a group'}
            options={samahan.map((s) => ({ key: s.id, label: s.name }))}
            onPick={ask}
          />
        </span>
      ) : person.samahan.length === 0 ? (
        <span className="text-[14px] text-ink/50">No group yet</span>
      ) : null}
      {canAsk ? <span className="text-[12px] leading-snug text-ink/55">They get the group’s link. They’re in it once they open it — not before.</span> : null}
    </span>
  );
}

/**
 * The label IS the editor — tap the pill, pick the word (the Guest row's pill now, the same Popover as ever).
 *
 * On a connection they already accepted, picking a word ASKS for it (owner
 * 2026-09-29: "assigning a label needs a handshake"): the pill then shows the
 * asked word with "Waiting for <name> to confirm" — or "<name> didn't confirm"
 * once they have said no. Picking Partner while you already have one asks to
 * replace, in place, before anything is written.
 */
function LabelCell({
  person,
  relations,
  disabled,
}: {
  person: RosterPerson;
  relations: ConnectionRelation[];
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, startTransition] = useTransition();
  const [failed, setFailed] = useState<string | null>(null);
  const [question, setQuestion] = useState<{ text: string; next: ConnectionRelation } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const pillClass = (relation: ConnectionRelation | null) => `${gs.pill} ${pillTint(relation)}`;
  if (!person.canLabel) {
    // They added YOU — the claim is theirs to word, yours to answer. The word
    // is shown from YOUR side (they said you are their Parent → Child).
    return person.relation ? (
      <span className={pillClass(person.relation)}>{RELATION_LABEL[person.relation]}</span>
    ) : (
      <span className={`${gs.pill} ${gs.pillMute}`}>No label yet</span>
    );
  }

  const ask = person.ask && person.ask.state !== 'waiting_you' ? person.ask : null;
  const current = ask ? ask.word : person.relation;

  function commit(next: ConnectionRelation | null, replacePartner = false) {
    setOpen(false);
    setFailed(null);
    startTransition(async () => {
      const res = await setConnectionLabel(person.connectionId ?? '', next, { replacePartner });
      if (res.ok) {
        setQuestion(null);
        return;
      }
      if ('replacePartner' in res) {
        if (next) setQuestion({ text: res.replacePartner.question, next });
        return;
      }
      setFailed(res.error);
    });
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled || busy}
        aria-haspopup="menu"
        aria-label={
          current
            ? `Change what ${person.name} is to you — currently ${RELATION_LABEL[current]}${
                ask?.state === 'waiting_them' ? ', waiting for them to confirm' : ''
              }`
            : `Say what ${person.name} is to you`
        }
        className={`${ps.pillBtn} disabled:opacity-60`}
        data-label-pill=""
      >
        {ask?.state === 'waiting_them' ? (
          <span className={`${gs.pill} ${ps.askPill}`} data-label-asked>
            {RELATION_LABEL[ask.word]}
          </span>
        ) : person.relation ? (
          <span className={pillClass(person.relation)}>{RELATION_LABEL[person.relation]}</span>
        ) : (
          <span className={`${gs.pill} ${ps.askPill} ${ps.pillRow}`}>
            <Plus aria-hidden className="h-3 w-3" strokeWidth={2.2} />
            Label
          </span>
        )}
      </button>
      {ask ? (
        <span className="truncate" data-label-ask-state={ask.state}>
          · {ask.state === 'waiting_them' ? waitingForLine(person.name) : didNotConfirmLine(person.name)}
        </span>
      ) : null}
      {failed ? <span className="text-red-700 dark:text-red-300">{failed}</span> : null}
      {question ? (
        <span className="mt-1.5 flex w-full flex-col gap-1.5" role="status" data-replace-partner>
          <span className="text-[12.5px] leading-snug text-ink">{question.text}</span>
          <span className="flex gap-2">
            <ActionButton tone="brand" main icon={Check} label="Yes, change it" onClick={() => commit(question.next, true)} disabled={busy} />
            <ActionButton tone="neutral" icon={X} label="Keep as is" onClick={() => setQuestion(null)} disabled={busy} />
          </span>
        </span>
      ) : null}
      {open ? (
        <Popover anchorRef={triggerRef} onClose={() => setOpen(false)} width={228}>
          <p className="px-2.5 pb-1 pt-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/55">
            How is {person.name.split(/\s+/)[0]} yours?
          </p>
          {relations.map((r) => (
            <button
              key={r}
              type="button"
              role="menuitem"
              onClick={() => commit(r)}
              className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[15px] transition-colors ${
                current === r
                  ? 'bg-terracotta/10 font-medium text-terracotta-700'
                  : 'text-ink/85 hover:bg-ink/[0.04]'
              }`}
            >
              <span className="min-w-0 flex-1 truncate">{RELATION_LABEL[r]}</span>
              {current === r ? <Check aria-hidden className="h-4 w-4" strokeWidth={2.2} /> : null}
            </button>
          ))}
          {current ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => commit(null)}
              className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[15px] text-ink/60 transition-colors hover:bg-ink/[0.04]"
            >
              Remove the label
            </button>
          ) : null}
          <p className="px-2.5 pb-1.5 pt-1 text-[11.5px] leading-snug text-ink/55" data-label-footnote>
            Lolo, lola, pinsan, biyenan and the other in-laws come out of these on their own.
            {person.state === 'connected' ? ` ${person.name.split(/\s+/)[0]} confirms a label before it counts.` : ''}
          </p>
        </Popover>
      ) : null}
    </>
  );
}

/**
 * "TO BECOME A COUPLE" — owner 2026-09-29: *"add partner (to become a
 * couple)"*. Once BOTH have confirmed the partnership, ONE plain next step:
 * plan an event together. It opens the existing create-event step with both
 * names carried — nothing is created until they create it — and where the two
 * already share an event, nothing is offered: that event is already the thing
 * they are doing together.
 */
function PlanTogether({ person }: { person: RosterPerson }) {
  if (
    !offersPlanTogether({
      relationForViewer: person.relation,
      connected: person.state === 'connected',
      askPending: person.ask?.state === 'waiting_them' || person.ask?.state === 'waiting_you',
      sharesAnEvent: person.sharesAnEvent,
    })
  ) {
    return null;
  }
  return (
    <ActionButton
      tone="brand"
      icon={CalendarHeart}
      label="Plan an event together"
      className="mt-2"
      href={`/dashboard/create-event?with=${encodeURIComponent(person.connectionId ?? '')}`}
      data-plan-together=""
    />
  );
}

/** This address without `?person=` — what closing a deep-linked card leaves in the bar. */
function withoutPersonParam(): string {
  if (typeof window === 'undefined') return PEOPLE_PATH;
  const url = new URL(window.location.href);
  url.searchParams.delete(PERSON_PARAM);
  const qs = url.searchParams.toString();
  return `${url.pathname}${qs ? `?${qs}` : ''}`;
}
