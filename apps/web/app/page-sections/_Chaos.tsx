import {
  MessageCircle,
  FileSpreadsheet,
  StickyNote,
  FolderOpen,
  Wallet,
  Image as ImageIcon,
} from 'lucide-react';

// Section 4 — The chaos we're fixing (iteration 0015 § Section 4)
// Problem statement before solution. Hooks problem-aware visitors.
//
// Visual is a "scattered-tool collage" of mockups falling into a single
// Setnayan dashboard frame. Skeleton-phase renders a placeholder grid of
// labelled tool cards — actual collage / motion is owner-side design
// direction blocked. No CTAs in this section — narrative beat only.

const SCATTERED = [
  { Icon: MessageCircle, label: 'WhatsApp thread, 11pm' },
  { Icon: FileSpreadsheet, label: 'Budget.xlsx — v8 final' },
  { Icon: StickyNote, label: 'Notes app · guest list' },
  { Icon: FolderOpen, label: 'Drive · vendor PDFs' },
  { Icon: Wallet, label: 'GCash · receipts somewhere' },
  { Icon: ImageIcon, label: 'Screenshots · mood board' },
];

export function Chaos() {
  return (
    <section
      aria-labelledby="chaos-heading"
      className="border-b border-ink/5"
    >
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-28">
        <div className="space-y-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            Sounds familiar?
          </p>
          <h2
            id="chaos-heading"
            className="text-balance font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl lg:text-6xl"
          >
            Five apps. Three spreadsheets. A WhatsApp group at 11pm.
          </h2>
          <p className="max-w-prose text-base text-ink/70 sm:text-lg">
            That&rsquo;s how most Filipino couples plan a wedding today —
            bouncing between vendor messages, guest lists, budget
            spreadsheets, mood-board screenshots, and a barangay full of
            people asking when the dress code drops.
          </p>
          <p className="max-w-prose text-base text-ink/70 sm:text-lg">
            Vendors aren&rsquo;t any better off. Bookings live in DMs.
            Calendars live in a notebook. Payments live wherever GCash
            receipts end up. Reviews don&rsquo;t live anywhere.
          </p>
        </div>

        {/* Scattered-tool collage placeholder — design-blocked. */}
        <div
          aria-hidden
          className="relative isolate flex min-h-[320px] items-center justify-center"
        >
          <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
            {SCATTERED.map((s, i) => {
              const { Icon } = s;
              // Slight per-card rotation for the "scattered" feel.
              const rotate = i % 2 === 0 ? '-rotate-2' : 'rotate-2';
              return (
                <div
                  key={s.label}
                  className={`group flex items-start gap-2 rounded-lg border border-ink/10 bg-cream/90 p-3 text-xs text-ink/60 shadow-[0_6px_24px_-12px_rgba(26,26,26,0.18)] transition-transform ${rotate} hover:rotate-0`}
                >
                  <Icon
                    aria-hidden
                    className="h-4 w-4 shrink-0 text-ink/40"
                    strokeWidth={1.75}
                  />
                  <span className="leading-snug">{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
