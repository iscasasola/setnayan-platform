'use client';

import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Check, Clock, Plus, Send, Users, X } from 'lucide-react';
import { Popover } from '@/app/dashboard/[eventId]/guests/_components/overlay-primitives';
import type { ConnectionRelation } from '@/lib/people-connections';
import { RELATION_LABEL, addConfirmation, normalizeEmail } from '@/lib/people-add';
import { parsePersonLine } from '@/lib/people-parse';
import type { PeopleRoster, RosterPerson, RosterState } from '@/lib/people-roster';
import type { PersonHit } from '@/lib/people-search-query';
import {
  addPersonByPublicId,
  addPersonConnection,
  confirmConnection,
  findPeopleByName,
  declineConnection,
  invitePersonToSamahan,
  resendConnectionInvitation,
  setConnectionLabel,
  withdrawConnection,
} from '../actions';

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
 * typed line and keeps focus so you can add several in a row · a FACET row of
 * counted chips · a table whose head is the same mono/uppercase/tracking rule ·
 * tier header rows · pill CHIPS in the same tint vocabulary (`role-groups.ts`
 * ROLE_GROUP_CHIP) · and a chip that is itself the editor, opening the shared
 * `<Popover>` primitive — the same one the guest rows use, imported rather than
 * copied so the two can never drift apart in behaviour or a11y.
 *
 * The tint mapping is chosen for MEANING, not for variety: ninong/ninang take
 * the violet the roster already gives principal sponsors, an alaga takes the
 * green it gives the bearers and flower girl, and a friend takes the neutral it
 * gives an ordinary guest. Somebody who knows the guest list already knows this
 * page.
 *
 * ── THE ONE THING THAT IS NOT LIKE THE GUEST LIST ──────────────────────────
 * A guest is the host's own record and changes the moment they type. A person
 * here is somebody else's account, and the row's STATE says whose move it is:
 * *waiting for your answer* carries Confirm and Decline, *waiting for them*
 * carries Send again and Withdraw. Optimism is deliberately absent — a row
 * flipping to "connected" before the other person has agreed would be the
 * product telling a lie about somebody else's decision.
 */

const STATE_LABEL: Record<RosterState, string> = {
  connected: 'Connected',
  waiting_them: 'Waiting for them',
  waiting_you: 'Waiting for your answer',
  in_your_care: 'You hold this',
};

const STATE_PIP: Record<RosterState, string> = {
  connected: 'bg-success-600',
  waiting_them: 'bg-warn-500',
  waiting_you: 'bg-terracotta',
  in_your_care: 'bg-mulberry',
};

