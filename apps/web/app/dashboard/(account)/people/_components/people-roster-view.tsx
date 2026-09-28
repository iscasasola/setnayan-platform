'use client';

import { Fragment, useRef, useState, useTransition } from 'react';
import { Check, Plus, Send, X } from 'lucide-react';
import { Popover } from '@/app/dashboard/[eventId]/guests/_components/overlay-primitives';
import type { ConnectionRelation } from '@/lib/people-connections';
import { RELATION_LABEL, connectionRequestSentence } from '@/lib/people-add';
import type { PeopleRoster, RosterPerson, RosterState } from '@/lib/people-roster';
import {
  confirmConnection,
  declineConnection,
  invitePersonToSamahan,
  resendConnectionInvitation,
  setConnectionLabel,
  withdrawConnection,
} from '../actions';
import { formatCount } from '@/lib/format-number';
import { FindOrInvite } from './find-or-invite';
import { PersonAvatar } from './person-avatar';

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
 */

const STATE_LABEL: Record<RosterState, string> = {
  connected: 'Connected',
  waiting_them: 'Waiting for them',
  waiting_you: 'Waiting for your answer',
  in_your_care: 'In your care',
};

const STATE_PIP: Record<RosterState, string> = {
  connected: 'bg-success-600',
  waiting_them: 'bg-warn-500',
  waiting_you: 'bg-terracotta',
  in_your_care: 'bg-mulberry',
};

/** ONE heading style for the whole page (the redesign's problem 5 — four
 *  styles lived on one page). The roster's own rule, used everywhere. */
export const PEOPLE_SECTION_HEADING =
  'font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-ink/55';

/** The label chip's tint, taken from the roster's own vocabulary by MEANING. */
function chipTint(relation: ConnectionRelation | null): string {
  switch (relation) {
    case 'spouse':
      return 'bg-danger-100 text-danger-900 ring-1 ring-danger-200';
    case 'parent':
    case 'child':
    case 'sibling':
      return 'bg-danger-200/70 text-danger-950 ring-1 ring-danger-300';
    case 'godparent':
    case 'godchild':
      return 'bg-violet-100 text-violet-800 ring-1 ring-violet-200';
    case 'friend':
      return 'bg-ink/[0.06] text-ink/60 ring-1 ring-ink/10';
    default:
      return 'bg-ink/[0.06] text-ink/60 ring-1 ring-ink/10';
  }
}

/** Section order — the shape of a family, then whose move it is, LAST. */
const SECTIONS: Array<{ key: string; label: string; match: (p: RosterPerson) => boolean }> = [
  {
    key: 'family',
    label: 'Family',
    match: (p) =>
      p.state === 'connected' && ['spouse', 'parent', 'child', 'sibling'].includes(p.relation ?? ''),
  },
  {
    key: 'ritual',
    label: 'Ninong & Ninang',
    match: (p) => p.state === 'connected' && ['godparent', 'godchild'].includes(p.relation ?? ''),
  },
  {
    key: 'friends',
    label: 'Friends',
    match: (p) => p.state === 'connected' && p.relation === 'friend',
  },
  {
    key: 'unlabelled',
    label: 'No label yet',
    match: (p) => p.state === 'connected' && p.relation === null,
  },
  { key: 'waiting_them', label: 'Waiting for them', match: (p) => p.state === 'waiting_them' },
];

const EMPTY_LINE = 'Nobody here yet. Add the first person above — a name is enough to find them.';
const REFUSED_LINE = 'We couldn’t load your people just now. Nothing is lost — refresh in a moment.';
const PARTLY_REFUSED_LINE =
  'We couldn’t load all of your people just now. Nothing is lost — refresh in a moment.';

