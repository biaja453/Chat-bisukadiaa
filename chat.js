// chat.js — logika utama aplikasi chat BISUKADIAA

// Sesi disimpan di sessionStorage — hilang otomatis saat tab/browser ditutup,
// jadi user wajib login lagi tiap kali buka website dari awal.
const token = sessionStorage.getItem('bisukadiaa_token');
if (!token) window.location.href = 'index.html';

let me = JSON.parse(sessionStorage.getItem('bisukadiaa_user') || '{}');
let currentRoomId = null;
let rooms = [];
let socket = null;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function initials(name) {
  return (name || '?').trim().slice(0, 2).toUpperCase();
}

function timeFmt(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token,
      ...(opts.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan');
  return data;
}

// ---------- INIT ----------
async function init() {
  try {
    const meData = await api('/api/me');
    me = meData.user;
    sessionStorage.setItem('bisukadiaa_user', JSON.stringify(me));
  } catch (e) {
    sessionStorage.clear();
    window.location.href = 'index.html';
    return;
  }

  renderMe();
  connectSocket();
  await loadRooms();
  await loadContacts();
}

function renderMe() {
  $('#meName').textContent = me.username;
  $('#meRole').textContent = me.role === 'admin' ? 'Admin Situs' : 'User';
  const av = $('#meAvatar');
  av.textContent = initials(me.username);
  av.style.background = me.avatarColor || '#5865F2';
  if (me.role === 'admin') $('#adminBtn').classList.remove('hidden');
}

// ---------- SOCKET ----------
function connectSocket() {
  socket = io('https://charge-submissions-transport-louisiana.trycloudflare.com', { auth: { token } });

  socket.on('new_message', (msg) => {
    // Refresh urutan room (last message)
    loadRooms();
    if (msg.roomId === currentRoomId) {
      appendMessage(msg);
      scrollMessagesToBottom();
    }
  });

  socket.on('typing', ({ roomId, username }) => {
    if (roomId !== currentRoomId) return;
    const el = $('#typingIndicator');
    el.textContent = `${username} sedang mengetik…`;
    el.classList.remove('hidden');
    clearTimeout(window._typingTimeout);
    window._typingTimeout = setTimeout(() => el.classList.add('hidden'), 1500);
  });

  socket.on('presence', ({ userId, online }) => {
    $$('.contact-dot[data-uid="' + userId + '"]').forEach(dot => {
      dot.classList.toggle('online', online);
    });
  });
}

// ---------- ROOMS ----------
async function loadRooms() {
  const data = await api('/api/rooms');
  rooms = data.rooms;
  renderRailGroups();
  renderRoomList();
}

function renderRailGroups() {
  const rail = $('#railGroups');
  rail.innerHTML = '';
  rooms.filter(r => r.type === 'group').forEach(r => {
    const btn = document.createElement('button');
    btn.className = 'rail-icon group-icon' + (r.id === currentRoomId ? ' active' : '');
    btn.textContent = initials(r.name);
    btn.title = r.name;
    btn.addEventListener('click', () => openRoom(r.id));
    rail.appendChild(btn);
  });
}

function renderRoomList() {
  const list = $('#roomList');
  list.innerHTML = '';
  if (rooms.length === 0) {
    list.innerHTML = '<p class="empty-hint">Belum ada grup atau obrolan.</p>';
    return;
  }
  rooms.forEach(r => {
    const item = document.createElement('div');
    item.className = 'room-item' + (r.id === currentRoomId ? ' active' : '');
    item.innerHTML = `
      <div class="avatar" style="background:${r.avatarColor || '#5865F2'}">${initials(r.name)}</div>
      <div class="room-item-info">
        <span class="room-item-name">${escapeHtml(r.name)} ${r.type === 'group' ? '<span class="tag">Grup</span>' : ''}</span>
        <span class="room-item-last">${r.lastMessage ? escapeHtml(r.lastMessage) : 'Belum ada pesan'}</span>
      </div>
    `;
    item.addEventListener('click', () => openRoom(r.id));
    list.appendChild(item);
  });
}

async function openRoom(roomId) {
  currentRoomId = roomId;
  $('#chatEmpty').classList.add('hidden');
  $('#chatActive').classList.remove('hidden');
  document.body.classList.add('mobile-chat-open'); // di HP: pindah dari daftar chat ke layar obrolan
  renderRailGroups();
  renderRoomList();

  socket.emit('join_room', roomId);

  const data = await api(`/api/rooms/${roomId}/messages`);
  const room = data.room;
  const roomMeta = rooms.find(r => r.id === roomId) || {};

  $('#roomTitle').textContent = roomMeta.name || room.name || 'Obrolan';
  $('#roomSub').textContent = room.type === 'group'
    ? `${room.members.length} anggota`
    : 'Pesan langsung';
  $('#roomAvatar').textContent = initials(roomMeta.name || room.name);
  $('#roomAvatar').style.background = roomMeta.avatarColor || '#5865F2';

  const inviteBtn = $('#inviteBtn');
  if (room.type === 'group') {
    inviteBtn.classList.remove('hidden');
    inviteBtn.onclick = () => {
      navigator.clipboard.writeText(room.inviteCode);
      inviteBtn.textContent = '✅';
      setTimeout(() => (inviteBtn.textContent = '🔗'), 1200);
    };
  } else {
    inviteBtn.classList.add('hidden');
  }

  const box = $('#messages');
  box.innerHTML = '';
  data.messages.forEach(appendMessage);
  scrollMessagesToBottom();
}

function appendMessage(msg) {
  const box = $('#messages');
  const mine = msg.senderId === me.id;
  const el = document.createElement('div');
  el.className = 'msg' + (mine ? ' mine' : '');
  el.innerHTML = `
    ${!mine ? `<div class="avatar small" style="background:${msg.senderColor || '#5865F2'}">${initials(msg.senderName)}</div>` : ''}
    <div class="msg-bubble">
      ${!mine ? `<span class="msg-sender">${escapeHtml(msg.senderName)}</span>` : ''}
      <span class="msg-text">${escapeHtml(msg.text)}</span>
      <span class="msg-time">${timeFmt(msg.createdAt)}</span>
    </div>
  `;
  box.appendChild(el);
}

function scrollMessagesToBottom() {
  const box = $('#messages');
  box.scrollTop = box.scrollHeight;
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}

// ---------- COMPOSER ----------
$('#composerForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('#messageInput');
  const text = input.value.trim();
  if (!text || !currentRoomId) return;
  socket.emit('send_message', { roomId: currentRoomId, text });
  input.value = '';
});

