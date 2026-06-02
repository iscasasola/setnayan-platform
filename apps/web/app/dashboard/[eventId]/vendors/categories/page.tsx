/**
 * Unlock-more-categories page (owner 2026-06-02).
 *
 * The customer Vendors page (Plan + Budget Accordion) shows ONLY categories the
 * couple has a vendor in — "active = has ≥1 pick". This page lists every
 * category they have NOT added yet; tapping Add picks + inquires the best-fit
 * vendor (unlockCategoryWithInquiry) so the category appears on the Vendors
 * page with at least one inquired vendor. Keeps the Vendors page clean by
 * letting the couple bring categories on-stage only when they're shopping them.
 */

import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PLAN_GROUPS } from '@/lib/wedding-plan-groups';
import {
  WEDDING_FOLDER_ORDER,
  WEDDING_FOLDER_LABEL,
  type WeddingFolder,
} from '@/lib/taxonomy';
import {
  UnlockCategoriesList,
  type UnlockFolder,
} from './_components/unlock-categories-list';

export const metadata = { title: 'Add categories' };

type Props = { params: Promise<{ eventId: string }> };

export default async function UnlockCategoriesPage({ params }: Props) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();

  // Membership gate — events RLS restricts the read to members.
  const { data: ev } = await supabase
    .from('events')
    .select('event_id')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!ev) notFound();

  // Active categories = the canonical service of every non-archived pick.
  const { data: pickRows } = await supabase
    .from('event_vendors')
    .select('category')
    .eq('event_id', eventId)
    .is('archived_at', null);
  const activeCategories = new Set<string>(
    (pickRows ?? [])
      .map((r) => (r as { category: string | null }).category)
      .filter((c): c is string => typeof c === 'string'),
  );

  // A group is active if ANY of its categories has a pick. Inactive +
  // addable (countsTowardLockable !== false) groups are what we offer here.
  const inactive = PLAN_GROUPS.filter(
    (g) =>
      g.countsTowardLockable !== false &&
      !g.categories.some((c) => activeCategories.has(c)),
  );

  const byFolder = new Map<WeddingFolder, typeof inactive>();
  for (const g of inactive) {
    const arr = byFolder.get(g.catalogFolder) ?? [];
    arr.push(g);
    byFolder.set(g.catalogFolder, arr);
  }
  const folders: UnlockFolder[] = WEDDING_FOLDER_ORDER.flatMap((folder) => {
    const groups = byFolder.get(folder) ?? [];
    if (groups.length === 0) return [];
    return [
      {
        folder,
        label: WEDDING_FOLDER_LABEL[folder],
        groups: groups.map((g) => ({
          groupId: g.id,
          label: g.label,
          hint: g.hint,
        })),
      },
    ];
  });

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-5">
      <Link
        href={`/dashboard/${eventId}/vendors`}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink/55 transition hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to your vendors
      </Link>

      <header className="mb-6 mt-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
          Add categories
        </p>
        <h1 className="mt-1.5 font-serif text-3xl text-ink">
          Bring more categories on-stage
        </h1>
        <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-ink/65">
          Pick a category you&rsquo;re ready to shop and we&rsquo;ll line up the
          best-fit vendor for your wedding &mdash; and send them a first inquiry,
          so you start with at least one option in every category you add.
        </p>
      </header>

      <UnlockCategoriesList eventId={eventId} folders={folders} />
    </div>
  );
}
