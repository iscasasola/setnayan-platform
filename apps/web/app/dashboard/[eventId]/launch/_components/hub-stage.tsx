import Link from 'next/link';
import { Eye, PencilLine } from 'lucide-react';
import type { HubFact, HubStanding } from '@/lib/event-hub-control';

/*
  ── THE OBSIDIAN STAGE, MEASURED ───────────────────────────────────────────
  🚨 The app is LIGHT-LOCKED. Every Tailwind theme token resolves to its LIGHT
  value on this dark island and fails silently: `text-ink` is 1.27:1 here and
  `text-mulberry` is 3.81:1. So the stage paints from literals, exactly the way
  `studio/papic/_components/papic-stage.tsx` does, with the ratios written down:

    text  #FBFAF7 on #17160F ... 17.37:1  AAA
    soft  #B6B9BE on #17160F .... 9.22:1  AAA
    gold  #CBA766 on #17160F .... 7.99:1  AAA   ← gold is safe HERE and only here
    cta   #E5794E on #17160F .... 6.20:1  AA    (obsidian label on it: 6.20:1)
    card  #1E2229 raised panel — text 15.29:1 · soft 8.11:1 · gold 7.04:1

  ⛔ NEVER `--pos #4F6B4A` on this ground: 2.7:1. It is a light-ground token.
  ⚠ And the Tailwind slot named `terracotta` is the GOLD; the CTA is `mulberry`.
  These are the `--sn-ob-*` values from globals.css, inlined rather than
  referenced because this panel is obsidian in BOTH themes and a themed token
  would break exactly one of them.
*/
export const OB = {
  page: '#17160F',
  card: '#1E2229',
  text: '#FBFAF7',
  soft: '#B6B9BE',
  gold: '#CBA766',
  cta: '#E5794E',
  hairline: 'rgba(255,255,255,0.10)',
} as const;

/**
 * S1 · THE STAGE and S2 · THE FOUR FACTS — the couple's own public page, as it
 * is right now, with the four facts fused to its lower edge.
 *
 * ── WHY THIS IS ITS OWN FILE ───────────────────────────────────────────────
 * So it can be RENDERED in a test. The disease this whole build exists to fix
 * is a measurement that never reaches the pixel — a refused read that renders
 * byte-identically to an empty event — and a resolver test cannot prove the
 * render. `hub-stage-renders.test.ts` mounts this at three phases and reads the
 * emitted HTML. The precedent is `app/_components/byline-renders-as-a-door.test.ts`:
 * source guards for "does the file still say X", real DOM for "does a person
 * see it".
 *
 * It is presentational and PURE: every decision arrives already made, from
 * `lib/event-hub-control.ts`. It performs no I/O and resolves no phase.
 *
 * ⚠ EMPTY IS A PROMISE, NOT AN APOLOGY (design § 4.4). An event with nothing set
 * yet is shown THE PAGE IT WILL BECOME plus its countdown — never a sentence
 * apologising for being empty, and never a stranger's wedding as a sample. The
 * only thing that silences the miniature is a read that did not happen.
 */
export function HubStage({
  slug,
  standing,
  facts,
  channelName,
  channelBlurb,
  channelIndex,
  channelCount,
  editHref,
}: {
  slug: string | null;
  standing: HubStanding;
  facts: readonly HubFact[];
  /** The live channel's own name, or null when the event could not be read. */
  channelName: string | null;
  channelBlurb: string | null;
  /** 1-based, for "Stage 2 of 4". */
  channelIndex: number | null;
  channelCount: number;
  editHref: string;
}) {
  return (
    <section
      aria-labelledby="hub-stage-address"
      className="mt-6 overflow-hidden rounded-2xl"
      style={{ backgroundColor: OB.page }}
    >
      <div className="space-y-4 p-5 sm:p-6">
        <p
          className="font-mono text-[10px] font-bold uppercase tracking-[0.16em]"
          style={{ color: OB.gold }}
        >
          As your guests see it · right now
        </p>
        <div className="space-y-1">
          <h2
            id="hub-stage-address"
            className="text-lg font-semibold tracking-tight sm:text-xl"
            style={{ color: OB.text }}
          >
            {slug ? `setnayan.com/${slug}` : 'Your one link, once you set it'}
          </h2>
          <p className="max-w-prose text-sm" style={{ color: OB.soft }}>
            One link for the whole life of your event — it changes itself as the day comes.
          </p>
        </div>

        <div className="rounded-xl p-4 sm:p-5" style={{ backgroundColor: OB.card }}>
          {channelName ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em]"
                  style={{ backgroundColor: OB.cta, color: OB.page }}
                >
                  Active now
                </span>
                {channelIndex !== null && (
                  <span
                    className="font-mono text-[10px] uppercase tracking-[0.12em]"
                    style={{ color: OB.soft }}
                  >
                    Stage {channelIndex} of {channelCount}
                  </span>
                )}
              </div>
              <p className="mt-3 text-base font-semibold" style={{ color: OB.text }}>
                {channelName}
              </p>
              <p className="mt-1 max-w-prose text-sm" style={{ color: OB.soft }}>
                {channelBlurb}
              </p>
            </>
          ) : (
            /* NOT "you have no page". We could not read the event, so we say
               exactly that and nothing more. */
            <p className="max-w-prose text-sm" style={{ color: OB.soft }}>
              We could not reach your event just now, so we are not going to guess which page your
              guests are seeing. Nothing has been lost.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {slug ? (
            /* A real round trip to the public site, in a new tab — this is the
               couple looking at their own address the way a guest does. */
            <a
              href={`/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium"
              style={{ backgroundColor: OB.cta, color: OB.page }}
            >
              <Eye aria-hidden className="h-4 w-4" strokeWidth={2} />
              Open as a guest
            </a>
          ) : null}
          <Link
            href={editHref}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium"
            style={{ border: `1px solid ${OB.hairline}`, color: OB.text }}
          >
            <PencilLine aria-hidden className="h-4 w-4" strokeWidth={2} />
            {slug ? 'Edit the page' : 'Set your link'}
          </Link>
        </div>
      </div>

      {/* S2 · THE FOUR FACTS — fused to the stage's lower edge. They are the
          first TEXT on the page even though the stage is the first PAINT.
          🔑 An UNKNOWN fact prints an em-dash: never a 0, never a phase guessed
          from a date nobody read. `known` is the only thing standing between a
          couple with 180 guests and the sentence "0 of 0 in". */}
      <dl
        aria-label={`Your event at a glance${standing.measured ? '' : ' — some of it could not be read'}`}
        className="grid grid-cols-2 gap-px sm:grid-cols-4"
        style={{ backgroundColor: OB.hairline }}
      >
        {facts.map((fact) => (
          <div key={fact.label} className="p-3.5" style={{ backgroundColor: OB.page }}>
            <dt
              className="font-mono text-[9px] font-bold uppercase tracking-[0.14em]"
              style={{ color: OB.gold }}
            >
              {fact.label}
            </dt>
            <dd
              className="mt-1 text-[13px] font-medium leading-snug"
              style={{ color: fact.known ? OB.text : OB.soft }}
            >
              {fact.known ? fact.value : <span title="We could not read this">&mdash;</span>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
