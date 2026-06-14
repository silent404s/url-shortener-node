// Shared panel logic. Each page only runs the blocks whose elements exist.
const api = {
  async req(method, path, body) {
    const opts = { method, headers: {} };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch('/api' + path, opts);
    if (res.status === 401) { window.location.href = '/login'; throw new Error('no session'); }
    const data = await res.json().catch(() => ({}));
    if (res.status === 503 || data.offline) showOffline();
    return { status: res.status, data };
  },
  get: (p) => api.req('GET', p),
  post: (p, b) => api.req('POST', p, b),
  patch: (p, b) => api.req('PATCH', p, b),
  del: (p) => api.req('DELETE', p),
};

function showOffline() { const b = document.getElementById('offlineBanner'); if (b) b.classList.remove('hidden'); }
function badge(state) { return `<span class="badge ${state}">${state}</span>`; }
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// ---- Logout (present on all authed pages) --------------------------------
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) logoutBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/login';
});

// ---- Dashboard ----------------------------------------------------------
if (document.getElementById('statsGrid')) {
  (async () => {
    const { data: me } = await api.get('/me');
    if (me.usage) {
      document.getElementById('urlUsage').textContent = `${me.usage.urlCount} / ${me.quota.urlLimit}`;
      document.getElementById('domainUsage').textContent = `${me.usage.activeDomains} / ${me.quota.activeDomainLimit}`;
      document.getElementById('regUsage').textContent = `${me.usage.registeredDomains} / ${me.quota.registeredDomainLimit}`;
      document.getElementById('refCode').textContent = me.user?.referral_code || '–';
    }
    const { data: jobs } = await api.get('/jobs');
    const tbody = document.querySelector('#jobsTable tbody');
    tbody.innerHTML = (jobs.jobs || []).map((j) =>
      `<tr><td>${esc(j.type)}</td><td>${badge(j.status)}</td><td>${j.attempts}</td><td>${new Date(j.created_at).toLocaleString()}</td></tr>`
    ).join('') || '<tr><td colspan="4" class="muted">No jobs yet</td></tr>';
  })();
}

// ---- Domains page -------------------------------------------------------
if (document.getElementById('domainsTable')) {
  const tokenMsg = document.getElementById('tokenMsg');
  let lastCfAccountId = null;

  document.getElementById('saveTokenBtn').addEventListener('click', async () => {
    const token = document.getElementById('cfToken').value.trim();
    const label = document.getElementById('cfLabel').value.trim();
    if (!token) return;
    tokenMsg.textContent = 'Validating with Master...'; tokenMsg.className = 'msg';
    const { status, data } = await api.post('/cloudflare/token', { token, label });
    if (status === 201) {
      tokenMsg.textContent = `Token valid. ${data.zones.length} zone(s) found.`;
      tokenMsg.className = 'msg ok';
      lastCfAccountId = data.cfAccountId;
      document.getElementById('cfToken').value = '';
      fillZones(data.zones);
    } else {
      tokenMsg.textContent = data.error?.message || 'Validation failed';
      tokenMsg.className = 'msg err';
    }
  });

  document.getElementById('loadZonesBtn').addEventListener('click', async () => {
    const { data } = await api.get('/cloudflare/zones');
    lastCfAccountId = data.cfAccountId;
    fillZones(data.zones || []);
  });

  function fillZones(zones) {
    const sel = document.getElementById('zoneSelect');
    sel.innerHTML = zones.map((z) => `<option value="${z.zoneId}" data-name="${esc(z.name)}">${esc(z.name)}</option>`).join('');
  }

  document.getElementById('registerDomainBtn').addEventListener('click', async () => {
    const sel = document.getElementById('zoneSelect');
    const opt = sel.selectedOptions[0];
    if (!opt || !lastCfAccountId) return;
    await api.post('/domains', { cfAccountId: lastCfAccountId, zoneId: opt.value, zoneName: opt.dataset.name });
    loadDomains();
  });

  async function loadDomains() {
    const { data } = await api.get('/domains');
    const tbody = document.querySelector('#domainsTable tbody');
    tbody.innerHTML = (data.domains || []).map((d) => `<tr>
      <td>${esc(d.zone_name)}</td><td>${badge(d.state)}</td>
      <td>
        ${d.state === 'registered' ? `<button class="btn small" data-act="activate" data-id="${d.id}">Activate</button>` : ''}
        ${d.state === 'active' ? `<button class="btn small" data-act="rebuild" data-id="${d.id}">Rebuild</button>` : ''}
      </td></tr>`).join('') || '<tr><td colspan="3" class="muted">No domains</td></tr>';
  }
  document.querySelector('#domainsTable').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]'); if (!btn) return;
    const { act, id } = btn.dataset;
    await api.post(`/domains/${id}/${act}`);
    btn.textContent = 'Queued…'; btn.disabled = true;
    setTimeout(loadDomains, 1500);
  });
  loadDomains();
}

