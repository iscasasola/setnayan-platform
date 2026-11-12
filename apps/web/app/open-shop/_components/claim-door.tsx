'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Heart, LogIn, Mail, MailCheck, Plus, Tag, Trash2, X } from 'lucide-react';

import { ActionButton, useFitRow } from '@/components/action-button';
import { InfoTip } from '@/app/_components/info-tip';
import { FirstRunBrand } from '@/app/_components/first-run-brand';
import { SubmitButton } from '@/app/_components/submit-button';
import { ANY_OAUTH_ENABLED, OAuthButtonRow } from '@/app/_components/oauth-button-row';
import { OAUTH_BUTTON_CLASS } from '@/app/_components/oauth-icons';
import { OAUTH_VERB } from '@/lib/oauth-words';
import { PasswordField } from '@/app/_components/password-field';
import { TurnstileField } from '@/app/_components/auth/turnstile-field';
import { TERMS_FIELD } from '@/lib/terms-agreement';
import { OPEN_SHOP_PASSWORD_MIN } from '@/lib/open-shop-account';
import { TakenSignIn } from './taken-sign-in';
import { DesktopOAuthButtons } from '@/app/_components/desktop-oauth-buttons';
import { NativeOAuthButtons } from '@/app/_components/native-oauth-buttons';
import { formatCount } from '@/lib/format-number';
import { formatPhoneDigits, maxDigitsFor } from '@/lib/open-shop-phone';
import { planSplit, holdsMoreThanFree } from '@/lib/open-shop-more-services';
import {
  CLAIM_DETAIL_LABEL,
  CLAIM_DOOR_FIELD,
  claimDetailKeysOf,
  claimDoorHref,
  claimDraftKey,
  seedBundleName,
  seedClaimCards,
  type ClaimDetailKey,
  type ClaimDoorAnswers,
  type ClaimDoorRecord,
} from '@/lib/claim-door';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { ServicePicker, type PickerParentView } from './service-picker';
import { PlanInline } from './plan-sheet';
import type { SpecialtyField } from './service-cards';
import { finishClaimDoor } from '../claim-actions';

/**
 * 🔗 THE CLAIM DOOR — `/open-shop?claim=<token>` (controller A6, 7 Nov). A supplier the couple added by hand joins
 * through the redesigned door, PRE-FILLED from the couple's record, in v21's order (`Q_ORDER`):
 *
 *   1 · invited by — "You're invited by X." in the door's own frame (owner 7 Nov: *"the claim QR is not following our
 *       design template"*): step head, title + one line, What you get in the ⓘ, one terracotta Confirm, the grey
 *       pills Sign in & claim · I'm not this supplier.
 *   2 · these are your business details — tick only what is WRONG.
 *   3 · one ticked detail per slide (owner 7 Nov: *"let it flow step by step"*).
 *   4 · one slide per service card, filled from the confirmed record; specialties optional, none pre-picked.
 *   5 · the bundle — the couple's price, locked; their extra lines.
 *   6 · which plan their services fit (TIER_CAPS through `planSplit`, never typed).
 *   then the account: Google · Apple · Sign in. 🔒 NO EMAIL FIELD — the account's email comes from signing in.
 *
 * The answers are kept in this browser (`claimDraftKey`) so signing in with Google or Apple, which leaves the page,
 * loses nothing. The finish is `finishClaimDoor`, which hands the consent to the shipped finalize.
 */

type Screen = 'invite' | 'details' | `ed:${ClaimDetailKey}` | `card:${number}` | 'bundle' | 'plan' | 'account';

type Picked = { category: string; leaf: string | null; label: string; tileId: string | null; fromRecord: boolean };
type Card = { name: string; price: string; inclusions: string[]; bundled: boolean; specialties: Record<string, string[]> };
/** What pressing Claim it fills "Your role at the shop" with (owner 10 Nov: "If that is pressed, this should be owner"). */
export const CLAIM_OWNER_ROLE = 'Owner';

type Draft = {
  screen: Screen;
  ticked: ClaimDetailKey[];
  name: string;
  who: string;
  phone: string;
  role: string;
  /** "Your role at the shop" was filled Owner by pressing Claim it (not typed) — the account slide says why. */
  roleFromClaim?: boolean;
  price: string;
  inclusions: string[];
  plan: { label: string; amount: string }[];
  services: Picked[];
  cards: Card[];
  bundleName: string;
  extras: string[];
  planAgreed: boolean;
  /** The account slide's email way — what was typed (pre-filled from the invite). The password is never kept. */
  email: string;
};

const peso = (n: number | string | null | undefined) =>
  `₱${formatCount(Number(String(n ?? '').replace(/[^\d]/g, '')) || 0)}`;
const digits = (s: string) => s.replace(/[^\d]/g, '');
const words = (n: number, one: string, many: string) => `${formatCount(n)} ${n === 1 ? one : many}`;

/** The door's ONE typed box — every claim field is drawn through it (no type: there is no Email field, ever). */
function Box(props: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className' | 'type'>) {
  return (
    <input
      // field-ok: the claim slides ARE the sign-up door pre-filled (owner 2026-11-06, v21), and the door draws plain boxes like open-shop-wizard's own; ONE box, every claim field routes through it
      {...props}
      className="input-field"
    />
  );
}

/** The in-place sign-in's success hook: nothing to do here — its own `router.refresh()` redraws the slide signed in. */
const signedInHere = () => undefined;

