import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight, Clapperboard, Diamond, Images, ListChecks, ListMusic, Play, Radio, Receipt, type LucideIcon } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { ServiceBand } from '@/app/_components/service-glance';
import { ServiceBuySheet } from '@/app/dashboard/[eventId]/_components/service-buy-sheet';
import { HearYourSong } from '@/app/_components/hear-your-song';
import { offerForDoor } from '@/lib/service-offers';
import type { ServiceDoor, ServiceRowGlance } from '@/lib/services-glance';
import type { ServiceMood } from '@/lib/service-glance';

/** Where each door goes — `href:` literals, so the port-controls scan sees each. */
function doorHref(kind: ServiceDoor['kind'], eventId: string): string {
  const doors: ReadonlyArray<{ kind: ServiceDoor['kind']; href: string }> = [
    { kind: 'shortlist', href: `/dashboard/${eventId}/vendors` },
    { kind: 'controller', href: `/panood/control/${eventId}` },
    /* The recording is collected in the controller (its "Recordings" card). */
    { kind: 'recording', href: `/panood/control/${eventId}` },
    { kind: 'hear', href: `/dashboard/${eventId}/studio/pakanta#song` },
    { kind: 'brief', href: `/dashboard/${eventId}/studio/pakanta#brief` },
    { kind: 'booth', href: `/dashboard/${eventId}/studio/patiktok/booth` },
    { kind: 'reels', href: `/dashboard/${eventId}/studio/patiktok#renders` },
    { kind: 'maker', href: `/dashboard/${eventId}/launch` },
    { kind: 'order', href: `/dashboard/${eventId}/orders` },
  ];
  return doors.find((d) => d.kind === kind)?.href ?? `/dashboard/${eventId}`;
}

const DOOR_ICON: Partial<Record<ServiceDoor['kind'], LucideIcon>> = {
  shortlist: ListChecks,
  controller: Radio,
  recording: Play,
  brief: ListMusic,
  booth: Clapperboard,
  reels: Images,
  maker: Diamond,
  order: Receipt,
};

function Door({ eventId, row, door, price, main, buyOpen, buyError }: {
  eventId: string;
  row: ServiceRowGlance['key'];
  door: ServiceDoor;
  price: number | null;
  main: boolean;
  buyOpen: boolean;
  buyError: string | null;
}) {
  if (door.kind === 'add' || door.kind === 'more-screen' || door.kind === 'more-song') {
    return (
      <ServiceBuySheet
        eventId={eventId}
        kind={offerForDoor(row, door.kind)}
        price={price}
        label={door.label}
        tone="brand"
        main={main}
        wide
        defaultOpen={buyOpen}
        error={buyError}
      />
    );
  }
  if (door.kind === 'hear') return <HearYourSong eventId={eventId} href={doorHref('hear', eventId)} main={main} wide />;
  const Icon = DOOR_ICON[door.kind] ?? ChevronRight;
  return (
    <ActionButton
      tone={main ? 'brand' : 'neutral'}
      main={main}
      className="w-full justify-center"
      icon={<Icon aria-hidden="true" strokeWidth={1.9} />}
      label={door.label}
      href={doorHref(door.kind, eventId)}
    />
  );
}

/**
 * ✅ EACH SERVICE PAGE OPENS WITH ONE BAND (owner "approve all", 2026-10-14 —
 * services prototype `renderPage()`), from the same glance Home's row reads
 * (`lib/services-glance.ts`): the big count — or a word, never a clock — · what
 * it is · the status line · the page's ONE main button · the second door. Not
 * added: the price is the big thing and "Add for ₱…" the main button, which
 * opens the one Add sheet (mint → /pay).
 *
 * 🔒 In the iPhone app nothing here sells (`storeShell`): buy doors are not drawn.
 */
