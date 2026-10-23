'use client';

import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  LogOut,
  Store,
  ShieldCheck,
  UserRound,
  ChevronDown,
  ChevronRight,
  Check,
  Plus,
  ExternalLink,
  Images,
  Users,
  CreditCard,
  Settings,
  Clapperboard,
  Gift,
  Info,
} from 'lucide-react';
import type { SwitcherData } from './get-switcher-data';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { newLabel, readSheetUnreadUrls, splitSheetUnread, type SheetUnread } from '@/lib/avatar-sheet-counts';

type Props = {
  data: SwitcherData;
  /** When provided, shown next to the avatar in the trigger pill (e.g. event display name). */
  currentEventName?: string | null;
  /** RETIRED 2026-10-22 (Direction 2): the Home button became the "Your events" row, whose words are fixed by the
   *  approved drawing. Still accepted so a caller passing it compiles; nothing reads it. */
  homeLabel?: string;
  /**
   * "Refer a couple" — the event's referral page, handed in by the event
   * layout ONLY while the referral programme is on (Stage D, owner 2026-09-29:
   * "Refer a couple → account menu"; it left the event menu). Null/absent →
   * no link, so the programme's master toggle is still the one gate.
   */
  referHref?: string | null;
  /**
   * THE SUPPLIER'S OWN ROWS (simpler supplier dashboard step 5, 2026-10-14 — prototype `SHEETS.avatar`: "Your details ·
   * Your page · Your collections · Helpers · Plan · Settings · Switch shop · Sign out"). Handed in by the vendor
   * layout only, so every other surface's panel is exactly as it was. Each is a plain link; the panel's own "Switch to"
   * rail and Sign out stay the switch-shop and sign-out rows. Read nothing: a count here would put the documents and
   * payment reads on every supplier page. The finished sheet (which rows, for which role, Plan never in the store
   * shell) is step 6's — built in the vendor layout.
   */
  shopRows?: readonly ShopRow[] | null;
  /** Which "Switch to" row wears the ✓ — the layout knows where it is. Default: Your events. */
  here?: SheetPlace;
  /** The vendor layout's open shop, so its row (of several) wears the ✓. */
  activeShopId?: string | null;
};

export type ShopRow = { key: string; href: string; label: string; sub: string };
/** Step 6's name for the same row (simpler supplier dashboard — prototype SHEETS.avatar); one shape, two names. */
export type SwitcherShopRow = ShopRow;

/**
 * AccountSwitcher — unified identity panel (account-switcher iteration).
 *
 * Triggers (all open the same SwitcherPanelBody):
 *   – <AccountSwitcher> avatar pill — mobile top bars + the launcher/account
 *     slim top bar. Bottom sheet on mobile / side drawer on desktop.
 *   – <SwitcherPlaqueTrigger> — the desktop-rail identity plaque (event /
 *     business / HQ), Council Verdict 2026-07-16 "Plaque-as-Menu": the plaque
 *     is THE popup trigger on desktop rails; the old email pill
 *     (AccountSwitcherStandalone) is retired. Going home is the rail
 *     wordmark's job (DoorwaySidebarHeader), not the plaque's.
 *
 * Motion:
 *   – Mobile: bottom sheet slides up (translateY 100% → 0) + backdrop fades in
 *   – Desktop: drawer slides in from left (translateX -100% → 0) + backdrop fades in
 *   Both: CSS transitions 0.3s ease
 */
/** Where the person is standing when they open the sheet — that row wears the ✓. null = none of the three
 *  (the front door, Discover): every row is a › . */
export type SheetPlace = 'events' | 'shop' | 'admin' | null;

/**
 * THE SHEET'S OWN LOOK — Direction 2 "Profile header" (owner 2026-10-22: "Direction 2"; prototype
 * `prototypes/avatar_sheet_uniform_2026-10-22.html` · d2). Tokens only, so dark is the app's dark set: the sheet's
 * ground is a step off the card (paper-2 in light, the page in dark), cards are the paper, hairlines are the line.
 * The rows are what you press, so a row has no frame — the card is a filled surface, not a border.
 */
const SHEET_CSS = `
.sn-sheet{background:var(--m-paper-2);--sn-new:rgb(var(--color-mulberry))}
html.dark .sn-sheet{background:rgb(var(--color-cream));--sn-new:var(--m-orange)}
.sn-sheet-card>*+*{position:relative}
.sn-sheet-card>*+*::before{content:"";position:absolute;left:68px;right:0;top:0;height:1px;background:var(--m-line);pointer-events:none}
.sn-sheet-card>.sn-row-sm+*::before,.sn-sheet-card>*+.sn-row-sm::before{left:60px}
.sn-sheet-card>[data-on]+*::before,.sn-sheet-card>[data-on]::before{display:none}
.sn-sheet-cover{background:radial-gradient(90% 120% at 100% 0%,color-mix(in srgb,var(--m-orange) 28%,transparent),transparent 60%),var(--m-paper)}
`;

