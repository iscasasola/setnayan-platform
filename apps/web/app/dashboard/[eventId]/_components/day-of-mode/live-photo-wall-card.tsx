import { Camera, ArrowRight } from 'lucide-react';

/**
 * Stub: the live photo wall depends on iterations 0009 (photo delivery) and
 * 0012 (Papic / paparazzo tagging), which are not yet shipped. Renders a
 * visually-coherent placeholder so the day-of grid has its full layout and
 * couples can see where this surface will land.
 */
export function LivePhotoWallCard() {
  return (
    <article className="space-y-3 rounded-2xl border border-dashed border-ink/20 bg-ink/[0.02] p-5">
      <header className="flex items-center justify-between">
        <p className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/55">
          <Camera aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Live photo wall
        </p>
        <span className="rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-ink/55">
          Coming soon
        </span>
      </header>

      <h3 className="text-base font-semibold tracking-tight text-ink/70">
        Photos of you, as they happen
      </h3>
      <p className="text-sm text-ink/55">
        Coming when Papic ships (iteration 0012). Photos tagged with you will
        appear here in real time during the wedding.
      </p>

      <div className="grid grid-cols-3 gap-1.5 pt-1" aria-hidden>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="aspect-square rounded-md bg-ink/[0.04]"
          />
        ))}
      </div>

      <button
        type="button"
        disabled
        aria-disabled
        className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/40"
      >
        View gallery
        <ArrowRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </article>
  );
}
