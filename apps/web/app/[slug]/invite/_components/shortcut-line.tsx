import { HOME_SCREEN_LINE, homeScreenStepsFor } from '@/lib/home-screen-shortcut';

/**
 * 📌 THE ONE QUIET "SHORTCUT TO THIS EVENT" LINE (owner 2026-10-03, DECISION_LOG
 * "GUESTS GET ONE QUIET 'SHORTCUT TO THIS EVENT' LINE, ONLY AFTER THEY REPLY").
 *
 * Mounted ONCE, by the thank-you (`invite/enter/page.tsx`, after a Yes) and by
 * nothing else — `the-shortcut-line-is-on-the-thank-you-only.test.ts` holds
 * both. The steps for THIS phone (`homeScreenStepsFor`) open in place on a tap:
 * a `<details>`, a server component, no script — never a popup, nothing added
 * to the shared bundle. The tile the guest makes is the couple's because the
 * page names the per-event manifest and icon (`eventShortcutMetadata`).
 */
export function ShortcutLine({ userAgent }: { userAgent: string | null }) {
  return (
    <details className="text-center text-sm text-ink/70" data-landing-shortcut="">
      <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center underline decoration-ink/30 underline-offset-4 [&::-webkit-details-marker]:hidden">
        {HOME_SCREEN_LINE}
      </summary>
      <ul className="mt-1 space-y-1 text-xs text-ink/70">
        {homeScreenStepsFor(userAgent).map((s) => (
          <li key={s.phone} data-shortcut-steps={s.phone}>
            <span className="font-medium text-ink/80">{s.phone}:</span> {s.steps}
          </li>
        ))}
      </ul>
    </details>
  );
}
