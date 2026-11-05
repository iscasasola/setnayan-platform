'use client';

/**
 * 🎟 THE SUPPLIER CLAIM SCANNER — the Event Hub's Scanner view, for a service whose scanner is ON (approved prototype
 * `prototypes/supplier_scan_2026-10-03_fable.html`, frames B · C · C′; DECISION_LOG 2026-09-25 / 2026-10-03 /
 * 2026-10-29). Closed: the service, its mode, the last number and the count, and Start scanning. Open: the camera,
 * the mode in the chip, NFC listening where this phone can, and ONE result line per scan:
 *
 *   ✓ #0042 · Claimed 142 of 176   ·   Already claimed · #0017   ·   Not a guest of this event
 *
 * 🔢 Count only — a name shows only when the scan action read it under this person's own access (a coordinator the
 * hosts approved). 📶 No signal → "No signal · Nothing was recorded": the number is the database's, so a scan that
 * did not reach it is not a claim, and nothing is queued to pretend otherwise.
 *
 * The camera half is the shared `useLiveQrScan` (one camera at a time on iOS; it comes back when iOS takes it); the
 * tag half is the shared `useNfcTagReader`; a tag and a QR are judged by the ONE parser (`guestTokenFromTag` →
 * `parseGuestQrPayload`). The phone's own camera app is never used — it would open the guest's link and sign the
 * supplier in AS the guest (DECISION_LOG 2026-09-25, the `/[slug]/redeem` trap).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CameraOff, Loader2, Nfc, ScanLine } from 'lucide-react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { Explain } from '@/app/_components/explain';
import { ActionButton } from '@/components/action-button';
import { useLiveQrScan } from '@/lib/use-live-qr-scan';
import { useNfcTagReader } from '@/app/_components/use-nfc-tag-reader';
import { guestTokenFromTag, nfcReadFailureCopy } from '@/lib/nfc-tag';
import { parseGuestQrPayload } from '@/lib/checkin';
import { deviceOs } from '@/lib/apple-device';
import {
  NFC_DEVICE_TABLE,
  nfcLine,
  nfcPlace,
  scanAnswerWords,
  scanModeLabel,
  scanNumberLabel,
  tallyWords,
  type ScanAnswer,
} from '@/lib/supplier-scan';
import { YourNumbers } from './your-numbers';
import type { EventScanService } from '@/lib/supplier-scan.server';
import { supplierScan } from '@/app/_actions/supplier-scan-actions';

type Tally = { claimed: number; total: number; lastNumber: number; ordered: number; ready: number } | null;

export function SupplierClaimScanner({
  eventId,
  services,
  initialAnswer = null,
}: {
  eventId: string;
  services: EventScanService[];
  /** The result line to open on — the dev lab's frames only (`/dev/supplier-lab?s=event-hub&view=scanner&scan=…`). */
  initialAnswer?: ScanAnswer | null;
}) {
  const [coverageId, setCoverageId] = useState<number>(services[0]!.coverageId);
  const service = services.find((s) => s.coverageId === coverageId) ?? services[0]!;
  // Each service keeps its own count on this screen; a scan moves it at once (a save never resets the screen).
  const [tallies, setTallies] = useState<Record<number, Tally>>(() =>
    Object.fromEntries(
      services.map((s) => [
        s.coverageId,
        s.tally ? { claimed: s.tally.claimed, total: s.tally.total, lastNumber: s.tally.lastNumber, ordered: s.tally.ordered, ready: s.tally.ready } : null,
      ]),
    ),
  );
  const tally = tallies[service.coverageId] ?? null;
  const [answer, setAnswer] = useState<ScanAnswer | null>(initialAnswer);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const send = useCallback(
    async (raw: string, via: 'qr' | 'nfc') => {
      if (busyRef.current) return;
      if (!parseGuestQrPayload(raw)) {
        setAnswer({ outcome: 'unreadable' });
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setAnswer({ outcome: 'no_signal' });
        return;
      }
      busyRef.current = true;
      setBusy(true);
      try {
        const reply = await supplierScan({ op: 'claim', eventId, coverageId: service.coverageId, raw, via });
        const a: ScanAnswer = reply.op === 'claim' ? reply.result : { outcome: 'refused', message: 'Something stopped the scan. Try again.' };
        setAnswer(a.outcome === 'already' ? { ...a, mode: service.mode } : a);
        // The count moves with the answer — a save never resets the screen.
        setTallies((all) => {
          const t = all[service.coverageId];
          if (!t) return all;
          const next =
            a.outcome === 'claimed'
              ? { ...t, claimed: a.claimed, total: a.total, lastNumber: Math.max(t.lastNumber, a.number) }
              : a.outcome === 'ordered'
                ? { ...t, ordered: t.ordered + 1, lastNumber: Math.max(t.lastNumber, a.number) }
                : a.outcome === 'received'
                  ? { ...t, claimed: a.claimed, total: a.total, ready: Math.max(0, t.ready - 1) }
                  : t;
          return { ...all, [service.coverageId]: next };
        });
      } catch {
        // The request did not get through — whatever the browser says about its connection.
        setAnswer({ outcome: 'no_signal' });
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [eventId, service.coverageId],
  );

  const { scanning, cameraError, videoRef, start, stop } = useLiveQrScan((raw) => send(raw, 'qr'), { repeatAfterMs: 2500 });

  const nfc = useNfcTagReader((urls) => {
    const hit = guestTokenFromTag(urls, parseGuestQrPayload);
    if (hit.token) void send(hit.token, 'nfc');
    else setAnswer({ outcome: 'unreadable' });
  });
  const [isIos, setIsIos] = useState(false);
  useEffect(() => {
    setIsIos(['iphone', 'ipad'].includes(deviceOs(navigator.userAgent, navigator.maxTouchPoints)));
  }, []);
  const place = nfcPlace({ nfcSupported: nfc.supported, isIos });

  // Switching service closes the camera and the reader — the next scan must count for the service on screen.
  const pick = (k: string) => {
    const id = Number(k);
    if (id === service.coverageId) return;
    stop();
    nfc.stop();
    setAnswer(null);
    setCoverageId(id);
  };

  const words = answer ? scanAnswerWords(answer) : null;
  const options = useMemo(() => services.map((s) => ({ key: String(s.coverageId), label: s.label })), [services]);
  const done = () => {
    stop();
    nfc.stop();
  };

  return (
    <section className="space-y-4 py-2" data-supplier-scanner={service.coverageId} aria-label={`Scan · ${service.label}`}>
      {services.length > 1 ? (
        <PickMenu label="Which service you are scanning for" value={String(service.coverageId)} options={options} onPick={pick} dataAttr="data-supplier-scan-service" />
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-[15px] font-medium text-ink">
          {service.label} <span className="text-ink/60">· {scanModeLabel(service.mode)}</span>
        </p>
        <Explain title="Scanner" label="About the scanner">
          Each guest you scan gets the next number — the same number shows on their Event Hub. In Once, a guest is
          counted one time; a second scan says “Already claimed”. In Ordered → Received, the first scan orders, Ready
          on the number tells the guest it is waiting, and the second scan hands it over. You see the number and the
          guest’s first name. The mode is set once per service, under Shop › Services.
        </Explain>
      </div>

      {/* The closed page: the last number and the count (prototype frame B). */}
      {!scanning ? (
        <div className="flex items-end justify-between gap-3" data-supplier-scan-tally="">
          <p>
            <span className="block font-pahina text-4xl font-light tabular-nums text-ink">
              {tally ? (tally.lastNumber > 0 ? scanNumberLabel(tally.lastNumber) : '—') : '—'}
            </span>
            <span className="block text-[12.5px] text-ink/60">{tally ? (tally.lastNumber > 0 ? 'last' : 'no scans yet') : 'couldn’t load'}</span>
          </p>
          <p className="text-right text-[14px] text-ink/70">
            {tally ? tallyWords(service.mode, tally) : 'Count couldn’t load'}
          </p>
        </div>
      ) : null}

      {scanning ? (
        <div className="relative overflow-hidden rounded-xl bg-black">
          <video ref={videoRef} playsInline muted className="aspect-[3/4] w-full object-cover" />
          <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-3">
            <span className="rounded-full bg-black/55 px-3 py-1 text-[12.5px] text-white">
              {service.label} · {scanModeLabel(service.mode)}
            </span>
            {nfc.listening ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-3 py-1 text-[12.5px] text-white">
                <Nfc aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> NFC on
              </span>
            ) : null}
          </div>
          {tally ? (
            <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-right text-[13px] text-white">
              {tallyWords(service.mode, tally)}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* The ONE result line (frame C′). */}
      <div aria-live="polite" className="min-h-[52px]" data-supplier-scan-answer={answer?.outcome ?? ''}>
        {busy ? (
          <p className="flex items-center gap-2 py-2 text-[14px] text-ink/60">
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" strokeWidth={1.8} /> Checking…
          </p>
        ) : words ? (
          <p className="py-1">
            <span
              className={`block text-[17px] font-semibold ${
                words.tone === 'ok' ? 'text-[rgb(var(--color-ok))]' : words.tone === 'warn' ? 'text-[rgb(var(--color-warn))]' : 'text-ink/80'
              }`}
            >
              {words.title}
            </span>
            {words.line ? <span className="block text-[13.5px] text-ink/65">{words.line}</span> : null}
          </p>
        ) : null}
      </div>

      {cameraError ? (
        <p role="alert" className="text-[13.5px] text-[rgb(var(--color-warn))]">
          {cameraError}
        </p>
      ) : null}
      {nfc.failure ? (
        <p role="alert" className="text-[13.5px] text-[rgb(var(--color-warn))]">
          {nfcReadFailureCopy(nfc.failure)}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2" data-supplier-scan-actions="">
        {scanning ? (
          <ActionButton tone="neutral" icon={CameraOff} label="Done" onClick={done} />
        ) : (
          <ActionButton
            tone="brand"
            main
            icon={Camera}
            label="Start scanning"
            data-testid="supplier-scan-start"
            onClick={() => {
              setAnswer(null);
              void start();
            }}
          />
        )}
        {place === 'reads' ? (
          nfc.listening ? (
            <ActionButton tone="neutral" icon={Nfc} label="Stop tags" onClick={nfc.stop} />
          ) : (
            <ActionButton
              tone="neutral"
              icon={Nfc}
              label="Read a tag"
              onClick={() => {
                setAnswer(null);
                void nfc.start();
              }}
            />
          )
        ) : null}
      </div>

      {/* "Your numbers" — tap one to open it; an ordered number offers Ready (frames D · F). */}
      <YourNumbers
        key={service.coverageId}
        eventId={eventId}
        coverageId={service.coverageId}
        onReady={(told) =>
          setTallies((all) => {
            const t = all[service.coverageId];
            return t ? { ...all, [service.coverageId]: { ...t, ordered: Math.max(0, t.ordered - told), ready: t.ready + told } } : all;
          })
        }
      />

      {/* QR vs NFC, said by the screen itself — only what works on THIS phone, the device table behind the ⓘ. */}
      <div className="flex items-start gap-2" data-supplier-scan-nfc-line={place}>
        <ScanLine aria-hidden className="mt-0.5 h-4 w-4 flex-none text-ink/45" strokeWidth={1.8} />
        <p className="min-w-0 flex-1 text-[12.5px] leading-snug text-ink/60">{nfcLine(place)}</p>
        <Explain title="QR and NFC" label="About QR and NFC">
          {NFC_DEVICE_TABLE}
        </Explain>
      </div>
    </section>
  );
}
