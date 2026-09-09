/**
 * were-you-there.tsx — a guest finds themselves in the day. Their OWN account,
 * and no other route to it.
 *
 * `01_The_Story.md` §3.7 · `08` step 2.5 · prototype `story.html` `#you`.
 *
 * 🔒 **THERE IS NO NAME FIELD, FOR ANYONE, EVER** — owner ruling 2026-09-07,
 * and it is the reason this component exists in this shape. The design it
 * replaced had a box: type your first name, and the page told you which minutes
 * you were in and where you sat. That is a guest-list lookup with a friendly
 * face. A stranger with the link types "Celine" and learns that a Celine came
 * to this wedding and sat at table 2.
 *
 * So there is nothing to type. The identity is the signed guest session minted
 * from that person's own Papic link, resolved server-side by
 * `_lib/your-own-day.server.ts`, and a reader who has not got one is told
 * plainly that this part is not for strangers — which is a better sentence than
 * an empty box would have been.
 *
 * `no-name-field-on-the-story.test.ts` holds the line over this whole tree.
 */

import { type ReactElement } from 'react';
import { SaveStoryCardButton } from '../../recap/_components/save-story-card-button';
import { SMALL_COUNTS_ARE_A_VERDICT } from '@/lib/story-room';
import type { IndexAnchor } from '@/lib/story-index';
import type { YourOwnDay } from '../../_lib/your-own-day.server';
import { YourOwnConsent } from './your-own-consent';

