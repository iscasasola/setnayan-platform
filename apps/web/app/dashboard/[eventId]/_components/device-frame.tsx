'use client';

/**
 * DeviceFrame — a presentational iPhone / MacBook Pro 16" shell for the
 * Save-the-Date builder previews (Step-1 openings + the content film).
 *
 * The screen is a `relative overflow-hidden` box sized by CSS aspect-ratio
 * (portrait 9:19.5 for iPhone, landscape 16:10 for the MacBook), so children
 * mount `absolute inset-0` and fill it at the device's real proportions — and
 * the whole frame is fluid (scales down on a phone-sized dashboard column).
 * A "Preview" watermark is pinned to the screen so the framed preview reads as
 * un-recordable, not a final asset.
 */

import type { ReactNode } from 'react';
import { Laptop, Smartphone } from 'lucide-react';

export type PreviewDevice = 'iphone' | 'macbook';

const DEVICES: { id: PreviewDevice; label: string; Icon: typeof Smartphone }[] = [
  { id: 'iphone', label: 'iPhone', Icon: Smartphone },
  { id: 'macbook', label: 'MacBook Pro 16"', Icon: Laptop },
];

/** iPhone ↔ MacBook segmented toggle, shared by the Step-1 + content-film previews. */
export function DeviceToggle({
  device,
  onChange,
}: {
  device: PreviewDevice;
  onChange: (d: PreviewDevice) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Preview device"
      className="inline-flex gap-1 rounded-full border border-ink/10 bg-cream p-1"
    >
      {DEVICES.map(({ id, label, Icon }) => {
        const active = device === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-pressed={active}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              active ? 'bg-ink text-cream' : 'text-ink/60 hover:text-ink'
            }`}
          >
            <Icon aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

function Watermark() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center pb-3">
      <span className="rounded-full bg-black/30 px-3 py-0.5 font-mono text-[9px] uppercase tracking-widest text-white/80 backdrop-blur-sm">
        Preview
      </span>
    </div>
  );
}

export function DeviceFrame({
  device,
  children,
}: {
  device: PreviewDevice;
  children: ReactNode;
}) {
  if (device === 'macbook') {
    return (
      <div className="mx-auto flex w-full flex-col items-center" style={{ maxWidth: 560 }}>
        {/* lid */}
        <div
          className="relative rounded-t-2xl rounded-b-sm border-2 border-[#3a3a3e] bg-[#1b1b1d] px-[10px] pb-[12px] pt-[10px]"
          style={{ width: '93%' }}
        >
          {/* notch */}
          <div className="absolute left-1/2 top-[4px] z-30 h-[12px] w-[60px] -translate-x-1/2 rounded-b-md bg-[#0a0a0c]" />
          <div
            className="relative w-full overflow-hidden rounded-sm bg-[#161210]"
            style={{ aspectRatio: '16 / 10' }}
          >
            {children}
            <Watermark />
          </div>
        </div>
        {/* base / hinge lip */}
        <div
          className="relative h-[13px] w-full rounded-b-lg"
          style={{
            background: 'linear-gradient(#c2c4c9, #a6a8ad)',
            boxShadow: 'inset 0 2px 2px rgba(255,255,255,0.45)',
          }}
        >
          <div className="absolute left-1/2 top-0 h-[6px] w-[96px] -translate-x-1/2 rounded-b-md bg-[#9a9ca1]" />
        </div>
      </div>
    );
  }

  // iPhone
  return (
    <div className="mx-auto w-full" style={{ maxWidth: 232 }}>
      <div
        className="relative w-full rounded-3xl bg-[#0a0a0c] p-[10px]"
        style={{ boxShadow: '0 0 0 2px #2a2a2e, 0 18px 40px rgba(0,0,0,0.28)' }}
      >
        {/* dynamic island */}
        <div className="absolute left-1/2 top-[22px] z-30 h-[22px] w-[74px] -translate-x-1/2 rounded-lg bg-[#0a0a0c]" />
        <div
          className="relative w-full overflow-hidden rounded-3xl bg-[#161210]"
          style={{ aspectRatio: '9 / 19.5' }}
        >
          {children}
          <Watermark />
        </div>
      </div>
    </div>
  );
}
