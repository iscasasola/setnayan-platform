// ============================================================================
// POST EVENT SCENES, EACH IN ITS STYLE — slice 2: Photo notes · Messages ·
// Papic Challenge · Supplier Stories · Live Stream · Videos.
// ============================================================================
//
// Translated from `prototypes/post_event_scenes_styles_2026-09-29.html` (the
// prototype's class names are noted beside each style), phone first at 375 px.
// The same contract as `post-event-scene-views.tsx`: presentational server
// components, every value already through the story's two fences, the three
// parts (label · heading · words) found by the shipped selectors — a micro-line
// that is not one of them is a `span`, never a `p`.
//
// 🔒 What a scene is given is what it draws. Where the prototype drew a fact the
// platform does not hold, the style draws what IS held and the gap is said in
// the changelog, never filled in: a supplier's photo is not paired with "a
// guest's capture of the same minute" (supplier media carry no time), and a
// challenge has no fixed choices, so its third style is the share of answers
// each question drew.
//
// Nothing interactive sits inside an open-up's preview (it is a button): the
// films play in the layer, the replay's chapters are listed, not linked.

import type { ReactElement, ReactNode } from 'react';
import type { ChallengeAnswer, KwentoQuote, VendorCredit, VendorMediaItem } from './data';
import type { EventRecommendation } from '@/lib/vendor-recommendations';
import type { EventFilm } from '@/lib/event-films';
import type { PostEventStyleId } from '@/lib/post-event-styles';
import type { PeWords } from './post-event-scene-views';
import { byVoiceWeight, roleLabel, voiceOf } from './voices';
import { formatCount } from '@/lib/format-number';

const say = (words: PeWords, part: keyof PeWords, fallback: string): string => words[part] ?? fallback;
const EYEBROW = 'pahina-eyebrow m-0 font-mono text-xs font-semibold uppercase tracking-[0.22em] text-terracotta-700';
const EYEBROW_ON_DARK = 'pahina-eyebrow m-0 font-mono text-xs font-semibold uppercase tracking-[0.22em] text-cream/90';
const MICRO = 'font-mono text-xs font-semibold uppercase tracking-[0.18em] text-ink/60';
const H2 = 'mt-1.5 font-serif text-[2rem] leading-[1.02] text-ink';
const fmt = (n: number) => n.toLocaleString('en-PH');

function Photo({ url, alt = '', className = '' }: { url: string | null | undefined; alt?: string; className?: string }): ReactElement {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt} aria-hidden={alt ? undefined : true} className={`h-full w-full object-cover ${className}`} loading="lazy" decoding="async" />
  ) : (
    <span aria-hidden className={`block h-full w-full bg-gradient-to-br from-terracotta/25 via-cream to-terracotta/40 ${className}`} />
  );
}

/** "3:07 PM" in Manila, from an instant. */
function clockOf(iso: string | null | undefined): string | null {
  const ms = iso ? Date.parse(iso) : Number.NaN;
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila' }).replace(/ /g, ' ');
}

const stillOf = (m: KwentoQuote['media']) => (m ? (m.type === 'clip' ? (m.posterUrl ?? null) : m.url) : null);

/** A strip that swipes sideways — CSS scroll-snap, no script. */
function Swipe({ children, className = '' }: { children: ReactNode; className?: string }): ReactElement {
  return <div className={`-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 sm:-mx-10 sm:px-10 ${className}`}>{children}</div>;
}

/* ══════════════════════════════════════════════════════════════════════════
   06 · PHOTO NOTES ("Kwento") — a photo WITH what a guest said about it
   ══════════════════════════════════════════════════════════════════════════ */

