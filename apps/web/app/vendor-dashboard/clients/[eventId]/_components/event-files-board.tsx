'use client';

import { useId, useMemo, useRef, useState, useTransition } from 'react';
import { CheckCircle2, Clock, EyeOff, FileText, Images, Link2, Play, Plus, Search, SlidersHorizontal, Trash2, Upload } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { InfoTip } from '@/app/_components/info-tip';
import { ActionButton } from '@/components/action-button';
import { formatCount } from '@/lib/format-number';
import {
  SHOP_RULES_LINE,
  UPLOAD_FOR,
  fileKindOf,
  hubCountLine,
  shopStateWords,
  type ShopState,
} from '@/lib/supplier-files';
import type { EventFile, PortfolioPick, QuotedService } from '@/lib/supplier-files.server';
import { eventFilesAction, type EventFilesState } from '@/app/_actions/event-files-actions';

/**
 * 📁 A SUPPLIER'S FILES FOR ONE EVENT — the board (Piece 3b · prototype legend rows 139–143 · 149; DECISION_LOG
 * 2026-11-12 Files rows). Loaded with its page, never on the route's first load (`_pages/lazy.tsx`).
 *
 *   • Thumb row: Search files · Show & sort (Group by Service · None — Sort Newest · Oldest · Name · Size — Show
 *     Everything · Photos · Documents · Videos) · ＋ (From your portfolio · Upload new).
 *   • Order: This booking (documents, a list) · From the chat · not filed yet · Links · then one group per QUOTED
 *     service, drawn as the shipped Portfolio grid (full-bleed, 3 columns, 2 px gaps, two rows then "+N"). A portfolio
 *     photo mapped from a service outside the quote sits under "Linked · <its service>" — never filed.
 *   • Upload new asks first: For a service (photo/video → a quoted service) or For this booking (a document). Each file
 *     is hashed on the phone; bytes already stored are NOT uploaded again — they become a link. Its own EXIF date rides
 *     along, so the state shows at once.
 *   • Each photo carries its state on the shop: Waiting for <couple> · Shown · Not from this event's dates · Already in
 *     your portfolio · linked · Kept private · their choice. The (i) says the three rules.
 *
 * `mode="hub"` draws the Hub's "Event photos · by service": the service groups ONLY (unfiled chat photos never reach
 * it), the count line, and — while the booking fee is unsettled — the tiles greyed under "Unlisted until your booking
 * fee is settled".
 */
export type EventFilesBoardProps = {
  mode: 'files' | 'hub';
  eventId: string;
  shopId: string;
  coupleName: string;
  eventDate: string | null;
  quoted: QuotedService[];
  serviceTitles: Record<string, string>;
  files: EventFile[];
  /** null = the portfolio read was refused (said, never drawn as an empty portfolio). */
  picks: PortfolioPick[] | null;
  feeUnlocked: boolean;
  returnPath: string;
};

type Sort = 'newest' | 'oldest' | 'name' | 'size';
type Show = 'all' | 'photo' | 'document' | 'video';

const STATE_ICON: Record<ShopState, typeof Clock> = {
  waiting: Clock,
  shown: CheckCircle2,
  outside: EyeOff,
  linked: Link2,
  hidden: EyeOff,
};

