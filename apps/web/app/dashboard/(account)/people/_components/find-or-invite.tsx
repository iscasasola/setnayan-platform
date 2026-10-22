'use client';

import { useEffect, useMemo, useRef, useState, useTransition, type RefObject } from 'react';
import { Check, Clock, Search, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import gs from '@/app/dashboard/[eventId]/guests/_components/guests-screen.module.css';
import { addConfirmation, normalizeEmail } from '@/lib/people-add';
import { parsePersonLine } from '@/lib/people-parse';
import type { PersonHit } from '@/lib/people-search-query';
import {
  addPersonByPublicId,
  addPersonConnection,
  findPeopleByName,
  setFollowByPublicId,
} from '../actions';
import { PersonAvatar } from './person-avatar';

/**
 * find-or-invite.tsx — the People page's one line: type a name to find them,
 * or a name and their email to invite (owner 2026-08-21, *"just like
 * facebook"*). Lifted out of `people-roster-view.tsx` unchanged in behaviour so
 * the Connected, Following and Followers views can all carry it — frame D of
 * the approved People redesign: *"The find-or-invite line stays at the top (it
 * is the same 'every findable name' half)."*
 *
 * ── WHAT THE REDESIGN ADDED: FOLLOW BESIDE ADD (frame F) ──────────────────
 * Owner 2026-09-28: *"They can follow without request but adding them will be
 * connected people."* So a hit carries both: Follow (one-way, no request —
 * drawn only when their profile is public, which is exactly what `followUser`
 * accepts) and Add (the request, always). After a tap the row stays and says
 * so — "Following", "Asked" — because clearing it would look like nothing
 * happened, or like a connection that has not been made.
 *
 * ── 2026-10-22: THE LINE MOVES INTO THE THUMB ROW ─────────────────────────
 * Owner, 22 Oct: *"People must look similar to guests."* The approved
 * prototype (`prototypes/people_and_memories_template_2026-10-22.html`, P2)
 * moves the line to exactly where Guests keeps "Search or add" — the field of
 * the glass thumb row. So this file is now ONE state (`useFindOrInvite`) read
 * by TWO pieces: `FindField` (the thumb row's box) and `FindResults` (the hits
 * and the invite card, in the list). The behaviour is unchanged: the same
 * parser, the same Follow · Add pair, the same invite. What is new is the
 * Add card's own email box ("Not the one? Invite … by email") — the one-line
 * "name email" still works, it simply fills that box.
 */
export type FindOrInviteState = ReturnType<typeof useFindOrInvite>;

export function useFindOrInvite() {
  const [pending, startTransition] = useTransition();
  const [line, setLine] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const draft = useMemo(() => parsePersonLine(line), [line]);
  // The address is the one typed on the line ("Ana ana@x.com"), else the card's own box.
  const address = draft.email || email;
  const inviteName = (draft.email ? draft.name : line).trim();
  const canAdd = inviteName.length > 0 && normalizeEmail(address) !== null;

  // The same one line does both: type an address and it invites, type a name
  // and it looks. No mode switch, because a person typing a name should not
  // first have to tell the app what kind of thing they are typing.
  const [hits, setHits] = useState<PersonHit[]>([]);
  const [looking, setLooking] = useState(false);
  // Who you have ALREADY asked / followed in this sitting — Facebook's
  // "Requested": the row stays put and its button changes.
  const [asked, setAsked] = useState<Set<string>>(new Set());
  const [followed, setFollowed] = useState<Set<string>>(new Set());
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
      setAsked((prev) => new Set(prev).add(hit.publicId));
      setNotice(`Asked ${hit.name}. You're connected when they say yes.`);
    });
  }

  function followPicked(hit: PersonHit) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await setFollowByPublicId({ publicId: hit.publicId, follow: true });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setFollowed((prev) => new Set(prev).add(hit.publicId));
    });
  }

  function submitAdd() {
    if (!canAdd || pending) return;
    const name = inviteName;
    const to = address;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await addPersonConnection({ name, email: to });
      if (!res.ok) {
        // Keep the line so they can fix the address rather than retype it.
        setError(res.error);
        return;
      }
      setNotice(addConfirmation(name, res.delivered));
      setLine('');
      setEmail('');
      inputRef.current?.focus();
    });
  }

  return {
    pending,
    line,
    setLine,
    email,
    setEmail,
    draft,
    canAdd,
    inviteName,
    nameQuery,
    hits,
    looking,
    asked,
    followed,
    error,
    notice,
    inputRef,
    addPicked,
    followPicked,
    submitAdd,
  };
}

/** The thumb row's box — "Find or invite", where Guests keeps "Search or add". */
export function FindField({ f, inputRef }: { f: FindOrInviteState; inputRef?: RefObject<HTMLInputElement | null> }) {
  return (
    <span className={`${gs.field} flex items-center gap-2`} data-find-field="">
      <Search aria-hidden className="h-[18px] w-[18px] shrink-0 text-ink/45" strokeWidth={1.8} />
      <input
        ref={(el) => {
          (f.inputRef as { current: HTMLInputElement | null }).current = el;
          if (inputRef) (inputRef as { current: HTMLInputElement | null }).current = el;
        }}
        value={f.line}
        onChange={(e) => f.setLine(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            f.submitAdd();
          }
        }}
        disabled={f.pending}
        placeholder="Find or invite"
        aria-label="Find someone by name — or a name and their email to invite"
        enterKeyHint="search"
        className="min-h-0 min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink/45"
      />
      {f.line ? (
        <button
          type="button"
          aria-label="Clear"
          onClick={() => {
            f.setLine('');
            f.inputRef.current?.focus();
          }}
          className="grid h-8 min-h-0 w-8 shrink-0 place-items-center rounded-full text-ink/55"
        >
          <X aria-hidden className="h-4 w-4" strokeWidth={2} />
        </button>
      ) : null}
    </span>
  );
}

