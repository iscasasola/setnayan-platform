'use client';

import { useState } from 'react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import {
  SHARE_PDF_DOCUMENT_PAPERS,
  SHARE_PDF_PAPERS,
  SHARE_PDF_POSTER_PAPERS,
  customPaper,
  sharePdfPaperParam,
  type SharePdfPaper,
} from '@/lib/share-pdf-papers';

/**
 * 📄 PAPER ▾ — the one size choice beside every Share that makes a file (owner 2026-10-29: "always use A4?").
 *
 *   kind="document" (a data view's PDF — Budget, the guest list, the seat chart by table): A4 (default) · Letter
 *                    (short bond) · Long bond (8.5 × 13 in).
 *   kind="poster"   (a poster's PDF): A4 · A3 · A2 · A1 · A0 · Custom — Custom opens a W × H in cm or in (owner:
 *                    *"For some posters the smallest will be A4 then A3, then whatever size?"*).
 *
 * The house dropdown (`PickMenu` — "any set of choices is a dropdown"). The value is the engine's own
 * (`lib/share-pdf-papers.ts`); the caller sends it on as `?paper=` (`sharePdfPaperParam`). Remembered per device by
 * `useRememberedPaper` — a convenience only; with no storage it is simply A4 again.
 */
export function PaperPicker({
  kind,
  value,
  onPick,
}: {
  kind: 'document' | 'poster';
  value: SharePdfPaper;
  onPick: (p: SharePdfPaper) => void;
}) {
  const keys = kind === 'poster' ? SHARE_PDF_POSTER_PAPERS : SHARE_PDF_DOCUMENT_PAPERS;
  const options = keys.map((k) => ({ key: k, label: k === 'custom' ? 'Custom size' : SHARE_PDF_PAPERS[k].label }));
  const current = typeof value === 'string' ? value : 'custom';
  const [unit, setUnit] = useState<'cm' | 'in'>('cm');
  const [w, setW] = useState('');
  const [h, setH] = useState('');
  const [custom, setCustom] = useState(current === 'custom');
  const apply = (nw: string, nh: string, nu: 'cm' | 'in') => {
    const p = customPaper(Number(nw), Number(nh), nu);
    if (p) onPick(p);
  };
  return (
    <span className="inline-flex flex-wrap items-center gap-2" data-paper-picker={kind}>
      <PickMenu
        label="Paper"
        value={custom ? 'custom' : current}
        options={options}
        buttonText={custom ? 'Paper: Custom' : `Paper: ${typeof value === 'string' ? SHARE_PDF_PAPERS[value].label.split(' (')[0] : 'Custom'}`}
        onPick={(k) => {
          if (k === 'custom') {
            setCustom(true);
            return;
          }
          setCustom(false);
          if (k in SHARE_PDF_PAPERS) onPick(k as keyof typeof SHARE_PDF_PAPERS);
        }}
        dataAttr="data-paper"
        // A pill with a hairline, like the Share button beside it: the house dropdown's bare white-on-white pill read as
        // plain words on the page ("a frame only on what you press" — and this is pressed).
        className="border border-ink/15"
      />
      {custom && kind === 'poster' ? (
        <span className="inline-flex items-center gap-1.5" data-paper-custom="">
          <input
            inputMode="decimal"
            aria-label={`Width in ${unit}`}
            placeholder="W"
            value={w}
            onChange={(e) => {
              setW(e.target.value);
              apply(e.target.value, h, unit);
            }}
            className="h-10 w-16 rounded-full border border-ink/15 bg-transparent px-3 text-sm text-ink"
          />
          <span aria-hidden className="text-sm text-ink/60">
            ×
          </span>
          <input
            inputMode="decimal"
            aria-label={`Height in ${unit}`}
            placeholder="H"
            value={h}
            onChange={(e) => {
              setH(e.target.value);
              apply(w, e.target.value, unit);
            }}
            className="h-10 w-16 rounded-full border border-ink/15 bg-transparent px-3 text-sm text-ink"
          />
          <PickMenu
            label="Unit"
            value={unit}
            options={[
              { key: 'cm', label: 'cm' },
              { key: 'in', label: 'in' },
            ]}
            onPick={(k) => {
              const nu = k === 'in' ? 'in' : 'cm';
              setUnit(nu);
              apply(w, h, nu);
            }}
          />
        </span>
      ) : null}
    </span>
  );
}

const KEY = (kind: string) => `setnayan:paper:${kind}`;

/** The paper this device last picked for this kind — A4 when nothing is stored or storage is unavailable. */
export function readRememberedPaper(kind: 'document' | 'poster'): SharePdfPaper {
  try {
    const raw = window.localStorage.getItem(KEY(kind));
    const list: readonly string[] = kind === 'poster' ? SHARE_PDF_POSTER_PAPERS : SHARE_PDF_DOCUMENT_PAPERS;
    return raw && list.includes(raw) && raw in SHARE_PDF_PAPERS ? (raw as keyof typeof SHARE_PDF_PAPERS) : 'a4';
  } catch {
    return 'a4';
  }
}
export function rememberPaper(kind: 'document' | 'poster', p: SharePdfPaper) {
  try {
    if (typeof p === 'string') window.localStorage.setItem(KEY(kind), p);
  } catch {
    /* a private window: it is simply not remembered */
  }
}
export { sharePdfPaperParam };
