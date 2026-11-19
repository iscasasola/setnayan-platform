'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { RiseScreen } from '@/app/_components/rise/rise-screen';

/**
 * ⤴ A THREAD TOOL THAT IS A FORM RISES FULL SCREEN, ABOVE THE COMPOSER (CHAT-18, W1 walk 16 Nov 2026).
 *
 * Measured live: "Answer their booking ask" opened in the tray UNDER the message box — about half the screen, with
 * ＋ / lock / Message / Send drawn above it. A form to fill rises full screen (DECISION_LOG 2026-11-10 "RISE FULL SCREEN
 * IS THE NAME; FULL SCREEN EVERYTHING"; the 2026-11-12 half-height row is for pop-up pickers and menus, like the ＋).
 *
 * The `<details id data-thread-tool>` stays — it is the contract with `revealThreadTool` (the ＋ row, the pin, the
 * blocker all open a tool by id) — but it is never drawn: its opening raises the shared `RiseScreen` instead, and the
 * screen's ✕ shuts it again, so "one tool at a time" still holds.
 */
export function ThreadToolRise({
  id,
  label,
  hint,
  open = false,
  children,
}: {
  id: string;
  label: string;
  hint: string;
  open?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement | null>(null);
  const [risen, setRisen] = useState(open);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onToggle = () => setRisen(el.open);
    el.addEventListener('toggle', onToggle);
    return () => el.removeEventListener('toggle', onToggle);
  }, []);

  return (
    <>
      <details ref={ref} id={id} data-thread-tool data-thread-tool-rise open={open || undefined} hidden aria-hidden>
        <summary>{label}</summary>
      </details>
      {risen ? (
        <RiseScreen
          title={label}
          line={hint}
          data={`thread-tool-${id}`}
          onClose={() => {
            if (ref.current) ref.current.open = false;
            setRisen(false);
          }}
        >
          {children}
        </RiseScreen>
      ) : null}
    </>
  );
}
