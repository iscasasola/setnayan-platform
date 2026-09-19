'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Nfc, X } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { CopyButton } from '@/app/_components/copy-button';
import { isNfcWriteEnabled } from '@/lib/nfc-write-flag';
import {
  NFC_READBACK_TIMEOUT_MS,
  NFC_WRITE_TIMEOUT_MS,
  classifyNfcError,
  nfcFailureCopy,
  nfcTagEligibility,
  nfcWriteSupported,
  readBackMatches,
  tagSizeCopy,
  type NfcFailureReason,
} from '@/lib/nfc-tag';

/**
 * NfcWriteButton — "Write to NFC": the same link a QR encodes, written onto a
 * blank NFC sticker so a phone can TAP instead of scan.
 *
 * One button, one sheet, four exits:
 *   waiting ......... "Hold a blank tag against the back of your phone"
 *   Tag written ..... ONLY after the tag is read back and holds this exact link
 *   Not confirmed ... the write returned but the tag left before read-back —
 *                     the honest middle: it may well be written; check it
 *   Write failed .... every error, named in one sentence (lib/nfc-tag.ts)
 *
 * Where the browser cannot write (iPhone, Safari, desktop, the current iOS
 * shell) the button still renders and the sheet says so, with the link to copy
 * into a free NFC app. A button that vanishes on half the phones reads as a
 * broken page; one that explains reads as a limit.
 *
 * 🔒 THE MEASUREMENT REACHES THE RENDER: success is decided by
 * `readBackMatches(...)` on records read from the tag, never by `write()`
 * resolving. Held by app/_components/every-qr-carries-the-strip.test.ts.
 *
 * Gated by NEXT_PUBLIC_NFC_WRITE_ENABLED (lib/nfc-write-flag.ts) — OFF until
 * the owner confirms one real tap. Download + Copy on the same strip are not.
 */

// Web NFC is not in TypeScript's lib.dom. The slice the button uses:
type NdefRecordLike = { recordType: string; data?: DataView | null };
type NdefReaderLike = {
  write(message: { records: { recordType: 'url'; data: string }[] }, opts: { signal: AbortSignal; overwrite: boolean }): Promise<void>;
  scan(opts: { signal: AbortSignal }): Promise<void>;
  addEventListener(type: 'reading', cb: (ev: { message: { records: NdefRecordLike[] } }) => void): void;
};
type NdefReaderCtor = new () => NdefReaderLike;

type SheetState =
  | { kind: 'closed' }
  | { kind: 'unsupported' }
  | { kind: 'waiting' }
  | { kind: 'written' }
  | { kind: 'unconfirmed' }
  | { kind: 'failed'; reason: NfcFailureReason };

const ACTION_CLASS =
  'inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-cream px-2.5 py-1 text-xs font-medium text-ink/75 hover:bg-ink/5';

