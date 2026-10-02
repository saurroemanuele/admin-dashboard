if (window.top !== window.self) { document.documentElement.innerHTML = ""; throw new Error("frame"); }

const PROJECT = 'jhoidpugjjvvkjccyrxg';
// screenshot delle segnalazioni arrivate prima degli account (restano nell'archivio di questa pagina)
const FEATURE_NAMES = {
  'job.export': 'Video esportati', 'job.prepare': 'Video importati', 'job.transcribe': 'Sottotitoli creati', 'job.trrange': 'Sottotitoli di un pezzo',
  'job.webcam': 'Webcam trovata', 'job.face': 'Faccia trovata', 'job.story': 'Storie create', 'job.storyvoice': 'Voce delle storie', 'job.download': 'Live da link',
  'job.removebg': 'Sfondo rimosso', 'job.thumbs': 'Miniature', 'project.blank': 'Progetti vuoti', 'project.vertical': 'Clip verticali', 'project.timeline': 'Timeline aggiunte',
  'title.add': 'Titoli animati', 'marker.add': 'Marcatori', 'account.login': 'Accessi', 'app.start': 'Aperture dell\'app',
};
const fname = (n) => FEATURE_NAMES[n] || n;

const $ = (s, r = document) => r.querySelector(s);
const el = (tag, attrs, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false && k !== '') e.append(k.nodeType ? k : String(k));
  return e;
};
const svgEl = (tag, attrs) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };

// ------------------------------------------------------------------ dati (Supabase, con il connettore del proprietario)
const SB_URL = 'https://jhoidpugjjvvkjccyrxg.supabase.co';
const SB_KEY = 'sb_publishable_vam6nGEE5qCrRCXknhoWqQ_GvrpnvzR';   // chiave pubblica: da sola non apre nessun dato
const sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } });
let READY = false;
let ME = null;   // chi è entrato: nome, ruolo, permessi (decisi dal server, qui servono solo a nascondere)
const CAN = (p) => !!ME && (ME.role === 'owner' || (ME.perms || []).includes(p));
async function sql(fn, arg) {
  if (!READY) throw { code: 'auth' };
  const a = (fn === 'user_detail' || fn === 'report_detail') ? { id: arg } : (arg === undefined ? null : arg);
  const { data, error } = await sb.rpc('admin_call', { fn, arg: a });
  if (error) {
    const m = String(error.message || '');
    if (/mfa_required/.test(m)) { READY = false; gate(); throw { code: 'mfa' }; }
    if (/not_admin/.test(m)) { READY = false; await sb.auth.signOut(); gate('Questo account non è autorizzato.'); throw { code: 'not_admin' }; }
    if (/no_perm/.test(m)) throw { code: 'no_perm' };
    if (/JWT|jwt/.test(m)) { READY = false; gate(); throw { code: 'auth' }; }
    throw { code: 'db', message: m };
  }
  return data;
}
function explain(e) {
  const c = e && e.code;
  if (c === 'auth' || c === 'mfa') return 'Accesso scaduto: entra di nuovo.';
  if (c === 'not_admin') return 'Questo account non è autorizzato.';
  if (c === 'no_perm') return 'Non hai il permesso per farlo: chiedi a chi gestisce il team.';
  return (e && e.message) || 'Errore sconosciuto';
}

// ------------------------------------------------------------------ utilità
const when = (iso) => {
  if (!iso) return '—';
  const t = new Date(iso); if (isNaN(t)) return iso;
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'adesso'; if (s < 3600) return Math.round(s / 60) + ' min fa'; if (s < 86400) return Math.round(s / 3600) + ' h fa';
  if (s < 7 * 86400) { const d = Math.round(s / 86400); return d + (d === 1 ? ' giorno fa' : ' giorni fa'); }
  return t.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: t.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });
};
const full = (iso) => { const t = new Date(iso); return isNaN(t) ? (iso || '') : t.toLocaleString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
const safePic = (u) => (u.photo && /^data:image\/(jpeg|png|webp);base64,/.test(u.photo)) ? u.photo : (/^https:\/\/lh\d\.googleusercontent\.com\//.test(u.avatar || '') ? u.avatar : '');
const avatar = (u) => { const src = safePic(u); return el('span', { class: 'av' }, src ? el('img', { src, alt: '', referrerpolicy: 'no-referrer' }) : ((u.name || u.email || '?').trim().charAt(0).toUpperCase())); };
const nid = (n) => { const s = String(n || ''); return s.length === 8 ? s.slice(0, 4) + ' ' + s.slice(4) : s; };
const PLAT = { windows: 'Windows', mac: 'Mac', linux: 'Linux' };
let toastT;
// come replaceChildren, ma senza scrivere "null" per le parti che mancano
function rc(node, ...kids) { node.replaceChildren(...kids.flat().filter((k) => k != null && k !== false && k !== '')); }
function toast(m) { document.querySelectorAll('.toast').forEach((t) => t.remove()); const t = el('div', { class: 'toast', role: 'status' }, m); document.body.append(t); clearTimeout(toastT); toastT = setTimeout(() => t.remove(), 2400); }
function lightbox(u) { const lb = el('div', { class: 'lightbox', onclick: () => lb.remove() }, el('img', { src: u, alt: '' })); document.body.append(lb); }

// ------------------------------------------------------------------ navigazione
const S = { view: 'overview', tf: 'all', tp: '', ov: null, users: null, reports: null, uq: '', uf: 'all', rtab: 'nuova', rq: '', rsel: null, rdet: {}, drafts: {} };
let lastLoad = null;
const VIEW_PERM = { overview: '', status: '', messages: 'messages', money: 'money', launch: 'launch', tasks: 'tasks', reports: 'reports', users: 'users', shop: 'shop', beta: 'beta', team: 'team' };
const allowed = (v) => v in VIEW_PERM && (!VIEW_PERM[v] || CAN(VIEW_PERM[v]));
const ROLE_NAME = { owner: 'Proprietario', admin: 'Admin', supporto: 'Supporto', sviluppo: 'Sviluppo', marketing: 'Marketing', lettura: 'Solo lettura', custom: 'Personalizzato' };
function paintMe() {
  document.querySelectorAll('.nav-i[data-perm]').forEach((b) => { b.hidden = !CAN(b.dataset.perm); });
  const me = $('#me'); if (me && ME) rc(me, el('b', null, ME.name || ME.email), el('small', null, ROLE_NAME[ME.role] || ME.role));
  const sb2 = $('#sbadge'); if (sb2 && ME) { sb2.hidden = !ME.issues; sb2.textContent = ME.issues || ''; sb2.title = 'Servizi che non funzionano'; }
  const tb = $('#tbadge'); if (tb && ME) { tb.hidden = !ME.my_tasks; tb.textContent = ME.my_tasks || ''; tb.title = 'Task assegnate a te'; }
}
function go(view) {
  if (!allowed(view)) view = 'overview';
  S.view = view;
  document.querySelectorAll('.nav-i').forEach((b) => b.setAttribute('aria-current', b.dataset.view === view ? 'page' : 'false'));
  try { localStorage.setItem('nuvora.admin.view', view); } catch (e) { /* */ }
  render();
  load(view);
}
document.querySelectorAll('.nav-i').forEach((b) => b.addEventListener('click', () => go(b.dataset.view)));
$('#reload').addEventListener('click', () => { S.rdet = {}; load(S.view, true); });

async function load(view, force) {
  if (!READY) return;
  try {
    if (view === 'overview' || (force && CAN('reports')) || !S.ov) { S.ov = await sql('overview'); }
    if (view === 'users' && (force || !S.users)) S.users = await sql('users', { limit: 2000 });
    if (view === 'reports' && (force || !S.reports)) S.reports = await sql('reports', {});
    if (view === 'beta' && (force || !S.beta)) S.beta = await sql('beta_list');
    if (view === 'shop' && (force || !S.shop)) S.shop = await sql('catalog', { op: 'list' });
    if (view === 'launch' && (force || !S.launch)) S.launch = await sql('launch');
    if (view === 'status' && (force || !S.status)) S.status = await sql('status');
    if (view === 'messages' && (force || !S.messages)) S.messages = await sql('messages');
    if (view === 'money' && (force || !S.money)) S.money = await sql('money', { days: S.mdays || 30 });
    if (view === 'tasks' && (force || !S.tasks)) S.tasks = await sql('tasks');
    if (view === 'team' && (force || !S.team)) { [S.team, S.audit] = await Promise.all([sql('team'), sql('audit', { limit: 120 })]); }
    if (force) { ME = { ...ME, ...(await sql('me')) }; paintMe(); }
    S.err = null; lastLoad = new Date();
  } catch (e) { S.err = explain(e); }
  const n = S.ov ? S.ov.reports_new : 0;
  const bd = $('#badge'); bd.hidden = !n; bd.textContent = n;
  $('#upd').textContent = lastLoad ? 'Aggiornato alle ' + lastLoad.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '';
  if (S.view === view) render();
}

function render() {
  const main = $('#main');
  if (S.view === 'overview') rc(main, head('Panoramica'), el('div', { class: 'body' }, S.err ? el('div', { class: 'err' }, S.err) : null, S.ov ? overview(S.ov) : el('div', { class: 'loading' }, 'Caricamento…')));
  if (S.view === 'users') renderUsers(main);
  if (S.view === 'reports') renderReports(main);
  if (S.view === 'beta') renderBeta(main);
  if (S.view === 'shop') renderShop(main);
  if (S.view === 'launch') renderLaunch(main);
  if (S.view === 'tasks') renderTasks(main);
  if (S.view === 'team') renderTeam(main);
  if (S.view === 'status') renderStatus(main);
  if (S.view === 'messages') renderMessages(main);
  if (S.view === 'money') renderMoney(main);
}
const SUB = {
  Panoramica: 'Come va l\'app oggi: iscritti, utenti attivi e funzioni più usate.',
  Utenti: 'Tutti gli account NoonFrame. Clicca una persona per vedere dispositivi, uso e crediti.',
  Segnalazioni: 'Bug e idee mandati dall\'app. Approva e Claude le sistema; rifiuta e non verranno fatte.',
  'Beta tester': 'Chi può provare le versioni nuove prima di tutti.',
  'Crediti e offerte': 'Prezzi dei piani, ricariche e offerte lampo che vedono gli utenti nell\'app.',
  Lancio: 'I numeri del lancio confrontati con gli obiettivi. Non contano le persone del team.',
  Task: 'Le cose da fare del team. Trascina una card per cambiarne lo stato.',
  'Team e permessi': 'Chi può entrare in questo pannello e cosa può fare.',
  Stato: 'Se i servizi di NoonFrame funzionano. Se qualcosa diventa rosso, è da sistemare.',
  Messaggi: 'Avvisi e novità che arrivano nella campanella dell\'app.',
  Soldi: 'Quanto costano davvero le AI e quanti crediti sono ancora in giro.',
};
const head = (title, ...right) => el('div', { class: 'head' }, el('div', { class: 'ttl' }, el('h1', null, title), SUB[title] ? el('p', null, SUB[title]) : null), ...right);

// ------------------------------------------------------------------ panoramica
function overview(o) {
  const kpi = (n, label, sub, hot) => el('div', { class: 'kpi' + (hot ? ' hot' : '') }, el('b', null, n ?? '—'), el('span', null, label), sub ? el('small', null, sub) : null);
  const plat = o.platforms || {};
  return el('div', { class: 'ov' },
    el('div', { class: 'kpis' },
      kpi(o.users, 'Utenti', (o.new_today || 0) + ' oggi · ' + (o.new_7d || 0) + ' in 7 giorni'),
      kpi(o.active_7d, 'Attivi in 7 giorni', (o.active_1d || 0) + ' nelle ultime 24 ore'),
      kpi(o.active_30d, 'Attivi in 30 giorni'),
      kpi(o.exports_7d, 'Video esportati', 'negli ultimi 7 giorni'),
      CAN('reports') ? kpi(o.reports_new, 'Segnalazioni da decidere', (o.reports_queued || 0) + ' in coda per Claude', o.reports_new > 0) : null),
    el('div', { class: 'cards' },
      el('div', { class: 'card chart' }, el('h2', null, 'Ultimi 30 giorni', el('span', { class: 'leg' }, el('span', null, el('i', { style: 'background:var(--c1)' }), 'Nuovi iscritti'), el('span', null, el('i', { style: 'background:var(--c3)' }), 'Utenti attivi'))), chart(o.days || [])),
      el('div', { class: 'card' }, el('h2', null, 'Sistemi'), barList(Object.entries(plat).map(([k, v]) => [PLAT[k] || k, v])),
        el('h2', { style: 'margin-top:18px' }, 'Versioni in uso (30 giorni)'), barList((o.versions || []).slice(0, 6).map((x) => [x.v, x.n])))),
    el('div', { class: 'card' }, el('h2', null, 'Funzioni più usate (30 giorni)'),
      (o.features || []).length ? barList(o.features.map((f) => [fname(f.name), f.n, f.users + (f.users === 1 ? ' utente' : ' utenti')])) : el('p', { class: 'muted' }, 'Ancora nessun dato: arriva quando gli utenti usano l\'app con l\'account.')));
}
function barList(rows) {
  if (!rows.length) return el('p', { class: 'muted', style: 'margin:0' }, 'Nessun dato');
  const max = Math.max(...rows.map((r) => r[1]), 1);
  return el('div', { class: 'bars' }, ...rows.map(([label, n, extra]) => el('div', { class: 'bar-r', title: extra || '' }, el('span', null, label), el('span', { class: 'track' }, el('i', { style: 'width:' + Math.max(2, n / max * 100) + '%' })), el('b', null, num(n)))));
}
function chart(days) {
  const W = 600, H = 200, P = { l: 28, r: 8, t: 10, b: 22 };
  const s = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Nuovi iscritti e utenti attivi negli ultimi 30 giorni' });
  const max = Math.max(1, ...days.map((d) => Math.max(d.signups, d.active)));
  const nice = max <= 5 ? 5 : Math.ceil(max / 5) * 5;
  const x = (i) => P.l + (i + 0.5) * (W - P.l - P.r) / days.length, y = (v) => H - P.b - v / nice * (H - P.t - P.b);
  for (let k = 0; k <= 4; k++) {
    const v = nice * k / 4, yy = y(v);
    s.append(svgEl('line', { x1: P.l, x2: W - P.r, y1: yy, y2: yy, stroke: 'rgba(160,180,220,.1)' }));
    const t = svgEl('text', { x: P.l - 6, y: yy + 3, 'text-anchor': 'end', fill: '#6F7A8E', 'font-size': 10 }); t.textContent = Math.round(v); s.append(t);
  }
  const bw = Math.max(3, (W - P.l - P.r) / days.length * 0.55);
  days.forEach((d, i) => {
    if (d.signups) s.append(svgEl('rect', { x: x(i) - bw / 2, y: y(d.signups), width: bw, height: y(0) - y(d.signups), rx: 2, fill: '#1E6BFF' }));
    if (i % 7 === 0 || i === days.length - 1) { const t = svgEl('text', { x: x(i), y: H - 6, 'text-anchor': 'middle', fill: '#6F7A8E', 'font-size': 10 }); t.textContent = new Date(d.d).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }); s.append(t); }
  });
  s.append(svgEl('polyline', { points: days.map((d, i) => x(i) + ',' + y(d.active)).join(' '), fill: 'none', stroke: '#A9C7FF', 'stroke-width': 2, 'stroke-linejoin': 'round' }));
  const last = days[days.length - 1]; if (last) s.append(svgEl('circle', { cx: x(days.length - 1), cy: y(last.active), r: 3.5, fill: '#A9C7FF' }));
  return s;
}