/** The round mark at the start of a row. */
function RowMark({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span
      aria-hidden
      className={`flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-[15px] font-bold ${className}`}
    >
      {children}
    </span>
  );
}

/** "• N new" — drawn ONLY for a real positive count (`newLabel`); a failed read or a zero draws nothing. */
function NewCount({ n }: { n: number | null | undefined }) {
  const label = newLabel(n);
  if (!label) return null;
  return (
    <>
      <span aria-hidden>·</span>
      <span data-sheet-count="" className="inline-flex items-center gap-[5px] font-semibold text-[var(--sn-new)]">
        <i aria-hidden className="inline-block h-[7px] w-[7px] rounded-full bg-[var(--sn-new)]" />
        {label}
      </span>
    </>
  );
}

/** The pill tag — SHOP · ADMIN. On the row you stand in it turns gold, as drawn. */
function Tag({ children, on = false }: { children: ReactNode; on?: boolean }) {
  return (
    <span
      className={`shrink-0 rounded-full px-[9px] py-1 font-mono text-[9.5px] uppercase tracking-[0.14em] ${
        on ? 'bg-[var(--m-nav-active)] text-[rgb(var(--color-cream))]' : 'bg-[var(--m-ivory)] text-[var(--m-slate-2)]'
      }`}
    >
      {children}
    </span>
  );
}

/** ✓ in a filled gold circle where you are; › everywhere else. */
function Trail({ on }: { on: boolean }) {
  return on ? (
    <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[var(--m-nav-active)] text-[rgb(var(--color-cream))]">
      <Check aria-hidden className="h-[15px] w-[15px]" strokeWidth={3} />
      <span className="sr-only">(you are here)</span>
    </span>
  ) : (
    <ChevronRight aria-hidden className="h-[17px] w-[17px] shrink-0 text-[var(--m-slate-3)]" strokeWidth={2} />
  );
}

/** A shop's initials for its round mark when it has no logo ("SetnaProd" → "SP"). */
function shopInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return (words[0]!.charAt(0) + words[1]!.charAt(0)).toUpperCase();
  const w = words[0] ?? '?';
  const caps = w.replace(/[^A-Z]/g, '');
  return (caps.length >= 2 ? caps.slice(0, 2) : w.slice(0, 2)).replace(/^./, (c) => c.toUpperCase());
}

const ROW = 'flex min-h-[62px] w-full items-center gap-3 py-2 pl-3 pr-3.5 text-left transition-colors hover:bg-[var(--m-paper-2)]';
const ROW_SM = 'sn-row-sm flex min-h-[52px] w-full items-center gap-3 py-1.5 pl-3 pr-3.5 text-left transition-colors hover:bg-[var(--m-paper-2)]';
const NAME = 'block truncate text-base font-semibold leading-tight text-ink';
const SUB = 'mt-0.5 flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-[13px] text-[var(--m-slate-2)]';
const TILE = 'flex min-h-[44px] flex-1 basis-0 flex-col items-center gap-[7px] rounded-card bg-[var(--m-paper)] px-1 pb-2.5 pt-3 text-center text-[11.5px] font-medium leading-[1.15] text-ink';
const TILE_MARK = 'flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[var(--m-ivory)]';

const SHOP_ROW_ICON: Record<string, typeof Store> = {
  details: UserRound,
  page: Store,
  collections: Images,
  helpers: Users,
  plan: CreditCard,
  settings: Settings,
};

/**
 * SwitcherPanelBody — the ONE shared interior of the account sheet (mobile bottom sheet · desktop card under the
 * pill · the desktop-rail plaque drawer). Kept in ONE place so the triggers can never drift.
 *
 * DIRECTION 2 · PROFILE HEADER (owner 2026-10-22, "Direction 2"; reference: Facebook's account switcher):
 *   1. THE COVER — photo · name · email · "Profile & settings ›". The whole band is the link to /dashboard/profile,
 *      and it is the signed-in disclosure on every surface (council verdict 2026-07-16: name AND email, here).
 *   2. SWITCH TO — ONE card, every place this login can be, one row each:
 *        Your events (→ /dashboard?hub=1) · each shop (SHOP tag; "View page ↗" under it) · Setnayan HQ (ADMIN tag,
 *        team only) · Create your shop (canOpenShop). ✓ on the row you are standing in, › on the rest, "• N new"
 *        from the bell's own read split by place (lib/avatar-sheet-counts.ts — a failed read draws nothing).
 *   3. YOUR SHOP — the supplier's own rows, vendor layout only, same row anatomy.
 *   4. QUICK TILES — Your Story · Refer a couple (programme on) · Show me around (a tour is mounted) · Sign out.
 *   5. "Sign out of all accounts" — the one quiet line. Until other logins can live on this phone it signs out the
 *      only one there is, so today it is the same form as Sign out.
 *
 * ⚠ `?hub=1` on Your events IS LOAD-BEARING: plain `/dashboard` re-fires the launcher's auto-jump for a
 * single-event person and lands them back in the event they were leaving (owner 2026-08-11: the board is "the
 * user's collection of events"). On mobile event/vendor/admin bars this row is the ONLY way home — never drop it.
 *
 * Every destination is a real <Link> (middle-click, new tab, screen readers announce navigation). The shop switch
 * and the sign-outs are POST forms — a link on another site cannot change which shop or account you are in.
 */
