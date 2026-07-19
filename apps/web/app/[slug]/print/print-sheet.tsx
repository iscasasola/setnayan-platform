// ============================================================================
// A3 broadsheet print keepsake — the sheet render (pure server markup)
// ============================================================================
//
// NO scripts, NO <video>, NO animations. The couple's mark renders in its
// STILLEST form (a static frame). Clips render as their poster still with a
// "scan to watch" caption. The QR colophon is ALWAYS the last element on the
// last side. Front = always full; back = only when `hasBack` (needsBackPage).
// ============================================================================

import { type ReactElement, type ReactNode } from 'react';
import { HeroMonogram } from '@/app/_components/hero-monogram';
import type { HeroMonogramData } from '@/lib/hero-monogram-data';
import type { ComposedCopy } from '../_components/editorial/compose';
import type { EditorialData, DayChapter } from '../_components/editorial/data';
import {
  editionVolume,
  toRoman,
  nameplate,
  editionCenter,
  prettyCategory,
  needsBackPage,
  splitChapters,
} from './keepsake-layout';

// ── small presentational helpers ─────────────────────────────────────────────

function SectionRule({ title, note }: { title: string; note?: string }): ReactElement {
  return (
    <>
      <div className="k-section-rule">
        <span className="k-section-title">{title}</span>
      </div>
      {note ? <p className="k-section-note">{note}</p> : null}
    </>
  );
}

/** The couple's mark, STILL. The bespoke/uploaded SVG (a clean static frame) or
 *  the couple's real static lockup via HeroMonogram with animation forced off;
 *  the text-circle is HeroMonogram's own fallback for events with no mark. */
function StillMonogram({ mono, fallback }: {
  mono: HeroMonogramData | null;
  fallback: { text: string; color: string };
}): ReactElement {
  if (mono) {
    return (
      <div className="k-monogram">
        {/* animatedMonogram=false forces every HeroMonogram branch to its static
            render (no StudioRevealPlayer / AnimatedMonogramHero / WebGL). */}
        <HeroMonogram
          event={mono.design}
          monogram={mono.monogram}
          animatedMonogram={false}
          bespokeSvg={mono.bespokeSvg}
        />
      </div>
    );
  }
  return (
    <div className="k-monogram">
      <div
        aria-hidden
        style={{
          display: 'flex',
          height: '20mm',
          width: '20mm',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '9999px',
          border: `2px solid ${fallback.color}`,
          background: 'var(--k-cream)',
          fontFamily: 'var(--k-display)',
          fontStyle: 'italic',
          fontSize: '16pt',
          color: fallback.color,
        }}
      >
        {fallback.text}
      </div>
    </div>
  );
}

function ChapterCard({ chapter, names }: { chapter: DayChapter; names: string }): ReactElement | null {
  const lead = chapter.media[0];
  if (!lead) return null;
  // A clip prints as its poster still (no <video>); a photo prints as its still.
  const still = lead.type === 'clip' ? lead.posterUrl ?? lead.url : lead.url;
  return (
    <figure className="k-chapter">
      <div className="k-chapter-media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={still} alt={`${names} — a moment from the day`} loading="eager" decoding="sync" />
        {lead.type === 'clip' ? (
          <figcaption className="k-chapter-clipcap">&#9654; living moment — scan to watch</figcaption>
        ) : null}
      </div>
      {chapter.time ? <p className="k-chapter-time">{chapter.time}</p> : null}
      {chapter.title ? <figcaption className="k-chapter-title">{chapter.title}</figcaption> : null}
      {chapter.writeUp ? <p className="k-chapter-writeup">{chapter.writeUp}</p> : null}
    </figure>
  );
}

/** The QR colophon — ALWAYS the last element on the last side. */
function Colophon({
  qrSvg,
  hideWatermark,
}: {
  qrSvg: string;
  hideWatermark: boolean;
}): ReactElement {
  return (
    <footer className="k-colophon">
      {/* Inline QR SVG string generated server-side from the existing QR
          machinery (lib/qr renderUrlQrSvg). dangerouslySetInnerHTML is the
          standard way this codebase inlines its QR SVGs. */}
      <div className="k-colophon-qr" aria-hidden dangerouslySetInnerHTML={{ __html: qrSvg }} />
      <div className="k-colophon-copy">
        <p className="k-colophon-lead">
          Scan to return to the living story — the clips, the voices, the whole night.
        </p>
        {!hideWatermark ? <p className="k-colophon-brand">Powered by Setnayan</p> : null}
      </div>
    </footer>
  );
}

