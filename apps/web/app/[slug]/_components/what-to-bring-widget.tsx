/**
 * What to Bring — the couple's gift / registry / no-gift note (Increment
 * A.3). Reads events.what_to_bring; renders nothing when blank so the
 * section hides.
 */
export function WhatToBringWidget({ text }: { text: string | null }) {
  const msg = (text ?? '').trim();
  if (!msg) return null;
  // Pahina (design 2026-07-25 §7): the second "Good to know" plate — same
  // grammar as SpecialMessageWidget, likewise unnumbered.
  return (
    <section className="space-y-3">
      <p className="pahina-eyebrow">
        <span>What to bring</span>
      </p>
      <div className="pahina-plate">
        <p className="max-w-prose whitespace-pre-line text-base leading-relaxed text-ink/80">
          {msg}
        </p>
      </div>
    </section>
  );
}
