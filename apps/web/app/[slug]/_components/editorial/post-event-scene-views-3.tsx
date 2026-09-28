// ============================================================================
// POST EVENT SCENES, EACH IN ITS STYLE — slice 2: The Road to the Day ·
// Where Everyone Sat · Entourage · Before & After.
// ============================================================================
//
// Translated from `prototypes/post_event_scenes_styles_2026-09-29.html`, phone
// first at 375 px, under the same contract as `post-event-scene-views.tsx`.
//
// 🔒 PRIVACY IS THE DATA'S, NOT THE STYLE'S. The seat plan arrives as the story
// room (`lib/story-room.ts`): a label and a position per table and NOTHING that
// can hold a name — so no style can print one, for anyone. A guest's own table
// is the one their signed Papic session names (`loadYourOwnDay`); a stranger has
// none. The prototype's tablemates' names and per-table counts are not held by
// the room — listed as a gap, never drawn from somewhere else.
//
// 🔒 The road's guest-layer entries (the captures) arrive already filtered for
// this reader by the caller (`guestLayerAdmits`), exactly as the spine files them.

import type { ReactElement } from 'react';
import type { StoryRoom } from '@/lib/story-room';
import type { EntourageGroup, EntouragePerson } from '@/lib/entourage';
import type { PostEventStyleId } from '@/lib/post-event-styles';
import type { PeWords } from './post-event-scene-views';

const say = (words: PeWords, part: keyof PeWords, fallback: string): string => words[part] ?? fallback;
const EYEBROW = 'pahina-eyebrow m-0 font-mono text-xs font-semibold uppercase tracking-[0.22em] text-terracotta-700';
const MICRO = 'font-mono text-xs font-semibold uppercase tracking-[0.18em] text-ink/60';
const H2 = 'mt-1.5 font-serif text-[2rem] leading-[1.02] text-ink';
const fmt = (n: number) => n.toLocaleString('en-PH');
const COUNT_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty'];
const countWord = (n: number) => COUNT_WORDS[n] ?? fmt(n);

/* ══════════════════════════════════════════════════════════════════════════
   02 · THE ROAD TO THE DAY — their Love Story's moments and the platform's
   dated steps (the date set, the look saved, the team booked, the camera opened)
   ══════════════════════════════════════════════════════════════════════════ */

export type RoadEntry = {
  key: string;
  /** Epoch ms; null for a Love Story moment that carries only a year. */
  atMs: number | null;
  /** The margin figure when there is no instant — "2019". */
  year: string | null;
  title: string;
  line: string | null;
};

const monthOf = (ms: number) => new Date(ms).toLocaleDateString('en-PH', { month: 'short', timeZone: 'Asia/Manila' });
const yearOf = (ms: number) => new Date(ms).toLocaleDateString('en-PH', { year: 'numeric', timeZone: 'Asia/Manila' });

