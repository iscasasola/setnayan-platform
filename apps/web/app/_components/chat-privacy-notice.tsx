'use client';

import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Notice } from '@/app/_components/notices/notices';
import type { CloseRecord } from '@/lib/notices';

/**
 * Pinned, non-dismissible system notice at the top of every chat thread
 * (couple-side AND vendor-side mirror). Iteration 0019 § Gate, locked
 * 2026-05-14. The notice is not stored in chat_messages, doesn't count
 * toward unread, and has no sender attribution.
 *
 * Copy is locale-resolved per iteration 0015. EN-PH is the canonical
 * string; TL and CEB land in the next locale pass.
 *
 * ── ONE LINE, SINCE 2026-09-18 (One Chat Box) ───────────────────────────────
 * It used to be a bordered paragraph — one of the seven cards stacked above the
 * conversation that left the message list 32px tall on a phone. It is now ONE
 * line: the lead, and a "More" toggle that opens the full locked copy in
 * place. Nothing was cut and nothing became dismissible: the 0019 lock says
 * pinned and non-dismissible, and this keeps both.
 */
/**
 * ── TWO READERS, ONE NOTICE (owner, 2026-09-18) ─────────────────────────────
 * The 0019 lock says the notice is pinned on BOTH sides. Its canonical string
 * is written to the couple — "your vendor sees what they need from your
 * profile" — and for four months that exact sentence was pinned above the
 * SUPPLIER's conversation too, telling a shop about "your vendor". The owner
 * read it on the client page and named it. The supplier's line says the same
 * thing from the supplier's side: what they need is already here, and asking
 * for the listed items in chat is what the couple is told to report.
 *
 * `viewer` picks the reader. The couple's string is unchanged, byte for byte.
 */
const COPY = {
  'en-PH': {
    couple: {
      lead: 'All your event info is already in Setnayan',
      body: '— your supplier sees what they need from your profile. Please don’t share private info in chat.',
      examples: 'government IDs · card numbers · full addresses · OTPs · passwords',
      report: 'If a supplier asks for these, report it via Help.',
    },
    vendor: {
      lead: 'Everything you need for this event is already in Setnayan',
      body: '— their profile and this conversation carry it. Never ask for private info in chat.',
      examples: 'government IDs · card numbers · full addresses · OTPs · passwords',
      report: 'Couples are told to report a supplier who asks for these.',
    },
  },
  // TL / CEB placeholders — wire the locale key now, copy lands in the next
  // locale pass (per spec § Gate "EN required; TL + CEB strings TBD").
} as const;

type Locale = keyof typeof COPY;
export type ChatPrivacyViewer = 'couple' | 'vendor';

/**
 * `inBox` — rendered as a flush line inside the chat box's frame (border-b,
 * no radius). Off, it keeps the rounded standalone look for the mounts that
 * still stack it above a stream (the client brief's Chat tab).
 */
const NOTE_LINE =
  'flex items-start gap-2 text-[11px] leading-snug text-ink/70';
const NOTE_IN_BOX = `${NOTE_LINE} border-b border-ink/10 bg-ink/[0.02] px-3 py-1 sm:px-4`;
const NOTE_STANDALONE = `${NOTE_LINE} rounded-xl border border-ink/10 bg-ink/[0.03] px-3 py-1.5`;

const TOGGLE =
  'shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-mulberry underline underline-offset-2 hover:text-mulberry-600';

