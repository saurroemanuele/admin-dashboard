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
const VIEW_PERM = { today: 'launch', people: 'founders', creators: 'creators', mail: 'creators', overview: '', apis: 'money', status: '', messages: 'messages', money: 'money', webclip: 'money', launch: 'launch', site: 'launch', social: '', tasks: 'tasks', reports: 'reports', updates: '', users: 'users', shop: 'shop', beta: 'beta', team: 'team' };
const allowed = (v) => v in VIEW_PERM && (!VIEW_PERM[v] || CAN(VIEW_PERM[v]));
const ROLE_NAME = { owner: 'Proprietario', admin: 'Admin', supporto: 'Supporto', sviluppo: 'Sviluppo', marketing: 'Marketing', lettura: 'Solo lettura', custom: 'Personalizzato' };
function paintMe() {
  document.querySelectorAll('.nav-i[data-perm]').forEach((b) => { b.hidden = !CAN(b.dataset.perm); });
  // titoli dei gruppi: spariscono se nel gruppo non c'e' niente da vedere
  document.querySelectorAll('.nav-h').forEach((hd) => { let x = hd.nextElementSibling, any = false; while (x && x.classList.contains('nav-i')) { if (!x.hidden) any = true; x = x.nextElementSibling; } hd.hidden = !any; });
  const me = $('#me'); if (me && ME) rc(me, el('b', null, ME.name || ME.email), el('small', null, ROLE_NAME[ME.role] || ME.role));
  const sb2 = $('#sbadge'); if (sb2 && ME) { sb2.hidden = !ME.issues; sb2.textContent = ME.issues || ''; sb2.title = 'Servizi che non funzionano'; }
  const tb = $('#tbadge'); if (tb && ME) { tb.hidden = !ME.my_tasks; tb.textContent = ME.my_tasks || ''; tb.title = 'Task assegnate a te'; }
}
function go(view) {
  if (!allowed(view)) view = allowed('today') ? 'today' : 'overview';
  S.view = view;
  document.querySelectorAll('.nav-i').forEach((b) => b.setAttribute('aria-current', b.dataset.view === view ? 'page' : 'false'));
  try { localStorage.setItem('nuvora.admin.view2', view); } catch (e) { /* */ }
  render();
  load(view);
}
document.querySelectorAll('.nav-i').forEach((b) => b.addEventListener('click', () => go(b.dataset.view)));
$('#reload').addEventListener('click', () => { S.rdet = {}; load(S.view, true); });

async function load(view, force) {
  if (!READY) return;
  try {
    if (view === 'overview' || (force && CAN('reports')) || !S.ov) { S.ov = await sql('overview'); }
    if (view === 'today' && (force || !S.today)) S.today = await sql('today', { period: S.tper || 'today' });
    if (view === 'users' && (force || !S.users)) S.users = await sql('users', { limit: 2000 });
    if (view === 'reports' && (force || !S.reports)) S.reports = await sql('reports', {});
    if (view === 'beta' && (force || !S.beta)) S.beta = await sql('beta_list');
    if (view === 'shop' && (force || !S.shop)) S.shop = await sql('catalog', { op: 'list' });
    if (view === 'launch' && (force || !S.launch)) S.launch = await sql('launch');
    if (view === 'site' && (force || !S.site)) S.site = await sql('site', { days: S.sdays || 30 });
    if (view === 'social' && (force || !S.soc)) S.soc = await sql('social', { days: S.socdays || 30 });
    if (view === 'status' && (force || !S.status)) S.status = await sql('status');
    if (view === 'messages' && (force || !S.messages)) S.messages = await sql('messages');
    if (view === 'money' && (force || !S.money)) S.money = await sql('money', { days: S.mdays || 30 });
    if (view === 'webclip' && (force || !S.wc)) S.wc = await sql('webclip', { days: S.wdays || 30 });
    if (view === 'apis' && (force || !S.keys)) S.keys = await loadKeys();
    if (view === 'tasks' && (force || !S.tasks)) S.tasks = await sql('tasks');
    if ((view === 'creators' || view === 'mail') && (force || !S.cr)) S.cr = await sql('creators');
    if (view === 'people' && (force || !S.ppl)) S.ppl = await sql('people_stats');
    if (view === 'updates' && (force || !S.rel)) S.rel = await sql('releases');
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
  if (S.view === 'today') renderToday(main);
  if (S.view === 'overview') rc(main, head('Uso dell\'app'), el('div', { class: 'body' }, S.err ? el('div', { class: 'err' }, S.err) : null, S.ov ? overview(S.ov) : el('div', { class: 'loading' }, 'Caricamento…')));
  if (S.view === 'users') renderUsers(main);
  if (S.view === 'reports') renderReports(main);
  if (S.view === 'beta') renderBeta(main);
  if (S.view === 'shop') renderShop(main);
  if (S.view === 'launch') renderLaunch(main);
  if (S.view === 'site') renderSite(main);
  if (S.view === 'social') renderSocial(main);
  if (S.view === 'tasks') renderTasks(main);
  if (S.view === 'creators') renderCreators(main);
  if (S.view === 'people') renderPeople(main);
  if (S.view === 'mail') renderMail(main);
  if (S.view === 'team') renderTeam(main);
  if (S.view === 'status') renderStatus(main);
  if (S.view === 'messages') renderMessages(main);
  if (S.view === 'money') renderMoney(main);
  if (S.view === 'webclip') renderWebclip(main);
  if (S.view === 'apis') renderApis(main);
  if (S.view === 'updates') renderUpdates(main);
}
const SUB = {
  Oggi: 'I numeri del giorno in un colpo d\'occhio: chi arriva, chi si iscrive, chi usa NoonFrame e cosa compra.',
  'Uso dell\'app': 'Come usano l\'app gli utenti: iscritti, attivi e funzioni più usate negli ultimi 30 giorni.',
  Utenti: 'Tutti gli account NoonFrame. Clicca una persona per vedere dispositivi, uso e crediti.',
  Segnalazioni: 'Bug e idee mandati dall\'app. Le approvi, Claude le sistema in beta, tu le provi e le segni come fatte.',
  'Beta tester': 'Chi può provare le versioni nuove prima di tutti.',
  'Crediti e offerte': 'Prezzi dei piani, ricariche e offerte lampo che vedono gli utenti nell\'app.',
  'Social del team': 'Chi ha postato, quanto e con che risultati. Tutti vedono l\'andamento di tutti.',
  Lancio: 'I numeri del lancio confrontati con gli obiettivi. Non contano le persone del team.',
  Sito: 'Chi visita noonframe.com, da dove arriva e quanti scaricano. Conteggi anonimi, senza cookie.',
  Task: 'Le cose da fare del team. Trascina una card per cambiarne lo stato.',
  'Team e permessi': 'Chi può entrare in questo pannello e cosa può fare.',
  Persone: 'Solo per i founder: quanto lavora ogni persona del team, creator trovati, email, risposte e task.',
  Creator: 'I creator trovati dal team. Con l\'email ricevono la bozza; senza email si scrivono su Instagram.',
  'Email e messaggi': 'Le bozze per i creator: le email partono dalla casella ufficiale di NoonFrame, i messaggi DM si copiano e incollano. {nome} si mette da solo, gli altri campi li completa chi assegna la bozza.',
  Stato: 'Se i servizi di NoonFrame funzionano. Se qualcosa diventa rosso, è da sistemare.',
  Messaggi: 'Avvisi e novità che arrivano nella campanella dell\'app.',
  'Clip dal web': 'Le clip create dal sito: quanti lavori, quanto costano davvero (AI e server) e quanto rendono. Da qui metti il tetto di spesa o le fermi.',
  Soldi: 'Quanto costano davvero le AI e quanti crediti sono ancora in giro.',
  Aggiornamenti: 'Tutte le versioni di NoonFrame: cosa c\'è in beta, cosa hanno gli utenti e cosa è cambiato ogni volta.',
  'API e fornitori': 'I servizi che pagano le AI dell\'app: se le chiavi ci sono, quanto credito resta e dove ricaricare.',
};
const head = (title, ...right) => el('div', { class: 'head' }, el('div', { class: 'ttl' }, el('h1', null, title), SUB[title] ? el('p', null, SUB[title]) : null), ...right);

// ------------------------------------------------------------------ oggi: i numeri del giorno (o degli ultimi 7/30 giorni) in una pagina sola
const TPER = [['today', 'Oggi', 'ieri'], ['7', '7 giorni', 'i 7 giorni prima'], ['30', '30 giorni', 'i 30 giorni prima']];
function renderToday(main) {
  S.tper = S.tper || 'today';
  const reload = async (k) => { S.tper = k; S.today = null; renderToday(main); try { S.today = await sql('today', { period: k }); S.err = null; } catch (e) { S.err = explain(e); } renderToday(main); };
  const seg = el('div', { class: 'seg' }, ...TPER.map(([k, l]) => el('button', { type: 'button', 'aria-pressed': String(S.tper === k), onclick: () => reload(k) }, l)));
  const body = el('div', { class: 'body' });
  rc(main, head('Oggi', seg), body);
  if (S.err) { rc(body, el('div', { class: 'err' }, S.err)); return; }
  const T = S.today; if (!T) { rc(body, el('div', { class: 'loading' }, 'Caricamento…')); return; }
  const prevLab = (TPER.find((x) => x[0] === S.tper) || TPER[0])[2];
  const cmp = (now, prev) => {
    const d = (+now || 0) - (+prev || 0);
    return el('small', { class: 'td-cmp ' + (d > 0 ? 'td-up' : d < 0 ? 'td-dn' : '') }, (d > 0 ? '+' : '') + num(d) + ' rispetto a ' + prevLab + ' (' + num(prev) + ')');
  };
  const card = (label, value, sub, go_) => el(go_ ? 'button' : 'div', { class: 'kpi td-k' + (go_ ? ' td-go' : ''), type: go_ ? 'button' : null, onclick: go_ ? () => go(go_) : null },
    el('b', null, value), el('span', null, label), sub || null);
  const people = T.people || [];
  rc(body, el('div', { class: 'ov' },
    el('h2', { class: 'td-h' }, 'Persone'),
    el('div', { class: 'kpis' },
      card('Nuovi iscritti', num(T.signups), cmp(T.signups, T.signups_prev), CAN('users') ? 'users' : null),
      card('Hanno usato l\'app', num(T.active), cmp(T.active, T.active_prev)),
      card('Visite al sito', num(T.visits), T.live_now ? el('small', { class: 'td-live' }, el('i'), num(T.live_now) + ' sul sito adesso') : cmp(T.visits, T.visits_prev), 'site'),
      card('Download e link chiesti', num(T.downloads), cmp(T.downloads, T.downloads_prev), 'site')),
    el('h2', { class: 'td-h' }, 'Uso e soldi'),
    el('div', { class: 'kpis' },
      card('Ricerche di clip', num((+T.clips_app || 0) + (+T.clips_web || 0)), el('small', null, num(T.clips_app) + ' dall\'app · ' + num(T.clips_web) + ' dal sito (' + num(T.clips_web_done) + ' riuscite)'), CAN('money') ? 'webclip' : null),
      card('Video esportati', num(T.exports), el('small', null, 'dall\'app sul computer')),
      card('Crediti AI usati', num(T.credits_used), el('small', null, 'su ' + num(T.users_total) + ' utenti in tutto'), CAN('money') ? 'money' : null),
      card('Acquisti', num(T.purchases), el('small', null, T.purchases ? num(T.credits_bought) + ' crediti comprati' : num(T.subs_active) + (T.subs_active === 1 ? ' abbonamento attivo' : ' abbonamenti attivi')), CAN('money') ? 'money' : null),
      card('Segnalazioni nuove', num(T.reports_new), el('small', { class: T.reports_todo ? 'td-cmp td-up' : '' }, T.reports_todo ? num(T.reports_todo) + ' da decidere' : 'nessuna da decidere'), CAN('reports') ? 'reports' : null)),
    S.tper !== 'today' && (T.series || []).length > 1 ? el('div', { class: 'card chart' }, el('h2', null, 'Giorno per giorno',
      el('span', { class: 'leg' }, el('span', null, el('i', { style: 'background:var(--c1)' }), 'Nuovi iscritti'), el('span', null, el('i', { style: 'background:var(--c3)' }), 'Hanno usato l\'app'))), chart(T.series)) : null,
    el('div', { class: 'card' }, el('h2', null, S.tper === 'today' ? 'Chi si è iscritto oggi' : 'Chi si è iscritto', el('span', { class: 'segn' }, num(people.length))),
      people.length ? el('table', { class: 'tbl site-tbl req-tbl td-tbl' },
        el('thead', null, el('tr', null, el('th', null, 'Chi'), T.people.some((x) => x.email) ? el('th', null, 'Email') : null, el('th', null, 'Quando'), el('th', null, 'Computer'), el('th', null, 'Cosa ha fatto'), el('th', null, 'Crediti'))),
        el('tbody', null, ...people.map((x) => el('tr', { onclick: CAN('users') ? () => openUser(x.id) : null, style: CAN('users') ? null : 'cursor:default' },
          el('td', { class: 'req-mail' }, x.who || '—'),
          T.people.some((y) => y.email) ? el('td', { 'data-l': 'Email', class: 'muted' }, x.email || '') : null,
          el('td', { 'data-l': 'Quando', class: 'muted' }, when(x.at)),
          el('td', { 'data-l': 'Computer' }, PLAT[x.platform] || (x.web ? 'Dal sito' : '—')),
          el('td', { 'data-l': 'Cosa ha fatto' }, [x.exports ? num(x.exports) + (x.exports === 1 ? ' video esportato' : ' video esportati') : null, x.web ? 'clip dal sito' : null].filter(Boolean).join(' · ') || el('span', { class: 'muted' }, 'ancora niente')),
          el('td', { 'data-l': 'Crediti', class: 'num' }, num(x.credits))))))
        : el('p', { class: 'muted', style: 'margin:0' }, S.tper === 'today' ? 'Nessun nuovo iscritto oggi, per ora.' : 'Nessun nuovo iscritto nel periodo.'))));
}

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
      priceYear: el('input', { class: 'search', type: 'number', step: '0.01', value: p.price_year_eur ?? '', placeholder: 'vuoto = niente annuale' }),
      monthly: el('input', { class: 'search', type: 'number', step: '1', value: p.monthly }), maxPending: el('input', { class: 'search', type: 'number', step: '1', value: p.max_pending }),
      tagline: el('input', { class: 'search', value: p.tagline || '' }), taglineEn: el('input', { class: 'search', value: p.tagline_en || '' }),
      perks: el('textarea', { class: 'note', rows: '3' }), perksEn: el('textarea', { class: 'note', rows: '3' }),
      premium: el('input', { type: 'checkbox', checked: p.premium ? true : null }), active: el('input', { type: 'checkbox', checked: p.active ? true : null }),
      sort: el('input', { class: 'search', type: 'number', step: '1', value: p.sort }),
    };
    f.perks.value = (p.perks || []).join('\n'); f.perksEn.value = (p.perks_en || []).join('\n');
    const lines = (t) => t.value.split('\n').map((x) => x.trim()).filter(Boolean);
    return el('div', { class: 'card shop-card' + (p.active ? '' : ' off') }, el('h2', null, n ? 'Nuovo piano' : p.name),
      el('div', { class: 'fgrid' }, n ? field('Codice (non si cambia)', f.id) : null, field('Nome', f.name), field('Prezzo al mese (€)', f.price), field('Prezzo all\'anno (€)', f.priceYear), field('Crediti al mese', f.monthly),
        field('Generazioni insieme', f.maxPending), field('Ordine', f.sort)),
      field('Frase sotto il nome', f.tagline), field('In inglese', f.taglineEn),
      field('Vantaggi (uno per riga)', f.perks), field('Vantaggi in inglese', f.perksEn),
      (() => { const lm = liveMargin(() => [f.price.value, f.monthly.value], 'Ti resta ogni mese'); f.price.addEventListener('input', lm.upd); f.monthly.addEventListener('input', lm.upd); return lm.slot; })(),
      (() => {
        const sub = () => { const y = +f.priceYear.value, m = +f.price.value; return y > 0 && m > 0 ? 'Annuale: sconto ' + Math.round((1 - y / (m * 12)) * 100) + '% sul mensile · ti resta in un anno' : 'Annuale (se lo imposti): ti resta in un anno'; };
        const lm = liveMargin(() => [f.priceYear.value || 0, (+f.monthly.value || 0) * 12], sub);
        [f.priceYear, f.price, f.monthly].forEach((x) => x.addEventListener('input', lm.upd)); return lm.slot; })(),
      el('div', { class: 'row', style: 'gap:16px' }, el('label', { class: 'chk' }, f.premium, ' Modelli premium'), el('label', { class: 'chk' }, f.active, ' In vendita')),
      el('button', { class: 'btn primary sm', type: 'button', onclick: () => save('save_plan', { id: n ? f.id.value.trim().toLowerCase() : p.id, name: f.name.value.trim(), price: f.price.value, priceYear: f.priceYear.value, monthly: f.monthly.value,
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
// il percorso di una segnalazione: da decidere → da fare (Claude) → da provare (in beta) → fatta
const RTABS = [['nuova', 'Da decidere'], ['fare', 'Da fare'], ['prova', 'Da provare'], ['fatta', 'Fatte'], ['rifiutata', 'Rifiutate'], ['all', 'Tutte']];
const stage = (r) => r.status === 'nuova' ? 'nuova' : r.status === 'in_lavorazione' && r.done_version ? 'prova'
  : ['approvata', 'in_lavorazione'].includes(r.status) ? 'fare' : ['rifiutata', 'chiusa'].includes(r.status) ? 'rifiutata' : 'fatta';
const inTab = (r, t) => t === 'all' || stage(r) === t;
function statusPill(st, r) {
  r = r || { status: st };
  const g = stage(r);
  if (r.question && (g === 'nuova' || g === 'fare')) return el('span', { class: 'pill new' }, 'Domanda per te');
  if (g === 'nuova') return el('span', { class: 'pill new' }, 'Da decidere');
  if (g === 'fare') return el('span', { class: 'pill queued' }, r.status === 'approvata' ? 'In coda per Claude' : 'Claude ci lavora');
  if (g === 'prova') return el('span', { class: 'pill try' }, 'Da provare · ' + r.done_version);
  if (g === 'fatta') return el('span', { class: 'pill done' }, r.done_version ? 'Fatta · ' + r.done_version : 'Fatta');
  return el('span', { class: 'pill no' }, r.status === 'chiusa' ? 'Chiusa' : 'Rifiutata');
}
const STEPS = ['Arrivata', 'Approvata', 'Claude ci lavora', 'In beta', 'Fatta'];
function tracker(r) {
  const g = stage(r);
  if (g === 'rifiutata') return null;
  const at = g === 'nuova' ? 0 : g === 'fare' ? (r.status === 'approvata' ? 1 : 2) : g === 'prova' ? 3 : 4;
  return el('ol', { class: 'track-r', 'aria-label': 'A che punto è' }, ...STEPS.map((t, i) => el('li', { class: i < at ? 'past' : i === at ? 'now' : '' }, el('i', null), el('span', null, t))));
}
function nextText(r) {
  const g = stage(r);
  if (g === 'nuova') return 'Decidi tu: se la approvi, Claude la sistema al prossimo giro (ogni 2 ore). Se non serve, rifiutala.';
  if (g === 'fare') return r.status === 'approvata' ? 'È in coda: Claude la prende al prossimo giro. Se non serve più, toglila dalla coda.'
    : 'Claude ci sta lavorando. Quando è pronta passa in «Da provare».';
  if (g === 'prova') return 'È nella beta ' + r.done_version + '. Provala: se funziona segnala come fatta, se no scrivi cosa non va e rimandala a Claude. Arriva a tutti quando la beta va in stabile.';
  if (g === 'fatta') return 'Fatta' + (r.done_version ? ' nella ' + r.done_version : '') + '. Se il problema torna, riaprila con una nota.';
  return 'Rifiutata: non verrà fatta. Puoi riaprirla se cambi idea.';
}
function actions(r, decide) {
  const b = (cls, label, k, fn, tip) => el('button', { class: 'btn' + (cls ? ' ' + cls : ''), type: 'button', 'data-k': k || null, title: tip || null, onclick: fn }, label, k ? el('kbd', null, k.toUpperCase()) : null);
  const g = stage(r);
  if (g === 'nuova') return [b('good', 'Approva', 'a', () => decide('approvata')), b('bad', 'Rifiuta', 'r', () => decide('rifiutata'))];
  if (g === 'fare') return [b('good', 'Segna come fatta', 'f', () => decide('fatta'), 'Già sistemata: esce dalla coda'),
    b('', 'Togli dalla coda', 't', () => decide('nuova'), 'Claude non la fa: torna tra quelle da decidere'),
    b('bad', 'Rifiuta', 'r', () => decide('rifiutata')), b('ghost', 'Salva la nota', null, () => decide(r.status))];
  if (g === 'prova') return [b('good', 'Funziona: segna come fatta', 'f', () => decide('fatta')),
    b('', 'Non va ancora', 'n', () => decide('approvata', true), 'Torna a Claude con la tua nota'),
    b('', 'Togli dalla coda', 't', () => decide('nuova'))];
  return [b('', g === 'fatta' ? 'Riapri' : 'Riapri e approva', 'n', () => decide('approvata', true), 'Torna a Claude con la tua nota')];
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
    const note = el('textarea', { class: 'note', id: 'rnote', placeholder: ['fatta', 'rifiutata', 'chiusa'].includes(r.status) ? 'Cosa non va? Scrivilo e riaprila.' : 'Come la vuoi, dove, cosa evitare…' });
    note.value = S.drafts[r.id] ?? (r.decision_note || '');
    note.addEventListener('input', () => { S.drafts[r.id] = note.value; });
    const decide = async (status, again) => {
      try {
        if (status === 'approvata' && again && !note.value.trim()) { note.focus(); note.placeholder = 'Scrivi cosa non va ancora: Claude riparte da qui.'; toast('Scrivi prima cosa non va'); return; }
        const nd = await sql('set_report', { id: r.id, status, note: note.value.trim() });
        delete S.drafts[r.id];
        S.rdet[r.id] = { ...r, ...nd, images: r.images };
        const i = S.reports.findIndex((x) => x.id === r.id); if (i >= 0) S.reports[i] = { ...S.reports[i], status: nd.status, question: nd.question, done_version: nd.done_version };
        toast(status === 'fatta' ? 'Segnata come fatta' : status === 'rifiutata' ? 'Rifiutata' : status === 'nuova' ? 'Tolta dalla coda: è di nuovo da decidere'
          : again || ['fatta', 'rifiutata', 'chiusa'].includes(r.status) ? 'Rimandata a Claude' : r.status === 'nuova' ? 'Approvata: Claude la prende al prossimo giro' : 'Nota salvata');
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
        tracker(r), el('p', { class: 'next' }, nextText(r)),
        el('div', { class: 'meta' }, r.app_version ? el('span', null, el('b', null, 'App'), r.app_version) : null, r.os ? el('span', null, el('b', null, 'Sistema'), r.os + (sys.machine ? ' · ' + sys.machine : '')) : null,
          sys.gpu != null ? el('span', null, el('b', null, 'GPU'), sys.gpu ? 'NVIDIA' : 'no') : null, r.screen ? el('span', null, el('b', null, 'Schermata'), r.screen) : null,
          r.contact ? el('span', null, el('b', null, 'Contatto'), r.contact) : null, r.email ? el('span', null, el('b', null, 'Email'), r.email) : null),
        imgs.length ? el('div', { class: 'shots' }, ...imgs.map((u) => el('button', { type: 'button', onclick: () => lightbox(u) }, el('img', { src: u, alt: 'Screenshot', loading: 'lazy' })))) : null,
        r.question && !['fatta', 'chiusa'].includes(st) ? el('div', { class: 'box ask' }, el('h3', null, 'Claude ti chiede'), el('p', null, r.question)) : null,
        CAN('reports_decide') ? replyBox(r) : null,
        r.done_note ? el('div', { class: 'box done' }, el('h3', null, stage(r) === 'prova' ? 'Pronta nella beta ' + r.done_version : r.done_version ? 'Fatto nella ' + r.done_version : 'Cosa è stato fatto'), el('p', null, r.done_note)) : null,
        (r.errors || []).length ? el('details', { class: 'box' }, el('summary', null, 'Errori (' + r.errors.length + ')'), el('pre', null, r.errors.join('\n\n'))) : null,
        r.log ? el('details', { class: 'box' }, el('summary', null, 'Log'), el('pre', null, r.log.split('\n').filter((l) => !/^\[(http|media)\]/.test(l)).slice(-80).join('\n'))) : null),
      !CAN('reports_decide') ? (CAN('tasks') ? el('div', { class: 'act' }, el('div', { class: 'act-in' }, el('div', { class: 'row' }, taskFromReport(r)))) : null) :
      el('div', { class: 'act' }, el('div', { class: 'act-in' }, el('label', { class: 'note-l', for: 'rnote' }, stage(r) === 'prova' ? 'Cosa non va ancora? (serve solo se la rimandi a Claude)' : 'Nota per Claude (facoltativa)'), note, el('div', { class: 'row' },
        ...actions(r, decide), el('span', { class: 'grow' }), CAN('tasks') ? taskFromReport(r) : null))));
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
        try { const id = await sql('create_request', { text, kind }); bg.remove(); toast('Richiesta inviata a Claude'); S.rtab = 'fare'; S.rsel = id; await load('reports', true); load('overview'); }
        catch (x) { e.currentTarget.disabled = false; toast(explain(x)); }
      } }, 'Invia a Claude'))));
  document.body.append(bg); ta.focus();
}

