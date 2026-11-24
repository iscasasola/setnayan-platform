#!/usr/bin/env node
/**
 * SPEED REPORT: turns `page-rounds.mjs --json` (+ the live TTFB and JS tables) into the markdown tables of
 * build-sessions/SPEED-AUDIT-2026-11-24.md. Read-only on the app.
 *
 *   node scripts/audit/page-rounds.mjs --json /tmp/rounds.json
 *   node scripts/audit/live-ttfb.mjs > /tmp/ttfb.tsv
 *   node scripts/audit/live-js-weight.mjs > /tmp/js.tsv
 *   node scripts/audit/speed-report.mjs /tmp/rounds.json /tmp/ttfb.tsv /tmp/js.tsv build-sessions/SPEED-AUDIT-2026-11-24.md
 *
 * It rewrites only the blocks between `<!-- gen:NAME -->` and `<!-- /gen:NAME -->` in the doc; the prose
 * around them is hand-written.
 */
import fs from 'node:fs';

const [roundsPath, ttfbPath, jsPath, docPath] = process.argv.slice(2);
const data = JSON.parse(fs.readFileSync(roundsPath, 'utf8'));
const pages = data.pages.filter((p) => !p.error);

const seg = (p, kind) => p.segments.find((s) => s.kind === kind);
const layoutsOf = (p) => p.segments.filter((s) => s.kind === 'layout' && s.file !== 'app/layout.tsx');
const worstLayout = (p) => layoutsOf(p).reduce((a, s) => (!a || s.now > a.now ? s : a), null);
const short = (f) => (f ?? '').replace(/^app\//, '').replace(/\/page\.tsx$/, '').replace(/\.tsx?$/, '');
const sym = (label) => {
  if (label.startsWith('<')) return label;
  const i = label.lastIndexOf(':');
  return i > 0 ? `${label.slice(0, i)}:${label.slice(i + 1)}` : label;
};

/** The steps one level under chain[i] (the flattened path keeps depth order). */
function childrenOf(chain, i) {
  const out = [];
  for (let k = i + 1; k < chain.length && chain[k].d > chain[i].d; k++) if (chain[k].d === chain[i].d + 1) out.push(chain[k]);
  return out;
}
/** A segment's top-level steps; a wrapper in the segment's OWN file that carries most of the rounds is opened up. */
function topSteps(s) {
  let level = s.chain.map((c, i) => ({ ...c, i })).filter((c) => c.d === 0);
  for (let guard = 0; guard < 2; guard++) {
    const total = level.reduce((a, c) => a + c.r, 0);
    const big = level.find((c) => !c.label.startsWith('<') && c.r >= 0.8 * total && (c.label.split(':')[0] === s.file || c.label.split(':')[0].startsWith(s.file.replace(/[^/]+$/, ''))));
    if (!big) break;
    const kids = childrenOf(s.chain, big.i).map((c) => ({ ...c, i: s.chain.indexOf(c) }));
    if (!kids.length) break;
    level = kids;
  }
  return level;
}
/** Top-level steps of a segment's critical path, slowest first. */
function causes(s, max = 3) {
  if (!s) return [];
  const top = topSteps(s).filter((c) => c.r >= 1);
  const merged = [];
  let leafRun = 0;
  for (const c of top) {
    if (/^(from|rpc|storage|fetch|auth)\b/.test(c.label)) {
      leafRun += c.r;
      continue;
    }
    if (leafRun) merged.push({ label: `${leafRun} read${leafRun > 1 ? 's' : ''} in series`, r: leafRun, inline: true });
    leafRun = 0;
    merged.push({ label: c.label.startsWith('<') ? `${c.label} (${short(c.file)})` : sym(c.label), r: c.r, child: c.label.startsWith('<'), file: c.file ?? c.label.split(':')[0] });
  }
  if (leafRun) merged.push({ label: `${leafRun} read${leafRun > 1 ? 's' : ''} in series`, r: leafRun, inline: true });
  return merged.sort((a, b) => b.r - a.r).slice(0, max);
}

const HOT = new Set(['lib/', 'app/_components/', 'components/']);
const isShared = (f) => f && [...HOT].some((h) => f.startsWith(h));

function fixFor(p) {
  const s = seg(p, 'page');
  const out = [];
  if (!s || s.now <= 3) {
    const L = worstLayout(p);
    return L && L.now > 3 ? `page is fine; the wait is the layout (${short(L.file)})` : 'nothing to fix';
  }
  const top = topSteps(s).filter((c) => c.r >= 1);
  const kids = top.filter((c) => c.label.startsWith('<') && c.r >= 2);
  const serial = top.filter((c) => !c.label.startsWith('<')).length;
  if (serial >= 3) out.push(`start the ${serial} serial reads at once (one \`Promise.all\`)`);
  for (const k of kids.slice(0, 2)) out.push(`preload ${k.label} with the page's batch (\`preload…\` + \`cache()\`)`);
  const pageLoops = p.loops.filter((l) => l.at.startsWith(p.file.replace(/page\.tsx$/, '')));
  if (pageLoops.length) out.push(`N+1 at \`${pageLoops[0].at}\` → one \`.in()\` read`);
  const sharedSlow = top.filter((c) => !c.label.startsWith('<') && c.r >= 3 && isShared(c.label.split(':')[0]));
  if (sharedSlow.length) out.push(`shared loader ${sharedSlow.map((c) => `\`${c.label.split(':').pop()}\``).join(', ')} (its own batch)`);
  if (p.dupes.length) out.push(`\`cache()\` on ${p.dupes.slice(0, 2).map((d) => `\`${d.split(':').pop()}\``).join(', ')} (read by layout and page)`);
  if (p.metaDupes.length) out.push(`\`generateMetadata\` repeats ${p.metaDupes.slice(0, 1).map((d) => `\`${d.split(':').pop()}\``).join('')}: \`cache()\` it`);
  return out.length ? out.join(' · ') : 'start each read with its inputs (move `await`s to one wait)';
}

