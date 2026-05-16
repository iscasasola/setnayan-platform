// Section 3 — Real numbers (count-gated) (iteration 0015 § Section 3)
//
// Single page position with two render states keyed off a derived
// `stats_section_visible` flag that recomputes daily against:
//   - verified_vendor_count >= 100
//   - celebrated_event_count >= 25
//   - active_couple_count >= 1,000  (90-day active)
//   - ph_cities_live >= 5
//
// Pre-threshold render (V1 launch state) — what ships now:
//   single line, muted, centered:
//   "Real Filipino weddings shipping on Setnayan — soon."
//
// Post-threshold render lives in this file too (commented placeholder
// JSX below) so the eventual wire-up against site_widgets is trivial.

// TODO(post-Agent-D-merge): swap to dynamic gate read from
//   site_widgets row `home_real_numbers` (gate_type='count') and the
//   derived count_gate_passes BOOLEAN once the registry table lands.
//   For now the pre-threshold placeholder is unconditional.

export function RealNumbers() {
  return (
    <section
      aria-label="Setnayan numbers — pre-launch placeholder"
      className="border-b border-ink/5 bg-cream"
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-center px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <p className="text-center font-mono text-xs uppercase tracking-[0.25em] text-ink/40 sm:text-sm">
          Real Filipino weddings shipping on Setnayan &mdash; soon.
        </p>
      </div>
      {/*
        Post-threshold render (do not delete — wires in once gate passes):

        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
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