let typingTimer = null;
$('#messageInput').addEventListener('input', () => {
  if (!currentRoomId) return;
  clearTimeout(typingTimer);
  socket.emit('typing', { roomId: currentRoomId });
});

// ---------- CONTACTS DRAWER (garis 3 / hamburger) ----------
$('#hamburgerBtn').addEventListener('click', () => {
  $('#contactsDrawer').classList.add('open');
  $('#drawerBackdrop').classList.add('open');
});
function closeDrawer() {
  $('#contactsDrawer').classList.remove('open');
  $('#drawerBackdrop').classList.remove('open');
}
$('#closeDrawerBtn').addEventListener('click', closeDrawer);
$('#drawerBackdrop').addEventListener('click', closeDrawer);

async function loadContacts() {
  const data = await api('/api/contacts');
  const list = $('#contactsList');
  list.innerHTML = '';
  if (data.contacts.length === 0) {
    list.innerHTML = '<p class="empty-hint">Belum ada kontak tersimpan.</p>';
    return;
  }
  data.contacts.forEach(c => {
    const item = document.createElement('div');
    item.className = 'contact-item';
    item.innerHTML = `
      <div class="avatar" style="background:${c.avatarColor}">${initials(c.username)}</div>
      <span class="contact-dot" data-uid="${c.id}"></span>
      <span class="contact-name">${escapeHtml(c.username)}</span>
    `;
    item.addEventListener('click', () => {
      closeDrawer();
      loadRooms().then(() => openRoom(c.roomId));
    });
    list.appendChild(item);
  });
}

$('#addContactForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = $('#addContactInput');
  const errEl = $('#contactError');
  errEl.textContent = '';
  try {
    await api('/api/contacts', { method: 'POST', body: JSON.stringify({ username: input.value.trim() }) });
    input.value = '';
    await loadContacts();
    await loadRooms();
  } catch (err) {
    errEl.textContent = err.message;
  }
});

// ---------- GROUP MODAL ----------
const groupModal = $('#groupModal');
$('#addGroupBtn').addEventListener('click', () => groupModal.classList.remove('hidden'));
$('#closeGroupModal').addEventListener('click', () => groupModal.classList.add('hidden'));

$$('.modal-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.modal-tab-btn').forEach(b => b.classList.remove('active'));
    $$('.modal-form').forEach(f => f.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.mtab + 'GroupForm').classList.add('active');
  });
});

