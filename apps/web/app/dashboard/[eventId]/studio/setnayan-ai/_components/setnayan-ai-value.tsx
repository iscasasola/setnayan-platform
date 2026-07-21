import {
  ListChecks,
  MapPin,
  Send,
  CalendarClock,
  BellRing,
  Wallet,
  PiggyBank,
  Eye,
  Sparkles,
  ShieldCheck,
  Clock,
} from 'lucide-react';
import {
  type AiActivity,
  figureRanked,
  figureDeadlines,
  figureNextMove,
  figurePayments,
} from '@/lib/setnayan-ai-activity';

/**
 * SetnayanAiValue — the "everything Setnayan AI is keeping for you" surface,
 * shared by the studio page's ACTIVE and BUY/PAUSED states.
 *
 *   • mode="live"    → the assistant is on for this event. Each capability is
 *     annotated with a REAL per-event figure (drawn from `activity`, which is
 *     the same cockpit + upcoming-items data the Overview reads). Leads with the
 *     live briefing ("You're 62% locked in, 3 decisions need you …").
 *   • mode="preview" → the pitch. The same honest capability list described as
 *     what the assistant WILL keep for you — no live numbers, no fabricated
 *     ones.
 *
 * Every row is a WIRED, running capability (owner "no fake doors"). Designed-
 * but-dormant guards (price-drop, availability-change, contract windows, the
 * consent-gated trend/inference insights) are deliberately absent — they have
 * no live data source yet (see setnayan-ai-snapshot.ts).
 */

type Capability = {
  icon: typeof ListChecks;
  title: string;
  body: string;
  /** Live per-event figure — omitted entirely in preview mode. */
  live?: (a: AiActivity) => string;
};

type CapabilityGroup = {
  heading: string;
  blurb: string;
  caps: Capability[];
};

const GROUPS: CapabilityGroup[] = [
  {
    heading: 'Finds the right people',
    blurb: 'Turns the whole vendor directory into a shortlist made for your day.',
    caps: [
      {
        icon: ListChecks,
        title: 'Ranks every vendor by how well they fit',
        body: 'Sorted by your date, budget, location, guest count, faith and reviews — each with a “% match”, not a generic A–Z list.',
        live: figureRanked,
      },
      {
        icon: MapPin,
        title: 'Sorts by distance to your reception',
        body: 'Nearer vendors rise to the top, so you’re not comparing a supplier three provinces away against one down the road.',
      },
      {
        icon: Send,
        title: 'Sends your first inquiry to the best fit',
        body: 'For each category it can draft and open the conversation with the strongest match, so you start with a reply — not a blank page.',
      },
    ],
  },
  {
    heading: 'Keeps it all moving',
    blurb: 'The quiet secretary that never loses the thread.',
    caps: [
      {
        icon: CalendarClock,
        title: 'Tracks every deadline for you',
        body: 'Recommended booking windows plus your PH marriage paperwork — license, Pre-Cana, PSA — counted down and surfaced before they bite.',
        live: figureDeadlines,
      },
      {
        icon: BellRing,
        title: 'Chases the vendors who go quiet',
        body: 'If someone you’ve messaged hasn’t replied, it notices and offers to send a polite nudge — so a stalled thread never becomes a lost date.',
      },
      {
        icon: Clock,
        title: 'Tells you the one thing to do next',
        body: 'Out of everything in flight, it names the single most-urgent move and how far you’ve come — no more staring at a to-do pile.',
        live: figureNextMove,
      },
    ],
  },
  {
    heading: 'Guards against costly slips',
    blurb: 'The part that is practically impossible to keep by hand.',
    caps: [
      {
        icon: Wallet,
        title: 'Flags a payment before it’s due',
        body: 'Every vendor balance and due date, watched — so a deposit deadline never sneaks up and costs you the booking.',
        live: figurePayments,
      },
      {
        icon: PiggyBank,
        title: 'Warns you before you go over budget',
        body: 'It adds up what you’ve committed against your target and speaks up while there’s still room to trim, not after.',
      },
      {
        icon: Eye,
        title: 'Notices when someone eyes your date',
        body: 'When another couple starts looking at a vendor you’re considering for your date, it tells you — so you can lock them in first.',
      },
    ],
  },
];

function Figure({ text }: { text: string }) {
  return (
    <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-mulberry/10 px-2.5 py-0.5 text-xs font-medium text-mulberry">
      <Sparkles aria-hidden className="h-3 w-3" strokeWidth={2} />
      {text}
    </span>
  );
}

export function SetnayanAiValue({
  mode,
  activity = null,
  eventWord = 'wedding',
}: {
  mode: 'live' | 'preview';
  activity?: AiActivity | null;
  eventWord?: string;
}) {
  const live = mode === 'live' && activity !== null;

  return (
    <div className="space-y-6">
      {/* Live briefing — the headline per-event number. Only in live mode. */}
      {live && activity ? (
        <div className="sn-tile space-y-3 p-5">
          <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-mulberry">
            <ShieldCheck aria-hidden className="h-4 w-4" strokeWidth={2} />
            Working right now
          </p>
          <p className="text-lg font-medium text-ink">
            {activity.cockpit.briefing.sentence}
          </p>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-ink/10"
            role="img"
            aria-label={`${activity.cockpit.briefing.lockedPct}% locked in`}
          >
            <div
              className="h-full rounded-full bg-mulberry transition-all"
              style={{ width: `${Math.max(2, Math.min(100, activity.cockpit.briefing.lockedPct))}%` }}
            />
          </div>
        </div>
      ) : null}

      {GROUPS.map((group) => (
        <section key={group.heading} className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">{group.heading}</h2>
            <p className="text-sm text-ink/55">{group.blurb}</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-3">
            {group.caps.map(({ icon: Icon, title, body, live: liveFn }) => {
              const figure = live && activity && liveFn ? liveFn(activity) : null;
              return (
                <li key={title} className="sn-row flex flex-col p-4">
                  <Icon aria-hidden className="h-5 w-5 text-mulberry" strokeWidth={1.75} />
                  <p className="mt-2 text-sm font-medium text-ink">{title}</p>
                  <p className="mt-1 text-sm text-ink/65">{body}</p>
                  {figure ? <Figure text={figure} /> : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {/* The "impossible by hand" close — the point of the whole surface. */}
      <div className="rounded-xl border border-mulberry/20 bg-mulberry/5 p-5">
        <p className="text-sm text-ink/75">
          {live ? (
            <>
              Keeping this by hand would mean re-checking every vendor, every
              deadline and every payment yourself — each week, for the months
              until your {eventWord}. Setnayan AI does it continuously, never
              forgets, and never sleeps. That’s the part a person simply can’t
              hold in their head.
            </>
          ) : (
            <>
              Doing all of this yourself means re-checking every vendor, every
              deadline and every payment by hand — each week, for the months
              until your {eventWord}. Setnayan AI holds it for you, continuously,
              so nothing slips while you’re living your life.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
