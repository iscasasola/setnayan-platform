'use client';

/**
 * UseEmailFold — on the sign-in and create-account cards, the email + password half waits behind a quiet "Use email"
 * under Google and Apple (owner 24 Nov 2026, DECISION_LOG "Sign in and Create account: simple, dark, a forming logo":
 * "The email and password boxes stay hidden until 'Use email' is tapped").
 *
 * A NATIVE `<details>` is the switch, so it opens server-rendered and with no JavaScript at all. The email half is its
 * next SIBLING, not its content: a closed `<details>` does not lay out what it holds, and the half carries the
 * Turnstile widget, which must render (and solve in the background) before the person ever taps Continue. So the half
 * is always rendered and is only folded by CSS (`.hr-si-fold:not([open]) + .hr-si-email`, home-reskin.css):
 * `visibility: hidden` and no height — nothing in it can be focused or read until it opens. Opening hides "Use email"
 * and shows "or" and the fields.
 *
 * `fold` false (Google / Apple not shown on this shell) → no switch at all, the fields simply show, as before.
 * `open` → it starts open: there is something to show or keep (an error, an address already typed or recalled, an
 * "account ready" line). Once open it stays open for the life of the card — clearing the box never folds it away.
 */
import { useRef, useState, type ReactNode } from 'react';
import { Mail } from 'lucide-react';

export function UseEmailFold({ fold, open, children }: { fold: boolean; open: boolean; children: ReactNode }) {
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);
  const pressed = useRef(false);
  if (!fold) return <>{children}</>;
  return (
    <>
      <details
        className="hr-si-fold"
        open={opened || undefined}
        onToggle={(e) => {
          const d = e.currentTarget;
          if (!d.open || !pressed.current) return;
          pressed.current = false;
          // The switch hides itself once open, so the press would leave focus nowhere: hand it to the first box.
          const first = d.nextElementSibling?.querySelector<HTMLInputElement>('input:not([type="hidden"])');
          first?.focus({ preventScroll: true });
        }}
      >
        <summary
          className="hr-si-use-email"
          onClick={() => {
            pressed.current = true;
          }}
        >
          <Mail aria-hidden size={18} strokeWidth={1.8} />
          Use email
        </summary>
      </details>
      <div className="hr-si-email" data-email-fold="">
        <div className="hr-si-or">
          <span>or</span>
        </div>
        {children}
      </div>
    </>
  );
}
