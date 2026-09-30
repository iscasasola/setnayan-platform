import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import type { HomeNext, HomeNextKind, HomeService, HomeServiceKey } from '@/lib/home-first-screen';

/**
 * Where each Next card goes. Written as `href:` literals ON PURPOSE: the
 * port-controls scan (`scripts/port-controls.mjs` HREF_RE) only sees an
 * `href`/`href:` followed by a literal, so a `switch` returning strings made
 * the guided flow's door read as "lost".
 */
function nextHref(kind: HomeNextKind, eventId: string): string {
  const doors: ReadonlyArray<{ kind: HomeNextKind; href: string }> = [
    { kind: 'guide', href: `/dashboard/${eventId}/launch?tool=details&guide=1` },
    { kind: 'date', href: `/dashboard/${eventId}/date-selection` },
    { kind: 'papic', href: `/dashboard/${eventId}/studio/papic` },
    { kind: 'ai', href: `/dashboard/${eventId}/studio/setnayan-ai` },
    { kind: 'plan', href: '#home-all' },
  ];
  return doors.find((d) => d.kind === kind)?.href ?? '#home-all';
}

/** Where each service in the "Your services" row goes — `href:` literals, for the same scan. */
function serviceHref(key: HomeServiceKey, eventId: string): string {
  const doors: ReadonlyArray<{ key: HomeServiceKey; href: string }> = [
    { key: 'papic', href: `/dashboard/${eventId}/studio/papic` },
    { key: 'ai', href: `/dashboard/${eventId}/studio/setnayan-ai` },
  ];
  return doors.find((d) => d.key === key)?.href ?? `/dashboard/${eventId}`;
}

/**
 * 📱 THE HOME'S FIRST SCREEN — owner-APPROVED 2026-10-01 ("THE SIMPLE PHONE APP
 * — APPROVED", frame 1 "Home"). A server component, and deliberately nothing
 * else: every figure arrives already read and already worded
 * (`lib/home-first-screen.ts`), so this file adds no client weight and no read.
 *
 *   ONE Next card (one button) → Edit your Event Hub (always) → days to go ·
 *   coming · no reply → Paid / Still owing → Your services (Papic · Setnayan
 *   AI, owner 2026-10-01) → "See all" (the rest of Home).
 *
 * 🔒 ON A PHONE IT FILLS THE SCREEN, so nothing else sits above the fold: the
 * wrapper is at least one screen tall minus the top bar and the measured dock
 * (`--sn-bottomdock-h`), with "See all" at its foot. From `lg` up the height
 * is released — desktop shows the same things first, then more below.
 *
 * ⚠ `money === null` means the viewer may not see the budget (a delegate
 * without budget access): the line is ABSENT, not "—". A money read that
 * failed arrives as the string "—" and is drawn.
 */
export type HomeFirstScreenProps = {
  eventId: string;
  cover: { eyebrow: string; name: string };
  next: HomeNext;
  days: { value: string; label: string };
  coming: string;
  noReply: string;
  /** True when the no-reply figure is a measured number above zero. */
  noReplyWaiting: boolean;
  money: { paid: string; owing: string } | null;
  /** Papic · Setnayan AI with their status — already filtered (store shell, the Next card). */
  services: HomeService[];
};

