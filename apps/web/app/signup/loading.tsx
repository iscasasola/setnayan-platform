import { Sk } from '@/components/skeletons';

/**
 * Create-account loading shell — mirrors the centered .m-signup-card layout
 * (brand panel + form, splitting 2-up on lg) so /signup never flashes blank on
 * a cold load. Closer + nicer than the generic root app/loading.tsx fallback.
 */
export default function SignupLoading() {
  return (
    <main
      aria-busy="true"
      aria-live="polite"
      className="flex min-h-[100dvh] items-center justify-center px-4 py-6"
      style={{ background: 'var(--m-paper)' }}
    >
      <span className="sr-only">Loading…</span>
      <div
        className="grid w-full max-w-[960px] overflow-hidden rounded-[18px] border lg:grid-cols-2"
        style={{ borderColor: 'var(--m-line)' }}
      >
        {/* Brand panel — left on lg, hidden on mobile (matches the card split). */}
        <div className="hidden flex-col justify-center gap-4 p-10 lg:flex bg-ink/[0.02]">
          <Sk className="h-8 w-44 rounded-md" />
          <Sk className="h-4 w-56 max-w-full rounded" />
          <Sk className="h-4 w-48 rounded" />
        </div>
        {/* Form panel. */}
        <div className="space-y-4 p-8 sm:p-10">
          <Sk className="h-7 w-48 rounded-md" />
          <Sk className="h-4 w-64 max-w-full rounded" />
          <div className="space-y-3 pt-2">
            <Sk className="h-11 w-full rounded-md" />
            <Sk className="h-11 w-full rounded-md" />
            <Sk className="h-11 w-full rounded-md" />
          </div>
          <Sk className="h-4 w-40 rounded" />
        </div>
      </div>
    </main>
  );
}
