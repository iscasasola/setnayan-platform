'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Nfc, X } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { CopyButton } from '@/app/_components/copy-button';
import { isNfcWriteEnabled } from '@/lib/nfc-write-flag';
import {
  NFC_READBACK_TIMEOUT_MS,
  NFC_WRITE_TIMEOUT_MS,
  classifyNativeNfcError,
  classifyNfcError,
  decodeNdefUriRecords,
  ndefUriRecord,
  nfcFailureCopy,
  nfcTagEligibility,
  nfcWriteSupported,
  readBackMatches,
  sessionEndReason,
  tagSizeCopy,
  type NfcFailureReason,
  type RawNdefRecord,
} from '@/lib/nfc-tag';

/**
 * NfcWriteButton — "Write to NFC": the same link a QR encodes, written onto a
 * blank NFC sticker so a phone can TAP instead of scan.
 *
 * THREE WRITERS, ONE SHEET. Which one runs is decided on the device:
 *   app ....... the Setnayan iOS / Android app, through the native
 *               `CapacitorNfc` plugin (CoreNFC on iPhone). An app build from
 *               before the plugin shipped simply does not have it and falls
 *               through — the web deploys ahead of App Review safely.
 *   web ....... Chrome on Android (installed PWA included), through Web NFC.
 *   none ...... iPhone Safari, desktop: the sheet says so and offers the link
 *               to copy into a free NFC app.
 *
 * The sheet has one waiting state and four exits:
 *   Tag written ..... ONLY after the tag is read back and holds this exact link
 *   Not confirmed ... the write returned but no read-back came — it may well be
 *                     written; "Check tag" reads it again
 *   Write failed .... every error, named in one sentence (lib/nfc-tag.ts)
 *   (cancel) ........ closes quietly
 *
 * On the APP, the plugin cannot read the tag it just wrote within the same
 * touch, so confirmation is a second tap ("Tap the tag once more to
 * confirm"). On Chrome the read-back follows automatically while the tag is
 * still held.
 *
 * 🔒 THE MEASUREMENT REACHES THE RENDER: every path ends in `settle(found)`,
 * the ONE place success is set, and it sets it only when `readBackMatches`.
 * Held by app/_components/every-qr-carries-the-strip.test.ts.
 *
 * Gated by NEXT_PUBLIC_NFC_WRITE_ENABLED (lib/nfc-write-flag.ts) — OFF until
 * the owner confirms one real tap. Download + Copy on the same strip are not.
 */

// ── Web NFC (not in TypeScript's lib.dom) ─────────────────────────────────
type NdefRecordLike = { recordType: string; data?: DataView | null };
type NdefReaderLike = {
  write(message: { records: { recordType: 'url'; data: string }[] }, opts: { signal: AbortSignal; overwrite: boolean }): Promise<void>;
  scan(opts: { signal: AbortSignal }): Promise<void>;
  addEventListener(type: 'reading', cb: (ev: { message: { records: NdefRecordLike[] } }) => void): void;
};
type NdefReaderCtor = new () => NdefReaderLike;

// ── The app's native plugin (@capgo/capacitor-nfc, jsName "CapacitorNfc") ──
type ListenerHandle = { remove: () => Promise<void> | void };
type NativeNfcEvent = { tag?: { ndefMessage?: RawNdefRecord[] | null } };
type NativeNfc = {
  startScanning(opts: { invalidateAfterFirstRead?: boolean; alertMessage?: string }): Promise<void>;
  stopScanning(): Promise<void>;
  write(opts: { records: RawNdefRecord[]; allowFormat?: boolean }): Promise<void>;
  getStatus(): Promise<{ status: string }>;
  addListener(event: 'nfcEvent', cb: (e: NativeNfcEvent) => void): Promise<ListenerHandle> | ListenerHandle;
  addListener(event: 'nfcSessionEnd', cb: (e: { reason?: string }) => void): Promise<ListenerHandle> | ListenerHandle;
};
type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  isPluginAvailable?: (name: string) => boolean;
  Plugins?: { CapacitorNfc?: NativeNfc };
};

