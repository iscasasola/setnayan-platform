/**
 * RequestCardView — ONE card for every Work request (owner approved 2026-11-14: "approved admin request cards";
 * drawing `prototypes/admin_request_cards_2026-11-14_fable.html`). Four parts, always in this order:
 *
 *   1. a plain title (who wants what) · the queue chip · how long it has waited — red edge once past its promise;
 *   2. the real thing — old and new logo as PICTURES, old and new text, the papers, the receipt, the review;
 *   3. their own words, then who asked + when, "Open shop ↗" (the public page, new tab) and "Open record";
 *   4. the decision (`CardDecide`), or the sentence saying why there is nothing to press here.
 *
 * 🔒 NOTHING RAW REACHES THIS SCREEN. Every word comes from `lib/admin/request-card.ts` builders, which never pass a
 * field key or a storage address through (guard: `app/admin/work/request-cards-say-it-plainly.test.ts`).
 *
 * Server Component: the card is drawn on the server; only the footer (the reason sheet) is a client island.
 */
import Link from 'next/link';
import { ArrowUpRight, ChevronRight, ImageOff, Star } from 'lucide-react';
import { Badge } from '@/app/_components/badge';
import { manilaDayLabel, manilaStampLabel } from '@/lib/admin/manila-stamp';
import { agoWords, reasonOptions, type CardActionKind, type RequestCard } from '@/lib/admin/request-card';
import {
  approvePaymentFromWorkList,
  agreeToRequestFromWorkList,
  publishReviewFromWorkList,
  recordPayoutFromWorkList,
  settleHelpFromWorkList,
  settleChatFlagFromWorkList,
  settleCorrectionFromWorkList,
  settleSubscriptionFromWorkList,
  settlePaymentOptionFromWorkList,
} from '@/app/admin/work/actions';
import { settleVerificationFromWorkList } from '@/app/admin/verify/actions';
import { CardDecide } from './card-decide';

/** Which EXISTING Work action each card posts, and the id field it reads. One table — no new server action. */
const CARD_ACTIONS: Record<CardActionKind, { fn: (fd: FormData) => Promise<void>; field: string }> = {
  payment: { fn: approvePaymentFromWorkList, field: 'payment_id' },
  verify: { fn: settleVerificationFromWorkList, field: 'application_id' },
  approval: { fn: agreeToRequestFromWorkList, field: 'approval_id' },
  review: { fn: publishReviewFromWorkList, field: 'appeal_id' },
  payout: { fn: recordPayoutFromWorkList, field: 'payout_id' },
  help: { fn: settleHelpFromWorkList, field: 'message_id' },
  'chat-flag': { fn: settleChatFlagFromWorkList, field: 'flag_id' },
  correction: { fn: settleCorrectionFromWorkList, field: 'request_id' },
  subscription: { fn: settleSubscriptionFromWorkList, field: 'purchase_id' },
  'payment-option': { fn: settlePaymentOptionFromWorkList, field: 'payment_method_id' },
};

const when = (iso: string): string => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? manilaDayLabel(iso) : manilaStampLabel(iso));

function Picture({ url, alt, label }: { url: string | null; alt: string; label: string }) {
  return (
    <figure className="flex min-w-0 flex-col items-center gap-1.5">
      <span
        className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-lg border"
        style={{ borderColor: 'var(--sn-line)', background: 'var(--sn-paper)' }}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed address; the optimizer would re-sign it on every render.
          <img src={url} alt={alt} className="h-full w-full object-contain" loading="lazy" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-[12px] text-[color:var(--sn-ink-500)]">
            <ImageOff aria-hidden className="h-5 w-5" strokeWidth={1.75} />
            No picture
          </span>
        )}
      </span>
      <figcaption className="text-[12px] font-semibold text-[color:var(--sn-ink-500)]">{label}</figcaption>
    </figure>
  );
}

