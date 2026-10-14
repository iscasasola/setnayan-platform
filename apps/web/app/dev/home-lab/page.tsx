/**
 * /dev/home-lab — the phone Home's first screen (owner-APPROVED 2026-10-01,
 * "THE SIMPLE PHONE APP — APPROVED", frame 1) on fixture data: no sign-in, no
 * database. DEV-ONLY: production builds 404 this route, the same kill-switch as
 * `/dev/details-lab`. It draws the REAL `HomeFirstScreen` with the REAL picker
 * and glance formatters, so what it shows is what the Home shows.
 *
 *   ?next=guide|date|guests|invite|papic|ai|plan   which Next card (default: guide)
 *   ?unread=1 (or ?fail=1)           every read failed — said so, with ⟳ Reload (H3)
 *   ?hidden=1                        the budget is not shared with this viewer
 *   ?proto=1                         the prototype's own figures (Cale & Ice, 72 days, 7 coming…)
 *   ?store=1                         the App Store / Play shell (no Your services row)
 *   ?view=papic                      🎨 the Papic page's TOP BAND instead of Home, in the same
 *                                    ?papic= state (the real PapicTopBand; the Buy more sheet
 *                                    on the prototype's ladder seed — no database)
 *   ?view=early&early=1|0&shots=N    🖼 an invited guest's Invitation before the day with the host's
 *                                    "Let guests shoot now" on/off (owner 2026-10-14): the REAL
 *                                    resolver + bar (`resolveSiteNav`, `SiteMenuBar`) and the REAL
 *                                    "Your shots" (empty → "Take your first photo"; N sample shots)
 *   ?papic=before|on|low|stopped|empty|lowday  🎨 the approved prototype's states (owner
 *                                    2026-10-14): before the window · on · running low ·
 *                                    stopped (Next card) · no photos yet (Next card) · low on the day
 *   ?ai=…&live=…&music=…&booth=…&hub=…[&pending=…][&app=1][&view=svc&page=…]
 *                                    ✅ the five other services (owner "approve all" 2026-10-14,
 *                                    services prototype) — see ./services-lab.tsx
 */
import { notFound } from 'next/navigation';
import { HomeFirstScreen } from '@/app/dashboard/[eventId]/_components/home-first-screen';
import { HomeWhatsNext } from '@/app/dashboard/[eventId]/_components/home-parts';
import { getNavSlotMap } from '@/lib/nav-registry';
import { resolveSiteNav } from '@/app/[slug]/_lib/site-nav';
import { STAGE_BAR } from '@/app/[slug]/_lib/stage-bar';
import { SiteMenuBar } from '@/app/[slug]/_components/site-menu-bar';
import { YourShotsGallery } from '@/app/[slug]/_components/your-shots-gallery';
import { papicGlance, papicRowDoubled } from '@/lib/papic-glance';
import { resolveStoredWindow } from '@/lib/papic-window';
import { PapicTopBand } from '@/app/dashboard/[eventId]/studio/papic/_components/papic-top-band';
import { ServicesLabPage, servicesLabActive, servicesLabDay, servicesLabRows, type ServicesLabQuery } from './services-lab';
import {
  aiStatus,
  glanceCount,
  glanceDays,
  glanceMoney,
  homeServices,
  pickHomeNext,
  type HomeNextInput,
} from '@/lib/home-first-screen';

export const dynamic = 'force-dynamic';

/** Sample shots for the early-shots lab — the repo's own portraits, nothing real. */
const LAB_PHOTOS = ['isabel-mendoza.avif', 'andres-delgado.avif', 'isabella-reyes.avif', 'miguel-santos-garden.avif'];
const DONE_GUESTS = { total: 96, unsent: 0 };
const STATES: Record<string, HomeNextInput> = {
  guide: {
    guide: { done: 9, total: 20, stageTitle: 'Invitation', stageDone: 4, stageTotal: 8 },
    hasDate: true,
    guests: DONE_GUESTS,
    noun: 'wedding',
    papicReady: true,
    aiOffer: true,
  },
  date: { guide: null, hasDate: false, guests: DONE_GUESTS, noun: 'wedding', papicReady: false, aiOffer: true },
  guests: { guide: null, hasDate: true, guests: { total: 0, unsent: 0 }, noun: 'wedding', papicReady: true, aiOffer: true },
  invite: { guide: null, hasDate: true, guests: { total: 96, unsent: 58 }, noun: 'wedding', papicReady: true, aiOffer: true },
  papic: { guide: null, hasDate: true, guests: DONE_GUESTS, noun: 'wedding', papicReady: true, aiOffer: true },
  ai: { guide: null, hasDate: true, guests: DONE_GUESTS, noun: 'wedding', papicReady: false, aiOffer: true },
  plan: { guide: null, hasDate: true, guests: DONE_GUESTS, noun: 'wedding', papicReady: false, aiOffer: false },
};

