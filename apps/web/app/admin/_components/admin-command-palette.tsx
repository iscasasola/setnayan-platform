'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { claimCommandKey } from '@/lib/command-key-claim';
import { rankBySentence } from '@/lib/admin-map/rank-by-sentence';

import { askTheAdmin, type AskAnswer } from './ask-actions';
import { ADMIN_SEARCH_OPEN_EVENT } from './admin-search-open-event';

import { buildDestinations, type Dest, type RowDest } from './admin-destinations';

/**
 * AdminCommandPalette — ⌘K / Ctrl-K, type three letters, go.
 *
 * WHY: the admin is a large tree behind a sidebar the owner locked to six flat
 * doorways (2026-07-15, "solid menu with no submenus"). A short menu is only
 * safe if the long tail is reachable by NAME — otherwise finding a page depends
 * on remembering which drawer it lives in. This is that.
 *
 * 🔑 A SHORTCUT, NEVER THE ONLY DOOR. Everything here is also browsable at
 * /admin/more ("All surfaces"), which is why this may be keyboard-only and
 * unlabelled without stranding anything. If a destination is EVER reachable
 * only by typing, that is a bug in the menu, not a feature of this.
 *
 * 🪤 THIS DOCBLOCK USED TO SAY IT "indexes all 108 admin surfaces". It indexed
 * the MENU — 78 items — and the menu is smaller than the tree, so seven real
 * pages were reachable only by knowing their URL and ~40 moved pages could not
 * be found under the address people still type. The destination list now comes
 * from admin-destinations.ts, which joins the menu with a SCANNED map of the
 * route tree. Corrected here rather than deleted, because the claim was the
 * reason nobody looked.
 */

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
  let raw = 0;
  const i = l.indexOf(needle);
  if (i === 0) raw = 100;
  else if (i > 0) raw = Math.max(20, 60 - i);
  else if (d.hay.includes(needle)) raw = 15;
  else {
    let p = 0;
    for (let c = 0; c < l.length && p < needle.length; c++) if (l[c] === needle[p]) p++;
    raw = p === needle.length ? 8 : 0;
  }
  // A page the map found is worth offering and is never worth REORDERING the
  // curated menu for. Halving keeps the bands apart in both directions: an exact
  // name match on an unlisted page (50) still beats a vague description hit on a
  // menu page (15), and never beats the menu page with the same name (100).
  // Bands: the curated menu at full strength, a scanned page at half, a row
  // inside a page at a third. A row must never outrank the page that holds it
  // for a vague query — it wins only when its own words are what you typed.
  if (d.source === 'map') return raw / 2;
  if (d.source === 'row') return raw / 3;
  return raw;
}

