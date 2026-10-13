'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Share2 } from 'lucide-react';
import { actionButtonClass } from '@/components/action-button';
import { QrActions } from '@/app/_components/qr-actions';
import { SaveFileLink } from './save-file-link';

/**
 * QR CARD — a code people show, scan, share or download (`INTERACTION_RULES.md` § 9, kind 24; control templates
 * round 2, `prototypes/control_templates_round2_2026-10-12.html` § 24 — owner "APPROVE ALL" 2026-10-12, answer 3:
 * **Share main, Download second**). Extends `qr-actions.tsx`: the one strip (Write to NFC · Copy link) rides under it.
 *
 *   · THE CODE IS ALWAYS DARK ON WHITE — in Dark mode too: a scanner needs it. A white plate, the code, and one small
 *     SETNAYAN "S" in the middle (the codes are level-H, built to read through it).
 *   · The name, and one line under it. Share (the phone's own share sheet; a computer copies the link) is the main
 *     button; Download (the code as a file) is second.
 *   · Tap the code: it opens big, so a phone held up to a scanner reads it. Tap again or Esc closes.
 *   · Used / void: greyed, the word on it, no Share — nobody tries it twice. A problem says so with Try again; never
 *     an empty square. While a code is being made the square shimmers — nothing fake to scan.
 *
 * Not for the guest's pass (it keeps its approved round code, 2026-09-29). Neutral: it knows no screen.
 */
export type QrCardState = 'ready' | 'making' | 'used' | 'problem';

export function QrCard({
  svg: qrSvg,
  url,
  title,
  line,
  filename,
  state = 'ready',
  stamp,
  retryHref,
  data,
}: {
  /** The code, drawn on the server (`renderUrlQrSvg`). */
  svg: string | null;
  /** What the code opens — what Share sends. */
  url: string;
  title: string;
  line?: string;
  /** The saved file's name. */
  filename: string;
  state?: QrCardState;
  /** The word on a used code ("Used · Oct 1", "Void"). */
  stamp?: string;
  /** Where Try again goes when the code could not be made. */
  retryHref?: string;
  /** `data-qr-card="<data>"`. */
  data?: string;
}) {
  const [big, setBig] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!big) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setBig(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [big]);

  if (state === 'problem' || (state === 'ready' && !qrSvg)) {
    return (
      <div role="alert" data-qr-card={data ?? ''} data-qr-state="problem" className="flex flex-col items-center gap-2 py-6 text-center">
        <b className="text-[16px] text-ink">Couldn&rsquo;t make the code</b>
        <p className="text-[13.5px] text-ink/60">Nothing was issued. Try again in a moment.</p>
        {retryHref ? (
          <a href={retryHref} className={actionButtonClass('neutral')}>
            <span className="lbl">Try again</span>
          </a>
        ) : null}
      </div>
    );
  }

  const dataUri = qrSvg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}` : '';
  const plate = 'relative block h-[200px] w-[200px] rounded-card bg-white p-[14px] shadow-[0_1px_0_rgba(0,0,0,.04),0_10px_26px_-16px_rgba(0,0,0,.35)] [&_svg]:block [&_svg]:h-full [&_svg]:w-full';
  const mark = (
    <span aria-hidden className="absolute left-1/2 top-1/2 flex h-[38px] w-[38px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded bg-white font-serif text-[18px] font-bold text-sn-accent">
      S
    </span>
  );

  const share = async () => {
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setSaid('Link copied');
    } catch {
      /* the person closed the share sheet — nothing to say */
    }
  };

  return (
    <div data-qr-card={data ?? ''} data-qr-state={state} className="flex flex-col items-center gap-2.5 py-1.5 text-center">
      {state === 'making' ? (
        <div aria-busy="true" aria-label="Making your code" className="h-[200px] w-[200px] animate-pulse rounded-card bg-ink/[0.07]" />
      ) : state === 'used' ? (
        <div className={`${plate} opacity-60`} aria-label={`This code was used${stamp ? ` — ${stamp}` : ''}`}>
          <span aria-hidden dangerouslySetInnerHTML={{ __html: qrSvg ?? '' }} />
          <span className="absolute inset-0 flex items-center justify-center rounded-card bg-white/80 text-[18px] font-bold tracking-wide text-[#2C2A29]">{stamp ?? 'Used'}</span>
        </div>
      ) : (
        <button type="button" className={`sn-press ${plate}`} aria-label={`${title} — tap to open it big`} onClick={() => setBig(true)} data-qr-plate="">
          <span aria-hidden dangerouslySetInnerHTML={{ __html: qrSvg ?? '' }} />
          {mark}
        </button>
      )}
      <b className="text-[16px] font-semibold text-ink">{title}</b>
      {line ? <span className="max-w-[22rem] text-[13px] text-ink/60">{line}</span> : null}
      {state === 'ready' ? (
        <>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
            <button type="button" onClick={share} className={actionButtonClass('brand', { main: true })} data-qr-share="">
              <Share2 aria-hidden strokeWidth={1.9} />
              <span className="lbl">Share</span>
            </button>
            <SaveFileLink href={dataUri} filename={filename} className={actionButtonClass('neutral')} data-qr-download="">
              {(s) => (
                <>
                  <Download aria-hidden strokeWidth={1.9} />
                  <span className="lbl">{s === 'saving' ? 'Saving…' : 'Download'}</span>
                </>
              )}
            </SaveFileLink>
          </div>
          {said ? (
            <span role="status" className="text-[12.5px] text-ink/60">
              {said}
            </span>
          ) : null}
          {/* The one strip under every link-QR — here Write to NFC · Copy link (Download is the button above). */}
          <QrActions url={url} className="flex flex-wrap items-center justify-center gap-2" />
        </>
      ) : null}
      {big && mounted
        ? createPortal(
            <button
              type="button"
              aria-label="Close the big code"
              onClick={() => setBig(false)}
              className="fixed inset-0 z-[97] flex flex-col items-center justify-center gap-4 bg-white p-6"
              data-qr-big=""
            >
              <span aria-hidden className="block aspect-square w-full max-w-[min(88vw,520px)] [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg ?? '' }} />
              <span className="text-[15px] font-medium text-[#2C2A29]">Hold it up to the scanner</span>
            </button>,
            document.body,
          )
        : null}
    </div>
  );
}
