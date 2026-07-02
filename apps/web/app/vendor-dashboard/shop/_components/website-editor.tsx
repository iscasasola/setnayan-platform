'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Globe,
  Image as ImageIcon,
  Link as LinkIcon,
  Lock,
  Newspaper,
  Palette,
  Pencil,
  Pin,
} from 'lucide-react';

import { CopyButton } from '@/app/_components/copy-button';
import { SubmitButton } from '@/app/_components/submit-button';
import { useToast } from '@/app/_components/toast/toast-provider';
import {
  MICROSITE_ABOUT_MAX,
  MICROSITE_FEATURED_SERVICES_MAX,
  MICROSITE_TOGGLEABLE_SECTIONS,
  isSectionVisible,
} from '@/lib/vendor-microsite';

import { Collapsible } from '../../_components/collapsible';
import { updateVendorWebsiteField, type FieldSaveResult } from '../../actions';

type RowKey = 'about' | 'featured' | 'sections';

/**
 * My Shop → Website. The passive "Live" card reworked into an inline content
 * editor (2026-07-02, owner). FREE controls (About · Featured services ·
 * Sections) edit in place and save without leaving the panel — mirroring the
 * Profile panel's one-open-at-a-time discipline. The PRO controls (custom
 * address · hero photo · accent · featured editorials · pinned review) render
 * as an always-visible locked list so Free vendors see the ceiling — the
 * "paywall + free tastes" pattern. Every free control is an OPTIONAL override:
 * an un-curated page still renders its auto-composed baseline.
 */
