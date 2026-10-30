'use client';

import { useEffect, useState, useTransition } from 'react';
import { Ban, Check, Eye, EyeOff, Flag, FolderPlus, MoreHorizontal, Plus, Share, Tag, Trash2, X } from 'lucide-react';
import { PhotoViewer, PanelHead, SharePanel, PANEL_BTN, PANEL_MAIN, PANEL_ROW, type ViewerAction } from '@/app/_components/gallery/photo-viewer';
import {
  approveScreenedCapture,
  blockUploader,
  deletePhotoForever,
  reportCapture,
  setCaptureHidden,
  setSeatPhotoHidden,
  unblockUploader,
} from '@/app/dashboard/[eventId]/studio/papic/moderation/actions';
import { setVendorCapturesHidden } from '@/app/dashboard/[eventId]/studio/papic/vendor-visibility-actions';
import { memoriesPhotoTags } from '@/app/dashboard/[eventId]/memories/photo-tag-actions';
import { CHAPTER_NOT_YET, CHAPTER_NOT_YET_TIP, SHARE_HELD_WHY, isTaggableTable, shareSourceOf, viewerButtons, type ViewerButtonKey } from '@/lib/memories-viewer';
import { addCandidates, type PhotoTagState } from '@/lib/memories-photo-tags';
import { creditLine } from '@/lib/capture-credit-pure';
import type { MemoriesChallenge, MemoriesItem } from '@/lib/event-memories';

/**
 * THE EVENT'S MEMORIES, ONE PHOTO AT A TIME — owner 2026-10-30, live iPhone, on the old "YOUR UPLOAD" sheet (a 64 px
 * thumbnail and a list of rows): *"the preview is wrong and the buttons are not arranged properly to our design
 * template. like how we open inspiration photos but with the buttons for memories. Share, Hide, Delete, Tag, Add to
 * Chapter."* A tap on a tile opens the shared template (`PhotoViewer`) on the photo itself, and its buttons are the
 * five, in the controller's logged order — Share · Tag · Add to Chapter · Hide · Delete (destructive last) — each drawn
 * only for whom it was already theirs (`viewerButtons`, `lib/memories-viewer.ts`).
 *
 * Every press is the SHIPPED server action with its guarantee: Hide = kept, not deleted (`setCaptureHidden` ·
 * `setSeatPhotoHidden`; a screened frame's slot is `approveScreenedCapture`; a supplier's, `setVendorCapturesHidden`),
 * Delete = every copy (`deletePhotoForever`) — each behind its confirm. Report and Stop this guest shooting (Apple
 * 1.2: a report and a block on user content) stay one press away, in ⋯. Tag is `memoriesPhotoTags` (hosts + the
 * coordinator, checked on the server). Add to Chapter has no storage yet — it says so ("Chapters you make arrive soon").
 */
type Panel = 'share' | 'tag' | 'chapter' | 'hide' | 'delete' | 'more' | null;

export type MemoriesSupplierRow = { vendorProfileId: string; vendorRowId: string; name: string; hidden: boolean };

const REPORT_REASONS = [
  { key: 'nudity_sexual', label: 'Nudity / sexual content' },
  { key: 'violence', label: 'Violence' },
  { key: 'hate_harassment', label: 'Hate / harassment' },
  { key: 'spam', label: 'Spam' },
  { key: 'not_my_event', label: 'Not from this event' },
  { key: 'other', label: 'Something else' },
];

const ICON: Record<ViewerButtonKey, typeof Share> = { share: Share, tag: Tag, chapter: FolderPlus, hide: EyeOff, delete: Trash2 };

