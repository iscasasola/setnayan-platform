'use client';

import { useEffect, useState } from 'react';
import { INSTALL_STEPS, installPlatform, type InstallPlatform } from '@/lib/event-app-icon';

/**
 * KEEP THIS WEDDING ON YOUR HOME SCREEN (owner 2026-09-20).
 *
 * A guest who installs gets an icon with the COUPLE'S mark that opens their
 * invitation directly — their seat, their QR, the schedule — with no link to
 * hunt for in a group chat six months later.
 *
 * WHY THIS IS A CLIENT COMPONENT AND WHY IT RENDERS NOTHING AT FIRST. The two
 * facts it needs exist only in the browser: the user agent, and whether this
 * tab is ALREADY the installed app (`display-mode: standalone`). Rendering on
 * the server would teach an installed guest to install again, which is the
 * most common way this pattern is shipped wrong.
 *
 * ANDROID GETS A BUTTON, iOS GETS WORDS — and that asymmetry is the platform's,
 * not a shortcut. Chrome fires `beforeinstallprompt`, which is the only way to
 * install without instructions; Safari has never fired it and never will, so an
 * iPhone is told exactly where the Share button is. An iOS browser that is NOT
 * Safari cannot install at all, so it is told to open the page in Safari rather
 * than being given steps that do not exist in its menu.
 */

type Choice = { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function KeepOnHomeScreen({ coupleName }: { coupleName: string }) {
  const [platform, setPlatform] = useState<InstallPlatform | null>(null);
  const [deferred, setDeferred] = useState<Choice | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches === true ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setPlatform(installPlatform({ userAgent: navigator.userAgent, standalone }));

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as unknown as Choice);
    };
    const onInstalled = () => setDone(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // Nothing until we know, and nothing at all for a guest who already has it —
  // including the one reading inside the installed app right now.
  if (platform === null || platform === 'installed' || done) return null;

  const steps = INSTALL_STEPS[platform];
  if (steps.length === 0) return null;

  return (
    <section className="space-y-3 border-l-2 border-gild bg-veil/50 p-4">
      {/* ⚠ NOT the protected 0.66rem gild eyebrow. That treatment marks a CHAPTER
          of the invitation and its count is pinned by
          `the-invitation-is-not-a-receipt.test.ts`; this is a utility card, and
          borrowing the chapter eyebrow would both misuse it and collide with
          any other branch that legitimately adds one. */}
      <p className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-ink/55">Keep it with you</p>
      <h3 className="font-pahina text-2xl font-light leading-snug tracking-tight text-ink">
        Put {coupleName} on your home screen
      </h3>
      <p className="max-w-prose text-sm leading-relaxed text-ink/70">
        You get an icon with their monogram. One tap opens this invitation — your seat, your QR and
        the schedule — without hunting for the link.
      </p>
      <ol className="space-y-1.5 text-sm text-ink/75">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden className="font-mono text-xs text-gild">
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      {deferred ? (
        <button
          type="button"
          onClick={async () => {
            try {
              await deferred.prompt();
              const choice = await deferred.userChoice;
              if (choice.outcome === 'accepted') setDone(true);
            } catch {
              // The prompt can only be used once; the written steps stay valid.
            }
            setDeferred(null);
          }}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-mulberry px-4 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-600"
        >
          Install
        </button>
      ) : null}
    </section>
  );
}
