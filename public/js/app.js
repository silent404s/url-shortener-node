/* =====================================================================
   Shortix Node Panel — single-page app (vanilla JS, no framework).
   Hash routing, client-side rendering, toasts, theme, Master broadcast.
   ===================================================================== */
'use strict';

const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---- API helper ----------------------------------------------------------
const api = {
  async req(method, path, body) {
    const opts = { method, headers: {} };
    if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    let res;
    try { res = await fetch('/api' + path, opts); }
    catch { return { status: 0, data: { error: { message: 'Gagal terhubung ke server.' } } }; }
    if (res.status === 401) { window.location.href = '/'; throw new Error('no-session'); }
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  },
  get: (p) => api.req('GET', p),
  post: (p, b) => api.req('POST', p, b),
  patch: (p, b) => api.req('PATCH', p, b),
  del: (p) => api.req('DELETE', p),
};

// ---- Toast notifications -------------------------------------------------
function toast(message, type = 'info') {
  const wrap = $('#toasts');
  const el = document.createElement('div');
  const icon = { info: 'circle-info', ok: 'circle-check', warn: 'triangle-exclamation', err: 'circle-xmark' }[type] || 'circle-info';
  el.className = `toast ${type}`;
  el.innerHTML = `<i class="fa-solid fa-${icon}"></i><span>${esc(message)}</span>`;
  wrap.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); }, 3800);
}

// ---- Modal ---------------------------------------------------------------
function openModal(html) {
  const root = $('#modalRoot');
  root.innerHTML = `<div class="modal"><div class="modal-card">${html}</div></div>`;
  root.querySelector('.modal').addEventListener('click', (e) => { if (e.target.classList.contains('modal')) closeModal(); });
}
function closeModal() { $('#modalRoot').innerHTML = ''; }
function confirmDialog(message, onYes) {
  openModal(`<h3>Konfirmasi</h3><p class="muted">${esc(message)}</p>
    <div class="row end"><button class="btn" data-no>Batal</button><button class="btn danger" data-yes>Ya, lanjut</button></div>`);
  $('#modalRoot [data-no]').onclick = closeModal;
  $('#modalRoot [data-yes]').onclick = () => { closeModal(); onYes(); };
}

// ---- Theme ---------------------------------------------------------------
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  const i = $('#themeToggle i');
  if (i) i.className = t === 'light' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}
applyTheme(localStorage.getItem('theme') || 'dark');
$('#themeToggle').addEventListener('click', () => {
  const next = (document.documentElement.dataset.theme === 'light') ? 'dark' : 'light';
  localStorage.setItem('theme', next); applyTheme(next);
});

// ---- Sidebar (mobile) ----------------------------------------------------
const sidebar = $('#sidebar'), backdrop = $('#backdrop');
$('#menuBtn').addEventListener('click', () => { sidebar.classList.add('open'); backdrop.classList.add('show'); });
backdrop.addEventListener('click', () => { sidebar.classList.remove('open'); backdrop.classList.remove('show'); });

// ---- Logout --------------------------------------------------------------
$('#logoutBtn').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/'; // server redirects to the (secret) login path
});

// ---- Router --------------------------------------------------------------
const ROUTES = {
  dashboard: { title: 'Dasbor', render: viewDashboard },
  domains:   { title: 'Domain', render: viewDomains },
  urls:      { title: 'Tautan', render: viewUrls },
  groups:    { title: 'Grup', render: viewGroups },
  referral:  { title: 'Referral', render: viewReferral },
  security:  { title: 'Keamanan', render: viewSecurity },
  help:      { title: 'Bantuan', render: viewHelp },
  changelog: { title: 'Pembaruan', render: viewChangelog },
  contact:   { title: 'Kontak', render: viewContact },
};