export function AdminCommandPalette({ rows = [] }: { rows?: readonly RowDest[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const all = useMemo(() => buildDestinations(rows), [rows]);
  /**
   * A SENTENCE, not just a word. The old line here scored the whole typed string
   * as one needle, so "papic prices" — two words — returned nothing at all, and
   * so did every sentence the owner tried. rankBySentence keeps today's
   * whole-string score as the FIRST sort key, so nothing that already answers
   * changes; the per-word evidence only breaks ties and rescues zeroes. `score`
   * below is passed in untouched, which is what makes that guarantee checkable.
   */
  const { hits, unknown } = useMemo(
    () => rankBySentence(all, q, score, 30),
    [all, q],
  );

  /**
   * The escape hatch, and the only place a model is ever reached.
   *
   * 🔑 IT IS OFFERED, NEVER AUTOMATIC. Nothing here fires while the free word
   * matching has an answer — which is nearly always — so the ordinary day costs
   * ₱0. A phrase it has been taught before never reaches a model either: the
   * action looks that up first. The button appears only when the box would
   * otherwise say "nothing", which is exactly the case the owner kept hitting.
   */
  const [asking, setAsking] = useState(false);
  const [asked, setAsked] = useState<AskAnswer | null>(null);

  const ask = useCallback(async () => {
    setAsking(true);
    setAsked(null);
    try {
      const choices = all
        .filter((d) => d.source !== 'row')
        .map((d) => ({ label: d.label, href: d.href }));
      setAsked(await askTheAdmin(q, choices));
    } catch {
      setAsked({ ok: false, reason: 'unavailable' });
    } finally {
      setAsking(false);
    }
  }, [all, q]);

  const close = useCallback(() => {
    setOpen(false);
    setQ('');
    setSel(0);
    setAsked(null);
    setAsking(false);
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
    with nothing thrown. This palette indexes every admin destination — the
    menu plus the scanned route map — which the shared one cannot see, so it
    keeps the shortcut here and the shared one
    stands down. Pressing the bar's search box still opens the shared palette,
    so neither control is ever dead.
  */
  useEffect(() => claimCommandKey(), []);

  /**
   * The visible box opens this same panel.
   *
   * 🔴 Until 2026-08-26 there was no way in but ⌘K, and the owner — the only
   * person who uses this console — said plainly: *"i do not see the AI
   * searchbar."* A shortcut nobody was told about is not a door.
   */
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(ADMIN_SEARCH_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(ADMIN_SEARCH_OPEN_EVENT, onOpen);
  }, []);

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
    // A new question is not the old question's answer.
    setAsked(null);
  }, [q]);

  if (!open) return null;

  /**
   * The words nothing knows, said out loud.
   *
   * 🔑 WITHOUT THIS THE BOX LIES BY OMISSION. "papic prices" resolves on "papic"
   * alone and opens *Papic storage* — a real page, and not the prices. The Papic
   * PRICES are rows inside a page and this map indexes pages, so the truthful
   * answer is "no page has the word prices", not a confident near-miss.
   */
  const unknownNote =
    unknown.length > 0 && hits.length > 0
      ? `No page has ${unknown.length === 1 ? 'the word' : 'the words'} ${unknown
          .map((w) => `“${w}”`)
          .join(', ')}.`
      : null;

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
          {unknownNote ? (
            <p
              className="mx-1.5 mb-1 mt-1 rounded-md px-2.5 py-1.5 text-[11.5px]"
              style={{ background: 'var(--sn-sunk, #F4F2EC)', color: 'var(--sn-ink-500)' }}
            >
              {unknownNote}
            </p>
          ) : null}
          {hits.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm" style={{ color: 'var(--sn-ink-500)' }}>
              <p>
                Nothing matches “{q}”. Everything is also browsable under{' '}
                <span className="whitespace-nowrap">All surfaces</span>.
              </p>
              {asked?.ok ? (
                <button
                  type="button"
                  onClick={() => {
                    close();
                    router.push(asked.answer.href);
                  }}
                  className="mt-3 w-full rounded-lg border px-3 py-2.5 text-left"
                  style={{ borderColor: 'var(--sn-line)' }}
                >
                  <span className="block text-[13px] font-semibold" style={{ color: 'var(--sn-ink)' }}>
                    {asked.answer.label}
                  </span>
                  <span className="block text-[11.5px]">{asked.answer.because}</span>
                  {asked.answer.from === 'remembered' ? (
                    <span className="mt-1 block font-mono text-[9.5px] uppercase tracking-[0.14em]">
                      remembered · free
                    </span>
                  ) : (
                    <span className="mt-1 block font-mono text-[9.5px] uppercase tracking-[0.14em]">
                      learned just now · free from here on
                    </span>
                  )}
                </button>
              ) : asked && !asked.ok ? (
                <p className="mt-3 text-[12px]">
                  {asked.reason === 'unavailable'
                    ? 'The assistant is not switched on here.'
                    : 'It could not place that one either.'}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={ask}
                  disabled={asking || q.trim().length < 3}
                  className="mt-3 rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold disabled:opacity-50"
                  style={{ borderColor: 'var(--sn-line)', color: 'var(--sn-ink)' }}
                >
                  {asking ? 'Thinking…' : 'Ask Setnayan where this lives'}
                </button>
              )}
            </div>
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
