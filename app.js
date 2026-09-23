'use strict';

/* =========================================================
   Booth Planner — gestion des réservations de photobooth
   Données stockées localement sur l'appareil (localStorage).
   ========================================================= */

const STORE_KEY = 'boothplanner.reservations.v1';
const SETTINGS_KEY = 'boothplanner.settings.v1';

const STATUS = {
  booked: { label: 'Loué', cls: 'booked' },
  pending: { label: 'En attente', cls: 'pending' },
  free: { label: 'Libre', cls: 'free' },
};

const EVENT_TYPES = ['Mariage', 'Anniversaire', 'Soirée d\'entreprise', 'Baptême', 'Communion', 'Salon / Séminaire', 'Soirée privée', 'Autre'];

const state = {
  reservations: [],
  settings: { company: 'Mon Photobooth' },
  tab: 'calendar',
  month: startOfMonth(new Date()),
  listFilter: 'upcoming',
  listSearch: '',
  clientSearch: '',
};

/* ---------------- Storage ---------------- */

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) state.reservations = JSON.parse(raw) || [];
  } catch (e) { state.reservations = []; }
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) Object.assign(state.settings, JSON.parse(raw));
  } catch (e) { /* valeurs par défaut */ }
}

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state.reservations));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  } catch (e) {
    toast('⚠️ Impossible d\'enregistrer');
  }
}

/* ---------------- Dates ---------------- */

function pad(n) { return String(n).padStart(2, '0'); }
function toKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function parseKey(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); }
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addDays(k, n) { const d = parseKey(k); d.setDate(d.getDate() + n); return toKey(d); }
function todayKey() { return toKey(new Date()); }
function dayDiff(a, b) { return Math.round((parseKey(b) - parseKey(a)) / 86400000); }

const fmt = {
  longDay: (k) => parseKey(k).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
  weekday: (k) => parseKey(k).toLocaleDateString('fr-FR', { weekday: 'long' }),
  dayMonthYear: (k) => parseKey(k).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
  short: (k) => parseKey(k).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
  monthShort: (k) => parseKey(k).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''),
  monthYear: (d) => d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
  money: (n) => (Number(n) || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }),
};

function rangeLabel(r) {
  if (!r.end || r.end === r.start) return fmt.longDay(r.start);
  return `Du ${fmt.short(r.start)} au ${fmt.dayMonthYear(r.end)}`;
}

/* ---------------- Queries ---------------- */

function endOf(r) { return r.end && r.end >= r.start ? r.end : r.start; }
function onDay(k) { return state.reservations.filter((r) => r.start <= k && k <= endOf(r)); }
function dayStatus(k) {
  const list = onDay(k);
  if (list.some((r) => r.status === 'booked')) return 'booked';
  if (list.length) return 'pending';
  return 'free';
}
function byId(id) { return state.reservations.find((r) => r.id === id); }
function sortByDate(list) { return list.slice().sort((a, b) => a.start.localeCompare(b.start) || (a.timeStart || '').localeCompare(b.timeStart || '')); }
function overlaps(r) {
  return state.reservations.filter((o) => o.id !== r.id && o.start <= endOf(r) && r.start <= endOf(o));
}

function clientKey(r) { return (r.clientName || '').trim().toLowerCase(); }

function clients() {
  const map = new Map();
  sortByDate(state.reservations).forEach((r) => {
    const k = clientKey(r);
    if (!k) return;
    const c = map.get(k) || { key: k, name: r.clientName.trim(), reservations: [], total: 0 };
    c.reservations.push(r);
    // Les coordonnées les plus récentes l'emportent
    ['phone', 'email', 'address', 'company'].forEach((f) => { if (r[f]) c[f] = r[f]; });
    if (r.status === 'booked') c.total += Number(r.price) || 0;
    map.set(k, c);
  });
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

/* ---------------- Utils ---------------- */

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/);
  return ((parts[0] || '?')[0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
function telHref(p) { return String(p || '').replace(/[^\d+]/g, ''); }
function haptic() { try { navigator.vibrate && navigator.vibrate(8); } catch (e) { /* iOS: pas de vibration */ } }

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

const ICON = {
  chevL: '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>',
  chevR: '<svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  phone: '<svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
  msg: '<svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.8 7L3 21l2-6A8 8 0 1 1 21 12z"/></svg>',
  mail: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3.5 7l8.5 6 8.5-6"/></svg>',
  map: '<svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  cal: '<svg viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="16.5" rx="3.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4M12 13v5M9.5 15.5h5"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  upload: '<svg viewBox="0 0 24 24"><path d="M12 15V3M7 8l5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></svg>',
  download: '<svg viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></svg>',
  table: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 10h18M9 10v10"/></svg>',
  store: '<svg viewBox="0 0 24 24"><path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9h16M9 20v-6h6v6"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M12 3v12M7 8l5-5 5 5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>',
  user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>',
};

/* ---------------- Rendering: tabs ---------------- */

const view = document.getElementById('view');

function render() {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === state.tab));
  if (state.tab === 'calendar') renderCalendar();
  else if (state.tab === 'list') renderList();
  else if (state.tab === 'clients') renderClients();
  else renderSettings();
}

