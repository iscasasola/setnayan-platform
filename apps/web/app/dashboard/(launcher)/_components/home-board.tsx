import Link from 'next/link';
import {
  AlertCircle,
  CalendarRange,
  Shield,
  Sparkles,
  Store,
  type LucideIcon,
} from 'lucide-react';

import { CountUp } from '@/app/_components/count-up';

/**
 * HomeBoard — the launcher's status row: one tile per surface the user actually
 * has, each showing a REAL count and the one line that explains it.
 *
 * ── WHY (owner, 2026-07-30) ─────────────────────────────────────────────────
 * The hero previously spent a line on plain text — "2 events in motion · 68
 * things need you" — which states the numbers without offering anywhere to go
 * with them. The owner asked for a home "easy to navigate that even a new
 * person will understand", with "a place for their shop with a bit of
 * information and a place for the admin with a bit of information that can help
 * us navigate faster and know if we need to visit our shop/admin."
 *
 * So each number becomes a door with its own context line.
 *
 * ── REAL DATA ONLY ──────────────────────────────────────────────────────────
 * Every value here is passed in from an aggregate the page already computes for
 * the Watch tile (`needsTotal`, `active.length`, `adminOpenTotal`, the per-shop
 * attention counts). This component derives NO counts of its own and invents
 * none: a tile whose count cannot be established is simply not rendered, never
 * rendered as zero-with-a-flourish. An empty state that lies is worse than a
 * missing tile.
 *
 * ── CAPABILITY-GATED, like the Spaces section ───────────────────────────────
 * The shop and HQ tiles render only when the user genuinely holds that access
 * (`roles.hasVendorAccess` / `roles.hasAdminAccess`). A plain couple sees two
 * tiles, not five with three dead ones — same rule the Spaces cards follow, so
 * the board can never grow a door to nothing.
 *
 * ── ORDER ───────────────────────────────────────────────────────────────────
 * Tiles that NEED something sort first, because on a phone this row scrolls
 * horizontally and an off-screen tile that is waiting on the user is the one
 * failure this component must not have. Desktop shows them all at once, so the
 * same order simply reads as priority.
 */

export type HomeBoardTile = {
  key: string;
  href: string;
  icon: LucideIcon;
  /** Small caps label above the number. */
  label: string;
  /** The real count. */
  /**
   * THREE STATES, because two would force a lie:
   *   number → show it
   *   null   → we ASKED and the read FAILED ⇒ say so, never a numeral
   *
   * 🔴 THIS WAS `number` AND THE DOCBLOCK ABOVE ALREADY FORBADE WHAT THAT
   * ALLOWED — "a tile whose count cannot be established is simply not
   * rendered, never rendered as zero-with-a-flourish. An empty state that
   * lies is worse than a missing tile." The rule was stated and the TYPE made
   * it unsayable, so `adminOpenTotal = 0` in a catch block reached the screen
   * as a confident zero and the board said "Everything — quiet. Nothing needs
   * you right now" over a read that had failed. The same file's own
   * `alagaCount`/`connectionCount` were already using null for exactly this.
   */
  value: number | null;
  /** Unit shown next to the number ("in motion", "need you", …). */
  unit: string;
  /** One line of context under it. Omitted when there is nothing true to say. */
  sub?: string;
  /** TRUE = something is waiting on the user; sorts first and reads warmer. */
  needs?: boolean;
  /** TRUE = the obsidian focal tile (Alaala), matching the bento's dark card. */
  dark?: boolean;
  /** TRUE = render the sub-line only; a zero here means "nothing yet", not "0". */
  hideValueWhenZero?: boolean;
};

