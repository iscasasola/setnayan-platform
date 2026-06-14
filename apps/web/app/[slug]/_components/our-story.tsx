/**
 * Our Story — the couple's love story on the PRE-EVENT paths (4-path model,
 * owner 2026-06-14: "love story applies to save the date, rsvp and event").
 *
 * The love story lives once in `events.love_story` (JSONB, written at
 * onboarding; also feeds Pakanta). It used to render only in the post-event
 * Editorial; per the owner it now belongs to the run-up — Save the Date
 * (teaser), RSVP, and Event (full) — and is OUT of the Editorial (which is the
 * after-the-wedding showcase).
 *
 * This composer is a deliberately SMALL, pure cousin of the editorial's
 * composeLede: it weaves only the TIMELESS beats (how they met · the proposal ·
 * the spark) — never the editorial's past-tense "were married" closing, which
 * is wrong before the wedding. It invents nothing: every line is gated on a
 * real field. Renders nothing when there's no story to tell.
 */

type Milestone = {
  year?: string | number | null;
  title?: string | null;
  note?: string | null;
};

type LoveStoryInput = {
  how_we_met?: string | null;
  met_year?: string | number | null;
  proposal_year?: string | number | null;
  proposal?: string | null;
  proposal_setting?: string | null;
  spark?: string | null;
  spark_why?: string | null;
  milestones?: Milestone[] | null;
} | null;

function clean(s: unknown): string {
  if (s === null || s === undefined) return '';
  return String(s).trim().replace(/[.!?]+$/, '');
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** 1–2 timeless paragraphs woven from whatever storyline fields exist. */
function composeOurStory(story: NonNullable<LoveStoryInput>): string[] {
  const out: string[] = [];

  const howMet = clean(story.how_we_met);
  const metYear = clean(story.met_year) || clean(story.proposal_year);
  if (howMet) {
    const yearBit = metYear ? ` back in ${metYear}` : '';
    out.push(`It began${yearBit}, as the best stories do: ${lowerFirst(howMet)}.`);
  }

  const proposal = clean(story.proposal);
  const setting = clean(story.proposal_setting);
  const spark = clean(story.spark);
  const sparkWhy = clean(story.spark_why);
  const p2: string[] = [];
  if (proposal) {
    const settingBit = setting ? ` at ${lowerFirst(setting)}` : '';
    p2.push(`Then came the question${settingBit}: ${lowerFirst(proposal)}.`);
  }
  if (spark) {
    p2.push(
      `What keeps them coming back is ${lowerFirst(spark)}${sparkWhy ? ` — ${lowerFirst(sparkWhy)}` : ''}.`,
    );
  }
  if (p2.length) out.push(p2.join(' '));

  return out;
}

function cleanMilestones(raw: Milestone[] | null | undefined): Milestone[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((m) => m && (clean(m.year) || clean(m.title) || clean(m.note)));
}

export function OurStory({
  loveStory,
  variant = 'full',
}: {
  // The raw events.love_story JSONB — tolerant of partial/absent shapes.
  loveStory: unknown;
  // 'teaser' = a short opener for Save the Date; 'full' = prose + timeline.
  variant?: 'full' | 'teaser';
}) {
  const story = (loveStory ?? null) as LoveStoryInput;
  if (!story || typeof story !== 'object') return null;

  const paragraphs = composeOurStory(story);
  const milestones = variant === 'full' ? cleanMilestones(story.milestones) : [];

  // Nothing to tell → render nothing (graceful; never an empty section).
  if (paragraphs.length === 0 && milestones.length === 0) return null;

  if (variant === 'teaser') {
    const opener = paragraphs[0];
    if (!opener) return null;
    return (
      <section className="space-y-2 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">Our story</p>
        <p className="mx-auto max-w-prose font-serif text-lg italic text-ink/80">{opener}</p>
      </section>
    );
  }

  return (
    <section className="space-y-6 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">Our story</p>
      {paragraphs.length ? (
        <div className="mx-auto max-w-prose space-y-4">
          {paragraphs.map((p, i) => (
            <p key={i} className="text-base leading-relaxed text-ink/80">
              {p}
            </p>
          ))}
        </div>
      ) : null}
      {milestones.length ? (
        <ol className="mx-auto max-w-prose space-y-4 pt-2 text-left">
          {milestones.map((m, i) => (
            <li key={i} className="border-l border-ink/15 pl-4">
              {clean(m.year) ? (
                <p className="font-mono text-xs uppercase tracking-[0.15em] text-terracotta">
                  {clean(m.year)}
                </p>
              ) : null}
              {clean(m.title) ? (
                <p className="font-serif text-lg italic text-ink">{clean(m.title)}</p>
              ) : null}
              {clean(m.note) ? <p className="text-sm text-ink/70">{clean(m.note)}</p> : null}
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
