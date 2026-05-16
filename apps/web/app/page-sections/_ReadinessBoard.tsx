// Section 9 — Event-type readiness board (iteration 0015 § Section 9)
// A grid of event-type tiles. Each tile: cover-photo placeholder, event-type
// name, status pill, and a goal-progress bar showing vendor readiness for
// that type. Wedding is LIVE; others "Coming soon" with placeholder bars.
//
// Post-launch (T+90 days) this section flips to a social-proof carousel
// triggered by the same `stats_section_visible` derived flag from Section 3.
// Pre-launch: roadmap pattern builds momentum.

type EventTile = {
  name: string;
  status: 'LIVE' | 'Coming soon';
  unlocks: string;
  // Placeholder readiness — until Agent D's table merges, hand-tuned 0-100
  // bars to give the section visual rhythm without faking specific counts.
  readiness: number;
};

const TILES: EventTile[] = [
  {
    name: 'Wedding',
    status: 'LIVE',
    unlocks: 'Full feature set already shipped.',
    readiness: 100,
  },
  {
    name: 'Birthday Parties',
    status: 'Coming soon',
    unlocks:
      "Children's-party packages, theme decorators, party planners.",
    readiness: 35,
  },
  {
    name: 'Anniversaries',
    status: 'Coming soon',
    unlocks: 'Surprise-party concierge, intimate-venue partners.',
    readiness: 28,
  },
  {
    name: 'Vow Renewals',
    status: 'Coming soon',
    unlocks: 'Same as wedding, smaller-scale catering.',
    readiness: 24,
  },
  {
    name: 'Baptism',
    status: 'Coming soon',
    unlocks: 'Officiant + reception bundle.',
    readiness: 20,
  },
  {
    name: 'Corporate',
    status: 'Coming soon',
    unlocks: 'Conference AV, team-event venues, corporate emcees.',
    readiness: 18,
  },
  {
    name: 'Concerts / Showcases',
    status: 'Coming soon',
    unlocks: 'Stage rental, lights & sound at scale.',
    readiness: 14,
  },
  {
    name: 'Burial / Wake',
    status: 'Coming soon',
    unlocks: 'Memorial photographers, livestream condolences.',
    readiness: 10,
  },
  {
    name: 'Travel',
    status: 'Coming soon',
    unlocks: 'Out-of-town logistics, destination vendor sourcing.',
    readiness: 8,
  },
  {
    name: 'Celebration (catch-all)',
    status: 'Coming soon',
    unlocks: 'Generic event type for everything else.',
    readiness: 12,
  },
];

function CoverPlaceholder({ name }: { name: string }) {
  return (
    <div
      aria-hidden
      className="flex h-24 items-center justify-center rounded-lg bg-gradient-to-br from-terracotta/15 via-terracotta/5 to-ink/5"
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/40">
        {name}
      </span>
    </div>
  );
}

export function ReadinessBoard() {
  return (
    <section
      aria-labelledby="readiness-heading"
      className="border-b border-ink/5"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
        <div className="max-w-3xl space-y-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            Wedding muna. May iba pang darating.
          </p>
          <h2
            id="readiness-heading"
            className="text-balance font-sans text-3xl font-semibold tracking-tight text-ink sm:text-4xl lg:text-5xl"
          >
            Event-type readiness board.
          </h2>
          <p className="text-base text-ink/65 sm:text-lg">
            Wedding is live. Other event types unlock as their vendor pools
            reach the per-type readiness threshold.
          </p>
        </div>

        <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TILES.map((t) => {
            const isLive = t.status === 'LIVE';
            return (
              <li
                key={t.name}
                className="flex flex-col gap-3 rounded-xl border border-ink/10 bg-cream p-5"
              >
                <CoverPlaceholder name={t.name} />
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold tracking-tight text-ink sm:text-lg">
                    {t.name}
                  </h3>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${
                      isLive
                        ? 'bg-terracotta text-cream'
                        : 'bg-ink/[0.06] text-ink/65'
                    }`}
                  >
                    {t.status}
                  </span>
                </div>
                <p className="text-sm text-ink/65">{t.unlocks}</p>

                <div className="mt-auto space-y-2 pt-2">
                  <div
                    role="progressbar"
                    aria-label={`${t.name} vendor readiness`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={t.readiness}
                    className="h-1.5 w-full overflow-hidden rounded-full bg-ink/[0.08]"
                  >
                    <div
                      className={`h-full ${
                        isLive ? 'bg-terracotta' : 'bg-terracotta/40'
                      }`}
                      style={{ width: `${t.readiness}%` }}
                    />
                  </div>
                  {!isLive ? (
                    <button
                      type="button"
                      disabled
                      aria-label={`Notify me when ${t.name} opens (coming soon)`}
                      className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-md border border-ink/10 px-3 text-xs font-medium text-ink/55"
                    >
                      Notify me when this opens
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-8 text-xs text-ink/50">
          11+ more event types tracked. Tiles unlock as vendor pools reach
          per-type readiness thresholds.
        </p>
      </div>
    </section>
  );
}
