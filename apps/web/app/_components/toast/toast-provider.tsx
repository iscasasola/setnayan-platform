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
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type ToastVariant = 'success' | 'error' | 'info';
type ToastItem = { id: number; variant: ToastVariant; message: string };

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

const VARIANT = {
  success: { Icon: CheckCircle2, tint: 'text-success-700', ring: 'border-success-700/30' },
  error: { Icon: AlertCircle, tint: 'text-danger-700', ring: 'border-danger-700/30' },
  info: { Icon: Info, tint: 'text-ink/70', ring: 'border-ink/15' },
} as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (variant: ToastVariant, message: string) => {
      if (!message) return;
      seq.current += 1;
      const id = seq.current;
      setToasts((list) => [...list, { id, variant, message }]);
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
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4"
      >
        {toasts.map(({ id, variant, message }) => {
          const { Icon, tint, ring } = VARIANT[variant];
          return (
            <div
              key={id}
              className={`pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-lg border bg-paper px-3.5 py-2.5 text-sm text-ink shadow-md ${ring}`}
            >
              <Icon aria-hidden className={`mt-0.5 h-4 w-4 shrink-0 ${tint}`} strokeWidth={2} />
              <span className="flex-1 leading-snug">{message}</span>
              <button
                type="button"
                onClick={() => dismiss(id)}
                aria-label="Dismiss"
                className="-mr-1 -mt-0.5 rounded-md p-1 text-ink/40 hover:bg-ink/5 hover:text-ink/70"
              >
                <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