function Show({ show }: { show: RequestCard['show'][number] }) {
  if (show.kind === 'images') {
    return show.before === null && show.after !== null && show.beforeAlt === '' ? (
      <div className="flex">
        <Picture url={show.after} alt={show.afterAlt} label="Their QR" />
      </div>
    ) : (
      <div className="flex items-center gap-2">
        <Picture url={show.before} alt={show.beforeAlt} label="Now" />
        <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-[color:var(--sn-ink-500)]" />
        <Picture url={show.after} alt={show.afterAlt} label="Asked for" />
      </div>
    );
  }
  if (show.kind === 'text') {
    return (
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-[color:var(--sn-ink-500)]">Now</dt>
        <dd className="min-w-0 break-words text-[color:var(--sn-ink-500)] line-through">{show.before ?? 'Blank'}</dd>
        <dt className="text-[color:var(--sn-ink-500)]">Asked for</dt>
        <dd className="min-w-0 break-words font-semibold text-[color:var(--sn-ink-900)]">{show.after ?? 'Blank'}</dd>
      </dl>
    );
  }
  if (show.kind === 'facts') {
    return (
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {show.rows.map((r) => (
          <div key={r.label} className="contents">
            <dt className="text-[color:var(--sn-ink-500)]">{r.label}</dt>
            <dd
              className="min-w-0 break-words font-semibold"
              style={{
                color:
                  r.tone === 'ok' ? 'var(--sn-success-deep)' : r.tone === 'warn' ? 'var(--sn-warning-deep)' : 'var(--sn-ink-900)',
              }}
            >
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  if (show.kind === 'papers') {
    return (
      <ul className="flex flex-wrap gap-2">
        {show.papers.map((p) => (
          <li key={p.label} className="flex w-24 flex-col items-center gap-1 text-center">
            <span
              className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border"
              style={{ borderColor: 'var(--sn-line)', background: 'var(--sn-paper)' }}
            >
              {p.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed address of a private paper.
                <img src={p.previewUrl} alt={p.label} className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <span className="px-1 text-[12px] text-[color:var(--sn-ink-500)]">{p.present ? 'A file' : 'Not sent'}</span>
              )}
            </span>
            <span className="text-[12px] leading-tight text-[color:var(--sn-ink-500)]">{p.label}</span>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className="flex flex-col gap-1 text-sm">
      {show.stars !== null ? (
        <span className="flex items-center gap-0.5" aria-label={`${show.stars} of 5 stars`}>
          {Array.from({ length: 5 }, (_, i) => (
            <Star
              key={i}
              aria-hidden
              className="h-4 w-4"
              strokeWidth={1.75}
              fill={i < (show.stars ?? 0) ? 'currentColor' : 'none'}
              style={{ color: 'var(--sn-ink-900)' }}
            />
          ))}
        </span>
      ) : null}
      {show.body ? <p className="text-[color:var(--sn-ink-900)]">“{show.body}”</p> : null}
      {show.why ? <p style={{ color: 'var(--sn-warning-deep)' }}>Why it was held: {show.why}</p> : null}
    </div>
  );
}

export function RequestCardView({
  card,
  back,
  late,
  nowMs,
}: {
  card: RequestCard;
  /** The exact Work address to return to after a press — keeps the lane and the open row. */
  back: string;
  /** Past the queue's promised time ⇒ the red left edge (as on Accounts). */
  late?: boolean;
  nowMs: number;
}) {
  const ago = agoWords(card.at, nowMs);
  const act = card.act ? CARD_ACTIONS[card.act.kind] : null;
  const options: Record<number, readonly string[]> = {};
  card.act?.buttons.forEach((b, i) => {
    if (b.reasons) options[i] = reasonOptions(b.reasons.list);
  });
  return (
    <article
      className="sn-tile p-4"
      data-request-card={card.act?.kind ?? 'note'}
      style={{ borderLeft: late ? '3px solid var(--sn-danger)' : undefined }}
    >
      <header className="flex items-start gap-3">
        <span
          aria-hidden
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold"
          style={{ background: 'var(--sn-paper)', color: 'var(--sn-ink-900)' }}
        >
          {card.initials}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="text-[15px] font-semibold leading-snug text-[color:var(--sn-ink-900)]">{card.title}</h3>
          <span className="flex flex-wrap items-center gap-2 text-[12px] text-[color:var(--sn-ink-500)]">
            <Badge tone="quiet">{card.chip}</Badge>
            {ago ? <span>{ago}</span> : null}
          </span>
        </span>
      </header>

      {card.show.length > 0 ? (
        <div className="mt-3 flex flex-col gap-3">
          {card.show.map((s, i) => (
            <Show key={i} show={s} />
          ))}
        </div>
      ) : null}

      {card.quote ? (
        <blockquote className="mt-3 border-l-2 pl-3 text-sm text-[color:var(--sn-ink-900)]" style={{ borderColor: 'var(--sn-line)' }}>
          “{card.quote}”
        </blockquote>
      ) : null}

      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[color:var(--sn-ink-500)]">
        {card.who || card.at ? (
          <span>
            {card.who ? `Asked by ${card.who}` : 'Since'}
            {card.at ? `${card.who ? ' · ' : ' '}${when(card.at)}` : ''}
          </span>
        ) : null}
        {card.shopHref ? (
          <a
            href={card.shopHref}
            target="_blank"
            rel="noopener"
            className="inline-flex min-h-11 items-center gap-0.5 font-semibold underline underline-offset-2"
            style={{ color: 'var(--sn-ink-900)' }}
          >
            Open shop
            <ArrowUpRight aria-hidden className="h-3.5 w-3.5" />
          </a>
        ) : null}
        <Link
          href={card.recordHref}
          className="inline-flex min-h-11 items-center gap-0.5 font-semibold underline underline-offset-2"
          style={{ color: 'var(--sn-ink-900)' }}
        >
          Open record
          <ChevronRight aria-hidden className="h-3.5 w-3.5" />
        </Link>
      </p>

      {card.act && act ? (
        <CardDecide
          action={act.fn}
          idField={act.field}
          id={card.act.id}
          back={back}
          buttons={card.act.buttons}
          fields={card.act.fields}
          options={options}
        />
      ) : card.footNote ? (
        <p className="mt-2 text-sm text-[color:var(--sn-ink-500)]">{card.footNote}</p>
      ) : null}
    </article>
  );
}