document.addEventListener('keydown', (e) => {
  if (S.view !== 'reports' || e.target.closest('textarea, input') || e.metaKey || e.ctrlKey || e.altKey || document.querySelector('.modal-bg, .lightbox, .drawer')) return;
  const rows = LIST_ROWS ? LIST_ROWS() : []; const i = rows.findIndex((r) => r.id === S.rsel);
  if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); if (rows[i + 1]) { S.rsel = rows[i + 1].id; renderReports($('#main')); } }
  else if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); if (i > 0) { S.rsel = rows[i - 1].id; renderReports($('#main')); } }
  else if (/^[artfn]$/.test(e.key) && CAN('reports_decide') && i >= 0) { const b = document.querySelector('.act [data-k="' + e.key + '"]'); if (b) b.click(); }
});


// ------------------------------------------------------------------ aggiornamenti: beta, stabile, installer e storico delle note
const UTYPE = { feat: 'Novità', fix: 'Correzione', impr: 'Miglioramento' };
const vcmp = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };
const dayIt = (d) => { if (!d) return ''; const t = new Date(String(d).length === 10 ? d + 'T12:00:00' : d); return isNaN(t) ? d : t.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: t.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined }); };
function renderUpdates(main) {
  const R = S.rel;
  const refresh = CAN('beta') ? el('button', { class: 'btn', type: 'button', onclick: async (e) => {
    const b = e.currentTarget; b.disabled = true; b.textContent = 'Controllo…';
    try { await sql('releases', { op: 'refresh' }); await new Promise((r) => setTimeout(r, 4000)); S.rel = await sql('releases'); toast('Aggiornato'); } catch (x) { toast(explain(x)); }
    render();
  } }, 'Controlla ora') : null;
  if (!R) { rc(main, head('Aggiornamenti', refresh), el('div', { class: 'body' }, S.err ? el('div', { class: 'err' }, S.err) : el('div', { class: 'loading' }, 'Caricamento…'))); return; }
  const st = R.stable || {}, be = R.beta || {}, hist = R.history || [];
  const inst = (R.installer || [])[0], instV = inst ? String(inst.tag || '').replace(/^installer-/, '') : null;
  const ahead = be.version && st.version && vcmp(be.version, st.version) > 0;
  const users = {}; ((S.ov && S.ov.versions) || []).forEach((x) => { users[x.v] = x.n; });
  const nUsers = (v) => users[v] ? users[v] + (users[v] === 1 ? ' utente' : ' utenti') : '';
  const card = (cls, label, big, sub) => el('div', { class: 'up-c ' + cls }, el('span', null, label), el('b', null, big || '—'), sub ? el('small', null, sub) : null);
  const items = (list) => el('ul', { class: 'up-items' }, ...(list || []).map((it) => el('li', null, el('span', { class: 'up-t ' + it.type }, UTYPE[it.type] || it.type), el('span', null, it.text))));
  // filtri
  const t = (S.uq2 || '').trim().toLowerCase(), ty = S.utype || 'all';
  const rows = hist.map((v) => ({ ...v, items: (v.items || []).filter((it) => (ty === 'all' || it.type === ty) && (!t || (it.text + ' ' + (it.en || '')).toLowerCase().includes(t) || String(v.version).includes(t))) }))
    .filter((v) => v.items.length || (!t && ty === 'all'));
  const shown = rows.slice(0, S.ulimit || 25);
  const q = el('input', { class: 'search', type: 'search', placeholder: 'Cerca una modifica o una versione', value: S.uq2 || '', 'aria-label': 'Cerca nelle note' });
  q.addEventListener('input', () => { S.uq2 = q.value; S.ulimit = 25; const pos = q.selectionStart; renderUpdates(main); const nq = main.querySelector('.up-tools .search'); nq.focus(); nq.setSelectionRange(pos, pos); });
  const seg = el('div', { class: 'seg' }, ...[['all', 'Tutto'], ['feat', 'Novità'], ['fix', 'Correzioni'], ['impr', 'Miglioramenti']].map(([k, l]) =>
    el('button', { type: 'button', 'aria-pressed': String(ty === k), onclick: () => { S.utype = k; S.ulimit = 25; renderUpdates(main); } }, l)));
  rc(main, head('Aggiornamenti', refresh), el('div', { class: 'body' }, S.err ? el('div', { class: 'err' }, S.err) : null, el('div', { class: 'up' },
    el('div', { class: 'up-top' },
      card('', 'Versione per tutti', st.version, [st.date ? 'Dal ' + dayIt(st.date) : '', nUsers(st.version)].filter(Boolean).join(' · ')),
      card(ahead ? 'beta' : '', 'Beta da provare', ahead ? be.version : null, ahead ? 'Solo per i beta tester, aspetta il tuo ok' : 'Nessuna beta in attesa'),
      card(instV && st.version && instV !== st.version ? 'warn' : '', 'Installer sul sito', instV, !instV ? 'Non ancora letto' : instV === st.version ? 'Uguale alla versione per tutti' : 'Indietro: si ricrea da solo a ogni versione per tutti'),
      card('', 'Versioni pubblicate', String(hist.length), hist.length ? 'Dalla ' + hist[hist.length - 1].version + ' del ' + dayIt(hist[hist.length - 1].date) : '')),
    ahead ? el('section', { class: 'up-beta' }, el('h2', null, 'In beta: ' + be.version),
      el('p', null, 'Ce l\'hanno solo i beta tester. Quando l\'hai provata, scrivi «ok» a Claude: arriva a tutti e si aggiorna anche l\'installer sul sito.'), items(be.items)) : null,
    el('div', { class: 'up-tools' }, q, seg, el('span', { class: 'grow' }), R.updated_at ? el('small', { class: 'muted' }, 'Letto ' + when(R.updated_at)) : null),
    el('div', { class: 'up-list' }, ...(shown.length ? shown.map((v) => el('article', { class: 'up-v' },
      el('div', { class: 'up-vh' }, el('b', null, v.version), el('small', null, dayIt(v.date)), nUsers(v.version) ? el('small', null, nUsers(v.version)) : null,
        v.version === st.version ? el('span', { class: 'pill done' }, 'Per tutti ora') : null),
      v.items.length ? items(v.items) : el('p', { class: 'muted', style: 'margin:0' }, 'Nessuna nota per questa versione.')))
      : [el('div', { class: 'empty' }, 'Nessuna modifica trovata.')]),
      rows.length > shown.length ? el('button', { class: 'btn up-more', type: 'button', onclick: () => { S.ulimit = (S.ulimit || 25) + 50; renderUpdates(main); } }, 'Mostra altre ' + Math.min(50, rows.length - shown.length) + ' versioni') : null))));
}

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
// ------------------------------------------------------------------ social del team: chi posta, quanto, con che risultati (tutti vedono tutti)
const SOC_PLAT = { tiktok: ['TikTok', '#FF3B6B'], instagram: ['Instagram', '#E1306C'], youtube: ['YouTube', '#FF4B4B'], x: ['X', '#C9D1DE'],
  linkedin: ['LinkedIn', '#3B8FFF'], facebook: ['Facebook', '#4F86F7'], threads: ['Threads', '#B6BFCE'], twitch: ['Twitch', '#A970FF'] };
const SOC_KIND = [['video', 'Video'], ['foto', 'Foto'], ['carosello', 'Carosello'], ['storia', 'Storia'], ['live', 'Live'], ['testo', 'Testo']];
const dKey = (d) => d.toISOString().slice(0, 10);
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return dKey(d); };
const weekStart = (iso) => { const d = new Date(iso + 'T12:00:00Z'); const wd = (d.getUTCDay() + 6) % 7; return addDays(iso, -wd); };
const platTag = (p) => el('span', { class: 'soc-plat', style: '--pc:' + (SOC_PLAT[p] || ['', '#8893A8'])[1] }, (SOC_PLAT[p] || [p])[0]);
const short = (n) => { n = +n || 0; return n >= 1e6 ? (Math.round(n / 1e5) / 10 + ' M').replace('.', ',') : n >= 1e4 ? Math.round(n / 1e3) + 'k' : num(n); };

function socStats(D) {
  const today = D.today, wk = weekStart(today), since = addDays(today, -(D.days - 1));
  const accOf = Object.fromEntries(D.accounts.map((a) => [a.id, a]));
  return D.members.map((m) => {
    const accs = D.accounts.filter((a) => a.owner === m.email);
    const posts = D.posts.filter((p) => p.owner === m.email && accOf[p.account_id]);
    const byDay = {}; posts.forEach((p) => { byDay[p.day] = (byDay[p.day] || 0) + 1; });
    let streak = 0, d = byDay[today] ? today : addDays(today, -1);
    while (byDay[d]) { streak++; d = addDays(d, -1); }
    const inPer = posts.filter((p) => p.day >= since);
    const followers = accs.reduce((s, a) => s + (a.followers || 0), 0);
    const fStart = accs.reduce((s, a) => s + (a.followers_start ?? a.followers ?? 0), 0);
    return { m, accs, posts, byDay, streak, today: byDay[today] || 0, week: posts.filter((p) => p.day >= wk).length,
      goal: accs.reduce((s, a) => s + (a.goal_week || 0), 0), period: inPer.length, views: inPer.reduce((s, p) => s + (+p.views || 0), 0),
      followers, growth: followers - fStart, last: posts[0] ? posts[0].day : null };
  });
}