export function MemoriesPhotoViewer({
  eventId,
  items,
  at,
  onMove,
  onClose,
  host,
  canTag,
  album,
  challengeOf,
  blockedGuests,
  suppliers,
  timeZone,
  tagFixture = null,
}: {
  eventId: string;
  /** The photos in the order the grid draws them — ‹ › and a swipe walk this list. */
  items: MemoriesItem[];
  at: number;
  onMove: (to: number) => void;
  onClose: () => void;
  host: boolean;
  canTag: boolean;
  album: string | null;
  challengeOf: (it: MemoriesItem) => MemoriesChallenge | null;
  blockedGuests: string[];
  suppliers: MemoriesSupplierRow[];
  timeZone: string | null;
  /** /dev lab only — the Tag list on fixture names, with no session (production never passes it). */
  tagFixture?: PhotoTagState | null;
}) {
  const item = items[at]!;
  const [panel, setPanel] = useState<Panel>(null);
  useEffect(() => setPanel(null), [item.id]);

  const supplier = item.vendorProfileId ? (suppliers.find((s) => s.vendorProfileId === item.vendorProfileId) ?? null) : null;
  const buttons = viewerButtons(item, { host, canTag, supplierHidden: item.memSource === 'suppliers' ? (supplier?.hidden ?? null) : null });
  const share = shareSourceOf(item, { host });
  const who = item.memSource === 'hub' ? item.hubUse : item.capturedBy;
  const challenge = challengeOf(item);
  const screened = item.look === 'screened';

  const title =
    item.memSource === 'hub'
      ? (item.hubUse ?? 'Event Hub file')
      : item.memSource === 'uploads'
        ? 'Your upload'
        : item.memSource === 'suppliers'
          ? (supplier?.name ?? who ?? 'Your supplier')
          : who
            ? `From ${who}`
            : 'A guest’s photo';
  const status =
    item.memSource === 'hub'
      ? 'Used on your Event Hub'
      : screened
        ? 'Held back by the content screen — only you can see it'
        : item.look === 'reported'
          ? 'Reported to the Setnayan team'
          : item.look === 'hidden'
            ? 'Hidden from your Memories — kept, not deleted'
            : item.memSource === 'suppliers'
              ? 'Delivered by your supplier'
              : challenge
                ? `Challenge · ${challenge.title}`
                : null;
  const taken = item.memSource === 'hub' ? null : creditLine('Taken', item.capturedAt, timeZone);
  const when = taken && taken !== 'Taken' ? taken : null;
  const eyebrow =
    item.memSource === 'hub' ? 'Event Hub' : item.memSource === 'uploads' ? 'Your uploads' : item.memSource === 'suppliers' ? 'Suppliers' : challenge ? 'Papic · Challenge' : 'Papic';

  const actions: ViewerAction[] = buttons.map((b) => ({
    key: b.key,
    label: b.key === 'chapter' ? 'Chapter' : b.label,
    icon: b.key === 'hide' ? (b.label === 'Approve' ? Check : b.label === 'Show' ? Eye : EyeOff) : ICON[b.key],
    enabled: b.enabled,
    tone: b.key === 'delete' ? 'danger' : undefined,
    onPress: () => setPanel(b.key),
  }));

  const showMore = host && item.memSource === 'papic' && (item.table === 'papic_guest_captures' || Boolean(item.guestId));
  const back = <input type="hidden" name="back" value="memories" />;

  let body: React.ReactNode = null;
  if (panel === 'share') {
    const held = buttons.find((b) => b.key === 'share')?.enabled === false;
    body =
      held || !share ? (
        <div>
          <PanelHead title="Share this photo" line={SHARE_HELD_WHY} />
          <button type="button" className={PANEL_BTN} onClick={() => setPanel(null)}>
            Done
          </button>
        </div>
      ) : (
        <SharePanel source={share} preserved={item.preserved} onDone={() => setPanel(null)} />
      );
  } else if (panel === 'chapter') {
    body = (
      <div data-viewer-chapter="">
        <PanelHead title="Add to a chapter" line={CHAPTER_NOT_YET} tip={CHAPTER_NOT_YET_TIP} />
        <button type="button" className={PANEL_BTN} onClick={() => setPanel(null)}>
          Done
        </button>
      </div>
    );
  } else if (panel === 'hide') {
    body = <HidePanel eventId={eventId} item={item} supplier={supplier} back={back} onCancel={() => setPanel(null)} />;
  } else if (panel === 'delete') {
    body = (
      <form action={deletePhotoForever.bind(null, eventId)} data-memories-delete-confirm="">
        {back}
        <input type="hidden" name="table" value={item.table} />
        <input type="hidden" name="id" value={item.id} />
        <PanelHead title="Delete forever?" line="Delete this photo and every copy of it? This cannot be undone." />
        <div className={PANEL_ROW}>
          <button type="submit" className={`${PANEL_MAIN} !bg-[var(--sn-ob-cta)]`}>
            <Trash2 aria-hidden className="h-4 w-4" strokeWidth={2} /> Delete forever
          </button>
          <button type="button" className={PANEL_BTN} onClick={() => setPanel(null)}>
            Keep it
          </button>
        </div>
      </form>
    );
  } else if (panel === 'tag' && isTaggableTable(item.table)) {
    body = <TagPanel eventId={eventId} table={item.table} photoId={item.id} fixture={tagFixture} onDone={() => setPanel(null)} />;
  } else if (panel === 'more') {
    body = (
      <MorePanel
        eventId={eventId}
        item={item}
        who={who ?? null}
        blocked={item.guestId ? blockedGuests.includes(item.guestId) : false}
        back={back}
        onDone={() => setPanel(null)}
      />
    );
  }

  const src = item.kind === 'clip' && item.playUrl ? item.playUrl : (item.viewUrl ?? item.largeUrl ?? item.url);
  if (!src) return null;
  return (
    <PhotoViewer
      photo={{ src, poster: item.url, kind: item.kind === 'clip' && item.playUrl ? 'clip' : 'photo', label: title }}
      at={at}
      total={items.length}
      album={album}
      onMove={onMove}
      onClose={onClose}
      actions={actions}
      blur={screened}
      eyebrow={eyebrow}
      title={<span data-memories-viewer-title="">{title}</span>}
      sub={[status, when].filter(Boolean).join(' · ') || null}
      more={
        showMore ? (
          <button type="button" aria-label="More" onClick={() => setPanel('more')} className="flex h-11 w-11 items-center justify-center rounded-full" data-viewer-more="">
            <MoreHorizontal aria-hidden className="h-5 w-5" strokeWidth={2} />
          </button>
        ) : null
      }
      panel={body}
      onPanelClose={() => setPanel(null)}
    />
  );
}

