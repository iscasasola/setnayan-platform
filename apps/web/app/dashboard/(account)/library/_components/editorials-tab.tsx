// Editorials tab — the cross-event editorials the signed-in user is part of.
// OWNED events always (draft + published); ATTENDED events only when their
// editorial is published AND the page isn't private (the same visibility as the
// public /[slug] link). Two sections: "Your editorials" + "From weddings you
// attended". Data + gates live in ../_data/editorials.ts.
//
// Reuses (cited): the data-read patterns from
//   · app/[slug]/_components/editorial/data.ts  (loadEditorialData — admin read + hero fallback)
//   · lib/showcase-db.ts                         (loadPublishedShowcases — consent/visibility gate)
// (2026-11-14: unframed photo tiles, design template rule 2).
import Link from 'next/link';
import { ArrowRight, Pencil } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Badge } from '@/app/_components/badge';
import { InfoTip } from '@/app/_components/info-tip';
import { formatEventDate } from '@/lib/events';
import {
  fetchLibraryEditorials,
  type LibraryEditorial,
} from '../_data/editorials';

export async function EditorialsTab({ userId }: { userId: string }) {
  const { owned, attended } = await fetchLibraryEditorials(userId);

  if (owned.length === 0 && attended.length === 0) {
    return (
      <p className="text-sm text-ink/70">
        Your wedding editorial will appear here once you publish it.
      </p>
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
      <div className="mb-3">
        <InfoTip
          label={title}
          labelAs="h2"
          labelClassName="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70"
          align="start"
        >
          {blurb}
        </InfoTip>
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
  //   · OWNED → the per-event editorial editor. Reachable: `owned` here means
  //     member_type='couple' OR an accepted event_moderators row, and
  //     app/dashboard/[eventId]/layout.tsx admits exactly those two.
  //   · ATTENDED → the public /[slug] page, and NOTHING ELSE.
  // For an OWNED + PUBLISHED editorial the primary tile opens the editor; we add
  // a secondary "View page" link so the host can also see the live page.
  //
  // ⛔ NO `?? editorHref` FALLBACK ON THE ATTENDED BRANCH. `attended` is
  // member_type='guest' by construction, and the editor is organiser-only — so
  // the old `publicHref ?? editorHref` sent a guest whose event has no slug
  // into a guaranteed 404. The gate above admits an attended card on
  // visibility != private WITHOUT requiring a slug, so null is reachable by
  // construction (no such row in prod today: the one slug-NULL event is
  // private). A card with nowhere to go renders WITHOUT a link — the same call
  // lib/event-board.eventBoardHref makes when it returns null rather than
  // building `/null`.
  const editorHref = `/dashboard/${item.eventId}/story`;
  const publicHref = item.slug ? `/${item.slug}` : null;
  const primaryHref = item.relation === 'owned' ? editorHref : publicHref;

  // No own colour → the house gold token (never a typed colour code).
  const monogram = (item.monogramColor ?? 'rgb(var(--color-terracotta))').trim();
  const initials = deriveInitials(item.displayName);

  const hero = (
    <div className="relative aspect-[3/2] w-full overflow-hidden bg-cream">
          {item.heroImageUrl ? (
            // Presigned R2 URL — plain <img>, not next/image (the host isn't in
            // the next/image domain allowlist).
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.heroImageUrl}
              alt={`${item.displayName} editorial`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center"
              style={{ backgroundColor: `color-mix(in srgb, ${monogram} 8%, transparent)` }}
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
  );

  return (
    <article className="flex flex-col">
      {primaryHref ? (
        <Link href={primaryHref} className="block overflow-hidden rounded-lg">
          {hero}
        </Link>
      ) : (
        <div className="overflow-hidden rounded-lg">{hero}</div>
      )}

      <div className="flex flex-1 flex-col gap-3 pt-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-ink">
            {item.displayName}
          </h3>
          {item.eventDate ? (
            <p className="mt-0.5 text-xs text-ink/70">
              {formatEventDate(item.eventDate)}
            </p>
          ) : null}
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-2">
          {item.relation === 'owned' ? (
            <>
              <ActionButton tone="brand" icon={<Pencil aria-hidden />} label="Edit editorial" href={editorHref} />
              {publicHref && item.published ? (
                <ActionButton tone="neutral" icon={<ArrowRight aria-hidden />} label="View page" href={publicHref} />
              ) : null}
            </>
          ) : publicHref ? (
            <ActionButton tone="brand" icon={<ArrowRight aria-hidden />} label="View editorial" href={publicHref} />
          ) : (
            <p className="text-xs text-ink/70">
              The organizer hasn’t opened this event’s page yet.
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function StatusChip({ published }: { published: boolean }) {
  // Over a photo — a cream backing so the soft badge reads on any picture.
  return (
    <span className="inline-flex rounded-full bg-cream">
      {published ? <Badge tone="ok">Published</Badge> : <Badge tone="quiet">Draft</Badge>}
    </span>
  );
}

/** Best-effort "M & J"-style initials for the no-photo monogram fallback.
 *  🪤 "and" must match only as its OWN WORD — a substring match split
 *  "amanda & ben" into "am"/"a"/"ben" (owner: "I made A&B Monogram. it showed
 *  A&A"). See lib/monogram.ts's deriveMonogram, which this mirrors. */
function deriveInitials(displayName: string): string {
  const cleaned = displayName.replace(/\s*\([^)]*\)\s*/g, '').trim();
  const parts = cleaned
    .split(/\s*(?:&|\+|\/|\band\b)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]?.charAt(0).toUpperCase() ?? '';
    const b = parts[1]?.charAt(0).toUpperCase() ?? '';
    if (a && b) return `${a} & ${b}`;
  }
  return cleaned.charAt(0).toUpperCase() || 'S';
}