function renderSocial(main) {
  S.socdays = S.socdays || 30;
  const seg = el('div', { class: 'seg' }, ...[[7, '7 giorni'], [30, '30 giorni'], [90, '90 giorni']].map(([d, l]) =>
    el('button', { type: 'button', 'aria-pressed': String(S.socdays === d), onclick: async () => { S.socdays = d; S.soc = null; renderSocial(main); try { S.soc = await sql('social', { days: d }); S.err = null; } catch (e) { S.err = explain(e); } renderSocial(main); } }, l)));
  const D0 = S.soc;
  const addBtn = el('button', { class: 'btn primary', type: 'button', disabled: !D0 || !D0.accounts.some((a) => a.owner === D0.me || D0.can_all), onclick: () => socPostModal(null, main) }, '+ Segna un post');
  const body = el('div', { class: 'body' });
  rc(main, head('Social del team', seg, addBtn), body);
  if (S.err) { rc(body, el('div', { class: 'err' }, S.err)); return; }
  const D = S.soc; if (!D) { rc(body, el('div', { class: 'loading' }, 'Caricamento…')); return; }
  const st = socStats(D);
  const mine = st.find((x) => x.m.email === D.me);
  const accOf = Object.fromEntries(D.accounts.map((a) => [a.id, a]));
  const nameOf = (e) => { const m = D.members.find((x) => x.email === e); return (m && (m.name || m.email.split('@')[0])) || e.split('@')[0]; };
  const tot = st.reduce((s, x) => ({ today: s.today + x.today, week: s.week + x.week, goal: s.goal + x.goal, period: s.period + x.period, views: s.views + x.views }), { today: 0, week: 0, goal: 0, period: 0, views: 0 });
  const kpi = (v, label, sub, cls) => el('div', { class: 'kpi' + (cls ? ' ' + cls : '') }, el('b', null, v), el('span', null, label), sub ? el('small', null, sub) : null);
  const postedToday = st.filter((x) => x.today).length, withAcc = st.filter((x) => x.accs.length).length;

  // ---- la mia striscia: un clic per segnare che oggi ho postato
  const myBox = el('div', { class: 'card soc-mine' },
    el('h2', null, 'I tuoi account', el('button', { class: 'btn', type: 'button', onclick: () => socAccountModal(null, main) }, '+ Account')),
    mine && mine.accs.length ? el('div', { class: 'soc-accs' }, ...mine.accs.map((a) => {
      const n = D.posts.filter((p) => p.account_id === a.id && p.day === D.today).length;
      return el('div', { class: 'soc-acc' },
        el('div', { class: 'soc-acc-h' }, platTag(a.platform), el('b', null, '@' + a.handle),
          el('button', { class: 'iconbtn', type: 'button', title: 'Modifica account', 'aria-label': 'Modifica account', onclick: () => socAccountModal(a, main) }, '⋯')),
        el('div', { class: 'soc-acc-n' }, el('span', null, a.followers != null ? short(a.followers) + ' follower' : 'Follower non segnati'),
          el('button', { class: 'linkbtn', type: 'button', onclick: () => socFollowers(a, main) }, 'Aggiorna')),
        el('button', { class: 'btn ' + (n ? 'good' : 'primary') + ' soc-today', type: 'button', onclick: () => socPostModal({ account_id: a.id, day: D.today, kind: 'video' }, main, true) },
          n ? '✓ Postato oggi' + (n > 1 ? ' · ' + n : '') + '  +1' : 'Ho postato oggi'));
    })) : el('p', { class: 'muted', style: 'margin:0' }, 'Aggiungi i tuoi profili (TikTok, Instagram, YouTube…) e l\'obiettivo di post a settimana. Poi ogni giorno basta un clic.'));

  // ---- classifica del team
  const ranked = st.slice().sort((a, b) => (b.week / Math.max(1, b.goal)) - (a.week / Math.max(1, a.goal)) || b.period - a.period);
  const heat = (x) => {
    const days = [...Array(28)].map((_, i) => addDays(D.today, i - 27));
    return el('div', { class: 'soc-heat', 'aria-label': 'Ultime 4 settimane' }, ...days.map((d) => {
      const n = x.byDay[d] || 0;
      return el('i', { class: 'h' + Math.min(3, n) + (d === D.today ? ' now' : ''), title: shortDay(d) + ': ' + (n ? n + (n === 1 ? ' post' : ' post') : 'niente') });
    }));
  };
  const rows = ranked.map((x) => {
    const pct = x.goal ? Math.min(100, Math.round(x.week / x.goal * 100)) : 0;
    const state = x.today ? el('span', { class: 'pill done' }, 'Ha postato oggi') : x.accs.length ? el('span', { class: 'pill' }, 'Non ancora oggi') : el('span', { class: 'pill dim' }, 'Nessun account');
    return el('div', { class: 'soc-row' + (x.m.email === D.me ? ' me' : ''), onclick: () => { S.socwho = S.socwho === x.m.email ? null : x.m.email; renderSocial(main); }, 'aria-pressed': String(S.socwho === x.m.email) },
      el('div', { class: 'soc-who' }, el('span', { class: 'av' }, nameOf(x.m.email).charAt(0).toUpperCase()),
        el('div', null, el('b', null, nameOf(x.m.email) + (x.m.email === D.me ? ' (tu)' : '')),
          el('small', null, x.accs.length ? x.accs.map((a) => (SOC_PLAT[a.platform] || [a.platform])[0]).join(' · ') : 'Nessun profilo'))),
      state,
      el('div', { class: 'soc-goal', title: 'Post di questa settimana sull\'obiettivo' },
        el('span', null, el('b', null, x.week), ' / ' + (x.goal || '—') + ' questa settimana'),
        el('span', { class: 'track' }, el('i', { style: 'width:' + pct + '%', class: pct >= 100 ? 'full' : '' }))),
      el('div', { class: 'soc-num' }, el('b', null, x.streak), el('small', null, x.streak === 1 ? 'giorno di fila' : 'giorni di fila')),
      el('div', { class: 'soc-num' }, el('b', null, short(x.views)), el('small', null, 'views')),
      el('div', { class: 'soc-num' }, el('b', { class: x.growth > 0 ? 'grow' : '' }, (x.growth > 0 ? '+' : '') + short(x.growth)), el('small', null, 'follower')),
      heat(x));
  });

  // ---- post recenti (filtrabili per persona)
  const feedAll = D.posts.filter((p) => accOf[p.account_id] && (!S.socwho || p.owner === S.socwho));
  const feedList = feedAll.slice(0, S.socmore ? 200 : 15);
  const canEdit = (p) => p.owner === D.me || D.can_all;
  const feed = feedList.length ? el('table', { class: 'tbl soc-tbl' },
    el('thead', null, el('tr', null, el('th', null, 'Chi'), el('th', null, 'Dove'), el('th', null, 'Quando'), el('th', null, 'Cosa'), el('th', { class: 'r' }, 'Views'), el('th', { class: 'r' }, 'Like'), el('th', { class: 'r' }, 'Commenti'))),
    el('tbody', null, ...feedList.map((p) => {
      const a = accOf[p.account_id];
      return el('tr', { class: canEdit(p) ? '' : 'ro', onclick: canEdit(p) ? () => socPostModal(p, main) : null, title: canEdit(p) ? 'Modifica' : null },
        el('td', null, nameOf(p.owner)), el('td', null, platTag(a.platform), ' @' + a.handle),
        el('td', null, p.day === D.today ? 'Oggi' : p.day === addDays(D.today, -1) ? 'Ieri' : shortDay(p.day)),
        el('td', { class: 'soc-what' }, el('span', { class: 'muted' }, (SOC_KIND.find((k) => k[0] === p.kind) || [0, p.kind])[1]), p.title ? ' · ' + p.title : '',
          p.url ? el('a', { href: p.url, target: '_blank', rel: 'noopener noreferrer', onclick: (e) => e.stopPropagation(), class: 'soc-link' }, 'Apri') : null),
        el('td', { class: 'num' }, p.views != null ? short(p.views) : '—'), el('td', { class: 'num' }, p.likes != null ? short(p.likes) : '—'), el('td', { class: 'num' }, p.comments != null ? short(p.comments) : '—'));
    }))) : el('p', { class: 'muted', style: 'margin:0' }, S.socwho ? 'Nessun post di questa persona nel periodo.' : 'Ancora nessun post segnato.');

  // ---- per piattaforma
  const since = addDays(D.today, -(D.days - 1));
  const byPlat = {}; D.posts.filter((p) => p.day >= since && accOf[p.account_id]).forEach((p) => { const k = accOf[p.account_id].platform; byPlat[k] = byPlat[k] || { n: 0, v: 0 }; byPlat[k].n++; byPlat[k].v += +p.views || 0; });
  const platRows = Object.entries(byPlat).sort((a, b) => b[1].n - a[1].n);

  rc(body, el('div', { class: 'ov' },
    el('div', { class: 'kpis' },
      kpi(postedToday + ' / ' + (withAcc || st.length), 'Hanno postato oggi', postedToday === withAcc && withAcc ? 'Tutti, ottimo' : 'Persone con almeno un post oggi', postedToday === withAcc && withAcc ? '' : 'hot'),
      kpi(num(tot.week) + (tot.goal ? ' / ' + num(tot.goal) : ''), 'Post questa settimana', tot.goal ? Math.round(tot.week / tot.goal * 100) + '% dell\'obiettivo del team' : 'Nessun obiettivo impostato'),
      kpi(num(tot.period), 'Post', 'negli ultimi ' + D.days + ' giorni'),
      kpi(short(tot.views), 'Views', 'dei post degli ultimi ' + D.days + ' giorni')),
    myBox,
    el('div', { class: 'card' }, el('h2', null, 'Il team', el('small', { class: 'muted' }, S.socwho ? 'Filtro: ' + nameOf(S.socwho) + ' · clicca di nuovo per togliere' : 'Clicca una persona per vedere solo i suoi post')),
      el('div', { class: 'soc-rows' }, ...rows)),
    el('div', { class: 'cards' },
      el('div', { class: 'card', style: 'min-width:0;overflow-x:auto' }, el('h2', null, 'Post recenti'), feed,
        feedAll.length > feedList.length ? el('button', { class: 'btn', type: 'button', style: 'margin-top:10px', onclick: () => { S.socmore = true; renderSocial(main); } }, 'Mostra tutti (' + feedAll.length + ')') : null),
      el('div', { class: 'card' }, el('h2', null, 'Per piattaforma'), platRows.length ? barList(platRows.map(([k, v]) => [(SOC_PLAT[k] || [k])[0] + ' · ' + short(v.v) + ' views', v.n])) : el('p', { class: 'muted', style: 'margin:0' }, 'Nessun dato'))),
    el('p', { class: 'muted fine' }, 'Tutto il team vede l\'andamento di tutti; ognuno modifica solo i suoi post e i suoi account. Views, like e follower li segni tu: aggiornali quando vuoi dal post.')));
}

function socModalShell(title, kids, foot) {
  const close = () => { bg.remove(); document.removeEventListener('keydown', esc); };
  const esc = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', esc);
  const bg = el('div', { class: 'modal-bg', onclick: (e) => { if (e.target === bg) close(); } },
    el('div', { class: 'modal shop-modal soc-modal', role: 'dialog', 'aria-label': title }, el('h2', null, title), ...kids, el('div', { class: 'row', style: 'justify-content:flex-end;gap:8px;margin-top:6px' }, ...foot(close))));
  document.body.append(bg);
  return close;
}
const socField = (label, input, hint) => el('label', { class: 'fld' }, el('span', null, label), input, hint ? el('small', { class: 'muted' }, hint) : null);
const intOrNull = (v) => { const s = String(v || '').replace(/[^0-9]/g, ''); return s === '' ? null : s; };

function socPostModal(p, main, quick) {
  const D = S.soc, isNew = !p || !p.id;
  p = { account_id: '', day: D.today, kind: 'video', url: '', title: '', views: null, likes: null, comments: null, ...(p || {}) };
  const accs = D.accounts.filter((a) => a.owner === D.me || (D.can_all && (isNew ? a.owner === D.me : a.owner === p.owner)));
  if (!accs.length) { toast('Aggiungi prima un account'); return; }
  const acc = el('select', { class: 'search' }, ...accs.map((a) => el('option', { value: a.id, selected: a.id === p.account_id }, (SOC_PLAT[a.platform] || [a.platform])[0] + ' · @' + a.handle)));
  const day = el('input', { class: 'search', type: 'date', value: p.day, max: D.today });
  const kind = el('select', { class: 'search' }, ...SOC_KIND.map(([v, l]) => el('option', { value: v, selected: p.kind === v }, l)));
  const url = el('input', { class: 'search', type: 'url', placeholder: 'https://…', value: p.url || '', maxlength: '300' });
  const title = el('input', { class: 'search', placeholder: 'Di cosa parla (facoltativo)', value: p.title || '', maxlength: '140' });
  const metric = (v, ph) => el('input', { class: 'search', inputmode: 'numeric', placeholder: ph, value: v == null ? '' : String(v) });
  const views = metric(p.views, '0'), likes = metric(p.likes, '0'), comments = metric(p.comments, '0');
  let armed = false;
  socModalShell(isNew ? (quick ? 'Ho postato oggi' : 'Segna un post') : 'Post', [
    el('div', { class: 'soc-grid' }, socField('Account', acc), socField('Giorno', day), socField('Tipo', kind)),
    socField('Link al post', url, 'Facoltativo: così il team lo apre al volo'),
    socField('Titolo o argomento', title),
    el('div', { class: 'soc-grid' }, socField('Views', views), socField('Like', likes), socField('Commenti', comments)),
    isNew ? el('p', { class: 'muted', style: 'margin:0;font-size:12.5px' }, 'I numeri puoi lasciarli vuoti e aggiungerli tra qualche giorno, quando il post ha girato.') : null,
  ], (close) => [
    !isNew ? el('button', { class: 'btn bad', type: 'button', style: 'margin-right:auto', onclick: async (e) => {
      if (!armed) { armed = true; e.currentTarget.textContent = 'Conferma: elimina'; return; }
      e.currentTarget.disabled = true;
      try { await sql('social_save', { op: 'post_remove', id: p.id }); S.soc.posts = S.soc.posts.filter((x) => x.id !== p.id); close(); toast('Post eliminato'); renderSocial(main); }
      catch (er) { toast(explain(er)); e.currentTarget.disabled = false; }
    } }, 'Elimina') : null,
    el('button', { class: 'btn', type: 'button', onclick: close }, 'Annulla'),
    el('button', { class: 'btn primary', type: 'button', onclick: async (e) => {
      e.currentTarget.disabled = true;
      try {
        const r = await sql('social_save', { op: 'post', id: isNew ? null : p.id, account_id: acc.value, day: day.value, kind: kind.value, url: url.value.trim(), title: title.value.trim(),
          views: intOrNull(views.value), likes: intOrNull(likes.value), comments: intOrNull(comments.value) });
        S.soc.posts = [r, ...S.soc.posts.filter((x) => x.id !== r.id)].sort((a, b) => (b.day > a.day ? 1 : b.day < a.day ? -1 : (b.at > a.at ? 1 : -1)));
        close(); toast(isNew ? 'Segnato, bravo!' : 'Post aggiornato'); renderSocial(main);
      } catch (er) { toast(explain(er)); e.currentTarget.disabled = false; }
    } }, isNew ? 'Segna' : 'Salva'),
  ]);
  (quick ? url : acc).focus();
}

function socAccountModal(a, main) {
  const D = S.soc, isNew = !a;
  a = a || { platform: 'tiktok', handle: '', url: '', goal_week: 3, owner: D.me };
  const plat = el('select', { class: 'search' }, ...Object.entries(SOC_PLAT).map(([k, [l]]) => el('option', { value: k, selected: a.platform === k }, l)));
  const handle = el('input', { class: 'search', placeholder: 'nomeprofilo', value: a.handle, maxlength: '60' });
  const url = el('input', { class: 'search', type: 'url', placeholder: 'https://www.tiktok.com/@nomeprofilo', value: a.url || '', maxlength: '300' });
  const goal = el('input', { class: 'search', type: 'number', min: '0', max: '50', value: String(a.goal_week ?? 3) });
  const owner = D.can_all && isNew ? el('select', { class: 'search' }, ...D.members.map((m) => el('option', { value: m.email, selected: m.email === D.me }, m.name || m.email))) : null;
  let armed = false;
  socModalShell(isNew ? 'Nuovo account' : 'Account', [
    owner ? socField('Di chi è', owner) : null,
    el('div', { class: 'soc-grid' }, socField('Piattaforma', plat), socField('Nome profilo', handle, 'Senza la @')),
    socField('Link al profilo', url, 'Facoltativo'),
    socField('Post a settimana (obiettivo)', goal, 'Lo vede tutto il team, insieme a quanti ne hai fatti'),
  ], (close) => [
    !isNew ? el('button', { class: 'btn bad', type: 'button', style: 'margin-right:auto', onclick: async (e) => {
      if (!armed) { armed = true; e.currentTarget.textContent = 'Conferma: togli'; return; }
      e.currentTarget.disabled = true;
      try { await sql('social_save', { op: 'account_remove', id: a.id }); S.soc.accounts = S.soc.accounts.filter((x) => x.id !== a.id); close(); toast('Account tolto'); renderSocial(main); }
      catch (er) { toast(explain(er)); e.currentTarget.disabled = false; }
    } }, 'Togli account') : null,
    el('button', { class: 'btn', type: 'button', onclick: close }, 'Annulla'),
    el('button', { class: 'btn primary', type: 'button', onclick: async (e) => {
      e.currentTarget.disabled = true;
      try {
        const r = await sql('social_save', { op: 'account', id: isNew ? null : a.id, platform: plat.value, handle: handle.value.trim(), url: url.value.trim(), goal_week: goal.value, owner: owner ? owner.value : null });
        const prev = S.soc.accounts.find((x) => x.id === r.id);
        const row = { ...(prev || {}), id: r.id, owner: r.owner, platform: r.platform, handle: r.handle, url: r.url, goal_week: r.goal_week, followers: r.followers, followers_at: r.followers_at };
        S.soc.accounts = prev ? S.soc.accounts.map((x) => (x.id === r.id ? row : x)) : [...S.soc.accounts, row];
        close(); toast(isNew ? 'Account aggiunto' : 'Account aggiornato'); renderSocial(main);
      } catch (er) { toast(explain(er)); e.currentTarget.disabled = false; }
    } }, isNew ? 'Aggiungi' : 'Salva'),
  ]);
  handle.focus();
}

function socFollowers(a, main) {
  const n = el('input', { class: 'search', inputmode: 'numeric', placeholder: 'es. 12500', value: a.followers == null ? '' : String(a.followers) });
  socModalShell('Follower di @' + a.handle, [socField('Quanti follower ha adesso', n, 'Segnali ogni tanto: il team vede di quanto cresce ogni profilo')], (close) => [
    el('button', { class: 'btn', type: 'button', onclick: close }, 'Annulla'),
    el('button', { class: 'btn primary', type: 'button', onclick: async (e) => {
      e.currentTarget.disabled = true;
      try { const r = await sql('social_save', { op: 'followers', account_id: a.id, n: n.value }); Object.assign(S.soc.accounts.find((x) => x.id === a.id), { followers: r.followers, followers_at: r.followers_at }); close(); toast('Follower aggiornati'); renderSocial(main); }
      catch (er) { toast(explain(er)); e.currentTarget.disabled = false; }
    } }, 'Salva'),
  ]);
  n.focus(); n.select();
}

// ------------------------------------------------------------------ sito: visite anonime di noonframe.com
const SRC_NAME = { diretto: 'Diretto o link senza provenienza', 'tiktok.com': 'TikTok', 'instagram.com': 'Instagram', 'l.instagram.com': 'Instagram', 'youtube.com': 'YouTube', 'm.youtube.com': 'YouTube',
  'google.com': 'Google', 'google.it': 'Google', 'bing.com': 'Bing', 'twitch.tv': 'Twitch', 'kick.com': 'Kick', 'x.com': 'X', 't.co': 'X', 'facebook.com': 'Facebook', 'l.facebook.com': 'Facebook',
  'm.facebook.com': 'Facebook', 'linkedin.com': 'LinkedIn', 'lnkd.in': 'LinkedIn', 'reddit.com': 'Reddit', 'discord.com': 'Discord', 'tiktok': 'TikTok', 'instagram': 'Instagram', 'youtube': 'YouTube' };
