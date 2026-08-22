'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { claimCommandKey } from '@/lib/command-key-claim';
import { ADMIN_NAV_GROUPS } from './admin-nav-groups';
import { ADMIN_NAV_DESCRIPTIONS, ADMIN_NAV_ALIASES } from './admin-nav-descriptions';

/**
 * AdminCommandPalette — ⌘K / Ctrl-K, type three letters, go.
 *
 * WHY: the admin is 108 pages behind a sidebar the owner locked to six flat
 * doorways (2026-07-15, "solid menu with no submenus"). A short menu is only
 * safe if the long tail is reachable by NAME — otherwise finding a page depends
 * on remembering which drawer it lives in. This is that.
 *
 * 🔑 A SHORTCUT, NEVER THE ONLY DOOR. Everything here is also browsable at
 * /admin/more ("All surfaces"), which is why this may be keyboard-only and
 * unlabelled without stranding anything. If a destination is EVER reachable
 * only by typing, that is a bug in the menu, not a feature of this.
 *
 * CLIENT BOUNDARY: it imports ADMIN_NAV_GROUPS directly rather than receiving it
 * as a prop. The array carries `icon: LucideIcon` refs — function objects that
 * cannot cross the Server→Client boundary as props (the same crash the admin
 * sidebar hit and documents). Importing it into a 'use client' module bundles
 * the real array instead, exactly as admin-sidebar.tsx does. Only the label and
 * href are read here; the icons are never touched.
 */

type Dest = { label: string; href: string; group: string; hay: string };

/**
 * Words an admin TYPES that are in no page's name.
 *
 * The owner searched "pending" and got nothing — because matching was on the
 * label alone and no page is called Pending. People search for the JOB, not the
 * menu word. Descriptions close most of that gap for free ("reconcil" → Payments,
 * "badge" → Verify); these are the concept words that appear in neither.
 *
 * Deliberately small and hand-picked. A synonym list that tries to be complete
 * becomes a second vocabulary to maintain — and this project already has one
 * pair of vocabularies that drifted apart and made a whole surface unreachable.
 * Add a word here only after someone actually typed it and found nothing.
 */

/** Flatten the menu into one searchable list. Single source — never a second
 *  hand-typed roster, which is how the two drift and one goes stale. */
function destinations(): Dest[] {
  const out: Dest[] = [];
  for (const g of ADMIN_NAV_GROUPS) {
    for (const item of g.items) {
      if (!item.href) continue;
      // One haystack per destination: its name, its menu, its own description,
      // and the words people type for it. Built once at module load.
      out.push({
        label: item.label,
        href: item.href,
        group: g.label,
        hay: [
          item.label,
          g.label,
          ADMIN_NAV_DESCRIPTIONS[item.key] ?? '',
          ADMIN_NAV_ALIASES[item.key] ?? '',
        ]
          .join(' ')
          .toLowerCase(),
      });
    }
  }
  return out;
}

/**
 * The NAME always wins, then the meaning.
 *   100 name starts with · 60− name contains · 15 description/alias hit
 *   · 8 letters of the name in order · 0 no match
 * Ordering matters as much as matching: typing "pay" must land on Payments
 * before every page whose description happens to mention paying.
 */
function score(d: Dest, needle: string): number {
  if (!needle) return 1;
  const l = d.label.toLowerCase();
  const i = l.indexOf(needle);
  if (i === 0) return 100;
  if (i > 0) return Math.max(20, 60 - i);
  if (d.hay.includes(needle)) return 15;
  let p = 0;
  for (let c = 0; c < l.length && p < needle.length; c++) if (l[c] === needle[p]) p++;
  return p === needle.length ? 8 : 0;
}

