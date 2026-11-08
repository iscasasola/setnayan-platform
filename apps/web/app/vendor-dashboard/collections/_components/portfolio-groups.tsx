'use client';

import { useId, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { Check, ChevronRight, ExternalLink, Link2, Play, Plus } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { useToast } from '@/app/_components/toast/toast-provider';
import { DatesRow } from '../../customers/_components/dates-row';
import { BodyPanel } from '../../_components/body-panel';
import { updateVendorProfileField } from '../../actions';
import { formatCount } from '@/lib/format-number';
import { parseVideoLink } from '@/lib/video-embed';
import { groupCount, type PortfolioAlbum, type PortfolioGroups, type PortfolioStory } from '@/lib/portfolio-groups';
import { INSPIRATION_LIBRARY_HREF, INSPIRATION_LIBRARY_ROW } from '@/lib/inspiration-library-entry';

/**
 * 🖼 PORTFOLIO, GROUPED (Build 2, lane B2-B — v118 `?tab=portfolio`).
 *
 *   §10 #35  ALL YOUR EVENTS · YOUR SERVICES · INSPIRATION YOU CURATED (each a list of albums, `lib/portfolio-groups.ts`),
 *            then STORIES COUPLES PUBLISHED (the parity item — the same stories Promote › Share your work shares), then ALL
 *            PHOTOS (the page gallery), then VIDEO LINKS: a row per link — tap opens it in place to edit (Link ·
 *            Remove · Save), ▶ at the row's end plays it in a pop-up player, and under the list "Add another link" in
 *            the Shop's "Add a service" style.
 *   §10 #40  AN OPENED ALBUM PINS AND TAKES THE WHOLE BODY — the shared in-body panel (`BodyPanel`, the Makers' panel):
 *            it grows out of its row (520 ms), the top bar and the bottom nav stay, × shrinks it back into the row at the
 *            exact prior scroll. Supersedes #24's open-in-place for albums.
 *   The ✓ circle on each album row stays the separate "pick for Show" control (#24).
 *
 * 🔑 NO NEW TABLE. Video links are the shipped `vendor_profiles.gallery_video_links` (URLs only, ≤ 10), saved through
 * the shipped `updateVendorProfileField('gallery_videos')` — RULE 0: the column existed. It stores no title, so a row is
 * named by its platform ("YouTube video"); a Title field waits on a stored title (B2-B notes, NEEDS).
 * 🔒 collections/the-portfolio-is-all-media.test.ts · lib/portfolio-groups.test.ts
 */
export type PickKey = string;

export function PortfolioGroupsView({
  groups,
  allPhotos,
  libraryOpen,
  videoLinks,
  picked,
  onPick,
}: {
  groups: PortfolioGroups;
  /** The page gallery's display URLs, newest first (its own order reversed). */
  allPhotos: string[];
  libraryOpen: boolean;
  videoLinks: string[];
  picked: PickKey | null;
  onPick: (key: PickKey, album: { title: string; urls: string[] }) => void;
}) {
  const [open, setOpen] = useState<{ key: PickKey; album: PortfolioAlbum } | null>(null);
  const rows = useRef<Record<string, HTMLElement | null>>({});
  const frame = useRef<HTMLElement | null>(null);

  const group = (id: string, title: string, sub: string, albums: PortfolioAlbum[] | null, empty: string, extra?: React.ReactNode) => (
    <section aria-labelledby={`pf-${id}-h`} data-portfolio-group={id}>
      <div className="border-b border-ink/10 pb-1.5 pt-4">
        <h2 id={`pf-${id}-h`} className="sn-eye">
          {title}
          {groupCount(albums)}
        </h2>
        <p className="text-[12.5px] text-ink/60">{sub}</p>
      </div>
      {albums === null ? (
        <p role="status" className="py-3 text-[13.5px] text-ink/65" data-portfolio-group-unread={id}>
          Couldn&rsquo;t load these just now — nothing was lost.
        </p>
      ) : albums.length === 0 ? (
        <p className="py-3 text-[13.5px] text-ink/60">{empty}</p>
      ) : (
        <ul className="divide-y divide-ink/10">
          {albums.map((a) => {
            const key = `${id}:${a.key}`;
            return (
              <li key={key}>
                <AlbumRow
                  a={a}
                  picked={picked === key}
                  open={open?.key === key}
                  rowRef={(el) => {
                    rows.current[key] = el;
                    if (el && !frame.current) frame.current = el.closest('[data-portfolio-tab],[data-portfolio-tab-lab]');
                  }}
                  onOpen={() => setOpen({ key, album: a })}
                  onPick={() => onPick(key, { title: a.title, urls: a.urls })}
                />
              </li>
            );
          })}
        </ul>
      )}
      {extra}
    </section>
  );

  const stories = groups.stories;
  return (
    <div className="space-y-2" data-portfolio-groups="">
      {group('events', 'All your events', 'one album per event · newest first', groups.events, 'Nothing yet · fills when a couple shares their Papic photos with you')}
      {group('services', 'Your services', 'the photos on each service card', groups.services, 'No service card has a photo yet')}
      {groups.inspiration === 'off'
        ? null
        : group(
            'inspiration',
            'Inspiration you curated',
            'looks Setnayan approved for couples',
            groups.inspiration,
            'None approved yet',
            libraryOpen ? (
              <div className="border-t border-ink/10">
                <DatesRow data="portfolio-inspiration-library" title={INSPIRATION_LIBRARY_ROW.label} line={INSPIRATION_LIBRARY_ROW.line} href={INSPIRATION_LIBRARY_HREF} />
              </div>
            ) : null,
          )}

      <StoriesGroup stories={stories} />

      <section aria-labelledby="pf-all-h" data-portfolio-group="all">
        <div className="flex items-end justify-between gap-3 border-b border-ink/10 pb-1.5 pt-4">
          <span>
            <h2 id="pf-all-h" className="sn-eye">
              All photos · {formatCount(allPhotos.length)}
            </h2>
            <p className="text-[12.5px] text-ink/60">the photos on your page · newest first</p>
          </span>
          {allPhotos.length > 0 ? <PickCircle picked={picked === 'all'} title="All photos" onPick={() => onPick('all', { title: 'All photos', urls: allPhotos })} /> : null}
        </div>
        {allPhotos.length === 0 ? (
          <p className="py-3 text-[13.5px] text-ink/60">Nothing yet · Add photos</p>
        ) : (
          <ul className="grid grid-cols-3 gap-1 pt-2" data-portfolio-all="">
            {allPhotos.map((u) => (
              <li key={u} className="aspect-square overflow-hidden rounded-md bg-ink/5">
                {/* eslint-disable-next-line @next/next/no-img-element -- presigned display URLs */}
                <img src={u} alt="" className="h-full w-full object-cover" loading="lazy" />
              </li>
            ))}
          </ul>
        )}
      </section>

      <VideoLinks initial={videoLinks} />

      {open ? (
        <BodyPanel
          origin={rows.current[open.key] ?? null}
          frame={frame.current}
          title={open.album.title}
          sub={open.album.line}
          lead={<Cover urls={open.album.urls} />}
          onClose={() => setOpen(null)}
          data={`album-${open.key.split(':')[0]}`}
        >
          <AlbumGrid a={open.album} />
        </BodyPanel>
      ) : null}
    </div>
  );
}

/** The album's first four photos, 2 × 2 (v113/v118's album rows). */
function Cover({ urls }: { urls: string[] }) {
  return (
    <span aria-hidden className="grid h-12 w-12 flex-none grid-cols-2 gap-0.5 overflow-hidden rounded-lg bg-ink/5">
      {urls.slice(0, 4).map((u) => (
        // eslint-disable-next-line @next/next/no-img-element -- presigned display URLs
        <img key={u} src={u} alt="" className="h-full w-full object-cover" loading="lazy" />
      ))}
    </span>
  );
}

function PickCircle({ picked, title, onPick }: { picked: boolean; title: string; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={picked}
      aria-label={picked ? `${title} — picked for Show` : `Pick ${title} for Show`}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
      data-album-pick=""
    >
      <span className={`grid h-6 w-6 place-items-center rounded-full border-[1.5px] ${picked ? 'border-transparent bg-[color:var(--m-orange)] text-white' : 'border-ink/25 text-transparent'}`}>
        <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
    </button>
  );
}

function AlbumRow({
  a,
  picked,
  open,
  rowRef,
  onOpen,
  onPick,
}: {
  a: PortfolioAlbum;
  picked: boolean;
  open: boolean;
  rowRef: (el: HTMLElement | null) => void;
  onOpen: () => void;
  onPick: () => void;
}) {
  return (
    <div ref={rowRef} className="flex items-center gap-1" data-album-row={a.key}>
      <button type="button" onClick={onOpen} aria-expanded={open} className="sn-press flex min-h-[64px] min-w-0 flex-1 items-center gap-3 py-2.5 text-left">
        <Cover urls={a.urls} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium leading-tight text-ink">{a.title}</span>
          <span className="mt-0.5 block truncate text-[13px] text-ink/60">{a.line}</span>
        </span>
      </button>
      {a.urls.length > 0 ? <PickCircle picked={picked} title={a.title} onPick={onPick} /> : null}
      <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-ink/40" strokeWidth={2} />
    </div>
  );
}

/** The opened album: its photos 3 across; past the panel's worth, a "+N" tile to the album's own screen (when it has one). */
function AlbumGrid({ a }: { a: PortfolioAlbum }) {
  const more = a.total - a.urls.length;
  return (
    <div data-album-open="">
      {a.urls.length === 0 ? (
        <p className="py-3 text-[13.5px] text-ink/65">These photos couldn&rsquo;t be shown just now.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-1" data-album-grid="">
          {a.urls.map((u) => (
            <li key={u} className="aspect-square overflow-hidden rounded-md bg-ink/5">
              {/* eslint-disable-next-line @next/next/no-img-element -- presigned display URLs */}
              <img src={u} alt="" className="h-full w-full object-cover" loading="lazy" />
            </li>
          ))}
          {more > 0 ? (
            <li className="aspect-square">
              {a.href ? (
                <Link href={a.href} className="grid h-full w-full place-items-center rounded-md bg-ink/[0.06] text-[17px] font-semibold text-ink/70" data-album-more="">
                  +{formatCount(more)}
                </Link>
              ) : (
                <span className="grid h-full w-full place-items-center rounded-md bg-ink/[0.06] text-[17px] font-semibold text-ink/70" data-album-more="">
                  +{formatCount(more)}
                </span>
              )}
            </li>
          ) : null}
        </ul>
      )}
      {a.href ? (
        <div className="pt-3">
          <DatesRow data="album-page" title="The whole album" line="Every photo · put one on your page" href={a.href} />
        </div>
      ) : null}
    </div>
  );
}

/** 📣 STORIES COUPLES PUBLISHED — the same list Promote › Share your work shares from; each opens the couple's story. */
function StoriesGroup({ stories }: { stories: PortfolioStory[] | null }) {
  return (
    <section aria-labelledby="pf-stories-h" data-portfolio-group="stories">
      <div className="border-b border-ink/10 pb-1.5 pt-4">
        <h2 id="pf-stories-h" className="sn-eye">
          Stories couples published{groupCount(stories)}
        </h2>
        <p className="text-[12.5px] text-ink/60">your shop is credited · share them from Promote</p>
      </div>
      {stories === null ? (
        <p role="status" className="py-3 text-[13.5px] text-ink/65" data-portfolio-group-unread="stories">
          Couldn&rsquo;t load these just now — nothing was lost.
        </p>
      ) : stories.length === 0 ? (
        <p className="py-3 text-[13.5px] text-ink/60">None yet · a couple you worked with publishes their event to Stories</p>
      ) : (
        <ul className="divide-y divide-ink/10" data-portfolio-stories="">
          {stories.map((s) => (
            <li key={s.eventId}>
              <a href={`/${s.slug}`} target="_blank" rel="noreferrer" className="sn-press flex min-h-[60px] items-center gap-3 py-2.5" data-portfolio-story={s.slug}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium text-ink">{s.hostNames}</span>
                  {s.line ? <span className="block truncate text-[13px] text-ink/60">{s.line}</span> : null}
                </span>
                <ExternalLink aria-hidden className="h-4 w-4 shrink-0 text-ink/40" strokeWidth={2} />
              </a>
            </li>
          ))}
          <li>
            <DatesRow data="portfolio-stories-share" title="Share them" line="Facebook · Pinterest · the story card" href="/vendor-dashboard/shop/promote#share" />
          </li>
        </ul>
      )}
    </section>
  );
}

const MAX_LINKS = 10;

/** "youtube.com/watch?v=sde-rs" — the link without its scheme, for the row's second line. */
function shortLink(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
}

/**
 * 🎬 VIDEO LINKS (§10 #35) — the shipped column, edited row by row. Tap a row → it opens in place (Link · Remove · Save);
 * ▶ plays an embeddable link in a pop-up player (YouTube, Vimeo), and opens the others where they live (Facebook,
 * Instagram, TikTok, Drive). "Add another link" opens a new row ready to paste. Every Save writes the WHOLE list, the
 * way the shipped editor always has (`gallery_video_links`, ≤ 10, re-validated on the server).
 */
function VideoLinks({ initial }: { initial: string[] }) {
  const toast = useToast();
  const [links, setLinks] = useState<string[]>(initial);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [playing, setPlaying] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const playerTitle = useId();

  const save = (next: string[], word: string) =>
    start(async () => {
      const fd = new FormData();
      fd.set('field', 'gallery_videos');
      for (const l of next) fd.append('gallery_video_links', l);
      const r = await updateVendorProfileField(null, fd);
      if (r.ok) {
        setLinks(next);
        setEditing(null);
        toast.success(word);
      } else toast.error(r.error);
    });

  const open = (i: number) => {
    setEditing((cur) => (cur === i ? null : i));
    setDraft(links[i] ?? '');
  };
  const parsedDraft = draft.trim() ? parseVideoLink(draft.trim()) : null;
  const rows = editing !== null && editing >= links.length ? [...links, ''] : links;
  const play = playing ? parseVideoLink(playing) : null;

  return (
    <section aria-labelledby="pf-video-h" data-portfolio-group="video">
      <div className="border-b border-ink/10 pb-1.5 pt-4">
        <h2 id="pf-video-h" className="sn-eye">
          Video links · {formatCount(links.length)}
        </h2>
        <p className="text-[12.5px] text-ink/60">tap one to edit · ▶ plays it</p>
      </div>
      <ul className="divide-y divide-ink/10" data-video-links="">
        {rows.map((l, i) => {
          const p = l ? parseVideoLink(l) : null;
          const isOpen = editing === i;
          return (
            <li key={`${i}-${l}`} data-video-link={i}>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => open(i)} aria-expanded={isOpen} className="sn-press flex min-h-[60px] min-w-0 flex-1 items-center gap-3 py-2.5 text-left">
                  <Link2 aria-hidden className="h-4 w-4 shrink-0 text-ink/55" strokeWidth={2} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-ink">{p ? `${p.label} video` : 'New video link'}</span>
                    <span className="block truncate text-[13px] text-ink/60">{l ? shortLink(l) : 'Paste the link'}</span>
                  </span>
                </button>
                <button
                  type="button"
                  disabled={!p}
                  onClick={() => (p?.kind === 'iframe' ? setPlaying(l) : p ? window.open(p.originalUrl, '_blank', 'noopener,noreferrer') : null)}
                  aria-label={p ? `Play ${p.label} video` : 'Play — paste a link first'}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-[color:var(--m-paper)] disabled:opacity-30"
                  data-video-play=""
                >
                  <Play aria-hidden className="h-4 w-4 fill-current" strokeWidth={0} />
                </button>
              </div>
              {/* Opens IN PLACE — the house 520 ms; off under reduced motion. */}
              <div
                className="grid transition-[grid-template-rows] motion-reduce:transition-none"
                style={{ gridTemplateRows: isOpen ? '1fr' : '0fr', transitionDuration: '520ms', transitionTimingFunction: 'cubic-bezier(.2,.8,.2,1)' }}
                aria-hidden={!isOpen}
              >
                <div className="min-h-0 overflow-hidden">
                  <div className="space-y-2 pb-3" data-video-edit="">
                    <label className="block text-[12px] font-semibold uppercase tracking-[0.08em] text-ink/60" htmlFor={`vl-${i}`}>
                      Link
                    </label>
                    <input
                      id={`vl-${i}`}
                      type="url"
                      inputMode="url"
                      value={isOpen ? draft : l}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="youtube.com/… or vimeo.com/…"
                      className="input-field w-full"
                      tabIndex={isOpen ? undefined : -1}
                      aria-invalid={draft.trim().length > 0 && parsedDraft === null ? true : undefined}
                    />
                    {draft.trim().length > 0 && parsedDraft === null ? <p className="text-[12.5px] text-[color:rgb(var(--color-danger))]">That doesn&rsquo;t look like a video link.</p> : null}
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        disabled={pending}
                        tabIndex={isOpen ? undefined : -1}
                        onClick={() => (i < links.length ? save(links.filter((_, j) => j !== i), 'Link removed') : setEditing(null))}
                        className="min-h-11 flex-1 rounded-full border border-ink/15 text-[14px] font-medium text-ink"
                        data-video-remove=""
                      >
                        Remove
                      </button>
                      <button
                        type="button"
                        disabled={pending || !parsedDraft}
                        tabIndex={isOpen ? undefined : -1}
                        onClick={() => parsedDraft && save(i < links.length ? links.map((x, j) => (j === i ? parsedDraft.originalUrl : x)) : [...links, parsedDraft.originalUrl], 'Link saved')}
                        className="min-h-11 flex-1 rounded-full bg-ink text-[14px] font-semibold text-[color:var(--m-paper)] disabled:opacity-40"
                        data-video-save=""
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {links.length < MAX_LINKS ? (
        <button
          type="button"
          onClick={() => {
            setEditing(links.length);
            setDraft('');
          }}
          className="mt-3 flex w-full items-center gap-3 rounded-2xl border-[1.5px] border-dashed border-ink/20 px-3 py-3.5 text-left"
          data-video-add=""
        >
          <span aria-hidden className="grid h-10 w-10 flex-none place-items-center rounded-full border-[1.5px] border-[color:var(--m-orange)] text-[color:var(--m-orange)]">
            <Plus className="h-5 w-5" strokeWidth={2} />
          </span>
          <span className="min-w-0 flex-1">
            <b className="block text-[16px] font-semibold text-ink">Add another link</b>
            <small className="block text-[12.5px] text-ink/60">YouTube, Vimeo, Facebook, Instagram or TikTok video</small>
          </span>
          <ChevronRight aria-hidden className="h-4 w-4 text-ink/40" strokeWidth={2} />
        </button>
      ) : (
        <p className="pt-3 text-[12.5px] text-ink/60">Up to {MAX_LINKS} video links.</p>
      )}

      <Sheet open={playing !== null} onClose={() => setPlaying(null)} labelledById={playerTitle} rise>
        <div className="space-y-3 px-4 pb-6 pt-2" data-video-player="">
          <h2 id={playerTitle} className="text-[15px] font-semibold text-ink">
            {play ? `${play.label} video` : 'Video'}
          </h2>
          {play?.embedUrl ? (
            <div className="aspect-video overflow-hidden rounded-xl bg-black">
              <iframe src={play.embedUrl} title={`${play.label} video`} className="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
            </div>
          ) : null}
          <p className="text-center text-[12.5px] text-ink/60">{playing ? shortLink(playing) : ''} · plays here, in place</p>
        </div>
      </Sheet>
    </section>
  );
}