const TAB_NAME = { clip: 'Clip AI', editor: 'Editor', grafica: 'Grafica', 'video-ai': 'Video AI' };
const DEV_NAME = { desktop: 'Computer', mobile: 'Telefono', tablet: 'Tablet' };
function renderSite(main) {
  S.sdays = S.sdays || 30;
  const seg = el('div', { class: 'seg' }, ...[[1, 'Oggi'], [7, '7 giorni'], [30, '30 giorni'], [90, '90 giorni']].map(([d, l]) =>
    el('button', { type: 'button', 'aria-pressed': String(S.sdays === d), onclick: async () => { S.sdays = d; S.site = null; renderSite(main); try { S.site = await sql('site', { days: d }); S.err = null; } catch (e) { S.err = explain(e); } renderSite(main); } }, l)));
  const body = el('div', { class: 'body' });
  rc(main, head('Sito', seg), body);
  if (S.err) { rc(body, el('div', { class: 'err' }, S.err)); return; }
  const W = S.site; if (!W) { rc(body, el('div', { class: 'loading' }, 'Caricamento…')); return; }
  const kpi = (v, label, sub, cls) => el('div', { class: 'kpi' + (cls ? ' ' + cls : '') }, el('b', null, v), el('span', null, label), sub ? el('small', null, sub) : null);
  const clicked = W.funnel.clicked || 0;
  const conv = W.visits ? Math.round(clicked / W.visits * 1000) / 10 : null;
  const per = S.sdays === 1 ? 'oggi' : 'negli ultimi ' + S.sdays + ' giorni';
  const steps = [['Visite', W.funnel.visits], ['Arrivano ai prezzi', W.funnel.price], ['Arrivano al download', W.funnel.download], ['Scaricano o chiedono il link', clicked]];
  const srcRows = (list, col = 'Da dove') => list.length ? el('table', { class: 'tbl site-tbl' },
    el('thead', null, el('tr', null, el('th', null, col), el('th', { class: 'r' }, 'Visite'), el('th', { class: 'r' }, 'Scaricano'), el('th', { class: 'r' }, '%'))),
    el('tbody', null, ...list.map((x) => el('tr', null, el('td', null, SRC_NAME[x.k] || x.k), el('td', { class: 'r' }, num(x.n)), el('td', { class: 'r' }, num(x.dl)),
      el('td', { class: 'r muted' }, x.n ? Math.round(x.dl / x.n * 100) + '%' : '—'))))) : el('p', { class: 'muted', style: 'margin:0' }, 'Nessun dato');
  const obj = (o, names) => Object.entries(o || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => [(names && names[k]) || k, v]);
  rc(body, el('div', { class: 'ov' },
    el('div', { class: 'kpis' },
      kpi(num(W.today), 'Visite oggi', 'Ieri ' + num(W.yesterday)),
      kpi(num(W.visits), 'Visite', per),
      kpi(num(clicked), 'Scaricano o chiedono il link', conv == null ? 'Ancora nessuna visita' : conv + '% delle visite · Windows ' + num(W.dl_win) + ' · Mac ' + num(W.dl_mac) + ' · email ' + num(W.mails)),
      kpi(num(W.live), 'Sul sito adesso', 'Negli ultimi 30 minuti', W.live ? 'hot' : 'dim')),
    linkRequests(W.requests),
    S.sdays > 1 ? el('div', { class: 'cards' },
      el('div', { class: 'card chart', style: 'grid-column:1/-1' }, el('h2', null, 'Giorno per giorno',
        el('span', { class: 'leg' }, el('span', null, el('i', { style: 'background:#6EA5FF' }), 'Visite'), el('span', null, el('i', { style: 'background:#34D399' }), 'Click su Scarica'))),
        siteChart(W.series))) : null,
    el('div', { class: 'cards' },
      el('div', { class: 'card' }, el('h2', null, 'Da dove arrivano'), srcRows(W.sources || [])),
      el('div', { class: 'card' }, el('h2', null, 'Fin dove arrivano'), funnel(steps))),
    el('div', { class: 'cards' },
      el('div', { class: 'card' }, el('h2', null, 'Campagne'), (W.campaigns || []).length ? srcRows(W.campaigns, 'Campagna')
        : el('p', { class: 'muted', style: 'margin:0' }, 'Nessuna campagna. Aggiungi ?utm_source=tiktok&utm_campaign=nome ai link che pubblichi per vederle qui separate.')),
      el('div', { class: 'card' }, el('h2', null, 'Dispositivi'), barList(obj(W.devices, DEV_NAME)), el('h2', { style: 'margin-top:18px' }, 'Sistema'), barList(obj(W.os)))),
    el('div', { class: 'cards' },
      el('div', { class: 'card' }, el('h2', null, 'Lingua della pagina'), barList(obj(W.langs, { it: 'Italiano', en: 'Inglese' }))),
      el('div', { class: 'card' }, el('h2', null, 'Schede guardate in "Cosa fa"'), barList(obj(W.tabs, TAB_NAME)))),
    el('p', { class: 'muted fine' }, 'Conteggi anonimi: niente cookie e niente IP salvato. Una visita è una persona in un giorno. Chi ha attivato "non tracciare" nel browser non viene contato, quindi i numeri veri sono un po\' più alti.')));
}
// chi ha chiesto il link per il PC dal telefono: le email le vede solo chi gestisce gli utenti
const REQ_STATUS = { sent: 'Inviata', pending: 'In invio', queued: 'In invio', error: 'Non inviata', failed: 'Non inviata' };
function linkRequests(R) {
  if (!R) return null;
  const card = (...kids) => el('div', { class: 'cards' }, el('div', { class: 'card', style: 'grid-column:1/-1' }, el('h2', null, 'Chi ha chiesto il link via email'), ...kids));
  if (R.hidden) return card(el('p', { class: 'muted', style: 'margin:0' }, num(R.count || 0) + ' richieste nel periodo. Gli indirizzi email li vede solo chi ha il permesso Utenti.'));
  const list = R.list || [];
  if (!list.length) return card(el('p', { class: 'muted', style: 'margin:0' }, 'Ancora nessuno nel periodo. Chi apre il sito dal telefono può farsi mandare il link per scaricare NoonFrame dal computer.'));
  const news = list.filter((x) => x.news).length;
  return card(
    el('table', { class: 'tbl site-tbl req-tbl' },
      el('thead', null, el('tr', null, el('th', null, 'Quando'), el('th', null, 'Email'), el('th', null, 'Da dove'), el('th', null, 'Novità'), el('th', null, 'Email del link'))),
      el('tbody', null, ...list.map((x) => el('tr', null,
        el('td', { class: 'muted' }, when(x.at)), el('td', { class: 'req-mail' }, x.email),
        el('td', { 'data-l': 'Da dove' }, SRC_NAME[x.source] || SRC_NAME[String(x.source || '').replace(/^www\./, '')] || x.source || '—'),
        el('td', { 'data-l': 'Novità' }, x.news ? 'Sì' : 'No'),
        el('td', { 'data-l': 'Email del link', class: x.status === 'sent' ? '' : 'muted' }, REQ_STATUS[x.status] || x.status || '—'))))),
    el('p', { class: 'muted fine', style: 'margin:10px 0 0' }, news
      ? news + ' su ' + list.length + ' hanno chiesto anche le novità: solo a loro puoi scrivere per promozioni. Agli altri solo per il link o per aiutarli a installare.'
      : 'Nessuno ha chiesto le novità: puoi scrivere solo per il link o per aiutarli a installare, non per promozioni.'));
}
function siteChart(series) {
  const W = 600, H = 200, P = { l: 28, r: 8, t: 10, b: 22 };
  const s = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Visite e click su Scarica per giorno' });
  const days = series || [];
  const max = Math.max(1, ...days.map((d) => Math.max(d.visits || 0, d.dl || 0)));
  const nice = max <= 4 ? 4 : Math.ceil(max / 4) * 4;
  const step = (W - P.l - P.r) / Math.max(1, days.length);
  const x = (i) => P.l + (i + 0.5) * step, y = (v) => H - P.b - v / nice * (H - P.t - P.b);
  for (let k = 0; k <= 4; k++) {
    const v = nice * k / 4, yy = y(v);
    s.append(svgEl('line', { x1: P.l, x2: W - P.r, y1: yy, y2: yy, stroke: 'rgba(160,180,220,.1)' }));
    const t = svgEl('text', { x: P.l - 6, y: yy + 3, 'text-anchor': 'end', fill: '#6F7A8E', 'font-size': 10 }); t.textContent = Math.round(v); s.append(t);
  }
  const bw = Math.max(1.5, Math.min(18, step * 0.55));
  const every = days.length > 45 ? 14 : days.length > 14 ? 7 : 1;
  days.forEach((d, i) => {
    if (d.visits) { const r = svgEl('rect', { x: x(i) - bw / 2, y: y(d.visits), width: bw, height: y(0) - y(d.visits), rx: 1.5, fill: '#6EA5FF' }); const tt = svgEl('title', {}); tt.textContent = shortDay(d.d) + ': ' + d.visits + ' visite, ' + (d.dl || 0) + ' click su Scarica'; r.append(tt); s.append(r); }
    if (i % every === 0 || (i === days.length - 1 && i % every >= every / 2)) { const tx = svgEl('text', { x: x(i), y: H - 6, 'text-anchor': 'middle', fill: '#6F7A8E', 'font-size': 10 }); tx.textContent = shortDay(d.d); s.append(tx); }
  });
  if (days.length > 1) s.append(svgEl('polyline', { points: days.map((d, i) => x(i) + ',' + y(d.dl || 0)).join(' '), fill: 'none', stroke: '#34D399', 'stroke-width': 2, 'stroke-linejoin': 'round' }));
  return s;
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
// persone di una task: piu' persone (assignees) o tutto il team (everyone); le vecchie task hanno solo assignee
const asgList = (k) => (k.assignees && k.assignees.length ? k.assignees : k.assignee ? [k.assignee] : []);
const isMine = (k) => !!(k.everyone || asgList(k).includes(ME && ME.email));
const unassigned = (k) => !k.everyone && !asgList(k).length;
function asgLabel(everyone, list) {
  if (everyone) return 'Tutto il team';
  if (!list.length) return 'Nessuno';
  if (list.length === 1) return personName(list[0]);
  if (list.length === 2) return personName(list[0]) + ' e ' + personName(list[1]);
  return list.length + ' persone';
}
function myOpenTasks() { return ((S.tasks && S.tasks.tasks) || []).filter((k) => isMine(k) && k.status !== 'done').length; }
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
  const show = (k) => (S.tf !== 'mine' || isMine(k)) && (S.tf !== 'none' || unassigned(k)) && (!S.tp || k.everyone || asgList(k).includes(S.tp));
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
function taskAvatars(k) {
  if (k.everyone) return el('span', { class: 'tk-av all', title: 'Tutto il team' }, 'Tutti');
  const L = asgList(k);
  if (!L.length) return el('span', { class: 'tk-av none', title: 'Da assegnare' }, '?');
  const shown = L.slice(0, 3);
  return el('span', { class: 'tk-avs', title: L.map(personName).join(', ') }, ...shown.map((e) => el('span', { class: 'tk-av' }, initials(e))),
    L.length > 3 ? el('span', { class: 'tk-av more' }, '+' + (L.length - 3)) : null);
}
// scelta delle persone: tutto il team oppure una o piu' persone
function asgPicker(people, everyone0, list0) {
  let everyone = !!everyone0, sel = new Set(list0);
  const btn = el('button', { class: 'search asg-btn', type: 'button', 'aria-haspopup': 'true', 'aria-expanded': 'false' });
  const pop = el('div', { class: 'asg-pop', hidden: true, role: 'group', 'aria-label': 'Assegnata a' });
  const wrap = el('div', { class: 'asg' }, btn, pop);
  const paint = () => {
    btn.textContent = asgLabel(everyone, [...sel]);
    const opt = (on, label, onclick, sub) => el('button', { type: 'button', class: 'asg-o', role: 'checkbox', 'aria-checked': String(on), onclick },
      el('span', { class: 'asg-ck' }, on ? '✓' : ''), el('span', { class: 'grow' }, label), sub ? el('small', null, sub) : null);
    rc(pop,
      opt(everyone, 'Tutto il team', () => { everyone = !everyone; if (everyone) sel.clear(); paint(); }, people.length + ' persone'),
      el('div', { class: 'asg-sep' }),
      ...people.map((p) => opt(!everyone && sel.has(p.email), (p.name || p.email) + (p.email === ME.email ? ' (tu)' : ''), () => {
        everyone = false; if (sel.has(p.email)) sel.delete(p.email); else sel.add(p.email); paint(); })),
      el('div', { class: 'asg-foot' }, el('button', { type: 'button', class: 'linkish', onclick: () => { everyone = false; sel.clear(); paint(); } }, 'Nessuno'),
        el('span', { class: 'grow' }), el('button', { type: 'button', class: 'btn sm', onclick: () => toggle(false) }, 'Fatto')));
  };
  const outside = (e) => { if (!wrap.contains(e.target)) toggle(false); };
  const onScroll = (e) => { if (!pop.contains(e.target)) toggle(false); };
  const toggle = (on) => {
    pop.hidden = !on; btn.setAttribute('aria-expanded', String(on));
    if (on) {   // sopra la finestra (che scorre e taglierebbe la lista): posizione fissa vicino al pulsante
      const r = btn.getBoundingClientRect(), below = innerHeight - r.bottom - 12, h = Math.min(300, Math.max(below, r.top - 12));
      Object.assign(pop.style, { left: r.left + 'px', width: Math.max(240, r.width) + 'px', maxHeight: h + 'px',
        top: (below >= Math.min(300, pop.scrollHeight) || below >= r.top ? r.bottom + 6 : Math.max(8, r.top - 6 - Math.min(h, pop.scrollHeight))) + 'px' });
    }
    if (on) setTimeout(() => { document.addEventListener('pointerdown', outside, true); document.addEventListener('scroll', onScroll, true); }, 0);
    else { document.removeEventListener('pointerdown', outside, true); document.removeEventListener('scroll', onScroll, true); }
  };
  btn.addEventListener('click', () => toggle(pop.hidden));
  paint();
  return { el: wrap, value: () => ({ everyone, assignees: everyone ? [] : [...sel] }) };
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
      taskAvatars(k)));
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
  const isNew = !k; k = k || { title: '', notes: '', status: 'todo', priority: 1, assignee: null, assignees: [], everyone: false, due: null, area: '', ...def };
  const title = el('input', { class: 'search tk-title', placeholder: 'Cosa c\'è da fare?', value: k.title, maxlength: '200', 'aria-label': 'Titolo' });
  const notes = el('textarea', { class: 'note', placeholder: 'Dettagli, link, come capire che è finita…', maxlength: '4000', 'aria-label': 'Dettagli' }); notes.value = k.notes || '';
  const status = el('select', { class: 'search' }, ...TST.map(([v, l]) => el('option', { value: v, selected: k.status === v }, l)));
  let prio = String(k.priority ?? 1);
  const prioSeg = el('div', { class: 'seg' });
  const paintPrio = () => rc(prioSeg, ...PRIO.map(([v, l]) => el('button', { type: 'button', 'aria-pressed': String(prio === v), onclick: () => { prio = v; paintPrio(); } }, l)));
  paintPrio();
  const asg = asgPicker(S.tasks.people, k.everyone, asgList(k));
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
    const patch = { title: ti, notes: notes.value, status: status.value, priority: +prio, ...asg.value(), due: due.value || null, area: area.value.trim() || null };
    if (isNew && k.report_id) patch.report_id = k.report_id;
    try {
      const r = await sql('task_save', isNew ? patch : { id: k.id, ...patch });
      if (isNew) S.tasks.tasks.push(r); else Object.assign(S.tasks.tasks.find((x) => x.id === k.id) || {}, r);
      if (r.area && !S.tasks.areas.includes(r.area)) S.tasks.areas.push(r.area);
      close(); toast(isNew ? 'Task creata' + (r.everyone || (asgList(r).length && !(asgList(r).length === 1 && asgList(r)[0] === ME.email)) ? ' e assegnata a ' + asgLabel(r.everyone, asgList(r)) : '') : 'Task salvata');
      ME.my_tasks = myOpenTasks(); paintMe(); if (S.view === 'tasks') renderTasks(main);
    } catch (x) { e.currentTarget.disabled = false; toast(explain(x)); }
  };
  title.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveBtn.click(); } });
  const saveBtn = el('button', { class: 'btn primary', type: 'button', onclick: save }, isNew ? 'Crea task' : 'Salva');
  const bg = el('div', { class: 'modal-bg', onclick: (e) => { if (e.target === bg) close(); } }, el('div', { class: 'modal shop-modal tk-modal', role: 'dialog', 'aria-label': isNew ? 'Nuova task' : 'Task' },
    el('div', { class: 'row' }, el('h2', { class: 'grow' }, isNew ? 'Nuova task' : 'Task'), el('button', { class: 'btn sm ghost', type: 'button', onclick: close, 'aria-label': 'Chiudi' }, '✕')),
    title, notes,
    el('div', { class: 'fgrid' }, el('label', { class: 'fld' }, el('span', null, 'Stato'), status), el('div', { class: 'fld' }, el('span', null, 'Assegnata a'), asg.el),
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
// ------------------------------------------------------------------ creator: email trovate dal team, bozze e invio
const CR_PLAT = [['twitch', 'Twitch'], ['kick', 'Kick'], ['tiktok', 'TikTok'], ['youtube', 'YouTube'], ['instagram', 'Instagram'], ['altro', 'Altro']];
const CR_ST = { nuovo: ['Da mandare', ''], in_coda: ['In coda', 'wait'], inviata: ['Inviata', 'done'], risposto: ['Ha risposto', 'done'], errore: ['Errore', 'bad'], no: ['Non contattare', 'no'], ig: ['Contattato su IG', 'done'] };
const igLink = (c) => { const x = (c.channels || []).find((h) => h.platform === 'instagram' && safeLink(h.link)); return x ? x.link : null; };
const crName = (e) => { const p = ((S.cr && S.cr.people) || []).find((x) => x.email === e); return p ? (p.name || e.split('@')[0]) : (e || '').split('@')[0]; };
const crTpl = (id) => ((S.cr && S.cr.templates) || []).find((t) => t.id === id);
const fillName = (t, n) => String(t || '').replace(/\{(nome|Nome|NOME)\}/g, n || '');
// campi personalizzati delle bozze: {nome} viene dal creator, gli altri {campi} li completa chi assegna la bozza
const TPL_FIELD_RE = /\{([^{}\n]{1,60})\}/g;
function tplFields(t) {
  const out = [];
  if (!t) return out;
  for (const str of [t.subject || '', t.body || '']) for (const m of str.matchAll(TPL_FIELD_RE)) { const k = m[1].trim(); if (k.toLowerCase() !== 'nome' && !out.includes(k)) out.push(k); }
  return out;
}
// stesso calcolo di admin_api.mail_render: i campi lasciati vuoti spariscono
function fillTpl(text, name, fills) {
  let r = fillName(text, name);
  for (const [k, v] of Object.entries(fills || {})) if (String(v || '').trim()) r = r.split('{' + k + '}').join(String(v).trim());
  return r.replace(TPL_FIELD_RE, '').replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+([,.:;!?])/g, '$1').replace(/,([.:;!?])/g, '$1');
}
const tplKind = (t) => (t && t.kind === 'dm' ? 'dm' : 'email');
const tplMissing = (c, t) => tplFields(t).filter((k) => !String(((c && c.fills) || {})[k] || '').trim());
const EMAIL_RE = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/;
function platOf(link) {
  const l = String(link || '').toLowerCase();
  return /twitch\.tv/.test(l) ? 'twitch' : /kick\.com/.test(l) ? 'kick' : /tiktok\.com/.test(l) ? 'tiktok' : /youtu(\.be|be\.com)/.test(l) ? 'youtube' : /instagram\.com/.test(l) ? 'instagram' : '';
}
const safeLink = (u) => (/^https?:\/\//i.test(u || '') ? u : null);
async function crReload(main) { try { S.cr = await sql('creators'); } catch (e) { toast(explain(e)); } if (S.view === 'creators') renderCreators(main); if (S.view === 'mail') renderMail(main); }
function tplSelect(value, onchange, opts = {}) {
  const all = (S.cr && S.cr.templates) || [];
  const grp = (k, label) => { const l = all.filter((t) => tplKind(t) === k); return l.length ? el('optgroup', { label }, ...l.map((t) => el('option', { value: t.id, selected: value === t.id }, t.name))) : null; };
  const s = el('select', { class: 'search', 'aria-label': 'Bozza', ...(opts.attrs || {}) }, el('option', { value: '' }, opts.empty || 'Nessuna bozza'),
    grp('email', 'Email'), grp('dm', 'Messaggi DM (copia e incolla)'));
  if (onchange) s.addEventListener('change', () => onchange(s.value ? +s.value : null));
  return s;
}

function renderCreators(main) {
  const C = S.cr;
  const q = el('input', { class: 'search', type: 'search', placeholder: 'Cerca nome, email o canale', value: S.crq || '', 'aria-label': 'Cerca creator' });
  q.addEventListener('input', () => { S.crq = q.value; paintList(); });
  const add = el('button', { class: 'btn primary', type: 'button', onclick: () => creatorModal(null, main) }, '＋ Aggiungi creator');
  const paste = el('button', { class: 'btn', type: 'button', onclick: () => pasteModal(main) }, 'Incolla una lista');
  const body = el('div', { class: 'body cr-body' });
  rc(main, head('Creator', q, paste, add), body);
  if (S.err) { rc(body, el('div', { class: 'err' }, S.err)); return; }
  if (!C) { rc(body, el('div', { class: 'loading' }, 'Caricamento…')); return; }
  const F = [['all', 'Tutti'], ['ready', 'Pronti da mandare'], ['notpl', 'Senza bozza'], ['ig', 'Da scrivere su IG'], ['sent', 'Contattati'], ['replied', 'Hanno risposto'], ['err', 'Errori']];
  const test = { all: () => true, ready: (c) => c.email && (c.status === 'nuovo' || c.status === 'errore') && c.template_id && tplKind(crTpl(c.template_id)) === 'email', notpl: (c) => c.email && !c.template_id && c.status === 'nuovo',
    ig: (c) => !c.email && c.status === 'nuovo', sent: (c) => c.status === 'inviata' || c.status === 'in_coda' || c.status === 'ig', replied: (c) => c.status === 'risposto', err: (c) => c.status === 'errore' };
  S.crf = S.crf || 'all';
  const count = (k) => C.creators.filter(test[k]).length;
  const seg = el('div', { class: 'seg' }, ...F.map(([k, l]) => el('button', { type: 'button', 'aria-pressed': String(S.crf === k), onclick: () => { S.crf = k; S.crsel = new Set(); renderCreators(main); } }, l, el('i', { class: 'segn' }, count(k)))));
  const who = el('select', { class: 'search', style: 'width:auto', 'aria-label': 'Trovati da' }, el('option', { value: '' }, 'Trovati da tutti'),
    ...C.people.map((p) => el('option', { value: p.email, selected: S.crw === p.email }, p.name || p.email)));
  who.addEventListener('change', () => { S.crw = who.value; paintList(); });
  S.crsel = S.crsel || new Set();
  const bulk = el('div', { class: 'cr-bulk' });
  const list = el('div', { class: 'tblwrap' });
  rc(body, el('div', { class: 'cr-bar' }, seg, el('span', { class: 'grow' }), who), bulk, list);

  function rows() {
    const qq = (S.crq || '').trim().toLowerCase();
    return C.creators.filter(test[S.crf]).filter((c) => (!S.crw || c.added_by === S.crw) && (!qq || c.name.toLowerCase().includes(qq) || (c.email || '').includes(qq) || (c.channels || []).some((h) => String(h.link || '').toLowerCase().includes(qq))));
  }
  function paintBulk() {
    const n = S.crsel.size;
    if (!n) { rc(bulk); bulk.hidden = true; return; }
    bulk.hidden = false;
    const pick = tplSelect(null, null, { empty: 'Scegli la bozza…' });
    rc(bulk, el('b', null, n === 1 ? '1 selezionato' : n + ' selezionati'), el('span', null, 'Assegna'), pick,
      el('button', { class: 'btn sm primary', type: 'button', onclick: async (e) => {
        const tid = pick.value ? +pick.value : null; if (!tid) { pick.focus(); toast('Scegli una bozza'); return; }
        e.currentTarget.disabled = true;
        const ids = [...S.crsel]; let ok = 0;
        for (let i = 0; i < ids.length; i += 6) {
          const res = await Promise.allSettled(ids.slice(i, i + 6).map((id) => sql('creator_save', { id, template_id: tid })));
          res.forEach((r) => { if (r.status === 'fulfilled') { ok++; const c = C.creators.find((x) => x.id === r.value.id); if (c) Object.assign(c, r.value); } });
        }
        toast('Bozza assegnata a ' + ok + (ok === 1 ? ' creator' : ' creator')); S.crsel = new Set(); renderCreators(main);
      } }, 'Assegna'),
      el('span', { class: 'grow' }),
      el('button', { class: 'btn sm ghost', type: 'button', onclick: () => { S.crsel = new Set(); paintList(); } }, 'Deseleziona'));
  }
  function paintList() {
    const R = rows();
    paintBulk();
    if (!C.creators.length) { rc(list, el('div', { class: 'empty cr-empty' }, el('b', null, 'Ancora nessun creator'), el('p', null, 'Aggiungi il primo con nome ed email, oppure incolla una lista intera: una riga per creator.'))); return; }
    if (!R.length) { rc(list, el('div', { class: 'empty' }, 'Nessun creator con questi filtri.')); return; }
    const all = R.length && R.every((c) => S.crsel.has(c.id));
    const allCb = el('input', { type: 'checkbox', checked: all, 'aria-label': 'Seleziona tutti' });
    allCb.addEventListener('change', () => { R.forEach((c) => (allCb.checked ? S.crsel.add(c.id) : S.crsel.delete(c.id))); paintList(); });
    rc(list, el('table', { class: 'tbl cr-tbl' },
      el('thead', null, el('tr', null, el('th', { class: 'ck' }, allCb), el('th', null, 'Creator'), el('th', null, 'Email'), el('th', null, 'Bozza'), el('th', null, 'Stato'), el('th', { class: 'hide-m' }, 'Trovato da'), el('th', null, ''))),
      el('tbody', null, ...R.map((c) => {
        const cb = el('input', { type: 'checkbox', checked: S.crsel.has(c.id), 'aria-label': 'Seleziona ' + c.name });
        cb.addEventListener('change', () => { if (cb.checked) S.crsel.add(c.id); else S.crsel.delete(c.id); paintBulk(); allCb.checked = R.every((x) => S.crsel.has(x.id)); });
        const locked = c.status === 'in_coda' || c.status === 'inviata';
        const ct = crTpl(c.template_id), miss = tplMissing(c, ct);
        const tsel = locked ? el('span', { class: 'muted' }, ct ? ct.name : '—')
          : el('button', { class: 'cr-tplbtn' + (ct ? '' : ' empty'), type: 'button', 'data-tip': ct ? 'Cambia bozza o completa i campi' : 'Scegli la bozza e completa i campi', onclick: () => fillsModal(c, main) },
            el('span', { class: 'cr-tplk ' + (ct ? tplKind(ct) : '') }, ct ? (tplKind(ct) === 'dm' ? 'DM' : 'Email') : '＋'),
            el('span', { class: 'cr-tpln' }, ct ? ct.name : 'Scegli bozza'),
            ct && miss.length ? el('i', { class: 'cr-miss', title: 'Campi da completare: ' + miss.join(', ') }, miss.length) : null);
        const [stl, stc] = CR_ST[c.status] || [c.status, ''];
        return el('tr', { class: S.crsel.has(c.id) ? 'sel' : '' },
          el('td', { class: 'ck' }, cb),
          el('td', null, el('div', { class: 'cr-who' }, el('b', null, c.name), chanChips(c))),
          el('td', { class: 'cr-mail' }, c.email || noMailCell(c, () => paintList())),
          el('td', null, tsel),
          el('td', null, el('span', { class: 'pill ' + stc, title: c.last_error || '' }, stl)),
          el('td', { class: 'hide-m' }, el('span', { class: 'muted' }, crName(c.added_by) + ' · ' + when(c.created_at))),
          el('td', { style: 'text-align:right;white-space:nowrap' }, el('button', { class: 'btn sm ghost', type: 'button', onclick: () => creatorModal(c, main) }, 'Modifica')));
      }))));
  }
  paintList();
}

const fmtFol = (n) => { n = +n || 0; return n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.', ',').replace(',0', '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace('.', ',').replace(',0', '') + 'k' : String(n); };
// follower scritti come 12500, 12.500, 12,5k, 1.2M
function parseFol(v) {
  const t = String(v || '').trim().toLowerCase().replace(/\s/g, ''); if (!t) return null;
  const m = t.match(/^(\d+(?:[.,]\d+)?)([km]?)$/); if (!m) return NaN;
  const k = m[2] === 'k' ? 1e3 : m[2] === 'm' ? 1e6 : 1;
  const num = k > 1 ? parseFloat(m[1].replace(',', '.')) : parseInt(m[1].replace(/[.,]/g, ''), 10);
  return Math.round(num * k);
}
function chanChips(c) {
  const ch = c.channels && c.channels.length ? c.channels : c.platform || c.link ? [{ platform: c.platform || 'altro', link: c.link }] : [];
  if (!ch.length) return el('span', { class: 'muted' }, 'Nessun canale');
  return el('span', { class: 'chs' }, ...ch.map((x) => {
    const lbl = (CR_PLAT.find((p) => p[0] === x.platform) || [0, 'Altro'])[1], lk = safeLink(x.link);
    const inner = [el('b', null, lbl), x.followers != null ? el('span', null, fmtFol(x.followers)) : null];
    return lk ? el('a', { class: 'ch ' + x.platform, href: lk, target: '_blank', rel: 'noopener noreferrer', title: x.link }, ...inner) : el('span', { class: 'ch ' + x.platform, title: x.link || '' }, ...inner);
  }));
}
// creator senza email: si scrive su Instagram (apri il profilo, copia il messaggio della bozza, segna come contattato)
function noMailCell(c, repaint) {
  const ig = igLink(c), t = crTpl(c.template_id);
  const box = el('div', { class: 'cr-ig' }, el('span', { class: 'cr-noig' }, ig ? 'Nessuna email · scrivi su IG' : 'Nessuna email · manca Instagram'));
  const acts = el('div', { class: 'cr-igacts' },
    ig ? el('a', { class: 'btn sm', href: ig, target: '_blank', rel: 'noopener noreferrer' }, 'Apri Instagram') : null,
    t ? el('button', { class: 'btn sm ghost', type: 'button', title: 'Copia il testo della bozza con il suo nome, da incollare in DM', onclick: async () => {
      try { await navigator.clipboard.writeText(fillTpl(t.body, c.name, c.fills)); toast('Messaggio copiato: incollalo in DM'); } catch (e) { toast('Copia non riuscita'); }
    } }, 'Copia messaggio') : null,
    c.status === 'nuovo' ? el('button', { class: 'btn sm ghost', type: 'button', onclick: async (e) => {
      e.currentTarget.disabled = true;
      try { Object.assign(c, await sql('creator_save', { id: c.id, status: 'ig' })); toast(c.name + ': contattato su IG'); } catch (x) { toast(explain(x)); }
      repaint();
    } }, 'Segna contattato') : null);
  if (acts.childNodes.length) box.append(acts);
  return box;
}
// i campi da completare di una bozza (tranne {nome}) e l'anteprima del messaggio per quel creator
function fillFields(t, getName, fills, onInput) {
  if (!t) return [];
  const keys = tplFields(t);
  const pv = el('div', { class: 'cr-fpv' });
  const paint = () => rc(pv, el('div', { class: 'cr-fpv-h' }, el('b', null, 'Anteprima'), el('span', { class: 'muted' }, tplKind(t) === 'dm' ? 'messaggio da copiare in DM' : 'email')),
    tplKind(t) === 'email' ? el('div', { class: 'mail-pv-s' }, 'Oggetto: ', el('b', null, fillTpl(t.subject, getName(), fills) || '—')) : null,
    el('pre', null, fillTpl(t.body, getName(), fills)));
  const rows = keys.map((k) => {
    const i = el('input', { class: 'search', value: fills[k] || '', maxlength: '500', placeholder: 'Lascia vuoto per toglierlo dal messaggio', 'aria-label': k });
    i.addEventListener('input', () => { fills[k] = i.value; paint(); if (onInput) onInput(); });
    return el('label', { class: 'fld' }, el('span', null, '{' + k + '}'), i);
  });
  paint();
  return [keys.length ? el('div', { class: 'cr-fhint' }, '{nome} lo prende dal nome del creator. Completa il resto per questo creator: quello che lasci vuoto sparisce dal messaggio.')
    : el('div', { class: 'cr-fhint' }, 'Questa bozza non ha campi da completare: {nome} lo prende dal nome del creator.'),
  keys.length ? el('div', { class: 'fgrid two cr-fgrid' }, ...rows) : null, pv];
}
// scegli la bozza di un creator e completa i suoi campi (dalla riga della lista)
function fillsModal(c, main) {
  let fills = { ...(c.fills || {}) };
  const tpl = tplSelect(c.template_id, null, { empty: 'Nessuna bozza' });
  const box = el('div', { class: 'cr-fills' });
  const cur = () => crTpl(tpl.value ? +tpl.value : null);
  const copyBtn = el('button', { class: 'btn', type: 'button', onclick: async () => {
    const t = cur(); if (!t) return;
    try { await navigator.clipboard.writeText(fillTpl(t.body, c.name, fills)); toast('Messaggio copiato: incollalo in DM'); } catch (e) { toast('Copia non riuscita'); }
  } }, 'Copia messaggio');
  const paint = () => { rc(box, ...fillFields(cur(), () => c.name, fills)); copyBtn.hidden = !cur(); };
  tpl.addEventListener('change', paint); paint();
  const close = () => { bg.remove(); document.removeEventListener('keydown', esc); };
  const esc = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', esc);
  const save = async () => {
    try { Object.assign(c, await sql('creator_save', { id: c.id, template_id: tpl.value ? +tpl.value : null, fills })); close(); toast(tpl.value ? 'Bozza assegnata' : 'Bozza tolta'); renderCreators(main); }
    catch (e) { toast(explain(e)); }
  };
  const bg = el('div', { class: 'modal-bg', onclick: (e) => { if (e.target === bg) close(); } }, el('div', { class: 'modal shop-modal cr-modal', role: 'dialog', 'aria-label': 'Bozza per ' + c.name },
    el('div', { class: 'row' }, el('h2', { class: 'grow' }, 'Bozza per ' + c.name), el('button', { class: 'btn sm ghost', type: 'button', onclick: close, 'aria-label': 'Chiudi' }, '✕')),
    el('label', { class: 'fld' }, el('span', null, 'Bozza (email o messaggio)'), tpl), box,
    el('div', { class: 'row' }, el('span', { class: 'grow' }), el('button', { class: 'btn', type: 'button', onclick: close }, 'Annulla'), copyBtn, el('button', { class: 'btn primary', type: 'button', onclick: save }, 'Salva'))));
  document.body.append(bg);
  setTimeout(() => (box.querySelector('input') || tpl).focus(), 30);
}
// stesso controllo del database (admin_api.handle_key / name_key): niente doppioni con lo stesso nome o handle
const RESERVED_SEG = ['watch','live','video','videos','p','reel','reels','shorts','s','share','profile','home','embed','clip','clips','popout','directory','search','explore','stories','tv'];
function handleKey(u) {
  const l = String(u || '').trim().toLowerCase().replace(/^(https?:\/\/)?(www\.|m\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
  if (!l) return null;
  let h;
  if (!l.includes('/')) { if (/\.(com|tv|it|net|org|ee|gg|me|io|be|ly|co)$/.test(l)) return null; h = l; }
  else { const s = l.split('/').slice(1); h = s[0]; if (['channel', 'c', 'user'].includes(h)) h = s[1]; else if (RESERVED_SEG.includes(h)) return null; }
  h = String(h || '').replace(/[^a-z0-9]/g, '');
  return h.length >= 3 ? h : null;
}
const nameKey = (n) => { const k = String(n || '').toLowerCase().replace(/[^a-z0-9]/g, ''); return k.length >= 3 ? k : null; };
function crDup(name, channels, skip) {
  const mine = new Set([nameKey(name), ...(channels || []).map((h) => handleKey(h.link))].filter(Boolean));
  if (!mine.size) return null;
  return ((S.cr && S.cr.creators) || []).find((c) => c.id !== skip && (mine.has(nameKey(c.name)) || (c.channels || []).some((h) => mine.has(handleKey(h.link))))) || null;
}
function creatorModal(c, main) {
  const isNew = !c; c = c || { name: '', email: '', channels: [], template_id: (S.cr.templates[0] || {}).id || null, status: 'nuovo' };
  const name = el('input', { class: 'search', placeholder: 'Nome del creator', value: c.name, maxlength: '120', 'aria-label': 'Nome' });
  const email = el('input', { class: 'search', type: 'email', placeholder: 'email@esempio.com', value: c.email || '', autocomplete: 'off', 'aria-label': 'Email' });
  // non tutti i creator hanno un'email: in quel caso si contatta su Instagram
  const noMail = el('input', { type: 'checkbox', checked: !isNew && !c.email ? true : null });
  const syncMail = () => { email.disabled = noMail.checked; email.placeholder = noMail.checked ? 'Nessuna email: lo scriviamo su Instagram' : 'email@esempio.com'; if (noMail.checked) email.value = ''; };
  noMail.addEventListener('change', () => { syncMail(); if (!noMail.checked) email.focus(); else if (!rows.some((r) => r.platform === 'instagram')) { if (rows.length === 1 && !rows[0].platform && !rows[0].link) rows[0].platform = 'instagram'; else rows.push({ platform: 'instagram', link: '', followers: '' }); paintCh(); } });
  syncMail();
  // canali: una riga per piattaforma, ognuna con link e follower
  let rows = (c.channels && c.channels.length ? c.channels : c.platform || c.link ? [{ platform: c.platform, link: c.link }] : [{ platform: '', link: '' }]).map((x) => ({ platform: x.platform || '', link: x.link || '', followers: x.followers != null ? String(x.followers) : '' }));
  const chBox = el('div', { class: 'chbox' });
  const paintCh = () => {
    const used = new Set(rows.map((r) => r.platform).filter(Boolean));
    rc(chBox, ...rows.map((r, i) => {
      const pl = el('select', { class: 'search', 'aria-label': 'Piattaforma' }, el('option', { value: '' }, 'Piattaforma'),
        ...CR_PLAT.map(([v, l]) => el('option', { value: v, selected: r.platform === v, disabled: v !== r.platform && used.has(v) && v !== 'altro' ? true : null }, l)));
      pl.addEventListener('change', () => { r.platform = pl.value; paintCh(); });
      const lk = el('input', { class: 'search', placeholder: 'Link o nome del canale', value: r.link, maxlength: '300', 'aria-label': 'Link del canale' });
      lk.addEventListener('input', () => { r.link = lk.value; const p = platOf(lk.value); if (p && !r.platform && !used.has(p)) { r.platform = p; pl.value = p; } });
      const fo = el('input', { class: 'search', placeholder: 'Follower', value: r.followers, inputmode: 'numeric', 'aria-label': 'Follower' });
      fo.addEventListener('input', () => { r.followers = fo.value; fo.classList.toggle('bad', Number.isNaN(parseFol(fo.value))); });
      [lk, fo].forEach((x) => x.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); save(isNew); } }));
      return el('div', { class: 'chrow' }, pl, lk, fo,
        el('button', { class: 'btn sm ghost', type: 'button', 'aria-label': 'Togli questa piattaforma', title: 'Togli', onclick: () => { rows.splice(i, 1); if (!rows.length) rows.push({ platform: '', link: '', followers: '' }); paintCh(); } }, '✕'));
    }), rows.length < 6 ? el('button', { class: 'linkish', type: 'button', onclick: () => { rows.push({ platform: '', link: '', followers: '' }); paintCh(); chBox.querySelectorAll('.chrow select')[rows.length - 1]?.focus(); } }, '＋ Aggiungi un\'altra piattaforma') : null);
  };
  paintCh();
  const dupBox = el('div', { class: 'cr-dup', role: 'status', 'aria-live': 'polite' });
  const checkDup = () => {
    const d = crDup(name.value, rows, isNew ? null : c.id);
    rc(dupBox, d ? el('span', null, el('b', null, 'Già in lista: '), d.name + ' (trovato da ' + crName(d.added_by) + '). Stesso nome o handle: non si può aggiungere di nuovo.') : null);
    dupBox.hidden = !d;
    return d;
  };
  name.addEventListener('input', checkDup); chBox.addEventListener('input', checkDup); chBox.addEventListener('change', checkDup);
  checkDup();
  const tpl = tplSelect(c.template_id, null);
  let fills = { ...(c.fills || {}) };
  const fillBox = el('div', { class: 'cr-fills' });
  const paintFills = () => rc(fillBox, ...fillFields(crTpl(tpl.value ? +tpl.value : null), () => name.value.trim() || 'Nome', fills));
  tpl.addEventListener('change', paintFills); name.addEventListener('input', () => fillBox.querySelector('.cr-fpv') && paintFills());
  paintFills();
  const st = el('select', { class: 'search', 'aria-label': 'Stato', disabled: c.status === 'in_coda' ? true : null },
    ...[['nuovo', 'Da contattare'], ['ig', 'Contattato su IG'], ['risposto', 'Ha risposto'], ['no', 'Non contattare']].map(([v, l]) => el('option', { value: v, selected: c.status === v }, l)),
    ['inviata', 'in_coda', 'errore'].includes(c.status) ? el('option', { value: '', selected: true }, CR_ST[c.status][0]) : null);
  const close = () => { bg.remove(); document.removeEventListener('keydown', esc); };
  const esc = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', esc);
  async function save(again) {
    const channels = [];
    for (const r of rows) {
      if (!r.platform && !r.link.trim() && !r.followers.trim()) continue;
      const f = parseFol(r.followers);
      if (Number.isNaN(f)) { toast('Follower non validi: scrivi un numero, per esempio 12500 o 12,5k'); return; }
      let link = r.link.trim(); if (link && !/^https?:\/\//i.test(link) && /\.[a-z]{2,}\//i.test(link)) link = 'https://' + link;
      channels.push({ platform: r.platform || platOf(link) || 'altro', link, followers: f });
    }
    const patch = { name: name.value.trim(), email: email.value.trim(), channels, template_id: tpl.value ? +tpl.value : null, fills };
    if (!patch.name) { name.focus(); toast('Scrivi il nome'); return; }
    const dd = crDup(patch.name, channels, isNew ? null : c.id); if (dd) { checkDup(); toast('Già in lista: ' + dd.name + ' (trovato da ' + crName(dd.added_by) + ')'); return; }
    if (noMail.checked) {
      patch.email = '';
      if (!channels.some((x) => x.platform === 'instagram' && x.link)) { toast('Senza email serve il link Instagram per scrivergli'); return; }
    } else if (!EMAIL_RE.test(patch.email)) { email.focus(); toast(patch.email ? 'Email non valida' : 'Scrivi l\'email, oppure spunta «Nessuna email»'); return; }
    if (!isNew && st.value) patch.status = st.value;
    try {
      const r = await sql('creator_save', isNew ? patch : { id: c.id, ...patch });
      if (isNew) S.cr.creators.unshift(r); else Object.assign(S.cr.creators.find((x) => x.id === c.id) || {}, r);
      toast(isNew ? r.name + ' aggiunto' : 'Salvato');
      if (again) { name.value = ''; email.value = ''; noMail.checked = false; syncMail(); fills = {}; paintFills(); rows = [{ platform: '', link: '', followers: '' }]; paintCh(); checkDup(); name.focus(); renderCreators(main); return; }
      close(); renderCreators(main);
    } catch (e) { toast(explain(e)); }
  }
  [name, email].forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); save(isNew); } }));
  let armed = false;
  const del = isNew ? null : el('button', { class: 'btn bad', type: 'button', onclick: async (e) => {
    if (!armed) { armed = true; e.currentTarget.textContent = 'Conferma: elimina'; return; }
    try { await sql('creator_remove', { id: c.id }); S.cr.creators = S.cr.creators.filter((x) => x.id !== c.id); close(); toast('Creator eliminato'); renderCreators(main); } catch (x) { toast(explain(x)); }
  } }, 'Elimina');
  const bg = el('div', { class: 'modal-bg', onclick: (e) => { if (e.target === bg) close(); } }, el('div', { class: 'modal shop-modal cr-modal', role: 'dialog', 'aria-label': isNew ? 'Nuovo creator' : 'Creator' },
    el('div', { class: 'row' }, el('h2', { class: 'grow' }, isNew ? 'Nuovo creator' : c.name), el('button', { class: 'btn sm ghost', type: 'button', onclick: close, 'aria-label': 'Chiudi' }, '✕')),
    el('div', { class: 'fgrid two' }, el('label', { class: 'fld' }, el('span', null, 'Nome'), name), el('div', { class: 'fld' }, el('span', null, 'Email'), email, el('label', { class: 'cr-nomail' }, noMail, el('span', null, 'Nessuna email (lo contattiamo su Instagram)')))),
    el('div', { class: 'fld' }, el('span', null, 'Piattaforme e follower'), chBox), dupBox,
    el('div', { class: 'fgrid two' }, el('label', { class: 'fld' }, el('span', null, 'Bozza (email o messaggio)'), tpl), isNew ? el('span') : el('label', { class: 'fld' }, el('span', null, 'Stato'), st)),
    fillBox,
    el('p', { class: 'muted', style: 'margin:0;font-size:12px' }, isNew ? 'Trovato da: ' + crName(ME.email) + ' (preso dal tuo account). Invio: salva e passa al prossimo.'
      : 'Trovato da ' + crName(c.added_by) + ' ' + when(c.created_at) + (c.sent_at ? ' · mail inviata ' + when(c.sent_at) : '') + (c.last_error ? ' · errore: ' + c.last_error : '')),
    el('div', { class: 'row' }, del, el('span', { class: 'grow' }), el('button', { class: 'btn', type: 'button', onclick: close }, 'Annulla'),
      isNew ? el('button', { class: 'btn', type: 'button', onclick: () => save(true) }, 'Salva e aggiungi un altro') : null,
      el('button', { class: 'btn primary', type: 'button', onclick: () => save(false) }, isNew ? 'Aggiungi' : 'Salva'))));
  document.body.append(bg);
  setTimeout(() => name.focus(), 30);
}