function sizeFor(p) {
  const s = seg(p, 'page');
  if (!s || s.now <= 3) return '–';
  const delta = s.now - s.ideal;
  const files = new Set(topSteps(s).filter((c) => c.r >= 2).map((c) => c.file ?? c.label.split(':')[0]).filter(Boolean));
  const loops = p.loops.some((l) => l.at.startsWith(p.file.replace(/page\.tsx$/, '')));
  if (delta <= 3 && files.size <= 1 && !loops) return 'S';
  if (delta <= 10 && files.size <= 3) return 'M';
  return 'L';
}

const pageNow = (p) => seg(p, 'page')?.now ?? 0;
const after = (p) => Math.max(1, ...p.segments.map((s) => s.ideal));
const md = (s) => String(s).replace(/\|/g, '\\|');
const cachedFor = (p) => (p.config?.revalidate ? Number(p.config.revalidate) : null);
const route = (p) => `\`${p.route}\`${p.intercept ? ' (sheet)' : ''}${cachedFor(p) ? ` (cached ${cachedFor(p)} s)` : ''}`;

// ── blocks ──────────────────────────────────────────────────────────────
const blocks = {};

blocks.summary = (() => {
  const over = pages.filter((p) => p.now > 3).length;
  const ownOver = pages.filter((p) => pageNow(p) > 3).length;
  const loops = new Set(pages.flatMap((p) => p.loops.map((l) => l.at)));
  const getUser = new Set(pages.flatMap((p) => p.getUser));
  const bucket = (lo, hi) => pages.filter((p) => p.now >= lo && p.now <= hi).length;
  return [
    `| | pages |`,
    `|---|--:|`,
    `| Pages traced (every \`page.tsx\` under \`apps/web/app\`, \`/dev\` skipped) | ${pages.length} |`,
    `| **Over 3 rounds (route, layouts included)** | **${over}** |`,
    `| Over 3 rounds in the page's OWN reads (layouts aside) | ${ownOver} |`,
    `| 1–3 rounds | ${bucket(0, 3)} |`,
    `| 4–9 rounds | ${bucket(4, 9)} |`,
    `| 10–19 rounds | ${bucket(10, 19)} |`,
    `| 20+ rounds | ${bucket(20, 999)} |`,
    `| N+1 loops on a critical path (distinct sites) | ${loops.size} |`,
    `| Uncached \`auth.getUser()\` calls on a critical path (distinct sites) | ${getUser.size} |`,
  ].join('\n');
})();