export function ChatPrivacyNotice({
  locale = 'en-PH',
  inBox = false,
  viewer = 'couple',
}: {
  locale?: Locale | string;
  inBox?: boolean;
  /** Who is reading — the string is addressed to them. Defaults to the couple,
   *  the 0019 canonical reader; every supplier mount must say `vendor`. */
  viewer?: ChatPrivacyViewer;
}) {
  const strings = COPY[(locale as Locale) in COPY ? (locale as Locale) : 'en-PH'][viewer];
  const [more, setMore] = useState(false);
  return (
    <div
      role="note"
      aria-label="Chat privacy notice"
      className={inBox ? NOTE_IN_BOX : NOTE_STANDALONE}
    >
      <ShieldAlert
        aria-hidden
        className="mt-[3px] h-3.5 w-3.5 shrink-0 text-terracotta"
        strokeWidth={1.75}
      />
      <p className={`min-w-0 flex-1 self-center ${more ? '' : 'truncate'}`}>
        <span className="font-medium text-ink">{strings.lead}</span>{' '}
        {strings.body}
        {more ? (
          <>
            {' '}
            <span className="underline decoration-terracotta/40 underline-offset-2">
              {strings.examples}
            </span>{' '}
            {strings.report}
          </>
        ) : null}
      </p>
      <button
        type="button"
        onClick={() => setMore((v) => !v)}
        aria-expanded={more}
        className={TOGGLE}
      >
        {more ? 'Less' : 'More'}
      </button>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Couple-facing safety banner (build 2026-07-23)                            */
/* ──────────────────────────────────────────────────────────────────────── */

/**
 * Warm, couple-facing safety guidance pinned at the top of a couple↔vendor
 * thread. Supersedes the plain <ChatPrivacyNotice> on COUPLE surfaces only —
 * it folds in the same "don't share private info" line plus payment-safety
 * guidance, framed for the couple. Vendor surfaces keep <ChatPrivacyNotice>
 * (the safety copy — "a vendor pushing you off-app is a red flag" — is
 * couple-directed and would read oddly on the vendor's own screen).
 *
 * Default visible; dismissible-but-remembered in localStorage so a couple who
 * has internalised it isn't nagged on every thread. Dismiss is per-device and
 * reversible only by clearing storage — the guidance is advisory, not a gate,
 * so a lost dismissal costs nothing. Not stored in chat_messages; no unread
 * impact; no sender attribution.
 *
 * ── ONE LINE, SINCE 2026-09-18 (One Chat Box) ───────────────────────────────
 * The bulleted panel was the second-tallest of seven cards above the
 * conversation. It is now ONE line — the first point, which is the whole
 * message ("Keep your chats and payments inside Setnayan.") — with a "Tips"
 * toggle that opens all four points in place, and the same × that remembers
 * the dismissal. The four points are unchanged; they are one tap further away.
 * Dismissal still PERSISTS (localStorage, as before): this was checked before
 * the redraw, and nothing here made it ephemeral.
 */
/** The older hand-written close — read only, as the notice's legacy (one notice system, 14 Nov 2026). */
const SAFETY_DISMISS_KEY = 'setnayan_chat_safety_banner_dismissed';

const SAFETY_POINTS = [
  'Keep your chats and payments inside Setnayan.',
  'Approve only what you asked for — and pay only the amount you agreed on.',
  'Never share IDs, card numbers, or OTPs in chat.',
  'A supplier rushing you to pay off Setnayan is a red flag — tell us via Help.',
] as const;


/** The four safety points, drawn once — by the in-box banner and by the picked chat's ⓘ (`ChatPrivacyTip`). */
function SafetyPoints({ inline = false }: { inline?: boolean }) {
  // `inline`: inside the strip's ⓘ, which sits in a <p> — spans only, never a list (no <ul> in a <p>).
  const Wrap = inline ? 'span' : 'ul';
  const Item = inline ? 'span' : 'li';
  return (
    <Wrap className={inline ? 'block space-y-0.5' : 'mt-0.5 space-y-0.5'}>
      {SAFETY_POINTS.map((point) => (
        <Item key={point} className="flex gap-1.5">
          <span aria-hidden className="text-terracotta/60">
            ·
          </span>
          <span>{point}</span>
        </Item>
      ))}
    </Wrap>
  );
}

/**
 * 🔔 Inventory #22 — News (one notice system, owner approved 14 Nov 2026): "Plan with peace of mind", shown once; the
 * safety points are behind the ⓘ. Drawn by the event pages' top slot.
 */
export function ChatSafetyBanner(_props: { inBox?: boolean }) {
  return (
    <Notice
      kind="news"
      noticeKey="chat-safety"
      title="Plan with peace of mind"
      detail={<SafetyPoints inline />}
      legacy={(): CloseRecord | null => {
        try {
          return localStorage.getItem(SAFETY_DISMISS_KEY) === '1' ? { closedAt: Date.now(), count: 1 } : null;
        } catch {
          return null;
        }
      }}
    />
  );
}

/**
 * 🔒 THE SAME WORDS, BEHIND AN ⓘ — inside a picked shell's Chat (v8.3, approved 9 Nov: no notice row in the picked chat;
 * "if it must stay reachable, put it behind the ⓘ — never take a row"). The supplier's copy stays the locked 0019 copy
 * and is never dismissible: it is simply always one tap away on the host strip's "Shared chat" line. The couple's
 * reads the safety points. Words only — the strip draws the ⓘ (`ChatHostStrip` `note`).
 */
export function ChatPrivacyTip({ viewer, locale = 'en-PH' }: { viewer: ChatPrivacyViewer; locale?: Locale | string }) {
  if (viewer === 'couple') {
    return (
      <span className="block" data-chat-privacy-tip="couple">
        <SafetyPoints inline />
      </span>
    );
  }
  const strings = COPY[(locale as Locale) in COPY ? (locale as Locale) : 'en-PH'].vendor;
  return (
    <span className="block" data-chat-privacy-tip="vendor">
      <span className="font-medium">{strings.lead}</span> {strings.body} {strings.examples}. {strings.report}
    </span>
  );
}
