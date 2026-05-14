type Props = {
  iteration: string;
  title: string;
  blurb: string;
  hint?: string;
  /**
   * When false, the iteration code pill is hidden — used to keep internal
   * spec-cross-reference strings (e.g. `Iteration 0012`) out of couple- and
   * vendor-facing surfaces. Defaults to true for backwards compat.
   */
  showIteration?: boolean;
};

export function IterationPlaceholder({
  iteration,
  title,
  blurb,
  hint,
  showIteration = true,
}: Props) {
  return (
    <section className="rounded-xl border border-dashed border-ink/15 bg-cream p-6 sm:p-8">
      {showIteration ? (
        <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-terracotta/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.15em] text-terracotta">
          <span aria-hidden>○</span>
          {iteration}
        </p>
      ) : null}
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
      <p className="mt-2 max-w-prose text-base text-ink/70">{blurb}</p>
      {hint ? <p className="mt-4 max-w-prose text-sm text-ink/50">{hint}</p> : null}
    </section>
  );
}