export function AdminCommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const all = useMemo(destinations, []);
  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all
      .map((d) => ({ d, s: score(d, needle) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || a.d.label.localeCompare(b.d.label))
      .slice(0, 30)
      .map((x) => x.d);
  }, [all, q]);

  const close = useCallback(() => {
    setOpen(false);
    setQ('');
    setSel(0);
  }, []);

  // The SHARED focus contract, not a hand-rolled one: trap Tab inside the
  // dialog while open, close on Escape, and restore focus to whatever opened it.
  // modal-a11y-adoption.test.ts refuses any element claiming `aria-modal`
  // without routing through here — my first draft only RESTORED focus and was
  // correctly rejected. Restoring is not trapping.
  useModalA11y({ open, onClose: close, containerRef: dialogRef });

  /*
    ⌘K IS OURS ON THIS DOORWAY (One top bar, 2026-08-14). The shared top bar
    now mounts a palette over the person's own events on every signed-in
    surface, this one included — and two ⌘K listeners open two stacked dialogs
    with nothing thrown. This palette indexes all 108 admin surfaces, which the
    shared one cannot see, so it keeps the shortcut here and the shared one
    stands down. Pressing the bar's search box still opens the shared palette,
    so neither control is ever dead.
  */
  useEffect(() => claimCommandKey(), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (open) close();
        else setOpen(true);
        return;
      }
      if (!open) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSel((s) => (hits.length ? (s + 1) % hits.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSel((s) => (hits.length ? (s - 1 + hits.length) % hits.length : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const target = hits[sel];
        if (target) {
          close();
          router.push(target.href);
        }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, hits, sel, close, router]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  useEffect(() => {
    setSel(0);
  }, [q]);

  if (!open) return null;

  let lastGroup = '';
  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-ink/30"
        onClick={close}
        aria-hidden
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search every admin page"
        className="fixed left-1/2 top-[11vh] z-[61] w-[min(620px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-xl border shadow-2xl"
        style={{ borderColor: 'var(--sn-line)', background: 'var(--sn-paper, #FFFFFF)' }}
      >
        <div
          className="flex items-center gap-3 border-b px-4 py-3.5"
          style={{ borderColor: 'var(--sn-line-soft, #F1ECE3)' }}
        >
          <Search aria-hidden className="h-4 w-4 shrink-0" style={{ color: 'var(--sn-ink-500)' }} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Go to… payouts, taxonomy, secrets, venues"
            className="flex-1 bg-transparent text-base outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold"
            style={{ borderColor: 'var(--sn-line)', color: 'var(--sn-ink-500)' }}>esc</kbd>
        </div>

        <div className="max-h-[min(58vh,430px)] overflow-auto p-1.5">
          {hits.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm" style={{ color: 'var(--sn-ink-500)' }}>
              Nothing matches “{q}”. Everything is also browsable under{' '}
              <span className="whitespace-nowrap">All surfaces</span>.
            </p>
          ) : (
            hits.map((d, i) => {
              const header = d.group !== lastGroup ? ((lastGroup = d.group), d.group) : null;
              return (
                <div key={d.href + d.label}>
                  {header ? (
                    <p className="px-3 pb-1 pt-2.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.16em]"
                      style={{ color: 'var(--sn-ink-500)' }}>{header}</p>
                  ) : null}
                  <button
                    type="button"
                    onMouseMove={() => setSel(i)}
                    onClick={() => {
                      close();
                      router.push(d.href);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold"
                    style={i === sel ? { background: 'var(--sn-paper-2, #F5EEE1)' } : undefined}
                  >
                    <span>{d.label}</span>
                    <span className="ml-auto truncate font-mono text-[10.5px]"
                      style={{ color: 'var(--sn-ink-500)' }}>{d.group}</span>
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div
          className="flex gap-4 border-t px-4 py-2 text-[11px]"
          style={{ borderColor: 'var(--sn-line-soft, #F1ECE3)', color: 'var(--sn-ink-500)' }}
        >
          <span>↑↓ move</span><span>↵ open</span><span>esc close</span>
          <span className="ml-auto font-mono">{hits.length} of {all.length}</span>
        </div>
      </div>
    </>
  );
}
