'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import type { DetailsItemKey, DetailsItemModel } from '@/lib/maker-details-items';
import type { PrintField } from '@/lib/print-layout';
import { DetailsTapContext, PRINT_FIELD_INPUT } from './details-tap';

/** `DetailsItemModel` (`lib/maker-details-items.ts`) plus its small picture. */
export type DetailsNavItem = DetailsItemModel & {
  /** A small picture or glyph — never a live render (the list is not a gallery). */
  icon: ReactNode;
};

export type DetailsNavGroup = { key: string; label: string; items: DetailsNavItem[] };

/**
 * THE DETAILS PAGE WEARS THE MAKER'S THREE COLUMNS (owner 2026-09-28, verbatim:
 * *"then this means we can have the navigator on the left? so we can pick which
 * one to edit?"*; DECISION_LOG "THE DETAILS PAGE WEARS THE MAKER'S THREE
 * COLUMNS: NAVIGATOR LEFT · PREVIEW BODY · EDITOR RIGHT"; the approved
 * prototype `Setnayan/prototypes/details_themes_page_2026-09-28.html`).
 *
 *   · LEFT — the navigator of Details items, grouped (Theme · Your Event Hub ·
 *     Invitation set · For the day). Groups are DATA (`groups`), so the fact
 *     groups still to come (Your event · Words · Love Story · Schedule) are
 *     added as rows, not rework.
 *   · BODY — the picked item's picture: the theme gallery, the QR, a print.
 *   · RIGHT — the picked item's editor: what it includes, its words, its size,
 *     its downloads.
 *
 * 📱 PHONE (owner: 99% of viewers): the scene navigator's own shape — the body
 * on top, the navigator a sideways strip under it, and the editor a panel under
 * that which opens ("Edit · The Invitation ▴") and closes. All IN THE FLOW —
 * never `fixed` over the page, never a dialog (`MakerPage`'s rule).
 *
 * 🔑 EVERY EDITOR STAYS MOUNTED. The print words form posts every switch and
 * line it owns at once (`/api/hub-print/words` writes the whole
 * `print_details`); its fields live in several items' editors (joined to it by
 * `form=`), so an item that is not showing is HIDDEN, never unmounted — hidden
 * fields still post. A body is mounted the first time its item is opened and
 * then kept, so going back to the gallery keeps its scroll.
 *
 * Picking an item changes no data and loads no page: the address is kept in
 * step (`?tool=details&item=<key>`, `replaceState`) so a reload lands back here.
 *
 * ✍ TAP IT, EDIT IT ON THE RIGHT: a tap on a card's print-only words
 * (`PrintPreview`, via `DetailsTapContext`) opens the editor and puts the caret
 * in that one field.
 */
