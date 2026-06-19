import { SlidersHorizontal, CheckCircle2, AlertCircle } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { RefinementsEditor, type EditorLeaf, type EditorOption } from './_components/refinements-editor';

export const metadata = { title: 'Refinements · Admin' };
// Reads live admin-managed catalogue data; never prerender (mirrors /admin/settings).
export const dynamic = 'force-dynamic';

/**
 * /admin/refinements — edit the onboarding "what kind of X?" refinement catalogue
 * (owner 2026-06-09). Reads `onboarding_refinements` + `onboarding_refinement_options`
 * (incl. retired rows, so they can be re-activated) and resolves each photo to a
 * display URL (/public paths verbatim; r2:// refs presigned). Admin-gated by the
 * /admin layout; the server actions re-check (defense-in-depth) + RLS gates the write.
 */
type LeafRow = {
  leaf_key: string;
  label_en: string;
  description_en: string | null;
  main_photo: string | null;
  is_dynamic_ceremony: boolean | null;
  sort_order: number;
  status: string;
};
type OptionRow = {
  leaf_key: string;
  option_key: string;
  emoji: string | null;
  label_en: string;
  photo: string | null;
  sort_order: number;
  status: string;
};

async function toDisplay(raw: string | null): Promise<string | null> {
  if (!raw) return null;
  if (raw.startsWith('r2://')) {
    try {
      return await displayUrlForStoredAsset(raw);
    } catch {
      return null;
    }
  }
  return raw; // /public path used verbatim
}

export default async function AdminRefinementsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const admin = createAdminClient();
  const [leavesRes, optsRes] = await Promise.all([
    admin
      .from('onboarding_refinements')
      .select('leaf_key,label_en,description_en,main_photo,is_dynamic_ceremony,sort_order,status')
      .order('sort_order', { ascending: true }),
    admin
      .from('onboarding_refinement_options')
      .select('leaf_key,option_key,emoji,label_en,photo,sort_order,status')
      .order('sort_order', { ascending: true }),
  ]);

  const leafRows = (leavesRes.data as LeafRow[] | null) ?? [];
  const optRows = (optsRes.data as OptionRow[] | null) ?? [];

  // Resolve every distinct photo ref to a display URL once, in parallel.
  const refs = new Set<string>();
  for (const l of leafRows) if (l.main_photo) refs.add(l.main_photo);
  for (const o of optRows) if (o.photo) refs.add(o.photo);
  const urlByRef = new Map(
    await Promise.all([...refs].map(async (r) => [r, await toDisplay(r)] as const)),
  );

  const optionsByLeaf = new Map<string, EditorOption[]>();
  for (const o of optRows) {
    const list = optionsByLeaf.get(o.leaf_key) ?? [];
    list.push({
      optionKey: o.option_key,
      emoji: o.emoji ?? '',
      label: o.label_en,
      status: o.status,
      photoRaw: o.photo,
      photoUrl: o.photo ? urlByRef.get(o.photo) ?? null : null,
    });
    optionsByLeaf.set(o.leaf_key, list);
  }

  // Projectable leaves whose option keys feed projectRefinementsToPrefs — their option
  // set is fixed (add/remove disabled in the editor + the action). Ceremony is dynamic.
  const PROJECTABLE = new Set(['ceremony', 'catering', 'photo_video']);
  const leaves: EditorLeaf[] = leafRows.map((l) => ({
    leafKey: l.leaf_key,
    label: l.label_en,
    description: l.description_en ?? '',
    status: l.status,
    dynamic: l.is_dynamic_ceremony === true,
    isProjectable: PROJECTABLE.has(l.leaf_key),
    mainPhotoRaw: l.main_photo,
    mainPhotoUrl: l.main_photo ? urlByRef.get(l.main_photo) ?? null : null,
    options: optionsByLeaf.get(l.leaf_key) ?? [],
  }));

  const unseeded = leaves.length === 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          <h1 className="text-2xl font-semibold tracking-tight">Refinements</h1>
        </div>
        <p className="text-sm text-ink/60">
          The “what kind of {'{'}service{'}'}?” cards couples see in onboarding — each a main photo,
          a one-line description, and a set of option photos. Edits go live immediately (no deploy).
          Uploaded photos replace the bundled ones; leave a photo empty to keep the current one.
        </p>
      </header>

      {sp.error ? (
        <p role="alert" className="mb-4 inline-flex items-center gap-2 rounded-md border border-red-300/60 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4" strokeWidth={1.75} /> {decodeURIComponent(sp.error)}
        </p>
      ) : null}
      {sp.saved ? (
        <p role="status" className="mb-4 inline-flex items-center gap-2 rounded-md border border-success-300/60 bg-success-50 px-4 py-3 text-sm text-success-800">
          <CheckCircle2 className="h-4 w-4" strokeWidth={1.75} /> {decodeURIComponent(sp.saved)}
        </p>
      ) : null}

      {unseeded ? (
        <p className="rounded-xl border border-ink/10 bg-cream/40 px-5 py-4 text-sm text-ink/60">
          No refinements found in the database. The onboarding is falling back to the built-in
          catalogue. Apply migration <code className="font-mono">20260927000000_onboarding_refinements</code> + its seed to edit them here.
        </p>
      ) : (
        <RefinementsEditor leaves={leaves} />
      )}
    </div>
  );
}
