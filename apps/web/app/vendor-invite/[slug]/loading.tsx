import { LoadingActivity } from '@/components/loading-activity';

export default function VendorInviteLoading() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10 sm:px-6">
      {/* Page-shaped skeleton for instant structure; the unified brand loader
          (owner 2026-07-05) fades in over it. */}
      <LoadingActivity />
      <div className="rounded-3xl border border-ink/10 bg-cream p-6">
        <div className="mx-auto h-20 w-20 animate-pulse rounded-2xl bg-ink/10" />
        <div className="mx-auto mt-4 h-3 w-32 animate-pulse rounded bg-ink/10" />
        <div className="mx-auto mt-2 h-6 w-48 animate-pulse rounded bg-ink/10" />
      </div>
      <div className="mt-6 h-40 animate-pulse rounded-2xl bg-ink/5" />
    </div>
  );
}
