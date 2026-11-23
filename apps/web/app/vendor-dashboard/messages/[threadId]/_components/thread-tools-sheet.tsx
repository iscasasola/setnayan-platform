'use client';

import { CHAT_ATTACH_INPUT_ID, CHAT_CAMERA_INPUT_ID, CHAT_PHOTO_INPUT_ID } from '@/lib/chat-attach-input-id';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  BadgeCheck,
  CakeSlice,
  Camera,
  ChevronRight,
  ImageIcon,
  CalendarPlus,
  Handshake,
  History,
  Lock,
  Plus,
  Shapes,
  Star,
  Store,
  type LucideIcon,
} from 'lucide-react';
import { sendChatMessage } from '@/lib/chat-actions';
import { CHAT_SENT_AS_FIELD } from '@/lib/chat-sent-as';
import { SHARE_NONE_YET, SHARE_READ_FAILED, SHARE_ROW_LABEL, SHARE_SEND_FAILED, TOOL_SHARE_WORDS, toolShareBody, type ShareableTool } from '@/lib/chat-tool-share';
import type { ShareableRead } from '@/lib/chat-tool-share-held';
import { routes } from '@/lib/routes';
import { toolIcon } from '@/app/vendor-dashboard/shop/_components/specialized-tool-icon';
import { Sheet } from '@/app/_components/sheet';
import { layerHolder } from '@/lib/use-back-closes';
import { InfoTip } from '@/app/_components/info-tip';
import { ActionButton } from '@/components/action-button';
import { revealThreadTool } from '@/app/_components/chat/reveal-thread-tool';
import {
  THREAD_TOOL_GROUPS,
  type ThreadToolGroup,
  type VendorThreadLinkTool,
  type VendorThreadToolIcon,
  type VendorThreadToolsState,
} from '@/lib/vendor-thread-tools';
import { VENDOR_THREAD_TOOLS } from '@/lib/vendor-thread-tools';
import { coupleThreadTools } from '@/lib/chat-box-tools';
import { NEGOTIATE_GROUP, PLUS_ROW_PAGE, PLUS_ROW_SECTION, PLUS_SECTION_WORD, PLUS_TRAY_UNVERIFIED, PLUS_TRAY_UNVERIFIED_CTA, PLUS_TRAY_VERIFY_HREF, PLUS_TRAY_WORD, hostPlusRows, sheetSlashRows, supplierPlusRows, type PlusGroup, type PlusRow, type PlusSection, type PlusTrayGroup } from '@/lib/chat-plus';
import { raiseDeal } from '@/lib/chat-kind-store';
import { PLUS_DRAFT_ANCHOR, jumpTo, patchPlus, usePlus } from '@/lib/chat-plus-store';
import { TOPIC_ICON } from '@/lib/topic-icons';
import { PLUS_CARD_TOPIC, RISING_DRAFTS } from '@/lib/chat-plus';
import { useIsDesktop } from '@/lib/use-responsive';
import { pickedPageLabel } from '@/app/vendor-dashboard/clients/[eventId]/_components/picked-client-menu';
import { CAKE_TILE_LINES, CAKE_TILE_WORDS, CakeDesignerFromPlus, askForCakeDesign, useCakeTile } from '@/app/_components/cake-maker/cake-plus';

/**
 * THE ＋ BESIDE THE MESSAGE FIELD — and the ONE sheet of every tool the conversation has (simpler supplier dashboard,
 * step 4, 2026-10-14; prototype `supplier_easy_dashboard_2026-10-14_fable.html` · composer `data-sheet="tools"` and
 * `SHEETS.tools`).
 *
 * ── WHAT IT REPLACES ────────────────────────────────────────────────────────────────────────────────────────────────
 * The conversation's tools had two scattered doors: the customer rail's "Tools" column (a desktop column + a mobile
 * "Tools" sheet) and the composer's 🧾 / 📞 icons. Owner on the completeness pass: "how tools gets accessed on chat?"
 * → one obvious door. This is it: a GREY ＋ (Send stays the one main), a sheet listing every row of
 * `VENDOR_THREAD_TOOLS`, each opening the SAME panel or page as before, which posts the SAME server action.
 *
 * ── HOW A ROW OPENS ─────────────────────────────────────────────────────────────────────────────────────────────────
 *   reveal  close the sheet, THEN open the panel in the frame's tray (`revealThreadTool`) — a panel opened behind a
 *           sheet the supplier is still looking at reads as a dead button (the rail learned this, 2026-09-08)
 *   link    a plain link to the shipped page (literal hrefs here, never composed in the registry — see its note)
 *   attach  the composer's own file input (`CHAT_ATTACH_INPUT_ID`), clicked inside the tap so a phone allows it
 *   shut    drawn, greyed, with the reason — never hidden (owner B2, "hide nothing, say why")
 *
 * Portalled to `document.body`: the dashboard's page wrapper keeps a transform, which makes it the containing block
 * for a `position: fixed` sheet drawn inside it.
 */

