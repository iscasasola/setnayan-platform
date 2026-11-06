import { LANDING_WORDS, type InAppHandoff } from '@/lib/guest-landing';

/**
 * INSIDE MESSENGER / FACEBOOK / INSTAGRAM (owner 2026-09-30, DECISION_LOG "THE
 * PERSONAL LINK OPENS THE GUEST'S OWN LANDING PAGE"; the Fable frame 1b). Their
 * browser cannot be forced out, and replying works in it — so nothing here
 * blocks. A THIN BAR OF OURS at the very top, never over the page: iPhone reads
 * "Open in Safari to save your ticket · Open in the Setnayan app"; Android jumps
 * out with an `intent://` (Chrome, or the Setnayan app when it holds the link).
 * Rendered ONLY for an in-app browser (`inAppHandoff` → 'none' everywhere else,
 * so every other guest's page is unchanged).
 */
export function InAppBar({ handoff }: { handoff: InAppHandoff }) {
  if (handoff.kind === 'none') return null;
  // 👆 44 px presses in the SAME thin bar: the links take the bar's 12 px of padding (`py-0` below), so the bar stays
  // one 44 px line and each link is a full thumb tall (was 32 px — the Hub button walk, 2026-10-21).
  const link = 'inline-flex min-h-[44px] items-center underline underline-offset-[3px]';
  return (
    <nav
      aria-label="Open this page elsewhere"
      data-in-app-bar={handoff.kind}
      className="flex w-full flex-wrap items-center justify-center border-b border-ink/10 bg-[#F3EEE6] px-3.5 py-0 text-center text-xs font-medium leading-snug text-mulberry"
    >
      {handoff.kind === 'android' ? (
        <a href={handoff.href} className={link}>
          {LANDING_WORDS.inAppChrome}
        </a>
      ) : (
        <>
          <a href={handoff.safariHref} className={link}>
            {LANDING_WORDS.inAppSafari}
          </a>
          <span aria-hidden className="px-2 text-ink/70">
            ·
          </span>
          <a href={handoff.appHref} className={link}>
            {LANDING_WORDS.openInApp}
          </a>
        </>
      )}
    </nav>
  );
}
