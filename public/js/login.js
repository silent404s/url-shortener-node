// Login page: validate the locally-configured license against the Master.
document.getElementById('loginBtn').addEventListener('click', async () => {
  const btn = document.getElementById('loginBtn');
  const msg = document.getElementById('loginMsg');
  btn.disabled = true;
  msg.textContent = 'Validating license...';
  msg.className = 'msg';
  try {
    const res = await fetch('/api/login', { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      msg.textContent = data.offline ? 'Signed in (offline cache).' : 'Signed in.';
      msg.className = 'msg ok';
      window.location.href = '/';
    } else {
      msg.textContent = data.error?.message || 'Login failed';
      msg.className = 'msg err';
      btn.disabled = false;
    }
  } catch (e) {
    msg.textContent = 'Network error';
    msg.className = 'msg err';
    btn.disabled = false;
  }
});
