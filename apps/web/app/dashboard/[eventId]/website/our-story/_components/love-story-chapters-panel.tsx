import {
  FREE_MOMENT_CAP,
  LOVE_STORY_CHAPTER_LABEL,
  formatMomentDate,
  groupByChapter,
  mayAddMoment,
  resolveMoments,
} from '@/lib/love-story-moments';
import { StoryChapterFields, type LoveStoryBlob } from './story-fields';
import { ChapterMoments } from './chapter-moments';
import { PanelFollowsThePage } from './panel-follows-the-page';

/**
 * THE MAKER'S LOVE STORY PANEL — THE PAGE'S FIVE CHAPTERS (owner 2026-09-27,
 * looking at Maker → Love Story: *"align this to what I see on the editing
 * part"*).
 *
 * The page beside it is the scrapbook: moments grouped into Before us · How we
 * met · Falling · The yes · Toward the day (`groupByChapter`, the one grouping
 * the book and the guest page use). This panel lists the SAME chapters, in the
 * SAME order, with the SAME names, and under each: that chapter's moments (a
 * tap opens it on the page), the chapter's own "Add a moment", and the
 * questions that belong to it (`StoryChapterFields`).
 *
 * Rendered INSIDE the words form (`StoryPanel`) — the questions post to
 * `updateOurStory` exactly as before, every field name unchanged, still drafted.
 * The moment buttons are `type="button"` and only ask the page to open its own
 * sheet (`chapter-moments.tsx`).
 */
export function LoveStoryChaptersPanel({
  story,
  ownsPro,
}: {
  story: LoveStoryBlob;
  /** The ACTIVE Pro gate, as the page and the action read it. */
  ownsPro: boolean;
}) {
  const moments = resolveMoments(story);
  const chapters = groupByChapter(moments);
  const canAdd = mayAddMoment(moments.length, ownsPro);
  const capLine = `${FREE_MOMENT_CAP} of ${FREE_MOMENT_CAP} free stories told`;

  return (
    <div className="space-y-5" data-love-story-panel="">
      <PanelFollowsThePage />
      {chapters.map(({ chapter, moments: inChapter }) => (
        <section
          key={chapter}
          data-love-story-panel-chapter={chapter}
          aria-label={LOVE_STORY_CHAPTER_LABEL[chapter]}
          className="space-y-3"
        >
          <header className="flex items-baseline justify-between gap-2">
            <h3 className="font-serif text-[17px] text-ink">{LOVE_STORY_CHAPTER_LABEL[chapter]}</h3>
            <span className="text-[12px] text-ink/60">
              {inChapter.length} {inChapter.length === 1 ? 'moment' : 'moments'}
            </span>
          </header>
          <ChapterMoments
            chapter={chapter}
            moments={inChapter.map((m) => ({
              id: m.id,
              when: formatMomentDate(m.date),
              line: m.line,
              hidden: m.hidden === true,
            }))}
            canAdd={canAdd}
            capLine={capLine}
          />
          <StoryChapterFields story={story} chapter={chapter} />
        </section>
      ))}
    </div>
  );
}
