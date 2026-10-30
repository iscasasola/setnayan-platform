'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Images, Share } from 'lucide-react';
import { PhotoViewer, PanelHead, SharePanel, PANEL_BTN, type ViewerAction } from '@/app/_components/gallery/photo-viewer';
import { wallShareSourceOf } from '@/lib/memories-viewer';
import { creditLine } from '@/lib/capture-credit-pure';
import type { WallItem } from '@/lib/alaala-wall';

/**
 * THE ACCOUNT'S MEMORIES OPEN A PHOTO IN THE SAME TEMPLATE — owner 2026-10-30: *"remember to make this a template. so
 * when we go to user memories and it opens a preview. the same template will show but no need for tagging."*
 *
 * A frame on `/dashboard/library` opens the shared `PhotoViewer` (the event Memories' viewer) on the photo itself, with
 * ‹ › and a swipe through the frames on the page. Its buttons are what this page already allowed, and NO Tag:
 *   · Share — the full-resolution original for a frame from YOUR event (the hosts' save route), the copy you were
 *     given for an event you attended (`wallShareSourceOf` — and the panel says which);
 *   · Event — your own event's frame still opens that event's Memories, the door the tile used to be.
 * Before this, a frame you were a guest in opened its bare picture in a new tab (`target="_blank"`) — in the app shell
 * a picture with no way back (the 2026-10-24 report).
 * 🔒 `app/_components/memories/memories-photos-open-in-the-shared-viewer.test.ts`.
 */
type Ctx = { open: (key: string) => void };
const WallViewer = createContext<Ctx | null>(null);

export function WallViewerRoot({ items, children }: { items: WallItem[]; children: ReactNode }) {
  const [key, setKey] = useState<string | null>(null);
  return (
    <WallViewer.Provider value={{ open: setKey }}>
      {children}
      {key ? <WallPhotoViewer items={items} at={items.findIndex((i) => i.key === key)} onMove={(to) => setKey(items[to]?.key ?? null)} onClose={() => setKey(null)} /> : null}
    </WallViewer.Provider>
  );
}

/** A frame's press — the tile's own markup inside, so its marks stay where they are. */
export function WallOpen({ item, label, className, children }: { item: WallItem; label: string; className: string; children: ReactNode }) {
  const ctx = useContext(WallViewer);
  return (
    <button type="button" aria-label={label} className={`${className} w-full p-0 text-left`} data-memories-tile="" onClick={() => ctx?.open(item.key)}>
      {children}
    </button>
  );
}

function WallPhotoViewer({ items, at, onMove, onClose }: { items: WallItem[]; at: number; onMove: (to: number) => void; onClose: () => void }) {
  const router = useRouter();
  const [panel, setPanel] = useState<'share' | null>(null);
  const item = items[at];
  if (!item) return null;
  const share = wallShareSourceOf(item);
  const actions: ViewerAction[] = [];
  if (share) actions.push({ key: 'share', label: 'Share', icon: Share, onPress: () => setPanel('share') });
  if (item.role === 'couple') {
    actions.push({ key: 'event', label: 'Event', icon: Images, onPress: () => router.push(`/dashboard/${item.eventId}/memories`) });
  }
  return (
    <PhotoViewer
      photo={{ src: item.url, kind: 'photo', label: `${item.isClip ? 'Clip' : 'Photo'} from ${item.eventName}` }}
      at={at}
      total={items.length}
      album={item.eventName}
      onMove={(to) => {
        setPanel(null);
        onMove(to);
      }}
      onClose={onClose}
      actions={actions}
      eyebrow={item.role === 'couple' ? 'Your event' : 'An event you attended'}
      title={item.eventName}
      sub={[item.withMe ? 'You are in it' : null, creditLine('Taken', item.capturedAt, null)].filter(Boolean).join(' · ') || null}
      panel={
        panel === 'share' && share ? (
          <SharePanel source={share} onDone={() => setPanel(null)} />
        ) : panel === 'share' ? (
          <div>
            <PanelHead title="Share" line="This clip can be saved from its event’s Memories." />
            <button type="button" className={PANEL_BTN} onClick={() => setPanel(null)}>
              Done
            </button>
          </div>
        ) : null
      }
      onPanelClose={() => setPanel(null)}
    />
  );
}