// 🔣 One icon per topic (Build 3 · lane B): a row about a topic wears that topic's glyph from `TOPIC_ICON`.
const ICON: Record<VendorThreadToolIcon, LucideIcon> = {
  quote: TOPIC_ICON.quote,
  answer: Handshake,
  payment: TOPIC_ICON.payment,
  confirm: BadgeCheck,
  schedule: TOPIC_ICON.schedule,
  file: TOPIC_ICON.files,
  offer: Store,
  deal: CalendarPlus,
  guests: TOPIC_ICON.details,
  outcome: Star,
  problem: TOPIC_ICON.report,
  questions: TOPIC_ICON.forms,
};

/** 📷 · 🖼 The composer's two shortcuts live inside the (+) (v8.3) — since 11 Nov as rows of `lib/chat-plus.ts`, under Files. */
type SheetIcon = VendorThreadToolIcon | 'camera' | 'photo' | 'history' | 'tools';
const SHEET_ICON: Record<SheetIcon, LucideIcon> = { ...ICON, camera: Camera, photo: ImageIcon, history: History, tools: Shapes };
const ATTACH_INPUT: Record<'file' | 'camera' | 'photo', string> = {
  file: CHAT_ATTACH_INPUT_ID,
  camera: CHAT_CAMERA_INPUT_ID,
  photo: CHAT_PHOTO_INPUT_ID,
};

/** Each off-screen destination, written out where `lint-port-no-lost-controls` reads this route's doors. */
function linkHref(tool: VendorThreadLinkTool, eventId: string): string {
  switch (tool.link) {
    case 'client-schedule':
      return `/vendor-dashboard/clients/${eventId}?tab=schedule`;
    case 'client-payments':
      return `/vendor-dashboard/clients/${eventId}?tab=quote`;
    case 'disputes':
      return '/vendor-dashboard/disputes';
    default: {
      const unhandled: never = tool.link;
      return unhandled;
    }
  }
}

/** One row as the sheet draws it — the supplier's registry rows and the couple's rows both come down to this. */
export type SheetRow = {
  key: string;
  label: string;
  line: string;
  icon: SheetIcon;
  primary?: boolean;
  group?: ThreadToolGroup;
  shut: { reason: string } | null;
  href?: string;
  reveal?: readonly string[];
  /** `true` / 'file' → the paperclip's input; 'camera' / 'photo' → the composer's shortcut inputs. */
  attach?: boolean | 'file' | 'camera' | 'photo';
  /** Build 3 — the row drops this card into the chat (one at a time) instead of opening a tool. */
  card?: PlusRow['card'];
  /**
   * 🧭 The picked client's page this row belongs to (owner 11 Nov — the (+) mirrors the menu). Where it changes, the
   * sheet draws that tab's word as a quiet labelled rule above the row: the divider between topics IS the label.
   * 🤝 'negotiate' (12 Nov) is the one group above the mirror — drawn first, labelled NEGOTIATE.
   */
  page?: PlusGroup;
  /**
   * 💬 The supplier's plain group (19 Nov 2026 — the client page is one chat, so no tab names a group): Negotiate ·
   * Ask & decide · Money · Dates · Files, and Report a problem under a bare line. Where set, it heads the row instead
   * of `page`'s tab word.
   */
  section?: PlusSection;
  /** ＋ FINAL (21 Nov): spans both columns (the first tile; the last when it would sit alone). */
  wide?: boolean;
  /** ＋ FINAL: the host's two jobs — the tile sits under its group's word (Ask · Share). */
  tray?: PlusTrayGroup;
  /** ＋ FINAL: Every version — raises the chat's versions sheet (`raiseDeal`). */
  opensVersions?: boolean;
  /** 🧰 Share from your tools — opens the tray's second level, the picker of the tools this shop has. */
  opensTools?: boolean;
  /** The drawing's "New" mark beside the name. */
  isNew?: boolean;
};

/**
 * THE ＋ AND ITS SHEET, drawn once for both sides (chat prototype 2026-10-28, frames C and D). Rows have no frames — the
 * icon round and the words (frames only on what you press: the row itself is the press).
 *
 * 🔲 SINCE 20 NOV 2026 THE ROWS ARE TILES (Unichat part B; approved drawing `UNICHAT-LIVE-2026-11-19.html`, "(+) picker:
 * tiles"): two across, a round icon and the row's own words, no heading between groups (the drawing has none). The
 * tiles still come down in the order `lib/chat-plus.ts` gives — the supplier's plain groups, the host's menu order —
 * and each wears its group (`data-plus-group`). A registry `group` heading (Money · Plan · Talk & files · Just you) is
 * still drawn for a row that carries one. On a computer the tiles are the chat's third column, not a sheet.
 */
const SHORTCUT_ROWS: readonly SheetRow[] = [
  { key: 'camera', label: 'Camera', line: 'Take a photo or a video now', icon: 'camera', shut: null, attach: 'camera', page: 'files' },
  { key: 'photo', label: 'Photo', line: 'A photo or a video from your phone', icon: 'photo', shut: null, attach: 'photo', page: 'files' },
];

/**
 * The group a tile belongs to: the supplier's plain group, else the tab its page mirrors (the host's). Since the tiles
 * (20 Nov 2026) no heading is DRAWN — the approved drawing has none — but the tiles still come down group by group, and
 * each wears its group (`data-plus-group`) so the order can be read off the page.
 */
