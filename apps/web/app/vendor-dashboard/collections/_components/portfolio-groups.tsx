'use client';

import { useId, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { Check, ChevronRight, ExternalLink, Image as ImageIcon, Info, Link2, Music, Play, Plus, Sparkles, Users } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
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
 * the shipped `updateVendorProfileField('gallery_videos')` — RULE 0: the column existed. Each link's optional Title
 * (≤ 80) lives beside it in `gallery_video_titles`, keyed by the link (migration 20271334860034, `lib/video-link-titles.ts`);
 * a row with no title is named by the link's host.
 * 🔒 collections/the-portfolio-is-all-media.test.ts · lib/portfolio-groups.test.ts
 */
export type PickKey = string;

export function PortfolioGroupsView({
  groups,
  allPhotos,
  libraryOpen,
  videoLinks,
  videoTitles = {},
  picked,
  onPick,
  moodboard = null,
  songs = 'off',
}: {
  groups: PortfolioGroups;
  /** The page gallery's display URLs, newest first (its own order reversed). */
  allPhotos: string[];
  libraryOpen: boolean;
  videoLinks: string[];
  /** Each link's title, keyed by the link. null = unread: no Title field, and a save never touches titles. */
  videoTitles?: Record<string, string> | null;
  picked: PickKey | null;
  onPick: (key: PickKey, album: { title: string; urls: string[] }) => void;
  /** 🎨 Moodboard library counts (Lane E: "Moodboard library lives inside portfolio") — said on the inspiration card's
   *  library row (the same page); `null` = not theirs or unread. */
  moodboard?: { looks: number; declined: number } | null;
  /** 🎵 Song bank (Lane E: a Portfolio section, music categories only) — 'off' = not a music shop; null = unread. */
  songs?: { count: number; withVideo: number } | null | 'off';
}) {
  const [open, setOpen] = useState<{ key: PickKey; album: PortfolioAlbum } | null>(null);
  const rows = useRef<Record<string, HTMLElement | null>>({});
  const frame = useRef<HTMLElement | null>(null);

  const group = (
    id: string,
    title: string,
    sub: string,
    albums: PortfolioAlbum[] | null,
    empty: string,
    door: { label: string; href: string; icon: React.ReactElement } | null,
    extra?: React.ReactNode,
  ) => (
    <PortfolioCard id={id} title={<>{title}{groupCount(albums)}</>} sub={sub}>
      {albums === null ? (
        <p role="status" className="py-1 text-[13.5px] text-ink/65" data-portfolio-group-unread={id}>
          Couldn&rsquo;t load these just now — nothing was lost.
        </p>
      ) : albums.length === 0 ? (
        <EmptyLine line={empty} door={door} data={id} />
      ) : (
        <ul className="-mb-1 divide-y divide-ink/10">
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
    </PortfolioCard>
  );

  const stories = groups.stories;
  return (
    <div className="space-y-3" data-portfolio-groups="">
      {group('events', 'All your events', 'one album per event · newest first', groups.events, 'Nothing yet · fills when a couple shares their Papic photos with you', {
        label: 'Open Clients',
        href: '/vendor-dashboard/customers',
        icon: <Users aria-hidden strokeWidth={1.9} />,
      })}
      {group('services', 'Your services', 'the photos on each service card', groups.services, 'No service card has a photo yet', {
        label: 'Add a cover to a card',
        href: '/vendor-dashboard/shop#services',
        icon: <ImageIcon aria-hidden strokeWidth={1.9} />,
      })}
      {groups.inspiration === 'off'
        ? null
        : group(
            'inspiration',
            'Inspiration you curated',
            'looks Setnayan approved for couples',
            groups.inspiration,
            libraryOpen ? 'None approved yet · your photos help couples find you' : 'None approved yet',
            // The empty card's door IS the shipped library row; with looks the row sits under them, as shipped.
            libraryOpen ? { label: INSPIRATION_LIBRARY_ROW.label, href: INSPIRATION_LIBRARY_HREF, icon: <Sparkles aria-hidden strokeWidth={1.9} /> } : null,
            // 🎨 "Moodboard library lives inside portfolio" (owner 9 Nov): the library IS this door's page
            // (`INSPIRATION_LIBRARY_HREF` = /vendor-dashboard/moodboard-library), so it is said here, once — with its
            // sets counted — never as a second card to the same page.
            libraryOpen ? (
              groups.inspiration?.length ? (
              <div className="mt-1 border-t border-ink/10">
                <DatesRow
                  data="portfolio-inspiration-library"
                  title={INSPIRATION_LIBRARY_ROW.label}
                  line={moodboard && moodboard.looks > 0 ? `Moodboard library · ${formatCount(moodboard.looks)} ${moodboard.looks === 1 ? 'set' : 'sets'}${moodboard.declined > 0 ? ` · ${formatCount(moodboard.declined)} declined` : ''}` : INSPIRATION_LIBRARY_ROW.line}
                  href={INSPIRATION_LIBRARY_HREF}
                />
              </div>
              ) : null
            ) : null,
          )}

      {/* 🎵 SONG BANK — music categories only (its main page is Shop › Makers › Specialized tools › Song bank). */}
      {songs !== 'off' ? (
        <PortfolioCard id="songs" title={<>Song bank{songs && songs.count > 0 ? ` · ${formatCount(songs.count)}` : ''}</>} sub="music suppliers">
          {songs === null ? (
            <p role="status" className="py-1 text-[13.5px] text-ink/65" data-portfolio-group-unread="songs">
              Couldn&rsquo;t load your songs just now — nothing was lost.
            </p>
          ) : songs.count === 0 ? (
            <EmptyLine line="No songs yet · couples request and preview from it" door={{ label: 'Add a song', href: SONG_BANK_HREF, icon: <Music aria-hidden strokeWidth={1.9} /> }} data="songs" />
          ) : (
            <DatesRow
              data="portfolio-songs"
              title={`${formatCount(songs.count)} ${songs.count === 1 ? 'song' : 'songs'}`}
              line={songs.withVideo > 0 ? `${formatCount(songs.withVideo)} with video · couples request and preview` : 'couples request and preview from it'}
              href={SONG_BANK_HREF}
            />
          )}
        </PortfolioCard>
      ) : null}

      <StoriesGroup stories={stories} />

      <PortfolioCard
        id="all"
        title={<>All photos · {formatCount(allPhotos.length)}</>}
        sub="the photos on your page · newest first"
        right={allPhotos.length > 0 ? <PickCircle picked={picked === 'all'} title="All photos" onPick={() => onPick('all', { title: 'All photos', urls: allPhotos })} /> : null}
      >
        {allPhotos.length === 0 ? (
          // No second door on purpose: the ＋ in the thumb row is the one add (Lane E item 3).
          <EmptyLine line="Nothing yet · the ＋ below adds photos" door={null} data="all" />
        ) : (
          <ul className="grid grid-cols-3 gap-1" data-portfolio-all="">
            {allPhotos.map((u) => (
              <li key={u} className="aspect-square overflow-hidden rounded-md bg-ink/5" data-portfolio-photo="">
                {/* eslint-disable-next-line @next/next/no-img-element -- presigned display URLs */}
                <img src={u} alt="" className="h-full w-full object-cover" loading="lazy" />
              </li>
            ))}
          </ul>
        )}
      </PortfolioCard>

      <VideoLinks initial={videoLinks} initialTitles={videoTitles} />

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
      <button type="button" onClick={onOpen} aria-expanded={open} aria-haspopup="dialog" className="sn-press flex min-h-[64px] min-w-0 flex-1 items-center gap-3 py-2.5 text-left">
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
    <PortfolioCard id="stories" title={<>Stories couples published{groupCount(stories)}</>} sub="your shop is credited · share them from Promote">
      {stories === null ? (
        <p role="status" className="py-1 text-[13.5px] text-ink/65" data-portfolio-group-unread="stories">
          Couldn&rsquo;t load these just now — nothing was lost.
        </p>
      ) : stories.length === 0 ? (
        <EmptyLine line="None yet · a couple you worked with publishes their event to Stories" door={null} data="stories" />
      ) : (
        <ul className="-mb-1 divide-y divide-ink/10" data-portfolio-stories="">
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
    </PortfolioCard>
  );
}

/** 🎵 The song bank's main page (the shipped repertoire screen). */
const SONG_BANK_HREF = '/vendor-dashboard/repertoire';

/**
 * 🗂 ONE PORTFOLIO SECTION, AS A FINISHED CARD (Lane E item 1: *"Portfolio does not look good empty"*): the eyebrow
 * and its quiet line on one row, then the body. Every section draws — empty or not — in this one shape.
 */
function PortfolioCard({ id, title, sub, right = null, children }: { id: string; title: React.ReactNode; sub: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section
      aria-labelledby={`pf-${id}-h`}
      className="rounded-2xl px-4 pb-3 pt-3"
      style={{ background: 'var(--m-paper)', boxShadow: '0 1px 2px color-mix(in srgb, var(--m-ink) 6%, transparent)' }}
      data-portfolio-group={id}
      data-portfolio-card=""
    >
      <div className="flex items-start justify-between gap-3 pb-1.5">
        <h2 id={`pf-${id}-h`} className="sn-eye min-w-0 pt-0.5">
          {title}
        </h2>
        {right ?? <p className="max-w-[55%] text-right text-[12px] leading-snug text-ink/55">{sub}</p>}
      </div>
      {right ? <p className="-mt-1 pb-1 text-[12px] text-ink/55">{sub}</p> : null}
      {children}
    </section>
  );
}

/** The empty card's body: ONE honest line and (at most) ONE door — no grey text wall, no "0 · 0 · 0". */
function EmptyLine({ line, door, data }: { line: string; door: { label: string; href: string; icon: React.ReactElement } | null; data: string }) {
  return (
    <div className="space-y-2.5 pb-1" data-portfolio-empty={data}>
      <p className="flex items-start gap-2 text-[14px] leading-snug text-ink/75">
        <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ink/45" strokeWidth={1.9} />
        <span>{line}</span>
      </p>
      {door ? <ActionButton tone="neutral" icon={door.icon} label={door.label} href={door.href} /> : null}
    </div>
  );
}

const MAX_LINKS = 10;

/** "youtube.com/watch?v=sde-rs" — the link without its scheme, for the row's second line. */
function shortLink(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
}

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
      {rows.length === 0 ? <EmptyLine line="No links yet" door={null} data="video" /> : null}
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