export function ClaimDoor({
  record,
  tree,
  specialties = {},
  signedInAs,
  oauth,
  signInHref,
  error,
  startOnAccount = false,
  declineAction,
  startOnEmail = false,
  taken = false,
  sentTo = null,
}: {
  record: ClaimDoorRecord;
  tree: PickerParentView[];
  specialties?: Record<string, SpecialtyField[]>;
  /** The signed-in account's email, or null when signed out. */
  signedInAs: string | null;
  oauth: { show: boolean; desktop: boolean; native: boolean };
  signInHref: string;
  error?: string;
  /** `?step=account` — back from signing in. */
  startOnAccount?: boolean;
  /** The shipped decline (`declineVendorInviteByToken`); the lab passes none. */
  declineAction?: (fd: FormData) => void | Promise<void>;
  /** `&way=email` — a refusal of the email way came back: it opens chosen. */
  startOnEmail?: boolean;
  /** `&taken=1` — that email already has an account: the box becomes the shipped in-place sign-in. */
  taken?: boolean;
  /** `&check_inbox=` — the account waits for its email link (verification on), which lands back on this slide. */
  sentTo?: string | null;
}) {
  const leafOfTile = useMemo(() => {
    const m = new Map<string, { leaf: string; label: string } | null>();
    for (const p of tree)
      for (const b of p.branches) m.set(b.tileId, b.leaves.length === 1 ? { leaf: b.leaves[0]!.canonicalService, label: b.leaves[0]!.label } : null);
    return m;
  }, [tree]);
  const leavesOfTile = useMemo(() => {
    const m = new Map<string, { leaf: string; label: string }[]>();
    for (const p of tree) for (const b of p.branches) m.set(b.tileId, b.leaves.map((l) => ({ leaf: l.canonicalService, label: l.label })));
    return m;
  }, [tree]);
  const tileOfLeaf = useMemo(() => {
    const m = new Map<string, { tileId: string; tileLabel: string }>();
    for (const p of tree) for (const b of p.branches) for (const l of b.leaves) m.set(l.canonicalService, { tileId: b.tileId, tileLabel: b.label });
    return m;
  }, [tree]);

  const seed = (): Draft => {
    const services: Picked[] = record.services.map((s) => {
      // A category that holds one service IS that service (owner 2026-11-07: "auto add that").
      const only = s.tileId ? leafOfTile.get(s.tileId) ?? null : null;
      return { category: s.category, leaf: only?.leaf ?? null, label: s.label, tileId: s.tileId, fromRecord: true };
    });
    return {
      screen: startOnAccount ? 'account' : 'invite',
      ticked: [],
      name: record.business,
      who: record.contactPerson ?? '',
      phone: digits(record.contactPhone ?? '').replace(/^63/, '').replace(/^0/, ''),
      role: '',
      price: record.price ? String(record.price) : '',
      inclusions: [...record.inclusions],
      plan: record.plan.map((p) => ({ label: p.label, amount: String(p.amount) })),
      services,
      cards: seedClaimCards(record).map((c) => ({
        name: c.name,
        price: c.price ? String(c.price) : '',
        inclusions: c.inclusions,
        bundled: c.bundled,
        specialties: {},
      })),
      bundleName: seedBundleName(record.services.map((s) => s.label)),
      extras: [],
      planAgreed: false,
      email: record.inviteEmail ?? '',
    };
  };
  const [d, setD] = useState<Draft>(seed);
  const [planErr, setPlanErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  // Google / Apple are drawn on this shell (the wizard's own rule); with neither, Email is the only way and starts open.
  const waysShown = oauth.show && (oauth.desktop || oauth.native || ANY_OAUTH_ENABLED);
  const [emailWay, setEmailWay] = useState(!waysShown || startOnEmail || taken);

  // The draft survives signing in with Google / Apple (they leave the page) AND the email link (which can open in a
  // NEW tab — so localStorage, not sessionStorage) — this browser only, this link only. The password is never in it.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(claimDraftKey(record.token));
      if (raw) {
        const saved = JSON.parse(raw) as Draft;
        setD({ ...saved, email: saved.email ?? record.inviteEmail ?? '', screen: startOnAccount ? 'account' : saved.screen });
      }
    } catch {
      /* no storage — the door works from the record */
    }
  }, [record.token, record.inviteEmail, startOnAccount]);
  useEffect(() => {
    try {
      localStorage.setItem(claimDraftKey(record.token), JSON.stringify(d));
    } catch {
      /* private window — nothing to keep */
    }
  }, [d, record.token]);

  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  // The invite slide's two equal-weight choices: one row, one state (icon + word → word → icon).
  const inviteRowRef = useRef<HTMLDivElement>(null);
  useFitRow(inviteRowRef);
  // 🎁 Setnayan's own personal invite (owner 7 Nov: "yes"): no couple to "see yours", no event, nothing booked — so
  // its words name the Setnayan team, it shows the offer, and it has no bundle slide.
  const team = record.from === 'setnayan';
  const detailKeys = claimDetailKeysOf(record);
  const editKeys = detailKeys.filter((k) => d.ticked.includes(k));
  const order: Screen[] = [
    'invite',
    'details',
    ...editKeys.map((k) => `ed:${k}` as Screen),
    ...d.cards.map((_, i) => `card:${i}` as Screen),
    ...(team ? [] : (['bundle'] as Screen[])),
    'plan',
    'account',
  ];
  const at = Math.max(0, order.indexOf(d.screen));
  const go = (s: Screen) => set({ screen: s });
  const next = () => go(order[Math.min(order.length - 1, at + 1)]!);
  const back = () => go(order[Math.max(0, at - 1)]!);
  // The cards follow the services: one per service, in order; a card the supplier touched keeps its words.
  // 🔒 Only a service the COUPLE recorded can be part of their bundle (owner 7 Nov: "the supplier can add more services
  // but not add them to the customers bundle"). A service the supplier adds is its own card, priced on its own.
  const syncCards = (services: Picked[]) =>
    services.map((s, i) => {
      const kept = d.cards.find((c) => c.name === s.label);
      if (kept) return s.fromRecord ? kept : { ...kept, bundled: false };
      return { name: s.label, price: '', inclusions: [], bundled: s.fromRecord && i > 0 && !!record.price, specialties: {} };
    });

  const meter = d.services.map((s) => ({ categoryId: s.tileId ?? (s.leaf ? tileOfLeaf.get(s.leaf)?.tileId : null) ?? s.category, categoryLabel: s.label }));
  const split = planSplit(meter);
  const cats = new Set(meter.map((m) => m.categoryId)).size;

  const answers: ClaimDoorAnswers = {
    name: d.name.trim(),
    who: d.who.trim(),
    phone: digits(d.phone),
    role: d.role.trim(),
    services: d.services.map((s) => ({ category: s.category, leaf: s.leaf, label: s.label, fromRecord: s.fromRecord })),
    cards: d.cards.map((c, i) => ({
      name: c.name.trim() || d.services[i]?.label || '',
      category: d.services[i]?.category ?? '',
      leaf: d.services[i]?.leaf ?? null,
      price: Number(digits(c.price)) || null,
      inclusions: c.inclusions.map((l) => l.trim()).filter(Boolean),
      bundled: c.bundled && d.services[i]?.fromRecord === true,
      fromRecord: d.services[i]?.fromRecord === true,
    })),
    bundle: { name: d.bundleName.trim(), extras: d.extras.map((x) => x.trim()).filter(Boolean) },
    specialties: Object.fromEntries(
      d.cards.flatMap((c, i) => {
        const leaf = d.services[i]?.leaf;
        return leaf && Object.keys(c.specialties).length ? [[leaf, c.specialties]] : [];
      }),
    ),
    // The details slide's bundle price — a change here is a change to what the couple bought (sent to them to approve).
    price: Number(digits(d.price)) || null,
  };

  // ── the shared frame pieces ────────────────────────────────────────────────────────────────────────────────────
  const stepOf = d.screen === 'invite' ? 1 : d.screen === 'details' || d.screen.startsWith('ed:') ? 2 : d.screen.startsWith('card:') ? 3 : d.screen === 'bundle' ? 4 : d.screen === 'plan' ? 5 : 6;
  // Setnayan's door has no bundle step: plan and account move up one.
  const step = team && stepOf > 4 ? stepOf - 1 : stepOf;
  const fromHint = (extra = '') => (
    <p className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--m-slate-3)' }}>
      <Heart aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
      {team ? 'Set up by the Setnayan team · change what’s wrong' : `From ${record.inviterName} · change it and they’ll see yours`}
      {extra}
    </p>
  );
  const band = (children: React.ReactNode) => (
    <p className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-[13.5px]" style={{ background: 'var(--m-paper-2)', color: 'var(--m-ink)' }} data-claim-door-band="">
      <Heart aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} style={{ color: 'var(--m-orange-deep)' }} />
      <span>{children}</span>
    </p>
  );
  const field = (label: string, input: React.ReactNode, after?: React.ReactNode, small?: string) => (
    <label className="block max-w-[620px] space-y-1">
      <span className="block text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
        {label}
        {small ? (
          <small className="ml-1.5 font-normal" style={{ color: 'var(--m-slate-3)' }}>
            {small}
          </small>
        ) : null}
      </span>
      {input}
      {after}
    </label>
  );
  const linesEditor = (value: string[], onChange: (v: string[]) => void, placeholder: string, label: string, addLabel = 'Add a line') => (
    <div className="grid max-w-[620px] gap-2">
      {value.map((l, j) => (
        <div key={j} className="flex items-center gap-2">
          <Box
            value={l}
            maxLength={80}
            placeholder={placeholder}
            aria-label={`${label} ${j + 1}`}
            onChange={(e) => onChange(value.map((x, k) => (k === j ? e.target.value : x)))}
          />
          <ActionButton tone="neutral" quiet iconOnly icon={X} label={`Remove ${label.toLowerCase()} ${j + 1}`} onClick={() => onChange(value.filter((_, k) => k !== j))} />
        </div>
      ))}
      <span>
        <ActionButton tone="neutral" icon={Plus} label={addLabel} onClick={() => onChange([...value, ''])} />
      </span>
    </div>
  );

  // ── the slides ─────────────────────────────────────────────────────────────────────────────────────────────────
  let title = '';
  let line = '';
  let body: React.ReactNode = null;
  let primary: { label: string; onClick: () => void } | null = { label: 'Continue', onClick: next };

  if (d.screen === 'invite') {
    // 🎁 Setnayan's invite says what the claim page's TeamInviteDoor says (frame B1): your shop is ready, set up for you.
    title = team ? `Your shop is ready, ${record.business}.` : `You’re invited by ${record.inviterName}.`;
    line = team
      ? `Set up for you by the Setnayan team${record.services[0] ? ` as a ${record.services[0].label}` : ''}.`
      : `For their ${record.eventWord}${record.datePhrase ? ` ${record.datePhrase}` : ''}.`;
    const offer = team ? record.offer : null;
    body = (
      <div className="grid max-w-[620px] gap-3" data-claim-door-invite="">
        {offer ? (
          // The claim page's own offer rows (TeamInviteDoor, `doorOffer`) — kept on the door, and applied on the finish
          // by the shipped `claim_ready_the_invited_shop`. Rows with dividers, nothing boxed.
          <section data-claim-door-offer="">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.16em]" style={{ color: 'var(--m-slate-3)' }}>
              Your offer
            </p>
            <dl className="mt-1.5 divide-y border-y text-[13.5px]" style={{ borderColor: 'var(--m-line)' }}>
              {offer.plan ? (
                <div className="flex items-baseline justify-between gap-4 py-2.5" data-claim-door-offer-row="plan">
                  <dt className="shrink-0" style={{ color: 'var(--m-slate-3)' }}>Plan</dt>
                  <dd className="min-w-0 text-right" style={{ color: 'var(--m-ink)' }}>
                    <b>{offer.plan.word}</b> · free until {offer.plan.until}
                  </dd>
                </div>
              ) : null}
              {offer.photos ? (
                <div className="flex items-baseline justify-between gap-4 py-2.5" data-claim-door-offer-row="photos">
                  <dt className="shrink-0" style={{ color: 'var(--m-slate-3)' }}>Portfolio photos</dt>
                  <dd className="min-w-0 text-right" style={{ color: 'var(--m-ink)' }}>
                    <b>{formatCount(offer.photos)}</b> · yours to keep
                  </dd>
                </div>
              ) : null}
              <div className="flex items-baseline justify-between gap-4 py-2.5" data-claim-door-offer-row="fee">
                <dt className="shrink-0" style={{ color: 'var(--m-slate-3)' }}>Booking fee</dt>
                <dd className="min-w-0 text-right" style={{ color: 'var(--m-ink)' }}>
                  {offer.fee}
                </dd>
              </div>
            </dl>
            {offer.note ? (
              <p className="mt-1.5 text-xs" style={{ color: 'var(--m-slate-3)' }}>
                {offer.note}
              </p>
            ) : null}
          </section>
        ) : null}
        <p className="flex items-center gap-1 text-sm" style={{ color: 'var(--m-slate)' }}>
          <span>
            {team ? (
              <>
                Claim <b style={{ color: 'var(--m-ink)' }}>{record.business}</b> to add your photos, services and prices.
              </>
            ) : (
              <>
                They added <b style={{ color: 'var(--m-ink)' }}>{record.business}</b>
                {record.services[0] ? ` as their ${record.services[0].label}` : ''}.
              </>
            )}
          </span>
          <InfoTip label="" ariaLabel="What you get" align="start">
            <span className="block space-y-1">
              <b className="block">What you get</b>
              <span className="block">A free supplier profile and marketplace listing</span>
              <span className="block">{team ? 'Chat with couples in-app' : `Chat with ${record.inviterName} in-app`}</span>
              <span className="block">Calendar, payments and contracts in one place</span>
              <span className="block">No upfront cost · no card needed</span>
            </span>
          </InfoTip>
        </p>
        {/* 🔘 Owner 10 Nov, "Button designs" (T19): the two equal-weight choices sit in ONE row at EQUAL widths, both
            neutral, and change state as one (`useFitRow`). Claim it is the main verb — the bar's filled button. */}
        <div ref={inviteRowRef} className={`grid gap-2 [&_.ab]:w-full [&_.ab]:justify-center ${signedInAs ? 'grid-cols-1' : 'grid-cols-2'}`} data-claim-door-choices="">
          {signedInAs ? null : <ActionButton tone="neutral" icon={LogIn} label="Sign in & claim" href={signInHref} />}
          {declineAction ? (
            <form action={declineAction} className="contents">
              <input type="hidden" name="claim_token" value={record.token} />
              <ActionButton tone="neutral" type="submit" icon={<X aria-hidden className="h-4 w-4" strokeWidth={1.9} />} label="I’m not this supplier" />
            </form>
          ) : (
            <ActionButton tone="neutral" icon={X} label="I’m not this supplier" onClick={() => undefined} />
          )}
        </div>
      </div>
    );
    // "Claim it" (owner 10 Nov): pressing it says "I run this business" — so "Your role at the shop" on the account
    // slide is filled Owner (never over a role they already typed), and the draft carries it through Google / Apple.
    primary = {
      label: 'Claim it',
      onClick: () => {
        if (!d.role.trim()) set({ role: CLAIM_OWNER_ROLE, roleFromClaim: true });
        next();
      },
    };
  } else if (d.screen === 'details') {
    title = 'These are your business details.';
    line = `Tick what is wrong. The rest stays as ${record.inviterName} ${team ? 'set it up' : 'entered it'}.`;
    const value = (k: ClaimDetailKey): React.ReactNode => {
      switch (k) {
        case 'name':
          return <b>{d.name}</b>;
        case 'who':
          return d.who;
        case 'phone':
          return `+63 ${formatPhoneDigits(d.phone)}`;
        case 'service':
          return d.services.map((s) => s.label).join(' · ');
        case 'price':
          return <b>{peso(d.price)}</b>;
        case 'incl':
          return d.inclusions.join(' · ');
        case 'plan':
          return d.plan.map((p) => `${p.label} ${peso(p.amount)}`).join(' · ');
      }
    };
    body = (
      <ul className="grid max-w-[620px] divide-y border-y" style={{ borderColor: 'var(--m-line)' }} data-claim-door-ticks="">
        {detailKeys.map((k) => {
          const on = d.ticked.includes(k);
          return (
            <li key={k}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                aria-label={`${CLAIM_DETAIL_LABEL[k]} is wrong`}
                onClick={() => set({ ticked: on ? d.ticked.filter((x) => x !== k) : [...d.ticked, k] })}
                className="flex min-h-12 w-full items-start gap-3 py-2.5 text-left text-[13.5px]"
              >
                <span
                  aria-hidden
                  className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border"
                  style={{ borderColor: on ? 'var(--m-mulberry)' : 'var(--m-slate-3)', background: on ? 'var(--m-mulberry)' : 'var(--m-paper)', color: 'var(--m-paper)' }}
                >
                  {on ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                </span>
                <span className="w-32 shrink-0" style={{ color: 'var(--m-slate-3)' }}>
                  {CLAIM_DETAIL_LABEL[k]}
                </span>
                <span className="min-w-0 [overflow-wrap:anywhere]" style={{ color: 'var(--m-ink)' }}>
                  {value(k)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    );
    primary = editKeys.length
      ? { label: `Edit ${words(editKeys.length, 'detail', 'details')}`, onClick: next }
      : { label: 'All correct — continue', onClick: next };
  } else if (d.screen.startsWith('ed:')) {
    const k = d.screen.slice(3) as ClaimDetailKey;
    const i = editKeys.indexOf(k) + 1;
    const n = editKeys.length;
    title = CLAIM_DETAIL_LABEL[k];
    line = n > 1 ? 'One at a time. The rest stays as they entered it.' : 'The rest stays as they entered it.';
    const head = (
      <p className="text-xs" style={{ color: 'var(--m-slate-3)' }} data-claim-door-edit-head="">
        {formatCount(i)} of {formatCount(n)} to change · {n - i ? `${formatCount(n - i)} more after this` : 'last one'}
      </p>
    );
    let part: React.ReactNode = null;
    if (k === 'name') part = field('Shop name', <Box value={d.name} maxLength={50} onChange={(e) => set({ name: e.target.value })} autoComplete="organization" />, fromHint());
    if (k === 'who') part = field('Contact person', <Box value={d.who} maxLength={80} onChange={(e) => set({ who: e.target.value })} placeholder="Your full name" />, fromHint());
    if (k === 'phone')
      part = field(
        'Contact number',
        <span className="flex items-center gap-2">
          <span className="text-sm" style={{ color: 'var(--m-slate)' }}>
            +63
          </span>
          <Box value={formatPhoneDigits(d.phone)} inputMode="numeric" maxLength={14} placeholder="917 888 8889" onChange={(e) => { const v = digits(e.target.value); set({ phone: v.slice(0, maxDigitsFor(v)) }); }} />
        </span>,
        fromHint(),
      );
    if (k === 'price')
      part = field(
        'Price',
        <span className="flex items-center gap-2">
          <span className="text-sm" style={{ color: 'var(--m-slate)' }}>
            ₱
          </span>
          <Box value={formatCount(Number(digits(d.price)) || 0)} inputMode="numeric" onChange={(e) => set({ price: digits(e.target.value) })} />
        </span>,
        fromHint(team ? ' · one bundle price' : ' · one bundle price · a new price goes to them to approve'),
      );
    if (k === 'incl')
      part = (
        <div className="grid gap-1">
          <span className="text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
            What’s included
          </span>
          {linesEditor(d.inclusions, (v) => set({ inclusions: v }), 'e.g. Two photographers', 'Inclusion')}
          {fromHint()}
        </div>
      );
    if (k === 'plan')
      part = (
        <div className="grid max-w-[620px] gap-2">
          <span className="text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
            Payment plan
          </span>
          {d.plan.map((p, j) => (
            <div key={j} className="grid grid-cols-[minmax(0,1fr)_8rem] gap-2">
              <Box value={p.label} aria-label={`Payment ${j + 1}`} onChange={(e) => set({ plan: d.plan.map((x, m) => (m === j ? { ...x, label: e.target.value } : x)) })} />
              <Box value={formatCount(Number(digits(p.amount)) || 0)} inputMode="numeric" aria-label="Amount" onChange={(e) => set({ plan: d.plan.map((x, m) => (m === j ? { ...x, amount: digits(e.target.value) } : x)) })} />
            </div>
          ))}
          {fromHint()}
        </div>
      );
    if (k === 'service')
      part = (
        <div className="grid max-w-[620px] gap-2" data-claim-door-services="">
          <span className="text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
            Your services
          </span>
          <ul className="grid divide-y border-y" style={{ borderColor: 'var(--m-line)' }}>
            {d.services.map((s, j) => (
              <li key={`${s.category}-${s.leaf ?? j}`} className="flex min-h-11 items-center justify-between gap-2 text-[13.5px]">
                <span style={{ color: 'var(--m-ink)' }}>{s.label}</span>
                <ActionButton
                  tone="danger"
                  icon={Trash2}
                  label="Remove"
                  onClick={() => {
                    const services = d.services.filter((_, m) => m !== j);
                    set({ services, cards: syncCards(services) });
                  }}
                />
              </li>
            ))}
          </ul>
          {adding ? (
            <ServicePicker
              tree={tree}
              excludeServices={new Set(d.services.map((s) => s.leaf).filter(Boolean) as string[])}
              autoFocus
              onPick={(leaf) => {
                const services = [...d.services, { category: leaf.canonicalService, leaf: leaf.canonicalService, label: leaf.label, tileId: leaf.tileId, fromRecord: false }];
                set({ services, cards: syncCards(services) });
                setAdding(false);
              }}
            />
          ) : (
            <span>
              <ActionButton tone="neutral" icon={Plus} label="Add a service" onClick={() => setAdding(true)} />
            </span>
          )}
          {/* 🧾 Removing one of the couple's services is a change to what they bought — it goes to them to approve
              (DECISION_LOG 2026-11-07, `lib/supplier-purchase-change.ts`); their record keeps it until they say yes. */}
          {fromHint(team ? '' : ' · a service you remove goes to them to approve')}
        </div>
      );
    body = (
      <div className="grid gap-3">
        {head}
        {part}
      </div>
    );
  } else if (d.screen.startsWith('card:')) {
    const i = Number(d.screen.slice(5));
    const c = d.cards[i]!;
    const s = d.services[i];
    const first = d.cards.find((x, m) => !x.bundled && d.services[m]?.fromRecord === true);
    // A service the supplier added on the door: its own card on the shop, never part of the couple's booking.
    const added = s?.fromRecord === false;
    const inBundle = c.bundled && !added;
    const fields = s?.leaf ? specialties[s.leaf] ?? [] : [];
    // The couple named a CATEGORY; when it holds several services, the supplier may say which (optional — a dropdown,
    // the house rule for a set of choices). Picking one is what offers its specialties.
    const kinds = s?.tileId ? leavesOfTile.get(s.tileId) ?? [] : [];
    const setLeaf = (leaf: string | null) =>
      set({ services: d.services.map((x, m) => (m === i ? { ...x, leaf } : x)), cards: d.cards.map((x, m) => (m === i ? { ...x, specialties: {} } : x)) });
    const setCard = (patch: Partial<Card>) => set({ cards: d.cards.map((x, m) => (m === i ? { ...x, ...patch } : x)) });
    title = c.name || s?.label || 'Service card';
    line = inBundle
      ? 'Part of their booking — nothing else is needed here.'
      : added
        ? `Your own service — on your shop, priced on its own. Not part of ${team ? 'your invite' : `${record.inviterName}’s booking`}.`
        : team
        ? 'Your service card — add your starting price and what’s included.'
        : 'Your service card — their confirmed price and lines, already in.';
    body = (
      <div className="grid gap-4" data-claim-door-card={i}>
        <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
          Card {formatCount(i + 1)} of {formatCount(d.cards.length)}
          {team ? '' : ` · for ${record.inviterName}`}
        </p>
        {team || added
          ? null
          : inBundle
          ? band(
              <>
                Part of the <b>{peso(d.price)}</b> bundle {record.inviterName} confirmed — priced on the <b>{first?.name ?? 'first'}</b> card.
              </>,
            )
          : band(
              <>
                Filled from <b>{record.inviterName}</b>’s confirmed record — {peso(c.price)} · {words(c.inclusions.length, 'line', 'lines')}. Change only what’s wrong.
              </>,
            )}
        {field('Service name', <Box value={c.name} maxLength={80} onChange={(e) => setCard({ name: e.target.value })} />, <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>Written for you · change it if you like</p>)}
        {inBundle ? (
          <span>
            <ActionButton tone="neutral" icon={Tag} label="Price it on its own" onClick={() => setCard({ bundled: false })} />
          </span>
        ) : (
          <>
            {field(
              'Price',
              <span className="flex items-center gap-2">
                <span className="text-sm" style={{ color: 'var(--m-slate)' }}>
                  ₱
                </span>
                <Box value={c.price ? formatCount(Number(digits(c.price))) : ''} inputMode="numeric" placeholder="e.g. 45,000" onChange={(e) => setCard({ price: digits(e.target.value) })} />
              </span>,
              undefined,
              'shown as “from”',
            )}
            <div className="grid gap-1">
              <span className="text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
                What’s included
              </span>
              {linesEditor(c.inclusions, (v) => setCard({ inclusions: v }), 'e.g. Same-day highlight reel', 'Inclusion')}
            </div>
          </>
        )}
        {kinds.length > 1
          ? field(
              'Which one?',
              <PickMenu
                label="Which one?"
                value={s?.leaf ?? ''}
                options={[{ key: '', label: s?.label ?? 'Pick one' }, ...kinds.map((k) => ({ key: k.leaf, label: k.label }))]}
                onPick={(key) => setLeaf(key || null)}
                dataAttr="data-claim-door-kind"
              />,
              undefined,
              'optional',
            )
          : null}
        {fields.length ? (
          <div className="grid max-w-[620px] gap-2" data-claim-door-specialties="">
            <span className="text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
              Specialties
              <small className="ml-1.5 font-normal" style={{ color: 'var(--m-slate-3)' }}>
                optional
              </small>
            </span>
            {fields.map((f) => (
              <div key={f.key} className="flex flex-wrap gap-1.5" role="group" aria-label={f.label}>
                {f.options.map((o) => {
                  const on = (c.specialties[f.key] ?? []).includes(o.value);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => {
                        const cur = c.specialties[f.key] ?? [];
                        const nextVals = on ? cur.filter((v) => v !== o.value) : f.single ? [o.value] : [...cur, o.value];
                        const sp = { ...c.specialties, [f.key]: nextVals };
                        if (!nextVals.length) delete sp[f.key];
                        setCard({ specialties: sp });
                      }}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[13.5px]"
                      style={on ? { background: 'var(--m-orange-4)', borderColor: 'var(--m-orange-3)', color: 'var(--m-orange-deep)', fontWeight: 500 } : { background: 'var(--m-paper)', borderColor: 'var(--m-line)', color: 'var(--m-ink)' }}
                    >
                      {on ? <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> : null}
                      {o.label}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
    primary = { label: order[at + 1]?.startsWith('card:') ? 'Next card' : 'Continue', onClick: next };
  } else if (d.screen === 'bundle') {
    const theirCards = d.cards.filter((_, i) => d.services[i]?.fromRecord === true);
    const ownCards = d.cards.filter((_, i) => d.services[i]?.fromRecord !== true);
    title = 'Your bundle';
    line = `What ${record.inviterName} booked, as one package.`;
    body = (
      <div className="grid gap-4" data-claim-door-bundle="">
        {field('Name', <Box value={d.bundleName} maxLength={120} onChange={(e) => set({ bundleName: e.target.value })} />, <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>Written for you · change it if you like</p>)}
        <div className="grid max-w-[620px] gap-1">
          <span className="text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
            Package price
          </span>
          <p className="text-[15px]" style={{ color: 'var(--m-ink)' }}>
            <b>{peso(d.price)}</b>{' '}
            <small style={{ color: 'var(--m-slate-3)' }}>as you confirmed</small>
          </p>
        </div>
        <div className="grid max-w-[620px] gap-1">
          <span className="text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
            What’s included
          </span>
          <ul className="grid divide-y border-y text-[13.5px]" style={{ borderColor: 'var(--m-line)' }}>
            {/* 🔒 The couple's bundle = the services THEY recorded. One the supplier added is never listed here. */}
            {theirCards.map((c, i) => (
              <li key={i} className="flex min-h-11 items-center justify-between gap-2">
                <span style={{ color: 'var(--m-ink)' }}>{c.name}</span>
                <small style={{ color: 'var(--m-slate-3)' }}>your service card{c.price && !c.bundled ? ` · from ${peso(c.price)}` : ''}</small>
              </li>
            ))}
          </ul>
          {ownCards.length > 0 ? (
            <p className="text-xs" style={{ color: 'var(--m-slate-3)' }} data-claim-door-own-cards="">
              Not in this bundle: {ownCards.map((c) => c.name).join(' · ')} — your own {ownCards.length === 1 ? 'card' : 'cards'} on your shop.
            </p>
          ) : null}
        </div>
        <div className="grid gap-1">
          <span className="text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
            Also included for {record.inviterName}
          </span>
          {linesEditor(d.extras, (v) => set({ extras: v }), 'e.g. Waiters and buffet set-up', 'Extra', 'Add an extra')}
        </div>
      </div>
    );
  } else if (d.screen === 'plan') {
    title = 'Which plan fits';
    line = `${words(cats, 'category', 'categories')} · ${words(d.services.length, 'service', 'services')} from ${team ? 'your invite' : `${record.inviterName}’s record`}.`;
    body = holdsMoreThanFree(meter) ? (
      <PlanInline
        agreed={d.planAgreed}
        onAgree={(a) => {
          set({ planAgreed: a });
          setPlanErr(null);
        }}
        error={planErr}
        onContinue={() => (d.planAgreed ? next() : setPlanErr('Tick the box to continue.'))}
        onBack={back}
        backLabel="Back to your bundle"
        main={d.services[0]?.label ?? ''}
        rest={d.services.slice(1).map((s) => s.label)}
        split={split}
      />
    ) : (
      <p className="max-w-[620px] text-[13.5px]" style={{ color: 'var(--m-slate)' }} data-claim-door-plan-fits="">
        <b style={{ color: 'var(--m-ink)' }}>{split.free.name}</b> holds it — {split.free.caps}. Your first booking is free, so you can experience Setnayan.
      </p>
    );
    if (holdsMoreThanFree(meter)) primary = null; // the plan body carries its own Continue
  } else {
    title = 'Your account';
    line = signedInAs ? `Signed in as ${signedInAs}.` : 'This creates your Setnayan account.';
    const returnTo = claimDoorHref(record.token) + '&step=account';
    // Claim it was pressed → the role reads Owner, plain ink, still editable, with the hint saying why (owner 10 Nov).
    const roleHint =
      d.roleFromClaim && d.role.trim() === CLAIM_OWNER_ROLE ? (
        <span className="block text-xs" style={{ color: 'var(--m-slate-3)' }} data-claim-door-role-why="">
          You pressed Claim it, so you run this business. Change it if you are not the owner.
        </span>
      ) : undefined;
    const roleBox = field(
      'Your role at the shop',
      <Box
        value={d.role}
        maxLength={64}
        placeholder="e.g. Owner"
        autoComplete="organization-title"
        onChange={(e) => set({ role: e.target.value, roleFromClaim: false })}
      />,
      roleHint,
      d.roleFromClaim ? undefined : 'optional',
    );
    if (signedInAs) {
      body = (
        <div className="grid gap-4" data-claim-door-account="">
          {roleBox}
        </div>
      );
    } else if (sentTo) {
      line = 'One more tap.';
      body = (
        <div className="grid max-w-[620px] gap-2" data-claim-door-account="" data-claim-door-sent="">
          <p className="flex items-start gap-2 text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
            <MailCheck aria-hidden className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.5} style={{ color: 'var(--m-orange-deep)' }} />
            <span>We sent a link to {sentTo} — tap it to finish.</span>
          </p>
          <p className="text-[13.5px]" style={{ color: 'var(--m-slate)' }}>
            It signs you in and brings you back here, with everything you confirmed, to press “Claim it”.
          </p>
        </div>
      );
    } else if (taken && emailWay) {
      body = (
        <div className="grid max-w-[620px] gap-3" data-claim-door-account="">
          <TakenSignIn key={d.email} email={d.email} next={returnTo} onSignedIn={signedInHere} />
          <span>
            <ActionButton tone="neutral" icon={X} label="Use another way" onClick={() => setEmailWay(false)} />
          </span>
        </div>
      );
    } else if (emailWay) {
      // v19 (owner 7 Nov: "when email is picked, continue with google and apple hides"): Email chosen → the ways go;
      // ONE grey "✕ Use another way" brings them back. Drawn INSIDE the finish form (below), so the boxes post.
      body = (
        <div className="grid max-w-[620px] gap-4" data-claim-door-account="" data-claim-door-email="">
          {waysShown ? (
            <span className="flex">
              <ActionButton tone="neutral" icon={X} label="Use another way" onClick={() => setEmailWay(false)} data-testid="claim-door-another-way" />
            </span>
          ) : null}
          <label className="block max-w-[620px] space-y-1">
            <span className="block text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
              Email{' '}
              <small className="font-normal" style={{ color: 'var(--m-slate-3)' }}>
                you&rsquo;ll sign in with this
              </small>
            </span>
            <input
              // field-ok: the account's sign-in email — the shipped /open-shop email box's shape, a credential (not a typed fact of the shop)
              id="claim-door-contact_email"
              name="contact_email"
              type="email"
              value={d.email}
              onChange={(e) => set({ email: e.target.value })}
              required
              maxLength={254}
              placeholder="you@yourshop.ph"
              autoComplete="email"
              autoCapitalize="none"
              inputMode="email"
              className="input-field"
            />
            {record.inviteEmail && d.email.trim().toLowerCase() === record.inviteEmail ? (
              <span className="block text-xs" style={{ color: 'var(--m-slate-3)' }} data-claim-door-email-from="">
                From {record.inviterName}’s invite · your login, never shown on your page
              </span>
            ) : null}
          </label>
          <label className="block max-w-[620px] space-y-1">
            <span className="block text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
              Password
            </span>
            {/* The shipped field, quiet (prototype v19 `zPw`): ONE rule line once the box holds something, ticking as
                they type. The leaked check runs on submit (createVendorAccountForShop) and speaks only if it fails. */}
            <PasswordField
              id="claim-door-password"
              mode="new"
              quiet
              name="password"
              required
              autoComplete="new-password"
              minLength={OPEN_SHOP_PASSWORD_MIN}
              placeholder="At least 8 characters"
              className="input-field"
            />
          </label>
          {roleBox}
          <label className="flex max-w-[620px] cursor-pointer items-start gap-2 text-sm" style={{ color: 'var(--m-ink)' }}>
            <input id="claim-door-terms" type="checkbox" name={TERMS_FIELD} required className="mt-0.5 h-4 w-4 shrink-0" style={{ accentColor: 'var(--m-mulberry)' }} />
            <span>
              I agree to the{' '}
              <a href="/terms" className="text-terracotta" target="_blank" rel="noreferrer">
                Terms
              </a>{' '}
              and{' '}
              <a href="/privacy" className="text-terracotta" target="_blank" rel="noreferrer">
                Privacy Policy
              </a>
              .
            </span>
          </label>
        </div>
      );
    } else {
      body = (
        <div className="grid max-w-[620px] gap-2" data-claim-door-account="" data-claim-door-ways="">
          {waysShown ? (
            oauth.desktop ? (
              <DesktopOAuthButtons next={returnTo} />
            ) : oauth.native ? (
              <NativeOAuthButtons next={returnTo} accountType="vendor" />
            ) : (
              <OAuthButtonRow next={returnTo} withAccountType defaultAccountType="vendor" />
            )
          ) : null}
          <button /* button-ok: the Email way is one of the equal sign-up ways — it wears OAUTH_BUTTON_CLASS, the Google/Apple buttons' own shape */
            type="button"
            className={OAUTH_BUTTON_CLASS}
            aria-pressed={false}
            onClick={() => {
              setEmailWay(true);
              window.requestAnimationFrame(() => document.getElementById('claim-door-contact_email')?.focus({ preventScroll: true }));
            }}
            data-claim-door-email-way=""
          >
            <Mail aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.75} />
            {OAUTH_VERB} Email
          </button>
          <span className="mt-1">
            <ActionButton tone="neutral" icon={LogIn} label="Sign in with your account" href={signInHref} />
          </span>
        </div>
      );
    }
    primary = null;
  }

  /** The account slide's email way, signed out — the only body drawn inside the finish form. */
  const emailForm = d.screen === 'account' && !signedInAs && !sentTo && emailWay && !taken;
  const total = team ? 5 : 6;
  return (
    <main className="flex min-h-[100dvh] flex-col overflow-x-clip md:block md:min-h-[70vh]" data-claim-door="" data-claim-door-screen={d.screen}>
      <div className="hidden h-[60px] items-center gap-4 border-b px-7 md:flex lg:px-8" style={{ borderColor: 'var(--m-line)' }}>
        <FirstRunBrand color="var(--m-ink)" size={13} />
      </div>
      <div className="grid flex-1 gap-7 px-4 pt-6 md:grid-cols-[minmax(0,1fr)_280px] md:px-7 md:pb-9 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14 lg:px-12 lg:pb-12 lg:pt-9">
        <div className="flex min-w-0 flex-col gap-[18px] md:grid md:content-start">
          <div className="grid gap-3 md:block">
            <FirstRunBrand className="md:hidden" color="var(--m-ink)" size={13} />
            <div className="flex gap-1.5 md:sr-only" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step} aria-label={`Step ${step} of ${total}`}>
              {Array.from({ length: total }, (_, n) => (
                <div key={n} className="h-1 flex-1 rounded-full" style={{ background: n < step ? 'var(--m-orange-deep)' : 'var(--m-line)' }} />
              ))}
            </div>
          </div>
          <div key={d.screen} className="os-in-r grid gap-[3px]">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.16em]" style={{ color: 'var(--m-slate-3)' }}>
              {team ? 'Your invite' : `${record.hostNoun.charAt(0).toUpperCase() + record.hostNoun.slice(1)} invite`}
            </span>
            <h1 className="text-[22px] font-semibold leading-[1.1] tracking-[-0.01em]" style={{ color: 'var(--m-ink)' }}>
              {title}
            </h1>
            {line ? (
              <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
                {line}
              </p>
            ) : null}
          </div>
          {error ? (
            <p role="alert" className="text-sm" style={{ color: 'var(--m-mulberry-deep)' }}>
              {error}
            </p>
          ) : null}
          {/* The finish form is a layout-free wrapper (`contents`). It holds the BAR always, and the BODY only on the
              account slide's email way, so the email + password + Terms post with it. Every other body stays outside:
              the decline and the Google / Apple row are forms of their own (forms never nest). The plan slide's body
              carries its own Continue + "Back to your bundle" (PlanInline), so the bar steps aside there — never two backs. */}
          {emailForm ? null : (
            <div key={`b-${d.screen}`} className="os-in-r">
              {body}
            </div>
          )}
          {d.screen === 'plan' && !primary ? null : (
            <form action={finishClaimDoor} className="contents" data-claim-door-finish="">
              {emailForm ? (
                <div key={`b-${d.screen}`} className="os-in-r">
                  {body}
                </div>
              ) : null}
              {emailForm ? <TurnstileField action="signup" /> : null}
              <div
                className="sticky bottom-0 z-10 -mx-4 mt-auto flex items-center gap-2.5 border-t px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 md:static md:mx-0 md:mt-0 md:max-w-[620px] md:border-0 md:px-0 md:pb-0 md:pt-1"
                style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper)' }}
                data-claim-door-bar=""
              >
                <input type="hidden" name="claim_token" value={record.token} />
                <input type="hidden" name={CLAIM_DOOR_FIELD} value={JSON.stringify(answers)} />
                {at > 0 ? (
                  <ActionButton tone="neutral" iconOnly icon={ArrowLeft} label="Back" onClick={back} data-testid="claim-door-back" />
                ) : null}
                {d.screen === 'account' && (signedInAs || emailForm) ? (
                  <SubmitButton className="button-primary ml-auto inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full px-5 text-sm" pendingLabel="Opening your shop…">
                    Claim it — open my shop
                  </SubmitButton>
                ) : primary ? (
                  <ActionButton tone="brand" main icon={ArrowRight} label={primary.label} className="ml-auto" onClick={primary.onClick} data-testid="claim-door-continue" />
                ) : null}
              </div>
            </form>
          )}
        </div>
        <aside className="hidden md:block">
          <div className="sticky top-5 grid gap-3 rounded-2xl p-[18px]" style={{ background: 'var(--m-paper)' }} data-claim-door-glance="">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.16em]" style={{ color: 'var(--m-slate-3)' }}>
              {team ? 'From the Setnayan team' : `From ${record.inviterName}`}
            </span>
            <span className="text-xl font-semibold leading-[1.1] [overflow-wrap:anywhere]" style={{ color: 'var(--m-ink)' }}>
              {d.name || record.business}
            </span>
            {[
              ['For their', team ? null : `${record.eventWord}${record.datePhrase ? ` ${record.datePhrase}` : ''}`],
              ['Offer', team && record.offer?.plan ? `${record.offer.plan.word} · free until ${record.offer.plan.until}` : null],
              ['Services', d.services.map((s) => s.label).join(' · ')],
              ['Price', d.price ? peso(d.price) : null],
              ['Step', `${step} of ${total}`],
            ].map(([k, v]) =>
              v ? (
                <div key={k} className="flex justify-between gap-2.5 border-t pt-2 text-[13.5px]" style={{ borderColor: 'var(--m-line)' }}>
                  <span className="shrink-0" style={{ color: 'var(--m-slate-3)' }}>
                    {k}
                  </span>
                  <span className="min-w-0 text-right font-medium [overflow-wrap:anywhere]" style={{ color: 'var(--m-ink)' }}>
                    {v}
                  </span>
                </div>
              ) : null,
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
