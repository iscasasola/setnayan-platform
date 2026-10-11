'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type FormEvent,
  type ReactNode,
} from 'react';
import { unstable_rethrow } from 'next/navigation';
import { SubmitButton } from '@/app/_components/submit-button';
import { REPLY_NOT_SENT, makeReplySender } from '@/lib/reply-send';
import { MOBILE_NEEDED, mobileIsEnough, mobileNeededForPress } from '@/lib/mobile-number';

/**
 * THE REPLY CARD'S `<form>` — the same element, with the press caught.
 * (lib/reply-send.ts has the story and the three outcomes.)
 *
 * 🧾 IT DRAWS EXACTLY WHAT THE CARD DREW. One `<form>` with the attributes it
 * is given, its children, and NOTHING else until a send fails — so the card's
 * HTML is the recorded bytes (`the-reply-card-is-todays-page.test.ts`) and its
 * layout does not move. Only a failed send adds one line, under the button.
 *
 * 🔌 WITHOUT JAVASCRIPT IT IS STILL THE PLAIN FORM. `action` stays the server
 * action on the element itself, so the browser posts it with no script at all
 * (a server action handed to a client component keeps its form encoding when
 * the page is rendered on the server — seen in the served HTML: `method="POST"`
 * and the `$ACTION_…` fields). `onSubmit` only exists once hydrated.
 *
 * ── HOW THE PRESS IS CAUGHT, AND WHY IT IS NOT A TRANSITION ────────────────
 * `onSubmit` prevents React's own run of the action and runs it itself,
 * awaited in a try (`makeReplySender`). The pending state is THIS component's
 * (`sending`), handed to the card's button through `ReplySubmit`.
 *
 * ⚠ IT WAS FIRST BUILT ON `useTransition` + `useFormStatus`, AND THAT COULD NOT
 * END ON A TIME LIMIT. Seen in a real browser (2026-10-11, the dev lab's reply
 * sheet, a request that never answers): at 20 s the "not sent" line appeared —
 * and the "Saving" veil was still over it, the button still disabled. React
 * ties a form's pending status to the WHOLE async action, and Next sends a
 * server action inside a transition of its own, so the status cannot end
 * before the request does. Two things follow, and both are load-bearing:
 *
 *   1 · the send is NOT started inside a transition, and
 *   2 · it is started one task AFTER the submit event (`setTimeout 0`). Next's
 *       own transition, begun during the event, is what makes React mark the
 *       form pending for a prevented submit — a status only the request can
 *       end. Started a task later, the form never enters it.
 *
 * NEXT'S OWN SIGNALS. A landed reply answers with a REDIRECT. By the time the
 * call rejects with Next's redirect error, Next has already applied the
 * navigation itself — so the error is NOT thrown back into React: doing that
 * from here (a second, urgent update racing the navigation's own commit) left
 * a BLANK PAGE after a landed reply, with React failing to remove a node (seen
 * in the browser against a real redirecting action, 2026-10-11; the plain form
 * on the same page landed fine). The form only ends its own "Sending…". A
 * not-found — the one other signal — is kept in state and thrown in render for
 * Next's boundary.
 */

/** Next's redirect, as a rejected server action carries it (`digest: 'NEXT_REDIRECT;…'`). */
function isRedirectSignal(thrown: unknown): boolean {
  const digest = (thrown as { digest?: unknown } | null)?.digest;
  return typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT');
}

/** `rsvp_status` as this press would send it (the pressed button's own value included). */
function answerOf(form: HTMLFormElement, submitter: HTMLElement | null): string | null {
  let data: FormData;
  try {
    data = new FormData(form, submitter);
  } catch {
    data = new FormData(form);
  }
  const answer = data.get('rsvp_status');
  return typeof answer === 'string' ? answer : null;
}

/** `true`/`false` inside a `ReplyForm`; `null` outside one (the button then reads React's form status). */
const ReplySending = createContext<boolean | null>(null);