export function DetailsWorkspace({
  groups,
  bodies,
  editors,
  initial,
  persistent = null,
}: {
  groups: DetailsNavGroup[];
  bodies: Partial<Record<DetailsItemKey, ReactNode>>;
  editors: Partial<Record<DetailsItemKey, ReactNode>>;
  initial: DetailsItemKey;
  /** Drawn once, outside every item — the print words form, the first-visit tours. */
  persistent?: ReactNode;
}) {
  const items = groups.flatMap((g) => g.items);
  const first = items.some((i) => i.key === initial) ? initial : items[0]!.key;
  const [selected, setSelected] = useState<DetailsItemKey>(first);
  const [visited, setVisited] = useState<ReadonlySet<DetailsItemKey>>(() => new Set([first]));
  const [sheetOpen, setSheetOpen] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLOListElement>(null);
  const current = items.find((i) => i.key === selected) ?? items[0]!;

  const select = useCallback((key: DetailsItemKey) => {
    setSelected(key);
    setVisited((v) => (v.has(key) ? v : new Set(v).add(key)));
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tool', 'details');
      url.searchParams.set('item', key);
      window.history.replaceState(window.history.state, '', url);
    } catch {
      /* the address is a convenience; the page works without it */
    }
  }, []);

  /* The picked item stays in view in the navigator — by scrolling the NAVIGATOR
     only (`scrollLeft`/`scrollTop`), never `scrollIntoView`, which also scrolls
     every ancestor, the Maker included. */
  useEffect(() => {
    const nav = navRef.current;
    const el = nav?.querySelector<HTMLElement>(`[data-details-nav-item="${selected}"]`);
    if (!nav || !el) return;
    if (nav.scrollWidth > nav.clientWidth) nav.scrollLeft = Math.max(0, el.offsetLeft - nav.clientWidth / 2 + el.clientWidth / 2);
    else if (el.offsetTop < nav.scrollTop || el.offsetTop > nav.scrollTop + nav.clientHeight - el.clientHeight) nav.scrollTop = el.offsetTop - 24;
  }, [selected]);

  const tap = useCallback((field: PrintField) => {
    setSheetOpen(true);
    // After the panel has opened: the one field, ready to type.
    window.setTimeout(() => {
      const scope = editorRef.current?.querySelector<HTMLElement>(`[data-details-editor="${selected}"]`) ?? document;
      const el = scope.querySelector<HTMLElement>(`[name="${PRINT_FIELD_INPUT[field]}"]`) ??
        document.querySelector<HTMLElement>(`[name="${PRINT_FIELD_INPUT[field]}"]`);
      el?.focus();
    }, 60);
  }, [selected]);

  return (
    <DetailsTapContext.Provider value={tap}>
      <div data-details-workspace="" data-details-item={selected} className="flex h-full min-h-0 w-full flex-1 flex-col lg:flex-row">
        {/* ══ BODY — the picked item's picture ══ */}
        <section
          aria-label={`${current.label} — preview`}
          data-details-body=""
          className="order-1 min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[radial-gradient(120%_90%_at_50%_0%,rgba(203,167,102,.10),transparent_60%)] px-4 py-5 sm:px-6 lg:order-2"
        >
          <div className="mx-auto flex max-w-4xl flex-col gap-4">
            {items.map((i) =>
              visited.has(i.key) ? (
                <div key={i.key} hidden={i.key !== selected} data-details-body-item={i.key} className="flex flex-col gap-4">
                  <header className="flex flex-col gap-0.5">
                    <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
                      {groups.find((g) => g.items.some((x) => x.key === i.key))?.label}
                    </p>
                    <h2 className="font-serif text-2xl text-ink">{i.label}</h2>
                    {i.usedOn?.length ? (
                      <p className="text-xs text-ink/60" data-details-used-on={i.key}>
                        Used on {i.usedOn.join(' · ')}
                      </p>
                    ) : null}
                  </header>
                  {bodies[i.key] ?? null}
                </div>
              ) : null,
            )}
          </div>
        </section>

        {/* ══ LEFT — the navigator (a sideways strip on a phone) ══ */}
        <nav aria-label="Details — what to edit" className="order-2 shrink-0 border-t border-ink/10 bg-cream/80 lg:order-1 lg:w-[236px] lg:border-r lg:border-t-0">
          <ol
            ref={navRef}
            className="flex gap-1.5 overflow-x-auto px-3 py-2 [scrollbar-width:none] lg:h-full lg:flex-col lg:gap-0.5 lg:overflow-y-auto lg:overflow-x-hidden lg:py-4"
          >
            {groups.map((g) => (
              <li key={g.key} className="contents" data-details-nav-group={g.key}>
                <p className="hidden px-2 pb-1 pt-3 font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink/50 lg:block">{g.label}</p>
                <ul className="contents">
                  {g.items.map((i) => {
                    const on = i.key === selected;
                    return (
                      <li key={i.key} className="shrink-0">
                        <button
                          type="button"
                          aria-pressed={on}
                          onClick={() => select(i.key)}
                          data-details-nav-item={i.key}
                          className={`sn-press flex min-h-11 w-[84px] flex-col items-center gap-1 rounded-lg px-1.5 py-1.5 text-center transition-colors duration-sn-control ease-sn lg:w-full lg:flex-row lg:gap-2.5 lg:px-2 lg:text-left ${
                            on ? 'bg-ink/[0.07] text-ink' : 'text-ink/75 hover:bg-ink/[0.04]'
                          }`}
                        >
                          <span className={`relative inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white ${on ? 'ring-2 ring-ink' : 'ring-1 ring-ink/10'}`}>
                            {i.icon}
                            {i.done ? (
                              <span
                                data-details-done={i.key}
                                aria-label="Done"
                                className="absolute -bottom-0.5 -right-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-success-700 text-white ring-2 ring-cream"
                              >
                                <Check aria-hidden className="h-2.5 w-2.5" strokeWidth={3} />
                              </span>
                            ) : null}
                          </span>
                          <span className="flex min-w-0 flex-col">
                            <span className="line-clamp-2 text-[11.5px] font-medium leading-tight lg:truncate lg:text-[13.5px]">{i.label}</span>
                            {i.sub ? <small className="hidden truncate text-[11.5px] text-ink/55 lg:block">{i.sub}</small> : null}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
        </nav>

        {/* ══ RIGHT — the picked item's editor (a panel that opens, on a phone) ══ */}
        <aside
          aria-label={`${current.label} — edit`}
          data-details-editor-panel=""
          data-open={sheetOpen ? '' : undefined}
          className={`order-3 flex min-h-0 shrink-0 flex-col border-t border-ink/10 bg-cream lg:max-h-none lg:w-[360px] lg:border-l lg:border-t-0 ${
            sheetOpen ? 'max-h-[72%]' : 'max-h-14 lg:max-h-none'
          }`}
        >
          <button
            type="button"
            onClick={() => setSheetOpen((o) => !o)}
            aria-expanded={sheetOpen}
            data-details-editor-handle=""
            className="flex min-h-14 shrink-0 items-center gap-2 px-4 text-left lg:hidden"
          >
            <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">Edit · {current.label}</span>
            {sheetOpen ? <ChevronDown aria-hidden className="h-4 w-4 text-ink/55" /> : <ChevronUp aria-hidden className="h-4 w-4 text-ink/55" />}
          </button>
          <p className="hidden px-4 pt-4 font-serif text-lg text-ink lg:block">{current.label}</p>
          <div
            ref={editorRef}
            className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-2 ${sheetOpen ? '' : 'hidden lg:block'}`}
          >
            {items.map((i) => (
              <div key={i.key} hidden={i.key !== selected} data-details-editor={i.key} className="flex flex-col gap-3">
                {editors[i.key] ?? null}
              </div>
            ))}
            {persistent}
          </div>
        </aside>
      </div>
    </DetailsTapContext.Provider>
  );
}
