// auth.js — logika login & register

// Sesi disimpan di sessionStorage (bukan localStorage) supaya begitu tab/browser
// ditutup, sesi ikut hilang — user wajib login lagi tiap buka website dari awal.
if (sessionStorage.getItem('bisukadiaa_token')) {
  window.location.href = 'chat.html';
}

const PASSWORD_RULES = {
  len: (v) => v.length >= 8,
  lower: (v) => /[a-z]/.test(v),
  upper: (v) => /[A-Z]/.test(v),
  num: (v) => /\d/.test(v),
  sym: (v) => /[^A-Za-z0-9]/.test(v)
};

const regPasswordInput = document.getElementById('regPassword');
regPasswordInput.addEventListener('input', () => {
  const v = regPasswordInput.value;
  Object.entries(PASSWORD_RULES).forEach(([rule, test]) => {
    const li = document.querySelector(`.pw-checklist li[data-rule="${rule}"]`);
    li.classList.toggle('ok', test(v));
  });
});

function isPasswordValid(v) {
  return Object.values(PASSWORD_RULES).every((test) => test(v));
}

const tabBtns = document.querySelectorAll('.tab-btn');
const forms = document.querySelectorAll('.auth-form');

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    forms.forEach(f => f.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab + 'Form').classList.add('active');
  });
});

const API_URL = 'https://charge-submissions-transport-louisiana.trycloudflare.com';

async function callApi(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan');
  return data;
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;
  try {
    const data = await callApi('/api/login', { username, password });
    sessionStorage.setItem('bisukadiaa_token', data.token);
    sessionStorage.setItem('bisukadiaa_user', JSON.stringify(data.user));
    window.location.href = 'chat.html';
  } catch (err) {
    errEl.textContent = err.message;
  }
});

document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('regError');
  const okEl = document.getElementById('regSuccess');
  errEl.textContent = '';
  okEl.textContent = '';
  const username = document.getElementById('regUsername').value;
  const password = document.getElementById('regPassword').value;

  if (!isPasswordValid(password)) {
    errEl.textContent = 'Password belum memenuhi semua syarat di atas';
    return;
  }

  try {
    await callApi('/api/register', { username, password });
    okEl.textContent = 'Akun berhasil dibuat! Silakan login.';
    document.getElementById('registerForm').reset();
    document.querySelectorAll('.pw-checklist li').forEach(li => li.classList.remove('ok'));
    // Pindah ke tab Login otomatis & isi username biar tinggal masukin password
    document.querySelector('.tab-btn[data-tab="login"]').click();
    document.getElementById('loginUsername').value = username;
    document.getElementById('loginPassword').focus();
  } catch (err) {
    errEl.textContent = err.message;
  }
});
