'use strict';

/* =========================================================
   Booth Planner — gestion des réservations de photobooth
   Deux calendriers dans la même appli :
     📸 Photobooth : toutes les prestations (anniversaires, entreprises…)
     💍 Mariages   : fiches dédiées (mariés, lieu de réception, options,
                     suivi devis / contrat / acompte / template…)
   consultables séparément ou ensemble (« Tous »).
   Données stockées localement sur l'appareil (localStorage).
   ========================================================= */

const STORE_KEY = 'boothplanner.reservations.v1';
const SETTINGS_KEY = 'boothplanner.settings.v1';

const STATUS = {
  booked: { label: 'Loué', cls: 'booked' },
  pending: { label: 'En attente', cls: 'pending' },
  free: { label: 'Libre', cls: 'free' },
};

// Les réservations enregistrées avant l'arrivée des deux calendriers n'ont
// pas de champ "cal" : elles appartiennent au calendrier Photobooth.
const CALENDARS = {
  booth: {
    label: 'Photobooth', icon: '📸', newTitle: 'Nouvelle réservation', free: 'Photobooth libre',
    upcoming: 'Prochaines prestations', none: 'Aucune prestation à venir',
  },
  wedding: {
    label: 'Mariages', icon: '💍', newTitle: 'Nouveau mariage', free: 'Aucun mariage ce jour-là',
    upcoming: 'Prochains mariages', none: 'Aucun mariage à venir',
  },
};
const CAL_MODES = ['all', 'booth', 'wedding'];

const EVENT_TYPES = ['Mariage', 'Anniversaire', 'Soirée d\'entreprise', 'Baptême', 'Communion', 'Salon / Séminaire', 'Soirée privée', 'Autre'];

const WEDDING_OPTIONS = [
  'Impressions illimitées', 'Livre d\'or', 'Template prénoms + date', 'Fond personnalisé',
  'Accessoires', 'Galerie en ligne / QR code', 'GIF / Boomerang', 'Installation la veille',
];

const WEDDING_STEPS = [
  ['quote', 'Devis envoyé'],
  ['contract', 'Contrat signé'],
  ['depositPaid', 'Acompte reçu'],
  ['template', 'Template validé par les mariés'],
  ['balance', 'Solde réglé'],
];

const state = {
  reservations: [],
  settings: { company: 'Mon Photobooth', cal: 'all' },
  cal: 'all', // calendrier affiché : 'all', 'booth' ou 'wedding'
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
  state.cal = CAL_MODES.includes(state.settings.cal) ? state.settings.cal : 'all';
}

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state.reservations));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  } catch (e) {
    toast('⚠️ Impossible d\'enregistrer');
  }
}

function setCal(mode) {
  state.cal = CAL_MODES.includes(mode) ? mode : 'all';
  state.settings.cal = state.cal;
  save();
  haptic();
  render();
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

// "J-42", "Demain", "Aujourd'hui" (vide si la date est passée)
function countdown(k) {
  const d = dayDiff(todayKey(), k);
  if (d < 0) return '';
  if (d === 0) return 'Aujourd\'hui';
  if (d === 1) return 'Demain';
  return `J-${d}`;
}

/* ---------------- Queries ---------------- */

function calOf(r) { return r.cal === 'wedding' ? 'wedding' : 'booth'; }
function isWedding(r) { return calOf(r) === 'wedding'; }
function inView(r) { return state.cal === 'all' || calOf(r) === state.cal; }

function endOf(r) { return r.end && r.end >= r.start ? r.end : r.start; }
function onDayAll(k) { return state.reservations.filter((r) => r.start <= k && k <= endOf(r)); }
function onDay(k) { return onDayAll(k).filter(inView); }
// Réservations de l'AUTRE calendrier ce jour-là (quand un seul est affiché)
function otherOnDay(k) { return state.cal === 'all' ? [] : onDayAll(k).filter((r) => !inView(r)); }
function statusOf(list) {
  if (list.some((r) => r.status === 'booked')) return 'booked';
  if (list.length) return 'pending';
  return 'free';
}
function dayStatus(k) { return statusOf(onDay(k)); }
function byId(id) { return state.reservations.find((r) => r.id === id); }
function sortByDate(list) { return list.slice().sort((a, b) => a.start.localeCompare(b.start) || (a.timeStart || '').localeCompare(b.timeStart || '')); }
// Chevauchements vérifiés sur les DEUX calendriers : c'est le même photobooth.
function overlaps(r) {
  return state.reservations.filter((o) => o.id !== r.id && o.start <= endOf(r) && r.start <= endOf(o));
}

function coupleName(r) {
  return [r.partner1, r.partner2].map((s) => String(s || '').trim()).filter(Boolean).join(' & ');
}
function displayName(r) {
  return (isWedding(r) && coupleName(r)) || r.clientName || 'Client sans nom';
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
    ['phone', 'email', 'address', 'company', 'partner1', 'partner2'].forEach((f) => { if (r[f]) c[f] = r[f]; });
    c.cal = calOf(r);
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
};

/* ---------------- Rendering: tabs ---------------- */

const view = document.getElementById('view');

function render() {
  document.body.dataset.mode = state.cal; // thème doré en mode Mariages
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === state.tab));
  if (state.tab === 'calendar') renderCalendar();
  else if (state.tab === 'list') renderList();
  else if (state.tab === 'clients') renderClients();
  else renderSettings();
}

