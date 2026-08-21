'use client';

import { useState, useTransition } from 'react';
import { UserPlus, Check, X, Clock, Send, Users } from 'lucide-react';
import {
  addPersonConnection,
  confirmConnection,
  declineConnection,
  resendConnectionInvitation,
  withdrawConnection,
} from '../actions';
import type { ConnectionRelation } from '@/lib/people-connections';
import { RELATION_HINT, RELATION_LABEL, addConfirmation, normalizeEmail } from '@/lib/people-add';

/**
 * ADD SOMEONE — one card, one question at a time, and it actually reaches them.
 *
 * ── WHAT CHANGED AND WHY ───────────────────────────────────────────────────
 * The old card was a relationship dropdown, an email box, and a button that
 * silently wrote a database row. Three things were wrong with it and only one
 * was cosmetic:
 *
 *  1. Nothing was ever SENT. Fixed in `addPersonConnection` — every add now
 *     ends in an email, and this screen reports whether it left the building.
 *  2. It never said anything back. The input just cleared, which reads
 *     identically to a failure.
 *  3. It offered "Spouse" to everybody. Owner, 2026-08-21: no spouse while your
 *     status is single — you become married by your wedding here, or by saying
 *     so on your profile. The offered list is computed on the SERVER and passed
 *     in; this component never decides it.
 *
 * ── SHAPE, AND WHY CHIPS ───────────────────────────────────────────────────
 * Relationship first, as a row of chips rather than a `<select>`: one tap on a
 * phone instead of three, every option visible without opening anything, and a
 * line underneath that says what the chosen word means. That matters most for
 * the two people hesitate over — "child" (a grown son or daughter, not an
 * alaga) and "ninong/ninang" (yours, not your child's).
 *
 * The alaga branch deliberately stays its own section below: a child or elder
 * in your care is a profile YOU hold, not a person being asked to confirm
 * anything, and merging the two blurs the exact line the pilot boundary draws.
 */

export type ConnectionItem = {
  connectionId: string;
  relation: string;
  layer: string;
  status: string;
  otherName: string | null;
};

type Result = { ok: true } | { ok: false; error: string };

function relationLabel(relation: string): string {
  return RELATION_LABEL[relation as ConnectionRelation] ?? relation;
}

