// Halaman masuk: memvalidasi lisensi lokal ke server Master.
document.getElementById('loginBtn').addEventListener('click', async () => {
  const btn = document.getElementById('loginBtn');
  const msg = document.getElementById('loginMsg');
  btn.disabled = true;
  msg.textContent = 'Memvalidasi lisensi…';
  msg.className = 'msg';
  try {
    const res = await fetch('/api/login', { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      msg.textContent = data.offline ? 'Berhasil masuk (mode luring).' : 'Berhasil masuk.';
      msg.className = 'msg ok';
      window.location.href = '/';
    } else {
      msg.textContent = data.error?.message || 'Gagal masuk.';
      msg.className = 'msg err';
      btn.disabled = false;
    }
  } catch (e) {
    msg.textContent = 'Kesalahan jaringan.';
    msg.className = 'msg err';
    btn.disabled = false;
  }
});
