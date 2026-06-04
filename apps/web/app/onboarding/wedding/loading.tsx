import { Sk } from '@/components/skeletons';

/**
 * Onboarding first-load shell. <OnboardingShell> is a full-screen, preloaded
 * phone-frame wizard (golden rules: no scroll, brand always visible). This
 * covers ONLY the initial server render so the very first frame isn't blank —
 * navigation BETWEEN onboarding screens stays instant/preloaded as designed.
 *
 * Kept deliberately neutral — a centered wordmark + phone-frame placeholder +
 * progress dots — so it never clashes with the wizard's bespoke layout.
 */
export default function OnboardingLoading() {
  return (
    <main
      aria-busy="true"
      aria-live="polite"
      className="flex min-h-[100dvh] items-center justify-center px-4 py-6"
      style={{ background: 'var(--m-paper)' }}
    >
      <span className="sr-only">Loading…</span>
      <div className="flex w-full max-w-[420px] flex-col items-center gap-5">
        {/* Brand wordmark. */}
        <Sk className="h-6 w-32 rounded-md" />
        {/* Phone-frame card. */}
        <Sk className="h-[520px] max-h-[70dvh] w-full rounded-[28px]" />
        {/* Progress dots. */}
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Sk key={i} className="h-2 w-8 rounded-full" />
          ))}
        </div>
      </div>
    </main>
  );
}
