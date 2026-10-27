/**
 * /dev/admin-supplier-lab — Admin's supplier slice on fixture data, with no sign-in and no database (admin supplier
 * slice, owner 2026-10-28; prototype `prototypes/admin_supplier_slice_2026-10-28/`). DEV-ONLY: production 404s it.
 *
 * It draws the REAL pieces: Work's `SupplierInbox` inside the REAL `QueuesTriageFeed`, Categories' `HubToolsPane`,
 * and the Help inbox's `HelpMessenger` — every form is caught by `LabSubmitCatcher`, which says what would be sent.
 *
 *   ?view=work|cats|msgs   which screen (default work)
 *   &kind=docs|names|cards|types|msgs   Work's chip · &item=<key> an open row (docs:app-1 · names:12 · cards:7 · types:r1 · types:r2 · msgs:m1)
 *   &fail=docs,cards       those kinds' reads fail (said, never "all clear")
 *   &absent=1              the event-type asks table is not in this database yet (#7001 not merged)
 *   &settle=approved&why=… an outcome line, as a settled row shows it
 *   &cat=<label>           Hub tools: which category (Catering · Photo & Video · Live Band · Underwater…)
 *   &m=m1                  Messages: the open conversation
 */
import { notFound } from 'next/navigation';
import { BadgeCheck } from 'lucide-react';
import { QueuesTriageFeed } from '@/app/admin/queues/_components/queues-triage-feed';
import { SupplierInbox } from '@/app/admin/work/_components/supplier-inbox';
import { HubToolsPane } from '@/app/admin/categories/_components/hub-tools-pane';
import { HelpMessenger } from '@/app/admin/help/_components/help-messenger';
import { setHelpMessageStatus } from '@/app/admin/help/actions';
import { coerceSupplierWorkKind } from '@/lib/admin/supplier-work';
import { HUB_TOOLS_SEED, hubToolsFor } from '@/lib/hub-tools';
import { LabSubmitCatcher } from './lab-submit-catcher';
import { LAB_GROUPS, LAB_TYPES, labThreads, labWork } from './fixtures';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export default async function AdminSupplierLabPage({ searchParams }: { searchParams: Promise<SP> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const view = one(sp.view) || 'work';
  const now = Date.now();
  const tabs = [
    ['work', 'Work'],
    ['cats', 'Categories › Hub tools'],
    ['msgs', 'Messages'],
  ] as const;
  return (
    <div className="min-h-screen bg-cream pb-16">
      <nav aria-label="Lab screens" className="flex flex-wrap gap-2 border-b border-ink/10 px-4 py-2 text-xs">
        <strong className="mr-2 tracking-[0.12em] text-ink">SETNAYAN ADMIN · LAB</strong>
        {tabs.map(([k, l]) => (
          <a key={k} href={`/dev/admin-supplier-lab?view=${k}`} aria-current={view === k ? 'page' : undefined} className={view === k ? 'font-bold text-ink underline' : 'text-ink/70'}>
            {l}
          </a>
        ))}
      </nav>
      {view === 'work' ? (
        <QueuesTriageFeed
          title="Work"
          items={[{ key: 'verify', label: 'Verify', href: '/admin/verify', icon: BadgeCheck, description: 'Suppliers awaiting the verification badge.', count: 0, lane: 'trust', dueState: 'ok' }]}
          totalOpen={0}
          basePath="/dev/admin-supplier-lab"
          settle={one(sp.settle) || undefined}
          why={one(sp.why) || undefined}
          lead={
            <SupplierInbox
              read={labWork(now, one(sp.fail).split(',').filter(Boolean), one(sp.absent) === '1')}
              kind={coerceSupplierWorkKind(sp.kind)}
              itemKey={one(sp.item) || undefined}
              basePath={`/dev/admin-supplier-lab?view=work${one(sp.kind) ? `&kind=${one(sp.kind)}` : ''}`}
              groups={LAB_GROUPS}
              eventTypes={LAB_TYPES}
              nowMs={now}
            />
          }
        />
      ) : null}
      {view === 'cats' ? (
        <div className="mx-auto max-w-5xl px-4 py-6">
          <h1 className="mb-2 text-2xl font-semibold text-ink">Categories</h1>
          <label className="flex min-h-[52px] max-w-xl items-center gap-3 border-b border-ink/10">
            <span className="flex-1 text-[15px] font-semibold text-ink">Category</span>
            <span className="text-sm text-ink">{one(sp.cat) || 'Catering'}</span>
          </label>
          {(() => {
            const label = one(sp.cat) || 'Catering';
            const a = hubToolsFor(label, null);
            return <HubToolsPane key={label} categoryId={`lab-${label}`} categoryLabel={label} tools={a.tools} scan={a.scan} source={a.source} />;
          })()}
          <p className="mt-6 text-xs text-ink/70">Seeded categories in this lab: {HUB_TOOLS_SEED.slice(0, 6).map((r) => r.category).join(' · ')} …</p>
        </div>
      ) : null}
      {view === 'msgs' ? (
        <div className="mx-auto max-w-6xl px-4 py-6">
          <h1 className="mb-2 text-2xl font-semibold text-ink">Messages</h1>
          <HelpMessenger
            threads={one(sp.fail) === 'msgs' ? [] : labThreads(now)}
            filter={one(sp.status) || 'open'}
            openId={one(sp.m) || null}
            failed={one(sp.fail) === 'msgs'}
            nowMs={now}
            action={setHelpMessageStatus}
          />
        </div>
      ) : null}
      <LabSubmitCatcher />
    </div>
  );
}
