/**
 * story-index.tsx — "The whole story, at once". Eleven honest indexes.
 *
 * `01_The_Story.md` §3.6 · `08` step 2.4 · prototype `story.html` `#all`.
 *
 * A SERVER component. What it draws was decided by `buildStoryIndex`, which was
 * handed a payload `redactStoryLayers` had already emptied of everything this
 * reader may not read — so there is no gate in here, no `if (viewer)`, and no
 * count that could be computed on the fly. A tab that is not this reader's is
 * not in `tabs`, and a chip whose number is not theirs carries `count: null`.
 *
 * 🔑 EVERY ROW CARRIES `data-find-*`, AND THAT IS THE SEARCH'S ENTIRE SOURCE.
 * `find-in-this-day.tsx` scrapes the live document — it has no payload prop and
 * no route to ask. Whatever is not rendered here can never be found, which is
 * how "a stranger cannot search what a stranger cannot read" is enforced by the
 * shape of the code rather than by a filter that could be forgotten.
 *
 * ⚠ IT IS AN INDEX, NOT A SECOND COPY OF THE DAY. Each row points back at the
 * minute that renders it in full further up the page; the shipped sections
 * under the clock are untouched, in the host's own order. Re-rendering their
 * content here would have quietly deleted what a couple switched on, which is
 * the loss S6 exists to prevent.
 */

import { type ReactElement, type ReactNode } from 'react';
import type { FindGroup } from '@/lib/story-find';
import type { IndexEntry, IndexTab, StoryIndexTabKey } from '@/lib/story-index';
import { CapturesByHour, StoryIndexTabs } from './story-index-tabs';

/**
 * Which search group a tab's rows land in.
 *
 * ⚠ NOT EVERY TAB IS SEARCHABLE, AND THE OMISSIONS ARE THE POINT. `room` is
 * table labels, `look` is hex codes, `made` and `numbers` are Setnayan's own
 * furniture — none of them is a thing a reader types a word to find, and
 * feeding "2" into the results as a table would bury the minute at 2:38.
 */
const SEARCH_GROUP: Partial<Record<StoryIndexTabKey, FindGroup>> = {
  captures: 'Captures',
  voices: 'Voices',
  asked: 'Questions',
  letters: 'Letters',
  team: 'The team',
};

export function StoryIndex({
  tabs,
  beforeLabel,
}: {
  tabs: IndexTab[];
  /** The "before the day" hour chip's wording — the caller owns the words. */
  beforeLabel: string;
}): ReactElement | null {
  if (tabs.length === 0) return null;

  return (
    <section id="the-whole-story" className="mx-auto mt-14 max-w-5xl scroll-mt-32 px-4 sm:px-6 min-[1100px]:max-w-6xl">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b-2 border-ink pb-2.5">
        <h2 className="font-condensed text-[clamp(1.9rem,6vw,3.25rem)] font-black uppercase leading-[0.9] tracking-tight">
          The whole story,
          <br />
          at once
        </h2>
        <span className="pb-1 text-right font-mono text-xs font-semibold uppercase tracking-[0.14em] text-ink/60">
          Every layer, gathered ·<br />
          each one linked back to its minute
        </span>
      </div>

      <StoryIndexTabs
        tabs={tabs.map((t) => ({ key: t.key, title: t.title, count: t.count }))}
        panels={tabs.map((t) => ({ key: t.key, node: <Panel tab={t} beforeLabel={beforeLabel} /> }))}
      />
    </section>
  );
}

