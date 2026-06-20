import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

/**
 * BackButton — the single shared "back" affordance.
 *
 * WHY: the 2026-06-20 user-flow audit found back navigation drawn ~95 different
 * ways — `ArrowLeft` (×80 files) vs `ChevronLeft` (×15), with gap 1/1.5/2/3,
 * text xs/sm/base, and ink/50–85 all mixed (the classic "same control, designed
 * differently" tell). This standardises on ONE icon, size, spacing, tap target,
 * and tint. Every "Back to X" link should use it.
 *
 * Href-only by design — the audit found 0 `router.back()` back buttons; every
 * back affordance points at a known destination. Plain <Link>, so it works in
 * server and client components alike. `min-h-[44px]` keeps the tap target ≥44px
 * (mobile). Pass `className` to nudge layout (e.g. drop the default `mb-4`).
 */
export function BackButton({
  href,
  label = 'Back',
  className = '',
}: {
  href: string;
  label?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`mb-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-sm font-medium text-ink/70 transition-colors hover:bg-ink/10 hover:text-ink ${className}`}
    >
      <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={2} />
      {label}
    </Link>
  );
}