function nativeNfc(): NativeNfc | null {
  if (typeof window === 'undefined') return null;
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  if (cap.isPluginAvailable && !cap.isPluginAvailable('CapacitorNfc')) return null;
  return cap.Plugins?.CapacitorNfc ?? null;
}

type Writer = 'app' | 'web' | 'none';

type SheetState =
  | { kind: 'closed' }
  | { kind: 'unsupported' }
  | { kind: 'waiting'; step: 'write' | 'confirm' }
  | { kind: 'written' }
  | { kind: 'unconfirmed' }
  | { kind: 'failed'; reason: NfcFailureReason };

/** A failure the flow can throw and the sheet can name. */
class NfcFailure extends Error {
  constructor(public reason: NfcFailureReason) {
    super(reason);
  }
}

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
  const [writer, setWriter] = useState<Writer | null>(null);
  const [state, setState] = useState<SheetState>({ kind: 'closed' });
  const abortRef = useRef<AbortController | null>(null);

  // Decided after mount so the server and the first client paint agree.
  useEffect(() => {
    if (nativeNfc()) setWriter('app');
    else if (nfcWriteSupported(typeof window === 'undefined' ? null : window)) setWriter('web');
    else setWriter('none');
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const close = useCallback(() => {
    stop();
    setState({ kind: 'closed' });
  }, [stop]);

  /**
   * THE ONE PLACE success is decided. `found` is what the tag was read back
   * to hold — null when no read-back arrived.
   */
  const settle = useCallback((found: string[] | null, target: string) => {
    if (found === null) setState({ kind: 'unconfirmed' });
    else if (readBackMatches(found, target)) setState({ kind: 'written' });
    else setState({ kind: 'failed', reason: 'mismatch' });
  }, []);

  const run = useCallback(
    async (mode: 'write' | 'check') => {
      if (!eligibility.eligible || !writer) return;
      const target = eligibility.url;
      if (writer === 'none') {
        setState({ kind: 'unsupported' });
        return;
      }
      stop();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setState({ kind: 'waiting', step: mode === 'write' ? 'write' : 'confirm' });
      try {
        let found: string[] | null;
        if (writer === 'app') {
          const nfc = nativeNfc();
          if (!nfc) throw new NfcFailure('unsupported-browser');
          if (mode === 'write') {
            await nativeWriteOnce(nfc, target, ctrl.signal);
            if (ctrl.signal.aborted) return;
            setState({ kind: 'waiting', step: 'confirm' });
            // iPhone dismisses one NFC sheet before it will present the next.
            await new Promise((r) => window.setTimeout(r, 600));
          }
          found = await nativeReadOnce(nfc, ctrl.signal);
        } else {
          if (mode === 'write') await webWriteOnce(target, ctrl.signal);
          found = await webReadOnce(ctrl.signal);
        }
        if (ctrl.signal.aborted && abortRef.current !== ctrl) return; // closed by the person
        settle(found, target);
      } catch (err) {
        if (abortRef.current !== ctrl) return; // closed by the person
        const reason =
          err instanceof NfcFailure
            ? err.reason
            : writer === 'app'
              ? classifyNativeNfcError(err)
              : classifyNfcError(err, { timedOut: ctrl.signal.aborted });
        if (reason === 'cancelled') {
          setState({ kind: 'closed' });
          return;
        }
        setState({ kind: 'failed', reason });
      } finally {
        if (abortRef.current === ctrl) abortRef.current = null;
      }
    },
    [eligibility, writer, settle, stop],
  );

  if (!nfcWrite || !eligibility.eligible) return null;

  const open = state.kind !== 'closed';

  return (
    <>
      <button
        type="button"
        onClick={() => void run('write')}
        className={className ?? ACTION_CLASS}
        title={writer === 'none' ? 'Writing tags needs the Setnayan app or Chrome on Android' : 'Write this link onto a blank NFC sticker'}
      >
        <Nfc aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Write to NFC
      </button>

      <Sheet open={open} onClose={close} labelledById="nfc-write-title" title="Write to NFC">
        <div className="space-y-4 p-5">
          {state.kind === 'unsupported' ? (
            <>
              <h2 id="nfc-write-title" className="text-base font-semibold text-ink">
                Not in this browser
              </h2>
              <p className="text-sm text-ink/70">{nfcFailureCopy('unsupported-browser')}</p>
              <LinkBox url={eligibility.url} />
              <p className="text-xs text-ink/55">{tagSizeCopy(eligibility.url)}</p>
            </>
          ) : null}

          {state.kind === 'waiting' ? (
            <>
              <h2 id="nfc-write-title" className="text-base font-semibold text-ink">
                {state.step === 'write'
                  ? writer === 'app'
                    ? 'Hold a blank tag to the top of your phone'
                    : 'Hold a blank tag against the back of your phone'
                  : 'Tap the tag once more to confirm'}
              </h2>
              <p className="text-sm text-ink/70">
                {state.step === 'write'
                  ? 'Keep it still until this changes. Nothing else to press.'
                  : 'Written. Lift the tag away, then touch it to the phone again so we can read it back.'}
              </p>
              <div className="flex items-center gap-3 text-sm text-ink/60">
                <span
                  aria-hidden
                  className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-ink"
                />
                {state.step === 'write' ? 'Waiting for a tag…' : 'Waiting to read it back…'}
              </div>
              {state.step === 'write' ? <p className="text-xs text-ink/55">{tagSizeCopy(eligibility.url)}</p> : null}
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
                <button type="button" onClick={() => void run('write')} className={ACTION_CLASS}>
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
                The write finished, but the tag was not read back. It may well be written —
                hold it to the phone and tap Check tag.
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void run('check')} className={ACTION_CLASS}>
                  Check tag
                </button>
                <button type="button" onClick={() => void run('write')} className={ACTION_CLASS}>
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
              {state.reason === 'unsupported-browser' || state.reason === 'no-nfc' || state.reason === 'permission-denied' ? (
                <LinkBox url={eligibility.url} />
              ) : null}
              <div className="flex flex-wrap gap-2">
                {state.reason !== 'unsupported-browser' && state.reason !== 'no-nfc' ? (
                  <button type="button" onClick={() => void run('write')} className={ACTION_CLASS}>
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

// ── Web NFC (Chrome on Android) ────────────────────────────────────────────

function webCtor(): NdefReaderCtor {
  const ctor = (window as unknown as { NDEFReader?: NdefReaderCtor }).NDEFReader;
  if (!ctor) throw new NfcFailure('unsupported-browser');
  return ctor;
}

/** Write once, with our own timeout; a timeout throws a named failure. */
async function webWriteOnce(url: string, signal: AbortSignal): Promise<void> {
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  signal.addEventListener('abort', onAbort);
  let timedOut = false;
  const timer = window.setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, NFC_WRITE_TIMEOUT_MS);
  try {
    await new (webCtor())().write({ records: [{ recordType: 'url', data: url }] }, { signal: ctrl.signal, overwrite: true });
  } catch (err) {
    if (timedOut) throw new NfcFailure('timed-out');
    throw err;
  } finally {
    window.clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  }
}

/**
 * Scan once and return the URL records found, or null when no tag was read
 * before the read-back timeout. Aborts the scan either way.
 */
function webReadOnce(parent: AbortSignal): Promise<string[] | null> {
  return new Promise((resolve) => {
    const ctrl = new AbortController();
    const done = (value: string[] | null) => {
      window.clearTimeout(timer);
      parent.removeEventListener('abort', onParentAbort);
      ctrl.abort();
      resolve(value);
    };
    const onParentAbort = () => done(null);
    const timer = window.setTimeout(() => done(null), NFC_READBACK_TIMEOUT_MS);
    parent.addEventListener('abort', onParentAbort);
    try {
      const reader = new (webCtor())();
      reader.addEventListener('reading', ({ message }) => {
        const decoder = new TextDecoder();
        done(
          message.records
            .filter((r) => r.recordType === 'url' && r.data)
            .map((r) => decoder.decode(r.data as DataView)),
        );
      });
      reader.scan({ signal: ctrl.signal }).catch(() => done(null));
    } catch {
      done(null);
    }
  });
}

// ── The app's native plugin ────────────────────────────────────────────────

/**
 * One NFC session on the app: wait for a tag (or the session's end, or our
 * timeout, or the person closing the sheet), then run `onTag` against it.
 * Always stops scanning and removes both listeners on the way out — a
 * session left open on iPhone keeps the system sheet on screen.
 */
function nativeSession<T>(
  nfc: NativeNfc,
  signal: AbortSignal,
  opts: { alertMessage: string; invalidateAfterFirstRead: boolean; timeoutMs: number; onTimeout: () => T },
  onTag: (e: NativeNfcEvent) => Promise<T> | T,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const handles: Promise<ListenerHandle>[] = [];
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      for (const h of handles) void h.then((x) => x.remove()).catch(() => undefined);
      void Promise.resolve(nfc.stopScanning()).catch(() => undefined);
      fn();
    };
    const onAbort = () => finish(() => reject(new NfcFailure('cancelled')));
    // onTimeout may THROW (the write step) or return (the confirm step); either
    // way the promise must settle, or the sheet spins forever.
    const timedOut = () => {
      try {
        resolve(opts.onTimeout());
      } catch (err) {
        reject(err);
      }
    };
    const timer = window.setTimeout(() => finish(timedOut), opts.timeoutMs);
    signal.addEventListener('abort', onAbort);

    // The native bridge returns handles synchronously; the web one, a Promise.
    handles.push(
      Promise.resolve(
        nfc.addListener('nfcEvent', (e) => {
          if (settled) return;
          Promise.resolve()
            .then(() => onTag(e))
            .then(
              (v) => finish(() => resolve(v)),
              (err) => finish(() => reject(err)),
            );
        }),
      ),
    );
    handles.push(
      Promise.resolve(
        nfc.addListener('nfcSessionEnd', ({ reason }) => {
          const r = sessionEndReason(reason);
          finish(() => (r === 'timed-out' ? timedOut() : reject(new NfcFailure(r))));
        }),
      ),
    );

    Promise.resolve(
      nfc.startScanning({ invalidateAfterFirstRead: opts.invalidateAfterFirstRead, alertMessage: opts.alertMessage }),
    ).catch((err) => finish(() => reject(new NfcFailure(classifyNativeNfcError(err)))));
  });
}

/** Write the link onto the first tag presented. Rejects with a named failure. */
async function nativeWriteOnce(nfc: NativeNfc, url: string, signal: AbortSignal): Promise<void> {
  const status = await Promise.resolve(nfc.getStatus()).catch(() => null);
  if (status?.status === 'NFC_DISABLED') throw new NfcFailure('nfc-off');
  if (status?.status === 'NO_NFC') throw new NfcFailure('no-nfc');
  await nativeSession<void>(
    nfc,
    signal,
    {
      alertMessage: 'Hold a blank tag to the top of your phone.',
      invalidateAfterFirstRead: false,
      timeoutMs: NFC_WRITE_TIMEOUT_MS,
      onTimeout: () => {
        throw new NfcFailure('timed-out');
      },
    },
    async () => {
      try {
        await nfc.write({ records: [ndefUriRecord(url)], allowFormat: true });
      } catch (err) {
        throw new NfcFailure(classifyNativeNfcError(err));
      }
    },
  );
}

/**
 * Read the next tag presented and return its URL records — null when the
 * person lets the confirm step time out. This is the read-back `settle` needs.
 */
function nativeReadOnce(nfc: NativeNfc, signal: AbortSignal): Promise<string[] | null> {
  return nativeSession<string[] | null>(
    nfc,
    signal,
    {
      alertMessage: 'Tap the tag once more to confirm.',
      invalidateAfterFirstRead: true,
      timeoutMs: NFC_WRITE_TIMEOUT_MS,
      onTimeout: () => null,
    },
    (e) => decodeNdefUriRecords(e.tag?.ndefMessage),
  ).catch((err) => {
    // Closing the confirm step is not a failure of the write — it is simply
    // unconfirmed. Anything else still names itself.
    if (err instanceof NfcFailure && err.reason === 'cancelled' && !signal.aborted) return null;
    throw err;
  });
}
