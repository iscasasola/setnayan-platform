'use client';

/**
 * 🤝🖼 THE COUPLE'S TWO SUGGESTION PANELS (owner 2026-10-19, option (b); prototype
 * `supplier_inspiration_suggestions_2026-10-19.html` frames 4 and 3b), drawn by Studio › Mood Board's Palette
 * (`mood-board-studio.tsx`), which keeps every write:
 *
 *   · `SuggestionsNotice` — at the top of Palette, in the shipped notice's place and shape: "2 suggestions from your
 *     suppliers" · "Tap one to see it beside your photos", one pressable row per photo (thumb · part · shop · ›) that
 *     jumps to its block;
 *   · `KeepFullSheet` — Keep on a part that already holds three: "Centrepieces already has 3 photos — which one does
 *     Bloom & Co.'s photo replace?", the three photos to tap, the incoming one, and "Keep all three for now", which
 *     sends nothing (the suggestion keeps waiting).
 */
import { ChevronRight } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { STUDIO_GROUP } from '@/lib/studio-skin';
import {
  FULL_SHEET_KEEP_ALL,
  SUGGESTION_NOTICE_LINE,
  fullSheetIncoming,
  fullSheetLine,
  fullSheetTitle,
  suggestionFrom,
  suggestionNoticeTitle,
  type CoupleSuggestion,
} from '@/lib/inspiration-suggestions';
import { StudioSheet } from './colour-picker-sheet';

function Pic({ src, className }: { src: string; className: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- a board photo, already sized
  return <img src={src} alt="" className={className} />;
}

export function SuggestionsNotice({
  waiting,
  partLabelOf,
  onJump,
}: {
  waiting: readonly CoupleSuggestion[];
  partLabelOf: (slotKey: string) => string;
  onJump: (s: CoupleSuggestion) => void;
}) {
  return (
    <div className={STUDIO_GROUP} data-mood-board-suggestions="">
      <div className="pb-0 pt-3.5">
        <p className="text-[17px] font-medium leading-tight text-ink">{suggestionNoticeTitle(waiting.length)}</p>
        <p className="mt-1 text-[14px] text-ink/60">{SUGGESTION_NOTICE_LINE}</p>
      </div>
      <div className="mt-2 flex flex-col">
        {waiting.map((sg) => (
          <button
            key={sg.id}
            type="button"
            data-mood-board-suggestion-jump={sg.id}
            onClick={() => onJump(sg)}
            className="sn-press flex min-h-[60px] w-full items-center gap-3 border-t border-ink/10 py-2 text-left"
          >
            <Pic src={sg.url} className="h-11 w-11 flex-none rounded-xl object-cover" />
            <span className="min-w-0 flex-1">
              <b className="block truncate text-[16px] font-medium text-ink">{partLabelOf(sg.slotKey)}</b>
              <span className="mt-px block truncate text-[13px] text-ink/60">{suggestionFrom(sg.shop)}</span>
            </span>
            <ChevronRight aria-hidden className="h-5 w-5 flex-none text-terracotta" />
          </button>
        ))}
      </div>
    </div>
  );
}

export function KeepFullSheet({
  suggestion,
  part,
  photos,
  onReplace,
  onClose,
}: {
  suggestion: CoupleSuggestion;
  part: string;
  /** The part's three places, as the board shows them (a url, or null for a place being filled). */
  photos: ReadonlyArray<string | null>;
  onReplace: (position: number) => void;
  onClose: () => void;
}) {
  return (
    <StudioSheet label={`Keep ${suggestion.shop}’s photo`} onClose={onClose}>
      <div className="flex flex-col gap-3 px-3 pb-2" data-mood-board-keep-full={suggestion.id}>
        <h4 className="font-serif text-[21px] font-medium leading-tight text-ink">{fullSheetTitle(part)}</h4>
        <p className="text-[14px] text-ink/60">{fullSheetLine(suggestion.shop)}</p>
        <div className="grid grid-cols-3 gap-2.5">
          {photos.map((url, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Replace photo ${i + 1}`}
              data-mood-board-replace={i + 1}
              onClick={() => onReplace(i + 1)}
              className="sn-press flex flex-col items-center gap-1.5"
            >
              <span className="block aspect-square w-full overflow-hidden rounded-2xl bg-ink/5">{url ? <Pic src={url} className="h-full w-full object-cover" /> : null}</span>
              <small className="text-[13px] text-ink/70">Photo {i + 1}</small>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2.5 border-t border-ink/10 pb-0.5 pt-1.5">
          <Pic src={suggestion.url} className="h-11 w-11 flex-none rounded-xl object-cover" />
          <span className="text-[14px] text-ink/70">{fullSheetIncoming(suggestion.shop)}</span>
        </div>
        <span data-mood-board-keep-all="" className="[&_.ab]:w-full">
          <ActionButton tone="neutral" quiet icon={<span aria-hidden className="hidden" />} label={FULL_SHEET_KEEP_ALL} onClick={onClose} />
        </span>
      </div>
    </StudioSheet>
  );
}
