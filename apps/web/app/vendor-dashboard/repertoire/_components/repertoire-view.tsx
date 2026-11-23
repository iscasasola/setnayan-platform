import Link from 'next/link';
import { BookOpen, Check, Lock, Music, Plus, ShoppingBag } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { routes } from '@/lib/routes';
import type { Song } from '@/lib/songs';
import { formatCount } from '@/lib/format-number';
import { Fold } from '@/app/_components/fold';
import { InfoTip } from '@/app/_components/info-tip';
import { StayForm } from '@/app/_components/stay-form';
import { SubmitButton } from '@/app/_components/submit-button';
import { TemplateRows } from '@/app/_components/template-rows';
import { SERVICE_MAKER_HREF } from '@/lib/service-picker-anchor';
import { SupplierToast } from '../../_components/supplier-toast';
import { ToolChip, ToolEmpty, ToolFail, ToolPage, ToolPin, ToolRow, ToolSection } from '../../_components/tool-page';
import { addRepertoireSong } from '../actions';
import { SetList, type SetListSong } from './set-list';
import { AddOwnSong, RepertoireSearch } from './repertoire-tools';

/**
 * Repertoire — the screen (owner-approved redraw v3, 21 Nov 2026 · `supplier_tools_redraw_v3_fable.html` § 02). Look
 * only: search the library, Add / ✓ Added, curated songs when nothing is typed, Add your own (title required, artist
 * optional), one video link per song, swipe left removes with Undo. On a computer the set list and the library sit
 * side by side, as shipped. Presentational — the page and `/dev/supplier-tools-lab` mount it.
 */
export function RepertoireView({
  repertoire,
  results,
  query,
  own,
  notice,
}: {
  repertoire: SetListSong[];
  results: Song[];
  query: string;
  /** "Add your own" was asked for from the search's ＋. */
  own: boolean;
  notice: { error: string | null; saved: boolean };
}) {
  const repertoireIds = new Set(repertoire.map((s) => s.song_id));
  const ownOpen = own || (query.length > 0 && results.length === 0);
  return (
    <ToolPage name="repertoire">
      <ToolPin
        route="/vendor-dashboard/repertoire"
        title="Repertoire"
        right={`${formatCount(repertoire.length)} ${repertoire.length === 1 ? 'song' : 'songs'}`}
        sub={
          <InfoTip label="The songs you perform." align="start">
            The songs you perform. When a couple&apos;s chosen songs overlap your set list, you rank as a better match for
            their wedding — we promote you, never hide anyone else.
          </InfoTip>
        }
      />
      {notice.error ? <ToolFail data="repertoire" title={notice.error} /> : null}
      {notice.saved ? <SupplierToast tone="ok" text="Repertoire updated." line={false} /> : null}

      <div className="tab:grid tab:grid-cols-2 tab:gap-6">
        <ToolSection label="Your set list" count={repertoire.length} data="repertoire-set-list">
          {repertoire.length === 0 ? (
            <ToolEmpty data="repertoire">Add the songs you perform — search the library or type your own.</ToolEmpty>
          ) : (
            <SetList songs={repertoire} query={query} />
          )}
        </ToolSection>

        <div>
          <ToolSection
            label={query ? `Results for “${query}”` : 'From the song library'}
            count={query ? results.length : undefined}
            tip={query ? undefined : 'Songs couples pick most, until you search. The more complete your set list, the more couples you match.'}
            data="repertoire-library"
          >
            {results.length === 0 ? (
              <ToolEmpty data="repertoire-library">{query ? 'No songs match — add it below.' : 'No songs yet.'}</ToolEmpty>
            ) : (
              <TemplateRows label="Song library">
                {results.map((song) => (
                  <ToolRow
                    key={song.song_id}
                    data={String(song.song_id)}
                    title={song.title}
                    lines={[song.artist]}
                    right={
                      repertoireIds.has(song.song_id) ? (
                        <ToolChip tone="ok">
                          <Check aria-hidden className="h-3 w-3" strokeWidth={2.4} /> Added
                        </ToolChip>
                      ) : (
                        <StayForm door="svRepertoire.addRepertoireSong" action={addRepertoireSong}>
                          <input type="hidden" name="song_id" value={song.song_id} />
                          <input type="hidden" name="q" value={query} />
                          <SubmitButton className="button-secondary inline-flex items-center gap-1 text-sm">
                            <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Add
                          </SubmitButton>
                        </StayForm>
                      )
                    }
                  />
                ))}
              </TemplateRows>
            )}
          </ToolSection>

          {/* Not in the library → add your own (joins the master catalogue). Opens when the search finds nothing, or
              from the search's ＋. */}
          <div id="add-own" className="sn-frame mt-3 scroll-mt-24 px-4 py-1">
            <Fold
              title={query ? `Add “${query}” as your own` : 'Not listed? Add your own'}
              line="Not in the library"
              defaultOpen={ownOpen}
              data="repertoire-add-own"
            >
              <AddOwnSong query={query} size={repertoire.length} />
            </Fold>
          </div>
        </div>
      </div>

      <RepertoireSearch query={query} matches={results.length > 0} />
    </ToolPage>
  );
}

