'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Copy, Nfc, RotateCcw, ScanLine, X } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { ActionButton, useFitRow } from '@/components/action-button';
import { InfoTip } from '@/app/_components/info-tip';
import { StatusLine } from '@/app/_components/status-line';
import { useNfcEnabled } from '@/app/_components/use-nfc-enabled';
import {
  NFC_READBACK_TIMEOUT_MS,
  NFC_WRITE_TIMEOUT_MS,
  classifyNativeNfcError,
  classifyNfcError,
  decodeNdefUriRecords,
  ndefUriRecord,
  nfcDeviceKind,
  nfcFailureCopy,
  nfcTagEligibility,
  nfcWrongDeviceCopy,
  nfcWriteSupported,
  readBackMatches,
  sessionEndReason,
  tagSizeCopy,
  type NfcFailureReason,
} from '@/lib/nfc-tag';
import {
  isIosBrowser,
  nativeNfc,
  nativeNfcWithHardware,
  readDeviceEnv,
  type ListenerHandle,
  type NativeNfc,
  type NativeNfcEvent,
  type NdefReaderCtor,
} from '@/app/_components/nfc-runtime';
import type { NfcDevice } from '@/lib/nfc-tag';

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
 *   absent .... NO NFC RADIO ON THIS DEVICE: the app whose plugin answers
 *               `isSupported` false (every iPad — measured on the iPad
 *               simulator 2026-10-19), or iPad Safari. The button is not drawn
 *               at all: there is nothing to offer, here or in the app (iPad +
 *               Duo audit W6 · App Store 2.1).
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
 * the owner confirms one real tap — or this phone's own `?nfc-test=1` opt-in
 * (use-nfc-enabled.ts). Download + Copy on the same strip are not.
 */

export type Writer = 'app' | 'web' | 'none' | 'absent';

