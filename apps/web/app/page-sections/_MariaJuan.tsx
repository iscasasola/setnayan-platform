import Link from 'next/link';
import {
  Users,
  Send,
  Briefcase,
  LayoutGrid,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';

// Section 6 — Maria & Juan: see how it works (iteration 0015 § Section 6)
// Product proof — interactive UI preview substitutes for testimonials we
// don't have yet.
//
// Top half: dashboard preview placeholder (minimal — full interactive
// version is design-blocked / out of scope for the skeleton).
// Bottom half: 4-tab walkthrough table from the spec verbatim.

// TODO(design-direction): replace placeholder dashboard preview with
//   real interactive Maria & Juan preview (stage strip, vendor-side peek
//   toggle, theme picker including the new Forest Theme and burgundy-
//   accented Setnayan Default). Reuse from current /dashboard if possible.

const TAB_WALKTHROUGH: Array<{
  tab: string;
  Icon: LucideIcon;
  headline: string;
  body: string;
  slug: string;
}> = [
  {
    tab: 'Guest List',
    Icon: Users,
    headline: 'From save-the-dates to seating charts.',
    body: 'Track every guest, RSVP, plus-one, dietary preference, table assignment, and personal QR — all linked to the same database your invitations and gallery read from.',
    slug: 'guest-list',
  },
  {
    tab: 'Vendors',
    Icon: Briefcase,
    headline: 'Every vendor, every payment, one ledger.',
    body: 'Track contracts, milestones, deadlines, and crew-meal counts. Calendar-export every payment + every vendor meeting. Vendors stay in sync — you stay in control.',
    slug: 'vendors',
  },
  {
    tab: 'Schedule',
    Icon: Send,
    headline:
      'Every date, every reminder, every milestone — auto-tracked.',
    body: 'Wedding-day timeline, vendor meetings, payment deadlines, RSVP cutoffs — pulled from across the app into one calendar. Subscribe to .ics so it syncs to your phone.',
    slug: 'schedule',
  },
  {
    tab: 'In-App Services',
    Icon: LayoutGrid,
    headline: "The features other event apps haven't maximized.",
    body: 'Live stream on YouTube. Designated friends as paparazzi capturing your candid moments. Custom monogram across every output. Mood boards. LED backgrounds. Polished highlight reels.',
    slug: 'in-app-services',
  },
];

function DashboardPreviewPlaceholder() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="rounded-3xl border border-ink/10 bg-cream p-6 shadow-[0_30px_80px_-40px_rgba(26,26,26,0.25)]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
              Good evening, Maria
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/40">
              12 · 12 · 26
            </span>
          </div>
          <p className="text-xl font-semibold tracking-tight text-ink">
            Maria &amp; Juan
          </p>
          <p className="text-sm text-ink/55">213 days to go · La Castellana</p>

          <div className="flex flex-wrap gap-2 pt-1">
            {['Dreaming', 'Booking', 'Inviting', 'Finalizing', 'Day', 'After'].map(
              (s, i) => (
                <span
                  key={s}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${
                    i === 2
                      ? 'bg-terracotta text-cream'
                      : i < 2
                        ? 'bg-terracotta/15 text-terracotta-700'
                        : 'bg-ink/5 text-ink/55'
                  }`}
                >
                  {s}
                </span>
              ),
            )}
          </div>

          <div className="rounded-2xl border border-terracotta/30 bg-terracotta/5 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
              Next up
            </p>
            <p className="mt-1 text-sm font-semibold text-ink">
              Send invites to 47 pending guests
            </p>
            <p className="mt-1 text-xs text-ink/55">
              Print the QR sheet or share individual links.
            </p>
          </div>

          <div className="grid grid-cols-4 gap-2 pt-1">
            {[Users, Send, Briefcase, LayoutGrid].map((I, i) => (
              <span
                key={i}
                className="flex h-12 flex-col items-center justify-center gap-1 rounded-lg border border-ink/10 bg-cream text-terracotta"
              >
                <I aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              </span>
            ))}
          </div>
        </div>
      </div>
      <p
        aria-hidden
        className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-ink/40"
      >
        Couple home · Setnayan Default theme
      </p>
    </div>
  );
}

export function MariaJuan() {
  return (
    <section
      aria-labelledby="maria-juan-heading"
      className="border-b border-ink/5 bg-cream"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
        <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
              See how it works
            </p>
            <h2
              id="maria-juan-heading"
              className="text-balance font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl lg:text-6xl"
            >
              Maria &amp; Juan: every moving piece, in one app.
            </h2>
            <p className="max-w-prose text-base text-ink/70 sm:text-lg">
              The dashboard a real couple sees while they plan. Toggle between
              roles, swap themes, peek at what their photographer sees on the
              same data.
            </p>
            <p className="text-xs text-ink/50">
              A live walkthrough lands as we approach launch — December 1, 2026.
            </p>
          </div>
          <div className="lg:pl-8">
            <DashboardPreviewPlaceholder />
          </div>
        </div>

        {/* Four-tab walkthrough (folded in from previous Section 4) */}
        <div className="mt-16 lg:mt-24">
          <h3 className="font-sans text-xl font-semibold tracking-tight text-ink sm:text-2xl">
            Four tabs. Every moving piece of your event.
          </h3>
          <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {TAB_WALKTHROUGH.map((t) => {
              const { Icon } = t;
              return (
                <li
                  key={t.tab}
                  className="flex flex-col gap-3 rounded-xl border border-ink/10 bg-cream p-5"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
                      <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
                      {t.tab}
                    </span>
                  </div>
                  <h4 className="text-base font-semibold tracking-tight text-ink sm:text-lg">
                    {t.headline}
                  </h4>
                  <p className="text-sm text-ink/65">{t.body}</p>
                  <Link
                    href={`/features#${t.slug}`}
                    className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-terracotta underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline"
                  >
                    Learn more
                    <ArrowRight
                      aria-hidden
                      className="h-3.5 w-3.5"
                      strokeWidth={1.75}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
