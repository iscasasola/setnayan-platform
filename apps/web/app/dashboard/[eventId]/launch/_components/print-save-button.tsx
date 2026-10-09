'use client';

import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import {
  PRINTED_CHANGED_EVENT,
  PRINT_VERSION_HEADER,
  changedSincePrinted,
  printedDayLabel,
  printedTarget,
  readPrintedStamp,
  writePrintedStamp,
  type PrintedStamp,
} from '@/lib/printed-stamp';
import { Download, Loader2 } from 'lucide-react';
import { ActionButton, type ActionTone } from '@/components/action-button';
import { usePrintFetch } from './print-fetch-context';
import { STUDIO_SAVE_CHIP } from '@/lib/studio-skin';

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
  label,
  icon,
  main = false,
  tone,
}: {
  href: string;
  /** The saved file's name — `<event slug>-<print>.pdf`. */
  file: string;
  children?: ReactNode;
  /**
   * `chip` — the old Studio › Prints look (a small bordered Save, words only).
   * `action` — the new Maker's Studio › Prints wears THE ONE ActionButton (`components/action-button.tsx`): the same save, the same
   * states ("Preparing…" · "Tap to save" · the plain error line · "Saved."), drawn by the template. Takes `label` (and `icon`, `main`, `tone`)
   * instead of children.
   */
  variant?: 'primary' | 'secondary' | 'link' | 'chip' | 'action';
  className?: string;
  /** `action` only: the button's word. */
  label?: string;
  /** `action` only: a mark in the icon's place (the Pro mark on the zip). Default: the download arrow. */
  icon?: ReactElement;
  /** `action` only: the row's one filled forward step (terracotta). */
  main?: boolean;
  /** `action` only: default `brand` for the filled step, `neutral` for the rest. */
  tone?: ActionTone;
}) {
  /* The file's fetch — the real one, or (only in the dev lab) a stand-in that reaches no route. */
  const printFetch = usePrintFetch();
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

  const run = async () => {
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
      const res = await printFetch(href, { credentials: 'same-origin' });
      if (!res.ok) {
        const text = (await res.text().catch(() => '')).trim();
        setState({ k: 'error', message: text && text.length < 200 && !text.startsWith('<') ? text : 'That file could not be made just now. Please try again.' });
        return;
      }
      const blob = await res.blob();
      // 🖨 Keep what this paper was drawn from (lib/printed-stamp.ts) — the
      // piece says "Changed since you printed" once the inputs move on.
      const version = res.headers.get(PRINT_VERSION_HEADER);
      const target = printedTarget(href);
      if (version && target) writePrintedStamp(target.eventId, target.piece, version);
      await hand(new File([blob], fileName, { type: blob.type || 'application/octet-stream' }));
    } catch {
      setState({ k: 'error', message: 'That file could not be saved — check your connection and try again.' });
    } finally {
      busy.current = false;
    }
  };
  const onClick = (ev: React.MouseEvent<HTMLAnchorElement>) => {
    ev.preventDefault();
    void run();
  };

  /* 🧭 The new Maker's Studio: the ONE ActionButton — the same states, in the template's words and marks. */
  if (variant === 'action') {
    const word = state.k === 'working' ? 'Preparing…' : state.k === 'ready' ? 'Tap to save' : (label ?? fileName);
    return (
      <span data-print-save={fileName} className="inline-flex flex-col items-start gap-1">
        <ActionButton
          tone={tone ?? (main ? 'brand' : 'neutral')}
          main={main}
          waiting={state.k === 'working'}
          icon={state.k === 'working' ? <Loader2 aria-hidden className="animate-spin" strokeWidth={1.9} /> : (icon ?? Download)}
          label={word}
          name={state.k === 'idle' || state.k === 'saved' || state.k === 'error' ? (label ?? fileName) : word}
          onClick={() => void run()}
        />
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

  const base =
    variant === 'primary'
      ? 'button-primary inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap text-sm'
      : variant === 'secondary'
        ? 'button-secondary inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap text-sm'
        : variant === 'chip'
          ? `${STUDIO_SAVE_CHIP} gap-1.5 whitespace-nowrap`
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
        ) : variant !== 'link' && variant !== 'chip' ? (
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

/**
 * 🖨 "CHANGED SINCE YOU PRINTED" (owner 2026-09-29, OWNER ANSWERS (5)) — shown on
 * a printed piece when this browser saved it and what it is drawn from has
 * changed since (`printInputsVersion`; lib/printed-stamp.ts). Says nothing when
 * it never saw a save — never a false "changed".
 */
export function ChangedSincePrinted({ eventId, piece, version }: { eventId: string; piece: string; version: string | null | undefined }) {
  const [stamp, setStamp] = useState<PrintedStamp | null>(null);
  useEffect(() => {
    const read = () => setStamp(readPrintedStamp(eventId, piece));
    read();
    window.addEventListener(PRINTED_CHANGED_EVENT, read);
    return () => window.removeEventListener(PRINTED_CHANGED_EVENT, read);
  }, [eventId, piece]);
  if (!changedSincePrinted(stamp, version)) return null;
  return (
    <p role="status" data-changed-since-printed={piece} className="border-l-2 border-mulberry/60 pl-3 text-[13px] text-ink/80">
      <span className="font-semibold text-ink">Changed since you printed</span>
      {stamp ? ` on ${printedDayLabel(stamp.at)}` : ''} — save it again so the paper matches.
    </p>
  );
}
