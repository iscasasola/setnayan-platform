// Local stand-in for Supabase so the real routes render signed in, with an EMPTY account.
import http from 'node:http';
const USER = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated',
  email: 'walker@example.test', email_confirmed_at: '2026-01-01T00:00:00Z', app_metadata: { provider: 'email' },
  user_metadata: { full_name: 'Sample Walker' }, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };
const ROWS = { users: [{ user_id: USER.id, account_type: 'couple', deleted_at: null, tour_seen_keys: ['*'], display_name: 'Sample Walker', terms_version: process.env.TERMS || null }] };
const seen = new Map();
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); const p = u.pathname;
  const key = req.method + ' ' + p; seen.set(key, (seen.get(key) || 0) + 1);
  const send = (code, body, h = {}) => { res.writeHead(code, { 'content-type': 'application/json', 'content-range': '*/0', ...h }); res.end(body === undefined ? '' : JSON.stringify(body)); };
  if (p === '/__seen') return send(200, Object.fromEntries(seen));
  if (p.startsWith('/auth/v1/.well-known')) return send(200, { keys: [] });
  if (p === '/auth/v1/user') return send(200, USER);
  if (p.startsWith('/auth/v1/')) return send(200, {});
  if (p.startsWith('/rest/v1/rpc/')) return send(200, null);
  if (p.startsWith('/rest/v1/')) {
    const t = p.slice(9); const rows = ROWS[t] || [];
    if (req.method === 'HEAD') return send(200, undefined, { 'content-range': `*/${rows.length}` });
    if ((req.headers.accept || '').includes('vnd.pgrst.object')) return rows[0] ? send(200, rows[0]) : send(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: 'The result contains 0 rows', hint: null });
    return send(200, rows, { 'content-range': rows.length ? `0-${rows.length - 1}/${rows.length}` : '*/0' });
  }
  return send(404, { message: 'stub: not served' });
}).listen(54321, '127.0.0.1', () => console.log('stub on 54321'));
