import { Gift, Globe, Landmark, ShieldCheck, Smartphone } from 'lucide-react';
import type { ReactNode } from 'react';
import { egiftKindMeta, type EgiftMethodKind } from '@/lib/egift-kinds';
import { PabuyaMethodActions } from './pabuya-method-actions';
import { PabuyaQrThumb } from './pabuya-qr-viewer';

/**
 * Shared, PRESENTATIONAL Pabuya guest-facing card list.
 *
 * Pure (no 'use client', no server-only, no data fetching) so it renders in
 * BOTH places the same way:
 *   • the couple dashboard's LIVE PREVIEW (inside a client component), and
 *   • the public /[slug]/pabuya guest route (server-rendered).
 * That parity is the point — what the couple arranges is exactly what guests
 * get. Interactivity (copy-to-clipboard, "open GCash") is intentionally NOT
 * here; a route that wants it wraps the handle in its own small client control.
 *
 * CORE INVARIANT copy lives in <PabuyaTrustNote>: Setnayan never holds money —
 * every card points at the couple's OWN account.
 */

export type PabuyaMethodCard = {
  kind: EgiftMethodKind | string;
  label: string;
  accountName: string | null;
  handle: string | null;
  note: string | null;
  /**
   * Permanent URL for the QR image (`/api/pabuya/qr/<public_id>`), or null
   * when none uploaded. No longer a presigned URL — see lib/pabuya-qr-url.ts.
   */
  qrUrl: string | null;
};

function KindIcon({ kind }: { kind: string }) {
  const cls = 'h-5 w-5 text-mulberry';
  switch (kind) {
    case 'gcash':
    case 'maya':
      return <Smartphone aria-hidden className={cls} strokeWidth={1.75} />;
    case 'bank':
      return <Landmark aria-hidden className={cls} strokeWidth={1.75} />;
    case 'paypal':
      return <Globe aria-hidden className={cls} strokeWidth={1.75} />;
    default:
      return <Gift aria-hidden className={cls} strokeWidth={1.75} />;
  }
}

