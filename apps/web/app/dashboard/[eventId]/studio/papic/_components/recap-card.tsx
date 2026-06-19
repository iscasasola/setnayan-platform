import { Sparkles, Globe, Lock } from 'lucide-react';
import { loadRecapCoupleSummary } from '@/lib/auto-recap';

/**
 * Auto-Recap card on the Papic add-ons page — the entry point into the couple's
 * "living recap" management surface (/studio/papic/recap). Renders once the
 * event has any photos to recap; shows the publish state at a glance.
 */
export async function RecapCard({ eventId }: { eventId: string }) {
  const summary = await loadRecapCoupleSummary(eventId);
  if (summary.privatePhotos === 0 && summary.approvedKwentos === 0) return null;

  const isPublished = summary.status === 'published';

  return (
    <section className="rounded-2xl border border-ink/10 bg-surface p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
          <Sparkles aria-hidden className="h-4.5 w-4.5 text-terracotta" strokeWidth={2} />
          Your Recap
        </h2>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.15em] ${
            isPublished ? 'bg-emerald-100 text-emerald-700' : 'bg-ink/5 text-ink/55'
          }`}
        >
          {isPublished ? (
            <Globe aria-hidden className="h-3 w-3" strokeWidth={2.25} />
          ) : (
            <Lock aria-hidden className="h-3 w-3" strokeWidth={2.25} />
          )}
          {isPublished ? 'Public' : 'Private'}
        </span>
      </div>
      <p className="mt-1 text-sm text-ink/60">
        Your day as a living recap — your love story, your photos, and{' '}
        {summary.approvedKwentos > 0
          ? `${summary.approvedKwentos} ${summary.approvedKwentos === 1 ? 'message' : 'messages'} from your guests`
          : 'the messages your guests leave'}
        . A page you can share, assembled automatically.
      </p>
      <a
        href={`/dashboard/${eventId}/studio/papic/recap`}
        className="mt-4 inline-flex items-center gap-2 rounded-md bg-mulberry px-4 py-2.5 text-sm font-medium text-cream hover:bg-mulberry-600"
      >
        <Sparkles aria-hidden className="h-4 w-4" strokeWidth={2} />
        {isPublished ? 'Manage your recap' : 'See your recap'}
      </a>
    </section>
  );
}
