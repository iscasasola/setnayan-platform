import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { findGuide, guideSteps } from '@/lib/help/guides';
import { helpPlace, helpSignInDoor } from '@/lib/help/help-place';
import { routes } from '@/lib/routes';
import { HelpGuideView } from './guide-view';

/*
  ⚠ NO loading.tsx BESIDE THIS PAGE: it calls notFound() for a guide this help does not have, and a loading boundary
  commits HTTP 200 before the body runs (the soft-404 trap, see app/(shell)/help/loading.tsx — and why these pages sit in the (help-pages) group, outside that folder).
*/

type Props = {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ for?: string; role?: string; refer?: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { key } = await params;
  const guide = findGuide(key);
  return guide
    ? { title: `${guide.title} · Guide`, alternates: { canonical: routes.help.guide(key) } }
    : { title: 'Help', robots: { index: false, follow: true } };
}

/**
 * 📘 A GUIDE — the Guide & Help drawing, screens 4 and 5 (owner "Approved" 21 Nov 2026, re-confirmed 22 Nov; corpus
 * `prototypes/guide_help_2026-11-20/index.html`): ‹ and ⋯ (Report a problem), "Guide · Hosts", the title, "4 steps ·
 * about 2 minutes", the numbered steps with a real app picture, Did this help?, and ONE button at the thumb: Take me
 * there.
 *
 * The steps are the page's own spotlight tour (`lib/help/guides.ts` — no guide words are written twice). The picture is
 * the feature page's real 375 px capture. Take me there opens the page in the event Help was opened from (`?refer=`);
 * with no event there is nothing to open, so the thumb carries no button — never a door to a guess.
 *
 * NOT DRAWN HERE, said plainly: the drawing's Practice inside a step (the practice-frame engine is paused plumbing,
 * DECISION_LOG 2026-11-21 "GUIDES WAIT FOR THE NEW DESIGNS"), and Questions (no store yet; the drawing's honest state:
 * "A guide with no questions shows no Questions part"). "Ask a question" sends the question to a person through
 * Message us, the guide named.
 */
export default async function HelpGuidePage({ params, searchParams }: Props) {
  const [{ key }, search, user] = await Promise.all([params, searchParams, getCurrentUser()]);
  const place = helpPlace(search, Boolean(user && !user.is_anonymous));
  const guide = findGuide(key);
  // A guide belongs to its helps — another account's help (a shop, a guest, signed out) does not list it.
  if (!guide) notFound();
  if (!guide.coverage.includes(place.coverage)) {
    // 🚪 Signed out, an account's guide opens a sign-in door that comes back here (final check A1-081).
    if (place.coverage === 'public' && guide.coverage.some((c) => c === 'user' || c === 'supplier')) {
      redirect(helpSignInDoor(routes.help.guide(key), search));
    }
    notFound();
  }
  if (guideSteps(guide).length === 0) notFound();
  return <HelpGuideView place={place} guide={guide} />;
}