// ------------------------------------------------------------------ utenti
function renderUsers(main) {
  const q = el('input', { class: 'search', type: 'search', placeholder: 'Cerca per email o nome', value: S.uq, 'aria-label': 'Cerca utenti' });
  q.addEventListener('input', () => { S.uq = q.value; paintTable(); });
  const seg = el('div', { class: 'seg' }, ...[['all', 'Tutti'], ['active', 'Attivi 7 giorni'], ['blocked', 'Bloccati']].map(([k, l]) =>
    el('button', { type: 'button', 'aria-pressed': String(S.uf === k), onclick: () => { S.uf = k; renderUsers(main); } }, l)));
  const wrap = el('div', { class: 'tblwrap' });
  rc(main, head('Utenti', seg, q), el('div', { class: 'body', style: 'overflow:hidden' }, S.err ? el('div', { class: 'err' }, S.err) : null, wrap));
  function paintTable() {
    if (!S.users) { rc(wrap, el('div', { class: 'loading' }, 'Caricamento…')); return; }
    const t = S.uq.trim().toLowerCase();
    const rows = S.users.filter((u) => (S.uf !== 'blocked' || u.blocked) && (S.uf !== 'active' || (u.last_seen_at && Date.now() - new Date(u.last_seen_at) < 7 * 864e5))
      && (!t || ((u.email || '') + ' ' + (u.name || '') + ' @' + (u.username || '') + ' ' + (u.nuvora_id || '')).toLowerCase().includes(t.replace(/\s+/g, ' '))));
    if (!rows.length) { rc(wrap, el('div', { class: 'empty' }, S.users.length ? 'Nessun utente con questi filtri.' : 'Ancora nessun utente. Appariranno qui appena accedono dall\'app.')); return; }
    rc(wrap, el('table', { class: 'tbl' },
      el('thead', null, el('tr', null, el('th', null, 'Utente'), el('th', null, 'Sistema'), el('th', { class: 'hide-m' }, 'Versione'), el('th', null, 'Ultimo accesso'), el('th', { class: 'hide-m' }, 'Iscritto'),
        el('th', { class: 'hide-m', style: 'text-align:right' }, 'Export'), el('th', { class: 'hide-m', style: 'text-align:right' }, 'Segnalazioni'), el('th', null, ''))),
      el('tbody', null, ...rows.map((u) => el('tr', { onclick: () => openUser(u.id), tabindex: '0', onkeydown: (e) => { if (e.key === 'Enter') openUser(u.id); } },
        el('td', null, el('div', { class: 'who' }, avatar(u), el('span', null, el('b', null, u.name || u.email || '—'), el('small', null, [u.username ? '@' + u.username : null, u.email].filter(Boolean).join(' · '))))),
        el('td', null, PLAT[u.platform] || u.platform || '—'), el('td', { class: 'hide-m' }, u.app_version || '—'), el('td', null, when(u.last_seen_at)), el('td', { class: 'hide-m' }, when(u.created_at)),
        el('td', { class: 'num hide-m' }, u.exports), el('td', { class: 'num hide-m' }, u.reports),
        el('td', null, u.blocked ? el('span', { class: 'pill bad' }, 'Bloccato') : ''))))));
  }
  paintTable();
}

// ------------------------------------------------------------------ beta tester: solo queste email vedono le versioni beta nell'app
function renderBeta(main) {
  const email = el('input', { class: 'search', type: 'email', placeholder: 'email@esempio.com', 'aria-label': 'Email da aggiungere', autocomplete: 'off' });
  const note = el('input', { class: 'search', type: 'text', placeholder: 'Nota (facoltativa)', 'aria-label': 'Nota', maxlength: '200' });
  const add = el('button', { class: 'btn primary', type: 'submit' }, 'Aggiungi');
  const form = el('form', { class: 'beta-add' }, email, note, add);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = email.value.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) { toast('Email non valida'); email.focus(); return; }
    add.disabled = true;
    try { S.beta = await sql('beta_set', { email: v, note: note.value.trim(), on: true }); toast('Aggiunto ai beta tester'); renderBeta(main); }
    catch (err) { toast(explain(err)); add.disabled = false; }
  });
  const list = el('div', { class: 'tblwrap' });
  rc(main, head('Beta tester'), el('div', { class: 'body beta-body' }, S.err ? el('div', { class: 'err' }, S.err) : null,
    el('p', { class: 'beta-info' }, 'Solo questi account vedono "Versioni beta" in fondo alla home di NoonFrame. Se togli un\'email, la sua app torna da sola alle versioni stabili.'),
    form, list));
  if (!S.beta) { rc(list, el('div', { class: 'loading' }, 'Caricamento…')); return; }
  if (!S.beta.length) { rc(list, el('div', { class: 'empty' }, 'Nessun beta tester.')); return; }
  rc(list, el('table', { class: 'tbl' },
    el('thead', null, el('tr', null, el('th', null, 'Email'), el('th', { class: 'hide-m' }, 'Nota'), el('th', null, 'Account'), el('th', { class: 'hide-m' }, 'Aggiunto'), el('th', null, ''))),
    el('tbody', null, ...S.beta.map((b) => el('tr', null,
      el('td', null, b.email), el('td', { class: 'hide-m' }, b.note || ''),
      el('td', null, b.registered ? el('span', { class: 'pill done' }, 'Registrato') : el('span', { class: 'pill no' }, 'Non ancora')),
      el('td', { class: 'hide-m' }, when(b.added_at)),
      el('td', { style: 'text-align:right' }, el('button', { class: 'btn sm bad', type: 'button', onclick: async (e) => {
        e.currentTarget.disabled = true;
        try { S.beta = await sql('beta_set', { email: b.email, on: false }); toast('Rimosso dai beta tester'); renderBeta(main); }
        catch (err) { toast(explain(err)); }
      } }, 'Togli')))))));
}

