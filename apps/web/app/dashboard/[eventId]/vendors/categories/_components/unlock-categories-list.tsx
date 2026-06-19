'use client';

/**
 * UnlockCategoriesList — the interactive body of the Unlock-more-categories
 * page (owner 2026-06-02). Each row = a category the couple has NOT added yet;
 * tapping "Add" runs unlockCategoryWithInquiry → the best-fit vendor is picked
 * AND inquired, the category becomes active on the Vendors page, and the row
 * flips to a confirmation in place (so the couple can keep adding several).
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Check, Loader2 } from 'lucide-react';
import { unlockCategoryWithInquiry } from '../../_actions/unlock-category';

export type UnlockGroup = { groupId: string; label: string; hint: string };
export type UnlockFolder = { folder: string; label: string; groups: UnlockGroup[] };

type DoneState = { vendorName: string | null; inquired: boolean };

export function UnlockCategoriesList({
  eventId,
  folders,
}: {
  eventId: string;
  folders: UnlockFolder[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, DoneState>>({});
  const [errs, setErrs] = useState<Record<string, string>>({});

  function add(groupId: string) {
    if (pending) return;
    setBusyId(groupId);
    setErrs((e) => {
      const next = { ...e };
      delete next[groupId];
      return next;
    });
    startTransition(async () => {
      const res = await unlockCategoryWithInquiry({ eventId, groupId });
      setBusyId(null);
      if (res.status === 'ok') {
        setDone((d) => ({
          ...d,
          [groupId]: { vendorName: res.vendorName, inquired: res.inquired },
        }));
        router.refresh();
      } else if (res.status === 'already_active') {
        setDone((d) => ({ ...d, [groupId]: { vendorName: null, inquired: false } }));
        router.refresh();
      } else if (res.status === 'no_vendor') {
        setErrs((e) => ({
          ...e,
          [groupId]: 'No vendors in this category yet — check back soon.',
        }));
      } else if (res.status === 'not_signed_in' || res.status === 'not_a_member') {
        setErrs((e) => ({ ...e, [groupId]: 'Please sign in again.' }));
      } else {
        setErrs((e) => ({ ...e, [groupId]: 'Could not add that — please try again.' }));
      }
    });
  }

  if (folders.length === 0) {
    return (
      <div className="rounded-2xl border border-ink/10 bg-cream px-5 py-8 text-center">
        <p className="font-serif text-xl text-ink">You&rsquo;ve added every category.</p>
        <p className="mt-1.5 text-sm text-ink/60">
          Your plan already covers the whole wedding.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {folders.map((f) => (
        <section key={f.folder}>
          <h2 className="mb-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/45">
            {f.label}
          </h2>
          <ul className="space-y-2">
            {f.groups.map((g) => {
              const d = done[g.groupId];
              const err = errs[g.groupId];
              const busy = busyId === g.groupId && pending;
              return (
                <li
                  key={g.groupId}
                  className="rounded-xl border border-ink/10 bg-cream px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink">{g.label}</p>
                      <p className="mt-0.5 truncate text-[13px] leading-snug text-ink/55">
                        {g.hint}
                      </p>
                    </div>
                    {d ? (
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success-50 px-3 py-2 text-[13px] font-medium text-success-700">
                        <Check className="h-4 w-4" aria-hidden />
                        Added
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => add(g.groupId)}
                        disabled={busy}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-mulberry px-4 py-2 text-[13px] font-medium text-cream transition hover:bg-mulberry/90 disabled:opacity-60"
                      >
                        {busy ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        ) : (
                          <Plus className="h-4 w-4" aria-hidden />
                        )}
                        {busy ? 'Adding…' : 'Add'}
                      </button>
                    )}
                  </div>
                  {d && (
                    <p className="mt-2 text-[13px] text-ink/60">
                      {d.inquired && d.vendorName
                        ? `We've inquired ${d.vendorName} for you — they're in your plan and your inbox.`
                        : "It's in your plan. Open it on your Services page to inquire."}
                    </p>
                  )}
                  {err && <p className="mt-2 text-[13px] text-danger-600">{err}</p>}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