function Panel({ tab, beforeLabel }: { tab: IndexTab; beforeLabel: string }): ReactElement {
  return (
    <div>
      {tab.entries.length === 0 ? (
        <p className="py-4 font-serif text-lg italic text-ink/60">{tab.empty ?? 'Nothing here.'}</p>
      ) : tab.key === 'captures' ? (
        <CapturesByHour
          beforeLabel={beforeLabel}
          tiles={tab.entries.map((e) => ({
            key: e.key,
            hour: e.hour ?? 'pre',
            node: <CaptureTile entry={e} group={SEARCH_GROUP.captures ?? null} tab={tab.key} />,
          }))}
        />
      ) : tab.key === 'look' ? (
        <ul className="flex flex-wrap gap-2.5">
          {tab.entries.map((e) => (
            <li key={e.key} className="w-24">
              <span
                aria-hidden
                className="block h-14 rounded-md border border-ink/20"
                style={{ background: e.label }}
              />
              <small className="mt-1 block font-mono text-xs uppercase tracking-[0.1em] text-ink/60">
                {e.stamp}
              </small>
            </li>
          ))}
        </ul>
      ) : tab.key === 'numbers' ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {tab.entries.map((e) => (
            <li key={e.key} className="rounded-lg border border-ink/20 p-3.5">
              <b className="block font-condensed text-3xl font-extrabold leading-none tabular-nums">
                {e.stamp}
              </b>
              <span className="mt-1.5 block font-mono text-xs font-semibold uppercase tracking-[0.12em] text-ink/60">
                {e.label}
              </span>
              {e.note ? (
                <em className="mt-1 block text-xs not-italic text-ink/60">{e.note}</em>
              ) : null}
            </li>
          ))}
        </ul>
      ) : tab.key === 'room' ? (
        <ul className="flex flex-wrap gap-2">
          {tab.entries.map((e) => (
            <li
              key={e.key}
              className="inline-flex min-h-[44px] items-center rounded-full border border-ink/25 px-3.5 font-condensed text-base font-bold"
            >
              {e.label}
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid gap-0">
          {tab.entries.map((e) => (
            <Row key={e.key} entry={e} group={SEARCH_GROUP[tab.key] ?? null} tab={tab.key} />
          ))}
        </ul>
      )}

      {tab.note ? (
        <p className="mt-3 max-w-[62ch] text-[12.5px] leading-snug text-ink/60">{tab.note}</p>
      ) : null}
    </div>
  );
}

/**
 * The attributes the search reads. One helper so a new panel shape cannot
 * accidentally ship rows the search is blind to — the failure mode there is a
 * reader typing a word that IS on the page and being told it is not.
 */
function findAttrs(entry: IndexEntry, group: FindGroup | null, tab: StoryIndexTabKey): Record<string, string> {
  if (!group) return {};
  return {
    'data-find': '',
    'data-find-group': group,
    'data-find-stamp': entry.stamp,
    'data-find-label': entry.label,
    ...(entry.note ? { 'data-find-note': entry.note } : {}),
    ...(entry.href ? { 'data-find-target': entry.href.replace(/^#/, '') } : {}),
    'data-find-panel': tab,
    ...(entry.hour ? { 'data-find-hour': entry.hour } : {}),
  };
}

function Row({
  entry,
  group,
  tab,
}: {
  entry: IndexEntry;
  group: FindGroup | null;
  tab: StoryIndexTabKey;
}): ReactElement {
  const body: ReactNode = (
    <>
      <b className="pt-0.5 font-condensed text-sm font-extrabold tabular-nums tracking-wide text-ink/80">
        {entry.stamp}
      </b>
      <span className="min-w-0">
        <span className="block text-[15px] leading-snug">{entry.label}</span>
        {entry.note ? (
          <small className="mt-0.5 block font-mono text-xs uppercase tracking-[0.1em] text-ink/60">
            {entry.note}
          </small>
        ) : null}
      </span>
    </>
  );

  return (
    <li
      {...findAttrs(entry, group, tab)}
      {...(entry.layer === 'guest' ? { 'data-layer': 'guest' } : {})}
      className="border-t border-ink/10 first:border-t-0"
    >
      {entry.href ? (
        <a
          href={entry.href}
          className="grid min-h-[44px] grid-cols-[4.5rem_1fr] items-start gap-2.5 py-2.5 underline-offset-4 hover:bg-ink/5"
        >
          {body}
        </a>
      ) : (
        <div className="grid min-h-[44px] grid-cols-[4.5rem_1fr] items-start gap-2.5 py-2.5">
          {body}
        </div>
      )}
    </li>
  );
}

function CaptureTile({
  entry,
  group,
  tab,
}: {
  entry: IndexEntry;
  group: FindGroup | null;
  tab: StoryIndexTabKey;
}): ReactElement {
  const tile = (
    <span className="relative block aspect-[4/5] overflow-hidden rounded-lg bg-ink/10">
      {entry.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entry.imageUrl}
          alt={entry.label}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : null}
      <span className="absolute left-2 top-2 rounded bg-black/45 px-1.5 py-0.5 font-condensed text-xs font-bold tracking-wide text-white backdrop-blur-sm">
        {entry.stamp}
      </span>
    </span>
  );

  return (
    <figure {...findAttrs(entry, group, tab)} data-layer="guest">
      {entry.href ? (
        <a href={entry.href} className="block">
          {tile}
        </a>
      ) : (
        tile
      )}
    </figure>
  );
}