// ------------------------------------------------------------------ crediti di un utente (nel pannello utente)
const eur = (n) => (+n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const num = (n) => { const v = Math.round(+n || 0); return (v < 0 ? '-' : '') + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
const KIND = { welcome: 'Benvenuto', gift: 'Regalo', grant: 'Accredito', purchase: 'Acquisto', charge: 'Uso AI', refund: 'Rimborso', settle: 'Conguaglio', adjust: 'Correzione', monthly: 'Crediti del mese', expire: 'Scaduti' };
function creditsBox(uid) {
  const box = el('section', { class: 'crbox' }, el('h3', null, 'Crediti'), el('div', { class: 'loading' }, 'Caricamento…'));
  const paint = (r) => {
    const w = r.wallet || { balance: 0, monthly: 0, plan: 'free' };
    const plans = (r.plans || []).filter((p) => p.id !== 'free');
    const amt = el('input', { class: 'search', type: 'number', step: '1', placeholder: 'es. 500', style: 'width:110px' });
    const why = el('input', { class: 'search', placeholder: 'Motivo (facoltativo)', style: 'flex:1;min-width:140px' });
    const pl = el('select', { class: 'search', style: 'width:auto' }, ...plans.map((p) => el('option', { value: p.id }, p.name + ' · ' + eur(p.price_eur))));
    const months = el('select', { class: 'search', style: 'width:auto' }, ...[1, 2, 3, 6, 12].map((m) => el('option', { value: String(m) }, m + (m === 1 ? ' mese' : ' mesi'))));
    const act = async (arg, msg) => { try { paint(await sql('credits', { user_id: uid, ...arg })); toast(msg); } catch (e) { toast(explain(e)); } };
    const planName = (plans.find((p) => p.id === w.plan) || {}).name || 'Gratis';
    rc(box, el('h3', null, 'Crediti'),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', null, 'Totale'), el('b', null, num((+w.monthly || 0) + (+w.balance || 0)))),
        el('div', { class: 'fact' }, el('span', null, 'Piano'), el('b', null, planName, w.plan !== 'free' && w.plan_until ? el('small', { class: 'muted' }, ' fino al ' + full(w.plan_until)) : null)),
        el('div', { class: 'fact' }, el('span', null, 'Del mese'), el('b', null, num(w.monthly), w.next_grant ? el('small', { class: 'muted' }, ' · rinnovo ' + full(w.next_grant)) : null)),
        el('div', { class: 'fact' }, el('span', null, 'Extra (non scadono)'), el('b', null, num(w.balance)))),
      !CAN('users_edit') ? null : el('div', { class: 'row wrap', style: 'margin-top:10px' }, amt, why,
        el('button', { class: 'btn sm primary', type: 'button', onclick: () => { const n = parseInt(amt.value, 10); if (!n) { toast('Scrivi quanti crediti'); return; } act({ op: 'gift', amount: n, note: why.value }, n > 0 ? 'Crediti regalati' : 'Crediti tolti'); } }, 'Regala crediti')),
      !CAN('users_edit') ? null : el('div', { class: 'row wrap', style: 'margin-top:8px' }, pl, months,
        el('button', { class: 'btn sm', type: 'button', onclick: () => act({ op: 'plan', plan: pl.value, months: +months.value }, 'Piano attivato') }, w.plan !== 'free' ? 'Cambia piano' : 'Attiva piano'),
        w.plan !== 'free' ? el('button', { class: 'btn sm bad', type: 'button', onclick: () => act({ op: 'cancel' }, 'Piano chiuso') }, 'Chiudi piano') : null),
      !CAN('users_edit') ? null : el('p', { class: 'muted', style: 'margin:6px 0 0;font-size:12px' }, 'Attivare un piano da qui è gratis per l\'utente (per prove e regali). Gli acquisti veri arrivano quando colleghiamo i pagamenti.'),
      (r.ledger || []).length ? el('details', { class: 'box', style: 'margin-top:10px' }, el('summary', null, 'Movimenti (' + r.ledger.length + ')'),
        ...r.ledger.map((l) => el('div', { class: 'ev' }, el('time', null, when(l.created_at)),
          el('span', null, KIND[l.kind] || l.kind, (l.meta && (l.meta.model || l.meta.note)) ? el('small', { class: 'muted' }, ' · ' + (l.meta.model || l.meta.note)) : null),
          el('b', { class: l.delta >= 0 ? 'pos' : 'neg' }, (l.delta > 0 ? '+' : '') + num(l.delta))))) : null);
  };
  sql('credits', { user_id: uid, op: 'get' }).then(paint).catch((e) => rc(box, el('h3', null, 'Crediti'), el('div', { class: 'err' }, explain(e))));
  return box;
}

// ------------------------------------------------------------------ crediti e offerte: listino modificabile + offerte lampo
// conti: IVA, commissione del pagamento, cambio $->€ e crediti per $ di costo (come la funzione "ai")
const ECO_DEF = { vat: 22, feeP: 5, feeF: 0.5, fx: 0.9, perUsd: 280 };
let ECO = { ...ECO_DEF };
try { ECO = { ...ECO_DEF, ...JSON.parse(localStorage.getItem('nf.admin.eco') || '{}') }; } catch (e) { /* */ }
function margin(price, credits) {
  price = +price || 0; credits = +credits || 0;
  const net = price / (1 + ECO.vat / 100), fee = price > 0 ? price * ECO.feeP / 100 + ECO.feeF : 0, keep = net - fee;
  const api = credits / ECO.perUsd * ECO.fx;
  const m = keep - api, m60 = keep - api * 0.6;
  const minPrice = (api + ECO.feeF) / (1 / (1 + ECO.vat / 100) - ECO.feeP / 100);
  return { net, fee, keep, api, m, m60, pct: keep > 0 ? m / keep * 100 : -100, minPrice };
}
function marginBox(price, credits, label) {
  const r = margin(price, credits);
  const cls = r.m < 0 ? 'bad' : r.pct < 25 ? 'warn' : 'ok';
  return el('div', { class: 'mbox ' + cls },
    el('div', { class: 'mrow' }, el('span', null, label || 'Ti resta (dopo IVA e commissioni)'), el('b', null, eur(r.keep))),
    el('div', { class: 'mrow' }, el('span', null, 'Costo API se usa tutti i crediti'), el('b', null, '− ' + eur(r.api))),
    el('div', { class: 'mrow tot' }, el('span', null, 'Margine'), el('b', null, eur(r.m) + (r.keep > 0 ? ' (' + Math.round(r.pct) + '%)' : ''))),
    el('div', { class: 'mrow sub' }, el('span', null, 'Se usa il 60% dei crediti'), el('b', null, eur(r.m60))),
    r.m < 0 ? el('div', { class: 'mnote' }, 'In perdita se l\'utente usa tutti i crediti. Prezzo minimo per non perdere: ' + eur(r.minPrice))
      : r.pct < 25 ? el('div', { class: 'mnote' }, 'Margine basso: va bene come promozione, non come prezzo fisso.') : null);
}
// segue i campi e ricalcola mentre scrivi
function liveMargin(get, label) {
  const slot = el('div');
  const upd = () => { const [p, c] = get(); rc(slot, marginBox(p, c, typeof label === 'function' ? label() : label)); };
  upd();
  return { slot, upd };
}
function ecoPanel(onChange) {
  const f = (k, lbl, step) => { const i = el('input', { class: 'search', type: 'number', step: step || '0.01', value: ECO[k] });
    i.addEventListener('input', () => { ECO[k] = +i.value || 0; try { localStorage.setItem('nf.admin.eco', JSON.stringify(ECO)); } catch (e) { /* */ } onChange(); });
    return el('label', { class: 'fld' }, el('span', null, lbl), i); };
  return el('details', { class: 'box eco' }, el('summary', null, 'Ipotesi dei conti (IVA ' + ECO.vat + '%, commissione ' + ECO.feeP + '% + ' + eur(ECO.feeF) + ', 1 $ = ' + ECO.fx + ' €)'),
    el('div', { class: 'fgrid' }, f('vat', 'IVA %', '1'), f('feeP', 'Commissione %', '0.1'), f('feeF', 'Commissione fissa €'), f('fx', 'Cambio: 1 $ in €'), f('perUsd', 'Crediti per 1 $ di costo', '1')),
    el('div', { class: 'row', style: 'margin-top:8px' }, el('button', { class: 'btn sm', type: 'button', onclick: () => { ECO = { ...ECO_DEF }; try { localStorage.removeItem('nf.admin.eco'); } catch (e) { /* */ } onChange(); } }, 'Valori iniziali'),
      el('small', { class: 'muted' }, '"Crediti per 1 $" deve restare uguale a quello del server (oggi 280).')));
}
const AUD = { all: 'Tutti', free: 'Solo utenti gratis', paid: 'Solo abbonati', new: 'Nuovi iscritti (7 giorni)' };
const toLocal = (iso) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
function renderShop(main) {
  S.stab = S.stab || 'offers';
  const tabs = el('div', { class: 'seg' }, ...[['offers', 'Offerte lampo'], ['plans', 'Piani'], ['packs', 'Ricariche']].map(([k, l]) =>
    el('button', { type: 'button', 'aria-pressed': String(S.stab === k), onclick: () => { S.stab = k; renderShop(main); } }, l)));
  const body = el('div', { class: 'body shop-body' });
  rc(main, head('Crediti e offerte', tabs), body);
  if (S.err) { rc(body, el('div', { class: 'err' }, S.err)); return; }
  if (!S.shop) { rc(body, el('div', { class: 'loading' }, 'Caricamento…')); return; }
  const save = async (op, item, msg) => { try { S.shop = await sql('catalog', { op, item }); toast(msg); renderShop(main); } catch (e) { toast(explain(e)); } };
  const eco = ecoPanel(() => renderShop(main));
  const planOf = (id) => (S.shop.plans || []).find((p) => p.id === id) || {};
  const st = S.shop.stats || {}, bp = st.byPlan || {};
  const stats = el('div', { class: 'cards shop-stats' },
    ...['free', 'starter', 'pro', 'ultimate'].map((k) => el('div', { class: 'card stat' }, el('b', null, num(bp[k] || 0)), el('span', null, k === 'free' ? 'Utenti gratis' : 'Abbonati ' + ((S.shop.plans.find((p) => p.id === k) || {}).name || k)))),
    el('div', { class: 'card stat' }, el('b', null, num(st.spent30)), el('span', null, 'Crediti usati in 30 giorni')),
    el('div', { class: 'card stat' }, el('b', null, num(st.gifted30)), el('span', null, 'Regalati in 30 giorni')));
  if (S.stab === 'offers') {
    const now = Date.now();
    const rows = (S.shop.offers || []).map((o) => {
      const live = o.active && new Date(o.starts_at) <= now && new Date(o.ends_at) > now;
      const status = !o.active ? ['no', 'Fermata'] : new Date(o.ends_at) <= now ? ['no', 'Finita'] : new Date(o.starts_at) > now ? ['queued', 'Programmata'] : ['done', 'In corso'];
      return el('tr', null,
        el('td', null, el('b', null, o.title), el('div', { class: 'muted', style: 'font-size:12px' }, o.kind === 'pack' ? num(o.credits) + ' crediti a vita' : 'Piano ' + o.plan_id + ' per ' + o.months + (o.months === 1 ? ' mese' : ' mesi'))),
        el('td', null, eur(o.price_eur), o.kind === 'plan' ? el('span', { class: 'muted' }, ' /mese') : null),
        (() => { const r = margin(o.price_eur, o.kind === 'pack' ? o.credits : planOf(o.plan_id).monthly);
          return el('td', { class: 'hide-m' }, el('span', { class: 'mtag ' + (r.m < 0 ? 'bad' : r.pct < 25 ? 'warn' : 'ok') }, eur(r.m) + (o.kind === 'plan' ? ' /mese' : ''))); })(),
        el('td', { class: 'hide-m' }, AUD[o.audience] || o.audience),
        el('td', null, full(o.ends_at)),
        el('td', { class: 'num hide-m' }, num(o.sold)),
        el('td', null, el('span', { class: 'pill ' + status[0] }, status[1])),
        el('td', { style: 'text-align:right;white-space:nowrap' },
          el('button', { class: 'btn sm', type: 'button', onclick: () => offerForm(o) }, 'Modifica'), ' ',
          live ? el('button', { class: 'btn sm bad', type: 'button', onclick: () => sql('catalog', { op: 'stop_offer', id: o.id }).then((r) => { S.shop = r; toast('Offerta fermata'); renderShop(main); }).catch((e) => toast(explain(e))) }, 'Ferma') : null));
    });
    rc(body, stats, eco,
      el('div', { class: 'row', style: 'justify-content:space-between;margin:18px 0 10px' }, el('p', { class: 'muted', style: 'margin:0' }, 'Le offerte compaiono subito nell\'app: banner in home e in "Crediti e piani", con il conto alla rovescia.'),
        el('button', { class: 'btn primary', type: 'button', onclick: () => offerForm(null) }, '+ Nuova offerta')),
      rows.length ? el('div', { class: 'tblwrap' }, el('table', { class: 'tbl' }, el('thead', null, el('tr', null, el('th', null, 'Offerta'), el('th', null, 'Prezzo'), el('th', { class: 'hide-m', 'data-tip': 'Margine se l\'utente usa tutti i crediti' }, 'Margine'), el('th', { class: 'hide-m' }, 'Per chi'), el('th', null, 'Scade'), el('th', { class: 'hide-m', style: 'text-align:right' }, 'Vendute'), el('th', null, 'Stato'), el('th', null, ''))), el('tbody', null, ...rows)))
        : el('div', { class: 'empty' }, 'Nessuna offerta. Creane una: crediti a vita a prezzo speciale, o un abbonamento scontato per i primi mesi.'));
  } else if (S.stab === 'plans') {
    const list = (S.shop.plans || []).filter((p) => p.id !== 'free');
    rc(body, stats, eco, el('p', { class: 'muted', style: 'margin:18px 0 10px' }, 'I prezzi cambiano subito per chi apre "Crediti e piani". Chi ha già un piano lo mantiene alle condizioni attuali fino al rinnovo.'),
      el('div', { class: 'shop-grid' }, ...list.map((p) => planCard(p)), planCard(null)));
  } else {
    const list = S.shop.packs || [];
    rc(body, stats, eco, el('p', { class: 'muted', style: 'margin:18px 0 10px' }, 'Le ricariche danno crediti che non scadono mai.'),
      el('div', { class: 'shop-grid' }, ...list.map((k) => packCard(k)), packCard(null)));
  }

  function field(label, input, hint) { return el('label', { class: 'fld' }, el('span', null, label), input, hint ? el('small', { class: 'muted' }, hint) : null); }
  function planCard(p) {
    const n = !p; p = p || { id: '', name: '', price_eur: '', monthly: '', max_pending: 6, premium: false, active: true, tagline: '', tagline_en: '', perks: [], perks_en: [], sort: 9 };
    const f = {
      id: el('input', { class: 'search', value: p.id, disabled: n ? null : true, placeholder: 'es. creator' }),
      name: el('input', { class: 'search', value: p.name }), price: el('input', { class: 'search', type: 'number', step: '0.01', value: p.price_eur }),
      monthly: el('input', { class: 'search', type: 'number', step: '1', value: p.monthly }), maxPending: el('input', { class: 'search', type: 'number', step: '1', value: p.max_pending }),
      tagline: el('input', { class: 'search', value: p.tagline || '' }), taglineEn: el('input', { class: 'search', value: p.tagline_en || '' }),
      perks: el('textarea', { class: 'note', rows: '3' }), perksEn: el('textarea', { class: 'note', rows: '3' }),
      premium: el('input', { type: 'checkbox', checked: p.premium ? true : null }), active: el('input', { type: 'checkbox', checked: p.active ? true : null }),
      sort: el('input', { class: 'search', type: 'number', step: '1', value: p.sort }),
    };
    f.perks.value = (p.perks || []).join('\n'); f.perksEn.value = (p.perks_en || []).join('\n');
    const lines = (t) => t.value.split('\n').map((x) => x.trim()).filter(Boolean);
    return el('div', { class: 'card shop-card' + (p.active ? '' : ' off') }, el('h2', null, n ? 'Nuovo piano' : p.name),
      el('div', { class: 'fgrid' }, n ? field('Codice (non si cambia)', f.id) : null, field('Nome', f.name), field('Prezzo al mese (€)', f.price), field('Crediti al mese', f.monthly),
        field('Generazioni insieme', f.maxPending), field('Ordine', f.sort)),
      field('Frase sotto il nome', f.tagline), field('In inglese', f.taglineEn),
      field('Vantaggi (uno per riga)', f.perks), field('Vantaggi in inglese', f.perksEn),
      (() => { const lm = liveMargin(() => [f.price.value, f.monthly.value], 'Ti resta ogni mese'); f.price.addEventListener('input', lm.upd); f.monthly.addEventListener('input', lm.upd); return lm.slot; })(),
      el('div', { class: 'row', style: 'gap:16px' }, el('label', { class: 'chk' }, f.premium, ' Modelli premium'), el('label', { class: 'chk' }, f.active, ' In vendita')),
      el('button', { class: 'btn primary sm', type: 'button', onclick: () => save('save_plan', { id: n ? f.id.value.trim().toLowerCase() : p.id, name: f.name.value.trim(), price: f.price.value, monthly: f.monthly.value,
        maxPending: f.maxPending.value, sort: f.sort.value, premium: f.premium.checked, active: f.active.checked, tagline: f.tagline.value.trim(), taglineEn: f.taglineEn.value.trim(), perks: lines(f.perks), perksEn: lines(f.perksEn) }, 'Piano salvato') }, n ? 'Crea piano' : 'Salva'));
  }
  function packCard(k) {
    const n = !k; k = k || { id: '', name: '', price_eur: '', credits: '', active: true, tagline: '', tagline_en: '', sort: 9 };
    const f = { id: el('input', { class: 'search', value: k.id, disabled: n ? null : true, placeholder: 'es. xl' }), name: el('input', { class: 'search', value: k.name }),
      price: el('input', { class: 'search', type: 'number', step: '0.01', value: k.price_eur }), credits: el('input', { class: 'search', type: 'number', step: '1', value: k.credits }),
      sort: el('input', { class: 'search', type: 'number', step: '1', value: k.sort }), active: el('input', { type: 'checkbox', checked: k.active ? true : null }) };
    return el('div', { class: 'card shop-card' + (k.active ? '' : ' off') }, el('h2', null, n ? 'Nuova ricarica' : k.name),
      el('div', { class: 'fgrid' }, n ? field('Codice', f.id) : null, field('Nome', f.name), field('Prezzo (€)', f.price), field('Crediti', f.credits), field('Ordine', f.sort)),
      (() => { const lm = liveMargin(() => [f.price.value, f.credits.value]); f.price.addEventListener('input', lm.upd); f.credits.addEventListener('input', lm.upd); return lm.slot; })(),
      el('label', { class: 'chk' }, f.active, ' In vendita'),
      el('button', { class: 'btn primary sm', type: 'button', onclick: () => save('save_pack', { id: n ? f.id.value.trim().toLowerCase() : k.id, name: f.name.value.trim(), price: f.price.value, credits: f.credits.value, sort: f.sort.value, active: f.active.checked }, 'Ricarica salvata') }, n ? 'Crea ricarica' : 'Salva'));
  }
  function offerForm(o) {
    const n = !o; o = o || { kind: 'pack', title: '', subtitle: '', title_en: '', subtitle_en: '', badge: '', credits: '', price_eur: '', plan_id: 'pro', months: 3, audience: 'all', per_user: 1, starts_at: new Date().toISOString(), ends_at: new Date(Date.now() + 48 * 3600e3).toISOString(), active: true };
    const plans = (S.shop.plans || []).filter((p) => p.id !== 'free');
    const f = {
      kind: el('select', { class: 'search' }, el('option', { value: 'pack' }, 'Crediti a vita (non scadono)'), el('option', { value: 'plan' }, 'Abbonamento scontato per X mesi')),
      title: el('input', { class: 'search', value: o.title, maxlength: '80', placeholder: 'es. 2.000 crediti a vita' }), subtitle: el('input', { class: 'search', value: o.subtitle || '', maxlength: '160', placeholder: 'es. Solo per 48 ore' }),
      titleEn: el('input', { class: 'search', value: o.title_en || '', maxlength: '80' }), subtitleEn: el('input', { class: 'search', value: o.subtitle_en || '', maxlength: '160' }),
      badge: el('input', { class: 'search', value: o.badge || '', maxlength: '24', placeholder: 'es. -40%' }),
      credits: el('input', { class: 'search', type: 'number', step: '1', value: o.credits || '' }), price: el('input', { class: 'search', type: 'number', step: '0.01', value: o.price_eur }),
      plan: el('select', { class: 'search' }, ...plans.map((p) => el('option', { value: p.id }, p.name + ' (di solito ' + eur(p.price_eur) + ')')) ),
      months: el('input', { class: 'search', type: 'number', min: '1', max: '24', step: '1', value: o.months || 3 }),
      audience: el('select', { class: 'search' }, ...Object.entries(AUD).map(([k, l]) => el('option', { value: k }, l))),
      perUser: el('input', { class: 'search', type: 'number', min: '1', step: '1', value: o.per_user || 1 }),
      starts: el('input', { class: 'search', type: 'datetime-local', value: toLocal(o.starts_at) }), ends: el('input', { class: 'search', type: 'datetime-local', value: toLocal(o.ends_at) }),
    };
    f.kind.value = o.kind; f.plan.value = o.plan_id || 'pro'; f.audience.value = o.audience;
    const packRow = el('div', { class: 'fgrid' }, field('Crediti', f.credits), field('Prezzo (€)', f.price));
    f.pprice = el('input', { class: 'search', type: 'number', step: '0.01', value: o.price_eur });
    const planRow = el('div', { class: 'fgrid' }, field('Piano', f.plan), field('Prezzo scontato al mese (€)', f.pprice), field('Per quanti mesi', f.months));
    const swap = () => { const pk = f.kind.value === 'pack'; packRow.style.display = pk ? '' : 'none'; planRow.style.display = pk ? 'none' : ''; };
    f.kind.addEventListener('change', swap);
    const bg = el('div', { class: 'modal-bg' });
    const close = () => bg.remove();
    const priceOf = () => (f.kind.value === 'pack' ? f.price : f.pprice).value;
    const lm = liveMargin(() => f.kind.value === 'pack' ? [f.price.value, f.credits.value] : [f.pprice.value, planOf(f.plan.value).monthly],
      () => f.kind.value === 'pack' ? undefined : 'Ti resta ogni mese (prezzo scontato)');
    [f.price, f.credits, f.pprice, f.plan, f.kind].forEach((x) => { x.addEventListener('input', lm.upd); x.addEventListener('change', lm.upd); });
    rc(bg, el('div', { class: 'modal shop-modal', role: 'dialog' }, el('h2', null, n ? 'Nuova offerta lampo' : 'Modifica offerta'),
      field('Tipo', f.kind), packRow, planRow, lm.slot,
      el('div', { class: 'fgrid' }, field('Titolo', f.title), field('Etichetta', f.badge, 'Appare in un angolo, es. -40%')),
      field('Sottotitolo', f.subtitle),
      el('details', null, el('summary', null, 'Testi in inglese (facoltativi)'), field('Titolo in inglese', f.titleEn), field('Sottotitolo in inglese', f.subtitleEn)),
      el('div', { class: 'fgrid' }, field('Inizia', f.starts), field('Finisce', f.ends)),
      el('div', { class: 'fgrid' }, field('Per chi', f.audience), field('Quante volte per utente', f.perUser)),
      el('div', { class: 'row', style: 'justify-content:flex-end;gap:8px' }, el('button', { class: 'btn', type: 'button', onclick: close }, 'Annulla'),
        el('button', { class: 'btn primary', type: 'button', onclick: async () => {
          const item = { id: n ? undefined : o.id, kind: f.kind.value, title: f.title.value.trim(), subtitle: f.subtitle.value.trim(), titleEn: f.titleEn.value.trim(), subtitleEn: f.subtitleEn.value.trim(),
            badge: f.badge.value.trim(), price: priceOf(), credits: f.kind.value === 'pack' ? f.credits.value : null, plan: f.kind.value === 'plan' ? f.plan.value : '',
            months: f.kind.value === 'plan' ? f.months.value : null, audience: f.audience.value, perUser: f.perUser.value,
            startsAt: new Date(f.starts.value).toISOString(), endsAt: new Date(f.ends.value).toISOString(), active: true };
          if (!item.title) { toast('Scrivi un titolo'); return; }
          if (!(+item.price >= 0) || item.price === '') { toast('Scrivi il prezzo'); return; }
          if (item.kind === 'pack' && !(+item.credits > 0)) { toast('Scrivi quanti crediti'); return; }
          await save('save_offer', item, n ? 'Offerta creata' : 'Offerta salvata'); close();
        } }, n ? 'Pubblica offerta' : 'Salva'))));
    bg.addEventListener('click', (e) => { if (e.target === bg) close(); });
    document.body.append(bg); swap(); f.title.focus();
  }
}

async function openUser(id) {
  document.querySelectorAll('.drawer, .drawer-bg').forEach((x) => x.remove());
  const bg = el('div', { class: 'drawer-bg', onclick: () => close() });
  const dr = el('aside', { class: 'drawer', role: 'dialog', 'aria-label': 'Utente' }, el('div', { class: 'loading' }, 'Caricamento…'));
  const close = () => { bg.remove(); dr.remove(); document.removeEventListener('keydown', esc); };
  const esc = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', esc);
  document.body.append(bg, dr);
  let d;
  try { d = await sql('user_detail', id); } catch (e) { rc(dr, el('div', { class: 'err' }, explain(e))); return; }
  paint(d);
  function paint(d) {
    const p = d.profile || {}, a = d.admin || {};
    const note = el('textarea', { class: 'note', placeholder: 'Note private su questo utente (le vede solo il team)' }); note.value = a.note || '';
    const reason = el('input', { class: 'search', style: 'width:100%', placeholder: 'Motivo (lo vede l\'utente)', value: a.blocked_reason || '' });
    const save = async (patch, msg) => {
      try { const nd = await sql('set_user', { id, ...patch }); toast(msg); paint(nd); S.users = null; if (S.view === 'users') load('users', true); }
      catch (e) { toast(explain(e)); }
    };
    const maxF = Math.max(1, ...(d.features || []).map((f) => f.n));
    rc(dr, 
      el('div', { class: 'top' }, avatar({ name: p.name, email: p.email, avatar: p.avatar_url, photo: d.photo ? 'data:' + d.photo.mime + ';base64,' + d.photo.data : '' }), el('div', { class: 'grow' }, el('h2', null, p.name || p.email || 'Utente'), el('div', { class: 'muted' }, [p.username ? '@' + p.username : 'nome utente non scelto', p.email].filter(Boolean).join(' · '))),
        a.blocked ? el('span', { class: 'pill bad' }, 'Bloccato') : null, el('button', { class: 'btn sm', type: 'button', onclick: close }, 'Chiudi')),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', null, 'ID NoonFrame'), el('b', null, nid(p.nuvora_id) || '—')), el('div', { class: 'fact' }, el('span', null, 'Nome utente'), el('b', null, p.username ? '@' + p.username : '—')),
        el('div', { class: 'fact' }, el('span', null, 'Iscritto'), el('b', null, full(p.created_at))), el('div', { class: 'fact' }, el('span', null, 'Ultimo accesso'), el('b', null, p.last_seen_at ? full(p.last_seen_at) : '—')),
        el('div', { class: 'fact' }, el('span', null, 'Accesso con'), el('b', null, p.provider === 'google' ? 'Google' : p.provider === 'email' ? 'Codice email' : (p.provider || '—'))),
        el('div', { class: 'fact' }, el('span', null, 'Lingua'), el('b', null, p.lang === 'en' ? 'Inglese' : p.lang === 'it' ? 'Italiano' : (p.lang || '—')))),
      el('section', null, el('h3', null, 'Dispositivi (' + (d.devices || []).length + ')'),
        ...(d.devices || []).map((v) => el('div', { class: 'dev' }, el('span', null, el('b', null, PLAT[v.platform] || v.platform || '?'), ' · ', v.os || '', v.machine ? ' · ' + v.machine : '', v.gpu ? ' · NVIDIA' : ''),
          el('span', { class: 'muted' }, 'v' + (v.app_version || '?') + ' · ' + when(v.last_seen_at)))),
        (d.devices || []).length ? null : el('p', { class: 'muted' }, 'Nessun dispositivo')),
      el('section', null, el('h3', null, 'Funzioni usate'), (d.features || []).length
        ? el('div', { class: 'bars' }, ...d.features.map((f) => el('div', { class: 'bar-r', title: 'Ultima volta: ' + full(f.last) }, el('span', null, fname(f.name)), el('span', { class: 'track' }, el('i', { style: 'width:' + Math.max(2, f.n / maxF * 100) + '%' })), el('b', null, f.n))))
        : el('p', { class: 'muted' }, 'Ancora niente')),
      el('details', { class: 'box' }, el('summary', null, 'Attività recente'), ...(d.recent || []).map((e) => el('div', { class: 'ev' }, el('time', null, when(e.at)), el('span', null, fname(e.name), e.props && e.props.status && e.props.status !== 'done' ? ' (' + e.props.status + ')' : '', e.props && e.props.sec ? ' · ' + Math.round(e.props.sec) + ' s' : '')))),
      el('section', null, el('h3', null, 'Segnalazioni (' + (d.reports || []).length + ')'),
        ...(d.reports || []).map((r) => el('div', { class: 'dev' }, el('button', { class: 'linkish', type: 'button', style: 'text-align:left;font-weight:500', onclick: () => { close(); S.rsel = r.id; S.rtab = 'all'; go('reports'); } }, r.text || '(senza testo)'), statusPill(r.status))),
        (d.reports || []).length ? null : el('p', { class: 'muted' }, 'Nessuna')),
      creditsBox(id),
      !CAN('users_edit') ? null : el('section', null, el('h3', null, 'Note'), note, el('div', { class: 'row', style: 'margin-top:8px' }, el('button', { class: 'btn sm', type: 'button', onclick: () => save({ note: note.value }, 'Nota salvata') }, 'Salva nota'))),
      !CAN('users_edit') ? null : el('section', { class: 'blockbox' }, el('h3', { style: 'margin:0' }, a.blocked ? 'Account bloccato' : 'Blocca l\'account'),
        el('p', { class: 'muted', style: 'margin:0' }, a.blocked ? 'Dal ' + full(a.blocked_at) + '. Sbloccandolo può tornare a usare NoonFrame al prossimo controllo.' : 'Al prossimo controllo (entro 30 minuti, o subito all\'apertura) l\'app mostra "Account sospeso" e non si può usare.'),
        a.blocked ? null : reason,
        el('div', { class: 'row' }, a.blocked
          ? el('button', { class: 'btn', type: 'button', onclick: () => save({ blocked: false }, 'Account sbloccato') }, 'Sblocca')
          : el('button', { class: 'btn bad', type: 'button', onclick: () => save({ blocked: true, reason: reason.value }, 'Account bloccato') }, 'Blocca'))));
  }
}

