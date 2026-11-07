'use client';

import { useEffect, useRef, useState } from 'react';
import { Nfc } from 'lucide-react';
import { useNfcEnabled } from '@/app/_components/use-nfc-enabled';
import { ActionButton } from '@/components/action-button';
import {
  NFC_READBACK_TIMEOUT_MS,
  decodeNdefUriRecords,
  nfcDeviceKind,
  readBackMatches,
  type NfcDevice,
} from '@/lib/nfc-tag';
import { isIosBrowser, nativeNfc, nativeNfcWithHardware, readDeviceEnv, webNdefReader, type ListenerHandle } from './nfc-runtime';

/**
 * 📡 TAP TEST — "Hold a phone to the tag to check it opens your page" (owner v110 "Write to an NFC tag · status · Tap
 * test"; THE ONE BUILD A3 W6, as cut by spec §4: "NFC status = this device's write/tap test only — no new table").
 *
 * READ-ONLY, with the shipped read side: the app reads through CoreNFC / Android (`nativeNfcWithHardware`,
 * `decodeNdefUriRecords`), Android Chrome through Web NFC (`NDEFReader.scan`); either way the answer is
 * `readBackMatches` — the same rule the writer uses before it says "Tag written".
 *
 * 🔑 THE STATUS IS THIS DEVICE'S, AND SAYS SO: "Checked on this phone · 8 Nov" — kept in this browser only
 * (localStorage, a per-device convenience), so another phone never claims a tag it never touched. No table.
 *
 * 🍎 iPhone Safari cannot read or write a tag (no Web NFC): it gets an instruction, not a fake test — iPhones read NDEF
 * URL tags in the background, so holding one to the tag opens the page from a banner. iPad and computers have no NFC
 * radio: nothing is drawn (`lib/nfc-is-a-phone-job.test.ts`). Gated like the writer (`useNfcEnabled`).
 */
const STATUS_KEY = 'setnayan:nfc-tap-test';

type Mode = 'app' | 'web' | 'ios' | 'none' | null;
type Result = { kind: 'idle' } | { kind: 'waiting' } | { kind: 'ok' } | { kind: 'other'; found: string | null } | { kind: 'failed' };

function readStatus(url: string): string | null {
  try {
    const raw = window.localStorage.getItem(STATUS_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { url?: string; at?: string };
    return v.url === url && typeof v.at === 'string' ? v.at : null;
  } catch {
    return null;
  }
}
function writeStatus(url: string): string {
  const at = new Date().toISOString();
  try {
    window.localStorage.setItem(STATUS_KEY, JSON.stringify({ url, at }));
  } catch {
    /* private mode — the answer still shows now */
  }
  return at;
}
const day = (iso: string) => new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });

export function NfcTapTest({ url }: { url: string }) {
  const on = useNfcEnabled();
  const [mode, setMode] = useState<Mode>(null);
  const [device, setDevice] = useState<NfcDevice>('phone');
  const [result, setResult] = useState<Result>({ kind: 'idle' });
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const stop = useRef<(() => void) | null>(null);

  useEffect(() => {
    let live = true;
    setDevice(nfcDeviceKind(readDeviceEnv()));
    setCheckedAt(readStatus(url));
    void (async () => {
      const next: Mode = nativeNfc() ? ((await nativeNfcWithHardware()) ? 'app' : 'none') : webNdefReader() ? 'web' : isIosBrowser() ? 'ios' : 'none';
      if (live) setMode(next);
    })();
    return () => {
      live = false;
      stop.current?.();
    };
  }, [url]);

  if (!on || mode === null || device !== 'phone' || mode === 'none') return null;

  if (mode === 'ios') {
    return (
      <div className="py-2" data-nfc-tap-test="ios">
        <p className="text-[14px] font-medium text-ink">Tap test</p>
        <p className="text-[13px] text-ink/65">
          Hold the top of any iPhone to the tag — a banner should open your page. (A browser on iPhone can&rsquo;t read a tag itself.)
        </p>
      </div>
    );
  }

  const answer = (found: string[]) => {
    stop.current?.();
    stop.current = null;
    if (readBackMatches(found, url)) {
      setCheckedAt(writeStatus(url));
      setResult({ kind: 'ok' });
    } else {
      setResult({ kind: 'other', found: found[0] ?? null });
    }
  };

  const start = async () => {
    setResult({ kind: 'waiting' });
    const timer = window.setTimeout(() => {
      stop.current?.();
      stop.current = null;
      setResult({ kind: 'failed' });
    }, NFC_READBACK_TIMEOUT_MS * 3);
    try {
      if (mode === 'app') {
        const nfc = await nativeNfcWithHardware();
        if (!nfc) throw new Error('no-nfc');
        const handle: ListenerHandle = await nfc.addListener('nfcEvent', (e) => {
          window.clearTimeout(timer);
          answer(decodeNdefUriRecords(e.tag?.ndefMessage ?? null));
        });
        stop.current = () => {
          window.clearTimeout(timer);
          void handle.remove();
          void nfc.stopScanning().catch(() => undefined);
        };
        await nfc.startScanning({ invalidateAfterFirstRead: true, alertMessage: 'Hold your phone to the tag' });
      } else {
        const Reader = webNdefReader();
        if (!Reader) throw new Error('no-web-nfc');
        const ctl = new AbortController();
        stop.current = () => {
          window.clearTimeout(timer);
          ctl.abort();
        };
        const reader = new Reader();
        reader.addEventListener('reading', (ev) => {
          window.clearTimeout(timer);
          const dec = new TextDecoder();
          answer(ev.message.records.filter((r) => r.recordType === 'url' && r.data).map((r) => dec.decode(r.data!)));
        });
        await reader.scan({ signal: ctl.signal });
      }
    } catch {
      window.clearTimeout(timer);
      stop.current?.();
      stop.current = null;
      setResult({ kind: 'failed' });
    }
  };

  return (
    <div className="flex items-start justify-between gap-3 py-2" data-nfc-tap-test={mode}>
      <div className="min-w-0">
        <p className="text-[14px] font-medium text-ink">Tap test</p>
        <p className="text-[13px] text-ink/65" role="status" aria-live="polite">
          {result.kind === 'waiting'
            ? 'Hold this phone to the tag…'
            : result.kind === 'ok'
              ? 'This tag opens your page.'
              : result.kind === 'other'
                ? 'This tag holds a different link — write it again.'
                : result.kind === 'failed'
                  ? 'No tag was read. Try again, holding the phone still on the tag.'
                  : checkedAt
                    ? `Checked on this phone · ${day(checkedAt)}`
                    : 'Hold a phone to the tag to check it opens your page'}
        </p>
      </div>
      <ActionButton tone="neutral" icon={<Nfc aria-hidden strokeWidth={1.75} />} label="Test" onClick={() => void start()} disabled={result.kind === 'waiting'} />
    </div>
  );
}
