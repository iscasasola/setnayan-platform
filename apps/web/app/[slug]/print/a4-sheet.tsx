// ============================================================================
// A4 booklet print keepsake — one page per minute of the story timeline
// ============================================================================
//
// Sibling of print-sheet.tsx's A3 broadsheet. Same inputs (the SAME already
// gated, already audience-checked, already layer-redacted `EditorialData` the
// route builds once — see page.tsx), a different editorial shape: no curation,
// no front/back threshold. A cover page, then every written minute
// (`buildA4Pages`) gets its own full page in order, then a closing page
// reusing the A3 sheet's own LockedClose + Colophon so both formats end on the
// identical couple's-words / QR-back-to-the-living-story close.
//
// NO scripts, NO <video>, NO animations — same print discipline as the A3
// sheet. A clip prints as its poster still with a "scan to watch" caption.
// ============================================================================

import { type ReactElement } from 'react';
import { HeroMonogram } from '@/app/_components/hero-monogram';
import type { HeroMonogramData } from '@/lib/hero-monogram-data';
import type { ComposedCopy } from '../_components/editorial/compose';
import type { EditorialData } from '../_components/editorial/data';
import type { EventWords } from '../_lib/event-words';
import type { DrawnSheet } from '@/lib/story-pages';
import { mastheadEdition } from '@/lib/story-spine';
import { nameplate, editionCenter } from './keepsake-layout';
import {
  arrangedA4PageResolver,
  buildA4Pages,
  type A4PageResolver,
  type A4PageSource,
} from './keepsake-layout';
import { Colophon, LockedClose } from './print-sheet';
import { ArrangedSheet } from '../_components/story/arranged-sheet';

function CoverPage({
  data,
  copy,
  mono,
  editionLeft,
}: {
  data: EditorialData;
  copy: ComposedCopy;
  mono: HeroMonogramData | null;
  editionLeft: string;
}): ReactElement {
  return (
    <section className="k4-page k4-cover">
      <p className="k4-cover-eyebrow">Set na &rsquo;yan &middot; Commemorative Edition &middot; {editionLeft}</p>
      <h1 className="k4-cover-nameplate">{nameplate(data.displayName)}</h1>
      <p className="k4-cover-dateline">{editionCenter(data)}</p>
      {mono ? (
        <div style={{ display: 'flex', justifyContent: 'center', margin: '0 0 6mm' }}>
          <HeroMonogram event={mono.design} monogram={mono.monogram} animatedMonogram={false} bespokeSvg={mono.bespokeSvg} />
        </div>
      ) : null}
      {data.heroPhotoUrl ? (
        <figure className="k4-cover-hero">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.heroPhotoUrl} alt={`${data.firstNames}`} loading="eager" decoding="sync" />
          <figcaption>{copy.headline}</figcaption>
        </figure>
      ) : (
        <p className="k4-cover-dateline">{copy.headline}</p>
      )}
    </section>
  );
}

/** One printed page for one written minute. A minute with no media still gets
 *  its page — a title/writeUp-only minute is still a minute on the timeline;
 *  `k4-minute-empty` is the placeholder for the (rarer) minute with neither. */
function MinutePage({
  page,
  index,
  total,
  names,
}: {
  page: Extract<A4PageSource, { kind: 'minute' }>;
  index: number;
  total: number;
  names: string;
}): ReactElement {
  const { chapter } = page;
  const lead = chapter.media[0];
  const still = lead ? (lead.type === 'clip' ? lead.posterUrl ?? lead.url : lead.url) : null;
  return (
    <section className="k4-page k4-minute">
      <p className="k4-minute-index">
        <span>Minute {index + 1} of {total}</span>
        {chapter.time ? <span className="k4-minute-time">{chapter.time}</span> : null}
      </p>
      {still ? (
        <figure className="k4-minute-media">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={still} alt={`${names} — a moment from the day`} loading="eager" decoding="sync" />
          {lead?.type === 'clip' ? (
            <figcaption className="k4-minute-clipcap">&#9654; living moment — scan to watch</figcaption>
          ) : null}
        </figure>
      ) : (
        <div className="k4-minute-empty">A quiet minute — no photo was kept here.</div>
      )}
      {chapter.title ? <h3 className="k4-minute-title">{chapter.title}</h3> : null}
      {chapter.writeUp ? <p className="k4-minute-writeup">{chapter.writeUp}</p> : null}
    </section>
  );
}

/**
 * ONE PAGE, ONE HAND-ARRANGED MOMENT (step 7). Renders the SAME `ArrangedSheet`
 * the public page draws — never a second renderer — with `stills` so a
 * snippet prints as its poster still rather than attempting to play. What it
 * is handed is already gated: `loadStoryPages` (S3 + S14) is the only door
 * this page's sheets come through — see page.tsx.
 */
function ArrangedPage({
  page,
  names,
  words,
}: {
  page: Extract<A4PageSource, { kind: 'arranged' }>;
  names: string;
  words: EventWords;
}): ReactElement {
  const label = `${page.sheet.name ?? 'A page of the day'} — as the ${words.host} laid it out`;
  return (
    <section className="k4-page k4-arranged">
      <p className="k4-minute-index">
        <span>{page.sheet.name ?? 'A page of the day'}</span>
      </p>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <ArrangedSheet sheet={page.sheet} names={names} stills label={label} />
      </div>
    </section>
  );
}

export function A4Sheet({
  data,
  words,
  copy,
  mono,
  qrSvg,
  hideWatermark,
  stampLine,
  resolver,
  sheets = [],
}: {
  words: EventWords;
  data: EditorialData;
  copy: ComposedCopy;
  mono: HeroMonogramData | null;
  qrSvg: string;
  hideWatermark: boolean;
  stampLine: string | null;
  /** The page-grouping seam — see keepsake-layout.ts's A4PageResolver. Omit
   *  to get the shipped default: one-minute-per-page in Automatic, or (when
   *  `sheets` is non-empty) `arrangedA4PageResolver`. */
  resolver?: A4PageResolver;
  /**
   * THE MOMENTS THE HOST ARRANGED BY HAND (step 7) — already gated by
   * `loadStoryPages` (S3 + S14) and empty for a story in Automatic, so an
   * unarranged story paginates exactly as before this step.
   */
  sheets?: readonly DrawnSheet[];
}): ReactElement {
  const editionLeft = mastheadEdition(
    data.eventDate,
    data.editionNo,
    data.editionNo != null,
    data.editionVolume,
  );
  const pages = buildA4Pages(data, resolver ?? (sheets.length ? arrangedA4PageResolver(sheets) : undefined));

  // "Minute N of M" counts MINUTE pages only — an interleaved arranged page
  // (step 7) is a page of its own, never a number in that count.
  const totalMinutes = pages.filter((p) => p.kind === 'minute').length;
  let minuteIndex = 0;

  return (
    <>
      <CoverPage data={data} copy={copy} mono={mono} editionLeft={editionLeft} />
      {pages.map((page, i) => {
        if (page.kind === 'minute') {
          const index = minuteIndex;
          minuteIndex += 1;
          return (
            <MinutePage key={page.chapter.leadId ?? i} page={page} index={index} total={totalMinutes} names={data.firstNames} />
          );
        }
        return <ArrangedPage key={page.sheet.momentId} page={page} names={data.firstNames} words={words} />;
      })}
      <section className="k4-page k4-closing">
        <div className="k4-closing">
          <LockedClose words={words} data={data} />
        </div>
        <Colophon qrSvg={qrSvg} hideWatermark={hideWatermark} stampLine={stampLine} />
      </section>
    </>
  );
}
