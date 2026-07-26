/**
 * Special Message — the couple's note to guests (Increment A.1). Reads
 * events.special_message; renders nothing when blank so the section hides.
 */
export function SpecialMessageWidget({ text }: { text: string | null }) {
  const msg = (text ?? '').trim();
  if (!msg) return null;
  // Pahina (design 2026-07-25 §7): a "Good to know" plate. Unnumbered on
  // purpose — `WhatToBringWidget` is its sibling and both can render on one
  // page, so they read as two notes rather than two competing chapters.
  return (
    <section className="space-y-3">
      <p className="pahina-eyebrow">
        <span>A note from us</span>
      </p>
      <div className="pahina-plate">
        <p className="max-w-prose whitespace-pre-line font-pahina text-xl font-light italic leading-relaxed text-ink">
          {msg}
        </p>
      </div>
    </section>
  );
}
