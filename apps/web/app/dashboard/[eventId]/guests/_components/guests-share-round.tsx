'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Share } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { InfoTip } from '@/app/_components/info-tip';
import { SharePdfButton } from '@/app/_components/share-pdf-button';
import type { GuestsShareItem } from '@/lib/guests-share-sheet';

/**
 * 📤 THE GUESTS TOP ROW'S SHARE ROUND → "SHARE OR PRINT" (R4 slice 8; owner 2026-10-29, prototype `shareSheet`; DECISION_LOG
 * "GUESTS TOP ROW …": *"📤 is NOT drawn yet — it waits for the per-view 'Share or print' sheet"*). Left of the ⚙, on both
 * faces of the row (full and pinned), the same round as the ⚙ (`MenuSettingsButton`'s shape: an icon round, a sheet on
 * the body). The sheet lists what THIS view can hand over (`guestsShareItems`, lib/guests-share-sheet.ts) — each row its
 * name, one line, and the house Share button (`SharePdfButton`: Paper ▾ where the file takes one; the file is made when
 * Share is pressed, then the phone's share sheet or a download).
 * 🔒 lib/guests-share-or-print.test.ts
 */
export function GuestsShareRound({ items }: { items: readonly GuestsShareItem[] }) {
  const [open, setOpen] = useState(false);
  const headingId = useId();
  if (items.length === 0) return null;
  return (
    <>
      <span data-guests-share-round="" className="inline-flex shrink-0">
        <ActionButton tone="neutral" iconOnly icon={Share} label="Share or print" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open} />
      </span>
      {open ? (
        <OnBody>
          <Sheet open onClose={() => setOpen(false)} labelledById={headingId} title="Share or print" wide>
            <div data-guests-share-sheet="" id={headingId}>
              <p className="px-4 pt-3 text-[12.5px] text-ink/60">
                <InfoTip label="Each file is made when you tap Share." align="start">
                  Share hands your phone a PDF — Print · Save to Files · AirDrop · Messages · Viber. On a computer it downloads.
                  Every print together lives on Prints.
                </InfoTip>
              </p>
              <ul className="divide-y divide-ink/10 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                {items.map((it) => (
                  <li key={it.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3" data-guests-share-item={it.key}>
                    <span className="min-w-0 flex-1 basis-48">
                      <span className="block text-sm font-medium text-ink [overflow-wrap:anywhere]">{it.label}</span>
                      <span className="block text-xs text-ink/55 [overflow-wrap:anywhere]">{it.line}</span>
                    </span>
                    <SharePdfButton href={it.href} fileName={it.fileName} name={`Share ${it.label.toLowerCase()} (PDF)`} papers={it.papers} />
                  </li>
                ))}
              </ul>
            </div>
          </Sheet>
        </OnBody>
      ) : null}
    </>
  );
}

function OnBody({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.body), []);
  return host ? createPortal(children, host) : null;
}
