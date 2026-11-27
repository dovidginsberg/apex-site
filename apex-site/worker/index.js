// Cloudflare Worker: raffle sign-ups.
//
// Everything else on the site is static and served straight from ./dist.
// Only these paths reach this code (see run_worker_first in wrangler.jsonc):
//
//   POST /api/raffle            save { name, phone } to the RAFFLE KV namespace
//   GET  /raffle/entries?key=…  private list of everyone who entered (copy / CSV)
//   GET  /raffle/entries.csv?key=…
//   GET  /raffle/entries.vcf?key=…      everyone as phone contacts, to save in one go
//   POST /api/raffle/screenshot          multipart { phone, file }: the 100-views screenshot
//   GET  /raffle/entries/shot/<digits>?key=…   view a screenshot
//   POST /raffle/entries/mark?key=…      { phone, status: approved | rejected | "" }
//
// The private list needs the key whose SHA-256 is ADMIN_KEY_HASH in wrangler.jsonc.

const MAX_NAME = 80;
const MAX_SHOT = 8 * 1024 * 1024; // the page shrinks photos first; this is a safety cap

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '');

    if (path === '/api/raffle') {
      if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);
      return enter(request, env);
    }

    if (path === '/api/raffle/screenshot') {
      if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);
      return screenshot(request, env);
    }

    if (path.startsWith('/raffle/entries')) {
      if (!(await isAdmin(env, url.searchParams.get('key')))) {
        return new Response('Not found', { status: 404 });
      }
      if (path.startsWith('/raffle/entries/shot/')) return showShot(env, path.split('/').pop());
      if (path === '/raffle/entries/mark' && request.method === 'POST') return mark(request, env);
      if (!['/raffle/entries', '/raffle/entries.csv', '/raffle/entries.vcf'].includes(path)) return new Response('Not found', { status: 404 });
      const entries = await listEntries(env);
      if (path.endsWith('.csv')) return csv(entries);
      if (path.endsWith('.vcf')) return vcf(entries);
      return adminPage(entries, url.searchParams.get('key'));
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
  const digits = normPhone(body.phone);

  if (!name) return json({ ok: false, error: 'Please add your name.' }, 400);
  if (digits.length < 8 || digits.length > 15) {
    return json({ ok: false, error: 'Please check your phone number.' }, 400);
  }

  // One entry per phone number.
  const key = `entry:${digits}`;
  const existing = await env.RAFFLE.get(key);
  if (existing) return json({ ok: true, already: true });

  // Stored as metadata too, so the list page reads everything in one pass.
  await saveEntry(env, digits, { name, phone: '+' + digits, at: new Date().toISOString() });
  return json({ ok: true });
}

// The private list's key is checked against ADMIN_KEY_HASH (a SHA-256 in wrangler.jsonc),
// or an ADMIN_KEY secret if one is set in the dashboard.
async function isAdmin(env, key) {
  if (!key) return false;
  if (env.ADMIN_KEY && key === env.ADMIN_KEY) return true;
  if (!env.ADMIN_KEY_HASH) return false;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return hex === env.ADMIN_KEY_HASH;
}

function normPhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10) digits = '1' + digits; // US number without country code
  return digits;
}

async function getEntry(env, digits) {
  const raw = digits && (await env.RAFFLE.get(`entry:${digits}`));
  return raw ? JSON.parse(raw) : null;
}

const saveEntry = (env, digits, entry) =>
  env.RAFFLE.put(`entry:${digits}`, JSON.stringify(entry), { metadata: entry });

async function screenshot(request, env) {
  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: 'Bad request' }, 400);
  }
  const digits = normPhone(form.get('phone'));
  const file = form.get('file');
  const entry = await getEntry(env, digits);
  if (!entry) {
    return json({ ok: false, error: "We couldn't find that number. Use the same number you subscribed with." }, 404);
  }
  if (!file || typeof file === 'string' || !/^image\//.test(file.type)) {
    return json({ ok: false, error: 'Please choose your screenshot image.' }, 400);
  }
  if (file.size > MAX_SHOT) return json({ ok: false, error: 'That image is too large.' }, 400);

  await env.RAFFLE.put(`shot:${digits}`, await file.arrayBuffer(), { metadata: { type: file.type } });
  entry.shotAt = new Date().toISOString();
  entry.status = ''; // a new screenshot needs a fresh look
  await saveEntry(env, digits, entry);
  return json({ ok: true });
}