export type SheetState =
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
  const nfcOn = useNfcEnabled();
  const eligibility = nfcTagEligibility(url);
  const [writer, setWriter] = useState<Writer | null>(null);
  const [device, setDevice] = useState<NfcDevice>('phone');
  const [state, setState] = useState<SheetState>({ kind: 'closed' });
  const abortRef = useRef<AbortController | null>(null);

  // Decided after mount so the server and the first client paint agree.
  useEffect(() => {
    let live = true;
    const kind = nfcDeviceKind(readDeviceEnv());
    setDevice(kind);
    void (async () => {
      // 🍎 The app is asked whether the RADIO is here, not only the plugin.
      const next: Writer = nativeNfc()
        ? (await nativeNfcWithHardware())
          ? 'app'
          : 'absent'
        : nfcWriteSupported(typeof window === 'undefined' ? null : window)
          ? 'web'
          : kind === 'tablet'
            ? 'absent'
            : 'none';
      if (live) setWriter(next);
    })();
    return () => {
      live = false;
    };
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
      if (!eligibility.eligible || !writer || writer === 'absent') return;
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

  if (!nfcOn || !eligibility.eligible || writer === 'absent') return null;

  const open = state.kind !== 'closed';

  return (
    <>
      <button
        type="button"
        onClick={() => void run('write')}
        className={className ?? ACTION_CLASS}
        title={
          writer === 'none'
            ? device === 'desktop'
              ? 'Writing tags happens on a phone'
              : 'Writing tags needs the Setnayan app or Chrome on Android'
            : 'Write this link onto a blank NFC sticker'
        }
      >
        <Nfc aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Write to NFC
      </button>

      <Sheet open={open} onClose={close} labelledById={NFC_TITLE_ID} rise>
        <NfcSheetBody
          state={state}
          url={eligibility.url}
          writer={writer}
          device={device}
          onWrite={() => void run('write')}
          onCheck={() => void run('check')}
          onClose={close}
        />
      </Sheet>
    </>
  );
}

const NFC_TITLE_ID = 'nfc-write-title';

/** The house sheet title — the type scale's 19 px, never the mono eyebrow. Room on the right for the sheet's own ✕. */
const TITLE_CLASS = 'text-[19px] font-semibold leading-snug tracking-tight text-ink';

/**
 * 🏠 THE SHEET'S BODY, drawn from props alone — the house look (owner 2026-10-25, "the NFC write does not follow our
 * design templates"): the shared `Sheet` with its own ✕ (no mono eyebrow strip), a 19 px title whose details sit
 * in its ⓘ, the house `StatusLine` (✓ · ⓘ · ⚠) for every outcome, the link as a read-only field with a Copy
 * `ActionButton`, and ONE `ActionButton` row toned by meaning — one main verb per state, the rest quiet.
 * Exported so a lab can draw every state without a radio (Web NFC cannot run in a test browser).
 * Guard: app/_components/the-nfc-sheet-is-a-house-sheet.test.ts.
 */
export function NfcSheetBody({
  state,
  url,
  writer,
  device,
  onWrite,
  onCheck,
  onClose,
}: {
  state: SheetState;
  url: string;
  writer: Writer | null;
  device: NfcDevice;
  onWrite: () => void;
  onCheck: () => void;
  onClose: () => void;
}) {
  return (
    <div className="space-y-4 px-5 pb-5 pt-4" data-nfc-sheet={state.kind}>
      {state.kind === 'unsupported' ? (
        <>
          <SheetTitle tip={tagSizeCopy(url)}>
            {device === 'desktop' ? 'Do this on your phone' : 'Not in this browser'}
          </SheetTitle>
          <p className="text-sm text-ink/70">{nfcWrongDeviceCopy(device, isIosBrowser())}</p>
          <LinkBox url={url} />
        </>
      ) : null}

      {state.kind === 'waiting' ? (
        <>
          <SheetTitle tip={state.step === 'write' ? tagSizeCopy(url) : null}>
            {state.step === 'write'
              ? writer === 'app'
                ? 'Hold a blank tag to the top of your phone'
                : 'Hold a blank tag against the back of your phone'
              : 'Tap the tag once more to confirm'}
          </SheetTitle>
          <p className="text-sm text-ink/70">
            {state.step === 'write'
              ? 'Keep it still until this changes. Nothing else to press.'
              : 'Written. Lift the tag away, then touch it to the phone again so we can read it back.'}
          </p>
          <div className="flex items-center gap-3 text-sm text-ink/60" role="status">
            <span
              aria-hidden
              className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-ink"
            />
            {state.step === 'write' ? 'Waiting for a tag…' : 'Waiting to read it back…'}
          </div>
          <ActionRow>
            <ActionButton tone="neutral" quiet icon={X} label="Cancel" onClick={onClose} />
          </ActionRow>
        </>
      ) : null}

      {state.kind === 'written' ? (
        <>
          <SheetTitle tip="Read back from the tag — it now opens this link when a phone taps it.">Tag written</SheetTitle>
          <StatusLine tone="info" data="nfc-written">
            Written and checked. A tap opens this link.
          </StatusLine>
          <LinkBox url={url} />
          <ActionRow>
            <ActionButton tone="brand" main icon={Nfc} label="Write another" onClick={onWrite} />
            <ActionButton tone="neutral" quiet icon={Check} label="Done" onClick={onClose} />
          </ActionRow>
        </>
      ) : null}

      {state.kind === 'unconfirmed' ? (
        <>
          <SheetTitle tip="The write finished, but the tag was not read back. It may well be written.">
            Not confirmed
          </SheetTitle>
          <StatusLine tone="warn" data="nfc-unconfirmed">
            Hold the tag to the phone and tap Check tag.
          </StatusLine>
          <ActionRow>
            <ActionButton tone="brand" main icon={ScanLine} label="Check tag" onClick={onCheck} />
            <ActionButton tone="neutral" quiet icon={RotateCcw} label="Try again" onClick={onWrite} />
            <ActionButton tone="neutral" quiet icon={X} label="Close" onClick={onClose} />
          </ActionRow>
        </>
      ) : null}

      {state.kind === 'failed' ? (
        <>
          <SheetTitle tip={null}>Write failed</SheetTitle>
          <StatusLine tone="bad" data="nfc-failed">
            {nfcFailureCopy(state.reason)}
          </StatusLine>
          {state.reason === 'unsupported-browser' || state.reason === 'no-nfc' || state.reason === 'permission-denied' ? (
            <LinkBox url={url} />
          ) : null}
          <ActionRow>
            {state.reason !== 'unsupported-browser' && state.reason !== 'no-nfc' ? (
              <ActionButton tone="brand" main icon={RotateCcw} label="Try again" onClick={onWrite} />
            ) : null}
            <ActionButton tone="neutral" quiet icon={X} label="Close" onClick={onClose} />
          </ActionRow>
        </>
      ) : null}
    </div>
  );
}

/** The title, with its details in an ⓘ when it has any. `pr-12` keeps it clear of the sheet's ✕. */
function SheetTitle({ children, tip }: { children: string; tip: string | null }) {
  if (!tip) {
    return (
      <h2 id={NFC_TITLE_ID} className={`pr-12 ${TITLE_CLASS}`}>
        {children}
      </h2>
    );
  }
  return (
    <InfoTip label={children} labelAs="h2" labelId={NFC_TITLE_ID} labelClassName={TITLE_CLASS} align="start" className="pr-12">
      {tip}
    </InfoTip>
  );
}

/** One row of house buttons; the right-most secondaries drop to their icon before anything wraps. */
function ActionRow({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useFitRow(ref);
  return (
    <div ref={ref} className="flex flex-nowrap items-center gap-2 pt-1" data-nfc-actions="">
      {children}
    </div>
  );
}

/** The link as the house read-only field, with a Copy button beside it. */
function LinkBox({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  useFitRow(ref);
  return (
    <div ref={ref} className="flex items-center gap-2" data-nfc-link="">
      <input
        readOnly
        value={url}
        aria-label="The link this tag opens"
        onFocus={(e) => e.currentTarget.select()}
        className="min-h-11 min-w-0 flex-1 truncate rounded-xl border border-ink/15 bg-cream px-3 text-sm text-ink/80 outline-none focus:border-ink/40"
      />
      <ActionButton
        tone="neutral"
        icon={copied ? Check : Copy}
        label={copied ? 'Copied' : 'Copy'}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard blocked — the link stays visible and selectable */
          }
        }}
      />
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
