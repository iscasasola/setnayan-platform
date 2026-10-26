'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Search } from 'lucide-react';
import { ChosenRow, FormRow, TypedRow } from '@/app/_components/form-row';
import type { PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu-types';
import { normalizeSearchText } from '@/lib/guest-search';
import { RSVP_ROW_WORDS, type RsvpStatus } from '@/lib/guests';
import type { GuestProxyCard } from './guest-card-data';
import { useGuestActions } from './guest-actions-context';

/**
 * guest-proxy-row.tsx — 🧍‍♀️➡️🧍 "Proxy ▾" ON A ROLE HOLDER'S CARD (owner 2026-10-27, DECISION_LOG "A ROLE HOLDER CAN SEND A
 * PROXY"; controller's design: one dropdown — search this event's guests + "Add someone").
 *
 *   · nobody stands in → "Proxy ▾ None": pick a guest, or "＋ Add someone…" (a name, kept → a new guest, linked).
 *   · they NAMED someone on their reply → "Ma. Theresa named Maria Catherine Sacdalan as her proxy" with Link ▾ (that name
 *     searched in the same dropdown) and "Add as guest".
 *   · somebody stands in → "Proxy · Maria Catherine Sacdalan ›" (opens THEIR card) · Remove.
 *   · they said they can come after all → "Ma. Theresa says she can come after all — keep the proxy?" Keep · Remove. Never
 *     changed by itself.
 *
 * 🔑 NOT PART OF THE CARD'S FORM — its own write (`setGuestProxy`), so nothing here has a `name` and its events stop here:
 * a tap never wakes the autosave. Saves IN PLACE (owner rule: no screen reset) and refreshes the server data under it.
 * Handed in by `GuestCard` (`ProxyRow`), never imported by `GuestCardBody`, so the Maker's first load stays as it is.
 * Offered ONLY to a guest who holds a role (`proxy.offer`, `holdsARole`); the action refuses everyone else as well.
 */
const ADD = '__add_someone';

export function GuestProxyRow({
  eventId,
  guestId,
  firstName,
  proxy,
  variant,
}: {
  eventId: string;
  guestId: string;
  /** The role holder's first name — "Ma. Theresa says she can come after all". */
  firstName: string;
  proxy: GuestProxyCard;
  variant: 'page' | 'panel';
}) {
  const { setGuestProxy } = useGuestActions();
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cardHref = (id: string) => (variant === 'panel' ? `/dashboard/${eventId}/guests?inspect=${id}` : `/dashboard/${eventId}/guests/${id}`);

  const run = async (move: Parameters<typeof setGuestProxy>[2]): Promise<string | null> => {
    setBusy(true);
    setProblem(null);
    try {
      const res = await setGuestProxy(eventId, guestId, move);
      if (!res.ok) {
        setProblem(res.error);
        return res.error;
      }
      // The action revalidates the Guests page, so its answer already carries the new card — no second render.
      setAdding(false);
      return null;
    } catch {
      const why = 'Couldn’t save — check your connection and try again.';
      setProblem(why);
      return why;
    } finally {
      setBusy(false);
    }
  };

  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  const rep = proxy.representedBy;

  if (proxy.unread) {
    return (
      <p className="rounded-lg bg-warn-50/70 px-3 py-2 text-xs text-warn-900" data-guest-proxy-unread="">
        Couldn’t read who stands in for this guest — refresh to see it.
      </p>
    );
  }

  // ── somebody stands in ────────────────────────────────────────────────────
  if (rep) {
    return (
      <div data-guest-proxy="" data-guest-proxy-state="represented" onInput={stop} onChange={stop} className="contents">
        <FormRow
          name="Proxy"
          about={{ words: `${rep.name} comes in ${firstName}’s place: their seat, the role’s dress code and call time. ${firstName} keeps the role and is counted once, as ${rep.name} — with ${rep.name}’s reply.` }}
          line={RSVP_ROW_WORDS[rep.rsvp as RsvpStatus] ?? null}
          problem={problem}
          data="card-proxy"
          attrs={{ 'data-card-field': 'proxy' }}
        >
          <span className="ml-auto flex min-w-0 items-center gap-2">
            <Link href={cardHref(rep.guestId)} className="sn-press min-w-0 truncate text-sm font-medium text-sn-accent" data-guest-proxy-open={rep.guestId}>
              {rep.name} ›
            </Link>
            <button type="button" className="sn-press shrink-0 text-xs text-ink/55 underline-offset-2 hover:underline" disabled={busy} onClick={() => void run({ kind: 'remove' })} data-guest-proxy-remove="">
              Remove
            </button>
          </span>
        </FormRow>
        {proxy.cameAfterAll ? (
          <div className="space-y-2 rounded-lg bg-warn-50/70 px-3 py-2.5 text-[13px] text-warn-900" data-guest-proxy-came-after-all="">
            <p>
              {firstName} says they can come after all — keep {rep.name} as the proxy?
            </p>
            <div className="flex gap-2">
              <button type="button" className="sn-press rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-ink/15" disabled={busy} onClick={() => void run({ kind: 'keep' })}>
                Keep the proxy
              </button>
              <button type="button" className="sn-press rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-ink/15" disabled={busy} onClick={() => void run({ kind: 'remove' })}>
                {firstName} comes
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (!proxy.offer) return null;

  // ── nobody stands in: the one dropdown ────────────────────────────────────
  const q = normalizeSearchText(query);
  const choices = proxy.choices ?? [];
  const shown = q ? choices.filter((c) => normalizeSearchText(c.name).includes(q)) : choices;
  const options: PickOption[] = [
    ...shown.map((c) => ({ key: c.guestId, label: c.name })),
    { key: ADD, label: '＋ Add someone…' },
  ];
  const named = proxy.namedByGuest;
  const head = (
    <li role="none" className="sticky top-0 z-[2] -mx-1.5 -mt-1.5 mb-1 bg-cream/95 p-1.5 dark:bg-raised/95">
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/45" strokeWidth={2} />
        <input
          className="min-h-11 w-full rounded-xl border border-ink/15 bg-cream pl-9 pr-3 text-[14px] text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none dark:bg-raised"
          type="search"
          inputMode="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your guests"
          aria-label="Search your guests"
          data-guest-proxy-search=""
        />
      </div>
      {q && shown.length === 0 ? <p className="px-3 pt-2 text-[12px] text-ink/55">No guest matches “{query.trim()}” — add them below.</p> : null}
    </li>
  );
  const pick = (key: string) => {
    if (key === ADD) {
      setAdding(true);
      return;
    }
    void run({ kind: 'link', proxyGuestId: key });
  };

  return (
    <div data-guest-proxy="" data-guest-proxy-state={named ? 'named' : 'none'} onInput={stop} onChange={stop} className="contents">
      {named ? (
        <div className="space-y-2 rounded-lg bg-sn-accent/5 px-3 py-2.5 text-[13px] text-ink" data-guest-proxy-named="">
          <p>
            {firstName} named <span className="font-semibold">{named}</span> as their proxy.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="sn-press rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-ink/15"
              disabled={busy}
              onClick={() => setQuery(named)}
              data-guest-proxy-find-named=""
            >
              Link ▾ an existing guest
            </button>
            <button
              type="button"
              className="sn-press rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-ink/15"
              disabled={busy}
              onClick={() => void run({ kind: 'add', name: named })}
              data-guest-proxy-add-named=""
            >
              Add as guest
            </button>
          </div>
        </div>
      ) : null}
      <ChosenRow
        name="Proxy"
        about={{
          words: `Someone who comes in ${firstName}’s place. They take ${firstName}’s seat and wear the role’s dress code and call time; ${firstName} keeps the role and the pair counts once.`,
        }}
        label="Who stands in?"
        value={null}
        buttonText={proxy.choices === null ? 'Couldn’t read guests' : 'None'}
        options={proxy.choices === null ? [{ key: ADD, label: '＋ Add someone…' }] : options}
        onPick={pick}
        head={proxy.choices && proxy.choices.length > 0 ? head : undefined}
        problem={problem}
        data="card-proxy"
        attrs={{ 'data-card-field': 'proxy' }}
      />
      {adding ? (
        <TypedRow
          name="Their name"
          value=""
          empty="Type a name"
          placeholder="First and last name"
          autoCapitalize="words"
          openAsk={1}
          onKeep={async (text) => {
            const why = await run({ kind: 'add', name: text });
            return why ? { ok: false as const, error: why } : { ok: true as const };
          }}
          data="card-proxy-add"
          attrs={{ 'data-card-field': 'proxy_add' }}
        />
      ) : null}
    </div>
  );
}

