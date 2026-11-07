/**
 * /dev/inquire-lab — the shop page's Inquire pop-up (owner 2026-11-07: "a pop up to first ask what service/s … then
 * connect them to which event … and send inquire"). No sign-in, no database. DEV-ONLY: production builds 404 this
 * route first thing.
 *
 * The pop-up is the REAL `InquireSheet`; only its send is a stand-in (`lab-sheet.tsx`), which prints what the shop page
 * would hand `startServiceInquiry`. The shop body around it is a marked stand-in with the page's own Inquire links
 * (`<a href="#get-in-touch">`), which the pop-up catches exactly as it does on the shop page.
 *
 *   ?services=3|0       a shop with three cards, or none at all (the general question)
 *   ?services=provided  services picked at sign-up, no card (Rondo Musical today: band_dj, band_live_music)
 *   ?services=mixed     two cards + services picked at sign-up; the one a card already carries is not listed twice
 *   &events=2|1|0       the couple's events (0 = only "Start a new event")
 *   &signed=1|0         signed in, or signed out (the sign-in sheet first)
 *   &inquire=1&isvc=…   the return from sign-in / a new event — the pop-up reopens on the event step
 */
import { notFound } from 'next/navigation';
import { Send } from 'lucide-react';
import { Wordmark } from '@/app/_components/brand-marks';
import { inquireServiceList, NO_SERVICES_LINE } from '@/lib/shop-inquire';
import { LabInquireSheet } from './lab-sheet';

const SERVICES = [
  { serviceId: 'svc-photo', label: 'Wedding photography', price: 'from ₱45,000', category: 'photography' },
  { serviceId: 'svc-video', label: 'Same-day edit video', price: 'from ₱38,000', category: 'videography' },
  { serviceId: 'svc-drone', label: 'Drone coverage', price: '', category: 'videography' },
];
/**
 * FIXTURE NAMES for the lab's taxonomy keys. The shop page names them through `cardKindLabeller` (the live Admin ›
 * Categories taxonomy); a lab has no database, so these stand in for what it would answer. Never imported by the app.
 */
const LAB_TAXONOMY_NAMES: Record<string, string> = {
  band_dj: 'Band / DJ',
  band_live_music: 'Live band',
  pabati: 'Pabati',
  day_of_coordinator: 'Day-of coordinator',
};
const labLabel = (key: string) => LAB_TAXONOMY_NAMES[key] ?? key;
const PROVIDED_ONLY = ['band_dj', 'band_live_music'];
const MIXED_PROVIDED = ['videography', 'pabati', 'day_of_coordinator'];
const EVENTS = [
  { eventId: '00000000-0000-4000-8000-0000000000e1', label: 'Claire & Ice · Feb 14, 2027' },
  { eventId: '00000000-0000-4000-8000-0000000000e2', label: "Lola's 80th · Jun 6, 2027" },
];

export default async function InquireLabPage({
  searchParams,
}: {
  searchParams: Promise<{ services?: string; events?: string; signed?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const services =
    sp.services === '0'
      ? []
      : sp.services === 'provided'
        ? inquireServiceList([], PROVIDED_ONLY, labLabel)
        : sp.services === 'mixed'
          ? inquireServiceList(SERVICES.slice(0, 2), MIXED_PROVIDED, labLabel)
          : SERVICES;
  const cardCount = services.filter((s) => !('provided' in s && s.provided)).length;
  const events = EVENTS.slice(0, sp.events === '0' ? 0 : sp.events === '1' ? 1 : 2);
  const signedIn = sp.signed !== '0';
  const name = sp.services === 'provided' ? 'Rondo Musical (lab)' : 'SetnaProd (lab)';

  return (
    <main className="min-h-dvh bg-cream pb-16" data-inquire-lab="">
      <header className="flex items-center justify-between border-b border-ink/10 px-4 py-3">
        <Wordmark />
        <span className="text-[11px] uppercase tracking-[0.2em] text-ink/45">lab · stand-in shop</span>
      </header>
      <section className="px-4 pt-6">
        <h1 className="text-2xl font-semibold text-ink">{name}</h1>
        <p className="mt-1 text-sm text-ink/60">
          {cardCount} active card{cardCount === 1 ? '' : 's'} · {services.length - cardCount} provided · {signedIn ? `signed in · ${events.length} event${events.length === 1 ? '' : 's'}` : 'signed out'}
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-4">
          <a href="#get-in-touch" className="button-primary inline-flex items-center gap-2" data-lab-inquire="">
            <Send className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Inquire
          </a>
        </div>
      </section>
      <section id="get-in-touch" className="mt-10 space-y-3 px-4">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">Inquire</h2>
        <p className="max-w-2xl text-sm text-ink/65">
          {services.length === 0 ? NO_SERVICES_LINE(name) : 'Pick the services, then the event — one send.'}
        </p>
      </section>
      <LabInquireSheet services={services} events={events} signedIn={signedIn} name={name} />
    </main>
  );
}
