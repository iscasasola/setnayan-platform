import { LoadingActivity } from '@/components/loading-activity';

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10 sm:px-6">
      {/* Page-shaped skeleton for instant structure; the unified brand loader
          (owner 2026-07-05) fades in over it. */}
      <LoadingActivity />
      <div className="h-40 animate-pulse rounded-3xl bg-ink/5" />
      <div className="mt-4 h-32 animate-pulse rounded-2xl bg-ink/5" />
      <div className="mt-6 h-28 animate-pulse rounded-2xl bg-ink/5" />
    </div>
  );
}
