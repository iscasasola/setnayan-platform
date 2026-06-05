'use client';

import { useEffect, useState } from 'react';

/**
 * LoadingStatus — a single status line that cycles through a list of messages
 * on a timer, so a loading screen *narrates what it's doing* instead of sitting
 * silent (owner 2026-06-05: "loading state tells what we are doing … downloading
 * your information, activating your personalized refinements").
 *
 * Behaviour:
 *   · Advances every `intervalMs` and HOLDS on the last message — no loop, so a
 *     slow load never looks like it restarted; the spinner beside it carries the
 *     "still working" signal.
 *   · Re-keys the <span> each step so the `.loading-status-line` entrance fade
 *     (globals.css) replays. Under prefers-reduced-motion the global block
 *     freezes the fade to an instant swap; the JS timer still advances the text
 *     (informative, not motion).
 *   · `aria-live="polite"` announces each step to assistive tech.
 *
 * Server components (route `loading.tsx` files) render this directly — it's the
 * one client island on an otherwise static loading shell.
 */
export function LoadingStatus({
  messages,
  intervalMs = 1400,
  className = '',
}: {
  messages: readonly string[];
  intervalMs?: number;
  className?: string;
}) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (i >= messages.length - 1) return;
    const t = setTimeout(
      () => setI((n) => Math.min(n + 1, messages.length - 1)),
      intervalMs,
    );
    return () => clearTimeout(t);
  }, [i, messages.length, intervalMs]);

  return (
    <span
      key={i}
      className={`loading-status-line ${className}`.trim()}
      aria-live="polite"
    >
      {messages[i] ?? ''}
    </span>
  );
}

/**
 * LoadingNarration — a centred "what we're doing" strip: a small gold spinner +
 * a cycling <LoadingStatus>. The drop-in way to narrate any route's loading.tsx
 * (owner 2026-06-05) on top of its page-shaped skeleton. The spinner uses
 * `--m-orange` (Royal Champagne Gold) with a fallback, and is frozen to a static
 * ring under prefers-reduced-motion by the global a11y block.
 */
export function LoadingNarration({
  messages,
  className = '',
}: {
  messages: readonly string[];
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-center gap-2.5 ${className}`.trim()}>
      <span
        aria-hidden
        className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-ink/15 border-t-[var(--m-orange,#C5A059)]"
      />
      <LoadingStatus
        className="text-[13px] font-semibold text-ink/70"
        messages={messages}
      />
    </div>
  );
}