function renderFab() {
  return `<button class="fab" data-act="new" aria-label="Nouvelle réservation">${ICON.plus}</button>`;
}

/* ---------- Calendrier ---------- */

function renderCalendar() {
  const m = state.month;
  const y = m.getFullYear();
  const mo = m.getMonth();
  const first = (new Date(y, mo, 1).getDay() + 6) % 7; // lundi = 0
  const days = new Date(y, mo + 1, 0).getDate();
  const today = todayKey();

  let cells = '';
  for (let i = 0; i < first; i++) cells += '<div class="day out"></div>';
  for (let d = 1; d <= days; d++) {
    const k = `${y}-${pad(mo + 1)}-${pad(d)}`;
    const st = dayStatus(k);
    const n = onDay(k).length;
    const cls = ['day', st !== 'free' ? st : '', k < today ? 'past' : '', k === today ? 'today' : ''].join(' ');
    cells += `<button class="${cls}" data-day="${k}" aria-label="${esc(fmt.longDay(k))} — ${STATUS[st].label}">
      ${d}${n > 1 ? `<span class="count">×${n}</span>` : ''}${st !== 'free' ? '<span class="dot"></span>' : ''}
    </button>`;
  }

  const mStart = `${y}-${pad(mo + 1)}-01`;
  const mEnd = `${y}-${pad(mo + 1)}-${pad(days)}`;
  const inMonth = state.reservations.filter((r) => r.start <= mEnd && endOf(r) >= mStart);
  const booked = inMonth.filter((r) => r.status === 'booked');
  const pending = inMonth.filter((r) => r.status === 'pending');
  const revenue = booked.filter((r) => r.start >= mStart).reduce((s, r) => s + (Number(r.price) || 0), 0);

  const upcoming = sortByDate(state.reservations.filter((r) => endOf(r) >= today)).slice(0, 4);

  view.innerHTML = `
    <header class="header">
      <div>
        <div class="eyebrow">${esc(state.settings.company || 'Photobooth')} · ${y}</div>
        <h1 class="title">${esc(m.toLocaleDateString('fr-FR', { month: 'long' }))}</h1>
      </div>
      <div class="header-actions">
        <button class="icon-btn" data-act="prev" aria-label="Mois précédent">${ICON.chevL}</button>
        <button class="pill-btn" data-act="today">Auj.</button>
        <button class="icon-btn" data-act="next" aria-label="Mois suivant">${ICON.chevR}</button>
      </div>
    </header>

    <div class="stats">
      <div class="stat booked"><div class="v">${booked.length}</div><div class="l">Loués</div></div>
      <div class="stat pending"><div class="v">${pending.length}</div><div class="l">En attente</div></div>
      <div class="stat money"><div class="v">${fmt.money(revenue)}</div><div class="l">CA du mois</div></div>
    </div>

    <section class="cal" id="cal">
      <div class="cal-head">${['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => `<div>${d}</div>`).join('')}</div>
      <div class="cal-grid">${cells}</div>
      <div class="legend">
        <span class="free"><i></i>Libre</span>
        <span class="pending"><i></i>En attente</span>
        <span class="booked"><i></i>Loué</span>
      </div>
    </section>

    <h2 class="section-title">Prochaines prestations</h2>
    ${upcoming.length ? upcoming.map(cardHTML).join('') : emptyHTML('📸', 'Aucune prestation à venir', 'Touchez une date du calendrier pour ajouter une réservation.')}
    ${renderFab()}
  `;

  // Balayage gauche/droite pour changer de mois
  const cal = document.getElementById('cal');
  let sx = null; let sy = null;
  cal.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  cal.addEventListener('touchend', (e) => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) shiftMonth(dx < 0 ? 1 : -1);
    sx = null;
  });
}

function shiftMonth(n) {
  state.month = new Date(state.month.getFullYear(), state.month.getMonth() + n, 1);
  render();
}

function cardHTML(r) {
  const st = STATUS[r.status] || STATUS.pending;
  const multi = r.end && r.end !== r.start;
  const sub = [r.eventType, r.location].filter(Boolean).join(' · ') || (multi ? `Jusqu'au ${fmt.short(r.end)}` : fmt.weekday(r.start));
  return `<button class="card" data-open="${r.id}">
    <div class="datebox ${st.cls}"><span class="d">${parseKey(r.start).getDate()}</span><span class="m">${esc(fmt.monthShort(r.start))}</span></div>
    <div class="main">
      <div class="name">${esc(r.clientName || 'Client sans nom')}</div>
      <div class="sub">${esc(sub)}${r.timeStart ? ` · ${esc(r.timeStart)}` : ''}</div>
    </div>
    <div class="right">
      <span class="badge ${st.cls}">${st.label}</span>
      ${r.price ? `<div class="price">${fmt.money(r.price)}</div>` : ''}
    </div>
  </button>`;
}