// lista incollata: una riga per creator, l'email si trova da sola; il resto della riga e' nome e link
function parseCreators(text) {
  const out = [];
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim(); if (!line) continue;
    const m = line.match(EMAIL_RE) || (/instagram\.com\//i.test(line) ? [''] : null); if (!m) { out.push({ bad: line }); continue; }
    const rest = m[0] ? line.replace(m[0], ' ') : line;
    const lk = (rest.match(/https?:\/\/\S+|(?:www\.)?(?:twitch\.tv|kick\.com|tiktok\.com|youtube\.com|instagram\.com)\/\S+/i) || [''])[0].replace(/[,;)]+$/, '');
    const name = rest.replace(lk, ' ').split(/[,;\t|]+/).map((x) => x.trim()).filter(Boolean)[0] || '';
    const link = lk ? (/^https?:/i.test(lk) ? lk : 'https://' + lk) : '';
    const fm = rest.replace(lk, ' ').match(/(?:^|[\s,;|])(\d+(?:[.,]\d+)?\s?[kKmM])(?=$|[\s,;|])/);
    const fol = fm ? parseFol(fm[1]) : null;
    out.push({ name: name.replace(/^[-–•*\s]+/, '').replace(fm ? fm[1] : '\u0000', '').trim().slice(0, 120), email: m[0].toLowerCase(), channels: link || fol ? [{ platform: platOf(link) || 'altro', link, followers: Number.isFinite(fol) ? fol : null }] : [] });
  }
  return out;
}
function pasteModal(main) {
  const ta = el('textarea', { class: 'note', style: 'min-height:200px;font-family:var(--mono);font-size:12.5px', placeholder: 'Una riga per creator, per esempio:\nMario Rossi, mario@gmail.com, twitch.tv/mariorossi, 12k\nLuca Bianchi; luca.live@outlook.it; https://kick.com/lucab\nAnna Verdi, instagram.com/annaverdi, 3k (senza email)', 'aria-label': 'Lista di creator' });
  const tpl = tplSelect((S.cr.templates[0] || {}).id || null, null);
  const info = el('p', { class: 'muted', style: 'margin:0' }, 'Incolla da un foglio, da una chat o da note: l\'email in ogni riga si trova da sola. Chi non ha email va bene con il link Instagram.');
  const go2 = el('button', { class: 'btn primary', type: 'button', disabled: true }, 'Importa');
  const upd = () => {
    const P = parseCreators(ta.value), ok = P.filter((x) => !x.bad), bad = P.length - ok.length;
    const seen = [];
    const dup = ok.filter((x) => {
      const d = (x.email && S.cr.creators.some((c) => c.email === x.email)) || crDup(x.name, x.channels, null)
        || seen.some((y) => { const a = new Set([nameKey(y.name), ...y.channels.map((h) => handleKey(h.link))].filter(Boolean)); return [nameKey(x.name), ...x.channels.map((h) => handleKey(h.link))].some((k) => k && a.has(k)); });
      seen.push(x); return d;
    }).length;
    go2.disabled = !ok.length; go2.textContent = ok.length ? 'Importa ' + (ok.length - dup) + (ok.length - dup === 1 ? ' creator' : ' creator') : 'Importa';
    info.textContent = !P.length ? 'Incolla da un foglio, da una chat o da note: l\'email in ogni riga si trova da sola. Chi non ha email va bene con il link Instagram.'
      : ok.length + ' validi' + (dup ? ', ' + dup + ' già in lista' : '') + (bad ? ', ' + bad + (bad === 1 ? ' riga senza email né Instagram (saltata)' : ' righe senza email né Instagram (saltate)') : '') + '.';
  };
  ta.addEventListener('input', upd);
  const close = () => bg.remove();
  go2.addEventListener('click', async () => {
    const rows = parseCreators(ta.value).filter((x) => !x.bad).map(({ name, email, channels }) => ({ name, email, channels }));
    go2.disabled = true;
    try {
      const r = await sql('creators_import', { rows, template_id: tpl.value ? +tpl.value : null });
      close(); toast(r.added + ' aggiunti' + (r.dups.length ? ', ' + r.dups.length + ' già in lista' : '') + (r.invalid ? ', ' + r.invalid + ' non validi' : ''));
      await crReload(main);
    } catch (e) { go2.disabled = false; toast(explain(e)); }
  });
  const bg = el('div', { class: 'modal-bg', onclick: (e) => { if (e.target === bg) close(); } }, el('div', { class: 'modal shop-modal', role: 'dialog', 'aria-label': 'Incolla una lista' },
    el('div', { class: 'row' }, el('h2', { class: 'grow' }, 'Incolla una lista'), el('button', { class: 'btn sm ghost', type: 'button', onclick: close, 'aria-label': 'Chiudi' }, '✕')),
    ta, info, el('label', { class: 'fld' }, el('span', null, 'Bozza per tutti'), tpl),
    el('div', { class: 'row' }, el('span', { class: 'grow' }), el('button', { class: 'btn', type: 'button', onclick: close }, 'Annulla'), go2)));
  document.body.append(bg);
  setTimeout(() => ta.focus(), 30);
}

