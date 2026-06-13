import {
  Users,
  Armchair,
  Wallet,
  Palette,
  CalendarDays,
  type LucideIcon,
} from 'lucide-react';
import type { MarketingLocale } from '@/lib/marketing-i18n';

// Planning toolkit — guest list (0001), seating (0008), budget (0007),
// mood board (0010), schedule. One sub-section per feature with the
// "what it does" copy + a small mock visual + deep-dive narrative.
// Visual style mirrors the homepage Maria & Juan dashboard mocks but
// at a smaller, per-feature scale.

type FeatureMeta = {
  Icon: LucideIcon;
  iteration: string;
  visual: React.ReactNode;
};

type FeatureCopy = { title: string; oneLiner: string; body: string };

// Language-neutral structural data (icon + iteration tag + the micro-mock
// illustration). Zips with COPY[locale].features by index — keep both arrays
// the same length + order. The mocks below stay shared: they're reassurance
// illustrations (product-screenshot style), not translated prose.
const FEATURE_META: FeatureMeta[] = [
  { Icon: Users, iteration: 'Iteration 0001', visual: <GuestListMock /> },
  { Icon: Armchair, iteration: 'Iteration 0008', visual: <SeatingMock /> },
  { Icon: Wallet, iteration: 'Iteration 0007', visual: <BudgetMock /> },
  { Icon: Palette, iteration: 'Iteration 0010', visual: <MoodBoardMock /> },
  { Icon: CalendarDays, iteration: 'Iteration 0008', visual: <ScheduleMock /> },
];

const COPY: Record<
  MarketingLocale,
  {
    eyebrow: string;
    heading: string;
    intro: string;
    pillarLabel: string;
    features: FeatureCopy[];
  }
