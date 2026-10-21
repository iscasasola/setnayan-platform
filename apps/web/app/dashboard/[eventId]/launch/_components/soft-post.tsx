'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { announceMakerSave } from '@/lib/maker-save-status';
import { makerSave } from '@/lib/maker-refresh';
import { oneAtATime, printWordsAutosaveWait } from '@/lib/print-words-autosave';

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
 * typing after a pause (`lib/print-words-autosave.ts`). The submit is the form's own (`requestSubmit`), so it is this same handler —
 * the same post to the same route — and one post at a time: a change made while one is in flight is sent once more after it lands.
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
    const send = oneAtATime<{ ok: boolean }>(onSubmit, (r) => {
      setState(r.ok ? 'saved' : 'error');
      announceMakerSave(r.ok ? { state: 'saved' } : { state: 'error', text: 'That did not save. Nothing changed — please try again.' });
    });
    const onSubmitEvent = (e: SubmitEvent) => {
      e.preventDefault();
      send();
    };
    form.addEventListener('submit', onSubmitEvent);
    /* ⚡ A person's change to one of this form's fields posts it — on the document, because a field joined by `form=` is drawn
       elsewhere (⚙ Print settings is on `<body>`) and its events bubble there, not to the form. */
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onEdit = (e: Event) => {
      const wait = printWordsAutosaveWait(e.type, e.target, form);
      if (wait === null) return;
      clearTimeout(timer);
      timer = setTimeout(() => form.requestSubmit(), wait);
    };
    if (autosave) {
      document.addEventListener('input', onEdit);
      document.addEventListener('change', onEdit);
    }
    return () => {
      form.removeEventListener('submit', onSubmitEvent);
      document.removeEventListener('input', onEdit);
      document.removeEventListener('change', onEdit);
      clearTimeout(timer);
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