// ── the sheet ─────────────────────────────────────────────────────────────────

export function PrintSheet({
  data,
  copy,
  mono,
  qrSvg,
  hideWatermark,
}: {
  data: EditorialData;
  copy: ComposedCopy;
  mono: HeroMonogramData | null;
  /** Inline QR SVG string for https://www.setnayan.com/[slug]. */
  qrSvg: string;
  hideWatermark: boolean;
}): ReactElement {
  const hasBack = needsBackPage(data);
  const { front: frontChapters, back: backChapters } = splitChapters(data, hasBack);

  const editionLeft = `Vol. ${toRoman(editionVolume(data.eventDate))} · No. ${data.editionNo ?? 1}`;
  const leadParagraphs = data.draft.leadParagraphs ?? [];

  // Primary vendor credits shown on the FRONT (first few); the full ledger, when
  // it's long, moves to the back.
  const frontVendors = data.vendors.slice(0, hasBack ? 3 : 8);
  const backVendors = hasBack ? data.vendors.slice(3) : [];

  const heroStill = data.heroPhotoUrl; // never a <video> — print is static

  // ── FRONT ────────────────────────────────────────────────────────────────
  const front: ReactNode = (
    <section className={`keepsake-sheet${hasBack ? ' k-has-back' : ''}`}>
      <div className="k-rule-double" />
      <header className="k-masthead">
        <StillMonogram mono={mono} fallback={{ text: data.monogramText, color: data.monogramColor }} />
        <p className="k-mono-eyebrow">Set na &rsquo;yan &middot; Commemorative Edition</p>
        <h1 className="k-nameplate">{nameplate(data.displayName)}</h1>
      </header>
      <div className="k-rule-thin" />
      <div className="k-dateline">
        <span>{editionLeft}</span>
        <span className="k-dateline-center">{editionCenter(data)}</span>
        <span>Keepsake</span>
      </div>
      <div className="k-rule-thick" />

      {/* Headline + deck + byline — NEVER cut. */}
      <div className="k-headline-block">
        <p className="k-super">{copy.superKicker}</p>
        <h2 className="k-headline">{copy.headline}</h2>
        {copy.deck ? <p className="k-deck">{copy.deck}</p> : null}
        <p className="k-byline">
          {copy.byline}
          {data.venueCity ? ` · ${data.venueCity}` : ''}
        </p>
      </div>

      {/* Hero photo — NEVER cut. */}
      {heroStill ? (
        <figure className="k-hero">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={heroStill} alt={`${data.firstNames}, from the wedding`} loading="eager" decoding="sync" />
          <figcaption>{data.firstNames}, from the celebration — captured on the day.</figcaption>
        </figure>
      ) : null}

      {/* Lead article — 2-col with drop cap. Truncates before the hero/headline. */}
      {leadParagraphs.length || copy.pullQuote ? (
        <div className="k-lead">
          {leadParagraphs.map((p, i) => (
            <p key={i} className={i === 0 ? 'k-dropcap' : undefined}>
              {p}
            </p>
          ))}
          {copy.pullQuote ? <p className="k-pullquote">&ldquo;{copy.pullQuote}&rdquo;</p> : null}
        </div>
      ) : null}

      {/* The day's moments — a compact grid (front cap). */}
      {frontChapters.length ? (
        <div className="k-section">
          <SectionRule title="As the Day Unfolded" note="photos and living moments, in order" />
          <div className="k-chapters">
            {frontChapters.map((c, i) => (
              <ChapterCard key={c.leadId ?? i} chapter={c} names={data.firstNames} />
            ))}
          </div>
        </div>
      ) : null}

      {/* Primary vendor credits (front strip). The full ledger moves to the back
          when there is one. */}
      {frontVendors.length ? (
        <div className="k-section">
          <SectionRule title="The Team Behind the Day" />
          <ul className="k-credits">
            {frontVendors.map((v, i) => (
              <li key={i} className="k-credit">
                <span className="k-credit-name">{v.name}</span>
                {v.category ? <span className="k-credit-cat">{prettyCategory(v.category)}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* LOCKED CLOSE (front only when there's no back) — the couple's words then
          their song, per the editorial's pinned close. */}
      {!hasBack ? <LockedClose data={data} /> : null}

      {/* Colophon is the last element on the last side → front only when no back. */}
      {!hasBack ? <Colophon qrSvg={qrSvg} hideWatermark={hideWatermark} /> : null}
    </section>
  );

  if (!hasBack) return <>{front}</>;

  // ── BACK (conditional) ─────────────────────────────────────────────────────
  const back: ReactNode = (
    <section className="keepsake-sheet">
      <div className="k-rule-double" />
      <div className="k-dateline">
        <span>{nameplate(data.displayName)}</span>
        <span className="k-dateline-center">{editionCenter(data)}</span>
        <span>Continued</span>
      </div>
      <div className="k-rule-thick" />

      {/* Overflow chapters. */}
      {backChapters.length ? (
        <div className="k-section">
          <SectionRule title="More From the Day" />
          <div className="k-chapters">
            {backChapters.map((c, i) => (
              <ChapterCard key={c.leadId ?? i} chapter={c} names={data.firstNames} />
            ))}
          </div>
        </div>
      ) : null}

      {/* What They Whispered — top Kwento wishes. */}
      {data.kwentoQuotes.length ? (
        <div className="k-section">
          <SectionRule title="What They Whispered" note="best wishes, captured on the day" />
          <div className="k-cols-2">
            {data.kwentoQuotes.slice(0, 8).map((q, i) => (
              <figure key={i} className="k-quote">
                <blockquote className="k-quote-body">&ldquo;{q.body}&rdquo;</blockquote>
                {q.author ? <figcaption className="k-quote-author">&mdash; {q.author}</figcaption> : null}
              </figure>
            ))}
          </div>
        </div>
      ) : null}

      {/* What They Said — reviews (only when there's a wall of them). */}
      {data.reviews.length >= 3 ? (
        <div className="k-section">
          <SectionRule title="What They Said" />
          <div className="k-cols-2">
            {data.reviews.slice(0, 6).map((r, i) => (
              <figure key={i} className="k-quote">
                <blockquote className="k-quote-body">&ldquo;{r.quote}&rdquo;</blockquote>
                <figcaption className="k-quote-author">
                  &mdash; {r.author}
                  {r.role ? ` · ${r.role}` : ''}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      ) : null}

      {/* Powered by Setnayan — the in-app services strip. */}
      {data.servicesAvailed.length ? (
        <div className="k-section">
          <SectionRule title="Powered by Setnayan" />
          <div className="k-services">
            {data.servicesAvailed.map((s, i) => (
              <span key={i} className="k-service-chip">
                {s}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* The full vendor credit ledger. */}
      {backVendors.length ? (
        <div className="k-section">
          <SectionRule title="Full Credits" />
          <ul className="k-credits">
            {backVendors.map((v, i) => (
              <li key={i} className="k-credit">
                <span className="k-credit-name">{v.name}</span>
                {v.category ? <span className="k-credit-cat">{prettyCategory(v.category)}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* LOCKED CLOSE — the couple's words then their song. */}
      <LockedClose data={data} />

      {/* Colophon is ALWAYS the last element on the last side. */}
      <Colophon qrSvg={qrSvg} hideWatermark={hideWatermark} />
    </section>
  );

  return (
    <>
      {front}
      {back}
    </>
  );
}

/** The editorial's pinned close: "From the Couple" then "Their Song". */
function LockedClose({ data }: { data: EditorialData }): ReactElement | null {
  const hasMessage = Boolean(data.specialMessage);
  const hasSong = Boolean(data.song.label || data.song.url);
  if (!hasMessage && !hasSong) return null;
  return (
    <>
      {hasMessage ? (
        <div className="k-section">
          <SectionRule title="From the Couple" />
          <blockquote className="k-couple-quote">
            <p>&ldquo;{data.specialMessage}&rdquo;</p>
            <footer>&mdash; {data.firstNames}</footer>
          </blockquote>
        </div>
      ) : null}
      {hasSong ? (
        <div className="k-section">
          <SectionRule title="Their Song" />
          <div className="k-song">
            {data.song.label ? <p className="k-song-title">&ldquo;{data.song.label}&rdquo;</p> : null}
            <p className="k-song-credit">
              {data.firstNames}
              {data.song.url ? ' · their wedding song' : ' · the song that follows them'}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
