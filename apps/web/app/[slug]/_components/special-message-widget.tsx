/**
 * Special Message — the couple's note to guests (Increment A.1). Reads
 * events.special_message; renders nothing when blank so the section hides.
 */
export function SpecialMessageWidget({ text }: { text: string | null }) {
  const msg = (text ?? '').trim();
  if (!msg) return null;
  return (
    <section className="rounded-xl border border-ink/10 bg-cream p-6 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
        A note from us
      </p>
      <p className="mx-auto mt-3 max-w-prose whitespace-pre-line font-serif text-xl italic leading-relaxed text-ink">
        {msg}
      </p>
    </section>
  );
}