export function ConnectionsPanel({
  incoming,
  outgoing,
  confirmed,
  relations,
  spouseNote,
}: {
  incoming: ConnectionItem[];
  outgoing: ConnectionItem[];
  confirmed: ConnectionItem[];
  /** Offerable relations — decided on the server by the spouse rule. */
  relations: ConnectionRelation[];
  /** Why "Spouse" is missing, when it is. Null when it is offered. */
  spouseNote: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [relation, setRelation] = useState<ConnectionRelation>(relations[0] ?? 'friend');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const canSend = name.trim().length > 0 && normalizeEmail(email) !== null;

  function run(fn: () => Promise<Result>, onOk?: () => void) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error);
      else onOk?.();
    });
  }

  function submit() {
    const who = name.trim();
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await addPersonConnection({ relation, name: who, email });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // ONE sentence for both server branches — this screen must not be able to
      // tell whether that address already has an account (see lib/people-add).
      setNotice(addConfirmation(who, res.delivered));
      setName('');
      setEmail('');
    });
  }

  return (
    <div className="space-y-8">
      <section className="sn-tile space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-ink">Add someone</h2>
          <p className="text-sm text-ink/60">
            Add only your closest. Grandparents, cousins, and in-laws appear on their own once
            these are confirmed.
          </p>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-ink">How are they connected to you?</legend>
          <div className="flex flex-wrap gap-2">
            {relations.map((r) => {
              const on = r === relation;
              return (
                <button
                  key={r}
                  type="button"
                  aria-pressed={on}
                  disabled={pending}
                  onClick={() => setRelation(r)}
                  className={`rounded-full border px-4 py-2 text-sm transition disabled:opacity-50 ${
                    on
                      ? 'border-mulberry bg-mulberry/10 font-medium text-mulberry'
                      : 'border-ink/15 bg-white text-ink hover:border-ink/30'
                  }`}
                >
                  {RELATION_LABEL[r]}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-ink/55">{RELATION_HINT[relation]}</p>
          {spouseNote ? <p className="text-xs text-ink/45">{spouseNote}</p> : null}
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-ink" htmlFor="conn-name">
              Their name
            </label>
            <input
              id="conn-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Maria"
              disabled={pending}
              className="input-field"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-ink" htmlFor="conn-email">
              Their email
            </label>
            <input
              id="conn-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="maria@email.com"
              disabled={pending}
              className="input-field"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={submit}
            disabled={pending || !canSend}
            className="button-primary inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <UserPlus aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            {pending ? 'Sending…' : 'Send invitation'}
          </button>
          <p className="max-w-md text-xs text-ink/55">
            {/* The honest caveat, said the same way whether or not they have an
                account — the alternative is a box that answers "is this address
                registered?" for anyone who types one in. */}
            They get an email either way. If they aren’t on Setnayan yet it invites them to join —
            add them again once they’re in.
          </p>
        </div>

        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="text-sm text-mulberry">
            {notice}
          </p>
        ) : null}
      </section>

      {incoming.length > 0 ? (
        <section>
          <h2 className="mb-3 text-base font-semibold text-ink">Waiting for your answer</h2>
          <ul className="space-y-2">
            {incoming.map((c) => (
              <li
                key={c.connectionId}
                className="flex flex-col gap-2 rounded-lg border border-ink/10 bg-cream p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="text-sm text-ink">
                  <span className="font-medium">{c.otherName ?? 'Someone'}</span> added you as their{' '}
                  {relationLabel(c.relation).toLowerCase()}.
                </span>
                <span className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => run(() => confirmConnection(c.connectionId))}
                    disabled={pending}
                    className="button-primary inline-flex items-center gap-1 text-xs disabled:opacity-50"
                  >
                    <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => run(() => declineConnection(c.connectionId))}
                    disabled={pending}
                    className="button-secondary inline-flex items-center gap-1 text-xs disabled:opacity-50"
                  >
                    <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                    Decline
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {confirmed.length > 0 ? (
        <section>
          <h2 className="mb-3 text-base font-semibold text-ink">Your people</h2>
          <ul className="space-y-2">
            {confirmed.map((c) => (
              <li
                key={c.connectionId}
                className="flex items-center gap-3 rounded-lg border border-ink/10 bg-cream p-3"
              >
                <Users aria-hidden className="h-4 w-4 shrink-0 text-ink/40" strokeWidth={1.75} />
                <span className="flex-1 text-sm font-medium text-ink">
                  {c.otherName ?? 'A connection'}
                </span>
                <span className="text-xs text-ink/55">{relationLabel(c.relation)}</span>
                <button
                  type="button"
                  onClick={() => run(() => withdrawConnection(c.connectionId))}
                  disabled={pending}
                  className="text-xs text-ink/45 underline underline-offset-2 hover:text-ink disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {outgoing.length > 0 ? (
        <section>
          <h2 className="mb-3 text-base font-semibold text-ink">Waiting for them</h2>
          <ul className="space-y-2">
            {outgoing.map((c) => (
              <li
                key={c.connectionId}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-ink/10 bg-white/40 p-3"
              >
                <Clock aria-hidden className="h-4 w-4 shrink-0 text-ink/40" strokeWidth={1.75} />
                <span className="flex-1 text-sm text-ink">
                  {/* Their name stays hidden until they confirm — the 2026-07-05
                      name-visibility rule. The RELATION can show, because it is
                      the adder's own claim about their own life. */}
                  {c.otherName ?? `Your ${relationLabel(c.relation).toLowerCase()}`}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    startTransition(async () => {
                      setError(null);
                      setNotice(null);
                      const res = await resendConnectionInvitation(c.connectionId);
                      if (!res.ok) setError(res.error);
                      else
                        setNotice(
                          res.delivered
                            ? 'Sent again.'
                            : 'The email didn’t send — try again in a moment.',
                        );
                    })
                  }
                  disabled={pending}
                  className="inline-flex items-center gap-1 text-xs text-mulberry underline underline-offset-2 disabled:opacity-50"
                >
                  <Send aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Send again
                </button>
                <button
                  type="button"
                  onClick={() => run(() => withdrawConnection(c.connectionId))}
                  disabled={pending}
                  className="text-xs text-ink/45 underline underline-offset-2 hover:text-ink disabled:opacity-50"
                >
                  Withdraw
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