export function PeopleRosterView({
  roster,
  relations,
  spouseNote,
  mode = 'connected',
}: {
  roster: PeopleRoster;
  /** Offerable labels — the server decides, by the spouse rule. */
  relations: ConnectionRelation[];
  spouseNote: string | null;
  /** 'requests' draws the requests and nothing else (the Requests view). */
  mode?: 'connected' | 'requests';
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error);
    });
  }

  // Alaga rows stay in the data (the guest list's sheet reads them) and are
  // never drawn here — the Alaga view owns them.
  const connections = roster.people.filter((p) => p.kind === 'connection');
  const requests = connections.filter((p) => p.state === 'waiting_you');

  const messages = (
    <>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm text-mulberry-600">
          {notice}
        </p>
      ) : null}
    </>
  );

  if (mode === 'requests') {
    return (
      <div className="space-y-4" data-people-view="requests">
        {requests.length > 0 ? (
          <RequestsBlock requests={requests} pending={pending} run={run} />
        ) : (
          <p className="py-6 text-sm text-ink/55">
            {roster.connectionsUnavailable
              ? 'We couldn’t load your requests just now. Nothing is lost — refresh in a moment.'
              : 'Nobody is waiting on your answer right now.'}
          </p>
        )}
        {messages}
      </div>
    );
  }

  const shown = connections.filter((p) => p.state !== 'waiting_you');
  const sections = SECTIONS.map((s) => ({ ...s, rows: shown.filter(s.match) })).filter(
    (s) => s.rows.length > 0,
  );
  // 🔴 A REFUSED READ IS NOT AN EMPTY LIST. The same `[]` arrives either way;
  // only `connectionsUnavailable` tells them apart, so it decides the sentence.
  const emptyLine = roster.connectionsUnavailable ? REFUSED_LINE : EMPTY_LINE;

  return (
    <div className="space-y-5" data-people-view="connected">
      {/* PINNED — while anybody waits on you, before everything else (owner
          2026-09-28: "Requests pinned at top of Connected"). The bell lands on
          this page, so this is where the ask is met. */}
      {requests.length > 0 ? <RequestsBlock requests={requests} pending={pending} run={run} /> : null}

      <FindOrInvite />

      {spouseNote ? <p className="text-xs text-ink/45">{spouseNote}</p> : null}
      {roster.samahanUnavailable ? (
        <p className="text-xs text-ink/55">
          We couldn’t read your samahan just now, so the groups column may be missing some.
        </p>
      ) : null}
      {roster.connectionsUnavailable && sections.length > 0 ? (
        <p role="status" className="text-sm text-ink/60" data-people-refused>
          {PARTLY_REFUSED_LINE}
        </p>
      ) : null}
      {messages}

      {/* DESKTOP — the roster table.
          IT RENDERS EMPTY (owner 2026-08-21: "we want to see the empty table if
          they have no people yet"). The columns ARE the explanation: a person
          who has added nobody can see that a row will carry a label, a samahan
          and a status, which a single sentence saying "nobody here yet" never
          told them. The empty row lives INSIDE the table for the same reason —
          floated above it, the headers would sit over nothing and read as a
          rendering fault. */}
      <div className="hidden overflow-hidden rounded-tile border border-ink/10 bg-paper sm:block">
          <table className="w-full table-fixed text-left text-sm">
            <thead className={`border-b border-ink/[0.07] ${PEOPLE_SECTION_HEADING}`}>
              <tr>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="w-[20%] px-3 py-2.5 font-medium">Label</th>
                <th className="w-[20%] px-3 py-2.5 font-medium">Samahan</th>
                <th className="w-[18%] px-3 py-2.5 font-medium">Status</th>
                <th className="w-[18%] px-3 py-2.5 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sections.map((sec) => (
                <Fragment key={sec.key}>
                  <tr>
                    <td colSpan={5} className={`border-t border-ink/10 bg-ink/[0.02] px-4 pb-1.5 pt-3 ${PEOPLE_SECTION_HEADING}`}>
                      {sec.label} <span className="ml-1 tabular-nums text-ink/35">{formatCount(sec.rows.length)}</span>
                    </td>
                  </tr>
                  {sec.rows.map((p) => (
                    <tr key={p.key} className="border-t border-ink/[0.06]">
                      <td className="px-4 py-2.5">
                        <span className="flex min-w-0 items-center gap-2.5">
                          <PersonAvatar name={p.name} />
                          <span className="min-w-0 truncate font-medium text-ink">{p.name}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <LabelCell person={p} relations={relations} disabled={pending} />
                      </td>
                      <td className="px-3 py-2.5">
                        <SamahanCell
                          person={p}
                          samahan={roster.mySamahan}
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
                      </td>
                      <td className="px-3 py-2.5">
                        <StateCell state={p.state} />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <RowActions person={p} pending={pending} run={run} setNotice={setNotice} setError={setError} />
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              {sections.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-ink/55" data-people-empty>
                    {emptyLine}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
      </div>

      {/* PHONE — the same rows, stacked. People is one of the five thumb targets. */}
      {sections.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink/55 sm:hidden">{emptyLine}</p>
      ) : null}
      {sections.length > 0 ? (
        <div className="space-y-6 sm:hidden">
          {sections.map((sec) => (
            <section key={sec.key}>
              <h3 className={`mb-1.5 ${PEOPLE_SECTION_HEADING}`}>
                {sec.label} <span className="tabular-nums text-ink/35">{formatCount(sec.rows.length)}</span>
              </h3>
              <ul className="flex list-none flex-col divide-y divide-ink/[0.07]">
                {sec.rows.map((p) => (
                  <li key={p.key} className="flex flex-col gap-2 py-3">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <PersonAvatar name={p.name} />
                      <span className="min-w-0 flex-1 truncate font-medium text-ink">{p.name}</span>
                      {/* The status pip only when the row is NOT simply connected. */}
                      {p.state !== 'connected' ? <StateCell state={p.state} /> : null}
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <LabelCell person={p} relations={relations} disabled={pending} />
                      <SamahanCell
                        person={p}
                        samahan={roster.mySamahan}
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
                    <span className="flex flex-wrap justify-end gap-2">
                      <RowActions person={p} pending={pending} run={run} setNotice={setNotice} setError={setError} />
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * REQUESTS — somebody asked to add you. The owner's words, one row each:
 * *"{name} is trying to add you from your {event} {type} event"* · Accept ·
 * Decline — or, with no event, *"{name} is trying to add you."* The sentence is
 * `connectionRequestSentence`, the same function the bell's title uses.
 */
function RequestsBlock({
  requests,
  pending,
  run,
}: {
  requests: RosterPerson[];
  pending: boolean;
  run: (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => void;
}) {
  return (
    <section aria-labelledby="people-requests-heading" data-people-requests>
      <h2 id="people-requests-heading" className={`mb-2 ${PEOPLE_SECTION_HEADING}`}>
        Waiting for your answer{' '}
        <span className="tabular-nums text-ink/35">{formatCount(requests.length)}</span>
      </h2>
      <ul className="flex list-none flex-col divide-y divide-ink/[0.07]">
        {requests.map((p) => (
          <li key={p.key} className="flex flex-col gap-2.5 py-3 sm:flex-row sm:items-center sm:gap-3">
            <span className="flex min-w-0 flex-1 items-start gap-2.5">
              <PersonAvatar name={p.name} />
              <span className="min-w-0 text-sm leading-snug text-ink" data-request-sentence>
                {connectionRequestSentence(p.name, p.fromEvent)}
              </span>
            </span>
            <span className="flex shrink-0 gap-2 pl-9 sm:pl-0">
              <button
                type="button"
                onClick={() => run(() => confirmConnection(p.connectionId ?? ''))}
                disabled={pending}
                className="button-primary inline-flex min-h-11 items-center gap-1 text-xs disabled:opacity-50"
              >
                <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                Accept
              </button>
              <button
                type="button"
                onClick={() => run(() => declineConnection(p.connectionId ?? ''))}
                disabled={pending}
                className="button-secondary inline-flex min-h-11 items-center gap-1 text-xs disabled:opacity-50"
              >
                <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                Decline
              </button>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-xs text-ink/55">
        Accepting connects you — and you follow each other. Nothing connects until you say so.
      </p>
    </section>
  );
}

/** One word per state, everywhere — "Waiting for them" is never shortened to
 *  "Waiting", which was also the name of a different state (problem 2). */
function StateCell({ state }: { state: RosterState }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-[12.5px] text-ink/70">
      <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${STATE_PIP[state]}`} />
      {STATE_LABEL[state]}
    </span>
  );
}

/**
 * The samahan a person is in, plus the ask.
 *
 * ⚖ THE CHIP SENDS AN INVITATION; IT DOES NOT ADD THEM. `community_members`
 * admits INSERT only for a Setnayan admin, so the product's own consent model
 * already says a person is ASKED into a samahan and never placed in one. The
 * interaction is the guest list's (a chip, one tap); the mechanism is samahan's
 * (their standing link, in that person's inbox). A chip appears here when they
 * actually join — never before, because there is nothing to show until they do.
 */
function SamahanCell({
  person,
  samahan,
  disabled,
  onSent,
  onFailed,
}: {
  person: RosterPerson;
  /** The samahan this account ORGANISES — the only ones that carry a link. */
  samahan: Array<{ id: string; name: string }>;
  disabled: boolean;
  onSent: (message: string) => void;
  onFailed: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Only a connected person can be asked into a group, and only into a samahan
  // you organise. Everyone else gets the plain read-only chips.
  const canAsk =
    person.kind === 'connection' && person.state === 'connected' && samahan.length > 0;

  const chips = person.samahan.map((s) => (
    <span
      key={s}
      className="inline-flex items-center rounded-full bg-ink/[0.06] px-2 py-0.5 text-[11px] font-medium text-ink/60 ring-1 ring-ink/10"
    >
      {s}
    </span>
  ));

  if (!canAsk) {
    return person.samahan.length === 0 ? (
      <span className="text-[12px] text-ink/35">—</span>
    ) : (
      <span className="flex flex-wrap gap-1">{chips}</span>
    );
  }

  function ask(communityId: string) {
    setOpen(false);
    startTransition(async () => {
      const res = await invitePersonToSamahan({
        connectionId: person.connectionId ?? '',
        communityId,
      });
      if (!res.ok) {
        onFailed(res.error);
        return;
      }
      onSent(
        res.delivered
          ? `Invitation to ${res.samahan} sent to ${person.name}.`
          : `The invitation to ${res.samahan} didn’t send — try again in a moment.`,
      );
    });
  }

  return (
    <span className="flex flex-wrap items-center gap-1">
      {chips}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled || busy}
        aria-haspopup="menu"
        aria-label={`Ask ${person.name} into a samahan`}
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-ink/25 px-2 py-0.5 text-[11px] font-medium text-ink/50 outline-none focus-visible:ring-2 focus-visible:ring-terracotta disabled:opacity-50"
      >
        <Plus aria-hidden className="h-3 w-3" strokeWidth={2.2} />
        Samahan
      </button>
      {open ? (
        <Popover anchorRef={triggerRef} onClose={() => setOpen(false)} width={240}>
          <p className="px-2.5 pb-1 pt-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45">
            Ask them into
          </p>
          {samahan.map((sam) => (
            <button
              key={sam.id}
              type="button"
              role="menuitem"
              onClick={() => ask(sam.id)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-ink/80 transition-colors hover:bg-ink/[0.04]"
            >
              <span className="min-w-0 flex-1 truncate">{sam.name}</span>
            </button>
          ))}
          <p className="px-2.5 pb-1.5 pt-1 text-[11px] leading-snug text-ink/45">
            They get the group’s link. They’re in it once they open it — not before.
          </p>
        </Popover>
      ) : null}
    </span>
  );
}

/**
 * The label IS the editor — click the chip, pick the word. (Alaga are not drawn
 * on this list: their word lives in the Alaga view's card, where the age fence
 * and the consent stamps live.)
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
  const triggerRef = useRef<HTMLButtonElement>(null);

  const chipClass = `inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${chipTint(
    person.relation,
  )}`;
  if (!person.canLabel) {
    // They added YOU — the claim is theirs to word, yours to answer.
    return person.relation ? (
      <span className={chipClass}>{RELATION_LABEL[person.relation]}</span>
    ) : (
      <span className="text-[12px] text-ink/35">—</span>
    );
  }

  function commit(next: ConnectionRelation | null) {
    setOpen(false);
    setFailed(null);
    startTransition(async () => {
      const res = await setConnectionLabel(person.connectionId ?? '', next);
      if (!res.ok) setFailed(res.error);
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
          person.relation
            ? `Change what ${person.name} is to you — currently ${RELATION_LABEL[person.relation]}`
            : `Say what ${person.name} is to you`
        }
        className="inline-flex rounded-full outline-none focus-visible:ring-2 focus-visible:ring-terracotta disabled:opacity-50"
      >
        {person.relation ? (
          <span className={chipClass}>{RELATION_LABEL[person.relation]}</span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-ink/50 border border-dashed border-ink/25">
            <Plus aria-hidden className="h-3 w-3" strokeWidth={2.2} />
            Label
          </span>
        )}
      </button>
      {failed ? <span className="ml-2 text-[11px] text-red-700">{failed}</span> : null}
      {open ? (
        <Popover anchorRef={triggerRef} onClose={() => setOpen(false)} width={228}>
          <p className="px-2.5 pb-1 pt-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45">
            How is {person.name.split(/\s+/)[0]} yours?
          </p>
          {relations.map((r) => (
            <button
              key={r}
              type="button"
              role="menuitem"
              onClick={() => commit(r)}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
                person.relation === r
                  ? 'bg-terracotta/10 font-medium text-terracotta-700'
                  : 'text-ink/80 hover:bg-ink/[0.04]'
              }`}
            >
              <span className="min-w-0 flex-1 truncate">{RELATION_LABEL[r]}</span>
            </button>
          ))}
          {person.relation ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => commit(null)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-ink/60 transition-colors hover:bg-ink/[0.04]"
            >
              Remove the label
            </button>
          ) : null}
          <p className="px-2.5 pb-1.5 pt-1 text-[11px] leading-snug text-ink/45">
            Lolo, lola, pinsan and the in-laws come out of these on their own.
          </p>
        </Popover>
      ) : null}
    </>
  );
}

function RowActions({
  person,
  pending,
  run,
  setNotice,
  setError,
}: {
  person: RosterPerson;
  pending: boolean;
  run: (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => void;
  setNotice: (s: string | null) => void;
  setError: (s: string | null) => void;
}) {
  const [busy, startTransition] = useTransition();
  const id = person.connectionId ?? '';

  // A request is answered in <RequestsBlock> (Accept / Decline), never here.
  if (person.state === 'waiting_them') {
    return (
      <span className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() =>
            startTransition(async () => {
              setError(null);
              setNotice(null);
              const res = await resendConnectionInvitation(id);
              if (!res.ok) setError(res.error);
              else
                setNotice(
                  res.delivered ? 'Sent again.' : 'The email didn’t send — try again in a moment.',
                );
            })
          }
          disabled={pending || busy}
          className="inline-flex min-h-11 items-center gap-1 px-1 text-xs text-mulberry-600 underline underline-offset-2 disabled:opacity-50"
        >
          <Send aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Send again
        </button>
        <button
          type="button"
          onClick={() => run(() => withdrawConnection(id))}
          disabled={pending || busy}
          className="min-h-11 px-1 text-xs text-ink/45 underline underline-offset-2 hover:text-ink disabled:opacity-50"
        >
          Withdraw
        </button>
      </span>
    );
  }

  if (person.state === 'connected') {
    return (
      <span className="flex justify-end">
        <button
          type="button"
          onClick={() => run(() => withdrawConnection(id))}
          disabled={pending || busy}
          className="min-h-11 px-1 text-xs text-ink/45 underline underline-offset-2 hover:text-ink disabled:opacity-50"
        >
          Remove
        </button>
      </span>
    );
  }

  return null;
}
