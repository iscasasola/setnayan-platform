import Link from 'next/link';
import {
  Palette,
  LayoutGrid,
  Users,
  Star,
  CalendarClock,
  Wallet,
  FileText,
  Mail,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { makeT, type Locale, type TranslationKey } from '@/lib/i18n';

/**
 * YOUR PLAN section · owner directive 2026-05-22.
 *
 * Verbatim: *"and for the plan is more of the backend like mood board,
 * seta plan. Documents would be both contracts and papers the couple
 * needs, monogram, and other things that are needed for the plan?"*
 *
 * Sits below PlanningGroups (vendor grid · "what the host books") and
 * above NavGrid on event Home. Surfaces the tools the host BUILDS
 * personally — mood board, seat plan, guest list, sponsors, schedule,
 * budget, documents, save-the-date, monogram. Each card carries a live
 * status sub-line so the host sees progress at a glance.
 *
 * Coordinated with sibling 22-card-vendor-grid PR (PR #345 + later):
 * sibling touches wedding-plan-groups.ts + planning-groups.tsx; this
 * component is a new file with no overlap.
 *
 * Documents card routes to the new consolidated /documents page (this
 * PR ships both together).
 */

type ToolKey =
  | 'mood_board'
  | 'seat_plan'
  | 'guest_list'
  | 'sponsors'
  | 'schedule'
  | 'budget'
  | 'documents'
  | 'save_the_date'
  | 'monogram';

type ToolTile = {
  key: ToolKey;
  Icon: LucideIcon;
  labelKey: TranslationKey;
  subtitle: string;
  href: string;
};

export type YourPlanSectionStats = {
  /** Saved palettes / mood-board pins for this event. */
  moodBoardSaveCount: number;
  /** Total guests on this event. */
  totalGuests: number;
  /** Guests with a row in event_seat_assignments. */
  seatedGuests: number;
  /** Confirmed (attending) guest count. */
  attendingGuests: number;
  /** Guests pending RSVP. */
  pendingGuests: number;
  /** Total sponsor rows (any tier · any invitation_status). */
  sponsorCount: number;
  /** Accepted sponsor rows (invitation_status = 'accepted'). */
  acceptedSponsorCount: number;
  /** Schedule blocks on event_schedule_blocks for this event. */
  scheduleBlockCount: number;
  /** Whether the host has set events.estimated_budget_centavos. */
  hasBudgetTarget: boolean;
  /** Government paperwork rows in-progress (status != 'received' or 'expired'). */
  paperworkInProgressCount: number;
  /** Visible contracts on this event (non-draft). */
  contractCount: number;
  /** Save-the-Date video render orders (paid OR pending). */
  hasSaveTheDateOrder: boolean;
  /** Bespoke Monogram / Monogram Hero upgrade orders (paid OR pending). */
  hasMonogramOrder: boolean;
};

export type YourPlanSectionProps = {
  eventId: string;
  stats: YourPlanSectionStats;
  /** Server-resolved locale per /lib/i18n. */
  locale: Locale;
};

/**
 * Polite empty-state-aware subtitles per tool. Brand voice — no dev
 * text, no engineering jargon. The "CTA"-shaped subtitles route to the
 * tool when the host hasn't started; status counters take over once
 * they have.
 */
function subtitleFor(key: ToolKey, stats: YourPlanSectionStats): string {
  switch (key) {
    case 'mood_board':
      if (stats.moodBoardSaveCount > 0) {
        return `${stats.moodBoardSaveCount} saved ${
          stats.moodBoardSaveCount === 1 ? 'palette' : 'palettes'
        }`;
      }
      return 'Start your board';
    case 'seat_plan':
      if (stats.totalGuests > 0) {
        return `${stats.seatedGuests} of ${stats.totalGuests} seated`;
      }
      return 'Plan your tables';
    case 'guest_list':
      if (stats.totalGuests > 0) {
        return `${stats.attendingGuests} of ${stats.totalGuests} confirmed`;
      }
      return 'Add your first guest';
    case 'sponsors':
      if (stats.sponsorCount > 0) {
        return `${stats.acceptedSponsorCount} of ${stats.sponsorCount} accepted`;
      }
      return 'Invite your sponsors';
    case 'schedule':
      if (stats.scheduleBlockCount > 0) {
        return `${stats.scheduleBlockCount} ${
          stats.scheduleBlockCount === 1 ? 'block' : 'blocks'
        } scheduled`;
      }
      return 'Build your day-of';
    case 'budget':
      if (stats.hasBudgetTarget) return 'Track your spending';
      return 'Set your budget';
    case 'documents': {
      const total = stats.paperworkInProgressCount + stats.contractCount;
      if (total > 0) {
        return `${total} in progress`;
      }
      return 'Government, vendors, receipts';
    }
    case 'save_the_date':
      if (stats.hasSaveTheDateOrder) return 'Saved to your event';
      return 'Draft yours';
    case 'monogram':
      if (stats.hasMonogramOrder) return 'Saved to your event';
      return 'Generate yours';
  }
}

export function YourPlanSection({
  eventId,
  stats,
  locale,
}: YourPlanSectionProps) {
  const tr = makeT(locale);

  const tiles: ToolTile[] = [
    {
      key: 'mood_board',
      Icon: Palette,
      labelKey: 'tool.mood_board',
      subtitle: subtitleFor('mood_board', stats),
      href: `/dashboard/${eventId}/add-ons/mood-board`,
    },
    {
      key: 'seat_plan',
      Icon: LayoutGrid,
      labelKey: 'tool.seat_plan',
      subtitle: subtitleFor('seat_plan', stats),
      href: `/dashboard/${eventId}/seating`,
    },
    {
      key: 'guest_list',
      Icon: Users,
      labelKey: 'tool.guest_list',
      subtitle: subtitleFor('guest_list', stats),
      href: `/dashboard/${eventId}/guests`,
    },
    {
      key: 'sponsors',
      Icon: Star,
      labelKey: 'tool.sponsors',
      subtitle: subtitleFor('sponsors', stats),
      href: `/dashboard/${eventId}/sponsors`,
    },
    {
      key: 'schedule',
      Icon: CalendarClock,
      labelKey: 'tool.schedule',
      subtitle: subtitleFor('schedule', stats),
      href: `/dashboard/${eventId}/schedule`,
    },
    {
      key: 'budget',
      Icon: Wallet,
      labelKey: 'tool.budget',
      subtitle: subtitleFor('budget', stats),
      href: `/dashboard/${eventId}/budget`,
    },
    {
      key: 'documents',
      Icon: FileText,
      labelKey: 'tool.documents',
      subtitle: subtitleFor('documents', stats),
      href: `/dashboard/${eventId}/documents`,
    },
    {
      key: 'save_the_date',
      Icon: Mail,
      labelKey: 'tool.save_the_date',
      subtitle: subtitleFor('save_the_date', stats),
      href: `/dashboard/${eventId}/add-ons/save-the-date`,
    },
    {
      key: 'monogram',
      Icon: Sparkles,
      labelKey: 'tool.monogram',
      subtitle: subtitleFor('monogram', stats),
      // The Monogram Maker shipped (iteration 0037) — link straight to the live
      // surface, not the retired `/add-ons/monogram-creator` "coming soon" stub.
      href: `/dashboard/${eventId}/monogram`,
    },
  ];

  return (
    <section aria-labelledby="your-plan-heading" className="space-y-3">
      <div className="space-y-1">
        <h2
          id="your-plan-heading"
          className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55"
        >
          {tr('section.your_plan')}
        </h2>
        <p className="text-xs text-ink/55">
          {tr('section.your_plan_tagline')}
        </p>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map((tile) => (
          <li key={tile.key}>
            <Tile {...tile} label={tr(tile.labelKey)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Tile({
  Icon,
  label,
  subtitle,
  href,
}: ToolTile & { label: string }) {
  return (
    <Link
      href={href}
      className="block h-full min-h-[96px] transition-colors hover:[&>div]:border-terracotta/40 hover:[&>div]:bg-terracotta/5"
    >
      <div className="flex h-full flex-col gap-2 rounded-xl border border-ink/10 bg-white p-3 sm:gap-3 sm:p-4">
        <span
          aria-hidden
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta sm:h-10 sm:w-10"
        >
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={1.75} />
        </span>
        <span className="text-sm font-semibold text-ink">{label}</span>
        <span className="text-[11px] text-ink/65 sm:text-xs">{subtitle}</span>
      </div>
    </Link>
  );
}
