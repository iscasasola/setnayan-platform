import {
  Users,
  Armchair,
  Wallet,
  Palette,
  CalendarDays,
  type LucideIcon,
} from 'lucide-react';

// Planning toolkit — guest list (0001), seating (0008), budget (0007),
// mood board (0010), schedule. One sub-section per feature with the
// "what it does" copy + a small mock visual + deep-dive narrative.
// Visual style mirrors the homepage Maria & Juan dashboard mocks but
// at a smaller, per-feature scale.

type Feature = {
  Icon: LucideIcon;
  title: string;
  oneLiner: string;
  body: string;
  iteration: string;
  pillarLabel: string;
  visual: React.ReactNode;
};

const FEATURES: Feature[] = [
  {
    Icon: Users,
    title: 'Guest list — every guest, every detail',
    oneLiner: 'From save-the-dates to seating, RSVPs, plus-ones, dietary notes — all one row each.',
    body: 'Every guest is one row in your guest book. Track RSVP, plus-one, dietary preferences, role (principal sponsor, candle, veil, cord, coin, ninang, ninong), table assignment, and personal QR — all linked to the same database your invitations and gallery read from. No more juggling a Google Sheet plus a Notes app plus a WhatsApp thread. When a guest opens their invite QR, your guest list updates in real time.',
    iteration: 'Iteration 0001',
    pillarLabel: 'Free with every account',
    visual: <GuestListMock />,
  },
  {
    Icon: Armchair,
    title: 'Seating chart — drag, drop, done',
    oneLiner: 'Visual seating that respects who shouldn&rsquo;t sit next to whom.',
    body: 'Drag guests onto tables. Setnayan flags awkward pairings (your aunt who shouldn&rsquo;t sit near your in-laws), keeps plus-ones together, and reserves the bridal-table seats for sponsors. Print the seating chart as a PDF — or hand the chart to your coordinator and let them re-arrange right up until the day.',
    iteration: 'Iteration 0008',
    pillarLabel: 'Free with every account',
    visual: <SeatingMock />,
  },
  {
    Icon: Wallet,
    title: 'Budget — the truth, in PHP',
    oneLiner: 'Budget by category, paid vs. owed, what&rsquo;s due next month.',
    body: 'Set a total budget. Setnayan splits it across categories (venue, catering, photography, attire, flowers, music) with smart Filipino-wedding defaults you can override. Log payments as you make them; the system tracks paid vs. owed and surfaces what&rsquo;s due in the next 30 days. Every payment ties back to a vendor and an OR — no orphaned line items.',
    iteration: 'Iteration 0007',
    pillarLabel: 'Free with every account',
    visual: <BudgetMock />,
  },
  {
    Icon: Palette,
    title: 'Mood board — your wedding’s look',
    oneLiner: 'Pin photos, lock palettes, share with vendors in one click.',
    body: 'Pin photos from Pinterest, Instagram, your friend&rsquo;s wedding album. Setnayan extracts the dominant palette so your florist, your stationer, and your stylist all reference the same hex codes. Per-role palettes for the bride, the groom, the entourage, and the venue. Share the board with a vendor by link — no account required to view.',
    iteration: 'Iteration 0010',
    pillarLabel: 'Free with every account',
    visual: <MoodBoardMock />,
  },
  {
    Icon: CalendarDays,
    title: 'Schedule — the day, minute by minute',
    oneLiner: 'Build your day-of timeline; we sync it to every vendor&rsquo;s calendar.',
    body: 'Compose your day-of run-of-show: prep, ceremony, photos, reception, after-party. Each block has a time, a location, the responsible vendors, and the guests involved. Subscribe to .ics so it syncs to your phone. When you adjust a block, every vendor on that block gets a notification.',
    iteration: 'Iteration 0008',
    pillarLabel: 'Free with every account',
    visual: <ScheduleMock />,
  },
];

