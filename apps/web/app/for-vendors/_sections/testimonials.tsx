import { Quote } from 'lucide-react';

// Testimonials placeholder — empty slot at V1; populate post-launch with
// real vendor quotes. Per the spec corpus' iteration 0015 § Open
// Questions: "placeholder for V1 ('Couple testimonials publish after our
// first 50 weddings'); real testimonials backfilled in V1.1." Same
// pattern applied here for vendor-side quotes.

export function Testimonials() {
  return (
    <section className="border-b border-ink/5">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mb-10 max-w-2xl space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
            Vendor stories
          </p>
          <h2 className="font-display text-4xl font-medium tracking-tight sm:text-5xl">
            Real Filipino vendors, soon.
          </h2>
          <p className="text-base text-ink/65">
            Setnayan is brand-new. We&rsquo;ll publish our first vendor stories
            after our launch cohort runs their first season — paired with
            permission and a real photo, not stock copy under a generic avatar.
          </p>
        </div>

        <article
          aria-label="Vendor stories — to be published after our pioneer cohort ships their first season"
          className="flex max-w-2xl flex-col gap-4 rounded-2xl border border-dashed border-ink/15 bg-cream p-6"
        >
          <Quote
            aria-hidden
            className="h-6 w-6 text-ink/25"
            strokeWidth={1.5}
          />
          <p className="text-sm italic text-ink/50">
            Vendor stories publish here after our pioneer cohort ships their
            first season — with the vendor&rsquo;s business name, logo, and a
            real photo.
          </p>
        </article>
      </div>
    </section>
  );
}
