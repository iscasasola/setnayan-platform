'use client';

/**
 * home-whos-here-card.tsx — WHO'S HERE, on the event's Home (owner 2026-10-29, verbatim: *"on event>home page. can we
 * add a list of who is viewing our event hub or inside the event dashboard now?"* → *"a widget for this as well? so
 * when 2 cohost/helper or coordinator is on the dashboard and which guest is viewing the event hub?"*).
 *
 * One card in the Home service-card style (`sg-row`, like Papic's), two rows:
 *   · ON THE DASHBOARD — the team's faces from the layout's ONE presence channel (`event-team-presence.tsx`): first
 *     name + Host · Co-host · Helper · Coordinator. The viewer is not a face of their own: "Just you right now".
 *   · VIEWING THE EVENT HUB — the guests who opened it with their own pass (faces; a tap opens that guest's card, the
 *     shipped sheet) and everyone else as a number. The last 30 minutes (`WHOS_HERE_WINDOW_MIN`, in the ⓘ).
 *
 * ONE READ: the page hands the first answer in (`readHubViewers`, one call of `event_hub_viewers`). It is asked again
 * only when someone joins or leaves the dashboard (the presence pulse) or this tab comes back into view — never on a
 * timer of its own. A read that fails says so with ⟳ Reload, and the last answer is never redrawn as "nobody".
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Eye, RotateCw } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { ActionButton } from '@/components/action-button';
import { PersonAvatar } from '@/app/dashboard/(account)/people/_components/person-avatar';
import { createClient } from '@/lib/supabase/client';
import { onTabReturn } from '@/lib/tab-return';
import {
  WHOS_HERE_FACES,
  WHOS_HERE_WINDOW_MIN,
  guestFaceName,
  hubWords,
  parseHubViewers,
  teamWords,
  type HubViewers,
} from '@/lib/whos-here';
import { useEventTeamPresence } from '../event-team-presence';
import type { GuestCardResult } from '../../guests/_components/guest-card';
import { formatCount } from '@/lib/format-number';

/** The guest's card — loaded on the first tap, never with Home. */
const GuestSheet = dynamic(() => import('./home-whos-here-guest-sheet'), { ssr: false });

type GuestCardPerson = { id: string; name: string };

/** Asked again at most this often, whatever pulls it (a burst of arrivals, a flick between tabs). */
const REREAD_GAP_MS = 20_000;

