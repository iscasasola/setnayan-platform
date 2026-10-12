'use client';

import { useRef, useState } from 'react';
import { Download, Loader2, RotateCcw } from 'lucide-react';
import { PillSelector } from '@/app/_components/pill-selector';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { ActionButton } from '@/components/action-button';

type Layout = 'table' | 'az';
type Size = 'a3' | 'a2' | 'a1';

/** Per layout, per size: null when every name fits, else the plain words and the size that holds everyone. */
export type ChartVerdicts = Record<Layout, Record<Size, { words: string[]; suggest: Size | null } | null>>;

type SaveState = { k: 'idle' } | { k: 'making' } | { k: 'saved'; via: 'share' | 'download' } | { k: 'failed'; message: string };

/**
 * The entrance chart's controls (owner 2026-10-13). Each control → its kind
 * (INTERACTION_RULES § 9): Layout = the two-way Pill selector (By table · A to
 * Z); Paper size = the Dropdown (three choices); Save PDF = the main Action
 * button, which says "Making your chart…" while the file is drawn and, on a
 * failure, the plain reason with Try again. The paper preview is always light.
 */
export function EntranceChart({
  eventId,
  layouts,
  sizes,
  defaultSize,
  files,
  verdicts,
  seated,
  unseated,
}: {
  eventId: string;
  layouts: ReadonlyArray<{ key: Layout; label: string }>;
  sizes: ReadonlyArray<{ key: Size; label: string }>;
  defaultSize: Size;
  files: Record<Layout, string>;
  verdicts: ChartVerdicts;
  seated: number;
  unseated: number;
}) {
  const [layout, setLayout] = useState<Layout>('table');
  const [size, setSize] = useState<Size>(defaultSize);
  const [save, setSave] = useState<SaveState>({ k: 'idle' });
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const busy = useRef(false);

  const base = `/dashboard/${encodeURIComponent(eventId)}/seating/print?chart=${layout}&size=${size}`;
  const preview = `${base}&format=preview`;
  const verdict = verdicts[layout][size];
  const canSave = seated > 0 && !verdict;

  const pick = (fn: () => void) => {
    fn();
    if (save.k !== 'making') setSave({ k: 'idle' });
  };

  const run = async () => {
    if (busy.current || !canSave) return;
    busy.current = true;
    setSave({ k: 'making' });
    try {
      const res = await fetch(`${base}&format=pdf`, { credentials: 'same-origin' });
      if (!res.ok) {
        const text = (await res.text().catch(() => '')).trim();
        setSave({ k: 'failed', message: text && text.length < 240 && !text.startsWith('<') ? text : 'Your chart could not be made just now.' });
        return;
      }
      const blob = await res.blob();
      const file = new File([blob], files[layout], { type: blob.type || 'application/pdf' });
      if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          setSave({ k: 'saved', via: 'share' });
          return;
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') {
            setSave({ k: 'idle' });
            return;
          }
        }
      }
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setSave({ k: 'saved', via: 'download' });
    } catch {
      setSave({ k: 'failed', message: 'Your chart could not be saved — check your connection.' });
    } finally {
      busy.current = false;
    }
  };

  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_320px] md:items-start">
      {/* The paper — always light, whatever the screen (owner 2026-10-13: printouts are always light). */}
      <div className="relative mx-auto w-full max-w-[460px] md:order-1">
        <div className="relative aspect-[297/420] w-full overflow-hidden rounded-md bg-white shadow-[0_1px_8px_rgba(0,0,0,0.14)] ring-1 ring-black/5">
          {/* eslint-disable-next-line @next/next/no-img-element -- a same-origin SVG of the sheet, redrawn per choice */}
          <img
            key={preview}
            src={preview}
            alt={`Entrance seating chart, ${layouts.find((l) => l.key === layout)?.label ?? ''}, ${sizes.find((s) => s.key === size)?.label ?? ''}`}
            className="h-full w-full object-contain"
            onLoad={() => setLoadedSrc(preview)}
          />
          {loadedSrc !== preview ? <div aria-hidden className="absolute inset-0 animate-pulse bg-white/70" /> : null}
        </div>
      </div>

      <div className="space-y-4 md:order-2">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-ink/60">Layout</p>
          <PillSelector label="Layout" data="entrance-chart-layout" value={layout} options={layouts} onPick={(k) => pick(() => setLayout(k))} />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-ink/60">Paper size</p>
          <PickMenu
            label="Paper size"
            dataAttr="data-entrance-chart-size"
            value={size}
            options={sizes.map((s) => ({ key: s.key, label: s.label }))}
            onPick={(k) => pick(() => setSize(k as Size))}
          />
        </div>

        {seated === 0 ? (
          <p role="status" className="text-sm text-ink/70">
            No one is seated yet — seat your guests in the Seat plan first.
          </p>
        ) : unseated > 0 ? (
          <p role="status" data-entrance-chart-unseated className="text-sm text-amber-800">
            {unseated} {unseated === 1 ? 'guest has' : 'guests have'} no seat yet — they won’t be on the chart.
          </p>
        ) : null}

        {verdict ? (
          <div role="alert" className="space-y-2">
            <p className="text-sm text-danger-700">{verdict.words.join(' ')}</p>
            {verdict.suggest ? (
              <ActionButton
                tone="neutral"
                icon={RotateCcw}
                label={`Use ${verdict.suggest.toUpperCase()}`}
                onClick={() => pick(() => setSize(verdict.suggest!))}
              />
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col items-start gap-1.5">
          <ActionButton
            tone="brand"
            main
            waiting={!canSave}
            icon={save.k === 'making' ? <Loader2 aria-hidden className="animate-spin" strokeWidth={1.9} /> : Download}
            label={save.k === 'making' ? 'Making your chart…' : 'Save PDF'}
            onClick={() => void run()}
          />
          {save.k === 'failed' ? (
            <div role="alert" className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-danger-700">{save.message}</span>
              <ActionButton tone="neutral" icon={RotateCcw} label="Try again" onClick={() => void run()} />
            </div>
          ) : save.k === 'saved' ? (
            <span role="status" className="text-xs text-ink/60">
              {save.via === 'share' ? 'Saved.' : 'Sent to your downloads.'}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
