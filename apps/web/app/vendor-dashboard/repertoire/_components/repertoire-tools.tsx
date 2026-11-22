'use client';

/**
 * Repertoire — the pieces that type (owner-approved redraw v3, 21 Nov 2026 · `supplier_tools_redraw_v3_fable.html`
 * § 02). Look only — the same actions, fields and words:
 *   · `RepertoireSearch` — the separate Search button is gone: search is the thumb row's round icon until tapped
 *     (the house `ThumbRow` field), Enter searches the library (`?q=`, as the GET form did); with no match the
 *     magnifier turns ＋ and "Add your own" opens on the page with the words already in it.
 *   · `AddOwnSong` — "Not listed? Add your own": title required, artist optional, the same `addRepertoireSong` (the
 *     song still joins the master catalogue).
 *   · `SongLinkForm` — one video link per song, opened in place under the song; an empty link clears it.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Save } from 'lucide-react';
import { ThumbRow } from '@/components/thumb-row';
import { TypedRow } from '@/app/_components/form-row';
import { StayForm } from '@/app/_components/stay-form';
import { SubmitButton } from '@/app/_components/submit-button';
import { SupplierThumbRow } from '../../_components/supplier-thumb-row';
import { addRepertoireSong, setPerformanceLink } from '../actions';

const HERE = '/vendor-dashboard/repertoire';
/** The "Add your own" section's anchor (a URL fragment, not a colour). */
const ADD_OWN_ANCHOR = 'add-own';

export function RepertoireSearch({ query, matches }: { query: string; matches: boolean }) {
  const router = useRouter();
  const go = (q: string, own = false) => {
    const p = new URLSearchParams();
    if (q.trim()) p.set('q', q.trim());
    if (own) p.set('own', '1');
    const s = p.toString();
    router.push(s ? `${HERE}?${s}#${ADD_OWN_ANCHOR}` : HERE);
  };
  return (
    <SupplierThumbRow
      name="repertoire"
      label="Repertoire actions"
      row={
        <ThumbRow
          name="repertoire"
          field={{
            placeholder: 'Search the song library',
            label: 'Search the song library',
            input: {
              defaultValue: query,
              enterKeyHint: 'search',
              onKeyDown: (e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  go(e.currentTarget.value);
                }
              },
              'data-repertoire-search': '',
            },
            onClear: () => go(''),
            onAdd: (typed: string) => go(typed, true),
            query,
            matches,
          }}
        />
      }
    />
  );
}

export function AddOwnSong({ query, size }: { query: string; size: number }) {
  const [title, setTitle] = useState(query);
  const [artist, setArtist] = useState('');
  return (
    // Keyed on the set list's size by the page: a song that lands re-draws the list in place and starts this form empty.
    <StayForm key={`add-own-${size}`} door="svRepertoire.addRepertoireSong" action={addRepertoireSong} className="flex flex-col gap-2.5 pb-3">
      <input type="hidden" name="q" value={query} />
      <TypedRow name="Song title" value={title} empty="Song title" required maxLength={200} fieldName="title" onType={setTitle} onKeep={(t) => setTitle(t)} data="repertoire-own-title" />
      <TypedRow name="Artist (optional)" value={artist} empty="Artist" maxLength={200} fieldName="artist" onType={setArtist} onKeep={(t) => setArtist(t)} data="repertoire-own-artist" />
      <div>
        <SubmitButton className="button-primary inline-flex items-center gap-1.5">
          <Plus aria-hidden className="h-4 w-4" strokeWidth={2} /> Add to my set list
        </SubmitButton>
      </div>
    </StayForm>
  );
}

/*
  Owner 2026-08-18: a band picks what it can play AND links a video of itself playing it. Saying "I can play this" and
  not being able to show it leaves a couple choosing between three bands who all claim the same song with nothing to
  compare. Empty clears it — taking a video down must be as easy as putting one up.
*/
export function SongLinkForm({ song, query }: { song: { song_id: number; title: string; performance_url: string | null }; query: string }) {
  const [link, setLink] = useState(song.performance_url ?? '');
  return (
    <StayForm door="svRepertoire.setPerformanceLink" action={setPerformanceLink} className="flex flex-col gap-2 pb-3">
      <input type="hidden" name="song_id" value={song.song_id} />
      <input type="hidden" name="q" value={query} />
      <TypedRow
        name={`Video of you performing ${song.title}`}
        value={link}
        empty="Link a video of you playing it (optional)"
        inputMode="url"
        boxed
        maxLength={500}
        fieldName="performance_url"
        onType={setLink}
        onKeep={(t) => setLink(t)}
        data="repertoire-video"
      />
      <p className="text-[14px] text-[color:var(--m-slate-2)]">Leave it empty to take the video down.</p>
      <div>
        <SubmitButton overlay={false} className="button-secondary inline-flex items-center gap-1.5 text-sm">
          <Save aria-hidden className="h-4 w-4" strokeWidth={1.8} /> Save
        </SubmitButton>
      </div>
    </StayForm>
  );
}