/** The nearest written minute to an instant, within a window. */
function anchorFor(
  atMs: number | null,
  anchors: readonly IndexAnchor[],
  windowMs: number,
): IndexAnchor | null {
  if (atMs == null || !Number.isFinite(atMs)) return null;
  let best: IndexAnchor | null = null;
  let bestD = Infinity;
  for (const a of anchors) {
    const d = Math.abs(a.atMs - atMs);
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best && bestD <= windowMs ? best : null;
}

export function WereYouThere({
  own,
  anchors,
  windowMs,
  eventId,
  occasion,
  host,
  storyCard,
}: {
  own: YourOwnDay;
  anchors: readonly IndexAnchor[];
  windowMs: number;
  eventId: string;
  /** "wedding", "celebration" — resolved by the caller from the event's words. */
  occasion: string;
  /** "couple", "host", "celebrant". */
  host: string;
  /** The 9:16 card. Null until the story is published — see the note below. */
  storyCard: { url: string; filenameBase: string } | null;
}): ReactElement {
  const minutes = [...own.appearsIn, ...own.shot]
    .map((it) => ({ it, a: anchorFor(it.atMs, anchors, windowMs) }))
    .filter((m): m is { it: (typeof own.appearsIn)[number]; a: IndexAnchor } => m.a != null);

  // One line per MINUTE, not per photograph: a guest in eleven frames of the
  // first dance was at the first dance once.
  const byMinute = new Map<string, { a: IndexAnchor; n: number }>();
  for (const m of minutes) {
    const row = byMinute.get(m.a.id);
    if (row) row.n += 1;
    else byMinute.set(m.a.id, { a: m.a, n: 1 });
  }
  const rows = [...byMinute.values()].sort((x, y) => x.a.atMs - y.a.atMs);

  const nothingYet =
    own.appearsIn.length === 0 &&
    own.shot.length === 0 &&
    own.said.length === 0 &&
    own.tableLabel == null;

  return (
    <section
      id="were-you-there"
      className="mx-auto mt-14 max-w-5xl scroll-mt-32 rounded-2xl border-2 border-ink px-4 py-6 sm:px-6 min-[1100px]:max-w-6xl"
    >
      <h2 className="font-condensed text-[clamp(1.9rem,6vw,3rem)] font-black uppercase leading-[0.9] tracking-tight">
        Were you there?
      </h2>

      {!own.signedIn ? (
        /*
          THE STRANGER'S SENTENCE. It says what this is, why they cannot open
          it, and — the part that matters — that nobody else can look them up
          either. "There is nothing to type" is a promise about the product, not
          an apology for a missing feature.
        */
        <p className="mt-2 max-w-[46ch] text-[15px] leading-relaxed text-ink/70">
          This part exists only for the people who were — and only on their own account. Open this
          page from your own Papic link and your day is here. There is nothing to type, and nobody
          can look anyone up.
        </p>
      ) : (
        <>
          <p className="mt-2 max-w-[46ch] text-[15px] leading-relaxed text-ink/70">
            You are here on your own account, from your Papic link. Nothing to type — your day is
            already yours.
          </p>

          {nothingYet ? (
            <p className="mt-4 font-serif text-lg italic text-ink/60">
              Nothing of yours has reached this {occasion} yet. When somebody photographs you, or
              you shoot something, or you leave a few words, they will be here.
            </p>
          ) : null}

          {rows.length > 0 ? (
            <div className="mt-5">
              <h3 className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-ink/60">
                The minutes you are in
              </h3>
              <ul className="mt-2 grid gap-1.5">
                {rows.map((r) => (
                  <li key={r.a.id}>
                    <a
                      href={`#${r.a.id}`}
                      className="inline-flex min-h-[44px] items-center gap-2.5 text-[15px] underline-offset-4 hover:underline"
                    >
                      <b className="rounded bg-gold/40 px-1.5 py-0.5 font-condensed text-sm font-extrabold tabular-nums tracking-wide">
                        {r.a.suffix ? `${r.a.stamp} ${r.a.suffix}` : r.a.stamp}
                      </b>
                      <span>{r.a.label}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/*
            ⚖ A SMALL NUMBER IS NOT STATED HERE EITHER. Owner ruling 2026-09-09
            — a low count "will subconsciously tell them they did not create
            enough memories for the story". It was ruled about a table and it is
            the same sentence aimed at a guest: "1 thing you shot" reads as *you
            barely turned up*. Below the threshold the tile is simply absent —
            and nothing is lost, because the minutes they are in are named in
            full above and their own words are quoted in full below. The number
            was the only part that was a score.
          */}
          <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
            {own.shot.length >= SMALL_COUNTS_ARE_A_VERDICT ? (
              <div>
                <dd className="font-condensed text-3xl font-extrabold leading-none tabular-nums">
                  {own.shot.length.toLocaleString('en-PH')}
                </dd>
                <dt className="mt-1 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-ink/60">
                  {own.shot.length === 1 ? 'thing you shot' : 'things you shot'}
                </dt>
              </div>
            ) : null}
            {own.said.length >= SMALL_COUNTS_ARE_A_VERDICT ? (
              <div>
                <dd className="font-condensed text-3xl font-extrabold leading-none tabular-nums">
                  {own.said.length.toLocaleString('en-PH')}
                </dd>
                <dt className="mt-1 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-ink/60">
                  {own.said.length === 1 ? 'thing you said' : 'things you said'}
                </dt>
              </div>
            ) : null}
            {own.tableLabel ? (
              <div>
                <dd className="font-condensed text-3xl font-extrabold leading-none">
                  {own.tableLabel}
                </dd>
                <dt className="mt-1 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-ink/60">
                  your table
                </dt>
              </div>
            ) : null}
          </dl>

          {own.tableLabel ? (
            <p className="mt-2 text-xs leading-snug text-ink/60">
              Only you see this line. The plan everybody else reads carries table labels and no
              names at all.
            </p>
          ) : null}

          {own.said.length > 0 ? (
            <div className="mt-5">
              <h3 className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-ink/60">
                What you said
              </h3>
              <ul className="mt-2 grid gap-2">
                {own.said.map((s) => (
                  <li key={s.key} className="font-serif text-[17px] italic leading-snug">
                    {s.body}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/*
            THE 9:16 CARD — the shipped one (`save-story-card-button.tsx` →
            `/api/og/…?format=story`, 1080×1920, through `saveImageToDevice`, so
            on a phone it opens the native share sheet). RULE 0: it is not
            rebuilt here, and it is absent until the story is PUBLISHED, because
            the OG route that draws it is published-gated and would hand back
            nothing to save.
          */}
          {storyCard && !nothingYet ? (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <SaveStoryCardButton
                storyCardUrl={storyCard.url}
                filenameBase={storyCard.filenameBase}
              />
              <span className="text-xs leading-snug text-ink/60">
                1080 × 1920, in the {host}&rsquo;s own colours.
              </span>
            </div>
          ) : null}

          <YourOwnConsent
            eventId={eventId}
            items={[...own.appearsIn, ...own.shot].map((i) => ({
              key: i.key,
              sourceTable: i.sourceTable,
              sourceId: i.sourceId,
            }))}
            said={own.said.map((s) => ({ key: s.key, namedPublicly: s.namedPublicly }))}
          />
        </>
      )}
    </section>
  );
}
