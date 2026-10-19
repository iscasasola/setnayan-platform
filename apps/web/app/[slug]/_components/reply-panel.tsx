'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sheet } from '@/app/_components/sheet';
import { REPLY_PANEL_MEDIA, opensInReplyPanel, repliedHref, replyPanelStep } from '@/lib/guest-reply-panel';
import { EDITOR_CANVAS_HIDES_APP_CHROME } from '../_lib/editor-canvas';

/**
 * 🖥 THE GUEST'S REPLY, IN THE SIDE PANEL — on a desktop, behind the desk gate (DECISION_LOG 2026-10-19 "FIVE
 * CONTROLLER RECOMMENDATIONS APPROVED" (3); the decisions are `lib/guest-reply-panel.ts`).
 *
 * Mounted by the guest page ONLY where it writes the desk style (`guestDesk`), so with the gate off this file is not
 * on the page and every Reply is the plain link it is today. Mounted, it draws nothing until a Reply is pressed at a
 * desktop width; under 1024 px the press is left alone and the link goes to the reply page, as now.
 *
 * 🔑 IT DRAWS NO FORM. The panel is the shared `Sheet` (a 440-px panel from the right on the desk — #6662) holding a
 * frame of the reply PAGE itself, so there is still one reply form. What the page does on a saved reply — it goes to
 * the thank-you door with `?rsvp=<outcome>` — is how the panel knows: the invitation behind is read again at that
 * moment (`router.replace`, no reload) with that outcome, so the Event Hub says its own "Your reply is in — thank you."
 * and draws the replied card — and the panel STAYS OPEN on the thank-you door, so the guest keeps its QR ticket, "Save
 * to my account" and the plus-ones' invites (controller 2026-10-19). Anywhere else the page or the door sends the guest
 * (their own links, a re-key) becomes the page's address, as on a phone. Esc (in the panel or in the frame) and ✕ close
 * it; focus goes back to the Reply pressed.
 *
 * `frameHref` is the lab's (`/dev/maker-lab/guest?replycard=open&desk=1`): the reply page drawn without a database.
 */
export function ReplyPanel({
  replyPath,
  thanksPath,
  frameHref,
}: {
  /** `inviteReplyPath(slug)` — the door the panel takes. */
  replyPath: string;
  /** `inviteEnterPath(slug)` — where a saved reply lands. */
  thanksPath: string;
  frameHref?: string;
}) {
  const router = useRouter();
  const headingId = useId();
  const [src, setSrc] = useState<string | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  /* The tab's history length when the panel opened: the frame's own moves are entries in the tab's ONE history. */
  const opened = useRef(0);

  /* 🔙 EVERY CLOSE GIVES THE FRAME'S ENTRIES BACK FIRST (walked 2026-10-19): the save's move in the frame — or a refused
     Send's return — left entries of a frame that is about to go, and the guest's next Back was a dead press. Stepping
     back over them moves the frame alone; then the panel closes and `after` runs. */
  const close = useCallback((after?: () => void) => {
    const finish = () => {
      setSrc(null);
      after?.();
    };
    const extra = window.history.length - opened.current;
    const win = frame.current?.contentWindow;
    if (extra <= 0 || !win) return finish();
    let finished = false;
    const once = () => {
      if (finished) return;
      finished = true;
      finish();
    };
    win.addEventListener('popstate', once, { once: true });
    window.setTimeout(once, 500);
    window.history.go(-extra);
  }, []);

  /* The press: the capture phase, ahead of `<Link>`'s own handler — a press this does not take is untouched. */
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a) return;
      const take = opensInReplyPanel({
        href: a.getAttribute('href') ?? '',
        origin: window.location.origin,
        replyPath,
        wide: window.matchMedia(REPLY_PANEL_MEDIA).matches,
        button: e.button,
        modified: e.metaKey || e.ctrlKey || e.shiftKey || e.altKey,
        target: a.getAttribute('target'),
        download: a.hasAttribute('download'),
      });
      if (!take) return;
      e.preventDefault();
      e.stopPropagation();
      /* Focus is on the Reply BEFORE the panel opens, so the panel hands it back there (`useModalA11y`) — Safari does
         not focus a link it clicks. */
      a.focus({ preventScroll: true });
      const url = new URL(a.href);
      opened.current = window.history.length;
      setSrc(frameHref ?? `${url.pathname}${url.search}${url.hash}`);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [replyPath, frameHref]);

  /* Where the frame is: the reply page (stay, wearing the canvas's one chrome rule, Esc listened for), a saved reply
     (read the invitation again; the thank-you door stays in the panel), anywhere else (close; that address becomes the page's). Watched, because the
     page's own moves are client navigations that fire no `load`. */
  useEffect(() => {
    if (!src) return;
    const at = {
      origin: window.location.origin,
      replyPath,
      thanksPath,
      framePath: new URL(src, window.location.origin).pathname,
    };
    const heard = new WeakSet<Window>();
    /* A saved reply: the invitation behind is read again once, and the thank-you door stays in the panel. */
    let saved = false;
    let done = false;
    const look = () => {
      if (done) return;
      const win = frame.current?.contentWindow;
      if (!win) return;
      let href: string;
      let doc: Document;
      try {
        href = win.location.href;
        doc = win.document;
      } catch {
        return;
      }
      const step = replyPanelStep(href, { ...at, saved });
      if (step.kind === 'replied') {
        saved = true;
        router.replace(repliedHref(window.location.href, step.outcome), { scroll: false });
      }
      if (step.kind === 'stay' || step.kind === 'replied') {
        if (href.startsWith('about:')) return;
        /* The app's floating notices (cookie card, stale-tab bar) are the page's, not the panel's. */
        if (doc.head && !doc.head.querySelector('style[data-reply-panel]')) {
          const style = doc.createElement('style');
          style.setAttribute('data-reply-panel', '');
          style.textContent = EDITOR_CANVAS_HIDES_APP_CHROME;
          doc.head.appendChild(style);
        }
        if (!heard.has(win)) {
          heard.add(win);
          win.addEventListener('keydown', (k) => {
            if (k.key === 'Escape' && !k.defaultPrevented) close();
          });
        }
        return;
      }
      done = true;
      close(() => router.push(step.href));
    };
    look();
    const timer = window.setInterval(look, 150);
    return () => {
      done = true;
      window.clearInterval(timer);
    };
  }, [src, replyPath, thanksPath, router, close]);

  return (
    <Sheet open={src !== null} onClose={() => close()} labelledById={headingId} title="Your reply" rise>
      {src ? (
        <iframe
          ref={frame}
          src={src}
          title="Your reply"
          data-reply-panel-frame=""
          className="block h-full min-h-[70dvh] w-full border-0 bg-cream"
        />
      ) : null}
    </Sheet>
  );
}
