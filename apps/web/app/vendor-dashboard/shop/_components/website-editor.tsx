'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Check, Globe, Lock, Sparkles } from 'lucide-react';

import { CopyButton } from '@/app/_components/copy-button';
import { useToast } from '@/app/_components/toast/toast-provider';
import {
  MICROSITE_ABOUT_MAX,
  MICROSITE_ACCENTS,
  MICROSITE_DEFAULT_ACCENT_KEY,
  MICROSITE_FEATURED_EDITORIALS_MAX,
  MICROSITE_FEATURED_SERVICES_MAX,
  MICROSITE_TOGGLEABLE_SECTIONS,
  isSectionVisible,
} from '@/lib/vendor-microsite';

import { updateVendorWebsiteField } from '../../actions';

export type MicrositePortfolioPhoto = { key: string; url: string };
export type MicrositeReviewOption = { id: string; label: string };

/**
 * My Shop → Website. Direct, on-surface editor (2026-07-02 redesign, owner:
 * "actual place for the photo, tap to replace · actual editable text box").
 *
 * Every control IS the surface — the text box, the photo grid, the toggles, the
 * chips, the swatches are all live in place. Instant controls save optimistically
 * on change (revert + toast on error); the two text fields (About, address) save
 * with an inline button that appears when they're dirty. Flat + hairline-divided
 * (no boxed cards). PRO controls are real for Pro/Enterprise; Free sees a quiet
 * locked list + Upgrade — "paywall + free tastes". Curation is OPTIONAL: an
 * un-touched page still renders its auto-composed baseline.
 */
