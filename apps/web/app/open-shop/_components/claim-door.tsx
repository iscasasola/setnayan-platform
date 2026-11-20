'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronRight, Heart, LogIn, Mail, MailCheck, PenLine, Plus, SkipForward, Tag, Trash2, X } from 'lucide-react';

import { ActionButton, useFitRow } from '@/components/action-button';
import { InfoTip } from '@/app/_components/info-tip';
import { FirstRunBrand } from '@/app/_components/first-run-brand';
import { SubmitButton } from '@/app/_components/submit-button';
import { ANY_OAUTH_ENABLED, OAuthButtonRow } from '@/app/_components/oauth-button-row';
import { OAUTH_BUTTON_CLASS } from '@/app/_components/oauth-icons';
import { OAUTH_VERB } from '@/lib/oauth-words';
import { PasswordField } from '@/app/_components/password-field';
import { TurnstileField } from '@/app/_components/auth/turnstile-field';
import { TERMS_FIELD, TERMS_REQUIRED_MESSAGE } from '@/lib/terms-agreement';
import { OPEN_SHOP_ERRORS, isValidOpenShopEmail } from '@/lib/open-shop-validation';
import { OPEN_SHOP_ACCOUNT_ERRORS, OPEN_SHOP_PASSWORD_MIN } from '@/lib/open-shop-account';
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
  claimPricingMissing,
  CLAIM_EXTRAS_MAX,
  type ClaimCardPricing,
  type ClaimDetailKey,
  type ClaimDoorAnswers,
  type ClaimDoorRecord,
} from '@/lib/claim-door';
import { basisLabel, claimPricePrefill, claimStaysLine, countWords, type SelfAddedBasis } from '@/lib/self-added-price-basis';
import { PAY_WAY_PROVIDERS } from '@/lib/self-added-pay-ways';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { ServicePicker, type PickerParentView } from '@/app/_components/service-picker';
import { PLAN_AGREE_ERROR, PlanAgree, PlanOnLastScreen } from './plan-sheet';
import { Sheet } from '@/app/_components/sheet';
import { ACCEPT_LABEL, ACCEPT_LINE, CHECK_FACT_LABEL, CLAIM_CARDS_MADE_AS, CLAIM_CHECK_LABEL, CLAIM_CHECK_NOTES, DONE_FREE_LINE, LOOKS_RIGHT, claimCheckLine, type ClaimCheckRow, DONE_FREE_ROW, NOT_MY_BUSINESS, ONBOARDING_STEP_NAMES, ONBOARDING_HEADS, ONBOARDING_SCREENS, type CheckFact, type FirstCardChoice } from '@/lib/supplier-onboarding';
// 🔵 The supplier blue look (owner 19 Nov) — the dashboard's own token scope, re-used.
import '@/app/vendor-dashboard/_components/supplier-look.css';
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

/**
 * 🚪 SINCE 19 NOV 2026 THIS IS DOOR A OF THE ONE SUPPLIER ONBOARDING (owner "approve!", drawing `36jmQMWrANcgd2HxihAUw5`;
 * the vocabulary is `lib/supplier-onboarding.ts`). The screens, in order: `invite` (Accept, "<couple> invited you") ·
 * `account` (SECOND) · `details` (Check your shop — ONE list, a sheet per fact; SUPERSEDES the 7 Nov "let it flow step
 * by step") · `card:0` (the first card — Approve · Edit · Skip) · `plan` (You're all set — the plan, then Open my shop).
 * `ed:*`, `pay`, `bundle` and `package` are the SHEETS the list opens — the same bodies the old slides drew.
 */
type Screen = 'invite' | 'details' | `ed:${ClaimDetailKey}` | `card:${number}` | 'pay' | 'bundle' | 'package' | 'plan' | 'account';

type Picked = { category: string; leaf: string | null; label: string; tileId: string | null; fromRecord: boolean };
type Card = {
  name: string;
  price: string;
  inclusions: string[];
  bundled: boolean;
  specialties: Record<string, string[]>;
  /**
   * 🧾 v2 — the Card Maker's own pricing fields, pre-filled from what the couple agreed (`claimPricePrefill`). Absent on
   * a draft kept before v2 (and on every card the supplier adds) = One price, priced by `price`.
   */
  basis?: SelfAddedBasis;
  /** The couple recorded the basis — the slide draws it as a read-only row. */
  basisFromRecord?: boolean;
  perPax?: string;
  minPax?: string;
  rounds?: boolean;
  minHours?: string;
  hourBase?: string;
  extraHour?: string;
  extras?: { name: string; price: string }[];
};
/** One way to pay the couple recorded, as the supplier confirms it (`ClaimDoorRecord.payWays`, same order). */
type PayDraft = { keep: boolean; provider: string; accountName: string; accountNumber: string; keepQr: boolean };
/** What pressing Claim it fills "Your role at the shop" with (owner 10 Nov: "If that is pressed, this should be owner"). */
export const CLAIM_OWNER_ROLE = 'Owner';
/** The screens of the flow (the rest are sheets) — a kept draft on any other comes back on the list. */
const FLOW_SCREENS = new Set<string>(['invite', 'account', 'details', 'card:0', 'plan']);

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
  /** 🏦 "Your payment details, as <couple> recorded" — absent on a draft kept before it. */
  payWays?: PayDraft[];
  /** 🚪 The first card's way (19 Nov) — absent until picked. */
  firstCard?: FirstCardChoice | null;
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