function renderFab() {
  return `<button class="fab" data-act="new" aria-label="Nouvelle réservation">${ICON.plus}</button>`;
}

function calSwitchHTML() {
  const opts = [['all', 'Tous'], ['booth', '📸 Photobooth'], ['wedding', '💍 Mariages']];
  return `<div class="segmented calswitch" role="tablist" aria-label="Calendrier affiché">
    ${opts.map(([v, l]) => `<button data-setcal="${v}" class="${state.cal === v ? 'on' : ''}" role="tab" aria-selected="${state.cal === v}">${l}</button>`).join('')}
  </div>`;
}

/* ---------- Calendrier ---------- */

function renderCalendar() {
  const m = state.month;
  const y = m.getFullYear();
  const mo = m.getMonth();
  const first = (new Date(y, mo, 1).getDay() + 6) % 7; // lundi = 0
  const days = new Date(y, mo + 1, 0).getDate();
  const today = todayKey();
  const other = state.cal === 'booth' ? 'wedding' : 'booth';
  let hasOther = false;

  let cells = '';
  for (let i = 0; i < first; i++) cells += '<div class="day out"></div>';
  for (let d = 1; d <= days; d++) {
    const k = `${y}-${pad(mo + 1)}-${pad(d)}`;
    const list = onDay(k);
    const st = statusOf(list);
    let marks = '';
    if (state.cal === 'all') {
      // Une pastille par calendrier présent ce jour-là
      marks = [...new Set(list.map(calOf))].sort().map((c) => `<i class="mk ${c}"></i>`).join('');
    } else {
      if (list.length) marks += '<i class="mk cur"></i>';
      if (otherOnDay(k).length) { marks += '<i class="mk other"></i>'; hasOther = true; }
    }
    const cls = ['day', st !== 'free' ? st : '', k < today ? 'past' : '', k === today ? 'today' : ''].join(' ');
    cells += `<button class="${cls}" data-day="${k}" aria-label="${esc(fmt.longDay(k))} — ${STATUS[st].label}">
      ${d}${list.length > 1 ? `<span class="count">×${list.length}</span>` : ''}${marks ? `<span class="marks">${marks}</span>` : ''}
    </button>`;
  }

  const mStart = `${y}-${pad(mo + 1)}-01`;
  const mEnd = `${y}-${pad(mo + 1)}-${pad(days)}`;
  const inMonth = state.reservations.filter((r) => inView(r) && r.start <= mEnd && endOf(r) >= mStart);
  const booked = inMonth.filter((r) => r.status === 'booked');
  const pending = inMonth.filter((r) => r.status === 'pending');
  const revenue = booked.filter((r) => r.start >= mStart).reduce((s, r) => s + (Number(r.price) || 0), 0);

  const upcoming = sortByDate(state.reservations.filter((r) => inView(r) && endOf(r) >= today)).slice(0, 4);
  const calInfo = state.cal === 'all' ? null : CALENDARS[state.cal];

  let legend2 = '';
  if (state.cal === 'all') {
    legend2 = '<div class="legend cals"><span><i class="mk booth"></i>📸 Photobooth</span><span><i class="mk wedding"></i>💍 Mariages</span></div>';
  } else if (hasOther) {
    legend2 = `<div class="legend cals"><span><i class="mk other"></i>Occupé côté ${CALENDARS[other].icon} ${CALENDARS[other].label}</span></div>`;
  }

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

    ${calSwitchHTML()}

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
      ${legend2}
    </section>

    <h2 class="section-title">${calInfo ? calInfo.upcoming : 'Prochaines prestations'}</h2>
    ${upcoming.length
    ? upcoming.map((r) => cardHTML(r)).join('')
    : emptyHTML(calInfo ? calInfo.icon : '📸', calInfo ? calInfo.none : 'Aucune prestation à venir', 'Touchez une date du calendrier pour ajouter une réservation.')}
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

// showIcon : affiche 📸 / 💍 devant le nom (vue « Tous », ou réservation de
// l'autre calendrier). Toujours appeler via (r) => cardHTML(r), jamais
// .map(cardHTML) : l'index serait pris pour showIcon.
function cardHTML(r, showIcon = state.cal === 'all' || !inView(r)) {
  const st = STATUS[r.status] || STATUS.pending;
  const multi = r.end && r.end !== r.start;
  const parts = isWedding(r)
    ? [r.location, r.guests ? `${r.guests} invités` : '', endOf(r) >= todayKey() ? countdown(r.start) : '']
    : [r.eventType, r.location, r.timeStart];
  const sub = parts.filter(Boolean).join(' · ') || (multi ? `Jusqu'au ${fmt.short(r.end)}` : fmt.weekday(r.start));
  const icon = showIcon ? `<span class="cal-ic">${CALENDARS[calOf(r)].icon}</span>` : '';
  return `<button class="card" data-open="${r.id}">
    <div class="datebox ${st.cls}"><span class="d">${parseKey(r.start).getDate()}</span><span class="m">${esc(fmt.monthShort(r.start))}</span></div>
    <div class="main">
      <div class="name">${icon}${esc(displayName(r))}</div>
      <div class="sub">${esc(sub)}</div>
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
  const total = state.reservations.filter(inView).length;
  view.innerHTML = `
    <header class="header"><div><div class="eyebrow">${total} au total</div><h1 class="title">${state.cal === 'wedding' ? 'Mariages' : 'Réservations'}</h1></div></header>
    ${calSwitchHTML()}
    <label class="search">${ICON.search}<input id="listSearch" type="search" placeholder="Client, mariés, lieu, type…" value="${esc(state.listSearch)}" autocomplete="off"></label>
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
    if (!inView(r)) return false;
    const upcoming = endOf(r) >= today;
    switch (state.listFilter) {
      case 'upcoming': return upcoming;
      case 'pending': return upcoming && r.status === 'pending';
      case 'booked': return upcoming && r.status === 'booked';
      default: return !upcoming;
    }
  });
  if (q) {
    list = list.filter((r) => [r.clientName, r.partner1, r.partner2, r.location, r.venueAddress, r.eventType, r.phone,
      r.email, r.notes, r.company, r.planner, r.theme]
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

function avatarHTML(c) {
  return c.cal === 'wedding' ? '<div class="avatar wed">💍</div>' : `<div class="avatar">${esc(initials(c.name))}</div>`;
}

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
      ${avatarHTML(c)}
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
  const nWedding = state.reservations.filter(isWedding).length;
  const nBooth = state.reservations.length - nWedding;
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

  view.innerHTML = `
    <header class="header"><div><div class="eyebrow">Booth Planner</div><h1 class="title">Réglages</h1></div></header>

    <div class="stats">
      <div class="stat"><div class="v">${nBooth}</div><div class="l">📸 Photobooth</div></div>
      <div class="stat"><div class="v">${nWedding}</div><div class="l">💍 Mariages</div></div>
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
    <p class="hint">Vos données (les deux calendriers) sont enregistrées uniquement sur cet iPhone, dans l'application. Pensez à exporter une sauvegarde de temps en temps.</p>

    ${standalone ? '' : `
    <div class="group-title">Installer sur l'iPhone</div>
    <div class="group"><div class="notes">1. Ouvrez cette page dans <b>Safari</b>.
2. Touchez le bouton <b>Partager</b> ⬆︎.
3. Choisissez <b>« Sur l'écran d'accueil »</b>.
L'appli s'ouvrira alors en plein écran, comme une app de l'App Store, même sans connexion.</div></div>`}

    <div class="brand"><img src="icons/icon-192.png" alt="">Booth Planner · v2.0</div>
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

function choicesHTML(k, cal) {
  const wed = cal === 'wedding';
  return `<div class="choice-grid">
    <button class="choice pending" data-new-on="${k}" data-status="pending" data-ncal="${cal}">
      <span class="ic">${ICON.clock}</span><b>En attente</b><small>${wed ? 'Devis envoyé aux mariés' : 'Devis envoyé, réponse attendue'}</small>
    </button>
    <button class="choice booked" data-new-on="${k}" data-status="booked" data-ncal="${cal}">
      <span class="ic">${ICON.check}</span><b>Loué</b><small>${wed ? 'Mariage confirmé' : 'Réservation confirmée'}</small>
    </button>
  </div>`;
}

function openDay(k) {
  haptic();
  const list = sortByDate(onDay(k));
  const others = sortByDate(otherOnDay(k));
  const st = statusOf(list);
  const past = k < todayKey();
  const freeLabel = state.cal === 'all' ? 'Libre' : CALENDARS[state.cal].free;
  const other = others.length ? CALENDARS[calOf(others[0])] : null;

  let add;
  if (list.length) {
    add = `<button class="btn secondary" data-new-on="${k}" data-ncal="${state.cal === 'all' ? 'booth' : state.cal}">${ICON.plus} Ajouter une autre réservation</button>`;
  } else if (state.cal === 'all') {
    add = `<div class="group-title">📸 Photobooth</div>${choicesHTML(k, 'booth')}
      <div class="group-title">💍 Mariage</div>${choicesHTML(k, 'wedding')}`;
  } else {
    add = choicesHTML(k, state.cal);
  }

  // Libre dans ce calendrier mais déjà pris dans l'autre : on le dit
  // clairement plutôt que d'afficher un « libre » vert trompeur.
  const badge = st === 'free' && others.length
    ? `<span class="badge ${STATUS[statusOf(others)].cls}">Déjà pris côté ${other.icon} ${other.label}</span>`
    : `<span class="badge ${STATUS[st].cls}">${st === 'free' ? freeLabel : STATUS[st].label}</span>`;
  const body = `
    <div class="day-hero">
      <div class="dname">${esc(fmt.weekday(k))}</div>
      <div class="dnum">${esc(fmt.dayMonthYear(k))}</div>
      ${badge}
    </div>
    ${list.map((r) => cardHTML(r)).join('')}
    ${add}
    ${past ? '<p class="hint" style="text-align:center">Cette date est passée.</p>' : ''}
    ${others.length ? `<div class="group-title">Aussi ce jour-là · ${other.icon} ${other.label}</div>${others.map((r) => cardHTML(r)).join('')}` : ''}
  `;
  openSheet({ title: '', right: '<button class="txt-btn r" data-close>OK</button>', body });
}

/* ---------- Détail ---------- */

function detailHTML(r) {
  const wed = isWedding(r);
  const st = STATUS[r.status] || STATUS.pending;
  const name = displayName(r);
  const tel = telHref(r.phone);
  const price = Number(r.price) || 0;
  const deposit = Number(r.deposit) || 0;
  const pct = price ? Math.min(100, Math.round((deposit / price) * 100)) : 0;
  const place = wed ? [r.location, r.venueAddress].filter(Boolean).join(', ') : (r.location || r.address || '');
  const mapsQ = encodeURIComponent(place);
  const company = state.settings.company || '';
  const smsBody = encodeURIComponent(r.status === 'pending'
    ? (wed
      ? `Bonjour ${name}, je reviens vers vous concernant le photobooth pour votre mariage du ${fmt.dayMonthYear(r.start)}. Souhaitez-vous confirmer la réservation ? ${company}`
      : `Bonjour ${name}, je reviens vers vous concernant la location du photobooth pour le ${fmt.dayMonthYear(r.start)}. Souhaitez-vous confirmer la réservation ? ${company}`)
    : `Bonjour ${name}, `);
  const time = [r.timeStart, r.timeEnd].filter(Boolean).join(' – ');
  const cd = endOf(r) >= todayKey() ? countdown(r.start) : '';

  const rows = (items) => items.filter(([, v]) => v).map(([k, v, cls]) => `<div class="row"><span class="k">${k}</span><span class="v ${cls || ''}">${v}</span></div>`).join('');
  const group = (title, items, emptyLabel, extra = '') => {
    const html = rows(items) + extra;
    if (!html && !emptyLabel) return '';
    return `<div class="group-title">${title}</div><div class="group">${html || `<div class="row"><span class="k">${emptyLabel}</span></div>`}</div>`;
  };
  const link = (scheme, value, shown) => (value ? `<a href="${scheme}:${esc(value)}">${esc(shown)}</a>` : '');

  const head = wed
    ? `<div class="avatar wed">💍</div>
      <h3>${esc(name)}</h3>
      <p>${esc(rangeLabel(r))}</p>
      <div class="badges"><span class="badge ${st.cls}">${st.label}</span>${cd ? `<span class="badge count">${cd}</span>` : ''}</div>`
    : `<div class="avatar">${esc(initials(r.clientName))}</div>
      <h3>${esc(name)}</h3>
      <p>${esc(rangeLabel(r))}</p>
      <span class="badge ${st.cls}">${st.label}</span>`;

  let sections;
  if (wed) {
    const steps = r.checklist || {};
    const done = WEDDING_STEPS.filter(([k]) => steps[k]).length;
    const opts = r.options || [];
    sections = `
      <div class="group-title">Suivi · ${done}/${WEDDING_STEPS.length}</div>
      <div class="group">
        <div class="progress top"><i style="width:${Math.round((done / WEDDING_STEPS.length) * 100)}%"></i></div>
        ${WEDDING_STEPS.map(([k, l]) => `<button class="row step ${steps[k] ? 'done' : ''}" data-step="${r.id}|${k}"><span class="tick">${ICON.check}</span><span>${l}</span></button>`).join('')}
      </div>
      ${group('Mariage', [
    ['Date', esc(rangeLabel(r))],
    ['Horaires', esc(time)],
    ['Lieu', esc(r.location)],
    ['Adresse', esc(r.venueAddress)],
    ['Invités', esc(r.guests)],
  ])}
      ${group('Prestation', [
    ['Formule', esc(r.package)],
    ['Thème', esc(r.theme)],
    ['Texte photo', esc(r.templateText)],
  ], '', opts.length ? `<div class="chips in-group">${opts.map((o) => `<span class="chip on">${esc(o)}</span>`).join('')}</div>` : '')}
      ${group('Contacts', [
    ['Mariés', esc(name)],
    ['Téléphone', link('tel', tel, r.phone)],
    ['Email', link('mailto', r.email, r.email)],
    ['Adresse', esc(r.address)],
    ['Organisateur', esc(r.planner)],
    ['Tél. orga.', link('tel', telHref(r.plannerPhone), r.plannerPhone)],
  ], 'Aucune coordonnée')}`;
  } else {
    sections = `
      ${group('Prestation', [
    ['Type', esc(r.eventType)],
    ['Date', esc(rangeLabel(r))],
    ['Horaires', esc(time)],
    ['Lieu', esc(r.location)],
    ['Formule', esc(r.package)],
    ['Invités', esc(r.guests)],
  ], 'Aucun détail')}
      ${group('Client', [
    ['Nom', esc(r.clientName)],
    ['Société', esc(r.company)],
    ['Téléphone', link('tel', tel, r.phone)],
    ['Email', link('mailto', r.email, r.email)],
    ['Adresse', esc(r.address)],
  ], 'Aucune coordonnée')}`;
  }

  return `
    <div class="detail-head">${head}</div>

    <div class="actions">
      <a class="action ${tel ? '' : 'disabled'}" href="tel:${esc(tel)}">${ICON.phone}Appeler</a>
      <a class="action ${tel ? '' : 'disabled'}" href="sms:${esc(tel)}&body=${smsBody}">${ICON.msg}${r.status === 'pending' ? 'Relancer' : 'Message'}</a>
      <a class="action ${r.email ? '' : 'disabled'}" href="mailto:${esc(r.email || '')}">${ICON.mail}Email</a>
      <a class="action ${mapsQ ? '' : 'disabled'}" href="https://maps.apple.com/?q=${mapsQ}" target="_blank" rel="noopener">${ICON.map}Itinéraire</a>
    </div>

    ${r.status === 'pending' ? `<button class="btn" data-confirm="${r.id}" style="margin:0 0 16px">${ICON.check} Confirmer la location</button>` : ''}

    ${sections}

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
}

function openDetail(id) {
  const r = byId(id);
  if (!r) return;
  openSheet({
    title: '',
    left: '<button class="txt-btn" data-close>Fermer</button>',
    right: `<button class="txt-btn r" data-edit="${r.id}">Modifier</button>`,
    body: detailHTML(r),
    full: true,
  });
}

// Coche / décoche une étape du suivi d'un mariage directement depuis la fiche
function toggleStep(btn, value) {
  const [id, key] = value.split('|');
  const r = byId(id);
  if (!r) return;
  r.checklist = { ...(r.checklist || {}), [key]: !(r.checklist || {})[key] };
  r.updatedAt = new Date().toISOString();
  save();
  haptic();
  const body = btn.closest('.sheet-body');
  const scroll = body.scrollTop;
  body.innerHTML = detailHTML(r);
  body.scrollTop = scroll;
}

/* ---------- Formulaire ---------- */

function formHTML(r, allClients, existing) {
  const field = (label, name, attrs = '') => `<div class="field"><label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" value="${esc(r[name] || '')}" ${attrs}></div>`;
  const wed = isWedding(r);

  const top = `
    <div class="group-title" style="margin-top:6px">Calendrier</div>
    <div class="cal-pick" id="calPick">
      <button type="button" data-v="booth" class="${wed ? '' : 'on'}">📸 Photobooth</button>
      <button type="button" data-v="wedding" class="${wed ? 'on' : ''}">💍 Mariage</button>
    </div>

    <div class="group-title">Statut</div>
    <div class="status-pick" id="statusPick">
      <button type="button" data-v="pending" class="${r.status === 'pending' ? 'on' : ''}">En attente</button>
      <button type="button" data-v="booked" class="${r.status === 'booked' ? 'on' : ''}">Loué</button>
    </div>

    <div class="group-title">${wed ? 'Date du mariage' : 'Date'}</div>
    <div class="group">
      ${field('Date', 'start', 'type="date" required')}
      ${field('Fin (option.)', 'end', 'type="date"')}
      ${field('Début', 'timeStart', 'type="time"')}
      ${field('Fin', 'timeEnd', 'type="time"')}
    </div>
    <div id="overlapWarn"></div>`;

  const middle = wed ? `
    <div class="group-title">Les mariés</div>
    <div class="group">
      ${field('Marié(e) 1', 'partner1', 'placeholder="Prénom Nom" autocapitalize="words"')}
      ${field('Marié(e) 2', 'partner2', 'placeholder="Prénom Nom" autocapitalize="words"')}
      ${field('Téléphone', 'phone', 'type="tel" inputmode="tel" placeholder="06 12 34 56 78"')}
      ${field('Email', 'email', 'type="email" inputmode="email" autocapitalize="off" placeholder="maries@mail.com"')}
      ${field('Adresse', 'address', 'placeholder="Adresse de facturation"')}
    </div>

    <div class="group-title">Réception</div>
    <div class="group">
      ${field('Lieu', 'location', 'placeholder="Domaine, château, salle…"')}
      ${field('Adresse', 'venueAddress', 'placeholder="Adresse du lieu"')}
      ${field('Invités', 'guests', 'type="number" inputmode="numeric" placeholder="0"')}
      ${field('Organisateur', 'planner', 'placeholder="Wedding planner, traiteur…"')}
      ${field('Tél. orga.', 'plannerPhone', 'type="tel" inputmode="tel" placeholder="06…"')}
    </div>

    <div class="group-title">Prestation</div>
    <div class="group">
      ${field('Formule', 'package', 'placeholder="Ex : Formule Mariage"')}
      ${field('Thème', 'theme', 'placeholder="Couleurs, ambiance…"')}
      ${field('Texte photo', 'templateText', 'placeholder="Léa &amp; Thomas · 12.06.2027"')}
    </div>
    <div class="group-title">Options</div>
    <div class="chips" id="optChips">
      ${WEDDING_OPTIONS.map((o) => `<button type="button" class="chip ${(r.options || []).includes(o) ? 'on' : ''}" data-opt="${esc(o)}">${esc(o)}</button>`).join('')}
    </div>` : `
    <div class="group-title">Client</div>
    <div class="group">
      ${field('Nom', 'clientName', 'placeholder="Prénom Nom" list="clientList" autocapitalize="words"')}
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
    </div>`;

  const tarif = `
    <div class="group-title">Tarif</div>
    <div class="group">
      ${field('Prix total €', 'price', 'type="number" inputmode="decimal" step="0.01" placeholder="0"')}
      ${field('Acompte €', 'deposit', 'type="number" inputmode="decimal" step="0.01" placeholder="0"')}
    </div>`;

  const steps = wed ? `
    <div class="group-title">Suivi</div>
    <div class="group" id="stepList">
      ${WEDDING_STEPS.map(([k, l]) => `<button type="button" class="row step ${(r.checklist || {})[k] ? 'done' : ''}" data-fstep="${k}"><span class="tick">${ICON.check}</span><span>${l}</span></button>`).join('')}
    </div>` : '';

  return `
    <form id="resForm" autocomplete="off">
      ${top}
      ${middle}
      ${tarif}
      ${steps}
      <div class="group-title">Notes</div>
      <div class="group">
        <div class="field area full"><textarea name="notes" placeholder="${wed ? 'Déroulé de la soirée, contraintes du lieu, demandes des mariés…' : 'Options, fond, livraison, contraintes…'}">${esc(r.notes || '')}</textarea></div>
      </div>

      <button class="btn" type="submit">${ICON.check} Enregistrer</button>
      ${existing ? `<button class="btn danger" type="button" data-delete="${r.id}">${ICON.trash} Supprimer</button>` : ''}
    </form>`;
}

function openForm({ id, date, status, cal, prefill } = {}) {
  const existing = id ? byId(id) : null;
  const draft = existing
    ? { ...existing, options: [...(existing.options || [])], checklist: { ...(existing.checklist || {}) } }
    : {
      id: uid(), status: status || 'pending', start: date || todayKey(), end: '',
      cal: cal || (state.cal === 'wedding' ? 'wedding' : 'booth'), options: [], checklist: {}, ...prefill,
    };
  draft.cal = calOf(draft);
  const allClients = clients();
  const titleOf = () => (existing ? 'Modifier' : CALENDARS[draft.cal].newTitle);

  openSheet({
    title: titleOf(),
    left: '<button class="txt-btn" data-close>Annuler</button>',
    right: '<button class="txt-btn r" data-submit>OK</button>',
    body: formHTML(draft, allClients, existing),
    full: true,
    onMount(sheet) {
      const formEl = () => sheet.querySelector('#resForm');
      // Reprend les champs texte saisis (options et suivi sont déjà dans draft)
      const collect = () => Object.assign(draft, Object.fromEntries(new FormData(formEl()).entries()));

      const mount = () => {
        sheet.querySelector('.sheet-body').innerHTML = formHTML(draft, allClients, existing);
        sheet.querySelector('.sheet-bar h2').textContent = titleOf();
        bind();
      };

      const submit = (e) => {
        if (e) e.preventDefault();
        const form = formEl();
        collect();
        if (!draft.start) { toast('Choisissez une date'); return; }
        if (isWedding(draft)) {
          draft.partner1 = (draft.partner1 || '').trim();
          draft.partner2 = (draft.partner2 || '').trim();
          if (!draft.partner1 && !draft.partner2) { toast('Indiquez le nom des mariés'); form.elements.partner1.focus(); return; }
          draft.clientName = coupleName(draft);
        } else {
          draft.clientName = (draft.clientName || '').trim();
          if (!draft.clientName) { toast('Indiquez le nom du client'); form.elements.clientName.focus(); return; }
        }
        if (draft.end && draft.end < draft.start) { toast('La date de fin est avant le début'); return; }
        if (draft.end === draft.start) draft.end = '';
        const now = new Date().toISOString();
        const rec = { ...draft, updatedAt: now, createdAt: draft.createdAt || now };
        const clash = overlaps(rec);
        if (clash.length && !confirm(`Cette date est déjà occupée : ${clash.map((o) => `${CALENDARS[calOf(o)].icon} ${displayName(o)}`).join(', ')}.\nEnregistrer quand même ?`)) return;
        const i = state.reservations.findIndex((x) => x.id === rec.id);
        if (i >= 0) state.reservations[i] = rec; else state.reservations.push(rec);
        if (!inView(rec)) { state.cal = 'all'; state.settings.cal = 'all'; } // sinon elle disparaîtrait de l'écran
        save();
        haptic();
        closeAllSheets();
        state.month = startOfMonth(parseKey(rec.start));
        render();
        const booked = rec.status === 'booked';
        toast(existing ? 'Réservation modifiée'
          : isWedding(rec) ? (booked ? 'Mariage confirmé 💍' : 'Mariage en attente ✓')
            : (booked ? 'Date réservée ✓' : 'Mise en attente ✓'));
      };

      function bind() {
        const form = formEl();

        sheet.querySelector('#calPick').addEventListener('click', (e) => {
          const b = e.target.closest('button');
          if (!b || b.dataset.v === draft.cal) return;
          collect();
          if (b.dataset.v === 'wedding' && !draft.partner1 && !draft.partner2 && draft.clientName) draft.partner1 = draft.clientName;
          if (b.dataset.v === 'booth' && coupleName(draft)) draft.clientName = coupleName(draft);
          draft.cal = b.dataset.v;
          haptic();
          mount();
        });

        sheet.querySelector('#statusPick').addEventListener('click', (e) => {
          const b = e.target.closest('button'); if (!b) return;
          draft.status = b.dataset.v; haptic();
          sheet.querySelectorAll('#statusPick button').forEach((x) => x.classList.toggle('on', x === b));
        });

        const chips = sheet.querySelector('#optChips');
        if (chips) {
          chips.addEventListener('click', (e) => {
            const b = e.target.closest('button'); if (!b) return;
            const o = b.dataset.opt;
            draft.options = draft.options.includes(o) ? draft.options.filter((x) => x !== o) : [...draft.options, o];
            b.classList.toggle('on', draft.options.includes(o));
            haptic();
          });
        }

        const stepList = sheet.querySelector('#stepList');
        if (stepList) {
          stepList.addEventListener('click', (e) => {
            const b = e.target.closest('button'); if (!b) return;
            const k = b.dataset.fstep;
            draft.checklist[k] = !draft.checklist[k];
            b.classList.toggle('done', draft.checklist[k]);
            haptic();
          });
        }

        const checkOverlap = () => {
          const s = form.elements.start.value; const en = form.elements.end.value;
          const warn = sheet.querySelector('#overlapWarn');
          if (!s) { warn.innerHTML = ''; return; }
          const others = overlaps({ id: draft.id, start: s, end: en && en >= s ? en : '' });
          warn.innerHTML = others.length
            ? `<div class="warn">⚠️ Date déjà prise : ${others.map((o) => `${CALENDARS[calOf(o)].icon} ${esc(displayName(o))} (${STATUS[o.status].label.toLowerCase()})`).join(', ')}</div>`
            : '';
        };
        form.elements.start.addEventListener('change', checkOverlap);
        form.elements.end.addEventListener('change', checkOverlap);
        checkOverlap();

        // Remplissage automatique des coordonnées d'un client existant
        if (form.elements.clientName) {
          form.elements.clientName.addEventListener('change', () => {
            const c = allClients.find((x) => x.key === form.elements.clientName.value.trim().toLowerCase());
            if (!c) return;
            ['phone', 'email', 'address', 'company'].forEach((f) => { if (!form.elements[f].value && c[f]) form.elements[f].value = c[f]; });
          });
        }

        form.addEventListener('submit', submit);
      }

      bind();
      sheet.querySelector('[data-submit]').addEventListener('click', submit);
    },
  });
}

/* ---------------- Actions ---------------- */

function deleteReservation(id) {
  const r = byId(id);
  if (!r) return;
  if (!confirm(`Supprimer la réservation de ${displayName(r)} ?\nLa date redeviendra libre.`)) return;
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
  toast(isWedding(r) ? 'Mariage confirmé 💍' : 'Location confirmée ✓');
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
  const wed = isWedding(r);
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
  const pendingTag = r.status === 'pending' ? '(En attente) ' : '';
  const summary = wed
    ? `💍 ${pendingTag}Mariage ${coupleName(r)} – Photobooth`
    : `📸 ${pendingTag}Photobooth – ${r.clientName || ''}${r.eventType ? ` (${r.eventType})` : ''}`;
  const location = wed ? [r.location, r.venueAddress].filter(Boolean).join(', ') : r.location;
  const desc = [
    `Statut : ${STATUS[r.status].label}`,
    r.phone && `Tél : ${r.phone}`,
    r.email && `Email : ${r.email}`,
    wed && r.planner && `Organisateur : ${r.planner}${r.plannerPhone ? ` (${r.plannerPhone})` : ''}`,
    r.guests && `Invités : ${r.guests}`,
    r.package && `Formule : ${r.package}`,
    wed && (r.options || []).length && `Options : ${r.options.join(', ')}`,
    wed && r.templateText && `Texte photo : ${r.templateText}`,
    r.price && `Prix : ${fmt.money(r.price)}`,
    r.notes,
  ].filter(Boolean).join('\n');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Booth Planner//FR', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${r.id}@boothplanner`, `DTSTAMP:${stamp}`, dtStart, dtEnd,
    `SUMMARY:${icsEscape(summary)}`,
    location ? `LOCATION:${icsEscape(location)}` : '',
    `DESCRIPTION:${icsEscape(desc)}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
  shareOrDownload(`${wed ? 'mariage' : 'photobooth'}-${r.start}.ics`, ics, 'text/calendar');
}

function exportBackup() {
  const payload = { app: 'booth-planner', version: 2, exportedAt: new Date().toISOString(), settings: state.settings, reservations: state.reservations };
  shareOrDownload(`booth-planner-sauvegarde-${todayKey()}.json`, JSON.stringify(payload, null, 2), 'application/json');
}

function exportCsv() {
  const cols = [
    ['cal', 'Calendrier'], ['start', 'Date début'], ['end', 'Date fin'], ['status', 'Statut'], ['clientName', 'Client'],
    ['partner1', 'Marié(e) 1'], ['partner2', 'Marié(e) 2'], ['company', 'Société'],
    ['phone', 'Téléphone'], ['email', 'Email'], ['address', 'Adresse'], ['eventType', 'Type'], ['location', 'Lieu'],
    ['venueAddress', 'Adresse du lieu'], ['timeStart', 'Heure début'], ['timeEnd', 'Heure fin'], ['package', 'Formule'],
    ['options', 'Options'], ['theme', 'Thème'], ['templateText', 'Texte photo'], ['guests', 'Invités'],
    ['planner', 'Organisateur'], ['plannerPhone', 'Tél. organisateur'], ['checklist', 'Suivi'],
    ['price', 'Prix'], ['deposit', 'Acompte'], ['notes', 'Notes'],
  ];
  const value = (r, k) => {
    if (k === 'cal') return CALENDARS[calOf(r)].label;
    if (k === 'status') return STATUS[r.status].label;
    if (k === 'options') return (r.options || []).join(', ');
    if (k === 'checklist') return isWedding(r) ? WEDDING_STEPS.filter(([s]) => (r.checklist || {})[s]).map(([, l]) => l).join(', ') : '';
    return r[k];
  };
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [cols.map(([, l]) => cell(l)).join(';')];
  sortByDate(state.reservations).forEach((r) => {
    lines.push(cols.map(([k]) => cell(value(r, k))).join(';'));
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
        .map((r) => ({
          ...r, id: r.id || uid(), status: r.status === 'booked' ? 'booked' : 'pending', cal: r.cal === 'wedding' ? 'wedding' : 'booth',
        }));
      if (!confirm(`Restaurer ${valid.length} réservation(s) ?\nLes données actuelles seront remplacées.`)) return;
      state.reservations = valid;
      if (data.settings) Object.assign(state.settings, data.settings);
      state.cal = CAL_MODES.includes(state.settings.cal) ? state.settings.cal : 'all';
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
      ${avatarHTML(c)}
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
    ${sortByDate(c.reservations).reverse().map((r) => cardHTML(r, true)).join('')}
    <button class="btn" data-new-client="${esc(c.key)}">${ICON.plus} Nouvelle réservation</button>
  `;
  openSheet({ title: '', right: '<button class="txt-btn r" data-close>OK</button>', body, full: true });
}

/* ---------------- Délégation d'événements ---------------- */

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-tab],[data-act],[data-day],[data-open],[data-new-on],[data-edit],[data-delete],[data-confirm],[data-ics],[data-close],[data-client],[data-new-client],[data-setcal],[data-step]');
  if (!t) return;
  const d = t.dataset;

  if (d.tab) { state.tab = d.tab; closeAllSheets(); render(); window.scrollTo(0, 0); return; }
  if (d.setcal) { setCal(d.setcal); return; }
  if (d.step) { toggleStep(t, d.step); return; }
  if (d.day) { openDay(d.day); return; }
  if (d.open) { openDetail(d.open); return; }
  if (d.client) { openClient(d.client); return; }
  if (d.edit) { openForm({ id: d.edit }); return; }
  if (d.delete) { deleteReservation(d.delete); return; }
  if (d.confirm) { confirmReservation(d.confirm); return; }
  if (d.ics) { exportIcs(d.ics); return; }
  if (d.newOn) { openForm({ date: d.newOn, status: d.status, cal: d.ncal }); return; }
  if (d.newClient !== undefined) {
    const c = clients().find((x) => x.key === d.newClient);
    if (c && c.cal === 'wedding') {
      openForm({ cal: 'wedding', prefill: { partner1: c.partner1, partner2: c.partner2, phone: c.phone, email: c.email, address: c.address } });
    } else {
      openForm({ cal: 'booth', prefill: c ? { clientName: c.name, phone: c.phone, email: c.email, address: c.address, company: c.company } : {} });
    }
    return;
  }
  if (t.hasAttribute('data-close')) { closeSheet(sheets[sheets.length - 1]); return; }

  switch (d.act) {
    case 'prev': shiftMonth(-1); break;
    case 'next': shiftMonth(1); break;
    case 'today': state.month = startOfMonth(new Date()); render(); break;
    case 'new': openForm({
      date: state.tab === 'calendar' && startOfMonth(new Date()).getTime() !== state.month.getTime() ? toKey(state.month) : todayKey(),
      cal: state.cal === 'wedding' ? 'wedding' : 'booth',
    }); break;
    case 'export': exportBackup(); break;
    case 'csv': exportCsv(); break;
    case 'import': document.getElementById('importFile').click(); break;
    case 'wipe':
      if (confirm('Effacer toutes les réservations (les deux calendriers) ?\nCette action est irréversible.') && confirm('Vraiment tout effacer ?')) {
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