// ------------------------------------------------------------------ segnalazioni
const RTABS = [['nuova', 'Da decidere'], ['coda', 'In coda'], ['fatta', 'Fatte'], ['rifiutata', 'Rifiutate'], ['all', 'Tutte']];
const inTab = (r, t) => t === 'all' || (t === 'coda' ? ['approvata', 'in_lavorazione'].includes(r.status) : t === 'rifiutata' ? ['rifiutata', 'chiusa'].includes(r.status) : r.status === t);
function statusPill(st, r) {
  const m = { nuova: ['new', 'Da decidere'], approvata: ['queued', 'Approvata'], in_lavorazione: ['queued', 'In lavorazione'], fatta: ['done', 'Fatta'], rifiutata: ['no', 'Rifiutata'], chiusa: ['no', 'Chiusa'] }[st] || ['no', st];
  if (st === 'nuova' && r && r.question) return el('span', { class: 'pill new' }, 'Domanda per te');
  return el('span', { class: 'pill ' + m[0] }, st === 'fatta' && r && r.done_version ? 'Fatta · ' + r.done_version : m[1]);
}
function renderReports(main) {
  const list = S.reports || [];
  const q = el('input', { class: 'search', type: 'search', placeholder: 'Cerca nel testo o per persona', value: S.rq, 'aria-label': 'Cerca segnalazioni' });
  q.addEventListener('input', () => { S.rq = q.value; paintList(); });
  const seg = el('div', { class: 'seg' }, ...RTABS.map(([k, l]) => el('button', { type: 'button', 'aria-pressed': String(S.rtab === k), onclick: () => { S.rtab = k; S.rsel = null; renderReports(main); } }, l, el('i', null, list.filter((r) => inTab(r, k)).length))));
  const listEl = el('div', { class: 'list' });
  const det = el('section', { class: 'detail' });
  const split = el('div', { class: 'body split' + (S.rsel ? ' open' : '') }, el('aside', { class: 'side' }, el('div', { class: 'filters' }, q), listEl), det);
  rc(main, head('Segnalazioni', seg, CAN('reports_decide') ? el('button', { class: 'btn primary', type: 'button', onclick: newRequest }, '＋ Nuova richiesta') : null), S.err ? el('div', { class: 'err' }, S.err) : null, split);
  const visible = () => { const t = S.rq.trim().toLowerCase(); return list.filter((r) => inTab(r, S.rtab) && (!t || ((r.text || '') + ' ' + (r.who || '') + ' ' + (r.email || '')).toLowerCase().includes(t))); };
  function paintList() {
    if (!S.reports) { rc(listEl, el('div', { class: 'loading' }, 'Caricamento…')); return; }
    const rows = visible();
    if (!S.rsel && rows.length && innerWidth > 900) S.rsel = rows[0].id;
    rc(listEl, ...(rows.length ? rows.map((r) => el('button', { class: 'item ' + r.kind, type: 'button', 'aria-current': String(r.id === S.rsel), onclick: () => { S.rsel = r.id; split.classList.add('open'); paintList(); paintDetail(); } },
      el('span', { class: 'dot' }), el('span', null, el('span', { class: 't' }, r.text || '(senza testo)'),
        el('span', { class: 'm' }, statusPill(r.status, r), el('span', null, r.who), '·', el('span', null, when(r.created_at)), r.app_version ? el('span', null, '· ' + r.app_version) : null))))
      : [el('div', { class: 'empty' }, S.rtab === 'nuova' ? 'Niente da decidere. Tutto in pari.' : 'Nessuna voce qui.')]));
  }
  async function paintDetail() {
    const r0 = (S.reports || []).find((x) => x.id === S.rsel);
    if (!r0) { rc(det, el('div', { class: 'empty' }, 'Scegli una segnalazione a sinistra.')); return; }
    let r = S.rdet[r0.id];
    if (!r) {
      rc(det, el('div', { class: 'loading' }, 'Caricamento…'));
      try { r = await sql('report_detail', r0.id); S.rdet[r0.id] = r; } catch (e) { rc(det, el('div', { class: 'err' }, explain(e))); return; }
      if (S.rsel !== r0.id) return;
    }
    const imgs = (r.images || []).filter((i) => /^image\/(png|jpeg|webp)$/.test(i.mime || '') && /^[A-Za-z0-9+/=]+$/.test(i.data || '')).map((i) => 'data:' + i.mime + ';base64,' + i.data);
    const sys = r.system || {};
    const note = el('textarea', { class: 'note', id: 'rnote', placeholder: r.status === 'fatta' ? 'Qualcosa non va ancora? Scrivilo e riapri.' : 'Nota per Claude (facoltativa): come la vuoi, dove, cosa evitare…' });
    note.value = S.drafts[r.id] ?? (r.decision_note || '');
    note.addEventListener('input', () => { S.drafts[r.id] = note.value; });
    const decide = async (status) => {
      try {
        const nd = await sql('set_report', { id: r.id, status, note: note.value.trim() });
        delete S.drafts[r.id];
        S.rdet[r.id] = { ...r, ...nd, images: r.images };
        const i = S.reports.findIndex((x) => x.id === r.id); if (i >= 0) S.reports[i] = { ...S.reports[i], status: nd.status, question: nd.question };
        toast(status === 'approvata' ? (r.status === 'fatta' ? 'Riaperta: Claude la riprende' : 'Approvata') : status === 'rifiutata' ? 'Rifiutata' : 'Rimessa da decidere');
        if (S.rtab !== 'all') { const next = visible().find((x) => x.id !== r.id && inTab(x, S.rtab)); S.rsel = next ? next.id : null; }
        load('overview'); paintList(); paintDetail();
        const segBtns = main.querySelectorAll('.head .seg button i'); RTABS.forEach(([k], j) => { if (segBtns[j]) segBtns[j].textContent = S.reports.filter((x) => inTab(x, k)).length; });
      } catch (e) { toast(explain(e)); }
    };
    const st = r.status;
    rc(det, 
      el('div', { class: 'dwrap' },
        el('button', { class: 'btn back', type: 'button', onclick: () => { split.classList.remove('open'); S.rsel = null; paintList(); } }, '‹ Elenco'),
        el('div', { class: 'dhead' }, el('span', { class: 'kind ' + r.kind }, r.kind === 'bug' ? 'BUG' : r.kind === 'idea' ? 'IDEA' : 'RICHIESTA'),
          r.user_id ? el('button', { class: 'linkish', type: 'button', onclick: () => openUser(r.user_id) }, r.who) : el('b', null, r.who),
          r.internal ? el('span', { class: 'pill no' }, 'interna') : null, el('span', { class: 'muted' }, full(r.created_at)), statusPill(st, r)),
        el('p', { class: 'quote' }, r.text || '(senza testo)'),
        el('div', { class: 'meta' }, r.app_version ? el('span', null, el('b', null, 'App'), r.app_version) : null, r.os ? el('span', null, el('b', null, 'Sistema'), r.os + (sys.machine ? ' · ' + sys.machine : '')) : null,
          sys.gpu != null ? el('span', null, el('b', null, 'GPU'), sys.gpu ? 'NVIDIA' : 'no') : null, r.screen ? el('span', null, el('b', null, 'Schermata'), r.screen) : null,
          r.contact ? el('span', null, el('b', null, 'Contatto'), r.contact) : null, r.email ? el('span', null, el('b', null, 'Email'), r.email) : null),
        imgs.length ? el('div', { class: 'shots' }, ...imgs.map((u) => el('button', { type: 'button', onclick: () => lightbox(u) }, el('img', { src: u, alt: 'Screenshot', loading: 'lazy' })))) : null,
        r.question && !['fatta', 'chiusa'].includes(st) ? el('div', { class: 'box ask' }, el('h3', null, 'Claude ti chiede'), el('p', null, r.question)) : null,
        CAN('reports_decide') ? replyBox(r) : null,
        r.done_note ? el('div', { class: 'box done' }, el('h3', null, r.done_version ? 'Fatto nella ' + r.done_version : 'Cosa è stato fatto'), el('p', null, r.done_note)) : null,
        (r.errors || []).length ? el('details', { class: 'box' }, el('summary', null, 'Errori (' + r.errors.length + ')'), el('pre', null, r.errors.join('\n\n'))) : null,
        r.log ? el('details', { class: 'box' }, el('summary', null, 'Log'), el('pre', null, r.log.split('\n').filter((l) => !/^\[(http|media)\]/.test(l)).slice(-80).join('\n'))) : null),
      !CAN('reports_decide') ? (CAN('tasks') ? el('div', { class: 'act' }, el('div', { class: 'act-in' }, el('div', { class: 'row' }, taskFromReport(r)))) : null) :
      el('div', { class: 'act' }, el('div', { class: 'act-in' }, note, el('div', { class: 'row' },
        st === 'fatta' || st === 'chiusa'
          ? el('button', { class: 'btn', type: 'button', onclick: () => decide('approvata') }, 'Riapri con la nota')
          : [el('button', { class: 'btn good', type: 'button', onclick: () => decide('approvata') }, st === 'nuova' ? 'Approva' : 'Aggiorna la nota', el('kbd', null, 'A')),
             st !== 'rifiutata' ? el('button', { class: 'btn bad', type: 'button', onclick: () => decide('rifiutata') }, 'Rifiuta', el('kbd', null, 'R')) : null,
             st !== 'nuova' ? el('button', { class: 'btn', type: 'button', onclick: () => decide('nuova') }, 'Rimetti da decidere') : null],
        el('span', { class: 'grow' }), CAN('tasks') ? taskFromReport(r) : null,
        el('span', { class: 'act-state' }, st === 'approvata' ? 'Claude la prende al prossimo giro.' : st === 'in_lavorazione' ? 'Claude ci sta lavorando.' : st === 'rifiutata' ? 'Non verrà fatta.' : '')))));
  }
  RENDER_DETAIL = paintDetail; LIST_ROWS = visible;
  paintList(); paintDetail();
}
let RENDER_DETAIL = null, LIST_ROWS = null;

function newRequest() {
  let kind = 'richiesta';
  const ta = el('textarea', { class: 'note', style: 'min-height:140px', placeholder: 'Cosa vuoi che Claude faccia? Più dettagli metti, meno domande ti farà.' });
  const seg = el('div', { class: 'seg' });
  const paint = () => rc(seg, ...[['richiesta', 'Modifica o idea'], ['bug', 'Problema']].map(([k, l]) => el('button', { type: 'button', 'aria-pressed': String(kind === k), onclick: () => { kind = k; paint(); } }, l)));
  paint();
  const bg = el('div', { class: 'modal-bg', onclick: (e) => { if (e.target === bg) bg.remove(); } }, el('div', { class: 'modal', role: 'dialog', 'aria-label': 'Nuova richiesta' },
    el('h2', null, 'Nuova richiesta'), seg, ta,
    el('div', { class: 'row' }, el('span', { class: 'muted' }, 'Parte già approvata.'), el('span', { class: 'grow' }), el('button', { class: 'btn', type: 'button', onclick: () => bg.remove() }, 'Annulla'),
      el('button', { class: 'btn primary', type: 'button', onclick: async (e) => {
        const text = ta.value.trim(); if (!text) { ta.focus(); return; }
        e.currentTarget.disabled = true;
        try { const id = await sql('create_request', { text, kind }); bg.remove(); toast('Richiesta inviata a Claude'); S.rtab = 'coda'; S.rsel = id; await load('reports', true); load('overview'); }
        catch (x) { e.currentTarget.disabled = false; toast(explain(x)); }
      } }, 'Invia a Claude'))));
  document.body.append(bg); ta.focus();
}

document.addEventListener('keydown', (e) => {
  if (S.view !== 'reports' || e.target.closest('textarea, input') || e.metaKey || e.ctrlKey || e.altKey || document.querySelector('.modal-bg, .lightbox, .drawer')) return;
  const rows = LIST_ROWS ? LIST_ROWS() : []; const i = rows.findIndex((r) => r.id === S.rsel);
  if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); if (rows[i + 1]) { S.rsel = rows[i + 1].id; renderReports($('#main')); } }
  else if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); if (i > 0) { S.rsel = rows[i - 1].id; renderReports($('#main')); } }
  else if ((e.key === 'a' || e.key === 'r') && CAN('reports_decide') && i >= 0 && !['fatta', 'chiusa'].includes(rows[i].status)) { const b = [...document.querySelectorAll('.act .btn')].find((x) => x.textContent.startsWith(e.key === 'a' ? 'Approva' : 'Rifiuta')); if (b) b.click(); }
});