blocks.layouts = (() => {
  const L = new Map();
  for (const p of pages)
    for (const s of p.segments)
      if (s.kind === 'layout') {
        if (!L.has(s.file)) L.set(s.file, { s, n: 0 });
        L.get(s.file).n++;
      }
  const rows = [...L.values()].filter((x) => x.s.now > 0).sort((a, b) => b.s.now - a.s.now);
  return [
    '| Layout | Pages under it | Rounds now | What causes them | Kids drawn after it returns | Rounds after |',
    '|---|--:|--:|---|---|--:|',
    ...rows.map(({ s, n }) => `| \`${s.file}\` | ${n} | ${s.now} | ${causes(s, 4).map((c) => `${md(c.label)} (${c.r})`).join(' · ')} | ${(s.kids ?? []).map((k) => `${md(k.label)} ${k.cp}`).join(', ') || '–'} | ${Math.max(1, s.ideal)} |`),
  ].join('\n');
})();

blocks.top30 = (() => {
  // A page with `revalidate` pays its rounds only when its cached copy is refilled, so it is not ranked here.
  const rows = [...pages].filter((p) => !cachedFor(p)).sort((a, b) => pageNow(b) - pageNow(a) || b.now - a.now).slice(0, 30);
  return [
    '| # | Route | Role | Page rounds | Route rounds | What causes them | Fix (#8278 pattern) | After | Size |',
    '|--:|---|---|--:|--:|---|---|--:|:-:|',
    ...rows.map((p, i) => `| ${i + 1} | ${route(p)} | ${p.role} | **${pageNow(p)}** | ${p.now} | ${causes(seg(p, 'page'), 3).map((c) => `${md(c.label)} (${c.r})`).join(' · ')} | ${md(fixFor(p))} | ${after(p)} | ${sizeFor(p)} |`),
  ].join('\n');
})();