async function showShot(env, digits) {
  const { value, metadata } = await env.RAFFLE.getWithMetadata(`shot:${digits}`, 'arrayBuffer');
  if (!value) return new Response('Not found', { status: 404 });
  return new Response(value, {
    headers: { 'content-type': metadata?.type || 'image/jpeg', 'cache-control': 'private, max-age=3600' },
  });
}

async function mark(request, env) {
  const body = await request.json().catch(() => ({}));
  const digits = normPhone(body.phone);
  const entry = await getEntry(env, digits);
  if (!entry) return json({ ok: false }, 404);
  entry.status = ['approved', 'rejected'].includes(body.status) ? body.status : '';
  await saveEntry(env, digits, entry);
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
  const rows = [
    ['Name', 'Phone', 'Entered (New York)', 'Screenshot sent', 'Status'],
    ...entries.map((e) => [e.name, e.phone, nyTime(e.at), e.shotAt ? nyTime(e.shotAt) : '', e.status || '']),
  ];
  return new Response(rows.map((r) => r.map(csvCell).join(',')).join('\n'), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="raffle-entries.csv"',
      'cache-control': 'no-store',
    },
  });
}

// All subscribers as one contacts file. Opening it on a phone offers to add them all,
// which is what lets them see the WhatsApp status.
function vcf(entries) {
  const v = (s) => String(s).replace(/([\\,;])/g, '\\$1').replace(/\n/g, ' ');
  const cards = entries.map((e) =>
    ['BEGIN:VCARD', 'VERSION:3.0', `FN:${v(e.name)}`, `N:${v(e.name)};;;;`, `TEL;TYPE=CELL:${e.phone}`, 'NOTE:Apex Chanukah Giveaway', 'END:VCARD'].join('\r\n'),
  );
  return new Response(cards.join('\r\n') + '\r\n', {
    headers: {
      'content-type': 'text/vcard; charset=utf-8',
      'content-disposition': 'attachment; filename="Apex giveaway contacts.vcf"',
      'cache-control': 'no-store',
    },
  });
}

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const nyTime = (iso) =>
  new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' });

