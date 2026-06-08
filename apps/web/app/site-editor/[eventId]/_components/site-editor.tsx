'use client';

import Link from 'next/link';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import {
  Aperture,
  ArrowUpRight,
  CalendarCheck,
  CalendarClock,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Cloud,
  Copy,
  Download,
  Eye,
  Film,
  Heart,
  ImagePlus,
  Images,
  LayoutGrid,
  Link2,
  List,
  Lock,
  MailCheck,
  MonitorPlay,
  Music,
  Newspaper,
  PartyPopper,
  Pencil,
  QrCode,
  Settings,
  Share2,
  Shirt,
  Sparkles,
  Star,
  Tv,
  Users,
  Video,
  Wand2,
  X,
} from 'lucide-react';
import { findSku, formatCentavosPhp } from '@/lib/sku-catalog';

/**
 * Site Editor — full-screen, Reels-style wedding-website editor.
 *
 * WHY this is a top-level route (`/site-editor/[eventId]`) and not a child of
 * the dashboard layout: Next.js nested layouts COMPOSE — a child route cannot
 * strip its parent's sidebar / bottom-nav chrome. The owner's spec (CLAUDE.md
 * 2026-05-31, "Reels-style editor") requires a full-screen takeover that
 * leaves all dashboard nav behind, with a ✕ top-left to return — exactly the
 * Facebook Reels pattern. The only clean way to escape `EventLayout`'s chrome
 * is to live OUTSIDE its route subtree. The root layout (app/layout.tsx) still
 * wraps this route.
 *
 * LIGHT-LOCKED (owner 2026-06-04 "just always keep it light theme"): the editor
 * uses the legacy Clean-Editorial Tailwind classes (bg-cream / text-ink /
 * text-terracotta / bg-mulberry / bg-surface), which now always render light —
 * the app dropped the Light/Dark/Auto switch, so the in-editor Theme card was
 * removed. The guest-facing landing page (/[slug]) stays mood-board-styled per
 * the 0010/0002 lock — that's why the live preview iframe renders the couple's
 * palette, not the dashboard chrome.
 *
 * LAYOUT: mobile = column (preview on top ~44vh, tab nav pinned to the
 * bottom, swipe carousel above it). Desktop = row (preview on the left,
 * tab nav on top of the right panel, carousel below). Responsive via Tailwind
 * `lg:` — no device toggle (that was a review-only prototype affordance).
 *
 * PR #1 (foundation) scope: the Reels shell + QR display + every other tool
 * card deep-linking to its existing editor surface. Preview shows the live
 * site; making it jump to the RSVP / Event sections is the PR #2 follow-up
 * (the public /[slug] page
 * needs section targeting, which it does not have yet). Editorial = honest
 * coming-soon (Phase 4 not built).
 */

/**
 * The two widget upgrades (iteration 0004). Each shows its catalog price plus
 * either an "Active" badge once owned, or an honest "Coming soon" pill — their
 * standalone purchase flow is a V1.1 deferral (no /add-ons checkout page exists
 * for them yet; the old /orders/new hand-off was retired and would dead-end).
 * Every other service (Panood / Papic / Patiktok / Custom QR / Drive) is a
 * NAVIGATION card into its `/add-ons/<key>` page, which owns its own pricing +
 * buy state — the locked website wiring rule (see journey.tsx docstring · V2.1
 * Amendment #3).
 */
const MONOGRAM_HERO_SKU = 'monogram_hero_upgrade';
const LIVE_SCHEDULE_SKU = 'pro_widget_schedule';

type Tab = 'settings' | 'rsvp' | 'event' | 'editorial';

const TAB_TITLE: Record<Tab, string> = {
  settings: 'Settings',
  rsvp: 'RSVP',
  event: 'Event',
  editorial: 'Editorial',
};

export type SiteEditorProps = {
  eventId: string;
  slug: string | null;
  publicLandingUrl: string | null;
  slugDisplay: string | null;
  masterQrSvg: string | null;
  stats: { attending: number; pending: number; declined: number };
  /** Non-cancelled orders for the two inline Pro SKUs — drives owned-state. */
  ownedOrders: { service_key: string | null; status: string }[];
};

