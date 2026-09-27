'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { announceMakerSave } from '@/lib/maker-save-status';
import { makerSave } from '@/lib/maker-refresh';

/**
 * 🧷 A PLAIN FORM THAT SAVES WITHOUT LEAVING THE PAGE.
 *
 * Owner, 2026-09-28: *"a lot of times. it reloads the whole page. which
 * shouldn't"*. Details' "what the prints include" form posts to an API route
 * (`/api/hub-print/words`), which answered with a 303 back to the Maker — a
 * real browser navigation: the whole document, every script and the canvas
 * loaded again from nothing, for one tick.
 *
 * Rendered INSIDE that form, this takes over its submit: the same fields go to
 * the same address with `Accept: application/json`, the route answers `{ ok }`
 * instead of redirecting, and the Maker refreshes its data in place (once,
 * `lib/maker-refresh.ts`) — the page never unloads. The form itself is
 * untouched, so without JavaScript it still posts and comes back as before.
 */
export function SoftPost() {
  const router = useRouter();
  const ref = useRef<HTMLSpanElement>(null);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    const form = ref.current?.closest('form');
    if (!form) return;
    const onSubmit = (e: SubmitEvent) => {
      e.preventDefault();
      setState('saving');
      announceMakerSave({ state: 'saving' });
      const body = new FormData(form);
      void makerSave(
        async () => {
          const res = await fetch(form.action, {
            method: 'POST',
            body,
            credentials: 'same-origin',
            headers: { accept: 'application/json' },
          });
          const data = (await res.json().catch(() => null)) as { ok?: unknown } | null;
          return { ok: res.ok && data?.ok === true };
        },
        () => router.refresh(),
      )
        .catch(() => ({ ok: false }))
        .then((r) => {
          setState(r.ok ? 'saved' : 'error');
          announceMakerSave(
            r.ok ? { state: 'saved' } : { state: 'error', text: 'That did not save. Nothing changed — please try again.' },
          );
        });
    };
    form.addEventListener('submit', onSubmit);
    return () => form.removeEventListener('submit', onSubmit);
  }, [router]);

  return (
    <span
      ref={ref}
      role="status"
      aria-live="polite"
      data-soft-post={state}
      className={`text-xs ${state === 'error' ? 'text-terracotta-700' : 'text-ink/65'}`}
    >
      {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved.' : state === 'error' ? 'That did not save. Nothing changed — please try again.' : null}
    </span>
  );
}
