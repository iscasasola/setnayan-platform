// ============================================================================
// Editorial recap page — the post-wedding "newspaper front page" (Increment D)
// ============================================================================
//
// Server component. Mounted by the public site renderer when the site enters
// its "editorial" phase (a parallel task wires that — this module does NOT
// touch the renderer or [slug]/page.tsx). Renders standalone and NEVER throws:
// the data layer is fully best-effort and every section degrades gracefully
// when its data is absent.
//
// Spec: Wedding_Website_Lifecycle_Spec_2026-06-07 §6.3–6.8.
// Mockup: Editorial_Page_Mockup_2026-06-07.html.
//
// Visual language matches the [slug] invitation site: warm-alabaster ground,
// Cormorant Garamond serif (font-serif/font-display), DM Mono eyebrows
// (font-mono uppercase tracked), champagne-gold accent (text-terracotta),
// mulberry CTAs, hairline rules in ink/10..ink/80.
// ============================================================================

import { loadEditorialData, type EditorialData } from './data';
import { composeCopy, type ComposedCopy } from './compose';

export async function EditorialContent({ eventId }: { eventId: string }): Promise<JSX.Element> {
  let data: EditorialData | null = null;
  try {
    data = await loadEditorialData(eventId);
  } catch {
    data = null;
  }

  if (!data) {
    return <GracefulFallback />;
  }

  let copy: ComposedCopy;
  try {
    copy = composeCopy(data);
  } catch {
    // Even composition is wrapped — fall back to a bare headline.
    copy = {
      superKicker: 'A celebration',
      headline: `${data.displayName} Are Married`,
      deck: '',
      byline: 'By the Setnayan Desk',
      leadParagraphs: [],
      pullQuote: null,
    };
  }

  const milestones = Array.isArray(data.loveStory.milestones)
    ? data.loveStory.milestones.filter((x) => x && (x.year || x.title || x.note))
    : [];

  return (
    <div className="min-h-screen bg-[#e7e2d6] px-3 py-6 text-ink sm:px-4 sm:py-10">
      <article className="mx-auto max-w-5xl border border-ink/10 bg-cream px-5 py-7 shadow-[0_30px_70px_-30px_rgba(30,34,41,0.45)] sm:px-10 sm:py-9">
        {/* Phase ribbon (cross-links) ----------------------------------------- */}
        <PhaseRibbon />

        <div className="border-t-[3px] border-double border-ink" />

        {/* Masthead ------------------------------------------------------------ */}
        <header className="py-3 text-center">
          <Monogram text={data.monogramText} color={data.monogramColor} />
          <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.34em] text-terracotta">
            Set na &rsquo;yan &middot; Commemorative Edition
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold leading-[0.96] tracking-tight sm:text-6xl">
            {nameplate(data.displayName)}
          </h1>
        </header>

        <div className="border-t border-ink/80" />
        <EditionLine
          left="Vol. I · No. 1"
          center={editionCenter(data)}
          right="Priceless"
        />
        <div className="border-t-[3px] border-ink" />

        {/* Lead headline + deck + byline -------------------------------------- */}
        <section className="py-5 text-center sm:py-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-mulberry">
            {copy.superKicker}
          </p>
          <h2 className="mx-auto mt-3 max-w-3xl font-display text-4xl font-bold leading-[0.95] tracking-tight sm:text-6xl">
            {copy.headline}
          </h2>
          {copy.deck ? (
            <p className="mx-auto mt-3 max-w-2xl font-serif text-lg italic leading-snug text-ink/70 sm:text-2xl">
              {copy.deck}
            </p>
          ) : null}
          <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.16em] text-ink/45">
            {copy.byline}
            {data.eventDateFormatted ? ` · ${data.venueCity ?? ''}` : ''}
          </p>
        </section>

        {/* Main grid: lead article + by-the-numbers --------------------------- */}
        <div className="grid grid-cols-1 gap-7 pt-2 lg:grid-cols-[1.65fr_0.9fr] lg:gap-8">
          <div>
            {data.heroPhotoUrl ? <HeroPhoto url={data.heroPhotoUrl} names={data.firstNames} /> : null}
            <LeadArticle paragraphs={copy.leadParagraphs} pullQuote={copy.pullQuote} />
            {data.vendors.length ? <TeamBehindTheDay vendors={data.vendors} /> : null}
          </div>

          <aside>
            <ByTheNumbers data={data} />
          </aside>
        </div>

        {/* Timeline ------------------------------------------------------------ */}
        {milestones.length ? (
          <>
            <SectionRule title="The Story So Far" />
            <Timeline milestones={milestones} />
          </>
        ) : null}

        {/* From the couple (pull from special_message) ------------------------ */}
        {data.specialMessage ? (
          <>
            <SectionRule title="From the Couple" />
            <FromTheCouple message={data.specialMessage} attribution={data.firstNames} />
          </>
        ) : null}

        {/* What they said (reviews — empty state for now) --------------------- */}
        <SectionRule title="What They Said" />
        <ReviewsEmptyState />

        {/* Colophon / cross-phase links --------------------------------------- */}
        <Colophon names={data.displayName} city={data.venueCity} />
      </article>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function GracefulFallback(): JSX.Element {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-cream px-4 py-16 text-ink">
      <div className="mx-auto max-w-md space-y-3 rounded-2xl border border-ink/10 bg-cream/60 p-8 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-terracotta">
          The Editorial
        </p>
        <h2 className="font-display text-2xl italic tracking-tight">
          This wedding&rsquo;s story isn&rsquo;t available yet.
        </h2>
        <p className="text-sm text-ink/65">
          The recap is composed a few days after the celebration. Please check back soon.
        </p>
      </div>
    </div>
  );
}

