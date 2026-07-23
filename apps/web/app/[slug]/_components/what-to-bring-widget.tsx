/**
 * What to Bring — the couple's gift / registry / no-gift note (Increment
 * A.3). Reads events.what_to_bring; renders nothing when blank so the
 * section hides.
 */
export function WhatToBringWidget({ text }: { text: string | null }) {
  const msg = (text ?? '').trim();
  if (!msg) return null;
  return (
    <section className="rounded-xl border border-ink/10 bg-cream p-6 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
        What to bring
      </p>
      <p className="mx-auto mt-3 max-w-prose whitespace-pre-line text-sm leading-relaxed text-ink/80">
        {msg}
      </p>
    </section>
  );
}
