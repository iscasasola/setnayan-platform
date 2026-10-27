'use client';

import { usePrintSave, type PrintSaveState } from '@/app/dashboard/[eventId]/launch/_components/print-save-button';

export type SaveFileState = 'idle' | 'saving' | 'ready';

/**
 * SaveFileLink — the one safe way this app hands the visitor a file: a QR PNG, the guest list's QR-codes PDF, a
 * calendar (.ics), a CSV, a zip, a data: URI — anything served with a `Content-Disposition: attachment` on the other
 * end, or drawn in the page.
 *
 * ── WHY A PLAIN `<a download>` WASN'T ENOUGH ────────────────────────────────
 * Owner, 2026-09-25, on the Guest list: *"When we try to download the QR code, when that button is pressed. it should
 * just save and not open a new page."* And 2026-10-27, from the iPhone app: *"download excel on the app when pressed
 * opened the file with no close button and it did not download"*. iOS Safari and the Capacitor iOS shell both ignore
 * the `download` attribute on a same-origin GET and RENDER the file in the app's only view — no back, no close,
 * nothing saved.
 *
 * So the tap is taken over and runs the save every Prints button uses (`usePrintSave`): fetch with the signed-in
 * session → the phone's SHARE SHEET (Save to Files · Save Image · open in another app) → a plain download on a
 * computer. A slow file that outlives the tap says "tap again"; a refused or failed file says so in words beside
 * the link (the route's own message when it sent one) — never the look of success, never a silent nothing.
 *
 * `children` is either plain content (mountable from a SERVER component) or a function of the saving state (only
 * from a client component — a function cannot cross the boundary; `a-qr-download-never-opens-a-new-page.test.ts`).
 *
 * `href` + `download` stay on the anchor as a working fallback for the instant before hydration and for anyone
 * browsing with scripting off; `onClick` takes over — and calls `preventDefault` — the moment it can.
 *
 * Deliberately NOT a `<Link>`: this is a FILE, never a route Next should try to own client-side.
 *
 * A file on R2 behind a presigned URL that is VIEWED rather than saved (a contract, a chat attachment, a rendered
 * video) goes through `OpenFileLink` instead — the app's in-app browser sheet, which needs no CORS and no session.
 */
export function SaveFileLink({
  href,
  filename,
  className,
  children,
  ...rest
}: {
  href: string;
  filename: string;
  className?: string;
  /** Plain content, or a render prop so a CLIENT caller can swap icon/label while saving. */
  children: React.ReactNode | ((state: SaveFileState) => React.ReactNode);
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'download' | 'onClick' | 'className' | 'children'>) {
  const { state, save } = usePrintSave();
  const shown: SaveFileState = state.k === 'working' ? 'saving' : state.k === 'ready' ? 'ready' : 'idle';
  return (
    <>
      <a
        {...rest}
        href={href}
        download={filename}
        aria-busy={state.k === 'working' || undefined}
        className={className}
        onClick={(e) => {
          e.preventDefault();
          void save(href, filename);
        }}
      >
        {typeof children === 'function' ? children(shown) : children}
      </a>
      <SaveFileLine state={state} />
    </>
  );
}

/** The one line beside a save that did not simply work: a file that outlived the tap, or why it failed. */
function SaveFileLine({ state }: { state: PrintSaveState }) {
  if (state.k === 'error') {
    return (
      <span role="alert" data-save-file="failed" className="block text-xs text-danger-700">
        {state.message}
      </span>
    );
  }
  if (state.k === 'ready') {
    return (
      <span role="status" data-save-file="ready" className="block text-xs text-ink/60">
        Your file is ready — tap again to save it.
      </span>
    );
  }
  return null;
}