function headOf(row: SheetRow): { key: string; word: string | null } | null {
  if (row.section) return { key: row.section, word: PLUS_SECTION_WORD[row.section] };
  if (row.page) return { key: row.page, word: row.page === NEGOTIATE_GROUP ? 'Negotiate' : pickedPageLabel(row.page) };
  return null;
}

/**
 * ⏭ CHAT-20 (walk 16 Nov 2026) — "See every version" and "Report a problem" opened NOTHING. The sheet holds a history
 * entry of its own (`useBackCloses`: Back closes the layer), and a sheet closed by its owner steps back through that
 * entry one tick later. Anything the row opened in that same tick was undone by the step: the versions sheet claimed
 * the entry and was then closed by the `popstate`; the Report link's `router.push` (pending until its page arrived) was
 * overtaken by the traversal. So a row that LEAVES the sheet for another layer or page waits until the sheet's own
 * entry is gone — the `popstate` of its step back — and only then opens what it names. No entry of ours on top (a lab,
 * an older sheet) = go at once.
 */
export function afterSheetStepsBack(fn: () => void, holdsEntry: boolean = Boolean(layerHolder(window.history.state))): void {
  if (!holdsEntry) {
    window.setTimeout(fn, 0);
    return;
  }
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    window.removeEventListener('popstate', go);
    window.clearTimeout(safety);
    // After the router's own popstate handling, so the traversal has settled before we navigate or open.
    window.setTimeout(fn, 0);
  };
  window.addEventListener('popstate', go);
  // Never stranded: a step back that never comes (a browser that coalesces it) still opens the row.
  const safety = window.setTimeout(go, 1200);
}

