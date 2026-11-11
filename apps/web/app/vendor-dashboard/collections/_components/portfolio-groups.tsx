'use client';

import { useId, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { ChevronRight, Link2, Play, Plus } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { FormRows, TypedRow } from '@/app/_components/form-row';
import type { KeepAnswer } from '@/lib/form-row';
import { useToast } from '@/app/_components/toast/toast-provider';
import { DatesRow } from '../../customers/_components/dates-row';
import { BodyPanel } from '../../_components/body-panel';
import { useRevealOnOpen } from '@/app/_components/reveal-on-open';
import { updateVendorProfileField } from '../../actions';
import { formatCount } from '@/lib/format-number';
import { parseVideoLink } from '@/lib/video-embed';
import { VIDEO_TITLE_MAX, videoRowName, videoTitlesFor } from '@/lib/video-link-titles';
import { PortfolioShow } from './portfolio-show';

/**
 * 🖼 THE OPENED COLLECTION (approved Portfolio, owner 9 Nov — "And this is how it expands if we open an album", with
 * iOS Photos › Library; DECISION_LOG "PORTFOLIO PROTOTYPE APPROVED FOR BUILD 5" (1) and (2)).
 *
 *   · It RISES out of the tapped tile or section head through the ONE in-body panel (`BodyPanel`, §10 #40): the top
 *     bar and the bottom nav stay, × shrinks it back into the same tile at the exact prior scroll.
 *   · Its head is the collection's name — a long album name WRAPS TO TWO LINES before it is cut — and its count.
 *   · Its body is a dense FULL-BLEED 3-column grid with 2-px gaps — the approved exception to the 16-px gutter rule;
 *     every text and button row in it keeps 16/16. Past what was loaded, a "+N" tile goes to the album's own screen.
 *   · One tap on a photo opens it full screen, swipeable (the shipped Show, landing on that photo).
 * Deferred (listed as follow-ups on the PR): the viewer's slide animation, Share → Send to a chat, Select.
 * 🔒 collections/the-portfolio-is-collections.test.ts · _components/the-body-panel-keeps-the-navs.test.ts
 */
export type OpenedPhotos = {
  title: string;
  /** "48 photos" · "Sun 8 Nov · 180 photos". */
  sub: string;
  urls: string[];
  /** How many the collection holds (the "+N" tile counts the rest). */
  total: number;
  /** Where the whole collection lives, when it has its own screen. */
  href: string | null;
};

export function OpenedCollection({
  origin,
  frame,
  data,
  onClose,
  photos = null,
  children = null,
}: {
  origin: HTMLElement | null;
  frame: HTMLElement | null;
  data: string;
  onClose: () => void;
  /** A photo collection — the full-bleed grid. */
  photos?: OpenedPhotos | null;
  /** Anything else the collection IS (Video links: the shipped editor), drawn on the gutter. */
  children?: React.ReactNode;
}) {
  const title = photos?.title ?? (data === 'video' ? 'Video links' : 'Collection');
  return (
    <BodyPanel origin={origin} frame={frame} title={title} sub={photos?.sub} onClose={onClose} data={`collection-${data}`} titleLines={2} bleed>
      {photos ? <PhotoGrid photos={photos} data={data} /> : <div className="px-4 pt-3">{children}</div>}
    </BodyPanel>
  );
}

/**
 * 🖼 A COLLECTION'S PHOTOS AS THE DENSE FULL-BLEED GRID — 3 columns, 2-px gaps, a "+N" tile past what was loaded, the
 * album's own screen as one row under it; one tap on a photo opens Show on it. Drawn by an opened collection (above) and
 * by a group risen full screen from its head (`portfolio-sections.tsx`, `GroupRise`) — one grid, never a second copy.
 */
export function PhotoGrid({ photos, data }: { photos: OpenedPhotos; data: string }) {
  const [showAt, setShowAt] = useState<number | null>(null);
  const more = photos.total - photos.urls.length;
  return (
    <div data-collection-open={data}>
      {photos.urls.length === 0 ? (
        <p className="px-4 py-4 text-[13.5px] text-ink/65">These photos couldn&rsquo;t be shown just now.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-[2px]" data-collection-grid="" data-bleed="">
          {photos.urls.map((u, i) => (
            <li key={`${i}-${u}`} className="aspect-square overflow-hidden bg-ink/5">
              <button type="button" onClick={() => setShowAt(i)} aria-label={`Photo ${formatCount(i + 1)} of ${formatCount(photos.total)}`} className="block h-full w-full">
                {/* eslint-disable-next-line @next/next/no-img-element -- presigned display URLs */}
                <img src={u} alt="" className="h-full w-full object-cover" loading="lazy" />
              </button>
            </li>
          ))}
          {more > 0 ? (
            <li className="aspect-square">
              {photos.href ? (
                <Link href={photos.href} className="grid h-full w-full place-items-center bg-ink/[0.06] text-[17px] font-semibold text-ink/70" data-album-more="">
                  +{formatCount(more)}
                </Link>
              ) : (
                <span className="grid h-full w-full place-items-center bg-ink/[0.06] text-[17px] font-semibold text-ink/70" data-album-more="">
                  +{formatCount(more)}
                </span>
              )}
            </li>
          ) : null}
        </ul>
      )}
      {photos.href ? (
        <div className="px-4 pt-3">
          <DatesRow data="album-page" title="The whole album" line="Every photo · put one on your page" href={photos.href} />
        </div>
      ) : null}
      {showAt !== null ? <PortfolioShow title={photos.title} urls={photos.urls} start={showAt} onClose={() => setShowAt(null)} /> : null}
    </div>
  );
}

/**
 * 📚 A GROUP OF ALBUMS, RISEN — every album in the group under its own name and count, each its full-bleed grid
 * (`PhotoGrid`). One level: the albums open IN PLACE on the risen screen, never a second screen on top.
 */
export function AlbumGrids({ albums, data }: { albums: (OpenedPhotos & { key: string })[]; data: string }) {
  return (
    <div className="space-y-5" data-portfolio-albums-risen={data}>
      {albums.map((a) => (
        <section key={a.key} aria-label={a.title} data-portfolio-risen-album={a.key}>
          <h3 className="px-4 pb-2">
            <b className="line-clamp-2 block text-[16px] font-semibold leading-tight text-ink">{a.title}</b>
            {a.sub ? <small className="block truncate text-[12.5px] text-ink/60">{a.sub}</small> : null}
          </h3>
          <PhotoGrid photos={a} data={data} />
        </section>
      ))}
    </div>
  );
}

/** 🎵 The song bank's main page (the shipped repertoire screen). */
export const SONG_BANK_HREF = '/vendor-dashboard/repertoire';

/** "youtube.com/watch?v=sde-rs" — the link without its scheme, for the row's second line. */
function shortLink(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
}

const MAX_LINKS = 10;

/**
 * 🎬 VIDEO LINKS (§10 #35) — the shipped column, edited row by row. Tap a row → it opens in place: its Link on the house
 * field (`TypedRow` — keeping the words, Enter or tap out, saves them) and Remove. ▶ plays an embeddable link in a pop-up
 * player (YouTube, Vimeo) and opens the others where they live (Facebook, Instagram, TikTok). "Add another link" opens a
 * new row with its field ready to paste. Every keep writes the WHOLE list, the way the shipped editor always has
 * (`gallery_video_links`, ≤ 10, re-validated on the server).
 * 🏷 TITLE (v118): the open row's second field. The row reads the title, else the link's host. A title rides the SAME
 * write as its link (one map keyed by the link), so changing a link carries its title and removing one drops it. While
 * the titles are unread (`initialTitles` null) the field is not drawn and the write sends no titles at all.
 */
export function VideoLinks({ initial, initialTitles }: { initial: string[]; initialTitles: Record<string, string> | null }) {
  const toast = useToast();
  const [links, setLinks] = useState<string[]>(initial);
  const [titles, setTitles] = useState<Record<string, string> | null>(initialTitles);
  const [editing, setEditing] = useState<number | null>(null);
  // A link opens its editor IN PLACE — the app-wide reveal-on-open rule: its head glides to the pin line if it runs low.
  const editHead = useRef<HTMLLIElement | null>(null);
  const intendEdit = useRevealOnOpen(editing !== null, () => ({ head: editHead.current }));
  const [playing, setPlaying] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const playerTitle = useId();

  const write = async (next: string[], nextTitles: Record<string, string> | null = titles): Promise<{ ok: true } | { ok: false; error: string }> => {
    const fd = new FormData();
    fd.set('field', 'gallery_videos');
    for (const l of next) fd.append('gallery_video_links', l);
    // Titles go PAIRED with their links (same order), and only when they were read — absent, the server leaves them be.
    if (nextTitles) {
      fd.set('gallery_video_titles_sent', '1');
      for (const l of next) fd.append('gallery_video_title', nextTitles[l] ?? '');
    }
    const r = await updateVendorProfileField(null, fd);
    if (!r.ok) return { ok: false, error: r.error };
    setLinks(next);
    if (nextTitles) setTitles(videoTitlesFor(next, next.map((l) => [l, nextTitles[l] ?? ''] as const)));
    return { ok: true };
  };
  const keep = async (i: number, text: string): Promise<KeepAnswer> => {
    const p = parseVideoLink(text.trim());
    if (!p) return { ok: false, error: 'That doesn’t look like a video link.' };
    const isNew = i >= links.length;
    const next = isNew ? [...links, p.originalUrl] : links.map((x, j) => (j === i ? p.originalUrl : x));
    // A changed link keeps its title: the title moves to the new key.
    const old = isNew ? null : links[i]!;
    const nextTitles = titles && old && old !== p.originalUrl && titles[old] ? { ...titles, [p.originalUrl]: titles[old]! } : titles;
    const r = await write(next, nextTitles);
    // A NEW link stays open so its Title can be added right there; an edited one closes.
    if (r.ok && (!isNew || !titles)) setEditing(null);
    return r;
  };
  const keepTitle = async (i: number, text: string): Promise<KeepAnswer> => {
    if (!titles || i >= links.length) return { ok: false, error: 'Add the link first.' };
    const link = links[i]!;
    const r = await write(links, { ...titles, [link]: text.trim().slice(0, VIDEO_TITLE_MAX) });
    if (r.ok) setEditing(null);
    return r;
  };
  const remove = (i: number) =>
    start(async () => {
      if (i >= links.length) return setEditing(null);
      const r = await write(links.filter((_, j) => j !== i));
      if (r.ok) {
        setEditing(null);
        toast.success('Link removed');
      } else toast.error(r.error);
    });

  const rows = editing !== null && editing >= links.length ? [...links, ''] : links;
  const play = playing ? parseVideoLink(playing) : null;
  const playName = (playing && titles?.[playing]) || (play ? `${play.label} video` : 'Video');

  return (
    <section
      aria-labelledby="pf-video-h"
      className="rounded-2xl px-4 pb-3 pt-3"
      style={{ background: 'var(--m-paper)', boxShadow: '0 1px 2px color-mix(in srgb, var(--m-ink) 6%, transparent)' }}
      data-portfolio-group="video"
      data-portfolio-card=""
    >
      <div className="flex items-start justify-between gap-3 pb-1.5">
        <h2 id="pf-video-h" className="sn-eye pt-0.5">
          Video links{links.length > 0 ? ` · ${formatCount(links.length)}` : ''}
        </h2>
        <p className="max-w-[55%] text-right text-[12px] leading-snug text-ink/55">{links.length > 0 ? 'tap one to edit · ▶ plays it' : 'YouTube · Vimeo · Facebook'}</p>
      </div>
      {rows.length === 0 ? <p className="pb-1 text-[14px] text-ink/75" data-portfolio-empty="video-editor">No links yet</p> : null}
      <ul className="divide-y divide-ink/10" data-video-links="">
        {rows.map((l, i) => {
          const p = l ? parseVideoLink(l) : null;
          const isOpen = editing === i;
          return (
            <li key={`${i}-${l}`} ref={isOpen ? editHead : undefined} data-video-link={i}>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => { intendEdit(); setEditing((cur) => (cur === i ? null : i)); }} aria-expanded={isOpen} className="sn-press flex min-h-[60px] min-w-0 flex-1 items-center gap-3 py-2.5 text-left">
                  <Link2 aria-hidden className="h-4 w-4 shrink-0 text-ink/55" strokeWidth={2} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-ink" data-video-title="">{l ? videoRowName(l, titles) : 'New video link'}</span>
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
              {/* Opens IN PLACE with the house rise (`.sn-rise`; the global reduced-motion rule stills it). Drawn only while open. */}
              {isOpen ? (
                <div className="sn-rise space-y-2 pb-3" data-video-edit="">
                  <FormRows data="video-link">
                    <TypedRow
                      name="Link"
                      value={l}
                      empty="Paste the link"
                      placeholder="youtube.com/… or vimeo.com/…"
                      inputMode="url"
                      autoCapitalize="off"
                      maxLength={500}
                      openAsk={l ? 0 : 1}
                      check={(t) => (t.trim() && !parseVideoLink(t.trim()) ? 'That doesn’t look like a video link.' : null)}
                      onKeep={(t) => keep(i, t)}
                      data="video-link-url"
                    />
                    {titles && i < links.length ? (
                      <TypedRow
                        name="Title"
                        value={titles[l] ?? ''}
                        empty="Add a title"
                        placeholder="Ana & Ben · same-day edit"
                        maxLength={VIDEO_TITLE_MAX}
                        onKeep={(t) => keepTitle(i, t)}
                        data="video-link-title"
                      />
                    ) : null}
                  </FormRows>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => remove(i)}
                    className="min-h-11 w-full rounded-full text-[14px] font-medium text-[color:rgb(var(--color-danger))]"
                    data-video-remove=""
                  >
                    {i < links.length ? 'Remove this link' : 'Cancel'}
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {links.length < MAX_LINKS ? (
        <button
          type="button"
          onClick={() => { intendEdit(); setEditing(links.length); }}
          className="mt-3 flex w-full items-center gap-3 rounded-2xl border-[1.5px] border-dashed border-ink/20 px-3 py-3.5 text-left"
          data-video-add=""
        >
          <span aria-hidden className="grid h-10 w-10 flex-none place-items-center rounded-full border-[1.5px] border-[color:var(--m-orange-2)] text-[color:var(--m-orange-2)]">
            <Plus className="h-5 w-5" strokeWidth={2} />
          </span>
          <span className="min-w-0 flex-1">
            <b className="block text-[16px] font-semibold text-ink">{links.length === 0 ? 'Add a link' : 'Add another link'}</b>
            <small className="block text-[12.5px] text-ink/60">YouTube, Vimeo, Facebook, Instagram or TikTok video</small>
          </span>
          <ChevronRight aria-hidden className="h-4 w-4 text-ink/40" strokeWidth={2} />
        </button>
      ) : (
        <p className="pt-3 text-[12.5px] text-ink/60">Up to {formatCount(MAX_LINKS)} video links.</p>
      )}

      <Sheet open={playing !== null} onClose={() => setPlaying(null)} labelledById={playerTitle} rise>
        <div className="space-y-3 px-4 pb-6 pt-2" data-video-player="">
          <h2 id={playerTitle} className="text-[15px] font-semibold text-ink">
            {playName}
          </h2>
          {play?.embedUrl ? (
            <div className="aspect-video overflow-hidden rounded-xl bg-black">
              <iframe src={play.embedUrl} title={playName} className="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
            </div>
          ) : null}
          <p className="text-center text-[12.5px] text-ink/60">{playing ? shortLink(playing) : ''} · plays here, in place</p>
        </div>
      </Sheet>
    </section>
  );
}