export default async function HomeLab({
  searchParams,
}: {
  searchParams: Promise<{ proto?: string; next?: string; unread?: string; fail?: string; hidden?: string; store?: string; papic?: string; view?: string; early?: string; shots?: string; heard?: string } & ServicesLabQuery>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const q = await searchParams;
  const unread = q.unread === '1' || q.fail === '1';
  const proto = q.proto === '1';
  /* The prototype's own figures, for the side-by-side (prototypes/home_and_guests_2026-10-07_fable.html). */
  const F = proto
    ? { eyebrow: 'Wedding · Fri, Dec 18, 2026', name: 'Cale & Ice', days: 72, coming: 7, noReply: 2, paid: 0, owing: 1056000 }
    : { eyebrow: 'Wedding · March 13, 2027', name: 'Ana & Miguel', days: 163, coming: 96, noReply: 35, paid: 120000, owing: 45000 };
  const picked = proto
    ? { guide: null, hasDate: true, guests: { total: 14, unsent: 3 }, noun: 'wedding' as const, papicReady: false, aiOffer: false }
    : STATES[q.next ?? 'guide'] ?? STATES.guide!;
  const E = '00000000-0000-4000-8000-000000000000';
  /* 🎨 Papic's row and band — the REAL glance over the approved prototype's own sample
     (papic_easy_home_and_band_2026-10-14_fable.html: Maria & Jose, 2,000 credits bought),
     the REAL default window. `lowday` = running low ON the event day (owner call 1). */
  const papicState = q.papic ?? null;
  const dayMs = 86_400_000;
  const iso = (ms: number) => new Date(ms + 8 * 3_600_000).toISOString().slice(0, 10);
  const PAPIC: Record<string, { left: number; photos: number; days: number }> = {
    before: { left: 2000, photos: 0, days: 234 },
    on: { left: 1240, photos: 86, days: 66 },
    low: { left: 140, photos: 1860, days: 66 },
    stopped: { left: 0, photos: 2000, days: 66 },
    empty: { left: 2000, photos: 0, days: 66 },
    lowday: { left: 140, photos: 1860, days: 0 },
  };
  const ps = papicState ? PAPIC[papicState] ?? PAPIC.on! : null;
  const papicEventDate = iso(Date.now() + (ps?.days ?? 40) * dayMs);
  const papicWin = resolveStoredWindow({ windowStart: null, windowEnd: null, eventDate: papicEventDate });
  const papicNow = papicGlance({
    permitted: true,
    tile: unread
      ? 'failed'
      : ps
        ? { shotsLeft: ps.left, shotsTotal: 2000, photosGathered: ps.photos }
        : proto
          ? { shotsLeft: 50, shotsTotal: 50, photosGathered: 0 }
          : { shotsLeft: 1240, shotsTotal: 1500, photosGathered: 12 },
    window: { startDate: papicWin.startDate, endIso: papicWin.endIso },
    eventDate: papicEventDate,
    papicOn: true,
  });
  /* The prototype's ladder seed — for the lab's sheet only; the app reads the catalog. */
  const LAB_SIZES = [
    { serviceCode: 'LAB_100', points: 100, pricePhp: 70, discountPercent: 30 },
    { serviceCode: 'LAB_300', points: 300, pricePhp: 210, discountPercent: 30 },
    { serviceCode: 'LAB_500', points: 500, pricePhp: 350, discountPercent: 30 },
    { serviceCode: 'LAB_1000', points: 1000, pricePhp: 700, discountPercent: 30 },
    { serviceCode: 'LAB_3000', points: 3000, pricePhp: 1680, discountPercent: 44 },
  ];
  if (q.view === 'early') {
    const early = q.early !== '0';
    const n = Math.max(0, Number(q.shots ?? 0) || 0);
    const bar = resolveSiteNav({
      viewer: { kind: 'guest' },
      phase: 'before',
      stageSlots: STAGE_BAR.rsvp.slots,
      hostAllowsCamera: true,
      anyChapterPublic: false,
      hasStory: true,
      liveBroadcast: false,
      earlyOwnShots: early,
      destinations: { camera: '/papic/guest?from=lab' },
    });
    return (
      <div className="min-h-screen bg-cream px-4 pb-28 pt-3">
        <div className="mx-auto flex max-w-xl flex-col gap-6">
          <p className="sn-eye text-ink/70">Gallery · before the day</p>
          {early ? (
            <YourShotsGallery
              shots={{ shots: Array.from({ length: n }, (_, i) => ({ id: `lab-${i}`, url: '/portraits/' + LAB_PHOTOS[i % LAB_PHOTOS.length]!, capturedAt: null })), total: n }}
              qrToken={null}
              cameraOn
              everyoneHref={null}
              cameraHref="/papic/guest?from=lab"
            />
          ) : (
            <p className="text-sm text-ink/60">(Early shooting off — the bar keeps its four; there is no Gallery before the day.)</p>
          )}
        </div>
        <SiteMenuBar slots={bar} />
      </div>
    );
  }
  if (q.view === 'svc') {
    return (
      <div className="min-h-screen bg-cream px-4 pb-6 pt-3">
        <div className="mx-auto flex max-w-xl flex-col gap-7">
          <ServicesLabPage q={q} eventId={E} />
        </div>
      </div>
    );
  }
  if (q.view === 'papic') {
    return (
      <div className="min-h-screen bg-cream px-4 pb-6 pt-3">
        <div className="mx-auto flex max-w-xl flex-col gap-7">
          <PapicTopBand eventId={E} glance={papicNow} canBuy sizes={LAB_SIZES} />
        </div>
      </div>
    );
  }
  /* An unread guest list reaches the picker as `null` — exactly as the page hands it. */
  const base: HomeNextInput = ps
    ? {
        ...picked,
        guide: null,
        papicReady: false,
        papic: papicNow.moment && papicNow.count !== null && papicNow.total !== null
          ? { moment: papicNow.moment, left: papicNow.count, total: papicNow.total }
          : null,
      }
    : picked;
  /* ✅ The five services (services prototype): their rows, and their two Next-card moments. */
  const svcOn = servicesLabActive(q);
  const svcRows = svcOn ? servicesLabRows(q) : [];
  const svcStore = q.app === '1' || q.store === '1';
  const withMoments: HomeNextInput = svcOn
    ? {
        ...base,
        guide: null,
        guests: { total: 32, unsent: 12 },
        live: !svcStore && servicesLabDay(q) === 'day' && svcRows.some((r) => r.moment === 'live-now'),
        music: !svcStore && svcRows.some((r) => r.moment === 'song-ready'),
      }
    : base;
  const input: HomeNextInput = unread ? { ...withMoments, guide: null, guests: null } : withMoments;
  const next = pickHomeNext(input);
  const nextAfter = next.kind === 'music' ? pickHomeNext({ ...input, music: false }) : null;
  const slots = await getNavSlotMap().catch(() => null);
  return (
    <div className="min-h-screen bg-cream px-4 pb-6 pt-3">
      <HomeFirstScreen
        eventId={E}
        cover={svcOn ? { eyebrow: 'Wedding · Saturday, 19 December 2026', name: 'Maria & Jose' } : { eyebrow: F.eyebrow, name: F.name }}
        next={next}
        nextAfter={nextAfter}
        storeShell={svcStore}
        days={glanceDays(svcOn ? 66 : F.days)}
        coming={glanceCount(F.coming, !unread)}
        noReply={glanceCount(F.noReply, !unread)}
        noReplyWaiting={!unread}
        figures={{
          days: F.days,
          coming: unread ? null : F.coming,
          noReply: unread ? null : F.noReply,
          money: q.hidden === '1' ? null : unread ? 'unread' : { paid: F.paid, owing: F.owing },
        }}
        navSlots={slots}
        whatsNext={
          <HomeWhatsNext
            open={3}
            rows={[
              { id: 'b', title: 'Book a supplier', sub: 'Catering · 2 quotes in', href: `/dashboard/${E}/vendors`, verb: 'book', cta: 'Book' },
              { id: 'p', title: 'Settle a payment', sub: 'Seda Vertis North · first payment · by Oct 5', href: `/dashboard/${E}/vendors`, verb: 'pay', cta: 'Pay' },
              { id: 'r', title: 'Fill a role', sub: 'Emcee · nobody picked yet', href: `/dashboard/${E}/guests`, verb: 'role', cta: 'Pick' },
            ]}
            checklist={{ href: `/dashboard/${E}/checklist`, pct: 47 }}
          />
        }
        money={
          q.hidden === '1'
            ? null
            : { paid: glanceMoney(unread ? null : F.paid), owing: glanceMoney(unread ? null : F.owing) }
        }
        papicLeft={papicNow.count}
        papicSizes={LAB_SIZES}
        services={homeServices({
          next: next.kind,
          storeShell: svcStore,
          rows: svcRows,
          papic: papicNow.status,
          papicDoors: {
            glance: papicNow,
            line: papicNow.line,
            buy: papicNow.buy,
            whileNext: papicRowDoubled(next.kind === 'papic' ? next.papicMoment ?? null : null),
          },
          ai: aiStatus(unread ? null : false),
        })}
      />
    </div>
  );
}
