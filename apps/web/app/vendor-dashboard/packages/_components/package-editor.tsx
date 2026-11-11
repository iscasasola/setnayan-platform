'use client';

/**
 * PACKAGE EDITOR — the form a vendor fills to build a package (PR-3), now THE BUNDLE MAKER.
 *
 * The whole point of this surface: prod has ZERO packages because nothing has
 * ever inserted one, so the couple-side configurator at `/v/[slug]` renders for
 * nothing. This is where a package comes from.
 *
 * ── 7 NOV 2026 — FIXED, NOT RE-DRAWN (owner: "all changes as this designs are to be fixed on the current design. we
 * do not invent or create a new one, we just fix the old one."; DECISION_LOG "THE FOUR MAKERS ARE APPROVED"; the
 * contract is `prototypes/makers_match_2026-11-07` § 4). The same fields, the same copy, the same save — and:
 *   1. SERVICE CARDS FIRST, as locked lines ("Add a card" — one dropdown of the shop's cards; each picked card is a
 *      line with its own from-price and a lock). Extra inclusions come after, as lines — the shipped item fields.
 *   2. Spendable budget + "money freed" move under MORE SETTINGS (a fold); the explanation lives in the ⓘ.
 *   3. Lines REMOVE BY THEIR SWIPE, with Undo — THE ONE SWIPE (`swipe-to-delete.tsx`) and the shipped Undo toast
 *      (`undo-store.ts`). No trash icon on a line. Nothing is written until Save, so Undo puts the line back in the draft.
 *   4. A GIFT ROW — new on bundles: No gift · Setnayan gift · the shop's own packs (lib/package-gift.ts).
 *   5. The THUMB ROW is the shipped `SupplierThumbRow` + `ActionButton`: Cancel grey · Save bundle terracotta (main).
 * 🔒 Held by `the-bundle-maker-keeps-its-gift-and-swipe.test.ts`.
 *
 * The form runs `validatePackageDraft` on every keystroke and shows problems
 * inline, keyed by `itemRef` / `optionRef`. That is the SAME function the server
 * action re-runs before writing — the client copy is for feedback only and is
 * never trusted. A vendor should never be able to press Save and get a
 * surprise, but the server still decides.
 *
 * NOT every server problem has an inline note: the card-text integrity gate
 * (`text_not_allowed`) is server-only by design, so the `invalid` branch of
 * `save()` renders `res.problems` into the alert rather than pointing at notes
 * that would not exist.
 *
 * Money is edited in PESOS and stored in CENTAVOS. The conversion happens once,
 * at the input boundary, so nothing downstream has to wonder which unit it holds.
 */

import { useId, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Lock, ChevronDown, Check, X, Eye, Settings, Globe, EyeOff } from 'lucide-react';

import {
  validatePackageDraft,
  type DraftPackage,
  type DraftItem,
  type DraftOption,
  type DraftProblem,
} from '@/lib/package-authoring';
import {
  coupleBundleGift,
  packageGiftLine,
  packageGiftMenu,
  PACKAGE_GIFT_TIP,
} from '@/lib/package-gift';
import type { FreeByKind, ShopGiftPack } from '@/lib/shop-gifts';
import type { VendorPackageWithItems } from '@/lib/vendor-packages';
import { ActionButton } from '@/components/action-button';
import { Fold } from '@/app/_components/fold';
import { InfoTip } from '@/app/_components/info-tip';
import { Sheet } from '@/app/_components/sheet';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { PackageCard } from '@/app/_components/vendor-packages/package-card';
import { ServiceCardFace } from '@/app/vendor-dashboard/services/_components/service-card-face';
import { displayServiceLabel } from '@/lib/vendors';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { pushUndo } from '@/app/dashboard/[eventId]/guests/_components/undo-store';
import { UndoToastHost } from '@/app/dashboard/[eventId]/guests/_components/undo-toast';
import { SupplierThumbRow } from '@/app/vendor-dashboard/_components/supplier-thumb-row';
import { savePackage, setPackageActive } from '../actions';
import { findFairHits } from '@/lib/fair-presentation';
import type { ClaimWord } from '@/lib/service-card-checks';
import { FairNote } from '@/app/_components/fair-note';

/** One of the shop's service cards, as "Add a card" lists it. Its price is the card's own — never typed here. */
export type BundleCard = { id: string; name: string; category: string; fromPhp: number | null };

/** Client-side ref for a row that has no database id yet. */
let seq = 0;
const newRef = () => `new-${++seq}`;

