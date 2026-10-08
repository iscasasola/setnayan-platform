'use client';

/**
 * /admin/hub-music — the list of Event Hub music, and the only place it is
 * uploaded (owner 2026-10-08).
 *
 * The data-list shape: the list · search · ＋ Add as the one creating button ·
 * a row's title opens its sheet · Remove asks first · a failed read says so.
 *
 * ＋ ADD TAKES ONE FILE OR MANY. Each picked file becomes one track, titled from
 * its file name, its mood guessed only when the title starts with a mood's own
 * name. Many files all start unpublished, so they can be listened to first.
 * Files go up ONE AT A TIME and each one answers for itself: a file the server
 * refuses (an .m4a holding Opus, say) is named with its reason and the rest
 * still land.
 *
 * WHY IT DOES ITS OWN PRESIGN + PUT, like its neighbour
 * background-videos-manager.tsx, instead of mounting `<FileUpload>`: that
 * widget sends `file.type` as the content type, and Chrome and Safari call an
 * .m4a `audio/x-m4a` — a name the upload route does not hold — so it would
 * refuse the very files this page exists for. `hubMusicContentTypeFor` settles
 * the name first.
 */

import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { Music, Pause, Play, Plus, Search, Trash2 } from 'lucide-react';

import { Sheet } from '@/app/_components/sheet';
import { InfoTip } from '@/app/_components/info-tip';
import { ConsoleTable } from '@/app/admin/_components/console-table';
import { formatCount } from '@/lib/format-number';
import {
  HUB_MUSIC_ACCEPT,
  HUB_MUSIC_MAX_BYTES,
  HUB_MUSIC_MOODS,
  HUB_MUSIC_NO_MOOD_LABEL,
  HUB_MUSIC_ROOT,
  HUB_MUSIC_TITLE_MAX,
  formatHubMusicLength,
  guessHubMusicMood,
  hubMusicContentTypeFor,
  hubMusicMoodLabel,
  hubMusicTitleFromFileName,
  isHubMusicMood,
  sortHubMusicTracks,
  type HubMusicAdminTrack,
  type HubMusicContentType,
  type HubMusicMood,
} from '@/lib/hub-music';
import { saveHubMusic } from './actions';

const FIELD =
  'h-11 w-full rounded-md border border-ink/20 bg-cream px-3 text-sm text-ink focus:border-ink/50 focus:outline-none';
const LABEL = 'block text-xs font-medium text-ink/70';

type Picked = {
  id: string;
  file: File;
  title: string;
  mood: HubMusicMood | null;
  contentType: HubMusicContentType | null;
  state: 'waiting' | 'sending' | 'added' | 'refused';
  /** Why this file was not added — shown beside its name. */
  problem: string | null;
};

/** What stops a file before it leaves the browser; the server checks the same things again. */
function problemBeforeUpload(file: File, contentType: HubMusicContentType | null): string | null {
  if (!contentType) return 'Not an M4A, MP3 or AAC file.';
  if (file.size > HUB_MUSIC_MAX_BYTES) {
    return `${(file.size / 1024 / 1024).toFixed(1)} MB — a track can be up to 20 MB.`;
  }
  if (file.size === 0) return 'This file is empty.';
  return null;
}

async function presignAndPut(file: File, contentType: HubMusicContentType): Promise<string> {
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bucket: 'media',
      pathPrefix: HUB_MUSIC_ROOT,
      filename: file.name,
      contentType,
      sizeBytes: file.size,
    }),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error || 'The upload could not start. Try again.');
  }
  const { uploadUrl, r2Key } = (await res.json()) as { uploadUrl: string; r2Key: string };
  const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file });
  if (!put.ok) throw new Error('The file did not reach storage. Check your connection and try again.');
  return r2Key;
}

function MoodSelect({
  value,
  onChange,
  disabled,
  label,
  id,
}: {
  value: HubMusicMood | null;
  onChange: (next: HubMusicMood | null) => void;
  disabled?: boolean;
  label: string;
  id?: string;
}) {
  return (
    <select
      id={id}
      aria-label={label}
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(isHubMusicMood(e.target.value) ? e.target.value : null)}
      className={`${FIELD} min-w-[11rem] disabled:opacity-50`}
    >
      <option value="">{HUB_MUSIC_NO_MOOD_LABEL}</option>
      {HUB_MUSIC_MOODS.map((m) => (
        <option key={m.key} value={m.key}>
          {m.label}
        </option>
      ))}
    </select>
  );
}