export function WebsiteEditor({
  publicPath,
  displayHost,
  websiteLive,
  isPro,
  about,
  sections,
  featuredServiceIds,
  services,
  serviceLabels,
  isVerified,
  yearsLabel,
}: {
  publicPath: string | null;
  displayHost: string;
  websiteLive: boolean;
  isPro: boolean;
  about: string | null;
  sections: Record<string, boolean>;
  featuredServiceIds: string[];
  services: string[];
  serviceLabels?: Record<string, string>;
  isVerified: boolean;
  yearsLabel: string | null;
}) {
  const [open, setOpen] = useState<RowKey | null>(null);
  const toggle = (k: RowKey) => setOpen((cur) => (cur === k ? null : k));
  const close = () => setOpen(null);

  const label = (leaf: string) => serviceLabels?.[leaf] ?? titleCase(leaf);

  const hiddenCount = MICROSITE_TOGGLEABLE_SECTIONS.filter(
    (s) => !isSectionVisible(sections, s.key),
  ).length;

  return (
    <div className="space-y-4">
      {/* ── Status + address ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
          style={
            websiteLive
              ? {
                  background:
                    'color-mix(in srgb, var(--m-sage-deep) 12%, transparent)',
                  color: 'var(--m-sage-deep)',
                }
              : { background: 'var(--m-paper)', color: 'var(--m-slate-3)' }
          }
        >
          {websiteLive ? 'Live' : 'Draft'}
        </span>
        <span className="text-xs text-ink/55">
          Curate what couples see — your page fills in the rest from your profile.
        </span>
      </div>

      {publicPath ? (
        <div className="flex items-center gap-2">
          <code
            className="min-w-0 flex-1 truncate rounded-lg border bg-white px-3 py-2 text-xs"
            style={{ borderColor: 'var(--m-line)', color: 'var(--m-slate)' }}
          >
            {displayHost}
            {publicPath}
          </code>
          <CopyButton value={`${displayHost}${publicPath}`} label="Copy link" />
          <a
            href={publicPath}
            target="_blank"
            rel="noreferrer"
            className="button-secondary inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Globe className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Open live
          </a>
        </div>
      ) : (
        <p
          className="rounded-lg p-3 text-xs"
          style={{ background: 'var(--m-orange-4)', color: 'var(--m-slate)' }}
        >
          Your page goes live once you set an address in{' '}
          <Link
            href="/vendor-dashboard/profile"
            className="font-medium text-terracotta hover:underline"
          >
            Profile
          </Link>
          . You can set everything below now — it applies the moment your page is
          live.
        </p>
      )}

      {/* ── FREE controls ────────────────────────────────────────────────── */}
      <ul className="space-y-2">
        <WebsiteEditRow
          field="microsite_about"
          label="About"
          preview={about ? about : 'Add a short intro'}
          isOpen={open === 'about'}
          onToggle={() => toggle('about')}
          onSaved={close}
        >
          <label htmlFor="microsite_about" className="sr-only">
            About
          </label>
          <textarea
            id="microsite_about"
            name="microsite_about"
            maxLength={MICROSITE_ABOUT_MAX}
            defaultValue={about ?? ''}
            rows={4}
            placeholder="Two or three sentences on who you are and the couples you shoot for."
            className="input-field w-full"
          />
          <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
            Shown under your name on your page. Up to {MICROSITE_ABOUT_MAX}{' '}
            characters.
          </p>
        </WebsiteEditRow>

        <WebsiteEditRow
          field="microsite_featured_services"
          label="Featured services"
          preview={
            featuredServiceIds.length > 0
              ? `${featuredServiceIds.length} highlighted`
              : `Highlight up to ${MICROSITE_FEATURED_SERVICES_MAX}`
          }
          isOpen={open === 'featured'}
          onToggle={() => toggle('featured')}
          onSaved={close}
        >
          {services.length === 0 ? (
            <p className="text-sm text-ink/60">
              Add services in your profile first — then pick which to headline.
            </p>
          ) : (
            <FeaturedServicesField
              services={services}
              initial={featuredServiceIds}
              label={label}
            />
          )}
        </WebsiteEditRow>

        <WebsiteEditRow
          field="microsite_sections"
          label="Sections"
          preview={hiddenCount > 0 ? `${hiddenCount} hidden` : 'All shown'}
          isOpen={open === 'sections'}
          onToggle={() => toggle('sections')}
          onSaved={close}
        >
          <fieldset className="space-y-1">
            <legend className="mb-1 text-xs" style={{ color: 'var(--m-slate-3)' }}>
              Turn sections off to hide them from your page.
            </legend>
            {MICROSITE_TOGGLEABLE_SECTIONS.map((s) => (
              <label
                key={s.key}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm hover:bg-[color:var(--m-orange-4)]"
              >
                {s.label}
                <input
                  type="checkbox"
                  name={`section_${s.key}`}
                  defaultChecked={isSectionVisible(sections, s.key)}
                  className="h-4 w-4 accent-[color:var(--m-orange)]"
                />
              </label>
            ))}
            <p className="pt-1 text-xs" style={{ color: 'var(--m-slate-3)' }}>
              Reviews always show — they&rsquo;re what couples trust most.
            </p>
          </fieldset>
        </WebsiteEditRow>
      </ul>

      {/* ── Awards (read-only) ───────────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-ink/70">Awards and badges</p>
        <div className="flex flex-wrap items-center gap-2">
          {isVerified ? (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
              style={{
                background:
                  'color-mix(in srgb, var(--m-sage-deep) 12%, transparent)',
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
      </div>

      {/* ── PRO controls (locked teaser) ─────────────────────────────────── */}
      <div
        className="space-y-3 rounded-xl border p-4"
        style={{
          borderColor: 'color-mix(in srgb, var(--m-plum, #6b4d8a) 30%, transparent)',
          background: 'color-mix(in srgb, var(--m-plum, #6b4d8a) 6%, transparent)',
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span
            className="inline-flex items-center gap-1.5 text-sm font-medium"
            style={{ color: 'var(--m-plum, #6b4d8a)' }}
          >
            <Lock className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            Pro customization
          </span>
          {isPro ? (
            <span className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
              Included with your plan — coming soon
            </span>
          ) : (
            <Link
              href="/vendor-dashboard/subscription"
              className="inline-flex items-center gap-1 text-sm font-medium"
              style={{ color: 'var(--m-plum, #6b4d8a)' }}
            >
              Upgrade
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            </Link>
          )}
        </div>

        <ul className="space-y-1.5">
          <ProRow icon={<LinkIcon className="h-4 w-4" strokeWidth={1.75} />} label="Custom address" hint="/v/your-name" />
          <ProRow icon={<ImageIcon className="h-4 w-4" strokeWidth={1.75} />} label="Hero photo" hint="Choose or upload" />
          <ProRow icon={<Palette className="h-4 w-4" strokeWidth={1.75} />} label="Accent theme" hint="Preset palettes" />
          <ProRow icon={<Newspaper className="h-4 w-4" strokeWidth={1.75} />} label="Featured editorials" hint="Pick 2" />
          <ProRow icon={<Pin className="h-4 w-4" strokeWidth={1.75} />} label="Pinned review" hint="Feature one" />
        </ul>
      </div>

      {publicPath ? (
        <a
          href={publicPath}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-terracotta hover:underline"
        >
          View your page
          <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
        </a>
      ) : null}
    </div>
  );
}

/* ─── One inline-editable free row ──────────────────────────────────────── */
function WebsiteEditRow({
  field,
  label,
  preview,
  isOpen,
  onToggle,
  onSaved,
  children,
}: {
  field: string;
  label: string;
  preview: string | null;
  isOpen: boolean;
  onToggle: () => void;
  onSaved: () => void;
  children: React.ReactNode;
}) {
  const toast = useToast();
  const [state, formAction] = useActionState<FieldSaveResult | null, FormData>(
    updateVendorWebsiteField,
    null,
  );
  const handledRef = useRef<FieldSaveResult | null>(null);

  useEffect(() => {
    if (!state || state === handledRef.current) return;
    handledRef.current = state;
    if (state.ok) {
      toast.success(`${label} saved.`);
      onSaved();
    } else {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <li
      className="overflow-hidden rounded-lg border bg-white"
      style={{ borderColor: isOpen ? 'var(--m-orange-3)' : 'var(--m-line)' }}
    >
      <div className="flex items-center gap-3 p-3">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-ink">{label}</span>
          {preview ? (
            <span
              className="block truncate text-xs"
              style={{ color: 'var(--m-slate-3)' }}
            >
              {preview}
            </span>
          ) : null}
        </span>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-terracotta transition-colors hover:bg-[color:var(--m-orange-4)]"
        >
          {isOpen ? (
            <>
              Close
              <ChevronDown
                className="h-3.5 w-3.5 rotate-180"
                strokeWidth={2}
                aria-hidden
              />
            </>
          ) : (
            <>
              <Pencil className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              Edit
            </>
          )}
        </button>
      </div>

      <Collapsible open={isOpen}>
        <div
          className="border-t px-3 pb-3 pt-3"
          style={{ borderColor: 'var(--m-line)' }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              onToggle();
            }
          }}
        >
          <form action={formAction} className="space-y-3">
            <input type="hidden" name="field" value={field} />
            {children}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onToggle}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-ink/60 hover:bg-ink/5"
              >
                Cancel
              </button>
              <SubmitButton
                className="button-primary px-4 py-1.5 text-sm"
                pendingLabel="Saving…"
              >
                Save
              </SubmitButton>
            </div>
          </form>
        </div>
      </Collapsible>
    </li>
  );
}

/* ─── Featured-services picker (client, caps selection at the max) ───────── */
function FeaturedServicesField({
  services,
  initial,
  label,
}: {
  services: string[];
  initial: string[];
  label: (leaf: string) => string;
}) {
  const [picked, setPicked] = useState<string[]>(
    initial.filter((s) => services.includes(s)),
  );
  const atMax = picked.length >= MICROSITE_FEATURED_SERVICES_MAX;

  const togglePick = (leaf: string, checked: boolean) => {
    setPicked((cur) => {
      if (checked) {
        if (cur.includes(leaf) || cur.length >= MICROSITE_FEATURED_SERVICES_MAX)
          return cur;
        return [...cur, leaf];
      }
      return cur.filter((s) => s !== leaf);
    });
  };

  return (
    <fieldset className="space-y-1">
      <legend className="mb-1 text-xs" style={{ color: 'var(--m-slate-3)' }}>
        Pick up to {MICROSITE_FEATURED_SERVICES_MAX} to show first on your page.
      </legend>
      <div className="max-h-[40vh] space-y-0.5 overflow-y-auto">
        {services.map((leaf) => {
          const isPicked = picked.includes(leaf);
          const disabled = !isPicked && atMax;
          return (
            <label
              key={leaf}
              className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm hover:bg-[color:var(--m-orange-4)]"
              style={disabled ? { opacity: 0.5 } : undefined}
            >
              <span className="min-w-0 truncate">{label(leaf)}</span>
              <input
                type="checkbox"
                name="microsite_featured_services"
                value={leaf}
                checked={isPicked}
                disabled={disabled}
                onChange={(e) => togglePick(leaf, e.target.checked)}
                className="h-4 w-4 accent-[color:var(--m-orange)]"
              />
            </label>
          );
        })}
      </div>
      <p className="pt-1 text-xs tabular-nums" style={{ color: 'var(--m-slate-3)' }}>
        {picked.length} of {MICROSITE_FEATURED_SERVICES_MAX} selected
      </p>
    </fieldset>
  );
}

/* ─── One locked Pro row ────────────────────────────────────────────────── */
function ProRow({
  icon,
  label,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <li className="flex items-center gap-2.5 text-sm" style={{ color: 'var(--m-slate-3)' }}>
      <span aria-hidden style={{ color: 'var(--m-plum, #6b4d8a)' }}>
        {icon}
      </span>
      <span className="text-ink/70">{label}</span>
      <span className="ml-auto text-xs">{hint}</span>
    </li>
  );
}

function titleCase(s: string): string {
  return s
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