export function SwitcherPanelBody({
  data,
  close,
  referHref = null,
  shopRows = null,
  here = 'events',
  activeShopId = null,
  unread = null,
}: {
  data: SwitcherData;
  close: () => void;
  referHref?: string | null;
  shopRows?: readonly ShopRow[] | null;
  here?: SheetPlace;
  activeShopId?: string | null;
  /** The per-row counts — null until read, and null for good when the read failed (nothing is drawn). */
  unread?: SheetUnread | null;
}) {
  const shops = data.context.shops ?? [];
  const showHQ = data.context.isAdmin;
  const name = data.displayName?.trim() || data.email || 'Guest — draft plan';
  const initial = (data.displayName?.trim() || data.email)?.charAt(0).toUpperCase() ?? '?';
  // The shop the supplier pages are reading right now: the layout says, else the only one listed.
  const currentShopId = here === 'shop' ? (activeShopId ?? (shops.length === 1 ? shops[0]!.id : null)) : null;
  const me = data.photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={data.photoUrl} alt="" width={56} height={56} className="h-full w-full object-cover" />
  ) : (
    initial
  );

  return (
    <div className="flex-1 overflow-y-auto pb-1" data-avatar-sheet="d2">
      <style>{SHEET_CSS}</style>

      {/* ── 1 · The cover — who you are; the band is Profile & settings ── */}
      <div className="px-3 pt-1">
        <Link
          href="/dashboard/profile"
          onClick={close}
          data-sheet-cover=""
          className="sn-sheet-cover relative flex items-center gap-3 overflow-hidden rounded-tile py-3.5 pl-3 pr-3.5"
        >
          <span
            aria-hidden
            className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink text-[19px] font-bold text-cream"
          >
            {me}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-[family-name:var(--font-editorial-display)] text-[22px] font-semibold leading-[1.1] text-ink">{name}</span>
            {data.displayName && data.email ? (
              <span className="mt-[3px] block truncate text-[12.5px] text-[var(--m-slate-2)]">{data.email}</span>
            ) : null}
            <span className="mt-1 flex items-center gap-[3px] text-xs font-semibold text-[var(--m-nav-active)]">
              Profile &amp; settings <ChevronRight aria-hidden className="h-[13px] w-[13px]" strokeWidth={2.5} />
            </span>
          </span>
          <Tag>You</Tag>
        </Link>
      </div>

      {/* ── 2 · Switch to — every place this login can be, one card ── */}
      <span className="block px-6 pb-1.5 pt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--m-slate-3)]">
        Switch to
      </span>
      <nav aria-label="Switch to" className="sn-sheet-card mx-3 overflow-hidden rounded-tile bg-[var(--m-paper)]" data-sheet-switch="">
        <Link
          href="/dashboard?hub=1"
          onClick={close}
          data-sheet-place="events"
          {...(here === 'events' ? { 'data-on': '', 'aria-current': 'page' as const } : {})}
          className={`${ROW} ${here === 'events' ? 'bg-[var(--m-paper-2)]' : ''}`}
        >
          <RowMark className="bg-ink text-cream">{me}</RowMark>
          <span className="min-w-0 flex-1">
            <span className={NAME}>Your events</span>
            <span className={SUB}>
              <span className="truncate">{name}</span>
              <NewCount n={unread?.events} />
            </span>
          </span>
          <Trail on={here === 'events'} />
        </Link>

        {shops.map((shop) => {
          const on = currentShopId === shop.id;
          const mark = shop.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shop.logoUrl} alt="" width={44} height={44} className="h-full w-full object-cover" />
          ) : (
            shopInitials(shop.name)
          );
          const body = (
            <>
              <RowMark className="bg-[linear-gradient(135deg,#8a6b39,#5a3b28)] font-[family-name:var(--font-editorial-display)] text-[17px] tracking-[0.02em] text-[#FFFDF8]">
                {mark}
              </RowMark>
              <span className="min-w-0 flex-1">
                <span className={NAME}>{shop.name}</span>
                <span className={SUB}>
                  <span className="truncate">{shop.owned ? 'Your shop' : 'Helper'}</span>
                  <NewCount n={unread?.shop} />
                </span>
              </span>
              <Tag on={on}>Shop</Tag>
              <Trail on={on} />
            </>
          );
          return (
            <Fragment key={shop.id}>
              {/* 🔀 One row per shop. With more than one, the row posts its id to the shop switch, which checks it
                  against this login's own shops before the supplier pages read it (lib/active-shop.ts). */}
              {shops.length > 1 ? (
                <form
                  action="/vendor-dashboard/switch-shop"
                  method="post"
                  data-sheet-place="shop"
                  data-sheet-shop={shop.id}
                  {...(on ? { 'data-on': '' } : {})}
                  className={on ? 'bg-[var(--m-paper-2)]' : ''}
                >
                  <input type="hidden" name="shop" value={shop.id} />
                  <button type="submit" className={ROW} {...(on ? { 'aria-current': 'page' as const } : {})}>
                    {body}
                  </button>
                </form>
              ) : (
                <Link
                  href="/vendor-dashboard"
                  onClick={close}
                  data-sheet-place="shop"
                  data-sheet-shop={shop.id}
                  {...(on ? { 'data-on': '', 'aria-current': 'page' as const } : {})}
                  className={`${ROW} ${on ? 'bg-[var(--m-paper-2)]' : ''}`}
                >
                  {body}
                </Link>
              )}
              {/* View page ↗ — the shop's public page; its owner sees it even before it is verified (self-preview). */}
              {shop.publicHref ? (
                <Link href={shop.publicHref} onClick={close} data-sheet-view-page={shop.id} className={ROW_SM}>
                  <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--m-ivory)] text-ink">
                    <ExternalLink className="h-[18px] w-[18px]" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">View page ↗</span>
                </Link>
              ) : null}
            </Fragment>
          );
        })}

        {showHQ ? (
          /* Admin — the owner's own word (21 Oct; 2026-09-21 "… Shop · Admin"). Never a tab on the account bar
             (lib/account-bar.ts); THIS row is how a team account reaches it from the phone. */
          <Link
            href="/admin"
            onClick={close}
            data-sheet-place="admin"
            {...(here === 'admin' ? { 'data-on': '', 'aria-current': 'page' as const } : {})}
            className={`${ROW} ${here === 'admin' ? 'bg-[var(--m-paper-2)]' : ''}`}
          >
            <RowMark className="bg-ink font-[family-name:var(--font-editorial-display)] text-[26px] font-semibold text-[var(--m-orange-3)]">S</RowMark>
            <span className="min-w-0 flex-1">
              <span className={NAME}>Setnayan HQ</span>
              <span className={SUB}>
                <span className="truncate">Team</span>
                <NewCount n={unread?.admin} />
              </span>
            </span>
            <Tag on={here === 'admin'}>Admin</Tag>
            <Trail on={here === 'admin'} />
          </Link>
        ) : null}

        {/* Create your shop — gated on `canOpenShop` (shops they OWN vs the cap), NOT `!hasVendor`: a helper in
            someone else's shop owns nothing and may still open one. A refused shops read keeps it closed (a duplicate
            shop is permanent). Hidden for anon-drafts. */}
        {!data.isAnonymous && data.context.canOpenShop ? (
          <Link href="/open-shop" onClick={close} data-sheet-place="open-shop" className={ROW}>
            <RowMark className="border-[1.5px] border-dashed border-[var(--m-line)] text-[var(--m-slate-2)]">
              <Plus className="h-5 w-5" strokeWidth={2} />
            </RowMark>
            <span className="min-w-0 flex-1">
              <span className={NAME}>Create your shop</span>
            </span>
            <Trail on={false} />
          </Link>
        ) : null}
      </nav>

      {/* ── 3 · Your shop — the supplier's own rows, vendor layout only ── */}
      {shopRows && shopRows.length > 0 ? (
        <>
          <span className="block px-6 pb-1.5 pt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--m-slate-3)]">
            Your shop
          </span>
          <nav
            aria-label="Your shop"
            className="sn-sheet-card mx-3 overflow-hidden rounded-tile bg-[var(--m-paper)]"
            data-switcher-shop-rows=""
          >
            {shopRows.map((r) => {
              const Icon = SHOP_ROW_ICON[r.key] ?? ChevronRight;
              return (
                <Link key={r.key} href={r.href} onClick={close} data-switcher-shop-row={r.key} className={ROW_SM}>
                  <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--m-ivory)] text-ink">
                    <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-ink">{r.label}</span>
                    <span className="block truncate text-[12.5px] text-[var(--m-slate-2)]">{r.sub}</span>
                  </span>
                  <ChevronRight aria-hidden className="h-[17px] w-[17px] shrink-0 text-[var(--m-slate-3)]" strokeWidth={2} />
                </Link>
              );
            })}
          </nav>
        </>
      ) : null}

      {/* ── 4 · Quick tiles ── */}
      <div className="mx-3 mt-2.5 flex gap-2" data-sheet-tiles="">
        {/* Your Story — the Storyteller chapters (/dashboard/creator); a page ships with its doorway (2026-07-16 B4). */}
        {!data.isAnonymous ? (
          <Link href="/dashboard/creator" onClick={close} className={TILE}>
            <span aria-hidden className={TILE_MARK}>
              <Clapperboard className="h-5 w-5" strokeWidth={1.75} />
            </span>
            Your Story
          </Link>
        ) : null}
        {/* Refer a couple — handed in by the event layout ONLY while the referral programme is on (Stage D, owner
            2026-09-29: "Refer a couple → account menu"). */}
        {!data.isAnonymous && referHref ? (
          <Link
            href={referHref}
            onClick={close}
            className={TILE}
          >
            <span aria-hidden className={TILE_MARK}>
              <Gift className="h-5 w-5" strokeWidth={1.75} />
            </span>
            Refer a couple
          </Link>
        ) : null}
        {/* 🔦 Show me around — replays this surface's spotlight tour (`spotlight-mount.tsx`). Drawn only where a tour
            is mounted (<html data-spotlight>), so it is never a dead button. */}
        <button
          type="button"
          className={`${TILE} hidden [html[data-spotlight]_&]:flex`}
          onClick={() => {
            close();
            window.dispatchEvent(new Event('sn:spotlight'));
          }}
        >
          <span aria-hidden className={TILE_MARK}>
            <Info className="h-5 w-5" strokeWidth={1.75} />
          </span>
          Show me around
        </button>
        {data.isAnonymous ? (
          <Link href="/signup" onClick={close} className={`${TILE} text-[var(--m-mulberry-deep)]`}>
            <span aria-hidden className={TILE_MARK}>
              <ShieldCheck className="h-5 w-5" strokeWidth={1.75} />
            </span>
            Secure your plan
          </Link>
        ) : (
          <form action="/auth/sign-out" method="post" className="flex flex-1 basis-0">
            <button type="submit" className={`${TILE} text-red-600 dark:text-red-400`}>
              <span aria-hidden className={`${TILE_MARK} bg-red-600/10`}>
                <LogOut className="h-5 w-5" strokeWidth={1.75} />
              </span>
              Sign out
            </button>
          </form>
        )}
      </div>

      {/* ── 5 · Sign out of all accounts — one quiet line. One login lives on this phone today, so it is the same
          sign-out; "Other accounts on this phone" is the account-switch PR's. ── */}
      {!data.isAnonymous ? (
        <form action="/auth/sign-out" method="post" className="flex justify-center pt-1.5">
          <button
            type="submit"
            data-sheet-sign-out-all=""
            className="min-h-[44px] px-4 text-[12.5px] font-medium text-[var(--m-slate-2)] hover:text-ink"
          >
            Sign out of all accounts
          </button>
        </form>
      ) : null}
    </div>
  );
}

