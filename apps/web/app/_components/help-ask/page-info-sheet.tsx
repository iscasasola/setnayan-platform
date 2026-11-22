'use client';

/**
 * ⓘ — the round and its sheet (Guide & Help drawing, screen 6; the server half that reads the words is
 * `page-info.tsx`). "The ⓘ: 44 px round in the pinned row. Opens a Sheet." — the round wears the pinned row's glass
 * and the ONE house ⓘ mark (InfoTip's, class for class); it opens THE floating surface (`Sheet`), which
 * opens at half on a phone; inside, the drawing's rows in one white card: Show me · Answers · Read the full guide.
 *
 * Show me fires the shipped replay (`SPOTLIGHT_REPLAY_EVENT` with this page's tour key — the same event the account
 * sheet's "Show me around" fires), after the sheet closes. It is drawn only while this page's tour is mounted and can
 * replay (`<html data-spotlight-page="<tour key>">`, set by `spotlight-mount.tsx`) — asked when the sheet opens, so a
 * page whose tour cannot run shows no dead row.
 */
import { useId, useState } from 'react';
import { BookOpen, Play } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { SPOTLIGHT_REPLAY_EVENT } from '@/app/_components/spotlight-mount';
import { HelpRow, HelpRows } from './help-rows';

export type PageInfoAnswer = { slug: string; title: string; href: string };

export function PageInfoSheet({
  name,
  tourKey,
  answers,
  guide,
}: {
  /** The page's name — the sheet's title and the round's accessible name. */
  name: string;
  tourKey: string;
  answers: ReadonlyArray<PageInfoAnswer>;
  guide: { href: string; steps: string } | null;
}) {
  const [open, setOpen] = useState(false);
  const [canShow, setCanShow] = useState(false);
  const headingId = useId();

  const openSheet = () => {
    setCanShow(document.documentElement.getAttribute('data-spotlight-page') === tourKey);
    setOpen(true);
  };
  const showMe = () => {
    setOpen(false);
    window.dispatchEvent(new CustomEvent(SPOTLIGHT_REPLAY_EVENT, { detail: { tourKey } }));
  };

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        aria-haspopup="dialog"
        aria-label={`Help for ${name}`}
        className="sn-press group/info grid h-11 w-11 flex-none place-items-center rounded-full sn-glass-row"
        data-page-info={tourKey}
      >
        {/* The house ⓘ, class for class (`<InfoTip>`'s drawn circle — there-is-one-info-dot), inside this 44-px round of
            the pinned row, which opens the page's ⓘ sheet. */}
        <span
          aria-hidden="true"
          className="sn-press-ring inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-ink/25 text-[10px] font-semibold leading-none text-ink/55 transition-all duration-sn-control ease-sn group-hover/info:border-terracotta group-hover/info:text-terracotta"
        >
          i
        </span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} labelledById={headingId}>
        <div className="px-4 pb-6 pt-1" data-page-info-sheet="">
          <h2 id={headingId} className="text-sn-xl font-semibold text-ink">
            {name}
          </h2>
          {canShow ? (
            <div className="mt-3">
              <HelpRows data="info-tools">
                <HelpRow icon={Play} title="Show me" line="A short tour of this page" onClick={showMe} data="show-me" />
              </HelpRows>
            </div>
          ) : null}
          {answers.length > 0 ? (
            <section aria-label="Answers" className="mt-5">
              <h3 className="px-1 text-sn-xl font-semibold text-ink">Answers</h3>
              <div className="mt-2">
                <HelpRows data="info-answers">
                  {answers.map((a) => (
                    <HelpRow key={a.slug} title={a.title} href={a.href} data={a.slug} />
                  ))}
                </HelpRows>
              </div>
            </section>
          ) : null}
          {guide ? (
            <div className="mt-4">
              <HelpRows data="info-guide">
                <HelpRow icon={BookOpen} title="Read the full guide" line={guide.steps} href={guide.href} data="guide" />
              </HelpRows>
            </div>
          ) : null}
        </div>
      </Sheet>
    </>
  );
}