// ------------------------------------------------------------------ lancio: numeri dei primi giorni contro gli obiettivi
const GOALS = [
  ['downloads', 'Download', 'n'], ['accounts', 'Account creati', 'n'], ['activation', 'Attivazione', '%'],
  ['d7', 'Tornano dopo 7 giorni', '%'], ['wau', 'Attivi in una settimana', 'n'], ['paid', 'Abbonati', 'n'],
];
const ST_LABEL = { early: 'Appena iniziato', ok: 'In linea', warn: 'Un po\' indietro', bad: 'Indietro', few: 'Pochi dati', done: 'Raggiunto', wait: 'Non ancora iniziato' };
const shortDay = (d) => new Date(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
function renderLaunch(main) {
  const L = S.launch;
  const body = el('div', { class: 'body' });
  rc(main, head('Lancio', L ? el('button', { class: 'btn', type: 'button', onclick: () => launchGoals(main) }, 'Obiettivi e data') : null), body);
  if (S.err) { rc(body, el('div', { class: 'err' }, S.err)); return; }
  if (!L) { rc(body, el('div', { class: 'loading' }, 'Caricamento…')); return; }
  const t = L.targets || {};
  const started = L.day_n > 0, dayN = Math.min(L.day_n, L.days), frac = Math.max(dayN, 1) / L.days, daysLeft = Math.max(1, L.days - dayN);
  const dl = (L.dl.win || 0) + (L.dl.mac || 0);
  const end = new Date(new Date(L.date).getTime() + (L.days - 1) * 864e5);
  // conteggi: confronto con il ritmo che serve oggi per arrivare all'obiettivo alla fine
  const pace = (v, target) => {
    if (!target) return { st: null };
    if (!started) return { st: 'wait' };
    if (v >= target) return { st: 'done', hint: 'Obiettivo raggiunto' };
    if (dayN < 3) return { st: 'early', hint: 'Il ritmo si vede dal terzo giorno', expected: target * frac };
    const r = v / (target * frac);
    return { st: r >= 0.95 ? 'ok' : r >= 0.6 ? 'warn' : 'bad', hint: 'Servono circa ' + num(Math.ceil((target - v) / daysLeft)) + ' al giorno', expected: target * frac };
  };
  const rate = (x, target) => {
    const pct = x.of ? Math.round(x.ok / x.of * 100) : null;
    if (!started) return { pct, st: 'wait' };
    if (x.of < 10) return { pct, st: 'few', hint: x.of ? 'Diventa affidabile da 10 persone (ora ' + x.of + ')' : 'Ancora nessuno da misurare' };
    return { pct, st: pct >= target ? 'ok' : pct >= target * 0.7 ? 'warn' : 'bad', hint: x.ok + ' su ' + x.of };
  };
  const card = (label, value, unit, target, p, detail) => {
    const pctOfGoal = target ? Math.min(100, (unit === '%' ? (value || 0) : value) / target * 100) : 0;
    return el('div', { class: 'goal ' + (p.st || '') },
      el('div', { class: 'goal-top' }, el('span', null, label), p.st ? el('span', { class: 'gst ' + p.st }, ST_LABEL[p.st]) : null),
      el('b', { class: 'goal-v' }, value == null ? '—' : num(value) + (unit === '%' ? '%' : '')),
      el('div', { class: 'goal-bar', role: 'img', 'aria-label': Math.round(pctOfGoal) + '% dell\'obiettivo' }, el('i', { style: 'width:' + pctOfGoal + '%' }),
        p.expected && unit !== '%' ? el('span', { class: 'tick', style: 'left:' + Math.min(100, p.expected / target * 100) + '%', title: 'Dove dovresti essere oggi' }) : null),
      el('div', { class: 'goal-foot' }, el('span', null, 'Obiettivo ' + num(target) + (unit === '%' ? '%' : '')), el('span', null, p.hint || '')),
      detail ? el('small', { class: 'goal-d' }, detail) : null);
  };
  const act = rate(L.activation, t.activation || 0), ret = rate(L.d7, t.d7 || 0);
  const steps = [['Download', dl], ['Account creati', L.accounts], ['Hanno esportato un video', L.activation.ok], ['Abbonati', L.paid]];
  rc(body, el('div', { class: 'ov' },
    el('div', { class: 'lhead' },
      el('div', null, el('b', null, started ? 'Giorno ' + dayN + ' di ' + L.days : 'Il lancio parte il ' + shortDay(L.date)),
        el('span', { class: 'muted' }, ' · dal ' + shortDay(L.date) + ' al ' + shortDay(end))),
      el('div', { class: 'lprog' }, el('i', { style: 'width:' + (started ? dayN / L.days * 100 : 0) + '%' }))),
    el('div', { class: 'goals' },
      card('Download', dl, 'n', t.downloads, pace(dl, t.downloads), 'Windows ' + num(L.dl.win) + ' · Mac ' + num(L.dl.mac)),
      card('Account creati', L.accounts, 'n', t.accounts, pace(L.accounts, t.accounts), dl ? Math.round(L.accounts / dl * 100) + '% di chi scarica crea l\'account' : null),
      card('Attivazione', act.pct, '%', t.activation, act, 'Nuovi account che esportano un video nella prima settimana'),
      card('Tornano dopo 7 giorni', ret.pct, '%', t.d7, ret, 'Riaprono l\'app almeno una settimana dopo l\'iscrizione'),
      card('Attivi in una settimana', L.wau, 'n', t.wau, pace(L.wau, t.wau), 'Persone che hanno usato l\'app negli ultimi 7 giorni'),
      card('Abbonati', L.paid, 'n', t.paid, pace(L.paid, t.paid), L.mrr ? 'Circa ' + eur(L.mrr) + ' al mese (IVA inclusa)' : 'I pagamenti non sono ancora attivi')),
    el('div', { class: 'cards' },
      el('div', { class: 'card chart' }, el('h2', null, 'Giorno per giorno',
        el('span', { class: 'leg' }, el('span', null, el('i', { style: 'background:var(--c2)' }), 'Download'), el('span', null, el('i', { style: 'background:var(--c1)' }), 'Account'), el('span', null, el('i', { style: 'background:var(--ok)' }), 'Attivi'))),
        launchChart(L)),
      el('div', { class: 'card' }, el('h2', null, 'Dal download all\'abbonamento'), funnel(steps))),
    el('div', { class: 'cards' },
      el('div', { class: 'card' }, el('h2', null, 'Segnalazioni dal lancio'), el('div', { class: 'minis' },
        el('div', null, el('b', null, num(L.reports.all)), el('span', null, 'ricevute')), el('div', null, el('b', null, num(L.reports.bugs)), el('span', null, 'bug')),
        el('div', null, el('b', { class: L.reports.open ? 'warn' : '' }, num(L.reports.open)), el('span', null, 'aperte')), el('div', null, el('b', null, num(L.reports.done)), el('span', null, 'risolte')))),
      el('div', { class: 'card' }, el('h2', null, 'Nuovi computer per sistema'), barList(Object.entries(L.platforms || {}).map(([k, v]) => [PLAT[k] || k, v])))),
    el('p', { class: 'muted fine' }, 'I download arrivano da GitHub ogni ora' + (L.dl.checked ? ' (ultimo controllo ' + when(L.dl.checked) + ')' : '') + '. '
      + (L.dl.has_base ? '' : 'Prima del lancio non c\'era un conteggio, quindi includono anche i ' + num(L.dl.all_time) + ' download di prova fatti finora. ')
      + 'Non raccogliamo niente di chi visita il sito.')));
}
function funnel(steps) {
  const top = Math.max(1, steps[0][1]);
  return el('div', { class: 'funnel' }, ...steps.map(([label, n], i) => el('div', { class: 'fn-r' },
    el('div', { class: 'fn-l' }, el('span', null, label), el('b', null, num(n)),
      i ? el('small', null, steps[i - 1][1] ? Math.round(n / steps[i - 1][1] * 100) + '% del passo prima' : '—') : null),
    el('span', { class: 'fn-t' }, el('i', { style: 'width:' + Math.max(1.5, n / top * 100) + '%' })))));
}
function launchChart(L) {
  const W = 600, H = 200, P = { l: 28, r: 8, t: 10, b: 22 };
  const s = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Download, account e utenti attivi per giorno' });
  const byDay = Object.fromEntries((L.series || []).map((d) => [String(d.d).slice(0, 10), d]));
  const days = [...Array(L.days)].map((_, i) => { const d = new Date(new Date(L.date).getTime() + i * 864e5).toISOString().slice(0, 10); return byDay[d] || { d, dl: null, accounts: 0, active: 0, future: true }; });
  const max = Math.max(1, ...days.map((d) => Math.max(d.dl || 0, d.accounts || 0, d.active || 0)));
  const nice = max <= 4 ? 4 : Math.ceil(max / 4) * 4;
  const step = (W - P.l - P.r) / days.length;
  const x = (i) => P.l + (i + 0.5) * step, y = (v) => H - P.b - v / nice * (H - P.t - P.b);
  for (let k = 0; k <= 4; k++) {
    const v = nice * k / 4, yy = y(v);
    s.append(svgEl('line', { x1: P.l, x2: W - P.r, y1: yy, y2: yy, stroke: 'rgba(160,180,220,.1)' }));
    const tx = svgEl('text', { x: P.l - 6, y: yy + 3, 'text-anchor': 'end', fill: '#6F7A8E', 'font-size': 10 }); tx.textContent = Math.round(v); s.append(tx);
  }
  const bw = Math.max(1.5, step * 0.34);
  days.forEach((d, i) => {
    if (d.future) s.append(svgEl('rect', { x: x(i) - step / 2, y: P.t, width: step, height: H - P.t - P.b, fill: 'rgba(160,180,220,.025)' }));
    if (d.dl) s.append(svgEl('rect', { x: x(i) - bw - 0.5, y: y(d.dl), width: bw, height: y(0) - y(d.dl), rx: 1.5, fill: '#6EA5FF' }));
    if (d.accounts) s.append(svgEl('rect', { x: x(i) + 0.5, y: y(d.accounts), width: bw, height: y(0) - y(d.accounts), rx: 1.5, fill: '#1E6BFF' }));
    if (i % 7 === 0 || (i === days.length - 1 && i % 7 >= 4)) { const tx = svgEl('text', { x: x(i), y: H - 6, 'text-anchor': 'middle', fill: '#6F7A8E', 'font-size': 10 }); tx.textContent = shortDay(d.d); s.append(tx); }
  });
  const past = days.filter((d) => !d.future);
  if (past.length > 1) s.append(svgEl('polyline', { points: past.map((d, i) => x(i) + ',' + y(d.active || 0)).join(' '), fill: 'none', stroke: '#34D399', 'stroke-width': 2, 'stroke-linejoin': 'round' }));
  if (past.length) { const i = past.length - 1; s.append(svgEl('circle', { cx: x(i), cy: y(past[i].active || 0), r: 3.5, fill: '#34D399' })); }
  return s;
}
function launchGoals(main) {
  const L = S.launch, t = L.targets || {};
  const date = el('input', { class: 'search', type: 'date', value: String(L.date).slice(0, 10) });
  const days = el('select', { class: 'search' }, ...[30, 45, 60, 90].map((d) => el('option', { value: String(d), selected: d === L.days }, d + ' giorni')));
  const inputs = {};
  const f = (k, label, hint) => { inputs[k] = el('input', { class: 'search', type: 'number', min: '0', step: '1', value: t[k] ?? '' }); return el('label', { class: 'fld' }, el('span', null, label), inputs[k], hint ? el('small', { class: 'muted' }, hint) : null); };
  const bg = el('div', { class: 'modal-bg', onclick: (e) => { if (e.target === bg) bg.remove(); } }, el('div', { class: 'modal shop-modal', role: 'dialog', 'aria-label': 'Obiettivi del lancio' },
    el('h2', null, 'Obiettivi del lancio'),
    el('p', { class: 'muted', style: 'margin:0' }, 'Sono gli obiettivi da raggiungere alla fine del periodo. Ogni giorno il pannello ti dice se sei in linea.'),
    el('div', { class: 'fgrid' }, el('label', { class: 'fld' }, el('span', null, 'Giorno del lancio'), date), el('label', { class: 'fld' }, el('span', null, 'Durata'), days)),
    el('div', { class: 'fgrid' }, f('downloads', 'Download'), f('accounts', 'Account creati'), f('activation', 'Attivazione %', 'esportano un video'), f('d7', 'Tornano dopo 7 giorni %'), f('wau', 'Attivi in una settimana'), f('paid', 'Abbonati')),
    el('div', { class: 'row' }, el('span', { class: 'grow' }), el('button', { class: 'btn', type: 'button', onclick: () => bg.remove() }, 'Annulla'),
      el('button', { class: 'btn primary', type: 'button', onclick: async (e) => {
        e.currentTarget.disabled = true;
        const targets = Object.fromEntries(Object.entries(inputs).map(([k, i]) => [k, Math.max(0, +i.value || 0)]));
        try { S.launch = await sql('launch_save', { date: date.value, days: +days.value, targets }); bg.remove(); toast('Obiettivi salvati'); renderLaunch(main); }
        catch (x) { e.currentTarget.disabled = false; toast(explain(x)); }
      } }, 'Salva'))));
  document.body.append(bg);
}

// ------------------------------------------------------------------ task del team
const TST = [['todo', 'Da fare'], ['doing', 'In corso'], ['review', 'Da controllare'], ['done', 'Fatte']];
const PRIO = [['0', 'Bassa'], ['1', 'Normale'], ['2', 'Alta']];
const AREAS_DEF = ['Sviluppo', 'Marketing', 'Design', 'Supporto', 'Contenuti'];
const personName = (email) => { if (!email) return ''; const p = ((S.tasks && S.tasks.people) || []).find((x) => x.email === email); return (p && p.name) || email.split('@')[0]; };
const initials = (email) => { const n = personName(email); return n.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase(); };
const dueInfo = (due, done) => {
  if (!due) return null;
  const d = new Date(due + 'T23:59:59'), days = Math.ceil((d - Date.now()) / 864e5);
  const late = !done && days < 0, soon = !done && days >= 0 && days <= 1;
  return { label: days === 0 ? 'Oggi' : days === 1 ? 'Domani' : shortDay(due), cls: late ? 'late' : soon ? 'soon' : '' };
};
function myOpenTasks() { return ((S.tasks && S.tasks.tasks) || []).filter((k) => k.assignee === (ME && ME.email) && k.status !== 'done').length; }
function renderTasks(main) {
  const T = S.tasks;
  const seg = el('div', { class: 'seg' }, ...[['all', 'Tutte'], ['mine', 'Mie'], ['none', 'Da assegnare']].map(([k, l]) =>
    el('button', { type: 'button', 'aria-pressed': String(S.tf === k), onclick: () => { S.tf = k; S.tp = ''; renderTasks(main); } }, l)));
  const who = el('select', { class: 'search', style: 'width:auto', 'aria-label': 'Filtra per persona' }, el('option', { value: '' }, 'Tutte le persone'),
    ...((T && T.people) || []).map((p) => el('option', { value: p.email, selected: S.tp === p.email }, p.name || p.email)));
  who.addEventListener('change', () => { S.tp = who.value; S.tf = 'all'; renderTasks(main); });
  const body = el('div', { class: 'body board-body' });
  rc(main, head('Task', seg, who, el('button', { class: 'btn primary', type: 'button', onclick: () => taskModal(null, {}, main) }, '＋ Nuova task')), body);
  if (S.err) { rc(body, el('div', { class: 'err' }, S.err)); return; }
  if (!T) { rc(body, el('div', { class: 'loading' }, 'Caricamento…')); return; }
  const show = (k) => (S.tf !== 'mine' || k.assignee === ME.email) && (S.tf !== 'none' || !k.assignee) && (!S.tp || k.assignee === S.tp);
  const tasks = T.tasks.filter(show);
  const board = el('div', { class: 'board' });
  for (const [st, label] of TST) {
    const items = tasks.filter((k) => k.status === st).sort((a, b) => st === 'done' ? String(b.done_at).localeCompare(String(a.done_at)) : a.sort - b.sort);
    const list = el('div', { class: 'col-list', 'data-st': st });
    rc(list, ...(items.length ? items.map((k) => taskCard(k, main)) : [el('div', { class: 'col-empty' }, st === 'todo' ? 'Niente da fare. Aggiungi una task.' : st === 'done' ? 'Le task finite restano qui 30 giorni.' : 'Trascina qui una task')]));
    list.addEventListener('dragover', (e) => { e.preventDefault(); list.classList.add('over'); });
    list.addEventListener('dragleave', (e) => { if (!list.contains(e.relatedTarget)) list.classList.remove('over'); });
    list.addEventListener('drop', (e) => { e.preventDefault(); list.classList.remove('over'); dropTask(+e.dataTransfer.getData('text/plain'), st, list, e.clientY, main); });
    board.append(el('section', { class: 'col ' + st, 'aria-label': label },
      el('div', { class: 'col-h' }, el('span', { class: 'cdot' }), el('b', null, label), el('i', null, items.length), el('span', { class: 'grow' }),
        st !== 'done' ? el('button', { class: 'btn sm ghost', type: 'button', title: 'Nuova task in "' + label + '"', 'aria-label': 'Nuova task in ' + label, onclick: () => taskModal(null, { status: st }, main) }, '＋') : null),
      list));
  }
  rc(body, board);
}
function taskCard(k, main) {
  const due = dueInfo(k.due, k.status === 'done');
  const c = el('button', { class: 'tk' + (k.priority === 2 ? ' hi' : ''), type: 'button', draggable: 'true', 'data-id': k.id, onclick: () => taskModal(k, {}, main) },
    el('span', { class: 'tk-t' }, k.title),
    el('span', { class: 'tk-m' },
      k.priority === 2 ? el('span', { class: 'chip hi' }, 'Alta') : null,
      k.area ? el('span', { class: 'chip' }, k.area) : null,
      due ? el('span', { class: 'chip due ' + due.cls }, due.label) : null,
      k.comments ? el('span', { class: 'chip ghost', title: k.comments + ' commenti' }, '💬 ' + k.comments) : null,
      k.report_id ? el('span', { class: 'chip ghost', title: 'Collegata a una segnalazione' }, 'Segnalazione') : null,
      el('span', { class: 'grow' }),
      k.assignee ? el('span', { class: 'tk-av', title: personName(k.assignee) }, initials(k.assignee)) : el('span', { class: 'tk-av none', title: 'Da assegnare' }, '?')));
  c.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', String(k.id)); e.dataTransfer.effectAllowed = 'move'; c.classList.add('drag'); });
  c.addEventListener('dragend', () => c.classList.remove('drag'));
  return c;
}
async function dropTask(id, st, list, y, main) {
  const k = S.tasks.tasks.find((x) => x.id === id); if (!k) return;
  // posizione: fra le card sopra e sotto il punto in cui la lasci
  const cards = [...list.querySelectorAll('.tk')].filter((c) => +c.dataset.id !== id);
  const after = cards.find((c) => { const r = c.getBoundingClientRect(); return y < r.top + r.height / 2; });
  const sortOf = (c) => (S.tasks.tasks.find((x) => x.id === +c.dataset.id) || {}).sort;
  let sort;
  if (!cards.length) sort = Date.now() / 1000;
  else if (!after) sort = sortOf(cards[cards.length - 1]) + 1;
  else { const i = cards.indexOf(after); sort = i === 0 ? sortOf(after) - 1 : (sortOf(cards[i - 1]) + sortOf(after)) / 2; }
  if (k.status === st && k.sort === sort) return;
  const before = { status: k.status, sort: k.sort, done_at: k.done_at };
  Object.assign(k, { status: st, sort, done_at: st === 'done' ? (k.done_at || new Date().toISOString()) : null });
  renderTasks(main);
  try { Object.assign(k, await sql('task_save', { id, status: st, sort })); if (before.status !== st) toast(st === 'done' ? 'Fatta!' : 'Spostata in "' + TST.find((x) => x[0] === st)[1] + '"'); }
  catch (e) { Object.assign(k, before); toast(explain(e)); }
  ME.my_tasks = myOpenTasks(); paintMe(); renderTasks(main);
}
async function taskModal(k, def, main) {
  if (!S.tasks) { try { S.tasks = await sql('tasks'); } catch (e) { toast(explain(e)); return; } }
  const isNew = !k; k = k || { title: '', notes: '', status: 'todo', priority: 1, assignee: null, due: null, area: '', ...def };
  const title = el('input', { class: 'search tk-title', placeholder: 'Cosa c\'è da fare?', value: k.title, maxlength: '200', 'aria-label': 'Titolo' });
  const notes = el('textarea', { class: 'note', placeholder: 'Dettagli, link, come capire che è finita…', maxlength: '4000', 'aria-label': 'Dettagli' }); notes.value = k.notes || '';
  const status = el('select', { class: 'search' }, ...TST.map(([v, l]) => el('option', { value: v, selected: k.status === v }, l)));
  let prio = String(k.priority ?? 1);
  const prioSeg = el('div', { class: 'seg' });
  const paintPrio = () => rc(prioSeg, ...PRIO.map(([v, l]) => el('button', { type: 'button', 'aria-pressed': String(prio === v), onclick: () => { prio = v; paintPrio(); } }, l)));
  paintPrio();
  const asg = el('select', { class: 'search' }, el('option', { value: '' }, 'Nessuno'), ...S.tasks.people.map((p) => el('option', { value: p.email, selected: k.assignee === p.email }, (p.name || p.email) + (p.email === ME.email ? ' (tu)' : ''))));
  const due = el('input', { class: 'search', type: 'date', value: k.due || '' });
  const areas = [...new Set([...AREAS_DEF, ...(S.tasks.areas || [])])];
  const area = el('input', { class: 'search', list: 'tk-areas', placeholder: 'es. Marketing', value: k.area || '', maxlength: '30' });
  const dl = el('datalist', { id: 'tk-areas' }, ...areas.map((a) => el('option', { value: a })));
  const comments = el('div', { class: 'tk-comments' });
  const msg = el('textarea', { class: 'note', placeholder: 'Scrivi un commento…', style: 'min-height:56px', maxlength: '2000' });
  const paintComments = (list) => rc(comments, ...(list.length ? list.map((c) => el('div', { class: 'cm' }, el('span', { class: 'tk-av' }, (c.name || c.author)[0].toUpperCase()),
    el('div', null, el('div', { class: 'cm-h' }, el('b', null, c.name || c.author.split('@')[0]), el('time', null, when(c.at))), el('p', null, c.text)))) : [el('p', { class: 'muted', style: 'margin:0' }, 'Ancora nessun commento.')]));
  if (!isNew) { rc(comments, el('p', { class: 'muted' }, 'Caricamento…')); sql('task_comments', { id: k.id }).then(paintComments).catch((e) => rc(comments, el('p', { class: 'gate-err' }, explain(e)))); }
  const close = () => { bg.remove(); document.removeEventListener('keydown', esc); };
  const esc = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', esc);
  const canDelete = !isNew && (k.created_by === ME.email || CAN('team'));
  let armed = false;
  const delBtn = canDelete ? el('button', { class: 'btn bad', type: 'button', onclick: async (e) => {
    if (!armed) { armed = true; e.currentTarget.textContent = 'Conferma: elimina'; return; }
    e.currentTarget.disabled = true;
    try { await sql('task_archive', { id: k.id }); S.tasks.tasks = S.tasks.tasks.filter((x) => x.id !== k.id); close(); toast('Task eliminata'); ME.my_tasks = myOpenTasks(); paintMe(); if (S.view === 'tasks') renderTasks(main); }
    catch (x) { e.currentTarget.disabled = false; toast(explain(x)); }
  } }, 'Elimina') : null;
  const save = async (e) => {
    const ti = title.value.trim(); if (!ti) { title.focus(); toast('Scrivi cosa c\'è da fare'); return; }
    e.currentTarget.disabled = true;
    const patch = { title: ti, notes: notes.value, status: status.value, priority: +prio, assignee: asg.value || null, due: due.value || null, area: area.value.trim() || null };
    if (isNew && k.report_id) patch.report_id = k.report_id;
    try {
      const r = await sql('task_save', isNew ? patch : { id: k.id, ...patch });
      if (isNew) S.tasks.tasks.push(r); else Object.assign(S.tasks.tasks.find((x) => x.id === k.id) || {}, r);
      if (r.area && !S.tasks.areas.includes(r.area)) S.tasks.areas.push(r.area);
      close(); toast(isNew ? 'Task creata' + (r.assignee && r.assignee !== ME.email ? ' e assegnata a ' + personName(r.assignee) : '') : 'Task salvata');
      ME.my_tasks = myOpenTasks(); paintMe(); if (S.view === 'tasks') renderTasks(main);
    } catch (x) { e.currentTarget.disabled = false; toast(explain(x)); }
  };
  title.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveBtn.click(); } });
  const saveBtn = el('button', { class: 'btn primary', type: 'button', onclick: save }, isNew ? 'Crea task' : 'Salva');
  const bg = el('div', { class: 'modal-bg', onclick: (e) => { if (e.target === bg) close(); } }, el('div', { class: 'modal shop-modal tk-modal', role: 'dialog', 'aria-label': isNew ? 'Nuova task' : 'Task' },
    el('div', { class: 'row' }, el('h2', { class: 'grow' }, isNew ? 'Nuova task' : 'Task'), el('button', { class: 'btn sm ghost', type: 'button', onclick: close, 'aria-label': 'Chiudi' }, '✕')),
    title, notes,
    el('div', { class: 'fgrid' }, el('label', { class: 'fld' }, el('span', null, 'Stato'), status), el('label', { class: 'fld' }, el('span', null, 'Assegnata a'), asg),
      el('label', { class: 'fld' }, el('span', null, 'Scadenza'), due), el('label', { class: 'fld' }, el('span', null, 'Area'), area, dl)),
    el('div', { class: 'fld' }, el('span', null, 'Priorità'), prioSeg),
    k.report_id ? el('div', { class: 'row' }, el('span', { class: 'muted' }, 'Collegata a una segnalazione'), CAN('reports') ? el('button', { class: 'linkish', type: 'button', onclick: () => { close(); S.rsel = k.report_id; S.rtab = 'all'; go('reports'); } }, 'Apri') : null) : null,
    isNew ? null : el('details', { class: 'box', open: true }, el('summary', null, 'Commenti'), comments,
      el('div', { class: 'row', style: 'margin-top:8px' }, msg, el('button', { class: 'btn sm', type: 'button', onclick: async (e) => {
        const tx = msg.value.trim(); if (!tx) { msg.focus(); return; }
        e.currentTarget.disabled = true;
        try { paintComments(await sql('task_comments', { id: k.id, text: tx })); msg.value = ''; const kk = S.tasks.tasks.find((x) => x.id === k.id); if (kk) kk.comments = (kk.comments || 0) + 1; if (S.view === 'tasks') renderTasks(main); }
        catch (x) { toast(explain(x)); }
        e.currentTarget.disabled = false;
      } }, 'Commenta'))),
    isNew ? null : el('p', { class: 'muted', style: 'margin:0;font-size:12px' }, 'Creata da ' + personName(k.created_by) + ' ' + when(k.created_at) + (k.updated_at !== k.created_at ? ' · modificata ' + when(k.updated_at) : '')),
    el('div', { class: 'row' }, delBtn, el('span', { class: 'grow' }), el('button', { class: 'btn', type: 'button', onclick: close }, 'Annulla'), saveBtn)));
  document.body.append(bg);
  if (isNew) setTimeout(() => title.focus(), 30);
}
function taskFromReport(r) {
  return el('button', { class: 'btn', type: 'button', onclick: () => taskModal(null, { title: (r.text || 'Segnalazione').replace(/\s+/g, ' ').slice(0, 120), notes: 'Dalla segnalazione di ' + (r.who || 'un utente') + ':\n\n' + (r.text || ''), report_id: r.id, area: r.kind === 'bug' ? 'Sviluppo' : '' }, $('#main')) }, 'Crea task');
}