/** A door card's pricing, as posted (`ClaimCardPricing`) — '' boxes are null, never 0. */
function cardPricing(c: Card): ClaimCardPricing {
  const n = (v: string | undefined) => {
    const x = Number(String(v ?? '').replace(/[^\d.]/g, ''));
    return Number.isFinite(x) && x > 0 ? x : null;
  };
  return {
    basis: c.basis ?? 'fixed',
    perPax: n(c.perPax),
    minPax: n(c.minPax),
    minHours: n(c.minHours),
    hourBase: n(c.hourBase),
    extraHour: n(c.extraHour),
    extras: (c.extras ?? []).filter((x) => x.name.trim()).map((x) => ({ name: x.name.trim(), price: n(x.price) })),
  };
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
      cards: seedClaimCards(record).map((c, i) => {
        const base: Card = { name: c.name, price: c.price ? String(c.price) : '', inclusions: c.inclusions, bundled: c.bundled, specialties: {} };
        // 🧾 v2: the couple's own card opens on how they said the price works, pre-filled from what they agreed.
        if (i !== 0 || record.from !== 'couple' || !record.priceBasis) return base;
        const pre = claimPricePrefill(record.priceBasis, record.price, record.agreedCount ?? null);
        return {
          ...base,
          basis: pre.basis,
          basisFromRecord: true,
          ...(pre.basis === 'per_pax' ? { perPax: pre.perPax, minPax: pre.minPax, rounds: pre.rounds } : {}),
          ...(pre.basis === 'per_hour' ? { minHours: pre.minHours, hourBase: pre.hourBase, extraHour: pre.extraHour } : {}),
          extras: [{ name: '', price: '' }],
        };
      }),
      bundleName: seedBundleName(record.services.map((s) => s.label)),
      extras: [],
      planAgreed: false,
      email: record.inviteEmail ?? '',
      payWays: (record.payWays ?? []).map((w) => ({
        keep: true,
        provider: w.provider ?? PAY_WAY_PROVIDERS[0]!,
        accountName: w.accountName ?? '',
        accountNumber: w.accountNumber ?? '',
        keepQr: !!w.qrUrl,
      })),
    };
  };
  const [d, setD] = useState<Draft>(seed);
  const [planErr, setPlanErr] = useState<string | null>(null);
  /** The card slide's one refusal — per hour with no price for an extra hour (v2: it is the supplier's to set). */
  const [cardErr, setCardErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  /** The account screen's refusal (the email way) — said before they move on, not at the very end. */
  const [acctErr, setAcctErr] = useState<string | null>(null);
  const accountRefusal = (): string | null => {
    if (!isValidOpenShopEmail(d.email.trim().toLowerCase())) return OPEN_SHOP_ERRORS.contactEmail;
    const pw = (document.getElementById('claim-door-password') as HTMLInputElement | null)?.value ?? '';
    if (pw.length < OPEN_SHOP_PASSWORD_MIN) return OPEN_SHOP_ACCOUNT_ERRORS.password;
    if (!(document.getElementById('claim-door-terms') as HTMLInputElement | null)?.checked) return TERMS_REQUIRED_MESSAGE;
    return null;
  };
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
        // A draft kept before 19 Nov may sit on a slide that is now a sheet — it comes back on the list instead.
        const screen: Screen = startOnAccount ? 'account' : FLOW_SCREENS.has(saved.screen) ? saved.screen : 'details';
        setD({ ...saved, email: saved.email ?? record.inviteEmail ?? '', screen });
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
  // 🚪 THE FIVE SCREENS (owner 19 Nov): Accept · Create account (SECOND) · Check your shop · the first card · You're all
  // set. Every old slide is one of the list's sheets now (`sheet`), so nothing the door asked is dropped.
  const order: Screen[] = ['invite', 'account', 'details', ...(d.cards.length ? (['card:0'] as Screen[]) : []), 'plan'];
  /** The fact sheet open over "Check your shop", or null. Not kept in the draft — the list is where they come back. */
  const [sheet, setSheet] = useState<Screen | null>(null);
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
      ...(c.basis ? { pricing: cardPricing(c) } : {}),
    })),
    ...(d.payWays && d.payWays.length
      ? {
          payWays: d.payWays.map((w) => ({
            keep: w.keep,
            provider: w.accountNumber.trim() ? w.provider : null,
            accountName: w.accountName.trim(),
            accountNumber: w.accountNumber.trim(),
            keepQr: w.keepQr,
          })),
        }
      : {}),
    bundle: { name: d.bundleName.trim(), extras: d.extras.map((x) => x.trim()).filter(Boolean) },
    specialties: Object.fromEntries(
      d.cards.flatMap((c, i) => {
        const leaf = d.services[i]?.leaf;
        return leaf && Object.keys(c.specialties).length ? [[leaf, c.specialties]] : [];
      }),
    ),
    // The details slide's bundle price — a change here is a change to what the couple bought (sent to them to approve).
    price: Number(digits(d.price)) || null,
    ...(d.firstCard ? { firstCard: d.firstCard } : {}),
  };

  // ── the shared frame pieces ────────────────────────────────────────────────────────────────────────────────────
  // Done is always step 5, with or without a card screen before it — the names under the bars never skip.
  const step = d.screen === 'plan' ? ONBOARDING_SCREENS.length : at + 1;
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
  // Accept was pressed → the role reads Owner, plain ink, still editable, with the hint saying why (owner 10 Nov).
  const roleHint =
    d.roleFromClaim && d.role.trim() === CLAIM_OWNER_ROLE ? (
      <span className="block text-xs" style={{ color: 'var(--m-slate-3)' }} data-claim-door-role-why="">
        You pressed Accept, so you run this business. Change it if you are not the owner.
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
  const slide = (view: Screen): { title: string; line: string; body: React.ReactNode; primary: { label: string; onClick: () => void } | null } => {
  let title = '';
  let line = '';
  let body: React.ReactNode = null;
  let primary: { label: string; onClick: () => void } | null = { label: 'Continue', onClick: next };

  if (view === 'invite') {
    // 🎁 Setnayan's invite says what the claim page's TeamInviteDoor says (frame B1): your shop is ready, set up for you.
    // 🚪 19 Nov: "<couple> invited you" — the main button says Accept (never "Claim it").
    // 🚪 P1 (19 Nov): "<couple> added you." · "For their wedding · Sat, Dec 19, 2026."
    title = team ? `Your shop is ready, ${record.business}.` : `${record.inviterName} added you.`;
    line = team
      ? `Set up for you by the Setnayan team${record.services[0] ? ` as a ${record.services[0].label}` : ''}.`
      : `For their ${record.eventWord}${record.datePhrase ? ` · ${record.datePhrase.replace(/^(on|in) /, '')}` : ''}.`;
    const offer = team ? record.offer : null;
    body = (
      <div className="grid max-w-[620px] gap-3" data-claim-door-invite="">
        {offer ? (
          // The claim page's own offer rows (TeamInviteDoor, `doorOffer`) — kept on the door, and applied on the finish
          // by the shipped `claim_ready_the_invited_shop`. Rows with dividers, nothing boxed.
          <section data-claim-door-offer="">
            {/* A plain section label, not a mono caption (the template sheet's rule) — paying for the P1 shop card's point. */}
            <p className="text-[13px] font-semibold" style={{ color: 'var(--m-ink)' }}>
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
        {team ? null : (
          // 🚪 P1 — the shop as the couple typed it: name and what it covers, the contact, what they booked. Rows on
          // white, nothing boxed (owner 20 Nov).
          <section className="grid gap-2 border-y py-3" style={{ borderColor: 'var(--m-line)' }} data-claim-door-shop="">{/* P1 shop: rows on white — a frame only on what you press (owner 20 Nov, template ratchet) */}
            <b className="text-[15px] font-semibold [overflow-wrap:anywhere]" style={{ color: 'var(--m-ink)' }}>
              {record.business}
            </b>
            {record.services.length ? (
              <span className="flex flex-wrap gap-1.5" data-claim-door-shop-covers="">
                {record.services.map((sv) => (
                  <span key={`${sv.category}:${sv.label}`} className="rounded-full px-2.5 py-0.5 text-xs" style={{ background: 'var(--m-line)', color: 'var(--m-ink)' }}>
                    {sv.label}
                  </span>
                ))}
              </span>
            ) : null}
            <dl className="grid gap-1 text-[13.5px]">
              {record.contactPerson ? (
                <div className="flex gap-3" data-claim-door-shop-row="contact">
                  <dt className="w-20 shrink-0" style={{ color: 'var(--m-slate-3)' }}>Contact</dt>
                  <dd className="min-w-0 [overflow-wrap:anywhere]" style={{ color: 'var(--m-ink)' }}>{record.contactPerson}</dd>
                </div>
              ) : null}
              {record.price ? (
                <div className="flex gap-3" data-claim-door-shop-row="booked">
                  <dt className="w-20 shrink-0" style={{ color: 'var(--m-slate-3)' }}>Booked</dt>
                  <dd className="min-w-0" style={{ color: 'var(--m-ink)' }}>{peso(record.price)} package</dd>
                </div>
              ) : null}
            </dl>
          </section>
        )}
        <p className="flex items-center gap-1 text-sm" style={{ color: 'var(--m-slate)' }}>
          <span>
            {team ? (
              <>
                Claim <b style={{ color: 'var(--m-ink)' }}>{record.business}</b> to add your photos, services and prices.
              </>
            ) : (
              ACCEPT_LINE
            )}
          </span>
          <InfoTip label="" ariaLabel="What you get" align="start">
            <span className="block space-y-1">
              <b className="block">What you get</b>
              {/* 19 Nov fix: no "free marketplace listing" — an unverified Free shop is found by its own link and QR. */}
              <span className="block">A free supplier page, found by your own link and QR</span>
              <span className="block">{team ? 'Chat with couples in-app' : `Chat with ${record.inviterName} in-app`}</span>
              <span className="block">Calendar, payments and contracts in one place</span>
              <span className="block">No upfront cost · no card needed</span>
            </span>
          </InfoTip>
        </p>
        {/* 🔘 P1 (19 Nov): "the two grey pills → two quiet links" — I have an account · Not my business. Accept is the
            bar's one filled button. */}
        <div ref={inviteRowRef} className="flex flex-wrap items-center gap-2" data-claim-door-choices="">
          {signedInAs ? null : <ActionButton tone="neutral" quiet icon={LogIn} label="I have an account" href={signInHref} />}
          {declineAction ? (
            <form action={declineAction} className="contents">
              <input type="hidden" name="claim_token" value={record.token} />
              <ActionButton tone="neutral" quiet type="submit" icon={<X aria-hidden className="h-4 w-4" strokeWidth={1.9} />} label={NOT_MY_BUSINESS} />
            </form>
          ) : (
            <ActionButton tone="neutral" quiet icon={X} label={NOT_MY_BUSINESS} onClick={() => undefined} />
          )}
        </div>
      </div>
    );
    // Accept (was "Claim it", owner 10 Nov → 19 Nov): pressing it says "I run this business" — so "Your role at the
    // shop" (the Contact person sheet) is filled Owner (never over a role they already typed), and the draft keeps it.
    primary = {
      label: ACCEPT_LABEL,
      onClick: () => {
        if (!d.role.trim()) set({ role: CLAIM_OWNER_ROLE, roleFromClaim: true });
        next();
      },
    };
  } else if (view === 'details') {
    // 🚪 CHECK YOUR SHOP (19 Nov) — ONE list, a sheet per fact, filled from what they entered.
    [title] = ONBOARDING_HEADS.check;
    // P3: "Change anything <couple> got wrong."
    line = team ? `Filled from what the Setnayan team set up. Tap a line to fix it.` : claimCheckLine(record.inviterName);
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
    // P3's order (19 Nov): Shop name · Contact · Number · Covers · Booked · Pays · They pay you. Events and the map pin
    // are not on this door's record (the couple's event type is ticked on the shop by the finish) — Today asks for the pin.
    const has = (k: ClaimDetailKey) => detailKeys.includes(k);
    const keptPay = (d.payWays ?? []).filter((w) => w.keep);
    // "Changed" — the row now differs from what the couple typed (P3 · Contact "Changed").
    const was = (a: string | null | undefined, b: string | null | undefined) => (a ?? '').trim() !== (b ?? '').trim();
    const claimFactRows: { fact: ClaimCheckRow; sheet: Screen; value: React.ReactNode; changed?: boolean }[] = [
      ...(has('name') ? [{ fact: 'name' as const, sheet: 'ed:name' as Screen, value: d.name.trim() ? value('name') : null, changed: was(d.name, record.business) }] : []),
      { fact: 'contact', sheet: 'ed:who', value: d.who.trim() || null, changed: !!record.contactPerson && was(d.who, record.contactPerson) },
      { fact: 'number', sheet: 'ed:phone', value: d.phone ? value('phone') : null, changed: !!record.contactPhone && digits(record.contactPhone).slice(-10) !== d.phone.slice(-10) },
      ...(has('service')
        ? [
            {
              fact: 'categories' as const,
              sheet: 'ed:service' as Screen,
              value: d.services.length ? value('service') : null,
              changed: d.services.map((x) => x.label).join('|') !== record.services.map((x) => x.label).join('|'),
            },
          ]
        : []),
      ...(has('price') || has('incl') || !team
        ? [
            {
              fact: 'package' as const,
              sheet: 'package' as Screen,
              value: d.price ? `${peso(d.price)} package` : d.inclusions.length ? words(d.inclusions.length, 'line', 'lines') : null,
              changed: !!record.price && Number(digits(d.price)) !== record.price,
            },
          ]
        : []),
      ...(has('plan') && d.plan.length
        ? [{ fact: 'plan' as const, sheet: 'ed:plan' as Screen, value: d.plan.map((p, n) => `${n ? 'then ' : ''}${peso(p.amount)}`).join(' · ') }]
        : []),
      ...(!team && (record.payWays?.length ?? 0) > 0
        ? [
            {
              fact: 'pay' as const,
              sheet: 'pay' as Screen,
              value: keptPay.length ? keptPay.map((w) => [w.provider, w.accountName.trim()].filter(Boolean).join(' · ')).join(' · ') : 'Not on my shop',
            },
          ]
        : []),
    ];
    body = (
      // Rows on white, like the self-serve door's list — space and lines, not a box.
      <ul className="grid max-w-[620px] divide-y border-y" style={{ borderColor: 'var(--m-line)' }} data-claim-door-check="">
        {claimFactRows.map((r) => (
          <li key={r.fact}>
            <button /* button-ok: a line of the "Check your shop" list — the whole row opens its fact's sheet */
              type="button"
              onClick={() => setSheet(r.sheet)}
              aria-haspopup="dialog"
              className="flex min-h-14 w-full items-center gap-3 py-3 text-left"
              data-claim-door-row={r.fact}
            >
              <span
                aria-hidden
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full border"
                style={
                  r.value
                    ? { borderColor: 'rgb(var(--color-ok))', background: 'rgb(var(--color-ok))', color: 'var(--m-paper)' }
                    : { borderColor: 'var(--m-line)', color: 'var(--m-slate-3)' }
                }
              >
                {r.value ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
              </span>
              <span className="grid min-w-0 flex-1">
                <span className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
                  {CLAIM_CHECK_LABEL[r.fact]}
                </span>
                <span className="truncate text-[14.5px] font-medium" style={{ color: r.value ? 'var(--m-ink)' : 'var(--m-slate)' }}>
                  {r.value || 'Add'}
                </span>
              </span>
              {r.changed ? (
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-deep)' }} data-claim-door-changed="">
                  Changed
                </span>
              ) : null}
              <ChevronRight aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} style={{ color: 'var(--m-slate-3)' }} />
            </button>
          </li>
        ))}
      </ul>
    );
    // P3's two lines under the list — a contact change is only seen; a price or service change waits for their yes.
    if (!team)
      body = (
        <>
          {body}
          <p className="grid max-w-[620px] gap-0.5 text-xs" style={{ color: 'var(--m-slate-3)' }} data-claim-door-check-notes="">
            {CLAIM_CHECK_NOTES.map((n) => (
              <span key={n}>{n}</span>
            ))}
          </p>
        </>
      );
    primary = { label: LOOKS_RIGHT, onClick: next };
  } else if (view.startsWith('ed:')) {
    const k = view.slice(3) as ClaimDetailKey;
    title = CLAIM_DETAIL_LABEL[k];
    line = 'The rest stays as they entered it.';
    const head = null;
    let part: React.ReactNode = null;
    if (k === 'name') part = field('Shop name', <Box value={d.name} maxLength={50} onChange={(e) => set({ name: e.target.value })} autoComplete="organization" />, fromHint());
    if (k === 'who')
      part = (
        <div className="grid gap-4">
          {field('Contact person', <Box value={d.who} maxLength={80} onChange={(e) => set({ who: e.target.value })} placeholder="Your full name" />, fromHint())}
          {roleBox}
        </div>
      );
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
  } else if (view.startsWith('card:')) {
    const i = Number(view.slice(5));
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
    // 🚪 The couple's priced first card IS their booking's price: a new price here is the bundle price changed — it goes
    // to them to approve (`claimChangeQuote` on the finish, `lib/supplier-purchase-change.ts`), exactly as the Package
    // sheet's price does.
    const pricesTheBooking = i === 0 && !team && s?.fromRecord === true && !!record.price && !c.basis;
    const setCard = (patch: Partial<Card>) =>
      set({
        cards: d.cards.map((x, m) => (m === i ? { ...x, ...patch } : x)),
        ...(pricesTheBooking && patch.price !== undefined ? { price: patch.price } : {}),
      });
    const priceChanged = pricesTheBooking && Number(digits(c.price)) !== record.price;
    // 🚪 19 Nov: the first card (Approve · Edit · Skip), drafted from the couple's category, the service they booked
    // and the price they logged.
    title = i === 0 ? ONBOARDING_HEADS.card[0] : c.name || s?.label || 'Service card';
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
          {c.name || s?.label}
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
                Filled from <b>{record.inviterName}</b>’s confirmed record — {peso(c.price)}
                {c.basisFromRecord && c.basis && c.basis !== 'fixed' && record.agreedCount ? ` · ${countWords(c.basis, record.agreedCount)} agreed` : ''} ·{' '}
                {words(c.inclusions.length, 'line', 'lines')}. Change only what’s wrong.
              </>,
            )}
        {field('Service name', <Box value={c.name} maxLength={80} onChange={(e) => setCard({ name: e.target.value })} />, <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>Written for you · change it if you like</p>)}
        {inBundle ? (
          <span>
            <ActionButton tone="neutral" icon={Tag} label="Price it on its own" onClick={() => setCard({ bundled: false })} />
          </span>
        ) : (
          <>
            {c.basis ? (
              <CardPricing
                c={c}
                inviter={record.inviterName}
                agreedCount={record.agreedCount ?? null}
                error={cardErr}
                onChange={(patch) => {
                  setCardErr(null);
                  setCard(patch);
                }}
              />
            ) : (
              field(
                'Price',
                <span className="flex items-center gap-2">
                  <span className="text-sm" style={{ color: 'var(--m-slate)' }}>
                    ₱
                  </span>
                  <Box value={c.price ? formatCount(Number(digits(c.price))) : ''} inputMode="numeric" placeholder="e.g. 45,000" onChange={(e) => setCard({ price: digits(e.target.value) })} />
                </span>,
                undefined,
                'shown as “from”',
              )
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
    // Per hour: the price for each extra hour is theirs to set, and the door asks for it (v2).
    const pricingOk = () => {
      if (!inBundle && c.basis && claimPricingMissing(cardPricing(c))) {
        setCardErr('Add your price for each extra hour.');
        return false;
      }
      return true;
    };
    const choose = (way: FirstCardChoice) => {
      if (way === 'approve') {
        if (!inBundle && !c.basis && !Number(digits(c.price))) {
          setCardErr('Type a price to approve this card — or Edit it, or Skip.');
          return;
        }
        if (!pricingOk()) return;
      }
      setCardErr(null);
      set({ firstCard: way });
      next();
    };
    body = (
      <>
        {body}
        {priceChanged ? (
          <p className="max-w-[620px] text-xs" style={{ color: 'var(--m-slate-3)' }} data-claim-door-price-to-couple="">
            A new price goes to {record.inviterName} to approve. Their booking keeps {peso(record.price)} until they say yes.
          </p>
        ) : null}
        {cardErr && !c.basis ? (
          <p role="alert" className="text-xs" style={{ color: 'var(--m-mulberry-deep)' }}>
            {cardErr}
          </p>
        ) : null}
        {i === 0 ? (
          // P4 (19 Nov): Edit · Skip for now · Approve card. 🎁 The Setnayan team's door has NO Edit: its finish lands
          // on Shop › Your details (`finishClaimDoor`), never the Card Maker hand-off — so it must not promise it.
          <div className={`grid max-w-[620px] gap-2 [&>.ab]:w-full [&>.ab]:justify-center ${team ? 'grid-cols-2' : 'grid-cols-3'}`} data-claim-door-card-ways="">
            {team ? null : <ActionButton tone="neutral" icon={PenLine} label="Edit" onClick={() => choose('edit')} data-testid="claim-door-card-edit" />}
            <ActionButton tone="neutral" icon={SkipForward} label="Skip for now" onClick={() => choose('skip')} data-testid="claim-door-card-skip" />
            <ActionButton tone="brand" main icon={Check} label="Approve card" onClick={() => choose('approve')} data-testid="claim-door-card-approve" />
          </div>
        ) : null}
        {i === 0 ? (
          <p className="max-w-[620px] text-xs" style={{ color: 'var(--m-slate-3)' }} data-claim-door-card-note="">
            {team
              ? 'Skip makes no card — add one from Today.'
              : 'Edit opens the Card Maker once your shop is open. Skip makes no card — the booking stays in Clients.'}
          </p>
        ) : null}
      </>
    );
    primary = i === 0 ? null : { label: 'Continue', onClick: () => (pricingOk() ? (setCardErr(null), next()) : undefined) };
  } else if (view === 'pay') {
    title = 'Your payment details';
    line = `As ${record.inviterName} recorded — confirm or fix them.`;
    const ways = d.payWays ?? [];
    const setWay = (j: number, patch: Partial<PayDraft>) => set({ payWays: ways.map((w, k) => (k === j ? { ...w, ...patch } : w)) });
    body = (
      <div className="grid gap-5" data-claim-door-pay="">
        {band(
          <>
            Your payment details, as <b>{record.inviterName}</b> recorded. They go on your shop as how clients pay you.
          </>,
        )}
        {(record.payWays ?? []).map((rec, j) => {
          const w = ways[j];
          if (!w) return null;
          return (
            <div key={j} className="grid max-w-[620px] gap-3 border-t pt-4 first:border-t-0 first:pt-0" style={{ borderColor: 'var(--m-line)' }} data-claim-door-pay-way={j}>
              <label className="flex min-h-11 items-center gap-2 text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
                <input type="checkbox" checked={w.keep} onChange={(e) => setWay(j, { keep: e.target.checked })} className="h-4 w-4 accent-[var(--m-ink)]" />
                Use this on my shop
              </label>
              {w.keep ? (
                <>
                  <div className="grid gap-1">
                    <InfoTip label="Account type" ariaLabel="About the account type" align="start" labelClassName="text-sm font-medium">
                      The bank or e-wallet — the same list as Your details › How clients pay you.
                    </InfoTip>
                    <PickMenu
                      label="Account type"
                      value={w.provider}
                      options={PAY_WAY_PROVIDERS.map((p) => ({ key: p, label: p }))}
                      onPick={(k) => setWay(j, { provider: k })}
                      dataAttr="data-claim-door-pay-provider"
                    />
                  </div>
                  {field('Account name', <Box value={w.accountName} maxLength={96} placeholder="e.g. Rosa Dizon" onChange={(e) => setWay(j, { accountName: e.target.value })} />)}
                  {field(
                    'Account number / mobile',
                    <Box value={w.accountNumber} maxLength={64} inputMode="numeric" placeholder="e.g. 0917 000 0000" onChange={(e) => setWay(j, { accountNumber: e.target.value })} />,
                  )}
                  {rec.details && !rec.accountNumber ? (
                    <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
                      They wrote: {rec.details}
                    </p>
                  ) : null}
                  {rec.qrUrl ? (
                    <div className="grid gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element -- a presigned private picture */}
                      <img src={rec.qrUrl} alt="Your QR, as they recorded it" className="h-40 w-40 rounded-lg bg-white object-contain ring-1 ring-black/10" />
                      <label className="flex min-h-11 items-center gap-2 text-sm" style={{ color: 'var(--m-ink)' }}>
                        <input type="checkbox" checked={w.keepQr} onChange={(e) => setWay(j, { keepQr: e.target.checked })} className="h-4 w-4 accent-[var(--m-ink)]" />
                        Keep this QR
                      </label>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          );
        })}
        <p className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--m-slate-3)' }}>
          <InfoTip label="Checked before couples see them" ariaLabel="About how these are checked" align="start">
            Saved exactly as when you add them on Your details: bank details show to your clients at once, and a QR shows
            once it is read — or once our team clears it. You can change or hide them there any time.
          </InfoTip>
        </p>
      </div>
    );
  } else if (view === 'bundle') {
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
  } else if (view === 'package') {
    // 🚪 THE PACKAGE SHEET (19 Nov) — what the old price · what's included · payment plan slides and the bundle slide
    // asked, on one sheet of "Check your shop". The same bodies; a new price still goes to the couple to approve.
    title = CHECK_FACT_LABEL.package;
    line = team ? 'As the Setnayan team set it up.' : `What ${record.inviterName} booked.`;
    const parts = (['price', 'incl', 'plan'] as const).filter((k) => detailKeys.includes(k)).map((k) => slide(`ed:${k}`).body);
    body = (
      <div className="grid gap-6" data-claim-door-package="">
        {parts.map((p, n) => (
          <div key={n}>{p}</div>
        ))}
        {team ? null : slide('bundle').body}
      </div>
    );
  } else if (view === 'plan') {
    // 🚪 YOU'RE ALL SET (19 Nov) — the plan sits on this last screen, then Open my shop.
    [title] = ONBOARDING_HEADS.done;
    line = ONBOARDING_HEADS.done[1];
    // 🚪 P5's rows (19 Nov): Shop ✓ · Cards (no ✓ — 20 Nov) · Client ✓ · the Free row · its line · the tick. Cards names what the
    // finish makes — every unbundled card, less the first when Skip was picked (`finishClaimDoor`).
    const cardNames = d.cards
      .filter((c, n) => !c.bundled && !(n === 0 && d.firstCard === 'skip'))
      .map((c, n) => (n === 0 && d.firstCard === 'edit' ? `${c.name} · opens in the Card Maker` : c.name))
      .filter(Boolean);
    const doneRows: { key: string; name: string; value: string; ok: boolean }[] = [
      { key: 'shop', name: 'Shop', value: d.name.trim() || record.business, ok: true },
      // 🃏 No ✓ on Cards (review 20 Nov): they are made when the shop opens, as drafts, and only the shipped switch puts
      // the first on the page — Today says which are.
      { key: 'cards', name: 'Cards', value: cardNames.length ? `${cardNames.join(' · ')} — ${CLAIM_CARDS_MADE_AS}` : team ? 'None yet — add one from Today' : 'None yet — the booking stays in Clients', ok: false },
      ...(team ? [] : [{ key: 'client', name: 'Client', value: record.inviterName, ok: true }]),
    ];
    body = (
      <div className="grid max-w-[620px] gap-3" data-claim-door-done="">
        <dl className="grid divide-y border-y text-[13.5px]" style={{ borderColor: 'var(--m-line)' }}>
          {doneRows.map((r) => (
            <div key={r.key} className="flex min-h-11 items-center gap-3 py-2" data-claim-door-done-row={r.key}>
              <dt className="w-16 shrink-0" style={{ color: 'var(--m-slate-3)' }}>{r.name}</dt>
              <dd className="min-w-0 flex-1 [overflow-wrap:anywhere]" style={{ color: 'var(--m-ink)' }}>{r.value}</dd>
              {r.ok ? <Check aria-label="Done" className="h-4 w-4 shrink-0" strokeWidth={2.5} style={{ color: 'rgb(var(--color-ok))' }} /> : null}
            </div>
          ))}
          <div className="flex min-h-11 items-center gap-3 py-2" data-claim-door-done-row="free">
            <dt className="w-16 shrink-0 font-semibold" style={{ color: 'rgb(var(--color-ok))' }}>{DONE_FREE_ROW.name}</dt>
            <dd className="min-w-0 flex-1" style={{ color: 'var(--m-ink)' }}>{DONE_FREE_ROW.line}</dd>
          </div>
        </dl>
        <p className="text-xs" style={{ color: 'var(--m-slate-3)' }} data-claim-door-done-line="">
          {DONE_FREE_LINE}
        </p>
        {holdsMoreThanFree(meter) ? (
          <PlanOnLastScreen
            agreed={d.planAgreed}
            onAgree={(a) => {
              set({ planAgreed: a });
              setPlanErr(null);
            }}
            error={planErr}
            main={d.services[0]?.label ?? ''}
            rest={d.services.slice(1).map((sv) => sv.label)}
            split={split}
          />
        ) : (
          // P5: the tick sits on the last screen for EVERY claim, as PB5 — not only when the picks are over Free.
          <PlanAgree
            agreed={d.planAgreed}
            onAgree={(a) => {
              set({ planAgreed: a });
              setPlanErr(null);
            }}
            error={planErr}
          />
        )}
      </div>
    );
    primary = null; // the bar's Open my shop is the submit
  } else {
    // 🚪 CREATE YOUR ACCOUNT — SECOND (owner 19 Nov). Google / Apple / Sign in finish here and come back signed in; the
    // email way's boxes are typed here and stay MOUNTED inside the finish form, which posts on You're all set.
    [title] = ONBOARDING_HEADS.account;
    line = signedInAs ? `Signed in as ${signedInAs}.` : 'Pick how you’ll sign in. Everything you confirmed stays.';
    const returnTo = claimDoorHref(record.token) + '&step=account';
    if (signedInAs) {
      body = (
        <p className="max-w-[620px] text-[13.5px]" style={{ color: 'var(--m-slate)' }} data-claim-door-account="">
          Your shop will be opened on this account.
        </p>
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
            It signs you in and brings you back here, with everything you confirmed, to open your shop.
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
    primary =
      signedInAs || (emailWay && !taken && !sentTo)
        ? {
            label: 'Continue',
            onClick: () => {
              const err = signedInAs ? null : accountRefusal();
              setAcctErr(err);
              if (!err) next();
            },
          }
        : null;
  }
  return { title, line, body, primary };
  };

  const main = slide(d.screen);
  const { title, line, body, primary } = main;
  const sheetView = sheet ? slide(sheet) : null;
  /**
   * The email way's boxes (email · password · Terms), signed out. Typed on the account screen (SECOND) and kept
   * MOUNTED inside the finish form — hidden — on every screen after it, so they post with Open my shop. The password
   * is never in the draft.
   */
  const emailMounted = !signedInAs && !sentTo && emailWay && !taken;
  const emailBody = emailMounted ? (d.screen === 'account' ? body : slide('account').body) : null;
  const last = d.screen === 'plan';
  const canSubmit = last && (!!signedInAs || emailMounted);
  const total = ONBOARDING_SCREENS.length;
  return (
    <main className="flex min-h-[100dvh] flex-col overflow-x-clip md:block md:min-h-[70vh]" data-claim-door="" data-claim-door-screen={d.screen} data-supplier-look="">
      <div className="hidden h-[60px] items-center gap-4 border-b px-7 md:flex lg:px-8" style={{ borderColor: 'var(--m-line)' }}>
        <FirstRunBrand color="var(--m-ink)" size={13} />
      </div>
      <div className="grid flex-1 gap-7 px-4 pt-6 md:grid-cols-[minmax(0,1fr)_280px] md:px-7 md:pb-9 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14 lg:px-12 lg:pb-12 lg:pt-9">
        <div className="flex min-w-0 flex-col gap-[18px] md:grid md:content-start">
          <div className="grid gap-3 md:block">
            <FirstRunBrand className="md:hidden" color="var(--m-ink)" size={13} />
            <div className="flex gap-1.5 md:sr-only" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step} aria-label={`Step ${step} of ${total}`}>
              {Array.from({ length: total }, (_, n) => (
                <div key={n} className="h-1 flex-1 rounded-full" style={{ background: n < step ? 'rgb(var(--color-mulberry))' : 'var(--m-line)' }} />
              ))}
            </div>
            {/* The step names under the bars (19 Nov): Accept · Account · Your shop · Your card · Done. */}
            <ol className="grid grid-cols-5 gap-1.5 text-[11px] md:hidden" aria-hidden data-onboarding-step-names="">
              {ONBOARDING_STEP_NAMES.claim.map((name, n) => (
                <li key={name} className="truncate" style={{ color: n + 1 <= step ? 'var(--m-ink)' : 'var(--m-slate-3)' }}>
                  {name}
                </li>
              ))}
            </ol>
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
          {error || acctErr ? (
            <p role="alert" className="text-sm" style={{ color: 'var(--m-mulberry-deep)' }}>
              {acctErr ?? error}
            </p>
          ) : null}
          {/* Every body but the email way's stays OUTSIDE the finish form: the decline and the Google / Apple row are
              forms of their own (forms never nest). The email way's boxes live inside it, hidden off the account screen. */}
          {d.screen === 'account' && emailMounted ? null : (
            <div key={`b-${d.screen}`} className="os-in-r grid gap-4">
              {body}
            </div>
          )}
          <form action={finishClaimDoor} className="contents" data-claim-door-finish="">
            {emailMounted ? (
              <div key="email-way" className={d.screen === 'account' ? 'os-in-r' : 'hidden'}>
                {emailBody}
              </div>
            ) : null}
            {/* The bot check is drawn only as the form is about to post — a token minted on the account screen could
                expire while they check the shop. */}
            {emailMounted && last ? <TurnstileField action="signup" /> : null}
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
              {canSubmit ? (
                !d.planAgreed ? (
                  <ActionButton
                    tone="brand"
                    main
                    icon={ArrowRight}
                    label="Open my shop"
                    className="ml-auto"
                    onClick={() => setPlanErr(PLAN_AGREE_ERROR)}
                    data-testid="claim-door-plan-first"
                  />
                ) : (
                  <SubmitButton className="button-primary ml-auto inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full px-5 text-sm" pendingLabel="Opening your shop…">
                    Open my shop
                  </SubmitButton>
                )
              ) : primary ? (
                <ActionButton tone="brand" main icon={ArrowRight} label={primary.label} className="ml-auto" onClick={primary.onClick} data-testid="claim-door-continue" />
              ) : null}
            </div>
          </form>
          {/* ③ The fact sheet over "Check your shop" — the shipped house Sheet (this door keeps its answers in state, so
              a portalled sheet loses nothing). Done returns to the list. */}
          <Sheet
            open={!!sheetView}
            onClose={() => setSheet(null)}
            labelledById="claim-door-sheet-title"
            title={sheetView?.title}
            foot={
              <div className="flex justify-end px-4 pb-4">
                <ActionButton tone="brand" icon={Check} label="Done" onClick={() => setSheet(null)} data-testid="claim-door-sheet-done" />
              </div>
            }
          >
            <div className="grid gap-4 px-4 pb-4" data-claim-door-sheet={sheet ?? ''}>
              {sheetView?.line ? (
                <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
                  {sheetView.line}
                </p>
              ) : null}
              {sheetView?.body}
            </div>
          </Sheet>
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

/**
 * 🧾 THE CARD SLIDE'S PRICING (v2, owner 2026-11-13; `v2.html` "Claim door, card slide"). A read-only "How the price
 * works" row (the couple's choice), then the Card Maker's own fields and labels (`pricing-basis-editor.tsx` part
 * "main"/"more", `addons-editor.tsx`), pre-filled from what the couple agreed — each its title and at most one short
 * line, the explanation in its ⓘ (T17). The band says the couple's agreed total stays as their booking.
 */
function CardPricing({
  c,
  inviter,
  agreedCount,
  error,
  onChange,
}: {
  c: Card;
  inviter: string;
  agreedCount: number | null;
  error: string | null;
  onChange: (patch: Partial<Card>) => void;
}) {
  const basis = c.basis ?? 'fixed';
  const total = Number(digits(c.price)) || null;
  const extras = c.extras && c.extras.length ? c.extras : [{ name: '', price: '' }];
  const num = (v: string | undefined) => (v ? formatCount(Number(digits(v))) : '');
  const amountBox = (value: string | undefined, onValue: (v: string) => void, placeholder: string, label: string, bad = false) => (
    <span className="flex items-center gap-2">
      <span className="text-sm" style={{ color: 'var(--m-slate)' }}>
        ₱
      </span>
      <Box
        value={num(value)}
        inputMode="numeric"
        placeholder={placeholder}
        aria-label={label}
        aria-invalid={bad || undefined}
        onChange={(e) => onValue(digits(e.target.value))}
      />
    </span>
  );
  const pfield = (label: string, tip: string, input: React.ReactNode, short?: React.ReactNode, data?: string) => (
    <div className="grid max-w-[620px] gap-1" data-claim-door-price-field={data}>
      <InfoTip label={label} ariaLabel={`About ${label}`} align="start" labelClassName="text-sm font-medium">
        {tip}
      </InfoTip>
      {input}
      {short ? (
        <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
          {short}
        </p>
      ) : null}
    </div>
  );
  const stays = claimStaysLine(inviter, basis, total, agreedCount);
  return (
    <div className="grid gap-4" data-claim-door-pricing={basis}>
      {c.basisFromRecord ? (
        pfield(
          'How the price works',
          `How ${inviter} recorded it. Your service card is priced the same way.`,
          <p className="flex min-h-11 items-center justify-between rounded-xl px-3 text-[15px]" style={{ background: 'var(--m-paper-2)', color: 'var(--m-ink)' }} data-claim-door-basis="">
            <span>{basisLabel(basis)}</span>
            <small style={{ color: 'var(--m-slate-3)' }}>as {inviter} recorded</small>
          </p>,
          undefined,
          'basis',
        )
      ) : null}
      {basis === 'per_pax' ? (
        <>
          {pfield(
            'From, per guest (PHP)',
            `Your per-head rate. Pre-filled with ${inviter}’s total ÷ the guests they agreed; change it if it’s wrong.`,
            amountBox(c.perPax, (v) => onChange({ perPax: v, rounds: false }), 'e.g. 650', 'From, per guest (PHP)'),
            c.rounds && total && agreedCount ? `Rounded to whole pesos from ${peso(total)} ÷ ${formatCount(agreedCount)}` : undefined,
            'per_pax',
          )}
          {pfield(
            'Minimum guests',
            `The floor — your card shows rate × minimum. Pre-filled with the guests ${inviter} agreed.`,
            <Box value={num(c.minPax)} inputMode="numeric" placeholder="e.g. 50" aria-label="Minimum guests" onChange={(e) => onChange({ minPax: digits(e.target.value) })} />,
            undefined,
            'min_pax',
          )}
        </>
      ) : basis === 'per_hour' ? (
        <>
          {pfield(
            'Minimum hours',
            `Hours your “from” price covers. Pre-filled with the hours ${inviter} agreed.`,
            <Box
              value={c.minHours ?? ''}
              inputMode="decimal"
              placeholder="e.g. 5"
              aria-label="Minimum hours"
              onChange={(e) => onChange({ minHours: e.target.value.replace(/[^\d.]/g, '') })}
            />,
            undefined,
            'min_hours',
          )}
          {pfield(
            'From (PHP)',
            `Covers your minimum hours. Pre-filled with ${inviter}’s total.`,
            amountBox(c.hourBase, (v) => onChange({ hourBase: v }), 'e.g. 8,000', 'From (PHP)'),
            undefined,
            'hour_base',
          )}
          {pfield(
            'Each extra hour (PHP)',
            `Charged for each hour beyond the minimum. ${inviter} did not agree this — it is yours to set.`,
            amountBox(c.extraHour, (v) => onChange({ extraHour: v }), 'e.g. 1,500', 'Each extra hour (PHP)', !!error),
            error ? (
              <span role="alert" style={{ color: 'var(--m-mulberry-deep)' }} data-claim-door-price-error="">
                {error}
              </span>
            ) : (
              'Needed'
            ),
            'extra_hour',
          )}
        </>
      ) : (
        <>
          {pfield(
            'From (PHP)',
            `Whole pesos — couples see it as “from”. Pre-filled with the one price ${inviter} recorded.`,
            amountBox(c.price, (v) => onChange({ price: v }), 'e.g. 25,000', 'From (PHP)'),
            undefined,
            'from',
          )}
          <div className="grid max-w-[620px] gap-2" data-claim-door-extras="">
            <InfoTip label="Extras" ariaLabel="About extras" align="start" labelClassName="text-sm font-medium">
              Priced add-ons, optional — “from ₱” each, up to {CLAIM_EXTRAS_MAX}. A couple adds them to this card when they ask
              for a quote; they are never added to {inviter}’s price.
            </InfoTip>
            {extras.map((x, j) => (
              <div key={j} className="grid grid-cols-[1fr_7.5rem_auto] items-center gap-2">
                <Box
                  value={x.name}
                  maxLength={80}
                  placeholder="e.g. Extra hour of coverage"
                  aria-label={`Extra ${j + 1}`}
                  onChange={(e) => onChange({ extras: extras.map((y, k) => (k === j ? { ...y, name: e.target.value } : y)) })}
                />
                <Box
                  value={num(x.price)}
                  inputMode="numeric"
                  placeholder="from ₱"
                  aria-label={`Extra ${j + 1} from (PHP)`}
                  onChange={(e) => onChange({ extras: extras.map((y, k) => (k === j ? { ...y, price: digits(e.target.value) } : y)) })}
                />
                <ActionButton
                  tone="neutral"
                  quiet
                  iconOnly
                  icon={X}
                  label={`Remove extra ${j + 1}`}
                  onClick={() => {
                    const left = extras.filter((_, k) => k !== j);
                    onChange({ extras: left.length ? left : [{ name: '', price: '' }] });
                  }}
                />
              </div>
            ))}
            {extras.length < CLAIM_EXTRAS_MAX ? (
              <span>
                <ActionButton tone="neutral" icon={Plus} label="Add an extra" onClick={() => onChange({ extras: [...extras, { name: '', price: '' }] })} />
              </span>
            ) : null}
          </div>
        </>
      )}
      {stays && c.basisFromRecord ? (
        <p className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-[13.5px]" style={{ background: 'var(--m-paper-2)', color: 'var(--m-ink)' }} data-claim-door-stays="">
          <Heart aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} style={{ color: 'var(--m-orange-deep)' }} />
          <span>{stays}</span>
        </p>
      ) : null}
    </div>
  );
}