// ---- email: bozze, pronte da mandare, coda e registro
let mailTimer = null;
function renderMail(main) {
  const C = S.cr;
  clearTimeout(mailTimer);
  const body = el('div', { class: 'body mail-body' });
  rc(main, head('Email e messaggi', el('button', { class: 'btn primary', type: 'button', onclick: () => templateModal(null, main) }, '＋ Nuova bozza')), body);
  if (S.err) { rc(body, el('div', { class: 'err' }, S.err)); return; }
  if (!C) { rc(body, el('div', { class: 'loading' }, 'Caricamento…')); return; }
  const canSend = CAN('creators_send');
  const sm = C.smtp || {}, Q = C.queue || {};
  // casella di invio
  const smtpBox = sm.ok ? el('div', { class: 'mail-state ok' }, el('i'), el('span', null, 'Le email partono da ', el('b', null, sm.from || 'la casella ufficiale'), '.'))
    : sm.error === 'auth' ? el('div', { class: 'mail-state bad' }, el('i'), el('span', null, el('b', null, 'Hostinger ha rifiutato la password. '), 'Controlla HOSTINGER_SMTP_USER e HOSTINGER_SMTP_PASS nei segreti di Supabase (Edge Functions → Secrets). Le email restano in coda e ripartono da sole.'))
    : sm.error === 'send' ? el('div', { class: 'mail-state warn' }, el('i'), el('span', null, el('b', null, 'Ultimo invio non riuscito: '), String(sm.detail || '').slice(0, 160)))
    : el('div', { class: 'mail-state warn' }, el('i'), el('span', null, el('b', null, 'Casella Hostinger da collegare. '), 'In Supabase → Edge Functions → Secrets aggiungi HOSTINGER_SMTP_USER (l\'email ufficiale di NoonFrame) e HOSTINGER_SMTP_PASS (la sua password). Finché manca, le email restano in coda.'));
  // bozze
  const tpls = el('div', { class: 'tpl-grid' }, ...(C.templates.length ? C.templates.map((t) => el('button', { class: 'tpl-card', type: 'button', onclick: () => templateModal(t, main) },
    el('b', null, el('span', { class: 'cr-tplk ' + tplKind(t) }, tplKind(t) === 'dm' ? 'DM' : 'Email'), ' ', t.name), tplKind(t) === 'email' ? el('span', { class: 'tpl-sub' }, fillName(t.subject, 'Mario')) : el('span', { class: 'tpl-sub' }, 'Da copiare e incollare in DM'), el('span', { class: 'tpl-body' }, fillName(t.body, 'Mario').slice(0, 160)),
    el('small', { class: 'muted' }, (t.used ? t.used + (t.used === 1 ? ' creator' : ' creator') : 'Non ancora assegnata') + ' · ' + crName(t.created_by)))) :
    [el('div', { class: 'empty cr-empty' }, el('b', null, 'Nessuna bozza'), el('p', null, 'Scrivi la prima: usa {nome} dove va il nome del creator e altri {campi} tra graffe per le parti da personalizzare.'))]));
  // pronte da mandare
  const ready = C.creators.filter((c) => c.email && (c.status === 'nuovo' || c.status === 'errore') && c.template_id && crTpl(c.template_id) && tplKind(crTpl(c.template_id)) === 'email');
  S.mailsel = S.mailsel && S.mailsel.size ? new Set([...S.mailsel].filter((id) => ready.some((c) => c.id === id))) : new Set(ready.map((c) => c.id));
  const readyBox = el('section', { class: 'mail-sec' });
  const paintReady = () => {
    if (!ready.length) { rc(readyBox, el('h2', null, 'Pronte da mandare'), el('div', { class: 'empty' }, C.creators.some((c) => c.status === 'nuovo' && !c.template_id) ? 'Ci sono creator senza bozza: assegnala nella tab Creator.' : 'Niente da mandare. Aggiungi creator e assegna una bozza.')); return; }
    const n = S.mailsel.size;
    const allCb = el('input', { type: 'checkbox', checked: n === ready.length, 'aria-label': 'Seleziona tutti' });
    allCb.addEventListener('change', () => { S.mailsel = allCb.checked ? new Set(ready.map((c) => c.id)) : new Set(); paintReady(); });
    const sendBtn = canSend ? el('button', { class: 'btn primary', type: 'button', disabled: !n ? true : null, onclick: async (e) => {
      const left = Math.max(0, (Q.cap || 150) - (Q.sent_today || 0));
      if (!e.currentTarget.dataset.armed) { e.currentTarget.dataset.armed = '1'; e.currentTarget.textContent = 'Conferma: manda ' + n + (n === 1 ? ' email' : ' email'); return; }
      e.currentTarget.disabled = true;
      try { const r = await sql('creators_send', { ids: [...S.mailsel] }); toast(r.queued + ' in coda' + (r.skipped ? ', ' + r.skipped + ' saltate (già mandate o senza bozza)' : '') + (r.queued > left ? ' · oggi ne partono ' + left + ', le altre domani' : '')); S.mailsel = null; await crReload(main); }
      catch (x) { toast(explain(x)); e.currentTarget.disabled = false; }
    } }, 'Manda ' + n + (n === 1 ? ' email' : ' email')) : el('span', { class: 'muted' }, 'Puoi preparare e assegnare le bozze. Per mandarle serve il permesso: lo decide Emanuele.');
    const byTpl = {};
    ready.forEach((c) => { (byTpl[c.template_id] = byTpl[c.template_id] || []).push(c); });
    rc(readyBox, el('div', { class: 'row' }, el('h2', { class: 'grow' }, 'Pronte da mandare ', el('i', { class: 'segn' }, ready.length)), allCb, el('span', { class: 'muted' }, 'tutte'), sendBtn),
      ...Object.entries(byTpl).map(([tid, list]) => {
        const t = crTpl(+tid);
        return el('div', { class: 'mail-grp' }, el('div', { class: 'mail-grp-h' }, el('b', null, t.name), el('span', { class: 'muted' }, list.length + (list.length === 1 ? ' creator' : ' creator'))),
          ...list.map((c) => {
            const cb = el('input', { type: 'checkbox', checked: S.mailsel.has(c.id), 'aria-label': 'Manda a ' + c.name });
            cb.addEventListener('change', () => { if (cb.checked) S.mailsel.add(c.id); else S.mailsel.delete(c.id); paintReady(); });
            const pv = el('details', { class: 'mail-pv' }, el('summary', null, el('span', { class: 'mail-to' }, el('b', null, c.name), ' ', el('span', { class: 'muted' }, c.email)),
              el('span', { class: 'mail-subj' }, fillTpl(t.subject, c.name, c.fills)), tplMissing(c, t).length ? el('span', { class: 'pill', title: 'Campi vuoti: ' + tplMissing(c, t).join(', ') }, tplMissing(c, t).length + ' campi vuoti') : null, c.status === 'errore' ? el('span', { class: 'pill bad', title: c.last_error || '' }, 'Riprova') : null),
              el('div', { class: 'mail-pv-b' }, el('div', { class: 'mail-pv-s' }, 'Oggetto: ', el('b', null, fillTpl(t.subject, c.name, c.fills))), el('pre', null, fillTpl(t.body, c.name, c.fills)),
                el('button', { class: 'btn sm', type: 'button', onclick: () => fillsModal(c, main) }, 'Completa i campi')));
            return el('div', { class: 'mail-row' }, cb, pv);
          }));
      }));
  };
  paintReady();
  // coda e limiti
  const capIn = el('input', { class: 'search sm', type: 'number', min: '1', max: '2000', value: Q.cap || 150, style: 'width:80px', 'aria-label': 'Email al giorno', disabled: canSend ? null : true });
  capIn.addEventListener('change', async () => { try { await sql('mail_admin', { op: 'cap', cap: +capIn.value }); toast('Limite aggiornato'); await crReload(main); } catch (e) { toast(explain(e)); } });
  const qBox = el('section', { class: 'mail-sec mail-q' },
    el('div', { class: 'mail-kpis' },
      el('div', { class: 'kpi' }, el('b', null, Q.pending || 0), el('span', null, 'in coda')),
      el('div', { class: 'kpi' }, el('b', null, (Q.sent_today || 0)), el('span', null, 'mandate oggi')),
      el('div', { class: 'kpi' + (Q.failed ? ' hot' : '') }, el('b', null, Q.failed || 0), el('span', null, 'non riuscite (7 giorni)'))),
    el('div', { class: 'row' }, el('span', { class: 'muted' }, 'Al massimo'), capIn, el('span', { class: 'muted' }, 'email al giorno, circa 6 al minuto. Quelle in più partono il giorno dopo.'), el('span', { class: 'grow' }),
      canSend && Q.failed ? el('button', { class: 'btn sm', type: 'button', onclick: async () => { try { const r = await sql('mail_admin', { op: 'retry' }); toast(r.reset + ' di nuovo pronte da mandare'); await crReload(main); } catch (e) { toast(explain(e)); } } }, 'Rimetti gli errori tra le pronte') : null,
      canSend && Q.pending ? el('button', { class: 'btn sm bad', type: 'button', onclick: async (e) => {
        if (!e.currentTarget.dataset.armed) { e.currentTarget.dataset.armed = '1'; e.currentTarget.textContent = 'Conferma: ferma la coda'; return; }
        try { const r = await sql('mail_admin', { op: 'cancel' }); toast('Coda fermata: ' + r.canceled + ' tornano tra le pronte'); await crReload(main); } catch (x) { toast(explain(x)); }
      } }, 'Ferma la coda') : null));
  // registro
  const MS = { pending: ['In coda', 'wait'], sent: ['Inviata', 'done'], failed: ['Non riuscita', 'bad'], canceled: ['Annullata', 'no'] };
  const log = el('details', { class: 'box' }, el('summary', null, 'Ultime email (' + C.log.length + ')'),
    C.log.length ? el('div', { class: 'tblwrap' }, el('table', { class: 'tbl' }, el('tbody', null, ...C.log.map((m) => el('tr', null,
      el('td', null, el('b', null, m.to_name || m.to_email), m.is_test ? el('span', { class: 'chip', style: 'margin-left:6px' }, 'Prova') : null, el('div', { class: 'muted', style: 'font-size:12px' }, m.to_email)),
      el('td', { class: 'hide-m' }, m.subject),
      el('td', null, el('span', { class: 'pill ' + (MS[m.status] || ['', ''])[1], title: m.error || '' }, (MS[m.status] || [m.status])[0])),
      el('td', { class: 'hide-m muted' }, when(m.sent_at || m.created_at) + ' · ' + crName(m.created_by))))))) : el('p', { class: 'muted' }, 'Ancora nessuna email.'));
  rc(body, smtpBox, el('section', { class: 'mail-sec' }, el('h2', null, 'Bozze: email e messaggi DM'), tpls), readyBox, qBox, log);
  if (Q.pending) mailTimer = setTimeout(() => { if (S.view === 'mail' && !document.querySelector('.modal-bg')) crReload(main); }, 15000);
}

