import { redirect } from 'next/navigation';

/**
 * 💬 FORWARDS TO SHOP › PAGE › REVIEWS AND STORIES (owner 2026-11-06, DECISION_LOG "ONE HOME FOR EVERY PROMOTE TOOL":
 * *"Make the pages live there and not jump to another menu."* — Page › Reviews and stories = read + reply to reviews in
 * place). The review card, the one public reply and Flag as fake live in `website/_components/review-replies.tsx`;
 * the actions stay in `./actions.ts`. A bookmark, an old notification or an old link lands there.
 */
export default function VendorReviewsForward() {
  redirect('/vendor-dashboard/website#reviews');
}
