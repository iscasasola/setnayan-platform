/**
 * THE BACK COVER — what sits after The End.
 *
 * `01_The_Story.md` §3.9. It renders AFTER the colophon, outside the locked
 * close, so the edition still ends on the host's last word and then their song.
 * Nothing here moves either of them.
 *
 * ⚖ ABSENT, NOT EMPTY. When the host announced nothing this component renders
 * `null` — no dashed placeholder, no "coming soon". A story that ends at the
 * last word is finished (owner, 2026-09-07).
 *
 * ⛔ NEVER A MENU. A reader is shown the one sentence the host chose and nothing
 * else; choosing what comes next happens in the Story Maker.
 */
import Link from 'next/link';
import type { ReactElement } from 'react';

import type { BackCover } from '@/lib/the-back-cover';

export function BackCoverBlock({ cover }: { cover: BackCover | null }): ReactElement | null {
  if (!cover) return null;

  return (
    <aside
      aria-label="What comes next"
      className="mx-auto mt-10 max-w-2xl border-t border-ink/15 px-4 pt-8 text-center"
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-ink/50">
        Previously · No. 1
      </p>

      <h2 className="mt-3 font-display text-2xl italic tracking-tight text-ink sm:text-3xl">
        {cover.title}
      </h2>

      <p className="mt-2 text-sm text-ink/70">{cover.when}</p>
      {cover.sub ? <p className="mt-0.5 text-sm text-ink/55">{cover.sub}</p> : null}

      {/*
        THE DOOR IS PER READER, AND A GUEST HAS NONE.
        `lib/the-back-cover.ts` returns null for a guest on purpose: nothing in
        this product can honour "tell me when there's more" — there is no
        event-follow table and web push has never had a subscriber. A button that
        records nothing is a fake door. The guest reads the sentence; that is the
        whole of what we can honestly offer them today.
      */}
      {cover.door ? (
        <Link
          href={cover.door.href}
          className="mt-5 inline-block rounded-full border border-ink/20 px-5 py-2 text-sm text-ink transition-colors hover:border-ink/40"
        >
          {cover.door.label}
        </Link>
      ) : null}
    </aside>
  );
}
