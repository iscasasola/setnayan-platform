'use client';

/**
 * Per-session dismissible client shell for `<DemoModeBanner>`.
 *
 * The server component decides whether to render at all (admin +
 * cookie set). This client piece adds the dismiss interaction and
 * persists the dismissed state in `sessionStorage` so a hard reload
 * keeps it dismissed until the admin signs out or closes the tab.
 *
 * Dismissing the banner does NOT turn demo mode off — the cookie
 * remains live so demo vendors keep surfacing on /vendors and
 * /v/[slug]. To turn demo mode off entirely, the admin uses the
 * toggle at /admin/settings/demo-mode.
 */

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const SESSION_DISMISS_KEY = 'setnayan_demo_mode_banner_dismissed';

export function DemoModeBannerClient({
  deadlineLabel,
}: {
  deadlineLabel: string;
}) {
  // Default to "visible" so SSR + first paint never flash the
  // banner in then-out — the dismissed state is applied after
  // hydration if it was set.
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_DISMISS_KEY) === '1') {
        setDismissed(true);
      }
    } catch {
      // Private mode / storage disabled — treat as not dismissed.
    }
  }, []);

  function onDismiss() {
    setDismissed(true);
    try {
      sessionStorage.setItem(SESSION_DISMISS_KEY, '1');
    } catch {
      // No-op; banner stays hidden in-memory regardless.
    }
  }

  if (dismissed) return null;

  return (
    <aside
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 border-b border-amber-300 bg-amber-50/95 px-4 py-2 text-[12px] text-amber-900 backdrop-blur"
    >
      <div className="mx-auto flex w-full max-w-6xl items-start justify-between gap-3 sm:items-center">
        <p className="text-amber-900">
          <span className="font-semibold uppercase tracking-[0.12em]">Demo mode active</span>{' '}
          <span className="text-amber-800/85">
            — synthetic vendors are visible with pricing on display. Real-vendor
            posture is unchanged. Demo data must be cleaned out before {deadlineLabel}.
          </span>
        </p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss demo-mode banner for this session"
          className="shrink-0 rounded-full p-1 text-amber-800/70 hover:bg-amber-100 hover:text-amber-900"
        >
          <X aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>
    </aside>
  );
}