export function buildHomeBoardTiles(input: {
  activeCount: number;
  needsTotal: number;
  nextEventLabel: string | null;
  topWatchName: string | null;
  hasVendorAccess: boolean;
  shopNeedsTotal: number;
  shopCount: number;
  topShopName: string | null;
  hasAdminAccess: boolean;
  /** null ⇒ the queue digest read FAILED. Never collapse it to 0 — see the
   *  note on `value`. */
  adminOpenTotal: number | null;
  finishedCount: number;
}): HomeBoardTile[] {
  const tiles: HomeBoardTile[] = [];

  // "Needs you" only exists when something actually does. Zero here is not a
  // state worth a tile — it is the absence of the tile.
  if (input.needsTotal > 0) {
    tiles.push({
      key: 'needs',
      href: input.topWatchName ? '#events' : '#events',
      icon: AlertCircle,
      label: 'Needs you',
      value: input.needsTotal,
      unit: input.needsTotal === 1 ? 'thing' : 'things',
      sub:
        input.topWatchName && input.activeCount > 1
          ? `Across ${input.activeCount} events · most on ${input.topWatchName}`
          : (input.topWatchName ?? undefined),
      needs: true,
    });
  }

  if (input.activeCount > 0) {
    tiles.push({
      key: 'events',
      href: '#events',
      icon: CalendarRange,
      label: 'Events',
      value: input.activeCount,
      unit: 'in motion',
      sub: input.nextEventLabel ?? undefined,
    });
  }

  // Alaala — the memory dimension.
  //
  // 🔴 THE SUBTITLE USED TO READ "Your moments gather here as events finish",
  // AND IT WAS FALSE ON THE OWNER'S OWN SCREEN (2026-08-13). He had 14 photos
  // and clips kept in Alaala and ZERO finished events — two weddings in
  // December, and a "Movie Night" with no date at all, so `finishedCount` was
  // 0. The tile told him his memories had not arrived while the wall further
  // down the SAME PAGE was holding fourteen of them. He asked why.
  //
  // 🔑 A CLAIM ABOUT MEMORIES MADE FROM A COUNT OF EVENTS. Identical shape to
  // "No events attended yet" printed from an absence of PHOTOS, fixed the same
  // day — and it survived that sweep because it lives in a summary tile rather
  // than in Alaala itself. Alaala keeps photographs; whether a party has ended
  // says nothing about whether anything is kept.
  //
  // The subtitle is now a description of the DESTINATION, true on day one and
  // true at year six, and it never conditions on an event count. The original
  // reasoning below still holds and is why no media total is quoted here:
  // moment/media totals live behind AlaalaTile's own fetch, and a second copy
  // here would be a drifting source of the same number. `finishedCount` stays
  // as the tile's VALUE — it is an honest count of celebrations, labelled as
  // one, and hidden entirely at zero rather than shown as a hollow "0".
  tiles.push({
    key: 'alaala',
    href: '/dashboard/library',
    icon: Sparkles,
    label: 'Alaala',
    value: input.finishedCount,
    unit: 'celebrated',
    sub: 'Every photo and clip you keep',
    dark: true,
    hideValueWhenZero: true,
  });

  if (input.hasVendorAccess) {
    tiles.push({
      key: 'shop',
      href: '/vendor-dashboard',
      icon: Store,
      label: input.shopCount > 1 ? 'Your shops' : 'Your shop',
      value: input.shopNeedsTotal,
      unit: input.shopNeedsTotal === 1 ? 'needs a reply' : 'need a reply',
      sub: input.topShopName ?? undefined,
      needs: input.shopNeedsTotal > 0,
    });
  }

  if (input.hasAdminAccess) {
    tiles.push({
      key: 'hq',
      href: '/admin',
      icon: Shield,
      label: 'Admin HQ',
      value: input.adminOpenTotal,
      unit: 'to review',
      sub: 'Payments · verifications · disputes',
      /* An UNMEASURED queue is not a clear one. `null` sorts with the tiles
         that want attention, because "we could not check" is a reason to look,
         not a reason to relax. */
      needs: input.adminOpenTotal === null || input.adminOpenTotal > 0,
    });
  }

  // Waiting-first. A stable sort keeps the canonical order within each group.
  return [
    ...tiles.filter((t) => t.needs),
    ...tiles.filter((t) => !t.needs),
  ];
}

export function HomeBoard({ tiles }: { tiles: HomeBoardTile[] }) {
  if (tiles.length === 0) return null;
  return (
    <div
      className="sn-reveal mb-6 sm:mb-8"
      style={{ animationDelay: '0.28s' }}
      role="group"
      aria-label="Your surfaces"
    >
      {/* Phone: one horizontal scroller so five tiles never stack into a wall.
          Desktop: a grid that shows every tile at once. */}
      <div className="-mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.key}
              href={t.href}
              className={`sn-lift-2 flex min-w-[62vw] snap-start flex-col gap-1.5 rounded-2xl px-4 py-3.5 sm:min-w-0 ${
                t.dark
                  ? 'border border-ink/25 bg-ink text-white shadow-[0_20px_45px_-30px_rgba(30,26,18,0.9)]'
                  : t.needs
                    ? 'sn-tile-glass border-[color:var(--sn-gold-300)] bg-[color:var(--sn-gold-100)]/70'
                    : 'sn-tile-glass'
              }`}
            >
              <span
                className={`flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.11em] ${
                  t.dark
                    ? 'text-white/70'
                    : 'text-[color:var(--sn-ink-500)]'
                }`}
              >
                <Icon
                  aria-hidden
                  className={`h-3.5 w-3.5 ${
                    t.dark ? 'text-white/70' : 'text-[color:var(--sn-gold-700)]'
                  }`}
                  strokeWidth={2}
                />
                {t.label}
              </span>
              {t.value === null ? (
                /* NOT a blank. A tile with no numeral reads as calm, which is
                   the same harm one notch quieter — say that we could not
                   read it. Same words the rail uses for the same state. */
                <span className="text-sm italic text-ink/45">couldn&rsquo;t load</span>
              ) : t.hideValueWhenZero && t.value === 0 ? null : (
              <span className="flex items-baseline gap-1.5">
                <span
                  className={`font-mono text-[1.6rem] font-bold leading-none tracking-[-0.02em] ${
                    t.dark ? 'text-white' : 'text-ink'
                  }`}
                >
                  <CountUp value={t.value} delayMs={700} />
                </span>
                <span
                  className={`text-[11.5px] ${
                    t.dark ? 'text-white/60' : 'text-[color:var(--sn-ink-500)]'
                  }`}
                >
                  {t.unit}
                </span>
              </span>
              )}
              {t.sub ? (
                <span
                  className={`truncate text-[11.5px] ${
                    t.dark ? 'text-white/55' : 'text-[color:var(--sn-ink-400)]'
                  }`}
                >
                  {t.sub}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
