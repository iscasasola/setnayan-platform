'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  classifyNativeNfcError,
  classifyNfcError,
  decodeNdefUriRecords,
  sessionEndReason,
  type NfcFailureReason,
} from '@/lib/nfc-tag';
import { nativeNfc, nativePlatform, webNdefReader, type ListenerHandle } from '@/app/_components/nfc-runtime';

/**
 * useNfcTagReader — read the links on NFC tags, for a desk.
 *
 * Where it reads:
 *   • the Setnayan app (iOS + Android) through the native plugin;
 *   • Chrome on Android through Web NFC.
 * `supported` is false everywhere else, and the desk simply does not show the
 * control (its QR camera and name search remain).
 *
 * iPhone reads ONE tag per press: CoreNFC shows the system "Ready to Scan"
 * sheet, reads, and closes — so the desk sees the guest card with the sheet
 * gone. Android keeps listening until Stop, so a queue of guests can tap one
 * after another.
 *
 * Every tag read calls `onUrls(urls)` with the decoded links (possibly []).
 * The hook judges nothing: the desk resolves a guest with the same parser its
 * QR camera uses.
 */
export function useNfcTagReader(onUrls: (urls: string[]) => void) {
  const [runtime, setRuntime] = useState<'app' | 'web' | null>(null);
  const [listening, setListening] = useState(false);
  const [failure, setFailure] = useState<NfcFailureReason | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const onUrlsRef = useRef(onUrls);
  onUrlsRef.current = onUrls;

  useEffect(() => {
    if (nativeNfc()) setRuntime('app');
    else if (webNdefReader()) setRuntime('web');
  }, []);

  const stop = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    setListening(false);
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(async () => {
    stop();
    setFailure(null);
    if (runtime === 'app') {
      const nfc = nativeNfc();
      if (!nfc) return setFailure('unsupported-browser');
      const oneShot = nativePlatform() === 'ios';
      const handles: Promise<ListenerHandle>[] = [];
      let ended = false;
      const end = (reason: NfcFailureReason | null) => {
        if (ended) return;
        ended = true;
        for (const h of handles) void h.then((x) => x.remove()).catch(() => undefined);
        void Promise.resolve(nfc.stopScanning()).catch(() => undefined);
        if (stopRef.current === cleanup) stopRef.current = null;
        setListening(false);
        if (reason && reason !== 'cancelled') setFailure(reason);
      };
      const cleanup = () => end(null);
      stopRef.current = cleanup;
      handles.push(
        Promise.resolve(
          nfc.addListener('nfcEvent', (e) => {
            onUrlsRef.current(decodeNdefUriRecords(e.tag?.ndefMessage));
            // iPhone closes its sheet after the first read and reports no end.
            if (oneShot) end(null);
          }),
        ),
      );
      handles.push(
        Promise.resolve(nfc.addListener('nfcSessionEnd', ({ reason }) => end(sessionEndReason(reason)))),
      );
      setListening(true);
      try {
        await nfc.startScanning({
          invalidateAfterFirstRead: true, // iOS only; Android keeps reading
          alertMessage: "Hold the guest's tag to the top of the phone.",
        });
      } catch (err) {
        end(classifyNativeNfcError(err));
      }
      return;
    }
    if (runtime === 'web') {
      const Ctor = webNdefReader();
      if (!Ctor) return setFailure('unsupported-browser');
      const ctrl = new AbortController();
      stopRef.current = () => ctrl.abort();
      setListening(true);
      try {
        const reader = new Ctor();
        reader.addEventListener('reading', ({ message }) => {
          const dec = new TextDecoder();
          onUrlsRef.current(
            message.records
              .filter((r) => r.recordType === 'url' && r.data)
              .map((r) => dec.decode(r.data as DataView)),
          );
        });
        await reader.scan({ signal: ctrl.signal });
      } catch (err) {
        if (!ctrl.signal.aborted) {
          setListening(false);
          setFailure(classifyNfcError(err));
        }
      }
    }
  }, [runtime, stop]);

  return { supported: runtime !== null, listening, failure, start, stop };
}