/** Hide · Show · Approve — the shipped actions behind their confirm; kept, not deleted. */
function HidePanel({
  eventId,
  item,
  supplier,
  back,
  onCancel,
}: {
  eventId: string;
  item: MemoriesItem;
  supplier: MemoriesSupplierRow | null;
  back: React.ReactNode;
  onCancel: () => void;
}) {
  if (item.memSource === 'suppliers' && supplier) {
    return (
      <form action={setVendorCapturesHidden} data-memories-hide-confirm="supplier">
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="vendor_id" value={supplier.vendorRowId} />
        <input type="hidden" name="hidden" value={supplier.hidden ? '0' : '1'} />
        {back}
        <PanelHead
          title={supplier.hidden ? `Show ${supplier.name}’s photos again?` : `Hide all of ${supplier.name}’s photos?`}
          line={supplier.hidden ? 'Every photo they delivered comes back to your Memories.' : 'Every photo they delivered leaves your Memories — kept, not deleted.'}
        />
        <div className={PANEL_ROW}>
          <button type="submit" className={PANEL_MAIN}>
            {supplier.hidden ? 'Show them' : 'Hide them'}
          </button>
          <button type="button" className={PANEL_BTN} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    );
  }
  if (item.look === 'screened') {
    return (
      <form action={approveScreenedCapture.bind(null, eventId)} data-memories-hide-confirm="approve">
        {back}
        <input type="hidden" name="table" value={item.table} />
        <input type="hidden" name="id" value={item.id} />
        <PanelHead title="Show this photo?" line="The content screen held it back. Approve it only if it is fine for your guests to see." />
        <div className={PANEL_ROW}>
          <button type="submit" className={PANEL_MAIN}>
            <Check aria-hidden className="h-4 w-4" strokeWidth={2} /> Approve
          </button>
          <button type="button" className={PANEL_BTN} onClick={onCancel}>
            Keep it held
          </button>
        </div>
      </form>
    );
  }
  const hidden = item.look === 'hidden';
  return (
    <form action={(item.table === 'papic_photos' ? setSeatPhotoHidden : setCaptureHidden).bind(null, eventId)} data-memories-hide-confirm={hidden ? 'show' : 'hide'}>
      {back}
      <input type="hidden" name={item.table === 'papic_photos' ? 'photo_id' : 'capture_id'} value={item.id} />
      <input type="hidden" name="hide" value={hidden ? '0' : '1'} />
      <PanelHead
        title={hidden ? 'Show this photo in Memories again?' : 'Hide this photo from Memories?'}
        line={hidden ? 'It comes back for everyone it was shown to.' : 'It’s kept, not deleted — show it again any time.'}
      />
      <div className={PANEL_ROW}>
        <button type="submit" className={PANEL_MAIN}>
          {hidden ? <Eye aria-hidden className="h-4 w-4" strokeWidth={2} /> : <EyeOff aria-hidden className="h-4 w-4" strokeWidth={2} />}
          {hidden ? 'Show' : 'Hide'}
        </button>
        <button type="button" className={PANEL_BTN} onClick={onCancel}>
          {hidden ? 'Keep it hidden' : 'Keep showing'}
        </button>
      </div>
    </form>
  );
}

