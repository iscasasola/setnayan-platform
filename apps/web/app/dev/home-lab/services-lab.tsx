/**
 * /dev/home-lab — the SERVICES half (owner "approve all", 2026-10-14 — the
 * services prototype `prototypes/services_home_rows_and_bands_2026-10-14_fable.html`).
 * DEV-ONLY, no database: the REAL glances, the REAL Home rows, the REAL bands and
 * the REAL section components, on the prototype's own sample (Maria & Jose,
 * Saturday, 19 December, 66 days out) and its own state names:
 *
 *   ?ai=none|bought|on|after   ?live=none|bought|on|live|after
 *   ?music=none|bought|on|after   ?booth=none|bought|on|after   ?hub=none|on
 *   &pending=ai,live,…   bought, waiting for payment
 *   &app=1               the iPhone store shell (owned only)
 *   &view=svc&page=ai|live|music|booth|hub   that service's page: band + sections
 */
import {
  boothGlance,
  hubProGlance,
  liveGlance,
  musicGlance,
  plannerGlance,
  type ServiceDay,
  type ServiceOwnership,
  type ServiceRowGlance,
} from '@/lib/services-glance';
import { SERVICE_NAMES } from '@/lib/service-names';
import { HUB_PRO_NAMES } from '@/lib/services-glance';
import { ServicePageBand } from '@/app/dashboard/[eventId]/studio/_components/service-page-band';
import { PlannerSections } from '@/app/dashboard/[eventId]/studio/setnayan-ai/_components/planner-sections';
import { MusicSections } from '@/app/dashboard/[eventId]/studio/pakanta/_components/music-sections';
import { BoothSections } from '@/app/dashboard/[eventId]/studio/patiktok/_components/booth-sections';
import { LiveSections } from '@/app/dashboard/[eventId]/studio/live-studio-control/_components/live-sections';
import { HubProSections } from '@/app/dashboard/[eventId]/studio/website-pro/_components/hub-pro-sections';

export type ServicesLabQuery = {
  ai?: string;
  live?: string;
  music?: string;
  booth?: string;
  hub?: string;
  pending?: string;
  app?: string;
  page?: string;
};

/** The prototype's sample prices (its `PRICE`, the live catalog read 2026-10-14). */
const PRICE = { ai: 2499, live: 2500, liveDay: 3000, music: 2500, booth: 1500, hub: 5000 };
const DAY_WORDS = 'Saturday, 19 December';

export function servicesLabActive(q: ServicesLabQuery): boolean {
  return Boolean(q.ai || q.live || q.music || q.booth || q.hub || q.page);
}

/** The prototype's defaults: Planner, Live stream, Music, Hub Pro owned; the booth not. */
function states(q: ServicesLabQuery) {
  return {
    ai: q.ai ?? 'on',
    live: q.live ?? 'on',
    music: q.music ?? 'on',
    booth: q.booth ?? 'none',
    hub: q.hub ?? 'on',
  };
}

/** The prototype's `phase()`: any "after" → after; live now or the booth on → the day. */
function dayOf(st: ReturnType<typeof states>): ServiceDay {
  if (Object.values(st).includes('after')) return 'after';
  if (st.live === 'live' || st.booth === 'on') return 'day';
  return 'before';
}

export function servicesLabRows(q: ServicesLabQuery): ServiceRowGlance[] {
  const st = states(q);
  const day = dayOf(st);
  const pending = new Set((q.pending ?? '').split(',').filter(Boolean));
  const own = (k: keyof typeof st): ServiceOwnership => (pending.has(k) ? 'waiting' : st[k] === 'none' ? 'none' : 'on');
  return [
    plannerGlance({
      ownership: own('ai'),
      price: PRICE.ai,
      day,
      suppliers: st.ai === 'bought' ? 0 : 7,
      finalBills: 3,
      paymentsDue30d: 2,
    }),
    liveGlance({
      ownership: own('live'),
      price: PRICE.live,
      screenPrice: PRICE.liveDay,
      day,
      cameras: st.live === 'bought' ? 0 : 3,
      live: st.live === 'live',
      liveSince: '2026-12-19T07:02:00Z',
      recorded: st.live === 'after',
      recordedMinutes: st.live === 'after' ? 134 : null,
      dayWords: DAY_WORDS,
    }),
    musicGlance({
      ownership: own('music'),
      price: PRICE.music,
      day,
      offered: true,
      song: st.music === 'on' || st.music === 'after' ? 'ready' : 'in_production',
      playing: true,
    }),
    boothGlance({
      ownership: own('booth'),
      price: PRICE.booth,
      day,
      reels: st.booth === 'bought' ? 0 : 23,
      dayWords: DAY_WORDS,
    }),
    hubProGlance({ ownership: own('hub'), price: PRICE.hub, theme: 'Vintage', background: 'video background' }),
  ];
}

