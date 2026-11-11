import { redirect } from 'next/navigation';
import { forwardToHome } from '@/lib/home-segments';

/**
 * /dashboard/library — FORWARDS TO HOME › MEMORIES (owner 11 Nov 2026, "One profile page approve", DECISION_LOG "HOME
 * IS THE PROFILE"). Memories is a section of Home; its body moved, unchanged, to `_components/memories-segment.tsx`
 * and is drawn at `/dashboard?seg=memories`. Every parameter comes along — the lenses and kept views
 * (`?tab=albums|challenges|editorials|vendors|…`, `?event=`) open exactly as they did.
 * 🔒 lib/home-is-the-profile.test.ts
 */
export default async function MemoriesForwardsToHome({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  redirect(forwardToHome('memories', await searchParams));
}
