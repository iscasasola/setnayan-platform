'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Plus, X } from 'lucide-react';
import {
  ROLE_LABELS,
  SIDE_LABELS,
  type GuestRole,
  type GuestSide,
} from '@/lib/guests';
import { quickAddGuest } from '../quick-add-actions';

/* ------------------------------------------------------------------ */
/* Cross-component opener — one sheet, two triggers (desktop header    */
/* button + mobile FAB). A CustomEvent avoids context/portal plumbing. */
/* ------------------------------------------------------------------ */
const OPEN_EVENT = 'setnayan:quick-add-open';

export function OpenQuickAddButton() {
  return (
    <button
      type="button"
      className="button-primary"
      onClick={() => window.dispatchEvent(new CustomEvent(OPEN_EVENT))}
    >
      + Add guest
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Duplicate detection — nickname + typo fuzzy match. Both first AND   */
/* last must match so distinct same-first-name guests don't false-fire.*/
/* ------------------------------------------------------------------ */
const NICKMAP: Record<string, string> = {
  // Western
  mike: 'michael', mick: 'michael', mikey: 'michael',
  bob: 'robert', rob: 'robert', bobby: 'robert',
  bill: 'william', will: 'william', billy: 'william',
  liz: 'elizabeth', beth: 'elizabeth', eliza: 'elizabeth',
  jim: 'james', jimmy: 'james',
  tom: 'thomas', tommy: 'thomas',
  dick: 'richard', rick: 'richard', rich: 'richard',
  dave: 'david',
  chris: 'christopher',
  alex: 'alexander', sandy: 'alexander',
  kate: 'katherine', kathy: 'katherine', katie: 'katherine',
  meg: 'margaret', maggie: 'margaret', peggy: 'margaret',
  // PH
  kiko: 'francisco', paco: 'francisco', pancho: 'francisco',
  pepe: 'jose', josê: 'jose',
  manny: 'emmanuel', noy: 'emmanuel',
  totoy: 'agustin',
  inday: 'maria',
  ising: 'luisa',
  nene: 'irene',
  boy: 'benjamin', ben: 'benjamin',
  jun: 'junior',
};

const norm = (s: string) => (s || '').trim().toLowerCase().replace(/[^a-z]/g, '');
const canonFirst = (s: string) => {
  const n = norm(s);
  return NICKMAP[n] ?? n;
};
function lev(a: string, b: string): number {
  a = norm(a);
  b = norm(b);
  const m = a.length,
    n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur: number[] = [i];
    for (let j = 1; j <= n; j++) {
      const del = (prev[j] ?? 0) + 1;
      const ins = (cur[j - 1] ?? 0) + 1;
      const sub = (prev[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1);
      cur[j] = Math.min(del, ins, sub);
    }
    prev = cur;
  }
  return prev[n] ?? 0;
}
const lenTol = (s: string) => {
  const L = norm(s).length;
  return L <= 4 ? 1 : L <= 7 ? 2 : 3;
};
type MatchKind = 'exact' | 'nick' | 'typo' | false;
function nameMatch(a: string, b: string, allowNick: boolean): MatchKind {
  const na = norm(a),
    nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return 'exact';
  if (allowNick && canonFirst(a) === canonFirst(b)) return 'nick';
  if (lev(a, b) <= Math.min(lenTol(a), lenTol(b))) return 'typo';
  return false;
}

export type ExistingGuest = {
  first_name: string;
  last_name: string;
  side: GuestSide;
  role: GuestRole;
};

type Dup = { g: ExistingGuest; kind: 'exact' | 'nick' | 'typo' };

function findDuplicates(fn: string, ln: string, pool: ExistingGuest[]): Dup[] {
  if (norm(fn).length < 2 || norm(ln).length < 2) return [];
  const ord: Record<Dup['kind'], number> = { exact: 0, nick: 1, typo: 2 };
  const out: Dup[] = [];
  for (const g of pool) {
    const f = nameMatch(fn, g.first_name, true);
    const l = nameMatch(ln, g.last_name, false);
    if (f && l) {
      const kind: Dup['kind'] =
        f === 'exact' && l === 'exact'
          ? 'exact'
          : f === 'nick' || l === 'nick'
            ? 'nick'
            : 'typo';
      out.push({ g, kind });
    }
  }
  return out.sort((a, b) => ord[a.kind] - ord[b.kind]).slice(0, 3);
}

const TAG: Record<Dup['kind'], string> = {
  exact: 'Already added',
  nick: 'Same person?',
  typo: 'Typo?',
};

/* role dropdown order — mirrors new/actions.ts ROLE_VALUES */
const ROLE_OPTS: GuestRole[] = [
  'guest',
  'bride',
  'groom',
  'bride_parents',
  'groom_parents',
  'bride_immediate_family',
  'groom_immediate_family',
  'maid_of_honor',
  'matron_of_honor',
  'best_man',
  'bridesmaid',
  'groomsman',
  'principal_sponsor',
  'candle_sponsor',
  'veil_sponsor',
  'cord_sponsor',
  'coin_sponsor',
  'ring_bearer',
  'bible_bearer',
  'coin_bearer',
  'flower_girl',
  'officiant',
  'reader_lector',
  'soloist_musician',
];

const SIDES: { value: GuestSide; label: string; dot: string; on: string }[] = [
  { value: 'bride', label: 'Team Bride', dot: 'bg-rose-500', on: 'border-rose-500 bg-rose-600 text-white' },
  { value: 'groom', label: 'Team Groom', dot: 'bg-sky-500', on: 'border-sky-600 bg-sky-700 text-white' },
  { value: 'both', label: 'Both', dot: 'bg-violet-500', on: 'border-violet-500 bg-violet-600 text-white' },
];

type GroupOpt = { group_id: string; label: string };

export function QuickAddSheet({
  eventId,
  existingGuests,
  groups,
}: {
  eventId: string;
  existingGuests: ExistingGuest[];
  groups: GroupOpt[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<GuestSide>('bride');
  const [role, setRole] = useState<GuestRole>('guest');
  const [groupId, setGroupId] = useState<string>('');
  const [fn, setFn] = useState('');
  const [ln, setLn] = useState('');
  const [dupDismissed, setDupDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guests added during this session, so back-to-back adds dedupe
  // against names that aren't in the server snapshot yet.
  const [addedLocal, setAddedLocal] = useState<ExistingGuest[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fnRef = useRef<HTMLInputElement>(null);
  const lnRef = useRef<HTMLInputElement>(null);
  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Merge the server snapshot with this session's just-added guests
  // (router.refresh() is async, so addedLocal covers the gap), deduped
  // by normalized name so the same guest never shows twice in a warning.
  const pool = useMemo(() => {
    const seen = new Set<string>();
    const merged: ExistingGuest[] = [];
    for (const g of [...existingGuests, ...addedLocal]) {
      const key = `${norm(g.first_name)}|${norm(g.last_name)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(g);
    }
    return merged;
  }, [existingGuests, addedLocal]);
  const dups = useMemo(
    () => (dupDismissed ? [] : findDuplicates(fn, ln, pool)),
    [fn, ln, pool, dupDismissed],
  );
  const dupActive = dups.length > 0;
  const hasBoth = norm(fn).length >= 1 && norm(ln).length >= 1;

  /* open via the desktop button + body scroll lock */
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => fnRef.current?.focus(), 80);
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onEsc);
    return () => {
      document.body.style.overflow = '';
      clearTimeout(t);
      window.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastT.current) clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(null), 1800);
  }, []);

  const clearNames = useCallback(() => {
    setFn('');
    setLn('');
    setDupDismissed(false);
    setError(null);
  }, []);

  const skipDuplicate = useCallback(() => {
    clearNames();
    showToast('Skipped — already on your list');
    fnRef.current?.focus();
  }, [clearNames, showToast]);

  const doSave = useCallback(
    (keepOpen: boolean) => {
      const f = fn.trim(),
        l = ln.trim();
      if (!f && !l) {
        if (keepOpen) fnRef.current?.focus();
        else setOpen(false);
        return;
      }
      setError(null);
      startTransition(async () => {
        const res = await quickAddGuest(eventId, {
          first_name: f,
          last_name: l,
          side,
          role,
          group_id: groupId || null,
        });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        // dedupe back-to-back rapid adds against the just-saved name
        setAddedLocal((prev) => [...prev, res.guest]);
        clearNames();
        router.refresh();
        if (keepOpen) {
          showToast(`${res.guest.first_name} added`);
          setTimeout(() => fnRef.current?.focus(), 0);
        } else {
          setOpen(false);
        }
      });
    },
    [fn, ln, side, role, groupId, eventId, clearNames, router, showToast],
  );

  const forceAdd = useCallback(
    (keepOpen: boolean) => {
      setDupDismissed(true);
      // defer to next tick so dupActive recomputes; doSave doesn't read it
      doSave(keepOpen);
    },
    [doSave],
  );

  /* primary action (bottom button / Enter): skip when a dup is up */
  const primary = useCallback(
    (keepOpen: boolean) => {
      if (dupActive) skipDuplicate();
      else doSave(keepOpen);
    },
    [dupActive, skipDuplicate, doSave],
  );

  const primaryLabel = dupActive
    ? 'Skip — already added'
    : hasBoth
      ? 'Add guest'
      : 'Done';

  return (
    <>
      {/* mobile FAB trigger */}
      <button
        type="button"
        aria-label="Add guest"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-mulberry text-cream shadow-lg shadow-mulberry/30 hover:bg-mulberry-600 sm:hidden"
      >
        <Plus aria-hidden className="h-6 w-6" strokeWidth={2} />
      </button>

      {open ? (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/40"
          />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[92vh] flex-col rounded-t-2xl bg-cream shadow-2xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[86vh] sm:w-[440px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
            {/* header */}
            <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
              <h2 className="text-lg font-semibold text-ink">Quick add guest</h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="text-ink/50 hover:text-ink"
              >
                <X aria-hidden className="h-5 w-5" strokeWidth={1.75} />
              </button>
            </div>

            {/* body */}
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
              <p className="rounded-lg bg-terracotta/10 px-3 py-2 text-xs leading-relaxed text-ink/70">
                Set the team, role{groups.length > 0 ? ' & group' : ''} once — every
                name you add keeps them. Change the chips to start a new batch.
              </p>

              {/* side */}
              <div className="space-y-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
                  Side · team
                </p>
                <div className="flex flex-wrap gap-2">
                  {SIDES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setSide(s.value)}
                      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                        side === s.value ? s.on : 'border-ink/15 text-ink/70 hover:border-ink/30'
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* role */}
              <div className="space-y-2">
                <label
                  htmlFor="qa-role"
                  className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50"
                >
                  Role in the wedding
                </label>
                <select
                  id="qa-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as GuestRole)}
                  className="input-field w-full appearance-none bg-cream pr-8"
                >
                  {ROLE_OPTS.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>

              {/* group (only when the host already has custom groups) */}
              {groups.length > 0 ? (
                <div className="space-y-2">
                  <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
                    Group <span className="ml-1 normal-case text-ink/35">optional</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setGroupId('')}
                      className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                        groupId === '' ? 'border-ink bg-ink text-cream' : 'border-ink/15 text-ink/70 hover:border-ink/30'
                      }`}
                    >
                      None
                    </button>
                    {groups.map((g) => (
                      <button
                        key={g.group_id}
                        type="button"
                        onClick={() => setGroupId(g.group_id)}
                        className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                          groupId === g.group_id ? 'border-ink bg-ink text-cream' : 'border-ink/15 text-ink/70 hover:border-ink/30'
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* names */}
              <div className="space-y-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
                  Name{' '}
                  <span className="ml-1 normal-case text-ink/35">
                    ↵ jumps to last name · ↵ again saves &amp; starts the next
                  </span>
                </p>
                <input
                  ref={fnRef}
                  value={fn}
                  onChange={(e) => {
                    setFn(e.target.value);
                    setDupDismissed(false);
                    setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      lnRef.current?.focus();
                    }
                  }}
                  placeholder="First name"
                  autoComplete="off"
                  enterKeyHint="next"
                  className="input-field w-full"
                />
                <input
                  ref={lnRef}
                  value={ln}
                  onChange={(e) => {
                    setLn(e.target.value);
                    setDupDismissed(false);
                    setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      primary(true);
                    }
                  }}
                  placeholder="Last name"
                  autoComplete="off"
                  enterKeyHint="done"
                  className="input-field w-full"
                />

                {dupActive ? (
                  <div className="space-y-2 rounded-xl border border-amber-300/70 bg-amber-50 p-3">
                    <p className="flex items-center gap-2 text-sm font-semibold leading-tight text-amber-800">
                      <AlertTriangle aria-hidden className="h-4 w-4 flex-none" strokeWidth={1.9} />
                      You may have already added {dups.length > 1 ? 'these guests' : 'this guest'}
                    </p>
                    {dups.map(({ g, kind }, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 rounded-lg border border-ink/10 bg-cream px-2.5 py-2"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">
                            {g.first_name} {g.last_name}
                          </span>
                          <span className="block truncate text-[11px] text-ink/55">
                            {ROLE_LABELS[g.role]} · {SIDE_LABELS[g.side]}
                          </span>
                        </span>
                        <span
                          className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            kind === 'exact'
                              ? 'bg-rose-100 text-rose-700'
                              : kind === 'nick'
                                ? 'bg-violet-100 text-violet-700'
                                : 'bg-amber-200/70 text-amber-800'
                          }`}
                        >
                          {TAG[kind]}
                        </span>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => forceAdd(true)}
                      disabled={isPending}
                      className="mt-1 w-full rounded-lg border border-ink/15 bg-cream py-2 text-sm font-medium text-ink/70 hover:border-ink/30"
                    >
                      ＋ No — add as a different person
                    </button>
                  </div>
                ) : null}

                {error ? (
                  <p role="alert" className="text-sm text-rose-700">
                    {error}
                  </p>
                ) : null}
              </div>
            </div>

            {/* footer */}
            <div className="flex items-center gap-3 border-t border-ink/10 px-5 py-4">
              <button
                type="button"
                onClick={() => primary(true)}
                disabled={isPending}
                className="text-sm font-semibold text-mulberry hover:text-mulberry-600 disabled:opacity-50"
              >
                + Save &amp; add another
              </button>
              <button
                type="button"
                onClick={() => primary(false)}
                disabled={isPending}
                className={`ml-auto rounded-lg px-5 py-2.5 text-sm font-semibold text-cream transition-colors disabled:opacity-60 ${
                  dupActive ? 'bg-terracotta-700 hover:opacity-90' : 'bg-mulberry hover:bg-mulberry-600'
                }`}
              >
                {isPending ? 'Adding…' : primaryLabel}
              </button>
            </div>
          </div>

          {toast ? (
            <div className="pointer-events-none fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream shadow-lg sm:bottom-8">
              {toast}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
