'use client';

/**
 * toast-provider.tsx — the app's single success/error/info toast primitive.
 *
 * WHY: the 2026-06-20 product-wide user-flow audit found "feedback" is the
 * dominant defect class (79/250 findings) — actions across the app silently
 * succeed or fail with no confirmation. `SubmitButton` already covers the
 * PENDING state well; this covers the SUCCESS/ERROR state. Zero-dependency
 * (no sonner) per the OSS/self-host preference, extracting the ad-hoc
 * role="status" pattern that was copy-pasted across ~15 components into one
 * shared, accessible primitive.
 *
 * USAGE (client components):
 *   const toast = useToast();
 *   toast.success('Saved.');  toast.error('Could not save — try again.');
 *
 * For server-action <form action={…}> flows that can't call a hook, redirect
 * with `?saved=1` (or `?error=…`) and let <ToastFromParams> fire the toast —
 * see toast-from-params.tsx.
 *
 * Mounted once in app/providers.tsx so it wraps every surface (avoids the
 * contended root layout.tsx). Accessible: container is role="status"
 * aria-live="polite"; each toast is dismissible; auto-clears after 5s.
 *
 * 🎞 ONE PILL, FROM THE BOTTOM (owner 18 Nov 2026, the motion standard § 4 #5): this is the SAME pill as
 * `peek-toast.tsx` — its shape, its three tones, its words — in the same place (above the thumb row or the bottom
 * nav, `.sn-m-toast-place` → `--sn-thumb-clear`) with the same motion (`.sn-m-toast`: in Move on Spring from below,
 * out Quick on Settle). It was a bordered row at `bottom-4` rising on `sn-rise 320ms`.
 * 🔒 lib/the-toast-rises-from-the-bottom.test.ts
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, Info, TriangleAlert, X } from 'lucide-react';
import { QUICK_MS } from '@/lib/motion-table';
import { PEEK_TOAST_MOTION, PEEK_TOAST_PILL, PEEK_TOAST_TONE, PEEK_TOAST_WORDS, type PeekToastTone } from './peek-toast';

type ToastVariant = 'success' | 'error' | 'info';
type ToastItem = { id: number; variant: ToastVariant; message: string; leaving?: boolean };

export type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastApi | null>(null);
const AUTO_DISMISS_MS = 5000;

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider> (mounted in app/providers.tsx)');
  return ctx;
}

// The pill's three tones (peek-toast.tsx): a good result is the accent with a ✓, a failure the darkened danger token
// with a warning mark (never only a colour), a note the quiet card with an ⓘ.
const VARIANT: Record<ToastVariant, { Icon: typeof Check; tone: PeekToastTone }> = {
  success: { Icon: Check, tone: 'ok' },
  error: { Icon: TriangleAlert, tone: 'bad' },
  info: { Icon: Info, tone: 'note' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  // Leaving is two steps: it sinks back (Quick on Settle, `data-leaving`), then it is taken off the page.
  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), QUICK_MS + 40);
  }, []);

  const push = useCallback(
    (variant: ToastVariant, message: string) => {
      if (!message) return;
      seq.current += 1;
      const id = seq.current;
      // W1-B42 (live walk, 18 Nov 2026): three failed sends stacked three identical errors over the bottom nav. The
      // same words replace the earlier copy instead of stacking under it.
      setToasts((list) => [...list.filter((t) => t.variant !== variant || t.message !== message), { id, variant, message }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        role="status"
        aria-live="polite"
        data-toasts=""
        className="sn-m-toast-place pointer-events-none fixed inset-x-0 z-[100] flex flex-col items-center gap-2 pl-[max(0.75rem,var(--sn-safe-l))] pr-[max(0.75rem,var(--sn-safe-r))]"
      >
        {toasts.map(({ id, variant, message, leaving }) => {
          const { Icon, tone } = VARIANT[variant];
          return (
            <div
              key={id}
              data-toast={variant}
              data-leaving={leaving ? '' : undefined}
              className={`${PEEK_TOAST_MOTION} ${PEEK_TOAST_PILL} ${PEEK_TOAST_TONE[tone]} pointer-events-auto !pl-[18px] !pr-1`}
            >
              <Icon aria-hidden className="h-[18px] w-[18px] flex-none" strokeWidth={2.4} />
              <span className={PEEK_TOAST_WORDS}>{message}</span>
              <button
                type="button"
                onClick={() => dismiss(id)}
                aria-label="Dismiss"
                className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-full opacity-70 hover:opacity-100"
              >
                <X aria-hidden className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