export function HomeFirstScreen({
  eventId,
  cover,
  next,
  days,
  coming,
  noReply,
  noReplyWaiting,
  money,
  services,
}: HomeFirstScreenProps) {
  return (
    <section
      data-home-first-screen
      aria-label="Home"
      className="mx-auto flex w-full max-w-xl flex-col gap-3 max-lg:min-h-[calc(100svh-var(--sn-bottomdock-h,5.5rem)-5rem)]"
    >
      <div className="rounded-2xl bg-mulberry px-4 py-3 text-cream">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-cream/75">{cover.eyebrow}</p>
        <p className="font-display text-[22px] leading-tight">{cover.name}</p>
      </div>

      {/* ① THE ONE NEXT CARD — exactly one, with exactly one button. */}
      <div data-home-next={next.kind} className="sn-glass-bare rounded-2xl p-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-terracotta-700">Next</p>
        <h2 className="mt-1 font-display text-[24px] leading-tight text-ink">{next.title}</h2>
        <p className="mt-1 text-sm text-ink/65">{next.body}</p>
        <Link
          href={nextHref(next.kind, eventId)}
          className="sn-press mt-3 flex w-full items-center justify-center rounded-full bg-ink px-5 py-3.5 text-[15px] font-semibold text-cream transition hover:bg-ink/90"
        >
          {next.action}
        </Link>
      </div>

      {/* ② ALWAYS THERE — the Maker's front door (it left the bar, owner 2026-10-01).
          No "Recommended" badge: owner, 2026-10-01 — the button is always there. */}
      <Link
        href={`/dashboard/${eventId}/launch`}
        data-home-edit-hub
        className="sn-press flex w-full items-center justify-center rounded-full border border-ink/80 bg-transparent px-5 py-3.5 font-display text-[17px] text-ink transition hover:bg-ink/5"
      >
        Edit your Event Hub
      </Link>

      {/* ③ THREE NUMBERS — "—" when unread, never 0. */}
      <div className="grid grid-cols-3 gap-2" data-home-numbers>
        <div className="sn-glass-bare rounded-xl px-2 py-3 text-center">
          <p className="font-display text-[26px] leading-none text-ink">{days.value}</p>
          <p className="mt-1 text-[11.5px] text-ink/55">{days.label}</p>
        </div>
        <div className="sn-glass-bare rounded-xl px-2 py-3 text-center">
          <p className="font-display text-[26px] leading-none text-ink">{coming}</p>
          <p className="mt-1 text-[11.5px] text-ink/55">coming</p>
        </div>
        <div className="sn-glass-bare rounded-xl px-2 py-3 text-center">
          <p className={`font-display text-[26px] leading-none ${noReplyWaiting ? 'text-terracotta-700' : 'text-ink'}`}>{noReply}</p>
          <p className="mt-1 text-[11.5px] text-ink/55">no reply</p>
        </div>
      </div>

      {money ? (
        <Link
          href={`/dashboard/${eventId}/budget`}
          data-home-money
          className="sn-glass-bare flex items-end justify-between rounded-xl px-4 py-3"
        >
          <span className="text-[12.5px] text-ink/60">
            Paid
            <span className="block font-display text-[20px] text-ink">{money.paid}</span>
          </span>
          <span className="text-right text-[12.5px] text-ink/60">
            Still owing
            <span className="block font-display text-[20px] text-terracotta-700">{money.owing}</span>
          </span>
        </Link>
      ) : null}

      {/* ④ YOUR SERVICES — compact, one line each; never the one that is Next. */}
      {services.length > 0 ? (
        <nav aria-label="Your services" data-home-services className="flex flex-col gap-1">
          <p className="px-1 font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink/50">Your services</p>
          <div className="grid grid-cols-2 gap-2">
            {services.map((svc) => (
              <Link
                key={svc.key}
                href={serviceHref(svc.key, eventId)}
                data-home-service={svc.key}
                className="sn-glass-bare sn-press flex min-w-0 flex-col rounded-xl px-3 py-2.5"
              >
                <span className="truncate text-[14px] font-semibold text-ink">{svc.name}</span>
                <span className="truncate text-[12px] text-ink/60">{svc.status}</span>
              </Link>
            ))}
          </div>
        </nav>
      ) : null}

      <a
        href="#home-all"
        className="mt-auto inline-flex items-center justify-center gap-1 self-center py-2 text-[13px] font-medium text-ink/55 hover:text-ink lg:hidden"
      >
        See all
        <ChevronDown aria-hidden className="h-4 w-4" strokeWidth={2} />
      </a>
    </section>
  );
}
