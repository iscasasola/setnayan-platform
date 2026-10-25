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
 *
 * ⚡ `autosave` (Studio › Prints, owner 2026-10-21 *"why is there a save here? when any press changes it right away?"*): the form has
 * NO Save button — a person's change to any of ITS fields (wherever the field is drawn, joined by `form=`) submits it: a press at once,
 * typing after a pause (`armPrintWordsAutosave`, `lib/print-words-autosave.ts` — loaded only when `autosave`, so the shipped Maker's
 * first load never carries it). The submit is the form's own (`requestSubmit`), so it is this same handler — the same post to the same
 * route — and one post at a time: a change made while one is in flight is sent once more after it lands.
 * Off (the shipped Maker), the form posts only when its Save is pressed, as it always did.
 */
export function SoftPost({ autosave = false }: { autosave?: boolean } = {}) {
  const router = useRouter();
  const ref = useRef<HTMLSpanElement>(null);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    const form = ref.current?.closest('form');
    if (!form) return;
    /* The one post (named for the Maker-save guard's listed exception: what the couple pressed or typed IS the visible change). */
    const onSubmit = () => {
      setState('saving');
      announceMakerSave({ state: 'saving' });
      const body = new FormData(form);
      return makerSave(
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
        // one-render: keep (batched) — a Maker draft save goes through `lib/maker-refresh.ts`, which refreshes ONCE after the last save in flight; draft intents revalidate nothing.
        () => router.refresh(),
      ).catch(() => ({ ok: false }));
    };
    const done = (r: { ok: boolean }) => {
      setState(r.ok ? 'saved' : 'error');
      announceMakerSave(r.ok ? { state: 'saved' } : { state: 'error', text: 'That did not save. Nothing changed — please try again.' });
    };
    /* ⚡ Autosave: the gated submit (one post at a time) and its document listeners, from the lazy module. Until it lands, a submit
       posts directly. */
    let gated: (() => void) | null = null;
    let stop = () => {};
    let gone = false;
    if (autosave) {
      void import('@/lib/print-words-autosave').then((m) => {
        if (gone) return;
        const armed = m.armPrintWordsAutosave(form, onSubmit, done);
        gated = armed.submit;
        stop = armed.stop;
      });
    }
    const onSubmitEvent = (e: SubmitEvent) => {
      e.preventDefault();
      if (gated) gated();
      else void onSubmit().then(done);
    };
    form.addEventListener('submit', onSubmitEvent);
    return () => {
      gone = true;
      form.removeEventListener('submit', onSubmitEvent);
      stop();
    };
  }, [router, autosave]);

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
