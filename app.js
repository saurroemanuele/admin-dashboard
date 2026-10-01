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
async function sql(fn, arg) {
  if (!READY) throw { code: 'auth' };
  const a = (fn === 'user_detail' || fn === 'report_detail') ? { id: arg } : (arg === undefined ? null : arg);
  const { data, error } = await sb.rpc('admin_call', { fn, arg: a });
  if (error) {
    const m = String(error.message || '');
    if (/mfa_required/.test(m)) { READY = false; gate(); throw { code: 'mfa' }; }
    if (/not_admin/.test(m)) { READY = false; await sb.auth.signOut(); gate('Questo account non è autorizzato.'); throw { code: 'not_admin' }; }
    if (/JWT|jwt/.test(m)) { READY = false; gate(); throw { code: 'auth' }; }
    throw { code: 'db', message: m };
  }
  return data;
}
function explain(e) {
  const c = e && e.code;
  if (c === 'auth' || c === 'mfa') return 'Accesso scaduto: entra di nuovo.';
  if (c === 'not_admin') return 'Questo account non è autorizzato.';
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
const S = { view: 'overview', ov: null, users: null, reports: null, uq: '', uf: 'all', rtab: 'nuova', rq: '', rsel: null, rdet: {}, drafts: {} };
let lastLoad = null;
function go(view) {
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
    if (view === 'overview' || force || !S.ov) { S.ov = await sql('overview'); }
    if (view === 'users' && (force || !S.users)) S.users = await sql('users', { limit: 2000 });
    if (view === 'reports' && (force || !S.reports)) S.reports = await sql('reports', {});
    if (view === 'beta' && (force || !S.beta)) S.beta = await sql('beta_list');
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
}
const head = (title, ...right) => el('div', { class: 'head' }, el('h1', null, title), ...right);

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
      kpi(o.reports_new, 'Segnalazioni da decidere', (o.reports_queued || 0) + ' in coda per Claude', o.reports_new > 0)),
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
  return el('div', { class: 'bars' }, ...rows.map(([label, n, extra]) => el('div', { class: 'bar-r', title: extra || '' }, el('span', null, label), el('span', { class: 'track' }, el('i', { style: 'width:' + Math.max(2, n / max * 100) + '%' })), el('b', null, n))));
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
    const note = el('textarea', { class: 'note', placeholder: 'Note private su questo utente (le vedi solo tu)' }); note.value = a.note || '';
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
      el('section', null, el('h3', null, 'Note'), note, el('div', { class: 'row', style: 'margin-top:8px' }, el('button', { class: 'btn sm', type: 'button', onclick: () => save({ note: note.value }, 'Nota salvata') }, 'Salva nota'))),
      el('section', { class: 'blockbox' }, el('h3', { style: 'margin:0' }, a.blocked ? 'Account bloccato' : 'Blocca l\'account'),
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
  rc(main, head('Segnalazioni', seg, el('button', { class: 'btn primary', type: 'button', onclick: newRequest }, '＋ Nuova richiesta')), S.err ? el('div', { class: 'err' }, S.err) : null, split);
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
        r.done_note ? el('div', { class: 'box done' }, el('h3', null, r.done_version ? 'Fatto nella ' + r.done_version : 'Cosa è stato fatto'), el('p', null, r.done_note)) : null,
        (r.errors || []).length ? el('details', { class: 'box' }, el('summary', null, 'Errori (' + r.errors.length + ')'), el('pre', null, r.errors.join('\n\n'))) : null,
        r.log ? el('details', { class: 'box' }, el('summary', null, 'Log'), el('pre', null, r.log.split('\n').filter((l) => !/^\[(http|media)\]/.test(l)).slice(-80).join('\n'))) : null),
      el('div', { class: 'act' }, el('div', { class: 'act-in' }, note, el('div', { class: 'row' },
        st === 'fatta' || st === 'chiusa'
          ? el('button', { class: 'btn', type: 'button', onclick: () => decide('approvata') }, 'Riapri con la nota')
          : [el('button', { class: 'btn good', type: 'button', onclick: () => decide('approvata') }, st === 'nuova' ? 'Approva' : 'Aggiorna la nota', el('kbd', null, 'A')),
             st !== 'rifiutata' ? el('button', { class: 'btn bad', type: 'button', onclick: () => decide('rifiutata') }, 'Rifiuta', el('kbd', null, 'R')) : null,
             st !== 'nuova' ? el('button', { class: 'btn', type: 'button', onclick: () => decide('nuova') }, 'Rimetti da decidere') : null],
        el('span', { class: 'grow' }),
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
  else if ((e.key === 'a' || e.key === 'r') && i >= 0 && !['fatta', 'chiusa'].includes(rows[i].status)) { const b = [...document.querySelectorAll('.act .btn')].find((x) => x.textContent.startsWith(e.key === 'a' ? 'Approva' : 'Rifiuta')); if (b) b.click(); }
});

// ------------------------------------------------------------------ avvio
let startView = 'overview';
try { startView = localStorage.getItem('nuvora.admin.view') || 'overview'; } catch (e) { /* */ }
go(['overview', 'users', 'reports', 'beta'].includes(startView) ? startView : 'overview');
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
    screen(el('h1', null, 'Accedi'), el('p', { class: 'muted' }, 'Solo per l\'amministratore.'),
      note ? el('p', { class: 'gate-err' }, note) : null,
      el('button', { class: 'btn primary', type: 'button', onclick: () => sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + '/' } }) }, 'Accedi con Google'));
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
function enter() {
  READY = true;
  $('#gate').hidden = true; $('.app').hidden = false;
  go(S.view);
  load(S.view, true);
  poll = setInterval(() => { if (document.visibilityState === 'visible') load(S.view, true); }, 120000);
}
$('#logout').addEventListener('click', async () => { await sb.auth.signOut(); gate(); });
sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') { READY = false; } });
gate();