/**
 * What the line found — "On Setnayan" (Follow · Add, the shipped pair) and the
 * invite card. Drawn in the list, under the rows the same line filtered.
 */
export function FindResults({ f }: { f: FindOrInviteState }) {
  const { nameQuery, hits, looking, followed, asked, pending, followPicked, addPicked } = f;
  const typedAnAddress = Boolean(f.draft.email);
  const showCard = nameQuery.length >= 2 || typedAnAddress;
  return (
    <div data-find-or-invite="">
      {nameQuery.length >= 2 ? (
        <section className={gs.sec} data-find-hits="">
          <div className={gs.barWrap}>
            <span className={gs.bar} style={{ cursor: 'default' }}>
              <span className={gs.ico} aria-hidden>
                <Search strokeWidth={1.9} />
              </span>
              <span className={gs.lab}>On Setnayan</span>
              <span className={gs.n}>{looking ? '· looking…' : `· ${hits.length}`}</span>
            </span>
          </div>
          {looking && hits.length === 0 ? null : hits.length === 0 ? (
            <p className={gs.empty}>
              {/* An opted-out person, a name nobody has, and a name only
                  half-finished accounts carry all land HERE — the empty result
                  must never say which of the three happened. */}
              Nobody by that name. Add their email instead and we’ll invite them.
            </p>
          ) : (
            <ul className="flex list-none flex-col">
              {hits.map((h) => {
                const isFollowing = h.following || followed.has(h.publicId);
                return (
                  <li key={h.publicId} className={gs.g} data-find-hit="">
                    <span className={gs.ava} aria-hidden>
                      <PersonAvatar name={h.name} photoUrl={h.photoUrl} size="row" />
                    </span>
                    <span className="min-w-0">
                      <span className={gs.nm}>
                        <span className={gs.nmt}>{h.name}</span>
                      </span>
                      <span className={`${gs.meta} block truncate`}>
                        {[h.handle, h.fullName, h.hint].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span className={gs.acts}>
                      {/* FOLLOW — only toward a public profile, the one case the
                          write is accepted. A private profile shows Add alone. */}
                      {isFollowing ? (
                        <span className={`${gs.pill} ${gs.pillOk} inline-flex items-center gap-1`} data-following>
                          <Check aria-hidden className="h-3 w-3" strokeWidth={2.2} />
                          Following
                        </span>
                      ) : h.followable ? (
                        <ActionButton tone="neutral" icon={Check} label="Follow" onClick={() => followPicked(h)} disabled={pending} />
                      ) : null}
                      {asked.has(h.publicId) ? (
                        <span className={`${gs.pill} ${gs.pillWine} inline-flex items-center gap-1`}>
                          <Clock aria-hidden className="h-3 w-3" strokeWidth={2} />
                          Asked
                        </span>
                      ) : (
                        <ActionButton tone="brand" main icon={Check} label="Add" onClick={() => addPicked(h)} disabled={pending} />
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      {showCard ? (
        <div className="mt-2.5 rounded-2xl bg-ink/[0.04] px-3.5 py-3" data-invite-card="">
          <p className="text-[15px] font-semibold text-ink">
            {hits.length > 0 ? 'Not the one? ' : ''}
            <span className="font-normal text-ink/60">
              Invite “{f.inviteName || f.line.trim()}” by email
            </span>
          </p>
          {typedAnAddress ? null : (
            <input
              type="email"
              inputMode="email"
              value={f.email}
              onChange={(e) => f.setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  f.submitAdd();
                }
              }}
              placeholder="their@email.com"
              aria-label="Their email"
              className="mt-2.5 block h-11 w-full rounded-xl border border-ink/15 bg-cream px-3 text-[15px] text-ink outline-none placeholder:text-ink/40 focus-visible:ring-2 focus-visible:ring-terracotta" // no-card-ok: the email field, not a container
            />
          )}
          <div className="mt-2.5 flex items-center gap-2.5">
            <p className="flex-1 text-[12.5px] leading-snug text-ink/60">
              {/* Said the same way whether or not that address has an account — the
                  alternative is a box that answers "is this address registered?". */}
              They get an email either way. If they aren’t on Setnayan yet it invites them to join — add
              them again once they’re in. You set what they are to you{' '}
              <em className="not-italic font-medium text-ink/80">after</em> they’re on your list.
            </p>
            <ActionButton
              tone="brand"
              main
              icon={Check}
              label={pending ? 'Adding…' : 'Invite'}
              onClick={f.submitAdd}
              disabled={pending || !f.canAdd}
              data-testid="people-invite"
            />
          </div>
        </div>
      ) : null}

      {f.error ? (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">
          {f.error}
        </p>
      ) : null}
      {f.notice ? (
        <p role="status" className="mt-2 text-sm text-mulberry-600">
          {f.notice}
        </p>
      ) : null}
    </div>
  );
}
