import { LANDING_WORDS, type InAppHandoff } from '@/lib/guest-landing';

/**
 * INSIDE MESSENGER / FACEBOOK / INSTAGRAM (owner 2026-09-30, DECISION_LOG "THE
 * PERSONAL LINK OPENS THE GUEST'S OWN LANDING PAGE"): their browser cannot be
 * forced out, and replying works in it — so nothing here blocks. It offers the
 * one tap out: Android jumps with an `intent://` (Chrome, or the Setnayan app
 * when it holds the link); iPhone gets "Open in Safari" and "Open in the
 * Setnayan app". Rendered ONLY for an in-app browser (`inAppHandoff` → 'none'
 * everywhere else, so every other guest's page is unchanged).
 */
export function InAppBar({ handoff }: { handoff: InAppHandoff }) {
  if (handoff.kind === 'none') return null;
  return (
    <div data-in-app-bar={handoff.kind} className="sn-glass-bare rounded-2xl p-3 text-sm text-ink/80 shadow-sm">
      <p>{LANDING_WORDS.inAppNote}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {handoff.kind === 'android' ? (
          <a href={handoff.href} className="inline-flex min-h-[44px] items-center rounded-full border border-ink/15 bg-cream px-4 font-medium text-ink">
            {LANDING_WORDS.openInBrowser}
          </a>
        ) : (
          <>
            <a href={handoff.safariHref} className="inline-flex min-h-[44px] items-center rounded-full border border-ink/15 bg-cream px-4 font-medium text-ink">
              {LANDING_WORDS.openInSafari}
            </a>
            <a href={handoff.appHref} className="inline-flex min-h-[44px] items-center rounded-full border border-ink/15 bg-cream px-4 font-medium text-ink">
              {LANDING_WORDS.openInApp}
            </a>
          </>
        )}
      </div>
    </div>
  );
}