export function WebsiteEditor({
  publicPath,
  displayHost,
  websiteLive,
  isPro,
  canPersonalize,
  about,
  sections,
  featuredServiceIds,
  services,
  serviceLabels,
  isVerified,
  yearsLabel,
  slug,
  heroPhotoKey,
  accent,
  portfolioPhotos,
  reviews,
  pinnedReviewId,
  editorials,
  featuredEditorialIds,
}: {
  publicPath: string | null;
  displayHost: string;
  websiteLive: boolean;
  isPro: boolean;
  canPersonalize: boolean;
  about: string | null;
  sections: Record<string, boolean>;
  featuredServiceIds: string[];
  services: string[];
  serviceLabels?: Record<string, string>;
  isVerified: boolean;
  yearsLabel: string | null;
  slug: string | null;
  heroPhotoKey: string | null;
  accent: string | null;
  portfolioPhotos: MicrositePortfolioPhoto[];
  reviews: MicrositeReviewOption[];
  pinnedReviewId: string | null;
  editorials: MicrositeReviewOption[];
  featuredEditorialIds: string[];
}) {
  const toast = useToast();
  const [, startTransition] = useTransition();
  const label = (leaf: string) => serviceLabels?.[leaf] ?? titleCase(leaf);

  /** Fire one field save. Optimistic callers pass onError to revert. */
  function dispatch(
    field: string,
    entries: [string, string][],
    opts?: { onError?: () => void; successToast?: string },
  ) {
    const fd = new FormData();
    fd.set('field', field);
    for (const [k, v] of entries) fd.append(k, v);
    startTransition(async () => {
      const res = await updateVendorWebsiteField(null, fd);
      if (!res.ok) {
        toast.error(res.error);
        opts?.onError?.();
      } else if (opts?.successToast) {
        toast.success(opts.successToast);
      }
    });
  }

  // ── About (text + inline Save) ───────────────────────────────────────────
  const [aboutVal, setAboutVal] = useState(about ?? '');
  const aboutDirty = aboutVal.trim() !== (about ?? '').trim();

  // ── Featured services (chips · instant) ──────────────────────────────────
  const [picked, setPicked] = useState<string[]>(
    featuredServiceIds.filter((s) => services.includes(s)),
  );
  function toggleService(leaf: string) {
    const was = picked;
    const next = picked.includes(leaf)
      ? picked.filter((x) => x !== leaf)
      : picked.length >= MICROSITE_FEATURED_SERVICES_MAX
        ? picked
        : [...picked, leaf];
    if (next === was) return;
    setPicked(next);
    dispatch(
      'microsite_featured_services',
      next.map((k) => ['microsite_featured_services', k]),
      { onError: () => setPicked(was) },
    );
  }

  // ── Sections (toggles · instant) ─────────────────────────────────────────
  const [sec, setSec] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      MICROSITE_TOGGLEABLE_SECTIONS.map((s) => [s.key, isSectionVisible(sections, s.key)]),
    ),
  );
  function toggleSection(key: string) {
    const was = sec;
    const next = { ...sec, [key]: !sec[key] };
    setSec(next);
    dispatch(
      'microsite_sections',
      MICROSITE_TOGGLEABLE_SECTIONS.filter((s) => next[s.key]).map((s) => [
        `section_${s.key}`,
        'on',
      ]),
      { onError: () => setSec(was) },
    );
  }

  // ── Pro: custom address (text + inline Save) ─────────────────────────────
  const [slugVal, setSlugVal] = useState(slug ?? '');
  const slugDirty = slugVal.trim() !== (slug ?? '').trim();

  // ── Pro: hero photo (grid · instant) ─────────────────────────────────────
  const [hero, setHero] = useState<string>(
    heroPhotoKey && portfolioPhotos.some((p) => p.key === heroPhotoKey) ? heroPhotoKey : '',
  );
  function pickHero(key: string) {
    const was = hero;
    setHero(key);
    dispatch('microsite_hero_photo', [['microsite_hero_photo', key]], {
      onError: () => setHero(was),
    });
  }

  // ── Pro: accent (swatches · instant) ─────────────────────────────────────
  const [acc, setAcc] = useState<string>(
    accent && MICROSITE_ACCENTS.some((a) => a.key === accent)
      ? accent
      : MICROSITE_DEFAULT_ACCENT_KEY,
  );
  function pickAccent(key: string) {
    const was = acc;
    setAcc(key);
    dispatch('microsite_accent', [['microsite_accent', key]], {
      onError: () => setAcc(was),
    });
  }

  // ── Pro: pinned review (list · instant) ──────────────────────────────────
  const [pin, setPin] = useState<string>(
    pinnedReviewId && reviews.some((r) => r.id === pinnedReviewId) ? pinnedReviewId : '',
  );
  function pickPin(id: string) {
    const was = pin;
    setPin(id);
    dispatch('microsite_pinned_review', [['microsite_pinned_review', id]], {
      onError: () => setPin(was),
    });
  }

  // ── Pro: featured editorials (chips · instant · up to 3) ──────────────────
  const [edPicked, setEdPicked] = useState<string[]>(
    featuredEditorialIds.filter((id) => editorials.some((e) => e.id === id)),
  );
  function toggleEditorial(id: string) {
    const was = edPicked;
    const next = edPicked.includes(id)
      ? edPicked.filter((x) => x !== id)
      : edPicked.length >= MICROSITE_FEATURED_EDITORIALS_MAX
        ? edPicked
        : [...edPicked, id];
    if (next === was) return;
    setEdPicked(next);
    dispatch(
      'microsite_featured_editorials',
      next.map((k) => ['microsite_featured_editorials', k]),
      { onError: () => setEdPicked(was) },
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Status + address ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
          <span
            aria-hidden
            className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
            style={{ background: websiteLive ? 'var(--m-sage-deep)' : 'var(--m-slate-4)' }}
          />
          {websiteLive ? 'Live' : 'Draft'} · curate what couples see — the rest fills
          in from your profile.
        </p>
        {publicPath ? (
          <a
            href={publicPath}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-terracotta hover:underline"
          >
            View page
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
          </a>
        ) : null}
      </div>

      {publicPath ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-mono text-xs" style={{ color: 'var(--m-slate)' }}>
            {displayHost}
            {publicPath}
          </span>
          <CopyButton value={`${displayHost}${publicPath}`} label="Copy" />
          <a
            href={publicPath}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-terracotta hover:underline"
          >
            <Globe className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
            Open live
          </a>
        </div>
      ) : (
        <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
          Your page goes live once you set an address in{' '}
          <Link href="/vendor-dashboard/profile" className="font-medium text-terracotta hover:underline">
            Profile
          </Link>
          . Everything below applies the moment it&rsquo;s live.
        </p>
      )}

      {/* ── Personalize (Solo+): About · Featured services · Sections ─────── */}
      {canPersonalize ? (
        <>
      {/* ── About ────────────────────────────────────────────────────────── */}
      <Row title="About">
        <textarea
          value={aboutVal}
          onChange={(e) => setAboutVal(e.target.value)}
          maxLength={MICROSITE_ABOUT_MAX}
          rows={3}
          placeholder="Two or three sentences on who you are and the couples you shoot for."
          className="input-field w-full"
          aria-label="About"
        />
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-xs tabular-nums" style={{ color: 'var(--m-slate-3)' }}>
            {aboutVal.length}/{MICROSITE_ABOUT_MAX}
          </span>
          <button
            type="button"
            disabled={!aboutDirty}
            onClick={() =>
              dispatch('microsite_about', [['microsite_about', aboutVal]], {
                successToast: 'About saved.',
              })
            }
            className="rounded-md px-3 py-1 text-xs font-medium transition-opacity disabled:opacity-40"
            style={{ background: 'var(--m-ink)', color: 'var(--m-paper)' }}
          >
            Save
          </button>
        </div>
      </Row>

      {/* ── Featured services ────────────────────────────────────────────── */}
      <Row title="Featured services" hint={`${picked.length}/${MICROSITE_FEATURED_SERVICES_MAX} shown first`}>
        {services.length === 0 ? (
          <p className="text-sm text-ink/60">
            Add services in your profile first — then tap to highlight up to{' '}
            {MICROSITE_FEATURED_SERVICES_MAX}.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {services.map((leaf) => {
              const on = picked.includes(leaf);
              const disabled = !on && picked.length >= MICROSITE_FEATURED_SERVICES_MAX;
              return (
                <button
                  key={leaf}
                  type="button"
                  aria-pressed={on}
                  disabled={disabled}
                  onClick={() => toggleService(leaf)}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors disabled:opacity-40"
                  style={{
                    borderColor: on ? 'var(--m-orange)' : 'var(--m-line)',
                    background: on ? 'var(--m-orange-4)' : 'transparent',
                    color: on ? 'var(--m-orange-2)' : 'var(--m-slate)',
                  }}
                >
                  {on ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden /> : null}
                  {label(leaf)}
                </button>
              );
            })}
          </div>
        )}
      </Row>

      {/* ── Sections ─────────────────────────────────────────────────────── */}
      <Row title="Sections">
        <ul>
          {MICROSITE_TOGGLEABLE_SECTIONS.map((s) => (
            <li key={s.key} className="flex items-center justify-between py-1.5 text-sm">
              <span style={{ color: 'var(--m-ink)' }}>{s.label}</span>
              <Switch
                on={!!sec[s.key]}
                onClick={() => toggleSection(s.key)}
                label={`Show ${s.label}`}
              />
            </li>
          ))}
        </ul>
        <p className="pt-1 text-xs" style={{ color: 'var(--m-slate-3)' }}>
          Reviews always show — they&rsquo;re what couples trust most.
        </p>
      </Row>
        </>
      ) : (
        <SoloUpsell />
      )}

      {/* ── Awards (read-only) ───────────────────────────────────────────── */}
      <Row title="Awards and badges">
        <div className="flex flex-wrap items-center gap-2">
          {isVerified ? (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
              style={{
                background: 'color-mix(in srgb, var(--m-sage-deep) 12%, transparent)',
                color: 'var(--m-sage-deep)',
              }}
            >
              <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
              Verified
            </span>
          ) : null}
          {yearsLabel ? (
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs"
              style={{ background: 'var(--m-orange-4)', color: 'var(--m-slate)' }}
            >
              {yearsLabel}
            </span>
          ) : null}
          <span className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
            Badges you earn show on your page automatically.
          </span>
        </div>
      </Row>

      {/* ── Pro customization ────────────────────────────────────────────── */}
      <section
        className="rounded-xl border p-4"
        style={{
          borderColor: 'color-mix(in srgb, var(--m-plum, #6b4d8a) 25%, transparent)',
          background: 'color-mix(in srgb, var(--m-plum, #6b4d8a) 5%, transparent)',
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span
            className="inline-flex items-center gap-1.5 text-sm font-medium"
            style={{ color: 'var(--m-plum, #6b4d8a)' }}
          >
            {isPro ? (
              <Sparkles className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            ) : (
              <Lock className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            )}
            Pro customization
          </span>
          {isPro ? (
            <span className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
              Included with your plan
            </span>
          ) : (
            <Link
              href="/vendor-dashboard/subscription"
              className="inline-flex items-center gap-1 text-sm font-medium"
              style={{ color: 'var(--m-plum, #6b4d8a)' }}
            >
              Upgrade
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            </Link>
          )}
        </div>

        {isPro ? (
          <div className="mt-3 space-y-5">
            {/* Custom address */}
            <Row title="Custom address" tight>
              <div
                className="flex items-center rounded-lg border bg-white pl-2"
                style={{ borderColor: 'var(--m-line)' }}
              >
                <span className="shrink-0 text-xs text-ink/45">{displayHost}/v/</span>
                <input
                  value={slugVal}
                  onChange={(e) => setSlugVal(e.target.value)}
                  placeholder="your-studio"
                  pattern="[a-z0-9-]{3,32}"
                  aria-label="Custom address"
                  className="w-full border-0 bg-transparent py-2 pr-2 text-sm text-ink focus:outline-none"
                />
                <button
                  type="button"
                  disabled={!slugDirty}
                  onClick={() =>
                    dispatch('business_slug', [['business_slug', slugVal]], {
                      successToast: 'Address saved.',
                    })
                  }
                  className="my-1 mr-1 shrink-0 rounded-md px-3 py-1 text-xs font-medium transition-opacity disabled:opacity-40"
                  style={{ background: 'var(--m-ink)', color: 'var(--m-paper)' }}
                >
                  Save
                </button>
              </div>
              <p className="mt-1 text-xs" style={{ color: 'var(--m-slate-3)' }}>
                Lowercase letters, numbers, and hyphens (3–32).
              </p>
            </Row>

            {/* Hero photo */}
            <Row title="Hero photo" hint="tap to choose" tight>
              {portfolioPhotos.length === 0 ? (
                <p className="text-sm text-ink/60">
                  Add portfolio photos in your profile — then tap one to lead your page.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  <PickTile selected={hero === ''} onClick={() => pickHero('')}>
                    <span className="text-xs" style={{ color: 'var(--m-slate)' }}>
                      Automatic
                    </span>
                  </PickTile>
                  {portfolioPhotos.map((p) => (
                    <PickTile
                      key={p.key}
                      selected={hero === p.key}
                      onClick={() => pickHero(p.key)}
                      photo={p.url}
                    />
                  ))}
                </div>
              )}
            </Row>

            {/* Accent */}
            <Row title="Accent theme" tight>
              <div className="flex flex-wrap gap-2">
                {MICROSITE_ACCENTS.map((a) => {
                  const on = acc === a.key;
                  return (
                    <button
                      key={a.key}
                      type="button"
                      aria-pressed={on}
                      title={a.label}
                      onClick={() => pickAccent(a.key)}
                      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
                      style={{
                        borderColor: on ? 'var(--m-ink)' : 'var(--m-line)',
                        background: on ? 'var(--m-paper)' : 'transparent',
                      }}
                    >
                      <span
                        aria-hidden
                        className="h-4 w-4 rounded-full"
                        style={{ background: a.swatch }}
                      />
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </Row>

            {/* Pinned review */}
            <Row title="Pinned review" tight>
              {reviews.length === 0 ? (
                <p className="text-sm text-ink/60">
                  No reviews yet — once couples review you, tap one to feature up top.
                </p>
              ) : (
                <div className="space-y-0.5">
                  <PinRow selected={pin === ''} onClick={() => pickPin('')}>
                    None (newest first)
                  </PinRow>
                  {reviews.map((r) => (
                    <PinRow key={r.id} selected={pin === r.id} onClick={() => pickPin(r.id)}>
                      {r.label}
                    </PinRow>
                  ))}
                </div>
              )}
            </Row>

            {/* Featured editorials */}
            <Row
              title="Featured editorials"
              hint={
                editorials.length > 0
                  ? `${edPicked.length}/${MICROSITE_FEATURED_EDITORIALS_MAX}`
                  : undefined
              }
              tight
            >
              {editorials.length === 0 ? (
                <p className="text-sm text-ink/60">
                  No stories yet — when a couple you worked with publishes their
                  story, feature up to {MICROSITE_FEATURED_EDITORIALS_MAX} here.
                </p>
              ) : (
                <div className="space-y-0.5">
                  {editorials.map((e) => {
                    const on = edPicked.includes(e.id);
                    const disabled =
                      !on && edPicked.length >= MICROSITE_FEATURED_EDITORIALS_MAX;
                    return (
                      <button
                        key={e.id}
                        type="button"
                        aria-pressed={on}
                        disabled={disabled}
                        onClick={() => toggleEditorial(e.id)}
                        className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left text-sm hover:bg-[color:var(--m-orange-4)] disabled:opacity-40"
                      >
                        <span
                          aria-hidden
                          className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border-2"
                          style={{
                            borderColor: on ? 'var(--m-orange)' : 'var(--m-line)',
                            background: on ? 'var(--m-orange)' : 'transparent',
                          }}
                        >
                          {on ? (
                            <Check
                              className="h-3 w-3"
                              strokeWidth={3}
                              style={{ color: 'var(--m-paper)' }}
                            />
                          ) : null}
                        </span>
                        <span className="min-w-0" style={{ color: 'var(--m-slate)' }}>
                          {e.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </Row>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {['Custom address', 'Hero photo', 'Accent theme', 'Pinned review', 'Featured editorials'].map(
              (t) => (
                <li
                  key={t}
                  className="flex items-center gap-2 text-sm"
                  style={{ color: 'var(--m-slate-3)' }}
                >
                  <Lock className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                  {t}
                </li>
              ),
            )}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ─── Free-tier upsell: personalizing is a Solo+ benefit ────────────────── */
function SoloUpsell() {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: 'var(--m-line)', background: 'var(--m-orange-4)' }}
    >
      <p className="text-sm font-medium text-ink">Make this page yours</p>
      <p className="mt-1 text-xs" style={{ color: 'var(--m-slate)' }}>
        On a <span className="font-medium">Solo</span> plan you can add an About
        intro, an accent colour, featured services, and choose which sections
        show. Your page is live and findable on Free — personalizing it is a Solo
        upgrade.
      </p>
      <Link
        href="/vendor-dashboard/subscription"
        className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-terracotta hover:underline"
      >
        See plans
        <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      </Link>
    </div>
  );
}

/* ─── Flat, hairline-divided section ────────────────────────────────────── */
function Row({
  title,
  hint,
  tight,
  children,
}: {
  title: string;
  hint?: string;
  tight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={tight ? '' : 'border-t pt-4'}
      style={tight ? undefined : { borderColor: 'var(--m-line)' }}
    >
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
          {title}
        </h3>
        {hint ? (
          <span className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
            {hint}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/* ─── Toggle switch ─────────────────────────────────────────────────────── */
function Switch({
  on,
  onClick,
  label,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors"
      style={{ background: on ? 'var(--m-orange)' : 'var(--m-line)' }}
    >
      <span
        aria-hidden
        className="inline-block h-4 w-4 rounded-full bg-white transition-transform"
        style={{ transform: on ? 'translateX(18px)' : 'translateX(2px)' }}
      />
    </button>
  );
}

/* ─── Tap-to-choose photo tile ──────────────────────────────────────────── */
function PickTile({
  selected,
  onClick,
  photo,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  photo?: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border-2"
      style={{ borderColor: selected ? 'var(--m-orange)' : 'var(--m-line)' }}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="h-full w-full object-cover" />
      ) : (
        children
      )}
      {selected ? (
        <span
          aria-hidden
          className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full"
          style={{ background: 'var(--m-orange)', color: 'var(--m-paper)' }}
        >
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      ) : null}
    </button>
  );
}

/* ─── Pinned-review radio row ───────────────────────────────────────────── */
function PinRow({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left text-sm hover:bg-[color:var(--m-orange-4)]"
    >
      <span
        aria-hidden
        className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2"
        style={{
          borderColor: selected ? 'var(--m-orange)' : 'var(--m-line)',
          background: selected ? 'var(--m-orange)' : 'transparent',
        }}
      >
        {selected ? (
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--m-paper)' }} />
        ) : null}
      </span>
      <span className="min-w-0" style={{ color: 'var(--m-slate)' }}>
        {children}
      </span>
    </button>
  );
}

function titleCase(s: string): string {
  return s
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