function templateModal(t, main) {
  const isNew = !t; t = t || { name: '', kind: 'email', subject: '', body: 'Ciao {nome},\n\n' };
  let kind = tplKind(t);
  const name = el('input', { class: 'search', placeholder: 'Nome della bozza (lo vede solo il team)', value: t.name, maxlength: '80', 'aria-label': 'Nome della bozza' });
  const subj = el('input', { class: 'search', placeholder: 'Oggetto della mail', value: t.subject, maxlength: '200', 'aria-label': 'Oggetto' });
  const text = el('textarea', { class: 'note tpl-text', maxlength: '20000', 'aria-label': 'Testo della mail' }); text.value = t.body;
  const sample = el('input', { class: 'search sm', value: 'Mario', style: 'width:120px', 'aria-label': 'Nome di esempio' });
  const pv = el('div', { class: 'tpl-pv' });
  const paint = () => rc(pv, kind === 'email' ? el('div', { class: 'mail-pv-s' }, 'Oggetto: ', el('b', null, fillName(subj.value, sample.value) || '—')) : null, el('pre', null, fillName(text.value, sample.value)),
    tplFields({ subject: kind === 'email' ? subj.value : '', body: text.value }).length ? el('p', { class: 'muted', style: 'font-size:12px;margin:8px 0 0' }, 'Campi da completare per ogni creator: ' + tplFields({ subject: kind === 'email' ? subj.value : '', body: text.value }).map((k) => '{' + k + '}').join(', ')) : null);
  const kindSeg = el('div', { class: 'seg' });
  const paintKind = () => { rc(kindSeg, ...[['email', 'Email'], ['dm', 'Messaggio DM']].map(([k, l]) => el('button', { type: 'button', 'aria-pressed': String(kind === k), onclick: () => { kind = k; paintKind(); paint(); } }, l))); subj.hidden = kind !== 'email'; if (testBtn) testBtn.hidden = kind !== 'email'; };
  [subj, text, sample].forEach((i) => i.addEventListener('input', paint)); paint();
  let lastFocus = text;
  [subj, text].forEach((i) => i.addEventListener('focus', () => { lastFocus = i; }));
  const insName = el('button', { class: 'btn sm', type: 'button', onclick: () => {
    const i = lastFocus, a = i.selectionStart ?? i.value.length, b = i.selectionEnd ?? a;
    i.value = i.value.slice(0, a) + '{nome}' + i.value.slice(b); i.focus(); i.selectionStart = i.selectionEnd = a + 6; paint();
  } }, 'Inserisci {nome}');
  const close = () => { bg.remove(); document.removeEventListener('keydown', esc); };
  const esc = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', esc);
  const save = async () => {
    try {
      const r = await sql('template_save', { id: isNew ? null : t.id, name: name.value, kind, subject: subj.value, body: text.value });
      close(); toast(isNew ? 'Bozza creata' : 'Bozza salvata'); await crReload(main); return r;
    } catch (e) { toast(explain(e)); return null; }
  };
  const testBtn = !isNew && CAN('creators_send') ? el('button', { class: 'btn', type: 'button', onclick: async (e) => {
    e.currentTarget.disabled = true;
    try { await sql('template_save', { id: t.id, name: name.value, kind, subject: subj.value, body: text.value }); const r = await sql('mail_test', { template_id: t.id, name: sample.value }); toast('Prova in arrivo a ' + r.to); }
    catch (x) { toast(explain(x)); }
    e.currentTarget.disabled = false;
  } }, 'Manda una prova a me') : null;
  let armed = false;
  const del = isNew ? null : el('button', { class: 'btn bad', type: 'button', onclick: async (e) => {
    if (!armed) { armed = true; e.currentTarget.textContent = 'Conferma: elimina'; return; }
    try { await sql('template_remove', { id: t.id }); close(); toast('Bozza eliminata'); await crReload(main); } catch (x) { toast(explain(x)); }
  } }, 'Elimina');
  const bg = el('div', { class: 'modal-bg', onclick: (e) => { if (e.target === bg) close(); } }, el('div', { class: 'modal shop-modal tpl-modal', role: 'dialog', 'aria-label': isNew ? 'Nuova bozza' : 'Bozza' },
    el('div', { class: 'row' }, el('h2', { class: 'grow' }, isNew ? 'Nuova bozza' : 'Bozza'), el('button', { class: 'btn sm ghost', type: 'button', onclick: close, 'aria-label': 'Chiudi' }, '✕')),
    el('div', { class: 'tpl-cols' },
      el('div', { class: 'tpl-ed' }, kindSeg, name, subj, text, el('div', { class: 'row' }, insName, el('span', { class: 'muted', style: 'font-size:12px' }, '{nome} diventa il nome di ogni creator. Le altre parti tra graffe, per esempio {riferimento live/clip}, le completa chi assegna la bozza.'))),
      el('div', { class: 'tpl-side' }, el('div', { class: 'row' }, el('b', { class: 'grow' }, 'Anteprima'), el('span', { class: 'muted' }, 'con'), sample), pv)),
    el('div', { class: 'row' }, del, el('span', { class: 'grow' }), testBtn, el('button', { class: 'btn', type: 'button', onclick: close }, 'Annulla'), el('button', { class: 'btn primary', type: 'button', onclick: save }, isNew ? 'Crea bozza' : 'Salva'))));
  paintKind();
  document.body.append(bg);
  setTimeout(() => (isNew ? name : text).focus(), 30);
}


// ------------------------------------------------------------------ persone (solo founder): i numeri di ognuno
function spark(series) {
  const v = series || [], mx = Math.max(1, ...v), w = 112, hgt = 26, bw = w / Math.max(1, v.length);
  const svg = svgEl('svg', { width: w, height: hgt, viewBox: `0 0 ${w} ${hgt}`, class: 'spark', role: 'img', 'aria-label': 'Creator trovati negli ultimi 14 giorni: ' + v.join(', ') });
  v.forEach((n, i) => { const hh = n ? Math.max(2, (n / mx) * (hgt - 2)) : 1; svg.append(svgEl('rect', { x: (i * bw + 1).toFixed(1), y: (hgt - hh).toFixed(1), width: Math.max(1, bw - 2).toFixed(1), height: hh.toFixed(1), rx: 1, class: n ? (i === v.length - 1 ? 'on now' : 'on') : 'off' })); });
  return svg;
}
function renderPeople(main) {
  const P = S.ppl;
  const body = el('div', { class: 'body cr-body' });
  rc(main, head('Persone'), body);
  if (S.err) { rc(body, el('div', { class: 'err' }, S.err)); return; }
  if (!P) { rc(body, el('div', { class: 'loading' }, 'Caricamento…')); return; }
  const L = P.people || [], sum = (k) => L.reduce((a, x) => a + (+x[k] || 0), 0);
  const sent = sum('sent'), rep = sum('replied');
  const kpi = (n, label, sub) => el('div', { class: 'kpi' }, el('b', null, n), el('span', null, label), sub ? el('small', null, sub) : null);
  const pct = (a, b) => (b ? Math.round((a / b) * 100) + '%' : '—');
  S.pps = S.pps || 'found_30';
  const SORT = [['found_30', 'Creator 30 giorni'], ['found_7', 'Creator 7 giorni'], ['replied', 'Risposte'], ['followers', 'Follower'], ['tasks_done_30', 'Task fatte']];
  const sortSel = el('select', { class: 'search', style: 'width:auto', 'aria-label': 'Ordina per' }, ...SORT.map(([k, l]) => el('option', { value: k, selected: S.pps === k }, 'Ordina: ' + l)));
  sortSel.addEventListener('change', () => { S.pps = sortSel.value; renderPeople(main); });
  const rows = L.slice().sort((a, b) => (+b[S.pps] || 0) - (+a[S.pps] || 0));
  const best = rows[0] && +rows[0][S.pps] ? rows[0].email : null;
  rc(body,
    el('div', { class: 'ov-kpis pp-kpis' },
      kpi(sum('found_today'), 'creator trovati oggi'), kpi(sum('found_7'), 'negli ultimi 7 giorni'), kpi(sum('found_30'), 'negli ultimi 30 giorni', sum('found') + ' in tutto'),
      kpi(sent, 'email arrivate ai creator'), kpi(rep, 'hanno risposto', pct(rep, sent) + ' delle inviate'), kpi(fmtFol(sum('followers')), 'follower raggiunti')),
    el('div', { class: 'cr-bar' }, el('h2', { class: 'grow', style: 'margin:0;font-size:15px' }, 'Ognuno'), sortSel),
    el('div', { class: 'tblwrap' }, el('table', { class: 'tbl pp-tbl' },
      el('thead', null, el('tr', null, el('th', null, 'Persona'), el('th', null, 'Creator trovati'), el('th', { class: 'hide-m' }, 'Ultimi 14 giorni'), el('th', null, 'Email e risposte'),
        el('th', { class: 'hide-m' }, 'Follower'), el('th', null, 'Task'), el('th', { class: 'hide-m' }, 'Attività'))),
      el('tbody', null, ...rows.map((x) => {
        const plats = Object.entries(x.platforms || {}).sort((a, b) => b[1] - a[1]).map(([k, n]) => ((CR_PLAT.find((p) => p[0] === k) || [0, k])[1]) + ' ' + n).join(' · ');
        return el('tr', { class: x.active === false ? 'off' : '' },
          el('td', null, el('div', { class: 'pp-who' }, el('b', null, x.name, x.email === best ? el('span', { class: 'chip hi', style: 'margin-left:6px' }, 'Primo') : null),
            el('small', null, (ROLE_NAME[x.role] || x.role) + (x.active === false ? ' · in pausa' : '') + ' · visto ' + when(x.last_seen)))),
          el('td', null, el('div', { class: 'pp-n' }, el('b', null, x.found_30), el('small', null, 'in 30 giorni')),
            el('div', { class: 'pp-sub' }, x.found_today + ' oggi · ' + x.found_7 + ' in 7 giorni · ' + x.found + ' in tutto'), plats ? el('div', { class: 'pp-sub' }, plats) : null),
          el('td', { class: 'hide-m' }, spark(x.series)),
          el('td', null, el('div', { class: 'pp-n' }, el('b', null, x.sent), el('small', null, 'inviate')),
            el('div', { class: 'pp-sub' }, x.replied + ' risposte (' + pct(x.replied, x.sent) + ')' + (x.errors ? ' · ' + x.errors + ' errori' : '') + ' · ' + x.with_tpl + ' con bozza')),
          el('td', { class: 'hide-m' }, el('div', { class: 'pp-n' }, el('b', null, fmtFol(x.followers)))),
          el('td', null, el('div', { class: 'pp-n' }, el('b', null, x.tasks_open), el('small', null, 'aperte')),
            el('div', { class: 'pp-sub' + (x.tasks_late ? ' late' : '') }, (x.tasks_late ? x.tasks_late + ' in ritardo · ' : '') + x.tasks_done_30 + ' fatte in 30 giorni')),
          el('td', { class: 'hide-m' }, el('div', { class: 'pp-sub' }, x.actions_7 + ' azioni in 7 giorni'), el('div', { class: 'pp-sub' }, 'nel team dal ' + new Date(x.added_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }))));
      })))),
    el('p', { class: 'muted', style: 'font-size:12px' }, '"Trovato da" è sempre l\'account che ha inserito il creator. I numeri contano i creator ancora in lista.'));
}

function taskFromReport(r) {
  return el('button', { class: 'btn', type: 'button', onclick: () => taskModal(null, { title: (r.text || 'Segnalazione').replace(/\s+/g, ' ').slice(0, 120), notes: 'Dalla segnalazione di ' + (r.who || 'un utente') + ':\n\n' + (r.text || ''), report_id: r.id, area: r.kind === 'bug' ? 'Sviluppo' : '' }, $('#main')) }, 'Crea task');
}