// ── batches by file area ──
const BATCHES = [
  // shells and layouts first: each fixes every page under it
  { id: 'L1', title: 'Signed-in shell: the bell, reminders and rail account', files: ['app/_components/frontdoor/signed-in-cluster.tsx', 'app/_components/frontdoor/app-rail-shell.tsx', 'app/_components/frontdoor/rail-data.ts', 'lib/dashboard-shell.ts', 'lib/chat-reminders.server.ts', 'lib/notifications.ts'], match: () => false },
  { id: 'L2', title: 'Supplier layout', files: ['app/vendor-dashboard/layout.tsx'], match: () => false },
  { id: 'L3', title: 'Event layout (every host page)', files: ['app/dashboard/[eventId]/layout.tsx', 'lib/logo-plays.server.ts'], match: () => false },
  { id: 'L4', title: 'Admin layout', files: ['app/admin/layout.tsx', 'lib/admin/require-admin.ts', 'lib/admin-map/admin-row-index.ts', 'lib/admin/queue-counts.ts', 'app/_components/account-switcher/get-switcher-data.ts'], match: () => false },
  { id: 'L5', title: 'Guest Event Hub layout + who-may-see-it', files: ['app/[slug]/layout.tsx', 'app/[slug]/_lib/loaders.ts', 'lib/slug-access.ts', 'lib/guest-session.ts', 'lib/booked-supplier.ts', 'lib/guest-membership-session.ts', 'lib/guest-seat-read.ts'], match: () => false },
  { id: 'L6', title: 'Account, hub and public shells', files: ['app/dashboard/layout.tsx', 'app/dashboard/(account)/layout.tsx', 'app/(hub)/layout.tsx', 'app/(hub)/dashboard/layout.tsx', 'app/(shell)/layout.tsx', 'lib/user-row.ts', 'app/_components/spotlight.tsx'], match: () => false },
  // shared loaders
  { id: 'S1', title: 'Entitlement gates (one batched answer per render)', files: ['lib/entitlements.ts', 'lib/couple-website-pro.ts', 'lib/animated-monogram.ts', 'lib/event-entitlement-client.server.ts', 'lib/event-entitlement-client.ts', 'lib/retired-products.server.ts'], match: () => false },
  { id: 'S2', title: 'The editorial / Story loader', files: ['app/[slug]/_components/editorial/data.ts', 'lib/story-suppliers.server.ts', 'lib/live-wall.ts'], match: () => false },
  { id: 'S3', title: 'Supplier identity reads', files: ['lib/vendor-profile.ts', 'lib/active-shop.ts', 'lib/vendor-role.ts', 'lib/vendor-room-access.ts', 'lib/vendor-room-reads.ts', 'lib/vendor-schedule.ts', 'lib/piece-seats.ts'], match: () => false },
  { id: 'S4', title: 'Settings, profiles and catalogue readers', files: ['lib/platform-settings.ts', 'lib/event-type-profile.ts', 'lib/taxonomy-db.ts', 'lib/taxonomy-read.ts', 'lib/setnayan-ai-server.ts', 'lib/vendor-event-fee-access.server.ts', 'lib/seating.ts'], match: () => false },
  // page areas (owner order: suppliers + payments → couples + guests → admin)
  { id: 'P1', title: 'Supplier: shop, services, packages', match: (f) => /^app\/vendor-dashboard\/(shop|services|packages|collections|lines|attributes|repertoire|moodboard-library|invite|_components)\//.test(f) || f === 'app/vendor-dashboard/page.tsx' },
  { id: 'P2', title: 'Supplier: clients, messages, on-the-day, customers', match: (f) => /^app\/vendor-dashboard\/(clients|customers|messages|on-the-day|contracts|disputes|activities|notifications|manpower|spaces)\//.test(f) },
  { id: 'P3', title: 'Supplier: plan, team, money, growth', match: (f) => /^app\/vendor-dashboard\//.test(f) },
  { id: 'P4', title: 'Payments (pay, receipts, the admin payments desk), claims, open-shop', match: (f) => /^app\/(pay|receipts|proposals|vendor|open-shop|claim|vendor-invite)\//.test(f) || /^app\/admin\/payments\//.test(f) },
  { id: 'P5', title: 'Host: Studio', match: (f) => /^app\/dashboard\/\[eventId\]\/studio\//.test(f) },
  { id: 'P6', title: 'Host: Event Hub maker, story, logo, invitation, memories', match: (f) => /^app\/dashboard\/\[eventId\]\/(website|story|monogram|invitation|launch|prints|memories|galleries|alaala|event-page|apple-pro)\//.test(f) },
  { id: 'P7', title: 'Host: guests, seating, live, people', match: (f) => /^app\/dashboard\/\[eventId\]\/(guests|seating|live|event-qr|manpower|nikah|sponsors|access-requests|activity)\//.test(f) },
  { id: 'P8', title: 'Host: suppliers, money, details, the rest', match: (f) => /^app\/dashboard\/\[eventId\]\//.test(f) },
  { id: 'P9', title: 'Host: account pages, hub, create', match: (f) => /^app\/(dashboard|\(hub\)|onboarding|host|u|samahan)\//.test(f) },
  { id: 'P10', title: 'Guest: Event Hub pages and shop pages (`/[slug]` renders the shop body too)', match: (f) => /^app\/(\[slug\]|v)\//.test(f) },
  { id: 'P11', title: 'Guest: Papic, live, Panood, join, wall', match: (f) => /^app\/(papic|join|live|panood|wall|i|3d_plan)\//.test(f) },
  { id: 'P12', title: 'Admin: people, suppliers, events', match: (f) => /^app\/admin\/(accounts|users|vendors|vendor-|demo-vendors|directory|verify|verification-docs|events|event-deletions|account-deletions|team|reviews|user-reports|approvals|completions|corrections|data-privacy|compliance|concierge-abuse|chat-flags|fraud|integrity-watch|repost-watch|force-majeure|disputes|pax-changes)/.test(f) },
  { id: 'P13', title: 'Admin: money, catalogue, settings, the rest', match: (f) => /^app\/admin\//.test(f) },
  { id: 'P14', title: 'Public pages, tour, sign-in, the rest', match: () => true },
];
const SHARED_BATCH = new Map();
for (const b of BATCHES) for (const f of b.files ?? []) SHARED_BATCH.set(f, b.id);

blocks.batches = (() => {
  const into = new Map(BATCHES.map((b) => [b.id, []]));
  for (const p of pages) {
    if (pageNow(p) <= 3) continue;
    const b = BATCHES.find((x) => x.id.startsWith('P') && x.match(p.file));
    into.get(b.id).push(p);
  }
  // pages each shared batch speeds up: its files on the page's chain (any segment, depth ≤ 1)
  const reach = new Map(BATCHES.map((b) => [b.id, new Set()]));
  for (const p of pages)
    for (const s of p.segments) {
      if (s.kind === 'layout' && SHARED_BATCH.has(s.file) && s.now > 3) reach.get(SHARED_BATCH.get(s.file)).add(p.route + p.file);
      for (const c of s.chain) {
        const f = c.file ?? c.label.split(':')[0];
        if (c.r >= 2 && SHARED_BATCH.has(f)) reach.get(SHARED_BATCH.get(f)).add(p.route + p.file);
      }
    }
  const lines = [];
  for (const b of BATCHES) {
    const list = into.get(b.id);
    if (b.files) {
      const n = reach.get(b.id).size;
      lines.push(`### ${b.id} · ${b.title}`, '', `**Owns:** ${b.files.map((f) => `\`${f}\``).join(' · ')}  `, `**Speeds up:** ${n} page${n === 1 ? '' : 's'} (the file is on their critical path at 2+ rounds, or is their layout)`, '');
      continue;
    }
    if (!list.length) continue;
    const dirs = [...new Set(list.map((p) => p.file.replace(/\/page\.tsx$/, '')))];
    const total = list.reduce((a, p) => a + pageNow(p), 0);
    const saved = list.reduce((a, p) => a + Math.max(0, pageNow(p) - (seg(p, 'page')?.ideal ?? 0)), 0);
    const sizes = list.map(sizeFor);
    lines.push(
      `### ${b.id} · ${b.title}`,
      '',
      `**Owns:** the page folders below (each \`page.tsx\` with its own \`_components/\` and \`_lib/\`), never a file a shared batch owns.  `,
      `**Pages over 3 own rounds:** ${list.length} · **rounds now (sum):** ${total} · **rounds a fix can take off:** ${saved} · **sizes:** ${['S', 'M', 'L'].map((z) => `${sizes.filter((x) => x === z).length} ${z}`).join(', ')}`,
      '',
      '<details><summary>Folders</summary>',
      '',
      ...dirs.map((d) => `- \`${d}\``),
      '',
      '</details>',
      '',
    );
  }
  return lines.join('\n');
})();

blocks.all = (() => {
  const rows = [...pages].sort((a, b) => a.route.localeCompare(b.route) || a.file.localeCompare(b.file));
  const batchOf = (p) => (pageNow(p) > 3 ? BATCHES.find((x) => x.id.startsWith('P') && x.match(p.file)).id : '–');
  return [
    '| Route | Role | Rounds now (page · layout) | What causes them | Fix (#8278 pattern) | After | Size | Batch |',
    '|---|---|---|---|---|--:|:-:|:-:|',
    ...rows.map((p) => {
      const L = worstLayout(p);
      const c = causes(seg(p, 'page'), 3);
      return `| ${route(p)} | ${p.role} | **${p.now}** (${pageNow(p)} · ${L ? `${L.now} ${short(L.file).replace(/\/layout$/, '')}` : '0'}) | ${c.map((x) => `${md(x.label)} (${x.r})`).join(' · ') || '–'} | ${md(fixFor(p))} | ${after(p)} | ${sizeFor(p)} | ${batchOf(p)} |`;
    }),
  ].join('\n');
})();

blocks.loops = (() => {
  const m = new Map();
  for (const p of pages) for (const l of p.loops) {
    if (!m.has(l.at)) m.set(l.at, { ...l, n: 0 });
    m.get(l.at).n++;
  }
  const rows = [...m.values()].sort((a, b) => b.n - a.n);
  return ['| Loop (file:line) | Reads per item | Pages it sits under |', '|---|--:|--:|', ...rows.map((l) => `| \`${l.at}\` | ${l.perItem} | ${l.n} |`)].join('\n');
})();

blocks.getuser = (() => {
  const m = new Map();
  for (const p of pages) for (const g of p.getUser) m.set(g, (m.get(g) ?? 0) + 1);
  const rows = [...m].sort((a, b) => b[1] - a[1]);
  return ['| Fresh `auth.getUser()` (file:line) | Pages it sits under |', '|---|--:|', ...rows.map(([g, n]) => `| \`${g}\` | ${n} |`)].join('\n');
})();

const tsv = (pth) => {
  if (!pth || !fs.existsSync(pth)) return [];
  const [head, ...rows] = fs.readFileSync(pth, 'utf8').trim().split('\n').map((l) => l.split('\t'));
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
};
blocks.ttfb = (() => {
  const rows = tsv(ttfbPath).sort((a, b) => Number(b.server_wait_median_s ?? b.ttfb_median_s) - Number(a.server_wait_median_s ?? a.ttfb_median_s));
  const js = new Map(tsv(jsPath).map((r) => [r.path, r]));
  return [
    '| Path | Status | TTFB median (s) | Server wait median (s) | Total (s) | HTML on the wire (KB) | JS gz (KB): total · own | Samples (TTFB s) |',
    '|---|:-:|--:|--:|--:|--:|---|---|',
    ...rows.map((r) => {
      const j = js.get(r.path);
      const over = Number(r.server_wait_median_s) > 0.7 ? ' ⚠' : '';
      return `| \`${r.path}\`${r.redirect ? ` → \`${r.redirect}\`` : ''} | ${r.status} | ${r.ttfb_median_s} | **${r.server_wait_median_s}**${over} | ${r.total_median_s} | ${(Number(r.bytes) / 1024).toFixed(1)} | ${j ? `${j.total_js_gz_kb} · ${j.own_gz_kb}` : '–'} | ${r.ttfb_samples} |`;
    }),
  ].join('\n');
})();

let doc = fs.readFileSync(docPath, 'utf8');
for (const [name, body] of Object.entries(blocks)) {
  const re = new RegExp(`(<!-- gen:${name} -->)[\\s\\S]*?(<!-- /gen:${name} -->)`);
  if (re.test(doc)) doc = doc.replace(re, `$1\n${body}\n$2`);
}
fs.writeFileSync(docPath, doc);
console.log(`wrote ${Object.keys(blocks).length} blocks into ${docPath}`);

// ── cross-check: a page batch whose pages lean on a file another PAGE batch owns ──
{
  const pBatches = BATCHES.filter((b) => b.id.startsWith('P'));
  const ownerOf = (f) => (SHARED_BATCH.has(f) ? SHARED_BATCH.get(f) : f.startsWith('app/') && !/^app\/_(components|actions|lib)\//.test(f) ? pBatches.find((b) => b.match(f))?.id : null);
  const cross = new Map();
  for (const p of pages) {
    if (pageNow(p) <= 3) continue;
    const mine = pBatches.find((b) => b.match(p.file)).id;
    for (const s of p.segments) {
      if (s.kind.startsWith('layout')) continue;
      for (const c of s.chain) {
        if (c.r < 2) continue;
        const f = c.file ?? c.label.split(':')[0];
        const o = f && ownerOf(f);
        if (o && o.startsWith('P') && o !== mine) {
          const k = `${f}`;
          if (!cross.has(k)) cross.set(k, { owner: o, users: new Set() });
          cross.get(k).users.add(`${mine} ${p.route}`);
        }
      }
    }
  }
  const lines = ['| File on the path | Owned by | Also on the path of (batch · route) |', '|---|:-:|---|'];
  for (const [f, v] of [...cross].sort()) lines.push(`| \`${f}\` | ${v.owner} | ${[...v.users].slice(0, 4).map((u) => `\`${u}\``).join(', ')}${v.users.size > 4 ? ` +${v.users.size - 4}` : ''} |`);
  let d = fs.readFileSync(docPath, 'utf8');
  const re = /(<!-- gen:cross -->)[\s\S]*?(<!-- \/gen:cross -->)/;
  if (re.test(d)) fs.writeFileSync(docPath, d.replace(re, `$1\n${cross.size ? lines.join('\n') : 'None: no page batch needs a file another page batch owns.'}\n$2`));
  console.log(`cross-batch files: ${cross.size}`);
}