// ------------------------------------------------------------------ team e permessi
const PERMS = [
  ['launch', 'Lancio e numeri', 'Download, iscritti e obiettivi del lancio'],
  ['tasks', 'Task', 'Vedere, creare e spostare le task del team'],
  ['reports', 'Vedere le segnalazioni', 'Bug e idee degli utenti, con screenshot ed email di chi scrive'],
  ['reports_decide', 'Decidere le segnalazioni', 'Approvare, rifiutare e mandare richieste a Claude', 'reports'],
  ['users', 'Vedere gli utenti', 'Email, dispositivi e uso dell\'app: sono dati personali'],
  ['users_edit', 'Gestire gli utenti', 'Bloccare account, scrivere note, regalare crediti e piani', 'users'],
  ['shop', 'Prezzi e offerte', 'Piani, ricariche e offerte lampo che vedono gli utenti'],
  ['money', 'Soldi', 'Costi delle AI, crediti in giro e (quando ci saranno) incassi'],
  ['messages', 'Messaggi agli utenti', 'Pubblicare avvisi e novità nella home dell\'app'],
  ['beta', 'Beta tester', 'Chi può provare le versioni nuove'],
  ['team', 'Team e permessi', 'Aggiungere persone e vedere il registro delle azioni'],
];
const ROLES = [
  ['admin', 'Admin', 'Tutto', PERMS.map((p) => p[0])],
  ['supporto', 'Supporto', 'Utenti e segnalazioni', ['launch', 'tasks', 'reports', 'reports_decide', 'users', 'users_edit', 'messages']],
  ['sviluppo', 'Sviluppo', 'Segnalazioni e beta', ['launch', 'tasks', 'reports', 'reports_decide', 'beta']],
  ['marketing', 'Marketing', 'Numeri, prezzi, offerte e messaggi', ['launch', 'tasks', 'shop', 'messages']],
  ['lettura', 'Solo lettura', 'Numeri e task', ['launch', 'tasks']],
];
const permName = (k) => (PERMS.find((p) => p[0] === k) || [k, k])[1];
function memberState(m) {
  if (m.role === 'owner') return ['done', 'Proprietario'];
  if (!m.active) return ['bad', 'Accesso sospeso'];
  if (!m.has_account) return ['new', 'Non è ancora entrato'];
  if (!m.has_mfa) return ['new', 'Deve attivare il codice'];
  return ['done', 'Attivo'];
}
function renderTeam(main) {
  const body = el('div', { class: 'body shop-body' });
  rc(main, head('Team e permessi', el('button', { class: 'btn primary', type: 'button', onclick: () => memberModal(null, main) }, '＋ Aggiungi persona')), body);
  if (S.err) { rc(body, el('div', { class: 'err' }, S.err)); return; }
  if (!S.team) { rc(body, el('div', { class: 'loading' }, 'Caricamento…')); return; }
  rc(body,
    el('div', { class: 'box', style: 'margin:0 0 16px' }, el('p', null, 'Ognuno entra su ', el('b', null, location.host), ' con il proprio account Google e un codice a 6 cifre dall\'app di autenticazione. Vede solo le sezioni che gli permetti: anche se provasse ad aprirne altre, il server rifiuta.')),
    el('div', { class: 'members' }, ...S.team.map((m) => {
      const [cls, st] = memberState(m);
      const all = m.role === 'owner' || PERMS.every((p) => m.perms.includes(p[0]));
      return el('button', { class: 'member', type: 'button', onclick: () => memberModal(m, main) },
        el('span', { class: 'av' }, (m.name || m.email)[0].toUpperCase()),
        el('span', { class: 'mb-who' }, el('b', null, m.name || m.email.split('@')[0], m.email === ME.email ? el('small', { class: 'muted' }, ' (tu)') : null), el('small', null, m.email)),
        el('span', { class: 'mb-role' }, el('b', null, ROLE_NAME[m.role] || m.role), el('small', null, all ? 'Può fare tutto' : m.perms.length ? m.perms.map(permName).join(', ') : 'Nessun permesso')),
        el('span', { class: 'mb-st' }, el('span', { class: 'pill ' + cls }, st), el('small', { class: 'muted' }, m.last_seen ? 'Visto ' + when(m.last_seen) : 'Mai entrato')),
        el('span', { class: 'mb-t muted' }, m.open_tasks ? m.open_tasks + (m.open_tasks === 1 ? ' task aperta' : ' task aperte') : ''));
    })),
    el('section', { class: 'card', style: 'margin-top:18px' }, el('h2', null, 'Registro delle azioni'),
      el('p', { class: 'muted', style: 'margin:-6px 0 10px;font-size:12.5px' }, 'Chi ha cambiato cosa nel pannello. Non si può modificare né cancellare.'),
      (S.audit || []).length ? el('div', { class: 'audit' }, ...S.audit.map((a) => el('div', { class: 'au' }, el('time', { title: full(a.at) }, when(a.at)), el('b', null, a.name || a.actor.split('@')[0]), el('span', null, auditText(a)))))
        : el('p', { class: 'muted', style: 'margin:0' }, 'Ancora niente.')));
}
function auditText(a) {
  const d = a.detail || {};
  const ST = { approvata: 'approvata', rifiutata: 'rifiutata', nuova: 'da decidere', fatta: 'fatta', chiusa: 'chiusa' };
  switch (a.fn) {
    case 'set_user': return d.blocked === true ? 'ha bloccato un utente' : d.blocked === false ? 'ha sbloccato un utente' : 'ha scritto una nota su un utente';
    case 'set_report': return 'ha segnato una segnalazione come ' + (ST[d.status] || d.status || '—');
    case 'create_request': return 'ha mandato una richiesta a Claude';
    case 'beta_set': return 'ha cambiato i beta tester' + (d.email ? ' (' + d.email + ')' : '');
    case 'team_save': return 'ha aggiornato ' + (d.email || 'una persona') + (d.perms ? ': ' + (d.perms.length ? d.perms.map(permName).join(', ') : 'nessun permesso') : '');
    case 'team_remove': return 'ha tolto ' + (d.email || 'una persona') + ' dal team';
    case 'launch_save': return 'ha cambiato gli obiettivi del lancio';
    case 'task_archive': return 'ha eliminato una task';
    case 'message_save': return d.active === false ? 'ha fermato un messaggio agli utenti' : 'ha pubblicato un messaggio agli utenti' + (d.title ? ': "' + d.title + '"' : '');
    case 'report_reply': return 'ha risposto a chi ha fatto una segnalazione' + (d.email === true ? ' (anche via email)' : '');
    case 'credits': return d.op === 'gift' ? (d.amount < 0 ? 'ha tolto ' + num(-d.amount) + ' crediti a un utente' : 'ha regalato ' + num(d.amount) + ' crediti a un utente') : d.op === 'plan' ? 'ha attivato il piano ' + (d.plan || '') + ' a un utente' : d.op === 'cancel' ? 'ha chiuso il piano di un utente' : 'ha cambiato i crediti di un utente';
    case 'catalog': return d.op === 'stop_offer' ? 'ha fermato un\'offerta' : d.op === 'save_offer' ? 'ha salvato un\'offerta' : d.op === 'save_plan' ? 'ha modificato un piano' : d.op === 'save_pack' ? 'ha modificato una ricarica' : 'ha modificato il listino';
    default: return a.fn;
  }
}
function memberModal(m, main) {
  const isNew = !m, owner = m && m.role === 'owner', self = m && m.email === ME.email;
  m = m || { email: '', name: '', role: 'lettura', perms: ROLES.find((r) => r[0] === 'lettura')[3], active: true };
  const email = el('input', { class: 'search', type: 'email', placeholder: 'nome@gmail.com', value: m.email, disabled: !isNew, autocomplete: 'off', 'aria-label': 'Email' });
  const name = el('input', { class: 'search', placeholder: 'Nome', value: m.name || '', maxlength: '60', 'aria-label': 'Nome' });
  let role = m.role, perms = new Set(m.perms);
  const locked = (k) => owner || self || (ME.role !== 'owner' && !CAN(k));
  const roleBox = el('div', { class: 'roles' }), permBox = el('div', { class: 'perms' });
  const paint = () => {
    rc(roleBox, ...ROLES.map(([k, l, d, ps]) => el('button', { type: 'button', class: 'role', 'aria-pressed': String(role === k), disabled: owner || self || (ME.role !== 'owner' && !ps.every(CAN)),
      onclick: () => { role = k; perms = new Set(ps); paint(); } }, el('b', null, l), el('small', null, d))),
      el('button', { type: 'button', class: 'role', 'aria-pressed': String(role === 'custom'), disabled: owner || self, onclick: () => { role = 'custom'; paint(); } }, el('b', null, 'Personalizzato'), el('small', null, 'Scegli tu')));
    rc(permBox, ...PERMS.map(([k, l, d, needs]) => {
      const on = owner || perms.has(k);
      const cb = el('input', { type: 'checkbox', checked: on, disabled: locked(k) || (needs && !perms.has(needs) && !owner) });
      cb.addEventListener('change', () => {
        if (cb.checked) perms.add(k); else { perms.delete(k); PERMS.filter((p) => p[3] === k).forEach((p) => perms.delete(p[0])); }
        const match = ROLES.find((r) => r[3].length === perms.size && r[3].every((x) => perms.has(x)));
        role = match ? match[0] : 'custom'; paint();
      });
      return el('label', { class: 'perm' + (needs ? ' sub' : '') }, cb, el('span', null, el('b', null, l), el('small', null, d)));
    }));
  };
  paint();
  const active = el('input', { type: 'checkbox', checked: m.active !== false, disabled: owner || self });
  const close = () => { bg.remove(); document.removeEventListener('keydown', esc); };
  const esc = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', esc);
  let armed = false;
  const save = async (e) => {
    const em = email.value.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { toast('Email non valida'); email.focus(); return; }
    if (isNew && S.team.some((x) => x.email === em)) { toast('È già nel team'); return; }
    e.currentTarget.disabled = true;
    try {
      S.team = await sql('team_save', { email: em, name: name.value.trim(), role, perms: [...perms], active: active.checked });
      S.audit = await sql('audit', { limit: 120 });
      close(); renderTeam(main);
      toast(isNew ? 'Aggiunto. Mandagli il link: ' + location.host : 'Salvato');
    } catch (x) { e.currentTarget.disabled = false; toast(explain(x)); }
  };
  const bg = el('div', { class: 'modal-bg', onclick: (e) => { if (e.target === bg) close(); } }, el('div', { class: 'modal shop-modal', role: 'dialog', 'aria-label': isNew ? 'Aggiungi persona' : 'Persona del team' },
    el('div', { class: 'row' }, el('h2', { class: 'grow' }, isNew ? 'Aggiungi una persona' : (m.name || m.email)), el('button', { class: 'btn sm ghost', type: 'button', onclick: close, 'aria-label': 'Chiudi' }, '✕')),
    el('div', { class: 'fgrid' }, el('label', { class: 'fld' }, el('span', null, 'Email Google'), email), el('label', { class: 'fld' }, el('span', null, 'Nome'), name)),
    owner ? el('p', { class: 'muted', style: 'margin:0' }, 'Il proprietario può fare tutto e non si può togliere.') : self ? el('p', { class: 'muted', style: 'margin:0' }, 'Non puoi cambiare i tuoi permessi: chiedi al proprietario.') : null,
    owner ? null : el('div', { class: 'fld' }, el('span', null, 'Ruolo'), roleBox),
    owner ? null : el('div', { class: 'fld' }, el('span', null, 'Cosa può fare'), permBox),
    owner ? null : el('label', { class: 'chk' }, active, 'Può entrare nel pannello'),
    isNew ? el('p', { class: 'muted', style: 'margin:0;font-size:12.5px' }, 'Dopo il salvataggio mandagli il link ' + location.host + ': entra con Google usando questa email e attiva il codice a 6 cifre.') : null,
    el('div', { class: 'row' },
      !isNew && !owner && !self ? el('button', { class: 'btn bad', type: 'button', onclick: async (e) => {
        if (!armed) { armed = true; e.currentTarget.textContent = 'Conferma: togli dal team'; return; }
        e.currentTarget.disabled = true;
        try { S.team = await sql('team_remove', { email: m.email }); S.audit = await sql('audit', { limit: 120 }); close(); renderTeam(main); toast('Tolto dal team'); }
        catch (x) { e.currentTarget.disabled = false; toast(explain(x)); }
      } }, 'Togli dal team') : null,
      el('span', { class: 'grow' }), el('button', { class: 'btn', type: 'button', onclick: close }, 'Annulla'),
      (owner && ME.role !== 'owner') || (self && !owner) ? null : el('button', { class: 'btn primary', type: 'button', onclick: save }, isNew ? 'Aggiungi' : 'Salva'))));
  document.body.append(bg);
  if (isNew) setTimeout(() => email.focus(), 30);
}