export function SiteEditor(props: SiteEditorProps) {
  const { eventId, publicLandingUrl } = props;
  const [tab, setTab] = useState<Tab>('settings');

  // ✕ closes the full-screen editor back to the event dashboard home. (It used
  // to return to the /website journey scroll, but that page now redirects to
  // this editor — flipped 2026-06-03 — so home is the correct close target.)
  const backHref = `/dashboard/${eventId}`;

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-cream text-ink transition-colors lg:flex-row">
      {/* ── LIVE PREVIEW ── */}
      <div className="relative shrink-0 basis-[44%] overflow-hidden border-b border-ink/10 lg:basis-0 lg:grow-[1.45] lg:border-b-0 lg:border-r">
        <Link
          href={backHref}
          aria-label="Close editor and return to your dashboard"
          className="absolute left-3 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-ink/40 text-cream backdrop-blur-sm transition hover:bg-ink/60"
        >
          <X aria-hidden className="h-5 w-5" strokeWidth={2} />
        </Link>
        <span className="absolute right-3 top-4 z-30 flex items-center gap-1.5 rounded-full bg-ink/40 px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.16em] text-cream backdrop-blur-sm">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" />
          Live preview
        </span>

        {tab === 'editorial' ? (
          <PreviewSoon />
        ) : publicLandingUrl ? (
          <iframe
            title="Live preview of your wedding website"
            src={publicLandingUrl}
            className="pointer-events-none h-full w-full border-0 bg-white"
            sandbox="allow-scripts allow-same-origin"
            loading="lazy"
          />
        ) : (
          <PreviewNoSlug eventId={eventId} />
        )}
      </div>

      {/* ── PANEL (tab nav + carousel) ── */}
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Editor area — order-first on mobile (above the bottom tab bar),
            order-last on desktop (below the top tab bar). */}
        <div className="order-1 flex min-h-0 flex-1 flex-col lg:order-2">
          <div className="flex items-baseline justify-between px-4 pb-1 pt-3">
            <span className="font-serif text-xl italic">{TAB_TITLE[tab]}</span>
            <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink/40">
              Swipe →
            </span>
          </div>
          {tab === 'settings' && <Carousel cards={settingsCards(props)} />}
          {tab === 'rsvp' && <Carousel cards={rsvpCards(props)} />}
          {tab === 'event' && <Carousel cards={eventCards(props)} />}
          {tab === 'editorial' && <Carousel cards={editorialCards()} />}
        </div>

        {/* Tab nav — bottom on mobile, top on desktop. */}
        <nav className="order-2 grid shrink-0 grid-cols-4 border-t border-ink/10 bg-surface lg:order-1 lg:border-b lg:border-t-0">
          <TabButton active={tab === 'settings'} onClick={() => setTab('settings')} label="Settings" icon={<Settings aria-hidden />} />
          <TabButton active={tab === 'rsvp'} onClick={() => setTab('rsvp')} label="RSVP" icon={<MailCheck aria-hidden />} />
          <TabButton active={tab === 'event'} onClick={() => setTab('event')} label="Event" icon={<PartyPopper aria-hidden />} />
          <TabButton active={tab === 'editorial'} onClick={() => setTab('editorial')} label="Editorial" icon={<Newspaper aria-hidden />} />
        </nav>
      </div>
    </div>
  );
}

/* ─────────────────────────── tab nav ─────────────────────────── */

function TabButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-h-[56px] min-h-[44pt] flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-semibold transition-colors [&_svg]:h-[22px] [&_svg]:w-[22px] ${
        active ? 'text-terracotta' : 'text-ink/40'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

/* ─────────────────────────── carousel ─────────────────────────── */

function Carousel({ cards }: { cards: ReactNode[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const onScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const center = track.scrollLeft + track.clientWidth / 2;
    let best = Number.POSITIVE_INFINITY;
    let idx = 0;
    Array.from(track.children).forEach((child, i) => {
      const el = child as HTMLElement;
      const cc = el.offsetLeft + el.clientWidth / 2;
      const d = Math.abs(cc - center);
      if (d < best) {
        best = d;
        idx = i;
      }
    });
    setActive(idx);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="flex flex-1 gap-3 overflow-x-auto overflow-y-hidden px-4 pb-1 pt-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
      >
        {cards.map((card, i) => (
          <div
            key={i}
            className="shrink-0 basis-[84%] overflow-y-auto lg:basis-[330px]"
            style={{ scrollSnapAlign: 'center' }}
          >
            {card}
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-1.5 py-2.5">
        {cards.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i === active ? 'w-4 bg-terracotta' : 'w-1.5 bg-ink/20'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────── card shell ─────────────────────────── */

function Card({
  icon,
  title,
  sub,
  children,
  soon = false,
}: {
  icon: ReactNode;
  title: string;
  sub: string;
  children: ReactNode;
  soon?: boolean;
}) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-ink/10 bg-surface p-4">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md [&_svg]:h-5 [&_svg]:w-5 ${
            soon ? 'bg-ink/10 text-ink/40' : 'bg-terracotta/15 text-terracotta'
          }`}
        >
          {icon}
        </span>
        <span className="text-base font-semibold leading-tight">
          {title}
          <small className="mt-0.5 block text-xs font-medium text-ink/55">{sub}</small>
        </span>
      </div>
      {children}
    </div>
  );
}

/* CTA — deep-links a card to its existing editor surface (full nav out). */
function CardLink({
  href,
  children,
  ghost = false,
  external = false,
  download,
}: {
  href: string;
  children: ReactNode;
  ghost?: boolean;
  external?: boolean;
  download?: string;
}) {
  const base =
    'inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition [&_svg]:h-4 [&_svg]:w-4';
  const skin = ghost
    ? 'border border-ink/20 text-ink hover:bg-ink/5'
    : 'bg-mulberry text-cream hover:bg-mulberry-600';
  if (external || download) {
    return (
      <a
        href={href}
        download={download}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className={`${base} ${skin}`}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={`${base} ${skin}`}>
      {children}
    </Link>
  );
}

function Desc({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-relaxed text-ink/55">{children}</p>;
}

function StatRow({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-ink/10 px-3 py-2">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-terracotta/15 text-terracotta [&_svg]:h-5 [&_svg]:w-5">
        {icon}
      </span>
      <span className="flex-1 text-base font-semibold">{label}</span>
      <span className="text-base font-bold text-terracotta">{value}</span>
    </div>
  );
}

/* Inline Pro upgrade card — catalog price + owned-state. These two widget
   upgrades (monogram_hero_upgrade · pro_widget_schedule) have NO standalone
   add-on checkout page in V1 — the Pro-tier purchase flow is a deliberate V1.1
   deferral (see website/widgets/page.tsx docstring). So the unowned state shows
   an honest "Coming soon" pill rather than a dead-end /orders/new CTA (which
   bounces to /add-ons and drops the ?service= param). Owned-state still reads a
   real order row, so any comped/legacy owner keeps the "Active" badge. */
function ProCard({
  icon,
  title,
  sub,
  desc,
  skuKey,
  fallbackPrice,
  owned,
}: {
  icon: ReactNode;
  title: string;
  sub: string;
  desc: string;
  skuKey: string;
  fallbackPrice: string;
  owned: boolean;
}) {
  const sku = findSku(skuKey);
  const price = sku ? formatCentavosPhp(sku.priceCentavos) : fallbackPrice;
  return (
    <Card icon={icon} title={title} sub={sub}>
      <Desc>{desc}</Desc>
      <div className="mt-0.5 flex items-baseline justify-between gap-2">
        <span className="text-xl font-semibold tracking-tight">{price}</span>
        <span className="text-xs text-ink/55">one-time, this event</span>
      </div>
      {owned ? (
        <p className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-emerald-300/70 bg-emerald-50 py-2 text-sm font-semibold text-emerald-800 [&_svg]:h-4 [&_svg]:w-4 dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-300">
          <CheckCircle2 aria-hidden /> Active on this event
        </p>
      ) : (
        <span className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-ink/15 bg-ink/5 py-2 text-sm font-semibold text-ink/50 [&_svg]:h-4 [&_svg]:w-4">
          <Sparkles aria-hidden /> Coming soon
        </span>
      )}
    </Card>
  );
}

/* ─────────────────────────── SETTINGS cards ─────────────────────────── */

function settingsCards(p: SiteEditorProps): ReactNode[] {
  return [
    <Card key="url" icon={<Link2 />} title="Subdomain name" sub="Your public wedding URL">
      {p.slugDisplay ? (
        <>
          <div className="flex items-center justify-between gap-2 rounded-lg border border-ink/10 bg-cream px-3 py-2.5">
            <span className="truncate font-mono text-[12px] text-ink/70">{p.slugDisplay}</span>
            {p.publicLandingUrl && <CopyUrl url={p.publicLandingUrl} />}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 aria-hidden className="h-4 w-4" /> Live — this URL is yours.
          </div>
          <CardLink href={`/dashboard/${p.eventId}/invitation`} ghost>
            <Pencil aria-hidden /> Manage URL
          </CardLink>
        </>
      ) : (
        <>
          <Desc>Pick your wedding URL — it&rsquo;s how guests find your page and what your QR points to.</Desc>
          <CardLink href={`/dashboard/${p.eventId}/invitation`}>
            <Pencil aria-hidden /> Set your URL
          </CardLink>
        </>
      )}
    </Card>,
    <Card key="qr" icon={<QrCode />} title="QR code" sub="With your monogram in the center">
      {p.masterQrSvg && p.slug ? (
        <>
          <div
            className="mx-auto flex h-[108px] w-[108px] items-center justify-center rounded-xl border border-ink/10 bg-white p-2 [&_svg]:h-full [&_svg]:w-full"
            // QR is a trusted server-rendered SVG from renderEventLandingQrSvg.
            dangerouslySetInnerHTML={{ __html: p.masterQrSvg }}
          />
          <CardLink href={`/api/website/qr/${p.slug}`} download={`${p.slug}-wedding-qr.png`}>
            <Download aria-hidden /> Download PNG
          </CardLink>
          {p.publicLandingUrl && <ShareUrl url={p.publicLandingUrl} />}
        </>
      ) : (
        <Desc>Set your wedding URL first — your QR code is generated from it.</Desc>
      )}
    </Card>,
    <Card key="drive" icon={<Cloud />} title="Keep your photos" sub="Sync to Google Drive">
      <Desc>Connect Google Drive so every photo from your day lands in your own folder — yours to keep.</Desc>
      <CardLink href={`/dashboard/${p.eventId}/add-ons/photo-delivery`} ghost>
        <Cloud aria-hidden /> Set up Drive sync
      </CardLink>
    </Card>,
    <Card key="guest-qr" icon={<QrCode />} title="Custom QR per guest" sub="A personal QR for everyone">
      <Desc>Give each guest a personal QR, dressed in your monogram and colors, that opens their own invitation.</Desc>
      <CardLink href={`/dashboard/${p.eventId}/add-ons/custom-qr-guest`} ghost>
        <QrCode aria-hidden /> Set up guest QRs
      </CardLink>
    </Card>,
  ];
}

/* ─────────────────────────── RSVP cards ─────────────────────────── */

function rsvpCards(p: SiteEditorProps): ReactNode[] {
  const pendingNote =
    p.stats.pending > 0
      ? `${p.stats.pending} still to hear from`
      : 'Everyone has responded';
  return [
    <Card key="manage" icon={<Users />} title="Manage RSVPs" sub={pendingNote}>
      <StatRow icon={<Check />} label="Attending" value={p.stats.attending} />
      <StatRow icon={<Clock />} label="Pending" value={p.stats.pending} />
      <StatRow icon={<X />} label="Declined" value={p.stats.declined} />
      <CardLink href={`/dashboard/${p.eventId}/guests`} ghost>
        <List aria-hidden /> Open guest list
      </CardLink>
    </Card>,
    <Card key="view" icon={<Lock />} title="Who can view" sub="Control your page's reach">
      <Desc>
        Choose who reaches your page — anyone with the link, or only invited guests. Changes take effect right
        away.
      </Desc>
      <CardLink href={`/dashboard/${p.eventId}/website/privacy`} ghost>
        <Lock aria-hidden /> Manage visibility
      </CardLink>
    </Card>,
    <Card key="deadline" icon={<CalendarCheck />} title="RSVP deadline" sub="When the form closes">
      <Desc>Set the date your RSVP form stops accepting responses, and toggle +1s and meal choices.</Desc>
      <CardLink href={`/dashboard/${p.eventId}/guests?rsvp=pending`} ghost>
        <CalendarCheck aria-hidden /> Manage RSVP settings
      </CardLink>
    </Card>,
  ];
}

/* ─────────────────────────── EVENT cards ─────────────────────────── */

function eventCards(p: SiteEditorProps): ReactNode[] {
  const ownsMonogramHero = p.ownedOrders.some((o) => o.service_key === MONOGRAM_HERO_SKU);
  const ownsLiveSchedule = p.ownedOrders.some((o) => o.service_key === LIVE_SCHEDULE_SKU);
  return [
    /* ── Before the day — your page's content ── */
    <Card key="branding" icon={<Pencil />} title="Branding" sub="Monogram & names">
      <Desc>Your monogram and how your names appear across your invitation and live page.</Desc>
      <CardLink href={`/dashboard/${p.eventId}/invitation`} ghost>
        <Pencil aria-hidden /> Open invitation editor
      </CardLink>
    </Card>,
    <Card key="hero" icon={<ImagePlus />} title="Hero photo" sub="Full-bleed banner">
      <Desc>The first thing guests see — a full-width photo behind your monogram.</Desc>
      <CardLink href={`/dashboard/${p.eventId}/website/hero-photo`} ghost>
        <ImagePlus aria-hidden /> Edit hero photo
      </CardLink>
    </Card>,
    <Card key="chrome" icon={<Music />} title="Music & video hero" sub="Page soundtrack & motion">
      <Desc>Add a looping background song (guests tap to play — never forced) and a short video behind your monogram instead of a still photo.</Desc>
      <CardLink href={`/dashboard/${p.eventId}/website/site-chrome`} ghost>
        <Music aria-hidden /> Edit music & video
      </CardLink>
    </Card>,
    <ProCard
      key="monogram-hero"
      icon={<Wand2 />}
      title="Monogram Hero"
      sub="Animated monogram · Pro"
      desc="Your monogram draws itself in on page load, over your own video or photo background."
      skuKey={MONOGRAM_HERO_SKU}
      fallbackPrice="₱1,999"
      owned={ownsMonogramHero}
    />,
    <Card key="moments" icon={<Camera />} title="Photo moments" sub="Set the guest vibe">
      <Desc>Tell guests how you&rsquo;d like the day captured — cameras welcome, phones down, or paparazzo only.</Desc>
      <CardLink href={`/dashboard/${p.eventId}/website/photo-moments`} ghost>
        <Camera aria-hidden /> Edit photo moments
      </CardLink>
    </Card>,
    <Card key="dress" icon={<Shirt />} title="Dress code" sub="Palette & guidance">
      <Desc>A headline and a palette so guests know exactly what to wear.</Desc>
      <CardLink href={`/dashboard/${p.eventId}/website/dress-code`} ghost>
        <Shirt aria-hidden /> Edit dress code
      </CardLink>
    </Card>,
    <Card key="widgets" icon={<LayoutGrid />} title="Widgets" sub="Show, hide & reorder">
      <Desc>Turn page sections on or off — countdown, our story, venue map and more.</Desc>
      <CardLink href={`/dashboard/${p.eventId}/website/widgets`} ghost>
        <LayoutGrid aria-hidden /> Customize widgets
      </CardLink>
    </Card>,
    <Card key="std" icon={<Video />} title="Save-the-Date video" sub="From the template gallery">
      <Desc>Pick a template; we render a short save-the-date from your photos.</Desc>
      <CardLink href={`/dashboard/${p.eventId}/add-ons/save-the-date`} ghost>
        <ArrowUpRight aria-hidden /> Browse templates
      </CardLink>
    </Card>,
    /* ── On the day — what goes live while guests celebrate. Each service is a
       navigation card into its /add-ons/<key> page, which owns its pricing +
       buy state (the locked website wiring rule). ── */
    ...(p.publicLandingUrl
      ? [
          <Card key="dayof" icon={<Eye />} title="Preview day-of mode" sub="See what guests see on the day">
            <Desc>Your live page from one hour before to eight hours after — exactly as guests see it.</Desc>
            <CardLink href={`${p.publicLandingUrl}?preview=day_of`} external ghost>
              <ArrowUpRight aria-hidden /> Open day-of preview
            </CardLink>
          </Card>,
        ]
      : []),
    <Card key="panood" icon={<Tv />} title="Live stream — Panood" sub="Broadcast your ceremony">
      <Desc>Broadcast your ceremony to the guests who can&rsquo;t be there in person.</Desc>
      <CardLink href={`/dashboard/${p.eventId}/add-ons/panood`} ghost>
        <ArrowUpRight aria-hidden /> Set up Panood
      </CardLink>
    </Card>,
    <ProCard
      key="live-schedule"
      icon={<CalendarClock />}
      title="Live Schedule"
      sub="Happening-now highlight · Pro"
      desc="Light up the 'happening now' moment on your schedule and auto-scroll it for guests."
      skuKey={LIVE_SCHEDULE_SKU}
      fallbackPrice="₱999"
      owned={ownsLiveSchedule}
    />,
    <Card key="papic" icon={<Aperture />} title="Candid capture — Papic" sub="Guest cameras & paparazzo seats">
      <Desc>Turn your guests&rsquo; phones into a shared candid camera, and add dedicated seats for the shooters you pick.</Desc>
      <CardLink href={`/dashboard/${p.eventId}/add-ons/papic`} ghost>
        <ArrowUpRight aria-hidden /> Set up Papic
      </CardLink>
    </Card>,
    <Card key="patiktok" icon={<Film />} title="Patiktok booth" sub="A vertical-reel booth">
      <Desc>A vertical-reel booth your guests can play with during the celebration.</Desc>
      <CardLink href={`/dashboard/${p.eventId}/add-ons/patiktok`} ghost>
        <ArrowUpRight aria-hidden /> Set up Patiktok
      </CardLink>
    </Card>,
    <Card key="photowall" icon={<MonitorPlay />} title="Live photo wall" sub="Guest photos on the venue screen" soon>
      <Desc>Guest photos appear on the venue screen as they&rsquo;re taken.</Desc>
      <span className="self-start rounded-full border border-ink/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-ink/40">
        Coming soon
      </span>
    </Card>,
  ];
}

/* ─────────────────────────── EDITORIAL cards (coming soon) ─────────────────────────── */

function editorialCards(): ReactNode[] {
  const items: { icon: ReactNode; title: string; sub: string; desc: string }[] = [
    { icon: <Newspaper />, title: 'Create editorial', sub: 'Your wedding, as a story', desc: 'A magazine-style page of your day, right on your site.' },
    { icon: <Star />, title: 'Collect reviews', sub: 'From guests & vendors', desc: 'Invite everyone who celebrated to leave a note.' },
    { icon: <Images />, title: 'Pick photos', sub: 'Curate the gallery', desc: 'Choose the album your guests get to keep.' },
    { icon: <Heart />, title: 'Thank-you video', sub: 'A note to everyone', desc: 'A short thank-you to all who shared the day.' },
  ];
  return items.map((it) => (
    <Card key={it.title} icon={it.icon} title={it.title} sub={it.sub} soon>
      <Desc>{it.desc}</Desc>
      <span className="self-start rounded-full border border-ink/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-ink/40">
        Coming soon
      </span>
    </Card>
  ));
}

/* ─────────────────────────── preview placeholders ─────────────────────────── */

function PreviewSoon() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2.5 px-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-terracotta/15 text-terracotta [&_svg]:h-6 [&_svg]:w-6">
        <Newspaper aria-hidden />
      </span>
      <p className="font-serif text-2xl italic">Your story, after the day</p>
      <p className="max-w-[280px] text-[12px] leading-relaxed text-ink/55">
        Your wedding editorial appears here once the celebration is over. Coming soon.
      </p>
    </div>
  );
}

function PreviewNoSlug({ eventId }: { eventId: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-terracotta/15 text-terracotta [&_svg]:h-6 [&_svg]:w-6">
        <Link2 aria-hidden />
      </span>
      <p className="font-serif text-2xl italic">Set your URL to preview</p>
      <p className="max-w-[280px] text-[12px] leading-relaxed text-ink/55">
        Once you pick your wedding URL in Settings, your live page shows up right here.
      </p>
      <Link
        href={`/dashboard/${eventId}/invitation`}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-mulberry px-5 text-sm font-semibold text-cream transition hover:bg-mulberry-600"
      >
        <Pencil aria-hidden className="h-4 w-4" /> Set your URL
      </Link>
    </div>
  );
}

/* ─────────────────────────── clipboard helpers ─────────────────────────── */

function CopyUrl({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={copied ? 'Copied' : 'Copy URL'}
      onClick={() => {
        navigator.clipboard?.writeText(url).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        });
      }}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink/55 transition hover:bg-ink/5 [&_svg]:h-5 [&_svg]:w-5"
    >
      {copied ? <Check aria-hidden className="text-emerald-600" /> : <Copy aria-hidden />}
    </button>
  );
}

function ShareUrl({ url }: { url: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        if (navigator.share) {
          void navigator.share({ url }).catch(() => {});
        } else {
          void navigator.clipboard?.writeText(url);
        }
      }}
      className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-ink/20 py-2 text-sm font-semibold text-ink transition hover:bg-ink/5 [&_svg]:h-4 [&_svg]:w-4"
    >
      <Share2 aria-hidden /> Share
    </button>
  );
}