export function PhotoNotesScene({
  style,
  quotes,
  label,
  words,
}: {
  style: PostEventStyleId;
  quotes: readonly KwentoQuote[];
  /** "Photo notes" — the owner's plain name (`PHOTO_NOTES_LABEL`). */
  label: string;
  words: PeWords;
}): ReactElement {
  const eyebrow = say(words, 'label', `${label} · ${fmt(quotes.length)}`);
  if (style === 'swipe-story') {
    /* .kstory — one full photo at a time, the message across it; swipe for the next. */
    return (
      <div className="py-4">
        <p className={EYEBROW}>{eyebrow}</p>
        <Swipe className="mt-3">
          {quotes.slice(0, 24).map((q, i) => {
            const at = clockOf(q.atIso);
            return (
              <figure key={i} className="relative m-0 h-[70svh] max-h-[640px] w-[85%] shrink-0 snap-center overflow-hidden rounded-sm bg-ink sm:w-[420px]">
                <Photo url={stillOf(q.media)} />
                <span aria-hidden className="absolute inset-0 bg-gradient-to-b from-ink/40 via-transparent to-ink/75" />
                <span aria-hidden className="absolute inset-x-3.5 top-2 flex gap-1">
                  {Array.from({ length: Math.min(12, quotes.length) }, (_, k) => (
                    <span key={k} className={`h-[3px] flex-1 rounded-full ${k <= i ? 'bg-cream' : 'bg-cream/35'}`} />
                  ))}
                </span>
                <span className="absolute left-4 top-6 font-mono text-xs uppercase tracking-[0.2em] text-cream">
                  {formatCount(i + 1)} of {formatCount(quotes.length)}
                </span>
                <figcaption className="absolute inset-x-5 bottom-10 text-cream">
                  <span className="block font-serif text-[1.8rem] leading-[1.1]">&ldquo;{q.body}&rdquo;</span>
                  {q.author ? <span className="mt-3 block font-script text-[1.7rem] leading-none text-cream/90">{q.author}</span> : null}
                  {at ? <span className="mt-1 block text-xs text-cream/80">{at}</span> : null}
                </figcaption>
              </figure>
            );
          })}
        </Swipe>
      </div>
    );
  }
  if (style === 'scrapbook-pairs') {
    /* .kpairs — photo and note side by side, alternating sides, photos tilted. */
    return (
      <div className="py-8">
        <p className={EYEBROW}>{eyebrow}</p>
        <h2 className={H2}>{say(words, 'heading', 'Told by the ones who were there')}</h2>
        <div className="mt-4 flex flex-col gap-7">
          {quotes.slice(0, 9).map((q, i) => (
            <div key={i} className={`grid items-center gap-3.5 ${i % 2 ? 'grid-cols-[1fr_140px]' : 'grid-cols-[140px_1fr]'}`}>
              <span
                className={`block h-[170px] overflow-hidden rounded-sm shadow-[0_14px_28px_-16px_rgba(30,34,41,0.55)] ${i % 2 ? 'order-2 rotate-2' : '-rotate-2'}`}
              >
                <Photo url={stillOf(q.media)} />
              </span>
              <span className="block">
                <span className="block text-[0.97rem] leading-snug text-ink">{q.body}</span>
                {q.author ? <span className="mt-1.5 block font-script text-xl text-terracotta-700">— {q.author}</span> : null}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  /* photo-note · .kcard — one card per note: the photo on top, the message under it, signed with its minute. */
  return (
    <div className="py-8">
      <p className={EYEBROW}>{eyebrow}</p>
      <h2 className={H2}>{say(words, 'heading', 'A photo, and what they said about it')}</h2>
      <div className="mt-2 grid gap-6 sm:grid-cols-2">
        {quotes.slice(0, 8).map((q, i) => {
          const at = clockOf(q.atIso);
          const still = stillOf(q.media);
          return (
            <figure key={i} className="m-0 mt-3.5 bg-cream p-2.5 pb-4 shadow-[0_22px_44px_-26px_rgba(30,34,41,0.6),0_1px_2px_rgba(30,34,41,0.06)]">
              {still ? (
                <span className="block h-[200px] overflow-hidden rounded-sm">
                  <Photo url={still} />
                </span>
              ) : null}
              <blockquote className="m-0 px-1.5 pt-3.5 text-[1.05rem] leading-snug text-ink">{q.body}</blockquote>
              <figcaption className="flex items-baseline justify-between px-1.5 pt-2.5 text-xs text-ink/60">
                {q.author ? <span className="font-script text-[1.35rem] text-terracotta-700">{q.author}</span> : <span />}
                {at ? <span>{at}</span> : null}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   07 · MESSAGES — the guests' letters (`guest_columns`)
   ══════════════════════════════════════════════════════════════════════════ */

export type Letter = { title: string; body: string; author: string | null; role: string | null };

/**
 * ✉ THE THREE VOICES (spec §5, built 2026-08-18) carry into every style:
 * parents lead and are drawn larger, the named party follows with a role
 * badge, everyone else after (`byVoiceWeight`). 🔒 A role badge is printed
 * ONLY beside a name — there is exactly one maid of honour, and a badge over
 * an unnamed letter would name her anyway (DPO ruling 2026-08-06).
 */
export function MessagesScene({
  style,
  letters,
  words,
}: {
  style: PostEventStyleId;
  letters: readonly Letter[];
  words: PeWords;
}): ReactElement {
  const ordered = byVoiceWeight(letters);
  const byline = (c: Letter): string | null =>
    c.author ? `${c.author}${roleLabel(c.role) ? ` · ${roleLabel(c.role)}` : ''}` : null;
  if (style === 'note-wall') {
    /* .wall — every letter as a pinned note, four paper tones, signed; a parent's note is wider. */
    const tones = ['bg-cream', 'bg-terracotta/10', 'bg-ink/[0.04]', 'bg-terracotta/[0.06]'];
    const tilt = ['-rotate-2', 'rotate-3', 'rotate-1', '-rotate-[2.5deg]', 'rotate-2', '-rotate-3'];
    const cut = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);
    return (
      <div className="py-8">
        <p className={EYEBROW}>{say(words, 'label', `Messages · ${fmt(letters.length)}`)}</p>
        <h2 className={H2}>{say(words, 'heading', 'Letters')}</h2>
        <div className="mt-4 grid grid-cols-2 gap-3.5 sm:grid-cols-3">
          {ordered.slice(0, 12).map((c, i) => (
            <figure
              key={i}
              className={`m-0 p-3.5 leading-snug text-ink shadow-[0_14px_30px_-18px_rgba(30,34,41,0.6),0_1px_2px_rgba(30,34,41,0.06)] ${tones[i % 4]} ${tilt[i % 6]} ${
                voiceOf(c.role) === 'parents' ? 'col-span-2 text-base' : 'text-[0.9rem]'
              }`}
            >
              <span className="block">{cut(c.body, voiceOf(c.role) === 'parents' ? 320 : 160)}</span>
              {c.author ? <span className="mt-2 block font-script text-lg text-terracotta-700">{byline(c)}</span> : null}
            </figure>
          ))}
        </div>
      </div>
    );
  }
  if (style === 'quote-cards') {
    /* .quotes — three big quotes, a large gold mark and a name line each; a parent leads. */
    const cut = (t: string) => (t.length > 180 ? `${t.slice(0, 179).trimEnd()}…` : t);
    return (
      <div className="flex min-h-[60svh] flex-col justify-center py-8">
        <p className={EYEBROW}>{say(words, 'label', 'What they wrote')}</p>
        <div className="mt-5 flex flex-col gap-7">
          {ordered.slice(0, 3).map((c, i) => (
            <figure key={i} className="relative m-0 pl-6">
              <span aria-hidden className="absolute -left-1.5 -top-5 font-serif text-[4.4rem] leading-none text-terracotta">
                &ldquo;
              </span>
              <blockquote className={`m-0 font-serif leading-[1.15] text-ink ${i === 0 ? 'text-[2rem]' : 'text-2xl'}`}>{cut(c.body)}</blockquote>
              {c.author ? <figcaption className="mt-2 text-sm text-ink/60">{byline(c)}</figcaption> : null}
            </figure>
          ))}
        </div>
        {letters.length > 3 ? <span className={`${MICRO} mt-8 block text-center`}>{fmt(letters.length - 3)} more</span> : null}
      </div>
    );
  }
  /* one-letter · .letter — one voice per screen, a drop cap; swipe between letters. */
  return (
    <div className="py-6">
      <p className={EYEBROW}>{say(words, 'label', `Messages · ${fmt(letters.length)}`)}</p>
      <Swipe className="mt-3">
        {ordered.map((c, i) => (
          <article key={i} className="flex min-h-[60svh] w-[88%] shrink-0 snap-center flex-col px-1.5 sm:w-[560px]">
            <span className={`${MICRO} flex justify-between gap-3`}>
              <span>
                Letters · {formatCount(i + 1)} of {formatCount(letters.length)}
              </span>
              <span className="truncate">{c.title}</span>
            </span>
            <span
              className={`mt-5 block whitespace-pre-line leading-relaxed text-ink first-letter:float-left first-letter:pr-2 first-letter:pt-1.5 first-letter:font-serif first-letter:text-[3.5rem] first-letter:leading-[0.8] first-letter:text-terracotta-700 ${
                voiceOf(c.role) === 'parents' ? 'text-[1.2rem]' : 'text-[1.08rem]'
              }`}
            >
              {c.body}
            </span>
            {c.author ? (
              <>
                <span className="mt-5 block font-script text-[2rem] leading-none text-terracotta-700">{c.author}</span>
                {roleLabel(c.role) ? <span className="block text-sm text-ink/60">{roleLabel(c.role)}</span> : null}
              </>
            ) : null}
          </article>
        ))}
      </Swipe>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   12 · PAPIC CHALLENGE — the couple's questions, the guests' photo answers
   ══════════════════════════════════════════════════════════════════════════ */

export function ChallengeScene({
  style,
  answers,
  words,
}: {
  style: PostEventStyleId;
  answers: readonly ChallengeAnswer[];
  words: PeWords;
}): ReactElement {
  const byPrompt = new Map<string, ChallengeAnswer[]>();
  for (const a of answers) byPrompt.set(a.prompt, [...(byPrompt.get(a.prompt) ?? []), a]);
  const prompts = [...byPrompt.entries()];
  const still = (a: ChallengeAnswer) => (a.mediaType === 'clip' ? a.posterUrl : a.url);
  const eyebrow = say(
    words,
    'label',
    `What we asked · ${prompts.length} ${prompts.length === 1 ? 'question' : 'questions'} · ${fmt(answers.length)} ${answers.length === 1 ? 'answer' : 'answers'}`,
  );
  if (style === 'photo-grid') {
    /* .pgrid2 — one question per screen, its photo answers three across, a first name on each. */
    return (
      <div className="py-6">
        <p className={EYEBROW}>{eyebrow}</p>
        {prompts.map(([prompt, list]) => {
          const times = list.map((a) => clockOf(a.atIso)).filter(Boolean) as string[];
          return (
            <section key={prompt} className="flex min-h-[60svh] flex-col py-4">
              <h3 className="m-0 font-serif text-[1.9rem] leading-[1.05] text-ink">&ldquo;{prompt}&rdquo;</h3>
              <span className="mt-2 block text-sm text-ink/60">
                {fmt(list.length)} photo {list.length === 1 ? 'answer' : 'answers'}
                {times.length > 1 ? ` · ${times[0]} – ${times[times.length - 1]}` : ''}
              </span>
              <span className="mt-3.5 grid grid-cols-3 gap-1.5">
                {list.slice(0, 12).map((a, i) => (
                  <span key={i} className="relative block aspect-square overflow-hidden rounded-sm">
                    <Photo url={still(a)} />
                    {a.byline ? (
                      <span className="absolute bottom-1.5 left-1.5 font-mono text-xs uppercase tracking-[0.1em] text-cream [text-shadow:0_1px_4px_rgba(0,0,0,.6)]">
                        {a.byline.split(' ')[0]}
                      </span>
                    ) : null}
                  </span>
                ))}
              </span>
            </section>
          );
        })}
      </div>
    );
  }
  if (style === 'answer-share') {
    /* .poll — each question's share of the answers as a hero figure and a gold track.
       (A question with fixed choices is not held by the platform — the share each
       question drew is the comparison that IS true.) */
    const total = Math.max(1, answers.length);
    const ranked = [...prompts].sort((a, b) => b[1].length - a[1].length);
    return (
      <div className="flex min-h-[60svh] flex-col justify-center py-8">
        <p className={EYEBROW}>{eyebrow}</p>
        <div className="mt-5 flex flex-col gap-5">
          {ranked.map(([prompt, list], i) => {
            const pct = Math.round((list.length / total) * 100);
            return (
              <div key={prompt} className="grid grid-cols-[1fr_auto] items-end gap-2">
                <span className={`font-serif leading-tight text-ink ${i === 0 ? 'text-xl' : 'text-lg'}`}>&ldquo;{prompt}&rdquo;</span>
                <span className="font-serif text-2xl leading-none text-ink">{pct}%</span>
                <span className="relative col-span-2 block h-1.5 overflow-hidden rounded-full bg-ink/10">
                  <span className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-terracotta/60 to-terracotta" style={{ width: `${pct}%` }} />
                </span>
                <span className="col-span-2 text-xs text-ink/60">
                  {fmt(list.length)} of {fmt(answers.length)} answers
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  /* q-and-a · .qa — each question in display serif, its first answers, "N more". */
  return (
    <div className="py-8">
      <p className={EYEBROW}>{eyebrow}</p>
      <div className="mt-4 flex flex-col gap-7">
        {prompts.map(([prompt, list]) => (
          <div key={prompt}>
            <h3 className="m-0 font-serif text-[1.55rem] leading-[1.1] text-ink">{prompt}</h3>
            <span className="mt-3 grid grid-cols-2 gap-2.5">
              {list.slice(0, 2).map((a, i) => (
                <span key={i} className="block border-t-2 border-terracotta/60 pt-2">
                  <span className="block aspect-[4/5] overflow-hidden rounded-sm">
                    <Photo url={still(a)} />
                  </span>
                  {a.byline ? <span className="mt-1.5 block font-script text-lg text-terracotta-700">{a.byline}</span> : null}
                </span>
              ))}
            </span>
            {list.length > 2 ? <span className={`${MICRO} mt-2 block`}>{fmt(list.length - 2)} more answers</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   09 · SUPPLIER STORIES — the team, in their own frames and in the credits
   ══════════════════════════════════════════════════════════════════════════ */

const role = (c: string | null) => (c ? c.replace(/_/g, ' ') : 'Supplier');

export function SupplierStoriesScene({
  style,
  team,
  media,
  loved,
  words,
}: {
  style: PostEventStyleId;
  /** The booked team, as the story credits them. */
  team: readonly VendorCredit[];
  /** Their own frames from the day. */
  media: readonly VendorMediaItem[];
  /** The ones the couple would book again, with their words. */
  loved: readonly EventRecommendation[];
  words: PeWords;
}): ReactElement {
  const again = new Set(loved.map((l) => l.businessName.trim().toLowerCase()));
  const lovedOf = (name: string) => loved.find((l) => l.businessName.trim().toLowerCase() === name.trim().toLowerCase()) ?? null;
  if (style === 'photo-strip') {
    /* .vstrip — one panel per supplier, swiped; their line under their name; ♥ chips. */
    return (
      <div className="py-8">
        <p className={EYEBROW}>{say(words, 'label', `From your suppliers · ${fmt(Math.max(team.length, media.length))}`)}</p>
        <h2 className={H2}>{say(words, 'heading', 'The team, in their own frames')}</h2>
        {media.length > 0 ? (
          <Swipe className="mt-3.5">
            {media.slice(0, 12).map((m, i) => (
              <figure key={i} className="m-0 w-[250px] shrink-0 snap-start">
                <span className="block h-[300px] overflow-hidden rounded-sm">
                  <Photo url={m.stillUrl} alt={`${m.vendorName} — their frame`} />
                </span>
                <figcaption className="mt-2.5 flex items-baseline justify-between gap-2">
                  <span className="font-serif text-xl text-ink">{m.vendorName}</span>
                  <span className={MICRO}>{role(m.category)}</span>
                </figcaption>
                {m.caption ? <span className="mt-1 block text-sm text-ink/70">{m.caption}</span> : null}
              </figure>
            ))}
          </Swipe>
        ) : null}
        {loved.length > 0 || team.length > 0 ? (
          <span className="mt-4 flex flex-wrap gap-2">
            {loved.length > 0 ? (
              <span className="inline-flex min-h-[30px] items-center rounded-full bg-terracotta-700 px-3 font-mono text-xs uppercase tracking-[0.14em] text-cream">
                ♥ Would book again
              </span>
            ) : null}
            {(loved.length > 0 ? loved.map((l) => l.businessName) : team.map((t) => t.name)).slice(0, 8).map((n) => (
              <span key={n} className="inline-flex min-h-[30px] items-center rounded-full bg-ink/5 px-3 font-mono text-xs uppercase tracking-[0.14em] text-ink">
                {n}
              </span>
            ))}
          </span>
        ) : null}
      </div>
    );
  }
  if (style === 'side-by-side') {
    /* .vsbs — each supplier's own photo beside what the couple said about them.
       (Pairing it with a guest's capture of the same minute needs supplier media
       to carry its time — not held yet.) */
    const rows = media.length > 0 ? media.slice(0, 6) : [];
    return (
      <div className="py-8">
        <p className={EYEBROW}>{say(words, 'label', 'From your suppliers')}</p>
        <h2 className={H2}>{say(words, 'heading', 'Their frame, your word')}</h2>
        <div className="mt-4 flex flex-col gap-6">
          {rows.map((m, i) => {
            const l = lovedOf(m.vendorName);
            return (
              <div key={i} className="grid grid-cols-2 gap-2">
                <span className="relative block h-[150px] overflow-hidden rounded-sm">
                  <Photo url={m.stillUrl} alt={`${m.vendorName} — their frame`} />
                </span>
                <span className="flex h-[150px] flex-col justify-center rounded-sm bg-ink/[0.04] px-3">
                  <span className="font-serif text-lg leading-snug text-ink">
                    {l?.endorsement ? `“${l.endorsement}”` : (m.caption ?? role(m.category))}
                  </span>
                </span>
                <span className="col-span-2 flex items-baseline justify-between">
                  <span className="font-serif text-xl text-ink">{m.vendorName}</span>
                  <span className={MICRO}>
                    {role(m.category)}
                    {again.has(m.vendorName.trim().toLowerCase()) ? ' · ♥ again' : ''}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  /* credits-roll · .credits — role → name, like the credits of a film, on a dark ground. */
  const credits = team.length > 0 ? team.map((t) => ({ name: t.name, category: t.category })) : media.map((m) => ({ name: m.vendorName, category: m.category }));
  const seen = new Set<string>();
  const unique = credits.filter((c) => (seen.has(c.name) ? false : (seen.add(c.name), true)));
  return (
    <div className="-mx-5 flex min-h-[70svh] flex-col justify-center bg-ink px-6 py-10 text-center text-cream sm:-mx-10">
      <p className={EYEBROW_ON_DARK}>{say(words, 'label', 'The team')}</p>
      {unique.map((c) => {
        const l = lovedOf(c.name);
        return (
          <div key={c.name} className="mt-5">
            <span className="block font-mono text-xs uppercase tracking-[0.24em] text-cream/70">{role(c.category)}</span>
            <span className="mt-1 block font-serif text-[1.65rem] leading-[1.1] text-cream">
              {c.name}
              {l ? <span className="ml-2 text-sm tracking-[0.1em] text-cream/85">♥ again</span> : null}
            </span>
            {l?.endorsement ? <span className="mt-0.5 block text-sm text-cream/75">&ldquo;{l.endorsement}&rdquo;</span> : null}
          </div>
        );
      })}
      <span className="mt-7 block font-script text-[2rem] text-cream/90">thank you</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   14 · LIVE STREAM (the preview — the replay itself plays in the open-up)
   15 · VIDEOS
   ══════════════════════════════════════════════════════════════════════════ */

export type Highlight = { title: string; timecode: string };

export function LiveStreamPreview({
  style,
  still,
  names,
  highlights,
  words,
}: {
  style: PostEventStyleId;
  still: string | null;
  names: string;
  /** The day's chapters with their place in the replay (`filmTimecode`). */
  highlights: readonly Highlight[];
  words: PeWords;
}): ReactElement {
  const play = (
    <span aria-hidden className="absolute left-1/2 top-1/2 inline-flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-cream/90 text-2xl text-ink shadow-lg">
      ▶
    </span>
  );
  if (style === 'full-replay') {
    /* .replay .player — one player, large. */
    return (
      <div className="py-6">
        <p className={EYEBROW}>{say(words, 'label', 'Watch Live · the replay')}</p>
        <h2 className={H2}>{say(words, 'heading', `As it was broadcast`)}</h2>
        <span className="relative -mx-5 mt-3.5 block aspect-video overflow-hidden bg-ink sm:-mx-10">
          <Photo url={still} alt={`${names} — the broadcast`} className="opacity-80" />
          <span className="absolute left-3.5 top-3 rounded-full bg-ink/50 px-2 py-1 font-mono text-xs uppercase tracking-[0.2em] text-cream">Live</span>
          {play}
        </span>
      </div>
    );
  }
  if (style === 'by-chapter') {
    /* .hl — the replay listed by the chapters of the day, each at its place in it. */
    return (
      <div className="py-6">
        <p className={EYEBROW}>{say(words, 'label', 'Watch Live · the replay')}</p>
        <h2 className={H2}>{say(words, 'heading', 'Jump to a moment')}</h2>
        {highlights.length > 0 ? (
          <span className="mt-4 flex flex-col gap-3">
            {highlights.slice(0, 8).map((h, i) => (
              <span key={i} className="grid grid-cols-[88px_1fr] items-center gap-3">
                <span className="font-mono text-sm tabular-nums text-terracotta-700">{h.timecode}</span>
                <span className="font-serif text-lg leading-tight text-ink">{h.title}</span>
              </span>
            ))}
          </span>
        ) : (
          <span className="relative mt-3.5 block aspect-video overflow-hidden rounded-sm bg-ink">
            <Photo url={still} className="opacity-80" />
            {play}
          </span>
        )}
      </div>
    );
  }
  /* replay-card · .wcard — a poster, one line, one button. */
  return (
    <div className="flex flex-col items-center py-8 text-center">
      <span className="relative block aspect-video w-full overflow-hidden rounded-sm bg-ink">
        <Photo url={still} alt={`${names} — the broadcast`} className="opacity-85" />
        {play}
      </span>
      <p className={`${EYEBROW} mt-5`}>{say(words, 'label', 'Watch Live')}</p>
      <h2 className={H2}>{say(words, 'heading', 'Watch the replay')}</h2>
    </div>
  );
}

export function VideosScene({
  style,
  films,
  words,
  asPreview = false,
}: {
  style: PostEventStyleId;
  films: readonly EventFilm[];
  words: PeWords;
  /** Inside an open-up's button: thumbnails only, never a player. */
  asPreview?: boolean;
}): ReactElement {
  const head = (fallback: string) => (
    <>
      <p className={EYEBROW}>{say(words, 'label', `Videos · ${fmt(films.length)}`)}</p>
      <h2 className={H2}>{say(words, 'heading', fallback)}</h2>
    </>
  );
  const thumb = (f: EventFilm, className: string, lead = false) => (
    <span className={`relative block overflow-hidden rounded-sm bg-ink ${className}`}>
      <Photo url={f.thumbUrl} alt={lead ? (f.label ?? 'A film from the day') : ''} className="opacity-90" />
      <span aria-hidden className="absolute left-1/2 top-1/2 inline-flex h-11 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl bg-ink/60 text-cream">
        ▶
      </span>
    </span>
  );
  const player = (f: EventFilm, className: string) => (
    <span className={`relative block overflow-hidden rounded-sm bg-ink/5 ${className}`}>
      <iframe
        src={f.embedUrl}
        title={f.label ?? 'A film from the day'}
        loading="lazy"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        className="absolute inset-0 h-full w-full border-0"
      />
    </span>
  );
  const lead = films[0];
  if (!lead) return <div />;
  if (style === 'playlist-row') {
    /* .plrow — the films side by side, swiped. */
    return (
      <div className="py-6">
        {head('Watch')}
        <Swipe className="mt-3.5">
          {films.map((f, i) => (
            <span key={`${f.provider}-${f.videoId}`} className="block w-[220px] shrink-0 snap-start">
              {asPreview ? thumb(f, 'aspect-video', i === 0) : player(f, 'aspect-video')}
              {f.label ? <span className="mt-1.5 block font-serif text-lg leading-tight text-ink">{f.label}</span> : null}
            </span>
          ))}
        </Swipe>
      </div>
    );
  }
  if (style === 'film-grid') {
    /* .vgrid — the first film wide, the rest two across. */
    return (
      <div className="py-6">
        {head('Every film from the day')}
        <span className="mt-3.5 grid grid-cols-2 gap-2.5">
          {films.map((f, i) => (
            <span key={`${f.provider}-${f.videoId}`} className={i === 0 ? 'col-span-2 block' : 'block'}>
              {asPreview ? thumb(f, 'aspect-video', i === 0) : player(f, 'aspect-video')}
              {f.label ? <span className="mt-1.5 block font-serif text-base leading-tight text-ink">{f.label}</span> : null}
            </span>
          ))}
        </span>
      </div>
    );
  }
  /* featured · .yt — the first film leads; the rest as chips beneath it. */
  return (
    <div className="py-6">
      {head(lead.label ?? 'The film')}
      <span className="-mx-5 mt-3.5 block sm:-mx-10">{asPreview ? thumb(lead, 'aspect-video', true) : player(lead, 'aspect-video')}</span>
      {films.length > 1 ? (
        <span className="mt-3 flex flex-wrap gap-2">
          {films.slice(1).map((f) => (
            <span key={`${f.provider}-${f.videoId}`} className="inline-flex min-h-[30px] items-center rounded-full bg-ink/5 px-3 font-mono text-xs uppercase tracking-[0.14em] text-ink">
              ▶ {f.label ?? 'A film'}
            </span>
          ))}
        </span>
      ) : null}
    </div>
  );
}
