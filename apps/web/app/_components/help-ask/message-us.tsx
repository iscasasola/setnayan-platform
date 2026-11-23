'use client';

/**
 * 💬 MESSAGE US — ONE ROW (the Guide & Help drawing, owner "Approved" 21 Nov 2026: *"The Message us form on the page
 * becomes one row."*). The row opens THE floating surface (`Sheet`), and the shipped form (`submitHelpMessage`, drawn
 * on the server and handed in as `children`) sits inside it — the same fields, the same action, no new writer.
 *
 * Every old way to the form still opens it: an answer's "Message us" (`#contact`), a door that pre-fills it
 * (`?subject=…&body=…&topic=…`, the Card Maker's "Need your own form?") and a send that came back with an error
 * (`startOpen`). The hash is taken off when the sheet closes, so the next press opens it again.
 */
import { useCallback, useEffect, useId, useState, type ReactNode } from 'react';
import { MessageCircle } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { HelpRow, HelpRows } from './help-rows';

const HASH = '#contact';

export function MessageUs({ children, startOpen = false, title }: { children: ReactNode; startOpen?: boolean; title: string }) {
  const [open, setOpen] = useState(startOpen);
  const headingId = useId();

  useEffect(() => {
    if (window.location.hash === HASH) setOpen(true);
    const onHash = () => {
      if (window.location.hash === HASH) setOpen(true);
    };
    // A same-page link to #contact (an answer's "Message us") is a client navigation that fires no `hashchange` — so the
    // press itself opens the sheet.
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href]');
      if (!(a instanceof HTMLAnchorElement)) return;
      const to = new URL(a.href, window.location.href);
      if (to.hash !== HASH || to.pathname !== window.location.pathname) return;
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener('hashchange', onHash);
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('hashchange', onHash);
      document.removeEventListener('click', onClick);
    };
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    if (window.location.hash === HASH) {
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    }
  }, []);

  return (
    <>
      <div className="mt-4" id="contact" data-help-contact="">
        <HelpRows data="message-us">
          <HelpRow icon={MessageCircle} title="Message us" line="A person from Setnayan replies." onClick={() => setOpen(true)} data="message-us" />
        </HelpRows>
      </div>
      <Sheet open={open} onClose={close} labelledById={headingId}>
        <div className="px-4 pb-6 pt-1" data-help-message-sheet="">
          <h2 id={headingId} className="text-sn-xl font-semibold text-ink">
            {title}
          </h2>
          <p className="mt-1 text-sn-base text-ink/65">A person replies by email.</p>
          <div className="mt-4">{children}</div>
        </div>
      </Sheet>
    </>
  );
}
