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

export type PreviewDevice = 'iphone' | 'macbook';

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
          className="relative rounded-t-[18px] rounded-b-[5px] border-2 border-[#3a3a3e] bg-[#1b1b1d] px-[10px] pb-[12px] pt-[10px]"
          style={{ width: '93%' }}
        >
          {/* notch */}
          <div className="absolute left-1/2 top-[4px] z-30 h-[12px] w-[60px] -translate-x-1/2 rounded-b-[8px] bg-[#0a0a0c]" />
          <div
            className="relative w-full overflow-hidden rounded-[5px] bg-[#161210]"
            style={{ aspectRatio: '16 / 10' }}
          >
            {children}
            <Watermark />
          </div>
        </div>
        {/* base / hinge lip */}
        <div
          className="relative h-[13px] w-full rounded-b-[11px]"
          style={{
            background: 'linear-gradient(#c2c4c9, #a6a8ad)',
            boxShadow: 'inset 0 2px 2px rgba(255,255,255,0.45)',
          }}
        >
          <div className="absolute left-1/2 top-0 h-[6px] w-[96px] -translate-x-1/2 rounded-b-[7px] bg-[#9a9ca1]" />
        </div>
      </div>
    );
  }

  // iPhone
  return (
    <div className="mx-auto w-full" style={{ maxWidth: 232 }}>
      <div
        className="relative w-full rounded-[44px] bg-[#0a0a0c] p-[10px]"
        style={{ boxShadow: '0 0 0 2px #2a2a2e, 0 18px 40px rgba(0,0,0,0.28)' }}
      >
        {/* dynamic island */}
        <div className="absolute left-1/2 top-[22px] z-30 h-[22px] w-[74px] -translate-x-1/2 rounded-[13px] bg-[#0a0a0c]" />
        <div
          className="relative w-full overflow-hidden rounded-[34px] bg-[#161210]"
          style={{ aspectRatio: '9 / 19.5' }}
        >
          {children}
          <Watermark />
        </div>
      </div>
    </div>
  );
}
