'use client';

import { useState } from 'react';
import { QrCode } from 'lucide-react';

import { Collapsible } from './collapsible';

/**
 * QR row card for My Shop. One card, two modes via a segmented toggle —
 * Shortlist (a standing reusable QR) and Locked (a single-use, per-customer
 * lock). Both bodies are rendered on the server and passed in; switching
 * animates the resize through the shared Collapsible primitive.
 */
export function QrCard({
  shortlist,
  locked,
}: {
  shortlist: React.ReactNode;
  locked: React.ReactNode;
}) {
  const [mode, setMode] = useState<'shortlist' | 'locked'>('shortlist');

  return (
    <section className="space-y-3">
      <h2 className="sn-sec">Your QR codes</h2>

      <div className="sn-tile p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}
              aria-hidden
            >
              <QrCode className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <span className="text-base font-medium" style={{ color: 'var(--m-ink)' }}>
              QR code
            </span>
          </div>

          <div
            className="inline-flex overflow-hidden rounded-lg border"
            role="tablist"
            aria-label="QR type"
            style={{ borderColor: 'var(--m-line)' }}
          >
            <SegButton
              active={mode === 'shortlist'}
              onClick={() => setMode('shortlist')}
            >
              Shortlist
            </SegButton>
            <SegButton active={mode === 'locked'} onClick={() => setMode('locked')}>
              Locked
            </SegButton>
          </div>
        </div>

        <Collapsible open={mode === 'shortlist'}>
          <div className="pt-1">{shortlist}</div>
        </Collapsible>
        <Collapsible open={mode === 'locked'}>
          <div className="pt-1">{locked}</div>
        </Collapsible>
      </div>
    </section>
  );
}

function SegButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="px-4 py-1.5 text-sm font-medium transition-colors"
      style={
        active
          ? { background: 'var(--m-ink)', color: 'var(--m-paper)' }
          : { background: 'transparent', color: 'var(--m-slate)' }
      }
    >
      {children}
    </button>
  );
}