export function EventFilesBoard(p: EventFilesBoardProps) {
  const [q, setQ] = useState('');
  const [groupBy, setGroupBy] = useState<'service' | 'none'>('service');
  const [sort, setSort] = useState<Sort>('newest');
  const [show, setShow] = useState<Show>('all');
  const [sortOpen, setSortOpen] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [uploadStep, setUploadStep] = useState<null | 'for' | 'service'>(null);
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const [viewer, setViewer] = useState<EventFile | null>(null);
  const [said, setSaid] = useState<{ ok: boolean; words: string } | null>(null);
  const [busy, start] = useTransition();
  const target = useRef<{ grp: 'service' | 'booking'; serviceId: string | null }>({ grp: 'booking', serviceId: null });
  const input = useRef<HTMLInputElement>(null);
  const ids = { sort: useId(), plus: useId(), upl: useId(), pf: useId(), view: useId() };

  const quotedIds = useMemo(() => new Set(p.quoted.map((s) => s.id)), [p.quoted]);
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = p.files.filter((f) => {
      if (p.mode === 'hub' && !(f.grp === 'service' || (f.grp === 'linked' && f.serviceId && quotedIds.has(f.serviceId)))) return false;
      if (show !== 'all' && f.kind !== show) return false;
      if (!needle) return true;
      const svc = f.serviceId ? (p.serviceTitles[f.serviceId] ?? '') : '';
      return `${f.name} ${svc}`.toLowerCase().includes(needle);
    });
    const by: Record<Sort, (a: EventFile, b: EventFile) => number> = {
      newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
      oldest: (a, b) => a.createdAt.localeCompare(b.createdAt),
      name: (a, b) => a.name.localeCompare(b.name),
      size: (a, b) => (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0),
    };
    return [...rows].sort(by[sort]);
  }, [p.files, p.mode, p.serviceTitles, q, show, sort, quotedIds]);

  const groups = useMemo(() => {
    if (groupBy === 'none') return [{ key: 'all', title: 'Everything', rows: visible, grid: true }];
    const out: { key: string; title: string; rows: EventFile[]; grid: boolean }[] = [];
    if (p.mode === 'files') {
      out.push({ key: 'booking', title: 'This booking', rows: visible.filter((f) => f.grp === 'booking'), grid: false });
      const unfiled = visible.filter((f) => f.grp === 'unfiled');
      if (unfiled.length) out.push({ key: 'unfiled', title: 'From the chat · not filed yet', rows: unfiled, grid: true });
      const links = visible.filter((f) => f.grp === 'links');
      if (links.length) out.push({ key: 'links', title: 'Links', rows: links, grid: false });
    }
    for (const s of p.quoted) {
      out.push({
        key: s.id,
        title: s.title,
        rows: visible.filter((f) => (f.grp === 'service' || f.grp === 'linked') && f.serviceId === s.id),
        grid: true,
      });
    }
    if (p.mode === 'files') {
      const outside = visible.filter((f) => f.grp === 'linked' && !(f.serviceId && quotedIds.has(f.serviceId)));
      for (const sid of [...new Set(outside.map((f) => f.serviceId ?? ''))]) {
        out.push({
          key: `linked-${sid}`,
          title: `Linked · ${sid ? (p.serviceTitles[sid] ?? 'a service') : 'your portfolio'}`,
          rows: outside.filter((f) => (f.serviceId ?? '') === sid),
          grid: true,
        });
      }
    }
    return out;
  }, [groupBy, visible, p.mode, p.quoted, p.serviceTitles, quotedIds]);

  const states = p.files.filter((f) => f.grp === 'service' || f.grp === 'linked').map((f) => f.state);

  const run = (fd: FormData) =>
    new Promise<EventFilesState>((resolve) => {
      fd.set('event_id', p.eventId);
      fd.set('return_path', p.returnPath);
      eventFilesAction({ status: 'idle' }, fd).then(resolve, () => resolve({ status: 'error', message: 'We couldn’t reach Setnayan. Please try again.' }));
    });

  /** Upload new: hash on the phone → skip the upload when the bytes are stored → else presign, PUT, file. */
  const onPicked = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const files = [...list];
    const { grp, serviceId } = target.current;
    start(async () => {
      let ok = 0;
      let linked = 0;
      for (const file of files) {
        const kind = fileKindOf(file.type, file.name);
        if (grp === 'service' && kind === 'document') {
          setSaid({ ok: false, words: `${file.name} is a document — it goes in This booking.` });
          continue;
        }
        if (grp === 'booking' && kind !== 'document') {
          setSaid({ ok: false, words: `${file.name} is a ${kind} — it goes under a quoted service.` });
          continue;
        }
        const buf = await file.arrayBuffer();
        const sha = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buf))].map((b) => b.toString(16).padStart(2, '0')).join('');
        const kfd = new FormData();
        kfd.set('op', 'known');
        kfd.set('sha256', sha);
        const known = await run(kfd);
        const fd = new FormData();
        fd.set('op', 'file');
        fd.set('grp', grp);
        if (serviceId) fd.set('service_id', serviceId);
        fd.set('name', file.name);
        fd.set('mime', file.type);
        fd.set('size_bytes', String(file.size));
        if (known.status === 'known' && known.mediaId) {
          fd.set('media_id', known.mediaId);
          linked++;
        } else {
          const pre = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              bucket: 'thread-files',
              pathPrefix: `supplier-files/${p.shopId}/${p.eventId}`,
              filename: file.name,
              contentType: file.type || 'application/octet-stream',
              sizeBytes: file.size,
            }),
          })
            .then((r) => r.json() as Promise<{ uploadUrl?: string; r2Ref?: string; error?: string }>)
            .catch(() => ({ error: 'We couldn’t reach Setnayan.' }) as { uploadUrl?: string; r2Ref?: string; error?: string });
          if (!pre.uploadUrl || !pre.r2Ref) {
            setSaid({ ok: false, words: pre.error ?? `${file.name} could not be uploaded.` });
            continue;
          }
          const put = await fetch(pre.uploadUrl, { method: 'PUT', headers: { 'content-type': file.type || 'application/octet-stream' }, body: file }).catch(() => null);
          if (!put || !put.ok) {
            setSaid({ ok: false, words: `${file.name} did not finish uploading. Please try again.` });
            continue;
          }
          // The server re-reads the bytes for the hash and the date it stores; the phone's hash only skips a re-upload.
          fd.set('r2_ref', pre.r2Ref);
        }
        const r = await run(fd);
        if (r.status === 'error') setSaid({ ok: false, words: r.message });
        else ok++;
      }
      if (ok) {
        setSaid({
          ok: true,
          words:
            grp === 'booking'
              ? 'Added to This booking'
              : linked
                ? `Added ${formatCount(ok)} · ${formatCount(linked)} already stored · linked, not copied`
                : `Added ${formatCount(ok)} · stays on ${p.serviceTitles[serviceId ?? ''] ?? 'this service'} for this event`,
        });
      }
      if (input.current) input.current.value = '';
    });
  };

  const startUpload = (grp: 'service' | 'booking', serviceId: string | null) => {
    target.current = { grp, serviceId };
    setUploadStep(null);
    if (input.current) {
      input.current.accept = grp === 'service' ? 'image/*,video/*' : 'application/pdf,.doc,.docx,.xls,.xlsx,.txt';
      input.current.click();
    }
  };

  return (
    <div className="space-y-5" data-event-files-board={p.mode}>
      {p.mode === 'hub' ? (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <InfoTip label="Event photos · by service" labelAs="h2" labelClassName="text-[17px] font-semibold text-ink" align="start">
            {SHOP_RULES_LINE}
          </InfoTip>
          <p className="text-[13px] text-ink/65" data-hub-count-line>
            {hubCountLine(states)}
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-2" data-files-thumb-row>
          <label className="flex min-h-11 flex-1 items-center gap-2 rounded-full bg-ink/[0.05] px-3.5">
            <Search className="h-4 w-4 flex-none text-ink/45" aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search files"
              aria-label="Search files"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink/45"
            />
          </label>
          <button
            type="button"
            aria-label="Show & sort"
            onClick={() => setSortOpen(true)}
            className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-full bg-ink/[0.05] text-ink/70"
            data-files-show-sort
          >
            <SlidersHorizontal className="h-[18px] w-[18px]" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Add a file"
            onClick={() => setPlusOpen(true)}
            className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-full bg-ink text-cream"
            data-files-plus
          >
            <Plus className="h-5 w-5" aria-hidden />
          </button>
        </div>
      )}

      {said ? (
        <p role="status" className={`text-sm ${said.ok ? 'text-success-700' : 'text-danger-700'}`}>
          {said.words}
        </p>
      ) : null}
      {busy ? (
        <p role="status" className="text-sm text-ink/60">
          Adding…
        </p>
      ) : null}
      {q.trim() && visible.length === 0 ? <p className="text-sm text-ink/60">No file matches “{q.trim()}”.</p> : null}

      {groups.map((g) => (
        <section key={g.key} aria-label={g.title} className="space-y-2" data-files-group={g.key}>
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink/60">
            {g.title} · {formatCount(g.rows.length)}
            {g.key === 'booking' ? <span className="ml-1 normal-case tracking-normal text-ink/45">kept after the event, never on your shop</span> : null}
          </h3>
          {g.rows.length === 0 ? (
            <p className="text-sm text-ink/55">
              {g.key === 'booking'
                ? 'Contracts, PDFs, menus and receipts for this booking land here.'
                : p.mode === 'hub'
                  ? 'No event photos under this service yet.'
                  : 'Nothing yet. Tap ＋ to add from your portfolio or upload new.'}
            </p>
          ) : g.grid ? (
            <Grid rows={g.rows} greyed={p.mode === 'hub' && !p.feeUnlocked} onOpen={setViewer} />
          ) : (
            <ul className="space-y-1.5">
              {g.rows.map((f) => (
                <li key={f.fileId}>
                  <a
                    href={f.url ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-12 items-center gap-3 rounded-xl bg-ink/[0.04] px-3.5 py-2 text-[15px] text-ink"
                  >
                    {f.kind === 'link' ? <Link2 className="h-4 w-4 flex-none text-ink/50" aria-hidden /> : <FileText className="h-4 w-4 flex-none text-ink/50" aria-hidden />}
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <span className="flex-none text-[12px] text-ink/50">{sizeWords(f.sizeBytes)}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      {p.mode === 'hub' && !p.feeUnlocked ? (
        <p className="text-[13px] text-ink/65" data-hub-fee-hold>
          Unlisted until your booking fee is settled.
        </p>
      ) : null}

      <input ref={input} type="file" multiple hidden onChange={(e) => onPicked(e.target.files)} data-files-input />

      {/* Show & sort */}
      <Sheet open={sortOpen} onClose={() => setSortOpen(false)} labelledById={ids.sort} rise>
        <div className="space-y-4 px-4 pb-4 pt-3">
          <h2 id={ids.sort} className="pr-12 text-[19px] font-semibold text-ink">
            Show &amp; sort
          </h2>
          <Choice label="Group by" value={groupBy} onPick={(v) => setGroupBy(v as 'service' | 'none')} options={[['service', 'Service'], ['none', 'None']]} />
          <Choice label="Sort" value={sort} onPick={(v) => setSort(v as Sort)} options={[['newest', 'Newest'], ['oldest', 'Oldest'], ['name', 'Name'], ['size', 'Size']]} />
          <Choice
            label="Show"
            value={show}
            onPick={(v) => setShow(v as Show)}
            options={[['all', 'Everything'], ['photo', 'Photos'], ['document', 'Documents'], ['video', 'Videos']]}
          />
        </div>
      </Sheet>

      {/* ＋ — the two doors */}
      <Sheet open={plusOpen} onClose={() => setPlusOpen(false)} labelledById={ids.plus} rise>
        <div className="space-y-2 px-4 pb-4 pt-3" data-files-plus-sheet>
          <h2 id={ids.plus} className="pr-12 text-[19px] font-semibold text-ink">
            Add a file
          </h2>
          <Door icon={Images} label="From your portfolio" line="Links the photo here — never a copy" onClick={() => (setPlusOpen(false), setPortfolioOpen(true))} />
          <Door icon={Upload} label="Upload new" line="From this phone or computer" onClick={() => (setPlusOpen(false), setUploadStep('for'))} />
        </div>
      </Sheet>

      {/* Upload new — for a service, or for this booking; then which quoted service */}
      <Sheet open={uploadStep !== null} onClose={() => setUploadStep(null)} labelledById={ids.upl} rise>
        <div className="space-y-2 px-4 pb-4 pt-3" data-files-upload-for={uploadStep ?? ''}>
          <h2 id={ids.upl} className="pr-12 text-[19px] font-semibold text-ink">
            {uploadStep === 'service' ? 'Which quoted service is this for?' : 'Upload new'}
          </h2>
          {uploadStep === 'for' ? (
            UPLOAD_FOR.map((u) => (
              <Door
                key={u.key}
                icon={u.key === 'service' ? Images : FileText}
                label={u.label}
                line={u.line}
                onClick={() => (u.key === 'booking' ? startUpload('booking', null) : setUploadStep('service'))}
              />
            ))
          ) : p.quoted.length === 0 ? (
            <p className="text-sm text-ink/65">Nothing is in this event&rsquo;s quote yet — photos go under a quoted service. Send a quote first.</p>
          ) : (
            <>
              {p.quoted.map((s) => (
                <Door key={s.id} icon={Images} label={s.title} line="Stays on this service for this event · never syncs to your other services" onClick={() => startUpload('service', s.id)} />
              ))}
            </>
          )}
        </div>
      </Sheet>

      {/* From your portfolio — maps, never copies */}
      <PortfolioSheet
        open={portfolioOpen}
        onClose={() => setPortfolioOpen(false)}
        titleId={ids.pf}
        picks={p.picks}
        quotedIds={quotedIds}
        onAdd={(refs) =>
          start(async () => {
            const fd = new FormData();
            fd.set('op', 'map');
            fd.set('refs', JSON.stringify(refs));
            const r = await run(fd);
            setSaid(r.status === 'error' ? { ok: false, words: r.message } : { ok: true, words: 'Added · linked, not copied' });
            setPortfolioOpen(false);
          })
        }
      />

      {/* The viewer */}
      <Sheet open={viewer !== null} onClose={() => setViewer(null)} labelledById={ids.view} rise>
        {viewer ? (
          <div className="space-y-3 px-4 pb-4 pt-3" data-files-viewer={viewer.fileId}>
            <h2 id={ids.view} className="pr-12 text-[17px] font-semibold text-ink [overflow-wrap:anywhere]">
              {viewer.name}
            </h2>
            {viewer.url && viewer.kind === 'photo' ? (
              // eslint-disable-next-line @next/next/no-img-element -- a signed private R2 link, not an optimisable asset
              <img src={viewer.url} alt={viewer.name} className="w-full rounded-xl object-contain" />
            ) : null}
            <p className="text-[13px] text-ink/65">
              {sizeWords(viewer.sizeBytes)} · {viewer.takenAt ? `taken ${dayWords(viewer.takenAt)}` : 'no date on the photo'} · added {dayWords(viewer.createdAt)}
              {viewer.serviceId ? ` · under ${p.serviceTitles[viewer.serviceId] ?? 'a service'}` : ''}
            </p>
            {viewer.state ? (
              <InfoTip label={`On your shop · ${shopStateWords(viewer.state, p.coupleName)}`} labelAs="p" labelClassName="text-[14px] font-medium text-ink" align="start">
                {SHOP_RULES_LINE}
              </InfoTip>
            ) : null}
            <ActionButton
              tone="neutral"
              icon={Trash2}
              label="Remove from this event"
              className="w-full"
              waiting={busy}
              onClick={() =>
                start(async () => {
                  const fd = new FormData();
                  fd.set('op', 'remove');
                  fd.set('file_id', viewer.fileId);
                  const r = await run(fd);
                  setSaid(r.status === 'error' ? { ok: false, words: r.message } : { ok: true, words: 'Removed from this event' });
                  setViewer(null);
                })
              }
            />
          </div>
        ) : (
          <h2 id={ids.view} className="sr-only">
            File
          </h2>
        )}
      </Sheet>
    </div>
  );
}

/** The shipped Portfolio grid's shape: full-bleed, 3 columns, 2 px gaps, square tiles, two rows then "+N". */
function Grid({ rows, greyed, onOpen }: { rows: EventFile[]; greyed: boolean; onOpen: (f: EventFile) => void }) {
  const [all, setAll] = useState(false);
  const cap = 6;
  const shown = all || rows.length <= cap ? rows : rows.slice(0, cap - 1);
  const more = rows.length - shown.length;
  return (
    <ul className={`-mx-4 grid grid-cols-3 gap-[2px] ${greyed ? 'opacity-45 grayscale' : ''}`} data-files-grid>
      {shown.map((f) => {
        const Icon = f.state ? STATE_ICON[f.state] : null;
        return (
          <li key={f.fileId} className="relative aspect-square bg-ink/[0.06]">
            <button type="button" onClick={() => onOpen(f)} aria-label={f.name} className="block h-full w-full">
              {f.url && f.kind === 'photo' ? (
                // eslint-disable-next-line @next/next/no-img-element -- a signed private R2 link, not an optimisable asset
                <img src={f.url} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-ink/40">
                  <Play className="h-6 w-6" aria-hidden />
                </span>
              )}
            </button>
            {f.kind === 'video' ? (
              <span className="pointer-events-none absolute bottom-1 left-1 inline-flex items-center gap-0.5 rounded-full bg-ink/70 px-1.5 py-0.5 text-[11px] text-white">
                <Play className="h-3 w-3" aria-hidden /> video
              </span>
            ) : null}
            {Icon ? (
              <span className="pointer-events-none absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-ink/65 text-white" data-tile-state={f.state}>
                <Icon className="h-3.5 w-3.5" aria-hidden />
              </span>
            ) : null}
          </li>
        );
      })}
      {more > 0 ? (
        <li className="aspect-square">
          <button type="button" onClick={() => setAll(true)} className="flex h-full w-full items-center justify-center bg-ink/[0.08] text-[17px] font-semibold text-ink/70">
            +{formatCount(more)}
          </button>
        </li>
      ) : null}
    </ul>
  );
}

function PortfolioSheet({
  open,
  onClose,
  titleId,
  picks,
  quotedIds,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  titleId: string;
  picks: PortfolioPick[] | null;
  quotedIds: Set<string>;
  onAdd: (refs: string[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const narrowed = (picks ?? []).filter((x) => !x.serviceId || quotedIds.has(x.serviceId));
  return (
    <Sheet
      open={open}
      onClose={() => (setPicked([]), onClose())}
      labelledById={titleId}
      rise
      foot={
        <div className="px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3">
          <ActionButton
            tone="brand"
            main
            icon={Link2}
            label={picked.length ? `Add ${formatCount(picked.length)} to this event` : 'Pick photos to add'}
            disabled={picked.length === 0}
            className="w-full"
            onClick={() => (onAdd(picked), setPicked([]))}
            data-testid="files-portfolio-add"
          />
        </div>
      }
    >
      <div className="space-y-3 px-4 pb-4 pt-3" data-files-portfolio>
        <h2 id={titleId} className="pr-12 text-[19px] font-semibold text-ink">
          Your portfolio · for this event
        </h2>
        <p className="text-[13px] text-ink/65">A pick is linked, never copied — the photo stays one photo on your portfolio.</p>
        {picks === null ? (
          <p role="alert" className="text-sm text-ink/70">
            We couldn’t load your portfolio. Reload in a moment — nothing was lost.
          </p>
        ) : narrowed.length === 0 ? (
          <p className="text-sm text-ink/60">No portfolio photos for this event’s quoted services yet.</p>
        ) : (
          <ul className="-mx-4 grid grid-cols-3 gap-[2px]">
            {narrowed.map((x) => {
              const on = picked.includes(x.ref);
              return (
                <li key={x.ref} className="relative aspect-square">
                  <button
                    type="button"
                    aria-pressed={on}
                    aria-label={x.serviceTitle ?? 'Portfolio photo'}
                    onClick={() => setPicked((s) => (on ? s.filter((r) => r !== x.ref) : [...s, x.ref]))}
                    className={`block h-full w-full ${on ? 'ring-4 ring-inset ring-sn-accent' : ''}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- a signed R2 link, not an optimisable asset */}
                    <img src={x.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </button>
                  {x.serviceTitle ? (
                    <span className="pointer-events-none absolute bottom-1 left-1 max-w-[90%] truncate rounded-full bg-ink/65 px-1.5 py-0.5 text-[10.5px] text-white">
                      {x.serviceTitle}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Sheet>
  );
}

function Door({ icon: Icon, label, line, onClick }: { icon: typeof Plus; label: string; line: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-14 w-full items-center gap-3 rounded-xl bg-ink/[0.04] px-3.5 py-2.5 text-left">
      <Icon className="h-5 w-5 flex-none text-sn-accent" aria-hidden />
      <span className="min-w-0">
        <span className="block text-[15px] font-medium text-ink">{label}</span>
        <span className="block text-[12px] text-ink/60">{line}</span>
      </span>
    </button>
  );
}

function Choice({ label, value, onPick, options }: { label: string; value: string; onPick: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/60">{label}</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map(([k, words]) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={value === k}
            onClick={() => onPick(k)}
            className={`min-h-11 rounded-full px-4 text-[14px] font-medium ${value === k ? 'bg-ink text-cream' : 'bg-ink/[0.05] text-ink/75'}`}
          >
            {words}
          </button>
        ))}
      </div>
    </div>
  );
}

function sizeWords(n: number | null): string {
  if (!n) return '';
  if (n >= 1024 * 1024) return `${formatCount(Math.round((n / (1024 * 1024)) * 10) / 10)} MB`;
  return `${formatCount(Math.max(1, Math.round(n / 1024)))} KB`;
}

function dayWords(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-PH', { day: 'numeric', month: 'short', timeZone: 'Asia/Manila' });
}