export function AccountSwitcher({ data, currentEventName, referHref, shopRows, here = 'events', activeShopId = null }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [unread, setUnread] = useState<SheetUnread | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // SSR-safe portal
  useEffect(() => setMounted(true), []);

  /*
    "• N new" per row — read when the sheet OPENS (never on page load: the sheet is on every page), in the browser,
    through the bell's own read split by place (lib/avatar-sheet-counts.ts). A refused or partial read leaves
    `unread` null and every row draws no count — never a 0.
  */
  const shopCount = data.context.shops?.length ?? 0;
  useEffect(() => {
    if (!open || !data.userId || data.isAnonymous) return;
    let live = true;
    void (async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const urls = await readSheetUnreadUrls(createClient(), data.userId);
        if (live) setUnread(urls ? splitSheetUnread(urls, shopCount) : null);
      } catch {
        if (live) setUnread(null);
      }
    })();
    return () => {
      live = false;
    };
  }, [open, data.userId, data.isAnonymous, shopCount]);

  function close() {
    setOpen(false);
  }

  // Focus trap, Esc-to-close, body-scroll-lock, focus-restore (shared hook).
  useModalA11y({ open, onClose: close, containerRef: panelRef });

  /*
    🔑 THE NAME IS THE MARK, AND THE EMAIL IS ONLY THE FALLBACK. The panel
    header two hundred lines up already reads `displayName ?? email` — the
    trigger read the email alone, so a person whose account carries a real name
    was still identified by whatever their mail provider happens to start with.
    Same source, same order, one answer.
  */
  const initial =
    (data.displayName?.trim() || data.email)?.charAt(0).toUpperCase() ?? '?';

  /*
    ⚠ WHAT THE OWNER SAW (2026-08-17, a zoom of the top-right corner):
    *"what happened to the top nav?"* — a box with an arrow in it and nothing
    else. The bar was whole; this control was the empty-looking part of it.

    🔑 A CIRCLE AT 1.17:1 IS NOT A CIRCLE. The avatar was `bg-terracotta/15`
    — the gold slot at 15% over the cream pill, which measures #F0E9DD against
    the white page: 1.20:1. WCAG 1.4.11 asks 3:1 of a control's own shape, and GOLD
    CANNOT REACH IT AT ANY ALPHA (solid gold is 3.37:1, so every tint of it is
    worse). So the shape was invisible, the initial inside it measured 4.17:1 —
    under the 4.5:1 AA floor — and for this account the initial is "I", a single
    vertical stroke. Ink solid: 13.82:1 both ways.

    🪤 AND THE TWO GUARDS THAT WATCH FOR THIS COULD NOT SEE IT.
    `palette-lock.test.ts` checks token DEFINITIONS, and the token is fine —
    the defect is the ALPHA at the call site. `lint-label-on-fill-contrast.mjs`
    judges only pairings where BOTH sides are opaque, and by its own docblock
    skips an alpha fill. The same seam that hid `#9A8F86` on five public
    routes. `identity-is-visible.test.ts` is the guard that can.

    🔒 THE PANEL'S OWN pale-gold circle is DELIBERATELY UNCHANGED. It sits
    beside "Signed in as {name}" — the words carry the identification there, so
    the circle is decoration and its faintness costs nothing. This one had to
    carry it alone.
  */
  const accountLabel = data.displayName?.trim() || data.email || null;

  // ─── Inner panel content ────────────────────────────────────────────────

  function renderPanel() {
    return (
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Account switcher"
        className={[
          'focus:outline-none',
          // Mobile: bottom sheet — inset-x + fixed bottom, slides up
          'fixed inset-x-0 bottom-0 z-[52] flex max-h-[90vh] pl-[var(--sn-safe-l)] pr-[var(--sn-safe-r)] flex-col overflow-hidden rounded-t-2xl border-t border-ink/10 sn-sheet pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl',
          /*
            ⚠ ON DESKTOP THIS USED TO BE A FULL-HEIGHT DRAWER PINNED TO THE FAR
            LEFT, AND THE OWNER ASKED WHY (2026-08-17): *"sign in is a pop up on
            the upper left?"* He had pressed the account button at the TOP RIGHT.

            🔑 THE TRIGGER MOVED AND THE PANEL'S GEOMETRY STAYED. The left
            drawer was correct when it was written: the pill was `lg:hidden`,
            so desktop opened this panel from the RAIL plaque in the bottom-left
            — and `SwitcherPlaqueTrigger` still does, from its own left drawer
            two hundred lines below, deliberately untouched. Then the pill was
            promoted to every width and became THE desktop account menu on all
            six top bars (admin · account · launcher · event · shop · the shared
            cluster), and nobody re-derived where its panel should appear. A menu
            that opens across the screen from the thing you pressed reads as a
            different feature opening by mistake.
            See [[feedback_a_ruling_outlives_the_premise_it_was_decided_on]].

            Desktop is now a card under the pill, in the corner it belongs to.
            `--fd-bar` is the shared bar's own height token — but it is declared
            on `.fd`, and this panel is PORTALED TO `document.body`, so it can
            never inherit it and the 56px fallback is what actually renders.
            That is two numbers for one measurement, which this repo has paid
            for before, so `menu-opens-where-you-pressed.test.ts` pins the
            fallback to the token's declared value and fails when either moves.

            🪤 THE UNDERSCORES IN THE `calc()` ARE NOT STYLE — WITHOUT THEM THIS
            PANEL LANDS 2,213px DOWN AN EMPTY PAGE. Tailwind turns `_` into a
            space, and CSS `calc()` REQUIRES whitespace around `+`. I first wrote
            `calc(var(--fd-bar,56px)+8px)` and measured it in a real browser on
            the live stylesheet: the parser KEEPS the declaration — nothing is
            dropped, nothing throws, no warning — and computes `top: 2213.2px`.
            The spaced form computes `64px`. Another member of the family this
            repo keeps meeting: the engine DECLINES quietly and the only symptom
            is that something is not where it should be. Test 4 pins it.
          */
          'lg:inset-x-auto lg:bottom-auto lg:right-[max(0.75rem,var(--sn-safe-r))] lg:pl-0 lg:pr-0 lg:top-[calc(var(--fd-bar,56px)_+_8px)] lg:w-80 lg:max-h-[min(80vh,34rem)] lg:rounded-2xl lg:border lg:border-ink/10 lg:pb-0',
        ].join(' ')}
        style={{
          animation: 'sn-switcher-in 0.3s ease',
        }}
      >
        <style>{`
          @keyframes sn-switcher-in {
            from { transform: translateY(100%); }
            to   { transform: translateY(0); }
          }
          @media (min-width: 1024px) {
            /* Drops from under the pill instead of flying in from the far
               edge — the motion has to agree with where the control is. */
            @keyframes sn-switcher-in {
              from { transform: translateY(-8px); opacity: 0; }
              to   { transform: translateY(0); opacity: 1; }
            }
          }
        `}</style>

        {/* Drag handle (mobile only) */}
        <div aria-hidden className="mx-auto mb-1.5 mt-2 h-1 w-10 shrink-0 rounded-full bg-[var(--m-line)] lg:hidden" />

        <SwitcherPanelBody
          data={data}
          close={close}
          referHref={referHref}
          shopRows={shopRows}
          here={here}
          activeShopId={activeShopId}
          unread={unread}
        />
      </div>
    );
  }

  return (
    <>
      {/* ── Trigger pill ──────────────────────────────────────── */}
      {/* `fd-acct` is the shared bar's hook: below 768 `front-door.css` draws
          this as a plain round photo — no pill, no chevron (owner 2026-10-03). */}
      <button
        type="button"
        aria-label="Open account switcher"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-tour="account-avatar"
        onClick={() => setOpen((v) => !v)}
        className="fd-acct inline-flex h-11 items-center gap-2 rounded-full border border-ink/15 bg-cream px-2 pr-3 text-sm font-medium text-ink/70 transition-colors hover:border-terracotta/40 hover:text-terracotta-700 focus:outline-none focus-visible:border-terracotta focus-visible:text-terracotta-700"
      >
        {/* Avatar circle — solid ink so the shape and the initial are both
            legible with nothing else in the pill (see the docblock above). */}
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink text-xs font-semibold text-cream">
          {data.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.photoUrl} alt="" width={32} height={32} className="h-full w-full object-cover" />
          ) : (
            initial
          )}
        </span>
        {currentEventName ? (
          <span className="max-w-[120px] truncate text-xs font-medium text-ink/80">
            {currentEventName}
          </span>
        ) : accountLabel ? (
          /*
            WHO IS SIGNED IN, IN WORDS. On the event / shop / HQ surfaces the
            slot above already names the room you are standing in, and that is
            the more useful sentence — so this only fills the slot when nothing
            else claims it, which is the launcher and the front door.

            ⚠ FROM `lg` UP ONLY, and that is a width decision, not a taste one.
            The shared bar carries identity, the search and this cluster on ONE
            row — the second row is what the owner struck down on 2026-07-30 —
            and "+ Create event" beside it is already hidden below 1024 for the
            same reason. On a phone the avatar is the whole mark, which is why
            it had to become visible before this line could be gated at all.
          */
          <span className="hidden max-w-[150px] truncate text-xs font-medium text-ink/80 lg:inline">
            {accountLabel}
          </span>
        ) : null}
        <ChevronDown
          aria-hidden
          className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          strokeWidth={2.5}
        />
      </button>

      {/* ── Backdrop + Panel (portaled to body) ───────────────── */}
      {open && mounted && typeof document !== 'undefined'
        ? createPortal(
            <>
              {/* Backdrop */}
              <button
                type="button"
                aria-label="Close account switcher"
                onClick={close}
                className="fixed inset-0 z-[51] bg-ink/40 backdrop-blur-[2px]"
                style={{ animation: 'sn-switcher-backdrop 0.3s ease' }}
              />
              <style>{`
                @keyframes sn-switcher-backdrop {
                  from { opacity: 0; }
                  to   { opacity: 1; }
                }
              `}</style>
              {renderPanel()}
            </>,
            document.body,
          )
        : null}
    </>
  );
}

