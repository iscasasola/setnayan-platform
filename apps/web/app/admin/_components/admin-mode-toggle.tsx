'use client';

/**
 * AdminModeToggle — the top bar's Focus | Full switch (owner approved 14 Nov 2026, DECISION_LOG "ADMIN FOCUS | FULL —
 * APPROVED (v6)" (1)): icons only on a phone (a search bar = Focus, stacked rows = Full), icon + word from the dock
 * point up; the filled half is the mode you are in. Admin opens in Focus.
 *
 * The choice is a cookie the layout reads on the next render (`lib/admin/admin-mode.ts`), so the server draws the
 * right shell with no flash and no server action. Both halves are real links to /admin as well, so a press with no
 * script still lands somewhere sensible.
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactElement } from 'react';
import { Rows3 } from 'lucide-react';
import { ADMIN_MODE_COOKIE, ADMIN_MODE_MAX_AGE, type AdminMode } from '@/lib/admin/admin-mode';

/** A search BAR (a pill with a magnifier) — the prototype's Focus icon; lucide has a magnifier, not a bar. */
function SearchBarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <rect x="1.5" y="6.5" width="21" height="11" rx="5.5" />
      <circle cx="7" cy="11.5" r="2.2" />
      <path d="M8.6 13.1l1.6 1.6M13 12h6" />
    </svg>
  );
}

const HALVES: ReadonlyArray<{ mode: AdminMode; label: string; Icon: (p: { className?: string }) => ReactElement }> = [
  { mode: 'focus', label: 'Focus', Icon: SearchBarIcon },
  { mode: 'full', label: 'Full', Icon: ({ className }) => <Rows3 aria-hidden className={className} strokeWidth={1.9} /> },
];

export function AdminModeToggle({ mode }: { mode: AdminMode }) {
  const router = useRouter();
  const choose = (next: AdminMode) => {
    try {
      document.cookie = `${ADMIN_MODE_COOKIE}=${next}; path=/; max-age=${ADMIN_MODE_MAX_AGE}; samesite=lax`;
    } catch {
      /* A refused cookie only means the choice is not remembered; the link below still lands. */
    }
    router.push('/admin');
    // one-render: keep (navigation) — it follows a cookie written in the browser and a push to /admin; no server action answered with a render.
    router.refresh();
  };
  return (
    <div
      role="group"
      aria-label="Mode"
      className="inline-flex shrink-0 gap-0.5 rounded-full p-[3px]"
      style={{ background: 'var(--sn-paper)' }}
      data-admin-mode={mode}
    >
      {HALVES.map(({ mode: m, label, Icon }) => {
        const on = m === mode;
        return (
          <Link
            key={m}
            href="/admin"
            aria-pressed={on}
            aria-label={label}
            title={label}
            onClick={(e) => {
              e.preventDefault();
              // Pressing the half you are already in goes back to that mode's home, at the top (owner 18 Nov:
              // "double tapping focus … should have brought me back to the focus' main page").
              if (on) {
                router.push('/admin');
                try { window.scrollTo({ top: 0 }); } catch { /* no window: the push still lands */ }
                return;
              }
              choose(m);
            }}
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-3 text-[13px] font-semibold"
            style={
              on
                ? { background: 'rgb(var(--sn-accent))', color: 'rgb(var(--sn-on-accent))' }
                : { color: 'var(--sn-ink-500)' }
            }
          >
            <Icon className="h-[22px] w-[22px] shrink-0" />
            <span className="hidden lg:inline">{label}</span>
          </Link>
        );
      })}
    </div>
  );
}
