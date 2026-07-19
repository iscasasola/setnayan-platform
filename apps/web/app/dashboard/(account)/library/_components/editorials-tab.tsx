// Editorials tab — the cross-event editorials the signed-in user is part of.
// OWNED events always (draft + published); ATTENDED events only when their
// editorial is published AND the page isn't private (the same visibility as the
// public /[slug] link). Two sections: "Your editorials" + "From weddings you
// attended". Data + gates live in ../_data/editorials.ts.
//
// Reuses (cited): the data-read patterns from
//   · app/[slug]/_components/editorial/data.ts  (loadEditorialData — admin read + hero fallback)
//   · lib/showcase-db.ts                         (loadPublishedShowcases — consent/visibility gate)
// and the card shell from app/dashboard/[eventId]/galleries/page.tsx
//   (rounded-2xl border border-ink/10 bg-white shadow-sm).
import Link from 'next/link';
import { Newspaper, ArrowRight, Pencil } from 'lucide-react';
import { formatEventDate } from '@/lib/events';
import {
  fetchLibraryEditorials,
  type LibraryEditorial,
} from '../_data/editorials';

export async function EditorialsTab({ userId }: { userId: string }) {
  const { owned, attended } = await fetchLibraryEditorials(userId);

  if (owned.length === 0 && attended.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink/15 p-10 text-center">
        <span className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
          <Newspaper aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <p className="text-sm text-ink/55">
          Your wedding editorial will appear here once you publish it.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {owned.length > 0 ? (
        <Section
          title="Your editorials"
          blurb="The front-page stories for the weddings you host. Open the editor to keep telling the story, or view the published page."
          items={owned}
        />
      ) : null}

      {attended.length > 0 ? (
        <Section
          title="From weddings you attended"
          blurb="Published editorials from couples who invited you — tap through to relive the day."
          items={attended}
        />
      ) : null}
    </div>
  );
}

function Section({
  title,
  blurb,
  items,
}: {
  title: string;
  blurb: string;
  items: LibraryEditorial[];
}) {
  return (
    <section>
      <div className="mb-4 space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
        <p className="max-w-prose text-sm text-ink/55">{blurb}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <EditorialCard key={item.eventId} item={item} />
        ))}
      </div>
    </section>
  );
}

function EditorialCard({ item }: { item: LibraryEditorial }) {
  // Link target:
  //   · OWNED → the per-event editorial editor (always reachable to the host).
  //   · ATTENDED (always published here) → the public /[slug] page.
  // For an OWNED + PUBLISHED editorial the primary tile opens the editor; we add
  // a secondary "View page" link so the host can also see the live page.
  const editorHref = `/dashboard/${item.eventId}/website/editorial`;
  const publicHref = item.slug ? `/${item.slug}` : null;
  const primaryHref =
    item.relation === 'owned' ? editorHref : publicHref ?? editorHref;

  const monogram = (item.monogramColor ?? '#A9834B').trim();
  const initials = deriveInitials(item.displayName);

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm transition-shadow hover:shadow-md">
      <Link href={primaryHref} className="block">
        <div className="relative aspect-[3/2] w-full overflow-hidden bg-cream">
          {item.heroImageUrl ? (
            // Presigned R2 URL — plain <img>, not next/image (the host isn't in
            // the next/image domain allowlist).
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.heroImageUrl}
              alt={`${item.displayName} editorial`}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center"
              style={{ backgroundColor: `${monogram}14` }}
              aria-hidden
            >
              <span
                className="font-sans text-3xl tracking-wide"
                style={{ color: monogram }}
              >
                {initials}
              </span>
            </div>
          )}
          <span className="absolute left-3 top-3">
            <StatusChip published={item.published} />
          </span>
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-ink">
            {item.displayName}
          </h3>
          {item.eventDate ? (
            <p className="mt-0.5 text-xs text-ink/50">
              {formatEventDate(item.eventDate)}
            </p>
          ) : null}
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-2">
          {item.relation === 'owned' ? (
            <>
              <Link
                href={editorHref}
                className="inline-flex items-center gap-1.5 rounded-full bg-terracotta px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-terracotta-600"
              >
                <Pencil aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                Edit editorial
              </Link>
              {publicHref && item.published ? (
                <Link
                  href={publicHref}
                  className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/65 transition-colors hover:bg-ink/5 hover:text-ink"
                >
                  View page
                  <ArrowRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                </Link>
              ) : null}
            </>
          ) : (
            <Link
              href={publicHref ?? editorHref}
              className="inline-flex items-center gap-1.5 rounded-full bg-terracotta px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-terracotta-600"
            >
              View editorial
              <ArrowRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

function StatusChip({ published }: { published: boolean }) {
  return published ? (
    <span className="inline-flex items-center rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-medium text-success-700 shadow-sm">
      Published
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-warn-50 px-2 py-0.5 text-[11px] font-medium text-warn-700 shadow-sm">
      Draft
    </span>
  );
}

/** Best-effort "M & J"-style initials for the no-photo monogram fallback. */
function deriveInitials(displayName: string): string {
  const cleaned = displayName.replace(/\s*\([^)]*\)\s*/g, '').trim();
  const parts = cleaned
    .split(/\s*(?:&|and|\+|\/)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]?.charAt(0).toUpperCase() ?? '';
    const b = parts[1]?.charAt(0).toUpperCase() ?? '';
    if (a && b) return `${a} & ${b}`;
  }
  return cleaned.charAt(0).toUpperCase() || 'S';
}