export function HomeWhosHereCard({
  eventId,
  initial,
  hubEnabled,
  openGuest,
}: {
  eventId: string;
  /** The page's own read (`readHubViewers`) — `null` when it failed. */
  initial: HubViewers | null;
  /** `hubViewsEnabled()` — false when the beacon is switched off (`HUB_VIEWS_DISABLED`). */
  hubEnabled: boolean;
  /** How a tapped guest's card is read — the shipped action, or a dev lab's stand-in. */
  openGuest?: (eventId: string, guestId: string) => Promise<GuestCardResult>;
}) {
  const team = useEventTeamPresence();
  const [viewers, setViewers] = useState<HubViewers | null>(initial);
  const [failed, setFailed] = useState(initial === null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<GuestCardPerson | null>(null);
  const lastRead = useRef(Date.now());
  // The page read again (a save's refresh, the day's tick) → its answer is the newest.
  useEffect(() => {
    if (initial) {
      setViewers(initial);
      setFailed(false);
    }
  }, [initial]);

  const reread = useCallback(
    async (force = false) => {
      if (!hubEnabled) return;
      if (!force && Date.now() - lastRead.current < REREAD_GAP_MS) return;
      lastRead.current = Date.now();
      setBusy(true);
      try {
        const { data, error } = await createClient().rpc('event_hub_viewers', {
          p_event_id: eventId,
          p_window_minutes: WHOS_HERE_WINDOW_MIN,
        });
        const v = error ? null : parseHubViewers(data);
        // 🔒 A failed read keeps the last answer on screen and SAYS it failed — never an empty list.
        if (error) console.error('[supabase-error] home-whos-here-card · rpc:event_hub_viewers', error);
        if (v) setViewers(v);
        setFailed(v === null);
      } catch (err) {
        console.error('[whos-here] re-read failed', err);
        setFailed(true);
      } finally {
        setBusy(false);
      }
    },
    [eventId, hubEnabled],
  );

  // Someone arrived on or left the dashboard → ask once more (the pulse is the presence channel's, not a timer).
  const pulse = team?.pulse ?? 0;
  useEffect(() => {
    if (pulse > 0) void reread();
  }, [pulse, reread]);
  // This tab came back into view → ask once more.
  useEffect(() => onTabReturn(() => void reread(), { minGapMs: REREAD_GAP_MS }), [reread]);

  const peers = team?.peers ?? null;
  const teamState = team ? team.state : 'failed';
  const guests = viewers && viewers.may_name ? viewers.guests : [];
  const shownGuests = guests.slice(0, WHOS_HERE_FACES);
  const moreGuests = Math.max(0, (viewers?.guest_total ?? 0) - shownGuests.length);

  return (
    <section className="sg-row" data-home-whos-here="" data-tour="home-whos-here" aria-label="Who’s here">
      <div className="sg-head">
        <span className="sg-mark" aria-hidden>
          <Eye strokeWidth={1.9} />
        </span>
        <span className="min-w-0 flex-1">
          <InfoTip label="Who’s here" labelClassName="sg-name" align="start">
            On the dashboard: the hosts, co-hosts, helpers and coordinators who have this event open now — a tab left in the
            background drops off after half a minute. Event Hub: guests are named only when they opened it with their own
            invitation; everyone else is a number, never who. The last {WHOS_HERE_WINDOW_MIN} minutes, each device
            counted once per half hour. Only your event’s team sees this card.
          </InfoTip>
          <span className="sg-brand block truncate">On the dashboard now · the Event Hub, last {WHOS_HERE_WINDOW_MIN} min</span>
        </span>
      </div>

      {/* The two halves side by side from md (the width is there to use), stacked on a phone. */}
      <div className="md:grid md:grid-cols-2 md:gap-6">
      {/* ── ON THE DASHBOARD ─────────────────────────────────────────────── */}
      <div className="mt-3 min-w-0" data-whos-here-team={teamState}>
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink/55">On the dashboard</p>
        <p role="status" className="mt-0.5 text-[13.5px] text-ink/75" data-whos-here-team-words="">
          {teamWords(peers, teamState)}
        </p>
        {peers && peers.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2" data-whos-here-team-faces="">
            {peers.map((p) => (
              <li key={p.id} className="flex min-w-0 items-center gap-2" data-whos-here-peer={p.role}>
                <PersonAvatar name={p.name} photoUrl={p.photo} />
                <span className="min-w-0 leading-tight">
                  <span className="block truncate text-[13.5px] font-medium">{p.name}</span>
                  <span className="block truncate text-[11.5px] text-ink/55">{p.role}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* ── VIEWING THE EVENT HUB ────────────────────────────────────────── */}
      <div
        className="mt-3 min-w-0 border-t border-ink/10 pt-3 md:border-l md:border-t-0 md:pl-6 md:pt-0"
        data-whos-here-hub={failed ? 'unread' : 'read'}
      >
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink/55">Viewing the Event Hub</p>
        <div className="mt-0.5 flex flex-wrap items-center justify-between gap-2">
          <p role="status" className="min-w-0 text-[13.5px] text-ink/75" data-whos-here-hub-words="">
            {failed && viewers ? `${hubWords(viewers, hubEnabled)} · couldn’t refresh` : hubWords(failed ? null : viewers, hubEnabled)}
          </p>
          {failed && hubEnabled ? (
            <ActionButton
              tone="neutral"
              icon={RotateCw}
              label={busy ? 'Loading…' : 'Reload'}
              disabled={busy}
              data-testid="whos-here-reload"
              // one-render: keep (retry) — the person's Reload of a read that failed; it re-reads one function, nothing else.
              onClick={() => void reread(true)}
            />
          ) : null}
        </div>
        {viewers && !viewers.may_name && viewers.team ? (
          <p className="mt-1 text-[12px] text-ink/55" data-whos-here-names-hidden="">
            Guest names show for people with the guest list.
          </p>
        ) : null}
        {shownGuests.length > 0 ? (
          <ul className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-1" data-whos-here-guest-faces="">
            {shownGuests.map((g) => {
              const name = guestFaceName(g);
              return (
                <li key={g.guest_id}>
                  <button
                    type="button"
                    className="flex min-h-[44px] items-center gap-2 rounded-full py-1 pl-1 pr-3 text-left hover:bg-ink/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-mulberry"
                    onClick={() => setOpen({ id: g.guest_id, name })}
                    aria-label={`Open ${name}’s guest card`}
                    data-whos-here-guest={g.guest_id}
                  >
                    <PersonAvatar name={name} photoUrl={g.photo_url} />
                    <span className="max-w-[9rem] truncate text-[13.5px] font-medium">{name}</span>
                  </button>
                </li>
              );
            })}
            {moreGuests > 0 ? (
              <li className="px-2 text-[13px] font-medium text-ink/60" data-whos-here-more={moreGuests}>
                +{formatCount(moreGuests)}
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>

      </div>

      {open ? (
        <GuestSheet eventId={eventId} person={open} onClose={() => setOpen(null)} {...(openGuest ? { openGuest } : {})} />
      ) : null}
    </section>
  );
}