function emptyHTML(emoji, title, text) {
  return `<div class="empty"><div class="big">${emoji}</div><b>${esc(title)}</b>${esc(text)}</div>`;
}

/* ---------- Liste ---------- */

function renderList() {
  view.innerHTML = `
    <header class="header"><div><div class="eyebrow">${state.reservations.length} au total</div><h1 class="title">Réservations</h1></div></header>
    <label class="search">${ICON.search}<input id="listSearch" type="search" placeholder="Client, lieu, type…" value="${esc(state.listSearch)}" autocomplete="off"></label>
    <div class="segmented" id="listSeg">
      ${[['upcoming', 'À venir'], ['pending', 'En attente'], ['booked', 'Loués'], ['past', 'Passées']]
        .map(([v, l]) => `<button data-v="${v}" class="${state.listFilter === v ? 'on' : ''}">${l}</button>`).join('')}
    </div>
    <div id="listBody"></div>
    ${renderFab()}
  `;
  document.getElementById('listSearch').addEventListener('input', (e) => { state.listSearch = e.target.value; renderListBody(); });
  document.getElementById('listSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    state.listFilter = b.dataset.v; renderList();
  });
  renderListBody();
}

function renderListBody() {
  const today = todayKey();
  const q = state.listSearch.trim().toLowerCase();
  let list = state.reservations.filter((r) => {
    const upcoming = endOf(r) >= today;
    switch (state.listFilter) {
      case 'upcoming': return upcoming;
      case 'pending': return upcoming && r.status === 'pending';
      case 'booked': return upcoming && r.status === 'booked';
      default: return !upcoming;
    }
  });
  if (q) {
    list = list.filter((r) => [r.clientName, r.location, r.eventType, r.phone, r.email, r.notes, r.company]
      .some((v) => String(v || '').toLowerCase().includes(q)));
  }
  list = sortByDate(list);
  if (state.listFilter === 'past') list.reverse();

  const body = document.getElementById('listBody');
  if (!list.length) {
    body.innerHTML = emptyHTML(q ? '🔍' : '🗓️', q ? 'Aucun résultat' : 'Rien ici pour le moment', q ? 'Essayez une autre recherche.' : 'Ajoutez une réservation avec le bouton +.');
    return;
  }
  let html = ''; let current = '';
  list.forEach((r) => {
    const label = fmt.monthYear(parseKey(r.start));
    if (label !== current) { html += `<div class="month-label">${esc(label)}</div>`; current = label; }
    html += cardHTML(r);
  });
  body.innerHTML = html;
}

/* ---------- Clients ---------- */

function renderClients() {
  const all = clients();
  view.innerHTML = `
    <header class="header"><div><div class="eyebrow">${all.length} client${all.length > 1 ? 's' : ''}</div><h1 class="title">Clients</h1></div></header>
    <label class="search">${ICON.search}<input id="clientSearch" type="search" placeholder="Nom, téléphone, email…" value="${esc(state.clientSearch)}" autocomplete="off"></label>
    <div id="clientBody"></div>
    ${renderFab()}
  `;
  document.getElementById('clientSearch').addEventListener('input', (e) => { state.clientSearch = e.target.value; renderClientBody(); });
  renderClientBody();
}

function renderClientBody() {
  const q = state.clientSearch.trim().toLowerCase();
  const list = clients().filter((c) => !q || [c.name, c.phone, c.email, c.company].some((v) => String(v || '').toLowerCase().includes(q)));
  const body = document.getElementById('clientBody');
  if (!list.length) {
    body.innerHTML = emptyHTML('👥', q ? 'Aucun résultat' : 'Aucun client', q ? 'Essayez une autre recherche.' : 'Les clients apparaissent ici dès votre première réservation.');
    return;
  }
  body.innerHTML = list.map((c) => `
    <button class="card" data-client="${esc(c.key)}">
      <div class="avatar">${esc(initials(c.name))}</div>
      <div class="main">
        <div class="name">${esc(c.name)}</div>
        <div class="sub">${esc(c.phone || c.email || c.company || '—')}</div>
      </div>
      <div class="right">
        <div class="sub">${c.reservations.length} résa.</div>
        ${c.total ? `<div class="price">${fmt.money(c.total)}</div>` : ''}
      </div>
    </button>`).join('');
}

/* ---------- Réglages ---------- */

