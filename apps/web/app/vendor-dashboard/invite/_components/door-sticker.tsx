'use client';

import { useState } from 'react';
import { Share } from 'lucide-react';
import { Fold } from '@/app/_components/fold';
import { SaveFileLink } from '@/app/_components/save-file-link';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { actionButtonClass } from '@/components/action-button';
import { DatesRow } from '../../customers/_components/dates-row';
import {
  DOOR_STICKER_CODES,
  DOOR_STICKER_CODE_LABEL,
  DOOR_STICKER_SIZES,
  DOOR_STICKER_SIZE_LABEL,
  doorStickerFileName,
  doorStickerHref,
  doorStickerKey,
  type DoorStickerCode,
  type DoorStickerFormat,
  type DoorStickerSize,
} from '@/lib/door-sticker';

/**
 * 🚪 THE DOOR STICKER — "We are part of SETNAYAN" (owner 2026-11-05, *"add them to the marketing tools"*), a print
 * piece under the shop's QR codes. ONE fold: the title and one line, the details in its ⓘ.
 *
 *   Code ▾ (My page · Check a date) · Size ▾ (Door · 20 cm · Window · 40 cm, both square) · the sticker as it prints · Download PDF ·
 *   Download SVG
 *
 * Each choice is ONE dropdown (the shipped `PickMenu`). Picking changes this card only — no navigation, so nothing
 * else on the page resets. The preview is the real file (`/api/vendor/door-sticker`), asked for only once the fold has
 * been opened, so the QR page's own reads never grow for it. Download only: Setnayan neither orders nor prints it.
 *
 * `labFiles` — /dev only: each file as a data: URI keyed `<code>-<size>-<format>`, so the lab draws and saves the real
 * file with no session (the badges line's `labFiles`, the same way).
 */
export function DoorSticker({ initialCode, labFiles }: { initialCode: DoorStickerCode; labFiles?: Record<string, string> }) {
  const [code, setCode] = useState<DoorStickerCode>(initialCode);
  const [size, setSize] = useState<DoorStickerSize>('door');
  const [open, setOpen] = useState(false);
  // Once opened, the preview stays loaded — shutting and reopening the fold never asks for the file again.
  const [opened, setOpened] = useState(false);
  const href = (format: DoorStickerFormat) => labFiles?.[doorStickerKey(code, size, format)] ?? doorStickerHref(code, size, format);

  return (
    <div className="mt-6 border-t border-ink/10" data-door-sticker="">
      <Fold
        title="Door sticker"
        summary="We are part of Setnayan"
        summaryEnd
        tip="For your shop’s door or window. It carries your name, the code you pick and the badges your shop wears today — save it again when you earn a new one. The PDF is print-ready (3 mm bleed, crop marks, cut line); the SVG scales to any size. Any sign or sticker shop can print it."
        data="door-sticker"
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) setOpened(true);
        }}
      >
        <div className="pb-4">
          <DatesRow
            title="Code"
            line="What a scan opens"
            end={
              <PickMenu
                label="Code"
                value={code}
                options={DOOR_STICKER_CODES.map((k) => ({ key: k, label: DOOR_STICKER_CODE_LABEL[k] }))}
                dataAttr="data-door-sticker-code"
                className="!min-h-11"
                onPick={(k) => setCode(k === 'dates' ? 'dates' : 'page')}
              />
            }
          />
          <DatesRow
            title="Size"
            line="A square with round corners"
            end={
              <PickMenu
                label="Size"
                value={size}
                options={DOOR_STICKER_SIZES.map((k) => ({ key: k, label: DOOR_STICKER_SIZE_LABEL[k] }))}
                dataAttr="data-door-sticker-size"
                className="!min-h-11"
                onPick={(k) => setSize(k === 'window' ? 'window' : 'door')}
              />
            }
          />
          <div className="mt-4 flex flex-col items-center gap-3">
            {opened ? (
              // eslint-disable-next-line @next/next/no-img-element -- the real print file, an SVG drawn by our own route
              <img
                src={href('svg')}
                alt={`The door sticker: We are part of SETNAYAN, ${DOOR_STICKER_CODE_LABEL[code]} code`}
                width={260}
                height={260}
                className="h-[260px] w-[260px] rounded-card"
                data-door-sticker-preview={`${code}-${size}`}
              />
            ) : (
              <div aria-hidden className="h-[260px] w-[260px] rounded-card bg-ink/[0.05]" />
            )}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <SaveFileLink href={href('pdf')} filename={doorStickerFileName(code, size, 'pdf')} className={actionButtonClass('brand', { main: true })} data-door-sticker-save="pdf">
                {(s) => (
                  <>
                    <Share aria-hidden strokeWidth={1.9} />
                    <span className="lbl">{s === 'saving' ? 'Saving…' : 'Download PDF'}</span>
                  </>
                )}
              </SaveFileLink>
              <SaveFileLink href={href('svg')} filename={doorStickerFileName(code, size, 'svg')} className={actionButtonClass('neutral')} data-door-sticker-save="svg">
                {(s) => (
                  <>
                    <Share aria-hidden strokeWidth={1.9} />
                    <span className="lbl">{s === 'saving' ? 'Saving…' : 'Download SVG'}</span>
                  </>
                )}
              </SaveFileLink>
            </div>
          </div>
        </div>
      </Fold>
    </div>
  );
}
