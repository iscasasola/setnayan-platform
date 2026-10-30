'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Check, Download, Info, Loader2, Share } from 'lucide-react';
import { GalleryLightbox } from './gallery-lightbox';
import { canShareFiles, saveFileToDevice } from '@/lib/save-to-device';
import { shareExtension, shareWords, type ShareSource } from '@/lib/memories-viewer';
import { formatCount } from '@/lib/format-number';

/**
 * THE PHOTO VIEWER TEMPLATE — one component, the buttons passed in by the caller.
 *
 * Owner 2026-10-30 (live iPhone): *"like how we open inspiration photos but with the buttons for memories"* — and the
 * same day: *"remember to make this a template. so when we go to user memories and it opens a preview. the same
 * template will show but no need for tagging."* So the event's Memories (Share · Tag · Add to Chapter · Hide · Delete)
 * and the account's Memories (Share, and the event door it already had — no Tag) open their photos HERE.
 *
 * It is the shared `GalleryLightbox` in its `screen` layout (the approved Find inspiration viewer: ✕ · "3 of 40 · …",
 * the photo as large as the screen allows, ‹ › and a sideways swipe, what it is, then ONE row of equal buttons in the
 * thumb zone) plus the moves between neighbours and the toolbar drawn from `actions`. A surface decides WHICH buttons
 * and what each does; it never draws its own viewer.
 * 🔒 `app/_components/memories/memories-photos-open-in-the-shared-viewer.test.ts`.
 */
export type ViewerPhoto = {
  /** What the screen shows — a compressed copy made for looking (never the original: that is Share's). */
  src: string;
  poster?: string | null;
  kind: 'photo' | 'clip';
  label?: string;
};

export type ViewerAction = {
  key: string;
  label: string;
  icon: LucideIcon;
  /** False = drawn quiet; pressing it still runs `onPress`, which explains instead of acting. */
  enabled?: boolean;
  tone?: 'danger';
  onPress: () => void;
};

export function PhotoViewer({
  photo,
  at,
  total,
  album,
  onMove,
  onClose,
  actions,
  more,
  eyebrow,
  title,
  sub,
  panel,
  onPanelClose,
  blur = false,
}: {
  photo: ViewerPhoto;
  at: number;
  total: number;
  /** The album or event the photo is in — the top line's second half ("3 of 40 · Papic"). */
  album: string | null;
  onMove: (to: number) => void;
  onClose: () => void;
  actions: ViewerAction[];
  more?: ReactNode;
  eyebrow?: string | null;
  title?: ReactNode;
  sub?: ReactNode;
  panel?: ReactNode;
  onPanelClose?: () => void;
  blur?: boolean;
}) {
  return (
    <GalleryLightbox
      src={photo.src}
      posterSrc={photo.poster ?? null}
      kind={photo.kind}
      label={photo.label}
      onClose={onClose}
      onPrev={at > 0 ? () => onMove(at - 1) : undefined}
      onNext={at < total - 1 ? () => onMove(at + 1) : undefined}
      screen={{
        counter: `${at + 1} of ${formatCount(total)}${album ? ` · ${album}` : ''}`,
        more,
        eyebrow,
        title,
        sub,
        blur,
        panel,
        onPanelClose,
        toolbar: actions.length ? <ViewerToolbar actions={actions} /> : undefined,
      }}
    />
  );
}