let navToken = 0;
async function router() {
  const myToken = ++navToken;
  const key = (location.hash.replace(/^#\//, '') || 'dashboard');
  const route = ROUTES[key] || ROUTES.dashboard;
  $('#pageTitle').textContent = route.title;
  document.querySelectorAll('.side-nav a').forEach((a) =>
    a.classList.toggle('active', a.dataset.route === (ROUTES[key] ? key : 'dashboard')));
  sidebar.classList.remove('open'); backdrop.classList.remove('show');
  const content = $('#content');
  content.innerHTML = '<div class="loading">Memuat…</div>';
  try {
    await route.render(content);
  } catch (e) {
    if (myToken !== navToken) return;            // superseded by a newer navigation
    if (e && e.message === 'no-session') return; // redirecting to login
    console.error('[Shortix] gagal memuat view:', e);
    content.innerHTML = `<div class="card"><h2>Terjadi kesalahan memuat halaman</h2>
      <p class="muted small" id="errDetail"></p>
      <button class="btn" id="retryBtn"><i class="fa-solid fa-rotate"></i> Coba lagi</button></div>`;
    const d = $('#errDetail'); if (d) d.textContent = (e && e.message) ? e.message : String(e);
    const rb = $('#retryBtn'); if (rb) rb.onclick = () => router();
  }
}
window.addEventListener('hashchange', router);

// ===========================================================================
//  Views
// ===========================================================================
const badge = (s) => {
  const id = { active: 'aktif', queued: 'antre', updating: 'memperbarui', failed: 'gagal',
    disabled: 'nonaktif', blocked: 'diblokir', registered: 'terdaftar', completed: 'selesai',
    processing: 'diproses', dead: 'gagal' }[s] || s;
  return `<span class="badge ${esc(s)}">${esc(id)}</span>`;
};
const stat = (icon, label, value) => `<div class="card stat">
  <div class="stat-ic"><i class="fa-solid ${icon}"></i></div>
  <div><span class="stat-label">${label}</span><span class="stat-value">${value}</span></div></div>`;

async function viewDashboard(el) {
  const { data: me } = await api.get('/me');
  const { data: jobs } = await api.get('/jobs');
  const { data: top } = await api.get('/urls/top');
  const u = me.usage || {}, q = me.quota || {};
  const totalClicks = (top.urls || []).reduce((s, r) => s + (r.clicks || 0), 0);
  const topRows = (top.urls || []).filter((r) => (r.clicks || 0) > 0);
  const cf = me.cloudflare || {};

  el.innerHTML = `
    ${cf.warnRotation ? `<div class="banner" style="background:color-mix(in srgb,var(--danger) 14%, transparent);color:var(--danger);margin-bottom:1.2rem">
      <i class="fa-solid fa-triangle-exclamation"></i> Token Cloudflare terakhir diubah ${cf.daysSinceRotation} hari lalu. Demi keamanan, disarankan mengganti (rotasi) token setiap ${cf.warnDays} hari — buka menu <strong>Domain</strong>.</div>` : ''}
    <div class="grid stats">
      ${stat('fa-link', 'Tautan terpakai', `${u.urlCount ?? '–'} / ${q.urlLimit ?? '–'}`)}
      ${stat('fa-arrow-pointer', 'Total klik (top 10)', totalClicks.toLocaleString('id-ID'))}
      ${stat('fa-globe', 'Domain aktif', `${u.activeDomains ?? '–'} / ${q.activeDomainLimit ?? '–'}`)}
      ${stat('fa-gift', 'Kode referral', esc(me.user?.referral_code || '–'))}
    </div>

    <div class="card">
      <h2>10 Tautan dengan klik tertinggi</h2>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Tautan pendek</th><th>Tujuan</th><th style="text-align:right">Klik</th></tr></thead>
        <tbody>${topRows.map((r) => `<tr>
          <td><code>${esc(r.zone_name)}/${esc(r.slug)}</code></td>
          <td class="muted ellipsis">${esc(r.target_url)}</td>
          <td style="text-align:right;font-weight:600">${(r.clicks || 0).toLocaleString('id-ID')}</td></tr>`).join('')
          || '<tr><td colspan="3" class="muted">Belum ada data klik. Statistik diperbarui berkala dari Cloudflare.</td></tr>'}
        </tbody></table></div>
    </div>

    <div class="card">
      <h2>Aktivitas terbaru</h2>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Jenis</th><th>Status</th><th>Percobaan</th><th>Waktu</th></tr></thead>
        <tbody>${(jobs.jobs || []).map((j) => `<tr>
          <td>${esc(j.type)}</td><td>${badge(j.status)}</td><td>${j.attempts}</td>
          <td class="muted">${new Date(j.created_at).toLocaleString('id-ID')}</td></tr>`).join('')
          || '<tr><td colspan="4" class="muted">Belum ada aktivitas.</td></tr>'}
        </tbody></table></div>
    </div>`;
}

async function viewDomains(el) {
  el.innerHTML = `
    <div class="card">
      <h2>1 · Hubungkan Cloudflare</h2>
      <p class="muted small">Token API dikirim ke Master untuk divalidasi (scope Zone.Read + Single Redirect) dan disimpan terenkripsi. Panel ini tidak menyimpan token Anda.</p>
      <div class="row">
        <input type="password" id="cfToken" placeholder="Cloudflare API Token" autocomplete="off" />
        <input type="text" id="cfLabel" placeholder="Label (opsional)" />
        <button class="btn primary" id="saveTokenBtn"><i class="fa-solid fa-floppy-disk"></i> Validasi & simpan</button>
      </div>
      <p id="cfStatus" class="small"></p>
    </div>
    <div class="card">
      <h2>2 · Daftarkan domain</h2>
      <p class="muted small">Ketik nama domain (zona) yang sudah aktif di Cloudflare. Maks 10 terdaftar, 5 aktif per akun.</p>
      <div class="row">
        <input type="text" id="domainInput" placeholder="contoh.com" autocomplete="off" />
        <button class="btn primary" id="registerDomainBtn"><i class="fa-solid fa-plus"></i> Daftarkan</button>
      </div>
    </div>
    <div class="card">
      <h2>Domain Anda</h2>
      <div class="table-wrap"><table class="table" id="domainsTable">
        <thead><tr><th>Domain</th><th>Status</th><th>Aksi</th></tr></thead><tbody></tbody></table></div>
    </div>`;

  $('#saveTokenBtn').onclick = async () => {
    const token = $('#cfToken').value.trim(); const label = $('#cfLabel').value.trim();
    if (!token) return toast('Masukkan token terlebih dahulu.', 'warn');
    toast('Memvalidasi token ke Master…');
    const { status, data } = await api.post('/cloudflare/token', { token, label: label || undefined });
    if (status === 201) { $('#cfToken').value = '';
      toast(`Token valid. ${(data.zones || []).length} zona terdeteksi di akun Anda.`, 'ok'); renderCfStatus(); }
    else { const detail = data.error?.details?.[0]?.message; toast(detail || data.error?.message || 'Validasi gagal.', 'err'); }
  };

  async function renderCfStatus() {
    const el = $('#cfStatus'); if (!el) return;
    const { data } = await api.get('/me');
    const cf = data.cloudflare || {};
    if (!cf.connected) { el.textContent = 'Belum ada token Cloudflare tersimpan.'; el.style.color = 'var(--muted)'; return; }
    const d = cf.daysSinceRotation;
    const ago = d === 0 ? 'hari ini' : `${d} hari lalu`;
    if (cf.warnRotation) {
      el.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> API terakhir diubah <strong>${ago}</strong>. Disarankan mengganti (rotasi) token setiap ${cf.warnDays} hari untuk keamanan.`;
      el.style.color = 'var(--danger)';
    } else {
      el.textContent = `API terakhir diubah ${ago}.`;
      el.style.color = 'var(--muted)';
    }
  }
  $('#registerDomainBtn').onclick = async () => {
    const domainName = $('#domainInput').value.trim().toLowerCase();
    if (!domainName) return toast('Ketik nama domain dulu.', 'warn');
    toast('Mencari domain di Cloudflare…');
    const { status, data } = await api.post('/domains', { domainName });
    if (status === 201) { $('#domainInput').value = ''; toast(`Domain ${data.zoneName} didaftarkan.`, 'ok'); loadDomains(); }
    else toast(data.error?.message || 'Gagal mendaftarkan domain.', 'err');
  };
  async function loadDomains() {
    const { data } = await api.get('/domains');
    $('#domainsTable tbody').innerHTML = (data.domains || []).map((d) => `<tr>
      <td>${esc(d.zone_name)}</td><td>${badge(d.state)}</td>
      <td class="actions">
        ${d.state === 'registered' ? `<button class="btn small" data-act="activate" data-id="${d.id}"><i class="fa-solid fa-play"></i> Aktifkan</button>` : ''}
        ${d.state === 'active' ? `<button class="btn small" data-act="rebuild" data-id="${d.id}"><i class="fa-solid fa-rotate"></i> Sinkron</button>` : ''}
      </td></tr>`).join('') || '<tr><td colspan="3" class="muted">Belum ada domain.</td></tr>';
  }
  $('#domainsTable').onclick = async (e) => {
    const btn = e.target.closest('button[data-act]'); if (!btn) return;
    const { act, id } = btn.dataset;
    const { status, data } = await api.post(`/domains/${id}/${act}`);
    if (status === 202) { toast(act === 'activate' ? 'Aktivasi masuk antrean…' : 'Sinkronisasi masuk antrean…', 'ok'); setTimeout(loadDomains, 2000); }
    else toast(data.error?.message || 'Gagal.', 'err');
  };
  loadDomains();
  renderCfStatus();
}

async function viewUrls(el) {
  el.innerHTML = `
    <div class="card">
      <h2>Buat tautan</h2>
      <div class="row">
        <select id="domainSelect"></select>
        <select id="groupSelect"><option value="">Tanpa grup</option></select>
        <input type="text" id="slugInput" placeholder="slug khusus (opsional)" />
        <input type="url" id="targetInput" placeholder="https://tujuan.example/halaman" />
        <button class="btn primary" id="createUrlBtn"><i class="fa-solid fa-plus"></i> Buat</button>
      </div>
      <details><summary>Buat massal</summary>
        <p class="muted small">Satu per baris: <code>slug,https://tujuan</code> (slug opsional: <code>,https://tujuan</code>).</p>
        <textarea id="bulkInput" rows="5" placeholder="promo,https://example.com/a&#10;,https://example.com/b"></textarea>
        <button class="btn" id="bulkBtn"><i class="fa-solid fa-layer-group"></i> Buat massal</button>
      </details>
      <p id="lockMsg" class="banner hidden"><i class="fa-solid fa-lock"></i> Kuota tercapai — pembuatan tautan dikunci.</p>
    </div>
    <div class="card">
      <h2>Tautan tersimpan</h2>
      <div class="row">
        <select id="filterDomain"><option value="">Semua domain</option></select>
        <input type="search" id="urlSearch" placeholder="Cari slug atau tujuan…" />
        <div class="bulkbar hidden" id="bulkBar">
          <span id="selCount" class="muted small">0 dipilih</span>
          <button class="btn small" id="bulkCopy"><i class="fa-solid fa-copy"></i> Salin terpilih</button>
          <button class="btn small danger" id="bulkDelete"><i class="fa-solid fa-trash"></i> Hapus terpilih</button>
        </div>
      </div>
      <div class="table-wrap"><table class="table" id="urlsTable">
        <thead><tr>
          <th class="chkcol"><input type="checkbox" id="checkAll" /></th>
          <th>Tautan pendek</th><th>Tujuan</th><th style="text-align:right">Klik</th><th>Status</th><th>Aksi</th>
        </tr></thead><tbody></tbody></table></div>
    </div>`;

  const { data: dom } = await api.get('/domains');
  const domList = dom.domains || [];
  const active = domList.filter((d) => d.state === 'active');
  const domMap = {}; domList.forEach((d) => { domMap[d.id] = d.zone_name; });
  const opts = active.map((d) => `<option value="${d.id}">${esc(d.zone_name)}</option>`).join('');
  $('#domainSelect').innerHTML = opts || '<option value="">(belum ada domain aktif)</option>';
  $('#filterDomain').innerHTML = '<option value="">Semua domain</option>' + opts;

  const { data: grp } = await api.get('/groups');
  $('#groupSelect').innerHTML = '<option value="">Tanpa grup</option>' +
    (grp.groups || []).map((g) => `<option value="${g.id}">${esc(g.name)}</option>`).join('');

  const { data: me } = await api.get('/me');
  const locked = !!me.locked?.urls;
  $('#lockMsg').classList.toggle('hidden', !locked);
  ['createUrlBtn', 'bulkBtn', 'slugInput', 'targetInput', 'bulkInput'].forEach((id) => { const x = $('#' + id); if (x) x.disabled = locked; });

  const shortUrl = (u) => `https://${domMap[u.domain_id] || 'domain'}/${u.slug}`;

  let _urls = [];
  function renderUrls() {
    const q = ($('#urlSearch').value || '').trim().toLowerCase();
    const list = q
      ? _urls.filter((u) => u.slug.toLowerCase().includes(q) || (u.target_url || '').toLowerCase().includes(q))
      : _urls;
    $('#urlsTable tbody').innerHTML = list.map((u) => {
      const full = shortUrl(u);
      const grp = u.group_name ? ` <span class="badge" style="background:color-mix(in srgb,var(--accent) 16%, transparent);color:var(--accent-2)">${esc(u.group_name)}</span>` : '';
      return `<tr>
        <td class="chkcol"><input type="checkbox" class="rowchk" data-id="${u.id}" data-url="${esc(full)}" /></td>
        <td><code>${esc(full)}</code>${grp}</td>
        <td class="muted ellipsis">${esc(u.target_url)}</td>
        <td style="text-align:right;font-weight:600">${(u.clicks || 0).toLocaleString('id-ID')}</td>
        <td>${u.state === 'failed' && u.last_error
          ? `<span title="${esc(u.last_error)}">${badge(u.state)} <i class="fa-solid fa-circle-info" style="color:var(--danger)"></i></span>`
          : badge(u.state)}</td>
        <td class="actions">
          <button class="btn small" data-copy="${esc(full)}" title="Salin"><i class="fa-solid fa-copy"></i></button>
          <button class="btn small" data-edit="${u.id}" data-slug="${esc(u.slug)}" data-target="${esc(u.target_url)}" data-status="${u.redirect_status}" title="Edit"><i class="fa-solid fa-pen"></i></button>
          <button class="btn small danger" data-del="${u.id}" title="Hapus"><i class="fa-solid fa-trash"></i></button>
        </td></tr>`;
    }).join('') || `<tr><td colspan="6" class="muted">${q ? 'Tidak ada hasil untuk pencarian.' : 'Belum ada tautan.'}</td></tr>`;
    $('#checkAll').checked = false; updateBulkBar();
  }
  async function loadUrls() {
    const f = $('#filterDomain').value;
    const { data } = await api.get('/urls' + (f ? `?domainId=${f}` : ''));
    _urls = data.urls || [];
    renderUrls();
  }

  const selected = () => [...document.querySelectorAll('.rowchk:checked')];
  function updateBulkBar() {
    const n = selected().length;
    $('#bulkBar').classList.toggle('hidden', n === 0);
    $('#selCount').textContent = `${n} dipilih`;
  }

  $('#createUrlBtn').onclick = async () => {
    const domainId = Number($('#domainSelect').value);
    if (!domainId) return toast('Pilih domain aktif dulu.', 'warn');
    const target = $('#targetInput').value.trim();
    if (!target) return toast('Masukkan URL tujuan.', 'warn');
    const groupId = $('#groupSelect').value ? Number($('#groupSelect').value) : undefined;
    const body = { domainId, groupId, slug: $('#slugInput').value.trim() || undefined, target };
    const { status, data } = await api.post('/urls', body);
    if (status === 202) { toast(`Antre: /${data.shortUrl.slug}`, 'ok'); $('#slugInput').value = ''; $('#targetInput').value = ''; setTimeout(loadUrls, 1800); }
    else toast(data.error?.message || 'Gagal membuat tautan.', 'err');
  };
  $('#bulkBtn').onclick = async () => {
    const domainId = Number($('#domainSelect').value);
    if (!domainId) return toast('Pilih domain aktif dulu.', 'warn');
    const items = $('#bulkInput').value.split('\n').map((l) => l.trim()).filter(Boolean)
      .map((line) => { const [slug, target] = line.split(','); return target ? { slug: slug || undefined, target: target.trim() } : null; }).filter(Boolean);
    if (!items.length) return toast('Tidak ada baris valid.', 'warn');
    const { status, data } = await api.post('/urls/bulk', { domainId, items });
    if (status === 202) { toast(`Antre ${data.created.length} tautan.`, 'ok'); $('#bulkInput').value = ''; setTimeout(loadUrls, 1800); }
    else toast(data.error?.message || 'Gagal.', 'err');
  };

  $('#urlsTable').onclick = (e) => {
    const copyBtn = e.target.closest('button[data-copy]');
    if (copyBtn) { navigator.clipboard.writeText(copyBtn.dataset.copy); return toast('Tautan disalin.', 'ok'); }
    const editBtn = e.target.closest('button[data-edit]');
    if (editBtn) return openEdit(editBtn.dataset);
    const delBtn = e.target.closest('button[data-del]');
    if (delBtn) return confirmDialog('Hapus tautan ini?', async () => {
      const { status } = await api.del(`/urls/${delBtn.dataset.del}`);
      toast(status === 202 ? 'Penghapusan masuk antrean.' : 'Gagal menghapus.', status === 202 ? 'ok' : 'err');
      setTimeout(loadUrls, 1500);
    });
  };
  $('#urlsTable').addEventListener('change', (e) => { if (e.target.classList.contains('rowchk')) updateBulkBar(); });
  $('#checkAll').onchange = (e) => { document.querySelectorAll('.rowchk').forEach((c) => { c.checked = e.target.checked; }); updateBulkBar(); };

  $('#bulkCopy').onclick = () => {
    const urls = selected().map((c) => c.dataset.url);
    if (!urls.length) return;
    navigator.clipboard.writeText(urls.join('\n'));
    toast(`${urls.length} tautan disalin.`, 'ok');
  };
  $('#bulkDelete').onclick = () => {
    const ids = selected().map((c) => c.dataset.id);
    if (!ids.length) return;
    confirmDialog(`Hapus ${ids.length} tautan terpilih?`, async () => {
      await Promise.all(ids.map((id) => api.del(`/urls/${id}`)));
      toast(`${ids.length} tautan dihapus (antre).`, 'ok');
      setTimeout(loadUrls, 1600);
    });
  };

  function openEdit(d) {
    openModal(`<h3>Edit tautan</h3>
      <label class="lbl">Slug</label><input id="edSlug" value="${esc(d.slug)}" />
      <label class="lbl">Tujuan</label><input id="edTarget" type="url" value="${esc(d.target)}" />
      <label class="lbl">Status redirect</label>
      <select id="edStatus">${[301, 302, 307, 308].map((s) => `<option value="${s}" ${String(s) === String(d.status) ? 'selected' : ''}>${s}</option>`).join('')}</select>
      <div class="row end"><button class="btn" data-no>Batal</button><button class="btn primary" data-save>Simpan</button></div>`);
    $('#modalRoot [data-no]').onclick = closeModal;
    $('#modalRoot [data-save]').onclick = async () => {
      const body = { slug: $('#edSlug').value.trim(), target: $('#edTarget').value.trim(), redirectStatus: Number($('#edStatus').value) };
      const { status, data } = await api.patch(`/urls/${d.edit}`, body);
      closeModal();
      toast(status === 202 ? 'Perubahan masuk antrean.' : (data.error?.message || 'Gagal menyimpan.'), status === 202 ? 'ok' : 'err');
      setTimeout(loadUrls, 1600);
    };
  }

  $('#filterDomain').onchange = loadUrls;
  $('#urlSearch').oninput = renderUrls;   // client-side filter on the loaded list
  loadUrls();
}

let _openGroup = null;
async function viewGroups(el) {
  el.innerHTML = `
    <div class="card">
      <h2>Grup Tautan</h2>
      <p class="muted small">Kumpulkan beberapa short URL ke dalam grup, lalu ubah root tujuannya sekaligus (path &amp; param tiap tautan tetap).</p>
      <div class="row">
        <input type="text" id="groupName" placeholder="Nama grup baru" />
        <button class="btn primary" id="createGroupBtn"><i class="fa-solid fa-plus"></i> Buat grup</button>
      </div>
      <div class="table-wrap"><table class="table" id="groupsTable">
        <thead><tr><th>Nama</th><th>Jumlah tautan</th><th>Aksi</th></tr></thead><tbody></tbody></table></div>
    </div>
    <div class="card hidden" id="groupDetail"></div>`;

  $('#createGroupBtn').onclick = async () => {
    const name = $('#groupName').value.trim();
    if (!name) return toast('Isi nama grup.', 'warn');
    const { status, data } = await api.post('/groups', { name });
    if (status === 201) { toast('Grup dibuat.', 'ok'); $('#groupName').value = ''; loadGroups(); }
    else toast(data.error?.message || 'Gagal.', 'err');
  };

  async function loadGroups() {
    const { data } = await api.get('/groups');
    $('#groupsTable tbody').innerHTML = (data.groups || []).map((g) => `<tr>
      <td>${esc(g.name)}</td><td>${g.url_count}</td>
      <td class="actions">
        <button class="btn small" data-open="${g.id}" data-name="${esc(g.name)}"><i class="fa-solid fa-folder-open"></i> Buka</button>
        <button class="btn small danger" data-delg="${g.id}"><i class="fa-solid fa-trash"></i></button>
      </td></tr>`).join('') || '<tr><td colspan="3" class="muted">Belum ada grup.</td></tr>';
  }
  $('#groupsTable').onclick = async (e) => {
    const open = e.target.closest('button[data-open]');
    const del = e.target.closest('button[data-delg]');
    if (open) { _openGroup = { id: open.dataset.open, name: open.dataset.name }; openGroup(); }
    if (del) confirmDialog('Hapus grup ini? (tautan tidak ikut terhapus)', async () => {
      await api.del(`/groups/${del.dataset.delg}`); toast('Grup dihapus.', 'ok');
      $('#groupDetail').classList.add('hidden'); loadGroups();
    });
  };

  async function openGroup() {
    const g = _openGroup;
    const { data } = await api.get(`/groups/${g.id}/urls`);
    const box = $('#groupDetail');
    box.classList.remove('hidden');
    box.innerHTML = `
      <div class="row" style="justify-content:space-between">
        <h2 style="margin:0">Grup: ${esc(g.name)}</h2>
        <div class="row" style="margin:0">
          <button class="btn" id="addToGroupBtn"><i class="fa-solid fa-plus"></i> Tambah tautan</button>
          <button class="btn primary" id="rerootBtn"><i class="fa-solid fa-right-left"></i> Ubah root tujuan</button>
        </div>
      </div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Tautan pendek</th><th>Tujuan</th><th style="text-align:right">Klik</th><th>Aksi</th></tr></thead>
        <tbody>${(data.urls || []).map((u) => `<tr>
          <td><code>${esc(u.zone_name)}/${esc(u.slug)}</code></td>
          <td class="muted ellipsis">${esc(u.target_url)}</td>
          <td style="text-align:right">${(u.clicks || 0).toLocaleString('id-ID')}</td>
          <td class="actions"><button class="btn small danger" data-rm="${u.id}" title="Keluarkan"><i class="fa-solid fa-xmark"></i></button></td>
        </tr>`).join('') || '<tr><td colspan="4" class="muted">Grup kosong. Tambahkan tautan.</td></tr>'}
        </tbody></table></div>`;

    box.querySelector('#rerootBtn').onclick = () => openReroot(g, (data.urls || []));
    box.querySelector('#addToGroupBtn').onclick = () => openAddToGroup(g);
    box.querySelectorAll('button[data-rm]').forEach((b) => { b.onclick = async () => {
      await api.del(`/groups/${g.id}/urls/${b.dataset.rm}`); toast('Dikeluarkan dari grup.', 'ok'); openGroup(); loadGroups();
    }; });
  }

  function openReroot(g, urls) {
    const sample = urls[0] ? esc(urls[0].target_url) : 'https://facebook.com/menu';
    openModal(`<h3>Ubah root tujuan</h3>
      <p class="muted small">Mengganti <strong>skema + domain</strong> tujuan untuk <strong>semua ${urls.length} tautan</strong> di grup ini. Path &amp; parameter tiap tautan dipertahankan.</p>
      <p class="muted small">Contoh: <code>${sample}</code> → root baru diterapkan, path tetap.</p>
      <label class="lbl">Root tujuan baru</label>
      <input id="newRoot" placeholder="https://youtube.com" />
      <div class="row end"><button class="btn" data-no>Batal</button><button class="btn primary" data-go>Terapkan</button></div>`);
    $('#modalRoot [data-no]').onclick = closeModal;
    $('#modalRoot [data-go]').onclick = async () => {
      const newRoot = $('#newRoot').value.trim();
      if (!newRoot) return;
      const { status, data } = await api.post(`/groups/${g.id}/reroot`, { newRoot });
      closeModal();
      if (status === 202) { toast(`Antre: ${data.updated} tautan diperbarui.`, 'ok'); setTimeout(openGroup, 1800); }
      else toast(data.error?.message || 'Gagal.', 'err');
    };
  }

  async function openAddToGroup(g) {
    const { data } = await api.get('/urls');
    const candidates = (data.urls || []).filter((u) => u.state !== 'disabled');
    openModal(`<h3>Tambah tautan ke grup</h3>
      <p class="muted small">Pilih tautan yang sudah ada untuk dimasukkan ke "${esc(g.name)}".</p>
      <div style="max-height:300px;overflow:auto;border:1px solid var(--line);border-radius:8px;padding:.5rem">
        ${candidates.map((u) => `<label style="display:flex;gap:.5rem;align-items:center;padding:.3rem 0">
          <input type="checkbox" class="addchk" value="${u.id}" style="width:auto" />
          <code>/${esc(u.slug)}</code> <span class="muted ellipsis">→ ${esc(u.target_url)}</span></label>`).join('') || '<span class="muted">Tidak ada tautan.</span>'}
      </div>
      <div class="row end"><button class="btn" data-no>Batal</button><button class="btn primary" data-add>Tambah</button></div>`);
    $('#modalRoot [data-no]').onclick = closeModal;
    $('#modalRoot [data-add]').onclick = async () => {
      const urlIds = [...document.querySelectorAll('.addchk:checked')].map((c) => Number(c.value));
      if (!urlIds.length) return closeModal();
      const { status } = await api.post(`/groups/${g.id}/urls`, { urlIds });
      closeModal();
      toast(status === 200 ? 'Tautan ditambahkan.' : 'Gagal.', status === 200 ? 'ok' : 'err');
      openGroup(); loadGroups();
    };
  }

  loadGroups();
  if (_openGroup) openGroup();
}

async function viewReferral(el) {
  const { data } = await api.get('/referral');
  el.innerHTML = `
    <div class="card">
      <h2>Program Referral</h2>
      <p class="muted">Bagikan kode undangan Anda. Setiap pengguna yang mendaftar menambah kuota Anda.</p>
      <div class="copyrow"><code id="refCode">${esc(data.referralCode || '–')}</code>
        <button class="btn small" id="copyRef"><i class="fa-solid fa-copy"></i> Salin</button></div>
      <div class="grid stats">
        ${stat('fa-users', 'Pengguna diundang', data.invitedCount ?? 0)}
        ${stat('fa-link', 'Bonus tautan', data.totalBonusUrl ?? 0)}
      </div>
    </div>
    <div class="card">
      <h2>Daftar undangan</h2>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Email</th><th>Bonus URL</th><th>Tanggal</th></tr></thead>
        <tbody>${(data.invited || []).map((r) => `<tr><td>${esc(r.email)}</td><td>${r.bonus_url}</td>
          <td class="muted">${new Date(r.created_at).toLocaleDateString('id-ID')}</td></tr>`).join('')
          || '<tr><td colspan="3" class="muted">Belum ada undangan.</td></tr>'}</tbody></table></div>
    </div>`;
  $('#copyRef').onclick = () => { navigator.clipboard.writeText(data.referralCode || ''); toast('Kode disalin.', 'ok'); };
}

async function viewSecurity(el) {
  const { data } = await api.get('/account/security');
  el.innerHTML = `
    <div class="card">
      <h2>Keamanan Akun</h2>
      <p class="muted">Email: <code>${esc(data.email || '–')}</code></p>
      <p>Status 2FA: ${data.totpEnabled
        ? '<span class="badge active">aktif</span>'
        : '<span class="badge failed">belum aktif</span>'}</p>
    </div>
    <div class="card">
      <h2>Ganti Kata Sandi</h2>
      <p class="muted small">Perubahan kata sandi wajib diverifikasi dengan kode 2FA (atau kode pemulihan).</p>
      <label class="lbl">Kata sandi saat ini</label>
      <input type="password" id="curPw" autocomplete="current-password" />
      <label class="lbl">Kata sandi baru (min. 10 karakter)</label>
      <input type="password" id="newPw" autocomplete="new-password" />
      <label class="lbl">Kode Google Authenticator</label>
      <input type="text" id="pwCode" inputmode="numeric" placeholder="123456" />
      <div class="row"><button class="btn primary" id="changePwBtn"><i class="fa-solid fa-key"></i> Simpan</button></div>
    </div>
    <div class="card">
      <h2>Sistem</h2>
      <p class="muted small">Versi terpasang: <code id="sysVer">…</code></p>
      <button class="btn" id="otaBtn"><i class="fa-solid fa-cloud-arrow-down"></i> Update Situs</button>
      <p class="muted small">Menarik kode terbaru dari repositori lalu memuat ulang panel.</p>
    </div>`;

  (async () => {
    const { data: v } = await api.get('/system/version');
    $('#sysVer').textContent = v.version || 'unknown';
    if (v.otaEnabled === false) $('#otaBtn').disabled = true;
  })();
  $('#otaBtn').onclick = () => confirmDialog('Tarik pembaruan terbaru & muat ulang panel?', runOtaUpdate);

  $('#changePwBtn').onclick = async () => {
    const currentPassword = $('#curPw').value;
    const newPassword = $('#newPw').value;
    const code = $('#pwCode').value.trim();
    if (!currentPassword || !newPassword || !code) return toast('Lengkapi semua kolom.', 'warn');
    if (newPassword.length < 10) return toast('Kata sandi baru minimal 10 karakter.', 'warn');
    const { status, data } = await api.post('/account/change-password', { currentPassword, newPassword, code });
    if (status === 200) { toast('Kata sandi berhasil diubah.', 'ok'); $('#curPw').value = $('#newPw').value = $('#pwCode').value = ''; }
    else toast(data.error?.message || 'Gagal mengubah kata sandi.', 'err');
  };
}

function viewHelp(el) {
  el.innerHTML = `<div class="card prose">
    <h2>Panduan Singkat</h2>
    <h3>1. Buat Token API Cloudflare</h3>
    <p>Cloudflare Dashboard → My Profile → API Tokens → Create Custom Token. Beri izin:
       <code>Zone · Zone · Read</code>, <code>Zone · Single Redirect · Edit</code>, dan
       (untuk statistik klik) <code>Zone · Analytics · Read</code>.</p>
    <h3>2. Hubungkan token</h3>
    <p>Buka menu <strong>Domain</strong>, tempel token, klik <em>Validasi & simpan</em>.</p>
    <h3>3. Daftarkan & aktifkan domain</h3>
    <p>Ketik nama domain Anda lalu <em>Daftarkan</em>, kemudian <em>Aktifkan</em>. Status berubah
       dari <em>terdaftar → aktif</em>.</p>
    <h3>4. Buat tautan pendek</h3>
    <p>Di menu <strong>Tautan</strong>, pilih domain aktif, isi slug & tujuan, klik <em>Buat</em>.
       Permintaan diantrekan dan ditulis ke Cloudflare sebagai redirect 302.</p>
    <h3>5. Sinkron / Rebuild</h3>
    <p>Bila data panel & Cloudflare tidak cocok, tekan <em>Sinkron</em> pada domain.</p>
  </div>`;
}

async function viewChangelog(el) {
  const { data } = await api.get('/site-content');
  const list = data.changelog || [];
  el.innerHTML = `<div class="card">
    <h2>Informasi Pembaruan</h2>
    ${list.length ? list.map((c) => `<div class="changelog-item">
      <div class="cl-head"><span class="cl-ver">v${esc(c.version)}</span><span class="muted small">${esc(c.date)}</span></div>
      <ul>${(c.items || []).map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>`).join('')
      : '<p class="muted">Belum ada catatan pembaruan.</p>'}
  </div>`;
}

async function viewContact(el) {
  const { data } = await api.get('/site-content');
  const c = data.contact || {};
  const rows = [];
  if (c.email) rows.push(`<a class="contact-item" href="mailto:${esc(c.email)}"><i class="fa-solid fa-envelope"></i> ${esc(c.email)}</a>`);
  if (c.telegram) rows.push(`<a class="contact-item" href="${esc(c.telegram)}" target="_blank" rel="noopener"><i class="fa-brands fa-telegram"></i> Telegram</a>`);
  if (c.whatsapp) rows.push(`<a class="contact-item" href="${esc(c.whatsapp)}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>`);
  el.innerHTML = `<div class="card">
    <h2>Kontak Bantuan</h2>
    <p class="muted">${esc(c.note || 'Hubungi kami untuk bantuan.')}</p>
    <div class="contact-list">${rows.join('') || '<span class="muted">Informasi kontak belum diatur.</span>'}</div>
  </div>`;
}

// ---- OTA update (blocking overlay + auto-reload after restart) -----------
function showOtaOverlay() {
  if ($('#otaOverlay')) return;
  const o = document.createElement('div');
  o.id = 'otaOverlay'; o.className = 'ota-overlay';
  o.innerHTML = `<div class="ota-box">
    <div class="spinner"></div>
    <h3>Memperbarui panel…</h3>
    <p class="muted" id="otaText">Mohon tunggu. <strong>Jangan menutup atau menyegarkan halaman ini.</strong></p>
  </div>`;
  document.body.appendChild(o);
}
function setOtaText(html) { const el = $('#otaText'); if (el) el.innerHTML = html; }

async function runOtaUpdate() {
  // Record the current process boot id so we can detect the restart.
  let boot0 = null;
  try { const r = await api.get('/system/version'); boot0 = r.data.bootId; } catch { /* ignore */ }

  showOtaOverlay();
  window.onbeforeunload = () => 'Pembaruan sedang berlangsung.';

  const { status, data } = await api.post('/system/update');
  if (status !== 200) {
    window.onbeforeunload = null; $('#otaOverlay')?.remove();
    return toast(data.error?.message || 'Gagal memulai pembaruan.', 'err');
  }

  const started = Date.now();
  const poll = async () => {
    if (Date.now() - started > 120000) {
      window.onbeforeunload = null;
      setOtaText('Memakan waktu lebih lama dari biasa. Silakan <strong>segarkan halaman</strong> secara manual.');
      return;
    }
    let bid = null;
    try {
      const r = await fetch('/api/system/version', { cache: 'no-store' });
      if (r.ok) { bid = (await r.json()).bootId; }
    } catch { /* server restarting — keep waiting */ }
    if (bid && boot0 && bid !== boot0) {
      window.onbeforeunload = null;
      setOtaText('Pembaruan selesai. Memuat ulang…');
      setTimeout(() => window.location.reload(), 1200);
      return;
    }
    setTimeout(poll, 2500);
  };
  setOtaText('Menarik kode terbaru &amp; memasang dependensi… <strong>Jangan tutup halaman.</strong>');
  setTimeout(poll, 5000); // give git pull + npm install time before the restart
}

// ---- Global broadcast (from Master) --------------------------------------
async function checkBroadcast() {
  try {
    const { data } = await api.get('/site-content');
    const b = data.broadcast;
    if (b && b.id && b.message && localStorage.getItem('bc:' + b.id) !== '1') {
      openModal(`<div class="bc bc-${esc(b.level || 'info')}">
        <h3><i class="fa-solid fa-bullhorn"></i> ${esc(b.title || 'Pengumuman')}</h3>
        <p>${esc(b.message)}</p>
        <div class="row end"><button class="btn primary" id="bcClose">Mengerti</button></div></div>`);
      $('#bcClose').onclick = () => { localStorage.setItem('bc:' + b.id, '1'); closeModal(); };
    }
  } catch { /* ignore */ }
}

// ---- Boot ----------------------------------------------------------------
// Avoid a double initial render: if we set the hash it fires `hashchange`
// (which calls router); otherwise call router once directly.
if (!location.hash) location.hash = '#/dashboard';
else router();
checkBroadcast();
