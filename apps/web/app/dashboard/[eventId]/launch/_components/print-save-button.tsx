'use client';

import { useRef, useState, type ReactNode } from 'react';
import { Download, Loader2 } from 'lucide-react';

/**
 * PrintSaveButton — every Prints & Tickets button SAVES a file and never opens
 * a page (owner 2026-09-25, "PRINTS & TICKETS HOLDS EVERY PRINT"; the same rule
 * the Guest list's QR download follows: "it should just save and not open a
 * new page").
 *
 * Why not a bare `<a download>`: iOS Safari and the App Store app's web view
 * can ignore `download` on a same-origin GET and simply SHOW the PDF — a new
 * page, from the chair holding the phone. So: fetch → Blob → File, then
 *   1. the native share sheet (`navigator.share({ files })`) where the device
 *      can share a file — the one path that saves from the Capacitor app,
 *      whose web view has no Downloads folder; "Save to Files" on iPhone;
 *   2. otherwise an object-URL `<a download>` click (desktop, Android Chrome).
 *
 * 🪤 A share needs a FRESH tap. A PDF of 200 guests takes seconds to draw, and
 * by the time it arrives the tap that asked for it has expired — iOS then
 * refuses the share (`NotAllowedError`). That refusal must not look like
 * success or like nothing: the file is kept, and the button becomes "Tap to
 * save" so the next tap shares the file already in hand.
 *
 * 🔑 A FAILURE MUST NOT RENDER LIKE SUCCESS. A refused or failed request says
 * so, in words, on the button's own line (the route's own message when it
 * sent one — "The print-ready file in your theme comes with Event Hub Pro").
 *
 * `href` + `download` stay on the anchor so a click before hydration (or with
 * scripting off) still gets the file the old way.
 */
type State = { k: 'idle' } | { k: 'working' } | { k: 'ready'; file: File } | { k: 'saved'; via: 'share' | 'download' } | { k: 'error'; message: string };

/** A phone or tablet that can share this file. A desktop browser that can also
 *  share (Safari, Chrome on macOS) still downloads — a share sheet is not what
 *  a laptop expects from "Save". */
function canShare(file: File): boolean {
  const touch = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  return (
    touch &&
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  );
}

function downloadBlob(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function PrintSaveButton({
  href,
  file: fileName,
  children,
  variant = 'secondary',
  className = '',
}: {
  href: string;
  /** The saved file's name — `<event slug>-<print>.pdf`. */
  file: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'link';
  className?: string;
}) {
  const [state, setState] = useState<State>({ k: 'idle' });
  const busy = useRef(false);

  const hand = async (file: File) => {
    if (canShare(file)) {
      try {
        await navigator.share({ files: [file] });
        setState({ k: 'saved', via: 'share' });
        return;
      } catch (e) {
        // Dismissed — they saw the sheet; nothing to say.
        if (e instanceof DOMException && e.name === 'AbortError') {
          setState({ k: 'idle' });
          return;
        }
        // The tap expired while the file was being drawn: keep it, ask for one more tap.
        if (e instanceof DOMException && e.name === 'NotAllowedError') {
          setState({ k: 'ready', file });
          return;
        }
      }
    }
    downloadBlob(file);
    setState({ k: 'saved', via: 'download' });
  };

  const onClick = async (ev: React.MouseEvent<HTMLAnchorElement>) => {
    ev.preventDefault();
    if (busy.current) return;
    if (state.k === 'ready') {
      busy.current = true;
      await hand(state.file);
      busy.current = false;
      return;
    }
    busy.current = true;
    setState({ k: 'working' });
    try {
      const res = await fetch(href, { credentials: 'same-origin' });
      if (!res.ok) {
        const text = (await res.text().catch(() => '')).trim();
        setState({ k: 'error', message: text && text.length < 200 && !text.startsWith('<') ? text : 'That file could not be made just now. Please try again.' });
        return;
      }
      const blob = await res.blob();
      await hand(new File([blob], fileName, { type: blob.type || 'application/octet-stream' }));
    } catch {
      setState({ k: 'error', message: 'That file could not be saved — check your connection and try again.' });
    } finally {
      busy.current = false;
    }
  };

  const base =
    variant === 'primary'
      ? 'button-primary inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap text-sm'
      : variant === 'secondary'
        ? 'button-secondary inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap text-sm'
        : 'inline-flex min-h-10 items-center gap-1 text-sm font-medium text-mulberry underline underline-offset-2';

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <a
        href={href}
        download={fileName}
        onClick={onClick}
        aria-busy={state.k === 'working' || undefined}
        data-print-save={fileName}
        className={`${base} ${className}`}
      >
        {state.k === 'working' ? (
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={1.75} />
        ) : variant !== 'link' ? (
          <Download aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        ) : null}
        {state.k === 'working' ? 'Preparing…' : state.k === 'ready' ? 'Tap to save' : children}
      </a>
      {state.k === 'error' ? (
        <span role="alert" className="max-w-[18rem] text-xs text-danger-700">
          {state.message}
        </span>
      ) : state.k === 'ready' ? (
        <span role="status" className="text-xs text-ink/60">
          Your file is ready.
        </span>
      ) : state.k === 'saved' ? (
        <span role="status" className="text-xs text-ink/60">
          {state.via === 'share' ? 'Saved.' : 'Sent to your downloads.'}
        </span>
      ) : null}
    </span>
  );
}