// ---- URLs page ----------------------------------------------------------
if (document.getElementById('urlsTable')) {
  async function loadDomainsInto(...selects) {
    const { data } = await api.get('/domains');
    const active = (data.domains || []).filter((d) => d.state === 'active');
    selects.forEach((sel, i) => {
      const base = i === 0 ? '' : '<option value="">All domains</option>';
      sel.innerHTML = base + active.map((d) => `<option value="${d.id}">${esc(d.zone_name)}</option>`).join('');
    });
  }

  async function refreshLock() {
    const { data } = await api.get('/me');
    const locked = data.locked?.urls;
    document.getElementById('lockMsg').classList.toggle('hidden', !locked);
    ['createUrlBtn', 'bulkBtn', 'slugInput', 'targetInput', 'bulkInput'].forEach((id) => {
      const el = document.getElementById(id); if (el) el.disabled = !!locked;
    });
  }

  async function loadUrls() {
    const filter = document.getElementById('filterDomain').value;
    const { data } = await api.get('/urls' + (filter ? `?domainId=${filter}` : ''));
    const tbody = document.querySelector('#urlsTable tbody');
    tbody.innerHTML = (data.urls || []).map((u) => `<tr>
      <td>${esc(u.slug)}</td><td class="muted">${esc(u.target_url)}</td>
      <td>${u.redirect_status}</td><td>${badge(u.state)}</td>
      <td><button class="btn small danger" data-del="${u.id}">Delete</button></td>
    </tr>`).join('') || '<tr><td colspan="5" class="muted">No URLs</td></tr>';
  }

  document.getElementById('createUrlBtn').addEventListener('click', async () => {
    const msg = document.getElementById('createMsg');
    const body = {
      domainId: Number(document.getElementById('domainSelect').value),
      slug: document.getElementById('slugInput').value.trim() || undefined,
      target: document.getElementById('targetInput').value.trim(),
    };
    const { status, data } = await api.post('/urls', body);
    if (status === 202) {
      msg.textContent = `Queued: /${data.shortUrl.slug}`; msg.className = 'msg ok';
      document.getElementById('slugInput').value = '';
      document.getElementById('targetInput').value = '';
      setTimeout(loadUrls, 1500);
    } else { msg.textContent = data.error?.message || 'Failed'; msg.className = 'msg err'; }
  });

  document.getElementById('bulkBtn').addEventListener('click', async () => {
    const msg = document.getElementById('createMsg');
    const items = document.getElementById('bulkInput').value.split('\n')
      .map((l) => l.trim()).filter(Boolean)
      .map((line) => { const [slug, target] = line.split(','); return target ? { slug: slug || undefined, target: target.trim() } : null; })
      .filter(Boolean);
    if (!items.length) return;
    const { status, data } = await api.post('/urls/bulk', { domainId: Number(document.getElementById('domainSelect').value), items });
    msg.textContent = status === 202 ? `Queued ${data.created.length} URLs` : (data.error?.message || 'Failed');
    msg.className = status === 202 ? 'msg ok' : 'msg err';
    setTimeout(loadUrls, 1500);
  });

  document.querySelector('#urlsTable').addEventListener('click', async (e) => {
    const id = e.target.closest('button[data-del]')?.dataset.del; if (!id) return;
    if (!confirm('Delete this URL?')) return;
    await api.del(`/urls/${id}`);
    setTimeout(loadUrls, 1200);
  });
  document.getElementById('filterDomain').addEventListener('change', loadUrls);

  (async () => {
    await loadDomainsInto(document.getElementById('domainSelect'), document.getElementById('filterDomain'));
    await refreshLock();
    await loadUrls();
  })();
}

// ---- Referral page ------------------------------------------------------
if (document.getElementById('invitedTable')) {
  (async () => {
    const { data } = await api.get('/referral');
    document.getElementById('refCode').textContent = data.referralCode || '–';
    document.getElementById('invitedCount').textContent = data.invitedCount ?? 0;
    document.getElementById('bonusUrls').textContent = data.totalBonusUrl ?? 0;
    document.querySelector('#invitedTable tbody').innerHTML =
      (data.invited || []).map((r) => `<tr><td>${esc(r.email)}</td><td>${r.bonus_url}</td><td>${new Date(r.created_at).toLocaleDateString()}</td></tr>`).join('')
      || '<tr><td colspan="3" class="muted">No referrals yet</td></tr>';
    document.getElementById('copyRefBtn').addEventListener('click', () => {
      navigator.clipboard.writeText(data.referralCode || '');
    });
  })();
}
