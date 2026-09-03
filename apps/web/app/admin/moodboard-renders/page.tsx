import { PageMasthead } from '@/app/_components/page-masthead';
import { createClient } from '@/lib/supabase/server';
import { r2SignedGet, R2_BUCKETS } from '@/lib/r2';
import { RENDER_BUCKET_KEY } from '@/lib/bucket-routing';
import { readAllRendersForAdmin, failureCodeOf } from '@/lib/moodboard-render-gallery';
import { renderFailureCopy } from '@/lib/moodboard-render-failure';
import { renderPartById, WHOLE_LOOK_PART_ID } from '@/lib/moodboard-render-parts';
import { AdminRenderGrid } from './_components/admin-render-grid';

/**
 * ADMIN · All creations — every Mood Board render on the platform (MB8).
 *
 * 🔒 THIS PAGE DELIBERATELY SHOWS RENDERS THE COUPLE HAS NOT CONSENTED TO
 * SHARE, AND THAT IS A LOCKED DECISION — NOT AN OVERSIGHT TO TIGHTEN.
 *
 * Owner, 2026-06-09 and re-affirmed 2026-09-03: admin visibility of every
 * render exists so Setnayan can compile its own content database — a strong
 * render becomes candidate source material for the curated, retintable decor
 * library. Consent governs **publication**, never retention or internal
 * review. A non-consented render is still kept and still visible here; what
 * it cannot be is FEATURED.
 *
 * So the consent state is a BADGE, not a filter. Anyone reading this page
 * later and reaching for a `WHERE consented` clause would be undoing a
 * decision while believing they were fixing a leak — the leak they are
 * imagining is closed one layer down, at the write:
 * `moodboard_set_render_featured` refuses a non-consented render, so the
 * featured set is consent-clean by construction and no read has to remember.
 *
 * ── WHY FAILED RENDERS ARE SHOWN TOO ──────────────────────────────────────
 * They are the operational value of this page. A run of `bad_shape` means the
 * provider's contract moved under us; a run of `http_error` means a key or a
 * quota. Both are invisible from every other surface, and both charge nobody
 * (the credit is refunded in the same transaction that records the failure) —
 * which is exactly why nobody would otherwise notice for weeks.
 */

export const dynamic = 'force-dynamic';

export default async function AdminMoodboardRendersPage() {
  const supabase = await createClient();
  const rows = await readAllRendersForAdmin(supabase, { limit: 200 });

  // `null` is a refused / failed read. It must NOT render as "no creations
  // yet" — an admin shown an empty gallery would conclude the feature is
  // unused, which is the same substitution that told a couple with 180 guests
  // their wedding was empty.
  if (rows === null) {
    return (
      <div className="space-y-4">
        <PageMasthead title="All creations" />
        <div className="rounded-xl border border-danger-700/30 bg-danger-700/5 p-4">
          <p className="text-sm font-semibold text-ink">The creations list could not be read</p>
          <p className="mt-0.5 text-xs text-ink/60">
            This is a failed read, not an empty platform — do not conclude that nobody has
            rendered anything. Reload, and check the admin gate if it persists.
          </p>
        </div>
      </div>
    );
  }

  const items = await Promise.all(
    rows.map(async (r) => ({
      ...r,
      partLabel:
        r.part_id === WHOLE_LOOK_PART_ID
          ? 'The whole look'
          : (renderPartById(r.part_id)?.label ?? r.part_id),
      imageUrl: r.image_key
        ? await r2SignedGet({ bucket: R2_BUCKETS[RENDER_BUCKET_KEY], key: r.image_key, expiresIn: 60 * 60 }).catch(
            () => null,
          )
        : null,
      failureCopy: r.failed_at ? renderFailureCopy(failureCodeOf(r.failure_reason)) : null,
    })),
  );

  const featured = items.filter((i) => i.featured_at).length;
  const failed = items.filter((i) => i.failed_at).length;
  const consentable = items.filter((i) => i.share_consented && i.image_key && !i.failed_at).length;

  return (
    <div className="space-y-4">
      <PageMasthead title="All creations" />
      <p className="text-sm text-ink/60">
        Every Mood Board render on the platform — consented or not.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Creations" value={String(items.length)} />
        <Stat label="Featured" value={String(featured)} />
        <Stat label="Shareable" value={String(consentable)} hint="consented, with an image" />
        <Stat
          label="Failed"
          value={String(failed)}
          hint={failed > 0 ? 'credits were returned' : undefined}
        />
      </div>

      <p className="max-w-prose text-xs text-ink/55">
        Every render is kept and visible here regardless of whether the couple agreed to be
        featured — this feed is how Setnayan builds its own design library (owner decision, locked
        2026-06-09). Consent decides only what may be <strong>shown publicly</strong>: the
        &ldquo;Feature&rdquo; toggle refuses a creation whose couple has not consented, so the
        featured set stays consent-clean without anyone having to remember.
      </p>

      {items.length === 0 ? (
        <p className="text-sm text-ink/55">
          No creations yet. This is a real, answered zero — the list loaded and is empty.
        </p>
      ) : (
        <AdminRenderGrid items={items} />
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-ink/10 bg-white p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">{label}</p>
      <p className="text-xl font-semibold text-ink">{value}</p>
      {hint ? <p className="text-[10px] text-ink/45">{hint}</p> : null}
    </div>
  );
}