/** The one row of equal buttons — icon over its word, every one a 56 px press (the thumb zone). */
export function ViewerToolbar({ actions }: { actions: ViewerAction[] }) {
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-2" data-viewer-actions={actions.map((a) => a.key).join(' ')}>
      {actions.map((a) => {
        const Icon = a.icon;
        const quiet = a.enabled === false;
        return (
          <button
            key={a.key}
            type="button"
            onClick={a.onPress}
            aria-disabled={quiet || undefined}
            data-viewer-action={a.key}
            className={`sn-gal-btn flex min-h-[56px] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[12px] font-medium ${
              a.tone === 'danger' ? '!text-[var(--sn-ob-cta)]' : ''
            } ${quiet ? 'opacity-55' : ''}`}
          >
            <Icon aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />
            <span className="max-w-full truncate">{a.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** A panel's heading line, with its ⓘ — the details stay folded until asked for (house rule). */
export function PanelHead({ title, line, tip }: { title: string; line?: ReactNode; tip?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="pb-3">
      <div className="flex items-center gap-2">
        <h2 className="min-w-0 flex-1 text-[17px] font-semibold">{title}</h2>
        {tip ? (
          <button type="button" aria-expanded={open} aria-label="More about this" onClick={() => setOpen((v) => !v)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
            <Info aria-hidden className="h-[18px] w-[18px] opacity-80" strokeWidth={1.9} />
          </button>
        ) : null}
      </div>
      {line ? <p className="sn-gal-soft text-[13.5px]">{line}</p> : null}
      {tip && open ? (
        <p className="sn-gal-soft mt-1.5 text-[13px] leading-snug" data-viewer-tip="">
          {tip}
        </p>
      ) : null}
    </div>
  );
}

/** The panel's buttons — a primary and a way back, side by side, full width. */
export const PANEL_ROW = 'mt-1 flex gap-2 [&>*]:min-w-0 [&>*]:flex-1';
export const PANEL_BTN = 'sn-gal-btn inline-flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-full px-3 text-[14.5px] font-medium';
export const PANEL_MAIN = 'sn-gal-btn sn-gal-btn-cta inline-flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-full px-3 text-[14.5px] font-semibold';

type ShareState =
  | { k: 'getting' }
  | { k: 'ready'; file: File }
  | { k: 'done'; how: 'shared' | 'downloaded' }
  | { k: 'failed' };

/**
 * 📤 SHARE — the phone's share sheet with the FILE, or a download where there is none (owner 2026-10-30: *"download
 * means we download the high res and not the preview"*). The file is fetched the moment the panel opens, from
 * `source` (`shareSourceOf` — the original, never a screen copy), so the Share press hands it over inside the tap
 * (iOS refuses a share that waits on the network). Says what it is in words: "Full resolution · the original", or why
 * it is not.
 */
export function SharePanel({ source, preserved, onDone }: { source: ShareSource; preserved?: boolean; onDone: () => void }) {
  const [state, setState] = useState<ShareState>({ k: 'getting' });
  const words = shareWords(source, { preserved });
  const get = useCallback(async () => {
    setState({ k: 'getting' });
    try {
      const res = await fetch(source.url);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const type = blob.type || 'image/jpeg';
      setState({ k: 'ready', file: new File([blob], `${source.baseName}.${shareExtension(type)}`, { type }) });
    } catch {
      setState({ k: 'failed' });
    }
  }, [source.url, source.baseName]);
  useEffect(() => {
    void get();
  }, [get]);

  // The same answer `saveFileToDevice` gives: the share sheet on a touch device that can take a file, else a download.
  const sheet = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches && canShareFiles();
  return (
    <div data-viewer-share={source.what}>
      <PanelHead title={source.baseName.includes('clip') ? 'Share this clip' : 'Share this photo'} line={words.line} tip={words.tip} />
      {state.k === 'failed' ? (
        <p role="alert" className="pb-2 text-[13.5px]">
          We couldn’t get the file just now — nothing was shared.
        </p>
      ) : state.k === 'done' ? (
        <p role="status" className="flex items-center gap-1.5 pb-2 text-[13.5px]" data-viewer-share-done={state.how}>
          <Check aria-hidden className="h-4 w-4" strokeWidth={2.5} /> {state.how === 'shared' ? 'Shared' : 'Saved to your downloads'}
        </p>
      ) : state.k === 'ready' ? (
        <p className="sn-gal-soft pb-2 text-[12.5px]" data-viewer-share-size="">
          {state.file.size >= 1_048_576 ? `${(state.file.size / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(state.file.size / 1024))} KB`} · ready
        </p>
      ) : (
        <p className="sn-gal-soft flex items-center gap-1.5 pb-2 text-[12.5px]">
          <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> Getting the file…
        </p>
      )}
      <div className={PANEL_ROW}>
        {state.k === 'failed' ? (
          <button type="button" className={PANEL_MAIN} onClick={() => void get()}>
            Try again
          </button>
        ) : (
          <button
            type="button"
            className={PANEL_MAIN}
            disabled={state.k !== 'ready'}
            data-viewer-share-go=""
            onClick={async () => {
              if (state.k !== 'ready') return;
              const r = await saveFileToDevice(state.file);
              if (r === 'shared' || r === 'downloaded') setState({ k: 'done', how: r });
              else if (r === 'failed') setState({ k: 'failed' });
              // 'dismissed' / 'expired' — the file stays in hand for one more press.
            }}
          >
            {sheet ? <Share aria-hidden className="h-4 w-4" strokeWidth={2} /> : <Download aria-hidden className="h-4 w-4" strokeWidth={2} />}
            {sheet ? 'Share' : 'Download'}
          </button>
        )}
        <button type="button" className={PANEL_BTN} onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}