> = {
  en: {
    eyebrow: 'Section 1 · The planning toolkit',
    heading: 'The unfun parts, made un-painful.',
    intro:
      'Guest list, seating, budget, mood board, schedule. Five tools that replace the spreadsheet, the Notes app, the Google Doc, the Pinterest board, and the calendar invite. All free, all linked, all updating each other in real time.',
    pillarLabel: 'Free with every account',
    features: [
      {
        title: 'Guest list — every guest, every detail',
        oneLiner:
          'From save-the-dates to seating, RSVPs, plus-ones, dietary notes — all one row each.',
        body: 'Every guest is one row in your guest book. Track RSVP, plus-one, dietary preferences, role (principal sponsor, candle, veil, cord, coin, ninang, ninong), table assignment, and personal QR — all linked to the same database your invitations and gallery read from. No more juggling a Google Sheet plus a Notes app plus a WhatsApp thread. When a guest opens their invite QR, your guest list updates in real time.',
      },
      {
        title: 'Seating chart — drag, drop, done',
        oneLiner: 'Visual seating that respects who shouldn’t sit next to whom.',
        body: 'Drag guests onto tables. Setnayan flags awkward pairings (your aunt who shouldn’t sit near your in-laws), keeps plus-ones together, and reserves the bridal-table seats for sponsors. Print the seating chart as a PDF — or hand the chart to your coordinator and let them re-arrange right up until the day.',
      },
      {
        title: 'Budget — the truth, in PHP',
        oneLiner: 'Budget by category, paid vs. owed, what’s due next month.',
        body: 'Set a total budget. Setnayan splits it across categories (venue, catering, photography, attire, flowers, music) with smart Filipino-wedding defaults you can override. Log payments as you make them; the system tracks paid vs. owed and surfaces what’s due in the next 30 days. Every payment ties back to a vendor and an OR — no orphaned line items.',
      },
      {
        title: 'Mood board — your wedding’s look',
        oneLiner: 'Pin photos, lock palettes, share with vendors in one click.',
        body: 'Pin photos from Pinterest, Instagram, your friend’s wedding album. Setnayan extracts the dominant palette so your florist, your stationer, and your stylist all reference the same hex codes. Per-role palettes for the bride, the groom, the entourage, and the venue. Share the board with a vendor by link — no account required to view.',
      },
      {
        title: 'Schedule — the day, minute by minute',
        oneLiner: 'Build your day-of timeline; we sync it to every vendor’s calendar.',
        body: 'Compose your day-of run-of-show: prep, ceremony, photos, reception, after-party. Each block has a time, a location, the responsible vendors, and the guests involved. Subscribe to .ics so it syncs to your phone. When you adjust a block, every vendor on that block gets a notification.',
      },
    ],
  },
  tl: {
    eyebrow: 'Section 1 · The planning toolkit',
    heading: 'Ang mga nakakapagod na parte, ginawang hindi na masakit.',
    intro:
      'Guest list, seating, budget, mood board, schedule. Limang tool na kapalit ng spreadsheet, ng Notes app, ng Google Doc, ng Pinterest board, at ng calendar invite. Libre lahat, konektado lahat, nag-u-update sa isa’t isa real-time.',
    pillarLabel: 'Libre sa bawat account',
    features: [
      {
        title: 'Guest list — bawat guest, bawat detalye',
        oneLiner:
          'Mula save-the-dates hanggang seating, RSVPs, plus-ones, dietary notes — isang row bawat isa.',
        body: 'Bawat guest ay isang row sa guest book mo. I-track ang RSVP, plus-one, dietary preferences, role (principal sponsor, candle, veil, cord, coin, ninang, ninong), table assignment, at personal QR — lahat naka-link sa parehong database na binabasa ng invitations at gallery mo. Wala nang pag-juggle ng Google Sheet plus Notes app plus WhatsApp thread. Pag binuksan ng guest ang invite QR nila, nag-u-update ang guest list mo real-time.',
      },
      {
        title: 'Seating chart — drag, drop, tapos',
        oneLiner: 'Visual seating na gumagalang kung sino ang hindi dapat magkatabi.',
        body: 'I-drag ang guests sa tables. Nila-flag ng Setnayan ang awkward na pagkakatabi (ang tita mo na hindi dapat malapit sa in-laws mo), pinagsasama ang plus-ones, at nirereserba ang bridal-table seats para sa sponsors. I-print ang seating chart bilang PDF — o ibigay ang chart sa coordinator mo at hayaan silang mag-ayos hanggang sa mismong araw.',
      },
      {
        title: 'Budget — ang totoo, sa PHP',
        oneLiner: 'Budget per category, bayad vs. utang, ano ang due next month.',
        body: 'Mag-set ng total budget. Hinahati ito ng Setnayan sa mga category (venue, catering, photography, attire, flowers, music) na may smart Filipino-wedding defaults na pwede mong i-override. I-log ang payments habang nagbabayad ka; tina-track ng system ang bayad vs. utang at ilalabas kung ano ang due sa susunod na 30 araw. Bawat bayad ay nakakabit sa vendor at sa OR — walang orphaned line items.',
      },
      {
        title: 'Mood board — ang hitsura ng kasal mo',
        oneLiner: 'Mag-pin ng photos, i-lock ang palettes, i-share sa vendors in one click.',
        body: 'Mag-pin ng photos mula Pinterest, Instagram, sa wedding album ng kaibigan mo. Kinukuha ng Setnayan ang dominant palette para ang florist, stationer, at stylist mo ay pare-parehong hex codes ang reference. Per-role palettes para sa bride, groom, entourage, at venue. I-share ang board sa vendor via link — walang account na kailangan para tingnan.',
      },
      {
        title: 'Schedule — ang araw, minuto por minuto',
        oneLiner: 'Buuin ang day-of timeline mo; sini-sync namin ito sa calendar ng bawat vendor.',
        body: 'Buuin ang day-of run-of-show mo: prep, ceremony, photos, reception, after-party. May oras, lokasyon, responsableng vendors, at kasaling guests ang bawat block. I-subscribe sa .ics para mag-sync sa phone mo. Pag in-adjust mo ang isang block, makakakuha ng notification ang bawat vendor sa block na ‘yun.',
      },
    ],
  },
};

export function PlanningToolkit({ locale }: { locale: MarketingLocale }) {
  const c = COPY[locale];
  return (
    <section
      id="planning-toolkit"
      aria-labelledby="planning-toolkit-heading"
      className="scroll-mt-24 border-b border-ink/5"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <header className="mb-12 max-w-2xl space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            {c.eyebrow}
          </p>
          <h2
            id="planning-toolkit-heading"
            className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl"
          >
            {c.heading}
          </h2>
          <p className="text-base text-ink/65">{c.intro}</p>
        </header>

        <div className="space-y-12 sm:space-y-16">
          {c.features.map((f, i) => (
            <FeatureRow
              key={f.title}
              copy={f}
              meta={FEATURE_META[i]!}
              pillarLabel={c.pillarLabel}
              flipped={i % 2 === 1}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureRow({
  copy,
  meta,
  pillarLabel,
  flipped,
}: {
  copy: FeatureCopy;
  meta: FeatureMeta;
  pillarLabel: string;
  flipped: boolean;
}) {
  const { Icon } = meta;
  return (
    <article className="grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-12">
      <div className={`space-y-4 ${flipped ? 'lg:order-2' : ''}`}>
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
            <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50">
            {meta.iteration} · {pillarLabel}
          </span>
        </div>
        <h3 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          {copy.title}
        </h3>
        <p
          className="text-base font-medium text-ink/80"
          dangerouslySetInnerHTML={{ __html: copy.oneLiner }}
        />
        <p
          className="text-sm text-ink/65"
          dangerouslySetInnerHTML={{ __html: copy.body }}
        />
      </div>
      <div className={flipped ? 'lg:order-1' : ''}>{meta.visual}</div>
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