export function ToolsSheetButton({
  rows,
  sheetMark,
  threadId,
  cake,
  unverified = false,
  share,
}: {
  rows: readonly SheetRow[];
  sheetMark: string;
  threadId?: string;
  /**
   * 🧰 The tools this shop may share here (`readShareableTools`, read once by the page) — the "Share from your tools"
   * picker lists ONLY these. `null` = they could not be read (the picker says so, never an empty "none").
   */
  share?: ShareableRead | null;
  /**
   * 🎂 Cake Maker v6 — the side whose cake tile this ＋ may draw: the couple's "Design a cake" (full width, at the end of
   * Ask) or the supplier's For your service › "Ask for a cake design". Drawn only when this chat's shop has it on.
   */
  cake?: 'couple' | 'vendor';
  /** 🪪 ＋ FINAL: the shop is not verified — every tile is locked and the fix is said ONCE, at the top. */
  unverified?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const cakeOn = useCakeTile(cake ? threadId : undefined, cake ?? 'couple');
  const [cakeOpen, setCakeOpen] = useState(false);
  // The supplier's second level (For your service) and the invite's own state.
  const [level, setLevel] = useState<'top' | 'service' | 'tools'>('top');
  const [ask, setAsk] = useState<{ s: 'idle' | 'sending' } | { s: 'failed'; message: string }>({ s: 'idle' });
  // 🧰 The share picker's own state: which tool is being posted, or the plain reason it was not.
  const [sharing, setSharing] = useState<{ s: 'idle' } | { s: 'sending'; tool: ShareableTool } | { s: 'failed' }>({ s: 'idle' });
  const router = useRouter();
  const plus = usePlus(threadId ?? '');
  /* 🧰 ＋ ⇄ ← (Unichat part B, 20 Nov 2026 — approved drawing: "The + turns into ←. Tap it to go back; your text
     stays"). While a tool is open in the text box — or, on a computer, while the tiles or the tool hold the third
     column — this button is the way back to the plain message box. SEVERAL CARDS MAY BE OPEN AT ONCE since that
     approval (it supersedes the 8 Nov "one (+) at a time"): a card that waits for its answer no longer shuts the (+). */
  const wide = useIsDesktop();
  const toolOpen = Boolean(plus.inBox && plus.host && plus.draft && !RISING_DRAFTS.has(plus.draft.kind));
  // 🖥 On a computer the tiles are the third column (the composer owns the column and hands over where to draw them).
  const pickerOpen = wide && plus.inBox && plus.picker;
  const back = toolOpen || pickerOpen;
  const close = () => {
    setOpen(false);
    setLevel('top');
    if (threadId && plus.picker) patchPlus(threadId, { picker: false });
  };
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const headingId = useId();
  // ⌨ THE SLASH LIST IS THIS SHEET'S OWN CARD ROWS (owner 11 Nov: "/" shortcuts) — published for the composer, so a
  // typed "/poll" can never offer a row the (+) does not, nor drop one the (+) has greyed.
  const slash = sheetSlashRows(rows);
  const slashSig = JSON.stringify(slash);
  useEffect(() => {
    if (threadId) patchPlus(threadId, { slash: JSON.parse(slashSig) });
  }, [threadId, slashSig]);

  /* 🔲 TILES (approved drawing, "(+) picker: tiles"): two across, each a round icon in its topic's glyph and the row's
     own words. A shut tile is drawn, never hidden — greyed, with a lock and its reason under the name. */
  const tileClass = 'flex min-h-[56px] w-full min-w-0 items-center gap-2 rounded-2xl bg-[color:var(--m-paper-2)] py-2 pl-2 pr-3 text-left';
  const items: ReactNode[] = [];
  let lastGroup: ThreadToolGroup | undefined;
  let lastTray: PlusTrayGroup | undefined;
  /* 🖥 On a computer the same grid sits in the third column; the extra room goes to one helping line per tile (＋ FINAL). */
  const helping = pickerOpen;
  if (unverified) {
    items.push(
      <li key="unverified" className="col-span-2 flex items-center gap-2 rounded-2xl bg-[color:var(--m-paper-2)] px-3 py-2.5" data-plus-unverified="">
        <Lock aria-hidden className="h-4 w-4 shrink-0 text-[color:var(--m-slate-3)]" strokeWidth={1.9} />
        <span className="min-w-0 flex-1 text-[13px] leading-tight text-ink">{PLUS_TRAY_UNVERIFIED}</span>
        <Link href={PLUS_TRAY_VERIFY_HREF} className="sn-press shrink-0 text-[13px] font-bold text-sn-accent" data-plus-get-verified="">
          {PLUS_TRAY_UNVERIFIED_CTA}
        </Link>
      </li>,
    );
  }
  for (const row of rows) {
    const group = headOf(row)?.key;
    // ＋ FINAL: the host's two jobs wear their own word — Ask · Share (the one place group words stay).
    if (row.tray && row.tray !== lastTray) {
      items.push(
        <li key={`tray-${row.tray}`} aria-hidden className="col-span-2 pt-1 text-[12px] font-bold text-[color:var(--m-slate-2)]" data-plus-tray={row.tray}>
          {PLUS_TRAY_WORD[row.tray]}
        </li>,
      );
      lastTray = row.tray;
    }
    // A row that still carries a registry group (Money · Plan · Talk & files · Just you) keeps its word, across both tiles.
    if (row.group && row.group !== lastGroup) {
      const g = THREAD_TOOL_GROUPS.find((x) => x.key === row.group);
      items.push(
        <li key={`group-${row.group}`} aria-hidden className="col-span-2 pt-1 text-[11.5px] font-bold uppercase tracking-[0.1em] text-[color:var(--m-slate-2)]" data-thread-tool-group={row.group}>
          {g?.label}
        </li>,
      );
      lastGroup = row.group;
    }
    const Icon = row.card ? TOPIC_ICON[PLUS_CARD_TOPIC[row.card]] : SHEET_ICON[row.icon];
    const shut = row.shut;
    const span = row.wide ? 'col-span-2' : undefined;
    const lead = (
      <span
        aria-hidden
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
          shut ? 'bg-[color:var(--m-paper)] text-[color:var(--m-slate-4)]' : row.primary ? 'bg-sn-accent/10 text-sn-accent' : 'bg-[color:var(--m-paper)] text-sn-accent'
        }`}
      >
        <Icon className="h-[17px] w-[17px]" strokeWidth={1.75} />
      </span>
    );
    if (shut) {
      const reasonId = `${headingId}-shut-${row.key}`;
      items.push(
        <li key={row.key} data-thread-tool-row={row.key} data-plus-group={group} data-shut="" data-plus-wide={row.wide ? '' : undefined} className={span}>
          <span role="button" aria-disabled="true" aria-describedby={reasonId} tabIndex={0} aria-label={`${row.label} — ${shut.reason}`} className={tileClass}>
            {lead}
            <span className="min-w-0 flex-1">
              {/* Shut = the mid grey, at 13 px or larger only (rule 13). */}
              <span className="block truncate text-[14px] font-bold leading-tight text-[color:var(--m-slate-3)]">{row.label}</span>
              {/* 🪪 Unverified: the fix is said ONCE at the top of the tray, so the tile shows only its lock. */}
              <span id={reasonId} className={unverified ? 'sr-only' : 'mt-0.5 block truncate text-[13px] leading-tight text-[color:var(--m-slate-3)]'}>
                {shut.reason}
              </span>
            </span>
            <Lock aria-hidden className="h-4 w-4 shrink-0 text-[color:var(--m-slate-3)]" strokeWidth={1.9} />
          </span>
        </li>,
      );
      continue;
    }
    const words = (
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sn-base font-bold leading-tight text-ink">
          <span className="min-w-0">{row.label}</span>
          {row.isNew ? (
            <span className="shrink-0 rounded-full bg-sn-accent px-1.5 py-px text-sn-2xs font-bold text-sn-on-accent" data-plus-new="">
              New
            </span>
          ) : null}
        </span>
        {helping ? <span className="mt-0.5 block text-[13px] leading-tight text-[color:var(--m-slate-2)]">{row.line}</span> : null}
      </span>
    );
    items.push(
      <li key={row.key} data-thread-tool-row={row.key} data-plus-group={group} data-plus-wide={row.wide ? '' : undefined} className={span}>
        {row.href ? (
          <Link
            href={row.href}
            title={row.line}
            className={`sn-press ${tileClass}`}
            onClick={(e) => {
              // A new tab / window keeps the browser's own way; this tab waits for the sheet's step back (CHAT-20).
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
              e.preventDefault();
              const href = row.href!;
              const holds = open && Boolean(layerHolder(window.history.state));
              close();
              afterSheetStepsBack(() => router.push(href), holds);
            }}
          >
            {lead}
            {words}
          </Link>
        ) : (
          <button
            type="button"
            title={row.line}
            className={`sn-press ${tileClass}`}
            onClick={() => {
              if (row.opensTools) {
                // 🧰 The tray's second level: the tools this shop has. The sheet (or the third column) stays open.
                setSharing({ s: 'idle' });
                setLevel('tools');
                return;
              }
              if (row.opensVersions && threadId) {
                // Every version is a place to go: the chat raises its own versions sheet once the tray is away.
                const holds = open && Boolean(layerHolder(window.history.state));
                close();
                afterSheetStepsBack(() => raiseDeal(threadId), holds);
                return;
              }
              if (row.card && threadId) {
                const holds = open && Boolean(layerHolder(window.history.state));
                setOpen(false);
                // The tile becomes the tool: in the text box (a phone) or in the same third column (a computer).
                patchPlus(threadId, { draft: { kind: row.card, startedAt: Date.now() }, picker: false });
                // ⤴ A poll or decision rises full screen (CHAT-09); a card the composer holds is already in the thumb
                // zone. Only a card drawn at the foot of the conversation is brought into view.
                if (!RISING_DRAFTS.has(row.card) && !plus.inBox) {
                  window.setTimeout(() => jumpTo(PLUS_DRAFT_ANCHOR), 60);
                  // 📍 CHAT-25: the sheet's step back is a history traversal, and the browser restores the PAGE's scroll
                  // on it — which put the couple's new card back below the screen. Jump again once it has settled.
                  afterSheetStepsBack(() => jumpTo(PLUS_DRAFT_ANCHOR), holds);
                }
                return;
              }
              if (row.attach) {
                // Inside the tap: a phone only opens a file picker from a user gesture.
                document.getElementById(ATTACH_INPUT[row.attach === true ? 'file' : row.attach])?.click();
                close();
                return;
              }
              const holds = open && Boolean(layerHolder(window.history.state));
              close();
              // After the sheet has gone — and its history step with it (CHAT-20) — so the opened panel stays open.
              const reveal = row.reveal;
              if (reveal) afterSheetStepsBack(() => revealThreadTool(reveal), holds);
            }}
          >
            {lead}
            {words}
          </button>
        )}
      </li>,
    );
  }
  // 🎂 The Cake Maker's tile (v6) — only when this chat's shop has its Cake Maker on.
  const cakeLead = (
    <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[color:var(--m-paper)] text-sn-accent">
      <CakeSlice className="h-[17px] w-[17px]" strokeWidth={1.75} />
    </span>
  );
  if (cakeOn && threadId && cake === 'couple') {
    // Full width, at the end of Ask: right before the first Share (files) tile, else last.
    const at = items.findIndex((it) => (it as { props?: { 'data-plus-group'?: string } })?.props?.['data-plus-group'] === 'files');
    const tile = (
      <li key="cake-design" data-thread-tool-row="cake-design" data-cake-plus="couple" className="col-span-2">
        <button
          type="button"
          title={CAKE_TILE_LINES.couple}
          className={`sn-press ${tileClass}`}
          onClick={() => {
            const holds = open && Boolean(layerHolder(window.history.state));
            close();
            // After the sheet's own history step has gone (CHAT-20), so the designer's layer stays open.
            afterSheetStepsBack(() => setCakeOpen(true), holds);
          }}
        >
          {cakeLead}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-bold leading-tight text-ink">{CAKE_TILE_WORDS.couple}</span>
            <span className="mt-0.5 block truncate text-[13px] leading-tight text-[color:var(--m-slate-2)]">{CAKE_TILE_LINES.couple}</span>
          </span>
        </button>
      </li>
    );
    if (at < 0) items.push(tile);
    else items.splice(at, 0, tile);
  }
  if (cakeOn && threadId && cake === 'vendor') {
    items.push(
      <li key="for-your-service" data-thread-tool-row="for-your-service" data-cake-plus="service">
        <button type="button" title="Asks only your shop can make" className={`sn-press ${tileClass}`} onClick={() => setLevel('service')}>
          {cakeLead}
          <span className="min-w-0 flex-1 text-[14px] font-bold leading-tight text-ink">For your service</span>
          <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-[color:var(--m-slate-2)]" strokeWidth={1.9} />
        </button>
      </li>,
    );
  }
  // 🎂 For your service — the supplier's second level: Ask for a cake design posts the invite card.
  const serviceLevel =
    cakeOn && threadId && cake === 'vendor' ? (
      <div data-plus-level="service">
        <button type="button" onClick={() => setLevel('top')} className="sn-press -ml-1 mb-2 inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-[14px] font-semibold text-ink">
          <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={2} />
          For your service
        </button>
        <ul className="grid grid-cols-2 gap-2">
          <li data-thread-tool-row="cake-ask" data-cake-plus="vendor" className="col-span-2">
            <button
              type="button"
              aria-busy={ask.s === 'sending' || undefined}
              title={CAKE_TILE_LINES.vendor}
              className={`sn-press ${tileClass}`}
              onClick={async () => {
                if (ask.s === 'sending') return;
                setAsk({ s: 'sending' });
                const failed = await askForCakeDesign(threadId);
                if (failed) {
                  setAsk({ s: 'failed', message: failed });
                  return;
                }
                setAsk({ s: 'idle' });
                close();
                // one-render: keep (no-revalidate) — the cake op revalidates nothing; the posted invite card must appear.
                router.refresh();
              }}
            >
              {cakeLead}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-bold leading-tight text-ink">{CAKE_TILE_WORDS.vendor}</span>
                <span className="mt-0.5 block truncate text-[13px] leading-tight text-[color:var(--m-slate-2)]">
                  {ask.s === 'sending' ? 'Sending…' : CAKE_TILE_LINES.vendor}
                </span>
              </span>
            </button>
          </li>
        </ul>
        {ask.s === 'failed' ? (
          <p role="alert" className="mt-2 text-[13px] text-danger-700" data-cake-ask-failed="">
            {ask.message}
          </p>
        ) : null}
      </div>
    ) : null;
  // 🧰 Share from your tools — the second level (drawing frame 7, "The picker"): ONLY the tools this shop has, in the
  // drawing's order. A pick posts its card through the shipped send, as the shop (`sent_as=vendor`); the server checks
  // the shop holds that tool. Nothing held → said, with the way to the Store; an unread list → said, never "none".
  const shareTools = share?.tools ?? [];
  const toolsLevel = (
    <div data-plus-level="tools">
      <button type="button" onClick={() => setLevel('top')} className="sn-press -ml-1 mb-2 inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-sn-base font-semibold text-ink">
        <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={2} />
        {SHARE_ROW_LABEL}
      </button>
      {shareTools.length > 0 ? (
        <ul className="grid gap-2" data-share-tools="">
          {shareTools.map((tool) => {
            const w = TOOL_SHARE_WORDS[tool];
            const Icon = toolIcon(tool);
            const busy = sharing.s === 'sending' && sharing.tool === tool;
            return (
              <li key={tool} data-share-tool={tool}>
                <button
                  type="button"
                  aria-busy={busy || undefined}
                  title={w.pickLine}
                  className={`sn-press ${tileClass}`}
                  onClick={async () => {
                    if (sharing.s === 'sending' || !threadId) return;
                    setSharing({ s: 'sending', tool });
                    const fd = new FormData();
                    fd.set('thread_id', threadId);
                    fd.set('body', toolShareBody(tool));
                    fd.set(CHAT_SENT_AS_FIELD, 'vendor');
                    try {
                      await sendChatMessage(fd);
                    } catch {
                      setSharing({ s: 'failed' });
                      return;
                    }
                    setSharing({ s: 'idle' });
                    close();
                    // one-render: keep (no-revalidate) — the send without return_to revalidates nothing; the card must appear.
                    router.refresh();
                  }}
                >
                  <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[color:var(--m-paper)] text-sn-accent">
                    <Icon className="h-[17px] w-[17px]" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sn-base font-bold leading-tight text-ink">{w.tool}</span>
                    <span className="mt-0.5 block truncate text-sn-md leading-tight text-[color:var(--m-slate-2)]">{busy ? 'Sharing…' : w.pickLine}</span>
                  </span>
                  <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-[color:var(--m-slate-2)]" strokeWidth={1.9} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {share == null || share.unread ? (
        <p role="status" className="mt-2 flex flex-wrap items-center gap-2 text-sn-md text-ink" data-share-unread="">
          <span>{SHARE_READ_FAILED}</span>
          <button type="button" className="sn-press min-h-11 font-bold text-sn-accent" onClick={() => router.refresh()} data-share-retry="">
            Try again
          </button>
        </p>
      ) : shareTools.length === 0 ? (
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sn-md text-ink" data-share-none="">
          <span>{SHARE_NONE_YET}</span>
          <Link href={routes.vendorDashboard.shop.store.shelf('tools')} className="sn-press inline-flex min-h-11 items-center font-bold text-sn-accent" data-share-store="">
            Open the Store
          </Link>
        </p>
      ) : null}
      {sharing.s === 'failed' ? (
        <p role="alert" className="mt-2 text-sn-md text-danger-700" data-share-failed="">
          {SHARE_SEND_FAILED}
        </p>
      ) : null}
    </div>
  );
  const tiles =
    level === 'tools' ? (
      toolsLevel
    ) : level === 'service' && serviceLevel ? (
      serviceLevel
    ) : (
      <ul className="grid grid-cols-2 gap-2" data-plus-tiles="">
        {items}
      </ul>
    );

  const sheet = (
    <Sheet open={open} onClose={() => { setOpen(false); setLevel('top'); }} labelledById={headingId} rise>
      <div className="px-4 pb-5 pt-5" data-thread-tools-sheet={sheetMark}>
        {/* ⓘ beside the title (house rule: title + one line visible, the rest in the ⓘ); `pr-12` keeps clear of the ✕. */}
        <InfoTip label="Add to chat" labelAs="h2" labelId={headingId} labelClassName="text-[17px] font-semibold text-ink" align="start" className="pr-12">
          Pick one and the text box becomes that tool. Fill it there, then send. The arrow takes you back to your message.
        </InfoTip>
        <div className="mt-3">{pickerOpen ? null : tiles}</div>
      </div>
    </Sheet>
  );

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          if (back) {
            // ← Back to the message: the tool (or the tiles) goes; what was typed is still in the box.
            if (threadId) patchPlus(threadId, { draft: toolOpen ? null : plus.draft, picker: false, toast: null });
            return;
          }
          // 🖥 A computer, inside the chat's own frame, with a composer that holds the tool → the third column.
          if (wide && plus.inBox && threadId && e.currentTarget.closest('[data-chat-box]')) patchPlus(threadId, { picker: true });
          else setOpen(true);
        }}
        aria-label={back ? 'Back to message' : 'Add to the chat'}
        aria-haspopup="dialog"
        title={back ? 'Back to message' : 'Add to the chat'}
        data-thread-tools-open=""
        data-plus-back={back ? '' : undefined}
        // ＋ v8.3: a FILLED 40-px circle — the brand fill with its own ink for the ＋. As ← it is quiet (the tool is the
        // main thing on screen). The 44-px target is the button; the circle is drawn inside it.
        className="sn-press sn-chat-plus inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
      >
        <span
          aria-hidden
          data-plus-circle=""
          className={`relative grid h-10 w-10 place-items-center rounded-full ${back ? 'bg-transparent text-ink' : 'bg-sn-accent text-sn-on-accent'}`}
        >
          <Plus aria-hidden className="sn-chat-plus-a h-5 w-5" strokeWidth={2.2} />
          <ArrowLeft aria-hidden className="sn-chat-plus-b h-5 w-5" strokeWidth={2.2} />
        </span>
      </button>
      {mounted ? createPortal(sheet, document.body) : null}
      {/* 🖥 The tiles in the third column — drawn where the composer says (`tilesSlot`), by the (+) that owns the rows. */}
      {mounted && pickerOpen && plus.tilesSlot ? createPortal(tiles, plus.tilesSlot) : null}
      {cakeOpen && threadId ? <CakeDesignerFromPlus threadId={threadId} onClose={() => setCakeOpen(false)} /> : null}
    </>
  );
}

/**
 * WHERE A CARD'S FULL PAGE IS — the shipped tool behind each (+) card (its "door"). The supplier's doors are keys of
 * `VENDOR_THREAD_TOOLS`, so every shipped panel is still reached; the host's are their own pages. Literal hrefs live
 * here (`lint-port-no-lost-controls` reads this route's doors).
 */
export type PlusDoor = { href?: string; reveal?: readonly string[]; attach?: boolean } | null;

export function plusDoor(side: 'vendor' | 'couple', door: string | null, eventId: string): PlusDoor {
  if (!door) return null;
  if (side === 'couple') {
    switch (door) {
      case 'deal-or-meeting':
        return { reveal: ['deal-or-meeting'] };
      case 'share-file':
        return { attach: true };
      case 'host-payments':
        return { href: `/dashboard/${eventId}/budget` };
      case 'host-report':
        return { href: `/dashboard/${eventId}/disputes` };
      default:
        return null;
    }
  }
  const tool = VENDOR_THREAD_TOOLS.find((t) => t.key === door);
  if (!tool) return null;
  if (tool.link) return { href: linkHref(tool, eventId) };
  if (tool.attach) return { attach: true };
  return { reveal: tool.reveal };
}

/** Open a door — the same three ways a sheet row always opened its tool. */
export function openPlusDoor(d: NonNullable<PlusDoor>): void {
  if (d.attach) {
    document.getElementById(CHAT_ATTACH_INPUT_ID)?.click();
    return;
  }
  if (d.reveal) revealThreadTool(d.reveal);
}

function plusSheetRows(rows: PlusRow[], side: 'vendor' | 'couple', eventId: string, hasAgreement: boolean): SheetRow[] {
  return rows.map((r) => {
    const d = r.card ? null : plusDoor(side, r.door, eventId);
    return {
      key: r.key,
      label: r.label,
      line: r.line,
      // A card wears its topic's glyph (above); a row that is not a card wears its own: the camera, the photo, the flag.
      icon: r.key === 'camera' ? 'camera' : r.key === 'photo' ? 'photo' : r.key === 'report' ? 'problem' : r.key === 'quote' ? 'quote' : r.key === 'versions' ? 'history' : r.key === 'share' ? 'tools' : 'file',
      shut: r.shutNow ?? (r.shutUntilAgreement && !hasAgreement ? r.shutUntilAgreement : null),
      card: r.card,
      href: d?.href,
      reveal: d?.reveal,
      // The row's own composer input (Camera · Photo) beats a door's paperclip.
      attach: r.attach ?? d?.attach,
      page: PLUS_ROW_PAGE[r.key],
      // 💬 The supplier's sheet is grouped by plain words (19 Nov 2026); the host's still mirrors its tabs.
      ...(side === 'vendor' ? { section: PLUS_ROW_SECTION[r.key] } : {}),
      // 🤝 Negotiate's rows wear the brand round (the design's `pri`) — the money moves of this chat.
      primary: PLUS_ROW_PAGE[r.key] === NEGOTIATE_GROUP,
      wide: r.wide,
      tray: r.tray,
      opensVersions: r.opensVersions,
      opensTools: r.opensTools,
      isNew: r.isNew,
    };
  });
}

/**
 * THE SUPPLIER'S (+) — Supplier Build 3 (owner 8 Nov, 📌), in the menu's order since 11 Nov: Decision · Ask for access ·
 * Quote · Payment · Form · Meeting · Camera · Photos & files · Report a problem (last). What the app detects pins itself
 * instead (`lib/chat-pins.ts`).
 */
export function ThreadToolsSheet({
  eventId,
  state,
  threadId,
  paid = false,
  hasQuote,
  verified = null,
  share = null,
}: {
  eventId: string;
  state: VendorThreadToolsState;
  threadId?: string;
  /** A payment is confirmed on the quote — Quote reads "Change quote" (the paid total is the floor). */
  paid?: boolean;
  /**
   * 🧾 A quote is in this chat (`threadHasQuote`, the composer's 🧾 rung). `false` → "Send a quote" opens the builder and
   * "See every version" is not drawn (walk 13 Nov 2026). Omitted keeps "Change quote".
   */
  hasQuote?: boolean;
  /** 🪪 ＋ FINAL: `false` = the shop is not verified (every tile locked, "Get verified" said once). Null = unknown. */
  verified?: boolean | null;
  /** 🧰 The tools this shop may share here (`readShareableTools`); null = could not be read. */
  share?: ShareableRead | null;
}) {
  // 🗳 One open poll per chat: the stream's poll card tells the store; the Poll row goes grey with its reason.
  const { pollOpen } = usePlus(threadId ?? '');
  const rows = plusSheetRows(supplierPlusRows({ paid, pollOpen, hasQuote, booked: state.hasAgreement, verified }), 'vendor', eventId, state.hasAgreement);
  // 🪪 An unverified shop has every ＋ tile locked (＋ FINAL) — it is not handed the cake tile either.
  return <ToolsSheetButton rows={rows} sheetMark="vendor" threadId={threadId} cake={verified === false ? undefined : 'vendor'} unverified={verified === false} share={share} />;
}

/**
 * THE HOST'S (+) — in the same order as the supplier's (11 Nov): Decision · Log a payment · Meeting · Camera · Photos &
 * files · Report a problem (last). A coordinator with another supplier drops Log a payment (`canLogPayment` false).
 */
export function CoupleThreadToolsSheet({
  dealReveal = null,
  eventId,
  threadId,
  canLogPayment = true,
  booked = false,
}: {
  dealReveal?: readonly string[] | null;
  eventId: string;
  threadId?: string;
  canLogPayment?: boolean;
  /** 🔒 CHAT-19: booked at the accepted quote — "Counter with a price" is drawn shut with its reason (`hostPlusRows`). */
  booked?: boolean;
}) {
  // The entry decides whether a meeting can be proposed here (an open chat, negotiation on) — the shipped couple
  // rows say so: no deal row ⇒ the Meeting card is SHUT with its reason, never hidden and never a dead Send.
  const meetingOpen = coupleThreadTools(dealReveal).some((t) => t.key === 'deal-or-meeting');
  const { pollOpen } = usePlus(threadId ?? '');
  // ＋ FINAL: Log a payment waits for booking like the supplier's booking tools (`AFTER_BOOKING`).
  const rows = plusSheetRows(hostPlusRows({ canLogPayment, pollOpen, booked }), 'couple', eventId, booked).map((r) =>
    r.key === 'meeting' && !meetingOpen ? { ...r, shut: { reason: 'Not open on this chat yet' } } : r,
  );
  return <ToolsSheetButton rows={rows} sheetMark="couple" threadId={threadId} cake="couple" />;
}

/**
 * 🧪 THE (+) WITH THE SHIPPED ATTACH ACTIONS ONLY — Camera · Photo · Share a file — for a composer whose own rows are
 * not built yet (the chat labs). `more` is Lane B's slot (Build 3: the supplier's (+) menu content): rows handed in are
 * drawn after the shipped ones, through the same sheet.
 */
export function ComposerPlusSheet({ more = [], sheetMark = 'plain' }: { more?: readonly SheetRow[]; sheetMark?: string }) {
  const rows: SheetRow[] = [
    ...SHORTCUT_ROWS,
    { key: 'share-file', label: 'Share a file', line: 'File · photo · video · the contract', icon: 'file', shut: null, attach: 'file', page: 'files' },
    ...more,
  ];
  return <ToolsSheetButton rows={rows} sheetMark={sheetMark} />;
}

/**
 * "Answer" on the answer line while the couple's booking ask is open — the same reveal as the sheet's "Answer their
 * booking ask" row, one tap from the top of the conversation (prototype: the ask sits right under the answer line).
 * Amber, never terracotta: Send is the screen's one main.
 */
export function AnswerAskButton() {
  return (
    // Rule 3 · the button piece in its amber tone (it needs you), never a hand-made pill in raw palette colours.
    <ActionButton
      type="button"
      tone="warn"
      icon={Handshake}
      label="They asked to book"
      onClick={() => revealThreadTool(['booking-ask'])}
      data-answer-ask=""
      className="!min-h-11 shrink-0"
    />
  );
}