$('#createGroupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = $('#groupModalError');
  errEl.textContent = '';
  try {
    const name = $('#newGroupName').value.trim();
    const { room } = await api('/api/groups', { method: 'POST', body: JSON.stringify({ name }) });
    $('#newGroupName').value = '';
    groupModal.classList.add('hidden');
    await loadRooms();
    openRoom(room.id);
  } catch (err) {
    errEl.textContent = err.message;
  }
});

$('#joinGroupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = $('#groupModalError');
  errEl.textContent = '';
  try {
    const code = $('#joinGroupCode').value.trim();
    const { room } = await api('/api/groups/join', { method: 'POST', body: JSON.stringify({ inviteCode: code }) });
    $('#joinGroupCode').value = '';
    groupModal.classList.add('hidden');
    await loadRooms();
    openRoom(room.id);
  } catch (err) {
    errEl.textContent = err.message;
  }
});

// ---------- ADMIN PANEL ----------
const adminModal = $('#adminModal');
$('#adminBtn').addEventListener('click', async () => {
  adminModal.classList.remove('hidden');
  const { users } = await api('/api/admin/users');
  const box = $('#adminUsers');
  box.innerHTML = '';
  users.forEach(u => {
    const row = document.createElement('div');
    row.className = 'admin-row';
    row.innerHTML = `
      <div class="avatar small" style="background:${u.avatarColor}">${initials(u.username)}</div>
      <span class="admin-name">${escapeHtml(u.username)}</span>
      <select data-uid="${u.id}" class="role-select">
        <option value="user" ${u.role === 'user' ? 'selected' : ''}>User</option>
        <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
      </select>
      <button class="danger-btn" data-del="${u.id}">Hapus</button>
    `;
    box.appendChild(row);
  });

  box.querySelectorAll('.role-select').forEach(sel => {
    sel.addEventListener('change', async () => {
      await api(`/api/admin/users/${sel.dataset.uid}/role`, { method: 'POST', body: JSON.stringify({ role: sel.value }) });
    });
  });
  box.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Hapus user ini?')) return;
      await api(`/api/admin/users/${btn.dataset.del}`, { method: 'DELETE' });
      btn.closest('.admin-row').remove();
    });
  });
});
$('#closeAdminModal').addEventListener('click', () => adminModal.classList.add('hidden'));

// ---------- LOGOUT ----------
$('#logoutBtn').addEventListener('click', () => {
  sessionStorage.clear();
  window.location.href = 'index.html';
});

// ---------- GANTI PASSWORD ----------
const pwModal = $('#passwordModal');
$('#passwordBtn').addEventListener('click', () => {
  $('#pwCurrent').value = '';
  $('#pwNew').value = '';
  $('#pwModalError').textContent = '';
  $('#pwModalSuccess').textContent = '';
  $$('#pwChecklistModal li').forEach(li => li.classList.remove('ok'));
  pwModal.classList.remove('hidden');
});
$('#closePasswordModal').addEventListener('click', () => pwModal.classList.add('hidden'));

const PW_RULES = {
  len: (v) => v.length >= 8,
  lower: (v) => /[a-z]/.test(v),
  upper: (v) => /[A-Z]/.test(v),
  num: (v) => /\d/.test(v),
  sym: (v) => /[^A-Za-z0-9]/.test(v)
};
$('#pwNew').addEventListener('input', (e) => {
  const v = e.target.value;
  Object.entries(PW_RULES).forEach(([rule, test]) => {
    $(`#pwChecklistModal li[data-rule="${rule}"]`).classList.toggle('ok', test(v));
  });
});

$('#passwordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = $('#pwModalError');
  const okEl = $('#pwModalSuccess');
  errEl.textContent = '';
  okEl.textContent = '';
  const currentPassword = $('#pwCurrent').value;
  const newPassword = $('#pwNew').value;
  if (!Object.values(PW_RULES).every(test => test(newPassword))) {
    errEl.textContent = 'Password baru belum memenuhi semua syarat';
    return;
  }
  try {
    await api('/api/me/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
    okEl.textContent = 'Password berhasil diganti.';
    $('#passwordForm').reset();
  } catch (err) {
    errEl.textContent = err.message;
  }
});

// ---------- NAVIGASI MOBILE (kembali ke daftar chat) ----------
$('#backBtn').addEventListener('click', () => {
  document.body.classList.remove('mobile-chat-open');
});

init();