/** Report · Stop this guest shooting — the photo's other two moderation presses, one tap behind ⋯. */
function MorePanel({
  eventId,
  item,
  who,
  blocked,
  back,
  onDone,
}: {
  eventId: string;
  item: MemoriesItem;
  who: string | null;
  blocked: boolean;
  back: React.ReactNode;
  onDone: () => void;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const canReport = item.table === 'papic_guest_captures' && item.look !== 'reported';
  return (
    <div data-viewer-more-panel="">
      <PanelHead title="More" />
      {canReport ? (
        <form action={reportCapture.bind(null, eventId)} className="pb-3">
          {back}
          <input type="hidden" name="capture_id" value={item.id} />
          <input type="hidden" name="reason" value={reason ?? ''} />
          <p className="flex items-center gap-2 pb-1.5 text-[14.5px] font-medium">
            <Flag aria-hidden className="h-4 w-4" strokeWidth={1.9} /> Report this photo — why?
          </p>
          <div className="flex flex-wrap gap-1.5">
            {REPORT_REASONS.map((r) => (
              <button
                key={r.key}
                type="button"
                aria-pressed={reason === r.key}
                onClick={() => setReason(r.key)}
                className={`sn-gal-btn min-h-[40px] rounded-full px-3 text-[13px] ${reason === r.key ? '!border-[var(--sn-ob-gold)] text-[var(--sn-ob-gold)]' : ''}`}
              >
                {r.label}
              </button>
            ))}
          </div>
          {reason ? (
            <button type="submit" className={`${PANEL_MAIN} mt-2`}>
              <Flag aria-hidden className="h-4 w-4" strokeWidth={2} /> Send the report
            </button>
          ) : null}
        </form>
      ) : null}
      {item.guestId ? (
        <form action={(blocked ? unblockUploader : blockUploader).bind(null, eventId)} className="pb-2">
          {back}
          <input type="hidden" name="guest_id" value={item.guestId} />
          <button type="submit" className={PANEL_BTN}>
            <Ban aria-hidden className="h-4 w-4" strokeWidth={1.9} />
            {blocked ? `Let ${who ?? 'this guest'} shoot again` : `Stop ${who ?? 'this guest'} shooting · this event only`}
          </button>
        </form>
      ) : null}
      <button type="button" className={PANEL_BTN} onClick={onDone}>
        Done
      </button>
    </div>
  );
}

/**
 * 🏷 WHO IS IN THIS PHOTO — remove a wrong tag (a face match's guess), add the right person. Saves in place: each
 * press answers with the photo's tags as they now stand. Under "Only tagged" a tag decides which guest sees the photo.
 */
function TagPanel({
  eventId,
  table,
  photoId,
  fixture,
  onDone,
}: {
  eventId: string;
  table: 'papic_photos' | 'papic_guest_captures';
  photoId: string;
  fixture: PhotoTagState | null;
  onDone: () => void;
}) {
  const [state, setState] = useState<PhotoTagState | null>(fixture);
  const [error, setError] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [pending, start] = useTransition();

  const run = (op: 'read' | 'add' | 'remove', guestId?: string, name?: string) => {
    setError(null);
    if (fixture) {
      // The lab's stand-in: the same moves on local names (no session, nothing written).
      setState((s) => {
        if (!s) return s;
        if (op === 'remove') return { ...s, tagged: s.tagged.filter((t) => t.guestId !== guestId) };
        if (op === 'add' && guestId) return { ...s, tagged: [...s.tagged, { guestId, name: name ?? 'A guest', auto: false }] };
        return s;
      });
      if (op !== 'read') setSaid(op === 'remove' ? `Removed ${name}` : `Added ${name}`);
      return;
    }
    start(async () => {
      const r = await memoriesPhotoTags(eventId, { op, table, photoId, guestId });
      if (r.ok) {
        setState(r.state);
        if (op !== 'read') setSaid(op === 'remove' ? `Removed ${name}` : `Added ${name}`);
      } else setError(r.error);
    });
  };
  useEffect(() => {
    if (!fixture) run('read');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per photo
  }, [photoId]);

  const candidates = state ? addCandidates(state, q, 8) : [];
  return (
    <div data-viewer-tag="">
      <PanelHead
        title="Who is in this photo"
        line={said ?? 'Remove a wrong tag, add the right person.'}
        tip="Tags decide who sees a photo when Memories shows each guest only the photos they are in. A face match can guess wrong — remove it here and it won’t come back. A guest who said “Not me” isn’t offered; only they can undo that."
      />
      {error ? (
        <p role="alert" className="pb-2 text-[13.5px]">
          {error}
        </p>
      ) : null}
      {!state ? (
        <p className="sn-gal-soft pb-3 text-[13.5px]">{pending ? 'Loading who is tagged…' : error ? '' : 'Loading who is tagged…'}</p>
      ) : (
        <>
          <p className="sn-gal-soft pb-1 font-mono text-[10.5px] uppercase tracking-[0.14em]">In this photo</p>
          {state.tagged.length === 0 ? <p className="sn-gal-soft pb-2 text-[13.5px]">No one is tagged yet.</p> : null}
          <ul className="pb-2">
            {state.tagged.map((t) => (
              <li key={t.guestId} className="flex min-h-[48px] items-center gap-2" data-viewer-tagged={t.guestId}>
                <span className="min-w-0 flex-1 truncate text-[15px]">
                  {t.name}
                  {t.auto ? <span className="sn-gal-soft text-[12px]"> · face match</span> : null}
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run('remove', t.guestId, t.name)}
                  className="sn-gal-btn inline-flex min-h-[40px] items-center gap-1 rounded-full px-3 text-[13px]"
                  data-viewer-untag={t.guestId}
                >
                  <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2.2} /> Remove
                </button>
              </li>
            ))}
          </ul>
          <p className="sn-gal-soft pb-1 font-mono text-[10.5px] uppercase tracking-[0.14em]">Add someone</p>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search your guests"
            aria-label="Search your guests"
            className="mb-1 h-11 w-full rounded-full border border-[rgb(251_250_247/0.28)] bg-transparent px-4 text-[15px] text-[var(--sn-ob-text)] placeholder:text-[var(--sn-ob-soft)]"
            data-viewer-tag-search=""
          />
          <ul className="pb-2">
            {candidates.map((g) => (
              <li key={g.guestId} className="flex min-h-[48px] items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[15px]">{g.name}</span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run('add', g.guestId, g.name)}
                  className="sn-gal-btn inline-flex min-h-[40px] items-center gap-1 rounded-full px-3 text-[13px]"
                  data-viewer-addtag={g.guestId}
                >
                  <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2.2} /> Add
                </button>
              </li>
            ))}
            {q.trim() && candidates.length === 0 ? <li className="sn-gal-soft py-2 text-[13.5px]">No guest matches “{q.trim()}”.</li> : null}
          </ul>
          {!state.complete ? <p className="sn-gal-soft pb-2 text-[12.5px]">We couldn’t read your whole guest list — some names may be missing.</p> : null}
        </>
      )}
      <button type="button" className={PANEL_BTN} onClick={onDone}>
        Done
      </button>
    </div>
  );
}
