// Cloudflare Worker: raffle sign-ups.
//
// Everything else on the site is static and served straight from ./dist.
// Only these paths reach this code (see run_worker_first in wrangler.jsonc):
//
//   POST /api/raffle            save { name, phone } to the RAFFLE KV namespace
//   GET  /raffle/entries?key=…  private list of everyone who entered (copy / CSV)
//   GET  /raffle/entries.csv?key=…
//
// The private list needs the ADMIN_KEY secret (Cloudflare dashboard → Worker →
// Settings → Variables and Secrets). Without it, the list stays locked.

const MAX_NAME = 80;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '');

    if (path === '/api/raffle') {
      if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);
      return enter(request, env);
    }

    if (path === '/raffle/entries' || path === '/raffle/entries.csv') {
      if (!env.ADMIN_KEY || url.searchParams.get('key') !== env.ADMIN_KEY) {
        return new Response('Not found', { status: 404 });
      }
      const entries = await listEntries(env);
      return path.endsWith('.csv') ? csv(entries) : adminPage(entries, url.searchParams.get('key'));
    }

    return env.ASSETS.fetch(request);
  },
};

async function enter(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Bad request' }, 400);
  }

  // Honeypot: real people never see or fill this field.
  if (body.website) return json({ ok: true });

  const name = String(body.name || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
  let digits = String(body.phone || '').replace(/\D/g, '');
  if (digits.length === 10) digits = '1' + digits; // US number without country code

  if (!name) return json({ ok: false, error: 'Please add your name.' }, 400);
  if (digits.length < 8 || digits.length > 15) {
    return json({ ok: false, error: 'Please check your phone number.' }, 400);
  }

  // One entry per phone number.
  const key = `entry:${digits}`;
  const existing = await env.RAFFLE.get(key);
  if (existing) return json({ ok: true, already: true });

  const entry = { name, phone: '+' + digits, at: new Date().toISOString() };
  // Stored as metadata too, so the list page reads everything in one pass.
  await env.RAFFLE.put(key, JSON.stringify(entry), { metadata: entry });
  return json({ ok: true });
}

async function listEntries(env) {
  const entries = [];
  let cursor;
  do {
    const page = await env.RAFFLE.list({ prefix: 'entry:', cursor });
    for (const k of page.keys) if (k.metadata) entries.push(k.metadata);
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return entries.sort((a, b) => a.at.localeCompare(b.at));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

const csvCell = (s) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

function csv(entries) {
  const rows = [['Name', 'Phone', 'Entered (New York)'], ...entries.map((e) => [e.name, e.phone, nyTime(e.at)])];
  return new Response(rows.map((r) => r.map(csvCell).join(',')).join('\n'), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="raffle-entries.csv"',
      'cache-control': 'no-store',
    },
  });
}

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const nyTime = (iso) =>
  new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' });

function adminPage(entries, key) {
  const rows = entries
    .map((e, i) => `<tr><td>${i + 1}</td><td>${esc(e.name)}</td><td>${esc(e.phone)}</td><td>${esc(nyTime(e.at))}</td></tr>`)
    .join('');
  const data = JSON.stringify(entries.map((e) => [e.name, e.phone])).replace(/</g, '\\u003c');

  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Raffle entries (${entries.length})</title>
<style>
  body{font-family:-apple-system,system-ui,sans-serif;margin:0;padding:1.5rem;color:#0d0d0d;background:#f6f5f4}
  h1{font-size:1.5rem;margin:0 0 .3rem}
  p{color:#555;margin:0 0 1.2rem}
  .bar{display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:1.2rem}
  button,a.btn{font:inherit;font-size:.9rem;padding:.7rem 1rem;border:1px solid #0d0d0d;background:#0d0d0d;color:#fff;border-radius:6px;cursor:pointer;text-decoration:none}
  button.alt,a.btn{background:#fff;color:#0d0d0d}
  table{width:100%;border-collapse:collapse;background:#fff;font-size:.95rem}
  th,td{text-align:left;padding:.6rem .7rem;border-bottom:1px solid #e6e6e6}
  th{font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;color:#8c8c8c}
  #msg{color:#0a7a2f;font-weight:600;min-height:1.2em}
</style></head><body>
<h1>Raffle entries: ${entries.length}</h1>
<p>Copy the list and paste it into the raffle platform. Each person can only enter once per phone number.</p>
<div class="bar">
  <button data-copy="both">Copy names + phones</button>
  <button class="alt" data-copy="name">Copy names only</button>
  <button class="alt" data-copy="phone">Copy phones only</button>
  <a class="btn" href="/raffle/entries.csv?key=${encodeURIComponent(key)}">Download CSV</a>
</div>
<p id="msg"></p>
<table><thead><tr><th>#</th><th>Name</th><th>Phone</th><th>Entered</th></tr></thead><tbody>${rows || '<tr><td colspan="4">No entries yet.</td></tr>'}</tbody></table>
<script>
  const data = ${data};
  const msg = document.getElementById('msg');
  document.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    const m = b.dataset.copy;
    // Tab-separated so it pastes into separate columns in a spreadsheet.
    const text = data.map(([n, p]) => m === 'name' ? n : m === 'phone' ? p : n + '\\t' + p).join('\\n');
    try { await navigator.clipboard.writeText(text); msg.textContent = 'Copied ' + data.length + ' entries.'; }
    catch { msg.textContent = 'Copy failed. Use Download CSV instead.'; }
  }));
</script>
</body></html>`;
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
  });
}
