'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Check, Clock, Plus } from 'lucide-react';
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
 */
export function FindOrInvite() {
  const [pending, startTransition] = useTransition();
  const [line, setLine] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const draft = useMemo(() => parsePersonLine(line), [line]);
  const canAdd = draft.name.length > 0 && normalizeEmail(draft.email) !== null;

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

  return (
    <div className="space-y-2" data-find-or-invite>
      {/* CAPTURE — one line, then Enter, exactly like the roster's own. */}
      <div className="flex flex-col gap-2 rounded-tile bg-white/70 p-2.5 sm:flex-row sm:items-center">
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
          className="min-h-11 min-w-0 flex-1 bg-transparent px-1 text-sm text-ink outline-none placeholder:text-ink/40"
        />
        <button
          type="button"
          onClick={submitAdd}
          disabled={pending || !canAdd}
          className="button-primary min-h-11 shrink-0 text-sm disabled:opacity-50"
        >
          {pending ? 'Adding…' : 'Add'}
        </button>
      </div>

      {nameQuery.length >= 2 ? (
        <div className="rounded-tile bg-white/60">
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
              {hits.map((h) => {
                const isFollowing = h.following || followed.has(h.publicId);
                return (
                  <li
                    key={h.publicId}
                    className="flex items-center gap-3 border-b border-ink/[0.06] px-4 py-2.5 last:border-b-0"
                  >
                    <PersonAvatar name={h.name} photoUrl={h.photoUrl} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium text-ink">
                        {h.name}
                        {h.handle ? (
                          <span className="ml-1.5 font-mono text-[11.5px] font-normal text-ink/45">
                            {h.handle}
                          </span>
                        ) : null}
                      </span>
                      {h.fullName ? (
                        <span className="truncate text-[11.5px] text-ink/65">{h.fullName}</span>
                      ) : null}
                      {h.hint ? (
                        <span className="truncate text-[11.5px] text-ink/50">{h.hint}</span>
                      ) : null}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {/* FOLLOW — only toward a public profile, the one case the
                          write is accepted. A private profile shows Add alone. */}
                      {isFollowing ? (
                        <span
                          className="inline-flex items-center gap-1 text-[11.5px] font-medium text-ink/55"
                          data-following
                        >
                          <Check aria-hidden className="h-3 w-3" strokeWidth={2.2} />
                          Following
                        </span>
                      ) : h.followable ? (
                        <button
                          type="button"
                          onClick={() => followPicked(h)}
                          disabled={pending}
                          className="button-secondary min-h-11 text-xs disabled:opacity-50"
                        >
                          Follow
                        </button>
                      ) : null}
                      {asked.has(h.publicId) ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warn-100 px-2.5 py-1 text-[11px] font-medium text-warn-900">
                          <Clock aria-hidden className="h-3 w-3" strokeWidth={2} />
                          Asked
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => addPicked(h)}
                          disabled={pending}
                          className="button-secondary min-h-11 text-xs disabled:opacity-50"
                        >
                          Add
                        </button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

      <p className="text-xs text-ink/55">
        {/* Said the same way whether or not that address has an account — the
            alternative is a box that answers "is this address registered?". */}
        They get an email either way. If they aren’t on Setnayan yet it invites them to join — add
        them again once they’re in. You set what they are to you{' '}
        <em className="not-italic font-medium text-ink/70">after</em> they’re on your list.
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
    </div>
  );
}