function Monogram({ text, color }: { text: string; color: string }): JSX.Element {
  return (
    <div className="flex justify-center">
      <div
        aria-hidden
        className="flex h-16 w-16 items-center justify-center rounded-full border-2 bg-cream font-serif text-xl italic sm:h-20 sm:w-20 sm:text-2xl"
        style={{ borderColor: color, color }}
      >
        {text}
      </div>
    </div>
  );
}

function PhaseRibbon(): JSX.Element {
  // Plain styled links — the engine task owns real phase navigation. We don't
  // hardcode routes that need params; same-page anchors keep this safe.
  return (
    <nav
      aria-label="Site phases"
      className="flex flex-wrap items-center justify-center gap-4 pb-3 font-mono text-[9px] uppercase tracking-[0.14em] text-ink/60"
    >
      <a href="#" className="border-b border-terracotta pb-0.5 text-ink/60 no-underline">
        &larr; The Invitation (RSVP)
      </a>
      <a href="#" className="border-b border-terracotta pb-0.5 text-ink/60 no-underline">
        The Wedding Day (Live) &uarr;
      </a>
      <span className="border-b border-mulberry pb-0.5 text-mulberry">The Editorial — Today</span>
    </nav>
  );
}

function EditionLine({
  left,
  center,
  right,
}: {
  left: string;
  center: string;
  right: string;
}): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-1 py-2 text-center font-mono text-[9px] uppercase tracking-[0.1em] text-ink/65 sm:flex-row sm:justify-between sm:text-left">
      <span>{left}</span>
      <span className="tracking-[0.16em]">{center}</span>
      <span>{right}</span>
    </div>
  );
}