export function ReplyForm({
  action,
  children,
  ...rest
}: {
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  className?: string;
} & Record<`data-${string}`, string | boolean | undefined>) {
  const [sending, setSending] = useState(false);
  const [notSent, setNotSent] = useState(false);
  /** A yes with no usable mobile number: nothing is sent, and the form says why (lib/mobile-number.ts). */
  const [mobileNeeded, setMobileNeeded] = useState(false);
  const [signal, setSignal] = useState<{ thrown: unknown } | null>(null);
  const sender = useRef<ReturnType<typeof makeReplySender> | null>(null);
  if (!sender.current) sender.current = makeReplySender({ rethrow: unstable_rethrow });
  const pressed = useRef(false);
  const line = useRef<HTMLParagraphElement>(null);
  // Set on every mount, not only cleared on unmount: React's development
  // double-mount runs the cleanup once, and a ref that is only ever cleared
  // would leave the form unable to end its own "Sending…" (seen in the lab).
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // The line appears under the button the guest just pressed; make sure it is
  // on screen (a sheet's own scroller, a phone's home bar) without moving a
  // page that already shows it.
  useEffect(() => {
    if (notSent || mobileNeeded) line.current?.scrollIntoView({ block: 'nearest' });
  }, [notSent, mobileNeeded]);

  // Next's not-found (never its redirect — see above), handed to its boundary.
  if (signal) throw signal.thrown;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    /* 📱 A YES NEEDS A NUMBER OF AT LEAST SEVEN DIGITS (owner 2026-10-11). Whether
       THIS press needs one is read off what the card already shows — the box is
       `required`, or the answer is a yes and the card marks Mobile "(required)"
       for a yes (`mobileNeededForPress`, lib/mobile-number.ts, which says why it
       is not the `required` property alone). Nothing is sent, the form is
       untouched, and the reason is said under the button in the words the server
       uses for the same refusal. */
    const mobile = e.currentTarget.querySelector<HTMLInputElement>('input[name="contact_mobile"]:not([type="hidden"])');
    const needed =
      mobile !== null &&
      mobileNeededForPress({
        answer: answerOf(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter),
        boxRequired: mobile.required,
        markedRequiredForYes: e.currentTarget.querySelector('label[for="contact_mobile"] .attend-mark') !== null,
      });
    if (mobile && needed && !mobileIsEnough(mobile.value)) {
      setNotSent(false);
      setMobileNeeded(true);
      mobile.focus();
      return;
    }
    setMobileNeeded(false);
    const send = sender.current!;
    // A second press while one is out sends nothing. `pressed` is set HERE,
    // synchronously — state would still read "not sending" for a second submit
    // in the same frame, and the sender is not busy until its task runs.
    if (pressed.current || send.busy()) return;
    pressed.current = true;
    const form = e.currentTarget;
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    let data: FormData;
    try {
      data = new FormData(form, submitter);
    } catch {
      data = new FormData(form);
    }
    setNotSent(false);
    setSending(true);
    // One task later, and outside any transition — see the note above.
    window.setTimeout(() => {
      void send
        .press(async () => action(data))
        .then(
          (outcome) => {
            pressed.current = false;
            if (!mounted.current) return;
            if (outcome === 'not_sent') setNotSent(true);
            setSending(false);
          },
          (thrown: unknown) => {
            pressed.current = false;
            if (!mounted.current) return;
            // A redirect: the reply landed and Next has ALREADY applied the
            // navigation. Nothing to throw — only the pending state to end
            // (the redirect may land on this same page, with its flash line).
            if (isRedirectSignal(thrown)) setSending(false);
            else setSignal({ thrown });
          },
        );
    }, 0);
  }

  return (
    <ReplySending.Provider value={sending}>
      <form action={action} onSubmit={onSubmit} {...rest}>
        {children}
        {notSent ? (
          <p ref={line} role="alert" data-reply-not-sent="" className="scroll-mb-6 text-sm font-medium text-terracotta-700">
            {REPLY_NOT_SENT}
          </p>
        ) : null}
        {mobileNeeded && !notSent ? (
          <p ref={line} role="alert" data-reply-mobile-needed="" className="scroll-mb-6 text-sm font-medium text-terracotta-700">
            {MOBILE_NEEDED}
          </p>
        ) : null}
      </form>
    </ReplySending.Provider>
  );
}

/**
 * The reply card's button: the app's `SubmitButton`, told when THIS form is
 * sending. Same markup, same "Sending…", same veil — but both end when the
 * send settles OR its time limit passes, whichever is first. Outside a
 * `ReplyForm` it is `SubmitButton`, unchanged.
 */
export function ReplySubmit(props: Omit<ComponentProps<typeof SubmitButton>, 'pending'>) {
  const sending = useContext(ReplySending);
  return <SubmitButton {...props} pending={sending ?? undefined} />;
}