function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex h-11 items-center disabled:opacity-50"
    >
      <span
        aria-hidden
        className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${
          checked ? 'bg-success-500' : 'bg-ink/20'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-cream shadow-sm transition-transform ${
            checked ? 'translate-x-[1.125rem]' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  );
}

export function HubMusicManager({
  initial,
  readError,
}: {
  /** The tracks — or `null` when the read failed, which is never the same as none. */
  initial: HubMusicAdminTrack[] | null;
  readError: { message?: string } | null;
}) {
  const [tracks, setTracks] = useState<HubMusicAdminTrack[] | null>(initial);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [picked, setPicked] = useState<Picked[] | null>(null);
  const [publishSingle, setPublishSingle] = useState(false);
  const [sending, setSending] = useState(false);
  // A sheet is `position: fixed`, and the admin template's entrance keeps a
  // transform on its wrapper — which would pin the sheet to the page instead of
  // the screen. So it is drawn on the body, once there is a body.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const audioRef = useRef<HTMLAudioElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const editHeadingId = useId();
  const addHeadingId = useId();

  const editing = tracks?.find((t) => t.trackId === editId) ?? null;

  const visible = useMemo(() => {
    if (!tracks) return null;
    const q = query.trim().toLowerCase();
    if (!q) return tracks;
    return tracks.filter(
      (t) => t.title.toLowerCase().includes(q) || hubMusicMoodLabel(t.mood).toLowerCase().includes(q),
    );
  }, [tracks, query]);

  function mark(id: string, on: boolean) {
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function put(track: HubMusicAdminTrack) {
    setTracks((prev) =>
      sortHubMusicTracks([...(prev ?? []).filter((t) => t.trackId !== track.trackId), track]),
    );
  }

  async function change(
    track: HubMusicAdminTrack,
    patch: { title?: string; mood?: HubMusicMood | null; isPublished?: boolean; sortOrder?: number },
  ) {
    setError(null);
    mark(track.trackId, true);
    const res = await saveHubMusic({ op: 'edit', trackId: track.trackId, ...patch });
    mark(track.trackId, false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (res.track) put(res.track);
  }

  async function remove(track: HubMusicAdminTrack) {
    const ok = window.confirm(
      `Remove “${track.title}” from Event Hub music?\n\nCouples can no longer pick it. An Event Hub already playing it keeps it. This cannot be undone.`,
    );
    if (!ok) return;
    setError(null);
    mark(track.trackId, true);
    const res = await saveHubMusic({ op: 'remove', trackId: track.trackId });
    mark(track.trackId, false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (playingId === track.trackId) stop();
    setEditId(null);
    setTracks((prev) => (prev ?? []).filter((t) => t.trackId !== track.trackId));
  }

  function stop() {
    audioRef.current?.pause();
    setPlayingId(null);
  }

  function toggle(track: HubMusicAdminTrack) {
    const audio = audioRef.current;
    if (!audio || !track.previewUrl) return;
    if (playingId === track.trackId) {
      stop();
      return;
    }
    setError(null);
    audio.src = track.previewUrl;
    setPlayingId(track.trackId);
    audio.play().catch(() => {
      setPlayingId(null);
      setError(`This browser could not play “${track.title}”.`);
    });
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    setPublishSingle(false);
    setPicked(
      files.map((file, i) => {
        const title = hubMusicTitleFromFileName(file.name);
        const contentType = hubMusicContentTypeFor(file.name, file.type);
        const problem = problemBeforeUpload(file, contentType);
        return {
          id: `${i}-${file.name}-${file.size}`,
          file,
          title,
          mood: guessHubMusicMood(title),
          contentType,
          state: problem ? 'refused' : 'waiting',
          problem,
        };
      }),
    );
  }

  function setPickedField(id: string, patch: Partial<Picked>) {
    setPicked((prev) => (prev ? prev.map((p) => (p.id === id ? { ...p, ...patch } : p)) : prev));
  }

  async function addAll() {
    if (!picked || sending) return;
    const queue = picked.filter((p) => p.state === 'waiting');
    if (queue.length === 0) return;
    const publish = picked.length === 1 && publishSingle;
    setSending(true);
    setError(null);
    for (const item of queue) {
      setPickedField(item.id, { state: 'sending', problem: null });
      try {
        const key = await presignAndPut(item.file, item.contentType!);
        const res = await saveHubMusic({ op: 'add', key, title: item.title, mood: item.mood, publish });
        if (!res.ok) {
          setPickedField(item.id, { state: 'refused', problem: res.error });
          continue;
        }
        if (res.track) put(res.track);
        setPickedField(item.id, { state: 'added' });
      } catch (err) {
        setPickedField(item.id, {
          state: 'refused',
          problem: err instanceof Error ? err.message : 'This file could not be added.',
        });
      }
    }
    setSending(false);
    // Close only when every file became a track; otherwise the sheet stays,
    // each refused file beside its reason.
    setPicked((prev) => (prev && prev.every((p) => p.state === 'added') ? null : prev));
  }

  const waiting = picked?.filter((p) => p.state === 'waiting').length ?? 0;
  const added = picked?.filter((p) => p.state === 'added').length ?? 0;
  const refused = picked?.filter((p) => p.state === 'refused').length ?? 0;
  const published = tracks?.filter((t) => t.isPublished).length ?? 0;

  return (
    <div data-hub-music="">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <InfoTip label="Event Hub music" labelAs="h2" labelClassName="text-base font-semibold text-ink" align="start">
          Couples pick one of the published tracks in Look › Music. A track needs a mood before it can be
          published. Upload only music Setnayan has the right to offer.
        </InfoTip>
        {tracks ? (
          <p className="font-mono text-xs text-ink/70" data-hub-music-count="">
            {formatCount(tracks.length)} {tracks.length === 1 ? 'track' : 'tracks'} · {formatCount(published)} published
          </p>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mb-3 rounded-md bg-[var(--sn-warning-soft)] px-3 py-2 text-sm text-ink">
          {error}
        </p>
      ) : null}

      {tracks && tracks.length > 0 && visible && visible.length === 0 ? (
        <p className="py-6 text-sm text-ink/70" data-hub-music-no-match="">
          No track matches “{query.trim()}”.
        </p>
      ) : (
        <ConsoleTable
          rows={readError ? null : visible}
          readPermitted
          readError={readError}
          reads="the Event Hub music list"
          label="Event Hub music"
          minWidth="38rem"
          rowKey={(row) => row.trackId}
          empty={{
            Icon: Music,
            title: 'No music yet',
            blurb: 'Press Add and choose one file or many. Couples see a track once it is published.',
          }}
          columns={[
            {
              header: 'Track',
              cell: (row) => (
                <span className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => toggle(row)}
                    disabled={!row.previewUrl}
                    aria-label={playingId === row.trackId ? `Pause ${row.title}` : `Play ${row.title}`}
                    title={row.previewUrl ? undefined : 'No playable address could be made for this file.'}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink/5 text-ink hover:bg-ink/10 disabled:opacity-40"
                  >
                    {playingId === row.trackId ? (
                      <Pause className="h-4 w-4" aria-hidden />
                    ) : (
                      <Play className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditId(row.trackId)}
                    className="min-w-0 text-left font-medium text-ink underline-offset-2 hover:underline"
                  >
                    {row.title}
                  </button>
                </span>
              ),
            },
            {
              header: 'Mood',
              cell: (row) => (
                <MoodSelect
                  value={row.mood}
                  label={`Mood of ${row.title}`}
                  disabled={busy.has(row.trackId)}
                  onChange={(mood) => void change(row, { mood })}
                />
              ),
            },
            {
              header: 'Length',
              mono: true,
              align: 'right',
              cell: (row) => <span className="text-ink/70">{formatHubMusicLength(row.durationSeconds)}</span>,
            },
            {
              header: 'Published',
              cell: (row) => (
                <Switch
                  checked={row.isPublished}
                  label={`${row.title} is published`}
                  disabled={busy.has(row.trackId)}
                  onChange={(next) => void change(row, { isPublished: next })}
                />
              ),
            },
          ]}
        />
      )}

      {/* The tools, under the list where a thumb reaches them. Sticky, so a
          long list never carries them off the screen. */}
      <div
        className="sticky z-10 mt-4 flex items-center gap-2 bg-cream py-2"
        style={{ bottom: 'calc(var(--sn-bottomdock-h, 0px) + 0.5rem)' }}
        data-hub-music-tools=""
      >
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search tracks</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/50" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Title · mood"
            className={`${FIELD} pl-9`}
          />
        </label>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={Boolean(readError)}
          className="button-primary inline-flex shrink-0 items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50"
          data-hub-music-add=""
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={HUB_MUSIC_ACCEPT}
          className="hidden"
          onChange={onPick}
          aria-label="Choose music files"
        />
      </div>

      <audio
        ref={audioRef}
        preload="none"
        onEnded={() => setPlayingId(null)}
        onError={() => {
          if (!playingId) return;
          const title = tracks?.find((t) => t.trackId === playingId)?.title ?? 'this track';
          setPlayingId(null);
          setError(`This browser could not play “${title}”.`);
        }}
      />

      {mounted
        ? createPortal(
            <>
              <Sheet
                open={picked !== null}
                onClose={() => {
                  if (!sending) setPicked(null);
                }}
                labelledById={addHeadingId}
                wide
              >
                {picked ? (
                  <div className="space-y-4 px-5 pb-4 pt-5" data-hub-music-add-sheet="">
                    <h2 id={addHeadingId} className="pr-10 text-base font-semibold text-ink">
                      {picked.length === 1 ? 'Add a track' : `Add ${formatCount(picked.length)} tracks`}
                    </h2>
                    {picked.length > 1 ? (
                      <InfoTip label="They start unpublished" labelClassName="text-sm text-ink/70" align="start">
                        Listen to each one in the list, then switch on the ones couples should see.
                      </InfoTip>
                    ) : null}
                    <ul className="space-y-4">
                      {picked.map((p) => (
                        <li key={p.id} className="space-y-2 border-t border-ink/10 pt-3 first:border-t-0 first:pt-0">
                          <p className="break-all font-mono text-[11px] text-ink/70">{p.file.name}</p>
                          {p.state === 'added' ? (
                            <p className="text-sm text-ink">Added as “{p.title}”.</p>
                          ) : p.state === 'refused' ? (
                            <p role="alert" className="rounded-md bg-[var(--sn-warning-soft)] px-3 py-2 text-sm text-ink">
                              Not added. {p.problem}
                            </p>
                          ) : (
                            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                              <label className={LABEL}>
                                Title
                                <input
                                  type="text"
                                  value={p.title}
                                  maxLength={HUB_MUSIC_TITLE_MAX}
                                  disabled={sending}
                                  onChange={(e) => setPickedField(p.id, { title: e.target.value })}
                                  className={`${FIELD} mt-1`}
                                />
                              </label>
                              <label className={LABEL}>
                                Mood
                                <span className="mt-1 block">
                                  <MoodSelect
                                    value={p.mood}
                                    label={`Mood of ${p.title}`}
                                    disabled={sending}
                                    onChange={(mood) => setPickedField(p.id, { mood })}
                                  />
                                </span>
                              </label>
                              {p.state === 'sending' ? (
                                <p className="text-sm text-ink/70 sm:col-span-2">Uploading and checking the file…</p>
                              ) : null}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                    {picked.length === 1 && picked[0]!.state === 'waiting' ? (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-ink">Published</span>
                        <Switch
                          checked={publishSingle}
                          label="Publish this track"
                          disabled={sending}
                          onChange={setPublishSingle}
                        />
                      </div>
                    ) : null}
                    {added + refused > 0 && !sending ? (
                      <p className="text-sm text-ink/70" data-hub-music-add-result="">
                        {formatCount(added)} added · {formatCount(refused)} not added
                      </p>
                    ) : null}
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setPicked(null)}
                        disabled={sending}
                        className="button-secondary disabled:opacity-50"
                      >
                        {waiting > 0 ? 'Cancel' : 'Close'}
                      </button>
                      {waiting > 0 || sending ? (
                        <button
                          type="button"
                          onClick={() => void addAll()}
                          disabled={sending || waiting === 0 || picked.some((p) => p.state === 'waiting' && !p.title.trim())}
                          className="button-primary disabled:cursor-not-allowed disabled:opacity-50"
                          data-hub-music-add-go=""
                        >
                          {sending
                            ? `Adding… ${formatCount(added + refused)} of ${formatCount(picked.length)}`
                            : waiting === 1
                              ? 'Add 1 track'
                              : `Add ${formatCount(waiting)} tracks`}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </Sheet>

              <Sheet open={editing !== null} onClose={() => setEditId(null)} labelledById={editHeadingId} wide>
                {editing ? (
                  <EditTrack
                    key={editing.trackId}
                    track={editing}
                    headingId={editHeadingId}
                    busy={busy.has(editing.trackId)}
                    error={error}
                    playing={playingId === editing.trackId}
                    onToggle={() => toggle(editing)}
                    onChange={(patch) => void change(editing, patch)}
                    onRemove={() => void remove(editing)}
                  />
                ) : null}
              </Sheet>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}

/** One track's sheet. Each field saves when you leave it; there is no Save button. */
function EditTrack({
  track,
  headingId,
  busy,
  error,
  playing,
  onToggle,
  onChange,
  onRemove,
}: {
  track: HubMusicAdminTrack;
  headingId: string;
  busy: boolean;
  error: string | null;
  playing: boolean;
  onToggle: () => void;
  onChange: (patch: { title?: string; mood?: HubMusicMood | null; isPublished?: boolean; sortOrder?: number }) => void;
  onRemove: () => void;
}) {
  const [title, setTitle] = useState(track.title);
  const [order, setOrder] = useState(String(track.sortOrder));
  const moodId = useId();

  return (
    <div className="space-y-4 px-5 pb-4 pt-5" data-hub-music-edit-sheet="">
      <h2 id={headingId} className="pr-10 text-base font-semibold text-ink">
        {track.title}
      </h2>
      <p className="font-mono text-xs text-ink/70">
        {formatHubMusicLength(track.durationSeconds)} · {(track.fileBytes / 1024 / 1024).toFixed(1)} MB · {track.publicId}
      </p>
      {error ? (
        <p role="alert" className="rounded-md bg-[var(--sn-warning-soft)] px-3 py-2 text-sm text-ink">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onToggle}
        disabled={!track.previewUrl}
        className="button-secondary inline-flex items-center gap-2 disabled:opacity-50"
      >
        {playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
        {playing ? 'Pause' : 'Play'}
      </button>
      <label className={LABEL}>
        Title
        <input
          type="text"
          value={title}
          maxLength={HUB_MUSIC_TITLE_MAX}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            const next = title.replace(/\s+/g, ' ').trim();
            if (!next) {
              setTitle(track.title);
              return;
            }
            if (next !== track.title) onChange({ title: next });
          }}
          className={`${FIELD} mt-1`}
        />
      </label>
      <label className={LABEL} htmlFor={moodId}>
        Mood
      </label>
      <MoodSelect
        id={moodId}
        value={track.mood}
        label="Mood"
        disabled={busy}
        onChange={(mood) => onChange({ mood })}
      />
      <div className="flex items-center justify-between gap-3">
        <InfoTip label="Published" labelClassName="text-sm text-ink" align="start">
          Couples can pick a published track. Switching it off hides it from the list; an Event Hub already
          playing it keeps it.
        </InfoTip>
        <Switch
          checked={track.isPublished}
          label="Published"
          disabled={busy}
          onChange={(next) => onChange({ isPublished: next })}
        />
      </div>
      <label className={LABEL}>
        <InfoTip label="Order in its mood" labelClassName="text-xs font-medium text-ink/70" align="start">
          Lower numbers come first within a mood. Tracks with the same number go by title.
        </InfoTip>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={9999}
          value={order}
          onChange={(e) => setOrder(e.target.value)}
          onBlur={() => {
            const next = Number(order);
            if (!Number.isInteger(next) || next < 0 || next > 9999) {
              setOrder(String(track.sortOrder));
              return;
            }
            if (next !== track.sortOrder) onChange({ sortOrder: next });
          }}
          className={`${FIELD} mt-1 w-28`}
        />
      </label>
      <div className="border-t border-ink/10 pt-4">
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          className="inline-flex h-11 items-center gap-2 rounded-md border border-danger/40 px-4 text-sm font-medium text-danger hover:bg-danger/5 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
          Remove
        </button>
      </div>
    </div>
  );
}