/**
 * Desktop icon-rail trigger — avatar circle only (54px rail, no text).
 * Used instead of the pill trigger when we're in the narrow icon sidebar.
 */
export function AccountSwitcherIconTrigger({
  data,
  open,
  onToggle,
}: {
  data: SwitcherData;
  open: boolean;
  onToggle: () => void;
}) {
  const initial = data.email?.charAt(0).toUpperCase() ?? '?';
  return (
    <button
      type="button"
      aria-label="Open account switcher"
      aria-haspopup="dialog"
      aria-expanded={open}
      data-tour="account-avatar"
      onClick={onToggle}
      className="inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-ink/15 bg-cream text-sm font-semibold text-ink/70 transition-colors hover:border-terracotta/40 hover:text-terracotta-700 focus:outline-none focus-visible:border-terracotta"
    >
      {data.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={data.photoUrl} alt="" width={44} height={44} className="h-full w-full object-cover" />
      ) : (
        <span>{initial}</span>
      )}
    </button>
  );
}

/**
 * SwitcherPlaqueTrigger — the desktop-rail identity plaque that IS the account
 * menu (Council Verdict 2026-07-16 "Plaque-as-Menu, Wordmark-as-Home",
 * superseding the retired AccountSwitcherStandalone email pill).
 *
 * ONE component, three parameterizations — never fork per doorway:
 *   – couple:  chip = event monogram ("C&I") · title = event name · metaLine =
 *              "{Type} · {date}" · homeLabel = "Home · all your events"
 *   – vendor:  chip = <VendorAvatar> · title = business name · metaLine =
 *              "Verified vendor" / "Unverified"
 *   – admin:   chip = shield glyph · title = "Setnayan HQ" · metaLine = name
 *
 * Anatomy: a single whole-surface <button aria-haspopup="dialog"> styled as
 * the dark-glass plaque (atelier kit), with a trailing ChevronDown as VISUAL
 * AFFORDANCE ONLY (not a separate click zone — a split control was rejected by
 * the council as the "2 things there" ambiguity the owner asked to remove).
 * Going home is NOT this control's job — the rail wordmark link above it
 * (DoorwaySidebarHeader) carries 1-click home; the panel's Home item is the
 * 2-click fallback.
 *
 * Collapsed 64px rail: the plaque hides and the shipped
 * AccountSwitcherIconTrigger (avatar circle) takes over — same open state,
 * same panel, so the five account actions never vanish with the rail.
 */