/** The label chip's tint, taken from the roster's own vocabulary by MEANING. */
function chipTint(relation: ConnectionRelation | null, kind: 'connection' | 'alaga'): string {
  if (kind === 'alaga') return 'bg-success-100 text-success-800 ring-1 ring-success-200';
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

type Facet = 'all' | RosterState | 'unlabelled';

const FACETS: Array<{ key: Facet; label: string }> = [
  { key: 'all', label: 'Everyone' },
  { key: 'connected', label: 'Connected' },
  { key: 'waiting_them', label: 'Waiting' },
  { key: 'waiting_you', label: 'Needs you' },
  { key: 'in_your_care', label: 'In your care' },
  { key: 'unlabelled', label: 'No label yet' },
];

/** Section order — whose move it is first, then the shape of a family. */
const SECTIONS: Array<{ key: string; label: string; match: (p: RosterPerson) => boolean }> = [
  { key: 'needs', label: 'Waiting for your answer', match: (p) => p.state === 'waiting_you' },
  {
    key: 'family',
    label: 'Family',
    match: (p) =>
      p.kind === 'connection' &&
      p.state !== 'waiting_you' &&
      ['spouse', 'parent', 'child', 'sibling'].includes(p.relation ?? ''),
  },
  {
    key: 'ritual',
    label: 'Ninong & Ninang',
    match: (p) =>
      p.kind === 'connection' &&
      p.state !== 'waiting_you' &&
      ['godparent', 'godchild'].includes(p.relation ?? ''),
  },
  {
    key: 'friends',
    label: 'Friends',
    match: (p) => p.kind === 'connection' && p.state !== 'waiting_you' && p.relation === 'friend',
  },
  {
    key: 'unlabelled',
    label: 'No label yet',
    match: (p) => p.kind === 'connection' && p.state !== 'waiting_you' && p.relation === null,
  },
  { key: 'alaga', label: 'In your care · alaga', match: (p) => p.kind === 'alaga' },
];

export function PeopleRosterView({
  roster,
  relations,
  spouseNote,
}: {
  roster: PeopleRoster;
  /** Offerable labels — the server decides, by the spouse rule. */
  relations: ConnectionRelation[];
  spouseNote: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [line, setLine] = useState('');
  const [facet, setFacet] = useState<Facet>('all');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const draft = useMemo(() => parsePersonLine(line), [line]);
  const canAdd = draft.name.length > 0 && normalizeEmail(draft.email) !== null;

  // ── FIND SOMEBODY BY NAME (owner 2026-08-21, "just like facebook") ───────
  // The same one line does both: type an address and it invites, type a name
  // and it looks. No mode switch, because a person typing a name should not
  // first have to tell the app what kind of thing they are typing.
  const [hits, setHits] = useState<PersonHit[]>([]);
  const [looking, setLooking] = useState(false);
  // Who you have ALREADY asked in this sitting. Facebook's "Requested": the row
  // stays put and its button changes, so the ask is something you can SEE
  // happening rather than a row that vanishes and a sentence somewhere else.
  const [asked, setAsked] = useState<Set<string>>(new Set());
  const nameQuery = draft.email ? '' : line.trim();

  useEffect(() => {
    // An address is not a name — while one is being typed, nothing is searched.
    if (nameQuery.length < 2) {
      setHits([]);
      setLooking(false);
      return;
    }
    // Debounced, and every stale answer is dropped: `cancelled` is what stops a
    // slow response for "Ma" landing on top of the results for "Maria".
    let cancelled = false;
    setLooking(true);
    const t = setTimeout(async () => {
      const found = await findPeopleByName(nameQuery);
      if (cancelled) return;
      setHits(found);
      setLooking(false);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [nameQuery]);

  function addPicked(hit: PersonHit) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await addPersonByPublicId({ publicId: hit.publicId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // The result list is deliberately NOT cleared. Tapping Add is half of a
      // handshake, so the row stays and says so — clearing it would look like
      // the connection had been made.
      setAsked((prev) => new Set(prev).add(hit.publicId));
      setNotice(`Asked ${hit.name}. You're connected when they say yes.`);
    });
  }

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error);
    });
  }

  function submitAdd() {
    if (!canAdd || pending) return;
    const { name, email } = draft;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await addPersonConnection({ name, email });
      if (!res.ok) {
        // Keep the line so they can fix the address rather than retype it.
        setError(res.error);
        return;
      }
      setNotice(addConfirmation(name, res.delivered));
      setLine('');
      inputRef.current?.focus();
    });
  }

  const shown = roster.people.filter((p) => {
    if (facet === 'all') return true;
    if (facet === 'unlabelled') return p.kind === 'connection' && p.relation === null;
    return p.state === facet;
  });

  const sections = SECTIONS.map((s) => ({ ...s, rows: shown.filter(s.match) })).filter(
    (s) => s.rows.length > 0,
  );

  const counts: Record<Facet, number> = {
    all: roster.counts.all,
    connected: roster.counts.connected,
    waiting_them: roster.counts.waitingThem,
    waiting_you: roster.counts.waitingYou,
    in_your_care: roster.counts.inYourCare,
    unlabelled: roster.counts.unlabelled,
  };

  return (
    <div className="space-y-4">
      {/* CAPTURE — one line, then Enter, exactly like the roster's own. */}
      <div className="flex flex-col gap-2 rounded-tile border border-ink/10 bg-paper p-3 sm:flex-row sm:items-center">
        <span
          aria-hidden
          className="hidden h-7 w-7 shrink-0 place-items-center rounded-lg bg-terracotta/15 text-terracotta-700 sm:grid"
        >
          <Plus className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <input
          ref={inputRef}
          value={line}
          onChange={(e) => setLine(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submitAdd();
            }
          }}
          disabled={pending}
          placeholder="Type a name to find them — or a name and their email to invite"
          aria-label="Add someone by name and email"
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink/40"
        />
        <button
          type="button"
          onClick={submitAdd}
          disabled={pending || !canAdd}
          className="button-primary shrink-0 text-sm disabled:opacity-50"
        >
          {pending ? 'Adding…' : 'Add'}
        </button>
      </div>

      {nameQuery.length >= 2 ? (
        <div className="rounded-tile border border-ink/10 bg-paper">
          {looking && hits.length === 0 ? (
            <p className="px-4 py-3 text-sm text-ink/45">Looking…</p>
          ) : hits.length === 0 ? (
            <p className="px-4 py-3 text-sm text-ink/55">
              {/* An opted-out person, a name nobody has, and a name only
                  half-finished accounts carry all land HERE — the empty result
                  must never say which of the three happened. */}
              Nobody by that name. Add their email instead and we’ll invite them.
            </p>
          ) : (
            <ul className="flex list-none flex-col">
              {hits.map((h) => (
                <li
                  key={h.publicId}
                  className="flex items-center gap-3 border-b border-ink/[0.06] px-4 py-2.5 last:border-b-0"
                >
                  <Avatar name={h.name} kind="connection" photoUrl={h.photoUrl} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium text-ink">{h.name}</span>
                    {h.hint ? (
                      <span className="truncate text-[11.5px] text-ink/50">{h.hint}</span>
                    ) : null}
                  </span>
                  {asked.has(h.publicId) ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warn-100 px-2.5 py-1 text-[11px] font-medium text-warn-900">
                      <Clock aria-hidden className="h-3 w-3" strokeWidth={2} />
                      Asked
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => addPicked(h)}
                      disabled={pending}
                      className="button-secondary shrink-0 text-xs disabled:opacity-50"
                    >
                      Add
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <p className="text-xs text-ink/55">
        {/* Said the same way whether or not that address has an account — the
            alternative is a box that answers "is this address registered?". */}
        They get an email either way. If they aren’t on Setnayan yet it invites them to join — add
        them again once they’re in. You set what they are to you <em className="not-italic font-medium text-ink/70">after</em> they’re on your list.
      </p>

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

      {/* FACETS — counted chips, the roster's summary row. */}
      {roster.counts.all > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {FACETS.map((f) =>
            counts[f.key] === 0 && f.key !== 'all' ? null : (
              <button
                key={f.key}
                type="button"
                aria-pressed={facet === f.key}
                onClick={() => setFacet(f.key)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-medium transition-colors ${
                  facet === f.key
                    ? 'bg-terracotta/15 text-terracotta-700 ring-1 ring-terracotta/25'
                    : 'bg-paper text-ink/70 ring-1 ring-ink/10 hover:bg-ink/[0.04]'
                }`}
              >
                {f.label}
                <span className="tabular-nums opacity-60">{counts[f.key]}</span>
              </button>
            ),
          )}
        </div>
      ) : null}

      {spouseNote ? <p className="text-xs text-ink/45">{spouseNote}</p> : null}
      {roster.samahanUnavailable ? (
        <p className="text-xs text-ink/55">
          We couldn’t read your samahan just now, so the groups column may be missing some.
        </p>
      ) : null}

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
            <thead className="border-b border-ink/[0.07] font-mono text-[11px] uppercase tracking-[0.12em] text-ink/55">
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
                    <td
                      colSpan={5}
                      className="border-t border-ink/10 bg-ink/[0.02] px-4 pb-1.5 pt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-ink/55"
                    >
                      {sec.label} <span className="ml-1 tabular-nums text-ink/35">{sec.rows.length}</span>
                    </td>
                  </tr>
                  {sec.rows.map((p) => (
                    <tr key={p.key} className="border-t border-ink/[0.06]">
                      <td className="px-4 py-2.5">
                        <span className="flex min-w-0 items-center gap-2.5">
                          <Avatar name={p.name} kind={p.kind} />
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
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-ink/55">
                    {roster.counts.all === 0
                      ? 'Nobody here yet. Add the first person above — a name is enough to find them.'
                      : 'Nobody in this view. Try another chip.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
      </div>

      {/* PHONE — the same rows, stacked. People is one of the five thumb targets. */}
      {sections.length === 0 ? (
        <p className="rounded-tile border border-dashed border-ink/15 bg-paper px-4 py-8 text-center text-sm text-ink/55 sm:hidden">
          {roster.counts.all === 0
            ? 'Nobody here yet. Add the first person above — a name is enough to find them.'
            : 'Nobody in this view. Try another chip.'}
        </p>
      ) : null}
      {sections.length > 0 ? (
        <div className="space-y-4 sm:hidden">
          {sections.map((sec) => (
            <section key={sec.key}>
              <h3 className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink/55">
                {sec.label} <span className="tabular-nums text-ink/35">{sec.rows.length}</span>
              </h3>
              <ul className="flex list-none flex-col gap-2">
                {sec.rows.map((p) => (
                  <li
                    key={p.key}
                    className="flex flex-col gap-2 rounded-tile border border-ink/10 bg-paper p-3"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Avatar name={p.name} kind={p.kind} />
                      <span className="min-w-0 flex-1 truncate font-medium text-ink">{p.name}</span>
                      <StateCell state={p.state} compact />
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

function Avatar({
  name,
  kind,
  photoUrl,
}: {
  name: string;
  kind: 'connection' | 'alaga';
  photoUrl?: string | null;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  // A stored photo may be an `r2://` reference rather than a URL — those never
  // render, so only an http(s) value is used and everything else falls back to
  // initials rather than a broken glyph (the logo_url lesson, 2026-08-08).
  const src = photoUrl && /^https?:\/\//.test(photoUrl) ? photoUrl : null;
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        aria-hidden
        className="h-7 w-7 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${
        kind === 'alaga' ? 'bg-success-100 text-success-800' : 'bg-ink/[0.06] text-ink/60'
      }`}
    >
      {initials || '·'}
    </span>
  );
}

function StateCell({ state, compact }: { state: RosterState; compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-[12.5px] text-ink/70">
      <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${STATE_PIP[state]}`} />
      {compact && state === 'waiting_them' ? 'Waiting' : STATE_LABEL[state]}
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
 * The label IS the editor — click the chip, pick the word. An alaga's word is
 * not editable here: it is set in the alaga's own card, where the age fence and
 * the consent stamps live.
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
    person.kind,
  )}`;

  if (person.kind === 'alaga') {
    return <span className={chipClass}>{person.careLabel}</span>;
  }
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

  if (person.state === 'waiting_you') {
    return (
      <span className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => run(() => confirmConnection(id))}
          disabled={pending || busy}
          className="button-primary inline-flex items-center gap-1 text-xs disabled:opacity-50"
        >
          <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Confirm
        </button>
        <button
          type="button"
          onClick={() => run(() => declineConnection(id))}
          disabled={pending || busy}
          className="button-secondary inline-flex items-center gap-1 text-xs disabled:opacity-50"
        >
          <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Decline
        </button>
      </span>
    );
  }

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
          className="inline-flex items-center gap-1 text-xs text-mulberry-600 underline underline-offset-2 disabled:opacity-50"
        >
          <Send aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Send again
        </button>
        <button
          type="button"
          onClick={() => run(() => withdrawConnection(id))}
          disabled={pending || busy}
          className="text-xs text-ink/45 underline underline-offset-2 hover:text-ink disabled:opacity-50"
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
          className="text-xs text-ink/45 underline underline-offset-2 hover:text-ink disabled:opacity-50"
        >
          Remove
        </button>
      </span>
    );
  }

  // An alaga is managed in its own card below — nothing to do from the roster.
  return (
    <span className="flex items-center justify-end gap-1 text-[11.5px] text-ink/40">
      <Users aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
      in your care
    </span>
  );
}