function HeroPhoto({ url, names }: { url: string; names: string }): JSX.Element {
  return (
    <figure className="relative h-56 overflow-hidden rounded-sm bg-ink/10 sm:h-[300px]">
      {/* Raw <img>: presigned R2 URLs expire; next/image would cache stale. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={`${names}, from the wedding`}
        className="h-full w-full object-cover"
        loading="lazy"
        decoding="async"
      />
      <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/70 to-transparent px-3 pb-2 pt-5 font-mono text-[9px] uppercase tracking-[0.08em] text-cream">
        {names}, from the celebration — captured on the day.
      </figcaption>
    </figure>
  );
}

function LeadArticle({
  paragraphs,
  pullQuote,
}: {
  paragraphs: string[];
  pullQuote: string | null;
}): JSX.Element | null {
  if (!paragraphs.length && !pullQuote) return null;
  return (
    <div className="mt-4 columns-1 gap-7 text-justify font-serif text-[15.5px] leading-relaxed sm:columns-2 [&>p]:mb-3">
      {paragraphs.map((p, i) => (
        <p
          key={i}
          className={
            i === 0
              ? "first-letter:float-left first-letter:mr-2 first-letter:pt-1 first-letter:font-display first-letter:text-6xl first-letter:font-bold first-letter:leading-[0.7] first-letter:text-mulberry"
              : undefined
          }
        >
          {p}
        </p>
      ))}
      {pullQuote ? (
        <p className="my-2 break-inside-avoid border-y border-ink/15 border-t-2 border-t-ink py-3 font-display text-lg font-medium italic leading-tight text-ink">
          &ldquo;{pullQuote}&rdquo;
        </p>
      ) : null}
    </div>
  );
}

function TeamBehindTheDay({
  vendors,
}: {
  vendors: EditorialData['vendors'];
}): JSX.Element {
  return (
    <div className="mt-5 border-t border-ink/15 pt-3">
      <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.2em] text-ink/45">
        The Team Behind the Day
      </p>
      <ul className="m-0 list-none p-0">
        {vendors.slice(0, 8).map((v, i) => (
          <li
            key={i}
            className="flex items-center gap-2 border-b border-dotted border-ink/15 py-1.5 last:border-b-0"
          >
            <span aria-hidden className="h-7 w-7 shrink-0 rounded-sm bg-gradient-to-br from-terracotta-100 to-terracotta-300" />
            <span className="min-w-0">
              <span className="block truncate font-serif text-sm font-semibold leading-tight">
                {v.name}
              </span>
              {v.category ? (
                <span className="block font-mono text-[8px] uppercase tracking-[0.06em] text-ink/45">
                  {prettyCategory(v.category)}
                  {v.isFirstPick ? ' · #1 match' : ''}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ByTheNumbers({ data }: { data: EditorialData }): JSX.Element {
  const m = data.metrics;
  return (
    <div className="border-2 border-ink">
      <div className="bg-ink px-2 py-2 text-center font-display text-xl font-bold text-cream">
        By the Numbers
      </div>
      <p className="px-2 pb-0.5 pt-2 text-center font-mono text-[8px] uppercase tracking-[0.2em] text-terracotta">
        Setnayan&rsquo;s hand in the day
      </p>

      {/* M1 — services planned with Setnayan */}
      {m.servicesSetnayan > 0 ? (
        <Stat
          big={
            m.servicesTotalDenominator && m.servicesTotalDenominator > 0
              ? `${m.servicesSetnayan}/${m.servicesTotalDenominator}`
              : `${m.servicesSetnayan}`
          }
          label="services planned with Setnayan"
        />
      ) : null}

      {/* M2 — first-pick hit rate */}
      {m.firstPickDen > 0 ? (
        <Stat
          big={`${m.firstPickNum}/${m.firstPickDen}`}
          label="vendors that were our #1 match"
        />
      ) : null}

      {/* M3 — estimated time saved */}
      <Stat
        big={`≈${m.hoursSaved}`}
        unit="hrs"
        label="of planning time saved"
        note="estimated"
      />

      {/* Supporting count strip: guests · photos · replied */}
      <div className="grid grid-cols-3 border-b border-ink/15 text-center">
        <StripCell value={fmt(m.guests)} label="Guests" />
        {m.photos != null ? (
          <StripCell value={fmt(m.photos)} label="Photos" />
        ) : (
          <StripCell value={m.attending ? fmt(m.attending) : '—'} label="Attending" />
        )}
        <StripCell value={m.rsvpPct != null ? `${m.rsvpPct}%` : '—'} label="Replied" last />
      </div>

      <p className="px-2 py-2 text-center font-serif text-[13px] italic text-mulberry">
        &ldquo;Set na &rsquo;yan.&rdquo; — your wedding, handled.
      </p>
    </div>
  );
}

function Stat({
  big,
  unit,
  label,
  note,
}: {
  big: string;
  unit?: string;
  label: string;
  note?: string;
}): JSX.Element {
  return (
    <div className="border-b border-ink/15 px-3 py-3 text-center">
      <div className="font-display text-4xl font-bold leading-none text-ink">
        {big}
        {unit ? <span className="text-terracotta"> {unit}</span> : null}
      </div>
      <div className="mt-1 font-serif text-[13.5px] leading-tight text-ink/70">{label}</div>
      {note ? (
        <div className="mt-0.5 font-mono text-[7px] uppercase tracking-[0.18em] text-ink/40">
          {note}
        </div>
      ) : null}
    </div>
  );
}