/** A shop with no music service — the shipped door, the drawing's look. */
/** The Song bank's Toolkit page — where it is bought (or shown as part of the plan), with its guide. */
const SONG_BANK_IN_TOOLKIT = routes.vendorDashboard.shop.store.item('tools', 'song_bank');

/**
 * 🔒 Song bank, not open for this shop (owner via the controller, 23 Nov: a paid widget, gated everywhere it opens,
 * like the Cake Maker). Saved songs are kept, never deleted, and come back the moment it opens. Its one door goes to
 * the Toolkit page, which shows the catalog price or "With your plan".
 */
export function RepertoireLocked({ saved }: { saved: number }) {
  return (
    <ToolPage name="repertoire">
      <ToolPin route="/vendor-dashboard/repertoire" title="Repertoire" />
      <div className="sn-frame mt-3 flex flex-col gap-2 p-4" data-song-bank="locked">
        <p className="flex items-center gap-2 text-sn-lg font-bold text-ink">
          <Lock aria-hidden className="h-4 w-4 text-[color:var(--m-slate-2)]" strokeWidth={1.8} /> Song bank
        </p>
        <p className="text-sn-base text-[color:var(--m-slate-2)]">
          The songs you play, with a video of you playing each one, on your shop page — so couples comparing bands see
          what you can do. Get it once in the Toolkit; it is yours to keep.
        </p>
        {saved > 0 ? (
          <p className="text-sn-base text-[color:var(--m-slate-2)]">
            Your {formatCount(saved)} saved {saved === 1 ? 'song is' : 'songs are'} kept as they are.
          </p>
        ) : null}
        <div className="mt-1 flex flex-wrap gap-2">
          <ActionButton tone="brand" main icon={ShoppingBag} label="Get it in the Toolkit" href={SONG_BANK_IN_TOOLKIT} />
          <ActionButton tone="neutral" icon={BookOpen} label="How to use it" href={`${SONG_BANK_IN_TOOLKIT}#guide`} />
        </div>
      </div>
    </ToolPage>
  );
}

/** The Song bank's gate could not be read — say so, with Try again; never a lock by guess, never an open list. */
export function RepertoireUnread() {
  return (
    <ToolPage name="repertoire">
      <ToolPin route="/vendor-dashboard/repertoire" title="Repertoire" />
      <ToolFail title="Couldn’t load your Song bank" line="Nothing was changed." retryHref={routes.vendorDashboard.repertoire()} />
    </ToolPage>
  );
}

export function RepertoireNotMusic() {
  return (
    <ToolPage name="repertoire">
      <ToolPin route="/vendor-dashboard/repertoire" title="Repertoire" />
      <div className="sn-frame mt-3 flex flex-col gap-2 p-4">
        <p className="flex items-center gap-2 text-[16px] font-bold text-ink">
          <Music aria-hidden className="h-[18px] w-[18px] text-[rgb(var(--color-link))]" strokeWidth={1.8} /> Your repertoire
        </p>
        <p className="text-[14px] text-[color:var(--m-slate-2)]">
          This is for music acts — bands, singers, orchestras, choirs, and DJs. Add a music service to your profile and
          your set list will appear here, so couples whose chosen songs you play see you as a better match.
        </p>
        {/* Same dead end as the Shop's Create button: this renders for an act that has NO music service yet, which is
            the state that lands on Coverage with the picker shut. */}
        <Link href={SERVICE_MAKER_HREF} className="button-primary inline-flex w-fit">
          Add a music service
        </Link>
      </div>
    </ToolPage>
  );
}