export function PabuyaCardList({
  methods,
  emptyHint,
  idScope = 'egift-handle',
  kit = null,
}: {
  /**
   * 🕯 THE LOOK'S ART KIT ON THE GIFT CARD (owner 2026-10-16, `lib/art-kits.ts`) — the corner spray and the lace
   * abaniko, a ready `<KitSlot slot="gifts-card">`, drawn as the first child of ONE card: the first bank card, else the
   * first card. Inert (it is plain markup). Absent → every card byte for byte as before.
   */
  kit?: ReactNode;
  methods: PabuyaMethodCard[];
  /** Shown when there are no methods — omit to render nothing. */
  emptyHint?: string;
  /**
   * The prefix of each number's element id. A page that draws the list TWICE
   * (the gift page, and again inside the wish list's send sheet) gives the second
   * one its own, so a failed copy selects the number the guest is looking at.
   */
  idScope?: string;
}) {
  if (methods.length === 0) {
    return emptyHint ? (
      <p className="rounded-2xl border border-dashed border-ink/20 bg-cream/60 px-4 py-6 text-center text-sm text-ink/60">
        {emptyHint}
      </p>
    ) : null;
  }

  /* The card the kit dresses — the proof's bank transfer card, or the first way to give when there is none. */
  const kitAt = kit ? Math.max(0, methods.findIndex((m) => m.kind === 'bank')) : -1;
  return (
    <ul className="space-y-3">
      {methods.map((m, i) => {
        const meta = egiftKindMeta(m.kind);
        /* 📱 THE QR IS THE METHOD (owner 2026-10-07, on the E-Gifts part:
           *"shouldn't we show the actual QR instead?"*). For a scan-first rail
           (`qrPrimary` — GCash, Maya) with a QR uploaded, the QR itself stands
           where the icon tile stood, sized to scan; bank and PayPal keep
           their details, and a method with no QR keeps its mark. */
        const qrFirst = meta.qrPrimary && Boolean(m.qrUrl);
        /* ✋ A TAP OPENS IT IN PLACE (owner 2026-10-24, "no way to go back") — the client leaf
           `PabuyaQrThumb` holds the viewer, so this card stays inert. Never a link to the raw route. */
        const qrLink = m.qrUrl ? (
          <PabuyaQrThumb
            qrUrl={m.qrUrl}
            label={m.label || meta.defaultLabel}
            accountName={m.accountName}
            primary={qrFirst}
          />
        ) : null;
        return (
          <li
            key={`${m.kind}-${i}`}
            className="overflow-hidden rounded-2xl border border-ink/10 bg-cream shadow-sm"
          >
            {i === kitAt ? kit : null}
            <div className="flex items-start gap-3 p-4">
              {qrFirst ? (
                qrLink
              ) : (
                <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mulberry/10">
                  <KindIcon kind={m.kind} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg italic text-ink">
                  {m.label || meta.defaultLabel}
                </p>
                {m.accountName ? (
                  <p className="mt-0.5 text-sm text-ink/70">{m.accountName}</p>
                ) : null}
                {m.handle ? (
                  /*
                    ⚠ THE NUMBER USED TO BE AN UNLABELLED STRING. It rendered as
                    bare mono digits with nothing saying what they were, so it
                    read as decoration rather than as the thing to type into a
                    banking app. It is the FALLBACK when a scan fails, which is
                    exactly the moment a guest is least able to guess.
                  */
                  <>
                    <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">
                      {meta.handleLabel}
                    </p>
                    <p
                      id={`${idScope}-${i}`}
                      className="mt-0.5 select-all break-all font-mono text-[15px] font-medium text-mulberry"
                    >
                      {m.handle}
                    </p>
                  </>
                ) : null}
                {m.note ? (
                  <p className="mt-2 text-xs leading-relaxed text-ink/55">
                    {m.note}
                  </p>
                ) : null}
                {/* The only interactive part of this card, and it lives in its
                    own 'use client' file so this component stays inert and
                    identical between the guest page and the couple's preview. */}
                <PabuyaMethodActions
                  handle={m.handle}
                  qrUrl={m.qrUrl}
                  label={m.label || meta.defaultLabel}
                  handleElementId={`${idScope}-${i}`}
                />
              </div>
              {m.qrUrl && !qrFirst ? (
                /*
                  ── A QR A GUEST CAN ACTUALLY SCAN (2026-09-16) ──────────────
                  This was an 80×80 `<span>`. A couple does not upload bare QR
                  modules — they upload what their banking app gives them, which
                  is a screenshot wrapped in a logo, their name, a masked
                  account number and a footnote. The code itself is perhaps a
                  third of that image, so 80px of card became ~25px of real QR:
                  unscannable, and the owner reported it as the QR simply not
                  being visible.

                  🔑 A GUEST SCANS THIS FROM A SECOND PHONE, so the two things
                  that matter are SIZE and a way to get it FULL-SCREEN. A tap
                  opens it full screen IN PLACE on a white plate, with Save QR
                  (`PabuyaQrThumb`). It was an `<a target="_blank">` to the image
                  itself until 2026-10-24 — which, in the app and the PWA, left
                  the guest on a bare picture with no way back.

                  ⚠ Still no `onClick` HERE — the press lives in its own client
                  leaf, so this shared card stays presentational and the guest
                  page and the couple's preview cannot drift.
                */
                qrLink
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The hand-off guarantee. Rendered on both surfaces (with audience-appropriate
 * copy) so the "Setnayan never holds your money" promise is impossible to miss.
 */
export function PabuyaTrustNote({
  audience = 'guest',
  organizerPossessive,
}: {
  audience?: 'guest' | 'couple';
  /**
   * The event's own possessive for whoever is throwing it — `'the couple’s'`,
   * `'the family’s'`, `'the celebrant’s'`. Comes from `EventWords`.
   *
   * 🔒 REQUIRED, NOT OPTIONAL-WITH-A-DEFAULT, and that is the whole point. This
   * note has TWO guest-audience callers — the public gift page and the couple's
   * LIVE PREVIEW of that same page — and a default would hide the second one:
   * the preview would keep saying "the couple's" while guests read "the
   * family's", destroying the byte-for-byte parity the preview exists for. A
   * dropped prop is a typecheck failure; that IS the guard.
   *
   * 🔒 NEVER default it to "the host's": a funeral's noun is `family`.
   */
  organizerPossessive: string;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-2xl border border-success-200 bg-success-50 px-4 py-3">
      <ShieldCheck
        aria-hidden
        className="mt-0.5 h-4 w-4 shrink-0 text-success-700"
        strokeWidth={2}
      />
      <p className="text-xs leading-relaxed text-ink-on-light/70">
        {audience === 'couple' ? (
          <>
            <b className="text-ink-on-light">
              Guests send directly to your account — Setnayan never holds your
              money.
            </b>{' '}
            We only display the handles and QR codes you add here. There is no
            commission, no middleman, and no fees.
          </>
        ) : (
          <>
            <b className="text-ink-on-light">Setnayan never touches your money.</b> We
            only show you where to send it — it goes directly to{' '}
            {organizerPossessive} own account. No commission, no middleman, no
            fees.
          </>
        )}
      </p>
    </div>
  );
}