export function SwitcherPlaqueTrigger({
  data,
  chip,
  title,
  metaLine,
  ariaLabel,
}: {
  data: SwitcherData;
  /** Content of the 36px identity chip — text initials ("C&I"), a
   *  <VendorAvatar>, or an icon glyph. The trigger owns the chip frame. */
  chip: ReactNode;
  /** Plaque headline — event name / business name / "Setnayan HQ". */
  title: string;
  /** Optional mono sub-line — "{Type} · {date}" / verification / admin name. */
  metaLine?: string | null;
  /** Honest menu semantics, e.g. `"Cale & Ice — account menu"` — never
   *  "switch events": the slimmed panel holds no event list. */
  ariaLabel: string;
  /** RETIRED 2026-10-22 — see Props.homeLabel. */
  homeLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setMounted(true), []);

  function close() {
    setOpen(false);
  }

  // Focus trap, Esc-to-close, body-scroll-lock, focus-restore (shared hook).
  useModalA11y({ open, onClose: close, containerRef: panelRef });

  return (
    <>
      {/* Expanded plaque — dark glass mini-card (design:
          event_dashboard_v2_2026-07-15.html), hidden on the 64px collapsed
          rail where the icon trigger below takes over. */}
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 [[data-sidebar-collapsed='1']_&]:hidden"
        style={{
          background:
            'radial-gradient(70% 60% at 85% -10%, rgba(203,167,102,.18), transparent 60%), var(--sn-glass-dark-bg, rgba(23,22,15,.82))',
          borderColor: 'var(--sn-glass-dark-line, rgba(255,255,255,.18))',
          // 🌗 A literal, on purpose: the plaque is DARK GLASS in both themes, so its words
          // stay light in both. `--sn-gold-100` is the gold WASH, which goes dark (#413827)
          // under html.dark — it painted the plaque's name dark-on-dark (dark B1, 2026-10-23).
          color: '#F3ECDF',
          outlineColor: 'var(--sn-gold-500, #CBA766)',
        }}
      >
        <span
          className="flex h-9 w-9 flex-none items-center justify-center overflow-hidden rounded-xl text-[11px] font-extrabold"
          style={{
            background: 'linear-gradient(135deg, #8a6b39, #5a3b28)',
            border: '1.5px solid rgba(255,255,255,.35)',
            color: '#FFFDF8',
          }}
        >
          {chip}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-extrabold tracking-[-0.01em]">
            {title}
          </span>
          {metaLine ? (
            <span
              className="mt-0.5 block truncate font-mono text-[9px] uppercase tracking-[0.1em]"
              style={{ color: 'rgba(243,236,223,.6)' }}
            >
              {metaLine}
            </span>
          ) : null}
        </span>
        {/* Menu affordance — load-bearing, not polish: a name-card that is
            secretly a button is undiscoverable without it. */}
        <ChevronDown
          aria-hidden
          className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          strokeWidth={2}
          style={{ color: 'rgba(243,236,223,.55)' }}
        />
      </button>

      {/* Collapsed 64px rail — avatar icon trigger, same open state + panel. */}
      <span className="hidden justify-center [[data-sidebar-collapsed='1']_&]:flex">
        <AccountSwitcherIconTrigger
          data={data}
          open={open}
          onToggle={() => setOpen((v) => !v)}
        />
      </span>

      {open && mounted && typeof document !== 'undefined'
        ? createPortal(
            <>
              <button
                type="button"
                aria-label="Close account menu"
                onClick={close}
                className="fixed inset-0 z-[51] bg-ink/40 backdrop-blur-[2px]"
                style={{ animation: 'sn-switcher-backdrop 0.3s ease' }}
              />
              <style>{`
                @keyframes sn-switcher-backdrop { from { opacity:0; } to { opacity:1; } }
                @keyframes sn-switcher-drawer-in { from { transform:translateX(-100%); } to { transform:translateX(0); } }
              `}</style>
              <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label="Account menu"
                className="focus:outline-none fixed inset-y-0 left-0 z-[52] flex w-[calc(20rem+var(--sn-safe-l))] flex-col pl-[var(--sn-safe-l)] pt-3 overflow-hidden rounded-r-2xl border-r border-ink/10 sn-sheet shadow-2xl"
                style={{ animation: 'sn-switcher-drawer-in 0.3s ease' }}
              >
                <SwitcherPanelBody data={data} close={close} />
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}