// ------------------------------------------------------------------ stato dei servizi: verde se va, rosso se qualcosa è rotto
const CHECKS = [
  ['site', 'Sito noonframe.com', 'La pagina da cui la gente scarica l\'app'],
  ['fn_dl', 'Link via email', 'Chi visita dal telefono riceve il link per il PC'],
  ['upd_stable', 'Aggiornamenti', 'L\'app trova le versioni nuove'],
  ['upd_beta', 'Aggiornamenti beta', 'Le versioni di prova per i beta tester'],
  ['fn_ai', 'Servizio AI', 'Video, immagini e voci generati con i crediti'],
  ['fn_outbox', 'Invio email del team', 'Le risposte a chi segnala'],
  ['admin', 'Pannello admin', 'Questa pagina'],
];
const CRON_NAME = { 'credits-renew': 'Rinnovo crediti mensili', 'dl-fetch': 'Conteggio download', 'dl-collect': 'Conteggio download (lettura)', 'health-fetch': 'Controlli dei servizi', 'health-collect': 'Controlli dei servizi (lettura)', 'outbox-retry': 'Nuovi tentativi email', 'download-requests-retention': 'Pulizia richieste link (privacy)' };
function renderStatus(main) {
  const st = S.status;
  const body = el('div', { class: 'body' });
  rc(main, head('Stato'), body);
  if (S.err) { rc(body, el('div', { class: 'err' }, S.err)); return; }
  if (!st) { rc(body, el('div', { class: 'loading' }, 'Caricamento…')); return; }
  const rows = [];
  const row = (ok, label, desc, detail, at) => rows.push({ ok, el: el('div', { class: 'srow ' + (ok === true ? 'ok' : ok === false ? 'bad' : ok === 'warn' ? 'warn' : 'wait') },
    el('span', { class: 'sdot' }), el('div', { class: 'stxt' }, el('b', null, label), el('small', null, desc)),
    el('div', { class: 'sdet' }, el('span', null, detail || (ok === true ? 'Funziona' : ok === false ? 'Non funziona' : ok === 'warn' ? 'Da controllare' : 'In attesa del primo controllo')), at ? el('small', null, when(at)) : null)) });
  for (const [k, label, desc] of CHECKS) {
    const c = (st.checks || {})[k];
    row(c ? c.ok : null, label, desc, c ? (c.ok ? (c.detail || 'Funziona') : (c.detail || 'Non risponde') + (c.since ? ' da ' + when(c.since).replace(' fa', '') : '')) : null, c && c.at);
  }
  const ai = st.ai || {};
  row(ai.stuck ? false : (ai.jobs && ai.failed / ai.jobs > 0.3) ? 'warn' : true, 'Generazioni AI', 'Lavori AI delle ultime 24 ore',
    ai.jobs ? ai.jobs + ' lavori, ' + ai.failed + ' falliti e rimborsati' + (ai.stuck ? ' · ' + ai.stuck + ' bloccati' : '') : 'Nessun lavoro nelle ultime 24 ore', ai.last);
  const em = st.email || {};
  row(em.failed || em.pending ? 'warn' : true, 'Email', 'Link di download e risposte del team (24 ore)',
    (em.sent || 0) + ' inviate' + (em.failed ? ' · ' + em.failed + ' non partite' : '') + (em.pending ? ' · ' + em.pending + ' in coda da più di 15 minuti' : ''));
  const dlAge = st.dl_at ? (Date.now() - new Date(st.dl_at)) / 36e5 : 99;
  row(dlAge < 3 ? true : 'warn', 'Contatore download', 'I numeri della sezione Lancio', st.dl_at ? 'Aggiornato ' + when(st.dl_at) : 'Mai aggiornato');
  const cronRows = Object.entries(st.cron || {}).map(([k, c]) => el('div', { class: 'srow sm ' + (c.ok === false ? 'bad' : c.ok ? 'ok' : 'wait') }, el('span', { class: 'sdot' }),
    el('div', { class: 'stxt' }, el('b', null, CRON_NAME[k] || k)), el('div', { class: 'sdet' }, el('span', null, c.ok === false ? 'Ultimo giro fallito' + (c.msg ? ': ' + c.msg : '') : c.ok ? 'Ok' : 'Non ancora partito'), c.at ? el('small', null, when(c.at)) : null)));
  const bad = rows.filter((r) => r.ok === false).length, warn = rows.filter((r) => r.ok === 'warn').length + Object.values(st.cron || {}).filter((c) => c.ok === false).length;
  rc(body, el('div', { class: 'ov' },
    el('div', { class: 'shero ' + (bad ? 'bad' : warn ? 'warn' : 'ok') }, el('span', { class: 'sdot big' }),
      el('div', null, el('b', null, bad ? (bad === 1 ? 'Un servizio non funziona' : bad + ' servizi non funzionano') : warn ? 'Funziona tutto, ma c\'è qualcosa da controllare' : 'Funziona tutto'),
        el('small', null, 'Controlli automatici ogni 15 minuti. ' + (st.active_1h ? st.active_1h + (st.active_1h === 1 ? ' persona sta' : ' persone stanno') + ' usando l\'app ora.' : '')))),
    el('section', { class: 'card' }, el('h2', null, 'Servizi'), el('div', { class: 'slist' }, ...rows.map((r) => r.el))),
    el('section', { class: 'card' }, el('h2', null, 'Lavori automatici del server'), el('div', { class: 'slist' }, ...cronRows)),
    st.bugs_24h ? el('p', { class: 'muted fine' }, st.bugs_24h + (st.bugs_24h === 1 ? ' bug segnalato' : ' bug segnalati') + ' nelle ultime 24 ore.') : null));
}

