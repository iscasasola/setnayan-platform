'use client';

/**
 * LabSubmitCatcher — the admin supplier lab has no sign-in and no database, so a press must not reach a real server
 * action. Every form submit on the page is caught BEFORE React's own handler (a window capture listener), and the
 * line at the bottom says which decision would have been sent and with what — so a walk can tap every control and
 * read that each one answered. DEV-ONLY (the lab 404s in production).
 */
import { useEffect, useState } from 'react';

export function LabSubmitCatcher() {
  const [said, setSaid] = useState<string | null>(null);
  useEffect(() => {
    const onSubmit = (e: Event) => {
      const form = e.target as HTMLFormElement | null;
      if (!form || form.tagName !== 'FORM') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const submitter = (e as SubmitEvent).submitter as HTMLElement | null;
      const data = new FormData(form, (e as SubmitEvent).submitter ?? undefined);
      const fields = [...data.entries()]
        .filter(([k]) => k !== 'back' && k !== 'return_to' && !k.startsWith('$ACTION'))
        .map(([k, v]) => `${k}=${String(v)}`)
        .join(' · ');
      const name =
        form.getAttribute('data-work-form') ??
        (form.hasAttribute('data-help-close') ? 'help-close' : form.hasAttribute('data-help-composer') ? 'help-reply' : 'form');
      setSaid(`✓ would send ${name}${submitter?.textContent ? ` (${submitter.textContent.trim()})` : ''}: ${fields}`);
    };
    window.addEventListener('submit', onSubmit, true);
    return () => window.removeEventListener('submit', onSubmit, true);
  }, []);
  return (
    <p role="status" data-lab-said="" className="fixed inset-x-0 top-0 z-[60] bg-ink px-4 py-1 text-[11px] text-cream opacity-90 pointer-events-none">
      {said ?? 'Lab — presses are caught here; nothing leaves this page.'}
    </p>
  );
}
