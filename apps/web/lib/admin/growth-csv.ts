/**
 * growth-csv.ts — the Growth "Export CSV" body (moved out of the route so it
 * can be tested; a route file may only export its handlers).
 * A8·H-11: a section whose read failed is written as `unread` with an errors
 * row naming it — never the zero fallbacks the stats carry.
 */
import type { GrowthStats } from './growth-stats';

function cell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** What a value that could not be read is written as — never 0. */
const UNREAD = 'unread';

export function toCsv(stats: GrowthStats): string {
  const rows: (string | number)[][] = [['section', 'series', 'period', 'value']];
  const genDate = stats.generatedAtIso.slice(0, 10);

  rows.push(['meta', 'range', '', stats.range]);
  rows.push(['meta', 'generated_at', '', genDate]);
  rows.push(['meta', 'demo', '', String(stats.demo)]);
  // A8·H-11: a read that failed is MARKED, never written as 0. Each failed
  // section gets an errors row, and its values are written as `unread`.
  for (const e of stats.errors) rows.push(['errors', 'could_not_read', '', e]);
  const failed = new Set(stats.errors);
  const popUnread = failed.has('population totals');
  const convUnread = failed.has('guest conversion');
  const breakdownsUnread = failed.has('events by type and region');
  const v = (unread: boolean, value: string | number): string | number => (unread ? UNREAD : value);

  const p = stats.population;
  rows.push(['population', 'account_holders', '', v(popUnread, p.accountHolders)]);
  rows.push(['population', 'customers', '', v(popUnread, p.customers)]);
  rows.push(['population', 'vendors', '', v(popUnread, p.vendors)]);
  rows.push(['population', 'vendors_published', '', v(popUnread, p.vendorsPublished)]);
  rows.push(['population', 'services', '', v(popUnread, p.services)]);
  rows.push(['population', 'services_active', '', v(popUnread, p.servicesActive)]);
  rows.push(['population', 'events', '', v(popUnread, p.events)]);
  rows.push(['population', 'guests', '', v(popUnread, p.guests)]);

  for (const s of stats.series) {
    if (failed.has(`${s.key} growth`)) {
      rows.push(['growth_cumulative', s.key, '', UNREAD]);
      rows.push(['growth_new', s.key, '', UNREAD]);
      continue;
    }
    for (const pt of s.points) {
      rows.push(['growth_cumulative', s.key, pt.at.slice(0, 10), pt.cumulative]);
    }
    for (const pt of s.points) {
      rows.push(['growth_new', s.key, pt.at.slice(0, 10), pt.added]);
    }
  }

  const c = stats.conversion;
  rows.push(['conversion', 'rate', '', v(convUnread, c.rate.toFixed(4))]);
  rows.push(['conversion', 'converted', '', v(convUnread, c.converted)]);
  rows.push(['conversion', 'total_guests', '', v(convUnread, c.totalGuests)]);
  rows.push(['conversion', 'new_in_range', '', v(convUnread, c.newInRange)]);
  rows.push([
    'conversion',
    'median_days_to_convert',
    '',
    v(convUnread, c.medianDaysToConvert ?? ''),
  ]);
  rows.push(['conversion', 'sample_size', '', v(convUnread, c.sampleSize)]);
  if (!convUnread) {
    for (const pt of c.points) {
      rows.push(['conversion_cumulative', 'guests', pt.at.slice(0, 10), pt.cumulative]);
    }
    for (const pt of c.points) {
      rows.push(['conversion_new', 'guests', pt.at.slice(0, 10), pt.added]);
    }
  }

  if (breakdownsUnread) {
    rows.push(['breakdown_events_by_type', '', '', UNREAD]);
    rows.push(['breakdown_events_by_region', '', '', UNREAD]);
  } else {
    for (const r of stats.breakdowns.eventsByType) {
      rows.push(['breakdown_events_by_type', r.label, '', r.count]);
    }
    for (const r of stats.breakdowns.eventsByRegion) {
      rows.push(['breakdown_events_by_region', r.label, '', r.count]);
    }
  }

  return rows.map((r) => r.map(cell).join(',')).join('\n') + '\n';
}