export function NfcWriteButton({
  url,
  className,
}: {
  url: string;
  className?: string;
}) {
  const nfcWrite = isNfcWriteEnabled();
  const eligibility = nfcTagEligibility(url);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [state, setState] = useState<SheetState>({ kind: 'closed' });
  const abortRef = useRef<AbortController | null>(null);

  // Decided after mount so the server and the first client paint agree.
  useEffect(() => {
    setSupported(nfcWriteSupported(typeof window === 'undefined' ? null : window));
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const close = useCallback(() => {
    cancel();
    setState({ kind: 'closed' });
  }, [cancel]);

  const write = useCallback(async () => {
    if (!eligibility.eligible) return;
    const target = eligibility.url;
    const ctor = (window as unknown as { NDEFReader?: NdefReaderCtor }).NDEFReader;
    if (!ctor) {
      setState({ kind: 'unsupported' });
      return;
    }
    cancel();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let timedOut = false;
    const timer = window.setTimeout(() => {
      timedOut = true;
      ctrl.abort();
    }, NFC_WRITE_TIMEOUT_MS);
    setState({ kind: 'waiting' });
    try {
      const reader = new ctor();
      await reader.write(
        { records: [{ recordType: 'url', data: target }] },
        { signal: ctrl.signal, overwrite: true },
      );
      window.clearTimeout(timer);
      // Read it back. The browser resolving write() is a claim; the tag
      // holding the link is the fact the screen reports.
      const found = await readUrlRecords(ctor, ctrl.signal);
      if (found === null) {
        setState({ kind: 'unconfirmed' });
      } else if (readBackMatches(found, target)) {
        setState({ kind: 'written' });
      } else {
        setState({ kind: 'failed', reason: 'mismatch' });
      }
    } catch (err) {
      window.clearTimeout(timer);
      const cancelled = ctrl.signal.aborted && !timedOut;
      if (cancelled && abortRef.current === null) {
        // The person closed the sheet; nothing to report.
        return;
      }
      setState({ kind: 'failed', reason: classifyNfcError(err, { timedOut, cancelled }) });
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
    }
  }, [cancel, eligibility]);

  const check = useCallback(async () => {
    if (!eligibility.eligible) return;
    const ctor = (window as unknown as { NDEFReader?: NdefReaderCtor }).NDEFReader;
    if (!ctor) return;
    cancel();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setState({ kind: 'waiting' });
    const found = await readUrlRecords(ctor, ctrl.signal);
    if (abortRef.current !== ctrl) return;
    abortRef.current = null;
    if (found === null) setState({ kind: 'unconfirmed' });
    else if (readBackMatches(found, eligibility.url)) setState({ kind: 'written' });
    else setState({ kind: 'failed', reason: 'mismatch' });
  }, [cancel, eligibility]);

  if (!nfcWrite || !eligibility.eligible) return null;

  const open = state.kind !== 'closed';

  return (
    <>
      <button
        type="button"
        onClick={() => (supported ? void write() : setState({ kind: 'unsupported' }))}
        className={className ?? ACTION_CLASS}
        title={supported === false ? 'Writing tags needs Chrome on Android' : 'Write this link onto a blank NFC sticker'}
      >
        <Nfc aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Write to NFC
      </button>

      <Sheet open={open} onClose={close} labelledById="nfc-write-title" title="Write to NFC">
        <div className="space-y-4 p-5">
          {state.kind === 'unsupported' ? (
            <>
              <h2 id="nfc-write-title" className="text-base font-semibold text-ink">
                Android only, for now
              </h2>
              <p className="text-sm text-ink/70">
                {nfcFailureCopy('unsupported-browser')}
              </p>
              <LinkBox url={eligibility.url} />
              <p className="text-xs text-ink/55">{tagSizeCopy(eligibility.url)}</p>
            </>
          ) : null}

          {state.kind === 'waiting' ? (
            <>
              <h2 id="nfc-write-title" className="text-base font-semibold text-ink">
                Hold a blank tag against the back of your phone
              </h2>
              <p className="text-sm text-ink/70">
                Keep it still until this changes. Nothing else to press.
              </p>
              <div className="flex items-center gap-3 text-sm text-ink/60">
                <span
                  aria-hidden
                  className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-ink"
                />
                Waiting for a tag…
              </div>
              <p className="text-xs text-ink/55">{tagSizeCopy(eligibility.url)}</p>
              <button type="button" onClick={close} className={ACTION_CLASS}>
                <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                Cancel
              </button>
            </>
          ) : null}

          {state.kind === 'written' ? (
            <>
              <h2 id="nfc-write-title" className="flex items-center gap-2 text-base font-semibold text-ink">
                <Check aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={2.25} />
                Tag written
              </h2>
              <p className="text-sm text-ink/70">
                Read back from the tag — it now opens this link when a phone taps it.
              </p>
              <LinkBox url={eligibility.url} />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void write()} className={ACTION_CLASS}>
                  Write another
                </button>
                <button type="button" onClick={close} className={ACTION_CLASS}>
                  Done
                </button>
              </div>
            </>
          ) : null}

          {state.kind === 'unconfirmed' ? (
            <>
              <h2 id="nfc-write-title" className="text-base font-semibold text-ink">
                Not confirmed
              </h2>
              <p className="text-sm text-ink/70">
                The write finished, but the tag moved away before it could be read back.
                Hold the tag to the phone again and tap Check tag.
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void check()} className={ACTION_CLASS}>
                  Check tag
                </button>
                <button type="button" onClick={() => void write()} className={ACTION_CLASS}>
                  Try again
                </button>
                <button type="button" onClick={close} className={ACTION_CLASS}>
                  Close
                </button>
              </div>
            </>
          ) : null}

          {state.kind === 'failed' ? (
            <>
              <h2 id="nfc-write-title" className="text-base font-semibold text-terracotta-700">
                Write failed
              </h2>
              <p role="alert" className="text-sm text-ink/70">
                {nfcFailureCopy(state.reason)}
              </p>
              {state.reason === 'unsupported-browser' || state.reason === 'permission-denied' ? (
                <LinkBox url={eligibility.url} />
              ) : null}
              <div className="flex flex-wrap gap-2">
                {state.reason !== 'unsupported-browser' ? (
                  <button type="button" onClick={() => void write()} className={ACTION_CLASS}>
                    Try again
                  </button>
                ) : null}
                <button type="button" onClick={close} className={ACTION_CLASS}>
                  Close
                </button>
              </div>
            </>
          ) : null}
        </div>
      </Sheet>
    </>
  );
}

/** The link, selectable, with the same Copy the strip offers. */
function LinkBox({ url }: { url: string }) {
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-lg border border-ink/15 bg-white px-3 py-2 text-xs text-ink/75">
        {url}
      </code>
      <CopyButton value={url} label="Copy link" />
    </div>
  );
}

/**
 * Scan once and return the URL records found, or null when no tag was read
 * before the read-back timeout (the tag left the field). Aborts the scan
 * either way so no reader is left listening.
 */
function readUrlRecords(ctor: NdefReaderCtor, parent: AbortSignal): Promise<string[] | null> {
  return new Promise((resolve) => {
    const ctrl = new AbortController();
    const stop = (value: string[] | null) => {
      window.clearTimeout(timer);
      parent.removeEventListener('abort', onParentAbort);
      ctrl.abort();
      resolve(value);
    };
    const onParentAbort = () => stop(null);
    const timer = window.setTimeout(() => stop(null), NFC_READBACK_TIMEOUT_MS);
    parent.addEventListener('abort', onParentAbort);
    try {
      const reader = new ctor();
      reader.addEventListener('reading', ({ message }) => {
        const decoder = new TextDecoder();
        const urls = message.records
          .filter((r) => r.recordType === 'url' && r.data)
          .map((r) => decoder.decode(r.data as DataView));
        stop(urls);
      });
      reader.scan({ signal: ctrl.signal }).catch(() => stop(null));
    } catch {
      stop(null);
    }
  });
}