function adminPage(entries, key) {
  const k = encodeURIComponent(key);
  const counts = {
    shots: entries.filter((e) => e.shotAt).length,
    approved: entries.filter((e) => e.status === 'approved').length,
  };
  const rows = entries
    .map((e, i) => {
      const d = e.phone.replace(/\D/g, '');
      const shot = e.shotAt
        ? `<a href="/raffle/entries/shot/${d}?key=${k}&v=${encodeURIComponent(e.shotAt)}" target="_blank"><img loading="lazy" src="/raffle/entries/shot/${d}?key=${k}&v=${encodeURIComponent(e.shotAt)}" alt="Screenshot from ${esc(e.name)}"></a><small>${esc(nyTime(e.shotAt))}</small>`
        : '<span class="none">Not yet</span>';
      const act = e.shotAt
        ? `<div class="act" data-phone="${d}">
            <button data-s="approved" class="${e.status === 'approved' ? 'on ok' : ''}">Approve</button>
            <button data-s="rejected" class="${e.status === 'rejected' ? 'on no' : ''}">Reject</button>
          </div>`
        : '';
      return `<tr data-status="${e.status || ''}" data-shot="${e.shotAt ? 1 : 0}"><td>${i + 1}</td><td><b>${esc(e.name)}</b><br>${esc(e.phone)}<br><small>Entered ${esc(nyTime(e.at))}</small></td><td class="shot">${shot}</td><td>${act}</td></tr>`;
    })
    .join('');
  const data = JSON.stringify(entries.map((e) => [e.name, e.phone, e.status || ''])).replace(/</g, '\\u003c');

  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Raffle entries (${entries.length})</title>
<style>
  body{font-family:-apple-system,system-ui,sans-serif;margin:0;padding:1.2rem;color:#0d0d0d;background:#f6f5f4}
  h1{font-size:1.5rem;margin:0 0 .3rem}
  p{color:#555;margin:0 0 1rem}
  .stats{display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1rem}
  .stats span{background:#fff;border:1px solid #e6e6e6;border-radius:6px;padding:.5rem .8rem;font-size:.9rem}
  .bar{display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:.8rem}
  button,a.btn{font:inherit;font-size:.9rem;padding:.65rem .95rem;border:1px solid #0d0d0d;background:#fff;color:#0d0d0d;border-radius:6px;cursor:pointer;text-decoration:none}
  button.main{background:#0d0d0d;color:#fff}
  .filter button.on{background:#0d0d0d;color:#fff}
  table{width:100%;border-collapse:collapse;background:#fff;font-size:.95rem}
  td{text-align:left;padding:.7rem;border-bottom:1px solid #e6e6e6;vertical-align:top}
  small{color:#8c8c8c}
  .shot img{display:block;width:84px;border:1px solid #e6e6e6;border-radius:4px;margin-bottom:.3rem}
  .none{color:#b0b0b0}
  .act{display:flex;flex-direction:column;gap:.4rem}
  .act button{padding:.5rem .7rem;font-size:.85rem}
  .act button.ok{background:#0a7a2f;border-color:#0a7a2f;color:#fff}
  .act button.no{background:#b42318;border-color:#b42318;color:#fff}
  #msg{color:#0a7a2f;font-weight:600;min-height:1.2em;margin:.3rem 0 .8rem}
</style></head><body>
<h1>Raffle entries</h1>
<div class="stats"><span><b>${entries.length}</b> subscribed</span><span><b>${counts.shots}</b> sent a screenshot</span><span><b id="n-ok">${counts.approved}</b> approved</span></div>
<p>Tap a screenshot to see it full size. Approve the ones with 100+ views, then copy the approved list into the raffle platform.</p>
<div class="bar">
  <button class="main" data-copy="approved">Copy approved (names + phones)</button>
  <button data-copy="all">Copy everyone</button>
  <a class="btn" href="/raffle/entries.vcf?key=${k}">Save all to my contacts</a>
  <a class="btn" href="/raffle/entries.csv?key=${k}">Download CSV</a>
</div>
<div class="bar filter">
  <button data-f="all" class="on">All</button><button data-f="todo">Needs review</button><button data-f="approved">Approved</button>
</div>
<p id="msg"></p>
<table><tbody>${rows || '<tr><td>No entries yet.</td></tr>'}</tbody></table>
<script>
  const KEY = ${JSON.stringify(key).replace(/</g, '\\u003c')};
  const data = ${data};
  const msg = document.getElementById('msg');
  document.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    const list = b.dataset.copy === 'approved' ? data.filter((d) => d[2] === 'approved') : data;
    // Tab-separated so it pastes into separate columns in a spreadsheet.
    const text = list.map(([n, p]) => n + '\\t' + p).join('\\n');
    try { await navigator.clipboard.writeText(text); msg.textContent = 'Copied ' + list.length + ' entries.'; }
    catch { msg.textContent = 'Copy failed. Use Download CSV instead.'; }
  }));
  document.querySelectorAll('.act').forEach((box) => box.querySelectorAll('button').forEach((b) => b.addEventListener('click', async () => {
    const phone = box.dataset.phone;
    const status = b.classList.contains('on') ? '' : b.dataset.s; // tap again to undo
    const res = await fetch('/raffle/entries/mark?key=' + encodeURIComponent(KEY), {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, status }),
    });
    if (!res.ok) { msg.textContent = 'Could not save. Try again.'; return; }
    box.querySelectorAll('button').forEach((x) => x.className = '');
    if (status) b.className = 'on ' + (status === 'approved' ? 'ok' : 'no');
    box.closest('tr').dataset.status = status;
    const row = data.find((d) => d[1].replace(/\\D/g, '') === phone);
    if (row) row[2] = status;
    document.getElementById('n-ok').textContent = data.filter((d) => d[2] === 'approved').length;
  })));
  document.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('[data-f]').forEach((x) => x.classList.toggle('on', x === b));
    document.querySelectorAll('tbody tr[data-shot]').forEach((tr) => {
      const f = b.dataset.f;
      tr.hidden = f === 'todo' ? !(tr.dataset.shot === '1' && !tr.dataset.status) : f === 'approved' ? tr.dataset.status !== 'approved' : false;
    });
  }));
</script>
</body></html>`;
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
  });
}
