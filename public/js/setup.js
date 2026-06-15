// Setup wizard: configure with an existing license, or register a new account.
'use strict';
const $ = (id) => document.getElementById(id);
const msg = $('setupMsg');
const setMsg = (t, c) => { msg.textContent = t || ''; msg.className = 'msg' + (c ? ' ' + c : ''); };

function tab(license) {
  $('licensePane').classList.toggle('hidden', !license);
  $('registerPane').classList.toggle('hidden', license);
  setMsg('');
}
$('tabLicense').onclick = () => tab(true);
$('tabRegister').onclick = () => tab(false);

async function postJSON(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { ok: r.ok, data: await r.json().catch(() => ({})) };
}

$('saveLic').onclick = async () => {
  const licenseKey = $('licKey').value.trim();
  const licenseSecret = $('licSecret').value.trim();
  if (!licenseKey || !licenseSecret) return setMsg('Isi License Key & Secret.', 'err');
  setMsg('Memvalidasi lisensi…');
  const { ok, data } = await postJSON('/api/setup', { licenseKey, licenseSecret });
  if (!ok) return setMsg(data.error?.message || 'Gagal.', 'err');
  setMsg('Berhasil! Mengarahkan ke halaman masuk…', 'ok');
  setTimeout(() => { window.location.href = '/'; }, 900);
};

$('doRegister').onclick = async () => {
  const email = $('regEmail').value.trim();
  const password = $('regPass').value;
  const referralCode = $('regRef').value.trim();
  const acceptAgreement = $('regTos').checked;
  if (!email || password.length < 10) return setMsg('Email & kata sandi (min. 10) wajib.', 'err');
  if (!acceptAgreement) return setMsg('Anda harus menyetujui Ketentuan Layanan.', 'err');
  setMsg('Mendaftar & memasang…');
  const { ok, data } = await postJSON('/api/setup/register', { email, password, referralCode, acceptAgreement });
  if (!ok) {
    const detail = data.error?.details?.[0]?.message;
    return setMsg(detail || data.error?.message || 'Gagal mendaftar.', 'err');
  }
  setMsg('Akun dibuat & panel terpasang! Mengarahkan…', 'ok');
  setTimeout(() => { window.location.href = '/'; }, 1200);
};

tab(true);