export function PlanningToolkit() {
  return (
    <section
      id="planning-toolkit"
      aria-labelledby="planning-toolkit-heading"
      className="scroll-mt-24 border-b border-ink/5"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <header className="mb-12 max-w-2xl space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            Section 1 &middot; The planning toolkit
          </p>
          <h2
            id="planning-toolkit-heading"
            className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl"
          >
            The unfun parts, made un-painful.
          </h2>
          <p className="text-base text-ink/65">
            Guest list, seating, budget, mood board, schedule. Five tools that
            replace the spreadsheet, the Notes app, the Google Doc, the
            Pinterest board, and the calendar invite. All free, all linked,
            all updating each other in real time.
          </p>
        </header>

        <div className="space-y-12 sm:space-y-16">
          {FEATURES.map((f, i) => (
            <FeatureRow key={f.title} feature={f} flipped={i % 2 === 1} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureRow({ feature, flipped }: { feature: Feature; flipped: boolean }) {
  const { Icon } = feature;
  return (
    <article className="grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-12">
      <div className={`space-y-4 ${flipped ? 'lg:order-2' : ''}`}>
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
            <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50">
            {feature.iteration} &middot; {feature.pillarLabel}
          </span>
        </div>
        <h3 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          {feature.title}
        </h3>
        <p
          className="text-base font-medium text-ink/80"
          dangerouslySetInnerHTML={{ __html: feature.oneLiner }}
        />
        <p
          className="text-sm text-ink/65"
          dangerouslySetInnerHTML={{ __html: feature.body }}
        />
      </div>
      <div className={flipped ? 'lg:order-1' : ''}>{feature.visual}</div>
    </article>
  );
}

// --- Per-feature micro-mocks ----------------------------------------------
// Static markup illustrations of each tool. Static deliberately — these are
// reassurance visuals, not live previews. The interactive Maria & Juan demo
// belongs on the homepage.

function MockShell({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="relative">
      <div className="rounded-2xl border border-ink/10 bg-cream p-5 shadow-[0_20px_60px_-30px_rgba(26,26,26,0.18)]">
        {children}
      </div>
      <p
        aria-hidden
        className="mt-2 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-ink/40"
      >
        {label}
      </p>
    </div>
  );
}

function GuestListMock() {
  const rows = [
    { name: 'Tito Boy Reyes', role: 'Ninong', rsvp: 'Yes', table: 'T2' },
    { name: 'Ate Marie + 1', role: 'Maid of Honor', rsvp: 'Yes', table: 'T1' },
    { name: 'Kuya James', role: 'Groomsman', rsvp: 'Maybe', table: '—' },
    { name: 'Fr. Dela Cruz', role: 'Officiant', rsvp: 'Yes', table: 'Bridal' },
  ];
  return (
    <MockShell label="Couple home &middot; Guest list">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">142 guests</p>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
            87 RSVP&rsquo;d
          </span>
        </div>
        <ul className="divide-y divide-ink/5 rounded-lg border border-ink/10">
          {rows.map((r) => (
            <li
              key={r.name}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-2 text-xs"
            >
              <span className="truncate font-medium text-ink">{r.name}</span>
              <span className="rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[10px] text-ink/60">
                {r.role}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${
                  r.rsvp === 'Yes'
                    ? 'bg-terracotta/15 text-terracotta-700'
                    : 'bg-ink/5 text-ink/60'
                }`}
              >
                {r.rsvp} &middot; {r.table}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </MockShell>
  );
}

function SeatingMock() {
  return (
    <MockShell label="Seating chart &middot; Reception">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">14 tables &middot; 142 seats</p>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
            2 conflicts flagged
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <span
              key={i}
              aria-hidden
              className={`flex aspect-square items-center justify-center rounded-full border text-[10px] font-mono ${
                i === 5
                  ? 'border-terracotta bg-terracotta/15 text-terracotta-700'
                  : 'border-ink/15 bg-cream text-ink/55'
              }`}
            >
              T{i + 1}
            </span>
          ))}
        </div>
        <div className="rounded-lg border border-ink/10 bg-ink/[0.02] p-3 text-xs text-ink/60">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
            Conflict
          </span>
          <p className="mt-1">Table 6 &middot; ex-step-relatives at the same table.</p>
        </div>
      </div>
    </MockShell>
  );
}

function BudgetMock() {
  const lines = [
    { label: 'Venue', paid: 320000, total: 350000 },
    { label: 'Catering', paid: 145000, total: 280000 },
    { label: 'Photography', paid: 80000, total: 80000 },
    { label: 'Attire', paid: 0, total: 95000 },
  ];
  const totalPaid = lines.reduce((a, l) => a + l.paid, 0);
  const totalBudget = lines.reduce((a, l) => a + l.total, 0);
  return (
    <MockShell label="Couple home &middot; Budget">
      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-semibold text-ink">Budget &middot; PHP</p>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
            {Math.round((totalPaid / totalBudget) * 100)}% paid
          </span>
        </div>
        <ul className="space-y-2">
          {lines.map((l) => {
            const pct = Math.round((l.paid / l.total) * 100);
            return (
              <li key={l.label}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-ink">{l.label}</span>
                  <span className="font-mono text-[10px] text-ink/55">{pct}%</span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-ink/[0.06]">
                  <div
                    aria-hidden
                    className="h-full bg-terracotta"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </MockShell>
  );
}

function MoodBoardMock() {
  const tiles = [
    'bg-gradient-to-br from-terracotta/40 to-terracotta/20',
    'bg-gradient-to-br from-ink/20 to-ink/10',
    'bg-gradient-to-br from-terracotta/60 to-terracotta/30',
    'bg-gradient-to-br from-ink/30 to-ink/15',
    'bg-gradient-to-br from-terracotta/25 to-terracotta/10',
    'bg-gradient-to-br from-ink/15 to-ink/5',
  ];
  return (
    <MockShell label="Mood board &middot; Pakulay engine">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">Reception look</p>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
            Palette locked
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {tiles.map((cls, i) => (
            <span
              key={i}
              aria-hidden
              className={`aspect-square rounded-lg border border-ink/10 ${cls}`}
            />
          ))}
        </div>
        <div className="flex gap-2">
          {['#7A1F2B', '#C9A66B', '#1A1A1A'].map((hex) => (
            <span
              key={hex}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-cream px-2 py-1"
            >
              <span
                aria-hidden
                className="inline-block h-3 w-3 rounded-full"
                style={{ background: hex }}
              />
              <span className="font-mono text-[10px] text-ink/65">{hex}</span>
            </span>
          ))}
        </div>
      </div>
    </MockShell>
  );
}

function ScheduleMock() {
  const blocks = [
    { time: '13:00', label: 'Bride prep &middot; Salon Aria', vendor: 'HMUA' },
    { time: '15:30', label: 'Ceremony &middot; San Sebastian', vendor: 'Officiant' },
    { time: '17:00', label: 'Couple portraits &middot; Garden', vendor: 'Photo' },
    { time: '18:30', label: 'Reception &middot; First dance', vendor: 'DJ' },
  ];
  return (
    <MockShell label="Schedule &middot; Day-of timeline">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">Sat, Dec 12 &middot; 2026</p>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
            .ics synced
          </span>
        </div>
        <ol className="space-y-2">
          {blocks.map((b) => (
            <li
              key={b.time}
              className="grid grid-cols-[3rem_1fr_auto] items-center gap-2 rounded-lg border border-ink/10 px-3 py-2 text-xs"
            >
              <span className="font-mono text-[11px] font-semibold text-terracotta">
                {b.time}
              </span>
              <span
                className="text-ink"
                dangerouslySetInnerHTML={{ __html: b.label }}
              />
              <span className="rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[10px] text-ink/55">
                {b.vendor}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </MockShell>
  );
}
