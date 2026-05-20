// Section 3 — Real numbers (count-gated) (iteration 0015 § Section 3).
//
// Pre-threshold render reworked 2026-05-20: the previous "Real Filipino
// weddings shipping on Setnayan — soon." line was empty editorial weight
// that took a full vertical slot and signalled nothing useful. Replaced
// with a "What's live today" feature chip strip — concrete, scannable
// reassurance that the product is real and shipped, sourced from the
// V1 App Build Status (iterations 0001, 0002, 0006, 0011, 0012, 0021,
// 0028, 0034, 0048 are all live). Post-threshold render (commented
// below) still drops in cleanly once the count gate trips.
//
// Single page position with two render states keyed off a derived
// `stats_section_visible` flag that recomputes daily against:
//   - verified_vendor_count >= 100
//   - celebrated_event_count >= 25
//   - active_couple_count >= 1,000  (90-day active)
//   - ph_cities_live >= 5

const SHIPPED_FEATURES: ReadonlyArray<string> = [
  'BIR-compliant receipts',
  'QR invitations',
  'Verified vendor marketplace',
  'Day-of livestream',
  'Same-day highlight reel',
  'Multi-host event access',
  'In-app chat with vendors',
  'Milestone-protected payments',
];

export function RealNumbers() {
  return (
    <section
      aria-label="What's live on Setnayan today"
      className="border-b border-ink/5 bg-cream"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
        <div className="flex flex-col items-center gap-5 sm:gap-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-terracotta sm:text-xs">
            What&rsquo;s live today
          </p>
          <ul className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            {SHIPPED_FEATURES.map((label) => (
              <li
                key={label}
                className="inline-flex items-center rounded-full border border-ink/10 bg-cream px-3 py-1.5 text-xs text-ink/75 sm:px-4 sm:py-2 sm:text-sm"
              >
                {label}
              </li>
            ))}
          </ul>
        </div>
      </div>
      {/*
        Post-threshold render (do not delete — wires in once gate passes):

        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <h2 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">
            The numbers behind Setnayan
          </h2>
          <ul className="mt-8 grid grid-cols-2 gap-6 text-ink lg:grid-cols-4">
            <li><span className="block font-sans text-4xl font-semibold">100+</span><span className="mt-1 block text-sm text-ink/55">vendors</span></li>
            <li><span className="block font-sans text-4xl font-semibold">25+</span><span className="mt-1 block text-sm text-ink/55">events</span></li>
            <li><span className="block font-sans text-4xl font-semibold">1,000+</span><span className="mt-1 block text-sm text-ink/55">couples</span></li>
            <li><span className="block font-sans text-4xl font-semibold">5 cities</span><span className="mt-1 block text-sm text-ink/55">live</span></li>
          </ul>
          <p className="mt-6 text-sm text-ink/55">Plus rising →</p>
        </div>
      */}
    </section>
  );
}