// ------------------------------------------------------------------ team e permessi
const PERMS = [
  ['launch', 'Lancio e numeri', 'Download, iscritti e obiettivi del lancio'],
  ['tasks', 'Task', 'Vedere, creare e spostare le task del team'],
  ['creators', 'Creator: aggiungere e assegnare', 'Mettere nomi ed email dei creator, scrivere le bozze e assegnarle. Lo decide solo il proprietario'],
  ['founders', 'Founder: numeri del team', 'Vedere quanti creator trova ogni persona, email, risposte e task. Lo decide solo il proprietario'],
  ['creators_send', 'Creator: mandare le email', 'Spedire le email dalla casella ufficiale di NoonFrame. Lo decide solo il proprietario', 'creators'],
  ['reports', 'Vedere le segnalazioni', 'Bug e idee degli utenti, con screenshot ed email di chi scrive'],
  ['reports_decide', 'Decidere le segnalazioni', 'Approvare, rifiutare e mandare richieste a Claude', 'reports'],
  ['users', 'Vedere gli utenti', 'Email, dispositivi e uso dell\'app: sono dati personali'],
  ['users_edit', 'Gestire gli utenti', 'Bloccare account, scrivere note, regalare crediti e piani', 'users'],
  ['shop', 'Prezzi e offerte', 'Piani, ricariche e offerte lampo che vedono gli utenti'],
  ['money', 'Soldi e fornitori API', 'Costi delle AI, crediti in giro, incassi e saldo dei fornitori'],
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
const OWNER_ONLY = ['creators', 'creators_send', 'founders'];   // chi puo' solo assegnare e chi puo' anche mandare: lo decide solo il proprietario
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
        el('span', { class: 'mb-role' }, el('b', null, ROLE_NAME[m.role] || m.role,
          ME.role !== 'owner' ? null : m.role === 'owner' || m.perms.includes('creators_send') ? el('span', { class: 'chip ok', style: 'margin-left:6px' }, 'Manda email') : m.perms.includes('creators') ? el('span', { class: 'chip', style: 'margin-left:6px' }, 'Solo assegna') : null),
          el('small', null, all ? 'Può fare tutto' : m.perms.length ? m.perms.filter((x) => !OWNER_ONLY.includes(x)).map(permName).join(', ') || 'Solo creator' : 'Nessun permesso')),
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
  const locked = (k) => owner || self || (ME.role !== 'owner' && (!CAN(k) || OWNER_ONLY.includes(k)));
  const roleBox = el('div', { class: 'roles' }), permBox = el('div', { class: 'perms' }), ownBox = el('div', { class: 'ownbox' });
  const paint = () => {
    rc(roleBox, ...ROLES.map(([k, l, d, ps]) => el('button', { type: 'button', class: 'role', 'aria-pressed': String(role === k), disabled: owner || self || (ME.role !== 'owner' && !ps.every(CAN)),
      onclick: () => { role = k; perms = new Set([...ps.filter((x) => !OWNER_ONLY.includes(x)), ...[...perms].filter((x) => OWNER_ONLY.includes(x))]); paint(); } }, el('b', null, l), el('small', null, d))),
      el('button', { type: 'button', class: 'role', 'aria-pressed': String(role === 'custom'), disabled: owner || self, onclick: () => { role = 'custom'; paint(); } }, el('b', null, 'Personalizzato'), el('small', null, 'Scegli tu')));
    // email ai creator e tab Persone: scelte a parte, le decide solo il proprietario
    const canOwn = ME.role === 'owner' && !owner && !self;
    const mail = perms.has('creators_send') ? 'send' : perms.has('creators') ? 'assign' : 'none';
    const setMail = (v) => { perms.delete('creators'); perms.delete('creators_send'); if (v !== 'none') perms.add('creators'); if (v === 'send') perms.add('creators_send'); paint(); };
    rc(ownBox,
      el('div', { class: 'own-h' }, el('b', null, 'Email ai creator'), canOwn ? null : el('small', null, owner ? 'Il proprietario può tutto' : 'Lo decide solo il proprietario')),
      el('div', { class: 'roles three' }, ...[['none', 'Nessun accesso', 'Non vede Creator ed Email'], ['assign', 'Solo assegnare', 'Mette creator ed email, scrive le bozze e le assegna'], ['send', 'Assegnare e mandare', 'Può anche far partire le email dalla casella ufficiale']].map(([v, l, d]) =>
        el('button', { type: 'button', class: 'role' + (v === 'send' ? ' send' : ''), 'aria-pressed': String(owner || mail === v), disabled: canOwn ? null : true, onclick: () => setMail(v) }, el('b', null, l), el('small', null, d)))),
      el('label', { class: 'perm own-f' }, (() => { const cb = el('input', { type: 'checkbox', checked: owner || perms.has('founders'), disabled: canOwn ? null : true }); cb.addEventListener('change', () => { if (cb.checked) perms.add('founders'); else perms.delete('founders'); paint(); }); return cb; })(),
        el('span', null, el('b', null, 'Founder: vede la tab Persone'), el('small', null, 'I numeri di ogni persona del team: creator trovati, email, risposte e task'))));
    rc(permBox, ...PERMS.filter(([k]) => !OWNER_ONLY.includes(k)).map(([k, l, d, needs]) => {
      const on = owner || perms.has(k);
      const cb = el('input', { type: 'checkbox', checked: on, disabled: locked(k) || (needs && !perms.has(needs) && !owner) });
      cb.addEventListener('change', () => {
        if (cb.checked) perms.add(k); else { perms.delete(k); PERMS.filter((p) => p[3] === k).forEach((p) => perms.delete(p[0])); }
        const core = [...perms].filter((x) => !OWNER_ONLY.includes(x)), match = ROLES.find((r) => { const rc2 = r[3].filter((x) => !OWNER_ONLY.includes(x)); return rc2.length === core.length && rc2.every((x) => perms.has(x)); });
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
    owner || ME.role !== 'owner' ? null : ownBox,   // solo il proprietario vede (e decide) email ai creator e founder
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
// ------------------------------------------------------------------ clip dal web: quanto costano davvero (AI + server Modal), tetto di spesa e pausa
const MODAL_WS = 'saurroemanuele-work';
const WC_EUR_PER_CREDIT = 69.99 / 6500;   // il prezzo piu' basso a cui vendiamo un credito (Ultimate): stima prudente
const WC_STATUS = { done: ['done', 'Pronte'], failed: ['bad', 'Fallito'], running: ['queued', 'In corso'], queued: ['new', 'In coda'], cancelled: ['no', 'Annullato'] };
const mins = (s) => { s = Math.round(+s || 0); if (!s) return '—'; const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return h ? h + ' h ' + String(m).padStart(2, '0') + ' min' : m + ' min'; };
function renderWebclip(main) {
  S.wdays = S.wdays || 30;
  const reload = async (d) => { if (d) S.wdays = d; S.wc = null; renderWebclip(main); try { S.wc = await sql('webclip', { days: S.wdays }); S.err = null; } catch (e) { S.err = explain(e); } renderWebclip(main); };
  const seg = el('div', { class: 'seg' }, ...[[7, '7 giorni'], [30, '30 giorni'], [90, '90 giorni']].map(([d, l]) =>
    el('button', { type: 'button', 'aria-pressed': String(S.wdays === d), onclick: () => reload(d) }, l)));
  const body = el('div', { class: 'body' });
  rc(main, head('Clip dal web', seg), body);
  if (S.err) { rc(body, el('div', { class: 'err' }, S.err)); return; }
  const W = S.wc; if (!W) { rc(body, el('div', { class: 'loading' }, 'Caricamento…')); return; }
  const fx = ECO.fx || 0.9;
  const costUsd = (+W.ai_usd || 0) + (+W.server_usd || 0);
  const value = (+W.credits || 0) * WC_EUR_PER_CREDIT;
  const cap = +W.cap_usd || 0, month = +W.month_usd || 0, pct = cap ? Math.min(100, month / cap * 100) : 0;
  const kpi = (v, label, sub, cls) => el('div', { class: 'kpi' + (cls ? ' ' + cls : '') }, el('b', null, v), el('span', null, label), sub ? el('small', null, sub) : null);
  const a = (label, href) => el('a', { class: 'btn sm', href, target: '_blank', rel: 'noopener noreferrer' }, label, ' ↗');

  // controlli: pausa, tetto, prezzo
  const capIn = el('input', { class: 'search', type: 'number', min: '0', max: '500', step: '1', value: String(cap), 'aria-label': 'Tetto di spesa al mese in dollari', style: 'width:110px' });
  const phIn = el('input', { class: 'search', type: 'number', min: '20', max: '500', step: '1', value: String(W.per_hour || 60), 'aria-label': 'Crediti per ora di video', style: 'width:110px' });
  const save = async (patch, btn, ok) => {
    if (btn) btn.disabled = true;
    try { S.wc = await sql('webclip_save', patch); S.wc = await sql('webclip', { days: S.wdays }); toast(ok); } catch (e) { toast(explain(e)); }
    renderWebclip(main);
  };
  const pauseBtn = el('button', { class: 'btn' + (W.paused ? ' primary' : ''), type: 'button', onclick: (e) => save({ paused: !W.paused }, e.currentTarget, W.paused ? 'Clip dal web riaccese' : 'Clip dal web in pausa') },
    W.paused ? 'Riaccendi le clip dal web' : 'Metti in pausa');
  const saveBtn = el('button', { class: 'btn primary', type: 'button', onclick: (e) => {
    const c = Number(capIn.value), h = Number(phIn.value);
    if (!(c >= 0 && c <= 500)) { toast('Il tetto va da 0 a 500 $'); return; }
    if (!(h >= 20 && h <= 500)) { toast('Il prezzo va da 20 a 500 crediti per ora'); return; }
    save({ cap_usd: c, per_hour: Math.round(h) }, e.currentTarget, 'Salvato');
  } }, 'Salva');

  const maxS = Math.max(0.01, ...(W.series || []).map((d) => +d.usd || 0));
  const list = W.list || [];
  rc(body, el('div', { class: 'ov' },
    W.paused ? el('div', { class: 'box ask', style: 'margin:0' }, el('h3', null, 'In pausa'), el('p', null, 'Chi prova a creare clip dal sito vede un avviso e gli viene suggerita l\'app per computer. I lavori già partiti finiscono normalmente.'))
      : (cap && month >= cap) ? el('div', { class: 'box ask', style: 'margin:0' }, el('h3', null, 'Tetto del mese raggiunto'), el('p', null, 'Spesi ' + usdF(month) + ' su ' + usdF(cap) + ': le nuove clip dal web sono ferme fino al mese prossimo. Alza il tetto qui sotto per riaprirle.')) : null,
    el('div', { class: 'kpis' },
      kpi(num(W.jobs), 'Lavori', num(W.done) + ' riusciti · ' + num(W.failed) + ' falliti' + (W.running ? ' · ' + W.running + ' in corso' : ''), W.failed > W.done && W.jobs > 2 ? 'hot' : ''),
      kpi((+W.video_hours || 0).toLocaleString('it-IT') + ' h', 'Ore di video', W.avg_min ? 'in media ' + String(W.avg_min).replace('.', ',') + ' min di lavoro a video' : 'da ' + num(W.users) + (W.users === 1 ? ' persona' : ' persone')),
      kpi(num(W.credits), 'Crediti scalati', '≈ ' + eur(value) + ' se pagati (prezzo più basso)'),
      kpi(eur(costUsd * fx), 'Costo vero', usdF(W.ai_usd) + ' AI + ' + usdF(W.server_usd) + ' server'),
      kpi(eur(value - costUsd * fx), 'Margine', value ? Math.round((1 - costUsd * fx / value) * 100) + '% dei crediti scalati' : 'arriva con i primi lavori riusciti', value && value < costUsd * fx ? 'hot' : '')),
    el('div', { class: 'cards' },
      el('div', { class: 'card' }, el('h2', null, 'Spesa di questo mese'),
        el('div', { class: 'wc-cap' }, el('b', null, usdF(month)), el('span', null, cap ? 'su un tetto di ' + usdF(cap) : 'nessun tetto')),
        cap ? el('div', { class: 'wc-meter' + (pct >= 80 ? ' hot' : '') }, el('i', { style: 'width:' + Math.max(1, pct) + '%' })) : null,
        el('p', { class: 'muted fine', style: 'margin:10px 0 0' }, 'Quando la spesa del mese arriva al tetto, il sito smette di accettare nuove clip da solo. Modal regala 30 $ al mese: sotto quella cifra il server non costa niente, sopra paga la carta.')),
      el('div', { class: 'card' }, el('h2', null, 'Costo giorno per giorno'),
        (W.series || []).length ? el('div', { class: 'mbars' }, ...W.series.map((d) => el('span', { title: shortDay(d.d) + ': ' + usdF(d.usd) + ' · ' + d.n + ' lavori, ' + d.ok + ' riusciti', style: 'height:' + Math.max(2, (+d.usd || 0) / maxS * 100) + '%' })))
          : el('p', { class: 'muted', style: 'margin:0' }, 'Ancora nessun lavoro nel periodo.'))),
    el('div', { class: 'cards' },
      el('div', { class: 'card' }, el('h2', null, 'Impostazioni'),
        el('div', { class: 'wc-set' },
          el('label', { class: 'fld' }, 'Tetto di spesa al mese ($)', capIn),
          el('label', { class: 'fld' }, 'Crediti per ogni ora di video', phIn),
          saveBtn),
        el('p', { class: 'muted fine', style: 'margin:10px 0 12px' }, 'Oggi ' + (W.per_hour || 60) + ' crediti per ora = ' + Math.round((W.per_hour || 60) / 60 * 10) / 10 + ' a minuto. Il prezzo cambia solo per i lavori nuovi.'),
        el('div', { class: 'row wrap' }, pauseBtn)),
      el('div', { class: 'card' }, el('h2', null, 'Bollette vere'),
        el('p', { class: 'muted fine', style: 'margin:0 0 12px' }, 'Qui il costo del server è stimato dai minuti di lavoro (GPU T4 + processori). Ogni tanto confrontalo con le bollette: se si discosta, dimmelo e correggo la stima.'),
        el('div', { class: 'row wrap' }, a('Consumi Modal', 'https://modal.com/settings/' + MODAL_WS + '/usage'), a('Server delle clip', 'https://modal.com/apps/' + MODAL_WS + '/main/deployed/noonframe-webclip'), a('Consumi Anthropic', 'https://platform.claude.com/usage')))),
    el('div', { class: 'cards' }, el('div', { class: 'card', style: 'grid-column:1/-1' }, el('h2', null, 'Ultimi lavori'),
      list.length ? el('table', { class: 'tbl site-tbl req-tbl wc-tbl' },
        el('thead', null, el('tr', null, el('th', null, 'Quando'), el('th', null, 'Chi'), el('th', null, 'Video'), el('th', null, 'Stato'), el('th', null, 'Durata'), el('th', null, 'Lavoro'), el('th', null, 'Crediti'), el('th', null, 'Costo'))),
        el('tbody', null, ...list.map((x) => { const st = WC_STATUS[x.status] || ['no', x.status];
          return el('tr', { title: x.error ? x.error + (x.detail && x.detail !== 'test' ? '\n' + x.detail : '') : '' },
            el('td', { class: 'muted' }, when(x.created_at)), el('td', { class: 'req-mail' }, x.who || '—'),
            el('td', { 'data-l': 'Video', class: 'wc-title' }, el('span', null, (x.platform ? (PLAT_WC[x.platform] || x.platform) + ' · ' : '') + (x.title || 'senza titolo')), x.error ? el('small', { class: 'wc-err' }, x.error) : null),
            el('td', { 'data-l': 'Stato' }, el('span', { class: 'pill ' + st[0] }, st[1]), x.clips ? ' ' + x.clips + ' clip' : '', x.refunded ? el('small', { class: 'muted' }, ' · rimborsato') : ''),
            el('td', { 'data-l': 'Durata', class: 'num' }, mins(x.duration)),
            el('td', { 'data-l': 'Lavoro', class: 'num' }, mins(x.s), x.gpu === true ? el('small', { class: 'muted' }, ' GPU') : x.gpu === false ? el('small', { class: 'muted' }, ' CPU') : ''),
            el('td', { 'data-l': 'Crediti', class: 'num' }, x.credits ? num(x.credits) : '—'),
            el('td', { 'data-l': 'Costo', class: 'num' }, usdF((+x.usd || 0) + (+x.srv || 0))));
        })))
        : el('p', { class: 'muted', style: 'margin:0' }, 'Ancora nessun lavoro. Le clip dal web si creano da noonframe.com/clip.html.'),
      null))));
}
const PLAT_WC = { youtube: 'YouTube', twitch: 'Twitch', kick: 'Kick' };
const usdF = (n) => '$' + (+n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// ------------------------------------------------------------------ API e fornitori: stato delle chiavi, saldo dove si può, link per ricaricare
const PROJ_URL = 'https://supabase.com/dashboard/project/' + PROJECT;
const PROVIDERS = [
  { id: 'fal', name: 'fal.ai', use: 'Video e immagini AI', key: 'FAL_KEY', links: [['Ricarica', 'https://fal.ai/dashboard/billing'], ['Chiavi', 'https://fal.ai/dashboard/keys']] },
  { id: 'elevenlabs', name: 'ElevenLabs', use: 'Voci AI', key: 'ELEVENLABS_API_KEY', links: [['Ricarica', 'https://elevenlabs.io/app/subscription'], ['Consumi', 'https://elevenlabs.io/app/usage'], ['Chiavi', 'https://elevenlabs.io/app/settings/api-keys']] },
  { id: 'anthropic', name: 'Anthropic (Claude)', use: 'Testi, montaggio e grafica AI', key: 'ANTHROPIC_API_KEY', links: [['Ricarica', 'https://platform.claude.com/settings/billing'], ['Consumi', 'https://platform.claude.com/usage'], ['Limiti di spesa', 'https://platform.claude.com/settings/limits'], ['Chiavi', 'https://platform.claude.com/settings/keys']] },
  { id: 'resend', name: 'Resend', use: 'Email: link di download e risposte del team', key: 'RESEND_API_KEY', links: [['Piano', 'https://resend.com/settings/billing'], ['Domini', 'https://resend.com/domains'], ['Chiavi', 'https://resend.com/api-keys']] },
  { id: 'supabase', name: 'Supabase', use: 'Database, accessi e server dell\'app', links: [['Piano e consumi', PROJ_URL + '/settings/billing/usage'], ['Dove si mettono le chiavi', PROJ_URL + '/functions/secrets']] },
];
async function loadKeys() {
  const { data, error } = await sb.functions.invoke('admin-keys', { body: {} });
  if (error) {
    let code = '';
    try { code = (await error.context.json()).error; } catch (e) { /* */ }
    throw { code: code === 'no_perm' ? 'no_perm' : code === 'mfa_required' ? 'mfa' : 'db', message: 'Non riesco a leggere lo stato delle chiavi.' };
  }
  return data;
}
function renderApis(main) {
  const body = el('div', { class: 'body shop-body' });
  rc(main, head('API e fornitori', el('button', { class: 'btn', type: 'button', onclick: async () => { S.keys = null; S.err = null; renderApis(main); try { S.keys = await loadKeys(); } catch (e) { S.err = explain(e); } renderApis(main); } }, 'Controlla di nuovo')), body);
  if (S.err) { rc(body, el('div', { class: 'err' }, S.err)); return; }
  const K = S.keys;
  if (!K) { rc(body, el('div', { class: 'loading' }, 'Controllo le chiavi…')); return; }
  const a = (label, href, primary) => el('a', { class: 'btn sm' + (primary ? ' primary' : ''), href, target: '_blank', rel: 'noopener noreferrer' }, label, ' ↗');
  const extra = (p) => {
    if (p.id === 'fal' && K.fal) {
      if (K.fal.balance != null && !isNaN(K.fal.balance)) return el('div', { class: 'api-bal' + (K.fal.balance < 10 ? ' low' : '') }, el('b', null, '$' + K.fal.balance.toFixed(2)), el('span', null, K.fal.balance < 10 ? 'credito rimasto: ricarica presto' : 'credito rimasto'));
      if (K.fal.error === 'admin_key') return el('p', { class: 'muted api-note' }, 'Per vedere qui il saldo crea su fal una chiave di tipo Admin e salvala in Supabase come FAL_ADMIN_KEY.');
    }
    if (p.id === 'elevenlabs' && K.elevenlabs && K.elevenlabs.limit) {
      const left = Math.max(0, K.elevenlabs.limit - K.elevenlabs.used), pct = left / K.elevenlabs.limit;
      return el('div', { class: 'api-bal' + (pct < 0.15 ? ' low' : '') }, el('b', null, num(left)), el('span', null, 'caratteri rimasti su ' + num(K.elevenlabs.limit)
        + (K.elevenlabs.reset ? ' · si ricaricano il ' + new Date(K.elevenlabs.reset * 1000).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' }) : '')));
    }
    if (p.id === 'elevenlabs' && K.elevenlabs && K.elevenlabs.error === 'permission') return el('p', { class: 'muted api-note' }, 'La chiave non può leggere il piano: su ElevenLabs dalle il permesso "User: read" per vedere qui i caratteri rimasti.');
    return null;
  };
  const missing = PROVIDERS.filter((p) => p.key && !K.keys[p.id]);
  rc(body,
    missing.length ? el('div', { class: 'box ask', style: 'margin:0 0 16px' }, el('h3', null, 'Chiavi mancanti'),
      el('p', null, 'Mancano: ' + missing.map((p) => p.key).join(', ') + '. Senza, quelle funzioni non vanno per chi usa i crediti. Si mettono in Supabase → Edge Functions → Secrets.'),
      el('div', { class: 'row', style: 'margin-top:8px' }, a('Apri la pagina delle chiavi', PROJ_URL + '/functions/secrets', true))) : null,
    el('div', { class: 'apis' }, ...PROVIDERS.map((p) => {
      const has = p.key ? K.keys[p.id] : true;
      return el('section', { class: 'card api' },
        el('div', { class: 'api-top' }, el('span', { class: 'sdot-w ' + (has ? 'ok' : 'bad') }, el('span', { class: 'sdot' })),
          el('div', { class: 'grow' }, el('b', null, p.name), el('small', null, p.use)),
          p.key ? el('span', { class: 'pill ' + (has ? 'done' : 'bad') }, has ? 'Chiave impostata' : 'Chiave mancante') : null),
        extra(p),
        p.key ? el('p', { class: 'muted api-note' }, 'Nome della chiave in Supabase: ', el('code', null, p.key)) : null,
        el('div', { class: 'row wrap' }, ...p.links.map(([l, u], i) => a(l, u, i === 0))));
    })),
    el('div', { class: 'box', style: 'margin-top:16px' }, el('h3', null, 'Consigli'),
      el('p', null, '• Su ogni fornitore attiva la ricarica automatica con un tetto mensile: se qualcuno abusa, al massimo spendi quel tetto.'),
      el('p', null, '• Le chiavi vanno solo in Supabase (Secrets). Non scriverle mai in chat, in un file o nel codice: qui il pannello vede solo se ci sono, non il loro valore.'),
      el('p', null, '• Il costo stimato delle AI lo trovi in Soldi; confrontalo ogni tanto con le bollette dei fornitori.')),
    el('p', { class: 'muted fine', style: 'margin-top:10px' }, 'Controllato ' + when(K.at) + '.'));
}
// ------------------------------------------------------------------ avvio
let startView = 'today';
try { startView = localStorage.getItem('nuvora.admin.view2') || 'today'; } catch (e) { /* */ }
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
  go(allowed(S.view) ? S.view : (allowed('today') ? 'today' : 'overview'));
  load(S.view, true);
  poll = setInterval(() => { if (document.visibilityState === 'visible') load(S.view, true); }, 120000);
}
$('#logout').addEventListener('click', async () => { await sb.auth.signOut(); gate(); });
sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') { READY = false; } });
gate();
