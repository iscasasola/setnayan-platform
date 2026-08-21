'use client';

/**
 * add-from-people-sheet.tsx — pick from the people Setnayan already knows,
 * instead of typing a name it has.
 *
 * Owner, 2026-08-21: *"we want them to be able to add people from the people's
 * list as well and not just names."*
 *
 * ── ONE LIST, NOT THREE TABS ──────────────────────────────────────────────
 * The candidates come from three places — another event you organise, your
 * People page, a samahan you are in — and they arrive already merged, sorted
 * and de-duplicated. Tabbing them would make the host answer "where do I know
 * Ana from?" before they can look for Ana, which is the wrong question in the
 * wrong order. The `from` line under each name answers it after the fact.
 *
 * ── SOMEBODY ALREADY ON THE LIST IS SHOWN, NOT HIDDEN ─────────────────────
 * They render greyed with "already here". Hiding them is indistinguishable
 * from not having them, and a host who cannot find their own tita starts
 * typing her in a second time.
 *
 * ── THE ONE-WORD NAME GETS A BOX, NOT A GUESS ─────────────────────────────
 * `guests.last_name` is NOT NULL and some sources store a whole name in one
 * string. Where that string is a single word the row grows a small "Last name"
 * field, and Add stays disabled until it is filled. `person-name-split.ts`
 * refuses to invent the missing half; this is where the product asks for it.
 *
 * Opened by a CustomEvent, same as `quick-add-sheet.tsx` — one sheet, several
 * triggers, no context or portal plumbing between them.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Users } from 'lucide-react';
import { Drawer } from './overlay-primitives';
import { SIDE_LABELS, type GuestSide } from '@/lib/guests';
import {
  addGuestsFromPeople,
  listPeopleYouCanInvite,
} from '../people-add-actions';

const OPEN_EVENT = 'setnayan:add-from-people-open';

export function OpenAddFromPeopleButton({
  label = 'Add from your people',
  className = 'button-secondary',
}: { label?: string; className?: string } = {}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new CustomEvent(OPEN_EVENT))}
    >
      {label}
    </button>
  );
}

type Row = {
  key: string;
  name: string;
  lastName: string;
  from: string;
  source: 'event' | 'people' | 'samahan';
  alreadyHere: boolean;
};

const SIDES: GuestSide[] = ['bride', 'groom', 'both'];

export function AddFromPeopleSheet({
  eventId,
  defaultSide,
  /** Hidden on an event whose sides are not bride/groom — the picker then adds
   *  everybody to the one side the event already uses. */
  showSides = true,
}: {
  eventId: string;
  defaultSide: GuestSide;
  showSides?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [partial, setPartial] = useState(false);
  const [readFailed, setReadFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [lastNames, setLastNames] = useState<Record<string, string>>({});
  const [side, setSide] = useState<GuestSide>(defaultSide);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setError(null);
  }, []);

  useEffect(() => {
    const onOpen = () => {
      setOpen(true);
      setError(null);
      setQuery('');
      setPicked({});
      setSide(defaultSide);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [defaultSide]);

  // Fetched on open, never with the page — see the note on the read action.
  useEffect(() => {
    if (!open || rows !== null || loading) return;
    setLoading(true);
    listPeopleYouCanInvite(eventId)
      .then((res) => {
        setRows(res.people);
        setPartial(res.partial);
      })
      .catch(() => {
        /* A REFUSED READ IS NOT AN EMPTY LIST. Saying "you don't know anybody
           yet" because a query failed is the worst sentence this sheet has. */
        setReadFailed(true);
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, [open, rows, loading, eventId]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = rows ?? [];
    if (!q) return all;
    return all.filter(
      (r) => r.name.toLowerCase().includes(q) || r.from.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const pickedKeys = useMemo(
    () => Object.keys(picked).filter((k) => picked[k]),
    [picked],
  );

  // Add stays shut while a chosen one-word name still has no surname — the
  // server refuses it anyway, and finding that out after pressing Add is worse.
  const missingSurname = useMemo(
    () =>
      pickedKeys.filter((k) => {
        const row = (rows ?? []).find((r) => r.key === k);
        if (!row) return false;
        return !row.lastName && !(lastNames[k] ?? '').trim();
      }),
    [pickedKeys, rows, lastNames],
  );

  const submit = () => {
    if (pickedKeys.length === 0 || missingSurname.length > 0 || pending) return;
    setError(null);
    startTransition(async () => {
      const res = await addGuestsFromPeople(
        eventId,
        pickedKeys.map((k) => ({ key: k, lastName: lastNames[k] })),
        side,
      );
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.failed > 0 && res.firstError) {
        // PARTIAL SUCCESS IS STATED. Closing on a silent partial is how a host
        // ends up adding the missing two a second time.
        setError(
          `Added ${res.added}. ${res.failed} didn’t go on — ${res.firstError}`,
        );
        setPicked({});
        setRows(null);
        router.refresh();
        return;
      }
      close();
      router.refresh();
    });
  };

  if (!open) return null;

  return (
    <Drawer onClose={close} labelledById="add-from-people-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="add-from-people-title" className="text-lg font-extrabold tracking-tight text-ink">
            Add from your people
          </h2>
          <p className="mt-1 text-sm text-ink/60">
            Everyone Setnayan already knows for you — your other events, your
            People page, and your samahan.
          </p>
        </div>
        <button
          type="button"
          onClick={close}
          className="rounded-md px-2 py-1 text-sm text-ink/50 hover:bg-ink/5 hover:text-ink"
        >
          Close
        </button>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Search aria-hidden className="h-4 w-4 shrink-0 text-ink/35" strokeWidth={2} />
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a name…"
          aria-label="Search the people you can add"
          className="input-field w-full"
          autoComplete="off"
        />
      </div>

      {showSides ? (
        <div className="mt-3 flex items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/45">
            Side
          </span>
          {SIDES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              aria-pressed={side === s}
              className={`rounded-full border px-3 py-1 text-sm ${
                side === s
                  ? 'border-mulberry/60 bg-mulberry/10 text-mulberry-700'
                  : 'border-ink/15 text-ink/70 hover:border-ink/30'
              }`}
            >
              {SIDE_LABELS[s]}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-4 space-y-1">
        {loading ? <p className="py-6 text-center text-sm text-ink/55">Looking…</p> : null}

        {!loading && readFailed ? (
          <p className="rounded-lg border-t-[3px] border-mulberry/70 bg-mulberry/5 p-4 text-sm text-ink/75">
            We couldn’t reach your people just now. Nothing is lost — close this
            and try again, or type the name in the add row.
          </p>
        ) : null}

        {!loading && !readFailed && (rows ?? []).length === 0 ? (
          /* NOT AN ERROR AND NOT A FAILURE — it is simply the first event. The
             sentence says what would put names here, so the door is not blank. */
          <p className="py-6 text-center text-sm text-ink/60">
            No one to pick yet. People show up here once you have invited them to
            another of your events, added them on your People page, or joined a
            samahan with them.
          </p>
        ) : null}

        {!loading && (rows ?? []).length > 0 && visible.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink/60">No one matches “{query}”.</p>
        ) : null}

        {visible.map((r) => {
          const isPicked = !!picked[r.key];
          const needsSurname = isPicked && !r.lastName && !(lastNames[r.key] ?? '').trim();
          return (
            <div key={r.key} className="rounded-lg px-1 py-1">
              <label
                className={`flex items-center gap-3 rounded-lg px-2 py-2 ${
                  r.alreadyHere ? 'opacity-50' : 'cursor-pointer hover:bg-ink/[0.04]'
                }`}
              >
                <input
                  type="checkbox"
                  disabled={r.alreadyHere}
                  checked={isPicked}
                  onChange={(e) =>
                    setPicked((p) => ({ ...p, [r.key]: e.target.checked }))
                  }
                  className="h-4 w-4 shrink-0 accent-[var(--sn-mulberry,#C24E25)]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {r.name}
                  </span>
                  <span className="block truncate text-xs text-ink/55">
                    {r.alreadyHere ? 'Already here' : r.from}
                  </span>
                </span>
                {r.source === 'people' ? (
                  <Users aria-hidden className="h-4 w-4 shrink-0 text-ink/30" strokeWidth={1.75} />
                ) : null}
              </label>
              {needsSurname ? (
                <div className="pb-2 pl-9 pr-2">
                  <input
                    value={lastNames[r.key] ?? ''}
                    onChange={(e) =>
                      setLastNames((m) => ({ ...m, [r.key]: e.target.value }))
                    }
                    placeholder="Last name"
                    aria-label={`Last name for ${r.name}`}
                    className="input-field w-full text-sm"
                    autoComplete="off"
                  />
                  <p className="mt-1 text-xs text-ink/50">
                    We only know one name for them, and a guest list needs both.
                  </p>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {partial && !readFailed ? (
        <p className="mt-3 text-xs text-ink/55">
          Part of your people couldn’t be loaded, so this list may be short.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-sm text-mulberry-600">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="text-sm text-ink/55">
          {pickedKeys.length === 0
            ? 'Nobody picked'
            : `${pickedKeys.length} picked`}
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={pickedKeys.length === 0 || missingSurname.length > 0 || pending}
          className="button-primary disabled:opacity-50"
        >
          {pending
            ? 'Adding…'
            : pickedKeys.length > 1
              ? `Add ${pickedKeys.length} guests`
              : 'Add guest'}
        </button>
      </div>
    </Drawer>
  );
}
