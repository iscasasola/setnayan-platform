import { AlertTriangle, Images } from 'lucide-react';

import { requireAdmin } from '@/lib/admin/require-admin';
import { humanBytes } from '@/lib/website-media';
import { loadWebsiteMedia } from '@/lib/website-media-server';
import { MediaTable } from './media-table';
import { ClearFolderButton } from './clear-folder-button';

/**
 * Admin · Website media — what is actually stored in the media bucket for the
 * site's own pictures and videos, and which of it nothing points at any more.
 *
 * This is the READ side that the existing media pages lack. Background videos,
 * Hero video and Papic storage are all write-side or database-side; none of them
 * can show a file the database stopped referencing, which is precisely the file
 * that costs money forever. Several upload paths repoint a row without deleting
 * what they replaced, which is why the gap exists.
 *
 * Customer content is NOT visible here by construction — see the allowlist in
 * lib/website-media.ts.
 */

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Website media · Admin' };

export default async function AdminWebsiteMediaPage() {
  // Defense-in-depth: this page reads R2 and the service-role client, so it
  // gates itself rather than trusting the layout.
  await requireAdmin();

  const report = await loadWebsiteMedia();
  const { summary, groups } = report;

  return (
    <div className="px-5 py-8 sm:px-8 max-w-5xl">
      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-wider text-[var(--m-slate,#6a6e76)] mb-1">
          Content
        </div>
        <h1 className="text-2xl font-semibold text-[var(--m-ink,#1b1a17)]">Website media</h1>
        <p className="text-[14px] leading-relaxed text-[var(--m-slate,#4f535b)] mt-2 max-w-2xl">
          The website&rsquo;s own pictures and videos — the homepage clips, the sign-in page, the
          onboarding music, the logo set and the menu icons. Files marked <strong>Left over</strong>{' '}
          are ones nothing on the site points at any more; download a copy, then remove them to free
          up space. Anything we can&rsquo;t check is left alone and can&rsquo;t be deleted here.
          Guests&rsquo; photos, receipts and vendor documents are not shown on this page and cannot
          be touched from it.
        </p>
      </div>

      {!report.configured ? (
        <p className="rounded-lg border border-[var(--m-line,#e6e2da)] bg-[var(--m-cloud,#f8f6f2)] px-4 py-3 text-[14px] text-[var(--m-slate,#4f535b)]">
          Storage isn&rsquo;t connected in this environment, so there is nothing to show. This page
          works on the live site.
        </p>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap gap-x-8 gap-y-3 rounded-lg border border-[var(--m-line,#e6e2da)] bg-[var(--m-cloud,#f8f6f2)] px-4 py-3">
            <Stat
              label={summary.incomplete ? 'Files stored (at least)' : 'Files stored'}
              value={String(summary.fileCount)}
            />
            <Stat
              label={summary.incomplete ? 'Space used (at least)' : 'Space used'}
              value={humanBytes(summary.totalBytes)}
            />
            <Stat
              label="Can be freed"
              value={
                summary.reclaimableCount
                  ? `${humanBytes(summary.reclaimableBytes)} · ${summary.reclaimableCount} files`
                  : 'Nothing'
              }
            />
            {summary.unknownCount ? (
              <Stat label="Couldn’t check" value={`${summary.unknownCount} files`} />
            ) : null}
          </div>

          {summary.incomplete ? (
            <p className="mb-6 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
              <span>
                Part of the storage could not be read in full, so the totals above are a minimum,
                not a measurement. The affected folders are marked below. Nothing has been called
                &ldquo;left over&rdquo; on the basis of a read that failed.
              </span>
            </p>
          ) : null}

          {groups.length === 0 ? (
            <p className="rounded-lg border border-[var(--m-line,#e6e2da)] px-4 py-3 text-[14px] text-[var(--m-slate,#4f535b)]">
              Nothing is stored in any of these folders yet.
            </p>
          ) : (
            <div className="space-y-8">
              {groups.map((g) => (
                <section key={g.prefix}>
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-[16px] font-semibold text-[var(--m-ink,#1b1a17)]">
                      {g.label}
                    </h2>
                    <div className="flex items-center gap-1.5 text-[12px] text-[var(--m-slate,#6a6e76)] tabular-nums">
                      <Images className="h-3.5 w-3.5" aria-hidden />
                      {g.rows.length} files · {humanBytes(g.totalBytes)}
                      {g.counts.unreferenced ? ` · ${g.counts.unreferenced} left over` : ''}
                    </div>
                  </div>

                  <p className="mb-3 text-[13px] leading-relaxed text-[var(--m-slate,#4f535b)] max-w-2xl">
                    {g.blurb}
                  </p>

                  {g.listingError ? (
                    <p className="mb-3 flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-900 max-w-2xl">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
                      <span>
                        This folder could not be read, so what it holds is unknown. ({g.listingError}
                        )
                      </span>
                    </p>
                  ) : null}

                  {g.truncated ? (
                    <p className="mb-3 flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-900 max-w-2xl">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
                      <span>
                        This folder holds more files than are shown — the list stops at 5,000. The
                        count and size for it are a minimum.
                      </span>
                    </p>
                  ) : null}

                  {g.lookupFailure ? (
                    <p className="mb-3 flex gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] leading-relaxed text-slate-700 max-w-2xl">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
                      <span>
                        Every file below is marked <strong>Not sure</strong> and none of them can be
                        removed: {g.lookupFailure}
                      </span>
                    </p>
                  ) : null}

                  {/* Folder-level clear. Renders only when this read proves
                      files are removable AND the read itself completed — the
                      server re-checks both regardless. */}
                  {!g.lookupFailure && !g.listingError && !g.truncated ? (
                    <ClearFolderButton
                      prefix={g.prefix}
                      label={g.label}
                      count={g.counts['unreferenced'] ?? 0}
                    />
                  ) : null}

                  <MediaTable rows={g.rows} listingError={g.listingError ?? null} />
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-[var(--m-slate,#6a6e76)]">
        {label}
      </div>
      <div className="text-[15px] font-semibold text-[var(--m-ink,#1b1a17)] tabular-nums">
        {value}
      </div>
    </div>
  );
}