function renderSettings() {
  const booked = state.reservations.filter((r) => r.status === 'booked');
  const year = String(new Date().getFullYear());
  const yearRevenue = booked.filter((r) => r.start.startsWith(year)).reduce((s, r) => s + (Number(r.price) || 0), 0);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

  view.innerHTML = `
    <header class="header"><div><div class="eyebrow">Booth Planner</div><h1 class="title">Réglages</h1></div></header>

    <div class="stats">
      <div class="stat"><div class="v">${state.reservations.length}</div><div class="l">Réservations</div></div>
      <div class="stat"><div class="v">${clients().length}</div><div class="l">Clients</div></div>
      <div class="stat money"><div class="v">${fmt.money(yearRevenue)}</div><div class="l">CA ${year}</div></div>
    </div>

    <div class="group-title">Entreprise</div>
    <div class="group">
      <div class="field"><label for="company">Nom</label><input id="company" value="${esc(state.settings.company)}" placeholder="Mon Photobooth"></div>
    </div>

    <div class="group-title">Sauvegarde</div>
    <div class="group">
      <button class="setting-row" data-act="export">
        <span class="ic" style="background:#6c5ce7">${ICON.upload}</span>
        <span class="t">Exporter une sauvegarde<small>Fichier .json à garder dans Fichiers / iCloud</small></span>
      </button>
      <button class="setting-row" data-act="import">
        <span class="ic" style="background:#0a84ff">${ICON.download}</span>
        <span class="t">Restaurer une sauvegarde<small>Remplace les données actuelles</small></span>
      </button>
      <button class="setting-row" data-act="csv">
        <span class="ic" style="background:#30b158">${ICON.table}</span>
        <span class="t">Exporter en tableau (CSV)<small>Pour Excel / Numbers / compta</small></span>
      </button>
      <button class="setting-row danger" data-act="wipe">
        <span class="ic" style="background:#ff3b30">${ICON.trash}</span>
        <span class="t">Tout effacer</span>
      </button>
    </div>
    <p class="hint">Vos données sont enregistrées uniquement sur cet iPhone, dans l'application. Pensez à exporter une sauvegarde de temps en temps.</p>

    ${standalone ? '' : `
    <div class="group-title">Installer sur l'iPhone</div>
    <div class="group"><div class="notes">1. Ouvrez cette page dans <b>Safari</b>.
2. Touchez le bouton <b>Partager</b> ⬆︎.
3. Choisissez <b>« Sur l'écran d'accueil »</b>.
L'appli s'ouvrira alors en plein écran, comme une app de l'App Store, même sans connexion.</div></div>`}

    <div class="brand"><img src="icons/icon-192.png" alt="">Booth Planner · v1.0</div>
    <input type="file" id="importFile" accept="application/json,.json" hidden>
  `;

  document.getElementById('company').addEventListener('change', (e) => {
    state.settings.company = e.target.value.trim() || 'Mon Photobooth';
    save(); toast('Nom enregistré');
  });
  document.getElementById('importFile').addEventListener('change', importBackup);
}

/* ---------------- Sheets (panneaux) ---------------- */

const sheets = [];

function openSheet({ title = '', left = '', right = '', body = '', full = false, onMount }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'backdrop';
  const sheet = document.createElement('section');
  sheet.className = `sheet${full ? ' full' : ''}`;
  sheet.setAttribute('role', 'dialog');
  sheet.innerHTML = `
    <div class="sheet-top">
      <div class="grabber"></div>
      <div class="sheet-bar">
        <div style="min-width:76px">${left}</div>
        <h2>${esc(title)}</h2>
        <div style="min-width:76px;text-align:right">${right}</div>
      </div>
    </div>
    <div class="sheet-body">${body}</div>`;
  document.body.append(backdrop, sheet);
  const entry = { sheet, backdrop };
  sheets.push(entry);

  requestAnimationFrame(() => { backdrop.classList.add('show'); sheet.classList.add('show'); });
  backdrop.addEventListener('click', () => closeSheet(entry));

  // Glisser vers le bas pour fermer
  const top = sheet.querySelector('.sheet-top');
  let startY = null; let dy = 0;
  top.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; sheet.style.transition = 'none'; }, { passive: true });
  top.addEventListener('touchmove', (e) => {
    if (startY === null) return;
    dy = Math.max(0, e.touches[0].clientY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  top.addEventListener('touchend', () => {
    sheet.style.transition = '';
    sheet.style.transform = '';
    if (dy > 110) closeSheet(entry);
    startY = null; dy = 0;
  });

  if (onMount) onMount(sheet, entry);
  return entry;
}

function closeSheet(entry) {
  const i = sheets.indexOf(entry);
  if (i === -1) return;
  sheets.splice(i, 1);
  entry.sheet.classList.remove('show');
  entry.backdrop.classList.remove('show');
  setTimeout(() => { entry.sheet.remove(); entry.backdrop.remove(); }, 340);
}

function closeAllSheets() { sheets.slice().forEach(closeSheet); }

/* ---------- Jour ---------- */

function openDay(k) {
  haptic();
  const list = sortByDate(onDay(k));
  const st = dayStatus(k);
  const past = k < todayKey();
  const body = `
    <div class="day-hero">
      <div class="dname">${esc(fmt.weekday(k))}</div>
      <div class="dnum">${esc(fmt.dayMonthYear(k))}</div>
      <span class="badge ${STATUS[st].cls}">${st === 'free' ? 'Photobooth libre' : STATUS[st].label}</span>
    </div>
    ${list.map(cardHTML).join('')}
    ${list.length ? `<button class="btn secondary" data-new-on="${k}">${ICON.plus} Ajouter une autre réservation</button>` : `
      <div class="choice-grid">
        <button class="choice pending" data-new-on="${k}" data-status="pending">
          <span class="ic">${ICON.clock}</span><b>En attente</b><small>Devis envoyé, réponse attendue</small>
        </button>
        <button class="choice booked" data-new-on="${k}" data-status="booked">
          <span class="ic">${ICON.check}</span><b>Loué</b><small>Réservation confirmée</small>
        </button>
      </div>
      ${past ? '<p class="hint" style="text-align:center">Cette date est passée.</p>' : ''}`}
  `;
  openSheet({ title: '', right: '<button class="txt-btn r" data-close>OK</button>', body });
}

/* ---------- Détail ---------- */

function openDetail(id) {
  const r = byId(id);
  if (!r) return;
  const st = STATUS[r.status] || STATUS.pending;
  const tel = telHref(r.phone);
  const price = Number(r.price) || 0;
  const deposit = Number(r.deposit) || 0;
  const pct = price ? Math.min(100, Math.round((deposit / price) * 100)) : 0;
  const mapsQ = encodeURIComponent(r.location || r.address || '');
  const smsBody = encodeURIComponent(r.status === 'pending'
    ? `Bonjour ${r.clientName || ''}, je reviens vers vous concernant la location du photobooth pour le ${fmt.dayMonthYear(r.start)}. Souhaitez-vous confirmer la réservation ? ${state.settings.company || ''}`
    : `Bonjour ${r.clientName || ''}, `);
  const time = [r.timeStart, r.timeEnd].filter(Boolean).join(' – ');

  const rows = (items) => items.filter(([, v]) => v).map(([k, v, cls]) => `<div class="row"><span class="k">${k}</span><span class="v ${cls || ''}">${v}</span></div>`).join('');

  const body = `
    <div class="detail-head">
      <div class="avatar">${esc(initials(r.clientName))}</div>
      <h3>${esc(r.clientName || 'Client sans nom')}</h3>
      <p>${esc(rangeLabel(r))}</p>
      <span class="badge ${st.cls}">${st.label}</span>
    </div>

    <div class="actions">
      <a class="action ${tel ? '' : 'disabled'}" href="tel:${esc(tel)}">${ICON.phone}Appeler</a>
      <a class="action ${tel ? '' : 'disabled'}" href="sms:${esc(tel)}&body=${smsBody}">${ICON.msg}${r.status === 'pending' ? 'Relancer' : 'Message'}</a>
      <a class="action ${r.email ? '' : 'disabled'}" href="mailto:${esc(r.email || '')}">${ICON.mail}Email</a>
      <a class="action ${mapsQ ? '' : 'disabled'}" href="https://maps.apple.com/?q=${mapsQ}" target="_blank" rel="noopener">${ICON.map}Itinéraire</a>
    </div>

    ${r.status === 'pending' ? `<button class="btn" data-confirm="${r.id}" style="margin:0 0 16px">${ICON.check} Confirmer la location</button>` : ''}

    <div class="group-title">Prestation</div>
    <div class="group">
      ${rows([
        ['Type', esc(r.eventType)],
        ['Date', esc(rangeLabel(r))],
        ['Horaires', esc(time)],
        ['Lieu', esc(r.location)],
        ['Formule', esc(r.package)],
        ['Invités', esc(r.guests)],
      ]) || '<div class="row"><span class="k">Aucun détail</span></div>'}
    </div>

    <div class="group-title">Client</div>
    <div class="group">
      ${rows([
        ['Nom', esc(r.clientName)],
        ['Société', esc(r.company)],
        ['Téléphone', tel ? `<a href="tel:${esc(tel)}">${esc(r.phone)}</a>` : ''],
        ['Email', r.email ? `<a href="mailto:${esc(r.email)}">${esc(r.email)}</a>` : ''],
        ['Adresse', esc(r.address)],
      ]) || '<div class="row"><span class="k">Aucune coordonnée</span></div>'}
    </div>

    ${price || deposit ? `
    <div class="group-title">Paiement</div>
    <div class="group">
      ${rows([
        ['Prix total', price ? fmt.money(price) : '', 'strong'],
        ['Acompte versé', deposit ? fmt.money(deposit) : ''],
        ['Reste à payer', price ? fmt.money(Math.max(0, price - deposit)) : '', 'strong'],
      ])}
      ${price ? `<div class="progress"><i style="width:${pct}%"></i></div>` : ''}
    </div>` : ''}

    ${r.notes ? `<div class="group-title">Notes</div><div class="group"><div class="notes">${esc(r.notes)}</div></div>` : ''}

    <button class="btn secondary" data-ics="${r.id}">${ICON.cal} Ajouter à mon calendrier</button>
    <button class="btn danger" data-delete="${r.id}">${ICON.trash} Supprimer (remettre libre)</button>
  `;

  openSheet({
    title: '',
    left: '<button class="txt-btn" data-close>Fermer</button>',
    right: `<button class="txt-btn r" data-edit="${r.id}">Modifier</button>`,
    body,
    full: true,
  });
}

/* ---------- Formulaire ---------- */

function openForm({ id, date, status, prefill } = {}) {
  const existing = id ? byId(id) : null;
  const r = existing ? { ...existing } : {
    id: uid(), status: status || 'pending', start: date || todayKey(), end: '', eventType: '', ...prefill,
  };
  const allClients = clients();

  const field = (label, name, attrs = '') => `<div class="field"><label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" value="${esc(r[name] || '')}" ${attrs}></div>`;

  const body = `
    <form id="resForm" autocomplete="off">
      <div class="group-title" style="margin-top:6px">Statut</div>
      <div class="status-pick" id="statusPick">
        <button type="button" data-v="pending" class="${r.status === 'pending' ? 'on' : ''}">En attente</button>
        <button type="button" data-v="booked" class="${r.status === 'booked' ? 'on' : ''}">Loué</button>
      </div>

      <div class="group-title">Date</div>
      <div class="group">
        ${field('Date', 'start', 'type="date" required')}
        ${field('Fin (option.)', 'end', 'type="date"')}
        ${field('Début', 'timeStart', 'type="time"')}
        ${field('Fin', 'timeEnd', 'type="time"')}
      </div>
      <div id="overlapWarn"></div>

      <div class="group-title">Client</div>
      <div class="group">
        ${field('Nom', 'clientName', 'placeholder="Prénom Nom" list="clientList" autocapitalize="words" required')}
        ${field('Société', 'company', 'placeholder="Facultatif"')}
        ${field('Téléphone', 'phone', 'type="tel" inputmode="tel" placeholder="06 12 34 56 78"')}
        ${field('Email', 'email', 'type="email" inputmode="email" autocapitalize="off" placeholder="client@mail.com"')}
        ${field('Adresse', 'address', 'placeholder="Adresse de facturation"')}
      </div>
      <datalist id="clientList">${allClients.map((c) => `<option value="${esc(c.name)}"></option>`).join('')}</datalist>

      <div class="group-title">Événement</div>
      <div class="group">
        <div class="field"><label for="f-eventType">Type</label>
          <select id="f-eventType" name="eventType">
            <option value="">Choisir…</option>
            ${EVENT_TYPES.map((t) => `<option ${r.eventType === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}
          </select>
        </div>
        ${field('Lieu', 'location', 'placeholder="Salle, ville…"')}
        ${field('Formule', 'package', 'placeholder="Ex : Formule Premium"')}
        ${field('Invités', 'guests', 'type="number" inputmode="numeric" placeholder="0"')}
      </div>

      <div class="group-title">Tarif</div>
      <div class="group">
        ${field('Prix total €', 'price', 'type="number" inputmode="decimal" step="0.01" placeholder="0"')}
        ${field('Acompte €', 'deposit', 'type="number" inputmode="decimal" step="0.01" placeholder="0"')}
      </div>

      <div class="group-title">Notes</div>
      <div class="group">
        <div class="field area full"><textarea name="notes" placeholder="Options, fond, livraison, contraintes…">${esc(r.notes || '')}</textarea></div>
      </div>

      <button class="btn" type="submit">${ICON.check} Enregistrer</button>
      ${existing ? `<button class="btn danger" type="button" data-delete="${r.id}">${ICON.trash} Supprimer</button>` : ''}
    </form>
  `;

  openSheet({
    title: existing ? 'Modifier' : 'Nouvelle réservation',
    left: '<button class="txt-btn" data-close>Annuler</button>',
    right: '<button class="txt-btn r" data-submit>OK</button>',
    body,
    full: true,
    onMount(sheet, entry) {
      const form = sheet.querySelector('#resForm');
      let status = r.status;

      sheet.querySelector('#statusPick').addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return;
        status = b.dataset.v; haptic();
        sheet.querySelectorAll('#statusPick button').forEach((x) => x.classList.toggle('on', x === b));
      });

      const checkOverlap = () => {
        const s = form.start.value; const en = form.end.value;
        const warn = sheet.querySelector('#overlapWarn');
        if (!s) { warn.innerHTML = ''; return; }
        const others = overlaps({ id: r.id, start: s, end: en && en >= s ? en : '' });
        warn.innerHTML = others.length
          ? `<div class="warn">⚠️ Date déjà prise : ${others.map((o) => `${esc(o.clientName || 'Client')} (${STATUS[o.status].label.toLowerCase()})`).join(', ')}</div>`
          : '';
      };
      form.start.addEventListener('change', checkOverlap);
      form.end.addEventListener('change', checkOverlap);
      checkOverlap();

      // Remplissage automatique des coordonnées d'un client existant
      form.clientName.addEventListener('change', () => {
        const c = allClients.find((x) => x.key === form.clientName.value.trim().toLowerCase());
        if (!c) return;
        ['phone', 'email', 'address', 'company'].forEach((f) => { if (!form[f].value && c[f]) form[f].value = c[f]; });
      });

      const submit = (e) => {
        if (e) e.preventDefault();
        const data = Object.fromEntries(new FormData(form).entries());
        if (!data.start) { toast('Choisissez une date'); return; }
        if (!data.clientName.trim()) { toast('Indiquez le nom du client'); form.clientName.focus(); return; }
        if (data.end && data.end < data.start) { toast('La date de fin est avant le début'); return; }
        if (data.end === data.start) data.end = '';
        const rec = {
          ...r, ...data, status,
          clientName: data.clientName.trim(),
          updatedAt: new Date().toISOString(),
          createdAt: r.createdAt || new Date().toISOString(),
        };
        const clash = overlaps(rec);
        if (clash.length && !confirm(`Cette date est déjà occupée par ${clash.map((o) => o.clientName).join(', ')}.\nEnregistrer quand même ?`)) return;
        const i = state.reservations.findIndex((x) => x.id === rec.id);
        if (i >= 0) state.reservations[i] = rec; else state.reservations.push(rec);
        save();
        haptic();
        closeAllSheets();
        state.month = startOfMonth(parseKey(rec.start));
        render();
        toast(existing ? 'Réservation modifiée' : (status === 'booked' ? 'Date réservée ✓' : 'Mise en attente ✓'));
      };
      form.addEventListener('submit', submit);
      sheet.querySelector('[data-submit]').addEventListener('click', submit);
      entry.submit = submit;
    },
  });
}

/* ---------------- Actions ---------------- */

function deleteReservation(id) {
  const r = byId(id);
  if (!r) return;
  if (!confirm(`Supprimer la réservation de ${r.clientName || 'ce client'} ?\nLa date redeviendra libre.`)) return;
  state.reservations = state.reservations.filter((x) => x.id !== id);
  save();
  closeAllSheets();
  render();
  toast('Réservation supprimée');
}

function confirmReservation(id) {
  const r = byId(id);
  if (!r) return;
  r.status = 'booked';
  r.updatedAt = new Date().toISOString();
  save();
  haptic();
  closeAllSheets();
  render();
  toast('Location confirmée ✓');
}

async function shareOrDownload(filename, content, type) {
  const blob = new Blob([content], { type });
  try {
    const file = new File([blob], filename, { type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function icsEscape(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => `\\${c}`); }

function exportIcs(id) {
  const r = byId(id);
  if (!r) return;
  const d = (k) => k.replace(/-/g, '');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  let dtStart; let dtEnd;
  if (r.timeStart && (!r.end || r.end === r.start)) {
    const endTime = r.timeEnd || r.timeStart;
    const endDay = r.timeEnd && r.timeEnd < r.timeStart ? addDays(r.start, 1) : r.start;
    dtStart = `DTSTART:${d(r.start)}T${r.timeStart.replace(':', '')}00`;
    dtEnd = `DTEND:${d(endDay)}T${endTime.replace(':', '')}00`;
  } else {
    dtStart = `DTSTART;VALUE=DATE:${d(r.start)}`;
    dtEnd = `DTEND;VALUE=DATE:${d(addDays(endOf(r), 1))}`;
  }
  const desc = [
    `Statut : ${STATUS[r.status].label}`,
    r.phone && `Tél : ${r.phone}`,
    r.email && `Email : ${r.email}`,
    r.package && `Formule : ${r.package}`,
    r.price && `Prix : ${fmt.money(r.price)}`,
    r.notes,
  ].filter(Boolean).join('\n');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Booth Planner//FR', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${r.id}@boothplanner`, `DTSTAMP:${stamp}`, dtStart, dtEnd,
    `SUMMARY:${icsEscape(`📸 ${r.status === 'pending' ? '(En attente) ' : ''}Photobooth – ${r.clientName || ''}${r.eventType ? ` (${r.eventType})` : ''}`)}`,
    r.location ? `LOCATION:${icsEscape(r.location)}` : '',
    `DESCRIPTION:${icsEscape(desc)}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
  shareOrDownload(`photobooth-${r.start}.ics`, ics, 'text/calendar');
}

function exportBackup() {
  const payload = { app: 'booth-planner', version: 1, exportedAt: new Date().toISOString(), settings: state.settings, reservations: state.reservations };
  shareOrDownload(`booth-planner-sauvegarde-${todayKey()}.json`, JSON.stringify(payload, null, 2), 'application/json');
}

function exportCsv() {
  const cols = [
    ['start', 'Date début'], ['end', 'Date fin'], ['status', 'Statut'], ['clientName', 'Client'], ['company', 'Société'],
    ['phone', 'Téléphone'], ['email', 'Email'], ['address', 'Adresse'], ['eventType', 'Type'], ['location', 'Lieu'],
    ['timeStart', 'Heure début'], ['timeEnd', 'Heure fin'], ['package', 'Formule'], ['guests', 'Invités'],
    ['price', 'Prix'], ['deposit', 'Acompte'], ['notes', 'Notes'],
  ];
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [cols.map(([, l]) => cell(l)).join(';')];
  sortByDate(state.reservations).forEach((r) => {
    lines.push(cols.map(([k]) => cell(k === 'status' ? STATUS[r.status].label : r[k])).join(';'));
  });
  shareOrDownload(`reservations-${todayKey()}.csv`, '\uFEFF' + lines.join('\r\n'), 'text/csv');
}

function importBackup(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      const list = Array.isArray(data) ? data : data.reservations;
      if (!Array.isArray(list)) throw new Error('format');
      const valid = list.filter((r) => r && typeof r.start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.start))
        .map((r) => ({ ...r, id: r.id || uid(), status: r.status === 'booked' ? 'booked' : 'pending' }));
      if (!confirm(`Restaurer ${valid.length} réservation(s) ?\nLes données actuelles seront remplacées.`)) return;
      state.reservations = valid;
      if (data.settings) Object.assign(state.settings, data.settings);
      save(); render();
      toast('Sauvegarde restaurée ✓');
    } catch (err) {
      toast('Fichier de sauvegarde invalide');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function openClient(key) {
  const c = clients().find((x) => x.key === key);
  if (!c) return;
  const tel = telHref(c.phone);
  const body = `
    <div class="detail-head">
      <div class="avatar">${esc(initials(c.name))}</div>
      <h3>${esc(c.name)}</h3>
      <p>${esc(c.company || `${c.reservations.length} réservation${c.reservations.length > 1 ? 's' : ''}`)}</p>
    </div>
    <div class="actions">
      <a class="action ${tel ? '' : 'disabled'}" href="tel:${esc(tel)}">${ICON.phone}Appeler</a>
      <a class="action ${tel ? '' : 'disabled'}" href="sms:${esc(tel)}">${ICON.msg}Message</a>
      <a class="action ${c.email ? '' : 'disabled'}" href="mailto:${esc(c.email || '')}">${ICON.mail}Email</a>
      <a class="action ${c.address ? '' : 'disabled'}" href="https://maps.apple.com/?q=${encodeURIComponent(c.address || '')}" target="_blank" rel="noopener">${ICON.map}Adresse</a>
    </div>
    <div class="group">
      ${[['Téléphone', c.phone], ['Email', c.email], ['Adresse', c.address], ['Total loué', c.total ? fmt.money(c.total) : '']]
        .filter(([, v]) => v).map(([k, v]) => `<div class="row"><span class="k">${k}</span><span class="v">${esc(v)}</span></div>`).join('') || '<div class="row"><span class="k">Aucune coordonnée</span></div>'}
    </div>
    <div class="group-title">Réservations</div>
    ${sortByDate(c.reservations).reverse().map(cardHTML).join('')}
    <button class="btn" data-new-client="${esc(c.key)}">${ICON.plus} Nouvelle réservation</button>
  `;
  openSheet({ title: '', right: '<button class="txt-btn r" data-close>OK</button>', body, full: true });
}

/* ---------------- Délégation d'événements ---------------- */

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-tab],[data-act],[data-day],[data-open],[data-new-on],[data-edit],[data-delete],[data-confirm],[data-ics],[data-close],[data-client],[data-new-client]');
  if (!t) return;
  const d = t.dataset;

  if (d.tab) { state.tab = d.tab; closeAllSheets(); render(); window.scrollTo(0, 0); return; }
  if (d.day) { openDay(d.day); return; }
  if (d.open) { openDetail(d.open); return; }
  if (d.client) { openClient(d.client); return; }
  if (d.edit) { openForm({ id: d.edit }); return; }
  if (d.delete) { deleteReservation(d.delete); return; }
  if (d.confirm) { confirmReservation(d.confirm); return; }
  if (d.ics) { exportIcs(d.ics); return; }
  if (d.newOn) { openForm({ date: d.newOn, status: d.status }); return; }
  if (d.newClient !== undefined) {
    const c = clients().find((x) => x.key === d.newClient);
    openForm({ prefill: c ? { clientName: c.name, phone: c.phone, email: c.email, address: c.address, company: c.company } : {} });
    return;
  }
  if (t.hasAttribute('data-close')) { closeSheet(sheets[sheets.length - 1]); return; }

  switch (d.act) {
    case 'prev': shiftMonth(-1); break;
    case 'next': shiftMonth(1); break;
    case 'today': state.month = startOfMonth(new Date()); render(); break;
    case 'new': openForm({ date: state.tab === 'calendar' && startOfMonth(new Date()).getTime() !== state.month.getTime() ? toKey(state.month) : todayKey() }); break;
    case 'export': exportBackup(); break;
    case 'csv': exportCsv(); break;
    case 'import': document.getElementById('importFile').click(); break;
    case 'wipe':
      if (confirm('Effacer toutes les réservations ?\nCette action est irréversible.') && confirm('Vraiment tout effacer ?')) {
        state.reservations = []; save(); render(); toast('Données effacées');
      }
      break;
    default: break;
  }
});

/* ---------------- Démarrage ---------------- */

load();
render();

// Demande au navigateur de ne pas effacer les données
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

// Hors ligne
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

// Retour sur l'appli après minuit : on rafraîchit "aujourd'hui"
document.addEventListener('visibilitychange', () => { if (!document.hidden && !sheets.length) render(); });