export function RoadScene({
  style,
  entries,
  dayMs,
  words,
  placeholder,
}: {
  style: PostEventStyleId;
  entries: readonly RoadEntry[];
  /** The day itself — what "days to go" counts to. Null when the event has no date. */
  dayMs: number | null;
  words: PeWords;
  placeholder: string | null;
}): ReactElement {
  const label = say(words, 'label', 'The road to the day');
  if (entries.length === 0) {
    return (
      <div className="py-8">
        <p className={EYEBROW}>{label}</p>
        {placeholder ? (
          <span data-post-event-waiting="" className="mt-4 block font-serif text-lg italic leading-snug text-ink/70">
            {placeholder}
          </span>
        ) : null}
      </div>
    );
  }
  if (style === 'diary') {
    /* .diary — the month as the margin figure; one line per entry. */
    return (
      <div className="py-8">
        <p className={EYEBROW}>{label}</p>
        <h2 className={H2}>{say(words, 'heading', 'Before it was a day, it was a plan')}</h2>
        <ol className="m-0 mt-2 list-none p-0">
          {entries.map((e) => (
            <li key={e.key} className="grid grid-cols-[64px_1fr] gap-x-3.5 border-b border-terracotta/25 py-3.5 last:border-b-0">
              <span className="font-serif text-2xl leading-none text-ink">
                {e.atMs !== null ? monthOf(e.atMs) : (e.year ?? '—')}
                <span className="mt-1 block font-mono text-xs uppercase tracking-[0.2em] text-terracotta-700">
                  {e.atMs !== null ? yearOf(e.atMs) : ''}
                </span>
              </span>
              <span className="block text-[0.97rem] leading-snug text-ink">
                <span className="font-semibold">{e.title}</span>
                {e.line ? <span className="block text-ink/70">{e.line}</span> : null}
              </span>
            </li>
          ))}
        </ol>
      </div>
    );
  }
  if (style === 'scrapbook') {
    /* .scrap — each step pinned at an angle, its caption written in by hand.
       (The prototype pins pre-event PHOTOS; the road holds no photographs yet,
       so each step is a note.) */
    const tilt = ['-rotate-3', 'rotate-2', '-rotate-1', 'rotate-3', '-rotate-2', 'rotate-1'];
    return (
      <div className="py-8">
        <p className={EYEBROW}>{label}</p>
        <h2 className={H2}>{say(words, 'heading', 'Before it was a day, it was a plan')}</h2>
        <div className="mt-5 grid grid-cols-2 gap-4">
          {entries.map((e, i) => (
            <figure
              key={e.key}
              className={`relative m-0 bg-cream px-3.5 pb-4 pt-5 shadow-[0_14px_30px_-16px_rgba(30,34,41,0.55),0_1px_2px_rgba(30,34,41,0.08)] ${tilt[i % 6]}`}
            >
              <span aria-hidden className="absolute left-1/2 top-[-8px] h-4 w-14 -translate-x-1/2 -rotate-6 bg-terracotta/35" />
              <span className="block font-script text-xl leading-tight text-terracotta-700">
                {e.atMs !== null ? `${monthOf(e.atMs)} ${yearOf(e.atMs)}` : (e.year ?? '')}
              </span>
              <span className="mt-1 block font-serif text-lg leading-tight text-ink">{e.title}</span>
              {e.line ? <span className="mt-1 block text-sm leading-snug text-ink/70">{e.line}</span> : null}
            </figure>
          ))}
        </div>
      </div>
    );
  }
  /* countdown · .tl — days to go as the hero of each stop. */
  return (
    <div className="py-8">
      <p className={EYEBROW}>{label}</p>
      <h2 className={H2}>{say(words, 'heading', 'Counting down')}</h2>
      <ol className="relative m-0 mt-4 list-none p-0 pl-7 before:absolute before:bottom-1.5 before:left-2 before:top-1.5 before:w-px before:bg-gradient-to-b before:from-terracotta/15 before:via-terracotta/80 before:to-terracotta/15">
        {entries.map((e) => {
          const days = e.atMs !== null && dayMs !== null ? Math.round((dayMs - e.atMs) / 86_400_000) : null;
          return (
            <li key={e.key} className="relative pb-5">
              <span aria-hidden className="absolute -left-[22px] top-2.5 h-2.5 w-2.5 rounded-full bg-cream shadow-[inset_0_0_0_1.5px_rgb(var(--color-terracotta))]" />
              <span className="block font-serif text-[1.9rem] leading-none text-terracotta-700">
                {days !== null && days > 0 ? fmt(days) : e.atMs !== null ? monthOf(e.atMs) : (e.year ?? '—')}
                <span className={`${MICRO} ml-2`}>
                  {days !== null && days > 0 ? (days === 1 ? 'day to go' : 'days to go') : e.atMs !== null ? yearOf(e.atMs) : ''}
                </span>
              </span>
              <span className="mt-0.5 block text-base text-ink">{e.title}</span>
              {e.line ? <span className="block text-sm text-ink/70">{e.line}</span> : null}
            </li>
          );
        })}
        {dayMs !== null ? (
          <li className="relative">
            <span aria-hidden className="absolute -left-[22px] top-2.5 h-2.5 w-2.5 rounded-full bg-terracotta" />
            <span className="block font-serif text-[1.9rem] leading-none text-terracotta-700">
              0<span className={`${MICRO} ml-2`}>the day</span>
            </span>
          </li>
        ) : null}
      </ol>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   08 · WHERE EVERYONE SAT — the seat plan; a guest's own table in gold
   ══════════════════════════════════════════════════════════════════════════ */

export function SeatingScene({
  style,
  room,
  ownTable,
  words,
}: {
  style: PostEventStyleId;
  room: StoryRoom;
  /** The reader's own table label, from their signed Papic session — null for everyone else. */
  ownTable: string | null;
  words: PeWords;
}): ReactElement {
  const tables = room.tables;
  const mine = (label: string) => ownTable !== null && label.trim().toLowerCase() === ownTable.trim().toLowerCase();
  const heading = say(words, 'heading', `${countWord(tables.length)} ${tables.length === 1 ? 'table' : 'tables'}`);
  const label = say(words, 'label', 'Where everyone sat');
  if (style === 'by-table') {
    /* .bytable — each table in a list; the reader's own row marked. */
    return (
      <div className="py-8">
        <p className={EYEBROW}>{label}</p>
        <h2 className={H2}>{heading}</h2>
        <ol className="m-0 mt-2 list-none p-0">
          {tables.map((t) => (
            <li
              key={t.id}
              className={`grid grid-cols-[52px_1fr] items-center gap-3 border-b border-terracotta/25 py-3 ${
                mine(t.label) ? '-mx-5 bg-gradient-to-r from-terracotta/15 to-transparent px-5 sm:-mx-10 sm:px-10' : ''
              }`}
            >
              <span className="font-serif text-[2rem] leading-none text-terracotta-700">{t.label.length <= 3 ? t.label : t.label.slice(0, 1)}</span>
              <span className="block">
                <span className="block font-serif text-lg text-ink">{t.label}</span>
                {mine(t.label) ? <span className={MICRO}>Your table</span> : null}
              </span>
            </li>
          ))}
        </ol>
      </div>
    );
  }
  /* The room, top-down — shared by the floor plan and (tilted) the 3D room. */
  const plan = (
    <>
      {room.stage ? (
        <span
          className="absolute grid place-items-center rounded-sm bg-terracotta/35 font-mono text-xs uppercase tracking-[0.2em] text-ink"
          style={{ left: `${room.stage.xPct}%`, top: `${room.stage.yPct}%`, width: `${room.stage.wPct}%`, height: `${Math.max(6, room.stage.hPct)}%` }}
        >
          Stage
        </span>
      ) : null}
      {room.dance ? (
        <span
          aria-hidden
          className="absolute rounded-sm bg-ink/[0.05]"
          style={{ left: `${room.dance.xPct}%`, top: `${room.dance.yPct}%`, width: `${room.dance.wPct}%`, height: `${room.dance.hPct}%` }}
        />
      ) : null}
      {tables.map((t) => {
        const long = t.shape === 'long_banquet' || t.shape === 'family_head' || t.shape === 'serpentine';
        return (
          <span
            key={t.id}
            className={`absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center font-serif text-base font-semibold ${
              long ? 'h-10 w-24 rounded-full' : 'h-12 w-12 rounded-full'
            } ${mine(t.label) ? 'bg-terracotta-700 text-cream shadow-[0_10px_18px_-8px_rgb(var(--color-terracotta))]' : 'bg-cream text-ink shadow-[inset_0_0_0_1.5px_rgb(var(--color-ink)/0.5)]'}`}
            style={{ left: `${t.xPct}%`, top: `${t.yPct}%` }}
          >
            {t.label.length <= 3 ? t.label : t.label.slice(0, 1)}
            {mine(t.label) ? (
              <span className="absolute top-full mt-1.5 whitespace-nowrap rounded-full bg-cream/90 px-2 py-0.5 font-mono text-xs uppercase tracking-[0.18em] text-terracotta-700">
                You sat here
              </span>
            ) : null}
          </span>
        );
      })}
    </>
  );
  if (style === 'room-3d') {
    /* .room — the plan tilted back like the shipped 3D room, read-only. */
    return (
      <div className="py-8">
        <p className={EYEBROW}>{label}</p>
        <h2 className={H2}>{heading}</h2>
        <div className="relative mx-[-10px] mt-4 h-[380px] [perspective:900px]">
          <div className="absolute inset-x-[6%] bottom-[6%] top-[10%] origin-bottom rounded-md bg-gradient-to-b from-cream to-ink/[0.07] shadow-[0_40px_60px_-30px_rgba(30,34,41,0.5)] [transform:rotateX(52deg)]">
            {plan}
          </div>
        </div>
        {ownTable ? <span className="mt-2 block text-sm text-ink/70">You sat at table {ownTable}.</span> : null}
      </div>
    );
  }
  /* floor-plan · .plan — top-down, hairline circles, the reader's table in gold. */
  return (
    <div className="py-8">
      <p className={EYEBROW}>{label}</p>
      <h2 className={H2}>{heading}</h2>
      <div className="relative mt-4 aspect-[4/5] w-full rounded-md bg-gradient-to-b from-ink/[0.03] to-transparent sm:aspect-[16/10]">{plan}</div>
      <span className="mt-6 flex gap-6">
        <span>
          <span className="block font-serif text-[2.1rem] leading-none text-ink">{fmt(tables.length)}</span>
          <span className={MICRO}>tables</span>
        </span>
        {ownTable ? (
          <span>
            <span className="block font-serif text-[2.1rem] leading-none text-ink">{ownTable}</span>
            <span className={MICRO}>yours</span>
          </span>
        ) : null}
      </span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   10 · ENTOURAGE — the roles the couple gave on the guest list
   ══════════════════════════════════════════════════════════════════════════ */

const peopleIn = (g: EntourageGroup): EntouragePerson[] => g.rows.flatMap((r) => r.filter((p): p is EntouragePerson => p !== null));
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

function Portrait({ name, size = 'h-16 w-16', ring = false }: { name: string; size?: string; ring?: boolean }): ReactElement {
  /* A circle with their initials — the portraits the prototype draws need a
     capture tagged to each person, which the platform does not hold yet. */
  return (
    <span
      aria-hidden
      className={`mx-auto grid place-items-center rounded-full bg-gradient-to-br from-terracotta/30 to-terracotta/60 font-serif text-lg text-ink ${size} ${
        ring ? 'shadow-[0_0_0_3px_rgb(var(--color-cream)),0_0_0_4px_rgb(var(--color-terracotta))]' : ''
      }`}
    >
      {initials(name)}
    </span>
  );
}

export function EntourageScene({
  style,
  groups,
  names,
  words,
}: {
  style: PostEventStyleId;
  groups: readonly EntourageGroup[];
  /** The names at the root of the tree — the event's own. */
  names: string;
  words: PeWords;
}): ReactElement {
  const label = say(words, 'label', 'The entourage');
  if (style === 'portrait-grid') {
    /* .pgrid — a circle for each person, three across; the honour pair sit wider. */
    const honour = groups.find((g) => g.key === 'honour');
    const rest = groups.filter((g) => g.key !== 'honour').flatMap((g) => peopleIn(g).map((p) => ({ p, role: g.label })));
    return (
      <div className="py-8">
        <p className={EYEBROW}>{label}</p>
        <h2 className={H2}>{say(words, 'heading', 'The ones who stood with us')}</h2>
        <div className="mt-4 grid grid-cols-3 gap-x-2.5 gap-y-3.5">
          {honour
            ? peopleIn(honour).map((p) => (
                <div key={`h-${p.id ?? p.name}`} className="col-span-3 flex items-center gap-3">
                  <Portrait name={p.name} size="h-24 w-24 mx-0" />
                  <span>
                    <span className="block font-serif text-[1.35rem] leading-tight text-ink">{p.name}</span>
                    <span className={MICRO}>{honour.label}</span>
                  </span>
                </div>
              ))
            : null}
          {rest.slice(0, 24).map(({ p, role }) => (
            <div key={`${role}-${p.id ?? p.name}`} className="text-center">
              <Portrait name={p.name} />
              <span className="mt-1.5 block font-serif text-base leading-tight text-ink">{p.name}</span>
              <span className="font-mono text-xs uppercase tracking-[0.12em] text-ink/60">{role}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (style === 'family-tree') {
    /* .tree — the two of them at the root, then parents, sponsors, the party. */
    const tier = (keys: readonly string[]) =>
      groups.filter((g) => keys.includes(g.key)).flatMap((g) => peopleIn(g).map((p) => ({ p, role: g.label })));
    const tiers = [
      tier(['parents', 'immediate_family']),
      tier(['principal_sponsors', 'secondary_sponsors']),
      tier(['honour', 'bridesmaids_groomsmen', 'bearers', 'flower_girls', 'ceremony', 'nikah']),
    ].filter((t) => t.length > 0);
    return (
      <div className="py-8">
        <p className={EYEBROW}>{label}</p>
        <h2 className={H2}>{say(words, 'heading', 'Family tree')}</h2>
        <div className="mt-5 flex flex-col items-center">
          <Portrait name={names} size="h-20 w-20" ring />
          <span className="mt-1.5 block text-center font-serif text-base text-ink">{names}</span>
          {tiers.map((people, i) => (
            <div key={i} className="flex w-full flex-col items-center">
              <span aria-hidden className="my-2 block h-6 w-px bg-terracotta/60" />
              <span className="flex w-full flex-wrap justify-center gap-x-3 gap-y-3 border-t border-terracotta/60 pt-3">
                {people.slice(0, 12).map(({ p, role }) => (
                  <span key={`${role}-${p.id ?? p.name}`} className="w-[88px] text-center">
                    <Portrait name={p.name} size="h-14 w-14" />
                    <span className="mt-1 block font-serif text-sm leading-tight text-ink">{p.name}</span>
                    <span className="font-mono text-xs uppercase tracking-[0.1em] text-ink/60">{role}</span>
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  /* roll-call · .roll — roles as micro-labels, names in display serif, grouped by whitespace. */
  return (
    <div className="py-8">
      <p className={EYEBROW}>{label}</p>
      <h2 className={H2}>{say(words, 'heading', 'Roll call')}</h2>
      {groups.map((g) => (
        <div key={g.key} className="mt-5">
          <span className={`${MICRO} text-terracotta-700`}>{g.label}</span>
          {g.rows.map((row, i) => (
            <span key={i} className="mt-1 block font-serif text-[1.45rem] leading-tight text-ink">
              {row
                .filter((p): p is EntouragePerson => p !== null)
                .map((p) => p.name)
                .join(' & ')}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   17 · BEFORE & AFTER (auto extra, one style) — the Save the Date's cover
   beside the story's own
   ══════════════════════════════════════════════════════════════════════════ */

export function BeforeAfterScene({
  before,
  after,
  names,
  words,
}: {
  before: string;
  after: string;
  names: string;
  words: PeWords;
}): ReactElement {
  return (
    <div className="py-8">
      <p className={EYEBROW}>{say(words, 'label', 'Before & after')}</p>
      <h2 className={H2}>{say(words, 'heading', 'The invitation, and the day')}</h2>
      <div className="relative mt-4 grid grid-cols-2 gap-2">
        <span className="block h-[230px] overflow-hidden rounded-sm sm:h-[360px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={before} alt={`${names} — the Save the Date`} className="h-full w-full object-cover" loading="lazy" decoding="async" />
        </span>
        <span className="block h-[230px] overflow-hidden rounded-sm sm:h-[360px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={after} alt={`${names} — the story’s cover`} className="h-full w-full object-cover" loading="lazy" decoding="async" />
        </span>
        <span
          aria-hidden
          className="absolute left-1/2 top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-cream font-script text-xl text-terracotta-700 shadow-[0_8px_18px_-10px_rgba(30,34,41,0.6)]"
        >
          &amp;
        </span>
      </div>
      <span className="mt-2 grid grid-cols-2 gap-2">
        <span className={MICRO}>The Save the Date</span>
        <span className={`${MICRO} text-right`}>The day after</span>
      </span>
    </div>
  );
}