function StripCell({
  value,
  label,
  last,
}: {
  value: string;
  label: string;
  last?: boolean;
}): JSX.Element {
  return (
    <div className={`px-1 py-2 ${last ? '' : 'border-r border-ink/15'}`}>
      <b className="block font-display text-lg font-bold leading-none">{value}</b>
      <span className="font-mono text-[7px] uppercase tracking-[0.08em] text-ink/45">{label}</span>
    </div>
  );
}

function SectionRule({ title }: { title: string }): JSX.Element {
  return (
    <div className="my-7 flex items-center gap-3">
      <span aria-hidden className="h-px flex-1 bg-ink" />
      <h3 className="m-0 whitespace-nowrap font-display text-2xl font-bold">{title}</h3>
      <span aria-hidden className="h-px flex-1 bg-ink" />
    </div>
  );
}

function Timeline({
  milestones,
}: {
  milestones: NonNullable<EditorialData['loveStory']['milestones']>;
}): JSX.Element {
  return (
    <ol className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
      {milestones.slice(0, 9).map((ms, i) => (
        <li key={i} className="border-l-2 border-terracotta pl-3">
          {ms.year ? (
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta">
              {ms.year}
            </div>
          ) : null}
          {ms.title ? (
            <div className="mt-0.5 font-display text-lg font-semibold leading-tight">
              {ms.title}
            </div>
          ) : null}
          {ms.note ? <p className="mt-1 font-serif text-sm leading-snug text-ink/70">{ms.note}</p> : null}
        </li>
      ))}
    </ol>
  );
}

function FromTheCouple({
  message,
  attribution,
}: {
  message: string;
  attribution: string;
}): JSX.Element {
  return (
    <blockquote className="mx-auto max-w-2xl border-y-2 border-ink px-2 py-5 text-center">
      <p className="m-0 font-display text-xl font-medium italic leading-snug text-ink sm:text-2xl">
        &ldquo;{message}&rdquo;
      </p>
      <footer className="mt-3 font-mono text-[9px] uppercase tracking-[0.16em] text-ink/45">
        &mdash; {attribution}
      </footer>
    </blockquote>
  );
}

function ReviewsEmptyState(): JSX.Element {
  return (
    <p className="mx-auto max-w-xl text-center font-serif text-sm italic text-ink/45">
      Reviews from guests and vendors will appear here.
    </p>
  );
}

function Colophon({ names, city }: { names: string; city: string | null }): JSX.Element {
  return (
    <footer className="mt-7 border-t-[3px] border-double border-ink pt-3 text-center">
      <div className="flex flex-wrap justify-center gap-5 font-mono text-[9px] uppercase tracking-[0.1em]">
        <a href="#" className="border-b border-terracotta pb-0.5 text-ink no-underline">
          The Invitation (RSVP)
        </a>
        <a href="#" className="border-b border-terracotta pb-0.5 text-ink no-underline">
          The Wedding Day (Live)
        </a>
        <a href="#" className="border-b border-terracotta pb-0.5 text-ink no-underline">
          Watch the Film
        </a>
      </div>
      <p className="mt-3 font-serif text-sm italic text-ink/45">
        Powered by Setnayan{city ? ` · ${city}` : ''} · {names}
      </p>
    </footer>
  );
}

// ── tiny presentational helpers ───────────────────────────────────────────────

function nameplate(displayName: string): string {
  const cleaned = displayName.replace(/\s*\([^)]*\)\s*/g, '').trim();
  return `The ${cleaned} Chronicle`;
}

function editionCenter(data: EditorialData): string {
  const parts: string[] = [];
  if (data.venueCity) parts.push(data.venueCity);
  if (data.eventDateFormatted) parts.push(data.eventDateFormatted);
  return parts.join(' · ') || 'Commemorative Edition';
}

function fmt(n: number): string {
  try {
    return n.toLocaleString('en-PH');
  } catch {
    return String(n);
  }
}

function prettyCategory(category: string): string {
  return category.replace(/_/g, ' ');
}