/** The day the lab's states put the event on — for Home's Next card. */
export function servicesLabDay(q: ServicesLabQuery): ServiceDay {
  return dayOf(states(q));
}

const at = (iso: string) => new Date(`${iso}T12:00:00+08:00`);

/** One service's page — the REAL band and the REAL sections, on the sample. */
export function ServicesLabPage({ q, eventId }: { q: ServicesLabQuery; eventId: string }) {
  const rows = servicesLabRows(q);
  const st = states(q);
  const key = (['ai', 'live', 'music', 'booth', 'hub'] as const).find((k) => k === q.page) ?? 'ai';
  const g = rows.find((r) => r.key === key)!;
  const on = g.ownership === 'on';
  const names =
    key === 'ai'
      ? SERVICE_NAMES['setnayan-ai']
      : key === 'live'
        ? SERVICE_NAMES['live-studio']
        : key === 'music'
          ? SERVICE_NAMES['music-maker']
          : key === 'booth'
            ? SERVICE_NAMES.patiktok
            : HUB_PRO_NAMES;
  return (
    <div data-services-lab-page={key}>
      <ServicePageBand eventId={eventId} glance={g} label={`Your ${names.plain}`} name={names.plain} brand={names.brand} storeShell={q.app === '1'} />
      {key === 'ai' ? (
        <PlannerSections
          eventId={eventId}
          on={on}
          manual={false}
          shortlist={
            st.ai === 'bought'
              ? []
              : [
                  { vendor_id: 'v1', vendor_name: 'San Agustin', category: 'venue' as never, status: 'contracted' },
                  { vendor_id: 'v2', vendor_name: 'Hizon’s', category: 'catering' as never, status: 'quoted' },
                  { vendor_id: 'v3', vendor_name: 'Studio Lumen', category: 'photographer' as never, status: 'saved', lock_request_state: 'pending' },
                ]
          }
          payments={
            st.ai === 'bought'
              ? []
              : [
                  { id: 'p1', title: 'Caterer', subtitle: '50% deposit', date: at('2026-10-30') },
                  { id: 'p2', title: 'Venue', subtitle: 'balance', date: at('2026-12-04') },
                ]
          }
          deadlines={
            st.ai === 'bought' || st.ai === 'after'
              ? []
              : [
                  { id: 'd1', label: 'Final guest count', daysOut: 37, when: 'in 37 days' },
                  { id: 'd2', label: 'Seating chart to venue', daysOut: 51, when: 'in 51 days' },
                  { id: 'd3', label: 'Rings and attire fitted', daysOut: 59, when: 'in 59 days' },
                ]
          }
        />
      ) : key === 'live' ? (
        <LiveSections
          on={on}
          cameras={st.live === 'bought' ? 0 : on ? 3 : null}
          recorded={st.live === 'after'}
          recordedLength={st.live === 'after' ? '2 hr 14 min' : null}
          controllerHref={`/panood/control/${eventId}`}
          channelName={on ? 'Maria & Jose' : null}
          hostedChannel={false}
          linked={on}
        />
      ) : key === 'music' ? (
        <MusicSections
          eventId={eventId}
          added={on}
          owned={on}
          songReady={st.music === 'on' || st.music === 'after'}
          songFilename="Ulan sa Baguio.m4a"
          songPreviewUrl={null}
          adopted
          briefWords={on ? 'Ballad · Bibo & Honey' : ''}
          hasBrief={on}
        />
      ) : key === 'booth' ? (
        <BoothSections added={on} reels={on ? (st.booth === 'bought' ? 0 : 23) : null} tiktokConnected={false} tiktokHandle={null} tiktokAvailable={false} />
      ) : (
        <HubProSections eventId={eventId} on={on} theme={on ? 'Vintage' : null} background={on ? 'video background' : null} />
      )}
    </div>
  );
}