export function ServicePageBand({
  eventId,
  glance,
  label,
  name,
  brand,
  storeShell = false,
  buyError = null,
  addButton = null,
  hideSecond = false,
}: {
  eventId: string;
  glance: ServiceRowGlance;
  label: string;
  /** The plain name (first) and the Setnayan name (small, under) — drawn on screen. */
  name: string;
  brand?: string;
  storeShell?: boolean;
  /** `?buy_error=` — a refused purchase: the sheet opens on it, said in words. */
  buyError?: string | null;
  /**
   * The page's own Add, when it carries more than the sheet can (Live Watch's plan
   * sheet: its four pre-purchase facts and the YouTube box, pinned on that page).
   * It still mints then /pay. Used only while the band's main door is Add.
   */
  addButton?: ReactNode;
  /** The second door lives in its own section on this page (with what it must say). */
  hideSecond?: boolean;
}) {
  const b = glance.band;
  const sells = (d: ServiceDoor | null) => d !== null && !(storeShell && (d.kind === 'add' || d.kind === 'more-screen' || d.kind === 'more-song'));
  const priceFor = (d: ServiceDoor) => (d.kind === 'add' ? glance.price : glance.morePrice);
  const main = b.main && sells(b.main) ? b.main : null;
  const second = !hideSecond && b.second && sells(b.second) ? b.second : null;
  const mainNode =
    main && main.kind === 'add' && addButton ? (
      addButton
    ) : main ? (
      <Door eventId={eventId} row={glance.key} door={main} price={priceFor(main)} main buyOpen={Boolean(buyError) && main.kind === 'add'} buyError={buyError} />
    ) : null;
  return (
    <ServiceBand
      big={b.big}
      bigWord={b.bigWord}
      word={[b.word, b.of].filter(Boolean).join(' · ') || null}
      mood={glance.mood}
      line={b.line}
      label={label}
      name={name}
      brand={brand}
      marker={{ 'data-service-band': glance.key, 'data-ownership': glance.ownership }}
      main={mainNode}
      second={second ? <Door eventId={eventId} row={glance.key} door={second} price={priceFor(second)} main={false} buyOpen={Boolean(buyError) && second.kind !== 'add' && !main} buyError={buyError} /> : null}
    />
  );
}

/* ─── The sections under the band ──────────────────────────────────────────── */

/**
 * ✅ A SECTION (prototype `sect`): a round icon · its title · one short line
 * (≤ 6 words) · an optional control at the end · its rows under it. Not added:
 * drawn dim, so the couple sees what it gives before paying.
 */
export function ServiceSection({
  icon,
  title,
  sub,
  end,
  children,
  dim = false,
  id,
}: {
  icon: ReactNode;
  title: string;
  sub: string;
  end?: ReactNode;
  children?: ReactNode;
  dim?: boolean;
  id?: string;
}) {
  return (
    <section className="ss-sect" data-dim={dim ? '' : undefined} id={id} aria-label={title}>
      <div className="ss-h">
        <span className="ss-ico" aria-hidden>
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <b className="block">{title}</b>
          <span className="ss-s">{sub}</span>
        </span>
        {end ? <span className="ss-end">{end}</span> : null}
      </div>
      {children ? <div className="ss-under">{children}</div> : null}
    </section>
  );
}

/** A status chip — icon + colour + one or two words, never colour alone. */
export function ServiceChip({ mood, words }: { mood: ServiceMood | 'off'; words: string }) {
  return (
    <span className="ss-chip" data-mood={mood}>
      <span className="ss-chip-dot" aria-hidden />
      <span>{words}</span>
    </span>
  );
}

/** A row inside a section — a door (≥ 44 px, the chevron says "tap me"), its state a chip. */
export function ServiceListRow({ who, mood, words, href }: { who: string; mood: ServiceMood | 'off'; words: string; href: string }) {
  return (
    <Link href={href} className="ss-row">
      <span className="ss-who">{who}</span>
      <ServiceChip mood={mood} words={words} />
      <ChevronRight aria-hidden className="ss-chev" strokeWidth={1.9} />
    </Link>
  );
}

/** A quiet text door at the end of a section ("Open", "Change"). */
export function ServiceQuietLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="ss-quiet">
      {label}
      <ChevronDown aria-hidden className="h-4 w-4 -rotate-90" strokeWidth={1.9} />
    </Link>
  );
}