const pesos = (centavos: number) => (centavos === 0 ? '' : String(centavos / 100));
const toCentavos = (v: string) => {
  const n = Number(v.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};
const php = (n: number) => `₱${new Intl.NumberFormat('en-PH', { maximumFractionDigits: 0 }).format(n)}`;

function emptyItem(): DraftItem {
  return {
    ref: newRef(),
    service_description: '',
    canonical_service: '',
    is_default_included: true,
    is_required: false,
    replacement_value_centavos: 0,
    options: [],
  };
}

/** A card, as a locked line: in the bundle as the card — required, worth nothing of its own here (the server forces the same). */
function cardItem(card: BundleCard): DraftItem {
  return {
    ref: newRef(),
    service_description: card.name,
    canonical_service: card.category,
    is_default_included: true,
    is_required: true,
    replacement_value_centavos: 0,
    options: [],
    vendorServiceId: card.id,
  };
}

/** The name written for you from the cards — "Catering, Lechon & Cake" (the prototype's `autoName`). */
export function bundleNameFromCards(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

const isCardLine = (i: DraftItem) => Boolean(i.vendorServiceId);

/** Cards first, then the typed lines — the order the maker draws and the order the lines are saved in. */
const cardsFirst = (items: DraftItem[]) => [...items.filter(isCardLine), ...items.filter((i) => !isCardLine(i))];

export function PackageEditor({
  packageId,
  initial,
  isActive,
  frozen,
  canonicalServices,
  cards,
  giftPacks,
  giftFree,
  shopName,
  fairWords = null,
}: {
  packageId?: string;
  initial: DraftPackage;
  isActive: boolean;
  /** True when a live booking exists — structure is locked, metadata is not. */
  frozen: boolean;
  canonicalServices: { value: string; label: string }[];
  /** The shop's service cards — `null` = the read was refused (said on the page, never shown as "none"). */
  cards: BundleCard[] | null;
  /** The giftable packs on the live catalogue — `null` = unread. */
  giftPacks: ShopGiftPack[] | null;
  /** What the shop's stock can still offer, per kind — `null` = unread. */
  giftFree: FreeByKind | null;
  /** The shop's name, for the couple's "Gift from …" line in the preview. */
  shopName: string | null;
  /** 🚫 The claim words this shop may not use — the bundle name's live note. Absent/`null` = unread (the save asks). */
  fairWords?: ClaimWord[] | null;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<DraftPackage>(() => ({
    ...initial,
    gift: initial.gift ?? '',
    items: cardsFirst(initial.items),
  }));
  // A saved name that is still the one written from its cards keeps following the cards; a typed one stays put.
  const [nameTouched, setNameTouched] = useState(() => {
    const own = initial.package_name.trim();
    return own.length > 0 && own !== bundleNameFromCards(initial.items.filter(isCardLine).map((i) => i.service_description));
  });
  /** Save was pressed: the notes show under their fields from now on (the prototype — never before the first try). */
  const [tried, setTried] = useState(false);
  const [pending, start] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [moreOpen, setMoreOpen] = useState(
    initial.consumable_budget_centavos > 0 || initial.is_consumable_flexible,
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewHeadId = useId();

  const problems = useMemo(() => validatePackageDraft(draft), [draft]);
  // 🚫 FAIR PRESENTATION ON THE BUNDLE NAME (owner 2026-11-08): the note under the name shows AS YOU TYPE (not only
  // after Save — the ruling's "message under the line"), and Save / Publish wait while it is open. `savePackage` asks
  // again. A name written from the cards is checked the same — a card's claim word would ride into it.
  const nameFair = useMemo(() => findFairHits([{ field: 'package_name', value: draft.package_name }], { words: fairWords }), [draft.package_name, fairWords]);
  const shown = tried ? problems : [];
  const packageProblems = shown.filter((p) => !p.itemRef);
  const problemsFor = (itemRef: string, optionRef?: string) =>
    shown.filter((p) =>
      p.itemRef === itemRef && (optionRef ? p.optionRef === optionRef : !p.optionRef),
    );

  const cardById = useMemo(() => new Map((cards ?? []).map((c) => [c.id, c])), [cards]);
  const cardLines = draft.items.filter(isCardLine);
  const extraLines = draft.items.filter((i) => !isCardLine(i));
  const cardsLeft = (cards ?? []).filter((c) => !cardLines.some((l) => l.vendorServiceId === c.id));

  /** Keep the name written from the cards while the supplier has not typed their own. */
  const named = (d: DraftPackage, touched = nameTouched): DraftPackage =>
    touched
      ? d
      : { ...d, package_name: bundleNameFromCards(d.items.filter(isCardLine).map((i) => i.service_description)) };

  const patch = (over: Partial<DraftPackage>) => {
    setSaved(false);
    setDraft((d) => ({ ...d, ...over }));
  };
  const patchItem = (ref: string, over: Partial<DraftItem>) => {
    setSaved(false);
    setDraft((d) => ({
      ...d,
      items: d.items.map((i) => (i.ref === ref ? { ...i, ...over } : i)),
    }));
  };
  const patchOption = (
    itemRef: string,
    optRef: string,
    over: Partial<DraftOption>,
  ) => {
    setSaved(false);
    setDraft((d) => ({
      ...d,
      items: d.items.map((i) =>
        i.ref !== itemRef
          ? i
          : {
              ...i,
              options: i.options.map((o) =>
                o.ref === optRef ? { ...o, ...over } : o,
              ),
            },
      ),
    }));
  };

  /** Exactly one standard option — picking one clears the others. */
  const makeStandard = (itemRef: string, optRef: string) => {
    setSaved(false);
    setDraft((d) => ({
      ...d,
      items: d.items.map((i) =>
        i.ref !== itemRef
          ? i
          : {
              ...i,
              options: i.options.map((o) => ({
                ...o,
                is_default: o.ref === optRef,
                // The standard option IS the baseline, so it costs nothing
                // extra — the database enforces this too.
                price_delta_centavos:
                  o.ref === optRef ? 0 : o.price_delta_centavos,
              })),
            },
      ),
    }));
  };

  const addCard = (id: string) => {
    const card = cardById.get(id);
    if (!card) return;
    setSaved(false);
    setDraft((d) => named({ ...d, items: cardsFirst([...d.items, cardItem(card)]) }));
  };

  /**
   * 👈 THE LINE'S SWIPE (owner 2026-11-03, "SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO VISIBLE ✕ ON ROWS"; makers § 4
   * "Lines swipe to remove with Undo"). The line leaves the DRAFT at once; nothing is written until Save, so Undo is
   * putting it back where it was — the shipped Undo toast, one per page.
   */
  const removeLine = (item: DraftItem) => {
    const at = draft.items.findIndex((i) => i.ref === item.ref);
    setSaved(false);
    setDraft((d) => named({ ...d, items: d.items.filter((i) => i.ref !== item.ref) }));
    const word = item.service_description.trim();
    pushUndo({
      label: isCardLine(item) ? `${word || 'Card'} taken out` : word ? `“${word}” removed` : 'Line removed',
      undo: async () => {
        setDraft((d) => {
          if (d.items.some((i) => i.ref === item.ref)) return d;
          const items = [...d.items];
          items.splice(at < 0 ? items.length : Math.min(at, items.length), 0, item);
          return named({ ...d, items: cardsFirst(items) });
        });
      },
    });
  };

  const save = () => {
    setServerError(null);
    setTried(true);
    // The same validator the server runs: with notes still open, Save shows them where they are and sends nothing.
    if (problems.length > 0 || nameFair.length > 0) return;
    start(async () => {
      const res = await savePackage({ ...draft, items: cardsFirst(draft.items), packageId });
      if (res.status === 'ok') {
        setSaved(true);
        // ⚡ `savePackage` revalidates (and clears the router cache): its answer redraws this page, and a new package's
        // replace reads a fresh one — no refresh after it.
        if (!packageId) router.replace(`/vendor-dashboard/packages/${res.packageId}`);
        return;
      }
      if (res.status === 'frozen') {
        setServerError(
          `Someone has already booked this package, so its contents are locked. Changed: ${res.changed.join(', ')}. Publish a new package instead.`,
        );
        return;
      }
      if (res.status === 'invalid') {
        // The inline notes below come from the CLIENT copy of
        // validatePackageDraft, which cannot see server-only rules (the
        // card-text integrity gate raises `text_not_allowed`). Pointing the
        // vendor at "the notes below" when there are none is a dead end they
        // cannot get out of — so show what the server actually said, and keep
        // the pointer only for problems the inline notes really do render.
        setServerError(
          res.problems.length > 0
            ? res.problems.map((p) => p.message).join(' ')
            : 'Some details still need fixing — see the notes below.',
        );
        return;
      }
      setServerError(
        res.status === 'error' ? res.message : 'That package could not be saved.',
      );
    });
  };

  const togglePublished = () => {
    if (!packageId) return;
    setServerError(null);
    start(async () => {
      const res = await setPackageActive(packageId, !isActive);
      if (res.status === 'ok') return;
      if (res.status === 'invalid')
        setServerError('Fix the notes below before publishing.');
      else setServerError('That change could not be saved.');
    });
  };

  // One rhythm (the prototype's `.f`): a label · its 48 px box · a quiet hint; each topic after the first opens with
  // a divider, never a box around the group.
  const field =
    'h-12 w-full rounded-xl border border-ink/15 bg-cream px-4 text-[15px] text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none disabled:opacity-60'; // no-card-ok: the class of an <input>, a thing you press
  const lab = 'mb-1.5 flex items-center gap-2 text-[14px] font-medium text-ink';
  const small = 'text-[12px] font-normal text-ink/50';
  const hint = 'mt-1.5 text-[12px] leading-snug text-ink/55';
  const topic = 'border-t border-ink/10 pt-5';
  const box =
    'flex h-12 w-full items-center justify-between gap-2 rounded-xl border border-ink/15 bg-cream px-4 text-left text-[15px] text-ink disabled:opacity-60'; // no-card-ok: a PickMenu trigger, a <button>
  /** The legacy option sub-form's field (lines that already carry options keep theirs). */
  const optionField =
    'h-10 w-full rounded-lg border border-ink/15 bg-cream px-3 text-sm text-ink focus:border-terracotta focus:outline-none'; // no-card-ok: the class of an <input>

  const giftMenu = packageGiftMenu(giftPacks, giftFree, draft.gift ?? '');
  const giftPicked = giftMenu.find((o) => o.key === (draft.gift ?? ''));
  const coupleGift = coupleBundleGift(draft.gift ?? '', giftPacks, shopName);

  // The couple's card, drawn from the draft by the SHIPPED `PackageCard` — "What the couple gets" is what /v/[slug]
  // will show, not a second drawing of it.
  const previewPkg: VendorPackageWithItems = {
    package_id: packageId ?? 'new',
    vendor_profile_id: '',
    package_name: draft.package_name.trim() || 'Bundle name',
    description: null,
    total_price_centavos: draft.total_price_centavos,
    consumable_budget_centavos: draft.consumable_budget_centavos,
    is_consumable_flexible: draft.is_consumable_flexible,
    primary_canonical_service: draft.items[0]?.canonical_service ?? '',
    is_active: isActive,
    created_at: '',
    updated_at: '',
    items: draft.items
      .filter((i) => i.service_description.trim().length > 0)
      .map((i, n) => ({
        item_id: i.ref,
        package_id: packageId ?? 'new',
        canonical_service: i.canonical_service,
        service_description: i.service_description,
        is_default_included: i.is_default_included,
        replacement_value_centavos: i.replacement_value_centavos,
        display_order: n,
        created_at: '',
        is_required: i.is_required,
      })),
  };
  // 🧾 THE CARDS IN THIS BUNDLE, AS A HOST SEES THEM (Build 3 Lane E item 9, owner: *"The service cards should look like
  // how we look at event dashboard suppliers>find"*): each picked card is drawn by `ServiceCardFace` — the ONE face
  // Suppliers › Find renders (`supplier-sheet.tsx`) — with "in this bundle" as its footer (the face's own `footer`
  // prop), never a second drawing. Its price is the card's own from-price; nothing is typed here.
  const pickedCards = cardLines
    .map((i) => (i.vendorServiceId ? cardById.get(i.vendorServiceId) : undefined))
    .filter((c): c is BundleCard => Boolean(c));
  const preview = (
    <>
      {pickedCards.length > 0 ? (
        <div className="space-y-2" data-bundle-find-cards="">
          {pickedCards.map((c) => (
            <ServiceCardFace
              key={c.id}
              snap={{
                name: c.name,
                priceText: c.fromPhp != null ? `from ${php(c.fromPhp)}` : '',
                discountBadge: null,
                includesLine: null,
                notIncluded: [],
                hasExclusive: false,
                givesSetnayanGift: false,
                hasCover: false,
              }}
              leafPathLabel={[displayServiceLabel(c.category), shopName].filter(Boolean).join(' · ')}
              footer={<span className="inline-flex rounded-full bg-ink/[0.06] px-2.5 py-1 text-[12px] font-medium text-ink/70">in this bundle</span>}
            />
          ))}
        </div>
      ) : null}
      <PackageCard pkg={previewPkg} gift={coupleGift} />
      <p className={hint}>
        {draft.is_consumable_flexible
          ? 'Money freed by dropping an inclusion stays in the package.'
          : 'A dropped inclusion lowers what they pay.'}
      </p>
    </>
  );

  return (
    <div className="grid gap-8 md:grid-cols-2 md:gap-10" data-bundle-maker="">
      <UndoToastHost />
      <div className="min-w-0 space-y-5">
        {frozen ? (
          <p className="flex items-start gap-2 rounded-xl border border-ink/10 bg-cream/60 p-3 text-sm text-ink/70">
            <Lock aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span>
              Someone has booked this package, so what is in it is now fixed — that
              booking is a promise you have already made. You can still rename it or
              unlist it. To sell something different, publish a new package.
            </span>
          </p>
        ) : null}

        {saved ? (
          <p role="status" className="flex items-center gap-2 text-[13px] font-medium text-success-700">
            <Check aria-hidden className="h-4 w-4" strokeWidth={2} /> Bundle saved.
          </p>
        ) : null}

        {/* ---- Name ---- */}
        <div>
          <label className={lab} htmlFor="pkg-name">Name</label>
          <input
            autoComplete="off"
            id="pkg-name"
            className={field}
            value={draft.package_name}
            placeholder="Complete Wedding Catering"
            maxLength={120}
            onChange={(e) => {
              setNameTouched(true);
              patch({ package_name: e.target.value });
            }}
          />
          <p className={hint}>
            {cardLines.length > 0 && !nameTouched ? 'Written for you · change it if you like' : 'Named from the cards you add'}
          </p>
          <FairNote hits={nameFair} field="package_name" />
        </div>

        {/* ---- Package price ---- */}
        <div className={topic}>
          <label className={lab} htmlFor="pkg-price">Package price</label>
          <div className="relative">
            <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[15px] text-ink/70">₱</span>
            <input
              id="pkg-price"
              inputMode="decimal"
              disabled={frozen}
              className={`${field} pl-9 font-mono`}
              value={pesos(draft.total_price_centavos)}
              placeholder="—"
              onChange={(e) => patch({ total_price_centavos: toCentavos(e.target.value) })}
            />
          </div>
          <p className={hint}>One price for everything below.</p>
          {packageProblems.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {packageProblems.map((p) => (
                <ProblemLine key={p.code} problem={p} />
              ))}
            </ul>
          ) : null}
        </div>

        {/* ---- Service cards — FIRST, as locked lines ---- */}
        <div className={topic} data-bundle-cards="">
          <p className={lab}>
            Service cards <span className={small}>{cardLines.length ? `${cardLines.length} ${cardLines.length === 1 ? 'card' : 'cards'}` : 'at least one'}</span>
          </p>
          {cardLines.length > 0 ? (
            <ul className="mb-2 divide-y divide-ink/10 overflow-hidden rounded-xl border border-ink/15">
              {cardLines.map((item) => {
                const card = item.vendorServiceId ? cardById.get(item.vendorServiceId) : undefined;
                return (
                  <SwipeToDelete
                    key={item.ref}
                    as="li"
                    label={`Take ${item.service_description} out of the bundle`}
                    word="Remove"
                    radiusClass="rounded-none"
                    disabled={frozen}
                    onDelete={() => removeLine(item)}
                  >
                    <div className="flex min-h-14 items-center gap-3 px-4 py-2.5" data-bundle-line="card">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] text-ink">{item.service_description}</span>
                        <span className="block text-[12px] text-ink/55">
                          your service card · from {card?.fromPhp != null ? php(card.fromPhp) : '₱ —'}
                        </span>
                      </span>
                      <Lock aria-label="Locked — this line is the card" className="h-4 w-4 shrink-0 text-ink/45" strokeWidth={1.75} />
                    </div>
                  </SwipeToDelete>
                );
              })}
            </ul>
          ) : null}
          {frozen ? null : cards === null ? (
            <p role="alert" className="text-[13px] text-danger-700">Couldn’t read your service cards right now. Reload to try again.</p>
          ) : cards.length === 0 ? (
            <p className={hint}>No service cards yet. Make one under Services, then add it here.</p>
          ) : cardsLeft.length > 0 ? (
            <PickMenu
              label="Add a card"
              value={null}
              options={cardsLeft.map((c) => ({ key: c.id, label: c.name, hint: c.fromPhp != null ? `from ${php(c.fromPhp)}` : undefined }))}
              onPick={addCard}
              dataAttr="data-bundle-add-card"
              className={box}
              trigger={
                <>
                  <span className="truncate text-ink/55">{cardLines.length ? 'Add another card…' : 'Add a card…'}</span>
                  <ChevronDown aria-hidden className="h-4 w-4 shrink-0 text-ink/45" strokeWidth={1.75} />
                </>
              }
            />
          ) : (
            <p className="flex items-center gap-1.5 text-[13px] text-success-700">
              <Check aria-hidden className="h-4 w-4" strokeWidth={2} /> Every card is in this bundle
            </p>
          )}
          {cardLines.length > 0 && !frozen ? <p className={hint}>Swipe a card left to take it out of the bundle.</p> : null}
        </div>

        {/* ---- Extra inclusions — after the cards, as lines ---- */}
        <div className={topic} data-bundle-extras="">
          <div className={lab}>
            <span>Extra inclusions <span className={small}>beyond the cards · optional</span></span>
            <InfoTip label="" ariaLabel="About inclusions" align="end">
              <span className="block font-semibold">What’s included</span>
              <span className="mt-1 block">
                Each thing the couple gets that no card already says — the crew meals, the set-up. Anything they may
                swap or drop gets its own line.
              </span>
              <span className="mt-1 block">Swap options are made on the card, under What’s included · details.</span>
            </InfoTip>
          </div>

          {extraLines.length > 0 ? (
            <ul className="mb-3 divide-y divide-ink/10 overflow-hidden rounded-xl border border-ink/15">
              {extraLines.map((item) => (
                <SwipeToDelete
                  key={item.ref}
                  as="li"
                  label={`Remove ${item.service_description.trim() || 'this line'}`}
                  word="Remove"
                  radiusClass="rounded-none"
                  disabled={frozen}
                  onDelete={() => removeLine(item)}
                >
                  <div data-bundle-line="extra">
                    <div className="grid grid-cols-[1fr_7rem] lg:grid-cols-[1fr_9rem_6.5rem]">
                      <input
                        aria-label="What this inclusion is"
                        className="col-span-2 h-12 min-w-0 border-b border-ink/10 bg-transparent px-4 text-[15px] text-ink placeholder:text-ink/40 focus:outline-none lg:col-span-1 lg:border-b-0 disabled:opacity-60"
                        disabled={frozen}
                        value={item.service_description}
                        placeholder="Buffet dinner for your guest count"
                        onChange={(e) => patchItem(item.ref, { service_description: e.target.value })}
                      />
                      <div className="min-w-0 border-ink/10 lg:border-l">
                        <PickMenu
                          label="Category"
                          value={item.canonical_service || null}
                          options={canonicalServices.map((c) => ({ key: c.value, label: c.label }))}
                          onPick={(k) => patchItem(item.ref, { canonical_service: k })}
                          className="flex h-12 w-full items-center justify-between gap-2 px-4 text-left text-[14px] text-ink disabled:opacity-60"
                          trigger={
                            <>
                              <span className={`truncate ${item.canonical_service ? '' : 'text-ink/45'}`}>
                                {canonicalServices.find((c) => c.value === item.canonical_service)?.label ?? 'Category…'}
                              </span>
                              <ChevronDown aria-hidden className="h-4 w-4 shrink-0 text-ink/45" strokeWidth={1.75} />
                            </>
                          }
                        />
                      </div>
                      <input
                        aria-label="What this is worth in pesos"
                        inputMode="decimal"
                        disabled={frozen}
                        className="h-12 min-w-0 border-l border-ink/10 bg-transparent px-4 font-mono text-[14px] text-ink placeholder:text-ink/40 focus:outline-none disabled:opacity-60"
                        value={pesos(item.replacement_value_centavos)}
                        placeholder="worth ₱"
                        onChange={(e) =>
                          patchItem(item.ref, { replacement_value_centavos: toCentavos(e.target.value) })
                        }
                      />
                    </div>

                    {/* A line that ALREADY carries choices keeps them editable here — no saved bundle is stranded. New
                        swap options are made on the card (makers § 4: "no option sub-forms on this page"). */}
                    {item.options.length > 0 ? (
                      <div className="px-4 pb-3">
                        <OptionList
                          item={item}
                          frozen={frozen}
                          field={optionField}
                          problemsFor={problemsFor}
                          onPatch={patchOption}
                          onStandard={makeStandard}
                          onAdd={() =>
                            patchItem(item.ref, {
                              options: [
                                ...item.options,
                                { ref: newRef(), label: '', price_delta_centavos: 0, is_default: false, is_available: true },
                              ],
                            })
                          }
                          onRemove={(optRef) =>
                            patchItem(item.ref, { options: item.options.filter((o) => o.ref !== optRef) })
                          }
                        />
                      </div>
                    ) : null}

                    {problemsFor(item.ref).length > 0 ? (
                      <ul className="space-y-1 px-4 pb-3">
                        {problemsFor(item.ref).map((p) => (
                          <ProblemLine key={p.code} problem={p} />
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </SwipeToDelete>
              ))}
            </ul>
          ) : null}

          {!frozen ? (
            <ActionButton
              tone="neutral"
              icon={Plus}
              label="Add a line"
              onClick={() => patch({ items: [...draft.items, emptyItem()] })}
            />
          ) : null}
          {extraLines.length > 0 && !frozen ? <p className={hint}>Swipe a line left to remove it.</p> : null}
        </div>

        {/* ---- Gift — NEW on bundles: the card's Gift row ---- */}
        <div className={topic} data-bundle-gift="">
          <div className={lab}>
            <span>Gift <span className={small}>optional</span></span>
            <InfoTip label="" ariaLabel="About gifts" align="start">
              <span className="block font-semibold">Gifts</span>
              {PACKAGE_GIFT_TIP.map((t) => (
                <span key={t} className="mt-1 block">{t}</span>
              ))}
            </InfoTip>
          </div>
          <PickMenu
            label="Gift"
            value={draft.gift ?? ''}
            options={giftMenu}
            onPick={(k) => patch({ gift: k })}
            dataAttr="data-bundle-gift-pick"
            className={box}
            trigger={
              <>
                <span className={`truncate ${draft.gift ? '' : 'text-ink/55'}`}>{giftPicked?.label ?? 'No gift'}</span>
                <ChevronDown aria-hidden className="h-4 w-4 shrink-0 text-ink/45" strokeWidth={1.75} />
              </>
            }
          />
          <p className={hint} data-bundle-gift-hint="">{packageGiftLine(draft.gift ?? '', giftPacks, giftFree)}</p>
        </div>

        {/* ---- More settings — the spendable budget moves here, out of the main body ---- */}
        <div className={topic}>
          <Fold
            data="bundle-more"
            open={moreOpen}
            onOpenChange={setMoreOpen}
            popovers
            title="More settings"
            line="Spendable budget · money freed"
            lead={<Settings aria-hidden className="h-5 w-5 text-ink/60" strokeWidth={1.75} />}
          >
            <div className="space-y-4 pb-2 pt-3">
              <div>
                <label className={lab} htmlFor="pkg-budget">
                  Spendable budget <span className={small}>optional</span>
                </label>
                <div className="relative">
                  <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[15px] text-ink/70">₱</span>
                  <input
                    id="pkg-budget"
                    inputMode="decimal"
                    disabled={frozen}
                    className={`${field} pl-9 font-mono`}
                    value={pesos(draft.consumable_budget_centavos)}
                    placeholder="—"
                    onChange={(e) => patch({ consumable_budget_centavos: toCentavos(e.target.value) })}
                  />
                </div>
              </div>
              <div className="flex items-start gap-2">
                <label className="flex min-h-11 flex-1 items-start gap-3 text-[14px] text-ink/80">
                  <input
                    type="checkbox"
                    disabled={frozen}
                    checked={draft.is_consumable_flexible}
                    onChange={(e) => patch({ is_consumable_flexible: e.target.checked })}
                    className="mt-0.5 h-5 w-5 shrink-0 rounded border-ink/25 text-terracotta"
                  />
                  <span>Money freed by dropping an inclusion stays in the package</span>
                </label>
                <InfoTip label="" ariaLabel="About money freed" align="end">
                  <span className="block font-semibold">Money freed</span>
                  <span className="mt-1 block">
                    Off: the couple simply pays less. On: they spend it on something else of yours — so you keep the full
                    package price.
                  </span>
                </InfoTip>
              </div>
            </div>
          </Fold>
        </div>

        {shown.length > 0 ? (
          <p className="text-xs text-ink/50">
            {shown.length} thing{shown.length === 1 ? '' : 's'} to fix first
          </p>
        ) : null}
        {serverError ? (
          <p role="alert" className="text-sm text-red-700">
            {serverError}
          </p>
        ) : null}
      </div>

      {/* ---- What the couple gets — beside the form from 768 (maximize the screen); a sheet on a phone ---- */}
      <aside className="hidden md:block" aria-label="What the couple gets">
        <div className="sticky top-24 rounded-2xl border border-ink/10 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[17px] font-medium text-ink">What the couple gets</h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/45">live</span>
          </div>
          {preview}
        </div>
      </aside>

      <Sheet open={previewOpen} onClose={() => setPreviewOpen(false)} labelledById={previewHeadId}>
        <div className="space-y-4 p-1">
          <h2 id={previewHeadId} className="text-[17px] font-medium text-ink">What the couple gets</h2>
          {preview}
          <ActionButton tone="ok" icon={Check} label="Done" onClick={() => setPreviewOpen(false)} />
        </div>
      </Sheet>

      {/* ═══ THE THUMB ROW — Cancel (grey) · Save bundle (the one main, terracotta). The shipped row + buttons. ═══ */}
      <SupplierThumbRow name="bundle" label="Bundle actions">
        <ActionButton tone="neutral" icon={X} label="Cancel" href="/vendor-dashboard/packages" />
        <ActionButton
          tone="neutral"
          icon={Eye}
          label="Preview"
          className="md:hidden"
          onClick={() => setPreviewOpen(true)}
        />
        {packageId ? (
          <ActionButton
            tone="neutral"
            icon={isActive ? EyeOff : Globe}
            label={isActive ? 'Unlist from my page' : 'Publish to my page'}
            onClick={togglePublished}
            waiting={pending || (!isActive && (problems.length > 0 || nameFair.length > 0))}
          />
        ) : null}
        <ActionButton
          tone="brand"
          main
          icon={Check}
          label={pending ? 'Saving…' : 'Save bundle'}
          onClick={save}
          waiting={pending || nameFair.length > 0}
          data-testid="bundle-save"
        />
      </SupplierThumbRow>
    </div>
  );
}

function ProblemLine({ problem }: { problem: DraftProblem }) {
  return (
    <li className="list-none text-xs text-red-700">{problem.message}</li>
  );
}

function OptionList({
  item,
  frozen,
  field,
  problemsFor,
  onPatch,
  onStandard,
  onAdd,
  onRemove,
}: {
  item: DraftItem;
  frozen: boolean;
  field: string;
  problemsFor: (itemRef: string, optionRef?: string) => DraftProblem[];
  onPatch: (itemRef: string, optRef: string, over: Partial<DraftOption>) => void;
  onStandard: (itemRef: string, optRef: string) => void;
  onAdd: () => void;
  onRemove: (optRef: string) => void;
}) {
  return (
    <div className="rounded-lg border border-ink/10 bg-cream/50 p-3">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
        They pick one — the standard one is in the price, the rest add to it
      </p>
      <ul className="space-y-2">
        {item.options.map((o) => (
          <li key={o.ref} className="flex items-center gap-2">
            <input
              type="radio"
              name={`std-${item.ref}`}
              aria-label="Make this the standard option"
              disabled={frozen}
              checked={o.is_default}
              onChange={() => onStandard(item.ref, o.ref)}
              className="h-4 w-4 shrink-0 border-ink/20 text-terracotta"
            />
            <input
              aria-label="Option name"
              className={`${field} flex-1`}
              disabled={frozen}
              value={o.label}
              placeholder="Chicken teriyaki"
              onChange={(e) => onPatch(item.ref, o.ref, { label: e.target.value })}
            />
            <input
              aria-label="Extra cost in pesos"
              inputMode="decimal"
              disabled={frozen || o.is_default}
              className={`${field} w-28 font-mono disabled:opacity-50`}
              value={o.is_default ? '' : pesos(o.price_delta_centavos)}
              // The default pick shows a BLANK, not "included" (owner
              // 2026-07-28) — "included" reads as comes-regardless-of-the-pick.
              placeholder={o.is_default ? '' : '+₱'}
              onChange={(e) =>
                onPatch(item.ref, o.ref, {
                  price_delta_centavos: toCentavos(e.target.value),
                })
              }
            />
            <label className="flex shrink-0 items-center gap-1 text-[11px] text-ink/55">
              <input
                type="checkbox"
                disabled={frozen || o.is_default}
                checked={o.is_available}
                onChange={(e) =>
                  onPatch(item.ref, o.ref, { is_available: e.target.checked })
                }
                className="h-3.5 w-3.5 rounded border-ink/20 text-terracotta"
              />
              On
            </label>
            {/* A field INSIDE an editor keeps its small ✕ (owner 2026-11-03 — "a small ✕ stays only on … fields inside
                an editor"); an option is a field of its line, not a list row. */}
            {!frozen && item.options.length > 2 ? (
              <button
                type="button"
                aria-label="Remove this option"
                onClick={() => onRemove(o.ref)}
                className="rounded p-1 text-ink/30 hover:text-ink/60"
              >
                <Trash2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {problemsFor(item.ref).length > 0 || item.options.some((o) => problemsFor(item.ref, o.ref).length > 0) ? (
        <ul className="mt-2 space-y-1">
          {item.options.flatMap((o) =>
            problemsFor(item.ref, o.ref).map((p) => (
              <ProblemLine key={`${o.ref}-${p.code}`} problem={p} />
            )),
          )}
        </ul>
      ) : null}
      {!frozen ? (
        <button
          type="button"
          onClick={onAdd}
          className="mt-2 text-xs text-mulberry underline underline-offset-2"
        >
          Add another option
        </button>
      ) : null}
    </div>
  );
}
