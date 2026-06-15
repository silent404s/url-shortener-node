// Two-step login state machine: credentials -> 2FA (verify or enroll).
'use strict';
const $ = (id) => document.getElementById(id);
const msg = $('loginMsg');
const STEPS = ['stepCred', 'stepTotp', 'stepEnroll', 'stepRecovery'];

function show(id) { STEPS.forEach((s) => $(s).classList.toggle('hidden', s !== id)); }
function setMsg(t, ok) { msg.textContent = t || ''; msg.className = 'msg' + (ok === true ? ' ok' : ok === false ? ' err' : ''); }

async function postJSON(url, body) {
  const r = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { ok: r.ok, data: await r.json().catch(() => ({})) };
}

// Step 1 — credentials
$('credBtn').onclick = async () => {
  const email = $('email').value.trim(); const password = $('password').value;
  if (!email || !password) return setMsg('Isi email & kata sandi.', false);
  setMsg('Memeriksa…');
  const { ok, data } = await postJSON('/api/login', { email, password });
  if (!ok) return setMsg(data.error?.message || 'Gagal masuk.', false);
  setMsg('');
  if (data.totpEnabled) { show('stepTotp'); $('totpCode').focus(); }
  else { beginEnroll(); }
};

// Step 2a — TOTP login
$('totpBtn').onclick = async () => {
  const code = $('totpCode').value.trim();
  if (!code) return setMsg('Masukkan kode.', false);
  setMsg('Memverifikasi…');
  const { ok, data } = await postJSON('/api/login/totp', { code });
  if (!ok) return setMsg(data.error?.message || 'Kode salah.', false);
  window.location.href = '/';
};

// Step 2b — enrollment
async function beginEnroll() {
  setMsg('Menyiapkan 2FA…');
  const r = await fetch('/api/2fa/setup');
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return setMsg(data.error?.message || 'Gagal menyiapkan 2FA.', false);
  $('qrImg').src = data.qr; $('secret').textContent = data.secret;
  setMsg(''); show('stepEnroll'); $('enrollCode').focus();
}
$('enrollBtn').onclick = async () => {
  const code = $('enrollCode').value.trim();
  if (!code) return setMsg('Masukkan kode dari aplikasi.', false);
  setMsg('Mengaktifkan…');
  const { ok, data } = await postJSON('/api/2fa/enable', { code });
  if (!ok) return setMsg(data.error?.message || 'Kode salah.', false);
  $('recoveryList').textContent = (data.recoveryCodes || []).join('\n');
  setMsg(''); show('stepRecovery');
};

$('recoveryBtn').onclick = () => { window.location.href = '/'; };

// Enter-to-submit per step.
const enter = (id, btn) => { const el = $(id); if (el) el.addEventListener('keydown', (e) => { if (e.key === 'Enter') $(btn).click(); }); };
enter('password', 'credBtn'); enter('totpCode', 'totpBtn'); enter('enrollCode', 'enrollBtn');
