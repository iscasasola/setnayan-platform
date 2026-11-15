import { redirect } from 'next/navigation';
import { recapHref } from '../_lib/story-later';

/**
 * GET /[slug]/recap — FOLDED INTO THE STORY (owner 2026-11-13, DECISION_LOG "POST EVENT = A STORY (ONE SCENE PER
 * SCREEN) — SIX CALLS SETTLED" (5)): *"The old Recap page folds into the story: `/{slug}/recap` sends to the story,
 * its Share + Save-the-card buttons move to the story's last screen."*
 *
 * Two recaps existed — this page (the Auto-Recap "living recap") and the Post Event story at `/{slug}`. The story is
 * the one; every old link, QR and shared post that names `/recap` keeps working by landing on it. Its Share
 * (`ShareButtons`) and Save-the-card (`SaveStoryCardButton`) are drawn on the story's last screen, only when the story
 * is set to Everyone (`editorial-content.tsx` `shareScreen`). Who may read the story is the story's own gate
 * (`storyAudienceAdmits`), asked there — never a second answer here.
 */
export default async function RecapPage({ params }: { params: Promise<{ slug: string }> }): Promise<never> {
  const { slug } = await params;
  /* 📖 `?story=later`: before the day the page says the story opens after it (`_lib/story-later.ts`). */
  redirect(recapHref(slug));
}
