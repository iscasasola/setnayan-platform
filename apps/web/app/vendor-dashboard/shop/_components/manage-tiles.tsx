'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowRight,
  Building2,
  ChevronDown,
  Globe,
  ShieldCheck,
  Users,
} from 'lucide-react';

import { Collapsible } from './collapsible';

type ToolKey = 'website' | 'team' | 'branch';

/**
 * Manage grid for My Shop. Profile is the ONLY tile that navigates (owner
 * rule 2026-07); Website, Team, and Branch each expand their function INLINE
 * via the shared Collapsible primitive — one open at a time, animated. The
 * panel bodies are rendered on the server (real data + server-action forms)
 * and handed in as props; this client component only owns which is open.
 */
export function ManageTiles({
  completionPct,
  verifyLabel,
  websiteLive,
  teamLabel,
  branchLabel,
  websitePanel,
  teamPanel,
  branchPanel,
}: {
  completionPct: number;
  verifyLabel: string;
  websiteLive: boolean;
  teamLabel: string;
  branchLabel: string;
  websitePanel: React.ReactNode;
  teamPanel: React.ReactNode;
  branchPanel: React.ReactNode;
}) {
  const [open, setOpen] = useState<ToolKey | null>(null);
  const toggle = (t: ToolKey) => setOpen((cur) => (cur === t ? null : t));

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium" style={{ color: 'var(--m-slate)' }}>
        Manage your shop
      </h2>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Profile — the one link out */}
        <Link
          href="/vendor-dashboard/profile"
          className="group flex flex-col rounded-xl border bg-white p-4 transition-colors hover:border-[color:var(--m-orange-3)]"
          style={{ borderColor: 'var(--m-line)' }}
        >
          <div className="mb-3 flex items-center justify-between">
            <ChipIcon>
              <ShieldCheck className="h-5 w-5" strokeWidth={1.75} />
            </ChipIcon>
            <ArrowRight
              aria-hidden
              className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
              strokeWidth={1.75}
              style={{ color: 'var(--m-slate-4)' }}
            />
          </div>
          <p className="text-xl font-semibold tabular-nums" style={{ color: 'var(--m-ink)' }}>
            {completionPct}%
          </p>
          <p className="mt-0.5 text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
            Profile
          </p>
          <p
            className="inline-flex items-center gap-1 text-xs font-medium"
            style={{ color: 'var(--m-orange-2)' }}
          >
            {verifyLabel}
            <ArrowRight aria-hidden className="h-3 w-3" strokeWidth={2} />
          </p>
        </Link>

        <ToolTile
          icon={<Globe className="h-5 w-5" strokeWidth={1.75} />}
          value={websiteLive ? 'Live' : 'Draft'}
          label="Website"
          sub="Customize here"
          isOpen={open === 'website'}
          onToggle={() => toggle('website')}
        />
        <ToolTile
          icon={<Users className="h-5 w-5" strokeWidth={1.75} />}
          value={teamLabel}
          label="Team"
          sub="Invite + manage"
          isOpen={open === 'team'}
          onToggle={() => toggle('team')}
        />
        <ToolTile
          icon={<Building2 className="h-5 w-5" strokeWidth={1.75} />}
          value={branchLabel}
          label="Branch"
          sub="Locations"
          isOpen={open === 'branch'}
          onToggle={() => toggle('branch')}
        />
      </div>

      {/* Inline panels — one shared region below the grid, each animated. */}
      <Collapsible open={open === 'website'}>
        <PanelShell>{websitePanel}</PanelShell>
      </Collapsible>
      <Collapsible open={open === 'team'}>
        <PanelShell>{teamPanel}</PanelShell>
      </Collapsible>
      <Collapsible open={open === 'branch'}>
        <PanelShell>{branchPanel}</PanelShell>
      </Collapsible>
    </section>
  );
}

function ToolTile({
  icon,
  value,
  label,
  sub,
  isOpen,
  onToggle,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  sub: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={isOpen}
      onClick={onToggle}
      className="group flex flex-col rounded-xl border bg-white p-4 text-left transition-colors hover:border-[color:var(--m-orange-3)]"
      style={{ borderColor: isOpen ? 'var(--m-orange-3)' : 'var(--m-line)' }}
    >
      <div className="mb-3 flex items-center justify-between">
        <ChipIcon>{icon}</ChipIcon>
        <ChevronDown
          aria-hidden
          className="h-4 w-4 shrink-0 transition-transform"
          strokeWidth={1.75}
          style={{
            color: 'var(--m-slate-4)',
            transform: isOpen ? 'rotate(180deg)' : 'none',
          }}
        />
      </div>
      <p className="text-xl font-semibold tabular-nums" style={{ color: 'var(--m-ink)' }}>
        {value}
      </p>
      <p className="mt-0.5 text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
        {label}
      </p>
      <p className="truncate text-xs" style={{ color: 'var(--m-slate-3)' }}>
        {sub}
      </p>
    </button>
  );
}

function ChipIcon({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg"
      style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}
      aria-hidden
    >
      {children}
    </span>
  );
}

function PanelShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mt-3 rounded-xl border p-5"
      style={{ borderColor: 'var(--m-orange-3)', background: 'var(--m-paper)' }}
    >
      {children}
    </div>
  );
}