// ------------------------------------------------------------------ messaggi agli utenti: compaiono in cima alla home dell'app
const AUD_MSG = [['all', 'Tutti'], ['free', 'Solo utenti gratis'], ['paid', 'Solo abbonati'], ['beta', 'Solo beta tester']];
const KIND_MSG = [['info', 'Informazione'], ['update', 'Novità'], ['warning', 'Avviso']];
function renderMessages(main) {
  const body = el('div', { class: 'body shop-body' });
  rc(main, head('Messaggi', el('button', { class: 'btn primary', type: 'button', onclick: () => messageModal(null, main) }, '＋ Nuovo messaggio')), body);
  if (S.err) { rc(body, el('div', { class: 'err' }, S.err)); return; }
  if (!S.messages) { rc(body, el('div', { class: 'loading' }, 'Caricamento…')); return; }
  if (!S.messages.length) { rc(body, el('div', { class: 'empty' }, 'Nessun messaggio. Scrivine uno: arriva nella campanella dell\'app di tutti.')); return; }
  rc(body, el('div', { class: 'members' }, ...S.messages.map((m) => {
    const state = !m.active ? ['no', 'Fermato'] : m.live ? ['done', 'Visibile ora'] : new Date(m.starts_at) > new Date() ? ['new', 'Parte ' + full(m.starts_at)] : ['no', 'Scaduto'];
    return el('button', { class: 'member msg', type: 'button', onclick: () => messageModal(m, main) },
      el('span', { class: 'mk ' + m.kind }),
      el('span', { class: 'mb-who' }, el('b', null, m.title), el('small', null, m.body || '—')),
      el('span', { class: 'mb-role' }, el('b', null, (AUD_MSG.find((a) => a[0] === m.audience) || [0, m.audience])[1]), el('small', null, (KIND_MSG.find((a) => a[0] === m.kind) || [0, m.kind])[1] + (m.ends_at ? ' · fino al ' + full(m.ends_at) : ''))),
      el('span', { class: 'mb-st' }, el('span', { class: 'pill ' + state[0] }, state[1]), el('small', { class: 'muted' }, num(m.seen) + ' l\'hanno visto · ' + num(m.closed) + ' chiuso')),
      el('span', { class: 'mb-t muted' }, when(m.created_at)));
  })));
}
function messageModal(m, main) {
  const isNew = !m;
  m = m || { kind: 'info', title: '', body: '', title_en: '', body_en: '', cta_label: '', cta_label_en: '', cta_url: '', audience: 'all', starts_at: new Date().toISOString(), ends_at: '', active: true };
  const inp = (v, attrs) => el('input', { class: 'search', value: v || '', ...attrs });
  const title = inp(m.title, { maxlength: '120', placeholder: 'es. Novità: sottotitoli più veloci' });
  const bodyT = el('textarea', { class: 'note', maxlength: '2000', placeholder: 'Due o tre righe al massimo: cosa cambia per chi usa l\'app.' }); bodyT.value = m.body || '';
  const titleEn = inp(m.title_en, { maxlength: '120', placeholder: 'English title (optional)' });
  const bodyEn = el('textarea', { class: 'note', maxlength: '2000', placeholder: 'English text (optional). Without it, English users see the Italian one.' }); bodyEn.value = m.body_en || '';
  const cta = inp(m.cta_label, { maxlength: '40', placeholder: 'es. Scopri di più' });
  const ctaEn = inp(m.cta_label_en, { maxlength: '40', placeholder: 'Learn more' });
  const url = inp(m.cta_url, { type: 'url', placeholder: 'https://noonframe.com/…' });
  const aud = el('select', { class: 'search' }, ...AUD_MSG.map(([v, l]) => el('option', { value: v, selected: m.audience === v }, l)));
  const kind = el('select', { class: 'search' }, ...KIND_MSG.map(([v, l]) => el('option', { value: v, selected: m.kind === v }, l)));
  const from = inp(toLocal(m.starts_at), { type: 'datetime-local' });
  const to = inp(m.ends_at ? toLocal(m.ends_at) : '', { type: 'datetime-local' });
  const prev = el('div', { class: 'tm-prev' });
  const KI = { info: 'Dal team', update: 'Novità', warning: 'Avviso' };
  const paint = () => rc(prev, el('div', { class: 'tm-p ' + kind.value }, el('span', { class: 'tm-p-ic' }, kind.value === 'update' ? '✦' : kind.value === 'warning' ? '!' : 'i'),
    el('div', null, el('div', { class: 'tm-p-top' }, el('small', null, KI[kind.value] + ' · adesso')), el('b', null, title.value || 'Titolo del messaggio'),
      el('p', null, bodyT.value || 'Il testo del messaggio.'), url.value ? el('span', { class: 'tm-p-btn' }, (cta.value || 'Apri') + ' ›') : null), el('span', { class: 'tm-p-x' }, '✕')));
  [title, bodyT, cta, url, kind].forEach((x) => x.addEventListener('input', paint)); paint();
  const close = () => { bg.remove(); document.removeEventListener('keydown', esc); };
  const esc = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', esc);
  const save = async (e, extra) => {
    if (!title.value.trim()) { title.focus(); toast('Scrivi un titolo'); return; }
    if (url.value.trim() && !/^https:\/\//.test(url.value.trim())) { url.focus(); toast('Il link deve iniziare con https://'); return; }
    e.currentTarget.disabled = true;
    try {
      S.messages = await sql('message_save', { id: isNew ? null : m.id, kind: kind.value, title: title.value, body: bodyT.value, title_en: titleEn.value, body_en: bodyEn.value,
        cta_label: cta.value, cta_label_en: ctaEn.value, cta_url: url.value.trim(), audience: aud.value,
        starts_at: from.value ? new Date(from.value).toISOString() : null, ends_at: to.value ? new Date(to.value).toISOString() : null, active: true, ...(extra || {}) });
      close(); renderMessages(main); toast(extra && extra.active === false ? 'Messaggio fermato' : isNew ? 'Pubblicato: gli utenti lo vedono alla prossima apertura della home' : 'Salvato');
    } catch (x) { e.currentTarget.disabled = false; toast(explain(x)); }
  };
  const bg = el('div', { class: 'modal-bg', onclick: (e) => { if (e.target === bg) close(); } }, el('div', { class: 'modal shop-modal tk-modal', role: 'dialog', 'aria-label': 'Messaggio' },
    el('div', { class: 'row' }, el('h2', { class: 'grow' }, isNew ? 'Nuovo messaggio' : 'Messaggio'), el('button', { class: 'btn sm ghost', type: 'button', onclick: close, 'aria-label': 'Chiudi' }, '✕')),
    el('div', { class: 'fld' }, el('span', null, 'Come lo vedono nell\'app'), prev),
    el('div', { class: 'fgrid' }, el('label', { class: 'fld' }, el('span', null, 'Tipo'), kind), el('label', { class: 'fld' }, el('span', null, 'Chi lo vede'), aud)),
    el('label', { class: 'fld' }, el('span', null, 'Titolo'), title), el('label', { class: 'fld' }, el('span', null, 'Testo'), bodyT),
    el('div', { class: 'fgrid' }, el('label', { class: 'fld' }, el('span', null, 'Pulsante (facoltativo)'), cta), el('label', { class: 'fld' }, el('span', null, 'Link del pulsante'), url)),
    el('div', { class: 'fgrid' }, el('label', { class: 'fld' }, el('span', null, 'Da quando'), from), el('label', { class: 'fld' }, el('span', null, 'Fino a quando (vuoto = finché lo fermi)'), to)),
    el('details', null, el('summary', null, 'Versione inglese'), el('div', { class: 'fld' }, titleEn, bodyEn, ctaEn)),
    el('p', { class: 'muted', style: 'margin:0;font-size:12.5px' }, 'Arriva nella campanella in alto nell\'app (con il numerino) e, la prima volta, compare un attimo sotto la campanella. Ognuno lo può togliere e non lo rivede più.'),
    el('div', { class: 'row' }, !isNew && m.active ? el('button', { class: 'btn bad', type: 'button', onclick: (e) => save(e, { active: false }) }, 'Ferma') : null,
      el('span', { class: 'grow' }), el('button', { class: 'btn', type: 'button', onclick: close }, 'Annulla'),
      el('button', { class: 'btn primary', type: 'button', onclick: (e) => save(e) }, isNew ? 'Pubblica' : 'Salva'))));
  document.body.append(bg);
  if (isNew) setTimeout(() => title.focus(), 30);
}

// ------------------------------------------------------------------ risposta a chi ha segnalato (nel dettaglio della segnalazione)
function replyBox(r) {
  const box = el('div', { class: 'box reply' }, el('h3', null, 'Rispondi a ' + (r.who || 'chi ha segnalato')), el('p', { class: 'muted', style: 'margin:0' }, 'Caricamento…'));
  if (!r.user_id) { rc(box, el('h3', null, 'Risposta'), el('p', { class: 'muted', style: 'margin:0' }, 'Questa segnalazione è arrivata senza account: non c\'è nessuno a cui rispondere.')); return box; }
  const paint = (d) => {
    const ta = el('textarea', { class: 'note', maxlength: '2000', placeholder: r.status === 'fatta' ? 'es. Risolto nella ' + (r.done_version || 'ultima versione') + ': aggiorna l\'app e fammi sapere.' : 'Scrivi la risposta: la vede nell\'app' });
    const mail = el('input', { type: 'checkbox', checked: d.can_email, disabled: !d.can_email });
    const tpl = r.status === 'fatta' ? el('button', { class: 'btn sm ghost', type: 'button', onclick: () => { ta.value = 'Ciao! Abbiamo sistemato quello che ci hai segnalato' + (r.done_version ? ' nella versione ' + r.done_version : '') + '. Aggiorna NoonFrame e dimmi se adesso va. Grazie per avercelo detto!'; ta.focus(); } }, 'Usa il testo "risolto"') : null;
    rc(box, el('h3', null, 'Rispondi a ' + (r.who || 'chi ha segnalato')),
      ...(d.replies || []).map((x) => el('div', { class: 'cm' }, el('span', { class: 'tk-av' }, (x.name || x.by)[0].toUpperCase()),
        el('div', null, el('div', { class: 'cm-h' }, el('b', null, x.name || x.by.split('@')[0]), el('time', null, when(x.at)),
          el('span', { class: 'muted', style: 'font-size:11.5px' }, [x.seen ? 'letta nell\'app' : 'non ancora letta', x.email === 'sent' ? 'email inviata' : x.email === 'pending' ? 'email in invio' : x.email === 'failed' ? 'email non partita' : null].filter(Boolean).join(' · '))),
          el('p', null, x.text)))),
      ta,
      el('div', { class: 'row' }, el('label', { class: 'chk' }, mail, d.can_email ? 'Manda anche per email' : 'Niente email: l\'account non ne ha una'), tpl, el('span', { class: 'grow' }),
        el('button', { class: 'btn primary sm', type: 'button', onclick: async (e) => {
          const tx = ta.value.trim(); if (tx.length < 2) { ta.focus(); toast('Scrivi la risposta'); return; }
          e.currentTarget.disabled = true;
          try { paint(await sql('report_reply', { id: r.id, text: tx, email: mail.checked })); toast(mail.checked ? 'Risposta inviata: la vede nell\'app e per email' : 'Risposta inviata: la vede nell\'app'); }
          catch (x) { e.currentTarget.disabled = false; toast(explain(x)); }
        } }, 'Invia risposta')));
  };
  sql('report_replies', { id: r.id }).then(paint).catch((e) => rc(box, el('h3', null, 'Risposta'), el('p', { class: 'gate-err' }, explain(e))));
  return box;
}

// ------------------------------------------------------------------ soldi: costo vero delle API e crediti in giro (gli incassi arrivano con i pagamenti)
function renderMoney(main) {
  S.mdays = S.mdays || 30;
  const seg = el('div', { class: 'seg' }, ...[[7, '7 giorni'], [30, '30 giorni'], [90, '90 giorni']].map(([d, l]) =>
    el('button', { type: 'button', 'aria-pressed': String(S.mdays === d), onclick: async () => { S.mdays = d; S.money = null; renderMoney(main); try { S.money = await sql('money', { days: d }); } catch (e) { S.err = explain(e); } renderMoney(main); } }, l)));
  const body = el('div', { class: 'body' });
  rc(main, head('Soldi', seg), body);
  if (S.err) { rc(body, el('div', { class: 'err' }, S.err)); return; }
  const M = S.money; if (!M) { rc(body, el('div', { class: 'loading' }, 'Caricamento…')); return; }
  const usd = (cr) => cr / (M.per_usd || 280), toEur = (cr) => usd(cr) * ECO.fx;
  const openCr = (M.open.extra || 0) + (M.open.monthly || 0);
  const subs = (M.plans || []).reduce((a, p) => a + p.n * p.price, 0);
  const kpi = (v, label, sub, cls) => el('div', { class: 'kpi' + (cls ? ' ' + cls : '') }, el('b', null, v), el('span', null, label), sub ? el('small', null, sub) : null);
  const maxS = Math.max(1, ...M.series.map((d) => d.cr));
  rc(body, el('div', { class: 'ov' },
    el('div', { class: 'kpis' },
      kpi(eur(toEur(M.used)), 'Costo API', num(M.used) + ' crediti usati da ' + num(M.users) + (M.users === 1 ? ' persona' : ' persone')),
      kpi(eur(0), 'Incassi', 'Arrivano quando colleghiamo i pagamenti', 'dim'),
      kpi(eur(subs), 'Abbonamenti attivi', (M.plans || []).reduce((a, p) => a + p.n, 0) + ' attivati a mano (non pagati)'),
      kpi(eur(toEur(openCr)), 'Crediti ancora da usare', num(openCr) + ' crediti: costo massimo se li usano tutti', openCr / (M.per_usd || 280) * ECO.fx > 50 ? 'hot' : '')),
    el('div', { class: 'cards' },
      el('div', { class: 'card' }, el('h2', null, 'Costo API giorno per giorno'),
        M.used ? el('div', { class: 'mbars' }, ...M.series.map((d) => el('span', { title: shortDay(d.d) + ': ' + eur(toEur(d.cr)), style: 'height:' + Math.max(1, d.cr / maxS * 100) + '%' })))
          : el('p', { class: 'muted', style: 'margin:0' }, 'Ancora nessuna generazione AI pagata con i crediti in questo periodo.')),
      el('div', { class: 'card' }, el('h2', null, 'Dove vanno i crediti'),
        (M.models || []).length ? barList(M.models.map((x) => [x.model || 'Altro', Math.round(x.cr), eur(toEur(x.cr)) + ' · ' + x.n + ' lavori'])) : el('p', { class: 'muted', style: 'margin:0' }, 'Nessun dato'))),
    el('div', { class: 'cards' },
      el('div', { class: 'card' }, el('h2', null, 'Crediti regalati nel periodo'), el('div', { class: 'minis' },
        el('div', null, el('b', null, num(M.given.welcome)), el('span', null, 'di benvenuto')), el('div', null, el('b', null, num(M.given.gift)), el('span', null, 'regalati da voi')),
        el('div', null, el('b', null, num(M.given.monthly)), el('span', null, 'dei piani')), el('div', null, el('b', null, eur(toEur(M.given.welcome + M.given.gift))), el('span', null, 'costo massimo dei regali')))),
      el('div', { class: 'card' }, el('h2', null, 'Chi usa più crediti'), (M.top || []).length
        ? el('div', { class: 'bars' }, ...M.top.map((t) => el('div', { class: 'bar-r' }, t.id && CAN('users') ? el('button', { class: 'linkish', type: 'button', style: 'text-align:left;font-weight:500', onclick: () => openUser(t.id) }, t.who || '—') : el('span', null, t.who || '—'),
          el('span', { class: 'track' }, el('i', { style: 'width:' + Math.max(2, t.cr / M.top[0].cr * 100) + '%' })), el('b', null, eur(toEur(t.cr))))))
        : el('p', { class: 'muted', style: 'margin:0' }, 'Nessuno nel periodo'))),
    el('p', { class: 'muted fine' }, 'Il costo API è calcolato dai crediti scalati: ' + (M.per_usd || 280) + ' crediti = 1 $ di costo dei fornitori, cambio 1 $ = ' + ECO.fx + ' € (lo cambi in Crediti e offerte → Ipotesi dei conti). '
      + 'Il costo reale lo vedi sulle bollette di fal, ElevenLabs e Anthropic: se si discosta di molto, va corretto il listino dei crediti.')));
}
// ------------------------------------------------------------------ avvio
let startView = 'overview';
try { startView = localStorage.getItem('nuvora.admin.view') || 'overview'; } catch (e) { /* */ }
S.view = startView;
// ------------------------------------------------------------------ accesso: Google + codice dell'app di autenticazione (2 passaggi)
let poll = null;
function screen(...kids) {
  const g = $('#gate'); g.hidden = false; $('.app').hidden = true;
  rc(g, el('div', { class: 'gate-card' }, el('div', { class: 'gate-logo' }, el('img', { src: 'logo.png', alt: '' }), el('b', null, 'NoonFrame'), el('small', null, 'Admin')), ...kids));
}
function codeForm(label, onCode) {
  const inp = el('input', { class: 'gate-code', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '6', placeholder: '000000', 'aria-label': 'Codice a 6 cifre' });
  const msg = el('p', { class: 'gate-err', role: 'alert' });
  const go2 = async () => { const v = inp.value.replace(/\D/g, ''); if (v.length !== 6) { msg.textContent = 'Servono 6 cifre.'; return; } btn.disabled = true; msg.textContent = ''; try { await onCode(v); } catch (e) { msg.textContent = (e && e.message) || 'Codice non valido'; btn.disabled = false; inp.select(); } };
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go2(); });
  inp.addEventListener('input', () => { if (inp.value.replace(/\D/g, '').length === 6) go2(); });
  const btn = el('button', { class: 'btn primary', type: 'button', onclick: go2 }, label);
  setTimeout(() => inp.focus(), 50);
  return [inp, btn, msg];
}
async function gate(note) {
  READY = false;
  if (poll) { clearInterval(poll); poll = null; }
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    screen(el('h1', null, 'Accedi'), el('p', { class: 'muted' }, 'Per il team di NoonFrame. Entri con Google e un codice a 6 cifre.'),
      note ? el('p', { class: 'gate-err' }, note) : null,
      el('button', { class: 'btn primary', type: 'button', onclick: () => sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + '/' } }) }, 'Accedi con Google'));
    return;
  }
  // prima del codice: questo account è nel team? (il server risponde solo sì o no)
  const { data: who, error: werr } = await sb.rpc('admin_whoami');
  if (werr || !who || !who.ok) {
    const em = (session.user && session.user.email) || 'questo account';
    screen(el('h1', null, 'Non sei nel team'), el('p', { class: 'muted' }, werr ? 'Non riesco a controllare l\'accesso. Riprova tra poco.' : em + ' non può entrare. Chiedi al proprietario di aggiungerti in "Team e permessi", poi riprova.'),
      el('button', { class: 'btn', type: 'button', onclick: () => location.reload() }, 'Riprova'),
      el('button', { class: 'btn ghost sm', type: 'button', onclick: async () => { await sb.auth.signOut(); gate(); } }, 'Esci e cambia account'));
    return;
  }
  const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.currentLevel === 'aal2') return enter();
  const { data: f } = await sb.auth.mfa.listFactors();
  const totp = (f && f.totp || []).find((x) => x.status === 'verified');
  if (totp) {
    screen(el('h1', null, 'Codice di sicurezza'), el('p', { class: 'muted' }, 'Apri l\'app di autenticazione e scrivi il codice di NoonFrame Admin.'),
      ...codeForm('Entra', async (code) => {
        const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: totp.id, code });
        if (error) throw new Error('Codice non valido o scaduto');
        enter();
      }), el('button', { class: 'btn ghost sm', type: 'button', onclick: async () => { await sb.auth.signOut(); gate(); } }, 'Esci'));
    return;
  }
  // prima volta: si collega l'app di autenticazione (Google Authenticator, 1Password, Authy...)
  for (const x of (f && f.all || []).filter((y) => y.status !== 'verified')) await sb.auth.mfa.unenroll({ factorId: x.id });
  const { data: en, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'NoonFrame Admin' });
  if (error) { screen(el('h1', null, 'Errore'), el('p', { class: 'gate-err' }, error.message), el('button', { class: 'btn', type: 'button', onclick: async () => { await sb.auth.signOut(); gate(); } }, 'Esci')); return; }
  const qr = /^data:image\/svg\+xml/.test(en.totp.qr_code) ? en.totp.qr_code : 'data:image/svg+xml;utf-8,' + encodeURIComponent(en.totp.qr_code);
  screen(el('h1', null, 'Proteggi l\'accesso'), el('p', { class: 'muted' }, 'Inquadra il codice con l\'app di autenticazione (Google Authenticator, 1Password, Authy…), poi scrivi il codice a 6 cifre. Da ora servirà ogni volta.'),
    el('img', { class: 'gate-qr', src: qr, alt: 'Codice QR' }),
    el('details', { class: 'gate-sec' }, el('summary', null, 'Non riesci a inquadrarlo?'), el('code', null, en.totp.secret)),
    ...codeForm('Attiva ed entra', async (code) => {
      const { error: e2 } = await sb.auth.mfa.challengeAndVerify({ factorId: en.id, code });
      if (e2) throw new Error('Codice non valido');
      enter();
    }));
}
async function enter() {
  READY = true;
  try { ME = await sql('me'); } catch (e) { if (!READY) return; ME = null; }
  if (!ME) { screen(el('h1', null, 'Errore'), el('p', { class: 'gate-err' }, 'Non riesco a leggere i tuoi permessi. Riprova tra poco.'), el('button', { class: 'btn', type: 'button', onclick: () => location.reload() }, 'Riprova')); return; }
  paintMe();
  $('#gate').hidden = true; $('.app').hidden = false;
  go(allowed(S.view) ? S.view : 'overview');
  load(S.view, true);
  poll = setInterval(() => { if (document.visibilityState === 'visible') load(S.view, true); }, 120000);
}
$('#logout').addEventListener('click', async () => { await sb.auth.signOut(); gate(); });
sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') { READY = false; } });
gate();
